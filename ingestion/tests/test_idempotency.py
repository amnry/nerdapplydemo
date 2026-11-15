"""Offline tests for dedupe keys, overrides and the rule that publishing twice changes zero rows.
Exists because 'a second run is a no-op' is what makes re-running the pipeline safe."""
from copy import deepcopy

from ingestion.publish import apply_overrides, build_row, cycle_label, dedupe_key, publish_rows
from .test_verify import GOOD, SRC

SOURCE = {**SRC, "owner": "Example University", "stage": "admitted_college", "scope_type": "institution",
          "scope_value": "example-university", "lat": None, "lon": None}


class FakeStore:
    def __init__(self):
        self.rows, self.writes = {}, 0

    def existing(self):
        return deepcopy(self.rows)

    def write(self, rows):
        self.writes += len(rows)
        for r in rows:
            self.rows[r["dedupe_key"]] = r


def row(**patch):
    return build_row({**GOOD, **patch}, SOURCE, "verified")


def test_publish_twice_changes_zero_rows():
    store, rows = FakeStore(), [row(), row(title="Another Program")]
    assert publish_rows(store, rows) == {"inserted": 2, "updated": 0, "unchanged": 0}
    assert publish_rows(store, rows) == {"inserted": 0, "updated": 0, "unchanged": 2} and store.writes == 2


def test_changed_content_updates_exactly_that_row():
    store = FakeStore()
    publish_rows(store, [row(), row(title="Another Program")])
    assert publish_rows(store, [row(summary="New text."), row(title="Another Program")])["updated"] == 1


def test_same_owner_title_cycle_dedupes_to_one_key():
    assert row()["dedupe_key"] == row(summary="different words")["dedupe_key"]
    assert row()["dedupe_key"] == "example-university|summer-research-institute|ay-2026-27"


def test_cycle_label_never_invents_a_year():
    assert cycle_label({"starts_on": None, "deadline": None, "opens_on": None}) == "none"
    assert cycle_label({"starts_on": "2027-07-05"}) == "summer-2027" and cycle_label({"deadline": "2026-10-01"}) == "fall-2026"


def test_overrides_approve_edit_reject_and_report_unmatched():
    a, b, c = row(), row(title="Second"), row(title="Third")
    rows = {r["dedupe_key"]: r for r in (a, b, c)}
    a["verification_state"] = "needs_review"
    ovs = [{"key": a["dedupe_key"], "action": "approve", "reviewer": "r", "date": "2026-11-15"},
           {"key": b["dedupe_key"], "action": "edit", "reviewer": "r", "date": "2026-11-15", "fields": {"cost_usd": 0}},
           {"key": c["dedupe_key"], "action": "reject", "reviewer": "r", "date": "2026-11-15"},
           {"key": "nope|nope|none", "action": "approve", "reviewer": "r", "date": "2026-11-15"}]
    out, unmatched = apply_overrides(rows, ovs)
    assert a["verification_state"] == "verified" and "approve by r" in a["review_note"]
    assert b["cost_usd"] == 0 and b["extraction_method"] == "manual"
    assert c["dedupe_key"] not in out and unmatched == ["nope|nope|none"]


def test_database_returning_150_for_150_point_0_is_not_a_change():
    store = FakeStore()
    r = row(cost_usd=150.0)
    publish_rows(store, [r])
    store.rows[r["dedupe_key"]]["cost_usd"] = 150  # what PostgREST hands back for numeric
    assert publish_rows(store, [r]) == {"inserted": 0, "updated": 0, "unchanged": 1}
