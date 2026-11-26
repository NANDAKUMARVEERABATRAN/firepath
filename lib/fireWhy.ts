/**
 * "Why do you want financial independence?" — purpose drives persistence (a core idea in
 * Your Money or Your Life and The Psychology of Money). Reasons map to a FIRE style and a purpose score.
 */
export type StyleId = "runway" | "barista" | "lean" | "fat" | "classic";

export const fireReasons = [
  { id: "hobby", emoji: "🎨", label: "Follow my passion or hobby", weight: 15, styles: { barista: 3, classic: 1 } },
  { id: "business", emoji: "🚀", label: "Start my own business", weight: 15, styles: { runway: 4, barista: 1 } },
  { id: "family", emoji: "👨‍👩‍👧", label: "Spend more time with family", weight: 15, styles: { classic: 2, lean: 1 } },
  { id: "children", emoji: "🎓", label: "Give my children the best future", weight: 12, styles: { fat: 2, classic: 1 } },
  { id: "parents", emoji: "🤝", label: "Take care of my parents", weight: 12, styles: { classic: 2, fat: 1 } },
  { id: "travel", emoji: "✈️", label: "Travel the world", weight: 10, styles: { fat: 2, lean: 1 } },
  { id: "stress", emoji: "😮‍💨", label: "Escape a stressful job", weight: 8, styles: { runway: 2, lean: 2 } },
  { id: "early", emoji: "🌴", label: "Retire early and relax", weight: 8, styles: { lean: 2, classic: 2 } },
  { id: "security", emoji: "🛡️", label: "Never worry about money again", weight: 10, styles: { classic: 3 } },
  { id: "give", emoji: "💝", label: "Give back / social work", weight: 12, styles: { barista: 2, classic: 1 } },
  { id: "learn", emoji: "📖", label: "Study or learn something new", weight: 10, styles: { runway: 1, barista: 2 } },
  { id: "health", emoji: "🧘", label: "Focus on my health", weight: 10, styles: { lean: 1, classic: 2 } },
  { id: "luxury", emoji: "💎", label: "Live a comfortable, premium life", weight: 6, styles: { fat: 4 } },
  { id: "other", emoji: "✍️", label: "Something else", weight: 10, styles: { classic: 1 } },
] as const;

export type ReasonId = (typeof fireReasons)[number]["id"];

export const fireStyles: Record<StyleId, { name: string; emoji: string; description: string; tip: string }> = {
  runway: { name: "Runway FIRE", emoji: "🛫", description: "You want the freedom to make a big move — like starting up or switching paths — before full retirement.", tip: "Build a 24-month “freedom runway” (2 years of expenses) first. That alone lets you take the leap safely." },
  barista: { name: "Barista FIRE", emoji: "☕", description: "You’ll keep earning from work you love. Even a small passion income means you need a much smaller corpus.", tip: "Every ₹10,000/month your passion earns cuts your FIRE number by about ₹34 lakh (at a 3.5% withdrawal rate)." },
  lean: { name: "Lean FIRE", emoji: "🍃", description: "Freedom sooner by keeping life simple. Low expenses are your superpower.", tip: "Every ₹5,000 you trim from monthly spending lowers your FIRE number by about ₹17 lakh." },
  fat: { name: "Fat FIRE", emoji: "👑", description: "You want freedom without compromise — for family, travel and comfort. It needs a bigger number and patience.", tip: "Plan for 30× yearly spending and grow your SIP with every raise. Step-up SIPs are your best friend." },
  classic: { name: "Classic FIRE", emoji: "🔥", description: "Steady, balanced freedom: work becomes optional and time becomes yours.", tip: "Stay consistent: invest 20–30% of income every month and let time do the heavy lifting." },
};

/** Country-specific wording for tips that quote amounts. */
const uaeTips: Partial<Record<StyleId, string>> = {
  barista: "Every AED 2,000/month your passion earns cuts your FIRE number by about AED 685,000 (at a 3.5% withdrawal rate).",
  lean: "Every AED 1,000 you trim from monthly spending lowers your FIRE number by about AED 343,000.",
  runway: "Build a 24-month “freedom runway” first — and remember your visa is tied to your job, so keep this runway liquid.",
};
export const styleTip = (style: StyleId, currency?: string | null) => (currency === "AED" ? uaeTips[style] ?? fireStyles[style].tip : fireStyles[style].tip);

export type WhyResult = { purposeScore: number; style: StyleId; label: string; reasons: (typeof fireReasons)[number][] };

export function getWhyResult(reasonIds: string[], note = "", dreamAge: number | null = null): WhyResult {
  const reasons = fireReasons.filter(reason => reasonIds.includes(reason.id));
  const totals: Record<StyleId, number> = { runway: 0, barista: 0, lean: 0, fat: 0, classic: 0.5 }; // classic wins ties
  for (const reason of reasons) for (const [style, points] of Object.entries(reason.styles)) totals[style as StyleId] += points;
  const style = (Object.keys(totals) as StyleId[]).reduce((best, id) => (totals[id] > totals[best] ? id : best), "classic");
  // Purpose score: meaningful reasons (capped at 60) + a personal "why" in your own words (25) + a dream age (15).
  const reasonPoints = Math.min(60, reasons.reduce((sum, reason) => sum + reason.weight, 0) + (reasons.length >= 2 ? 10 : 0));
  const purposeScore = Math.min(100, reasonPoints + (note.trim().length >= 10 ? 25 : 0) + (dreamAge ? 15 : 0));
  const label = purposeScore >= 80 ? "Crystal-clear why 💎" : purposeScore >= 55 ? "Strong why 💪" : purposeScore > 0 ? "Growing why 🌱" : "Not set yet";
  return { purposeScore, style, label, reasons };
}
