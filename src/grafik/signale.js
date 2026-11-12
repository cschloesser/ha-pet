// Haus-Signale: Mülltonne, Saugroboter, Garderobe an der Tür (Gummistiefel, Schirm, Mütze, Sonnenhut)

const OUT = '#5a4030';

// Mülltonne mit Rädern (Deckel in der Farbe der Abholung), Vorderseite zum Betrachter
const SIG_BIN = (color) => `<svg viewBox="0 0 30 40" aria-hidden="true">
    <ellipse cx="15" cy="38.6" rx="12" ry="1.4" fill="rgba(0,0,0,.18)"/>
    <path d="M5.5 9 L7.5 36 H22.5 L24.5 9 Z" fill="${color}" stroke="${OUT}" stroke-width="1"/>
    <path d="M5.5 9 L7.5 36 H11 L9.4 9 Z" fill="rgba(255,255,255,.18)"/>
    <path d="M9 15 V31 M15 15 V31 M21 15 V31" stroke="rgba(0,0,0,.18)" stroke-width="1.1" stroke-linecap="round"/>
    <rect x="3.6" y="5.6" width="22.8" height="4" rx="1.4" fill="${color}" stroke="${OUT}" stroke-width="1"/>
    <rect x="11" y="3.6" width="8" height="2.4" rx="1" fill="${color}" stroke="${OUT}" stroke-width=".8"/>
    <rect x="3.6" y="5.6" width="22.8" height="1.5" rx=".7" fill="rgba(255,255,255,.3)"/>
    <circle cx="9" cy="36.4" r="2.4" fill="#3a3a3a" stroke="${OUT}" stroke-width=".7"/><circle cx="9" cy="36.4" r=".8" fill="#9a9a9a"/>
    <circle cx="21" cy="36.4" r="2.4" fill="#3a3a3a" stroke="${OUT}" stroke-width=".7"/><circle cx="21" cy="36.4" r=".8" fill="#9a9a9a"/>
  </svg>`;

// Saugroboter von der Seite: flache Scheibe, Kuppel mit Sensor, Licht (blinkt bei Störung), Bürste
const SIG_VAC = `<svg viewBox="0 0 44 18" aria-hidden="true">
    <ellipse cx="22" cy="16.8" rx="19" ry="1.2" fill="rgba(0,0,0,.2)"/>
    <path d="M3 9.5 Q3 6 8 6 H36 Q41 6 41 9.5 V12.5 Q41 15.5 36 15.5 H8 Q3 15.5 3 12.5 Z" fill="#eef1f4" stroke="${OUT}" stroke-width="1"/>
    <path d="M3.4 11.6 H40.6" stroke="#9aa6b2" stroke-width="1.2"/>
    <path d="M15 6 Q15 2.2 22 2.2 Q29 2.2 29 6 Z" fill="#d7dde3" stroke="${OUT}" stroke-width=".9"/>
    <rect x="18.5" y="3.4" width="7" height="1.6" rx=".8" fill="#5a6470"/>
    <circle class="sig-led" cx="34" cy="8.6" r="1.2" fill="#5fd06a"/>
    <path class="sig-brush" d="M4 15.4 l-2.6 1.6 M5.6 15.6 l-1.2 2 M2.8 14 l-2.4 .4" stroke="#7a6a5a" stroke-width=".7" stroke-linecap="round"/>
  </svg>`;

// Garderobe an der Tür: Gummistiefel (am Boden), Schirm, Mütze mit Schal, Sonnenhut (am Haken)
const SIG_WEAR = {
  boots: `<svg viewBox="0 0 26 20" aria-hidden="true">
    <path d="M3 2 H9 V14 Q9 15 10 15 H13 Q14.5 15 14.5 16.6 V18.4 H3 Z" fill="#f2c230" stroke="${OUT}" stroke-width="1"/>
    <path d="M13 3 H19 V14 Q19 15 20 15 H23 Q24.5 15 24.5 16.6 V18.4 H13 Z" fill="#f2c230" stroke="${OUT}" stroke-width="1"/>
    <path d="M3 4.2 H9 M13 5.2 H19" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>
    <path d="M3 17.2 H14.5 M13 17.2 H24.5" stroke="#b8860b" stroke-width="1"/>
  </svg>`,
  umbrella: `<svg viewBox="0 0 12 30" aria-hidden="true">
    <path d="M6 1.5 V4" stroke="${OUT}" stroke-width="1"/>
    <path d="M6 3.5 L2.6 22 Q6 24 9.4 22 Z" fill="#e8584e" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M6 3.5 L5 22.6 M6 3.5 L7.4 22.6" stroke="rgba(255,255,255,.35)" stroke-width=".7"/>
    <path d="M6 23 V27 Q6 29 4 29 Q2.4 29 2.4 27.4" stroke="${OUT}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>`,
  hat: `<svg viewBox="0 0 24 26" aria-hidden="true">
    <circle cx="12" cy="3.4" r="2.6" fill="#fff6ea" stroke="${OUT}" stroke-width=".8"/>
    <path d="M4.4 13 Q4 5 12 5 Q20 5 19.6 13 Z" fill="#d9503f" stroke="${OUT}" stroke-width="1"/>
    <rect x="3.6" y="11.6" width="16.8" height="3.6" rx="1.4" fill="#f0eadc" stroke="${OUT}" stroke-width=".9"/>
    <path d="M7 15 V24 Q7 25 8 25 H11 Q12 25 12 24 V15" fill="#3f7fc4" stroke="${OUT}" stroke-width=".9"/>
    <path d="M7 19 H12 M7 22 H12" stroke="#f0eadc" stroke-width="1"/>
  </svg>`,
  sunhat: `<svg viewBox="0 0 28 16" aria-hidden="true">
    <ellipse cx="14" cy="11.4" rx="12.6" ry="3.6" fill="#e9cf8e" stroke="${OUT}" stroke-width="1"/>
    <path d="M7.6 11 Q7.6 3 14 3 Q20.4 3 20.4 11 Z" fill="#e9cf8e" stroke="${OUT}" stroke-width="1"/>
    <path d="M7.8 9.2 Q14 11 20.2 9.2" stroke="#e8584e" stroke-width="1.8" fill="none"/>
  </svg>`,
};

export { SIG_BIN, SIG_VAC, SIG_WEAR };
