"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ArrowRight, Info, Lock } from "lucide-react";
import { CALCULATOR_KEY, PRICING } from "@/lib/subscription";
import { formatCountryMoney, priceText } from "@/lib/country";
import { useCountry } from "@/lib/useCountry";

export default function FireCalculator() {
  const { country } = useCountry();
  const currency = country.currency;
  const money = (value: number) => formatCountryMoney(value, country.code);
  const [age, setAge] = useState(30);
  const [retireAge, setRetireAge] = useState(45);
  const [expenses, setExpenses] = useState(country.calculator.expenses);
  const [assets, setAssets] = useState(country.calculator.assets);
  const [monthlyInvestment, setMonthlyInvestment] = useState(country.calculator.monthlyInvestment);
  const [inflation, setInflation] = useState(country.defaults.inflation);
  const [returnRate, setReturnRate] = useState(country.defaults.expectedReturn);
  const [withdrawal, setWithdrawal] = useState(country.defaults.withdrawal);

  // Switching country (or auto-detecting UAE) loads that country's typical starting numbers.
  useEffect(() => {
    setExpenses(country.calculator.expenses); setAssets(country.calculator.assets); setMonthlyInvestment(country.calculator.monthlyInvestment);
    setInflation(country.defaults.inflation); setReturnRate(country.defaults.expectedReturn); setWithdrawal(country.defaults.withdrawal);
  }, [country]);
  const result = useMemo(() => {
    const years = Math.max(0, retireAge - age);
    const futureMonthlyExpenses = expenses * Math.pow(1 + inflation / 100, years);
    const targetCorpus = futureMonthlyExpenses * 12 / (withdrawal / 100);
    const monthlyRate = Math.pow(1 + returnRate / 100, 1 / 12) - 1;
    const months = years * 12;
    const existingFuture = assets * Math.pow(1 + returnRate / 100, years);
    const contributionsFuture = monthlyRate === 0
      ? monthlyInvestment * months
      : monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    const projected = existingFuture + contributionsFuture;
    // Earliest age at which projected wealth covers the inflation-adjusted target (searching up to age 85).
    const freedomAge = (sip: number) => {
      for (let y = 0; age + y <= 85; y += 1) {
        const m = y * 12;
        const wealth = assets * Math.pow(1 + returnRate / 100, y) + (monthlyRate === 0 ? sip * m : sip * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate));
        const target = expenses * Math.pow(1 + inflation / 100, y) * 12 / (withdrawal / 100);
        if (wealth >= target) return age + y;
      }
      return null;
    };
    const earliest = freedomAge(monthlyInvestment);
    const boosted = freedomAge(monthlyInvestment + country.boostStep);
    return { years, futureMonthlyExpenses, targetCorpus, projected, gap: projected - targetCorpus, earliest, boosted };
  }, [age, retireAge, expenses, assets, monthlyInvestment, inflation, returnRate, withdrawal]);

  // Remember the inputs so signing up never asks for them again — but only once the visitor has
  // actually changed something, so the demo defaults are never mistaken for their real numbers.
  useEffect(() => {
    const touched = age !== 30 || retireAge !== 45 || expenses !== country.calculator.expenses || assets !== country.calculator.assets || monthlyInvestment !== country.calculator.monthlyInvestment;
    if (!touched) return;
    try { window.localStorage.setItem(CALCULATOR_KEY, JSON.stringify({ age, retireAge, expenses, assets, monthlyInvestment })); } catch { /* storage unavailable */ }
  }, [age, retireAge, expenses, assets, monthlyInvestment, country]);

  const fields: { label: string; value: number; set: (value: number) => void; min: number; max: number; step?: number; suffix: string }[] = [
    { label: "Your current age", value: age, set: setAge, min: 18, max: 75, suffix: "years" },
    { label: "Target retirement age", value: retireAge, set: setRetireAge, min: age, max: 85, suffix: "years" },
    { label: "Monthly household expenses", value: expenses, set: setExpenses, min: country.calculator.step, max: country.calculator.expensesMax, step: country.calculator.step, suffix: currency },
    { label: "Current investable assets", value: assets, set: setAssets, min: 0, max: country.calculator.assetsMax, step: country.calculator.step * 10, suffix: currency },
    { label: "Monthly investment", value: monthlyInvestment, set: setMonthlyInvestment, min: 0, max: country.calculator.investmentMax, step: country.calculator.step, suffix: currency },
  ];

  return (
    <section className="calculator-section section-pad" id="fire-calculator">
      <div className="container">
        <div className="section-heading centered">
          <p className="eyebrow"><Calculator size={14} /> YOUR FIRST STEP</p>
          <h2>Find your financial <span>freedom number.</span></h2>
          <p>Start with a few numbers. Explore an estimate of what financial independence could look like for you.</p>
        </div>
        <div className="calculator-shell">
          <div className="calculator-inputs">
            <div className="calc-title-row"><div><h3>Your starting point</h3><p>Change the values to explore scenarios.</p></div></div>
            {fields.map((field, index) => (
              <label className="range-field" key={field.label}>
                <span className="range-label">{field.label}<b>{field.suffix === "years" ? `${field.value} years` : money(field.value)}</b></span>
                <input type="range" min={field.min} max={field.max} step={field.step || 1} value={field.value}
                  onChange={e => field.set(Number(e.target.value))} />
                <span className="range-bounds"><small>{index === 0 ? "18" : "0"}</small><small>{index === 0 ? "75" : "Adjust to explore"}</small></span>
              </label>
            ))}
            <div className="assumption-grid">
              <label>Inflation <span>{inflation}%</span><input type="range" min="2" max="12" step=".5" value={inflation} onChange={e => setInflation(Number(e.target.value))}/></label>
              <label>Expected return <span>{returnRate}%</span><input type="range" min="4" max="15" step=".5" value={returnRate} onChange={e => setReturnRate(Number(e.target.value))}/></label>
              <label>Withdrawal rate <span>{withdrawal}%</span><input type="range" min="2" max="6" step=".25" value={withdrawal} onChange={e => setWithdrawal(Number(e.target.value))}/></label>
            </div>
            <div className="calc-disclaimer"><Info size={15}/> All amounts are shown in {currency}. Illustrative assumptions only; returns and withdrawal rates are not guaranteed or recommendations.</div>
          </div>
          <div className="calculator-results">
            <span className="result-kicker">YOUR ESTIMATED FIRE TARGET</span>
            <div className="result-number">{money(result.targetCorpus)}</div>
            <p>Estimated corpus required at age {retireAge}, based on your inputs.</p>
            <div className="result-divider"/>
            <div className="result-row"><span>Monthly expenses at retirement</span><b>{money(result.futureMonthlyExpenses)}</b></div>
            <div className="result-row"><span>Projected wealth at target age</span><b>{money(result.projected)}</b></div>
            <div className="result-row"><span>Years to target age</span><b>{result.years} years</b></div>
            <div className={result.gap >= 0 ? "gap-box positive" : "gap-box negative"}>
              <span>{result.gap >= 0 ? "Illustrative surplus" : "Illustrative shortfall"}</span>
              <b>{money(Math.abs(result.gap))}</b>
            </div>
            <div className="freedom-age-box">
              <span>You could be financially free at</span>
              <strong>{result.earliest ? `age ${result.earliest}` : "85+"}</strong>
              {result.earliest && result.boosted && result.boosted < result.earliest && <small>🚀 Invest {money(country.boostStep)} more a month → free at <b>age {result.boosted}</b>, {result.earliest - result.boosted} year{result.earliest - result.boosted > 1 ? "s" : ""} sooner</small>}
            </div>
            <a href="#your-plan" className="button button-light result-button">See your full plan <ArrowRight size={16}/></a>
            <small className="result-note">This simplified calculator excludes taxes, fees, asset allocation, market volatility, other retirement income and sequence-of-returns risk. It is not a personalised investment recommendation.</small>
          </div>
        </div>

        <div className="pro-teaser" id="your-plan">
          <div className="pro-teaser-head">
            <p className="eyebrow">👑 YOUR PERSONAL PLAN · PRO</p>
            <h3>That’s your number. Here’s how to actually get there.</h3>
            <p>Pro turns this estimate into a step-by-step plan built on your numbers — and keeps you on track every month. <small>(Previews below use example data.)</small></p>
          </div>
          <div className="pro-teaser-grid">
            {[
              { emoji: "🗺️", title: "Your next 3 steps", lines: ["Level 3 · Starter safety net", "Level 4 · Shield your family", "Level 5 · Clear expensive debt"] },
              { emoji: "🎯", title: "Your FIRE score", lines: ["Score: 72 / 100", "Strongest: Regular investing", "Fix first: Emergency buffer"] },
              { emoji: "🏠", title: "Your goals", lines: [`Home down payment · ${money(country.calculator.monthlyInvestment * 0.7)}/mo`, `Kids’ education · ${money(country.calculator.monthlyInvestment * 0.35)}/mo`, `Left for FIRE · ${money(country.calculator.monthlyInvestment * 0.25)}/mo`] },
              { emoji: "📚", title: "Today’s lesson", lines: ["The Psychology of Money", "“Know what ‘enough’ is”", "2-minute read + quiz"] },
            ].map(card => <article className="pro-teaser-card" key={card.title}>
              <span className="pro-teaser-emoji">{card.emoji}</span><strong>{card.title}</strong>
              <div className="pro-teaser-blur" aria-hidden="true">{card.lines.map(line => <span key={line}>{line}</span>)}</div>
              <span className="pro-teaser-lock"><Lock size={14} /> Unlock with Pro</span>
            </article>)}
          </div>
          <div className="pro-teaser-cta">
            <a href="/pricing" className="button button-primary button-large">Start free {PRICING.trialDays}-day trial <ArrowRight size={16} /></a>
            <span>No card needed · then {priceText(country.pricing.monthly, country.code)}/month or {priceText(country.pricing.yearly, country.code)}/year, only if you love it</span>
          </div>
        </div>
      </div>
    </section>
  );
}
