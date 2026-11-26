import assert from "node:assert/strict";
import test from "node:test";
import { getProgressSummary, monthStartOf, normalizeSnapshots } from "../lib/progress.ts";

const snap = (month_start, fire_portfolio, fire_progress, net_worth = fire_portfolio * 2, fire_score = 50) => ({ month_start, fire_portfolio, fire_progress, net_worth, fire_target: 10_000_000, fire_score, currency: "INR" });

test("progress summary compares first and latest month and finds the best month", () => {
  const summary = getProgressSummary([
    snap("2026-03-01", 1_200_000, 14, 2_400_000, 62),
    snap("2026-01-01", 1_000_000, 10, 2_000_000, 55),
    snap("2026-02-01", 1_050_000, 11, 2_100_000, 58),
  ]);
  assert.equal(summary.months, 2);
  assert.equal(summary.since, "2026-01-01");
  assert.equal(summary.progressGain, 4);
  assert.equal(summary.portfolioGain, 200_000);
  assert.equal(summary.netWorthGain, 400_000);
  assert.equal(summary.scoreGain, 7);
  assert.deepEqual(summary.bestMonth, { month: "2026-03-01", gain: 150_000 });
});

test("empty and single-month histories are handled", () => {
  assert.equal(getProgressSummary([]).months, 0);
  const one = getProgressSummary([snap("2026-11-01", 500_000, 5)]);
  assert.equal(one.months, 0);
  assert.equal(one.bestMonth, null);
  assert.equal(monthStartOf(new Date(2026, 10, 26)), "2026-11-01");
  assert.equal(normalizeSnapshots([{ month_start: "2026-02-01", net_worth: "10", fire_portfolio: "5", fire_target: "100", fire_progress: "5", fire_score: 40, currency: "AED" }, { month_start: "2026-01-01", net_worth: 1, fire_portfolio: 1, fire_target: 1, fire_progress: 1, fire_score: 1 }])[0].month_start, "2026-01-01");
});
