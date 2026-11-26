"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Flame, Menu, PiggyBank, Plus, TrendingUp, UserRound, Wallet, X } from "lucide-react";
import AuthButton from "@/components/auth/AuthButton";
import { COUNTRIES, ENABLED_COUNTRIES } from "@/lib/country";
import { useCountry } from "@/lib/useCountry";

/**
 * App navigation in 4 hubs. The phone bottom bar shows the hubs; each hub's pages appear as tabs
 * under the header, so every page is at most two taps away.
 */
const HUBS = [
  { id: "home", label: "Home", icon: Flame, href: "/journey", pages: [
    { href: "/journey", label: "Overview" }, { href: "/dashboard", label: "FIRE score" }, { href: "/report", label: "Monthly report" }, { href: "/learn", label: "Learn" },
  ] },
  { id: "money", label: "Money", icon: PiggyBank, href: "/budget", pages: [
    { href: "/budget", label: "Budget" }, { href: "/trends", label: "Trends" }, { href: "/save-more", label: "Save more" }, { href: "/check-in", label: "Log month" },
  ] },
  { id: "wealth", label: "Wealth", icon: Wallet, href: "/accounts", pages: [
    { href: "/accounts", label: "Portfolio" }, { href: "/goals", label: "Goals" }, { href: "/plan", label: "FIRE plan" },
  ] },
  { id: "me", label: "Me", icon: UserRound, href: "/profile", pages: [
    { href: "/profile", label: "Profile" }, { href: "/feedback", label: "Ideas & rewards" }, { href: "/account", label: "Subscription" }, { href: "/pricing", label: "Pro plan" },
  ] },
];
const HUB_HINTS: Record<string, string> = { home: "Your progress, score and lessons", money: "Budget, spending and saving this month", wealth: "What you own, your goals and FIRE plan", me: "Profile, rewards and subscription" };

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { country, setCountry } = useCountry();
  const isLanding = pathname === "/";
  const hub = HUBS.find(h => h.pages.some(p => p.href === pathname)) ?? null;

  return (
    <>
      <header className="site-header">
        <div className="container nav-wrap">
          <a href={isLanding ? "/" : "/journey"} className="brand" aria-label="FIREpath home">
            <span className="brand-mark"><TrendingUp size={19} strokeWidth={2.5} /></span>
            <span>FIRE<span className="brand-accent">path</span></span>
          </a>
          <nav className={open ? "nav-links nav-open" : "nav-links"} aria-label="Main">
            {!open && HUBS.map(h => <a key={h.id} href={h.href} className={hub?.id === h.id ? "active" : undefined}>{h.label}</a>)}
            {open && <div className="nav-groups">{HUBS.map(h => <div key={h.id} className="nav-group">
              <strong>{h.label} <small>{HUB_HINTS[h.id]}</small></strong>
              <div>{h.pages.map(p => <a key={p.href} href={p.href} className={pathname === p.href ? "active" : undefined} onClick={() => setOpen(false)}>{p.label}</a>)}</div>
            </div>)}</div>}
          </nav>
          <div className="nav-actions">
            {ENABLED_COUNTRIES.length > 1 && <div className="country-switch" role="group" aria-label="Country">
              {ENABLED_COUNTRIES.map(code => <button key={code} type="button" aria-pressed={country.code === code} className={country.code === code ? "on" : ""} onClick={() => setCountry(code)} title={`${COUNTRIES[code].name} · ${COUNTRIES[code].currency}`}><b>{COUNTRIES[code].code === "IN" ? "₹" : "AED"}</b><span>{COUNTRIES[code].name}</span></button>)}
            </div>}
            <a href="/check-in" className="nav-log"><Plus size={15} /> Log month</a>
            <AuthButton />
          </div>
          <button className="menu-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {hub && <nav className="hub-tabs" aria-label={`${hub.label} pages`}><div className="container">
        {hub.pages.map(p => <a key={p.href} href={p.href} className={pathname === p.href ? "active" : undefined} aria-current={pathname === p.href ? "page" : undefined}>{p.label}</a>)}
      </div></nav>}
      {!isLanding && (
        <nav className="tab-bar" aria-label="App">
          {HUBS.slice(0, 2).map(h => <a key={h.id} href={h.href} className={hub?.id === h.id ? "active" : undefined}><h.icon size={20} /><span>{h.label}</span></a>)}
          <a href="/check-in" className="tab-log" aria-label="Log this month"><span className="tab-log-btn"><Plus size={24} /></span><span>Log</span></a>
          {HUBS.slice(2).map(h => <a key={h.id} href={h.href} className={hub?.id === h.id ? "active" : undefined}><h.icon size={20} /><span>{h.label}</span></a>)}
        </nav>
      )}
    </>
  );
}
