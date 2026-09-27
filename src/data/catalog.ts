// Catalogue des caractères et des mots (données de référence, en lecture seule).
import { stripTones } from '../lib/pinyin';
import type { CharEntry, DataMeta, Reading, WordEntry } from './types';

export class Catalog {
  readonly chars: CharEntry[];
  readonly words: WordEntry[];
  readonly meta: DataMeta;
  private readonly charMap: Map<string, CharEntry>;
  private readonly wordMap: Map<string, WordEntry>;
  private wordsByCharIndex?: Map<string, WordEntry[]>;
  private componentIndex?: Map<string, CharEntry[]>;
  private searchIndex?: SearchRow[];

  constructor(chars: CharEntry[], words: WordEntry[], meta: DataMeta) {
    this.chars = chars;
    this.words = words;
    this.meta = meta;
    this.charMap = new Map(chars.map((c) => [c.c, c]));
    this.wordMap = new Map(words.map((w) => [w.w, w]));
  }

  char(c: string): CharEntry | undefined {
    return this.charMap.get(c);
  }

  word(w: string): WordEntry | undefined {
    return this.wordMap.get(w);
  }

  /** Mots de plusieurs caractères contenant `c`, les plus fréquents d'abord. */
  wordsWithChar(c: string, limit = 12): WordEntry[] {
    if (!this.wordsByCharIndex) {
      const index = new Map<string, WordEntry[]>();
      // this.words est déjà trié par fréquence
      for (const w of this.words) {
        if (w.w.length < 2) continue;
        for (const ch of new Set(w.w)) {
          let list = index.get(ch);
          if (!list) index.set(ch, (list = []));
          list.push(w);
        }
      }
      this.wordsByCharIndex = index;
    }
    return (this.wordsByCharIndex.get(c) ?? []).slice(0, limit);
  }

  /**
   * Mot courant servant de contexte à un caractère (« 学 dans 学生 ») :
   * court, traduit en français, de préférence du HSK.
   */
  contextWord(c: string): WordEntry | undefined {
    const candidates = this.wordsWithChar(c, 40).filter((w) => w.w.length <= 3 && w.rd[0].fr?.length);
    return candidates.find((w) => w.h && w.h <= 4) ?? candidates[0];
  }

  /** Caractères dont la décomposition contient `component`, les plus fréquents d'abord. */
  charsWithComponent(component: string, limit = 16): CharEntry[] {
    if (!this.componentIndex) {
      const index = new Map<string, CharEntry[]>();
      for (const c of this.chars) {
        for (const part of new Set(c.d)) {
          if (part === c.c) continue;
          let list = index.get(part);
          if (!list) index.set(part, (list = []));
          list.push(c);
        }
      }
      this.componentIndex = index;
    }
    return (this.componentIndex.get(component) ?? []).slice(0, limit);
  }

  /**
   * Recherche par caractères chinois, pinyin (avec ou sans tons, « xue2 » ou « xué ») ou français.
   */
  search(query: string, limit = 40): SearchResult[] {
    const q = query.trim();
    if (!q) return [];

    if (/[㐀-鿿]/.test(q)) return this.searchHanzi(q, limit);

    const rows = (this.searchIndex ??= this.buildSearchIndex());
    const hasToneDigits = /[1-5]/.test(q);
    const qNumeric = q.toLowerCase().replace(/\s+/g, '').replace(/u:|v/g, 'ü');
    const qPinyin = stripTones(q);
    const qText = foldText(q);
    const scored: { row: SearchRow; score: number }[] = [];

    for (const row of rows) {
      let score = Infinity;
      if (hasToneDigits) {
        if (row.numeric.some((n) => n === qNumeric)) score = 0;
        else if (row.numeric.some((n) => n.startsWith(qNumeric))) score = 2;
      } else {
        if (row.plain.some((p) => p === qPinyin)) score = 0;
        else if (qPinyin.length >= 2 && row.plain.some((p) => p.startsWith(qPinyin))) score = 2;
        if (qText.length >= 2) {
          const i = row.text.indexOf(qText);
          if (i >= 0) {
            const before = row.text[i - 1];
            const after = row.text[i + qText.length];
            const wholeWord = (!before || !/[a-z]/.test(before)) && (!after || !/[a-z]/.test(after));
            score = Math.min(score, wholeWord ? 1 : 3);
          }
        }
      }
      if (score < Infinity) scored.push({ row, score });
    }

    scored.sort((a, b) => a.score - b.score || a.row.rank - b.row.rank);
    return scored.slice(0, limit).map(({ row }) => row.result);
  }

  private searchHanzi(q: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    const push = (r: SearchResult) => {
      const key = r.kind + (r.kind === 'char' ? r.entry.c : r.entry.w);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(r);
      }
    };
    const exact = this.word(q);
    if (exact) push({ kind: 'word', entry: exact });
    if ([...q].length === 1) {
      const c = this.char(q);
      if (c) push({ kind: 'char', entry: c });
    }
    for (const w of this.words) {
      if (results.length >= limit) break;
      if (w.w !== q && w.w.startsWith(q)) push({ kind: 'word', entry: w });
    }
    for (const ch of new Set(q)) {
      const c = this.char(ch);
      if (c) push({ kind: 'char', entry: c });
    }
    for (const w of this.words) {
      if (results.length >= limit) break;
      if (w.w.length > 1 && w.w.includes(q)) push({ kind: 'word', entry: w });
    }
    return results.slice(0, limit);
  }

  private buildSearchIndex(): SearchRow[] {
    const rows: SearchRow[] = [];
    const describe = (rd: Reading[]) => ({
      numeric: rd.map((r) => r.p.toLowerCase().replace(/\s+/g, '')),
      plain: rd.map((r) => stripTones(r.p)),
      text: foldText(rd.flatMap((r) => r.fr ?? r.en ?? []).join(' | ')),
    });
    // Les mots d'un seul caractère font doublon avec les caractères : on garde les caractères.
    for (const c of this.chars) rows.push({ result: { kind: 'char', entry: c }, rank: c.f ?? 1e6, ...describe(c.rd) });
    for (const w of this.words) {
      if (w.w.length < 2) continue;
      rows.push({ result: { kind: 'word', entry: w }, rank: w.f ?? 1e6, ...describe(w.rd) });
    }
    return rows;
  }
}

export type SearchResult = { kind: 'char'; entry: CharEntry } | { kind: 'word'; entry: WordEntry };

interface SearchRow {
  result: SearchResult;
  rank: number;
  numeric: string[];
  plain: string[];
  text: string;
}

/** Minuscules sans accents, pour comparer du texte français. */
function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

let loading: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  loading ??= (async () => {
    const base = `${import.meta.env.BASE_URL}data/`;
    const get = async <T,>(file: string): Promise<T> => {
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(`${file} : HTTP ${res.status}`);
      return res.json() as Promise<T>;
    };
    const [chars, words, meta] = await Promise.all([
      get<CharEntry[]>('chars.json'),
      get<WordEntry[]>('words.json'),
      get<DataMeta>('meta.json'),
    ]);
    return new Catalog(chars, words, meta);
  })();
  loading.catch(() => (loading = undefined));
  return loading;
}
