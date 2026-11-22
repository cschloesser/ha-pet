// Album 2: Trampolin (t2 = 5). Daten, Bild fürs Album (24 × 24) und das kleine runde Trampolin in der Szene, in zwei
// Teilen: was hinter dem Pika liegt (hintere Beine, Polsterring, Sprungtuch) und was vor ihm (vorderer Bogen des
// Polsters, vordere Beine), damit er im Tuch steht und nicht davor schwebt. Felder siehe src/grafik/album2.js; die
// Szene: src/karte/album2-tramp.js, der Stil: src/stil/album2-tramp.js. Ganzjährig.

import { OUT } from '../pika.js';

// Farben: Polster in einem hellen Himmelblau (keiner der Schätze aus Album 1 ist blau, so fällt es auf der Wiese
// auf), Tuch fast schwarz wie echte Sprungtücher, Beine wie das Gestänge des Fernrohrs in Stahlgrau
const POLSTER = '#4f9fd8';
const POLSTER_HELL = '#9bd0f3';
const POLSTER_DUNKEL = '#3577b0';
const TUCH = '#353a46';
const TUCH_RAND = '#23262e';
const STAHL = '#8b95a1';

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4.6 Q12 1.8 16 4.6 M9.6 7.2 Q12 5.6 14.4 7.2" stroke="${POLSTER}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M7.4 13 V19.6 M16.6 13 V19.6" stroke="${OUT}" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M7.4 13 V19.6 M16.6 13 V19.6" stroke="#6f7883" stroke-width=".9" stroke-linecap="round"/>
      <path d="M3.6 13.4 L2.8 21 M12 15.4 V21.4 M20.4 13.4 L21.2 21" stroke="${OUT}" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M3.6 13.4 L2.8 21 M12 15.4 V21.4 M20.4 13.4 L21.2 21" stroke="${STAHL}" stroke-width="1.1" stroke-linecap="round"/>
      <ellipse cx="12" cy="12" rx="10.4" ry="3.5" fill="none" stroke="${OUT}" stroke-width="2.9"/>
      <ellipse cx="12" cy="12" rx="10.4" ry="3.5" fill="none" stroke="${POLSTER}" stroke-width="1.9"/>
      <ellipse cx="12" cy="12" rx="8.3" ry="2.3" fill="${TUCH}"/>
      <path d="M4 13.3 Q12 16.6 20 13.3" stroke="${POLSTER_HELL}" stroke-width=".7" fill="none" stroke-linecap="round" opacity=".85"/></svg>`;

// Das Trampolin von der Seite, leicht von oben: viewBox 64 × 23, die Füße der Beine bei y 21,4 (stehen im Gras;
// darunter Platz für Schatten und Fußkappen, Safari schneidet gefilterte Bilder an der viewBox ab).
// Polsterring um (32, 9) mit den Radien 29 × 4,4, das Tuch darin 25 × 3. Mitte des Tuchs (TRAMP_MAT) ist, wo er steht.
// Gibt das Tuch unter ihm nach, wird sein vorderer Rand ein tieferer Bogen (trampMat): Das setzt das Skript in jedem
// Bild als d von .a2trm, ebenso den Schatten auf dem Tuch (.a2trs, transform). Was hinten liegt, steht unter dem Pika
// (TRAMP_BACK), der vordere Bogen des Polsters und die vorderen Beine davor (TRAMP_FRONT); beide gleich groß.
const TRAMP_VB = [64, 23];
const TRAMP_FOOT = 21.4;
const TRAMP_MAT = 9;
const trampMat = (dip = 0) => `M7 9 A25 3 0 0 1 57 9 A25 ${(3 + Math.max(0, dip)).toFixed(2)} 0 0 1 7 9Z`;
const TRAMP_BACK = `<svg viewBox="0 0 64 23" aria-hidden="true">
      <ellipse cx="32" cy="21.3" rx="29" ry="1.5" fill="#000" opacity=".14"/>
      <path d="M20 6 V21 M44 6 V21" stroke="${OUT}" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M20 6 V21 M44 6 V21" stroke="#6f7883" stroke-width="1.2" stroke-linecap="round"/>
      <ellipse cx="32" cy="9" rx="29" ry="4.4" fill="none" stroke="${OUT}" stroke-width="3.7"/>
      <ellipse cx="32" cy="9" rx="29" ry="4.4" fill="none" stroke="${POLSTER_DUNKEL}" stroke-width="2.7"/>
      <path d="M7.4 7.2 Q32 2.6 56.6 7.2" stroke="${POLSTER}" stroke-width="1" fill="none" stroke-linecap="round" opacity=".9"/>
      <path class="a2trm" d="${trampMat(0)}" fill="${TUCH}" stroke="${TUCH_RAND}" stroke-width=".5"/>
      <path d="M13 7.6 Q32 5.4 51 7.6" stroke="#4d5363" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <ellipse class="a2trs" cx="32" cy="9.4" rx="8" ry="1.3" fill="#000" opacity=".3"/></svg>`;
const TRAMP_FRONT = `<svg viewBox="0 0 64 23" aria-hidden="true">
      <path d="M9.6 11.6 L8.2 21 M54.4 11.6 L55.8 21 M32 13.2 V21.2" stroke="${OUT}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M9.6 11.6 L8.2 21 M54.4 11.6 L55.8 21 M32 13.2 V21.2" stroke="${STAHL}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M6.2 21.1 H10.2 M53.8 21.1 H57.8 M30 21.3 H34" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M3 9 A29 4.4 0 0 0 61 9" stroke="${OUT}" stroke-width="3.7" fill="none"/>
      <path d="M3 9 A29 4.4 0 0 0 61 9" stroke="${POLSTER}" stroke-width="2.7" fill="none"/>
      <path d="M8 11.6 Q32 15.6 56 11.6" stroke="${POLSTER_HELL}" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".9"/></svg>`;
// Größe in der Szene: Breite in Pika-Breiten (auf schmalen Karten, wo die Wiese nicht reicht, etwas kleiner)
const TRAMP_W = 1.2;

const A2_TRAMP = {
  key: 'tramp', name: 'Trampolin', say: 'ein Trampolin!', built: true, mo: null,
  icon: ICON,
  trick: 'Salto', gilt: 'ein goldenes %', use: 'Hüpf, hüpf, immer höher!', gold: 'Sternchen beim höchsten Sprung',
  find: { t: 'Trampolin', h: 'Tipp mein Trampolin an, wenn es draußen steht. Das Tuch federt nach.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]
  dbg: [['Trampolin springen', 'a2TrampPlay', 1], ['Salto', 'a2TrampFlip', 2], ['Sternchen (golden)', 'a2TrampPlay', 3]],
};

export { A2_TRAMP, TRAMP_VB, TRAMP_FOOT, TRAMP_MAT, trampMat, TRAMP_BACK, TRAMP_FRONT, TRAMP_W };
