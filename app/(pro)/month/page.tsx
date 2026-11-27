"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Celebration from "@/components/game/Celebration";
import QuickLog, { QUICKLOG_CHECKIN_KEY } from "@/components/forms/QuickLog";
import { createClient } from "@/lib/supabase/client";
import { countryFromCurrency, formatCountryMoney, getCountry, type CountryCode } from "@/lib/country";
import { getInvestmentStreak } from "@/lib/fireScore";
import { parseBudgetCsv, transactionFingerprint, type ParsedBudgetRow } from "@/lib/budgetCsv";
import { categorySums, MONTH_CATEGORIES, MONTH_TOTAL_NOTE, monthSummary, planCategoryWrites, spendingTotal, type Entry, type MonthCategory } from "@/lib/monthLog";

type Form = { takeHome: string; salaryPf: string; salaryPension: string; investmentIncome: string; spentTotal: string; invested: string; emis: string; note: string };
const emptyForm: Form = { takeHome: "", salaryPf: "0", salaryPension: "0", investmentIncome: "0", spentTotal: "", invested: "", emis: "", note: "" };
const n = (v: string) => Math.max(0, Number(v || 0));
const monthOf = (offset = 0, base?: string) => { const d = base ? new Date(`${base}T12:00:00`) : new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const todayIso = () => new Date().toLocaleDateString("en-CA");

/** One amount field with the currency symbol. */
function Amount({ label, hint, value, onChange, symbol }: { label: string; hint?: string; value: string; onChange: (v: string) => void; symbol: string }) {
  return <label className="tm-field"><span>{label}{hint && <small>{hint}</small>}</span><div className="tm-amount"><i>{symbol}</i><input type="number" inputMode="numeric" min={0} step="any" placeholder="0" value={value} onChange={e => onChange(e.target.value)} /></div></label>;
}

export default function ThisMonthPage() {
  const [month, setMonth] = useState(monthOf());
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState<CountryCode>("IN");
  const [form, setForm] = useState<Form>(emptyForm);
  const [mode, setMode] = useState<"total" | "category">("total");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [typed, setTyped] = useState<Partial<Record<MonthCategory, string>>>({});
  const [limits, setLimits] = useState<Partial<Record<MonthCategory, number>>>({});
  const [limitDraft, setLimitDraft] = useState<Partial<Record<MonthCategory, string>>>({});
  const [editLimits, setEditLimits] = useState(false);
  const [limitsFrom, setLimitsFrom] = useState<string | null>(null);
  const [prevSums, setPrevSums] = useState<ReturnType<typeof categorySums> | null>(null); // last month, for ▲/▼
  const [trackColumn, setTrackColumn] = useState(false); // migration 0029 applied?
  const [usualSpent, setUsualSpent] = useState(0); // average of up to 3 earlier months (or the profile), to spot half-logged months // month the shown limits were set in
  const [logged, setLogged] = useState(false);
  const [history, setHistory] = useState<{ month_start: string; invested: number }[]>([]);
  const [salaryColumns, setSalaryColumns] = useState(false);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const [entry, setEntry] = useState({ amount: "", category: "groceries" as MonthCategory, note: "", date: todayIso() });
  const [importRows, setImportRows] = useState<ParsedBudgetRow[]>([]);
  const [importNote, setImportNote] = useState("");

  const country = getCountry(code);
  const money = (v: number) => formatCountryMoney(Math.round(v), code);
  const set = (key: keyof Form) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  const loadEntries = useCallback(async (uid: string, m: string) => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase.from("budget_transactions").select("id, spent_on, category, amount, note").eq("user_id", uid).eq("month_start", m).order("spent_on", { ascending: false });
    setEntries(((data ?? []) as Entry[]).map(e => ({ ...e, amount: Number(e.amount), note: e.note ?? "" })));
  }, []);

  const load = useCallback(async (m: string) => {
    setLoading(true); setMessage(""); setTyped({}); setEditLimits(false);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setUserId(null); return; }
      const uid = session.user.id;
      setUserId(uid);
      const [checkins, profile, loans, monthEntries, budgets, prevEntries] = await Promise.all([
        supabase.from("monthly_checkins").select("*").eq("user_id", uid).order("month_start", { ascending: false }).limit(24),
        supabase.from("financial_profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("financial_accounts").select("monthly_payment").eq("user_id", uid).eq("kind", "liability"),
        supabase.from("budget_transactions").select("id, spent_on, category, amount, note").eq("user_id", uid).eq("month_start", m).order("spent_on", { ascending: false }),
        supabase.from("monthly_budgets").select("month_start, category, target_amount").eq("user_id", uid).lte("month_start", m).order("month_start", { ascending: false }).limit(40),
        supabase.from("budget_transactions").select("id, spent_on, category, amount, note").eq("user_id", uid).eq("month_start", monthOf(-1, m)),
      ]);
      const prevList = ((prevEntries.data ?? []) as Entry[]).map(e => ({ ...e, amount: Number(e.amount), note: e.note ?? "" }));
      setPrevSums(prevList.length ? categorySums(prevList) : null);
      const rows = checkins.data ?? [];
      setHistory(rows.map(r => ({ month_start: r.month_start, invested: Number(r.invested) })));
      setCode(countryFromCurrency(profile.data?.currency));
      setSalaryColumns(Boolean(profile.data && "monthly_salary_pf" in profile.data));
      const list = ((monthEntries.data ?? []) as Entry[]).map(e => ({ ...e, amount: Number(e.amount), note: e.note ?? "" }));
      setEntries(list);
      // Limits: this month's, else carried over from the latest month that has them.
      const latest = (budgets.data ?? [])[0]?.month_start;
      setLimitsFrom(latest ?? null);
      setLimits(Object.fromEntries((budgets.data ?? []).filter(b => b.month_start === latest && Number(b.target_amount) > 0).map(b => [b.category, Number(b.target_amount)])));

      const current = rows.find(r => r.month_start === m);
      const before = rows.find(r => r.month_start < m);
      const earlier = rows.filter(r => r.month_start < m).slice(0, 3);
      setUsualSpent(earlier.length ? earlier.reduce((s, r) => s + Number(r.expenses), 0) / earlier.length : Number(profile.data?.monthly_expenses ?? 0));
      const emis = (loans.data ?? []).reduce((s, r) => s + Number(r.monthly_payment), 0);
      const p = profile.data;
      setLogged(Boolean(current));
      let next: Form;
      if (current) {
        next = { takeHome: String(current.income), salaryPf: String(current.salary_pf ?? 0), salaryPension: String(current.salary_pension ?? 0), investmentIncome: String(current.investment_income ?? 0), spentTotal: String(current.expenses), invested: String(current.invested), emis: String(current.debt_paid), note: current.note ?? "" };
        setSource(`You already logged ${new Date(`${m}T12:00:00`).toLocaleDateString("en-IN", { month: "long" })}. Change anything and save again.`);
      } else if (before) {
        next = { ...emptyForm, takeHome: String(before.income), salaryPf: String(before.salary_pf ?? 0), salaryPension: String(before.salary_pension ?? 0), investmentIncome: String(before.investment_income ?? 0), invested: String(before.invested), emis: String(before.debt_paid) };
        setSource("Income, investing and EMIs are pre-filled from last month. Just add this month’s spending.");
      } else {
        next = { ...emptyForm, takeHome: p?.monthly_income ? String(p.monthly_income) : "", salaryPf: String(p?.monthly_salary_pf ?? 0), salaryPension: String(p?.monthly_salary_pension ?? 0), investmentIncome: String(p?.monthly_investment_income ?? 0), invested: p?.monthly_investment ? String(p.monthly_investment) : "", emis: emis ? String(emis) : "" };
        setSource(p ? "Pre-filled from your profile. Check each number." : "");
      }
      // Numbers handed over from Quick log on Home.
      try {
        const raw = window.sessionStorage.getItem(QUICKLOG_CHECKIN_KEY);
        if (raw) {
          window.sessionStorage.removeItem(QUICKLOG_CHECKIN_KEY);
          const saved = JSON.parse(raw) as { month: string; fields: Record<string, number> };
          if (saved.month === m) { next = applyFields(next, saved.fields); setSource("✨ Filled from your quick log. Check the rest and save the month."); }
        }
      } catch { /* storage unavailable */ }
      setForm(next);
      // The person's saved choice wins; otherwise guess from whether they already have category entries.
      const track = profile.data?.track_budget;
      setTrackColumn(Boolean(profile.data && "track_budget" in profile.data));
      setMode(track === true ? "category" : track === false ? "total" : spendingTotal(categorySums(list)) > 0 ? "category" : "total");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load this month."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(month); }, [month, load]);

  function applyFields(f: Form, fields: Record<string, number>): Form {
    const map: Record<string, keyof Form> = { income: "takeHome", salary_pf: "salaryPf", salary_pension: "salaryPension", investment_income: "investmentIncome", expenses: "spentTotal", invested: "invested", debt_paid: "emis" };
    const next = { ...f };
    for (const [k, v] of Object.entries(fields)) if (map[k] && typeof v === "number") next[map[k]] = String(v);
    return next;
  }

  const sums = useMemo(() => categorySums(entries), [entries]);
  const shown = (c: MonthCategory) => (typed[c] !== undefined ? n(typed[c]!) : sums[c].total);
  const categoryTotal = MONTH_CATEGORIES.reduce((s, c) => s + shown(c.id), 0);
  const prevTotal = prevSums ? spendingTotal(prevSums) : 0;
  const spent = mode === "category" ? categoryTotal : n(form.spentTotal);
  const summary = monthSummary({ takeHome: n(form.takeHome), salaryPf: n(form.salaryPf), salaryPension: n(form.salaryPension), spent, invested: n(form.invested), emis: n(form.emis) });
  const monthName = new Date(`${month}T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const isCurrent = month === monthOf();
  const individual = entries.filter(e => e.note !== MONTH_TOTAL_NOTE && MONTH_CATEGORIES.some(c => c.id === e.category));
  const otherEntries = entries.filter(e => !MONTH_CATEGORIES.some(c => c.id === e.category));

  async function saveMonth() {
    const supabase = createClient();
    if (!supabase || !userId) return;
    if (n(form.takeHome) <= 0) { setMessage("Add what reached your bank this month first."); return; }
    setSaving(true); setMessage("");
    try {
      if (mode === "category") {
        const typedNumbers = Object.fromEntries(Object.entries(typed).map(([k, v]) => [k, v === "" ? 0 : n(v!)])) as Partial<Record<MonthCategory, number>>;
        const { writes } = planCategoryWrites(sums, typedNumbers);
        for (const w of writes) {
          const op = w.amount === 0 && w.existingId ? supabase.from("budget_transactions").delete().eq("id", w.existingId)
            : w.existingId ? supabase.from("budget_transactions").update({ amount: w.amount }).eq("id", w.existingId)
              : w.amount > 0 ? supabase.from("budget_transactions").insert({ user_id: userId, spent_on: month, month_start: month, category: w.category, amount: w.amount, note: MONTH_TOTAL_NOTE }) : null;
          if (op) { const { error } = await op; if (error) throw error; }
        }
      }
      const salaryChanged = n(form.salaryPf) + n(form.salaryPension) > 0;
      const { error } = await supabase.from("monthly_checkins").upsert({
        user_id: userId, month_start: month, income: n(form.takeHome), investment_income: Math.min(n(form.investmentIncome), n(form.takeHome)), expenses: spent, invested: n(form.invested), debt_paid: n(form.emis), note: form.note.trim().slice(0, 500), updated_at: new Date().toISOString(),
        ...(salaryColumns || salaryChanged ? { salary_pf: n(form.salaryPf), salary_pension: n(form.salaryPension) } : {}),
      }, { onConflict: "user_id,month_start" });
      if (error) throw /salary_p/.test(error.message) ? new Error("Run supabase/migrations/202611260026_salary_savings.sql in Supabase to save EPF/NPS.") : error;
      if (salaryColumns && isCurrent) await supabase.from("financial_profiles").update({ monthly_salary_pf: n(form.salaryPf), monthly_salary_pension: n(form.salaryPension) }).eq("user_id", userId);
      const streak = getInvestmentStreak([{ month_start: month, invested: n(form.invested) }, ...history.filter(h => h.month_start !== month)]);
      setCelebrate({ title: logged ? `${monthName.split(" ")[0]} updated ✓` : `${monthName.split(" ")[0]} logged! +60 XP`, detail: `${Math.round(summary.savingsRate)}% savings rate this month.${streak > 0 ? ` 🔥 ${streak}-month investing streak.` : ""} Your score and freedom date are updated on Home.` });
      await load(month);
    } catch (e) { setMessage(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "Could not save.")); }
    finally { setSaving(false); }
  }

  /** Limits are saved on their own (not with the month), from this month onwards; later months reuse them until changed. */
  async function saveLimits() {
    const supabase = createClient();
    if (!supabase || !userId) return;
    const next = Object.fromEntries(MONTH_CATEGORIES.map(c => [c.id, n(limitDraft[c.id] ?? String(limits[c.id] ?? 0))])) as Record<MonthCategory, number>;
    const { error } = await supabase.from("monthly_budgets").upsert(MONTH_CATEGORIES.map(c => ({ user_id: userId, month_start: month, category: c.id, target_amount: next[c.id], updated_at: new Date().toISOString() })), { onConflict: "user_id,month_start,category" });
    if (error) { setMessage(error.message); return; }
    setLimits(Object.fromEntries(Object.entries(next).filter(([, v]) => v > 0)));
    setLimitsFrom(month); setEditLimits(false); setLimitDraft({});
  }
  const draftAll = (fn: (c: MonthCategory) => number) => setLimitDraft(Object.fromEntries(MONTH_CATEGORIES.map(c => [c.id, String(Math.max(0, Math.round(fn(c.id) / 100) * 100))])));

  /** Remember whether this person tracks a category budget (also shows/hides budget charts on Trends). */
  async function chooseMode(next: "total" | "category") {
    setMode(next);
    const supabase = createClient();
    if (supabase && userId && trackColumn) await supabase.from("financial_profiles").update({ track_budget: next === "category" }).eq("user_id", userId);
  }

  async function addEntry() {
    const supabase = createClient();
    if (!supabase || !userId || n(entry.amount) <= 0) return;
    const { error } = await supabase.from("budget_transactions").insert({ user_id: userId, spent_on: entry.date, month_start: `${entry.date.slice(0, 7)}-01`, category: entry.category, amount: n(entry.amount), note: entry.note.trim().slice(0, 200) });
    if (error) { setMessage(error.message); return; }
    setEntry(e => ({ ...e, amount: "", note: "" }));
    setTyped(t => { const next = { ...t }; delete next[entry.category]; return next; });
    await loadEntries(userId, month);
  }

  async function removeEntry(id: string) {
    const supabase = createClient();
    if (!supabase || !userId) return;
    const { error } = await supabase.from("budget_transactions").delete().eq("id", id);
    if (error) setMessage(error.message); else await loadEntries(userId, month);
  }

  async function previewCsv(file?: File) {
    setImportRows([]); setImportNote("");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setImportNote("Choose a CSV under 2 MB."); return; }
    try { const parsed = parseBudgetCsv(await file.text()); setImportRows(parsed.rows); setImportNote(`${parsed.rows.length} rows ready${parsed.errors.length ? `; ${parsed.errors.length} need correction` : ""}.`); }
    catch (e) { setImportNote(e instanceof Error ? e.message : "Could not read this CSV."); }
  }

  async function importCsv() {
    const supabase = createClient();
    if (!supabase || !userId || !importRows.length) return;
    const dates = importRows.map(r => r.spent_on).sort();
    const { data: existing } = await supabase.from("budget_transactions").select("spent_on, category, amount, note").eq("user_id", userId).gte("spent_on", dates[0]).lte("spent_on", dates.at(-1)!);
    const seen = new Set((existing ?? []).map(r => transactionFingerprint({ ...r, amount: Number(r.amount) })));
    const fresh = importRows.filter(r => { const k = transactionFingerprint(r); if (seen.has(k)) return false; seen.add(k); return true; });
    for (let i = 0; i < fresh.length; i += 100) {
      const { error } = await supabase.from("budget_transactions").insert(fresh.slice(i, i + 100).map(({ spent_on, category, amount, note }) => ({ user_id: userId, spent_on, month_start: `${spent_on.slice(0, 7)}-01`, category, amount, note })));
      if (error) { setImportNote(error.message); return; }
    }
    setImportNote(`Imported ${fresh.length} entries (${importRows.length - fresh.length} duplicates skipped).`);
    setImportRows([]);
    await loadEntries(userId, month);
    if (fresh.length) setMode("category");
  }

  return <><Header /><main className="month-page container">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    <div className="tm-top">
      <div><p className="eyebrow"><CalendarDays size={14} /> THIS MONTH</p><h1>Your money in {monthName.split(" ")[0]}</h1><p>Everything for the month in one place: what came in, what went out, and what you invested.</p></div>
      <div className="tm-switch" role="group" aria-label="Choose month">
        <button type="button" onClick={() => setMonth(m => monthOf(-1, m))} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <strong>{monthName}</strong>
        <button type="button" onClick={() => setMonth(m => monthOf(1, m))} disabled={isCurrent} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
    </div>

    {loading ? <p className="profile-status">Loading {monthName}…</p> : !userId ? <section className="profile-card"><p>Sign in to log your month.</p><Link href="/" className="button button-primary">Return home to sign in</Link></section> : <>
      {isCurrent && <QuickLog compact onSaved={() => void loadEntries(userId, month)} onCheckinFields={fields => setForm(f => applyFields(f, fields as Record<string, number>))} onSpends={mode === "total" ? sum => setForm(f => ({ ...f, spentTotal: String(n(f.spentTotal) + sum) })) : undefined} />}
      {source && <p className="tm-source">{source}</p>}
      {message && <p className="delete-error" role="alert">{message}</p>}

      <section className="tm-card">
        <h2>💰 Money in</h2>
        <div className="tm-grid">
          <Amount label="Reached your bank" hint="Take-home salary + any other money received" value={form.takeHome} onChange={set("takeHome")} symbol={country.symbol} />
          <Amount label={code === "AE" ? "Workplace savings from salary" : "EPF / VPF from salary"} hint="Your + employer’s share (payslip)" value={form.salaryPf} onChange={set("salaryPf")} symbol={country.symbol} />
          <Amount label={code === "AE" ? "Pension from salary" : "NPS from salary"} hint="Your + employer’s share (payslip)" value={form.salaryPension} onChange={set("salaryPension")} symbol={country.symbol} />
          <Amount label="Of which: investment income" hint="Dividends, interest, rent (already in “reached your bank”)" value={form.investmentIncome} onChange={set("investmentIncome")} symbol={country.symbol} />
        </div>
      </section>

      <section className="tm-card">
        <div className="tm-card-head"><h2>🛒 Spending</h2>
          <div className="tr-range tm-mode" role="group" aria-label="How to log spending">{([["total", "Just a total"], ["category", "By category (budget)"]] as const).map(([id, label]) => <button key={id} type="button" className={mode === id ? "on" : ""} aria-pressed={mode === id} onClick={() => void chooseMode(id)}>{label}</button>)}</div>
        </div>
        <p className="tm-help">Everything you spent except investing and loan EMIs (those come next).</p>
        {mode === "total" ? <>
          <div className="tm-grid one"><Amount label="Total spent this month" value={form.spentTotal} onChange={set("spentTotal")} symbol={country.symbol} /></div>
          {categoryTotal > 0 && Math.abs(categoryTotal - n(form.spentTotal)) > 1 && <p className="import-warning">Your categories add up to {money(categoryTotal)}. <button type="button" className="text-link tm-inline" onClick={() => setMode("category")}>Use categories instead</button></p>}
          <p className="tm-hint">Want to see where your money goes, with limits and charts? Switch to <b>By category (budget)</b>. FIREpath remembers your choice.</p>
        </> : <>
          <div className="tm-limits-bar">
            <p>{editLimits ? "Set a monthly limit for any category you want to watch. Leave blank for no limit. Limits apply from this month and carry forward until you change them." : Object.keys(limits).length ? <>Monthly limits {limitsFrom && limitsFrom !== month ? <>carried over from <b>{new Date(`${limitsFrom}T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b></> : "set for this month"}. Prices rise every year, so review them now and then.</> : "Optional: set monthly limits to see how much is left in each category."}</p>
            {!editLimits && <button type="button" className="button button-secondary tm-edit-limits" onClick={() => { setEditLimits(true); setLimitDraft({}); }}>✏️ {Object.keys(limits).length ? "Edit limits" : "Set limits"}</button>}
          </div>
          {editLimits && <div className="tm-limit-tools">
            <button type="button" onClick={() => draftAll(c => (limits[c] ?? 0) * 1.06)} disabled={!Object.keys(limits).length}>📈 +6% for inflation</button>
            <button type="button" onClick={() => draftAll(c => shown(c))}>🧾 Use this month’s spending</button>
            <button type="button" onClick={() => draftAll(() => 0)}>✕ Clear all</button>
          </div>}
          <div className="tm-cat tm-cat-headings" aria-hidden="true"><span>Category</span><span>Spent this month</span><span>{editLimits ? "Monthly limit" : "Limit"}</span></div>
          <div className="tm-cats">{MONTH_CATEGORIES.map(c => {
            const value = shown(c.id), limit = limits[c.id] ?? 0, sum = sums[c.id];
            const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
            return <div key={c.id} className="tm-cat">
              <span className="tm-cat-name">{c.emoji} {c.label}{sum.count > 0 && <small>{money(sum.fromEntries)} from {sum.count} entr{sum.count === 1 ? "y" : "ies"}</small>}</span>
              <div className="tm-amount small"><i>{country.symbol}</i><input type="number" inputMode="numeric" min={0} step="any" placeholder="0" value={typed[c.id] ?? (value ? String(value) : "")} onChange={e => setTyped(t => ({ ...t, [c.id]: e.target.value }))} aria-label={`${c.label} this month`} /></div>
              {editLimits ? <div className="tm-amount small limit"><i>max</i><input type="number" inputMode="numeric" min={0} step="any" placeholder="no limit" value={limitDraft[c.id] ?? (limits[c.id] ? String(limits[c.id]) : "")} onChange={e => setLimitDraft(d => ({ ...d, [c.id]: e.target.value }))} aria-label={`${c.label} monthly limit`} /></div>
                : limit > 0 ? <button type="button" className={`tm-limit${value > limit ? " over" : ""}`} onClick={() => { setEditLimits(true); setLimitDraft({}); }} aria-label={`${c.label}: limit ${money(limit)}. Tap to change`}><span style={{ width: `${pct}%` }} /><small>{value > limit ? `${money(value - limit)} over` : `${money(limit - value)} left`} of {money(limit)} ✏️</small></button> : <button type="button" className="tm-add-limit" onClick={() => { setEditLimits(true); setLimitDraft({}); }}>+ limit</button>}
              {typed[c.id] !== undefined && n(typed[c.id]!) < sum.fromEntries && <small className="tm-warn">Your entries already add up to {money(sum.fromEntries)}.</small>}
            </div>;
          })}</div>
          <div className="tm-cat-foot"><strong>Total spent: {money(categoryTotal)}</strong>{editLimits && <span className="tm-limit-actions"><button type="button" className="text-link tm-inline" onClick={() => { setEditLimits(false); setLimitDraft({}); }}>Cancel</button><button type="button" className="button button-primary" onClick={() => void saveLimits()}>Save limits</button></span>}</div>

          <details className="tm-entries" open={individual.length > 0 && individual.length <= 6}>
            <summary>Individual spends ({individual.length})</summary>
            <div className="tm-add">
              <input type="number" inputMode="numeric" min={0} step="any" placeholder="Amount" value={entry.amount} onChange={e => setEntry(x => ({ ...x, amount: e.target.value }))} aria-label="Amount" />
              <select value={entry.category} onChange={e => setEntry(x => ({ ...x, category: e.target.value as MonthCategory }))} aria-label="Category">{MONTH_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <input placeholder="What for? (optional)" maxLength={200} value={entry.note} onChange={e => setEntry(x => ({ ...x, note: e.target.value }))} aria-label="Note" />
              <input type="date" value={entry.date} max={todayIso()} min={month} onChange={e => setEntry(x => ({ ...x, date: e.target.value }))} aria-label="Date" />
              <button type="button" className="button button-secondary" disabled={n(entry.amount) <= 0} onClick={() => void addEntry()}>Add</button>
            </div>
            {individual.map(e => <div key={e.id} className="tm-entry"><time>{e.spent_on.slice(8)}/{e.spent_on.slice(5, 7)}</time><span>{e.note || MONTH_CATEGORIES.find(c => c.id === e.category)?.label}</span><em>{MONTH_CATEGORIES.find(c => c.id === e.category)?.label}</em><b>{money(e.amount)}</b><button type="button" className="icon-button danger" onClick={() => void removeEntry(e.id)} aria-label={`Remove ${e.note || "entry"}`}><Trash2 size={14} /></button></div>)}
            {otherEntries.length > 0 && <p className="tm-hint">{otherEntries.length} older “savings/EMI” budget entr{otherEntries.length === 1 ? "y isn’t" : "ies aren’t"} counted as spending; investing and EMIs have their own boxes below.</p>}
          </details>
          <details className="tm-entries"><summary><Upload size={13} /> Import a bank statement (CSV)</summary>
            <p className="tm-hint">Columns: date (YYYY-MM-DD), category, amount, note. The file stays on your device until you confirm.</p>
            <input type="file" accept=".csv,text/csv" onChange={e => void previewCsv(e.target.files?.[0])} />
            {importNote && <p className="tm-hint">{importNote}</p>}
            {importRows.length > 0 && <button type="button" className="button button-primary" onClick={() => void importCsv()}>Import {importRows.length} rows</button>}
          </details>
        </>}
      </section>

      <section className="tm-card">
        <h2>📈 Investing &amp; EMIs</h2>
        <div className="tm-grid">
          <Amount label="Invested from your bank" hint="SIPs, stocks, PPF, extra NPS. Not salary EPF/NPS" value={form.invested} onChange={set("invested")} symbol={country.symbol} />
          <Amount label="Loan EMIs & card payments" hint="Home, car, personal, gold loans, credit card" value={form.emis} onChange={set("emis")} symbol={country.symbol} />
        </div>
      </section>

      {mode === "category" && categoryTotal > 0 && (() => {
        // Where the month's money went: one bar per category (spending colour), limit as a tick, change vs last month.
        const bars = MONTH_CATEGORIES.map(c => ({ ...c, value: shown(c.id), limit: limits[c.id] ?? 0, prev: prevSums ? prevSums[c.id].total : 0 })).filter(b => b.value > 0 || b.limit > 0).sort((a, b) => b.value - a.value);
        const max = Math.max(...bars.map(b => Math.max(b.value, b.limit)), 1);
        return <section className="tm-card tm-chart">
          <div className="tm-card-head"><h2>📊 Where {monthName.split(" ")[0]}’s money went</h2><small>{money(categoryTotal)} spent{prevTotal > 0 ? ` · ${categoryTotal >= prevTotal ? "▲" : "▼"} ${money(Math.abs(categoryTotal - prevTotal))} vs last month` : ""}</small></div>
          <ul className="tm-bars">{bars.map(b => <li key={b.id}>
            <span className="tm-bar-name">{b.emoji} {b.label}</span>
            <span className="tm-bar-track">
              <i className={b.limit > 0 && b.value > b.limit ? "over" : ""} style={{ width: `${(b.value / max) * 100}%` }} />
              {b.limit > 0 && <em style={{ left: `${(b.limit / max) * 100}%` }} title={`Limit ${money(b.limit)}`} />}
            </span>
            <b>{money(b.value)}</b>
            <small>{b.limit > 0 ? (b.value > b.limit ? `${money(b.value - b.limit)} over limit` : `${Math.round((b.value / b.limit) * 100)}% of limit`) : ""}{prevSums && b.prev > 0 ? `${b.limit > 0 ? " · " : ""}${b.value >= b.prev ? "▲" : "▼"} ${money(Math.abs(b.value - b.prev))}` : ""}</small>
          </li>)}</ul>
          <p className="tm-hint">Orange bars: spent this month. Dark tick: your limit{prevSums ? ". ▲/▼: change vs last month" : ""}. Red: over the limit.</p>
        </section>;
      })()}

      <section className="tm-card tm-summary">
        <h2>✅ {monthName.split(" ")[0]} at a glance</h2>
        <div className="qn-mini-summary">
          <div><span>Reached your bank</span><b>{money(n(form.takeHome))}</b></div>
          {summary.fromSalary > 0 && <div><span>Saved from salary</span><b>{money(summary.fromSalary)}</b></div>}
          <div><span>Spent</span><b>{money(spent)}</b></div>
          <div><span>Invested</span><b>{money(n(form.invested))}</b></div>
          <div><span>EMIs</span><b>{money(n(form.emis))}</b></div>
          <div className="left"><span>Left in bank</span><b>{money(summary.leftInBank)}</b></div>
        </div>
        {usualSpent > 0 && spent < usualSpent * 0.5 && <p className="import-warning">🤔 Spending of {money(spent)} is much lower than your usual {money(usualSpent)}. Did you log everything (rent, bills, groceries, shopping)? A half-logged month makes your savings rate look higher than it is.</p>}
        {summary.earned > 0 && <p className="qn-rate-line">Savings rate: <b>{Math.round(summary.savingsRate)}%</b>{summary.fromSalary > 0 ? ` of ${money(summary.earned)} earned (incl. EPF/NPS)` : ""}{summary.leftInBank < 0 ? " · more went out than came in this month" : ""}</p>}
        <label className="tm-field"><span>A note to future you (optional)</span><textarea rows={2} maxLength={500} value={form.note} placeholder="e.g. Diwali shopping, bonus month, new SIP started" onChange={e => set("note")(e.target.value)} /></label>
        <button type="button" className="button button-primary tm-save" disabled={saving || n(form.takeHome) <= 0} onClick={() => void saveMonth()}>{saving ? "Saving…" : logged ? `Update ${monthName.split(" ")[0]}` : `Save ${monthName.split(" ")[0]} (+60 XP)`}</button>
      </section>
    </>}
  </main><Footer /></>;
}
