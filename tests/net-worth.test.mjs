import assert from "node:assert/strict";
import test from "node:test";
import { getNetWorthBreakdown, isFireAccessible, propertyTreatment } from "../lib/netWorth.ts";
import { applyLinkedSavings } from "../lib/goals.ts";

test("money set aside for a goal leaves the FIRE portfolio but stays in the overall portfolio", () => {
  const rows = [
    { kind: "asset", category: "investment", current_value: 1_000_000, fire_treatment: "available" },
    { kind: "asset", category: "investment", current_value: 300_000, fire_treatment: "available", goal_id: "house" },
    { kind: "asset", category: "property", current_value: 2_000_000, fire_treatment: "available", property_use: "investment", goal_id: "house" },
  ];
  const b = getNetWorthBreakdown(rows);
  assert.equal(b.fireAccessible, 1_000_000);
  assert.equal(b.goalMoney, 2_300_000);
  assert.equal(b.totalAssets, 3_300_000);
  assert.equal(isFireAccessible(rows[0]), true);
  assert.equal(isFireAccessible(rows[1]), false);
});

test("a goal's savings come from its linked portfolio items; unlinked goals keep the typed amount", () => {
  const goals = [{ id: "house", saved_amount: 50_000 }, { id: "trip", saved_amount: 20_000 }];
  const [house, trip] = applyLinkedSavings(goals, [
    { kind: "asset", goal_id: "house", current_value: 300_000 },
    { kind: "asset", goal_id: "house", current_value: 200_000 },
    { kind: "liability", goal_id: "house", current_value: 999 },
  ]);
  assert.equal(house.saved_amount, 500_000);
  assert.equal(house.linkedCount, 2);
  assert.equal(trip.saved_amount, 20_000);
  assert.equal(trip.linkedCount, 0);
});

test("a home you live in is excluded from FIRE; rented or investment property counts", () => {
  assert.equal(propertyTreatment("self_occupied"), "excluded");
  assert.equal(propertyTreatment(null), "excluded");
  assert.equal(propertyTreatment("rented"), "available");
  assert.equal(propertyTreatment("investment"), "available");
});

test("net worth breakdown separates home, investment property, later money and loans", () => {
  const b = getNetWorthBreakdown([
    { kind: "asset", category: "investment", current_value: 1_000_000, fire_treatment: "available" },
    { kind: "asset", category: "investment", current_value: 400_000, fire_treatment: "later" },
    { kind: "asset", category: "property", current_value: 8_000_000, fire_treatment: "excluded", property_use: "self_occupied" },
    { kind: "asset", category: "property", current_value: 3_000_000, fire_treatment: "available", property_use: "rented" },
    { kind: "asset", category: "vehicle", current_value: 600_000, fire_treatment: "excluded" },
    { kind: "liability", category: "home_loan", current_value: 5_000_000, fire_treatment: "excluded" },
    { kind: "liability", category: "credit_card", current_value: 50_000, fire_treatment: "excluded" },
  ]);
  assert.equal(b.fireInvestments, 1_000_000);
  assert.equal(b.investmentProperty, 3_000_000);
  assert.equal(b.fireAccessible, 4_000_000);
  assert.equal(b.laterRetirement, 400_000);
  assert.equal(b.home, 8_000_000);
  assert.equal(b.otherOutside, 600_000);
  assert.equal(b.totalAssets, 13_000_000);
  assert.equal(b.totalLiabilities, 5_050_000);
  assert.equal(b.netWorth, 7_950_000);
  assert.equal(b.homeEquity, 3_000_000);
});
