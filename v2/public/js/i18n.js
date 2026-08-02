// ── Traduction de l'interface (fr / en / it / es) ──────────────────────────
// Script classique (pas un module) chargé dans le <head> de chaque page : il
// doit s'exécuter avant le premier rendu pour qu'aucun texte français
// n'apparaisse une fraction de seconde dans une autre langue.
//
// Balisage : data-i18n="clé" remplace le texte, data-i18n-html="clé" le HTML,
// data-i18n-ph / -title / -aria remplacent l'attribut correspondant.
// Côté JS : window.t('clé', {n: 3}) — les {variables} sont substituées.
(function () {
  'use strict';

  const LANGS = ['fr', 'en', 'it', 'es'];
  const LANG_NAMES = { fr: 'Français', en: 'English', it: 'Italiano', es: 'Español' };
  const LANG_FLAGS = { fr: '🇫🇷', en: '🇬🇧', it: '🇮🇹', es: '🇪🇸' };

  const DICT = {
    fr: {
      // ── Commun ──
      'app.name': 'La Gitanerie',
      'common.back': 'Retour',
      'common.close': 'Fermer',
      'common.cancel': 'Annuler',
      'common.save': 'Sauvegarder',
      'common.copy': 'Copier',
      'common.copied': 'Copié !',
      'common.none': 'Aucun',
      'common.remove': 'Retirer',
      'common.edit': 'Modifier',
      'common.login': 'Connexion',
      'common.guest': 'Invité',
      'common.level': 'Niveau',
      'common.levelShort': 'Niv.',
      'common.add': 'Ajouter',
      'common.validate': 'Valider',
      'common.loading': 'Chargement…',

      // ── Onglets ──
      'tab.home': 'Accueil',
      'tab.profile': 'Profil',
      'tab.stats': 'Stats',
      'tab.friends': 'Amis',
      'tab.settings': 'Réglages',

      // ── Accueil ──
      'home.tagline': 'Choisis ton poison',
      'home.pyramid': 'La Pyramide',
      'home.pyramidDesc': 'Cartes, gorgées et mensonges. Le classique des gitans.',
      'home.wolf': 'Chien Garou de tierce endroit',
      'home.wolfNote': "(deso j'avais pas les droits pour le vrai nom)",
      'home.wolfDesc': 'Une seule nuit, un seul vote. Démasquez les loups… ou survivez.',
      'home.disclaimer': "L'abus d'alcool est recommandé par les collègues.",

      // ── Profil ──
      'profile.title': 'Profil',
      'profile.guestMode': 'Mode invité',
      'profile.guestDesc': 'Connecte-toi pour sauvegarder ton XP et tes stats.',
      'profile.xp': 'XP :',
      'profile.forLevel': 'pour Niv.',
      'profile.xpRule': '+10 XP par partie jouée · +1 XP par gorgée donnée · −1 XP par gorgée bue',
      'profile.playerName': 'Nom de joueur',
      'profile.photo': 'Photo de profil',
      'profile.takePhoto': 'Prendre / Choisir',
      'profile.deletePhoto': 'Supprimer la photo',
      'profile.orEmoji': 'Ou choisis un emoji',
      'profile.myTitles': 'Mes titres',
      'profile.titleHint': "Le titre équipé s'affiche à côté de ton pseudo.",
      'profile.myBadges': 'Mes badges',
      'profile.badgeShown': 'Badge affiché en jeu',
      'profile.frame': 'Cadre de profil',
      'profile.frameHint': 'Les cadres se débloquent par niveau. Niv. 5 Bronze · Niv. 10 Argent · Niv. 20 Or · Niv. 30 Légende',
      'profile.testTools': 'Outils de test',
      'profile.testHint': 'Réservé à ton compte. « Tout débloquer » monte aussi le niveau à 30 pour dévoiler les cadres.',
      'profile.unlockAll': 'Tout débloquer',
      'profile.removeAll': 'Tout retirer',

      // ── Stats ──
      'stats.title': 'Statistiques',
      'stats.yourRecord': 'Ton bilan',
      'stats.loginPrompt': 'Connecte-toi',
      'stats.loginDesc': 'Tes statistiques apparaîtront ici une fois connecté.',

      // ── Amis ──
      'friends.title': 'Mes amis',
      'friends.yourCode': "Ton code d'ami",
      'friends.qrHint': "Fais scanner ce QR à un ami (photo du téléphone) pour qu'il t'ajoute.",
      'friends.addByCode': 'Ajouter un ami par son code',
      'friends.codePh': "Code d'ami",
      'friends.scanQr': "Scanner le QR d'un ami",
      'friends.scanTitle': 'Scanne le QR de ton ami',
      'friends.loginPrompt': 'Connecte-toi',
      'friends.loginDesc': 'Ajoute des amis et rejoins leurs parties en un tap.',

      // ── Réglages ──
      'settings.title': 'Réglages',
      'settings.haptics': 'Vibrations',
      'settings.hapticsDesc': 'Retour haptique sur les boutons et en jeu (Android).',
      'settings.language': 'Langue',
      'settings.logout': 'Se déconnecter',
      'settings.build': 'La Gitanerie · build',
    },

    en: {
      'app.name': 'La Gitanerie',
      'common.back': 'Back',
      'common.close': 'Close',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.copy': 'Copy',
      'common.copied': 'Copied!',
      'common.none': 'None',
      'common.remove': 'Remove',
      'common.edit': 'Edit',
      'common.login': 'Log in',
      'common.guest': 'Guest',
      'common.level': 'Level',
      'common.levelShort': 'Lv.',
      'common.add': 'Add',
      'common.validate': 'Confirm',
      'common.loading': 'Loading…',

      'tab.home': 'Home',
      'tab.profile': 'Profile',
      'tab.stats': 'Stats',
      'tab.friends': 'Friends',
      'tab.settings': 'Settings',

      'home.tagline': 'Pick your poison',
      'home.pyramid': 'The Pyramid',
      'home.pyramidDesc': 'Cards, sips and lies. The gypsy classic.',
      'home.wolf': 'Werewolf of Some Other Village',
      'home.wolfNote': "(sorry, didn't have the rights to the real name)",
      'home.wolfDesc': 'One night, one vote. Unmask the wolves… or survive.',
      'home.disclaimer': 'Alcohol abuse is recommended by your mates.',

      'profile.title': 'Profile',
      'profile.guestMode': 'Guest mode',
      'profile.guestDesc': 'Log in to save your XP and stats.',
      'profile.xp': 'XP:',
      'profile.forLevel': 'to reach Lv.',
      'profile.xpRule': '+10 XP per game played · +1 XP per sip given · −1 XP per sip drunk',
      'profile.playerName': 'Player name',
      'profile.photo': 'Profile picture',
      'profile.takePhoto': 'Take / Choose',
      'profile.deletePhoto': 'Delete photo',
      'profile.orEmoji': 'Or pick an emoji',
      'profile.myTitles': 'My titles',
      'profile.titleHint': 'The equipped title shows next to your name.',
      'profile.myBadges': 'My badges',
      'profile.badgeShown': 'Badge shown in game',
      'profile.frame': 'Profile frame',
      'profile.frameHint': 'Frames unlock with your level. Lv. 5 Bronze · Lv. 10 Silver · Lv. 20 Gold · Lv. 30 Legend',
      'profile.testTools': 'Test tools',
      'profile.testHint': 'Restricted to your account. "Unlock everything" also sets your level to 30 to reveal the frames.',
      'profile.unlockAll': 'Unlock everything',
      'profile.removeAll': 'Remove everything',

      'stats.title': 'Statistics',
      'stats.yourRecord': 'Your record',
      'stats.loginPrompt': 'Log in',
      'stats.loginDesc': 'Your statistics will appear here once you are logged in.',

      'friends.title': 'My friends',
      'friends.yourCode': 'Your friend code',
      'friends.qrHint': 'Have a friend scan this QR code (with their phone camera) to add you.',
      'friends.addByCode': 'Add a friend by code',
      'friends.codePh': 'Friend code',
      'friends.scanQr': "Scan a friend's QR code",
      'friends.scanTitle': "Scan your friend's QR code",
      'friends.loginPrompt': 'Log in',
      'friends.loginDesc': 'Add friends and join their games with one tap.',

      'settings.title': 'Settings',
      'settings.haptics': 'Vibration',
      'settings.hapticsDesc': 'Haptic feedback on buttons and in game (Android).',
      'settings.language': 'Language',
      'settings.logout': 'Log out',
      'settings.build': 'La Gitanerie · build',
    },

    it: {
      'app.name': 'La Gitanerie',
      'common.back': 'Indietro',
      'common.close': 'Chiudi',
      'common.cancel': 'Annulla',
      'common.save': 'Salva',
      'common.copy': 'Copia',
      'common.copied': 'Copiato!',
      'common.none': 'Nessuno',
      'common.remove': 'Rimuovi',
      'common.edit': 'Modifica',
      'common.login': 'Accedi',
      'common.guest': 'Ospite',
      'common.level': 'Livello',
      'common.levelShort': 'Liv.',
      'common.add': 'Aggiungi',
      'common.validate': 'Conferma',
      'common.loading': 'Caricamento…',

      'tab.home': 'Home',
      'tab.profile': 'Profilo',
      'tab.stats': 'Statistiche',
      'tab.friends': 'Amici',
      'tab.settings': 'Impostazioni',

      'home.tagline': 'Scegli il tuo veleno',
      'home.pyramid': 'La Piramide',
      'home.pyramidDesc': 'Carte, sorsi e bugie. Il classico dei gitani.',
      'home.wolf': 'Lupo Mannaro di un altro paese',
      'home.wolfNote': '(scusa, non avevo i diritti sul nome vero)',
      'home.wolfDesc': 'Una sola notte, un solo voto. Smascherate i lupi… o sopravvivete.',
      'home.disclaimer': "L'abuso di alcol è raccomandato dai colleghi.",

      'profile.title': 'Profilo',
      'profile.guestMode': 'Modalità ospite',
      'profile.guestDesc': 'Accedi per salvare i tuoi XP e le tue statistiche.',
      'profile.xp': 'XP:',
      'profile.forLevel': 'per il Liv.',
      'profile.xpRule': '+10 XP per partita giocata · +1 XP per sorso dato · −1 XP per sorso bevuto',
      'profile.playerName': 'Nome giocatore',
      'profile.photo': 'Foto del profilo',
      'profile.takePhoto': 'Scatta / Scegli',
      'profile.deletePhoto': 'Elimina la foto',
      'profile.orEmoji': 'Oppure scegli un emoji',
      'profile.myTitles': 'I miei titoli',
      'profile.titleHint': 'Il titolo equipaggiato appare accanto al tuo nome.',
      'profile.myBadges': 'I miei distintivi',
      'profile.badgeShown': 'Distintivo mostrato in partita',
      'profile.frame': 'Cornice del profilo',
      'profile.frameHint': 'Le cornici si sbloccano con il livello. Liv. 5 Bronzo · Liv. 10 Argento · Liv. 20 Oro · Liv. 30 Leggenda',
      'profile.testTools': 'Strumenti di test',
      'profile.testHint': 'Riservato al tuo account. «Sblocca tutto» porta anche il livello a 30 per svelare le cornici.',
      'profile.unlockAll': 'Sblocca tutto',
      'profile.removeAll': 'Rimuovi tutto',

      'stats.title': 'Statistiche',
      'stats.yourRecord': 'Il tuo bilancio',
      'stats.loginPrompt': 'Accedi',
      'stats.loginDesc': 'Le tue statistiche appariranno qui una volta effettuato l\'accesso.',

      'friends.title': 'I miei amici',
      'friends.yourCode': 'Il tuo codice amico',
      'friends.qrHint': 'Fai scansionare questo QR a un amico (con la fotocamera) per farti aggiungere.',
      'friends.addByCode': 'Aggiungi un amico con il codice',
      'friends.codePh': 'Codice amico',
      'friends.scanQr': 'Scansiona il QR di un amico',
      'friends.scanTitle': "Scansiona il QR del tuo amico",
      'friends.loginPrompt': 'Accedi',
      'friends.loginDesc': 'Aggiungi amici e unisciti alle loro partite con un tocco.',

      'settings.title': 'Impostazioni',
      'settings.haptics': 'Vibrazione',
      'settings.hapticsDesc': 'Feedback aptico sui pulsanti e in partita (Android).',
      'settings.language': 'Lingua',
      'settings.logout': 'Esci',
      'settings.build': 'La Gitanerie · build',
    },

    es: {
      'app.name': 'La Gitanerie',
      'common.back': 'Volver',
      'common.close': 'Cerrar',
      'common.cancel': 'Cancelar',
      'common.save': 'Guardar',
      'common.copy': 'Copiar',
      'common.copied': '¡Copiado!',
      'common.none': 'Ninguno',
      'common.remove': 'Quitar',
      'common.edit': 'Editar',
      'common.login': 'Iniciar sesión',
      'common.guest': 'Invitado',
      'common.level': 'Nivel',
      'common.levelShort': 'Niv.',
      'common.add': 'Añadir',
      'common.validate': 'Confirmar',
      'common.loading': 'Cargando…',

      'tab.home': 'Inicio',
      'tab.profile': 'Perfil',
      'tab.stats': 'Estadísticas',
      'tab.friends': 'Amigos',
      'tab.settings': 'Ajustes',

      'home.tagline': 'Elige tu veneno',
      'home.pyramid': 'La Pirámide',
      'home.pyramidDesc': 'Cartas, tragos y mentiras. El clásico de los gitanos.',
      'home.wolf': 'Hombre Lobo de otro pueblo',
      'home.wolfNote': '(perdón, no tenía los derechos del nombre real)',
      'home.wolfDesc': 'Una sola noche, un solo voto. Desenmascarad a los lobos… o sobrevivid.',
      'home.disclaimer': 'El abuso de alcohol está recomendado por los colegas.',

      'profile.title': 'Perfil',
      'profile.guestMode': 'Modo invitado',
      'profile.guestDesc': 'Inicia sesión para guardar tu XP y tus estadísticas.',
      'profile.xp': 'XP:',
      'profile.forLevel': 'para Niv.',
      'profile.xpRule': '+10 XP por partida jugada · +1 XP por trago dado · −1 XP por trago bebido',
      'profile.playerName': 'Nombre de jugador',
      'profile.photo': 'Foto de perfil',
      'profile.takePhoto': 'Hacer / Elegir',
      'profile.deletePhoto': 'Eliminar la foto',
      'profile.orEmoji': 'O elige un emoji',
      'profile.myTitles': 'Mis títulos',
      'profile.titleHint': 'El título equipado aparece junto a tu nombre.',
      'profile.myBadges': 'Mis insignias',
      'profile.badgeShown': 'Insignia mostrada en partida',
      'profile.frame': 'Marco de perfil',
      'profile.frameHint': 'Los marcos se desbloquean por nivel. Niv. 5 Bronce · Niv. 10 Plata · Niv. 20 Oro · Niv. 30 Leyenda',
      'profile.testTools': 'Herramientas de prueba',
      'profile.testHint': 'Reservado a tu cuenta. «Desbloquear todo» también sube el nivel a 30 para revelar los marcos.',
      'profile.unlockAll': 'Desbloquear todo',
      'profile.removeAll': 'Quitar todo',

      'stats.title': 'Estadísticas',
      'stats.yourRecord': 'Tu balance',
      'stats.loginPrompt': 'Inicia sesión',
      'stats.loginDesc': 'Tus estadísticas aparecerán aquí cuando inicies sesión.',

      'friends.title': 'Mis amigos',
      'friends.yourCode': 'Tu código de amigo',
      'friends.qrHint': 'Haz que un amigo escanee este QR (con la cámara) para que te añada.',
      'friends.addByCode': 'Añadir un amigo por su código',
      'friends.codePh': 'Código de amigo',
      'friends.scanQr': 'Escanear el QR de un amigo',
      'friends.scanTitle': 'Escanea el QR de tu amigo',
      'friends.loginPrompt': 'Inicia sesión',
      'friends.loginDesc': 'Añade amigos y únete a sus partidas con un toque.',

      'settings.title': 'Ajustes',
      'settings.haptics': 'Vibración',
      'settings.hapticsDesc': 'Respuesta háptica en los botones y en partida (Android).',
      'settings.language': 'Idioma',
      'settings.logout': 'Cerrar sesión',
      'settings.build': 'La Gitanerie · build',
    },
  };

  // ── Langue courante ──
  // Priorité : choix explicite mémorisé, puis langue du téléphone, puis français.
  function detect() {
    try {
      const saved = localStorage.getItem('gita_lang');
      if (saved && LANGS.includes(saved)) return saved;
    } catch (e) {}
    const nav = (navigator.languages || [navigator.language || 'fr'])[0] || 'fr';
    const short = String(nav).slice(0, 2).toLowerCase();
    return LANGS.includes(short) ? short : 'fr';
  }

  let lang = detect();

  // Traduction d'une clé. Repli sur le français puis sur la clé elle-même :
  // une traduction manquante affiche du français, jamais une chaîne technique.
  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]);
    if (s === undefined) s = (DICT.fr[key] !== undefined ? DICT.fr[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }

  // Applique les traductions au balisage. Appelable sur un fragment fraîchement
  // injecté : apply(monElement).
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    document.documentElement.lang = lang;
  }

  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem('gita_lang', next); } catch (e) {}
    apply();
    // Les écrans qui construisent du texte en JS se re-rendent sur cet
    // événement plutôt que de recharger la page.
    window.dispatchEvent(new CustomEvent('gita:langchange', { detail: { lang: next } }));
  }

  window.I18N = {
    t, apply, setLang,
    langs: LANGS, names: LANG_NAMES, flags: LANG_FLAGS,
    get lang() { return lang; },
  };
  window.t = t;

  // Application au plus tôt : dès que le corps du document est analysable.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }
})();
