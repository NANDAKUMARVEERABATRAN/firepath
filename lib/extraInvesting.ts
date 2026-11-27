/**
 * Investing from bonuses and other extra earnings (incentives, RSU sales, gifts, freelance).
 * Projections spread the yearly amount evenly over 12 months. Only the invested part counts:
 * it is added to both income and investing, so the savings rate stays honest.
 */

export type ExtraCheckin = { month_start: string; extra_invested?: number | null };

/** One-off investments logged in the 12 months up to and including `today`'s month. */
export function loggedExtraLastYear(checkins: ExtraCheckin[], today = new Date()): number {
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  const from = start.toISOString().slice(0, 10), to = end.toISOString().slice(0, 10);
  return checkins.filter(c => c.month_start >= from && c.month_start <= to).reduce((sum, c) => sum + Math.max(0, Number(c.extra_invested ?? 0)), 0);
}

/**
 * Yearly extra investing used for the FIRE date: the amount the person set in their profile,
 * or, if they haven't set one, what they actually logged as one-off investments in the last 12 months.
 */
export function yearlyExtraInvestment(profileValue: number | null | undefined, checkins: ExtraCheckin[], today = new Date()): { yearly: number; source: "profile" | "logged" | null } {
  const set = Math.max(0, Number(profileValue ?? 0));
  if (set > 0) return { yearly: set, source: "profile" };
  const logged = loggedExtraLastYear(checkins, today);
  return logged > 0 ? { yearly: logged, source: "logged" } : { yearly: 0, source: null };
}

/** Regular monthly investing plus the yearly extra spread over 12 months. */
export const investingPerMonth = (p: { monthly_investment: number; yearly_extra_investment?: number }) =>
  Math.max(0, p.monthly_investment) + Math.max(0, p.yearly_extra_investment ?? 0) / 12;
