// =============================================
// LOUP-GAROU POUR UNE NUIT — définitions partagées
// (réutilisé par le lobby, la salle d'attente et le futur moteur de nuit)
// =============================================

// Rôles disponibles. `max` = nb de cartes de ce rôle qu'on peut mettre.
// `team` : 'loup' | 'village' | 'solo'.  `night` : agit pendant la nuit ?
export const LOUP_ROLES = [
  { id:'loup',        name:'Loup-Garou',          emoji:'🐺', team:'loup',    max:5, def:2, night:true,  desc:'Se reconnaissent entre eux. Loup solitaire : voit 1 carte du centre.' },
  { id:'sbire',       name:'Sbire',               emoji:'😈', team:'loup',    max:1, def:0, night:true,  desc:'Voit les loups (eux ne le connaissent pas). Camp des loups.' },
  { id:'macon',       name:'Franc-Maçon',         emoji:'🧱', team:'village', max:2, def:0, night:true,  desc:'Les maçons se reconnaissent (0 ou 2).' },
  { id:'voyante',     name:'Voyante',             emoji:'🔮', team:'village', max:1, def:1, night:true,  desc:'Regarde 1 carte d’un joueur OU 2 cartes du centre.' },
  { id:'voleur',      name:'Voleur',              emoji:'🥷', team:'village', max:1, def:1, night:true,  desc:'Échange sa carte avec un joueur puis la regarde.' },
  { id:'fauteur',     name:'Fauteur de troubles', emoji:'🌀', team:'village', max:1, def:1, night:true,  desc:'Échange les cartes de 2 autres joueurs (sans regarder).' },
  { id:'soulard',     name:'Soûlard',             emoji:'🍺', team:'village', max:1, def:0, night:true,  desc:'Échange sa carte avec une du centre (sans la voir).' },
  { id:'insomniaque', name:'Insomniaque',         emoji:'👁️', team:'village', max:1, def:0, night:true,  desc:'Regarde sa propre carte en fin de nuit.' },
  { id:'chasseur',    name:'Chasseur',            emoji:'🎯', team:'village', max:1, def:0, night:false, desc:'S’il meurt, celui qu’il pointe meurt aussi.' },
  { id:'tanneur',     name:'Tanneur',             emoji:'💀', team:'solo',    max:1, def:0, night:false, desc:'Gagne UNIQUEMENT s’il se fait lyncher.' },
  { id:'sosie',       name:'Sosie',               emoji:'🎭', team:'village', max:1, def:0, night:true,  desc:'Regarde la carte d’un joueur et devient ce rôle.' },
  { id:'villageois',  name:'Villageois',          emoji:'🧑‍🌾', team:'village', max:5, def:1, night:false, desc:'Aucun pouvoir. Doit démasquer les loups.' },
];

// Ordre de réveil de la nuit
// ── Libellés traduits ──────────────────────────────────────
// Le catalogue reste en français (source de vérité) ; roleName/roleDesc
// cherchent 'loup.role.<id>.name' et retombent sur le français si absent.
function tr(key, fallback) {
  if (!window.t) return fallback;
  const v = window.t(key);
  return v === key ? fallback : v;
}
export const roleName = (r) => (r ? tr(`loup.role.${r.id}.name`, r.name) : '');
export const roleDesc = (r) => (r ? tr(`loup.role.${r.id}.desc`, r.desc) : '');

export const NIGHT_ORDER = ['sosie','loup','sbire','macon','voyante','voleur','fauteur','soulard','insomniaque'];

export const ROLE_BY_ID = Object.fromEntries(LOUP_ROLES.map(r => [r.id, r]));

// Config par défaut { roleId: nombre }
export function defaultRoles() {
  const o = {};
  for (const r of LOUP_ROLES) o[r.id] = r.def;
  return o;
}

// Nombre total de cartes sélectionnées
export function totalCards(roles) {
  return Object.values(roles || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

// Au Loup-Garou pour une nuit : cartes = joueurs + 3
export function targetCards(numPlayers) {
  return numPlayers + 3;
}
