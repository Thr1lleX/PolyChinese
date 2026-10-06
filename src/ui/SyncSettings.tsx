// Réglages de la synchronisation entre appareils (dépôt GitHub privé + jeton d'accès).
import { useState } from 'react';
import { disableSync, enableSync, getSyncConfig, syncNow, useSyncStatus } from '../sync/syncService';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export function SyncSettings() {
  const status = useSyncStatus();
  const config = getSyncConfig();
  const [repo, setRepo] = useState(config?.repo ?? '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (config?.enabled) {
    return (
      <div className="form">
        <p>
          Synchronisé avec le dépôt <strong>{config.repo}</strong>.
          <br />
          <span className="muted small">
            {status.state === 'syncing'
              ? 'Synchronisation en cours…'
              : status.lastSyncAt
                ? `Dernière synchronisation : ${new Date(status.lastSyncAt).toLocaleString('fr')}`
                : 'Pas encore synchronisé.'}
            {status.pending && status.state !== 'syncing' && ' · modifications en attente'}
          </span>
        </p>
        {status.state === 'error' && <p className="callout">⚠ {status.error}</p>}
        <div className="actions-row compact">
          <button className="primary" disabled={status.state === 'syncing'} onClick={() => syncNow()}>
            ⟳ Synchroniser maintenant
          </button>
          <button
            className="danger"
            onClick={() => {
              if (confirm("Arrêter la synchronisation sur cet appareil ? Vos données restent ici et dans le dépôt.")) disableSync();
            }}
          >
            Désactiver sur cet appareil
          </button>
        </div>
        <p className="muted small">
          La synchronisation est automatique : au démarrage, toutes les 5 minutes, et peu après chaque révision.
        </p>
      </div>
    );
  }

  return (
    <div className="form">
      <p className="muted small">
        Vos données sont stockées dans un dépôt GitHub privé, sur votre compte. À faire une fois, puis à répéter sur chaque
        appareil à l'étape 3 :
      </p>
      <ol className="steps">
        <li>
          Un dépôt <strong>privé</strong> pour les données, par exemple <code>polychinese-data</code>.
        </li>
        <li>
          Un jeton d'accès sur <a href={TOKEN_URL} target="_blank" rel="noreferrer">GitHub → Fine-grained token</a> :
          <ul>
            <li>Expiration : 1 an (ou plus)</li>
            <li>Repository access : « Only select repositories » → votre dépôt de données</li>
            <li>Permissions → Repository permissions → <strong>Contents : Read and write</strong></li>
          </ul>
        </li>
        <li>Saisissez le dépôt et collez le jeton ci-dessous.</li>
      </ol>
      <label className="field">
        <span>Dépôt (utilisateur/nom)</span>
        <input type="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="utilisateur/polychinese-data" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </label>
      <label className="field">
        <span>Jeton d'accès (reste sur cet appareil)</span>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" />
      </label>
      <button
        className="primary"
        disabled={busy || !repo.includes('/') || !token}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          try {
            const info = await enableSync(repo, token);
            setToken('');
            setMessage(info.private ? null : "⚠ Ce dépôt est public : vos données y sont visibles. Rendez-le privé dans ses réglages GitHub.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Vérification…' : 'Activer la synchronisation'}
      </button>
      {message && <p className="callout">{message}</p>}
    </div>
  );
}
