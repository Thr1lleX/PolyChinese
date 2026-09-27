// Mes listes : listes personnelles, niveaux HSK, mots débloqués.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { unlockedWords } from '../data/unlocked';
import { knownChars, useDecks, useItemsMap } from '../db/hooks';
import { TRIAGE_LABELS, type TriageStatus } from '../db/model';

export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7];
export const hskLabel = (level: number) => (level === 7 ? 'HSK 7-9' : `HSK ${level}`);

export function DecksScreen() {
  const catalog = useCatalog();
  const decks = useDecks();
  const items = useItemsMap();

  const statusCounts = useMemo(() => {
    const counts = new Map<TriageStatus, number>();
    for (const it of items?.values() ?? []) counts.set(it.triage, (counts.get(it.triage) ?? 0) + 1);
    return counts;
  }, [items]);

  const known = useMemo(() => knownChars(items), [items]);
  const unlockedCount = useMemo(
    () => (items ? unlockedWords(catalog.words, known, new Set(items.keys())).length : 0),
    [catalog, known, items],
  );

  const hsk = useMemo(
    () =>
      HSK_LEVELS.map((level) => {
        const chars = catalog.chars.filter((c) => c.h === level);
        const mine = chars.filter((c) => known.has(c.c)).length;
        return { level, total: chars.length, mine };
      }),
    [catalog, known],
  );

  if (!decks || !items) return null;

  return (
    <div className="screen">
      <div className="title-row">
        <h1>Mes listes</h1>
        <Link to="/importer" className="button-link primary">
          ＋ Importer
        </Link>
      </div>

      {items.size > 0 ? (
        <p className="status-summary">
          {items.size} élément{items.size > 1 ? 's' : ''} :{' '}
          {(['known', 'fuzzy', 'relearn', 'new', 'pending'] as const)
            .filter((s) => statusCounts.get(s))
            .map((s) => (
              <span key={s}>
                <span className={`status-dot status-${s}`} /> {statusCounts.get(s)} {TRIAGE_LABELS[s].toLowerCase()}
              </span>
            ))}
        </p>
      ) : (
        <div className="callout">
          Commencez par importer les caractères que vous connaissez déjà : collez-les, puis triez-les en quelques minutes.
        </div>
      )}

      {decks.length > 0 && (
        <section>
          <h2>Listes personnelles</h2>
          <ul className="deck-list">
            {decks.map((d) => {
              const pending = d.itemKeys.filter((k) => items.get(k)?.triage === 'pending').length;
              return (
                <li key={d.id}>
                  <Link to={`/listes/${d.id}`} className="deck-card">
                    <span className="deck-name">{d.name}</span>
                    <span className="muted">
                      {d.itemKeys.length} élément{d.itemKeys.length > 1 ? 's' : ''}
                      {pending > 0 && <span className="pending-badge"> · {pending} à trier</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2>Mots débloqués</h2>
        <Link to="/listes/debloques" className="deck-card">
          <span className="deck-name">
            {unlockedCount} mot{unlockedCount > 1 ? 's' : ''} courant{unlockedCount > 1 ? 's' : ''}
          </span>
          <span className="muted">dont vous connaissez déjà tous les caractères</span>
        </Link>
      </section>

      <section>
        <h2>Catalogue HSK 3.0</h2>
        <ul className="deck-list">
          {hsk.map(({ level, total, mine }) => (
            <li key={level}>
              <Link to={`/listes/hsk/${level}`} className="deck-card">
                <span className="deck-name">{hskLabel(level)}</span>
                <span className="muted">
                  {mine} / {total} caractères connus
                </span>
                <span className="mini-progress">
                  <span style={{ width: `${(mine / Math.max(1, total)) * 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
