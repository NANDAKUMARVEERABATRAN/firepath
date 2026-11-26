export type LaterAssetLot = { value: number; availableFromAge: number | null };

export function projectRetirementAssets(input: {
  age: number;
  year: number;
  accessibleAssets: number;
  monthlyContribution: number;
  annualGrowthPercent: number;
  laterAssets: LaterAssetLot[];
}): number {
  const { age, year, accessibleAssets, monthlyContribution, annualGrowthPercent, laterAssets } = input;
  const annualRate = annualGrowthPercent / 100;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const months = year * 12;
  const accessibleValue = accessibleAssets * Math.pow(1 + annualRate, year);
  const contributionsValue = months === 0 ? 0 : monthlyRate === 0
    ? monthlyContribution * months
    : monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  const unlockedValue = laterAssets.reduce((sum, lot) => {
    if (lot.availableFromAge === null || age + year < lot.availableFromAge) return sum;
    return sum + lot.value * Math.pow(1 + annualRate, year);
  }, 0);
  return accessibleValue + contributionsValue + unlockedValue;
}

export function sumLaterAssets(lots: LaterAssetLot[]): { total: number; scheduled: number; accessAgeUnknown: number } {
  return lots.reduce((result, lot) => {
    result.total += lot.value;
    if (lot.availableFromAge === null) result.accessAgeUnknown += lot.value;
    else result.scheduled += lot.value;
    return result;
  }, { total: 0, scheduled: 0, accessAgeUnknown: 0 });
}
