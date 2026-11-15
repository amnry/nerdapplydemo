// Server-rendered guide for one school: reads verified rows, runs match.ts, prints as two Letter pages.
// URL carries only the school slug and optional interest chips, never personal data.

import { notFound } from "next/navigation";
import "../../../styles/print.css";
import { getSchool, getVerifiedOpportunities } from "../../../lib/db";
import { BUCKET_ORDER, actionPhrase, costText, matchGuide, scopeCounts } from "../../../lib/match";
import type { GuideItem, School, Stage } from "../../../lib/types";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const NP = "not published";

function shortUrl(url: string | null): string {
  if (!url) return NP;
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "");
  } catch {
    return url;
  }
}

function evidenceText(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((e) => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const o = e as { field?: string; quote?: string };
      if (o.quote) return o.field ? `${o.field}: "${o.quote}"` : `"${o.quote}"`;
    }
    return JSON.stringify(e);
  });
}

function Item({ i, school }: { i: GuideItem; school: School }) {
  const { opp } = i;
  const cost = costText(opp);
  return (
    <li className="item">
      <h3>{opp.title}</h3>
      <p>{opp.summary}</p>
      {i.why && <p>{i.why}</p>}
      {i.condition && <p>Condition: {i.condition}</p>}
      <p>
        {actionPhrase(i.action, school)} | Date: {i.dateNote}
        {cost ? ` | Cost: ${cost}` : ""}
      </p>
      <p>
        Official page: {shortUrl(opp.action_url ?? opp.source_url)} | Verified: {opp.last_verified_at?.slice(0, 10) ?? NP}
      </p>
      <details>
        <summary>Why is this here?</summary>
        <ul>
          {i.reasons.map((r, n) => (
            <li key={n}>{r}</li>
          ))}
        </ul>
        <ul>
          {evidenceText(opp.evidence).map((q, n) => (
            <li key={n}>{q}</li>
          ))}
        </ul>
        <p>Source: {opp.source_url}</p>
      </details>
    </li>
  );
}

// Dated items grouped into the three windows of the 8th-grade year ahead; empty windows say so instead of guessing.
function Next12Months({ items }: { items: GuideItem[] }) {
  const windows = [
    { label: "Rest of 8th grade (to May 2027)", from: "0000-00-00", to: "2027-05-31" },
    { label: "Summer 2027, rising 9th grader", from: "2027-06-01", to: "2027-08-31" },
    { label: "First semester of high school", from: "2027-09-01", to: "2028-01-31" },
  ];
  return (
    <section className="strip">
      <h2>Your next 12 months</h2>
      {windows.map((w) => {
        const inWin = items.filter((i) => i.date && i.date >= w.from && i.date <= w.to);
        return (
          <div key={w.label}>
            <strong>{w.label}</strong>
            {inWin.length === 0 ? (
              <span>: no dated items</span>
            ) : (
              <ul>
                {inWin.map((i) => (
                  <li key={i.opp.id}>
                    {i.date}: {i.opp.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ interests?: string }>;
}) {
  const { schoolSlug } = await params;
  const { interests } = await searchParams;
  const school = await getSchool(schoolSlug);
  if (!school) notFound();

  const stage: Stage = school.kind === "middle_school" ? "grade_8" : "admitted_college";
  const opps = await getVerifiedOpportunities(stage);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const items = matchGuide(school, opps, { today, interests: interests?.split(",").filter(Boolean) });

  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const recent = items.filter((i) => i.opp.last_verified_at && i.opp.last_verified_at >= weekAgo).length;
  const counts = scopeCounts(items);
  const specific = counts.school + counts.district + counts.institution;
  const showsDistance = items.some((i) => i.opp.scope_type === "radius" && i.distanceMiles != null);
  const checklist = items.filter((i) => i.opp.category === "campus_task");
  const rest = stage === "admitted_college" ? items.filter((i) => i.opp.category !== "campus_task") : items;

  return (
    <main className="guide">
      <header>
        <h1>{school.name}</h1>
        <p>
          {school.kind === "middle_school" ? school.district : [school.city, school.county].filter(Boolean).join(", ")} | Stage:{" "}
          {stage === "grade_8" ? "8th grade" : "Admitted to college"} | Generated {today}
        </p>
        <p>
          {items.length} opportunities, {recent} verified in the last 7 days.
        </p>
        {specific > 0 && (
          <p>
            {specific} {specific === 1 ? "item" : "items"} specific to {school.name}
          </p>
        )}
        <PrintButton />
      </header>

      {stage === "grade_8" && <Next12Months items={items} />}

      {stage === "admitted_college" && (
        <section>
          <h2>Before you enroll</h2>
          {checklist.length === 0 ? (
            <p>No dated campus tasks published.</p>
          ) : (
            <ul>
              {checklist.map((i) => {
                const cost = costText(i.opp);
                return (
                  <li key={i.opp.id}>
                    {i.opp.title}
                    {cost ? ` | ${cost}` : ""} | {i.dateNote}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {items.length === 0 && (
        <section>
          <h2>No verified opportunities yet</h2>
          <p>We have no verified opportunities for {school.name} that match this stage. Nothing is shown rather than guessing.</p>
        </section>
      )}

      {BUCKET_ORDER.map((b) => {
        const inBucket = rest.filter((i) => i.bucket === b);
        if (inBucket.length === 0) return null;
        return (
          <section key={b}>
            <h2>{b}</h2>
            {b === "Confirm first" && <p>Eligibility could not be confirmed from published data. Check with the organizer.</p>}
            <ul className="items">
              {inBucket.map((i) => (
                <Item key={i.opp.id} i={i} school={school} />
              ))}
            </ul>
          </section>
        );
      })}

      <footer>
        <p>Availability, dates and costs change. Confirm on the official page before acting.</p>
        <p>
          Evidence for every item: /qa. Data as of {today}.{showsDistance ? " Distances are straight-line." : ""}
        </p>
      </footer>
    </main>
  );
}
