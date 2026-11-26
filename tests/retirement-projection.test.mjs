import test from "node:test";
import assert from "node:assert/strict";
import { projectRetirementAssets, sumLaterAssets } from "../lib/retirementProjection.ts";

test("later retirement assets join the FIRE projection only at their estimated access age", () => {
  const base = { age: 40, accessibleAssets: 100000, monthlyContribution: 0, annualGrowthPercent: 0, laterAssets: [{ value: 50000, availableFromAge: 58 }] };
  assert.equal(projectRetirementAssets({ ...base, year: 17 }), 100000);
  assert.equal(projectRetirementAssets({ ...base, year: 18 }), 150000);
});

test("assets with unknown access ages stay outside the projection", () => {
  const result = projectRetirementAssets({ age: 40, year: 20, accessibleAssets: 100000, monthlyContribution: 0, annualGrowthPercent: 0, laterAssets: [{ value: 50000, availableFromAge: null }] });
  assert.equal(result, 100000);
});

test("later asset summary separates known and unknown access ages", () => {
  assert.deepEqual(sumLaterAssets([{ value: 10, availableFromAge: 58 }, { value: 5, availableFromAge: null }]), { total: 15, scheduled: 10, accessAgeUnknown: 5 });
});

import { projectBreakdown } from "../lib/retirementProjection.ts";
test("projection breakdown parts add up to the total", () => {
  const parts = projectBreakdown({ age: 37, year: 3, accessibleAssets: 13000000, monthlyContribution: 100000, annualGrowthPercent: 10, laterAssets: [{ value: 3000000, availableFromAge: 40 }, { value: 500000, availableFromAge: 58 }] });
  assert.ok(Math.abs(parts.grown + parts.contributions + parts.unlocked - parts.total) < 1);
  assert.equal(parts.contributed, 3600000);
  assert.ok(Math.abs(parts.unlocked - 3000000 * 1.331) < 1); // only the lot accessible by 40
});
