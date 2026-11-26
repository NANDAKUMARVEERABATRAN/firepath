import assert from "node:assert/strict";
import test from "node:test";
import { getBadges, getFireScore, getInvestmentStreak } from "../lib/fireScore.ts";

const profile = (overrides = {}) => ({
  age: 35,
  monthly_income: 100_000,
  monthly_expenses: 60_000,
  assets: 2_000_000,
  fire_accessible_assets: 1_500_000,
  later_retirement_assets: 500_000,
  liabilities: 100_000,
  emergency_fund: 360_000,
  monthly_investment: 20_000,
  has_health_insurance: true,
  has_term_insurance: true,
  has_dependents: false,
  health_cover_amount: 1_000_000,
  term_cover_amount: 10_000_000,
  currency: "INR",
  ...overrides,
});

test("FIRE score uses accessible assets separately from overall net worth", () => {
  const result = getFireScore(profile());

  assert.equal(result.netWorth, 1_900_000);
  assert.equal(result.savingsRate, 40);
  assert.equal(result.emergencyMonths, 6);
  assert.equal(result.fireTarget, 60_000 * 12 / 0.035);
  assert.ok(Math.abs(result.fireProgress - 7.2916666667) < 0.000001);
  assert.equal(result.categories.find(({ name }) => name === "Emergency buffer")?.score, 20);
  assert.equal(result.categories.find(({ name }) => name === "Spending & saving")?.score, 20);
  assert.equal(result.categories.find(({ name }) => name === "Regular investing")?.score, 20);
});

test("score remains finite for zero income and zero expenses", () => {
  const result = getFireScore(profile({
    monthly_income: 0,
    monthly_expenses: 0,
    monthly_investment: 25_000,
    emergency_fund: 10_000,
  }));

  assert.equal(result.savingsRate, 0);
  assert.equal(result.emergencyMonths, 0);
  assert.equal(result.fireTarget, 0);
  assert.equal(result.fireProgress, 0);
  assert.ok(Number.isFinite(result.score));
});

test("badge thresholds respond to profile milestones", () => {
  const badges = getBadges(profile(), 3);
  const byName = new Map(badges.map(({ name, earned }) => [name, earned]));

  assert.equal(byName.get("Money Map Maker"), true);
  assert.equal(byName.get("Resilience Builder"), true);
  assert.equal(byName.get("Consistency Champion"), true);
  assert.equal(byName.get("Debt Tamer"), false);
});

test("investment streak counts consecutive recent months and resets across gaps", () => {
  const now = new Date();
  const month = (offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  };

  assert.equal(getInvestmentStreak([
    { month_start: month(0), invested: 1 },
    { month_start: month(-1), invested: 1 },
    { month_start: month(-2), invested: 1 },
  ]), 3);
  assert.equal(getInvestmentStreak([
    { month_start: month(0), invested: 1 },
    { month_start: month(-2), invested: 1 },
  ]), 1);
  assert.equal(getInvestmentStreak([{ month_start: month(-3), invested: 1 }]), 0);
});
