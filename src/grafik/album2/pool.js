// Album 2: Planschbecken (t2 = 7). Daten, Bild fürs Album (24 × 24), das aufblasbare Becken in der Szene (in zwei
// Stücken: hinten Innenwand, Wasser und hinterer Rand, vorn Außenwand, vorderer Rand und das Wasser vor dem Pika), das
// zusammengelegte Becken im Maul und die goldene Gummiente. Felder siehe src/grafik/album2.js; die Szene:
// src/karte/album2-pool.js, der Stil: src/stil/album2-pool.js. Man bekommt es von Juni bis August.

import { OUT } from '../pika.js';

// Farben: Blau wie die Tropfen der Pfütze (DROP_SVG, src/grafik/beschaeftigungen.js), der Rand weiß
const BLAU = '#4a9ee6';
const BLAU_DUNKEL = '#2f7cc4';
const BLAU_HELL = '#8cc9f4';
const RAND = '#f7fbfd';
const RAND_SCHATTEN = '#cfe3ef';
const INNEN = '#a9dcf6';
const WASSER = '#6cc6f2';
const WASSER_HELL = '#dff4ff';

// Fürs Album: das Becken von vorn oben, mit Wasser und weißem Rand
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="18.6" rx="11.2" ry="3" fill="#3c5a2c" opacity=".16"/>
      <path d="M1.4 10.4 A10.6 4.4 0 0 0 22.6 10.4 L22.2 17 A10.2 3.4 0 0 1 1.8 17Z" fill="${BLAU}" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M1.7 13.9 A10.3 3.9 0 0 0 22.3 13.9" stroke="${BLAU_DUNKEL}" stroke-width=".8" fill="none"/>
      <path d="M4.4 15.6 Q7.4 16.9 10.4 17.2" stroke="${BLAU_HELL}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".9"/>
      <g fill="${RAND}"><circle cx="6.2" cy="12.6" r=".8"/><circle cx="12" cy="13.6" r=".8"/><circle cx="17.8" cy="12.6" r=".8"/></g>
      <ellipse cx="12" cy="10.4" rx="9.2" ry="3.1" fill="${INNEN}"/>
      <ellipse cx="12" cy="11.2" rx="8.2" ry="2.4" fill="${WASSER}"/>
      <path d="M6.4 10.4 Q9 9.5 11.6 9.8" stroke="${WASSER_HELL}" stroke-width=".7" fill="none" stroke-linecap="round"/>
      <ellipse cx="12" cy="10.4" rx="10.4" ry="4.1" fill="none" stroke="${OUT}" stroke-width="2.7"/>
      <ellipse cx="12" cy="10.4" rx="10.4" ry="4.1" fill="none" stroke="${RAND}" stroke-width="1.6"/></svg>`;

// Das Becken in der Szene, viewBox 160 × 64. Der Boden liegt bei y 52 (dort stehen die Füße des Pikas, wenn er in der
// Mitte steht; die Vorderkante am Boden reicht bis 61, darum sinkt das Bild um 12 Einheiten unter die Bodenlinie).
// Oberer Rand: Ellipse um (80, 25), 76 × 13, als dicker weißer Ring; Wasser: Ellipse um (80, 29), 66 × 9,5, liegt ganz
// im Ring. Beide Stücke haben dieselbe Box, eins liegt hinter dem Pika, eins vor ihm (siehe src/karte/album2-pool.js).
// .a2plb: alles, was sich beim Aufblasen aufrichtet (Mitte unten), .a2plwa: das Wasser (leer: sinkt und blendet aus),
// .a2plrp: Ringe auf dem Wasser (.rip), .a2plr: der weiße Rand (golden: Gold), .a2plst: Streifen (golden: Gold).
const POOL = {
  vb: [160, 64], floor: 52, rim: { cx: 80, cy: 25, rx: 76, ry: 13 }, water: { cx: 80, cy: 29, rx: 66, ry: 9.5 },
};
// Hinteres Stück: Schatten im Gras, Innenwand, Wasser mit Glanz und Ringen, hinterer Rand
const POOL_BACK_SVG = `<svg viewBox="0 0 160 64" aria-hidden="true">
      <ellipse cx="80" cy="55" rx="80" ry="8.5" fill="#3c5a2c" opacity=".18"/>
      <g class="a2plb">
        <ellipse cx="80" cy="25" rx="72.5" ry="9.5" fill="${INNEN}"/>
        <path d="M9 23 A72 9 0 0 1 151 23" stroke="#c9ebfb" stroke-width="2" fill="none" opacity=".9"/>
        <g class="a2plwa">
          <ellipse cx="80" cy="29" rx="66" ry="9.5" fill="${WASSER}"/>
          <path d="M26 24.6 Q48 21.4 72 21.6" stroke="${WASSER_HELL}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".85"/>
          <path d="M98 22.2 Q116 22.4 130 24.6" stroke="${WASSER_HELL}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".6"/>
          <g class="a2plrp" fill="none" stroke="#fff" stroke-width="1.1">
            <ellipse class="a2plr1" cx="80" cy="29" rx="30" ry="4.3"/><ellipse class="a2plr2" cx="80" cy="29" rx="30" ry="4.3"/></g>
        </g>
        <path d="M4 25 A76 13 0 0 1 156 25" stroke="${OUT}" stroke-width="9.4" fill="none"/>
        <path class="a2plr" d="M4 25 A76 13 0 0 1 156 25" stroke="${RAND}" stroke-width="7" fill="none"/>
        <path d="M20 19.4 Q50 12.6 80 12.4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      </g></svg>`;
// Vorderes Stück: das Wasser vor dem Pika (halb durchsichtig, die Hälfte der Wasser-Ellipse unter ihrer Mitte), davor
// Außenwand aus zwei Wülsten mit weißen Tupfen und der vordere Rand. Die Gummiente setzt die Szene als eigenes
// Element darüber (POOL_DUCK_SVG).
const POOL_FRONT_SVG = `<svg viewBox="0 0 160 64" aria-hidden="true">
      <g class="a2plb">
        <g class="a2plwa">
          <path d="M14 29 A66 9.5 0 0 0 146 29Z" fill="${WASSER}" opacity=".55"/>
          <g class="a2plrp" fill="none" stroke="#fff" stroke-width="1.1">
            <path class="a2plr1" d="M50 29 A30 4.3 0 0 0 110 29"/><path class="a2plr2" d="M50 29 A30 4.3 0 0 0 110 29"/></g>
        </g>
        <path d="M4.6 39 A75.4 11.6 0 0 0 155.4 39 L153 52 A73 9 0 0 1 7 52Z" fill="${BLAU}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M4 25 A76 13 0 0 0 156 25 L155.4 39 A75.4 11.6 0 0 1 4.6 39Z" fill="${BLAU}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8 44 Q40 55.6 80 56.4" stroke="${BLAU_HELL}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>
        <path d="M8 31.6 Q40 42.4 80 43.2" stroke="${BLAU_HELL}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>
        <path d="M5 39.4 A75.2 11.6 0 0 0 155 39.4" stroke="${BLAU_DUNKEL}" stroke-width="1.2" fill="none" opacity=".8"/>
        <g class="a2plst" fill="${RAND}">
          <circle cx="24" cy="42" r="2.2"/><circle cx="56" cy="47.6" r="2.2"/><circle cx="104" cy="47.6" r="2.2"/><circle cx="136" cy="42" r="2.2"/>
          <circle cx="40" cy="53.8" r="1.8"/><circle cx="80" cy="57" r="1.8"/><circle cx="120" cy="53.8" r="1.8"/>
        </g>
        <path d="M4 25 A76 13 0 0 0 156 25" stroke="${OUT}" stroke-width="9.4" fill="none"/>
        <path class="a2plr" d="M4 25 A76 13 0 0 0 156 25" stroke="${RAND}" stroke-width="7" fill="none"/>
        <path d="M10 31.4 Q44 39.6 80 40.2" stroke="${RAND_SCHATTEN}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path d="M30 34.4 Q52 37.2 70 37.6" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".9"/>
      </g></svg>`;
// Die goldene Gummiente (viewBox 24 × 20, schwimmt nach rechts; die Wasserlinie liegt bei y 16)
const POOL_DUCK_SVG = `<svg viewBox="0 0 24 20" aria-hidden="true">
      <path d="M3 11.6 Q2.4 8 5.6 8.6 Q8 9.2 10.4 9.6 Q9.4 6.4 11 4.2 Q13.4 1.4 16.6 2.6 Q19.6 4 18.8 7.6 Q18.4 9.4 16.8 10.4
        Q20.6 11 20.4 13.6 Q19.8 16.6 14 16.6 H7.4 Q3.4 16.4 3 11.6Z" fill="#f6c945" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M8.2 12 Q11.2 14.4 15.4 12.4" stroke="#d99a1e" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M18.4 6.2 Q21.8 6 22.4 7.4 Q21.6 8.6 18.4 8.4Z" fill="#f08a3a" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>
      <circle cx="15.8" cy="5.4" r="1" fill="${OUT}"/><circle cx="16.1" cy="5.1" r=".35" fill="#fff"/>
      <path d="M12 4.4 Q13 3.4 14.4 3.4" stroke="#fff6c8" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M5.4 10.2 Q6.4 9.6 7.6 10" stroke="#fff6c8" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M1 16.6 Q5 15.4 9 16.6 T17 16.6 T23 16.6" stroke="${WASSER_HELL}" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`;
// Zusammengelegt im Maul (24 × 24, wie _mouth es braucht: ohne id und class)
const POOL_MOUTH = `<svg viewBox="0 0 24 24">
      <path d="M4.6 11 Q4 8.6 6.6 8.4 H17.4 Q20 8.6 19.4 11 L18.6 17.4 Q18.4 19 16.6 19 H7.4 Q5.6 19 5.4 17.4Z" fill="${BLAU}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M5 12 H19" stroke="${RAND}" stroke-width="2"/>
      <path d="M7 15.6 H17" stroke="${BLAU_DUNKEL}" stroke-width=".8" stroke-linecap="round"/>
      <circle cx="9" cy="17.2" r=".8" fill="${RAND}"/><circle cx="15" cy="17.2" r=".8" fill="${RAND}"/></svg>`;
// Farbe am Maul (für _mouth)
const POOL_FARBE = BLAU;
// Breite des Beckens in Pika-Breiten
const POOL_W = 1.5;

const A2_POOL = {
  key: 'pool', name: 'Planschbecken', say: 'ein Planschbecken!', built: true, mo: [5, 6, 7],
  icon: ICON,
  trick: 'Arschbombe', gilt: 'ein goldenes %', use: 'Für heiße Tage ab 25 Grad. Platsch!', gold: 'eine Gummiente schwimmt mit',
  find: { t: 'Planschbecken', h: 'Steht mein Planschbecken draußen: hineintippen. Plitsch, das Wasser kräuselt sich.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]
  dbg: [['Planschen', 'a2PoolPlay', 1], ['Arschbombe', 'a2PoolBomb', 2], ['Gummiente (golden)', 'a2PoolPlay', 3]],
};

export { A2_POOL, POOL, POOL_BACK_SVG, POOL_FRONT_SVG, POOL_DUCK_SVG, POOL_MOUTH, POOL_FARBE, POOL_W };
