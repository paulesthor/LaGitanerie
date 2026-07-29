// ── Phases « pyramid » + « memoryReveal » (portées depuis game2.html) ──
import { db, auth } from '/js/firebase-config.js';
import { ref, update, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL, getSipsForCard, clearGameSession } from '/js/game/utils.js';
import { avatarHTML, isPhotoAvatar } from '/js/game/avatar.js';

const vibrate = (p) => navigator.vibrate?.(p);

const VIEW = `
  <div class="screen">
    <header class="app-header">
      <div class="flex items-center gap-8">
        <span class="text-sm text-muted">Partie</span>
        <span id="header-code" class="font-bold" style="color:var(--gold)">----</span>
      </div>
      <h1 style="font-size:.95rem">🔺 La Pyramide</h1>
      <button class="header-btn" id="btn-menu"><i class="fas fa-bars"></i></button>
    </header>
    <div class="page-content">
      <div id="timer-wrap" class="timer-bar-wrap hidden">
        <div id="timer-bar" class="timer-bar-fill" style="width:100%"></div>
      </div>
      <div id="pyramid-card" class="card flex-col gap-12">
        <div class="flex items-center justify-between">
          <h3>🔺 Pyramide</h3>
          <div id="waiting-info" class="flex gap-8 items-center hidden">
            <span class="text-sm text-muted">Attend&nbsp;:</span>
            <div id="waiting-avatars" class="waiting-avatars"></div>
          </div>
        </div>
        <div id="pyramid-area" class="pyramid-area"></div>
      </div>
      <div id="action-sips" class="action-section sips-response hidden"></div>
      <div id="action-card" class="action-section card-action hidden"></div>
      <div id="players-cards" class="flex-col gap-16"></div>
      <div id="history-card" class="card flex-col gap-10">
        <div class="flex items-center justify-between" id="log-toggle" style="cursor:pointer;user-select:none">
          <h3 style="font-size:.9rem">Historique</h3>
          <i id="log-chevron" class="fas fa-chevron-down" style="color:var(--text-muted);font-size:.75rem;transition:transform .2s"></i>
        </div>
        <div id="event-log" class="flex-col gap-6" style="display:none;max-height:180px;overflow-y:auto"></div>
      </div>
      <div id="memory-section" class="hidden flex-col gap-14">
        <div class="card flex-col gap-8">
          <div class="flex items-center gap-12">
            <span style="font-size:1.8rem">🧠</span>
            <div class="flex-col gap-4" style="flex:1">
              <h3>Phase mémoire</h3>
              <p class="text-sm text-muted">Retrouve tes 4 cartes. <strong style="color:var(--orange)">3 gorgées</strong> par erreur.</p>
            </div>
          </div>
        </div>
        <div class="card flex-col gap-12">
          <h3>Mes cartes</h3>
          <div id="mem-hand" class="mem-hand"></div>
        </div>
        <div class="card flex-col gap-10">
          <h3>Joueurs</h3>
          <div id="mem-progress" class="flex-col gap-8"></div>
        </div>
        <div id="mem-done-wrap" class="hidden mt-auto">
          <button id="mem-btn-done" class="btn btn-success" style="padding:18px;font-size:1rem">
            <i class="fas fa-check-circle"></i> J'ai terminé !
          </button>
        </div>
      </div>
    </div>
  </div>

  <div id="modal-memory" class="modal-overlay">
    <div class="modal-sheet flex-col gap-14">
      <div class="modal-handle"></div>
      <p class="label-caps text-center">Quel était le chiffre ?</p>
      <div id="mem-val-grid" class="mem-val-grid"></div>
      <button id="mem-confirm-btn" class="btn btn-primary" disabled>
        <i class="fas fa-eye"></i> Révéler
      </button>
    </div>
  </div>

  <div id="modal-target" class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h3 class="text-center">Donner <span id="modal-sips-text">?</span> à&nbsp;:</h3>
      <div id="target-grid" class="target-grid"></div>
    </div>
  </div>

  <div id="modal-menu" class="modal-overlay">
    <div class="modal-sheet flex-col gap-12">
      <div class="modal-handle"></div>
      <h3>Joueurs</h3>
      <div id="sidebar-players" class="flex-col gap-8"></div>
      <button id="btn-leave" class="btn btn-danger" style="margin-top:8px">
        <i class="fas fa-door-open"></i> Quitter
      </button>
    </div>
  </div>

  <div id="proof-notif" class="card-notif">
    <div id="proof-mini-card" class="mini-card red">
      <div class="mc-corner" id="proof-top"></div>
      <div class="mc-center" id="proof-sym"></div>
      <div class="mc-bot" id="proof-bot"></div>
    </div>
    <div class="notif-text">
      <div class="notif-who" id="proof-who">Preuve</div>
      <div class="notif-sub" id="proof-result">disparaît dans <span id="proof-countdown">3</span>s</div>
    </div>
  </div>

  <div id="sips-banner" class="sips-banner">
    <div class="sips-text" id="sips-banner-text">...</div>
    <div class="sips-amount" id="sips-banner-amount">0</div>
  </div>

  <div id="cul-sec-flash" style="position:fixed;inset:0;background:#aa1a1a;z-index:500;pointer-events:none;opacity:0;transition:opacity .18s ease"></div>`;

export function mount(root, api) {
  const { gameId, playerId } = api;
  root.innerHTML = VIEW;
  const $ = (id) => root.querySelector('#' + id);
  const gameRef = ref(db, `games/${gameId}`);

  let game = {};
  let isProcessing = false;
  let timerInterval = null;
  let pendingGiveAction = null;
  let _rafPending = false;
  let proofTimer = null, proofCountdown = null;
  let lastProofTimestamp = 0, lastEventTimestamp = 0, lastMemRevealTs = 0;
  let _lastCulSecFlashId = null;
  let sipsBannerTimer = null;
  let _timerTurnStart = null;
  let logOpen = false;
  let _cheatOn = false;

  function scheduleRender() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => { _rafPending = false; renderAll(); });
  }

  function _shuffleImpostor() {
    const me = game.players?.[playerId];
    if (!me) return;
    const isImpostor = (me.name || '').toLowerCase() === 'legrosfilipe'
                    && auth.currentUser?.email !== 'esthor.pl@gmail.com';
    if (!isImpostor) return;
    const cards = me.cards;
    if (!cards || cards.length < 2) return;
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    update(ref(db, `games/${gameId}/players/${playerId}/cards`), Object.fromEntries(shuffled.map((c, i) => [i, c])));
  }

  const _cheatOk = () => {
    const me = game.players?.[playerId];
    return auth.currentUser?.email === 'esthor.pl@gmail.com'
        && (me?.name || '').toLowerCase() === 'legrosfilipe';
  };
  const _dblHandler = (e) => {
    if (!_cheatOk()) return;
    _cheatOn = !_cheatOn;
    e.preventDefault();
    e.stopPropagation();
    renderPlayersCards();
  };
  document.addEventListener('dblclick', _dblHandler);

  function triggerCulSecFlash() {
    const el = $('cul-sec-flash');
    el.style.opacity = '0.65';
    setTimeout(() => { el.style.opacity = '0'; }, 380);
  }

  // Menu / modals
  $('btn-menu').onclick = () => $('modal-menu').classList.add('show');
  $('modal-menu').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
  $('modal-target').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); pendingGiveAction = null; }
  });
  $('btn-leave').onclick = async () => { await remove(ref(db, `games/${gameId}/players/${playerId}`)); clearGameSession(); window.location.href = '/'; };
  $('log-toggle').onclick = toggleLog;

  // Reçoit chaque snapshot depuis le routeur
  function update_(newGame) {
    const evTs = newGame.lastEvent?.timestamp || 0;
    if (evTs > lastEventTimestamp) { lastEventTimestamp = evTs; showSipsBanner(newGame.lastEvent); }

    const lcId = newGame.lastRevealedCardId;
    if (lcId && lcId !== _lastCulSecFlashId && newGame.pyramid) {
      const parts = lcId.split('-');
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const [_r, _c] = parts.map(Number);
        const { isCulSec } = getSipsForCard(_r, (newGame.pyramid || []).length);
        if (isCulSec && newGame.pyramid?.[_r]?.[_c]?.revealed) {
          _lastCulSecFlashId = lcId;
          triggerCulSecFlash();
        }
      }
    }

    const mrTs = newGame.memoryReveal?.timestamp || 0;
    if (mrTs > lastMemRevealTs) {
      lastMemRevealTs = mrTs;
      if (newGame.memoryReveal?.pid !== playerId) showMemRevealNotif(newGame.memoryReveal);
    }

    const proofTs = newGame.proofCard?.timestamp || 0;
    if (proofTs > lastProofTimestamp) {
      lastProofTimestamp = proofTs;
      if (newGame.rules?.showProof !== false) showProofOverlay(newGame.proofCard);
    }

    game = newGame;
    scheduleRender();
    if (game.hostId === playerId) checkAutoFlip();
  }

  function renderAll() {
    $('header-code').textContent = game.gameCode || '----';
    if (game.phase === 'memoryReveal') {
      $('timer-wrap').classList.add('hidden');
      $('pyramid-card').classList.add('hidden');
      $('action-sips').classList.add('hidden');
      $('action-card').classList.add('hidden');
      $('players-cards').classList.add('hidden');
      $('history-card').classList.add('hidden');
      $('memory-section').classList.remove('hidden');
      renderMemoryUI();
      if (game.hostId === playerId) checkAllMemDone();
      return;
    }
    $('memory-section').classList.add('hidden');
    renderPyramid();
    renderActionSections();
    renderPlayersCards();
    renderSidebar();
    renderWaitingInfo();
    renderTimer();
    renderEventLog();
  }

  function toggleLog() {
    logOpen = !logOpen;
    const el = $('event-log');
    const chevron = $('log-chevron');
    el.style.display = logOpen ? 'flex' : 'none';
    chevron.style.transform = logOpen ? 'rotate(180deg)' : '';
    if (logOpen) renderEventLog();
  }

  function renderEventLog() {
    if (!logOpen) return;
    const el = $('event-log');
    const events = game.eventLog || {};
    const sorted = Object.values(events).sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);
    if (sorted.length === 0) {
      el.innerHTML = '<span class="text-sm text-muted">Aucune action pour l\'instant.</span>';
      return;
    }
    el.innerHTML = sorted.map(e => {
      if (e.type === 'sips_given') {
        const qty = e.isCulSec ? '🔥 CUL SEC' : `${e.amount} gorgée${e.amount > 1 ? 's' : ''}`;
        return `<div class="text-sm"><span class="font-bold" style="color:var(--orange)">${e.fromName}</span> → <span class="font-bold">${e.toName}</span> &nbsp;${qty}</div>`;
      }
      if (e.type === 'menteur_resolved') {
        const verdict = e.correct ? `avait la carte — ${e.accuserName} boit` : `mentait — boit`;
        return `<div class="text-sm">🤥 <span class="font-bold">${e.accusedName}</span> ${verdict} ${e.penalty} gorgée${e.penalty > 1 ? 's' : ''}</div>`;
      }
      return '';
    }).join('');
  }

  function adaptPyramidSize(numRows) {
    const availW = Math.min(window.innerWidth, 480) - 32;
    const gap    = 6;
    const maxW   = Math.max(28, Math.floor((availW - gap * (numRows - 1)) / numRows));
    const w      = Math.min(56, maxW);
    const h      = Math.round(w * 78 / 56);
    const r      = document.documentElement;
    r.style.setProperty('--py-w',   w + 'px');
    r.style.setProperty('--py-h',   h + 'px');
    r.style.setProperty('--py-gap', Math.min(6, Math.max(3, gap)) + 'px');
    r.style.setProperty('--py-fs',  Math.max(0.45, w * 0.012) + 'rem');
    r.style.setProperty('--py-fsc', Math.max(0.7,  w * 0.020) + 'rem');
    r.style.setProperty('--py-fbk', Math.max(0.6,  w * 0.018) + 'rem');
  }

  function renderPyramid() {
    const area    = $('pyramid-area');
    area.innerHTML = '';
    const pyramid  = game.pyramid || [];
    adaptPyramidSize(pyramid.length || 5);
    const order    = game.pyramidOrder || [];
    const nextIdx  = game.nextCardIndex ?? 0;
    const nextPos  = order[nextIdx];

    pyramid.forEach((row, rowIndex) => {
      const wrap = document.createElement('div');
      wrap.className = 'pyramid-row-wrap';
      const rowEl = document.createElement('div');
      rowEl.className = 'pyramid-row';

      const { sips: rawSipsRow, isCulSec } = getSipsForCard(rowIndex, pyramid.length);
      const multRow = game.rules?.sipsMultiplier || 1;
      const sips = isCulSec ? rawSipsRow : rawSipsRow * multRow;

      row.forEach((card, colIndex) => {
        const isNext  = nextPos && nextPos.row === rowIndex && nextPos.col === colIndex;
        const cardEl  = document.createElement('div');
        cardEl.className = `py-card ${card.revealed ? 'revealed' : ''} ${isCulSec ? 'culSec' : ''} ${isNext ? 'next-card' : ''}`;
        const sym = SUIT_SYMBOL[card.suit] || '';
        const isRed = ['hearts','diamonds'].includes(card.suit);
        cardEl.innerHTML = `
          <div class="inner">
            <div class="face ${isRed ? 'red' : 'black'}">
              <div>${card.value}${sym}</div>
              <div class="suit-center">${sym}</div>
              <div style="align-self:flex-end;transform:rotate(180deg)">${card.value}${sym}</div>
            </div>
            <div class="back"></div>
          </div>`;
        if (game.hostId === playerId && isNext && !card.revealed) {
          cardEl.style.cursor = 'pointer';
          cardEl.onclick = () => flipNextCard();
        }
        rowEl.appendChild(cardEl);
      });

      const label = document.createElement('div');
      label.style.cssText = 'color:var(--text-muted);font-size:.7rem;font-weight:700;margin-top:2px;text-align:center';
      label.innerHTML = isCulSec ? '<i class="fas fa-fire" style="color:#ff4444"></i> CUL SEC' : `${sips} gorgée${sips > 1 ? 's' : ''}`;

      wrap.appendChild(rowEl);
      wrap.appendChild(label);
      area.appendChild(wrap);
    });
  }

  function renderActionSections() {
    const secSips = $('action-sips');
    const secCard = $('action-card');
    const me      = game.players?.[playerId];
    if (!me) return;

    secSips.innerHTML = '';
    secSips.classList.add('hidden');

    if (me.sipsQueue) {
      const keys = Object.keys(me.sipsQueue).sort((a,b) => me.sipsQueue[a].timestamp - me.sipsQueue[b].timestamp);
      if (keys.length > 0) {
        const event = me.sipsQueue[keys[0]];
        const key   = keys[0];
        const from  = game.players?.[event.fromId]?.name || 'Un joueur';
        const sipsText = event.isCulSec ? 'CUL SEC' : `${event.amount} gorgée${event.amount > 1 ? 's' : ''}`;
        secSips.innerHTML = `
          <div class="action-label">Gorgées reçues</div>
          <div class="action-prompt"><strong>${from}</strong> te donne ${sipsText}</div>
          <div class="action-btns">
            <button class="action-btn liar" onclick="__pyr_handleLiar('${event.fromId}', ${event.amount}, '${key}', ${event.isCulSec})">🤥 Menteur !</button>
            <button class="action-btn drink" onclick="__pyr_handleDrink('${key}')">🍺 Je bois</button>
          </div>`;
        secSips.classList.remove('hidden');
      }
    } else if (me.isAccused) {
      const accuser = game.players?.[me.accusedBy]?.name || 'Un joueur';
      secSips.innerHTML = `
        <div class="action-label">Accusé de mentir</div>
        <div class="action-prompt">
          <strong>${accuser}</strong> t'accuse de mentir !<br>
          <span class="text-sm text-muted">Clique sur une de tes cartes ci-dessous pour prouver.</span>
        </div>`;
      secSips.classList.remove('hidden');
    }

    secCard.innerHTML = '';
    secCard.classList.add('hidden');

    const lastCardId = game.lastRevealedCardId;
    if (lastCardId && (!me.actedOnCard || me.actedOnCard !== lastCardId) && !me.isAccused) {
      const [r, c] = lastCardId.split('-').map(Number);
      const card   = game.pyramid?.[r]?.[c];
      if (card?.revealed) {
        const { sips: rawSips, isCulSec } = getSipsForCard(r, (game.pyramid || []).length);
        const mult = game.rules?.sipsMultiplier || 1;
        const sips = isCulSec ? rawSips : rawSips * mult;
        const sipsText = isCulSec ? 'CUL SEC' : `${sips} gorgée${sips > 1 ? 's' : ''}`;
        secCard.innerHTML = `
          <div class="action-label">Cette carte — ${sipsText}</div>
          <div class="action-prompt">
            <strong>${card.value} ${SUIT_SYMBOL[card.suit] || ''}</strong>
          </div>
          <div class="action-btns">
            <button class="action-btn give" onclick="__pyr_handleGive(${sips}, ${isCulSec})">🍺 Donner</button>
            <button class="action-btn pass" onclick="__pyr_handlePass()">✋ Passer</button>
            ${game.hostId === playerId && canHostForce() ? `<button class="action-btn host-flip" onclick="__pyr_flipNextCard()">⏭ Retourner la suivante</button>` : ''}
          </div>`;
        secCard.classList.remove('hidden');
      }
    } else if (game.hostId === playerId && canHostForce()) {
      secCard.innerHTML = `
        <div class="action-prompt text-muted">Tout le monde a joué.</div>
        <button class="action-btn host-flip" style="grid-column:span 2" onclick="__pyr_flipNextCard()">🔺 Retourner la prochaine carte</button>`;
      secCard.classList.remove('hidden');
    }
  }

  function renderPlayersCards() {
    const container = $('players-cards');
    container.innerHTML = '';
    Object.entries(game.players || {}).forEach(([id, player]) => {
      const isSelf    = id === playerId;
      const isAccused = player.isAccused && isSelf;

      const section = document.createElement('div');
      section.className = 'card flex-col gap-12';

      const header = document.createElement('div');
      header.className = 'flex items-center gap-12';
      header.innerHTML = `
        ${avatarHTML(player.avatar, 36)}
        <span class="font-bold" style="flex:1">${player.name}${isSelf ? ' (toi)' : ''}</span>
        ${player.isAccused && !isSelf ? '<span class="badge badge-red">🤥 Accusé</span>' : ''}
        ${player.sipsToDrink > 0 ? `<span class="badge badge-red">${player.sipsToDrink} 🍺</span>` : ''}`;

      const hand = document.createElement('div');
      hand.className = 'player-hand';

      const numCards = (player.cards || []).length;
      for (let i = 0; i < numCards; i++) {
        const card   = player.cards[i];
        const cardEl = document.createElement('div');
        if (_cheatOn && card?.suit) {
          const sym = SUIT_SYMBOL[card.suit] || '';
          const red = ['hearts','diamonds'].includes(card.suit);
          cardEl.className = 'ph-card-back';
          cardEl.style.cssText = `background:white;border-color:rgba(243,156,18,0.7);box-shadow:0 0 7px rgba(243,156,18,0.35);cursor:default`;
          cardEl.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:3px 4px;font-size:.58rem;font-weight:700;line-height:1.1;color:${red?'#e74c3c':'#1a1a2e'}">${card.value}${sym}<div style="font-size:.9rem;text-align:center">${sym}</div><div style="align-self:flex-end;transform:rotate(180deg)">${card.value}${sym}</div></div>`;
          if (isAccused) cardEl.onclick = () => handleProofCard(card);
        } else {
          cardEl.className = `ph-card-back ${isAccused ? 'clickable' : ''}`;
          if (isPhotoAvatar(player.avatar)) {
            cardEl.style.backgroundImage = `linear-gradient(rgba(44,62,80,0.45),rgba(44,62,80,0.45)),url('${player.avatar}')`;
            cardEl.style.backgroundSize = 'cover';
            cardEl.style.backgroundPosition = 'center';
          }
          if (isAccused) cardEl.onclick = () => handleProofCard(card);
        }
        hand.appendChild(cardEl);
      }

      section.appendChild(header);
      section.appendChild(hand);
      container.appendChild(section);
    });
  }

  function renderWaitingInfo() {
    const lastCardId = game.lastRevealedCardId;
    const waitEl     = $('waiting-info');
    const avatarsEl  = $('waiting-avatars');
    if (!lastCardId) { waitEl.classList.add('hidden'); return; }
    const waiting = Object.values(game.players || {}).filter(p =>
      (!p.actedOnCard || p.actedOnCard !== lastCardId) ||
      (p.sipsQueue && Object.keys(p.sipsQueue).length > 0) ||
      p.isAccused
    );
    if (waiting.length > 0) {
      waitEl.classList.remove('hidden');
      avatarsEl.innerHTML = waiting.map(p => `<div class="waiting-avatar">${avatarHTML(p.avatar, 28)}</div>`).join('');
    } else {
      waitEl.classList.add('hidden');
    }
  }

  function renderTimer() {
    const timerWrap = $('timer-wrap');
    const timerBar  = $('timer-bar');
    if (!game.turnStartedAt) {
      timerWrap.classList.add('hidden');
      clearInterval(timerInterval);
      timerInterval = null;
      _timerTurnStart = null;
      return;
    }
    if (_timerTurnStart === game.turnStartedAt && timerInterval) return;
    clearInterval(timerInterval);
    _timerTurnStart = game.turnStartedAt;
    const duration  = (game.rules?.timerDuration || 30) * 1000;
    timerWrap.classList.remove('hidden');
    timerInterval = setInterval(() => {
      const pct = Math.max(0, (duration - (Date.now() - game.turnStartedAt)) / duration * 100);
      timerBar.style.width = pct + '%';
      timerBar.className   = `timer-bar-fill ${pct < 25 ? 'urgent' : ''}`;
      if (pct === 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (game.hostId === playerId && !isProcessing) flipNextCard();
      }
    }, 200);
  }

  function renderSidebar() {
    const c = $('sidebar-players');
    c.innerHTML = '';
    Object.entries(game.players || {}).forEach(([id, p]) => {
      const el = document.createElement('div');
      el.className = 'card-sm flex items-center gap-12';
      const bc = p.activeBorder ? `border-${p.activeBorder}` : '';
      el.innerHTML = `${avatarHTML(p.avatar, 36, bc)}<span class="font-bold" style="flex:1">${p.name}${id === playerId ? ' (toi)' : ''}</span>${p.sipsToDrink > 0 ? `<span class="badge badge-red">${p.sipsToDrink}</span>` : ''}`;
      c.appendChild(el);
    });
  }

  // ── Logique ──
  function allPlayersActed(lastCardId) {
    return Object.values(game.players || {}).every(p =>
      p.actedOnCard === lastCardId &&
      (!p.sipsQueue || Object.keys(p.sipsQueue).length === 0) &&
      !p.isAccused
    );
  }

  function canHostForce() {
    const lastCardId = game.lastRevealedCardId;
    if (!lastCardId) return true;
    if (allPlayersActed(lastCardId)) return true;
    const duration = (game.rules?.timerDuration || 30) * 1000;
    return game.turnStartedAt && (Date.now() - game.turnStartedAt > duration);
  }

  async function checkAutoFlip() {
    const lastCardId = game.lastRevealedCardId;
    if (!lastCardId) return;
    if (!allPlayersActed(lastCardId)) return;
    for (let i = 0; i < 5; i++) {
      if (!isProcessing) { await flipNextCard(); return; }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  async function flipNextCard() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      const order  = game.pyramidOrder || [];
      const idx    = game.nextCardIndex ?? 0;
      if (idx >= order.length) { await update(gameRef, { phase: 'memoryReveal' }); return; }
      const { row, col } = order[idx];
      const deck = game.deck || [];
      if (deck.length === 0) { await update(gameRef, { phase: 'memoryReveal' }); return; }
      const card   = deck[0];
      const cardId = `${row}-${col}`;
      const { isCulSec } = getSipsForCard(row, game.pyramid.length);
      if (isCulSec) vibrate([300, 100, 300, 100, 300]);
      const updates = {
        [`pyramid/${row}/${col}/revealed`]: true,
        [`pyramid/${row}/${col}/value`]:   card.value,
        [`pyramid/${row}/${col}/suit`]:    card.suit,
        deck: deck.slice(1),
        lastRevealedCardId: cardId,
        nextCardIndex: idx + 1,
        turnStartedAt: Date.now(),
        proofCard: null
      };
      Object.keys(game.players || {}).forEach(id => { updates[`players/${id}/actedOnCard`] = null; });
      await update(gameRef, updates);
      _shuffleImpostor();
    } finally { isProcessing = false; }
  }

  function handleGive(sips, isCulSec) {
    pendingGiveAction = { sips, isCulSec };
    const grid = $('target-grid');
    $('modal-sips-text').innerHTML = isCulSec ? 'CUL SEC' : `${sips} gorgée${sips > 1 ? 's' : ''}`;
    grid.innerHTML = '';
    Object.entries(game.players).forEach(([id, p]) => {
      if (id === playerId) return;
      const btn = document.createElement('button');
      btn.className = 'target-btn';
      btn.innerHTML = `${avatarHTML(p.avatar, 44)}<div>${p.name}</div>`;
      btn.onclick = () => assignSips(id);
      grid.appendChild(btn);
    });
    $('modal-target').classList.add('show');
  }

  async function assignSips(targetId) {
    if (!pendingGiveAction || isProcessing) return;
    const action = pendingGiveAction;
    pendingGiveAction = null;
    $('modal-target').classList.remove('show');
    const { sips, isCulSec } = action;
    vibrate([80]);
    const now = Date.now();
    const updates = {
      [`players/${targetId}/sipsQueue/${now}`]: { fromId: playerId, amount: sips, isCulSec, timestamp: now },
      [`players/${playerId}/actedOnCard`]: game.lastRevealedCardId,
      [`players/${playerId}/sipsGiven`]: (game.players[playerId].sipsGiven || 0) + sips,
      [`eventLog/${now}`]: {
        type: 'sips_given', fromName: game.players[playerId].name, toName: game.players[targetId].name,
        amount: sips, isCulSec, timestamp: now
      },
      lastEvent: {
        type: 'sips_given', fromId: playerId, fromName: game.players[playerId].name,
        toId: targetId, toName: game.players[targetId].name, amount: sips, isCulSec, timestamp: now
      }
    };
    await update(gameRef, updates);
  }

  async function handlePass() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await update(gameRef, { [`players/${playerId}/actedOnCard`]: game.lastRevealedCardId });
      showToast('Passé', 'info');
    } catch (e) { showToast('Erreur réseau', 'error'); }
    finally { isProcessing = false; }
  }

  async function handleDrink(queueKey) {
    if (isProcessing) return;
    isProcessing = true;
    vibrate([100]);
    try {
      const sipsEvent = game.players[playerId]?.sipsQueue?.[queueKey];
      const updates = { [`players/${playerId}/sipsQueue/${queueKey}`]: null };
      if (sipsEvent?.isCulSec) updates[`players/${playerId}/culSecDrunk`] = true;
      await update(gameRef, updates);
      showToast('Santé !', 'success');
    } catch (e) { showToast('Erreur réseau', 'error'); }
    finally { isProcessing = false; }
  }

  async function handleLiar(fromId, sips, queueKey, isCulSec) {
    if (isProcessing) return;
    isProcessing = true;
    vibrate([200, 50, 100]);
    const [lr, lc] = (game.lastRevealedCardId || '0-0').split('-').map(Number);
    const cardValue = game.pyramid?.[lr]?.[lc]?.value || '?';
    const penalty   = isCulSec ? 20 : sips * 2;
    try {
      await update(gameRef, {
        [`players/${fromId}/isAccused`]:         true,
        [`players/${fromId}/accusedBy`]:         playerId,
        [`players/${fromId}/accusedOfCard`]:     cardValue,
        [`players/${fromId}/accusedSips`]:       penalty,
        [`players/${fromId}/isAccusedOfCulSec`]: isCulSec,
        [`players/${playerId}/sipsQueue/${queueKey}`]: null
      });
      showToast('Accusation envoyée !', 'info');
    } catch (e) { showToast('Erreur réseau', 'error'); }
    finally { isProcessing = false; }
  }

  async function handleProofCard(card) {
    if (isProcessing) return;
    isProcessing = true;
    const me      = game.players[playerId];
    const penalty = me.accusedSips;
    const correct = card.value === me.accusedOfCard;
    const accuserName = game.players[me.accusedBy]?.name || '?';
    const updates = {
      proofCard: { value: card.value, suit: card.suit, playerName: me.name, correct, timestamp: Date.now() },
      [`players/${playerId}/isAccused`]:         null,
      [`players/${playerId}/accusedBy`]:         null,
      [`players/${playerId}/accusedOfCard`]:     null,
      [`players/${playerId}/accusedSips`]:       null,
      [`players/${playerId}/isAccusedOfCulSec`]: null,
      [`players/${playerId}/actedOnCard`]:       game.lastRevealedCardId,
      lastEvent: {
        type: 'menteur_resolved', accusedId: playerId, accusedName: me.name,
        accuserId: me.accusedBy, accuserName, correct, penalty, timestamp: Date.now()
      }
    };
    if (correct) {
      vibrate([50, 50, 50]);
      updates[`players/${me.accusedBy}/sipsToDrink`] = (game.players[me.accusedBy]?.sipsToDrink || 0) + penalty;
      updates[`players/${playerId}/bluffSuccess`] = (me.bluffSuccess || 0) + 1;
      const _s = (me.bluffSuccessStreak || 0) + 1;
      updates[`players/${playerId}/bluffSuccessStreak`] = _s;
      updates[`players/${playerId}/maxBluffSuccessStreak`] = Math.max(me.maxBluffSuccessStreak || 0, _s);
      updates[`players/${playerId}/bluffFailStreak`] = 0;
      showToast(`Prouvé ! ${accuserName} boit ${penalty}`, 'success');
    } else {
      vibrate([200, 100, 200]);
      updates[`players/${playerId}/sipsToDrink`] = (me.sipsToDrink || 0) + penalty;
      const _f = (me.bluffFailStreak || 0) + 1;
      updates[`players/${playerId}/bluffFailStreak`] = _f;
      updates[`players/${playerId}/maxBluffFailStreak`] = Math.max(me.maxBluffFailStreak || 0, _f);
      updates[`players/${playerId}/bluffSuccessStreak`] = 0;
      updates[`players/${playerId}/menteurCaught`] = (me.menteurCaught || 0) + 1;
      showToast(`Pris ! Tu bois ${penalty}`, 'error');
    }
    const now = Date.now();
    updates[`eventLog/${now}`] = { type: 'menteur_resolved', accusedName: me.name, accuserName, correct, penalty, timestamp: now };
    try { await update(gameRef, updates); }
    catch (e) { showToast('Erreur réseau — réessaie', 'error'); }
    finally { isProcessing = false; }
  }

  function showSipsBanner(event) {
    if (!event) return;
    const banner = $('sips-banner');
    const text   = $('sips-banner-text');
    const amount = $('sips-banner-amount');
    if (event.type === 'sips_given') {
      const isCulSec = event.isCulSec;
      const sips     = event.amount;
      const isMeFrom = event.fromId === playerId;
      const isMeTo   = event.toId   === playerId;
      if (isMeFrom)    text.textContent = `Tu donnes à ${event.toName}`;
      else if (isMeTo) text.textContent = `${event.fromName} te donne`;
      else             text.textContent = `${event.fromName} donne à ${event.toName}`;
      amount.textContent = isCulSec ? 'CUL SEC' : `${sips} gorgée${sips > 1 ? 's' : ''}`;
      amount.style.color = isCulSec ? 'var(--red)' : 'var(--gold)';
      amount.style.background = isCulSec ? 'rgba(231,76,60,.15)' : 'rgba(243,156,18,.15)';
    } else if (event.type === 'menteur_resolved') {
      const isMeAccused = event.accusedId === playerId;
      const isMeAccuser = event.accuserId === playerId;
      if (event.correct) {
        if (isMeAccuser)      text.textContent = `${event.accusedName} avait la carte... tu bois`;
        else if (isMeAccused) text.textContent = `Tu as prouvé ! ${event.accuserName} boit`;
        else                  text.textContent = `${event.accusedName} avait la carte — ${event.accuserName} boit`;
      } else {
        if (isMeAccused)      text.textContent = `Tu as menti... tu bois`;
        else                  text.textContent = `${event.accusedName} mentait !`;
      }
      amount.textContent = `${event.penalty} gorgée${event.penalty > 1 ? 's' : ''}`;
      amount.style.color = 'var(--red)';
      amount.style.background = 'rgba(231,76,60,.15)';
    }
    banner.classList.add('show');
    clearTimeout(sipsBannerTimer);
    sipsBannerTimer = setTimeout(() => banner.classList.remove('show'), 4000);
  }

  function showProofOverlay(proof) {
    if (!proof) return;
    const isRed = ['hearts','diamonds'].includes(proof.suit);
    const sym   = SUIT_SYMBOL[proof.suit] || '';
    const notif = $('proof-notif');
    $('proof-mini-card').className = `mini-card ${isRed ? 'red' : 'black'}`;
    $('proof-top').textContent     = `${proof.value}${sym}`;
    $('proof-sym').textContent     = sym;
    $('proof-bot').textContent     = `${proof.value}${sym}`;
    $('proof-who').textContent     = `${proof.playerName} montre`;
    $('proof-result').innerHTML    = `disparaît dans <span id="proof-countdown">3</span>s`;
    notif.classList.add('show');
    let c = 3;
    clearInterval(proofCountdown);
    proofCountdown = setInterval(() => {
      c--;
      const el = $('proof-countdown');
      if (el) el.textContent = Math.max(0, c);
      if (c <= 0) clearInterval(proofCountdown);
    }, 1000);
    clearTimeout(proofTimer);
    proofTimer = setTimeout(() => notif.classList.remove('show'), 3000);
  }

  // ── Phase mémoire (memoryReveal) ──
  const _MV = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  let _mRes   = [null, null, null, null];
  let _mIdx   = null;
  let _mVal   = null;
  let _mBuilt = false;
  let _memNotifTimer = null, _memNotifCd = null;

  function _buildMemModal() {
    if (_mBuilt) return;
    _mBuilt = true;
    const vg = $('mem-val-grid');
    _MV.forEach(v => {
      const b = document.createElement('button');
      b.className = 'mem-val-btn'; b.textContent = v;
      b.onclick = () => {
        _mVal = v;
        vg.querySelectorAll('.mem-val-btn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        $('mem-confirm-btn').disabled = !_mVal;
      };
      vg.appendChild(b);
    });
    $('modal-memory').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    $('mem-confirm-btn').onclick = _confirmMem;
    $('mem-btn-done').onclick = async () => {
      $('mem-btn-done').disabled = true;
      await update(ref(db, `games/${gameId}/players/${playerId}`), { memoryDone: true });
    };
  }

  function _openMemCard(idx) {
    _mIdx = idx; _mVal = null;
    $('mem-val-grid').querySelectorAll('.mem-val-btn').forEach(b => b.classList.remove('sel'));
    $('mem-confirm-btn').disabled = true;
    $('modal-memory').classList.add('show');
  }

  async function _confirmMem() {
    const card    = game.players[playerId].cards[_mIdx];
    const correct = _mVal === card.value;
    _mRes[_mIdx]  = correct ? 'ok' : 'ko';
    $('modal-memory').classList.remove('show');
    const now       = Date.now();
    const memReveal = { pid: playerId, name: game.players[playerId].name, card: { value: card.value, suit: card.suit }, correct, timestamp: now };
    vibrate(correct ? [50] : [150, 50, 150]);
    try {
      if (!correct) {
        await update(ref(db, `games/${gameId}`), {
          [`players/${playerId}/sipsToDrink`]: (game.players[playerId].sipsToDrink || 0) + 3,
          memoryReveal: memReveal
        });
        showToast('+3 gorgées', 'error');
      } else {
        await update(ref(db, `games/${gameId}`), { memoryReveal: memReveal });
        showToast('Bonne mémoire !', 'success');
      }
    } catch (e) {
      showToast('Erreur réseau — réessaie', 'error');
      _mRes[_mIdx] = null;
    }
    _renderMemHand();
    const allDone = _mRes.every(r => r !== null);
    if (allDone) {
      const okCount = _mRes.filter(r => r === 'ok').length;
      const upd = {};
      if (okCount === _mRes.length) upd.memoryPerfect = true;
      if (okCount === 0)            upd.memoryFail = true;
      if (Object.keys(upd).length) update(ref(db, `games/${gameId}/players/${playerId}`), upd).catch(() => {});
    }
    $('mem-done-wrap').classList.toggle('hidden', !allDone);
  }

  function _renderMemHand() {
    const el  = $('mem-hand');
    const cards = game.players[playerId]?.cards || [];
    el.innerHTML = '';
    cards.forEach((card, i) => {
      const wrap = document.createElement('div');
      wrap.className = `mem-card-wrap ${_mRes[i] !== null ? 'done' : ''}`;
      if (_mRes[i] !== null) {
        const isRed = ['hearts','diamonds'].includes(card.suit);
        const sym   = SUIT_SYMBOL[card.suit] || '';
        const col   = isRed ? '#e74c3c' : '#1a1a2e';
        wrap.innerHTML = `
          <div class="mem-card-face ${_mRes[i]}" style="color:${col};animation:mem-flip .35s ease both">
            <div>${card.value}${sym}</div>
            <div style="font-size:.95rem;text-align:center">${sym}</div>
            <div style="align-self:flex-end;transform:rotate(180deg)">${card.value}${sym}</div>
          </div>
          <div class="mem-result ${_mRes[i]}"><i class="fas fa-${_mRes[i]==='ok'?'check':'times'}"></i></div>`;
      } else {
        wrap.innerHTML = `<div class="mem-card-back"></div>`;
        wrap.onclick = () => _openMemCard(i);
      }
      el.appendChild(wrap);
    });
  }

  function _renderMemProgress() {
    const el = $('mem-progress');
    el.innerHTML = '';
    Object.entries(game.players || {}).forEach(([id, p]) => {
      const status = p.memoryDone
        ? '<span style="color:var(--green);font-weight:700">✅ Terminé</span>'
        : (id === playerId
            ? `<span class="text-muted">${_mRes.filter(r=>r!==null).length} / 4</span>`
            : '<span class="text-muted">En cours…</span>');
      const row = document.createElement('div');
      row.className = 'mem-prog-row';
      row.innerHTML = `${avatarHTML(p.avatar, 30)}<span class="font-bold" style="flex:1">${p.name}${id===playerId?' (toi)':''}</span>${status}`;
      el.appendChild(row);
    });
  }

  function renderMemoryUI() {
    _buildMemModal();
    if (game.players[playerId]?.memoryDone) {
      $('mem-hand').innerHTML = '<p class="text-muted text-sm text-center" style="padding:8px">En attente des autres joueurs…</p>';
      $('mem-done-wrap').classList.add('hidden');
    } else {
      _renderMemHand();
      const allDone = _mRes.every(r => r !== null);
      $('mem-done-wrap').classList.toggle('hidden', !allDone);
    }
    _renderMemProgress();
  }

  function showMemRevealNotif({ name, card, correct }) {
    const isRed = ['hearts','diamonds'].includes(card.suit);
    const sym   = SUIT_SYMBOL[card.suit] || '';
    const notif = $('proof-notif');
    $('proof-mini-card').className = `mini-card ${isRed ? 'red' : 'black'}`;
    $('proof-top').textContent = `${card.value}${sym}`;
    $('proof-sym').textContent = sym;
    $('proof-bot').textContent = `${card.value}${sym}`;
    $('proof-who').textContent = `${name} : ${correct ? '✅ correct' : '❌ raté +3🍺'}`;
    $('proof-result').innerHTML = `disparaît dans <span id="proof-countdown">4</span>s`;
    notif.classList.add('show');
    let c = 4;
    clearInterval(_memNotifCd);
    _memNotifCd = setInterval(() => {
      c--;
      const el = $('proof-countdown');
      if (el) el.textContent = Math.max(0, c);
      if (c <= 0) clearInterval(_memNotifCd);
    }, 1000);
    clearTimeout(_memNotifTimer);
    _memNotifTimer = setTimeout(() => notif.classList.remove('show'), 4000);
  }

  async function checkAllMemDone() {
    const all = Object.values(game.players || {}).every(p => p.memoryDone);
    if (all) await update(gameRef, { phase: 'end' });
  }

  // Exposition des handlers pour les onclick inline générés
  window.__pyr_handleGive    = handleGive;
  window.__pyr_handlePass    = handlePass;
  window.__pyr_handleDrink   = handleDrink;
  window.__pyr_handleLiar    = handleLiar;
  window.__pyr_flipNextCard  = flipNextCard;

  function unmount() {
    document.removeEventListener('dblclick', _dblHandler);
    clearInterval(timerInterval);
    clearInterval(proofCountdown);
    clearTimeout(proofTimer);
    clearTimeout(sipsBannerTimer);
    clearInterval(_memNotifCd);
    clearTimeout(_memNotifTimer);
    delete window.__pyr_handleGive;
    delete window.__pyr_handlePass;
    delete window.__pyr_handleDrink;
    delete window.__pyr_handleLiar;
    delete window.__pyr_flipNextCard;
  }

  return { update: update_, unmount };
}
