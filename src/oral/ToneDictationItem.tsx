// Une question de dictée de tons : écouter un mot, retrouver ses tons.
// Clavier : 1-4 = ton de la syllabe suivante, Retour arrière = effacer, R = réécouter, L = lentement, Entrée = suivant.
import { useEffect, useRef, useState } from 'react';
import { speak } from '../audio/speech';
import { useCatalog } from '../data/CatalogContext';
import { Definitions } from '../ui/Definitions';
import { Pinyin, ToneHanzi } from '../ui/Pinyin';
import type { ToneWord } from './toneWords';

const TONE_BUTTONS = [
  { tone: 1, mark: 'ā', shape: '‾', label: '1er ton' },
  { tone: 2, mark: 'á', shape: '↗', label: '2e ton' },
  { tone: 3, mark: 'ǎ', shape: '↘↗', label: '3e ton' },
  { tone: 4, mark: 'à', shape: '↘', label: '4e ton' },
];

export interface ToneAnswer {
  answer: string;
  correct: boolean;
}

export function ToneDictationItem({ word, onNext }: { word: ToneWord; onNext: (result: ToneAnswer) => void }) {
  const catalog = useCatalog();
  const size = word.spoken.split('-').length;
  const [answer, setAnswer] = useState<number[]>([]);
  const done = answer.length === size;
  const answerKey = answer.join('-');
  // Les tons écrits sont aussi acceptés (你好 : « 3-3 » au lieu de « 2-3 »)
  const correct = done && (answerKey === word.spoken || answerKey === word.written);
  const sent = useRef(false);

  useEffect(() => {
    speak(word.text, 0.75);
  }, [word.text]);

  useEffect(() => {
    if (done) speak(word.text, 0.75);
  }, [done, word.text]);

  const choose = (tone: number) => setAnswer((a) => (a.length < size ? [...a, tone] : a));
  const next = () => {
    if (!done || sent.current) return;
    sent.current = true;
    onNext({ answer: answerKey, correct });
  };

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (['1', '2', '3', '4'].includes(e.key) && !done) choose(Number(e.key));
    else if (e.key === 'Backspace' && !done) setAnswer((a) => a.slice(0, -1));
    else if (e.key === 'r' || e.key === 'R') speak(word.text, 0.75);
    else if (e.key === 'l' || e.key === 'L') speak(word.text, 0.5);
    else if (e.key === 'Enter' && done) {
      e.preventDefault();
      next();
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const entry = catalog.word(word.text);
  const expected = word.spoken.split('-').map(Number);

  return (
    <div className="study-card tone-dictation">
      <p className="card-type">Quels tons entendez-vous ?</p>
      <div className="listen-row">
        <button className="listen-button" onClick={() => speak(word.text, 0.75)} aria-label="Réécouter">
          🔊
        </button>
        <button className="link-button" onClick={() => speak(word.text, 0.5)}>
          🐢 Lentement
        </button>
      </div>

      <div className="tone-slots" aria-label="Votre réponse">
        {Array.from({ length: size }, (_, i) => (
          <span
            key={i}
            className={`tone-slot ${answer[i] ? `tone${answer[i]}` : ''} ${done ? (answer[i] === expected[i] || correct ? 'ok' : 'ko') : ''}`}
          >
            {answer[i] ? TONE_BUTTONS[answer[i] - 1].shape : '?'}
          </span>
        ))}
      </div>

      {!done ? (
        <>
          <div className="tone-buttons">
            {TONE_BUTTONS.map((b) => (
              <button key={b.tone} className={`tone-button tone${b.tone}`} onClick={() => choose(b.tone)} aria-label={b.label}>
                <span className="tone-mark">{b.mark}</span>
                <span className="tone-shape">{b.shape}</span>
                <small className="hint-keyboard">{b.tone}</small>
              </button>
            ))}
          </div>
          <div className="actions-row compact center">
            {answer.length > 0 && (
              <button className="link-button" onClick={() => setAnswer((a) => a.slice(0, -1))}>
                ⌫ Effacer
              </button>
            )}
            <span className="muted small hint-keyboard">Touches 1-4 · R : réécouter · L : lentement</span>
          </div>
        </>
      ) : (
        <div className="card-answer">
          <p className={`verdict ${correct ? 'ok' : 'ko'}`}>{correct ? '✓ Exact' : `✗ C'était ${word.spoken}`}</p>
          <ToneHanzi text={word.text} numeric={word.numeric} className="card-hanzi" />
          <Pinyin numeric={word.numeric} className="big" />
          {entry && <Definitions reading={entry.rd[0]} max={3} />}
          {word.spoken !== word.written && (
            <p className="muted small">
              S'écrit {word.written}, se prononce {word.spoken} (changement de ton).
            </p>
          )}
          <button className="primary next-button" onClick={next}>
            Suivant <span className="hint-keyboard">⏎</span>
          </button>
        </div>
      )}
    </div>
  );
}
