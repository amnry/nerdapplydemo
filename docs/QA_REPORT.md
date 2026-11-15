# QA Report

Generated: 2026-11-15T06:09:34+00:00  |  Mode: publish

## Run numbers

| Metric | Value |
|---|---|
| Sources attempted | 16 |
| Sources fetched OK | 13/16 |
| Records extracted | 55 |
| Verified | 30 |
| Needs review | 23 |
| Rejected | 2 |
| Rows written to database | {'inserted': 0, 'updated': 0, 'unchanged': 53} |
| Dropped (pre_admission: about applying for admission) | 0 |
| Manual records (quotes not machine-checked if page blocked) | 0 |
| Tokens in / out | 0 / 0 |
| LLM cost | $0.0000 |
| Cost per verified record | $0.0000 |

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
| emmaclark-programs | gelinas-middle-school | ok | 421 |  |
| emmaclark-volunteer | gelinas-middle-school | ok | 1460 |  |
| emmaclark-summer-reading | gelinas-middle-school | ok | 1456 |  |
| emmaclark-more-opportunities | gelinas-middle-school | ok | 401 |  |
| emmaclark-classes-college | gelinas-middle-school | ok | 1235 |  |

## Rejections by reason code

- Q1: 2

## Blocked by robots.txt (cannot be fetched; use manual_records.yaml)

- tv-course-catalog (gelinas-middle-school): robots.txt disallows this crawler
- tv-gelinas-home (gelinas-middle-school): robots.txt disallows this crawler
- tv-district-home (gelinas-middle-school): robots.txt disallows this crawler

## Skipped pages (HTML only tonight)

- none

## Dropped by pre_admission rule

- none

## Rows by scope and state (after overrides)

- county / needs_review: 13
- county / verified: 1
- district / needs_review: 10
- district / verified: 5
- region / rejected: 8
- region / verified: 16

## Rejected by override (human decision)

- brookhaven-national-laboratory|community-college-internship-cci|ay-2026-27
- brookhaven-national-laboratory|science-undergraduate-laboratory-internship-suli|ay-2026-27
- cold-spring-harbor-laboratory-dna-learning-center|dna-barcoding-on-demand|none
- cold-spring-harbor-laboratory-dna-learning-center|dnalc-in-residence-fun-with-dna-at-miss-porter-s-school|summer-2026
- cold-spring-harbor-laboratory-dna-learning-center|forensic-detectives-on-demand|none
- cold-spring-harbor-laboratory-dna-learning-center|fun-with-dna-on-demand|none
- cold-spring-harbor-laboratory-dna-learning-center|genome-science-on-demand|none
- cold-spring-harbor-laboratory-dna-learning-center|on-demand-fun-with-dna|none

## Overrides with no matching record

- not checked: this run was scoped (--school or --source); run with --all to check
