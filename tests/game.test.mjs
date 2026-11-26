import assert from "node:assert/strict";
import test from "node:test";
import { coastFireNumber, getCurrentLevel, getFreedomMetrics, getFreedomPath, getRank, getXp, RANKS, yearsToTarget } from "../lib/freedomPath.ts";
import { analyzeGoal, monthsBetween } from "../lib/goals.ts";
import { getLessonOfDay, lessons } from "../lib/wisdom.ts";

const profile = (overrides = {}) => ({
  age: 30, monthly_income: 100_000, monthly_expenses: 50_000, assets: 1_000_000, investableAssets: 600_000,
  liabilities: 0, emergency_fund: 300_000, monthly_investment: 25_000,
  has_health_insurance: true, has_term_insurance: false, has_dependents: false, health_cover_amount: 500_000, term_cover_amount: 0,
  currency: "INR", highInterestDebt: 0, withdrawal_rate: 4, ...overrides,
});

test("freedom path has 10 ordered levels and finds the first uncleared one", () => {
  const path = getFreedomPath(profile());
  assert.equal(path.length, 10);
  assert.deepEqual(path.map(level => level.level), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(path.slice(0, 7).every(level => level.cleared), "basics through pay-yourself-first should be cleared");
  assert.equal(getCurrentLevel(path)?.id, "coast");
});

test("high-interest debt blocks the debt level, and missing data starts at level 1", () => {
  assert.equal(getFreedomPath(profile({ highInterestDebt: 200_000 })).find(level => level.id === "bad-debt")?.cleared, false);
  const empty = getFreedomPath(profile({ age: null, monthly_income: 0, monthly_expenses: 0, investableAssets: 0, emergency_fund: 0, monthly_investment: 0 }));
  assert.equal(getCurrentLevel(empty)?.level, 1);
  assert.ok(empty.every(level => level.progress >= 0 && level.progress <= 1));
});

test("years to target and coast number behave sensibly", () => {
  assert.equal(yearsToTarget(100, 0, 50, 5), 0);
  assert.equal(yearsToTarget(0, 0, 1000, 5), null);
  const years = yearsToTarget(0, 1000, 12_000, 0);
  assert.equal(years, 1);
  assert.ok(Math.abs(coastFireNumber(1000, 10, 0) - 1000) < 1e-9);
  assert.ok(coastFireNumber(1000, 10, 7) < 1000);
});

test("freedom metrics report months of freedom and a positive boost", () => {
  const metrics = getFreedomMetrics(profile(), { expectedReturn: 10, inflation: 6 });
  assert.equal(metrics.freedomMonths, 12);
  assert.equal(metrics.fireTarget, 50_000 * 12 / 0.04);
  assert.ok(metrics.yearsToFire !== null && metrics.yearsToFire > 0);
  assert.equal(metrics.boostAmount, 10_000);
  assert.ok((metrics.yearsSavedByBoost ?? 0) > 0);
});

test("XP totals and ranks progress monotonically", () => {
  const { total } = getXp({ levelsCleared: 2, badgesEarned: 3, checkins: 1, investmentStreak: 1, lessonsCompleted: 1, lessonsCorrect: 1, goalsCreated: 1, goalsCompleted: 0, goalProgressPercent: 10 });
  assert.equal(total, 500 + 300 + 60 + 40 + 50 + 50 + 30);
  assert.equal(getRank(0).name, RANKS[0].name);
  assert.equal(getRank(RANKS[3].xp).rankNumber, 4);
  assert.equal(getRank(999_999).next, null);
  assert.ok(getRank(150).progress > 0 && getRank(150).progress < 1);
});

test("goal analysis inflates the target and computes required monthly investment", () => {
  const today = new Date(2026, 0, 15);
  assert.equal(monthsBetween(today, "2028-01-01"), 24);
  const goal = { id: "g", name: "Home", category: "home", target_amount: 1_200_000, target_date: "2028-01-01", saved_amount: 0, monthly_contribution: 0, expected_return: 0, inflation_rate: 0, completed_at: null };
  const plain = analyzeGoal(goal, today);
  assert.equal(plain.futureTarget, 1_200_000);
  assert.equal(plain.requiredMonthly, 50_000);
  assert.equal(plain.status, "behind");
  assert.equal(analyzeGoal({ ...goal, monthly_contribution: 50_000 }, today).status, "on-track");
  assert.equal(analyzeGoal({ ...goal, saved_amount: 1_300_000 }, today).status, "achieved");
  // The target is entered as the future cost, so it is used as-is (no inflation applied on top).
  assert.equal(analyzeGoal({ ...goal, inflation_rate: 6 }, today).futureTarget, 1_200_000);
  assert.equal(analyzeGoal({ ...goal, target_date: "2025-01-01" }, today).status, "overdue");
});

test("daily lessons are valid and skip completed ones", () => {
  const ids = new Set(lessons.map(lesson => lesson.id));
  assert.equal(ids.size, lessons.length);
  for (const lesson of lessons) assert.ok(lesson.answer >= 0 && lesson.answer < lesson.options.length, lesson.id);
  const day = new Date(2026, 10, 25);
  const first = getLessonOfDay(day);
  assert.notEqual(getLessonOfDay(day, [first.id]).id, first.id);
  assert.ok(getLessonOfDay(day, lessons.map(lesson => lesson.id)));
});
