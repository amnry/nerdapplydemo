// Pure matching for the opportunity guide: scope filter, three-valued eligibility, date buckets, ranking, templated why lines.
// No LLM and no network; the caller passes in rows already read from the DB, so results are deterministic and testable.

import { haversineMiles } from "./distance";
import type { Bucket, Eligibility, GuideItem, Opportunity, School, ScopeType } from "./types";

export const BUCKET_ORDER: Bucket[] = ["This month", "Next 3 months", "Plan ahead", "Confirm first"];

// schools has no region column, so the one supported region maps to counties here.
const REGION_COUNTIES: Record<string, string[]> = { "long-island": ["nassau", "suffolk"] };

const SPECIFICITY: Record<ScopeType, number> = { school: 0, district: 0, institution: 0, radius: 1, county: 2, region: 3 };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function isoAddMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// Distance from the school to the venue, or null if either side lacks coordinates.
function distanceMiles(school: School, opp: Opportunity): number | null {
  if (school.lat == null || school.lon == null || opp.venue_lat == null || opp.venue_lon == null) return null;
  return haversineMiles(school.lat, school.lon, opp.venue_lat, opp.venue_lon);
}

// Step 1: does the row's scope contain this school? Unprovable containment (missing coordinates) counts as no.
export function inScope(school: School, opp: Opportunity): boolean {
  const v = norm(opp.scope_value);
  switch (opp.scope_type) {
    case "school":
    case "institution":
      return v === norm(school.slug);
    case "district":
      return school.district_slug != null && v === norm(school.district_slug);
    case "county":
      return school.county != null && v === norm(school.county);
    case "region":
      return REGION_COUNTIES[v]?.includes(norm(school.county)) ?? false;
    case "radius": {
      const miles = parseFloat(opp.scope_value);
      const d = distanceMiles(school, opp);
      return d != null && Number.isFinite(miles) && d <= miles;
    }
  }
}

// A summer or fall 2027 program is for a student who will be entering grade 9, not one who is in grade 8 now.
function isRising(opp: Opportunity): boolean {
  return (opp.starts_on != null && opp.starts_on >= "2027-06-01") || opp.cycle_label === "summer-2027" || opp.cycle_label === "fall-2027";
}

interface Eligible {
  state: Eligibility;
  reasons: string[];
  afterEnroll: boolean;
  askSchool: boolean;
}

// Step 2: three-valued eligibility. Any ineligible rule wins, then any unknown rule, otherwise eligible.
export function eligibility(school: School, opp: Opportunity): Eligible {
  const outcomes: { state: Eligibility; reason: string }[] = [];
  let afterEnroll = false;
  let askSchool = false;
  const req = opp.requires ?? {};

  if (school.kind === "middle_school") {
    const grade = isRising(opp) ? 9 : 8;
    const label = grade === 9 ? "entering grade 9 (program starts summer 2027 or later)" : "current grade 8";
    if (!opp.grades_allowed || opp.grades_allowed.length === 0) {
      outcomes.push(
        opp.scope_type === "school"
          ? { state: "eligible", reason: "School-scope row with no grade limit; offered to this school's students" }
          : { state: "unknown", reason: "Grades not published" },
      );
    } else if (opp.grade_basis === "age" || opp.grade_basis === "unknown") {
      outcomes.push({ state: "unknown", reason: `Grades ${opp.grades_allowed.join(", ")} listed but basis (${opp.grade_basis}) cannot be compared to ${label}` });
    } else if (opp.grades_allowed.includes(grade)) {
      outcomes.push({ state: "eligible", reason: `Grade ${grade} is allowed (${opp.grade_basis} grade; student is ${label})` });
    } else {
      outcomes.push({ state: "ineligible", reason: `Grade ${grade} not in allowed ${opp.grades_allowed.join(", ")} (${opp.grade_basis} grade; student is ${label})` });
    }

    if (req.districts !== undefined) {
      if (!Array.isArray(req.districts) || req.districts.length === 0) {
        outcomes.push({ state: "unknown", reason: "District restriction exists but the list was not extractable" });
      } else if (school.district_slug && req.districts.some((d) => norm(d) === norm(school.district_slug))) {
        outcomes.push({ state: "eligible", reason: `District ${school.district} is in the listed set` });
      } else {
        outcomes.push({ state: "ineligible", reason: `District ${school.district ?? "unknown"} is not in ${req.districts.join(", ")}` });
      }
    }
  } else {
    if (opp.scope_type === "institution") outcomes.push({ state: "eligible", reason: `Institution ${school.name} matches exactly` });
    if (req.enrollment === "current") {
      afterEnroll = true;
      outcomes.push({ state: "eligible", reason: "Requires current enrollment: available after you enroll" });
    }
    if (req.admit_program) {
      askSchool = true;
      outcomes.push({ state: "eligible", reason: `Required a request with the admission application (${req.admit_program}): ask the office` });
    }
  }

  const state: Eligibility = outcomes.some((o) => o.state === "ineligible")
    ? "ineligible"
    : outcomes.some((o) => o.state === "unknown")
      ? "unknown"
      : "eligible";
  return { state, reasons: outcomes.map((o) => `${o.state}: ${o.reason}`), afterEnroll, askSchool };
}

// Step 5: templated from data only.
function whyLine(school: School, opp: Opportunity, miles: number | null): string {
  switch (opp.scope_type) {
    case "school":
      return "Offered by your school";
    case "district":
      return "Offered by your district";
    case "institution":
      return `Only for admitted ${school.name} students`;
    case "radius":
      return miles != null ? `${miles.toFixed(1)} miles straight-line from your school` : "Near your school";
    case "county":
      return `Open county-wide in ${school.county}`;
    case "region":
      return "Open across Long Island";
  }
}

// Step 3: bucket by the most relevant date. No usable date means Plan ahead.
function bucketFor(date: string | null, confident: boolean, today: string): Bucket {
  if (!date || !confident) return "Plan ahead";
  if (date <= endOfMonth(today)) return "This month";
  if (date <= isoAddMonths(today, 3)) return "Next 3 months";
  return "Plan ahead";
}

export interface MatchOptions {
  today: string; // YYYY-MM-DD, injected so the function stays pure
  interests?: string[];
}

export function matchGuide(school: School, opps: Opportunity[], opts: MatchOptions): GuideItem[] {
  const interests = new Set((opts.interests ?? []).map(norm));
  const stage = school.kind === "middle_school" ? "grade_8" : "admitted_college";
  const hits = new Map<number, number>();
  const items: GuideItem[] = [];

  for (const opp of opps) {
    if (opp.stage !== stage || opp.verification_state !== "verified") continue;
    if (opp.status === "closed" || opp.status === "cancelled") continue;
    if (opp.deadline && opp.deadline < opts.today && opp.status !== "ongoing") continue;
    if (!inScope(school, opp)) continue;

    const e = eligibility(school, opp);
    if (e.state === "ineligible") continue;

    const date = opp.deadline ?? opp.starts_on ?? opp.opens_on;
    const confident = opp.date_confidence === "exact";
    const miles = distanceMiles(school, opp);
    const bucket: Bucket = e.state === "unknown" ? "Confirm first" : e.afterEnroll ? "Plan ahead" : bucketFor(date, confident, opts.today);

    hits.set(opp.id, opp.tags.filter((t) => interests.has(norm(t))).length);
    items.push({
      opp,
      eligibility: e.state,
      reasons: e.reasons,
      bucket,
      why: whyLine(school, opp, miles),
      action: e.askSchool ? "ask_school" : opp.action_type,
      afterEnroll: e.afterEnroll,
      date: date && confident ? date : null,
      dateNote: date && confident ? date : opp.date_confidence === "year_unknown" ? "date listed without a year, confirm with the school" : "date not published",
      distanceMiles: miles,
    });
  }

  // Step 4: specificity, interest overlap, nearest date, distance, then id for a stable order.
  const cmpNullLast = (a: number | string | null, b: number | string | null) =>
    a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1;
  items.sort(
    (a, b) =>
      BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) ||
      SPECIFICITY[a.opp.scope_type] - SPECIFICITY[b.opp.scope_type] ||
      (hits.get(b.opp.id) ?? 0) - (hits.get(a.opp.id) ?? 0) ||
      cmpNullLast(a.date, b.date) ||
      cmpNullLast(a.distanceMiles, b.distanceMiles) ||
      a.opp.id - b.opp.id,
  );
  return items;
}

// Personalization meter: how many matched items sit at each scope level.
export function scopeCounts(items: GuideItem[]): Record<ScopeType, number> {
  const counts: Record<ScopeType, number> = { school: 0, district: 0, institution: 0, radius: 0, county: 0, region: 0 };
  for (const i of items) counts[i.opp.scope_type]++;
  return counts;
}
