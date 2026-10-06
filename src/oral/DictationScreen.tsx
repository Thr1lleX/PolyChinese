// Série de dictée de tons, puis bilan par paire.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadComboStats, logToneAnswer, useTonePool } from './toneData';
import { ToneDictationItem } from './ToneDictationItem';
import { pickDictation, type ToneWord } from './toneWords';

const COUNT = 10;

export function DictationScreen() {
  const [params] = useSearchParams();
  const focus = params.get('focus') ?? undefined;
  const pool = useTonePool();
  const [words, setWords] = useState<ToneWord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ word: ToneWord; answer: string; correct: boolean }[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!pool || words) return;
    let alive = true;
    loadComboStats().then((stats) => {
      if (alive) setWords(pickDictation(pool, { count: COUNT, stats, focus }));
    });
    return () => {
      alive = false;
    };
  }, [pool, focus, round, words]);

  if (!words) return null;
  if (!words.length) {
    return (
      <div className="screen narrow">
        <p>Pas assez de mots pour une dictée.</p>
        <Link to="/oral">← Oral</Link>
      </div>
    );
  }

  if (index >= words.length) {
    const ok = results.filter((r) => r.correct).length;
    const missed = results.filter((r) => !r.correct);
    return (
      <div className="screen narrow">
        <h1>Bilan de la dictée</h1>
        <p className="big-score">
          <strong>{ok}</strong> / {results.length}
        </p>
        {missed.length > 0 && (
          <>
            <h2>À réécouter</h2>
            <ul className="plain-list">
              {missed.map((r, i) => (
                <li key={i}>
                  <span className="hanzi">{r.word.text}</span> : {r.word.spoken}{' '}
                  <span className="muted">(vous : {r.answer})</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="actions-row">
          <button
            className="primary"
            onClick={() => {
              setIndex(0);
              setResults([]);
              setWords(null);
              setRound((r) => r + 1);
            }}
          >
            Nouvelle dictée
          </button>
          <Link to="/oral" className="button-link">
            Tableau des paires
          </Link>
        </div>
      </div>
    );
  }

  const word = words[index];
  return (
    <div className="screen narrow practice">
      <div className="practice-top">
        <Link to="/oral">✕ Quitter</Link>
        <span className="muted">
          {focus ? `Paire ${focus} · ` : ''}
          {index + 1} / {words.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(index / words.length) * 100}%` }} />
      </div>
      <ToneDictationItem
        key={`${round}-${index}`}
        word={word}
        onNext={async ({ answer, correct }) => {
          await logToneAnswer(word, answer, correct, 'dictation');
          setResults((r) => [...r, { word, answer, correct }]);
          setIndex((i) => i + 1);
        }}
      />
    </div>
  );
}
