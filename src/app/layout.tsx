// Root layout. Wraps every page in the html shell; exists because the App Router requires one.
import type { ReactNode } from "react";

export const metadata = {
  title: "NerdApply Opportunity Guide",
  description: "Dated, sourced roadmaps of real opportunities for a specific school.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
