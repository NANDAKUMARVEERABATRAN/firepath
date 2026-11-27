import assert from "node:assert/strict";
import test from "node:test";
import { simulateDrawdown, sustainableWithdrawalRate } from "../lib/retirementDrawdown.ts";

test("withdrawals rise with inflation every year after retiring", () => {
  const sim = simulateDrawdown({ retireAge: 40, corpus: 30300000, firstYearExpenses: 88373 * 12, inflationPercent: 6, returnPercent: 9, yearsFromToday: 3 });
  assert.equal(Math.round(sim.years[0].monthlyWithdrawal), 88373);
  assert.equal(Math.round(sim.years[1].monthlyWithdrawal), Math.round(88373 * 1.06));
  assert.equal(Math.round(sim.years[10].monthlyWithdrawal), Math.round(88373 * Math.pow(1.06, 10)));
});

test("a 3.5% withdrawal lasts to 100 with returns ~3% above inflation; a 6% withdrawal runs out", () => {
  const ok = simulateDrawdown({ retireAge: 40, corpus: 100, firstYearExpenses: 3.5, inflationPercent: 6, returnPercent: 9.5, yearsFromToday: 0 });
  assert.equal(ok.runsOutAt, null);
  const short = simulateDrawdown({ retireAge: 40, corpus: 100, firstYearExpenses: 6, inflationPercent: 6, returnPercent: 9.5, yearsFromToday: 0 });
  assert.ok(short.runsOutAt !== null && short.runsOutAt > 50 && short.runsOutAt < 80, `runs out at ${short.runsOutAt}`);
});

test("sustainable withdrawal rate for 60 years at ~3% real return is a little under 4%", () => {
  const rate = sustainableWithdrawalRate({ retireAge: 40, inflationPercent: 6, returnPercent: 9 });
  assert.ok(rate > 3 && rate < 4, `rate ${rate}`);
});

import { corpusNeeded } from "../lib/retirementDrawdown.ts";
test("income after FIRE (Barista) lowers withdrawals and the money you need", () => {
  const base = { retireAge: 40, firstYearExpenses: 83371 * 12, inflationPercent: 6, returnPercent: 9, yearsFromToday: 3 };
  const withIncome = simulateDrawdown({ ...base, corpus: 28600000, incomeToday: 25000, incomeYears: 10 });
  assert.equal(Math.round(withIncome.years[0].monthlyIncome), Math.round(25000 * Math.pow(1.06, 3)));
  assert.equal(Math.round(withIncome.years[0].monthlyWithdrawal), Math.round(83371 - 25000 * Math.pow(1.06, 3)));
  assert.equal(withIncome.years[10].monthlyIncome, 0); // income stops after 10 years
  const full = corpusNeeded(base), barista = corpusNeeded({ ...base, incomeToday: 25000, incomeYears: 10 });
  assert.ok(barista < full * 0.92 && barista > full * 0.8, `barista ${barista} vs full ${full}`); // ~11% less: income for 10 of 60 years
  assert.equal(simulateDrawdown({ ...base, corpus: full }).runsOutAt, null);
});
