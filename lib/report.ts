import type { CheckinRow, LessonRow } from "./financialState.ts";
import type { Snapshot } from "./progress.ts";

export type MonthlyReport = {
  monthLabel: string; // e.g. "November 2026"
  progressChange: number | null; // percentage points vs the previous snapshot
  portfolioChange: number | null;
  netWorthChange: number | null;
  scoreChange: number | null;
  checkin: { income: number; expenses: number; invested: number; savingsRate: number; investRate: number } | null;
  previousCheckin: { savingsRate: number; invested: number } | null;
  lessonsThisMonth: number;
  loggedThisMonth: boolean;
  verdict: { emoji: string; title: string; body: string };
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

/** Builds "your month in money": change since last month, habits, and an encouraging verdict. */
export function buildMonthlyReport(input: { snapshots: Snapshot[]; checkins: CheckinRow[]; lessons: LessonRow[]; today?: Date }): MonthlyReport {
  const today = input.today ?? new Date();
  const thisMonth = monthKey(today);
  const snaps = [...input.snapshots].sort((a, b) => a.month_start.localeCompare(b.month_start));
  const latest = snaps[snaps.length - 1] ?? null;
  const previous = snaps.length > 1 ? snaps[snaps.length - 2] : null;
  const diff = (key: "fire_progress" | "fire_portfolio" | "net_worth" | "fire_score") => (latest && previous ? latest[key] - previous[key] : null);

  const sortedCheckins = [...input.checkins].sort((a, b) => b.month_start.localeCompare(a.month_start));
  const rate = (row: CheckinRow) => (row.income > 0 ? ((row.income - row.expenses) / row.income) * 100 : 0);
  const last = sortedCheckins[0] ?? null;
  const before = sortedCheckins[1] ?? null;
  const lessonsThisMonth = input.lessons.filter(lesson => lesson.completed_at.slice(0, 7) === thisMonth.slice(0, 7)).length;
  const progressChange = diff("fire_progress");

  const verdict = progressChange !== null && progressChange > 0
    ? { emoji: "🚀", title: `You moved ${progressChange.toFixed(1)}% closer to freedom`, body: "That’s compounding and consistency working together. Keep the streak going next month." }
    : progressChange !== null && progressChange < 0
      ? { emoji: "🌧️", title: "A dip this month — and that’s normal", body: "Markets move and some months cost more. What matters is that you keep investing; dips are when your money buys the most." }
      : last
        ? { emoji: "🌱", title: "Your foundation is in place", body: "Log another month and we’ll show you exactly how your freedom number is moving." }
        : { emoji: "👋", title: "Let’s start your first report", body: "Log this month’s money in 30 seconds and your report fills itself in." };

  return {
    monthLabel: today.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    progressChange, portfolioChange: diff("fire_portfolio"), netWorthChange: diff("net_worth"), scoreChange: diff("fire_score"),
    checkin: last ? { income: last.income, expenses: last.expenses, invested: last.invested, savingsRate: rate(last), investRate: last.income > 0 ? (last.invested / last.income) * 100 : 0 } : null,
    previousCheckin: before ? { savingsRate: rate(before), invested: before.invested } : null,
    lessonsThisMonth,
    loggedThisMonth: sortedCheckins.some(row => row.month_start === thisMonth),
    verdict,
  };
}
