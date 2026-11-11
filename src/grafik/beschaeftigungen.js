// Beschäftigungen: Fernsehfarben, Drachen, Staffelei, Schirmchen, Tropfen, Pfütze, Schiffchen, Schnee-Pika, Steine, Papierflieger

import { OUT, BOAT_ART } from './pika.js';

// Fernsehbild: wechselt alle paar Sekunden die Farbe (Schnitt), daraus Licht im Eingang und Lichtsaum
const TV_COLORS = ['#9fd0ff', '#e8f4ff', '#a8f0c6', '#ffd59e', '#c8b6ff', '#ff9fb2', '#9fe7ff'];

// Drachen in px um die Pfote (0, 0): Schnur bis (kx, ky), dort der Drache (Größe K) mit Gesicht und Schwanz
const KITE_SVG = (kx, ky, K) => {
  const f = (n) => n.toFixed(1);
  const bows = [1.25, 1.85, 2.45].map((t, i) => {
    const a = f(-K * 0.12), b = f(K * 0.12), y1 = f(K * (t - 0.06)), y2 = f(K * (t + 0.06));
    return `<path d="M${a} ${y1} L${b} ${y2} L${b} ${y1} L${a} ${y2}Z" fill="${['#e8584e', '#5fb9de', '#f6c945'][i]}"/>`;
  }).join('');
  return `<svg width="1" height="1" aria-hidden="true"><g class="kl"><g class="kr">
      <path d="M0 0 Q${f(kx * 0.6)} ${f(ky * 0.3)} ${f(kx)} ${f(ky)}" stroke="rgba(255, 255, 255, .85)" stroke-width="1" fill="none"/>
      <g transform="translate(${f(kx)} ${f(ky)})"><g class="kb">
        <g class="kt">
          <path d="M0 ${f(K * 0.8)} q${f(K * 0.18)} ${f(K * 0.3)} 0 ${f(K * 0.6)} t0 ${f(K * 0.6)} t0 ${f(K * 0.6)}" stroke="#5a4030" stroke-width="1" fill="none"/>
          ${bows}
        </g>
        <path d="M0 ${f(-K * 0.6)} L${f(K * 0.42)} 0 L0 ${f(K * 0.8)} L${f(-K * 0.42)} 0Z" fill="#f6c945" stroke="#5a4030" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M0 ${f(-K * 0.6)} L${f(K * 0.42)} 0 L0 0Z M0 0 L${f(-K * 0.42)} 0 L0 ${f(K * 0.8)}Z" fill="#e8584e"/>
        <path d="M0 ${f(-K * 0.6)} V${f(K * 0.8)} M${f(-K * 0.42)} 0 H${f(K * 0.42)}" stroke="#7a5236" stroke-width=".8" opacity=".7"/>
        <circle cx="${f(-K * 0.13)}" cy="${f(-K * 0.14)}" r="${f(K * 0.035)}" fill="#2a1a12"/>
        <circle cx="${f(K * 0.13)}" cy="${f(-K * 0.14)}" r="${f(K * 0.035)}" fill="#2a1a12"/>
        <path d="M${f(-K * 0.1)} ${f(K * 0.03)} q${f(K * 0.1)} ${f(K * 0.09)} ${f(K * 0.2)} 0" stroke="#2a1a12" stroke-width="1" fill="none" stroke-linecap="round"/>
      </g></g>
    </g></g></svg>`;
};

// Staffelei (viewBox 60 × 80): Leinwand x 9–51, y 7–51. Das Bild entsteht in fünf Schichten (Himmel, Sonne oder
// Mond, Hügel, Motiv, Kleinkram); der Himmel folgt der Tageszeit der Szene. Motiv: [Pinselfarbe, Grafik]
const EASEL_MOTIF = {
  blume: ['#f28fb1', `<path d="M24 47 V37" stroke="#4f8a3a" stroke-width="1.2"/>
      <ellipse cx="26.6" cy="42.2" rx="2.6" ry="1" fill="#5fae4a" transform="rotate(-30 26.6 42.2)"/>
      <g fill="#f28fb1"><circle cx="24" cy="32.8" r="2.1"/><circle cx="26.7" cy="34.9" r="2.1"/><circle cx="21.3" cy="34.9" r="2.1"/>
      <circle cx="25.7" cy="37.7" r="2.1"/><circle cx="22.3" cy="37.7" r="2.1"/></g><circle cx="24" cy="35.6" r="1.6" fill="#f6c945"/>`],
  pika: ['#c49a74', `<circle cx="23.4" cy="38.4" r="2.4" fill="#b08a68" stroke="#5a4030" stroke-width=".5"/>
      <circle cx="29.2" cy="38.2" r="2.4" fill="#b08a68" stroke="#5a4030" stroke-width=".5"/>
      <ellipse cx="26.4" cy="43.6" rx="6.8" ry="4.9" fill="#c49a74" stroke="#5a4030" stroke-width=".6"/>
      <circle cx="24.4" cy="42.4" r=".75" fill="#2a1a12"/><circle cx="28.6" cy="42.4" r=".75" fill="#2a1a12"/>
      <ellipse cx="26.5" cy="44.2" rx="1.1" ry=".65" fill="#7a4438"/>`],
  pino: ['#f2b36e', `<circle cx="23.4" cy="38.4" r="2.4" fill="#dc8640" stroke="#5a4030" stroke-width=".5"/>
      <circle cx="29.2" cy="38.2" r="2.4" fill="#dc8640" stroke="#5a4030" stroke-width=".5"/>
      <ellipse cx="26.4" cy="43.6" rx="6.8" ry="4.9" fill="#f2b36e" stroke="#5a4030" stroke-width=".6"/>
      <path d="M21 46.4 Q26.4 48.6 31.8 46.4" stroke="#3fb8b0" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle cx="24.4" cy="42.4" r=".75" fill="#2a1a12"/><circle cx="28.6" cy="42.4" r=".75" fill="#2a1a12"/>`],
  bau: ['#8a6a4a', `<path d="M12 48 Q25 26 40 48Z" fill="#8a6a4a" stroke="#5a4030" stroke-width=".6"/>
      <path d="M22.6 48 V43 a3.2 3.2 0 0 1 6.4 0 V48Z" fill="#5fae4a" stroke="#3f7f31" stroke-width=".5"/>
      <circle cx="33" cy="40.6" r="1.7" fill="#ffe08a" stroke="#5a4030" stroke-width=".5"/>`],
  flieger: ['#f4f6f8', `<path d="M12 23 L27 16.4" stroke="#fff" stroke-width="1" opacity=".85" stroke-dasharray="2 1.4"/>
      <path d="M27 16.6 l6 -1.4 l-2 -2.4 h1.4 l3.6 2 l3 -.6 q1.4 .4 .2 1 l-3 .7 l-3 2.6 h-1.4 l1.6 -2.6 l-5.6 1.2z"
            fill="#f4f6f8" stroke="#5a6470" stroke-width=".4"/>`],
  regenbogen: ['#e8584e', ['#e8584e', '#f28c28', '#f6c945', '#5fae4a', '#4f86c6'].map((c, i) => {
    const r = 17 - i * 1.6;
    return `<path d="M${30 - r} 41 A${r} ${r} 0 0 1 ${30 + r} 41" stroke="${c}" stroke-width="1.7" fill="none"/>`;
  }).join('')],
};
const EASEL_SVG = (motif) => `
    <svg viewBox="0 0 60 80" aria-hidden="true">
      <defs><clipPath id="cvclip"><rect x="9" y="7" width="42" height="44"/></clipPath></defs>
      <path d="M30 6 L31 77" stroke="#7a5230" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M26 3 L9 79 M34 3 L51 79" stroke="#a0703f" stroke-width="3" stroke-linecap="round"/>
      <rect x="9" y="7" width="42" height="44" rx="1" fill="#fbf8f0"/>
      <g clip-path="url(#cvclip)">
        <g class="cvl"><rect class="cv-sky" x="9" y="7" width="42" height="44"/></g>
        <g class="cvl"><circle class="cv-sun" cx="42" cy="16" r="4.6"/></g>
        <g class="cvl"><path d="M9 38 Q21 30 33 36 T51 33 V51 H9Z" fill="#86c46b"/><path d="M9 45 Q26 40 51 45 V51 H9Z" fill="#5fae4a"/></g>
        <g class="cvl">${EASEL_MOTIF[motif][1]}</g>
        <g class="cvl">
          <path d="M15 22 q1.2 -1.2 2.4 0 q1.2 -1.2 2.4 0 M36 26 q1 -1 2 0 q1 -1 2 0" stroke="#4a3a2c" stroke-width=".6" fill="none"/>
          <g fill="#fff"><circle cx="40" cy="47" r=".9"/><circle cx="45" cy="45.6" r=".9"/><circle cx="13.6" cy="48" r=".9"/></g>
          <g fill="#f6c945"><circle cx="40" cy="47" r=".35"/><circle cx="45" cy="45.6" r=".35"/><circle cx="13.6" cy="48" r=".35"/></g>
        </g>
      </g>
      <rect x="9" y="7" width="42" height="44" rx="1" fill="none" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="6" y="51" width="48" height="3.4" rx="1" fill="#a0703f" stroke="${OUT}" stroke-width=".8"/>
      <rect x="26" y="2" width="8" height="5" rx="1" fill="#a0703f" stroke="${OUT}" stroke-width=".8"/>
    </svg>`;
const SEED_SVG = `<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 6 V15" stroke="#b9ad8e" stroke-width=".8"/>
    <path d="M6 6 L1 2 M6 6 L3 .8 M6 6 L6 0 M6 6 L9 .8 M6 6 L11 2" stroke="#fff" stroke-width=".7" stroke-linecap="round"/>
    <ellipse cx="6" cy="15" rx=".9" ry="1.3" fill="#8a6a4a"/></svg>`;
const DROP_SVG = '<svg viewBox="0 0 10 14" aria-hidden="true"><path d="M5 0 Q10 8 5 13.4 Q0 8 5 0Z" fill="#9fdcff" stroke="#5a9cc8" stroke-width=".7"/></svg>';
// Requisiten der kleinen Beschäftigungen am Boden (_aprop): Pfütze (100 × 16, liegt vorn auf dem Wiesenstreifen),
// Papierschiffchen darauf, Schnee-Pika (60 × 72, wächst in vier Schichten .sp1 … .sp4), Steintürmchen (40 × 56,
// vier Steine .st1 … .st4) und der fliegende Papierflieger (26 × 14, Nase rechts).
const PUDDLE_SVG = `<svg viewBox="0 0 100 16" aria-hidden="true">
      <path d="M5 8.6 C3 4 18 1.6 36 2.2 C50 .4 76 .8 89 4 C98 6.2 97 12 86 13.6 C68 16 30 16 15 14 C8 13 5.6 11 5 8.6Z"
            fill="#8fb4c9" stroke="#4f86b8" stroke-width="1"/>
      <path d="M16 6.4 Q32 3.6 50 4.2" stroke="#dff1ff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".85"/>
      <path d="M60 11.8 Q72 12.8 81 10.6" stroke="#dff1ff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".6"/>
      <ellipse class="pd-rip" cx="50" cy="8" rx="30" ry="5" fill="none" stroke="#fff" stroke-width="1"/>
      <ellipse class="pd-dot" cx="24" cy="9.8" rx="5" ry="1.5" fill="none" stroke="#dff1ff" stroke-width=".7"/>
      <ellipse class="pd-dot pd-d2" cx="74" cy="6.4" rx="5" ry="1.5" fill="none" stroke="#dff1ff" stroke-width=".7"/>
    </svg>`;
const BOAT_SVG = `<svg viewBox="0 0 30 24" aria-hidden="true">${BOAT_ART}</svg>`;
const SNOWPIKA_SVG = `<svg viewBox="0 0 60 72" aria-hidden="true">
      <g class="spl sp1">
        <ellipse cx="30" cy="51" rx="21" ry="19" fill="#f4f6f8" stroke="#9aa3ad" stroke-width="1.2"/>
        <path d="M13.5 56 Q20 67 35 67.4" stroke="#bccbd8" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      </g>
      <g class="spl sp3">
        <circle cx="20.5" cy="12" r="6.4" fill="#f4f6f8" stroke="#9aa3ad" stroke-width="1.1"/><circle cx="20.5" cy="12.6" r="3.2" fill="#bccbd8"/>
        <circle cx="43" cy="11" r="6.4" fill="#f4f6f8" stroke="#9aa3ad" stroke-width="1.1"/><circle cx="43" cy="11.6" r="3.2" fill="#bccbd8"/>
      </g>
      <g class="spl sp2">
        <circle cx="32" cy="24.5" r="14.5" fill="#f4f6f8" stroke="#9aa3ad" stroke-width="1.2"/>
        <path d="M21 29 Q24.5 36.4 33.5 37" stroke="#bccbd8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </g>
      <g class="spl sp4">
        <circle cx="27" cy="22.6" r="1.9" fill="#2a1a12"/><circle cx="38.4" cy="22.6" r="1.9" fill="#2a1a12"/>
        <path d="M30.8 27 q2 -1 4 0 q-.6 1.7 -2 2.2 q-1.4 -.5 -2 -2.2z" fill="#7a4438"/>
        <path d="M25.4 29.4 L17.4 27.6 M25.4 31 L17.6 32.8 M40.2 29.4 L48.2 27.6 M40.2 31 L48 32.8" stroke="#8a5a32" stroke-width=".8" stroke-linecap="round"/>
        <circle cx="30" cy="45" r="1.5" fill="#8e9196"/><circle cx="30.4" cy="53" r="1.5" fill="#8e9196"/>
      </g>
    </svg>`;
const STONES_SVG = `<svg viewBox="0 0 40 56" aria-hidden="true">
      <g class="stn st1"><ellipse cx="20" cy="47.6" rx="15" ry="7.4" fill="#9aa3ad" stroke="#5a6470" stroke-width="1.1"/>
        <path d="M9.4 45.4 q7 -4 16 -3" stroke="#cfccc4" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>
      <g class="stn st2"><ellipse cx="21.4" cy="35.4" rx="11.6" ry="5.8" fill="#c9b27a" stroke="#7a5230" stroke-width="1.1"/>
        <path d="M13.4 33.6 q5 -2.8 12 -2.2" stroke="#ead2a2" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>
      <g class="stn st3"><ellipse cx="18.8" cy="26" rx="8.6" ry="4.6" fill="#8fb4c9" stroke="#4d6878" stroke-width="1.1"/>
        <path d="M13 24.6 q4 -2 8.6 -1.6" stroke="#dff1ff" stroke-width="1" fill="none" stroke-linecap="round"/></g>
      <g class="stn st4"><ellipse cx="20.6" cy="18.2" rx="6.2" ry="4" fill="#f4f6f8" stroke="#5a6470" stroke-width="1"/></g>
    </svg>`;
const GLIDER_SVG = `<svg viewBox="0 0 26 14" aria-hidden="true">
      <path d="M1 3 L25 6 L9 9Z" fill="#fffaf0" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M25 6 L9 9 L11 13 L13.6 8.4" fill="#ead2a2" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
    </svg>`;

export {
  TV_COLORS, KITE_SVG, EASEL_MOTIF, EASEL_SVG, SEED_SVG, DROP_SVG, PUDDLE_SVG, BOAT_SVG, SNOWPIKA_SVG, STONES_SVG,
  GLIDER_SVG,
};
