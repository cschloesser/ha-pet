// Album 2: Radio (t2 = 4). Daten, Bild fürs Album (24 × 24), das Kofferradio in der Szene, das Radio im Maul (er trägt
// es am Henkel) und die Noten, die aufsteigen. Felder siehe src/grafik/album2.js; die Szene:
// src/karte/album2-radio.js, der Stil: src/stil/album2-radio.js. Ganzjährig. Ton gibt es keinen (die Karte spielt
// nirgends etwas ab): Die Musik sieht man an den Noten und am Lautsprecher.

import { OUT } from '../pika.js';

// Farben: Gehäuse in einem Türkis, das es in der Szene noch nicht gibt (Rot und Holz tragen schon Windrad, Häuschen und
// Schlitten), Front cremeweiß wie alte Kofferradios, Knöpfe im Holz der Schätze aus Album 1
const GEH = '#4fa9a0';
const GEH_HELL = '#8fd3c8';
const FRONT = '#f3e6c8';
const GRILL = '#8a735b';
const GRILL_HELL = '#b29776';
const SKALA = '#fff7dc';
const ZEIGER = '#e8584e';
const KNOPF = '#c98e4e';
const HENKEL = '#6e4a30';
const ANT = '#cfd6dc';

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.6 9.6 L22 2.6" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M17.6 9.6 L22 2.6" stroke="${ANT}" stroke-width=".7" stroke-linecap="round"/>
      <circle cx="22" cy="2.6" r=".9" fill="${ANT}" stroke="${OUT}" stroke-width=".5"/>
      <path d="M7.4 9.8 V7.4 Q7.4 5.6 9.2 5.6 H14.8 Q16.6 5.6 16.6 7.4 V9.8" stroke="${OUT}" stroke-width="2.2" fill="none"/>
      <path d="M7.4 9.8 V7.4 Q7.4 5.6 9.2 5.6 H14.8 Q16.6 5.6 16.6 7.4 V9.8" stroke="${HENKEL}" stroke-width="1" fill="none"/>
      <rect x="1.6" y="9.4" width="20.8" height="12.6" rx="2.4" fill="${GEH}" stroke="${OUT}" stroke-width=".9"/>
      <path d="M3.6 10.8 H20.4" stroke="${GEH_HELL}" stroke-width=".7" stroke-linecap="round"/>
      <rect x="3" y="12" width="18" height="8.6" rx="1.4" fill="${FRONT}" stroke="${OUT}" stroke-width=".6"/>
      <circle cx="8" cy="16.3" r="3.3" fill="${GRILL}" stroke="${OUT}" stroke-width=".6"/>
      <circle cx="8" cy="16.3" r="1.6" fill="none" stroke="${GRILL_HELL}" stroke-width=".6"/>
      <rect x="13" y="13.4" width="6.6" height="3" rx=".6" fill="${SKALA}" stroke="${OUT}" stroke-width=".5"/>
      <path d="M16.4 13.6 V16.2" stroke="${ZEIGER}" stroke-width=".7"/>
      <circle cx="14.6" cy="18.6" r="1.2" fill="${KNOPF}" stroke="${OUT}" stroke-width=".5"/>
      <circle cx="18" cy="18.6" r="1.2" fill="${KNOPF}" stroke="${OUT}" stroke-width=".5"/></svg>`;

// Das Radio von vorn: viewBox 40 × 44, Füße unten bei y 44 (steht im Gras), Henkel oben bei y 9,4 (dort sitzt der
// goldene Besuch, dort trägt er es im Maul). cls: mit den Klassen für den Stil (.a2rant Antenne, .a2rsp Lautsprecher,
// .a2rnd Zeiger, .a2rkn Knopf, .a2rst Rauschen); ohne (im Maul) keine, sonst griffe das Stylesheet des Pikas.
// ant: Antenne ausgezogen (im Maul eingeschoben)
const RADIO_G = (cls = true, ant = true) => {
  const c = (k) => (cls ? ` class="${k}"` : '');
  const a = ant ? '' : ' transform="translate(31 17) scale(.32) translate(-31 -17)"';
  return `
      <g${c('a2rant')}${a}>
        <path d="M31 17 L38.4 2.2" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M31 17 L38.4 2.2" stroke="${ANT}" stroke-width="1" stroke-linecap="round"/>
        <path d="M34.2 10.6 L35.4 8.2" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="38.4" cy="2.2" r="1.3" fill="${ANT}" stroke="${OUT}" stroke-width=".7"/>
      </g>
      <path d="M11.6 17.6 V13 Q11.6 10.4 14.2 10.4 H25.8 Q28.4 10.4 28.4 13 V17.6" stroke="${OUT}" stroke-width="3" fill="none"/>
      <path d="M11.6 17.6 V13 Q11.6 10.4 14.2 10.4 H25.8 Q28.4 10.4 28.4 13 V17.6" stroke="${HENKEL}" stroke-width="1.5" fill="none"/>
      <rect x="6" y="40.4" width="5.4" height="3.4" rx="1" fill="${OUT}"/>
      <rect x="28.6" y="40.4" width="5.4" height="3.4" rx="1" fill="${OUT}"/>
      <rect x="1.6" y="16.8" width="36.8" height="24.4" rx="4" fill="${GEH}" stroke="${OUT}" stroke-width="1.1"/>
      <path d="M5 19.2 H35" stroke="${GEH_HELL}" stroke-width="1" stroke-linecap="round"/>
      <rect x="4.4" y="21.2" width="31.2" height="17.4" rx="2.4" fill="${FRONT}" stroke="${OUT}" stroke-width=".8"/>
      <g${c('a2rsp')}>
        <circle cx="13" cy="29.9" r="6.4" fill="${GRILL}" stroke="${OUT}" stroke-width=".8"/>
        <circle cx="13" cy="29.9" r="4.4" fill="none" stroke="${GRILL_HELL}" stroke-width=".8"/>
        <circle cx="13" cy="29.9" r="2.2" fill="none" stroke="${GRILL_HELL}" stroke-width=".8"/>
        <circle cx="13" cy="29.9" r=".8" fill="${GRILL_HELL}"/>
      </g>
      <rect x="22.4" y="23.4" width="11.2" height="5.6" rx="1" fill="${SKALA}" stroke="${OUT}" stroke-width=".7"/>
      <path d="M24 24.8 v1.6 M26 24.8 v1 M28 24.8 v1.6 M30 24.8 v1 M32 24.8 v1.6" stroke="#a8977b" stroke-width=".5"/>
      <path${c('a2rnd')} d="M28 23.8 V28.6" stroke="${ZEIGER}" stroke-width="1" stroke-linecap="round"/>
      <g${c('a2rkn')}>
        <circle cx="25.2" cy="34.2" r="2.6" fill="${KNOPF}" stroke="${OUT}" stroke-width=".8"/>
        <path d="M25.2 34.2 V31.9" stroke="${OUT}" stroke-width=".8" stroke-linecap="round"/>
      </g>
      <circle cx="31.4" cy="34.2" r="2.6" fill="${KNOPF}" stroke="${OUT}" stroke-width=".8"/>
      <path d="M31.4 34.2 L33.1 32.6" stroke="${OUT}" stroke-width=".8" stroke-linecap="round"/>
      ${cls ? `<g class="a2rst" fill="#7d7d84">
        <rect x="7.6" y="24.6" width="2" height=".9"/><rect x="13.6" y="26.2" width="2.6" height=".9"/><rect x="9" y="31.4" width="1.6" height=".9"/>
        <rect x="15.4" y="33" width="2.2" height=".9"/><rect x="11" y="28" width="1.4" height=".9"/><rect x="23.6" y="26.6" width="2" height=".8"/>
        <rect x="29.4" y="25" width="2.4" height=".8"/><rect x="26.4" y="27.4" width="1.4" height=".8"/>
        <path d="M2.6 12.6 L.4 10.8 L2.4 9.4 L.2 7.6 M37.4 12.4 L39.6 14.2 L37.8 15.6" stroke="#7d7d84" stroke-width="1" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>
      </g>` : ''}`;
};
const RADIO_SVG = `<svg viewBox="0 0 40 44" aria-hidden="true">${RADIO_G()}</svg>`;
// Breite in der Szene (Anteil der Pika-Breite pW; die Höhe ist 44/40 davon). So ist es ein kleines Kofferradio: ein
// Drittel so breit wie er, gut ein Drittel so hoch.
const RADIO_W = 0.34;
const RADIO_H = RADIO_W * (44 / 40);
// Stellen im Bild, in Anteilen von Breite und Höhe: Henkel oben (Füße des goldenen Besuchs), Mitte des Lautsprechers
// (dort steigen die Noten auf)
const RADIO_HANDLE = [20 / 40, 9.4 / 44];
const RADIO_SPEAKER = [13 / 40, 29.9 / 44];
// Sender: wo der Zeiger steht (Verschiebung in Einheiten des Bilds gegenüber x 28), Takt eines Wippens in ms, Farben der
// Noten, was er dazu sagt. Antippen schaltet weiter.
const RADIO_SENDER = [
  { nd: 0, beat: 520, col: ['#e8584e', '#5b97d8', '#f2b93a'], say: ['Musik!', 'oh, Musik!', 'mein Lied!'] },
  { nd: -3.6, beat: 640, col: ['#7a68c9', '#5b97d8', '#4fa9a0'], say: ['Jazz!', 'schubidu!', 'so lässig!'] },
  { nd: 3.8, beat: 430, col: ['#e2629b', '#6bab4c', '#f2b93a'], say: ['Disko!', 'schneller!', 'Party!'] },
];

// Im Maul: am Henkel, das Radio hängt darunter, Antenne eingeschoben. Maßstab wie in der Szene (Pika-Grafik 120 Einheiten
// breit = pW, das Futter im Maul ist um 0,68 verkleinert: eine Einheit des Felds ist pW / 120 · 0,68)
const CARRY_S = (RADIO_W * 120) / (0.68 * 40);
const RADIO_CARRY = `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(3 -1) rotate(-5)">`
  + `<g transform="scale(${CARRY_S.toFixed(3)}) translate(-20 -9.4)">${RADIO_G(false, false)}</g></g></svg>`;

// Noten, die aus dem Lautsprecher steigen (viewBox 16 × 16; Farbe über currentColor): Achtel und zwei Achtel am Balken
const NOTE_SVG = [
  `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.6 12 V2.2 Q13.6 3.6 12.8 8.4 Q11.8 5.6 8.6 5.4" fill="currentColor" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`
    + `<ellipse cx="5.8" cy="12.4" rx="3.3" ry="2.5" transform="rotate(-22 5.8 12.4)" fill="currentColor" stroke="${OUT}" stroke-width=".8"/></svg>`,
  `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.6 12.6 V3.6 L14 1.6 V10.8" fill="none" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<path d="M5.6 12.6 V3.6 L14 1.6 V10.8" fill="none" stroke="currentColor" stroke-width=".9" stroke-linejoin="round"/>`
    + `<ellipse cx="3.6" cy="13" rx="2.6" ry="2" transform="rotate(-22 3.6 13)" fill="currentColor" stroke="${OUT}" stroke-width=".8"/>`
    + `<ellipse cx="12" cy="11.2" rx="2.6" ry="2" transform="rotate(-22 12 11.2)" fill="currentColor" stroke="${OUT}" stroke-width=".8"/></svg>`,
];

const A2_RADIO = {
  key: 'radio', name: 'Radio', say: 'ein Radio!', built: true, mo: null,
  icon: ICON,
  trick: 'Drehtanz', gilt: 'ein goldenes %', use: 'Musik an, und ich tanze.', gold: 'goldene Noten, und ein Vögelchen wippt mit',
  find: { t: 'Radio', h: 'Hör ich Radio, tipp es an. Es rauscht, und schon läuft ein anderer Sender.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]
  dbg: [['Radio tanzen', 'a2RadioPlay', 1], ['Drehtanz', 'a2RadioSpin', 2], ['Goldene Noten (golden)', 'a2RadioPlay', 3]],
};

export { A2_RADIO, RADIO_SVG, RADIO_CARRY, RADIO_W, RADIO_H, RADIO_HANDLE, RADIO_SPEAKER, RADIO_SENDER, NOTE_SVG };
