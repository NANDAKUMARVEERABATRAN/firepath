"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";
import Celebration from "@/components/game/Celebration";
import { ProLock, usePro } from "@/components/pro/ProContext";
import { createClient } from "@/lib/supabase/client";
import { countryFromCurrency, formatCountryMoney, type CountryCode } from "@/lib/country";
import { holdingToAccount, matchAccount, SPEND_CATEGORIES, type CheckinFields, type QuickLogResult, type SpendCategory } from "@/lib/quickLog";

export const QUICKLOG_CHECKIN_KEY = "ff-quicklog-checkin";

type Account = { id: string; name: string; kind: string; category: string; investment_type: string | null; current_value: number };
const CHECKIN_LABELS: Record<keyof CheckinFields, string> = { income: "Reached your bank", salary_pf: "EPF / VPF from salary", salary_pension: "NPS from salary", investment_income: "Investment income", expenses: "Total spent this month", invested: "Invested from bank", debt_paid: "Loan EMIs paid" };
const CATEGORY_LABELS: Record<SpendCategory, string> = { housing: "Housing", utilities: "Utilities", groceries: "Groceries", dining: "Dining out", transport: "Transport", healthcare: "Healthcare", insurance: "Insurance", education: "Education", family: "Family", debt_repayment: "Debt payments", personal: "Personal & shopping", other: "Other" };
const EXAMPLES = ["Salary 1.2 lakh aaya, PF 7,200 kata, rent 25,000, SIP 25,000", "Swiggy 1,800, petrol 3,000, electricity bill 2,400", "PPF balance 3.2 lakh, home loan outstanding 24 lakh"];
const today = () => new Date().toLocaleDateString("en-CA");
const monthStart = (date = today()) => `${date.slice(0, 7)}-01`;

type SpeechCtor = new () => { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

/** "Tell FIREpath in one line": AI turns a sentence into check-in fields, spending entries and balances to review. */
export default function QuickLog({ compact = false, onSaved, onCheckinFields, onSpends }: { compact?: boolean; onSaved?: () => void; /** On the This month page: put check-in numbers into the form instead of saving them. */ onCheckinFields?: (fields: Partial<Record<keyof CheckinFields, number>>) => void; /** Not tracking a category budget: add spends to the month's total instead of saving entries. */ onSpends?: (total: number) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuickLogResult | null>(null);
  const [code, setCode] = useState<CountryCode>("IN");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [checkinExists, setCheckinExists] = useState(false);
  const [currentCheckin, setCurrentCheckin] = useState<Record<string, number>>({});
  const [pickCheckin, setPickCheckin] = useState<Record<string, boolean>>({});
  const [pickSpend, setPickSpend] = useState<boolean[]>([]);
  const [pickHolding, setPickHolding] = useState<boolean[]>([]);
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState<"ai" | "basic">("ai");
  const recognition = useRef<InstanceType<SpeechCtor> | null>(null);
  const money = (v: number) => formatCountryMoney(v, code);
  const { pro } = usePro();

  async function context() {
    const supabase = createClient();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const [profile, accts, checkin] = await Promise.all([
      supabase.from("financial_profiles").select("currency").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("financial_accounts").select("id, name, kind, category, investment_type, current_value").eq("user_id", session.user.id),
      supabase.from("monthly_checkins").select("*").eq("user_id", session.user.id).eq("month_start", monthStart()).maybeSingle(),
    ]);
    const country = countryFromCurrency(profile.data?.currency);
    setCode(country);
    setAccounts(((accts.data ?? []) as Account[]).map(a => ({ ...a, current_value: Number(a.current_value) })));
    setCheckinExists(Boolean(checkin.data));
    setCurrentCheckin(checkin.data ? Object.fromEntries(Object.keys(CHECKIN_LABELS).map(k => [k, Number((checkin.data as Record<string, unknown>)[k] ?? 0)])) : {});
    return { supabase, userId: session.user.id, country };
  }

  useEffect(() => () => recognition.current?.stop(), []);

  function toggleMic() {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setError("Voice isn’t supported in this browser. Try Chrome, or type instead."); return; }
    if (listening) { recognition.current?.stop(); return; }
    const rec = new Ctor();
    rec.lang = "en-IN"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = e => { const said = Array.from(e.results).map(r => r[0].transcript).join(" "); setText(current => (current ? `${current}, ${said}` : said)); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec; setListening(true); setError(""); rec.start();
  }

  async function understand() {
    if (text.trim().length < 3) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const ctx = await context();
      if (!ctx) throw new Error("Please sign in again.");
      const response = await fetch("/api/log/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, currency: ctx.country === "AE" ? "AED" : "INR" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Couldn’t understand that.");
      const r = data as QuickLogResult;
      setMode(data.mode === "basic" ? "basic" : "ai");
      setResult(r);
      setPickCheckin(Object.fromEntries(Object.entries(r.checkin).map(([k, v]) => [k, v !== null])));
      setPickSpend(r.spending.map(() => true));
      setPickHolding(r.holdings.map(() => true));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t understand that."); }
    finally { setBusy(false); }
  }

  const checkinFields = result ? (Object.entries(result.checkin) as [keyof CheckinFields, number | null][]).filter(([, v]) => v !== null) as [keyof CheckinFields, number][] : [];

  async function save() {
    if (!result) return;
    setBusy(true); setError("");
    try {
      const ctx = await context();
      if (!ctx) throw new Error("Please sign in again.");
      const { supabase, userId } = ctx;
      const done: string[] = [];
      const fields = Object.fromEntries(checkinFields.filter(([k]) => pickCheckin[k]));
      if (Object.keys(fields).length && onCheckinFields) { onCheckinFields(fields as Partial<Record<keyof CheckinFields, number>>); done.push("the month’s numbers (filled in below, save the month to keep them)"); }
      else if (Object.keys(fields).length && checkinExists) {
        const { error: e } = await supabase.from("monthly_checkins").update({ ...fields, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("month_start", monthStart());
        if (e) throw new Error(/salary_p/.test(e.message) ? "Run supabase/migrations/202611260026_salary_savings.sql in Supabase to save EPF/NPS." : e.message);
        done.push(`${Object.keys(fields).length} check-in item${Object.keys(fields).length === 1 ? "" : "s"}`);
      }
      const spends = result.spending.filter((_, i) => pickSpend[i]).map(s => { const date = s.date ?? today(); return { user_id: userId, spent_on: date, month_start: monthStart(date), category: s.category, amount: s.amount, note: s.note }; });
      if (spends.length && onSpends) { const sum = spends.reduce((s, x) => s + x.amount, 0); onSpends(sum); done.push(`${formatCountryMoney(sum, code)} added to this month’s spending (save the month to keep it)`); }
      else if (spends.length) { const { error: e } = await supabase.from("budget_transactions").insert(spends); if (e) throw e; done.push(`${spends.length} spending entr${spends.length === 1 ? "y" : "ies"}`); }
      let holdingsSaved = 0;
      for (const [i, h] of result.holdings.entries()) {
        if (!pickHolding[i]) continue;
        const match = matchAccount(h, accounts);
        const map = holdingToAccount(h.type);
        const { error: e } = match
          ? await supabase.from("financial_accounts").update({ current_value: h.value, updated_at: new Date().toISOString() }).eq("id", match.id)
          : await supabase.from("financial_accounts").insert({ user_id: userId, name: h.name, kind: map.kind, category: map.category, investment_type: map.investment_type, current_value: h.value, monthly_payment: 0, is_high_interest: h.type === "credit_card", fire_treatment: map.fire_treatment });
        if (e) throw new Error(/gold_loan/.test(e.message) ? "Run supabase/migrations/202611260027_gold_loan.sql in Supabase first." : e.message);
        holdingsSaved += 1;
      }
      if (holdingsSaved) done.push(`${holdingsSaved} portfolio balance${holdingsSaved === 1 ? "" : "s"}`);
      // No check-in yet this month: hand the numbers to Log month so the person confirms the full picture.
      if (Object.keys(fields).length && !checkinExists && !onCheckinFields) {
        try { window.sessionStorage.setItem(QUICKLOG_CHECKIN_KEY, JSON.stringify({ month: monthStart(), fields })); } catch { /* storage unavailable */ }
        window.location.href = "/month?from=quicklog";
        return;
      }
      setCelebrate({ title: "Logged ✨", detail: done.length ? `Saved ${done.join(", ")}. Your score and progress are updated.` : "Nothing was selected to save." });
      setResult(null); setText("");
      onSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save."); }
    finally { setBusy(false); }
  }

  const anyPicked = checkinFields.some(([k]) => pickCheckin[k]) || pickSpend.some(Boolean) || pickHolding.some(Boolean);

  if (!pro) return <ProLock title="Tell FIREpath in one line" text="Type or say “salary 1.2 lakh, rent 25,000, Swiggy 1,800” and it fills everything in. English, Hindi or Hinglish." />;
  return <section className={`quicklog${compact ? " compact" : ""}`}>
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    <div className="quicklog-head"><Sparkles size={18} /><div><h2>Tell FIREpath in one line</h2><p>Type or say it the way you’d text a friend. English, Hindi or Hinglish. You review before anything is saved.</p></div></div>
    <div className="quicklog-input">
      <textarea rows={compact ? 2 : 3} maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder={`e.g. ${EXAMPLES[0]}`} aria-label="Describe your money in one line" />
      <button type="button" className={`quicklog-mic${listening ? " on" : ""}`} onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak instead"}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>
    </div>
    {!result && <div className="quicklog-examples">{EXAMPLES.map(ex => <button key={ex} type="button" onClick={() => setText(ex)}>{ex}</button>)}</div>}
    <div className="quicklog-actions">
      <button type="button" className="button button-primary" disabled={busy || text.trim().length < 3} onClick={() => void understand()}><Sparkles size={15} /> {busy && !result ? "Reading…" : "Understand"}</button>
      <small>Account numbers, PAN and emails are removed before the AI sees your text.</small>
    </div>
    {error && <p className="delete-error" role="alert">{error}</p>}

    {result && <div className="quicklog-preview">
      {mode === "basic" && <p className="ql-basic">⚡ Quick mode: read on simple rules (AI wasn’t available). Check the categories before saving.</p>}
      {result.unclear.map(u => <p key={u} className="import-warning">🤔 {u}</p>)}
      {checkinFields.length > 0 && <div className="ql-block">
        <h3>This month’s check-in</h3>
        {!checkinExists && !onCheckinFields && <small className="ql-hint">You haven’t logged this month yet. We’ll open This month with these filled in so you can confirm the rest.</small>}
        {checkinFields.map(([k, v]) => <label key={k} className="ql-row"><input type="checkbox" checked={Boolean(pickCheckin[k])} onChange={e => setPickCheckin(p => ({ ...p, [k]: e.target.checked }))} /><span>{CHECKIN_LABELS[k]}</span><b>{money(v)}</b>{checkinExists && <em>was {money(currentCheckin[k] ?? 0)}</em>}</label>)}
      </div>}
      {result.spending.length > 0 && <div className="ql-block">
        <h3>{onSpends ? "Spending (added to this month’s total)" : "Spending entries (Budget)"}</h3>
        {result.spending.map((s, i) => <div key={i} className="ql-row">
          <input type="checkbox" checked={Boolean(pickSpend[i])} onChange={e => setPickSpend(p => p.map((x, j) => (j === i ? e.target.checked : x)))} aria-label={`Save ${s.note || CATEGORY_LABELS[s.category]}`} />
          <span>{s.note || CATEGORY_LABELS[s.category]}</span>
          <select value={s.category} onChange={e => setResult(r => r && { ...r, spending: r.spending.map((x, j) => (j === i ? { ...x, category: e.target.value as SpendCategory } : x)) })} aria-label="Category">{SPEND_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select>
          <b>{money(s.amount)}</b>
        </div>)}
      </div>}
      {result.holdings.length > 0 && <div className="ql-block">
        <h3>Portfolio balances</h3>
        {result.holdings.map((h, i) => { const match = matchAccount(h, accounts); return <label key={i} className="ql-row">
          <input type="checkbox" checked={Boolean(pickHolding[i])} onChange={e => setPickHolding(p => p.map((x, j) => (j === i ? e.target.checked : x)))} />
          <span>{h.name} <small>{holdingToAccount(h.type).label}</small></span>
          <b>{money(h.value)}</b>
          <em>{match ? `Update “${match.name}” (was ${money(match.current_value)})` : "Add new"}</em>
        </label>; })}
      </div>}
      <div className="quicklog-actions">
        <button type="button" className="button button-primary" disabled={busy || !anyPicked} onClick={() => void save()}>{busy ? "Saving…" : checkinFields.some(([k]) => pickCheckin[k]) && !checkinExists && !onCheckinFields ? "Save & finish the month" : "Save"}</button>
        <button type="button" className="text-link ql-cancel" onClick={() => { setResult(null); setError(""); }}>Edit text</button>
      </div>
    </div>}
  </section>;
}
