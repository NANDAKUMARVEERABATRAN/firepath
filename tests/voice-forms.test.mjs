import assert from "node:assert/strict";
import test from "node:test";
import { parseLabeledAmount, parseSpokenAmount } from "../lib/voiceForms.ts";

test("spoken amounts support Indian number units", () => {
  assert.equal(parseSpokenAmount("2.5 lakh"), 250_000);
  assert.equal(parseSpokenAmount("1.2 crore"), 12_000_000);
  assert.equal(parseSpokenAmount("₹75,000"), 75_000);
  assert.equal(parseSpokenAmount("no amount"), null);
});

test("spoken amounts support Hindi numerals and Hindi or Hinglish number words", () => {
  assert.equal(parseSpokenAmount("₹७५,०००"), 75_000);
  assert.equal(parseSpokenAmount("पाँच हजार"), 5_000);
  assert.equal(parseSpokenAmount("do lakh"), 200_000);
  assert.equal(parseSpokenAmount("तीन करोड़"), 30_000_000);
});

test("spoken amounts handle browser transcripts: nukta spellings, plurals, compounds, Hindi fractions", () => {
  assert.equal(parseSpokenAmount("80 हज़ार"), 80_000);
  assert.equal(parseSpokenAmount("पाँच हज़ार"), 5_000);
  assert.equal(parseSpokenAmount("two lakhs"), 200_000);
  assert.equal(parseSpokenAmount("two crores"), 20_000_000);
  assert.equal(parseSpokenAmount("1 lakh 50 thousand"), 150_000);
  assert.equal(parseSpokenAmount("one lakh fifty thousand"), 150_000);
  assert.equal(parseSpokenAmount("डेढ़ लाख"), 150_000);
  assert.equal(parseSpokenAmount("ढाई लाख"), 250_000);
  assert.equal(parseSpokenAmount("साढ़े तीन लाख"), 350_000);
  assert.equal(parseSpokenAmount("1,50,000"), 150_000);
  assert.equal(parseSpokenAmount("50k"), 50_000);
  assert.equal(parseLabeledAmount("आमदनी 80 हज़ार खर्च 40 हज़ार", ["expenses"]), 40_000);
  assert.equal(parseLabeledAmount("My income is ₹1,20,000 and expenses are ₹65,000", ["expenses", "expense"]), 65_000);
});

test("labeled check-in figures stop at the next field label", () => {
  const transcript = "income 80000, investment income 5000, expenses 40000, invested 10000";

  assert.equal(parseLabeledAmount(transcript, ["income", "salary"]), 80_000);
  assert.equal(parseLabeledAmount(transcript, ["investment income", "dividends", "investment payouts"]), 5_000);
  assert.equal(parseLabeledAmount(transcript, ["expenses", "expense", "spending"]), 40_000);
  assert.equal(parseLabeledAmount(transcript, ["invested", "investment"]), 10_000);
});

test("labeled monthly figures can be spoken in Hindi", () => {
  const transcript = "आमदनी 80000, निवेश से आय 5000, खर्च 40000, निवेश 10000";
  assert.equal(parseLabeledAmount(transcript, ["income", "salary"]), 80_000);
  assert.equal(parseLabeledAmount(transcript, ["investment income", "dividends", "investment payouts"]), 5_000);
  assert.equal(parseLabeledAmount(transcript, ["expenses", "expense", "spending"]), 40_000);
  assert.equal(parseLabeledAmount(transcript, ["invested", "investment"]), 10_000);
});
