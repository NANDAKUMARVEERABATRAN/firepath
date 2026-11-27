import { shortCountryMoney, type CountryCode } from "./country.ts";

/**
 * Money trends from monthly check-ins (and budget entries for categories). Pure functions, so they're testable.
 * Definitions match the rest of the app: earned = take-home + EPF/NPS deducted from salary;
 * savings rate = (earned − spent) ÷ earned; "spent" excludes investing and loan EMIs (as in the check-in).
 */

export type TrendCheckin = { month_start: string; income: number; expenses: number; invested: number; debt_paid: number; salary_pf?: number; salary_pension?: number };

export type TrendRow = {
  key: string; // "2026-11" or "2026"
  label: string; // "Nov 26" or "2026"
  months: number; // months logged in this row (1 for monthly rows)
  takeHome: number;
  fromSalary: number; // EPF/NPS deducted from salary
  earned: number;
  invested: number; // from the bank
  spent: number;
  emis: number;
  left: number; // take-home − spent − EMIs − invested (never below 0)
  overspent: number; // how much more went out than came in (0 if none)
  savingsRate: number; // %
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? Math.max(0, x) : 0; };

function build(key: string, label: string, months: number, takeHome: number, fromSalary: number, invested: number, spent: number, emis: number): TrendRow {
  const earned = takeHome + fromSalary;
  const remainder = takeHome - spent - emis - invested;
  return { key, label, months, takeHome, fromSalary, earned, invested, spent, emis, left: Math.max(0, remainder), overspent: Math.max(0, -remainder), savingsRate: earned > 0 ? ((earned - spent) / earned) * 100 : 0 };
}

/** One row per logged month, oldest first. */
export function monthlyRows(checkins: TrendCheckin[]): TrendRow[] {
  return [...checkins]
    .sort((a, b) => a.month_start.localeCompare(b.month_start))
    .map(c => {
      const [y, m] = c.month_start.split("-");
      return build(`${y}-${m}`, `${MONTHS[Number(m) - 1]} ${y.slice(2)}`, 1, n(c.income), n(c.salary_pf) + n(c.salary_pension), n(c.invested), n(c.expenses), n(c.debt_paid));
    });
}

/** Totals per calendar year (savings rate recomputed on the totals, not averaged). */
export function yearlyRows(rows: TrendRow[]): TrendRow[] {
  const years = new Map<string, TrendRow[]>();
  for (const r of rows) { const y = r.key.slice(0, 4); years.set(y, [...(years.get(y) ?? []), r]); }
  return [...years.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([y, list]) => {
    const sum = (k: keyof TrendRow) => list.reduce((s, r) => s + (r[k] as number), 0);
    return build(y, list.length < 12 ? `${y} (${list.length} mo)` : y, list.length, sum("takeHome"), sum("fromSalary"), sum("invested"), sum("spent"), sum("emis"));
  });
}

export type Highlights = { averageRate: number; best: TrendRow | null; totalInvested: number; streak: number; change: number | null };

/** Headline facts for the selected rows. `change` = last 3 logged months' rate minus the 3 before (percentage points). */
export function highlights(rows: TrendRow[]): Highlights {
  const earned = rows.reduce((s, r) => s + r.earned, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const best = rows.length ? rows.reduce((a, b) => (b.savingsRate > a.savingsRate ? b : a)) : null;
  let streak = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i].invested + rows[i].fromSalary > 0; i -= 1) streak += rows[i].months;
  const avg = (list: TrendRow[]) => { const e = list.reduce((s, r) => s + r.earned, 0); return e > 0 ? ((e - list.reduce((s, r) => s + r.spent, 0)) / e) * 100 : 0; };
  const change = rows.length >= 6 ? avg(rows.slice(-3)) - avg(rows.slice(-6, -3)) : null;
  return { averageRate: earned > 0 ? ((earned - spent) / earned) * 100 : 0, best, totalInvested: rows.reduce((s, r) => s + r.invested + r.fromSalary, 0), streak, change };
}

export type CategoryTotal = { category: string; total: number; previous: number; change: number | null };

/**
 * Spending by budget category in [from, to] (month_start keys "YYYY-MM-01"), compared with the same-length period just before.
 */
export function categoryTotals(entries: { month_start: string; category: string; amount: number }[], from: string, to: string, previousFrom: string): CategoryTotal[] {
  const now = new Map<string, number>(), before = new Map<string, number>();
  for (const e of entries) {
    if (e.category === "savings") continue;
    const target = e.month_start >= from && e.month_start <= to ? now : e.month_start >= previousFrom && e.month_start < from ? before : null;
    if (target) target.set(e.category, (target.get(e.category) ?? 0) + n(e.amount));
  }
  return [...now.entries()].map(([category, total]) => {
    const previous = before.get(category) ?? 0;
    return { category, total, previous, change: previous > 0 ? ((total - previous) / previous) * 100 : null };
  }).sort((a, b) => b.total - a.total);
}

/** Short labels for chart axes, using the app's one money style ("₹45,000", "₹1.5 lakh", "₹2.3 crore"). */
export const shortMoney = (value: number, code: CountryCode = "IN") => shortCountryMoney(value, code);

/** Round axis maximum up to a friendly number. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

/* ---------------- Wealth over time (from monthly progress snapshots) ---------------- */

export type WealthSnapshot = { month_start: string; net_worth: number; fire_portfolio: number; fire_target: number };
export type WealthRow = { key: string; label: string; netWorth: number; fire: number; target: number };

/**
 * One point per month, or per quarter (the latest snapshot in each quarter — balances are a point in time,
 * so they are never added up).
 */
export function wealthRows(snapshots: WealthSnapshot[], period: "month" | "quarter"): WealthRow[] {
  const sorted = [...snapshots].sort((a, b) => a.month_start.localeCompare(b.month_start));
  const keyOf = (s: WealthSnapshot) => {
    const [y, m] = s.month_start.split("-").map(Number);
    return period === "month" ? `${y}-${String(m).padStart(2, "0")}` : `${y}-Q${Math.ceil(m / 3)}`;
  };
  const latest = new Map<string, WealthSnapshot>();
  for (const s of sorted) latest.set(keyOf(s), s); // later months overwrite earlier ones in the same quarter
  return [...latest.entries()].map(([key, s]) => {
    const [y, rest] = key.split("-");
    const label = period === "month" ? `${MONTHS[Number(rest) - 1]} ${y.slice(2)}` : `${rest} ${y.slice(2)}`;
    return { key, label, netWorth: s.net_worth, fire: s.fire_portfolio, target: s.fire_target };
  });
}

export type Growth = { from: number; to: number; change: number; percent: number | null; perMonth: number };

/** Change between the first and last point, plus the average gain per month across the span. */
export function growth(rows: WealthRow[], pick: (r: WealthRow) => number): Growth | null {
  if (rows.length < 2) return null;
  const first = rows[0], last = rows.at(-1)!;
  const monthsBetween = (a: string, b: string) => {
    const toIndex = (k: string) => { const [y, r] = k.split("-"); return Number(y) * 12 + (r.startsWith("Q") ? Number(r.slice(1)) * 3 - 1 : Number(r) - 1); };
    return Math.max(1, toIndex(b) - toIndex(a));
  };
  const from = pick(first), to = pick(last), change = to - from;
  return { from, to, change, percent: from > 0 ? (change / from) * 100 : null, perMonth: change / monthsBetween(first.key, last.key) };
}
