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

## District matching and the publish guard (Nov 15)

- **Bug:** the pipeline stores district scope as a slug (`three-village-csd`) but `match.ts` compared it with the school's display name, so a district row could never match. No real rows were affected yet: all 39 published rows are `institution` scope.
- **Fix:** `schools.district_slug` (migration 003, applied; seeded for the two middle schools, null for colleges). `match.ts` matches district scope **and** `requires.districts` on `district_slug`; the display name is only used in messages. Tests on both sides, including one that a display name must not match.
- **Pipeline side:** `check_scopes` runs at the start of every run and stops it if a district `scope_value` is not a `district_slug`, or a school/institution `scope_value` is not a school slug. `normalize_districts` rewrites `requires.districts` names from a page to district slugs; a name that matches no known district keeps its own slug form, so that row is hidden for our schools (a missed opportunity, never a wrong one). Known limit: a page that abbreviates a district in a way we have no alias for (for example just "Three Village") will not map; add an alias when it shows up in the QA report.
- **Guard:** `--publish` now exits with an error unless `--school <slug>` or `--all` is given (a lone `--source` is refused too). Dry runs are unaffected.
- **`sources.yaml`** with the Hofstra and Garden City entries is committed. The 17 Hofstra rows published by mistake stay, by the presenter's decision.

## Gate 3 dry runs and Stony Brook overrides (Nov 15)

- **Stony Brook re-published** with 8 overrides: three EOP rows get `requires.admit_program=EOP`; the two verified URECA rows get `requires.enrollment=current`; Creative Writing Supplemental rejected; Honors summary rewritten. Result: 1 inserted, 22 updated, 0 unchanged. The `edit` override marks a row `extraction_method=manual`.
- **Override reject now writes `verification_state=rejected`** (it used to drop the row from the batch, which would have left an already-published row verified in the database). Guides read verified rows only, so a rejected row is hidden and still auditable.
- **`requires` cleanup:** empty and null keys are dropped (`districts: []` meant "no restriction" to the model but "unextractable list" to `match.ts`, which would have sent every middle-school row to Confirm first). This is why all 22 Stony Brook rows updated.
- **Domain default fix:** for `*.k12.ny.us` hosts the allowed domain collapsed to `ny.us`; it is now the district domain (`gardencity.k12.ny.us`). Test added.
- **Page cap default is 40.** Shared sources (the two DNA Learning Center pages) list both middle schools in `school: [...]`.
- **Gate 3 sources added (dry runs only, nothing published):** Garden City: library Tweens N Teens page, 6 district/GCMS pages found by following links, 3 Adelphi and 3 Hofstra youth pages. Gelinas: Emma Clark teen site, 3 Stony Brook pre-college pages, the SCCC K-12 page, the Brookhaven education page. Skipped from the link crawl: registration and pre-K pages, and Drive/Canva/PDF files (the GCHS course catalog is a Drive file).
- **Dry-run LLM spend:** Garden City $0.3550 (63,230 in / 22,848 out), Gelinas $0.1514 (24,322 in / 10,284 out). Total live LLM spend to date: $1.0819.

## Gate 3 rules, overrides and first middle-school publish (Nov 15)

- **Club rule:** a record with `category=club` needs only a `title` quote. Verify forces `action_type=ask_school` and `status=ongoing` for it and skips the action and status quote checks. Other categories still go to review without an action quote.
- **Grades check is range-aware:** a quote covers every grade in a range ('2-10', '6 to 8', 'K-8', K = grade 0) and each grade in a list ('9 or 10', '7th & 8th'); every claimed grade must be covered. Previously only the lowest and highest grade were checked against digits.
- **Grade basis** may be supported by any quote on the record, not only the grades quote.
- **`date_text` must contain a month name.** Meeting times ('Tuesdays 2:15-3:15') and phrases ('posted deadlines') are nulled with a Q3 note. A year-less season such as 'Fall 2026' is nulled too.
- **8 overrides reject:** five DNA Learning Center On-Demand duplicates, the Miss Porter's residential program, and the two Brookhaven undergraduate internships (SULI, CCI).
- **Emma Clark sub-pages added** as `district:three-village-csd` sources (Programs, Volunteer, Summer Reading, More Opportunities, Free Classes and College Prep), URLs taken from the site's own menu. The presenter will hand-enter Three Village district rows (`manual_records.yaml`), because the district sites disallow this crawler.
- **Scoped runs do not check for unmatched overrides** (an override for another school cannot match); the report says so.
- **Published (each school twice, `--publish --school`):** Garden City run 1 inserted 90, run 2 wrote 0 (90 unchanged). Gelinas run 1 inserted 32 and found 21 unchanged (the shared DNA Learning Center rows already written by Garden City), run 2 wrote 0 (53 unchanged). Database total: 162 rows.
- **Known weakness:** 'Summer Reading Challenge 2026' (Emma Clark) is verified with status unknown: the title names a 2026 cycle but no dated quote lets the stale-cycle gate close it.
- **Live LLM spend to date:** $1.2075 (this round: Gelinas replay $0.1256; everything else came from cache).

## Source status, run school, overrides and re-publish (Nov 15)

- **Migration 004 applied:** `sources.last_result` and `sources.last_note` (a robots block has no HTTP status, so the result and note carry it) and `pipeline_runs.school_slug`. `cost_usd` was already on `pipeline_runs`; it is recorded on every run (0 when the run came from cache).
- **Sources table now records every check:** result (`ok`, `error`, `skipped`, `blocked_by_robots`), HTTP status, note and check time on each publish; the page hash and fetch time are written only when a page was actually read, so a failed fetch never erases the last good hash. Rows with different key sets are sent in separate batches, because PostgREST would fill a missing key with null on an upsert.
- **Backfill:** `python -m ingestion.run --refresh-sources --all --max-pages 100` fetches every source and records status without extraction or LLM calls. Run outcomes had never been stored, so this is a fresh check, not a replay: 46 sources, 42 ok, 3 blocked_by_robots, 1 error (`hof-orientation`, 404). No page text had changed since the last snapshots, so every cached extraction is still valid. `--refresh-sources` needs `--school` or `--all`, like `--publish`.
- **`pipeline_runs.school_slug`:** recorded as `all`, or the comma-joined `--school` values. Runs 1-7 were backfilled from their source counts (22 = all, 8 = Stony Brook, 18 = Garden City, 16 = Gelinas), each of which maps to exactly one scope.
- **Overrides added:** reject Summer Reading Challenge 2026, Time with a Tech and Hofstra's Extended Hours Program; set `enrollment=current` on Hofstra's Research Assistants and Conference Funding (the Research Assistants page wording about Honors College students is kept in `requires.note`, since replacing the field would have dropped it).
- **World of Enzymes:** the cached page splits eligibility across two lines: "entering grade 8 or" / "Fun With DNA alumni entering grade 7". The cut-off quote was a line-break artifact, not a wrong grade. Grades stay `[8]`; the quote is now the full verbatim text and `requires.note` records the alumni path to grade 7. Green Genes ("entering grade 9 or" / World of Enzymes alumni entering grade 8) and Forensic Crime Lab ("entering grade 10 or" / Forensic Detectives alumni entering grade 9) have the same pattern and are not changed yet.
- **Re-published** Hofstra (17 updated: the `requires` cleanup plus 3 overrides), Garden City (2 updated, 88 unchanged) and Gelinas (2 updated, 51 unchanged). Database total stays 162 rows.

## Quote fixes and true spend (Nov 15)

- **Green Genes and Forensic Crime Lab** fixed the same way as World of Enzymes: the cached page splits "entering grade 9 or" / "World of Enzymes alumni entering grade 8" (and "entering grade 10 or" / "Forensic Detectives alumni entering grade 9") across lines. Grades stay `[9]` and `[10]`; the evidence quote is now the full verbatim text, checked against the cached page, and `requires.note` records the alumni path. Re-published: Garden City 2 updated, Gelinas 0 (shared rows already current).
- **Migration 005:** `pipeline_runs.mode` (`publish` or `dry_run`, default `publish`). Existing runs are all real publishes.
- **Dry-run spend backfilled** as 5 `dry_run` rows (exact token counts from the run outputs, cost recomputed from tokens at $2 / $10 per million): Stony Brook $0.2040 and $0.2593, Garden City $0.3549, Gelinas $0.1515 and $0.1256. `started_at` and `finished_at` are the first and last LLM call (extraction cache file times), not the run's own start and end. The second Stony Brook dry run had no filter, so it is recorded as `all`. Rounded figures in earlier entries differ from these by under a cent.
- **True total spend: $1.2076** (publishes $0.1122, dry runs $1.0954), 211,151 tokens in and 78,527 out, over 15 recorded runs. `/qa` sums `cost_usd` over every run, so it now shows this figure.
- **Known gap:** a dry run that calls the LLM writes no run row (dry runs write only the report), so such spend is invisible until it is backfilled the same way.
