import { useLiveQuery } from 'dexie-react-hooks';
import { State } from 'ts-fsrs';
import { db } from '../db/db';
import { MASTERY_LABELS, computeMastery, type Mastery } from '../db/mastery';
import { TRIAGE_LABELS, itemKey, type ItemKind, type TriageStatus } from '../db/model';
import { addItem, removeItem, setTriage } from '../db/repo';

/** Couleur de pastille de chaque statut (classes de styles-lists.css). */
const DOT_CLASS: Record<Mastery, string> = {
  known: 'status-known',
  learning: 'status-fuzzy',
  review: 'status-relearn',
  new: 'status-new',
  pending: 'status-pending',
};

export function StatusDot({ status }: { status: Mastery | undefined }) {
  if (!status) return null;
  return <span className={`status-dot ${DOT_CLASS[status]}`} title={MASTERY_LABELS[status]} aria-label={MASTERY_LABELS[status]} />;
}

const RESET_CHOICES: Exclude<TriageStatus, 'pending'>[] = ['known', 'fuzzy', 'relearn', 'new'];

/** Encadré « mes éléments » d'une fiche : statut d'apprentissage, listes, ajout, réinitialisation, retrait. */
export function ItemStatus({ kind, text }: { kind: ItemKind; text: string }) {
  const key = itemKey(kind, text);
  const data = useLiveQuery(async () => {
    const item = await db.items.get(key);
    if (!item) return null;
    const [cards, decks, reviews] = await Promise.all([
      db.cards.where('itemKey').equals(key).toArray(),
      db.decks.toArray(),
      db.reviewLogs.where('itemKey').equals(key).count(),
    ]);
    return {
      item,
      cards,
      reviews,
      deckNames: decks.filter((d) => d.itemKeys.includes(key)).map((d) => d.name),
    };
  }, [key]);

  if (data === undefined) return null;

  if (data === null) {
    return (
      <div className="item-status">
        <span className="muted">Pas encore dans vos éléments</span>
        <div className="actions-row compact">
          <button onClick={() => addItem(kind, text, 'known')}>Je le connais déjà</button>
          <button className="primary" onClick={() => addItem(kind, text, 'new')}>
            ＋ À apprendre
          </button>
        </div>
      </div>
    );
  }

  const mastery = computeMastery(data.item, data.cards);
  const started = data.cards.filter((c) => c.fsrs.state !== State.New);
  const nextDue = started.length ? new Date(Math.min(...started.map((c) => c.due.getTime()))) : null;
  const days = nextDue ? Math.round((nextDue.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="item-status">
      <span className="status-label">
        <StatusDot status={mastery} /> <strong>{MASTERY_LABELS[mastery]}</strong>
        {days !== null && (
          <span className="muted"> · prochaine révision {days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} j`}</span>
        )}
      </span>
      {data.deckNames.length > 0 && <span className="muted">Listes : {data.deckNames.join(', ')}</span>}
      <details className="item-reset">
        <summary>Modifier</summary>
        <label className="status-select">
          <span className="muted small">Repartir comme :</span>
          <select
            value=""
            onChange={(e) => {
              const status = e.target.value as TriageStatus;
              if (!status) return;
              if (data.reviews > 0 && !confirm(`Repartir de zéro pour ${text} ? Son historique de révision ne comptera plus.`)) return;
              setTriage(key, status);
            }}
          >
            <option value="">—</option>
            {RESET_CHOICES.map((s) => (
              <option key={s} value={s}>
                {TRIAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button className="link-button" onClick={() => confirm(`Retirer ${text} de vos éléments ?`) && removeItem(key)}>
          Retirer de mes éléments
        </button>
      </details>
    </div>
  );
}
