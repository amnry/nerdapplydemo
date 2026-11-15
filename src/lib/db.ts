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
