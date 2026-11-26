/** Converts between today's money and money in a future year at a given inflation rate. */
export const inFutureMoney = (todayValue: number, inflationPercent: number, years: number) => todayValue * Math.pow(1 + inflationPercent / 100, Math.max(0, years));
export const inTodayMoney = (futureValue: number, inflationPercent: number, years: number) => futureValue / Math.pow(1 + inflationPercent / 100, Math.max(0, years));
