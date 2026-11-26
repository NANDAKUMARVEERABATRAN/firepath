/**
 * Country settings. India is the default; UAE adds AED, international number words,
 * UAE end-of-service/pension products and expat-specific goals. Everything country-specific lives here.
 */
export type CountryCode = "IN" | "AE";
export type Currency = "INR" | "AED" | "USD";

export type CountryConfig = {
  code: CountryCode;
  name: string;
  flag: string;
  currency: "INR" | "AED";
  symbol: string; // shown before amounts in inputs
  locale: string;
  wordsStyle: "indian" | "international"; // lakh/crore vs thousand/million
  defaults: { inflation: number; expectedReturn: number; withdrawal: number; retirementAge: number };
  calculator: { expenses: number; assets: number; monthlyInvestment: number; expensesMax: number; assetsMax: number; investmentMax: number; step: number };
  sliderSteps: number[]; // quick +/- buttons on the freedom-date slider
  boostStep: number; // "invest X more a month" lever
  laterAccessLabel: string; // name for retirement money you can't touch yet
  laterAccessExamples: string;
  pricing: { monthly: number; yearly: number };
};

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  IN: {
    code: "IN", name: "India", flag: "🇮🇳", currency: "INR", symbol: "₹", locale: "en-IN", wordsStyle: "indian",
    defaults: { inflation: 6, expectedReturn: 10, withdrawal: 3.5, retirementAge: 60 },
    calculator: { expenses: 60000, assets: 2500000, monthlyInvestment: 25000, expensesMax: 1000000, assetsMax: 100000000, investmentMax: 1000000, step: 1000 },
    sliderSteps: [-5000, 5000, 10000, 25000], boostStep: 5000,
    laterAccessLabel: "EPF, PPF or NPS", laterAccessExamples: "Check your EPFO passbook or NPS app.",
    pricing: { monthly: 75, yearly: 500 },
  },
  AE: {
    code: "AE", name: "UAE", flag: "🇦🇪", currency: "AED", symbol: "AED", locale: "en-AE", wordsStyle: "international",
    defaults: { inflation: 3, expectedReturn: 7, withdrawal: 3.5, retirementAge: 60 },
    calculator: { expenses: 12000, assets: 300000, monthlyInvestment: 8000, expensesMax: 200000, assetsMax: 20000000, investmentMax: 200000, step: 500 },
    sliderSteps: [-1000, 1000, 2000, 5000], boostStep: 1000,
    laterAccessLabel: "end-of-service gratuity, workplace savings (DEWS) or pension", laterAccessExamples: "Your employer or HR portal shows your gratuity and workplace-savings balance.",
    pricing: { monthly: 15, yearly: 119 }, // placeholder AED pricing — confirm before launch
  },
};

/**
 * Countries open to new users. UAE support is built but switched off until its regulatory, VAT and payment
 * questions are settled; add "AE" here to turn it back on. Existing AED profiles keep working.
 */
export const ENABLED_COUNTRIES: CountryCode[] = ["IN"];
export const isCountryEnabled = (code: CountryCode) => ENABLED_COUNTRIES.includes(code);
const firstEnabled = (): CountryCode => ENABLED_COUNTRIES[0] ?? "IN";

export const countryFromCurrency = (currency?: string | null): CountryCode => (currency === "AED" ? "AE" : "IN");
export const getCountry = (code?: CountryCode | null) => COUNTRIES[code ?? "IN"] ?? COUNTRIES.IN;

/** Best guess from the browser — time zone first, then language. Never sent anywhere. */
export function detectCountry(): CountryCode {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (zone === "Asia/Dubai" && isCountryEnabled("AE")) return "AE";
    if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return "IN";
    const languages = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
    if (languages.some(lang => /-AE$/i.test(lang)) && isCountryEnabled("AE")) return "AE";
  } catch { /* fall through */ }
  return firstEnabled();
}

export const COUNTRY_KEY = "ff-country";
export const COUNTRY_EVENT = "ff-country-change";

export function readStoredCountry(): CountryCode | null {
  try { const value = window.localStorage.getItem(COUNTRY_KEY); return (value === "AE" || value === "IN") && isCountryEnabled(value) ? value : null; } catch { return null; }
}

export function storeCountry(code: CountryCode) {
  try { window.localStorage.setItem(COUNTRY_KEY, code); } catch { /* storage unavailable */ }
  try { window.dispatchEvent(new CustomEvent(COUNTRY_EVENT, { detail: code })); } catch { /* not in a browser */ }
}

const symbolOf = (c: CountryConfig) => (c.code === "IN" ? "₹" : "AED ");
const bigUnit = (c: CountryConfig, v: number): [string, number] | null => c.wordsStyle === "indian" ? (v >= 1e7 ? ["crore", 1e7] : null) : v >= 1e9 ? ["billion", 1e9] : v >= 1e6 ? ["million", 1e6] : null;
const trimmed = (n: number, locale: string) => (Math.round(n * 100) / 100).toLocaleString(locale, { maximumFractionDigits: 2 });

/**
 * Money for a country, written the same way everywhere: "₹45,000", "₹28,58,438", "₹2.86 crore"
 * (UAE: "AED 45,000", "AED 1.25 million"). Big units are always spelled out, never "Cr" or "L".
 */
export function formatCountryMoney(value: number, code: CountryCode = "IN"): string {
  const c = getCountry(code);
  const unit = bigUnit(c, Math.abs(value));
  if (unit) return `${value < 0 ? "−" : ""}${symbolOf(c)}${trimmed(Math.abs(value) / unit[1], c.locale)} ${unit[0]}`;
  return new Intl.NumberFormat(c.locale, { style: "currency", currency: c.currency, maximumFractionDigits: 0 }).format(value);
}

/** Shorter money for chart axes and tight spaces: "₹45,000", "₹1.5 lakh", "₹2.3 crore" (same words as everywhere else). */
export function shortCountryMoney(value: number, code: CountryCode = "IN"): string {
  const c = getCountry(code);
  const v = Math.abs(value), sign = value < 0 ? "−" : "";
  if (c.wordsStyle === "indian" && v >= 1e5 && v < 1e7) return `${sign}${symbolOf(c)}${trimmed(v / 1e5, c.locale)} lakh`;
  return formatCountryMoney(value, code);
}

/** Amount in words: India "1.2 lakh" / "2.5 crore"; UAE "120 thousand" / "2.5 million". */
export function countryAmountInWords(value: number, code: CountryCode = "IN"): string {
  if (!value) return "";
  const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString(getCountry(code).locale);
  if (getCountry(code).wordsStyle === "indian") {
    if (value >= 1e7) return `${fmt(value / 1e7)} crore`;
    if (value >= 1e5) return `${fmt(value / 1e5)} lakh`;
  } else {
    if (value >= 1e9) return `${fmt(value / 1e9)} billion`;
    if (value >= 1e6) return `${fmt(value / 1e6)} million`;
  }
  if (value >= 1e3) return `${fmt(value / 1e3)} thousand`;
  return fmt(value);
}

/** Price text for the country: "₹99" / "AED 15". */
export const priceText = (amount: number, code: CountryCode = "IN") => (getCountry(code).currency === "INR" ? `₹${amount}` : `AED ${amount}`);

/** Short chip label for a round amount: "₹10 lakh" / "AED 100k". */
export function chipAmount(value: number, code: CountryCode = "IN"): string {
  const c = getCountry(code);
  if (c.wordsStyle === "indian") return `₹${countryAmountInWords(value, code)}`;
  return value >= 1e6 ? `AED ${value / 1e6}M` : `AED ${value / 1e3}k`;
}

/** How much cheaper the yearly plan is than paying monthly for 12 months, in whole percent. */
export function yearlySavingPercent(code: CountryCode = "IN"): number {
  const { monthly, yearly } = getCountry(code).pricing;
  return monthly > 0 ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0;
}
