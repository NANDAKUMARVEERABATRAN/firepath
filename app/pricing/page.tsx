"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Paywall from "@/components/pro/Paywall";
import { createClient } from "@/lib/supabase/client";
import { getProStatus, hasPro, type ProStatus, type SubscriptionRow } from "@/lib/subscription";

const rows: [string, boolean, boolean][] = [
  ["FIRE calculator & freedom number", true, true],
  ["11-level Freedom Path, XP, ranks & badges", true, true],
  ["FIRE score & daily book lessons", true, true],
  ["This month: income, spending, budget & check-up", true, true],
  ["Portfolio & net worth (add items yourself)", true, true],
  ["Goals with monthly SIP targets (free: 1 goal)", false, true],
  ["AI one-line logging (English, Hindi, Hinglish)", false, true],
  ["Import your CAS or Zerodha/Groww holdings", false, true],
  ["FIRE plan: step-up, Lean/Fat FIRE, life after FIRE", false, true],
  ["Money trends: wealth, spending & budget charts", false, true],
  ["Save more: Leak Hunter & savings coach", false, true],
  ["Tax planner: old vs new regime, deductions & LTCG harvesting", false, true],
  ["Monthly report with 3 focus actions", false, true],
];

export default function PricingPage() {
  const [status, setStatus] = useState<ProStatus>(getProStatus(null));
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setSignedIn(true);
      const { data } = await supabase.from("subscriptions").select("plan, status, current_period_end, trial_started_at").eq("user_id", session.user.id).maybeSingle();
      setStatus(getProStatus((data as SubscriptionRow | null) ?? null));
    })();
  }, []);

  return <><Header /><main className="container pro-page">
    {hasPro(status) && <p className="profile-status pricing-current">👑 You’re on Pro {status.state === "trial" ? `(free trial — ${status.daysLeft} days left)` : ""}. <a href="/journey">Go to Home →</a></p>}
    <Paywall status={status} signedIn={signedIn} onStarted={() => { window.location.href = "/journey"; }} />
    <section className="compare">
      <h2>Free vs Pro</h2>
      <div className="compare-table" role="table">
        <div className="compare-row head" role="row"><span role="columnheader">What you get</span><span role="columnheader">Free</span><span role="columnheader">Pro</span></div>
        {rows.map(([label, free, pro]) => <div className="compare-row" role="row" key={label}><span role="cell">{label}</span><span role="cell">{free ? "✅" : "—"}</span><span role="cell">{pro ? "✅" : "—"}</span></div>)}
      </div>
    </section>
  </main><Footer /></>;
}
