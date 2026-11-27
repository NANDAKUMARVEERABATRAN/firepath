import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_TAX_INPUTS, newRegimeTax, oldRegimeTax, compareRegimes, oldRegimeOpportunities, breakEvenExtraDeductions, ltcgHarvest, hraExemption, financialYear } from "../lib/tax.ts";

const salary = (n, extra = {}) => ({ ...EMPTY_TAX_INPUTS, salary: n, ...extra });

test("new regime: ₹15 lakh salary pays ₹97,500", () => {
  assert.equal(newRegimeTax(salary(1500000)).total, 97500);
});

test("new regime: ₹12.75 lakh salary pays nothing (87A rebate)", () => {
  assert.equal(newRegimeTax(salary(1275000)).total, 0);
});

test("new regime: marginal relief just above ₹12 lakh taxable", () => {
  assert.equal(newRegimeTax(salary(1285000)).total, 10400);
});

test("old regime: ₹15 lakh with full 80C and ₹25k 80D pays ₹2,02,800", () => {
  assert.equal(oldRegimeTax(salary(1500000, { sec80C: 150000, sec80DSelf: 25000 })).total, 202800);
});

test("old regime: 80C is capped at ₹1.5 lakh", () => {
  assert.equal(oldRegimeTax(salary(1500000, { sec80C: 400000 })).total, oldRegimeTax(salary(1500000, { sec80C: 150000 })).total);
});

test("HRA exemption is the least of the three rules", () => {
  // basic 6L, HRA 3L, rent 3.6L, metro: min(3L, 3.6L-0.6L=3L, 3L) = 3L
  assert.equal(hraExemption(salary(1200000, { basic: 600000, hraReceived: 300000, rentPaid: 360000, metro: true })), 300000);
  // non-metro: 40% of basic = 2.4L
  assert.equal(hraExemption(salary(1200000, { basic: 600000, hraReceived: 300000, rentPaid: 360000, metro: false })), 240000);
  assert.equal(hraExemption(salary(1200000, { basic: 600000, hraReceived: 300000 })), 0);
});

test("compare picks the cheaper regime", () => {
  const c = compareRegimes(salary(1500000));
  assert.equal(c.better, "new");
  assert.ok(c.saving > 0);
  // big HRA + home loan + all deductions on ₹25 lakh can make old win
  const heavy = compareRegimes(salary(2500000, { basic: 1250000, hraReceived: 600000, rentPaid: 720000, sec80C: 150000, sec80DSelf: 25000, sec80DParents: 50000, parentsSenior: true, nps80CCD1B: 50000, homeLoanInterest: 200000 }));
  assert.equal(heavy.better, "old");
});

test("unused deductions show what they would save in the old regime", () => {
  const ops = oldRegimeOpportunities(salary(1500000));
  const c = ops.find(o => o.key === "sec80C");
  assert.equal(c.room, 150000);
  assert.equal(c.saves, 46800); // 30% slab + 4% cess
});

test("break-even extra deductions make the old regime match the new one", () => {
  const i = salary(1500000);
  const extra = breakEvenExtraDeductions(i);
  assert.ok(extra > 0);
  assert.equal(breakEvenExtraDeductions(salary(2500000, { basic: 1250000, hraReceived: 600000, rentPaid: 720000, sec80C: 150000, sec80DSelf: 25000, sec80DParents: 50000, parentsSenior: true, nps80CCD1B: 50000, homeLoanInterest: 200000 })), 0);
});

test("surcharge applies above ₹50 lakh with marginal relief", () => {
  const just = newRegimeTax(salary(5000000 + 75000)).total;
  const above = newRegimeTax(salary(5010000 + 75000)).total;
  assert.ok(above - just <= 10000 * 1.04 + 1, "extra tax can't exceed the extra income");
});

test("LTCG harvesting: ₹1.25 lakh a year is tax-free", () => {
  assert.deepEqual(ltcgHarvest(300000, 0), { room: 125000, harvest: 125000, taxSavedLater: 16250, taxDueNow: 0 });
  assert.equal(ltcgHarvest(300000, 100000).harvest, 25000);
  assert.equal(ltcgHarvest(50000, 0).harvest, 50000);
  assert.equal(ltcgHarvest(0, 200000).taxDueNow, 9750);
});

test("financial year label", () => {
  assert.equal(financialYear(new Date("2026-11-27")), "FY 2026-27");
  assert.equal(financialYear(new Date("2027-02-10")), "FY 2026-27");
  assert.equal(financialYear(new Date("2027-04-01")), "FY 2027-28");
});
