/** RFC 4180 CSV parser: quoted fields, escaped quotes ("") and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      if (row.some((c) => c !== "")) rows.push(row)
      row = []
      field = ""
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c !== "")) rows.push(row)
  return rows
}

/** Escapes a value for CSV and neutralises spreadsheet formula injection (=, +, -, @). */
export function csvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  let text = value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.join("; ") : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n")
}
