"use client";
// Stage toggle, school picker and Generate button for the home page; the only client code on it, because the choices change what the picker lists.
// Generate navigates to /guide/<slug>, so the URL carries only the school slug.

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PickerSchool {
  slug: string;
  name: string;
  stage: "grade_8" | "admitted_college";
  detail: string;
  items: number;
}

const STAGES = [
  { value: "grade_8", label: "8th grade" },
  { value: "admitted_college", label: "Admitted to college" },
] as const;

export default function HomePicker({ schools }: { schools: PickerSchool[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<PickerSchool["stage"]>("grade_8");
  const [slug, setSlug] = useState("");

  const inStage = schools.filter((s) => s.stage === stage);
  const chosen = inStage.find((s) => s.slug === slug) ?? inStage[0];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen) router.push(`/guide/${chosen.slug}`);
      }}
    >
      <fieldset>
        <legend>Stage</legend>
        {STAGES.map((s) => (
          <label key={s.value}>
            <input type="radio" name="stage" value={s.value} checked={stage === s.value} onChange={() => setStage(s.value)} /> {s.label}{" "}
          </label>
        ))}
      </fieldset>

      <p>
        <label>
          School{" "}
          <select value={chosen?.slug ?? ""} onChange={(e) => setSlug(e.target.value)} disabled={inStage.length === 0}>
            {inStage.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.items} {s.items === 1 ? "item" : "items"} so far)
              </option>
            ))}
          </select>
        </label>
      </p>
      {chosen && <p>{chosen.detail}</p>}
      {inStage.length === 0 && <p>No schools are supported for this stage yet.</p>}

      <button type="submit" disabled={!chosen}>
        Generate
      </button>
    </form>
  );
}
