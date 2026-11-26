import Header from "@/components/layout/Header";
import Hero from "@/components/landing/Hero";
import FireCalculator from "@/components/landing/FireCalculator";
import FeatureSection from "@/components/landing/FeatureSection";
import CountrySection from "@/components/landing/CountrySection";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <FireCalculator />
        <FeatureSection />
        <CountrySection />
        <section className="final-cta">
          <div className="container final-cta-inner">
            <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
            <h2>Start with clarity.<br /><span>Build towards freedom.</span></h2>
            <p>You don’t need to be a financial expert to understand your financial future.</p>
            <a className="button button-light" href="#fire-calculator">Build my free plan <span>→</span></a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
