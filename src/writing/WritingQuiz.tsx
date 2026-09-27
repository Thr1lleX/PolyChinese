import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { CharEntry } from '../data/types';
import { LENIENCY, effectiveTolerance, useSettings } from '../settings';
import { GridLines } from './CharacterAnimation';
import type { WritingResult } from './grading';
import { loadStrokes } from './strokes';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface QuizState {
  /** Prochain trait attendu */
  nextStroke: number;
  hintUsed: boolean;
  /** Instant du premier contact avec la zone de tracé */
  firstDown: number;
  done: boolean;
  mistakes: number[];
}

interface Props {
  entry: CharEntry;
  /** memory = de mémoire (rien d'affiché) ; guided = contour visible */
  mode: 'memory' | 'guided';
  onDone: (result: WritingResult) => void;
  /** Indice automatique après N erreurs sur un trait (défaut : réglage utilisateur) */
  hintAfterMisses?: number;
  size?: number;
}

/**
 * Tracé vérifié trait par trait (Hanzi Writer, mode quiz).
 * Pour recommencer, changer la `key` du composant.
 */
export function WritingQuiz({ entry, mode, onDone, hintAfterMisses, size: sizeProp }: Props) {
  const settings = useSettings();
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const state = useRef<QuizState>({ nextStroke: 0, hintUsed: false, firstDown: 0, done: false, mistakes: [] });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const giveUpRef = useRef<() => void>(() => {});
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = sizeProp ?? Math.max(160, Math.min(320, window.innerWidth - 48));
  const hintAfter = hintAfterMisses ?? settings.hintAfterMisses;
  const leniency = LENIENCY[effectiveTolerance(settings.tolerance)];

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    el.innerHTML = '';
    const s: QuizState = { nextStroke: 0, hintUsed: false, firstDown: 0, done: false, mistakes: new Array(entry.n).fill(0) };
    state.current = s;
    setFinished(false);
    setError(null);

    const finish = (gaveUp: boolean) => {
      if (s.done) return;
      s.done = true;
      setFinished(true);
      const elapsed = s.firstDown ? performance.now() - s.firstDown : 0;
      const mistakes = s.mistakes.reduce((a, b) => a + b, 0);
      onDoneRef.current({
        strokeCount: entry.n,
        mistakes,
        mistakesPerStroke: [...s.mistakes],
        hintUsed: s.hintUsed,
        gaveUp,
        msPerStroke: s.firstDown && !gaveUp ? elapsed / entry.n : null,
      });
    };

    const w = HanziWriter.create(el, entry.c, {
      width: size,
      height: size,
      padding: 10,
      showCharacter: false,
      showOutline: mode === 'guided',
      strokeColor: cssVar('--ink'),
      drawingColor: cssVar('--ink'),
      outlineColor: cssVar('--outline'),
      highlightColor: cssVar('--accent'),
      drawingWidth: 5,
      charDataLoader: (_c, onLoad, onError) => {
        loadStrokes(entry).then(onLoad, (e: unknown) => {
          setError(String(e));
          onError(e);
        });
      },
    });
    writer.current = w;
    w.quiz({
      leniency,
      showHintAfterMisses: hintAfter,
      onMistake: (d) => {
        s.mistakes[d.strokeNum] = d.mistakesOnStroke;
        if (d.mistakesOnStroke >= hintAfter) s.hintUsed = true;
      },
      onCorrectStroke: (d) => {
        s.mistakes[d.strokeNum] = d.mistakesOnStroke;
        s.nextStroke = d.strokeNum + 1;
      },
      onComplete: () => finish(false),
    });

    const giveUp = () => {
      if (s.done) return;
      w.cancelQuiz();
      finish(true);
      w.showOutline();
      w.animateCharacter();
    };
    giveUpRef.current = giveUp;

    return () => {
      writer.current = null;
      el.innerHTML = '';
    };
  }, [entry, mode, leniency, hintAfter, size]);

  const hint = () => {
    const w = writer.current;
    if (!w || state.current.done) return;
    state.current.hintUsed = true;
    w.highlightStroke(state.current.nextStroke);
  };

  return (
    <div className="quiz">
      <div
        className="grid-box quiz-box"
        style={{ width: size, height: size }}
        onPointerDown={() => {
          if (!state.current.firstDown) state.current.firstDown = performance.now();
        }}
      >
        {settings.showGrid && <GridLines />}
        <div ref={target} className="writer-target" />
      </div>
      {error && <p className="muted">{error}</p>}
      <div className="quiz-actions">
        {finished ? (
          <button onClick={() => writer.current?.animateCharacter()}>▶ Voir l'animation</button>
        ) : (
          <>
            <button onClick={hint} title="Montre le trait suivant (la carte comptera comme ratée)">
              💡 Indice
            </button>
            <button onClick={() => giveUpRef.current()}>Je ne sais pas</button>
          </>
        )}
      </div>
    </div>
  );
}
