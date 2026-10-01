import { parseNumeric } from '../lib/pinyin';

/** Pinyin accentué, chaque syllabe colorée selon son ton. */
export function Pinyin({ numeric, className }: { numeric: string; className?: string }) {
  return (
    <span className={`pinyin ${className ?? ''}`}>
      {parseNumeric(numeric).map((s, i) => (
        <span key={i} className={`tone${s.tone}`}>
          {s.text}
        </span>
      ))}
    </span>
  );
}

/** Caractères chinois colorés selon le ton de chaque syllabe (si le nombre de syllabes correspond). */
export function ToneHanzi({ text, numeric, className }: { text: string; numeric: string; className?: string }) {
  const chars = [...text];
  const syllables = parseNumeric(numeric);
  if (syllables.length !== chars.length) return <span className={`hanzi ${className ?? ''}`}>{text}</span>;
  return (
    <span className={`hanzi ${className ?? ''}`}>
      {chars.map((c, i) => (
        <span key={i} className={`tone${syllables[i].tone}`}>
          {c}
        </span>
      ))}
    </span>
  );
}

/**
 * Signale qu'un caractère se prononce autrement dans ce mot que sa lecture principale
 * (和 hé, mais 暖和 nuǎnhuo → « ici : huo »).
 */
export function ReadingNote({ syllable, main }: { syllable: string | undefined; main: string }) {
  if (!syllable || syllable === main.toLowerCase()) return null;
  return (
    <span className="reading-note" title="Le caractère se prononce autrement dans ce mot">
      (ici : <Pinyin numeric={syllable} />)
    </span>
  );
}
