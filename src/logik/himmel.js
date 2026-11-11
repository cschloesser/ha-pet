// Himmel: Sonnenzeiten, Mondstand und Mondphase, Ort am Himmel, Takt von Sternschnuppen und Glühwürmchen

import { clamp } from './hilfen.js';

// Sonnenauf- und -untergang (ms) am Kalendertag day (Ortszeit) nach der Sonnenaufgangsgleichung, auf ~1 Min
// genau; elev: Höhe des Orts in m. Polartag/-nacht → null. Für die Häufchen der Vortage, sun.sun kennt nur das Nächste.
const sunTimes = (day, lat, lng, elev = 0) => {
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
  const j = Math.round(noon / 864e5 + 2440587.5 - 2451545 + lng / 360) - lng / 360;
  const M = (357.5291 + 0.98560028 * j) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + C + 282.9372) % 360;
  const transit = 2451545 + j + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const dec = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));
  const h0 = (-0.833 - (2.076 * Math.sqrt(Math.max(0, elev))) / 60) * RAD;
  const cw = (Math.sin(h0) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec));
  if (!(Math.abs(cw) <= 1)) return null;
  const w = Math.acos(cw) / RAD / 360;
  const ms = (jd) => (jd - 2440587.5) * 864e5;
  return { rise: ms(transit - w), set: ms(transit + w) };
};

// ---------- Himmel ----------

// Mondstand nach den vereinfachten Formeln aus "Astronomical Algorithms" (Meeus), auf ~1° genau.
const RAD = Math.PI / 180;
const moonPosition = (date, lat, lng) => {
  const d = date / 864e5 - 0.5 + 2440588 - 2451545;
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const e = RAD * 23.4397;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - ra;
  const phi = RAD * lat;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, az: az / RAD + 180 }; // Azimut ab Norden
};
// 0 = Neumond, 0.5 = Vollmond (Bezug: Neumond 6. 1. 2000 18:14 UTC)
const moonPhase = (date) => {
  const p = ((date - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
};
// Beleuchteter Teil der Mondscheibe (Nordhalbkugel: zunehmend rechts hell), viewBox 0 0 100 100.
// mirror: Blick nach Norden (Südhalbkugel), dort ist der zunehmende Mond links hell (Bogen gespiegelt).
const moonPath = (p, mirror = false) => {
  const rx = Math.abs(Math.cos(2 * Math.PI * p)) * 50;
  const waxing = p < 0.5;
  let outer = waxing ? 1 : 0;
  let term = waxing ? (p < 0.25 ? 0 : 1) : p > 0.75 ? 1 : 0;
  if (mirror) [outer, term] = [1 - outer, 1 - term];
  return `M50 0 A50 50 0 0 ${outer} 50 100 A${rx.toFixed(2)} 50 0 0 ${term} 50 0Z`;
};
// Position am Bildhimmel in %: Höhe 0° am Hügelrand. Blick nach Süden (Nordhalbkugel): Azimut 90° (Ost) links,
// 270° (West) rechts. Blick nach Norden (viewN, Südhalbkugel): Ost rechts, West links. Was hinter dem
// Betrachter steht, bleibt am näheren Rand.
// ridge (Areal alpin): Die Berge reichen weit in den Himmel, auf 50° Nord stünde die Mittagssonne von Ende November
// bis Mitte Januar ganz hinter dem Grat. Dort steigt sie in den ersten 8° über den Grat (bis 26 % von oben), darüber
// gestaucht weiter bis zum selben Scheitel. Sie geht also früh hinter den Bergen unter und bleibt im Winter zu sehen.
const skyPos = (az, alt, viewN = false, ridge = false) => {
  const d = ((((az - (viewN ? 0 : 180)) % 360) + 540) % 360) - 180; // −180…180 um die Blickrichtung
  const a = clamp(alt, -12, 62);
  const up = ridge && a > 0 ? (a <= 8 ? a * 3.75 : 30 + ((a - 8) * 17) / 54) : (a / 62) * 47;
  return {
    x: clamp((d + 90) / 180, 0.04, 0.96) * 100,
    y: 56 - up,
  };
};
// Städte, wie sie Flightradar24 liefert (englisch), auf Deutsch
// ==================== Himmel-Extras (Sternschnuppen, Glühwürmchen): Konstanten und Stil ====================
// Sternschnuppen: alle 1,5–5 Minuten eine Gelegenheit, jede fünfte ein Bolide, jede zehnte mit Nachzügler.
// Glühwürmchen: 10–14 Stück, gut die Hälfte tief über der Wiese, ein Drittel um den Heuhaufen.
const SKY = { meteor: [90000, 300000], bolide: 0.2, twin: 0.1, watch: 0.5, watchMs: 4000, ff: [10, 14] };

export { sunTimes, RAD, moonPosition, moonPhase, moonPath, skyPos, SKY };
