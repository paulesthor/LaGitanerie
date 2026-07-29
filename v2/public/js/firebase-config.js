import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, setPersistence,
  indexedDBLocalPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref as dbRef, onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initLogger, logError } from "./logger.js";
import { initPresence } from "./presence.js";

// Réexport : les pages peuvent faire  import { logError } from '/js/firebase-config.js'
export { logError };

const firebaseConfig = {
  projectId: "la-gitanerie",
  appId: "1:500260326870:web:d0809e80bdd57d9bf9a877",
  databaseURL: "https://la-gitanerie-default-rtdb.europe-west1.firebasedatabase.app",
  storageBucket: "la-gitanerie.firebasestorage.app",
  apiKey: "AIzaSyDRGG__Qm0EuxY5UKwLPwJ2IDXe2m8VmtM",
  // authDomain = MÊME domaine que l'app (web.app) : la redirection Google reste
  // sur la même origine → la session survit en PWA installée sur iOS (évite le
  // cloisonnement de stockage ITP qui faisait retomber sur l'écran de connexion).
  authDomain: "la-gitanerie.web.app",
  messagingSenderId: "500260326870"
};

const app = initializeApp(firebaseConfig);

/* ---------------------------------------------------------------------------
 *  AUTH
 *  Persistance locale forte : un joueur déjà connecté le reste même hors-ligne
 *  et n'a PAS besoin du réseau pour ré-authentifier au retour dans le jeu.
 *  (attaque directe des erreurs auth/network-request-failed sur mauvais réseau)
 * ------------------------------------------------------------------------- */
export const auth = getAuth(app);
setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch(() => { /* navigation privée : stockage bloqué, on continue quand même */ });

/* ---------------------------------------------------------------------------
 *  REALTIME DATABASE (parties temps réel)
 * ------------------------------------------------------------------------- */
export const db = getDatabase(app);

/* ---------------------------------------------------------------------------
 *  FIRESTORE — configuré pour survivre à la PIRE connexion possible
 *  - experimentalForceLongPolling : force le transport long-polling. Le flux
 *    WebChannel par défaut casse dès que le réseau mobile est faible / passe par
 *    un proxy opérateur / un portail captif → "impossible de se connecter".
 *    Le long-polling est plus lent mais PASSE même avec une très mauvaise réception.
 *  - persistentLocalCache : cache hors-ligne. L'app lit/écrit dans le cache et
 *    synchronise automatiquement au retour du signal au lieu d'échouer.
 * ------------------------------------------------------------------------- */
export const firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/* ---------------------------------------------------------------------------
 *  Journal d'erreurs — capteurs globaux actifs sur toutes les pages.
 *  Enregistre chaque erreur (JS, promesse rejetée, connexion) dans Firestore
 *  (collection "errorLogs"), avec l'identité du joueur (uid ou guestId).
 * ------------------------------------------------------------------------- */
initLogger(
  firestore,
  () => (auth.currentUser && auth.currentUser.uid)
        || (typeof localStorage !== 'undefined' && localStorage.getItem('guestId'))
        || null,
  'gitanerie-v11'
);

/* ---------------------------------------------------------------------------
 *  Présence / reconnexion en partie — activée dès qu'un utilisateur est
 *  authentifié (le token RTDB est alors disponible pour écrire "online").
 *  Lit la session dans localStorage → actif automatiquement sur les pages de jeu.
 * ------------------------------------------------------------------------- */
let _presenceInit = false;
onAuthStateChanged(auth, (user) => {
  if (user && !_presenceInit) {
    _presenceInit = true;
    initPresence(
      db,
      () => { try { return JSON.parse(localStorage.getItem('gameSession')); } catch { return null; } },
      logError
    );
  }
});

/* ---------------------------------------------------------------------------
 *  waitForAuth — avec filet de sécurité anti-blocage
 *  Si le réseau est mort au tout premier lancement, on ne reste jamais figé :
 *  on renvoie l'utilisateur déjà connu (cache), sinon null.
 * ------------------------------------------------------------------------- */
export function waitForAuth(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (user) => { if (!done) { done = true; resolve(user); } };
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); finish(user); });
    setTimeout(() => finish(auth.currentUser), timeoutMs);
  });
}

/* ---------------------------------------------------------------------------
 *  friendlyError — messages d'erreur compréhensibles (FR) pour les soucis réseau
 *  Usage dans tes pages : catch (e) { alert(friendlyError(e)); }
 * ------------------------------------------------------------------------- */
const ERROR_MESSAGES = {
  'auth/network-request-failed': "Connexion internet trop faible. Vérifie ta réception puis réessaie.",
  'auth/too-many-requests':      "Trop de tentatives. Attends quelques instants puis réessaie.",
  'auth/user-token-expired':     "Ta session a expiré. Reconnecte-toi.",
  'auth/invalid-credential':     "Identifiants invalides. Vérifie et réessaie.",
  'unavailable':        "Serveur injoignable (réseau instable). Nouvelle tentative en cours…",
  'deadline-exceeded':  "La connexion est très lente. On réessaie…",
  'permission-denied':  "Accès refusé. Reconnecte-toi et réessaie.",
  'failed-precondition':"Données hors-ligne indisponibles pour le moment.",
};
export function friendlyError(err) {
  // Toute erreur qui remonte à l'utilisateur est aussi enregistrée dans le journal.
  try { logError('friendlyError', err); } catch (_) {}
  const code = String((err && (err.code || err.message)) || '');
  for (const key in ERROR_MESSAGES) {
    if (code.includes(key)) return ERROR_MESSAGES[key];
  }
  // RTDB renvoie "permission_denied" / "PERMISSION_DENIED" (format différent de Firestore)
  if (/permission/i.test(code)) {
    return "Accès refusé par le serveur. Reconnecte-toi et réessaie.";
  }
  if (/network|fetch|timeout|offline|connexion|connection|unavailable|disconnect|unable/i.test(code)) {
    return "Problème de connexion. Vérifie ton réseau — on réessaie automatiquement.";
  }
  return "Une erreur est survenue. Réessaie dans un instant.";
}

/* ---------------------------------------------------------------------------
 *  withTimeout — abandonne une promesse qui traîne trop (réseau "pendu").
 *  On ne peut pas annuler une requête Firestore, mais on arrête de l'attendre
 *  et on peut retenter, au lieu de figer l'app indéfiniment.
 * ------------------------------------------------------------------------- */
export function withTimeout(promise, ms = 15000) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => {
      const e = new Error('deadline-exceeded'); e.code = 'deadline-exceeded'; reject(e);
    }, ms)),
  ]);
}

/* ---------------------------------------------------------------------------
 *  withRetry — retente une opération avec back-off exponentiel + jitter,
 *  ET un timeout par tentative. Objectif : sur la pire connexion, on insiste
 *  longtemps (jusqu'à ~8 tentatives) plutôt que d'échouer au 1er essai, et une
 *  requête pendue est coupée puis relancée. Plus lent, mais "ça finit par passer".
 *  Usage : await withRetry(() => getDoc(ref));
 * ------------------------------------------------------------------------- */
export async function withRetry(fn, { retries = 8, base = 500, max = 8000, attemptTimeout = 15000 } = {}) {
  let attempt = 0;
  for (;;) {
    try { return await withTimeout(Promise.resolve().then(fn), attemptTimeout); }
    catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const delay = Math.min(max, base * 2 ** (attempt - 1)) + Math.random() * 300;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/* ---------------------------------------------------------------------------
 *  Bannière d'état de connexion — automatique sur TOUTES les pages
 *  (toutes importent ce fichier), sans rien changer dans le HTML.
 *  Un "flash" au démarrage est évité par un anti-rebond de 3 s.
 * ------------------------------------------------------------------------- */
(function initConnectionBanner() {
  if (typeof document === 'undefined') return;

  const mount = () => {
    if (document.getElementById('gita-conn-banner')) return;

    const style = document.createElement('style');
    style.textContent = `
      #gita-conn-banner{position:fixed;top:0;left:0;right:0;z-index:2147483647;
        font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;
        text-align:center;padding:9px 12px;color:#fff;transform:translateY(-100%);
        transition:transform .25s ease;box-shadow:0 2px 10px rgba(0,0,0,.3)}
      #gita-conn-banner.show{transform:translateY(0)}
      #gita-conn-banner.offline{background:#c0392b}
      #gita-conn-banner.online{background:#27ae60}`;
    const bar = document.createElement('div');
    bar.id = 'gita-conn-banner';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    document.head.appendChild(style);
    document.body.appendChild(bar);

    let hideTimer = null;
    const paint = (msg, cls, autohide) => {
      bar.textContent = msg;
      bar.className = 'show ' + cls;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (autohide) hideTimer = setTimeout(() => { bar.className = cls; }, 2500);
    };

    let offlineTimer = null;
    let shownOffline = false;
    const goOffline = () => {
      if (offlineTimer || shownOffline) return;
      // anti-rebond : on n'affiche "perdu" que si ça dure > 3 s (évite le flash au boot)
      offlineTimer = setTimeout(() => {
        offlineTimer = null; shownOffline = true;
        paint("🔴 Connexion perdue — reconnexion en cours…", 'offline', false);
      }, 3000);
    };
    const goOnline = () => {
      if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
      if (shownOffline) { shownOffline = false; paint("🟢 Connexion rétablie", 'online', true); }
    };

    // Signal navigateur
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (!navigator.onLine) goOffline();

    // Signal Firebase (plus fiable que navigator.onLine pour l'accès serveur)
    try {
      onValue(dbRef(db, '.info/connected'), (snap) => {
        snap.val() === true ? goOnline() : goOffline();
      });
    } catch (_) { /* si RTDB indispo, on garde le signal navigateur */ }
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
