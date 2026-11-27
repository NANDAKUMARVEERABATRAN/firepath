/** Year-in-review ("FIRE recap") from the person's own monthly logs and snapshots. */
import type { Milestone } from "./milestones.ts";

export type RecapCheckin = { month_start: string; income: number; expenses: number; invested: number; extra_invested?: number; salary_pf?: number; salary_pension?: number; auto_filled?: boolean };
export type RecapSnapshot = { month_start: string; net_worth: number; fire_portfolio: number; fire_progress: number };
export type RecapLesson = { completed_at?: string | null };

export type YearRecap = {
  year: number;
  monthsLogged: number;
  invested: number;          // from the bank + one-off (bonus) + salary EPF/NPS
  earned: number;
  spent: number;
  savingsRate: number | null; // on the year's totals
  bestMonth: { month_start: string; rate: number } | null;
  longestStreak: number;     // consecutive logged months with investing
  progressStart: number | null; progressEnd: number | null;
  portfolioStart: number | null; portfolioEnd: number | null;
  netWorthStart: number | null; netWorthEnd: number | null;
  lessons: number;
};

const n = (v: unknown) => Math.max(0, Number(v ?? 0) || 0);

export function yearRecap(year: number, checkins: RecapCheckin[], snapshots: RecapSnapshot[], lessons: RecapLesson[]): YearRecap {
  const inYear = (d: string | null | undefined) => Boolean(d && d.slice(0, 4) === String(year));
  const logs = checkins.filter(c => inYear(c.month_start) && !c.auto_filled).sort((a, b) => a.month_start.localeCompare(b.month_start));
  const fromSalary = (c: RecapCheckin) => n(c.salary_pf) + n(c.salary_pension);
  const earnedOf = (c: RecapCheckin) => n(c.income) + n(c.extra_invested) + fromSalary(c);
  const investedOf = (c: RecapCheckin) => n(c.invested) + n(c.extra_invested) + fromSalary(c);
  const earned = logs.reduce((s, c) => s + earnedOf(c), 0);
  const spent = logs.reduce((s, c) => s + n(c.expenses), 0);
  const invested = logs.reduce((s, c) => s + investedOf(c), 0);
  const rates = logs.filter(c => earnedOf(c) > 0).map(c => ({ month_start: c.month_start, rate: ((earnedOf(c) - n(c.expenses)) / earnedOf(c)) * 100 }));
  const bestMonth = rates.length ? rates.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;

  let longestStreak = 0, run = 0, prev: string | null = null;
  for (const c of logs) {
    const invests = n(c.invested) + n(c.extra_invested) > 0;
    const consecutive = prev !== null && monthAfter(prev) === c.month_start;
    run = invests ? (consecutive ? run + 1 : 1) : 0;
    longestStreak = Math.max(longestStreak, run);
    prev = c.month_start;
  }

  const snaps = snapshots.filter(s => inYear(s.month_start)).sort((a, b) => a.month_start.localeCompare(b.month_start));
  const first = snaps[0], last = snaps[snaps.length - 1];
  return {
    year, monthsLogged: logs.length, invested, earned, spent,
    savingsRate: earned > 0 ? ((earned - spent) / earned) * 100 : null,
    bestMonth, longestStreak,
    progressStart: first ? Number(first.fire_progress) : null, progressEnd: last ? Number(last.fire_progress) : null,
    portfolioStart: first ? Number(first.fire_portfolio) : null, portfolioEnd: last ? Number(last.fire_portfolio) : null,
    netWorthStart: first ? Number(first.net_worth) : null, netWorthEnd: last ? Number(last.net_worth) : null,
    lessons: lessons.filter(l => inYear(l.completed_at ?? null)).length,
  };
}

function monthAfter(monthStart: string) {
  const [y, m] = monthStart.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Recap season: December and January show the recap prominently (January shows last year's). */
export function recapYearFor(today = new Date()): { year: number; season: boolean } {
  const m = today.getMonth();
  if (m === 0) return { year: today.getFullYear() - 1, season: true };
  return { year: today.getFullYear(), season: m === 11 };
}

/** Shareable cards: progress and habits only, never amounts. */
export function recapMilestones(r: YearRecap): Milestone[] {
  const list: Milestone[] = [];
  if (r.progressStart !== null && r.progressEnd !== null && r.progressEnd > r.progressStart) list.push({ id: "fire-recap", emoji: "🔥", headline: `${r.year}: +${(r.progressEnd - r.progressStart).toFixed(1)} points closer to financial freedom`, sub: `Now ${r.progressEnd.toFixed(1)}% of the way to my FIRE number`, progress: r.progressEnd, weight: 10 });
  if (r.savingsRate !== null && r.savingsRate > 0) list.push({ id: "gain-recap", emoji: "💪", headline: `I saved ${Math.round(r.savingsRate)}% of what I earned in ${r.year}`, sub: r.bestMonth ? `Best month: ${Math.round(r.bestMonth.rate)}% saved` : "Paying myself first", weight: 8 });
  if (r.longestStreak >= 2) list.push({ id: "streak-recap", emoji: "📅", headline: `${r.longestStreak} months of investing in a row in ${r.year}`, sub: `${r.monthsLogged} months tracked on my FIRE path`, weight: 7 });
  if (r.lessons >= 3) list.push({ id: "lessons-recap", emoji: "📚", headline: `${r.lessons} money lessons learned in ${r.year}`, sub: "Ideas from the best personal-finance books", weight: 5 });
  return list;
}
