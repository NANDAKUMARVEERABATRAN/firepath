"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, CalendarDays, CircleDollarSign, PiggyBank, Trash2, Upload } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import VoiceEntry from "@/components/forms/VoiceEntry";
import QuickLog from "@/components/forms/QuickLog";
import { createClient } from "@/lib/supabase/client";
import { parseSpokenAmount } from "@/lib/voiceForms";
import { createGuidedTargets, getBudgetReview } from "@/lib/budgetGuide";
import { parseBudgetCsv, transactionFingerprint, type ParsedBudgetRow } from "@/lib/budgetCsv";

const budgetCategories = ["housing", "utilities", "groceries", "dining", "transport", "healthcare", "insurance", "education", "family", "debt_repayment", "personal", "savings", "other"] as const;
type BudgetCategory = (typeof budgetCategories)[number];
type Transaction = { id: string; spent_on: string; category: BudgetCategory; amount: number; note: string };
type MonthlyReview = { income: number; investment_income: number; expenses: number; invested: number; debt_paid: number; salary_savings: number };
const toReview = (row: Record<string, unknown>): MonthlyReview => ({ income: Number(row.income), investment_income: Number(row.investment_income ?? 0), expenses: Number(row.expenses), invested: Number(row.invested), debt_paid: Number(row.debt_paid), salary_savings: Number(row.salary_pf ?? 0) + Number(row.salary_pension ?? 0) });
const labels: Record<BudgetCategory, string> = { housing: "Housing", utilities: "Utilities", groceries: "Groceries", dining: "Dining out", transport: "Transport", healthcare: "Healthcare", insurance: "Insurance", education: "Education", family: "Family", debt_repayment: "Debt payments", personal: "Personal", savings: "Savings goal", other: "Other" };
const today = () => new Date().toLocaleDateString("en-CA");
const thisMonth = (date = today()) => `${date.slice(0, 7)}-01`;
const blankTargets = (): Record<BudgetCategory, string> => Object.fromEntries(budgetCategories.map(category => [category, "0"])) as Record<BudgetCategory, string>;

export default function BudgetPage() {
  const [month, setMonth] = useState(thisMonth());
  const [income, setIncome] = useState("");
  const [fixedCosts, setFixedCosts] = useState("");
  const [savingsGoalPercent, setSavingsGoalPercent] = useState("20");
  const [currency, setCurrency] = useState("INR");
  const [targets, setTargets] = useState(blankTargets);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyReview, setMonthlyReview] = useState<MonthlyReview | null>(null);
  const [previousReview, setPreviousReview] = useState<MonthlyReview | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<BudgetCategory>("groceries");
  const [spentOn, setSpentOn] = useState(today());
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [commitments, setCommitments] = useState({ housing: "", utilities: "", healthcare: "", insurance: "", education: "", family: "", debt_repayment: "" });
  const [importRows, setImportRows] = useState<ParsedBudgetRow[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSignedIn(false); setLoading(false); return; }
    setSignedIn(true);
    const [profileResult, budgetResult, transactionResult, checkinResult, previousCheckinResult] = await Promise.all([
      supabase.from("financial_profiles").select("monthly_income, currency").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("monthly_budgets").select("category, target_amount").eq("user_id", session.user.id).eq("month_start", month),
      supabase.from("budget_transactions").select("id, spent_on, category, amount, note").eq("user_id", session.user.id).eq("month_start", month).order("spent_on", { ascending: false }),
      supabase.from("monthly_checkins").select("*").eq("user_id", session.user.id).eq("month_start", month).maybeSingle(),
      supabase.from("monthly_checkins").select("*").eq("user_id", session.user.id).lt("month_start", month).order("month_start", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const profile = profileResult.data;
    if (profile) {
      setIncome(current => current || String(profile.monthly_income ?? ""));
      setCurrency(profile.currency ?? "INR");
    }
    if (checkinResult.data) setMonthlyReview(toReview(checkinResult.data));
    else setMonthlyReview(null);
    if (previousCheckinResult.data) setPreviousReview(toReview(previousCheckinResult.data));
    else setPreviousReview(null);
    if (budgetResult.error || transactionResult.error) {
      setMessage(`Run the monthly budget migration in Supabase, then refresh. ${budgetResult.error?.message ?? transactionResult.error?.message ?? ""}`);
    } else {
      setTargets({ ...blankTargets(), ...Object.fromEntries((budgetResult.data ?? []).map(row => [row.category, String(row.target_amount)])) } as Record<BudgetCategory, string>);
      setTransactions((transactionResult.data ?? []).map(row => ({ ...row, amount: Number(row.amount) })) as Transaction[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [month]);

  const money = (value: number) => new Intl.NumberFormat(currency === "INR" ? "en-IN" : currency === "AED" ? "en-AE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const values = useMemo(() => {
    const monthlyTargets = Object.fromEntries(budgetCategories.map(key => [key, Math.max(0, Number(targets[key]) || 0)])) as Record<BudgetCategory, number>;
    const monthlySpent = Object.fromEntries(budgetCategories.map(key => [key, transactions.filter(item => item.category === key).reduce((total, item) => total + item.amount, 0)])) as Record<BudgetCategory, number>;
    const allocated = Object.values(monthlyTargets).reduce((total, value) => total + value, 0);
    const spent = Object.values(monthlySpent).reduce((total, value) => total + value, 0);
    return { monthlyTargets, monthlySpent, allocated, spent, remaining: allocated - spent };
  }, [targets, transactions, month]);
  // Savings rate on everything earned: take-home + EPF/NPS deducted from salary (same as the FIRE score).
  const earned = (r: MonthlyReview) => ({ income: r.income + r.salary_savings, expenses: r.expenses, invested: r.invested + r.salary_savings });
  const loggedSavingsRate = monthlyReview && earned(monthlyReview).income > 0 ? ((earned(monthlyReview).income - monthlyReview.expenses) / earned(monthlyReview).income) * 100 : null;
  const reviewInsights = monthlyReview ? getBudgetReview({ targets: values.monthlyTargets, spent: values.monthlySpent, ...earned(monthlyReview), previous: previousReview ? earned(previousReview) : null }) : [];

  function createGuidedDraft() {
    try {
      const result = createGuidedTargets({ income: Number(income), savingsGoalPercent: Number(savingsGoalPercent), commitments: Object.fromEntries(Object.entries(commitments).map(([key, value]) => [key, Number(value || 0)])) });
      setTargets(Object.fromEntries(Object.entries(result.targets).map(([key, value]) => [key, String(value)])) as Record<BudgetCategory, string>);
      setAiNote(`A balanced draft is ready. It uses your fixed commitments and a ${savingsGoalPercent}% savings goal, then leaves ${money(result.remainder)} as flexible spending. Adjust categories before saving.`);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create a budget draft."); }
  }

  async function previewCsv(file?: File) {
    setImportMessage(""); setImportRows([]); setImportErrors([]);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setImportMessage("Choose a CSV under 2 MB."); return; }
    try {
      const parsed = parseBudgetCsv(await file.text());
      setImportRows(parsed.rows); setImportErrors(parsed.errors);
      setImportMessage(`${parsed.rows.length} valid row${parsed.rows.length === 1 ? "" : "s"} ready to review${parsed.errors.length ? `; ${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} need correction` : ""}.`);
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Could not read this CSV."); }
  }

  async function importCsvRows() {
    if (!importRows.length) return;
    const supabase = createClient();
    if (!supabase) return;
    setImporting(true); setImportMessage("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) { setSignedIn(false); throw new Error("Sign in to import transactions."); }
      const dates = importRows.map(row => row.spent_on).sort();
      const { data: existing, error } = await supabase.from("budget_transactions").select("spent_on, category, amount, note").eq("user_id", session.user.id).gte("spent_on", dates[0]).lte("spent_on", dates.at(-1)!);
      if (error) throw error;
      const seen = new Set((existing ?? []).map(row => transactionFingerprint({ ...row, amount: Number(row.amount) })));
      const fresh = importRows.filter(row => { const key = transactionFingerprint(row); if (seen.has(key)) return false; seen.add(key); return true; });
      if (!fresh.length) { setImportMessage("Every valid row is already in your account; nothing was added."); return; }
      const payload = fresh.map(({ spent_on, category, amount, note }) => ({ user_id: session.user.id, spent_on, month_start: thisMonth(spent_on), category, amount, note }));
      for (let index = 0; index < payload.length; index += 100) {
        const { error: insertError } = await supabase.from("budget_transactions").insert(payload.slice(index, index + 100));
        if (insertError) throw insertError;
      }
      setImportMessage(`Imported ${fresh.length} transaction${fresh.length === 1 ? "" : "s"}; skipped ${importRows.length - fresh.length} exact duplicate${importRows.length - fresh.length === 1 ? "" : "s"}.`);
      setImportRows([]); setImportErrors([]);
      await load();
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Could not import transactions."); }
    finally { setImporting(false); }
  }

  async function generateSuggestions() {
    setSuggesting(true); setMessage(""); setAiNote("");
    try {
      const response = await fetch("/api/budget/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ income: Number(income), fixedCosts: Number(fixedCosts || 0), savingsGoalPercent: Number(savingsGoalPercent), currency }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create budget suggestions.");
      setTargets(current => ({ ...current, ...Object.fromEntries(Object.entries(result.targets as Record<string, number>).map(([key, value]) => [key, String(value)])) }));
      setAiNote(result.note ?? "Review and adjust these draft targets before saving.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create budget suggestions."); }
    finally { setSuggesting(false); }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSavingTargets(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setSignedIn(false); throw new Error("Sign in to save this budget."); }
      const rows = budgetCategories.map(key => ({ user_id: session.user.id, month_start: month, category: key, target_amount: Number(targets[key] || 0), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("monthly_budgets").upsert(rows, { onConflict: "user_id,month_start,category" });
      if (error) throw error;
      setMessage("Monthly targets saved. You can change them at any time.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your budget."); }
    finally { setSavingTargets(false); }
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSavingTransaction(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setSignedIn(false); throw new Error("Sign in to save a spending entry."); }
      const { error } = await supabase.from("budget_transactions").insert({ user_id: session.user.id, spent_on: spentOn, month_start: thisMonth(spentOn), category, amount: Number(amount), note: note.trim() });
      if (error) throw error;
      setAmount(""); setNote("");
      if (thisMonth(spentOn) === month) await load();
      setMessage("Spending entry saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this entry."); }
    finally { setSavingTransaction(false); }
  }

  async function deleteTransaction(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("budget_transactions").delete().eq("id", id);
    if (error) setMessage(error.message);
    else { setTransactions(current => current.filter(item => item.id !== id)); setMessage("Spending entry removed."); }
  }

  function applyVoiceExpense(transcript: string) {
    const lower = transcript.toLowerCase();
    const amountPhrase = transcript.match(/(?:spent|paid|cost|amount|kharcha|खर्च|खर्चा)\s+(.+)/i)?.[1] ?? transcript;
    const parsedAmount = parseSpokenAmount(amountPhrase);
    const categoryMatch = budgetCategories.find(key => new RegExp(`\\b${key.replaceAll("_", "[ _-]")}\\b`).test(lower))
      ?? (/(restaurant|cafe|lunch|dinner|takeaway|takeout)/.test(lower) ? "dining" : null)
      ?? (/food|grocery|groceries|vegetables|supermarket|किराना|राशन/.test(lower) ? "groceries" : null)
      ?? (/petrol|fuel|taxi|cab|bus|train|metro|यात्रा|पेट्रोल/.test(lower) ? "transport" : null)
      ?? (/electric|water bill|internet|phone bill|बिजली|पानी का बिल/.test(lower) ? "utilities" : null)
      ?? (/restaurant|cafe|lunch|dinner|बाहर खाना|रेस्टोरेंट/.test(lower) ? "dining" : null)
      ?? (/medical|medicine|doctor|दवा|डॉक्टर|स्वास्थ्य/.test(lower) ? "healthcare" : null)
      ?? (/rent|house|housing|किराया|घर/.test(lower) ? "housing" : null)
      ?? (/school|education|fees|स्कूल|फीस/.test(lower) ? "education" : null)
      ?? (/family|parents|परिवार|माता-पिता/.test(lower) ? "family" : null);
    if (parsedAmount === null || !categoryMatch) { setMessage("Try: groceries spent 1200, kirana kharcha 1200, or किराने का खर्च 1200."); return; }
    const named = transcript.match(/\b(?:for|at)\s+(.+?)(?=\s+\b(?:spent|paid|cost|amount)\b|$)/i)?.[1]?.trim();
    setAmount(String(parsedAmount)); setCategory(categoryMatch); setNote(named || transcript.slice(0, 200));
    setMessage("Expense fields filled. Review the category, date, and amount, then add the entry.");
  }

  return <><Header /><main className="budget-page container">
    <div className="profile-heading"><p className="eyebrow"><PiggyBank size={14} /> MONTHLY BUDGET</p><h1>Give every month a plan.</h1><p>Set flexible category targets and record spending as you go. AI suggestions are drafts for you to review.</p></div>
    {!loading && signedIn && <QuickLog onSaved={() => void load()} />}
    {!loading && signedIn && <Link href="/save-more" className="saver-strip tone-ok budget-save-link"><span className="saver-strip-emoji">✂️</span><div><small>LEAK HUNTER</small><strong>Find money to invest</strong><span>Tap the spending leaks you can plug and see how much sooner you could be free.</span></div></Link>}
    {loading ? <p className="profile-status">Loading your budget…</p> : !signedIn ? <section className="profile-card"><p>Sign in to create a private monthly budget.</p><Link href="/" className="button button-primary">Return home to sign in</Link></section> : <>
      <div className="budget-toolbar"><label className="profile-field"><span>Budget month</span><input type="month" value={month.slice(0, 7)} onChange={event => event.target.value && setMonth(`${event.target.value}-01`)} /></label><p>Currency: <strong>{currency}</strong></p></div>
      <section className="budget-overview"><article><span>Monthly targets</span><strong>{money(values.allocated)}</strong></article><article><span>Recorded this month</span><strong>{money(values.spent)}</strong></article><article><span>Budget remaining</span><strong>{money(values.remaining)}</strong></article></section>
      <section className="budget-month-review"><div className="budget-section-heading"><div><p className="eyebrow">MONTHLY FIRE CHECK</p><h2>{monthlyReview ? "How this month supports your plan." : "Finish your monthly check-in."}</h2></div>{monthlyReview && <Link className="text-link" href="/dashboard">View FIRE score →</Link>}</div>{monthlyReview ? <><div className="budget-review-metrics"><article><span>Total income</span><strong>{money(monthlyReview.income)}</strong></article><article><span>Investment payouts included in income</span><strong>{money(monthlyReview.investment_income)}</strong></article><article><span>Expenses recorded</span><strong>{money(monthlyReview.expenses)}</strong></article><article><span>Invested this month</span><strong>{money(monthlyReview.invested)}</strong></article><article><span>Income remaining after expenses</span><strong>{money(monthlyReview.income - monthlyReview.expenses)}</strong></article><article><span>Savings rate used by FIRE score</span><strong>{loggedSavingsRate?.toFixed(0)}%</strong></article></div><ul className="budget-review-insights">{reviewInsights.map(insight => <li key={insight}>{insight}</li>)}</ul><p className="profile-privacy">The FIRE score uses monthly check-in totals. Category entries help explain spending patterns and are not added to the score again.</p></> : <><p className="budget-review-empty">Add the month’s total income and expenses to calculate your savings rate and refresh the related FIRE score factor.</p><Link className="button button-primary" href="/check-in">Complete monthly check-in</Link></>}</section>
      <section className="budget-ai-card"><div className="budget-ai-icon"><Bot size={20} /></div><div className="budget-ai-copy"><h2>Set up a budget in a few steps</h2><p>Start with take-home income, recurring commitments and a savings goal. The app balances a draft locally; AI suggestions are optional.</p></div><div className="budget-ai-inputs"><label className="profile-field"><span>Monthly take-home income ({currency})</span><input type="number" min="0" step="100" value={income} onChange={event => setIncome(event.target.value)} /></label><label className="profile-field"><span>Savings goal (% of income)</span><input type="number" min="0" max="80" step="1" value={savingsGoalPercent} onChange={event => setSavingsGoalPercent(event.target.value)} /></label><p className="budget-commitment-label">Regular monthly commitments ({currency})</p>{(Object.keys(commitments) as (keyof typeof commitments)[]).map(key => <label className="profile-field" key={key}><span>{labels[key as BudgetCategory]}</span><input type="number" min="0" step="100" value={commitments[key]} onChange={event => setCommitments(current => ({ ...current, [key]: event.target.value }))} /></label>)}<button className="button button-primary" type="button" onClick={createGuidedDraft} disabled={Number(income) <= 0}>Create balanced draft</button><details className="budget-ai-optional"><summary><Bot size={15} /> Optional: ask AI for a category draft</summary><p>AI suggestions are estimates. Review them before saving.</p><label className="profile-field"><span>Known fixed costs ({currency})</span><input type="number" min="0" step="100" value={fixedCosts} onChange={event => setFixedCosts(event.target.value)} /></label><button className="button button-secondary" type="button" onClick={() => void generateSuggestions()} disabled={suggesting || Number(income) <= 0}>{suggesting ? "Drafting…" : "Suggest with AI"}</button></details></div>{aiNote && <p className="budget-ai-note" role="status">{aiNote}</p>}</section>
      <form className="profile-card budget-target-form" onSubmit={saveBudget}><div className="budget-section-heading"><div><p className="eyebrow">EDITABLE TARGETS</p><h2>Monthly category targets.</h2></div><span>Recorded spending updates the remaining amount.</span></div><div className="budget-target-grid">{budgetCategories.map(key => <label className="budget-target-row" key={key}><span>{labels[key]}</span><input type="number" min="0" step="100" aria-label={`${labels[key]} monthly target`} value={targets[key]} onChange={event => setTargets(current => ({ ...current, [key]: event.target.value }))} /><small>{money(values.monthlySpent[key])} spent · {money(values.monthlyTargets[key] - values.monthlySpent[key])} left</small></label>)}</div><p className="budget-unallocated">Monthly income not assigned to targets: <strong>{money(Number(income || 0) - values.allocated)}</strong></p><button className="button button-primary" type="submit" disabled={savingTargets}>{savingTargets ? "Saving…" : "Save monthly targets"}</button></form>
      <section className="profile-card budget-spending-card"><div className="budget-section-heading"><div><p className="eyebrow"><CircleDollarSign size={14} /> RECORD SPENDING</p><h2>Keep the plan current.</h2></div></div><VoiceEntry hint="For example: groceries spent 1200, or dining lunch cost 800" hindiHint="किराने का खर्च 1200, या खाने पर खर्च 800" applyLabel="Fill expense fields" onApply={applyVoiceExpense} /><form className="budget-expense-form" onSubmit={saveTransaction}><label className="profile-field"><span>Category</span><select value={category} onChange={event => setCategory(event.target.value as BudgetCategory)}>{budgetCategories.filter(key => key !== "savings").map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label><label className="profile-field"><span>Amount ({currency})</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label><label className="profile-field"><span>Date</span><input type="date" value={spentOn} onChange={event => setSpentOn(event.target.value)} required /></label><label className="profile-field"><span>Short note (optional)</span><input maxLength={200} value={note} onChange={event => setNote(event.target.value)} placeholder="e.g. groceries" /></label><button className="button button-primary" type="submit" disabled={savingTransaction}>{savingTransaction ? "Saving…" : "Add spending"}</button></form></section>
      <section className="profile-card budget-import-card"><div className="budget-section-heading"><div><p className="eyebrow"><Upload size={14} /> IMPORT SPENDING</p><h2>Bring in a CSV statement.</h2></div><a className="text-link" download="firepath-transactions-template.csv" href="data:text/csv;charset=utf-8,date%2Ccategory%2Camount%2Cnote%0A2026-11-01%2Cgroceries%2C1250%2CWeekly%20shopping">Download CSV template</a></div><p>Import stays in your browser until you review and confirm. Use columns date (YYYY-MM-DD), category, amount, and optional note. Supported categories include groceries, rent/housing, utilities, transport, healthcare, insurance, family, education, debt, personal, and other.</p><label className="profile-field"><span>Choose CSV file (up to 2 MB; 500 rows)</span><input type="file" accept=".csv,text/csv" onChange={event => void previewCsv(event.target.files?.[0])} /></label>{importMessage && <p className="profile-status" role="status">{importMessage}</p>}{importRows.length > 0 && <><div className="budget-import-preview"><strong>Preview: {importRows.length} valid rows</strong>{importRows.slice(0, 5).map(row => <span key={`${row.row}-${row.spent_on}-${row.amount}`}>Row {row.row}: {row.spent_on} · {labels[row.category]} · {money(row.amount)}{row.note ? ` · ${row.note}` : ""}</span>)}{importRows.length > 5 && <small>And {importRows.length - 5} more rows</small>}</div>{importErrors.length > 0 && <ul className="budget-import-errors">{importErrors.slice(0, 5).map(error => <li key={error.row}>Row {error.row}: {error.message}</li>)}{importErrors.length > 5 && <li>And {importErrors.length - 5} more invalid rows</li>}</ul>}<button className="button button-primary" type="button" onClick={() => void importCsvRows()} disabled={importing}>{importing ? "Importing…" : `Import ${importRows.length} valid rows`}</button></>}{importRows.length === 0 && importErrors.length > 0 && <ul className="budget-import-errors">{importErrors.slice(0, 5).map(error => <li key={error.row}>Row {error.row}: {error.message}</li>)}</ul>}</section>
      <section className="budget-history"><div className="budget-section-heading"><div><p className="eyebrow"><CalendarDays size={14} /> THIS MONTH</p><h2>Recent spending entries.</h2></div><Link className="text-link" href="/check-in">Monthly check-in →</Link></div>{transactions.length ? <div className="budget-entry-list">{transactions.slice(0, 15).map(item => <article key={item.id}><time>{item.spent_on}</time><span>{labels[item.category]}</span><strong>{money(item.amount)}</strong><small>{item.note}</small><button type="button" className="icon-button danger budget-delete" onClick={() => void deleteTransaction(item.id)} aria-label={`Remove ${labels[item.category]} entry of ${money(item.amount)}`}><Trash2 size={14} /></button></article>)}</div> : <p className="profile-status">No spending entries for this month yet. You can still save targets and add entries whenever you like.</p>}</section>
      {message && <p className="profile-status budget-status" role="status">{message}</p>}
      <p className="profile-privacy">Your budget and entries are private to your account. Only figures you enter in the AI form are sent to the configured AI provider for a draft; the key stays on the server. Review targets before using them. This tool does not provide personalised investment advice.</p>
    </>}
  </main><Footer /></>;
}
