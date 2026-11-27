/**
 * Life after FIRE: year by year from the day you stop working. Each year you take out that year's
 * expenses (which rise with inflation), and what's left grows at the post-retirement return.
 * This is the assumption behind the withdrawal-rate rule, made visible.
 */
export type DrawdownYear = {
  age: number;
  monthlyWithdrawal: number; // in rupees of that year
  startBalance: number; // nominal
  endBalance: number; // nominal, after withdrawal and growth
  endBalanceToday: number; // end balance in today's money (retirement-year rupees deflated back to today)
};

export type DrawdownResult = { years: DrawdownYear[]; runsOutAt: number | null; endAge: number };

export function simulateDrawdown(input: {
  retireAge: number;
  corpus: number; // money at the retirement age (nominal)
  firstYearExpenses: number; // annual spending in the first year after stopping work (nominal)
  inflationPercent: number;
  returnPercent: number; // nominal yearly return after retirement
  yearsFromToday: number; // years between today and the retirement age (to show today's money)
  endAge?: number;
}): DrawdownResult {
  const endAge = input.endAge ?? 100;
  const i = input.inflationPercent / 100, r = input.returnPercent / 100;
  const years: DrawdownYear[] = [];
  let balance = Math.max(0, input.corpus);
  let runsOutAt: number | null = null;
  for (let age = input.retireAge, n = 0; age < endAge; age += 1, n += 1) {
    const withdrawal = input.firstYearExpenses * Math.pow(1 + i, n);
    const start = balance;
    const afterWithdrawal = start - withdrawal; // withdraw at the start of the year, then the rest grows
    balance = afterWithdrawal > 0 ? afterWithdrawal * (1 + r) : 0;
    if (afterWithdrawal <= 0 && runsOutAt === null) runsOutAt = age;
    years.push({ age, monthlyWithdrawal: withdrawal / 12, startBalance: start, endBalance: balance, endBalanceToday: balance / Math.pow(1 + i, input.yearsFromToday + n + 1) });
    if (runsOutAt !== null) break;
  }
  return { years, runsOutAt, endAge };
}

/** Withdrawal rate that would last until `endAge` (binary search), as a guide when the plan runs short. */
export function sustainableWithdrawalRate(input: { retireAge: number; inflationPercent: number; returnPercent: number; endAge?: number }): number {
  let low = 0.5, high = 15;
  for (let k = 0; k < 40; k += 1) {
    const mid = (low + high) / 2;
    const sim = simulateDrawdown({ retireAge: input.retireAge, corpus: 100, firstYearExpenses: mid, inflationPercent: input.inflationPercent, returnPercent: input.returnPercent, yearsFromToday: 0, endAge: input.endAge });
    if (sim.runsOutAt === null) low = mid; else high = mid;
  }
  return Math.floor(low * 20) / 20; // round down to 0.05%
}
