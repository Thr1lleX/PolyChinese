// Import par collage (SPEC §10.1).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/CatalogContext';
import { useItemsMap } from '../db/hooks';
import { itemKey, type ItemKind } from '../db/model';
import { addToDeck } from '../db/repo';
import { extractChars, extractWords } from '../import/parse';

const today = () => new Date().toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' });

export function ImportScreen() {
  const catalog = useCatalog();
  const items = useItemsMap();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ItemKind>('char');
  const [text, setText] = useState('');
  const [name, setName] = useState(() => `Import du ${today()}`);
  const [busy, setBusy] = useState(false);
  const [withChars, setWithChars] = useState(true);

  const parsed = useMemo(
    () =>
      kind === 'char'
        ? extractChars(text, (c) => !!catalog.char(c))
        : extractWords(text, (w) => {
            const entry = catalog.word(w);
            // Mot sans fréquence connue : rare, sauf s'il est au HSK
            return entry ? (entry.f ?? (entry.h ? 5000 : 200000)) : undefined;
          }),
    [kind, text, catalog],
  );
  const already = parsed.found.filter((t) => items?.has(itemKey(kind, t))).length;
  const unit = kind === 'char' ? 'caractère' : 'mot';
  const plural = (n: number) => `${n} ${unit}${n > 1 ? 's' : ''}`;

  const wordChars = useMemo(
    () => (kind === 'word' ? [...new Set(parsed.found.flatMap((w) => [...w]))].filter((c) => !!catalog.char(c)) : []),
    [kind, parsed, catalog],
  );

  const submit = async () => {
    setBusy(true);
    const { deckId, pending } = await addToDeck(
      name.trim() || `Import du ${today()}`,
      [
        ...parsed.found.map((t) => ({ kind, text: t })),
        // Les caractères des mots importés, pour travailler leur écriture
        ...(kind === 'word' && withChars ? wordChars.map((c) => ({ kind: 'char' as const, text: c })) : []),
      ],
    );
    navigate(pending > 0 ? `/tri/${deckId}` : `/listes/${deckId}`);
  };

  return (
    <div className="screen narrow">
      <h1>Importer</h1>
      <p className="muted">
        Collez n'importe quel texte : une liste, un tableau copié, une leçon entière. Pour un cours papier, la fonction
        « Copier le texte » de Google Lens sur votre téléphone permet de récupérer le texte d'une photo.
      </p>

      <div className="form">
        <div className="segmented" role="radiogroup" aria-label="Type d'import">
          {(['char', 'word'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
              {k === 'char' ? 'Caractères' : 'Mots'}
            </button>
          ))}
        </div>
        <p className="muted small">
          {kind === 'char'
            ? 'Chaque caractère chinois distinct du texte est importé.'
            : 'Une entrée par ligne ou séparée par des virgules (学生, 老师, 朋友). Un texte continu (我是学生) est découpé automatiquement en mots. Chaque mot reçoit des cartes de sens, de pinyin et d’écoute.'}
        </p>

        <label className="field">
          <span>Texte</span>
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'char' ? '我你他好学生老师…' : '学生\n老师\n朋友, 喜欢'} />
        </label>

        <label className="field">
          <span>Nom de la liste</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {text.trim() && (
          <div className="import-preview">
            <p>
              <strong>{plural(parsed.found.length)}</strong> trouvé{parsed.found.length > 1 ? 's' : ''}
              {already > 0 && <span className="muted"> · {already} déjà dans vos éléments (gardent leur statut)</span>}
            </p>
            {parsed.found.length > 0 && (
              <p className="hanzi preview-items">{parsed.found.slice(0, 300).join(kind === 'char' ? ' ' : '、')}</p>
            )}
            {parsed.unknown.length > 0 && (
              <p className="muted small">
                Ignorés (absents du dictionnaire) : <span className="hanzi">{parsed.unknown.join(' ')}</span>
              </p>
            )}
          </div>
        )}

        {kind === 'word' && wordChars.length > 0 && (
          <label className="field checkbox">
            <input type="checkbox" checked={withChars} onChange={(e) => setWithChars(e.target.checked)} />
            <span>
              Ajouter aussi leurs {wordChars.length} caractères (cartes d'écriture)
              {wordChars.some((c) => items?.has(itemKey('char', c))) && (
                <span className="muted small"> — ceux déjà dans vos éléments gardent leur statut</span>
              )}
            </span>
          </label>
        )}

        <button className="primary" disabled={!parsed.found.length || busy} onClick={submit}>
          Importer et trier
        </button>
      </div>
    </div>
  );
}
