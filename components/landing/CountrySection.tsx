"use client";

import { Globe2 } from "lucide-react";
import { useCountry } from "@/lib/useCountry";
import { ENABLED_COUNTRIES } from "@/lib/country";

const CARDS = {
  IN: { flag: "🇮🇳", name: "India", text: "Salary, SIPs, EPF, PPF and NPS, home and gold loans, insurance — with lakh and crore made easy.", currency: "₹ INR" },
  AE: { flag: "🇦🇪", name: "UAE", text: "For residents and expats: end-of-service gratuity, workplace savings (DEWS), savings back home, school fees and your “move back” plan.", currency: "AED" },
} as const;

export default function CountrySection() {
  const { country, setCountry } = useCountry();
  const many = ENABLED_COUNTRIES.length > 1;
  return (
    <section className="country-section section-pad" id="india">
      <div className="container country-grid">
        <div className="section-heading">
          <p className="eyebrow"><Globe2 size={14}/> BUILT FOR YOUR JOURNEY</p>
          <h2>{many ? "Built for India. Ready for the UAE." : "Built for India."}</h2>
          <p>{many ? "Plan in your own currency, with the investments, retirement products and life goals that matter where you live." : "Plan in rupees, with the investments, retirement products and life goals Indian families actually have. More countries coming soon."}</p>
          <a href="#fire-calculator" className="text-link">Try the calculator <span>→</span></a>
        </div>
        <div className="country-cards">
          {ENABLED_COUNTRIES.map(code => <button key={code} type="button" className={`country-card${country.code === code ? " active" : ""}`} onClick={() => setCountry(code)}>
            <div className="country-flag">{CARDS[code].flag}</div><div><h3>{CARDS[code].name}</h3><p>{CARDS[code].text}</p><span className="country-currency">{CARDS[code].currency}</span></div>
          </button>)}
          <p className="country-note">FIRE estimates are illustrative. Tax, pension and investment rules are not modeled; check local rules for your situation.</p>
        </div>
      </div>
    </section>
  );
}
