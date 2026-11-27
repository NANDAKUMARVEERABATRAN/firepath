export const PRICING = { monthly: 99, yearly: 899, trialDays: 14 } as const;

/**
 * Flip to true once Razorpay checkout works. Until then, people whose trial ended keep access
 * (with a friendly banner) — we never lock someone out when there's no way to pay.
 */
export const PAYMENTS_LIVE = false;

/** Marker set just before Google sign-in from a "start trial" button, so the trial starts automatically after login. */
export const START_TRIAL_KEY = "ff-start-trial";

export type SubscriptionRow = { plan: "trial" | "monthly" | "yearly"; status: "active" | "cancelled" | "expired"; current_period_end: string; trial_started_at: string | null };
export type ProStatus = { state: "none" | "trial" | "paid" | "expired"; daysLeft: number; endsAt: Date | null; trialUsed: boolean };

/** Pure status logic (testable): active until current_period_end; a cancelled plan keeps access until then. */
export function getProStatus(row: SubscriptionRow | null, now = new Date()): ProStatus {
  if (!row) return { state: "none", daysLeft: 0, endsAt: null, trialUsed: false };
  const endsAt = new Date(row.current_period_end);
  const msLeft = endsAt.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
  const trialUsed = Boolean(row.trial_started_at) || row.plan === "trial";
  if (msLeft <= 0 || row.status === "expired") return { state: "expired", daysLeft: 0, endsAt, trialUsed };
  return { state: row.plan === "trial" ? "trial" : "paid", daysLeft, endsAt, trialUsed };
}

export const hasPro = (status: ProStatus) => status.state === "trial" || status.state === "paid";

/** The free calculator stores its inputs here so sign-up never asks for them again. */
export const CALCULATOR_KEY = "ff-calculator";
export type CalculatorSnapshot = { age: number; retireAge: number; expenses: number; assets: number; monthlyInvestment: number };
