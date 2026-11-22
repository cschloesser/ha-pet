// Album 2: Laterne (t2 = 1). Daten, Bild fürs Album (24 × 24), die Laterne, die neben dem Bau steht, und dieselbe im
// Maul des Pikas. Felder siehe src/grafik/album2.js; die Szene: src/karte/album2-lantern.js, der Stil:
// src/stil/album2-lantern.js.
// Eine kleine Sturmlaterne aus Blech mit Glas und Kerze, Dach und Fuß im Rot des Windrads: Sie soll sich von der bunten
// Papierlaterne am Stab unterscheiden, die er an St. Martin trägt (src/grafik/feste.js).

import { OUT } from '../pika.js';

// Farben: rot wie das Windrad. Golden (Stufe 3) nur für die Laterne im Maul: Die in der Szene färbt .gilt um (wie alle
// Schätze), das Maul des Pikas trifft das nicht.
const PAL = { rot: '#e8584e', rotD: '#b8433b', hell: '#ffa497', blech: '#4d515c', henkel: '#9aa0ad' };
const PAL_GOLD = { rot: '#f2c230', rotD: '#c9971c', hell: '#fff1a8', blech: '#8a6a1c', henkel: '#e6c35a' };
const GLAS = '#ffe9a6';

// Die Laterne in einem Feld von 20 × 30: Scheitel des Henkels oben bei (10 | 1,2), Fuß unten bei y 29,6, Mitte des Glases
// bei (10 | 19). cls: mit Klasse an der Flamme (.a2lfl, flackert beim Antippen) für das Bild in der Szene; im Maul ohne
// jede Klasse, dort griffe sonst das Stylesheet des Pikas (Kopf von src/karte/album2.js). P: Farben (PAL, PAL_GOLD).
const LANTERN_G = (cls = true, P = PAL) => `
      <path d="M4.6 10.4 Q4.4 1.2 10 1.2 Q15.6 1.2 15.4 10.4" stroke="${OUT}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <path d="M4.6 10.4 Q4.4 1.2 10 1.2 Q15.6 1.2 15.4 10.4" stroke="${P.henkel}" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <circle cx="10" cy="5.8" r="1.3" fill="${P.blech}" stroke="${OUT}" stroke-width=".7"/>
      <path d="M4.4 11.4 L10 6.6 L15.6 11.4Z" fill="${P.rot}" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M7.2 9.6 L10 7.3" stroke="${P.hell}" stroke-width=".8" stroke-linecap="round" opacity=".85"/>
      <rect x="3.8" y="11.2" width="12.4" height="2" rx=".7" fill="${P.rotD}" stroke="${OUT}" stroke-width=".8"/>
      <rect x="5.4" y="13.2" width="9.2" height="11.6" fill="${GLAS}" stroke="${OUT}" stroke-width=".8"/>
      <path d="M6.6 14.4 V23.4" stroke="#fff8dc" stroke-width=".9" stroke-linecap="round" opacity=".9"/>
      <rect x="8.9" y="19.6" width="2.2" height="4.6" rx=".4" fill="#f6f1ea" stroke="#c9b9a0" stroke-width=".4"/>
      <g${cls ? ' class="a2lfl"' : ''}>
        <path d="M10 13.9 Q12.6 17.2 10 19.8 Q7.4 17.2 10 13.9Z" fill="#ffb43a"/>
        <path d="M10 15.9 Q11.3 17.8 10 19.4 Q8.7 17.8 10 15.9Z" fill="#fff3c0"/>
      </g>
      <path d="M5.4 13.2 V24.8 M14.6 13.2 V24.8" stroke="${OUT}" stroke-width="2"/>
      <path d="M5.4 13.2 V24.8 M14.6 13.2 V24.8" stroke="${P.blech}" stroke-width="1.1"/>
      <rect x="3.8" y="24.6" width="12.4" height="3" rx=".8" fill="${P.rot}" stroke="${OUT}" stroke-width=".8"/>
      <path d="M5.2 25.6 H14.8" stroke="${P.hell}" stroke-width=".6" stroke-linecap="round" opacity=".8"/>
      <rect x="5" y="27.6" width="10" height="2" rx=".5" fill="${P.blech}" stroke="${OUT}" stroke-width=".7"/>`;

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="14.6" r="8.6" fill="#ffe27a" opacity=".32"/>
      <circle cx="12" cy="14.6" r="5.4" fill="#ffe27a" opacity=".38"/>
      <g transform="translate(4.4 .4) scale(.76)">${LANTERN_G(false)}</g></svg>`;

// Größe in der Szene: Breite in H (die Höhe ist das Anderthalbfache). Fuß: knapp vor der Wand des Baus (in H über der
// Bodenlinie), so steht er davor, wenn er an ihr vorbeigeht.
const LANTERN_W = 0.08;
const LANTERN_FOOT = 0.02;
// Mitte des Glases in Anteilen der Höhe, von unten (für den Lichtschein)
const LANTERN_GLASS = (30 - 19) / 30;
const LANTERN_SVG = `<svg viewBox="0 0 20 30" aria-hidden="true">${LANTERN_G(true)}</svg>`;

// Im Maul: .mf-item ist ein Feld von 24 × 24 vor der Schnauze, um 0,68 verkleinert (src/grafik/pika.js), das Maul liegt
// darin bei (−5,6 | 7,8). Dort hängt der Scheitel des Henkels; die Laterne pendelt um ihn (die mittlere Gruppe, siehe
// STYLE_A2_LANTERN) und hängt in Ruhe ein wenig nach vorn (CARRY_ROT, Grad). CARRY_S: so groß wie die Laterne in der
// Szene (Pika-Höhe 0,4 H auf 100 Einheiten der Pika-Grafik: eine Einheit des Felds ist 0,68 · 0,004 H).
const CARRY_ROT = -8;
const CARRY_S = (LANTERN_W / 20) / (0.68 * 0.004);
const carry = (P) => `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(-5.6 7.8) rotate(${CARRY_ROT})"><g>`
  + `<g transform="scale(${CARRY_S.toFixed(3)}) translate(-10 -1.2)">${LANTERN_G(false, P)}</g></g></g></svg>`;
const LANTERN_CARRY = carry(PAL);
const LANTERN_CARRY_GOLD = carry(PAL_GOLD);
// Mitte des Glases im Maul, vom Maul aus in Einheiten des Felds (vor dem Verkleinern um 0,68): [nach vorn, nach unten]
const CARRY_GLASS = [17.8 * CARRY_S * Math.sin((-CARRY_ROT * Math.PI) / 180), 17.8 * CARRY_S * Math.cos((CARRY_ROT * Math.PI) / 180)];

const A2_LANTERN = {
  key: 'lantern', name: 'Laterne', say: 'eine Laterne!', built: true, mo: null,
  icon: ICON,
  trick: 'Laternenlauf', gilt: 'eine goldene %', use: 'Abends trag ich sie über die Wiese.', gold: 'Glühwürmchen-Licht',
  find: { t: 'Laterne', h: 'Steht meine Laterne abends am Bau, tipp sie an. Die Flamme flackert auf.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]. Das Licht zeigt sich
  // erst in der Dämmerung (Leiste „Sonne“).
  dbg: [['Laterne tragen', 'a2LanternPlay', 1], ['Laternenlauf', 'a2LanternRun', 2], ['Glühwürmchen (golden)', 'a2LanternPlay', 3]],
};

export { A2_LANTERN, LANTERN_SVG, LANTERN_CARRY, LANTERN_CARRY_GOLD, LANTERN_W, LANTERN_FOOT, LANTERN_GLASS, CARRY_GLASS };
