// Format des données de référence produites par scripts/prepare-data.ts (public/data/).
// Les clés sont courtes pour limiter la taille des fichiers.

export interface Reading {
  /** Pinyin numérique, ex. « xue2 sheng5 » */
  p: string;
  /** Traductions françaises (CFDICT) */
  fr?: string[];
  /** Traductions anglaises (CC-CEDICT), seulement si pas de français */
  en?: string[];
}

export interface Etymology {
  /** ideographic | pictographic | pictophonetic */
  t: string;
  /** Indice (en anglais, Make Me a Hanzi) */
  h?: string;
  /** Composant sémantique */
  s?: string;
  /** Composant phonétique */
  p?: string;
}

export interface CharEntry {
  c: string;
  /** Lectures, la plus courante en premier */
  rd: Reading[];
  /** Nombre de traits */
  n: number;
  /** Radical */
  r: string;
  /** Décomposition (description idéographique, ex. « ⿰女马 ») */
  d: string;
  e?: Etymology;
  /** Rang de fréquence SUBTLEX-CH (1 = le plus fréquent) */
  f?: number;
  /** Occurrences par million de caractères */
  pm?: number;
  /** Premier niveau HSK 3.0 où le caractère apparaît (7 = niveaux 7-9) */
  h?: number;
  /** Paquet de tracés (public/data/strokes/sNN.json) */
  sh: number;
}

export interface WordEntry {
  w: string;
  rd: Reading[];
  /** Rang de fréquence SUBTLEX-CH */
  f?: number;
  /** Niveau HSK 3.0 */
  h?: number;
  /** Classificateurs (spécificatifs) */
  cl?: string[];
}

export interface DataMeta {
  version: string;
  chars: number;
  words: number;
  shards: number;
  shardSize: number;
}
