export const goalCategories = [
  { id: "home", label: "Buy or build a home", emoji: "🏠" },
  { id: "education", label: "Kids’ school & college", emoji: "🎓" },
  { id: "wedding", label: "Kids’ or own wedding", emoji: "💍" },
  { id: "travel", label: "Trip or holiday", emoji: "✈️" },
  { id: "vehicle", label: "Car or bike", emoji: "🚗" },
  { id: "parents", label: "Parents’ care", emoji: "🤝" },
  { id: "emergency", label: "Emergency fund", emoji: "🛟" },
  { id: "gadget", label: "Gadget or purchase", emoji: "📱" },
  { id: "other", label: "Something else", emoji: "⭐" },
  { id: "retirement", label: "Retirement / FIRE", emoji: "🔥" }, // legacy: FIRE is now the main goal, not a side goal
] as const;

export type GoalCategory = (typeof goalCategories)[number]["id"];
/** Side-goal types offered when creating a goal. FIRE itself is the main goal, so it isn't listed. */
export const sideGoalCategories = goalCategories.filter(category => category.id !== "retirement");

/**
 * Portfolio items linked to a goal ARE that goal's savings — no need to type them again.
 * If a goal has linked items, its saved amount is their total; otherwise the manually entered amount is used.
 */
export function applyLinkedSavings<G extends { id: string; saved_amount: number }>(goals: G[], accounts: { kind: string; goal_id?: string | null; current_value: number }[]): (G & { linkedCount: number })[] {
  return goals.map(goal => {
    const linked = accounts.filter(account => account.kind === "asset" && account.goal_id === goal.id);
    return linked.length
      ? { ...goal, saved_amount: linked.reduce((sum, account) => sum + Number(account.current_value), 0), linkedCount: linked.length }
      : { ...goal, linkedCount: 0 };
  });
}

export type Goal = {
  id: string;
  name: string;
  category: GoalCategory;
  target_amount: number; // amount needed on the target date (future cost, entered by the user)
  target_date: string; // YYYY-MM-DD
  saved_amount: number;
  monthly_contribution: number;
  expected_return: number; // % per year
  inflation_rate: number; // legacy column; not used — target_amount is already the future cost
  completed_at: string | null;
};

export type GoalStatus = "achieved" | "ahead" | "on-track" | "behind" | "overdue";

export type GoalAnalysis = {
  monthsLeft: number;
  futureTarget: number;
  projectedValue: number;
  requiredMonthly: number;
  progress: number; // 0..100 of the inflation-adjusted target
  status: GoalStatus;
  shortfall: number;
};

export function monthsBetween(from: Date, toIso: string): number {
  const [year, month] = toIso.split("-").map(Number);
  return Math.max(0, (year - from.getFullYear()) * 12 + (month - 1 - from.getMonth()));
}

function futureValue(present: number, monthly: number, annualReturn: number, months: number): number {
  const rate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  const lump = present * Math.pow(1 + rate, months);
  const stream = rate === 0 ? monthly * months : monthly * (Math.pow(1 + rate, months) - 1) / rate;
  return lump + stream;
}

export function analyzeGoal(goal: Goal, today = new Date()): GoalAnalysis {
  const monthsLeft = monthsBetween(today, goal.target_date);
  const futureTarget = goal.target_amount;
  const projectedValue = futureValue(goal.saved_amount, goal.monthly_contribution, goal.expected_return, monthsLeft);
  const rate = Math.pow(1 + goal.expected_return / 100, 1 / 12) - 1;
  const gapAfterGrowth = futureTarget - goal.saved_amount * Math.pow(1 + rate, monthsLeft);
  const requiredMonthly = gapAfterGrowth <= 0 ? 0 : monthsLeft === 0 ? gapAfterGrowth : rate === 0 ? gapAfterGrowth / monthsLeft : gapAfterGrowth * rate / (Math.pow(1 + rate, monthsLeft) - 1);
  const progress = futureTarget > 0 ? Math.min(100, (goal.saved_amount / futureTarget) * 100) : 0;
  let status: GoalStatus;
  if (goal.completed_at || goal.saved_amount >= futureTarget) status = "achieved";
  else if (monthsLeft === 0) status = "overdue";
  else if (projectedValue >= futureTarget * 1.1) status = "ahead";
  else if (projectedValue >= futureTarget * 0.97) status = "on-track";
  else status = "behind";
  return { monthsLeft, futureTarget, projectedValue, requiredMonthly: Math.max(0, requiredMonthly), progress, status, shortfall: Math.max(0, futureTarget - projectedValue) };
}

export const statusLabel: Record<GoalStatus, string> = {
  achieved: "Achieved 🎉",
  ahead: "Ahead of plan",
  "on-track": "On track",
  behind: "Needs a boost",
  overdue: "Date passed",
};
