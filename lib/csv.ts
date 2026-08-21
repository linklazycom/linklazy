/**
 * Minimal dependency-free CSV parser (handles quoted fields, commas and
 * newlines inside quotes, escaped "" quotes, and \r\n or \n line endings).
 * Used by the admin bulk site-import feature so we don't need to pull in
 * a parsing library just for this one form.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalize line endings and strip a leading BOM (common when a CSV is
  // exported from Excel on Windows).
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  // Final field/row (files don't always end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully blank trailing rows (e.g. trailing newline at EOF).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/**
 * Parses a CSV with a header row into an array of plain objects keyed by
 * the (trimmed, lower-cased) header names. Extra/missing columns are
 * tolerated — missing values come back as undefined.
 */
export function csvToObjects(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows = parseCsv(input);
  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const objects = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows: objects };
}
