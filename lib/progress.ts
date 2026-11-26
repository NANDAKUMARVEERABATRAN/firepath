import type { SupabaseClient } from "@supabase/supabase-js";

export type Snapshot = {
  month_start: string; // YYYY-MM-01
  net_worth: number;
  fire_portfolio: number;
  fire_target: number;
  fire_progress: number; // %
  fire_score: number;
  currency: "INR" | "AED" | "USD";
};

export const monthStartOf = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

/** Saves (or refreshes) this month's snapshot. Quietly does nothing if the table isn't there yet. */
export async function saveSnapshot(supabase: SupabaseClient, userId: string, snapshot: Omit<Snapshot, "month_start">): Promise<void> {
  const round = (value: number) => Math.round(value * 100) / 100;
  await supabase.from("progress_snapshots").upsert({
    user_id: userId, month_start: monthStartOf(),
    net_worth: round(snapshot.net_worth), fire_portfolio: round(Math.max(0, snapshot.fire_portfolio)), fire_target: round(Math.max(0, snapshot.fire_target)),
    fire_progress: round(Math.min(999, Math.max(0, snapshot.fire_progress))), fire_score: Math.round(Math.min(100, Math.max(0, snapshot.fire_score))),
    currency: snapshot.currency, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,month_start" });
}

export function normalizeSnapshots(rows: Record<string, unknown>[] | null | undefined): Snapshot[] {
  return (rows ?? []).map(row => ({
    month_start: String(row.month_start), net_worth: Number(row.net_worth), fire_portfolio: Number(row.fire_portfolio),
    fire_target: Number(row.fire_target), fire_progress: Number(row.fire_progress), fire_score: Number(row.fire_score),
    currency: (row.currency as Snapshot["currency"]) ?? "INR",
  })).sort((a, b) => a.month_start.localeCompare(b.month_start));
}

export type ProgressSummary = {
  months: number; // months between first and latest snapshot
  since: string | null; // first month tracked
  progressGain: number; // percentage points of FIRE progress gained
  portfolioGain: number;
  netWorthGain: number;
  scoreGain: number;
  bestMonth: { month: string; gain: number } | null; // biggest month-on-month FIRE-portfolio gain
};

/** "Look how far you've come": compares the first and latest snapshots. */
export function getProgressSummary(snapshots: Snapshot[]): ProgressSummary {
  const sorted = [...snapshots].sort((a, b) => a.month_start.localeCompare(b.month_start));
  if (sorted.length === 0) return { months: 0, since: null, progressGain: 0, portfolioGain: 0, netWorthGain: 0, scoreGain: 0, bestMonth: null };
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const [fy, fm] = first.month_start.split("-").map(Number);
  const [ly, lm] = last.month_start.split("-").map(Number);
  let bestMonth: ProgressSummary["bestMonth"] = null;
  for (let i = 1; i < sorted.length; i += 1) {
    const gain = sorted[i].fire_portfolio - sorted[i - 1].fire_portfolio;
    if (gain > 0 && (!bestMonth || gain > bestMonth.gain)) bestMonth = { month: sorted[i].month_start, gain };
  }
  return {
    months: (ly - fy) * 12 + (lm - fm),
    since: first.month_start,
    progressGain: last.fire_progress - first.fire_progress,
    portfolioGain: last.fire_portfolio - first.fire_portfolio,
    netWorthGain: last.net_worth - first.net_worth,
    scoreGain: last.fire_score - first.fire_score,
    bestMonth,
  };
}
