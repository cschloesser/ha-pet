// Haus-Signale: Mülltonne, Garderobe, Saugroboter, Haustür – reine Regeln (wann, was, wie lange)

import { MEM_TONNE, MEM_TONNE2 } from './tagesplan.js';

// Eine Schicht neben dem Haus-Boten: Ein Zustand in HA löst beim Pika ein Requisit, eine Pose oder einen Spruch aus,
// und er erinnert nach festen Regeln daran. Alles folgt aus den Zuständen in HA (Kalender, Vorhersage, Sauger, Tür),
// darum zeigen alle Geräte dasselbe. Geteilt werden muss nur „Tonne steht draußen“: ein Bit im Tagesplan (MEM_TONNE).
// SIG: bin = ab so viel Uhr am Vortag steht die Tonne da; binNudge = so oft erinnert er wach an sie (min, max ms);
// ward = Garderobe von bis (Stunde), bewertet werden die Stunden wardFrom bis wardTo; doorGap = höchstens so oft
// reagiert er auf die Haustür; doorFresh = nur auf ein Öffnen, das höchstens so alt ist; doorTtl = kommt die Reaktion
// nicht binnen dieser Zeit dran (Schlafenszeit, Kaffee), verfällt sie; vacDead = so lange fährt der Roboter ohne
// Zustand (unavailable, unknown, Entität fehlt) noch weiter, dann verschwindet er; fcRetry = lehnt HA das Abo der
// Vorhersage ab, der nächste Versuch nach min ms, danach jedes Mal doppelt so spät, höchstens max
const SIG = {
  bin: 14, binNudge: [8 * 6e4, 12 * 6e4], ward: [6, 10], wardFrom: 7, wardTo: 19,
  rain: 0.5, umbrella: 2, cold: 3, uv: 5, doorGap: 2 * 6e4, doorFresh: 30000, doorTtl: 20000, rideGap: 5 * 6e4,
  vacDead: 15 * 6e4, fcRetry: [30000, 30 * 6e4],
};

// Datum aus dem Kalender ("2026-11-18 07:00:00" in Ortszeit, oder ISO) → ms
const sigTime = (v) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?$/.exec(String(v ?? '').trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)).getTime();
  const d = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(v ?? '').trim());
  if (d) return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])).getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

// Farbe der Tonne aus dem Namen der Abholung
const BIN_KINDS = [
  [/wert|gelb|verpack|plastik|leichtverp/i, 'gelb', '#f2c230'],
  [/bio|grün(?!glas)|kompost/i, 'bio', '#8a5a34'],
  [/papier|pappe|blau/i, 'papier', '#3f7fc4'],
  [/glas/i, 'glas', '#4f9a5a'],
  [/rest|grau|schwarz|haus/i, 'rest', '#5d6066'],
];
const binKind = (name) => {
  const k = BIN_KINDS.find(([re]) => re.test(String(name || '')));
  return k ? { kind: k[1], color: k[2] } : { kind: 'tonne', color: '#7d848c' };
};

// Mülltonne aus dem Kalender (state, attributes: start_time, message) → { at (Abholung), from (ab da steht sie da),
// name, kind, color } oder null. Läuft die Abholung (state "on") oder ist sie vorbei, steht keine da.
const binPlan = (st, now) => {
  if (!st || st.state === 'on') return null;
  const at = sigTime(st.attributes?.start_time);
  if (at == null || at <= now) return null;
  const d = new Date(at);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, SIG.bin).getTime();
  const name = String(st.attributes?.message || st.attributes?.description || 'Tonne');
  return { at, from, name, ...binKind(name) };
};

// „Tonne steht draußen“: zwei Bits im Gedächtnis des Pika-Tags (cute.m im Tagesplan). Eine Abholung steht von
// dFrom = pikaDay(from) (Vortag ab 14 Uhr) bis dAt = pikaDay(at) da, meist ist dAt = dFrom + 1.
// - MEM_TONNE: „die Tonne, die seit heute dasteht, ist draußen“. Geschrieben beim Antippen am Pika-Tag dFrom
//   (Vorabend, bis 4 Uhr früh). Der nächste Pika-Tag übernimmt es als MEM_TONNE2 (cuteNew, logik/tagesplan.js).
// - MEM_TONNE2: „die Tonne, die gestern schon dastand, ist draußen“. Vom Vortag übernommen, oder geschrieben beim
//   Antippen am Morgen der Abholung (Pika-Tag nach dFrom, binTap). Es wird nicht weitergegeben.
// binDone: Die Abholung ist erledigt, wenn cute.d zwischen dFrom und dAt liegt (der Tag davor oder ein alter Tag
// zählen nicht) und MEM_TONNE gesetzt ist, oder MEM_TONNE2 und sie am Vortag schon dastand (cute.d - 1 >= dFrom).
// bit: welche der beiden Bits gefragt sind.
//
// Wahrheitstafel. A wird am Tag 1 abgeholt (dFrom 0, dAt 1), B ist die nächste Abholung. Die Spalten Tag 0 bis 2
// zeigen die Bits in cute, wenn an dem Tag etwas in den Plan kommt (Tippen, Streicheln, ein Erlebnis); sonst bleibt
// cute beim letzten Tag stehen, und das Ergebnis ist dasselbe (MEM_TONNE am Tag dFrom gilt bis dAt, und für B liegt
// cute.d dann vor dFrom).
//   getippt                        | Tag 0 | Tag 1        | Tag 2  | A bis zur Abholung | B am Tag 2: ab Tag 1, 14 Uhr | B am Tag 3
//   gar nicht                      | –     | –            | –      | steht da           | steht da                     | steht da
//   A am Vorabend (Tag 0)          | TONNE | TONNE2       | –      | weg                | steht da                     | steht da
//   A am Morgen (Tag 1)            | –     | TONNE2       | –      | weg                | steht da                     | steht da
//   A am Vorabend, B am Vorabend   | TONNE | TONNE2+TONNE | TONNE2 | weg                | weg                          |
//   A am Morgen, B am Vorabend     | –     | TONNE2+TONNE | TONNE2 | weg                | weg                          |
//   A beliebig, B am Morgen (Tag 2)| …     | TONNE2       | TONNE2 | weg                | steht da bis zum Tippen      |
// Bis 0.43.0 schrieb jedes Tippen MEM_TONNE. Am Morgen der Abholung getippt (Dienstag 6:30 für Bio um 7 Uhr), lag es
// damit am Tag dFrom der nächsten Abholung: Der Gelbe Sack für Mittwoch blieb den ganzen Dienstagnachmittag und,
// übernommen, am Mittwochmorgen weg, und niemand stellte ihn raus. MEM_TONNE und MEM_TONNE2 zusammen am Morgen
// gingen auch nicht: Das ist der Stand „A am Vorabend, B am Vorabend“, bei dem B weg sein muss, und cuteNew gibt
// jedes MEM_TONNE an den nächsten Tag weiter. Bei mehreren Abholungen hintereinander (0.42.2) gilt das übernommene
// Bit nur für die Tonne, die gestern schon stand: Sonst nähme es am Dienstagnachmittag die Tonne für Mittwoch weg,
// sobald jemand streichelt.
const binDone = (cute, dFrom, dAt, bit = MEM_TONNE | MEM_TONNE2) => {
  if (!cute || cute.d < dFrom || cute.d > dAt) return false;
  if (cute.m & bit & MEM_TONNE) return true;
  return (cute.m & bit & MEM_TONNE2) !== 0 && cute.d - 1 >= dFrom;
};
// Angetippt am Pika-Tag today: welches Bit kommt für die Abholung, die seit dFrom dasteht, in den Plan von heute?
const binTap = (today, dFrom) => (today > dFrom ? MEM_TONNE2 : MEM_TONNE);

// Garderobe: was man heute braucht, aus der stündlichen Vorhersage ([{ datetime, temperature, precipitation,
// uv_index }]) für die Stunden SIG.wardFrom bis SIG.wardTo des Tags day (ms, irgendwann an dem Tag). Reihenfolge:
// was an die Tür gehört, von unten nach oben. → ['boots', 'umbrella', 'hat', 'sunhat'] (Auswahl)
const wardrobePick = (fc, day) => {
  const d = new Date(day);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate(), SIG.wardFrom).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate(), SIG.wardTo).getTime();
  const hrs = (Array.isArray(fc) ? fc : []).filter((h) => {
    const t = Date.parse(h?.datetime);
    return t >= a && t < b;
  });
  if (!hrs.length) return [];
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const rain = hrs.reduce((s, h) => s + (num(h.precipitation) ?? 0), 0);
  const temps = hrs.map((h) => num(h.temperature)).filter((v) => v != null);
  const uv = Math.max(0, ...hrs.map((h) => num(h.uv_index) ?? 0));
  const out = [];
  if (rain >= SIG.rain) out.push('boots');
  if (rain >= SIG.umbrella) out.push('umbrella');
  if (temps.length && Math.min(...temps) <= SIG.cold) out.push('hat');
  if (uv >= SIG.uv) out.push('sunhat');
  return out;
};
// Was er dazu sagt
const WARD_SAY = {
  boots: ['Gummistiefel heute!', 'Pfützen-Wetter!'], umbrella: ['Schirm nicht vergessen!', 'Regen kommt!'],
  hat: ['Mütze auf!', 'Brr, kalt heute!'], sunhat: ['Sonnenhut!', 'Viel Sonne heute!'],
};

// Saugroboter: Zustand → was er tut. drive: fährt über die Wiese, home: fährt zur Station (aus dem Bild), stuck:
// steckt fest (Störung), stop: steht (angehalten), null: in der Station (nicht zu sehen)
const VAC = {
  cleaning: 'drive', returning: 'home', paused: 'stop', idle: 'stop', error: 'stuck',
};
const vacMode = (state) => VAC[String(state || '').toLowerCase()] ?? null;
// Läufe aus dem Verlauf ([{ t, s }] aufsteigend) → [{ t (Beginn), end, min }]: von „cleaning“ bis „docked“
// (Zwischenstopps und kurze Rückfahrten gehören dazu). Ein Lauf unter 2 Minuten (an- und gleich wieder aus) zählt nicht.
const vacRuns = (rows) => {
  const out = [];
  let run = null;
  for (const r of rows || []) {
    const s = String(r.s ?? '').toLowerCase();
    if (s === 'cleaning' && !run) run = { t: r.t };
    else if (s === 'docked' && run) {
      if (r.t - run.t >= 2 * 6e4) out.push({ t: run.t, end: r.t, min: Math.round((r.t - run.t) / 6e4) });
      run = null;
    }
  }
  // Läufe, die nur Minuten auseinander liegen (abgesetzt und neu gestartet), sind einer
  const merged = [];
  for (const x of out) {
    const last = merged.at(-1);
    if (last && x.t - last.end < 10 * 6e4) Object.assign(last, { end: x.end, min: Math.round((x.end - last.t) / 6e4) });
    else merged.push({ ...x });
  }
  return merged;
};

export { SIG, sigTime, BIN_KINDS, binKind, binPlan, binDone, binTap, wardrobePick, WARD_SAY, VAC, vacMode, vacRuns };
