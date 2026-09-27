// Conversions pinyin numérique (xue2 sheng5) <-> pinyin accentué (xué sheng).
// Utilisé à la fois par l'application et par les scripts de préparation des données.

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface Syllable {
  /** Syllabe accentuée, ex. « xué » */
  text: string;
  /** 1 à 4, 5 = ton neutre */
  tone: Tone;
}

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

const UNMARK: Record<string, [string, Tone]> = {};
for (const [base, marked] of Object.entries(MARKS)) {
  marked.forEach((m, i) => {
    UNMARK[m] = [base, (i + 1) as Tone];
    UNMARK[m.toUpperCase()] = [base.toUpperCase(), (i + 1) as Tone];
  });
}

const VOWELS = 'aeiouü';

/** « lu:4 », « lv4 » -> « lü4 » */
function normalizeUmlaut(s: string): string {
  return s.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü');
}

/** Index de la voyelle qui porte l'accent, selon les règles standard. */
function markIndex(lower: string): number {
  const a = lower.indexOf('a');
  if (a >= 0) return a;
  const e = lower.indexOf('e');
  if (e >= 0) return e;
  const ou = lower.indexOf('ou');
  if (ou >= 0) return ou;
  for (let i = lower.length - 1; i >= 0; i--) {
    if (VOWELS.includes(lower[i])) return i;
  }
  return -1;
}

/** Une syllabe numérique (« xue2 », « ma », « lu:4 ») -> syllabe accentuée + ton. */
export function parseSyllable(raw: string): Syllable {
  const m = /^(.*?)([1-5])?$/.exec(normalizeUmlaut(raw.trim()))!;
  const body = m[1];
  const tone = (m[2] ? Number(m[2]) : 5) as Tone;
  if (tone === 5) return { text: body, tone };
  const idx = markIndex(body.toLowerCase());
  if (idx < 0) return { text: body, tone };
  const ch = body[idx];
  const marked = MARKS[ch.toLowerCase()][tone - 1];
  const out = ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? marked.toUpperCase() : marked;
  return { text: body.slice(0, idx) + out + body.slice(idx + 1), tone };
}

/** « xue2 sheng5 » -> syllabes accentuées. Les éléments non syllabiques (« · », « , ») sont conservés avec le ton 5. */
export function parseNumeric(numeric: string): Syllable[] {
  return numeric
    .split(/\s+/)
    .filter(Boolean)
    .map(parseSyllable);
}

/** « xue2 sheng5 » -> « xuésheng » (ou « xué sheng » avec separator = ' ') */
export function numericToMarked(numeric: string, separator = ''): string {
  return parseNumeric(numeric)
    .map((s) => s.text)
    .join(separator);
}

/** « liǎo » -> « liao3 », « le » -> « le5 » */
export function markedToNumeric(marked: string): string {
  let tone: Tone = 5;
  let out = '';
  for (const ch of marked.normalize('NFC')) {
    const u = UNMARK[ch];
    if (u) {
      out += u[0];
      tone = u[1];
    } else {
      out += ch;
    }
  }
  return out + tone;
}

/** Retire tons, accents et chiffres : « xué sheng », « xue2 sheng5 » -> « xuesheng ». ü devient v. */
export function stripTones(s: string): string {
  let out = '';
  for (const ch of normalizeUmlaut(s.toLowerCase()).normalize('NFC')) {
    const u = UNMARK[ch];
    out += u ? u[0] : ch;
  }
  return out.replace(/ü/g, 'v').replace(/[\s1-5·']/g, '');
}
