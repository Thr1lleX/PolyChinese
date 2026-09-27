// Entraînement libre sur un caractère (SPEC §7) : regarder, tracer avec le contour, puis de mémoire. Non noté.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { RatingChip, describeResult } from '../ui/Rating';
import { ToleranceSelect } from '../ui/ToleranceSelect';
import { WritingPrompt } from '../ui/WritingPrompt';
import { CharacterAnimation } from '../writing/CharacterAnimation';
import { gradeWriting, type WritingResult } from '../writing/grading';
import { WritingQuiz } from '../writing/WritingQuiz';

type Phase = 'watch' | 'guided' | 'memory';

const PHASES: { id: Phase; label: string; help: string }[] = [
  { id: 'watch', label: '1. Regarder', help: "Observez l'ordre et le sens des traits." },
  { id: 'guided', label: '2. Tracé guidé', help: 'Tracez par-dessus le contour. Le trait attendu clignote après une erreur.' },
  { id: 'memory', label: '3. De mémoire', help: 'Tracez sans aide.' },
];

export function CharacterPracticeScreen() {
  const { char = '' } = useParams();
  const catalog = useCatalog();
  const entry = catalog.char(char);
  const [phase, setPhase] = useState<Phase>('watch');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<WritingResult | null>(null);

  if (!entry) {
    return (
      <div className="screen">
        <p>Caractère « {char} » introuvable.</p>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  const go = (p: Phase) => {
    setPhase(p);
    setResult(null);
    setAttempt((a) => a + 1);
  };
  const current = PHASES.find((p) => p.id === phase)!;
  const nextPhase = PHASES[PHASES.indexOf(current) + 1];

  return (
    <div className="screen narrow practice">
      <div className="practice-top">
        <Link to={`/c/${entry.c}`}>← Fiche de {entry.c}</Link>
      </div>

      <div className="tabs" role="tablist">
        {PHASES.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === phase} className={p.id === phase ? 'active' : ''} onClick={() => go(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted">{current.help}</p>

      <WritingPrompt entry={entry} reveal={phase !== 'memory' || !!result} />

      {phase === 'watch' ? (
        <CharacterAnimation entry={entry} size={Math.max(160, Math.min(320, window.innerWidth - 48))} />
      ) : (
        <WritingQuiz
          key={`${phase}-${attempt}`}
          entry={entry}
          mode={phase}
          hintAfterMisses={phase === 'guided' ? 1 : undefined}
          onDone={setResult}
        />
      )}

      {result && (
        <p className="rating-summary">
          {phase === 'memory' && <RatingChip rating={gradeWriting(result)} />}
          <span className="muted">{describeResult(result)}</span>
        </p>
      )}

      <div className="actions-row">
        {phase !== 'watch' && <button onClick={() => go(phase)}>↻ Recommencer</button>}
        {nextPhase && (
          <button className="primary" onClick={() => go(nextPhase.id)}>
            Étape suivante : {nextPhase.label.slice(3)}
          </button>
        )}
      </div>

      <details className="settings-inline">
        <summary>Réglages du tracé</summary>
        <ToleranceSelect />
      </details>
    </div>
  );
}
