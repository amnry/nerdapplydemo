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
