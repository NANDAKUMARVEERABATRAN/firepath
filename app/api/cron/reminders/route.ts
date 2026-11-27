import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { fetchMarket } from "@/lib/marketData";
import { indiaToday, pickReminder } from "@/lib/reminders";
import { getInvestmentStreak } from "@/lib/fireScore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86400000;
const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);

/**
 * Daily at 09:00 India time (vercel.json cron). Sends at most one reminder per person per day.
 * Needs: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
 * Only reads what's needed to choose a reminder; notification text never contains amounts.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !publicKey || !privateKey) return NextResponse.json({ error: "missing configuration" }, { status: 500 });

  webpush.setVapidDetails(process.env.NEXT_PUBLIC_SITE_URL || "https://firepath.app", publicKey, privateKey);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const today = indiaToday();
  const monthStart = `${today.year}-${String(today.month).padStart(2, "0")}-01`;
  const market = await fetchMarket();

  const { data: subs, error } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  let sent = 0, removed = 0;
  for (const [userId, devices] of byUser) {
    try {
      const [checkins, accounts, log] = await Promise.all([
        db.from("monthly_checkins").select("month_start, invested, auto_filled").eq("user_id", userId).order("month_start", { ascending: false }).limit(24),
        db.from("financial_accounts").select("kind, fire_treatment, updated_at, created_at").eq("user_id", userId),
        db.from("notification_log").select("kind, period").eq("user_id", userId).gte("sent_at", new Date(Date.now() - 400 * DAY).toISOString()),
      ]);
      const rows = (checkins.data ?? []).filter(c => !c.auto_filled);
      const assets = (accounts.data ?? []).filter(a => a.kind === "asset");
      const newest = (list: typeof assets) => list.map(a => a.updated_at ?? a.created_at).filter(Boolean).sort().pop() ?? null;
      const later = assets.filter(a => a.fire_treatment === "later");
      const reminder = pickReminder({
        today,
        loggedThisMonth: rows.some(c => c.month_start === monthStart),
        streak: getInvestmentStreak(rows.map(c => ({ month_start: c.month_start, invested: Number(c.invested) }))),
        daysSincePortfolioUpdate: assets.length ? daysSince(newest(assets)) : null,
        daysSinceLaterUpdate: later.length ? daysSince(newest(later)) : null,
        market: market ? { mood: market.mood, drawdown: market.drawdown } : null,
        sent: new Set((log.data ?? []).map(l => `${l.kind}:${l.period}`)),
      });
      if (!reminder) continue;
      const payload = JSON.stringify({ title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.kind });
      let delivered = false;
      for (const d of devices ?? []) {
        try { await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 86400 }); delivered = true; }
        catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) { await db.from("push_subscriptions").delete().eq("id", d.id); removed++; } // phone unsubscribed
        }
      }
      if (delivered) { await db.from("notification_log").insert({ user_id: userId, kind: reminder.kind, period: reminder.period }); sent++; }
    } catch { /* one person's failure never stops the others */ }
  }
  return NextResponse.json({ users: byUser.size, sent, removed, market: market?.mood ?? null });
}
