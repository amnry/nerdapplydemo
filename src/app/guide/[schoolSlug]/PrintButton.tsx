"use client";
// Print button; the only client code on the guide page, because window.print needs the browser.

export default function PrintButton() {
  return (
    <button type="button" className="no-print" onClick={() => window.print()}>
      Print
    </button>
  );
}
