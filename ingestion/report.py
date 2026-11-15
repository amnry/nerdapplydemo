"""Stage 6: write docs/QA_REPORT.md from the run's real counters (and a pipeline_runs row when publishing).
Exists so every number a viewer sees was computed from this run, never typed in."""
from . import llm
from .models import ROOT


def _pct(n, d):
    return "n/a" if not d else f"{n}/{d}"


def write_report(stats: dict, path=ROOT / "docs" / "QA_REPORT.md") -> str:
    cost = llm.cost_usd(stats["tokens_in"], stats["tokens_out"])
    per_rec = None if cost is None or not stats["verified"] else cost / stats["verified"]
    fmt = lambda v: "not computed (prices unset)" if v is None else f"${v:.4f}"
    per_rec_txt = "n/a (no verified records)" if not stats["verified"] else fmt(per_rec)
    L = ["# QA Report", "",
         f"Generated: {stats['started_at']}  |  Mode: {stats['mode']}", ""]
    if stats.get("extract_stub"):
        L += ["> **Extraction prompt is a stub.** No page was sent to the LLM, so zero records exist. "
              "Fetch results below are real; verify and publish ran only against labelled TEST ONLY fixtures.", ""]
    L += ["## Run numbers", "", "| Metric | Value |", "|---|---|",
          f"| Sources attempted | {stats['sources_attempted']} |",
          f"| Sources fetched OK | {_pct(stats['sources_ok'], stats['sources_attempted'])} |",
          f"| Records extracted | {stats['extracted']} |", f"| Verified | {stats['verified']} |",
          f"| Needs review | {stats['needs_review']} |", f"| Rejected | {stats['rejected']} |",
          f"| Rows written to database | {stats.get('publish', 'none (dry run)')} |",
          f"| Dropped (pre_admission: about applying for admission) | {len(stats.get('dropped_pre_admission', []))} |",
          f"| Manual records (quotes not machine-checked if page blocked) | {stats.get('manual', 0)} |",
          f"| Tokens in / out | {stats['tokens_in']} / {stats['tokens_out']} |",
          f"| LLM cost | {fmt(cost)} |", f"| Cost per verified record | {per_rec_txt} |", "",
          "## Per source", "", "| Source | School | Result | Tokens (est.) | Note |", "|---|---|---|---|---|"]
    L += [f"| {s['id']} | {s['school']} | {s['result']} | {s['tokens_est']} | {s['note']} |" for s in stats["per_source"]]
    L += ["", "## Rejections by reason code", ""]
    L += [f"- {c}: {n}" for c, n in sorted(stats["rejections_by_code"].items())] or ["- none"]
    L += ["", "## Blocked by robots.txt (cannot be fetched; use manual_records.yaml)", ""]
    L += [f"- {s['id']} ({s['school']}): {s['note']}" for s in stats["per_source"] if s["result"] == "blocked_by_robots"] or ["- none"]
    L += ["", "## Skipped pages (HTML only tonight)", ""]
    L += [f"- {s['id']}: {s['note']}" for s in stats["per_source"] if s["result"] == "skipped"] or ["- none"]
    L += ["", "## Dropped by pre_admission rule", ""]
    L += [f"- {d['source']}: {d['title']}" for d in stats.get("dropped_pre_admission", [])] or ["- none"]
    L += ["", "## Rows by scope and state (after overrides)", ""]
    L += [f"- {k}: {n}" for k, n in stats.get("row_counts", {}).items()] or ["- none"]
    L += ["", "## Rejected by override (human decision)", ""]
    L += [f"- {k}" for k in stats.get("rejected_by_override", [])] or ["- none"]
    L += ["", "## Overrides with no matching record", ""]
    L += ["- not checked: this run was scoped (--school or --source); run with --all to check"] if stats.get("scoped") else \
         [f"- {k}" for k in stats.get("unmatched_overrides", [])] or ["- none"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(L) + "\n")
    return str(path)


def run_row(stats: dict, finished_at: str) -> dict:
    """pipeline_runs insert payload (publish mode only)."""
    cost = llm.cost_usd(stats["tokens_in"], stats["tokens_out"])
    keys = ("sources_attempted", "sources_ok", "extracted", "verified", "needs_review", "rejected", "tokens_in", "tokens_out")
    return {**{k: stats[k] for k in keys}, "started_at": stats["started_at"], "finished_at": finished_at, "cost_usd": cost}
