export const guidedCategories = ["housing", "utilities", "groceries", "dining", "transport", "healthcare", "insurance", "education", "family", "debt_repayment", "personal", "savings", "other"] as const;
export type GuidedCategory = (typeof guidedCategories)[number];

export type GuidedBudgetInputs = {
  income: number;
  savingsGoalPercent: number;
  commitments: Partial<Record<GuidedCategory, number>>;
};

export function createGuidedTargets({ income, savingsGoalPercent, commitments }: GuidedBudgetInputs): { targets: Record<GuidedCategory, number>; remainder: number } {
  if (!Number.isFinite(income) || income <= 0) throw new Error("Enter monthly take-home income above zero.");
  if (!Number.isFinite(savingsGoalPercent) || savingsGoalPercent < 0 || savingsGoalPercent > 80) throw new Error("Choose a savings goal between 0% and 80%.");
  const targets = Object.fromEntries(guidedCategories.map(category => [category, Math.max(0, Number(commitments[category]) || 0)])) as Record<GuidedCategory, number>;
  targets.savings = Math.round(income * savingsGoalPercent / 100);
  const total = Object.values(targets).reduce((sum, value) => sum + value, 0);
  if (total > income) throw new Error("Your fixed commitments and savings goal are higher than your take-home income. Adjust them to create a balanced draft.");
  targets.other += income - total;
  return { targets, remainder: income - total };
}

export type BudgetReviewInput = {
  targets: Partial<Record<GuidedCategory, number>>;
  spent: Partial<Record<GuidedCategory, number>>;
  income: number;
  expenses: number;
  invested: number;
  previous?: { income: number; expenses: number; invested: number } | null;
};

export function getBudgetReview(input: BudgetReviewInput): string[] {
  const insights: string[] = [];
  const overruns = guidedCategories
    .filter(category => category !== "savings")
    .map(category => ({ category, variance: (input.spent[category] ?? 0) - (input.targets[category] ?? 0) }))
    .filter(item => item.variance > 0)
    .sort((a, b) => b.variance - a.variance);
  if (overruns.length) insights.push(`${overruns[0].category.replaceAll("_", " ")} is ${overruns[0].variance.toLocaleString("en-IN")} over its target so far. Review the entries and adjust next month’s target if needed.`);
  if (input.income > 0) {
    const savingsRate = ((input.income - input.expenses) / input.income) * 100;
    const investedRate = (input.invested / input.income) * 100;
    insights.push(`Your check-in reports ${savingsRate.toFixed(0)}% left after expenses and ${investedRate.toFixed(0)}% invested. These are based on your monthly totals.`);
    if (input.previous && input.previous.income > 0) {
      const previousRate = ((input.previous.income - input.previous.expenses) / input.previous.income) * 100;
      const change = savingsRate - previousRate;
      if (Math.abs(change) >= 1) insights.push(`Your savings rate ${change > 0 ? "rose" : "fell"} by ${Math.abs(change).toFixed(0)} percentage points compared with the previous saved check-in.`);
      const investmentChange = input.invested - input.previous.invested;
      if (Math.abs(investmentChange) > 0) insights.push(`Monthly investing ${investmentChange > 0 ? "increased" : "decreased"} by ${Math.abs(investmentChange).toLocaleString("en-IN")} compared with the previous saved check-in.`);
    }
  }
  const categorySpend = Object.values(input.spent).reduce((sum, amount) => sum + (amount ?? 0), 0);
  if (categorySpend > 0 && input.expenses > 0) {
    const gap = input.expenses - categorySpend;
    if (gap > input.expenses * 0.1) insights.push(`${gap.toLocaleString("en-IN")} of reported expenses are not represented by category entries. Add the main missing items to make next month’s budget review more useful.`);
  }
  if (!insights.length) insights.push("No category target overruns are recorded yet. Keep logging the month and check again before setting next month’s targets.");
  return insights.slice(0, 3);
}
