import assert from "node:assert/strict";
import test from "node:test";
import { getProStatus, hasPro } from "../lib/subscription.ts";
import { getWhyResult } from "../lib/fireWhy.ts";
import { sipForYears, yearsToTarget, yearsToTargetStepUp } from "../lib/freedomPath.ts";

test("annual step-up brings freedom sooner; 0% step-up matches the flat plan", () => {
  const flat = yearsToTarget(500_000, 20_000, 20_000_000, 4);
  assert.equal(yearsToTargetStepUp(500_000, 20_000, 20_000_000, 4, 0, 0), flat);
  const stepped = yearsToTargetStepUp(500_000, 20_000, 20_000_000, 4, 10, 6);
  assert.ok(stepped !== null && flat !== null && stepped < flat, "10% yearly step-up should be faster");
  // A step-up that only matches inflation adds nothing in real terms.
  assert.equal(yearsToTargetStepUp(500_000, 20_000, 20_000_000, 4, 6, 6), flat);
});

const now = new Date("2026-11-26T10:00:00Z");
const days = n => new Date(now.getTime() + n * 86_400_000).toISOString();

test("Pro status: none, active trial, paid, expired", () => {
  assert.equal(getProStatus(null, now).state, "none");
  assert.equal(hasPro(getProStatus(null, now)), false);
  const trial = getProStatus({ plan: "trial", status: "active", current_period_end: days(12), trial_started_at: days(-18) }, now);
  assert.equal(trial.state, "trial");
  assert.equal(trial.daysLeft, 12);
  assert.equal(trial.trialUsed, true);
  assert.equal(hasPro(trial), true);
  assert.equal(getProStatus({ plan: "yearly", status: "cancelled", current_period_end: days(40), trial_started_at: null }, now).state, "paid");
  const expired = getProStatus({ plan: "trial", status: "active", current_period_end: days(-1), trial_started_at: days(-31) }, now);
  assert.equal(expired.state, "expired");
  assert.equal(hasPro(expired), false);
  assert.equal(expired.trialUsed, true);
});

test("why: reasons pick a FIRE style and purpose score rewards clarity", () => {
  assert.equal(getWhyResult(["business"]).style, "runway");
  assert.equal(getWhyResult(["hobby", "give"]).style, "barista");
  assert.equal(getWhyResult(["luxury", "travel"]).style, "fat");
  assert.equal(getWhyResult([]).style, "classic");
  assert.equal(getWhyResult([]).purposeScore, 0);
  const vague = getWhyResult(["early"]).purposeScore;
  const clear = getWhyResult(["early", "family"], "Coach kids’ football every weekend", 45).purposeScore;
  assert.ok(clear > vague);
  assert.ok(clear <= 100);
});

test("sipForYears finds the monthly amount that reaches the target in time", () => {
  const sip = sipForYears(0, 1_200_000, 0, 10);
  assert.ok(sip !== null && sip >= 10_000 && sip <= 10_100);
  assert.ok(yearsToTarget(0, sip, 1_200_000, 0) <= 10);
  assert.equal(sipForYears(2_000_000, 1_000_000, 5, 5), 0);
  assert.equal(sipForYears(0, 1_000_000, 5, 0), null);
});
