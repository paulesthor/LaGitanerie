// ══════════════════════════════════════════════════════════════════════
//  Contrôle d'âge
//
//  Écran NEUTRE : on demande une date de naissance, pas « as-tu 18 ans ? ».
//  Une question fermée dont la bonne réponse saute aux yeux ne vaut rien —
//  ni pour la classification de contenu des magasins, ni en pratique.
//
//  Script classique chargé dans le <head>, comme i18n.js : il doit décider
//  avant que le moindre contenu de jeu ne s'affiche.
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var KEY = 'gita_age_year';        // année de naissance validée
  var MIN_AGE = 18;

  function stored() {
    try { return parseInt(localStorage.getItem(KEY) || '', 10); } catch (e) { return NaN; }
  }
  function ageFrom(year, month) {
    var now = new Date();
    var a = now.getFullYear() - year;
    if (now.getMonth() + 1 < month) a--;
    return a;
  }

  var y = stored();
  if (Number.isFinite(y) && new Date().getFullYear() - y >= MIN_AGE) return;

  // Rien ne doit apparaître derrière la porte, pas même un instant.
  document.documentElement.classList.add('gita-gate');
  var st = document.createElement('style');
  st.textContent =
    '.gita-gate body > *:not(#gita-gate){visibility:hidden !important}' +
    '#gita-gate{position:fixed;inset:0;z-index:99999;background:#243242;color:#f2f2f2;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;' +
    'padding:32px 24px;text-align:center;font-family:Montserrat,system-ui,sans-serif}' +
    '#gita-gate h1{font-size:1.5rem;font-weight:700;line-height:1.3}' +
    '#gita-gate p{font-size:.92rem;color:#9fb0c4;max-width:320px;line-height:1.5}' +
    '#gita-gate .gg-row{display:flex;gap:10px;width:100%;max-width:300px}' +
    '#gita-gate select{flex:1;padding:14px 10px;font-size:1rem;font-family:inherit;border-radius:12px;' +
    'background:#1b2836;color:#f2f2f2;border:1px solid #35485e}' +
    '#gita-gate button{width:100%;max-width:300px;padding:16px;font-size:1rem;font-weight:700;' +
    'font-family:inherit;border:0;border-radius:12px;background:#e7912a;color:#1a1a1a;cursor:pointer}' +
    '#gita-gate button:disabled{opacity:.4}' +
    '#gita-gate .gg-deny{color:#e74c3c;font-weight:700}';
  (document.head || document.documentElement).appendChild(st);

  function T(k, fb) { return (window.t ? window.t(k) : null) || fb; }

  function build() {
    var box = document.createElement('div');
    box.id = 'gita-gate';

    var months = T('age.months', 'janvier,février,mars,avril,mai,juin,juillet,août,septembre,octobre,novembre,décembre').split(',');
    var thisYear = new Date().getFullYear();
    var opts = '<option value="">' + T('age.month', 'Mois') + '</option>';
    for (var m = 1; m <= 12; m++) opts += '<option value="' + m + '">' + months[m - 1] + '</option>';
    var yopts = '<option value="">' + T('age.year', 'Année') + '</option>';
    for (var yy = thisYear; yy >= thisYear - 100; yy--) yopts += '<option value="' + yy + '">' + yy + '</option>';

    box.innerHTML =
      '<div style="font-size:2.6rem">🍻</div>' +
      '<h1>' + T('age.title', 'Ta date de naissance') + '</h1>' +
      '<p>' + T('age.body', "La Gitanerie met en scène la consommation d'alcool et s'adresse aux personnes majeures.") + '</p>' +
      '<div class="gg-row"><select id="gg-m">' + opts + '</select><select id="gg-y">' + yopts + '</select></div>' +
      '<button id="gg-ok" disabled>' + T('age.confirm', 'Continuer') + '</button>' +
      '<p id="gg-msg" class="gg-deny" style="display:none"></p>';
    document.body.appendChild(box);

    var selM = box.querySelector('#gg-m'), selY = box.querySelector('#gg-y');
    var btn  = box.querySelector('#gg-ok'), msg = box.querySelector('#gg-msg');
    function refresh() { btn.disabled = !(selM.value && selY.value); }
    selM.onchange = refresh; selY.onchange = refresh;

    btn.onclick = function () {
      var age = ageFrom(parseInt(selY.value, 10), parseInt(selM.value, 10));
      if (age < MIN_AGE) {
        // Refus définitif pour cette session : on ne réaffiche pas le
        // formulaire, sinon il suffit de retenter avec une autre année.
        box.innerHTML = '<div style="font-size:2.6rem">🚫</div>' +
          '<h1>' + T('age.denied', 'Reviens dans quelques années') + '</h1>' +
          '<p>' + T('age.deniedBody', "Cette application s'adresse aux personnes majeures.") + '</p>';
        return;
      }
      try { localStorage.setItem(KEY, String(selY.value)); } catch (e) {}
      box.remove();
      document.documentElement.classList.remove('gita-gate');
      window.dispatchEvent(new Event('gita:ageok'));
    };
    msg.style.display = 'none';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
