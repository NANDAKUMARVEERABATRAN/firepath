/**
 * Browser-only file readers for portfolio import. Files are read on the user's device and never uploaded;
 * the libraries are loaded on demand so they don't slow down other pages.
 */
import { findHeaderRow, parseCsv, textItemsToLines } from "./importHoldings";

export class PdfPasswordError extends Error {
  constructor(public wrong: boolean) { super(wrong ? "That password didn’t work." : "This PDF needs a password."); }
}

export async function readPdfLines(file: File, password?: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, password: password || undefined, isEvalSupported: false }).promise;
  } catch (error) {
    const e = error as { name?: string; code?: number };
    if (e?.name === "PasswordException") throw new PdfPasswordError(e.code === 2);
    throw new Error("We couldn’t open this PDF. Is it a statement PDF (not a scanned image)?");
  }
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter(item => typeof item.str === "string" && item.transform)
      .map(item => ({ str: item.str!, x: item.transform![4], y: item.transform![5], width: item.width }));
    lines.push(...textItemsToLines(items));
  }
  await doc.destroy();
  return lines;
}

/** CSV → rows directly; Excel → the sheet that looks most like a holdings table. */
export async function readSheetRows(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseCsv(await file.text());
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  let best: string[][] = [];
  for (const name of workbook.SheetNames) {
    const rows = (XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" }) as unknown[][])
      .map(row => row.map(cell => String(cell ?? "").trim()))
      .filter(row => row.some(Boolean));
    if (findHeaderRow(rows) >= 0 && (findHeaderRow(best) < 0 || rows.length > best.length)) best = rows;
    else if (!best.length) best = rows;
  }
  return best;
}

/** Hides digits, PAN-like codes and emails so users can safely share what the importer read. */
export function maskForSharing(lines: string[]): string {
  return lines.slice(0, 400).map(line => line
    .replace(/[A-Z]{5}\d{4}[A-Z]/g, "XXXXX9999X")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "email@hidden")
    .replace(/\d/g, "9")).join("\n");
}
