// Row types mirroring supabase/migrations/001_init.sql (schools, opportunities) plus the guide shapes match.ts returns.
// Hand-written because the schema has two tables this app reads; keep in sync with the migration.

export type Stage = "grade_8" | "admitted_college";
export type Category = "milestone" | "program" | "scholarship" | "research" | "competition" | "club" | "campus_task";
export type GradeBasis = "current" | "entering" | "age" | "unknown";
export type OppStatus = "open" | "upcoming" | "ongoing" | "auto_considered" | "closed" | "cancelled" | "unknown";
export type ActionType = "apply" | "register" | "attend" | "check_award" | "ask_school" | "mark_calendar";
export type DateConfidence = "exact" | "year_unknown" | "not_published";
export type ScopeType = "school" | "district" | "institution" | "radius" | "county" | "region";

export interface School {
  id: number;
  slug: string;
  kind: "middle_school" | "college";
  name: string;
  district: string | null;
  district_slug: string | null; // stable key that district-scoped rows and requires.districts match on
  county: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  grade_low: number | null;
  grade_high: number | null;
  feeder_high_school: string | null;
  source_url: string | null;
  verified_at: string | null;
}

export interface Opportunity {
  id: number;
  dedupe_key: string;
  source_id: number;
  stage: Stage;
  category: Category;
  title: string;
  summary: string;
  scope_type: ScopeType;
  scope_value: string;
  venue_lat: number | null;
  venue_lon: number | null;
  grade_basis: GradeBasis;
  grades_allowed: number[] | null;
  requires: { districts?: string[] | null; enrollment?: string | null; [condition: string]: unknown }; // districts are district slugs
  opens_on: string | null; // YYYY-MM-DD
  deadline: string | null;
  starts_on: string | null;
  date_text: string | null; // migration 002; verbatim wording when the page gave no year
  cycle_label: string | null;
  date_confidence: DateConfidence;
  status: OppStatus;
  action_type: ActionType;
  action_url: string | null;
  cost_type: string | null;
  cost_usd: number | null;
  tags: string[];
  evidence: unknown;
  source_url: string;
  verification_state: "verified" | "needs_review" | "rejected";
  extraction_method: "llm" | "manual";
  review_note: string | null;
  last_verified_at: string | null;
}

export type Eligibility = "eligible" | "ineligible" | "unknown";
export type Bucket = "This month" | "Next 3 months" | "Plan ahead" | "After you enroll" | "Confirm first";

export interface GuideItem {
  opp: Opportunity;
  eligibility: Eligibility;
  reasons: string[]; // rule outcomes, shown under "Why is this here?"
  bucket: Bucket;
  why: string | null; // templated why line; null when it would add nothing (college guides, institution scope)
  condition: string | null; // program condition from requires, stated on the card; forces Confirm first
  action: ActionType; // may differ from opp.action_type (ask_school override)
  afterEnroll: boolean;
  date: string | null; // the date used for bucketing
  dateNote: string; // human label: the date, or "date not published"
  distanceMiles: number | null;
}
