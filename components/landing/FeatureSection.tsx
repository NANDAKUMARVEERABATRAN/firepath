import { BookOpen, Gauge, Map, Target, Trophy, Wallet } from "lucide-react";

const features = [
  { icon: Map, title: "The Freedom Path", text: "Clear 11 levels — from your first money map to financial independence and Fat FIRE — with one clear next step at every stage." },
  { icon: Trophy, title: "XP, Ranks & Streaks", text: "Earn XP for check-ins, lessons and goals. Climb from Rookie Saver to Financially Free Legend." },
  { icon: Gauge, title: "FIRE Progress Score", text: "A 100-point score across savings, investing, emergency fund, protection, debt and FIRE progress." },
  { icon: BookOpen, title: "Daily Book Lessons", text: "One idea a day from The Psychology of Money, Rich Dad Poor Dad and more — with an Indian example and quiz." },
  { icon: Target, title: "Life Goals", text: "Home, education, wedding, travel: see the inflation-adjusted cost and the monthly SIP you need." },
  { icon: Wallet, title: "Portfolio Tracker", text: "Track mutual funds, stocks, FDs, PPF, EPF, NPS and gold — and see how many months of freedom you already own." },
];

export default function FeatureSection() {
  return (
    <section className="features-section section-pad" id="features">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">A CLEARER FINANCIAL PICTURE</p>
          <h2>Everything you need to <span>plan with confidence.</span></h2>
          <p>Simple tools to help you understand where you are and explore where you could go.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }, i) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon"><Icon size={21}/></div>
              <span className="feature-number">0{i + 1}</span>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
