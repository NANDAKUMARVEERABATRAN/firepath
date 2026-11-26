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

/** A lump sum left to grow for `years`. */
export const grow = (value, ratePercent, years) => value * Math.pow(1 + ratePercent / 1200, years * 12);

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
  {
    id: "04-raise-trap",
    book: "The Psychology of Money",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "You got a\n₹40,000 raise.\n*Here’s how to stay\nbroke anyway.*" },
      { type: "text", dur: 5, text: "Step 1: a bigger car\non EMI.\nStep 2: there is\nno step 2." },
      { type: "text", dur: 4.5, ad: true, eyebrow: "INSTEAD", text: "*Enjoy* half the raise.\n*Invest* the other half." },
      { type: "big", dur: 7, ad: true, pre: "₹20,000 a month\nfor 15 years becomes", value: sip(20000, 12, 15), post: `you put in ${inr(20000 * 180)}`, disclaimer: DISCLAIMER },
      { type: "text", dur: 4.5, text: "Know what *enough* is.\nLet raises buy\nyou freedom." },
      { type: "cta", dur: 4.5, ad: true, headline: "Find your\nfreedom age", sub: "Free · takes 30 seconds" },
    ],
    caption: "Lifestyle creep cancels raises. The 50/50 raise rule: enjoy half, invest half. #lifestylecreep #salaryhike #moneymindset #FIRE",
  },
  {
    id: "05-keep-one-tenth",
    book: "The Richest Man in Babylon",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "A 100-year-old book\nhas *the simplest\nwealth rule ever.*" },
      { type: "text", dur: 5.5, ad: true, text: "Keep *one-tenth*\nof everything you earn.\nBefore rent.\nBefore shopping." },
      { type: "big", dur: 7, ad: true, pre: "Salary ₹60,000 → keep ₹6,000\nfor 25 years becomes", value: sip(6000, 12, 25), post: `you put in ${inr(6000 * 300)}`, disclaimer: DISCLAIMER },
      { type: "text", dur: 4.5, text: "Start with *10%*.\nRaise it every year." },
      { type: "cta", dur: 4.5, ad: true, headline: "Plan your\nfreedom", sub: "Free FIRE calculator" },
    ],
    caption: "One-tenth of everything you earn is yours to keep. Start with 10%, then raise it. #richestmaninbabylon #10percentrule #wealthbuilding #SIP",
  },
  {
    id: "06-life-energy",
    book: "Your Money or Your Life",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "That ₹1 lakh phone\ncosts *200 hours\nof your life.*" },
      { type: "text", dur: 6, ad: true, eyebrow: "YOUR LIFE ENERGY", text: "₹80,000 a month\n÷ 160 working hours\n= *₹500 an hour*" },
      { type: "text", dur: 5, text: "₹1,00,000 ÷ ₹500", big: "200 hrs" },
      { type: "text", dur: 5, ad: true, text: "Not saying don’t buy it.\nJust ask: is it worth\n*5 weeks of my life?*" },
      { type: "cta", dur: 4.5, ad: true, headline: "Spend on what\nmatters", sub: "Plan your freedom · free" },
    ],
    caption: "Price things in hours, not rupees. Some purchases are worth it. Many aren’t. ⏳ #moneyandlife #mindfulspending #FIRE",
  },
  {
    id: "07-income-vs-wealth",
    book: "The Millionaire Next Door",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "Who gets rich first?\n*₹3 lakh* salary\nor *₹1 lakh* salary?" },
      { type: "text", dur: 6, text: "Karan earns ₹3 lakh,\nspends ₹2.8 lakh.\nPriya earns ₹1 lakh,\n*lives simply.*" },
      { type: "compare", dur: 9, ad: true, title: "Invested after 10 years", disclaimer: DISCLAIMER,
        items: [{ label: "Priya", sub: "invests ₹40k/mo", value: sip(40000, 12, 10) }, { label: "Karan", sub: "invests ₹20k/mo", value: sip(20000, 12, 10) }],
        note: "Wealth is what you *don’t* spend." },
      { type: "cta", dur: 4.5, ad: true, headline: "Check your\nsavings rate", sub: "Free on FIREpath" },
    ],
    caption: "A big salary looks rich. A big savings rate becomes rich. #millionairenextdoor #wealth #savingsrate #FIRE",
  },
  {
    id: "08-spend-on-what-you-love",
    book: "I Will Teach You to Be Rich",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "I spend on travel\n*without guilt.*\nHere’s the trick." },
      { type: "text", dur: 5, text: "Spend big on\n*1–2 things you love.*\nCut hard on the rest." },
      { type: "list", dur: 7, ad: true, eyebrow: "CUT THESE FIRST", items: ["Unused *subscriptions*", "Food *delivery fees*", "Impulse *sale buys*"] },
      { type: "big", dur: 7, ad: true, pre: "Just ₹3,000 a month\ninvested for 20 years", value: sip(3000, 12, 20), post: "Leak Hunter finds yours in 2 minutes", disclaimer: DISCLAIMER },
      { type: "cta", dur: 4.5, ad: true, headline: "Find your\nspending leaks", sub: "Free on FIREpath" },
    ],
    caption: "Frugal on what doesn’t matter, generous on what does. 🎯 #consciousspending #budgeting #moneytips #FIRE",
  },
  {
    id: "09-emergency-fund",
    book: "The Psychology of Money",
    scenes: [
      { type: "hook", dur: 3.6, ad: true, text: "2020. Same crash.\nTwo investors.\n*Only one locked\nin a loss.*" },
      { type: "text", dur: 5.5, text: "One had *6 months*\nof expenses saved\nand kept every\nSIP running." },
      { type: "text", dur: 5, text: "The other had to\n*sell at the bottom*\nto pay the bills." },
      { type: "text", dur: 5.5, ad: true, eyebrow: "LEAVE ROOM FOR ERROR", text: "Emergency fund =\n*6 × monthly expenses*" },
      { type: "cta", dur: 4.5, ad: true, headline: "Check your\nsafety buffer", sub: "Free on FIREpath" },
    ],
    caption: "The emergency fund doesn’t earn much. It protects everything that does. #emergencyfund #moneysafety #personalfinanceindia",
  },
  {
    id: "10-asset-or-liability",
    book: "Rich Dad Poor Dad",
    scenes: [
      { type: "hook", dur: 3.4, ad: true, text: "Your car isn’t\nan asset.\n*Here’s the\n5-second test.*" },
      { type: "text", dur: 5.5, text: "An asset puts money\n*in* your pocket.\nA liability takes\nmoney *out*." },
      { type: "text", dur: 4.5, text: "A ₹15,000 car EMI\nfor 5 years takes money\nout every month." },
      { type: "big", dur: 7.5, ad: true, pre: "The same ₹15,000 invested\nfor 5 years, then left\nalone for 15 more", value: grow(sip(15000, 12, 5), 12, 15), post: `by year 20 · you put in ${inr(15000 * 60)}`, disclaimer: DISCLAIMER },
      { type: "text", dur: 4.5, ad: true, text: "Buy the car\nif you need it.\nJust know what it\n*really costs.*" },
      { type: "cta", dur: 4.5, ad: true, headline: "Plan your\nfreedom", sub: "Free FIRE calculator" },
    ],
    caption: "Judge purchases by cash flow, not by how they look. #richdadpoordad #assets #carloan #FIRE",
  },
];
