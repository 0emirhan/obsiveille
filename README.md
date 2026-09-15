# Veille — plugin Obsidian

Récupère les articles retenus par le collecteur `veille` et les range dans ton coffre,
filtrés en local par tes propres mots-clés et thèmes (ce filtre ne quitte jamais ta
machine — seuls l'adresse du serveur et le jeton d'accès sont envoyés).

## Installer

**Avec BRAT** (recommandé — mises à jour automatiques) :
1. Installe le plugin communautaire **BRAT** (Réglages → Modules communautaires).
2. BRAT → *Add beta plugin* → colle `https://github.com/0emirhan/obsiveille` → Add.
3. Réglages → Modules communautaires : active **Veille**.

**Sans BRAT** (manuel) : copie `manifest.json` et `main.js` de ce repo dans
`<ton coffre>/.obsidian/plugins/veille/`, puis Réglages → Modules communautaires :
désactive le mode restreint, active **Veille**.

**En partant de zéro** (pas encore de coffre) : décompresse [`coffre-modele/`](coffre-modele/)
et ouvre-le comme coffre dans Obsidian (*Ouvrir un autre coffre → Ouvrir un dossier comme
coffre*). Le plugin et le snippet d'habillage sont déjà en place — voir `Bienvenue.md`
une fois ouvert. Pas de mise à jour automatique par ce chemin-là : repasse par BRAT si tu
veux suivre les évolutions du plugin.

## Configurer

Réglages → onglet **Veille** : colle l'**adresse du serveur** et le **jeton** qu'on t'a
donnés. Clique **Tester**, puis synchronise (icône satellite dans la barre latérale, ou
commande *Veille : synchroniser maintenant*).

Le reste (mots-clés, thèmes, dossier, synchro automatique) est optionnel — vide = tout.

## Habillage (optionnel)

`snippets/veille.css` : callouts *Chapeau* / traduction distincts, coins arrondis et
liseré de couleur par thème sur les vues cartes de `Veille.base`. Déjà inclus dans
`coffre-modele/`. Pour un coffre existant : copie-le dans
`<ton coffre>/.obsidian/snippets/`, puis active-le dans Réglages → Apparence →
Snippets CSS.
