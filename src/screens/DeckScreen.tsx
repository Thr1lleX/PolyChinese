// Détail d'une liste personnelle.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import type { CharEntry, WordEntry } from '../data/types';
import { useDeck, useItemsMap } from '../db/hooks';
import { TRIAGE_LABELS, parseItemKey, type TriageStatus } from '../db/model';
import { deleteDeck, renameDeck } from '../db/repo';
import { CharGrid, WordRows } from '../ui/ItemLists';

export function DeckScreen() {
  const { deckId = '' } = useParams();
  const deck = useDeck(Number(deckId));
  const items = useItemsMap();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TriageStatus | 'all'>('all');
  const [editing, setEditing] = useState(false);

  if (deck === undefined || !items) return null;
  if (deck === null) return <p className="screen">Liste introuvable.</p>;

  const keys = deck.itemKeys.filter((k) => filter === 'all' || items.get(k)?.triage === filter);
  const chars = keys.map(parseItemKey).filter((p) => p.kind === 'char').map((p) => catalog.char(p.text)).filter((c): c is CharEntry => !!c);
  const words = keys.map(parseItemKey).filter((p) => p.kind === 'word').map((p) => catalog.word(p.text)).filter((w): w is WordEntry => !!w);
  const pending = deck.itemKeys.filter((k) => items.get(k)?.triage === 'pending').length;
  const present = new Set(deck.itemKeys.map((k) => items.get(k)?.triage).filter(Boolean));

  return (
    <div className="screen">
      <p>
        <Link to="/listes">← Mes listes</Link>
      </p>
      {editing ? (
        <form
          className="title-row"
          onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name')?.toString().trim();
            if (name) renameDeck(deck.id!, name);
            setEditing(false);
          }}
        >
          <input name="name" type="text" defaultValue={deck.name} autoFocus />
          <button className="primary">OK</button>
        </form>
      ) : (
        <div className="title-row">
          <h1>{deck.name}</h1>
          <button className="link-button" onClick={() => setEditing(true)}>
            Renommer
          </button>
        </div>
      )}

      {pending > 0 && (
        <div className="callout">
          {pending} élément{pending > 1 ? 's' : ''} à trier.
          <div className="actions-row compact">
            <Link to={`/tri/${deck.id}`} className="button-link primary">
              Trier maintenant
            </Link>
          </div>
        </div>
      )}

      <div className="filter-chips">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          Tous ({deck.itemKeys.length})
        </button>
        {(['known', 'fuzzy', 'relearn', 'new', 'pending'] as const)
          .filter((s) => present.has(s))
          .map((s) => (
            <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
              <span className={`status-dot status-${s}`} /> {TRIAGE_LABELS[s]}
            </button>
          ))}
      </div>

      {chars.length > 0 && (
        <section>
          <h2>Caractères ({chars.length})</h2>
          <CharGrid chars={chars} items={items} />
        </section>
      )}
      {words.length > 0 && (
        <section>
          <h2>Mots ({words.length})</h2>
          <WordRows words={words} items={items} />
        </section>
      )}

      <div className="actions-row">
        <button
          className="danger"
          onClick={async () => {
            if (!confirm(`Supprimer la liste « ${deck.name} » ? Les éléments déjà triés restent dans vos éléments.`)) return;
            await deleteDeck(deck.id!);
            navigate('/listes');
          }}
        >
          Supprimer la liste
        </button>
      </div>
    </div>
  );
}
