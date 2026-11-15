"""Offline tests for source-level rules: pre_admission handling and the source_url fallback for action_url.
Exists because these rules decide what an admitted student is told to do, and must not drift silently."""
from ingestion.extract import apply_pre_admission
from ingestion.publish import build_row
from .test_idempotency import SOURCE
from .test_verify import GOOD

RECS = [{**GOOD, "title": "First-Year Application", "is_admission_application": True},
        {**GOOD, "title": "Honors Programs", "is_admission_application": False, "requires": {}}]


def test_pre_admission_drops_admission_application_and_forces_ask_school():
    kept, dropped = apply_pre_admission(RECS, {"pre_admission": True})
    assert dropped == ["First-Year Application"] and [r["title"] for r in kept] == ["Honors Programs"]
    assert kept[0]["action_type"] == "ask_school" and "ask the office" in kept[0]["requires"]["note"]


def test_other_sources_are_untouched():
    kept, dropped = apply_pre_admission(RECS, {})
    assert kept == RECS and dropped == []


def test_action_url_falls_back_to_source_url():
    assert build_row({**GOOD, "action_url": None}, SOURCE, "verified")["action_url"] == SOURCE["url"]
    assert build_row(GOOD, SOURCE, "verified")["action_url"] == GOOD["action_url"]


def test_manual_rows_are_marked_manual_with_their_note():
    row = build_row(GOOD, SOURCE, "verified", method="manual", note="manual entry by r on 2026-11-15")
    assert row["extraction_method"] == "manual" and row["review_note"].startswith("manual entry")
