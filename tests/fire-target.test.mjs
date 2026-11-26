import assert from "node:assert/strict";
import test from "node:test";
import { getFireScore, targetExpenses } from "../lib/fireScore.ts";
import { inFutureMoney, inTodayMoney } from "../lib/inflation.ts";

const base = { age: 37, monthly_income: 150000, monthly_expenses: 70000, assets: 0, liabilities: 0, emergency_fund: 0, monthly_investment: 0, has_health_insurance: false, has_term_insurance: false, currency: "INR", withdrawal_rate: 3.5 };

test("today's money and future money are the same goal", () => {
  const today = 70000 * 12 / 0.035; // ₹2.4 Cr
  const future = inFutureMoney(today, 6, 3);
  assert.ok(Math.abs(future - 28584384) < 1); // ≈ ₹2.86 Cr in 3 years at 6% inflation
  assert.ok(Math.abs(inTodayMoney(future, 6, 3) - today) < 0.01);
});

test("planned retirement spending replaces today's spending in the FIRE target", () => {
  assert.equal(targetExpenses(base), 70000);
  assert.equal(targetExpenses({ ...base, retirement_expenses: 50000 }), 50000);
  assert.equal(targetExpenses({ ...base, retirement_expenses: null }), 70000);
  assert.equal(Math.round(getFireScore({ ...base, retirement_expenses: 50000 }).fireTarget), Math.round(50000 * 12 / 0.035));
  // The emergency buffer still uses today's spending.
  assert.equal(getFireScore({ ...base, emergency_fund: 140000, retirement_expenses: 50000 }).emergencyMonths, 2);
});

test("a half-logged month can't shrink the FIRE number: it uses steady profile spending", () => {
  // Check-ins averaged to ₹44k, but the profile says ₹70k a month.
  const p = { ...base, monthly_expenses: 44000, lifestyle_expenses: 70000, emergency_fund: 420000 };
  assert.equal(Math.round(getFireScore(p).fireTarget), Math.round(70000 * 12 / 0.035)); // ₹2.4 crore today
  assert.equal(getFireScore(p).emergencyMonths, 6); // 4.2 lakh ÷ 70k
  // Savings rate still reflects what was actually logged.
  assert.equal(Math.round(getFireScore(p).savingsRate), Math.round((150000 - 44000) / 150000 * 100));
  // Planned retirement spending still wins when set.
  assert.equal(targetExpenses({ ...p, retirement_expenses: 90000 }), 90000);
});
