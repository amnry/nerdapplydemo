# CHECKLIST

Source: `plan.md` section 12. Tick a box only when its gate actually runs and passes. Commit after each gate with a message naming it.

## Build order

- [ ] **1. Scaffold.** Next.js scaffold, Supabase project, migration, deploy a blank page to Vercel.
  - Gate: the preview URL opens in incognito on a phone.
- [ ] **2. One school end to end.** Seed the 4 schools from official sources. Build `sources.yaml` for ONE school end to end. Pipeline stages 1 to 6.
  - Gate: `--dry-run` prints verified records with quotes for that one school.
- [ ] **3. All schools.** Add sources for the other 3 schools. Run `--publish` twice.
  - Gate: 30+ verified rows, second run changes nothing, QA report generated.
- [ ] **4. Matching.** `match.ts` + golden tests.
  - Gate: all 8 cases pass against real rows.
- [ ] **5. Guide.** Guide page + print CSS.
  - Gate: both stages print to two clean pages.
- [ ] **6. QA pages.** `/qa` and `/qa/[id]`.
  - Gate: one click from a guide card to its evidence.
- [ ] **7. Audit.** Manual audit, overrides, re-publish.
  - Gate: `AUDIT.csv` complete, QA report regenerated.
- [ ] **8. Walkthrough.** `docs/WALKTHROUGH.md`.
  - Gate: every file listed with what it does and why, plus the data flow of one record.

## Cut order if behind (cut top first)

1. Interest chips
2. `/qa/[id]` (fold the trace into `/qa`)
3. Second middle school's library and regional sources
4. Visual polish

## Never cut

- Quote verification
- The entering-grade rule
- The manual audit
- The printed guide

## Stop and ask when

- A gate fails twice
- A demo school has fewer than 5 usable sources
- Credentials are missing
