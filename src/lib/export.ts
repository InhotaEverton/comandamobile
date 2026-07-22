/** CSV / PDF export helpers. PDF uses the browser print dialog. */

export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (!rows.length) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))];
  return "\uFEFF" + lines.join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[], headers?: string[]) {
  const blob = new Blob([toCSV(rows, headers)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHTMLReport(title: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#000;padding:24px}
      h1{font-size:18pt;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:10pt}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#eee}
      .sum{font-weight:700}
    </style></head><body><h1>${title}</h1>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}
