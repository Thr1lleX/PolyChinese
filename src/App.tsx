import { useEffect } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CatalogProvider } from './data/CatalogContext';
import { AboutScreen } from './screens/AboutScreen';
import { CharacterPracticeScreen } from './screens/CharacterPracticeScreen';
import { CharacterScreen } from './screens/CharacterScreen';
import { DeckScreen } from './screens/DeckScreen';
import { DecksScreen } from './screens/DecksScreen';
import { HskScreen } from './screens/HskScreen';
import { ImportScreen } from './screens/ImportScreen';
import { TriageScreen } from './screens/TriageScreen';
import { UnlockedScreen } from './screens/UnlockedScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { WordScreen } from './screens/WordScreen';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <header className="app-header">
        <Link to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
          <span>PolyChinese</span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Recherche
          </NavLink>
          <NavLink to="/listes">Listes</NavLink>
          <NavLink to="/ecrire">Écrire</NavLink>
        </nav>
      </header>
      <main>
        <CatalogProvider>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/c/:char" element={<CharacterScreen />} />
            <Route path="/c/:char/ecrire" element={<CharacterPracticeScreen />} />
            <Route path="/ecrire" element={<PracticeScreen />} />
            <Route path="/w/:word" element={<WordScreen />} />
            <Route path="/a-propos" element={<AboutScreen />} />
            <Route path="/listes" element={<DecksScreen />} />
            <Route path="/listes/debloques" element={<UnlockedScreen />} />
            <Route path="/listes/hsk/:level" element={<HskScreen />} />
            <Route path="/listes/:deckId" element={<DeckScreen />} />
            <Route path="/importer" element={<ImportScreen />} />
            <Route path="/tri/:deckId" element={<TriageScreen />} />
            <Route path="*" element={<HomeScreen />} />
          </Routes>
        </CatalogProvider>
      </main>
    </HashRouter>
  );
}
