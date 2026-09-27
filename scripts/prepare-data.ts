// Convertit les sources brutes (data-raw/) en données compactes pour l'application (public/data/).
// Usage : npm run data:prepare  (après npm run data:download)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { markedToNumeric } from '../src/lib/pinyin.ts';
import type { CharEntry, DataMeta, Reading, WordEntry } from '../src/data/types.ts';

const RAW = 'data-raw';
const OUT = 'public/data';
const STROKES_SRC = 'node_modules/hanzi-writer-data';
const SHARD_SIZE = 500;
const MAX_DEFS = 6;
/** Mots d'un seul caractère gardés comme « mots » s'ils sont dans ce top SUBTLEX (en plus du HSK). */
const SINGLE_CHAR_WORD_TOP = 3000;
/** Mots uniquement présents dans CC-CEDICT (sans traduction française) gardés s'ils sont dans ce top SUBTLEX. */
const EN_ONLY_WORD_TOP = 30000;

const isHan = (ch: string) => {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf);
};
const allHan = (s: string) => [...s].every(isHan);

// ---------------------------------------------------------------------------
// Dictionnaires au format CEDICT : « trad simp [pin1 yin1] /déf 1/déf 2/ »

interface DictEntry {
  simp: string;
  pinyin: string;
  defs: string[];
  classifiers: string[];
}

const LOW_PRIORITY = /^(surname|nom de famille|(old |archaic )?variant of|variante|see |voir |used in|utilisé dans|abbr\. for|abr\. de)/i;

function parseDict(path: string): Map<string, DictEntry[]> {
  const map = new Map<string, DictEntry[]>();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const m = /^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/.exec(line);
    if (!m) continue;
    const [, , simp, pinyin, rawDefs] = m;
    const classifiers: string[] = [];
    const defs: string[] = [];
    for (const d of rawDefs.split('/')) {
      const def = d.trim();
      if (!def) continue;
      const cl = /^CL:(.*)$/.exec(def);
      if (cl) {
        // « CL:個|个[ge4],位[wei4] » -> ['个', '位']
        for (const part of cl[1].split(',')) {
          const hz = /(?:[^|\[]+\|)?([^\[]+)\[/.exec(part);
          if (hz) classifiers.push(hz[1]);
        }
        continue;
      }
      defs.push(def);
    }
    defs.sort((a, b) => Number(LOW_PRIORITY.test(a)) - Number(LOW_PRIORITY.test(b)));
    const list = map.get(simp) ?? [];
    list.push({ simp, pinyin: pinyin.replace(/u:/g, 'ü'), defs, classifiers });
    map.set(simp, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Chargement des sources

for (const f of ['mmah-dictionary.txt', 'cfdict.u8', 'cedict_ts.u8', 'hsk-complete.json', 'SUBTLEX-CH-CHR', 'SUBTLEX-CH-WF']) {
  if (!existsSync(`${RAW}/${f}`)) throw new Error(`${RAW}/${f} manquant : lancez d'abord npm run data:download`);
}

console.log('Lecture des sources...');
const cfdict = parseDict(`${RAW}/cfdict.u8`);
const cedict = parseDict(`${RAW}/cedict_ts.u8`);

interface MmahEntry {
  character: string;
  pinyin: string[];
  definition?: string;
  decomposition: string;
  radical: string;
  etymology?: { type: string; hint?: string; semantic?: string; phonetic?: string };
}
const mmah = new Map<string, MmahEntry>();
for (const line of readFileSync(`${RAW}/mmah-dictionary.txt`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const e = JSON.parse(line) as MmahEntry;
  mmah.set(e.character, e);
}

interface HskWord {
  simplified: string;
  level: string[];
  forms: { transcriptions: { numeric: string }; meanings: string[]; classifiers: string[] }[];
}
const hsk = JSON.parse(readFileSync(`${RAW}/hsk-complete.json`, 'utf8')) as HskWord[];

/** Niveau HSK 3.0 : révision la plus récente (« newest ») si présente, sinon « new ». 7 = niveaux 7-9. */
function hskLevel(levels: string[]): number | undefined {
  for (const prefix of ['newest-', 'new-']) {
    const nums = levels.filter((l) => l.startsWith(prefix)).map((l) => Number(l.slice(prefix.length)));
    if (nums.length) return Math.min(...nums);
  }
  return undefined;
}

/** SUBTLEX-CH : encodage GB18030, 3 lignes d'en-tête, colonnes séparées par des tabulations. */
function readSubtlex(path: string): { item: string; count: number }[] {
  const text = new TextDecoder('gb18030').decode(readFileSync(path));
  return text
    .split(/\r?\n/)
    .slice(3)
    .map((l) => l.split('\t'))
    .filter((cols) => cols.length > 2 && cols[0])
    .map((cols) => ({ item: cols[0].trim(), count: Number(cols[1]) }));
}
const subChars = readSubtlex(`${RAW}/SUBTLEX-CH-CHR`);
const subWords = readSubtlex(`${RAW}/SUBTLEX-CH-WF`);
const totalChars = subChars.reduce((s, c) => s + c.count, 0);
const charRank = new Map<string, { rank: number; perMillion: number }>();
subChars.forEach((c, i) => charRank.set(c.item, { rank: i + 1, perMillion: (c.count / totalChars) * 1e6 }));
const wordRank = new Map<string, number>();
subWords.forEach((w, i) => wordRank.set(w.item, i + 1));

// ---------------------------------------------------------------------------
// Lectures (pinyin + traductions) d'un élément

/**
 * Fusionne les entrées CFDICT (fr) et CC-CEDICT (en) par prononciation.
 * `preferred` : prononciations numériques à placer en tête (ordre de priorité).
 */
function buildReadings(key: string, preferred: string[]): Reading[] {
  const byPinyin = new Map<string, Reading>();
  const add = (entries: DictEntry[] | undefined, lang: 'fr' | 'en') => {
    for (const e of entries ?? []) {
      const k = e.pinyin.toLowerCase();
      let r = byPinyin.get(k);
      if (!r) {
        r = { p: e.pinyin };
        byPinyin.set(k, r);
      }
      // Préférer la forme en minuscules (nom commun) à la forme nom propre
      if (r.p !== r.p.toLowerCase() && e.pinyin === e.pinyin.toLowerCase()) r.p = e.pinyin;
      const defs = (r[lang] ??= []);
      for (const d of e.defs) if (!defs.includes(d)) defs.push(d);
    }
  };
  add(cfdict.get(key), 'fr');
  add(cedict.get(key), 'en');

  const readings = [...byPinyin.values()];
  for (const r of readings) {
    if (r.fr) r.fr = r.fr.slice(0, MAX_DEFS);
    // L'anglais ne sert que de secours quand le français manque
    if (r.fr?.length) delete r.en;
    else if (r.en) r.en = r.en.slice(0, MAX_DEFS);
  }
  const prefIndex = (r: Reading) => {
    const i = preferred.findIndex((p) => p.toLowerCase() === r.p.toLowerCase());
    return i < 0 ? preferred.length : i;
  };
  const score = (r: Reading) =>
    prefIndex(r) * 10 +
    (r.fr?.length ? 0 : 4) +
    (r.p === r.p.toLowerCase() ? 0 : 2) +
    ((r.fr ?? r.en ?? []).every((d) => LOW_PRIORITY.test(d)) ? 1 : 0);
  return readings.sort((a, b) => score(a) - score(b));
}

// ---------------------------------------------------------------------------
// Mots

console.log('Construction des mots...');
const simplifiedSet = new Set<string>();
for (const k of [...cfdict.keys(), ...cedict.keys(), ...hsk.map((h) => h.simplified)]) for (const ch of k) simplifiedSet.add(ch);

const hskByWord = new Map<string, HskWord>();
for (const h of hsk) hskByWord.set(h.simplified, h);

const strokeFile = (ch: string) => `${STROKES_SRC}/${ch}.json`;
const catalogChars = new Set<string>(
  [...mmah.keys()].filter((ch) => isHan(ch) && simplifiedSet.has(ch) && existsSync(strokeFile(ch))),
);

const candidates = new Set<string>();
for (const h of hsk) candidates.add(h.simplified);
for (const w of cfdict.keys()) if ([...w].length > 1) candidates.add(w);
for (const w of cedict.keys()) {
  const rank = wordRank.get(w);
  if ([...w].length > 1 && rank && rank <= EN_ONLY_WORD_TOP) candidates.add(w);
}
for (const [w, rank] of wordRank) {
  if ([...w].length === 1 && rank <= SINGLE_CHAR_WORD_TOP && (cfdict.has(w) || cedict.has(w))) candidates.add(w);
}

const words: WordEntry[] = [];
for (const w of candidates) {
  if (!allHan(w) || ![...w].every((ch) => catalogChars.has(ch))) continue;
  const h = hskByWord.get(w);
  const hskPinyins = h?.forms.map((f) => f.transcriptions.numeric.replace(/u:/g, 'ü')) ?? [];
  let rd = buildReadings(w, hskPinyins);
  if (!rd.length && h) {
    rd = h.forms.map((f) => ({ p: f.transcriptions.numeric, en: f.meanings.slice(0, MAX_DEFS) }));
  }
  if (!rd.length) continue;
  const entry: WordEntry = { w, rd };
  const f = wordRank.get(w);
  if (f) entry.f = f;
  const level = h && hskLevel(h.level);
  if (level) entry.h = level;
  const cl = new Set<string>();
  for (const e of [...(cfdict.get(w) ?? []), ...(cedict.get(w) ?? [])]) e.classifiers.forEach((c) => cl.add(c));
  h?.forms.forEach((form) => form.classifiers.forEach((c) => cl.add(c)));
  if (cl.size) entry.cl = [...cl].filter(allHan).slice(0, 4);
  if (!entry.cl?.length) delete entry.cl;
  words.push(entry);
}
// Ordre : fréquents d'abord, puis HSK, puis le reste
words.sort((a, b) => (a.f ?? 1e9) - (b.f ?? 1e9) || (a.h ?? 99) - (b.h ?? 99) || (a.w < b.w ? -1 : 1));

// ---------------------------------------------------------------------------
// Caractères

console.log('Construction des caractères...');
/** Premier niveau HSK où chaque caractère apparaît (dans un mot du niveau). */
const charHsk = new Map<string, number>();
for (const h of hsk) {
  const level = hskLevel(h.level);
  if (!level) continue;
  for (const ch of h.simplified) if (!charHsk.has(ch) || charHsk.get(ch)! > level) charHsk.set(ch, level);
}

const chars: CharEntry[] = [];
for (const ch of catalogChars) {
  const m = mmah.get(ch)!;
  let rd = buildReadings(ch, m.pinyin.map(markedToNumeric));
  if (!rd.length) {
    rd = m.pinyin.map((p) => ({ p: markedToNumeric(p), ...(m.definition ? { en: [m.definition] } : {}) }));
  }
  const strokes = JSON.parse(readFileSync(strokeFile(ch), 'utf8')) as { strokes: string[] };
  const entry: CharEntry = { c: ch, rd, n: strokes.strokes.length, r: m.radical, d: m.decomposition, sh: 0 };
  const freq = charRank.get(ch);
  if (freq) {
    entry.f = freq.rank;
    entry.pm = Math.round(freq.perMillion * 100) / 100;
  }
  const level = charHsk.get(ch);
  if (level) entry.h = level;
  if (m.etymology) {
    const e = m.etymology;
    entry.e = { t: e.type };
    if (e.hint) entry.e.h = e.hint;
    if (e.semantic) entry.e.s = e.semantic;
    if (e.phonetic) entry.e.p = e.phonetic;
  }
  chars.push(entry);
}
chars.sort((a, b) => (a.f ?? 1e9) - (b.f ?? 1e9) || (a.h ?? 99) - (b.h ?? 99) || (a.c < b.c ? -1 : 1));

// ---------------------------------------------------------------------------
// Écriture

console.log('Écriture des fichiers...');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/strokes`, { recursive: true });

let shardCount = 0;
for (let i = 0; i < chars.length; i += SHARD_SIZE) {
  const shard = shardCount++;
  const data: Record<string, unknown> = {};
  for (const entry of chars.slice(i, i + SHARD_SIZE)) {
    entry.sh = shard;
    data[entry.c] = JSON.parse(readFileSync(strokeFile(entry.c), 'utf8'));
  }
  writeFileSync(`${OUT}/strokes/s${String(shard).padStart(2, '0')}.json`, JSON.stringify(data));
}

writeFileSync(`${OUT}/chars.json`, JSON.stringify(chars));
writeFileSync(`${OUT}/words.json`, JSON.stringify(words));

const meta: DataMeta = {
  version: new Date().toISOString().slice(0, 10),
  chars: chars.length,
  words: words.length,
  shards: shardCount,
  shardSize: SHARD_SIZE,
};
writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));

// ---------------------------------------------------------------------------
// Rapport

const withFr = (list: { rd: Reading[] }[]) => list.filter((x) => x.rd.some((r) => r.fr?.length)).length;
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)} %`;
const hskWords = words.filter((w) => w.h);
const size = (f: string) => `${(readFileSync(`${OUT}/${f}`).length / 1024 / 1024).toFixed(2)} Mo`;
console.log(`
Caractères : ${chars.length} (avec français : ${pct(withFr(chars), chars.length)}, top 3000 avec français : ${pct(withFr(chars.slice(0, 3000)), 3000)})
Mots       : ${words.length} (avec français : ${pct(withFr(words), words.length)})
Mots HSK   : ${hskWords.length} / ${hsk.length} (avec français : ${pct(withFr(hskWords), hskWords.length)})
Paquets de tracés : ${shardCount}
Tailles : chars.json ${size('chars.json')}, words.json ${size('words.json')}
`);
