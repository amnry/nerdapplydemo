// /guide has no content of its own: a guide needs a school, so send visitors to the picker on the home page.

import { redirect } from "next/navigation";

export default function GuideIndex() {
  redirect("/");
}
