// Album 2: Picknickdecke (t2 = 6). Daten, Bild fürs Album (24 × 24), die rot-weiß karierte Decke in der Szene, der
// kleine Weidenkorb darauf, das Bündel (Korb mit aufgerollter Decke), das er im Maul trägt und vorzeigt, und die Rolle,
// die beim Ausbreiten über die Wiese läuft. Felder siehe src/grafik/album2.js; die Szene: src/karte/album2-picnic.js,
// der Stil: src/stil/album2-picnic.js. Man bekommt sie von April bis September (Südhalbkugel versetzt, siehe
// giftPickTre).

import { OUT } from '../pika.js';

// Farben: Karos im Rot des Windrads, dazu ein warmes Weiß; der Korb in den Holztönen von Windrad und Hängematte
const ROT = '#e5534b';
const ROT_D = '#b83d37';
const WEISS = '#fbf5ec';
const WEISS_D = '#ddd1bf';
const KORB = '#d9a35e';
const KORB_D = '#b07a3c';
const DECKEL = '#c48a48';
const HENKEL = '#9a6a3c';

const f = (n) => Number(n.toFixed(2));
const lerp = (a, b, t) => a + (b - a) * t;
// Punkt (u quer, v von hinten nach vorn, je 0–1) im Viereck Q = [hinten links, hinten rechts, vorn links, vorn rechts]
const quadPt = (Q, u, v) => [lerp(lerp(Q[0][0], Q[1][0], u), lerp(Q[2][0], Q[3][0], u), v), lerp(lerp(Q[0][1], Q[1][1], u), lerp(Q[2][1], Q[3][1], u), v)];
// Karos im Viereck: nx Spalten, Zeilengrenzen V (von hinten nach vorn, vorn breiter: die Decke liegt flach im Gras),
// jedes zweite Feld in fill
const checks = (Q, nx, V, fill) => {
  let d = '';
  for (let j = 0; j < V.length - 1; j++) {
    for (let i = (j % 2); i < nx; i += 2) {
      const P = [[i / nx, V[j]], [(i + 1) / nx, V[j]], [(i + 1) / nx, V[j + 1]], [i / nx, V[j + 1]]].map(([u, v]) => quadPt(Q, u, v));
      d += `M${P.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}Z`;
    }
  }
  return `<path d="${d}" fill="${fill}"/>`;
};
// Die Kante vorn (die Dicke des Stoffs): Streifen unter der Vorderkante von Q, Stücke wie die Spalten, unter jedem
// roten Feld der vordersten Zeile (die beginnt bei Spalte r0) dunkelrot, sonst dunkelweiß
const hem = (Q, nx, h, r0) => {
  const [a, b] = [Q[2], Q[3]];
  let r = '';
  let w = '';
  for (let i = 0; i < nx; i++) {
    const x0 = f(lerp(a[0], b[0], i / nx));
    const x1 = f(lerp(a[0], b[0], (i + 1) / nx));
    const seg = `M${x0} ${a[1]} H${x1} V${f(a[1] + h)} H${x0}Z`;
    if (i % 2 === r0) r += seg;
    else w += seg;
  }
  return `<path d="${w}" fill="${WEISS_D}"/><path d="${r}" fill="${ROT_D}"/>`;
};
const quad = (Q) => `M${f(Q[0][0])} ${f(Q[0][1])} L${f(Q[1][0])} ${f(Q[1][1])} L${f(Q[3][0])} ${f(Q[3][1])} L${f(Q[2][0])} ${f(Q[2][1])}Z`;

// Die Decke als Ganzes (Viereck Q, nx Spalten, Zeilengrenzen V, Höhe der Kante h, Strichstärke sw)
const BLANKET_G = (Q, nx, V, h, sw) => `<path d="${quad(Q)}" fill="${WEISS}"/>
      ${checks(Q, nx, V, ROT)}
      ${hem(Q, nx, h, (V.length - 2) % 2)}
      <path d="M${f(Q[2][0])} ${f(Q[2][1])} H${f(Q[3][0])} V${f(Q[3][1] + h)} H${f(Q[2][0])}Z M${quad(Q).slice(1)}" fill="none" stroke="${OUT}" stroke-width="${sw}" stroke-linejoin="round"/>`;

// Fürs Album: ausgebreitet, schräg von vorn, hinten rechts der Korb
const ICON_Q = [[5, 11.6], [19, 11.6], [1.4, 20.2], [22.6, 20.2]];
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      ${BLANKET_G(ICON_Q, 6, [0, 0.3, 0.63, 1], 1.4, 0.8)}
      <path d="M13.4 9.4 Q16 3.4 18.6 9.4" stroke="${OUT}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <path d="M13.4 9.4 Q16 3.4 18.6 9.4" stroke="${HENKEL}" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M12.2 9.6 H19.8 L19 14.6 Q16 15.2 13 14.6Z" fill="${KORB}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M12.9 11.8 H19.2 M13.2 13.4 H18.8" stroke="${KORB_D}" stroke-width=".6" stroke-dasharray="1.1 .8"/>
      <rect x="11.8" y="8.8" width="8.4" height="1.6" rx=".7" fill="${DECKEL}" stroke="${OUT}" stroke-width=".7"/></svg>`;

// Die Decke in der Szene: viewBox 100 × 16. Hinterkante y 2 (x 9–91), Vorderkante y 12 (x 1–99), darunter die Kante
// des Stoffs bis 13,4 und ein Hauch Schatten. Breite setzt das Skript, die Höhe folgt (BLANKET_H). Die Vorderkante liegt
// knapp unter der Bodenlinie (davor wächst das Gras), er sitzt vorn darauf.
const BLANKET_Q = [[9, 2], [91, 2], [1, 12], [99, 12]];
const BLANKET_SVG = `<svg viewBox="0 0 100 16" aria-hidden="true">
      <path d="M3 13.8 Q50 15.2 97 13.8" stroke="#000" stroke-width="1.4" opacity=".12" fill="none" stroke-linecap="round"/>
      ${BLANKET_G(BLANKET_Q, 10, [0, 0.28, 0.61, 1], 1.4, 0.5)}
      <path d="M13 3.2 H87" stroke="#fff" stroke-width=".5" opacity=".5"/></svg>`;
// Höhe der Decke zur Breite (viewBox)
const BLANKET_H = 16 / 100;
// Von der Vorderkante bis zur Unterkante der viewBox (Anteil der Höhe): 4 von 16 Einheiten
const BLANKET_SINK = 4 / 16;

// Der Korb, von vorn: viewBox 24 × 24, steht mit dem Boden auf y 22,8. Oben Platz für den Deckel, der sich hebt
// (.a2pkl, Scharnier rechts bei 20,4/11,6: links hebt er sich, die Szene spiegelt den Korb, damit er sich zum Pika hin
// öffnet). Darunter die Serviette (.a2pkn), sichtbar nur bei offenem Deckel.
const BASKET_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.2 12 Q6.4 3.4 12 3.4 Q17.6 3.4 17.8 12" stroke="${OUT}" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <path d="M6.2 12 Q6.4 3.4 12 3.4 Q17.6 3.4 17.8 12" stroke="${HENKEL}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <g class="a2pkn"><path d="M6.4 12 L9.6 7.6 L13.4 12Z" fill="${WEISS}" stroke="${OUT}" stroke-width=".6" stroke-linejoin="round"/>
        <path d="M8 9.8 L9.6 7.6 L10.8 9.2 Z M9.2 12 L11.4 10.1 L12.4 12Z" fill="${ROT}"/></g>
      <path d="M3.6 12.4 H20.4 L18.9 22.4 Q12 23.4 5.1 22.4Z" fill="${KORB}" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M4.3 15.4 H19.7 M4.9 18.4 H19.1" stroke="${KORB_D}" stroke-width=".8" stroke-dasharray="1.8 1.2"/>
      <path d="M5.3 16.9 H18.8 M5.6 19.9 H18.4" stroke="${KORB_D}" stroke-width=".8" stroke-dasharray="1.8 1.2" stroke-dashoffset="1.5"/>
      <path d="M5.6 21.4 Q12 22.3 18.4 21.4" stroke="#e8c48a" stroke-width=".6" fill="none" opacity=".7"/>
      <g class="a2pkl">
        <path d="M3 12.6 Q3 10.4 5.2 10.4 H18.8 Q21 10.4 21 12.6Z" fill="${DECKEL}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M5.2 11.3 H18.6" stroke="#e0b47c" stroke-width=".6" stroke-linecap="round"/>
        <rect x="4.2" y="12.2" width="1.6" height="2.2" rx=".4" fill="${HENKEL}" stroke="${OUT}" stroke-width=".5"/></g></svg>`;
// Breite des Korbs in der Szene (Anteil von pW)
const BASKET_W = 0.3;

// Das Bündel: der Korb, obendrauf die aufgerollte Decke, der Henkel hält sie fest (24 × 24, ohne id und class, Boden
// bei 22,8). Er trägt es am Henkel im Maul (BUNDLE_CARRY) und zeigt es vor, wenn kein Picknickwetter ist.
const ROLL_G = (x, y, w, h) => {
  const r = h / 2;
  let s = '';
  for (let i = 1; i < 6; i += 2) s += `M${f(x + r + ((w - 2 * r) * i) / 6)} ${f(y + 0.3)} v${f(h - 0.6)} h${f((w - 2 * r) / 6)} v${f(-(h - 0.6))}Z`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${f(r)}" fill="${WEISS}" stroke="${OUT}" stroke-width=".8"/>
      <path d="${s}" fill="${ROT}"/>
      <circle cx="${f(x + w - r)}" cy="${f(y + r)}" r="${f(r * 0.86)}" fill="${WEISS_D}" stroke="${OUT}" stroke-width=".6"/>
      <path d="M${f(x + w - r)} ${f(y + r)} m-.5 0 a.6 .6 0 1 1 .9 .5 a1.2 1.2 0 1 1 -1.6 -1.4" stroke="${ROT_D}" stroke-width=".6" fill="none"/>`;
};
const BUNDLE_G = `<path d="M3.6 12.4 H20.4 L18.9 22.4 Q12 23.4 5.1 22.4Z" fill="${KORB}" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M4.3 15.4 H19.7 M4.9 18.4 H19.1" stroke="${KORB_D}" stroke-width=".8" stroke-dasharray="1.8 1.2"/>
      <path d="M5.3 16.9 H18.8 M5.6 19.9 H18.4" stroke="${KORB_D}" stroke-width=".8" stroke-dasharray="1.8 1.2" stroke-dashoffset="1.5"/>
      <path d="M3 12.6 Q3 10.4 5.2 10.4 H18.8 Q21 10.4 21 12.6Z" fill="${DECKEL}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
      ${ROLL_G(2.2, 5.8, 19.6, 4.8)}
      <path d="M6.2 12 Q6.4 1.6 12 1.6 Q17.6 1.6 17.8 12" stroke="${OUT}" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <path d="M6.2 12 Q6.4 1.6 12 1.6 Q17.6 1.6 17.8 12" stroke="${HENKEL}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
const BUNDLE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">${BUNDLE_G}</svg>`;
// Im Maul: am Henkel (Scheitel bei 12/1,6 ans Maul). Maßstab: Pika-Grafik 120 Einheiten breit = pW, das Futter im Maul
// ist um 0,68 verkleinert; das Bündel soll etwas kleiner als der Korb auf der Decke sein (0,85 von BASKET_W)
const CARRY_S = (BASKET_W * 0.85 * 120) / (0.68 * 24);
const BUNDLE_CARRY = `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(${f(3 - 12 * CARRY_S)} ${f(-0.6 - 1.6 * CARRY_S)}) scale(${f(CARRY_S)})">${BUNDLE_G}</g></svg>`;
// Breite des Bündels am Boden (Anteil von pW)
const BUNDLE_W = 0.34;

// Die Rolle, die beim Ausbreiten und Aufrollen an der Kante entlangläuft (viewBox 12 × 12, Mitte unten auf dem Boden)
const ROLL_SVG = `<svg viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6.4" r="5" fill="${WEISS}" stroke="${OUT}" stroke-width=".8"/>
      <path d="M6 1.4 A5 5 0 0 1 11 6.4 H8.4 A2.4 2.4 0 0 0 6 4Z M6 11.4 A5 5 0 0 1 1 6.4 H3.6 A2.4 2.4 0 0 0 6 8.8Z" fill="${ROT}"/>
      <path d="M6 6.4 m-.6 0 a.7 .7 0 1 1 1 .6 a1.6 1.6 0 1 1 -2.2 -1.8 a2.6 2.6 0 1 1 1.2 4.4" stroke="${ROT_D}" stroke-width=".6" fill="none"/></svg>`;

// Krümel, die beim Antippen aus dem Korb springen (viewBox 4 × 4)
const CRUMB_SVG = `<svg viewBox="0 0 4 4" aria-hidden="true"><path d="M.8 2.4 L1.6 .8 L3.2 1.2 L3.2 2.8 L1.8 3.3Z" fill="#e8c48a" stroke="#b07a3c" stroke-width=".45" stroke-linejoin="round"/></svg>`;

const A2_PICNIC = {
  key: 'picnic', name: 'Picknickdecke', say: 'eine Picknickdecke!', built: true, mo: [3, 4, 5, 6, 7, 8],
  icon: ICON,
  trick: 'Teilen', gilt: 'eine goldene %', use: 'Für ein Picknick in der Sonne, gern zu zweit.', gold: 'Schmetterlinge kommen zur Decke',
  find: { t: 'Picknickkorb', h: 'Mach ich Picknick, tipp den Korb auf meiner Decke an. Der Deckel hebt sich, und Krümel hüpfen heraus.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]. Die Knöpfe gehen bei
  // jedem Wetter (_forced); ist ein Freund da, kommt er mit auf die Decke, sitzt ein Vogel oder schaut die Maus heraus,
  // bekommt beim Teilen der das Stück.
  dbg: [['Picknick', 'a2PicnicPlay', 1], ['Teilen', 'a2PicnicShare', 2], ['Schmetterlinge (golden)', 'a2PicnicPlay', 3], ['Teilen (golden)', 'a2PicnicShare', 3]],
};

export { A2_PICNIC, BLANKET_SVG, BLANKET_H, BLANKET_SINK, BASKET_SVG, BASKET_W, BUNDLE_SVG, BUNDLE_CARRY, BUNDLE_W, ROLL_SVG, CRUMB_SVG };
