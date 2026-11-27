/**
 * Market-fall coach. People stop investing (and stop opening their FIRE app) when markets fall.
 * We watch the Nifty 50 through a Nifty 50 index fund's daily NAV (free, public: mfapi.in / AMFI)
 * and, when it is well below its 1-year high, show calm, numbers-based encouragement.
 */
import { yearsToTarget } from "./freedomPath.ts";

/** UTI Nifty 50 Index Fund, Direct Growth: tracks the Nifty 50 closely. */
export const NIFTY_PROXY_SCHEME = 120716;

export type NavPoint = { date: string; nav: string | number }; // mfapi.in: date "dd-mm-yyyy"
export type MarketState = { latest: number; high: number; highDate: string; asOf: string; drawdown: number }; // drawdown in % (positive = below high)
export type MarketMood = "calm" | "dip" | "correction" | "bear";

const toIso = (d: string) => { const [dd, mm, yyyy] = d.split("-"); return `${yyyy}-${mm}-${dd}`; };

/** How far the latest value is below the highest value of the last `days` days. */
export function drawdownFromNavs(points: NavPoint[], days = 365): MarketState | null {
  const rows = points.map(p => ({ date: /^\d{2}-\d{2}-\d{4}$/.test(p.date) ? toIso(p.date) : p.date, nav: Number(p.nav) }))
    .filter(p => Number.isFinite(p.nav) && p.nav > 0).sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return null;
  const latest = rows[0];
  const from = new Date(`${latest.date}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - days);
  const since = from.toISOString().slice(0, 10);
  const window = rows.filter(r => r.date >= since);
  const peak = window.reduce((best, r) => (r.nav > best.nav ? r : best), window[0]);
  return { latest: latest.nav, high: peak.nav, highDate: peak.date, asOf: latest.date, drawdown: Math.max(0, (1 - latest.nav / peak.nav) * 100) };
}

export function marketMood(drawdown: number): MarketMood {
  return drawdown >= 20 ? "bear" : drawdown >= 10 ? "correction" : drawdown >= 5 ? "dip" : "calm";
}

/**
 * How many months a fall of `fallPercent` in the equity part of the FIRE portfolio moves the FIRE date,
 * if the person keeps investing as usual. Usually months, not years: that's the message.
 */
export function fireDelayMonths(input: { accessible: number; equityShare: number; fallPercent: number; monthlyInvestment: number; target: number; realReturnPercent: number }): number | null {
  const { accessible, equityShare, fallPercent, monthlyInvestment, target, realReturnPercent } = input;
  const before = yearsToTarget(accessible, monthlyInvestment, target, realReturnPercent);
  const after = yearsToTarget(accessible * (1 - Math.min(1, Math.max(0, equityShare)) * fallPercent / 100), monthlyInvestment, target, realReturnPercent);
  if (before === null || after === null) return null;
  return Math.max(0, Math.round((after - before) * 12));
}

/** Extra units a SIP buys at today's lower price, compared with buying at the high (in %). */
export const extraUnitsPercent = (drawdown: number) => (drawdown > 0 && drawdown < 100 ? (1 / (1 - drawdown / 100) - 1) * 100 : 0);

export const MOOD_COPY: Record<Exclude<MarketMood, "calm">, { emoji: string; title: string; lesson: string }> = {
  dip: { emoji: "🌤️", title: "Markets dipped a little", lesson: "Small dips happen several times a year. Nothing to do here except keep your SIP going." },
  correction: { emoji: "🌧️", title: "Markets are in a correction", lesson: "Falls of 10–20% have come roughly once every year or two in India, and markets have recovered from every one so far. Those who kept their SIPs going came out ahead." },
  bear: { emoji: "⛈️", title: "Markets are in a big fall", lesson: "Big falls feel scary, but they are when long-term investors buy the most units for their money. Selling now would lock in the loss; your FIRE plan is measured in decades, not months." },
};
