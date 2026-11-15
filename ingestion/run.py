"""Command line entry point: fetch, extract, verify, dedupe, override, publish and report, in that order.
Exists so the whole pipeline is one command (python -m ingestion.run) that is a dry run unless --publish is passed."""
import argparse
import os
from datetime import datetime, timezone

import yaml

from .extract import apply_pre_admission, extract, normalize_districts
from .fetch import check_url, fetch_source, new_client, robots_ok
from .models import ROOT, load_env
from .publish import SupabaseStore, apply_overrides, build_row, check_scopes, load_overrides, load_schools, publish_rows, seed_schools
from .report import run_row, write_report
from .verify import verify

MANUAL_META = ("source", "entered_by", "entered_on")


def schools_of(src: dict) -> list:
    """A shared source (for example a regional camp page) lists several schools; others list one."""
    return src["school"] if isinstance(src["school"], list) else [src["school"]]


def run(argv=None) -> dict:
    ap = argparse.ArgumentParser(prog="python -m ingestion.run")
    ap.add_argument("--publish", action="store_true", help="write to Supabase (default is a dry run)")
    ap.add_argument("--dry-run", action="store_true", help="explicit dry run (the default)")
    ap.add_argument("--seed-schools", action="store_true", help="upsert ingestion/schools.yaml into the database, then exit")
    ap.add_argument("--source", help="only this source id")
    ap.add_argument("--all", action="store_true", help="with --publish: confirm you mean every source in sources.yaml")
    ap.add_argument("--school", action="append", help="only sources for this school slug (repeatable)")
    ap.add_argument("--max-pages", type=int, default=40, help="cap on pages fetched this run")
    args = ap.parse_args(argv)
    if args.publish and not (args.school or args.all):
        ap.error("--publish needs --school <slug> (repeatable) or --all; a bare --publish would publish every source")
    load_env()
    if args.seed_schools:
        schools = yaml.safe_load((ROOT / "ingestion" / "schools.yaml").read_text())["schools"]
        result = seed_schools(SupabaseStore(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]), schools)
        print(f"schools: {result['seeded']} upserted")
        return result
    all_sources = yaml.safe_load((ROOT / "ingestion" / "sources.yaml").read_text())["sources"]
    schools = load_schools()
    problems = check_scopes(all_sources, schools)
    if problems:  # an inconsistent scope would publish rows no school can ever match
        raise SystemExit("scope check failed:\n  " + "\n  ".join(problems))
    sources = [s for s in all_sources if (not args.source or s["id"] == args.source)
               and (not args.school or any(sc in args.school for sc in schools_of(s)))]
    stats = {"started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "mode": "publish" if args.publish else "dry-run", "sources_attempted": 0, "sources_ok": 0,
             "extracted": 0, "verified": 0, "needs_review": 0, "rejected": 0, "manual": 0, "tokens_in": 0,
             "tokens_out": 0, "rejections_by_code": {}, "per_source": [], "rejections": [], "dropped_pre_admission": [], "records": []}
    rows: dict = {}
    pages: dict = {}   # source id -> (text, final_url) for pages fetched this run
    seen: dict = {}    # page hash -> first source id that reached it

    def handle(rec, src, text, final_url, client, method="llm", note=None):
        v = verify(rec, text, {**src, "final_url": final_url}, url_ok=lambda u: check_url(client, u))
        if v.state == "rejected":
            stats["rejected"] += 1
            for r in (r for r in v.reasons if r.level == "reject"):
                stats["rejections_by_code"][r.code] = stats["rejections_by_code"].get(r.code, 0) + 1
                stats["rejections"].append({"source": src["id"], "title": rec.get("title"), "code": r.code, "detail": r.detail})
            return
        stats["verified" if v.state == "verified" else "needs_review"] += 1
        stats["manual"] += method == "manual"
        stats["records"].append({"source": src["id"], "scope": f"{src['scope_type']}:{src['scope_value']}", "state": v.state, "rec": v.record,
                                 "review": [f"{r.code} {r.detail}" for r in v.reasons if r.level == "review"]})
        row = build_row(v.record, src, v.state, method, note)
        rows[row["dedupe_key"]] = row

    fetched = 0
    with new_client() as client:
        for src in sources:
            stats["sources_attempted"] += 1
            entry = {"id": src["id"], "school": ", ".join(schools_of(src)), "result": "ok", "tokens_est": 0, "note": ""}
            stats["per_source"].append(entry)
            if src.get("blocked_by_robots"):  # flagged by a human; confirm with one robots.txt request, never fetch the page
                still = not robots_ok(client, src["url"])
                entry.update(result="blocked_by_robots" if still else "error",
                             note="robots.txt disallows this crawler" if still else "flagged blocked_by_robots but robots.txt now allows it: review the flag")
                continue
            if fetched >= args.max_pages:
                entry.update(result="skipped", note="page cap reached")
                continue
            fetched += 1
            f = fetch_source(src, client)
            entry["tokens_est"] = f.tokens_est
            if f.error or f.skipped:
                entry.update(result="error" if f.error else "skipped", note=f.error or f.skipped)
                continue
            stats["sources_ok"] += 1
            pages[src["id"]] = (f.text, f.final_url)
            if f.sha in seen:  # same page reached by two registered URLs: extract it once
                entry["note"] = f"duplicate page of {seen[f.sha]}; not re-extracted"
                continue
            seen[f.sha] = src["id"]
            try:
                recs, usage = extract(src, f.text, f.sha)
            except Exception as exc:  # one bad LLM call must not sink the run; it is reported, never hidden
                entry.update(result="error", note=f"extract failed: {type(exc).__name__}: {str(exc)[:200]}")
                continue
            stats["tokens_in"] += usage["tokens_in"]
            stats["tokens_out"] += usage["tokens_out"]
            recs, dropped = apply_pre_admission(recs, src)
            recs = normalize_districts(recs, schools)
            stats["dropped_pre_admission"] += [{"source": src["id"], "title": t} for t in dropped]
            for rec in recs:
                stats["extracted"] += 1
                handle(rec, src, f.text, f.final_url, client)
        manual = (yaml.safe_load((ROOT / "ingestion" / "manual_records.yaml").read_text()) or {}).get("records") or []
        by_id = {s["id"]: s for s in all_sources}
        for m in manual:  # hand-entered records: same gates, but no page text when the page was blocked
            text, final_url = pages.get(m["source"], (None, None))
            handle({k: v for k, v in m.items() if k not in MANUAL_META}, by_id[m["source"]], text, final_url, client,
                   "manual", f"manual entry by {m['entered_by']} on {m['entered_on']}")
    rows, unmatched = apply_overrides(rows, load_overrides())
    stats["scoped"] = bool(args.school or args.source)  # an override for a school outside this run cannot match
    stats["unmatched_overrides"] = [] if stats["scoped"] else unmatched
    stats["rejected_by_override"] = sorted(k for k, r in rows.items() if r["verification_state"] == "rejected")
    if args.publish:
        store = SupabaseStore(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        store.upsert("sources", [{"slug": s["id"], **{k: s[k] for k in ("url", "owner", "stage", "scope_type", "scope_value", "lat", "lon")}}
                                 for s in all_sources], "slug")  # opportunities reference sources by id
        stats["publish"] = publish_rows(store, list(rows.values()))
        run_id = store.insert("pipeline_runs", run_row(stats, datetime.now(timezone.utc).isoformat()))["id"]
        sid = store._source_ids()
        for rej in stats["rejections"]:
            store.insert("rejections", {"run_id": run_id, "source_id": sid.get(rej["source"]), "title": rej["title"],
                                        "reason_code": rej["code"], "detail": rej["detail"]})
    counts: dict = {}
    for r in rows.values():
        k = f"{r['scope_type']} / {r['verification_state']}"
        counts[k] = counts.get(k, 0) + 1
    stats["row_counts"] = dict(sorted(counts.items()))
    path = write_report(stats)
    print(f"{stats['mode']}: {stats['sources_ok']}/{stats['sources_attempted']} sources fetched, "
          f"{stats['extracted']} extracted, {stats['verified']} verified, {stats['needs_review']} needs_review, "
          f"{stats['rejected']} rejected, {len(stats['dropped_pre_admission'])} dropped (pre_admission), "
          f"{stats['manual']} manual. Rows written: {stats.get('publish', 'none (dry run)')}. Report: {path}")
    return stats


if __name__ == "__main__":
    run()
