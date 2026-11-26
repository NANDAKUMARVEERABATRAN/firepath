"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Paywall from "@/components/pro/Paywall";
import Celebration from "@/components/game/Celebration";
import { createClient } from "@/lib/supabase/client";
import { getProStatus, hasPro, PAYMENTS_LIVE, PRICING, START_TRIAL_KEY, type ProStatus, type SubscriptionRow } from "@/lib/subscription";

type GateState = { loading: boolean; signedIn: boolean; status: ProStatus; setupMissing: boolean; configured: boolean };

/** Wraps every app page: you need to be signed in with an active Pro trial or plan. */
export default function ProGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ loading: true, signedIn: false, status: getProStatus(null), setupMissing: false, configured: true });
  const [welcome, setWelcome] = useState(false);

  const check = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setState(s => ({ ...s, loading: false, configured: false })); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setState(s => ({ ...s, loading: false, signedIn: false })); return; }
    const read = () => supabase.from("subscriptions").select("plan, status, current_period_end, trial_started_at").eq("user_id", session.user.id).maybeSingle();
    let { data, error } = await read();

    // They tapped "Start free trial" before signing in — start it now instead of asking twice.
    let wantsTrial = false;
    try { wantsTrial = window.localStorage.getItem(START_TRIAL_KEY) === "1"; window.localStorage.removeItem(START_TRIAL_KEY); } catch { /* storage unavailable */ }
    if (wantsTrial && !error && !data) {
      const started = await supabase.rpc("start_pro_trial");
      if (!started.error) { ({ data, error } = await read()); setWelcome(true); }
    }
    // If the subscriptions migration hasn't been applied, don't lock people out — show a notice instead.
    setState({ loading: false, signedIn: true, status: getProStatus((data as SubscriptionRow | null) ?? null), setupMissing: Boolean(error), configured: true });
  }, []);

  useEffect(() => { void check(); }, [check]);

  if (state.loading) return <><Header /><main className="container pro-loading"><p className="profile-status">Loading…</p></main></>;

  const { status } = state;
  const graceAccess = status.state === "expired" && !PAYMENTS_LIVE; // never lock people out while payments aren't available
  if (!state.configured || state.setupMissing || (state.signedIn && (hasPro(status) || graceAccess))) {
    return <>
      {state.setupMissing && state.signedIn && <div className="pro-bar warn">Pro access check is off: run supabase/migrations/202611260015_subscriptions.sql in Supabase.</div>}
      {status.state === "trial" && status.daysLeft <= 3 && <a className="pro-bar" href="/pricing">⏳ {status.daysLeft} day{status.daysLeft === 1 ? "" : "s"} left in your free trial — see Pro plans →</a>}
      {graceAccess && <div className="pro-bar">🎁 Your trial has ended, but Pro stays free for you until online payments open. Enjoy!</div>}
      {welcome && <Celebration title="Welcome to Pro! 👑" detail={`Your ${PRICING.trialDays}-day free trial has started. Everything is unlocked — let’s build your plan.`} onClose={() => setWelcome(false)} />}
      {children}
    </>;
  }
  return <><Header /><main className="container pro-page"><Paywall status={status} signedIn={state.signedIn} onStarted={() => { setWelcome(true); void check(); }} /></main><Footer /></>;
}
