// ── Phase « pyramid » en MODE SOIRÉE (oral) ───────────────────────────
// Le téléphone ne sert qu'à voir la pyramide et tes 4 cartes (face cachée).
// C'est l'HÔTE qui retourne chaque carte (pas de timer imposé). Tout le reste
// (donner les gorgées) se fait à l'oral. Seule interaction pour les joueurs :
// double-taper une de tes cartes pour la montrer (prouver que tu ne mens pas).
import { db } from '/js/firebase-config.js';
import { ref, update, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL, getSipsForCard, clearGameSession } from '/js/game/utils.js';
import { isPhotoAvatar } from '/js/game/avatar.js';

const vibrate = (p) => (window.gitaVibrate ? window.gitaVibrate(p) : navigator.vibrate?.(p));
const REVEAL_MS = 2500;  // durée d'affichage (carte montrée + notif) puis re-cachée

const VIEW = `
  <div class="oral-screen">
    <button class="oral-leave" id="btn-leave" title="Quitter"><i class="fas fa-door-open"></i></button>
    <div class="oral-code">Partie <span id="oral-code-val" style="color:var(--gold)">----</span></div>

    <div class="oral-stage">
      <div id="oral-progress" class="oral-progress">—</div>
      <div id="oral-py-slot" class="oral-py-slot"></div>
      <div id="oral-sips" class="oral-sips">—</div>
    </div>

    <div class="oral-hand-wrap">
      <p class="oral-hint" id="oral-hint">Tes cartes — double-tape pour montrer</p>
      <div id="oral-hand" class="oral-hand"></div>
    </div>

    <div id="oral-host-bar" class="oral-host-bar hidden">
      <button id="btn-flip" class="btn btn-primary" style="font-size:1.05rem;padding:16px">
        <i class="fas fa-hand-pointer"></i> <span id="btn-flip-label">Retourner la carte</span>
      </button>
    </div>
    <p id="oral-wait" class="oral-wait hidden">En attente que l'hôte retourne la carte…</p>

    <div id="oral-reveal-stack" class="oral-reveal-stack"></div>
  </div>`;

export function mount(root, api) {
  const { gameId, playerId, isHost } = api;
  root.innerHTML = VIEW;
  const $ = (id) => root.querySelector('#' + id);
  const gameRef = ref(db, `games/${gameId}`);

  let game = {};
  let _lastRenderIdx = -99;
  let _flipping = false;
  let _endWritten = false;
  let _seenReveals = {};   // ts déjà affiché par joueur (gère les reveals simultanés)
  let _hideTimer = null;
  let _tapTimes = {};

  $('btn-leave').onclick = async () => {
    if (!confirm('Quitter la partie ?')) return;
    try { await remove(ref(db, `games/${gameId}/players/${playerId}`)); } catch (e) {}
    clearGameSession();
    window.location.href = '/';
  };

  $('btn-flip').onclick = flipNext;

  function update_(newGame) {
    game = newGame;
    $('oral-code-val').textContent = game.gameCode || '----';

    // Style de cartes choisi par l'hôte
    const screen = root.querySelector('.oral-screen');
    if (screen) screen.className = 'oral-screen cs-' + (game.rules?.cardStyle || 'classic');

    syncReveals();
    renderStage();
  }

  // ── Reveals concurrents : chaque joueur écrit dans oralReveals/{pid}. On
  // affiche une notif empilée pour chaque nouveau reveal (sauf le sien). ──
  function syncReveals() {
    const map = game.oralReveals || {};
    const pids = Object.keys(map);
    if (!pids.length) { _seenReveals = {}; return; }
    pids.forEach((pid) => {
      if (pid === playerId) return;
      const rev = map[pid];
      const ts = rev?.ts || 0;
      if (ts > (_seenReveals[pid] || 0)) {
        _seenReveals[pid] = ts;
        pushRevealNotif(rev);
      }
    });
  }

  function pushRevealNotif(rev) {
    const stack = $('oral-reveal-stack');
    if (!stack || !rev) return;
    const sym   = SUIT_SYMBOL[rev.suit] || '';
    const isRed = ['hearts', 'diamonds'].includes(rev.suit);
    const chip = document.createElement('div');
    chip.className = 'oral-reveal-chip';
    chip.innerHTML = `
      <div class="orv-mini ${isRed ? 'red' : 'black'}">${rev.value || ''}${sym}</div>
      <div class="orv-txt">
        <div class="orv-who">${rev.name || 'Un joueur'}</div>
        <div class="orv-sub">montre sa carte</div>
      </div>`;
    stack.appendChild(chip);
    vibrate(30);
    setTimeout(() => {
      chip.classList.add('out');
      setTimeout(() => chip.remove(), 300);
    }, REVEAL_MS);
  }

  async function flipNext() {
    if (_flipping) return;
    _flipping = true;
    vibrate(20);
    try {
      const order = game.pyramidOrder || [];
      const idx   = (game.oralIndex ?? -1) + 1;
      if (idx >= order.length) {
        if (!_endWritten) { _endWritten = true; await update(gameRef, { phase: 'end' }); }
        return;
      }
      // Nouvelle carte → on efface les preuves de la carte précédente.
      await update(gameRef, { oralIndex: idx, oralReveals: null });
    } catch (e) { showToast('Erreur réseau', 'error'); }
    finally { _flipping = false; }
  }

  // Avatar d'un joueur aléatoire au centre de la carte de la pyramide (option règles)
  function photoMarkup(pid) {
    const av = game.players?.[pid]?.avatar || '🃏';
    if (isPhotoAvatar(av)) return `<span class="oc-photo"><img src="${av}" alt=""></span>`;
    return `<span class="oc-photo emoji">${av}</span>`;
  }

  function renderStage() {
    const order   = game.pyramidOrder || [];
    const pyramid = game.pyramid || [];
    const idx     = game.oralIndex ?? -1;
    const total   = order.length;

    // Barre hôte / message d'attente
    const isLast = idx >= total - 1;
    if (isHost) {
      $('oral-host-bar').classList.remove('hidden');
      $('btn-flip-label').textContent = idx < 0 ? 'Retourner la première carte'
        : (isLast ? 'Terminer la partie' : 'Carte suivante');
    } else {
      $('oral-wait').classList.toggle('hidden', idx >= 0);
    }

    $('oral-progress').textContent = idx < 0 ? `0 / ${total}` : `${Math.min(idx + 1, total)} / ${total}`;

    if (idx === _lastRenderIdx) { buildHand(); return; }
    _lastRenderIdx = idx;

    // Aucune carte encore retournée
    if (idx < 0) {
      $('oral-py-slot').innerHTML = '<div class="oral-placeholder"><i class="fas fa-layer-group"></i></div>';
      $('oral-sips').textContent = 'Prêt ?';
      $('oral-sips').className = 'oral-sips';
      buildHand();
      return;
    }

    const pos  = order[idx] || { row: 0, col: 0 };
    const card = pyramid[pos.row]?.[pos.col] || {};
    const { sips, isCulSec } = getSipsForCard(pos.row, pyramid.length || 5);
    const sym   = SUIT_SYMBOL[card.suit] || '';
    const isRed = ['hearts', 'diamonds'].includes(card.suit);
    const photo = card.photoOwner ? photoMarkup(card.photoOwner) : '';

    $('oral-py-slot').innerHTML = `
      <div class="oral-py-card ${isRed ? 'red' : 'black'} ${isCulSec ? 'culsec' : ''}" key="${idx}">
        <span class="opc-idx tl"><span class="r">${card.value || ''}</span><span class="s">${sym}</span></span>
        ${photo || `<span class="opc-pip">${sym}</span>`}
        <span class="opc-idx br"><span class="r">${card.value || ''}</span><span class="s">${sym}</span></span>
      </div>`;

    const sipsEl = $('oral-sips');
    if (isCulSec) { sipsEl.innerHTML = '<i class="fas fa-fire"></i> CUL SEC'; sipsEl.className = 'oral-sips culsec'; }
    else { sipsEl.textContent = `${sips} gorgée${sips > 1 ? 's' : ''}`; sipsEl.className = 'oral-sips'; }
    vibrate(15);
    buildHand();
  }

  // Construit les 4 cartes une seule fois (recto = dos, verso = valeur).
  // Montrer/cacher = simple bascule de la classe .flipped → masquage garanti.
  function buildHand() {
    const el = $('oral-hand');
    const cards = game.players?.[playerId]?.cards || [];
    if (el._built === cards.length) return;
    el._built = cards.length;
    el.innerHTML = '';
    cards.forEach((card, i) => {
      const sym   = SUIT_SYMBOL[card.suit] || '';
      const isRed = ['hearts', 'diamonds'].includes(card.suit);
      const wrap = document.createElement('div');
      wrap.className = 'oral-card';
      wrap.dataset.idx = i;
      wrap.innerHTML = `
        <div class="oc-inner">
          <div class="oc-back"></div>
          <div class="oc-face ${isRed ? 'red' : 'black'}">
            <span class="occ-idx tl"><span class="r">${card.value}</span><span class="s">${sym}</span></span>
            <span class="occ-pip">${sym}</span>
            <span class="occ-idx br"><span class="r">${card.value}</span><span class="s">${sym}</span></span>
          </div>
        </div>`;
      wrap.onclick = () => onCardTap(i);
      el.appendChild(wrap);
    });
  }

  function hideAllCards() {
    root.querySelectorAll('.oral-card.flipped').forEach((c) => c.classList.remove('flipped'));
  }

  function onCardTap(i) {
    const now = Date.now();
    const last = _tapTimes[i] || 0;
    _tapTimes[i] = now;
    if (now - last < 350) { _tapTimes[i] = 0; revealMyCard(i); }
  }

  async function revealMyCard(i) {
    const card = game.players?.[playerId]?.cards?.[i];
    if (!card) return;
    vibrate([40, 40, 40]);
    hideAllCards();
    const el = root.querySelector(`.oral-card[data-idx="${i}"]`);
    if (el) el.classList.add('flipped');
    // Re-cacher automatiquement après quelques secondes
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hideAllCards, REVEAL_MS);
    try {
      await update(ref(db, `games/${gameId}/oralReveals/${playerId}`), {
        name: game.players?.[playerId]?.name || 'Joueur',
        value: card.value, suit: card.suit, ts: Date.now(),
      });
    } catch (e) { showToast('Erreur réseau', 'error'); }
  }

  function unmount() {
    clearTimeout(_hideTimer);
  }

  return { update: update_, unmount };
}
