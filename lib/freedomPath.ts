import { getFireScore, lifestyleExpenses, totalIncome, type FinancialProfile } from "./fireScore.ts";
import { investingPerMonth } from "./extraInvesting.ts";

/**
 * The Freedom Path: an ordered set of levels that turns the FIRE journey into a game.
 * Levels follow a widely used personal-finance order (cash flow → safety → protection →
 * debt → investing → independence). They are educational milestones, not advice.
 */
export type PathLevel = {
  id: string;
  level: number;
  title: string;
  book: string;
  why: string;
  howToClear: string;
  href: string;
  cleared: boolean;
  progress: number; // 0..1
  progressLabel: string;
};

export type PathOptions = {
  retirementAge?: number;
  expectedReturn?: number; // % nominal
  inflation?: number; // %
};

/** Number of Freedom Path levels (money map → … → financially independent → Fat FIRE). */
export const PATH_LEVELS = 11;
/** Fat FIRE = this multiple of your FIRE number. */
export const FAT_FIRE_MULTIPLE = 1.5;

const ratio = (value: number, target: number) => (target > 0 ? Math.max(0, Math.min(1, value / target)) : 0);

/** Years (fractional) for `assets` growing at `realRate` with `monthly` contributions to reach `target`. Null if never within `maxYears`. */
export function yearsToTarget(assets: number, monthly: number, target: number, realRatePercent: number, maxYears = 60): number | null {
  if (target <= 0) return null;
  if (assets >= target) return 0;
  const monthlyRate = Math.pow(1 + realRatePercent / 100, 1 / 12) - 1;
  let value = Math.max(0, assets);
  for (let month = 1; month <= maxYears * 12; month += 1) {
    value = value * (1 + monthlyRate) + Math.max(0, monthly);
    if (value >= target) return month / 12;
  }
  return null;
}

/**
 * Years to `target` when the monthly investment rises by `stepUpPercent` every 12 months.
 * Everything is in today's money, so the yearly raise is converted to a real raise: (1 + step) / (1 + inflation) − 1.
 */
export function yearsToTargetStepUp(assets: number, monthly: number, target: number, realRatePercent: number, stepUpPercent: number, inflationPercent: number, maxYears = 60): number | null {
  if (target <= 0) return null;
  if (assets >= target) return 0;
  const monthlyRate = Math.pow(1 + realRatePercent / 100, 1 / 12) - 1;
  const realStep = (1 + stepUpPercent / 100) / (1 + inflationPercent / 100) - 1;
  let value = Math.max(0, assets);
  let contribution = Math.max(0, monthly);
  for (let month = 1; month <= maxYears * 12; month += 1) {
    if (month > 1 && (month - 1) % 12 === 0) contribution *= 1 + realStep;
    value = value * (1 + monthlyRate) + contribution;
    if (value >= target) return month / 12;
  }
  return null;
}

/** Monthly investment needed to reach `target` within `years` (binary search on yearsToTarget). Null if not reachable under ₹1 crore/month. */
export function sipForYears(assets: number, target: number, realRatePercent: number, years: number): number | null {
  if (years <= 0) return assets >= target ? 0 : null;
  if (yearsToTarget(assets, 0, target, realRatePercent, years) !== null) return 0;
  let low = 0, high = 10_000_000;
  if (yearsToTarget(assets, high, target, realRatePercent, years) === null) return null;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (yearsToTarget(assets, mid, target, realRatePercent, years) === null) low = mid; else high = mid;
  }
  return Math.ceil(high / 100) * 100;
}

/** Coast FIRE number: what you need today so that growth alone reaches the target by `years`. */
export function coastFireNumber(target: number, years: number, realRatePercent: number): number {
  if (target <= 0) return 0;
  return target / Math.pow(1 + realRatePercent / 100, Math.max(0, years));
}

export function getFreedomPath(profile: FinancialProfile, options: PathOptions = {}): PathLevel[] {
  const score = getFireScore(profile);
  const income = totalIncome(profile); // take-home + EPF/NPS from salary, same as the FIRE score
  const expenses = Math.max(0, profile.monthly_expenses);
  const accessible = Math.max(0, profile.investableAssets ?? profile.fire_accessible_assets ?? profile.assets);
  const realRate = (options.expectedReturn ?? 10) - (options.inflation ?? 6);
  const yearsLeft = Math.max(0, (options.retirementAge ?? 60) - (profile.age ?? 30));
  const coastNumber = coastFireNumber(score.fireTarget, yearsLeft, realRate);
  const fatTarget = score.fireTarget * FAT_FIRE_MULTIPLE;
  // Same basis as the savings rate: bank investing + salary EPF/NPS, out of everything earned.
  const investRate = income > 0 ? (investingPerMonth(profile) + (profile.monthly_salary_savings ?? 0)) / income : 0;
  const highInterest = profile.highInterestDebt ?? 0;
  const uae = profile.currency === "AED";
  const protectedNow = profile.has_health_insurance && (profile.health_cover_amount ?? 0) > 0 && (!profile.has_dependents || (profile.has_term_insurance && (profile.term_cover_amount ?? 0) > 0));
  const protectionSteps = (profile.has_health_insurance ? 1 : 0) + (!profile.has_dependents || profile.has_term_insurance ? 1 : 0);
  const profileFields = [profile.age, income > 0, expenses > 0].filter(Boolean).length;

  const levels: Omit<PathLevel, "level">[] = [
    {
      id: "money-map", title: "Draw your money map", book: "Your Money or Your Life",
      why: "You cannot steer what you cannot see. Knowing your real income and spending is the starting line of every FIRE journey.",
      howToClear: "Fill in your age, monthly income and monthly expenses in your profile.",
      href: "/profile", cleared: profileFields === 3, progress: profileFields / 3, progressLabel: `${profileFields} of 3 basics added`,
    },
    {
      id: "cash-flow", title: "Spend less than you earn", book: "The Psychology of Money",
      why: "Wealth is the income you don’t spend. A positive gap every month is the fuel for everything that follows.",
      howToClear: "Get your monthly savings rate above 10%. Track one month in the budget to find easy leaks.",
      href: "/month", cleared: score.savingsRate >= 10, progress: ratio(score.savingsRate, 10), progressLabel: `${score.savingsRate.toFixed(0)}% saved (goal 10%)`,
    },
    {
      id: "starter-buffer", title: "Starter safety net", book: "The Psychology of Money",
      why: "Room for error keeps one bad month from becoming a debt spiral. Even one month of expenses in cash changes how calm you feel.",
      howToClear: "Keep one month of expenses in a savings account or liquid fund that you don’t touch.",
      href: "/profile", cleared: score.emergencyMonths >= 1, progress: ratio(score.emergencyMonths, 1), progressLabel: `${score.emergencyMonths.toFixed(1)} of 1 month`,
    },
    {
      id: "protection", title: "Shield your family", book: "Let’s Talk Money",
      why: uae
        ? "In the UAE, employer health cover usually ends with your job — and family back home may depend on you. Your own health and term cover protect the plan itself."
        : "In India one hospital bill can erase years of savings. Health cover — and term cover if anyone depends on you — protects the plan itself.",
      howToClear: profile.has_dependents ? "Record your health cover and term life cover in your profile." : "Record your health cover in your profile.",
      href: "/profile", cleared: protectedNow, progress: protectedNow ? 1 : protectionSteps / 2 * 0.9, progressLabel: protectedNow ? "Cover recorded" : "Cover not fully recorded",
    },
    {
      id: "bad-debt", title: "Clear expensive debt", book: "Rich Dad Poor Dad",
      why: "Credit card and personal-loan interest takes money out of your pocket every month — the opposite of an asset.",
      howToClear: "Mark high-interest loans in Assets & loans and pay them down until none remain.",
      href: "/accounts", cleared: highInterest <= 0, progress: highInterest <= 0 ? 1 : income > 0 ? Math.max(0.05, 1 - highInterest / (income * 12)) : 0.05,
      progressLabel: highInterest <= 0 ? "No high-interest debt recorded" : `${highInterest.toLocaleString("en-IN")} ${profile.currency} remaining`,
    },
    {
      id: "full-buffer", title: "Full safety net", book: "The Psychology of Money",
      why: "Six months of expenses lets you handle a job loss or emergency without selling investments at a bad time.",
      howToClear: "Grow your emergency fund to six months of expenses.",
      href: "/profile", cleared: score.emergencyMonths >= 6, progress: ratio(score.emergencyMonths, 6), progressLabel: `${score.emergencyMonths.toFixed(1)} of 6 months`,
    },
    {
      id: "pay-yourself", title: "Pay yourself first", book: "The Richest Man in Babylon",
      why: "Investing a fixed share of income as soon as it arrives — before spending — is the single habit most FIRE stories share.",
      howToClear: uae
        ? "Invest at least 20% of your monthly income automatically — set up a monthly transfer to your investment account on payday."
        : "Invest at least 20% of your monthly income automatically, for example with a monthly SIP.",
      href: "/month", cleared: investRate >= 0.2, progress: ratio(investRate, 0.2), progressLabel: `${(investRate * 100).toFixed(0)}% invested (goal 20%)${investRate * 100 > score.savingsRate + 2 ? " · more than you keep after spending: are all expenses logged?" : ""}`,
    },
    {
      id: "coast", title: "Coast FIRE", book: "The Simple Path to Wealth",
      why: "At Coast FIRE, your existing investments could grow to your full target by your retirement age even if you never add another rupee.",
      howToClear: `Grow FIRE-accessible investments to about ${Math.round(coastNumber).toLocaleString("en-IN")} ${profile.currency}.`,
      href: "/plan", cleared: coastNumber > 0 && accessible >= coastNumber, progress: ratio(accessible, coastNumber), progressLabel: `${(ratio(accessible, coastNumber) * 100).toFixed(0)}% of your Coast number`,
    },
    {
      id: "halfway", title: "Halfway to freedom", book: "The Intelligent Investor",
      why: "Halfway, compounding starts doing as much work as your salary. Staying patient through market swings matters most here.",
      howToClear: "Reach 50% of your FIRE number in FIRE-accessible investments.",
      href: "/dashboard", cleared: score.fireProgress >= 50, progress: ratio(score.fireProgress, 50), progressLabel: `${score.fireProgress.toFixed(1)}% of target`,
    },
    {
      id: "free", title: "Financially independent", book: "The Psychology of Money",
      why: "Your investments can fund your lifestyle. Work becomes a choice — the highest dividend money pays is control over your time.",
      howToClear: "Reach 100% of your FIRE number.",
      href: "/plan", cleared: score.fireProgress >= 100, progress: ratio(score.fireProgress, 100), progressLabel: `${score.fireProgress.toFixed(1)}% of target`,
    },
    {
      id: "fat", title: "Fat FIRE", book: "Die With Zero",
      why: "Freedom with room to spare: 50% more than your FIRE number. More travel and generosity, and a cushion that lets you ride out bad market years without cutting back.",
      howToClear: `Grow FIRE-accessible investments to about ${Math.round(fatTarget).toLocaleString(uae ? "en-AE" : "en-IN")} ${profile.currency} (1.5× your FIRE number).`,
      href: "/plan", cleared: fatTarget > 0 && accessible >= fatTarget, progress: ratio(accessible, fatTarget), progressLabel: `${(ratio(accessible, fatTarget) * 100).toFixed(1)}% of your Fat FIRE number`,
    },
  ];
  // Coast FIRE comes before Halfway only when it's the smaller milestone. With few years left to grow, the
  // Coast number can be more than half the target, so Halfway is reached first.
  const coastIndex = levels.findIndex(level => level.id === "coast");
  if (score.fireTarget > 0 && coastNumber > score.fireTarget * 0.5 && levels[coastIndex + 1]?.id === "halfway") [levels[coastIndex], levels[coastIndex + 1]] = [levels[coastIndex + 1], levels[coastIndex]];
  return levels.map((level, index) => ({ ...level, level: index + 1, progress: level.cleared ? 1 : Math.min(0.99, level.progress) }));
}

export function getCurrentLevel(path: PathLevel[]): PathLevel | null {
  return path.find(level => !level.cleared) ?? null;
}

/* ---------------- XP and ranks ---------------- */

export const RANKS = [
  { name: "Rookie Saver", xp: 0 },
  { name: "Budget Explorer", xp: 300 },
  { name: "Habit Builder", xp: 700 },
  { name: "Steady Investor", xp: 1300 },
  { name: "Compounding Apprentice", xp: 2100 },
  { name: "Wealth Builder", xp: 3200 },
  { name: "Asset Architect", xp: 4600 },
  { name: "Freedom Seeker", xp: 6300 },
  { name: "FIRE Strategist", xp: 8500 },
  { name: "Financially Free Legend", xp: 11000 },
] as const;

export type XpInput = {
  levelsCleared: number;
  badgesEarned: number;
  checkins: number;
  investmentStreak: number;
  lessonsCompleted: number;
  lessonsCorrect: number;
  goalsCreated: number;
  goalsCompleted: number;
  goalProgressPercent: number; // average progress across active goals, 0..100
  whySet?: boolean; // answered "why do you want financial freedom?"
  leaksPlugged?: number; // spending leaks in the "Save more" pledge
  principlesApplied?: number; // book ideas put into practice (lib/bookCoach.ts)
};

export type XpBreakdown = { label: string; xp: number }[];

export function getXp(input: XpInput): { total: number; breakdown: XpBreakdown } {
  const breakdown: XpBreakdown = [
    { label: "Freedom Path levels cleared", xp: input.levelsCleared * 250 },
    { label: "Milestone badges", xp: input.badgesEarned * 100 },
    { label: "Monthly check-ins", xp: input.checkins * 60 },
    { label: "Investing streak bonus", xp: input.investmentStreak * 40 },
    { label: "Book lessons completed", xp: input.lessonsCompleted * 30 + input.lessonsCorrect * 20 },
    { label: "Goals set", xp: input.goalsCreated * 50 },
    { label: "Goals achieved", xp: input.goalsCompleted * 400 },
    { label: "Goal progress", xp: Math.round(input.goalProgressPercent * 3) },
    ...(input.whySet ? [{ label: "Found your why", xp: 100 }] : []),
    ...(input.leaksPlugged ? [{ label: "Spending leaks plugged", xp: Math.min(10, input.leaksPlugged) * 40 }] : []),
    ...(input.principlesApplied ? [{ label: "Book principles in action", xp: input.principlesApplied * 60 }] : []),
  ];
  return { total: breakdown.reduce((sum, item) => sum + item.xp, 0), breakdown };
}

export function getRank(xp: number) {
  let index = 0;
  RANKS.forEach((rank, i) => { if (xp >= rank.xp) index = i; });
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const into = xp - current.xp;
  const span = next ? next.xp - current.xp : 1;
  return { index, rankNumber: index + 1, name: current.name, next: next?.name ?? null, xpToNext: next ? next.xp - xp : 0, progress: next ? Math.min(1, into / span) : 1 };
}

/* ---------------- Freedom metrics and motivation ---------------- */

export type FreedomMetrics = {
  fireTarget: number;
  fireProgress: number;
  freedomMonths: number; // months of current lifestyle your accessible money already covers
  yearsToFire: number | null;
  fireAge: number | null;
  boostAmount: number;
  yearsSavedByBoost: number | null;
};

export function getFreedomMetrics(profile: FinancialProfile, options: PathOptions = {}): FreedomMetrics {
  const score = getFireScore(profile);
  const accessible = Math.max(0, profile.investableAssets ?? profile.fire_accessible_assets ?? profile.assets);
  const expenses = lifestyleExpenses(profile); // steady lifestyle spending, same basis as the FIRE number
  const realRate = (options.expectedReturn ?? 10) - (options.inflation ?? 6);
  const investing = investingPerMonth(profile); // monthly SIPs + invested bonuses spread over the year
  const years = yearsToTarget(accessible, investing, score.fireTarget, realRate);
  // Suggested boost: ~10% of income, rounded to a friendly figure, minimum 1,000.
  const boostAmount = Math.max(1000, Math.round((profile.monthly_income * 0.1) / 1000) * 1000);
  const boosted = yearsToTarget(accessible, investing + boostAmount, score.fireTarget, realRate);
  return {
    fireTarget: score.fireTarget,
    fireProgress: score.fireProgress,
    freedomMonths: expenses > 0 ? accessible / expenses : 0,
    yearsToFire: years,
    fireAge: years !== null && profile.age ? Math.ceil(profile.age + years) : null,
    boostAmount,
    yearsSavedByBoost: years !== null && boosted !== null ? Math.max(0, years - boosted) : years === null && boosted !== null ? null : null,
  };
}

export function getMotivation(metrics: FreedomMetrics, current: PathLevel | null, streak: number): { headline: string; body: string } {
  if (!current) return { headline: "Fat FIRE reached. Freedom with room to spare. 🥂", body: "Protect what you built: keep your buffer, review assumptions yearly, and spend generously on what truly matters to you." };
  if (current.id === "fat") return { headline: "You’re financially independent. 🎉", body: "Work is now a choice. Bonus level: Fat FIRE, 1.5× your FIRE number for extra comfort and a cushion against bad markets." };
  if (streak >= 3) return { headline: `${streak}-month investing streak 🔥`, body: `Consistency beats intensity. Keep the streak alive and clear “${current.title}” next.` };
  if (metrics.freedomMonths >= 12) return { headline: `You already own ${Math.floor(metrics.freedomMonths / 12)} year${metrics.freedomMonths >= 24 ? "s" : ""} of freedom.`, body: `Your FIRE-accessible money could fund your current lifestyle for ${metrics.freedomMonths.toFixed(0)} months. Every SIP adds more.` };
  if (metrics.freedomMonths >= 1) return { headline: `You already own ${metrics.freedomMonths.toFixed(1)} months of freedom.`, body: `That’s time you could live without a salary. Your next level: ${current.title}.` };
  if (current.level <= 2) return { headline: "Every FIRE journey starts with one honest number.", body: "You don’t need to be perfect — you just need to start tracking. Your first level takes about five minutes." };
  return { headline: `Level ${current.level}: ${current.title}`, body: current.why };
}
