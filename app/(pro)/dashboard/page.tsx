"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Award, Flame, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActionSteps, getBadges, getFireScore, getInvestmentStreak, type FinancialProfile } from "@/lib/fireScore";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PrincipleScoreImpact from "@/components/dashboard/PrincipleScoreImpact";

export default function DashboardPage() {
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [investmentStreak, setInvestmentStreak] = useState(0);
  const [checkinHistory, setCheckinHistory] = useState<{ month_start: string; income: number; investment_income: number; expenses: number; invested: number; debt_paid: number }[]>([]);
  const [savedBadgeKeys, setSavedBadgeKeys] = useState<string[]>([]);
  const [selectedPrinciples, setSelectedPrinciples] = useState<string[]>([]);
  const scoreProfile = useMemo(() => {
    if (!profile || checkinHistory.length === 0) return profile;
    const recent = checkinHistory.slice(0, 3);
    const average = (key: "income" | "investment_income" | "expenses" | "invested") => recent.reduce((total, entry) => total + entry[key], 0) / recent.length;
    return { ...profile, monthly_income: average("income"), monthly_investment_income: average("investment_income"), monthly_expenses: average("expenses"), monthly_investment: average("invested") };
  }, [profile, checkinHistory]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) throw sessionError;
        const user = session?.user;
        if (!user) setMessage("Sign in with Google to see your personal FIRE score.");
        else {
          const { data, error } = await supabase.from("financial_profiles").select("age, monthly_income, monthly_investment_income, monthly_expenses, assets, fire_accessible_assets, later_retirement_assets, selected_fire_principles, liabilities, emergency_fund, monthly_investment, has_health_insurance, has_term_insurance, has_dependents, health_cover_amount, term_cover_amount, currency").eq("user_id", user.id).maybeSingle();
          if (!active) return;
          if (error) setMessage("Could not load your profile. Make sure you ran the latest FIRE inputs migration in Supabase. Details: " + error.message);
          else if (!data) setMessage("Complete your financial profile to unlock your score and badges.");
          else {
            setSelectedPrinciples(data.selected_fire_principles ?? []);
            const baseProfile: FinancialProfile = { age: data.age, monthly_income: Number(data.monthly_income), monthly_investment_income: Number(data.monthly_investment_income ?? 0), monthly_expenses: Number(data.monthly_expenses), assets: Number(data.assets), fire_accessible_assets: data.fire_accessible_assets === null ? undefined : Number(data.fire_accessible_assets), later_retirement_assets: Number(data.later_retirement_assets ?? 0), fireSplitComplete: data.fire_accessible_assets !== null && data.later_retirement_assets !== null, liabilities: Number(data.liabilities), emergency_fund: Number(data.emergency_fund), monthly_investment: Number(data.monthly_investment), has_health_insurance: data.has_health_insurance, has_term_insurance: data.has_term_insurance, has_dependents: data.has_dependents, health_cover_amount: Number(data.health_cover_amount), term_cover_amount: Number(data.term_cover_amount), currency: data.currency };
            const [accountsResult, planResult] = await Promise.all([
              supabase.from("financial_accounts").select("*").eq("user_id", user.id),
              supabase.from("fire_plans").select("withdrawal_rate").eq("user_id", user.id).maybeSingle(),
            ]);
            const accounts = accountsResult.data;
            if (active) {
              const records = accounts ?? [];
              const assets = records.filter(row => row.kind === "asset");
              const investableAssets = assets.filter(row => row.fire_treatment === "available" && !row.goal_id); // goal money isn't FIRE money
              const laterAssets = assets.filter(row => row.fire_treatment === "later");
              const debts = records.filter(row => row.kind === "liability");
              setProfile({
                ...baseProfile,
                assets: assets.length ? assets.reduce((sum, row) => sum + Number(row.current_value), 0) : baseProfile.assets,
                investableAssets: assets.length ? investableAssets.reduce((sum, row) => sum + Number(row.current_value), 0) : (baseProfile.fire_accessible_assets ?? baseProfile.assets),
                laterRetirementAssets: assets.length ? laterAssets.reduce((sum, row) => sum + Number(row.current_value), 0) : baseProfile.later_retirement_assets,
                fireSplitComplete: assets.length ? true : baseProfile.fireSplitComplete,
                liabilities: debts.length ? debts.reduce((sum, row) => sum + Number(row.current_value), 0) : baseProfile.liabilities,
                monthlyDebtPayments: debts.reduce((sum, row) => sum + Number(row.monthly_payment), 0),
                highInterestDebt: debts.filter(row => row.is_high_interest).reduce((sum, row) => sum + Number(row.current_value), 0),
                detailedDebtData: debts.length > 0,
                withdrawal_rate: Number(planResult.data?.withdrawal_rate ?? 3.5),
              });
            }
            const { data: checkins } = await supabase.from("monthly_checkins").select("month_start, income, investment_income, expenses, invested, debt_paid").eq("user_id", user.id).order("month_start", { ascending: false }).limit(12);
            if (active && checkins) {
              setInvestmentStreak(getInvestmentStreak(checkins.map(row => ({ month_start: row.month_start, invested: Number(row.invested) }))));
              setCheckinHistory(checkins.map(row => ({ month_start: row.month_start, income: Number(row.income), investment_income: Number(row.investment_income ?? 0), expenses: Number(row.expenses), invested: Number(row.invested), debt_paid: Number(row.debt_paid) })));
            }
          }
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? `Could not check your sign-in session: ${error.message}` : "Could not check your sign-in session.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!scoreProfile) return;
    const supabase = createClient();
    if (!supabase) return;
    let active = true;
    const toKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: existing, error } = await supabase.from("badge_awards").select("badge_key").eq("user_id", session.user.id);
      if (error || !active) return;
      const existingKeys = (existing ?? []).map(row => row.badge_key);
      const existingSet = new Set(existingKeys);
      const newlyEarned = getBadges(scoreProfile, investmentStreak).filter(badge => badge.earned && !existingSet.has(toKey(badge.name)));
      if (newlyEarned.length) {
        const { error: saveError } = await supabase.from("badge_awards").upsert(newlyEarned.map(badge => ({ user_id: session.user.id, badge_key: toKey(badge.name) })), { onConflict: "user_id,badge_key", ignoreDuplicates: true });
        if (saveError || !active) return;
      }
      if (active) setSavedBadgeKeys([...new Set([...existingKeys, ...newlyEarned.map(badge => toKey(badge.name))])]);
    })();
    return () => { active = false; };
  }, [scoreProfile, investmentStreak]);

  const score = scoreProfile ? getFireScore(scoreProfile) : null;
  const badgeKeys = new Set(savedBadgeKeys);
  const badges = scoreProfile ? getBadges(scoreProfile, investmentStreak).map(badge => ({ ...badge, earned: badge.earned || badgeKeys.has(badge.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")) })) : [];
  const actionSteps = scoreProfile ? getActionSteps(scoreProfile) : [];
  const historyMax = Math.max(1, ...checkinHistory.map(entry => entry.income));
  const formatMoney = (value: number) => profile ? new Intl.NumberFormat(profile.currency === "INR" ? "en-IN" : profile.currency === "AED" ? "en-AE" : "en-US", { style: "currency", currency: profile.currency, maximumFractionDigits: 0, notation: value > 9999999 ? "compact" : "standard" }).format(value) : "—";

  return (
    <>
      <Header />
      <main className="dashboard-page container">
        <div className="dashboard-heading">
          <div><p className="eyebrow"><Flame size={14} /> YOUR FIRE JOURNEY</p><h1>Your progress, made visible.</h1><p>A personal planning score based on the information you shared.</p></div>
          <div className="dashboard-links"><Link href="/profile" className="button button-primary">Update profile</Link><Link href="/accounts" className="text-link">Manage assets & loans →</Link></div>
        </div>
        {loading ? <p className="profile-status">Loading your score…</p> : score && profile ? <>
          <section className="score-overview">
            <div className="score-ring" style={{ background: `radial-gradient(closest-side, #142b45 82%, transparent 84% 100%), conic-gradient(#55d6a6 ${score.score}%, #ffffff25 0)` }} aria-label={`FIRE readiness score ${score.score} out of 100`}><span><strong>{score.score}</strong><small>/100</small></span></div>
            <div className="score-copy"><p className="result-kicker">PERSONAL FIRE READINESS</p><h2>{score.score >= 80 ? "Freedom momentum" : score.score >= 55 ? "Building strong habits" : "Your journey starts here"}</h2><p>This is a coaching score to help you spot practical next steps. It is not a credit score, financial grade, or investment recommendation.</p></div>
            <div className="score-stat"><span>Estimated net worth</span><strong>{formatMoney(score.netWorth)}</strong></div>
          </section>
          <Link href="/journey" className="journey-teaser"><span>🔥</span><div><strong>Play your FIRE journey</strong><small>See your rank, XP, current level, freedom date and today’s book lesson.</small></div><ArrowUpRight size={18} /></Link>
          <section className="account-totals dashboard-portfolio"><div><span>FIRE-accessible funds</span><small>Used for FIRE progress</small><strong>{formatMoney(profile.investableAssets ?? profile.assets)}</strong></div><div><span>Later-access retirement</span><small>NPS / PF and similar assets</small><strong>{formatMoney(profile.laterRetirementAssets ?? 0)}</strong></div><div><span>Overall assets</span><small>Includes home, vehicle and other property</small><strong>{formatMoney(profile.assets)}</strong></div></section>
          {!profile.fireSplitComplete && <p className="account-source-note">Your saved profile has not been split into FIRE-accessible and later-access assets yet. The score currently uses your overall profile asset estimate. <Link href="/profile">Classify your portfolio in your profile</Link>.</p>}
          <section className="quick-updates"><div className="quick-updates-heading"><p className="eyebrow">QUICK UPDATES</p><span>Keep your plan current in a few clicks.</span></div><div className="quick-update-grid"><Link href="/month" className="quick-update-card"><span>MONTHLY</span><strong>Log this month</strong><small>Income, expenses, investing</small><ArrowUpRight size={16} /></Link><Link href="/month" className="quick-update-card"><span>BUDGET</span><strong>Update budget</strong><small>Targets and spending</small><ArrowUpRight size={16} /></Link><Link href="/accounts" className="quick-update-card"><span>PORTFOLIO</span><strong>Update assets & loans</strong><small>Balances and FIRE access</small><ArrowUpRight size={16} /></Link><Link href="/profile" className="quick-update-card"><span>PROFILE</span><strong>Update your numbers</strong><small>Income, funds, protection</small><ArrowUpRight size={16} /></Link></div></section>
          <section className="score-panel">
            <div className="section-heading"><p className="eyebrow"><TrendingUp size={14} /> WHAT SHAPES YOUR SCORE</p><h2>Clear factors. <span>Practical progress.</span></h2></div>
            <div className="score-categories">{score.categories.map(category => <article className="score-category" key={category.name}>
              <div className="score-category-head"><strong>{category.name}</strong><span>{Math.round(category.score)} / {category.max}</span></div>
              <div className="score-track"><span style={{ width: `${(category.score / category.max) * 100}%` }} /></div>
              <p>{category.explanation}</p>
            </article>)}</div>
            <p className="score-method">Current model: 100 points across six categories. {checkinHistory.length ? `Savings and investing rates use the latest ${Math.min(3, checkinHistory.length)} monthly check-in(s).` : "Savings and investing rates use your profile estimates until you log a check-in."} FIRE progress uses assets classified as available now, with your saved withdrawal assumption ({score.withdrawalRate}% by default). Home, vehicles and other excluded items remain in net worth; later-access retirement funds are shown separately.</p>
          </section>
          <section className="badge-section">
            <div className="section-heading"><p className="eyebrow"><Award size={14} /> MILESTONE BADGES</p><h2>Small wins add up.</h2><p>{badges.filter(badge => badge.earned).length} of {badges.length} milestones reached</p></div>
            <div className="badge-grid">{badges.map(badge => <article className={badge.earned ? "badge-card earned" : "badge-card locked"} key={badge.name}><span className="badge-icon"><Award size={20} /></span><div><h3>{badge.name}</h3><p>{badge.description}</p><small>{badge.earned ? "Earned" : "Next milestone"}</small></div></article>)}</div>
          </section>
          <PrincipleScoreImpact selected={selectedPrinciples} categories={score.categories} />
          <section className="history-section"><div className="section-heading"><p className="eyebrow">MONTHLY MOMENTUM</p><h2>Your habits over time.</h2><p>Recent check-ins help you spot patterns without judging any single month.</p></div>{checkinHistory.length ? <div className="history-list">{checkinHistory.slice(0, 6).map(entry => { const savings = entry.income > 0 ? ((entry.income - entry.expenses) / entry.income) * 100 : 0; return <article className="history-row" key={entry.month_start}><div className="history-month">{new Date(`${entry.month_start}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })}</div><div className="history-bars"><span className="history-bar income" style={{ width: `${Math.max(3, entry.income / historyMax * 100)}%` }} /><span className="history-bar spending" style={{ width: `${Math.max(3, entry.expenses / historyMax * 100)}%` }} /><span className="history-bar investing" style={{ width: `${Math.max(3, entry.invested / historyMax * 100)}%` }} /></div><div className="history-stats"><span>Saved {savings.toFixed(0)}%</span><span>Invested {formatMoney(entry.invested)}</span></div></article>; })}<div className="history-legend"><span><i className="income" />Income</span><span><i className="spending" />Expenses</span><span><i className="investing" />Invested</span></div></div> : <div className="profile-card history-empty"><p>No check-ins yet. Record this month to start seeing your progress.</p><Link href="/month" className="button button-primary">Start a monthly check-in</Link></div>}</section>
          <section className="action-plan"><div className="section-heading"><p className="eyebrow">YOUR NEXT STEPS</p><h2>Small actions for your plan.</h2><p>These educational prompts are based on the figures you entered, not product or investment recommendations.</p></div><div className="action-step-list">{actionSteps.map((action, index) => <article className={"action-step " + action.priority} key={action.title}><span className="action-priority">{index === 0 ? "Start here" : action.priority === "focus" ? "Focus" : action.priority === "review" ? "Review" : "Build"}</span><div><h3>{action.title}</h3><p>{action.detail}</p></div><Link className="text-link" href={action.href}>Open &rarr;</Link></article>)}</div></section>
        </> : <section className="profile-card dashboard-empty"><p>{message}</p><Link href="/profile" className="button button-primary">Go to my profile</Link></section>}
      </main>
      <Footer />
    </>
  );
}
