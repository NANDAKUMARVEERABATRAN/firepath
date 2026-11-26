import { yearsToTarget } from "./freedomPath.ts";
import type { CountryCode } from "./country.ts";

/* ---------------- Savings rate ---------------- */

export type SavingsTier = { id: string; min: number; emoji: string; name: string; tone: "danger" | "warn" | "ok" | "great"; message: string };

/** Ordered low → high. `min` is the savings rate (% of income kept after expenses) needed to reach the tier. */
export const SAVINGS_TIERS: SavingsTier[] = [
  { id: "negative", min: -Infinity, emoji: "🚨", name: "Spending more than you earn", tone: "danger", message: "Every month borrows from your future. Let’s find the leaks first. Even small cuts flip this around." },
  { id: "danger", min: 0, emoji: "🔴", name: "Danger zone", tone: "danger", message: "At this rate, work stays compulsory for most of your life. The good news: the first few % are the easiest to find." },
  { id: "starter", min: 10, emoji: "🌱", name: "Getting started", tone: "warn", message: "You’ve started. Pushing past 20% is where the freedom date starts moving fast." },
  { id: "steady", min: 20, emoji: "💪", name: "Steady saver", tone: "ok", message: "Solid! Each extra 5% from here can cut years off your working life." },
  { id: "builder", min: 30, emoji: "🔥", name: "FIRE builder", tone: "great", message: "This is FIRE territory. Keep it up and freedom comes decades early." },
  { id: "fire", min: 50, emoji: "🚀", name: "FIRE mode", tone: "great", message: "Elite saver. At 50%+, financial independence can arrive in well under 20 years." },
];

export function savingsRate(income: number, expenses: number): number | null {
  if (!Number.isFinite(income) || income <= 0) return null;
  return ((income - Math.max(0, expenses)) / income) * 100;
}

export function getSavingsTier(rate: number): SavingsTier {
  let tier = SAVINGS_TIERS[0];
  for (const candidate of SAVINGS_TIERS) if (rate >= candidate.min) tier = candidate;
  return tier;
}

export function getNextTier(rate: number): SavingsTier | null {
  return SAVINGS_TIERS.find(tier => tier.min > rate) ?? null;
}

/**
 * Years to financial independence starting from zero, if you keep `ratePercent` of income and live on the rest.
 * Independent of income: the target is (100 − rate) × 12 ÷ withdrawal rate, contributions are `rate` each month.
 */
export function yearsFromSavingsRate(ratePercent: number, realReturnPercent: number, withdrawalRatePercent: number): number | null {
  if (ratePercent <= 0 || withdrawalRatePercent <= 0) return null;
  if (ratePercent >= 100) return 0;
  const target = ((100 - ratePercent) * 12) / (withdrawalRatePercent / 100);
  return yearsToTarget(0, ratePercent, target, realReturnPercent, 80);
}

export const RATE_TABLE_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70];

export function savingsRateTable(realReturnPercent: number, withdrawalRatePercent: number, steps = RATE_TABLE_STEPS) {
  return steps.map(rate => ({ rate, years: yearsFromSavingsRate(rate, realReturnPercent, withdrawalRatePercent) }));
}

/** Money kept after expenses each month that isn't being invested (sitting idle in the bank). */
export function idleMoney(income: number, expenses: number, invested: number): number {
  return Math.max(0, income - Math.max(0, expenses) - Math.max(0, invested));
}

/* ---------------- Impact of cutting spending ---------------- */

export type CutImpactInput = { accessible: number; monthlyInvestment: number; monthlyExpenses: number; monthlyCut: number; realReturnPercent: number; withdrawalRatePercent: number };
export type CutImpact = { monthlyCut: number; yearlyCut: number; targetBefore: number; targetAfter: number; targetDrop: number; yearsBefore: number | null; yearsAfter: number | null; yearsSooner: number | null; valueIn10Years: number };

/**
 * A spending cut helps twice: the money is invested AND your FIRE number shrinks
 * (you need less to live on forever). All figures in today's money.
 */
export function cutImpact(input: CutImpactInput): CutImpact {
  const cut = Math.max(0, Math.min(input.monthlyCut, input.monthlyExpenses));
  const wr = input.withdrawalRatePercent / 100;
  const targetBefore = wr > 0 ? (Math.max(0, input.monthlyExpenses) * 12) / wr : 0;
  const targetAfter = wr > 0 ? (Math.max(0, input.monthlyExpenses - cut) * 12) / wr : 0;
  const yearsBefore = yearsToTarget(input.accessible, input.monthlyInvestment, targetBefore, input.realReturnPercent);
  const yearsAfter = yearsToTarget(input.accessible, input.monthlyInvestment + cut, targetAfter, input.realReturnPercent);
  const monthlyRate = Math.pow(1 + input.realReturnPercent / 100, 1 / 12) - 1;
  const valueIn10Years = monthlyRate > 0 ? cut * ((Math.pow(1 + monthlyRate, 120) - 1) / monthlyRate) : cut * 120;
  return {
    monthlyCut: cut, yearlyCut: cut * 12, targetBefore, targetAfter, targetDrop: targetBefore - targetAfter,
    yearsBefore, yearsAfter,
    yearsSooner: yearsBefore !== null && yearsAfter !== null ? Math.max(0, yearsBefore - yearsAfter) : yearsBefore === null && yearsAfter !== null ? null : null,
    valueIn10Years,
  };
}

/** Monthly amount needed to move from the current savings rate to `targetRate` (with the same income). */
export function cutNeededForRate(income: number, expenses: number, targetRate: number): number {
  const allowedExpenses = income * (1 - targetRate / 100);
  return Math.max(0, expenses - allowedExpenses);
}

/* ---------------- Spending leaks ---------------- */

export type Leak = { id: string; emoji: string; label: string; tip: string; typical: number; category: string };

const LEAKS: Record<CountryCode, Leak[]> = {
  IN: [
    { id: "delivery", emoji: "🛵", label: "Food delivery & takeaway", tip: "Cook on weeknights and keep delivery as a weekend treat. Most people save half without missing it.", typical: 3000, category: "dining" },
    { id: "eating_out", emoji: "☕", label: "Cafés & eating out", tip: "Set a monthly “fun money” amount and stop when it runs out. Café coffee daily ≈ a SIP.", typical: 2000, category: "dining" },
    { id: "subscriptions", emoji: "📺", label: "Unused subscriptions (OTT, apps, music)", tip: "List every auto-debit in your bank/UPI app. Keep one or two streaming services and rotate them.", typical: 600, category: "personal" },
    { id: "shopping", emoji: "🛍️", label: "Impulse online shopping & sales", tip: "Use a 72-hour rule: leave it in the cart for 3 days. Turn off shopping-app notifications.", typical: 2500, category: "personal" },
    { id: "cards", emoji: "💳", label: "Credit-card interest, late fees & EMIs on gadgets", tip: "Pay the full card bill on autopay. Card interest can be 36–42% a year, the most expensive money there is.", typical: 1500, category: "debt_repayment" },
    { id: "cabs", emoji: "🚕", label: "Cabs & autos for short trips", tip: "Use metro, bus or a monthly pass for regular routes; keep cabs for late nights and rain.", typical: 1500, category: "transport" },
    { id: "gym", emoji: "🏋️", label: "Gym or club you rarely use", tip: "Pause it, switch to a pay-per-visit plan, or train at home or in the park.", typical: 1200, category: "personal" },
    { id: "phone", emoji: "📱", label: "Oversized phone, data & DTH plans", tip: "Check what you actually use and move to a cheaper plan or a yearly pack.", typical: 400, category: "utilities" },
    { id: "electricity", emoji: "💡", label: "High electricity bill", tip: "AC at 24–26°C, switch off geysers and standby devices. Every degree saves around 6%.", typical: 500, category: "utilities" },
    { id: "habits", emoji: "🚬", label: "Smoking, alcohol & other habits", tip: "Cutting down helps both your health and your freedom date. Even halving it counts.", typical: 2000, category: "personal" },
    { id: "bank_fees", emoji: "🏦", label: "Bank, card & minimum-balance charges", tip: "Check your statement for annual fees and penalties; ask for a waiver or switch to a free account.", typical: 200, category: "other" },
  ],
  AE: [
    { id: "delivery", emoji: "🛵", label: "Food delivery & takeaway", tip: "Cook on weeknights and keep delivery for weekends. Delivery fees and tips add up fast.", typical: 600, category: "dining" },
    { id: "brunch", emoji: "🥂", label: "Brunches, cafés & eating out", tip: "Pick your favourite outings and skip the rest. Set a monthly “fun money” limit.", typical: 800, category: "dining" },
    { id: "subscriptions", emoji: "📺", label: "Unused subscriptions & memberships", tip: "Review every auto-renewal on your cards; keep the ones you use weekly.", typical: 150, category: "personal" },
    { id: "shopping", emoji: "🛍️", label: "Mall & online impulse shopping", tip: "Use a 72-hour rule before non-essential buys and unsubscribe from sale emails.", typical: 700, category: "personal" },
    { id: "cards", emoji: "💳", label: "Credit-card interest & instalment plans", tip: "Pay the full statement balance automatically; card interest is often 30%+ a year.", typical: 400, category: "debt_repayment" },
    { id: "car", emoji: "🚗", label: "Car costs (upgrades, Salik, parking, fuel)", tip: "Combine trips, use the metro where you can, and think twice before upgrading the car.", typical: 500, category: "transport" },
    { id: "gym", emoji: "🏋️", label: "Gym or club you rarely use", tip: "Pause it or switch to a class pack; many communities have free facilities.", typical: 300, category: "personal" },
    { id: "phone", emoji: "📱", label: "Oversized mobile & home internet plans", tip: "Compare your usage with your plan and downgrade or bundle.", typical: 120, category: "utilities" },
    { id: "dewa", emoji: "💡", label: "High utility bill (AC, water)", tip: "Set the AC to 24°C and use timers. Every degree makes a real difference in summer.", typical: 200, category: "utilities" },
    { id: "remittance_fees", emoji: "💸", label: "High fees on money sent home", tip: "Compare exchange rates and fees across providers and send larger, less frequent transfers.", typical: 100, category: "family" },
  ],
};

export function getLeaks(country: CountryCode): Leak[] {
  return LEAKS[country] ?? LEAKS.IN;
}

/**
 * "Wants" categories in the budget that look high for the income. Benchmarks are rough, educational
 * guides (share of take-home income), not rules.
 */
export const WANT_BENCHMARKS: Record<string, number> = { dining: 0.08, personal: 0.1, other: 0.08, transport: 0.12 };

export function findOverspending(spentByCategory: Record<string, number>, income: number): { category: string; spent: number; benchmark: number; excess: number }[] {
  if (!(income > 0)) return [];
  return Object.entries(WANT_BENCHMARKS)
    .map(([category, share]) => ({ category, spent: spentByCategory[category] ?? 0, benchmark: Math.round(income * share), excess: Math.round((spentByCategory[category] ?? 0) - income * share) }))
    .filter(item => item.excess > 0)
    .sort((a, b) => b.excess - a.excess);
}
