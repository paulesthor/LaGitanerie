// ── Phase « end » (portée depuis end.html) ────────────────────────────
import { db, auth, getFirestore } from '/js/firebase-config.js';
import { ref, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, setDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { clearGameSession } from '/js/game/utils.js';
import { avatarHTML } from '/js/game/avatar.js';
import { BADGES, TITLES, evaluateGameRewards } from '/js/game/badges.js';

const END_VIEW = `
  <div class="screen">
    <header class="app-header">
      <div style="width:36px"></div>
      <div class="header-brand"><i class="fas fa-guitar" style="color:var(--red);margin-right:6px;font-size:.9rem"></i>La <span class="brand-accent">Gitanerie</span></div>
      <div style="width:36px"></div>
    </header>
    <div class="page-content">
      <div class="card flex-col gap-12">
        <h3><i class="fas fa-beer" style="color:var(--orange)"></i> Qui a bu le plus ?</h3>
        <div id="podium-drunk" class="flex-col gap-8"></div>
      </div>
      <div class="card flex-col gap-12">
        <h3><i class="fas fa-trophy" style="color:var(--orange)"></i> Distinctions</h3>
        <div id="highlights" class="flex-col gap-8"></div>
      </div>
      <div class="card flex-col gap-12">
        <h3><i class="fas fa-chart-bar" style="color:var(--orange)"></i> Stats de la partie</h3>
        <div id="stats" class="stat-card"></div>
      </div>
      <div id="badges-section" class="hidden flex-col gap-12">
        <div class="section-divider"></div>
        <div class="flex items-center gap-10">
          <i class="fas fa-trophy" style="color:var(--orange)"></i>
          <h3>Nouveau badge débloqué !</h3>
        </div>
        <div id="badges-list" class="flex-col gap-10"></div>
      </div>
      <div id="titles-section" class="hidden flex-col gap-12">
        <div class="section-divider"></div>
        <div class="flex items-center gap-10">
          <i class="fas fa-medal" style="color:var(--orange)"></i>
          <h3 id="titles-heading">Nouveau titre débloqué !</h3>
        </div>
        <div id="titles-list" class="flex-col gap-10"></div>
      </div>
      <div id="xp-section" class="xp-section hidden flex-col gap-8">
        <p class="text-sm text-muted">XP gagné cette partie</p>
        <div style="font-size:2rem;font-weight:700;color:var(--gold)">+<span id="xp-amount">0</span> XP</div>
        <p id="xp-bonus-note" class="text-sm text-muted hidden">dont un petit bonus de participation</p>
      </div>
      <div class="flex-col gap-12 mt-auto">
        <button id="btn-replay" class="btn btn-primary"><i class="fas fa-redo"></i> Rejouer</button>
        <button id="btn-home" class="btn btn-secondary"><i class="fas fa-flag-checkered"></i> Fin de partie</button>
      </div>
    </div>
  </div>`;

const END_VIEW_ORAL = `
  <div class="screen">
    <header class="app-header">
      <div style="width:36px"></div>
      <div class="header-brand"><i class="fas fa-guitar" style="color:var(--red);margin-right:6px;font-size:.9rem"></i>La <span class="brand-accent">Gitanerie</span></div>
      <div style="width:36px"></div>
    </header>
    <div class="page-content" style="justify-content:center">
      <div class="card flex-col gap-14 text-center">
        <div style="font-size:3rem">🎉</div>
        <h2>Partie terminée !</h2>
        <p class="text-sm text-muted">Mode Soirée — santé à tous 🍻</p>
        <div id="oral-end-players" class="flex-col gap-8" style="margin-top:6px"></div>
        <div id="oral-end-note" class="text-sm text-muted hidden"><i class="fas fa-check-circle" style="color:var(--green)"></i> Partie ajoutée à ton compteur</div>
      </div>
      <div class="flex-col gap-12 mt-auto">
        <button id="btn-replay" class="btn btn-primary"><i class="fas fa-redo"></i> Nouvelle partie</button>
        <button id="btn-home" class="btn btn-secondary"><i class="fas fa-flag-checkered"></i> Menu</button>
      </div>
    </div>
  </div>`;

export function mount(root, api) {
  const { gameId, playerId } = api;
  const $ = (id) => root.querySelector('#' + id);
  let _rendered = false;
  let _unsubAuth = null;

  function fire(opts) { if (typeof confetti === 'function') confetti(opts); }

  function animCounter(el, target, duration = 1400) {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function launchConfetti() {
    const colors = ['#f39c12', '#f5a520', '#e8940a', '#ecf0f1', '#d4ac0d'];
    fire({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors });
    setTimeout(() => fire({ particleCount: 55, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors }), 350);
    setTimeout(() => fire({ particleCount: 55, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors }), 700);
  }

  async function cleanupGame() {
    try {
      const codeSnap = await get(ref(db, `games/${gameId}/gameCode`));
      const gameCode = codeSnap.val();
      if (gameCode) await remove(ref(db, `gameCodes/${gameCode}`));
      await remove(ref(db, `games/${gameId}`));
    } catch (e) { /* déjà supprimé, OK */ }
  }

  function bindButtons() {
    $('btn-replay').onclick = async () => { await cleanupGame(); window.location.href = '/lobbypyramide.html'; };
    $('btn-home').onclick   = async () => { await cleanupGame(); window.location.href = '/'; };
  }

  // ── Fin « Mode Soirée » : pas de stats/titres, juste le compteur de parties ──
  function renderOral(game) {
    const players = Object.entries(game.players || {}).map(([id, p]) => ({ id, ...p }));
    const list = $('oral-end-players');
    list.innerHTML = '';
    players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-12';
      row.style.animation = `slide-up-fade 0.35s ease-out ${0.1 + i * 0.1}s both`;
      row.innerHTML = `${avatarHTML(p.avatar, 36)}<span class="font-bold" style="flex:1;text-align:left">${p.name}${p.id === playerId ? ' (toi)' : ''}</span>`;
      list.appendChild(row);
    });

    let _done = false;
    _unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous || _done) return;
      _done = true;
      const firestore = await getFirestore();
      let userData = {};
      try {
        const dsnap = await getDoc(doc(firestore, 'users', user.uid));
        if (dsnap.exists()) userData = dsnap.data();
      } catch (e) {}
      if (userData.lastRewardedGame === gameId) return;  // idempotent
      try {
        await setDoc(doc(firestore, 'users', user.uid), {
          totalGames: increment(1),
          lastRewardedGame: gameId,
        }, { merge: true });
        $('oral-end-note').classList.remove('hidden');
      } catch (e) {}
    });

    clearGameSession();
    launchConfetti();
  }

  function render(game) {
    const players = Object.entries(game.players || {}).map(([id, p]) => ({ id, ...p }));

    const byDrunk = [...players].sort((a,b) => (b.sipsToDrink||0) - (a.sipsToDrink||0));
    const medals  = ['1er','2e','3e','4e','5e'];
    const classes = ['first','second','third','',''];
    const podium  = $('podium-drunk');
    byDrunk.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `podium-row ${classes[i]||''}`;
      row.style.animation = `slide-up-fade 0.4s ease-out ${0.1 + i * 0.14}s both`;
      row.innerHTML = `
        <div class="podium-rank">${medals[i]||i+1}</div>
        ${avatarHTML(p.avatar, 44)}
        <div class="font-bold" style="flex:1">${p.name}${p.id === playerId ? ' (toi)' : ''}</div>
        <div class="${(p.sipsToDrink||0) > 0 ? 'badge badge-red' : 'badge badge-muted'}">${(p.sipsToDrink||0) > 0 ? (p.sipsToDrink + ' gorgées') : '—'}</div>`;
      podium.appendChild(row);
    });

    const highlights = $('highlights');
    const byGiven    = [...players].sort((a,b) => (b.sipsGiven||0) - (a.sipsGiven||0));
    const bigGiver   = byGiven[0];
    const bigDrinker = byDrunk[0];
    const luckiest   = [...players].sort((a,b) => (a.sipsToDrink||0) - (b.sipsToDrink||0))[0];

    const awards = [
      { icon:'<i class="fas fa-hand-holding-heart" style="color:var(--orange)"></i>', label:'Gitan généreux', desc:`${bigGiver?.name} a donné le plus de gorgées`, value:(bigGiver?.sipsGiven||0) > 0 ? `${bigGiver.sipsGiven} gorgées` : '—' },
      { icon:'<i class="fas fa-skull" style="color:var(--red)"></i>', label:'Grand buveur', desc:`${bigDrinker?.name} a bu le plus`, value:(bigDrinker?.sipsToDrink||0) > 0 ? `${bigDrinker.sipsToDrink} gorgées` : '—' },
      { icon:'<i class="fas fa-clover" style="color:var(--green)"></i>', label:'Chanceux', desc:`${luckiest?.name} a bu le moins`, value:(luckiest?.sipsToDrink||0) > 0 ? `${luckiest.sipsToDrink} gorgées` : 'Sobre !' },
    ];
    awards.forEach((a, i) => {
      const el = document.createElement('div');
      el.className = 'stat-highlight';
      el.style.animation = `slide-up-fade 0.35s ease-out ${0.6 + i * 0.12}s both`;
      el.innerHTML = `
        <div class="stat-highlight-icon" style="font-size:1.4rem">${a.icon}</div>
        <div class="flex-col gap-8" style="flex:1">
          <span class="font-bold">${a.label}</span>
          <span class="text-sm text-muted">${a.desc}</span>
        </div>
        <span class="badge badge-gold">${a.value}</span>`;
      highlights.appendChild(el);
    });

    const totalDrunk = players.reduce((s,p) => s+(p.sipsToDrink||0), 0);
    const totalGiven = players.reduce((s,p) => s+(p.sipsGiven||0), 0);
    const me         = players.find(p => p.id === playerId);
    const myRank     = byDrunk.findIndex(p => p.id === playerId) + 1;

    const statRows = [
      ['Total de gorgées bues', `${totalDrunk} 🍺`],
      ['Total de gorgées données', `${totalGiven} 🍺`],
      ['Mon classement', `${myRank} / ${players.length}`],
      ['Mes gorgées bues', `${me?.sipsToDrink||0} 🍺`],
      ['Mes gorgées données', `${me?.sipsGiven||0} 🍺`],
      ['Nombre de joueurs', players.length],
    ];
    const stats = $('stats');
    statRows.forEach(([label, value], i) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.style.animation = `slide-up-fade 0.3s ease-out ${0.95 + i * 0.07}s both`;
      row.innerHTML = `<span class="text-muted">${label}</span><span class="font-bold">${value}</span>`;
      stats.appendChild(row);
    });

    // --- XP + récompenses si connecté ---
    let _rewardsProcessed = false;
    _unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) return;
      if (_rewardsProcessed) return;
      _rewardsProcessed = true;

      const sipsThisGame  = me?.sipsToDrink || 0;
      const givenThisGame = me?.sipsGiven   || 0;
      const bluffThisGame = me?.bluffSuccess || 0;
      const baseXp = Math.max(10, 10 + givenThisGame - sipsThisGame);

      const firestore = await getFirestore();
      let userData = {};
      try {
        const dsnap = await getDoc(doc(firestore, 'users', user.uid));
        if (dsnap.exists()) userData = dsnap.data();
      } catch(e) {}

      if (userData.lastRewardedGame === gameId) return;

      const prevBadges = userData.badges || [];
      const prevTitles = userData.titles || [];
      const newTotalGames = (userData.totalGames     || 0) + 1;
      const newTotalDrunk = (userData.totalSipsDrunk || 0) + sipsThisGame;
      const newTotalGiven = (userData.totalSipsGiven || 0) + givenThisGame;
      const newBluff      = (userData.bluffSuccess   || 0) + bluffThisGame;
      const newLevel      = Math.floor(((userData.xp || 0) + baseXp) / 100);

      const isTopDrinker = bigDrinker && bigDrinker.id === playerId;
      const isTopGiver   = bigGiver   && bigGiver.id   === playerId;
      const isLuckiest   = luckiest   && luckiest.id   === playerId;
      const culSec       = !!me?.culSecDrunk;
      const topMenteur   = [...players].sort((a, b) => (b.menteurCaught || 0) - (a.menteurCaught || 0))[0];
      const isTopMenteur = topMenteur && topMenteur.id === playerId && (topMenteur.menteurCaught || 0) > 0;

      const newTotalCulSec      = (userData.totalCulSec || 0) + (culSec ? 1 : 0);
      const newTopDrinkerStreak = isTopDrinker ? ((userData.topDrinkerStreak || 0) + 1) : 0;
      const newSoberStreak      = (sipsThisGame === 0) ? ((userData.soberStreak || 0) + 1) : 0;

      const ctx = {
        totalGames: newTotalGames, totalSipsDrunk: newTotalDrunk, totalSipsGiven: newTotalGiven,
        bluffSuccess: newBluff, level: newLevel,
        sipsThisGame, givenThisGame, bluffThisGame,
        culSec, memoryPerfect: !!me?.memoryPerfect,
        isTopDrinker, isTopGiver, isSober: sipsThisGame === 0, isLuckiest,
        numPlayers: players.length,
        totalCulSec: newTotalCulSec, topDrinkerStreak: newTopDrinkerStreak, soberStreak: newSoberStreak,
        maxBluffFailStreak: me?.maxBluffFailStreak || 0,
        maxBluffSuccessStreak: me?.maxBluffSuccessStreak || 0,
        menteurCaught: me?.menteurCaught || 0, isTopMenteur,
        memoryFail: !!me?.memoryFail,
      };

      const { newBadges, newTitles, bonusXp } = evaluateGameRewards({ badges: prevBadges, titles: prevTitles }, ctx);
      const totalXp = baseXp + bonusXp;

      if (newBadges.length > 0) {
        const section = $('badges-section');
        const list    = $('badges-list');
        section.classList.remove('hidden');
        if (newBadges.length > 1) root.querySelector('#badges-section h3').textContent = `${newBadges.length} badges débloqués !`;
        newBadges.forEach((id, idx) => {
          const def = BADGES[id]; if (!def) return;
          const card = document.createElement('div');
          card.className = 'badge-unlock-card';
          card.style.animationDelay = `${0.1 + idx * 0.18}s`;
          card.innerHTML = `
            <div class="badge-hex-lg" style="background:${def.bg};box-shadow:0 6px 24px ${def.glow}">
              <i class="${def.icon}" style="color:${def.textColor};font-size:2rem"></i>
            </div>
            <div class="text-center flex-col gap-4">
              <span class="font-bold" style="font-size:1rem">${def.name}</span>
              <span class="text-sm text-muted">${def.desc}</span>
            </div>`;
          list.appendChild(card);
        });
      }

      if (newTitles.length > 0) {
        const section = $('titles-section');
        const list    = $('titles-list');
        section.classList.remove('hidden');
        if (newTitles.length > 1) $('titles-heading').textContent = `${newTitles.length} nouveaux titres !`;
        newTitles.forEach((id, idx) => {
          const def = TITLES[id]; if (!def) return;
          const el = document.createElement('div');
          el.className = 'stat-highlight';
          el.style.animation = `slide-up-fade 0.35s ease-out ${0.2 + idx * 0.12}s both`;
          el.innerHTML = `
            <div class="stat-highlight-icon"><i class="fas fa-award" style="color:var(--gold)"></i></div>
            <div class="flex-col gap-4" style="flex:1">
              <span class="font-bold">${def.name}</span>
              <span class="text-sm text-muted">${def.desc}</span>
            </div>`;
          list.appendChild(el);
        });
      }

      if (newBadges.length || newTitles.length) {
        setTimeout(() => fire({ particleCount: 55, spread: 60, origin: { y: 0.45 }, colors: ['#f39c12','#f5a520','#fff','#9b59b6'] }), 400);
      }

      const xpSec = $('xp-section');
      xpSec.classList.remove('hidden');
      if (bonusXp > 0) $('xp-bonus-note').classList.remove('hidden');
      setTimeout(() => animCounter($('xp-amount'), totalXp), 1500);

      const updateData = {
        xp:             increment(totalXp),
        totalGames:     increment(1),
        totalSipsDrunk: increment(sipsThisGame),
        totalSipsGiven: increment(givenThisGame),
        bluffSuccess:   increment(bluffThisGame),
        totalCulSec:      newTotalCulSec,
        topDrinkerStreak: newTopDrinkerStreak,
        soberStreak:      newSoberStreak,
        lastRewardedGame: gameId,
      };
      if (newBadges.length > 0) updateData.badges = [...new Set([...prevBadges, ...newBadges])];
      if (newTitles.length > 0) {
        updateData.titles = [...new Set([...prevTitles, ...newTitles])];
        if (!userData.activeTitle) updateData.activeTitle = newTitles[0];
      }
      try { await setDoc(doc(firestore, 'users', user.uid), updateData, { merge: true }); }
      catch(e) { console.error(e); }
    });

    clearGameSession();
    launchConfetti();
  }

  function update(game) {
    if (_rendered) return;
    if (!game || !game.players) return;
    _rendered = true;
    if (game.mode === 'oral') {
      root.innerHTML = END_VIEW_ORAL;
      bindButtons();
      renderOral(game);
    } else {
      root.innerHTML = END_VIEW;
      bindButtons();
      render(game);
    }
  }

  function unmount() { if (_unsubAuth) { try { _unsubAuth(); } catch (e) {} _unsubAuth = null; } }

  return { update, unmount };
}
