import { investingPerMonth } from "./extraInvesting.ts";

export type FinancialProfile = {
  age: number | null;
  monthly_income: number;
  monthly_investment_income?: number;
  /** EPF/VPF + NPS (UAE: workplace savings + pension) deducted from salary; not part of monthly_income. */
  monthly_salary_savings?: number;
  monthly_expenses: number;
  assets: number;
  investableAssets?: number;
  fire_accessible_assets?: number;
  later_retirement_assets?: number;
  laterRetirementAssets?: number;
  fireSplitComplete?: boolean;
  liabilities: number;
  emergency_fund: number;
  monthly_investment: number;
  /** Bonus/extra earnings invested per year (profile, or logged one-offs over the last 12 months). */
  yearly_extra_investment?: number;
  has_health_insurance: boolean;
  has_term_insurance: boolean;
  has_dependents?: boolean;
  health_cover_amount?: number;
  term_cover_amount?: number;
  currency: "INR" | "AED" | "USD";
  monthlyDebtPayments?: number;
  highInterestDebt?: number;
  detailedDebtData?: boolean;
  withdrawal_rate?: number;
  /** Optional monthly spending after you stop working (today's money); the FIRE number uses it when set. */
  retirement_expenses?: number | null;
  /** Steady monthly spending from the profile (rent, EMIs, groceries…). The FIRE number and freedom years use this,
   *  not a single month’s log, so a partly-logged month can’t shrink the goal. */
  lifestyle_expenses?: number;
};

/** Normal monthly spending: the profile’s steady figure when known, else the logged/entered spending. */
export const lifestyleExpenses = (profile: Pick<FinancialProfile, "monthly_expenses" | "lifestyle_expenses">) => Math.max(0, profile.lifestyle_expenses != null && profile.lifestyle_expenses > 0 ? profile.lifestyle_expenses : profile.monthly_expenses);

/** Monthly spending the FIRE number is built on: planned retirement spending if set, else today's spending. */
export const targetExpenses = (profile: Pick<FinancialProfile, "monthly_expenses" | "retirement_expenses" | "lifestyle_expenses">) => profile.retirement_expenses != null && profile.retirement_expenses > 0 ? profile.retirement_expenses : lifestyleExpenses(profile);

export type ScoreCategory = { name: string; score: number; max: number; explanation: string };

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

/** Everything earned in a month: take-home that reaches the bank + retirement savings deducted from salary. */
export const totalIncome = (profile: Pick<FinancialProfile, "monthly_income" | "monthly_salary_savings" | "yearly_extra_investment">) => Math.max(0, profile.monthly_income) + Math.max(0, profile.monthly_salary_savings ?? 0) + Math.max(0, profile.yearly_extra_investment ?? 0) / 12; // + the invested part of bonuses, spread monthly

export function getFireScore(profile: FinancialProfile): { score: number; categories: ScoreCategory[]; netWorth: number; savingsRate: number; emergencyMonths: number; fireTarget: number; fireProgress: number; withdrawalRate: number; debtServiceRate: number } {
  const income = totalIncome(profile);
  const expenses = Math.max(0, profile.monthly_expenses);
  const emergencyMonths = lifestyleExpenses(profile) > 0 ? profile.emergency_fund / lifestyleExpenses(profile) : 0;
  const savingsRate = income > 0 ? clamp(((income - expenses) / income) * 100, 100) : 0;
  // Salary deductions (EPF/NPS) are investing too, even though they're not FIRE-accessible until later.
  const investingRate = income > 0 ? clamp(((investingPerMonth(profile) + (profile.monthly_salary_savings ?? 0)) / income) * 100, 100) : 0;
  const netWorth = profile.assets - profile.liabilities;
  const fireAssets = Math.max(0, profile.investableAssets ?? profile.fire_accessible_assets ?? profile.assets);
  const withdrawalRate = (profile.withdrawal_rate ?? 3.5) / 100;
  const fireTarget = targetExpenses(profile) > 0 && withdrawalRate > 0 ? (targetExpenses(profile) * 12) / withdrawalRate : 0;
  const fireProgress = fireTarget > 0 ? clamp((fireAssets / fireTarget) * 100, 100) : 0;
  const debtServiceRate = income > 0 ? (profile.monthlyDebtPayments ?? 0) / income : 0;
  const highInterestDebtRatio = income > 0 ? (profile.highInterestDebt ?? 0) / (income * 12) : 0;
  const debtHealthScore = profile.liabilities <= 0
    ? 15
    : profile.detailedDebtData
      ? income <= 0 ? 0 : clamp((1 - debtServiceRate / 0.35) * 8, 8) + clamp((1 - highInterestDebtRatio) * 7, 7)
      : income <= 0 ? 0 : clamp((1 - profile.liabilities / (income * 24)) * 15, 15);

  const categories: ScoreCategory[] = [
    { name: "Emergency buffer", score: clamp((emergencyMonths / 6) * 20, 20), max: 20, explanation: `${emergencyMonths.toFixed(1)} months covered; up to 6 months earns full points.` },
    { name: "Spending & saving", score: clamp((savingsRate / 30) * 20, 20), max: 20, explanation: `${savingsRate.toFixed(0)}% of income remains after expenses; 30% earns full points.` },
    { name: "Regular investing", score: clamp((investingRate / 20) * 20, 20), max: 20, explanation: `${investingRate.toFixed(0)}% of income invested monthly; 20% earns full points.` },
    { name: "Protection review", score: (profile.has_health_insurance && (profile.health_cover_amount ?? 0) > 0 ? 7.5 : 0) + (!profile.has_dependents || (profile.has_term_insurance && (profile.term_cover_amount ?? 0) > 0) ? 7.5 : 0), max: 15, explanation: `Self-reported health cover: ${profile.has_health_insurance ? "yes" : "no"}${profile.has_health_insurance && profile.health_cover_amount ? ` (${profile.health_cover_amount.toLocaleString()} ${profile.currency})` : ""}. ${profile.has_dependents ? `Term cover: ${profile.has_term_insurance ? "yes" : "no"}${profile.has_term_insurance && profile.term_cover_amount ? ` (${profile.term_cover_amount.toLocaleString()} ${profile.currency})` : ""}.` : "No income dependents reported, so term cover is not scored."} This does not judge suitability.` },
    { name: "Debt health", score: debtHealthScore, max: 15, explanation: profile.detailedDebtData ? `Debt payments use ${(debtServiceRate * 100).toFixed(0)}% of income; high-interest debt is ${highInterestDebtRatio.toFixed(1)}× annual income. Lower burdens earn more points.` : "Based on total debt relative to income. Add individual loans to include monthly payments and high-interest debt in this category." },
    { name: "FIRE progress", score: clamp((fireProgress / 100) * 10, 10), max: 10, explanation: `${fireProgress.toFixed(1)}% of an illustrative target using ${fireAssets.toLocaleString()} ${profile.currency} in FIRE-accessible investments and a ${profile.withdrawal_rate ?? 3.5}% withdrawal assumption.` },
  ].map(category => ({ ...category, score: Math.round(category.score * 10) / 10 }));

  return { score: Math.round(categories.reduce((total, category) => total + category.score, 0)), categories, netWorth, savingsRate, emergencyMonths, fireTarget, fireProgress, withdrawalRate: profile.withdrawal_rate ?? 3.5, debtServiceRate };
}

export type ActionStep = { title: string; detail: string; href: string; priority: "focus" | "review" | "build" };

export function getActionSteps(profile: FinancialProfile): ActionStep[] {
  const actions: ActionStep[] = [];
  const income = totalIncome(profile);
  const expenses = Math.max(0, profile.monthly_expenses); // logged cash flow
  const emergencyMonths = lifestyleExpenses(profile) > 0 ? profile.emergency_fund / lifestyleExpenses(profile) : 0;
  const debtPaymentRate = income > 0 ? (profile.monthlyDebtPayments ?? 0) / income : 0;

  if (income <= 0 || expenses <= 0 || expenses >= income) {
    actions.push({ title: "Understand this month’s cash flow", detail: "Record income and spending to see what is available after essential costs. Start with one month of actual numbers.", href: "/month", priority: "focus" });
  }
  if ((profile.highInterestDebt ?? 0) > 0) {
    actions.push({ title: "Review high-interest balances", detail: "Compare each balance, rate, and required payment. The app does not choose a payoff strategy or recommend a financial product.", href: "/accounts", priority: "focus" });
  }
  if (profile.detailedDebtData && debtPaymentRate > 0.35) {
    actions.push({ title: "Review monthly debt pressure", detail: `Recorded loan payments use ${(debtPaymentRate * 100).toFixed(0)}% of monthly income. Recheck your budget and consider getting qualified help if payments are difficult to manage.`, href: "/accounts", priority: "focus" });
  }
  if (emergencyMonths < 3) {
    actions.push({ title: "Build a cash buffer in stages", detail: `Your recorded emergency savings cover ${emergencyMonths.toFixed(1)} months of expenses. Choose a first target that fits your situation, then review it over time.`, href: "/profile", priority: emergencyMonths < 1 ? "focus" : "build" });
  }
  if (!profile.has_health_insurance || (profile.has_dependents && !profile.has_term_insurance)) {
    actions.push({ title: "Review protection for your situation", detail: "Record your existing cover and consider your household’s needs. The score does not assess suitable coverage or recommend policies.", href: "/profile", priority: "review" });
  }
  if (income > expenses && profile.monthly_investment <= 0) {
    actions.push({ title: "Choose a repeatable investing habit", detail: "If your budget allows, decide what monthly amount feels sustainable and track it. This app does not suggest investments.", href: "/profile", priority: "build" });
  }
  if (actions.length === 0) {
    actions.push({ title: "Keep your plan current", detail: "Update your monthly check-in and review your FIRE assumptions when your circumstances change.", href: "/month", priority: "build" });
  }
  return actions.slice(0, 4);
}

export type Badge = { name: string; description: string; earned: boolean };

export function getInvestmentStreak(checkins: { month_start: string; invested: number }[]): number {
  if (!checkins.length) return 0;
  const monthIndex = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return year * 12 + monthNumber - 1;
  };
  const entries = [...checkins].sort((a, b) => b.month_start.localeCompare(a.month_start));
  const latest = entries[0];
  const now = new Date();
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  let expected = monthIndex(latest.month_start);
  if (currentMonthIndex - expected > 1 || latest.invested <= 0) return 0;
  let streak = 1;
  for (const entry of entries.slice(1)) {
    expected -= 1;
    if (monthIndex(entry.month_start) !== expected || entry.invested <= 0) break;
    streak += 1;
  }
  return streak;
}

export function getBadges(profile: FinancialProfile, investmentStreak = 0): Badge[] {
  const income = totalIncome(profile);
  const savingsRate = income > 0 ? ((income - profile.monthly_expenses) / income) * 100 : 0;
  const emergencyMonths = lifestyleExpenses(profile) > 0 ? profile.emergency_fund / lifestyleExpenses(profile) : 0;
  const withdrawalRate = (profile.withdrawal_rate ?? 3.5) / 100;
  const target = targetExpenses(profile) > 0 && withdrawalRate > 0 ? (targetExpenses(profile) * 12) / withdrawalRate : 0;
  const progress = target > 0 ? Math.max(0, (profile.investableAssets ?? profile.fire_accessible_assets ?? profile.assets) / target) * 100 : 0;
  return [
    { name: "Money Map Maker", description: "Complete your financial profile.", earned: Boolean(profile.age && profile.monthly_income > 0 && profile.monthly_expenses > 0) },
    { name: "Mindful Money", description: "Record your monthly income and expenses.", earned: profile.monthly_income > 0 && profile.monthly_expenses > 0 },
    { name: "Safety Net Starter", description: "Build one month of emergency savings.", earned: emergencyMonths >= 1 },
    { name: "Resilience Builder", description: "Build three months of emergency savings.", earned: emergencyMonths >= 3 },
    { name: "Steady Saver", description: "Reach a savings rate of 20% or more.", earned: savingsRate >= 20 },
    { name: "Investment Starter", description: "Set a regular monthly investment amount.", earned: profile.monthly_investment > 0 },
    { name: "Consistency Champion", description: "Record investments in three consecutive monthly check-ins.", earned: investmentStreak >= 3 },
    { name: "Debt Tamer", description: "Report no outstanding liabilities.", earned: profile.liabilities === 0 && profile.assets > 0 },
    { name: "Protection Planner", description: "Record health cover and review term cover if someone depends on your income.", earned: profile.has_health_insurance && (profile.health_cover_amount ?? 0) > 0 && (!profile.has_dependents || (profile.has_term_insurance && (profile.term_cover_amount ?? 0) > 0)) },
    { name: "Freedom Fueler", description: "Reach a savings rate of 30% or more.", earned: savingsRate >= 30 },
    { name: "Trailblazer", description: "Reach 25% of your illustrative FIRE number.", earned: progress >= 25 },
    { name: "Pathfinder", description: "Reach 50% of your illustrative FIRE number.", earned: progress >= 50 },
    { name: "Pioneer", description: "Reach 75% of your illustrative FIRE number.", earned: progress >= 75 },
    { name: "Freedom Finisher", description: "Reach 100% of your illustrative FIRE number.", earned: progress >= 100 },
  ];
}
