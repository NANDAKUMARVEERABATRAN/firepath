import test from "node:test";
import assert from "node:assert/strict";
import { drawdownFromNavs, marketMood, fireDelayMonths, extraUnitsPercent } from "../lib/marketCoach.ts";
import { pickReminder, indiaToday } from "../lib/reminders.ts";
import { yearRecap, recapYearFor, recapMilestones } from "../lib/yearRecap.ts";

test("drawdown is measured from the 1-year high", () => {
  const navs = [{ date: "27-11-2026", nav: "90" }, { date: "01-06-2026", nav: "100" }, { date: "01-01-2025", nav: "150" }];
  const s = drawdownFromNavs(navs);
  assert.equal(s.high, 100); // the 2025 peak is older than a year
  assert.equal(Math.round(s.drawdown), 10);
  assert.equal(s.asOf, "2026-11-27");
  assert.equal(drawdownFromNavs([]), null);
});

test("market moods", () => {
  assert.equal(marketMood(2), "calm");
  assert.equal(marketMood(7), "dip");
  assert.equal(marketMood(12), "correction");
  assert.equal(marketMood(25), "bear");
});

test("a 20% equity fall moves the FIRE date by months, not years", () => {
  const months = fireDelayMonths({ accessible: 3000000, equityShare: 0.8, fallPercent: 20, monthlyInvestment: 50000, target: 30000000, realReturnPercent: 4 });
  assert.ok(months > 0 && months < 48, `got ${months}`);
  assert.equal(Math.round(extraUnitsPercent(20)), 25);
});

const base = { today: { year: 2026, month: 12, day: 2 }, loggedThisMonth: false, streak: 3, daysSincePortfolioUpdate: 10, daysSinceLaterUpdate: 10, market: null, sent: new Set() };

test("start of month: log reminder, once", () => {
  const r = pickReminder(base);
  assert.equal(r.kind, "log-start");
  assert.equal(pickReminder({ ...base, sent: new Set(["log-start:2026-12"]) }), null);
  assert.equal(pickReminder({ ...base, loggedThisMonth: true }), null);
});

test("market fall comes first; streak and portfolio reminders on their days", () => {
  assert.equal(pickReminder({ ...base, market: { mood: "correction", drawdown: 12 } }).kind, "market");
  assert.equal(pickReminder({ ...base, market: { mood: "dip", drawdown: 6 } }).kind, "log-start");
  assert.equal(pickReminder({ ...base, today: { year: 2026, month: 11, day: 26 } }).kind, "log-streak");
  assert.equal(pickReminder({ ...base, today: { year: 2026, month: 11, day: 26 }, streak: 0 }), null);
  assert.equal(pickReminder({ ...base, loggedThisMonth: true, today: { year: 2026, month: 11, day: 12 }, daysSincePortfolioUpdate: 40 }).kind, "portfolio");
  assert.equal(pickReminder({ ...base, loggedThisMonth: true, today: { year: 2027, month: 1, day: 5 }, daysSinceLaterUpdate: 100 }).kind, "later-assets");
  assert.equal(pickReminder({ ...base, loggedThisMonth: true, today: { year: 2027, month: 3, day: 10 } }).kind, "tax-ltcg");
  assert.equal(pickReminder({ ...base, loggedThisMonth: true, today: { year: 2026, month: 12, day: 28 } }).kind, "recap");
});

test("India date from UTC", () => {
  assert.deepEqual(indiaToday(new Date("2026-11-30T20:00:00Z")), { year: 2026, month: 12, day: 1 });
});

test("year recap from logs and snapshots", () => {
  const checkins = [
    { month_start: "2026-01-01", income: 100000, expenses: 60000, invested: 20000 },
    { month_start: "2026-02-01", income: 100000, expenses: 50000, invested: 25000, extra_invested: 200000 },
    { month_start: "2026-03-01", income: 100000, expenses: 70000, invested: 20000, auto_filled: true },
    { month_start: "2026-04-01", income: 100000, expenses: 55000, invested: 20000, salary_pf: 5000 },
    { month_start: "2025-12-01", income: 100000, expenses: 90000, invested: 0 },
  ];
  const snaps = [{ month_start: "2026-01-01", net_worth: 4000000, fire_portfolio: 3000000, fire_progress: 10 }, { month_start: "2026-11-01", net_worth: 5000000, fire_portfolio: 3800000, fire_progress: 13.5 }];
  const r = yearRecap(2026, checkins, snaps, [{ completed_at: "2026-05-02T10:00:00Z" }, { completed_at: "2025-05-02T10:00:00Z" }]);
  assert.equal(r.monthsLogged, 3);                       // auto-filled March and 2025 excluded
  assert.equal(r.invested, 20000 + 225000 + 25000);
  assert.equal(r.longestStreak, 2);                      // Jan–Feb (March not logged)
  assert.equal(r.bestMonth.month_start, "2026-02-01");
  assert.equal(r.progressEnd - r.progressStart, 3.5);
  assert.equal(r.lessons, 1);
  const cards = recapMilestones(r);
  assert.ok(cards.length >= 2);
  assert.ok(cards.every(c => !/₹|\d{2},\d{3}/.test(c.headline + c.sub)), "share cards never show amounts");
});

test("recap season", () => {
  assert.deepEqual(recapYearFor(new Date("2026-12-05")), { year: 2026, season: true });
  assert.deepEqual(recapYearFor(new Date("2027-01-10")), { year: 2026, season: true });
  assert.deepEqual(recapYearFor(new Date("2026-06-10")), { year: 2026, season: false });
});
