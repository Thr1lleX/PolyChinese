import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { Definitions, SpeakButton } from '../ui/Definitions';
import { Pinyin, ToneHanzi } from '../ui/Pinyin';

export function WordScreen() {
  const { word = '' } = useParams();
  const catalog = useCatalog();
  const entry = catalog.word(word);

  if (!entry) {
    return (
      <div className="screen">
        <p>Mot « {word} » introuvable dans le catalogue.</p>
        <Link to="/">Retour à la recherche</Link>
      </div>
    );
  }

  const main = entry.rd[0];
  return (
    <div className="screen">
      <div className="word-head">
        <ToneHanzi text={entry.w} numeric={main.p} className="word-big" />
        <div className="reading-line">
          <Pinyin numeric={main.p} className="big" />
          <SpeakButton text={entry.w} />
        </div>
      </div>

      {entry.rd.map((r, i) => (
        <div key={r.p} className={i === 0 ? 'reading main' : 'reading'}>
          {i > 0 && <Pinyin numeric={r.p} />}
          <Definitions reading={r} />
        </div>
      ))}

      <div className="tags">
        {entry.h && <span className="tag">HSK {entry.h === 7 ? '7-9' : entry.h}</span>}
        {entry.f && <span className="tag">Fréquence n° {entry.f}</span>}
        {entry.cl && (
          <span className="tag">
            Classificateur{entry.cl.length > 1 ? 's' : ''} :{' '}
            {entry.cl.map((c) => (
              <Link key={c} to={`/c/${c}`} className="hanzi char-link">
                {c}
              </Link>
            ))}
          </span>
        )}
      </div>

      <section>
        <h2>Caractères</h2>
        <ul className="word-list">
          {[...entry.w].map((ch, i) => {
            const c = catalog.char(ch);
            if (!c) return null;
            return (
              <li key={i}>
                <Link to={`/c/${ch}`} className="result">
                  <span className="hanzi result-hanzi">{ch}</span>
                  <span className="result-body">
                    <Pinyin numeric={c.rd[0].p} />
                    <Definitions reading={c.rd[0]} max={3} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
