// QA page: last pipeline run, per-source status, rejections by reason, needs_review list, cost and the personalization meter per school.
// Every number is computed from database rows at request time; nothing is typed in.

import { getAllSchools, getQaData, getVerifiedOpportunities } from "../../lib/db";
import { gradeExclusions, matchGuide, scopeCounts } from "../../lib/match";
import type { Opportunity, Stage } from "../../lib/types";

export const dynamic = "force-dynamic";

const NA = "not recorded";
const num = (v: unknown) => (typeof v === "number" ? v : null);
const usd = (v: unknown) => (num(v) == null ? NA : `$${(v as number).toFixed(4)}`);

export default async function QaPage() {
  const [qa, schools] = await Promise.all([getQaData(), getAllSchools()]);
  const stages: Stage[] = ["grade_8", "admitted_college"];
  const oppsByStage = new Map<Stage, Opportunity[]>();
  for (const s of stages) oppsByStage.set(s, await getVerifiedOpportunities(s));
  const today = new Date().toISOString().slice(0, 10);

  const byCode = new Map<string, number>();
  for (const r of qa.rejections) byCode.set(r.reason_code, (byCode.get(r.reason_code) ?? 0) + 1);

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

      <h2>Per-source status</h2>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Stage</th>
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
      <p>
        Cost per school is not recorded: the pipeline stores tokens and cost per run, not per school. Last run total: {usd(run?.cost_usd)}.
      </p>
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

      <h2>Excluded by the grade rule</h2>
      <p>Rows in scope for a middle school that were removed because the student's grade is not allowed, with the page's grade quote.</p>
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
