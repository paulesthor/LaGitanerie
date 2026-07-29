// =============================================
// LOGGER — journal d'erreurs centralisé (Firestore : collection "errorLogs")
// Best-effort : ne lève JAMAIS d'erreur lui-même, bufferise hors-ligne
// (localStorage) et flushe automatiquement au retour du réseau.
// Consultation : Console Firebase → Firestore → errorLogs (tri par createdAt).
// =============================================
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const BUFFER_KEY = 'gita_errorLogBuffer';
const MAX_BUFFER = 50;

let _db = null;
let _getUid = () => null;
let _appVersion = 'unknown';
let _flushing = false;
let _lastSig = '';
let _lastTime = 0;

function readBuffer() {
  try { return JSON.parse(localStorage.getItem(BUFFER_KEY)) || []; } catch { return []; }
}
function writeBuffer(arr) {
  try { localStorage.setItem(BUFFER_KEY, JSON.stringify(arr.slice(-MAX_BUFFER))); } catch {}
}

// Enregistre une erreur. `context` = d'où elle vient, `error` = l'objet erreur,
// `extra` = infos additionnelles (objet sérialisable).
export function logError(context, error, extra = {}) {
  try {
    const message = String((error && (error.message || error.code)) || error || '').slice(0, 800);
    // Anti-spam : on ignore les doublons stricts rapprochés (< 3 s) → évite les boucles.
    const sig = String(context) + '|' + message;
    const now = Date.now();
    if (sig === _lastSig && now - _lastTime < 3000) return;
    _lastSig = sig; _lastTime = now;

    const rec = {
      context: String(context || 'unknown').slice(0, 120),
      message,
      code: (error && error.code) ? String(error.code).slice(0, 80) : null,
      stack: (error && error.stack) ? String(error.stack).slice(0, 1500) : null,
      page: (typeof location !== 'undefined') ? (location.pathname + location.search) : null,
      online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
      netType: (typeof navigator !== 'undefined' && navigator.connection)
        ? (navigator.connection.effectiveType || null) : null,
      ua: (typeof navigator !== 'undefined') ? navigator.userAgent.slice(0, 300) : null,
      uid: null,
      ts: new Date().toISOString(),
      appVersion: _appVersion,
    };
    try { rec.uid = _getUid() || null; } catch {}
    try { rec.extra = JSON.parse(JSON.stringify(extra)); } catch { rec.extra = {}; }

    const buf = readBuffer();
    buf.push(rec);
    writeBuffer(buf);
    flush();
  } catch { /* le logger ne doit jamais casser l'app */ }
}

async function flush() {
  if (_flushing || !_db) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  _flushing = true;
  try {
    let buf = readBuffer();
    while (buf.length) {
      const rec = buf[0];
      try {
        await addDoc(collection(_db, 'errorLogs'), { ...rec, createdAt: serverTimestamp() });
        buf = readBuffer();      // relire (au cas où logError a ajouté entre-temps)
        buf.shift();
        writeBuffer(buf);
      } catch (_) {
        // hors-ligne / permission / réseau → on garde le buffer et on réessaiera
        break;
      }
    }
  } finally {
    _flushing = false;
  }
}

// Initialise le logger + installe les capteurs globaux. Appelé par firebase-config.js.
export function initLogger(db, getUid, appVersion) {
  _db = db;
  if (typeof getUid === 'function') _getUid = getUid;
  if (appVersion) _appVersion = appVersion;

  if (typeof window !== 'undefined' && !window.__gitaLoggerInstalled) {
    window.__gitaLoggerInstalled = true;

    // Erreurs JS non gérées
    window.addEventListener('error', (e) => {
      logError('window.onerror', e.error || { message: e.message },
        { filename: e.filename, line: e.lineno, col: e.colno });
    });
    // Promesses rejetées non gérées (fréquent avec les appels Firebase asynchrones)
    window.addEventListener('unhandledrejection', (e) => {
      logError('unhandledrejection', e.reason || { message: 'promise rejetée' });
    });
    // Re-flush dès que le réseau revient
    window.addEventListener('online', () => flush());

    // Accessible aux scripts inline des pages : window.__logError('contexte', err)
    window.__logError = logError;
  }

  flush(); // envoie ce qui restait d'une session précédente
}
