import test from "node:test";
import assert from "node:assert/strict";
import { parseBudgetCsv, transactionFingerprint } from "../lib/budgetCsv.ts";
import { createGuidedTargets, getBudgetReview } from "../lib/budgetGuide.ts";

test("CSV import reads quoted notes, INR amounts, and India category aliases", () => {
  const result = parseBudgetCsv('date,category,amount,note\n2026-11-02,groceries,"₹1,250.50","Market, weekly"\n2026-11-03,bijli,850,Power');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].amount, 1250.5);
  assert.equal(result.rows[0].note, "Market, weekly");
  assert.equal(result.rows[1].category, "utilities");
  assert.equal(result.errors.length, 0);
});

test("CSV import reports invalid records and flags unknown categories for review", () => {
  const result = parseBudgetCsv("date,category,amount\n2026-02-30,groceries,40\n2026-02-01,unknown,40\n2026-02-02,food,40\n2026-02-03,food,0");
  assert.equal(result.errors.length, 2);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map(row => [row.category, row.needsCategory]), [["other", true], ["groceries", false]]);
});

test("transaction fingerprint identifies exact duplicates", () => {
  assert.equal(transactionFingerprint({ spent_on: "2026-01-01", category: "groceries", amount: 25, note: "Milk" }), transactionFingerprint({ spent_on: "2026-01-01", category: "groceries", amount: 25, note: " milk " }));
});

test("guided budget allocates fixed commitments, savings, and leaves a flexible remainder", () => {
  const result = createGuidedTargets({ income: 100000, savingsGoalPercent: 20, commitments: { housing: 25000, utilities: 5000, debt_repayment: 10000 } });
  assert.equal(result.targets.savings, 20000);
  assert.equal(result.targets.other, 40000);
  assert.equal(result.remainder, 40000);
});

test("guided budget rejects commitments above income", () => {
  assert.throws(() => createGuidedTargets({ income: 10000, savingsGoalPercent: 20, commitments: { housing: 10000 } }), /higher than your take-home income/);
});

test("monthly review connects category overruns with check-in savings rate", () => {
  const insights = getBudgetReview({ targets: { groceries: 5000 }, spent: { groceries: 6500 }, income: 50000, expenses: 30000, invested: 10000 });
  assert.match(insights[0], /groceries is 1,500 over its target/);
  assert.match(insights[1], /40% left after expenses and 20% invested/);
});
