"use strict";
// Plugin Obsidian « Veille » — client du serveur veille (VPS).
//
// Il tire les articles retenus par le collecteur, les FILTRE par TES mots-clés et thèmes
// (le filtrage se fait ici, sur ta machine : tes centres d'intérêt ne sont jamais
// envoyés au serveur), et écrit les notes + images dans le coffre. Il ne réécrit jamais
// une note déjà présente, donc tes cases (lu / top / bof) sont préservées.
//
// JS pur, aucune dépendance, aucun bundler. Seul contact réseau : ton serveur veille.

const { Plugin, PluginSettingTab, Setting, Notice, Modal, requestUrl, normalizePath } = require("obsidian");

const DEFAUTS = {
  url: "https://notes.cyberintel.fr",
  jeton: "",
  nom: "",
  dossier: "Veille",
  motscles: "",          // un par ligne ou séparés par des virgules ; vide = tout
  themes: "",            // séparés par des virgules ; vide = tous
  jours_premier: 3,      // au premier passage, on ne remonte pas plus loin
  intervalle_min: 60,    // synchro auto ; 0 = manuel seulement
  derniere_synchro: "",  // horodatage serveur de la dernière synchro réussie
};

const EXT_IMAGE = /\.(?:jpe?g|png|gif|webp|avif)$/i;

// ── petites fonctions ────────────────────────────────────────────────────────
function normaliser(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[‘’ʼ`]/g, "'")
    .toLowerCase();
}

function liste(champ) {
  return (champ || "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function motif_motscles(mots) {
  // Même logique que la config du collecteur : « * » final = n'importe quelle fin de
  // mot ; espace et tiret interchangeables ; frontières de mot.
  const morceaux = [];
  for (let mot of mots) {
    mot = normaliser(mot);
    if (!mot) continue;
    const joker = mot.endsWith("*");
    mot = mot.replace(/\*+$/, "");
    const parties = mot.split(/[\s-]+/).filter(Boolean).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!parties.length) continue;
    morceaux.push(parties.join("[\\s-]*") + (joker ? "\\w*" : ""));
  }
  if (!morceaux.length) return null;
  morceaux.sort((a, b) => b.length - a.length);
  return new RegExp("(?<!\\w)(?:" + morceaux.join("|") + ")(?!\\w)", "u");
}

function dossier_parent(chemin) {
  const i = chemin.lastIndexOf("/");
  return i < 0 ? "" : chemin.slice(0, i);
}

function joindre(a, b) {
  return [a, b].filter(Boolean).join("/").replace(/\/+/g, "/");
}

// ── le plugin ────────────────────────────────────────────────────────────────
module.exports = class VeillePlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAUTS, await this.loadData());
    this.enCours = false;

    this.addRibbonIcon("satellite", "Synchroniser la veille", () => this.synchroniser(false));
    this.addCommand({ id: "veille-sync", name: "Synchroniser maintenant", callback: () => this.synchroniser(false) });
    this.addCommand({ id: "veille-sync-full", name: "Tout resynchroniser", callback: () => this.synchroniser(true) });
    this.addCommand({ id: "veille-proposer", name: "Proposer une source ou un mot-clé", callback: () => new ModalePropo(this.app, this).open() });
    this.addSettingTab(new OngletReglages(this.app, this));

    this.programmer_auto();
  }

  async sauver() {
    await this.saveData(this.settings);
  }

  programmer_auto() {
    if (this.minuteur) window.clearInterval(this.minuteur);
    const m = Number(this.settings.intervalle_min) || 0;
    if (m > 0) {
      this.minuteur = window.setInterval(() => this.synchroniser(false).catch(() => {}), m * 60000);
      this.registerInterval(this.minuteur);
    }
  }

  // ── appels au serveur ──────────────────────────────────────────────────────
  async api(chemin, opts = {}) {
    const base = (this.settings.url || "").replace(/\/+$/, "");
    if (!base) throw new Error("adresse du serveur non renseignée");
    return requestUrl({
      url: base + chemin,
      method: opts.method || "GET",
      headers: Object.assign({ Authorization: "Bearer " + (this.settings.jeton || "") }, opts.headers || {}),
      body: opts.body,
      throw: false,
    });
  }

  async tester() {
    try {
      const s = await this.api("/api/sante");
      if (s.status !== 200) return `serveur injoignable (HTTP ${s.status})`;
      const a = await this.api("/api/articles?depuis=2099-01-01T00:00");
      if (a.status === 401) return "connexion OK, mais jeton refusé";
      if (a.status !== 200) return `connexion OK, mais /api/articles → HTTP ${a.status}`;
      return "OK";
    } catch (e) {
      return "échec : " + (e.message || e);
    }
  }

  // ── filtrage perso ─────────────────────────────────────────────────────────
  garder(art, themes, motif) {
    if (themes.length) {
      const t = (art.themes || []).map((x) => x.toLowerCase());
      if (!themes.some((x) => t.includes(x))) return false;
    }
    if (motif) {
      const foin = normaliser([art.titre, art.resume, (art.themes || []).join(" ")].join(" "));
      if (!motif.test(foin)) return false;
    }
    return true;
  }

  // ── synchronisation ────────────────────────────────────────────────────────
  async synchroniser(complet) {
    if (this.enCours) return;
    if (!this.settings.url || !this.settings.jeton) {
      new Notice("Veille : renseigne l'adresse et le jeton dans les réglages.");
      return;
    }
    this.enCours = true;
    const avis = new Notice("Veille : synchronisation…", 0);
    try {
      let depuis = complet ? "" : this.settings.derniere_synchro;
      if (!depuis && this.settings.jours_premier > 0) {
        const d = new Date(Date.now() - this.settings.jours_premier * 86400000);
        depuis = d.toISOString().slice(0, 19);
      }
      const rep = await this.api("/api/articles" + (depuis ? "?depuis=" + encodeURIComponent(depuis) : ""));
      if (rep.status === 401) throw new Error("jeton refusé");
      if (rep.status !== 200) throw new Error("HTTP " + rep.status);
      const data = rep.json;

      const themes = liste(this.settings.themes).map((x) => x.toLowerCase());
      const motif = motif_motscles(liste(this.settings.motscles));
      const retenus = (data.articles || []).filter((a) => this.garder(a, themes, motif));

      let ecrits = 0, ignores = 0, echecs = 0;
      for (const art of retenus) {
        try {
          const fait = await this.ecrire_article(art);
          if (fait) ecrits++; else ignores++;
        } catch (e) {
          echecs++;
          console.error("Veille : échec sur", art.note, e);
        }
      }

      await this.installer_vues();
      if (data.maj) this.settings.derniere_synchro = data.maj;
      await this.sauver();
      avis.hide();
      new Notice(`Veille : ${ecrits} nouvel(le)s, ${ignores} déjà là` + (echecs ? `, ${echecs} en échec` : ""));
    } catch (e) {
      avis.hide();
      new Notice("Veille : " + (e.message || e), 8000);
    } finally {
      this.enCours = false;
    }
  }

  async ecrire_article(art) {
    const dossier = this.settings.dossier || "";
    const cheminNote = normalizePath(joindre(dossier, art.note));
    if (await this.app.vault.adapter.exists(cheminNote)) return false; // on ne touche pas à tes éditions

    const rep = await this.api("/api/note?chemin=" + encodeURIComponent(art.note));
    if (rep.status !== 200) throw new Error("note HTTP " + rep.status);
    let md = rep.text;

    // Images référencées (chemins serveur « _medias/… »).
    const medias = new Set();
    for (const m of md.matchAll(/_medias\/[^\]\)"'\s]+/g)) {
      if (EXT_IMAGE.test(m[0])) medias.add(m[0]);
    }
    for (const rel of medias) {
      const cible = normalizePath(joindre(dossier, rel));
      if (!(await this.app.vault.adapter.exists(cible))) {
        const img = await this.api("/api/media?chemin=" + encodeURIComponent(rel));
        if (img.status === 200 && img.arrayBuffer) {
          await this.assurer_dossier(dossier_parent(cible));
          await this.app.vault.adapter.writeBinary(cible, img.arrayBuffer);
        }
      }
    }
    // Repointer les liens vers le sous-dossier du coffre.
    if (dossier) md = md.split("[[_medias/").join("[[" + dossier + "/_medias/");

    await this.assurer_dossier(dossier_parent(cheminNote));
    await this.app.vault.adapter.write(cheminNote, md);
    return true;
  }

  async assurer_dossier(chemin) {
    if (!chemin) return;
    let cur = "";
    for (const p of normalizePath(chemin).split("/")) {
      cur = cur ? cur + "/" + p : p;
      if (!(await this.app.vault.adapter.exists(cur))) {
        try { await this.app.vault.adapter.mkdir(cur); } catch (e) { /* course : déjà créé */ }
      }
    }
  }

  // Écrit une fois une page d'accueil et une base (mêmes vues que le mode local).
  async installer_vues() {
    const dossier = this.settings.dossier || "";
    const articles = joindre(dossier, "Articles");
    const base = normalizePath(joindre(dossier, "Veille.base"));
    const accueil = normalizePath(joindre(dossier, "Accueil.md"));
    if (dossier) await this.assurer_dossier(dossier);
    if (!(await this.app.vault.adapter.exists(base))) {
      await this.app.vault.adapter.write(base, texte_base(articles));
    }
    if (!(await this.app.vault.adapter.exists(accueil))) {
      await this.app.vault.adapter.write(accueil, texte_accueil(articles));
    }
  }

  async proposer(type, valeur, theme) {
    const rep = await this.api("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, valeur, theme: theme || "", par: this.settings.nom || "" }),
    });
    if (rep.status !== 200) throw new Error("HTTP " + rep.status);
  }
};

// ── réglages ─────────────────────────────────────────────────────────────────
class OngletReglages extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl: c } = this;
    c.empty();
    c.createEl("h2", { text: "Veille" });
    const s = this.plugin.settings;
    const maj = async () => this.plugin.sauver();

    new Setting(c).setName("Adresse du serveur").setDesc("Ex. https://notes.cyberintel.fr")
      .addText((t) => t.setValue(s.url).onChange(async (v) => { s.url = v.trim(); await maj(); }));

    new Setting(c).setName("Jeton").setDesc("Celui que t'a donné l'opérateur")
      .addText((t) => { t.inputEl.type = "password"; t.setValue(s.jeton).onChange(async (v) => { s.jeton = v.trim(); await maj(); }); });

    new Setting(c).setName("Ton nom").setDesc("Pour signer tes propositions de sources")
      .addText((t) => t.setValue(s.nom).onChange(async (v) => { s.nom = v.trim(); await maj(); }));

    new Setting(c).setName("Tester la connexion")
      .addButton((b) => b.setButtonText("Tester").onClick(async () => {
        b.setDisabled(true); b.setButtonText("…");
        const r = await this.plugin.tester();
        new Notice("Veille : " + r, 6000);
        b.setDisabled(false); b.setButtonText("Tester");
      }));

    c.createEl("h3", { text: "Ce que tu veux voir (reste sur ta machine)" });

    new Setting(c).setName("Mots-clés").setDesc("Un par ligne ou séparés par des virgules. « espion* » prend espion, espions… Vide = tout ce qui passe le filtre des thèmes.")
      .addTextArea((t) => { t.inputEl.rows = 4; t.setValue(s.motscles).onChange(async (v) => { s.motscles = v; await maj(); }); });

    new Setting(c).setName("Thèmes").setDesc("Séparés par des virgules (espionnage, cyber, moyen-orient…). Vide = tous.")
      .addText((t) => t.setValue(s.themes).onChange(async (v) => { s.themes = v; await maj(); }));

    c.createEl("h3", { text: "Récupération" });

    new Setting(c).setName("Dossier dans le coffre")
      .addText((t) => t.setValue(s.dossier).onChange(async (v) => { s.dossier = v.trim().replace(/^\/+|\/+$/g, ""); await maj(); }));

    new Setting(c).setName("Jours au premier passage").setDesc("Combien de jours remonter la toute première fois.")
      .addText((t) => t.setValue(String(s.jours_premier)).onChange(async (v) => { s.jours_premier = Math.max(0, parseInt(v) || 0); await maj(); }));

    new Setting(c).setName("Synchro automatique").setDesc("Minutes entre deux synchros (0 = seulement à la main).")
      .addText((t) => t.setValue(String(s.intervalle_min)).onChange(async (v) => { s.intervalle_min = Math.max(0, parseInt(v) || 0); await maj(); this.plugin.programmer_auto(); }));

    new Setting(c).setName("Synchroniser").addButton((b) => b.setButtonText("Maintenant").setCta().onClick(() => this.plugin.synchroniser(false)))
      .addButton((b) => b.setButtonText("Tout resynchroniser").onClick(() => this.plugin.synchroniser(true)));
  }
}

// ── proposer une source / un mot-clé ─────────────────────────────────────────
class ModalePropo extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.type = "source";
    this.valeur = "";
    this.theme = "";
  }

  onOpen() {
    const { contentEl: c } = this;
    c.createEl("h3", { text: "Proposer à l'opérateur" });
    new Setting(c).setName("Type")
      .addDropdown((d) => d.addOption("source", "Une source (flux RSS, site)").addOption("motcle", "Un mot-clé / sujet")
        .setValue(this.type).onChange((v) => { this.type = v; }));
    new Setting(c).setName("Valeur").setDesc("Adresse du flux, ou le mot-clé / sujet.")
      .addText((t) => { t.inputEl.style.width = "100%"; t.onChange((v) => { this.valeur = v.trim(); }); });
    new Setting(c).setName("Thème (facultatif)")
      .addText((t) => t.onChange((v) => { this.theme = v.trim(); }));
    new Setting(c).addButton((b) => b.setButtonText("Envoyer").setCta().onClick(async () => {
      if (!this.valeur) { new Notice("Veille : indique une valeur."); return; }
      try {
        await this.plugin.proposer(this.type, this.valeur, this.theme);
        new Notice("Veille : proposition envoyée. Merci !");
        this.close();
      } catch (e) {
        new Notice("Veille : échec de l'envoi (" + (e.message || e) + ")", 6000);
      }
    }));
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ── vues Obsidian (mêmes qu'en mode local) ───────────────────────────────────
function texte_base(articles) {
  return `filters:
  and:
    - file.inFolder("${articles}")
properties:
  note.source:
    displayName: Source
  note.themes:
    displayName: Thèmes
  note.publie:
    displayName: Publié
  note.lu:
    displayName: Lu
views:
  - type: cards
    name: À lire
    filters:
      and:
        - 'lu != true'
    image: note.image
    imageAspectRatio: 0.62
    sort:
      - property: note.publie
        direction: DESC
    limit: 120
  - type: table
    name: Par thème
    groupBy:
      property: note.themes
      direction: ASC
    order:
      - file.name
      - note.source
      - note.publie
      - note.lu
    sort:
      - property: note.publie
        direction: DESC
  - type: table
    name: Liste
    order:
      - file.name
      - note.source
      - note.themes
      - note.publie
      - note.lu
    sort:
      - property: note.publie
        direction: DESC
`;
}

function texte_accueil(articles) {
  return `---
tags:
  - veille
---

# 🛰 Veille

Les articles non lus, du plus récent au plus ancien. Coche **Lu** dans une note pour la
retirer d'ici. « Synchroniser la veille » (icône satellite / palette de commandes) en
récupère de nouveaux ; « Proposer une source » les suggère à l'opérateur.

\`\`\`base
filters:
  and:
    - file.inFolder("${articles}")
    - 'lu != true'
views:
  - type: cards
    name: À lire
    image: note.image
    imageAspectRatio: 0.62
    sort:
      - property: note.publie
        direction: DESC
    limit: 60
\`\`\`
`;
}
