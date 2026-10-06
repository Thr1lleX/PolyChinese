// Test d'intégration : deux « appareils » partagent un faux dépôt GitHub.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage minimal (environnement Node)
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {} });

// Faux dépôt : un seul fichier, versionné par un sha
let remote: { sha: string; bytes: Uint8Array } | null = null;
let version = 0;
let failNextWrite = false;
vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  if (!url.includes('/contents/')) return new Response(JSON.stringify({ private: true, permissions: { push: true } }));
  if (!init?.method || init.method === 'GET') {
    if (!remote) return new Response('{}', { status: 404 });
    if (headers.Accept?.includes('raw')) return new Response(remote.bytes as BodyInit);
    return new Response(JSON.stringify({ sha: remote.sha }));
  }
  const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
  // Simule un autre appareil qui écrit entre la lecture et l'écriture
  if (failNextWrite) {
    failNextWrite = false;
    return new Response('{}', { status: 409 });
  }
  if ((remote?.sha ?? undefined) !== body.sha) return new Response('{}', { status: 409 });
  remote = { sha: `v${++version}`, bytes: Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)) };
  return new Response(JSON.stringify({ content: { sha: remote.sha } }));
});

const { db, markSyncTransaction } = await import('../db/db');
const { addToDeck, setTriage, removeItem } = await import('../db/repo');
const { enableSync, syncNow, snapshot, useSyncStatus: _unused } = await import('./syncService');
void _unused;

/** Change d'appareil : vide la base locale et change d'identifiant (la configuration de synchro est gardée). */
async function switchDevice(name: string) {
  const tables = [db.items, db.cards, db.decks, db.reviewLogs, db.days, db.sessions, db.tombstones];
  // Base neuve d'un autre appareil : ce vidage n'est pas une suppression à propager
  await db.transaction('rw', tables, async (tx) => {
    markSyncTransaction(tx);
    await Promise.all(tables.map((t) => t.clear()));
  });
  store.set('polychinese.deviceId', name);
}

describe('synchronisation entre deux appareils', () => {
  beforeEach(async () => {
    remote = null;
    version = 0;
    store.clear();
    await switchDevice('pc');
  });

  it('les éléments importés sur chaque appareil se retrouvent partout', async () => {
    await addToDeck('Cours PC', [{ kind: 'char', text: '学' }], 'known');
    await enableSync('moi/polychinese-data', 'jeton-test');
    expect(remote).not.toBeNull();


    await switchDevice('telephone');
    await addToDeck('Cours téléphone', [{ kind: 'char', text: '生' }], 'fuzzy');
    await syncNow();

    const phone = await snapshot();
    expect(phone.items.map((i) => i.key).sort()).toEqual(['c:学', 'c:生']);
    expect(phone.decks.map((d) => d.name).sort()).toEqual(['Cours PC', 'Cours téléphone']);
    expect(phone.cards).toHaveLength(4);
  });

  it('une suppression et un changement de statut sont propagés', async () => {
    await addToDeck('Cours', [{ kind: 'char', text: '学' }, { kind: 'char', text: '生' }], 'known');
    await enableSync('moi/polychinese-data', 'jeton-test');
    const pcState = await snapshot();

    // Le téléphone récupère tout, retire 生 et repasse 学 « à réapprendre »
    await switchDevice('telephone');
    await syncNow();
    await new Promise((r) => setTimeout(r, 5)); // les traces de suppression s'écrivent après la transaction
    await removeItem('c:生');
    await setTriage('c:学', 'relearn');
    await new Promise((r) => setTimeout(r, 5));
    await syncNow();

    // Retour sur le PC (avec son ancien état local)
    await switchDevice('pc');
    await db.transaction('rw', [db.items, db.cards, db.decks], async (tx) => {
      markSyncTransaction(tx);
      await db.items.bulkPut(pcState.items);
      await db.cards.bulkPut(pcState.cards);
      await db.decks.bulkPut(pcState.decks);
    });
    await syncNow();
    const pc = await snapshot();
    expect(pc.items.map((i) => i.key)).toEqual(['c:学']);
    expect(pc.items[0].triage).toBe('relearn');
    expect(pc.cards.every((c) => c.itemKey === 'c:学' && c.priority)).toBe(true);
  });

  it('écriture concurrente : on refusionne et on réessaie', async () => {
    await addToDeck('Cours', [{ kind: 'char', text: '学' }], 'known');
    await enableSync('moi/polychinese-data', 'jeton-test');
    await addToDeck('Cours', [{ kind: 'char', text: '生' }], 'known');
    failNextWrite = true;
    await syncNow();
    expect(remote?.sha).toBe('v2');
  });

  it('rien de nouveau : pas de réécriture du fichier', async () => {
    await addToDeck('Cours', [{ kind: 'char', text: '学' }], 'known');
    await enableSync('moi/polychinese-data', 'jeton-test');
    const sha = remote?.sha;
    await syncNow();
    await syncNow();
    expect(remote?.sha).toBe(sha);
  });
});
