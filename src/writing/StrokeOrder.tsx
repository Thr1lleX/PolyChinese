import { useEffect, useState } from 'react';
import type { CharacterJson } from 'hanzi-writer';
import type { CharEntry } from '../data/types';
import { loadStrokes } from './strokes';

// Les tracés Hanzi Writer sont dans une boîte de 1024 unités, axe vertical inversé.
const FLIP = 'translate(0 900) scale(1 -1)';

/** Ordre des traits en vignettes : chaque étape montre les traits déjà faits et le nouveau en couleur. */
export function StrokeOrder({ entry }: { entry: CharEntry }) {
  const [data, setData] = useState<CharacterJson | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    loadStrokes(entry).then((d) => alive && setData(d), () => {});
    return () => {
      alive = false;
    };
  }, [entry]);

  if (!data) return null;
  return (
    <ol className="stroke-order" aria-label="Ordre des traits">
      {data.strokes.map((_, step) => (
        <li key={step}>
          <svg viewBox="0 0 1024 1024" role="img" aria-label={`Trait ${step + 1}`}>
            <g transform={FLIP}>
              {data.strokes.map((path, i) => (
                <path key={i} d={path} className={i < step ? 'done' : i === step ? 'current' : 'todo'} />
              ))}
            </g>
          </svg>
          <span>{step + 1}</span>
        </li>
      ))}
    </ol>
  );
}
