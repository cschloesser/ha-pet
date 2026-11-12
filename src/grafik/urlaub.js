// Urlaub: Schild an der Tür („Bin bei Pino“) und Postkarte (in der Szene klein, im Tagebuch groß)

import { esc } from '../logik/hilfen.js';

const OUT = '#5a4030';

// Holzschild an zwei Schnüren, der Text passt sich der Breite an (lange Namen werden schmaler geschrieben)
const URLAUB_SIGN = (name) => `<svg viewBox="0 0 60 34" aria-hidden="true">
    <path d="M14 13 L30 1.5 L46 13" stroke="${OUT}" stroke-width="1" fill="none"/>
    <circle cx="30" cy="1.8" r="1.4" fill="${OUT}"/>
    <rect x="3" y="12" width="54" height="20" rx="3" fill="#d9a873" stroke="${OUT}" stroke-width="1.1"/>
    <path d="M6 18 h48 M6 25 h48" stroke="#c08a55" stroke-width=".7" opacity=".7"/>
    <circle cx="7" cy="16" r=".9" fill="${OUT}"/><circle cx="53" cy="16" r=".9" fill="${OUT}"/>
    <text x="30" y="25.6" text-anchor="middle" font-family="Comic Sans MS, Chalkboard SE, system-ui, sans-serif" font-size="9"
      font-weight="700" fill="#4a2e1c"${String(name).length > 4 ? ' textLength="48" lengthAdjust="spacingAndGlyphs"' : ''}>Bin bei ${esc(name)}</text>
  </svg>`;

// Postkarte: links ein Bild (Berge oder Meer, je nach Jahreszeit), rechts Zeilen und eine Briefmarke
const URLAUB_CARD = (sea = false) => `<svg viewBox="0 0 60 40" aria-hidden="true">
    <rect x=".6" y=".6" width="58.8" height="38.8" rx="2" fill="#fffaf0" stroke="${OUT}" stroke-width=".9"/>
    <clipPath id="urp"><rect x="3" y="3" width="28" height="34" rx="1"/></clipPath>
    <g clip-path="url(#urp)">
      <rect x="3" y="3" width="28" height="34" fill="#9fd4f2"/>
      <circle cx="24" cy="10" r="3.4" fill="#ffd75a"/>
      ${sea
    ? '<rect x="3" y="24" width="28" height="13" fill="#4aa3d8"/><path d="M3 27 q3.5 -2 7 0 t7 0 t7 0 t7 0" stroke="#fff" stroke-width=".8" fill="none" opacity=".8"/><rect x="3" y="33" width="28" height="4" fill="#f2d8a0"/>'
    : '<path d="M3 30 L12 15 L18 24 L23 17 L31 30 Z" fill="#8aa0b8"/><path d="M12 15 l-2.6 4.4 h5.2 Z M23 17 l-2 3.3 h4 Z" fill="#fff"/><rect x="3" y="29" width="28" height="8" fill="#7cbf5e"/>'}
      <circle cx="11" cy="31.5" r="2.6" fill="#c49a74" stroke="${OUT}" stroke-width=".5"/><circle cx="17" cy="31.5" r="2.6" fill="#f2b36e" stroke="${OUT}" stroke-width=".5"/>
    </g>
    <path d="M33.5 6 v28" stroke="${OUT}" stroke-width=".5" opacity=".4"/>
    <rect x="47" y="4" width="9.5" height="11" fill="#f28fb1" stroke="${OUT}" stroke-width=".6" stroke-dasharray="1 .8"/>
    <path d="M49 12 q2.7 -5 5.5 0" stroke="#fff" stroke-width=".9" fill="none"/>
    <path d="M37 20 h19 M37 25 h19 M37 30 h14" stroke="${OUT}" stroke-width=".6" opacity=".55"/>
    <path d="M37 13 q2 -2.5 4 0 t4 0" stroke="#4a6fb0" stroke-width=".7" fill="none"/>
  </svg>`;

export { URLAUB_SIGN, URLAUB_CARD };
