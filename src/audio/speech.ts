// Lecture audio par la synthèse vocale du navigateur (voix chinoises zh-CN).
import { useSyncExternalStore } from 'react';

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // pas encore chargées
  const zh = voices.filter((v) => /^zh[-_]CN/i.test(v.lang) || /^cmn/i.test(v.lang));
  // Préférer les voix « naturelles » / en ligne, souvent de meilleure qualité
  return zh.find((v) => /natural|online|google/i.test(v.name)) ?? zh[0] ?? null;
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function hasChineseVoice(): boolean {
  if (!speechAvailable()) return false;
  cachedVoice ??= pickVoice() ?? undefined;
  return !!cachedVoice;
}

export function speak(text: string, rate = 0.8): void {
  if (!speechAvailable()) return;
  cachedVoice ??= pickVoice() ?? undefined;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  if (cachedVoice) u.voice = cachedVoice;
  speechSynthesis.speak(u);
}

if (speechAvailable()) {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = pickVoice() ?? undefined;
  });
}

/**
 * Voix chinoise disponible, mise à jour quand le navigateur finit de charger ses voix
 * (elles arrivent souvent après le premier affichage, notamment sur Android).
 */
export function useChineseVoice(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!speechAvailable()) return () => {};
      const handler = () => {
        cachedVoice = pickVoice() ?? undefined;
        onChange();
      };
      speechSynthesis.addEventListener?.('voiceschanged', handler);
      return () => speechSynthesis.removeEventListener?.('voiceschanged', handler);
    },
    hasChineseVoice,
  );
}
