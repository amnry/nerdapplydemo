# QA Report

Generated: 2026-11-15T05:48:53+00:00  |  Mode: dry-run

## Run numbers

| Metric | Value |
|---|---|
| Sources attempted | 11 |
| Sources fetched OK | 8/11 |
| Records extracted | 40 |
| Verified | 25 |
| Needs review | 12 |
| Rejected | 3 |
| Rows written to database | none (dry run) |
| Dropped (pre_admission: about applying for admission) | 0 |
| Manual records (quotes not machine-checked if page blocked) | 0 |
| Tokens in / out | 24322 / 10284 |
| LLM cost | $0.1515 |
| Cost per verified record | $0.0061 |

## Per source

| Source | School | Result | Tokens (est.) | Note |
|---|---|---|---|---|
| tv-course-catalog | gelinas-middle-school | blocked_by_robots | 0 | robots.txt disallows this crawler |
| tv-gelinas-home | gelinas-middle-school | blocked_by_robots | 0 | robots.txt disallows this crawler |
| tv-district-home | gelinas-middle-school | blocked_by_robots | 0 | robots.txt disallows this crawler |
| gc-dnalc-camps | garden-city-middle-school, gelinas-middle-school | ok | 2079 |  |
| gc-dnalc-fun-with-dna | garden-city-middle-school, gelinas-middle-school | ok | 1481 |  |
| emmaclark-teen | gelinas-middle-school | ok | 693 |  |
| sbu-precollege | gelinas-middle-school | ok | 1490 |  |
| sbu-pc-stem | gelinas-middle-school | ok | 1029 |  |
| sbu-istem | gelinas-middle-school | ok | 464 |  |
| sccc-k12 | gelinas-middle-school | ok | 1056 |  |
| bnl-education | gelinas-middle-school | ok | 1206 |  |

## Rejections by reason code

- Q1: 3

## Blocked by robots.txt (cannot be fetched; use manual_records.yaml)

- tv-course-catalog (gelinas-middle-school): robots.txt disallows this crawler
- tv-gelinas-home (gelinas-middle-school): robots.txt disallows this crawler
- tv-district-home (gelinas-middle-school): robots.txt disallows this crawler

## Skipped pages (HTML only tonight)

- none

## Dropped by pre_admission rule

- none

## Rejected by override (human decision)

- none

## Overrides with no matching record

- stony-brook-university|secure-your-seat-at-sbu|fall-2026
- stony-brook-university|accept-your-offer-of-admission-in-the-startsbu-portal|none
- stony-brook-university|complete-the-housing-intent-form|none
- stony-brook-university|eop-aim-pre-freshman-summer-academy|summer-2027
- stony-brook-university|register-for-supervised-research-or-creative-project-credit|none
- stony-brook-university|jane-armando-jannelli-ureca-award|none
- stony-brook-university|creative-writing-supplemental|none
- stony-brook-university|honors-programs-application-honors-college-wise-university-scholars-scholars-for-medicine-scholars-for-dental-medicine-yardi-scholars|fall-2027
