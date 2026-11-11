// Tests für die reinen Funktionen der Karte: node --test
// Die Karte ist eine einzige Browser-Datei. Hier wird sie mit ein paar Attrappen (window, document, customElements)
// in node geladen; über globalThis.__pikaTest gibt sie ihre reinen Funktionen und die Klasse heraus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
let T = null;
const warned = [];
vm.runInNewContext(src, {
  window: { matchMedia: () => ({ matches: false }), customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn: (...a) => warned.push(a) },
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController,
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });

// Objekte aus dem anderen Kontext haben andere Prototypen: für deepEqual über JSON angleichen
const plain = (v) => JSON.parse(JSON.stringify(v));
const NOW = Date.UTC(2026, 10, 11, 12);
const sek = (t) => Math.round(t / 1000) * 1000;

// Ein Plan, in dem alles belegt ist (so lang, wie er im Alltag höchstens wird)
const fullPlan = (rec) => ({
  hay: { n: 12, t: sek(NOW), c: '012340123401', m: Math.floor(NOW / 240000) },
  fl: { t: sek(NOW - 6e5), c: 3, x: 77, k: true },
  sport: { d: Math.floor(NOW / 864e5), k: Math.floor(NOW / 840000) },
  fd: [{ t: sek(NOW - 3000), x: 12, k: 0, e: false }, { t: sek(NOW - 2000), x: 55, k: 1, e: true }, { t: sek(NOW - 1000), x: 99, k: 1, e: false }],
  rec,
  cute: { d: Math.floor(NOW / 864e5), n: 99, m: 511 },
  fu: sek(NOW + 6e5),
  gift: { k: sek(NOW - 30 * 864e5), a: 999, p: sek(NOW - 36e5), n: 3, u: 255, v: 0xffff, z: 999, o: 999, b: sek(NOW - 6e5), x: sek(NOW - 9e5), y: 2, d: 99, i: 31 },
});

test('Karte lädt in node und gibt ihre Version heraus', () => {
  assert.ok(T, 'Testexport fehlt');
  assert.match(T.VERSION, /^\d+\.\d+\.\d+$/);
});

test('Tagesplan: schreiben und lesen ergibt denselben Text', () => {
  const k = Math.floor(NOW / 840000);
  const s = T.planSer(fullPlan([[k, 'paint', 'flieger'], [k - 1, 'music', ''], [k - 2, 'read', ''], [k - 3, 'tablet', '']]));
  assert.equal(T.planSer(T.planParse(s)), s);
  const leer = T.planSer(T.planBlank(NOW));
  assert.equal(T.planSer(T.planParse(leer)), leer);
});

test('Tagesplan: passt in den Helfer', () => {
  const k = Math.floor(NOW / 840000);
  const ohne = T.planSer(fullPlan([]));
  assert.ok(ohne.length <= T.PLAN_MIN, `ohne Verlauf ${ohne.length} Zeichen, PLAN_MIN ist ${T.PLAN_MIN}`);
  const voll = T.planSer(fullPlan([[k, 'paint', 'flieger'], [k - 1, 'bubbles', ''], [k - 2, 'tablet', ''], [k - 3, 'music', '']]));
  assert.ok(voll.length <= 255, `mit Verlauf ${voll.length} Zeichen, ein input_text fasst 255`);
});

test('Tagesplan: Unbekanntes und Kaputtes wird abgelehnt statt halb gelesen', () => {
  assert.equal(T.planParse('p2|3.abc.-.0|-|-|-'), null);
  assert.equal(T.planParse('p1|3.abc.-.0|-|-|-|x|y|z'), null);
  assert.equal(T.planParse(''), null);
  assert.equal(T.planParse(undefined), null);
});

test('Tagesplan: jede Änderung ist wiederholbar', () => {
  const day = T.pikaDay(NOW);
  const ops = [
    { t: 'feed', f: { t: sek(NOW), x: 40, k: 0, e: false } },
    { t: 'fate', ft: sek(NOW) },
    { t: 'pet', d: day, n: 7 },
    { t: 'mem', d: day, b: 16 },
    { t: 'rec', k: 5, a: 'paint', v: 'blume' },
    { t: 'sport', d: 20000, k: 9 },
    { t: 'gather', c: '2', m: 123 },
    { t: 'frgone', u: sek(NOW + 6e4) },
    { t: 'fdrop', f: { t: sek(NOW), c: 1, x: 30, k: false } },
    { t: 'ftake', ft: sek(NOW) },
    { t: 'gstart', k: sek(NOW) },
  ];
  let P = T.planBlank(NOW);
  for (const op of ops) {
    const einmal = T.planApply(P, op, NOW);
    const zweimal = T.planApply(einmal, op, NOW);
    assert.equal(T.planSer(zweimal), T.planSer(einmal), `Änderung ${op.t} zählt doppelt`);
    P = einmal;
  }
});

test('Tagesplan: Streicheln und Erlebnisse zweier Geräte kommen in jeder Reihenfolge gleich heraus', () => {
  const day = T.pikaDay(NOW);
  const a = [{ t: 'pet', d: day, n: 4 }, { t: 'mem', d: day, b: 1 }];
  const b = [{ t: 'pet', d: day, n: 9 }, { t: 'mem', d: day, b: 64 }];
  const run = (ops) => T.planSer(ops.reduce((P, op) => T.planApply(P, op, NOW), T.planBlank(NOW)));
  assert.equal(run([...a, ...b]), run([...b, ...a]));
  assert.deepEqual(plain(T.planParse(run([...a, ...b])).cute), { d: day, n: 9, m: 65 });
});

test('Tagesplan: ein Sammel-Fenster zählt nur einmal, der Vorrat verfällt um 2 am Tag', () => {
  let P = T.planBlank(NOW);
  P = T.planApply(P, { t: 'gather', c: '1', m: 50 }, NOW);
  P = T.planApply(P, { t: 'gather', c: '1', m: 50 }, NOW);
  assert.equal(P.hay.n, 4);
  assert.equal(T.hayNow(P.hay, NOW + 864e5).n, 2);
  assert.equal(T.hayNow(P.hay, NOW + 30 * 864e5).n, 1);
});

test('Päckchen: verschenken nur der Reihe nach, Stufen wachsen Schatz → Trick → golden', () => {
  let P = T.planApply(T.planBlank(NOW), { t: 'gstart', k: NOW }, NOW);
  P = T.planApply(P, { t: 'gdbg', f: { n: 3, y: 1 } }, NOW);
  const give = (z, i, gold) => {
    P = T.planApply(P, { t: 'give', z, x: NOW, i, gold }, NOW);
    P = T.planApply(P, { t: 'gopen', z }, NOW);
  };
  give(1, 2);
  assert.equal(T.giftLv(P.gift, 2), 1);
  give(1, 2); // dieselbe Nummer noch einmal: gilt nicht
  assert.equal(P.gift.n, 2);
  give(2, 2);
  assert.equal(T.giftLv(P.gift, 2), 2);
  give(3, 2); // Gold gibt es nur aus goldenen Päckchen
  assert.equal(T.giftLv(P.gift, 2), 2);
  give(4, 2 + 16, true);
  assert.equal(T.giftLv(P.gift, 2), 3);
  assert.equal(P.gift.y, 0);
});

test('Zustand: schreiben und lesen, alter Stand mit vier Feldern', () => {
  const st = T.freshStats(NOW);
  assert.deepEqual(plain(T.parseStats(T.serialize(st))), plain(st));
  const alt = T.parseStats('55.0,1700000000,60.0,1700000100');
  assert.equal(alt.m, 0);
  assert.equal(alt.c, 1700000100000);
  assert.equal(T.parseStats('kaputt'), null);
  assert.equal(T.parseStats('1,2,3'), null);
});

test('Zustand: eigenes Füttern kommt auf den fremden Stand obendrauf', () => {
  const other = { s: 40, st: NOW - 36e5, g: 70, gt: NOW, c: NOW - 864e5, m: 0, l: NOW - 864e5 };
  const out = T.mergeStats({ ...other }, other, { s: 25, g: 0, c: false }, NOW);
  assert.equal(out.s, 60); // 40 − 5 (eine Stunde Abbau) + 25
  assert.equal(out.st, NOW);
  assert.equal(out.g, 70);
});

test('Zustand: zwei Geräte putzen einzeln, beide Häufchen sind weg', () => {
  const c = NOW - 864e5;
  const own = { s: 50, st: NOW, g: 50, gt: NOW, c, m: 0b01, l: NOW - 2000 };
  const other = { s: 50, st: NOW, g: 50, gt: NOW, c, m: 0b10, l: NOW - 1000 };
  const out = T.mergeStats(own, other, { s: 0, g: 0, c: true }, NOW);
  assert.equal(out.m, 0b11);
  assert.equal(out.l, NOW - 1000);
  // der neuere Großputz gewinnt
  const neu = T.mergeStats({ ...own, c: NOW, m: 0, l: NOW }, other, { s: 0, g: 0, c: true }, NOW);
  assert.equal(neu.c, NOW);
  assert.equal(neu.m, 0);
});

test('Feste: Ostern, erster Advent, Geburtstage', () => {
  assert.deepEqual(plain(T.festEaster(2025)), [4, 20]);
  assert.deepEqual(plain(T.festEaster(2026)), [4, 5]);
  assert.deepEqual(plain(T.festEaster(2027)), [3, 28]);
  assert.equal(T.festAdvent1(2026), T.festDay(2026, 11, 29));
  assert.equal(T.festAdvent1(2023), T.festDay(2023, 12, 3));
  assert.deepEqual(plain(T.festBirthdate('03-14')), [3, 14]);
  assert.deepEqual(plain(T.festBirthdate('2019-11-02')), [11, 2]);
  assert.deepEqual(plain(T.festBirthdate('14.10.')), [10, 14]);
  assert.deepEqual(plain(T.festBirthdate(14.1)), [10, 14]); // YAML macht aus 14.10 die Zahl 14.1
  assert.deepEqual(plain(T.festBirthdate('29.02.')), [2, 29]);
  assert.equal(T.festBirthdate('31.04.'), null);
  assert.equal(T.festBirthdate('30.02.'), null);
  assert.equal(T.festBirthdate('Mittwoch'), null);
});

test('Sonne: Auf- und Untergang zur Sommersonnenwende bei 50° N, 8° O', () => {
  const t = T.sunTimes(new Date(2026, 5, 21), 50, 8);
  const min = (ms) => { const d = new Date(ms); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  assert.ok(Math.abs(min(t.rise) - (3 * 60 + 17)) <= 10, `Aufgang ${min(t.rise)} min UTC`);
  assert.ok(Math.abs(min(t.set) - (19 * 60 + 40)) <= 10, `Untergang ${min(t.set)} min UTC`);
  assert.equal(T.sunTimes(new Date(2026, 5, 21), 80, 8), null); // Polartag
});

test('Zufall: gleiche Schlüssel, gleiche Zahl, auf jedem Gerät', () => {
  assert.equal(T.seedRnd('bird', 12345, 1), T.seedRnd('bird', 12345, 1));
  assert.notEqual(T.seedRnd('bird', 12345, 1), T.seedRnd('bird', 12345, 2));
  const r = T.seedRnd('friend', 99, 0);
  assert.ok(r >= 0 && r < 1);
  assert.equal(T.weightedR([[0, 'a'], [2, 'b']], 0.5), 'b');
  assert.equal(T.weightedR([[0, 'a']], 0.5), null);
});

test('Fremde Namen im Plan: „constructor“ ist keine Beschäftigung', () => {
  assert.equal(T.hasKey(T.ACT_LEN, 'paint'), true);
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(T.hasKey(T.ACT_LEN, name), false, name);
  const c = Object.create(T.PikaPetCard.prototype);
  c._plan = T.planParse('p1|3.abc.-.0|-|zz:constructor|-');
  assert.equal(plain(c._plan.rec)[0][1], 'constructor'); // bleibt stehen (neuere Karten kennen vielleicht mehr) …
  assert.equal(c._bigAct(parseInt('zz', 36), NOW), null); // … wird aber nicht gespielt
});

test('Engine: Fehler werden gesammelt, derselbe nur einmal gemeldet', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  warned.length = 0;
  for (let i = 0; i < 5; i++) c._err('Test', new Error('bumm'));
  assert.equal(c._errs.length, 1);
  assert.equal(c._errs[0].n, 5);
  assert.equal(warned.length, 1);
  for (let i = 0; i < 15; i++) c._err(`Stelle ${i}`, new Error('x'));
  assert.equal(c._errs.length, 10);
  assert.equal(c._guard('Wächter', () => 7), 7);
  assert.equal(c._guard('Wächter', () => { throw new Error('y'); }), undefined);
  assert.equal(c._errs.at(-1).where, 'Wächter');
});

test('Engine: der Wachhund startet eine hängende Schleife beim zweiten Tick neu', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  let neu = 0;
  c._stop = () => {};
  c._start = () => neu++;
  c._running = true;
  c._action = 'idle';
  c._waitDue = Date.now() - 5000; // eben erst fällig: alles gut
  c._watchdog();
  c._watchdog();
  assert.equal(neu, 0);
  c._waitDue = Date.now() - 120000; // seit zwei Minuten überfällig
  c._watchdog();
  assert.equal(neu, 0);
  c._watchdog();
  assert.equal(neu, 1);
  assert.equal(c._errs.at(-1).where, 'Wachhund');
  c._running = false; // angehalten (Bildschirm aus): kein Neustart
  c._watchdog();
  c._watchdog();
  assert.equal(neu, 1);
});

// ---------- Haus-Bote: Plätze der Geräte ----------
// Maße der Karte 600 × 248 im Areal Erdhügel (in der Vorschau gemessen): Tür 70–121, Nische 182–223, Wiese ab 258
const HUEGEL = { gap: 5, left: 6, right: 594, door: [68, 123], deko: [], store: [180, 225], meadow: 283 };
const WASCH = 50;
const SPUEL = 57;
// Trifft eine Strecke [l, l + w] die Sperre [a, b]?
const trifft = (l, w, [a, b]) => l < b && l + w > a;
const frei = (r, ws, sperren) => r.xs.every((l, i) => sperren.every((b) => !trifft(l, ws[i] * r.k, b)));
const geordnet = (r, ws, gap) => r.xs.every((l, i) => i === 0 || l >= r.xs[i - 1] + ws[i - 1] * r.k + gap - 1e-6);

test('Haus-Bote: zwei Geräte stehen links und rechts der Tür, Eingang und Nische bleiben frei', () => {
  const ws = [WASCH, WASCH];
  const r = T.boteRow(ws, HUEGEL);
  assert.equal(r.k, 1);
  assert.equal(r.tier, 1);
  assert.equal(r.xs[0], 6);
  assert.equal(r.xs[1], 123);
  assert.ok(frei(r, ws, [HUEGEL.door, HUEGEL.store]));
});

test('Haus-Bote: das dritte Gerät rückt hinter die Nische, nur ein Stück auf die Wiese', () => {
  const ws = [WASCH, WASCH, SPUEL];
  const r = T.boteRow(ws, HUEGEL);
  assert.equal(r.tier, 2);
  assert.ok(frei(r, ws, [HUEGEL.door, HUEGEL.store]));
  assert.ok(geordnet(r, ws, HUEGEL.gap));
  assert.ok(r.xs[2] >= 225 && r.xs[2] + SPUEL * r.k <= HUEGEL.meadow);
});

test('Haus-Bote: Adventskranz neben der Tür bleibt frei, die Geräte weichen aus', () => {
  const o = { ...HUEGEL, deko: [[119, 173]] };
  for (const ws of [[WASCH, WASCH], [WASCH, WASCH, SPUEL]]) {
    const r = T.boteRow(ws, o);
    assert.ok(frei(r, ws, [o.door, o.store, ...o.deko]), `${ws.length} Geräte: ${JSON.stringify(r)}`);
    assert.ok(geordnet(r, ws, o.gap));
    assert.ok(r.xs.at(-1) + ws.at(-1) * r.k <= o.right);
  }
});

test('Haus-Bote: Areal mit Heuhaufen, zwei Geräte werden etwas kleiner und bleiben links vom Heu', () => {
  // Felsen 600 × 248: Tür 62–99, Heuhaufen 143–211, Wiese ab 245
  const o = { gap: 5, left: 6, right: 594, door: [60, 101], deko: [], store: [141, 213], meadow: 270 };
  const ws = [WASCH, WASCH];
  const r = T.boteRow(ws, o);
  assert.equal(r.tier, 1);
  assert.ok(r.k >= 0.8 && r.k < 1);
  assert.ok(frei(r, ws, [o.door, o.store]));
});

test('Haus-Bote: schmale Karte gibt erst den Vorrat, dann die Deko frei, die Tür zuletzt', () => {
  // 150 px breit: Tür 40–70, Vorrat 95–120, Kürbis 125–140
  const o = { gap: 3, left: 6, right: 144, door: [40, 70], deko: [[125, 140]], store: [95, 120], meadow: 130 };
  const zwei = T.boteRow([30, 30], o);
  assert.ok(frei(zwei, [30, 30], [o.door]), JSON.stringify(zwei));
  const drei = T.boteRow([30, 30, 30], o);
  assert.ok(frei(drei, [30, 30, 30], [o.door]), JSON.stringify(drei));
  assert.ok(drei.tier >= 4);
  // gar kein Platz: dicht an dicht wie früher, nie kleiner als 40 %
  const fuenf = T.boteRow([80, 80, 80, 80, 80], o);
  assert.equal(fuenf.tier, 6);
  assert.equal(fuenf.k, 0.4);
  assert.equal(fuenf.xs[0], 6);
});

test('Haus-Bote: drei Geräte im Advent werden nur kleiner, wenn die Reihe dadurch deutlich kürzer wird', () => {
  // Kranz neben der Tür, Stiefel auf der Wiese (316–348)
  const o = { ...HUEGEL, deko: [[119, 173], [316, 348]] };
  // kleiner passen die beiden letzten vor den Stiefel: die Reihe endet fast 100 px früher
  const a = T.boteRow([WASCH, 51, SPUEL], o);
  assert.equal(a.tier, 3);
  assert.equal(a.k, 0.75);
  assert.ok(a.end < 316);
  // mit einem breiten Handtuchstapel muss das dritte ohnehin hinter den Stiefel: dann lieber groß bleiben
  const b = T.boteRow([WASCH, 70, SPUEL], o);
  assert.equal(b.k, 1);
  assert.ok(frei(b, [WASCH, 70, SPUEL], [o.door, o.store, ...o.deko]));
});

// ---------- Besucher und Festdeko ----------
test('Besucher: Ruheplatz neben der Festdeko statt dahinter', () => {
  // Kürbis 315–349 auf der Wiese 258–403, Frosch 36 px breit
  const kuerbis = [[315, 349]];
  assert.equal(T.clearSpot(280, 36, 258, 403, kuerbis), 280); // weit genug weg: bleibt
  assert.equal(T.clearSpot(340, 36, 258, 403, kuerbis), 367); // näher an der rechten Kante
  assert.equal(T.clearSpot(320, 36, 258, 403, kuerbis), 297); // näher an der linken Kante
  // Kante außerhalb des Erlaubten: die andere Seite
  assert.equal(T.clearSpot(320, 36, 300, 403, kuerbis), 367);
  // zwei Stücke dicht beieinander: nicht in die Lücke, in die er nicht passt
  const zwei = [[315, 349], [360, 390]];
  assert.equal(T.clearSpot(352, 36, 258, 450, zwei), 297);
  // nirgends Platz: bleibt, wo er hinwollte
  assert.equal(T.clearSpot(330, 36, 310, 350, kuerbis), 330);
});

// ---------- Schmale Karten ----------
test('Größeneinheit: ab 3:2 die Höhe, schmaler die Breite / 1,5', () => {
  assert.equal(T.sceneUnit(600, 248), 248); // Wand-Tablet: unverändert
  assert.equal(T.sceneUnit(380, 184), 184);
  assert.equal(T.sceneUnit(372, 248), 248); // genau 3:2
  assert.ok(Math.abs(T.sceneUnit(340, 248) - 226.67) < 0.01); // Handy im Abschnitts-Layout
  assert.ok(Math.abs(T.sceneUnit(320, 400) - 213.33) < 0.01); // Hochformat
});

// ---------- Streicheln: Glück hängt an der Zeit, nicht an der Zahl der Tipps ----------
// Summe aus Tipps im festen Abstand über die Dauer (ms)
const tippen = (abstand, dauer) => {
  let g = 0;
  let zuletzt = -Infinity;
  for (let t = 0; t <= dauer; t += abstand) {
    g += T.petGain(t - zuletzt);
    zuletzt = t;
  }
  return g;
};

test('Streicheln: Dauerfeuer bringt nie mehr als ruhiges Tippen, abgezogen wird nichts', () => {
  assert.equal(T.petGain(Infinity), T.GAIN.pet); // der erste Tipp zählt voll
  assert.equal(T.petGain(T.PET_CALM), T.GAIN.pet);
  assert.equal(T.petGain(T.PET_CALM * 10), T.GAIN.pet); // nie mehr als voll
  assert.ok(T.petGain(100) > 0); // jeder Tipp zählt
  assert.equal(T.petGain(-500), 0); // Uhr sprang zurück: nichts, aber auch kein Abzug
  const dauer = 14 * T.PET_CALM;
  const ruhig = tippen(T.PET_CALM, dauer);
  assert.equal(ruhig, 15 * T.GAIN.pet);
  for (const ms of [50, 100, 250, 500, 750]) assert.ok(tippen(ms, dauer) <= ruhig + 1e-6, `alle ${ms} ms: ${tippen(ms, dauer)}`);
  // langsamer als ruhig bringt je Tipp dasselbe, also insgesamt weniger: Es gibt keinen Grund, sich zu beeilen
  assert.ok(tippen(3000, dauer) < ruhig);
});

test('Streicheln: Kraulen lohnt mehr als jedes Tippen', () => {
  assert.ok(T.KRAUL.gain / T.KRAUL.beat > T.GAIN.pet / T.PET_CALM, 'je Sekunde');
  assert.equal(T.kraulGain(0), 0);
  assert.equal(T.kraulGain(T.KRAUL.beat - 1), 0);
  assert.equal(T.kraulGain(T.KRAUL.beat), T.KRAUL.gain);
  assert.equal(T.kraulGain(1e9), T.kraulGain(T.KRAUL.max)); // nach KRAUL.max ist Schluss
  // Finger liegt 10 bzw. 20 s (Einsetzen nach hold, der Einstieg zählt wie ein Tipp) gegen Dauerfeuer in derselben Zeit
  for (const dauer of [10000, 20000]) {
    const kraulen = T.GAIN.pet + T.kraulGain(dauer - T.KRAUL.hold);
    assert.ok(kraulen > tippen(100, dauer), `${dauer} ms: kraulen ${kraulen}, tippen ${tippen(100, dauer)}`);
  }
});

// ---------- Die Welt antwortet ----------
test('Welt: die Art des ersten Treffers gewinnt, unter gleichen die nächste Mitte', () => {
  const zones = [
    { k: 'flower', i: 0, l: 100, t: 200, r: 130, b: 240 },
    { k: 'flower', i: 1, l: 120, t: 200, r: 150, b: 240 },
    { k: 'door', l: 60, t: 150, r: 125, b: 230 },
    { k: 'star', i: 0, l: 300, t: 20, r: 326, b: 46 },
    { k: 'star', i: 1, l: 310, t: 30, r: 336, b: 56 },
    { k: 'cloud', l: 280, t: 10, r: 400, b: 60 },
  ];
  assert.equal(T.worldPick(10, 10, zones), null); // freier Himmel bzw. Wiese
  assert.equal(T.worldPick(80, 180, zones).k, 'door');
  assert.equal(T.worldPick(110, 210, zones).k, 'flower'); // Blume vor der Tür
  assert.equal(T.worldPick(124, 220, zones).i, 0); // zwei Blumen: Mitte 115 ist näher als 135
  assert.equal(T.worldPick(127, 220, zones).i, 1);
  assert.equal(T.worldPick(320, 40, zones).k, 'star'); // Stern vor der Wolke
  assert.equal(T.worldPick(320, 40, zones).i, 1);
  assert.equal(T.worldPick(390, 50, zones).k, 'cloud');
  assert.equal(T.worldPick(50, 50, []), null);
});

// ---------- Mimik ----------
test('Mimik: Trauer, Trotz, Stolz und Staunen haben je einen Mundpfad mit der Kerbe unter der Nase', () => {
  assert.deepEqual(Object.keys(T.MIMIK).sort(), ['awe', 'defy', 'proud', 'sad']);
  for (const [k, d] of Object.entries(T.MIMIK)) assert.match(d, /^M91 54\.1 v[\d.]+ M[\d. ]+[qa]/, k);
  // nur ein Name aus der Tabelle setzt etwas; „constructor“ ist keine Miene
  const cls = [];
  const c = Object.create(T.PikaPetCard.prototype);
  c._el = { pika: { classList: { add: (...a) => cls.push(...a), remove() {} }, querySelector: () => ({ setAttribute() {} }) } };
  c._mimik('constructor');
  assert.equal(c._mim, null);
  assert.deepEqual(cls, []);
  c._mimik('awe');
  assert.equal(c._mim, 'awe');
  assert.deepEqual(cls, ['mi', 'mi-awe']);
  c._mimik(null);
  assert.equal(c._mim, null);
});

// ---------- Entdeckungen ----------
test('Entdeckungen: Kennungen eindeutig, jede mit Titel, Hinweis und gültigem Abschnitt', () => {
  const ids = T.FINDS.map((f) => f.k);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of T.FINDS) {
    assert.match(f.k, /^[a-z]+$/, f.k); // steht mit Kommas getrennt im Browser-Speicher
    assert.ok(f.t && f.h, f.k);
    assert.ok(f.g >= 0 && f.g < T.FIND_GROUPS.length, f.k);
    assert.ok(f.need === undefined || ['gift', 'friend', 'flight', 'bote', 'wheel', 'yarn'].includes(f.need), f.k);
  }
  // was die Welt beantwortet, steht auch auf der Seite
  for (const k of ['flower', 'cloud', 'star', 'door', 'wheel', 'yarn']) assert.ok(ids.includes(k), k);
});

test('Entdeckungen: gemerkt nur auf dem Gerät, Unbekanntes wird überlesen, diary: false merkt nichts', () => {
  assert.equal(T.findsSer(T.findsParse('nose,quatsch,head,nose,__proto__')), 'head,nose'); // in der Reihenfolge der Seite
  assert.equal(T.findsParse(null).size, 0);
  assert.equal(T.findsParse(undefined).size, 0);
  // In node gibt es keinen Browser-Speicher: Dann gilt es bis zum Neuladen, ohne Fehler
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { name: 'Test' };
  c._found('nose');
  c._found('nose');
  c._found('quatsch');
  assert.deepEqual([...c._finds()], ['nose']);
  c._cfg = { name: 'Test', diary: false };
  c._found('head');
  assert.deepEqual([...c._finds()], ['nose']);
});

// Die echte Methode _kraul mit Attrappen: Finger kurz weg und gleich wieder drauf. Der neue Druck bricht das alte
// Kraulen ab; dessen Aufräumen darf dem neuen nicht den Finger wegnehmen (sonst: einmal „prrr…“ und Schluss).
test('Kraulen: kurz absetzen und wieder auflegen läuft weiter', async () => {
  const c = Object.create(T.PikaPetCard.prototype);
  const cls = new Set();
  c._el = { pika: { classList: { add: (...x) => x.forEach((k) => cls.add(k)), remove: (...x) => x.forEach((k) => cls.delete(k)), contains: (k) => cls.has(k) } } };
  let adds = 0;
  Object.assign(c, { _say() {}, _add: () => adds++, _petCount() {}, _found() {}, _blush() {}, _hearts() {}, _running: true, _g: {}, _action: 'kraul' });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  c._ac = new AbortController();
  c._press = { kraul: true };
  c._kraulOn = true;
  const p1 = c._kraul().catch((e) => e);
  await sleep(T.KRAUL.beat + 50); // der zweite Takt hat eben begonnen
  c._press = null; // Finger weg (_pressEnd)
  c._kraulOn = false;
  await sleep(100);
  c._press = { kraul: true }; // wieder drauf, der Zeitgeber aus _pressStart hat ausgelöst
  c._kraulOn = true;
  c._touchNext('kraul'); // bricht das alte Kraulen ab
  await p1;
  assert.equal(c._kraulOn, true, 'das alte Kraulen hat dem neuen den Finger weggenommen');
  c._ac = new AbortController();
  adds = 0;
  const p2 = c._kraul().catch((e) => e);
  await sleep(T.KRAUL.beat + 150);
  assert.ok(adds >= 2, `das zweite Kraulen läuft nicht weiter (${adds} Buchungen)`);
  assert.equal(c._kraulOn, true);
  // Bricht etwas anderes das Kraulen ab, während der Finger noch liegt, ist es vorbei
  c._ac.abort();
  await p2;
  assert.equal(c._kraulOn, false);
});

// ---------- Wetter mit Gewicht (0.31) ----------
const rgbOf = (hex) => plain(T.hexRgb(hex));
const nah = (a, b, tol) => rgbOf(a).every((v, i) => Math.abs(v - rgbOf(b)[i]) <= tol);
const MAI = () => T.seasonPal(4);

test('Dämmerung: stufenlos aus der Sonnenhöhe, Tag bis 10°, Nacht ab −9°', () => {
  assert.deepEqual(plain(T.twilight(30)), { d: 0, n: 0 });
  assert.deepEqual(plain(T.twilight(10)), { d: 0, n: 0 });
  assert.deepEqual(plain(T.twilight(0)), { d: 1, n: 0 }); // Sonnenuntergang: ganz Abend, noch keine Nacht
  assert.deepEqual(plain(T.twilight(-9)), { d: 1, n: 1 });
  let vor = T.twilight(12);
  for (let e = 11.5; e >= -12; e -= 0.5) {
    const tw = T.twilight(e);
    assert.ok(tw.d >= vor.d && tw.n >= vor.n, `bei ${e}° wird es wieder heller`);
    assert.ok(tw.d - vor.d < 0.1 && tw.n - vor.n < 0.1, `Sprung bei ${e}°`); // keine Stufe mehr bei 4° und −5°
    vor = tw;
  }
});

test('Landschaft: Mai am Tag wie bis 0.30, Abend und Nacht nah an den alten Farben, bedeckt wie der alte Filter', () => {
  const tag = T.landColors(MAI());
  assert.deepEqual([tag.h1, tag.h2, tag.h3, tag.mound, tag.moundS], ['#a9d68f', '#86c46b', '#7ab960', '#94c873', '#5f8f45']);
  assert.equal(tag.lb, 1);
  assert.equal(tag.ls, 1);
  const abend = T.landColors(MAI(), { d: 1 });
  assert.ok(nah(abend.h1, '#8fa98a', 12) && nah(abend.h2, '#6e9562', 12), `${abend.h1} ${abend.h2}`);
  assert.ok(Math.abs(abend.lb - 0.85) < 1e-9 && Math.abs(abend.ls - 0.85) < 1e-9);
  const nacht = T.landColors(MAI(), { d: 1, n: 1 });
  assert.ok(nah(nacht.h1, '#2c4547', 8) && nah(nacht.h2, '#26433a', 8), `${nacht.h1} ${nacht.h2}`);
  assert.ok(Math.abs(nacht.lb - 0.5) < 1e-9 && Math.abs(nacht.ls - 0.6) < 1e-9 && Math.abs(nacht.lbp - 0.55) < 1e-9);
  const grau = T.landColors(MAI(), { grey: 1 });
  assert.ok(Math.abs(grau.lb - 0.9) < 1e-9 && Math.abs(grau.ls - 0.8) < 1e-9);
  // Gewitter ist dunkler als bedeckt, am Tag und in der Dämmerung; die Nacht bleibt, wie sie ist
  const lum = (hex) => { const [r, g, b] = rgbOf(hex); return 0.213 * r + 0.715 * g + 0.072 * b; };
  const sturm = T.landColors(MAI(), { grey: 1, storm: 1 });
  assert.ok(sturm.lb < grau.lb - 0.15 && lum(sturm.h2) < lum(grau.h2) - 20);
  assert.ok(T.landColors(MAI(), { d: 1, grey: 1, storm: 1 }).lb < T.landColors(MAI(), { d: 1, grey: 1 }).lb);
  assert.equal(T.landColors(MAI(), { d: 1, n: 1, grey: 1, storm: 1 }).h2, nacht.h2);
  // Schnee: volle Decke in den Farben, die bis 0.30 bei „snowy“ galten (am Tag unter der Wolkendecke)
  const schnee = T.landColors(MAI(), { snow: 1 });
  assert.deepEqual([schnee.h1, schnee.h2, schnee.h3, schnee.mound], ['#e9eff3', '#dfe7ed', '#cfdbe3', '#e6edf2']);
  const halb = T.landColors(MAI(), { snow: 0.5 });
  assert.ok(lum(halb.h2) > lum(tag.h2) && lum(halb.h2) < lum(schnee.h2));
  // Berge (alpin): an den Enden die alten Farben, dazwischen gleitend; Gewitter wie beim Land (nachts nicht dunkler)
  assert.deepEqual([tag.m1, tag.mcap, abend.m1, abend.mcap, nacht.m1, nacht.mcap], ['#8b9bb1', '#f4f7fa', '#6c6f8f', '#e6d3de', '#222c45', '#7d88a0']);
  for (let n = 0, vor = lum(abend.m1); n <= 1; n += 0.1) {
    const m = lum(T.landColors(MAI(), { d: 1, n }).m1);
    assert.ok(m <= vor + 1e-9 && vor - m < 12, `Berge springen bei n = ${n.toFixed(1)}`);
    vor = m;
  }
  assert.ok(lum(sturm.m1) < lum(grau.m1) - 15 && lum(grau.m1) < lum(tag.m1));
  assert.equal(T.landColors(MAI(), { d: 1, n: 1, grey: 1, storm: 1 }).m1, nacht.m1);
});

test('Jahreszeit: im November keine Frühlingswiese, nie braun, Südhalbkugel versetzt', () => {
  assert.ok(Math.abs(T.seasonPos(new Date(2026, 4, 16, 12).getTime()) - 4) < 0.05); // Mitte Mai
  assert.ok(Math.abs(T.seasonPos(new Date(2026, 4, 16, 12).getTime(), true) - 10) < 0.05);
  assert.equal(T.seasonKey(new Date(2026, 10, 11).getTime()), 'autumn');
  assert.equal(T.seasonKey(new Date(2026, 10, 11).getTime(), true), 'spring');
  assert.equal(T.seasonKey(new Date(2026, 1, 1).getTime()), 'winter');
  assert.equal(T.seasonKey(new Date(2026, 6, 1).getTime()), 'summer');
  // wie viel grüner als rot: Im Mai kräftig, im Herbst gelbgrün, im Winter matt
  const gruen = (c) => c[1] - c[0];
  const mai = T.seasonPal(4);
  const nov = T.seasonPal(T.seasonPos(new Date(2026, 10, 11).getTime()));
  assert.ok(gruen(nov.h2) < gruen(mai.h2) / 2, 'November so sattgrün wie Mai');
  assert.ok(gruen(T.seasonPal(0).h2) < gruen(mai.h2) / 2, 'Januar so sattgrün wie Mai');
  assert.ok(nov.h2[0] > mai.h2[0] + 10, 'November nicht gelber als Mai');
  // gleitend übers Jahr (kein Sprung am Monatsende), und Grün bleibt in jedem Monat die stärkste Farbe
  for (let p = 0; p < 12; p += 0.05) {
    const a = T.seasonPal(p);
    const b = T.seasonPal((p + 0.05) % 12);
    for (const k of ['h1', 'h2', 'h3', 'mound']) {
      assert.ok(a[k].every((v, i) => Math.abs(v - b[k][i]) < 3), `Sprung bei ${p.toFixed(2)} in ${k}`);
      assert.ok(a[k][1] > a[k][0] && a[k][1] > a[k][2], `${k} bei ${p.toFixed(2)} nicht grün`);
    }
  }
  // Blumen: je Jahreszeit fünf Farben, die Nummern im Tagesplan bleiben gültig
  assert.equal(T.FLOWER_COLORS.length, 5);
  for (const k of ['autumn', 'winter']) assert.equal(T.FLOWER_SEASON[k].length, 5, k);
});

test('Schneedecke: liegt nach dem Schneefall, taut mit Wärme, Regen und Zeit', () => {
  const now = NOW;
  const H = 36e5;
  const ruhig = [{ t: now - 3 * H, c: 'cloudy', T: 1 }];
  assert.equal(T.snowDepth(ruhig, now), 0);
  // es schneit: nach SNOW.full ist die Decke zu
  const seit = (min) => T.snowDepth([...ruhig, { t: now - min * 60000, c: 'snowy', T: -1 }], now);
  assert.ok(seit(2) > 0 && seit(2) < seit(6) && seit(6) < 1);
  assert.equal(seit(30), 1);
  // vorbei: bei 2 °C hält sie 12 Stunden
  const nach = (h, temp, cond = 'cloudy') => T.snowDepth([{ t: now - h * H - 2 * H, c: 'snowy', T: temp }, { t: now - h * H, c: cond, T: temp }], now);
  assert.ok(Math.abs(nach(6, 2) - 0.5) < 1e-9);
  assert.equal(nach(13, 2), 0);
  assert.ok(nach(6, -3) > 0.85); // Frost: bleibt
  assert.ok(nach(6, 2, 'sunny') < nach(6, 2)); // Sonne taut schneller
  assert.equal(nach(4, 2, 'rainy'), 0); // Regen noch schneller
  assert.equal(nach(80, -10), 0); // nach drei Tagen ist auch im Frost Schluss
  for (let h = 0, vor = 1; h <= 14; h += 0.5) {
    assert.ok(nach(h, 2) <= vor, `nach ${h} h liegt mehr als vorher`);
    vor = nach(h, 2);
  }
  // Schneeregen zählt nur bei Frost als Schnee
  assert.equal(T.snowDepth([{ t: now - H, c: 'snowy-rainy', T: -1 }], now), 1);
  assert.equal(T.snowDepth([{ t: now - H, c: 'snowy-rainy', T: 2 }], now), 0);
  assert.equal(T.snowDepth([{ t: now - H, c: 'snowy-rainy', T: null }], now), 0);
  assert.equal(T.snowHours(0, 'cloudy'), 24);
  assert.equal(T.snowHours(20, 'cloudy'), 1.5);
  assert.equal(T.snowHours(-20, 'cloudy'), 72);
  assert.equal(T.snowHours(null, 'cloudy'), 12);
  assert.equal(T.snowHours(NaN, 'cloudy'), 12);
  assert.equal(T.snowHours(undefined, 'cloudy'), 12);
});

// Der Tag aus dem Fund: Schnee bis 08:00, dann durchgehend „cloudy“ (0 °C beim Wechsel), mittags 6 °C, um 18:00
// wieder 2 °C, um 22:00 wieder 0 °C. Die Mitschrift wächst wie am Gerät Meldung für Meldung (wxLogAdd).
test('Kühlt es abends ab, kommt kein Schnee zurück: die Decke nimmt ohne Schneefall nie zu', () => {
  const H = 36e5;
  const t8 = NOW;
  const gang = [[0, 0], [1, 1], [2, 2], [3, 4], [4, 6], [5, 6.4], [6, 6], [7, 5], [8, 4], [9, 3], [10, 2], [11, 1.4], [12, 1], [14, 0], [16, -1], [20, -2]];
  let log = T.wxLogAdd([], [{ t: t8 - 2 * H, c: 'snowy', T: -1 }], t8 - 2 * H);
  let vor = 1;
  const um = {};
  for (let i = 0; i < gang.length; i++) {
    const [h, temp] = gang[i];
    log = T.wxLogAdd(log, [{ t: t8 + h * H, c: 'cloudy', T: temp }], t8 + h * H);
    // bis zur nächsten Meldung alle zehn Minuten nachsehen (der 20-s-Takt der Karte rechnet genauso)
    const bis = gang[i + 1] ? gang[i + 1][0] : h + 6;
    for (let x = h; x < bis; x += 1 / 6) {
      const d = T.snowDepth(log, t8 + x * H);
      assert.ok(d <= vor + 1e-12, `${(8 + x).toFixed(2)} Uhr bei ${temp} °C: ${d.toFixed(3)} nach ${vor.toFixed(3)}`);
      vor = d;
    }
    um[h] = T.snowDepth(log, t8 + h * H);
  }
  assert.equal(um[0], 1);
  assert.ok(um[2] > 0.8 && um[3] < um[2]);
  assert.equal(um[6], 0, 'mittags bei 6 °C ist sie weg');
  assert.equal(um[10], 0, 'um 18:00 bei 2 °C kommt sie nicht wieder');
  assert.equal(um[14], 0, 'um 22:00 bei 0 °C kommt sie nicht wieder');
  assert.equal(um[20], 0);
  // Jede Temperaturstufe ist ein eigener Stützpunkt (ganze Grad), die Lage bleibt dieselbe
  assert.deepEqual(plain(log).slice(0, 5), [{ t: t8 - 2 * H, c: 'snowy', T: -1 }, { t: t8, c: 'cloudy', T: 0 },
    { t: t8 + H, c: 'cloudy', T: 1 }, { t: t8 + 2 * H, c: 'cloudy', T: 2 }, { t: t8 + 3 * H, c: 'cloudy', T: 4 }]);
  assert.ok(log.every((r, i) => i === 0 || r.c !== log[i - 1].c || r.T !== log[i - 1].T), 'Meldung ohne neue Lage und Temperatur steht doppelt');
});

test('Schneedecke: Sensorrauschen schaltet sie nicht hin und her', () => {
  const H = 36e5;
  const t0 = NOW;
  // Schnee bis t0, dann bewölkt um 2 °C: Der Fühler meldet alle fünf Minuten 1,9 bis 2,6 °C
  let log = T.wxLogAdd([], [{ t: t0 - 2 * H, c: 'snowy', T: -1 }, { t: t0, c: 'cloudy', T: 2 }], t0);
  const rausch = [2.0, 2.2, 1.9, 2.4, 2.6, 2.3, 2.0, 2.6, 1.9, 2.5];
  let vor = 1;
  let liegt = true;
  let wechsel = 0;
  for (let k = 1; k <= 12 * 14; k++) {
    const t = t0 + k * 5 * 60000;
    log = T.wxLogAdd(log, [{ t, c: 'cloudy', T: rausch[k % rausch.length] }], t);
    const d = T.snowDepth(log, t);
    assert.ok(d <= vor + 1e-12, `nach ${(k / 12).toFixed(2)} h: ${d} nach ${vor}`);
    vor = d;
    const an = Math.round(d * 20) / 20 >= T.SNOW.show; // wie snowcover in _applyWeather
    if (an !== liegt) wechsel++;
    liegt = an;
  }
  assert.equal(wechsel, 1, 'snowcover schaltet mehr als einmal');
  assert.equal(liegt, false);
  // 7 h nach dem Schneefall hängt die Decke nicht an der Temperatur dieses Augenblicks (früher 0,40 bei 2,0 °C und
  // 0,35 bei 2,2 °C): Die neue Meldung zählt erst ab jetzt
  const basis = T.wxLogAdd([], [{ t: t0 - 2 * H, c: 'snowy', T: -1 }, { t: t0, c: 'cloudy', T: 2 }], t0);
  const mit = (temp) => T.snowDepth(T.wxLogAdd(basis, [{ t: t0 + 7 * H, c: 'cloudy', T: temp }], t0 + 7 * H), t0 + 7 * H);
  assert.equal(mit(2.0), mit(2.2));
  assert.equal(mit(2.0), mit(9));
  assert.ok(Math.abs(mit(-5) - (1 - 7 / 12)) < 1e-9);
});

// Gerät A lief mit und hat jede Meldung mitgeschrieben. Gerät B lädt um 13:00 bei 5 °C: Es kennt erst nur die
// laufende Lage (seit 08:00, mit der Temperatur von jetzt), dann antwortet der Recorder.
test('Wetterverlauf: zwei Geräte kommen aus Mitschrift und Recorder auf denselben Stand', () => {
  const H = 36e5;
  const t13 = NOW;
  // Meldungen der Wetter-Entität: [Stunden ab 13:00, Lage, °C]
  const tag = [[-80, 'cloudy', 3], [-9, 'cloudy', 1], [-7, 'snowy', -1], [-6.9, 'unavailable', null], [-6.8, 'snowy', -1.2], [-5, 'cloudy', 0], [-4.5, 'cloudy', 0.3],
    [-4, 'cloudy', 1], [-3, 'cloudy', 2], [-2, 'cloudy', 4], [-1, 'cloudy', 5], [0, 'cloudy', 5.2]];
  const spaeter = [[2, 'cloudy', 4], [4, 'cloudy', 2], [7, 'cloudy', 1], [9, 'cloudy', 0]];
  const zeile = ([h, c, temp]) => ({ t: t13 + h * H, c, T: temp ?? NaN });
  // was der Recorder dazu liefert: { s, a, lu } mit Mikrosekunden, null statt Temperatur beim Aussetzer
  // (der Stand am Anfang der drei Tage trägt deren Beginn als Zeitstempel)
  const recorder = (bis, now) => T.wxRows([{ s: 'cloudy', a: { temperature: 3 }, lu: (now - 72 * H) / 1000 },
    ...tag.filter(([h]) => h > -72 && h <= bis).map(([h, c, temp]) => ({ s: c, a: { temperature: temp }, lu: (t13 + h * H) / 1000 + 0.000456 }))]);
  let A = [];
  for (const m of tag) A = T.wxLogAdd(A, [zeile(m)], zeile(m).t);
  // der Aussetzer von sechs Minuten zählt nicht, Schnee gilt ab dem ersten Mal; Zehntelgrade geben keinen Stützpunkt
  assert.deepEqual(plain(A).map((r) => [r.c, r.T]), [['cloudy', 3], ['cloudy', 1], ['snowy', -1], ['cloudy', 0], ['cloudy', 1], ['cloudy', 2], ['cloudy', 4], ['cloudy', 5]]);
  assert.equal(A[2].t, t13 - 7 * H);
  // B: vorläufig die Lage seit last_changed (08:00) mit der Temperatur beim Laden und die Meldung selbst
  const jetzt = { t: t13 + 0.000456, c: 'cloudy', T: 5.2 };
  let B = T.wxLogAdd([], [{ ...jetzt, t: t13 - 5 * H }, jetzt], t13);
  assert.deepEqual(plain(B), [{ t: t13 - 5 * H, c: 'cloudy', T: 5 }]);
  assert.equal(T.snowDepth(B, t13), 0); // weiß noch nichts vom Schnee
  assert.ok(T.snowDepth(A, t13) > 0.4, `A ${T.snowDepth(A, t13)}`);
  B = T.wxLogMerge([...B, jetzt], recorder(0, t13), t13);
  // derselbe Verlauf: 08:00 steht mit den 0 °C von damals da, nicht mit den 5 °C beim Laden
  assert.deepEqual(plain(B).slice(1), plain(A).slice(1));
  assert.deepEqual(plain(B)[3], { t: t13 - 5 * H, c: 'cloudy', T: 0 });
  assert.deepEqual(plain(B)[0], { t: t13 - 72 * H, c: 'cloudy', T: 3 }); // davor: der Stand an der Grenze der drei Tage
  assert.equal(T.snowDepth(B, t13), T.snowDepth(A, t13));
  // und so bleibt es, auch wenn es abends wieder abkühlt
  for (const m of spaeter) {
    A = T.wxLogAdd(A, [zeile(m)], zeile(m).t);
    B = T.wxLogAdd(B, [zeile(m)], zeile(m).t);
    assert.deepEqual(plain(B).slice(1), plain(A).slice(1));
    assert.equal(T.snowDepth(B, zeile(m).t), T.snowDepth(A, zeile(m).t));
  }
  // Der Recorder ist dem Gerät ein paar Sekunden hinterher: Was es danach selbst sah, bleibt
  let C = T.wxLogAdd([], [{ ...jetzt, t: t13 - 5 * H }, jetzt], t13);
  C = T.wxLogMerge([...C, jetzt], recorder(-1, t13), t13);
  assert.deepEqual(plain(C).slice(1), plain(A).slice(1, 8));
  // Recorder liefert nichts (Entität nicht aufgezeichnet): Die Mitschrift bleibt
  assert.deepEqual(plain(T.wxLogMerge(A, [], t13 + 9 * H)), plain(T.wxLogAdd(A, [], t13 + 9 * H)));
  // bei gleichem Zeitstempel gilt die spätere Meldung (rows vor log)
  assert.deepEqual(plain(T.wxLogAdd([{ t: t13, c: 'cloudy', T: 5 }], [{ t: t13 + 400, c: 'cloudy', T: 0 }], t13)), [{ t: t13, c: 'cloudy', T: 0 }]);
  // Altes fällt heraus, bis auf den Stand an der Grenze; Kaputtes und Zukünftiges wird überlesen
  const alt = T.wxLogAdd([{ t: t13 - 200 * H, c: 'sunny' }, { t: t13 - 100 * H, c: 'rainy' }, { t: t13 - H, c: 'sunny' }, { t: t13 + H, c: 'fog' }, { t: NaN, c: 'x' },
    { t: String(t13), c: 'sunny' }, { t: t13, c: 5 }, null], [], t13);
  assert.deepEqual(plain(alt).map((r) => r.c), ['rainy', 'sunny']);
});

test('Wetterverlauf: fehlende Temperatur ist unbekannt, nicht 0 °C', () => {
  for (const v of [null, undefined, '', ' ', 'kalt', {}, true]) assert.ok(Number.isNaN(T.numAttr(v)), String(v));
  assert.equal(T.numAttr('3.5'), 3.5);
  assert.equal(T.numAttr(0), 0);
  assert.ok(Number.isNaN(T.wxTemp({ temperature: null })));
  assert.ok(Number.isNaN(T.wxTemp({ temperature: null, temperature_unit: '°F' })));
  assert.ok(Number.isNaN(T.wxTemp(undefined)));
  assert.equal(T.wxTemp({ temperature: 0 }), 0);
  assert.ok(Math.abs(T.wxTemp({ temperature: 50, temperature_unit: '°F' }) - 10) < 1e-9);
  // Zeilen des Recorders: kaputte werden überlesen, beide Formate von HA gelesen
  const rows = plain(T.wxRows([null, 7, { s: 'snowy', a: { temperature: null }, lu: 1000.5 }, { s: 'rainy', lu: '2000' },
    { state: 'sunny', attributes: { temperature: 50, temperature_unit: '°F' }, last_updated: '2026-11-11T12:00:00.123456+00:00' }]));
  assert.deepEqual(rows.map((r) => [r.t, r.c, r.T === null ? null : Math.round(r.T)]), [[1000500, 'snowy', null], [2000000, 'rainy', null], [NOW + 123, 'sunny', 10]]);
  assert.deepEqual(plain(T.wxRows('kaputt')), []);
  assert.deepEqual(plain(T.wxLogAdd([], [{ t: NOW, c: 'cloudy', T: NaN }, { t: NOW + 60000, c: 'cloudy', T: null }], NOW + 60000)), [{ t: NOW, c: 'cloudy', T: null }]);
  // Schneefall ohne Temperatur, danach taut es wie bei 2 °C (zwölf Stunden), nicht wie bei 0 °C (ein Tag)
  const log = T.wxLogAdd([], T.wxRows([{ s: 'snowy', a: { temperature: null }, lu: (NOW - 8 * 36e5) / 1000 }, { s: 'cloudy', a: { temperature: null }, lu: (NOW - 6 * 36e5) / 1000 }]), NOW);
  assert.ok(Math.abs(T.snowDepth(log, NOW) - 0.5) < 1e-9);
});

test('Wetterverlauf: fällt die Wetter-Entität bei Schneefall aus, taut die Decke trotzdem', () => {
  const H = 36e5;
  const m = 60000;
  const t0 = NOW;
  // es schneit seit zwei Stunden, dann ist die Entität „unavailable“ und bleibt es
  const aus = T.wxLogAdd([], [{ t: t0 - 2 * H, c: 'snowy', T: -1 }, { t: t0, c: 'unavailable' }], t0);
  assert.deepEqual(plain(aus).map((r) => r.c), ['snowy', 'unavailable']);
  assert.equal(T.snowDepth(aus, t0 + 20 * m), 1); // in der Haltefrist gilt der Schneefall weiter (so zeigt ihn die Karte)
  const d31 = T.snowDepth(aus, t0 + 31 * m);
  assert.ok(d31 < 1 && d31 > 0.9, `nach 31 min ${d31}`); // danach taut es ab dem Aussetzer wie bei unbekannter Temperatur
  assert.ok(Math.abs(T.snowDepth(aus, t0 + 6 * H) - 0.5) < 1e-9);
  assert.equal(T.snowDepth(aus, t0 + 13 * H), 0);
  assert.equal(T.snowDepth(T.wxLogAdd(aus, [], t0 + 100 * H), t0 + 100 * H), 0); // früher: für immer 1
  for (let h = 0.6, vor = 1; h < 14; h += 0.2) {
    const d = T.snowDepth(aus, t0 + h * H);
    assert.ok(d <= vor);
    vor = d;
  }
  // „unknown“ zählt genauso
  assert.deepEqual(plain(T.wxLogAdd([], [{ t: t0 - H, c: 'snowy', T: -1 }, { t: t0, c: 'unknown' }], t0)).map((r) => r.c), ['snowy', 'unavailable']);
  // kurzer Aussetzer (unter WX_HOLD): mit der nächsten Meldung vergessen, es hat durchgeschneit
  const kurz = T.wxLogAdd(aus, [{ t: t0 + 20 * m, c: 'snowy', T: -1 }], t0 + 20 * m);
  assert.deepEqual(plain(kurz), [{ t: t0 - 2 * H, c: 'snowy', T: -1 }]);
  // langer Aussetzer: bleibt als Abschnitt ohne Wetter stehen, auf jedem Gerät gleich (mitgeschrieben oder aus dem Recorder)
  const lang = T.wxLogAdd(aus, [{ t: t0 + 6 * H, c: 'cloudy', T: 0 }], t0 + 6 * H);
  assert.deepEqual(plain(lang).map((r) => r.c), ['snowy', 'unavailable', 'cloudy']);
  assert.deepEqual(plain(T.wxLogAdd([], [{ t: t0 - 2 * H, c: 'snowy', T: -1 }, { t: t0, c: 'unavailable' }, { t: t0 + 6 * H, c: 'cloudy', T: 0 }], t0 + 6 * H)), plain(lang));
  assert.ok(Math.abs(T.snowDepth(lang, t0 + 12 * H) - 0.25) < 1e-9); // 6 h ohne Wetter (12 h Haltedauer), 6 h bei 0 °C (24 h)
  // Aussetzer ohne Schnee davor: Es taut weiter wie zuvor, die Decke springt weder beim Ausfall noch nach der Frist
  const warm = [{ t: t0 - 3 * H, c: 'snowy', T: -1 }, { t: t0 - 2 * H, c: 'cloudy', T: 6 }];
  const warmAus = T.wxLogAdd(warm, [{ t: t0 - H, c: 'unavailable' }], t0);
  for (const dt of [10 * m, 29 * m, 31 * m, 50 * m]) assert.ok(Math.abs(T.snowDepth(warmAus, t0 - H + dt) - T.snowDepth(warm, t0 - H + dt)) < 1e-12);
});

// Die echten Methoden _readWeather, _wxNote und _wxHist mit einem hass, dessen Recorder antwortet, scheitert oder
// hinterherhinkt. Die Uhr von HA stellt _clockUse.
const wetterKarte = (recorder) => {
  const c = Object.create(T.PikaPetCard.prototype);
  Object.assign(c, { _cfg: { weather_entity: 'weather.x', rain_min: 0.3 }, _attached: true, _wx: {}, _applyWeather() {}, _bowSync() {}, calls: 0 });
  c._hass = { states: { 'weather.x': {} }, callWS: () => { c.calls++; return recorder(); } };
  c.um = (t) => { c._clockUse = t - Date.now(); };
  return c;
};
const meldung = (state, seit, temp, upd = seit) => ({ state, last_changed: new Date(seit).toISOString(), last_updated: new Date(upd).toISOString(), attributes: { temperature: temp } });
const gleich = () => new Promise((r) => setTimeout(r, 0));

test('Wetterverlauf am Gerät: frisch geladen mit anderer Temperatur, nach dem Recorder derselbe Verlauf', async () => {
  const H = 36e5;
  const t13 = NOW;
  const tag = [[-7, 'snowy', -1], [-5, 'cloudy', 0], [-4, 'cloudy', 1], [-3, 'cloudy', 2], [-2, 'cloudy', 4], [-1, 'cloudy', 5]];
  let bis = -7;
  const rec = () => Promise.resolve({ 'weather.x': [{ s: 'cloudy', a: { temperature: 1 }, lu: (t13 - 80 * H) / 1000 },
    ...tag.filter(([h]) => h <= bis).map(([h, s, temp]) => ({ s, a: { temperature: temp }, lu: (t13 + h * H) / 1000 + 0.000789 }))] });
  // A lädt um 06:00 im Schneefall und schreibt mit
  const A = wetterKarte(rec);
  let seit = 0;
  for (const [h, s, temp] of tag) {
    if (s !== A._s) { A._s = s; seit = t13 + h * H; }
    bis = h;
    A.um(t13 + h * H);
    A._readWeather(meldung(s, seit, temp, t13 + h * H));
    await gleich();
  }
  assert.equal(A.calls, 1, 'A fragt den Recorder nur beim Laden');
  // B lädt um 13:00: 5 °C, bewölkt seit 08:00
  const B = wetterKarte(rec);
  A.um(t13);
  B.um(t13);
  B._readWeather(meldung('cloudy', t13 - 5 * H, 5, t13 - H));
  assert.deepEqual(plain(B._wxLog), [{ t: t13 - 5 * H, c: 'cloudy', T: 5 }]); // vorläufig
  assert.equal(T.snowDepth(B._wxLog, B._haNow()), 0);
  await gleich();
  assert.equal(B.calls, 1);
  assert.deepEqual(plain(B._wxLog).slice(1), plain(A._wxLog).slice(1));
  assert.deepEqual(plain(B._wxLog)[2], { t: t13 - 5 * H, c: 'cloudy', T: 0 });
  const dA = T.snowDepth(A._wxLog, A._haNow());
  assert.ok(dA > 0.3 && dA < 0.6 && Math.abs(T.snowDepth(B._wxLog, B._haNow()) - dA) < 1e-6, `A ${dA}, B ${T.snowDepth(B._wxLog, B._haNow())}`);
  // abends kühlt es ab: beide gleich, und es kommt nichts zurück
  for (const [h, temp] of [[2, 4], [5, 2], [9, 0]]) {
    for (const c of [A, B]) {
      c.um(t13 + h * H);
      c._readWeather(meldung('cloudy', t13 - 5 * H, temp, t13 + h * H));
    }
    assert.deepEqual(plain(B._wxLog).slice(1), plain(A._wxLog).slice(1));
    assert.equal(T.snowDepth(A._wxLog, A._haNow()), 0);
  }
  await gleich();
  assert.equal(A.calls + B.calls, 2, 'pünktliche Meldungen fragen den Recorder nicht noch einmal');
  assert.equal(A._errs, undefined);
  assert.equal(B._errs, undefined);
});

test('Wetterverlauf am Gerät: Recorder scheitert, wird wiederholt; nach einer Verbindungslücke wird nachgefragt', async () => {
  const H = 36e5;
  const t0 = NOW;
  const hist = [{ s: 'cloudy', a: { temperature: 1 }, lu: (t0 - 72 * H) / 1000 }];
  let kaputt = true;
  const c = wetterKarte(() => (kaputt ? Promise.reject(new Error('not_ready')) : Promise.resolve({ 'weather.x': hist })));
  c.um(t0 - 10 * H);
  const w0 = warned.length;
  c._readWeather(meldung('cloudy', t0 - 20 * H, 1));
  await gleich();
  assert.equal(c.calls, 1);
  assert.equal(warned.length, w0 + 1);
  // nicht als erledigt gemerkt: der nächste Versuch ist in einer Minute fällig, dann in 5, 15, 30, 30 …
  const inMin = () => Math.round((c._wxHistDue - Date.now()) / 60000);
  assert.equal(inMin(), 1);
  c._wxHist(); // der Takt (_tickSky) fragt nach: noch nicht fällig
  await gleich();
  assert.equal(c.calls, 1);
  for (const min of [5, 15, 30, 30]) {
    c._wxHistDue = Date.now(); // die Frist ist um
    c._wxHist();
    await gleich();
    assert.equal(inMin(), min);
  }
  assert.equal(c.calls, 5);
  assert.equal(warned.length, w0 + 1, 'gewarnt wird nur einmal');
  kaputt = false;
  c._wxHistDue = Date.now();
  c._wxHist();
  await gleich();
  assert.equal(c.calls, 6);
  assert.equal(c._wxHistDue, Infinity);
  assert.equal(c._wxHistFail, 0);
  c._wxHist();
  await gleich();
  assert.equal(c.calls, 6, 'nach dem Erfolg ohne Anlass kein weiterer Abruf');
  // WLAN zwei Stunden weg: währenddessen Schnee (t0 − 3 h bis t0 − 1 h), dann wieder bewölkt. Die erste Meldung
  // danach ist schon eine Stunde alt: Der Recorder wird neu gefragt.
  hist.push({ s: 'snowy', a: { temperature: -1 }, lu: (t0 - 3 * H) / 1000 }, { s: 'cloudy', a: { temperature: 0 }, lu: (t0 - H) / 1000 });
  c.um(t0);
  c._wxHistTry = Date.now() - 2 * H; // der letzte Abruf ist entsprechend lange her
  c._readWeather(meldung('cloudy', t0 - H, 0));
  await gleich();
  assert.equal(c.calls, 7);
  assert.deepEqual(plain(c._wxLog).map((r) => r.c), ['cloudy', 'snowy', 'cloudy']);
  assert.ok(Math.abs(T.snowDepth(c._wxLog, c._haNow()) - (1 - 1 / 24)) < 1e-6);
  // ein frisch geladenes Gerät steht genauso da
  const B = wetterKarte(() => Promise.resolve({ 'weather.x': hist }));
  B.um(t0);
  B._readWeather(meldung('cloudy', t0 - H, 0));
  await gleich();
  assert.deepEqual(plain(B._wxLog), plain(c._wxLog));
  // Verbindung kommt wieder (set hass ruft _wxHistAsk): höchstens ein Abruf je Minute
  c._wxHistAsk();
  c._wxHistAsk();
  await gleich();
  assert.equal(c.calls, 7);
  assert.equal(inMin(), 1);
  // getrennt wird nicht gefragt, der Abruf bleibt fällig
  c._wxHistDue = Date.now();
  c._hass.connected = false;
  c._wxHist();
  await gleich();
  assert.equal(c.calls, 7);
  c._hass.connected = true;
  c._wxHist();
  await gleich();
  assert.equal(c.calls, 8);
  // wieder zu sehen (_hiddenSky, _attachSky): nur wenn der letzte Abruf 15 Minuten her ist, sonst wird nichts vorgemerkt
  c._wxHistAsk(15 * 60000, false);
  await gleich();
  assert.equal(c.calls, 8);
  assert.equal(c._wxHistDue, Infinity);
  c._wxHistTry = Date.now() - 16 * 60000;
  c._wxHistAsk(15 * 60000, false);
  await gleich();
  assert.equal(c.calls, 9);
  assert.equal(c._errs, undefined);
});

test('Wetterverlauf am Gerät: Entität entfernt oder ausgefallen, die Schneedecke bleibt nicht für immer', async () => {
  const H = 36e5;
  const t0 = NOW;
  const c = wetterKarte(() => Promise.resolve({ 'weather.x': [] }));
  c.um(t0 - 2 * H);
  c._readWeather(meldung('snowy', t0 - 2 * H, -1));
  await gleich();
  c.um(t0);
  assert.equal(T.snowDepth(c._wxLog, c._haNow()), 1);
  // ausgefallen: Der Aussetzer steht im Verlauf, auch während die Karte das letzte Wetter noch hält
  c._readWeather({ state: 'unavailable', last_changed: new Date(t0).toISOString(), last_updated: new Date(t0).toISOString(), attributes: {} });
  assert.equal(c._wxRaw.cond, 'snowy'); // Haltefrist: das Wetter der Karte bleibt
  assert.deepEqual(plain(c._wxLog).map((r) => r.c), ['snowy', 'unavailable']);
  c.um(t0 + 13 * H);
  assert.equal(T.snowDepth(c._wxLog, c._haNow()), 0);
  // entfernt: kein Verlauf mehr; kommt sie wieder, wird der Recorder neu gefragt
  const n = c.calls;
  c._readWeather(undefined);
  assert.deepEqual(plain(c._wxLog), []);
  assert.equal(c._wxRaw, null);
  c._readWeather(meldung('cloudy', t0 + 12 * H, 3));
  await gleich();
  assert.equal(c.calls, n + 1);
  assert.deepEqual(plain(c._wxLog), [{ t: t0 + 12 * H, c: 'cloudy', T: 3 }]);
  // temperature: null ist „unbekannt“, nicht 0 °C (auch für kalt und Frost in _applyWeather)
  c._readWeather({ state: 'snowy-rainy', last_changed: new Date(t0 + 13 * H).toISOString(), attributes: { temperature: null, cloud_coverage: null } });
  assert.equal(c._wxRaw.temp, null);
  assert.ok(Number.isNaN(c._wxRaw.cover));
  assert.equal(c._errs, undefined);
});

test('Regenbogen: nur nach einem Schauer, bei tiefer Sonne und heiterem Himmel, 20 Minuten lang', () => {
  const now = NOW;
  const m = 60000;
  const log = [{ t: now - 40 * m, c: 'cloudy' }, { t: now - 25 * m, c: 'rainy' }, { t: now - 5 * m, c: 'partlycloudy' }];
  assert.equal(T.rainbow(log, now, 20, 40), 1);
  assert.ok(T.rainbow(log, now - 4.5 * m, 20, 40) > 0 && T.rainbow(log, now - 4.5 * m, 20, 40) < 1); // kommt gleitend
  assert.ok(T.rainbow(log, now + 12 * m, 20, 40) > 0 && T.rainbow(log, now + 12 * m, 20, 40) < 1); // geht gleitend
  assert.equal(T.rainbow(log, now + 16 * m, 20, 40), 0);
  assert.equal(T.rainbow(log, now, 50, 40), 0); // Sonne zu hoch
  assert.equal(T.rainbow(log, now, -2, 40), 0); // Sonne unter
  assert.equal(T.rainbow(log, now, 20, 80), 0); // zugezogen
  assert.equal(T.rainbow(log.slice(0, 2), now, 20, 40), 0); // es regnet noch
  assert.equal(T.rainbow([log[0], { t: now - 5 * m, c: 'sunny' }], now, 20, 5), 0); // vorher kein Regen
  assert.equal(T.rainbow([log[0], { t: now - 6 * m, c: 'rainy' }, log[2]], now, 20, 40), 0); // nur eine Minute „Regen“
  assert.equal(T.rainbow([log[0], log[1], { t: now - 5 * m, c: 'cloudy' }], now, 20, 90), 0); // danach bedeckt
  assert.equal(T.rainbow([], now, 20, 40), 0);
  assert.equal(T.rainbow(log, now, NaN, 40), 0);
});

// Der Fund: rainy → sunny (Bogen steht), drei Minuten später partlycloudy → der Bogen war weg
test('Regenbogen: bleibt stehen, wenn die Lage zwischen heiteren wechselt oder nur die Temperatur', () => {
  const now = NOW;
  const m = 60000;
  const schauer = [{ t: now - 40 * m, c: 'cloudy', T: 12 }, { t: now - 25 * m, c: 'rainy', T: 11 }, { t: now - 5 * m, c: 'sunny', T: 12 }];
  assert.equal(T.rainbow(schauer, now, 20, 5), 1);
  const danach = [...schauer, { t: now - 2 * m, c: 'partlycloudy', T: 12 }];
  assert.equal(T.rainbow(danach, now, 20, 40), 1);
  // sein Alter zählt weiter ab dem Ende des Schauers, nicht ab dem letzten Wechsel
  const hin = [...danach, { t: now + 3 * m, c: 'sunny', T: 13 }, { t: now + 6 * m, c: 'sunny', T: 14 }, { t: now + 9 * m, c: 'windy', T: 14 }];
  assert.equal(T.rainbow(hin, now + 9.5 * m, 20, 40), 1);
  assert.ok(T.rainbow(hin, now + 12 * m, 20, 40) > 0 && T.rainbow(hin, now + 12 * m, 20, 40) < 1);
  assert.equal(T.rainbow(hin, now + 15.5 * m, 20, 40), 0); // 20 Minuten nach dem Schauer ist Schluss
  // Temperatur-Stützpunkte im Schauer und davor stören nicht
  const stufen = [{ t: now - 40 * m, c: 'cloudy', T: 12 }, { t: now - 25 * m, c: 'rainy', T: 12 }, { t: now - 15 * m, c: 'rainy', T: 11 },
    { t: now - 6 * m, c: 'rainy', T: 10 }, { t: now - 5 * m, c: 'sunny', T: 10 }, { t: now - 1 * m, c: 'sunny', T: 11 }];
  assert.equal(T.rainbow(stufen, now, 20, 5), 1);
  // Regen, dann zwei Minuten Starkregen: zusammen ein Schauer von über drei Minuten
  assert.equal(T.rainbow([{ t: now - 9 * m, c: 'rainy' }, { t: now - 7 * m, c: 'pouring' }, { t: now - 5 * m, c: 'sunny' }], now, 20, 5), 1);
  // zieht es zwischendurch zu, ist er weg und kommt ohne neuen Schauer nicht wieder
  assert.equal(T.rainbow([...schauer, { t: now - 3 * m, c: 'cloudy', T: 12 }, { t: now - 1 * m, c: 'sunny', T: 12 }], now, 20, 5), 0);
  // Aussetzer der Wetter-Entität: ein kurzer zählt nicht (die Karte hält das Wetter), ein langer trennt Schauer und Sonne
  assert.equal(T.rainbow([...schauer, { t: now - 1 * m, c: 'unavailable', T: null }], now, 20, 5), 1);
  assert.equal(T.rainbow([...schauer, { t: now - 1 * m, c: 'unavailable', T: null }], now + 40 * m, 20, 5), 0);
  const lang = T.wxLogAdd([], [{ t: now - 200 * m, c: 'rainy' }, { t: now - 180 * m, c: 'unavailable' }, { t: now - 5 * m, c: 'sunny' }], now);
  assert.deepEqual(plain(lang).map((r) => r.c), ['rainy', 'unavailable', 'sunny']);
  assert.equal(T.rainbow(lang, now, 20, 5), 0);
  const kurz = T.wxLogAdd([], [{ t: now - 30 * m, c: 'rainy' }, { t: now - 10 * m, c: 'unavailable' }, { t: now - 5 * m, c: 'sunny' }], now);
  assert.equal(T.rainbow(kurz, now, 20, 5), 1);
});

test('Bedeckung: die Wetterlage setzt den Rahmen, Sterne und Mond verschwinden hinter dichten Wolken', () => {
  const W = T.WEATHER;
  assert.ok(T.wxCover(W.partlycloudy, 90) < 70, 'teils bewölkt mit 90 % wäre grauer Himmel');
  assert.ok(T.wxCover(W.sunny, 80) < 70);
  assert.equal(T.wxCover(W.partlycloudy, 40), 40); // im Rahmen zählt die gemeldete
  assert.ok(T.wxCover(W.cloudy, 30) >= 70);
  assert.equal(T.wxCover(W.cloudy, 95), 95);
  assert.equal(T.wxCover(W.sunny, NaN), 5);
  assert.equal(T.wxCover({ cover: 25 }, 88), 88); // unbekannte Lage: wie gemeldet
  assert.ok(Math.abs(T.starOp(5, false) - 0.85) < 1e-9);
  assert.ok(T.starOp(45, false) < T.starOp(5, false) && T.starOp(45, false) > T.starOp(70, false));
  assert.equal(T.starOp(80, false), 0);
  assert.equal(T.starOp(20, true), 0); // Regen, Schnee, Nebel, Gewitter
});

test('Flugzeuge: Hubschrauber darf schweben, hängengebliebene Meldung zählt nicht, kein Rückwärtsgleiten', () => {
  const jet = { aircraft_model: 'Airbus A320', altitude: 3000, ground_speed: 250, on_ground: 0 };
  assert.equal(T.flightAloft(jet), true);
  assert.equal(T.flightAloft({ ...jet, on_ground: 1 }), false);
  assert.equal(T.flightAloft({ ...jet, altitude: 0, ground_speed: 12 }), false);
  assert.equal(T.flightAloft({ ...jet, ground_speed: 5 }), false); // ein Jet steht nicht in der Luft
  const heli = { aircraft_category: 'Helicopter', aircraft_model: 'Airbus Helicopters H145', altitude: 1500, ground_speed: 0, on_ground: 0 };
  assert.equal(T.flightAloft(heli), true);
  assert.equal(T.flightAloft({ ...heli, on_ground: 1 }), false);
  assert.equal(T.flightAloft({ ...heli, altitude: 20 }), false);
  // ausgeflogen mit genau dieser Position: kommt erst mit einer neuen wieder
  const g = { lat: 50.1, lon: 8.6 };
  assert.equal(T.flightGhost(g, { latitude: 50.1, longitude: 8.6 }), true);
  assert.equal(T.flightGhost(g, { latitude: '50.1', longitude: '8.6' }), true);
  assert.equal(T.flightGhost(g, { latitude: 50.11, longitude: 8.6 }), false);
  assert.equal(T.flightGhost(undefined, { latitude: 50.1, longitude: 8.6 }), false);
  // Flug nach Osten mit 0,1 km/s: sichtbar bei e = 2, die neue Meldung liegt 0,6 km dahinter → 6 s alt
  const bahn = { e: 1.4, n: 0, ve: 0.1, vn: 0 };
  assert.ok(Math.abs(T.planeLag({ e: 2, n: 0 }, bahn) - 6) < 1e-9);
  assert.equal(T.planeLag({ e: 1, n: 0 }, bahn), 0); // die Meldung liegt voraus: nichts zu tun
  assert.ok(Math.abs(T.planeLag({ e: 2, n: 3 }, bahn) - 6) < 1e-9); // quer zur Bahn zählt nicht
  assert.equal(T.planeLag({ e: 20, n: 0 }, bahn), 30); // höchstens 30 s
  assert.equal(T.planeLag({ e: 2, n: 0 }, { e: 1.4, n: 0, ve: 0, vn: 0 }), 0); // steht: keine Richtung
  // mit dem Versatz liegt das nächste Ziel (5 s voraus) nie hinter dem sichtbaren Punkt
  for (const zurueck of [0.2, 0.6, 1.5, 2.9]) {
    const neu = { e: 2 - zurueck, n: 0.3, ve: 0.1, vn: 0 };
    const lag = T.planeLag({ e: 2, n: 0 }, neu);
    assert.ok(neu.e + neu.ve * (lag + 5) >= 2, `Position ${zurueck} km zurück`);
  }
});

// Der Fund: Ein bremsender Anflug baut bei jeder Meldung Versatz auf. Hing das Ausaltern an derselben Uhr wie die
// Bahn, galt er nach einer einzigen ausgebliebenen Position als ausgeflogen und kam als neuer wieder.
test('Flugzeuge: der Versatz einer verspäteten Position verkürzt die Frist von 75 s nicht', () => {
  const kn = 1.852 / 3600; // km/s je Knoten
  const tempo = [250, 235, 220, 205, 190, 175, 160, 150, 140, 140];
  const t0 = NOW;
  // Meldung alle 30 s, nach Osten; zwischen den Meldungen rechnet die Karte mit dem gemeldeten Tempo weiter
  let echt = 0;
  let p = { e: 0, n: 0, ve: tempo[0] * kn, vn: 0, ...T.planeClock(null, { e: 0, n: 0, ve: tempo[0] * kn, vn: 0 }, t0, t0) };
  assert.equal(p.t0, t0); // neu: kein sichtbarer Punkt, kein Versatz
  assert.equal(p.tm, t0);
  let lag = 0;
  for (let k = 1; k < tempo.length; k++) {
    const now = t0 + k * 30000;
    echt += ((tempo[k - 1] + tempo[k]) / 2) * kn * 30;
    const nxt = { e: echt, n: 0, ve: tempo[k] * kn, vn: 0 };
    const sichtbar = p.e + p.ve * ((now - p.t0) / 1000);
    const uhr = T.planeClock(p, nxt, now, now);
    p = { ...nxt, ...uhr };
    assert.equal(p.tm, now); // die Meldezeit bleibt die Meldezeit
    lag = (p.tm - p.t0) / 1000;
    assert.ok(lag >= 0 && lag <= 30);
    // die Bahn setzt am sichtbaren Punkt an: kein Schritt zurück
    assert.ok(p.e + p.ve * ((now - p.t0) / 1000) >= sichtbar - 1e-6, `Meldung ${k} wirft ihn zurück`);
  }
  assert.ok(lag > 8, `der Anflug hat nur ${lag.toFixed(1)} s Versatz aufgebaut`);
  // die nächste Position bleibt einmal aus: 70 s nach der letzten Meldung steht er noch am Himmel
  const spaet = p.tm + 70000;
  assert.ok((spaet - p.t0) / 1000 > T.PLANE_OLD, 'die Uhr der Bahn wäre schon über die Frist');
  assert.equal(T.planeStale(p, spaet), false);
  assert.equal(T.planeStale(p, p.tm + 74000), false);
  assert.equal(T.planeStale(p, p.tm + 76000), true); // wirklich 75 s ohne neue Position: ausgeflogen
  assert.equal(T.planeStale({ t0: t0 }, t0 + 76000), true); // Flieger ohne tm (aus einer älteren Sitzung): die Bahn-Uhr gilt
  // Karte war fünf Minuten unsichtbar: Die alte Meldung ist längst ausgealtert, es gibt keinen sichtbaren Punkt zu
  // schützen. Die neue Position gilt, wie sie ist (früher bis zu 30 s Versatz nach vorn).
  const now = p.tm + 300000;
  const neu = { e: p.e + p.ve * 290, n: 0, ve: p.ve, vn: 0 }; // zehn Sekunden hinter der hochgerechneten alten Bahn
  assert.deepEqual(plain(T.planeClock(p, neu, now, now)), { tm: now, t0: now });
  // dieselbe Lage ohne Pause (Position zehn Sekunden zurück): Versatz
  const kurz = p.tm + 30000;
  const uhr = T.planeClock(p, { e: p.e + p.ve * ((kurz - p.t0) / 1000 - 10), n: 0, ve: p.ve, vn: 0 }, kurz, kurz);
  assert.ok(Math.abs((uhr.tm - uhr.t0) / 1000 - 10) < 1e-6);
  // gerade versetzt oder neu (kein Punkt im Bild): ohne p kein Versatz
  assert.deepEqual(plain(T.planeClock(null, neu, kurz, kurz - 2000)), { tm: kurz - 2000, t0: kurz - 2000 });
});

test('Areal alpin: die Wintersonne steht über dem Grat, sonst bleibt der Himmel, wie er war', () => {
  // Mittag am 21. 12. auf 50° Nord: 16,5° hoch im Süden. Der Grat liegt dort bei 30 bis 35 % von oben.
  const flach = T.skyPos(180, 16.5);
  const alpin = T.skyPos(180, 16.5, false, true);
  assert.ok(Math.abs(flach.y - (56 - (16.5 / 62) * 47)) < 1e-9);
  assert.ok(flach.y > 40 && alpin.y < 26, `flach ${flach.y}, alpin ${alpin.y}`);
  assert.equal(alpin.x, flach.x);
  // Horizont und Scheitel sind dieselben, dazwischen steigt sie ohne Sprung und ohne Umkehr
  assert.equal(T.skyPos(180, 0, false, true).y, T.skyPos(180, 0).y);
  assert.ok(Math.abs(T.skyPos(180, 62, false, true).y - T.skyPos(180, 62).y) < 1e-9);
  assert.equal(T.skyPos(180, -6, false, true).y, T.skyPos(180, -6).y);
  for (let a = -11.5, vor = T.skyPos(180, -12, false, true).y; a <= 62; a += 0.5) {
    const y = T.skyPos(180, a, false, true).y;
    assert.ok(y <= vor && vor - y < 2.5, `Sprung bei ${a}°`);
    vor = y;
  }
});
