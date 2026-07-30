// ── Phase « pyramid » en MODE SOIRÉE (oral) ───────────────────────────
// Le téléphone ne sert qu'à voir la pyramide qui se retourne toute seule et
// tes 4 cartes (face cachée). Tout le reste (donner les gorgées) se fait à
// l'oral. Seule interaction : double-taper une de tes cartes pour la montrer
// (prouver que tu ne mens pas).
//
// L'avancement est piloté par une HORLOGE (oralStartTs + oralInterval), calée
// sur l'heure serveur Firebase : pas de « pilote », tous les téléphones voient
// la même carte au même instant, même si l'écran était verrouillé.
import { db } from '/js/firebase-config.js';
import { ref, update, remove, onValue, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL, getSipsForCard, clearGameSession } from '/js/game/utils.js';
import { avatarHTML } from '/js/game/avatar.js';

const vibrate = (p) => (window.gitaVibrate ? window.gitaVibrate(p) : navigator.vibrate?.(p));
const PAUSE_MS = 2500;   // pause de l'auto-avance quand quelqu'un montre une carte
const REVEAL_MS = 3000;  // durée d'affichage d'une preuve

const VIEW = `
  <div class="oral-screen">
    <button class="oral-leave" id="btn-leave" title="Quitter"><i class="fas fa-door-open"></i></button>
    <div class="oral-code">Partie <span id="oral-code-val" style="color:var(--gold)">----</span></div>

    <div class="oral-stage">
      <div class="oral-timerbar"><div id="oral-timer-fill" class="oral-timerbar-fill"></div></div>
      <div id="oral-py-slot" class="oral-py-slot"></div>
      <div id="oral-sips" class="oral-sips">—</div>
    </div>

    <div class="oral-hand-wrap">
      <p class="oral-hint" id="oral-hint">Tes cartes — double-tape pour montrer</p>
      <div id="oral-hand" class="oral-hand"></div>
    </div>

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
  let serverOffset = 0;
  let tickInterval = null;
  let _maxIdx = 0;
  let _lastRenderIdx = -1;
  let _endWritten = false;
  let _lastRevealTs = 0;
  let _revealTimer = null;
  let _localReveal = { idx: -1, until: 0 };
  let _tapTimes = {};

  // Horloge serveur → tous les téléphones synchronisés
  const offOffset = onValue(ref(db, '.info/serverTimeOffset'), (s) => {
    serverOffset = s.val() || 0;
  });
  const serverNow = () => Date.now() + serverOffset;

  $('btn-leave').onclick = async () => {
    if (!confirm('Quitter la partie ?')) return;
    try { await remove(ref(db, `games/${gameId}/players/${playerId}`)); } catch (e) {}
    clearGameSession();
    window.location.href = '/';
  };

  function currentIndex() {
    const start    = game.oralStartTs || 0;
    const interval = game.oralInterval || 12000;
    const extra    = game.oralExtraMs || 0;
    if (!start) return 0;
    const elapsed = serverNow() - start - extra;
    let idx = Math.floor(elapsed / interval);
    if (idx < 0) idx = 0;
    if (idx < _maxIdx) idx = _maxIdx;   // jamais en arrière (pause = on tient la carte)
    _maxIdx = idx;
    return idx;
  }

  function cardProgress() {
    const start    = game.oralStartTs || 0;
    const interval = game.oralInterval || 12000;
    const extra    = game.oralExtraMs || 0;
    if (!start) return 0;
    const elapsed = serverNow() - start - extra;
    const inCard  = ((elapsed % interval) + interval) % interval;
    return Math.min(1, Math.max(0, inCard / interval));
  }

  function update_(newGame) {
    game = newGame;
    $('oral-code-val').textContent = game.gameCode || '----';

    // Preuve d'un autre joueur → notif + (la pause a déjà été posée par l'auteur)
    const rTs = game.oralReveal?.ts || 0;
    if (rTs > _lastRevealTs) {
      _lastRevealTs = rTs;
      if (game.oralReveal?.pid !== playerId) showRevealNotif(game.oralReveal);
    }

    startTick();
    renderStage(true);
  }

  function startTick() {
    if (tickInterval) return;
    tickInterval = setInterval(() => renderStage(false), 200);
  }

  function renderStage(force) {
    const order = game.pyramidOrder || [];
    const pyramid = game.pyramid || [];
    const idx = currentIndex();

    // Fin de partie : plus de carte à retourner
    if (order.length && idx >= order.length) {
      $('oral-timer-fill').style.width = '0%';
      $('oral-sips').textContent = 'Partie terminée';
      $('oral-sips').className = 'oral-sips done';
      $('oral-py-slot').innerHTML = '<div class="oral-end">🎉<br>Fini !</div>';
      // N'importe quel joueur peut clôturer (idempotent) — évite de rester bloqué
      // si le téléphone-hôte a quitté la table.
      if (!_endWritten) {
        _endWritten = true;
        update(gameRef, { phase: 'end' }).catch(() => { _endWritten = false; });
      }
      return;
    }

    // Barre de temps de la carte courante
    $('oral-timer-fill').style.width = ((1 - cardProgress()) * 100).toFixed(1) + '%';

    if (!force && idx === _lastRenderIdx) { renderHand(); return; }
    _lastRenderIdx = idx;

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
    if (isCulSec) {
      sipsEl.innerHTML = '<i class="fas fa-fire"></i> CUL SEC';
      sipsEl.className = 'oral-sips culsec';
    } else {
      sipsEl.textContent = `${sips} gorgée${sips > 1 ? 's' : ''}`;
      sipsEl.className = 'oral-sips';
    }
    vibrate(15);
    renderHand();
  }

  function renderHand() {
    const el = $('oral-hand');
    const cards = game.players?.[playerId]?.cards || [];
    const now = Date.now();
    const showFace = _localReveal.until > now ? _localReveal.idx : -1;

    // Reconstruire seulement si le nombre de cartes ou l'état révélé change
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

  // Double-tap (tactile + souris) sur une de ses cartes → la montrer à tous
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
    // Affichage local immédiat
    _localReveal = { idx: i, until: Date.now() + REVEAL_MS };
    _lastRenderIdx = -2;  // force re-render de la main
    renderHand();
    setTimeout(() => { renderHand(); }, REVEAL_MS + 50);

    // Pause de l'auto-avance pour laisser tout le monde regarder
    try { await runTransaction(ref(db, `games/${gameId}/oralExtraMs`), (cur) => (cur || 0) + PAUSE_MS); } catch (e) {}
    // Diffusion à tous
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
    clearInterval(tickInterval);
    clearTimeout(_revealTimer);
    try { offOffset(); } catch (e) {}
  }

  return { update: update_, unmount };
}
