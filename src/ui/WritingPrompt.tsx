import { useCatalog } from '../data/CatalogContext';
import type { CharEntry } from '../data/types';
import { Definitions, SpeakButton } from './Definitions';
import { Pinyin } from './Pinyin';

/**
 * Consigne d'une carte d'écriture : pinyin, sens et mot de contexte où le caractère est masqué
 * (« tracez 学 dans ＿生 xuésheng, étudiant »). Avec `reveal`, le caractère apparaît dans le mot.
 */
export function WritingPrompt({ entry, reveal = false }: { entry: CharEntry; reveal?: boolean }) {
  const catalog = useCatalog();
  const context = catalog.contextWord(entry.c);
  const reading = entry.rd[0];

  return (
    <div className="writing-prompt">
      <div className="reading-line">
        <Pinyin numeric={reading.p} className="big" />
        <SpeakButton text={context?.w ?? entry.c} label={context ? `Écouter ${context.w}` : 'Écouter'} />
      </div>
      <Definitions reading={reading} max={3} />
      {context && (
        <p className="context-word">
          <span className="hanzi">
            {[...context.w].map((ch, i) =>
              ch === entry.c ? (
                <span key={i} className={reveal ? 'context-target' : 'context-mask'}>
                  {reveal ? ch : '＿'}
                </span>
              ) : (
                <span key={i}>{ch}</span>
              ),
            )}
          </span>{' '}
          <Pinyin numeric={context.rd[0].p} /> <span className="muted">· {context.rd[0].fr?.slice(0, 2).join(' ; ')}</span>
        </p>
      )}
    </div>
  );
}
