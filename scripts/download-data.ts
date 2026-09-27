// Télécharge les sources brutes dans data-raw/ (non versionné).
// Usage : npm run data:download
import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';

const OUT = 'data-raw';

interface Source {
  file: string;
  url: string;
  /** Extraction : gz = gunzip, zip = liste des fichiers à extraire */
  gz?: boolean;
  zip?: string[];
}

const SOURCES: Source[] = [
  // Make Me a Hanzi : décomposition, étymologie (LGPL)
  { file: 'mmah-dictionary.txt', url: 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt' },
  // CFDICT : chinois -> français (CC BY-SA 3.0, https://chine.in)
  { file: 'cfdict.u8', url: 'https://chine.in/assets/cfdict/cfdict.u8' },
  // CC-CEDICT : chinois -> anglais (CC BY-SA 4.0)
  { file: 'cedict_ts.u8', url: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', gz: true },
  // Listes HSK 2.0 / 3.0 (MIT)
  { file: 'hsk-complete.json', url: 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json' },
  // SUBTLEX-CH : fréquences issues de sous-titres (Cai & Brysbaert 2010, PLOS ONE, CC BY)
  { file: 'subtlex-ch.zip', url: 'https://doi.org/10.1371/journal.pone.0010729.s002', zip: ['SUBTLEX-CH-CHR', 'SUBTLEX-CH-WF'] },
];

mkdirSync(OUT, { recursive: true });

for (const src of SOURCES) {
  process.stdout.write(`${src.file} ... `);
  const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 PolyChinese data script' } });
  if (!res.ok) throw new Error(`${src.url} -> HTTP ${res.status}`);
  let buf = new Uint8Array(await res.arrayBuffer());
  if (src.gz) buf = gunzipSync(buf);
  if (src.zip) {
    const files = unzipSync(buf);
    for (const name of src.zip) {
      if (!files[name]) throw new Error(`${name} absent de ${src.file}`);
      writeFileSync(`${OUT}/${name}`, files[name]);
    }
  } else {
    writeFileSync(`${OUT}/${src.file}`, buf);
  }
  console.log(`${(buf.length / 1024 / 1024).toFixed(1)} Mo`);
}
