// Album 2: Platzhalter-Bild (24 × 24) für einen Schatz, der noch nicht gebaut ist (built: false). Er wird nie
// gezogen; das Bild erscheint nur, wenn ein Gerät mit einer neueren Version ihn schon verschenkt hat. Ein Päckchen mit
// Fragezeichen.

import { OUT } from '../pika.js';

const A2_PLATZHALTER = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.6" y="9" width="16.8" height="12.6" rx="1.6" fill="#d8cbb4" stroke="${OUT}" stroke-width="1"/>
      <path d="M3.6 13 H20.4" stroke="${OUT}" stroke-width=".7" opacity=".5"/>
      <path d="M9.4 14.6 q0 -2.4 2.6 -2.4 q2.6 0 2.6 2 q0 1.4 -1.6 2 q-1 .4 -1 1.4" stroke="#8a6d4a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="19.4" r=".95" fill="#8a6d4a"/></svg>`;

export { A2_PLATZHALTER };
