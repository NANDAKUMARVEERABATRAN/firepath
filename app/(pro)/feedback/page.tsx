"use client";

import { FormEvent, useEffect, useState } from "react";
import { Gift, Lightbulb, Send } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Celebration from "@/components/game/Celebration";
import { createClient } from "@/lib/supabase/client";
import { countryFromCurrency, formatCountryMoney, getCountry, priceText } from "@/lib/country";
import { freeMonthsFromPoints, pointsValue, REWARDS } from "@/lib/rewards";

type Feedback = { id: string; kind: string; message: string; status: string; team_reply: string | null; created_at: string };
type Points = { points: number; reason: string; feedback_id: string | null; created_at: string };

const KINDS = [
  { id: "idea", label: "💡 New idea" },
  { id: "improve", label: "✨ Make something better" },
  { id: "bug", label: "🐞 Something’s broken" },
  { id: "praise", label: "💚 Something I love" },
];
const STATUS: Record<string, { label: string; className: string }> = {
  new: { label: "Received", className: "new" },
  accepted: { label: "Accepted ✓ +200", className: "accepted" },
  shipped: { label: "Shipped 🚀 +500", className: "shipped" },
  declined: { label: "Not planned", className: "declined" },
};

export default function FeedbackPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("INR");
  const [items, setItems] = useState<Feedback[]>([]);
  const [points, setPoints] = useState<Points[]>([]);
  const [kind, setKind] = useState("idea");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(uid: string) {
    const supabase = createClient();
    if (!supabase) return;
    const [fb, pts, profile] = await Promise.all([
      supabase.from("feedback").select("id, kind, message, status, team_reply, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("reward_points").select("points, reason, feedback_id, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("financial_profiles").select("currency").eq("user_id", uid).maybeSingle(),
    ]);
    if (fb.error) setMessage("Run supabase/migrations/202611260022_feedback_rewards.sql in Supabase to turn on feedback rewards.");
    setItems((fb.data as Feedback[]) ?? []);
    setPoints((pts.data as Points[]) ?? []);
    if (profile.data?.currency) setCurrency(profile.data.currency);
  }

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) { setUserId(session.user.id); await load(session.user.id); }
      setLoading(false);
    })();
  }, []);

  const code = countryFromCurrency(currency);
  const balance = points.reduce((sum, p) => sum + p.points, 0);
  const value = pointsValue(balance, code);
  const thisMonthRewarded = points.filter(p => p.reason === "feedback" && p.created_at.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const pointsFor = (id: string) => points.filter(p => p.feedback_id === id).reduce((sum, p) => sum + p.points, 0);

  async function send(event: FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase || !userId || text.trim().length < 10) return;
    setSending(true); setMessage("");
    const { error } = await supabase.from("feedback").insert({ user_id: userId, kind, message: text.trim(), page: document.referrer ? new URL(document.referrer).pathname.slice(0, 100) : null });
    setSending(false);
    if (error) { setMessage(error.message.includes("feedback") ? "Run supabase/migrations/202611260022_feedback_rewards.sql in Supabase first." : error.message); return; }
    const rewarded = thisMonthRewarded < REWARDS.monthlyRewardedFeedback;
    setText("");
    await load(userId);
    setCelebrate({ title: rewarded ? `Thank you! +${REWARDS.perFeedback} points 🎁` : "Thank you! 💚", detail: rewarded ? `If we build your idea you’ll earn up to ${REWARDS.accepted + REWARDS.shipped} more points.` : `You’ve earned this month’s ${REWARDS.monthlyRewardedFeedback} feedback rewards — accepted ideas still earn ${REWARDS.accepted}+ points.` });
  }

  return <><Header /><main className="feedback-page container">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    <div className="profile-heading"><p className="eyebrow"><Lightbulb size={14} /> HELP BUILD FIREPATH</p><h1>Your ideas shape this app.</h1><p>Tell us what to add, fix or improve. Every useful idea earns points you can use to pay for your plan.</p></div>
    {loading ? <p className="profile-status">Loading…</p> : !userId ? <p className="profile-status">Sign in to send feedback.</p> : <>
      {message && <p className="profile-status" role="status">{message}</p>}
      <section className="points-card">
        <div><span><Gift size={16} /> Your reward points</span><strong>{balance.toLocaleString("en-IN")}</strong><small>worth {formatCountryMoney(value, code)} off your next bill{freeMonthsFromPoints(balance, code) >= 1 ? ` · enough for ${freeMonthsFromPoints(balance, code)} free month${freeMonthsFromPoints(balance, code) > 1 ? "s" : ""} of Pro` : ` · ${priceText(getCountry(code).pricing.monthly, code)} covers a month of Pro`}</small></div>
        <ul>
          <li><b>+{REWARDS.perFeedback}</b> for each idea or report <small>(first {REWARDS.monthlyRewardedFeedback} each month · {Math.max(0, REWARDS.monthlyRewardedFeedback - thisMonthRewarded)} left)</small></li>
          <li><b>+{REWARDS.accepted}</b> when we accept your idea</li>
          <li><b>+{REWARDS.shipped}</b> when we build it</li>
        </ul>
      </section>

      <form className="profile-card feedback-form" onSubmit={send}>
        <h2>What’s on your mind?</h2>
        <div className="qn-chips">{KINDS.map(k => <button key={k.id} type="button" className={kind === k.id ? "selected" : ""} onClick={() => setKind(k.id)}>{k.label}</button>)}</div>
        <textarea className="qn-textarea" rows={4} maxLength={2000} value={text} onChange={event => setText(event.target.value)} placeholder={kind === "bug" ? "What happened, and on which page?" : kind === "praise" ? "What do you love about FIREpath?" : "e.g. “Remind me on WhatsApp when it’s time to log my month”"} />
        <div className="feedback-actions"><small>{text.trim().length < 10 ? "A sentence or two is perfect." : "Looks great!"}</small><button type="submit" className="button button-primary" disabled={sending || text.trim().length < 10}><Send size={15} /> {sending ? "Sending…" : "Send feedback"}</button></div>
        <p className="profile-privacy">Points are applied automatically to your next payment once paid plans launch (up to half of any bill; {REWARDS.pointsPerUnit} points = {formatCountryMoney(pointsValue(REWARDS.pointsPerUnit, code), code)}). Points have no cash value. Please don’t include account numbers or passwords.</p>
      </form>

      {items.length > 0 && <section className="feedback-list">
        <h2>Your suggestions</h2>
        {items.map(item => <article key={item.id} className="feedback-item">
          <div className="feedback-item-head"><span>{KINDS.find(k => k.id === item.kind)?.label}</span><em className={`fb-status ${STATUS[item.status]?.className ?? "new"}`}>{STATUS[item.status]?.label ?? item.status}</em></div>
          <p>{item.message}</p>
          {item.team_reply && <p className="feedback-reply"><b>FIREpath team:</b> {item.team_reply}</p>}
          <small>{new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{pointsFor(item.id) > 0 ? ` · +${pointsFor(item.id)} points` : ""}</small>
        </article>)}
      </section>}
    </>}
  </main><Footer /></>;
}
