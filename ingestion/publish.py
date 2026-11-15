"""Stages 4-5: dedupe key, human overrides, then an idempotent upsert into Supabase.
Exists so re-running the pipeline only writes rows whose content changed, and human fixes survive every run."""
import json
import re
from datetime import date, datetime, timezone

import httpx
import yaml

from .models import ROOT

CONTENT_COLS = ["dedupe_key", "source_slug", "stage", "category", "title", "summary", "scope_type", "scope_value",
                "venue_lat", "venue_lon", "grade_basis", "grades_allowed", "requires", "opens_on", "deadline",
                "starts_on", "date_text", "cycle_label", "date_confidence", "status", "action_type", "action_url", "cost_type",
                "cost_usd", "tags", "evidence", "source_url", "verification_state", "extraction_method", "review_note"]


def cycle_label(rec: dict) -> str:
    """summer-YYYY, fall-YYYY, ay-YYYY-YY (Jan-May dates) or none, from verified dates only."""
    d = rec.get("starts_on") or rec.get("deadline") or rec.get("opens_on")
    if not d:  # no dates: fall back to the cycle the page names, as written (e.g. "fall 2026")
        return re.sub(r"[^a-z0-9]+", "-", (rec.get("cycle_label") or "none").lower()).strip("-") or "none"
    dt = date.fromisoformat(d)
    if 6 <= dt.month <= 8:
        return f"summer-{dt.year}"
    if dt.month >= 9:
        return f"fall-{dt.year}"
    return f"ay-{dt.year - 1}-{str(dt.year)[2:]}"


def dedupe_key(rec: dict, owner: str) -> str:
    slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return f"{slug(owner)}|{slug(rec['title'])}|{rec['cycle_label']}"


def build_row(rec: dict, source: dict, state: str, method: str = "llm", note: str = None) -> dict:
    rec = dict(rec)
    rec["cycle_label"] = cycle_label(rec)
    cost = rec.get("cost_usd")
    return {**{c: rec.get(c) for c in CONTENT_COLS}, "dedupe_key": dedupe_key(rec, source["owner"]),
            "cycle_label": rec["cycle_label"], "source_slug": source["id"], "stage": source["stage"],
            "scope_type": source["scope_type"], "scope_value": source["scope_value"],
            "venue_lat": source.get("lat"), "venue_lon": source.get("lon"),
            "cost_type": None if cost is None else ("free" if cost == 0 else "paid"),
            "source_url": source["url"], "verification_state": state, "extraction_method": method,
            "action_url": rec.get("action_url") or source["url"],
            "requires": rec.get("requires") or {}, "tags": rec.get("tags") or [], "review_note": note}


def load_overrides(path=ROOT / "ingestion" / "overrides.yaml") -> list:
    return (yaml.safe_load(path.read_text()) or {}).get("overrides") or []


def apply_overrides(rows: dict, overrides: list) -> tuple:
    """rows: dedupe_key -> row. Returns (rows, unmatched_override_keys). Actions: approve, reject, edit."""
    unmatched = []
    for ov in overrides:
        row = rows.get(ov["key"])
        if row is None:
            unmatched.append(ov["key"])
            continue
        note = f"{ov['action']} by {ov['reviewer']} on {ov['date']}: {ov.get('note', '')}".strip()
        if ov["action"] == "reject":
            del rows[ov["key"]]
            continue
        row.update(ov.get("fields") or {})
        row["verification_state"] = "verified"
        row["extraction_method"] = "manual" if ov["action"] == "edit" else row["extraction_method"]
        row["review_note"] = note
    return rows, unmatched


def _canon(row: dict) -> str:
    """Stable text form of a row's content. Numbers are compared as floats, because the database returns 150 for 150.0."""
    vals = {c: row.get(c) for c in CONTENT_COLS}
    for c in ("cost_usd", "venue_lat", "venue_lon"):
        if vals[c] is not None:
            vals[c] = float(vals[c])
    return json.dumps(vals, sort_keys=True, default=str)


def publish_rows(store, rows: list) -> dict:
    """Write only new or changed rows. A second identical run returns zero inserts and zero updates."""
    existing = store.existing()
    ins = [r for r in rows if r["dedupe_key"] not in existing]
    upd = [r for r in rows if r["dedupe_key"] in existing and _canon(r) != _canon(existing[r["dedupe_key"]])]
    now = datetime.now(timezone.utc).isoformat()
    store.write([{**r, "last_verified_at": now} for r in ins + upd])
    return {"inserted": len(ins), "updated": len(upd), "unchanged": len(rows) - len(ins) - len(upd)}


def load_schools(path=ROOT / "ingestion" / "schools.yaml") -> list:
    return yaml.safe_load(path.read_text())["schools"]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def check_scopes(sources: list, schools: list) -> list:
    """Problems that would make a source's rows unmatchable: a district scope_value that is no school's district_slug,
    or a school/institution scope_value that is no school's slug. Empty list means consistent."""
    district_slugs = {s["district_slug"] for s in schools if s.get("district_slug")}
    school_slugs = {s["slug"] for s in schools}
    bad = []
    for src in sources:
        if src["scope_type"] == "district" and src["scope_value"] not in district_slugs:
            bad.append(f"{src['id']}: district scope_value '{src['scope_value']}' is not a district_slug in schools.yaml")
        if src["scope_type"] in ("school", "institution") and src["scope_value"] not in school_slugs:
            bad.append(f"{src['id']}: {src['scope_type']} scope_value '{src['scope_value']}' is not a school slug")
    return bad


def seed_schools(store, schools: list) -> dict:
    """Upsert the demo schools by slug. Refuses a row with no coordinates or no verified_at, so nothing unconfirmed is seeded."""
    bad = [s["slug"] for s in schools if s.get("lat") is None or s.get("lon") is None or not s.get("verified_at")]
    if bad:
        raise ValueError(f"schools missing lat/lon or verified_at: {bad}")
    store.upsert("schools", schools, "slug")
    return {"seeded": len(schools)}


class SupabaseStore:
    """Thin PostgREST client using the service key (server and pipeline only)."""
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.http = httpx.Client(headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=30.0)

    def _req(self, method, path, **kw):
        r = self.http.request(method, self.base + path, **kw)
        r.raise_for_status()
        return r.json() if r.content else None

    def _source_ids(self) -> dict:
        return {s["slug"]: s["id"] for s in self._req("GET", "/sources?select=id,slug")}

    def upsert(self, table: str, rows: list, conflict: str) -> None:
        if rows:
            self._req("POST", f"/{table}?on_conflict={conflict}", json=rows,
                      headers={"Prefer": "resolution=merge-duplicates"})

    def existing(self) -> dict:
        slugs = {v: k for k, v in self._source_ids().items()}
        rows = self._req("GET", "/opportunities?select=*")
        return {r["dedupe_key"]: {**r, "source_slug": slugs.get(r["source_id"])} for r in rows}

    def write(self, rows: list) -> None:
        ids = self._source_ids()
        out = [{**{k: v for k, v in r.items() if k != "source_slug"}, "source_id": ids[r["source_slug"]]} for r in rows]
        self.upsert("opportunities", out, "dedupe_key")

    def insert(self, table: str, row: dict):
        return self._req("POST", f"/{table}", json=row, headers={"Prefer": "return=representation"})[0]
