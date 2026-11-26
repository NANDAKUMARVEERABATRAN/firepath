import assert from "node:assert/strict";
import test from "node:test";
import { getFireScore, totalIncome } from "../lib/fireScore.ts";

const base = { age: 30, monthly_income: 90000, monthly_expenses: 63000, assets: 0, liabilities: 0, emergency_fund: 0, monthly_investment: 10000, has_health_insurance: false, has_term_insurance: false, currency: "INR" };

test("EPF/NPS deducted from salary count as income and saving, without double counting", () => {
  assert.equal(totalIncome({ monthly_income: 90000, monthly_salary_savings: 10000 }), 100000);
  assert.equal(totalIncome({ monthly_income: 90000 }), 90000);
  const without = getFireScore(base);
  const withSalary = getFireScore({ ...base, monthly_salary_savings: 10000 });
  assert.equal(Math.round(without.savingsRate), 30); // (90k − 63k) / 90k
  assert.equal(Math.round(withSalary.savingsRate), 37); // (100k − 63k) / 100k
  // Regular investing now includes salary deductions: (10k + 10k) / 100k = 20% → full 20 points
  assert.equal(withSalary.categories.find(c => c.name === "Regular investing").score, 20);
});

test("the FIRE target depends only on spending, not on salary deductions", () => {
  assert.equal(getFireScore({ ...base, monthly_salary_savings: 10000 }).fireTarget, getFireScore(base).fireTarget);
});
