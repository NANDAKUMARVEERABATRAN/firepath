"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import VoiceEntry from "@/components/forms/VoiceEntry";
import StepFlow, { MoneyInput, type Step } from "@/components/forms/StepFlow";
import Celebration from "@/components/game/Celebration";
import { QUICKLOG_CHECKIN_KEY } from "@/components/forms/QuickLog";
import { parseLabeledAmount } from "@/lib/voiceForms";
import { getInvestmentStreak } from "@/lib/fireScore";
import { rupees } from "@/lib/format";
import { useCountry } from "@/lib/useCountry";

type Checkin = { income: string; investment_income: string; expenses: string; invested: string; debt_paid: string; salary_pf: string; salary_pension: string; note: string };
const empty: Checkin = { income: "", investment_income: "", expenses: "", invested: "", debt_paid: "", salary_pf: "0", salary_pension: "0", note: "" };
const monthStart = (offset = 0) => { const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth() + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const num = (value: string) => Math.max(0, Number(value || 0));

export default function CheckInPage() {
  const [values, setValues] = useState<Checkin>(empty);
  const [source, setSource] = useState<"this-month" | "last-month" | "profile" | "quicklog" | "none">("none");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<{ month_start: string; invested: number }[]>([]);
  const [done, setDone] = useState<{ streak: number } | null>(null);
  const [salaryColumns, setSalaryColumns] = useState(false); // migration 0026 applied?
  const { country } = useCountry();
  const cash = (value: number) => rupees(value, country.code);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    let active = true;
    const currentMonth = monthStart();
    setMonth(currentMonth);
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        const user = session?.user;
        setSignedIn(Boolean(user));
        if (!user) return;
        const [checkinsResult, profileResult, loansResult] = await Promise.all([
          supabase.from("monthly_checkins").select("*").eq("user_id", user.id).order("month_start", { ascending: false }).limit(12),
          supabase.from("financial_profiles").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("financial_accounts").select("monthly_payment").eq("user_id", user.id).eq("kind", "liability"),
        ]);
        if (!active) return;
        if (checkinsResult.error) { setMessage(`Could not load check-ins: ${checkinsResult.error.message}`); return; }
        const rows = checkinsResult.data ?? [];
        setSalaryColumns(Boolean(profileResult.data && "monthly_salary_pf" in profileResult.data));
        setHistory(rows.map(row => ({ month_start: row.month_start, invested: Number(row.invested) })));
        const emis = (loansResult.data ?? []).reduce((sum, row) => sum + Number(row.monthly_payment), 0);
        const thisMonth = rows.find(row => row.month_start === currentMonth);
        const last = rows.find(row => row.month_start !== currentMonth);
        const fromRow = (row: typeof rows[number], note: string): Checkin => ({ income: String(row.income), investment_income: String(row.investment_income ?? 0), expenses: String(row.expenses), invested: String(row.invested), debt_paid: String(row.debt_paid), salary_pf: String(row.salary_pf ?? 0), salary_pension: String(row.salary_pension ?? 0), note });
        // Never make people type the same numbers twice: reuse this month, else last month, else the profile.
        if (thisMonth) { setValues(fromRow(thisMonth, thisMonth.note ?? "")); setSource("this-month"); }
        else if (last) { setValues(fromRow(last, "")); setSource("last-month"); }
        else if (profileResult.data) {
          const p = profileResult.data;
          setValues({ income: String(p.monthly_income ?? ""), investment_income: String(p.monthly_investment_income ?? 0), expenses: String(p.monthly_expenses ?? ""), invested: String(p.monthly_investment ?? ""), debt_paid: emis ? String(emis) : "0", salary_pf: String(p.monthly_salary_pf ?? 0), salary_pension: String(p.monthly_salary_pension ?? 0), note: "" });
          setSource("profile");
        }
        // Numbers from AI quick log (Home/Budget) fill in on top, for the person to confirm.
        try {
          const raw = window.sessionStorage.getItem(QUICKLOG_CHECKIN_KEY);
          if (raw) {
            window.sessionStorage.removeItem(QUICKLOG_CHECKIN_KEY);
            const saved = JSON.parse(raw) as { month: string; fields: Record<string, number> };
            if (saved.month === currentMonth) { setValues(current => ({ ...current, ...Object.fromEntries(Object.entries(saved.fields).filter(([k]) => k in current).map(([k, v]) => [k, String(v)])) })); setSource("quicklog"); }
          }
        } catch { /* storage unavailable */ }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load your check-in.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const set = (key: keyof Checkin) => (value: string) => { setValues(current => ({ ...current, [key]: value })); setMessage(""); };

  async function save() {
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setSignedIn(false); return; }
      const { error } = await supabase.from("monthly_checkins").upsert({
        user_id: session.user.id, month_start: month,
        income: num(values.income), investment_income: num(values.investment_income), expenses: num(values.expenses),
        invested: num(values.invested), debt_paid: num(values.debt_paid), note: values.note.trim(), updated_at: new Date().toISOString(),
        ...(salaryColumns || fromSalary > 0 ? { salary_pf: num(values.salary_pf), salary_pension: num(values.salary_pension) } : {}),
      }, { onConflict: "user_id,month_start" });
      if (error) throw /salary_p/.test(error.message) ? new Error("Run supabase/migrations/202611260026_salary_savings.sql in Supabase to save EPF/NPS.") : error;
      // Keep the profile's salary deductions current so next month and the profile are pre-filled.
      if (salaryColumns) await supabase.from("financial_profiles").update({ monthly_salary_pf: num(values.salary_pf), monthly_salary_pension: num(values.salary_pension) }).eq("user_id", session.user.id);
      const updated = [{ month_start: month, invested: num(values.invested) }, ...history.filter(row => row.month_start !== month)];
      setDone({ streak: getInvestmentStreak(updated) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your check-in.");
    } finally { setSaving(false); }
  }

  function applyVoiceEntry(transcript: string) {
    const updates: Partial<Checkin> = {};
    const pairs: [keyof Checkin, string[]][] = [["income", ["income", "salary"]], ["investment_income", ["investment income", "dividends", "investment payouts"]], ["expenses", ["expenses", "expense", "spending"]], ["invested", ["invested", "investment"]], ["debt_paid", ["debt paid", "loan payment", "debt"]], ["salary_pf", ["epf", "pf", "provident fund", "vpf"]], ["salary_pension", ["nps", "pension"]]];
    for (const [key, labels] of pairs) { const amount = parseLabeledAmount(transcript, labels); if (amount !== null) updates[key] = String(amount); }
    if (!Object.keys(updates).length) { setMessage("I couldn’t find amounts. Try: income 80000, expenses 40000, invested 10000, debt paid 2000."); return; }
    setValues(current => ({ ...current, ...updates }));
    setMessage(`${Object.keys(updates).length} answer${Object.keys(updates).length === 1 ? "" : "s"} filled — check each step and continue.`);
  }

  const monthName = month ? new Date(`${month}T12:00:00`).toLocaleDateString("en-IN", { month: "long" }) : "this month";
  const income = num(values.income);
  const fromSalary = num(values.salary_pf) + num(values.salary_pension);
  const earned = income + fromSalary; // take-home + retirement savings deducted from salary
  const uae = country.code === "AE";
  const salaryLabels = uae ? { pf: "Workplace savings (e.g. DEWS)", pension: "Pension contribution (e.g. GPSSA)" } : { pf: "EPF / VPF (your share + employer’s)", pension: "NPS (your share + employer’s)" };
  const prefillNote = source === "quicklog" ? "✨ Filled from your quick log (the rest from last month). Check each step and save." : source === "last-month" ? "Pre-filled from last month — just confirm or change." : source === "profile" ? "Pre-filled from your profile — just confirm or change." : source === "this-month" ? `You already logged ${monthName}. Update anything that changed.` : null;
  const lastStreak = getInvestmentStreak(history.filter(row => row.month_start !== month));

  const steps: Step[] = [
    { id: "income", emoji: "💰", title: `How much reached your bank in ${monthName}?`, subtitle: "Take-home salary after deductions, plus any other money received (rent, interest, dividends).", valid: values.income !== "",
      body: <MoneyInput value={values.income} onChange={set("income")} />, feedback: prefillNote },
    { id: "salary-savings", emoji: "🏛️", title: "Anything saved straight from your salary?", subtitle: uae ? "Workplace savings or pension taken from your salary before it reaches your bank." : "EPF/VPF and NPS on your payslip. They never reach your bank, so they aren’t in the amount above.",
      body: <div className="salary-savings">
        <label><span>{salaryLabels.pf}</span><MoneyInput value={values.salary_pf} onChange={set("salary_pf")} /></label>
        <label><span>{salaryLabels.pension}</span><MoneyInput value={values.salary_pension} onChange={set("salary_pension")} /></label>
        <button type="button" className="qn-skip-chip" onClick={() => setValues(current => ({ ...current, salary_pf: "0", salary_pension: "0" }))}>{uae ? "None" : "None / not salaried"}</button>
      </div>,
      feedback: fromSalary > 0 ? `🏛️ ${cash(fromSalary)} saved automatically for later life. It counts toward your savings rate, so don’t add it again under “invested”.` : null },
    { id: "inv-income", emoji: "🌱", title: "Did any of it come from investments?", subtitle: "Dividends, interest or rent — already included above.",
      body: <MoneyInput value={values.investment_income} onChange={set("investment_income")} chips={[{ label: "None", value: 0 }]} />,
      error: num(values.investment_income) > income ? "This is part of the income above, so it can’t be bigger." : null,
      feedback: num(values.investment_income) > 0 ? `Your money earned ${cash(num(values.investment_income))} for you this month. 🌱` : null },
    { id: "expenses", emoji: "🛒", title: `What did you spend in ${monthName}?`, subtitle: "Everything except investing and loan EMIs.", valid: values.expenses !== "",
      body: <MoneyInput value={values.expenses} onChange={set("expenses")} />,
      feedback: income && values.expenses ? (() => { const rate = (earned - num(values.expenses)) / earned * 100; return rate >= 30 ? `🔥 ${rate.toFixed(0)}% of your income kept this month!` : rate > 0 ? `You kept ${rate.toFixed(0)}% of your income.` : "A tight month — it happens. Next month is a fresh start."; })() : null },
    { id: "invested", emoji: "📈", title: "How much did you invest from your bank?", subtitle: uae ? "Stocks, funds, savings plans: money you invested yourself. Not salary deductions (already counted)." : "SIPs, stocks, PPF, extra NPS you paid yourself. Not EPF/NPS deducted from salary (already counted).",
      body: <MoneyInput value={values.invested} onChange={set("invested")} chips={[{ label: "Nothing this month", value: 0 }]} />,
      feedback: num(values.invested) > 0 ? `💪 That keeps your investing streak going${lastStreak ? ` — ${lastStreak + 1} months!` : "!"}` : lastStreak ? `Investing even ${country.code === "IN" ? "₹500" : "AED 100"} keeps your ${lastStreak}-month streak alive.` : null },
    { id: "debt", emoji: "🧾", title: "How much went to loan EMIs?", subtitle: "Home, car, personal loans and credit card payments.",
      body: <MoneyInput value={values.debt_paid} onChange={set("debt_paid")} chips={[{ label: "No EMIs", value: 0 }]} /> },
    { id: "review", emoji: "✅", title: `Your ${monthName} in one look`, valid: income > 0,
      body: <>
        <div className="qn-mini-summary">
          <div><span>Reached your bank</span><b>{cash(income)}</b></div>
          {fromSalary > 0 && <div><span>Saved from salary</span><b>{cash(fromSalary)}</b></div>}
          <div><span>Spent</span><b>{cash(num(values.expenses))}</b></div>
          <div><span>Invested</span><b>{cash(num(values.invested))}</b></div>
          <div><span>EMIs</span><b>{cash(num(values.debt_paid))}</b></div>
          <div className="left"><span>Left in bank</span><b>{cash(income - num(values.expenses) - num(values.invested) - num(values.debt_paid))}</b></div>
        </div>
        {earned > 0 && <p className="qn-rate-line">Savings rate this month: <b>{Math.round((earned - num(values.expenses)) / earned * 100)}%</b>{fromSalary > 0 ? ` (on ${cash(earned)} earned incl. ${cash(fromSalary)} from salary)` : ""}</p>}
        <label className="profile-field"><span>A note to future you (optional)</span><textarea maxLength={500} rows={2} value={values.note} placeholder="e.g. Diwali shopping, bonus month, new SIP started" onChange={event => setValues(current => ({ ...current, note: event.target.value }))} /></label>
      </> },
  ];

  return <><Header /><main className="checkin-page container">
    {done && <Celebration title={`${monthName} logged! +60 XP`} detail={done.streak > 0 ? `🔥 ${done.streak}-month investing streak. Your score and freedom date are updated on Home.` : "Your score and freedom date are updated on Home. Invest something next month to start a streak!"} onClose={() => { window.location.href = "/journey"; }} />}
    {loading ? <p className="profile-status">Loading this month…</p> : !signedIn ? <section className="profile-card"><p>Sign in with Google to save a monthly check-in.</p><Link href="/" className="button button-primary">Return home to sign in</Link></section> : <>
      {message && <p className="profile-status qn-message" role="status">{message}</p>}
      <StepFlow steps={steps} finishLabel={`Save ${monthName} (+60 XP)`} onFinish={() => void save()} saving={saving}
        footer={<details className="qn-voice"><summary>🎙️ Say it all at once instead</summary><VoiceEntry hint="For example: income 80000, EPF 3600, NPS 2000, expenses 40000, invested 10000, debt paid 2000" hindiHint="आमदनी 80 हज़ार, खर्च 40 हज़ार, निवेश 10 हज़ार" applyLabel="Fill answers" onApply={applyVoiceEntry} /></details>} />
    </>}
  </main><Footer /></>;
}
