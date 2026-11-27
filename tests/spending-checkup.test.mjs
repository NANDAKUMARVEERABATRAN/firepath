import assert from "node:assert/strict";
import test from "node:test";
import { daysSince, spendingCheckup } from "../lib/spendingCheckup.ts";

const base = {
  thisMonth: { housing: 30000, groceries: 9600, dining: 9000, personal: 4000, transport: 3000 },
  previous: [{ dining: 6500, personal: 4200, housing: 25000 }, { dining: 5500, personal: 3800 }],
  limits: { groceries: 8000, dining: 10000 },
  earned: 100000,
  valued: [],
};

test("check-up finds the biggest savings from the person's own numbers", () => {
  const items = spendingCheckup(base);
  assert.deepEqual(items.map(i => [i.category, i.kind, i.monthlySaving]), [
    ["dining", "rising", 3000], // usual ₹6,000 → ₹9,000 (beats the 8%-of-income guide: ₹1,000)
    ["groceries", "over_limit", 1600], // a need: flagged only because it's over the person's own limit
  ]);
  assert.equal(items[0].yearlySaving, 36000);
});

test("needs are never flagged for rising or share, and valued categories are never flagged", () => {
  // Housing rose ₹5,000 but it's a need without a limit: not flagged.
  assert.ok(!spendingCheckup(base).some(i => i.category === "housing"));
  const valued = spendingCheckup({ ...base, valued: ["dining"] });
  assert.ok(!valued.some(i => i.category === "dining"));
  assert.deepEqual(spendingCheckup({ ...base, thisMonth: { dining: 6100 } }), []); // within usual range and under the guide
});

test("days since an update", () => {
  assert.equal(daysSince("2026-08-01T00:00:00Z", new Date("2026-11-01T00:00:00Z")), 92);
  assert.equal(daysSince(null), null);
});
