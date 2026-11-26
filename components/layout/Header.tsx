"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, Flame, Menu, Plus, Target, TrendingUp, Wallet, X } from "lucide-react";
import AuthButton from "@/components/auth/AuthButton";
import { PRICING } from "@/lib/subscription";
import { COUNTRIES, ENABLED_COUNTRIES } from "@/lib/country";
import { useCountry } from "@/lib/useCountry";

const primary = [
  { href: "/journey", label: "Home", icon: Flame },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/accounts", label: "Portfolio", icon: Wallet },
  { href: "/plan", label: "FIRE plan", icon: TrendingUp },
];
const more = [
  { href: "/save-more", label: "✂️ Save more", hint: "Raise your savings rate, hunt spending leaks" },
  { href: "/report", label: "📬 Monthly report", hint: "Your month in money, and what to focus on next" },
  { href: "/check-in", label: "Monthly check-in", hint: "Log income, spending, investing" },
  { href: "/dashboard", label: "FIRE score", hint: "Your 100-point breakdown & badges" },
  { href: "/budget", label: "Budget", hint: "Targets and spending" },
  { href: "/learn", label: "Money principles", hint: "Ideas from the best books" },
  { href: "/profile", label: "Profile", hint: "Your why, income, savings, insurance" },
  { href: "/feedback", label: "💡 Ideas & rewards", hint: "Suggest changes, earn points off your bill" },
  { href: "/account", label: "Subscription", hint: "Your plan, renewal and billing" },
  { href: "/pricing", label: "👑 Pro plan", hint: `${PRICING.trialDays} days free · then a small monthly or yearly fee` },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const { country, setCountry } = useCountry();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const isLanding = pathname === "/";
  const moreActive = more.some(item => item.href === pathname);

  return (
    <>
      <header className="site-header">
        <div className="container nav-wrap">
          <a href={isLanding ? "/" : "/journey"} className="brand" aria-label="FIREpath home">
            <span className="brand-mark"><TrendingUp size={19} strokeWidth={2.5} /></span>
            <span>FIRE<span className="brand-accent">path</span></span>
          </a>
          <nav className={open ? "nav-links nav-open" : "nav-links"} aria-label="Main">
            {primary.map(item => <a key={item.href} href={item.href} className={pathname === item.href ? "active" : undefined} onClick={() => setOpen(false)}>{item.label}</a>)}
            <div className={`nav-more${moreOpen ? " open" : ""}`} ref={moreRef}>
              <button type="button" className={moreActive ? "active" : undefined} aria-expanded={moreOpen} onClick={() => setMoreOpen(value => !value)}>More <ChevronDown size={14} /></button>
              <div className="nav-more-menu" role="menu">
                {more.map(item => <a key={item.href} href={item.href} role="menuitem" className={pathname === item.href ? "active" : undefined} onClick={() => { setOpen(false); setMoreOpen(false); }}><strong>{item.label}</strong><small>{item.hint}</small></a>)}
              </div>
            </div>
          </nav>
          <div className="nav-actions">
            {ENABLED_COUNTRIES.length > 1 && <div className="country-switch" role="group" aria-label="Country">
              {ENABLED_COUNTRIES.map(code => <button key={code} type="button" aria-pressed={country.code === code} className={country.code === code ? "on" : ""} onClick={() => setCountry(code)} title={`${COUNTRIES[code].name} · ${COUNTRIES[code].currency}`}><b>{COUNTRIES[code].code === "IN" ? "₹" : "AED"}</b><span>{COUNTRIES[code].name}</span></button>)}
            </div>}
            <a href="/check-in" className="nav-log"><Plus size={15} /> Log month</a>
            <AuthButton />
          </div>
          <button className="menu-toggle" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {!isLanding && (
        <nav className="tab-bar" aria-label="App">
          <a href="/journey" className={pathname === "/journey" ? "active" : undefined}><Flame size={20} /><span>Home</span></a>
          <a href="/goals" className={pathname === "/goals" ? "active" : undefined}><Target size={20} /><span>Goals</span></a>
          <a href="/check-in" className="tab-log" aria-label="Log this month"><span className="tab-log-btn"><Plus size={24} /></span><span>Log</span></a>
          <a href="/accounts" className={pathname === "/accounts" ? "active" : undefined}><Wallet size={20} /><span>Portfolio</span></a>
          <a href="/learn" className={pathname === "/learn" ? "active" : undefined}><BookOpen size={20} /><span>Learn</span></a>
        </nav>
      )}
    </>
  );
}
