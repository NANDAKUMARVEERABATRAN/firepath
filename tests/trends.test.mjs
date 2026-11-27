import assert from "node:assert/strict";
import test from "node:test";
import { categoryTotals, highlights, monthlyRows, niceMax, shortMoney, yearlyRows } from "../lib/trends.ts";

const checkins = [
  { month_start: "2026-10-01", income: 90000, expenses: 50000, invested: 20000, debt_paid: 10000, salary_pf: 7000, salary_pension: 3000 },
  { month_start: "2025-12-01", income: 80000, expenses: 70000, invested: 15000, debt_paid: 5000 }, // overspent by 10k
  { month_start: "2026-11-01", income: 90000, expenses: 45000, invested: 25000, debt_paid: 10000, salary_pf: 7000, salary_pension: 3000 },
];

test("monthly rows: earned includes EPF/NPS, left-over never negative, overspend tracked", () => {
  const rows = monthlyRows(checkins);
  assert.deepEqual(rows.map(r => r.key), ["2025-12", "2026-10", "2026-11"]);
  assert.equal(rows[0].label, "Dec 25");
  const oct = rows[1];
  assert.equal(oct.earned, 100000);
  assert.equal(oct.left, 10000); // 90k − 50k − 10k − 20k
  assert.equal(oct.savingsRate, 50); // (100k − 50k) / 100k
  assert.equal(rows[0].left, 0);
  assert.equal(rows[0].overspent, 10000);
});

test("yearly rows recompute the savings rate on totals", () => {
  const years = yearlyRows(monthlyRows(checkins));
  assert.deepEqual(years.map(y => y.key), ["2025", "2026"]);
  assert.equal(years[1].label, "2026 (2 mo)");
  assert.equal(years[1].earned, 200000);
  assert.equal(years[1].savingsRate, 52.5); // (200k − 95k) / 200k
});

test("highlights: best month, streak and totals", () => {
  const h = highlights(monthlyRows(checkins));
  assert.equal(h.best.key, "2026-11");
  assert.equal(h.streak, 3);
  assert.equal(h.totalInvested, 15000 + 30000 + 35000);
  assert.equal(h.change, null); // needs 6 months
});

test("category totals compare with the previous period and skip savings", () => {
  const entries = [
    { month_start: "2026-11-01", category: "dining", amount: 6000 },
    { month_start: "2026-10-01", category: "dining", amount: 4000 },
    { month_start: "2026-09-01", category: "dining", amount: 5000 },
    { month_start: "2026-11-01", category: "savings", amount: 9999 },
  ];
  const totals = categoryTotals(entries, "2026-10-01", "2026-11-01", "2026-08-01");
  assert.equal(totals.length, 1);
  assert.equal(totals[0].total, 10000);
  assert.equal(totals[0].previous, 5000);
  assert.equal(totals[0].change, 100);
});

test("axis helpers", () => {
  assert.equal(shortMoney(45000), "₹45,000");
  assert.equal(shortMoney(150000), "₹1.5 lakh");
  assert.equal(shortMoney(23000000), "₹2.3 crore");
  assert.equal(niceMax(87000), 100000);
  assert.equal(niceMax(230000), 250000);
});

import { growth, wealthRows } from "../lib/trends.ts";
test("wealth over time: monthly points, quarterly = latest balance in each quarter, growth per month", () => {
  const snaps = [
    { month_start: "2026-01-01", net_worth: 30000000, fire_portfolio: 9000000, fire_target: 24000000 },
    { month_start: "2026-02-01", net_worth: 30500000, fire_portfolio: 9300000, fire_target: 24000000 },
    { month_start: "2026-03-01", net_worth: 31000000, fire_portfolio: 9600000, fire_target: 24100000 },
    { month_start: "2026-05-01", net_worth: 32000000, fire_portfolio: 10300000, fire_target: 24200000 },
  ];
  const monthly = wealthRows(snaps, "month");
  assert.deepEqual(monthly.map(r => r.label), ["Jan 26", "Feb 26", "Mar 26", "May 26"]);
  const quarterly = wealthRows(snaps, "quarter");
  assert.deepEqual(quarterly.map(r => [r.label, r.fire]), [["Q1 26", 9600000], ["Q2 26", 10300000]]); // balances not summed
  const g = growth(monthly, r => r.fire);
  assert.equal(g.change, 1300000);
  assert.equal(Math.round(g.percent * 10) / 10, 14.4);
  assert.equal(g.perMonth, 325000); // over 4 months (Jan → May)
  assert.equal(growth(monthly.slice(0, 1), r => r.fire), null);
});
