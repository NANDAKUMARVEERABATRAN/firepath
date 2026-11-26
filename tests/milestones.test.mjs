import assert from "node:assert/strict";
import test from "node:test";
import { getMilestones, shareText } from "../lib/milestones.ts";

const input = { fireProgress: 27, rankName: "Wealth Builder", rankNumber: 6, streak: 7, levelsCleared: 6, freedomMonths: 30, lessons: 12, progressGain: 3 };

test("milestones pick the right thresholds and sort by impressiveness", () => {
  const list = getMilestones(input);
  const ids = list.map(m => m.id);
  assert.ok(ids.includes("fire-25"));
  assert.ok(ids.includes("freedom-24"));
  assert.ok(ids.includes("streak-6"));
  assert.ok(ids.includes("levels-6"));
  assert.equal(list[0].id, "fire-25");
  for (let i = 1; i < list.length; i += 1) assert.ok(list[i - 1].weight >= list[i].weight);
  assert.equal(getMilestones({ ...input, fireProgress: 100 })[0].headline, "I’m financially independent!");
  assert.equal(getMilestones({ fireProgress: 1, rankName: "Rookie Saver", rankNumber: 1, streak: 0, levelsCleared: 1, freedomMonths: 0, lessons: 0 }).length, 0);
});

test("shared text never contains money amounts", () => {
  for (const m of getMilestones(input)) {
    const text = shareText(m, "https://example.com");
    assert.doesNotMatch(text, /₹|AED|lakh|crore|\d{1,3}(,\d{2,3})+/, m.id);
  }
});
