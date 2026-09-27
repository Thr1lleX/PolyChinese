import { useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import type { SearchResult } from '../data/catalog';
import { useItemsMap } from '../db/hooks';
import type { UserItem } from '../db/model';
import { Definitions } from '../ui/Definitions';
import { CharGrid } from '../ui/ItemLists';
import { StatusDot } from '../ui/ItemStatus';
import { Pinyin } from '../ui/Pinyin';
import { HSK_LEVELS, hskLabel } from './DecksScreen';

export function SearchScreen() {
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const deferred = useDeferredValue(query);
  const results = useMemo(() => catalog.search(deferred), [catalog, deferred]);
  const items = useItemsMap();

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
