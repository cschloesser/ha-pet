// Zustand: Abbau und Gewinne, Takt der Uhr von HA, Häufchen-Takt, Text im Helfer lesen, schreiben, zusammenführen

import { clamp } from './hilfen.js';

const RATE = { s: 5, g: 4 }; // Abnahme pro Stunde (satt, glücklich)
// Im Schlaf sinken satt und glücklich nur halb so schnell (Schlafenszeit wie überall aus sleep_start/sleep_end)
const SLEEP_DECAY = 0.5;
// Uhr von HA (_clockSample): so viele Meldungen zählen, ab so viel ms Unterschied wird nachgestellt
const CLOCK_KEEP = 12;
const CLOCK_STEP = 250;
const GAIN = { feed: 25, pet: 8, clean: 10 };
// Selbst gefressen (Wiesenblume, Heu): wenig und nur bis SELF_MAX. Jedes Gerät knabbert für sich und Blumen
// wachsen alle 2,5 Min nach, ohne Grenze wäre er immer satt. Über die Hälfte bringt ihn nur das Füttern.
const SELF = { flower: 3, hay: 2 };
const SELF_MAX = 50;
// live: so viele Minuten nach der Fälligkeit macht er es noch selbst vor den Augen, danach liegt es einfach da
const POOP = { every: 80, spread: 60, morning: [10, 20], max: 8, latrine: 3, idx: 24, fly: 4, live: 3 };

// Zustand im Text-Helfer: satt,zeit,glück,zeit,großputz,maske,teilputz (Zeiten in Sekunden).
// großputz = seitdem werden Häufchen gezählt, maske = einzeln weggemachte (Bit k = Häufchen k),
// teilputz = wann seit dem Großputz zum ersten Mal einzeln geputzt wurde (wird nur noch mitgeführt). Alte Werte mit 4 Feldern gelten ab dem letzten Kontakt als sauber.
const sec = (ms) => Math.floor(ms / 1000) * 1000;
const freshStats = (t = Date.now()) => {
  const now = sec(t);
  return { s: 80, st: now, g: 80, gt: now, c: now, m: 0, l: now };
};
const serialize = (st) =>
  [st.s.toFixed(1), Math.round(st.st / 1000), st.g.toFixed(1), Math.round(st.gt / 1000),
    Math.round(st.c / 1000), st.m, Math.round(st.l / 1000)].join(',');
const parseStats = (str) => {
  const p = String(str ?? '').split(',').map(Number);
  if ((p.length !== 4 && p.length !== 7) || p.some((n) => !Number.isFinite(n))) return null;
  const st = { s: p[0], st: p[1] * 1000, g: p[2], gt: p[3] * 1000 };
  if (p.length === 7) return { ...st, c: p[4] * 1000, m: p[5] >>> 0, l: p[6] * 1000 };
  const c = sec(Math.max(st.st, st.gt));
  return { ...st, c, m: 0, l: c };
};
// Fremden Stand (anderes Gerät) mit dem eigenen, noch nicht gesendeten zusammenführen. Grundlage ist der fremde,
// er ist der frischere. Satt/glücklich: die eigenen ungesendeten Gewinne (gain.s/g) kommen obendrauf – so geht
// weder fremdes noch eigenes Füttern/Streicheln verloren. Hat dieses Gerät geputzt (gain.c): der neuere Großputz
// gilt, beim selben zählen die Einzelputze beider Geräte (Maske ODER, Teilputz der spätere).
// decayH(t1, t2): Abbau-Stunden dazwischen (im Schlaf halb), ohne: gleichmäßig
const mergeStats = (own, other, gain, now, decayH = (t1, t2) => (t2 - t1) / 3.6e6) => {
  const out = { ...other };
  for (const k of ['s', 'g']) {
    if (!gain[k]) continue;
    const v = clamp(other[k] - decayH(other[k + 't'], now) * RATE[k], 0, 100);
    out[k] = clamp(v + gain[k], 0, 100);
    out[k + 't'] = now;
  }
  if (!gain.c) return out;
  if (own.c > other.c) Object.assign(out, { c: own.c, m: own.m, l: own.l });
  else if (own.c === other.c) Object.assign(out, { m: (own.m | other.m) >>> 0, l: Math.max(own.l, other.l) });
  return out;
};

export {
  RATE, SLEEP_DECAY, CLOCK_KEEP, CLOCK_STEP, GAIN, SELF, SELF_MAX, POOP, sec, freshStats, serialize, parseStats,
  mergeStats,
};
