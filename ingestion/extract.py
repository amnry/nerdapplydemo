"""Stage 2: turn page text into candidate records via the LLM, cached per page hash.
The prompt is a deliberate STUB until the presenter writes it; with no prompt this stage raises and never calls the API."""
import json

from . import llm
from .models import DATA, RECORD_SCHEMA

# STUB: both prompts are None on purpose. Write them here (system prompt and user template with a
# {page_text} placeholder), then the stage works. Nothing else in the pipeline needs to change.
SYSTEM_PROMPT = None
USER_TEMPLATE = None


class ExtractionNotConfigured(Exception):
    """Raised when the prompt stub has not been filled in."""


def _cache_file(source_id: str, sha: str):
    return DATA / "extracted" / source_id / f"{sha}.json"


def extract(source: dict, page_text: str, sha: str) -> tuple:
    """Return (records, usage). A cached result for the same page hash costs zero tokens."""
    cache = _cache_file(source["id"], sha)
    if cache.exists():
        return json.loads(cache.read_text())["records"], {"tokens_in": 0, "tokens_out": 0}
    if SYSTEM_PROMPT is None or USER_TEMPLATE is None:
        raise ExtractionNotConfigured("extraction prompt is a stub (ingestion/extract.py)")
    out, usage = llm.call_json(SYSTEM_PROMPT, USER_TEMPLATE.format(page_text=page_text), RECORD_SCHEMA)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(out, indent=2))
    return out["records"], usage
