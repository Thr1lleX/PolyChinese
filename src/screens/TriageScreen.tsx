// Tri rapide après import (SPEC §10.2) : « je connais bien », « à peu près », « à réapprendre ».
// Clavier : Espace = révéler, 1/2/3 = choisir, Retour arrière = annuler. Mobile : glisser → / ←.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { unlockedWords } from '../data/unlocked';
import { useDeck, useItemsMap, useMasteryMap } from '../db/hooks';
import { knownCharsFrom } from '../db/mastery';
import { TRIAGE_LABELS, parseItemKey, type TriageStatus } from '../db/model';
import { setTriage } from '../db/repo';
import { Definitions, SpeakButton } from '../ui/Definitions';
import { Pinyin, ReadingNote } from '../ui/Pinyin';

export const UNLOCKED_DECK_NAME = 'Mots débloqués';

type Choice = Exclude<TriageStatus, 'pending'>;

export function TriageScreen() {
  const { deckId = '' } = useParams();
  const deck = useDeck(Number(deckId));
  const items = useItemsMap();
  const status = useMasteryMap();
  const catalog = useCatalog();
  const [history, setHistory] = useState<string[]>([]);

  if (deck === undefined || !items) return null;
  if (deck === null) return <p className="screen">Liste introuvable.</p>;

  // Pour les mots débloqués, la 3e option signifie « jamais appris » plutôt que « à réapprendre »
  const thirdChoice: Choice = deck.name === UNLOCKED_DECK_NAME ? 'new' : 'relearn';
  const choices: Choice[] = ['known', 'fuzzy', thirdChoice];
  const labels: Record<Choice, string> = {
    known: 'Je connais bien',
    fuzzy: 'À peu près',
    relearn: 'À réapprendre',
    new: 'Pas encore appris',
  };

  const pending = deck.itemKeys.filter((k) => items.get(k)?.triage === 'pending');
  const total = deck.itemKeys.length;

  if (!pending.length) {
    const counts = new Map<TriageStatus, number>();
    for (const k of deck.itemKeys) {
      const t = items.get(k)?.triage;
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const known = knownCharsFrom(status);
    const owned = new Set(items.keys());
    const unlocked = unlockedWords(catalog.words, known, owned);
    return (
      <div className="screen narrow">
        <h1>Tri terminé 🎉</h1>
        <p>
          Liste <strong>{deck.name}</strong> : {total} élément{total > 1 ? 's' : ''}.
        </p>
        <ul className="plain-list">
          {[...counts].map(([status, n]) => (
            <li key={status}>
              <span className={`status-dot status-${status}`} /> {TRIAGE_LABELS[status]} : <strong>{n}</strong>
            </li>
          ))}
        </ul>
        {unlocked.length > 0 && (
          <div className="callout">
            Avec vos {known.size} caractères connus, <strong>{unlocked.length} mots courants</strong> sont débloqués : vous
            connaissez déjà tous leurs caractères.
            <div className="actions-row compact">
              <Link to="/listes/debloques" className="button-link primary">
                Voir les mots débloqués
              </Link>
            </div>
          </div>
        )}
        <div className="actions-row">
          <Link to={`/listes/${deck.id}`}>Voir la liste</Link>
          <Link to="/listes">Mes listes</Link>
        </div>
      </div>
    );
  }

  return (
    <TriageCard
      key={pending[0]}
      itemKeyValue={pending[0]}
      position={total - pending.length + 1}
      total={total}
      choices={choices}
      labels={labels}
      onChoose={async (choice) => {
        await setTriage(pending[0], choice);
        setHistory((h) => [...h, pending[0]]);
      }}
      onUndo={
        history.length
          ? async () => {
              const last = history[history.length - 1];
              await setTriage(last, 'pending');
              setHistory((h) => h.slice(0, -1));
            }
          : undefined
      }
      deckName={deck.name}
    />
  );
}

function TriageCard({
  itemKeyValue,
  position,
  total,
  choices,
  labels,
  onChoose,
  onUndo,
  deckName,
}: {
  itemKeyValue: string;
  position: number;
  total: number;
  choices: Choice[];
  labels: Record<Choice, string>;
  onChoose: (c: Choice) => Promise<void>;
  onUndo?: () => Promise<void>;
  deckName: string;
}) {
  const catalog = useCatalog();
  const { kind, text } = parseItemKey(itemKeyValue);
  const entry = kind === 'char' ? catalog.char(text) : catalog.word(text);
  const context = kind === 'char' ? catalog.contextWord(text) : undefined;
  const [revealed, setRevealed] = useState(false);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const busy = useRef(false);

  const choose = useCallback(
    async (c: Choice) => {
      if (busy.current) return;
      busy.current = true;
      await onChoose(c);
    },
    [onChoose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        setRevealed(true);
      } else if (['1', '2', '3'].includes(e.key)) {
        choose(choices[Number(e.key) - 1]);
      } else if (e.key === 'Backspace' && onUndo) {
        onUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, choices, onUndo]);

  const reading = entry?.rd[0];
  const SWIPE = 90;

  return (
    <div className="screen narrow practice">
      <div className="practice-top">
        <Link to="/listes">✕ Interrompre</Link>
        <span className="muted">
          {position} / {total}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${((position - 1) / total) * 100}%` }} />
      </div>
      <p className="muted small center">{deckName} · reprise possible à tout moment</p>

      <div
        className={`triage-card ${dx > SWIPE ? 'swipe-right' : dx < -SWIPE ? 'swipe-left' : ''}`}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)` }}
        onClick={() => setRevealed(true)}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          if (drag.current?.id === e.pointerId && e.pointerType !== 'mouse') setDx(e.clientX - drag.current.x);
        }}
        onPointerUp={() => {
          const d = dx;
          drag.current = null;
          setDx(0);
          if (d > SWIPE) choose('known');
          else if (d < -SWIPE) choose(choices[2]);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDx(0);
        }}
      >
        <div className={`hanzi triage-hanzi ${kind === 'word' && text.length > 2 ? 'long' : ''}`}>{text}</div>
        {revealed && reading ? (
          <div className="triage-answer">
            <div className="reading-line">
              <Pinyin numeric={reading.p} className="big" />
              <SpeakButton text={text} />
            </div>
            <Definitions reading={reading} max={4} />
            {context && (
              <p className="muted">
                <span className="hanzi">{context.w}</span> <Pinyin numeric={context.rd[0].p} />{' '}
                <ReadingNote syllable={catalog.syllableIn(context, text)} main={reading.p} /> · {context.rd[0].fr?.[0]}
              </p>
            )}
          </div>
        ) : (
          <p className="muted small">Touchez la carte pour révéler</p>
        )}
      </div>

      <div className="triage-buttons">
        {choices.map((c, i) => (
          <button key={c} className={`triage-${c}`} onClick={() => choose(c)}>
            <kbd>{i + 1}</kbd> {labels[c]}
          </button>
        ))}
      </div>
      <p className="muted small center hint-touch">
        Glissez vers la droite pour « {labels.known} », vers la gauche pour « {labels[choices[2]]} ».
      </p>
      <p className="muted small center hint-keyboard">Espace : révéler · 1, 2, 3 : choisir · Retour arrière : annuler</p>
      {onUndo && (
        <button className="link-button center" onClick={() => onUndo()}>
          ↶ Annuler le dernier choix
        </button>
      )}
    </div>
  );
}
