import assert from "node:assert/strict";
import test from "node:test";
import { cutImpact, cutNeededForRate, findOverspending, getLeaks, getNextTier, getSavingsTier, idleMoney, savingsRate, yearsFromSavingsRate } from "../lib/savingsCoach.ts";

test("savings rate and tiers", () => {
  assert.equal(savingsRate(100000, 92000), 8);
  assert.equal(savingsRate(0, 1000), null);
  assert.equal(getSavingsTier(8).id, "danger");
  assert.equal(getSavingsTier(-5).id, "negative");
  assert.equal(getSavingsTier(20).id, "steady");
  assert.equal(getSavingsTier(55).id, "fire");
  assert.equal(getNextTier(8).id, "starter");
  assert.equal(getNextTier(60), null);
});

test("years to freedom from savings rate matches the classic table (5% real, 4% withdrawal)", () => {
  const at10 = yearsFromSavingsRate(10, 5, 4);
  const at50 = yearsFromSavingsRate(50, 5, 4);
  assert.ok(at10 > 48 && at10 < 54, `10% → ${at10}`);
  assert.ok(at50 > 15 && at50 < 18.5, `50% → ${at50}`);
  assert.equal(yearsFromSavingsRate(0, 5, 4), null);
  assert.equal(yearsFromSavingsRate(100, 5, 4), 0);
  // Higher savings rate always means sooner freedom.
  assert.ok(yearsFromSavingsRate(30, 4, 3.5) < yearsFromSavingsRate(20, 4, 3.5));
});

test("a spending cut helps twice: smaller FIRE number and more invested", () => {
  const impact = cutImpact({ accessible: 500000, monthlyInvestment: 10000, monthlyExpenses: 60000, monthlyCut: 5000, realReturnPercent: 4, withdrawalRatePercent: 3.5 });
  assert.equal(impact.yearlyCut, 60000);
  assert.ok(Math.abs(impact.targetDrop - (5000 * 12) / 0.035) < 1);
  assert.ok(impact.yearsSooner > 0);
  assert.ok(impact.valueIn10Years > 5000 * 120); // growth on top of the money saved
  // A cut can never exceed expenses.
  assert.equal(cutImpact({ accessible: 0, monthlyInvestment: 0, monthlyExpenses: 1000, monthlyCut: 5000, realReturnPercent: 4, withdrawalRatePercent: 4 }).monthlyCut, 1000);
});

test("cut needed for a target rate, idle money and overspending", () => {
  assert.equal(cutNeededForRate(100000, 92000, 20), 12000);
  assert.equal(cutNeededForRate(100000, 70000, 20), 0);
  assert.equal(idleMoney(100000, 70000, 10000), 20000);
  assert.equal(idleMoney(100000, 95000, 10000), 0);
  const over = findOverspending({ dining: 15000, personal: 5000 }, 100000);
  assert.equal(over[0].category, "dining");
  assert.equal(over[0].excess, 7000);
  assert.equal(over.length, 1);
});

test("leak lists exist for both countries with unique ids", () => {
  for (const code of ["IN", "AE"]) {
    const leaks = getLeaks(code);
    assert.ok(leaks.length >= 8);
    assert.equal(new Set(leaks.map(leak => leak.id)).size, leaks.length);
  }
});
