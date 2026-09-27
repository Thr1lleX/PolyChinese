import { useEffect } from 'react';
import { RATINGS, RATING_LABELS, type Rating, type WritingResult } from '../writing/grading';

export function RatingChip({ rating }: { rating: Rating }) {
  return <span className={`rating-chip rating-${rating}`}>{RATING_LABELS[rating]}</span>;
}

/** Résumé chiffré d'un tracé : « 1 erreur · 1,4 s/trait » */
export function describeResult(r: WritingResult): string {
  if (r.gaveUp) return 'Abandon';
  const parts = [r.mistakes === 0 ? 'Aucune erreur' : `${r.mistakes} erreur${r.mistakes > 1 ? 's' : ''}`];
  if (r.hintUsed) parts.push('indice utilisé');
  if (r.msPerStroke !== null) parts.push(`${(r.msPerStroke / 1000).toLocaleString('fr', { maximumFractionDigits: 1 })} s/trait`);
  return parts.join(' · ');
}

interface PanelProps {
  auto: Rating;
  value: Rating;
  result: WritingResult;
  onChange: (r: Rating) => void;
  onNext: () => void;
  nextLabel?: string;
}

/**
 * Note proposée par la machine, corrigeable (SPEC §4, principe 4).
 * Clavier : 1-4 = choisir la note, Entrée = suivant.
 */
export function RatingPanel({ auto, value, result, onChange, onNext, nextLabel = 'Suivant' }: PanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) onChange(RATINGS[n - 1]);
      else if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChange, onNext]);

  return (
    <div className="rating-panel">
      <p className="rating-summary">
        <RatingChip rating={value} />
        <span className="muted">{describeResult(result)}</span>
      </p>
      <div className="rating-buttons" role="group" aria-label="Corriger la note">
        {RATINGS.map((r, i) => (
          <button
            key={r}
            className={`rating-button rating-${r} ${r === value ? 'selected' : ''}`}
            onClick={() => onChange(r)}
            title={`Touche ${i + 1}`}
          >
            {RATING_LABELS[r]}
            {r === auto && <small>proposée</small>}
          </button>
        ))}
      </div>
      <button className="primary next-button" onClick={onNext}>
        {nextLabel} ⏎
      </button>
    </div>
  );
}
