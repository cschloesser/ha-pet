// Hilfen: Abbruch-Fehler, Bewegung reduzieren, Zufall (frei und fest), Rechnen, Zeitangaben, Text entschärfen, Größeneinheit und freie Plätze der Szene

class Cancel extends Error {}
// Systemeinstellung „Bewegung reduzieren“; .matches folgt einer Änderung von selbst
const RED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const calmMotion = () => !!RED_MOTION?.matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Eigener Schlüssel einer Tabelle? Namen aus dem Helfer kann jeder von Hand hineinschreiben: "constructor" oder
// "toString" fände tabelle[name] sonst auch (und die Schleife liefe damit immer wieder in denselben Fehler).
const hasKey = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const weighted = (list) => {
  const total = list.reduce((t, [w]) => t + w, 0);
  let r = Math.random() * total;
  for (const [w, v] of list) if ((r -= w) < 0) return v;
  return list[list.length - 1][1];
};
// "21:00" (auch "21:00:00") → Minuten nach Mitternacht. Eine reine Zahl gilt schon als Minuten: YAML ohne
// Anführungszeichen macht aus 21:00 die Zahl 1260 (sexagesimal). Alles andere → null (dann gilt der Standard).
const minutes = (hhmm) => {
  const s = String(hhmm ?? '').trim();
  if (/^\d+$/.test(s)) return Number(s) < 1440 ? Number(s) : null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
// Fester Zufall: gleiche Zahlen auf allen Geräten, damit überall dieselben Häufchen an denselben Stellen liegen
const seeded = (...n) => {
  let h = 2166136261;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};
// Dasselbe mit Texten als Schlüssel (Besuche: seedRnd('bird', fenster, n)) → Zahl in [0, 1)
const seedRnd = (...keys) => seeded(...keys.flatMap((k) => (typeof k === 'string' ? [...k].map((c) => c.charCodeAt(0)) : [k])));
// weighted mit fester Zahl u in [0, 1) statt Math.random; leere Liste oder nur Nullen → null
const weightedR = (list, u) => {
  const total = list.reduce((t, [w]) => t + w, 0);
  if (!(total > 0)) return null;
  let r = u * total;
  for (const [w, v] of list) if (w > 0 && (r -= w) < 0) return v;
  return list.filter(([w]) => w > 0).pop()[1];
};
// Plätze der Requisiten vorn am unteren Rand, von links in der Reihenfolge von ws (Wunschbreiten in px).
// o: { gap, left, right, door: [a, b], deko: [[a, b] …], store: [a, b], meadow }. Gesperrt sind der Eingang (dort
// schläft der Pika), die Bodendeko der Festtage und der Vorrat (Nische oder Heuhaufen); ein Requisit, das eine
// Sperre träfe, rückt hinter sie. Der Reihe nach wird versucht, bis alles Platz hat: 1. links vom Vorrat bleiben
// (dafür bis 20 % kleiner), 2. höchstens bis meadow (ein Stück auf die Wiese, bis 25 % kleiner), 3. bis zum rechten
// Rand (so kurz wie möglich), 4. der Vorrat darf verdeckt werden, 5. auch die Deko, 6. alles dicht an dicht wie früher (schmale Karte).
// Alle Requisiten werden gemeinsam gleich stark kleiner (k). Ergebnis: { k, xs: linke Kanten, tier: 1–6 }.
// Größeneinheit der Szene: die Kartenhöhe, auf schmalen Karten (Handy, schmaler als 3:2) die Breite / 1,5. Bau,
// Pika, Stein und alles andere bemessen sich daran, sonst passte der Pika nicht mehr zwischen Bau und Stein.
// Die Szene steht dann unten in der Karte, darüber ist mehr Himmel.
const UNIT_RATIO = 1.5;
const sceneUnit = (W, Hs) => Math.min(Hs, W / UNIT_RATIO);
// Ruheplatz eines Besuchers (Mitte x, Breite w, erlaubt a..b) neben die Sperren [l, r] rücken statt dahinter: an
// die nächste freie Kante. Passt er nirgends ganz hin, bleibt x.
const clearSpot = (x, w, a, b, blocks) => {
  const m = w / 2;
  const hit = (v) => blocks.some(([l, r]) => v > l - m + 1e-6 && v < r + m - 1e-6);
  if (!hit(x)) return x;
  const free = blocks.flatMap(([l, r]) => [l - m, r + m]).filter((v) => v >= a && v <= b && !hit(v));
  return free.length ? free.reduce((p, v) => (Math.abs(v - x) < Math.abs(p - x) ? v : p)) : x;
};

export {
  Cancel, calmMotion, rnd, pick, clamp, pause, hasKey, weighted, minutes, esc, seeded, seedRnd, weightedR, sceneUnit,
  clearSpot,
};
