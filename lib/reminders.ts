/**
 * Which phone notification (if any) to send a person today. At most one a day, each kind once per period,
 * so reminders stay useful instead of annoying. Runs daily from /api/cron/reminders (09:00 India time).
 */
import type { MarketMood } from "./marketCoach.ts";

export type ReminderInput = {
  today: { year: number; month: number; day: number }; // India date (month 1–12)
  loggedThisMonth: boolean;
  streak: number;                       // investing streak in months
  daysSincePortfolioUpdate: number | null; // null = no portfolio items
  daysSinceLaterUpdate: number | null;     // EPF/PPF/NPS items; null = none
  market: { mood: MarketMood; drawdown: number } | null;
  sent: Set<string>;                    // already sent: `${kind}:${period}`
};

export type Reminder = { kind: string; period: string; title: string; body: string; url: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function pickReminder(i: ReminderInput): Reminder | null {
  const { year, month, day } = i.today;
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const name = MONTHS[month - 1];
  const candidates: Reminder[] = [];

  // 1. Market-fall coach: once per month while markets are 10%+ below their high.
  if (i.market && (i.market.mood === "correction" || i.market.mood === "bear")) {
    candidates.push({ kind: "market", period: ym, title: `Markets are ${Math.round(i.market.drawdown)}% below their high`, body: "Your FIRE plan is built for this. See how little it moves your freedom date, and why your SIP is buying more units now.", url: "/journey#market-coach" });
  }
  // 2. Log the month: start of month, a week in, and near the end (streak at risk).
  if (!i.loggedThisMonth) {
    if (day >= 1 && day <= 3) candidates.push({ kind: "log-start", period: ym, title: `New month! Log ${name} in 30 seconds`, body: "Your usual numbers are pre-filled. Check them, tap save, earn +60 XP.", url: "/month" });
    if (day >= 8 && day <= 10) candidates.push({ kind: "log-week", period: ym, title: `${name} isn't logged yet`, body: "Two minutes now keeps your savings rate and freedom date true.", url: "/month" });
    if (day >= 25 && i.streak > 0) candidates.push({ kind: "log-streak", period: ym, title: `Your ${i.streak}-month streak ends soon 🔥`, body: `Log ${name} before the month ends to keep it alive.`, url: "/month" });
  }
  // 3. Portfolio balances: monthly, when they're more than a month old.
  if (day >= 12 && day <= 14 && i.daysSincePortfolioUpdate !== null && i.daysSincePortfolioUpdate > 30) {
    candidates.push({ kind: "portfolio", period: ym, title: "Update your portfolio balances", body: "Takes a minute: open your fund app, type today's totals. Your FIRE progress updates instantly.", url: "/accounts" });
  }
  // 4. EPF/PPF/NPS: once a quarter.
  if ([1, 4, 7, 10].includes(month) && day >= 5 && day <= 7 && i.daysSinceLaterUpdate !== null && i.daysSinceLaterUpdate > 80) {
    candidates.push({ kind: "later-assets", period: ym, title: "Quarterly check: EPF, PPF and NPS", body: "Update their balances from your passbook or app so your later-life money stays accurate.", url: "/accounts" });
  }
  // 5. Tax season.
  if (month === 1 && day >= 15 && day <= 17) candidates.push({ kind: "tax-plan", period: String(year), title: "Tax season: old or new regime?", body: "See which saves you more and which deductions you haven't used yet, before your employer's March deadline.", url: "/tax" });
  if (month === 3 && day >= 10 && day <= 12) candidates.push({ kind: "tax-ltcg", period: String(year), title: "Book ₹1.25 lakh of tax-free gains", body: "Before 31 March: harvest long-term equity gains tax-free. See how much in the tax planner.", url: "/tax" });
  // 6. Year-end recap.
  if (month === 12 && day >= 28) candidates.push({ kind: "recap", period: String(year), title: `Your ${year} FIRE recap is ready 🎉`, body: "How much you invested, your best month and how far you moved towards freedom.", url: "/recap" });

  return candidates.find(c => !i.sent.has(`${c.kind}:${c.period}`)) ?? null;
}

/** Today's date in India (the cron runs on UTC). */
export function indiaToday(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1, day: ist.getUTCDate() };
}
