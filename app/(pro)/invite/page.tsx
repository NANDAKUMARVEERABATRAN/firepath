"use client";

import { useEffect, useState } from "react";
import { Copy, Gift, Share2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { countryFromCurrency, formatCountryMoney } from "@/lib/country";
import { pointsValue } from "@/lib/rewards";
import { REFERRAL_REWARD, REFERRAL_TRIAL_DAYS } from "@/lib/subscription";

/** Invite friends: a personal link; friends get a 30-day trial, you earn points (₹ off your bill). */
export default function InvitePage() {
  const [code, setCode] = useState<string | null>(null);
  const [joined, setJoined] = useState(0);
  const [points, setPoints] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setMessage("Sign in to get your invite link."); return; }
        const [c, r, p, prof] = await Promise.all([
          supabase.rpc("get_my_referral_code"),
          supabase.from("referrals").select("referred_id").eq("referrer_id", session.user.id),
          supabase.from("reward_points").select("points, reason").eq("user_id", session.user.id).in("reason", ["referral_signup", "referral_paid"]),
          supabase.from("financial_profiles").select("currency").eq("user_id", session.user.id).maybeSingle(),
        ]);
        if (c.error) { setMessage("Invites need the latest database update (supabase/migrations/202611270033_referrals_and_founding.sql)."); return; }
        setCode(c.data as string);
        setJoined((r.data ?? []).length);
        setPoints((p.data ?? []).reduce((s, x) => s + Number(x.points), 0));
        if (prof.data?.currency) setCurrency(prof.data.currency);
      } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load your invite link."); }
      finally { setLoading(false); }
    })();
  }, []);

  const site = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) : "";
  const link = code ? `${site}/?ref=${code}` : "";
  const country = countryFromCurrency(currency);
  const text = `I’m using FIREpath to plan my financial freedom: FIRE number, freedom age, budget and a game that keeps me on track. Try it free, my link gives you ${REFERRAL_TRIAL_DAYS} days of Pro: ${link}`;

  async function share() {
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setMessage("Copy didn’t work. Press and hold the link to copy it."); }
  }

  return <><Header /><main className="invite-page container">
    <div className="profile-heading"><p className="eyebrow"><Gift size={14} /> INVITE FRIENDS</p><h1>Give a month of Pro, get a month.</h1><p>Friends who join with your link get a <b>{REFERRAL_TRIAL_DAYS}-day</b> free Pro trial instead of 14. You earn points that pay for your plan.</p></div>
    {loading ? <p className="profile-status">Loading your link…</p> : message ? <p className="profile-status">{message}</p> : code && <>
      <section className="invite-card">
        <span>Your invite link</span>
        <div className="invite-link"><code>{link}</code><button type="button" className="icon-button" onClick={() => void copy()} aria-label="Copy link"><Copy size={16} /></button></div>
        {copied && <small className="invite-copied">Copied ✓</small>}
        <button type="button" className="button button-primary invite-share" onClick={() => void share()}><Share2 size={16} /> Share on WhatsApp or anywhere</button>
      </section>
      <section className="invite-stats">
        <div><span>Friends joined</span><strong>{joined}</strong></div>
        <div><span>Points earned</span><strong>{points.toLocaleString("en-IN")}</strong><small>worth {formatCountryMoney(pointsValue(points, country), country)} off your bill</small></div>
      </section>
      <section className="tm-card invite-how">
        <h2>How it works</h2>
        <ol>
          <li>Share your link. Your friend signs in with Google from it.</li>
          <li>They get <b>{REFERRAL_TRIAL_DAYS} days of Pro free</b> (instead of 14). You get <b>+{REFERRAL_REWARD.signup} points</b> right away.</li>
          <li>When they become a paying member, you get <b>+{REFERRAL_REWARD.paid} points</b>: a full month of Pro, free.</li>
        </ol>
        <p className="tm-hint">Points are applied to your bills once payments open (up to half of any bill). They only count for real new accounts that join within 7 days of signing up from your link. Points have no cash value.</p>
      </section>
    </>}
  </main><Footer /></>;
}
