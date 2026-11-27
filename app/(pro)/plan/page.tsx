"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { countryFromCurrency, formatCountryMoney, shortCountryMoney } from "@/lib/country";
import { inFutureMoney, inTodayMoney } from "@/lib/inflation";
import { corpusNeeded, simulateDrawdown, sustainableWithdrawalRate } from "@/lib/retirementDrawdown";
import { getWhyResult } from "@/lib/fireWhy";

type IncomeKind = "none" | "parttime" | "business" | "other";
const INCOME_KINDS: { id: IncomeKind; emoji: string; label: string }[] = [
  { id: "none", emoji: "🌴", label: "No income" },
  { id: "parttime", emoji: "🎨", label: "Part-time, freelance or passion work" },
  { id: "business", emoji: "🚀", label: "Business income" },
  { id: "other", emoji: "🏠", label: "Rent, pension or other" },
];
import { projectBreakdown, projectRetirementAssets, sumLaterAssets, type LaterAssetLot } from "@/lib/retirementProjection";

type Currency = "INR" | "AED" | "USD";
/** Lifestyle the FIRE number is built on, compared with today's spending. */
const fireLifestyle = (ratio: number) => ratio < 0.85 ? "🌿 Lean FIRE" : ratio > 1.25 ? "🥂 Fat FIRE" : "🙂 Regular FIRE";
type Inputs = { age: number; retirementAge: number; monthlyExpenses: number; retirementExpenses: number | null; assets: number; monthlyInvestment: number; monthlyInvestmentIncome: number; inflation: number; expectedReturn: number; withdrawal: number };
const initial: Inputs = { age: 30, retirementAge: 60, monthlyExpenses: 0, retirementExpenses: null, assets: 0, monthlyInvestment: 0, monthlyInvestmentIncome: 0, inflation: 6, expectedReturn: 8, withdrawal: 3.5 };

export default function PlanPage() {
  const [inputs, setInputs] = useState(initial);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [laterAssets, setLaterAssets] = useState(0);
  const [laterLots, setLaterLots] = useState<LaterAssetLot[]>([]);
  const [unknownAccessAssets, setUnknownAccessAssets] = useState(0);
  const [splitComplete, setSplitComplete] = useState(false);
  const [investmentIncomeTreatment, setInvestmentIncomeTreatment] = useState<"reinvested" | "cash">("reinvested");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [incomeKind, setIncomeKind] = useState<IncomeKind>("none"); // income after you stop working
  const [afterIncome, setAfterIncome] = useState(0); // per month, today's money
  const [afterIncomeYears, setAfterIncomeYears] = useState(10);
  const [incomeColumns, setIncomeColumns] = useState(false); // migration 0031 applied?
  const [incomeFromStyle, setIncomeFromStyle] = useState("");
  const [afterReturn, setAfterReturn] = useState(9); // yearly return after stopping work (set from the plan on load)
  const [planColumns, setPlanColumns] = useState(false); // retirement_expenses column exists (migration 0028)

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    let active = true;
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (!session?.user) { setLoading(false); return; }
        setSignedIn(true);
        const [profileResult, planResult, accountsResult] = await Promise.all([
          supabase.from("financial_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
          supabase.from("fire_plans").select("*").eq("user_id", session.user.id).maybeSingle(),
          supabase.from("financial_accounts").select("*").eq("user_id", session.user.id),
        ]);
        if (!active) return;
        setPlanColumns(Boolean(planResult.data && "retirement_expenses" in planResult.data));
        setIncomeColumns(Boolean(planResult.data && "after_fire_income" in planResult.data));
        // Income after FIRE: the saved answer, else a starting guess from the person's FIRE style (their "why").
        if (planResult.data?.after_fire_income_kind) {
          setIncomeKind(planResult.data.after_fire_income_kind as IncomeKind);
          setAfterIncome(Number(planResult.data.after_fire_income ?? 0));
          setAfterIncomeYears(Number(planResult.data.after_fire_income_years ?? 10));
        } else if (profileResult.data) {
          const why = Array.isArray(profileResult.data.fire_reasons) && profileResult.data.fire_reasons.length ? getWhyResult(profileResult.data.fire_reasons) : null;
          if (why?.style === "barista") { setIncomeKind("parttime"); setAfterIncome(Math.round(Number(profileResult.data.monthly_expenses ?? 0) * 0.3 / 1000) * 1000); setAfterIncomeYears(10); setIncomeFromStyle("Barista: you want to follow a passion or keep doing work you love"); }
          else if (why?.style === "runway") { setIncomeKind("business"); setAfterIncome(0); setAfterIncomeYears(10); setIncomeFromStyle("Runway: you want to start a business. Add income once you have a feel for it"); }
        }
        if (profileResult.error) setMessage(`Could not load your profile. Details: ${profileResult.error.message}`);
        const profile = profileResult.data;
        if (profile) {
          const assetsList = accountsResult.data?.filter(row => row.kind === "asset") ?? [];
          const investableList = assetsList.filter(row => row.fire_treatment === "available" && !row.goal_id); // goal money isn't FIRE money
          const laterList = assetsList.filter(row => row.fire_treatment === "later");
          const hasProfileSplit = profile.fire_accessible_assets !== null && profile.later_retirement_assets !== null;
          setCurrency(profile.currency);
          setInvestmentIncomeTreatment(planResult.data?.investment_income_treatment ?? "reinvested");
          const lots = assetsList.length
            ? laterList.map(row => ({ value: Number(row.current_value), availableFromAge: row.available_from_age === null ? null : Number(row.available_from_age) }))
            : Number(profile.later_retirement_assets ?? 0) > 0 ? [{ value: Number(profile.later_retirement_assets), availableFromAge: null }] : [];
          const laterTotals = sumLaterAssets(lots);
          setLaterLots(lots);
          setLaterAssets(laterTotals.total);
          setUnknownAccessAssets(laterTotals.accessAgeUnknown);
          setSplitComplete(assetsList.length > 0 || hasProfileSplit);
          setInputs(current => ({
            ...current,
            age: profile.age ?? current.age,
            retirementAge: Math.max(profile.age ?? current.age, planResult.data?.retirement_age ?? current.retirementAge),
            monthlyExpenses: Number(profile.monthly_expenses),
            retirementExpenses: planResult.data?.retirement_expenses == null ? null : Number(planResult.data.retirement_expenses),
            assets: assetsList.length ? investableList.reduce((total, row) => total + Number(row.current_value), 0) : profile.fire_accessible_assets === null ? Number(profile.assets) : Number(profile.fire_accessible_assets),
            monthlyInvestment: Number(profile.monthly_investment),
            monthlyInvestmentIncome: Number(planResult.data?.monthly_investment_income ?? profile.monthly_investment_income ?? 0),
            inflation: Number(planResult.data?.inflation_rate ?? current.inflation),
            expectedReturn: Number(planResult.data?.expected_return ?? current.expectedReturn),
            withdrawal: Number(planResult.data?.withdrawal_rate ?? current.withdrawal),
          }));
          // After stopping work, portfolios usually hold more safe assets: start one point below the working-years return.
          setAfterReturn(Math.max(4, Math.round((Number(planResult.data?.expected_return ?? 10) - 1) * 2) / 2));
        }
        if (planResult.error) setMessage(`Could not load saved FIRE assumptions. Run the FIRE plans migration in Supabase. Details: ${planResult.error.message}`);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Could not load your plan."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const result = useMemo(() => {
    const years = Math.max(0, inputs.retirementAge - inputs.age);
    const payoutYield = inputs.assets > 0 ? inputs.monthlyInvestmentIncome * 12 / inputs.assets * 100 : 0;
    const projectedAnnualGrowth = investmentIncomeTreatment === "cash" ? Math.max(-95, inputs.expectedReturn - payoutYield) : inputs.expectedReturn;
    const projectAtYear = (year: number) => projectRetirementAssets({ age: inputs.age, year, accessibleAssets: inputs.assets, monthlyContribution: inputs.monthlyInvestment, annualGrowthPercent: projectedAnnualGrowth, laterAssets: laterLots });
    // The target is built on planned retirement spending if set, else today's spending (both in today's money).
    const baseExpenses = inputs.retirementExpenses ?? inputs.monthlyExpenses;
    const expenseAtYear = (year: number) => inFutureMoney(baseExpenses, inputs.inflation, year);
    const expenseAtRetirement = expenseAtYear(years);
    const target = inputs.withdrawal > 0 ? expenseAtRetirement * 12 / (inputs.withdrawal / 100) : 0;
    const projected = projectAtYear(years);
    const series = Array.from({ length: years + 1 }, (_, year) => ({ year, wealth: projectAtYear(year), target: inputs.withdrawal > 0 ? expenseAtYear(year) * 12 / (inputs.withdrawal / 100) : 0 }));
    const crossing = series.find(point => point.wealth >= point.target);
    const maxValue = Math.max(1, ...series.flatMap(point => [point.wealth, point.target]));
    const chartX = (year: number) => 30 + (years ? year / years : 0) * 580;
    const chartY = (value: number) => 178 - value / maxValue * 150;
    return {
      years, expenseAtRetirement, target, baseExpenses, targetToday: inTodayMoney(target, inputs.inflation, years), projected, gap: projected - target, payoutYield, projectedAnnualGrowth,
      parts: projectBreakdown({ age: inputs.age, year: years, accessibleAssets: inputs.assets, monthlyContribution: inputs.monthlyInvestment, annualGrowthPercent: projectedAnnualGrowth, laterAssets: laterLots }),
      wealthPoints: series.map(point => `${chartX(point.year)},${chartY(point.wealth)}`).join(" "),
      targetPoints: series.map(point => `${chartX(point.year)},${chartY(point.target)}`).join(" "),
      crossingAge: crossing ? inputs.age + crossing.year : null,
    };
  }, [inputs, investmentIncomeTreatment, laterLots]);

  const money = (value: number) => formatCountryMoney(value, countryFromCurrency(currency));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setSignedIn(false); throw new Error("Sign in to save your assumptions."); }
      const { error } = await supabase.from("fire_plans").upsert({ user_id: session.user.id, retirement_age: inputs.retirementAge, ...(planColumns || inputs.retirementExpenses !== null ? { retirement_expenses: inputs.retirementExpenses } : {}), ...(incomeColumns || incomeKind !== "none" ? { after_fire_income_kind: incomeKind, after_fire_income: incomeKind === "none" ? 0 : afterIncome, after_fire_income_years: afterIncomeYears } : {}), inflation_rate: inputs.inflation, expected_return: inputs.expectedReturn, withdrawal_rate: inputs.withdrawal, investment_income_treatment: investmentIncomeTreatment, monthly_investment_income: inputs.monthlyInvestmentIncome, updated_at: new Date().toISOString() });
      if (error) throw /retirement_expenses/.test(error.message) ? new Error("Run supabase/migrations/202611260028_retirement_expenses.sql in Supabase to save expenses after you stop working.") : error;
      setMessage("FIRE assumptions saved to your account.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your plan."); }
    finally { setSaving(false); }
  }

  const sliders: { key: "retirementAge" | "inflation" | "expectedReturn" | "withdrawal"; label: string; min: number; max: number; step: number; suffix: string }[] = [
    { key: "retirementAge", label: "Target retirement age", min: inputs.age, max: 85, step: 1, suffix: "years" },
    { key: "inflation", label: "Annual inflation assumption", min: 0, max: 15, step: 0.5, suffix: "%" },
    { key: "expectedReturn", label: investmentIncomeTreatment === "cash" ? "Annual total return before cash payouts" : "Annual total return, with payouts reinvested", min: 0, max: 20, step: 0.5, suffix: "%" },
    { key: "withdrawal", label: "Withdrawal rate assumption", min: 1, max: 8, step: 0.25, suffix: "%" },
  ];

  return <><Header /><main className="plan-page container">
    <div className="profile-heading"><p className="eyebrow"><Target size={14} /> YOUR FIRE PLAN</p><h1>Explore your path to freedom.</h1><p>Start with your profile, adjust the assumptions, and compare an illustrative projection with your target.</p></div>
    {!loading && !signedIn ? <section className="profile-card"><p>Sign in to build and save your FIRE plan.</p><Link href="/" className="button button-primary">Return home to sign in</Link></section> : loading ? <p className="profile-status">Loading your plan…</p> : <>
      <form className="plan-form" onSubmit={save}>
        <section className="profile-card plan-inputs"><h2>Your starting point</h2>
          {!inputs.monthlyExpenses && <p className="account-source-note">Your profile has no monthly expenses yet. <Link href="/profile">Answer a few questions</Link> to see your plan.</p>}
          <p className="linked-intro">🔗 These come from your profile and portfolio — no need to type them again.</p>
          <div className="plan-result-line linked"><span>Monthly expenses</span><b>{money(inputs.monthlyExpenses)}</b><Link href="/profile">Edit</Link></div>
          <div className="retire-spend"><label><span>Monthly expenses after you stop working <small>(today’s money, optional)</small></span><input type="number" min="0" step="any" inputMode="numeric" placeholder={`Same as now: ${money(inputs.monthlyExpenses)}`} value={inputs.retirementExpenses ?? ""} onChange={event => setInputs(current => ({ ...current, retirementExpenses: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) }))} /></label>
            <div className="qn-chips">{[["🌿 Lean · 30% less", 0.7], ["🙂 Regular · same as now", null], ["🥂 Fat · 50% more", 1.5], ["💎 Fat · 2× today", 2]].map(([label, factor]) => <button key={label as string} type="button" className={(factor === null ? inputs.retirementExpenses === null : inputs.retirementExpenses === Math.round(inputs.monthlyExpenses * (factor as number))) ? "selected" : ""} onClick={() => setInputs(current => ({ ...current, retirementExpenses: factor === null ? null : Math.round(current.monthlyExpenses * (factor as number)) }))}>{label as string}</button>)}</div>
            <small>Your target lifestyle: <b>{fireLifestyle(inputs.retirementExpenses === null ? 1 : inputs.monthlyExpenses > 0 ? inputs.retirementExpenses / inputs.monthlyExpenses : 1)}</b>. Lean = simpler life; Fat = more travel, comfort and buffer. Home-loan EMIs and school fees often end by then; healthcare usually grows. Your FIRE number everywhere in the app uses this.</small></div>
          <div className="plan-result-line linked"><span>FIRE-accessible assets</span><b>{money(inputs.assets)}</b><Link href="/accounts">Edit</Link></div>
          <div className="plan-result-line linked"><span>Monthly investing</span><b>{money(inputs.monthlyInvestment)}</b><Link href="/profile">Edit</Link></div>
          <div className="plan-result-line"><span>Later-access retirement assets</span><b>{money(laterAssets)}</b></div>
          {laterAssets > 0 && <p className="account-source-note">Funds with an estimated access age are added to projected FIRE assets from that age. {unknownAccessAssets > 0 ? `${money(unknownAccessAssets)} has no access age recorded, so it stays outside the projection.` : "Set access ages in Accounts and check your current scheme rules."} The access age is your estimate, not a legal determination.</p>}
          {!splitComplete && <p className="account-source-note">Your portfolio is not classified yet, so this plan temporarily uses the overall profile asset estimate. <Link href="/profile">Classify your assets</Link> or add itemized records.</p>}
          <label className="profile-field"><span>Monthly investment income from FIRE-accessible assets ({currency})</span><input type="number" min="0" step="100" value={inputs.monthlyInvestmentIncome} onChange={event => setInputs(current => ({ ...current, monthlyInvestmentIncome: Number(event.target.value) }))} /><small>Use payouts from the assets above; this may differ from total investment income in your profile.</small></label>
          <label className="profile-field"><span>What happens to those payouts?</span><select value={investmentIncomeTreatment} onChange={event => setInvestmentIncomeTreatment(event.target.value as "reinvested" | "cash")}><option value="reinvested">Reinvested in the portfolio</option><option value="cash">Taken out as cash</option></select></label>
          <div className="plan-result-line"><span>Annual portfolio growth used in this projection</span><b>{result.projectedAnnualGrowth.toFixed(1)}%</b></div>
          <div className="plan-assumptions">{sliders.map(slider => <label className="range-field" key={slider.key}><span className="range-label">{slider.label}<b>{inputs[slider.key]}{slider.suffix === "years" ? " years" : slider.suffix}</b></span><input type="range" min={slider.min} max={slider.max} step={slider.step} value={inputs[slider.key]} onChange={event => setInputs(current => ({ ...current, [slider.key]: Number(event.target.value) }))} /><span className="range-bounds"><small>{slider.min}{slider.suffix === "years" ? "" : slider.suffix}</small><small>{slider.max}{slider.suffix === "years" ? " years" : slider.suffix}</small></span></label>)}</div>
          <p className="profile-privacy">When payouts are reinvested, the return assumption is total return and already includes them. When taken as cash, the projection subtracts the current payout yield from the total return to estimate portfolio growth; it does not assume that payout income will continue after retirement or reduce your FIRE spending target. Later-access retirement funds and property are excluded unless classified as available. Returns are illustrative and exclude taxes, fees, volatility, and sequence-of-returns risk.</p>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save assumptions"}</button>
          {message && <p className="profile-status" role="status">{message}</p>}
        </section>
        <section className="plan-results"><p className="result-kicker">ILLUSTRATIVE FIRE NUMBER</p><strong className="plan-target">{money(result.target)}</strong><p className="plan-today">= <b>{money(result.targetToday)}</b> in today’s money · {fireLifestyle(inputs.retirementExpenses === null || inputs.monthlyExpenses <= 0 ? 1 : inputs.retirementExpenses / inputs.monthlyExpenses)}</p><p>Money needed at age {inputs.retirementAge} to cover your expenses forever at a {inputs.withdrawal}% yearly withdrawal.</p>{inputs.withdrawal > 5 && <p className="plan-warn">⚠️ A {inputs.withdrawal}% withdrawal rate makes the target look small but risks running out of money. Most FIRE plans use 3–4% (India often 3–3.5% because of higher inflation). At 3.5% your target would be {money(result.expenseAtRetirement * 12 / 0.035)}.</p>}<div className="plan-result-line"><span>Expenses per month then</span><b>{money(result.expenseAtRetirement)}</b></div><p className="plan-math">{money(result.baseExpenses)}{inputs.retirementExpenses !== null ? " planned spending" : " today"} grows with {inputs.inflation}% inflation for {result.years} year{result.years === 1 ? "" : "s"} → {money(result.expenseAtRetirement)}/month. Target = {money(result.expenseAtRetirement)} × 12 ÷ {inputs.withdrawal}% = {money(result.target)}.</p><div className="plan-result-line"><span>Projected wealth at target age</span><b>{money(result.projected)}</b></div><ul className="plan-breakdown"><li><span>Today’s {money(inputs.assets)} growing at {result.projectedAnnualGrowth.toFixed(1)}%</span><b>{money(result.parts.grown)}</b></li><li><span>Investing {money(inputs.monthlyInvestment)}/month ({money(result.parts.contributed)} put in)</span><b>{money(result.parts.contributions)}</b></li>{result.parts.unlocked > 0 && <li><span>Later-access funds (EPF/PPF/NPS…) unlocked by age {inputs.retirementAge}</span><b>{money(result.parts.unlocked)}</b></li>}</ul><div className="plan-result-line"><span>Estimated target age</span><b>{result.crossingAge ? `Around age ${result.crossingAge}` : "Not reached in this scenario"}</b></div><div className={`plan-gap ${result.gap >= 0 ? "positive" : "negative"}`}><span>{result.gap >= 0 ? "Illustrative surplus" : "Illustrative gap"}</span><strong>{money(Math.abs(result.gap))}</strong></div><div className="plan-chart-wrap"><div className="plan-chart-heading"><b>Illustrative path</b><span>wealth vs FIRE number</span></div><svg className="plan-chart" viewBox="0 0 640 205" role="img" aria-labelledby="plan-chart-title plan-chart-description"><title id="plan-chart-title">Projected wealth compared with FIRE number</title><desc id="plan-chart-description">A projection based on your current investments, monthly contributions, return and inflation assumptions.</desc><line x1="30" y1="178" x2="610" y2="178" className="plan-chart-axis"/><polyline points={result.targetPoints} className="plan-chart-target"/><polyline points={result.wealthPoints} className="plan-chart-wealth"/><text x="30" y="198" className="plan-chart-label">{inputs.age}</text><text x="610" y="198" textAnchor="end" className="plan-chart-label">{inputs.retirementAge}</text></svg><div className="plan-chart-legend"><span><i className="wealth-key" />Projected wealth</span><span><i className="target-key" />FIRE number</span></div></div><p className="plan-result-note">This is a simplified scenario tool, not a promise or a recommendation. Change one assumption at a time to see how the estimate moves.</p></section>
      </form>
      {result.target > 0 && (() => {
        // Life after FIRE: withdrawals rise with inflation every year; does the money last to 100?
        const income = incomeKind === "none" ? 0 : afterIncome;
        const simBase = { retireAge: inputs.retirementAge, firstYearExpenses: result.expenseAtRetirement * 12, inflationPercent: inputs.inflation, returnPercent: afterReturn, yearsFromToday: result.years, incomeToday: income, incomeYears: afterIncomeYears };
        const sim = simulateDrawdown({ ...simBase, corpus: result.target });
        const needNoIncome = corpusNeeded({ ...simBase, incomeToday: 0 });
        const needWithIncome = income > 0 ? corpusNeeded(simBase) : needNoIncome;
        const safeRate = sim.runsOutAt !== null ? sustainableWithdrawalRate({ retireAge: inputs.retirementAge, inflationPercent: inputs.inflation, returnPercent: afterReturn }) : null;
        const pts = sim.years.map(y => ({ age: y.age + 1, value: y.endBalanceToday }));
        const startToday = result.target / Math.pow(1 + inputs.inflation / 100, result.years);
        const series = [{ age: inputs.retirementAge, value: startToday }, ...pts];
        const W2 = 640, H2 = 220, L = 62, R = 14, T = 14, B = 28;
        const maxV = Math.max(1, ...series.map(p => p.value));
        const x = (age: number) => L + ((age - inputs.retirementAge) / Math.max(1, 100 - inputs.retirementAge)) * (W2 - L - R);
        const y = (v: number) => T + (H2 - T - B) - (Math.max(0, v) / maxV) * (H2 - T - B);
        const path = series.map((p, k) => `${k ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
        const marks = [0, 10, 20, 30].map(n => sim.years[n]).filter(Boolean);
        const last = series.at(-1)!;
        return <section className="profile-card after-fire">
          <p className="eyebrow">AFTER YOU’RE FREE</p>
          <h2>Does the money last, with prices rising every year?</h2>
          <p className="after-intro">Your FIRE number assumes you <b>raise your withdrawals with inflation every year</b> after you stop working, while the rest of your money keeps growing. Here’s how that plays out from age {inputs.retirementAge}, starting with your FIRE number of {money(result.target)}.</p>
          <div className="after-income">
            <span className="after-q">After you stop working, will you earn anything?</span>
            <div className="qn-chips">{INCOME_KINDS.map(k => <button key={k.id} type="button" className={incomeKind === k.id ? "selected" : ""} onClick={() => { setIncomeKind(k.id); if (k.id !== "none" && !afterIncome) setAfterIncome(Math.round(inputs.monthlyExpenses * (k.id === "parttime" ? 0.3 : 0.2) / 1000) * 1000); }}>{k.emoji} {k.label}</button>)}</div>
            {incomeFromStyle && <small className="after-style">Pre-filled from your FIRE style ({incomeFromStyle}). Change it any time.</small>}
            {incomeKind !== "none" && <div className="after-income-fields">
              <label>Per month, in today’s money<div className="tm-amount small"><i>{currency === "AED" ? "AED" : "₹"}</i><input type="number" inputMode="numeric" min={0} step="any" value={afterIncome || ""} placeholder="0" onChange={e => setAfterIncome(Math.max(0, Number(e.target.value)))} /></div></label>
              <label className="range-field">For how many years<b>{afterIncomeYears} years (to age {inputs.retirementAge + afterIncomeYears})</b><input type="range" min={1} max={30} step={1} value={afterIncomeYears} onChange={e => setAfterIncomeYears(Number(e.target.value))} /></label>
              <small>{incomeKind === "business" ? "New businesses often take 2–3 years to pay you. Count only income you’re fairly sure of." : incomeKind === "parttime" ? "Part-time, consulting, teaching or passion work. Many early retirees earn something in the first 10 years." : "Rent, a pension or other steady income. It rises with inflation here."}</small>
            </div>}
          </div>
          <label className="range-field after-return"><span className="range-label">Yearly return after you stop working<b>{afterReturn}%</b></span><input type="range" min={4} max={14} step={0.5} value={afterReturn} onChange={e => setAfterReturn(Number(e.target.value))} /><small>Usually a little lower than while you’re working, because more is kept in safer investments. Inflation stays {inputs.inflation}%.</small></label>
          <div className="after-steps">{marks.map(m => <div key={m.age}><span>Age {m.age}</span><strong>{money(m.monthlyWithdrawal)}/month</strong><small>{m.monthlyIncome > 0 ? `from investments (spend ${money(m.monthlySpending)} − earn ${money(m.monthlyIncome)})` : m.age === inputs.retirementAge ? "first year" : `+${inputs.inflation}% a year`}</small></div>)}</div>
          <div className="after-need"><div><span>Money that lasts to 100 with no income</span><strong>{money(needNoIncome)}</strong></div>{income > 0 && <div className="with"><span>With {money(income)}/month for {afterIncomeYears} years (Barista FIRE)</span><strong>{money(needWithIncome)}</strong><small>{money(needNoIncome - needWithIncome)} less to save</small></div>}<div><span>Your FIRE number ({inputs.withdrawal}% rule)</span><strong>{money(result.target)}</strong></div></div>
          <p className={`after-verdict ${sim.runsOutAt === null ? "ok" : "short"}`}>{sim.runsOutAt === null
            ? <>✅ <b>Lasts beyond age 100.</b> About {money(last.value)} left at 100, in today’s money.</>
            : <>⚠️ <b>Runs out around age {sim.runsOutAt}.</b> To last to 100 at a {afterReturn}% return, use a withdrawal rate of about <b>{safeRate}%</b> (FIRE number {money(result.expenseAtRetirement * 12 / ((safeRate || 1) / 100))}), plan to spend a little less, or keep some income for a few years.</>}</p>
          <div className="after-chart">
            <svg viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="Money left each year after you stop working, in today's money">
              {[0, 0.5, 1].map(t => <g key={t}><line x1={L} x2={W2 - R} y1={y(maxV * t)} y2={y(maxV * t)} className="plan-chart-axis" opacity={t ? 0.35 : 1} /><text x={L - 8} y={y(maxV * t) + 4} textAnchor="end" className="plan-chart-label">{shortCountryMoney(maxV * t, countryFromCurrency(currency))}</text></g>)}
              <path d={path} className="plan-chart-wealth" fill="none" />
              <text x={x(last.age)} y={y(last.value) - 8} textAnchor="end" className="after-direct">{shortCountryMoney(last.value, countryFromCurrency(currency))}</text>
              {[inputs.retirementAge, ...[50, 60, 70, 80, 90, 100].filter(a => a > inputs.retirementAge + 4)].map(a => <text key={a} x={x(a)} y={H2 - 8} textAnchor="middle" className="plan-chart-label">{a}</text>)}
            </svg>
            <small>Money left at each age, in today’s money. {sim.runsOutAt === null ? "It falls slowly because withdrawals rise with prices; that’s expected, and it never reaches zero." : `It reaches zero around age ${sim.runsOutAt}: withdrawals rising with prices outpace growth.`}</small>
          </div>
          <h3>A simple way to hold the money (the bucket plan)</h3>
          <div className="after-buckets">
            <div><span>1</span><strong>Safety bucket</strong><p>About <b>2 years</b> of spending (about {money(Math.round(result.expenseAtRetirement * 24 / 10000) * 10000)}) in a savings account or liquid fund. You live from this, so a market fall never forces you to sell.</p></div>
            <div><span>2</span><strong>Stability bucket</strong><p>The next <b>~5 years</b> of spending in steadier options: FDs, debt or hybrid funds, Senior Citizen schemes later. Refills bucket 1 every year.</p></div>
            <div><span>3</span><strong>Growth bucket</strong><p>The rest in diversified equity, such as broad index funds, so your money keeps growing faster than prices. Move gains to bucket 2 after good years.</p></div>
          </div>
          <ul className="after-rules">
            <li>Raise your withdrawal once a year by inflation, not more.</li>
            <li>In a year when markets fall a lot, skip the raise or trim spending a little. Small cuts in bad years make the money last much longer.</li>
            <li>Review once a year: spending, health cover, and whether your withdrawal rate is still near your plan.</li>
          </ul>
          <p className="profile-privacy">Illustrative only: steady returns are assumed, but real markets go up and down, and tax isn’t modelled. This is education, not investment advice. Consider a SEBI-registered adviser for your actual plan.</p>
        </section>;
      })()}
    </>}
  </main><Footer /></>;
}
