// ── Badges, Titres & Cadres ──────────────────────────────
// Catalogue central des récompenses. Chaque badge/titre a un check(ctx)
// évalué en fin de partie à partir des stats (cumulées + de la partie).
//
// ctx attendu :
//   totalGames, totalSipsDrunk, totalSipsGiven, bluffSuccess, level   (cumulés, APRÈS cette partie)
//   sipsThisGame, givenThisGame, bluffThisGame, culSec, memoryPerfect  (cette partie)
//   isTopDrinker, isTopGiver, isSober, isLuckiest, numPlayers          (dérivés de la partie)

export const BADGES = {
  first_game: {
    id: 'first_game', name: 'Premier verre', desc: 'Terminer sa première partie',
    icon: 'ph-beer-stein', bg: 'linear-gradient(145deg, #b8720a, #e8a045, #c8860a)', glow: 'rgba(232,160,69,.55)', textColor: '#1a1a1a',
    check: c => c.totalGames >= 1,
  },
  cul_sec: {
    id: 'cul_sec', name: 'Cul Sec', desc: 'Boire un cul sec et survivre',
    icon: 'ph-fire', bg: 'linear-gradient(145deg, #a93226, #e74c3c, #c0392b)', glow: 'rgba(231,76,60,.55)', textColor: '#fff',
    check: c => !!c.culSec,
  },
  liar: {
    id: 'liar', name: 'Le Menteur', desc: 'Bluffer avec succès 3 fois',
    icon: 'ph-theater-masks', bg: 'linear-gradient(145deg, #5b2c6f, #9b59b6, #7d3c98)', glow: 'rgba(155,89,182,.55)', textColor: '#fff',
    check: c => c.bluffSuccess >= 3,
  },
  memory: {
    id: 'memory', name: 'Mémoire d\'éléphant', desc: 'Retrouver ses 4 cartes en phase mémoire',
    icon: 'ph-brain', bg: 'linear-gradient(145deg, #154360, #2980b9, #1a5276)', glow: 'rgba(41,128,185,.55)', textColor: '#fff',
    check: c => !!c.memoryPerfect,
  },
  grand_drinker: {
    id: 'grand_drinker', name: 'Grand buveur', desc: 'Accumuler 50 gorgées bues',
    icon: 'ph-skull', bg: 'linear-gradient(145deg, #1c2833, #4a5568, #2c3e50)', glow: 'rgba(74,85,104,.55)', textColor: '#ecf0f1',
    check: c => c.totalSipsDrunk >= 50,
  },
  // ── Nouveaux paliers ──
  regular: {
    id: 'regular', name: 'Habitué du comptoir', desc: 'Jouer 10 parties',
    icon: 'ph-medal', bg: 'linear-gradient(145deg, #6d4c0f, #d4a017, #a9820c)', glow: 'rgba(212,160,23,.5)', textColor: '#1a1a1a',
    check: c => c.totalGames >= 10,
  },
  legend: {
    id: 'legend', name: 'Gitan légendaire', desc: 'Jouer 20 parties',
    icon: 'ph-crown', bg: 'linear-gradient(145deg, #b7770d, #f39c12, #d4a017)', glow: 'rgba(243,156,18,.55)', textColor: '#1a1a1a',
    check: c => c.totalGames >= 20,
  },
  sponge: {
    id: 'sponge', name: 'L\'Éponge', desc: 'Accumuler 150 gorgées bues',
    icon: 'ph-drop', bg: 'linear-gradient(145deg, #145a75, #2980b9, #1a6a8a)', glow: 'rgba(41,128,185,.5)', textColor: '#fff',
    check: c => c.totalSipsDrunk >= 150,
  },
  bartender: {
    id: 'bartender', name: 'Le Barman', desc: 'Distribuer 75 gorgées',
    icon: 'ph-hand-heart', bg: 'linear-gradient(145deg, #1e8449, #2ecc71, #239b56)', glow: 'rgba(46,204,113,.5)', textColor: '#0e2a19',
    check: c => c.totalSipsGiven >= 75,
  },
  mastermind: {
    id: 'mastermind', name: 'Le Cerveau', desc: 'Bluffer avec succès 10 fois',
    icon: 'ph-strategy', bg: 'linear-gradient(145deg, #4a235a, #8e44ad, #6c3483)', glow: 'rgba(142,68,173,.55)', textColor: '#fff',
    check: c => c.bluffSuccess >= 10,
  },
};

// ── Titres : la récompense « chaque partie » ──────────────
// Beaucoup de titres liés à la performance de la partie → on en gagne
// quasiment un à chaque partie (jusqu'à les avoir collectionnés).
export const TITLES = {
  // Flavor / progression
  recrue:   { id: 'recrue',   name: 'La Recrue',            desc: 'Ta première partie',            check: c => c.totalGames >= 1 },
  habitue:  { id: 'habitue',  name: 'L\'Habitué',           desc: '3 parties jouées',              check: c => c.totalGames >= 3 },
  fetard:   { id: 'fetard',   name: 'Le Fêtard',            desc: '5 parties jouées',              check: c => c.totalGames >= 5 },
  pilier:   { id: 'pilier',   name: 'Pilier de comptoir',   desc: '15 parties jouées',             check: c => c.totalGames >= 15 },
  roi:      { id: 'roi',      name: 'Roi de la Gitanerie',  desc: 'Atteindre le niveau 10',        check: c => c.level >= 10 },
  // Performance de la partie
  sobre:    { id: 'sobre',    name: 'Le Sobre',             desc: 'Finir une partie sans boire',   check: c => c.isSober },
  chanceux: { id: 'chanceux', name: 'Le Chanceux',          desc: 'Le moins de gorgées de la table', check: c => c.isLuckiest && c.numPlayers >= 3 },
  eponge:   { id: 'eponge',   name: 'Sac à gorgées',        desc: 'Le plus gros buveur d\'une partie', check: c => c.isTopDrinker && c.sipsThisGame > 0 },
  genereux: { id: 'genereux', name: 'Le Généreux',          desc: 'Distribuer le plus de gorgées',  check: c => c.isTopGiver && c.givenThisGame > 0 },
  bluffeur: { id: 'bluffeur', name: 'Beau parleur',         desc: 'Réussir un bluff dans la partie', check: c => c.bluffThisGame >= 1 },
  cascadeur:{ id: 'cascadeur',name: 'Le Cascadeur',         desc: 'Survivre à un cul sec',          check: c => !!c.culSec },
  savant:   { id: 'savant',   name: 'Le Savant',            desc: 'Mémoire parfaite',               check: c => !!c.memoryPerfect },
  // Paliers gorgées
  descente: { id: 'descente', name: 'Grosse descente',      desc: '10 gorgées bues en une partie',  check: c => c.sipsThisGame >= 10 },
  machine:  { id: 'machine',  name: 'Machine à boire',      desc: '200 gorgées bues au total',      check: c => c.totalSipsDrunk >= 200 },
  // ── Titres débiles ──
  clebard:    { id: 'clebard',    name: 'Le clébard',            desc: 'Cul sec ET finir dernier de la table',      check: c => c.culSec && c.isTopDrinker },
  trou_noir:  { id: 'trou_noir',  name: 'Le trou noir',          desc: '15 gorgées bues en une seule partie',       check: c => c.sipsThisGame >= 15 },
  pls:        { id: 'pls',        name: 'Le PLS',                desc: '25 gorgées bues en une partie (à quatre pattes)', check: c => c.sipsThisGame >= 25 },
  bras_casse: { id: 'bras_casse', name: 'Bras cassé',            desc: 'Boire sans distribuer une seule gorgée',    check: c => c.sipsThisGame > 0 && c.givenThisGame === 0 },
  emmerdeur:  { id: 'emmerdeur',  name: "L'emmerdeur",           desc: 'Distribuer 15 gorgées en une partie',       check: c => c.givenThisGame >= 15 },
  pochtron:   { id: 'pochtron',   name: 'Le pochtron',           desc: '5 culs secs cumulés',                       check: c => (c.totalCulSec || 0) >= 5 },
  victime:    { id: 'victime',    name: 'La victime',            desc: 'Plus gros buveur 2 parties de suite',       check: c => (c.topDrinkerStreak || 0) >= 2 },
  chameau:    { id: 'chameau',    name: 'Sobre comme un chameau', desc: '3 parties de suite sans boire une gorgée', check: c => (c.soberStreak || 0) >= 3 },
  idiot_village:  { id: 'idiot_village',  name: "L'idiot du village", desc: 'Se faire prendre à mentir 3 fois de suite', check: c => (c.maxBluffFailStreak || 0) >= 3 },
  mytho:          { id: 'mytho',          name: 'Le mytho',           desc: 'Accusé à tort 3 fois de suite dans une partie', check: c => (c.maxBluffSuccessStreak || 0) >= 3 },
  tete_a_claques: { id: 'tete_a_claques', name: 'Tête à claques',     desc: 'Le plus accusé de menteur de la partie', check: c => c.isTopMenteur && (c.menteurCaught || 0) >= 2 },
  boulet:         { id: 'boulet',         name: 'Le boulet',          desc: 'Rater ses 4 cartes en phase mémoire (0/4)', check: c => !!c.memoryFail },
  // ── Titres cachés (easter-eggs) — débloqués par le pseudo, invisibles tant que non obtenus ──
  oss117:   { id: 'oss117',   name: 'OSS 117',              desc: '« Vous êtes un rempart contre la barbarie nazie »', hidden: true, pseudo: ['hubert'] },
};

export const BORDERS = {
  bronze: { id: 'bronze', name: 'Bronze', minLevel: 5,  gradient: 'linear-gradient(135deg, #cd7f32, #8b4513, #e8a55a, #cd7f32)', preview: '#cd7f32' },
  silver: { id: 'silver', name: 'Argent', minLevel: 10, gradient: 'linear-gradient(135deg, #c0c0c0, #808080, #e8e8e8, #c0c0c0)', preview: '#c0c0c0' },
  gold:   { id: 'gold',   name: 'Or',     minLevel: 20, gradient: 'linear-gradient(135deg, #ffd700, #f39c12, #fffacd, #ffd700)', preview: '#ffd700' },
  legend: { id: 'legend', name: 'Légende', minLevel: 30, gradient: null, preview: '#f39c12', animated: true },
};

// ── Évaluation des récompenses en fin de partie ───────────
// Renvoie les nouveaux badges/titres + un petit bonus XP « filet de sécurité »
// pour garantir AU MOINS une récompense à chaque partie.
export function evaluateGameRewards(prev, ctx) {
  const ownedBadges = new Set(prev.badges || []);
  const ownedTitles = new Set(prev.titles || []);
  const newBadges = [], newTitles = [];
  for (const b of Object.values(BADGES)) if (b.check && !ownedBadges.has(b.id) && b.check(ctx)) newBadges.push(b.id);
  for (const t of Object.values(TITLES)) if (t.check && !ownedTitles.has(t.id) && t.check(ctx)) newTitles.push(t.id);
  const nothingNew = newBadges.length === 0 && newTitles.length === 0;
  return { newBadges, newTitles, bonusXp: nothingNew ? 5 : 0, nothingNew };
}

// ── Rétro-compat (ancien end.html) ──
export function checkNewBadges(existingBadges = [], ctx = {}) {
  return evaluateGameRewards({ badges: existingBadges, titles: [] }, ctx).newBadges;
}

export function availableBorders(level) {
  return Object.values(BORDERS).filter(b => level >= b.minLevel);
}

// ── Titres easter-egg selon le pseudo ─────────────────────
export function normalizePseudo(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// Renvoie les titres cachés débloqués par ce pseudo (non encore possédés)
export function checkPseudoTitles(pseudo, owned = []) {
  const p = normalizePseudo(pseudo);
  if (!p) return [];
  const ownedSet = new Set(owned);
  const found = [];
  for (const t of Object.values(TITLES)) {
    if (!t.pseudo || ownedSet.has(t.id)) continue;
    if (t.pseudo.some(k => p.includes(normalizePseudo(k)))) found.push(t.id);
  }
  return found;
}
