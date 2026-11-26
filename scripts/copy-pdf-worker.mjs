// Copies the PDF.js worker into public/ so the browser can load it (used by the CAS importer).
// Runs automatically after `npm install` (see "postinstall" in package.json), including on Vercel.
import { copyFileSync, existsSync } from "node:fs";

const from = "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";
if (existsSync(from)) {
  copyFileSync(from, "public/pdf.worker.min.mjs");
  console.log("PDF.js worker copied to public/");
}
