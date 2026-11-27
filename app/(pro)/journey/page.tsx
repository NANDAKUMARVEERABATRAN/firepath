"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Flame, Lock, Map as MapIcon, Rocket, Sparkles, Target, Trophy, Wallet } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Celebration from "@/components/game/Celebration";
import DailyLesson from "@/components/game/DailyLesson";
import FireSlider from "@/components/game/FireSlider";
import ProgressHistory from "@/components/game/ProgressHistory";
import StepUpPlan from "@/components/game/StepUpPlan";
import { getProgressSummary, monthStartOf, saveSnapshot } from "@/lib/progress";
import ShareMilestone from "@/components/game/ShareMilestone";
import { getMilestones } from "@/lib/milestones";
import QuickSetup from "@/components/game/QuickSetup";
import QuickLog from "@/components/forms/QuickLog";
import { createClient } from "@/lib/supabase/client";
import { loadFinancialState, formatMoney, getPortfolioMix, type FinancialState } from "@/lib/financialState";
import { getBadges, getFireScore, getInvestmentStreak, targetExpenses, totalIncome } from "@/lib/fireScore";
import { getCurrentLevel, getFreedomMetrics, getFreedomPath, getMotivation, getRank, getXp, PATH_LEVELS, RANKS, sipForYears } from "@/lib/freedomPath";
import { analyzeGoal, goalCategories, statusLabel } from "@/lib/goals";
import { getLessonOfDay, lessons as allLessons } from "@/lib/wisdom";
import { fireStyles, getWhyResult, styleTip } from "@/lib/fireWhy";
import { inFutureMoney } from "@/lib/inflation";
import { daysSince } from "@/lib/spendingCheckup";
import { cutNeededForRate, getNextTier, getSavingsTier, savingsRate } from "@/lib/savingsCoach";

const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; };
const badgeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export default function JourneyPage() {
  const [state, setState] = useState<FinancialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [lessonOffset, setLessonOffset] = useState(0);
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { if (active) setMessage("signin"); return; }
        const meta = session.user.user_metadata ?? {};
        if (active) { setUserId(session.user.id); setFirstName(String(meta.full_name ?? meta.name ?? "").split(" ")[0]); }
        const loaded = await loadFinancialState(supabase, session.user.id);
        if (active) setState(loaded);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load your journey.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reload]);

  const game = useMemo(() => {
    if (!state?.scoreProfile) return null;
    const profile = state.scoreProfile;
    const options = { retirementAge: state.plan.retirement_age, expectedReturn: state.plan.expected_return, inflation: state.plan.inflation_rate };
    const path = getFreedomPath(profile, options);
    const current = getCurrentLevel(path);
    const streak = getInvestmentStreak(state.checkins.map(row => ({ month_start: row.month_start, invested: row.invested })));
    const saved = new Set(state.badgeKeys);
    const badges = getBadges(profile, streak).map(badge => ({ ...badge, earned: badge.earned || saved.has(badgeKey(badge.name)) }));
    const activeGoals = state.goals.filter(goal => !goal.completed_at);
    const analyses = state.goals.map(goal => ({ goal, analysis: analyzeGoal(goal) }));
    const goalProgress = activeGoals.length ? analyses.filter(item => !item.goal.completed_at).reduce((sum, item) => sum + item.analysis.progress, 0) / activeGoals.length : 0;
    const xp = getXp({
      levelsCleared: path.filter(level => level.cleared).length,
      badgesEarned: badges.filter(badge => badge.earned).length,
      checkins: state.checkins.length,
      investmentStreak: streak,
      lessonsCompleted: state.lessons.length,
      lessonsCorrect: state.lessons.filter(lesson => lesson.answered_correctly).length,
      goalsCreated: state.goals.length,
      goalsCompleted: state.goals.filter(goal => goal.completed_at).length,
      goalProgressPercent: goalProgress,
      whySet: state.why.reasons.length > 0,
      leaksPlugged: Object.keys(state.cutPlan?.items ?? {}).length,
    });
    const rank = getRank(xp.total);
    const metrics = getFreedomMetrics(profile, options);
    const score = getFireScore(profile);
    const rate = savingsRate(totalIncome(profile), profile.monthly_expenses);
    return { profile, path, current, streak, badges, analyses, xp, rank, metrics, score, rate, motivation: getMotivation(metrics, current, streak), mix: getPortfolioMix(state.accounts) };
  }, [state]);

  // Save this month's progress point (once per visit) so the history chart keeps growing.
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  useEffect(() => {
    if (!game || !state || snapshotSaved) return;
    setSnapshotSaved(true);
    const supabase = createClient();
    if (!supabase) return;
    const point = { net_worth: game.score.netWorth, fire_portfolio: Math.max(0, game.profile.investableAssets ?? game.profile.assets), fire_target: game.metrics.fireTarget, fire_progress: game.metrics.fireProgress, fire_score: game.score.score, currency: game.profile.currency };
    void saveSnapshot(supabase, state.userId, point);
    const month = monthStartOf();
    setState(current => current ? { ...current, snapshots: [...current.snapshots.filter(s => s.month_start !== month), { month_start: month, ...point }] } : current);
  }, [game, state, snapshotSaved]);

  // Celebrate when the player reaches a new rank (remembered per browser).
  useEffect(() => {
    if (!game) return;
    try {
      const key = `ff-rank-${state?.userId}`;
      const last = Number(window.localStorage.getItem(key) ?? "-1");
      if (last >= 0 && game.rank.index > last) setCelebrate({ title: `Rank up! You’re now a ${game.rank.name}`, detail: `You reached rank ${game.rank.rankNumber} of ${RANKS.length}. Every habit you keep moves you closer to freedom.` });
      window.localStorage.setItem(key, String(game.rank.index));
    } catch { /* storage unavailable */ }
  }, [game, state?.userId]);

  const completedIds = useMemo(() => state?.lessons.map(lesson => lesson.lesson_id) ?? [], [state]);
  const todaysLesson = useMemo(() => {
    const base = getLessonOfDay(new Date(), completedIds);
    if (!lessonOffset) return base;
    const index = allLessons.findIndex(lesson => lesson.id === base.id);
    return allLessons[(index + lessonOffset) % allLessons.length];
  }, [completedIds, lessonOffset]);

  const answerLesson = useCallback(async (lessonId: string, correct: boolean) => {
    const supabase = createClient();
    if (!supabase || !state) return;
    const already = state.lessons.find(lesson => lesson.lesson_id === lessonId);
    if (already) return;
    const { error } = await supabase.from("lesson_completions").upsert({ user_id: state.userId, lesson_id: lessonId, answered_correctly: correct }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    if (error) { setMessage(`Lesson not saved: ${error.message}. Run the goals & lessons migration in Supabase.`); return; }
    setState(current => current ? { ...current, lessons: [...current.lessons, { lesson_id: lessonId, answered_correctly: correct, completed_at: new Date().toISOString() }] } : current);
  }, [state]);

  const money = (value: number) => formatMoney(value, game?.profile.currency ?? "INR");

  // Annual step-up reminder: in the chosen month, until the user confirms they raised their investment this year.
  const stepUpDue = Boolean(game && state && (state.plan.step_up_percent ?? 0) > 0 && state.plan.step_up_month === new Date().getMonth() + 1 && state.plan.step_up_done_year !== new Date().getFullYear() && game.profile.monthly_investment > 0);
  const stepUpTarget = game && state ? Math.round(game.profile.monthly_investment * (1 + (state.plan.step_up_percent ?? 0) / 100) / 100) * 100 : 0;
  async function confirmStepUp() {
    const supabase = createClient();
    if (!supabase || !state) return;
    const year = new Date().getFullYear();
    await Promise.all([
      supabase.from("fire_plans").update({ step_up_done_year: year, updated_at: new Date().toISOString() }).eq("user_id", state.userId),
      supabase.from("financial_profiles").update({ monthly_investment: stepUpTarget, updated_at: new Date().toISOString() }).eq("user_id", state.userId),
    ]);
    setCelebrate({ title: "Stepped up! 🚀", detail: `You now invest ${money(stepUpTarget)} a month. Your freedom date just moved closer — see it below.` });
    setLoading(true); setReload(value => value + 1);
  }

  // Monthly habit loop: what's done this month, and whether the investing streak needs saving.
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthName = now.toLocaleDateString("en-IN", { month: "long" });
  const loggedThisMonth = Boolean(state?.checkins.some(row => row.month_start === thisMonth));
  const streakAtRisk = Boolean(game && game.streak > 0 && !loggedThisMonth);
  const lessonToday = Boolean(state?.lessons.some(row => new Date(row.completed_at).toDateString() === now.toDateString()));
  const checklist = [
    { label: `Log ${monthName}’s money`, href: "/month", done: loggedThisMonth, reward: "+60 XP · keeps your streak" },
    { label: "Today’s book lesson", href: "#lesson", done: lessonToday, reward: "+50 XP · 2 minutes" },
    ...(game && game.rate !== null && game.rate < 20 ? [{ label: "Hunt one spending leak", href: "/save-more", done: Boolean(state?.cutPlan), reward: "+40 XP per leak" }] : [{ label: "Set or fund a goal", href: "/goals", done: Boolean(state?.goals.length), reward: "+50 XP" }]),
    { label: game?.current ? `Quest: ${game.current.title}` : "Review your plan", href: game?.current?.href ?? "/plan", done: !game?.current, reward: "+250 XP" },
  ];

  return <><Header /><main className="journey-page container">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    {loading ? <p className="profile-status">Loading your journey…</p> : message === "signin" ? (
      <section className="journey-welcome">
        <p className="eyebrow"><Rocket size={14} /> YOUR FIRE GAME</p>
        <h1>Turn financial freedom into a game you can win.</h1>
        <p>Clear 11 levels from “money map” to “financially independent” and Fat FIRE. Earn XP for every check-in, lesson and goal. Learn one idea a day from the world’s best money books.</p>
        <Link href="/#fire-calculator" className="button button-primary">Sign in with Google to start</Link>
      </section>
    ) : !game && userId && state && !state.profile ? (
      <QuickSetup userId={userId} name={firstName} onDone={() => { setLoading(true); setReload(value => value + 1); setCelebrate({ title: "Your journey has begun! 🚀", detail: "Level 1 cleared: you drew your money map. Your first quest and today’s book lesson are waiting." }); }} />
    ) : !game ? (
      <section className="journey-welcome">
        <p className="eyebrow"><MapIcon size={14} /> LEVEL 1 STARTS HERE</p>
        <h1>Draw your money map to unlock the game.</h1>
        <p>{message || "Add your age, income, expenses and savings. It takes about five minutes, and every number unlocks your score, levels, and freedom date."}</p>
        <Link href="/profile" className="button button-primary">Create my profile <ArrowRight size={16} /></Link>
      </section>
    ) : <>
      {state?.warnings.map(warning => <p key={warning} className="account-source-note">{warning}</p>)}
      {message && message !== "signin" && <p className="profile-status" role="status">{message}</p>}

      <div className="journey-greeting"><h1>{greeting()}{firstName ? `, ${firstName}` : ""} 👋</h1><p>{game.current ? <>Today’s focus: <b>{game.current.title}</b></> : "Fat FIRE reached. Keep it that way."}</p></div>

      <QuickLog compact onSaved={() => { setLoading(true); setReload(value => value + 1); }} />

      {(() => {
        const why = state?.why;
        if (!why?.reasons.length) return <a href="/profile?start=why" className="why-card why-empty"><span className="why-emoji">🌅</span><div><p className="eyebrow">NEW · +100 XP</p><h2>Why do you want financial freedom?</h2><p>3 quick questions to find your FIRE style and purpose score.</p></div></a>;
        const result = getWhyResult(why.reasons, why.note, why.dreamAge);
        const style = fireStyles[result.style];
        const yearsLeft = why.dreamAge && game.profile.age ? why.dreamAge - game.profile.age : null;
        const realReturn = (state?.plan.expected_return ?? 10) - (state?.plan.inflation_rate ?? 6);
        const needed = yearsLeft !== null ? sipForYears(Math.max(0, game.profile.investableAssets ?? game.profile.assets), game.metrics.fireTarget, realReturn, yearsLeft) : null;
        const onTrack = game.metrics.fireAge !== null && why.dreamAge !== null && game.metrics.fireAge <= why.dreamAge;
        return <section className="why-card">
          <span className="why-emoji">{style.emoji}</span>
          <div>
            <p className="eyebrow">YOUR WHY · {style.name.toUpperCase()} · PURPOSE {result.purposeScore}/100</p>
            <h2>{why.note ? `“${why.note}”` : result.reasons.map(reason => reason.label).slice(0, 2).join(" · ")}</h2>
            <p>{why.dreamAge ? (onTrack ? `✅ You’re on track to be free by your dream age of ${why.dreamAge}.` : needed !== null ? `🎯 Dream age ${why.dreamAge}: invest about ${money(needed)}/month (now ${money(game.profile.monthly_investment)}) to get there.` : `🎯 Dream age ${why.dreamAge} is a stretch — Lean or Barista FIRE could bring it within reach.`) : styleTip(result.style, game.profile.currency)}</p>
          </div>
          <a href="/profile" className="text-link">Edit</a>
        </section>;
      })()}

      <section className="journey-hero">
        <div className="rank-medal" aria-hidden="true"><Trophy size={30} /><b>{game.rank.rankNumber}</b></div>
        <div className="rank-copy">
          <p className="result-kicker" title="Your player rank grows with XP: check-ins, lessons, streaks, goals and levels.">PLAYER RANK {game.rank.rankNumber} OF {RANKS.length} · EARNED WITH XP</p>
          <h1>{game.rank.name}</h1>
          <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(game.rank.progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${game.rank.progress * 100}%` }} /></div>
          <p className="xp-line"><b>{game.xp.total.toLocaleString("en-IN")} XP</b>{game.rank.next ? <> · {game.rank.xpToNext.toLocaleString("en-IN")} XP to <b>{game.rank.next}</b></> : " · Max rank reached"}</p>
        </div>
        <div className="hero-stats">
          <div><Flame size={18} /><strong>{game.streak}</strong><span>month investing streak</span></div>
          <div><Sparkles size={18} /><strong>{game.score.score}</strong><span>FIRE score /100</span></div>
          <div><Trophy size={18} /><strong>{game.path.filter(level => level.cleared).length}/{PATH_LEVELS}</strong><span>money levels cleared</span></div>
        </div>
      </section>

      {new Date().getDate() <= 7 && state && state.snapshots.length > 0 && <a href="/report" className="report-alert"><span>📬</span><div><strong>Your monthly FIRE report is ready</strong><small>See what changed, how your habits did, and 3 things to focus on next.</small></div><ArrowRight size={18} /></a>}
      {stepUpDue && state && <div className="stepup-alert"><span>📈</span><div><strong>It’s step-up month!</strong><small>Raise your monthly investment from {money(game.profile.monthly_investment)} to {money(stepUpTarget)} (+{state.plan.step_up_percent}%). Then tap Done.</small></div><button type="button" className="button button-primary" onClick={() => void confirmStepUp()}>Done ✓</button></div>}
      {(() => {
        // Quarterly nudge: EPF/NPS/PPF grow every month, so ask for the real passbook balance every 3 months.
        const stale = (state?.accounts ?? []).filter(a => a.kind === "asset" && a.fire_treatment === "later" && (daysSince(a.updated_at) ?? 0) > 90);
        if (!stale.length) return null;
        const months = Math.floor(Math.max(...stale.map(a => daysSince(a.updated_at) ?? 0)) / 30);
        return <a href="/accounts" className="saver-strip tone-warn later-reminder"><span className="saver-strip-emoji">🏛️</span><div><small>QUARTERLY CHECK</small><strong>Update {stale.map(a => a.name).slice(0, 3).join(", ")}{stale.length > 3 ? "…" : ""}</strong><span>Last updated {months} months ago. Salary contributions and interest add up, so check your EPF passbook / NPS statement and enter the new balance.</span></div><ArrowRight size={18} /></a>;
      })()}
      {streakAtRisk && <a href="/month" className="streak-alert"><Flame size={20} /><div><strong>Your {game.streak}-month streak is at risk!</strong><span>Log {monthName} to keep it alive — it takes 30 seconds. +60 XP</span></div><ArrowRight size={18} /></a>}

      {!streakAtRisk && <section className="motivation-banner">
        <h2>{game.motivation.headline}</h2>
        <p>{game.motivation.body}</p>
      </section>}

      {game.rate !== null && (() => {
        const tier = getSavingsTier(game.rate);
        const next = getNextTier(game.rate);
        const needed = next ? cutNeededForRate(totalIncome(game.profile), game.profile.monthly_expenses, next.min) : 0;
        return <a href="/save-more" className={`saver-strip tone-${tier.tone}`}>
          <span className="saver-strip-emoji">{tier.emoji}</span>
          <div><small>SAVER LEVEL · {game.rate.toFixed(0)}% SAVED</small><strong>{tier.name}</strong><span>{next ? (tier.tone === "danger" ? `Find ${money(needed)}/month to reach ${next.emoji} ${next.name}. Tap to hunt spending leaks.` : `Next: ${next.emoji} ${next.name} at ${next.min}% — ${money(needed)}/month away.`) : "Top saver level! Keep it up."}</span></div>
          <ArrowRight size={18} />
        </a>;
      })()}

      <section className="month-checklist">
        <div className="month-checklist-head"><h2>This month’s missions</h2><span>{checklist.filter(item => item.done).length}/{checklist.length} done</span></div>
        <div className="month-checklist-items">{checklist.map(item => <a key={item.label} href={item.href} className={item.done ? "done" : ""}><span className="check-dot">{item.done ? <CheckCircle2 size={18} /> : null}</span><div><strong>{item.label}</strong><small>{item.done ? "Done ✓" : item.reward}</small></div></a>)}</div>
      </section>

      <section className="freedom-metrics">
        <article><span>Freedom you already own</span><strong>{game.metrics.freedomMonths >= 24 ? `${(game.metrics.freedomMonths / 12).toFixed(1)} yrs` : `${game.metrics.freedomMonths.toFixed(1)} months`}</strong><small>{game.metrics.freedomMonths >= 24 ? `${Math.floor(game.metrics.freedomMonths)} months of today’s spending, covered by your FIRE-accessible money` : "Your FIRE-accessible money ÷ monthly expenses"}</small></article>
        <article><span>FIRE progress</span><strong>{game.metrics.fireProgress.toFixed(1)}%</strong><small>of your {money(game.metrics.fireTarget)} FIRE number (today’s money){(() => { const atAge = game.metrics.fireAge ?? state?.plan.retirement_age ?? null; const years = atAge && game.profile.age ? atAge - game.profile.age : 0; return years > 0 ? ` ≈ ${money(inFutureMoney(game.metrics.fireTarget, state?.plan.inflation_rate ?? 6, years))} by age ${atAge}` : ""; })()}{state?.plan.retirement_expenses ? " · based on your retirement spending" : ""}</small><div className="score-track"><span style={{ width: `${game.metrics.fireProgress}%` }} /></div></article>
        <article><span>Estimated freedom</span><strong>{game.metrics.yearsToFire === null ? "60+ yrs" : game.metrics.yearsToFire === 0 ? "Now!" : `${game.metrics.yearsToFire.toFixed(1)} yrs`}</strong><small>{game.metrics.fireAge ? `Around age ${game.metrics.fireAge} at today’s pace` : "Increase monthly investing to set a date"}</small></article>
        <article className="boost"><span>Your power move</span><strong>+{money(game.metrics.boostAmount)}/mo</strong><small>{game.metrics.yearsSavedByBoost !== null && game.metrics.yearsSavedByBoost > 0 ? `could bring freedom ~${game.metrics.yearsSavedByBoost.toFixed(1)} years sooner` : "invested monthly could start your FIRE clock"}</small></article>
      </section>
      <p className="journey-note tm-basis">🎯 Your FIRE number = {money(targetExpenses(game.profile))}/month {state?.plan.retirement_expenses ? "(your planned retirement spending)" : "(your usual spending, from your profile)"} × 12 ÷ {state?.plan.withdrawal_rate}% = <b>{money(game.metrics.fireTarget)}</b> in today’s money. <Link href="/plan">Change it in your FIRE plan</Link> or update your spending in <Link href="/profile">Profile</Link>.</p>
      <p className="journey-note">Estimates use a {state?.plan.expected_return}% return and {state?.plan.inflation_rate}% inflation (real growth {((state?.plan.expected_return ?? 10) - (state?.plan.inflation_rate ?? 6)).toFixed(1)}%) in today’s money. Change them in your <Link href="/plan">FIRE plan</Link>. Illustrative only — not a guarantee or investment advice.</p>

      {state && <ProgressHistory snapshots={state.snapshots} />}
      {state && state.checkins.length >= 2 && <a href="/trends" className="saver-strip tone-ok trends-link"><span className="saver-strip-emoji">📊</span><div><small>MONEY TRENDS</small><strong>See where your money went, month after month</strong><span>Savings rate, spending vs investing, and your best months.</span></div></a>}

      {state && <StepUpPlan userId={state.userId} age={game.profile.age} accessible={Math.max(0, game.profile.investableAssets ?? game.profile.assets)} monthlyInvestment={game.profile.monthly_investment} target={game.metrics.fireTarget} plan={state.plan} money={money} onSaved={(percent, month) => setState(current => current ? { ...current, plan: { ...current.plan, step_up_percent: percent, step_up_month: month } } : current)} />}

      <FireSlider age={game.profile.age} accessible={Math.max(0, game.profile.investableAssets ?? game.profile.assets)} monthlyInvestment={game.profile.monthly_investment} target={game.metrics.fireTarget} realReturn={(state?.plan.expected_return ?? 10) - (state?.plan.inflation_rate ?? 6)} currency={game.profile.currency} />

      <section className="journey-grid">
        <div>
          {game.current ? <article className="quest-card">
            <p className="eyebrow"><Target size={14} /> YOUR CURRENT QUEST · LEVEL {game.current.level}</p>
            <h2>{game.current.title}</h2>
            <p>{game.current.why}</p>
            <div className="score-track"><span style={{ width: `${game.current.progress * 100}%` }} /></div>
            <small className="quest-progress">{game.current.progressLabel}</small>
            <div className="quest-do"><strong>How to clear it</strong><span>{game.current.howToClear}</span></div>
            <Link href={game.current.href} className="button button-primary">Take action <ArrowRight size={16} /></Link>
            <small className="quest-reward">Reward: +250 XP · Inspired by {game.current.book}</small>
          </article> : <article className="quest-card done"><h2>🥂 All {PATH_LEVELS} levels cleared: Fat FIRE!</h2><p>You’ve reached financial independence with room to spare. Keep checking in yearly to stay there.</p></article>}

          <section className="path-section">
            <div className="section-heading"><p className="eyebrow"><MapIcon size={14} /> THE FREEDOM PATH</p><h2>{PATH_LEVELS} levels to financial independence and beyond.</h2><p>Money milestones, cleared by your real finances. Follow them in order: each one makes the next one safer. (Your player rank is separate: it grows with XP from your habits.)</p></div>
            <ol className="path-list">{game.path.map(level => {
              const isCurrent = game.current?.id === level.id;
              return <li key={level.id} className={`path-level${level.cleared ? " cleared" : ""}${isCurrent ? " current" : ""}`}>
                <span className="path-node">{level.cleared ? <CheckCircle2 size={18} /> : isCurrent ? level.level : <Lock size={14} />}</span>
                <div>
                  <strong>Level {level.level} · {level.title}</strong>
                  <small>{level.progressLabel}</small>
                  {!level.cleared && <div className="score-track"><span style={{ width: `${level.progress * 100}%` }} /></div>}
                </div>
                <Link href={level.href} className="text-link">{level.cleared ? "Review" : "Go"} →</Link>
              </li>;
            })}</ol>
          </section>
        </div>

        <div>
          <span id="lesson" className="anchor" />
          <DailyLesson key={todaysLesson.id} lesson={todaysLesson} completed={completedIds.includes(todaysLesson.id)} onAnswer={answerLesson} onNext={() => setLessonOffset(offset => offset + 1)} />
          <p className="lesson-count">{completedIds.length} of {allLessons.length} lessons completed · <Link href="/learn">See all principles</Link></p>

          <ShareMilestone milestones={getMilestones({ fireProgress: game.metrics.fireProgress, rankName: game.rank.name, rankNumber: game.rank.rankNumber, streak: game.streak, levelsCleared: game.path.filter(level => level.cleared).length, freedomMonths: game.metrics.freedomMonths, lessons: state?.lessons.length ?? 0, progressGain: state ? getProgressSummary(state.snapshots).progressGain : 0 })} />

          <a href="/feedback" className="side-card feedback-teaser"><span>💡</span><div><strong>Got an idea for FIREpath?</strong><small>Tell us — earn points you can use to pay for Pro.</small></div></a>

          <section className="side-card">
            <div className="side-card-head"><h3><Target size={16} /> Your goals</h3><Link href="/goals" className="text-link">Manage →</Link></div>
            {game.analyses.length ? game.analyses.filter(item => !item.goal.completed_at).slice(0, 4).map(({ goal, analysis }) => <div className="mini-goal" key={goal.id}>
              <div><span>{goalCategories.find(category => category.id === goal.category)?.emoji} {goal.name}</span><em className={`goal-status ${analysis.status}`}>{statusLabel[analysis.status]}</em></div>
              <div className="score-track"><span style={{ width: `${analysis.progress}%` }} /></div>
              <small>{money(goal.saved_amount)} of {money(analysis.futureTarget)} · {analysis.monthsLeft} months left</small>
            </div>) : <p className="side-empty">Home, wedding, education, travel — set a goal and earn +50 XP.</p>}
            {game.analyses.length > 0 && game.analyses.every(item => item.goal.completed_at) && <p className="side-empty">All goals achieved! Set your next one.</p>}
          </section>

          <section className="side-card">
            <div className="side-card-head"><h3><Wallet size={16} /> Portfolio mix</h3><Link href="/accounts" className="text-link">Update →</Link></div>
            {game.mix.length ? <>
              <div className="mix-bar">{game.mix.map((item, index) => <span key={item.label} className={`mix-${index % 8}`} style={{ width: `${item.share * 100}%` }} title={`${item.label}: ${(item.share * 100).toFixed(0)}%`} />)}</div>
              <ul className="mix-list">{game.mix.map((item, index) => <li key={item.label}><i className={`mix-${index % 8}`} />{item.label}<b>{(item.share * 100).toFixed(0)}%</b><span>{money(item.value)}</span></li>)}</ul>
            </> : <p className="side-empty">Add your mutual funds, stocks, FDs, PPF, EPF and gold to see your mix.</p>}
          </section>

          <section className="side-card">
            <div className="side-card-head"><h3><Sparkles size={16} /> How you earned XP</h3></div>
            <ul className="xp-list">{game.xp.breakdown.map(item => <li key={item.label}><span>{item.label}</span><b>{item.xp.toLocaleString("en-IN")}</b></li>)}</ul>
            <p className="side-empty">Fastest XP: monthly check-ins (+60), lessons (+50), clearing levels (+250), achieving goals (+400).</p>
          </section>

          <section className="side-card">
            <div className="side-card-head"><h3><Trophy size={16} /> Badges</h3><Link href="/dashboard" className="text-link">All →</Link></div>
            <div className="mini-badges">{game.badges.map(badge => <span key={badge.name} className={badge.earned ? "earned" : ""} title={badge.description}>{badge.earned ? "🏅" : "🔒"} {badge.name}</span>)}</div>
          </section>
        </div>
      </section>
    </>}
  </main><Footer /></>;
}
