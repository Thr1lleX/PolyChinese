// Réglages (SPEC §11) et sauvegarde.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadBackup, parseBackup, restoreBackup, wipeUserData, type Backup } from '../db/backup';
import { updateSettings, useSettings } from '../settings';
import { ToleranceSelect } from '../ui/ToleranceSelect';

export function SettingsScreen() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash.endsWith('#sauvegarde')) document.getElementById('sauvegarde')?.scrollIntoView();
  }, []);

  const number = (key: 'dailyMinutes' | 'maxNewPerDay' | 'dayCutoffHour' | 'jokersPerWeek', min: number, max: number) => (
    <input
      type="number"
      min={min}
      max={max}
      value={settings[key]}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (v >= min && v <= max) updateSettings({ [key]: v });
      }}
    />
  );

  return (
    <div className="screen narrow">
      <p>
        <Link to="/">← Accueil</Link>
      </p>
      <h1>Réglages</h1>

      <section className="form">
        <h2>Séances</h2>
        <label className="field">
          <span>Temps quotidien visé (minutes) — sert à doser les nouveautés</span>
          {number('dailyMinutes', 5, 120)}
        </label>
        <label className="field">
          <span>Nouveaux éléments par jour, au maximum (le nombre réel s'adapte à votre charge)</span>
          {number('maxNewPerDay', 0, 30)}
        </label>
        <label className="field">
          <span>Rétention visée : {Math.round(settings.retention * 100)} %</span>
          <input
            type="range"
            min={0.8}
            max={0.95}
            step={0.01}
            value={settings.retention}
            onChange={(e) => updateSettings({ retention: Number(e.target.value) })}
          />
          <span className="muted small">Plus haut = moins d'oublis mais plus de révisions. 90 % est un bon équilibre.</span>
        </label>
        <label className="field">
          <span>Changement de journée (heure) — une séance à 1 h compte pour la veille</span>
          {number('dayCutoffHour', 0, 8)}
        </label>
        <label className="field">
          <span>Jokers de régularité par semaine</span>
          {number('jokersPerWeek', 0, 7)}
        </label>
      </section>

      <section className="form">
        <h2>Écriture</h2>
        <ToleranceSelect />
        <label className="field">
          <span>Indice automatique après … erreurs sur un trait</span>
          <input
            type="number"
            min={1}
            max={9}
            value={settings.hintAfterMisses}
            onChange={(e) => updateSettings({ hintAfterMisses: Math.max(1, Math.min(9, Number(e.target.value))) })}
          />
        </label>
        <label className="field checkbox">
          <input type="checkbox" checked={settings.showGrid} onChange={(e) => updateSettings({ showGrid: e.target.checked })} />
          <span>Grille d'aide 米字格</span>
        </label>
      </section>

      <section className="form" id="sauvegarde">
        <h2>Sauvegarde</h2>
        <p className="muted small">
          Vos données restent dans ce navigateur. Exportez-les régulièrement : le fichier permet de les restaurer ou de
          les copier sur un autre appareil.
          {settings.lastExportAt && <> Dernière sauvegarde : {new Date(settings.lastExportAt).toLocaleString('fr')}.</>}
        </p>
        <div className="actions-row compact">
          <button className="primary" onClick={() => downloadBackup().then(() => setMessage('Sauvegarde téléchargée.'))}>
            💾 Exporter mes données
          </button>
          <button onClick={() => fileRef.current?.click()}>📂 Importer une sauvegarde</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                setPending(parseBackup(await file.text()));
                setMessage(null);
              } catch (err) {
                setMessage(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </div>
        {pending && (
          <div className="callout">
            Sauvegarde du {new Date(pending.exportedAt).toLocaleString('fr')} : {pending.items.length} éléments,{' '}
            {pending.reviewLogs.length} révisions.
            <div className="actions-row compact">
              <button
                className="primary"
                onClick={async () => {
                  await restoreBackup(pending, 'merge');
                  setPending(null);
                  setMessage('Sauvegarde fusionnée avec vos données.');
                }}
              >
                Fusionner avec mes données
              </button>
              <button
                className="danger"
                onClick={async () => {
                  if (!confirm('Remplacer toutes vos données par celles de la sauvegarde ?')) return;
                  await restoreBackup(pending, 'replace');
                  setPending(null);
                  setMessage('Données remplacées par la sauvegarde.');
                }}
              >
                Tout remplacer
              </button>
              <button className="link-button" onClick={() => setPending(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {message && <p className="callout subtle">{message}</p>}
      </section>

      <section className="form">
        <h2>Zone sensible</h2>
        <button
          className="danger"
          onClick={async () => {
            if (!confirm('Effacer tous vos éléments, cartes et historique ? Pensez à exporter avant.')) return;
            if (!confirm('Vraiment tout effacer ? Cette action est définitive.')) return;
            await wipeUserData();
            setMessage('Données effacées.');
          }}
        >
          Effacer toutes mes données
        </button>
      </section>
    </div>
  );
}
