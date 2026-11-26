import { getCountry, type CountryCode } from "./country.ts";

/** Points rules — keep in sync with supabase/migrations/202611260022_feedback_rewards.sql. */
export const REWARDS = { perFeedback: 20, monthlyRewardedFeedback: 3, accepted: 200, shipped: 500, pointsPerUnit: 100, maxShareOfBill: 0.5 } as const;

/** Money value of 100 points: ₹10 in India, AED 1.5 in the UAE. */
const valuePer100: Record<CountryCode, number> = { IN: 10, AE: 1.5 };

export const pointsValue = (points: number, code: CountryCode = "IN") => Math.max(0, points) / REWARDS.pointsPerUnit * valuePer100[code];

/** Discount on a bill: the points' value, capped at half the bill. Returns the money off and points used. */
export function redeemOnBill(balance: number, bill: number, code: CountryCode = "IN"): { discount: number; pointsUsed: number } {
  const cap = bill * REWARDS.maxShareOfBill;
  const discount = Math.min(pointsValue(balance, code), cap);
  const rounded = Math.floor(discount * 100) / 100;
  const pointsUsed = Math.ceil((rounded / valuePer100[code]) * REWARDS.pointsPerUnit);
  return { discount: rounded, pointsUsed: Math.min(balance, pointsUsed) };
}

/** How many months of the yearly/monthly plan the points could cover (for motivating copy). */
export function freeMonthsFromPoints(points: number, code: CountryCode = "IN"): number {
  return Math.floor(pointsValue(points, code) / getCountry(code).pricing.monthly);
}
