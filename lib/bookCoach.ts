/**
 * Book ideas that react to what the person actually does:
 *  1. pickLesson — today's lesson follows their weakest spot (spending up, markets down, low savings…).
 *  2. principlesInAction — book ideas earned by behaviour (investing every month, a 6-month buffer…), not by reading.
 * Neither touches the FIRE number or FIRE progress, which measure money only.
 */
import { getLessonOfDay, lessons, type Lesson } from "./wisdom.ts";

export type CoachSignals = {
  savingsRate: number; // %
  investRate: number; // % of income invested (incl. salary EPF/NPS)
  emergencyMonths: number;
  highInterestDebt: number;
  protectedCover: boolean; // health cover (and term cover if someone depends on them)
  spendingChange: number | null; // latest month vs usual, % (e.g. +18)
  incomeChange: number | null; // latest month vs usual, %
  portfolioChange: number | null; // FIRE portfolio vs previous snapshot, %
  fireProgress: number; // %
  streak: number; // months in a row with money invested
};

type Rule = { when: (s: CoachSignals) => boolean; lessons: string[]; why: (s: CoachSignals) => string };

/** Most urgent first. */
const RULES: Rule[] = [
  { when: s => (s.portfolioChange ?? 0) <= -5, lessons: ["ii-mrmarket", "malkiel-time", "pom-compounding"], why: s => `Your FIRE portfolio dipped ${Math.abs(Math.round(s.portfolioChange ?? 0))}% since last month. Here’s how great investors think about falls.` },
  { when: s => s.highInterestDebt > 0, lessons: ["rdpd-asset", "pom-room"], why: () => "You have expensive debt. Clearing it is a guaranteed return." },
  { when: s => s.emergencyMonths < 3, lessons: ["pom-room", "ii-margin"], why: s => `Your safety buffer covers ${s.emergencyMonths.toFixed(1)} months. This idea explains why that matters first.` },
  { when: s => !s.protectedCover, lessons: ["ltm-insurance"], why: () => "Your insurance cover isn’t complete yet. Protection comes before investing." },
  { when: s => s.savingsRate < 10, lessons: ["rdpd-payfirst", "babylon-tenth", "iwt-automate"], why: s => `You’re keeping ${Math.round(s.savingsRate)}% of what you earn. Small habit changes move this fastest.` },
  { when: s => (s.spendingChange ?? 0) >= 15, lessons: ["iwt-conscious", "ymyl-lifeenergy", "ere-needs"], why: s => `Your spending rose ${Math.round(s.spendingChange ?? 0)}% above your usual month.` },
  { when: s => (s.incomeChange ?? 0) >= 10, lessons: ["pom-enough", "mnd-income"], why: s => `Your income went up ${Math.round(s.incomeChange ?? 0)}%. This is the moment that decides whether a raise buys freedom or just stuff.` },
  { when: s => s.streak === 0, lessons: ["ah-one-percent", "iwt-automate"], why: () => "No investing streak right now. Tiny automatic habits restart it." },
  { when: s => s.investRate < 20, lessons: ["iwt-automate", "babylon-work", "spw-index"], why: s => `You invest ${Math.round(s.investRate)}% of your income. These ideas help push it toward 20%.` },
  { when: s => s.fireProgress >= 75, lessons: ["dwz-experiences", "pom-time", "spw-fu"], why: () => "You’re close to freedom. Time to think about how to use it well." },
];

export type LessonPick = { lesson: Lesson; reason: string | null };

/** Today's lesson: the first rule that applies and has a lesson not yet completed; otherwise the usual daily rotation. */
export function pickLesson(signals: CoachSignals, completed: string[], date = new Date()): LessonPick {
  for (const rule of RULES) {
    if (!rule.when(signals)) continue;
    const id = rule.lessons.find(l => !completed.includes(l) && lessons.some(x => x.id === l));
    if (id) return { lesson: lessons.find(x => x.id === id)!, reason: rule.why(signals) };
  }
  return { lesson: getLessonOfDay(date, completed), reason: null };
}

export type PrincipleFacts = {
  streak: number;
  savingsRates: number[]; // per logged month, most recent first (%)
  emergencyMonths: number;
  highInterestDebt: number;
  hasInvestments: boolean;
  protectedCover: boolean;
  leaksPlugged: number; // Save more pledge items
  definedEnough: boolean; // planned retirement spending or a dream age set
};

export type PrincipleInAction = { id: string; title: string; book: string; how: string; earned: boolean; progress: number; progressLabel: string };

const inARow = (rates: number[], min: number) => { let n = 0; for (const r of rates) { if (r >= min) n += 1; else break; } return n; };

export function principlesInAction(f: PrincipleFacts): PrincipleInAction[] {
  const keep = inARow(f.savingsRates, 10), needLess = inARow(f.savingsRates, 50);
  const p = (value: number, goal: number) => Math.max(0, Math.min(1, value / goal));
  return [
    { id: "pay-first", title: "Pay yourself first", book: "Rich Dad Poor Dad", how: "Invest every month for 6 months in a row", earned: f.streak >= 6, progress: p(f.streak, 6), progressLabel: `${Math.min(f.streak, 6)} of 6 months` },
    { id: "tenth", title: "Keep a part of all you earn", book: "The Richest Man in Babylon", how: "Keep 10%+ of your income for 3 months in a row", earned: keep >= 3, progress: p(keep, 3), progressLabel: `${Math.min(keep, 3)} of 3 months` },
    { id: "room", title: "Leave room for error", book: "The Psychology of Money", how: "Build a 6-month safety buffer", earned: f.emergencyMonths >= 6, progress: p(f.emergencyMonths, 6), progressLabel: `${Math.min(f.emergencyMonths, 6).toFixed(1)} of 6 months` },
    { id: "assets", title: "Assets feed you, liabilities eat you", book: "Rich Dad Poor Dad", how: "No expensive debt, and money invested", earned: f.highInterestDebt <= 0 && f.hasInvestments, progress: (f.highInterestDebt <= 0 ? 0.5 : 0) + (f.hasInvestments ? 0.5 : 0), progressLabel: f.highInterestDebt > 0 ? "Clear expensive debt" : f.hasInvestments ? "Done" : "Add your investments" },
    { id: "insure", title: "Insure first, invest next", book: "Let’s Talk Money", how: "Record health cover (and term cover if family depends on you)", earned: f.protectedCover, progress: f.protectedCover ? 1 : 0, progressLabel: f.protectedCover ? "Done" : "Add your cover in Profile" },
    { id: "time", title: "Time in the market beats timing it", book: "A Random Walk Down Wall Street", how: "Keep investing 12 months in a row, whatever markets do", earned: f.streak >= 12, progress: p(f.streak, 12), progressLabel: `${Math.min(f.streak, 12)} of 12 months` },
    { id: "conscious", title: "Spend on what you love, cut the rest", book: "I Will Teach You to Be Rich", how: "Plug 2 spending leaks in Save more", earned: f.leaksPlugged >= 2, progress: p(f.leaksPlugged, 2), progressLabel: `${Math.min(f.leaksPlugged, 2)} of 2 leaks` },
    { id: "enough", title: "Know what “enough” is", book: "The Psychology of Money", how: "Set your dream age or your spending after you stop working", earned: f.definedEnough, progress: f.definedEnough ? 1 : 0, progressLabel: f.definedEnough ? "Done" : "Set it in your FIRE plan" },
    { id: "need-less", title: "Need less, and freedom comes sooner", book: "Early Retirement Extreme", how: "Keep 50%+ of your income for 3 months in a row", earned: needLess >= 3, progress: p(needLess, 3), progressLabel: `${Math.min(needLess, 3)} of 3 months` },
  ];
}
