// Kleine Momente und Denkblasen: Kaffeeduft, Zeichen über dem Kopf, Schmetterling, Blumengeschenk, Traummotive

import { FOOD, ICON_HEART } from './szene.js';

// Denkblase beim Schnuppern: Tasse mit Dampf
const COFFEE_THINK = `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 8 q-1.4 -2 0 -4 q1.4 -2 0 -4 M12.5 8 q-1.4 -2 0 -4 q1.4 -2 0 -4" fill="none" stroke="#b9a48c" stroke-width="1.3" stroke-linecap="round" transform="translate(0 2)"/>
    <path d="M17.4 12.4 q4.2 0 4.2 3.4 q0 3.4 -4.4 3.2" fill="none" stroke="#6b4428" stroke-width="1.8"/>
    <path d="M3 11 H18 Q18 21.5 10.5 21.5 Q3 21.5 3 11Z" fill="#f6f1ea" stroke="#6b4428" stroke-width="1.2"/>
    <ellipse cx="10.5" cy="11" rx="7.5" ry="1.6" fill="#b07a4c"/></svg>`;

// Zeichen über dem Kopf (_emote)
const EMOTE = {
  q: '?',
  ex: '!',
  drop: `<svg viewBox="0 0 10 14"><path d="M5 .5 C7 4.2 9.5 6.8 9.5 9.4 A4.5 4.5 0 0 1 .5 9.4 C.5 6.8 3 4.2 5 .5Z" fill="#a8dcff" stroke="#4f86b8" stroke-width="1"/>
      <path d="M3.2 9 q0 1.8 1.6 2.4" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="#fff6b0" stroke="#e0a032" stroke-width=".8" stroke-linejoin="round">
      <path d="M8 2 Q9 7 14 8 Q9 9 8 14 Q7 9 2 8 Q7 7 8 2Z"/><path d="M18 10 Q18.6 13.4 22 14 Q18.6 14.6 18 18 Q17.4 14.6 14 14 Q17.4 13.4 18 10Z"/>
      <path d="M7 16 Q7.4 18.6 10 19 Q7.4 19.4 7 22 Q6.6 19.4 4 19 Q6.6 18.6 7 16Z"/></svg>`,
  grump: `<svg viewBox="0 0 28 18"><path d="M7 16 Q1 16 1.5 11 Q2 7 6.5 7.5 Q7.5 2 13 2.5 Q18.5 2 20 6.5 Q26.5 6 26.5 11.5 Q26.5 16 21 16Z"
      fill="#c9ced8" stroke="#6f7686" stroke-width="1.2"/><path d="M9.5 10.5 l2.4 1.4 M18.5 10.5 l-2.4 1.4 M11.5 13.6 q2.5 -1.4 5 0" stroke="#5c6272" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
};
// Schmetterling von vorn (viewBox 20 × 16, Körper bei x 10), Flügel schlagen um die Mitte
const BFLY_COLORS = [['#ffb347', '#e07b1a'], ['#8fc4ff', '#4f86c6'], ['#f6a5c8', '#d4669a'], ['#fff2a0', '#d9b640'], ['#c7b2ff', '#8a6fd9']];
const BFLY_SVG = ([c, d]) => `<svg viewBox="0 0 20 16" aria-hidden="true">
    <g class="bwl"><path d="M10 7.5 C6.5 .5 .8 .6 1 5 C1.2 7.6 4.4 8.6 7 8.4 C3.2 9.6 2.6 14.6 6.4 14.4 C8.6 14.2 9.8 11.4 10 9Z" fill="${c}" stroke="${d}" stroke-width=".8"/>
      <circle cx="4.6" cy="4.8" r="1.3" fill="${d}" opacity=".6"/></g>
    <g class="bwr"><path d="M10 7.5 C13.5 .5 19.2 .6 19 5 C18.8 7.6 15.6 8.6 13 8.4 C16.8 9.6 17.4 14.6 13.6 14.4 C11.4 14.2 10.2 11.4 10 9Z" fill="${c}" stroke="${d}" stroke-width=".8"/>
      <circle cx="15.4" cy="4.8" r="1.3" fill="${d}" opacity=".6"/></g>
    <ellipse cx="10" cy="8.6" rx="1" ry="4" fill="#4a3628"/>
    <path d="M9.6 4.8 Q8.6 2.4 7.4 1.8 M10.4 4.8 Q11.4 2.4 12.6 1.8" stroke="#4a3628" stroke-width=".55" fill="none" stroke-linecap="round"/></svg>`;
// Geschenk: liegende Blüte mit großer rosa Schleife (viewBox 34 × 16)
const GIFT_SVG = (c) => `<svg viewBox="0 0 34 16" aria-hidden="true">
    <path d="M2 13 Q13 11.6 24 8.6" stroke="#4f8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="9" cy="10.4" rx="3.6" ry="1.5" fill="#6bab4c" transform="rotate(-24 9 10.4)"/>
    <g fill="${c}" stroke="rgba(0,0,0,.15)" stroke-width=".5">
      ${[0, 72, 144, 216, 288].map((a) => {
      const r = (a * Math.PI) / 180;
      return `<circle cx="${(27 + Math.sin(r) * 3.6).toFixed(2)}" cy="${(7.6 - Math.cos(r) * 3.6).toFixed(2)}" r="3.2"/>`;
    }).join('')}
    </g>
    <circle cx="27" cy="7.6" r="1.7" fill="#e0a032"/>
    <g fill="#f2789f" stroke="#b8406a" stroke-width=".5" stroke-linejoin="round" transform="translate(15 11) scale(1.45) translate(-15 -11)">
      <path d="M15 11 L10.8 7.6 L11.4 12.6Z"/><path d="M15 11 L19.4 8.4 L18.6 13.2Z"/>
      <path d="M15 11 L13.2 15.4 M15 11 L16.6 15.2" fill="none" stroke-linecap="round"/>
      <circle cx="15" cy="11" r="1.2"/></g></svg>`;
// Traummotive (Denkblase im Schlaf). Was er am Tag erlebt hat, träumt er öfter (_memo).
const DREAM = {
  lz: FOOD.lz.svg,
  klee: FOOD.klee.svg,
  coffee: COFFEE_THINK,
  heart: ICON_HEART,
  pino: `<svg viewBox="0 0 24 24" stroke="#5a4030" stroke-width="1">
      <circle cx="6.6" cy="6.4" r="4" fill="#f2b36e"/><circle cx="17.4" cy="6.4" r="4" fill="#f2b36e"/>
      <circle cx="6.6" cy="6.8" r="2.1" fill="#f0a184" stroke="none"/><circle cx="17.4" cy="6.8" r="2.1" fill="#f0a184" stroke="none"/>
      <ellipse cx="12" cy="13.2" rx="9" ry="7.4" fill="#f2b36e"/>
      <ellipse cx="12" cy="8.8" rx="2.2" ry="1.4" fill="#fbf0e2" stroke="none"/>
      <circle cx="8.4" cy="12.4" r="1.3" fill="#2a1a12" stroke="none"/><circle cx="15.6" cy="12.4" r="1.3" fill="#2a1a12" stroke="none"/>
      <ellipse cx="12" cy="15.8" rx="3" ry="2.2" fill="#fbe7cb" stroke="none"/>
      <path d="M11 14.6 h2 l-1 1z" fill="#7a4438" stroke="none"/>
      <path d="M5.2 19 Q12 23.4 18.8 19 L12 23.6Z" fill="#3fb6a8"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" stroke="#5a6a7a" stroke-width=".8" stroke-linejoin="round">
      <path d="M2.6 13.6 L20.4 10.6 Q23 10.4 22 12.4 L5 15.6Z" fill="#eef3f8"/>
      <path d="M10.4 12.4 L13.4 5.8 H15.4 L14.4 11.8Z" fill="#dfe7ef"/><path d="M11 14.6 L14.6 19.4 H16.6 L14.8 14Z" fill="#dfe7ef"/>
      <path d="M3.2 13.4 L1.8 8.6 H3.6 L6.4 13Z" fill="#d9473b"/></svg>`,
  bird: `<svg viewBox="0 0 24 24" stroke="#5a4030" stroke-width=".9">
      <circle cx="11.5" cy="13" r="7.6" fill="#8a6a50"/><circle cx="13.4" cy="15" r="4.8" fill="#e8743b" stroke="none"/>
      <path d="M6 14.6 Q8.6 12 11.4 15.4" fill="#6f523d"/><circle cx="14.6" cy="10.4" r="1.1" fill="#2a1a12" stroke="none"/>
      <path d="M18.6 10.4 L22 11.6 L18.8 12.8Z" fill="#f2b53c"/></svg>`,
  note: `<svg viewBox="0 0 24 24"><path d="M9 18 V6.2 L19 4 V15.6" stroke="#5a4030" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
      <ellipse cx="6.8" cy="18" rx="2.8" ry="2.1" fill="#5a4030"/><ellipse cx="16.8" cy="15.8" rx="2.8" ry="2.1" fill="#5a4030"/></svg>`,
  bfly: BFLY_SVG(BFLY_COLORS[0]),
};

export { COFFEE_THINK, EMOTE, BFLY_COLORS, BFLY_SVG, GIFT_SVG, DREAM };
