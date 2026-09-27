import { useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import type { SearchResult } from '../data/catalog';
import { useDecks, useItemsMap } from '../db/hooks';
import type { UserItem } from '../db/model';
import { Definitions } from '../ui/Definitions';
import { CharGrid } from '../ui/ItemLists';
import { StatusDot } from '../ui/ItemStatus';
import { Pinyin } from '../ui/Pinyin';
import { HSK_LEVELS, hskLabel } from './DecksScreen';

export function HomeScreen() {
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const deferred = useDeferredValue(query);
  const results = useMemo(() => catalog.search(deferred), [catalog, deferred]);
  const items = useItemsMap();
  const decks = useDecks();
  const pendingDeck = decks
    ?.map((d) => ({ deck: d, pending: d.itemKeys.filter((k) => items?.get(k)?.triage === 'pending').length }))
    .find((d) => d.pending > 0);

  return (
    <div className="screen">
      <input
        className="search"
        type="search"
        placeholder="Rechercher : 学, xue2, xué, étudier…"
        value={query}
        autoFocus={matchMedia('(pointer: fine)').matches}
        onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        aria-label="Rechercher un caractère ou un mot"
      />

      {query ? (
        <SearchResults results={results} items={items} />
      ) : (
        <>
          {pendingDeck && (
            <div className="callout">
              Tri en cours : {pendingDeck.pending} élément{pendingDeck.pending > 1 ? 's' : ''} restant
              {pendingDeck.pending > 1 ? 's' : ''} dans « {pendingDeck.deck.name} ».
              <div className="actions-row compact">
                <Link to={`/tri/${pendingDeck.deck.id}`} className="button-link primary">
                  Reprendre le tri
                </Link>
              </div>
            </div>
          )}
          {items && items.size === 0 && (
            <div className="callout">
              <strong>Bienvenue !</strong> Commencez par importer les caractères que vous connaissez déjà : collez-les,
              puis triez-les en quelques minutes.
              <div className="actions-row compact">
                <Link to="/importer" className="button-link primary">
                  Importer mes caractères
                </Link>
              </div>
            </div>
          )}
          <section>
            <h2>Parcourir par niveau</h2>
            <div className="filter-chips">
              {HSK_LEVELS.map((l) => (
                <Link key={l} to={`/listes/hsk/${l}`} className="chip-link">
                  {hskLabel(l)}
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h2>Les 120 caractères les plus fréquents</h2>
            <CharGrid chars={catalog.chars.slice(0, 120)} items={items} />
          </section>
          <p className="muted small center footer-links">
            <Link to="/a-propos">À propos, sources et licences</Link>
          </p>
        </>
      )}
    </div>
  );
}

function SearchResults({ results, items }: { results: SearchResult[]; items?: Map<string, UserItem> }) {
  if (!results.length) return <p className="muted">Aucun résultat.</p>;
  return (
    <ul className="result-list">
      {results.map((r) => {
        const text = r.kind === 'char' ? r.entry.c : r.entry.w;
        const reading = r.entry.rd[0];
        return (
          <li key={r.kind + text}>
            <Link to={r.kind === 'char' ? `/c/${text}` : `/w/${text}`} className="result">
              <span className="hanzi result-hanzi">{text}</span>
              <span className="result-body">
                <Pinyin numeric={reading.p} />
                <Definitions reading={reading} max={3} />
              </span>
              <span className="result-kind">
                <StatusDot status={items?.get(`${r.kind === 'char' ? 'c' : 'w'}:${text}`)?.triage} />
                {r.kind === 'char' ? 'caractère' : 'mot'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
