// Video specs. Every number is calculated here (never typed by hand) so the videos stay correct.
// Text: use *asterisks* to highlight words in yellow, \n for a new line.
import { yearsFromSavingsRate } from "../../lib/savingsCoach.ts";

/** SIP future value: monthly investment, % a year (compounded monthly, invested at month end), years. */
export const sip = (monthly, ratePercent, years) => { const r = ratePercent / 1200, n = years * 12; return monthly * ((Math.pow(1 + r, n) - 1) / r); };

/** ₹6.43 crore / ₹49.5 lakh / ₹5,000 */
export function inr(value) {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2).replace(/\.?0+$/, "")} crore`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1).replace(/\.0$/, "")} lakh`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

const DISCLAIMER = "Illustrative · 12% a year · not investment advice";
const rahul = sip(10000, 12, 35), amit = sip(10000, 12, 25);
const fiveK = sip(5000, 12, 20);
const rateRows = [10, 20, 30, 50, 70].map(rate => ({ rate, years: yearsFromSavingsRate(rate, 5, 4) }));

export const videos = [
  {
    id: "01-compounding-head-start",
    book: "The Psychology of Money",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: `Two friends.\nSame ₹10,000 SIP.\n*One ended up with\n${inr(rahul - amit)} more.*` },
      { type: "text", dur: 5.5, eyebrow: "THE ONLY DIFFERENCE", text: "Rahul started at *25*.\nAmit waited till *35*\nto “earn more first”." },
      { type: "compare", dur: 9, ad: true, title: "Their money at age 60", disclaimer: DISCLAIMER,
        items: [{ label: "Rahul", sub: "SIP from age 25", value: rahul }, { label: "Amit", sub: "SIP from age 35", value: amit }],
        note: `Rahul invested only *${inr(10000 * 120)}* more.` },
      { type: "text", dur: 5.5, text: "The secret isn’t\na better fund.\nIt’s *more years*." },
      { type: "cta", dur: 4.5, ad: true, headline: "Find your\nfreedom age", sub: "Free · takes 30 seconds" },
    ],
    caption: `Starting 10 years earlier was worth ${inr(rahul - amit)}. Your best investing day was yesterday; the next best is today. #compounding #SIP #FIRE #financialfreedom #personalfinanceindia #psychologyofmoney`,
  },
  {
    id: "02-pay-yourself-first",
    book: "Rich Dad Poor Dad",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "Why “I’ll invest\nwhat’s left”\n*never works.*" },
      { type: "text", dur: 5, text: "What’s left at\nmonth-end is usually…", big: "₹0" },
      { type: "list", dur: 7.5, ad: true, eyebrow: "FLIP IT", items: ["*1st* · Salary arrives", "*2nd* · Your SIP goes out", "*Rest* · Live your life"] },
      { type: "big", dur: 7, ad: true, pre: "Just ₹5,000 a month\nthis way becomes", value: fiveK, post: `in 20 years · you put in ${inr(5000 * 240)}`, disclaimer: DISCLAIMER },
      { type: "cta", dur: 4.5, ad: true, headline: "Plan your\nfreedom", sub: "Free FIRE calculator" },
    ],
    caption: "Investing first turns saving into a default, not a decision. Set your SIP date to salary day + 1. #payyourselffirst #richdadpoordad #SIP #moneyhabits #FIRE",
  },
  {
    id: "03-savings-rate",
    book: "Early Retirement Extreme",
    scenes: [
      { type: "hook", dur: 3.6, ad: true, text: "It’s not your salary\nthat decides when\nyou can retire.\n*It’s this number.*" },
      { type: "text", dur: 4.5, eyebrow: "YOUR SAVINGS RATE", text: "What you *keep*\n÷ what you earn" },
      { type: "bars", dur: 11, ad: true, title: "Years of work until you’re free",
        rows: rateRows.map(row => ({ label: `Save ${row.rate}%`, value: row.years, display: `${Math.round(row.years)} yrs`, highlight: row.rate === 50 })),
        disclaimer: "Starting from zero · 5% real return · 4% withdrawal · illustrative" },
      { type: "text", dur: 5, text: "Works on *any* income.\nIt’s not what you earn.\nIt’s what you *keep*." },
      { type: "cta", dur: 4.5, ad: true, headline: "Check your\nsavings rate", sub: "Free on FIREpath" },
    ],
    caption: "Every 10% you save can cut a decade off your working life. What’s your savings rate? 👇 #savingsrate #FIRE #earlyretirement #financialindependence",
  },
];
