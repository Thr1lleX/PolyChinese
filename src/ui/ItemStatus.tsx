import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useItem } from '../db/hooks';
import { TRIAGE_LABELS, itemKey, type ItemKind, type TriageStatus } from '../db/model';
import { addItem, removeItem, setTriage } from '../db/repo';

export function StatusDot({ status }: { status: TriageStatus | undefined }) {
  if (!status) return null;
  return <span className={`status-dot status-${status}`} title={TRIAGE_LABELS[status]} aria-label={TRIAGE_LABELS[status]} />;
}

const CHOICES: Exclude<TriageStatus, 'pending'>[] = ['known', 'fuzzy', 'relearn', 'new'];

/** Encadré « mes éléments » d'une fiche : statut, listes, ajout ou retrait. */
export function ItemStatus({ kind, text }: { kind: ItemKind; text: string }) {
  const key = itemKey(kind, text);
  const item = useItem(key);
  const deckNames = useLiveQuery(
    async () => (await db.decks.toArray()).filter((d) => d.itemKeys.includes(key)).map((d) => d.name),
    [key],
  );

  if (item === undefined) return null;

  if (item === null) {
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

  return (
    <div className="item-status">
      <label className="status-select">
        <StatusDot status={item.triage} />
        <select value={item.triage} onChange={(e) => setTriage(key, e.target.value as TriageStatus)}>
          {item.triage === 'pending' && <option value="pending">{TRIAGE_LABELS.pending}</option>}
          {CHOICES.map((s) => (
            <option key={s} value={s}>
              {TRIAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {deckNames && deckNames.length > 0 && <span className="muted">Listes : {deckNames.join(', ')}</span>}
      <button className="link-button" onClick={() => confirm(`Retirer ${text} de vos éléments ?`) && removeItem(key)}>
        Retirer
      </button>
    </div>
  );
}
