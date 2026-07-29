// ── Phase « distribution » (portée depuis game.html) ──────────────────
// Contrôleur SPA : mount(root, api) construit la vue dans `root`, update(game)
// la rafraîchit à chaque snapshot fourni par le routeur de play.html.
import { db } from '/js/firebase-config.js';
import { ref, update, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL, checkPrediction, clearGameSession } from '/js/game/utils.js';
import { avatarHTML, isPhotoAvatar } from '/js/game/avatar.js';

const vibrate = (p) => navigator.vibrate?.(p);

const VIEW = `
  <div class="screen">
    <header class="app-header">
      <div class="flex items-center gap-8">
        <span class="text-sm text-muted">Partie</span>
        <span id="header-code" class="font-bold" style="color:var(--gold)">----</span>
      </div>
      <h1 style="font-size:0.95rem">Phase 1 — Distribution</h1>
      <button class="header-btn" id="btn-menu"><i class="fas fa-bars"></i></button>
    </header>
    <div class="page-content">
      <div id="turn-banner" class="turn-banner hidden">
        <div class="avatar-wrap" id="turn-avatar">🃏</div>
        <div class="flex-col gap-8" style="flex:1">
          <span id="turn-name" class="font-bold">...</span>
          <span id="turn-sub" class="text-sm" style="opacity:.8">C'est son tour</span>
        </div>
      </div>
      <div class="card flex-col gap-12">
        <h3>Mes cartes</h3>
        <div id="hand-container" class="hand-container"></div>
      </div>
      <div id="action-area"></div>
    </div>
  </div>

  <div id="modal-target" class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h3 class="text-center">Donner <span id="modal-sips">0</span> gorgée(s) à&nbsp;:</h3>
      <div id="target-grid" class="target-grid"></div>
    </div>
  </div>

  <div id="reveal-notif" class="card-notif">
    <div id="reveal-mini-card" class="mini-card red">
      <div class="mc-corner" id="reveal-corner-top"></div>
      <div class="mc-center" id="reveal-center"></div>
      <div class="mc-bot" id="reveal-corner-bot"></div>
    </div>
    <div class="notif-text">
      <div class="notif-who" id="reveal-who">Joueur révèle</div>
      <div class="notif-sub">disparaît dans <span id="reveal-countdown">3</span>s</div>
    </div>
  </div>

  <div id="sips-banner" class="sips-banner">
    <div class="sips-text" id="sips-banner-text">...</div>
    <div class="sips-amount" id="sips-banner-amount">0</div>
  </div>

  <div id="modal-menu" class="modal-overlay">
    <div class="modal-sheet flex-col gap-12">
      <div class="modal-handle"></div>
      <h3>Menu</h3>
      <div id="sidebar-players" class="flex-col gap-8"></div>
      <button id="btn-leave" class="btn btn-danger" style="margin-top:8px">
        <i class="fas fa-door-open"></i> Quitter la partie
      </button>
    </div>
  </div>`;

export function mount(root, api) {
  const { gameId, playerId } = api;
  root.innerHTML = VIEW;
  const $ = (id) => root.querySelector('#' + id);
  const gameRef = ref(db, `games/${gameId}`);

  let game = {};
  let isProcessing = false;
  let isAnimating  = false;
  let _rafPending  = false;
  let lastEventTs = 0;
  let sipsBannerTimer = null;
  let lastRevealedCardKey = null;
  let notifTimer = null;
  let notifCountdown = null;

  function scheduleRender() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => { _rafPending = false; renderUI(); });
  }

  // Menu
  $('btn-menu').onclick = () => $('modal-menu').classList.add('show');
  $('modal-menu').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });
  $('btn-leave').onclick = async () => {
    await remove(ref(db, `games/${gameId}/players/${playerId}`));
    clearGameSession();
    window.location.href = '/';
  };
  $('modal-target').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });

  // Reçoit chaque snapshot depuis le routeur
  function update_(newGame) {
    detectCardReveal(game, newGame);
    const evTs = newGame.lastEvent?.timestamp || 0;
    if (evTs > lastEventTs) { lastEventTs = evTs; showSipsBanner(newGame.lastEvent); }
    game = newGame;
    scheduleRender();
  }

  function detectCardReveal(oldGame, newGame) {
    if (!oldGame.players) return;
    if (newGame.rules?.showPhase1 === false) return;
    for (const [pid, player] of Object.entries(newGame.players || {})) {
      if (pid === playerId) continue;
      const oldCards = oldGame.players?.[pid]?.cards || [];
      const newCards = player.cards || [];
      for (let i = 0; i < newCards.length; i++) {
        if (newCards[i].revealed && !oldCards[i]?.revealed) {
          const revealKey = `${pid}-${i}`;
          if (revealKey !== lastRevealedCardKey) {
            lastRevealedCardKey = revealKey;
            showRevealOverlay(newCards[i], player.name);
          }
        }
      }
    }
  }

  function showRevealOverlay(card, playerName) {
    const notif    = $('reveal-notif');
    const colorCls = ['hearts','diamonds'].includes(card.suit) ? 'red' : 'black';
    const sym      = SUIT_SYMBOL[card.suit];
    $('reveal-who').textContent = `${playerName} révèle`;
    $('reveal-mini-card').className = `mini-card ${colorCls}`;
    $('reveal-corner-top').textContent = `${card.value}${sym}`;
    $('reveal-center').textContent = sym;
    $('reveal-corner-bot').textContent = `${card.value}${sym}`;
    notif.classList.add('show');
    let countdown = 3;
    $('reveal-countdown').textContent = countdown;
    clearInterval(notifCountdown);
    clearTimeout(notifTimer);
    notifCountdown = setInterval(() => {
      countdown--;
      $('reveal-countdown').textContent = Math.max(0, countdown);
      if (countdown <= 0) clearInterval(notifCountdown);
    }, 1000);
    notifTimer = setTimeout(() => {
      notif.classList.remove('show');
      lastRevealedCardKey = null;
    }, 3000);
  }

  function renderUI() {
    $('header-code').textContent = game.gameCode || '----';
    renderTurnBanner();
    renderMyCards();
    renderActionArea();
    renderSidebarPlayers();
  }

  function renderTurnBanner() {
    const banner   = $('turn-banner');
    const currentP = game.players?.[game.currentTurn];
    if (!currentP) return;
    banner.classList.remove('hidden');
    $('turn-avatar').innerHTML = avatarHTML(currentP.avatar, 44);
    const isMyTurn_ = game.currentTurn === playerId;
    $('turn-name').textContent = isMyTurn_ ? 'Ton tour !' : currentP.name;
    $('turn-sub').style.display = isMyTurn_ ? 'none' : '';
    banner.style.background = isMyTurn_ ? 'var(--red)' : 'var(--bg-surface)';
    banner.classList.toggle('mine', isMyTurn_);
  }

  function renderMyCards() {
    const container = $('hand-container');
    const myCards   = game.players?.[playerId]?.cards || [];
    container.innerHTML = '';
    myCards.forEach((card) => {
      const el     = document.createElement('div');
      el.className = `p-card ${card.revealed ? 'revealed' : ''}`;
      const isRed  = ['hearts','diamonds'].includes(card.suit);
      const sym    = SUIT_SYMBOL[card.suit] || '';
      const myAvatar = game.players?.[playerId]?.avatar || '';
      const backStyle = isPhotoAvatar(myAvatar)
        ? `style="background-image:linear-gradient(rgba(44,62,80,0.45),rgba(44,62,80,0.45)),url('${myAvatar}');background-size:cover;background-position:center"`
        : '';
      el.innerHTML = `
        <div class="inner">
          <div class="face ${isRed ? 'red' : 'black'}">
            <div class="card-corner">${card.value}<br>${sym}</div>
            <div class="card-suit-center">${sym}</div>
            <div class="card-corner bot">${card.value}<br>${sym}</div>
          </div>
          <div class="back" ${backStyle}></div>
        </div>`;
      container.appendChild(el);
    });
  }

  function renderActionArea() {
    const area = $('action-area');
    if (isAnimating) { area.innerHTML = ''; return; }
    const isMyTurn = game.currentTurn === playerId;
    const myCards  = game.players?.[playerId]?.cards || [];
    const nextIdx  = myCards.findIndex(c => !c.revealed);
    if (isMyTurn && nextIdx !== -1) {
      renderPrediction(area, nextIdx, myCards);
    } else if (isMyTurn && nextIdx === -1) {
      area.innerHTML = `<div class="waiting-msg">✅ Tu as révélé toutes tes cartes !</div>`;
    } else {
      const cur = game.players?.[game.currentTurn];
      area.innerHTML = `<div class="waiting-msg">En attente de <strong>${cur?.name || '...'}</strong>...</div>`;
    }
  }

  function renderPrediction(area, stepIdx) {
    const titles   = ['Rouge ou Noir ?', 'Plus ou Moins ?', 'Intérieur ou Extérieur ?', 'Quelle famille ?'];
    const sipsText = `${stepIdx + 1} gorgée${stepIdx + 1 > 1 ? 's' : ''}`;
    let btnsHTML = '';
    if (stepIdx === 0) {
      btnsHTML = `
        <button class="pred-btn red-opt" data-pred="red">♥ Rouge</button>
        <button class="pred-btn black-opt" data-pred="black">♠ Noir</button>`;
    } else if (stepIdx === 1) {
      btnsHTML = `
        <button class="pred-btn higher" data-pred="higher">⬆ Plus</button>
        <button class="pred-btn lower" data-pred="lower">⬇ Moins</button>`;
    } else if (stepIdx === 2) {
      btnsHTML = `
        <button class="pred-btn inside" data-pred="inside">↔ Intérieur</button>
        <button class="pred-btn outside" data-pred="outside">↕ Extérieur</button>`;
    } else {
      btnsHTML = `
        <button class="pred-btn hearts suit" data-pred="hearts">♥</button>
        <button class="pred-btn diamonds suit" data-pred="diamonds">♦</button>
        <button class="pred-btn clubs suit" data-pred="clubs">♣</button>
        <button class="pred-btn spades suit" data-pred="spades">♠</button>`;
    }
    area.innerHTML = `
      <div class="prediction-area">
        <p class="phase-label">Carte ${stepIdx + 1} / 4 — ${sipsText} en jeu</p>
        <div class="prediction-title">${titles[stepIdx]}</div>
        <div class="prediction-btns">${btnsHTML}</div>
      </div>`;
    area.querySelectorAll('.pred-btn').forEach(b => {
      b.addEventListener('click', () => predict(b.dataset.pred));
    });
  }

  function renderSidebarPlayers() {
    const container = $('sidebar-players');
    container.innerHTML = '';
    Object.entries(game.players || {}).forEach(([id, p]) => {
      const revealed = (p.cards || []).filter(c => c.revealed).length;
      const el = document.createElement('div');
      el.className = 'player-row flex items-center gap-12 card-sm';
      el.innerHTML = `
        ${avatarHTML(p.avatar, 36)}
        <span class="font-bold" style="flex:1">${p.name}${id === playerId ? ' (toi)' : ''}</span>
        <span class="badge badge-muted">${revealed}/4</span>`;
      container.appendChild(el);
    });
  }

  async function predict(choice) {
    if (isProcessing) return;
    isProcessing = true;
    isAnimating  = true;
    const myCards = game.players[playerId].cards;
    const stepIdx = myCards.findIndex(c => !c.revealed);
    const card    = myCards[stepIdx];
    const correct = checkPrediction(choice, card, stepIdx, myCards);
    const sips    = stepIdx + 1;
    vibrate(correct ? [50] : [150, 50, 150]);
    await update(ref(db, `games/${gameId}`), {
      [`players/${playerId}/cards/${stepIdx}/revealed`]: true,
      lastRevealedCard: { value: card.value, suit: card.suit, playerName: game.players[playerId].name }
    });
    setTimeout(async () => {
      isAnimating = false;
      if (correct) {
        showToast(`Bonne réponse — donne ${sips} gorgée(s)`, 'success');
        showTargetModal(sips);
      } else {
        showToast(`Raté — tu bois ${sips} gorgée(s)`, 'error');
        const current = game.players[playerId].sipsToDrink || 0;
        await passTurn({ [`players/${playerId}/sipsToDrink`]: current + sips });
      }
      isProcessing = false;
    }, 550);
  }

  function showTargetModal(sips) {
    const grid = $('target-grid');
    $('modal-sips').textContent = sips;
    grid.innerHTML = '';
    Object.entries(game.players).forEach(([id, p]) => {
      if (id === playerId) return;
      const btn = document.createElement('button');
      btn.className = 'target-btn';
      btn.innerHTML = `${avatarHTML(p.avatar, 44)}<div>${p.name}</div>`;
      btn.onclick = () => assignSips(id, sips);
      grid.appendChild(btn);
    });
    $('modal-target').classList.add('show');
  }

  async function assignSips(targetId, sips) {
    $('modal-target').classList.remove('show');
    vibrate([80]);
    const current = game.players[targetId].sipsToDrink || 0;
    const now = Date.now();
    await passTurn({
      [`players/${targetId}/sipsToDrink`]: current + sips,
      [`eventLog/${now}`]: {
        type: 'sips_given', fromName: game.players[playerId].name, toName: game.players[targetId].name,
        amount: sips, isCulSec: false, timestamp: now
      },
      lastEvent: {
        type: 'sips_given', fromId: playerId, fromName: game.players[playerId].name,
        toId: targetId, toName: game.players[targetId].name, amount: sips, isCulSec: false, timestamp: now
      }
    });
  }

  function showSipsBanner(event) {
    if (!event) return;
    const banner = $('sips-banner');
    const text   = $('sips-banner-text');
    const amount = $('sips-banner-amount');
    const isMeFrom = event.fromId === playerId;
    const isMeTo   = event.toId   === playerId;
    if (event.type === 'sips_given') {
      if (isMeFrom)      text.textContent = `Tu donnes à ${event.toName}`;
      else if (isMeTo)   text.textContent = `${event.fromName} te donne`;
      else               text.textContent = `${event.fromName} donne à ${event.toName}`;
      amount.textContent = `${event.amount} gorgée${event.amount > 1 ? 's' : ''}`;
      amount.style.color = 'var(--gold)';
      amount.style.background = 'rgba(243,156,18,.15)';
    }
    banner.classList.add('show');
    clearTimeout(sipsBannerTimer);
    sipsBannerTimer = setTimeout(() => banner.classList.remove('show'), 3500);
  }

  async function passTurn(extra = {}) {
    const ids      = Object.keys(game.players).sort();
    const myCards  = game.players[playerId].cards;
    const allDone  = myCards.every(c => c.revealed);
    if (allDone) {
      const everyoneDone = Object.values(game.players).every(p => (p.cards || []).every(c => c.revealed));
      if (everyoneDone) {
        await update(ref(db, `games/${gameId}`), { ...extra, phase: 'memorize', memorizeStartedAt: Date.now() });
        return;
      }
    }
    const currentIdx = ids.indexOf(game.currentTurn);
    let nextIdx = (currentIdx + 1) % ids.length;
    let tries = 0;
    while (game.players[ids[nextIdx]].cards?.every(c => c.revealed) && tries < ids.length) {
      nextIdx = (nextIdx + 1) % ids.length; tries++;
    }
    await update(ref(db, `games/${gameId}`), { ...extra, currentTurn: ids[nextIdx] });
  }

  function unmount() {
    clearInterval(notifCountdown);
    clearTimeout(notifTimer);
    clearTimeout(sipsBannerTimer);
  }

  return { update: update_, unmount };
}
