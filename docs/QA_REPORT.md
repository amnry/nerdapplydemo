# QA Report

Generated: 2026-11-15T05:03:19+00:00  |  Mode: dry-run

## Run numbers

| Metric | Value |
|---|---|
| Sources attempted | 11 |
| Sources fetched OK | 10/11 |
| Records extracted | 53 |
| Verified | 50 |
| Needs review | 1 |
| Rejected | 2 |
| Dropped (pre_admission: about applying for admission) | 0 |
| Manual records (quotes not machine-checked if page blocked) | 0 |
| Tokens in / out | 49339 / 27813 |
| LLM cost | $0.3768 |
| Cost per verified record | $0.0075 |

## Per source

| Source | School | Result | Tokens (est.) | Note |
|---|---|---|---|---|
| hof-admitted | hofstra-university | ok | 1804 |  |
| hof-getting-started | hofstra-university | ok | 1978 |  |
| hof-expectations | hofstra-university | ok | 1790 |  |
| hof-orientation | hofstra-university | error | 0 | http_404 |
| hof-scholarships | hofstra-university | ok | 2101 |  |
| hof-research | hofstra-university | ok | 1378 |  |
| gc-district-home | garden-city-middle-school | ok | 1332 |  |
| gc-gcms-contact | garden-city-middle-school | ok | 362 |  |
| gc-gchs-get-involved | garden-city-middle-school | ok | 1789 |  |
| gc-dnalc-camps | garden-city-middle-school | ok | 2079 |  |
| gc-dnalc-fun-with-dna | garden-city-middle-school | ok | 1481 |  |

## Rejections by reason code

- Q2: 2

## Blocked by robots.txt (cannot be fetched; use manual_records.yaml)

- none

## Skipped pages (HTML only tonight)

- none

## Dropped by pre_admission rule

- none

## Rejected by override (human decision)

- none

## Overrides with no matching record

- stony-brook-university|secure-your-seat-at-sbu|fall-2026
