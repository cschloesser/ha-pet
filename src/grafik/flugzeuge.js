// Flugzeuge: Jet, Propeller, Hubschrauber, Größen, Leitwerksfarben der Airlines

// Seitenansicht mit der Nase nach rechts, viewBox 0 0 100 40. --tail ist die Airline-Farbe.
// .pl-body wird nachts abgedunkelt, Fenster (.win) leuchten dann, .bcn blinkt rot, .strobe blitzt weiß.
const PLANE_SVG = {
  jet: `<svg viewBox="0 0 100 40" aria-hidden="true"><g class="pl-body">
      <path fill="var(--tail)" d="M9 17 L3 2.8 Q2.7 1.5 4.3 1.5 L11 1.5 Q12.4 1.5 13.4 2.8 L25 16.5Z"/>
      <path fill="#f8fafc" stroke="#b7c3cf" stroke-width=".6" d="M6 20 Q6 16 12 16 L78 16 Q93 16 98 21 Q94 26.5 80 26.5 L16 26.5 Q9 25 6 20Z"/>
      <path fill="var(--tail)" d="M15 24.6 L82 24.6 Q90 24.6 95.2 23.3 Q91 26.5 80 26.5 L16 26.5 Q15 25.6 15 24.6Z"/>
      <path fill="#4c6a8e" d="M86.5 18.2 Q91.5 18.4 94.2 20.4 L87.5 20.6 Q86 19.6 86.5 18.2Z"/>
      <path fill="var(--tail)" d="M4 20 L16 20.3 L22 21.6 L6 22Z"/>
      <path fill="#e6ecf2" stroke="#b7c3cf" stroke-width=".6" d="M40 23.5 L58 23.5 L47 36 Q46 37 44.5 37 L41 37Z"/>
      <rect x="46" y="27.5" width="13" height="5.4" rx="2.7" fill="#d5dde6" stroke="#aab7c4" stroke-width=".5"/>
      <ellipse cx="58.6" cy="30.2" rx="1" ry="2.2" fill="#7d8c9c"/>
    </g><g class="win">${Array.from({ length: 15 }, (_, i) => `<circle cx="${22 + i * 4}" cy="19.6" r="1.05"/>`).join('')}</g>
    <circle class="bcn" cx="52" cy="15.6" r="1.4"/><circle class="strobe" cx="44" cy="36.4" r="1.4"/><circle class="strobe" cx="3.6" cy="2.4" r="1.1"/></svg>`,
  prop: `<svg viewBox="0 0 100 40" aria-hidden="true"><g class="pl-body">
      <path fill="var(--tail)" d="M8 20 L5 7 Q5 6 6.5 6 L11 6 Q12 6 13 7.5 L24 18Z"/>
      <path fill="#f8fafc" stroke="#b7c3cf" stroke-width=".6" d="M6 21 Q8 18 24 17 L62 15.5 Q80 15 86 19 L87 24.5 Q78 27.5 64 27.5 L26 26 Q10 24.5 6 21Z"/>
      <path fill="var(--tail)" opacity=".85" d="M10 22.4 L86 22.6 L86.6 24 L10 23.6Z"/>
      <path fill="var(--tail)" d="M4 21 L16 21 L20 22.4 L6 22.8Z"/>
      <path d="M50 15.8 L58 25 M60 27 L58 32 M80 26 L80 31" stroke="#8b98a6" stroke-width="1.1" fill="none"/>
      <rect x="44" y="11.6" width="30" height="4.2" rx="2.1" fill="#e6ecf2" stroke="#b7c3cf" stroke-width=".6"/>
      <circle cx="58" cy="32.5" r="2" fill="#4a5562"/><circle cx="80" cy="31.5" r="1.8" fill="#4a5562"/>
      <path fill="#c9d2dc" d="M86 18.5 Q90.5 21.5 86.5 25Z"/>
    </g><g class="win"><path d="M62 17.2 L75 16.8 Q80 17.4 82 20.4 L63 20.6Z"/></g>
    <ellipse class="prop" cx="90" cy="21.8" rx="1.1" ry="9" fill="rgba(70, 78, 90, .45)"/>
    <circle class="bcn" cx="40" cy="16.8" r="1.2"/><circle class="strobe" cx="73" cy="13.6" r="1.1"/></svg>`,
  heli: `<svg viewBox="0 0 100 40" aria-hidden="true"><g class="pl-body">
      <path fill="var(--tail)" d="M42 20 L10 18.5 Q8 18.5 8 20 L8 21.5 Q8 23 10 23 L42 25.5Z"/>
      <path fill="var(--tail)" d="M10 19 L6 11 L10 11 L14 19Z"/>
      <path fill="var(--tail)" stroke="rgba(0, 0, 0, .15)" stroke-width=".6" d="M46 13.5 Q70 11 82 19.5 Q85 29 68 30.5 L50 30.5 Q38 30 38 22 Q38 14.5 46 13.5Z"/>
      <path fill="#9cc0de" d="M66 14.4 Q77 15.6 81.2 21 L68 21 Q66 18 66 14.4Z"/>
      <rect x="58" y="8.5" width="3.4" height="5.5" rx="1" fill="#59626d"/>
      <path d="M48 30.5 L46 34.5 M74 30.5 L76 34.5 M40 34.5 L84 34.5 Q86 34.5 86.5 33" stroke="#59626d" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </g><rect class="rotor" x="22" y="7" width="76" height="1.8" rx=".9" fill="rgba(60, 66, 74, .75)"/>
    <circle class="trotor" cx="8" cy="20" r="5" fill="rgba(60, 66, 74, .2)" stroke="rgba(60, 66, 74, .5)" stroke-width=".6"/>
    <circle class="bcn" cx="60" cy="13.6" r="1.2"/><circle class="strobe" cx="6.5" cy="11.2" r="1"/></svg>`,
};
const PLANE_SIZE = { jet: 1, prop: 0.55, heli: 0.5 };
// Leitwerk in Airline-Farbe (ICAO-Kürzel), sonst Himmelblau
const TAIL = {
  WZZ: '#c6007e', WMT: '#c6007e', WUK: '#c6007e', EWG: '#a1195b', EWL: '#a1195b', RYR: '#073590', RUK: '#073590',
  DLH: '#0a1d3d', CLH: '#0a1d3d', KLM: '#00a1de', AFR: '#002157', BAW: '#075aaa', THY: '#c70a0c', PGT: '#f4b400',
  SXS: '#ff9e1b', CFG: '#f5b100', TUI: '#70cbf4', TFL: '#70cbf4', EZY: '#ff6600', UAE: '#d71921', SWR: '#e2001a',
  AUA: '#e2001a', SAS: '#00205b', LOT: '#11397e', CAI: '#e30613', DHK: '#ffcc00', BCS: '#ffcc00', UPS: '#5b3a1e',
  FDX: '#4d148c', QTR: '#5c0632', ETD: '#b38b4d', AEE: '#0a3d7a', TAP: '#00a14b', IBE: '#d7192d', VLG: '#ffcc00',
};
const TAIL_DEFAULT = { jet: '#3d8fd6', prop: '#d9473b', heli: '#e0b52c' };

export { PLANE_SVG, PLANE_SIZE, TAIL, TAIL_DEFAULT };
