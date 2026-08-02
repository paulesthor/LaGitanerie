// ── Phase « distribution » (portée depuis game.html) ──────────────────
// Contrôleur SPA : mount(root, api) construit la vue dans `root`, update(game)
// la rafraîchit à chaque snapshot fourni par le routeur de play.html.
import { db } from '/js/firebase-config.js';
import { ref, update, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL, checkPrediction, clearGameSession, cardFaceInner } from '/js/game/utils.js';
import { avatarHTML, isPhotoAvatar } from '/js/game/avatar.js';

// Raccourci de traduction (window.t vient de /js/i18n.js, chargé dans le <head>)
const t = (k, v) => (window.t ? window.t(k, v) : k);

const vibrate = (p) => (window.gitaVibrate ? window.gitaVibrate(p) : navigator.vibrate?.(p));

const VIEW = `
  <div class="screen">
    <header class="app-header">
      <div class="flex items-center gap-8">
        <span class="text-sm text-muted" data-i18n="game.game">Partie</span>
        <span id="header-code" class="font-bold" style="color:var(--gold)">----</span>
      </div>
      <h1 style="font-size:0.95rem" data-i18n="game.phase1">Phase 1 — Distribution</h1>
      <button class="header-btn" id="btn-menu" data-i18n-aria="game.menu" aria-label="Menu"><i class="fas fa-bars"></i></button>
    </header>
    <div class="page-content">
      <div id="turn-banner" class="turn-banner hidden">
        <div class="avatar-wrap" id="turn-avatar">🃏</div>
        <div class="flex-col gap-8" style="flex:1">
          <span id="turn-name" class="font-bold">...</span>
          <span id="turn-sub" class="text-sm" style="opacity:.8" data-i18n="game.theirTurn">C'est son tour</span>
        </div>
      </div>
      <div class="card flex-col gap-12">
        <h3 data-i18n="mem.myCards">Mes cartes</h3>
        <div id="hand-container" class="hand-container"></div>
      </div>
      <div id="action-area"></div>
      <div id="oral-chat" class="oral-chat hidden">
        <div class="oral-chat-head"><i class="fas fa-comments"></i> <span data-i18n="game.history">Historique de la partie</span></div>
        <div id="oral-chat-log" class="oral-chat-log"></div>
      </div>
    </div>
  </div>

  <div id="modal-target" class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h3 class="text-center"><span data-i18n="game.give">Donner</span> <span id="modal-sips">0</span> <span data-i18n="game.sipsTo">gorgée(s) à&nbsp;:</span></h3>
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
      <div class="notif-who" id="reveal-who">Joueur</div>
      <div class="notif-sub" data-i18n="game.revealsCard">révèle sa carte</div>
    </div>
  </div>

  <div id="sips-banner" class="sips-banner">
    <div class="sips-icon" id="sips-banner-icon"><i class="fas fa-beer-mug-empty"></i></div>
    <div class="sips-text" id="sips-banner-text">...</div>
    <div class="sips-amount" id="sips-banner-amount">0</div>
  </div>

  <div id="modal-menu" class="modal-overlay">
    <div class="modal-sheet flex-col gap-12">
      <div class="modal-handle"></div>
      <h3 data-i18n="game.menu">Menu</h3>
      <div id="sidebar-players" class="flex-col gap-8"></div>
      <button id="btn-leave" class="btn btn-danger" style="margin-top:8px">
        <i class="fas fa-door-open"></i> <span data-i18n="game.leave">Quitter la partie</span>
      </button>
    </div>
  </div>`;

export function mount(root, api) {
  const { gameId, playerId } = api;
  root.innerHTML = VIEW;
  window.I18N && window.I18N.apply(root);
  const $ = (id) => root.querySelector('#' + id);
  const gameRef = ref(db, `games/${gameId}`);

  let game = {};
  const isOral = () => game.mode === 'oral';
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

  // Une seule fenêtre du bas à la fois : deux .modal-overlay partagent le même
  // z-index, deux ouvertures simultanées se superposeraient en assombrissant
  // deux fois le fond, sans qu'on sache laquelle se ferme au clic.
  function openModal(id) {
    root.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    const el = $(id); if (el) el.classList.add('show');
  }

  // Menu
  $('btn-menu').onclick = () => openModal('modal-menu');
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
    const isNewEvent = evTs > lastEventTs;
    if (isNewEvent) lastEventTs = evTs;
    game = newGame;
    // Mode Soirée : les gorgées et le résultat vont dans le mini-chat, pas en popup.
    if (isNewEvent) showSipsBanner(game.lastEvent);
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
    $('reveal-who').textContent = playerName;
    $('reveal-mini-card').className = `mini-card ${colorCls}`;
    $('reveal-corner-top').textContent = `${card.value}${sym}`;
    $('reveal-center').textContent = sym;
    $('reveal-corner-bot').textContent = `${card.value}${sym}`;
    notif.classList.add('show');
    clearTimeout(notifTimer);
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
    renderChatLog();
  }

  // ── Mini-chat (mode Soirée) : historique partagé des révélations & gorgées ──
  function renderChatLog() {
    const chat = $('oral-chat');
    if (!chat) return;
    chat.classList.toggle('hidden', !isOral());
    if (!isOral()) return;
    const log = $('oral-chat-log');
    const entries = Object.values(game.eventLog || {})
      .filter(Boolean)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(-40);
    if (!entries.length) {
      log.innerHTML = '<div class="ocl-empty">La partie commence… les gorgées s\'afficheront ici.</div>';
      return;
    }
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.innerHTML = entries.map(chatLineHTML).join('');
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }

  function chatLineHTML(ev) {
    if (ev.type === 'reveal') {
      const sym    = SUIT_SYMBOL[ev.suit] || '';
      const colCls = ['hearts', 'diamonds'].includes(ev.suit) ? 'red' : 'black';
      const tag = ev.correct
        ? `<span class="ocl-tag good">${t('game.hit')}</span>`
        : `<span class="ocl-tag bad">${t('game.missDrinks', { n: ev.sips })}</span>`;
      return `<div class="ocl-line">
        <span class="ocl-card ${colCls}">${ev.value ?? ''}${sym}</span>
        <span class="ocl-body"><strong>${ev.byName || t('game.player')}</strong> ${t('game.reveals')} ${tag}</span>
      </div>`;
    }
    if (ev.type === 'sips_given') {
      const amt = t(ev.amount > 1 ? 'game.sipsN' : 'game.sip1', { n: ev.amount });
      return `<div class="ocl-line">
        <span class="ocl-ic drink"><i class="fas fa-beer-mug-empty"></i></span>
        <span class="ocl-body"><strong>${ev.fromName || t('game.player')}</strong> → <strong>${ev.toName || '?'}</strong> · <span class="ocl-amt">${amt}</span></span>
      </div>`;
    }
    return '';
  }

  function renderTurnBanner() {
    const banner   = $('turn-banner');
    const currentP = game.players?.[game.currentTurn];
    if (!currentP) return;
    banner.classList.remove('hidden');
    $('turn-avatar').innerHTML = avatarHTML(currentP.avatar, 44);
    const isMyTurn_ = game.currentTurn === playerId;
    $('turn-name').textContent = isMyTurn_ ? t('game.yourTurn') : currentP.name;
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
          <div class="face ${isRed ? 'red' : 'black'}">${cardFaceInner(card.value, sym)}</div>
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
      area.innerHTML = `<div class="waiting-msg">✅ ${t('game.allRevealed')}</div>`;
    } else {
      const cur = game.players?.[game.currentTurn];
      area.innerHTML = `<div class="waiting-msg">${t('game.waitingFor')} <strong>${cur?.name || '...'}</strong>...</div>`;
    }
  }

  function renderPrediction(area, stepIdx) {
    const titles   = [t('pred.redBlack'), t('pred.higherLower'), t('pred.insideOutside'), t('pred.whichSuit')];
    const sipsText = t(stepIdx + 1 > 1 ? 'game.sipsN' : 'game.sip1', { n: stepIdx + 1 });
    let btnsHTML = '';
    if (stepIdx === 0) {
      btnsHTML = `
        <button class="pred-btn red-opt" data-pred="red">♥ ${t('pred.red')}</button>
        <button class="pred-btn black-opt" data-pred="black">♠ ${t('pred.black')}</button>`;
    } else if (stepIdx === 1) {
      btnsHTML = `
        <button class="pred-btn higher" data-pred="higher">⬆ ${t('pred.higher')}</button>
        <button class="pred-btn lower" data-pred="lower">⬇ ${t('pred.lower')}</button>`;
    } else if (stepIdx === 2) {
      btnsHTML = `
        <button class="pred-btn inside" data-pred="inside">↔ ${t('pred.inside')}</button>
        <button class="pred-btn outside" data-pred="outside">↕ ${t('pred.outside')}</button>`;
    } else {
      btnsHTML = `
        <button class="pred-btn hearts suit" data-pred="hearts">♥</button>
        <button class="pred-btn diamonds suit" data-pred="diamonds">♦</button>
        <button class="pred-btn clubs suit" data-pred="clubs">♣</button>
        <button class="pred-btn spades suit" data-pred="spades">♠</button>`;
    }
    area.innerHTML = `
      <div class="prediction-area">
        <p class="phase-label">${t('game.cardOf', { n: stepIdx + 1 })} — ${t('game.atStake', { sips: sipsText })}</p>
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
        <span class="font-bold" style="flex:1">${p.name}${id === playerId ? ` (${t('wait.you')})` : ''}</span>
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
    const revealTs = Date.now();
    await update(ref(db, `games/${gameId}`), {
      [`players/${playerId}/cards/${stepIdx}/revealed`]: true,
      lastRevealedCard: { value: card.value, suit: card.suit, playerName: game.players[playerId].name },
      // Journal partagé (mini-chat du mode Soirée) : révélation + résultat.
      [`eventLog/${revealTs}`]: {
        type: 'reveal', byName: game.players[playerId].name,
        value: card.value, suit: card.suit, correct, sips, timestamp: revealTs
      }
    });
    setTimeout(async () => {
      isAnimating = false;
      if (correct) {
        if (!isOral()) showToast(t('game.goodGive', { n: sips }), 'success');
        showTargetModal(sips);
      } else {
        if (!isOral()) showToast(t('game.missDrink', { n: sips }), 'error');
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
    openModal('modal-target');
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
    if (isOral()) return;  // en Soirée, tout passe par le mini-chat
    if (!event || event.type !== 'sips_given') return;
    const banner = $('sips-banner');
    const text   = $('sips-banner-text');
    const amount = $('sips-banner-amount');
    const iconEl = $('sips-banner-icon');
    const isMeFrom = event.fromId === playerId;
    const isMeTo   = event.toId   === playerId;
    let accent = 'spectate', icon = 'fa-arrow-right-arrow-left', msg = '';
    if (isMeFrom)      { accent = 'me-give';  icon = 'fa-hand-holding-droplet'; msg = t('game.youGiveTo', { name: `<strong>${event.toName}</strong>` }); }
    else if (isMeTo)   { accent = 'me-drink'; icon = 'fa-beer-mug-empty';       msg = t('game.givesYou', { name: `<strong>${event.fromName}</strong>` }); }
    else               { accent = 'spectate'; icon = 'fa-arrow-right-arrow-left'; msg = `<strong>${event.fromName}</strong> → <strong>${event.toName}</strong>`; }
    iconEl.innerHTML = `<i class="fas ${icon}"></i>`;
    text.innerHTML = msg;
    amount.textContent = t(event.amount > 1 ? 'game.sipsN' : 'game.sip1', { n: event.amount });
    amount.classList.toggle('red', isMeTo);
    banner.className = `sips-banner ${accent} show`;
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
