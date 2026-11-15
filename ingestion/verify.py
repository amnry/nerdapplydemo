"""Stage 3: deterministic gates Q1-Q7 that decide whether a proposed record is true enough to publish.
Exists because the LLM only proposes; code checks every quote and value against the fetched page text."""
import html
import re
import unicodedata
from datetime import date

from .fetch import allowed_hosts, host_ok
from .models import DATE_FIELDS, Reason, Verdict

_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
           "october", "november", "december"]
_MONTH_NAME = re.compile(r"\b(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|Jun(e)?|Jul(y)?|Aug(ust)?|Sep(t(ember)?)?|Oct(ober)?|Nov(ember)?|Dec(ember)?)\b")
_GRADE_WORD = {6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth", 11: "eleventh", 12: "twelfth"}


def norm(s: str) -> str:
    """Q1 normalisation: NFKC, entities decoded, curly quotes and dashes flattened, whitespace collapsed. Case-sensitive."""
    s = html.unescape(unicodedata.normalize("NFKC", s))
    s = s.translate({0x2018: "'", 0x2019: "'", 0x201C: '"', 0x201D: '"', 0x2013: "-", 0x2014: "-"})
    return re.sub(r"\s+", " ", s).strip()


def _date_in_quote(value: str, quote: str) -> bool:
    try:
        y, m, d = (int(x) for x in value.split("-"))
        month = _MONTHS[m - 1]
    except (ValueError, IndexError):
        return False
    q = quote.lower()
    month_ok = re.search(rf"\b({month}|{month[:3]}\.?)\b|\b0?{m}/0?{d}\b", q)
    day_ok = re.search(rf"\b0?{d}(st|nd|rd|th)?\b", q)
    years = re.findall(r"\b(20\d{2})\b", q)
    return bool(month_ok and day_ok and (not years or str(y) in years))


def _cost_in_quote(value: float, quote: str) -> bool:
    q = quote.lower().replace(",", "")
    if value == 0:
        return bool(re.search(r"\bfree\b|no cost|no charge|\$\s*0\b", q))
    return any(abs(float(n) - value) < 0.005 for n in re.findall(r"\d+(?:\.\d+)?", q))


def _grades_in_quote(grades: list, quote: str) -> bool:
    q = quote.lower()
    return all(re.search(rf"\b{g}(st|nd|rd|th)?\b", q) or _GRADE_WORD.get(g, "~") in q for g in (min(grades), max(grades)))


def verify(rec: dict, text: str, source: dict, today: date = None, url_ok=None) -> Verdict:
    """Run all gates. url_ok(url)->bool is injected so tests stay offline (None skips Q7)."""
    today, rec, reasons = today or date.today(), dict(rec), []
    add = lambda code, detail, level: reasons.append(Reason(code, detail, level))
    ev = rec.get("evidence") or []
    quotes: dict = {}
    for item in ev:
        quotes.setdefault(item.get("field", ""), []).append(norm(item.get("quote", "")))

    for f in ("title", "summary", "category", "action_type"):  # Q6
        if not rec.get(f):
            add("Q6", f"missing_{f}", "reject")
    if not ev:
        add("Q6", "missing_evidence", "reject")
    elif not any(quotes.get("title", [])):  # every record needs a quote that names the item
        add("Q6", "missing_title_quote", "reject")
    hosts = allowed_hosts(source)  # Q2
    for name, url in (("page", source.get("final_url") or source["url"]), ("action_url", rec.get("action_url"))):
        if url and not host_ok(url, hosts):
            add("Q2", f"{name}_off_domain:{url}", "reject")
    page = None if text is None else norm(text)  # Q1: every quote must be on the page
    date_text = norm(rec.get("date_text") or "")
    if page is None:  # hand-entered record for a page we could not fetch: quotes are for the manual audit
        add("Q1", "quote_unchecked:no_page_text", "note")
    else:
        for f, qs in quotes.items():
            for q in qs:
                if not q or q not in page:
                    add("Q1", f"quote_not_found:{f}", "reject")
        if date_text and date_text not in page:
            add("Q1", "date_text_not_found", "reject")
    if any(r.level == "reject" for r in reasons):
        return Verdict("rejected", reasons, rec)

    if date_text and not (_MONTH_NAME.search(date_text) or re.search(r"\d", date_text)):  # "posted deadlines" is not a date
        add("Q3", "date_text_not_a_date:nulled", "note")
        rec["date_text"], date_text = None, ""

    def field_quote(f):
        return " ".join(quotes.get(f, []))

    for f in (*DATE_FIELDS, "grades_allowed", "cost_usd", "status", "cycle_label"):  # Q1: values must match their quotes
        if rec.get(f) in (None, []) or (f == "status" and rec[f] == "unknown"):
            continue
        q = field_quote(f)
        if not q:
            add("Q1", f"no_quote_for_{f}:nulled", "note")
            rec[f] = "unknown" if f == "status" else None
        elif f in DATE_FIELDS and not _date_in_quote(rec[f], q):
            add("Q1", f"value_not_in_quote:{f}", "reject")
        elif f == "cost_usd" and not _cost_in_quote(rec[f], q):
            add("Q1", f"value_not_in_quote:{f}", "reject")
        elif f == "cycle_label" and rec[f].lower() not in q.lower():
            add("Q1", f"value_not_in_quote:{f}", "reject")
        elif f == "grades_allowed" and not _grades_in_quote(rec[f], q):
            add("Q1", f"value_not_in_quote:{f}", "reject")
    if any(r.level == "reject" for r in reasons):
        return Verdict("rejected", reasons, rec)
    if not field_quote("action_type"):
        add("Q1", "no_quote_for_action_type", "review")

    year_unknown = False  # Q3: never assume a year
    for f in DATE_FIELDS:
        if rec.get(f) and not re.search(r"\b20\d{2}\b", field_quote(f)):
            rec[f], year_unknown = None, True
            add("Q3", f"year_missing:{f}", "note")
    year_unknown = year_unknown or any(rec.get(f) is None and quotes.get(f) and not re.search(r"\b20\d{2}\b", field_quote(f))
                                       for f in DATE_FIELDS)  # the model already nulled a yearless date (prompt rule 2)
    year_unknown = year_unknown or (bool(date_text) and not any(rec.get(f) for f in DATE_FIELDS))
    claimed = rec.get("date_confidence")
    rec["date_confidence"] = "exact" if any(rec.get(f) for f in DATE_FIELDS) else (
        "year_unknown" if year_unknown else "not_published")
    if claimed == "year_unknown" and rec["date_confidence"] != "year_unknown":
        add("Q3", "model_claimed_year_unknown_without_date_text_or_quote", "note")

    words = field_quote("status").lower()  # Q4: stale or cancelled cycles can never be "do now"
    if re.search(r"\bcancel+ed\b", words):
        rec["status"] = "cancelled"
        add("Q4", "status_words:cancelled", "note")
    elif re.search(r"\b(closed|full)\b", words):
        rec["status"] = "closed"
        add("Q4", "status_words:closed_or_full", "note")
    past = lambda f: rec.get(f) and date.fromisoformat(rec[f]) < today
    if rec.get("status", "unknown") in ("open", "upcoming", "unknown") and (past("deadline") or (not rec.get("deadline") and past("starts_on"))):
        rec["status"] = "closed"
        add("Q4", "date_in_past", "note")

    basis, gq = rec.get("grade_basis", "unknown"), field_quote("grades_allowed").lower()  # Q5
    if rec.get("grades_allowed") and (
            basis in ("unknown", "age")
            or (basis == "entering" and not re.search(r"entering|rising|incoming|fall\s+20\d\d", gq))
            or (basis == "current" and not re.search(r"current|completed|enrolled|in grades?|grades? \d", gq))):
        add("Q5", f"grade_basis_unknown:{basis}", "review")

    if url_ok and rec.get("action_url") and not url_ok(rec["action_url"]):  # Q7
        add("Q7", f"link_dead:{rec['action_url']}", "review")

    if re.search(r"\d", rec.get("summary") or ""):  # Q8: summaries carry no unchecked dates or costs
        add("Q8", "summary_has_digits", "review")

    return Verdict("needs_review" if any(r.level == "review" for r in reasons) else "verified", reasons, rec)
