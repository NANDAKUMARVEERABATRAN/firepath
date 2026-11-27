import assert from "node:assert/strict";
import test from "node:test";
import { freeMonthsFromPoints, pointsValue, redeemOnBill } from "../lib/rewards.ts";

test("points convert to money per country", () => {
  assert.equal(pointsValue(100, "IN"), 10);
  assert.equal(pointsValue(1000, "AE"), 15);
  assert.equal(pointsValue(-50, "IN"), 0);
});

test("redemption is capped at half the bill and never uses more points than you have", () => {
  assert.deepEqual(redeemOnBill(200, 99, "IN"), { discount: 20, pointsUsed: 200 });
  assert.deepEqual(redeemOnBill(5000, 99, "IN"), { discount: 49.5, pointsUsed: 495 });
  assert.deepEqual(redeemOnBill(0, 799, "IN"), { discount: 0, pointsUsed: 0 });
  assert.equal(redeemOnBill(5000, 15, "AE").discount, 7.5);
});

test("free months from points", () => {
  assert.equal(freeMonthsFromPoints(1000, "IN"), 1); // ₹100 = one month
  assert.equal(freeMonthsFromPoints(990, "IN"), 0); // ₹99 is just short
  assert.equal(freeMonthsFromPoints(500, "IN"), 0);
  assert.equal(freeMonthsFromPoints(2000, "AE"), 2); // AED 30 = two months at AED 15
});
