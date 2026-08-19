// ══════════════════════════════════════════════════════════════════════
//  Mode Soirée HORS LIGNE — distribution déterministe
//
//  Principe : on ne transmet pas les cartes, on transmet la RECETTE du
//  mélange. Tous les téléphones dérivent le même paquet à partir du même
//  code, puis chacun n'affiche que la main de son numéro. Aucun échange
//  réseau, aucune radio, aucune permission — six caractères dits à voix
//  haute suffisent.
//
//  Ce mode ne fonctionne QUE pour la Soirée, et c'est structurel : la main
//  y est distribuée une fois et ne change plus jamais. La Pyramide
//  classique, elle, a un état qui bouge à chaque tour et exige un arbitre.
// ══════════════════════════════════════════════════════════════════════

// Les règles de tirage viennent de utils.js : c'est la MÊME source que le mode
// en ligne. Les redéfinir ici ferait deux jeux différents selon la connexion.
import { defaultPyramidRows, createPyramidOrder, maxPyramidRows, MAX_PLAYERS } from '/js/game/utils.js';

// Alphabet sans I, O, 0, 1 : ces caractères se confondent à l'oral et à la
// lecture, or le code est justement fait pour être crié à travers une table.
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Même plafond qu'en ligne : au-delà, même une pyramide de 2 rangées ne tient
// plus dans le paquet.
export const MAX_OFFLINE_PLAYERS = MAX_PLAYERS;
export const MIN_OFFLINE_PLAYERS = 2;

// ── Générateur pseudo-aléatoire à graine ──
// mulberry32 : court, rapide, et surtout DÉTERMINISTE — c'est tout l'enjeu.
// Math.random() ne convient pas : chaque téléphone tirerait un paquet différent.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hachage FNV-1a : disperse deux codes voisins (KQ7MP2 / KQ7MP3) sur des
// graines totalement différentes.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── Le code ──
// Caractère 1 : le nombre de joueurs (indispensable — il détermine le nombre
// de rangs de la pyramide ET l'endroit où commencent ses cartes dans le
// paquet). Caractères 2 à 6 : la graine, 25 bits de hasard.
export function makeCode(numPlayers) {
  const n = clampPlayers(numPlayers);
  let code = ALPHABET[n];
  for (let i = 0; i < 5; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function clampPlayers(n) {
  n = parseInt(n, 10);
  if (!Number.isFinite(n)) return MIN_OFFLINE_PLAYERS;
  return Math.max(MIN_OFFLINE_PLAYERS, Math.min(MAX_OFFLINE_PLAYERS, n));
}

// Renvoie null si le code est invalide — le champ de saisie s'en sert pour
// n'activer le bouton que sur un code réellement exploitable.
export function parseCode(code) {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  if (c.length !== 6) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  const n = ALPHABET.indexOf(c[0]);
  if (n < MIN_OFFLINE_PLAYERS || n > MAX_OFFLINE_PLAYERS) return null;
  return { code: c, numPlayers: n };
}

// ── Le tirage ──
// Reproduit EXACTEMENT l'ordre du mode en ligne (voir utils.js/createDeck et
// waiting.js/onStart) : même construction du paquet, même Fisher-Yates
// descendant, mêmes 4 cartes par joueur dans l'ordre des numéros, puis la
// pyramide remplie avec le reste. Toute divergence ici donnerait deux règles
// du jeu selon qu'on est connecté ou non.
const SUITS  = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function deal(code) {
  const parsed = parseCode(code);
  if (!parsed) return null;
  const { numPlayers } = parsed;
  const rng = mulberry32(hashSeed(parsed.code));

  const deck = SUITS.flatMap(suit => VALUES.map(value => ({ suit, value })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const hands = [];
  for (let i = 0; i < numPlayers; i++) {
    hands.push(deck.slice(i * 4, i * 4 + 4).map(c => ({ ...c, revealed: false })));
  }

  const numRows = Math.max(2, Math.min(defaultPyramidRows(numPlayers), maxPyramidRows(numPlayers)));
  const order   = createPyramidOrder(numRows);
  const rest    = deck.slice(numPlayers * 4);
  const pyramid = Array.from({ length: numRows }, (_, r) =>
    Array.from({ length: r + 1 }, () => ({ revealed: false, value: null, suit: null })));
  order.forEach((pos, i) => {
    const c = rest[i];
    if (c) { pyramid[pos.row][pos.col].value = c.value; pyramid[pos.row][pos.col].suit = c.suit; }
  });

  return { code: parsed.code, numPlayers, numRows, pyramid, pyramidOrder: order, hands };
}

// ── L'objet de partie ──
// Même forme que celui que Firebase envoie au mode en ligne : pyramidOral.js
// ne fait aucune différence entre les deux. C'est ce qui permet de n'avoir
// qu'une seule implémentation du jeu.
export function buildGame(code, mySlot, names) {
  const d = deal(code);
  if (!d) return null;
  const players = {};
  for (let i = 0; i < d.numPlayers; i++) {
    players['p' + (i + 1)] = {
      name: (names && names[i]) || `${i + 1}`,
      cards: d.hands[i],
      avatar: '🃏',
    };
  }
  return {
    gameCode: d.code,
    mode: 'oral',
    phase: 'pyramid',
    offline: true,
    oralIndex: -1,
    oralReveals: null,
    pyramid: d.pyramid,
    pyramidOrder: d.pyramidOrder,
    players,
    playerId: 'p' + mySlot,
    rules: { cardStyle: 'classic' },
  };
}
