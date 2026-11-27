"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PartyPopper } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ShareMilestone from "@/components/game/ShareMilestone";
import { createClient } from "@/lib/supabase/client";
import { loadFinancialState, type FinancialState } from "@/lib/financialState";
import { countryFromCurrency, formatCountryMoney } from "@/lib/country";
import { recapMilestones, recapYearFor, yearRecap } from "@/lib/yearRecap";

const monthName = (m: string) => new Date(`${m}T12:00:00`).toLocaleDateString("en-IN", { month: "long" });

/** Year in review: what this person did for their freedom this year, plus shareable (amount-free) cards. */
export default function RecapPage() {
  const [state, setState] = useState<FinancialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [year, setYear] = useState(recapYearFor().year);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setMessage("Sign in to see your year."); return; }
        setState(await loadFinancialState(supabase, session.user.id));
      } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load your year."); }
      finally { setLoading(false); }
    })();
  }, []);

  const code = countryFromCurrency(state?.profile?.currency);
  const money = (v: number) => formatCountryMoney(Math.round(v), code);
  const r = useMemo(() => (state ? yearRecap(year, state.checkins, state.snapshots, state.lessons) : null), [state, year]);
  const years = useMemo(() => {
    const set = new Set<number>([recapYearFor().year]);
    for (const c of state?.checkins ?? []) set.add(Number(c.month_start.slice(0, 4)));
    return [...set].sort((a, b) => b - a).slice(0, 3);
  }, [state]);
  const thisYearSoFar = year === new Date().getFullYear() && new Date().getMonth() < 11;

  return <><Header /><main className="recap-page container">
    <div className="profile-heading">
      <p className="eyebrow"><PartyPopper size={14} /> YEAR IN REVIEW</p>
      <h1>Your {year} on the path to freedom.</h1>
      <p>{thisYearSoFar ? "Your year so far. The full recap is ready in December." : "Every month you logged, every rupee you invested and every lesson you learned, in one place."}</p>
      {years.length > 1 && <div className="qn-chips recap-years">{years.map(y => <button key={y} type="button" className={y === year ? "selected" : ""} onClick={() => setYear(y)}>{y}</button>)}</div>}
    </div>
    {loading ? <p className="profile-status">Putting your year together…</p> : message ? <p className="profile-status">{message}</p> : r && (r.monthsLogged === 0 && r.progressEnd === null
      ? <section className="tm-card recap-empty"><h2>Nothing logged in {year} yet</h2><p className="tm-hint">Log your months on <Link href="/month">This month</Link> and your recap builds itself.</p></section>
      : <>
        <section className="recap-hero">
          {r.progressStart !== null && r.progressEnd !== null && <div className="recap-big"><span>FIRE progress</span><strong>{r.progressStart.toFixed(1)}% → {r.progressEnd.toFixed(1)}%</strong><small>{r.progressEnd >= r.progressStart ? `+${(r.progressEnd - r.progressStart).toFixed(1)} points closer to financial freedom` : "Markets had a tough year. Your habits are what count."}</small></div>}
          <div className="recap-grid">
            <div><span>Invested</span><strong>{money(r.invested)}</strong><small>incl. salary EPF/NPS and bonuses</small></div>
            {r.savingsRate !== null && <div><span>Saved of what you earned</span><strong>{Math.round(r.savingsRate)}%</strong><small>{money(r.earned - r.spent)} kept</small></div>}
            {r.portfolioStart !== null && r.portfolioEnd !== null && <div><span>FIRE portfolio</span><strong>{r.portfolioEnd >= r.portfolioStart ? "+" : "−"}{money(Math.abs(r.portfolioEnd - r.portfolioStart))}</strong><small>{money(r.portfolioStart)} → {money(r.portfolioEnd)}</small></div>}
            {r.netWorthStart !== null && r.netWorthEnd !== null && <div><span>Net worth</span><strong>{money(r.netWorthEnd)}</strong><small>{r.netWorthEnd >= r.netWorthStart ? "up" : "down"} {money(Math.abs(r.netWorthEnd - r.netWorthStart))}</small></div>}
            <div><span>Months tracked</span><strong>{r.monthsLogged}</strong><small>{r.longestStreak >= 2 ? `${r.longestStreak} months investing in a row` : "every month counts"}</small></div>
            {r.bestMonth && <div><span>Best month</span><strong>{monthName(r.bestMonth.month_start)}</strong><small>{Math.round(r.bestMonth.rate)}% saved</small></div>}
            <div><span>Lessons learned</span><strong>{r.lessons}</strong><small>from the best money books</small></div>
          </div>
        </section>
        <section className="tm-card recap-next">
          <h2>Make {year + 1} even better</h2>
          <ul>
            <li>📈 <Link href="/plan">Set a step-up</Link> for your SIP on appraisal month. Even 10% a year moves your freedom date a lot.</li>
            <li>🧾 <Link href="/tax">Check old vs new regime</Link> and book tax-free equity gains before 31 March.</li>
            <li>🎯 Aim for {r.savingsRate !== null ? Math.min(70, Math.round(r.savingsRate) + 5) : 30}% saved next year. Five points more makes a real difference.</li>
          </ul>
        </section>
        {recapMilestones(r).length > 0 && <div className="recap-share"><ShareMilestone milestones={recapMilestones(r)} /></div>}
      </>)}
  </main><Footer /></>;
}
