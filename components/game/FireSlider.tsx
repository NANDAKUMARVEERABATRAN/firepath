"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { formatMoney } from "@/lib/financialState";
import { yearsToTarget } from "@/lib/freedomPath";
import { countryFromCurrency, getCountry } from "@/lib/country";

type Props = { age: number | null; accessible: number; monthlyInvestment: number; target: number; realReturn: number; currency: "INR" | "AED" | "USD" };

/** "What if I invested more?" — the most motivating lever in FIRE, made tangible. */
export default function FireSlider({ age, accessible, monthlyInvestment, target, realReturn, currency }: Props) {
  const max = Math.max(currency === "AED" ? 10_000 : 50_000, Math.ceil((monthlyInvestment * 3) / 5000) * 5000);
  const [sip, setSip] = useState(Math.round(monthlyInvestment));
  const base = useMemo(() => yearsToTarget(accessible, monthlyInvestment, target, realReturn), [accessible, monthlyInvestment, target, realReturn]);
  const years = useMemo(() => yearsToTarget(accessible, sip, target, realReturn), [accessible, sip, target, realReturn]);
  const diff = base !== null && years !== null ? base - years : null;
  const fireAge = years !== null && age ? Math.ceil(age + years) : null;
  const year = years !== null ? new Date().getFullYear() + Math.ceil(years) : null;

  return (
    <section className="fire-slider">
      <div className="fire-slider-head"><p className="eyebrow"><SlidersHorizontal size={14} /> PLAY WITH YOUR FREEDOM DATE</p><span>Drag to see what changes</span></div>
      <div className="fire-slider-body">
        <div className="fire-slider-control">
          <label htmlFor="sip-slider">If I invest every month</label>
          <strong>{formatMoney(sip, currency)}</strong>
          <input id="sip-slider" type="range" min={0} max={max} step={currency === "AED" ? 100 : 500} value={sip} onChange={event => setSip(Number(event.target.value))} style={{ ["--fill" as string]: `${(sip / max) * 100}%` }} />
          <div className="fire-slider-quick">{getCountry(countryFromCurrency(currency)).sliderSteps.map(delta => <button key={delta} type="button" onClick={() => setSip(value => Math.min(max, Math.max(0, value + delta)))}>{delta > 0 ? "+" : "−"}{formatMoney(Math.abs(delta), currency)}</button>)}<button type="button" onClick={() => setSip(Math.round(monthlyInvestment))}>Reset</button></div>
        </div>
        <div className="fire-slider-result">
          <span>I could be financially free</span>
          <strong>{years === null ? "Not within 60 years" : years === 0 ? "Right now 🎉" : fireAge ? `at age ${fireAge}` : `in ${years.toFixed(1)} years`}</strong>
          <small>{year && years ? `around ${year}` : "Try a higher amount"}</small>
          {diff !== null && Math.abs(diff) >= 0.1 && <em className={diff > 0 ? "good" : "bad"}>{diff > 0 ? `🚀 ${diff.toFixed(1)} years sooner` : `${Math.abs(diff).toFixed(1)} years later`}</em>}
        </div>
      </div>
      <p className="journey-note">In today’s money, {realReturn.toFixed(1)}% real growth. Like what you see? Increase your SIP, then update it in your <a href="/month">monthly check-in</a>.</p>
    </section>
  );
}
