import Link from "next/link";
import { moneyPrinciples } from "@/lib/moneyPrinciples";
import type { ScoreCategory } from "@/lib/fireScore";

export default function PrincipleScoreImpact({ selected, categories }: { selected: string[]; categories: ScoreCategory[] }) {
  const principles = moneyPrinciples.filter(principle => selected.includes(principle.id));
  if (!principles.length) return null;
  return <section className="selected-principles-section principle-impact-section">
    <div className="section-heading"><p className="eyebrow">YOUR BOOK PRINCIPLES IN PRACTICE</p><h2>See what moves the score.</h2><p>Choosing a principle earns no points by itself. Your current score comes from the habits and figures below.</p></div>
    <div className="selected-principles-list">{principles.map(principle => {
      const related = categories.filter(category => principle.scoreAreas.some(area => area === category.name));
      const points = related.reduce((sum, category) => sum + category.score, 0);
      const maximum = related.reduce((sum, category) => sum + category.max, 0);
      const progress = maximum > 0 ? points / maximum * 100 : 0;
      return <article key={principle.id}><span>{principle.inspiration}</span><strong>{principle.title}</strong><small>Score areas: {principle.scoreAreas.join(" · ")}</small><b>{points.toFixed(0)} of {maximum} related points</b><div className="principle-impact-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><p>{principle.action}</p><Link className="text-link" href={principle.href}>{principle.link} →</Link></article>;
    })}</div>
    <p className="profile-privacy">Principle choices organize your goals; they do not inflate the score. The same category points are counted once in your total.</p>
  </section>;
}
