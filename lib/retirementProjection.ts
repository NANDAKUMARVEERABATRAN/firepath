export type LaterAssetLot = { value: number; availableFromAge: number | null };

type ProjectionInput = {
  age: number;
  year: number;
  accessibleAssets: number;
  monthlyContribution: number;
  annualGrowthPercent: number;
  laterAssets: LaterAssetLot[];
};

/** Where projected wealth comes from: today's money growing, new investing, and later-access funds that unlock by then. */
export function projectBreakdown(input: ProjectionInput): { grown: number; contributions: number; contributed: number; unlocked: number; total: number } {
  const { age, year, accessibleAssets, monthlyContribution, annualGrowthPercent, laterAssets } = input;
  const annualRate = annualGrowthPercent / 100;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const months = year * 12;
  const grown = accessibleAssets * Math.pow(1 + annualRate, year);
  const contributions = months === 0 ? 0 : monthlyRate === 0
    ? monthlyContribution * months
    : monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  const unlocked = laterAssets.reduce((sum, lot) => {
    if (lot.availableFromAge === null || age + year < lot.availableFromAge) return sum;
    return sum + lot.value * Math.pow(1 + annualRate, year);
  }, 0);
  return { grown, contributions, contributed: monthlyContribution * months, unlocked, total: grown + contributions + unlocked };
}

export function projectRetirementAssets(input: ProjectionInput): number {
  return projectBreakdown(input).total;
}

export function sumLaterAssets(lots: LaterAssetLot[]): { total: number; scheduled: number; accessAgeUnknown: number } {
  return lots.reduce((result, lot) => {
    result.total += lot.value;
    if (lot.availableFromAge === null) result.accessAgeUnknown += lot.value;
    else result.scheduled += lot.value;
    return result;
  }, { total: 0, scheduled: 0, accessAgeUnknown: 0 });
}
