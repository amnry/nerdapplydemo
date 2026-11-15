// Home page: reads the supported schools and how many guide items each has, then hands them to the picker.
// Item counts come from the same matching the guide uses, so coverage shown here is never typed in.

import Link from "next/link";
import { getAllSchools, getVerifiedOpportunities } from "../lib/db";
import { matchGuide } from "../lib/match";
import type { Stage } from "../lib/types";
import HomePicker, { type PickerSchool } from "./HomePicker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schools = await getAllSchools();
  const stages: Stage[] = ["grade_8", "admitted_college"];
  const oppsByStage = new Map(await Promise.all(stages.map(async (s) => [s, await getVerifiedOpportunities(s)] as const)));
  const today = new Date().toISOString().slice(0, 10);

  const options: PickerSchool[] = schools.map((sc) => {
    const stage: Stage = sc.kind === "middle_school" ? "grade_8" : "admitted_college";
    return {
      slug: sc.slug,
      name: sc.name,
      stage,
      detail: sc.kind === "middle_school" ? (sc.district ?? "") : [sc.city, sc.county].filter(Boolean).join(", "),
      items: matchGuide(sc, oppsByStage.get(stage) ?? [], { today }).length,
    };
  });

  return (
    <main>
      <h1>NerdApply Opportunity Guide</h1>
      <p>Pick a stage and a school. Get a dated, sourced list of opportunities for that school, with the official page for each.</p>
      <HomePicker schools={options} />
      <p>
        <Link href="/qa">QA: how the data was checked</Link>
      </p>
    </main>
  );
}
