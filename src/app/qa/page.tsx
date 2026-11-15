// QA page: last pipeline run, per-source status, rejections by reason, needs_review list, cost and the personalization meter per school.
// Every number is computed from database rows at request time; nothing is typed in.

import { getAllSchools, getQaData, getVerifiedOpportunities, type QaData } from "../../lib/db";
import { gradeExclusions, matchGuide, scopeCounts } from "../../lib/match";
import type { Opportunity, Stage } from "../../lib/types";

export const dynamic = "force-dynamic";

const NA = "not recorded";
const num = (v: unknown) => (typeof v === "number" ? v : null);
const usd = (v: unknown) => (num(v) == null ? NA : `$${(v as number).toFixed(4)}`);

function evidenceQuotes(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((e) => {
    const o = e as { field?: string; quote?: string } | string;
    if (typeof o === "string") return o;
    return o?.quote ? `${o.field ?? "quote"}: "${o.quote}"` : JSON.stringify(e);
  });
}

function fetchState(result: unknown): string {
  switch (result) {
    case "ok":
      return "Fetched";
    case "blocked_by_robots":
      return "BLOCKED by robots.txt";
    case "error":
      return "FAILED";
    case "skipped":
      return "Skipped";
    default:
      return "Not checked yet";
  }
}

export default async function QaPage() {
  const [qa, schools] = await Promise.all([getQaData(), getAllSchools()]);
  const stages: Stage[] = ["grade_8", "admitted_college"];
  const oppsByStage = new Map<Stage, Opportunity[]>();
  for (const s of stages) oppsByStage.set(s, await getVerifiedOpportunities(s));
  const today = new Date().toISOString().slice(0, 10);

  const byCode = new Map<string, number>();
  for (const r of qa.rejections) byCode.set(r.reason_code, (byCode.get(r.reason_code) ?? 0) + 1);

  // A run's school_slug is one slug, a comma list, or "all"; only runs for exactly one school can be charged to it.
  const sumRuns = (runs: QaData["allRuns"]) => ({
    runs: runs.length,
    cost: runs.reduce((a, r) => a + (r.cost_usd ?? 0), 0),
    tokensIn: runs.reduce((a, r) => a + r.tokens_in, 0),
    tokensOut: runs.reduce((a, r) => a + r.tokens_out, 0),
  });
  const costRows = [
    ...schools.map((sc) => ({ label: sc.name, ...sumRuns(qa.allRuns.filter((r) => r.school_slug === sc.slug)) })),
    { label: "All schools together (or school not recorded)", ...sumRuns(qa.allRuns.filter((r) => !r.school_slug || !schools.some((sc) => sc.slug === r.school_slug))) },
  ];

  const run = qa.lastRun;
  const verified = num(run?.verified);
  const cost = num(run?.cost_usd);

  return (
    <main>
      <h1>QA</h1>

      <h2>Last run</h2>
      {!run ? (
        <p>No pipeline run recorded yet.</p>
      ) : (
        <table>
          <tbody>
            {["started_at", "finished_at", "sources_attempted", "sources_ok", "extracted", "verified", "needs_review", "rejected", "tokens_in", "tokens_out"].map(
              (k) => (
                <tr key={k}>
                  <th>{k.replace(/_/g, " ")}</th>
                  <td>{String(run[k] ?? NA)}</td>
                </tr>
              ),
            )}
            <tr>
              <th>cost</th>
              <td>{usd(run.cost_usd)}</td>
            </tr>
            <tr>
              <th>cost per verified record</th>
              <td>{cost != null && verified ? usd(cost / verified) : NA}</td>
            </tr>
          </tbody>
        </table>
      )}

      <h2>Totals across all published runs</h2>
      <p>
        Runs recorded: {qa.allRuns.length} | Cost: {usd(qa.allRuns.reduce((a, r) => a + (r.cost_usd ?? 0), 0))} | Tokens in:{" "}
        {qa.allRuns.reduce((a, r) => a + r.tokens_in, 0)} | Tokens out: {qa.allRuns.reduce((a, r) => a + r.tokens_out, 0)}
      </p>
      <p>Dry runs are not recorded in the database, so money spent on dry runs is not included here.</p>

      <h2>Per-source status</h2>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Stage</th>
            <th>Fetch state</th>
            <th>Note</th>
            <th>HTTP status</th>
            <th>Last fetched</th>
            <th>Last checked</th>
          </tr>
        </thead>
        <tbody>
          {qa.sources.map((s) => (
            <tr key={String(s.slug)}>
              <td>{String(s.slug)}</td>
              <td>{String(s.stage)}</td>
              <td>{fetchState(s.last_result)}</td>
              <td>{String(s.last_note ?? "")}</td>
              <td>{String(s.last_status ?? NA)}</td>
              <td>{String(s.last_fetched_at ?? "never")}</td>
              <td>{String(s.last_checked_at ?? "never")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Rejections by reason code (last run)</h2>
      {byCode.size === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {[...byCode.entries()].sort().map(([code, n]) => (
            <li key={code}>
              {code}: {n}
            </li>
          ))}
        </ul>
      )}

      <h2>Needs review</h2>
      {qa.needsReview.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {qa.needsReview.map((o) => (
            <li key={o.id}>
              {o.title} ({o.scope_type}: {o.scope_value}) | {o.review_note ?? "no note"} | {o.source_url}
            </li>
          ))}
        </ul>
      )}

      <h2>Per school</h2>
      <h3>Cost per school (published runs)</h3>
      <table>
        <thead>
          <tr>
            <th>Run scope</th>
            <th>Runs</th>
            <th>Cost</th>
            <th>Tokens in</th>
            <th>Tokens out</th>
          </tr>
        </thead>
        <tbody>
          {costRows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.runs}</td>
              <td>{usd(r.cost)}</td>
              <td>{r.tokensIn}</td>
              <td>{r.tokensOut}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Runs that covered every school at once are listed separately; their cost cannot be split by school.</p>
      <h3>Personalization meter</h3>
      <table>
        <thead>
          <tr>
            <th>School</th>
            <th>Guide items</th>
            <th>School</th>
            <th>District</th>
            <th>Institution</th>
            <th>Radius</th>
            <th>County</th>
            <th>Region</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((sc) => {
            const stage: Stage = sc.kind === "middle_school" ? "grade_8" : "admitted_college";
            const items = matchGuide(sc, oppsByStage.get(stage) ?? [], { today });
            const c = scopeCounts(items);
            return (
              <tr key={sc.slug}>
                <td>
                  <a href={`/guide/${sc.slug}`}>{sc.name}</a>
                </td>
                <td>{items.length}</td>
                <td>{c.school}</td>
                <td>{c.district}</td>
                <td>{c.institution}</td>
                <td>{c.radius}</td>
                <td>{c.county}</td>
                <td>{c.region}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Published rows by school, with evidence</h2>
      {schools.map((sc) => {
        const stage: Stage = sc.kind === "middle_school" ? "grade_8" : "admitted_college";
        const items = matchGuide(sc, oppsByStage.get(stage) ?? [], { today });
        return (
          <details key={sc.slug}>
            <summary>
              {sc.name} ({items.length})
            </summary>
            {items.length === 0 ? (
              <p>None.</p>
            ) : (
              <ul>
                {items.map((i) => (
                  <li key={i.opp.id}>
                    {i.opp.title} ({i.opp.scope_type}, {i.bucket}) | {i.opp.source_url}
                    <ul>
                      {evidenceQuotes(i.opp.evidence).map((q, n) => (
                        <li key={n}>{q}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}

      <h2>Excluded by the grade rule</h2>
      <p>
        Rows in scope for a middle school that were removed by the grade rule, with the page's grade quote. A student in 8th grade is compared with grade 9 for rows
        whose limits are by entering grade, and with grade 8 for rows whose limits are by current grade.
      </p>
      {schools
        .filter((sc) => sc.kind === "middle_school")
        .map((sc) => {
          const excluded = gradeExclusions(sc, oppsByStage.get("grade_8") ?? [], today);
          return (
            <section key={sc.slug}>
              <h3>
                {sc.name} ({excluded.length})
              </h3>
              {excluded.length === 0 ? (
                <p>None.</p>
              ) : (
                <ul>
                  {excluded.map((x) => (
                    <li key={x.opp.id}>
                      {x.opp.title} | {x.reason.replace("ineligible: ", "")} | Quote: {x.quote ? `"${x.quote}"` : "none recorded"} | {x.opp.source_url}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </main>
  );
}
