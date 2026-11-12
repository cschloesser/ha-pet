// Areale: Bau je Areal (huegel, fels, stumpf, alpin) mit Eingang, Lichtern und Maßen

// Jedes Areal hat einen Bau mit Eingang. Grafik in viewBox 0 0 100 vh, der Boden liegt bei vh - sink.
// w/left: Breite und Lage relativ zur Kartenhöhe bzw. Baubreite. hole: Ausschnitt, in dem der Pika im Bau
// zu sehen ist (x1..x2, Bogenoberkante top, Vorderkante lip, unterhalb verschwindet er). hay: linke Kante
// des Heuhaufens als Anteil der Baubreite. stash (statt Heuhaufen): Vorratsnische im Bau (x1..x2, Bogen top,
// Boden auf der Bodenlinie), dort legt der Pika die Blüten ab. lights: leuchtet in Dämmerung und Nacht (ungedimmt).
// rand: so weit malt die Grafik über die viewBox hinaus (siehe randStil).
const HOLE_GRAD = `<radialGradient id="holeg" cx=".5" cy=".9" r=".85">
      <stop offset="0" stop-color="#0d0907"/><stop offset="1" stop-color="#3b302a"/></radialGradient>`;
// Überstand (seit 0.40.1). Bau, Stein und Festdeko malen über ihre viewBox hinaus (overflow: visible). Safari auf
// iPhone und iPad schneidet ein Element mit filter (Lichtfilter in Dämmerung und Nacht) an seinen Boxen ab, und
// was ein <svg> über seine Box hinaus malt, zählt dort nicht mit: Der Erdhügel war rechts senkrecht gekappt, der
// Stein links und rechts. rand { t, r, b, l } (viewBox-Einheiten, so weit ragt die Zeichnung hinaus) macht die Box
// des <svg> um so viel größer (padding) und zieht sie mit negativem margin wieder zurück: Die Zeichnung bleibt, wo
// sie war, die Hülle behält ihre Maße, aber die Box deckt alles, was gemalt wird. Prozent beziehen sich auf die
// Breite der Hülle (auch oben und unten), die viewBox ist vbW Einheiten breit. Die vergrößerte Box fängt keine
// Tipps (pointer-events in stil/szene.js), die Formen darin wie bisher. Nachmessen in der Vorschau:
// buehneUeberstand(karte), mit dem Rand bleibt die Liste leer.
const randStil = (r, vbW = 100) => {
  if (!r) return '';
  const p = (k) => `${+(((r[k] || 0) * 100) / vbW).toFixed(2)}%`;
  const m = (k) => (r[k] ? `-${p(k)}` : '0');
  return `box-sizing:content-box;padding:${p('t')} ${p('r')} ${p('b')} ${p('l')};margin:${m('t')} ${m('r')} ${m('b')} ${m('l')}`;
};
const RAND_SVG = (r, vbW = 100) => (r ? ` style="${randStil(r, vbW)}"` : '');

const GLOW_GRAD = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".75"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

const AREALE = {
  fels: {
    name: 'Felsbau', w: 0.72, left: -0.1, vh: 66, sink: 5, rand: { r: 4.5, b: 2.5, l: 6 }, hay: 0.86,
    perches: [[46, 10.2], [17, 26.2], [83, 30.2]],
    hole: { x1: 39.5, x2: 60.5, top: 34, lip: 57.5 },
    svg: `
        <defs>${HOLE_GRAD}</defs>
        <g stroke="#5c6166" stroke-width="1.5">
          <ellipse cx="50" cy="27" rx="27" ry="17" fill="#a7adb3"/>
          <ellipse cx="19" cy="45" rx="24" ry="19" fill="#979da4"/>
          <ellipse cx="81" cy="47" rx="22" ry="17" fill="#8e949b"/>
        </g>
        <ellipse cx="42" cy="16" rx="8" ry="3" fill="#fff" opacity=".25"/>
        <ellipse cx="11" cy="34" rx="8" ry="3.4" fill="#fff" opacity=".2"/>
        <ellipse cx="78" cy="37" rx="7" ry="3" fill="#fff" opacity=".2"/>
        <path d="M36 64 V45 A14 14 0 0 1 64 45 V64Z" fill="url(#holeg)" stroke="#5c6166" stroke-width="1.4"/>
        <g stroke="#5c6166" stroke-width="1.2" fill="#b4b9be">
          <ellipse cx="35.5" cy="46" rx="4" ry="5.5"/><ellipse cx="38.5" cy="35.5" rx="4.6" ry="4"/>
          <ellipse cx="50" cy="30.5" rx="6" ry="3.6"/><ellipse cx="61.5" cy="35.5" rx="4.6" ry="4"/>
          <ellipse cx="64.5" cy="46" rx="4" ry="5.5"/>
        </g>
        <g stroke="#5c6166" stroke-width="1.3">
          <ellipse cx="41" cy="61" rx="9" ry="3.8" fill="#a3a9ae"/><ellipse cx="58" cy="61.5" rx="9" ry="3.6" fill="#9aa0a6"/>
          <ellipse cx="8" cy="60" rx="12" ry="7" fill="#a3a9ae"/><ellipse cx="92" cy="61" rx="11" ry="6" fill="#9aa0a6"/>
        </g>
        <g fill="#79b25d">
          <ellipse cx="63" cy="13" rx="5" ry="2.4"/><ellipse cx="25" cy="28" rx="4" ry="2"/><ellipse cx="90" cy="33" rx="4" ry="1.8"/>
        </g>`,
  },
  huegel: {
    name: 'Erdhügel', w: 0.82, left: -0.06, vh: 60, sink: 4, rand: { t: 0.5, r: 28, b: 1.5, l: 5 }, stash: { x1: 92.5, x2: 112.5, top: 39 },
    // Laternendach, Schornstein, Schild, Blumenkasten, Hügelkuppe, Nischenbogen
    perches: [[13, 27.6], [65, 0.4], [47, 13.4], [84, 39.6], [36, 11.6], [102.5, 37.4]],
    hole: { x1: 37.5, x2: 62.5, top: 25.5, lip: 52.6 },
    svg: `
        <defs>${HOLE_GRAD}</defs>
        <g stroke="#6b625a" stroke-width="1.1">
          <rect x="61.5" y="2" width="7" height="14" fill="#a39488"/>
          <rect x="60.5" y=".4" width="9" height="3" rx=".6" fill="#8c7d72"/>
          <path d="M61.5 7 H68.5 M64 7 V11.5 M66.5 11.5 V16 M61.5 11.5 H68.5" stroke-width=".6" opacity=".6"/>
        </g>
        <path class="mound" d="M-4 60 C-3 30 22 10 50 10 C80 10 104 20 114 32 C121 41 125 50 126 60Z" stroke-width="1.5"/>
        <path d="M14 30 Q28 15 46 13" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g class="mound-t" stroke-width="1.2" fill="none" stroke-linecap="round">
          <path d="M28 16.5 l-2 -4 M31 15 l.5 -4.5 M68 15 l1.5 -4 M72 17 l3 -3.5 M47 10 l-1 -4 M51 10 l1.5 -4.2"/>
        </g>
        <g fill="#fff"><circle cx="6" cy="48" r="1.6"/><circle cx="9" cy="42" r="1.3"/><circle cx="90" cy="30" r="1.5"/><circle cx="119.5" cy="50" r="1.2"/></g>
        <g fill="#f4c53d"><circle cx="6" cy="48" r=".6"/><circle cx="9" cy="42" r=".5"/><circle cx="90" cy="30" r=".6"/><circle cx="119.5" cy="50" r=".5"/></g>
        <g transform="translate(6 1)">
          <circle cx="74" cy="32" r="6.6" fill="#5e3d26"/>
          <circle cx="74" cy="32" r="5.6" fill="#9a6a45"/>
          <circle class="pane" cx="74" cy="32" r="4.3"/>
          <path d="M70.3 29.4 Q72.6 30 73.4 34.6 L70.4 34.6Z M77.7 29.4 Q75.4 30 74.6 34.6 L77.6 34.6Z" fill="#e58a7a" opacity=".85"/>
          <path d="M74 27.7 V36.3 M69.7 32 H78.3" stroke="#9a6a45" stroke-width="1"/>
          <rect x="67" y="38.6" width="14" height="3.4" rx=".8" fill="#9a6a45" stroke="#5e3d26" stroke-width=".8"/>
          <path d="M69 38.6 q.4 -2.6 1.6 -3.2 M72.5 38.6 q0 -2.6 -.8 -3.4 M76 38.6 q.3 -2.8 1.4 -3.2 M79 38.6 q-.2 -2.4 -1 -3" stroke="#4f8a3a" stroke-width=".7" fill="none"/>
          <g fill="#f07a95"><circle cx="70.6" cy="35.4" r="1.1"/><circle cx="77.4" cy="35.4" r="1.1"/></g>
          <g fill="#f6c945"><circle cx="71.7" cy="35.2" r="1"/><circle cx="78" cy="35.8" r=".9"/></g>
        </g>
        <defs><linearGradient id="stashg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#140d09"/><stop offset="1" stop-color="#3a2a1e"/></linearGradient></defs>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57Z" fill="url(#stashg)"/>
        <path d="M95.3 52.8 V46 C95.3 43.4 109.7 43.4 109.7 46 V52.8Z" fill="#4b3628" opacity=".7"/>
        <path d="M92.5 57 L95.3 52.8 H109.7 L112.5 57Z" fill="#6e4f37"/>
        <path d="M92.5 44.2 L95.3 46 M112.5 44.2 L109.7 46" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>
        <g class="stashb"></g>
        <path d="M93.3 43.8 C93.5 39.4 111.5 39.4 111.7 43.8" stroke="#000" stroke-opacity=".45" stroke-width="1.4" fill="none"/>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57" fill="none" stroke="#5e3d26" stroke-width="3.6"/>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57" fill="none" stroke="#9a6a45" stroke-width="2.4"/>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57" fill="none" stroke="#5e3d26" stroke-width=".4"
          stroke-dasharray="2.5 4" opacity=".6"/>
        <path d="M36 55 V38 A14 14 0 0 1 64 38 V55Z" fill="url(#holeg)"/>
        <path d="M35 57 V38 A15 15 0 0 1 65 38 V57" fill="none" stroke="#5e3d26" stroke-width="5.6"/>
        <path d="M35 57 V38 A15 15 0 0 1 65 38 V57" fill="none" stroke="#9a6a45" stroke-width="3.8"/>
        <path d="M35 57 V38 A15 15 0 0 1 65 38 V57" fill="none" stroke="#5e3d26" stroke-width=".5" stroke-dasharray="3 5" opacity=".6"/>
        <g>
          <ellipse cx="27" cy="41.5" rx="5" ry="13.5" fill="#6a9c78" stroke="#3d6a4b" stroke-width="1.3"/>
          <path d="M25 30.5 V52.5 M28.5 29 V54" stroke="#3d6a4b" stroke-width=".6" opacity=".6"/>
          <circle cx="29.3" cy="42.5" r="1.1" fill="#e2c15a"/>
        </g>
        <g transform="rotate(-3 50 17)">
          <rect x="41" y="13.2" width="18" height="7" rx="1.4" fill="#d2a46c" stroke="#8a5a3b" stroke-width="1.1"/>
          <text x="50" y="18.6" text-anchor="middle" font-size="5" font-weight="800" fill="#5a4030" letter-spacing=".5">PIKA</text>
        </g>
        <path d="M30 53.4 Q50 51.6 70 53.4 L72.5 55 V57.6 H27.5 V55Z" fill="#b8a48a" stroke="#7d6a52" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M28.1 55.2 H71.9 V57 H28.1Z" fill="#8f7c62"/>
        <path d="M33 53.6 Q50 52.2 67 53.6" stroke="#fff" stroke-opacity=".3" stroke-width=".9" fill="none" stroke-linecap="round"/>
        <path d="M18 57.5 V27 Q18 24 15 24 H13 V27" stroke="#4a4a4a" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14.6 57 Q15 54.4 18 54.2 Q21 54.4 21.4 57Z" fill="#9aa0a6" stroke="#5c6166" stroke-width=".8"/>
        <path d="M10 27.6 H16 L15 29 H11Z" fill="#3c3c3c"/>
        <rect x="11" y="29" width="4" height="6" fill="#ffe7a3" fill-opacity=".45" stroke="#3c3c3c" stroke-width="1"/>
        <rect x="10.4" y="35" width="5.2" height="1.4" rx=".5" fill="#3c3c3c"/>`,
    lights: `
        <defs>${GLOW_GRAD('lg', '#ffd66b')}${GLOW_GRAD('ig', '#ffb347')}</defs>
        <g class="smoke"><circle cx="65" cy="-1" r="2.2"/><circle cx="65" cy="-1" r="2.2"/><circle cx="65" cy="-1" r="2.2"/></g>
        <path class="lt" d="M37.5 53 V38 A12.5 12.5 0 0 1 62.5 38 V53Z" fill="url(#ig)" fill-opacity=".7"/>
        <g transform="translate(6 1)">
          <circle class="lt" cx="74" cy="32" r="12" fill="url(#ig)" fill-opacity=".6"/>
          <circle class="lt" cx="74" cy="32" r="4.3" fill="#ffcf70"/>
          <path class="lt" d="M70.3 29.4 Q72.6 30 73.4 34.6 L70.4 34.6Z M77.7 29.4 Q75.4 30 74.6 34.6 L77.6 34.6Z" fill="#d9705f"/>
          <path class="lt" d="M74 27.7 V36.3 M69.7 32 H78.3" stroke="#7a5236" stroke-width="1"/>
          <circle class="tvw" cx="74" cy="32" r="4.3"/>
          <path class="tvw-x" d="M74 27.7 V36.3 M69.7 32 H78.3" stroke="#7a5236" stroke-width="1"/>
        </g>
        <circle class="lt flk" cx="13" cy="32" r="10" fill="url(#lg)"/>
        <rect class="lt" x="11.6" y="29.6" width="2.8" height="4.8" fill="#ffd66b"/>`,
  },
  stumpf: {
    name: 'Baumstumpf', w: 0.64, left: -0.06, vh: 84, sink: 5, hay: 0.9,
    perches: [[40, 23.5], [61, 23]],
    hole: { x1: 38.5, x2: 61.5, top: 42.5, lip: 76.6 },
    svg: `
        <defs>${HOLE_GRAD}</defs>
        <g fill="#7f5434" stroke="#5e3d26" stroke-width="1.4" stroke-linejoin="round">
          <path d="M1 81 Q12 77 20 62 L27 70 Q17 78 15 81Z"/>
          <path d="M99 81 Q88 77 80 62 L73 70 Q83 78 85 81Z"/>
        </g>
        <path d="M10 81 Q19 74 20 58 L21 24 H79 L80 58 Q81 74 90 81Z" fill="#93633f" stroke="#5e3d26" stroke-width="1.6" stroke-linejoin="round"/>
        <g stroke="#6f4a2f" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8">
          <path d="M28 30 Q26 40 29 52 M72 31 Q75 42 71 56 M35 29 V37 M65 29 Q63 34 65 39 M25 60 Q24 68 19 75 M76 60 Q78 68 83 75"/>
        </g>
        <ellipse class="stump-top" cx="50" cy="24" rx="29" ry="7.5" stroke="#5e3d26" stroke-width="1.6"/>
        <g fill="none" stroke="#b98c58" stroke-width="1">
          <ellipse cx="50" cy="24" rx="21" ry="5.2"/><ellipse cx="50" cy="24" rx="13" ry="3.2"/><ellipse cx="50" cy="24" rx="5" ry="1.2"/>
        </g>
        <path d="M21 26 Q23 19 33 21.5 Q31 27 25 29 Q22 29 21 26Z" fill="#7fb35c"/>
        <path d="M20 40 Q23 36 24 44 Q21 47 20 44Z" fill="#7fb35c" opacity=".85"/>
        <path d="M70 21 Q72 14 76 11" stroke="#4f8a3a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <ellipse cx="78" cy="10.5" rx="3.6" ry="1.8" fill="#6bab4c" transform="rotate(-25 78 10.5)"/>
        <ellipse cx="72" cy="15" rx="3" ry="1.5" fill="#6bab4c" transform="rotate(30 72 15)"/>
        <path d="M37 82 V54 A13 13 0 0 1 63 54 V82Z" fill="url(#holeg)" stroke="#5e3d26" stroke-width="1.6"/>
        <path d="M39 80 V54.5 A11 11 0 0 1 61 54.5 V80" fill="none" stroke="#c99a68" stroke-width="1" opacity=".5"/>
        <path d="M27 82 Q33 76.4 50 76.4 Q67 76.4 73 82Z" fill="#87593a" stroke="#5e3d26" stroke-width="1.4" stroke-linejoin="round"/>
        <g stroke="#7a2d22" stroke-width=".8">
          <rect x="84" y="71" width="3" height="7" rx="1.2" fill="#f3e6d2"/>
          <path d="M80.5 72.5 Q85.5 63.5 90.5 72.5Z" fill="#d9483b"/>
          <rect x="90.6" y="75.5" width="2" height="4.5" rx=".9" fill="#f3e6d2"/>
          <path d="M88.6 76.4 Q91.6 71 94.6 76.4Z" fill="#d9483b"/>
        </g>
        <g fill="#fff"><circle cx="83.5" cy="69.5" r=".9"/><circle cx="87" cy="68" r=".8"/><circle cx="85.6" cy="71" r=".6"/><circle cx="91.5" cy="74.4" r=".6"/></g>
        <g stroke="#6e5130" stroke-width=".7">
          <rect x="11" y="74" width="1.8" height="5" rx=".8" fill="#efe1c8"/><path d="M8.6 75 Q11.9 70.5 15.2 75Z" fill="#b08a5a"/>
          <rect x="15.8" y="76" width="1.5" height="4" rx=".7" fill="#efe1c8"/><path d="M14 76.8 Q16.6 73.4 19.2 76.8Z" fill="#b08a5a"/>
        </g>`,
    lights: `
        <defs>${GLOW_GRAD('mg', '#b8ffd9')}</defs>
        <circle class="lt flk" cx="85.5" cy="70" r="8" fill="url(#mg)"/>
        <circle class="lt flk" cx="91.6" cy="75" r="5" fill="url(#mg)"/>
        <circle class="lt flk" cx="12" cy="75" r="5.5" fill="url(#mg)"/>`,
  },
  alpin: {
    name: 'Geröllhalde', w: 0.78, left: -0.1, vh: 64, sink: 4, rand: { b: 1, l: 1 }, hay: 0.84, mountains: true,
    perches: [[55, 11.5], [21, 30], [81, 30.2]],
    flowers: ['#ffffff', '#3d6fd6', '#ffffff', '#f6c945', '#b99cf0'],
    hole: { x1: 39, x2: 61, top: 34, lip: 55.3 },
    svg: `
        <defs>${HOLE_GRAD}</defs>
        <g stroke="#565b61" stroke-width="1.4" stroke-linejoin="round">
          <path d="M28 42 L37 17 L56 11 L73 21 L72 42Z" fill="#adb3b9"/>
          <path d="M0 62 L3 42 L14 29 L31 31 L39 46 L37 62Z" fill="#9aa1a8"/>
          <path d="M63 62 L61 44 L72 29 L89 31 L99 46 L98 62Z" fill="#8e959c"/>
        </g>
        <g fill="#fff" opacity=".22"><path d="M37 17 L56 11 L49 24Z"/><path d="M14 29 L31 31 L21 37Z"/><path d="M72 29 L89 31 L80 36Z"/></g>
        <g fill="#000" opacity=".12"><path d="M56 11 L73 21 L72 42 L62 30Z"/><path d="M31 31 L39 46 L37 62 L30 50Z"/><path d="M89 31 L99 46 L98 62 L90 48Z"/></g>
        <g fill="#c9c86a" opacity=".8"><ellipse cx="45" cy="20" rx="2.4" ry="1.2"/><ellipse cx="10" cy="40" rx="2" ry="1"/><ellipse cx="84" cy="36" rx="2.2" ry="1"/></g>
        <path d="M38 64 V45 A12 12 0 0 1 62 45 V64Z" fill="url(#holeg)" stroke="#565b61" stroke-width="1.4"/>
        <path d="M30 56 L51 54.9 L70 56.3 L72 63 L28 63Z" fill="#a3a9ae" stroke="#565b61" stroke-width="1.3" stroke-linejoin="round"/>
        <g fill="#9aa1a8" stroke="#565b61" stroke-width="1">
          <path d="M18 63 L21 58.5 L26 59 L27 63Z"/><path d="M74 63 L76 59.5 L80 59.2 L82 63Z"/><path d="M2 63 L4 60 L8 60.4 L9 63Z"/>
        </g>`,
  },
};

export { GLOW_GRAD, AREALE, randStil, RAND_SVG };
