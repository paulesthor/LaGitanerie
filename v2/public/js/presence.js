// =============================================
// PRESENCE / RECONNEXION — gère l'état "online" du joueur pendant une partie.
// Générique : lit la session (gameId/playerId) dans localStorage, donc ACTIF
// sur toutes les pages de jeu sans avoir à les modifier.
//   - onDisconnect : le serveur passe le joueur "online:false" s'il se coupe
//     (métro, tunnel, appli en arrière-plan…) → les autres le voient hors-ligne.
//   - .info/connected : à la reconnexion, on re-marque "online:true" et on
//     ré-arme le onDisconnect. Le RTDB re-synchronise l'état du jeu tout seul
//     via les onValue déjà présents dans les pages.
// =============================================
import {
  ref, onValue, onDisconnect, set
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let _installed = false;

export function initPresence(db, getSession, logError) {
  if (_installed) return;          // une seule installation par page
  _installed = true;
  try {
    const session = getSession && getSession();
    if (!session || !session.gameId || !session.playerId) return; // pas dans une partie

    const { gameId, playerId } = session;
    // ns = espace de noms du jeu ('games' pour la Pyramide, 'loupGames' pour le Loup-Garou)
    const ns = session.ns || 'games';
    const onlineRef = ref(db, `${ns}/${gameId}/players/${playerId}/online`);
    const connRef   = ref(db, '.info/connected');

    onValue(connRef, (snap) => {
      // déconnecté : rien à faire ici, le onDisconnect (côté serveur) bascule offline
      if (snap.val() !== true) return;
      // (re)connecté : ré-armer la bascule offline PUIS se marquer online
      onDisconnect(onlineRef).set(false)
        .then(() => set(onlineRef, true))
        .catch((e) => { try { logError && logError('presence', e); } catch (_) {} });
    });
  } catch (e) {
    try { logError && logError('presence.init', e); } catch (_) {}
  }
}
