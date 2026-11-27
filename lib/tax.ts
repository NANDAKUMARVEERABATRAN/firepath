/**
 * India income tax, old vs new regime, for salaried residents below 60. FY 2026-27 (AY 2027-28).
 * Budget 2026 kept the FY 2025-26 slabs. Educational estimate only: it ignores special-rate income
 * other than equity LTCG, agricultural income and senior-citizen slabs.
 * The Income-tax Act 2025 renumbers sections; we use the popular names (80C, 80D, …).
 */

export type TaxInputs = {
  salary: number;            // gross annual salary (CTC minus employer PF/NPS), ₹/year
  basic: number;             // basic + DA, ₹/year (for HRA and employer NPS limits)
  hraReceived: number;       // ₹/year
  rentPaid: number;          // ₹/year
  metro: boolean;            // Delhi, Mumbai, Kolkata, Chennai
  otherIncome: number;       // FD interest, rent received after 30%, etc., ₹/year
  savingsInterest: number;   // savings-account interest, ₹/year (also counted as income)
  sec80C: number;            // EPF (employee), PPF, ELSS, life insurance, tuition, home-loan principal
  sec80DSelf: number;        // health insurance for self/family
  sec80DParents: number;     // health insurance for parents
  parentsSenior: boolean;
  nps80CCD1B: number;        // own extra NPS contribution
  employerNps: number;       // employer NPS contribution, 80CCD(2)
  homeLoanInterest: number;  // self-occupied house, 24(b)
  educationLoanInterest: number; // 80E
  professionalTax: number;
};

export const EMPTY_TAX_INPUTS: TaxInputs = {
  salary: 0, basic: 0, hraReceived: 0, rentPaid: 0, metro: true, otherIncome: 0, savingsInterest: 0,
  sec80C: 0, sec80DSelf: 0, sec80DParents: 0, parentsSenior: false, nps80CCD1B: 0, employerNps: 0,
  homeLoanInterest: 0, educationLoanInterest: 0, professionalTax: 0,
};

export const LIMITS = {
  sec80C: 150000, sec80DSelf: 25000, sec80DParents: 25000, sec80DParentsSenior: 50000, nps80CCD1B: 50000,
  homeLoanInterest: 200000, savingsInterest: 10000, professionalTax: 2500,
  stdNew: 75000, stdOld: 50000, employerNpsNew: 0.14, employerNpsOld: 0.10,
  ltcgExempt: 125000, ltcgRate: 0.125, cess: 0.04,
} as const;

type Slab = [upTo: number, rate: number];
const NEW_SLABS: Slab[] = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
const OLD_SLABS: Slab[] = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];

function slabTax(income: number, slabs: Slab[]) {
  let tax = 0, from = 0;
  for (const [upTo, rate] of slabs) {
    if (income <= from) break;
    tax += (Math.min(income, upTo) - from) * rate;
    from = upTo;
  }
  return tax;
}

const SURCHARGE: [over: number, rate: number][] = [[50000000, 0.37], [20000000, 0.25], [10000000, 0.15], [5000000, 0.10]];

/** Slab tax + rebate (with marginal relief) + surcharge (with marginal relief), before cess. */
function taxBeforeCess(taxable: number, regime: "new" | "old") {
  const slabs = regime === "new" ? NEW_SLABS : OLD_SLABS;
  let tax = slabTax(taxable, slabs);
  // Section 87A rebate
  if (regime === "new" && taxable <= 1200000) tax = 0;
  else if (regime === "new") tax = Math.min(tax, taxable - 1200000); // marginal relief just above ₹12 lakh
  else if (taxable <= 500000) tax = Math.max(0, tax - 12500);
  // Surcharge (new regime capped at 25%)
  for (const [over, rawRate] of SURCHARGE) {
    if (taxable > over) {
      const rate = regime === "new" ? Math.min(rawRate, 0.25) : rawRate;
      const withSurcharge = tax * (1 + rate);
      const atThreshold = taxBeforeCess(over, regime);
      tax = Math.min(withSurcharge, atThreshold + (taxable - over));
      break;
    }
  }
  return tax;
}

export function hraExemption(i: TaxInputs) {
  if (i.hraReceived <= 0 || i.rentPaid <= 0) return 0;
  return Math.max(0, Math.min(i.hraReceived, i.rentPaid - 0.1 * i.basic, (i.metro ? 0.5 : 0.4) * i.basic));
}

export type Deduction = { key: keyof TaxInputs | "hra" | "std"; label: string; used: number; limit: number | null };

export function oldDeductions(i: TaxInputs): Deduction[] {
  const parentsLimit = i.parentsSenior ? LIMITS.sec80DParentsSenior : LIMITS.sec80DParents;
  return [
    { key: "std", label: "Standard deduction", used: LIMITS.stdOld, limit: LIMITS.stdOld },
    { key: "hra", label: "HRA exemption", used: hraExemption(i), limit: null },
    { key: "professionalTax", label: "Professional tax", used: Math.min(i.professionalTax, LIMITS.professionalTax), limit: LIMITS.professionalTax },
    { key: "sec80C", label: "80C (EPF, PPF, ELSS, insurance, home-loan principal)", used: Math.min(i.sec80C, LIMITS.sec80C), limit: LIMITS.sec80C },
    { key: "sec80DSelf", label: "80D health insurance (self & family)", used: Math.min(i.sec80DSelf, LIMITS.sec80DSelf), limit: LIMITS.sec80DSelf },
    { key: "sec80DParents", label: "80D health insurance (parents)", used: Math.min(i.sec80DParents, parentsLimit), limit: parentsLimit },
    { key: "nps80CCD1B", label: "80CCD(1B) your own NPS", used: Math.min(i.nps80CCD1B, LIMITS.nps80CCD1B), limit: LIMITS.nps80CCD1B },
    { key: "employerNps", label: "80CCD(2) employer NPS (10% of basic)", used: Math.min(i.employerNps, LIMITS.employerNpsOld * i.basic), limit: null },
    { key: "homeLoanInterest", label: "24(b) home-loan interest", used: Math.min(i.homeLoanInterest, LIMITS.homeLoanInterest), limit: LIMITS.homeLoanInterest },
    { key: "educationLoanInterest", label: "80E education-loan interest", used: i.educationLoanInterest, limit: null },
    { key: "savingsInterest", label: "80TTA savings interest", used: Math.min(i.savingsInterest, LIMITS.savingsInterest), limit: LIMITS.savingsInterest },
  ];
}

export function newDeductions(i: TaxInputs): Deduction[] {
  return [
    { key: "std", label: "Standard deduction", used: LIMITS.stdNew, limit: LIMITS.stdNew },
    { key: "employerNps", label: "80CCD(2) employer NPS (14% of basic)", used: Math.min(i.employerNps, LIMITS.employerNpsNew * i.basic), limit: null },
  ];
}

export type RegimeResult = { gross: number; deductions: number; taxable: number; tax: number; cess: number; total: number; marginalRate: number };

function regimeResult(i: TaxInputs, regime: "new" | "old", extraDeduction = 0): RegimeResult {
  const gross = Math.max(0, i.salary) + Math.max(0, i.otherIncome) + Math.max(0, i.savingsInterest) + Math.max(0, i.employerNps);
  const list = regime === "new" ? newDeductions(i) : oldDeductions(i);
  const deductions = Math.min(gross, list.reduce((s, d) => s + d.used, 0) + extraDeduction);
  const taxable = Math.max(0, gross - deductions);
  const tax = taxBeforeCess(taxable, regime);
  const cess = tax * LIMITS.cess;
  const total = Math.round(tax + cess);
  const next = Math.round(taxBeforeCess(taxable + 1000, regime) * (1 + LIMITS.cess));
  return { gross, deductions, taxable, tax: Math.round(tax), cess: Math.round(cess), total, marginalRate: Math.max(0, (next - total) / 1000) };
}

export const newRegimeTax = (i: TaxInputs) => regimeResult(i, "new");
export const oldRegimeTax = (i: TaxInputs) => regimeResult(i, "old");

export type Opportunity = { key: keyof TaxInputs; label: string; room: number; saves: number; how: string };

const HOW: Partial<Record<keyof TaxInputs, string>> = {
  sec80C: "ELSS, PPF, extra EPF (VPF) or home-loan principal. Your employee EPF already counts.",
  nps80CCD1B: "Put up to ₹50,000 a year into your own NPS Tier 1 account. Locked till 60, so check it fits your FIRE plan.",
  sec80DSelf: "A family health-insurance policy. You need one anyway before FIRE.",
  sec80DParents: "Health insurance for your parents.",
};

/** Old-regime deductions with room left, and what filling each would save in old-regime tax. */
export function oldRegimeOpportunities(i: TaxInputs): Opportunity[] {
  const base = oldRegimeTax(i).total;
  const parentsLimit = i.parentsSenior ? LIMITS.sec80DParentsSenior : LIMITS.sec80DParents;
  const rows: [keyof TaxInputs, string, number][] = [
    ["sec80C", "80C", LIMITS.sec80C - Math.min(i.sec80C, LIMITS.sec80C)],
    ["nps80CCD1B", "80CCD(1B) NPS", LIMITS.nps80CCD1B - Math.min(i.nps80CCD1B, LIMITS.nps80CCD1B)],
    ["sec80DSelf", "80D health insurance (self & family)", LIMITS.sec80DSelf - Math.min(i.sec80DSelf, LIMITS.sec80DSelf)],
    ["sec80DParents", "80D health insurance (parents)", parentsLimit - Math.min(i.sec80DParents, parentsLimit)],
  ];
  return rows.filter(([, , room]) => room > 0).map(([key, label, room]) => ({
    key, label, room, saves: Math.max(0, base - oldRegimeTax({ ...i, [key]: (i[key] as number) + room }).total), how: HOW[key] ?? "",
  })).filter(o => o.saves > 0);
}

/**
 * Extra old-regime deductions (beyond what you claim now) at which the old regime starts to win.
 * 0 = old regime already wins or ties; null = old can't win even with ₹10 lakh more deductions.
 */
export function breakEvenExtraDeductions(i: TaxInputs): number | null {
  const target = newRegimeTax(i).total;
  if (regimeResult(i, "old").total <= target) return 0;
  let lo = 0, hi = 1000000;
  if (regimeResult(i, "old", hi).total > target) return null;
  while (hi - lo > 500) { const mid = (lo + hi) / 2; if (regimeResult(i, "old", mid).total <= target) hi = mid; else lo = mid; }
  return Math.ceil(hi / 1000) * 1000;
}

export type Comparison = { newer: RegimeResult; older: RegimeResult; better: "new" | "old" | "same"; saving: number };
export function compareRegimes(i: TaxInputs): Comparison {
  const newer = newRegimeTax(i), older = oldRegimeTax(i);
  const better = newer.total === older.total ? "same" : newer.total < older.total ? "new" : "old";
  return { newer, older, better, saving: Math.abs(newer.total - older.total) };
}

/**
 * Equity LTCG harvesting: long-term gains up to ₹1.25 lakh a year are tax-free. Selling and re-buying
 * equity funds/shares held over 12 months books that gain tax-free and resets your cost higher.
 */
export function ltcgHarvest(unrealisedLongTermGain: number, alreadyBookedThisYear: number) {
  const room = Math.max(0, LIMITS.ltcgExempt - Math.max(0, alreadyBookedThisYear));
  const harvest = Math.min(room, Math.max(0, unrealisedLongTermGain));
  const taxSavedLater = Math.round(harvest * LIMITS.ltcgRate * (1 + LIMITS.cess));
  const taxDueNow = Math.round(Math.max(0, alreadyBookedThisYear - LIMITS.ltcgExempt) * LIMITS.ltcgRate * (1 + LIMITS.cess));
  return { room, harvest, taxSavedLater, taxDueNow };
}

/** Financial year label for a date, e.g. "FY 2026-27". */
export function financialYear(d = new Date()) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
