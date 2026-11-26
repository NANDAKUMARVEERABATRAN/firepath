"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { yearsToTargetStepUp } from "@/lib/freedomPath";
import type { PlanRow } from "@/lib/financialState";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Props = {
  userId: string;
  age: number | null;
  accessible: number;
  monthlyInvestment: number;
  target: number;
  plan: PlanRow & { step_up_percent?: number; step_up_month?: number | null };
  money: (value: number) => string;
  onSaved: (stepUpPercent: number, stepUpMonth: number) => void;
};

/** "Raise your investment a little every year" — usually the biggest single lever on the FIRE date. */
export default function StepUpPlan({ userId, age, accessible, monthlyInvestment, target, plan, money, onSaved }: Props) {
  const [percent, setPercent] = useState(plan.step_up_percent && plan.step_up_percent > 0 ? plan.step_up_percent : 10);
  const [month, setMonth] = useState(plan.step_up_month ?? 4);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const real = plan.expected_return - plan.inflation_rate;
  const flat = yearsToTargetStepUp(accessible, monthlyInvestment, target, real, 0, plan.inflation_rate);
  const stepped = yearsToTargetStepUp(accessible, monthlyInvestment, target, real, percent, plan.inflation_rate);
  const saved = flat !== null && stepped !== null ? flat - stepped : null;
  const active = (plan.step_up_percent ?? 0) > 0;
  const ageAt = (years: number | null) => (years === null ? "60+ years away" : age ? `age ${Math.ceil(age + years)}` : `${years.toFixed(1)} years`);

  async function save() {
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    // Include the plan's current assumptions so a first-time save never resets them to generic defaults.
    const { error } = await supabase.from("fire_plans").upsert({
      user_id: userId, retirement_age: plan.retirement_age, inflation_rate: plan.inflation_rate, expected_return: plan.expected_return, withdrawal_rate: plan.withdrawal_rate,
      step_up_percent: percent, step_up_month: month, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setMessage(error.message.includes("step_up") ? "Run supabase/migrations/202611260021_step_up_plan.sql in Supabase first." : error.message); return; }
    setMessage(`✓ Saved. Every ${MONTHS[month - 1]} we’ll remind you to raise your investment by ${percent}%.`);
    onSaved(percent, month);
  }

  if (monthlyInvestment <= 0 || target <= 0) return null;
  return (
    <section className="stepup-card">
      <p className="eyebrow"><CalendarClock size={14} /> YOUR ANNUAL STEP-UP{active ? " · ACTIVE ✓" : ""}</p>
      <h2>Raise your investment a little every year</h2>
      <p className="stepup-sub">Your salary grows — let your investing grow with it. This one habit often moves the freedom date by years.</p>
      <div className="stepup-controls">
        <div className="qn-chips">{[5, 10, 15, 20].map(p => <button key={p} type="button" className={percent === p ? "selected" : ""} onClick={() => setPercent(p)}>+{p}% a year</button>)}</div>
        <label className="profile-field"><span>Every year in</span><select value={month} onChange={event => setMonth(Number(event.target.value))}>{MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></label>
      </div>
      <div className="stepup-compare">
        <div><span>Same {money(monthlyInvestment)}/month forever</span><strong>{ageAt(flat)}</strong></div>
        <div className="win"><span>+{percent}% every {MONTHS[month - 1]}</span><strong>{ageAt(stepped)}</strong>{saved !== null && saved >= 0.1 && <em>🚀 {saved.toFixed(1)} years sooner</em>}</div>
      </div>
      <p className="stepup-next">Next year that’s {money(monthlyInvestment * (1 + percent / 100))}/month — just {money(monthlyInvestment * percent / 100)} more.</p>
      <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : active ? "Update my step-up plan" : <><Check size={16} /> Commit to this step-up</>}</button>
      {message && <p className="profile-status stepup-msg" role="status">{message}</p>}
      <p className="journey-note">In today’s money: a {percent}% raise with {plan.inflation_rate}% inflation counts as about {(((1 + percent / 100) / (1 + plan.inflation_rate / 100) - 1) * 100).toFixed(1)}% real growth. Illustrative only.</p>
    </section>
  );
}
