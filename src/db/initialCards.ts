// Création des cartes d'un élément selon le résultat du tri (SPEC §10.2).
import { State, createEmptyCard, type Card as FsrsCard } from 'ts-fsrs';
import { DEFAULT_CARD_TYPES, type CardRecord, type ItemKind, type TriageStatus } from './model';

const DAY = 24 * 60 * 60 * 1000;

interface InitialState {
  stability: number;
  difficulty: number;
  /** Échéance tirée entre ces deux bornes (jours) */
  dueMin: number;
  dueMax: number;
}

/** « Je connais bien » : stabilité ~20 j, échéance sur 30 j. « À peu près » : ~3 j, sur 7 j. */
export const INITIAL_REVIEW_STATE: Partial<Record<TriageStatus, InitialState>> = {
  known: { stability: 20, difficulty: 4, dueMin: 1, dueMax: 30 },
  fuzzy: { stability: 3, difficulty: 6, dueMin: 1, dueMax: 7 },
};

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(4, 0, 0, 0); // bascule de journée d'étude à 4 h (SPEC §9.6)
  return x.getTime();
}

/**
 * Cartes d'un élément trié. Les cartes « sœurs » d'un élément connu tombent des jours différents
 * pour qu'une carte ne donne pas la réponse de l'autre (SPEC §4).
 */
export function initialCards(
  key: string,
  kind: ItemKind,
  triage: Exclude<TriageStatus, 'pending'>,
  now: Date,
  random: () => number = Math.random,
): CardRecord[] {
  const state = INITIAL_REVIEW_STATE[triage];
  const usedDays = new Set<number>();

  return DEFAULT_CARD_TYPES[kind].map((type) => {
    let fsrs: FsrsCard = createEmptyCard(now);
    if (state) {
      const span = state.dueMax - state.dueMin + 1;
      let offset = state.dueMin + Math.floor(random() * span);
      // Décaler si une carte sœur tombe déjà ce jour-là (tant qu'il reste des jours libres)
      for (let tries = 0; usedDays.has(offset) && tries < span; tries++) {
        offset = state.dueMin + ((offset - state.dueMin + 1) % span);
      }
      usedDays.add(offset);
      const due = new Date(startOfDay(now) + offset * DAY);
      fsrs = {
        ...fsrs,
        state: State.Review,
        stability: state.stability,
        difficulty: state.difficulty,
        due,
        last_review: now,
        scheduled_days: offset,
        reps: 1,
      };
    }
    return {
      id: `${key}|${type}`,
      itemKey: key,
      type,
      fsrs,
      due: fsrs.due,
      ...(triage === 'relearn' ? { priority: true } : {}),
      createdAt: now,
    };
  });
}
