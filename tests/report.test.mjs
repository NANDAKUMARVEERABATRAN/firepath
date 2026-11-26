import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyReport } from "../lib/report.ts";

const snap = (month_start, fire_progress, fire_portfolio) => ({ month_start, fire_progress, fire_portfolio, fire_target: 1e7, net_worth: fire_portfolio * 2, fire_score: 60, currency: "INR" });
const checkin = (month_start, income, expenses, invested) => ({ month_start, income, investment_income: 0, expenses, invested, debt_paid: 0 });

test("report compares this month with last month and celebrates progress", () => {
  const report = buildMonthlyReport({
    today: new Date(2026, 10, 3),
    snapshots: [snap("2026-10-01", 9, 900_000), snap("2026-11-01", 10.5, 1_050_000)],
    checkins: [checkin("2026-10-01", 100_000, 70_000, 15_000), checkin("2026-11-01", 100_000, 60_000, 25_000)],
    lessons: [{ lesson_id: "a", answered_correctly: true, completed_at: "2026-11-02T10:00:00Z" }, { lesson_id: "b", answered_correctly: true, completed_at: "2026-10-20T10:00:00Z" }],
  });
  assert.equal(report.progressChange, 1.5);
  assert.equal(report.portfolioChange, 150_000);
  assert.equal(report.checkin.savingsRate, 40);
  assert.equal(report.checkin.investRate, 25);
  assert.equal(report.previousCheckin.savingsRate, 30);
  assert.equal(report.lessonsThisMonth, 1);
  assert.equal(report.loggedThisMonth, true);
  assert.equal(report.verdict.emoji, "🚀");
});

test("report stays encouraging on a dip and with no data", () => {
  const dip = buildMonthlyReport({ today: new Date(2026, 10, 3), snapshots: [snap("2026-10-01", 10, 1_000_000), snap("2026-11-01", 9, 900_000)], checkins: [], lessons: [] });
  assert.equal(dip.verdict.emoji, "🌧️");
  const empty = buildMonthlyReport({ snapshots: [], checkins: [], lessons: [] });
  assert.equal(empty.progressChange, null);
  assert.equal(empty.checkin, null);
  assert.equal(empty.verdict.emoji, "👋");
});
