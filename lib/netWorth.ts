export type PropertyUse = "self_occupied" | "rented" | "investment";
export type FireTreatment = "available" | "later" | "excluded";

export const propertyUseLabels: Record<PropertyUse, string> = {
  self_occupied: "I live in it (my home)",
  rented: "Rented out",
  investment: "Held as investment (plot, land, flat)",
};

/** A home you live in cannot fund your retirement without selling it, so it stays outside FIRE. Rented or investment property counts. */
export function propertyTreatment(use: PropertyUse | null | undefined): FireTreatment {
  return use === "rented" || use === "investment" ? "available" : "excluded";
}

type Row = { kind: "asset" | "liability"; category: string; current_value: number; fire_treatment: string; property_use?: PropertyUse | null; goal_id?: string | null };

/** True when an asset counts toward the FIRE-accessible portfolio: usable now AND not set aside for a life goal. */
export const isFireAccessible = (row: Pick<Row, "kind" | "fire_treatment" | "goal_id">) => row.kind === "asset" && row.fire_treatment === "available" && !row.goal_id;

export type NetWorthBreakdown = {
  fireInvestments: number; // cash & investments available for FIRE now
  investmentProperty: number; // rented / investment property (counts toward FIRE)
  goalMoney: number; // set aside for life goals (house, kids, trips) — not FIRE
  laterRetirement: number; // EPF, PPF, NPS etc.
  home: number; // self-occupied property
  otherOutside: number; // vehicles, other excluded assets
  homeLoan: number;
  otherLoans: number;
  fireAccessible: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  homeEquity: number;
};

export type Bucket = "fireInvestments" | "investmentProperty" | "goalMoney" | "laterRetirement" | "home" | "otherOutside" | "homeLoan" | "otherLoans";

/** Which group of "Where your net worth sits" an item belongs to (one rule, used for totals and item lists). */
export function bucketOf(row: Pick<Row, "kind" | "category" | "fire_treatment" | "goal_id">): Bucket {
  if (row.kind === "liability") return row.category === "home_loan" ? "homeLoan" : "otherLoans";
  if (row.goal_id) return "goalMoney";
  if (row.category === "property") return row.fire_treatment === "available" ? "investmentProperty" : row.fire_treatment === "later" ? "laterRetirement" : "home";
  return row.fire_treatment === "available" ? "fireInvestments" : row.fire_treatment === "later" ? "laterRetirement" : "otherOutside";
}

export function getNetWorthBreakdown(rows: Row[]): NetWorthBreakdown {
  const b: Record<Bucket, number> = { fireInvestments: 0, investmentProperty: 0, goalMoney: 0, laterRetirement: 0, home: 0, otherOutside: 0, homeLoan: 0, otherLoans: 0 };
  for (const row of rows) b[bucketOf(row)] += Math.max(0, Number(row.current_value) || 0);
  const totalAssets = b.fireInvestments + b.investmentProperty + b.goalMoney + b.laterRetirement + b.home + b.otherOutside;
  const totalLiabilities = b.homeLoan + b.otherLoans;
  return { ...b, fireAccessible: b.fireInvestments + b.investmentProperty, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, homeEquity: b.home - b.homeLoan };
}
