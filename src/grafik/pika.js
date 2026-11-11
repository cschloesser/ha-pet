// Pika: Fellfarben, Körperteile, Requisiten in den Pfoten (Kaffee, Beschäftigungen, Päckchen), die Pika-Grafik

import { clamp } from '../logik/hilfen.js';

// ---------- Grafiken ----------

const OUT = '#5a4030';
// Fellfarben als CSS-Variablen (Name → Tagesfarbe). Nachts und im Bau setzt der STYLE dunklere Werte,
// ein CSS-Filter auf dem atmenden Pika müsste sonst jedes Bild neu gerechnet werden.
const PK_FILL = {
  fu1: '#d0ad8d', fu2: '#b08a68', fu3: '#8a664b', bel: '#f0e2cf', ear: '#efe3d3', ein: '#e3a990',
  paw: '#ecdcc6', mou: '#f4e8d8', cap: '#7c9be0', cpw: '#ffffff',
};
const PK = (k) => `var(--pk-${k}, ${PK_FILL[k]})`;
// Wie filter: brightness(b) saturate(s), nur einmal ausgerechnet
const PK_DIM = (b, s) => Object.entries(PK_FILL).map(([k, hex]) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * b);
  const L = 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2];
  return `--pk-${k}: #${c.map((v) => Math.round(clamp(L + (v - L) * s, 0, 255)).toString(16).padStart(2, '0')).join('')};`;
}).join(' ');
// Accessoires mit festen Farben (Schal, Hüte, Tasse ohne die Pfoten, Milchschaum) unter dem Vorsatz pre
const PK_ACC = (pre) => ['.scarf', '.hats', '.cfoam', '.cup > g > g > :not(.cps)'].map((s) => `${pre} ${s}`).join(', ');
// Körper als eine durchgehende Bohnenform (Pikas haben keinen sichtbaren Hals)
const BODY = 'M30 90 C14 88 11 61 25 49 C37 37 55 31 67 28 C76 21 99 19 107 35 C113 48 112 66 104 78 C100 85 96 90 88 91 C70 94 46 94 30 90 Z';
const EAR = (cx, cy, side) => `
    <g class="ear ear-${side}">
      <circle cx="${cx}" cy="${cy}" r="12.4" fill="${OUT}"/>
      <circle cx="${cx}" cy="${cy}" r="10.8" fill="${PK('ear')}"/>
      <circle cx="${cx}" cy="${cy + 0.8}" r="8.8" fill="url(#fur)"/>
      <ellipse cx="${cx}" cy="${cy + 1.8}" rx="4.9" ry="5.5" fill="${PK('ein')}"/>
    </g>`;
const EYE = (cx, side) => `
    <g class="eye eye-${side}">
      <ellipse cx="${cx}" cy="46" rx="3.9" ry="4.6" fill="#2a1a12"/>
      <circle class="hl1" cx="${cx + 1.4}" cy="44.2" r="1.5" fill="#fff"/>
      <circle cx="${cx - 0.9}" cy="47.9" r=".7" fill="#fff"/>
      <path class="estar" d="M${cx + 1.2} 41.6 Q${cx + 1.6} 43.8 ${cx + 3.6} 44.2 Q${cx + 1.6} 44.6 ${cx + 1.2} 46.8 Q${cx + 0.8} 44.6 ${cx - 1.2} 44.2 Q${cx + 0.8} 43.8 ${cx + 1.2} 41.6Z" fill="#fff"/>
    </g>
    <path class="seye seye-${side}" d="M${cx - 3.8} 46.6 q3.8 3.2 7.6 0"/>
    <path class="heye" d="M${cx - 3.8} 47.6 q3.8 -3.8 7.6 0"/>`;

// Rückansicht beim Fernsehen: runder Rücken, Ohren von hinten, Lichtsaum in der Farbe des Fernsehbilds
const BACK = 'M58 92 C53 74 60 54 69 45 C71 33 79 28 86.5 28 C94 28 102 33 104 45 C113 54 120 74 115 92 C102 96 71 96 58 92Z';
const BACK_EAR = (cx, side) => `
    <g class="ear ear-${side}">
      <circle cx="${cx}" cy="28" r="11.5" fill="url(#fur)" stroke="${OUT}" stroke-width="2.2"/>
      <circle cx="${cx}" cy="28" r="11.5" fill="#140d1e" opacity=".5"/>
      <circle class="rim" cx="${cx}" cy="28" r="11.5" fill="none" stroke="var(--tvc, #9fd0ff)" stroke-width="1.4"/>
    </g>`;

// Kaffee in den Pfoten (Abschnitt "Kaffee"): Glas (Latte, Milch), Tasse mit Schaum (Cappuccino & Co.), Espressotasse,
// Becher (Kaffee, Tee). .lq sinkt mit --lv (Füllstand 1 … 0), .lqs (Schaum, Crema) verblasst, .cst = Dampf.
// Gezeichnet in 1:1, dann um 1,35 vergrößert und etwas tiefer an den Bauch gesetzt. .cpr ist die Pfote, die bei Regen den Blattschirm hält.
const CUP_STEAM = (x, y) => `<g class="cst" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round">
        <path d="M${x - 2} ${y} q-1.4 -2.2 0 -4.4 q1.4 -2.2 0 -4.4"/><path d="M${x + 2} ${y - 0.6} q-1.4 -2.2 0 -4.4 q1.4 -2.2 0 -4.4"/></g>`;
const CUP_PAWS = (l, r) => `<g class="cps" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.05">
        <ellipse cx="${l[0]}" cy="${l[1]}" rx="3" ry="3.8"/><ellipse class="cpr" cx="${r[0]}" cy="${r[1]}" rx="3" ry="3.8"/></g>`;
const CUP_SVG = `
      <g class="cup"><g transform="translate(0 4) translate(92 80) scale(1.35) translate(-92 -80)">
        <g class="k-glass">
          ${CUP_STEAM(92, 62)}
          <path d="M95.2 64 L99.6 55.6" stroke="#b9c0c8" stroke-width="1.1" stroke-linecap="round"/>
          <g class="lq">
            <path d="M87.5 74.2 H96.5 L96.4 80 Q92 81.2 87.6 80Z" fill="#f4ead9"/>
            <path class="cof" d="M87.2 69 H96.8 L96.5 74.2 H87.5Z" fill="#b07a4c"/>
            <path d="M86.9 64.6 H97.1 L96.8 69 H87.2Z" fill="#fffaf3"/>
          </g>
          <path d="M86.6 63 L97.4 63 L96.4 80 Q92 81.2 87.6 80 Z" fill="#dff1ff" fill-opacity=".22" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <path d="M88.6 65 L89.2 78" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".7"/>
          ${CUP_PAWS([86.4, 72], [97.6, 71.4])}
        </g>
        <g class="k-capp">
          ${CUP_STEAM(92, 67.6)}
          <ellipse cx="92" cy="79.4" rx="11" ry="2.2" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9"/>
          <path d="M99.2 71 q4.4 -.4 3.8 3.1 q-.6 2.7 -4.6 2.4" fill="none" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M99.2 71 q4.4 -.4 3.8 3.1 q-.6 2.7 -4.6 2.4" fill="none" stroke="#f6f1ea" stroke-width=".9" stroke-linecap="round"/>
          <path d="M84.5 69 H99.5 Q99 78.2 92 78.4 Q85 78.2 84.5 69Z" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <ellipse cx="92" cy="69" rx="7.5" ry="1.7" fill="#5b3620"/>
          <g class="lqs">
            <ellipse cx="92" cy="69.1" rx="6.6" ry="1.35" fill="#fff6e8"/>
            <path d="M91.2 68.6 q-1 -.9 0 -1.2 q.8 -.1 .8 .5 q0 -.6 .8 -.5 q1 .3 0 1.2 l-.8 .6z" fill="#c9915e"/>
          </g>
          ${CUP_PAWS([83.8, 74.4], [100.6, 78.6])}
        </g>
        <g class="k-esp">
          ${CUP_STEAM(92, 71.6)}
          <ellipse cx="92" cy="79.6" rx="8.2" ry="1.8" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9"/>
          <path d="M96.2 73.8 q3 -.2 2.6 2 q-.4 1.8 -3.2 1.6" fill="none" stroke="${OUT}" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M87.6 73 H96.4 Q96 78.6 92 78.7 Q88 78.6 87.6 73Z" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <ellipse cx="92" cy="73" rx="4.4" ry="1.05" fill="#3b2417"/>
          <ellipse class="lqs" cx="92" cy="73.05" rx="3.8" ry=".8" fill="#c58a52"/>
          ${CUP_PAWS([86.2, 76.4], [98.2, 79])}
        </g>
        <g class="k-mug">
          ${CUP_STEAM(92, 64.6)}
          <path d="M99 68.6 q4.8 0 4.8 4 q0 4 -4.8 4" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M99 68.6 q4.8 0 4.8 4 q0 4 -4.8 4" fill="none" stroke="#4f86c6" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M85 66 H99 V77.6 Q99 80 96.6 80 H87.4 Q85 80 85 77.6Z" fill="#4f86c6" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <g fill="#fff" opacity=".85"><circle cx="88.6" cy="70.6" r=".9"/><circle cx="92.4" cy="74.2" r=".9"/><circle cx="95.8" cy="70.2" r=".9"/><circle cx="89.4" cy="77" r=".9"/></g>
          <ellipse cx="92" cy="66" rx="7" ry="1.5" fill="#2b1a10"/>
          <ellipse class="lqs" cx="92" cy="66.1" rx="6.1" ry="1.05" fill="#6b4428"/>
          <g class="ttag"><path d="M95.6 66 Q97.6 64.6 99.4 66.4 V70" stroke="#e8e2d6" stroke-width=".6" fill="none"/>
            <rect x="97.6" y="69.6" width="3.6" height="4.2" rx=".5" fill="#f6c945" stroke="${OUT}" stroke-width=".5"/></g>
          ${CUP_PAWS([85, 72.6], [99, 74.6])}
        </g>
      </g></g>`;
// Milchschaum-Bärtchen unter der Nase nach dem ersten Schluck
const CUP_FOAM = `<path class="cfoam" d="M85.6 55.6 q1.4 -1.8 3 -.6 q1.2 -1.2 2.4 -.2 q1.2 -1 2.4 .2 q1.6 -1.2 3 .6 q-2.6 1.6 -5.4 1 q-2.8 .6 -5.4 -1z"
          fill="#fffaf2" stroke="rgba(0,0,0,.2)" stroke-width=".4"/>`;

// ---------- Aktivitäten: Requisiten am Pika (Musik, Malen, Seifenblasen, Frühsport, Seil, Hantel, Winken; ab 0.32
// Reifen, Jo-Jo, Pusteblume, Beeren, Blumenkranz, Papierflieger, Kiesel, Papierschiffchen) ----------
// Alle in derselben viewBox wie der Pika (120 × 100, Blick nach rechts), sichtbar nur mit der Klasse am .pika.
const ACT_PAW = (cx, cy, cls = '', rx = 3.8, ry = 4.6) =>
  `<ellipse${cls ? ` class="${cls}"` : ''} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4"/>`;
// Hula-Hoop-Reifen: die hintere Hälfte liegt hinter dem Körper (hoop-b), die vordere davor (hoop-f)
const HOOP = (d) => `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="4.4" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="#f28fb1" stroke-width="3" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 10" opacity=".9"/>`;
// Gänseblümchen (Kranz): fünf Blütenblätter um eine gelbe Mitte
const DAISY = (x, y, c = '#fff', s = 1) => `<g fill="${c}" stroke="rgba(0,0,0,.2)" stroke-width=".3">${[0, 72, 144, 216, 288].map((a) =>
  `<circle cx="${(x + 1.7 * s * Math.sin((a * Math.PI) / 180)).toFixed(2)}" cy="${(y - 1.7 * s * Math.cos((a * Math.PI) / 180)).toFixed(2)}" r="${(1.35 * s).toFixed(2)}"/>`).join('')}</g>
        <circle cx="${x}" cy="${y}" r="${(1.15 * s).toFixed(2)}" fill="#f6c945"/>`;
// Papierschiffchen (30 × 24): in der Pfote und auf der Pfütze dieselbe Zeichnung
const BOAT_ART = `<path d="M15 2.5 L22 13.5 H8Z" fill="#fffaf0" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M15 2.5 V13.5" stroke="#d6d3c4" stroke-width=".7"/>
          <path d="M1.5 12 L10.5 13.5 H19.5 L28.5 12 L22 21.5 H8Z" fill="#fbf8f0" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M10.5 13.5 L8 21.5 M19.5 13.5 L22 21.5" stroke="#d6d3c4" stroke-width=".7"/>`;
// Springseil: dieselbe Schlaufe zweimal, hinter dem Körper (rope-b) und davor (rope-f); hinten ist der Griff verdeckt
const ROPE_D = 'M24 56 C22 115 110 115 108 56';
const ACT_BACK = `
      <g class="rope rope-b"><path d="${ROPE_D}" fill="none" stroke="#d9443a" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></g>
      <g class="hoop hoop-b">${HOOP('M2 69 A60 11 0 0 1 122 69')}</g>`;
const ACT_FRONT = `
      <g class="band">
        <path d="M70.5 37.5 q-6.5 -1.6 -9.4 3.4 q4.4 .2 7 2.4z M70.5 38 q-4.6 3.4 -5.6 8.6 q3.8 -2.8 7.6 -4z" fill="#e8584e" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M70 37.5 Q88 21 108 36" stroke="${OUT}" stroke-width="6.4" fill="none" stroke-linecap="round"/>
        <path d="M70 37.5 Q88 21 108 36" stroke="#e8584e" stroke-width="4.8" fill="none" stroke-linecap="round"/>
        <path d="M71 36.6 Q88 21.6 107.2 35.2" stroke="#fff" stroke-width="1.1" fill="none" opacity=".9"/>
      </g>
      <g class="arms">${ACT_PAW(68, 42)}${ACT_PAW(116, 40)}</g>
      <g class="uke">
        <g transform="translate(79 75) rotate(-30)">
          <rect x="12" y="-1.7" width="22" height="3.4" rx=".8" fill="#8a5a32" stroke="${OUT}" stroke-width=".8"/>
          <path d="M33 -3 h6.5 q1.5 0 1.5 1.5 v3 q0 1.5 -1.5 1.5 h-6.5z" fill="#6b4426" stroke="${OUT}" stroke-width=".8"/>
          <g fill="#efe6d2"><circle cx="35.5" cy="-3.7" r=".9"/><circle cx="38.6" cy="-3.7" r=".9"/><circle cx="35.5" cy="3.7" r=".9"/><circle cx="38.6" cy="3.7" r=".9"/></g>
          <path d="M-8 0 C-8 -7.5 -1 -8.5 3 -5.5 C5.5 -7.5 12.5 -7 12.5 0 C12.5 7 5.5 7.5 3 5.5 C-1 8.5 -8 7.5 -8 0Z" fill="#dc9a4e" stroke="${OUT}" stroke-width="1.2"/>
          <path d="M-6 -2.6 C-5 -5.6 -1.4 -6 1.4 -4.2" stroke="#f3c48a" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>
          <circle cx="5.5" cy="0" r="2.4" fill="#5a3a22"/>
          <rect x="-5.6" y="-2.6" width="1.8" height="5.2" rx=".5" fill="#6b4426"/>
          <path d="M16 -1.7 v3.4 M20 -1.7 v3.4 M24 -1.7 v3.4 M28 -1.7 v3.4" stroke="#d8c39a" stroke-width=".45"/>
          <path d="M-4.7 -1.1 H37 M-4.7 -.37 H37 M-4.7 .37 H37 M-4.7 1.1 H37" stroke="#f6efe0" stroke-width=".28"/>
        </g>
        ${ACT_PAW(100, 63)}${ACT_PAW(83.5, 73.5, 'ustrum')}
      </g>
      <g class="brush">
        <g class="bpal">
          <path d="M70.6 71 q-2.4 -6.4 5 -7.8 q9.4 -1.6 12.4 3.2 q2.4 4.2 -2.6 6.6 q-3 1.4 -4.6 -.6 q-1.6 -1.6 -3.8 .4 q-4.6 2.6 -6.4 -1.8z"
                fill="#ead2a2" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <circle cx="75" cy="67.6" r="1.6" fill="#e8584e"/><circle cx="79.2" cy="65.6" r="1.6" fill="#4f86c6"/>
          <circle cx="83.6" cy="66" r="1.6" fill="#f6c945"/><circle cx="85.8" cy="69" r="1.5" fill="#5fae4a"/>
          ${ACT_PAW(79.5, 72.4)}
        </g>
        <g class="bstick">
          <path d="M100 65 L114 49" stroke="#b5793e" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M113.2 50 L116 46.8" stroke="#9aa3ad" stroke-width="2.6"/>
          <ellipse cx="117.2" cy="45.4" rx="1.7" ry="2.7" transform="rotate(41 117.2 45.4)" fill="var(--pc, #e8584e)" stroke="rgba(0,0,0,.25)" stroke-width=".4"/>
          ${ACT_PAW(101, 63)}
        </g>
      </g>
      <g class="wand">
        <path d="M100 65 L110.6 52.2" stroke="#f28fb1" stroke-width="1.9" stroke-linecap="round"/>
        <circle class="wfilm" cx="113" cy="48.5" r="4.4" fill="#dff1ff" opacity=".45"/>
        <circle cx="113" cy="48.5" r="4.4" fill="none" stroke="#f28fb1" stroke-width="1.6"/>
        ${ACT_PAW(100, 64)}
      </g>
      <g class="rope rope-f"><path d="${ROPE_D}" fill="none" stroke="#d9443a" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></g>
      <g class="rgrip"><rect x="105.8" y="52" width="4.4" height="9" rx="1.8" fill="#4f86c6" stroke="${OUT}" stroke-width=".8"/>${ACT_PAW(107, 59)}</g>
      <g class="bar"><g class="barm">
        <path d="M67 64 H115" stroke="#7a5230" stroke-width="2.2" stroke-linecap="round"/>
        ${[67, 115].map((x) => `<g transform="translate(${x} 64)">
          <circle r="7.6" fill="#fbfaf3" stroke="#d6d3c4" stroke-width=".8"/>
          <path d="M0 -6.6 V6.6 M-6.6 0 H6.6 M-4.7 -4.7 L4.7 4.7 M-4.7 4.7 L4.7 -4.7" stroke="#e2dfd0" stroke-width=".55"/>
          <circle r="1.6" fill="#c9b27a"/></g>`).join('')}
        ${ACT_PAW(84, 65)}${ACT_PAW(98, 65)}
      </g></g>
      <g class="hoop hoop-f">${HOOP('M2 69 A60 11 0 0 0 122 69')}</g>
      <g class="yo">
        <path class="ystr" d="M117 50 V82" stroke="#7a5230" stroke-width=".9" stroke-linecap="round"/>
        <g class="ydisc">
          <circle cx="117" cy="54" r="6.2" fill="#d9443a" stroke="${OUT}" stroke-width="1"/>
          <circle cx="117" cy="54" r="3.4" fill="#f08a7e"/>
          <circle cx="117" cy="54" r="1.3" fill="#fff"/>
        </g>
        ${ACT_PAW(115, 48.6)}
      </g>
      <g class="pbl">
        <path d="M104 65 Q109 58.6 118.4 52.4" stroke="#6bab4c" stroke-width="1.7" fill="none" stroke-linecap="round"/>
        <circle cx="120.4" cy="50" r="2" fill="#c9b27a" stroke="rgba(0,0,0,.2)" stroke-width=".4"/>
        <g class="pb1">
          <path d="M120.4 50 L125 43.6 M120.4 50 L116 43.4 M120.4 50 L127.6 50.6" stroke="#d6d3c4" stroke-width=".7" stroke-linecap="round"/>
          <g fill="#fbfaf3" stroke="#d6d3c4" stroke-width=".4"><circle cx="125.4" cy="43" r="1.6"/><circle cx="115.7" cy="42.8" r="1.6"/><circle cx="128.3" cy="50.7" r="1.6"/></g>
        </g>
        <g class="pb2">
          <path d="M112.6 51 A7.9 7.9 0 0 1 128.2 51 Q120.4 54.4 112.6 51Z" fill="#fbfaf3" stroke="#d6d3c4" stroke-width=".8" stroke-linejoin="round"/>
          <path d="M120.4 43.6 V50.6 M114.8 45.8 L120.4 50.6 M126 45.8 L120.4 50.6" stroke="#e2dfd0" stroke-width=".6"/>
          <circle cx="120.4" cy="50.2" r="1.6" fill="#c9b27a"/>
        </g>
        <g class="pb3">
          <circle cx="120.4" cy="49.6" r="8.6" fill="#fbfaf3" stroke="#d6d3c4" stroke-width=".8"/>
          <path d="M120.4 42.2 V57 M113 49.6 H127.8 M115.2 44.4 L125.6 54.8 M115.2 54.8 L125.6 44.4" stroke="#e2dfd0" stroke-width=".6"/>
          <circle cx="120.4" cy="49.6" r="1.8" fill="#c9b27a"/>
        </g>
        ${ACT_PAW(104, 64.4)}
      </g>
      <g class="jug">
        <g class="jb jb1"><circle cx="69" cy="37.6" r="3.9" fill="#e8584e" stroke="${OUT}" stroke-width=".7"/></g>
        <g class="jb jb2"><circle cx="69" cy="37.6" r="3.9" fill="#4f86c6" stroke="${OUT}" stroke-width=".7"/></g>
        <g class="jb jb3"><circle cx="69" cy="37.6" r="3.9" fill="#f6c945" stroke="${OUT}" stroke-width=".7"/></g>
      </g>
      <g class="dchain">
        <path d="M79.6 63.6 Q91 77 102.6 62.8" stroke="#5fae4a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        ${DAISY(84.4, 68.2, '#fff', 1.4)}${DAISY(91.2, 70.6, '#f28fb1', 1.4)}${DAISY(98, 67.8, '#fff', 1.4)}
        ${ACT_PAW(79.6, 63, 'dpl')}${ACT_PAW(102.6, 62, 'dpr')}
      </g>
      <g class="hd"><g class="dcrown">
        <path d="M74.5 34.5 Q89 22.5 104.5 32.5" stroke="#5fae4a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        ${DAISY(76.5, 33, '#fff', 1.2)}${DAISY(82.8, 29.2, '#f28fb1', 1.2)}${DAISY(89.6, 27.4, '#fff', 1.2)}${DAISY(96.4, 28.4, '#f28fb1', 1.2)}${DAISY(102.6, 31.3, '#fff', 1.2)}
      </g></g>
      <g class="pgl">
        <path d="M108 37.4 L133 27.2 L117.2 41Z" fill="#fffaf0" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M133 27.2 L113.4 38.8 L115.2 44.4 L117.2 41" fill="#ead2a2" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        ${ACT_PAW(113.4, 40.6)}
      </g>
      <g class="peb">
        <ellipse cx="116" cy="54.6" rx="6.4" ry="4.2" fill="#b9c0c8" stroke="#5a6470" stroke-width="1"/>
        <path d="M112.4 53.2 q3 -1.8 6.2 -.8" stroke="#f4f6f8" stroke-width=".9" fill="none" stroke-linecap="round"/>
        ${ACT_PAW(110.6, 58)}
      </g>
      <g class="sboat">
        <g transform="translate(64 51) scale(.64)">${BOAT_ART}</g>
        ${ACT_PAW(79, 66)}
      </g>
      ${ACT_PAW(107, 40, 'wpaw')}`;

// Päckchen: Zwille, Fernrohr und Gießkanne in den Pfoten, Sonnenbrille auf der Nase (Stil im Abschnitt "Päckchen")
const GIFT_FRONT = `
      <g class="slg"><g class="slr">
        <path d="M112 62 L121 37 M121 37 L117 25.5 M121 37 L128.5 27.5" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
        <path d="M112 62 L121 37 M121 37 L117 25.5 M121 37 L128.5 27.5" stroke="#b07a42" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <path class="slb-p" d="M117 26.4 L107.6 43.4 L128.2 28.4" stroke="#d9443a" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        <path class="slb-r" d="M117 26.4 Q122.6 29.6 128.2 28.4" stroke="#d9443a" stroke-width="1.5" fill="none"/>
        <circle class="slp" cx="107.6" cy="43.4" r="2.1" fill="#8e9196" stroke="${OUT}" stroke-width=".6"/>
        <circle class="slf" cx="122.6" cy="28" r=".4" fill="none"/>
        ${ACT_PAW(112.6, 58.4)}${ACT_PAW(106.6, 46)}
      </g></g>
      <g class="gspy"><g transform="rotate(-24 101 46)">
        <rect x="100" y="42.6" width="9" height="6.8" rx="1.2" fill="#b8862e" stroke="${OUT}" stroke-width=".9"/>
        <rect x="108.4" y="41.4" width="9" height="9.2" rx="1.4" fill="#d9a441" stroke="${OUT}" stroke-width=".9"/>
        <rect x="116.8" y="40.2" width="5" height="11.6" rx="1.4" fill="#8a5a32" stroke="${OUT}" stroke-width=".9"/>
        <path d="M111.4 41.6 v8.8 M114.4 41.6 v8.8" stroke="#f3cf7a" stroke-width=".9"/>
      </g>${ACT_PAW(106, 54)}</g>
      <g class="gcan"><g class="gcr"><g transform="translate(-26.5 -16) scale(1.25)">
        <path d="M99 57 h13 v11.5 q0 2 -2 2 h-9 q-2 0 -2 -2z" fill="#5fae4a" stroke="${OUT}" stroke-width="1"/>
        <path d="M112 60.5 L120.5 55 l1.6 1.8 -8.2 7.6" fill="#5fae4a" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
        <path d="M101.5 57 q4 -5.6 8 0" stroke="${OUT}" stroke-width="1.4" fill="none"/>
        <path d="M101 61 h9" stroke="#8fd16f" stroke-width="1.2" stroke-linecap="round"/>
      </g></g>${ACT_PAW(100, 58)}</g>`;
const GIFT_SHADES = `
        <g class="shades">
          <path d="M75.5 44.6 H105.5" stroke="#2c2f3a" stroke-width="1.3"/>
          <path d="M76.4 43.4 h11.2 q0 7.2 -5.6 7.2 q-5.6 0 -5.6 -7.2z M93.4 43.4 h11.2 q0 7.2 -5.6 7.2 q-5.6 0 -5.6 -7.2z"
                fill="#2c2f3a" stroke="#15171d" stroke-width=".8"/>
          <path d="M78.8 45 l2.6 2.8 M95.8 45 l2.6 2.8" stroke="#fff" stroke-width=".9" opacity=".55" stroke-linecap="round"/>
        </g>`;

const PIKA_SVG = `
  <svg class="pk" viewBox="0 0 120 100" aria-hidden="true">
    <defs>
      <radialGradient id="fur" gradientUnits="userSpaceOnUse" cx="88" cy="40" r="72">
        <stop offset="0" stop-color="${PK('fu1')}"/>
        <stop offset=".55" stop-color="${PK('fu2')}"/>
        <stop offset="1" stop-color="${PK('fu3')}"/>
      </radialGradient>
      <clipPath id="bodyclip"><path d="${BODY}"/></clipPath>
    </defs>
    <g class="all">
      ${ACT_BACK}
      <g class="hd">${EAR(75, 26, 'l')}${EAR(101, 27, 'r')}</g>
      <g class="body">
        <path d="${BODY}" fill="url(#fur)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <g clip-path="url(#bodyclip)">
          <ellipse cx="82" cy="82" rx="20" ry="13" fill="${PK('bel')}"/>
        </g>
      </g>
      <g class="feet" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.6">
        <ellipse class="bfoot" cx="33" cy="90.5" rx="9" ry="3.6"/>
        <ellipse class="ffoot" cx="82" cy="91" rx="6" ry="3.4"/>
        <ellipse class="ffoot" cx="97" cy="90.5" rx="6" ry="3.4"/>
      </g>
      <g class="sleg"><ellipse cx="64" cy="50" rx="5.2" ry="7.4" transform="rotate(-38 64 50)" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.5"/></g>
      <g class="hd"><g class="face">
        <ellipse class="chk" cx="77.5" cy="55" rx="4.2" ry="2.5" fill="#f2998c" opacity=".55"/>
        <ellipse class="chk" cx="104" cy="54.5" rx="3.8" ry="2.4" fill="#f2998c" opacity=".55"/>
        <path class="blines" d="M75.2 55.4 l1.1 -1.8 M77.4 55.6 l1.1 -1.8 M79.6 55.8 l1.1 -1.8 M101.8 55 l1.1 -1.8 M104 55.2 l1.1 -1.8"
              stroke="#e06a5e" stroke-width=".7" stroke-linecap="round"/>
        ${EYE(82, 'l')}${EYE(99, 'r')}
        <path class="brow brow-l" d="M78.7 39.2 H85.1" stroke="${OUT}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path class="brow brow-r" d="M95.9 39.2 H102.3" stroke="${OUT}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path class="wsk" d="M84 56 L70 53.5 M84 57.6 L70 59.8 M98 56 L113 53.5 M98 57.6 L113 59.8"
              stroke="${OUT}" stroke-width=".7" opacity=".45" stroke-linecap="round"/>
        <g class="mouth-g">
          <ellipse cx="91" cy="55" rx="7.5" ry="5.2" fill="${PK('mou')}"/>
          <g class="yawnm">
            <ellipse cx="91" cy="58.6" rx="3" ry="3.9" fill="#7a3a30" stroke="${OUT}" stroke-width=".7"/>
            <ellipse cx="91" cy="61" rx="1.9" ry="1.1" fill="#e8838b"/>
          </g>
          <path class="nose" d="M88.7 51.6 q2.3 -1.1 4.6 0 q-.6 1.9 -2.3 2.5 q-1.7 -.6 -2.3 -2.5z" fill="#7a4438"/>
          <path class="nsm" d="M90.6 50 q1.7 -1.2 3 .1 q1.1 1.5 -.4 2.5 q-1.7 .8 -2.9 -.5 q-.8 -1.1 .3 -2.1z M94.4 52.6 a.7 .7 0 1 0 .01 0z"
                fill="var(--nsm, #e8584e)" stroke="rgba(0,0,0,.25)" stroke-width=".35"/>
          <path class="mth" d="M91 54.1 v1.5 M91 55.6 q-1.5 1.7 -3 .4 M91 55.6 q1.5 1.7 3 .4"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round"/>
          <path class="wmouth" d="M91 54.1 v1.2 M87.6 55.2 q1.7 2.6 3.4 .1 q1.7 2.5 3.4 -.1"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="mim" d="M91 54.1 v1.6 M88.3 58 q2.7 -2.6 5.4 0"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <ellipse class="tongue" cx="91" cy="57.5" rx="1.35" ry="1.8" fill="#ee7f88" stroke="${OUT}" stroke-width=".5"/>
          <ellipse class="omouth" cx="91" cy="57.6" rx="1.8" ry="2.2" fill="#7a3a30" stroke="${OUT}" stroke-width=".6"/>
        </g>
        ${CUP_FOAM}
        <g class="callfx" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
          <path d="M113 51 q4 5 0 10"/><path d="M118 47.5 q6 8.5 0 17"/><path d="M123 44 q8 12 0 24"/>
        </g>
      </g></g>
      <g class="mfood"><g class="mf-bloom">
        <path d="M92 58 Q100 58 106 61" stroke="#4f8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="99" cy="61" rx="4.2" ry="1.7" fill="#6bab4c" transform="rotate(22 99 61)"/>
        <circle class="mbloom" cx="108" cy="61" r="4.4"/>
        <circle cx="108" cy="61" r="1.6" fill="#e0a032" opacity=".8"/>
      </g><g class="mf-item" transform="translate(94.8 52.2) scale(.68)"></g></g>
      <g class="paws" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
        <ellipse cx="84" cy="61" rx="4" ry="5"/>
        <ellipse cx="98" cy="61" rx="4" ry="5"/>
      </g>
      <g class="hd fear">${EAR(101, 27, 'f')}</g>
      <g class="epaws" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
        <ellipse cx="103.5" cy="44" rx="3.8" ry="4.8" transform="rotate(-20 103.5 44)"/>
        <ellipse cx="110.5" cy="40" rx="3.8" ry="4.8" transform="rotate(-20 110.5 40)"/>
      </g>
      <g class="book">
        <path d="M91 62.5 L79.5 59.4 L79.5 57.8 L91 61Z M91 62.5 L102.5 58.6 L102.5 57 L91 61Z" fill="#fffaf0" stroke="${OUT}" stroke-width=".6" stroke-linejoin="round"/>
        <path class="bflip" d="M91 61 L101.5 56.8 L100.6 53.8 L91 58.4Z" fill="#fff" stroke="${OUT}" stroke-width=".5" stroke-linejoin="round"/>
        <path d="M91 62.5 L79 59.4 L79.5 72 L91 75.2Z" fill="#d9534f" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M91 62.5 L103 58.5 L102.5 71 L91 75.2Z" fill="#c94440" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M82.5 64.6 l5 1.3 M82.5 67.2 l3.6 .9" stroke="#f6d9a8" stroke-width=".9" stroke-linecap="round"/>
        <circle cx="97" cy="65.6" r="1.7" fill="#f6c945"/>
        <g fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
          <ellipse cx="79.5" cy="66.5" rx="3.6" ry="4.5"/><ellipse cx="102.6" cy="65" rx="3.6" ry="4.5"/>
        </g>
      </g>
      <g class="gb"><g transform="rotate(-6 91 68)">
        <rect x="82" y="56.5" width="18" height="24" rx="2.2" fill="#cfccc4" stroke="${OUT}" stroke-width="1.2"/>
        <rect x="84.2" y="58.6" width="13.6" height="10.6" rx="1" fill="#6d6f76"/>
        <rect x="85.6" y="59.8" width="10.8" height="8.2" fill="#9bbc0f"/>
        <g class="gbs" fill="#306230">
          <rect x="87.2" y="64.6" width="2" height="2"/><rect x="85.6" y="66.8" width="10.8" height="1.2"/><rect x="93.4" y="61.4" width="1.4" height="1.4"/>
        </g>
        <path d="M85.4 74 h4.2 M87.5 71.9 v4.2" stroke="#3c3c3c" stroke-width="1.4"/>
        <circle cx="94.6" cy="74.8" r="1.2" fill="#a8326e"/><circle cx="97.5" cy="73" r="1.2" fill="#a8326e"/>
        <g fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
          <ellipse class="th1" cx="83" cy="73.4" rx="3.6" ry="4.4"/><ellipse class="th2" cx="99.4" cy="72.4" rx="3.6" ry="4.4"/>
        </g>
      </g></g>
      <g class="tab">
        <ellipse class="tglow" cx="95" cy="66" rx="17" ry="11" fill="#bfe3ff"/>
        <path d="M81 70 L113 70 L118 84 L76 84Z" fill="#2f3440" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M82.8 71.6 L111.4 71.6 L115.4 82.4 L78.8 82.4Z" fill="#cfeaff"/>
        <g class="tscr-f">
          <path d="M79 82.4 Q90 78.6 100 80.6 T115.3 80 L115.4 82.4Z" fill="#86c46b"/>
          <path d="M101 80.4 V77.2" stroke="#4f8a3a" stroke-width=".7"/>
          <circle cx="101" cy="76.6" r="1.9" fill="#f28fb1"/><circle cx="101" cy="76.6" r=".7" fill="#f6c945"/>
          <circle cx="88" cy="75" r="1.5" fill="#ffd75a"/>
        </g>
        <g class="tscr-p">
          <path d="M80 81 L114 73.4" stroke="#7fb0d9" stroke-width=".6" stroke-dasharray="1.2 1"/>
          <path d="M92.5 78.4 l4.5 -.5 l-1.8 -1.9 h1.1 l2.9 1.6 l2.5 -.3 q1.1 .3 .1 .8 l-2.5 .3 l-2.5 2 h-1.1 l1.4 -2 l-4.5 .5z" fill="#2f4256"/>
        </g>
        <g fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.2">
          <ellipse cx="82" cy="82.6" rx="4" ry="2.8"/><ellipse class="tpaw" cx="105" cy="79.6" rx="3.8" ry="2.8"/>
        </g>
      </g>
      <ellipse class="kpaw" cx="105" cy="50" rx="3.8" ry="4.8" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4"/>
      <g class="hd"><g class="cap">
        <path d="M77 28 Q80 12 62 9 Q91 0 103 27 Z" fill="${PK('cap')}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="79" cy="17" r="1.3" fill="${PK('cpw')}" opacity=".8"/>
        <circle cx="88" cy="13" r="1.3" fill="${PK('cpw')}" opacity=".8"/>
        <circle cx="91" cy="22" r="1.3" fill="${PK('cpw')}" opacity=".8"/>
        <path d="M76 28 Q90 22 104 27" stroke="${PK('cpw')}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="62" cy="9" r="4.2" fill="${PK('cpw')}" stroke="${OUT}" stroke-width="1.2"/>
      </g>
      <g class="hats">
        <g class="hat-witch">
          <ellipse cx="89" cy="22.6" rx="15" ry="3.6" transform="rotate(-6 89 22.6)" fill="#3d2f55" stroke="${OUT}" stroke-width="1.3"/>
          <path d="M80.6 21.6 Q83.4 13 87.4 7 Q90.2 1.6 97.4 -.6 Q93.4 3.6 93.6 8.4 Q94.6 15 97.4 20.4 Q89 23.4 80.6 21.6Z"
                fill="#4a3a6a" stroke="${OUT}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M81.4 18.6 Q89 21 96.4 17.8 L97.2 20.2 Q89 23.2 80.8 21.2Z" fill="#f28c28"/>
          <rect x="87.2" y="18.8" width="3.4" height="3.2" rx=".6" fill="none" stroke="#f6c945" stroke-width="1"/>
          <path d="M90.6 9.6 l.7 1.5 1.6 .2 -1.2 1.1 .3 1.6 -1.4 -.8 -1.4 .8 .3 -1.6 -1.2 -1.1 1.6 -.2Z" fill="#f6c945"/>
        </g>
        <g class="hat-xmas">
          <path d="M77 28 Q80 12 62 9 Q91 0 103 27 Z" fill="#d9483b" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M80 16 Q86 9 94 13" stroke="#f08a7e" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>
          <path d="M76 28 Q90 22 104 27" stroke="${OUT}" stroke-width="7.4" fill="none" stroke-linecap="round"/>
          <path d="M76 28 Q90 22 104 27" stroke="#f6f1ea" stroke-width="5.6" fill="none" stroke-linecap="round"/>
          <circle cx="62" cy="9" r="4.6" fill="#f6f1ea" stroke="${OUT}" stroke-width="1.2"/>
        </g>
        <g class="hat-party">
          <path d="M80.5 23.5 Q89 26 97.5 21.5 L92.5 1.5Z" fill="#5fb9de" stroke="${OUT}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M84.7 15.8 Q90 17.6 95.75 14.5 M88.3 9.2 Q91.5 10.4 94.25 8.5" stroke="#f6c945" stroke-width="2" fill="none"/>
          <g fill="#f28fb1"><circle cx="86" cy="20.8" r="1.1"/><circle cx="92.8" cy="19.8" r="1.1"/><circle cx="90.4" cy="12.8" r="1"/></g>
          <circle cx="92.5" cy="1.5" r="3.2" fill="#e8584e" stroke="${OUT}" stroke-width="1"/>
        </g>
      </g>${GIFT_SHADES}</g>
      <g class="scarf">
        <path d="M68 63 Q87 73 107 63" stroke="#d9534f" stroke-width="6.5" fill="none" stroke-linecap="round"/>
        <path d="M70 64 Q87 73.5 105 64.6" stroke="#f6f1ea" stroke-width="1.6" fill="none" stroke-dasharray="3 4"/>
        <path d="M73 66 L69 80 L76.5 80.6 L79 67.5Z" fill="#d9534f" stroke="#a83a37" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M70.5 75 L77.5 75.6" stroke="#f6f1ea" stroke-width="1.4"/>
      </g>
      ${ACT_FRONT}
      ${GIFT_FRONT}
      ${CUP_SVG}
      <g class="brolly">
        <path d="M105 63 Q115 34 99 3" stroke="#4f8a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M52 14 Q68 -16 100 -10 Q127 -4 125 18 Q113 6 101 8 Q93 0 84 8 Q72 2 52 14Z"
              fill="#5fae4a" stroke="#3f7f31" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M56 11 Q87 -10 121 14" stroke="#8fd16f" stroke-width="1.1" fill="none" stroke-linecap="round"/>
        <ellipse cx="105" cy="63" rx="4" ry="4.6" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4"/>
      </g>
    </g>
    <g class="bk">
      ${BACK_EAR(74, 'l')}${BACK_EAR(99, 'r')}
      <path d="${BACK}" fill="url(#fur)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M79 35 Q86.5 30.5 94 35" stroke="#d6b796" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M86.5 29.5 q-1.6 -3 0 -4.8 q1.5 1.9 0 4.8" fill="${PK('fu3')}"/>
      <path d="${BACK}" fill="#140d1e" opacity=".5"/>
      <path class="rim" d="${BACK}" fill="none" stroke="var(--tvc, #9fd0ff)" stroke-width="2.2"/>
    </g>
  </svg>`;

export { OUT, PK_DIM, PK_ACC, BOAT_ART, PIKA_SVG };
