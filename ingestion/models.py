"""Shared constants, the record schema and small result types for every pipeline stage.
Exists so fetch, extract, verify and publish agree on field names and allowed values."""
import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / "data"

CATEGORIES = ["milestone", "program", "scholarship", "research", "competition", "club", "campus_task"]
GRADE_BASES = ["current", "entering", "age", "unknown"]
STATUSES = ["open", "upcoming", "ongoing", "auto_considered", "closed", "cancelled", "unknown"]
ACTION_TYPES = ["apply", "register", "attend", "check_award", "ask_school", "mark_calendar"]
TAGS = ["stem", "research", "arts", "writing", "service", "athletics", "business", "health"]
DATE_FIELDS = ("opens_on", "deadline", "starts_on")

_STR = {"type": ["string", "null"]}
RECORD_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["records"],
    "properties": {"records": {"type": "array", "items": {
        "type": "object",
        "additionalProperties": False,
        "required": ["title", "summary", "category", "grade_basis", "grades_allowed", "opens_on", "deadline",
                     "starts_on", "cycle_label", "status", "action_type", "action_url", "cost_usd", "tags", "requires", "evidence"],
        "properties": {
            "title": {"type": "string"}, "summary": {"type": "string"},
            "category": {"type": "string", "enum": CATEGORIES},
            "grade_basis": {"type": "string", "enum": GRADE_BASES},
            "grades_allowed": {"type": ["array", "null"], "items": {"type": "integer"}},
            "opens_on": _STR, "deadline": _STR, "starts_on": _STR, "cycle_label": _STR,
            "status": {"type": "string", "enum": STATUSES},
            "action_type": {"type": "string", "enum": ACTION_TYPES},
            "action_url": _STR, "cost_usd": {"type": ["number", "null"]},
            "tags": {"type": "array", "items": {"type": "string", "enum": TAGS}},
            "requires": {"type": "object", "additionalProperties": False, "properties": {
                "districts": {"type": "array", "items": {"type": "string"}},
                "admit_program": _STR, "enrollment": _STR}},
            "evidence": {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["field", "quote"],
                "properties": {"field": {"type": "string"}, "quote": {"type": "string"}}}},
        }}}},
}


@dataclass
class Reason:
    code: str      # Q1..Q7
    detail: str
    level: str     # "reject", "review" or "note" (changed a field, still logged)


@dataclass
class Verdict:
    state: str     # verified, needs_review, rejected
    reasons: list = field(default_factory=list)
    record: dict = field(default_factory=dict)


def load_env(path: Path = ROOT / ".env.local") -> dict:
    """Read KEY=VALUE lines from .env.local into os.environ (real env wins); return the merged view."""
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.split(" #")[0].strip())
    return dict(os.environ)
