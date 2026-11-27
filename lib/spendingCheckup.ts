/**
 * Monthly spending check-up: points out the 2–3 best places to save, from the person's own numbers.
 * It never decides what someone "should" value: needs are only flagged when they go over the person's own
 * limit, and any category can be marked "I value this" so it's never flagged.
 */

/** Essentials: flagged only when over the person's own limit. */
export const NEEDS = new Set(["housing", "groceries", "utilities", "healthcare", "insurance", "education", "family"]);
/** Flexible spending, and a rough "typical share of income" guide for each (education only, not rules). */
export const WANT_GUIDE: Record<string, number> = { dining: 0.08, personal: 0.1, transport: 0.12, other: 0.08 };

export type CheckupInput = {
  thisMonth: Record<string, number>; // category → spent this month
  previous: Record<string, number>[]; // earlier months (most recent first), category → spent
  limits: Record<string, number>;
  earned: number; // take-home + EPF/NPS
  valued: string[]; // categories the person chose never to flag
};

export type CheckupItem = {
  category: string;
  kind: "over_limit" | "rising" | "high_share";
  spent: number;
  reference: number; // the limit, the usual amount, or the typical share
  monthlySaving: number;
  yearlySaving: number;
};

const MIN_SAVING = 500; // ignore tiny differences

export function spendingCheckup(input: CheckupInput): CheckupItem[] {
  const found = new Map<string, CheckupItem>();
  const consider = (item: Omit<CheckupItem, "yearlySaving">) => {
    if (item.monthlySaving < MIN_SAVING) return;
    const full = { ...item, monthlySaving: Math.round(item.monthlySaving), yearlySaving: Math.round(item.monthlySaving * 12) };
    const existing = found.get(item.category);
    if (!existing || full.monthlySaving > existing.monthlySaving) found.set(item.category, full);
  };
  for (const [category, spent] of Object.entries(input.thisMonth)) {
    if (!(spent > 0) || input.valued.includes(category)) continue;
    const limit = input.limits[category] ?? 0;
    if (limit > 0 && spent > limit) consider({ category, kind: "over_limit", spent, reference: limit, monthlySaving: spent - limit });
    if (NEEDS.has(category)) continue; // essentials: only the person's own limit counts
    const history = input.previous.map(m => m[category] ?? 0).filter(v => v > 0);
    if (history.length) {
      const usual = history.reduce((s, v) => s + v, 0) / history.length;
      if (spent > usual * 1.2) consider({ category, kind: "rising", spent, reference: usual, monthlySaving: spent - usual });
    }
    const guide = WANT_GUIDE[category];
    if (guide && input.earned > 0 && spent > input.earned * guide) consider({ category, kind: "high_share", spent, reference: input.earned * guide, monthlySaving: spent - input.earned * guide });
  }
  return [...found.values()].sort((a, b) => b.monthlySaving - a.monthlySaving).slice(0, 3);
}

/** Days since a date string; used for "update your EPF/NPS balance every quarter". */
export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}
