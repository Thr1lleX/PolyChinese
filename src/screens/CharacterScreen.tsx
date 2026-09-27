import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import type { CharEntry } from '../data/types';
import { Definitions, SpeakButton } from '../ui/Definitions';
import { Pinyin } from '../ui/Pinyin';
import { CharacterAnimation } from '../writing/CharacterAnimation';
import { StrokeOrder } from '../writing/StrokeOrder';

const IDS = /[⿰-⿿？]/;

export function CharacterScreen() {
  const { char = '' } = useParams();
  const catalog = useCatalog();
  const entry = catalog.char(char);

  if (!entry) {
    return (
      <div className="screen">
        <p>Caractère « {char} » introuvable dans le catalogue.</p>
        <Link to="/">Retour à la recherche</Link>
      </div>
    );
  }

  const words = catalog.wordsWithChar(entry.c, 10);
  const containing = catalog.charsWithComponent(entry.c, 16);
  const phonetic = entry.e?.p;
  // Caractères où le même composant joue aussi le rôle phonétique (souvent une prononciation proche)
  const samePhonetic = phonetic
    ? catalog
        .charsWithComponent(phonetic, 200)
        .filter((c) => c.c !== entry.c && c.e?.p === phonetic)
        .slice(0, 16)
    : [];

  return (
    <div className="screen">
      <div className="entry-head">
        <CharacterAnimation key={entry.c} entry={entry} />
        <div className="entry-info">
          {entry.rd.map((r, i) => (
            <div key={r.p} className={i === 0 ? 'reading main' : 'reading'}>
              <div className="reading-line">
                <Pinyin numeric={r.p} className={i === 0 ? 'big' : ''} />
                {i === 0 && <SpeakButton text={entry.c} />}
              </div>
              <Definitions reading={r} />
            </div>
          ))}
          <div className="tags">
            <span className="tag">{entry.n} traits</span>
            <span className="tag">
              Radical <CharLink c={entry.r} />
            </span>
            {entry.h && <span className="tag">HSK {entry.h === 7 ? '7-9' : entry.h}</span>}
            {entry.f && <span className="tag">Fréquence n° {entry.f}</span>}
          </div>
        </div>
      </div>

      <section>
        <h2>Ordre des traits</h2>
        <StrokeOrder key={entry.c} entry={entry} />
      </section>

      <section>
        <h2>Composition</h2>
        <Composition entry={entry} />
      </section>

      {words.length > 0 && (
        <section>
          <h2>Mots courants</h2>
          <ul className="word-list">
            {words.map((w) => (
              <li key={w.w}>
                <Link to={`/w/${w.w}`} className="result">
                  <span className="hanzi result-hanzi">{w.w}</span>
                  <span className="result-body">
                    <Pinyin numeric={w.rd[0].p} />
                    <Definitions reading={w.rd[0]} max={2} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {containing.length > 0 && (
        <section>
          <h2>Caractères contenant {entry.c}</h2>
          <CharRow chars={containing} />
        </section>
      )}

      {samePhonetic.length > 0 && (
        <section>
          <h2>Même composant phonétique : {phonetic}</h2>
          <CharRow chars={samePhonetic} />
        </section>
      )}
    </div>
  );
}

function Composition({ entry }: { entry: CharEntry }) {
  const catalog = useCatalog();
  const parts = [...entry.d].filter((p) => !IDS.test(p) && p !== entry.c);
  const e = entry.e;
  return (
    <div className="composition">
      {parts.length > 0 ? (
        <p>
          Composants :{' '}
          {parts.map((p, i) => (
            <span key={i} className="component">
              {catalog.char(p) ? <CharLink c={p} /> : <span className="hanzi">{p}</span>}
            </span>
          ))}
        </p>
      ) : (
        <p className="muted">Caractère simple (pas de décomposition).</p>
      )}
      {e?.t === 'pictophonetic' && (
        <p>
          <strong>Idéophonogramme</strong> :{' '}
          {e.s && (
            <>
              <CharLink c={e.s} /> donne le sens
            </>
          )}
          {e.s && e.p && ', '}
          {e.p && (
            <>
              <CharLink c={e.p} /> donne le son
              {catalog.char(e.p) && (
                <>
                  {' '}
                  (<Pinyin numeric={catalog.char(e.p)!.rd[0].p} />)
                </>
              )}
            </>
          )}
          .
        </p>
      )}
      {e?.t === 'pictographic' && (
        <p>
          <strong>Pictogramme</strong> : dessin stylisé de ce qu'il représente.
        </p>
      )}
      {e?.t === 'ideographic' && (
        <p>
          <strong>Idéogramme</strong> : le sens naît de l'association de ses composants.
        </p>
      )}
      {e?.h && e.t !== 'pictophonetic' && (
        <p className="muted">
          <span className="badge">EN</span> {e.h}
        </p>
      )}
    </div>
  );
}

function CharLink({ c }: { c: string }) {
  const catalog = useCatalog();
  if (!catalog.char(c)) return <span className="hanzi">{c}</span>;
  return (
    <Link to={`/c/${c}`} className="hanzi char-link">
      {c}
    </Link>
  );
}

function CharRow({ chars }: { chars: CharEntry[] }) {
  return (
    <div className="char-grid small">
      {chars.map((c) => (
        <Link key={c.c} to={`/c/${c.c}`} className="char-tile">
          <span className="hanzi">{c.c}</span>
          <Pinyin numeric={c.rd[0].p} />
        </Link>
      ))}
    </div>
  );
}
