// Séances : préparation, notation des cartes, persistance et reprise (SPEC §9).
import { State, type Grade } from 'ts-fsrs';
import type { Catalog } from '../data/catalog';
import { unlockedWords } from '../data/unlocked';
import { db, requestPersistence } from '../db/db';
import { knownChars } from '../db/hooks';
import { itemKey, type ActiveSession, type CardRecord, type CardType, type ItemKind, type SessionContext } from '../db/model';
import { addToDeck } from '../db/repo';
import { getSettings } from '../settings';
import {
  DEFAULT_CARD_MS,
  adaptiveNewTarget,
  composeSession,
  forecastDailyMs,
  type ComposeResult,
  type QueueEntry,
} from '../srs/compose';
import { rate, retrievability, scheduler } from '../srs/scheduler';
import { dayEnd, studyDay } from '../srs/studyDay';

/** Liste où arrivent les nouveaux éléments proposés automatiquement. */
export const NEW_ITEMS_DECK = 'Nouveautés des séances';

export const EXPRESS_MINUTES = 5;

/** Types de cartes possibles selon le contexte (la prononciation arrive à l'étape 4). */
export function allowedTypes(context: SessionContext, voiceAvailable: boolean): Set<CardType> {
  const types = new Set<CardType>(['writing', 'meaning', 'pinyin']);
  if (context !== 'silent' && voiceAvailable) types.add('listening');
  return types;
}

export const today = () => studyDay(new Date(), getSettings().dayCutoffHour);

/** Durée moyenne réelle par type de carte (100 dernières révisions), sinon valeurs par défaut. */
export async function cardDurations(): Promise<Record<CardType, number>> {
  const logs = await db.reviewLogs.orderBy('at').reverse().limit(400).toArray();
  const out = { ...DEFAULT_CARD_MS };
  for (const type of Object.keys(out) as CardType[]) {
    const d = logs.filter((l) => l.type === type).slice(0, 100).map((l) => l.durationMs);
    if (d.length >= 5) {
      const avg = d.reduce((a, b) => a + b, 0) / d.length;
      out[type] = Math.min(90000, Math.max(3000, avg));
    }
  }
  return out;
}

/**
 * Nouveaux éléments candidats par priorité (SPEC §9.4) :
 * 1. « à réapprendre », 2. « à apprendre » (listes personnelles), 3. mots débloqués, 4. caractères fréquents.
 */
async function newCandidates(catalog: Catalog, limit = 40): Promise<{ itemKey: string; kind: ItemKind }[]> {
  const items = new Map((await db.items.toArray()).map((it) => [it.key, it]));
  const startedKeys = new Set(
    (await db.cards.filter((c) => c.fsrs.state !== State.New).toArray()).map((c) => c.itemKey),
  );
  const out: { itemKey: string; kind: ItemKind }[] = [];
  const push = (key: string, kind: ItemKind) => {
    if (out.length < limit && !startedKeys.has(key) && !out.some((o) => o.itemKey === key)) out.push({ itemKey: key, kind });
  };
  const byAdded = [...items.values()].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
  for (const it of byAdded) if (it.triage === 'relearn') push(it.key, it.kind);
  for (const it of byAdded) if (it.triage === 'new') push(it.key, it.kind);
  if (out.length < limit) {
    for (const w of unlockedWords(catalog.words, knownChars(items), new Set(items.keys())).slice(0, limit)) {
      push(itemKey('word', w.w), 'word');
    }
  }
  if (out.length < limit) {
    for (const c of catalog.chars) {
      if (out.length >= limit) break;
      if (!items.has(itemKey('char', c.c))) push(itemKey('char', c.c), 'char');
    }
  }
  return out;
}

export interface SessionPlanOptions {
  durationMin: number;
  context: SessionContext;
  voiceAvailable: boolean;
  /** Cartes déjà faites dans la séance en cours (recomposition) */
  exclude?: Set<string>;
  /** Nouveautés supplémentaires au-delà de l'objectif du jour (« + 5 nouveautés ») */
  bonusNew?: number;
}

export async function planSession(catalog: Catalog, opts: SessionPlanOptions): Promise<ComposeResult> {
  const settings = getSettings();
  const now = new Date();
  const day = studyDay(now, settings.dayCutoffHour);
  const f = scheduler(settings.retention);
  const types = allowedTypes(opts.context, opts.voiceAvailable);
  const [cards, todayLogs, cardMs, activity] = await Promise.all([
    db.cards.toArray(),
    db.reviewLogs.where('day').equals(day).toArray(),
    cardDurations(),
    db.days.get(day),
  ]);

  const dailyBudget = settings.dailyMinutes * 60000;
  const target = adaptiveNewTarget(forecastDailyMs(cards, dayEnd(day, settings.dayCutoffHour), cardMs, types), dailyBudget, settings.maxNewPerDay);
  const newItemsAllowed = Math.max(0, target - (activity?.newItems ?? 0)) + (opts.bonusNew ?? 0);
  const express = opts.durationMin <= EXPRESS_MINUTES;

  return composeSession({
    now,
    budgetMs: opts.durationMin * 60000,
    express,
    allowedTypes: types,
    cards,
    dayEnd: dayEnd(day, settings.dayCutoffHour),
    reviewedTodayCardIds: new Set(todayLogs.map((l) => l.cardId)),
    excludeCardIds: opts.exclude,
    retrievability: (c) => retrievability(f, c, now),
    cardMs,
    newItemsAllowed,
    newCandidates: express ? [] : await newCandidates(catalog),
  });
}

export async function startSession(catalog: Catalog, opts: SessionPlanOptions): Promise<ActiveSession> {
  requestPersistence();
  const plan = await planSession(catalog, opts);
  const session: ActiveSession = {
    id: crypto.randomUUID(),
    day: today(),
    startedAt: new Date(),
    durationMin: opts.durationMin,
    extraMin: 0,
    express: opts.durationMin <= EXPRESS_MINUTES,
    context: opts.context,
    queue: plan.queue,
    position: 0,
    activeMs: 0,
    results: [],
    status: 'running',
  };
  await db.transaction('rw', db.sessions, async () => {
    // Une seule séance en cours à la fois
    await db.sessions.where('status').equals('running').modify({ status: 'done' });
    await db.sessions.add(session);
  });
  return session;
}

/** Séance en cours du jour ; celles des jours précédents sont marquées expirées (SPEC §9.7). */
export async function currentSession(): Promise<ActiveSession | undefined> {
  const running = await db.sessions.where('status').equals('running').toArray();
  const day = today();
  let current: ActiveSession | undefined;
  for (const s of running) {
    if (s.day === day) current = s;
    else await db.sessions.update(s.id, { status: 'expired' });
  }
  return current;
}

/** Ajoute du temps actif à la séance et à la journée. */
export async function addActiveTime(sessionId: string, ms: number): Promise<void> {
  if (ms <= 0) return;
  await db.transaction('rw', db.sessions, db.days, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s || s.status !== 'running') return;
    await db.sessions.update(sessionId, { activeMs: s.activeMs + ms });
    const day = await db.days.get(s.day);
    await db.days.put({ ...(day ?? { day: s.day, reviews: 0, newItems: 0, activeMs: 0 }), activeMs: (day?.activeMs ?? 0) + ms });
  });
}

/** Crée l'élément et ses cartes s'il n'existe pas encore (nouveauté proposée automatiquement). */
export async function ensureItem(key: string, kind: ItemKind): Promise<void> {
  if (await db.items.get(key)) return;
  await addToDeck(NEW_ITEMS_DECK, [{ kind, text: key.slice(2) }], 'new');
}

/** Cartes « en apprentissage » revues plus tard dans la même séance si elles reviennent dans les 20 min. */
const REQUEUE_WITHIN_MS = 20 * 60000;
const REQUEUE_GAP = 4;

export interface RateInput {
  session: ActiveSession;
  entry: QueueEntry;
  cardId: string;
  grade: Grade;
  autoGrade?: Grade;
  durationMs: number;
  detail?: unknown;
}

/** Note une carte : FSRS, journal, activité du jour, avancement de la séance. */
export async function rateCard(input: RateInput): Promise<ActiveSession> {
  const settings = getSettings();
  const now = new Date();
  const f = scheduler(settings.retention);
  return db.transaction('rw', [db.cards, db.reviewLogs, db.sessions, db.days], async () => {
    const card = (await db.cards.get(input.cardId)) as CardRecord;
    const next = rate(f, card, input.grade, now);
    await db.cards.put(next);
    await db.reviewLogs.add({
      cardId: card.id,
      itemKey: card.itemKey,
      type: card.type,
      at: now,
      day: input.session.day,
      rating: input.grade as 1 | 2 | 3 | 4,
      ...(input.autoGrade ? { autoRating: input.autoGrade as 1 | 2 | 3 | 4 } : {}),
      durationMs: Math.round(input.durationMs),
      stateBefore: card.fsrs.state,
      ...(input.detail !== undefined ? { detail: input.detail } : {}),
    });

    const isNewItem = input.entry.kind === 'new';
    const day = await db.days.get(input.session.day);
    await db.days.put({
      ...(day ?? { day: input.session.day, activeMs: 0, reviews: 0, newItems: 0 }),
      reviews: (day?.reviews ?? 0) + 1,
      newItems: (day?.newItems ?? 0) + (isNewItem ? 1 : 0),
    });

    const queue = [...input.session.queue];
    // Carte en apprentissage : revue une nouvelle fois un peu plus loin dans la séance
    if (next.due.getTime() - now.getTime() < REQUEUE_WITHIN_MS) {
      queue.splice(Math.min(queue.length, input.session.position + 1 + REQUEUE_GAP), 0, { kind: 'review', cardId: card.id });
    }
    const updated: ActiveSession = {
      ...input.session,
      queue,
      position: input.session.position + 1,
      results: [...input.session.results, { cardId: card.id, rating: input.grade as 1 | 2 | 3 | 4, isNew: isNewItem }],
    };
    // Le temps actif est géré séparément (addActiveTime) : on relit la valeur à jour
    const stored = await db.sessions.get(updated.id);
    updated.activeMs = stored?.activeMs ?? updated.activeMs;
    await db.sessions.put(updated);
    return updated;
  });
}

/** Termine la séance (et valide la journée si c'était une séance express terminée). */
export async function finishSession(session: ActiveSession, completed: boolean): Promise<void> {
  await db.transaction('rw', db.sessions, db.days, async () => {
    await db.sessions.update(session.id, { status: 'done' });
    if (session.express && completed) {
      const day = await db.days.get(session.day);
      await db.days.put({ ...(day ?? { day: session.day, activeMs: 0, reviews: 0, newItems: 0 }), expressDone: true });
    }
  });
}

/** Ajoute du temps à une séance (« +5 min ») en recomposant la suite. */
export async function extendSession(
  catalog: Catalog,
  session: ActiveSession,
  minutes: number,
  voiceAvailable: boolean,
): Promise<ActiveSession> {
  const done = new Set(session.results.map((r) => r.cardId));
  const plan = await planSession(catalog, { durationMin: minutes, context: session.context, voiceAvailable, exclude: done });
  const updated: ActiveSession = {
    ...session,
    extraMin: session.extraMin + minutes,
    queue: [...session.queue.slice(0, session.position), ...plan.queue],
    status: 'running',
  };
  await db.sessions.put(updated);
  return updated;
}

/** Change le contexte en cours de séance : la suite est recomposée pour le temps restant. */
export async function changeContext(
  catalog: Catalog,
  session: ActiveSession,
  context: SessionContext,
  voiceAvailable: boolean,
): Promise<ActiveSession> {
  const remainingMin = Math.max(1, (session.durationMin + session.extraMin) - session.activeMs / 60000);
  const done = new Set(session.results.map((r) => r.cardId));
  const plan = await planSession(catalog, { durationMin: remainingMin, context, voiceAvailable, exclude: done });
  const updated: ActiveSession = { ...session, context, queue: [...session.queue.slice(0, session.position), ...plan.queue] };
  await db.sessions.put(updated);
  return updated;
}
