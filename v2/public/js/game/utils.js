// =============================================
// UTILS — partagé par toutes les pages de jeu
// =============================================

// --- Identité invité ---
export function getGuestId() {
  let id = localStorage.getItem('guestId');
  if (!id) {
    id = 'guest_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('guestId', id);
  }
  return id;
}

export function getGuestName() {
  return localStorage.getItem('guestName') || 'Invité';
}

export function setGuestName(name) {
  localStorage.setItem('guestName', name);
}

export function getGuestAvatar() {
  return localStorage.getItem('guestAvatar') || '🃏';
}

export function setGuestAvatar(emoji) {
  localStorage.setItem('guestAvatar', emoji);
}

// --- Session de partie (localStorage pour survie au rechargement) ---
export function setGameSession(data) {
  localStorage.setItem('gameSession', JSON.stringify(data));
}

export function getGameSession() {
  try {
    return JSON.parse(localStorage.getItem('gameSession')) || null;
  } catch { return null; }
}

export function clearGameSession() {
  localStorage.removeItem('gameSession');
}

// --- Code de partie ---
export function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- Deck ---
export function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = suits.flatMap(suit => values.map(value => ({ suit, value })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- Pyramide ---
// pyramid[0] = sommet (1 carte = cul sec)
// pyramid[n-1] = base (n cartes)
export function createPyramid(numRows) {
  return Array.from({ length: numRows }, (_, i) =>
    Array(i + 1).fill(null).map(() => ({ revealed: false, value: null, suit: null }))
  );
}

export function defaultPyramidRows(numPlayers) {
  return Math.min(5, 2 + numPlayers);
}

// Ordre de retournement : bas-gauche → droite → remonte → sommet en dernier
export function createPyramidOrder(numRows) {
  const order = [];
  for (let row = numRows - 1; row >= 0; row--) {
    const numCards = row + 1;
    for (let col = 0; col < numCards; col++) {
      order.push({ row, col });
    }
  }
  return order;
}

// Gorgées par carte
export function getSipsForCard(row, totalRows) {
  if (row === 0) return { sips: 10, isCulSec: true };
  return { sips: totalRows - row, isCulSec: false };
}

// --- Valeur numérique ---
export function cardNumericValue(value) {
  return { J: 11, Q: 12, K: 13, A: 14 }[value] ?? parseInt(value);
}

// --- Symboles ---
export const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
export const SUIT_COLOR  = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };

// --- Face de carte unifiée (index d'angle empilé + pip central) ---
// Retourne le contenu interne d'une face de carte ; le conteneur porte la
// classe .cface (+ .red/.black) et fixe la taille via les variables --cf-*.
export function cardFaceInner(value, sym) {
  return `<span class="cf-idx tl"><span class="r">${value}</span><span class="s">${sym}</span></span>`
       + `<span class="cf-pip">${sym}</span>`
       + `<span class="cf-idx br"><span class="r">${value}</span><span class="s">${sym}</span></span>`;
}

// --- Toast ---
let toastTimer = null;
export function showToast(message, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// --- Redirect guard ---
export function requireSession(redirectTo = '/lobbypyramide.html') {
  const session = getGameSession();
  if (!session?.gameId || !session?.playerId) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

// --- Vérification prédiction phase 1 ---
export function checkPrediction(choice, card, stepIndex, allCards) {
  const val = cardNumericValue(card.value);
  switch (stepIndex) {
    case 0: {
      const isRed = ['hearts', 'diamonds'].includes(card.suit);
      return (choice === 'red' && isRed) || (choice === 'black' && !isRed);
    }
    case 1: {
      const first = cardNumericValue(allCards[0].value);
      return (choice === 'higher' && val > first) || (choice === 'lower' && val < first) || (choice === 'equal' && val === first);
    }
    case 2: {
      const a = cardNumericValue(allCards[0].value);
      const b = cardNumericValue(allCards[1].value);
      const mn = Math.min(a, b), mx = Math.max(a, b);
      return (choice === 'inside' && val > mn && val < mx) || (choice === 'outside' && (val < mn || val > mx));
    }
    case 3:
      return choice === card.suit;
    default:
      return false;
  }
}
