// Les cartes d'une séance (SPEC §4) : écriture, sens, pinyin, écoute, et la fiche de découverte.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { speak } from '../audio/speech';
import { useCatalog } from '../data/CatalogContext';
import type { CharEntry, WordEntry } from '../data/types';
import { parseItemKey, type CardType } from '../db/model';
import { parseNumeric } from '../lib/pinyin';
import { checkPinyin } from '../srs/pinyinCheck';
import { Definitions, SpeakButton } from '../ui/Definitions';
import { Pinyin, ReadingNote, ToneHanzi } from '../ui/Pinyin';
import { RatingPanel, describeResult } from '../ui/Rating';
import { WritingPrompt } from '../ui/WritingPrompt';
import { CharacterAnimation } from '../writing/CharacterAnimation';
import { GRADE, RATINGS, RATING_LABELS, gradeWriting, type Rating, type WritingResult } from '../writing/grading';
import { WritingQuiz } from '../writing/WritingQuiz';

export interface CardProps {
  itemKey: string;
  /** Lecture audio automatique autorisée (contexte ≠ silence) */
  audio: boolean;
  onRated: (grade: 1 | 2 | 3 | 4, autoGrade?: 1 | 2 | 3 | 4, detail?: unknown) => void;
}

function useEntry(itemKey: string): { text: string; kind: 'char' | 'word'; entry: CharEntry | WordEntry | undefined } {
  const catalog = useCatalog();
  const { kind, text } = parseItemKey(itemKey);
  return { text, kind, entry: kind === 'char' ? catalog.char(text) : catalog.word(text) };
}

/** Écoute le clavier tant que le composant est affiché (ignoré dans les champs de saisie). */
function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Boutons d'auto-évaluation (touches 1-4). */
function SelfRate({ onRate }: { onRate: (r: Rating) => void }) {
  useKeys((e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 4) onRate(RATINGS[n - 1]);
  });
  return (
    <div className="rating-buttons self-rate">
      {RATINGS.map((r, i) => (
        <button key={r} className={`rating-button rating-${r}`} onClick={() => onRate(r)}>
          {RATING_LABELS[r]}
          <small className="hint-keyboard">{i + 1}</small>
        </button>
      ))}
    </div>
  );
}

function RevealButton({ onReveal }: { onReveal: () => void }) {
  useKeys((e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onReveal();
    }
  });
  return (
    <button className="primary next-button" onClick={onReveal}>
      Afficher la réponse <span className="hint-keyboard">(Espace)</span>
    </button>
  );
}

function Answer({ text, kind, entry, audio }: { text: string; kind: 'char' | 'word'; entry: CharEntry | WordEntry; audio: boolean }) {
  const catalog = useCatalog();
  const reading = entry.rd[0];
  const context = kind === 'char' ? catalog.contextWord(text) : undefined;
  useEffect(() => {
    if (audio) speak(text);
  }, [audio, text]);
  return (
    <div className="card-answer">
      <div className="reading-line">
        <Pinyin numeric={reading.p} className="big" />
        <SpeakButton text={text} />
      </div>
      <Definitions reading={reading} max={4} />
      {context && (
        <p className="muted">
          <span className="hanzi">{context.w}</span> <Pinyin numeric={context.rd[0].p} />{' '}
          <ReadingNote syllable={catalog.syllableIn(context, text)} main={reading.p} /> · {context.rd[0].fr?.slice(0, 2).join(' ; ')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MeaningCard({ itemKey, audio, onRated }: CardProps) {
  const { text, kind, entry } = useEntry(itemKey);
  const [revealed, setRevealed] = useState(false);
  if (!entry) return <MissingEntry text={text} onRated={onRated} />;
  return (
    <div className="study-card">
      <p className="card-type">Que signifie…</p>
      <ToneHanzi text={text} numeric={revealed ? entry.rd[0].p : ''} className={`card-hanzi ${text.length > 2 ? 'long' : ''}`} />
      {revealed ? (
        <>
          <Answer text={text} kind={kind} entry={entry} audio={audio} />
          <SelfRate onRate={(r) => onRated(GRADE[r])} />
        </>
      ) : (
        <RevealButton onReveal={() => setRevealed(true)} />
      )}
    </div>
  );
}

export function ListeningCard({ itemKey, onRated }: CardProps) {
  const { text, kind, entry } = useEntry(itemKey);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    speak(text);
  }, [text]);
  useKeys((e) => {
    if (e.key === 'r' || e.key === 'R') speak(text);
  });
  if (!entry) return <MissingEntry text={text} onRated={onRated} />;
  return (
    <div className="study-card">
      <p className="card-type">Qu'entendez-vous ?</p>
      <button className="listen-button" onClick={() => speak(text)} aria-label="Réécouter">
        🔊
      </button>
      <p className="muted small hint-keyboard">R : réécouter</p>
      {revealed ? (
        <>
          <ToneHanzi text={text} numeric={entry.rd[0].p} className={`card-hanzi ${text.length > 2 ? 'long' : ''}`} />
          <Answer text={text} kind={kind} entry={entry} audio={false} />
          <SelfRate onRate={(r) => onRated(GRADE[r])} />
        </>
      ) : (
        <RevealButton onReveal={() => setRevealed(true)} />
      )}
    </div>
  );
}

export function PinyinCard({ itemKey, audio, onRated }: CardProps) {
  const { text, kind, entry } = useEntry(itemKey);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<{ auto: Rating; value: Rating; description: string; result: ReturnType<typeof checkPinyin> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!entry || !input.trim()) return;
    // Plusieurs lectures possibles (了 le / liǎo) : on garde la meilleure
    const results = entry.rd.map((r) => checkPinyin(r.p, input));
    const result = results.find((r) => r.tonesOk) ?? results.find((r) => r.lettersOk) ?? results[0];
    const auto: Rating = result.tonesOk ? 'good' : result.lettersOk ? 'hard' : 'again';
    const description = result.tonesOk ? 'Correct' : result.lettersOk ? 'Ton(s) faux' : 'Syllabe(s) fausse(s)';
    setChecked({ auto, value: auto, description, result });
    inputRef.current?.blur();
    if (audio) speak(text);
  };

  const next = useCallback(() => {
    if (checked) onRated(GRADE[checked.value], GRADE[checked.auto], { input });
  }, [checked, input, onRated]);

  if (!entry) return <MissingEntry text={text} onRated={onRated} />;
  const expected = parseNumeric(entry.rd[0].p);

  return (
    <div className="study-card">
      <p className="card-type">Tapez le pinyin avec les tons</p>
      <span className={`hanzi card-hanzi ${text.length > 2 ? 'long' : ''}`}>{text}</span>
      <form
        className="pinyin-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ex. xue2sheng1"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          readOnly={!!checked}
          aria-label="Pinyin"
        />
        {!checked && (
          <button className="primary" type="submit">
            Vérifier
          </button>
        )}
      </form>
      {!checked && <p className="muted small">Chiffre après chaque syllabe (1 à 4, 5 ou rien pour le ton neutre), ü = v</p>}
      {checked && (
        <>
          <p className="pinyin-feedback">
            {checked.result.syllables.map((s, i) => (
              <span key={i} className={s.lettersOk && s.tone === s.expectedTone ? 'ok' : 'ko'}>
                <span className={`tone${expected[i]?.tone ?? 5}`}>{s.expected}</span>
              </span>
            ))}
          </p>
          <Answer text={text} kind={kind} entry={entry} audio={false} />
          <RatingPanel
            auto={checked.auto}
            value={checked.value}
            description={checked.description}
            onChange={(value) => setChecked((c) => (c ? { ...c, value } : c))}
            onNext={next}
          />
        </>
      )}
    </div>
  );
}

export function WritingCard({ itemKey, audio, onRated }: CardProps) {
  const { text, entry } = useEntry(itemKey);
  const catalog = useCatalog();
  const [done, setDone] = useState<{ result: WritingResult; auto: Rating; value: Rating } | null>(null);
  const char = catalog.char(text);

  const onDone = useCallback(
    (result: WritingResult) => {
      const auto = gradeWriting(result);
      setDone({ result, auto, value: auto });
      if (audio) speak(catalog.contextWord(text)?.w ?? text);
    },
    [audio, catalog, text],
  );

  const next = useCallback(() => {
    if (done) onRated(GRADE[done.value], GRADE[done.auto], { mistakesPerStroke: done.result.mistakesPerStroke });
  }, [done, onRated]);

  if (!char || !entry) return <MissingEntry text={text} onRated={onRated} />;
  return (
    <div className="study-card">
      <WritingPrompt entry={char} reveal={!!done} />
      <WritingQuiz entry={char} mode="memory" onDone={onDone} />
      {done && (
        <RatingPanel
          auto={done.auto}
          value={done.value}
          description={describeResult(done.result)}
          onChange={(value) => setDone((d) => (d ? { ...d, value } : d))}
          onNext={next}
        />
      )}
    </div>
  );
}

/** Fiche de découverte d'un nouvel élément (SPEC §9.5). */
export function DiscoveryCard({ itemKey, audio, onContinue }: { itemKey: string; audio: boolean; onContinue: () => void }) {
  const { text, kind, entry } = useEntry(itemKey);
  const catalog = useCatalog();
  useEffect(() => {
    if (audio) speak(text);
  }, [audio, text]);
  useKeys((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onContinue();
    }
  });
  if (!entry) return null;
  const reading = entry.rd[0];
  const char = kind === 'char' ? catalog.char(text) : undefined;
  const words = kind === 'char' ? catalog.wordsWithChar(text, 3) : [];
  const chars = kind === 'word' ? [...text].map((c) => catalog.char(c)).filter((c): c is CharEntry => !!c) : [];

  return (
    <div className="study-card discovery">
      <p className="card-type new-badge">Nouveau {kind === 'char' ? 'caractère' : 'mot'}</p>
      {char ? (
        <CharacterAnimation entry={char} size={Math.max(160, Math.min(220, window.innerWidth - 80))} />
      ) : (
        <ToneHanzi text={text} numeric={reading.p} className={`card-hanzi ${text.length > 2 ? 'long' : ''}`} />
      )}
      <div className="reading-line">
        <Pinyin numeric={reading.p} className="big" />
        <SpeakButton text={text} />
      </div>
      <Definitions reading={reading} max={4} />
      {char?.e?.t === 'pictophonetic' && (char.e.s || char.e.p) && (
        <p className="muted">
          {char.e.s && <><span className="hanzi">{char.e.s}</span> donne le sens</>}
          {char.e.s && char.e.p && ', '}
          {char.e.p && <><span className="hanzi">{char.e.p}</span> donne le son</>}
        </p>
      )}
      {words.length > 0 && (
        <ul className="mini-list">
          {words.map((w) => (
            <li key={w.w}>
              <span className="hanzi">{w.w}</span> <Pinyin numeric={w.rd[0].p} /> · {w.rd[0].fr?.[0] ?? w.rd[0].en?.[0]}
            </li>
          ))}
        </ul>
      )}
      {chars.length > 0 && (
        <ul className="mini-list">
          {chars.map((c) => (
            <li key={c.c}>
              <span className="hanzi">{c.c}</span> <Pinyin numeric={c.rd[0].p} /> · {c.rd[0].fr?.[0] ?? c.rd[0].en?.[0]}
            </li>
          ))}
        </ul>
      )}
      <button className="primary next-button" onClick={onContinue}>
        Continuer <span className="hint-keyboard">⏎</span>
      </button>
    </div>
  );
}

/** Élément absent du catalogue (données modifiées) : on permet de passer. */
function MissingEntry({ text, onRated }: { text: string; onRated: CardProps['onRated'] }) {
  return (
    <div className="study-card">
      <p>« {text} » est introuvable dans le dictionnaire.</p>
      <button onClick={() => onRated(3)}>Passer</button>
    </div>
  );
}

export const CARD_COMPONENTS: Record<CardType, ((p: CardProps) => ReactElement) | undefined> = {
  writing: WritingCard,
  meaning: MeaningCard,
  pinyin: PinyinCard,
  listening: ListeningCard,
  speaking: undefined,
};
