import { speak } from '../audio/speech';
import type { Reading } from '../data/types';

/** Traductions d'une lecture ; l'anglais (secours CC-CEDICT) est signalé. */
export function Definitions({ reading, max }: { reading: Reading; max?: number }) {
  const english = !reading.fr?.length;
  const defs = (reading.fr?.length ? reading.fr : (reading.en ?? [])).slice(0, max);
  if (!defs.length) return <span className="muted">Pas de traduction</span>;
  return (
    <span className="defs">
      {english && (
        <span className="badge" title="Pas de traduction française disponible : traduction anglaise (CC-CEDICT)">
          EN
        </span>
      )}
      {defs.join(' ; ')}
    </span>
  );
}

export function SpeakButton({ text, label = 'Écouter' }: { text: string; label?: string }) {
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={() => speak(text)}
    >
      🔊
    </button>
  );
}
