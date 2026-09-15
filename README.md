# Veille — plugin Obsidian

Récupère les articles retenus par le collecteur `veille` et les range dans ton coffre,
filtrés en local par tes propres mots-clés et thèmes (ce filtre ne quitte jamais ta
machine — seul le jeton d'accès part vers le serveur).

## Installer

**Avec BRAT** (recommandé — mises à jour automatiques) :
1. Installe le plugin communautaire **BRAT** (Réglages → Modules communautaires).
2. BRAT → *Add beta plugin* → colle `https://github.com/0emirhan/obsiveille` → Add.
3. Réglages → Modules communautaires : active **Veille**.

**Sans BRAT** (manuel) :
1. Copie `manifest.json` et `main.js` de ce repo dans
   `<ton coffre>/.obsidian/plugins/veille/`.
2. Réglages → Modules communautaires : désactive le mode restreint, puis active **Veille**.

**Avec le coffre prêt à l'emploi** (si tu pars de zéro, sans coffre existant) : télécharge
[`coffre-modele/`](coffre-modele/), ouvre-le comme coffre dans Obsidian (*Ouvrir un autre
coffre → Ouvrir un dossier comme coffre*). Le plugin y est déjà installé — voir
`Bienvenue.md` une fois ouvert. Pas de mise à jour automatique par ce chemin-là : repasse
par BRAT si tu veux suivre les évolutions du plugin.

## Configurer

Réglages → onglet **Veille** : colle le **jeton** qu'on t'a donné (l'adresse du serveur
est déjà pré-remplie). Clique **Tester**, puis synchronise (icône satellite dans la barre
latérale, ou commande *Veille : synchroniser maintenant*).

Le reste (mots-clés, thèmes, dossier, synchro automatique) est optionnel — vide = tout.
