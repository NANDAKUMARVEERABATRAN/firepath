import assert from "node:assert/strict";
import test from "node:test";
import { pickLesson, principlesInAction } from "../lib/bookCoach.ts";

const calm = { savingsRate: 35, investRate: 30, emergencyMonths: 8, highInterestDebt: 0, protectedCover: true, spendingChange: 2, incomeChange: 0, portfolioChange: 1, fireProgress: 40, streak: 5 };

test("today's lesson follows the person's weakest spot", () => {
  assert.equal(pickLesson({ ...calm, portfolioChange: -8 }, []).lesson.id, "ii-mrmarket");
  assert.match(pickLesson({ ...calm, portfolioChange: -8 }, []).reason, /dipped 8%/);
  assert.equal(pickLesson({ ...calm, spendingChange: 22 }, []).lesson.id, "iwt-conscious");
  assert.equal(pickLesson({ ...calm, savingsRate: 6 }, []).lesson.id, "rdpd-payfirst");
  // Already read that one? Take the next lesson for the same situation.
  assert.equal(pickLesson({ ...calm, savingsRate: 6 }, ["rdpd-payfirst"]).lesson.id, "babylon-tenth");
  // Nothing urgent: the normal daily rotation, with no reason shown.
  assert.equal(pickLesson(calm, []).reason, null);
});

test("principles are earned by behaviour, not by reading", () => {
  const list = principlesInAction({ streak: 7, savingsRates: [22, 18, 12, 4], emergencyMonths: 6.5, highInterestDebt: 0, hasInvestments: true, protectedCover: false, leaksPlugged: 1, definedEnough: true });
  const by = Object.fromEntries(list.map(p => [p.id, p]));
  assert.equal(by["pay-first"].earned, true);
  assert.equal(by.tenth.earned, true); // 3 months in a row at 10%+
  assert.equal(by.room.earned, true);
  assert.equal(by.insure.earned, false);
  assert.equal(by.time.earned, false);
  assert.equal(by.time.progressLabel, "7 of 12 months");
  assert.equal(by["need-less"].earned, false);
});
