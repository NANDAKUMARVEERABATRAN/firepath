"use client";

import { Globe2 } from "lucide-react";
import { useCountry } from "@/lib/useCountry";

export default function CountrySection() {
  const { country, setCountry } = useCountry();
  return (
    <section className="country-section section-pad" id="india">
      <div className="container country-grid">
        <div className="section-heading">
          <p className="eyebrow"><Globe2 size={14}/> BUILT FOR YOUR JOURNEY</p>
          <h2>Built for India. Ready for the UAE.</h2>
          <p>Plan in your own currency, with the investments, retirement products and life goals that matter where you live.</p>
          <a href="#fire-calculator" className="text-link">Try the calculator <span>→</span></a>
        </div>
        <div className="country-cards">
          <button type="button" className={`country-card${country.code === "IN" ? " active" : ""}`} onClick={() => setCountry("IN")}>
            <div className="country-flag">🇮🇳</div><div><h3>India</h3><p>Salary, SIPs, EPF, PPF and NPS, home loans and insurance — with lakh and crore made easy.</p><span className="country-currency">₹ Indian Rupee · INR</span></div>
          </button>
          <button type="button" className={`country-card${country.code === "AE" ? " active" : ""}`} onClick={() => setCountry("AE")}>
            <div className="country-flag">🇦🇪</div><div><h3>UAE</h3><p>For residents and expats: end-of-service gratuity, workplace savings (DEWS), savings back home, school fees and your “move back home” fund.</p><span className="country-currency">AED · UAE Dirham</span></div>
          </button>
          <p className="country-note">FIRE estimates are illustrative. Tax, pension and investment rules are not modeled; check local rules for your situation.</p>
        </div>
      </div>
    </section>
  );
}
