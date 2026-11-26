"use client";

import { useEffect, useState } from "react";
import { COUNTRY_EVENT, detectCountry, getCountry, isCountryEnabled, readStoredCountry, storeCountry, type CountryCode } from "./country";

/**
 * Current country for this visitor: their saved choice, else a guess from time zone/language.
 * Signed-in users' profile currency overrides it (see syncCountryFromCurrency).
 */
export function useCountry() {
  const [code, setCode] = useState<CountryCode>("IN");
  useEffect(() => {
    // A link like ?country=ae (e.g. from a UAE ad campaign) chooses the country explicitly.
    const fromLink = new URLSearchParams(window.location.search).get("country")?.toUpperCase();
    if ((fromLink === "AE" || fromLink === "IN") && isCountryEnabled(fromLink)) storeCountry(fromLink);
    setCode(readStoredCountry() ?? detectCountry());
    const onChange = (event: Event) => setCode((event as CustomEvent<CountryCode>).detail);
    window.addEventListener(COUNTRY_EVENT, onChange);
    return () => window.removeEventListener(COUNTRY_EVENT, onChange);
  }, []);
  return { code, country: getCountry(code), setCountry: (next: CountryCode) => { storeCountry(next); setCode(next); } };
}

/** Keep the header/calculator country in step with the signed-in user's saved profile currency. */
export function syncCountryFromCurrency(currency?: string | null) {
  if (!currency) return;
  const code: CountryCode = currency === "AED" ? "AE" : "IN";
  if (readStoredCountry() !== code) storeCountry(code);
}
