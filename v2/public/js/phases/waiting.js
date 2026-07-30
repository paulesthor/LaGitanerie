// ── Phase « waiting » / salle d'attente (portée depuis join.html) ─────
import { db, auth } from '/js/firebase-config.js';
import { ref, update, remove, get, set, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
  showToast, createDeck, createPyramid, createPyramidOrder,
  defaultPyramidRows, clearGameSession
} from '/js/game/utils.js';
import { avatarHTML } from '/js/game/avatar.js';

const VIEW = `
  <div class="screen">
    <header class="app-header">
      <button class="header-btn" id="btn-leave"><i class="fas fa-door-open"></i></button>
      <div class="header-brand"><i class="fas fa-guitar" style="color:var(--red);margin-right:6px;font-size:.9rem"></i>La <span class="brand-accent">Gitanerie</span></div>
      <div style="width:36px"></div>
    </header>
    <div class="page-content">
      <div class="card flex-col gap-8 text-center">
        <p class="text-sm text-muted">Code de la partie</p>
        <div class="game-code-display" id="game-code">----</div>
        <div class="flex gap-8" style="justify-content:center">
          <button id="btn-copy-code" class="btn btn-secondary btn-sm" style="width:auto;gap:6px"><i class="fas fa-copy"></i> Copier</button>
          <button id="btn-share-code" class="btn btn-secondary btn-sm" style="width:auto;gap:6px"><i class="fas fa-share-alt"></i> Partager</button>
        </div>
      </div>
      <div class="card flex-col gap-12">
        <div class="flex items-center justify-between">
          <h3>Joueurs</h3>
          <span id="player-count" class="badge badge-muted">0</span>
        </div>
        <div id="players-list" class="players-list"><div class="text-muted text-sm text-center">En attente...</div></div>
      </div>
      <div id="rules-section" class="hidden">
        <div class="rules-accordion" id="rules-accordion">
          <div class="rules-header" id="rules-toggle"><h3>⚙️ Règles de la partie</h3><i class="fas fa-chevron-down chevron"></i></div>
          <div class="rules-body">
            <div class="rule-row">
              <div class="rule-info"><div class="rule-name">Rangées de la pyramide</div><div class="rule-desc">Nombre de rangées (haut = Cul Sec)</div></div>
              <div class="stepper"><button class="stepper-btn" id="rows-minus">−</button><span class="stepper-val" id="val-rows">5</span><button class="stepper-btn" id="rows-plus">+</button></div>
            </div>
            <div class="rule-row">
              <div class="rule-info"><div class="rule-name">Cartes visibles (phase 1)</div><div class="rule-desc">Les autres voient la carte révélée pendant 3s</div></div>
              <label class="toggle"><input type="checkbox" id="rule-showPhase1" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="rule-row">
              <div class="rule-info"><div class="rule-name">Preuve visible pour tous</div><div class="rule-desc">Quand quelqu'un prouve au Menteur, tous voient la carte</div></div>
              <label class="toggle"><input type="checkbox" id="rule-showProof" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="rule-row">
              <div class="rule-info"><div class="rule-name">Multiplicateur de gorgées</div><div class="rule-desc">Multiplie toutes les gorgées de la pyramide</div></div>
              <div class="segmented" data-seg="mult">
                <button class="seg-btn active" data-val="1">×1</button>
                <button class="seg-btn" data-val="2">×2</button>
                <button class="seg-btn" data-val="3">×3</button>
              </div>
            </div>
            <div class="rule-row">
              <div class="rule-info"><div class="rule-name">Timer par carte</div><div class="rule-desc">Délai avant que l'hôte puisse forcer le tour</div></div>
              <div class="segmented" data-seg="timer">
                <button class="seg-btn" data-val="20">20s</button>
                <button class="seg-btn active" data-val="30">30s</button>
                <button class="seg-btn" data-val="45">45s</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="invite-tip" class="hidden" style="padding:12px 16px;background:rgba(243,156,18,.07);border:1px solid rgba(243,156,18,.2);border-radius:var(--radius);text-align:center">
        <p class="text-sm text-muted" style="line-height:1.5">Partage le code ci-dessus pour inviter tes amis.<br>Min. 2 joueurs pour lancer.</p>
      </div>
      <div class="flex-col gap-12 mt-auto">
        <div id="host-section" class="hidden flex-col gap-8">
          <p class="text-sm text-muted text-center"><i class="fas fa-crown" style="color:var(--gold)"></i> Tu es l'hôte. Lance quand tout le monde est prêt.</p>
          <button id="btn-start" class="btn btn-primary"><i class="fas fa-play"></i> Lancer la partie</button>
        </div>
        <div id="guest-section" class="hidden flex-col gap-8">
          <button id="btn-ready" class="btn btn-primary"><i class="fas fa-check"></i> Je suis prêt !</button>
          <p class="text-sm text-muted text-center">L'hôte lancera la partie.</p>
        </div>
        <div id="error-msg" class="hidden text-sm text-center" style="color:var(--red)"></div>
      </div>
    </div>
  </div>`;

export function mount(root, api) {
  const { gameId, playerId, isHost } = api;
  root.innerHTML = VIEW;
  const $ = (id) => root.querySelector('#' + id);
  const gameRef   = ref(db, `games/${gameId}`);
  const playerRef = ref(db, `games/${gameId}/players/${playerId}`);

  let rules = { rows: 5, showPhase1: true, showProof: true, sipsMultiplier: 1, timerDuration: 30 };
  let isReady = false;

  // ── « Rejoindre rapidement » : l'hôte (compte connecté) publie sa partie en
  // attente pour que ses amis la voient et la rejoignent sans taper le code. ──
  const agRef = ref(db, `activeGames/${playerId}`);
  let agPublished = false;
  async function publishActiveGame(game) {
    const u = auth.currentUser;
    if (!isHost || agPublished || !u || u.isAnonymous || !game.gameCode) return;
    agPublished = true;
    const me = (game.players || {})[playerId] || {};
    try {
      await set(agRef, {
        code: game.gameCode, gameId,
        name: me.name || 'Joueur', avatar: me.avatar || '🎴', ts: Date.now(),
      });
      onDisconnect(agRef).remove();  // nettoyage si l'hôte ferme l'app
    } catch (e) { agPublished = false; }
  }
  async function unpublishActiveGame() {
    if (!isHost) return;
    try { onDisconnect(agRef).cancel(); } catch (e) {}
    try { await remove(agRef); } catch (e) {}
  }

  if (isHost) {
    $('host-section').classList.remove('hidden');
    $('rules-section').classList.remove('hidden');
  } else {
    $('guest-section').classList.remove('hidden');
  }

  $('btn-copy-code').onclick = async () => {
    const code = $('game-code').textContent;
    if (!code || code === '----') return;
    try {
      await navigator.clipboard.writeText(code);
      $('btn-copy-code').innerHTML = '<i class="fas fa-check"></i> Copié !';
      setTimeout(() => { $('btn-copy-code').innerHTML = '<i class="fas fa-copy"></i> Copier'; }, 2000);
    } catch { showToast('Copie non supportée sur ce navigateur', 'error'); }
  };
  $('btn-share-code').onclick = async () => {
    const code = $('game-code').textContent;
    if (!code || code === '----') return;
    if (navigator.share) {
      try { await navigator.share({ title: 'La Gitanerie', text: `Rejoins ma partie ! Code : ${code}\nhttps://la-gitanerie.web.app` }); } catch {}
    } else {
      await navigator.clipboard.writeText(code).catch(() => {});
      showToast(`Code copié : ${code}`, 'success');
    }
  };

  $('btn-ready') && ($('btn-ready').onclick = async () => { await update(playerRef, { ready: !isReady }); });
  $('btn-start') && ($('btn-start').onclick = onStart);

  $('btn-leave').onclick = async () => {
    const btn = $('btn-leave');
    btn.disabled = true;
    try {
      if (isHost) {
        await unpublishActiveGame();
        const snap = await get(gameRef);
        const gameCode = snap.val()?.gameCode;
        await update(gameRef, { status: 'abandoned' });
        setTimeout(async () => {
          if (gameCode) await remove(ref(db, `gameCodes/${gameCode}`));
          await remove(gameRef);
        }, 3000);
      } else {
        await remove(playerRef);
      }
      clearGameSession();
      window.location.href = '/lobbypyramide.html';
    } catch (e) {
      btn.disabled = false;
      showToast('Erreur lors de la sortie', 'error');
    }
  };

  // Règles (hôte)
  $('rules-toggle') && ($('rules-toggle').onclick = () => $('rules-accordion').classList.toggle('open'));
  $('rows-minus')   && ($('rows-minus').onclick = () => changeRows(-1));
  $('rows-plus')    && ($('rows-plus').onclick  = () => changeRows(+1));
  function changeRows(delta) {
    rules.rows = Math.max(2, Math.min(8, rules.rows + delta));
    $('val-rows').textContent = rules.rows;
  }
  root.querySelectorAll('.segmented').forEach(seg => {
    seg.querySelectorAll('.seg-btn').forEach(btn => {
      btn.onclick = () => {
        seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = Number(btn.dataset.val);
        if (seg.dataset.seg === 'mult')  rules.sipsMultiplier = val;
        if (seg.dataset.seg === 'timer') rules.timerDuration  = val;
      };
    });
  });
  $('rule-showPhase1') && ($('rule-showPhase1').onchange = (e) => { rules.showPhase1 = e.target.checked; });
  $('rule-showProof')  && ($('rule-showProof').onchange  = (e) => { rules.showProof  = e.target.checked; });

  function update_(game) {
    const players = game.players || {};
    const entries = Object.entries(players);
    $('game-code').textContent = game.gameCode || '----';
    publishActiveGame(game);
    $('player-count').textContent = entries.length;

    const numPlayers = entries.length;
    if (rules.rows === rules._defaultRows) {
      rules.rows = defaultPyramidRows(numPlayers);
      rules._defaultRows = rules.rows;
      $('val-rows').textContent = rules.rows;
    } else if (!rules._defaultRows) {
      rules._defaultRows = defaultPyramidRows(numPlayers);
      rules.rows = rules._defaultRows;
      $('val-rows').textContent = rules.rows;
    }

    const tip = $('invite-tip');
    if (tip) tip.classList.toggle('hidden', entries.length >= 4);

    const list = $('players-list');
    list.innerHTML = '';
    entries.forEach(([id, p]) => {
      const isMe    = id === playerId;
      const isHost_ = id === game.hostId;
      const row = document.createElement('div');
      row.className = 'player-row';
      const borderClass = p.activeBorder ? `border-${p.activeBorder}` : '';
      row.innerHTML = `
        ${avatarHTML(p.avatar, 40, borderClass)}
        <div class="flex-col" style="flex:1">
          <span class="font-bold">${p.name}${isMe ? ' (toi)' : ''}</span>
          ${isHost_ ? '<span class="host-crown"><i class="fas fa-crown"></i> Hôte</span>' : ''}
        </div>
        <span class="badge ${p.ready ? 'badge-gold' : 'badge-muted'}">${p.ready ? 'Prêt' : 'En attente'}</span>`;
      if (isHost && !isMe && !isHost_) {
        const kick = document.createElement('button');
        kick.innerHTML = '<i class="fas fa-times"></i>';
        kick.title = 'Expulser';
        kick.style.cssText = 'background:none;border:none;color:var(--red);font-size:1rem;padding:4px 10px;cursor:pointer;margin-left:4px;opacity:.7';
        kick.onclick = async () => { await remove(ref(db, `games/${gameId}/players/${id}`)); showToast(`${p.name} a été expulsé`, 'info'); };
        row.appendChild(kick);
      }
      list.appendChild(row);
      if (isMe) isReady = !!p.ready;
    });

    const btnStart = $('btn-start');
    if (btnStart) {
      const nonHostIds = entries.filter(([id]) => id !== game.hostId);
      const allReady   = nonHostIds.length > 0 && nonHostIds.every(([, p]) => p.ready);
      const canStart   = entries.length >= 2 && allReady;
      btnStart.disabled = !canStart;
      btnStart.innerHTML = canStart
        ? '<i class="fas fa-play"></i> Lancer la partie'
        : '<i class="fas fa-hourglass-half"></i> En attente des joueurs…';
    }
    const btnReady = $('btn-ready');
    if (btnReady) {
      btnReady.className = isReady ? 'btn btn-secondary' : 'btn btn-primary';
      btnReady.innerHTML = isReady ? '<i class="fas fa-times"></i> Pas prêt' : '<i class="fas fa-check"></i> Je suis prêt !';
    }
  }

  async function onStart() {
    const snap    = await get(gameRef);
    const game    = snap.val();
    const players = game.players || {};
    const ids     = Object.keys(players);
    if (ids.length < 2) return showError('Il faut au moins 2 joueurs');
    const nonHostIds = ids.filter(id => id !== playerId);
    const allReady   = nonHostIds.every(id => players[id]?.ready);
    if (!allReady) return showError('Tout le monde doit être prêt !');

    const deck    = createDeck();
    const numRows = rules.rows;
    const pyramid = createPyramid(numRows);
    const order   = createPyramidOrder(numRows);
    const updates = {
      status: 'started', phase: 'distribution', pyramid, pyramidOrder: order, deck,
      currentTurn: ids[0],
      rules: { showPhase1: rules.showPhase1, showProof: rules.showProof, sipsMultiplier: rules.sipsMultiplier, timerDuration: rules.timerDuration }
    };
    ids.forEach(id => {
      updates[`players/${id}/cards`]       = deck.splice(0, 4).map(c => ({ ...c, revealed: false }));
      updates[`players/${id}/sipsToDrink`] = 0;
      updates[`players/${id}/sipsGiven`]   = 0;
    });
    updates.deck = deck;
    await unpublishActiveGame();
    await update(gameRef, updates);
  }

  function showError(msg) {
    const el = $('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function unmount() { unpublishActiveGame(); }

  return { update: update_, unmount };
}
