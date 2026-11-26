/**
 * Daily book lessons. Each is an original summary of a broad idea associated with the book,
 * paired with an Indian example and a one-question quiz. They are not quotations or endorsements.
 */
export type Lesson = {
  id: string;
  book: string;
  author: string;
  title: string;
  idea: string;
  example: string;
  exampleUae?: string; // UAE version of the real-life example
  challenge: string;
  question: string;
  options: string[];
  answer: number;
  explain: string;
};

export const lessons: Lesson[] = [
  {
    id: "pom-time", book: "The Psychology of Money", author: "Morgan Housel",
    title: "Money’s best gift is control over your time",
    idea: "The strongest reason to build wealth is not luxury — it is the freedom to decide what you do, when, and with whom.",
    example: "Riya, 29, keeps 8 months of expenses invested. When her manager became toxic, she could take two months to find a better role instead of accepting the first offer.",
    challenge: "Write one thing you would do with a year of free time. That is your “why”.",
    question: "According to this idea, the biggest benefit of savings is…",
    options: ["Buying a bigger house", "Having control over your time", "Beating your friends’ returns"], answer: 1,
    explain: "Savings buy options. Options mean you can say no — that is real freedom.",
  },
  {
    id: "pom-enough", book: "The Psychology of Money", author: "Morgan Housel",
    title: "Know what “enough” is",
    idea: "If your goalposts keep moving with every raise, you will never feel rich. Defining enough protects you from risks you never needed to take.",
    example: "A ₹40,000 salary hike that becomes a ₹40,000 car EMI leaves you exactly where you started — just with more stress.",
    challenge: "Set your FIRE monthly expense number in your plan. That is your “enough”.",
    question: "What happens when lifestyle rises as fast as income?",
    options: ["You become rich faster", "Your savings rate stays flat", "Your FIRE date moves closer"], answer: 1,
    explain: "Lifestyle creep cancels raises. Saving part of every raise is what moves your FIRE date.",
  },
  {
    id: "pom-compounding", book: "The Psychology of Money", author: "Morgan Housel",
    title: "Time is the secret ingredient",
    idea: "Compounding works best when left alone for a long time. Staying invested for decades matters more than finding the best returns.",
    example: "₹10,000 a month at 12% for 30 years grows to about ₹3.5 crore. Stopping after 20 years gives only about ₹1 crore.",
    challenge: "Check that your monthly SIP is automated so time can do its work.",
    question: "Which matters most for compounding?",
    options: ["Picking the hottest stock", "How long you stay invested", "Checking your portfolio daily"], answer: 1,
    explain: "The last decade of compounding often creates more wealth than the first two combined.",
  },
  {
    id: "pom-room", book: "The Psychology of Money", author: "Morgan Housel",
    title: "Leave room for error",
    idea: "Plans fail when they need everything to go right. A cash buffer and conservative assumptions keep you in the game.",
    example: "During 2020, people with 6 months of emergency money kept their SIPs running. Others had to redeem at the bottom.",
    challenge: "Check your emergency fund level on the Freedom Path.",
    question: "Why keep an emergency fund if investments earn more?",
    options: ["So you never have to sell investments at a bad time", "Because cash beats inflation", "Banks require it"], answer: 0,
    explain: "The buffer protects your long-term investments from short-term emergencies.",
  },
  {
    id: "rdpd-asset", book: "Rich Dad Poor Dad", author: "Robert Kiyosaki",
    title: "Assets feed you, liabilities eat you",
    idea: "A simple test: an asset puts money in your pocket; a liability takes money out. Judge purchases by cash flow, not by how they look.",
    example: "A second car on EMI costs fuel, insurance and interest every month. An index fund SIP may pay you back for decades.",
    challenge: "Open Assets & loans and mark which items cost you money every month.",
    question: "By this definition, a car bought on a loan for personal use is usually…",
    options: ["An asset", "A liability", "Neither"], answer: 1,
    explain: "It takes money out each month through EMI, fuel and maintenance.",
  },
  {
    id: "rdpd-payfirst", book: "Rich Dad Poor Dad", author: "Robert Kiyosaki",
    title: "Pay yourself first",
    idea: "Move money to investments the moment salary arrives, then live on the rest. Willpower at the end of the month rarely works.",
    example: "Set your SIP date to the 2nd of the month, one day after salary credit. Spending adjusts to what’s left.",
    challenge: "Make sure at least one SIP runs right after payday.",
    question: "When is the best time to invest each month?",
    options: ["Whatever is left at month end", "Right after salary is credited", "Only when markets fall"], answer: 1,
    explain: "Investing first turns saving into a default, not a decision.",
  },
  {
    id: "rdpd-learn", book: "Rich Dad Poor Dad", author: "Robert Kiyosaki",
    title: "Financial education is a lifelong asset",
    idea: "Schools rarely teach money. Learning how taxes, debt and investments work is an investment with very high returns.",
    example: "Knowing the difference between old and new tax regimes can save a salaried Indian ₹20,000+ a year.",
    challenge: "Finish today’s lesson and one more this week.",
    question: "Which is an investment in yourself?",
    options: ["Learning how your taxes work", "A new phone on EMI", "Lottery tickets"], answer: 0,
    explain: "Knowledge compounds too — every money decision gets a little better.",
  },
  {
    id: "babylon-tenth", book: "The Richest Man in Babylon", author: "George S. Clason",
    title: "Keep a part of all you earn",
    idea: "Saving at least a tenth of every income, without exception, is the first rule of building wealth.",
    example: "On a ₹60,000 salary, ₹6,000 a month for 25 years at 11% becomes roughly ₹90 lakh.",
    challenge: "Check that you invest at least 10% this month. Then aim for 20%.",
    question: "What is the minimum share of income this rule says to keep?",
    options: ["One-tenth", "One-half", "Whatever is left"], answer: 0,
    explain: "Start with 10%. FIRE seekers usually grow it to 30–50% over time.",
  },
  {
    id: "babylon-work", book: "The Richest Man in Babylon", author: "George S. Clason",
    title: "Make your money work for you",
    idea: "Each rupee saved should be put to work earning more, and those earnings should also be put to work.",
    example: "₹2 lakh idle in a savings account at 3% loses value to 6% inflation. Invested for the long term, it can grow.",
    challenge: "Look at how much cash you hold beyond your emergency fund.",
    question: "Idle cash beyond your emergency fund usually…",
    options: ["Grows safely", "Loses value to inflation", "Earns the highest return"], answer: 1,
    explain: "Inflation quietly reduces what idle money can buy.",
  },
  {
    id: "ii-mrmarket", book: "The Intelligent Investor", author: "Benjamin Graham",
    title: "Mr. Market is moody — you don’t have to be",
    idea: "Markets swing between excitement and panic. A long-term investor can ignore the mood and keep following a plan.",
    example: "When the Nifty fell nearly 40% in March 2020, investors who kept their SIPs bought units at a discount.",
    challenge: "Write a one-line rule: “When markets fall, I will…”",
    question: "Markets fall 20%. Following this idea, a long-term SIP investor should…",
    options: ["Stop all SIPs immediately", "Continue the plan", "Move everything to gold"], answer: 1,
    explain: "Falls are when SIPs buy the most units. Panic selling locks in losses.",
  },
  {
    id: "ii-margin", book: "The Intelligent Investor", author: "Benjamin Graham",
    title: "Always keep a margin of safety",
    idea: "Build plans that still work if things go worse than expected — lower returns, higher costs, surprises.",
    example: "Plan your FIRE with 10% returns and 6–7% inflation rather than 15% returns. If it works on the cautious case, you’re safe.",
    challenge: "Try a lower return assumption in your FIRE plan and see the new date.",
    question: "A margin of safety means…",
    options: ["Using optimistic assumptions", "Planning for things going worse than expected", "Borrowing to invest more"], answer: 1,
    explain: "Conservative assumptions protect your plan from disappointment.",
  },
  {
    id: "spw-index", book: "The Simple Path to Wealth", author: "J.L. Collins",
    title: "Simple beats complicated",
    idea: "Low-cost, broadly diversified funds held for decades are hard to beat — and easy to stick with.",
    example: "A direct-plan index fund with a 0.2% expense ratio vs a 2% regular plan: over 25 years the gap can be lakhs of rupees.",
    challenge: "Note the expense ratio of each fund in your portfolio.",
    question: "Over long periods, which cost difference matters?",
    options: ["Tiny — fees never matter", "Big — fees compound against you", "Fees only matter for stocks"], answer: 1,
    explain: "Every 1% in fees, compounded for decades, eats a large share of the final corpus.",
  },
  {
    id: "spw-fu", book: "The Simple Path to Wealth", author: "J.L. Collins",
    title: "Build your freedom fund",
    idea: "Even before full FIRE, a growing pile of investments gives you the power to walk away from bad situations.",
    example: "Two years of expenses invested lets you take a career break, start a business or care for a parent.",
    challenge: "Look at your “months of freedom” number on the Journey page.",
    question: "What does a freedom fund give you before full FIRE?",
    options: ["Bragging rights", "Choices and bargaining power", "Nothing until 100%"], answer: 1,
    explain: "Every month of expenses you own increases your choices.",
  },
  {
    id: "ltm-insurance", book: "Let’s Talk Money", author: "Monika Halan",
    title: "Insure first, invest next",
    idea: "Protection is the base of the money box. Without health and term cover, one event can wipe out years of investing.",
    example: "A family floater health cover and a pure term plan cost a fraction of what a mixed ‘investment + insurance’ policy does.",
    challenge: "Record your health and term cover on your profile.",
    question: "If someone depends on your income, which cover matters most?",
    options: ["Pure term life cover", "A savings-linked endowment plan", "No cover needed"], answer: 0,
    explain: "Pure term gives high cover at low cost; investing separately usually works better.",
  },
  {
    id: "ltm-structure", book: "Let’s Talk Money", author: "Monika Halan",
    title: "Give every rupee a job",
    idea: "Separate money into spending, emergency, and long-term investing. A clear structure reduces stress and mistakes.",
    example: "Salary account for spending, a separate account for emergencies, and SIPs for long-term goals.",
    challenge: "Create at least one goal on the Goals page and give it a monthly amount.",
    question: "Why separate emergency money from investments?",
    options: ["So emergencies don’t force you to sell investments", "To earn higher returns", "It’s required by law"], answer: 0,
    explain: "Separation protects long-term money from short-term needs.",
  },
  {
    id: "ymyl-lifeenergy", book: "Your Money or Your Life", author: "Vicki Robin & Joe Dominguez",
    title: "Money is your life energy",
    idea: "Every rupee spent cost you hours of your life. Seeing purchases in hours of work makes spending choices clearer.",
    example: "If you earn ₹500 per hour after costs, a ₹25,000 phone costs 50 hours of your life.",
    challenge: "Before your next big purchase, convert its price into hours of work.",
    question: "Converting prices into hours of work helps you…",
    options: ["Spend on what truly matters", "Never spend anything", "Earn more interest"], answer: 0,
    explain: "It’s not about spending less on everything — it’s about spending on what you value.",
  },
  // ——— More books that help people reach FIRE (original summaries, not quotations) ———
  {
    id: "iwt-automate", book: "I Will Teach You to Be Rich", author: "Ramit Sethi",
    title: "Automate it so willpower isn’t needed",
    idea: "Set up money to flow automatically on payday — investing, bills, savings — so good decisions happen without thinking.",
    example: "Salary hits on the 1st; on the 2nd a SIP, an RD for the trip and a transfer to the emergency account run by themselves.",
    exampleUae: "Salary lands on the 25th; on the 26th standing orders move money to your investment account, school-fee savings and the emergency account.",
    challenge: "Set one automatic transfer for the day after payday.",
    question: "Why does automating savings work so well?",
    options: ["It removes the monthly decision", "Banks pay more interest", "It avoids all taxes"], answer: 0,
    explain: "What happens by default beats what depends on discipline.",
  },
  {
    id: "iwt-conscious", book: "I Will Teach You to Be Rich", author: "Ramit Sethi",
    title: "Spend extravagantly on what you love — cut mercilessly elsewhere",
    idea: "Frugality isn’t cutting everything. Decide the few things you love, spend on them guilt-free, and ruthlessly cut what you don’t care about.",
    example: "Riya loves travel but doesn’t care about cars: she drives a 10-year-old hatchback and takes two trips a year without guilt.",
    exampleUae: "Arjun loves weekend brunches but not cars: he drives a used sedan and enjoys brunch twice a month guilt-free.",
    challenge: "Name one thing you love spending on and one you could drop.",
    question: "Conscious spending means…",
    options: ["Spending nothing", "Spending big on what you value, little on what you don’t", "Spending equally on everything"], answer: 1,
    explain: "Cutting what you don’t value funds FIRE without making life joyless.",
  },
  {
    id: "mnd-income", book: "The Millionaire Next Door", author: "Thomas J. Stanley & William D. Danko",
    title: "High income is not the same as wealth",
    idea: "Many people who look rich spend everything they earn. Many quietly wealthy people live well below their means.",
    example: "A ₹3 lakh/month earner with two car loans can have lower net worth than a ₹1 lakh/month teacher who invested for 20 years.",
    exampleUae: "An AED 60,000/month earner leasing two luxury cars can have less net worth than an AED 18,000/month nurse who invested for 15 years.",
    challenge: "Compare your net worth to your yearly income on the Portfolio page.",
    question: "What actually builds wealth?",
    options: ["A high salary", "The gap between income and spending, invested", "Looking successful"], answer: 1,
    explain: "Wealth is what you keep and invest, not what you earn.",
  },
  {
    id: "dwz-experiences", book: "Die With Zero", author: "Bill Perkins",
    title: "Money is for living — at the right time",
    idea: "Some experiences have an expiry date. A good plan balances saving for the future with living fully at each age.",
    example: "A trek with your parents is possible at 35, maybe not at 55. Budgeting for it can be part of a healthy FIRE plan.",
    exampleUae: "Taking your kids on a trip back home while grandparents are healthy may be worth more than an extra year of savings.",
    challenge: "Add one “time-sensitive” experience as a goal.",
    question: "This idea warns against…",
    options: ["Investing at all", "Saving so hard you miss experiences that won’t come back", "Taking any trips"], answer: 1,
    explain: "FIRE is about a better life — not just the biggest number.",
  },
  {
    id: "ah-one-percent", book: "Atomic Habits", author: "James Clear",
    title: "Tiny habits compound like money",
    idea: "Small improvements repeated daily compound into big results — the same way investments do.",
    example: "Increasing your SIP by just 10% every year (a step-up SIP) can add crores over a career.",
    exampleUae: "Raising your monthly investment by 10% each year — a small step — can add hundreds of thousands of dirhams over a career.",
    challenge: "Pick one 2-minute money habit, like logging today’s spending.",
    question: "What is the power of tiny habits?",
    options: ["They compound over time", "They make you rich overnight", "They don’t matter"], answer: 0,
    explain: "Consistency compounds — in habits and in money.",
  },
  {
    id: "naval-own", book: "The Almanack of Naval Ravikant", author: "Eric Jorgenson",
    title: "Own pieces of businesses, not just your time",
    idea: "Selling hours has a ceiling. Owning assets — equity in companies, your own business, or index funds — lets money work while you sleep.",
    example: "An index fund makes you a part-owner of India’s 50 biggest companies for a few hundred rupees.",
    exampleUae: "A global index fund makes you part-owner of thousands of companies worldwide for a small monthly amount.",
    challenge: "Check what share of your FIRE portfolio is in ownership assets.",
    question: "Why does owning assets matter for FIRE?",
    options: ["Assets can earn without your time", "Assets never fall in value", "It avoids work forever"], answer: 0,
    explain: "Ownership decouples income from hours worked.",
  },
  {
    id: "bogle-costs", book: "The Little Book of Common Sense Investing", author: "John C. Bogle",
    title: "Don’t look for the needle — buy the haystack",
    idea: "Instead of trying to pick winners, own the whole market at low cost and hold it for decades.",
    example: "A Nifty 50 index fund with a tiny expense ratio holds all 50 companies — no stock-picking needed.",
    exampleUae: "A low-cost global or S&P 500 index ETF owns hundreds of companies — no stock-picking needed.",
    challenge: "Find the expense ratio of your largest fund.",
    question: "What does “buy the haystack” mean?",
    options: ["Pick one great stock", "Own the whole market cheaply", "Buy gold only"], answer: 1,
    explain: "Low-cost diversification wins for most long-term investors.",
  },
  {
    id: "malkiel-time", book: "A Random Walk Down Wall Street", author: "Burton G. Malkiel",
    title: "Time in the market beats timing the market",
    idea: "Short-term prices are unpredictable. Staying invested through ups and downs matters more than guessing tops and bottoms.",
    example: "Investors who missed just the 10 best days in a decade often earned far less than those who simply stayed invested.",
    exampleUae: "Waiting for “the right time” to invest your bonus often means missing the best days entirely.",
    challenge: "Commit to not checking your portfolio daily this week.",
    question: "Which approach suits most FIRE investors?",
    options: ["Jumping in and out", "Staying invested for the long term", "Only investing after crashes"], answer: 1,
    explain: "Nobody times the market reliably; time in it does the work.",
  },
  {
    id: "ere-needs", book: "Early Retirement Extreme", author: "Jacob Lund Fisker",
    title: "Need less, and freedom comes sooner",
    idea: "Every rupee you don’t need each month is a rupee you never have to fund in retirement. Lower needs shorten the FIRE journey dramatically.",
    example: "Cutting monthly spending from ₹60,000 to ₹50,000 lowers your FIRE number by about ₹34 lakh.",
    exampleUae: "Cutting monthly spending from AED 15,000 to AED 13,000 lowers your FIRE number by about AED 685,000.",
    challenge: "Find one recurring expense you no longer need.",
    question: "Lowering expenses helps FIRE in how many ways?",
    options: ["One — you save more", "Two — you save more AND need a smaller corpus", "None"], answer: 1,
    explain: "It’s a double win: more invested now, less needed later.",
  },
  {
    id: "coffee-can", book: "Coffee Can Investing", author: "Saurabh Mukherjea",
    title: "Buy quality and leave it alone",
    idea: "Good businesses bought at sensible prices and held for 10+ years, without constant tinkering, can quietly compound wealth.",
    example: "Investors who held consistent, high-quality Indian companies through cycles often beat those who traded frequently.",
    exampleUae: "Holding quality funds for 10+ years — and ignoring daily news — often beats frequent trading.",
    challenge: "Write down your minimum holding period for long-term investments.",
    question: "The “coffee can” idea is mainly about…",
    options: ["Trading often", "Patience with quality investments", "Buying coffee shares"], answer: 1,
    explain: "Patience lets compounding do its work.",
  },
];

// UAE versions of the original lessons' real-life examples.
const uaeExamples: Record<string, string> = {
  "pom-time": "Sara, 31, kept 8 months of expenses invested. When her company restructured, she had time to find the right role — and keep her visa — without panic.",
  "pom-enough": "An AED 5,000 raise that becomes a bigger villa and a car lease leaves you exactly where you started — with more stress.",
  "pom-compounding": "AED 2,000 a month at 7% for 30 years grows to about AED 2.3 million. Stopping after 20 years gives only about AED 1 million.",
  "pom-room": "In 2020 many UAE residents lost jobs suddenly. Those with 6 months of savings could stay, search, and keep investing.",
  "rdpd-asset": "A leased SUV costs AED 3,000+ a month plus fuel and Salik. A monthly investment of the same amount could pay you back for decades.",
  "rdpd-payfirst": "Set a standing order to your investment account the day after salary day. Spending adjusts to what’s left.",
  "rdpd-learn": "Understanding how end-of-service gratuity is calculated helps you plan job changes without losing money.",
  "babylon-tenth": "On an AED 15,000 salary, AED 1,500 a month for 25 years at 7% becomes roughly AED 1.2 million.",
  "babylon-work": "AED 100,000 idle in a current account loses value to inflation each year. Invested for the long term, it can grow.",
  "ii-mrmarket": "When global markets fell sharply in 2020 and 2022, investors who kept investing monthly bought at a discount.",
  "ii-margin": "Plan your FIRE with modest returns and some inflation. If it still works on the cautious case, you’re safe.",
  "spw-index": "A global index ETF with a 0.1% fee vs a 1.5% managed plan: over 25 years the gap can be hundreds of thousands of dirhams.",
  "spw-fu": "Two years of expenses invested lets you change jobs, start a business, or move home on your own terms.",
  "ltm-insurance": "Employer health cover usually ends with your job. Your own cover — and term life if family depends on you — keeps the plan safe.",
  "ltm-structure": "Salary account for spending, a separate account for emergencies, and investments for long-term goals like school fees and moving home.",
  "ymyl-lifeenergy": "If you earn AED 100 per hour after costs, a AED 5,000 phone costs 50 hours of your life.",
};

/** The real-life example for the user's country (UAE falls back to the Indian one if no variant exists). */
export function lessonExample(lesson: Lesson, currency?: string | null): string {
  if (currency !== "AED") return lesson.example;
  return lesson.exampleUae ?? uaeExamples[lesson.id] ?? lesson.example;
}

/** Deterministic daily lesson so everyone sees the same one on a given day. */
export function getLessonOfDay(date = new Date(), completed: string[] = []): Lesson {
  const dayIndex = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const pending = lessons.filter(lesson => !completed.includes(lesson.id));
  const pool = pending.length ? pending : lessons;
  return pool[dayIndex % pool.length];
}
