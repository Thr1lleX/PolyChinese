// Chargement des tracés (format Hanzi Writer), regroupés en paquets de 500 caractères par fréquence.
import type { CharacterJson } from 'hanzi-writer';
import type { CharEntry } from '../data/types';

const shards = new Map<number, Promise<Record<string, CharacterJson>>>();

function loadShard(shard: number): Promise<Record<string, CharacterJson>> {
  let p = shards.get(shard);
  if (!p) {
    const file = `${import.meta.env.BASE_URL}data/strokes/s${String(shard).padStart(2, '0')}.json`;
    p = fetch(file).then((res) => {
      if (!res.ok) throw new Error(`Tracés indisponibles (${res.status})`);
      return res.json() as Promise<Record<string, CharacterJson>>;
    });
    p.catch(() => shards.delete(shard));
    shards.set(shard, p);
  }
  return p;
}

export async function loadStrokes(entry: CharEntry): Promise<CharacterJson> {
  const data = (await loadShard(entry.sh))[entry.c];
  if (!data) throw new Error(`Pas de tracé pour ${entry.c}`);
  return data;
}
