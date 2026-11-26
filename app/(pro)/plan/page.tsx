"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { projectBreakdown, projectRetirementAssets, sumLaterAssets, type LaterAssetLot } from "@/lib/retirementProjection";

type Currency = "INR" | "AED" | "USD";
type Inputs = { age: number; retirementAge: number; monthlyExpenses: number; assets: number; monthlyInvestment: number; monthlyInvestmentIncome: number; inflation: number; expectedReturn: number; withdrawal: number };
const initial: Inputs = { age: 30, retirementAge: 60, monthlyExpenses: 0, assets: 0, monthlyInvestment: 0, monthlyInvestmentIncome: 0, inflation: 6, expectedReturn: 8, withdrawal: 3.5 };

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
          supabase.from("financial_profiles").select("age, monthly_expenses, assets, fire_accessible_assets, later_retirement_assets, monthly_investment, monthly_investment_income, currency").eq("user_id", session.user.id).maybeSingle(),
          supabase.from("fire_plans").select("retirement_age, inflation_rate, expected_return, withdrawal_rate, investment_income_treatment, monthly_investment_income").eq("user_id", session.user.id).maybeSingle(),
          supabase.from("financial_accounts").select("*").eq("user_id", session.user.id),
        ]);
        if (!active) return;
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
            assets: assetsList.length ? investableList.reduce((total, row) => total + Number(row.current_value), 0) : profile.fire_accessible_assets === null ? Number(profile.assets) : Number(profile.fire_accessible_assets),
            monthlyInvestment: Number(profile.monthly_investment),
            monthlyInvestmentIncome: Number(planResult.data?.monthly_investment_income ?? profile.monthly_investment_income ?? 0),
            inflation: Number(planResult.data?.inflation_rate ?? current.inflation),
            expectedReturn: Number(planResult.data?.expected_return ?? current.expectedReturn),
            withdrawal: Number(planResult.data?.withdrawal_rate ?? current.withdrawal),
          }));
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
    const expenseAtYear = (year: number) => inputs.monthlyExpenses * Math.pow(1 + inputs.inflation / 100, year);
    const expenseAtRetirement = expenseAtYear(years);
    const target = inputs.withdrawal > 0 ? expenseAtRetirement * 12 / (inputs.withdrawal / 100) : 0;
    const projected = projectAtYear(years);
    const series = Array.from({ length: years + 1 }, (_, year) => ({ year, wealth: projectAtYear(year), target: inputs.withdrawal > 0 ? expenseAtYear(year) * 12 / (inputs.withdrawal / 100) : 0 }));
    const crossing = series.find(point => point.wealth >= point.target);
    const maxValue = Math.max(1, ...series.flatMap(point => [point.wealth, point.target]));
    const chartX = (year: number) => 30 + (years ? year / years : 0) * 580;
    const chartY = (value: number) => 178 - value / maxValue * 150;
    return {
      years, expenseAtRetirement, target, projected, gap: projected - target, payoutYield, projectedAnnualGrowth,
      parts: projectBreakdown({ age: inputs.age, year: years, accessibleAssets: inputs.assets, monthlyContribution: inputs.monthlyInvestment, annualGrowthPercent: projectedAnnualGrowth, laterAssets: laterLots }),
      wealthPoints: series.map(point => `${chartX(point.year)},${chartY(point.wealth)}`).join(" "),
      targetPoints: series.map(point => `${chartX(point.year)},${chartY(point.target)}`).join(" "),
      crossingAge: crossing ? inputs.age + crossing.year : null,
    };
  }, [inputs, investmentIncomeTreatment, laterLots]);

  const money = (value: number) => new Intl.NumberFormat(currency === "INR" ? "en-IN" : currency === "AED" ? "en-AE" : "en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(value) >= 10000000 ? 2 : 0, notation: Math.abs(value) >= 10000000 ? "compact" : "standard" }).format(value);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setSignedIn(false); throw new Error("Sign in to save your assumptions."); }
      const { error } = await supabase.from("fire_plans").upsert({ user_id: session.user.id, retirement_age: inputs.retirementAge, inflation_rate: inputs.inflation, expected_return: inputs.expectedReturn, withdrawal_rate: inputs.withdrawal, investment_income_treatment: investmentIncomeTreatment, monthly_investment_income: inputs.monthlyInvestmentIncome, updated_at: new Date().toISOString() });
      if (error) throw error;
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
        <section className="plan-results"><p className="result-kicker">ILLUSTRATIVE FIRE TARGET</p><strong className="plan-target">{money(result.target)}</strong><p>Money needed at age {inputs.retirementAge} to cover your expenses forever at a {inputs.withdrawal}% yearly withdrawal.</p>{inputs.withdrawal > 5 && <p className="plan-warn">⚠️ A {inputs.withdrawal}% withdrawal rate makes the target look small but risks running out of money. Most FIRE plans use 3–4% (India often 3–3.5% because of higher inflation). At 3.5% your target would be {money(result.expenseAtRetirement * 12 / 0.035)}.</p>}<div className="plan-result-line"><span>Expenses per month then</span><b>{money(result.expenseAtRetirement)}</b></div><p className="plan-math">{money(inputs.monthlyExpenses)} today grows with {inputs.inflation}% inflation for {result.years} year{result.years === 1 ? "" : "s"} → {money(result.expenseAtRetirement)}/month. Target = {money(result.expenseAtRetirement)} × 12 ÷ {inputs.withdrawal}% = {money(result.target)}.</p><div className="plan-result-line"><span>Projected wealth at target age</span><b>{money(result.projected)}</b></div><ul className="plan-breakdown"><li><span>Today’s {money(inputs.assets)} growing at {result.projectedAnnualGrowth.toFixed(1)}%</span><b>{money(result.parts.grown)}</b></li><li><span>Investing {money(inputs.monthlyInvestment)}/month ({money(result.parts.contributed)} put in)</span><b>{money(result.parts.contributions)}</b></li>{result.parts.unlocked > 0 && <li><span>Later-access funds (EPF/PPF/NPS…) unlocked by age {inputs.retirementAge}</span><b>{money(result.parts.unlocked)}</b></li>}</ul><div className="plan-result-line"><span>Estimated target age</span><b>{result.crossingAge ? `Around age ${result.crossingAge}` : "Not reached in this scenario"}</b></div><div className={`plan-gap ${result.gap >= 0 ? "positive" : "negative"}`}><span>{result.gap >= 0 ? "Illustrative surplus" : "Illustrative gap"}</span><strong>{money(Math.abs(result.gap))}</strong></div><div className="plan-chart-wrap"><div className="plan-chart-heading"><b>Illustrative path</b><span>wealth vs FIRE target</span></div><svg className="plan-chart" viewBox="0 0 640 205" role="img" aria-labelledby="plan-chart-title plan-chart-description"><title id="plan-chart-title">Projected wealth compared with FIRE target</title><desc id="plan-chart-description">A projection based on your current investments, monthly contributions, return and inflation assumptions.</desc><line x1="30" y1="178" x2="610" y2="178" className="plan-chart-axis"/><polyline points={result.targetPoints} className="plan-chart-target"/><polyline points={result.wealthPoints} className="plan-chart-wealth"/><text x="30" y="198" className="plan-chart-label">{inputs.age}</text><text x="610" y="198" textAnchor="end" className="plan-chart-label">{inputs.retirementAge}</text></svg><div className="plan-chart-legend"><span><i className="wealth-key" />Projected wealth</span><span><i className="target-key" />FIRE target</span></div></div><p className="plan-result-note">This is a simplified scenario tool, not a promise or a recommendation. Change one assumption at a time to see how the estimate moves.</p></section>
      </form>
    </>}
  </main><Footer /></>;
}
