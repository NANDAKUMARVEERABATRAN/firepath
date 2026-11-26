import type { FinancialState } from "./financialState.ts";
import { getBadges, getFireScore, getInvestmentStreak } from "./fireScore.ts";
import { getFreedomMetrics, getFreedomPath, getRank, getXp } from "./freedomPath.ts";
import { analyzeGoal } from "./goals.ts";
import { getProgressSummary } from "./progress.ts";

/** Everything a user has built in FIREpath — shown before they cancel, so they see what they'd leave behind. */
export function getGameSummary(state: FinancialState) {
  const profile = state.scoreProfile;
  if (!profile) return null;
  const options = { retirementAge: state.plan.retirement_age, expectedReturn: state.plan.expected_return, inflation: state.plan.inflation_rate };
  const path = getFreedomPath(profile, options);
  const streak = getInvestmentStreak(state.checkins.map(row => ({ month_start: row.month_start, invested: row.invested })));
  const badges = getBadges(profile, streak).filter(badge => badge.earned || state.badgeKeys.includes(badge.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")));
  const activeGoals = state.goals.filter(goal => !goal.completed_at);
  const goalProgress = activeGoals.length ? activeGoals.reduce((sum, goal) => sum + analyzeGoal(goal).progress, 0) / activeGoals.length : 0;
  const xp = getXp({
    levelsCleared: path.filter(level => level.cleared).length, badgesEarned: badges.length, checkins: state.checkins.length, investmentStreak: streak,
    lessonsCompleted: state.lessons.length, lessonsCorrect: state.lessons.filter(lesson => lesson.answered_correctly).length,
    goalsCreated: state.goals.length, goalsCompleted: state.goals.filter(goal => goal.completed_at).length, goalProgressPercent: goalProgress, whySet: state.why.reasons.length > 0,
  });
  return {
    profile, xp: xp.total, rank: getRank(xp.total), levelsCleared: path.filter(level => level.cleared).length, streak, badges: badges.length,
    lessons: state.lessons.length, goals: activeGoals.length, checkins: state.checkins.length,
    metrics: getFreedomMetrics(profile, options), score: getFireScore(profile).score, history: getProgressSummary(state.snapshots),
  };
}
