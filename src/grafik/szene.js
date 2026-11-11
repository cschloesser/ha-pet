// Szene: Vorratsgrenze, Heuhaufen, Gras, Aussichtsstein, Blume, Futter, Symbole der Statusleiste, Häufchen,
// Kehrschaufel

import { rnd } from '../logik/hilfen.js';
import { flowerMid } from '../logik/wetter.js';

// So viele eingesammelte Blüten bleiben liegen (Heuhaufen oder Nische), die älteste macht Platz
const STASH_MAX = 12;

const HAY_SVG = `
  <svg viewBox="0 0 60 40" aria-hidden="true">
    <path d="M2 40 Q3 15 30 10 Q57 15 58 40Z" fill="#dcbc6a" stroke="#a9853a" stroke-width="1.4"/>
    <g stroke="#b38c3c" stroke-width="1.1" stroke-linecap="round" fill="none">
      <path d="M12 34 Q18 24 26 20"/><path d="M22 37 Q30 27 40 22"/><path d="M38 36 Q44 30 50 28"/>
      <path d="M28 10 Q26 4 21 2"/><path d="M33 11 Q37 5 43 4"/><path d="M8 26 Q14 20 18 18"/>
    </g>
    <g class="hayb"></g>
  </svg>`;

// Grasstreifen über die ganze Breite: Boden (soil, Wiesenfarbe) ab y 9 = Bodenlinie, davor Halme in
// Büscheln, damit Stiele, Pfosten, Steine und Heu unten im Gras verschwinden
const TUFTS_SVG = () => {
  let d = '';
  for (let x = 0; x < 400; x += rnd(1.6, 3.2)) {
    const tall = Math.sin(x * 0.11) + Math.sin(x * 0.037) > 0.6; // Büschel
    const h = tall ? rnd(5, 9) : rnd(2, 5);
    const tip = x + 1.1 + rnd(-1.4, 1.4);
    d += `M${x.toFixed(1)} 10.5 Q${(x + 0.5).toFixed(1)} ${(10.5 - h / 2).toFixed(1)} ${tip.toFixed(1)} ${(10.5 - h).toFixed(1)}`
      + ` Q${(x + 1.5).toFixed(1)} ${(10.5 - h / 2).toFixed(1)} ${(x + 2.3).toFixed(1)} 10.5Z`;
  }
  return `<svg viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true">`
    + `<rect class="soil" y="9" width="400" height="3"/><path class="blades" d="${d}"/></svg>`;
};

// Aussichtsstein mit Geröll: von oben pfeift er, wie echte Pikas. Boden bei y 46, flache Oberseite bei y 13.
const LOOKOUT_SVG = `
  <svg viewBox="0 0 100 50" aria-hidden="true">
    <g stroke="#5c6166" stroke-width="1.2" transform="translate(0 -1.6)">
      <path d="M-14 47.5 L-12 40 L-4 37.5 L3 40 L4 47.5Z" fill="#8e949b" stroke-linejoin="round"/>
      <ellipse cx="-22" cy="47.6" rx="2.4" ry="1.5" fill="#9aa0a6"/><ellipse cx="-17.5" cy="46.8" rx="3.6" ry="2.2" fill="#b0b5ba"/>
      <ellipse cx="104" cy="46.2" rx="5" ry="3" fill="#a3a9ae"/><ellipse cx="111" cy="47.4" rx="3.2" ry="1.9" fill="#979da4"/>
      <ellipse cx="116.5" cy="47.9" rx="2" ry="1.3" fill="#b0b5ba"/>
    </g>
    <path d="M6 47 L10 27 Q13 16 28 13.5 L72 12.5 Q87 13.5 91 25 L95 47Z" fill="#a3a9ae" stroke="#5c6166" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M91 25 L95 47 L70 47 Q80 36 91 25Z" fill="#000" opacity=".1"/>
    <path d="M28 15.5 Q48 13.6 70 14.4" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path class="rock-snow" d="M26 14 L74 13 Q86 14 89 21 Q80 17.5 70 18 Q50 16.5 30 18 Q20 18 13 22 Q16 15 26 14Z" fill="#f2f6f9"/>
    <path d="M42 24 l4 6 l-2 6 M70 30 l-3 5" stroke="#5c6166" stroke-width="1" fill="none" stroke-linecap="round" opacity=".7"/>
    <g fill="#c9c86a" opacity=".8"><ellipse cx="22" cy="30" rx="2.6" ry="1.3"/><ellipse cx="80" cy="22" rx="2" ry="1"/></g>
    <g stroke="#5c6166" stroke-width="1.2" transform="translate(0 -1.6)">
      <ellipse cx="4" cy="45" rx="6" ry="3.6" fill="#979da4"/><ellipse cx="13" cy="47" rx="4.5" ry="2.6" fill="#b0b5ba"/>
      <ellipse cx="-6" cy="47.2" rx="4" ry="2.4" fill="#a3a9ae"/><ellipse cx="20" cy="48.2" rx="2.4" ry="1.4" fill="#9aa0a6"/>
      <ellipse cx="96" cy="45.5" rx="6.5" ry="3.8" fill="#8e949b"/><ellipse cx="86" cy="47.2" rx="4" ry="2.4" fill="#a3a9ae"/>
      <ellipse cx="79" cy="48.2" rx="2.4" ry="1.4" fill="#b0b5ba"/>
      <ellipse cx="34" cy="47.6" rx="3.2" ry="1.8" fill="#9aa0a6"/><ellipse cx="64" cy="47.8" rx="3.6" ry="1.9" fill="#b0b5ba"/>
      <ellipse cx="50" cy="48" rx="2.2" ry="1.4" fill="#979da4"/><ellipse cx="27" cy="48.4" rx="1.8" ry="1.1" fill="#b0b5ba"/>
      <ellipse cx="71" cy="48.5" rx="1.8" ry="1.1" fill="#979da4"/>
    </g>
    <path class="rtuft" d="M18 49 Q19 44 20 42 Q21 45 22 49Z M24 49 Q25 45 27 43.5 Q26.5 46 27 49Z M74 49 Q75 44.5 76.5 42.5 Q77 46 78 49Z M79 49 Q80.5 45.5 82 44.5 Q81.5 47 82 49Z M40 49 Q41 46 42.5 45 Q42 47 43 49Z"/>
  </svg>`;

// Farben als Variablen mit dem Tageswert als Rückfall: --fc (Blüte) und --fm (Mitte) setzt _flowerTint je Blume,
// --fst (Stiel) und --flf (Blatt) an der Ebene, alle fertig beleuchtet (Jahreszeit, Dämmerung, Wetter).
const FLOWER_SVG = (c) => `
  <svg viewBox="0 0 20 30" aria-hidden="true">
    <path d="M10 30 Q9 20 10 11" stroke="var(--fst, #4f8a3a)" stroke-width="1.6" fill="none"/>
    <ellipse cx="6.5" cy="22" rx="3.6" ry="1.5" fill="var(--flf, #6bab4c)" transform="rotate(-30 6.5 22)"/>
    <g fill="var(--fc, ${c})" stroke="rgba(0,0,0,.12)" stroke-width=".5">
      ${[0, 72, 144, 216, 288].map((a) => {
      const r = (a * Math.PI) / 180;
      return `<circle cx="${(10 + Math.sin(r) * 3.7).toFixed(2)}" cy="${(9 - Math.cos(r) * 3.7).toFixed(2)}" r="3.3"/>`;
    }).join('')}
    </g>
    <circle cx="10" cy="9" r="2.3" fill="var(--fm, ${flowerMid(c)})"/>
  </svg>`;

// Ein Maulvoll Heu (Heu-Snack am Haufen), gleiche Größe wie die Leckerli aus den Päckchen (24 × 24)
const HAY_BITE = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-linecap="round">
    <path d="M2 13.5 L21 9 M3 17 L22 13.5 M4.5 10 L20 17.5" stroke="#b8963f" stroke-width="2.6"/>
    <path d="M2 13.5 L21 9 M3 17 L22 13.5 M4.5 10 L20 17.5 M6 19.5 L18.5 7" stroke="#dcbc6a" stroke-width="1.6"/>
    <path d="M5 15 L19 11.6" stroke="#f0d98e" stroke-width="1"/></g></svg>`;
const FOOD = {
  lz: {
    color: '#f7cf2e',
    svg: `<svg viewBox="0 0 30 40" aria-hidden="true">
        <path d="M15 40 Q14 28 15 16" stroke="#4f8a3a" stroke-width="2" fill="none"/>
        <path d="M14 39 Q4 36 3 26 Q8 30 10 28 Q7 33 14 37Z" fill="#5fa548"/>
        <path d="M16 39 Q27 36 27 27 Q22 31 20 29 Q23 34 16 37Z" fill="#6bb152"/>
        <circle cx="15" cy="12" r="9" fill="none" stroke="#f7cf2e" stroke-width="3.2" stroke-dasharray="1.7 1.1"/>
        <circle cx="15" cy="12" r="7.2" fill="#f7cf2e"/>
        <circle cx="15" cy="12" r="3.2" fill="#eeac1c"/>
      </svg>`,
  },
  klee: {
    color: '#e57fb0',
    svg: `<svg viewBox="0 0 30 40" aria-hidden="true">
        <path d="M15 40 Q15 30 15 18" stroke="#4f8a3a" stroke-width="2" fill="none"/>
        <g fill="#5fae4a" stroke="#3f7f31" stroke-width=".8">
          <ellipse cx="9" cy="31" rx="4" ry="3"/><ellipse cx="21" cy="31" rx="4" ry="3"/><ellipse cx="15" cy="27" rx="3" ry="4"/>
        </g>
        <ellipse cx="15" cy="12" rx="7.5" ry="8.5" fill="#e57fb0" stroke="#c45c90" stroke-width="1"/>
        <g stroke="#c45c90" stroke-width=".9" fill="none" stroke-linecap="round">
          <path d="M11 8 l1.5 2.5 M15 6 v3 M19 8 l-1.5 2.5 M10.5 13 l2 1.5 M19.5 13 l-2 1.5 M15 12 v3"/>
        </g>
      </svg>`,
  },
};

const ICON_LEAF = `<svg viewBox="0 0 24 24"><path fill="#6bb152" d="M17 8C8 10 5.9 16.2 3.8 21.3l1.9.7 1-2.3c.5.2 1 .3 1.3.3C19 20 22 3 22 3c-1 2-8 2.3-13 3.3S2 11.5 2 13.5s1.8 3.8 1.8 3.8C7 8 17 8 17 8z"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 24 24"><path fill="#f07a95" d="M12 21.4l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.5z"/></svg>`;
const STAR = 'M12 1 Q13.4 10.6 23 12 Q13.4 13.4 12 23 Q10.6 13.4 1 12 Q10.6 10.6 12 1Z';
const ICON_SPARK = `<svg viewBox="0 0 24 24"><path fill="#5fb9de" d="${STAR}"/><path fill="#5fb9de" transform="translate(15 0) scale(.38)" d="${STAR}"/></svg>`;

// Häufchen aus 3–5 runden Köttelchen (viewBox 24 × 14, Boden bei y 14). r = fester Zufall 0..1
const POO_LAYOUTS = [
  [[8.5, 10.6], [15.5, 10.8], [12, 5.6]],
  [[5.5, 10.8], [12, 11], [18.5, 10.6], [9, 5.8], [15.4, 6]],
  [[6, 10.8], [12.4, 11], [18.6, 10.8], [12, 5.6]],
  [[8, 10.8], [14.6, 10.6], [11.4, 5.6], [20.6, 11.6]],
];
const POO_SVG = (r) => {
  const pts = POO_LAYOUTS[Math.floor(r * POO_LAYOUTS.length)];
  return `<svg viewBox="0 0 24 14" aria-hidden="true">${pts.map(([x, y], i) => {
    const rx = 3.3 - (i % 2) * 0.25;
    return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.9}" fill="#6e4b30" stroke="#3f2a1b" stroke-width=".7"/>`
      + `<ellipse cx="${x - 1}" cy="${y - 1.1}" rx="1.1" ry=".75" fill="#a47a52" opacity=".75"/>`;
  }).join('')}</svg>`;
};
// Kehrschaufel mit Holzstiel, liegt bei y 22 auf dem Boden
const SCOOP_SVG = `
  <svg viewBox="0 0 44 24" aria-hidden="true">
    <path d="M23 12 L42 2" stroke="#a87c4f" stroke-width="3" stroke-linecap="round"/>
    <path d="M23 12 L42 2" stroke="#6b4a2f" stroke-width="3.6" stroke-linecap="round" opacity=".25"/>
    <path d="M1 22 L22 22 L25 9 L21.5 9 L19.6 18.6 L1.6 19.4Z" fill="#8fb4c9" stroke="#4d6878" stroke-width="1.1" stroke-linejoin="round"/>
  </svg>`;

export {
  STASH_MAX, HAY_SVG, TUFTS_SVG, LOOKOUT_SVG, FLOWER_SVG, HAY_BITE, FOOD, ICON_LEAF, ICON_HEART, STAR, ICON_SPARK,
  POO_SVG, SCOOP_SVG,
};
