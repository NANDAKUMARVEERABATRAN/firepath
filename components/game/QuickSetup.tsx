"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFireScore } from "@/lib/fireScore";
import { formatMoney } from "@/lib/financialState";
import { yearsToTarget } from "@/lib/freedomPath";
import { CALCULATOR_KEY, type CalculatorSnapshot } from "@/lib/subscription";
import { COUNTRIES, type CountryCode, type CountryConfig } from "@/lib/country";
import { useCountry } from "@/lib/useCountry";

type Values = { age: string; income: string; expenses: string; investments: string; emergency: string; sip: string };

type SetupStep = { title: string; subtitle: string; fields: { key: keyof Values; label: string; placeholder: string; hint?: string }[] };
const buildSteps = (c: CountryConfig): SetupStep[] => {
  const india = c.code === "IN";
  return [
    { title: "Let’s start with you", subtitle: "Two numbers. Rough is fine — you can change them anytime.", fields: [
      { key: "age", label: "Your age", placeholder: "30" },
      { key: "income", label: `Monthly take-home income (${c.symbol})`, placeholder: india ? "80000" : "20000", hint: india ? "Salary after tax, plus any other regular income" : "Salary plus allowances (housing, transport) and any other regular income" },
    ] },
    { title: "Where does it go?", subtitle: "Your best guess for a normal month.", fields: [
      { key: "expenses", label: `Monthly spending (${c.symbol})`, placeholder: india ? "45000" : "12000", hint: india ? "Rent, EMI, food, bills, fun — everything except investing" : "Rent, school fees, bills, money sent home, fun — everything except investing" },
      { key: "sip", label: `Monthly investing (${c.symbol})`, placeholder: india ? "10000" : "3000", hint: india ? "Mutual fund SIPs, stocks, RD, NPS top-ups" : "Funds, ETFs, stocks, savings plans — here or back home" },
    ] },
    { title: "What have you built so far?", subtitle: india ? "Exclude the home you live in and EPF/PPF — we’ll add those later." : "Exclude your home and end-of-service gratuity — we’ll add those later.", fields: [
      { key: "investments", label: `Investments you could use (${c.symbol})`, placeholder: india ? "300000" : "80000", hint: india ? "Mutual funds, stocks, FDs, gold" : "Funds, stocks, deposits, gold — in the UAE or back home" },
      { key: "emergency", label: `Emergency savings (${c.symbol})`, placeholder: india ? "100000" : "30000", hint: "Cash kept aside for emergencies" },
    ] },
  ];
};
export default function QuickSetup({ userId, name, onDone }: { userId: string; name: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const { country, setCountry } = useCountry();
  const steps = buildSteps(country);
  // Pre-fill from the free calculator so nothing is typed twice.
  const [values, setValues] = useState<Values>(() => {
    const blank: Values = { age: "", income: "", expenses: "", investments: "", emergency: "", sip: "" };
    try {
      const saved = JSON.parse(window.localStorage.getItem(CALCULATOR_KEY) ?? "null") as CalculatorSnapshot | null;
      if (saved) return { ...blank, age: String(saved.age), expenses: String(saved.expenses), investments: String(saved.assets), sip: String(saved.monthlyInvestment) };
    } catch { /* storage unavailable */ }
    return blank;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const n = (key: keyof Values) => Math.max(0, Number(values[key] || 0));
  const current = steps[step];
  const canContinue = current.fields.every(field => values[field.key] !== "" && Number(values[field.key]) >= 0) && (step !== 0 || (n("age") >= 18 && n("age") <= 100 && n("income") > 0));

  // Live teaser on the last step: the user's FIRE number and rough date before they even save.
  const preview = (() => {
    if (n("expenses") <= 0) return null;
    const score = getFireScore({ age: n("age"), monthly_income: n("income"), monthly_expenses: n("expenses"), assets: n("investments") + n("emergency"), investableAssets: n("investments"), liabilities: 0, emergency_fund: n("emergency"), monthly_investment: n("sip"), has_health_insurance: false, has_term_insurance: false, currency: country.currency });
    const years = yearsToTarget(n("investments"), n("sip"), score.fireTarget, country.defaults.expectedReturn - country.defaults.inflation);
    return { target: score.fireTarget, years };
  })();

  async function finish() {
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.from("financial_profiles").upsert({
      user_id: userId, age: n("age"), monthly_income: n("income"), monthly_expenses: n("expenses"),
      assets: n("investments") + n("emergency"), fire_accessible_assets: n("investments"), later_retirement_assets: 0,
      emergency_fund: n("emergency"), monthly_investment: n("sip"), currency: country.currency, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) setMessage(`Could not save: ${error.message}`); else onDone();
  }

  return (
    <section className="quick-setup">
      <div className="quick-setup-top">
        <p className="eyebrow"><Rocket size={14} /> {name ? `WELCOME, ${name.toUpperCase()}` : "WELCOME"} · 60-SECOND SETUP</p>
        <div className="setup-dots">{steps.map((_, index) => <span key={index} className={index <= step ? "on" : ""} />)}</div>
      </div>
      <h1>{current.title}</h1>
      <p className="quick-setup-sub">{current.subtitle}</p>
      {step === 0 && <div className="qn-chips setup-country">{(Object.keys(COUNTRIES) as CountryCode[]).map(code => <button type="button" key={code} className={country.code === code ? "selected" : ""} onClick={() => setCountry(code)}>{COUNTRIES[code].flag} I live in {COUNTRIES[code].name}</button>)}</div>}
      <div className="quick-setup-fields">{current.fields.map(field => <label className="profile-field" key={field.key}><span>{field.label}</span><input type="number" inputMode="numeric" min="0" step="any" placeholder={field.placeholder} value={values[field.key]} autoFocus={field === current.fields[0]} onChange={event => setValues(v => ({ ...v, [field.key]: event.target.value }))} />{field.hint && <small>{field.hint}</small>}</label>)}</div>
      {step === 2 && preview && <div className="setup-preview"><span>Your FIRE number</span><strong>{formatMoney(preview.target, country.currency)}</strong><small>{preview.years === null ? "Start investing monthly to set your freedom date." : preview.years === 0 ? "You may already be there! 🎉" : `At this pace, about ${preview.years.toFixed(0)} years to freedom — let’s make that shorter.`}</small></div>}
      {message && <p className="profile-status">{message}</p>}
      <div className="quick-setup-actions">
        {step > 0 ? <button type="button" className="text-link" onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Back</button> : <a className="text-link" href="/profile">Use the detailed form</a>}
        {step < steps.length - 1
          ? <button type="button" className="button button-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16} /></button>
          : <button type="button" className="button button-primary" disabled={!canContinue || saving} onClick={() => void finish()}>{saving ? "Starting…" : "Start my journey 🚀"}</button>}
      </div>
    </section>
  );
}
