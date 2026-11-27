export const PRICING = { monthly: 99, yearly: 899, trialDays: 14 } as const;

/**
 * Flip to true once Razorpay checkout works. Until then, people whose trial ended keep access
 * (with a friendly banner) — we never lock someone out when there's no way to pay.
 */
export const PAYMENTS_LIVE = false;

/** Marker set just before Google sign-in from a "start trial" button, so the trial starts automatically after login. */
export const START_TRIAL_KEY = "ff-start-trial";

export type SubscriptionRow = { plan: "trial" | "monthly" | "yearly"; status: "active" | "cancelled" | "expired" | "paused"; current_period_end: string; trial_started_at: string | null; paused_until?: string | null };
export type ProStatus = { state: "none" | "trial" | "paid" | "expired" | "paused"; daysLeft: number; endsAt: Date | null; trialUsed: boolean; pausedUntil?: Date | null };

/** Pure status logic (testable): active until current_period_end; a cancelled plan keeps access until then. */
export function getProStatus(row: SubscriptionRow | null, now = new Date()): ProStatus {
  if (!row) return { state: "none", daysLeft: 0, endsAt: null, trialUsed: false };
  // Paused: no Pro (and no charges) until the pause ends; after that date it simply counts as active again.
  if (row.status === "paused" && row.paused_until && new Date(row.paused_until).getTime() > now.getTime()) {
    return { state: "paused", daysLeft: 0, endsAt: new Date(row.current_period_end), trialUsed: true, pausedUntil: new Date(row.paused_until) };
  }
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

/** Founding members: the first 1,000 people get this yearly price, locked for life (India). */
export const FOUNDING = { yearly: 599, spots: 1000, until: "2027-01-31" } as const;
export const foundingOpen = (now = new Date()) => now.toISOString().slice(0, 10) <= FOUNDING.until;

/** Referral links: ?ref=CODE is remembered until sign-in, then claimed once. Friends get a 30-day trial. */
export const REFERRAL_KEY = "ff-ref";
export const REFERRAL_TRIAL_DAYS = 30;
export const REFERRAL_REWARD = { signup: 100, paid: 990 } as const;

/**
 * Free: the FIRE calculator on "/" (no sign-in) and your own freedom number (shown above the paywall).
 * Everything else after sign-in is Pro. Subscription & account deletion always stay reachable; Invite stays free so anyone can share.
 */
export const FREE_APP_PAGES = ["/account", "/invite"] as const;
export const FREE_GOAL_LIMIT = 1;
export const isProOnlyPage = (path: string | null | undefined) => !(FREE_APP_PAGES as readonly string[]).includes(path ?? "");

export const PAUSE_MONTHS = [1, 2, 3] as const;
