import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { CharEntry } from '../data/types';
import { loadStrokes } from './strokes';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Caractère animé trait par trait (Hanzi Writer), avec bouton « Rejouer ». */
export function CharacterAnimation({ entry, size = 220 }: { entry: CharEntry; size?: number }) {
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    el.innerHTML = '';
    setError(null);
    const w = HanziWriter.create(el, entry.c, {
      width: size,
      height: size,
      padding: 8,
      showOutline: true,
      strokeColor: cssVar('--ink'),
      outlineColor: cssVar('--outline'),
      radicalColor: cssVar('--accent'),
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 250,
      charDataLoader: (_c, onLoad, onError) => {
        loadStrokes(entry).then(onLoad, (e: unknown) => {
          setError(String(e));
          onError(e);
        });
      },
    });
    writer.current = w;
    w.animateCharacter();
    return () => {
      writer.current = null;
      el.innerHTML = '';
    };
  }, [entry, size]);

  return (
    <div className="animation">
      <div className="grid-box" style={{ width: size, height: size }}>
        <GridLines />
        <div ref={target} className="writer-target" />
      </div>
      {error ? (
        <p className="muted">{error}</p>
      ) : (
        <button onClick={() => writer.current?.animateCharacter()}>▶ Rejouer l'animation</button>
      )}
    </div>
  );
}

/** Grille 米字格 en fond. */
export function GridLines() {
  return (
    <svg className="grid-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <rect x="0.5" y="0.5" width="99" height="99" />
      <line x1="0" y1="50" x2="100" y2="50" />
      <line x1="50" y1="0" x2="50" y2="100" />
      <line x1="0" y1="0" x2="100" y2="100" />
      <line x1="100" y1="0" x2="0" y2="100" />
    </svg>
  );
}
