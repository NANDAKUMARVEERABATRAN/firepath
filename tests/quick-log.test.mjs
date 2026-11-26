import assert from "node:assert/strict";
import test from "node:test";
import { holdingToAccount, isEmptyLog, maskSensitive, matchAccount, normalizeQuickLog } from "../lib/quickLog.ts";

test("sensitive details are masked before anything is sent to the AI", () => {
  const out = maskSensitive("Salary 1.2L credited to a/c 123456789012, PAN ABCDE1234F, mail me a@b.com, call 98765 43210, rent 25000");
  assert.doesNotMatch(out, /123456789012|ABCDE1234F|a@b\.com|98765 43210/);
  assert.match(out, /rent 25000/); // amounts stay
  assert.match(out, /1\.2L/);
});

test("AI output is validated: bad amounts dropped, unknown categories become other, future dates removed", () => {
  const r = normalizeQuickLog({
    checkin: { income: 120000, salary_pf: "7,200", salary_pension: null, investment_income: -5, expenses: null, invested: 25000, debt_paid: 1e12 },
    spending: [{ category: "dining", amount: 3000, note: "Swiggy", date: null }, { category: "aliens", amount: 500, note: "x", date: "2999-01-01" }, { category: "groceries", amount: 0, note: "zero", date: null }],
    holdings: [{ name: "PPF", type: "ppf", value: 320000 }, { name: "", type: "stocks", value: 5 }],
    unclear: ["Was 25k a SIP?"],
  }, "2026-11-26");
  assert.equal(r.checkin.income, 120000);
  assert.equal(r.checkin.salary_pf, 7200);
  assert.equal(r.checkin.investment_income, null);
  assert.equal(r.checkin.debt_paid, null); // absurd amount dropped
  assert.equal(r.spending.length, 2);
  assert.equal(r.spending[1].category, "other");
  assert.equal(r.spending[1].date, null);
  assert.equal(r.holdings.length, 1);
  assert.deepEqual(r.unclear, ["Was 25k a SIP?"]);
  assert.equal(isEmptyLog(normalizeQuickLog(null, "2026-11-26")), true);
});

test("balances map to the right portfolio type and match existing items", () => {
  assert.deepEqual(holdingToAccount("ppf"), { kind: "asset", category: "investment", investment_type: "ppf", fire_treatment: "later", label: "PPF" });
  assert.equal(holdingToAccount("home_loan").kind, "liability");
  const accounts = [
    { id: "1", name: "HDFC FD", kind: "asset", category: "investment", investment_type: "fixed_deposit", current_value: 100000 },
    { id: "2", name: "SBI FD", kind: "asset", category: "investment", investment_type: "fixed_deposit", current_value: 200000 },
    { id: "3", name: "My PPF", kind: "asset", category: "investment", investment_type: "ppf", current_value: 300000 },
  ];
  assert.equal(matchAccount({ name: "SBI fixed deposit", type: "fixed_deposit", value: 210000 }, accounts).id, "2");
  assert.equal(matchAccount({ name: "PPF", type: "ppf", value: 320000 }, accounts).id, "3");
  assert.equal(matchAccount({ name: "ICICI FD", type: "fixed_deposit", value: 1 }, accounts), null); // ambiguous → add new
  assert.equal(matchAccount({ name: "Gold", type: "gold", value: 1 }, accounts), null);
});

import { basicQuickLog } from "../lib/quickLog.ts";
import { parseSpokenAmount } from "../lib/voiceForms.ts";
test("basic mode (no AI) handles common Indian phrasing", () => {
  const r = basicQuickLog("Salary 1.2L aaya, PF 7,200 kata, NPS 3k bhi, rent 25k diya, Swiggy pe 1,800, SIP 25k gaya", "2026-11-26", parseSpokenAmount);
  assert.equal(r.checkin.income, 120000);
  assert.equal(r.checkin.salary_pf, 7200);
  assert.equal(r.checkin.salary_pension, 3000);
  assert.equal(r.checkin.invested, 25000);
  assert.deepEqual(r.spending.map(s => [s.category, s.amount]), [["housing", 25000], ["dining", 1800]]);
  const b = basicQuickLog("petrol 3000, electricity bill 2400, groceries from DMart 5600, sent 10k to parents, car EMI 15k", "2026-11-26", parseSpokenAmount);
  assert.deepEqual(b.spending.map(s => s.category), ["transport", "utilities", "groceries", "family"]);
  assert.equal(b.checkin.debt_paid, 15000);
  const h = basicQuickLog("PPF balance 3.2 lakh, home loan outstanding 24L, mutual funds worth 8.5 lakh, FD of 2 lakh in SBI balance", "2026-11-26", parseSpokenAmount);
  assert.deepEqual(h.holdings.map(x => [x.type, x.value]), [["ppf", 320000], ["home_loan", 2400000], ["mutual_fund", 850000], ["fixed_deposit", 200000]]);
});
