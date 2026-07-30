// ── Phase « pyramid » en MODE SOIRÉE (oral) ───────────────────────────
// Le téléphone ne sert qu'à voir la pyramide et tes 4 cartes (face cachée).
// C'est l'HÔTE qui retourne chaque carte (pas de timer imposé). Tout le reste
// (donner les gorgées) se fait à l'oral. Seule interaction pour les joueurs :
// double-taper une de tes cartes pour la montrer (prouver que tu ne mens pas).
import { db } from '/js/firebase-config.js';
import { ref, update, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL, getSipsForCard, clearGameSession } from '/js/game/utils.js';

const vibrate = (p) => (window.gitaVibrate ? window.gitaVibrate(p) : navigator.vibrate?.(p));
const REVEAL_MS = 2500;  // durée d'affichage d'une preuve (secondes) puis re-cachée

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

    <div id="oral-reveal" class="oral-reveal">
      <div id="oral-reveal-card" class="mini-card red">
        <div class="mc-corner" id="orv-top"></div>
        <div class="mc-center" id="orv-sym"></div>
        <div class="mc-bot" id="orv-bot"></div>
      </div>
      <div class="notif-text">
        <div class="notif-who" id="orv-who">—</div>
        <div class="notif-sub">montre sa carte</div>
      </div>
    </div>
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
  let _lastRevealTs = 0;
  let _revealTimer = null;
  let _hideTimer = null;
  let _localReveal = { idx: -1, until: 0 };
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

    const rTs = game.oralReveal?.ts || 0;
    if (rTs > _lastRevealTs) {
      _lastRevealTs = rTs;
      if (game.oralReveal?.pid !== playerId) showRevealNotif(game.oralReveal);
    }

    renderStage();
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
      await update(gameRef, { oralIndex: idx, oralReveal: null });
    } catch (e) { showToast('Erreur réseau', 'error'); }
    finally { _flipping = false; }
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

    if (idx === _lastRenderIdx) { renderHand(); return; }
    _lastRenderIdx = idx;

    // Aucune carte encore retournée
    if (idx < 0) {
      $('oral-py-slot').innerHTML = '<div class="oral-placeholder"><i class="fas fa-layer-group"></i></div>';
      $('oral-sips').textContent = 'Prêt ?';
      $('oral-sips').className = 'oral-sips';
      renderHand();
      return;
    }

    const pos  = order[idx] || { row: 0, col: 0 };
    const card = pyramid[pos.row]?.[pos.col] || {};
    const { sips, isCulSec } = getSipsForCard(pos.row, pyramid.length || 5);
    const sym   = SUIT_SYMBOL[card.suit] || '';
    const isRed = ['hearts', 'diamonds'].includes(card.suit);

    $('oral-py-slot').innerHTML = `
      <div class="oral-py-card ${isRed ? 'red' : 'black'} ${isCulSec ? 'culsec' : ''}" key="${idx}">
        <div class="opc-corner">${card.value || ''}${sym}</div>
        <div class="opc-center">${sym}</div>
        <div class="opc-corner bot">${card.value || ''}${sym}</div>
      </div>`;

    const sipsEl = $('oral-sips');
    if (isCulSec) { sipsEl.innerHTML = '<i class="fas fa-fire"></i> CUL SEC'; sipsEl.className = 'oral-sips culsec'; }
    else { sipsEl.textContent = `${sips} gorgée${sips > 1 ? 's' : ''}`; sipsEl.className = 'oral-sips'; }
    vibrate(15);
    renderHand();
  }

  function renderHand() {
    const el = $('oral-hand');
    const cards = game.players?.[playerId]?.cards || [];
    const now = Date.now();
    const showFace = _localReveal.until > now ? _localReveal.idx : -1;
    const sig = cards.length + '|' + showFace;
    if (el._sig === sig) return;
    el._sig = sig;

    el.innerHTML = '';
    cards.forEach((card, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'oral-card';
      if (i === showFace) {
        const sym   = SUIT_SYMBOL[card.suit] || '';
        const isRed = ['hearts', 'diamonds'].includes(card.suit);
        wrap.classList.add('flipped');
        wrap.innerHTML = `
          <div class="oral-card-face ${isRed ? 'red' : 'black'}">
            <div class="occ-corner">${card.value}${sym}</div>
            <div class="occ-center">${sym}</div>
            <div class="occ-corner bot">${card.value}${sym}</div>
          </div>`;
      } else {
        wrap.innerHTML = '<div class="oral-card-back"></div>';
      }
      wrap.onclick = () => onCardTap(i);
      el.appendChild(wrap);
    });
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
    _localReveal = { idx: i, until: Date.now() + REVEAL_MS };
    el_forceHand();
    // Re-cacher après quelques secondes (remise à zéro explicite → déterministe)
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => { _localReveal = { idx: -1, until: 0 }; el_forceHand(); }, REVEAL_MS);
    try {
      await update(gameRef, {
        oralReveal: {
          pid: playerId,
          name: game.players?.[playerId]?.name || 'Joueur',
          value: card.value, suit: card.suit, ts: Date.now(),
        },
      });
    } catch (e) { showToast('Erreur réseau', 'error'); }
  }

  function el_forceHand() {
    const el = $('oral-hand');
    if (el) el._sig = null;
    renderHand();
  }

  function showRevealNotif(rev) {
    if (!rev) return;
    const sym   = SUIT_SYMBOL[rev.suit] || '';
    const isRed = ['hearts', 'diamonds'].includes(rev.suit);
    $('oral-reveal-card').className = `mini-card ${isRed ? 'red' : 'black'}`;
    $('orv-top').textContent = `${rev.value}${sym}`;
    $('orv-sym').textContent = sym;
    $('orv-bot').textContent = `${rev.value}${sym}`;
    $('orv-who').textContent = rev.name || 'Un joueur';
    $('oral-reveal').classList.add('show');
    vibrate(30);
    clearTimeout(_revealTimer);
    _revealTimer = setTimeout(() => $('oral-reveal').classList.remove('show'), REVEAL_MS);
  }

  function unmount() {
    clearTimeout(_revealTimer);
    clearTimeout(_hideTimer);
  }

  return { update: update_, unmount };
}
