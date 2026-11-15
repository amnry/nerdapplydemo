// The eight interest tags the pipeline may put on a row (ingestion/models.py TAGS), with the labels shown to students.
// Safe to import from client components: no server code here.

export const INTEREST_LABELS: Record<string, string> = {
  stem: "STEM",
  research: "Research",
  arts: "Arts",
  writing: "Writing",
  service: "Service",
  athletics: "Athletics",
  business: "Business",
  health: "Health",
};

export const INTEREST_TAGS = Object.keys(INTEREST_LABELS);

export const interestLabel = (tag: string) => INTEREST_LABELS[tag] ?? tag;

// Parse ?interests=a,b into known tags only, in the canonical order, so unknown values in the URL are ignored.
export function parseInterests(raw: string | undefined): string[] {
  const chosen = new Set((raw ?? "").split(",").map((s) => s.trim().toLowerCase()));
  return INTEREST_TAGS.filter((t) => chosen.has(t));
}
