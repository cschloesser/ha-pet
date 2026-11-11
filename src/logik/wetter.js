// Wetter: Blumenfarben, Wind, Lagen, Dämmerung, Jahreszeiten und Farben des Landes, Wetterverlauf, Schneedecke, Regenbogen

import { clamp } from './hilfen.js';

const FLOWER_COLORS = ['#f6c945', '#f28fb1', '#ffffff', '#b99cf0', '#ff9f5a'];
// Windrichtung in Grad: Zahl oder Kürzel wie "SW", "NNO" (deutsch O = Ost) → 0..360, sonst NaN
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const windDeg = (v) => {
  if (typeof v === 'number' || /^\s*-?\d+(\.\d+)?\s*$/.test(String(v ?? ''))) return Number(v);
  const i = COMPASS.indexOf(String(v ?? '').trim().toUpperCase().replace(/O/g, 'E'));
  return i < 0 ? NaN : i * 22.5;
};
// Zahl aus einem Attribut: null, fehlend, leer oder Unsinn → NaN (Number(null) und Number('') wären 0)
const numAttr = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
// Windgeschwindigkeit aus der Einheit der Wetter-Entität (wind_speed_unit) in km/h; unbekannt: schon km/h.
// Beaufort nach v = 0,836 · B^1,5 m/s.
const windKmh = (v, unit) => {
  const u = String(unit || 'km/h').trim().toLowerCase();
  if (u === 'm/s') return v * 3.6;
  if (u === 'mph') return v * 1.609344;
  if (u === 'kn' || u === 'kt' || u === 'knots') return v * 1.852;
  if (u === 'ft/s') return v * 1.09728;
  if (u === 'beaufort' || u === 'bft') return 0.836 * Math.max(0, v) ** 1.5 * 3.6;
  return v;
};

// Wetterlage → Bedeckung in %, Niederschlag (Tropfen, Flocken). min/max: in diesem Rahmen zählt bei trockener Lage
// die gemeldete Bedeckung (wxCover)
const WEATHER = {
  sunny: { cover: 5, max: 30 }, 'clear-night': { cover: 5, max: 30 }, partlycloudy: { cover: 45, min: 20, max: 65 },
  cloudy: { cover: 90, min: 70 }, fog: { cover: 80, fog: true }, windy: { cover: 35, wind: true, max: 65 },
  'windy-variant': { cover: 60, wind: true, min: 40 }, exceptional: { cover: 70 },
  rainy: { cover: 85, rain: 40 }, pouring: { cover: 95, rain: 95, storm: true },
  hail: { cover: 90, rain: 60, storm: true },
  lightning: { cover: 90, flash: true, storm: true },
  'lightning-rainy': { cover: 95, rain: 70, flash: true, storm: true },
  snowy: { cover: 90, snow: 55 }, 'snowy-rainy': { cover: 90, rain: 25, snow: 25 },
};
// So lange gilt das letzte Wetter weiter, wenn die Wetter-Entität unavailable/unknown ist
const WX_HOLD = 30 * 60000;
// Eine neue Meldung der Wetter-Entität, die beim ersten Sehen schon so alt ist, kam verspätet (Verbindung war weg):
// Dazwischen kann mehr geschehen sein, der Recorder weiß es (_wxHist)
const WX_LATE = 90000;
// Recorder nicht lesbar: nach so vielen Minuten noch einmal versuchen (danach immer mit dem letzten Abstand)
const WX_RETRY = [1, 5, 15, 30];

// ==================== Wetter mit Gewicht: reine Funktionen ====================
// Dämmerung, Jahreszeit, Schneedecke und Regenbogen hängen nur an dem, was alle Geräte gleich haben: Sonnenhöhe,
// Datum, Wetterlage und ihr Verlauf (Zeitstempel von HA, Recorder von HA). Nichts davon steht in den Helfern.

// Sanfte Stufe: 0 bei a, 1 bei b (auch rückwärts, a > b)
const ramp = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Dämmerung stufenlos aus der Sonnenhöhe e (Grad): d = Anteil Abendhimmel (beginnt bei 10°, ganz ab 2°),
// n = Anteil Nacht (beginnt bei −1°, ganz ab −9°). Himmel, Hügel und das Licht auf dem Land mischen danach.
const twilight = (e) => ({ d: ramp(10, 2, e), n: ramp(-1, -9, e) });

// Bedeckung in %: Bei trockener Lage zählt die gemeldete, aber nur im Rahmen der Lage. „Sonnig“ mit 80 %
// Schleierwolken bleibt ein blauer Himmel, „bewölkt“ mit 40 % bleibt grau.
const wxCover = (def, raw) => (Number.isFinite(raw) ? clamp(raw, def.min ?? 0, def.max ?? 100) : def.cover);
// Sichtbarkeit der Sterne: klar 0,85, mit der Bedeckung weniger, ab 80 % keine; hinter dichten Wolken (dense:
// Regen, Schnee, Nebel, Gewitter, ab 85 %) nie
const starOp = (cover, dense) => (dense ? 0 : 0.85 * clamp((80 - cover) / 60, 0, 1));

// Farben rechnen: '#rrggbb' ↔ [r, g, b]
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => `#${c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// wie filter: brightness(b) saturate(s), nur ausgerechnet (vgl. PK_DIM)
const dimRgb = (c, b, s) => {
  const d = c.map((v) => v * b);
  const L = 0.213 * d[0] + 0.715 * d[1] + 0.072 * d[2];
  return d.map((v) => clamp(L + (v - L) * s, 0, 255));
};

// Jahreslauf: Stelle 0…12, 0 = Mitte Januar, 4 = Mitte Mai, dazwischen gleitend (Ortszeit). Auf der Südhalbkugel
// (south) um ein halbes Jahr versetzt.
const seasonPos = (t, south = false) => {
  const d = new Date(t);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const p = d.getMonth() + (d.getDate() - 0.5) / days - 0.5 + (south ? 6 : 0);
  return ((p % 12) + 12) % 12;
};
// Jahreszeit für die Blumen: Frühling März bis Mai, Sommer, Herbst September bis November, Winter
const seasonKey = (t, south = false) => {
  const m = (new Date(t).getMonth() + (south ? 6 : 0)) % 12;
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
};
// Farben von Hügel und Wiese am Tag, je Monat (Mitte des Monats): ferner Hügel h1, Wiese h2, Halme h3, Kuppe des
// Erdhügels (mound) mit Rand (ms), Stiel und Blatt der Blumen. Mai und Juni sind die Farben, die bis 0.30 das ganze
// Jahr galten. Herbst gelbgrün, Winter kühl und matt, nie braun: Das Fell des Pikas ist sandbraun und soll sich
// abheben (Farbabstand ΔE zum Fell am Tag überall mindestens 25, bei bedecktem Himmel 21; bis 0.30 abends 25).
const SEASON_PAL = [
  ['#a3bd98', '#89a67d', '#7d9a72', '#94b089', '#6c8a5e', '#6f7f4a', '#8a9a5c'], // Januar
  ['#a3bf97', '#89a97b', '#7d9d70', '#94b388', '#6b8c5c', '#6a8047', '#869c5a'],
  ['#b0cf95', '#91bd74', '#85b168', '#9dc27d', '#6b944f', '#5a8a3f', '#78ab53'], // März
  ['#abd691', '#89c66d', '#7dbb61', '#97ca76', '#629247', '#50893a', '#6dab4d'],
  ['#a9d68f', '#86c46b', '#7ab960', '#94c873', '#5f8f45', '#4f8a3a', '#6bab4c'], // Mai
  ['#a9d68f', '#86c46b', '#7ab960', '#94c873', '#5f8f45', '#4f8a3a', '#6bab4c'],
  ['#a9d38b', '#86c067', '#7ab55c', '#94c46f', '#5f8c42', '#4f8738', '#6ba749'], // Juli
  ['#b0d088', '#90bc64', '#84b058', '#9cc06c', '#668a3f', '#558437', '#74a348'],
  ['#b5cd86', '#9ab863', '#8eac57', '#a5bd6b', '#70873d', '#62823a', '#84a04a'], // September
  ['#b9cb84', '#a3b863', '#97ac57', '#adbb6c', '#7b853d', '#73803c', '#949b49'],
  ['#b2c684', '#9bb267', '#8fa65b', '#a6b670', '#76833f', '#747e42', '#92994f'], // November
  ['#aac18e', '#92ac72', '#86a066', '#9cb27f', '#70864f', '#727f47', '#8e9a57'],
].map((row) => row.map(hexRgb));
const SEASON_KEYS = ['h1', 'h2', 'h3', 'mound', 'ms', 'stem', 'leaf'];
// Palette an der Stelle pos des Jahreslaufs (seasonPos), zwischen zwei Monaten gemischt → { h1: [r, g, b], … }
const seasonPal = (pos) => {
  const i = Math.floor(pos) % 12;
  const a = SEASON_PAL[i];
  const b = SEASON_PAL[(i + 1) % 12];
  return Object.fromEntries(SEASON_KEYS.map((k, j) => [k, mixRgb(a[j], b[j], pos - Math.floor(pos))]));
};
// Blumenfarben je Jahreszeit, immer fünf: Im Tagesplan stehen nur die Nummern (Vorrat, Blumengeschenk), jede Version
// und jede Jahreszeit malt sie in ihren Farben. Herbst: Goldrute, Heide, Aster; Winter: verblasste Samenstände.
const FLOWER_SEASON = {
  autumn: ['#e3b23c', '#c9739a', '#f1e7cf', '#9a7fd1', '#d9743a'],
  winter: ['#d9c38d', '#c08a8a', '#ece6d6', '#a99bb8', '#c98f5a'],
};
// Areal alpin (Enzian und Edelweiß): im Herbst ein blasserer später Enzian, im Winter verblasst
const FLOWER_SEASON_ALPIN = {
  autumn: ['#f1e7cf', '#6f7fd0', '#f1e7cf', '#e3b23c', '#9a7fd1'],
  winter: ['#ece6d6', '#8792b8', '#ece6d6', '#d9c38d', '#a99bb8'],
};
// Blütenmitte: bei gelben Blüten dunkler, sonst goldgelb (im Winter strohfarben)
const flowerMid = (c) => (['#f6c945', '#e3b23c'].includes(c) ? '#c47f1a' : ['#d9c38d', '#c08a8a', '#ece6d6', '#a99bb8', '#c98f5a', '#8792b8'].includes(c) ? '#a8824a' : '#f4b73a');

// Schnee auf Hügel, Wiese und Halmen bei Tag, Abend und Nacht (die Farben, die bis 0.30 bei „snowy“ galten)
const SNOW_PAL = {
  day: ['#e9eff3', '#dfe7ed', '#cfdbe3'], dusk: ['#b9bdd0', '#aeb4c8', '#a1a9bf'], night: ['#55627c', '#4c5974', '#44516b'],
  mound: '#e6edf2', ms: '#aab8c2',
};
for (const k of ['day', 'dusk', 'night']) SNOW_PAL[k] = SNOW_PAL[k].map(hexRgb);
// Berge im Areal alpin: Fels (m1) und Schneekappen (mcap) bei Tag, Abend und Nacht (die Farben, zwischen denen
// bis 0.30 umgeschaltet wurde)
const MTN_PAL = { m1: ['#8b9bb1', '#6c6f8f', '#222c45'].map(hexRgb), mcap: ['#f4f7fa', '#e6d3de', '#7d88a0'].map(hexRgb) };
SNOW_PAL.mound = hexRgb(SNOW_PAL.mound);
SNOW_PAL.ms = hexRgb(SNOW_PAL.ms);
// Himmel auf Höhe der Hügelkette: blau, abendrot, nachtblau; bei bedecktem Himmel grau
const SKY_HOR = Object.fromEntries(Object.entries({
  day: '#bfe2f5', dusk: '#d997b2', night: '#222f5d', gday: '#cdd5db', gdusk: '#a99ea9', gnight: '#283044',
  dtint: '#a090b0', ntint: '#143a42',
}).map(([k, v]) => [k, hexRgb(v)]));
// Farben der Landschaft im Licht des Augenblicks. P: Palette der Jahreszeit (seasonPal); d, n: Dämmerung (twilight);
// grey: bedeckt, storm: Gewitter oder Starkregen (je 0 oder 1); snow: Schneedecke 0…1.
// → h0…h3 (Hügelkette im Dunst, Hügel, Wiese, Halme: fertig beleuchtet), m1/mcap (Berge, ebenso), mound/moundS (Kuppe und Rand bei Tag, das
// Licht kommt dort vom Filter der Ebene), lb/ls (Helligkeit und Sättigung für alles, was auf dem Land steht),
// lbp (dasselbe für Requisiten, die nachts etwas heller bleiben).
// Abend und Nacht der Wiese sind aus der Tagesfarbe gerechnet und treffen die Farben, die bis 0.30 von Hand gesetzt waren.
const landColors = (P, { d = 0, n = 0, grey = 0, storm = 0, snow = 0 } = {}) => {
  const lit = (c) => mixRgb(
    mixRgb(c, mixRgb(dimRgb(c, 0.8, 0.7), SKY_HOR.dtint, 0.08), d),
    mixRgb(dimRgb(c, 0.38, 0.55), SKY_HOR.ntint, 0.5), n);
  const white = (i) => mixRgb(mixRgb(SNOW_PAL.day[i], SNOW_PAL.dusk[i], d), SNOW_PAL.night[i], n);
  // Wolkendecke nimmt nur dem Tag Licht (abends und nachts ist es ohnehin dunkel), Gewitter auch der Dämmerung
  const gb = 1 - 0.1 * grey * (1 - d) * (1 - n) - 0.22 * storm * (1 - n);
  const gs = 1 - 0.2 * grey * (1 - d) * (1 - n) - 0.15 * storm * (1 - n);
  const h = ['h1', 'h2', 'h3'].map((k, i) => dimRgb(mixRgb(lit(P[k]), white(i), snow), gb, gs));
  let sky = mixRgb(mixRgb(SKY_HOR.day, SKY_HOR.dusk, d), SKY_HOR.night, n);
  if (grey || storm) sky = mixRgb(sky, mixRgb(mixRgb(SKY_HOR.gday, SKY_HOR.gdusk, d), SKY_HOR.gnight, n), 0.9);
  const lb = (1 - 0.15 * d - 0.35 * n) * gb;
  // Berge: Dämmerung und Nacht aus ihren drei Farben gemischt, Wolkendecke und Gewitter wie beim Land
  const far = (c) => rgbHex(dimRgb(mixRgb(mixRgb(c[0], c[1], d), c[2], n), gb, gs));
  return {
    h0: rgbHex(mixRgb(h[0], sky, 0.5)), h1: rgbHex(h[0]), h2: rgbHex(h[1]), h3: rgbHex(h[2]),
    m1: far(MTN_PAL.m1), mcap: far(MTN_PAL.mcap),
    mound: rgbHex(mixRgb(P.mound, SNOW_PAL.mound, snow)), moundS: rgbHex(mixRgb(P.ms, SNOW_PAL.ms, snow)),
    lb, ls: (1 - 0.15 * d - 0.25 * n) * gs, lbp: lb + 0.05 * n,
  };
};

// Temperatur in °C aus den Attributen einer Wetter-Entität; NaN: unbekannt
const wxTemp = (a) => {
  const T = numAttr(a?.temperature);
  return a?.temperature_unit === '°F' ? (T - 32) / 1.8 : T;
};

// Verlauf der Wetterlage: Stützpunkte [{ t, c, T }] aufsteigend. Ein Stützpunkt ist eine Meldung der Wetter-Entität,
// bei der sich die Lage c oder die Temperatur T (auf ganze °C gerundet, null: unbekannt) geändert hat; t ist ihr
// Zeitstempel von HA (last_updated, auf ganze Sekunden: so stempeln Recorder und Verbindung gleich). Zwischen zwei
// Stützpunkten gelten Lage und Temperatur des ersten. Die Reihe ist damit nur eine Kurzschrift der Meldungen: Ein
// Gerät, das mitschreibt, und eines, das sie später aus dem Recorder liest, kommen auf dieselbe.
// Meldungen ohne neue Lage und ohne neue Temperatur fallen weg; bei gleichem Zeitstempel gilt die spätere (rows
// vor log). „unavailable“ und „unknown“ sind ein Aussetzer (WX_GAP): Dauert er kürzer als WX_HOLD, ist er
// vergessen, sobald die nächste Meldung da ist (in der Zeit galt das letzte Wetter weiter), sonst bleibt er als
// Abschnitt ohne Wetter stehen. Älteres als WX_KEEP fällt heraus (bis auf den Stand, der an dieser Grenze galt).
const WX_KEEP = 72 * 36e5;
const WX_GAP = 'unavailable';
const wxLogAdd = (log, rows, now) => {
  const all = [...(log || []), ...(rows || [])]
    .filter((r) => r && Number.isFinite(r.t) && typeof r.c === 'string' && r.t <= now + 60000)
    .map((r) => {
      const gap = r.c === 'unavailable' || r.c === 'unknown';
      return { t: Math.floor(r.t / 1000) * 1000, c: gap ? WX_GAP : r.c, T: !gap && Number.isFinite(r.T) ? Math.round(r.T) + 0 : null };
    })
    .sort((a, b) => a.t - b.t);
  const out = [];
  for (let k = 0; k < all.length; k++) {
    const r = all[k];
    if (all[k + 1]?.t === r.t) continue;
    let p = out[out.length - 1];
    if (p && p.c === WX_GAP && r.c !== WX_GAP && r.t - p.t < WX_HOLD) {
      out.pop();
      p = out[out.length - 1];
    }
    if (p && p.c === r.c && (r.T == null || r.T === p.T)) continue;
    out.push(r);
  }
  let i = 0;
  while (i < out.length - 1 && out[i + 1].t <= now - WX_KEEP) i++;
  return out.slice(i);
};
// Zeilen des Recorders (history/history_during_period) → Meldungen { t, c, T } für wxLogAdd. HA liefert
// [{ s: Lage, a: Attribute, lu: Sekunden }], ältere Versionen { state, attributes, last_updated }.
const wxRows = (list) => (Array.isArray(list) ? list : []).filter((r) => r && typeof r === 'object').map((r) => {
  const s = numAttr(r.lu ?? r.lc);
  return { t: Number.isFinite(s) ? s * 1000 : Date.parse(r.last_updated || r.last_changed), c: r.s ?? r.state, T: wxTemp(r.a || r.attributes) };
});
// Mitschrift des Geräts (own) und Verlauf aus dem Recorder (rec, Meldungen aus wxRows) zusammenführen: Bis zu
// seiner letzten Zeile gilt allein der Recorder, von der Mitschrift nur, was danach kam. So steht ein eben geladenes
// Gerät (dessen erster Eintrag nur vorläufig ist: die Lage seit last_changed mit der Temperatur von jetzt) nach dem
// Abruf da wie eines, das die ganze Zeit mitgeschrieben hat. Liefert der Recorder nichts, bleibt die Mitschrift.
const wxLogMerge = (own, rec, now) => {
  const base = wxLogAdd([], rec, now);
  if (!base.length) return wxLogAdd(own, [], now);
  const end = base[base.length - 1].t;
  return wxLogAdd(base, (own || []).filter((r) => r && r.t > end), now);
};

// Schneedecke: So lange braucht Schneefall bis zur geschlossenen Decke; ab show liegt sichtbar Schnee (Blumen
// verschwinden, der Stein hat eine Haube, der Pika verhält sich wie bei Schnee)
const SNOW = { full: 10 * 60000, show: 0.4 };
const WX_RAIN = new Set(['rainy', 'pouring', 'lightning-rainy', 'hail', 'snowy-rainy']);
// So viele Stunden hält eine geschlossene Decke bei T °C: 24 bei 0°, je 2° wärmer halb so lang (mindestens 1,5),
// bei Frost bis 72. Regen taut viermal, Sonne anderthalbmal so schnell. Ohne Temperatur: wie bei 2°.
const snowHours = (T, cond) => {
  const h = clamp(24 * 2 ** (-(Number.isFinite(T) ? T : 2) / 2), 1.5, 72);
  return WX_RAIN.has(cond) ? h / 4 : cond === 'sunny' ? h / 1.5 : h;
};
// Schneit es in diesem Abschnitt? „snowy“ immer, Schneeregen nur bei Frost.
const wxSnows = (r) => r.c === 'snowy' || (r.c === 'snowy-rainy' && r.T != null && r.T <= 0);
// Schneedecke 0…1 jetzt, aus dem Verlauf der Wetterlage. Abschnitt für Abschnitt: Schneit es, wächst sie in
// SNOW.full zu, sonst taut der Anteil Dauer / Haltedauer bei der Temperatur dieses Abschnitts (snowHours). Was
// getaut ist, bleibt getaut: Der laufende Abschnitt rechnet mit seinem Stützpunkt, nie rückwirkend mit der
// Temperatur von jetzt. Ohne neuen Schneefall nimmt die Decke also nie zu, auch wenn es abends abkühlt.
// Aussetzer der Wetter-Entität: Nach Schneefall gilt der noch WX_HOLD lang weiter (so zeigt ihn die Karte), dann
// taut es ab dem Aussetzer wie bei unbekannter Temperatur; sonst taut es weiter wie im Abschnitt davor.
const snowDepth = (log, now) => {
  let d = 0;
  for (let i = 0; i < log.length; i++) {
    let a = log[i];
    const b = log[i + 1];
    const dur = Math.min(b ? b.t : now, now) - a.t;
    if (!(dur > 0)) continue;
    const p = log[i - 1];
    if (a.c === WX_GAP && p && (!wxSnows(p) || (!b && dur < WX_HOLD))) a = p;
    d = wxSnows(a) ? Math.min(1, d + dur / SNOW.full) : Math.max(0, d - dur / (snowHours(a.T, a.c) * 36e5));
  }
  return d;
};

// Welches Programm der kleinen Beschäftigungen galt zur Zeit t (wie miniProg: 'dry', 'rain', 'snow', 'none')? Aus
// dem Wetterverlauf: der Stützpunkt, der bei t galt, und die Schneedecke bis dahin. null: unbekannt (kein Verlauf,
// Aussetzer der Wetter-Entität). '?': Der Verlauf beginnt erst nach t (frisch geladen, der Recorder hat noch nicht
// geantwortet: Der erste Stützpunkt ist dann der Beginn der Lage von jetzt), es galt also eine andere Lage, nur
// welche, ist offen. Niesel unter rain_min kennt der Verlauf nicht: Er zählt hier als Regen.
const wxProgThen = (log, t) => {
  const cut = (log || []).filter((r) => r.t <= t);
  const r = cut[cut.length - 1];
  if (!r) return log?.length ? '?' : null;
  if (r.c === WX_GAP) return null;
  const def = WEATHER[r.c] || {};
  if (def.storm) return 'none';
  const snow = wxSnows(r) || Math.round(snowDepth(cut, t) * 20) / 20 >= SNOW.show;
  return def.rain > 0 ? (snow ? 'none' : 'rain') : snow ? 'snow' : 'dry';
};

// Regenbogen 0…1: nach einem Schauer (die Lage wechselt von Regen auf heiter; der Regen dauerte mindestens drei
// Minuten), solange die Sonne scheint und tief genug steht (über 40° läge der Bogen unter dem Horizont). Er steht
// 20 Minuten, kommt in anderthalb Minuten und geht in den letzten fünf. Gesucht wird rückwärts der letzte Wechsel
// von Schauer auf heiter, nach dem es heiter blieb: Wechselt die Lage danach zwischen sonnig und teils bewölkt
// (oder ändert sich nur die Temperatur), bleibt der Bogen stehen. Ein laufender Aussetzer in der Haltefrist
// zählt nicht, ein langer trennt Schauer und Sonne.
const WX_SHOWER = new Set(['rainy', 'pouring', 'lightning-rainy', 'hail']);
const WX_BRIGHT = new Set(['sunny', 'partlycloudy', 'windy', 'windy-variant']);
const BOW = { life: 20 * 60000, in: 90000, out: 5 * 60000, rain: 3 * 60000 };
const rainbow = (log, now, elev, cover = 0) => {
  let i = log.length - 1;
  if (i >= 0 && log[i].c === WX_GAP && now - log[i].t < WX_HOLD) i--;
  if (i < 1 || !WX_BRIGHT.has(log[i].c)) return 0;
  while (i > 0 && WX_BRIGHT.has(log[i - 1].c)) i--;
  let j = i - 1;
  if (j < 0 || !WX_SHOWER.has(log[j].c)) return 0;
  while (j > 0 && WX_SHOWER.has(log[j - 1].c)) j--;
  if (log[i].t - log[j].t < BOW.rain) return 0;
  const age = now - log[i].t;
  if (!(age >= 0 && age < BOW.life) || !(elev > 3 && elev < 40) || cover >= 70) return 0;
  return Math.min(ramp(0, BOW.in, age), ramp(BOW.life, BOW.life - BOW.out, age), ramp(3, 6, elev), ramp(40, 36, elev));
};

export {
  FLOWER_COLORS, windDeg, numAttr, windKmh, WEATHER, WX_HOLD, WX_LATE, WX_RETRY, twilight, wxCover, starOp, hexRgb,
  rgbHex, dimRgb, seasonPos, seasonKey, seasonPal, FLOWER_SEASON, FLOWER_SEASON_ALPIN, flowerMid, landColors, wxTemp,
  WX_KEEP, wxLogAdd, wxRows, wxLogMerge, SNOW, snowHours, snowDepth, wxProgThen, BOW, rainbow,
};
