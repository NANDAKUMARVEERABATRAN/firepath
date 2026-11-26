"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Scissors, Sparkles, Trophy } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Celebration from "@/components/game/Celebration";
import { createClient } from "@/lib/supabase/client";
import { loadFinancialState, type CutPlan, type FinancialState } from "@/lib/financialState";
import { targetExpenses, totalIncome } from "@/lib/fireScore";
import { countryFromCurrency, formatCountryMoney } from "@/lib/country";
import { cutImpact, cutNeededForRate, findOverspending, getLeaks, getNextTier, getSavingsTier, idleMoney, savingsRate, savingsRateTable, SAVINGS_TIERS } from "@/lib/savingsCoach";

const XP_PER_LEAK = 40;
const categoryLabels: Record<string, string> = { dining: "Dining out & delivery", personal: "Personal & shopping", other: "Other spending", transport: "Transport" };
const monthStart = (offset = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d.toLocaleDateString("en-CA").slice(0, 7) + "-01"; };
const round = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

export default function SaveMorePage() {
  const [state, setState] = useState<FinancialState | null>(null);
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [updateNumbers, setUpdateNumbers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popped, setPopped] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setMessage("Sign in to find money for your freedom."); return; }
        const [loaded, tx] = await Promise.all([
          loadFinancialState(supabase, session.user.id),
          supabase.from("budget_transactions").select("month_start, category, amount").eq("user_id", session.user.id).gte("month_start", monthStart(-1)),
        ]);
        setState(loaded);
        // Use whichever of this month / last month has more recorded spending.
        const byMonth: Record<string, Record<string, number>> = {};
        for (const row of tx.data ?? []) {
          byMonth[row.month_start] ??= {};
          byMonth[row.month_start][row.category] = (byMonth[row.month_start][row.category] ?? 0) + Number(row.amount);
        }
        const total = (m?: Record<string, number>) => Object.values(m ?? {}).reduce((a, b) => a + b, 0);
        setSpent(total(byMonth[monthStart()]) >= total(byMonth[monthStart(-1)]) ? byMonth[monthStart()] ?? {} : byMonth[monthStart(-1)] ?? {});
        if (loaded.cutPlan) setPicked(Object.fromEntries(Object.entries(loaded.cutPlan.items).map(([id, amount]) => [id, String(amount)])));
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load your numbers."); }
      finally { setLoading(false); }
    })();
  }, [reload]);

  const code = countryFromCurrency(state?.profile?.currency);
  const money = (value: number) => formatCountryMoney(Math.round(value), code);
  const leaks = useMemo(() => getLeaks(code), [code]);

  const numbers = useMemo(() => {
    const flow = state?.scoreProfile;
    const base = state?.profile;
    if (!flow || !base || !state) return null;
    // Take-home already includes investment payouts; EPF/NPS deducted from salary are added on top.
    const income = totalIncome(flow);
    const fromSalary = Math.max(0, flow.monthly_salary_savings ?? 0);
    const expenses = flow.monthly_expenses;
    const invested = flow.monthly_investment; // invested from the bank (FIRE-accessible)
    const rate = savingsRate(income, expenses);
    const realReturn = state.plan.expected_return - state.plan.inflation_rate;
    const withdrawal = state.plan.withdrawal_rate;
    const accessible = Math.max(0, base.investableAssets ?? base.assets);
    // Idle money is measured in the bank: take-home minus spending minus bank investments.
    const targetMonthly = flow.retirement_expenses ? targetExpenses(flow) : undefined; // planned retirement spending, if set
    return { income, fromSalary, targetMonthly, expenses, invested, rate, realReturn, withdrawal, accessible, idle: idleMoney(flow.monthly_income, expenses, invested) };
  }, [state]);

  const pickedTotal = Object.values(picked).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const pickedCount = Object.values(picked).filter(value => Number(value) > 0).length;
  const committed = state?.cutPlan ?? null;
  const changed = JSON.stringify(Object.fromEntries(Object.entries(picked).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]))) !== JSON.stringify(committed?.items ?? {});

  function toggle(id: string, typical: number) {
    setPicked(current => {
      const next = { ...current };
      if (next[id] !== undefined) delete next[id];
      else { next[id] = String(typical); setPopped(id); window.setTimeout(() => setPopped(null), 900); }
      return next;
    });
  }

  async function lockIn() {
    const supabase = createClient();
    if (!supabase || !state?.profile || !numbers) return;
    setSaving(true); setMessage("");
    const items = Object.fromEntries(Object.entries(picked).map(([k, v]) => [k, Math.round(Number(v))]).filter(([, v]) => (v as number) > 0));
    const previousTotal = committed?.monthly_total ?? 0;
    const diff = pickedTotal - previousTotal;
    const plan: CutPlan = { items, monthly_total: pickedTotal, baseline_expenses: committed?.baseline_expenses || numbers.expenses, committed_at: committed?.committed_at ?? new Date().toISOString(), applied: updateNumbers || Boolean(committed?.applied) };
    const patch: Record<string, unknown> = { cut_plan: Object.keys(items).length ? plan : null, updated_at: new Date().toISOString() };
    if (updateNumbers && diff !== 0) {
      patch.monthly_expenses = Math.max(0, Math.round(state.profile.monthly_expenses - diff));
      patch.monthly_investment = Math.max(0, Math.round(state.profile.monthly_investment + diff));
    }
    const { error } = await supabase.from("financial_profiles").update(patch).eq("user_id", state.userId);
    setSaving(false);
    if (error) { setMessage(error.message.includes("cut_plan") ? "Run supabase/migrations/202611260024_savings_pledge.sql in Supabase first." : error.message); return; }
    const impact = cutImpact({ accessible: numbers.accessible, monthlyInvestment: numbers.invested, monthlyExpenses: numbers.expenses, monthlyCut: pickedTotal, realReturnPercent: numbers.realReturn, withdrawalRatePercent: numbers.withdrawal, targetMonthlyExpenses: numbers.targetMonthly });
    const newLeaks = Math.max(0, Object.keys(items).length - Object.keys(committed?.items ?? {}).length);
    setCelebrate(Object.keys(items).length ? {
      title: `Leak Hunter! 🎯 ${money(pickedTotal)}/month found`,
      detail: `${impact.yearsSooner ? `Freedom could arrive ~${impact.yearsSooner.toFixed(1)} years sooner. ` : ""}Invested, that’s about ${money(impact.valueIn10Years)} in 10 years (today’s money).${newLeaks ? ` +${newLeaks * XP_PER_LEAK} XP` : ""}`,
    } : { title: "Pledge cleared", detail: "Come back any time to hunt for leaks." });
    setLoading(true); setReload(value => value + 1);
  }

  async function investIdle() {
    const supabase = createClient();
    if (!supabase || !state?.profile || !numbers) return;
    const amount = round(numbers.idle, code === "AE" ? 50 : 500);
    const { error } = await supabase.from("financial_profiles").update({ monthly_investment: Math.round(state.profile.monthly_investment + amount), updated_at: new Date().toISOString() }).eq("user_id", state.userId);
    if (error) { setMessage(error.message); return; }
    setCelebrate({ title: "Money put to work 💼", detail: `You now plan to invest ${money(state.profile.monthly_investment + amount)} a month. Set up an automatic SIP/transfer on salary day so it happens without willpower.` });
    setLoading(true); setReload(value => value + 1);
  }

  // Pledge scoreboard: average expenses in check-ins logged since the pledge vs the baseline.
  const sincePledge = committed && state ? state.checkins.filter(row => row.month_start >= committed.committed_at.slice(0, 7) + "-01") : [];
  const avgSince = sincePledge.length ? sincePledge.reduce((sum, row) => sum + row.expenses, 0) / sincePledge.length : null;
  const kept = avgSince !== null && committed ? committed.baseline_expenses - avgSince : null;

  // If the pledge was already applied to the profile (and no check-in has replaced those numbers yet),
  // measure the loot from the pre-pledge numbers so it isn't counted twice.
  const adj = committed?.applied && sincePledge.length === 0 ? committed.monthly_total : 0;
  const baseExpenses = numbers ? numbers.expenses + adj : 0;
  const baseInvested = numbers ? Math.max(0, numbers.invested - adj) : 0;
  const tier = numbers?.rate !== null && numbers ? getSavingsTier(numbers.rate!) : null;
  const next = numbers?.rate !== null && numbers ? getNextTier(numbers.rate!) : null;
  const baseRate = numbers ? savingsRate(numbers.income, baseExpenses) : null;
  const newRate = numbers ? savingsRate(numbers.income, baseExpenses - pickedTotal) : null;
  const previewTier = newRate !== null ? getSavingsTier(newRate) : null;
  const impact = numbers ? cutImpact({ accessible: numbers.accessible, monthlyInvestment: baseInvested, monthlyExpenses: baseExpenses, monthlyCut: pickedTotal, realReturnPercent: numbers.realReturn, withdrawalRatePercent: numbers.withdrawal, targetMonthlyExpenses: numbers.targetMonthly }) : null;
  const table = numbers ? savingsRateTable(numbers.realReturn, numbers.withdrawal) : [];
  const maxYears = Math.max(...table.map(row => row.years ?? 0), 1);
  const overspending = numbers ? findOverspending(spent, numbers.income) : [];
  const meterPos = (rate: number) => `${Math.min(100, Math.max(0, ((rate + 10) / 70) * 100))}%`;

  return <><Header /><main className="save-page container">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    <div className="profile-heading"><p className="eyebrow"><Scissors size={14} /> SAVE MORE · LEAK HUNTER</p><h1>Find money for your freedom.</h1><p>Your savings rate is the single biggest lever on your freedom date, bigger than investment returns. Let’s raise it without giving up what you love.</p></div>
    {loading ? <p className="profile-status">Loading your numbers…</p> : !numbers || !tier ? <section className="profile-card"><p>{message || "Add your income and expenses first. It takes a minute."}</p><Link href="/profile" className="button button-primary">Set up my money map</Link></section> : <>
      {message && <p className="profile-status" role="status">{message}</p>}

      <section className={`saver-card tone-${tier.tone}`}>
        <div className="saver-top">
          <div className="saver-badge" aria-hidden="true">{tier.emoji}</div>
          <div>
            <p className="eyebrow">YOUR SAVER LEVEL</p>
            <h2>{tier.name}</h2>
            <p className="saver-rate"><b>{numbers.rate!.toFixed(0)}%</b> of your income stays with you{numbers.income > 0 ? ` · ${Math.round(((numbers.invested + numbers.fromSalary) / numbers.income) * 100)}% gets invested${numbers.fromSalary > 0 ? " (incl. salary EPF/NPS)" : ""}` : ""}</p>
          </div>
        </div>
        <div className="saver-meter" aria-hidden="true">
          {SAVINGS_TIERS.slice(1).map(t => <span key={t.id} className="saver-tick" style={{ left: meterPos(t.min) }}><i>{t.emoji}</i><small>{t.min}%</small></span>)}
          <b className="saver-you" style={{ left: meterPos(numbers.rate!) }}>You</b>
        </div>
        <p className="saver-message">{tier.message}</p>
        {next && <p className="saver-next">🎯 <b>Next level: {next.emoji} {next.name}</b> at {next.min}%. Find <b>{money(cutNeededForRate(numbers.income, numbers.expenses, next.min))}/month</b> to level up.</p>}
        <p className="saver-source">Based on {state?.checkins.length ? "your recent monthly check-ins" : "your profile"}: income {money(numbers.income)}, expenses {money(numbers.expenses)} a month.</p>
      </section>

      {numbers.idle > Math.max(numbers.income * 0.03, code === "AE" ? 200 : 1000) && <section className="idle-card">
        <span className="idle-emoji">💤</span>
        <div><h2>{money(numbers.idle)} a month is sleeping in your bank</h2><p>It’s left after expenses but isn’t invested, so inflation slowly eats it. Pay yourself first: an automatic SIP or transfer on salary day.</p></div>
        <button type="button" className="button button-primary" onClick={() => void investIdle()}>Put {money(round(numbers.idle, code === "AE" ? 50 : 500))} to work</button>
      </section>}

      <section className="leak-hunt">
        <div className="leak-head"><div><p className="eyebrow"><Sparkles size={14} /> LEAK HUNTER · +{XP_PER_LEAK} XP PER LEAK</p><h2>Tap the leaks you can plug</h2><p>Small, painless cuts add up. Adjust the amount to what feels realistic. Cut what you don’t value, keep what you love.</p></div><div className="leak-loot"><span>Found</span><strong>{money(pickedTotal)}</strong><small>/month · {pickedCount} leak{pickedCount === 1 ? "" : "s"}</small></div></div>

        {overspending.length > 0 && <div className="leak-budget-flags"><strong>👀 From your budget</strong>{overspending.slice(0, 3).map(item => <span key={item.category}>{categoryLabels[item.category] ?? item.category}: {money(item.spent)} vs a typical {money(item.benchmark)} ({Math.round((item.benchmark / numbers.income) * 100)}% of income)</span>)}</div>}

        <div className="leak-grid">{leaks.map(leak => {
          const on = picked[leak.id] !== undefined;
          return <article key={leak.id} className={`leak-tile${on ? " on" : ""}${popped === leak.id ? " pop" : ""}`}>
            <button type="button" className="leak-toggle" onClick={() => toggle(leak.id, leak.typical)} aria-pressed={on}>
              <span className="leak-emoji">{leak.emoji}</span>
              <span className="leak-label">{leak.label}</span>
              <span className="leak-check">{on ? "✓" : "+"}</span>
              {popped === leak.id && <span className="leak-xp">+{XP_PER_LEAK} XP</span>}
            </button>
            {on && <div className="leak-body">
              <label>I can cut <input type="number" inputMode="numeric" min="0" step="any" value={picked[leak.id]} onChange={event => setPicked(current => ({ ...current, [leak.id]: event.target.value }))} aria-label={`Monthly amount to cut on ${leak.label}`} /> /month</label>
              <p>💡 {leak.tip}</p>
            </div>}
          </article>;
        })}</div>

        {pickedTotal > 0 && impact && <div className="leak-result">
          <h3>Your loot 🏆</h3>
          <div className="leak-result-grid">
            <div><span>Every year</span><strong>{money(impact.yearlyCut)}</strong></div>
            <div><span>Invested for 10 years</span><strong>{money(impact.valueIn10Years)}</strong><small>today’s money</small></div>
            <div><span>Freedom date</span><strong>{impact.yearsSooner ? `${impact.yearsSooner.toFixed(1)} yrs sooner` : impact.yearsAfter !== null && impact.yearsBefore === null ? "Now within reach!" : "Moving closer"}</strong>{!impact.yearsSooner && impact.yearsAfter === null && <small>hunt a few more leaks to set a date</small>}</div>
            <div><span>FIRE number shrinks by</span><strong>{money(impact.targetDrop)}</strong><small>you need less to live on</small></div>
          </div>
          {newRate !== null && baseRate !== null && previewTier && <p className="leak-levelup">Savings rate {baseRate.toFixed(0)}% → <b>{newRate.toFixed(0)}%</b>{previewTier.id !== getSavingsTier(baseRate).id && newRate > baseRate ? <> · <b>LEVEL UP: {previewTier.emoji} {previewTier.name}!</b></> : ""}</p>}
          <p className="leak-double">Cutting spending helps twice: the money gets invested <b>and</b> your FIRE number shrinks, because a cheaper lifestyle needs less to fund forever.</p>
          <label className="profile-check"><input type="checkbox" checked={updateNumbers} onChange={event => setUpdateNumbers(event.target.checked)} /> Update my plan: expenses {money(state!.profile!.monthly_expenses)} → {money(Math.max(0, state!.profile!.monthly_expenses - (pickedTotal - (committed?.monthly_total ?? 0))))}, investing {money(state!.profile!.monthly_investment)} → {money(state!.profile!.monthly_investment + (pickedTotal - (committed?.monthly_total ?? 0)))}</label>
          <button type="button" className="button button-primary leak-lock" disabled={saving || !changed} onClick={() => void lockIn()}>{saving ? "Saving…" : committed ? (changed ? "Update my pledge" : "Pledge saved ✓") : "Lock it in 🔒"}</button>
        </div>}
      </section>

      {committed && <section className="pledge-card">
        <Trophy size={22} />
        <div>
          <h2>Your pledge: {money(committed.monthly_total)}/month</h2>
          {kept === null ? <p>Log next month’s check-in to see your score. We’ll compare your spending with {money(committed.baseline_expenses)} before the pledge.</p>
            : kept >= committed.monthly_total * 0.8 ? <p>🎉 <b>You’re crushing it!</b> Average spending since your pledge is {money(avgSince!)}: you kept <b>{money(kept)}/month</b> ({sincePledge.length} month{sincePledge.length === 1 ? "" : "s"}).</p>
            : kept > 0 ? <p>💪 You kept <b>{money(kept)}/month</b> so far, {Math.round((kept / committed.monthly_total) * 100)}% of your pledge. Pick one leak to focus on this month.</p>
            : <p>This month got away from you, and that’s okay. Every month is a fresh start. Pick your easiest leak and try again.</p>}
        </div>
        <Link href="/month" className="text-link">Log a month <ArrowRight size={14} /></Link>
      </section>}

      <section className="rate-table">
        <h2>Savings rate → years to freedom</h2>
        <p>Starting from zero, how long until you could stop working, for <i>any</i> income. It’s not how much you earn, it’s how much you keep.</p>
        <div className="rate-rows">{table.map(row => {
          const here = numbers.rate! >= row.rate && (table.find(r => r.rate > row.rate)?.rate ?? 101) > numbers.rate!;
          return <div key={row.rate} className={`rate-row${here ? " here" : ""}`}>
            <span className="rate-pct">{row.rate}%</span>
            <span className="rate-bar"><i style={{ width: `${row.years === null ? 100 : Math.max(4, (row.years / maxYears) * 100)}%` }} /></span>
            <span className="rate-years">{row.years === null ? "80+ yrs" : `${Math.round(row.years)} yrs`}{here ? " ← you" : ""}</span>
          </div>;
        })}</div>
        <small>Uses your plan: {numbers.realReturn.toFixed(1)}% real return, {numbers.withdrawal}% withdrawal rate. Illustrative only, not investment advice.</small>
      </section>
    </>}
  </main><Footer /></>;
}
