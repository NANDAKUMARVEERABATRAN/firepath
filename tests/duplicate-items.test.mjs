import test from "node:test";
import assert from "node:assert/strict";
import { duplicateGroups, sameTypeItems } from "../lib/netWorth.ts";

const mf = (id, name, value, at) => ({ id, kind: "asset", category: "investment", investment_type: "mutual_fund", name, current_value: value, created_at: at, updated_at: at });
const accounts = [
  mf("a", "Mutual funds", 3500000, "2026-10-28T10:00:00Z"),
  mf("b", "Mutual Funds", 3700000, "2026-11-27T10:00:00Z"),
  mf("c", "Parag Parikh Flexi Cap", 800000, "2026-11-01T10:00:00Z"),
  { id: "d", kind: "asset", category: "investment", investment_type: "stocks", name: "Mutual funds", current_value: 1, created_at: "2026-11-01" },
];

test("the same holding added twice is found, newest first", () => {
  const groups = duplicateGroups(accounts);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].map(a => a.id), ["b", "a"]);
});

test("different funds of the same type are not duplicates, but are offered for update", () => {
  assert.deepEqual(sameTypeItems(accounts, { kind: "asset", category: "investment", investment_type: "mutual_fund" }).map(a => a.id), ["b", "c", "a"]);
  assert.equal(sameTypeItems(accounts, { kind: "asset", category: "investment", investment_type: "gold" }).length, 0);
});

import { existingSameItem } from "../lib/netWorth.ts";
test("adding 'Mutual funds' again finds the saved item to update", () => {
  const entry = { kind: "asset", category: "investment", investment_type: "mutual_fund", name: "mutual fund" };
  assert.equal(existingSameItem([accounts[0], accounts[2]], entry).id, "a");
  assert.equal(existingSameItem([accounts[2]], entry), null);
});
