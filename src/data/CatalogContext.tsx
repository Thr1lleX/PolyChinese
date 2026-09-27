import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadCatalog, type Catalog } from './catalog';

const CatalogContext = createContext<Catalog | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog().then(setCatalog, (e: unknown) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="splash">
        <p>Impossible de charger le dictionnaire.</p>
        <p className="muted">{error}</p>
        <button onClick={() => location.reload()}>Réessayer</button>
      </div>
    );
  }
  if (!catalog) {
    return (
      <div className="splash">
        <div className="splash-mark">汉</div>
        <p className="muted">Chargement du dictionnaire…</p>
      </div>
    );
  }
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error('useCatalog doit être utilisé sous <CatalogProvider>');
  return catalog;
}
