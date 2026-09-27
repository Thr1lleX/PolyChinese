// Accueil (SPEC §11) : lancer ou reprendre la séance, régularité, couverture de lecture, sauvegarde.
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { useChineseVoice } from '../audio/speech';
import { useCatalog } from '../data/CatalogContext';
import { db } from '../db/db';
import { knownChars, useDecks, useItemsMap } from '../db/hooks';
import { CONTEXT_LABELS, type SessionContext } from '../db/model';
import { EXPRESS_MINUTES, planSession, startSession, today } from '../session/sessionService';
import { updateSettings, useSettings } from '../settings';
import type { ComposeResult } from '../srs/compose';
import { computeStreak, isValidated } from '../srs/streak';
import { addDays, weekStart } from '../srs/studyDay';

const DURATIONS = [EXPRESS_MINUTES, 15, 25, 35];

export function HomeScreen() {
  const items = useItemsMap();
  const decks = useDecks();
  const settings = useSettings();
  const running = useLiveQuery(async () => {
    const day = today();
    return (await db.sessions.where('status').equals('running').toArray()).find((s) => s.day === day) ?? null;
  }, []);

  if (!items || running === undefined) return null;

  const pendingDeck = decks
    ?.map((d) => ({ deck: d, pending: d.itemKeys.filter((k) => items.get(k)?.triage === 'pending').length }))
    .find((d) => d.pending > 0);

  const lastExport = settings.lastExportAt ? new Date(settings.lastExportAt) : null;
  const backupDue = items.size > 0 && (!lastExport || Date.now() - lastExport.getTime() > 7 * 86400000);

  return (
    <div className="screen home">
      {items.size === 0 && (
        <div className="callout">
          <strong>Bienvenue !</strong> Commencez par importer les caractères que vous connaissez déjà : collez-les, puis
          triez-les en quelques minutes. Vous pouvez aussi lancer une séance directement : l'outil vous proposera les
          caractères et les mots les plus courants.
          <div className="actions-row compact">
            <Link to="/importer" className="button-link primary">
              Importer mes caractères
            </Link>
          </div>
        </div>
      )}

      {running && running.position < running.queue.length ? (
        <div className="session-card">
          <h2>Séance en cours</h2>
          <p>
            {Math.max(0, Math.round(running.durationMin + running.extraMin - running.activeMs / 60000))} min restantes ·{' '}
            {running.queue.length - running.position} cartes · {CONTEXT_LABELS[running.context].icon}{' '}
            {CONTEXT_LABELS[running.context].label}
          </p>
          <Link to="/seance" className="button-link primary big-button">
            ▶ Reprendre la séance
          </Link>
        </div>
      ) : (
        <SessionLauncher />
      )}

      {pendingDeck && (
        <div className="callout">
          Tri en cours : {pendingDeck.pending} élément{pendingDeck.pending > 1 ? 's' : ''} restant
          {pendingDeck.pending > 1 ? 's' : ''} dans « {pendingDeck.deck.name} ».
          <div className="actions-row compact">
            <Link to={`/tri/${pendingDeck.deck.id}`} className="button-link">
              Reprendre le tri
            </Link>
          </div>
        </div>
      )}

      <Regularity />
      <Coverage />

      {backupDue && (
        <div className="callout subtle">
          💾 Dernière sauvegarde : {lastExport ? lastExport.toLocaleDateString('fr') : 'jamais'}.{' '}
          <Link to="/reglages#sauvegarde">Exporter mes données</Link>
        </div>
      )}

      <p className="muted small center footer-links">
        <Link to="/stats">Statistiques</Link> · <Link to="/reglages">Réglages</Link> · <Link to="/a-propos">À propos</Link>
      </p>
    </div>
  );
}

function SessionLauncher() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const settings = useSettings();
  const [duration, setDuration] = useState(settings.lastDuration);
  const [context, setContext] = useState<SessionContext>(settings.lastContext);
  const [plan, setPlan] = useState<ComposeResult | null>(null);
  const [starting, setStarting] = useState(false);
  const voice = useChineseVoice();
  // Recalcul de l'aperçu quand les cartes changent
  const version = useLiveQuery(async () => `${await db.cards.count()}-${await db.reviewLogs.count()}`, []);
  const oralWaiting = useLiveQuery(async () => {
    const now = new Date();
    return db.cards.where('type').equals('listening').filter((c) => c.fsrs.state !== 0 && c.due <= now).count();
  }, []);

  useEffect(() => {
    let alive = true;
    planSession(catalog, { durationMin: duration, context, voiceAvailable: voice }).then((p) => alive && setPlan(p));
    return () => {
      alive = false;
    };
  }, [catalog, duration, context, voice, version]);

  const start = async (bonusNew = 0) => {
    setStarting(true);
    updateSettings({ lastDuration: duration, lastContext: context });
    await startSession(catalog, { durationMin: duration, context, voiceAvailable: voice, bonusNew });
    navigate('/seance');
  };

  const empty = plan && plan.queue.length === 0;

  return (
    <div className="session-card">
      <h2>Séance du jour</h2>
      <div className="segmented" role="radiogroup" aria-label="Durée">
        {DURATIONS.map((d) => (
          <button key={d} role="radio" aria-checked={duration === d} className={duration === d ? 'active' : ''} onClick={() => setDuration(d)}>
            {d === EXPRESS_MINUTES ? `⚡ ${d} min` : `${d} min`}
          </button>
        ))}
      </div>
      <div className="segmented" role="radiogroup" aria-label="Contexte">
        {(Object.keys(CONTEXT_LABELS) as SessionContext[]).map((c) => (
          <button key={c} role="radio" aria-checked={context === c} className={context === c ? 'active' : ''} onClick={() => setContext(c)} title={CONTEXT_LABELS[c].help}>
            {CONTEXT_LABELS[c].icon} {CONTEXT_LABELS[c].label}
          </button>
        ))}
      </div>
      {plan && (
        <p className="plan-preview">
          {empty ? (
            duration === EXPRESS_MINUTES ? 'Rien d’urgent à réviser 🎉' : 'Révisions et nouveautés du jour terminées 🎉'
          ) : (
            <>
              ≈ <strong>{plan.reviews + plan.sisters}</strong> révision{plan.reviews + plan.sisters > 1 ? 's' : ''}
              {plan.newItems > 0 && (
                <>
                  {' '}
                  · <strong>{plan.newItems}</strong> nouveauté{plan.newItems > 1 ? 's' : ''}
                </>
              )}
              {plan.postponed > 0 && <span className="muted"> · {plan.postponed} en attente</span>}
            </>
          )}
          {plan.backlog && (
            <span className="muted small block">Du retard à rattraper : les nouveautés reprendront ensuite.</span>
          )}
          {duration === EXPRESS_MINUTES && <span className="muted small block">Séance express : uniquement l'urgent.</span>}
          {!voice && context !== 'silent' && (
            <span className="muted small block">Aucune voix chinoise sur cet appareil : cartes d'écoute désactivées.</span>
          )}
          {context === 'silent' && (oralWaiting ?? 0) > 20 && (
            <span className="muted small block">{oralWaiting} cartes d'écoute attendent une séance avec du son.</span>
          )}
        </p>
      )}
      {empty && duration !== EXPRESS_MINUTES ? (
        <button className="big-button" disabled={starting} onClick={() => start(5)}>
          ＋ Apprendre 5 nouveautés de plus
        </button>
      ) : (
        <button className="primary big-button" disabled={!plan || !!empty || starting} onClick={() => start()}>
          ▶ Commencer
        </button>
      )}
    </div>
  );
}

function Regularity() {
  const settings = useSettings();
  const days = useLiveQuery(() => db.days.toArray(), []);
  if (!days) return null;
  const activity = new Map(days.map((d) => [d.day, d]));
  const day = today();
  const streak = computeStreak(activity, day, settings.jokersPerWeek);
  const todayMin = Math.round((activity.get(day)?.activeMs ?? 0) / 60000);

  // Calendrier : 18 semaines, lundi en haut
  const WEEKS = 18;
  const first = addDays(weekStart(day), -7 * (WEEKS - 1));
  const columns = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
  const level = (d: string) => {
    const a = activity.get(d);
    if (!a || a.activeMs <= 0) return streak.jokerDays.has(d) ? 'joker' : 0;
    const m = a.activeMs / 60000;
    return !isValidated(a) ? 1 : m < 15 ? 2 : m < 30 ? 3 : 4;
  };

  return (
    <section className="regularity">
      <div className="streak-row">
        <span className="streak">
          🔥 <strong>{streak.current}</strong> jour{streak.current > 1 ? 's' : ''}
        </span>
        <span className="muted">
          {streak.validatedToday ? `✅ Aujourd'hui validé (${todayMin} min)` : `Aujourd'hui : ${todayMin} / 5 min`}
        </span>
        <span className="muted">
          🃏 {streak.jokersLeft} joker{streak.jokersLeft > 1 ? 's' : ''} cette semaine
        </span>
      </div>
      <div className="calendar" role="img" aria-label="Calendrier de régularité">
        {columns.map((col, i) => (
          <div key={i} className="calendar-col">
            {col.map((d) => (
              <span
                key={d}
                className={`calendar-cell level-${level(d)} ${d === day ? 'today' : ''} ${d > day ? 'future' : ''}`}
                title={`${new Date(`${d}T12:00`).toLocaleDateString('fr')} : ${Math.round((activity.get(d)?.activeMs ?? 0) / 60000)} min`}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Coverage() {
  const catalog = useCatalog();
  const items = useItemsMap();
  const coverage = useMemo(() => {
    const known = knownChars(items);
    let perMillion = 0;
    for (const c of known) perMillion += catalog.char(c)?.pm ?? 0;
    return { chars: known.size, pct: perMillion / 10000 };
  }, [catalog, items]);
  if (!coverage.chars) return null;
  return (
    <section className="coverage">
      <p>
        Vos <strong>{coverage.chars}</strong> caractères connus couvrent{' '}
        <strong>{coverage.pct.toLocaleString('fr', { maximumFractionDigits: 1 })} %</strong> d'un texte courant.
      </p>
      <div className="mini-progress">
        <span style={{ width: `${Math.min(100, coverage.pct)}%` }} />
      </div>
    </section>
  );
}
