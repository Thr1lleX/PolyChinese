import { Link } from 'react-router-dom';
import { useSyncStatus } from '../sync/syncService';

/** Petit nuage dans l'en-tête : état de la synchronisation (rien si elle est désactivée). */
export function SyncIndicator() {
  const status = useSyncStatus();
  if (status.state === 'off') return null;
  const { icon, label } =
    status.state === 'syncing'
      ? { icon: '⟳', label: 'Synchronisation en cours' }
      : status.state === 'error'
        ? { icon: '⚠', label: `Synchronisation en échec : ${status.error ?? ''}` }
        : status.pending
          ? { icon: '☁…', label: 'Modifications en attente d’envoi' }
          : { icon: '☁✓', label: 'Synchronisé' };
  return (
    <Link to="/reglages#synchro" className={`sync-indicator sync-${status.state}`} title={label} aria-label={label}>
      {icon}
    </Link>
  );
}
