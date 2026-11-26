/**
 * Shareable milestones. Deliberately shows only percentages, ranks, streaks and levels —
 * never money amounts — so sharing is safe and doesn't reveal anyone's finances.
 */
import { PATH_LEVELS } from "./freedomPath.ts";

export type Milestone = { id: string; emoji: string; headline: string; sub: string; progress?: number; weight: number };

export type MilestoneInput = {
  fireProgress: number; // %
  rankName: string;
  rankNumber: number;
  streak: number; // months
  levelsCleared: number; // of PATH_LEVELS
  freedomMonths: number; // months of expenses the FIRE portfolio covers
  lessons: number;
  progressGain?: number; // percentage points since joining
};

export function getMilestones(m: MilestoneInput): Milestone[] {
  const list: Milestone[] = [];
  const fire = [100, 75, 50, 25, 10, 5].find(threshold => m.fireProgress >= threshold);
  if (fire) list.push({ id: `fire-${fire}`, emoji: fire === 100 ? "🏆" : "🔥", headline: fire === 100 ? "I’m financially independent!" : `I’m ${fire}% of the way to financial freedom`, sub: fire === 100 ? "Work is now optional." : "One step at a time, on my FIRE path.", progress: Math.min(100, m.fireProgress), weight: fire * 3 });
  const freedom = [60, 24, 12, 6].find(threshold => m.freedomMonths >= threshold);
  if (freedom) list.push({ id: `freedom-${freedom}`, emoji: "⏳", headline: freedom >= 12 ? `I already own ${Math.floor(freedom / 12)} year${freedom >= 24 ? "s" : ""} of freedom` : "I already own 6 months of freedom", sub: "My investments could cover my life for that long.", weight: freedom * 2 });
  const streak = [24, 12, 6, 3].find(threshold => m.streak >= threshold);
  if (streak) list.push({ id: `streak-${streak}`, emoji: "🔥", headline: `${streak}-month investing streak`, sub: "Consistency beats intensity.", weight: streak * 6 });
  if (m.levelsCleared >= 3) list.push({ id: `levels-${m.levelsCleared}`, emoji: "🗺️", headline: m.levelsCleared >= PATH_LEVELS ? "I reached Fat FIRE on my Freedom Path" : `Level ${m.levelsCleared} of ${PATH_LEVELS} cleared on my Freedom Path`, sub: "From money map to financial independence.", progress: (m.levelsCleared / PATH_LEVELS) * 100, weight: m.levelsCleared * 8 });
  if (m.rankNumber >= 2) list.push({ id: `rank-${m.rankNumber}`, emoji: "👑", headline: `I’m now a ${m.rankName}`, sub: `Rank ${m.rankNumber} of 10 on FIREpath.`, weight: m.rankNumber * 7 });
  if ((m.progressGain ?? 0) >= 1) list.push({ id: "gain", emoji: "📈", headline: `${m.progressGain!.toFixed(1)}% closer to freedom since I started`, sub: "Small steps, every month.", weight: 40 + m.progressGain! * 4 });
  if (m.lessons >= 5) list.push({ id: `lessons-${m.lessons}`, emoji: "📚", headline: `${m.lessons} lessons from the best money books`, sub: "Learning to make money work for me.", weight: m.lessons * 2 });
  return list.sort((a, b) => b.weight - a.weight);
}

/** Text that goes with a share: the milestone plus an invite to the free calculator. */
export const shareText = (milestone: Milestone, siteUrl: string) => `${milestone.emoji} ${milestone.headline} — ${milestone.sub}\n\nFind your own FIRE number free on FIREpath: ${siteUrl}`;
