import assert from "node:assert/strict";
import test from "node:test";
import { categorySums, monthSummary, MONTH_TOTAL_NOTE, planCategoryWrites, spendingTotal } from "../lib/monthLog.ts";

const entries = [
  { id: "a", spent_on: "2026-11-03", category: "dining", amount: 1800, note: "Swiggy" },
  { id: "b", spent_on: "2026-11-10", category: "dining", amount: 1200, note: "Zomato" },
  { id: "c", spent_on: "2026-11-01", category: "dining", amount: 3000, note: MONTH_TOTAL_NOTE },
  { id: "d", spent_on: "2026-11-01", category: "housing", amount: 25000, note: "Rent" },
  { id: "e", spent_on: "2026-11-05", category: "debt_repayment", amount: 15000, note: "Car EMI" }, // not spending here
  { id: "f", spent_on: "2026-11-05", category: "savings", amount: 5000, note: "" },
];

test("category totals = individual entries + typed monthly total; EMIs/savings excluded", () => {
  const sums = categorySums(entries);
  assert.deepEqual(sums.dining, { fromEntries: 3000, typed: 3000, typedEntryId: "c", total: 6000, count: 2 });
  assert.equal(sums.housing.total, 25000);
  assert.equal(spendingTotal(sums), 31000);
});

test("typing a category total stores only the difference, never double-counting", () => {
  const sums = categorySums(entries);
  const { writes, belowEntries } = planCategoryWrites(sums, { dining: 8000, housing: 25000, groceries: 6000, transport: null });
  assert.deepEqual(writes, [
    { category: "groceries", existingId: null, amount: 6000 }, // new
    { category: "dining", existingId: "c", amount: 5000 }, // 8000 − 3000 from entries
  ].sort((x, y) => ["housing", "groceries", "utilities", "transport", "dining"].indexOf(x.category) - ["housing", "groceries", "utilities", "transport", "dining"].indexOf(y.category)));
  assert.deepEqual(belowEntries, []);
  // Typing less than the entries already add up to: remove the typed part and flag it.
  const lower = planCategoryWrites(sums, { dining: 2000 });
  assert.deepEqual(lower.writes, [{ category: "dining", existingId: "c", amount: 0 }]);
  assert.deepEqual(lower.belowEntries, ["dining"]);
});

test("month summary uses the same definitions as the rest of the app", () => {
  const s = monthSummary({ takeHome: 90000, salaryPf: 7000, salaryPension: 3000, spent: 50000, invested: 20000, emis: 10000 });
  assert.equal(s.earned, 100000);
  assert.equal(s.leftInBank, 10000);
  assert.equal(s.savingsRate, 50);
});
