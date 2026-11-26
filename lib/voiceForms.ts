/**
 * Browsers write Hindi with or without the nukta dot (हज़ार vs हजार, करोड़ vs करोड). Strip it so both spellings match.
 * NFD splits precomposed nukta letters (U+0958–U+095F) into base + U+093C, which we then drop.
 */
const stripNukta = (text: string) => text.normalize("NFD").replace(/़/g, "").normalize("NFC");
const normalizeKeys = <T,>(map: Record<string, T>) => Object.fromEntries(Object.entries(map).map(([key, value]) => [stripNukta(key), value])) as Record<string, T>;

const units: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const spokenNumbers: Record<string, number> = normalizeKeys({
  ...units,
  ek: 1, eka: 1, do: 2, teen: 3, tin: 3, chaar: 4, char: 4, paanch: 5, panch: 5, cheh: 6, chhe: 6,
  saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
  solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20, ikkis: 21, bais: 22, teis: 23, chaubis: 24,
  pachis: 25, chhabis: 26, sattais: 27, athais: 28, untis: 29, tees: 30, chaalis: 40, pachaas: 50,
  saath: 60, sattar: 70, assi: 80, nabbe: 90,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छे: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पंद्रह: 15, सोलह: 16, सत्रह: 17, अठारह: 18, उन्नीस: 19,
  बीस: 20, इक्कीस: 21, बाईस: 22, तेईस: 23, चौबीस: 24, पच्चीस: 25, छब्बीस: 26, सत्ताईस: 27,
  अट्ठाईस: 28, उनतीस: 29, तीस: 30, चालीस: 40, पचास: 50, साठ: 60, सत्तर: 70, अस्सी: 80, नब्बे: 90,
});
const scaleWords: Record<string, number> = normalizeKeys({
  hundred: 100, hundreds: 100, सौ: 100, shau: 100, sau: 100,
  thousand: 1000, thousands: 1000, हज़ार: 1000, हजार: 1000, hazaar: 1000, hajar: 1000, hazar: 1000,
  lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000, laakh: 100000, लाख: 100000,
  crore: 10000000, crores: 10000000, cr: 10000000, karod: 10000000, karor: 10000000, करोड़: 10000000,
  million: 1000000, millions: 1000000, mn: 1000000, k: 1000, m: 1000000,
});
// Hindi fractions: डेढ़ = 1.5, ढाई = 2.5; modifiers before a number: साढ़े (+0.5), सवा (+0.25), पौने (−0.25).
const fractionWords: Record<string, number> = normalizeKeys({ डेढ़: 1.5, dedh: 1.5, ढाई: 2.5, dhai: 2.5, adhai: 2.5 });
const modifierWords: Record<string, number> = normalizeKeys({ साढ़े: 0.5, sadhe: 0.5, saade: 0.5, सवा: 0.25, sava: 0.25, पौने: -0.25, paune: -0.25 });

const normalizeDigits = (text: string) => stripNukta(text).replace(/[०-९]/g, digit => String("०१२३४५६७८९".indexOf(digit)));
const unitPattern = Object.keys(scaleWords).sort((a, b) => b.length - a.length).join("|");

export function parseSpokenAmount(text: string): number | null {
  const normalized = normalizeDigits(text);

  // Digits, optionally followed by a unit. Consecutive groups with falling units add up: "1 lakh 50 thousand".
  const groupRegex = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${unitPattern})?(?![\\p{L}\\p{M}])`, "giu");
  const groups = [...normalized.matchAll(groupRegex)];
  if (groups.length) {
    let total = 0;
    let lastScale = Infinity;
    let lastEnd = -1;
    for (const group of groups) {
      if (lastEnd >= 0 && !/^[\s,]*(?:and|aur|और)?[\s,]*$/i.test(normalized.slice(lastEnd, group.index))) break;
      const base = Number(group[1].replaceAll(",", ""));
      const scale = group[2] ? scaleWords[group[2].toLowerCase()] ?? 1 : 1;
      if (!Number.isFinite(base) || scale >= lastScale) break;
      total += base * scale;
      lastScale = scale;
      lastEnd = (group.index ?? 0) + group[0].length;
      if (scale === 1) break;
    }
    return Number.isFinite(total) ? total : null;
  }

  // Number words: "two lakh fifty thousand", "पाँच हज़ार", "do lakh", "डेढ़ लाख", "साढ़े तीन लाख".
  const tokens = normalized.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? [];
  let total = 0;
  let current = 0;
  let modifier = 0;
  let found = false;
  for (const word of tokens) {
    if (word in modifierWords) { modifier = modifierWords[word]; continue; }
    if (word in fractionWords) { current += fractionWords[word]; found = true; continue; }
    if (word in spokenNumbers) { current += spokenNumbers[word] + modifier; modifier = 0; found = true; continue; }
    if (word in scaleWords) {
      found = true;
      const scale = scaleWords[word];
      if (scale === 100) current = Math.max(current, 1) * scale;
      else { total += Math.max(current, 1) * scale; current = 0; }
    }
  }
  const value = total + current;
  return found && Number.isFinite(value) && value > 0 ? value : null;
}

export function parseLabeledAmount(text: string, labels: string[]): number | null {
  const hindiAliases: Record<string, string[]> = {
    income: ["aamdani", "आमदनी", "आय"], salary: ["vetan", "वेतन", "तनख्वाह"], expenses: ["kharcha", "खर्च", "खर्चा"], expense: ["kharcha", "खर्च"],
    spending: ["kharcha", "खर्च"], invested: ["nivesh", "निवेश"], investment: ["nivesh", "निवेश"], "debt paid": ["karz bhugtan", "कर्ज भुगतान"],
    debt: ["karz", "कर्ज", "ऋण"], "loan payment": ["loan ki kist", "लोन की किस्त"], "investment income": ["nivesh se aamdani", "निवेश से आय"],
    "total assets": ["kul sampatti", "कुल संपत्ति", "कुल परिसंपत्ति"], "overall assets": ["overall sampatti", "कुल संपत्ति"], assets: ["sampatti", "संपत्ति", "परिसंपत्ति"],
    "fire accessible funds": ["FIRE ke liye uplabdh", "FIRE के लिए उपलब्ध राशि"], "fire funds": ["FIRE funds", "FIRE राशि"], "available now": ["abhi uplabdh", "अभी उपलब्ध"],
    "later retirement funds": ["retirement ke liye", "सेवानिवृत्ति के लिए"], "retirement funds": ["retirement funds", "सेवानिवृत्ति निधि"],
    liabilities: ["karz", "कर्ज", "ऋण", "देयताएं", "देनदारियां"], "debt balance": ["karz balance", "कर्ज शेष"],
    "emergency fund": ["आपातकालीन निधि", "आपातकालीन बचत"], "emergency savings": ["आपातकालीन बचत"],
    "monthly investment": ["mahina nivesh", "मासिक निवेश", "महीने का निवेश"], "investment per month": ["मासिक निवेश"], "invested monthly": ["हर महीने निवेश"],
  };
  const allLabels = [...new Set(labels.flatMap(label => [label, ...(hindiAliases[label.toLowerCase()] ?? [])]).map(stripNukta))];
  const escapedLabels = allLabels
    .sort((a, b) => b.length - a.length)
    .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const laterLabels = stripNukta("investment income|income|salary|expenses?|spending|invested|investment|debt(?:\\s+paid)?|loan(?:\\s+payment)?|assets?|portfolio|fire[ -]?(?:accessible[ -]?)?funds|FIRE राशि|FIRE के लिए उपलब्ध राशि|retirement funds|later retirement|emergency (?:fund|savings)|monthly investment|liabilities|age|निवेश से (?:आय|आमदनी)|आमदनी|आय|वेतन|तनख्वाह|खर्च|खर्चा|निवेश|कुल संपत्ति|कुल परिसंपत्ति|संपत्ति|परिसंपत्ति|देयताएं|देनदारियां|सेवानिवृत्ति(?:\\s+निधि)?|आपातकालीन (?:निधि|बचत)|कर्ज(?:\\s+भुगतान|\\s+शेष)?|ऋण|लोन की किस्त|मासिक निवेश");
  const match = normalizeDigits(text).match(new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${escapedLabels})(?![\\p{L}\\p{M}\\p{N}])(?!(?:\\s+(?:income|payouts?|dividends?)\\b|\\s+से\\s+(?:आय|आमदनी)))(?:\\s+(?:is|are|was|of|around|about|है))?\\s+(.+?)(?=(?<![\\p{L}\\p{M}\\p{N}])(?:${laterLabels})(?![\\p{L}\\p{M}\\p{N}])|$)`, "iu"));
  return match ? parseSpokenAmount(match[1]) : null;
}
