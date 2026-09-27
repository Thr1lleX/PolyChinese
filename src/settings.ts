// Réglages de l'utilisateur. Stockés localement (localStorage) en attendant la base IndexedDB (étape 3).
import { useSyncExternalStore } from 'react';

export type ToleranceMode = 'auto' | 'mouse' | 'touch' | 'strict';

export interface Settings {
  /** Tolérance du tracé : auto = selon le pointeur détecté */
  tolerance: ToleranceMode;
  /** Nombre d'erreurs sur un même trait avant affichage automatique de l'indice */
  hintAfterMisses: number;
  /** Grille 米字格 en fond */
  showGrid: boolean;
  /** Nombre de caractères par série d'entraînement */
  practiceSize: number;
}

const DEFAULTS: Settings = {
  tolerance: 'auto',
  hintAfterMisses: 3,
  showGrid: true,
  practiceSize: 20,
};

const KEY = 'polychinese.settings';
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = read();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // stockage indisponible (navigation privée) : réglage gardé pour la session
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSettings,
  );
}

/** Valeurs de « leniency » de Hanzi Writer (1 = défaut ; plus grand = plus indulgent). */
export const LENIENCY: Record<Exclude<ToleranceMode, 'auto'>, number> = {
  strict: 0.8,
  touch: 1.0,
  mouse: 1.5,
};

export const TOLERANCE_LABELS: Record<ToleranceMode, string> = {
  auto: 'Automatique',
  mouse: 'Souris (indulgente)',
  touch: 'Doigt / stylet',
  strict: 'Stricte',
};

/** Pointeur principal : souris/pavé tactile (fin) ou doigt (grossier). */
export function detectedPointer(): 'mouse' | 'touch' {
  return matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
}

export function effectiveTolerance(mode: ToleranceMode): Exclude<ToleranceMode, 'auto'> {
  return mode === 'auto' ? detectedPointer() : mode;
}
