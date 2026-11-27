"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Lightbulb, Scale, Sprout } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { formatCountryMoney } from "@/lib/country";
import { breakEvenExtraDeductions, compareRegimes, EMPTY_TAX_INPUTS, financialYear, hraExemption, LIMITS, ltcgHarvest, oldRegimeOpportunities, type TaxInputs } from "@/lib/tax";

const money = (value: number) => formatCountryMoney(Math.round(value), "IN");
const storageKey = (userId: string) => `ff-tax:${userId}`;
type Saved = { inputs: TaxInputs; ltcgGain: number; ltcgBooked: number };

/** A ₹ amount field that takes yearly figures (with a monthly helper where people think monthly). */
function Amount({ label, hint, value, onChange, monthly }: { label: string; hint?: string; value: number; onChange: (v: number) => void; monthly?: boolean }) {
  const [perMonth, setPerMonth] = useState(false);
  const shown = perMonth ? Math.round(value / 12) : value;
  return <label className="tax-field">
    <span>{label}{monthly && <button type="button" className="tax-unit" onClick={() => setPerMonth(!perMonth)}>{perMonth ? "per month" : "per year"} ⇄</button>}</span>
    <input type="number" inputMode="numeric" min={0} value={shown || ""} placeholder="0" onChange={event => { const v = Math.max(0, Number(event.target.value) || 0); onChange(perMonth ? v * 12 : v); }} />
    {hint && <small>{hint}</small>}
  </label>;
}

export default function TaxPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<TaxInputs>(EMPTY_TAX_INPUTS);
  const [ltcgGain, setLtcgGain] = useState(0);
  const [ltcgBooked, setLtcgBooked] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      let id = "guest";
      try { const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } }; if (session?.user) id = session.user.id; } catch { /* stays guest */ }
      setUserId(id);
      try {
        const raw = localStorage.getItem(storageKey(id));
        if (raw) { const saved = JSON.parse(raw) as Saved; setInputs({ ...EMPTY_TAX_INPUTS, ...saved.inputs }); setLtcgGain(saved.ltcgGain || 0); setLtcgBooked(saved.ltcgBooked || 0); }
      } catch { /* start fresh */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !userId) return;
    try { localStorage.setItem(storageKey(userId), JSON.stringify({ inputs, ltcgGain, ltcgBooked } satisfies Saved)); } catch { /* not saved on this device */ }
  }, [inputs, ltcgGain, ltcgBooked, loaded, userId]);

  const set = <K extends keyof TaxInputs>(key: K) => (value: TaxInputs[K]) => setInputs(prev => ({ ...prev, [key]: value }));
  const ready = inputs.salary > 0;
  const result = useMemo(() => compareRegimes(inputs), [inputs]);
  const opportunities = useMemo(() => (ready ? oldRegimeOpportunities(inputs) : []), [inputs, ready]);
  const breakEven = useMemo(() => (ready ? breakEvenExtraDeductions(inputs) : null), [inputs, ready]);
  const harvest = ltcgHarvest(ltcgGain, ltcgBooked);
  const hra = hraExemption(inputs);
  const fy = financialYear();
  const winner = result.better === "new" ? "new regime" : result.better === "old" ? "old regime" : "either regime";
  const maxTotal = Math.max(result.newer.total, result.older.total, 1);

  return <><Header /><main className="tax-page container">
    <div className="profile-heading">
      <p className="eyebrow"><Landmark size={14} /> TAX PLANNER · {fy}</p>
      <h1>Keep more of what you earn.</h1>
      <p>Compare the old and new tax regimes, find deductions you’re not using, and book tax-free equity gains. Every rupee of tax saved is a rupee that can compound towards your FIRE number.</p>
    </div>

    <div className="tax-layout">
      <section className="tm-card tax-inputs">
        <h2>Your income</h2>
        <div className="tax-grid">
          <Amount label="Gross salary" hint="From your Form 16 or salary slip, before tax. Leave out employer PF." value={inputs.salary} onChange={set("salary")} monthly />
          <Amount label="Basic + DA" hint={inputs.salary && !inputs.basic ? `Often about half of gross: ~${money(inputs.salary / 2)}` : "Used for HRA and employer NPS limits."} value={inputs.basic} onChange={set("basic")} monthly />
          <Amount label="Other income" hint="FD interest, rent received (after 30%), etc." value={inputs.otherIncome} onChange={set("otherIncome")} />
          <Amount label="Savings-account interest" value={inputs.savingsInterest} onChange={set("savingsInterest")} />
          <Amount label="Employer NPS contribution" hint="Deductible in both regimes, so worth asking HR for." value={inputs.employerNps} onChange={set("employerNps")} monthly />
        </div>

        <h2>Deductions <small>(only the old regime uses most of these)</small></h2>
        <div className="tax-grid">
          <Amount label="HRA received" value={inputs.hraReceived} onChange={set("hraReceived")} monthly />
          <Amount label="Rent paid" hint={hra > 0 ? `HRA exemption: ${money(hra)}` : undefined} value={inputs.rentPaid} onChange={set("rentPaid")} monthly />
          <label className="tax-check"><input type="checkbox" checked={inputs.metro} onChange={event => set("metro")(event.target.checked)} /> I live in Delhi, Mumbai, Kolkata or Chennai</label>
          <Amount label="Popularly known as 80C" hint={`Up to ${money(LIMITS.sec80C)}. Your employee EPF, PPF, ELSS, life cover, kids’ tuition, home-loan principal.`} value={inputs.sec80C} onChange={set("sec80C")} />
          <Amount label="80D health insurance (you & family)" hint={`Up to ${money(LIMITS.sec80DSelf)}`} value={inputs.sec80DSelf} onChange={set("sec80DSelf")} />
          <Amount label="80D health insurance (parents)" hint={`Up to ${money(inputs.parentsSenior ? LIMITS.sec80DParentsSenior : LIMITS.sec80DParents)}`} value={inputs.sec80DParents} onChange={set("sec80DParents")} />
          <label className="tax-check"><input type="checkbox" checked={inputs.parentsSenior} onChange={event => set("parentsSenior")(event.target.checked)} /> A parent is 60 or older</label>
          <Amount label="Your own NPS, 80CCD(1B)" hint={`Extra ${money(LIMITS.nps80CCD1B)} over 80C`} value={inputs.nps80CCD1B} onChange={set("nps80CCD1B")} />
          <Amount label="Home-loan interest (self-occupied)" hint={`Up to ${money(LIMITS.homeLoanInterest)}`} value={inputs.homeLoanInterest} onChange={set("homeLoanInterest")} />
          <Amount label="Education-loan interest, 80E" value={inputs.educationLoanInterest} onChange={set("educationLoanInterest")} />
          <Amount label="Professional tax" hint="Usually ₹2,500 a year, on your slip." value={inputs.professionalTax} onChange={set("professionalTax")} />
        </div>
        <p className="tm-hint">Saved on this device only. We don’t send these numbers anywhere.</p>
      </section>

      <div className="tax-results">
        {!ready ? <section className="tm-card"><h2>Start with your gross salary</h2><p className="tm-hint">Enter it on the left (yearly or monthly) and your comparison appears here.</p></section> : <>
          <section className="tm-card tax-verdict">
            <p className="eyebrow"><Scale size={14} /> OLD VS NEW</p>
            <h2>{result.better === "same" ? "Both regimes cost the same for you" : <>The <b>{winner}</b> saves you {money(result.saving)} this year</>}</h2>
            <div className="tax-bars" role="img" aria-label={`New regime tax ${money(result.newer.total)}, old regime tax ${money(result.older.total)}`}>
              {([["New regime", result.newer, "new"], ["Old regime", result.older, "old"]] as const).map(([label, r, key]) => <div key={key} className={`tax-bar-row${result.better === key ? " best" : ""}`}>
                <span>{label}{result.better === key && " ✓"}</span>
                <div className="tax-bar"><i style={{ width: `${Math.max(1, (r.total / maxTotal) * 100)}%` }} /></div>
                <strong>{money(r.total)}</strong>
              </div>)}
            </div>
            <table className="tax-table">
              <thead><tr><th></th><th>New</th><th>Old</th></tr></thead>
              <tbody>
                <tr><td>Gross income</td><td>{money(result.newer.gross)}</td><td>{money(result.older.gross)}</td></tr>
                <tr><td>Deductions</td><td>−{money(result.newer.deductions)}</td><td>−{money(result.older.deductions)}</td></tr>
                <tr><td>Taxable income</td><td>{money(result.newer.taxable)}</td><td>{money(result.older.taxable)}</td></tr>
                <tr><td>Tax + 4% cess</td><td><b>{money(result.newer.total)}</b></td><td><b>{money(result.older.total)}</b></td></tr>
                <tr><td>Per month</td><td>{money(result.newer.total / 12)}</td><td>{money(result.older.total / 12)}</td></tr>
                <tr><td>Tax on your next ₹1,000</td><td>{Math.round(result.newer.marginalRate * 100)}%</td><td>{Math.round(result.older.marginalRate * 100)}%</td></tr>
              </tbody>
            </table>
            {breakEven !== null && breakEven > 0 && <p className="tax-note">The old regime would only win with about <b>{money(breakEven)}</b> more in deductions than you claim now.</p>}
            {breakEven === null && <p className="tax-note">At your income, the old regime can’t catch up even with a lot more deductions. The new regime is simpler too.</p>}
            {result.better !== "same" && <p className="tax-note">Invest the {money(result.saving / 12)} a month you save, and it grows with the rest of your FIRE portfolio.</p>}
          </section>

          {result.better !== "new" && opportunities.length > 0 && <section className="tm-card">
            <h2><Lightbulb size={18} /> Deductions you’re not using yet</h2>
            <ul className="tax-ops">{opportunities.map(o => <li key={o.key}><div><strong>{o.label}: {money(o.room)} left</strong><small>{o.how}</small></div><b>saves {money(o.saves)}</b></li>)}</ul>
            <p className="tm-hint">Savings are in the old regime. Only invest if it suits your plan anyway; don’t lock money away just to save tax.</p>
          </section>}
          {result.better === "new" && opportunities.length > 0 && <section className="tm-card">
            <h2><Lightbulb size={18} /> Would more deductions change the answer?</h2>
            <p className="tax-note">Using all of 80C, 80D and 80CCD(1B) would save up to {money(opportunities.reduce((s, o) => s + o.saves, 0))} in the old regime. {breakEven !== null && breakEven > 0 ? `You’d need about ${money(breakEven)} more deductions before it beats the new regime.` : ""} For most people, staying in the new regime and investing freely (without lock-ins) is the better FIRE move.</p>
          </section>}
        </>}

        <section className="tm-card tax-ltcg">
          <h2><Sprout size={18} /> Harvest tax-free equity gains</h2>
          <p className="tax-note">Long-term gains on equity funds and shares (held over 12 months) are tax-free up to <b>{money(LIMITS.ltcgExempt)}</b> a year. Selling and buying back books that gain tax-free and raises your cost, so you pay less tax when you finally sell for FIRE.</p>
          <div className="tax-grid">
            <Amount label="Unbooked long-term equity gains" hint="From your CAS or broker’s P&L (held over 12 months)." value={ltcgGain} onChange={setLtcgGain} />
            <Amount label={`Gains already booked in ${fy}`} value={ltcgBooked} onChange={setLtcgBooked} />
          </div>
          {ltcgGain > 0 && (harvest.harvest > 0
            ? <p className="tax-win">Book about <b>{money(harvest.harvest)}</b> of gains before 31 March, tax-free. That saves roughly <b>{money(harvest.taxSavedLater)}</b> of future tax at 12.5%.</p>
            : <p className="tax-note">You’ve used this year’s {money(LIMITS.ltcgExempt)} tax-free limit.{harvest.taxDueNow > 0 ? ` Estimated tax on the rest: ${money(harvest.taxDueNow)}.` : ""}</p>)}
          <p className="tm-hint">Mind exit loads and the 12-month holding rule when buying back. Short-term gains are taxed at 20%.</p>
        </section>

        <p className="tax-disclaimer">Educational estimate for salaried residents below 60, using {fy} slabs (unchanged in Budget 2026). It isn’t tax advice and leaves out some cases (other special-rate income, senior-citizen slabs, rebate on special income). The new Income-tax Act 2025 renames sections; we use the popular names. Check with a CA or your Form 16 before filing.</p>
      </div>
    </div>
  </main><Footer /></>;
}
