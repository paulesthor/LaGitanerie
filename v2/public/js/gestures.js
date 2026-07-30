// ── Gestes tactiles globaux (chargé par firebase-config.js sur toutes les pages) ──
// 1) Glisser vers le bas pour fermer les fenêtres du bas (.modal-overlay/.modal-sheet)
// 2) Glisser depuis le bord gauche = retour (uniquement en PWA installée)
// 3) Retour haptique léger sur les boutons (Android ; sans effet sur iOS qui ne
//    supporte pas l'API Vibration — comportement no-op inoffensif)
(function () {
  if (typeof document === 'undefined') return;

  // Vibration centralisée, respecte le réglage (localStorage gita_haptics === '0' → off).
  // Exposée en global pour que le jeu l'utilise aussi (window.gitaVibrate).
  const vibrate = (p) => {
    try {
      if (localStorage.getItem('gita_haptics') === '0') return;
      navigator.vibrate && navigator.vibrate(p);
    } catch (e) {}
  };
  window.gitaVibrate = vibrate;

  // ── 1. Retour haptique sur les boutons importants ──
  const HAPTIC_SEL = '.btn, .action-btn, .pred-btn, .target-btn, .game, .seg-btn, .stepper-btn';
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest(HAPTIC_SEL);
    if (el && !el.disabled) vibrate(8);
  }, { passive: true });

  // ── 2. Glisser vers le bas pour fermer une fenêtre du bas ──
  let sheet = null, overlay = null, startY = 0, curY = 0, dragging = false;

  const scrollableAncestorScrolled = (node, root) => {
    // Empêche de fermer si on scrolle un contenu interne qui n'est pas tout en haut.
    let n = node;
    while (n && n !== root) {
      if (n.scrollHeight > n.clientHeight + 2 && n.scrollTop > 0) return true;
      n = n.parentElement;
    }
    return false;
  };

  document.addEventListener('touchstart', (e) => {
    const ov = e.target.closest && e.target.closest('.modal-overlay.show');
    if (!ov) return;
    const sh = ov.querySelector('.modal-sheet');
    if (!sh || !sh.contains(e.target)) return;
    if (scrollableAncestorScrolled(e.target, sh)) return; // laisse scroller
    overlay = ov; sheet = sh;
    startY = curY = e.touches[0].clientY;
    dragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    curY = e.touches[0].clientY;
    const dy = Math.max(0, curY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    sheet.style.opacity = String(Math.max(0.4, 1 - dy / 400));
  }, { passive: true });

  const endSheetDrag = () => {
    if (!dragging) return;
    dragging = false;
    const dy = curY - startY;
    sheet.style.transition = '';
    sheet.style.transform = '';
    sheet.style.opacity = '';
    if (dy > 90) { overlay.classList.remove('show'); vibrate(8); }
    overlay = sheet = null;
  };
  document.addEventListener('touchend', endSheetDrag);
  document.addEventListener('touchcancel', endSheetDrag);

  // ── 3. Glisser depuis le bord gauche = retour (PWA installée uniquement) ──
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (isStandalone) {
    let bx = 0, by = 0, edge = false;
    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      edge = t.clientX <= 24;
      bx = t.clientX; by = t.clientY;
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!edge) return;
      edge = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - bx;
      const dy = Math.abs(t.clientY - by);
      if (dx > 70 && dy < 50 && window.history.length > 1) window.history.back();
    });
  }
})();
