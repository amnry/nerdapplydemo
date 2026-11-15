// Golden cases from plan section 10 for src/lib/match.ts, using synthetic rows built in this file (TEST ONLY, never published).
// Pure-function tests: no DB, no network. Render-level checks that need the page are marked todo.

import { describe, expect, it } from "vitest";
import { actionPhrase, costText, matchGuide } from "../src/lib/match";
import type { Opportunity, School } from "../src/lib/types";

const TODAY = "2026-11-14";

const threeVillage: School = {
  id: 1, slug: "gelinas", kind: "middle_school", name: "Paul J. Gelinas Middle School", district: "Three Village Central School District", district_slug: "three-village-csd",
  county: "Suffolk", city: "Setauket", zip: null, lat: 40.93, lon: -73.1, grade_low: 6, grade_high: 8,
  feeder_high_school: "Ward Melville High School", source_url: null, verified_at: null,
};
const gardenCity: School = {
  ...threeVillage, id: 2, slug: "garden-city-ms", name: "Garden City Middle School", district: "Garden City Public Schools", district_slug: "garden-city-public-schools",
  county: "Nassau", city: "Garden City", lat: 40.72, lon: -73.64, feeder_high_school: "Garden City High School",
};
const stonyBrook: School = {
  ...threeVillage, id: 3, slug: "stony-brook", kind: "college", name: "Stony Brook University", district: null, district_slug: null,
  grade_low: null, grade_high: null, feeder_high_school: null,
};
const hofstra: School = { ...stonyBrook, id: 4, slug: "hofstra", name: "Hofstra University", county: "Nassau", city: "Hempstead" };

let nextId = 1;
function opp(over: Partial<Opportunity>): Opportunity {
  const id = nextId++;
  return {
    id, dedupe_key: `test-${id}`, source_id: 1, stage: "grade_8", category: "program", title: `TEST row ${id}`,
    summary: "TEST ONLY", scope_type: "county", scope_value: "Suffolk", venue_lat: null, venue_lon: null,
    grade_basis: "current", grades_allowed: [8], requires: {}, opens_on: null, deadline: "2026-11-30", starts_on: null,
    date_text: null, cycle_label: null, date_confidence: "exact", status: "open", action_type: "apply", action_url: null,
    cost_type: null, cost_usd: null, tags: [], evidence: [], source_url: "https://example.test", verification_state: "verified",
    extraction_method: "manual", review_note: null, last_verified_at: null, ...over,
  };
}
const guide = (school: School, rows: Opportunity[]) => matchGuide(school, rows, { today: TODAY });

describe("golden cases", () => {
  it("1. summer 2027 camp for entering grades 6-8 excludes a current 8th grader", () => {
    const camp = opp({ grade_basis: "entering", grades_allowed: [6, 7, 8], cycle_label: "summer-2027", starts_on: "2027-07-01", deadline: "2027-03-01" });
    expect(guide(threeVillage, [camp])).toHaveLength(0);
  });

  it("1b. same camp shows the reason through the eligibility function", async () => {
    const { eligibility } = await import("../src/lib/match");
    const camp = opp({ grade_basis: "entering", grades_allowed: [6, 7, 8], cycle_label: "summer-2027", starts_on: "2027-07-01" });
    const e = eligibility(threeVillage, camp);
    expect(e.state).toBe("ineligible");
    expect(e.reasons.join(" ")).toMatch(/Grade 9 not in allowed 6, 7, 8/);
  });

  it("2. district-restricted program: present for a listed district, absent for the other school", () => {
    const row = opp({ scope_type: "district", scope_value: "three-village-csd", requires: { districts: ["three-village-csd"] } });
    expect(guide(threeVillage, [row]).map((i) => i.opp.id)).toEqual([row.id]);
    const other = guide(gardenCity, [row]);
    expect(other.every((i) => i.bucket === "Confirm first")).toBe(true); // absent (length 0) also satisfies this
    expect(other).toHaveLength(0);
  });

  it("2c. district scope matches on district_slug, never on the display name", () => {
    const byName = opp({ scope_type: "district", scope_value: "Three Village Central School District" });
    const bySlug = opp({ scope_type: "district", scope_value: "three-village-csd" });
    expect(guide(threeVillage, [byName, bySlug]).map((i) => i.opp.id)).toEqual([bySlug.id]);
  });

  it("2b. unextractable district list is Confirm first, never eligible", () => {
    const row = opp({ scope_type: "county", scope_value: "Suffolk", requires: { districts: [] } });
    const [item] = guide(threeVillage, [row]);
    expect(item.bucket).toBe("Confirm first");
    expect(item.eligibility).toBe("unknown");
  });

  it("3. Stony Brook has zero Hofstra-only rows and the reverse", () => {
    const sb = opp({ stage: "admitted_college", scope_type: "institution", scope_value: "stony-brook", grades_allowed: null });
    const hof = opp({ stage: "admitted_college", scope_type: "institution", scope_value: "hofstra", grades_allowed: null });
    expect(guide(stonyBrook, [sb, hof]).map((i) => i.opp.id)).toEqual([sb.id]);
    expect(guide(hofstra, [sb, hof]).map((i) => i.opp.id)).toEqual([hof.id]);
  });

  it("4. auto_considered scholarship resolves to check_award, never apply", () => {
    const sch = opp({
      stage: "admitted_college", category: "scholarship", scope_type: "institution", scope_value: "stony-brook",
      grades_allowed: null, status: "auto_considered", action_type: "check_award",
    });
    const [item] = guide(stonyBrook, [sch]);
    expect(item.action).toBe("check_award");
    expect(actionPhrase(item.action, stonyBrook)).toBe("Check your award letter");
  });
  it.todo("4b. rendered card for an auto_considered scholarship contains no apply button (needs page render)");

  it("5. a date with no year prints its own wording; only a missing date says 'date not published'", () => {
    const withText = opp({ date_confidence: "year_unknown", deadline: "2026-11-20", date_text: "November 20" });
    const [a] = guide(threeVillage, [withText]);
    expect(a.date).toBeNull();
    expect(a.bucket).toBe("Plan ahead");
    expect(a.dateNote).toBe("November 20 (year not stated on the page)");
    const noText = opp({ date_confidence: "year_unknown", deadline: "2026-11-20" });
    expect(guide(threeVillage, [noText])[0].dateNote).toBe("date listed without a year, confirm with the school");
    const none = opp({ date_confidence: "not_published", deadline: null });
    expect(guide(threeVillage, [none])[0].dateNote).toBe("date not published");
  });

  it("6. cancelled or past-cycle rows never appear in This month", () => {
    const cancelled = opp({ status: "cancelled", deadline: "2026-11-20" });
    const past = opp({ deadline: "2026-10-01" });
    const live = opp({ deadline: "2026-11-20" });
    const thisMonth = guide(threeVillage, [cancelled, past, live]).filter((i) => i.bucket === "This month");
    expect(thisMonth.map((i) => i.opp.id)).toEqual([live.id]);
  });

  it("7. switching middle schools changes the school and district rows", () => {
    const tvSchool = opp({ scope_type: "school", scope_value: "gelinas", grades_allowed: null });
    const gcSchool = opp({ scope_type: "school", scope_value: "garden-city-ms", grades_allowed: null });
    const tvDistrict = opp({ scope_type: "district", scope_value: "three-village-csd" });
    const gcDistrict = opp({ scope_type: "district", scope_value: "garden-city-public-schools" });
    const rows = [tvSchool, gcSchool, tvDistrict, gcDistrict];
    const ids = (s: School) => guide(s, rows).map((i) => i.opp.id).sort();
    expect(ids(threeVillage)).toEqual([tvSchool.id, tvDistrict.id].sort());
    expect(ids(gardenCity)).toEqual([gcSchool.id, gcDistrict.id].sort());
  });

  it("8. a school with zero rows yields an empty guide", () => {
    expect(guide(threeVillage, [])).toEqual([]);
  });
  it.todo("8b. page renders its empty state for an empty guide (page.tsx has one; needs page render to test)");
});

describe("display rules", () => {
  const college = (over: Partial<Opportunity>) =>
    opp({ stage: "admitted_college", scope_type: "institution", scope_value: "stony-brook", grades_allowed: null, ...over });

  it("enrollment=current rows go to 'After you enroll'", () => {
    const [item] = guide(stonyBrook, [college({ requires: { enrollment: "current" } })]);
    expect(item.bucket).toBe("After you enroll");
  });

  it("a program condition goes to 'Confirm first' with the condition stated and the ask-school action", () => {
    const [item] = guide(stonyBrook, [college({ requires: { admit_program: "Honors College" } })]);
    expect(item.bucket).toBe("Confirm first");
    expect(item.condition).toBe("Had to be requested with the admission application: Honors College");
    expect(item.action).toBe("ask_school");
    expect(actionPhrase(item.action, stonyBrook)).toBe("Ask the admissions office");
  });

  it("a condition beats enrollment=current: the row is Confirm first, not After you enroll", () => {
    const [item] = guide(stonyBrook, [college({ requires: { enrollment: "current", major: "Biology" } })]);
    expect(item.bucket).toBe("Confirm first");
    expect(item.condition).toBe("major: Biology");
  });

  it("rows with no condition have a null condition", () => {
    expect(guide(stonyBrook, [college({})])[0].condition).toBeNull();
  });

  it("institution-scope rows have no why line; other scopes keep theirs", () => {
    expect(guide(stonyBrook, [college({})])[0].why).toBeNull();
    expect(guide(threeVillage, [opp({})])[0].why).toBe("Open county-wide in Suffolk");
  });

  it("cost is null when unknown, so the field can be hidden", () => {
    expect(costText(opp({}))).toBeNull();
    expect(costText(opp({ cost_usd: 0 }))).toBe("free");
    expect(costText(opp({ cost_usd: 50 }))).toBe("$50");
    expect(costText(opp({ cost_type: "varies" }))).toBe("varies");
  });

  it("action phrases are plain", () => {
    expect(actionPhrase("apply", stonyBrook)).toBe("Apply");
    expect(actionPhrase("register", stonyBrook)).toBe("Register");
    expect(actionPhrase("attend", stonyBrook)).toBe("Attend");
    expect(actionPhrase("ask_school", gardenCity)).toBe("Ask the school");
  });
});
