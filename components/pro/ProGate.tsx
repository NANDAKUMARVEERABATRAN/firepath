"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Paywall from "@/components/pro/Paywall";
import Celebration from "@/components/game/Celebration";
import { ProContext } from "@/components/pro/ProContext";
import { createClient } from "@/lib/supabase/client";
import { getProStatus, hasPro, isProOnlyPage, PAYMENTS_LIVE, PRICING, REFERRAL_KEY, REFERRAL_TRIAL_DAYS, START_TRIAL_KEY, type ProStatus, type SubscriptionRow } from "@/lib/subscription";

type GateState = { loading: boolean; signedIn: boolean; status: ProStatus; setupMissing: boolean; configured: boolean };

/**
 * Wraps every app page. Signed-in people get the free plan; a few pages and features need Pro
 * (trial, paid, or free access while online payments aren't open yet).
 */
export default function ProGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ loading: true, signedIn: false, status: getProStatus(null), setupMissing: false, configured: true });
  const [welcome, setWelcome] = useState<"trial" | "referral" | null>(null);
  const pathname = usePathname();

  const check = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setState(s => ({ ...s, loading: false, configured: false })); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setState(s => ({ ...s, loading: false, signedIn: false })); return; }
    const read = () => supabase.from("subscriptions").select("plan, status, current_period_end, trial_started_at").eq("user_id", session.user.id).maybeSingle();
    let { data, error } = await read();

    // They tapped "Start free trial" before signing in — start it now instead of asking twice.
    let wantsTrial = false, referral: string | null = null;
    try {
      wantsTrial = window.localStorage.getItem(START_TRIAL_KEY) === "1"; window.localStorage.removeItem(START_TRIAL_KEY);
      referral = window.localStorage.getItem(REFERRAL_KEY);
    } catch { /* storage unavailable */ }
    if ((wantsTrial || referral) && !error && !data) {
      const started = await supabase.rpc("start_pro_trial");
      if (!started.error) { ({ data, error } = await read()); setWelcome("trial"); }
    }
    // Arrived through a friend's link: claim it once (their trial becomes 30 days; the friend earns points).
    if (referral) {
      const claimed = await supabase.rpc("claim_referral", { referral_code: referral });
      try { window.localStorage.removeItem(REFERRAL_KEY); } catch { /* storage unavailable */ }
      if (!claimed.error && claimed.data === "ok") { ({ data, error } = await read()); setWelcome("referral"); }
    }
    // If the subscriptions migration hasn't been applied, don't lock people out — show a notice instead.
    setState({ loading: false, signedIn: true, status: getProStatus((data as SubscriptionRow | null) ?? null), setupMissing: Boolean(error), configured: true });
  }, []);

  useEffect(() => { void check(); }, [check]);

  if (state.loading) return <><Header /><main className="container pro-loading"><p className="profile-status">Loading…</p></main></>;

  const { status } = state;
  const graceAccess = status.state === "expired" && !PAYMENTS_LIVE; // never lock people out while payments aren't available
  const pro = !state.configured || state.setupMissing || (state.signedIn && (hasPro(status) || graceAccess));
  const celebration = welcome && <Celebration title={welcome === "referral" ? "A friend gave you a month free! 🎁" : "Welcome to Pro! 👑"} detail={welcome === "referral" ? `Your free Pro trial is now ${REFERRAL_TRIAL_DAYS} days. Everything is unlocked. Let’s build your plan.` : `Your ${PRICING.trialDays}-day free trial has started. Everything is unlocked. Let’s build your plan.`} onClose={() => setWelcome(null)} />;

  if (!state.signedIn && state.configured) return <><Header /><main className="container pro-page"><Paywall status={status} signedIn={false} onStarted={() => { setWelcome("trial"); void check(); }} /></main><Footer /></>;

  if (pro) {
    return <ProContext.Provider value={{ pro: true }}>
      {state.setupMissing && state.signedIn && <div className="pro-bar warn">Pro access check is off: run supabase/migrations/202611260015_subscriptions.sql in Supabase.</div>}
      {status.state === "trial" && status.daysLeft <= 3 && <a className="pro-bar" href="/pricing">⏳ {status.daysLeft} day{status.daysLeft === 1 ? "" : "s"} left in your free trial — see Pro plans →</a>}
      {graceAccess && <div className="pro-bar">🎁 Your trial has ended, but Pro stays free for you until online payments open. Enjoy!</div>}
      {celebration}
      {children}
    </ProContext.Provider>;
  }

  // Free plan: Pro-only pages show what Pro adds; everything else works.
  if (isProOnlyPage(pathname)) return <><Header /><main className="container pro-page">{celebration}<Paywall status={status} signedIn onStarted={() => { setWelcome("trial"); void check(); }} feature={pathname} /></main><Footer /></>;
  const pausedUntil = status.state === "paused" && status.pausedUntil ? status.pausedUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
  return <ProContext.Provider value={{ pro: false }}>
    {pausedUntil ? <a className="pro-bar free" href="/account">⏸️ Pro is paused until {pausedUntil}. Free features keep working. Resume any time →</a> : <a className="pro-bar free" href="/pricing">You’re on the free plan. Pro adds money trends, the FIRE plan, Save more, the tax planner, monthly reports, AI logging and portfolio import →</a>}
    {celebration}
    {children}
  </ProContext.Provider>;
}
