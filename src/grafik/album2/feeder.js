// Album 2: Vogelhäuschen (t2 = 0). Daten, Bild fürs Album (24 × 24), das Häuschen in der Szene und der Gimpel, der zum
// goldenen kommt. Felder siehe src/grafik/album2.js; die Szene: src/karte/album2-feeder.js, der Stil:
// src/stil/album2-feeder.js.

import { OUT } from '../pika.js';

// Farben wie die Schätze aus Album 1: Holz wie Windrad und Hängematte, Dach im Rot des Windrads
const HOLZ = '#9a6a3c';
const HOLZ_HELL = '#c98e4e';
const DACH = '#e8584e';
const KORN = '#f3d58a';

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16.6 V23.2" stroke="${HOLZ}" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 20 L9.4 23.2 M12 20 L14.6 23.2" stroke="${HOLZ}" stroke-width="1.1" stroke-linecap="round"/>
      <rect x="6.6" y="9.8" width="10.8" height="6" fill="#6e4a30"/>
      <path d="M6 9.8 V15.8 M18 9.8 V15.8" stroke="${HOLZ}" stroke-width="1.5"/>
      <path d="M8.2 15.6 Q12 12.4 15.8 15.6Z" fill="${KORN}" stroke="#c9a24a" stroke-width=".5" stroke-linejoin="round"/>
      <rect x="3.8" y="15.4" width="16.4" height="2.2" rx=".7" fill="${HOLZ_HELL}" stroke="${OUT}" stroke-width=".8"/>
      <path d="M2.2 10.9 L12 3 L21.8 10.9 L20.6 11.9 L12 5.4 L3.4 11.9Z" fill="${DACH}" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M5.8 8.6 L11 4.6" stroke="#ffa497" stroke-width=".9" stroke-linecap="round" opacity=".8"/></svg>`;

// Das Häuschen auf seinem Pfahl: viewBox 32 × 64, Fuß des Pfahls bei y 64 (steht im Gras). Futterbrett von x 3 bis 29
// bei y 28, Dachfirst bei 16/3. .a2fs: die Körner (leer, solange er nachfüllt), .a2fh: Häuschen und Dach (wackeln beim
// Antippen um den Pfahl).
const FEEDER_SVG = `<svg viewBox="0 0 32 64" aria-hidden="true">
      <path d="M16 30 V63.4" stroke="${OUT}" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M16 30 V63.4" stroke="${HOLZ}" stroke-width="3" stroke-linecap="round"/>
      <path d="M16 42 L9 31 M16 42 L23 31" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M16 42 L9 31 M16 42 L23 31" stroke="${HOLZ}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M16 57 q-2 4 -5.6 6.4 M16 57 q2.4 4 6 6.2" stroke="#6bab4c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <g class="a2fh">
        <rect x="7.4" y="14.6" width="17.2" height="13.4" fill="#6e4a30" stroke="${OUT}" stroke-width=".8"/>
        <path d="M9 17 H23" stroke="#5a3a22" stroke-width=".7" opacity=".7"/>
        <g class="a2fs">
          <path d="M9.4 28 Q16 21.6 22.6 28Z" fill="${KORN}" stroke="#c9a24a" stroke-width=".6" stroke-linejoin="round"/>
          <g fill="#b98a3e"><circle cx="13" cy="26.4" r=".55"/><circle cx="16.4" cy="25" r=".55"/><circle cx="19.2" cy="26.6" r=".55"/>
            <circle cx="5.6" cy="27.4" r=".5"/><circle cx="26.8" cy="27.3" r=".5"/></g>
          <g fill="${KORN}"><circle cx="6.6" cy="27.3" r=".7"/><circle cx="25.4" cy="27.4" r=".7"/><circle cx="24" cy="27.2" r=".6"/></g>
        </g>
        <path d="M6.6 14.6 V28 M25.4 14.6 V28" stroke="${OUT}" stroke-width="2.8"/>
        <path d="M6.6 14.6 V28 M25.4 14.6 V28" stroke="${HOLZ}" stroke-width="1.5"/>
        <rect x="2.6" y="27.6" width="26.8" height="3.4" rx="1" fill="${HOLZ_HELL}" stroke="${OUT}" stroke-width=".9"/>
        <path d="M4.4 29 H27.6" stroke="#e0b47c" stroke-width=".8" stroke-linecap="round"/>
        <path d="M.6 16.2 L16 2.6 L31.4 16.2 L29.4 17.8 L16 6.4 L2.6 17.8Z" fill="${DACH}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M5.4 12.6 L13.8 5.2" stroke="#ffa497" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
      </g></svg>`;
// Wo Vögel sitzen (Füße), in Anteilen von Breite und Höhe des Bilds: linkes und rechtes Ende des Futterbretts, First
const FEEDER_SPOTS = [[5.6 / 32, 27.8 / 64], [26.4 / 32, 27.8 / 64], [16 / 32, 5 / 64]];
// Größe in der Szene (Breite in H; die Höhe ist das Doppelte)
const FEEDER_W = 0.12;
// Der Gimpel, der zum goldenen Vogelhäuschen kommt: Farben für BIRD_SVG (src/grafik/besucher.js). Nicht in BIRDS:
// Dort wählt der Besuch nach der Uhr per Index, ein Eintrag mehr änderte die Vögel aller Geräte.
const GIMPEL = { name: 'Gimpel', body: '#9a9ca6', head: '#9a9ca6', wing: '#3a3a44', breast: '#e5654f', face: '#e5654f', cap: '#1f1f26', beak: '#1f1a17' };
// Körner, die beim Nachfüllen und beim Antippen rieseln (viewBox 4 × 4)
const SEED_SVG = `<svg viewBox="0 0 4 4" aria-hidden="true"><ellipse cx="2" cy="2" rx="1.3" ry="1.7" fill="${KORN}" stroke="#b98a3e" stroke-width=".5"/></svg>`;

const A2_FEEDER = {
  key: 'feeder', name: 'Vogelhäuschen', say: 'ein Vogelhäuschen!', built: true, mo: null,
  icon: ICON,
  trick: 'Körner nachfüllen', gilt: 'ein goldenes %', use: 'Da picken die Vögel, ich schau zu.', gold: 'ein Gimpel kommt',
  find: { t: 'Vogelhäuschen', h: 'Tipp mein Vogelhäuschen an. Es wackelt, und ein paar Körner rieseln heraus.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]
  dbg: [['Vögel picken', 'a2FeederPlay', 1], ['Körner nachfüllen', 'a2FeederFill', 2], ['Gimpel (golden)', 'a2FeederPlay', 3]],
};

export { A2_FEEDER, FEEDER_SVG, FEEDER_SPOTS, FEEDER_W, GIMPEL, SEED_SVG };
