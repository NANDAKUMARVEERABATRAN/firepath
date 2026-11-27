import { drawdownFromNavs, marketMood, NIFTY_PROXY_SCHEME, type MarketMood, type MarketState } from "./marketCoach";

export type MarketSnapshot = MarketState & { mood: MarketMood; source: string };

/** Server-only: Nifty 50 drawdown from a Nifty 50 index fund's public daily NAV. Cached for 6 hours. */
export async function fetchMarket(): Promise<MarketSnapshot | null> {
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${NIFTY_PROXY_SCHEME}`, { next: { revalidate: 21600 } });
    if (!response.ok) return null;
    const json = await response.json() as { data?: { date: string; nav: string }[] };
    const state = drawdownFromNavs((json.data ?? []).slice(0, 400));
    return state ? { ...state, mood: marketMood(state.drawdown), source: "Nifty 50 (via a Nifty 50 index fund's daily NAV)" } : null;
  } catch { return null; }
}
