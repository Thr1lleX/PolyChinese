# PolyChinese

Outil personnel d'apprentissage du chinois simplifié, avec traductions en français : caractères, ordre des traits, mots, et bientôt flashcards à répétition espacée et travail de la prononciation.

Application web installable (PWA), utilisable hors ligne sur PC, Android et iPad. Les données personnelles restent sur l'appareil.

**Application en ligne** : https://thr1llex.github.io/PolyChinese/

La spécification complète est dans [SPEC.md](SPEC.md).

## Développement

```bash
npm install
npm run dev        # serveur local : http://localhost:5173/PolyChinese/
npm test           # tests unitaires
npm run build      # version de production dans dist/
```

Chaque push sur `main` déploie automatiquement sur GitHub Pages.

## Données

Les données de référence préparées sont versionnées dans `public/data/`. Pour les régénérer depuis les sources :

```bash
npm run data:download   # télécharge les sources dans data-raw/ (non versionné)
npm run data:prepare    # produit public/data/
```

| Fichier | Contenu |
|---|---|
| `chars.json` | ~7 400 caractères : lectures, traductions, décomposition, fréquence, niveau HSK |
| `words.json` | ~53 000 mots : lectures, traductions, fréquence, niveau HSK, classificateurs |
| `strokes/sNN.json` | Tracés Hanzi Writer, par paquets de 500 caractères classés par fréquence |

## Sources et licences des données

| Donnée | Source | Licence |
|---|---|---|
| Traductions françaises | [CFDICT](https://chine.in/mandarin/dictionnaire/CFDICT/) — Chine Informations | CC BY-SA 3.0 |
| Traductions anglaises (secours) | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) | CC BY-SA 4.0 |
| Tracés, décomposition, étymologie | [Make Me a Hanzi](https://github.com/skishore/makemeahanzi), via [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) | Arphic Public License (tracés), LGPL (dictionnaire) |
| Listes HSK 2.0 / 3.0 | [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | MIT |
| Fréquences | SUBTLEX-CH, Cai & Brysbaert (2010), [PLOS ONE 5(6): e10729](https://doi.org/10.1371/journal.pone.0010729) | CC BY |

Les fichiers `chars.json` et `words.json`, dérivés de CFDICT et CC-CEDICT, sont redistribués sous licence CC BY-SA.
