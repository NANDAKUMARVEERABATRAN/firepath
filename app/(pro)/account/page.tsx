"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Crown, Heart } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import DeleteAccount from "@/components/account/DeleteAccount";
import { createClient } from "@/lib/supabase/client";
import { loadFinancialState, type FinancialState } from "@/lib/financialState";
import { getGameSummary } from "@/lib/gameSummary";
import { getProStatus, PRICING, type ProStatus, type SubscriptionRow } from "@/lib/subscription";
import { countryFromCurrency, formatCountryMoney, getCountry, priceText, yearlySavingPercent } from "@/lib/country";
import { lessons as allLessons } from "@/lib/wisdom";
import { PATH_LEVELS } from "@/lib/freedomPath";

type Row = SubscriptionRow & { cancel_reason?: string | null };
type Step = "overview" | "proud" | "why" | "offer" | "done";

const reasons = [
  { id: "price", label: "💸 It’s too expensive" },
  { id: "unused", label: "😴 I’m not using it enough" },
  { id: "done", label: "🎯 I got what I needed" },
  { id: "feature", label: "🧩 Something I need is missing" },
  { id: "other-app", label: "📱 I’m using another app" },
  { id: "other", label: "✍️ Something else" },
];

export default function AccountPage() {
  const [state, setState] = useState<FinancialState | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("overview");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const [loaded, sub] = await Promise.all([
          loadFinancialState(supabase, session.user.id),
          supabase.from("subscriptions").select("*").eq("user_id", session.user.id).maybeSingle(),
        ]);
        setState(loaded);
        setRow((sub.data as Row | null) ?? null);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load your account."); }
      finally { setLoading(false); }
    })();
  }, []);

  const status: ProStatus = getProStatus(row);
  const summary = useMemo(() => (state ? getGameSummary(state) : null), [state]);
  const code = countryFromCurrency(state?.profile?.currency);
  const country = getCountry(code);
  const money = (value: number) => formatCountryMoney(value, code);
  const ends = status.endsAt ? status.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
  const cancelled = row?.status === "cancelled";
  const planName = row?.plan === "trial" ? `Free ${PRICING.trialDays}-day trial` : row?.plan === "yearly" ? "Pro · yearly" : row?.plan === "monthly" ? "Pro · monthly" : "No plan";

  async function callRpc(name: "cancel_subscription" | "resume_subscription") {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true); setMessage("");
    const fullReason = [reasons.find(r => r.id === reason)?.label.replace(/^\S+\s/, ""), note.trim()].filter(Boolean).join(" — ");
    const { data, error } = name === "cancel_subscription" ? await supabase.rpc(name, { reason: fullReason }) : await supabase.rpc(name);
    setBusy(false);
    if (error) { setMessage(error.message.includes("function") ? "Run supabase/migrations/202611260020_progress_and_cancel.sql in Supabase first." : error.message); return; }
    setRow(data as Row);
    setStep(name === "cancel_subscription" ? "done" : "overview");
    if (name === "resume_subscription") setMessage("🎉 Welcome back! Your plan continues as before.");
  }

  const offer = (() => {
    const yearlyPerMonth = priceText(Math.round(country.pricing.yearly / 12), code);
    switch (reason) {
      case "price": return { title: "What if it cost less?", body: `Switch to the yearly plan and pay just ${yearlyPerMonth}/month — ${yearlySavingPercent(code)}% less than monthly. Less than one coffee a month for a plan that could bring your freedom years closer.`, cta: "See the yearly plan", href: "/pricing" };
      case "unused": return { title: "It only needs 30 seconds a month", body: "FIREpath works best as a monthly habit: log your month (it’s pre-filled), glance at your freedom date, done. Your streak and progress chart do the motivating for you.", cta: "Log this month now", href: "/month" };
      case "done": return { title: "Congratulations! 🎉 Now protect it", body: "The hardest part is staying on track for years. FIREpath keeps your plan current as life changes — and shows you the moment you cross your FIRE number.", cta: "See my progress", href: "/journey" };
      case "feature": return { title: "Tell us what’s missing", body: "We read every answer. Write it below — it goes straight to the people building FIREpath, and many features come from requests like yours.", cta: "", href: "" };
      default: return { title: "Your progress is worth keeping", body: "Everything you’ve built — your streak, your history and your plan — stays exactly where it is if you stay.", cta: "Go back to Home", href: "/journey" };
    }
  })();

  return <><Header /><main className="account-page container">
    {loading ? <p className="profile-status">Loading your account…</p> : <>
      {message && <p className="profile-status" role="status">{message}</p>}

      {step === "overview" && <section className="account-card">
        <p className="eyebrow"><Crown size={14} /> YOUR SUBSCRIPTION</p>
        <h1>{planName}</h1>
        {row ? <p className="account-sub">{cancelled ? `Cancelled — you keep full access until ${ends}. Your data stays safe.` : status.state === "expired" ? "Your plan has ended. Your data is safe." : `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left · renews or ends on ${ends}`}</p> : <p className="account-sub">You don’t have a plan yet.</p>}
        <div className="account-actions">
          {cancelled && status.state !== "expired" && <button type="button" className="button button-primary" onClick={() => void callRpc("resume_subscription")} disabled={busy}><Heart size={16} /> Keep my plan</button>}
          {row?.plan !== "yearly" && <Link href="/pricing" className="button button-primary">Switch to yearly — save {yearlySavingPercent(code)}%</Link>}
          {row && !cancelled && status.state !== "expired" && <button type="button" className="text-link account-cancel" onClick={() => setStep("proud")}>{row.plan === "trial" ? "Cancel trial" : "Cancel subscription"}</button>}
        </div>
      </section>}

      {step === "overview" && <DeleteAccount />}

      {step === "proud" &&<section className="account-card cancel-flow">
        <p className="eyebrow">BEFORE YOU GO</p>
        <h1>Look how far you’ve come 💚</h1>
        {summary ? <>
          <div className="proud-grid">
            <div><span>Rank</span><strong>{summary.rank.name}</strong><small>{summary.xp.toLocaleString("en-IN")} XP</small></div>
            <div><span>FIRE progress</span><strong>{summary.metrics.fireProgress.toFixed(1)}%</strong><small>{summary.history.months > 0 ? `${summary.history.progressGain >= 0 ? "+" : ""}${summary.history.progressGain.toFixed(1)}% since you joined` : "and climbing"}</small></div>
            <div><span>Freedom levels cleared</span><strong>{summary.levelsCleared} / {PATH_LEVELS}</strong><small>{summary.badges} badges earned</small></div>
            <div><span>Investing streak</span><strong>{summary.streak} month{summary.streak === 1 ? "" : "s"} 🔥</strong><small>{summary.checkins} check-ins logged</small></div>
            {summary.history.months > 0 && <div><span>FIRE portfolio growth</span><strong>{summary.history.portfolioGain >= 0 ? "+" : "−"}{money(Math.abs(summary.history.portfolioGain))}</strong><small>in {summary.history.months} month{summary.history.months === 1 ? "" : "s"}</small></div>}
            <div><span>Months of freedom you own</span><strong>{summary.metrics.freedomMonths.toFixed(1)}</strong><small>{summary.metrics.fireAge ? `free around age ${summary.metrics.fireAge}` : "keep investing to set a date"}</small></div>
          </div>
          <div className="lose-list"><strong>If you cancel, you’ll lose access to:</strong>
            <ul>
              <li>🔥 Your {summary.streak > 0 ? `${summary.streak}-month ` : ""}investing streak and monthly missions</li>
              <li>📈 Your progress-over-time chart and freedom-date tracking</li>
              <li>🗺️ Your next Freedom Path level{summary.levelsCleared < PATH_LEVELS ? ` (level ${summary.levelsCleared + 1})` : ""}</li>
              <li>📚 {Math.max(0, allLessons.length - summary.lessons)} book lessons you haven’t read yet</li>
              {summary.goals > 0 && <li>🎯 Tracking for your {summary.goals} goal{summary.goals === 1 ? "" : "s"}</li>}
            </ul>
          </div>
        </> : <p className="account-sub">Your plan, streaks and goals will stay saved if you stay.</p>}
        <div className="cancel-actions"><Link href="/journey" className="button button-primary">I’ll stay 💚</Link><button type="button" className="text-link" onClick={() => setStep("why")}>Continue to cancel</button></div>
      </section>}

      {step === "why" && <section className="account-card cancel-flow">
        <button type="button" className="qn-back" onClick={() => setStep("proud")}><ArrowLeft size={16} /> Back</button>
        <h1>Can you tell us why?</h1>
        <p className="account-sub">One tap. It genuinely helps us make FIREpath better.</p>
        <div className="qn-choices">{reasons.map(r => <button key={r.id} type="button" className={`qn-choice${reason === r.id ? " selected" : ""}`} onClick={() => setReason(r.id)}>{r.label}</button>)}</div>
        <textarea className="qn-textarea cancel-note" rows={2} maxLength={400} placeholder="Anything else? (optional)" value={note} onChange={event => setNote(event.target.value)} />
        <div className="cancel-actions"><button type="button" className="button button-primary" disabled={!reason} onClick={() => setStep("offer")}>Continue</button></div>
      </section>}

      {step === "offer" && <section className="account-card cancel-flow">
        <button type="button" className="qn-back" onClick={() => setStep("why")}><ArrowLeft size={16} /> Back</button>
        <h1>{offer.title}</h1>
        <p className="account-sub">{offer.body}</p>
        {reason === "feature" && <textarea className="qn-textarea cancel-note" rows={3} maxLength={400} placeholder="What would make FIREpath worth keeping?" value={note} onChange={event => setNote(event.target.value)} />}
        <div className="cancel-actions">
          {offer.cta ? <Link href={offer.href} className="button button-primary">{offer.cta}</Link> : <Link href="/journey" className="button button-primary">Stay and wait for it</Link>}
          <button type="button" className="text-link" onClick={() => void callRpc("cancel_subscription")} disabled={busy}>{busy ? "Cancelling…" : `No thanks, cancel my ${row?.plan === "trial" ? "trial" : "plan"}`}</button>
        </div>
      </section>}

      {step === "done" && <section className="account-card cancel-flow">
        <h1>Your plan is cancelled</h1>
        <p className="account-sub">You keep full access until <b>{ends}</b>. Your profile, goals, streak and history stay saved — if you come back, everything is exactly where you left it.</p>
        <div className="cancel-actions"><button type="button" className="button button-primary" onClick={() => void callRpc("resume_subscription")} disabled={busy}><Heart size={16} /> Changed my mind — keep my plan</button><Link href="/journey" className="text-link">Back to Home</Link></div>
      </section>}
    </>}
  </main><Footer /></>;
}
