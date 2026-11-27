"use client";

import { useEffect, useState } from "react";
import { extraUnitsPercent, fireDelayMonths, MOOD_COPY, type MarketMood } from "@/lib/marketCoach";

type Market = { drawdown: number; mood: MarketMood; asOf: string; highDate: string };
const KEY = "ff-steady-hands";

/**
 * Shown on Home when the Nifty 50 is 10%+ below its 1-year high: what the fall really means for
 * this person's FIRE date, and why keeping the SIP going is the move.
 */
export default function MarketCoach({ accessible, equityShare, monthlyInvestment, target, realReturn }: { accessible: number; equityShare: number; monthlyInvestment: number; target: number; realReturn: number }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    void fetch("/api/market").then(r => r.json()).then((json: { market: Market | null }) => setMarket(json.market)).catch(() => setMarket(null));
  }, []);
  useEffect(() => {
    if (!market) return;
    try { setCommitted(localStorage.getItem(KEY) === `${market.mood}:${market.highDate}`); } catch { /* fine */ }
  }, [market]);

  if (!market || (market.mood !== "correction" && market.mood !== "bear")) return null;
  const copy = MOOD_COPY[market.mood];
  const fall = Math.round(market.drawdown);
  const months = accessible > 0 && target > 0 ? fireDelayMonths({ accessible, equityShare, fallPercent: market.drawdown, monthlyInvestment, target, realReturnPercent: realReturn }) : null;
  const extra = Math.round(extraUnitsPercent(market.drawdown));

  function commit() {
    setCommitted(true);
    try { localStorage.setItem(KEY, `${market!.mood}:${market!.highDate}`); } catch { /* fine */ }
  }

  return <section className="market-coach" id="market-coach">
    <div className="market-coach-head"><span>{copy.emoji}</span><div><small>MARKET CHECK · NIFTY 50</small><strong>{copy.title}: {fall}% below its high</strong></div></div>
    <ul>
      {months !== null && <li><b>Your FIRE date:</b> {months === 0 ? "barely moves" : `moves about ${months} month${months === 1 ? "" : "s"}`}, even if your equity fell {fall}% and stays there{equityShare < 0.99 ? ` (about ${Math.round(equityShare * 100)}% of your FIRE money is in equity)` : ""}. Not years.</li>}
      <li><b>Your SIP is on sale:</b> every rupee you invest now buys about {extra}% more units than at the high.</li>
      <li><b>From the books:</b> {copy.lesson}</li>
    </ul>
    {committed ? <p className="market-coach-done">💪 Steady hands. That’s how FIRE is won. See you next month.</p>
      : <div className="market-coach-actions"><button type="button" className="button button-primary" onClick={commit}>I’ll keep my SIPs going 💪</button><small>Tip: check your portfolio once a month, not every day.</small></div>}
  </section>;
}
