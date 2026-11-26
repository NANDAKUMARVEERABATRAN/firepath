"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { amountInWords } from "@/lib/format";
import { useCountry } from "@/lib/useCountry";

export type Step = {
  id: string;
  emoji: string;
  title: string;
  subtitle?: string;
  body: ReactNode;
  valid?: boolean;
  feedback?: string | null;
  error?: string | null;
};

type Props = { steps: Step[]; finishLabel: string; onFinish: () => void; saving?: boolean; footer?: ReactNode; startAt?: number };

/** One question per screen with progress, Enter-to-continue, back, and friendly feedback. */
export default function StepFlow({ steps, finishLabel, onFinish, saving, footer, startAt = 0 }: Props) {
  const [index, setIndex] = useState(startAt);
  const ref = useRef<HTMLFormElement>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const canNext = step.valid !== false && !step.error;

  useEffect(() => { ref.current?.querySelector<HTMLInputElement>("input, select, button.qn-choice")?.focus(); }, [index]);

  return (
    <form ref={ref} className="qn-card" key={step.id} onSubmit={event => { event.preventDefault(); if (!canNext) return; if (last) onFinish(); else setIndex(i => i + 1); }}>
      <div className="qn-progress"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
      <p className="qn-count">Step {index + 1} of {steps.length}</p>
      <div className="qn-emoji" aria-hidden="true">{step.emoji}</div>
      <h1>{step.title}</h1>
      {step.subtitle && <p className="qn-sub">{step.subtitle}</p>}
      {step.body}
      {step.error ? <p className="qn-error">{step.error}</p> : step.feedback ? <p className="qn-feedback"><Sparkles size={15} /> {step.feedback}</p> : null}
      <div className="qn-actions">
        {index > 0 ? <button type="button" className="qn-back" onClick={() => setIndex(i => i - 1)}><ArrowLeft size={16} /> Back</button> : <span />}
        <button type="submit" className="button button-primary" disabled={!canNext || saving}>{last ? (saving ? "Saving…" : finishLabel) : <>Continue <ArrowRight size={16} /></>}</button>
      </div>
      {footer}
    </form>
  );
}

/** Big rupee input with amount-in-words and one-tap chips. */
export function MoneyInput({ value, onChange, chips, placeholder = "0" }: { value: string; onChange: (value: string) => void; chips?: { label: string; value: number }[]; placeholder?: string }) {
  const amount = Math.max(0, Number(value || 0));
  const { country } = useCountry();
  return <>
    <div className="qn-input money"><span>{country.symbol}</span><input type="number" inputMode="numeric" min={0} step="any" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></div>
    {amount > 0 && <p className="qn-words">= {amountInWords(amount, country.code)} {country.code === "IN" ? "rupees" : "dirhams"}</p>}
    {chips && <div className="qn-chips">{chips.map(chip => <button key={chip.label} type="button" className={value !== "" && amount === chip.value ? "selected" : ""} onClick={() => onChange(String(chip.value))}>{chip.label}</button>)}</div>}
  </>;
}
