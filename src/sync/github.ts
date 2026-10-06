// Stockage du fichier de synchronisation dans un dépôt GitHub privé (API « contents »).
const API = 'https://api.github.com';

export interface GitHubTarget {
  /** « utilisateur/depot » */
  repo: string;
  token: string;
  path: string;
}

export class SyncHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Le fichier a été modifié par un autre appareil entre la lecture et l'écriture. */
export class ConflictError extends Error {}

function headers(target: GitHubTarget, accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Authorization: `Bearer ${target.token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const contentsUrl = (t: GitHubTarget) =>
  `${API}/repos/${t.repo}/contents/${t.path.split('/').map(encodeURIComponent).join('/')}`;

function explain(status: number): string {
  if (status === 401) return 'Jeton refusé (expiré ou mal copié).';
  if (status === 403) return "Accès refusé : le jeton n'a pas le droit d'écrire dans ce dépôt (permission « Contents : Read and write »).";
  if (status === 404) return 'Dépôt introuvable, ou le jeton ne donne pas accès à ce dépôt.';
  return `Erreur GitHub (${status}).`;
}

/** Vérifie que le dépôt existe, est privé et accessible en écriture avec ce jeton. */
export async function checkRepo(target: GitHubTarget): Promise<{ private: boolean }> {
  const res = await fetch(`${API}/repos/${target.repo}`, { headers: headers(target), cache: 'no-store' });
  if (!res.ok) throw new SyncHttpError(res.status, explain(res.status));
  const repo = (await res.json()) as { private: boolean; permissions?: { push?: boolean } };
  if (repo.permissions && !repo.permissions.push) throw new SyncHttpError(403, explain(403));
  return { private: repo.private };
}

/** Lit le fichier ; null s'il n'existe pas encore. */
export async function readFile(target: GitHubTarget): Promise<{ sha: string; bytes: Uint8Array } | null> {
  const meta = await fetch(contentsUrl(target), { headers: headers(target), cache: 'no-store' });
  if (meta.status === 404) {
    // Dépôt vide ou fichier absent ; un vrai problème d'accès est détecté par checkRepo
    return null;
  }
  if (!meta.ok) throw new SyncHttpError(meta.status, explain(meta.status));
  const { sha } = (await meta.json()) as { sha: string };
  // Contenu brut (jusqu'à 100 Mo, contrairement au JSON limité à 1 Mo)
  const raw = await fetch(contentsUrl(target), { headers: headers(target, 'application/vnd.github.raw+json'), cache: 'no-store' });
  if (!raw.ok) throw new SyncHttpError(raw.status, explain(raw.status));
  return { sha, bytes: new Uint8Array(await raw.arrayBuffer()) };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Écrit le fichier. `sha` = version lue juste avant (absent pour une création). */
export async function writeFile(target: GitHubTarget, bytes: Uint8Array, sha: string | undefined, message: string): Promise<string> {
  const res = await fetch(contentsUrl(target), {
    method: 'PUT',
    headers: { ...headers(target), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: toBase64(bytes), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) throw new ConflictError('Modifié entre-temps par un autre appareil');
  if (!res.ok) throw new SyncHttpError(res.status, explain(res.status));
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}
