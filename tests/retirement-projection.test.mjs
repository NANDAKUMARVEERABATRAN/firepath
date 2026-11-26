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
