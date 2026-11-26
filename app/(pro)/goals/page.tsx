"use client";

import { FormEvent, InputHTMLAttributes, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Target, Trash2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Celebration from "@/components/game/Celebration";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, loadFinancialState, type AccountRow } from "@/lib/financialState";
import { analyzeGoal, applyLinkedSavings, goalCategories, monthsBetween, sideGoalCategories, statusLabel, type Goal, type GoalCategory } from "@/lib/goals";
import { getFreedomMetrics, type FreedomMetrics } from "@/lib/freedomPath";
import StepFlow, { MoneyInput, type Step } from "@/components/forms/StepFlow";

type Draft = { name: string; category: GoalCategory; target_amount: string; target_date: string; saved_amount: string; monthly_contribution: string; expected_return: string; inflation_rate: string };

const yearsFromNow = (years: number) => { const date = new Date(); date.setFullYear(date.getFullYear() + years); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`; };
const emptyDraft = (): Draft => ({ name: "", category: "home", target_amount: "", target_date: yearsFromNow(5), saved_amount: "0", monthly_contribution: "0", expected_return: "10", inflation_rate: "0" });

// Common Indian goals with illustrative future-cost amounts (what you will need on the date); users should edit them.
// UAE expats: typical side goals, amounts in AED (illustrative — users should edit them).
const uaePresets: { label: string; draft: Partial<Draft> }[] = [
  { label: "✈️ Move back home fund", draft: { name: "Move back home fund", category: "other", target_amount: "150000", target_date: yearsFromNow(5), expected_return: "6" } },
  { label: "🏫 Kids’ school fees", draft: { name: "Kids’ school fees (UAE)", category: "education", target_amount: "180000", target_date: yearsFromNow(3), expected_return: "5" } },
  { label: "🎓 Kids’ university abroad", draft: { name: "Kids’ university abroad", category: "education", target_amount: "600000", target_date: yearsFromNow(12), expected_return: "7" } },
  { label: "🏠 Buy property in UAE", draft: { name: "Property down payment (UAE)", category: "home", target_amount: "400000", target_date: yearsFromNow(5), expected_return: "6" } },
  { label: "🏗️ Build a house back home", draft: { name: "Build our house back home", category: "home", target_amount: "250000", target_date: yearsFromNow(6), expected_return: "6" } },
  { label: "🛫 Annual trip home", draft: { name: "Annual family trip home", category: "travel", target_amount: "20000", target_date: yearsFromNow(1), expected_return: "4" } },
  { label: "💍 Kids’ marriage", draft: { name: "Kids’ marriage", category: "wedding", target_amount: "200000", target_date: yearsFromNow(20), expected_return: "7" } },
  { label: "🛟 Emergency fund", draft: { name: "6-month emergency fund", category: "emergency", target_amount: "60000", target_date: yearsFromNow(1), expected_return: "4" } },
];

const presets: { label: string; draft: Partial<Draft> }[] = [
  { label: "🏠 Buy a home", draft: { name: "Home down payment", category: "home", target_amount: "2000000", target_date: yearsFromNow(5), expected_return: "9" } },
  { label: "🏗️ Build a house", draft: { name: "Build our house", category: "home", target_amount: "4000000", target_date: yearsFromNow(6), expected_return: "9" } },
  { label: "🏫 Kids’ school fees", draft: { name: "Kids’ school fees", category: "education", target_amount: "1500000", target_date: yearsFromNow(5), expected_return: "8" } },
  { label: "🎓 Kids’ higher education", draft: { name: "Kids’ college / higher studies", category: "education", target_amount: "9000000", target_date: yearsFromNow(15), expected_return: "11" } },
  { label: "💍 Kids’ marriage", draft: { name: "Kids’ marriage", category: "wedding", target_amount: "3000000", target_date: yearsFromNow(20), expected_return: "11" } },
  { label: "✈️ Family trip", draft: { name: "Family trip", category: "travel", target_amount: "350000", target_date: yearsFromNow(2), expected_return: "7" } },
  { label: "🚗 Car", draft: { name: "Car (cash, no loan)", category: "vehicle", target_amount: "1000000", target_date: yearsFromNow(4), expected_return: "8" } },
  { label: "🛟 Emergency fund", draft: { name: "6-month emergency fund", category: "emergency", target_amount: "300000", target_date: yearsFromNow(1), expected_return: "6" } },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currency, setCurrency] = useState<"INR" | "AED" | "USD">("INR");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [topUp, setTopUp] = useState<Record<string, string>>({});
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const [wizard, setWizard] = useState<{ startAt: number } | null>(null);
  const [linked, setLinked] = useState({ emergencyFund: 0, monthlyExpenses: 0, monthlyInvestment: 0 });
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fire, setFire] = useState<{ metrics: FreedomMetrics; portfolio: number; dreamAge: number | null } | null>(null);
  const [linkIds, setLinkIds] = useState<string[]>([]); // portfolio items to set aside for the goal being created
  // FIRE-portfolio items that could be set aside for a goal (usable now and not already linked).
  const linkable = useMemo(() => accounts.filter(account => account.kind === "asset" && account.fire_treatment === "available" && !account.goal_id && account.current_value > 0), [accounts]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        if (active) setUserId(session.user.id);
        // Same data as Home, so FIRE progress, portfolio links and goals always agree.
        const loaded = await loadFinancialState(supabase, session.user.id);
        if (!active) return;
        setGoals(loaded.rawGoals);
        setAccounts(loaded.accounts);
        setWarnings(loaded.warnings);
        if (loaded.scoreProfile) {
          const p = loaded.scoreProfile;
          setLinked({ emergencyFund: p.emergency_fund, monthlyExpenses: p.monthly_expenses, monthlyInvestment: p.monthly_investment });
          setCurrency(p.currency);
          setFire({ metrics: getFreedomMetrics(p, { retirementAge: loaded.plan.retirement_age, expectedReturn: loaded.plan.expected_return, inflation: loaded.plan.inflation_rate }), portfolio: Math.max(0, p.investableAssets ?? p.assets), dreamAge: loaded.why.dreamAge });
        }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Could not load goals."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const money = (value: number) => formatMoney(value, currency);
  // Goals linked to portfolio items take their "saved" amount from those items automatically.
  const analyzed = useMemo(() => applyLinkedSavings(goals, accounts).map(goal => ({ goal, analysis: analyzeGoal(goal) })), [goals, accounts]);
  const active = analyzed.filter(item => !item.goal.completed_at);
  const done = analyzed.filter(item => item.goal.completed_at);
  const totals = useMemo(() => ({
    monthlyNow: active.reduce((sum, item) => sum + item.goal.monthly_contribution, 0),
    monthlyNeeded: active.reduce((sum, item) => sum + item.analysis.requiredMonthly, 0),
    onTrack: active.filter(item => item.analysis.status === "on-track" || item.analysis.status === "ahead" || item.analysis.status === "achieved").length,
  }), [active]);

  const preview = useMemo(() => {
    if (!draft.target_amount || !draft.target_date) return null;
    return analyzeGoal({ id: "preview", name: draft.name, category: draft.category, target_amount: Number(draft.target_amount), target_date: draft.target_date, saved_amount: Number(draft.saved_amount || 0), monthly_contribution: Number(draft.monthly_contribution || 0), expected_return: Number(draft.expected_return || 0), inflation_rate: Number(draft.inflation_rate || 0), completed_at: null });
  }, [draft]);

  function openForm(goal?: Goal, preset?: Partial<Draft>) {
    setEditingId(goal?.id ?? null);
    setMessage("");
    if (goal) {
      goal = goals.find(item => item.id === goal!.id) ?? goal; // edit the stored goal, not the linked-savings view
      setDraft({ name: goal.name, category: goal.category, target_amount: String(goal.target_amount), target_date: goal.target_date, saved_amount: String(goal.saved_amount), monthly_contribution: String(goal.monthly_contribution), expected_return: String(goal.expected_return), inflation_rate: String(goal.inflation_rate) });
      setShowForm(true);
      return;
    }
    setLinkIds([]);
    setDraft({ ...emptyDraft(), ...preset, ...linkedDefaults(preset?.category) });
    setWizard({ startAt: preset ? 1 : 0 });
  }

  // Reuse what the profile already knows instead of asking again.
  function linkedDefaults(category?: GoalCategory): Partial<Draft> {
    if (category === "emergency" && linked.monthlyExpenses > 0) return { target_amount: String(Math.round(linked.monthlyExpenses * 6)), saved_amount: String(linked.emergencyFund) };
    return {};
  }

  async function saveGoal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const supabase = createClient();
    if (!supabase || !userId) return;
    setSaving(true); setMessage("");
    const row = { user_id: userId, name: draft.name.trim(), category: draft.category, target_amount: Number(draft.target_amount), target_date: draft.target_date, saved_amount: !editingId && linkIds.length ? 0 : Number(draft.saved_amount || 0), monthly_contribution: Number(draft.monthly_contribution || 0), expected_return: Number(draft.expected_return || 0), inflation_rate: 0, updated_at: new Date().toISOString() };
    try {
      const query = editingId ? supabase.from("financial_goals").update(row).eq("id", editingId).eq("user_id", userId) : supabase.from("financial_goals").insert(row);
      const { data, error } = await query.select("id, name, category, target_amount, target_date, saved_amount, monthly_contribution, expected_return, inflation_rate, completed_at").single();
      if (error) throw error;
      const saved: Goal = { ...data, target_amount: Number(data.target_amount), saved_amount: Number(data.saved_amount), monthly_contribution: Number(data.monthly_contribution), expected_return: Number(data.expected_return), inflation_rate: Number(data.inflation_rate) };
      setGoals(current => editingId ? current.map(goal => goal.id === editingId ? saved : goal) : [...current, saved].sort((a, b) => a.target_date.localeCompare(b.target_date)));
      // Set aside the chosen portfolio items for this new goal (they leave the FIRE portfolio).
      if (!editingId && linkIds.length) {
        const { error: linkError } = await supabase.from("financial_accounts").update({ goal_id: saved.id, updated_at: new Date().toISOString() }).in("id", linkIds).eq("user_id", userId);
        if (linkError) setMessage(`Goal created, but linking portfolio items failed: ${linkError.message}`);
        else setAccounts(current => current.map(account => linkIds.includes(account.id) ? { ...account, goal_id: saved.id } : account));
        setLinkIds([]);
      }
      setShowForm(false);
      setWizard(null);
      if (editingId) setMessage("Goal updated.");
      else setCelebrate({ title: `New goal: ${saved.name} 🎯`, detail: "+50 XP. A goal with a date and a monthly amount is a plan — not a wish." });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the goal."); }
    finally { setSaving(false); }
  }

  async function updateGoal(goal: Goal, changes: Partial<Goal>) {
    const supabase = createClient();
    if (!supabase || !userId) return;
    const { error } = await supabase.from("financial_goals").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", goal.id).eq("user_id", userId);
    if (error) { setMessage(error.message); return; }
    const updated = { ...goal, ...changes };
    setGoals(current => current.map(item => item.id === goal.id ? updated : item));
    if (changes.completed_at) setCelebrate({ title: `Goal achieved: ${goal.name}!`, detail: "+400 XP. You set a target and you hit it — that’s exactly the habit that builds financial freedom." });
    else if (analyzeGoal(updated).status === "achieved" && !goal.completed_at) setMessage(`You’ve saved enough for “${goal.name}”. Mark it achieved to collect +400 XP!`);
  }

  async function addMoney(goal: Goal) {
    const amount = Number(topUp[goal.id] || 0);
    if (amount <= 0) return;
    await updateGoal(goal, { saved_amount: goal.saved_amount + amount });
    setTopUp(current => ({ ...current, [goal.id]: "" }));
  }

  async function deleteGoal(goal: Goal) {
    const supabase = createClient();
    if (!supabase || !userId) return;
    const { error } = await supabase.from("financial_goals").delete().eq("id", goal.id).eq("user_id", userId);
    if (error) { setMessage(error.message); return; }
    setGoals(current => current.filter(item => item.id !== goal.id));
  }

  const setD = (key: keyof Draft) => (value: string) => setDraft(current => ({ ...current, [key]: value }));
  const horizonReturn = (date: string) => { const years = monthsBetween(new Date(), date) / 12; return currency === "AED" ? (years < 3 ? "4" : years < 7 ? "6" : "7") : (years < 3 ? "7" : years < 7 ? "9" : "11"); };
  const pickDate = (date: string) => setDraft(current => ({ ...current, target_date: date, expected_return: horizonReturn(date) }));
  const yearsChip = (years: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + years); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
  const wizardSteps: Step[] = [
    { id: "what", emoji: "🎯", title: "What are you saving for?", subtitle: "Pick one — you can rename it next.",
      body: <div className="qn-tiles">{sideGoalCategories.map(category => <button type="button" key={category.id} className={`qn-tile${draft.category === category.id ? " selected" : ""}`} onClick={() => setDraft(current => ({ ...current, category: category.id, name: current.name && current.category === category.id ? current.name : category.label, ...linkedDefaults(category.id) }))}><span>{category.emoji}</span>{category.label}</button>)}</div> },
    { id: "amount", emoji: goalCategories.find(c => c.id === draft.category)?.emoji ?? "⭐", title: "How much will you need?", subtitle: "The amount on the day you need it — the future price, not today’s.", valid: Number(draft.target_amount) > 0 && draft.name.trim() !== "",
      body: <><label className="profile-field qn-name"><span>Goal name</span><input value={draft.name} maxLength={80} onChange={event => setD("name")(event.target.value)} /></label><MoneyInput value={draft.target_amount} onChange={setD("target_amount")} /></>,
      feedback: draft.category === "emergency" && linked.monthlyExpenses ? `Pre-filled as 6 months of your spending (${money(linked.monthlyExpenses)}/month, from your profile).` : null },
    { id: "when", emoji: "📅", title: "When do you need it?", valid: monthsBetween(new Date(), draft.target_date) > 0,
      body: <><div className="qn-chips">{[1, 2, 3, 5, 10, 15].map(years => <button type="button" key={years} className={draft.target_date === yearsChip(years) ? "selected" : ""} onClick={() => pickDate(yearsChip(years))}>In {years} year{years > 1 ? "s" : ""}</button>)}</div><label className="profile-field qn-date"><span>Or pick a date</span><input type="date" value={draft.target_date} onChange={event => pickDate(event.target.value)} /></label></>,
      feedback: `${monthsBetween(new Date(), draft.target_date)} months away · we’ll assume about ${draft.expected_return}% yearly growth for this horizon (change it later in Edit).` },
    { id: "saved", emoji: "🐷", title: "Have you saved anything for it already?",
      subtitle: linkable.length ? "If that money is already in your portfolio, just tap it — no need to type it again." : undefined,
      body: <>
        {linkable.length > 0 && <div className="qn-chips link-chips">{linkable.map(account => { const on = linkIds.includes(account.id); return <button type="button" key={account.id} className={on ? "selected" : ""} onClick={() => { const ids = on ? linkIds.filter(id => id !== account.id) : [...linkIds, account.id]; setLinkIds(ids); setDraft(current => ({ ...current, saved_amount: String(linkable.filter(item => ids.includes(item.id)).reduce((sum, item) => sum + item.current_value, 0)) })); }}>{on ? "✓ " : "🔗 "}{account.name} · {money(account.current_value)}</button>; })}</div>}
        {linkIds.length === 0 && <MoneyInput value={draft.saved_amount} onChange={setD("saved_amount")} chips={[{ label: "Not yet", value: 0 }]} />}
      </>,
      feedback: linkIds.length ? `${money(Number(draft.saved_amount))} from your portfolio will count toward this goal and move out of your FIRE portfolio — so it’s never counted twice.` : draft.category === "emergency" && linked.emergencyFund ? `Pre-filled from your profile’s emergency fund (${money(linked.emergencyFund)}).` : null },
    { id: "monthly", emoji: "📈", title: "How much can you put in each month?",
      body: <MoneyInput value={draft.monthly_contribution} onChange={setD("monthly_contribution")} chips={preview && preview.requiredMonthly > 0 ? [{ label: `Exactly what’s needed: ${money(Math.ceil(preview.requiredMonthly / 100) * 100)}`, value: Math.ceil(preview.requiredMonthly / 100) * 100 }] : undefined} />,
      feedback: preview ? (preview.status === "achieved" ? "You already have enough — nice! 🎉" : `To reach ${money(preview.futureTarget)} you need about ${money(preview.requiredMonthly)}/month. ${preview.status === "on-track" || preview.status === "ahead" ? "✅ You’re on track!" : ""}`) : null },
  ];
  const freeForFire = linked.monthlyInvestment - totals.monthlyNow;

  const field = (key: keyof Draft, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => <label className="profile-field"><span>{label}</span><input value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} {...props} /></label>;

  return <><Header /><main className="goals-page container">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    <div className="profile-heading"><p className="eyebrow"><Target size={14} /> YOUR GOALS</p><h1>Freedom first. Dreams along the way.</h1><p>Financial freedom is your main goal. Your house, your kids and your trips are side goals — each with its own money, so nothing is counted twice.</p></div>
    {loading ? <p className="profile-status">Loading your goals…</p> : !userId ? <section className="profile-card"><p>Sign in with Google to track your goals.</p><Link href="/#fire-calculator" className="button button-primary">Return home to sign in</Link></section> : <>
      {warnings.map(warning => <p key={warning} className="account-source-note">{warning}</p>)}
      {message && <p className="profile-status goals-status" role="status">{message}</p>}

      {fire && <section className="fire-main-goal">
        <div className="fire-main-top"><span className="fire-main-badge">🔥 MAIN GOAL</span><Link href="/plan" className="text-link">Adjust plan →</Link></div>
        <h2>Financial freedom</h2>
        <p className="fire-main-sub">{fire.metrics.yearsToFire === 0 ? "You’ve reached your FIRE number! 🎉" : fire.metrics.fireAge ? `On track to be free around age ${fire.metrics.fireAge}${fire.dreamAge ? ` · your dream age is ${fire.dreamAge}` : ""}.` : "Invest a little every month to set your freedom date."}</p>
        <div className="goal-progress"><div className="score-track"><span style={{ width: `${Math.min(100, fire.metrics.fireProgress)}%` }} /></div><b>{fire.metrics.fireProgress.toFixed(1)}%</b></div>
        <div className="goal-numbers">
          <div><span>🔥 FIRE portfolio</span><strong>{money(fire.portfolio)}</strong></div>
          <div><span>FIRE number</span><strong>{money(fire.metrics.fireTarget)}</strong></div>
          <div><span>Months of freedom</span><strong>{fire.metrics.freedomMonths.toFixed(1)}</strong></div>
          <div><span>Left for FIRE monthly</span><strong className={freeForFire < 0 ? "warn" : ""}>{money(Math.max(0, freeForFire))}</strong></div>
        </div>
      </section>}

      <h2 className="side-goals-title">Side goals</h2>
      <section className="goals-summary">
        <div><span>Active goals</span><strong>{active.length}</strong></div>
        <div><span>On track</span><strong>{totals.onTrack}/{active.length || 0}</strong></div>
        <div><span>You invest monthly</span><strong>{money(totals.monthlyNow)}</strong></div>
        <div><span>Needed monthly</span><strong className={totals.monthlyNeeded > totals.monthlyNow ? "warn" : ""}>{money(totals.monthlyNeeded)}</strong></div>
      </section>

      {linked.monthlyInvestment > 0 && active.length > 0 && <p className="account-source-note goals-link">🔗 You invest {money(linked.monthlyInvestment)}/month (from your profile). {freeForFire >= 0 ? <>{money(totals.monthlyNow)} goes to these goals, leaving <b>{money(freeForFire)}/month for FIRE</b>.</> : <>Your goals need {money(-freeForFire)}/month more than you currently invest — raise your SIP or adjust a goal.</>}</p>}

      {wizard && <div className="goal-wizard"><StepFlow steps={wizardSteps} startAt={wizard.startAt} finishLabel="Create goal (+50 XP)" onFinish={() => void saveGoal()} saving={saving} footer={<button type="button" className="qn-cancel" onClick={() => setWizard(null)}>Cancel</button>} /></div>}

      {!showForm && !wizard && <section className="goal-presets"><strong>Quick start:</strong>{(currency === "AED" ? uaePresets : presets).map(preset => <button key={preset.label} type="button" className="preset-chip" onClick={() => openForm(undefined, preset.draft)}>{preset.label}</button>)}<button type="button" className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Custom goal</button></section>}

      {showForm && <form className="profile-card goal-form" onSubmit={saveGoal}>
        <h2>{editingId ? "Edit goal" : "New goal"}</h2>
        {field("name", "Goal name", { required: true, maxLength: 80 })}
        <label className="profile-field"><span>Type</span><select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value as GoalCategory }))}>{goalCategories.filter(category => category.id !== "retirement" || category.id === draft.category).map(category => <option key={category.id} value={category.id}>{category.emoji} {category.label}</option>)}</select></label>
        {field("target_amount", `Amount needed on target date (${currency})`, { type: "number", min: "1", step: "any", required: true })}
        {field("target_date", "Target date", { type: "date", required: true })}
        {field("saved_amount", `Already saved (${currency})`, { type: "number", min: "0", step: "any" })}
        {field("monthly_contribution", `Monthly investment towards it (${currency})`, { type: "number", min: "0", step: "any" })}
        {field("expected_return", "Expected annual return (%)", { type: "number", min: "0", max: "30", step: "any" })}
        {preview && <div className="goal-preview">
          <span>Target: <b>{money(preview.futureTarget)}</b> in {preview.monthsLeft} months</span>
          <span>Invest <b>{money(preview.requiredMonthly)}</b>/month to get there</span>
          <span>Status: <b>{statusLabel[preview.status]}</b></span>
        </div>}
        <p className="profile-privacy">Enter the amount you will actually need on the target date (the future price). Education costs in India have historically risen faster than general inflation; shorter goals (under 3 years) are usually kept in lower-risk options. Returns are illustrative, not guaranteed.</p>
        <div className="goal-form-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create goal (+50 XP)"}</button><button type="button" className="text-link" onClick={() => setShowForm(false)}>Cancel</button></div>
      </form>}

      <section className="goal-list">{active.length === 0 && !showForm ? <div className="profile-card"><p>No active goals yet. Pick a quick-start goal above — it takes 30 seconds.</p></div> : active.map(({ goal, analysis }) => {
        const category = goalCategories.find(item => item.id === goal.category);
        return <article className="goal-card" key={goal.id}>
          <header><span className="goal-emoji">{category?.emoji}</span><div><h3>{goal.name}</h3><small>{category?.label} · by {new Date(`${goal.target_date}T12:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} · {analysis.monthsLeft} months left</small></div><em className={`goal-status ${analysis.status}`}>{statusLabel[analysis.status]}</em></header>
          <div className="goal-progress"><div className="score-track"><span style={{ width: `${analysis.progress}%` }} /></div><b>{analysis.progress.toFixed(0)}%</b></div>
          <div className="goal-numbers">
            <div><span>Saved</span><strong>{money(goal.saved_amount)}</strong>{goal.linkedCount > 0 && <small>🔗 {goal.linkedCount} portfolio item{goal.linkedCount > 1 ? "s" : ""}</small>}</div>
            <div><span>Target</span><strong>{money(analysis.futureTarget)}</strong></div>
            <div><span>You invest</span><strong>{money(goal.monthly_contribution)}/mo</strong></div>
            <div><span>Needed</span><strong>{money(analysis.requiredMonthly)}/mo</strong></div>
          </div>
          {analysis.status === "behind" && <p className="goal-tip">💡 Add about {money(Math.max(0, analysis.requiredMonthly - goal.monthly_contribution))}/month, push the date out, or reduce the target to get back on track.</p>}
          <div className="goal-actions">
            {goal.linkedCount > 0
              ? <Link href="/accounts" className="goal-linked-note">Savings update automatically from your portfolio →</Link>
              : <><input type="number" min="0" step="any" placeholder={`Add money (${currency})`} value={topUp[goal.id] ?? ""} onChange={event => setTopUp(current => ({ ...current, [goal.id]: event.target.value }))} aria-label={`Add money to ${goal.name}`} />
                <button type="button" className="button button-primary" onClick={() => void addMoney(goal)}>Add</button></>}
            <button type="button" className="text-link" onClick={() => openForm(goal)}>Edit</button>
            {analysis.status === "achieved" ? <button type="button" className="button button-primary" onClick={() => void updateGoal(goal, { completed_at: new Date().toISOString() })}><CheckCircle2 size={16} /> Mark achieved</button> : null}
            <button type="button" className="icon-button" onClick={() => void deleteGoal(goal)} aria-label={`Delete ${goal.name}`}><Trash2 size={16} /></button>
          </div>
        </article>;
      })}</section>

      {done.length > 0 && <section className="goal-done"><h2>🏆 Achieved</h2>{done.map(({ goal }) => <div key={goal.id} className="goal-done-row"><span>{goalCategories.find(item => item.id === goal.category)?.emoji} {goal.name}</span><b>{money(goal.saved_amount)}</b><button type="button" className="icon-button" onClick={() => void deleteGoal(goal)} aria-label={`Delete ${goal.name}`}><Trash2 size={14} /></button></div>)}</section>}
    </>}
  </main><Footer /></>;
}
