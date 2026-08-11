// ══════════════════════════════════════════════════════════════════════
//  Sonde de connexion
//
//  navigator.onLine ne répond pas à la bonne question : il dit « une
//  interface réseau existe », pas « le jeu va marcher ». Un portail captif
//  d'hôtel, une 3G de festival saturée ou un Wi-Fi sans sortie le laissent
//  à true alors que rien ne passe. On sonde donc la dépendance réelle du
//  jeu : la connexion temps réel à la base.
//
//  `.info/connected` est la seule mesure honnête ici — il passe à true
//  quand la websocket est effectivement établie, pas quand une requête
//  HTTP a l'air de partir.
// ══════════════════════════════════════════════════════════════════════

const DEFAULT_TIMEOUT = 3000;

export function probeConnection(timeoutMs = DEFAULT_TIMEOUT) {
  // Négatif immédiat : inutile d'attendre trois secondes quand le téléphone
  // sait déjà qu'il est en mode avion.
  if (navigator.onLine === false) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    let off = null;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (off) { try { off(); } catch (e) {} }
      resolve(v);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);

    // Import dynamique : une page qui n'appelle jamais la sonde ne paie pas
    // le chargement du SDK, et un échec de chargement (donc pas de réseau)
    // se traduit proprement par « hors ligne ».
    (async () => {
      try {
        const [{ db }, rtdb] = await Promise.all([
          import('/js/firebase-config.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'),
        ]);
        off = rtdb.onValue(rtdb.ref(db, '.info/connected'), (snap) => {
          if (snap.val() === true) finish(true);
        }, () => finish(false));
      } catch (e) {
        finish(false);
      }
    })();
  });
}

// Sonde lancée en avance : au moment où le joueur tape sur un mode, la
// réponse est déjà là. Sans ça, la bascule automatique se paierait d'une
// attente de trois secondes en plein écran de choix.
let _pending = null;
export function prewarm(timeoutMs = DEFAULT_TIMEOUT) {
  if (!_pending) _pending = probeConnection(timeoutMs);
  return _pending;
}

// Renvoie l'état si la sonde a déjà répondu, sinon null — permet à l'appelant
// de décider entre attendre et afficher un indicateur.
export function cached() {
  return _cachedValue;
}
let _cachedValue = null;
export function watch(cb) {
  prewarm().then((v) => { _cachedValue = v; cb(v); });
}
