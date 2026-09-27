import { useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import type { SearchResult } from '../data/catalog';
import { Definitions } from '../ui/Definitions';
import { Pinyin } from '../ui/Pinyin';

export function HomeScreen() {
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const deferred = useDeferredValue(query);
  const results = useMemo(() => catalog.search(deferred), [catalog, deferred]);

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
        <SearchResults results={results} />
      ) : (
        <section>
          <h2>Les 120 caractères les plus fréquents</h2>
          <div className="char-grid">
            {catalog.chars.slice(0, 120).map((c) => (
              <Link key={c.c} to={`/c/${c.c}`} className="char-tile">
                <span className="hanzi">{c.c}</span>
                <Pinyin numeric={c.rd[0].p} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SearchResults({ results }: { results: SearchResult[] }) {
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
              <span className="result-kind">{r.kind === 'char' ? 'caractère' : 'mot'}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
