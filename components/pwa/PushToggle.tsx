"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY = "ff-push-dismissed";
type Status = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on" | "missing-key";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/**
 * Turns phone reminders on/off for this device. `variant="card"` is the dismissible prompt on Home;
 * `variant="settings"` is the always-visible switch on the Subscription page.
 */
export default function PushToggle({ variant = "settings" }: { variant?: "card" | "settings" }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* fine */ }
    void (async () => {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { setStatus("missing-key"); return; }
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setStatus(ios && !standalone ? "ios-install" : "unsupported"); return; }
      if (Notification.permission === "denied") { setStatus("blocked"); return; }
      try { const reg = await navigator.serviceWorker.getRegistration("/"); const sub = await reg?.pushManager.getSubscription(); setStatus(sub ? "on" : "off"); }
      catch { setStatus("off"); }
    })();
  }, []);

  async function enable() {
    setBusy(true); setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus(permission === "denied" ? "blocked" : "off"); return; }
      const reg = await registration();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const supabase = createClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!supabase || !session?.user) throw new Error("Sign in first.");
      const { error } = await supabase.from("push_subscriptions").upsert({ user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: "endpoint" });
      if (error) throw new Error(error.message.includes("push_subscriptions") ? "Run supabase/migrations/202611280036_push_notifications.sql in Supabase first." : error.message);
      setStatus("on");
      setMessage("✅ Reminders are on. At most one a day, only when it’s useful.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn’t turn on reminders."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const supabase = createClient();
        await supabase?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off"); setMessage("Reminders are off on this device.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn’t turn off reminders."); }
    finally { setBusy(false); }
  }

  const what = "Log your month, keep your streak, update balances, tax deadlines, and a calm word when markets fall. At most one a day.";

  if (variant === "card") {
    if (dismissed || status !== "off") return message ? <p className="profile-status">{message}</p> : null;
    return <div className="push-card">
      <span><Bell size={20} /></span>
      <div><strong>Get reminders on your phone</strong><small>{what}</small></div>
      <div className="push-card-actions">
        <button type="button" className="button button-primary" onClick={() => void enable()} disabled={busy}>{busy ? "Turning on…" : "Turn on"}</button>
        <button type="button" className="text-link" onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* fine */ } }}>Not now</button>
      </div>
    </div>;
  }

  return <section className="account-card push-settings">
    <p className="eyebrow"><Bell size={14} /> PHONE REMINDERS</p>
    <p className="account-sub">{what}</p>
    {status === "loading" ? <p className="account-sub">Checking this device…</p>
      : status === "on" ? <button type="button" className="button button-light" onClick={() => void disable()} disabled={busy}><BellOff size={16} /> Turn off on this device</button>
      : status === "off" ? <button type="button" className="button button-primary" onClick={() => void enable()} disabled={busy}><Bell size={16} /> {busy ? "Turning on…" : "Turn on reminders"}</button>
      : <p className="account-sub">{status === "blocked" ? "Notifications are blocked for FIREpath. Allow them in your browser or phone settings, then come back here."
        : status === "ios-install" ? "On iPhone, add FIREpath to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on reminders."
        : status === "missing-key" ? "Reminders aren’t set up on this server yet."
        : "This browser doesn’t support notifications. Try Chrome on Android or the FIREpath app."}</p>}
    {message && <p className="profile-status" role="status">{message}</p>}
  </section>;
}
