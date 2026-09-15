# Veille — plugin Obsidian

Récupère les articles retenus par le collecteur `veille` et les range dans ton coffre,
filtrés en local par tes propres mots-clés et thèmes (ce filtre ne quitte jamais ta
machine — seul le jeton d'accès part vers le serveur).

Ce repo est **privé** : les fichiers sont envoyés directement (pas d'installation via
BRAT tant qu'il n'est pas public — voir tout en bas si ça change un jour).

## Installer

**Avec un coffre existant** : copie `manifest.json` et `main.js` dans
`<ton coffre>/.obsidian/plugins/veille/`, puis Réglages → Modules communautaires :
désactive le mode restreint, active **Veille**.

**En partant de zéro** (pas encore de coffre) : décompresse [`coffre-modele/`](coffre-modele/)
et ouvre-le comme coffre dans Obsidian (*Ouvrir un autre coffre → Ouvrir un dossier comme
coffre*). Le plugin, le snippet d'habillage et le mode restreint sont déjà réglés — voir
`Bienvenue.md` une fois ouvert.

## Configurer

Réglages → onglet **Veille** : colle le **jeton** qu'on t'a donné (l'adresse du serveur
est déjà pré-remplie). Clique **Tester**, puis synchronise (icône satellite dans la barre
latérale, ou commande *Veille : synchroniser maintenant*).

Le reste (mots-clés, thèmes, dossier, synchro automatique) est optionnel — vide = tout.

## Habillage (optionnel)

`snippets/veille.css` : callouts *Chapeau* / traduction distincts, coins arrondis et
liseré de couleur par thème sur les vues cartes de `Veille.base`. Déjà inclus dans
`coffre-modele/`. Pour un coffre existant : copie-le dans
`<ton coffre>/.obsidian/snippets/`, puis active-le dans Réglages → Apparence →
Snippets CSS.

## Si ce repo passe public un jour

BRAT (plugin communautaire) permet alors une installation avec mises à jour
automatiques : Réglages → Modules communautaires → BRAT → *Add beta plugin* → coller
l'adresse de ce repo.
