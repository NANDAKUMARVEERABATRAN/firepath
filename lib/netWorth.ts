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

export function getNetWorthBreakdown(rows: Row[]): NetWorthBreakdown {
  const b = { fireInvestments: 0, investmentProperty: 0, goalMoney: 0, laterRetirement: 0, home: 0, otherOutside: 0, homeLoan: 0, otherLoans: 0 };
  for (const row of rows) {
    const value = Math.max(0, Number(row.current_value) || 0);
    if (row.kind === "liability") {
      if (row.category === "home_loan") b.homeLoan += value; else b.otherLoans += value;
    } else if (row.goal_id) b.goalMoney += value;
    else if (row.category === "property") {
      if (row.fire_treatment === "available") b.investmentProperty += value;
      else if (row.fire_treatment === "later") b.laterRetirement += value;
      else b.home += value;
    } else if (row.fire_treatment === "available") b.fireInvestments += value;
    else if (row.fire_treatment === "later") b.laterRetirement += value;
    else b.otherOutside += value;
  }
  const totalAssets = b.fireInvestments + b.investmentProperty + b.goalMoney + b.laterRetirement + b.home + b.otherOutside;
  const totalLiabilities = b.homeLoan + b.otherLoans;
  return { ...b, fireAccessible: b.fireInvestments + b.investmentProperty, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, homeEquity: b.home - b.homeLoan };
}
