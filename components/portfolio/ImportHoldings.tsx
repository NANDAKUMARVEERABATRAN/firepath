"use client";

import { useMemo, useState } from "react";
import { FileUp, Lock, ShieldCheck, X } from "lucide-react";
import Celebration from "@/components/game/Celebration";
import { createClient } from "@/lib/supabase/client";
import { formatCountryMoney, type CountryCode } from "@/lib/country";
import { autoMapColumns, findHeaderRow, parseCasText, planImport, rowsToHoldings, type ColumnMap, type ImportedHolding, type ImportInvestmentType, type ImportResult } from "@/lib/importHoldings";
import { maskForSharing, PdfPasswordError, readPdfLines, readSheetRows } from "@/lib/importReaders";

type Existing = { id: string; name: string; current_value: number; external_id?: string | null; source?: string | null };
type SourceId = "mf_cas" | "demat_cas" | "app";

const SOURCES: { id: SourceId; emoji: string; title: string; detail: string; accept: string; india?: boolean }[] = [
  { id: "mf_cas", emoji: "📄", title: "Mutual fund CAS", detail: "CAMS / KFintech PDF: all your mutual funds in one file", accept: ".pdf,application/pdf", india: true },
  { id: "demat_cas", emoji: "🏦", title: "Demat CAS", detail: "NSDL / CDSL PDF: shares, ETFs and funds in demat", accept: ".pdf,application/pdf", india: true },
  { id: "app", emoji: "📲", title: "App export", detail: "CSV or Excel from Zerodha, Groww, Kuvera, INDmoney or any broker", accept: ".csv,.xlsx,.xls,text/csv" },
];
const TYPE_LABELS: Record<ImportInvestmentType, string> = { mutual_fund: "Mutual fund", stocks: "Stocks", bonds: "Bonds", gold: "Gold", other: "Other investment" };
const MAP_FIELDS: { key: keyof ColumnMap; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true }, { key: "value", label: "Current value" }, { key: "units", label: "Quantity / units" }, { key: "price", label: "Price / NAV" }, { key: "isin", label: "ISIN" },
];

export default function ImportHoldings({ existing, country, onImported }: { existing: Existing[]; country: CountryCode; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SourceId | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [sheet, setSheet] = useState<{ rows: string[][]; headerRow: number; map: ColumnMap } | null>(null);
  const [defaultType, setDefaultType] = useState<ImportInvestmentType>("stocks");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [types, setTypes] = useState<Record<string, ImportInvestmentType>>({});
  const [removeOld, setRemoveOld] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [celebrate, setCelebrate] = useState<{ title: string; detail: string } | null>(null);

  const money = (value: number) => formatCountryMoney(value, country);
  const sources = SOURCES.filter(s => !s.india || country === "IN");
  const sourceKey = source === "app" ? `app_${(file?.name.match(/zerodha|kite|console|groww|kuvera|indmoney|upstox|coin|etmoney/i)?.[0] ?? "export").toLowerCase()}` : source === "demat_cas" ? undefined : "mf_cas";

  function reset() { setFile(null); setPassword(""); setNeedPassword(false); setError(""); setResult(null); setRawLines([]); setSheet(null); setShowRaw(false); }
  function close() { reset(); setSource(null); setOpen(false); }

  function accept(next: ImportResult) {
    setResult(next);
    setSelected(Object.fromEntries(next.holdings.map(h => [h.externalId, true])));
    setTypes(Object.fromEntries(next.holdings.map(h => [h.externalId, h.investmentType])));
  }

  async function read(chosen: File | null = file, pass = password) {
    if (!chosen || !source) return;
    setBusy(true); setError(""); setResult(null);
    try {
      if (source === "app") {
        const rows = await readSheetRows(chosen);
        const headerRow = findHeaderRow(rows);
        const map = headerRow >= 0 ? autoMapColumns(rows[headerRow]) : autoMapColumns(rows[0] ?? []);
        setSheet({ rows, headerRow: headerRow >= 0 ? headerRow : 0, map });
        setRawLines(rows.slice(0, 60).map(r => r.join(" | ")));
        accept(rowsToHoldings(rows, { source: sourceKey!, defaultType, headerRow: headerRow >= 0 ? headerRow : 0, map }));
      } else {
        const lines = await readPdfLines(chosen, pass);
        setNeedPassword(false);
        setRawLines(lines);
        accept(parseCasText(lines));
      }
    } catch (e) {
      if (e instanceof PdfPasswordError) { setNeedPassword(true); setError(e.wrong ? "That password didn’t work. Check capital letters and try again." : ""); }
      else setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally { setBusy(false); }
  }

  function remap(key: keyof ColumnMap, index: number) {
    if (!sheet) return;
    const map = { ...sheet.map, [key]: index };
    setSheet({ ...sheet, map });
    accept(rowsToHoldings(sheet.rows, { source: sourceKey!, defaultType, headerRow: sheet.headerRow, map }));
  }

  const plan = useMemo(() => result ? planImport(result.holdings, existing) : [], [result, existing]);
  const chosen = plan.filter(p => selected[p.holding.externalId]);
  const total = chosen.reduce((sum, p) => sum + p.holding.value, 0);
  const importSource = result?.holdings[0]?.source;
  const stale = importSource ? existing.filter(e => e.source === importSource && e.external_id && !result!.holdings.some(h => h.externalId === e.external_id)) : [];

  async function save() {
    const supabase = createClient();
    if (!supabase || !chosen.length) return;
    setBusy(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Please sign in again.");
      const now = new Date().toISOString();
      const row = (h: ImportedHolding) => ({ name: h.name, current_value: h.value, investment_type: types[h.externalId] ?? h.investmentType, units: h.units, source: h.source, external_id: h.externalId, synced_at: now, updated_at: now });
      const inserts = chosen.filter(p => !p.existing).map(p => ({ ...row(p.holding), user_id: session.user.id, kind: "asset", category: "investment", monthly_payment: 0, is_high_interest: false, fire_treatment: "available" }));
      if (inserts.length) { const { error: e } = await supabase.from("financial_accounts").insert(inserts); if (e) throw e; }
      for (const p of chosen.filter(p => p.existing)) {
        const { error: e } = await supabase.from("financial_accounts").update(row(p.holding)).eq("id", p.existing!.id);
        if (e) throw e;
      }
      if (removeOld && stale.length) { const { error: e } = await supabase.from("financial_accounts").delete().in("id", stale.map(s => s.id)); if (e) throw e; }
      const updated = chosen.filter(p => p.existing).length;
      setCelebrate({ title: "Portfolio synced 📥", detail: `${inserts.length ? `${inserts.length} new` : ""}${inserts.length && updated ? " · " : ""}${updated ? `${updated} updated` : ""} · ${money(total)} imported. Your FIRE progress and freedom date are now up to date.` });
      onImported();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      setError(/external_id|synced_at|units|source/.test(msg) ? "Run supabase/migrations/202611260025_portfolio_import.sql in Supabase first, then try again." : msg);
    } finally { setBusy(false); }
  }

  if (!open) return <>
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => setCelebrate(null)} />}
    <button type="button" className="import-launch" onClick={() => setOpen(true)}>
      <span className="import-launch-icon"><FileUp size={22} /></span>
      <span><strong>Import your portfolio</strong><small>{country === "IN" ? "Upload a CAS or an app export. Updates every fund and stock in one go." : "Upload a CSV or Excel export from your broker or app."}</small></span>
      <em>+ XP</em>
    </button>
  </>;

  return <section className="import-panel" aria-label="Import portfolio">
    {celebrate && <Celebration title={celebrate.title} detail={celebrate.detail} onClose={() => { setCelebrate(null); close(); }} />}
    <div className="import-head"><h2><FileUp size={18} /> Import your portfolio</h2><button type="button" className="icon-button" onClick={close} aria-label="Close import"><X size={18} /></button></div>
    <p className="import-privacy"><ShieldCheck size={15} /> Your file is read <b>on this device only</b>. It’s never uploaded; we save just the fund/stock names and values you confirm.</p>

    {!source ? <div className="import-sources">{sources.map(s => <button key={s.id} type="button" onClick={() => { setSource(s.id); reset(); }}><span>{s.emoji}</span><strong>{s.title}</strong><small>{s.detail}</small></button>)}</div> : <>
      <div className="import-step">
        <button type="button" className="text-link" onClick={() => { setSource(null); reset(); }}>← Change source</button>
        <p className="import-how">{source === "mf_cas" ? <>Get it free from <b>camsonline.com</b> or <b>mfcentral.com</b> → “CAS” → choose <b>Detailed</b>. It arrives by email as a PDF with the password you set.</> : source === "demat_cas" ? <>NSDL and CDSL email it monthly. The password is usually your <b>PAN in capital letters</b>.</> : <>In your app, look for <b>Holdings → Download / Export</b> (CSV or Excel).</>}</p>
        {source === "app" && <label className="import-field">Most of these are <select value={defaultType} onChange={e => setDefaultType(e.target.value as ImportInvestmentType)}><option value="stocks">Stocks</option><option value="mutual_fund">Mutual funds</option><option value="other">Mixed / other</option></select></label>}
        <label className="import-file"><input type="file" accept={SOURCES.find(s => s.id === source)!.accept} onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); setResult(null); setNeedPassword(false); setError(""); if (f) void read(f, ""); }} /><span>{file ? `📎 ${file.name}` : "Choose file"}</span></label>
        {needPassword && <form className="import-password" onSubmit={e => { e.preventDefault(); void read(file, password); }}>
          <label><Lock size={14} /> PDF password<input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} autoFocus /></label>
          <button type="submit" className="button button-primary" disabled={!password || busy}>Unlock</button>
          <small>The password is only used on this device to open the file.</small>
        </form>}
        {busy && <p className="profile-status">Reading your file…</p>}
        {error && <p className="delete-error" role="alert">{error}</p>}
      </div>

      {sheet && sheet.rows.length > 0 && (!result?.holdings.length || source === "app") && <details className="import-map" open={!result?.holdings.length}>
        <summary>Match the columns {result?.holdings.length ? "(looks right ✓)" : ""}</summary>
        <div>{MAP_FIELDS.map(f => <label key={f.key}>{f.label}{f.required ? " *" : ""}<select value={sheet.map[f.key]} onChange={e => remap(f.key, Number(e.target.value))}><option value={-1}>—</option>{(sheet.rows[sheet.headerRow] ?? []).map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}</select></label>)}</div>
      </details>}

      {result && result.holdings.length > 0 && <div className="import-preview">
        <div className="import-summary"><strong>{result.holdings.length} holding{result.holdings.length === 1 ? "" : "s"} found</strong><span>{result.format}{result.asOf ? ` · values as on ${new Date(result.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}</span></div>
        {result.warnings.map(w => <p key={w} className="import-warning">⚠️ {w}</p>)}
        <div className="import-rows">{plan.map(({ holding: h, existing: e }) => <label key={h.externalId} className={`import-row${selected[h.externalId] ? "" : " off"}`}>
          <input type="checkbox" checked={Boolean(selected[h.externalId])} onChange={ev => setSelected(s => ({ ...s, [h.externalId]: ev.target.checked }))} />
          <span className="import-name"><b>{h.name}</b><small>{h.folio ? `Folio ${h.folio}` : h.isin ?? ""}{h.units !== null ? ` · ${h.units.toLocaleString("en-IN")} units` : ""}</small></span>
          <select value={types[h.externalId]} onChange={ev => setTypes(t => ({ ...t, [h.externalId]: ev.target.value as ImportInvestmentType }))} aria-label={`Type for ${h.name}`}>{Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <span className="import-value"><b>{money(h.value)}</b><em className={e ? "upd" : "new"}>{e ? `Update · was ${money(e.current_value)}` : "New"}</em></span>
        </label>)}</div>
        {stale.length > 0 && <label className="profile-check import-stale"><input type="checkbox" checked={removeOld} onChange={e => setRemoveOld(e.target.checked)} /> Remove {stale.length} holding{stale.length === 1 ? "" : "s"} from your last import that {stale.length === 1 ? "isn’t" : "aren’t"} in this file (sold or redeemed): {stale.slice(0, 3).map(s => s.name).join(", ")}{stale.length > 3 ? "…" : ""}</label>}
        <div className="import-actions"><span>Total selected <b>{money(total)}</b></span><button type="button" className="button button-primary" disabled={busy || !chosen.length} onClick={() => void save()}>{busy ? "Saving…" : `Import ${chosen.length} holding${chosen.length === 1 ? "" : "s"}`}</button></div>
        <small className="import-note">Imported items count toward your FIRE portfolio. Edit any of them later, e.g. link one to a goal.</small>
      </div>}

      {rawLines.length > 0 && <details className="import-raw" open={showRaw} onToggle={e => setShowRaw((e.target as HTMLDetailsElement).open)}>
        <summary>Show what we read (for troubleshooting)</summary>
        <p>If something’s missing, copy this and send it via <a href="/feedback">Ideas &amp; rewards</a>. Digits, PAN and emails are already hidden.</p>
        <textarea readOnly rows={8} value={maskForSharing(rawLines)} />
      </details>}
    </>}
  </section>;
}
