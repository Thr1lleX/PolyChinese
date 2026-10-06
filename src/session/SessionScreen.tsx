// Déroulé d'une séance (SPEC §9) : cartes, chronomètre actif, pause automatique, reprise, bilan.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { useChineseVoice } from '../audio/speech';
import { useCatalog } from '../data/CatalogContext';
import { db } from '../db/db';
import { CONTEXT_LABELS, type ActiveSession, type CardType, type SessionContext } from '../db/model';
import { getSettings } from '../settings';
import { computeStreak, isValidated } from '../srs/streak';
import { RATINGS, RATING_LABELS } from '../writing/grading';
import { RatingChip } from '../ui/Rating';
import { logToneAnswer } from '../oral/toneData';
import { ToneDictationItem } from '../oral/ToneDictationItem';
import { CARD_COMPONENTS, DiscoveryCard } from './cards';
import {
  addActiveTime,
  allowedTypes,
  changeContext,
  currentSession,
  ensureItem,
  extendSession,
  finishSession,
  rateCard,
} from './sessionService';

const formatClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Carte visée par une entrée de la file. */
function entryCard(entry: Exclude<ActiveSession['queue'][number], { kind: 'discover' } | { kind: 'tone' }>): {
  cardId: string;
  itemKey: string;
  type: CardType;
} {
  const cardId = entry.kind === 'new' ? `${entry.itemKey}|${entry.cardType}` : entry.cardId;
  const [itemKey, type] = cardId.split('|');
  return { cardId, itemKey, type: type as CardType };
}

export function SessionScreen() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [session, setSession] = useState<ActiveSession | null>();
  const [discovering, setDiscovering] = useState(true);
  const [summary, setSummary] = useState(false);
  const [, setTick] = useState(0);
  const pendingMs = useRef(0);
  const cardStart = useRef(performance.now());
  const busy = useRef(false);
  const voice = useChineseVoice();

  useEffect(() => {
    currentSession().then((s) => setSession(s ?? null));
  }, []);

  const flush = useCallback((id: string) => {
    const ms = pendingMs.current;
    pendingMs.current = 0;
    if (ms > 0) {
      addActiveTime(id, ms);
      setSession((s) => (s ? { ...s, activeMs: s.activeMs + ms } : s));
    }
  }, []);

  // Chronomètre : ne compte que lorsque la page est visible (pause automatique, SPEC §9.7)
  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId || summary) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === 'visible') pendingMs.current += Math.min(now - last, 5000);
      last = now;
      setTick((t) => t + 1);
      if (pendingMs.current >= 10000) flush(sessionId);
    }, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush(sessionId);
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      flush(sessionId);
    };
  }, [sessionId, summary, flush]);

  const activeMs = (session?.activeMs ?? 0) + pendingMs.current;
  const budgetMs = session ? (session.durationMin + session.extraMin) * 60000 : 0;

  const advance = useCallback(
    (updated: ActiveSession) => {
      setSession(updated);
      setDiscovering(true);
      cardStart.current = performance.now();
      busy.current = false;
      const timeUp = updated.activeMs + pendingMs.current >= (updated.durationMin + updated.extraMin) * 60000;
      if (updated.position >= updated.queue.length || timeUp) {
        flush(updated.id);
        finishSession(updated, true);
        setSummary(true);
      }
    },
    [flush],
  );

  // Au chargement d'une séance reprise : bilan directement si elle est déjà terminée
  const loadedId = session?.id;
  const exhausted = !!session && session.position >= session.queue.length;
  useEffect(() => {
    if (loadedId && exhausted) setSummary(true);
  }, [loadedId, exhausted]);

  if (session === undefined) return null;
  if (session === null) {
    return (
      <div className="screen narrow">
        <p>Aucune séance en cours.</p>
        <Link to="/">Retour à l'accueil</Link>
      </div>
    );
  }

  if (summary) {
    return (
      <Summary
        session={session}
        activeMs={activeMs}
        onExtend={async () => {
          const updated = await extendSession(catalog, session, 5, voice);
          setSummary(false);
          advance(updated);
          setSummary(updated.position >= updated.queue.length);
        }}
        onClose={() => navigate('/')}
      />
    );
  }

  const entry = session.queue[session.position];
  const audio = session.context !== 'silent';
  const done = session.results.length;
  const remaining = session.queue.length - session.position;

  const frame = (content: ReactNode) => (
    <div className="screen narrow practice session">
      <div className="practice-top">
        <Link to="/">⏸ Pause</Link>
        <ContextSwitcher
          value={session.context}
          onChange={async (context) => {
            flush(session.id);
            const updated = await changeContext(catalog, session, context, voice);
            setSession(updated);
            setDiscovering(true);
          }}
        />
        <span className="muted session-clock" title="Temps restant">
          ⏱ {formatClock(budgetMs - activeMs)}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(done / Math.max(1, done + remaining)) * 100}%` }} />
      </div>
      {content}
    </div>
  );

  /** Avance d'une entrée sans noter (découverte, carte indisponible). */
  const skip = async () => {
    if (busy.current) return;
    busy.current = true;
    const updated = { ...session, position: session.position + 1 };
    await db.sessions.put(updated);
    advance(updated);
  };

  // Échauffement : dictée de tons (passée si le son n'est pas disponible)
  if (entry.kind === 'tone') {
    if (!voice || session.context === 'silent') return <SkipCard key={session.position} onSkip={skip} />;
    return frame(
      <>
        <p className="muted small center warmup-label">Échauffement · dictée de tons</p>
        <ToneDictationItem
          key={`t-${session.position}`}
          word={entry.word}
          onNext={async ({ answer, correct }) => {
            await logToneAnswer(entry.word, answer, correct, 'warmup');
            await skip();
          }}
        />
      </>,
    );
  }

  // Découverte d'un nouvel élément : pas de note, la question viendra quelques cartes plus loin
  if (entry.kind === 'discover') {
    return frame(
      <DiscoveryCard
        key={`d-${session.position}`}
        itemKey={entry.itemKey}
        audio={audio}
        onContinue={async () => {
          await ensureItem(entry.itemKey, entry.itemKind);
          await skip();
        }}
      />,
    );
  }

  const { cardId, itemKey, type } = entryCard(entry);
  const types = allowedTypes(session.context, voice);
  const Card = CARD_COMPONENTS[type];

  // Carte non disponible (prononciation avant l'étape 4, ou exclue après un changement de contexte) : on passe
  if (!Card || !types.has(type)) return <SkipCard key={session.position} onSkip={skip} />;

  // Séances créées avant l'espacement des nouveautés : découverte juste avant la question
  const legacyDiscovery =
    entry.kind === 'new' &&
    !session.queue.slice(0, session.position).some((e) => e.kind === 'discover' && e.itemKey === entry.itemKey);

  const onRated = async (grade: 1 | 2 | 3 | 4, autoGrade?: 1 | 2 | 3 | 4, detail?: unknown) => {
    if (busy.current) return;
    busy.current = true;
    const updated = await rateCard({
      session: { ...session, activeMs: session.activeMs },
      entry,
      cardId,
      grade,
      autoGrade,
      durationMs: Math.min(120000, performance.now() - cardStart.current),
      detail,
    });
    advance({ ...updated, activeMs: session.activeMs });
  };

  if (entry.kind === 'new' && legacyDiscovery && discovering) {
    return frame(
      <DiscoveryCard
        key={`d-${session.position}`}
        itemKey={entry.itemKey}
        audio={audio}
        onContinue={async () => {
          await ensureItem(entry.itemKey, entry.itemKind);
          cardStart.current = performance.now();
          setDiscovering(false);
        }}
      />,
    );
  }

  return frame(<Card key={`${session.position}-${cardId}`} itemKey={itemKey} audio={audio} onRated={onRated} />);
}

/** Passe automatiquement une carte indisponible dans ce contexte. */
function SkipCard({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    onSkip();
  }, [onSkip]);
  return null;
}

function ContextSwitcher({ value, onChange }: { value: SessionContext; onChange: (c: SessionContext) => void }) {
  return (
    <select
      className="context-select"
      value={value}
      onChange={(e) => onChange(e.target.value as SessionContext)}
      aria-label="Contexte de la séance"
    >
      {(Object.keys(CONTEXT_LABELS) as SessionContext[]).map((c) => (
        <option key={c} value={c}>
          {CONTEXT_LABELS[c].icon} {CONTEXT_LABELS[c].label}
        </option>
      ))}
    </select>
  );
}

function Summary({
  session,
  activeMs,
  onExtend,
  onClose,
}: {
  session: ActiveSession;
  activeMs: number;
  onExtend: () => void;
  onClose: () => void;
}) {
  const days = useLiveQuery(() => db.days.toArray(), []);
  const settings = getSettings();
  const activity = new Map((days ?? []).map((d) => [d.day, d]));
  const streak = computeStreak(activity, session.day, settings.jokersPerWeek);
  const counts = RATINGS.map((r, i) => ({ r, n: session.results.filter((x) => x.rating === i + 1).length }));
  const newItems = session.results.filter((r) => r.isNew).length;
  const postponed = session.queue.length - session.position;

  return (
    <div className="screen narrow">
      <h1>Séance terminée</h1>
      <p>
        <strong>{session.results.length}</strong> carte{session.results.length > 1 ? 's' : ''} en {Math.round(activeMs / 60000)} min
        {newItems > 0 && (
          <>
            {' '}
            · <strong>{newItems}</strong> nouveauté{newItems > 1 ? 's' : ''}
          </>
        )}
      </p>
      <div className="rating-counts">
        {counts.map(({ r, n }) => (
          <div key={r}>
            <strong>{n}</strong>
            <RatingChip rating={r} />
          </div>
        ))}
      </div>
      {postponed > 0 && (
        <p className="muted">
          {postponed} carte{postponed > 1 ? 's' : ''} reportée{postponed > 1 ? 's' : ''} à la prochaine séance.
        </p>
      )}
      <div className="callout">
        {isValidated(activity.get(session.day)) ? '✅ Journée validée' : 'Encore quelques minutes pour valider la journée (5 min).'}
        {streak.current > 0 && (
          <>
            {' '}
            · 🔥 Série de <strong>{streak.current}</strong> jour{streak.current > 1 ? 's' : ''}
          </>
        )}
      </div>
      <div className="actions-row">
        <button className="primary" onClick={onClose}>
          Terminer
        </button>
        <button onClick={onExtend}>+5 min</button>
      </div>
      <p className="muted small">{RATING_LABELS.again} = à revoir bientôt ; les autres cartes reviendront au bon moment.</p>
    </div>
  );
}
