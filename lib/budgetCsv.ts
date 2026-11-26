export const importCategories = [
  "housing", "utilities", "groceries", "dining", "transport", "healthcare", "insurance",
  "education", "family", "debt_repayment", "personal", "other",
] as const;

export type ImportCategory = (typeof importCategories)[number];
export type ParsedBudgetRow = { row: number; spent_on: string; category: ImportCategory; needsCategory: boolean; amount: number; note: string };
export type BudgetCsvResult = { rows: ParsedBudgetRow[]; errors: { row: number; message: string }[] };

const aliases: Record<string, ImportCategory> = {
  housing: "housing", rent: "housing", home: "housing", किराया: "housing", मकान: "housing", utilities: "utilities", bills: "utilities", bijli: "utilities", electricity: "utilities", बिजली: "utilities",
  groceries: "groceries", grocery: "groceries", food: "groceries", ration: "groceries", किराना: "groceries", राशन: "groceries", dining: "dining", restaurant: "dining", eating_out: "dining", बाहर_खाना: "dining",
  transport: "transport", travel: "transport", petrol: "transport", fuel: "transport", परिवहन: "transport", ईंधन: "transport", healthcare: "healthcare", medical: "healthcare", medicine: "healthcare", स्वास्थ्य: "healthcare", दवा: "healthcare",
  insurance: "insurance", बीमा: "insurance", education: "education", school: "education", शिक्षा: "education", family: "family", parents: "family", परिवार: "family", debt: "debt_repayment", loan: "debt_repayment", debt_repayment: "debt_repayment", ऋण: "debt_repayment", कर्ज: "debt_repayment",
  personal: "personal", shopping: "personal", other: "other", misc: "other", अन्य: "other",
};

function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted && char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell.trim()); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("A quoted field was not closed.");
  row.push(cell.trim());
  if (row.some(value => value !== "")) rows.push(row);
  return rows;
}

export function parseBudgetCsv(text: string): BudgetCsvResult {
  const matrix = readCsv(text);
  if (matrix.length < 2) throw new Error("Add a header and at least one transaction row.");
  const header = matrix[0].map(value => value.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const find = (...names: string[]) => header.findIndex(value => names.includes(value));
  const dateIndex = find("date", "spent_on", "transaction_date");
  const categoryIndex = find("category", "type");
  const amountIndex = find("amount", "debit", "debit_amount", "withdrawal", "withdrawal_amount", "spent");
  const noteIndex = find("note", "description", "merchant", "details");
  if (dateIndex < 0 || amountIndex < 0) throw new Error("CSV needs date and amount columns. Category and note/description columns are optional; uncategorized rows will need your review.");
  if (matrix.length - 1 > 500) throw new Error("Import up to 500 rows at a time.");
  const rows: ParsedBudgetRow[] = [];
  const errors: BudgetCsvResult["errors"] = [];
  for (const [index, values] of matrix.slice(1).entries()) {
    const rowNumber = index + 2;
    const date = values[dateIndex]?.trim() ?? "";
    const categoryText = (categoryIndex < 0 ? "" : values[categoryIndex] ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    const amountText = (values[amountIndex] ?? "").replace(/[₹,\s]/g, "");
    const amount = Number(amountText);
    const dateMatch = date.match(/^(?:(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[/-](\d{1,2})[/-](\d{4}))$/);
    const year = dateMatch ? Number(dateMatch[1] ?? dateMatch[6]) : 0;
    const month = dateMatch ? Number(dateMatch[2] ?? dateMatch[5]) : 0;
    const day = dateMatch ? Number(dateMatch[3] ?? dateMatch[4]) : 0;
    const validDate = dateMatch && month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate();
    const category = aliases[categoryText] ?? "other";
    if (!validDate) { errors.push({ row: rowNumber, message: "Use a valid date in YYYY-MM-DD format." }); continue; }
    if (!Number.isFinite(amount) || amount <= 0) { errors.push({ row: rowNumber, message: "Amount must be greater than zero." }); continue; }
    rows.push({ row: rowNumber, spent_on: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, category, needsCategory: categoryIndex < 0 || !aliases[categoryText], amount, note: (noteIndex < 0 ? "" : values[noteIndex] ?? "").slice(0, 200) });
  }
  return { rows, errors };
}

export function transactionFingerprint(row: Pick<ParsedBudgetRow, "spent_on" | "category" | "amount" | "note">): string {
  return `${row.spent_on}|${row.category}|${Number(row.amount).toFixed(2)}|${row.note.trim().toLowerCase()}`;
}
