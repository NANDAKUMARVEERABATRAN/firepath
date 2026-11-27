import assert from "node:assert/strict";
import test from "node:test";
import { monthsToAutoFill, usualNumbers } from "../lib/autoFill.ts";

test("only past, unlogged months since the person started, at most 3", () => {
  assert.deepEqual(monthsToAutoFill(["2026-10-01"], "2026-12-01", "2026-08-01"), ["2026-09-01", "2026-11-01"]);
  assert.deepEqual(monthsToAutoFill([], "2026-12-01", "2026-11-01"), ["2026-11-01"]); // not before they joined
  assert.deepEqual(monthsToAutoFill(["2026-11-01"], "2026-12-01", "2026-11-01"), []); // the current month is theirs to log
  assert.equal(monthsToAutoFill([], "2027-03-01", "2025-01-01").length, 3);
});

test("usual numbers come from the last real month, else the profile", () => {
  const checkins = [
    { month_start: "2026-09-01", income: 100000, investment_income: 0, expenses: 60000, invested: 25000, debt_paid: 15000, salary_pf: 7000 },
    { month_start: "2026-10-01", income: 1, investment_income: 0, expenses: 1, invested: 1, debt_paid: 1, auto_filled: true },
  ];
  assert.equal(usualNumbers("2026-11-01", checkins, null).income, 100000); // auto-filled months aren't used as a source
  const profile = { income: 90000, investment_income: 0, expenses: 55000, invested: 20000, debt_paid: 0, salary_pf: 0, salary_pension: 0 };
  assert.equal(usualNumbers("2026-08-01", checkins, profile).expenses, 55000);
  assert.equal(usualNumbers("2026-08-01", [], { ...profile, income: 0 }), null);
});
