/**
 * "This month": one place for income, spending (as a total or by category), investing and EMIs.
 * A category's amount is always the sum of its spending entries. When someone types a category total,
 * we store only the difference as a single "Monthly total" entry, so entries and typed totals never double-count.
 */

export const MONTH_CATEGORIES = [
  { id: "housing", label: "Rent & housing", emoji: "🏠" },
  { id: "groceries", label: "Groceries", emoji: "🛒" },
  { id: "utilities", label: "Bills & utilities", emoji: "💡" },
  { id: "transport", label: "Transport & fuel", emoji: "🚗" },
  { id: "dining", label: "Eating out & delivery", emoji: "🍽️" },
  { id: "personal", label: "Shopping & personal", emoji: "🛍️" },
  { id: "healthcare", label: "Health", emoji: "🩺" },
  { id: "insurance", label: "Insurance", emoji: "🛡️" },
  { id: "education", label: "Education & fees", emoji: "🎓" },
  { id: "family", label: "Family & support", emoji: "👨‍👩‍👧" },
  { id: "other", label: "Other", emoji: "🧾" },
] as const;
export type MonthCategory = (typeof MONTH_CATEGORIES)[number]["id"];
export const MONTH_TOTAL_NOTE = "Monthly total";

export type Entry = { id: string; spent_on: string; category: string; amount: number; note: string };
export type CategorySum = { fromEntries: number; typed: number; typedEntryId: string | null; total: number; count: number };

/** Per-category totals for a month: individual entries + the typed "Monthly total" entry. */
export function categorySums(entries: Entry[]): Record<MonthCategory, CategorySum> {
  const out = Object.fromEntries(MONTH_CATEGORIES.map(c => [c.id, { fromEntries: 0, typed: 0, typedEntryId: null, total: 0, count: 0 }])) as Record<MonthCategory, CategorySum>;
  for (const e of entries) {
    const key = (MONTH_CATEGORIES.some(c => c.id === e.category) ? e.category : null) as MonthCategory | null;
    if (!key) continue; // "savings" and "debt_repayment" aren't spending here (investing and EMIs have their own fields)
    const sum = out[key];
    if (e.note === MONTH_TOTAL_NOTE) { sum.typed += e.amount; sum.typedEntryId = e.id; }
    else { sum.fromEntries += e.amount; sum.count += 1; }
    sum.total = sum.fromEntries + sum.typed;
  }
  return out;
}

export const spendingTotal = (sums: Record<MonthCategory, CategorySum>) => MONTH_CATEGORIES.reduce((s, c) => s + sums[c.id].total, 0);

export type CategoryWrite = { category: MonthCategory; existingId: string | null; amount: number }; // amount 0 → delete

/**
 * What to write when someone types category totals. The typed number is the category's TOTAL;
 * the stored "Monthly total" entry is the part not already covered by individual entries.
 */
export function planCategoryWrites(sums: Record<MonthCategory, CategorySum>, typed: Partial<Record<MonthCategory, number | null>>): { writes: CategoryWrite[]; belowEntries: MonthCategory[] } {
  const writes: CategoryWrite[] = [];
  const belowEntries: MonthCategory[] = [];
  for (const c of MONTH_CATEGORIES) {
    const value = typed[c.id];
    if (value === undefined || value === null) continue;
    const sum = sums[c.id];
    if (value < sum.fromEntries) belowEntries.push(c.id);
    const remainder = Math.max(0, Math.round((value - sum.fromEntries) * 100) / 100);
    if (remainder === sum.typed) continue;
    writes.push({ category: c.id, existingId: sum.typedEntryId, amount: remainder });
  }
  return { writes, belowEntries };
}

export type MonthNumbers = { takeHome: number; salaryPf: number; salaryPension: number; spent: number; invested: number; emis: number };
export function monthSummary(n: MonthNumbers) {
  const fromSalary = n.salaryPf + n.salaryPension;
  const earned = n.takeHome + fromSalary;
  return { fromSalary, earned, leftInBank: n.takeHome - n.spent - n.invested - n.emis, savingsRate: earned > 0 ? ((earned - n.spent) / earned) * 100 : 0 };
}
