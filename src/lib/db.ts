// Server-only Supabase reads for the guide. Uses the service key (RLS has no policies), so never import this from a client component.

import { createClient } from "@supabase/supabase-js";
import type { Opportunity, School, Stage } from "./types";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getSchool(slug: string): Promise<School | null> {
  const { data, error } = await client().from("schools").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`schools read failed: ${error.message}`);
  return data as School | null;
}

export async function getVerifiedOpportunities(stage: Stage): Promise<Opportunity[]> {
  const { data, error } = await client()
    .from("opportunities")
    .select("*")
    .eq("stage", stage)
    .eq("verification_state", "verified");
  if (error) throw new Error(`opportunities read failed: ${error.message}`);
  return (data ?? []) as Opportunity[];
}

export async function getAllSchools(): Promise<School[]> {
  const { data, error } = await client().from("schools").select("*").order("name");
  if (error) throw new Error(`schools read failed: ${error.message}`);
  return (data ?? []) as School[];
}

// source id -> owner name, so grouped cards can say which school a club list belongs to.
export async function getSourceOwners(): Promise<Record<number, string>> {
  const { data, error } = await client().from("sources").select("id, owner");
  if (error) throw new Error(`sources read failed: ${error.message}`);
  return Object.fromEntries((data ?? []).map((s: { id: number; owner: string }) => [s.id, s.owner]));
}

// Everything the /qa page shows, read in one place. Rows are returned as-is; the page computes every number from them.
export interface QaData {
  lastRun: Record<string, unknown> | null;
  allRuns: { school_slug: string | null; cost_usd: number | null; tokens_in: number; tokens_out: number }[];
  sources: Record<string, unknown>[];
  rowCounts: { verified: number; needsReview: number };
  allRejections: { source_id: number | null; title: string | null; reason_code: string }[]; // every run; the page de-duplicates repeats
  rejections: { reason_code: string; run_id: number | null; title: string | null; detail: string | null }[];
  needsReview: Pick<Opportunity, "id" | "title" | "scope_type" | "scope_value" | "review_note" | "source_url">[];
}

export async function getQaData(): Promise<QaData> {
  const db = client();
  const run = await db.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const allRuns = await db.from("pipeline_runs").select("school_slug, cost_usd, tokens_in, tokens_out");
  const sources = await db.from("sources").select("slug, url, owner, stage, last_result, last_note, last_status, last_fetched_at, last_checked_at").order("slug");
  const verifiedCount = await db.from("opportunities").select("id", { count: "exact", head: true }).eq("verification_state", "verified");
  const reviewCount = await db.from("opportunities").select("id", { count: "exact", head: true }).eq("verification_state", "needs_review");
  const allRejections = await db.from("rejections").select("source_id, title, reason_code");
  const lastRunId = (run.data as { id?: number } | null)?.id ?? null;
  const rejections = lastRunId == null
    ? { data: [], error: null }
    : await db.from("rejections").select("reason_code, run_id, title, detail").eq("run_id", lastRunId);
  const review = await db
    .from("opportunities")
    .select("id, title, scope_type, scope_value, review_note, source_url")
    .eq("verification_state", "needs_review")
    .order("id");
  for (const r of [run, allRuns, sources, rejections, review, verifiedCount, reviewCount, allRejections]) if (r.error) throw new Error(`qa read failed: ${r.error.message}`);
  return {
    lastRun: run.data as QaData["lastRun"],
    allRuns: (allRuns.data ?? []) as QaData["allRuns"],
    rowCounts: { verified: verifiedCount.count ?? 0, needsReview: reviewCount.count ?? 0 },
    allRejections: (allRejections.data ?? []) as QaData["allRejections"],
    sources: (sources.data ?? []) as QaData["sources"],
    rejections: (rejections.data ?? []) as QaData["rejections"],
    needsReview: (review.data ?? []) as QaData["needsReview"],
  };
}
