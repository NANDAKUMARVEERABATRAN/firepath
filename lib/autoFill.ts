/**
 * Months the person didn't log get filled with their usual numbers, so charts, savings rate and the report
 * don't have holes. Only past months (the current month is still open for them to log), at most `max` at a time,
 * and never before they started using FIREpath.
 */
export type CheckinLike = { month_start: string; income: number; investment_income: number; expenses: number; invested: number; debt_paid: number; salary_pf?: number; salary_pension?: number; auto_filled?: boolean };
export type ProfileDefaults = { income: number; investment_income: number; expenses: number; invested: number; debt_paid: number; salary_pf: number; salary_pension: number };

const shift = (month: string, by: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`; };

export function monthsToAutoFill(logged: string[], currentMonth: string, startMonth: string, max = 3): string[] {
  const have = new Set(logged);
  const out: string[] = [];
  for (let k = 1; k <= max; k += 1) {
    const m = shift(currentMonth, -k);
    if (m < startMonth) break;
    if (!have.has(m)) out.push(m);
  }
  return out.reverse(); // oldest first
}

/** The usual numbers for a month: the latest real (not auto-filled) check-in before it, else the profile. */
export function usualNumbers(month: string, checkins: CheckinLike[], profile: ProfileDefaults | null): ProfileDefaults | null {
  const before = checkins.filter(c => c.month_start < month && !c.auto_filled).sort((a, b) => b.month_start.localeCompare(a.month_start))[0];
  if (before) return { income: before.income, investment_income: before.investment_income, expenses: before.expenses, invested: before.invested, debt_paid: before.debt_paid, salary_pf: before.salary_pf ?? 0, salary_pension: before.salary_pension ?? 0 };
  return profile && profile.income > 0 ? profile : null;
}
