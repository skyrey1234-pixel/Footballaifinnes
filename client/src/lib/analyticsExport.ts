type FlatRow = { path: string; value: string };

function flatten(value: unknown, path = "root", rows: FlatRow[] = []): FlatRow[] {
  if (value === null || value === undefined || typeof value !== "object") {
    rows.push({ path, value: value === null || value === undefined ? "" : String(value) });
    return rows;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, rows));
    return rows;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => flatten(item, path === "root" ? key : `${path}.${key}`, rows));
  return rows;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadAnalyticsCsv(title: string, data: unknown, quality?: unknown) {
  const rows = flatten({ quality, analysis: data });
  const csv = ["Field,Value", ...rows.map((row) => `${csvCell(row.path)},${csvCell(row.value)}`)].join("\n");
  download(`${slugify(title)}.csv`, csv, "text/csv;charset=utf-8");
}

export function printAnalyticsPdf(title: string, data: unknown, quality?: unknown) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) throw new Error("Allow pop-ups to export this module as PDF");
  const rows = flatten({ quality, analysis: data });
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;margin:36px;color:#101820}h1{margin:0 0 8px}p{color:#52606d}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}td,th{border:1px solid #d9e2ec;padding:8px;text-align:left;vertical-align:top}th{background:#07130f;color:#fff}.note{padding:12px;background:#ecfdf5;border:1px solid #a7f3d0;margin-top:18px}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>TacticalEdge AI · Evidence-aware coaching analysis</p><div class="note">AI-generated estimates must be verified by a coach before game-day use.</div><table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.path)}</td><td>${escapeHtml(row.value)}</td></tr>`).join("")}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
}

export function extractNumericMetrics(data: unknown, limit = 8) {
  return flatten(data)
    .filter((row) => row.path !== "id" && row.path !== "sessionId" && row.path !== "createdAt")
    .filter((row) => row.value.trim() !== "")
    .map((row) => ({ label: row.path.replace(/\./g, " › ").replace(/_/g, " "), value: Number(row.value) }))
    .filter((row) => Number.isFinite(row.value))
    .slice(0, limit);
}
