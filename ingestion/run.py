"""Command line entry point: fetch, extract, verify, dedupe, override, publish and report, in that order.
Exists so the whole pipeline is one command (python -m ingestion.run) that is a dry run unless --publish is passed."""
import argparse
import os
from datetime import datetime, timezone

import yaml

from .extract import extract
from .fetch import check_url, fetch_source, new_client
from .models import ROOT, load_env
from .publish import SupabaseStore, apply_overrides, build_row, load_overrides, publish_rows
from .report import run_row, write_report
from .verify import verify


def run(argv=None) -> dict:
    ap = argparse.ArgumentParser(prog="python -m ingestion.run")
    ap.add_argument("--publish", action="store_true", help="write to Supabase (default is a dry run)")
    ap.add_argument("--dry-run", action="store_true", help="explicit dry run (the default)")
    ap.add_argument("--source", help="only this source id")
    ap.add_argument("--max-pages", type=int, default=15, help="cap on pages fetched this run")
    args = ap.parse_args(argv)
    load_env()
    sources = yaml.safe_load((ROOT / "ingestion" / "sources.yaml").read_text())["sources"]
    sources = [s for s in sources if not args.source or s["id"] == args.source][: args.max_pages]
    stats = {"started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "mode": "publish" if args.publish else "dry-run", "sources_attempted": 0, "sources_ok": 0,
             "extracted": 0, "verified": 0, "needs_review": 0, "rejected": 0, "tokens_in": 0, "tokens_out": 0,
             "rejections_by_code": {}, "per_source": [], "rejections": []}
    rows: dict = {}
    seen: dict = {}
    with new_client() as client:
        for src in sources:
            stats["sources_attempted"] += 1
            f = fetch_source(src, client)
            entry = {"id": src["id"], "school": src["school"], "result": "ok", "tokens_est": f.tokens_est, "note": ""}
            stats["per_source"].append(entry)
            if f.error or f.skipped:
                entry.update(result="error" if f.error else "skipped", note=f.error or f.skipped)
                continue
            stats["sources_ok"] += 1
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
            for rec in recs:
                stats["extracted"] += 1
                v = verify(rec, f.text, {**src, "final_url": f.final_url}, url_ok=lambda u: check_url(client, u))
                if v.state == "rejected":
                    stats["rejected"] += 1
                    for r in (r for r in v.reasons if r.level == "reject"):
                        stats["rejections_by_code"][r.code] = stats["rejections_by_code"].get(r.code, 0) + 1
                        stats["rejections"].append({"source": src["id"], "title": rec.get("title"), "code": r.code, "detail": r.detail})
                    continue
                stats["verified" if v.state == "verified" else "needs_review"] += 1
                row = build_row(v.record, src, v.state)
                rows[row["dedupe_key"]] = row
    rows, stats["unmatched_overrides"] = apply_overrides(rows, load_overrides())
    if args.publish:
        store = SupabaseStore(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        store.upsert("sources", [{"slug": s["id"], **{k: s[k] for k in ("url", "owner", "stage", "scope_type", "scope_value", "lat", "lon")}}
                                 for s in sources], "slug")  # opportunities reference sources by id
        stats["publish"] = publish_rows(store, list(rows.values()))
        run_id = store.insert("pipeline_runs", run_row(stats, datetime.now(timezone.utc).isoformat()))["id"]
        sid = store._source_ids()
        for rej in stats["rejections"]:
            store.insert("rejections", {"run_id": run_id, "source_id": sid.get(rej["source"]), "title": rej["title"],
                                        "reason_code": rej["code"], "detail": rej["detail"]})
    path = write_report(stats)
    print(f"{stats['mode']}: {stats['sources_ok']}/{stats['sources_attempted']} pages fetched, "
          f"{stats['extracted']} extracted, {stats['verified']} verified, {stats['needs_review']} needs_review, "
          f"{stats['rejected']} rejected. Report: {path}")
    return stats


if __name__ == "__main__":
    run()
