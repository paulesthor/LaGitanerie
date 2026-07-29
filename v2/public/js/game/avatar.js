// =============================================
// AVATAR — compression photo et rendu
// =============================================

// Compresse une image File en base64 JPEG 150x150
export function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // 128px q0.62 : ~3-4 Ko en base64 (vs ~8-13 Ko avant) — payload bien
        // plus léger sur mauvais réseau, tout en restant net pour des vignettes.
        const SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');

        // Crop carré centré
        const min  = Math.min(img.width, img.height);
        const sx   = (img.width  - min) / 2;
        const sy   = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);

        resolve(canvas.toDataURL('image/jpeg', 0.62));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Retourne true si l'avatar est une photo (base64 OU url Storage) plutôt qu'un emoji
export function isPhotoAvatar(avatar) {
  return !!avatar && (avatar.startsWith('data:') || avatar.startsWith('http'));
}

// Génère le HTML d'un avatar (img ou emoji), avec bordure optionnelle
export function avatarHTML(avatar, size = 44, borderClass = '') {
  const s = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;`;
  let inner;
  if (isPhotoAvatar(avatar)) {
    inner = `<img src="${avatar}" loading="lazy" style="${s}object-fit:cover;display:block;">`;
  } else {
    const fs = Math.round(size * 0.52);
    inner = `<div style="${s}background:var(--bg-surface);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:${fs}px;">${avatar || '?'}</div>`;
  }
  if (borderClass) {
    return `<div class="avatar-framed ${borderClass}" style="flex-shrink:0">${inner}</div>`;
  }
  return inner;
}

// Retourne le style inline pour le dos d'une carte (photo en fond ou vide)
export function cardBackStyle(avatar) {
  if (isPhotoAvatar(avatar)) {
    return `style="background-image:url('${avatar}');background-size:cover;background-position:center;"`;
  }
  return '';
}
