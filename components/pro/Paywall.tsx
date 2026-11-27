"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FOUNDING, foundingOpen, PRICING, START_TRIAL_KEY, type ProStatus } from "@/lib/subscription";
import { getCountry, priceText, yearlySavingPercent } from "@/lib/country";
import { useCountry } from "@/lib/useCountry";

export const proBenefits = [
  { emoji: "🗺️", title: "Your 11-level Freedom Path", text: "Always know your next step — from first budget to financial independence." },
  { emoji: "🎯", title: "FIRE score & freedom date", text: "A 100-point score, the age you could be free, and a slider to bring it closer." },
  { emoji: "📚", title: "Daily lessons from top money books", text: "Psychology of Money, Rich Dad Poor Dad and more — in 2 minutes, with Indian examples." },
  { emoji: "🏆", title: "XP, ranks, streaks & badges", text: "Turn good money habits into a game you actually want to play." },
  { emoji: "🏠", title: "Goals with exact monthly SIPs", text: "Home, education, wedding, travel — see what to invest each month." },
  { emoji: "📊", title: "Portfolio & true net worth", text: "MFs, stocks, EPF, PPF, gold, property — what counts for FIRE and what doesn’t." },
  { emoji: "🧾", title: "Budget & monthly check-ins", text: "30-second monthly log, pre-filled, with streaks to keep you consistent." },
];

type Props = { status: ProStatus; onStarted?: () => void; signedIn: boolean; /** The Pro-only page someone tried to open on the free plan. */ feature?: string | null };
const FEATURE_NAMES: Record<string, string> = { "/trends": "Money trends", "/save-more": "Save more & Leak Hunter", "/report": "The monthly report", "/plan": "Your FIRE plan", "/tax": "The tax planner" };
const FOUNDING_KEY = "ff-founding";

export default function Paywall({ status, onStarted, signedIn, feature }: Props) {
  const [busy, setBusy] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);
  const [mySpot, setMySpot] = useState<number | null>(null);

  // Founding offer: spots left, and whether this person already reserved one (auto-reserve after sign-in if they asked to).
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void (async () => {
      const left = await supabase.rpc("founding_spots_left", { total: FOUNDING.spots });
      if (!left.error && typeof left.data === "number") setSpotsLeft(left.data);
      if (!signedIn) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const mine = await supabase.from("founding_members").select("spot").eq("user_id", session.user.id).maybeSingle();
      if (mine.data?.spot) { setMySpot(mine.data.spot); return; }
      let wanted = false;
      try { wanted = window.localStorage.getItem(FOUNDING_KEY) === "1"; window.localStorage.removeItem(FOUNDING_KEY); } catch { /* storage unavailable */ }
      if (wanted) { const r = await supabase.rpc("reserve_founding_spot", { total: FOUNDING.spots }); if (!r.error && r.data) setMySpot(r.data as number); }
    })();
  }, [signedIn]);

  async function reserve() {
    const supabase = createClient();
    if (!supabase) return;
    if (!signedIn) {
      try { window.localStorage.setItem(FOUNDING_KEY, "1"); window.localStorage.setItem(START_TRIAL_KEY, "1"); } catch { /* storage unavailable */ }
      setBusy(true);
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/pricing` } });
      return;
    }
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("reserve_founding_spot", { total: FOUNDING.spots });
    setBusy(false);
    if (error) { setMessage(error.message.includes("reserve_founding_spot") ? "Run supabase/migrations/202611270033_referrals_and_founding.sql in Supabase first." : error.message); return; }
    if (!data) { setMessage("Sorry, all founding spots are taken."); setSpotsLeft(0); return; }
    setMySpot(data as number); setSpotsLeft(s => (s === null ? s : Math.max(0, s - 1)));
  }
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<"yearly" | "monthly">("yearly");

  async function startTrial() {
    const supabase = createClient();
    if (!supabase) return;
    if (!signedIn) {
      // Remember the intent so the trial starts automatically after Google sign-in (no second tap).
      try { window.localStorage.setItem(START_TRIAL_KEY, "1"); } catch { /* storage unavailable */ }
      setBusy(true);
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) { setBusy(false); setMessage(error.message); }
      return;
    }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("start_pro_trial");
    setBusy(false);
    if (error) setMessage(error.message.includes("start_pro_trial") ? "Trials need the latest database update (202611260015_subscriptions.sql)." : error.message);
    else onStarted?.();
  }

  async function upgrade() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await response.json().catch(() => ({}));
      setMessage(data.message ?? "Could not start checkout. Please try again.");
    } finally { setBusy(false); }
  }

  const expired = status.state === "expired";
  const canTrial = !status.trialUsed;
  const { code } = useCountry();
  const price = getCountry(code).pricing;
  const yearlyPerMonth = Math.round(price.yearly / 12);
  const showFounding = code === "IN" && foundingOpen();

  return (
    <section className="paywall">
      <div className="paywall-head">
        <span className="paywall-crown"><Crown size={26} /></span>
        <p className="eyebrow">FIREPATH PRO</p>
        <h1>{feature && FEATURE_NAMES[feature] ? `${FEATURE_NAMES[feature]} is part of Pro.` : expired ? "Your Pro access has ended — your data is safe." : "Unlock your full journey to financial freedom."}</h1>
        <p>{expired ? "Pick a plan to continue right where you left off. Your profile, goals, streaks and XP are all waiting." : canTrial ? `Try everything free for ${PRICING.trialDays} days. No card needed. Cancel anytime.` : "Choose a plan to continue."}</p>
      </div>

      <div className="paywall-grid">
        <ul className="paywall-benefits">{proBenefits.map(benefit => <li key={benefit.title}><span>{benefit.emoji}</span><div><strong>{benefit.title}</strong><small>{benefit.text}</small></div></li>)}</ul>

        <div className="paywall-plans">
          {canTrial && <button type="button" className="button button-primary paywall-cta" onClick={() => void startTrial()} disabled={busy}>{busy ? "Starting…" : signedIn ? `Start my free ${PRICING.trialDays}-day trial` : "Sign in with Google & start free trial"}</button>}
          {canTrial && <p className="paywall-small"><ShieldCheck size={14} /> No card · no auto-charge · takes 5 seconds</p>}
          {showFounding && <div className="founding-card">
            <p className="founding-tag">🏅 FOUNDING MEMBER OFFER · UNTIL {new Date(`${FOUNDING.until}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()}</p>
            <strong>{priceText(FOUNDING.yearly, code)}<small>/year, locked for life</small></strong>
            <span>That’s {priceText(Math.round(FOUNDING.yearly / 12), code)}/month, {Math.round((1 - FOUNDING.yearly / price.yearly) * 100)}% off the normal yearly price, for as long as you stay.{spotsLeft !== null ? ` ${spotsLeft.toLocaleString("en-IN")} of ${FOUNDING.spots.toLocaleString("en-IN")} spots left.` : ` Only the first ${FOUNDING.spots.toLocaleString("en-IN")} members.`}</span>
            {mySpot ? <p className="founding-mine">✅ You’re founding member <b>#{mySpot}</b>. When payments open, your price is {priceText(FOUNDING.yearly, code)}/year, for life. No payment now.</p>
              : <button type="button" className="button founding-cta" onClick={() => void reserve()} disabled={busy || spotsLeft === 0}>{spotsLeft === 0 ? "All founding spots are taken" : signedIn ? "Reserve my founding spot (no payment now)" : "Sign in & reserve my spot"}</button>}
          </div>}
          <div className="plan-options" role="radiogroup" aria-label="Choose a plan">
            <button type="button" role="radio" aria-checked={plan === "yearly"} className={`plan-option${plan === "yearly" ? " selected" : ""}`} onClick={() => setPlan("yearly")}>
              <em>Best value · save {yearlySavingPercent(code)}%</em><strong>{priceText(price.yearly, code)}<small>/year</small></strong><span>Just {priceText(yearlyPerMonth, code)}/month</span>
            </button>
            <button type="button" role="radio" aria-checked={plan === "monthly"} className={`plan-option${plan === "monthly" ? " selected" : ""}`} onClick={() => setPlan("monthly")}>
              <strong>{priceText(price.monthly, code)}<small>/month</small></strong><span>Cancel anytime</span>
            </button>
          </div>
          <p className="paywall-compare">Less than one café coffee a month — for a plan that could bring your freedom years closer.</p>
          {!canTrial && <button type="button" className="button button-primary paywall-cta" onClick={() => void upgrade()} disabled={busy}>{busy ? "Please wait…" : `Continue with ${plan === "yearly" ? `${priceText(price.yearly, code)}/year` : `${priceText(price.monthly, code)}/month`}`}</button>}
          {canTrial && <p className="paywall-small">After the trial, continue for {priceText(price.monthly, code)}/month or {priceText(price.yearly, code)}/year — only if you choose to.</p>}
          {message && <p className="profile-status" role="status">{message}</p>}
        </div>
      </div>
      <p className="paywall-free"><Lock size={13} /> The FIRE calculator and your freedom number stay free forever. <a href="/#fire-calculator">Use the free calculator →</a></p>
    </section>
  );
}

export function ProCheck({ children }: { children: string }) {
  return <span className="pro-check"><Check size={14} />{children}</span>;
}
