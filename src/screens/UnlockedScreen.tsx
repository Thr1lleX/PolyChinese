// Mots débloqués : mots courants dont tous les caractères sont connus.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { unlockedWords } from '../data/unlocked';
import { useItemsMap, useMasteryMap } from '../db/hooks';
import { knownCharsFrom } from '../db/mastery';
import { addToDeck } from '../db/repo';
import { WordRows } from '../ui/ItemLists';
import { UNLOCKED_DECK_NAME } from './TriageScreen';

const BATCH = 50;
const SHOWN = 200;

export function UnlockedScreen() {
  const catalog = useCatalog();
  const items = useItemsMap();
  const navigate = useNavigate();
  const [hskOnly, setHskOnly] = useState(false);

  const status = useMasteryMap();
  const known = useMemo(() => knownCharsFrom(status), [status]);
  const words = useMemo(
    () => (items ? unlockedWords(catalog.words, known, new Set(items.keys()), { hskOnly }) : []),
    [catalog, known, items, hskOnly],
  );

  if (!items) return null;

  const triage = async () => {
    const { deckId } = await addToDeck(
      UNLOCKED_DECK_NAME,
      words.slice(0, BATCH).map((w) => ({ kind: 'word' as const, text: w.w })),
    );
    navigate(`/tri/${deckId}`);
  };

  return (
    <div className="screen">
      <p>
        <Link to="/listes">← Mes listes</Link>
      </p>
      <h1>Mots débloqués</h1>
      <p className="muted">
        Mots courants dont vous connaissez déjà tous les caractères ({known.size} caractères connus) : ils ne vous coûtent
        que leur sens et leur prononciation. Les plus fréquents d'abord.
      </p>

      {known.size === 0 ? (
        <div className="callout">
          Importez et triez d'abord les caractères que vous connaissez.
          <div className="actions-row compact">
            <Link to="/importer" className="button-link primary">
              Importer
            </Link>
          </div>
        </div>
      ) : (
        <>
          <label className="field checkbox">
            <input type="checkbox" checked={hskOnly} onChange={(e) => setHskOnly(e.target.checked)} />
            <span>Seulement les mots du HSK</span>
          </label>
          {words.length > 0 && (
            <div className="callout">
              <strong>{words.length}</strong> mots débloqués. Vous en connaissez sûrement une partie : triez-les pour que
              l'outil le sache.
              <div className="actions-row compact">
                <button className="primary" onClick={triage}>
                  Trier les {Math.min(BATCH, words.length)} plus fréquents
                </button>
              </div>
            </div>
          )}
          <WordRows words={words.slice(0, SHOWN)} status={status} />
          {words.length > SHOWN && <p className="muted">… et {words.length - SHOWN} autres.</p>}
        </>
      )}
    </div>
  );
}
