"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatCountryMoney, countryFromCurrency, countryAmountInWords } from "@/lib/country";
import { getProgressSummary, type Snapshot } from "@/lib/progress";

const W = 640, H = 230, PAD = { top: 16, right: 16, bottom: 30, left: 64 };
const monthLabel = (month: string, long = false) => new Date(`${month}T12:00:00`).toLocaleDateString("en-IN", { month: "short", year: long ? "numeric" : "2-digit" });

/** Your FIRE portfolio over time vs your FIRE number — the line that makes leaving feel like a loss. */
export default function ProgressHistory({ snapshots }: { snapshots: Snapshot[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const code = countryFromCurrency(snapshots[snapshots.length - 1]?.currency);
  const money = (value: number) => formatCountryMoney(value, code);
  const compact = (value: number) => (value >= 1000 ? countryAmountInWords(value, code).replace(" thousand", "k").replace(" million", "M").replace(" lakh", "L").replace(" crore", "Cr") : String(Math.round(value)));
  const summary = useMemo(() => getProgressSummary(snapshots), [snapshots]);

  const chart = useMemo(() => {
    if (snapshots.length < 2) return null;
    const portfolios = snapshots.map(s => s.fire_portfolio);
    const pMax = Math.max(1, ...portfolios), pMin = Math.min(...portfolios);
    const tMax = Math.max(...snapshots.map(s => s.fire_target));
    // If the FIRE number is far above today's portfolio, zoom in on the portfolio so real growth is visible
    // (the target is then shown as a label, not squashed into the chart). Lines may use a non-zero baseline; we drop the area fill then.
    const targetInView = tMax <= pMax * 1.6;
    const top = (targetInView ? Math.max(pMax, tMax) : pMax) * 1.08;
    const bottom = targetInView ? 0 : Math.max(0, pMin - (pMax - pMin) * 0.6 - pMax * 0.02);
    const x = (i: number) => PAD.left + (i / (snapshots.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - bottom) / (top - bottom)) * (H - PAD.top - PAD.bottom);
    const line = (key: "fire_portfolio" | "fire_target") => snapshots.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(" ");
    const area = bottom === 0 ? `${line("fire_portfolio")} L${x(snapshots.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : null;
    const ticks = [0, 0.5, 1].map(f => bottom + f * (top / 1.08 - bottom));
    return { x, y, portfolio: line("fire_portfolio"), target: targetInView ? line("fire_target") : null, area, ticks, targetInView };
  }, [snapshots]);

  const latest = snapshots[snapshots.length - 1];
  if (!latest) return null;

  return (
    <section className="progress-history">
      <div className="progress-history-head">
        <div><p className="eyebrow"><TrendingUp size={14} /> YOUR PROGRESS OVER TIME</p><h2>{summary.months > 0 ? `${summary.progressGain >= 0 ? "+" : ""}${summary.progressGain.toFixed(1)}% closer to freedom since ${monthLabel(summary.since!, true)}` : "Your freedom line starts today"}</h2></div>
        {summary.months > 0 && <div className="progress-history-stats">
          <span><b>{summary.portfolioGain >= 0 ? "+" : "−"}{money(Math.abs(summary.portfolioGain))}</b> FIRE portfolio</span>
          <span><b>{summary.netWorthGain >= 0 ? "+" : "−"}{money(Math.abs(summary.netWorthGain))}</b> net worth</span>
        </div>}
      </div>

      {!chart ? (
        <div className="progress-history-empty">
          <strong>{latest.fire_progress.toFixed(1)}% of your FIRE number · {money(latest.fire_portfolio)}</strong>
          <span>This is your first point. Every month you open FIREpath we save another one — come back next month to see your line start climbing. 📈</span>
        </div>
      ) : <>
        <div className="chart-legend" aria-hidden="true">
          <span><i className="key-portfolio" />Your FIRE portfolio</span>
          {chart.targetInView ? <span><i className="key-target" />FIRE number (target)</span> : <span className="target-pill">🎯 FIRE number {money(latest.fire_target)} · {latest.fire_progress.toFixed(1)}% there — zoomed in so you can see your climb</span>}
        </div>
        <div className="progress-chart-wrap" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="progress-chart" role="img" aria-label={`FIRE portfolio grew from ${money(snapshots[0].fire_portfolio)} to ${money(latest.fire_portfolio)} between ${monthLabel(snapshots[0].month_start, true)} and ${monthLabel(latest.month_start, true)}.`}
            onMouseMove={event => { const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = (event.clientX - rect.left) / rect.width * W; const i = Math.round((px - PAD.left) / (W - PAD.left - PAD.right) * (snapshots.length - 1)); setHover(Math.max(0, Math.min(snapshots.length - 1, i))); }}>
            {chart.ticks.map(t => <g key={t}><line x1={PAD.left} x2={W - PAD.right} y1={chart.y(t)} y2={chart.y(t)} className="grid" /><text x={PAD.left - 8} y={chart.y(t) + 4} textAnchor="end" className="tick">{compact(t)}</text></g>)}
            {chart.area && <path d={chart.area} className="area" />}
            {chart.target && <path d={chart.target} className="target" />}
            <path d={chart.portfolio} className="portfolio" />
            {snapshots.map((s, i) => <circle key={s.month_start} cx={chart.x(i)} cy={chart.y(s.fire_portfolio)} r={hover === i ? 6 : 4} className="dot" />)}
            <text x={PAD.left} y={H - 8} className="tick">{monthLabel(snapshots[0].month_start)}</text>
            <text x={W - PAD.right} y={H - 8} textAnchor="end" className="tick">{monthLabel(latest.month_start)}</text>
            {hover !== null && <line x1={chart.x(hover)} x2={chart.x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}
          </svg>
          {hover !== null && <div className="chart-tooltip" style={{ left: `${(chart.x(hover) / W) * 100}%` }}>
            <strong>{monthLabel(snapshots[hover].month_start, true)}</strong>
            <span><i className="key-portfolio" />FIRE portfolio <b>{money(snapshots[hover].fire_portfolio)}</b></span>
            <span><i className="key-target" />FIRE number <b>{money(snapshots[hover].fire_target)}</b></span>
            <span>Progress <b>{snapshots[hover].fire_progress.toFixed(1)}%</b> · Score <b>{snapshots[hover].fire_score}</b></span>
          </div>}
        </div>
        <details className="chart-table"><summary>View as table</summary>
          <div className="chart-table-scroll"><table><thead><tr><th>Month</th><th>FIRE portfolio</th><th>FIRE number</th><th>Progress</th><th>Net worth</th></tr></thead>
            <tbody>{[...snapshots].reverse().map(s => <tr key={s.month_start}><td>{monthLabel(s.month_start, true)}</td><td>{money(s.fire_portfolio)}</td><td>{money(s.fire_target)}</td><td>{s.fire_progress.toFixed(1)}%</td><td>{money(s.net_worth)}</td></tr>)}</tbody></table></div>
        </details>
      </>}
    </section>
  );
}
