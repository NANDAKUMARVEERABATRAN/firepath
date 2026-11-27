import assert from "node:assert/strict";
import test from "node:test";
import { chipAmount, countryAmountInWords, countryFromCurrency, formatCountryMoney, getCountry, priceText } from "../lib/country.ts";
import { lessonExample, lessons } from "../lib/wisdom.ts";
import { styleTip } from "../lib/fireWhy.ts";
import { getFreedomPath } from "../lib/freedomPath.ts";

test("India uses lakh/crore; UAE uses thousand/million", () => {
  assert.equal(countryAmountInWords(120000, "IN"), "1.2 lakh");
  assert.equal(countryAmountInWords(25000000, "IN"), "2.5 crore");
  assert.equal(countryAmountInWords(120000, "AE"), "120 thousand");
  assert.equal(countryAmountInWords(2500000, "AE"), "2.5 million");
  assert.equal(chipAmount(1000000, "AE"), "AED 1M");
  assert.equal(chipAmount(150000, "AE"), "AED 150k");
});

test("currency formatting and country mapping", () => {
  assert.match(formatCountryMoney(15000, "AE"), /AED|د\.إ/);
  assert.match(formatCountryMoney(15000, "IN"), /₹/);
  assert.equal(countryFromCurrency("AED"), "AE");
  assert.equal(countryFromCurrency("INR"), "IN");
  assert.equal(countryFromCurrency(null), "IN");
  assert.equal(priceText(getCountry("AE").pricing.monthly, "AE"), "AED 15");
  assert.equal(priceText(99, "IN"), "₹99");
  assert.ok(getCountry("AE").defaults.inflation < getCountry("IN").defaults.inflation);
});

test("UAE users get UAE examples and tips; India unchanged", () => {
  for (const lesson of lessons) {
    assert.ok(lessonExample(lesson, "INR").length > 10, lesson.id);
    assert.doesNotMatch(lessonExample(lesson, "AED"), /₹/, `${lesson.id} shows rupees to UAE users`);
  }
  assert.match(styleTip("barista", "AED"), /AED/);
  assert.match(styleTip("barista", "INR"), /₹/);
});

test("Freedom Path wording adapts to the UAE", () => {
  const base = { age: 32, monthly_income: 25000, monthly_expenses: 15000, assets: 100000, liabilities: 0, emergency_fund: 30000, monthly_investment: 5000, has_health_insurance: true, has_term_insurance: false, health_cover_amount: 500000, currency: "AED" };
  const protection = getFreedomPath(base).find(level => level.id === "protection");
  assert.match(protection.why, /UAE/);
  assert.match(getFreedomPath({ ...base, currency: "INR" }).find(level => level.id === "protection").why, /India/);
});

import { yearlySavingPercent } from "../lib/country.ts";
test("India pricing: ₹100/month or ₹899/year (25% saving); UAE unchanged", () => {
  assert.deepEqual(getCountry("IN").pricing, { monthly: 100, yearly: 899 });
  assert.equal(yearlySavingPercent("IN"), 25);
  assert.equal(yearlySavingPercent("AE"), 34);
});

import { ENABLED_COUNTRIES, isCountryEnabled } from "../lib/country.ts";
test("only India is open to new users for now; UAE settings are kept for later", () => {
  assert.deepEqual(ENABLED_COUNTRIES, ["IN"]);
  assert.equal(isCountryEnabled("AE"), false);
  assert.equal(getCountry("AE").currency, "AED"); // existing AED profiles still format correctly
});

test("one money style everywhere: lakh and crore spelled out, never Cr/L", () => {
  assert.equal(formatCountryMoney(28584384, "IN"), "₹2.86 crore");
  assert.equal(formatCountryMoney(10000000, "IN"), "₹1 crore");
  assert.equal(formatCountryMoney(2858438, "IN"), "₹28,58,438");
  assert.equal(formatCountryMoney(-25000000, "IN"), "−₹2.5 crore");
  assert.equal(formatCountryMoney(1250000, "AE"), "AED 1.25 million");
});
