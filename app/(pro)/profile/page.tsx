"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Pencil, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import VoiceEntry from "@/components/forms/VoiceEntry";
import Celebration from "@/components/game/Celebration";
import { parseLabeledAmount } from "@/lib/voiceForms";
import { amountInWords, rupees } from "@/lib/format";
import { COUNTRIES, countryFromCurrency, detectCountry, getCountry, readStoredCountry, storeCountry, type CountryCode } from "@/lib/country";
import { getNetWorthBreakdown, type NetWorthBreakdown } from "@/lib/netWorth";
import { fireReasons, fireStyles, getWhyResult, styleTip } from "@/lib/fireWhy";

type Profile = {
  age: string;
  monthly_income: string;
  monthly_investment_income: string;
  monthly_expenses: string;
  other_assets: string; // home, vehicles, other valuables — derived: assets − emergency − FIRE − later
  fire_accessible_assets: string;
  later_retirement_assets: string;
  liabilities: string;
  emergency_fund: string;
  monthly_investment: string;
  has_health_insurance: boolean;
  has_term_insurance: boolean;
  has_dependents: boolean;
  health_cover_amount: string;
  term_cover_amount: string;
  currency: "INR" | "AED" | "USD";
  fire_reasons: string[];
  fire_why_note: string;
  dream_age: string;
};
type MoneyKey = "monthly_income" | "monthly_investment_income" | "monthly_expenses" | "other_assets" | "fire_accessible_assets" | "later_retirement_assets" | "liabilities" | "emergency_fund" | "monthly_investment" | "health_cover_amount" | "term_cover_amount";
type BoolKey = "has_health_insurance" | "has_term_insurance" | "has_dependents";

const emptyProfile: Profile = { age: "", monthly_income: "", monthly_investment_income: "", monthly_expenses: "", other_assets: "", fire_accessible_assets: "", later_retirement_assets: "", liabilities: "", emergency_fund: "", monthly_investment: "", has_health_insurance: false, has_term_insurance: false, has_dependents: false, health_cover_amount: "", term_cover_amount: "", currency: "INR", fire_reasons: [], fire_why_note: "", dream_age: "" };

const num = (value: string) => Math.max(0, Number(value || 0));

type Question = {
  id: string;
  section: "Your why" | "About you" | "Money flow" | "What you own" | "Protection";
  title: string;
  subtitle: string;
  emoji: string;
} & (
  | { kind: "country" }
  | { kind: "reasons" }
  | { kind: "note" }
  | { kind: "dreamAge" }
  | { kind: "age" }
  | { kind: "money"; key: MoneyKey; optional?: boolean; chips?: { label: string; value: number }[]; examples?: string }
  | { kind: "yesno"; key: BoolKey; yes: string; no: string }
);

const whyOf = (p: Profile) => getWhyResult(p.fire_reasons, p.fire_why_note, p.dream_age ? Number(p.dream_age) : null);
// Country for question text and money formatting; set at the top of each render from the profile currency.
let CUR: CountryCode = "IN";
const cash = (value: number) => rupees(value, CUR);

/** UAE wording/chips for the few questions that differ from India. */
function localize<Q extends { id: string; title: string; subtitle: string }>(q: Q): Q {
  if (CUR !== "AE") return q;
  const uae: Record<string, Partial<{ title: string; subtitle: string; chips: { label: string; value: number }[] }>> = {
    income: { subtitle: "Salary plus allowances (housing, transport) and any other regular income." },
    expenses: { subtitle: "Rent, school fees, bills, money sent home, fun — everything except investing." },
    later: { title: "How much is your end-of-service gratuity, workplace savings or pension?", subtitle: "Money you get when you leave your job or retire. Check your HR portal or DEWS statement." },
    "health-cover": { chips: [{ label: "AED 150k", value: 150000 }, { label: "AED 500k", value: 500000 }, { label: "AED 1M", value: 1000000 }, { label: "AED 5M", value: 5000000 }] },
    "term-cover": { chips: [{ label: "AED 1M", value: 1000000 }, { label: "AED 2M", value: 2000000 }, { label: "AED 5M", value: 5000000 }] },
  };
  return { ...q, ...(uae[q.id] ?? {}) };
}

const questions: (Question & { show?: (p: Profile) => boolean; feedback?: (p: Profile) => string | null; error?: (p: Profile) => string | null })[] = [
  { id: "why", section: "Your why", emoji: "🌅", title: "Why do you want financial freedom?", subtitle: "Pick everything that feels true. Your “why” is the fuel that keeps you going on hard months.", kind: "reasons",
    feedback: p => { if (!p.fire_reasons.length) return null; const why = whyOf(p); const style = fireStyles[why.style]; return `${style.emoji} You’re on the ${style.name} path. ${style.description}`; } },
  { id: "why-note", section: "Your why", emoji: "✍️", title: "In one line — what will you do with your freedom?", subtitle: "Write it for future you, e.g. “Open a small café in Goa” or “Teach music to kids”.", kind: "note",
    feedback: p => p.fire_why_note.trim().length >= 10 ? "Beautiful. We’ll remind you of this whenever you open the app. 💚" : null },
  { id: "dream-age", section: "Your why", emoji: "🎯", title: "By what age would you love to be free?", subtitle: "Dream a little. We’ll show you what it takes to get there.", kind: "dreamAge",
    error: p => { const a = Number(p.dream_age); return p.dream_age && (a < 18 || a > 100 || (p.age && a < Number(p.age))) ? "Pick an age between your current age and 100." : null; },
    feedback: p => { const why = whyOf(p); return why.purposeScore ? `Purpose score: ${why.purposeScore}/100 — ${why.label}` : null; } },
  { id: "country", section: "About you", emoji: "🌍", title: "Where do you live?", subtitle: "We’ll use your currency, local investments, retirement products and typical goals.", kind: "country" },
  { id: "age", section: "About you", emoji: "🎂", title: "How old are you?", subtitle: "Your age sets how long your money has to grow.", kind: "age",
    feedback: p => { const age = Number(p.age); return age >= 18 && age < 60 ? `${60 - age} years of compounding ahead of you before 60 — time is your biggest asset.` : null; },
    error: p => { const age = Number(p.age); return p.age && (age < 18 || age > 100) ? "Please enter an age between 18 and 100." : null; } },
  { id: "dependents", section: "About you", emoji: "👨‍👩‍👧", title: "Does anyone depend on your income?", subtitle: "Spouse, children, or parents who would struggle without your earnings.", kind: "yesno", key: "has_dependents", yes: "Yes, my family does", no: "No, just me" },

  { id: "income", section: "Money flow", emoji: "💰", title: "How much lands in your bank account each month?", subtitle: "Take-home pay after tax, plus any regular income like rent or interest.", kind: "money", key: "monthly_income" },
  { id: "inv-income", section: "Money flow", emoji: "🌱", title: "Does any of that come from your investments?", subtitle: "Dividends, interest or rent that’s already included in the amount above.", kind: "money", key: "monthly_investment_income", optional: true, chips: [{ label: "None", value: 0 }],
    feedback: p => num(p.monthly_investment_income) > 0 ? `Your money is already earning ${cash(num(p.monthly_investment_income))} a month for you. That’s the FIRE engine starting! 🚀` : null,
    error: p => num(p.monthly_investment_income) > num(p.monthly_income) ? "This is part of your income above, so it can’t be bigger than it." : null },
  { id: "expenses", section: "Money flow", emoji: "🛒", title: "What do you spend in a normal month?", subtitle: "Rent, EMIs, groceries, bills, shopping, fun — everything except investing.", kind: "money", key: "monthly_expenses",
    feedback: p => { const income = num(p.monthly_income); if (!income || !p.monthly_expenses) return null; const rate = (income - num(p.monthly_expenses)) / income * 100; return rate >= 30 ? `🔥 You keep ${rate.toFixed(0)}% of your income. That’s FIRE-level saving!` : rate >= 15 ? `👍 You keep ${rate.toFixed(0)}% of your income. Getting to 30% speeds up FIRE a lot.` : rate > 0 ? `You keep ${rate.toFixed(0)}% of your income. Small changes add up — we’ll help you find them.` : "Spending is at or above income right now. The Budget page can help you find room — no judgement."; } },
  { id: "sip", section: "Money flow", emoji: "📈", title: "How much do you invest every month?", subtitle: "SIPs, stocks, RDs, NPS or PPF contributions — the total you put away.", kind: "money", key: "monthly_investment", optional: true, chips: [{ label: "Not yet", value: 0 }],
    feedback: p => { const income = num(p.monthly_income); const sip = num(p.monthly_investment); if (!income || !p.monthly_investment) return null; const pct = sip / income * 100; return pct >= 20 ? `💪 ${pct.toFixed(0)}% of your income — you’re paying yourself first!` : sip > 0 ? `${pct.toFixed(0)}% of your income. Growing this toward 20% is the fastest FIRE lever.` : `No problem — even ${CUR === "IN" ? "a ₹500 SIP" : "AED 100 a month"} starts the habit. We’ll show you what it does.`; } },

  { id: "emergency", section: "What you own", emoji: "🛟", title: "How much cash is set aside for emergencies?", subtitle: "Savings account or liquid fund money you don’t touch unless something goes wrong.", kind: "money", key: "emergency_fund", optional: true, chips: [{ label: "None yet", value: 0 }],
    feedback: p => { const exp = num(p.monthly_expenses); if (!exp || !p.emergency_fund) return null; const months = num(p.emergency_fund) / exp; return months >= 6 ? `🛟 ${months.toFixed(1)} months of expenses covered — a full safety net!` : months >= 1 ? `${months.toFixed(1)} months covered. Six months is the full safety net.` : "Building even one month of expenses is a great first milestone."; } },
  { id: "fire-funds", section: "What you own", emoji: "🏦", title: "How much do you have in investments you could use?", subtitle: "Mutual funds, stocks, FDs, gold, other savings — not counting your emergency fund.", kind: "money", key: "fire_accessible_assets", optional: true, chips: [{ label: "None yet", value: 0 }],
    examples: "These count toward your FIRE number. Rented flats or plots? Add them in Portfolio as “rented” and they’ll count too.",
    feedback: p => { const exp = num(p.monthly_expenses); const funds = num(p.fire_accessible_assets); return exp && funds ? `That could fund ${(funds / exp).toFixed(0)} months of your life already. 🎉` : null; } },
  { id: "later", section: "What you own", emoji: "🔒", title: "How much is in EPF, PPF or NPS?", subtitle: "Retirement money you can only fully use later. Check your EPFO passbook or app.", kind: "money", key: "later_retirement_assets", optional: true, chips: [{ label: "None", value: 0 }] },
  { id: "other", section: "What you own", emoji: "🏠", title: "What’s the value of your home, vehicles and other valuables?", subtitle: "The home you live in, car, bike, jewellery you won’t sell. These add to net worth, not to FIRE.", kind: "money", key: "other_assets", optional: true, chips: [{ label: "Nothing major", value: 0 }] },
  { id: "loans", section: "What you own", emoji: "🧾", title: "How much do you still owe on loans?", subtitle: "Home loan, car loan, personal loans, credit card balances — total outstanding.", kind: "money", key: "liabilities", optional: true, chips: [{ label: "No loans 🎉", value: 0 }],
    examples: "Add each loan with its EMI in Portfolio later for a sharper debt score." },

  { id: "health", section: "Protection", emoji: "🏥", title: "Does your family have health insurance?", subtitle: "Your own policy or one from your employer.", kind: "yesno", key: "has_health_insurance", yes: "Yes, we’re covered", no: "Not yet" },
  { id: "health-cover", section: "Protection", emoji: "🩺", title: "How much is your total health cover?", subtitle: "Add up base cover, top-ups and employer cover for your family.", kind: "money", key: "health_cover_amount", show: p => p.has_health_insurance,
    chips: [{ label: "₹5 lakh", value: 500000 }, { label: "₹10 lakh", value: 1000000 }, { label: "₹25 lakh", value: 2500000 }, { label: "₹50 lakh", value: 5000000 }] },
  { id: "term", section: "Protection", emoji: "☂️", title: "Do you have term life insurance?", subtitle: "A pure term plan that pays your family if something happens to you.", kind: "yesno", key: "has_term_insurance", yes: "Yes, I have it", no: "Not yet", show: p => p.has_dependents },
  { id: "term-cover", section: "Protection", emoji: "🛡️", title: "How much is your term cover?", subtitle: "The total sum assured across your term plans.", kind: "money", key: "term_cover_amount", show: p => p.has_dependents && p.has_term_insurance,
    chips: [{ label: "₹50 lakh", value: 5000000 }, { label: "₹1 crore", value: 10000000 }, { label: "₹2 crore", value: 20000000 }] },
];
const sections = ["Your why", "About you", "Money flow", "What you own", "Protection"] as const;

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(0); // index into visible questions; === visible.length means review
  const [returning, setReturning] = useState(false);
  const [runSection, setRunSection] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [portfolio, setPortfolio] = useState<NetWorthBreakdown & { hasAssets: boolean; hasLoans: boolean } | null>(null);

  // Questions already answered by detailed Portfolio records are skipped, so nothing is entered twice.
  CUR = countryFromCurrency(profile.currency);
  const visible = useMemo(() => questions.map(localize).filter(q => (!q.show || q.show(profile))
    && !(portfolio?.hasAssets && ["fire-funds", "later", "other"].includes(q.id))
    && !(portfolio?.hasLoans && q.id === "loans")), [profile, portfolio]);
  const onReview = step >= visible.length;
  const question = onReview ? null : visible[step];

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured. Add your project URL and publishable key to .env.local."); setLoading(false); return; }
    let active = true;
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        setSignedIn(Boolean(session?.user));
        if (!session?.user) return;
        const [{ data, error }, accountsResult] = await Promise.all([
          supabase.from("financial_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
          supabase.from("financial_accounts").select("*").eq("user_id", session.user.id),
        ]);
        if (!active) return;
        const rows = (accountsResult.data ?? []).map(row => ({ ...row, current_value: Number(row.current_value) }));
        if (rows.length) setPortfolio({ ...getNetWorthBreakdown(rows), hasAssets: rows.some(row => row.kind === "asset"), hasLoans: rows.some(row => row.kind === "liability") });
        if (error) setMessage("Could not load your profile. Details: " + error.message);
        else if (!data) setProfile(current => ({ ...current, currency: getCountry(readStoredCountry() ?? detectCountry()).currency })); // new profile: start in the visitor's country
        else if (data) {
          const assets = Number(data.assets ?? 0), emergency = Number(data.emergency_fund ?? 0), fire = Number(data.fire_accessible_assets ?? 0), later = Number(data.later_retirement_assets ?? 0);
          setProfile({
            age: data.age?.toString() ?? "", monthly_income: data.monthly_income?.toString() ?? "", monthly_investment_income: data.monthly_investment_income?.toString() ?? "0",
            monthly_expenses: data.monthly_expenses?.toString() ?? "", other_assets: String(Math.max(0, assets - emergency - fire - later)),
            fire_accessible_assets: data.fire_accessible_assets?.toString() ?? "", later_retirement_assets: data.later_retirement_assets?.toString() ?? "",
            liabilities: data.liabilities?.toString() ?? "", emergency_fund: data.emergency_fund?.toString() ?? "", monthly_investment: data.monthly_investment?.toString() ?? "",
            has_health_insurance: data.has_health_insurance ?? false, has_term_insurance: data.has_term_insurance ?? false, has_dependents: data.has_dependents ?? false,
            health_cover_amount: data.health_cover_amount?.toString() ?? "", term_cover_amount: data.term_cover_amount?.toString() ?? "", currency: data.currency,
            fire_reasons: Array.isArray(data.fire_reasons) ? data.fire_reasons : [], fire_why_note: data.fire_why_note ?? "", dream_age: data.dream_age?.toString() ?? "",
          });
          if (data.age) { setReturning(true); setStep(Number.MAX_SAFE_INTEGER); } // returning users land on the review screen
          // Deep link from Home's "Why do you want financial freedom?" card: open those questions directly.
          if (new URLSearchParams(window.location.search).get("start") === "why") { setRunSection("Your why"); setStep(0); }
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? `Could not load your profile: ${error.message}` : "Could not load your profile.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => { setProfile(current => ({ ...current, [key]: value })); setMessage(""); };
  const value = question?.kind === "age" ? profile.age : question?.kind === "money" ? profile[question.key] : "";
  const error = question?.error?.(profile) ?? null;
  const answered = !question ? true : question.kind === "country" ? true : question.kind === "reasons" ? profile.fire_reasons.length > 0 : question.kind === "note" || question.kind === "dreamAge" || question.kind === "yesno" ? true : question.kind === "age" ? Boolean(profile.age) : question.optional ? true : value !== "";
  const canNext = answered && !error;
  // A returning user editing one answer goes straight back to the summary — unless they're walking
  // through a whole section (e.g. "Your why"), in which case we continue to the end of that section.
  const continuesSection = Boolean(runSection && question && visible[step + 1]?.section === runSection);
  const next = () => {
    if (!canNext) return;
    if (continuesSection) { setStep(step + 1); return; }
    const finishedWhy = runSection === "Your why";
    setRunSection(null);
    setStep(returning ? visible.length : step + 1);
    // Returning users: save their edit right away — no extra "Save" tap to forget.
    if (returning) void save(profile, finishedWhy ? "why" : "quiet");
  };
  const back = () => setStep(s => Math.max(0, Math.min(s, visible.length) - 1));
  const sectionIndex = question ? sections.indexOf(question.section) : sections.length;
  const progress = Math.min(100, (Math.min(step, visible.length) / visible.length) * 100);

  const currentProfile = profile;
  /** mode "full" = the Save button; "quiet" = auto-save after editing one answer; "why" = finished the why questions. */
  async function save(profile: Profile = currentProfile, mode: "full" | "quiet" | "why" = "full") {
    const supabase = createClient();
    if (!supabase) return;
    if (num(profile.monthly_investment_income) > num(profile.monthly_income)) { setMessage("Investment income can’t be more than your total income."); return; }
    setSaving(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSignedIn(false); setSaving(false); return; }
    const fire = num(profile.fire_accessible_assets), later = num(profile.later_retirement_assets), emergency = num(profile.emergency_fund);
    const { error: saveError } = await supabase.from("financial_profiles").upsert({
      user_id: session.user.id, age: profile.age ? Number(profile.age) : null,
      monthly_income: num(profile.monthly_income), monthly_investment_income: num(profile.monthly_investment_income), monthly_expenses: num(profile.monthly_expenses),
      assets: emergency + fire + later + num(profile.other_assets), fire_accessible_assets: fire, later_retirement_assets: later,
      liabilities: num(profile.liabilities), emergency_fund: emergency, monthly_investment: num(profile.monthly_investment),
      has_health_insurance: profile.has_health_insurance, has_term_insurance: profile.has_dependents && profile.has_term_insurance, has_dependents: profile.has_dependents,
      health_cover_amount: profile.has_health_insurance ? num(profile.health_cover_amount) : 0, term_cover_amount: profile.has_dependents && profile.has_term_insurance ? num(profile.term_cover_amount) : 0,
      currency: profile.currency, updated_at: new Date().toISOString(),
      fire_reasons: profile.fire_reasons, fire_why_note: profile.fire_why_note.trim().slice(0, 280), dream_age: profile.dream_age ? Number(profile.dream_age) : null,
    });
    setSaving(false);
    if (saveError) { setMessage(`Couldn’t save: ${saveError.message}`); return; }
    setReturning(true);
    if (mode === "quiet") setMessage("✓ Saved");
    else if (mode === "why") { const why = getWhyResult(profile.fire_reasons, profile.fire_why_note, profile.dream_age ? Number(profile.dream_age) : null); const style = fireStyles[why.style]; setCelebrate({ title: `${style.emoji} You’re on the ${style.name} path!`, detail: `Purpose score ${why.purposeScore}/100 — ${why.label}. +100 XP. ${styleTip(why.style, profile.currency)}` }); }
    else setCelebrate({ title: "Profile saved! 🎉", detail: "Your score, Freedom Path levels and freedom date are updated. Head to Home to see what changed." });
  }

  function applyVoiceEntry(transcript: string) {
    const voiceFields: [MoneyKey, string[]][] = [
      ["monthly_income", ["income", "salary"]], ["monthly_investment_income", ["investment income", "dividends", "interest from investments"]],
      ["monthly_expenses", ["expenses", "spending"]], ["fire_accessible_assets", ["FIRE accessible funds", "FIRE funds", "available now"]],
      ["later_retirement_assets", ["later retirement funds", "retirement funds"]], ["liabilities", ["liabilities", "debt balance"]],
      ["emergency_fund", ["emergency fund", "emergency savings"]], ["monthly_investment", ["monthly investment", "investment per month", "invested monthly"]],
    ];
    const updates: Partial<Profile> = {};
    for (const [key, labels] of voiceFields) { const amount = parseLabeledAmount(transcript, labels); if (amount !== null) updates[key] = String(amount); }
    if (!Object.keys(updates).length) { setMessage("I couldn’t match amounts. Try: income 80000, expenses 40000, monthly investment 15000, emergency fund 2 lakh."); return; }
    setProfile(current => ({ ...current, ...updates }));
    setMessage(`${Object.keys(updates).length} answer${Object.keys(updates).length === 1 ? "" : "s"} filled from your voice note. Check them below, then save.`);
  }

  const income = num(profile.monthly_income), expenses = num(profile.monthly_expenses);
  const summary = {
    savingsRate: income ? Math.round((income - expenses) / income * 100) : 0,
    emergencyMonths: expenses ? num(profile.emergency_fund) / expenses : 0,
    fireNumber: expenses * 12 / 0.035,
    netWorth: portfolio?.hasAssets || portfolio?.hasLoans
      ? (portfolio.hasAssets ? portfolio.totalAssets : num(profile.emergency_fund) + num(profile.fire_accessible_assets) + num(profile.later_retirement_assets) + num(profile.other_assets)) - (portfolio.hasLoans ? portfolio.totalLiabilities : num(profile.liabilities))
      : num(profile.emergency_fund) + num(profile.fire_accessible_assets) + num(profile.later_retirement_assets) + num(profile.other_assets) - num(profile.liabilities),
  };
  const answerText = (q: Question) => q.kind === "country" ? `${getCountry(CUR).flag} ${getCountry(CUR).name}` : q.kind === "reasons" ? (profile.fire_reasons.length ? fireReasons.filter(r => profile.fire_reasons.includes(r.id)).map(r => r.emoji).join(" ") : "Not set") : q.kind === "note" ? (profile.fire_why_note ? `“${profile.fire_why_note.slice(0, 28)}${profile.fire_why_note.length > 28 ? "…" : ""}”` : "—") : q.kind === "dreamAge" ? (profile.dream_age ? `Age ${profile.dream_age}` : "—") : q.kind === "age" ? (profile.age ? `${profile.age} years` : "—") : q.kind === "yesno" ? (profile[q.key] ? q.yes : q.no) : profile[q.key] === "" ? "—" : num(profile[q.key]) === 0 ? (q.chips?.find(c => c.value === 0)?.label ?? "₹0") : `${rupees(num(profile[q.key]))}`;

  return <><Header /><main className="profile-page container">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    {loading ? <p className="profile-status">Loading your profile…</p> : !signedIn ? (
      <div className="profile-card"><p>Please sign in with Google to create or view your profile.</p><Link className="button button-primary" href="/">Return home to sign in</Link></div>
    ) : !onReview && question ? (
      <section className="qn-card" key={question.id}>
        <div className="qn-sections">{sections.map((section, index) => <span key={section} className={index < sectionIndex ? "done" : index === sectionIndex ? "on" : ""}>{section}</span>)}</div>
        <div className="qn-progress"><span style={{ width: `${progress}%` }} /></div>
        <p className="qn-count">Question {step + 1} of {visible.length}</p>
        <div className="qn-emoji" aria-hidden="true">{question.emoji}</div>
        <h1>{question.title}</h1>
        <p className="qn-sub">{question.subtitle}</p>

        {question.kind === "country" ? (
          <div className="qn-choices">
            {(Object.keys(COUNTRIES) as CountryCode[]).map(code => { const c = COUNTRIES[code]; const on = CUR === code; return <button key={code} type="button" className={`qn-choice${on ? " selected" : ""}`} onClick={() => { const updated = { ...profile, currency: c.currency }; set("currency", c.currency); storeCountry(code); setTimeout(() => { if (returning) { setStep(visible.length + 1); void save(updated, "quiet"); } else setStep(s => s + 1); }, 180); }}>{on && <Check size={18} />}{c.flag} {c.name} <small className="qn-choice-sub">{c.currency}</small></button>; })}
          </div>
        ) : question.kind === "yesno" ? (
          <div className="qn-choices">
            {[true, false].map(choice => <button key={String(choice)} type="button" className={`qn-choice${profile[question.key] === choice ? " selected" : ""}`} onClick={() => { const updated = { ...profile, [question.key]: choice }; set(question.key, choice); setTimeout(() => { if (returning) { setStep(visible.length + 1); void save(updated, "quiet"); } else setStep(s => s + 1); }, 180); }}>{profile[question.key] === choice && <Check size={18} />}{choice ? question.yes : question.no}</button>)}
          </div>
        ) : (
          <form onSubmit={event => { event.preventDefault(); next(); }}>
            {question.kind === "reasons" ? (
              <div className="qn-tiles why-tiles">{fireReasons.map(reason => { const on = profile.fire_reasons.includes(reason.id); return <button type="button" key={reason.id} aria-pressed={on} className={`qn-tile${on ? " selected" : ""}`} onClick={() => set("fire_reasons", on ? profile.fire_reasons.filter(id => id !== reason.id) : [...profile.fire_reasons, reason.id])}><span>{reason.emoji}</span>{reason.label}{on && <small>✓ Selected</small>}</button>; })}</div>
            ) : question.kind === "note" ? (
              <textarea className="qn-textarea" maxLength={280} rows={3} autoFocus value={profile.fire_why_note} placeholder={profile.fire_reasons.includes("business") ? "Launch my own design studio" : profile.fire_reasons.includes("hobby") ? "Spend my mornings painting and teaching art" : "Wake up without an alarm and spend time with my kids"} onChange={event => set("fire_why_note", event.target.value)} />
            ) : question.kind === "dreamAge" ? (<>
              <div className="qn-chips">{[40, 45, 50, 55, 60].filter(a => !profile.age || a > Number(profile.age)).map(a => <button type="button" key={a} className={profile.dream_age === String(a) ? "selected" : ""} onClick={() => set("dream_age", String(a))}>By {a}</button>)}</div>
              <div className="qn-input qn-date"><input ref={inputRef} type="number" inputMode="numeric" min={18} max={100} value={profile.dream_age} placeholder="Or type an age" onChange={event => set("dream_age", event.target.value)} /></div>
            </>) : (
            <div className={`qn-input${question.kind === "money" ? " money" : ""}`}>
              {question.kind === "money" && <span>{getCountry(CUR).symbol}</span>}
              <input ref={inputRef} type="number" inputMode="numeric" min={question.kind === "age" ? 18 : 0} max={question.kind === "age" ? 100 : undefined} step="any" value={value}
                placeholder={question.kind === "age" ? "30" : "0"}
                onChange={event => question.kind === "age" ? set("age", event.target.value) : question.kind === "money" ? set(question.key, event.target.value) : undefined} />
            </div>)}
            {question.kind === "money" && num(value) > 0 && <p className="qn-words">= {amountInWords(num(value), CUR)} {CUR === "IN" ? "rupees" : "dirhams"}</p>}
            {question.kind === "money" && question.chips && <div className="qn-chips">{question.chips.map(chip => <button key={chip.label} type="button" className={value !== "" && num(value) === chip.value ? "selected" : ""} onClick={() => set(question.key, String(chip.value))}>{chip.label}</button>)}</div>}
            {question.kind === "money" && question.examples && <p className="qn-note">{question.examples}</p>}
            {error ? <p className="qn-error">{error}</p> : question.feedback?.(profile) ? <p className="qn-feedback"><Sparkles size={15} /> {question.feedback(profile)}</p> : null}
            <div className="qn-actions">
              {step > 0 ? <button type="button" className="qn-back" onClick={back}><ArrowLeft size={16} /> Back</button> : <span />}
              <button type="submit" className="button button-primary" disabled={!canNext}>{returning && !continuesSection ? "Done" : "Continue"} <ArrowRight size={16} /></button>
            </div>
            <p className="qn-hint">Press Enter ↵ to continue · rough numbers are fine</p>
          </form>
        )}
        {question.kind === "yesno" && step > 0 && <div className="qn-actions"><button type="button" className="qn-back" onClick={back}><ArrowLeft size={16} /> Back</button></div>}
      </section>
    ) : (
      <section className="qn-review">
        <div className="profile-heading"><p className="eyebrow">YOUR FINANCIAL PROFILE</p><h1>{returning ? "Your money snapshot" : "Looking good! Let’s check it."}</h1><p>Tap any answer to change it. Everything stays private to your account.</p></div>
        {profile.fire_reasons.length > 0 ? (() => { const why = whyOf(profile); const style = fireStyles[why.style]; return <div className="why-card"><span className="why-emoji">{style.emoji}</span><div><p className="eyebrow">YOUR WHY · PURPOSE SCORE {why.purposeScore}/100</p><h2>{profile.fire_why_note ? `“${profile.fire_why_note}”` : style.name}</h2><p>{style.name}: {styleTip(why.style, profile.currency)}</p></div></div>; })()
          : <button type="button" className="why-card why-empty" onClick={() => { setRunSection("Your why"); setStep(0); }}><span className="why-emoji">🌅</span><div><p className="eyebrow">NEW · +100 XP</p><h2>Why do you want financial freedom?</h2><p>Answer 3 quick questions to find your FIRE style and purpose score.</p></div></button>}
        <div className="qn-summary">
          <div><span>You save</span><strong>{summary.savingsRate}%</strong><small>of income</small></div>
          <div><span>Safety net</span><strong>{summary.emergencyMonths.toFixed(1)}</strong><small>months covered</small></div>
          <div><span>Net worth</span><strong>{cash(summary.netWorth)}</strong><small>{amountInWords(Math.abs(summary.netWorth), CUR)}</small></div>
          <div><span>FIRE number</span><strong>{amountInWords(summary.fireNumber, CUR) || "—"}</strong><small>25–30× yearly spending</small></div>
        </div>
        {sections.map(section => <div className="qn-group" key={section}>
          <h2>{section}</h2>
          {visible.filter(q => q.section === section).map(q => <button type="button" key={q.id} className="qn-row" onClick={() => setStep(visible.indexOf(q))}>
            <span className="qn-row-emoji">{q.emoji}</span><span className="qn-row-q">{q.title}</span><b>{answerText(q)}</b><Pencil size={14} />
          </button>)}
          {section === "What you own" && portfolio && <Link href="/accounts" className="qn-row qn-linked">
            <span className="qn-row-emoji">🔗</span><span className="qn-row-q">From your Portfolio{portfolio.hasAssets ? ` · FIRE money ${cash(portfolio.fireAccessible)} · ${CUR === "IN" ? "EPF/PPF/NPS" : "gratuity/pension"} ${cash(portfolio.laterRetirement)} · home & other ${cash(portfolio.home + portfolio.otherOutside)}` : ""}{portfolio.hasLoans ? ` · loans ${cash(portfolio.totalLiabilities)}` : ""}</span><b>Edit there</b><Pencil size={14} />
          </Link>}
        </div>)}
        <details className="qn-voice"><summary>🎙️ Update several answers by voice</summary><VoiceEntry hint="For example: income 1.2 lakh, expenses 65 thousand, monthly investment 30000, emergency fund 2.6 lakh" hindiHint="आमदनी 1.2 लाख, खर्च 65 हज़ार, मासिक निवेश 30000" applyLabel="Fill answers" onApply={applyVoiceEntry} /></details>
        {message && <p className="profile-status" role="status">{message}</p>}
        <div className="qn-save">
          <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving || !profile.age}>{saving ? "Saving…" : "Save my profile"}</button>
          <Link href="/journey" className="text-link">Go to Home →</Link>
        </div>
        <p className="profile-privacy">Insurance amounts are self-reported for planning context; the app does not judge whether a policy is suitable. Detailed records in Portfolio replace these estimates in calculations.</p>
      </section>
    )}
  </main><Footer /></>;
}
