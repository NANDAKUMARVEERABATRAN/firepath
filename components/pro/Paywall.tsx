"use client";

import { useState } from "react";
import { Check, Crown, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PRICING, START_TRIAL_KEY, type ProStatus } from "@/lib/subscription";
import { getCountry, priceText } from "@/lib/country";
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

type Props = { status: ProStatus; onStarted?: () => void; signedIn: boolean };

export default function Paywall({ status, onStarted, signedIn }: Props) {
  const [busy, setBusy] = useState(false);
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

  return (
    <section className="paywall">
      <div className="paywall-head">
        <span className="paywall-crown"><Crown size={26} /></span>
        <p className="eyebrow">FIREPATH PRO</p>
        <h1>{expired ? "Your Pro access has ended — your data is safe." : "Unlock your full journey to financial freedom."}</h1>
        <p>{expired ? "Pick a plan to continue right where you left off. Your profile, goals, streaks and XP are all waiting." : canTrial ? `Try everything free for ${PRICING.trialDays} days. No card needed. Cancel anytime.` : "Choose a plan to continue."}</p>
      </div>

      <div className="paywall-grid">
        <ul className="paywall-benefits">{proBenefits.map(benefit => <li key={benefit.title}><span>{benefit.emoji}</span><div><strong>{benefit.title}</strong><small>{benefit.text}</small></div></li>)}</ul>

        <div className="paywall-plans">
          {canTrial && <button type="button" className="button button-primary paywall-cta" onClick={() => void startTrial()} disabled={busy}>{busy ? "Starting…" : signedIn ? `Start my free ${PRICING.trialDays}-day trial` : "Sign in with Google & start free trial"}</button>}
          {canTrial && <p className="paywall-small"><ShieldCheck size={14} /> No card · no auto-charge · takes 5 seconds</p>}
          <div className="plan-options" role="radiogroup" aria-label="Choose a plan">
            <button type="button" role="radio" aria-checked={plan === "yearly"} className={`plan-option${plan === "yearly" ? " selected" : ""}`} onClick={() => setPlan("yearly")}>
              <em>Best value · save 33%</em><strong>{priceText(price.yearly, code)}<small>/year</small></strong><span>Just {priceText(yearlyPerMonth, code)}/month</span>
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
      <p className="paywall-free"><Lock size={13} /> The FIRE calculator stays free forever. <a href="/#fire-calculator">Use the free calculator →</a></p>
    </section>
  );
}

export function ProCheck({ children }: { children: string }) {
  return <span className="pro-check"><Check size={14} />{children}</span>;
}
