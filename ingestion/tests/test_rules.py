"""Offline tests for source-level rules: pre_admission handling and the source_url fallback for action_url.
Exists because these rules decide what an admitted student is told to do, and must not drift silently."""
import pytest
import yaml

from ingestion.extract import apply_pre_admission, normalize_districts
from ingestion.models import ROOT
from ingestion.publish import build_row, check_scopes, load_schools
from ingestion.run import run, schools_of
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


SCHOOLS = load_schools()


def test_every_real_source_scope_matches_a_school_slug_or_district_slug():
    sources = yaml.safe_load((ROOT / "ingestion" / "sources.yaml").read_text())["sources"]
    assert check_scopes(sources, SCHOOLS) == []


def test_check_scopes_flags_a_district_name_used_as_scope_value():
    bad = [{"id": "x", "scope_type": "district", "scope_value": "Three Village Central School District"},
           {"id": "y", "scope_type": "institution", "scope_value": "no-such-school"}]
    assert len(check_scopes(bad, SCHOOLS)) == 2


def test_district_names_on_a_page_are_rewritten_to_district_slugs():
    recs = [{"requires": {"districts": ["Three Village CSD", "Three Village Central School District", "Longwood Central"]}}]
    assert normalize_districts(recs, SCHOOLS)[0]["requires"]["districts"] == ["three-village-csd", "longwood-central"]


def test_every_school_has_a_district_slug_only_if_it_has_a_district():
    assert all(bool(s["district"]) == bool(s["district_slug"]) for s in SCHOOLS)


def test_bare_publish_is_refused_before_anything_runs():
    with pytest.raises(SystemExit) as exc:
        run(["--publish"])
    assert exc.value.code == 2
    with pytest.raises(SystemExit):
        run(["--publish", "--source", "sbu-eop"])  # a single source still needs --school or --all


def test_empty_and_null_requires_keys_are_dropped_so_matching_does_not_see_a_restriction():
    recs = [{"requires": {"districts": [], "enrollment": None, "admit_program": "", "note": "x"}}]
    assert normalize_districts(recs, SCHOOLS)[0]["requires"] == {"note": "x"}


def test_shared_source_lists_several_schools():
    assert schools_of({"school": "a"}) == ["a"] and schools_of({"school": ["a", "b"]}) == ["a", "b"]


def test_k12_ny_us_district_domains_are_not_collapsed_to_ny_us():
    from ingestion.fetch import allowed_hosts, host_ok
    hosts = allowed_hosts({"url": "https://www.gardencity.k12.ny.us/scope"})
    assert hosts == ["gardencity.k12.ny.us"] and not host_ok("https://other.k12.ny.us/", hosts)
    assert allowed_hosts({"url": "https://www.stonybrook.edu/x"}) == ["stonybrook.edu"]
