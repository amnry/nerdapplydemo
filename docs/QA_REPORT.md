# QA Report

Generated: 2026-11-15T04:46:27+00:00  |  Mode: dry-run

## Run numbers

| Metric | Value |
|---|---|
| Sources attempted | 11 |
| Sources fetched OK | 8/11 |
| Records extracted | 23 |
| Verified | 17 |
| Needs review | 6 |
| Rejected | 0 |
| Dropped (pre_admission: about applying for admission) | 3 |
| Manual records (quotes not machine-checked if page blocked) | 0 |
| Tokens in / out | 45121 / 16909 |
| LLM cost | $0.2593 |
| Cost per verified record | $0.0153 |

## Per source

| Source | School | Result | Tokens (est.) | Note |
|---|---|---|---|---|
| sbu-ureca-glance | stony-brook-university | ok | 999 |  |
| sbu-ureca-faq | stony-brook-university | ok | 1550 |  |
| sbu-scholarships | stony-brook-university | ok | 573 |  |
| sbu-admitted-freshmen | stony-brook-university | ok | 1327 |  |
| sbu-first-year-admitted | stony-brook-university | ok | 1327 | duplicate page of sbu-admitted-freshmen; not re-extracted |
| sbu-apply-first-year | stony-brook-university | ok | 5048 |  |
| sbu-admitted-seawolf-day | stony-brook-university | ok | 8634 |  |
| sbu-eop | stony-brook-university | ok | 1382 |  |
| tv-course-catalog | gelinas-middle-school | blocked_by_robots | 0 | robots.txt disallows this crawler |
| tv-gelinas-home | gelinas-middle-school | blocked_by_robots | 0 | robots.txt disallows this crawler |
| tv-district-home | gelinas-middle-school | blocked_by_robots | 0 | robots.txt disallows this crawler |

## Rejections by reason code

- none

## Blocked by robots.txt (cannot be fetched; use manual_records.yaml)

- tv-course-catalog (gelinas-middle-school): robots.txt disallows this crawler
- tv-gelinas-home (gelinas-middle-school): robots.txt disallows this crawler
- tv-district-home (gelinas-middle-school): robots.txt disallows this crawler

## Skipped pages (HTML only tonight)

- none

## Dropped by pre_admission rule

- sbu-apply-first-year: First-Year Application, Spring 2027 entry
- sbu-apply-first-year: First-Year Application, Fall 2027 Early Action
- sbu-apply-first-year: First-Year Application, Fall 2027 Regular Decision

## Overrides with no matching record

- none
