# Spécification V1 — Outil d'apprentissage du chinois

> Nom de l'application : **PolyChinese**
> Version du document : 0.2 — 2026-09-27
> Statut : questions ouvertes tranchées, prêt pour l'étape 0

---

## 1. Vision

Un outil personnel pour apprendre le **chinois simplifié** avec traductions **en français**. Il est pensé pour la **conversation et la lecture**, en **20 à 30 minutes par jour**. On y retrouve ce qui plaît dans Hanzi Stroke (ordre des traits, tracé vérifié, flashcards notées automatiquement), sans ses limites, avec en plus :

- l'**oral dès la V1** : écoute, analyse des tons de sa propre voix ;
- une **régularité protégée** : séances calibrées sur le temps disponible, jamais d'avalanche de révisions ;
- un apprentissage organisé autour des **mots**, avec les **caractères** comme unité d'écriture ;
- l'**import de ce que l'on connaît déjà** (listes de cours hors HSK).

### Profil de l'utilisateur

| | |
|---|---|
| Niveau | Débutant, environ 150 caractères connus, appris hors listes HSK |
| Objectif | Converser et lire (pas d'objectif d'examen) |
| Temps | 20-30 min/jour, rarement plus |
| Appareils | PC à la souris (principal), téléphone Android, iPad éventuel |
| Langue | Interface et traductions en français |

### Principes directeurs

1. **Le mot est l'unité de sens, le caractère l'unité d'écriture.**
2. **Le temps disponible commande, pas la pile de cartes.** L'outil adapte la charge au budget quotidien.
3. **Tout fonctionne hors ligne.** Aucune donnée personnelle ne quitte l'appareil, sauf option explicite.
4. **La machine note, l'utilisateur garde le dernier mot.** Toute note automatique peut être corrigée.
5. **Le HSK est un catalogue, pas un programme.** Les listes personnelles passent en premier.

---

## 2. Périmètre

### Dans la V1

- Catalogue de caractères et de mots : pinyin, français, composants, animation de l'ordre des traits
- Import de caractères et de mots par texte collé, tri rapide, planification étalée
- Decks : personnels, HSK 3.0, « mots débloqués »
- 5 types de cartes : écriture, sens, pinyin, écoute, prononciation
- Répétition espacée FSRS, notes automatiques corrigeables
- Séances composées selon le temps disponible, séance express, protection anti-avalanche
- Contexte de séance (parler / écoute seule / silence) pour réviser en transport ou en bibliothèque
- Reprise d'une séance interrompue là où on s'était arrêté
- Oral : synthèse vocale, enregistrement, courbe des tons comparée au modèle, paires de tons, dictée de tons
- Régularité : calendrier, série avec jokers, indicateur de couverture de lecture
- Couleurs des tons, notes personnelles, détection des cartes « sangsues »
- Application installable (PWA), hors ligne, sauvegarde par export/import

### Hors V1 (versions suivantes)

- Lecture assistée de textes collés (découpage en mots, surlignage connu/inconnu)
- Phrases d'exemple choisies selon le niveau (i+1)
- Synchronisation automatique entre appareils
- Notifications de rappel
- Évaluation de prononciation par service externe (Azure ou équivalent)
- Mode « choisir le trait suivant »
- Audio de référence enregistré par des locuteurs natifs

---

## 3. Concepts et vocabulaire

| Terme | Définition |
|---|---|
| **Caractère** | Un hanzi (学). Porte : tracés, ordre des traits, composants, pinyin(s), sens de base. |
| **Mot** | Une ou plusieurs syllabes formant une unité lexicale (学生). Porte : pinyin avec changements de ton, traductions, fréquence. |
| **Élément** | Un caractère ou un mot, c'est-à-dire ce qu'on apprend. |
| **Carte** | Un couple (élément, type de carte) avec son propre état de mémorisation. Un élément peut avoir plusieurs cartes. |
| **Deck** | Une collection nommée d'éléments (« Cours S1 », « HSK 1 », « Mots débloqués »). |
| **Séance** | Un enchaînement de blocs (échauffement, révisions, nouveautés, prononciation) calibré sur un temps donné. |
| **Mot débloqué** | Mot dont tous les caractères sont connus de l'utilisateur, mais que le mot lui-même n'a pas encore été appris. |
| **Sangsue** | Carte ratée de nombreuses fois (seuil par défaut : 6 échecs). |

---

## 4. Types de cartes

| Type | S'applique à | Question | Réponse attendue | Notation |
|---|---|---|---|---|
| **Écriture** | Caractère | Sens + pinyin + mot de contexte (« tracez 学 dans 学生 xuéshēng, étudiant ») + audio | Tracer le caractère trait par trait | Automatique |
| **Sens** | Mot (et caractère isolé courant) | 学生 | Sens + pinyin affichés, auto-évaluation | Manuelle |
| **Pinyin** | Mot | 学生 | Taper `xue2sheng1` (converti en xuéshēng) | Automatique |
| **Écoute** | Mot | 🔊 audio seul | Sens, auto-évaluation | Manuelle |
| **Prononciation** | Mot | 学生 + pinyin | Enregistrer sa voix, voir l'analyse des tons | Automatique (tons) + correction |

### Cartes créées par défaut

- Nouveau **caractère** : écriture + sens.
- Nouveau **mot** : sens + pinyin + écoute + prononciation.
- Les types actifs sont configurables globalement et par deck. Exemple : désactiver l'écriture pour un deck « Oral ».
- Les cartes d'un même élément ne sont **jamais présentées le même jour**, sauf la toute première découverte. Les cartes « sœurs » sont décalées pour éviter qu'une carte donne la réponse de l'autre.

### Notation (échelle FSRS : Raté / Difficile / Bien / Facile)

**Écriture** (voir aussi §7) :

| Résultat du tracé | Note |
|---|---|
| 0 erreur, tracé rapide (< 1,5 s/trait en moyenne) | Facile |
| 0 erreur | Bien |
| Erreurs ≤ max(1, 15 % du nombre de traits), sans indice | Difficile |
| Au-delà, ou indice affiché, ou abandon | Raté |

**Pinyin tapé** :

| Résultat | Note |
|---|---|
| Syllabes et tons exacts | Bien |
| Syllabes exactes, au moins un ton faux | Difficile |
| Syllabe fausse | Raté |

**Prononciation** : score de tons par syllabe (§8). Tous les tons corrects donnent Bien ; un ton faux donne Difficile ; une majorité de tons faux donne Raté.

**Sens et écoute** : quatre boutons d'auto-évaluation après affichage de la réponse.

**Correction de la note** : après chaque notation automatique, la note proposée s'affiche 2 secondes avec un bouton « Corriger ». C'est indispensable à la souris, où un trait raté peut venir du geste et non de la mémoire.

---

## 5. Données de référence (embarquées, hors ligne)

> ✅ Licences vérifiées à l'étape 0 (voir README.md). HSK : dépôt `complete-hsk-vocabulary` (MIT), niveaux « newest » = révision 2025 du HSK 3.0. SUBTLEX-CH : données supplémentaires PLOS ONE (CC BY). CFDICT : ~56 000 entrées (version 12/2024).

| Donnée | Source | Usage | Licence |
|---|---|---|---|
| Tracés + ordre des traits | **Make Me a Hanzi** / `hanzi-writer-data` | Animation, quiz de tracé | Arphic Public License (données graphiques), LGPL (dictionnaire) |
| Décomposition, étymologie | Make Me a Hanzi `dictionary.txt` | Composants, familles | LGPL |
| Dictionnaire chinois → français | **CFDICT** | Traductions | CC BY-SA |
| Dictionnaire chinois → anglais (secours) | **CC-CEDICT** | Si pas d'entrée CFDICT | CC BY-SA |
| Listes HSK 3.0 | Dépôt GitHub `complete-hsk-vocabulary` ou équivalent | Decks HSK, niveaux | À vérifier |
| Fréquences des mots et caractères | **SUBTLEX-CH** (sous-titres, donc proche de l'oral) | Ordre des nouveautés, couverture de lecture | À vérifier (usage personnel) |
| Pinyin avec changements de ton | Bibliothèque `pinyin-pro` | 你好 → ní hǎo, 不是 → bú shì | MIT |

### Préparation des données

Un **script de préparation**, exécuté une fois hors de l'application, convertit les sources en fichiers compacts :

- `characters.json` : environ 9 500 caractères (pinyin, sens FR, composants, fréquence)
- `words.json` : mots filtrés sur l'union HSK 3.0 + les 20 000 mots les plus fréquents + tout mot CFDICT dont les caractères sont dans le catalogue, limité à une taille raisonnable (cible < 10 Mo)
- `strokes/<caractère>.json` : chargés à la demande (bibliothèque `hanzi-writer-data`)

Les traductions CFDICT absentes basculent sur CC-CEDICT, avec un marqueur « EN » visible.

---

## 6. Données utilisateur (IndexedDB, locales)

```
Item (référence)       ← statique, embarqué
UserItem               { itemId, kind: 'char'|'word', knownState, addedAt, source, note? }
Card                   { id, itemId, type, fsrs: {due, stability, difficulty, state, reps, lapses, ...}, suspended }
ReviewLog              { cardId, at, rating, autoRating?, overridden, durationMs, detail? }
Deck                   { id, name, kind: 'custom'|'hsk'|'unlocked', itemIds[], cardTypes[] }
DailyStat              { date, minutes, reviews, newItems, sessionCompleted, jokerUsed }
Recording (optionnel)  { cardId, at, blob } — conservés 7 jours max
ActiveSession          { id, startedAt, studyDay, durationMin, context, blocks[], queue[cardId], position, activeMs, doneCardIds[], status: 'running'|'paused'|'done'|'expired' }
Settings               { dailyMinutes, newItemsMax, tolerance, toneColors, jokersPerWeek, ... }
```

- `detail` dans `ReviewLog` garde les erreurs par trait (écriture) ou les tons détectés (prononciation), utiles pour les statistiques et la détection des sangsues.
- **Sauvegarde** : export de toutes les données utilisateur dans un fichier JSON, et import de ce fichier (fusion ou remplacement). Un rappel « Dernière sauvegarde il y a N jours » apparaît sur l'accueil après 7 jours.

---

## 7. Écriture (tracé vérifié)

Elle repose sur **Hanzi Writer** en mode quiz.

- Chaque trait est validé à la volée : bonne forme, bon sens, bon ordre. Un trait faux s'efface et compte une erreur.
- **Indice** : après 3 erreurs sur le même trait, le trait attendu clignote (réglable). L'indice fait passer la note à « Raté ».
- **Tolérance réglable** (paramètre de souplesse de Hanzi Writer) : un préréglage « Souris » plus indulgent, un préréglage « Doigt/Stylet » standard. Détection automatique du type de pointeur, modifiable.
- **Grille d'aide** en fond (米字格), désactivable.
- Après validation : animation du caractère complet à vitesse normale, lecture audio du mot de contexte.
- **Mode entraînement libre** depuis la fiche d'un caractère : animation, puis tracé guidé (contour visible), puis tracé de mémoire. Ce mode n'est pas noté.
- Mot de plusieurs caractères : en V1, les cartes d'écriture portent sur un caractère à la fois. Le tracé enchaîné d'un mot entier est une option future.

---

## 8. Oral

### 8.1 Audio de référence

- **Synthèse vocale du navigateur** (Web Speech API, voix `zh-CN`). Sur Android, la voix Google est de bonne qualité. Sur Windows, on utilise la meilleure voix `zh-CN` disponible.
- Réglages : vitesse (0,6× / 0,8× / 1×), choix de la voix.
- Si aucune voix chinoise n'est disponible, un message explique comment en installer une (Windows : Paramètres → Heure et langue → Voix).

### 8.2 Analyse des tons

> **Contrainte technique importante** : la synthèse vocale du navigateur ne permet pas de récupérer son signal audio. On ne peut donc pas extraire la courbe de hauteur du modèle. La référence sera une **courbe théorique** du ton, calée sur la tessiture de l'utilisateur. Pédagogiquement, c'est même plus clair qu'une courbe de locuteur réel, souvent irrégulière.

Déroulé :

1. **Calibrage** (une fois, puis refaisable) : l'utilisateur prononce quelques syllabes (mā, má, mǎ, mà) pour mesurer sa tessiture (hauteur basse et haute).
2. **Enregistrement** via le micro (appui pour parler, ou arrêt automatique sur silence).
3. **Extraction de la hauteur** (fréquence fondamentale) dans le navigateur, avec la bibliothèque `pitchy` ou équivalent. Conversion en demi-tons relatifs à la tessiture.
4. **Découpage en syllabes** : segments voisés, le nombre de syllabes attendu étant connu.
5. **Classification** de chaque syllabe (ton 1 haut plat, 2 montant, 3 bas/descendant-montant, 4 descendant, neutre court) en comparant la forme et la position de la courbe aux modèles théoriques (échelle de Chao : 55, 35, 214 ou 21, 51).
6. **Affichage** :
   ```
   Attendu : xué ↗   shēng ‾‾
   Vous    : xué ↗ ✓  shēng ↘ ✗   « 2e syllabe : ton 1 attendu, ton 4 détecté »
   ```
   Les courbes sont superposées (modèle en pointillés, voix en trait plein) aux couleurs des tons, avec réécoute de son enregistrement et du modèle.

Les **changements de ton** sont pris en compte dans le modèle attendu : 3+3 → 2+3, 一 et 不 selon le ton suivant, ton neutre. Le pinyin écrit reste la forme du dictionnaire, avec une mention « se prononce ní hǎo » quand c'est différent.

> **Risque** : la fiabilité du découpage en syllabes et de la classification (voix, micro, bruit) est la principale inconnue de la V1. Elle sera validée par un prototype (étape 4) avant d'en faire une carte notée. En cas de fiabilité insuffisante, la carte prononciation passe en auto-évaluation, avec la courbe affichée à titre indicatif.

### 8.3 Test « Suis-je compris ? » (optionnel)

- Utilise la reconnaissance vocale du navigateur (`SpeechRecognition`, `zh-CN`) : Chrome (Android, PC) et Safari.
- **Nécessite internet** et transmet l'audio à Google ou Apple. Cette option est désactivée par défaut, avec une explication claire.
- Résultat : le texte reconnu est comparé au mot attendu. C'est indicatif et indulgent : la reconnaissance corrige souvent l'utilisateur.

### 8.4 Exercices oraux (hors cartes)

| Exercice | Déroulé |
|---|---|
| **Paires de tons** | Les 20 combinaisons de tons à deux syllabes (1-1 … 4-4, avec ton neutre). Pour chaque combinaison, des mots connus de l'utilisateur de préférence. On écoute, on répète, on voit l'analyse. |
| **Dictée de tons** | On entend un mot, on clique sur les tons entendus (ex. 2-1). Score et répétition des erreurs. |
| **Paires minimales** | zh/j, ch/q, sh/x, ü/u, -n/-ng, z/c, r. On entend un mot et on choisit entre deux pinyins. *(V1 si le temps le permet, sinon V2.)* |

Les résultats sont suivis par combinaison (par exemple « 3-3 : 60 % »), ce qui permet de cibler les points faibles dans l'échauffement.

---

## 9. Séances et planification

### 9.1 Algorithme de mémorisation

- **FSRS** via la bibliothèque `ts-fsrs`. Rétention visée : 90 % (réglable entre 80 et 95 %).
- Chaque carte a son état FSRS indépendant.

### 9.2 Composition d'une séance

L'utilisateur choisit une durée : **5 (express) / 15 / 25 / 35 min**. La durée par défaut est un paramètre (25 min).

| Bloc | Part du temps (25 min) | Contenu |
|---|---|---|
| Échauffement oral | ~4 min | Paires de tons ou dictée de tons, centrées sur les combinaisons faibles |
| Révisions | ~12 min | Cartes dues, types mélangés, les plus urgentes d'abord |
| Nouveautés | ~6 min | Nouveaux éléments (§9.4) |
| Prononciation | ~3 min | Cartes prononciation dues + répétition des nouveautés du jour |

- **Séance express (5 min)** : uniquement les révisions les plus urgentes.
- **Durée par carte estimée** à partir de l'historique de l'utilisateur, avec des valeurs par défaut : écriture 25 s, sens 8 s, pinyin 12 s, écoute 8 s, prononciation 20 s.
- On peut **arrêter à tout moment** : la progression est enregistrée carte par carte, et la séance peut être reprise (§9.7).
- On peut **prolonger** en fin de séance (« +5 min »).

### 9.2 bis Contexte de séance

Avant de lancer une séance, l'utilisateur indique où il se trouve. Le dernier choix est mémorisé et proposé par défaut.

| Contexte | Situation type | Sortie son | Micro | Blocs et cartes exclus |
|---|---|---|---|---|
| 🗣️ **Parler** | À la maison | Oui | Oui | Aucun |
| 🎧 **Écoute seule** | Transport en commun avec écouteurs | Oui | Non | Cartes prononciation, bloc prononciation, enregistrement dans l'échauffement (qui passe en dictée de tons) |
| 🔇 **Silence** | Bibliothèque sans écouteurs | Non | Non | Cartes prononciation et écoute, échauffement oral, lecture audio automatique |

- Le temps libéré est **redistribué** aux révisions et aux nouveautés.
- Les cartes exclues **ne sont ni ratées ni pénalisées** : elles restent dues et seront proposées dans la prochaine séance où le contexte le permet.
- Si des cartes orales s'accumulent (par exemple plus de 20 cartes prononciation en attente), l'accueil le signale : « 24 cartes de prononciation attendent une séance "Parler" ». Pas d'alerte avant ce seuil.
- Le contexte peut être changé **en cours de séance** (par exemple en arrivant chez soi). La file restante est recomposée.

### 9.3 Protection anti-avalanche

- **Plafond de révisions** par séance, dicté par le temps choisi.
- **Priorité en cas de retard** : les cartes dont la probabilité de rappel est la plus basse passent d'abord. Le reste est étalé sur les jours suivants. Aucun compteur de retard anxiogène : on affiche « séance du jour », pas « 312 cartes en retard ».
- **Retour après une absence** : les nouveautés sont suspendues automatiquement tant que les révisions dépassent le budget.

### 9.4 Nouveautés : combien et lesquelles

**Combien** : réglage automatique. Si la charge de révisions prévue pour les 7 prochains jours dépasse environ 60 % du budget quotidien, les nouveautés diminuent. Si elle est basse, elles augmentent. Bornes par défaut : 3 à 10 éléments par jour, plafond réglable.

**Lesquels**, par ordre de priorité :

1. Éléments de **decks personnels** marqués « à apprendre », dans l'ordre du deck.
2. **Mots débloqués**, classés par fréquence (tous leurs caractères sont connus, donc ils ne coûtent que sens et prononciation).
3. **Caractère suivant** le plus fréquent, présenté avec 1 à 3 mots courants qui le contiennent.

L'utilisateur peut choisir un deck prioritaire pour la séance (par exemple la leçon en cours).

### 9.5 Présentation d'une nouveauté

Avant la première carte, une **fiche de découverte** courte : caractère ou mot, pinyin coloré, audio, sens, composants, animation des traits (pour un caractère), 1 à 3 mots liés. Puis une première carte immédiate (sens ou écriture) pour ancrer.

### 9.6 Journée d'étude

Une journée d'étude bascule à **4 h du matin** (réglable). Une séance faite à 1 h du matin compte donc pour la veille : la série, les statistiques et les échéances suivent cette règle.

### 9.7 Reprise d'une séance interrompue

La séance en cours est **sauvegardée en continu** (`ActiveSession`, §6) : la file de cartes prévue, la position, le bloc courant, le temps actif écoulé et le contexte.

- **Pause automatique** : quand l'application passe en arrière-plan (changement d'appli, écran verrouillé, arrivée à sa station), le chronomètre s'arrête. Seul le temps actif compte.
- **Au retour**, l'accueil affiche en priorité : **« Reprendre la séance — 12 min restantes, 18 cartes »**, avec l'option « Terminer ici ».
- **Carte en cours** : si l'interruption survient au milieu d'une carte (tracé à moitié fait, enregistrement en cours), cette carte recommence au début. Les cartes déjà notées sont définitivement enregistrées.
- **Mise à jour à la reprise** : la file est revalidée. Les cartes révisées entre-temps (par exemple depuis la fiche d'un caractère) en sont retirées.
- **Expiration** : une séance non terminée expire au changement de journée d'étude (§9.6). Rien n'est perdu : les révisions faites sont enregistrées, et la séance du lendemain est recomposée normalement.
- **Même appareil uniquement** en V1. La reprise sur un autre appareil viendra avec la synchronisation (V2).
- **Séance terminée « à moitié »** : le jour est validé dès que 5 minutes actives sont atteintes (§13), même si la séance n'est pas reprise.

---

## 10. Import de l'existant

### 10.1 Coller du texte

- Zone de texte qui accepte n'importe quoi : liste, tableau copié, leçon entière.
- **Mode Caractères** : extraction de tous les caractères chinois distincts, le reste est ignoré.
- **Mode Mots** : une entrée par ligne ou séparée par des virgules. Si le texte est continu, découpage par correspondance la plus longue avec le dictionnaire, puis validation visuelle.
- Aperçu : nombre d'éléments trouvés, éléments déjà présents, éléments inconnus du dictionnaire (conservés sans traduction, que l'utilisateur peut compléter).
- Nom du deck créé (par exemple « Cours S1 »).
- Astuce affichée : « Pour un cours papier, utilisez Google Lens sur votre téléphone pour copier le texte d'une photo. »

### 10.2 Tri rapide

Chaque élément est affiché (grand caractère, sans la réponse), avec trois choix au clavier (1/2/3) ou par balayage :

| Choix | Planification initiale |
|---|---|
| **Je connais bien** | Carte en révision, stabilité ~20 jours, échéance répartie aléatoirement sur les 30 prochains jours |
| **À peu près** | Stabilité ~3 jours, échéance répartie sur les 7 prochains jours |
| **À réapprendre** | Nouvelle carte, placée en tête des nouveautés |

Un bouton « révéler » permet de vérifier avant de choisir. Le tri peut être interrompu et repris.

### 10.3 Après l'import

L'outil affiche : « Avec vos N caractères, M mots courants sont débloqués ». Le deck « Mots débloqués » se met à jour automatiquement.

---

## 11. Écrans

| Écran | Contenu principal |
|---|---|
| **Accueil** | Si une séance est interrompue : bouton « Reprendre » en tête. Sinon : bouton « Commencer la séance (25 min) », choix de durée, **choix du contexte (Parler / Écoute seule / Silence)**. Série et jokers, calendrier de régularité, couverture de lecture, rappel de sauvegarde, alerte cartes orales en attente |
| **Séance** | Carte courante, barre de progression par bloc, temps restant, indicateur du contexte (modifiable), bouton pause/arrêt |
| **Catalogue** | Recherche (caractère, pinyin avec ou sans tons, français), filtres (HSK, connus, decks) |
| **Fiche caractère** | Grand caractère, pinyin(s) coloré(s), sens FR, audio, animation + entraînement libre, composants (cliquables), famille (caractères partageant un composant), mots courants, note personnelle, état des cartes, ajout à un deck |
| **Fiche mot** | Mot, pinyin coloré + prononciation réelle si changement de ton, sens FR, audio, caractères (liens), note personnelle, état des cartes, entraînement oral |
| **Decks** | Liste, création, édition, types de cartes actifs, priorité |
| **Import** | Collage, aperçu, tri rapide (§10) |
| **Oral** | Exercices libres : paires de tons, dictée de tons, calibrage de la voix |
| **Statistiques** | Éléments connus, couverture de lecture, précision par type de carte, précision par combinaison de tons, sangsues, prévision de charge sur 7 jours |
| **Paramètres** | Durée par défaut, nouveautés max, rétention, tolérance du tracé, voix et vitesse, couleurs des tons, jokers, reconnaissance vocale en ligne (oui/non), export/import |

**Navigation** : barre du bas sur mobile (Accueil, Catalogue, Oral, Stats, plus), barre latérale sur PC.
**Raccourcis clavier en séance (PC)** : Espace = révéler, 1-4 = notes, R = réécouter, Entrée = valider le pinyin, M = enregistrer.

---

## 12. Aides transverses

- **Couleurs des tons** partout (pinyin et caractères, optionnel). Par défaut : ton 1 rouge, 2 orange, 3 vert, 4 bleu, neutre gris. Couleurs configurables, compatibles thème sombre et daltonisme.
- **Saisie du pinyin** : `xue2sheng1` → xuéshēng, `v` → ü, en temps réel.
- **Sangsues** : au 6e échec, la carte est signalée. Au prochain passage, la fiche s'affiche avec une invitation à écrire une mnémotechnique et, si possible, les caractères visuellement proches à comparer.
- **Notes personnelles** : un champ libre par élément, affiché au verso des cartes.

---

## 13. Régularité et motivation

- **Jour validé** : au moins 5 minutes de séance, ou une séance express terminée.
- **Série** avec **jokers** : 2 par semaine par défaut. Un jour manqué consomme un joker automatiquement au lieu de casser la série.
- **Calendrier** façon GitHub : intensité selon les minutes.
- **Couverture de lecture** : « Vos caractères connus couvrent X % d'un texte courant », calculé sur les fréquences. Historique en courbe.
- Pas de notifications en V1. Conseil affiché : ajouter un rappel quotidien dans l'agenda du téléphone.

---

## 14. Choix techniques

| Sujet | Choix proposé | Raison |
|---|---|---|
| Type d'application | **PWA** (Progressive Web App) | Un seul code pour PC, Android et iPad, installable, hors ligne |
| Langage | **TypeScript** | Fiabilité, bon outillage |
| Interface | **React** + **Vite** | Écosystème large, développement rapide |
| Hors ligne | `vite-plugin-pwa` (service worker) | Mise en cache des données et de l'application |
| Stockage | **IndexedDB** via **Dexie** | Volume confortable, requêtes simples |
| Tracé | **Hanzi Writer** + `hanzi-writer-data` | Quiz de tracé éprouvé |
| Mémorisation | **ts-fsrs** | Implémentation de référence de FSRS |
| Pinyin | **pinyin-pro** | Pinyin avec changements de ton |
| Hauteur de voix | **pitchy** + Web Audio API | Extraction de la hauteur dans le navigateur |
| Audio | Web Speech API | Synthèse vocale sans serveur |
| Tests | Vitest | Logique de notation, planification, conversion pinyin, classification des tons |

### Contraintes à connaître

- **Micro et service worker exigent HTTPS** (sauf `localhost`). **Décision : hébergement sur GitHub Pages** (compte GitHub existant), avec déploiement automatique à chaque mise à jour via GitHub Actions. Les **données restent sur l'appareil**, seul le code est en ligne. Sur PC, le développement se fait en local (`localhost`).
- **iPad / Safari** : données persistantes une fois l'application ajoutée à l'écran d'accueil. L'export reste recommandé.
- **Performances** : dictionnaire chargé une fois puis indexé en mémoire, tracés chargés à la demande. Démarrage visé < 2 s après la première visite.

### Arborescence prévue

```
/scripts        préparation des données (sources → JSON compacts)
/data-raw       sources téléchargées (non versionnées)
/public/data    données préparées embarquées
/src
  /data         accès aux données de référence
  /db           schéma Dexie, sauvegarde export/import
  /srs          FSRS, composition des séances, anti-avalanche
  /cards        composants des 5 types de cartes + notation
  /writing      intégration Hanzi Writer
  /audio        synthèse vocale, enregistrement, analyse des tons
  /import       collage, découpage, tri rapide
  /screens      écrans
  /ui           composants communs (pinyin coloré, boutons de note…)
```

---

## 15. Étapes de réalisation

Chaque étape produit une version **utilisable et testable par l'utilisateur**.

### Étape 0 — Données et socle
- Téléchargement et vérification des licences des sources.
- Script de préparation → `characters.json`, `words.json`.
- Projet Vite + React + PWA, dépôt GitHub, déploiement automatique sur GitHub Pages.
- **Critère** : l'application s'ouvre hors ligne sur le PC et sur le téléphone Android, et affiche une fiche de caractère avec pinyin et sens français.

### Étape 1 — Tracé et notation
- Carte écriture avec Hanzi Writer, tolérance souris/doigt, notation automatique + correction.
- **Critère** : l'utilisateur trace 20 caractères à la souris puis au doigt et juge la fluidité et la justesse de la notation acceptables. **Point de décision** sur les réglages de tolérance.

### Étape 2 — Catalogue et import
- Catalogue, recherche, fiches caractère et mot, decks.
- Import par collage + tri rapide + planification étalée, mots débloqués.
- **Critère** : les 150 caractères de l'utilisateur sont importés et triés en moins de 10 minutes.

### Étape 3 — Séances et régularité
- FSRS, 4 types de cartes non oraux (écriture, sens, pinyin, écoute), composition des séances, anti-avalanche, nouveautés adaptatives.
- Contexte de séance (Écoute seule / Silence ; « Parler » activé à l'étape 4), reprise de séance interrompue, pause automatique.
- Accueil, calendrier, série et jokers, statistiques de base, export/import.
- **Critères** : une séance de 25 min tient en 25 min (± 3), sur plusieurs jours d'utilisation réelle. Une séance interrompue (fermeture de l'appli, téléphone verrouillé) reprend exactement à la carte suivante.

### Étape 4 — Oral
- Prototype d'analyse des tons d'abord : calibrage, enregistrement, courbe, classification. **Point de décision** : si la fiabilité est suffisante (objectif ≥ 85 % d'accord avec l'oreille de l'utilisateur sur des mots de 1 à 2 syllabes), carte prononciation notée automatiquement. Sinon, auto-évaluation avec courbe indicative.
- Carte prononciation, paires de tons, dictée de tons, échauffement en séance.
- Option « Suis-je compris ? ».
- **Critère** : l'échauffement oral et la carte prononciation sont intégrés à la séance quotidienne.

### Étape 5 — Finitions
- Couleurs des tons partout, sangsues, notes personnelles, couverture de lecture, raccourcis clavier, thème sombre.
- Paires minimales si le temps le permet.

---

## 16. Risques et questions ouvertes

| # | Sujet | Détail | Traitement |
|---|---|---|---|
| R1 | Fiabilité de l'analyse des tons | Voix, micro, bruit, découpage des syllabes | Prototype + point de décision à l'étape 4 |
| R2 | Couverture et qualité de CFDICT | Entrées manquantes ou brèves | Secours CC-CEDICT avec marqueur « EN », traductions éditables |
| R3 | Qualité des voix de synthèse | Variable selon l'appareil | Choix de voix ; enregistrements natifs en V2 |
| R4 | Tracé à la souris | Frustration, fausses erreurs | Tolérance réglable, correction de note, écriture plutôt sur téléphone |
| R5 | Licences | SUBTLEX-CH et listes HSK à confirmer | Vérification à l'étape 0 ; usage strictement personnel |
| Q1 | Hébergement | ✅ **GitHub Pages** (compte existant) | Tranché |
| Q2 | Nom de l'application | ✅ **PolyChinese** | Tranché |
| Q3 | Couleurs des tons | ✅ Proposition par défaut retenue | Tranché |
| Q4 | Cartes par défaut | ✅ On garde 4 cartes par mot | À réévaluer après quelques semaines d'usage réel (étape 3) |

---

## 17. Annotations de l'utilisateur

*(Espace libre pour vos remarques, désaccords et idées.)*

-
