import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinancialProfile } from "./fireScore.ts";
import { applyLinkedSavings, type Goal } from "./goals.ts";
import { normalizeSnapshots, type Snapshot } from "./progress.ts";
import { countryFromCurrency, getCountry, readStoredCountry, storeCountry } from "./country.ts";

export type AccountRow = { id: string; name: string; kind: "asset" | "liability"; category: string; investment_type: string | null; current_value: number; monthly_payment: number; is_high_interest: boolean; fire_treatment: string; property_use?: "self_occupied" | "rented" | "investment" | null; goal_id?: string | null };
export type CheckinRow = { month_start: string; income: number; investment_income: number; expenses: number; invested: number; debt_paid: number; salary_savings: number };
export type PlanRow = { retirement_age: number; inflation_rate: number; expected_return: number; withdrawal_rate: number; step_up_percent?: number; step_up_month?: number | null; step_up_done_year?: number | null };
export type LessonRow = { lesson_id: string; answered_correctly: boolean; completed_at: string };

export type FinancialState = {
  userId: string;
  profile: FinancialProfile | null;
  scoreProfile: FinancialProfile | null;
  plan: PlanRow;
  accounts: AccountRow[];
  checkins: CheckinRow[];
  goals: Goal[]; // saved_amount reflects linked portfolio items
  rawGoals: Goal[]; // as stored (manual saved_amount)
  lessons: LessonRow[];
  badgeKeys: string[];
  warnings: string[];
  why: { reasons: string[]; note: string; dreamAge: number | null };
  snapshots: Snapshot[]; // monthly progress history (oldest first)
  cutPlan: CutPlan | null; // "Save more" pledge
};

export type CutPlan = { items: Record<string, number>; monthly_total: number; baseline_expenses: number; committed_at: string; applied?: boolean };

export function normalizeCutPlan(raw: unknown): CutPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CutPlan>;
  const items: Record<string, number> = Object.fromEntries(Object.entries(value.items ?? {}).map(([key, amount]) => [key, Number(amount)] as const).filter(([, amount]) => Number.isFinite(amount) && amount > 0));
  if (!Object.keys(items).length || !value.committed_at) return null;
  return { items, monthly_total: Number(value.monthly_total ?? Object.values(items).reduce((a, b) => a + b, 0)), baseline_expenses: Number(value.baseline_expenses ?? 0), committed_at: String(value.committed_at), applied: Boolean(value.applied) };
}

export const defaultPlan: PlanRow = { retirement_age: 60, inflation_rate: 6, expected_return: 10, withdrawal_rate: 3.5 };

/** Loads everything the game layer needs. Missing optional tables become warnings, not failures. */
export async function loadFinancialState(supabase: SupabaseClient, userId: string): Promise<FinancialState> {
  const warnings: string[] = [];
  const [profileResult, accountsResult, planResult, checkinResult, goalsResult, lessonResult, badgeResult, snapshotResult] = await Promise.all([
    // select("*") so newer optional columns (e.g. fire_reasons) never break loading before their migration runs.
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("financial_accounts").select("*").eq("user_id", userId),
    supabase.from("fire_plans").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("monthly_checkins").select("*").eq("user_id", userId).order("month_start", { ascending: false }).limit(24),
    supabase.from("financial_goals").select("id, name, category, target_amount, target_date, saved_amount, monthly_contribution, expected_return, inflation_rate, completed_at").eq("user_id", userId).order("target_date", { ascending: true }),
    supabase.from("lesson_completions").select("lesson_id, answered_correctly, completed_at").eq("user_id", userId),
    supabase.from("badge_awards").select("badge_key").eq("user_id", userId),
    supabase.from("progress_snapshots").select("*").eq("user_id", userId).order("month_start").limit(60),
  ]);
  if (profileResult.error) throw new Error(`Could not load your profile: ${profileResult.error.message}`);
  if (goalsResult.error || lessonResult.error) warnings.push("Goals and lessons need the latest database migration (202611250013_goals_and_lessons.sql). Run it in the Supabase SQL editor to save them.");

  // select("*") keeps the Journey working whether or not the property_use migration has been applied yet.
  const accounts: AccountRow[] = (accountsResult.data ?? []).map(row => ({ id: row.id, name: row.name, kind: row.kind, category: row.category, investment_type: row.investment_type ?? null, current_value: Number(row.current_value), monthly_payment: Number(row.monthly_payment), is_high_interest: Boolean(row.is_high_interest), fire_treatment: row.fire_treatment, property_use: row.property_use ?? null, goal_id: row.goal_id ?? null }));
  const checkins: CheckinRow[] = (checkinResult.data ?? []).map(row => ({ month_start: row.month_start, income: Number(row.income), investment_income: Number(row.investment_income ?? 0), expenses: Number(row.expenses), invested: Number(row.invested), debt_paid: Number(row.debt_paid), salary_savings: Number(row.salary_pf ?? 0) + Number(row.salary_pension ?? 0) }));
  // The saved profile currency decides the country (₹ India / AED UAE) across the whole app.
  const country = getCountry(countryFromCurrency(profileResult.data?.currency));
  if (profileResult.data?.currency && typeof window !== "undefined" && readStoredCountry() !== country.code) storeCountry(country.code);
  const countryPlan: PlanRow = { retirement_age: country.defaults.retirementAge, inflation_rate: country.defaults.inflation, expected_return: country.defaults.expectedReturn, withdrawal_rate: country.defaults.withdrawal };
  const plan: PlanRow = planResult.data ? { retirement_age: Number(planResult.data.retirement_age ?? countryPlan.retirement_age), inflation_rate: Number(planResult.data.inflation_rate ?? countryPlan.inflation_rate), expected_return: Number(planResult.data.expected_return ?? countryPlan.expected_return), withdrawal_rate: Number(planResult.data.withdrawal_rate ?? countryPlan.withdrawal_rate), step_up_percent: Number(planResult.data.step_up_percent ?? 0), step_up_month: planResult.data.step_up_month ?? null, step_up_done_year: planResult.data.step_up_done_year ?? null } : countryPlan;
  const rawGoals: Goal[] = (goalsResult.data ?? []).map(row => ({ ...row, target_amount: Number(row.target_amount), saved_amount: Number(row.saved_amount), monthly_contribution: Number(row.monthly_contribution), expected_return: Number(row.expected_return), inflation_rate: Number(row.inflation_rate) }));
  const goals: Goal[] = applyLinkedSavings(rawGoals, accounts); // linked portfolio items are the goal's savings

  let profile: FinancialProfile | null = null;
  const data = profileResult.data;
  if (data) {
    const assets = accounts.filter(row => row.kind === "asset");
    const debts = accounts.filter(row => row.kind === "liability");
    const sum = (rows: AccountRow[]) => rows.reduce((total, row) => total + row.current_value, 0);
    profile = {
      age: data.age,
      monthly_income: Number(data.monthly_income),
      monthly_investment_income: Number(data.monthly_investment_income ?? 0),
      monthly_salary_savings: Number(data.monthly_salary_pf ?? 0) + Number(data.monthly_salary_pension ?? 0),
      monthly_expenses: Number(data.monthly_expenses),
      assets: assets.length ? sum(assets) : Number(data.assets),
      investableAssets: assets.length ? sum(assets.filter(row => row.fire_treatment === "available" && !row.goal_id)) : Number(data.fire_accessible_assets ?? data.assets),
      laterRetirementAssets: assets.length ? sum(assets.filter(row => row.fire_treatment === "later")) : Number(data.later_retirement_assets ?? 0),
      fireSplitComplete: assets.length > 0 || (data.fire_accessible_assets !== null && data.later_retirement_assets !== null),
      liabilities: debts.length ? sum(debts) : Number(data.liabilities),
      monthlyDebtPayments: debts.reduce((total, row) => total + row.monthly_payment, 0),
      highInterestDebt: sum(debts.filter(row => row.is_high_interest)),
      detailedDebtData: debts.length > 0,
      emergency_fund: Number(data.emergency_fund),
      monthly_investment: Number(data.monthly_investment),
      has_health_insurance: data.has_health_insurance,
      has_term_insurance: data.has_term_insurance,
      has_dependents: data.has_dependents,
      health_cover_amount: Number(data.health_cover_amount ?? 0),
      term_cover_amount: Number(data.term_cover_amount ?? 0),
      currency: data.currency,
      withdrawal_rate: plan.withdrawal_rate,
    };
  }

  // Like the dashboard: recent check-ins (up to 3) override profile estimates for flow figures.
  let scoreProfile = profile;
  if (profile && checkins.length) {
    const recent = checkins.slice(0, 3);
    const average = (key: "income" | "investment_income" | "expenses" | "invested") => recent.reduce((total, entry) => total + entry[key], 0) / recent.length;
    scoreProfile = { ...profile, monthly_income: average("income"), monthly_investment_income: average("investment_income"), monthly_expenses: average("expenses"), monthly_investment: average("invested"), monthly_salary_savings: recent[0].salary_savings || (profile.monthly_salary_savings ?? 0) };
  }

  return { userId, profile, scoreProfile, plan, accounts, checkins, goals, rawGoals, lessons: lessonResult.data ?? [], badgeKeys: (badgeResult.data ?? []).map(row => row.badge_key), warnings,
    why: { reasons: Array.isArray(data?.fire_reasons) ? data.fire_reasons : [], note: data?.fire_why_note ?? "", dreamAge: data?.dream_age ? Number(data.dream_age) : null },
    snapshots: snapshotResult.error ? [] : normalizeSnapshots(snapshotResult.data),
    cutPlan: normalizeCutPlan(data?.cut_plan) };
}

export function formatMoney(value: number, currency: "INR" | "AED" | "USD" = "INR"): string {
  const locale = currency === "INR" ? "en-IN" : currency === "AED" ? "en-AE" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, notation: Math.abs(value) >= 10_000_000 ? "compact" : "standard" }).format(value);
}

/** Groups assets into a readable portfolio mix. */
export function getPortfolioMix(accounts: AccountRow[]): { label: string; value: number; share: number }[] {
  const labels: Record<string, string> = { mutual_fund: "Mutual funds", stocks: "Stocks", bonds: "Bonds", fixed_deposit: "Fixed deposits", nps_tier_1: "NPS", nps_tier_2: "NPS", provident_fund: "PF / EPF", ppf: "PPF", gold: "Gold", crypto: "Crypto", other: "Other investments", gratuity: "End-of-service gratuity", workplace_savings: "Workplace savings", pension: "Pension" };
  const groups = new Map<string, number>();
  for (const row of accounts.filter(account => account.kind === "asset" && account.current_value > 0)) {
    const label = row.category === "investment" ? labels[row.investment_type ?? "other"] ?? "Other investments" : row.category === "cash" ? "Cash & savings" : row.category === "property" ? (row.fire_treatment === "available" ? "Investment property" : "Your home") : row.category === "vehicle" ? "Vehicles" : "Other";
    groups.set(label, (groups.get(label) ?? 0) + row.current_value);
  }
  const total = [...groups.values()].reduce((a, b) => a + b, 0);
  return [...groups.entries()].map(([label, value]) => ({ label, value, share: total > 0 ? value / total : 0 })).sort((a, b) => b.value - a.value);
}
