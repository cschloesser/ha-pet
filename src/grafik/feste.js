// Festtage: Farben, Lichterkette, Luftschlangen, Kürbis, Laterne, Kranz, Stiefel, Baum, Maibaum, Kuchen, Ei, Fledermaus

import { OUT } from './pika.js';
import { GLOW_GRAD } from './areale.js';

// ==================== Festtage: Konstanten, Grafiken und Stil ====================
// Deko im Jahreslauf. Ebenen: .fest-b hinter dem Land (.fsky Himmel: Feuerwerk, Fledermaus; .fback Tannenbaum,
// Maibaum, Wimpel; .fon liegt auf dem Bau, aber hinter dem Pika: Lichterkette, Luftschlangen, Laterne) und .fest-f
// vor Pika und Heu (.ffront Kürbis, Kranz, Stiefel, Kuchen, Eier; .fcf Konfetti; .fwl Lichtschein).
// Jede Grafik: viewBox mit dem Boden an der Unterkante, .b wird wie das Land abgedunkelt, .g (Flammen, Lämpchen)
// nicht; .nite leuchtet nur in Dämmerung und Nacht.
const FEST_COLORS = ['#e8584e', '#f6c945', '#5fb9de', '#7cc35a', '#f28fb1', '#b99cf0', '#ff9f5a'];
const FEST_FW_COLORS = ['#ff5a5f', '#ffd166', '#5fd1ff', '#b48cff', '#7dff9a', '#ff8ad8', '#fff3c4'];
const festF1 = (n) => n.toFixed(1);
const festSvg = (vb, body, cls) => `<svg class="${cls}" viewBox="0 0 ${vb[0]} ${vb[1]}" aria-hidden="true">${body}</svg>`;
const festBez = (a, b, c, d, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
};
// Oberkante des Baus je Areal (Bau-Einheiten, etwas unter dem Rand): daran hängen Lichterkette und Luftschlangen
const FEST_EDGE = {
  huegel: [
    ...[0.3, 0.45, 0.6, 0.75, 0.9].map((t) => festBez([-4, 60], [-3, 30], [22, 10], [50, 10], t)),
    ...[0.1, 0.25, 0.4, 0.55, 0.7].map((t) => festBez([50, 10], [78, 10], [103, 30], [104, 60], t)),
  ].map(([x, y]) => [x, y + 1.4]),
  fels: [[1, 41], [7, 32], [18, 28], [27, 20.5], [36, 14], [50, 12], [64, 14], [73, 20.5], [81, 32], [92, 35], [100.5, 45]],
  stumpf: [[19.4, 50], [20.6, 36], [22, 27.4], [33, 30.8], [50, 32.4], [67, 30.8], [78, 27.4], [79.4, 36], [80.6, 50]],
  alpin: [[2, 46], [5, 40], [14, 31], [24, 32], [31, 33], [34, 27], [37, 19], [46, 15.5], [56, 13], [65, 17.5], [72, 22.5],
    [73, 30.5], [80, 31.5], [89, 33], [94, 39], [98.5, 47]],
};
// Durchhängende Kette durch die Punkte: dichte Punkte im Abstand ~step, je Feld sag Durchhang
const festChain = (pts, step, sag) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n;
      out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)]);
    }
  }
  return out;
};
const festPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${festF1(x)} ${festF1(y)}`).join('');
// Leuchtpunkte (Lichterkette, Baum): Verlauf je Farbe, ids pro Grafik eindeutig
const festGlows = (p) => FEST_COLORS.map((c, i) => GLOW_GRAD(`${p}${i}`, c)).join('');
const festBulbs = (pts, p, r) => pts.map(([x, y], i) => {
  const ci = (i * 3) % FEST_COLORS.length;
  return `<g class="fbl" style="animation-delay:${(-(i % 3) * 0.93).toFixed(2)}s">`
    + `<circle cx="${festF1(x)}" cy="${festF1(y)}" r="${r * 2.6}" fill="url(#${p}${ci})"/>`
    + `<ellipse cx="${festF1(x)}" cy="${festF1(y)}" rx="${r * 0.72}" ry="${r}" fill="${FEST_COLORS[ci]}"/>`
    + `<circle cx="${festF1(x - r * 0.2)}" cy="${festF1(y - r * 0.35)}" r="${r * 0.28}" fill="#fff" opacity=".8"/></g>`;
}).join('');

// Lichterkette am Bau (Bau-Einheiten): Kabel mit Lämpchen; tags matt, in Dämmerung und Nacht leuchtend
const FEST_LIGHTS = (edge) => {
  const ch = festChain(edge, 5.2, 1.5);
  const bulbs = ch.map(([x, y]) => [x, y + 1.7]);
  return {
    b: `<path d="${festPath(ch)}" stroke="#2f4a2a" stroke-width=".55" fill="none"/>`
      + bulbs.map(([x, y], i) => `<rect x="${festF1(x - 0.55)}" y="${festF1(y - 1.9)}" width="1.1" height=".9" fill="#36443a"/>`
        + `<ellipse cx="${festF1(x)}" cy="${festF1(y)}" rx="1.05" ry="1.45" fill="${FEST_COLORS[(i * 3) % FEST_COLORS.length]}" opacity=".7"/>`).join(''),
    g: `<defs>${festGlows('fst-l')}</defs><g class="nite">${festBulbs(bulbs, 'fst-l', 1.45)}</g>`,
  };
};
// Luftschlangen: zwei bunte, gewellte Schlangen über den Bau, dazu hängende Kringel
const FEST_STREAMERS = (edge) => {
  const ch = festChain(edge, 1.6, 1.2);
  const wave = (dy, ph) => festPath(ch.map(([x, y], i) => [x, y + dy + Math.sin(i * 1.15 + ph) * 0.9]));
  // Kringel nur seitlich, nicht vor Tür und Schild
  const curls = edge.slice(1, -1).filter(([x], i) => i % 2 === 0 && (x < 33 || x > 67)).map(([x, y], i) => {
    const n = 2 + (i % 3);
    return `<path d="M${festF1(x)} ${festF1(y + 1)} ${'q1.5 1.6 0 3.2 q-1.5 1.6 0 3.2 '.repeat(n).trim()}" stroke="${FEST_COLORS[(i + 2) % FEST_COLORS.length]}"`
      + ` stroke-width=".85" fill="none" stroke-linecap="round"/>`;
  }).join('');
  return {
    b: `<path d="${wave(0, 0)}" stroke="#f28fb1" stroke-width=".95" fill="none" stroke-linecap="round"/>`
      + `<path d="${wave(2.4, 1.7)}" stroke="#f6c945" stroke-width=".95" fill="none" stroke-linecap="round"/>`
      + curls,
  };
};

// Geschnitzter Kürbis (viewBox 40 × 34), nachts leuchtet das Gesicht flackernd von innen
const FEST_FACE = 'M11.6 19 L16.4 19 L14.2 14.6Z M23.6 19 L28.4 19 L25.8 14.6Z M18.7 22 L21.3 22 L20 19.8Z'
  + ' M11.4 24 Q20 31.4 28.6 24 L26.8 24.4 L25.3 26 L23.6 24.6 L21.8 26.2 L20 24.8 L18.2 26.2 L16.4 24.6 L14.7 26 L13.2 24.4Z';
const FEST_PUMPKIN = {
  vb: [40, 34],
  b: `<path d="M19.5 9.5 Q18.6 3.5 21.6 1.4 L23.6 2.8 Q21.6 4.8 22.4 9.5Z" fill="#6f8f3c" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M23 3 q4 -2.5 6.5 .5" stroke="#6f8f3c" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <ellipse cx="11.5" cy="21.6" rx="10" ry="11.6" fill="#e9802a" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="28.5" cy="21.6" rx="10" ry="11.6" fill="#e9802a" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="20" cy="21.3" rx="10.4" ry="12.4" fill="#f5973a" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M14.5 13 Q12.6 18 13.6 25" stroke="#ffc583" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".75"/>
      <path d="${FEST_FACE}" fill="#4a2a12"/>`,
  g: `<defs>${GLOW_GRAD('fst-pg', '#ffb347')}</defs><g class="nite"><g class="fflk">
      <ellipse cx="20" cy="22" rx="25" ry="19" fill="url(#fst-pg)" opacity=".75"/>
      <path d="${FEST_FACE}" fill="#ffcf4d"/></g></g>`,
};
// Papierlaterne am Bau (viewBox 26 × 34): Stöckchen links steckt im Bau, Laterne schaukelt
const FEST_LANTERN_BODY = `
      <rect x="9.5" y="8.4" width="8" height="2.2" rx=".8" fill="${OUT}"/>
      <ellipse cx="13.5" cy="18" rx="8.5" ry="8" fill="#e8584e" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="13.5" cy="18" rx="5.4" ry="7.9" fill="#f6c945"/>
      <ellipse cx="13.5" cy="18" rx="2.1" ry="7.9" fill="#5fb9de"/>
      <path d="M5.4 14.6 Q13.5 12.6 21.6 14.6 M5.2 21.4 Q13.5 23.4 21.8 21.4" stroke="rgba(90, 64, 48, .35)" stroke-width=".6" fill="none"/>
      <rect x="9.5" y="25.4" width="8" height="2" rx=".8" fill="${OUT}"/>
      <path d="M13.5 27.4 V31.6 M12.4 31.6 H14.6" stroke="#e8584e" stroke-width="1" stroke-linecap="round"/>`;
const FEST_LANTERN = {
  vb: [26, 34],
  b: `<path d="M1 4.2 L15 1.6" stroke="#8a5a3b" stroke-width="1.6" stroke-linecap="round"/>
      <g class="lsw"><path d="M13.5 2 V8.6" stroke="${OUT}" stroke-width=".6"/>${FEST_LANTERN_BODY}</g>`,
  g: `<defs>${GLOW_GRAD('fst-mg', '#ffd27a')}</defs><g class="lsw"><g class="nite"><g class="fflk">
      <circle cx="13.5" cy="18" r="15" fill="url(#fst-mg)"/>
      <ellipse cx="13.5" cy="18" rx="7" ry="6.6" fill="#fff1b8" opacity=".45"/></g></g></g>`,
};
// Laterne am Stab, die der Pika trägt (in den Koordinaten der Pika-Grafik, viewBox 120 × 100)
const FEST_CARRY = `<svg viewBox="0 0 120 100" aria-hidden="true">
    <defs>${GLOW_GRAD('fst-cg', '#ffd27a')}</defs>
    <path d="M101 63 L128 6" stroke="#8a5a3b" stroke-width="1.9" stroke-linecap="round"/>
    <g class="lsw">
      <circle class="lgl" cx="128" cy="27.6" r="21" fill="url(#fst-cg)"/>
      <g transform="translate(128 6) scale(1.35) translate(-13.5 -2)">
        <path d="M13.5 2 V8.6" stroke="${OUT}" stroke-width=".6"/>${FEST_LANTERN_BODY.replace('#e8584e', '#f28fb1').replace('#5fb9de', '#7cc35a')}
        <ellipse class="lgl" cx="13.5" cy="18" rx="6" ry="5.6" fill="#fff1b8" opacity=".5"/>
      </g>
    </g>
    <ellipse cx="101" cy="62.4" rx="4" ry="5" fill="#ecdcc6" stroke="${OUT}" stroke-width="1.4"/>
  </svg>`;
// Adventskranz (viewBox 44 × 28): n Kerzen brennen
const FEST_CANDLES = [[15.5, 15.6], [28.5, 15.6], [9, 21.6], [35, 21.6]]; // Kerzenfuß; brennen in Reihenfolge 1–4
const FEST_WREATH = (n) => ({
  vb: [44, 28],
  b: `<ellipse cx="22" cy="19.6" rx="18.6" ry="6.2" fill="none" stroke="${OUT}" stroke-width="7"/>
      <ellipse cx="22" cy="19.6" rx="18.6" ry="6.2" fill="none" stroke="#2f6b33" stroke-width="5.4"/>
      <path d="M5 18 l2.2 -1 M9 15.4 l2.4 -.5 M16 13.8 l2.4 .1 M26 13.8 l2.4 -.1 M33 15 l2.4 .6 M37.4 18.4 l1.6 1.4
        M6 22.6 l2 1.2 M12 25 l2.4 .5 M30 25.4 l2.4 -.4 M36 23.2 l2 -1.2" stroke="#5fae4a" stroke-width="1" stroke-linecap="round"/>
      ${FEST_CANDLES.map(([x, y]) => `<rect x="${x - 1.7}" y="${y - 9}" width="3.4" height="9" rx=".8" fill="#d9483b" stroke="${OUT}" stroke-width=".7"/>
        <path d="M${x - 0.7} ${y - 7.6} V${y - 1.4}" stroke="#f08a7e" stroke-width=".7" stroke-linecap="round"/>
        <path d="M${x} ${y - 9} v-1.3" stroke="#3a2a20" stroke-width=".6"/>`).join('')}
      <g fill="#d9483b"><circle cx="7.4" cy="21" r="1"/><circle cx="20" cy="13.6" r="1"/><circle cx="31.6" cy="14.4" r=".9"/><circle cx="38" cy="21.4" r="1"/></g>
      <path d="M22 25.5 Q16.5 21.5 16.6 26.2 Q17 28.4 22 25.5Z M22 25.5 Q27.5 21.5 27.4 26.2 Q27 28.4 22 25.5Z" fill="#e8584e" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>
      <path d="M21.3 26 L19.6 30.4 L21.4 29.6Z M22.7 26 L24.4 30.4 L22.6 29.6Z" fill="#c94440" stroke="${OUT}" stroke-width=".5"/>
      <circle cx="22" cy="25.6" r="1.3" fill="#c94440" stroke="${OUT}" stroke-width=".6"/>`,
  g: `<defs>${GLOW_GRAD('fst-wg', '#ffcf70')}</defs>${FEST_CANDLES.slice(0, n).map(([x, y]) => {
    const t = y - 9.8;
    return `<g class="nite"><circle cx="${x}" cy="${t - 1.6}" r="6" fill="url(#fst-wg)"/></g>`
      + `<g class="flm"><path d="M${x} ${t - 4} Q${x + 1.9} ${t - 1.2} ${x} ${t} Q${x - 1.9} ${t - 1.2} ${x} ${t - 4}Z" fill="#ffb53a"/>`
      + `<path d="M${x} ${t - 2.4} Q${x + 0.9} ${t - 0.8} ${x} ${t} Q${x - 0.9} ${t - 0.8} ${x} ${t - 2.4}Z" fill="#fff3b0"/></g>`;
  }).join('')}`,
});
// Nikolausstiefel (viewBox 30 × 38), am 6. 12. gefüllt
const FEST_BOOT = (full) => ({
  vb: [30, 38],
  b: `${full ? `
      <path d="M10 14 V4.6 Q10 1.2 13 1.2 Q16 1.2 16 4.2" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M10 14 V4.6 Q10 1.2 13 1.2 Q16 1.2 16 4.2" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M10 14 V4.6 Q10 1.2 13 1.2 Q16 1.2 16 4.2" stroke="#e8584e" stroke-width="2.2" fill="none" stroke-dasharray="1.5 1.5"/>
      <path d="M18 14 Q18.4 8 19.6 4.4" stroke="#4f8a3a" stroke-width="1.2" fill="none"/>
      <circle cx="19.8" cy="3.8" r="3" fill="none" stroke="#f7cf2e" stroke-width="1.4" stroke-dasharray="1 .7"/>
      <circle cx="19.8" cy="3.8" r="2.3" fill="#f7cf2e"/><circle cx="19.8" cy="3.8" r="1" fill="#eeac1c"/>
      <ellipse cx="7.4" cy="10.6" rx="2.6" ry="2.2" fill="#a86d3a" stroke="${OUT}" stroke-width=".7"/>
      <ellipse cx="14" cy="10.2" rx="2.4" ry="2.1" fill="#b57a45" stroke="${OUT}" stroke-width=".7"/>
      <path d="M6.4 10 q1 -.8 2 0 M13.1 9.6 q.9 -.7 1.8 0" stroke="#7a4a26" stroke-width=".5" fill="none"/>` : ''}
      <path d="M6 14 L6 33.5 Q6 37 9.5 37 L25.5 37 Q29 37 28.6 33.6 Q28.2 29.6 22.6 28.8 L20.4 28.2 L20.4 14Z" fill="#d9483b" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M6.6 35 H28.2" stroke="#7a2d22" stroke-width="1.2"/>
      <path d="M8.7 17.5 V29.5" stroke="#f08a7e" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
      <rect x="4.4" y="10.4" width="17.6" height="5.8" rx="2.9" fill="#f6f1ea" stroke="${OUT}" stroke-width="1"/>
      <g fill="#e2d9cc"><circle cx="8" cy="13.4" r=".8"/><circle cx="12.6" cy="12.6" r=".8"/><circle cx="17.4" cy="13.6" r=".8"/></g>`,
});
// Tannenbaum (viewBox 50 × 66) mit Kugeln, Lichterkette und Stern
const FEST_GARLANDS = [[[14, 26], [25, 31], [35, 25]], [[10, 41], [25, 47], [40, 40]], [[6, 56], [25, 62], [44, 55]]];
const FEST_TREE = (() => {
  const q = ([a, c, b], t) => [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
  const bulbs = FEST_GARLANDS.flatMap((gl) => [0.12, 0.31, 0.5, 0.69, 0.88].map((t) => q(gl, t)).map(([x, y]) => [x, y + 1.2]));
  const balls = [[16, 51, '#e8584e'], [34, 52, '#f6c945'], [25, 45.5, '#5fb9de'], [19, 37, '#f6c945'], [31, 36, '#e8584e'], [25, 20, '#5fb9de']];
  const star = 'M0 -5 L1.5 -1.6 L5 -1.5 L2.3 .8 L3.1 4.4 L0 2.4 L-3.1 4.4 L-2.3 .8 L-5 -1.5 L-1.5 -1.6Z';
  return {
    vb: [50, 66],
    b: `<rect x="21.5" y="56" width="7" height="10" fill="#8a5a3b" stroke="${OUT}" stroke-width="1"/>
        <path d="M3 58 Q25 63 47 58 L31 35 Q25 36.4 19 35Z" fill="#3f8a4a" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M8 42.5 Q25 47 42 42.5 L29.5 22 Q25 23 20.5 22Z" fill="#46944f" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M13 27.5 Q25 31 37 27.5 L25 8Z" fill="#4f9e57" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M21 14 L16.5 25 M18.5 27 L12 40 M15 43 L7.5 56" stroke="#7cc35a" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>
        ${FEST_GARLANDS.map(([a, c, b]) => `<path d="M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}" stroke="#2a3f28" stroke-width=".5" fill="none"/>`).join('')}
        ${balls.map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.3" fill="${c}" stroke="${OUT}" stroke-width=".6"/><circle cx="${x - 0.7}" cy="${y - 0.8}" r=".7" fill="#fff" opacity=".7"/>`).join('')}
        ${bulbs.map(([x, y], i) => `<circle cx="${festF1(x)}" cy="${festF1(y)}" r=".9" fill="${FEST_COLORS[(i * 3) % FEST_COLORS.length]}" opacity=".75"/>`).join('')}`,
    g: `<defs>${festGlows('fst-t')}${GLOW_GRAD('fst-ts', '#ffe27a')}</defs>
        <g class="nite"><circle cx="25" cy="7" r="9" fill="url(#fst-ts)"/>${festBulbs(bulbs, 'fst-t', 1.1)}</g>
        <path transform="translate(25 7)" d="${star}" fill="#ffd75a" stroke="#b8862a" stroke-width=".6" stroke-linejoin="round"/>`,
  };
})();
const FEST_GIFT = {
  vb: [24, 20],
  b: `<rect x="2.5" y="8" width="19" height="11.6" rx="1.2" fill="#5fb9de" stroke="${OUT}" stroke-width="1"/>
      <rect x="1.5" y="5.6" width="21" height="4" rx="1" fill="#86d0ec" stroke="${OUT}" stroke-width="1"/>
      <rect x="10.6" y="5.6" width="2.8" height="14" fill="#e8584e"/>
      <path d="M12 5.6 Q6.5 .5 7.6 4.6 Q8.4 6.6 12 5.6Z M12 5.6 Q17.5 .5 16.4 4.6 Q15.6 6.6 12 5.6Z" fill="#e8584e" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`,
};
// Maibaum (viewBox 40 × 160): Birkenstamm, Birkenkrone, Kranz, Bänder wehen mit dem Wind (nach rechts gezeichnet)
const FEST_MAI = {
  vb: [40, 160],
  b: `<rect x="18.3" y="24" width="3.4" height="140" fill="#f4efe6" stroke="${OUT}" stroke-width=".8"/>
      <path d="M18.4 50 h1.7 M20 60 h1.5 M18.4 71 h1.9 M20.2 82 h1.3 M18.4 94 h1.6 M20 106 h1.5 M18.4 118 h1.8 M20 130 h1.4 M18.4 142 h1.7"
        stroke="#3a3330" stroke-width="1.2"/>
      <path d="M20 28 Q6 30 4.5 18 Q5 4 20 2 Q35 4 35.5 18 Q34 30 20 28Z" fill="#6bab4c" stroke="${OUT}" stroke-width="1.1"/>
      <path d="M10 10 Q8 18 9 25 M16 6 Q14 16 15 27 M25 6 Q27 16 25.5 27 M31 11 Q33 18 31.5 24" stroke="#4f8a3a" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse cx="13" cy="11" rx="4" ry="5" fill="#86c46b"/><ellipse cx="25" cy="15" rx="4.4" ry="5.6" fill="#86c46b" opacity=".85"/>
      <g class="rd">${[8.5, 12, 15.5, 24.5, 28, 31.5].map((x, i) => {
      const len = [34, 44, 30, 40, 32, 46][i];
      const s = len / 3;
      return `<path class="rb" style="animation-delay:${(-i * 0.37).toFixed(2)}s;animation-duration:${(1 + (i % 3) * 0.18).toFixed(2)}s"`
        + ` d="M${x} 47 q${festF1(s * 0.55)} ${festF1(s * 0.4)} ${festF1(s * 0.7)} ${festF1(s * 0.9)} t${festF1(s * 0.75)} ${festF1(s * 0.8)} t${festF1(s * 0.8)} ${festF1(s * 0.75)}"`
        + ` stroke="${FEST_COLORS[i]}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }).join('')}</g>
      <ellipse cx="20" cy="46" rx="13" ry="3.8" fill="none" stroke="${OUT}" stroke-width="5"/>
      <ellipse cx="20" cy="46" rx="13" ry="3.8" fill="none" stroke="#5fae4a" stroke-width="3.6"/>
      <g><circle cx="8" cy="46.8" r="1.5" fill="#f28fb1"/><circle cx="14" cy="49.4" r="1.5" fill="#f6c945"/><circle cx="21.5" cy="49.8" r="1.5" fill="#fff"/>
        <circle cx="29" cy="48.6" r="1.5" fill="#b99cf0"/><circle cx="31.5" cy="43.6" r="1.3" fill="#f6c945"/><circle cx="11" cy="43" r="1.3" fill="#f28fb1"/></g>`,
};
// Geburtstagskuchen (viewBox 32 × 32) mit einer Kerze; .out = ausgepustet, Rauchfaden steigt auf
const FEST_CAKE = {
  vb: [32, 32],
  b: `<ellipse cx="16" cy="30.4" rx="15" ry="2.2" fill="#f4f1ea" stroke="${OUT}" stroke-width=".9"/>
      <path d="M4.5 18 V27 Q16 31 27.5 27 V18Z" fill="#f3d7a6" stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M4.6 23.2 Q16 26.6 27.4 23.2" stroke="#fff6ea" stroke-width="1.6" fill="none"/>
      <path d="M4.5 18 Q4.6 21.6 6.2 21.4 Q7.4 21.2 7.8 20 Q9 23.6 10.6 22.4 Q11.6 21.4 13 21.6 Q14.4 24.2 16 22.6 Q17.4 21.4 19 21.8
        Q20.6 23.8 22 22 Q23 21 24.6 21.4 Q26.2 22.4 27.5 18Z" fill="#f7a8c4"/>
      <ellipse cx="16" cy="18" rx="11.5" ry="3.6" fill="#f7a8c4" stroke="${OUT}" stroke-width="1.1"/>
      <g stroke-width="1" stroke-linecap="round"><path d="M8.6 18.2 l1.2 -.5" stroke="#5fb9de"/><path d="M12 19.6 l1 .6" stroke="#f6c945"/>
        <path d="M20.4 19.4 l1.2 -.4" stroke="#7cc35a"/><path d="M23.6 17.6 l.8 .8" stroke="#5fb9de"/><path d="M11.4 16.4 l1 -.4" stroke="#fff"/></g>
      <circle cx="8.6" cy="16.4" r="1.5" fill="#e8584e" stroke="${OUT}" stroke-width=".6"/><circle cx="23.4" cy="16.2" r="1.5" fill="#e8584e" stroke="${OUT}" stroke-width=".6"/>
      <rect x="14.7" y="8.4" width="2.6" height="9.4" rx=".7" fill="#5fb9de" stroke="${OUT}" stroke-width=".6"/>
      <path d="M14.9 11 l2.2 -1.1 M14.9 13.8 l2.2 -1.1 M14.9 16.6 l2.2 -1.1" stroke="#fff" stroke-width=".7"/>
      <path d="M16 8.4 v-1.3" stroke="#3a2a20" stroke-width=".6"/>`,
  g: `<defs>${GLOW_GRAD('fst-kg', '#ffcf70')}</defs>
      <g class="nite khalo"><circle cx="16" cy="5" r="7.5" fill="url(#fst-kg)"/></g>
      <g class="flm"><path d="M16 2 Q18 5.2 16 7.4 Q14 5.2 16 2Z" fill="#ffb53a"/><path d="M16 4 Q17 5.8 16 7.1 Q15 5.8 16 4Z" fill="#fff3b0"/></g>
      <path class="smk" d="M16 6.8 q-1.8 -2.6 0 -5 t0 -5 t0 -5" stroke="rgba(235, 235, 240, .9)" stroke-width="1" fill="none" stroke-linecap="round"/>`,
};
// Osterei (viewBox 12 × 15), Muster 0 Zickzack, 1 Punkte, 2 Streifen
const FEST_EGG_PATH = 'M6 .8 C9.6 .8 11.4 6 11.4 9.4 C11.4 12.6 9 14.4 6 14.4 C3 14.4 .6 12.6 .6 9.4 C.6 6 2.4 .8 6 .8Z';
const FEST_EGG = (c1, c2, kind) => `<path d="${FEST_EGG_PATH}" fill="${c1}" stroke="${OUT}" stroke-width=".8"/>${[
  `<path d="M1.3 8.4 L3 6.9 L4.7 8.4 L6.4 6.9 L8.1 8.4 L9.8 6.9 L10.9 7.9" stroke="${c2}" stroke-width="1.1" fill="none" stroke-linejoin="round"/>`,
  `<g fill="${c2}"><circle cx="4.2" cy="6" r=".95"/><circle cx="8" cy="6.6" r=".95"/><circle cx="6" cy="9.6" r=".95"/><circle cx="3.2" cy="11.2" r=".85"/><circle cx="8.8" cy="11.4" r=".85"/></g>`,
  `<path d="M1 7.8 Q6 9.2 11 7.8 M.8 10.8 Q6 12.2 11.2 10.8" stroke="${c2}" stroke-width="1.3" fill="none"/>`,
][kind]}<ellipse cx="4" cy="4.6" rx="1.1" ry="1.9" fill="#fff" opacity=".45" transform="rotate(20 4 4.6)"/>`;
// Abgebrannter Raketenstab (viewBox 40 × 8), liegt im Gras
const FEST_STICK = {
  vb: [40, 8],
  b: `<path d="M1 6.6 L29 5.2" stroke="#b08a5a" stroke-width="1.1" stroke-linecap="round"/>
      <rect x="28" y="2.2" width="10" height="4.6" rx="1" fill="#4d4a52" stroke="${OUT}" stroke-width=".7"/>
      <rect x="31" y="2.2" width="2" height="4.6" fill="#c94440"/>
      <path d="M38 2.6 L39.6 4.5 L38 6.4Z" fill="#2a2a2a"/>`,
};
// Fledermaus (viewBox 40 × 22), Flügel schlagen am Körper
const FEST_BAT = `<svg viewBox="0 0 40 22" aria-hidden="true">
    <path class="w" d="M18 10 Q11 2 1.5 6.5 Q5.5 8 5 11.5 Q8.5 9.6 10 13.4 Q13 10.6 18 13Z" fill="#3b3048" stroke="#1f1828" stroke-width=".6"/>
    <path class="w" d="M22 10 Q29 2 38.5 6.5 Q34.5 8 35 11.5 Q31.5 9.6 30 13.4 Q27 10.6 22 13Z" fill="#3b3048" stroke="#1f1828" stroke-width=".6"/>
    <ellipse cx="20" cy="12" rx="3.4" ry="4.6" fill="#3b3048"/>
    <circle cx="20" cy="7.4" r="3" fill="#3b3048"/>
    <path d="M17.6 5.6 L17.8 2.6 L19.2 4.8Z M22.4 5.6 L22.2 2.6 L20.8 4.8Z" fill="#3b3048"/>
    <circle cx="18.9" cy="7.2" r=".6" fill="#ffd45a"/><circle cx="21.1" cy="7.2" r=".6" fill="#ffd45a"/>
  </svg>`;

export {
  FEST_COLORS, FEST_FW_COLORS, festF1, festSvg, FEST_EDGE, FEST_LIGHTS, FEST_STREAMERS, FEST_PUMPKIN, FEST_LANTERN,
  FEST_CARRY, FEST_WREATH, FEST_BOOT, FEST_TREE, FEST_GIFT, FEST_MAI, FEST_CAKE, FEST_EGG, FEST_STICK, FEST_BAT,
};
