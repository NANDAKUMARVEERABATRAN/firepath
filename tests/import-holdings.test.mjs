import assert from "node:assert/strict";
import test from "node:test";
import { autoMapColumns, findHeaderRow, guessType, parseCasText, parseCsv, parseDate, parseNumber, planImport, rowsToHoldings, textItemsToLines } from "../lib/importHoldings.ts";

test("numbers and dates in Indian formats", () => {
  assert.equal(parseNumber("₹1,23,456.78"), 123456.78);
  assert.equal(parseNumber("INR 45,678.9"), 45678.9);
  assert.equal(parseNumber("(1,200)"), -1200);
  assert.equal(parseNumber("--"), null);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseDate("25-Nov-2026"), "2026-11-25");
  assert.equal(parseDate("05/11/2026"), "2026-11-05");
});

test("type guessing", () => {
  assert.equal(guessType("Axis Bluechip Fund - Direct Growth"), "mutual_fund");
  assert.equal(guessType("RELIANCE", "INE002A01018"), "stocks");
  assert.equal(guessType("SGB Mar 2031"), "gold");
  assert.equal(guessType("Nippon India ETF Gold BeES"), "gold");
  assert.equal(guessType("INFY", null, "stocks"), "stocks");
});

test("CSV with quotes, title rows above the table, and a totals row", () => {
  const csv = `Holdings statement as on 25-11-2026\n\n"Instrument","Qty.","Avg. cost","LTP","Cur. val","P&L"\n"RELIANCE","10","2400.00","2,500.50","25005.00","1005"\n"TATA STEEL, LTD","5","100","150","750","250"\nTotal,,,,25755,\n`;
  const rows = parseCsv(csv);
  assert.equal(findHeaderRow(rows), 1);
  const map = autoMapColumns(rows[1]);
  assert.equal(map.name, 0); assert.equal(map.value, 4); assert.equal(map.units, 1); assert.equal(map.price, 3);
  const result = rowsToHoldings(rows, { source: "zerodha", defaultType: "stocks" });
  assert.equal(result.holdings.length, 2);
  assert.equal(result.holdings[1].name, "TATA STEEL, LTD");
  assert.equal(result.holdings[0].value, 25005);
  assert.equal(result.holdings[0].investmentType, "stocks");
  assert.equal(result.holdings[0].externalId, "name:zerodha:reliance");
});

test("Groww-style mutual fund export: current value column, not invested value", () => {
  const rows = [["Scheme Name", "AMC", "Category", "Folio No.", "Units", "Invested Value", "Current Value", "Returns"], ["Parag Parikh Flexi Cap Fund Direct Growth", "PPFAS", "Equity", "1234/56", "100.5", "50000", "62,345.10", "12345.10"]];
  const result = rowsToHoldings(rows, { source: "groww" });
  assert.equal(result.holdings.length, 1);
  assert.equal(result.holdings[0].value, 62345.1);
  assert.equal(result.holdings[0].folio, "1234/56");
  assert.equal(result.holdings[0].investmentType, "mutual_fund");
});

test("value computed from units × price when there is no value column", () => {
  const rows = [["Symbol", "Quantity", "LTP"], ["INFY", "4", "1500.25"]];
  assert.equal(rowsToHoldings(rows, { source: "x", defaultType: "stocks" }).holdings[0].value, 6001);
});

test("CAMS / KFintech detailed CAS", () => {
  const lines = [
    "Consolidated Account Statement",
    "01-Jan-2026 To 25-Nov-2026",
    "Folio No: 1234567 / 89          KYC: OK   PAN: OK",
    "B205RG-Axis Bluechip Fund - Regular Growth - ISIN: INF846K01164(Advisor: ARN-0000) Registrar : KFINTECH",
    "Opening Unit Balance: 100.000",
    "10-Feb-2026   Purchase - SIP   5,000.00   110.123   45.40   1,210.123",
    "Closing Unit Balance: 1,234.567   NAV on 25-Nov-2026: INR 45.6789   Total Cost Value: 50,000.00   Market Value on 25-Nov-2026: INR 56,375.12",
    "Folio No: 9876543210 / 0      KYC: OK  PAN: OK",
    "P8042-ICICI Prudential Nifty 50 Index Fund - Direct Plan -",
    "Growth - ISIN: INF109K012R6 Registrar : CAMS",
    "Closing Unit Balance: 500.000   NAV on 25-Nov-2026: INR 200.0000   Total Cost Value: 80,000.00   Market Value on 25-Nov-2026: INR 1,00,000.00",
  ];
  const result = parseCasText(lines);
  assert.equal(result.holdings.length, 2);
  const [axis, icici] = result.holdings;
  assert.equal(axis.name, "Axis Bluechip Fund - Regular Growth");
  assert.equal(axis.value, 56375.12);
  assert.equal(axis.units, 1234.567);
  assert.equal(axis.price, 45.6789);
  assert.equal(axis.folio, "1234567 / 89");
  assert.equal(axis.asOf, "2026-11-25");
  assert.equal(axis.externalId, "folio:1234567/89|INF846K01164");
  assert.match(icici.name, /ICICI Prudential Nifty 50 Index Fund - Direct Plan - Growth/);
  assert.equal(icici.value, 100000);
  assert.equal(result.warnings.length, 0);
});

test("NSDL / CDSL style table rows", () => {
  const lines = [
    "NSDL Consolidated Account Statement",
    "Statement for the period from 01-Oct-2026 to 31-Oct-2026",
    "ISIN   Security   Current Bal.   Market Price   Value",
    "INE002A01018   RELIANCE INDUSTRIES LIMITED   10   2,500.00   25,000.00",
    "INE040A01034   HDFC BANK LIMITED   20.000   1,600.50   32,010.00",
    "INF204KB14I2   Nippon India ETF Nifty BeES   100.000   250.00   25,000.00",
    "INE999Z99999   SOMETHING WITHOUT NUMBERS",
  ];
  const result = parseCasText(lines);
  assert.equal(result.format, "NSDL CAS");
  assert.equal(result.asOf, "2026-10-31");
  assert.equal(result.holdings.length, 3);
  const reliance = result.holdings[0];
  assert.equal(reliance.name, "RELIANCE INDUSTRIES LIMITED");
  assert.equal(reliance.units, 10);
  assert.equal(reliance.price, 2500);
  assert.equal(reliance.value, 25000);
  assert.equal(reliance.investmentType, "stocks");
  assert.equal(result.holdings[2].investmentType, "mutual_fund");
  assert.equal(result.warnings.length, 1); // the unreadable ISIN line
});

test("PDF text items become lines in reading order", () => {
  const lines = textItemsToLines([
    { str: "Market Value", x: 300, y: 700, width: 60 }, { str: "Folio No: 1", x: 10, y: 720, width: 50 },
    { str: "Closing", x: 10, y: 700.8, width: 35 }, { str: " ", x: 5, y: 600 },
  ]);
  assert.deepEqual(lines, ["Folio No: 1", "Closing   Market Value"]);
});

test("re-import updates instead of duplicating", () => {
  const holdings = parseCasText(["Folio No: 1 / 2", "X Fund - ISIN: INF000000001", "Market Value on 01-Nov-2026: INR 1,000.00"]).holdings;
  const plan = planImport(holdings, [{ id: "a", external_id: "folio:1/2|INF000000001", current_value: 900 }]);
  assert.equal(plan[0].existing.id, "a");
});
