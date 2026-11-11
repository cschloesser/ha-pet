// Haus-Bote: Zuber, Korb, Wäscheleine, Trommel, Spülbecken, Geschirr und die Geräte-Grafiken

import { OUT } from './pika.js';
import { STAR } from './szene.js';

const BOTE_BUBS = (pts) => `<g class="hb-bubs">${pts.map(([x, y, r], i) =>
  `<circle cx="${x}" cy="${y}" r="${r}" style="animation-delay:${(-i * 0.65).toFixed(2)}s"/>`).join('')}</g>`;
const BOTE_DROP = (x, y, d) => `<g transform="translate(${x} ${y})"><path class="hb-drip" style="animation-delay:${d}s" d="M0 0 q1.3 2 0 3 q-1.3 -1 0 -3z"/></g>`;

// Holzzuber mit Seifenschaum (x 4..42, Boden y 42); im Betrieb steigen Blasen auf
const BOTE_TUB = (run) => `
    <path d="M4 18 H42 L38.6 41 Q23 43.4 7.4 41Z" fill="#ad8664" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M13.5 19 L14.6 42 M23 19 V42.6 M32.5 19 L31.4 42" stroke="#8a664b" stroke-width=".9"/>
    <path d="M4.8 24.6 Q23 27.6 41.2 24.6 M6.3 35 Q23 38 39.7 35" stroke="#76838f" stroke-width="2.1" fill="none" stroke-linecap="round"/>
    <path d="M5 24 Q23 27 41 24 M6.5 34.4 Q23 37.4 39.5 34.4" stroke="#b5c0c9" stroke-width=".6" fill="none"/>
    <ellipse cx="23" cy="18" rx="19.5" ry="4.6" fill="#c9a27e" stroke="${OUT}" stroke-width="1.3"/>
    <ellipse cx="23" cy="18.4" rx="16.2" ry="3.1" fill="#8fc8e2"/>
    <g class="hb-paddle"><path d="M30 16 L38 1.6" stroke="${OUT}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M30 16 L38 1.6" stroke="#c9a27e" stroke-width="2" stroke-linecap="round"/></g>
    <g class="hb-foam" fill="#fff" stroke="#c9dde8" stroke-width=".5">
      <circle cx="12.5" cy="16.8" r="3.6"/><circle cx="18.5" cy="15.2" r="4.4"/><circle cx="26.2" cy="15.4" r="4.1"/>
      <circle cx="33" cy="16.8" r="3.4"/><circle cx="22.4" cy="17.8" r="3.2"/>
    </g>
    <g fill="#e3f3fb"><circle cx="17.2" cy="13.6" r="1.1"/><circle cx="25.4" cy="13.8" r="1"/><circle cx="32" cy="15.6" r=".7"/></g>
    ${run ? BOTE_BUBS([[15, 11, 1.8], [24, 10, 2.3], [30.5, 12, 1.5], [20, 11.5, 1.3]]) : ''}`;

// Wäschekorb, Rand oben links bei (0, 0), 32 breit, Boden bei y 14.6. .hb-lau = nasse Wäsche (tropft)
const BOTE_BASKET = `
    <g class="hb-lau">
      <path d="M3 2 Q3 -5 9 -4 Q12 -9 18 -6 Q23 -9 26 -4 Q31 -4 30 2Z" fill="#7cb4e0" stroke="${OUT}" stroke-width="1"/>
      <path d="M13 -.6 Q15 -6.5 20 -4.6 Q23.5 -5.4 24.4 0Z" fill="#f2a7b8" stroke="${OUT}" stroke-width=".8"/>
      <circle cx="7.6" cy="-.4" r="3.4" fill="#f6c945" stroke="${OUT}" stroke-width=".8"/>
    </g>
    <path d="M1 1.4 H31 L28.4 13.6 Q16 15.4 3.6 13.6Z" fill="#d9b07c" stroke="${OUT}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M2.2 5.8 Q16 7.4 29.8 5.8 M3 9.8 Q16 11.4 29 9.8" stroke="#b08550" stroke-width=".8" fill="none"/>
    <path d="M7 2.6 L7.7 14.2 M12 2.6 L12.3 14.8 M17 2.6 V15 M22 2.6 L21.7 14.8 M27 2.6 L26.3 14.2" stroke="#b08550" stroke-width=".7"/>
    <rect x="0" y="0" width="32" height="3.2" rx="1.6" fill="#c99a5f" stroke="${OUT}" stroke-width="1"/>
    <g class="hb-lau">
      <path d="M27 2 Q30.8 2.6 30.4 9 L28 9.2 Q28.2 5 25.6 3.6Z" fill="#7cb4e0" stroke="${OUT}" stroke-width=".8"/>
      ${BOTE_DROP(29.2, 9.2, 0)}${BOTE_DROP(3, 4, -0.8)}
    </g>`;

// Wäscheleine: [x, Höhe der Leine, Form, Klammern]. Ursprung jedes Stücks = Punkt auf der Leine.
const BOTE_LINE = [
  [19, 13.07, '<path d="M-7 0 L-2.6 0 Q0 2.4 2.6 0 L7 0 L11 4.6 L8 7.6 L6 6 V17 H-6 V6 L-8 7.6 L-11 4.6Z" fill="#6fa8dc"/><circle cx="2.6" cy="9.4" r="1.5" fill="#fff" stroke="none" opacity=".7"/>', [-4.6, 4.6]],
  [35, 14.82, '<path d="M-2.6 0 H3.6 V10 Q3.6 12.6 6.6 13.4 Q9.6 14.2 9 16.6 Q8.4 18.6 4.4 18 Q-2.6 17 -2.6 11Z" fill="#e8584e"/><path d="M-2.6 3.4 H3.6 M-2.6 6.4 H3.6" stroke="#fff" stroke-width="1.2"/>', [0.5]],
  [51, 14.7, '<path d="M-7 0 H7 L8.4 15 H2.2 L0 7 L-2.2 15 H-8.4Z" fill="#f6c945"/><path d="M-6.8 2.2 H6.8" stroke="#e0a032" stroke-width="1"/>', [-4.6, 4.6]],
  [67, 12.72, '<rect x="-6" y="0" width="12" height="18" rx="1.2" fill="#f2a7b8"/><path d="M-6 13 H6 M-6 15.2 H6" stroke="#fff" stroke-width=".9"/>', [-3.6, 3.6]],
];
const BOTE_CLOTHESLINE = `
    <path d="M6 111 V8 M78 111 V8" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M6 111 V8 M78 111 V8" stroke="#ad8664" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M2.6 8.6 H9.4 M74.6 8.6 H81.4" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M2.6 8.6 H9.4 M74.6 8.6 H81.4" stroke="#c9a27e" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M5 10 Q42 20 79 10" stroke="${OUT}" stroke-width="1.4" fill="none" opacity=".5"/>
    <path d="M5 10 Q42 20 79 10" stroke="#f6f1ea" stroke-width=".7" fill="none"/>
    ${BOTE_LINE.map(([x, y, shape, pins], i) => `<g transform="translate(${x} ${y})"><g class="hb-cl hb-c${i}">
      <g class="hb-cs" style="animation-delay:${(-i * 0.7).toFixed(1)}s;animation-duration:calc(var(--hbs, 2.4s) * ${[1, 0.8, 1.15, 0.9][i]})">
        <g stroke="${OUT}" stroke-width=".9" stroke-linejoin="round">${shape}</g></g>
      ${pins.map((p) => `<rect x="${p - 1}" y="-2.4" width="2" height="4.6" rx=".7" fill="#c9a27e" stroke="${OUT}" stroke-width=".5"/>`).join('')}
    </g></g>`).join('')}
    <g transform="translate(42 95.6)">${BOTE_BASKET}</g>`;

// Trommel des Trockners: Dauben, Nieten und ein Herzchen-Aufkleber drehen sich um (23, 24)
const BOTE_DRUM_ROT = (() => {
  let s = '<circle cx="23" cy="24" r="16.4" fill="none"/>';
  for (let i = 0; i < 8; i++) {
    const r = (i * Math.PI) / 4;
    const c = Math.cos(r);
    const n = Math.sin(r);
    s += `<path d="M${(23 + c * 11).toFixed(2)} ${(24 + n * 11).toFixed(2)} L${(23 + c * 16.2).toFixed(2)} ${(24 + n * 16.2).toFixed(2)}" stroke="#8a664b" stroke-width="1"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const r = ((i * 90 + 22.5) * Math.PI) / 180;
    s += `<circle cx="${(23 + Math.cos(r) * 13.6).toFixed(2)}" cy="${(24 + Math.sin(r) * 13.6).toFixed(2)}" r=".9" fill="#76838f"/>`;
  }
  const h = (-62 * Math.PI) / 180;
  return s + `<path transform="translate(${(23 + Math.cos(h) * 13.6).toFixed(2)} ${(24 + Math.sin(h) * 13.6).toFixed(2)})" `
    + 'd="M0 1.7 L-1.7 0 Q-2.5 -1 -1.5 -1.8 Q-.6 -2.2 0 -1.2 Q.6 -2.2 1.5 -1.8 Q2.5 -1 1.7 0Z" fill="#f07a95"/>';
})();
const BOTE_SOCK = (fill) => `<path d="M-2 -4 H1.6 V.4 Q1.6 1.6 3 2 L4 2.3 Q5.2 2.9 4.4 4.2 L1 4 Q-2 3.4 -2 .8Z" fill="${fill}" stroke="${OUT}" stroke-width=".5"/>`;
// Aufsteigende Wellen; mit Rand (Dampf) liegt unter jeder Welle ein dunkler Strich statt eines drop-shadow
const BOTE_WAVES = (cls, xs, y, d, rim) => `<g class="${cls}" fill="none" stroke-linecap="round">${xs.map((x, i) => {
  const p = `d="M${x} ${y + (i % 2) * 1.5} q1.6 -1.8 0 -3.6 q-1.6 -1.8 0 -3.6"`;
  return `<g style="animation-delay:${(-i * d).toFixed(2)}s">${rim ? `<path class="hb-rim" ${p}/>` : ''}<path ${p}/></g>`;
}).join('')}</g>`;

// Teller zum Tragen (Vorderansicht) und gefaltetes Handtuch im Maul
const BOTE_PLATE_SVG = `<svg viewBox="-7 -7 14 14" aria-hidden="true"><circle r="6.3" fill="#fff" stroke="${OUT}" stroke-width="1"/>
    <circle r="4" fill="none" stroke="#7cb4e0" stroke-width=".9"/><path d="M-3.8 -2.4 Q-2.4 -4.2 0 -4.6" stroke="#dbeaf3" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`;
const BOTE_TOWEL_SVG = `<svg viewBox="-9 -4 18 16" aria-hidden="true"><path d="M-6.4 -2 H6.4 Q7.6 -2 7.6 -.8 V9.4 H-7.6 V-.8 Q-7.6 -2 -6.4 -2Z"
    fill="#fff3c4" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/><path d="M-7.6 1.4 H7.6" stroke="#e6c97a" stroke-width=".7" stroke-dasharray="1.2 1.2"/>
    <path d="M-7.6 6 H7.6 M-7.6 7.6 H7.6" stroke="#f2a7b8" stroke-width=".9"/><path d="M-6 9.4 v1.2 M-3 9.4 v1.2 M0 9.4 v1.2 M3 9.4 v1.2 M6 9.4 v1.2" stroke="#e6c97a" stroke-width=".8"/></svg>`;

// Spülschüssel auf dem Tisch (x 9.5..40.5, Rand y 19); voll mit Wasser, Schaum und eintauchendem Teller
const BOTE_BASIN = (full) => `
    <ellipse cx="25" cy="19" rx="15.5" ry="3.4" fill="#e9f3fb" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="25" cy="19.4" rx="13.2" ry="2.3" fill="${full ? '#8fc8e2' : '#c4dce8'}"/>
    ${full ? `<g class="hb-dip"><circle cx="21" cy="13.6" r="6.2" fill="#fff" stroke="${OUT}" stroke-width="1"/>
      <circle cx="21" cy="13.6" r="4" fill="none" stroke="#7cb4e0" stroke-width=".9"/></g>
      <path d="M11.8 19.4 A13.2 2.3 0 0 0 38.2 19.4Z" fill="#8fc8e2" opacity=".85"/>` : ''}
    <path d="M9.5 19 Q10.4 31 25 31 Q39.6 31 40.5 19 Q25 23.6 9.5 19Z" fill="#6fa8dc" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M9.7 19.3 Q25 23.8 40.3 19.3" stroke="#e9f3fb" stroke-width="1.3" fill="none"/>
    <g fill="#fff" opacity=".75"><circle cx="16" cy="25.6" r="1"/><circle cx="25" cy="27.4" r="1"/><circle cx="34" cy="25.6" r="1"/></g>
    ${full ? `<g class="hb-foam" fill="#fff" stroke="#c9dde8" stroke-width=".5"><circle cx="16.4" cy="19.2" r="2.2"/>
      <circle cx="27.4" cy="19.6" r="2.6"/><circle cx="33" cy="19" r="2"/></g>
      ${BOTE_BUBS([[18, 15, 1.5], [28, 14.5, 1.9], [33, 16, 1.2]])}` : ''}`;
const BOTE_TWINKLE = (pts) => pts.map(([x, y], i) =>
  `<g transform="translate(${x} ${y}) scale(.34) translate(-12 -12)"><path class="hb-tw" style="animation-delay:${(-i * 0.6).toFixed(1)}s" d="${STAR}"/></g>`).join('');

// Geräte-Grafiken je Phase, in Einheiten von BOTE_K × Kartenhöhe (src/logik/haus-bote.js): vb = viewBox,
// ground = Bodenlinie, vt = sichtbare Oberkante (für das Fähnchen), part = Hauptteil in x (Fortschrittsbalken,
// Hingehen), back = zu hoch für den vorderen Wiesenstreifen (bleibt hinten).
const BOTE_SVG = {
  washer(view) {
    if (view === 'empty') return { vb: [0, 0, 84, 112], ground: 110, vt: 8, part: [6, 78], back: true, svg: BOTE_CLOTHESLINE };
    const done = view === 'done';
    return {
      vb: [0, 0, done ? 64 : 46, 44], ground: 42, vt: 2, part: done ? [4, 63] : [4, 42],
      svg: BOTE_TUB(view === 'run') + (done ? `<g transform="translate(31 27.6)">${BOTE_BASKET}</g>` : ''),
    };
  },
  dryer(view, id) {
    const done = view === 'done';
    const stand = `
        <path d="M9 49 L17 30 M37 49 L29 30" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M9 49 L17 30 M37 49 L29 30" stroke="#8a664b" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M11.5 42 H34.5" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M11.5 42 H34.5" stroke="#8a664b" stroke-width="1.8" stroke-linecap="round"/>`;
    const glass = view === 'empty'
      ? `<circle cx="23" cy="24" r="7" fill="#3b302a"/>
          <ellipse cx="35.2" cy="24" rx="3.4" ry="8.6" fill="#8d99a5" stroke="${OUT}" stroke-width="1"/>
          <ellipse cx="35.5" cy="24" rx="2.1" ry="6.8" fill="#d6ecf6"/>`
      : `<circle cx="23" cy="24" r="7" fill="#d6ecf6"/>
          <clipPath id="hb-dc${id}"><circle cx="23" cy="24" r="7"/></clipPath>
          <g clip-path="url(#hb-dc${id})"><g class="hb-sock"><circle cx="23" cy="24" r="7" fill="none"/>
            <g transform="translate(20.4 26) rotate(-24)">${BOTE_SOCK('#e8584e')}</g>
            <g transform="translate(25.8 21.6) rotate(150)">${BOTE_SOCK('#6fa8dc')}</g></g></g>
          <path d="M18.6 20.4 A6 6 0 0 1 24.4 18.2" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".85"/>`;
    const towels = done ? `<g class="hb-towels">
          <g class="hb-t1"><rect x="34" y="40.8" width="27" height="7.6" rx="3.7" fill="#f2a7b8" stroke="${OUT}" stroke-width="1"/>
            <path d="M37 44.6 H58" stroke="#fff" stroke-opacity=".75" stroke-width=".8" stroke-dasharray="1.4 1.6"/></g>
          <g class="hb-t2"><rect x="35.4" y="33.6" width="25" height="7.6" rx="3.7" fill="#a7d3f2" stroke="${OUT}" stroke-width="1"/>
            <path d="M38.4 37.4 H57.4" stroke="#fff" stroke-opacity=".75" stroke-width=".8" stroke-dasharray="1.4 1.6"/></g>
          <g class="hb-t3"><rect x="36.6" y="26.4" width="23" height="7.6" rx="3.7" fill="#fff3c4" stroke="${OUT}" stroke-width="1"/>
            <path d="M39.6 30.2 H56.6" stroke="#e6c97a" stroke-width=".8" stroke-dasharray="1.4 1.6"/></g>
        </g>${BOTE_WAVES('hb-steam', [42, 48, 54], 24, 0.9, true)}` : '';
    return {
      vb: [0, -12, done ? 64 : 46, 62], ground: 48, vt: 7, part: done ? [6, 62] : [6, 40],
      svg: `${stand}<circle cx="23" cy="24" r="17" fill="#ad8664" stroke="${OUT}" stroke-width="1.6"/>
          <g class="hb-rot">${BOTE_DRUM_ROT}</g>
          <circle cx="23" cy="24" r="10.6" fill="#8a664b" stroke="${OUT}" stroke-width="1"/>
          <circle cx="23" cy="24" r="8.6" fill="#8d99a5" stroke="${OUT}" stroke-width="1"/>
          ${glass}${view === 'run' ? BOTE_WAVES('hb-heat', [14, 23, 32], 5, 0.7) : ''}${towels}`,
    };
  },
  dishwasher(view) {
    const table = `
        <path d="M8 50.5 V35 M44 50.5 V35" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M8 50.5 V35 M44 50.5 V35" stroke="#8a664b" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M8 44 H44" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><path d="M8 44 H44" stroke="#8a664b" stroke-width="1.5"/>
        <rect x="2" y="31" width="48" height="5" rx="2" fill="#ad8664" stroke="${OUT}" stroke-width="1.3"/>
        <path d="M5 32.6 H47" stroke="#c9a27e" stroke-width="1" stroke-linecap="round"/>
        <rect x="42.4" y="27.6" width="7" height="3.6" rx="1" fill="#f6c945" stroke="${OUT}" stroke-width=".7"/>
        <path d="M42.8 28.4 H49" stroke="#6bab4c" stroke-width="1.2"/>`;
    let top;
    if (view === 'done') {
      top = `<g class="hb-plates">${[0, 1, 2, 3, 4].map((i) => {
        const y = 29.4 - i * 2.5;
        return `<g class="hb-p${i}"><ellipse cx="25" cy="${y}" rx="11" ry="2.8" fill="#fff" stroke="${OUT}" stroke-width=".9"/>`
          + `<path d="M15.6 ${(y + 0.8).toFixed(1)} Q25 ${(y + 3.6).toFixed(1)} 34.4 ${(y + 0.8).toFixed(1)}" stroke="#cfe0ea" stroke-width=".8" fill="none"/>`
          + (i === 4 ? '<ellipse cx="25" cy="19.4" rx="6.6" ry="1.5" fill="none" stroke="#7cb4e0" stroke-width=".8"/>'
            + '<path d="M17.6 18.6 Q20.6 17.5 23.6 17.4" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>' : '')
          + '</g>';
      }).join('')}</g>${BOTE_TWINKLE([[10, 14], [39, 16], [30, 8]])}`;
    } else if (view === 'empty') {
      top = `${BOTE_BASIN(false)}
          <path d="M5 33 H17 V43 L14.6 41.6 L12.2 43 L9.8 41.6 L7.4 43 L5 41.6Z" fill="#fff" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
          <path d="M5 36 H17 M5 39 H17 M8 33 V42 M11 33 V42.4 M14 33 V42" stroke="#e8584e" stroke-width=".8" opacity=".75"/>`;
    } else top = BOTE_BASIN(true);
    return { vb: [0, -6, 52, 56], ground: 50, vt: view === 'done' ? 12 : 8, part: [2, 50], svg: table + top };
  },
};

export { BOTE_LINE, BOTE_PLATE_SVG, BOTE_TOWEL_SVG, BOTE_SVG };
