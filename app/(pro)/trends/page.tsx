"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { countryFromCurrency, formatCountryMoney, type CountryCode } from "@/lib/country";
import { categoryTotals, growth, highlights, monthlyRows, niceMax, shortMoney, wealthRows, yearlyRows, type TrendCheckin, type TrendRow, type WealthSnapshot } from "@/lib/trends";
import { normalizeSnapshots } from "@/lib/progress";

type Range = "12" | "all" | "year";
type Entry = { month_start: string; category: string; amount: number };

/* Series colours: validated as an adjacent stack (CVD-safe order). Two sit below 3:1 on white,
   so the chart always has a legend, values on hover and a table view. "Left over" is a neutral remainder. */
const SERIES: { key: "invested" | "fromSalary" | "spent" | "emis" | "left"; label: string; color: string }[] = [
  { key: "invested", label: "Invested from bank", color: "#00b894" },
  { key: "fromSalary", label: "EPF / NPS from salary", color: "#257de0" },
  { key: "spent", label: "Spent", color: "#f47230" },
  { key: "emis", label: "Loan EMIs", color: "#6a4ce2" },
  { key: "left", label: "Left over", color: "#d3dbe1" },
];
const CATEGORY_LABELS: Record<string, string> = { housing: "Housing", utilities: "Utilities", groceries: "Groceries", dining: "Dining out", transport: "Transport", healthcare: "Healthcare", insurance: "Insurance", education: "Education", family: "Family", debt_repayment: "Debt payments", personal: "Personal & shopping", other: "Other" };


/** Rect with rounded top corners only (bars are anchored to the baseline). */
const topRounded = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};
const monthKey = (offset: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

export default function TrendsPage() {
  const [checkins, setCheckins] = useState<TrendCheckin[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [code, setCode] = useState<CountryCode>("IN");
  const [range, setRange] = useState<Range>("12");
  const [hover, setHover] = useState<number | null>(null);
  const [hoverChart, setHoverChart] = useState<"money" | "rate">("money");
  const [snaps, setSnaps] = useState<WealthSnapshot[]>([]);
  const [period, setPeriod] = useState<"month" | "quarter">("month");
  const [wHover, setWHover] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  // Charts are drawn at the real container width so text stays readable on phones.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(300, Math.min(960, Math.round(entry.contentRect.width)))));
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  const narrow = W < 520;
  const H = narrow ? 230 : 280;
  const M = { top: 14, right: 10, bottom: 30, left: narrow ? 64 : 76 };
  const innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setMessage("Sign in to see your money trends."); return; }
        const [c, b, p, s] = await Promise.all([
          supabase.from("monthly_checkins").select("*").eq("user_id", session.user.id).order("month_start", { ascending: true }).limit(120),
          supabase.from("budget_transactions").select("month_start, category, amount").eq("user_id", session.user.id).gte("month_start", monthKey(-23)),
          supabase.from("financial_profiles").select("currency").eq("user_id", session.user.id).maybeSingle(),
          supabase.from("progress_snapshots").select("*").eq("user_id", session.user.id).order("month_start", { ascending: true }).limit(120),
        ]);
        if (!s.error) setSnaps(normalizeSnapshots(s.data).map(x => ({ month_start: x.month_start, net_worth: x.net_worth, fire_portfolio: x.fire_portfolio, fire_target: x.fire_target })));
        if (c.error) throw c.error;
        setCheckins((c.data ?? []).map(r => ({ month_start: r.month_start, income: Number(r.income), expenses: Number(r.expenses), invested: Number(r.invested), debt_paid: Number(r.debt_paid), salary_pf: Number(r.salary_pf ?? 0), salary_pension: Number(r.salary_pension ?? 0) })));
        setEntries(((b.data ?? []) as Entry[]).map(e => ({ ...e, amount: Number(e.amount) })));
        setCode(countryFromCurrency(p.data?.currency));
      } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load your trends."); }
      finally { setLoading(false); }
    })();
  }, []);

  const money = (v: number) => formatCountryMoney(Math.round(v), code);
  const months = useMemo(() => monthlyRows(checkins), [checkins]);
  const rows: TrendRow[] = useMemo(() => range === "year" ? yearlyRows(months) : range === "12" ? months.slice(-12) : months, [months, range]);
  const facts = useMemo(() => highlights(range === "year" ? months : rows), [months, rows, range]);
  const categories = useMemo(() => range === "12" ? categoryTotals(entries, monthKey(-11), monthKey(0), monthKey(-23)) : categoryTotals(entries, "0000-00-00", "9999-99-99", "0000-00-00"), [entries, range]);

  // Shared x scale.
  const band = rows.length ? innerW / rows.length : innerW;
  const cx = (i: number) => M.left + band * i + band / 2;
  const barW = Math.max(6, Math.min(40, band * 0.62));
  const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(3, Math.floor(innerW / 58))));

  // Chart 1 scale: tallest stack = everything earned (or more, in an overspent month).
  const moneyMax = niceMax(Math.max(1, ...rows.map(r => r.invested + r.fromSalary + r.spent + r.emis + r.left)));
  const ym = (v: number) => M.top + innerH - (v / moneyMax) * innerH;

  // Chart 2 scale: savings rate %.
  const rates = rows.map(r => r.savingsRate);
  const rateMin = Math.min(0, Math.floor(Math.min(...rates, 0) / 10) * 10);
  const rateMax = Math.max(40, Math.ceil((Math.max(...rates, 0) + 5) / 10) * 10);
  const yr = (v: number) => M.top + innerH - ((v - rateMin) / (rateMax - rateMin)) * innerH;
  const ratePath = rows.map((r, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${yr(r.savingsRate).toFixed(1)}`).join(" ");

  // Wealth over time: net worth and FIRE portfolio, with the FIRE number as a dashed reference line.
  const wRows = useMemo(() => wealthRows(snaps, period), [snaps, period]);
  const wBand = wRows.length ? innerW / wRows.length : innerW;
  const wx = (i: number) => M.left + wBand * i + wBand / 2;
  const wMax = niceMax(Math.max(1, ...wRows.flatMap(r => [r.netWorth, r.fire, r.target])));
  const wy = (v: number) => M.top + innerH - (Math.max(0, v) / wMax) * innerH;
  const wPath = (pick: (r: (typeof wRows)[number]) => number) => wRows.map((r, i) => `${i ? "L" : "M"}${wx(i).toFixed(1)},${wy(pick(r)).toFixed(1)}`).join(" ");
  const nwGrowth = growth(wRows, r => r.netWorth), fireGrowth = growth(wRows, r => r.fire);
  const wLabelEvery = Math.max(1, Math.ceil(wRows.length / Math.max(3, Math.floor(innerW / 58))));
  const wTip = wHover !== null ? wRows[wHover] : null;
  const last = wRows.at(-1);
  const growthText = (g: ReturnType<typeof growth>) => g ? `${g.change >= 0 ? "▲" : "▼"} ${money(Math.abs(g.change))}${g.percent !== null ? ` (${g.percent >= 0 ? "+" : ""}${g.percent.toFixed(1)}%)` : ""}` : "—";
  const wealthSection = <section className="tr-card tr-wealth">
    <div className="tr-head"><div><h2>Your wealth over time</h2><p>Net worth (everything you own minus loans) and your FIRE portfolio (money that counts toward freedom). Dashed line: your FIRE number.</p></div>
      <div className="tr-range tm-mode" role="group" aria-label="Period">{([["month", "Monthly"], ["quarter", "Quarterly"]] as const).map(([id, label]) => <button key={id} type="button" className={period === id ? "on" : ""} aria-pressed={period === id} onClick={() => { setPeriod(id); setWHover(null); }}>{label}</button>)}</div></div>
    {wRows.length < 2 || !last ? <p className="side-empty">{wRows.length === 1 ? `Your wealth line starts in ${wRows[0].label}. FIREpath saves a snapshot each month when you open Home, so the line grows from next month. Keep your Portfolio up to date (or import your CAS) before then.` : "Open Home once a month and keep your Portfolio up to date. Your wealth line starts from your first snapshot."}</p> : <>
      <div className="tr-facts tr-wealth-facts">
        <div><span>Net worth</span><strong>{money(last.netWorth)}</strong><small>{growthText(nwGrowth)} since {wRows[0].label}</small></div>
        <div><span>FIRE portfolio</span><strong>{money(last.fire)}</strong><small>{growthText(fireGrowth)} since {wRows[0].label}</small></div>
        <div><span>FIRE portfolio grows about</span><strong>{fireGrowth ? money(fireGrowth.perMonth) : "—"}</strong><small>a month on average (investing + market growth)</small></div>
        <div><span>Gap to your FIRE number</span><strong>{money(Math.max(0, last.target - last.fire))}</strong><small>{last.target > 0 ? `${Math.min(100, (last.fire / last.target) * 100).toFixed(1)}% of the way` : ""}</small></div>
      </div>
      <ul className="tr-legend"><li><i style={{ background: "#257de0" }} />Net worth</li><li><i style={{ background: "#00b894" }} />FIRE portfolio</li><li><i className="tr-dash-key" />FIRE number</li></ul>
      <div className="tr-chart">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Lines: net worth and FIRE portfolio over time, with the FIRE number">
          {[0, 0.25, 0.5, 0.75, 1].map(t => <g key={t}><line x1={M.left} x2={W - M.right} y1={wy(wMax * t)} y2={wy(wMax * t)} className="tr-grid" /><text x={M.left - 8} y={wy(wMax * t) + 4} textAnchor="end" className="tr-axis">{shortMoney(wMax * t, code)}</text></g>)}
          {wHover !== null && <line x1={wx(wHover)} x2={wx(wHover)} y1={M.top} y2={M.top + innerH} className="tr-crosshair" />}
          <path d={wPath(r => r.target)} className="tr-ref" fill="none" />
          <path d={wPath(r => r.netWorth)} fill="none" stroke="#257de0" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={wPath(r => r.fire)} fill="none" stroke="#00b894" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {wRows.length <= 24 && wRows.map((r, i) => <g key={r.key}><circle cx={wx(i)} cy={wy(r.netWorth)} r={wHover === i ? 5 : 3} fill="#257de0" stroke="#fff" strokeWidth={2} /><circle cx={wx(i)} cy={wy(r.fire)} r={wHover === i ? 5 : 3} fill="#00b894" stroke="#fff" strokeWidth={2} /></g>)}
          <text x={wx(wRows.length - 1)} y={wy(last.netWorth) - 10} textAnchor="end" className="tr-direct">{shortMoney(last.netWorth, code)}</text>
          <text x={wx(wRows.length - 1)} y={wy(last.fire) + (wy(last.fire) - wy(last.netWorth) < 22 ? 22 : -10)} textAnchor="end" className="tr-direct">{shortMoney(last.fire, code)}</text>
          <line x1={M.left} x2={W - M.right} y1={M.top + innerH} y2={M.top + innerH} className="tr-baseline" />
          {wRows.map((r, i) => (i === wRows.length - 1 || (i % wLabelEvery === 0 && wRows.length - 1 - i >= wLabelEvery)) && <text key={r.key} x={wx(i)} y={H - 10} textAnchor="middle" className="tr-axis">{r.label}</text>)}
          {wRows.map((r, i) => <rect key={`w-${r.key}`} x={M.left + wBand * i} y={M.top} width={wBand} height={innerH} fill="transparent" tabIndex={0} role="button" aria-label={`${r.label}: net worth ${money(r.netWorth)}, FIRE portfolio ${money(r.fire)}`} onMouseEnter={() => setWHover(i)} onFocus={() => setWHover(i)} onClick={() => setWHover(i)} onMouseLeave={() => setWHover(null)} onBlur={() => setWHover(null)} />)}
        </svg>
        {wTip && wHover !== null && <div className="tr-tip" style={{ left: `${Math.min(78, Math.max(4, (wx(wHover) / W) * 100 - 11))}%` }} role="status"><strong>{wTip.label}</strong><span><i style={{ background: "#257de0" }} />Net worth <b>{money(wTip.netWorth)}</b></span><span><i style={{ background: "#00b894" }} />FIRE portfolio <b>{money(wTip.fire)}</b></span><span>FIRE number <b>{money(wTip.target)}</b></span></div>}
      </div>
      <details className="tr-table"><summary>Show as table</summary><div className="tr-table-wrap"><table><thead><tr><th>{period === "month" ? "Month" : "Quarter"}</th><th>Net worth</th><th>FIRE portfolio</th><th>FIRE number</th></tr></thead><tbody>{[...wRows].reverse().map(r => <tr key={r.key}><td>{r.label}</td><td>{money(r.netWorth)}</td><td>{money(r.fire)}</td><td>{money(r.target)}</td></tr>)}</tbody></table></div></details>
      <p className="tr-note">One snapshot a month, saved when you open Home.{period === "quarter" ? " Quarterly shows the latest balance in each quarter." : ""} Growth includes new investing and market changes.</p>
    </>}
  </section>;

  const hovered = hover !== null ? rows[hover] : null;
  const tipLeft = hover !== null ? `${Math.min(78, Math.max(4, (cx(hover) / W) * 100 - 11))}%` : "0";

  const hitAreas = (chart: string) => rows.map((r, i) => <rect key={`${chart}-${r.key}`} x={M.left + band * i} y={M.top} width={band} height={innerH} fill="transparent" tabIndex={0} role="button" aria-label={`${r.label}: savings rate ${Math.round(r.savingsRate)}%`} onMouseEnter={() => { setHover(i); setHoverChart(chart as "money" | "rate"); }} onFocus={() => { setHover(i); setHoverChart(chart as "money" | "rate"); }} onClick={() => { setHover(i); setHoverChart(chart as "money" | "rate"); }} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} />);
  const xLabels = rows.map((r, i) => (i === rows.length - 1 || (i % labelEvery === 0 && rows.length - 1 - i >= labelEvery)) && <text key={r.key} x={cx(i)} y={H - 10} textAnchor="middle" className="tr-axis">{range === "year" ? r.key : r.label}</text>);

  const tooltip = hovered && <div className="tr-tip" style={{ left: tipLeft }} role="status">
    <strong>{hovered.label}</strong>
    <span>Earned <b>{money(hovered.earned)}</b></span>
    {SERIES.map(s => (hovered[s.key] as number) > 0 && <span key={s.key}><i style={{ background: s.color }} />{s.label} <b>{money(hovered[s.key] as number)}</b></span>)}
    {hovered.overspent > 0 && <span className="tr-over">Overspent by <b>{money(hovered.overspent)}</b></span>}
    <span>Savings rate <b>{Math.round(hovered.savingsRate)}%</b></span>
  </div>;

  return <><Header /><main className="trends-page container">
    <div className="profile-heading"><p className="eyebrow"><BarChart3 size={14} /> MONEY TRENDS</p><h1>Where your money goes, month after month.</h1><p>How your wealth grows, where each month’s money goes, and the months where money slipped away.</p></div>
    {loading ? <p className="profile-status">Loading your trends…</p> : message ? <p className="profile-status">{message}</p> : <>{wealthSection}{months.length < 2 ? <section className="profile-card tr-empty">
      <h2>📈 Your trends appear after 2 check-ins</h2>
      <p>{months.length === 1 ? "You’ve logged 1 month. Log next month and your charts start here." : "Log your first month to start your trend line. It takes 30 seconds and it’s pre-filled."}</p>
      <Link href="/month" className="button button-primary">Log a month</Link>
    </section> : <>
      <div className="tr-range" role="group" aria-label="Time range">{([["12", "Last 12 months"], ["all", "All months"], ["year", "By year"]] as [Range, string][]).map(([id, label]) => <button key={id} type="button" className={range === id ? "on" : ""} aria-pressed={range === id} onClick={() => { setRange(id); setHover(null); }}>{label}</button>)}</div>

      <section className="tr-facts">
        <div><span>Average savings rate</span><strong>{Math.round(facts.averageRate)}%</strong><small>{facts.change === null ? "of everything you earned" : `${facts.change >= 0 ? "▲" : "▼"} ${Math.abs(facts.change).toFixed(0)} pts vs the 3 months before`}</small></div>
        <div><span>Best month</span><strong>{facts.best ? `${Math.round(facts.best.savingsRate)}%` : "—"}</strong><small>{facts.best ? `saved in ${facts.best.label}` : ""}</small></div>
        <div><span>Invested {range === "year" ? "in total" : "in this period"}</span><strong>{money(facts.totalInvested)}</strong><small>incl. EPF/NPS from salary</small></div>
        <div><span>Investing streak</span><strong>{facts.streak} month{facts.streak === 1 ? "" : "s"} 🔥</strong><small>in a row with money invested</small></div>
      </section>

      <section className="tr-card">
        <div className="tr-head"><div><h2>Where each {range === "year" ? "year’s" : "month’s"} money went</h2><p>Everything you earned, split into investing, spending, EMIs and what was left.</p></div></div>
        <ul className="tr-legend">{SERIES.map(s => <li key={s.key}><i style={{ background: s.color }} />{s.label}</li>)}</ul>
        <div className="tr-chart" ref={setBox}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Stacked columns: where each period's money went">
            {[0, 0.25, 0.5, 0.75, 1].map(t => <g key={t}><line x1={M.left} x2={W - M.right} y1={ym(moneyMax * t)} y2={ym(moneyMax * t)} className="tr-grid" /><text x={M.left - 8} y={ym(moneyMax * t) + 4} textAnchor="end" className="tr-axis">{shortMoney(moneyMax * t, code)}</text></g>)}
            {hover !== null && <rect x={M.left + band * hover} y={M.top} width={band} height={innerH} className="tr-hoverband" />}
            {rows.map((r, i) => {
              let base = 0;
              const parts = SERIES.map(s => ({ s, v: r[s.key] as number })).filter(p => p.v > 0);
              return <g key={r.key}>{parts.map((p, j) => {
                const y0 = ym(base), y1 = ym(base + p.v); base += p.v;
                const top = j === parts.length - 1;
                const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0)); // 2px surface gap between segments
                return top ? <path key={p.s.key} d={topRounded(cx(i) - barW / 2, y1, barW, h, 4)} fill={p.s.color} /> : <rect key={p.s.key} x={cx(i) - barW / 2} y={y1} width={barW} height={h} fill={p.s.color} />;
              })}{r.overspent > 0 && <text x={cx(i)} y={ym(base) - 6} textAnchor="middle" className="tr-flag">!</text>}</g>;
            })}
            <line x1={M.left} x2={W - M.right} y1={M.top + innerH} y2={M.top + innerH} className="tr-baseline" />
            {xLabels}
            {hitAreas("money")}
          </svg>
          {hoverChart === "money" && tooltip}
        </div>
        {rows.some(r => r.overspent > 0) && <p className="tr-note">“!” marks a {range === "year" ? "year" : "month"} where more went out than came in. Hover or tap a column for details.</p>}
        <details className="tr-table"><summary>Show as table</summary><div className="tr-table-wrap"><table>
          <thead><tr><th>{range === "year" ? "Year" : "Month"}</th><th>Earned</th>{SERIES.map(s => <th key={s.key}>{s.label}</th>)}<th>Savings rate</th></tr></thead>
          <tbody>{[...rows].reverse().map(r => <tr key={r.key}><td>{r.label}</td><td>{money(r.earned)}</td>{SERIES.map(s => <td key={s.key}>{money(r[s.key] as number)}</td>)}<td>{Math.round(r.savingsRate)}%</td></tr>)}</tbody>
        </table></div></details>
      </section>

      <section className="tr-card">
        <div className="tr-head"><div><h2>Your savings rate over time</h2><p>The share of everything you earned that you kept. The dashed lines are the saver levels: 20% steady saver, 30% FIRE builder.</p></div><strong className="tr-latest">{Math.round(rows.at(-1)!.savingsRate)}%<small>{rows.at(-1)!.label}</small></strong></div>
        <div className="tr-chart">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Line chart of savings rate over time">
            {Array.from({ length: (rateMax - rateMin) / 10 + 1 }, (_, k) => rateMin + k * 10).filter(v => (v - rateMin) % (rateMax - rateMin > 60 ? 20 : 10) === 0).map(v => <g key={v}><line x1={M.left} x2={W - M.right} y1={yr(v)} y2={yr(v)} className="tr-grid" /><text x={M.left - 8} y={yr(v) + 4} textAnchor="end" className="tr-axis">{v}%</text></g>)}
            {[20, 30].map(v => <g key={`ref-${v}`}><line x1={M.left} x2={W - M.right} y1={yr(v)} y2={yr(v)} className="tr-ref" /><text x={W - M.right} y={yr(v) - 5} textAnchor="end" className="tr-ref-label">{v === 20 ? "20% steady saver" : "30% FIRE builder"}</text></g>)}
            {hover !== null && <line x1={cx(hover)} x2={cx(hover)} y1={M.top} y2={M.top + innerH} className="tr-crosshair" />}
            <path d={ratePath} className="tr-line" />
            {rows.length <= 24 && rows.map((r, i) => <circle key={r.key} cx={cx(i)} cy={yr(r.savingsRate)} r={hover === i ? 5 : 3} className="tr-dot" />)}
            {rows.length > 24 && hover !== null && <circle cx={cx(hover)} cy={yr(rows[hover].savingsRate)} r={5} className="tr-dot" />}
            <text x={cx(rows.length - 1)} y={yr(rows.at(-1)!.savingsRate) - 10} textAnchor="end" className="tr-direct">{Math.round(rows.at(-1)!.savingsRate)}%</text>
            <line x1={M.left} x2={W - M.right} y1={yr(rateMin)} y2={yr(rateMin)} className="tr-baseline" />
            {xLabels}
            {hitAreas("rate")}
          </svg>
          {hoverChart === "rate" && tooltip}
        </div>
      </section>

      <section className="tr-card">
        <div className="tr-head"><div><h2>Spending by category</h2><p>{range === "12" ? "Last 12 months of budget entries, compared with the 12 months before." : "All your budget entries."}</p></div><Link href="/save-more" className="text-link">Hunt leaks →</Link></div>
        {categories.length ? <ul className="tr-cats">{categories.slice(0, 8).map(c => <li key={c.category}>
          <span className="tr-cat-name">{CATEGORY_LABELS[c.category] ?? c.category}</span>
          <span className="tr-cat-bar"><i style={{ width: `${(c.total / categories[0].total) * 100}%` }} /></span>
          <b>{money(c.total)}</b>
          <small>{c.change === null ? "" : `${c.change >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(c.change))}%`}</small>
        </li>)}</ul> : <p className="side-empty">Log spending <Link href="/month">by category in This month</Link> (or import a statement CSV) to see which categories take the most, and whether they’re shrinking.</p>}
      </section>
      <p className="journey-note">Months you didn’t log are skipped. Figures come from your check-ins: take-home, EPF/NPS from salary, spending (excluding investing and EMIs), investing and EMIs.</p>
    </>}</>}
  </main><Footer /></>;
}
