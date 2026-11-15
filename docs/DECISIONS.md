# DECISIONS

Running log of choices the plan left open. Each entry: decision, then reason.

## Gate 1

- **Repo.** Own git repo in `nerdapply`, `origin` = `amnry/nerdapplydemo`. The home directory is also a git repo (pointed at `hormuz-lens`); this one is separate so nothing personal can be committed.
- **LLM provider.** Anthropic. Model name comes from `LLM_MODEL`.
- **LLM cost.** Prices come from `LLM_PRICE_IN_PER_MTOK` and `LLM_PRICE_OUT_PER_MTOK` (not in plan section 14). If unset, the QA report says "cost not computed" instead of guessing.
- **Versions.** Next 15.5.29, React 19.1.10, TypeScript 5.9.3, npm. Node on the laptop is v23 (not LTS); builds fine. Pipeline uses Python 3.11.
- **Migration applied** to Supabase project `nerdapplydemo` with `supabase db query --linked`. Added columns beyond plan section 7: `sources.last_checked_at` (moves every run; `last_fetched_at` and `last_verified_at` move only on real change, so "publish twice changes zero rows" is testable). Added two indexes on `opportunities`. `sources.slug` and `schools.slug` are unique.
- **Enum name.** Postgres enum for opportunity status is `opp_status` (plain `status` is too generic a type name). Column is still `status`.
- **npm audit.** 1 high, 1 moderate, both from `postcss` bundled inside `next`. `npm audit fix --force` would change the Next version; not done. Does not affect a read-only demo with no user input beyond a school name.
- **Vercel CLI.** Run through `npx vercel`, not installed globally.

## Gate 2

- **Extraction prompt is a stub** (presenter's instruction). `extract.py` has `SYSTEM_PROMPT = None` and `USER_TEMPLATE = None` and raises `ExtractionNotConfigured`; it never calls the API. `llm.py` is written but has never made a live call.
- **Gate 2 is NOT met.** Its gate says `--dry-run` prints verified records with quotes; with the stub there are zero records. Verify, dedupe, overrides, publish and report are proven only by offline tests on TEST ONLY fixtures and by a real fetch of 8 pages.
- **Page hash is over the visible text, not the raw HTML**, so rotating tokens or timestamps in markup do not defeat the skip. The raw HTML is still saved under that hash.
- **Duplicate pages:** two sources can resolve to one page (`sbu-admitted-freshmen` and `sbu-first-year-admitted` have the same hash). The run extracts the page once and notes the duplicate.
- **Page cap** is per run (`--max-pages`, default 15). The Stony Brook dry run was executed twice (8 pages each), 16 fetches in total; no LLM calls.
- **Schools are not seeded.** `schools.yaml` holds unverified values (cities for the colleges and Garden City are from general knowledge). Nothing writes it to the database until each value is checked against an official site.
- **Known gap, injection:** Q1 proves a quote is on the page, not that it is data rather than an instruction. A model that quotes the injected sentence itself (`xfail` test in `test_verify.py`) would pass every gate. Defence belongs in the extraction prompt, and in the manual audit.
- **Q1 value check** compares each extracted date, cost and grade bound with its own quote (month and day must appear; a year in the quote must match). A field with no quote is nulled with a logged note (status becomes `unknown`); `action_type` with no quote goes to `needs_review`.
- **Not built yet:** marking records `closed` when they vanish from a page that still fetches; seeding the `schools` table (`--publish` upserts `sources` only); cost per school in the report.
- **Never run:** `--publish`, so `SupabaseStore.write` and the `pipeline_runs`/`rejections` inserts are untested. Only the read path was exercised.

## Proposed for later gates (accepted unless changed)

- Gates Q1, Q2, Q6 reject. Q5 and Q7 send to `needs_review`. Q3 and Q4 change fields and still log their reason code.
- Guides show only `verified` rows.
- Q1 also checks that digits of each extracted date, grade and cost appear in that field's quote.
- Q1 normalisation: Unicode NFKC, curly quotes to straight, HTML entities decoded, whitespace collapsed, case-sensitive.
- LLM output cached per page hash at `ingestion/data/extracted/<source_id>/<sha256>.json`; unchanged pages re-verify from cache. Raw and cached data live under `ingestion/data/` (gitignored), not `data/raw/` as plan section 6 says.
- `cycle_label` format: `summer-2027`, `fall-2027`, `ay-2026-27`, or `none`.
- Radius scope: miles stored in `scope_value`, coordinates in `venue_lat`/`venue_lon`.
- `requires` JSON: `{"districts": [...], "admit_program": "...", "enrollment": "current"}`, all optional.
- Entering grade 9 applies to programs starting on or after 2027-06-01 or labelled summer 2027.
- Rows that vanish from a page that still fetches are marked `closed` with a review note, never deleted.

## Gates 4 and 5

- **Date wording.** A date quoted without a year prints "date listed without a year, confirm with the school" and is bucketed Plan ahead. Only a row with no date prints "date not published". This refines plan section 10 case 5, which says "date not published" for the year-less case.
- **Test runner.** vitest added as a dev dependency (plan section 10 names it); `npm test` runs `tests/match.test.ts`. Cases use synthetic rows, not real rows, so gate 4 stays unticked.
- **Empty guide.** The guide page prints an explicit "No verified opportunities yet" section when nothing matches.

## Gate 2 follow-ups (presenter decisions, Nov 14-15)

- **pre_admission sources.** `sbu-apply-first-year` is marked `pre_admission: true`. Records the model flags `is_admission_application` are dropped (listed in the QA report, not counted as rejected); every other record from that source is forced to `action_type=ask_school` with `requires.note`. The flag `is_admission_application` is a schema field and prompt rule 11 added to make the drop decidable; it is not one of the four prompt changes the presenter listed.
- **Prompt changes:** no digits in summaries; one cost per record (split mixed fees); every record needs a `title` quote; yearless dates return their quote, a verbatim `date_text`, and `date_confidence=year_unknown`. Prompt hash is part of the cache key, so each prompt edit re-extracts.
- **Gates added:** Q6 now needs a non-empty `title` quote (`missing_title_quote`); Q1 checks `date_text` is verbatim on the page; **Q8** sends a summary containing any digit to `needs_review`. The model's `date_confidence` claim is not trusted: verify recomputes it, and logs a Q3 note when the claim is unsupported.
- **`action_url` falls back to the source URL** when the page gave none.
- **`blocked_by_robots: true` sources** are never fetched; each run makes one robots.txt request to confirm and lists them in the QA report. If robots.txt later allows the crawler, the run flags the stale flag instead of fetching.
- **`manual_records.yaml`:** hand-entered records (file is empty; nothing was invented). Same gates, but when the page was not fetched the quote-on-page check is skipped and logged `quote_unchecked:no_page_text`, so each such record must be covered by the manual audit. Stored with `extraction_method=manual` and a review note naming who entered it and when.
- **Gelinas name:** P.J. Gelinas Middle School (the district's own name), district Three Village Central School District. Gelinas facts are unfetched (robots) and unverified.
- **Migration `002_date_text.sql` is written but NOT applied.** The pipeline now writes `opportunities.date_text`; apply it before the first `--publish`.
- **Schools stay unseeded** until the presenter supplies coordinates and confirms each row (`verified_at` null).
- **Live LLM spend so far:** $0.2040 (first run) + $0.2593 (second) = $0.4633.

## Gate 2: seeding and first publish (Nov 15)

- **Migration 002 applied** (`opportunities.date_text`). **Four schools seeded** from `schools.yaml` with presenter-supplied coordinates; `verified_at` is 2026-11-15 (presenter confirmed the Gelinas name and address from the school's own site; the other three came from fetched official contact pages). `--seed-schools` refuses any row without lat/lon or `verified_at`.
- **`date_text` rule:** a `date_text` with no month name and no digit (for example "posted deadlines") is nulled with a Q3 note.
- **Override:** `Secure Your Seat at SBU` is rejected as a duplicate of the Tuition Deposit record (`stony-brook-university|secure-your-seat-at-sbu|fall-2026`). It is listed in the QA report under "Rejected by override".
- **Idempotency bug prevented:** the database returns numeric `150` where the pipeline holds `150.0`; rows are now compared with numbers as floats, with a test.
- **Six URECA needs_review records left alone** for the presenter's audit; they are stored with `verification_state=needs_review` and are not shown in guides.
- **Scope mistake, run 1:** `--publish` with no `--school` runs every source in `sources.yaml`. Run 1 therefore also published 17 Hofstra rows (16 verified, 1 needs_review) from sources added by another session, costing $0.1122. They were not requested and were not deleted. Run 2 was scoped with `--school stony-brook-university`.
- **Publish results:** run 1 wrote 39 rows (22 Stony Brook, 17 Hofstra); run 2 (Stony Brook) wrote 0: all 22 rows keep run 1's `last_verified_at`. Total live LLM spend: $0.5755.
