"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Landmark, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ImportHoldings from "@/components/portfolio/ImportHoldings";
import VoiceEntry from "@/components/forms/VoiceEntry";
import { parseSpokenAmount } from "@/lib/voiceForms";
import { amountInWords } from "@/lib/format";
import { goalCategories } from "@/lib/goals";
import { useCountry } from "@/lib/useCountry";
import { shortCountryMoney, type CountryCode } from "@/lib/country";
import { bucketOf, duplicateGroups, existingSameItem, getNetWorthBreakdown, sameTypeItems, propertyTreatment, type Bucket, propertyUseLabels, type FireTreatment, type PropertyUse } from "@/lib/netWorth";

type Kind = "asset" | "liability";
type Category = "cash" | "investment" | "property" | "vehicle" | "home_loan" | "vehicle_loan" | "education_loan" | "personal_loan" | "gold_loan" | "credit_card" | "other";
type InvestmentType = "mutual_fund" | "stocks" | "bonds" | "fixed_deposit" | "nps_tier_1" | "nps_tier_2" | "provident_fund" | "ppf" | "gold" | "crypto" | "other" | "gratuity" | "workplace_savings" | "pension";
type Account = { id: string; created_at?: string | null; updated_at?: string | null; kind: Kind; category: Category; name: string; current_value: number; interest_rate: number | null; monthly_payment: number; is_high_interest: boolean; investment_type: InvestmentType | null; fire_treatment: FireTreatment; available_from_age: number | null; property_use: PropertyUse | null; goal_id?: string | null };
type AccountForm = { kind: Kind; category: Category; name: string; current_value: string; interest_rate: string; monthly_payment: string; is_high_interest: boolean; investment_type: InvestmentType | ""; fire_treatment: FireTreatment; available_from_age: string; property_use: PropertyUse; goal_id: string };
const blank: AccountForm = { kind: "asset", category: "cash", name: "", current_value: "", interest_rate: "", monthly_payment: "", is_high_interest: false, investment_type: "", fire_treatment: "available", available_from_age: "", property_use: "self_occupied", goal_id: "" };
const categoryLabels: Record<Category, string> = { cash: "Cash & deposits", investment: "Investments", property: "Property", vehicle: "Vehicle", home_loan: "Home loan", vehicle_loan: "Vehicle loan", education_loan: "Education loan", personal_loan: "Personal loan", gold_loan: "Gold loan", credit_card: "Credit card", other: "Other" };
const investmentLabels: Record<InvestmentType, string> = { mutual_fund: "Mutual funds", stocks: "Stocks", bonds: "Bonds", fixed_deposit: "Fixed deposits", nps_tier_1: "NPS Tier I", nps_tier_2: "NPS Tier II", provident_fund: "EPF / PF", ppf: "PPF", gold: "Gold", crypto: "Crypto", other: "Other investment", gratuity: "End-of-service gratuity", workplace_savings: "Workplace savings (DEWS)", pension: "Pension (GPSSA)" };
const defaultTreatment = (category: Category, investmentType: InvestmentType | "", propertyUse: PropertyUse = "self_occupied"): FireTreatment => category === "property" ? propertyTreatment(propertyUse) : category === "vehicle" || category === "other" ? "excluded" : ["nps_tier_1", "provident_fund", "ppf"].includes(investmentType) ? "later" : "available";

// One tap picks everything technical (type, category, investment type, FIRE treatment); users only enter the value.
type Preset = { id: string; emoji: string; label: string; kind: Kind; category: Category; investment_type?: InvestmentType; property_use?: PropertyUse; fire: FireTreatment; age?: string; highInterest?: boolean; only?: CountryCode };
const portfolioPresets: Preset[] = [
  { id: "cash", emoji: "💵", label: "Savings & cash", kind: "asset", category: "cash", fire: "available" },
  { id: "mf", emoji: "📊", label: "Mutual funds", kind: "asset", category: "investment", investment_type: "mutual_fund", fire: "available" },
  { id: "stocks", emoji: "📈", label: "Stocks", kind: "asset", category: "investment", investment_type: "stocks", fire: "available" },
  { id: "fd", emoji: "🏦", label: "Fixed deposit", kind: "asset", category: "investment", investment_type: "fixed_deposit", fire: "available" },
  { id: "gold", emoji: "🪙", label: "Investment gold (coins, bars, SGB, ETF)", kind: "asset", category: "investment", investment_type: "gold", fire: "available" },
  { id: "jewellery", emoji: "💍", label: "Gold jewellery you’ll keep", kind: "asset", category: "other", fire: "excluded" },
  { id: "bonds", emoji: "📜", label: "Bonds", kind: "asset", category: "investment", investment_type: "bonds", fire: "available" },
  { id: "epf", emoji: "🏛️", label: "EPF / PF", kind: "asset", category: "investment", investment_type: "provident_fund", fire: "later", age: "58", only: "IN" },
  { id: "ppf", emoji: "🔐", label: "PPF", kind: "asset", category: "investment", investment_type: "ppf", fire: "later", only: "IN" },
  { id: "nps", emoji: "👴", label: "NPS", kind: "asset", category: "investment", investment_type: "nps_tier_1", fire: "later", age: "60", only: "IN" },
  { id: "gratuity", emoji: "🧳", label: "End-of-service gratuity", kind: "asset", category: "investment", investment_type: "gratuity", fire: "later", only: "AE" },
  { id: "dews", emoji: "🏛️", label: "Workplace savings (DEWS)", kind: "asset", category: "investment", investment_type: "workplace_savings", fire: "later", only: "AE" },
  { id: "gpssa", emoji: "👴", label: "Pension (GPSSA)", kind: "asset", category: "investment", investment_type: "pension", fire: "later", age: "60", only: "AE" },
  { id: "home-savings", emoji: "🏡", label: "Savings back home (NRE/NRO)", kind: "asset", category: "cash", fire: "available", only: "AE" },
  { id: "crypto", emoji: "💠", label: "Crypto", kind: "asset", category: "investment", investment_type: "crypto", fire: "available" },
  { id: "home", emoji: "🏠", label: "Home I live in", kind: "asset", category: "property", property_use: "self_occupied", fire: "excluded" },
  { id: "rented", emoji: "🏘️", label: "Rented-out property", kind: "asset", category: "property", property_use: "rented", fire: "available" },
  { id: "plot", emoji: "🌳", label: "Plot / land", kind: "asset", category: "property", property_use: "investment", fire: "available" },
  { id: "vehicle", emoji: "🚗", label: "Car / bike", kind: "asset", category: "vehicle", fire: "excluded" },
  { id: "home-loan", emoji: "🏠", label: "Home loan", kind: "liability", category: "home_loan", fire: "excluded" },
  { id: "car-loan", emoji: "🚗", label: "Car / bike loan", kind: "liability", category: "vehicle_loan", fire: "excluded" },
  { id: "personal-loan", emoji: "💸", label: "Personal loan", kind: "liability", category: "personal_loan", fire: "excluded", highInterest: true },
  { id: "gold-loan", emoji: "🪙", label: "Gold loan", kind: "liability", category: "gold_loan", fire: "excluded" },
  { id: "credit-card", emoji: "💳", label: "Credit card dues", kind: "liability", category: "credit_card", fire: "excluded", highInterest: true },
  { id: "edu-loan", emoji: "🎓", label: "Education loan", kind: "liability", category: "education_loan", fire: "excluded" },
  { id: "other-loan", emoji: "🧾", label: "Other loan", kind: "liability", category: "other", fire: "excluded" },
];
const findPreset = (v: AccountForm) => portfolioPresets.find(p => p.kind === v.kind && p.category === v.category && !(p.id === "home-savings") && (p.investment_type ?? "") === (v.category === "investment" ? v.investment_type : "") && (v.category !== "property" || p.property_use === v.property_use));

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [values, setValues] = useState<AccountForm>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [profileTotals, setProfileTotals] = useState({ assets: 0, liabilities: 0, fireAccessible: 0, laterRetirement: 0, splitComplete: false });
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState(false);
  const [matches, setMatches] = useState<Account[]>([]); // items of the type being added: offer to update them instead
  const [lastValue, setLastValue] = useState<{ value: number; at: string | null } | null>(null);
  const [lastPreset, setLastPreset] = useState<Preset | null>(null);
  const [goals, setGoals] = useState<{ id: string; name: string; emoji: string; done: boolean }[]>([]);
  const { country, code } = useCountry();
  const goalName = (id?: string | null) => { const goal = goals.find(item => item.id === id); return goal ? `${goal.emoji} ${goal.name}` : null; };

  async function load() {
    const supabase = createClient();
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSignedIn(false); setLoading(false); return; }
    setSignedIn(true);
    const [accountResult, profileResult, goalsResult] = await Promise.all([
      supabase.from("financial_accounts").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
      supabase.from("financial_profiles").select("currency, assets, liabilities, fire_accessible_assets, later_retirement_assets").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("financial_goals").select("id, name, category, completed_at").eq("user_id", session.user.id).order("target_date"),
    ]);
    setGoals((goalsResult.data ?? []).map(goal => ({ id: goal.id, name: goal.name, emoji: goalCategories.find(category => category.id === goal.category)?.emoji ?? "🎯", done: Boolean(goal.completed_at) })));
    if (accountResult.error) setMessage(accountResult.error.message.includes("property_use") ? "Run supabase/migrations/202611260014_property_use.sql in the Supabase SQL editor, then refresh this page." : `Could not load assets and loans. Run the financial accounts migration in Supabase. Details: ${accountResult.error.message}`);
    else setAccounts((accountResult.data ?? []).map(row => ({ ...row, current_value: Number(row.current_value), interest_rate: row.interest_rate === null ? null : Number(row.interest_rate), monthly_payment: Number(row.monthly_payment) })) as Account[]);
    if (profileResult.data?.currency) {
      const profile = profileResult.data;
      setCurrency(profile.currency);
      setProfileTotals({
        assets: Number(profile.assets), liabilities: Number(profile.liabilities),
        fireAccessible: profile.fire_accessible_assets === null ? Number(profile.assets) : Number(profile.fire_accessible_assets),
        laterRetirement: Number(profile.later_retirement_assets ?? 0),
        splitComplete: profile.fire_accessible_assets !== null && profile.later_retirement_assets !== null,
      });
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const breakdown = useMemo(() => getNetWorthBreakdown(accounts), [accounts]);
  const totals = { assets: breakdown.totalAssets, fireAccessible: breakdown.fireAccessible, laterRetirement: breakdown.laterRetirement, liabilities: breakdown.totalLiabilities };

  const money = (value: number) => new Intl.NumberFormat(currency === "INR" ? "en-IN" : currency === "AED" ? "en-AE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const assetCount = accounts.filter(account => account.kind === "asset").length;
  const liabilityCount = accounts.filter(account => account.kind === "liability").length;
  const effectiveAssets = assetCount ? totals.assets : profileTotals.assets;
  const effectiveLiabilities = liabilityCount ? totals.liabilities : profileTotals.liabilities;
  const effectiveFire = assetCount ? totals.fireAccessible : profileTotals.fireAccessible;

  function startEdit(account: Account) {
    setEditingId(account.id);
    setValues({ kind: account.kind, category: account.category, name: account.name, current_value: String(account.current_value), interest_rate: account.interest_rate?.toString() ?? "", monthly_payment: String(account.monthly_payment), is_high_interest: account.is_high_interest, investment_type: account.investment_type ?? "", fire_treatment: account.fire_treatment, available_from_age: account.available_from_age?.toString() ?? "", property_use: account.property_use ?? "self_occupied", goal_id: account.goal_id ?? "" });
    setPicked(true);
    setMatches([]); setLastValue(null);
    document.getElementById("add-record")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  /** Update a saved item with today's value (instead of adding it again). */
  function updateExisting(account: Account) {
    startEdit(account);
    setValues(current => ({ ...current, current_value: "" }));
    setLastValue({ value: account.current_value, at: account.updated_at ?? account.created_at ?? null });
  }
  async function keepNewest(group: Account[]) {
    const supabase = createClient();
    if (!supabase) return;
    const old = group.slice(1).map(a => a.id);
    const { error } = await supabase.from("financial_accounts").delete().in("id", old);
    if (error) { setMessage(error.message); return; }
    setMessage(`✅ Kept ${group[0].name} at ${money(group[0].current_value)} and removed ${old.length} older cop${old.length === 1 ? "y" : "ies"}.`);
    await load();
  }

  function applyVoiceEntry(transcript: string) {
    const lower = transcript.toLowerCase();
    const kind: Kind = /\b(loan|liability|debt|credit card|mortgage|karz)\b|कर्ज|ऋण|लोन|क्रेडिट कार्ड/.test(lower) ? "liability" : "asset";
    let category: Category = "other";
    let investmentType: InvestmentType | "" = "";
    if (kind === "liability") {
      category = /\b(vehicle|car|auto)\b|गाड़ी/.test(lower) && /\bloan\b|लोन|कर्ज/.test(lower) ? "vehicle_loan"
        : /\b(home|house|mortgage)\b|घर|मकान/.test(lower) ? "home_loan"
          : /credit card|क्रेडिट कार्ड/.test(lower) ? "credit_card"
            : /education loan|student loan/.test(lower) ? "education_loan"
              : /gold loan|गोल्ड लोन|सोने पर (लोन|कर्ज)/.test(lower) ? "gold_loan"
              : /personal loan/.test(lower) ? "personal_loan" : "other";
    } else if (/\b(property|house|home|real estate|flat|apartment|plot|land|villa|shop)\b|प्रॉपर्टी|मकान|घर|फ्लैट|प्लॉट|जमीन|ज़मीन|दुकान/.test(lower)) category = "property";
    else if (/\b(vehicle|car|auto)\b|गाड़ी/.test(lower)) category = "vehicle";
    else if (/\b(cash|savings account|bank account|deposit)\b|बचत खाता|बैंक खाता/.test(lower)) category = "cash";
    else {
      category = "investment";
      investmentType = /mutual fund|म्यूचुअल फंड/.test(lower) ? "mutual_fund"
        : /\bstocks?\b|\bequity\b/.test(lower) ? "stocks"
          : /\bbonds?\b/.test(lower) ? "bonds"
            : /fixed deposit|\bfd\b/.test(lower) ? "fixed_deposit"
              : /nps.*tier\s*(?:2|ii)/.test(lower) ? "nps_tier_2"
                : /nps/.test(lower) ? "nps_tier_1"
                  : /\b(epf|provident fund|pf)\b/.test(lower) ? "provident_fund"
                    : /\bppf\b/.test(lower) ? "ppf"
              : /\bgold\b|सोना/.test(lower) ? "gold"
                        : /\bcrypto(?:currency)?\b/.test(lower) ? "crypto" : "";
    }
    const amountPhrase = transcript.match(/(?:worth|valued at|value|balance|amount|की कीमत|मूल्य|राशि)\s+(.+)/i)?.[1] ?? transcript;
    const amount = parseSpokenAmount(amountPhrase);
    if (amount === null) {
      setMessage("I couldn’t find an amount. Try: mutual fund worth 250000, or पीपीएफ की कीमत 250000.");
      return;
    }
    const named = transcript.match(/\b(?:named|called)\s+(.+?)(?=\s+\b(?:worth|valued at|value|balance|amount)\b|$)/i)?.[1]?.trim();
    const name = named || (kind === "liability" ? categoryLabels[category] : investmentType ? investmentLabels[investmentType] : categoryLabels[category]);
    const propertyUse: PropertyUse = /\b(rent|rented|renting|tenant|lease|leased)\b|किराए|किराये/.test(lower) ? "rented" : /\b(plot|land|investment)\b|प्लॉट|ज़मीन|जमीन|निवेश/.test(lower) ? "investment" : "self_occupied";
    const treatment = kind === "asset" ? defaultTreatment(category, investmentType, propertyUse) : "excluded";
    setValues(current => ({ ...current, kind, category, name, current_value: String(amount), investment_type: investmentType, fire_treatment: treatment, available_from_age: "", property_use: propertyUse }));
    setMessage("Record fields filled from your note. Check the category, name, amount and FIRE treatment before saving.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sign in to save your records.");
      const isProperty = values.kind === "asset" && values.category === "property";
      const treatment = values.kind !== "asset" ? "excluded" : isProperty ? propertyTreatment(values.property_use) : values.fire_treatment;
      // Only usable-now assets can be set aside for a goal. Send goal_id only when relevant, so saving still works before the goal-link migration.
      const goalId = values.kind === "asset" && treatment === "available" && values.goal_id ? values.goal_id : null;
      const wasLinked = Boolean(editingId && accounts.find(account => account.id === editingId)?.goal_id);
      const goalPatch: { goal_id?: string | null } = goalId || wasLinked ? { goal_id: goalId } : {};
      const payload = { user_id: session.user.id, kind: values.kind, category: values.category, name: values.name.trim(), current_value: Number(values.current_value), interest_rate: values.interest_rate ? Number(values.interest_rate) : null, monthly_payment: values.kind === "liability" ? Number(values.monthly_payment || 0) : 0, is_high_interest: values.kind === "liability" && values.is_high_interest, investment_type: values.kind === "asset" && values.category === "investment" && values.investment_type ? values.investment_type : null, fire_treatment: treatment, available_from_age: values.kind === "asset" && treatment === "later" && values.available_from_age ? Number(values.available_from_age) : null, property_use: isProperty ? values.property_use : null, ...goalPatch, updated_at: new Date().toISOString() };
      // Same type and same name as a saved item = a new value for it, not a second holding.
      const same = editingId ? null : existingSameItem(accounts, { kind: payload.kind, category: payload.category, investment_type: payload.investment_type, property_use: payload.property_use, name: payload.name });
      const targetId = editingId ?? same?.id ?? null;
      const request = targetId ? supabase.from("financial_accounts").update(payload).eq("id", targetId) : supabase.from("financial_accounts").insert(payload);
      const { error } = await request;
      if (error) throw error;
      setValues(blank); setEditingId(null); setPicked(false); setMatches([]); setLastValue(null);
      setMessage(same ? `✅ Updated your existing “${same.name}” from ${money(same.current_value)} to ${money(payload.current_value)}. It isn’t counted twice.` : `✅ Saved. Add another, or check “Where your net worth sits” above.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this record."); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("financial_accounts").delete().eq("id", id);
    if (error) setMessage(error.message); else { setAccounts(current => current.filter(item => item.id !== id)); setMessage("Record removed."); }
  }

  function pickPreset(preset: Preset) {
    setEditingId(null);
    setValues({ ...blank, kind: preset.kind, category: preset.category, name: preset.label, investment_type: preset.investment_type ?? "", property_use: preset.property_use ?? "self_occupied", fire_treatment: preset.fire, available_from_age: preset.age ?? "", is_high_interest: Boolean(preset.highInterest) });
    setPicked(true);
    setMessage("");
    setLastValue(null);
    setLastPreset(preset);
    // Already have this type? Update it by default (people usually track the total value, e.g. all mutual funds).
    const same = sameTypeItems(accounts, { kind: preset.kind, category: preset.category, investment_type: preset.investment_type ?? null, property_use: preset.category === "property" ? preset.property_use ?? "self_occupied" : null });
    if (same.length) { updateExisting(same[0]); setMatches(same); } else setMatches([]);
  }
  /** Opt out of the default update: add a separate holding of this type with its own name. */
  function addSeparate() {
    if (!lastPreset) return;
    setEditingId(null); setLastValue(null); setMatches([]);
    setValues({ ...blank, kind: lastPreset.kind, category: lastPreset.category, name: "", investment_type: lastPreset.investment_type ?? "", property_use: lastPreset.property_use ?? "self_occupied", fire_treatment: lastPreset.fire, available_from_age: lastPreset.age ?? "", is_high_interest: Boolean(lastPreset.highInterest) });
  }
  function resetForm() { setValues(blank); setEditingId(null); setPicked(false); setMatches([]); setLastValue(null); setLastPreset(null); }
  const dupes = duplicateGroups(accounts);
  const activePreset = picked ? findPreset(values) : undefined;

  return <><Header /><main className="accounts-page container">
    <div className="profile-heading"><p className="eyebrow"><Landmark size={14} /> YOUR BALANCE SHEET</p><h1>Assets and loans.</h1><p>Track each item to make your net worth and debt score more useful. Enter amounts in {currency}.</p></div>
    {!loading && !signedIn ? <section className="profile-card"><p>Sign in to manage your financial records.</p><Link href="/" className="button button-primary">Return home to sign in</Link></section> : loading ? <p className="profile-status">Loading financial records…</p> : <>
      <section className="account-totals portfolio-totals"><div><span>💼 Overall portfolio</span><small>Everything you own</small><strong>{money(effectiveAssets)}</strong></div><div className="fire-total"><span>🔥 FIRE portfolio</span><small>Counts toward financial freedom</small><strong>{money(effectiveFire)}</strong></div><div><span>🎯 Set aside for goals</span><small>House, kids, trips — not FIRE</small><strong>{money(breakdown.goalMoney)}</strong></div><div><span>Net worth</span><small>Everything you own minus loans</small><strong>{money(effectiveAssets - effectiveLiabilities)}</strong></div></section>
      {dupes.length > 0 && <section className="dup-warning" role="alert">
        <strong>⚠️ Some items are counted more than once</strong>
        {dupes.map(g => <div key={g[0].id} className="dup-row">
          <p>“{g[0].name}” is saved {g.length} times ({g.map(a => money(a.current_value)).join(" + ")} = <b>{money(g.reduce((s, a) => s + a.current_value, 0))}</b>). If the newest value, {money(g[0].current_value)}, is the current one, keep just that.</p>
          <button type="button" className="button button-primary" onClick={() => void keepNewest(g)}>Keep only {money(g[0].current_value)}</button>
        </div>)}
        <small>Different funds or accounts? Give each its own name with ✏️ and this warning goes away.</small>
      </section>}
      <ImportHoldings existing={accounts as unknown as { id: string; name: string; current_value: number; external_id?: string | null; source?: string | null }[]} country={code} onImported={() => void load()} />
      {accounts.length > 0 && (() => {
        // Each group lists its own items, so it's always clear where something was counted.
        const itemsIn = (bucket: Bucket) => { const list = accounts.filter(a => bucketOf(a) === bucket).sort((x, y) => y.current_value - x.current_value); return list.length ? <small className="nw-items">{list.slice(0, 4).map(a => `${a.name} ${shortCountryMoney(a.current_value, code)}`).join(" · ")}{list.length > 4 ? ` · +${list.length - 4} more` : ""}</small> : null; };
        const profileLoans = liabilityCount === 0 ? profileTotals.liabilities : 0; // loans from the profile when none are itemised
        return <section className="networth-breakdown">
        <h2>Where your net worth sits</h2>
        <div className="mix-bar">{[["fire", breakdown.fireInvestments], ["prop", breakdown.investmentProperty], ["goal", breakdown.goalMoney], ["later", breakdown.laterRetirement], ["home", breakdown.home], ["other", breakdown.otherOutside]].map(([key, value]) => <span key={key as string} className={`nw-${key}`} style={{ width: `${breakdown.totalAssets > 0 ? Number(value) / breakdown.totalAssets * 100 : 0}%` }} />)}</div>
        <div className="nw-rows">
          <div className="nw-group"><b>Counts toward FIRE</b><span><i className="nw-fire" />Cash & investments<strong>{money(breakdown.fireInvestments)}</strong></span>{itemsIn("fireInvestments")}<span><i className="nw-prop" />Rented / investment property<strong>{money(breakdown.investmentProperty)}</strong></span>{itemsIn("investmentProperty")}</div>
          <div className="nw-group"><b>Not in your FIRE portfolio</b><span><i className="nw-goal" />Set aside for goals<strong>{money(breakdown.goalMoney)}</strong></span>{itemsIn("goalMoney")}<span><i className="nw-later" />EPF, PPF, NPS (later access)<strong>{money(breakdown.laterRetirement)}</strong></span>{itemsIn("laterRetirement")}<span><i className="nw-home" />Home you live in<strong>{money(breakdown.home)}</strong></span>{itemsIn("home")}<span><i className="nw-other" />Vehicles, jewellery & other<strong>{money(breakdown.otherOutside)}</strong></span>{itemsIn("otherOutside")}</div>
          <div className="nw-group"><b>Loans</b><span>Home loans<strong>−{money(breakdown.homeLoan)}</strong></span>{itemsIn("homeLoan")}<span>Other loans<strong>−{money(breakdown.otherLoans)}</strong></span>{itemsIn("otherLoans")}{profileLoans > 0 && <><span>Loans from your profile<strong>−{money(profileLoans)}</strong></span><small className="nw-items">Not itemised yet. Add each loan above to see it here.</small></>}{breakdown.home > 0 && <span>Equity in your home<strong>{money(breakdown.homeEquity)}</strong></span>}</div>
        </div>
        <p className="account-source-note">Net worth = {money(breakdown.totalAssets)} assets − {money(breakdown.totalLiabilities + profileLoans)} loans = <b>{money(breakdown.netWorth - profileLoans)}</b>. Your FIRE progress uses only the “Counts toward FIRE” group — goal money and your home are left out: <b>{money(breakdown.fireAccessible)}</b>.</p>
      </section>; })()}
      {!assetCount && !profileTotals.splitComplete && <p className="account-source-note">Your profile asset estimate has not been classified yet, so the FIRE-accessible figure temporarily uses the full estimate. Update the split in <Link href="/profile">your profile</Link>, or add itemized assets below.</p>}
      <p className="account-source-note">🔗 Items you add here replace the rough totals from your profile everywhere — score, FIRE plan and Home. Add each item once.</p>
      <form className="profile-card account-form" onSubmit={save} id="add-record">
        {!picked ? <>
          <p className="eyebrow">ADD TO YOUR PORTFOLIO</p>
          <h2 className="add-title">What do you want to add?</h2>
          <p className="add-group-label">💰 Things you own</p>
          <div className="qn-tiles add-tiles">{portfolioPresets.filter(preset => preset.kind === "asset" && (!preset.only || preset.only === country.code)).map(preset => <button type="button" key={preset.id} className="qn-tile" onClick={() => pickPreset(preset)}><span>{preset.emoji}</span>{preset.label}<small>{preset.fire === "available" ? "Counts for FIRE" : preset.fire === "later" ? "Retirement money" : "Net worth only"}</small></button>)}</div>
          <p className="add-group-label">🧾 Loans you owe</p>
          <div className="qn-tiles add-tiles">{portfolioPresets.filter(preset => preset.kind === "liability" && (!preset.only || preset.only === country.code)).map(preset => <button type="button" key={preset.id} className="qn-tile loan" onClick={() => pickPreset(preset)}><span>{preset.emoji}</span>{preset.label}</button>)}</div>
          <details className="qn-voice"><summary>🎙️ Or just say it — {country.code === "IN" ? "“mutual fund worth 2.5 lakh”, “car loan 3 lakh”" : "“stocks worth 50 thousand”, “car loan 40 thousand”"}</summary><VoiceEntry hint="For example: mutual fund worth 2.5 lakh, or rented flat worth 50 lakh, or car loan balance 3 lakh" hindiHint="म्यूचुअल फंड की कीमत 2.5 लाख, या कार लोन 3 लाख" applyLabel="Fill it in" onApply={transcript => { applyVoiceEntry(transcript); setPicked(true); }} /></details>
        </> : <>
          <div className="add-picked"><span className="add-picked-emoji">{activePreset?.emoji ?? "📝"}</span><div><p className="eyebrow">{editingId ? "EDITING" : "ADDING"}</p><h2>{activePreset?.label ?? (values.kind === "asset" ? "Asset" : "Loan")}</h2></div><button type="button" className="text-link" onClick={resetForm}>{editingId ? "Cancel" : "Change"}</button></div>
          <span className={`fire-badge ${values.kind === "liability" ? "loan" : values.goal_id && values.fire_treatment === "available" ? "goal" : values.fire_treatment}`}>{values.kind === "liability" ? "🧾 Reduces your net worth" : values.fire_treatment === "available" && values.goal_id ? `🎯 Set aside for ${goalName(values.goal_id) ?? "a goal"}` : values.fire_treatment === "available" ? "✅ Counts toward your FIRE number" : values.fire_treatment === "later" ? "🔒 Retirement money — counts from the age you can access it" : "🏠 Adds to net worth, not to FIRE"}</span>
          {editingId && matches.length > 0 && <div className="update-existing">
            <strong>🔄 Updating “{values.name}”</strong>
            <p>Enter today’s total value. It replaces the old one, so nothing is counted twice.</p>
            {matches.length > 1 && <div className="update-existing-list">{matches.map(m => <button key={m.id} type="button" className={`qn-choice${m.id === editingId ? " selected" : ""}`} onClick={() => { updateExisting(m); setMatches(matches); }}>{m.name} · {money(m.current_value)}</button>)}</div>}
            <small>Holding this separately (e.g. another fund you track on its own)? <button type="button" className="text-link" onClick={addSeparate}>Add a separate one instead</button></small>
          </div>}
          {!editingId && lastPreset && matches.length === 0 && accounts.some(a => sameTypeItems([a], { kind: lastPreset.kind, category: lastPreset.category, investment_type: lastPreset.investment_type ?? null, property_use: lastPreset.category === "property" ? lastPreset.property_use ?? "self_occupied" : null }).length) && <p className="update-existing-note">Give this one its own name (e.g. the fund’s name) so it’s kept apart from your other {lastPreset.label.toLowerCase()}.</p>}
          <div className="account-form-grid">
            <label className="profile-field"><span>Name it (so you recognise it)</span><input value={values.name} onChange={event => setValues(current => ({ ...current, name: event.target.value }))} required maxLength={80} /></label>
            <label className="profile-field"><span>{values.kind === "asset" ? "What’s it worth today?" : "How much is still owed?"} ({country.symbol})</span><input type="number" inputMode="numeric" min="0" step="any" value={values.current_value} autoFocus onChange={event => setValues(current => ({ ...current, current_value: event.target.value }))} required />{lastValue && <small className="qn-words">Last saved: {money(lastValue.value)}{lastValue.at ? ` on ${new Date(lastValue.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}. Enter today’s value; it replaces the old one.</small>}{Number(values.current_value) > 0 && <small className="qn-words">= {amountInWords(Number(values.current_value), country.code)} {country.code === "IN" ? "rupees" : "dirhams"}</small>}</label>
            {values.kind === "asset" && values.fire_treatment === "available" && <label className="profile-field money-for"><span>What is this money for?</span>
              <select value={values.goal_id} onChange={event => setValues(current => ({ ...current, goal_id: event.target.value }))}>
                <option value="">🔥 My financial freedom (FIRE)</option>
                {goals.filter(goal => !goal.done || goal.id === values.goal_id).map(goal => <option key={goal.id} value={goal.id}>{goal.emoji} Goal: {goal.name}</option>)}
              </select>
              <small>{values.goal_id ? "Counts toward this goal — kept out of your FIRE portfolio so nothing is counted twice." : goals.length ? "Saving this for a house, kids or a trip? Pick that goal instead." : <>Saving for a house, kids or a trip? <a href="/goals">Create that goal</a> and link this money to it.</>}</small>
            </label>}
            {values.kind === "liability" && <>
              <label className="profile-field"><span>Monthly EMI / payment ({country.symbol})</span><input type="number" inputMode="numeric" min="0" step="any" value={values.monthly_payment} onChange={event => setValues(current => ({ ...current, monthly_payment: event.target.value }))} /></label>
              <label className="profile-field"><span>Interest rate % (optional)</span><input type="number" min="0" max="100" step="any" value={values.interest_rate} onChange={event => { const rate = event.target.value; setValues(current => ({ ...current, interest_rate: rate, is_high_interest: rate ? Number(rate) >= 14 : current.is_high_interest })); }} /><small>14% or more is marked as expensive debt automatically.</small></label>
            </>}
            {values.kind === "asset" && values.fire_treatment === "later" && <label className="profile-field"><span>Age you can withdraw it (optional)</span><input type="number" min="18" max="100" step="1" value={values.available_from_age} onChange={event => setValues(current => ({ ...current, available_from_age: event.target.value }))} /><small>{country.code === "IN" ? "Usually 58 for EPF, 60 for NPS." : "Gratuity is paid when you leave your job; pensions usually from 60."} Check your scheme’s rules.</small></label>}
          </div>
          {values.kind === "asset" && <details className="add-advanced"><summary>Change how this counts</summary>
            {values.category === "property"
              ? <label className="profile-field"><span>How is this property used?</span><select value={values.property_use} onChange={event => { const use = event.target.value as PropertyUse; setValues(current => ({ ...current, property_use: use, fire_treatment: propertyTreatment(use) })); }}>{(Object.keys(propertyUseLabels) as PropertyUse[]).map(use => <option key={use} value={use}>{propertyUseLabels[use]}</option>)}</select></label>
              : <label className="profile-field"><span>For FIRE, this money is…</span><select value={values.fire_treatment} onChange={event => setValues(current => ({ ...current, fire_treatment: event.target.value as FireTreatment }))}><option value="available">Usable now — count it</option><option value="later">Locked until retirement</option><option value="excluded">Not for FIRE (keep it out)</option></select></label>}
          </details>}
          {values.kind === "liability" && <label className="profile-check"><input type="checkbox" checked={values.is_high_interest} onChange={event => setValues(current => ({ ...current, is_high_interest: event.target.checked }))} /><span>This is expensive debt (credit card, personal loan)</span></label>}
          <div className="add-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add to portfolio"}</button><button type="button" className="text-link" onClick={resetForm}>Cancel</button></div>
        </>}
        {message && <p className="profile-status" role="status">{message}</p>}
      </form>
      <section className="account-list"><h2>Saved records</h2>{accounts.length === 0 ? <p className="profile-status">No detailed records yet. Add assets and loans above. Your profile totals continue to be used until you add records.</p> : accounts.map(account => <article className="account-row" key={account.id}><div className={`account-kind ${account.kind}`}>{account.kind === "asset" ? "ASSET" : "DEBT"}</div><div className="account-main"><strong>{account.name}</strong><span>{categoryLabels[account.category]}{account.category === "property" ? ` · ${account.property_use === "rented" ? "Rented out" : account.property_use === "investment" ? "Investment" : "Your home"}` : ""}{account.investment_type ? ` · ${investmentLabels[account.investment_type]}` : ""}{account.goal_id && goalName(account.goal_id) ? ` · 🎯 For ${goalName(account.goal_id)}` : ""}{account.kind === "asset" ? ` · ${account.fire_treatment === "available" ? (account.goal_id ? "Goal money" : "FIRE now") : account.fire_treatment === "later" ? `Later${account.available_from_age ? ` · estimated access age ${account.available_from_age}` : " · access age not set"}` : "Outside FIRE"}` : account.is_high_interest ? " · High interest" : ""}</span></div><div className="account-balance"><strong>{money(account.current_value)}</strong>{account.kind === "liability" && <small>{account.interest_rate ?? "Rate n/a"}% · {money(account.monthly_payment)}/mo</small>}</div><button className="icon-button" onClick={() => startEdit(account)} aria-label={`Edit ${account.name}`}><Pencil size={16} /></button><button className="icon-button danger" onClick={() => void remove(account.id)} aria-label={`Delete ${account.name}`}><Trash2 size={16} /></button></article>)}</section>
      <p className="profile-privacy">Records are private to your account. This tracker is for planning and does not verify balances or recommend borrowing or investments.</p>
    </>}
  </main><Footer /></>;
}