// Niveau HSK : caractères et mots, avec statut, et tri de ce qu'on connaît déjà.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { useItemsMap } from '../db/hooks';
import { itemKey } from '../db/model';
import { addToDeck } from '../db/repo';
import { CharGrid, WordRows } from '../ui/ItemLists';
import { hskLabel } from './DecksScreen';

export function HskScreen() {
  const { level: levelParam = '1' } = useParams();
  const level = Number(levelParam);
  const catalog = useCatalog();
  const items = useItemsMap();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'char' | 'word'>('char');

  const chars = useMemo(() => catalog.chars.filter((c) => c.h === level), [catalog, level]);
  const words = useMemo(() => catalog.words.filter((w) => w.h === level && w.w.length > 1), [catalog, level]);

  if (!items) return null;
  const list = tab === 'char' ? chars.map((c) => c.c) : words.map((w) => w.w);
  const notMine = list.filter((t) => !items.has(itemKey(tab, t)));

  const triage = async () => {
    const name = `${hskLabel(level)} — ${tab === 'char' ? 'caractères' : 'mots'}`;
    const { deckId } = await addToDeck(name, notMine.map((text) => ({ kind: tab, text })));
    navigate(`/tri/${deckId}`);
  };

  return (
    <div className="screen">
      <p>
        <Link to="/listes">← Mes listes</Link>
      </p>
      <h1>{hskLabel(level)}</h1>
      <div className="segmented">
        <button className={tab === 'char' ? 'active' : ''} onClick={() => setTab('char')}>
          Caractères ({chars.length})
        </button>
        <button className={tab === 'word' ? 'active' : ''} onClick={() => setTab('word')}>
          Mots ({words.length})
        </button>
      </div>

      {notMine.length > 0 && (
        <div className="callout">
          {notMine.length} {tab === 'char' ? 'caractères' : 'mots'} de ce niveau ne sont pas encore dans vos éléments.
          <div className="actions-row compact">
            <button className="primary" onClick={triage}>
              Trier ceux que je connais déjà
            </button>
          </div>
        </div>
      )}

      {tab === 'char' ? <CharGrid chars={chars} items={items} /> : <WordRows words={words} items={items} />}
    </div>
  );
}
