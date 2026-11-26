"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProgressHistory from "@/components/game/ProgressHistory";
import { createClient } from "@/lib/supabase/client";
import { loadFinancialState, type FinancialState } from "@/lib/financialState";
import { getGameSummary } from "@/lib/gameSummary";
import { buildMonthlyReport } from "@/lib/report";
import { analyzeGoal, goalCategories } from "@/lib/goals";
import { getCurrentLevel, getFreedomPath } from "@/lib/freedomPath";
import { countryFromCurrency, formatCountryMoney } from "@/lib/country";

export default function ReportPage() {
  const [state, setState] = useState<FinancialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        setState(await loadFinancialState(supabase, session.user.id));
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load your report."); }
      finally { setLoading(false); }
    })();
  }, []);

  const report = useMemo(() => (state ? buildMonthlyReport({ snapshots: state.snapshots, checkins: state.checkins, lessons: state.lessons }) : null), [state]);
  const summary = useMemo(() => (state ? getGameSummary(state) : null), [state]);
  const code = countryFromCurrency(state?.profile?.currency);
  const money = (value: number) => formatCountryMoney(value, code);
  const signed = (value: number | null, format: (v: number) => string) => (value === null ? "—" : `${value >= 0 ? "+" : "−"}${format(Math.abs(value))}`);

  const focus = useMemo(() => {
    if (!state?.scoreProfile || !report) return [];
    const items: { emoji: string; text: string; href: string }[] = [];
    if (!report.loggedThisMonth) items.push({ emoji: "🧾", text: "Log this month’s money (pre-filled, 30 seconds)", href: "/month" });
    const level = getCurrentLevel(getFreedomPath(state.scoreProfile, { retirementAge: state.plan.retirement_age, expectedReturn: state.plan.expected_return, inflation: state.plan.inflation_rate }));
    if (level) items.push({ emoji: "🗺️", text: `Level ${level.level} · ${level.title}: ${level.howToClear}`, href: level.href });
    const behind = state.goals.filter(goal => !goal.completed_at).map(goal => ({ goal, a: analyzeGoal(goal) })).find(item => item.a.status === "behind");
    if (behind) items.push({ emoji: "🎯", text: `“${behind.goal.name}” needs about ${money(Math.max(0, behind.a.requiredMonthly - behind.goal.monthly_contribution))} more a month`, href: "/goals" });
    if (!(state.plan.step_up_percent ?? 0)) items.push({ emoji: "📈", text: "Set up an annual step-up — often the biggest single boost to your freedom date", href: "/journey" });
    if (report.lessonsThisMonth === 0) items.push({ emoji: "📚", text: "Read one 2-minute book lesson", href: "/journey#lesson" });
    return items.slice(0, 3);
  }, [state, report]); // money only depends on state

  return <><Header /><main className="report-page container">
    {loading ? <p className="profile-status">Preparing your report…</p> : !report || !state ? <p className="profile-status">{message || "Complete your profile to get your monthly report."}</p> : <>
      <div className="report-head">
        <p className="eyebrow"><Mail size={14} /> YOUR MONTHLY FIRE REPORT</p>
        <h1>{report.monthLabel}</h1>
      </div>

      <section className="report-verdict"><span>{report.verdict.emoji}</span><div><h2>{report.verdict.title}</h2><p>{report.verdict.body}</p></div></section>

      <section className="report-grid">
        <div><span>FIRE progress</span><strong>{summary ? `${summary.metrics.fireProgress.toFixed(1)}%` : "—"}</strong><small>{signed(report.progressChange, v => `${v.toFixed(1)}%`)} vs last month</small></div>
        <div><span>FIRE portfolio</span><strong>{summary ? money(Math.max(0, summary.profile.investableAssets ?? summary.profile.assets)) : "—"}</strong><small>{signed(report.portfolioChange, money)} vs last month</small></div>
        <div><span>Net worth</span><strong>{summary ? money(summary.profile.assets - summary.profile.liabilities) : "—"}</strong><small>{signed(report.netWorthChange, money)} vs last month</small></div>
        <div><span>FIRE score</span><strong>{summary?.score ?? "—"}/100</strong><small>{signed(report.scoreChange, v => `${Math.round(v)}`)} points</small></div>
      </section>

      <section className="report-two">
        <div className="report-box">
          <h3>💰 Your money this month</h3>
          {report.checkin ? <ul className="report-list">
            <li><span>Came in</span><b>{money(report.checkin.income)}</b></li>
            <li><span>Spent</span><b>{money(report.checkin.expenses)}</b></li>
            <li><span>Invested</span><b>{money(report.checkin.invested)} · {report.checkin.investRate.toFixed(0)}% of income</b></li>
            <li><span>Saving rate</span><b>{report.checkin.savingsRate.toFixed(0)}%{report.previousCheckin ? ` (${report.checkin.savingsRate >= report.previousCheckin.savingsRate ? "▲" : "▼"} from ${report.previousCheckin.savingsRate.toFixed(0)}%)` : ""}</b></li>
          </ul> : <p className="side-empty">No check-in yet. <Link href="/month">Log your month</Link> to see this section.</p>}
        </div>
        <div className="report-box">
          <h3>🔥 Your habits</h3>
          <ul className="report-list">
            <li><span>Investing streak</span><b>{summary?.streak ?? 0} month{summary?.streak === 1 ? "" : "s"}</b></li>
            <li><span>This month logged</span><b>{report.loggedThisMonth ? "Yes ✓" : "Not yet"}</b></li>
            <li><span>Lessons this month</span><b>{report.lessonsThisMonth}</b></li>
            <li><span>Rank</span><b>{summary?.rank.name ?? "—"}</b></li>
          </ul>
        </div>
      </section>

      {state.goals.filter(goal => !goal.completed_at).length > 0 && <section className="report-box">
        <h3>🎯 Your goals</h3>
        <ul className="report-list">{state.goals.filter(goal => !goal.completed_at).map(goal => { const a = analyzeGoal(goal); return <li key={goal.id}><span>{goalCategories.find(c => c.id === goal.category)?.emoji} {goal.name}</span><b>{a.progress.toFixed(0)}% · {a.status === "behind" ? "needs a boost" : a.status === "achieved" ? "achieved 🎉" : "on track"}</b></li>; })}</ul>
      </section>}

      <ProgressHistory snapshots={state.snapshots} />
      <a href="/trends" className="saver-strip tone-ok trends-link"><span className="saver-strip-emoji">📊</span><div><small>MONEY TRENDS</small><strong>See all your months and years</strong><span>Where each month’s money went, your savings rate over time and spending by category.</span></div></a>

      <section className="report-focus">
        <h3>Next month, focus on</h3>
        {focus.length ? focus.map(item => <Link key={item.text} href={item.href} className="report-focus-item"><span>{item.emoji}</span><p>{item.text}</p><ArrowRight size={16} /></Link>) : <p className="side-empty">You’re doing everything right. Keep going. 💚</p>}
      </section>

      <p className="journey-note">Your report updates as you log months and open FIREpath. Illustrative figures — not investment advice.</p>
    </>}
  </main><Footer /></>;
}
