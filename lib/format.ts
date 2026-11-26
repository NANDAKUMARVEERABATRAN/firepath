import { countryAmountInWords, formatCountryMoney, type CountryCode } from "./country.ts";

/** Amount in words for the country: India "1.2 lakh", UAE "120 thousand". Defaults to India. */
export function amountInWords(value: number, code: CountryCode = "IN"): string {
  return countryAmountInWords(value, code);
}

/** Money for the country: "₹1,20,000" or "AED 15,000". Defaults to India. */
export const rupees = (value: number, code: CountryCode = "IN") => formatCountryMoney(value, code);
