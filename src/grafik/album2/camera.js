// Album 2: Kamera (t2 = 3). Daten, Bild fürs Album (24 × 24), die Sofortbildkamera auf ihrem Stativ in der Szene, die
// Kamera am Riemen im Maul und das Sofortbild mit seiner winzigen Zeichnung (Blume, Vogel, Himmel, Selfie). Felder
// siehe src/grafik/album2.js; die Szene: src/karte/album2-camera.js, der Stil: src/stil/album2-camera.js. Ganzjährig.

import { OUT } from '../pika.js';
import { FLOWER_SVG } from '../szene.js';
import { BIRD_SVG } from '../besucher.js';

// Farben: ein helles Türkis wie die Halstücher der Freunde, oben dunkler; Knopf im Rot des Windrads
const BODY = '#6fb6c8';
const BODY_DUNKEL = '#4f93a6';
const BAND = '#f6efe0';
const LINSE = '#3a3f47';
const GLAS = '#8fd0f0';
const GLAS_HELL = '#e6f7ff';
const BLITZ = '#fff6d8';
const KNOPF = '#e8584e';
const BEIN = '#6b6f78';

// Fürs Album: von vorn, mit großer Linse, Blitz, Sucher und einem Bild, das oben herausschaut
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7.4" y="1.6" width="6.4" height="7" rx=".5" fill="#fbfaf6" stroke="${OUT}" stroke-width=".6"/>
      <rect x="8.2" y="2.4" width="4.8" height="4" fill="#a8daf5"/>
      <path d="M8.2 5.6 Q10.6 4.6 13 5.4 V6.4 H8.2Z" fill="#7cc35a"/>
      <rect x="2.4" y="7" width="19.2" height="13.4" rx="2.6" fill="${BODY}" stroke="${OUT}" stroke-width=".9"/>
      <path d="M2.85 10.6 V9.4 Q2.85 7.45 4.8 7.45 H19.2 Q21.15 7.45 21.15 9.4 V10.6Z" fill="${BODY_DUNKEL}"/>
      <rect x="2.85" y="16.2" width="18.3" height="1.4" fill="${BAND}"/>
      <rect x="16.6" y="5.6" width="3" height="1.6" rx=".6" fill="${KNOPF}" stroke="${OUT}" stroke-width=".6"/>
      <rect x="4.3" y="8.3" width="4.6" height="2.1" rx=".6" fill="${BLITZ}" stroke="${OUT}" stroke-width=".6"/>
      <rect x="15.4" y="8.3" width="3.6" height="2.1" rx=".6" fill="#2f3440"/>
      <circle cx="12" cy="14" r="4.6" fill="${LINSE}" stroke="${OUT}" stroke-width=".9"/>
      <circle cx="12" cy="14" r="3" fill="${GLAS}"/>
      <circle cx="10.9" cy="12.9" r="1" fill="${GLAS_HELL}"/></svg>`;

// Die Kamera auf dem Stativ, von der Seite, Linse nach rechts (die Szene spiegelt .a2cmf für links): viewBox 40 × 40,
// Füße des Stativs bei y 39,4 (stehen im Gras). .a2cmh: der Kopf, er neigt sich um den Stativkopf (18, 22) zum Motiv
// (--a2cmt). Oben von hinten nach vorn: Sucher (x 6,6–11,6), der Schlitz fürs Bild (12,6–22,6, y 7), Auslöser, Blitz
// (.a2cmfw, 23,4–29,4); vorn die Linse, daneben das Lämpchen des Selbstauslösers (.a2cmt).
const CAMERA_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
      <g class="a2cmleg">
        <path d="M18 23 L19.6 39.2" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M18 23 L19.6 39.2" stroke="#55595f" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M18 23 L9.4 39.4 M18 23 L27.2 39.4" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M18 23 L9.4 39.4 M18 23 L27.2 39.4" stroke="${BEIN}" stroke-width="1.4" stroke-linecap="round"/>
        <rect x="15.4" y="21.2" width="5.2" height="2.8" rx=".8" fill="#55595f" stroke="${OUT}" stroke-width=".8"/>
      </g>
      <g class="a2cmh">
        <rect x="6.6" y="3.6" width="5" height="4" rx=".8" fill="${BODY_DUNKEL}" stroke="${OUT}" stroke-width=".9"/>
        <rect x="5.6" y="4.4" width="1.4" height="2.4" rx=".4" fill="#2f3440"/>
        <rect class="a2cmb" x="18.6" y="5.4" width="3" height="1.9" rx=".5" fill="${KNOPF}" stroke="${OUT}" stroke-width=".7"/>
        <rect class="a2cmfw" x="23.4" y="3.4" width="6" height="4" rx=".8" fill="${BLITZ}" stroke="${OUT}" stroke-width=".9"/>
        <path d="M24.6 4.8 H28.2" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity=".9"/>
        <rect x="29.6" y="9.4" width="5.4" height="10" rx="1" fill="${LINSE}" stroke="${OUT}" stroke-width="1"/>
        <path d="M32.2 9.6 V19.2" stroke="#59606c" stroke-width="1"/>
        <ellipse cx="35.2" cy="14.4" rx="1.3" ry="4.1" fill="${GLAS}" stroke="${OUT}" stroke-width=".7"/>
        <ellipse cx="35.5" cy="12.8" rx=".45" ry="1.3" fill="${GLAS_HELL}"/>
        <rect x="6" y="7" width="24" height="14.6" rx="2.8" fill="${BODY}" stroke="${OUT}" stroke-width="1.1"/>
        <path d="M6.55 10.8 V9.8 Q6.55 7.55 8.8 7.55 H27.2 Q29.45 7.55 29.45 9.8 V10.8Z" fill="${BODY_DUNKEL}"/>
        <path d="M12.6 7.1 H22.6" stroke="#2f3440" stroke-width="1" stroke-linecap="round"/>
        <rect x="6.55" y="16.2" width="22.9" height="1.8" fill="${BAND}"/>
        <circle cx="11.4" cy="13.4" r="2.1" fill="${BODY_DUNKEL}" stroke="${OUT}" stroke-width=".6"/>
        <path d="M11.4 11.9 V12.9" stroke="${BAND}" stroke-width=".6" stroke-linecap="round"/>
        <circle class="a2cmt" cx="27.2" cy="12.6" r="1.1" stroke="${OUT}" stroke-width=".5"/>
      </g></svg>`;
// Maße in Anteilen des Bilds (Breite = Höhe): Schlitz oben (Mitte), Blitzfenster, Drehpunkt des Kopfs, Hinterkante,
// Spitze der Linse (alle in Einheiten der viewBox 40)
const CAM = { slot: [17.6, 7], flash: [26.4, 5.4], pivot: [18, 22], back: 6, tip: 36.5 };
// Breite in der Szene (in Pika-Breiten)
const CAM_W = 0.56;

// Im Maul (24 × 24, wie die Leckerli ohne id und class): am Riemen, Linse nach vorn. Vergrößert (die Gruppe): .mf-item
// zeigt das Feld nur zu 0,68, die Kamera soll neben dem Kopf noch als Kamera zu erkennen sein
const CAMERA_MOUTH = `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(-1 -2.6) scale(1.5)">
      <path d="M1.4 9.8 Q4.6 2.6 10.6 8.2" stroke="${OUT}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <path d="M1.4 9.8 Q4.6 2.6 10.6 8.2" stroke="#3a3f47" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <rect x="15.6" y="5.6" width="3.6" height="2.4" rx=".5" fill="${BLITZ}" stroke="${OUT}" stroke-width=".6"/>
      <rect x="19.8" y="9" width="3" height="5.6" rx=".7" fill="${LINSE}" stroke="${OUT}" stroke-width=".7"/>
      <ellipse cx="22.9" cy="11.8" rx=".7" ry="2.3" fill="${GLAS}"/>
      <rect x="6.6" y="7.6" width="13.4" height="9" rx="1.8" fill="${BODY}" stroke="${OUT}" stroke-width=".9"/>
      <path d="M7.05 10 V9.4 Q7.05 8.05 8.4 8.05 H18.2 Q19.55 8.05 19.55 9.4 V10Z" fill="${BODY_DUNKEL}"/>
      <rect x="7.05" y="13.4" width="12.5" height="1.2" fill="${BAND}"/></g></svg>`;

// ---------- Das Sofortbild ----------
// viewBox 20 × 24 (weißer Rahmen, unten breiter), das Bild selbst 16 × 16 bei (2, 2); alles darin bleibt in diesen
// Grenzen (ein Ausschnitt bräuchte eine id). Darunter dunkel: .a2cmpic blendet beim Entwickeln ein. .a2cmpw: zwei Pfoten an den Seiten, solange er es hält
// (Fell des Pikas, PIKA_SVG bleibt zu). Golden: Rahmen in Gold, Glitzer übers Bild (.a2cmgl).

// Himmel (S: { night, dusk, cover, bow, rain, snow, fog, snowcover }), Boden ab Höhe y, Wetter davor
const HIMMEL = { tag: '#a8daf5', grau: '#c9d3dc', abend: '#f6c39a', nacht: '#2d3866' };
const wolke = (x, y, s, f = '#fff') => `<path transform="translate(${x} ${y}) scale(${s})" d="M-2.6 .9 a1.3 1.3 0 0 1 .6 -2.3 a1.9 1.9 0 0 1 3.5 -.4 a1.4 1.4 0 0 1 1.6 2.7Z" fill="${f}"/>`;
const sky = (S) => {
  const bg = S.night ? HIMMEL.nacht : S.dusk ? HIMMEL.abend : S.cover >= 70 ? HIMMEL.grau : HIMMEL.tag;
  let h = `<rect width="16" height="16" fill="${bg}"/>`;
  if (S.night) {
    h += '<g fill="#fff"><circle cx="2.8" cy="2.6" r=".32"/><circle cx="6.4" cy="4.6" r=".26"/><circle cx="8.6" cy="1.8" r=".3"/><circle cx="14.2" cy="7" r=".26"/></g>';
    h += `<circle cx="11.8" cy="3.8" r="2" fill="#f6e7a8"/><circle cx="12.8" cy="3.1" r="1.7" fill="${bg}"/>`;
  } else {
    if (S.cover < 70) {
      h += '<path d="M12.4 .6 V1.2 M12.4 6 V6.6 M9.4 3.6 H10 M14.8 3.6 H15.4 M10.3 1.5 l.4 .4 M14.1 5.3 l.4 .4 M14.5 1.5 l-.4 .4 M10.7 5.3 l-.4 .4" stroke="#f0a02c" stroke-width=".45" stroke-linecap="round"/>';
      h += `<circle cx="12.4" cy="3.6" r="1.9" fill="${S.dusk ? '#f7a55a' : '#ffd75a'}" stroke="#f0a02c" stroke-width=".4"/>`;
    }
    if (S.cover >= 30) h += wolke(4.6, 4.4, 1.1, S.cover >= 70 ? '#eef1f4' : '#fff');
    if (S.cover >= 70) h += wolke(11, 6.4, 0.9, '#e2e7ec');
    if (S.bow) {
      h += '<g fill="none" stroke-width=".8" opacity=".85">' + ['#ef6b5b', '#f6c945', '#7cc35a', '#6aa8e8']
        .map((c, i) => `<path d="M${(1 + i * 0.8).toFixed(1)} 14 A${(7 - i * 0.8).toFixed(1)} ${(7 - i * 0.8).toFixed(1)} 0 0 1 ${(15 - i * 0.8).toFixed(1)} 14" stroke="${c}"/>`)
        .join('') + '</g>';
    }
  }
  return h;
};
const boden = (S, y) => {
  const g = S.snowcover ? ['#f2f5fa', '#dfe6ef'] : S.night ? ['#3f6a3a', '#355a31'] : ['#86c962', '#6bab4c'];
  return `<path d="M0 ${y} Q4 ${y - 2} 8.4 ${y - 0.8} T16 ${y - 1.2} V16 H0Z" fill="${g[1]}"/>`
    + `<path d="M0 ${y + 1.4} Q6 ${y} 16 ${y + 1} V16 H0Z" fill="${g[0]}"/>`;
};
const wetter = (S) => {
  let h = '';
  if (S.rain) h += '<g stroke="#5b8fc9" stroke-width=".4" stroke-linecap="round"><path d="M3 3 l-.5 1.4 M7.4 5.4 l-.5 1.4 M11.6 2.6 l-.5 1.4 M14 8 l-.5 1.4 M5 9.4 l-.5 1.4"/></g>';
  if (S.snow) h += '<g fill="#fff"><circle cx="2.6" cy="3.6" r=".42"/><circle cx="7" cy="6.2" r=".36"/><circle cx="11.2" cy="2.4" r=".4"/><circle cx="14.2" cy="8.6" r=".36"/><circle cx="4.4" cy="10" r=".4"/><circle cx="9.8" cy="9.4" r=".34"/></g>';
  if (S.fog) h += '<rect width="16" height="16" fill="#fff" opacity=".38"/>';
  return h;
};
// Kleine Figuren für das Selfie, von vorn: Pika (und Pino) rund mit runden Ohren, Kirby golden und flauschig, Rufus
// weiß mit Schlappohren, Katzumi orange mit Spitzohren und Streifen. Fuß bei (0, 0), etwa 8 Einheiten hoch.
const FIG = {
  pika: { fur: '#c09a76', ear: '#efe3d3', ein: '#e3a990', bel: '#f0e2cf', nose: '#7a4438' },
  pino: { fur: '#e09a5a', ear: '#f8e4cc', ein: '#f0a184', bel: '#fbe7cb', nose: '#7a4438', scarf: '#22b5a6' },
};
const augen = (y, dx = 1.25, r = 0.42) => `<circle cx="${-dx}" cy="${y}" r="${r}" fill="#2a1a12"/><circle cx="${dx}" cy="${y}" r="${r}" fill="#2a1a12"/>`;
const backen = (y, dx = 2.2) => `<circle cx="${-dx}" cy="${y}" r=".6" fill="#f2998c" opacity=".6"/><circle cx="${dx}" cy="${y}" r=".6" fill="#f2998c" opacity=".6"/>`;
const pikaFig = (c) => `
        <circle cx="-2.4" cy="-6.3" r="1.6" fill="${c.ear}" stroke="${OUT}" stroke-width=".4"/><circle cx="-2.4" cy="-6.3" r=".8" fill="${c.ein}"/>
        <circle cx="2.4" cy="-6.3" r="1.6" fill="${c.ear}" stroke="${OUT}" stroke-width=".4"/><circle cx="2.4" cy="-6.3" r=".8" fill="${c.ein}"/>
        <ellipse cy="-3.4" rx="3.8" ry="3.4" fill="${c.fur}" stroke="${OUT}" stroke-width=".45"/>
        <ellipse cy="-1.6" rx="2.3" ry="1.4" fill="${c.bel}"/>
        ${c.scarf ? `<path d="M-2.8 -1.3 Q0 .2 2.8 -1.3" stroke="${c.scarf}" stroke-width=".9" fill="none" stroke-linecap="round"/>` : ''}
        ${augen(-4.3)}${backen(-3.2)}
        <ellipse cy="-3.3" rx=".45" ry=".32" fill="${c.nose}"/>
        <path d="M-.6 -2.8 q.6 .5 1.2 0" stroke="${OUT}" stroke-width=".3" fill="none" stroke-linecap="round"/>`;
const FIGS = {
  pika: pikaFig(FIG.pika),
  pino: pikaFig(FIG.pino),
  kirby: `
        <circle cx="-2.9" cy="-6.6" r="1.3" fill="#e4bf85" stroke="${OUT}" stroke-width=".4"/><circle cx="2.9" cy="-6.6" r="1.3" fill="#e4bf85" stroke="${OUT}" stroke-width=".4"/>
        <circle cx="-2.9" cy="-6.6" r=".6" fill="#f2dcb4"/><circle cx="2.9" cy="-6.6" r=".6" fill="#f2dcb4"/>
        <circle cy="-3.8" r="3.9" fill="#e2b673" stroke="${OUT}" stroke-width=".45" stroke-dasharray=".9 .35"/>
        <ellipse cy="-2.8" rx="1.7" ry="1.2" fill="#e4cda7"/>
        ${augen(-4.7, 1.35)}<circle cy="-3.3" r=".5" fill="#3b2218"/>`,
  rufus: `
        <ellipse cy="-3.4" rx="3.4" ry="3.2" fill="#fffaf0" stroke="${OUT}" stroke-width=".45"/>
        <ellipse cx="-3.3" cy="-4" rx="1" ry="2" transform="rotate(18 -3.3 -4)" fill="#c9ad84" stroke="${OUT}" stroke-width=".35"/>
        <ellipse cx="3.3" cy="-4" rx="1" ry="2" transform="rotate(-18 3.3 -4)" fill="#c9ad84" stroke="${OUT}" stroke-width=".35"/>
        <ellipse cy="-2.4" rx="1.6" ry="1.1" fill="#f1e5cd"/>
        ${augen(-4.4, 1.2)}<ellipse cy="-2.9" rx=".7" ry=".5" fill="#b38f74"/>`,
  katzumi: `
        <path d="M-3.4 -4.2 L-2.8 -8 L-.9 -6 Z M3.4 -4.2 L2.8 -8 L.9 -6 Z" fill="#f6c08a" stroke="${OUT}" stroke-width=".4" stroke-linejoin="round"/>
        <path d="M-2.6 -5.4 L-2.5 -7 L-1.5 -6Z M2.6 -5.4 L2.5 -7 L1.5 -6Z" fill="#f2a6b4"/>
        <ellipse cy="-3.4" rx="3.6" ry="3.2" fill="#f6c08a" stroke="${OUT}" stroke-width=".45"/>
        <path d="M0 -6.5 V-5.4 M-1 -6.3 L-.8 -5.5 M1 -6.3 L.8 -5.5" stroke="#a9592b" stroke-width=".4" stroke-linecap="round"/>
        ${augen(-4, 1.3, 0.45)}<path d="M-.4 -3 h.8 l-.4 .45Z" fill="#e9919c"/>
        <path d="M-1.2 -2.6 L-3.6 -3 M-1.2 -2.2 L-3.6 -1.8 M1.2 -2.6 L3.6 -3 M1.2 -2.2 L3.6 -1.8" stroke="${OUT}" stroke-width=".2" opacity=".6"/>`,
};
const fig = (k, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${FIGS[k] || FIGS.pika}</g>`;
// Ein fertiges Bild (BIRD_SVG, FLOWER_SVG) als Gruppe bei (x, y) im Maßstab s. Kein inneres <svg>: Dem gäbe der Stil
// der Schätze (.gifts svg: Breite 100 %) die Breite des ganzen Sofortbilds.
const inner = (svg, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${svg.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '')}</g>`;
// Glitzer (golden): Sternchen in Bildkoordinaten (die Gruppe stellt sie hin, der Stil lässt den Stern funkeln)
const GLITZER = `<g class="a2cmgl" fill="#fff6c8" stroke="#e8b52a" stroke-width=".2">
          ${[[3.2, 3.4, 1], [13, 6, 0.8], [9.6, 12.6, 0.9], [6, 8, 0.6]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -1.7 L.4 -.4 L1.7 0 L.4 .4 L0 1.7 L-.4 .4 L-1.7 0 L-.4 -.4Z"/></g>`).join('')}
        </g>`;

// Das Bild zum Motiv M: { k: 'flower' | 'bird' | 'sky' | 'self', S (Himmel), color (Blume), bird (Farben aus BIRDS
// oder null: weggeflogen), who: [Freund] (Selfie) }
const PHOTO_PIC = (M) => {
  const S = M.S || {};
  if (M.k === 'flower') {
    return `${sky(S)}${boden(S, 12.4)}${wetter(S)}`
      + `<circle cx="13" cy="12.6" r=".7" fill="${M.color2 || '#f6c945'}"/><path d="M13 13.3 V14.6" stroke="#4f8a3a" stroke-width=".4"/>`
      + inner(FLOWER_SVG(M.color || '#f28fb1'), 3.6, 2.6, 0.4);
  }
  if (M.k === 'bird') {
    return `${sky(S)}${boden(S, 13.6)}`
      + '<path d="M-1 11.6 Q6 10.2 17 11.2" stroke="#8a5c30" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M12.6 10.8 q1.2 -1.6 2.8 -1.4" stroke="#8a5c30" stroke-width=".6" fill="none"/><ellipse cx="15" cy="9.2" rx="1" ry=".55" fill="#6bab4c"/>'
      + (M.bird ? inner(BIRD_SVG(M.bird), 3.2, 2.6, 0.32)
        : '<g stroke="#4a3a2c" stroke-width=".35" stroke-linecap="round" opacity=".7"><path d="M9 5.6 q1.6 -1 3.4 -.6 M8.6 7.4 q1.8 -.7 3.6 -.2"/></g>')
      + wetter(S);
  }
  if (M.k === 'self') {
    const W = M.who || [];
    const one = !W.length;
    let h = `${sky(S)}${boden(S, 11.4)}`;
    h += fig('pika', one ? 8 : 5.4, 15.3, 1);
    if (!one) h += fig(W[0].k, 11, 15.3, W[0].s);
    h += `<path transform="translate(${one ? 3.6 : 8.2} ${one ? 4 : 4.4}) scale(.9)" d="M0 1.6 C-2.2 0 -1.6 -1.6 0 -.7 C1.6 -1.6 2.2 0 0 1.6Z" fill="#f2607a"/>`;
    return h + wetter(S);
  }
  return `${sky(S)}${boden(S, 12.8)}${wetter(S)}`;
};
// Das ganze Sofortbild (gold: goldener Rahmen und Glitzer)
const PHOTO_SVG = (M, gold = false) => `<svg viewBox="0 0 20 24" aria-hidden="true">
      <g class="a2cmpw" fill="#ecdcc6" stroke="${OUT}" stroke-width=".7">
        <ellipse cx="-.4" cy="17.6" rx="2" ry="2.5"/><ellipse cx="20.4" cy="17.6" rx="2" ry="2.5"/>
      </g>
      <rect x=".35" y=".35" width="19.3" height="23.3" rx="1" fill="${gold ? '#f2c94c' : '#fbfaf6'}" stroke="${gold ? '#a8781e' : '#4a3a2c'}" stroke-width=".7"/>
      ${gold ? '<rect x="1.1" y="1.1" width="17.8" height="21.8" rx=".6" fill="none" stroke="#fff1b8" stroke-width=".4"/>' : ''}
      <rect x="2" y="2" width="16" height="16" fill="#3a3f47"/>
      <g transform="translate(2 2)"><g class="a2cmpic">${PHOTO_PIC(M)}${gold ? GLITZER : ''}</g></g>
      <rect x="2" y="2" width="16" height="16" fill="none" stroke="rgba(0,0,0,.18)" stroke-width=".3"/>
      <path d="M4.4 21 q1.6 -.9 3.2 0 t3.2 0 t3 -.2" stroke="${gold ? '#a8781e' : '#b9b0a0'}" stroke-width=".5" fill="none" stroke-linecap="round"/>
      ${gold ? '<path transform="translate(16 21) scale(.5)" d="M0 1.6 C-2.2 0 -1.6 -1.6 0 -.7 C1.6 -1.6 2.2 0 0 1.6Z" fill="#e8584e"/>' : ''}</svg>`;
// Größe des Bilds: aus dem Schlitz (Anteil der Kamerabreite), in den Pfoten (in Pika-Breiten); Höhe = 1,2 · Breite
const PHOTO_SLOT = 0.25;
const PHOTO_HELD = 0.27;

const A2_CAMERA = {
  key: 'camera', name: 'Kamera', say: 'eine Kamera!', built: true, mo: null,
  icon: ICON,
  trick: 'Selfie', gilt: 'eine goldene %', use: 'Klick, Blitz, und ein Sofortbild kommt heraus.', gold: 'goldener Rahmen, das Bild glitzert',
  find: { t: 'Kamera', h: 'Tipp meine Kamera an, wenn sie auf dem Stativ steht. Dann blitzt sie.' },
  // Vorschau (Leiste „Päckchen“, Album 2): [Knopf, Aktion, Stufe, die der Schatz dafür bekommt]. Die Knöpfe gehen auch
  // nachts und bei Regen (_forced); das Selfie nimmt den Freund mit, wenn er gerade da ist.
  dbg: [['Foto', 'a2CameraPlay', 1], ['Selfie', 'a2CameraSelfie', 2], ['Foto (golden)', 'a2CameraPlay', 3], ['Selfie (golden)', 'a2CameraSelfie', 3]],
};

export { A2_CAMERA, CAMERA_SVG, CAMERA_MOUTH, CAM, CAM_W, PHOTO_SVG, PHOTO_SLOT, PHOTO_HELD };
