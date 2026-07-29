// ── Phase « memorize » (portée depuis memorize.html) ──────────────────
import { db } from '/js/firebase-config.js';
import { ref, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { showToast, SUIT_SYMBOL } from '/js/game/utils.js';
import { avatarHTML } from '/js/game/avatar.js';

const TIMER_DURATION = 60;

const VIEW = `
  <div class="screen">
    <header class="app-header">
      <div style="width:36px"></div>
      <div class="header-brand"><i class="fas fa-guitar" style="color:var(--red);margin-right:6px;font-size:.9rem"></i>La <span class="brand-accent">Gitanerie</span></div>
      <div style="width:36px"></div>
    </header>
    <div class="page-content">
      <div class="card flex items-center gap-16">
        <div class="timer-circle-wrap">
          <div class="timer-circle">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle class="timer-circle-bg" cx="40" cy="40" r="35"/>
              <circle id="timer-arc" class="timer-circle-fill" cx="40" cy="40" r="35"/>
            </svg>
            <div class="timer-number" id="timer-number">60</div>
          </div>
        </div>
        <div class="flex-col gap-8" style="flex:1">
          <p class="font-bold">La pyramide démarre dans&nbsp;:</p>
          <p class="text-sm text-muted">Mémorise bien tes 4 cartes, tu ne pourras plus les voir pendant la pyramide.</p>
        </div>
      </div>
      <div class="card flex-col gap-14">
        <h3>Mes cartes</h3>
        <div id="cards-row" class="cards-row"></div>
      </div>
      <div class="card flex-col gap-12">
        <h3>Joueurs</h3>
        <div id="players-ready" class="players-ready"></div>
      </div>
      <div class="mt-auto">
        <button id="btn-ready" class="btn btn-primary" style="font-size:1.1rem;padding:18px">
          <i class="fas fa-check"></i> Je suis prêt !
        </button>
      </div>
    </div>
  </div>`;

export function mount(root, api) {
  const { gameId, playerId, isHost } = api;
  root.innerHTML = VIEW;
  const $ = (id) => root.querySelector('#' + id);
  const gameRef = ref(db, `games/${gameId}`);

  let game = {};
  let timerInterval = null;
  let isReady = false;

  function update_(newGame) {
    game = newGame;
    renderCards();
    renderPlayersReady();
    startTimer();
    checkAllReady();
  }

  function renderCards() {
    const container = $('cards-row');
    const myCards   = game.players?.[playerId]?.cards || [];
    container.innerHTML = '';
    myCards.forEach(card => {
      const isRed = ['hearts','diamonds'].includes(card.suit);
      const sym   = SUIT_SYMBOL[card.suit] || '';
      const el    = document.createElement('div');
      el.className = `mem-card ${isRed ? 'red' : 'black'}`;
      el.innerHTML = `
        <div class="corner">${card.value}${sym}</div>
        <div class="center">${sym}</div>
        <div class="corner bot">${card.value}${sym}</div>`;
      container.appendChild(el);
    });
  }

  function renderPlayersReady() {
    const container = $('players-ready');
    container.innerHTML = '';
    Object.entries(game.players || {}).forEach(([id, p]) => {
      const el = document.createElement('div');
      el.className = 'ready-row';
      el.innerHTML = `
        ${avatarHTML(p.avatar, 36)}
        <span class="font-bold" style="flex:1">${p.name}${id === playerId ? ' (toi)' : ''}</span>
        <div class="ready-indicator ${p.memorizeReady ? 'ready' : ''}"></div>
        <span class="text-sm text-muted">${p.memorizeReady ? 'Prêt' : 'En attente'}</span>`;
      container.appendChild(el);
    });
  }

  function startTimer() {
    if (timerInterval) return;
    const startedAt = game.memorizeStartedAt || Date.now();
    const arc       = $('timer-arc');
    const numEl     = $('timer-number');
    const circumference = 220;
    timerInterval = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, TIMER_DURATION - elapsed);
      const pct       = remaining / TIMER_DURATION;
      numEl.textContent = remaining;
      arc.style.strokeDashoffset = circumference * (1 - pct);
      arc.classList.toggle('urgent', remaining <= 10);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        if (isHost) launchPyramid();
      }
    }, 1000);
  }

  function checkAllReady() {
    const players  = Object.values(game.players || {});
    const allReady = players.length > 0 && players.every(p => p.memorizeReady);
    if (allReady && isHost) launchPyramid();
  }

  async function launchPyramid() {
    clearInterval(timerInterval);
    await update(gameRef, { phase: 'pyramid' });
  }

  const btnReady = $('btn-ready');
  btnReady.onclick = async () => {
    if (isReady) return;
    btnReady.disabled = true;
    btnReady.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi…';
    try {
      await update(ref(db, `games/${gameId}/players/${playerId}`), { memorizeReady: true });
      isReady = true;
      btnReady.innerHTML = '<i class="fas fa-check"></i> Prêt !';
      btnReady.className = 'btn btn-secondary';
    } catch (e) {
      btnReady.disabled = false;
      btnReady.innerHTML = '<i class="fas fa-check"></i> Je suis prêt !';
      showToast('Erreur réseau — réessaie', 'error');
    }
  };

  function unmount() { clearInterval(timerInterval); }

  return { update: update_, unmount };
}
