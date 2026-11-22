// Album 2: Schlitten (t2 = 2). Daten, Bild fürs Album (24 × 24), der Schlitten in der Szene, das Seilende im Maul und
// die Schneewehe am Aussichtsstein, auf der er rodelt. Felder siehe src/grafik/album2.js; die Szene:
// src/karte/album2-sled.js, der Stil: src/stil/album2-sled.js. Monate November bis März.

import { OUT } from '../pika.js';

// Farben wie die Schätze aus Album 1: Holz wie Windrad und Hängematte, Kufen im Rot des Windrads, Seil wie Hanf
const HOLZ = '#9a6a3c';
const HOLZ_HELL = '#c98e4e';
const KUFE = '#e8584e';
const KUFE_HINTEN = '#b8443c';
const SEIL = '#d8b98a';

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.4 13.4 Q15.4 6.2 8.6 8.4" stroke="${OUT}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      <path d="M19.4 13.4 Q15.4 6.2 8.6 8.4" stroke="${SEIL}" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M5.6 14 V19.6 M11.4 14 V19.6 M17 14 V19.6" stroke="${OUT}" stroke-width="2.4"/>
      <path d="M5.6 14 V19.6 M11.4 14 V19.6 M17 14 V19.6" stroke="${HOLZ}" stroke-width="1.2"/>
      <path d="M1.8 19.6 H18.2 Q22.6 19.6 22.3 15.6 Q22 12.8 19.4 13.4" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M1.8 19.6 H18.2 Q22.6 19.6 22.3 15.6 Q22 12.8 19.4 13.4" stroke="${KUFE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <rect x="2.4" y="11.4" width="16.6" height="3" rx=".9" fill="${HOLZ_HELL}" stroke="${OUT}" stroke-width=".8"/>
      <path d="M8.2 11.7 V14.1 M13.6 11.7 V14.1" stroke="#a87442" stroke-width=".6"/>
      <path d="M3.8 12.3 H17.6" stroke="#e0b47c" stroke-width=".7" stroke-linecap="round"/></svg>`;

// Der Schlitten von der Seite, Spitze nach rechts: viewBox 48 × 22, Kufen unten bei y 20,6 (dort liegt er auf dem
// Schnee), Sitz oben bei y 10,4. Die hintere Kufe schaut dunkler hinter der vorderen hervor. Fährt er nach links,
// spiegelt das Skript ihn (.a2slf).
const SLED_SVG = `<svg viewBox="0 0 48 22" aria-hidden="true">
      <path d="M1.6 18.4 H35.6 Q43 18.4 42.7 11.4 Q42.5 7.6 38.8 8.2" stroke="${OUT}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M1.6 18.4 H35.6 Q43 18.4 42.7 11.4 Q42.5 7.6 38.8 8.2" stroke="${KUFE_HINTEN}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M8 13 V19.6 M20 13 V19.6 M32 13 V19.6" stroke="${OUT}" stroke-width="2.8"/>
      <path d="M8 13 V19.6 M20 13 V19.6 M32 13 V19.6" stroke="${HOLZ}" stroke-width="1.5"/>
      <path d="M3 19.6 H37 Q44.6 19.6 44.3 12.6 Q44.1 8.6 40.2 9.4" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M3 19.6 H37 Q44.6 19.6 44.3 12.6 Q44.1 8.6 40.2 9.4" stroke="${KUFE}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M5 19.1 H35" stroke="#ff9a8f" stroke-width=".7" stroke-linecap="round" opacity=".8"/>
      <rect x="4" y="10.4" width="33" height="3.6" rx="1.2" fill="${HOLZ_HELL}" stroke="${OUT}" stroke-width=".9"/>
      <path d="M15 10.8 V13.6 M26 10.8 V13.6" stroke="#a87442" stroke-width=".7"/>
      <path d="M6 11.5 H35" stroke="#e0b47c" stroke-width=".8" stroke-linecap="round"/></svg>`;
// Maße: Breite in Pika-Breiten; der Haken für das Seil (vorn an der Spitze) und die Sitzfläche in Anteilen des Bilds
// (x von links, y von oben); die Kufen liegen SLED_SINK über der Unterkante
const SLED_W = 0.8;
const SLED_HOOK = [40.4 / 48, 9.4 / 22];
const SLED_SEAT = (20.6 - 10.6) / 22;
const SLED_SINK = (22 - 20.6) / 22;

// Seilende im Maul (für _mouth, 24 × 24, ohne id und class)
const ROPE_MOUTH = `<svg viewBox="0 0 24 24"><path d="M3 9 Q10 15 19 11.6" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path d="M3 9 Q10 15 19 11.6" stroke="${SEIL}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

// Schneewehe am linken Fuß des Aussichtssteins (in Einheiten der Stein-Grafik: viewBox 100 × 50, Boden bei y 46,
// flache Oberseite bei y 13 ab x 28, siehe LOOKOUT_SVG in src/grafik/szene.js). Sie lehnt am Stein und läuft nach links
// flach in die Wiese aus: Oberfläche y = 46 − 33 · (1 − t)^DRIFT_K mit t = (DRIFT_TOP − u) / (DRIFT_TOP − u0) für u von
// u0 (Fuß, links, negativ) bis DRIFT_TOP. Oben steil wie ein Hang, unten ganz flach, so läuft der Schlitten aus.
const DRIFT_TOP = 30;
const DRIFT_K = 1.6;
const DRIFT_U0 = -45; // Fuß auf breiten Karten; auf schmalen rückt er näher an den Stein (das Skript)
const driftY = (u, u0) => {
  if (u >= DRIFT_TOP) return 13;
  if (u <= u0) return 46;
  const t = (DRIFT_TOP - u) / (DRIFT_TOP - u0);
  return 46 - 33 * (1 - t) ** DRIFT_K;
};
// Bild der Wehe für den Fuß u0: viewBox in Stein-Einheiten von u0 − 2 bis 38, y 11 bis 47 (Unterkante 1 unter dem
// Boden, sie sinkt ins Gras). Rechts biegt sie über die Flanke des Steins hinunter.
const DRIFT_SVG = (u0) => {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = u0 + ((DRIFT_TOP - u0) * i) / 16;
    pts.push(`${u.toFixed(2)} ${driftY(u, u0).toFixed(2)}`);
  }
  const top = `M${pts.join(' L')}`;
  const x0 = (u0 - 2).toFixed(2);
  return `<svg viewBox="${x0} 11 ${(40 - u0).toFixed(2)} 36" preserveAspectRatio="none" aria-hidden="true">
      <path d="M${x0} 47 L${pts.join(' L')} Q35 13.2 36.4 17.6 Q37.8 25 34.6 32 Q32.4 39 37 47Z" fill="#f4f8fb"/>
      <path d="M${(u0 + 4).toFixed(2)} 47 Q${((u0 + 30) / 2).toFixed(2)} 41.8 31 37.5 Q33 42 37 47Z" fill="#dfe8f1" opacity=".85"/>
      <path d="${top} Q35 13.2 36.4 17.6" stroke="#c3d1df" stroke-width=".7" fill="none" stroke-linejoin="round"/>
      <path d="M${(u0 * 0.35 + 30 * 0.65).toFixed(2)} ${(driftY(u0 * 0.35 + 30 * 0.65, u0) + 1.6).toFixed(2)} Q22 16.6 28.4 14.6" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".9"/></svg>`;
};

// Schneefunken hinter dem goldenen Schlitten (viewBox 24 × 24, Stern wie STAR in src/grafik/szene.js)
const FUNKE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 Q13.4 10.6 23 12 Q13.4 13.4 12 23 Q10.6 13.4 1 12 Q10.6 10.6 12 1Z"/></svg>';

const A2_SLED = {
  key: 'sled', name: 'Schlitten', say: 'ein Schlitten!', built: true, mo: [10, 11, 0, 1, 2],
  icon: ICON,
  trick: 'Bauchrutscher', gilt: 'ein goldener %', use: 'Für Tage, an denen Schnee liegt.', gold: 'eine Spur aus Schneefunken',
  find: { t: 'Schlitten', h: 'Tipp den Schlitten an, wenn er ihn bei Schnee herausholt. Er wackelt, und Schnee stiebt auf.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]. Die Knöpfe gehen
  // auch ohne Schnee (_forced); von selbst rodelt er nur, wenn Schnee liegt.
  dbg: [['Rodeln', 'a2SledPlay', 1], ['Bauchrutscher', 'a2SledBelly', 2], ['Schneefunken (golden)', 'a2SledPlay', 3]],
};

export {
  A2_SLED, SLED_SVG, SLED_W, SLED_HOOK, SLED_SEAT, SLED_SINK, ROPE_MOUTH, SEIL,
  DRIFT_TOP, DRIFT_U0, driftY, DRIFT_SVG, FUNKE_SVG,
};
