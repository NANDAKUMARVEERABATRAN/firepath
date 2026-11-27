import test from "node:test";
import assert from "node:assert/strict";
import { investingPerMonth, loggedExtraLastYear, yearlyExtraInvestment } from "../lib/extraInvesting.ts";
import { getFreedomMetrics } from "../lib/freedomPath.ts";
import { getFireScore, totalIncome } from "../lib/fireScore.ts";

const today = new Date("2026-11-27T00:00:00");
const checkins = [
  { month_start: "2026-11-01", extra_invested: 0 },
  { month_start: "2026-03-01", extra_invested: 200000 }, // bonus invested in March
  { month_start: "2025-11-01", extra_invested: 90000 },  // over a year ago: ignored
];

test("logged one-off investments count for the last 12 months only", () => {
  assert.equal(loggedExtraLastYear(checkins, today), 200000);
});

test("the profile amount wins; logged bonuses are the fallback", () => {
  assert.deepEqual(yearlyExtraInvestment(300000, checkins, today), { yearly: 300000, source: "profile" });
  assert.deepEqual(yearlyExtraInvestment(0, checkins, today), { yearly: 200000, source: "logged" });
  assert.deepEqual(yearlyExtraInvestment(0, [], today), { yearly: 0, source: null });
});

test("yearly extra is spread over 12 months", () => {
  assert.equal(investingPerMonth({ monthly_investment: 20000, yearly_extra_investment: 120000 }), 30000);
  assert.equal(investingPerMonth({ monthly_investment: 20000 }), 20000);
});

const profile = { age: 30, monthly_income: 100000, monthly_expenses: 50000, assets: 1000000, investableAssets: 1000000, liabilities: 0, emergency_fund: 300000, monthly_investment: 30000, has_health_insurance: true, has_term_insurance: true, currency: "INR" };

test("investing a bonus brings the FIRE date closer", () => {
  const without = getFreedomMetrics(profile);
  const withBonus = getFreedomMetrics({ ...profile, yearly_extra_investment: 240000 });
  assert.ok(withBonus.yearsToFire < without.yearsToFire);
});

test("the invested bonus counts as income too, so the savings rate stays honest", () => {
  assert.equal(totalIncome({ monthly_income: 100000, yearly_extra_investment: 120000 }), 110000);
  const rate = getFireScore({ ...profile, yearly_extra_investment: 120000 }).savingsRate;
  assert.ok(Math.abs(rate - ((110000 - 50000) / 110000) * 100) < 0.01);
});
