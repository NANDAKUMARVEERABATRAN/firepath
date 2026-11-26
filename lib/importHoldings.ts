/**
 * Portfolio import: turns CAS statements (as text lines from a PDF) and app exports (CSV/Excel rows)
 * into holdings. Pure functions; the file itself is read in the browser and never uploaded.
 */

export type ImportInvestmentType = "mutual_fund" | "stocks" | "bonds" | "gold" | "other";
export type ImportedHolding = {
  externalId: string;
  name: string;
  investmentType: ImportInvestmentType;
  value: number;
  units: number | null;
  price: number | null;
  isin: string | null;
  folio: string | null;
  asOf: string | null; // YYYY-MM-DD
  source: string;
};
export type ImportResult = { holdings: ImportedHolding[]; warnings: string[]; format: string; asOf: string | null };

const ISIN_RE = /\b(IN[A-Z0-9]{10})\b/;
const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** "₹1,23,456.78", "INR 45,678.9", "(1,200)", "12.5%" → number; null if not a number. */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "--") return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/^\(|\)$/g, "").replace(/^-/, "").replace(/inr|rs\.?|₹|aed|,|\s/gi, "");
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}

/** "25-Nov-2026" / "25/11/2026" / "2026-11-25" → "2026-11-25" */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[- /]([A-Za-z]{3})[a-z]*[- /,]+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function guessType(name: string, isin: string | null = null, fallback: ImportInvestmentType = "other"): ImportInvestmentType {
  const n = name.toLowerCase();
  if (/\bgold\b|goldbees|\bsgb\b|sovereign gold/.test(n)) return "gold";
  if (/\b(bonds?|debentures?|ncds?|g-?sec|t-?bill|sdl)\b/.test(n) && !/fund|scheme/.test(n)) return "bonds";
  if (isin?.startsWith("INF") || /\b(fund|scheme|plan|growth|idcw|elss|direct|regular|etf|bees|index)\b/.test(n)) return "mutual_fund";
  if (isin?.startsWith("INE")) return "stocks";
  return fallback;
}

const cleanName = (name: string) => name.replace(/\s+/g, " ").replace(/^[A-Z0-9]{2,8}-\s*/, "").replace(/[\s\-–(]+$/, "").trim().slice(0, 80);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
function makeId(source: string, isin: string | null, folio: string | null, name: string) {
  if (isin && folio) return `folio:${folio.replace(/\s+/g, "")}|${isin}`;
  if (isin) return `isin:${isin}`;
  return `name:${source}:${slug(name)}`;
}

/** Combines holdings with the same id (e.g. the same stock across two demat accounts). */
function merge(holdings: ImportedHolding[]): ImportedHolding[] {
  const map = new Map<string, ImportedHolding>();
  for (const h of holdings) {
    const existing = map.get(h.externalId);
    if (!existing) { map.set(h.externalId, { ...h }); continue; }
    existing.value = Math.round((existing.value + h.value) * 100) / 100;
    existing.units = existing.units !== null && h.units !== null ? existing.units + h.units : existing.units ?? h.units;
  }
  return [...map.values()];
}

/* ---------------- CSV / Excel ---------------- */

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map(d => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\"" && text[i + 1] === "\"") { cell += "\""; i += 1; }
      else if (ch === "\"") quoted = false;
      else cell += ch;
    } else if (ch === "\"") quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}

export type ColumnMap = { name: number; value: number; units: number; price: number; isin: number; folio: number };
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const HEADER_RULES: Record<keyof ColumnMap, { match: RegExp[]; avoid?: RegExp }> = {
  name: { match: [/^(scheme|scheme name|fund|fund name|instrument|stock|stock name|security|security name|company|company name|trading ?symbol|tradingsymbol|symbol|name|asset|holding)$/, /scheme|fund name|stock name|instrument|security|symbol|company/], avoid: /amc|code|category|type|isin|folio/ },
  value: { match: [/^(current value|cur val|market value|closing value|present value|current amount|value at ltp|valuation|current valuation)$/, /current value|cur val|market value|closing value|present value|valuation/], avoid: /invest|buy|cost|avg|p ?l|gain|return|change/ },
  units: { match: [/^(units|qty|quantity|quantity available|balance units|unit balance|shares|no of shares|holding quantity)$/, /units|qty|quantity|shares/], avoid: /price|value|pledged|t1/ },
  price: { match: [/^(ltp|nav|closing price|current price|last price|market price|current nav|price)$/, /ltp|nav|closing price|current price|market price/], avoid: /avg|buy|cost|purchase/ },
  isin: { match: [/^isin( code)?$/, /isin/] },
  folio: { match: [/^folio( no| number)?$/, /folio/] },
};

export function autoMapColumns(headers: string[]): ColumnMap {
  const map = { name: -1, value: -1, units: -1, price: -1, isin: -1, folio: -1 } as ColumnMap;
  const used = new Set<number>();
  for (const key of ["isin", "folio", "value", "units", "price", "name"] as (keyof ColumnMap)[]) {
    const rule = HEADER_RULES[key];
    for (const pattern of rule.match) {
      const index = headers.findIndex((h, i) => !used.has(i) && pattern.test(norm(h)) && !(rule.avoid && rule.avoid.test(norm(h)) && !rule.match[0].test(norm(h))));
      if (index >= 0) { map[key] = index; used.add(index); break; }
    }
  }
  return map;
}

/** Finds the header row (exports often have a title block above the table). */
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const map = autoMapColumns(rows[i]);
    if (map.name >= 0 && (map.value >= 0 || (map.units >= 0 && map.price >= 0))) return i;
  }
  return -1;
}

export function rowsToHoldings(rows: string[][], options: { source: string; map?: ColumnMap; headerRow?: number; defaultType?: ImportInvestmentType; asOf?: string | null }): ImportResult {
  const headerRow = options.headerRow ?? findHeaderRow(rows);
  const warnings: string[] = [];
  if (headerRow < 0) return { holdings: [], warnings: ["We couldn’t find the holdings table. Choose the columns below."], format: "table", asOf: null };
  const map = options.map ?? autoMapColumns(rows[headerRow]);
  if (map.name < 0 || (map.value < 0 && !(map.units >= 0 && map.price >= 0))) return { holdings: [], warnings: ["Choose which columns hold the name and the current value."], format: "table", asOf: null };
  const holdings: ImportedHolding[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerRow + 1)) {
    const rawName = row[map.name] ?? "";
    if (!rawName || /^(total|grand total|sub ?total|net)\b/i.test(rawName.trim())) continue;
    const units = map.units >= 0 ? parseNumber(row[map.units]) : null;
    const price = map.price >= 0 ? parseNumber(row[map.price]) : null;
    const value = map.value >= 0 ? parseNumber(row[map.value]) : units !== null && price !== null ? units * price : null;
    if (value === null || value <= 0) { if (rawName.trim()) skipped += 1; continue; }
    const isin = map.isin >= 0 ? (row[map.isin]?.match(ISIN_RE)?.[1] ?? null) : (rawName.match(ISIN_RE)?.[1] ?? null);
    const folio = map.folio >= 0 ? (row[map.folio]?.trim() || null) : null;
    const name = cleanName(rawName);
    holdings.push({ externalId: makeId(options.source, isin, folio, name), name, investmentType: guessType(name, isin, options.defaultType ?? "other"), value: Math.round(value * 100) / 100, units, price, isin, folio, asOf: options.asOf ?? null, source: options.source });
  }
  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} without a current value ${skipped === 1 ? "was" : "were"} skipped.`);
  return { holdings: merge(holdings), warnings, format: "table", asOf: options.asOf ?? null };
}

/* ---------------- CAS (text lines from the PDF) ---------------- */

const DECIMAL = /^-?[\d,]+\.\d+$/;
const NUMBER = /^-?[\d,]+(\.\d+)?$/;

export function parseCasText(lines: string[]): ImportResult {
  const text = lines.join("\n");
  const warnings: string[] = [];
  const format = /NSDL/i.test(text) ? "NSDL CAS" : /CDSL/i.test(text) ? "CDSL CAS" : /KFIN|Karvy/i.test(text) && !/CAMS/i.test(text) ? "KFintech CAS" : /CAMS|Consolidated Account Statement/i.test(text) ? "CAMS / KFintech CAS" : "Statement";
  const source = format.startsWith("NSDL") ? "nsdl_cas" : format.startsWith("CDSL") ? "cdsl_cas" : "mf_cas";
  const statementDate = text.match(/(?:as on|to|statement date|date)\s*:?\s*(\d{1,2}[- ][A-Za-z]{3}[a-z]*[- ,]+\d{4})/i)?.[1];
  const asOf = statementDate ? parseDate(statementDate) : null;
  const holdings: ImportedHolding[] = [];

  // 1) Detailed mutual fund CAS (CAMS/KFintech): Folio → scheme line with ISIN → "Market Value on <date>: INR x".
  let folio: string | null = null, scheme: string | null = null, isin: string | null = null, units: number | null = null;
  lines.forEach((line, i) => {
    const folioMatch = line.match(/Folio\s*No\.?\s*:?\s*([0-9A-Z][0-9A-Z /-]*?)(?=\s{2,}|\s+KYC|\s+PAN|\s*$)/i);
    if (folioMatch) { folio = folioMatch[1].trim(); }
    const isinMatch = line.match(/ISIN\s*:?\s*(IN[A-Z0-9]{10})/i);
    if (isinMatch) {
      isin = isinMatch[1];
      let before = line.slice(0, line.search(/[-–(]?\s*ISIN/i)).trim();
      // Long scheme names wrap onto two lines in the PDF: join when this part is tiny or the previous line ends with a dash.
      const previous = i > 0 ? lines[i - 1].trim() : "";
      if (previous && !/Folio|Balance|Value|KYC|PAN/i.test(previous) && (before.replace(/^[A-Z0-9]+-/, "").length < 6 || /[-–]$/.test(previous))) before = `${previous} ${before}`;
      scheme = cleanName(before);
      units = null;
    }
    const unitsMatch = line.match(/Closing Unit Balance\s*:?\s*([\d,]+\.?\d*)/i);
    if (unitsMatch) units = parseNumber(unitsMatch[1]);
    const valueMatch = line.match(/(?:Market Value|Valuation)\s*on\s*(\d{1,2}-[A-Za-z]{3}-\d{4})\s*:?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.?\d*)/i);
    if (valueMatch && scheme) {
      const value = parseNumber(valueMatch[2]);
      const nav = line.match(/NAV\s*on\s*[\d\w-]+\s*:?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.?\d*)/i);
      if (value !== null && value > 0) holdings.push({ externalId: makeId(source, isin, folio, scheme), name: scheme, investmentType: guessType(scheme, isin, "mutual_fund"), value, units, price: nav ? parseNumber(nav[1]) : null, isin, folio, asOf: parseDate(valueMatch[1]) ?? asOf, source });
      scheme = null;
    }
  });

  // 2) Table rows (summary CAS, NSDL/CDSL): a line with an ISIN and decimal numbers; the last number is the value.
  const seen = new Set(holdings.map(h => h.isin));
  let unread = 0;
  for (const line of lines) {
    const m = line.match(ISIN_RE);
    if (!m || seen.has(m[1]) || /ISIN\s*:/i.test(line)) continue;
    const tokens = line.split(/\s+/).filter(Boolean);
    const isinIndex = tokens.indexOf(m[1]);
    // Numbers after the ISIN; typical columns end with: units · price/NAV · value.
    const numbers = tokens.map((t, i) => ({ t, i })).filter(x => x.i > isinIndex && NUMBER.test(x.t));
    if (!numbers.some(x => DECIMAL.test(x.t))) { unread += 1; continue; }
    let name = tokens.slice(isinIndex + 1, numbers[0].i).filter(t => t !== "/").join(" ");
    if (name.length < 3) name = tokens.slice(0, isinIndex).join(" ");
    name = cleanName(name);
    const value = parseNumber(numbers.at(-1)!.t);
    if (!name || value === null || value <= 0) { unread += 1; continue; }
    const units = numbers.length >= 3 ? parseNumber(numbers.at(-3)!.t) : null;
    const price = numbers.length >= 2 ? parseNumber(numbers.at(-2)!.t) : null;
    holdings.push({ externalId: makeId(source, m[1], null, name), name, investmentType: guessType(name, m[1], m[1].startsWith("INE") ? "stocks" : "mutual_fund"), value, units, price, isin: m[1], folio: null, asOf, source });
    seen.add(m[1]);
  }
  if (unread) warnings.push(`${unread} line${unread === 1 ? "" : "s"} mentioning an ISIN couldn’t be read. Check the total against your statement.`);
  if (!holdings.length) warnings.push("No holdings found. Make sure this is a CAS PDF (not a transaction slip). If it is, use “Show what we read” to help us improve the importer.");
  return { holdings: merge(holdings), warnings, format, asOf };
}

/** Groups PDF.js text items into lines (same y), left to right. */
export function textItemsToLines(items: { str: string; x: number; y: number; width?: number }[]): string[] {
  const rows = new Map<number, { str: string; x: number; width: number }[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const key = [...rows.keys()].find(y => Math.abs(y - item.y) < 2.5) ?? item.y;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push({ str: item.str, x: item.x, width: item.width ?? item.str.length * 4 });
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => {
    parts.sort((a, b) => a.x - b.x);
    let line = "", end = -Infinity;
    for (const p of parts) { line += (line ? (p.x - end > 12 ? "   " : " ") : "") + p.str.trim(); end = p.x + p.width; }
    return line.replace(/[ \t]{4,}/g, "   ");
  });
}

/** Tells the user what changes: new rows vs updates to existing imported rows. */
export function planImport(holdings: ImportedHolding[], existing: { id: string; external_id?: string | null; current_value: number }[]) {
  const byId = new Map(existing.filter(e => e.external_id).map(e => [e.external_id!, e]));
  return holdings.map(h => ({ holding: h, existing: byId.get(h.externalId) ?? null }));
}
