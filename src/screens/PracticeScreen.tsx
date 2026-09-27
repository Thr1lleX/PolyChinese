// Série d'entraînement à l'écriture (étape 1) : N caractères tracés de mémoire, notés automatiquement,
// puis bilan. Sert à valider la fluidité du tracé et la justesse de la notation (SPEC §15, étape 1).
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import type { Catalog } from '../data/catalog';
import type { CharEntry } from '../data/types';
import { LENIENCY, TOLERANCE_LABELS, effectiveTolerance, updateSettings, useSettings } from '../settings';
import { Pinyin } from '../ui/Pinyin';
import { RatingChip, RatingPanel, describeResult } from '../ui/Rating';
import { ToleranceSelect } from '../ui/ToleranceSelect';
import { WritingPrompt } from '../ui/WritingPrompt';
import { RATINGS, RATING_LABELS, gradeWriting, type Rating, type WritingResult } from '../writing/grading';
import { WritingQuiz } from '../writing/WritingQuiz';

type Source = 'hsk1' | 'hsk2' | 'hsk3' | 'top100' | 'custom';

const SOURCE_LABELS: Record<Source, string> = {
  hsk1: 'Caractères HSK 1',
  hsk2: 'Caractères HSK 2',
  hsk3: 'Caractères HSK 3',
  top100: 'Les 100 plus fréquents',
  custom: 'Ma liste (coller des caractères)',
};

interface CardOutcome {
  entry: CharEntry;
  result: WritingResult;
  auto: Rating;
  final: Rating;
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pool(catalog: Catalog, source: Source, custom: string): CharEntry[] {
  switch (source) {
    case 'hsk1':
    case 'hsk2':
    case 'hsk3': {
      const level = Number(source.slice(3));
      return catalog.chars.filter((c) => c.h === level);
    }
    case 'top100':
      return catalog.chars.slice(0, 100);
    case 'custom':
      return [...new Set(custom)].map((ch) => catalog.char(ch)).filter((c): c is CharEntry => !!c);
  }
}

export function PracticeScreen() {
  const [queue, setQueue] = useState<CharEntry[] | null>(null);
  const [outcomes, setOutcomes] = useState<CardOutcome[] | null>(null);

  if (outcomes) {
    return (
      <Summary
        outcomes={outcomes}
        onRetry={(entries) => {
          setOutcomes(null);
          setQueue(shuffle(entries));
        }}
        onNew={() => {
          setOutcomes(null);
          setQueue(null);
        }}
      />
    );
  }
  if (queue) return <Run key={queue.map((c) => c.c).join('')} queue={queue} onFinish={setOutcomes} onQuit={() => setQueue(null)} />;
  return <Setup onStart={setQueue} />;
}

function Setup({ onStart }: { onStart: (queue: CharEntry[]) => void }) {
  const catalog = useCatalog();
  const settings = useSettings();
  const [source, setSource] = useState<Source>(() => (localStorage.getItem('polychinese.practiceSource') as Source) ?? 'hsk1');
  const [custom, setCustom] = useState(() => localStorage.getItem('polychinese.practiceCustom') ?? '');
  const available = useMemo(() => pool(catalog, source, custom), [catalog, source, custom]);

  const start = () => {
    localStorage.setItem('polychinese.practiceSource', source);
    localStorage.setItem('polychinese.practiceCustom', custom);
    const list = source === 'custom' ? available : shuffle(available);
    onStart(list.slice(0, settings.practiceSize));
  };

  return (
    <div className="screen narrow">
      <h1>Entraînement à l'écriture</h1>
      <p className="muted">
        Tracez chaque caractère de mémoire, trait par trait. La note est proposée automatiquement ; corrigez-la si elle
        vous semble injuste (touches 1 à 4).
      </p>

      <div className="form">
        <label className="field">
          <span>Caractères</span>
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        {source === 'custom' && (
          <label className="field">
            <span>Collez vos caractères (tout le reste est ignoré)</span>
            <textarea rows={4} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="我你他好学生…" />
          </label>
        )}

        <label className="field">
          <span>Nombre par série</span>
          <select value={settings.practiceSize} onChange={(e) => updateSettings({ practiceSize: Number(e.target.value) })}>
            {[5, 10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <ToleranceSelect />

        <label className="field checkbox">
          <input type="checkbox" checked={settings.showGrid} onChange={(e) => updateSettings({ showGrid: e.target.checked })} />
          <span>Grille d'aide 米字格</span>
        </label>

        <button className="primary" disabled={!available.length} onClick={start}>
          Commencer ({Math.min(available.length, settings.practiceSize)} caractères)
        </button>
      </div>
    </div>
  );
}

function Run({
  queue,
  onFinish,
  onQuit,
}: {
  queue: CharEntry[];
  onFinish: (outcomes: CardOutcome[]) => void;
  onQuit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<CardOutcome[]>([]);
  const [current, setCurrent] = useState<{ result: WritingResult; auto: Rating; final: Rating } | null>(null);
  const entry = queue[index];

  const onDone = useCallback((result: WritingResult) => {
    const auto = gradeWriting(result);
    setCurrent({ result, auto, final: auto });
  }, []);

  const setFinal = useCallback((final: Rating) => setCurrent((c) => (c ? { ...c, final } : c)), []);

  const next = useCallback(() => {
    if (!current) return;
    const all = [...outcomes, { entry, ...current }];
    if (index + 1 >= queue.length) {
      onFinish(all);
      return;
    }
    setOutcomes(all);
    setCurrent(null);
    setIndex(index + 1);
  }, [current, outcomes, entry, index, queue.length, onFinish]);

  return (
    <div className="screen narrow practice">
      <div className="practice-top">
        <button className="link-button" onClick={onQuit}>
          ✕ Quitter
        </button>
        <span className="muted">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <WritingPrompt entry={entry} reveal={!!current} />
      <WritingQuiz key={`${index}-${entry.c}`} entry={entry} mode="memory" onDone={onDone} />

      {current && (
        <RatingPanel
          auto={current.auto}
          value={current.final}
          result={current.result}
          onChange={setFinal}
          onNext={next}
          nextLabel={index + 1 >= queue.length ? 'Voir le bilan' : 'Suivant'}
        />
      )}
    </div>
  );
}

function Summary({
  outcomes,
  onRetry,
  onNew,
}: {
  outcomes: CardOutcome[];
  onRetry: (entries: CharEntry[]) => void;
  onNew: () => void;
}) {
  const settings = useSettings();
  const tolerance = effectiveTolerance(settings.tolerance);
  const corrected = outcomes.filter((o) => o.auto !== o.final);
  const toRetry = outcomes.filter((o) => o.final === 'again' || o.final === 'hard').map((o) => o.entry);
  const timed = outcomes.filter((o) => o.result.msPerStroke !== null);
  const avgMs = timed.length ? timed.reduce((s, o) => s + o.result.msPerStroke!, 0) / timed.length : null;

  return (
    <div className="screen narrow">
      <h1>Bilan de la série</h1>

      <div className="rating-counts">
        {RATINGS.map((r) => (
          <div key={r}>
            <strong>{outcomes.filter((o) => o.final === r).length}</strong>
            <RatingChip rating={r} />
          </div>
        ))}
      </div>

      <p>
        Notes corrigées : <strong>{corrected.length}</strong> / {outcomes.length}
        {corrected.length > 0 && (
          <span className="muted">
            {' '}
            (dont {corrected.filter((o) => RATINGS.indexOf(o.final) > RATINGS.indexOf(o.auto)).length} relevée
            {corrected.length > 1 ? 's' : ''})
          </span>
        )}
        <br />
        {avgMs !== null && (
          <>
            Vitesse moyenne : {(avgMs / 1000).toLocaleString('fr', { maximumFractionDigits: 1 })} s/trait
            <br />
          </>
        )}
        <span className="muted">
          Tolérance : {TOLERANCE_LABELS[tolerance]} (valeur {LENIENCY[tolerance]})
        </span>
      </p>

      <ul className="result-list">
        {outcomes.map((o, i) => (
          <li key={i}>
            <Link to={`/c/${o.entry.c}`} className="result">
              <span className="hanzi result-hanzi">{o.entry.c}</span>
              <span className="result-body">
                <Pinyin numeric={o.entry.rd[0].p} />
                <span className="muted">{describeResult(o.result)}</span>
              </span>
              <span className="result-rating">
                <RatingChip rating={o.final} />
                {o.final !== o.auto && <small className="muted">proposée : {RATING_LABELS[o.auto]}</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="actions-row">
        {toRetry.length > 0 && (
          <button className="primary" onClick={() => onRetry(toRetry)}>
            Refaire {toRetry.length === 1 ? 'le caractère raté' : `les ${toRetry.length} caractères ratés ou difficiles`}
          </button>
        )}
        <button onClick={onNew}>Nouvelle série</button>
      </div>
    </div>
  );
}
