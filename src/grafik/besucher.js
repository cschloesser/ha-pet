// Besucher: Pino (umgefärbte Pika-Grafik), Vögelchen, Maus, Frosch, Schnecke

import { OUT, PIKA_SVG } from './pika.js';

const FRIEND_SVG = [
  ['id="fur"', 'id="fur2"'], ['url(#fur)', 'url(#fur2)'],
  ['id="bodyclip"', 'id="bodyclip2"'], ['url(#bodyclip)', 'url(#bodyclip2)'],
  ['#d0ad8d', '#f2b36e'], ['#b08a68', '#dc8640'], ['#8a664b', '#a9592a'], // Fellverlauf
  ['#f0e2cf', '#fbe7cb'], // Bauch
  ['#efe3d3', '#f8e4cc'], ['#e3a990', '#f0a184'], // Ohrenrand, Ohr innen
  ['#d6b796', '#efb47c'], // Rückansicht
].reduce((svg, [a, b]) => svg.split(a).join(b), PIKA_SVG)
  .replace('<g clip-path="url(#bodyclip2)">',
    '$&<ellipse class="blaze" cx="89.5" cy="32.5" rx="4.8" ry="3.2" fill="#fbf0e2" opacity=".92"/>')
  // Halstuch unter dem Kinn, hinter Pfoten und Blume (vor .mfood), der Winterschal liegt darüber
  .replace('<g class="mfood">', `<g class="bandana">
        <path d="M70.5 62 Q87.5 70.5 105 61.6" stroke="${OUT}" stroke-width="5.4" fill="none" stroke-linecap="round"/>
        <path d="M70.5 62 Q87.5 70.5 105 61.6" stroke="#22b5a6" stroke-width="3.8" fill="none" stroke-linecap="round"/>
        <path d="M79.5 65.2 L95.5 65.6 L86.6 76.4Z" fill="#22b5a6" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <g fill="#f4fbf8"><circle cx="84.4" cy="67.6" r="1"/><circle cx="90.4" cy="67.8" r="1"/><circle cx="87" cy="71.6" r=".9"/>
          <circle cx="75" cy="64.6" r=".8"/><circle cx="100" cy="64.2" r=".8"/></g>
      </g>
      $&`);
// ---------- Besucher ----------
// Rundes Vögelchen (viewBox 30 × 26, Füße bei y 26, schaut nach rechts). Sitzend liegt der Flügel an (.wf),
// im Flug schlägt der hochgestellte Flügel (.wu). Kopf .bh dreht sich am Hals (Picken, Kopf schief).
const BIRDS = [
  { name: 'Rotkehlchen', body: '#a08b70', head: '#a08b70', wing: '#85705a', breast: '#f2843a', face: '#f2843a', beak: '#3a2f28' },
  { name: 'Blaumeise', body: '#f2d14f', head: '#fbfbf7', wing: '#5b97d8', breast: '#f6dc6a', cap: '#4f8fd6', stripe: '#2c3a5a', beak: '#3a2f28' },
  { name: 'Spatz', body: '#b38d66', head: '#a8805a', wing: '#86603f', breast: '#ebe0cf', cap: '#8e9196', bib: '#3a302a', beak: '#4a3a2c' },
];
const BOUT = '#4a3a2c';
const BIRD_SVG = (v) => `
  <svg viewBox="0 0 30 26" aria-hidden="true">
    <path d="M7.5 15.5 L.6 11.6 Q-.2 15.4 1.6 18.6Z" fill="${v.wing}" stroke="${BOUT}" stroke-width=".8" stroke-linejoin="round"/>
    <g class="legs" stroke="#c98a4b" stroke-width="1" stroke-linecap="round" fill="none">
      <path d="M12.5 22.5 V25.4 M11 25.6 H14 M16.5 22.5 V25.4 M15 25.6 H18"/>
    </g>
    <ellipse cx="14" cy="16.2" rx="10" ry="7.9" fill="${v.body}" stroke="${BOUT}" stroke-width="1"/>
    <ellipse cx="17.6" cy="18" rx="6" ry="4.8" fill="${v.breast}"/>
    <path class="wf" d="M6.6 13.8 Q13 10 18.6 14.6 Q14 20.4 7.4 17.2Z" fill="${v.wing}" stroke="${BOUT}" stroke-width=".7" stroke-linejoin="round"/>
    <path class="wu" d="M9 14 Q4.6 1.6 16.4 3.2 Q17.4 9 15.4 14Z" fill="${v.wing}" stroke="${BOUT}" stroke-width=".7" stroke-linejoin="round"/>
    <g class="bh">
      <circle cx="20.5" cy="9.6" r="6.3" fill="${v.head}" stroke="${BOUT}" stroke-width="1"/>
      ${v.face ? `<ellipse cx="22.2" cy="12.4" rx="4.3" ry="3.3" fill="${v.face}"/>` : ''}
      ${v.cap ? `<path d="M14.5 7.7 A6.3 6.3 0 0 1 26.5 7.7Z" fill="${v.cap}"/>` : ''}
      ${v.stripe ? `<path d="M15.2 10.6 Q20 9.6 26.6 9.4" stroke="${v.stripe}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` : ''}
      ${v.bib ? `<ellipse cx="23.6" cy="14" rx="1.9" ry="1.4" fill="${v.bib}"/>` : ''}
      <circle cx="23" cy="8.7" r="1.35" fill="#1f1a17"/><circle cx="23.4" cy="8.2" r=".45" fill="#fff"/>
      <circle cx="22.4" cy="11.8" r="1.3" fill="#f28fb1" opacity=".45"/>
      <path d="M26.3 9.2 L29.6 10.5 L26.3 11.8Z" fill="${v.beak}" stroke="${v.beak}" stroke-width=".4" stroke-linejoin="round"/>
    </g>
  </svg>`;
// Kleine Maus (viewBox 32 × 18, Füße bei y 18, schaut nach rechts), Schwanz ragt links heraus
const MOUSE_SVG = `
  <svg viewBox="0 0 32 18" aria-hidden="true">
    <path class="mtail" d="M5.5 14.5 Q-1 16 -3.5 11.5 Q-5.5 7 -1.5 5.5" stroke="#c99a98" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <circle cx="16.8" cy="5" r="3" fill="#a8998c" stroke="#5f544b" stroke-width=".8"/>
    <circle cx="16.8" cy="5" r="1.8" fill="#f2b8bd"/>
    <ellipse cx="12.6" cy="12" rx="8.8" ry="5.8" fill="#a8998c" stroke="#5f544b" stroke-width=".9"/>
    <ellipse cx="14" cy="14.6" rx="5.6" ry="2.8" fill="#e9ded2"/>
    <g class="mhead">
      <path d="M16 7.8 Q22 4.6 28.4 10.4 Q27.4 12.8 23 12.8 Q17.6 12.8 16 10Z" fill="#a8998c" stroke="#5f544b" stroke-width=".9" stroke-linejoin="round"/>
      <g class="mear"><circle cx="20.4" cy="4.4" r="3.4" fill="#a8998c" stroke="#5f544b" stroke-width=".8"/>
      <circle cx="20.4" cy="4.4" r="2.1" fill="#f2b8bd"/></g>
      <circle cx="23.4" cy="8.6" r="1.05" fill="#1f1a17"/><circle cx="23.7" cy="8.25" r=".35" fill="#fff"/>
      <circle class="mnose" cx="28.3" cy="10.3" r="1" fill="#e98a96"/>
      <path class="whisk" d="M27 11 L31.2 9.6 M27 11.3 L31.4 11.6 M26.8 11.6 L30.6 13.2" stroke="#5f544b" stroke-width=".35" fill="none"/>
    </g>
    <g fill="#f2b8bd"><ellipse cx="8.6" cy="17.4" rx="2" ry=".9"/><ellipse cx="18" cy="17.4" rx="2" ry=".9"/></g>
  </svg>`;
// Frosch (viewBox 30 × 22, Füße bei y 22, schaut nach rechts). Sitzend ist das Hinterbein gefaltet (.fhl), im
// Sprung gestreckt (.fxl). .fsac ist die Schallblase (bläht sich beim Quaken), .ftng die Zunge, .flid das Lid.
const FOUT = '#35581f';
const FROG_SVG = `
  <svg viewBox="0 0 30 22" aria-hidden="true">
    <g class="fxl" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 16.4 L2.4 19.6 L-3.6 23.4" stroke="${FOUT}" stroke-width="4"/>
      <path d="M9 16.4 L2.4 19.6 L-3.6 23.4" stroke="#62a441" stroke-width="2.4"/>
      <path d="M-3.6 23.4 L-7 23 M-3.6 23.4 L-6.4 25.4" stroke="${FOUT}" stroke-width="1.5"/>
    </g>
    <path d="M5 19.5 Q3.4 14 9 11 Q15 7.2 21.5 7.6 Q27.8 8.2 28.2 12.4 Q28.3 15 24.8 16.6 Q22 20.5 14 20.7 Q6 20.9 5 19.5Z"
      fill="#74b64d" stroke="${FOUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M11.6 20.2 Q19.6 20.6 24.4 16.4 Q26.8 15.4 27.7 13.5 Q24 15.5 19 16.6 Q13.8 17.7 11.6 20.2Z" fill="#e6efb2"/>
    <ellipse class="fsac" cx="25" cy="16.9" rx="4.2" ry="3.5" fill="#f4f6cf" stroke="${FOUT}" stroke-width=".7"/>
    <g fill="#5a9a3b"><circle cx="11" cy="13.2" r="1.05"/><circle cx="14.8" cy="10.7" r=".8"/><circle cx="8.3" cy="15.8" r=".7"/></g>
    <circle cx="21.2" cy="7.3" r="3.1" fill="#74b64d" stroke="${FOUT}" stroke-width=".9"/>
    <circle cx="21.7" cy="7.1" r="2" fill="#fdf6c9"/>
    <ellipse cx="22.2" cy="7.2" rx="1" ry="1.35" fill="#1f1a17"/><circle cx="22.6" cy="6.6" r=".4" fill="#fff"/>
    <circle class="flid" cx="21.7" cy="7.1" r="2.15" fill="#74b64d"/>
    <path class="ftng" d="M27.4 13.2 Q32 12.6 36.4 8.4" stroke="#f07a95" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M27.8 13.1 Q23.6 14.9 19.6 13.3" stroke="${FOUT}" stroke-width=".7" fill="none" stroke-linecap="round"/>
    <circle cx="27" cy="10.7" r=".4" fill="${FOUT}"/>
    <circle cx="19.8" cy="12.3" r="1.3" fill="#f28fb1" opacity=".5"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.4 16.6 Q19.7 19.4 21 21.1 H24" stroke="${FOUT}" stroke-width="2.7"/>
      <path d="M20.4 16.6 Q19.7 19.4 21 21.1 H24" stroke="#74b64d" stroke-width="1.3"/>
    </g>
    <g class="fhl">
      <path d="M4.6 19.6 Q3 13.6 9.4 13 Q14.4 12.8 14 17.6 Q13.6 20.4 10 20.6Z" fill="#62a441" stroke="${FOUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M6 20.2 Q11 19.5 16.8 20.7 Q17.8 21.2 17 21.8 H6.4 Q5.2 21.3 6 20.2Z" fill="#74b64d" stroke="${FOUT}" stroke-width=".8" stroke-linejoin="round"/>
    </g>
  </svg>`;
// Schnecke (viewBox 30 × 20, Sohle bei y 20, schaut nach rechts). .sbody zieht sich ins Haus zurück (.hide),
// .sfeel sind die Fühler mit den Augen. Hausfarben: [Haus, Spirale].
const SNAILS = [['#d99a5b', '#8a5a2c'], ['#f0d27a', '#a8792c'], ['#e9a7a0', '#a85f5a']];
const SNAIL_SVG = ([shell, line]) => `
  <svg viewBox="0 0 30 20" aria-hidden="true">
    <g class="sbody">
      <g class="sfeel" stroke="#7a5a3a" stroke-width=".9" stroke-linecap="round">
        <path d="M25 10.4 L23.8 5.2 M27.3 10.4 L28.6 5.8"/>
        <circle cx="23.7" cy="4.5" r="1.1" fill="#1f1a17" stroke="none"/><circle cx="28.8" cy="5.1" r="1.1" fill="#1f1a17" stroke="none"/>
        <circle cx="24" cy="4.2" r=".35" fill="#fff" stroke="none"/><circle cx="29.1" cy="4.8" r=".35" fill="#fff" stroke="none"/>
      </g>
      <path d="M1.6 19.3 Q4 17.3 10 17.4 L19 17.4 Q22.2 17.2 22.8 13.6 Q23.4 9.8 26.1 9.8 Q28.9 10 28.6 13.8 Q28.2 19.5 22 19.7 H3 Q1 19.8 1.6 19.3Z"
        fill="#ecd6ac" stroke="#7a5a3a" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M26.3 14.7 q1 .8 1.8 -.1" stroke="#7a5a3a" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <circle cx="25" cy="15.6" r="1" fill="#f28fb1" opacity=".5"/>
    </g>
    <g class="sshell">
      <circle cx="12.6" cy="10" r="8" fill="${shell}" stroke="#6b4a2f" stroke-width="1"/>
      <path d="M18.2 10 A5.6 5.6 0 0 0 7 10 A4.3 4.3 0 0 0 15.6 10 A3 3 0 0 0 9.6 10 A1.9 1.9 0 0 0 13.4 10" stroke="${line}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M6.9 6.4 Q9 3.6 12.4 3.2" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".55"/>
    </g>
  </svg>`;

export { FRIEND_SVG, BIRDS, BIRD_SVG, MOUSE_SVG, FROG_SVG, SNAILS, SNAIL_SVG };
