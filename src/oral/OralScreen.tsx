// Oral : dictée de tons et tableau des 20 paires de tons.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { speak, useChineseVoice } from '../audio/speech';
import { useCatalog } from '../data/CatalogContext';
import { Pinyin, ToneHanzi } from '../ui/Pinyin';
import { useComboStats, useTonePool } from './toneData';
import { TONE_NAMES } from './tones';
import { pairExamples } from './toneWords';

export function OralScreen() {
  const voice = useChineseVoice();
  const pool = useTonePool();
  const stats = useComboStats();
  const catalog = useCatalog();
  const [selected, setSelected] = useState<string>('2-3');

  if (!pool || !stats) return null;

  const pct = (combo: string) => {
    const s = stats.get(combo);
    return s && s.attempts ? Math.round((s.correct / s.attempts) * 100) : null;
  };
  const level = (p: number | null) => (p === null ? 'none' : p >= 85 ? 'good' : p >= 60 ? 'mid' : 'bad');
  const totals = [...stats.values()].reduce((t, s) => ({ attempts: t.attempts + s.attempts, correct: t.correct + s.correct }), { attempts: 0, correct: 0 });
  const examples = pairExamples(pool, selected, 6);
  const neutral = selected.endsWith('-0');

  return (
    <div className="screen narrow oral">
      <h1>Oral</h1>

      {!voice && (
        <div className="callout">
          <strong>Aucune voix chinoise sur cet appareil.</strong> Les exercices d'écoute en ont besoin.
          <ul className="steps">
            <li>
              Windows : Paramètres → Heure et langue → Voix → Ajouter des voix → « Chinois (simplifié, Chine) », puis
              redémarrez le navigateur.
            </li>
            <li>Android : Paramètres → Synthèse vocale → moteur Google → installer les données vocales « Chinois (Mandarin) ».</li>
          </ul>
        </div>
      )}

      <section className="session-card">
        <h2>Dictée de tons</h2>
        <p className="muted small">
          Écoutez un mot, retrouvez ses tons. Les paires que vous ratez le plus reviennent plus souvent, et vos mots connus
          sont privilégiés.
          {totals.attempts > 0 && (
            <>
              {' '}
              Réussite récente : <strong>{Math.round((totals.correct / totals.attempts) * 100)} %</strong>.
            </>
          )}
        </p>
        <Link to="/oral/dictee" className="button-link primary big-button">
          ▶ Dictée de 10 mots
        </Link>
      </section>

      <section>
        <h2>Les 20 paires de tons</h2>
        <p className="muted small">
          Touchez une case pour écouter des exemples. La couleur indique votre réussite en dictée (vert ≥ 85 %, orange ≥ 60 %).
        </p>
        <table className="pairs-table">
          <thead>
            <tr>
              <th />
              {[1, 2, 3, 4, 0].map((b) => (
                <th key={b} className={`tone${b || 5}`}>
                  {b || '·'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((a) => (
              <tr key={a}>
                <th className={`tone${a}`}>{a}</th>
                {[1, 2, 3, 4, 0].map((b) => {
                  const combo = `${a}-${b}`;
                  const p = pct(combo);
                  return (
                    <td key={combo}>
                      <button
                        className={`pair-cell pair-${level(b === 0 ? null : p)} ${selected === combo ? 'selected' : ''}`}
                        onClick={() => setSelected(combo)}
                        aria-label={`Paire ${combo}`}
                      >
                        {combo.replace('-0', '-·')}
                        {combo === '3-3' ? <small>se dit 2-3</small> : b !== 0 && <small>{p === null ? '—' : `${p} %`}</small>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pair-detail">
        <h2>
          Paire {selected.replace('-0', '-·')} : {TONE_NAMES[Number(selected[0])]} + {TONE_NAMES[Number(selected.split('-')[1])]}
        </h2>
        {selected === '3-3' && (
          <p className="callout subtle">
            Deux 3e tons de suite : le premier se prononce comme un 2e ton (你好 nǐ hǎo → ní hǎo). Les mots écrits 3-3
            se trouvent donc dans la paire 2-3.
          </p>
        )}
        {neutral && <p className="muted small">Le ton neutre est court et léger ; il n'est pas noté en dictée.</p>}
        {examples.length ? (
          <ul className="example-list">
            {examples.map((w) => (
              <li key={w.text}>
                <button className="icon-button" onClick={() => speak(w.text, 0.75)} aria-label={`Écouter ${w.text}`}>
                  🔊
                </button>
                <Link to={`/w/${w.text}`} className="example-word">
                  <ToneHanzi text={w.text} numeric={w.numeric} className="hanzi" /> <Pinyin numeric={w.numeric} />
                </Link>
                <span className="muted small">{catalog.word(w.text)?.rd[0].fr?.[0]}</span>
                {w.known && <span className="badge">connu</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Pas d'exemple courant pour cette paire.</p>
        )}
        <p className="muted small">Écoutez puis répétez à voix haute : l'analyse de votre voix arrivera ensuite.</p>
        {!neutral && selected !== '3-3' && (
          <Link to={`/oral/dictee?focus=${selected}`} className="button-link">
            S'entraîner sur la paire {selected}
          </Link>
        )}
      </section>
    </div>
  );
}
