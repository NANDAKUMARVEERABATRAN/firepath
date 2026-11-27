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

/* ---------------- Same item added twice ---------------- */

type ItemKey = { id: string; kind: string; category: string; investment_type?: string | null; property_use?: string | null; name: string; current_value: number; created_at?: string | null; updated_at?: string | null };

const typeKey = (a: Omit<ItemKey, "id" | "name" | "current_value">) => [a.kind, a.category, a.investment_type ?? "", a.category === "property" ? a.property_use ?? "" : ""].join("|");
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").replace(/\b(s|funds?)\b/g, "fund").trim();
const newest = (a: ItemKey) => a.updated_at ?? a.created_at ?? "";

/** Items of the same type (e.g. all mutual funds), newest first: picking that type again should update, not add. */
export function sameTypeItems<T extends ItemKey>(accounts: T[], pick: Omit<ItemKey, "id" | "name" | "current_value">): T[] {
  const key = typeKey(pick);
  return accounts.filter(a => typeKey(a) === key).sort((x, y) => newest(y).localeCompare(newest(x)));
}

/**
 * Groups of items with the same type AND the same name: almost always one holding added again
 * with a new value instead of being updated. The first item in each group is the newest.
 */
export function duplicateGroups<T extends ItemKey>(accounts: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const a of accounts) { const k = `${typeKey(a)}#${nameKey(a.name)}`; groups.set(k, [...(groups.get(k) ?? []), a]); }
  return [...groups.values()].filter(g => g.length > 1).map(g => [...g].sort((x, y) => newest(y).localeCompare(newest(x))));
}

/** The saved item this new entry would duplicate (same type and same name), if any. */
export function existingSameItem<T extends ItemKey>(accounts: T[], entry: Omit<ItemKey, "id" | "current_value">): T | null {
  const key = typeKey(entry), name = nameKey(entry.name);
  return sameTypeItems(accounts, entry).find(a => typeKey(a) === key && nameKey(a.name) === name) ?? null;
}
