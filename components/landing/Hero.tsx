"use client";

import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { useCountry } from "@/lib/useCountry";

export default function Hero() {
  const { country } = useCountry();
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="announcement"><Sparkles size={14} /> A clearer way to plan your financial future</div>
          <h1>Know Your Wealth.<br /><span>Plan Your Freedom.</span></h1>
          <p className="hero-subtitle">
            Understand your money today. Discover your financial independence number.
            Build a roadmap towards the life you want.
          </p>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="#fire-calculator">Calculate my FIRE number <ArrowRight size={17} /></a>
            <a className="text-link" href="#features">Explore the platform</a>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 size={16} /> Free to get started</span>
            <span><ShieldCheck size={16} /> Your numbers stay yours</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Illustrative financial planning dashboard preview">
          <div className="visual-glow" />
          <div className="dashboard-card">
            <div className="dashboard-top">
              <div><span className="tiny-label">YOUR FINANCIAL SNAPSHOT</span><h3>Freedom overview</h3></div>
              <span className="live-dot">● Planning preview</span>
            </div>
            <div className="metric-card">
              <span className="tiny-label">ILLUSTRATIVE TARGET CORPUS</span>
              <strong>{country.code === "IN" ? "₹3.8 crore" : "AED 5.1 million"}</strong>
              <span className="metric-note">Example only · Your result depends on your inputs</span>
            </div>
            <div className="chart-area">
              <div className="chart-labels"><span>Wealth projection</span><span>Illustrative</span></div>
              <svg viewBox="0 0 520 180" role="img" aria-label="Illustrative rising wealth projection line">
                <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#159B72" stopOpacity=".22"/><stop offset="100%" stopColor="#159B72" stopOpacity="0"/></linearGradient></defs>
                {[35,75,115,155].map(y => <line key={y} x1="8" x2="512" y1={y} y2={y} stroke="#E9EEF3" strokeDasharray="4 5" />)}
                <path d="M8 148 C65 142 76 132 120 128 S190 115 225 104 S290 90 325 75 S390 65 420 45 S478 26 512 12 L512 170 L8 170Z" fill="url(#chartFill)" />
                <path d="M8 148 C65 142 76 132 120 128 S190 115 225 104 S290 90 325 75 S390 65 420 45 S478 26 512 12" fill="none" stroke="#159B72" strokeWidth="4" strokeLinecap="round" />
                <circle cx="420" cy="45" r="5" fill="#159B72" stroke="white" strokeWidth="3"/>
              </svg>
              <div className="chart-years"><span>Today</span><span>5 years</span><span>10 years</span><span>15 years</span></div>
            </div>
            <div className="dashboard-bottom">
              <div><span className="tiny-label">SAVINGS RATE</span><b>Track yours</b></div>
              <div><span className="tiny-label">FIRE READINESS</span><b>Build your plan</b></div>
              <div><span className="tiny-label">NEXT STEP</span><b>Set a goal →</b></div>
            </div>
          </div>
          <div className="floating-note"><span className="note-icon">↗</span><div><b>Your plan, your pace</b><small>Explore what-if scenarios</small></div></div>
        </div>
      </div>
      <div className="container hero-footnote"><span>FINANCIAL CLARITY FOR REAL LIFE</span><span>MADE FOR YOUR FINANCIAL JOURNEY IN {country.code === "IN" ? "INDIA" : "THE UAE"}</span></div>
    </section>
  );
}
