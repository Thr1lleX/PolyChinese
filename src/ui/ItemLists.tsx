import { Link } from 'react-router-dom';
import type { Mastery } from '../db/mastery';
import type { CharEntry, WordEntry } from '../data/types';
import { Definitions } from './Definitions';
import { StatusDot } from './ItemStatus';
import { Pinyin } from './Pinyin';

/** Grille de caractères, avec pastille de statut si l'élément est dans « mes éléments ». */
export function CharGrid({ chars, status, small }: { chars: CharEntry[]; status?: Map<string, Mastery>; small?: boolean }) {
  return (
    <div className={`char-grid ${small ? 'small' : ''}`}>
      {chars.map((c) => (
        <Link key={c.c} to={`/c/${c.c}`} className="char-tile">
          <StatusDot status={status?.get(`c:${c.c}`)} />
          <span className="hanzi">{c.c}</span>
          <Pinyin numeric={c.rd[0].p} />
        </Link>
      ))}
    </div>
  );
}

/** Liste de mots (ligne : mot, pinyin, traduction, statut). */
export function WordRows({ words, status, max = 2 }: { words: WordEntry[]; status?: Map<string, Mastery>; max?: number }) {
  return (
    <ul className="word-list">
      {words.map((w) => (
        <li key={w.w}>
          <Link to={`/w/${w.w}`} className="result">
            <span className="hanzi result-hanzi">{w.w}</span>
            <span className="result-body">
              <Pinyin numeric={w.rd[0].p} />
              <Definitions reading={w.rd[0]} max={max} />
            </span>
            <StatusDot status={status?.get(`w:${w.w}`)} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
