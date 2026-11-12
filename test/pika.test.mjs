// Tests für die reinen Funktionen der Karte: node --test
// Die Karte ist eine einzige Browser-Datei. Hier wird sie mit ein paar Attrappen (window, document, customElements)
// in node geladen; über globalThis.__pikaTest gibt sie ihre reinen Funktionen und die Klasse heraus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
// src ist das gebaute Bündel, so wie es ausgeliefert wird (esbuild druckt Strings mit doppelten Anführungszeichen und
// die obere Ebene mit var). quell sind die Module unter src/ hintereinander, so wie sie geschrieben sind: Tests, die
// im Quelltext nach JS-Schreibweise suchen, lesen dort. Dass beides zusammenpasst, prüft test/bau.test.mjs.
const quell = fs.readdirSync(new URL('../src/', import.meta.url), { recursive: true }).map(String).filter((f) => f.endsWith('.js')).sort()
  .map((f) => fs.readFileSync(new URL(`../src/${f.replaceAll('\\', '/')}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).join('\n');
let T = null;
const warned = [];
const leise = []; // console.debug
// document der Karte: Tests mit Attrappen hängen hier ihr createElement ein (siehe Att)
const DOK = { hidden: false, addEventListener() {}, removeEventListener() {} };
// Zeitgeber, die die Karte stellt, werden gezählt (für „ohne chronicle_entity kein zusätzlicher Zeitgeber“)
let zeitgeber = 0;
const abgeraeumt = new WeakSet(); // … und die sie wieder abräumt
// Die Welt der Karte. localStorage gibt es darin nicht (jeder Zugriff wirft, wie in einem gesperrten Browser);
// ein Test, der den Speicher braucht, hängt für seine Dauer einen ein (mitSpeicher).
const WELT = {
  window: { matchMedia: () => ({ matches: false }), customCards: [] },
  document: DOK,
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn: (...a) => warned.push(a), debug: (...a) => leise.push(a) },
  setTimeout: (...a) => {
    zeitgeber++;
    return setTimeout(...a);
  },
  clearTimeout: (h) => {
    if (h && typeof h === 'object') abgeraeumt.add(h);
    return clearTimeout(h);
  },
  setInterval, clearInterval, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController,
  __pikaTest: (x) => (T = x),
};
vm.runInNewContext(src, WELT, { filename: 'pika-pet-card.js' });

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

// ---------- 0.32 Sauberer Auftritt ----------

test('Häufchen: Kleinigkeiten bricht es ab, eine Beschäftigung wartet es ab, zu alt liegt es einfach da', () => {
  const jung = 20000;
  assert.equal(T.poopWhen(jung, null), 'go');
  for (const a of ['idle', 'look', 'wander', 'groom', 'lookout']) assert.equal(T.poopWhen(jung, a), 'go', a);
  // bisher brach es Malen, Musik, Seilspringen und Auspacken ab (gesperrt waren nur fünf Aktionen)
  for (const a of ['paint', 'music', 'rope', 'weights', 'read', 'sport', 'giftOpen', 'eatFood', 'coffee', 'chaseFriend', 'wakeUp', 'greet']) {
    assert.equal(T.poopWhen(jung, a), 'wait', a);
  }
  // eine schon anstehende Aktion (Berührung, Vorschau-Knopf) geht ebenfalls vor
  assert.equal(T.poopWhen(jung, 'idle', true), 'wait');
  // geht er schlafen oder ist es älter als POOP.live Minuten, liegt es ohne Vorführung da
  assert.equal(T.poopWhen(jung, 'goSleep'), 'lay');
  assert.equal(T.poopWhen(T.POOP.live * 6e4, 'idle'), 'lay');
  assert.equal(T.poopWhen(T.POOP.live * 6e4 - 1, 'paint'), 'wait');
  // die längste Beschäftigung (Fernsehen, gut zwei Minuten) passt in die Frist
  const lang = Math.max(...['read', 'game', 'tablet', 'kite', 'tv', 'music', 'paint', 'bubbles'].map((a) => T.ACT_LEN[a](() => 1)));
  assert.ok(lang + T.ACT_WALK + 15000 < T.POOP.live * 6e4, `längste Beschäftigung ${lang} ms`);
});

test('Hinlaufen: Tempo aus der Strecke, auf breiten Karten pünktlich, nie langsamer als bisher', () => {
  const dauer = (dist, pW, v) => dist / (pW * 0.85 * v);
  // Karte 1000 × 200: Pika 96 px breit, 700 px Weg, fünf Sekunden Zeit. Mit Tempo 0,8 waren es 10,7 s.
  assert.ok(dauer(700, 96, 0.8) > 10);
  const v = T.walkSpeed(700, 96, T.ACT_WALK, 0.8);
  assert.ok(Math.abs(dauer(700, 96, v) - 5) < 1e-9, `Tempo ${v}`);
  // Karte 600 × 248: 150 px Weg schafft er mit dem alten Tempo, es bleibt dabei
  assert.equal(T.walkSpeed(150, 119, T.ACT_WALK, 0.8), 0.8);
  assert.equal(T.walkSpeed(150, 119, T.ACT_WALK, 0.9), 0.9);
  // zu weit für die Zeit: so schnell wie erlaubt, nie schneller
  assert.equal(T.walkSpeed(5000, 96, T.ACT_WALK, 0.8), T.WALK_MAX);
  assert.equal(T.walkSpeed(5000, 96, 1000, 0.8), T.WALK_MAX);
});

test('Hinlaufen: beim Wiedereinstieg kurze Wege im Grundtempo, weite zügig, aber ohne große Hopser', () => {
  const dauer = (dist, pW, v) => (dist / (pW * 0.85 * v)) * 1000;
  // Die Beschäftigung läuft schon (nach dem Füttern, einer Aufgabe des Haus-Boten): bisher immer Höchsttempo
  for (const ms of [0, -1, -3000, -60000]) {
    assert.equal(T.walkSpeed(10, 119, ms, 0.8), 0.8, `10 px, ${ms} ms`);
    assert.equal(T.walkSpeed(150, 119, ms, 0.9), 0.9, `150 px, ${ms} ms`);
    // was er im Grundtempo in WALK_LATE schafft, geht er im Grundtempo
    const nah = 119 * 0.85 * 0.8 * (T.WALK_LATE / 1000);
    assert.equal(T.walkSpeed(nah - 1, 119, ms, 0.8), 0.8);
    // weiter weg: so, dass er nach WALK_LATE da ist
    const v = T.walkSpeed(250, 119, ms, 0.8);
    assert.ok(v > 0.8 && v < T.WALK_REJOIN && Math.abs(dauer(250, 119, v) - T.WALK_LATE) < 1e-6, `Tempo ${v}`);
    // ganz weit: gedeckelt, unter der Schwelle der großen Hopser (1,8 in _walkTo)
    assert.equal(T.walkSpeed(900, 96, ms, 0.8), T.WALK_REJOIN);
  }
  assert.ok(T.WALK_REJOIN < 1.8 && T.WALK_REJOIN < T.WALK_MAX);
  // knapp vor dem Beginn (noch 300 ms): kein Sprint für ein paar Pixel, der Weg bekommt WALK_LATE
  assert.equal(T.walkSpeed(100, 119, 300, 0.8), 0.8);
  // Unsinn hält er aus
  assert.equal(T.walkSpeed(0, 96, 5000, 0.8), 0.8);
  assert.equal(T.walkSpeed(100, 96, NaN, 0.8), 0.8);
  assert.equal(T.walkSpeed(0, 0, 5000, 0.8), 0.8);
});

test('Hopser: ein Weg dauert ganze Hopser, die Dauern stimmen mit den Animationen überein', () => {
  for (const [gait, ms] of Object.entries(T.HOP_MS)) {
    for (const d of [10, 130, 500, 777, 5049, 12345]) {
      const r = T.hopRound(d, ms);
      assert.equal(r % ms, 0, `${gait} ${d}`);
      assert.ok(r >= ms && (r === ms || Math.abs(r - d) <= ms / 2), `${gait} ${d} → ${r}`);
    }
  }
  // dieselben Dauern stehen im Stil (hop, hops, hopb) und bei den Sprüngen auf der Stelle (jump, binky)
  const css = (re) => Math.round(Number(src.match(re)?.[1]) * 1000);
  assert.equal(css(/\.walking \.hop \{ animation: hop (\.\d+)s/), T.HOP_MS.hop);
  assert.equal(css(/\.walking\.trip \.hop \{ animation: hops (\.\d+)s/), T.HOP_MS.trip);
  assert.equal(css(/\.walking\.bighop \.hop \{ animation: hopb (\.\d+)s/), T.HOP_MS.bighop);
  assert.equal(css(/\.jump\.hop1 \{ animation: jump (\.\d+)s/), T.JUMPS.hop1.ms);
  assert.equal(css(/\.jump\.binky \{ animation: binky (\.\d+)s/), T.JUMPS.binky.ms);
});

test('Sprung: ein neuer beginnt nicht, solange der letzte in der Luft ist', () => {
  assert.equal(T.jumpBusy('hop1', 0), false); // noch am Boden (Anlauf): darf neu beginnen
  assert.equal(T.jumpBusy('hop1', 200), true);
  assert.equal(T.jumpBusy('hop1', 449), true);
  assert.equal(T.jumpBusy('hop1', 450), false); // gelandet
  assert.equal(T.jumpBusy('binky', 500), true);
  assert.equal(T.jumpBusy('binky', 740), false);
  assert.equal(T.jumpBusy('unbekannt', 200), false);
});

test('Einsteigen ohne Hinlaufen: nur frisch geladen oder im selben Augenblick wie das Sichtbarwerden', () => {
  const lange = 60000; // die Beschäftigung läuft seit einer Minute
  assert.equal(T.jumpInOk(lange, 50, false), true); // Bildschirm an, Stand frisch: steht sofort dort
  assert.equal(T.jumpInOk(lange, 1500, false), false); // hat erst auf den Stand gewartet: hoppelt hin
  assert.equal(T.jumpInOk(lange, 2300, false), false); // ist eben erst aufgewacht
  assert.equal(T.jumpInOk(lange, 1500, true), true); // frisch geladen: die Seite baut sich noch auf
  assert.equal(T.jumpInOk(lange, T.JUMP_IN.first + 1, true), false);
  assert.equal(T.jumpInOk(3000, 50, true), false); // eben erst begonnen: er läuft ganz normal hin
});

test('Plan unbekannt: die Schleife wartet kurz, statt zu grüßen, aber nicht ewig', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { plan_entity: 'input_text.pika_plan' };
  c._planOk = false;
  c._blindAt = Date.now();
  assert.equal(c._planWait(), true); // Helfer noch nicht gelesen
  c._planOk = true;
  assert.equal(c._planWait(), false);
  c._planStale = true; // nach langer Pause veraltet
  assert.equal(c._planWait(), true);
  c._blindAt = Date.now() - T.JUMP_IN.first - 100; // keine Verbindung: er lebt trotzdem weiter
  assert.equal(c._planWait(), false);
  c._cfg = {};
  c._planStale = false;
  c._planOk = false; // ohne Helfer gibt es nichts abzuwarten
  c._blindAt = Date.now();
  assert.equal(c._planWait(), false);
});

// Eine Karte, deren Schleife von Hand Schritt für Schritt läuft: _run merkt sich nur, was gewählt wurde
const schrittKarte = (mehr = {}) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const ran = [];
  Object.assign(c, {
    _cfg: {}, _g: {}, _foods: [], _lift: 0, _asleep: false, _inside: false, _running: true, _wx: {}, _blindAt: Date.now(), _dbgShift: 0,
    _coffeeDue: () => false, _sleepTime: () => false, _slotArm() {}, _slotNow: () => null, _friendUrgent: () => null,
    _run(name) {
      ran.push(name);
      this._action = name;
      return this._wait(30);
    },
  }, mehr);
  c._ac = new AbortController();
  return [c, ran];
};
const schritt = (c) => {
  c._ac = new AbortController();
  return c._step().then(() => 'fertig', (e) => `abgebrochen (${e.constructor.name})`);
};

test('Plan unbekannt: der frische Stand weckt nur die wartende Schleife, er bricht keine fremde Aktion ab', async () => {
  // Die Schleife wartet auf den Plan: Kommt der frische Stand, geht es sofort weiter
  {
    const [c, ran] = schrittKarte({ _planStale: true });
    const p = schritt(c);
    assert.equal(c._planWaiting, true);
    c._planFresh();
    assert.equal(await p, 'abgebrochen (Cancel)');
    assert.deepEqual(ran, []);
  }
  // a) Schritt 1 wartet. In der Wartezeit wird ein Kaffee fällig, Schritt 2 holt ihn: Der frische Stand bricht ihn nicht ab
  {
    let kaffee = false;
    const [c, ran] = schrittKarte({ _planStale: true, _coffeeDue: () => kaffee });
    assert.equal(await schritt(c), 'fertig');
    assert.equal(c._planWaiting, true);
    kaffee = true;
    const p = schritt(c);
    assert.deepEqual(ran, ['coffee']);
    assert.equal(c._planWaiting, false);
    c._planFresh();
    assert.equal(await p, 'fertig');
  }
  // dasselbe, wenn der Helfer des Tagesplans erst jetzt gelesen ist (_planReady)
  {
    let kaffee = false;
    const [c, ran] = schrittKarte({ _cfg: { plan_entity: 'input_text.pika_plan' }, _planOk: false, _planCompose() {}, _coffeeDue: () => kaffee });
    assert.equal(await schritt(c), 'fertig');
    assert.equal(c._planWaiting, true);
    kaffee = true;
    const p = schritt(c);
    c._planReady();
    assert.equal(await p, 'fertig');
    assert.deepEqual(ran, ['coffee']);
  }
  // b) App nach langer Pause geöffnet und gleich wieder geschlossen (_stop); am nächsten Morgen wacht er auf
  {
    const [c, ran] = schrittKarte({ _planStale: true });
    assert.equal(await schritt(c), 'fertig');
    assert.equal(c._planWaiting, true);
    c._stop();
    assert.equal(c._planWaiting, false);
    Object.assign(c, { _running: true, _asleep: true, _planStale: true });
    const p = schritt(c);
    assert.deepEqual(ran, ['wakeUp']);
    c._planFresh();
    assert.equal(await p, 'fertig');
  }
  // ein von den Festen eingeschobener Schritt (_festForce ersetzt _step einmal) wartet ebenfalls nicht
  {
    const [c, ran] = schrittKarte({ _planStale: true });
    assert.equal(await schritt(c), 'fertig');
    c._festForce('festConfetti');
    const p = schritt(c);
    assert.deepEqual(ran, ['festConfetti']);
    c._planFresh();
    assert.equal(await p, 'fertig');
  }
});

test('Geräteuhr zurückgestellt: die Schleife wartet nicht, bis die Uhr den alten Stand wieder erreicht', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = {};
  c._planStale = true;
  c._blindAt = Date.now() + 3600000; // gesetzt, bevor die Uhr eine Stunde zurückging
  assert.ok(c._sinceBlind() < 0);
  assert.equal(c._planWait(), false);
  assert.equal(c._jumpIn({ k: 1, start: -1e9 }), false);
});

test('Häufchen: ein zurückgehaltenes wird nicht Stunden später vorgeführt, und es zählt erst, wenn es daliegt', async () => {
  const now = Date.now();
  const alt = { k: 0, due: now - 5 * 36e5, r: 0.5, slot: 0 };
  const neu = { k: 1, due: now - 30000, r: 0.5, slot: 1 };
  const stand = { piles: [alt, neu], clean: T.poopClean([alt, neu], now) };
  const karte = (mehr) => {
    const gelegt = [];
    const [c, ran] = schrittKarte({
      _stats: {}, _pileEls: new Map(), _giftDue: () => 'giftCatch', _raw: () => 100,
      _poops: () => stand,
      _pileKey: (p) => `k${p.k}`,
      _addPile(p, key) {
        gelegt.push(key);
        this._pileEls.set(key, {});
      },
      ...mehr,
    });
    c._pileEls.set('k0', {});
    return [c, ran, gelegt];
  };
  // frisch fällig, er war beschäftigt: jetzt macht er es vor den Augen
  {
    const [c, ran, gelegt] = karte({ _poopPending: { ...neu, key: 'k1' } });
    assert.equal(await schritt(c), 'fertig');
    assert.deepEqual(ran, ['poop']);
    assert.deepEqual(gelegt, []);
  }
  // a) seit zwei Stunden fällig (die Karte war so lange weg): Es liegt einfach da, er macht weiter
  {
    const [c, ran, gelegt] = karte({ _poopPending: { ...neu, due: now - 2 * 36e5, key: 'k1' } });
    assert.equal(await schritt(c), 'fertig');
    assert.deepEqual(ran, ['giftCatch']);
    assert.deepEqual(gelegt, ['k1']);
    assert.equal(c._poopPending, null);
  }
  // die Schleife hält an (Bildschirm aus, Ansicht gewechselt): Es wird nichts Altes mitgeschleppt
  {
    const [c, , gelegt] = karte({ _poopPending: { ...neu, key: 'k1' }, _next: 'poop', _el: {}, _pressFx() {}, _cleanup() {} });
    c._stop();
    assert.deepEqual(gelegt, ['k1']);
    assert.equal(c._poopPending, null);
    assert.equal(c._next, null);
  }
  // b) Solange es zurückgehalten wird, ist es nicht zu sehen: Es zählt hier noch nicht bei Sauberkeit und Glück
  {
    const [c] = karte({ _poopPending: { ...neu, key: 'k1' } });
    const alle = c._poops();
    const sicht = c._poopsSeen();
    assert.deepEqual(sicht.piles.map((p) => p.k), [0]);
    assert.ok(sicht.clean - alle.clean >= 10, `${sicht.clean} / ${alle.clean}`);
    assert.ok(Math.abs(c._get('g') - (60 + 0.4 * sicht.clean)) < 1e-3);
    assert.equal(alle.piles.length, 2); // der geteilte Stand bleibt, wie er ist
    c._layPending();
    assert.equal(c._poopsSeen(), c._poops()); // liegt es da, zählt es
  }
  assert.equal(T.poopClean([], now), 100);
  assert.equal(T.poopClean([{ due: now }], now), 90);
  assert.equal(T.poopClean(Array.from({ length: 8 }, () => ({ due: now - 30 * 36e5 })), now), 0);
});

test('Pino: wird die Uhr nach seiner Ankunft gestellt, geht er trotzdem zur Zeit aus dem Besuchsplan', async () => {
  const c = Object.create(T.PikaPetCard.prototype);
  let weg = 0;
  c._friendLeave = () => weg++;
  const fr = { planned: true, leaving: false };
  c._fr = fr;
  const ende = Date.now() + 60000;
  c._friendUntil(fr, ende);
  // die Uhr von HA ist 20 s weiter, als das Gerät bei seiner Ankunft annahm: Er geht 20 s früher
  c._clockMoved(20000);
  assert.equal(fr.until, ende - 20000);
  c._clockMoved(-5000);
  assert.equal(fr.until, ende - 15000);
  // ein Besuch aus der Vorschau hat eine feste Dauer; im Gehen wird nichts mehr gestellt
  fr.planned = false;
  c._clockMoved(5000);
  fr.planned = true;
  fr.leaving = true;
  c._clockMoved(5000);
  assert.equal(fr.until, ende - 15000);
  // die Zeit ist nach der neuen Uhr schon um: Er geht gleich
  fr.leaving = false;
  c._clockMoved(60000);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(weg, 1);
  clearTimeout(fr.untilT);
  // die Uhr meldet, um wie viel sie gestellt wurde
  const d = Object.create(T.PikaPetCard.prototype);
  const um = [];
  d._clockMoved = (by) => um.push(by);
  const t = Date.now();
  d._clockSample(t + 20000, t);
  d._clockSample(t + 20100, t); // unter der Schwelle: bleibt
  d._clockSample(t + 23000, t);
  assert.deepEqual(um, [20000, 3000]);
});

test('Drachen: die Schnur beginnt an der Pfote, auch wenn er sich gegen den Zug lehnt', () => {
  const [pW, pH] = [120, 100];
  assert.deepEqual(plain(T.kitePaw(pW, pH, 0)), [45, -50]); // viewBox 105/50, ab der Mitte der Unterkante
  // dieselbe Rechnung wie der Stil: rotate(−a) scale(sx, sy) um die Füße
  const css = (deg, sx = 1, sy = 1) => {
    const a = (-deg * Math.PI) / 180;
    const [x, y] = [45 * sx, -50 * sy];
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  };
  const L = T.KITE_LEAN;
  const ruhe = T.kitePaw(pW, pH, L.rest);
  const ruck = T.kitePaw(pW, pH, L.tug, L.sx, L.sy);
  for (const [ist, soll] of [[ruhe, css(L.rest)], [ruck, css(L.tug, L.sx, L.sy)]]) {
    assert.ok(Math.abs(ist[0] - soll[0]) < 1e-9 && Math.abs(ist[1] - soll[1]) < 1e-9);
  }
  // gegen den Zug: nach hinten und etwas nach oben, beim Ruck weiter
  assert.ok(ruhe[0] < 45 && ruhe[1] < -50 && ruck[0] < ruhe[0] && ruck[1] < ruhe[1]);
  // der Stil lehnt ihn um dieselben Winkel
  assert.ok(src.includes('.kiting .hop { transform: rotate(-${KITE_LEAN.rest}deg)'));
  assert.ok(src.includes('.kiting.ktug .hop { transform: rotate(-${KITE_LEAN.tug}deg) scale(${KITE_LEAN.sx}, ${KITE_LEAN.sy})'));
});

test('Ohren: das Nachschwingen am Sprung kommt zur Haltung dazu und verdrängt keine andere Ohr-Regel', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  const liste = [];
  const ohr = (seite) => ({
    classList: { contains: (k) => k === `ear-${seite}` },
    animate(frames, opt) {
      const a = { frames, opt, aus: false, cancel() { this.aus = true; } };
      liste.push(a);
      return a;
    },
  });
  const kl = new Set();
  const root = { classList: { contains: (k) => kl.has(k) }, querySelectorAll: () => [ohr('l'), ohr('r')] };
  c._earSwing(root, 'hop1');
  assert.equal(liste.length, 2);
  const [l, r] = liste;
  // nur rotate (eigene Eigenschaft): transform bleibt den Regeln für Haltung, Flappen, Zucken und Wippen
  for (const f of l.frames) assert.deepEqual(Object.keys(f).filter((k) => !['offset', 'easing'].includes(k)), ['rotate']);
  assert.equal(l.frames[0].rotate, '0deg');
  assert.equal(l.frames.at(-1).rotate, '0deg');
  assert.equal(l.opt.duration, T.EAR_SWING.hop1.ms);
  assert.equal(r.opt.delay - l.opt.delay, 50);
  // bei der Landung (JUMPS.air[1]) schlagen die Ohren nach vorn: der größte Ausschlag liegt dort
  for (const kind of ['hop1', 'binky']) {
    const S = T.EAR_SWING[kind];
    const [wann] = S.k.reduce((m, k) => (k[1] > m[1] ? k : m));
    assert.ok(Math.abs(wann * S.ms - T.JUMPS[kind].air[1]) < 60, kind);
    assert.ok(S.k.every(([o], i) => o > 0 && o < 1 && (i === 0 || o > S.k[i - 1][0])), kind);
  }
  // ein neuer Sprung beendet das alte Schwingen; im Hoppeln (da wippen sie schon) gibt es keins
  c._earSwing(root, 'binky');
  assert.ok(l.aus && r.aus);
  assert.equal(liste.length, 4);
  kl.add('walking');
  c._earSwing(root, 'hop1');
  assert.equal(liste.length, 4);
  assert.ok(liste[2].aus && liste[3].aus);
  // der Stil setzt am Sprung keine Ohr-Animation mehr (sie schlug jede andere Regel)
  assert.doesNotMatch(src, /\.jump\.(hop1|binky) \.ear/);
});

test('Fangen: der Läufer rennt vom Fänger weg, nur ohne Platz an ihm vorbei', () => {
  const [lo, hi, pW] = [150, 550, 100];
  // Läufer links vom Fänger, beide in der linken Hälfte: bisher rannte er nach rechts durch den Fänger
  assert.equal(T.chaseFar(250, 300, lo, hi, pW), false);
  assert.equal(T.chaseFar(350, 300, lo, hi, pW), true);
  assert.equal(T.chaseFar(400, 450, lo, hi, pW), false);
  // am Rand kein Platz: auf die andere Seite
  assert.equal(T.chaseFar(180, 300, lo, hi, pW), true);
  assert.equal(T.chaseFar(520, 400, lo, hi, pW), false);
  // spätere Runden: Der neue Läufer steht hinter dem alten (der am Rand ankam) und rennt zurück
  assert.equal(T.chaseFar(430, 500, lo, hi, pW), false);
  // stehen beide gleich: zur Seite mit mehr Platz
  assert.equal(T.chaseFar(200, 200, lo, hi, pW), true);
});

test('Feste: Mitternacht und „Helau!“ kommen nach der Uhr, der Takt stellt nur den Wecker', () => {
  const y = 2026;
  const M = T.festMoments(new Date(y, 11, 31, 23, 59, 40).getTime());
  assert.equal(M.mid, new Date(y + 1, 0, 1).getTime());
  assert.equal(T.festMoments(new Date(y, 10, 11, 11, 10, 50).getTime()).helau, new Date(y, 10, 11, 11, 11).getTime());
  assert.ok(T.FEST_AHEAD > 2 * 20000, 'jede Phase des 20-Sekunden-Takts muss den Wecker rechtzeitig stellen');
  // Zwei Geräte, deren Takt 13 s auseinanderliegt, stellen den Wecker auf denselben Augenblick
  const wecker = (jetzt) => {
    const c = Object.create(T.PikaPetCard.prototype);
    const gestellt = [];
    c._festNow = () => jetzt;
    c._festLater = (fn, ms) => gestellt.push(jetzt + ms);
    c._festArm();
    c._festArm(); // der nächste Takt stellt ihn nicht noch einmal
    return gestellt;
  };
  const a = wecker(M.mid - 19000);
  const b = wecker(M.mid - 6000);
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
  assert.ok(a[0] >= M.mid && a[0] - M.mid < 100);
  assert.equal(wecker(M.mid - T.FEST_AHEAD - 1000).length, 0); // noch zu früh
  assert.equal(wecker(new Date(y, 5, 1).getTime()).length, 0);
});

test('Feste: die Halloween-Nacht endet am Morgen, nicht um Mitternacht', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { festive: true };
  const am = (...d) => c._festToday(new Date(2026, ...d).getTime());
  assert.equal(am(9, 31, 23, 30).witch, true);
  const nacht = am(10, 1, 3, 0);
  assert.equal(nacht.halloween, true);
  assert.equal(nacht.witch, true);
  const morgen = am(10, 1, 6, 0);
  assert.equal(morgen.halloween, undefined);
  assert.equal(morgen.witch, undefined);
  assert.equal(am(9, 23, 12, 0).halloween, undefined);
  assert.equal(am(9, 24, 12, 0).halloween, true);
});

test('Requisiten: hervorkramen und wegräumen über .kram und .stow, beim Abbruch sind sie sofort weg', async () => {
  const kl = new Set();
  const folge = [];
  const merke = () => folge.push([...kl].sort().join(' '));
  const pika = {
    classList: {
      add: (...k) => (k.forEach((x) => kl.add(x)), merke()),
      remove: (...k) => (k.forEach((x) => kl.delete(x)), merke()),
      contains: (k) => kl.has(k),
    },
  };
  const c = Object.create(T.PikaPetCard.prototype);
  c._el = { pika };
  c._ac = new AbortController();
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  // hervorkramen: Requisit und .kram zugleich, .kram geht nach der Animation von selbst
  c._propOn('reading');
  assert.equal(folge.at(-1), 'kram reading');
  await warte(T.KRAM.in + 120);
  assert.equal(folge.at(-1), 'reading');
  // wegräumen: erst .stow (das Requisit ist noch da), nach KRAM.out alles weg; was nicht da war (doze), stört nicht
  kl.add('doze');
  const t0 = Date.now();
  const p = c._propOff('reading', 'doze');
  assert.equal(folge.at(-1), 'doze reading stow');
  await p;
  assert.ok(Date.now() - t0 >= T.KRAM.out - 20);
  assert.equal(folge.at(-1), '');
  // nichts in der Hand: nichts zu tun, auch kein .stow
  const n = folge.length;
  await c._propOff('music');
  assert.equal(folge.length, n);
  // gleich nach dem Hervorkramen wieder weg: .kram und .stow liegen nie zugleich an, der Zeitgeber von .kram ist gelöscht
  c._propOn('gaming');
  const q = c._propOff('gaming');
  assert.equal(folge.at(-1), 'gaming stow');
  // Abbruch mitten im Wegräumen (Regen, Schlafenszeit): sofort weg, der Abbruch läuft weiter nach oben
  c._ac.abort();
  await assert.rejects(q, (e) => e.constructor.name === 'Cancel');
  assert.equal(folge.at(-1), '');
  await warte(T.KRAM.in + 120);
  assert.equal(folge.at(-1), '');
  assert.ok(folge.every((f) => !(f.includes('kram') && f.includes('stow'))));
  // hervorkramen direkt nach einem Wegräumen nimmt .stow wieder ab
  kl.add('stow');
  c._propOn('lifting', 'lift-gnd');
  assert.equal(folge.at(-1), 'kram lift-gnd lifting');
  clearTimeout(c._kramT);
  // jede Klasse, mit der eine Beschäftigung ihr Requisit zeigt, räumt das Aufräumen der Schleife ab (_cleanup)
  const gezeigt = [...quell.matchAll(/this\._propOn\(([^)]*)\)/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/'/g, '')));
  assert.ok(gezeigt.length >= 9);
  const raeumt = quell.match(/const all = \['walking'([\s\S]*?)\];/)[1] + quell.match(/const ACT_CLS = \[([\s\S]*?)\];/)[1];
  for (const k of [...gezeigt, 'kram', 'stow']) assert.ok(raeumt.includes(`'${k}'`), k);
});

// ---------- Kleine Beschäftigungen ab 0.32 ----------

const LAGE = { wet: false, rain: 0, storm: false, shelter: false, snowcover: false, cold: false, wind: 10, hayFull: false, winter: false };
const TROCKEN = ['rope', 'weights', 'gather', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider'];
const SCHNEE = ['weights', 'hula', 'yoyo', 'purzel', 'juggle', 'glider', 'snowpika'];
// Die Kette mit den festen Zahlen der Karte (wie _miniAct); has: in welchen Fenstern es eine kleine gibt
const kette = (m, L, has = () => true) => T.miniChain(m, { ...LAGE, ...L }, has, (j) => T.seedRnd('mini', j, 2), (j) => T.seedRnd('mini', j, 3),
  (j, k) => T.seedRnd('mini', j, 4 + k));

// Attrappen für Methoden, die am DOM hängen: ein Element mit Klassen, Stil und Kindern, mehr brauchen sie nicht
class Kl {
  constructor() { this.s = new Set(); }
  add(...k) { k.forEach((x) => this.s.add(x)); }
  remove(...k) { k.forEach((x) => this.s.delete(x)); }
  toggle(k, an) { const v = an === undefined ? !this.s.has(k) : !!an; if (v) this.s.add(k); else this.s.delete(k); return v; }
  contains(k) { return this.s.has(k); }
}
class Att {
  constructor() {
    this.classList = new Kl();
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.children = [];
    this.parentElement = null;
    this.offsetLeft = 0;
    this.offsetWidth = 0;
  }
  set className(v) { this.classList = new Kl(); v.split(/\s+/).filter(Boolean).forEach((k) => this.classList.add(k)); }
  set innerHTML(v) { this.html = v; }
  appendChild(k) { k.parentElement = this; this.children.push(k); return k; }
  remove() { this.parentElement = null; }
  animate() { return { cancel() {} }; }
}
DOK.createElement = () => new Att();
// Eine Karte mit der Geometrie von _layout (W × Hs, Areal), ohne Schleife: _interrupt zählt nur mit (c.abbr)
const buehne = (W, Hs, areal = 'huegel') => {
  const c = Object.create(T.PikaPetCard.prototype);
  const scene = new Att();
  Object.assign(scene, { clientWidth: W, clientHeight: Hs });
  const leer = () => {};
  Object.assign(c, {
    _el: new Proxy({ scene }, { get: (t, k) => (t[k] ??= new Att()) }), _g: { pW: 1 }, _W: 0, _Hs: 0, _inside: true, _cfg: {}, _arealKey: areal,
    _planes: new Map(), _lift: 0, _poseName: 'out', _dir: 1, abbr: 0,
    _btnFit: leer, _setX(x) { this._x = x; }, _pose: leer, _layoutSky: leer, _layoutFest: leer, _layoutFriend: leer, _layoutBote: leer,
    _layoutGift: leer, _planeSnap: leer, _placePiles: leer, _restartCritters: leer, _flowerGiftPlace: leer, _interrupt() { this.abbr++; },
    _poops: () => ({ piles: [] }), _bote: null, _festPos: {}, _gtEls: null,
  });
  c._layout();
  c._inside = false;
  c._x = c._g.home + c._g.pW;
  return c;
};
const GROESSEN = [[600, 248], [380, 184], [340, 248], [320, 400], [1000, 200]];

test('Kleine Beschäftigungen: jede wählbare hat Methode, Länge, Wetter-Abbruch und räumt ihre Klassen ab', () => {
  assert.equal(T.MINI_ACTS.length, 14);
  const raeumt = quell.match(/const all = \['walking'([\s\S]*?)\];/)[1] + quell.match(/const ACT_CLS = \[([\s\S]*?)\];/)[1]
    + quell.match(/const CUTE_CLS = \[([\s\S]*?)\];/)[1];
  let geprueft = 0;
  for (const a of T.MINI_ACTS) {
    assert.equal(typeof T.PikaPetCard.prototype[`_${a}`], 'function', `Methode _${a}`);
    assert.ok(T.hasKey(T.ACT_LEN, a), `ACT_LEN.${a}`);
    for (const v of [0, 0.5, 0.999]) {
      const len = T.ACT_LEN[a](() => v);
      assert.ok(len >= 5000 && len <= 30000, `${a}: Hauptteil ${len} ms`);
    }
    assert.ok(T.WX_STOP.includes(a), `WX_STOP: ${a}`);
    // was die Methode dem Pika an Klassen gibt (direkt, über _propOn oder aus einer Liste in Großbuchstaben)
    const body = quell.match(new RegExp(`\\n  async _${a}\\(\\) \\{([\\s\\S]*?)\\n  \\}\\n`))[1];
    const kl = [...body.matchAll(/(?:p\.classList\.add|this\._propOn)\(([^)]*)\)|const [A-Z]+ = \[([^\]]*)\]/g)]
      .flatMap((m) => [...(m[1] || m[2]).matchAll(/'([^']+)'/g)].map((x) => x[1]));
    for (const k of kl) assert.ok(raeumt.includes(`'${k}'`), `${a}: Klasse ${k} räumt _cleanup nicht ab`);
    geprueft += kl.length;
  }
  // die Suche oben hängt an der Schreibweise des Quelltexts: Findet sie nichts mehr, prüft der Test nichts
  assert.ok(geprueft >= 50, `nur ${geprueft} Klassen gefunden`);
  // Pfütze, Schiffchen und Schnee-Pika laufen nach der Planzeit: Ein später geladenes Gerät steigt ein
  for (const a of ['puddle', 'boat', 'snowpika']) assert.equal(T.ACT_NOJOIN.has(a), false, a);
  // jedes Requisit in der Pika-Grafik, das eine Klasse einblendet, wird hervorgekramt (PROP_SEL)
  for (const s of ['.hoop', '.yo', '.pbl', '.jug', '.dchain', '.dcrown', '.pgl', '.peb', '.sboat']) {
    assert.ok(T.PROP_SEL.includes(s), s);
    assert.ok(src.includes(`class="${s.slice(1)}`), `Gruppe ${s}`);
  }
});

test('Kleine Beschäftigungen: Auswahl nach Wetter, bei Regen und Schnee das eigene Programm', () => {
  const geht = (L) => T.MINI_ACTS.filter((a) => T.miniOk(a, { ...LAGE, ...L }));
  assert.deepEqual(plain(geht({})), TROCKEN);
  assert.deepEqual(plain(geht({ wet: true, rain: 40 })), ['puddle', 'boat']);
  assert.deepEqual(plain(geht({ wet: true, rain: 95, storm: true, shelter: true })), []); // Starkregen: er bleibt im Bau
  assert.deepEqual(plain(geht({ wet: true, storm: true, shelter: true })), []); // Gewitter ohne Regen
  assert.deepEqual(plain(geht({ snowcover: true, cold: true })), SCHNEE);
  assert.deepEqual(plain(geht({ snowcover: true, wet: true, rain: 25 })), []); // Regen auf Schnee: weder Pfütze noch Schnee-Pika
  assert.equal(geht({ hayFull: true }).includes('gather'), false);
  for (const L of [{ cold: true }, { winter: true }]) assert.equal(geht(L).includes('crown'), false, JSON.stringify(L));
  assert.equal(geht({ wind: 45 }).includes('glider'), false);
  // die Windgrenze des Papierfliegers gilt auch, wenn Schnee liegt
  assert.equal(geht({ snowcover: true, cold: true, wind: 45 }).includes('glider'), false);
  assert.deepEqual(plain(geht({ snowcover: true, cold: true, wind: 45 })), SCHNEE.filter((a) => a !== 'glider'));
  assert.equal(geht({ snowcover: true, cold: true, wind: 39 }).includes('glider'), true);
  // Wie bis 0.31: Seil nur trocken und ohne Schnee, Hantel auch im Schnee, die Blüte nur, solange Platz im Vorrat ist
  assert.equal(T.miniOk('rope', { ...LAGE, snowcover: true }), false);
  assert.equal(T.miniOk('weights', { ...LAGE, snowcover: true }), true);
  // Jedes Wetter hat sein Programm; was bei einer Lage geht, steht immer in ihrem Programm
  assert.deepEqual(plain(T.MINI_PROG), { dry: TROCKEN, rain: ['puddle', 'boat'], snow: SCHNEE });
  const lagen = [{}, { wet: true, rain: 40 }, { snowcover: true }, { snowcover: true, wet: true, rain: 25 }, { wet: true, rain: 95, storm: true, shelter: true },
    { wet: true, storm: true, shelter: true }, { hayFull: true, cold: true, winter: true, wind: 50 }, { snowcover: true, wind: 50, hayFull: true }];
  assert.deepEqual(lagen.map((L) => T.miniProg({ ...LAGE, ...L })), ['dry', 'rain', 'snow', null, null, null, 'dry', 'snow']);
  for (const L of lagen) {
    const prog = T.miniProg({ ...LAGE, ...L });
    for (const a of geht(L)) assert.ok(prog && T.MINI_PROG[prog].includes(a), `${a} bei ${JSON.stringify(L)}`);
  }
  // Grundwahl: aus dem ganzen Programm, nie dieselbe wie davor
  for (let i = 0; i < 200; i++) {
    const u = i / 200;
    const a = T.miniBase('dry', null, u);
    assert.ok(TROCKEN.includes(a));
    assert.notEqual(T.miniBase('dry', a, u, (u * 7) % 1), a);
    // ein anderer Vorgänger ändert die Wahl nicht: Sie hängt nur am Fenster
    assert.equal(T.miniBase('dry', TROCKEN.find((x) => x !== a), u, 0.3), a);
    assert.ok(SCHNEE.includes(T.miniBase('snow', null, u)));
    assert.ok(['puddle', 'boat', null].includes(T.miniBase('rain', null, u)));
  }
  // Ersatz: nur was geht und weder davor noch danach dran ist; bleibt nichts übrig, keine
  const voll = { ...LAGE, hayFull: true, cold: true, wind: 50 };
  for (let i = 0; i < 200; i++) {
    const a = T.miniSwap('dry', voll, ['hula', 'yoyo', null], (k) => ((i + 1) * (k + 3) * 0.137) % 1);
    assert.ok(TROCKEN.includes(a) && !['gather', 'crown', 'glider', 'hula', 'yoyo'].includes(a), `${a}`);
  }
  assert.equal(T.miniSwap('dry', voll, TROCKEN, () => 0.4), null);
  // kein Programm: keine
  assert.equal(kette(1234, { shelter: true, wet: true, rain: 95 }), null);
  assert.equal(kette(1234, { hayFull: true, snowcover: true, wet: true, rain: 25 }), null);
  assert.equal(kette(1234, {}, (j) => j !== 1234), null); // in diesem Fenster gibt es keine kleine
});

test('Kleine Beschäftigungen: ein Schalter ändert nur die Fenster, die er trifft, und nie folgt dieselbe auf sich selbst', () => {
  // Wind ab 40 km/h ersetzt allein den Papierflieger, ein voller Vorrat allein die Blüte, Kälte allein den Kranz.
  // Alle anderen Fenster bleiben, wie sie waren (bis hierher verschob jeder Schalter ein Drittel bis die Hälfte)
  const N = 1500;
  const folge = (L) => Array.from({ length: N }, (_, i) => kette(1000 + i, L));
  const trocken = folge({});
  for (const [grund, L, weg] of [[trocken, { wind: 45 }, 'glider'], [trocken, { hayFull: true }, 'gather'], [trocken, { cold: true }, 'crown'],
    [folge({ snowcover: true }), { snowcover: true, wind: 45 }, 'glider']]) {
    const mit = folge(L);
    let n = 0;
    for (let i = 1; i < N; i++) {
      const [a, b] = [grund[i], mit[i]];
      assert.notEqual(b, weg, `Fenster ${i}`);
      if (a === weg) n++;
      else assert.equal(b, a, `Fenster ${i} bei ${JSON.stringify(L)}`);
      // springt der Schalter zwischen zwei Fenstern um (an oder aus), folgt trotzdem nie dieselbe auf sich selbst
      assert.notEqual(b, grund[i - 1], `Fenster ${i}: Schalter an`);
      assert.notEqual(a, mit[i - 1], `Fenster ${i}: Schalter aus`);
      assert.notEqual(b, mit[i - 1], `Fenster ${i}: Schalter bleibt`);
    }
    assert.ok(n > 70 && n < 300, `${weg}: ${n} Fenster betroffen`);
  }
  // ein zweiter Schalter (Winter, dazu Wind): nur Fenster, deren Grundwahl Kranz oder Flieger war, können sich ändern
  const winter = folge({ winter: true });
  const sturm = folge({ winter: true, wind: 45 });
  let anders = 0;
  for (let i = 0; i < N; i++) {
    if (winter[i] === sturm[i]) continue;
    anders++;
    assert.ok(['crown', 'glider'].includes(trocken[i]), `Fenster ${i}`);
  }
  assert.ok(anders > 70 && anders < 200, `${anders}`);
  // Die Lage kennt keinen Festtagshut: Er hängt an der Konfiguration der einzelnen Karte (festive, birthdays). Zwei
  // Dashboards wählen deshalb auch am Geburtstag dasselbe; auf dem mit Hut fällt nur der Blumenkranz aus.
  const c = Object.create(T.PikaPetCard.prototype);
  Object.assign(c, { _wx: {}, _hay: 0, _wind: 5, _seasonK: 'summer', _fest: {} });
  assert.equal('hat' in c._lage(), false);
  assert.equal(c._actOk('crown'), true);
  const m0 = Math.floor(NOW / T.ACT_WIN.mini);
  const ohne = Array.from({ length: 200 }, (_, i) => c._miniAct(m0 + i));
  for (const f of [{ birthday: { names: ['Mia'] } }, { witch: true }, { xmas: true }, { karneval: true }]) {
    c._fest = f;
    assert.equal(c._actOk('crown'), false, JSON.stringify(f));
    assert.equal(c._actOk('hula'), true);
    assert.deepEqual(Array.from({ length: 200 }, (_, i) => c._miniAct(m0 + i)), ohne);
  }
  assert.ok(ohne.includes('crown'));
});

test('Kleine Beschäftigungen: dicht an einer großen gibt es keine, und die Kette beginnt danach neu', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  Object.assign(c, { _wx: {}, _hay: 0, _wind: 5, _seasonK: 'summer', _fest: {} });
  const u = (j) => T.seedRnd('mini', j, 2);
  const m0 = Math.floor(NOW / T.ACT_WIN.mini);
  let neu = 0;
  for (let m = m0; m < m0 + 20000; m++) {
    if (!T.miniHas(m) || c._nearBig(T.miniStart(m))) continue;
    // das Fenster davor hätte eine kleine, liegt aber dicht an einer großen: Dort lief keine, also gibt es keinen
    // Vorgänger, und dieses Fenster nimmt seine erste Wahl, auch wenn es dieselbe wäre wie die (ausgefallene) davor
    if (!T.miniHas(m - 1) || !c._nearBig(T.miniStart(m - 1))) continue;
    const erste = T.miniBase('dry', null, u(m));
    if (T.miniBase('dry', null, u(m - 1)) !== erste) continue;
    neu++;
    assert.equal(c._miniAct(m), erste, `Fenster ${m}`);
    assert.equal(c._miniAt(T.miniStart(m - 1) + 1000), null); // und im Fenster davor läuft wirklich keine
  }
  assert.ok(neu >= 3, `${neu} Fälle`);
});

test('Kleine Beschäftigungen: über den Tag beherrscht keine das Bild, Seil und Hantel sind selten geworden', () => {
  // 3000 Fenster hintereinander (jedes besetzt), mit den festen Zahlen der Karte
  const zaehl = (L) => {
    const n = {};
    let prev = null;
    for (let m = 1000; m < 4000; m++) {
      const a = kette(m, L);
      assert.ok(a === null || a !== prev, `Fenster ${m}: zweimal ${a}`);
      prev = a;
      n[a] = (n[a] || 0) + 1;
    }
    return n;
  };
  const trocken = zaehl({});
  for (const a of TROCKEN) assert.ok(trocken[a] / 3000 > 0.04 && trocken[a] / 3000 < 0.14, `${a}: ${trocken[a]}`);
  assert.ok((trocken.rope + trocken.weights) / 3000 < 0.18, `Seil und Hantel: ${trocken.rope + trocken.weights} von 3000`);
  assert.equal(Object.keys(trocken).length, TROCKEN.length);
  // Regen: nur Pfütze und Schiffchen, gut die Hälfte der Fenster bleibt leer
  const regen = zaehl({ wet: true, rain: 40 });
  assert.deepEqual(Object.keys(regen).sort(), ['boat', 'null', 'puddle']);
  assert.ok(regen.null / 3000 > 0.45 && regen.null / 3000 < 0.65, `leer ${regen.null}`);
  assert.ok(regen.puddle > 500 && regen.boat > 400);
  // Schnee: der Schnee-Pika am häufigsten, aber nicht jedes zweite Mal
  const schnee = zaehl({ snowcover: true, cold: true, winter: true });
  assert.ok(schnee.snowpika / 3000 > 0.15 && schnee.snowpika / 3000 < 0.3, `Schnee-Pika ${schnee.snowpika}`);
  assert.ok(Object.entries(schnee).every(([a, v]) => a === 'snowpika' || v < schnee.snowpika));
  // mit Schaltern (Winter, voller Vorrat, Sturm): nie zweimal dieselbe, keine der gesperrten, die übrigen teilen sich den Tag
  const karg = zaehl({ winter: true, cold: true, hayFull: true, wind: 50 });
  assert.deepEqual(Object.keys(karg).sort(), TROCKEN.filter((a) => !['gather', 'crown', 'glider'].includes(a)).sort());
  for (const [a, v] of Object.entries(karg)) assert.ok(v / 3000 > 0.07 && v / 3000 < 0.18, `${a}: ${v}`);
});

test('Wetterwechsel: Pfütze und Schiffchen gehen nur bei Regen, der Schnee-Pika nur bei Schnee, das Übrige wie bisher', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  Object.assign(c, { _hay: 0, _fest: {}, _seasonK: 'summer', _wind: 8, _kiteWind: () => false });
  const bei = (wx, act) => ((c._wx = wx), c._actOk(act));
  const regen = { wet: true, rain: 40 };
  const schnee = { snowcover: true, cold: true };
  for (const a of ['puddle', 'boat']) {
    assert.equal(bei(regen, a), true, a);
    assert.equal(bei({}, a), false, `${a} nach dem Regen`);
    assert.equal(bei({ wet: true, rain: 95, storm: true, shelter: true }, a), false, `${a} bei Starkregen`);
  }
  assert.equal(bei(schnee, 'snowpika'), true);
  assert.equal(bei({}, 'snowpika'), false); // getaut
  for (const a of ['hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider', 'rope', 'weights', 'gather', 'read', 'music']) {
    assert.equal(bei({}, a), true, a);
    assert.equal(bei(regen, a), false, `${a} bei Regen`);
  }
  assert.equal(bei(regen, 'tv'), true);
  assert.equal(bei(schnee, 'rope'), false);
  assert.equal(bei(schnee, 'weights'), true);
  assert.equal(bei(schnee, 'read'), true);
  assert.equal(bei(schnee, 'bubbles'), false);
  c._hay = T.HAY_MAX;
  assert.equal(bei({}, 'gather'), false);
});

test('Requisit am Boden: Platz aus der festen Zahl, neben den Sperren, auf jeder Kartenbreite dieselbe Stelle', () => {
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} statt ${b}`);
  // zwischen 200 und 500 ganz auf der Wiese: Mitte von 250 bis 450
  nah(T.groundSpot(0, 100, 200, 500).x, 250);
  nah(T.groundSpot(1, 100, 200, 500).x, 450);
  nah(T.groundSpot(0.5, 100, 200, 500).x, 350);
  nah(T.groundSpot(0.5, 100, 200, 500).w, 100);
  // ein Gerät des Haus-Boten oder ein Häufchen im Weg: daneben, an die nähere freie Kante
  const s = T.groundSpot(0.5, 100, 200, 500, [[340, 370]]);
  nah(s.x, 290);
  assert.ok(s.x + 50 <= 340);
  nah(T.groundSpot(0.5, 100, 200, 500, [[600, 700]]).x, 350); // Sperre woanders stört nicht
  // schmale Karte: zu wenig Platz, dann schmaler (bis 60 %) und mittig, egal welche Zahl
  for (const u of [0, 0.3, 1]) {
    const n = T.groundSpot(u, 100, 200, 240);
    nah(n.x, 220);
    nah(n.w, 60);
  }
  nah(T.groundSpot(0.2, 100, 200, 280).w, 80);
  // kMin 1 (Requisit mit dem Pika daneben): die Breite bleibt, es liegt mittig über der Lücke
  nah(T.groundSpot(0.7, 100, 200, 240, [], 1).w, 100);
  nah(T.groundSpot(0.7, 100, 200, 240, [], 1).x, 220);
  // doppelt so große Karte: dieselbe Stelle, doppelt so weit
  for (const u of [0.1, 0.5, 0.9]) nah(T.groundSpot(u, 200, 400, 1000).x, 2 * T.groundSpot(u, 100, 200, 500).x);
});

const etwa = (a, b, tol = 1e-6, was = '') => assert.ok(Math.abs(a - b) <= tol, `${was} ${a} statt ${b}`);

test('Requisit am Boden an der Karte: Sperren von Haus-Bote, Festdeko, Schätzen und Häufchen, das Wollknäuel zählt nicht', () => {
  const c = buehne(600, 248);
  const { rock, pW } = c._g;
  const H = c._H;
  assert.deepEqual(plain(c._groundBlocks()), []);
  const frei = c._groundSpot(0.4, 60).x;
  // Ein Gerät des Haus-Boten mitten auf der Wiese: Das Requisit rückt daneben
  c._bote = { list: [{ el: {}, spec: {}, w: 40, l: frei - 20 }, { el: null, spec: {}, w: 40, l: 10 }] };
  const pad = H * 0.015;
  assert.deepEqual(plain(c._groundBlocks()), [[frei - 20 - pad, frei + 20 + pad]]);
  const neben = c._groundSpot(0.4, 60).x;
  assert.ok(neben + 30 <= frei - 20 - pad + 1e-6 || neben - 30 >= frei + 20 + pad - 1e-6, `${neben} liegt auf dem Gerät bei ${frei}`);
  c._bote = null;
  // Festdeko mit festem Platz sperrt, Ostereier und Stöckchen nicht
  c._festPos = { tree: { l: 300, w: 30 }, egg2: { l: 350, w: 8 }, stick1: { l: 380, w: 8 } };
  assert.deepEqual(plain(c._groundBlocks()), [[300 - pad, 330 + pad]]);
  c._festPos = {};
  // Schätze auf der Wiese sperren (nicht, was im Bau oder im Arm liegt). Das Wollknäuel nicht: Nach einem Tipp liegt
  // es auf jedem Gerät woanders, die Pfütze läge sonst auf zwei Geräten an verschiedenen Stellen
  const keys = [...quell.matchAll(/\{ key: '(\w+)', name: /g)].map((m) => m[1]);
  const schatz = (l, w, top) => {
    const el = new Att();
    Object.assign(el, { offsetLeft: l, offsetWidth: w, parentElement: c._el.gifts });
    if (top) el.style.top = top;
    return el;
  };
  c._gtEls = new Map([[keys.indexOf('yarn'), schatz(320, 20)], [keys.indexOf('hammock'), schatz(360, 50)], [keys.indexOf('bell'), schatz(100, 10, '12px')]]);
  assert.ok(keys.indexOf('yarn') >= 0 && keys.indexOf('hammock') >= 0);
  assert.deepEqual(plain(c._groundBlocks()), [[360 - pad, 410 + pad]]);
  c._gtEls = null;
  // Häufchen in der Klo-Ecke am Steinfuß
  c._poops = () => ({ piles: [{ slot: 0 }] });
  const b = plain(c._groundBlocks());
  assert.equal(b.length, 1);
  etwa((b[0][0] + b[0][1]) / 2, rock.l + rock.w * 0.04);
  c._poops = () => ({ piles: [] });
  // Schnee-Pika und Steintürmchen mit dem Pika daneben: Abstand bleibt, auf breiten Karten steht beides auf der Wiese
  for (const [W, Hs] of GROESSEN) {
    for (const areal of ['huegel', 'fels', 'stumpf', 'alpin']) {
      const k = buehne(W, Hs, areal);
      const g = k._g;
      for (const w of [g.pH * 0.7, g.pH * 0.44]) {
        for (const [u, v] of [[0, 0.2], [0.999, 0.8], [0.5, 0.2]]) {
          const U = k._besideSpot(u, v, w);
          const wo = `${areal} ${W}×${Hs}`;
          etwa(Math.abs(U.px - U.x) - w / 2, g.pW * 0.45, 1e-6, wo); // er verdeckt nicht, was er baut
          assert.ok(U.px - w / 2 >= g.hayR - 1e-6, `${wo}: Requisit über dem Vorrat`);
          assert.ok(U.x - g.pW / 2 >= g.hole.r - 1e-6, `${wo}: Pika vor der Tür`);
          // enge Karte (380 × 184): links von der Klo-Ecke am Steinfuß; auf den schmalsten ragt es höchstens noch gut zur
          // Hälfte vor den Stein (bisher stand es ganz davor)
          const ecke = g.rock.l - g.rock.w * 0.08 - k._H * 0.05;
          if (W === 380) assert.ok(U.px + w / 2 <= ecke + 1e-6, `${wo}: Requisit in der Klo-Ecke`);
          if (W < 380) assert.ok(U.px + w / 2 - g.rock.l <= w * 0.6, `${wo}: Requisit weit vor dem Stein`);
        }
      }
    }
  }
});

test('Papierflieger: beide Würfe landen in der Karte und neben Vorrat und Tür, auf schmalen Karten steil vor den Füßen', () => {
  for (const areal of ['huegel', 'fels', 'stumpf', 'alpin']) {
    for (const [W, Hs] of GROESSEN) {
      const c = buehne(W, Hs, areal);
      const g = c._g;
      const wo = `${areal} ${W}×${Hs}`;
      for (const u of [0, 0.25, 0.5, 0.75, 0.999]) {
        for (const r of [0, 0.5, 0.999]) {
          const wuerfe = plain(T.gliderThrows(c._hobbySpot(u), [r, 1 - r], { W, ...g }));
          assert.equal(wuerfe.length, 2);
          assert.equal(wuerfe[1].dir, -wuerfe[0].dir); // der zweite geht zurück
          for (const t of wuerfe) {
            assert.ok(t.land - t.gw / 2 >= g.hayR - 1e-6, `${wo}: landet über dem Vorrat (${t.land})`);
            assert.ok(t.land - t.gw / 2 >= g.hole.r, `${wo}: landet vor der Tür (${t.land})`);
            assert.ok(t.land + t.gw / 2 <= W, `${wo}: landet hinter dem Kartenrand (${t.land})`);
            assert.ok(t.to >= g.pW * 0.45 - 1e-6 && t.to <= g.xR + 1e-6, `${wo}: er läuft aus dem Bild (${t.to})`);
            // nach dem Hinterherlaufen liegt der Flieger vor seiner Nase (außer er steht schon am Rand)
            if (t.to > g.pW * 0.45 + 1 && t.to < g.xR - 1) etwa((t.land - t.to) * t.dir, g.pW * (122 / 120 - 0.56), 1e-6, wo);
            assert.equal(t.steep, Math.abs(t.land - t.ox) < g.pW * 0.6);
          }
          // der zweite Wurf beginnt dort, wo er den ersten aufgehoben hat
          etwa(wuerfe[1].ox, wuerfe[0].to + wuerfe[1].dir * g.pW * (122 / 120 - 0.5), 1e-6, wo);
        }
      }
      const mitte = T.gliderThrows(c._hobbySpot(0.5), [0.5, 0.5], { W, ...g });
      // schmal (die Wiese ist kürzer als ein Wurf): steil, er landet vor den Füßen; breit: ein weiter Wurf
      if (W <= 340) assert.ok(mitte.every((t) => t.steep), `${wo}: nicht steil`);
      // 380 × 184, Standplatz am rechten Ende der Wiese: Bis vor den Stein ist weniger als ein halber Wurf Platz. Er
      // wirft steil und genau so weit, wie Platz ist (keine Mindestweite mehr, die den Flieger hinaustrüge)
      if (W === 380) {
        const [eng] = T.gliderThrows(c._hobbySpot(0.999), [0.5, 0.5], { W, ...g });
        assert.equal(eng.steep, true, `${wo}: am Rand nicht steil`);
        assert.ok(eng.land + eng.gw <= g.xR + g.pW * 0.3 + 1e-6, `${wo}: landet dichter am Rand als seine Breite`);
      }
      if (W >= 600) assert.ok(mitte.every((t) => !t.steep && Math.abs(t.land - t.ox) > g.pW), `${wo}: kein weiter Wurf`);
    }
  }
  // Karten ab 3:2 wie bisher: auf 600 × 248 fliegt er rechts bis vor den Stein und zurück bis zum Vorrat
  const c = buehne(600, 248);
  const [hin, her] = T.gliderThrows(c._hobbySpot(0), [0.999, 0.999], { W: 600, ...c._g });
  assert.deepEqual([hin.dir, Math.round(hin.land), Math.round(hin.to), her.dir, Math.round(her.land), Math.round(her.to)], [1, 548, 493, -1, 253, 307]);
  // beide Würfe und das Hinterherlaufen passen in die Länge des Fensters
  assert.equal(T.ACT_LEN.glider(() => 0.5), 700 + 2 * T.GLIDER_STEP);
});

test('Papierschiffchen: wo es ist, steht mit der Planzeit fest; wer später einsteigt, sieht es nicht eine Etappe voraus', () => {
  const B = T.BOAT_T;
  for (const K of [3, 4]) {
    const tk = (k) => B.launch + k * B.puff;
    const t1 = tk(K);
    assert.equal(T.ACT_LEN.boat((n) => (n === 1 ? (K - 3) / 2 : 0)), t1 + B.back);
    assert.equal(T.boatPos(0, K), 0);
    assert.equal(T.boatPos(B.launch - 1, K), 0);
    for (let k = 0; k < K; k++) {
      // Etappe begonnen, er holt noch Luft: Das Schiffchen liegt noch, wo es war (bisher stand es schon eine weiter)
      etwa(T.boatPos(tk(k) + 100, K), k / K, 1e-3);
      etwa(T.boatPos(tk(k) + B.blow, K), k / K, 1e-3);
      // gepustet: Es gleitet (erst schnell, dann langsamer) und ist zum Ende der Etappe angekommen
      const halb = T.boatPos(tk(k) + B.blow + B.glide / 2, K);
      assert.ok(halb > (k + 0.6) / K && halb < (k + 0.98) / K, `Etappe ${k}: ${halb}`);
      etwa(T.boatPos(tk(k) + B.puff - 1, K), (k + 1) / K, 1e-3);
    }
    // hinüber nie zurück, auf der Rückfahrt nie vor; immer auf der Pfütze
    let vor = 0;
    for (let t = 0; t <= t1; t += 25) {
      const f = T.boatPos(t, K);
      assert.ok(f >= vor - 1e-3 && f <= 1, `t ${t}: ${f} nach ${vor}`);
      vor = f;
    }
    etwa(T.boatPos(t1, K), 1);
    for (let t = t1; t <= t1 + B.back + 500; t += 25) {
      const f = T.boatPos(t, K);
      assert.ok(f <= vor + 1e-9 && f >= 0, `t ${t}: ${f} nach ${vor}`);
      vor = f;
    }
    etwa(T.boatPos(t1 + (B.back - B.home) / 2, K), 0.5, 1e-6);
    assert.equal(T.boatPos(t1 + B.back - B.home, K), 0);
  }
  // die Zeitkurven wie im Browser: linear, ease-in-out (symmetrisch), ease (bei halber Zeit gut 80 %)
  etwa(T.bezAt(0, 0, 1, 1, 0.3), 0.3);
  etwa(T.bezAt(0.42, 0, 0.58, 1, 0.5), 0.5);
  etwa(T.bezAt(0.42, 0, 0.58, 1, 0.25) + T.bezAt(0.42, 0, 0.58, 1, 0.75), 1);
  etwa(T.bezAt(0.25, 0.1, 0.25, 1, 0.5), 0.8024, 1e-3);
  assert.equal(T.bezAt(0.2, 0.7, 0.3, 1, -1), 0);
  assert.equal(T.bezAt(0.2, 0.7, 0.3, 1, 2), 1);
  // die Karte nimmt dieselbe Kurve und dieselben Zeiten wie die Rechnung
  assert.ok(quell.includes('cubic-bezier(${BOAT_EASE.join(\', \')})'));
  assert.ok(quell.includes("trip(1, 0, T1, BOAT_T.back - BOAT_T.home, 'ease-in-out')"));
});

// Eine kleine Beschäftigung aus dem Tagesplan (Fenster 7001) auf einer Karte, die schon am Platz steht (_goSpot ist
// sofort fertig) und früh dran ist. log schreibt mit, worauf sie wartet: ['at', Planzeit] oder ['wait', ms].
const taktKarte = (act, r = (n) => T.seedRnd('mini', 7001, 10 + n)) => {
  const c = buehne(600, 248);
  const start = NOW;
  const log = [];
  Object.assign(c, {
    log, _slot: { id: 'm7001', kind: 'mini', k: 7001, act, start, end: start + T.ACT_WALK + T.ACT_LEN[act](r), r },
    _planNow: () => start + 1200, _goSpot: async () => {}, _face() {}, _propOn() {}, _propOff: async () => {}, _happy() {}, _say() {},
    _aprop: () => new Att(), _mimik() {}, _cls() {}, _puff() {}, _seeds() {}, _hearts() {}, _blush() {}, _jump() {}, _hopTo: async () => {},
    _wait: async (ms) => { log.push(['wait', ms]); },
    _at: async (t) => { log.push(['at', t]); throw new Error('halt'); },
  });
  return c;
};

test('Gemeinsamer Takt: jede kleine Beschäftigung aus dem Plan beginnt zur Planzeit, nicht bei der Ankunft', async () => {
  for (const act of ['rope', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'glider']) {
    const c = taktKarte(act);
    await c[`_${act}`]().catch((e) => assert.equal(e.message, 'halt', `${act}: ${e.stack}`));
    // Wer schon am Platz steht, wartet bis ACT_WALK nach Fensterbeginn (und nicht erst seine eigene Pause ab)
    assert.deepEqual(c.log[0], ['at', NOW + T.ACT_WALK], `${act}: beginnt mit ${JSON.stringify(c.log[0])}`);
  }
  // Aus der Vorschau erzwungen (kein Fenster): gleich los, es gibt keine Planzeit
  for (const act of ['yoyo', 'puste', 'purzel']) {
    const c = taktKarte(act);
    c._slot = null;
    await c[`_${act}`]().catch((e) => assert.equal(e.message, 'halt', `${act}: ${e.stack}`));
    assert.equal(c.log[0][0], 'wait', act);
  }
  // Hula-Hoop: „schneller!“ und die Ausrufe kommen zu festen Planzeiten aus den Zahlen des Fensters. Zwei Geräte,
  // eines früh am Platz, eines erst im letzten Augenblick: dieselben Zeitpunkte
  const hula = async (spaet) => {
    const r = (n) => (n === 1 ? 0.8 : n === 6 ? 0.9 : n === 7 ? 0.1 : T.seedRnd('hula', n));
    const c = taktKarte('hula', r);
    const gesagt = [];
    const zeiten = () => c.log.filter((e) => e[0] === 'at').map((e) => e[1]);
    Object.assign(c, {
      _planNow: () => NOW + spaet, _at: async (t) => { c.log.push(['at', t]); },
      _say: (text) => gesagt.push([text, zeiten().at(-1), c._el.pika.classList.contains('hula-x')]),
    });
    await c._hula();
    return { zeiten: zeiten(), gesagt, S: c._slot };
  };
  const a = await hula(1200);
  const b = await hula(4900);
  assert.deepEqual(a.zeiten, b.zeiten);
  const { S } = a;
  const T0 = S.start + T.ACT_WALK;
  const mid = S.end - (S.end - T0) * 0.4;
  assert.equal(a.zeiten[0], T0);
  assert.equal(a.zeiten.at(-1), S.end);
  assert.ok(a.zeiten.every((t, i) => i === 0 || t > a.zeiten[i - 1]), 'Zeitpunkte nicht aufsteigend');
  assert.ok(a.zeiten.length >= 3, `${a.zeiten.length} Zeitpunkte`);
  // „schneller!“ genau bei 60 % des Hauptteils, in dem Augenblick dreht der Reifen schneller
  assert.deepEqual(a.gesagt.filter((g) => g[0] === 'schneller!'), [['schneller!', mid, true]]);
  assert.ok(a.gesagt.filter((g) => g[1] < mid).every((g) => g[2] === false));
});

test('Wetterwechsel am Gerät: endet der Regen oder taut der Schnee, packt er Pfütze, Schiffchen und Schnee-Pika ein', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  const leer = () => {};
  Object.assign(c, {
    _el: { scene: new Att(), clouds: [], pika: new Att() }, _cfg: { rain_min: 0.3 }, _wx: {}, _wxLog: [], _haNow: () => NOW, _viewN: () => false,
    _setPrecip: leer, _light: leer, _bowSync: leer, _cloudWind: leer, _asleep: false, _inside: false, _hay: 0, _fest: {}, _seasonK: 'summer',
    abbr: 0, _interrupt() { this.abbr++; },
  });
  // Wetter setzen (wie die Schalter der Vorschau), während er tut beschäftigt ist: Wie oft wurde abgebrochen?
  const wetter = (cond, schnee = 0, tut = null) => {
    c.abbr = 0;
    c._action = tut;
    c._dbgWeather = { cond, wind: 5, temp: schnee ? -2 : 12 };
    c._dbgSnow = schnee;
    c._applyWeather();
    return c.abbr;
  };
  // der Regen hört auf: Pfütze und Schiffchen sind vorbei (bis 0.31 brach nur beginnender Regen etwas ab)
  for (const act of ['puddle', 'boat']) {
    wetter('rainy');
    assert.equal(c._wx.wet, true);
    assert.equal(wetter('cloudy', 0, act), 1, `${act} nach dem Regen`);
  }
  wetter('rainy');
  assert.equal(wetter('cloudy', 0, 'tv'), 0); // Fernsehen geht weiter
  // der Schnee ist getaut: kein Schnee-Pika auf der grünen Wiese; Gewichtheben geht mit und ohne Schnee
  wetter('cloudy', 1);
  assert.equal(c._wx.snowcover, true);
  assert.equal(wetter('cloudy', 0, 'snowpika'), 1);
  wetter('cloudy', 1);
  assert.equal(wetter('cloudy', 0, 'weights'), 0);
  // Regen oder Schnee beginnt: wie bisher
  wetter('cloudy');
  assert.equal(wetter('rainy', 0, 'yoyo'), 1);
  wetter('cloudy');
  assert.equal(wetter('cloudy', 1, 'rope'), 1);
  wetter('cloudy');
  assert.equal(wetter('cloudy', 1, 'weights'), 0);
  // es regnet weiter (nur der Wind dreht): Die Pfütze bleibt
  wetter('rainy');
  c._dbgWeather = { cond: 'rainy', wind: 25, temp: 12 };
  c._action = 'puddle';
  c._applyWeather();
  assert.equal(c.abbr, 0);
});

test('Aufräumen: Requisiten am Boden verschwinden, mitten im Purzelbaum bleibt er stehen, wo er ist', () => {
  const karte = (...klassen) => {
    const c = Object.create(T.PikaPetCard.prototype);
    const leer = () => {};
    const pika = new Att();
    pika.classList.add(...klassen);
    Object.assign(c, {
      _el: { pika, think: new Att() }, _mimik: leer, _tvOn: leer, _kiteAway: leer, _easelAway: leer, _mouth: leer, _bubble: leer,
      eingefroren: 0, _freeze() { this.eingefroren++; }, _action: 'purzel',
    });
    return c;
  };
  // Purzelbaum: Die Rolle trägt ihn über eine Transition weiter. Ohne Anhalten glitte er nach dem Abbruch zum Ziel
  const c = karte('purzel', 'crosseye');
  c._cleanup();
  assert.equal(c.eingefroren, 1);
  assert.equal(c._el.pika.classList.contains('purzel'), false);
  assert.equal(c._action, null);
  const w = karte('walking');
  w._cleanup();
  assert.equal(w.eingefroren, 1);
  const s = karte('hula', 'hula-go');
  s._cleanup();
  assert.equal(s.eingefroren, 0); // steht er, gibt es nichts anzuhalten
  assert.deepEqual([...s._el.pika.classList.s], []);
  // Pfütze, Schnee-Pika, Steintürmchen, fliegender Papierflieger: blenden aus und sind aus der Liste
  const d = karte('sniff');
  const pfuetze = new Att();
  const flieger = new Att();
  for (const el of [pfuetze, flieger]) el.classList.add('aprop', 'on');
  d._aprops = new Set([pfuetze, flieger]);
  d._cleanup();
  assert.equal(d._aprops.size, 0);
  for (const el of [pfuetze, flieger]) assert.deepEqual([...el.classList.s].sort(), ['aprop', 'off']);
});

test('Größe der Karte ändert sich: was mit festen Pixeln rechnet, wird abgebrochen, alles andere läuft weiter', () => {
  const c = buehne(600, 248);
  const neu = (W, Hs, tut, requisit = false) => {
    c.abbr = 0;
    c._action = tut;
    c._aprops = requisit ? new Set([new Att()]) : new Set();
    Object.assign(c._el.scene, { clientWidth: W, clientHeight: Hs });
    c._layout();
    return c.abbr;
  };
  // Papierflieger zwischen den Würfen und Purzelbaum: kein Requisit am Boden, aber Wege in Pixeln
  assert.equal(neu(500, 248, 'glider'), 1);
  assert.equal(neu(600, 248, 'purzel'), 1);
  // derselbe Aufruf ohne Größenänderung (ResizeObserver meldet sich auch so): nichts
  assert.equal(neu(600, 248, 'glider'), 0);
  assert.equal(neu(600, 248, 'purzel'), 0);
  // ein Requisit am Boden (Pfütze, Schnee-Pika, Steintürmchen, fliegender Papierflieger)
  assert.equal(neu(500, 248, 'puddle', true), 1);
  assert.equal(neu(600, 248, 'stones', true), 1);
  assert.equal(neu(600, 248, 'puddle', true), 0);
  // was auf der Stelle steht und zur Grafik des Pikas gehört, läuft weiter
  for (const act of ['hula', 'yoyo', 'juggle', 'crown', 'puste', 'rope', 'weights', 'read', null]) assert.equal(neu(c._W === 600 ? 500 : 600, 248, act), 0, `${act}`);
  assert.deepEqual([...T.ACT_PX].sort(), ['glider', 'purzel']);
  // die Geometrie ist danach die der neuen Größe
  assert.equal(neu(340, 248, 'glider'), 1);
  assert.equal(c._W, 340);
  assert.ok(c._g.rock.l + c._g.rock.w <= 340);
});

test('Späteinstieg nach einem Wetterumschwung: ein Fenster, das trocken begann, bekommt nachträglich keine Pfütze', () => {
  const log = [{ t: NOW - 36e5, c: 'cloudy', T: 10 }, { t: NOW - 20000, c: 'rainy', T: 10 }];
  assert.equal(T.wxProgThen(log, NOW - 30000), 'dry');
  assert.equal(T.wxProgThen(log, NOW - 20000), 'rain');
  assert.equal(T.wxProgThen(log, NOW), 'rain');
  assert.equal(T.wxProgThen(log, NOW - 2 * 36e5), '?'); // der Verlauf beginnt erst danach: Es galt eine andere Lage
  assert.equal(T.wxProgThen([], NOW), null);
  assert.equal(T.wxProgThen(undefined, NOW), null);
  assert.equal(T.wxProgThen([{ t: NOW - 5000, c: 'pouring', T: 10 }], NOW), 'none');
  assert.equal(T.wxProgThen([{ t: NOW - 5000, c: 'unavailable', T: null }], NOW), null);
  // Schnee: sofort, wenn es schneit; danach, solange die Decke liegt; Regen darauf: kein Programm
  const winter = [{ t: NOW - 3 * 36e5, c: 'cloudy', T: -2 }, { t: NOW - 2 * 36e5, c: 'snowy', T: -2 }, { t: NOW - 36e5, c: 'cloudy', T: -2 },
    { t: NOW - 60000, c: 'rainy', T: 1 }];
  assert.equal(T.wxProgThen(winter, NOW - 2.5 * 36e5), 'dry');
  assert.equal(T.wxProgThen(winter, NOW - 2 * 36e5 + 1000), 'snow');
  assert.equal(T.wxProgThen(winter, NOW - 0.5 * 36e5), 'snow');
  assert.equal(T.wxProgThen(winter, NOW), 'none');

  // An der Karte: Pfützenspringen läuft seit 6 s (ein Gerät, das jetzt dazukommt, stiege mittendrin ein)
  const c = Object.create(T.PikaPetCard.prototype);
  const S = { id: 'm5', kind: 'mini', k: 5, act: 'puddle', start: NOW - 6000, end: NOW + 8000, r: () => 0.5 };
  Object.assign(c, {
    _g: {}, _asleep: false, _watched: () => true, _plan: {}, _planOk: true, _planStale: false, _planNow: () => NOW, _bigAt: () => null,
    _miniAt: () => S, _wx: { wet: true, rain: 40 }, _hay: 0, _fest: {}, _seasonK: 'summer', _wind: 5,
  });
  // es regnet seit einer Stunde: einsteigen
  c._wxLog = [{ t: NOW - 36e5, c: 'rainy', T: 10 }];
  assert.equal(c._slotNow(), S);
  // der Regen begann erst im Fenster: Die anderen Geräte haben dort schon etwas Trockenes gezeigt, also nichts mehr
  c._wxLog = [{ t: NOW - 36e5, c: 'cloudy', T: 10 }, { t: NOW - 3000, c: 'rainy', T: 10 }];
  assert.equal(c._slotNow(), null);
  // dasselbe auf einem frisch geladenen Gerät, dem der Recorder noch nicht geantwortet hat: Sein Verlauf beginnt
  // mit der Lage von jetzt (last_changed), und die ist jünger als das Fenster
  c._wxLog = [{ t: NOW - 3000, c: 'rainy', T: 10 }];
  assert.equal(c._slotNow(), null);
  // … außer das Fenster hat eben erst begonnen: Dann beginnen alle Geräte gemeinsam mit der Pfütze
  S.start = NOW - 3500;
  assert.equal(c._slotNow(), S);
  S.start = NOW - 6000;
  // kein Verlauf (keine Wetter-Entität) oder Wetter aus der Vorschau: wie bisher einsteigen
  c._wxLog = [];
  assert.equal(c._slotNow(), S);
  c._wxLog = [{ t: NOW - 36e5, c: 'cloudy', T: 10 }, { t: NOW - 3000, c: 'rainy', T: 10 }];
  c._dbgWeather = { cond: 'rainy' };
  assert.equal(c._slotNow(), S);
  c._dbgWeather = null;
  // Schnee-Pika: Lag der Schnee schon, als das Fenster begann (auch wenn es inzwischen aufgehört hat zu schneien)?
  Object.assign(S, { act: 'snowpika', end: NOW + 20000 });
  c._wx = { snowcover: true, cold: true };
  c._wxLog = [{ t: NOW - 2 * 36e5, c: 'snowy', T: -2 }, { t: NOW - 3000, c: 'cloudy', T: -2 }];
  assert.equal(c._slotNow(), S);
  c._wxLog = [{ t: NOW - 36e5, c: 'cloudy', T: -2 }, { t: NOW - 3000, c: 'snowy', T: -2 }];
  assert.equal(c._slotNow(), null);
});

// ---------- Chronik (0.34): Tagesbilanz je Pika-Tag in einer To-do-Liste von HA ----------

const CH = 'todo.pikas_chronik';
const HEUTE = T.pikaDay(NOW);
const datum = (tag) => T.chronikDatum(tag);
const eintrag = (d, f = {}) => ({ d, futter: null, streicheln: null, putzen: null, paeckchen: null, besuch: null, x: {}, ...f });

test('Chronik: Datum und Tagesindex (Schaltjahr, Jahreswechsel, ungültiges Datum), der Pika-Tag beginnt um 4 Uhr', () => {
  assert.equal(T.chronikDatum(T.pikaDay(new Date(2026, 10, 10, 12).getTime())), '2026-11-10');
  // bis 4 Uhr gehört die Nacht zum Vortag
  assert.equal(T.chronikDatum(T.pikaDay(new Date(2026, 10, 11, 3, 59).getTime())), '2026-11-10');
  assert.equal(T.chronikDatum(T.pikaDay(new Date(2026, 10, 11, 4, 0).getTime())), '2026-11-11');
  assert.equal(T.chronikTag('2024-02-29'), Date.UTC(2024, 1, 29) / 864e5);
  assert.equal(T.chronikTag('2026-01-01') - T.chronikTag('2025-12-31'), 1);
  assert.equal(T.chronikTag('2024-03-01') - T.chronikTag('2024-02-28'), 2);
  assert.equal(T.chronikTag('2023-03-01') - T.chronikTag('2023-02-28'), 1);
  const falsch = ['2023-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-11-31', '2026-11-00', '2026-1-01', '26-11-10', '2026-11-10 ',
    '0050-01-01', '10.11.2026', '', null, undefined, 20768];
  for (const d of falsch) assert.equal(T.chronikTag(d), null, `„${d}“ ist kein Datum`);
  for (const t of [NaN, 1.5, Infinity, '20768', null, undefined, -8e5, 3e6]) assert.equal(T.chronikDatum(t), null, `${t} ist kein Tagesindex`);
  // Hin- und Rückweg über gut zwei Jahre (mit Schalttag und, wo es sie gibt, den Zeitumstellungen)
  const von = T.chronikTag('2023-12-25');
  let n = 0;
  for (let tag = von; tag < von + 800; tag++, n++) {
    const d = T.chronikDatum(tag);
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(T.chronikTag(d), tag);
    const a = T.chronikStart(tag);
    const D = new Date(a);
    assert.deepEqual([D.getFullYear(), D.getMonth() + 1, D.getDate(), D.getHours(), D.getMinutes()], [...d.split('-').map(Number), 4, 0]);
    assert.equal(T.pikaDay(a), tag, `${d}: um 4 Uhr beginnt der Tag`);
    assert.equal(T.pikaDay(a - 1), tag - 1, `${d}: davor ist noch der Vortag`);
  }
  assert.equal(n, 800);
});

// Eine Zone, in der zur Zeit t sicher eine andere Uhrzeit gilt als auf dem Rechner, auf dem die Tests laufen
const andereZone = (t) => ['Asia/Tokyo', 'America/New_York'].find((z) => T.chronikVersatz(z, t) !== -new Date(t).getTimezoneOffset());
const HIER = Intl.DateTimeFormat().resolvedOptions().timeZone;

test('Chronik: die Ortszeit des Geräts muss zur Zeitzone von HA passen, jetzt und vor einer Woche', () => {
  const winter = Date.UTC(2026, 10, 11, 12);
  const sommer = Date.UTC(2026, 6, 1, 12);
  // Versatz einer Zone in Minuten östlich von UTC
  assert.deepEqual(['Europe/Berlin', 'Asia/Tokyo', 'Africa/Lagos', 'UTC', 'Asia/Kolkata', 'America/New_York'].map((z) => [T.chronikVersatz(z, winter), T.chronikVersatz(z, sommer)]),
    [[60, 120], [540, 540], [60, 60], [0, 0], [330, 330], [-300, -240]]);
  assert.equal(T.chronikVersatz('Europe/Berlin', winter + 999), 60, 'Millisekunden zählen nicht');
  for (const z of [undefined, null, '', 'Mars/Olympus', 5, {}]) assert.equal(T.chronikVersatz(z, winter), null, String(z));
  // Ein Gerät in Berlin (lokal: sein Versatz), HA in …
  const berlin = (t) => T.chronikVersatz('Europe/Berlin', t);
  assert.equal(T.chronikZoneOk('Europe/Berlin', [winter, sommer], berlin), true);
  assert.equal(T.chronikZoneOk('Asia/Tokyo', [winter], berlin), false);
  assert.equal(T.chronikZoneOk('America/New_York', [sommer], berlin), false);
  // Lagos geht im Winter wie Berlin, kennt aber keine Sommerzeit. Drei Tage nach der Umstellung (25.10.2026) stimmt
  // „jetzt“ überein, der Beginn des ältesten Tags, der nachgetragen würde, nicht: Darum zwei Zeitpunkte.
  const jetzt = Date.UTC(2026, 9, 28, 12);
  const davor = jetzt - 7 * 864e5;
  assert.equal(T.chronikZoneOk('Africa/Lagos', [jetzt], berlin), true);
  assert.equal(T.chronikZoneOk('Africa/Lagos', [jetzt, davor], berlin), false);
  assert.equal(T.chronikZoneOk('Africa/Lagos', [davor, jetzt], berlin), false);
  assert.equal(T.chronikZoneOk('Europe/Berlin', [jetzt, davor], berlin), true);
  // umgekehrt: das Gerät in Tokio, HA in Berlin (der gemeldete Fall)
  assert.equal(T.chronikZoneOk('Europe/Berlin', [winter], (t) => T.chronikVersatz('Asia/Tokyo', t)), false);
  // nicht prüfbar (HA nennt keine Zone, der Browser kennt sie nicht): gilt als passend, wie bisher
  for (const z of [undefined, null, '', 'Mars/Olympus']) assert.equal(T.chronikZoneOk(z, [winter, sommer], berlin), true, String(z));
  assert.equal(T.chronikZoneOk('Asia/Tokyo', [], berlin), true);
  // ohne dritten Parameter zählt der Rechner selbst: seine eigene Zone passt, eine andere nicht (in jeder Zone, in der
  // die Tests laufen)
  assert.equal(T.chronikZoneOk(HIER, [NOW, NOW - 7 * 864e5, winter, sommer]), true, HIER);
  assert.ok(andereZone(NOW));
  assert.equal(T.chronikZoneOk(andereZone(NOW), [NOW]), false);
});

test('Chronik: Kodieren und Lesen ergeben dasselbe (alle Felder, Unbekanntes, Besuch leer, nur der Kopf)', () => {
  const d = '2026-11-10';
  const faelle = [
    [eintrag(d, { futter: 3, streicheln: 12, putzen: 2, paeckchen: 1, besuch: ['pino', 'vogel'] }),
      'Pika-Tag 2026-11-10 · futter=3 streicheln=12 putzen=2 paeckchen=1 besuch=pino,vogel'],
    [eintrag(d), 'Pika-Tag 2026-11-10'],
    [eintrag(d, { futter: 0, streicheln: 0, putzen: 0, paeckchen: 0, besuch: [] }), 'Pika-Tag 2026-11-10 · futter=0 streicheln=0 putzen=0 paeckchen=0 besuch=-'],
    [eintrag(d, { streicheln: 99, besuch: ['falter'] }), 'Pika-Tag 2026-11-10 · streicheln=99 besuch=falter'],
    [eintrag(d, { paeckchen: 123456789 }), 'Pika-Tag 2026-11-10 · paeckchen=123456789'],
    // Felder einer späteren Version: bleiben erhalten, hinter den bekannten, nach Schlüssel sortiert
    [eintrag(d, { futter: 1, x: { a_1: 'x=y', laune: 'gut·sehr', wetter: 'regen' } }), 'Pika-Tag 2026-11-10 · futter=1 a_1=x=y laune=gut·sehr wetter=regen'],
    // Besuch: pino, vogel, falter, danach Unbekanntes nach dem Alphabet
    [eintrag(d, { besuch: ['pino', 'vogel', 'falter', 'igel', 'zebra'] }), 'Pika-Tag 2026-11-10 · besuch=pino,vogel,falter,igel,zebra'],
  ];
  for (const [e, titel] of faelle) {
    assert.equal(T.chronikKod(e), titel);
    assert.deepEqual(plain(T.chronikLies(titel)), e, titel);
    assert.equal(T.chronikKod(T.chronikLies(titel)), titel);
    assert.equal(titel, titel.trim(), 'HA schneidet Leerzeichen am Rand ab: Der Titel hat keine');
  }
  assert.equal(faelle.length, 7);
  // ungeordnet hinein, geordnet heraus
  assert.equal(T.chronikKod(eintrag(d, { besuch: ['zebra', 'falter', 'pino', 'igel', 'vogel', 'pino'], x: { z: '1', b: '2' } })),
    'Pika-Tag 2026-11-10 · besuch=pino,vogel,falter,igel,zebra b=2 z=1');
  // Beim Lesen großzügig: beliebige Leerzeichen, „·“ ohne Leerzeichen oder gar nicht, andere Reihenfolge, führende Nullen
  const locker = [
    ['Pika-Tag 2026-11-10 futter=3', 'Pika-Tag 2026-11-10 · futter=3'],
    ['Pika-Tag 2026-11-10·futter=3', 'Pika-Tag 2026-11-10 · futter=3'],
    ['Pika-Tag 2026-11-10   ·   futter=3    besuch=vogel,pino,pino', 'Pika-Tag 2026-11-10 · futter=3 besuch=pino,vogel'],
    ['Pika-Tag 2026-11-10 · besuch=- streicheln=007 futter=3', 'Pika-Tag 2026-11-10 · futter=3 streicheln=7 besuch=-'],
    ['Pika-Tag 2026-11-10 · futter=3\nputzen=1', 'Pika-Tag 2026-11-10 · futter=3 putzen=1'],
    ['Pika-Tag 2026-11-10 ·', 'Pika-Tag 2026-11-10'],
    ['Pika-Tag 2026-11-10 · streicheln=250', 'Pika-Tag 2026-11-10 · streicheln=250'],
  ];
  for (const [roh, sauber] of locker) {
    const e = T.chronikLies(roh);
    assert.ok(e && !e.fremd, roh);
    assert.equal(T.chronikKod(e), sauber);
  }
  assert.equal(locker.length, 7);
});

test('Chronik: fremde Einträge zählen nicht, „fremd für diesen Tag“ belegt den Tag', () => {
  // kein Kopf mit gültigem Datum: ein Mensch, etwas ganz anderes
  const fremd = ['Milch kaufen', '', undefined, null, 42, 'pika-tag 2026-11-10', ' Pika-Tag 2026-11-10', 'Pika-Tag', 'Pika-Tag ', 'Pika-Tag  2026-11-10',
    'Pika-Tag 2026-02-30 · futter=1', 'Pika-Tag 10.11.2026', 'Pika-Tag 2026-11-101', 'Pika-Tag 2026-11-1', 'Pikas Tag 2026-11-10', 'Mein Pika-Tag 2026-11-10'];
  for (const t of fremd) assert.equal(T.chronikLies(t), null, `„${t}“`);
  assert.equal(fremd.length, 16);
  // Kopf und Datum stimmen, der Rest ist nicht sauber lesbar
  const halb = ['war ein schöner Tag', '· futter=drei', '· futter=3 futter=4', '· futter=-1', '· futter=1.5', '· futter=1234567890', '· futter=',
    '· besuch=', '· besuch=pino,,vogel', '· besuch=Pino', '· besuch=pino,-', '· Futter=3', '· futter=3 ✓', '· x=1 x=2', '·· futter=3', '· futter = 3',
    '· 1a=2', '· futter=3 und mehr'];
  for (const r of halb) assert.deepEqual(plain(T.chronikLies(`Pika-Tag 2026-11-10 ${r}`)), { d: '2026-11-10', fremd: true }, r);
  for (const t of ['Pika-Tag 2026-11-10: Notiz', 'Pika-Tag 2026-11-10futter=3', 'Pika-Tag 2026-11-10, futter=3']) {
    assert.deepEqual(plain(T.chronikLies(t)), { d: '2026-11-10', fremd: true }, t);
  }
  assert.equal(halb.length, 18);
  // Namen, die jedes Objekt schon kennt, sind gewöhnliche unbekannte Felder (und nicht „doppelt“)
  assert.deepEqual(plain(T.chronikLies('Pika-Tag 2026-11-10 · constructor=a tostring=b').x), { constructor: 'a', tostring: 'b' });
});

test('Chronik: Zusammenführen ist kommutativ, assoziativ und idempotent', () => {
  const E = [
    'Pika-Tag 2026-11-10',
    'Pika-Tag 2026-11-10 · futter=3 streicheln=12 putzen=2 paeckchen=1 besuch=pino,vogel',
    'Pika-Tag 2026-11-10 · futter=5 streicheln=4 besuch=-',
    'Pika-Tag 2026-11-10 · putzen=7 besuch=falter,igel wetter=regen',
    'Pika-Tag 2026-11-10 · futter=0 wetter=sonne laune=gut',
    'Pika-Tag 2026-11-10 · streicheln=99 paeckchen=0 besuch=vogel,zebra laune=prima',
  ].map((t) => T.chronikLies(t));
  const vorher = JSON.stringify(E);
  const m = T.chronikMisch;
  const k = T.chronikKod;
  // Zahlen: das Größere, unbekannt weicht der Zahl; Besuch und Unbekanntes vereinigt, bei zwei Werten der als Text größere
  assert.equal(k(m(E[1], E[2])), 'Pika-Tag 2026-11-10 · futter=5 streicheln=12 putzen=2 paeckchen=1 besuch=pino,vogel');
  assert.equal(k(m(E[0], E[2])), 'Pika-Tag 2026-11-10 · futter=5 streicheln=4 besuch=-');
  assert.equal(k(m(E[3], E[4])), 'Pika-Tag 2026-11-10 · futter=0 putzen=7 besuch=falter,igel laune=gut wetter=sonne');
  assert.equal(k(m(E[4], E[5])), 'Pika-Tag 2026-11-10 · futter=0 streicheln=99 paeckchen=0 besuch=vogel,zebra laune=prima wetter=sonne');
  assert.equal(k(m(E[0], E[0])), 'Pika-Tag 2026-11-10');
  let n = 0;
  for (const a of E) {
    assert.deepEqual(plain(m(a, a)), plain(a));
    assert.deepEqual(plain(m(a, null)), plain(a));
    assert.deepEqual(plain(m(null, a)), plain(a));
    for (const b of E) {
      assert.deepEqual(plain(m(a, b)), plain(m(b, a)));
      assert.deepEqual(plain(m(m(a, b), b)), plain(m(a, b)));
      for (const c of E) {
        assert.deepEqual(plain(m(m(a, b), c)), plain(m(a, m(b, c))));
        assert.equal(k(m(m(a, b), c)), k(m(c, m(b, a))));
        n++;
      }
    }
  }
  assert.equal(n, 216);
  assert.equal(JSON.stringify(E), vorher, 'die Eingaben bleiben, wie sie waren');
});

// Kleiner nachgestellter Verlauf der beiden Helfer, wie ihn der Recorder führt: je Tag so oft gefüttert, so oft
// gestreichelt (der Zähler im Plan), Erlebnisse (Bits wie MEM_BITS: 16 Pino, 64 Vögelchen, 256 Schmetterling), Päckchen
// ausgepackt, Häufchen einzeln weggemacht und Großputz. → { S, P }: Stände als Text mit Zeit
const chronikVerlauf = (tage) => {
  const t0 = sek(T.chronikStart(tage[0][0]) - 36e5);
  let P = { ...T.planBlank(t0), cute: { d: tage[0][0] - 1, n: 5, m: 0 },
    gift: { k: t0, a: 1, p: t0, n: 9, u: 0, v: 0, z: 0, o: 0, b: null, x: 0, y: 0, d: 0, i: 2 } };
  let S = T.freshStats(t0);
  const V = { S: [{ t: t0, s: T.serialize(S) }], P: [{ t: t0, s: T.planSer(P) }] };
  const plan = (t, neu) => {
    P = { ...P, ...neu };
    V.P.push({ t, s: T.planSer(P) });
  };
  let bit = 0;
  for (const [tag, { futter = 0, streicheln = 0, mem = 0, paeckchen = 0, putzen = 0, gross = 0 }] of tage) {
    const a = T.chronikStart(tag);
    for (let i = 0; i < futter; i++) {
      const t = sek(a + (i + 1) * 20 * 6e4);
      plan(t + 2000, { fd: [...P.fd, { t, x: 40, k: 0, e: false }].slice(-3) });
    }
    if (streicheln || mem) plan(sek(a + 8 * 36e5), { cute: { d: tag, n: streicheln, m: mem } });
    for (let i = 0; i < paeckchen; i++) {
      const t = sek(a + 9 * 36e5 + i * 6e5);
      plan(t, { gift: { ...P.gift, z: P.gift.z + 1 } });
      plan(t + 60000, { gift: { ...P.gift, o: P.gift.o + 1 } });
    }
    for (let i = 0; i < putzen + gross; i++) {
      const t = sek(a + 10 * 36e5 + i * 6e4);
      S = i < putzen ? { ...S, m: S.m | (1 << bit++) } : { ...S, c: t, l: t, m: 0 };
      V.S.push({ t, s: T.serialize(S) });
    }
  }
  return V;
};

test('Chronik: Bilanz eines Tages aus einem nachgestellten Verlauf der beiden Helfer', () => {
  const g = HEUTE - 1;
  const V = chronikVerlauf([[g - 1, { futter: 1, streicheln: 30, mem: 256 }],
    [g, { futter: 2, streicheln: 12, mem: 16 | 64 | 4, paeckchen: 1, putzen: 2, gross: 1 }], [g + 1, { futter: 4, streicheln: 2, mem: 256, putzen: 1 }]]);
  const R = T.diaryDerive(V.S.map((r) => ({ t: r.t, v: T.parseStats(r.s) })), V.P.map((r) => ({ t: r.t, v: T.planParse(r.s) })), T.chronikStart(g - 1),
    { decayAt: () => Infinity, until: NOW });
  const bil = (tag) => T.chronikKod(T.chronikBilanz(R.ev, R.pets, T.chronikStart(tag), T.chronikStart(tag + 1), tag));
  // (Kaffee, Bit 4, ist ein Erlebnis, aber kein Besuch)
  assert.equal(bil(g), `Pika-Tag ${datum(g)} · futter=2 streicheln=12 putzen=3 paeckchen=1 besuch=pino,vogel`);
  assert.equal(bil(g - 1), `Pika-Tag ${datum(g - 1)} · futter=1 streicheln=30 putzen=0 paeckchen=0 besuch=falter`);
  assert.equal(bil(g + 1), `Pika-Tag ${datum(g + 1)} · futter=4 streicheln=2 putzen=1 paeckchen=0 besuch=falter`);
  assert.equal(bil(g + 2), `Pika-Tag ${datum(g + 2)} · futter=0 streicheln=0 putzen=0 paeckchen=0 besuch=-`);
  assert.equal(R.ev.filter((e) => e.k === 'hungry').length, 0, 'ohne Abbau-Rechnung kein „Bauch knurrt“');
  // Grenzen: start gehört dazu, end nicht; gestreichelt höchstens 99 („99 oder mehr“)
  const ev = [{ t: 1000, k: 'feed' }, { t: 1999, k: 'feed' }, { t: 2000, k: 'feed' }, { t: 999, k: 'feed' }, { t: 1500, k: 'clean', n: 3 },
    { t: 1500, k: 'clean', n: 1, all: true }, { t: 1500, k: 'parcel' }, { t: 1500, k: 'mem', b: 'bfly' }, { t: 1500, k: 'mem', b: 'pino' },
    { t: 1500, k: 'mem', b: 'coffee' }, { t: 1500, k: 'mem', b: 'constructor' }, { t: 1500, k: 'act', a: 'read' }];
  assert.equal(T.chronikKod(T.chronikBilanz(ev, { [g]: 250, [g - 1]: 7 }, 1000, 2000, g)),
    `Pika-Tag ${datum(g)} · futter=2 streicheln=99 putzen=4 paeckchen=1 besuch=pino,falter`);
  assert.equal(T.chronikKod(T.chronikBilanz([], {}, 1000, 2000, g)), `Pika-Tag ${datum(g)} · futter=0 streicheln=0 putzen=0 paeckchen=0 besuch=-`);
});

test('Chronik: welche Tage fehlen, und was in der Liste steht (Dopplungen zusammengeführt, Fremdes nicht mitgezählt)', () => {
  const h = HEUTE;
  const items = [
    { summary: 'Milch kaufen', uid: 'm', status: 'needs_action' },
    { summary: `Pika-Tag ${datum(h - 1)} · futter=1 streicheln=2 putzen=0 paeckchen=0 besuch=-`, uid: 'a', status: 'needs_action' },
    { summary: `Pika-Tag ${datum(h - 1)} · futter=3 streicheln=1 putzen=0 paeckchen=0 besuch=pino`, uid: 'b', status: 'needs_action' },
    { summary: `Pika-Tag ${datum(h - 3)} da waren wir im Zoo`, uid: 'c', status: 'needs_action' },
    { summary: `Pika-Tag ${datum(h - 5)} · futter=2`, uid: 'd', status: 'completed', completed: '2026-11-08T10:00:00+00:00' }, // abgehakt zählt
    { summary: `Pika-Tag ${datum(h)} · futter=9`, uid: 'e', status: 'needs_action' }, // heute: geht das Nachtragen nichts an
    { summary: `Pika-Tag ${datum(h - 30)} · futter=4`, uid: 'f', status: 'needs_action' },
    { uid: 'kaputt' }, null,
  ];
  assert.deepEqual(plain(T.chronikFehlt(items, h, 7)), [h - 7, h - 6, h - 4, h - 2]);
  assert.deepEqual(plain(T.chronikFehlt(items, h, 1)), []);
  assert.deepEqual(plain(T.chronikFehlt([], h, 3)), [h - 3, h - 2, h - 1]);
  assert.deepEqual(plain(T.chronikFehlt(undefined, h, 2)), [h - 2, h - 1]);
  const tage = T.chronikTage(items);
  assert.deepEqual([...tage.keys()].sort(), [datum(h - 30), datum(h - 5), datum(h - 1), datum(h)]);
  assert.equal(T.chronikKod(tage.get(datum(h - 1))), `Pika-Tag ${datum(h - 1)} · futter=3 streicheln=2 putzen=0 paeckchen=0 besuch=pino`);
  assert.equal(tage.has(datum(h - 3)), false, '„fremd für diesen Tag“ ist kein lesbarer Stand');
  assert.equal(T.chronikTage(undefined).size, 0);
});

// Nachgestellte To-do-Liste mit dem an local_todo gemessenen Verhalten: Die Liste vergibt die uid (add_item antwortet
// ohne sie), der Titel wird getrimmt, ein leerer abgelehnt; eine unbekannte uid wird als schlichtes Objekt abgelehnt,
// eine Liste von uids ganz oder gar nicht gelöscht. start: Titel (wie angelegt) oder fertige Einträge.
// „Gibt es nicht“ sagt HA auf zwei Arten (beide gemessen): für eine uid, die es nie gab, als service_validation_error;
// für eine, die eben erst gelöscht wurde (ein anderes Gerät war schneller), als unknown_error „No existing item“, weil
// HA die uid zuerst gegen seinen gemerkten Stand der Liste prüft und erst im Speicher scheitert. Die Attrappe kennt
// keine Zeit: Was sie selbst gelöscht hat, gilt als eben gelöscht.
const todoListe = (start = [], uid = (n) => `u${String(n).padStart(3, '0')}`) => {
  // weg: so oft „gibt es nicht“ geantwortet, spaet: davon in der Form „eben gelöscht“, neu: mit add_item angelegte Titel
  const L = { items: [], n: 0, weg: 0, spaet: 0, neu: [], fort: new Set() };
  const ziel = { entity_id: CH };
  const fehlt = (item) => {
    L.weg++;
    if (!L.fort.has(item)) return { code: 'service_validation_error', message: `Validation error: Unable to find to-do list item: ${item}` };
    L.spaet++;
    return { code: 'unknown_error', message: `No existing item with uid/recurrence_id: ${item}/None` };
  };
  const finde = (item) => L.items.find((x) => x.uid === item) || L.items.find((x) => x.summary === item);
  const da = (id) => {
    if (id !== CH) throw { code: 'not_found', message: 'Entity not found' };
  };
  L.lies = (m) => {
    da(m.entity_id);
    return { items: L.items.map((x) => ({ ...x })) };
  };
  L.dienst = (name, data, z) => {
    da(z?.entity_id);
    if (name === 'add_item') {
      const summary = String(data.item ?? '').trim();
      if (!summary) throw { code: 'invalid_format', message: 'string value is empty' };
      L.items.push({ summary, uid: uid(++L.n), status: 'needs_action' });
      L.neu.push(summary);
    } else if (name === 'update_item') {
      const x = finde(data.item);
      if (!x) throw fehlt(data.item);
      if (data.rename != null) x.summary = String(data.rename).trim();
    } else if (name === 'remove_item') {
      const ids = [data.item].flat();
      const xs = ids.map(finde);
      if (xs.some((x) => !x)) throw fehlt(ids.find((i) => !finde(i)));
      for (const x of xs) L.fort.add(x.uid);
      L.items = L.items.filter((x) => !xs.includes(x));
    } else throw { code: 'not_found', message: 'Service not found' };
    return { context: { id: '01JCX', parent_id: null, user_id: 'u' } };
  };
  for (const s of start) {
    if (typeof s === 'string') L.dienst('add_item', { item: s }, ziel);
    else L.items.push({ ...s });
  }
  L.neu = [];
  return L;
};
// Schritte aus chronikPlan auf die Liste anwenden
const planAnwenden = (L, steps) => {
  for (const s of steps) {
    if (s.op === 'add') L.dienst('add_item', { item: s.summary }, { entity_id: CH });
    else if (s.op === 'update') L.dienst('update_item', { item: s.uid, rename: s.summary }, { entity_id: CH });
    else L.dienst('remove_item', { item: s.uid }, { entity_id: CH });
  }
};

test('Chronik: der Plan löst Dopplungen auf (die kleinste uid bleibt), legt Fehlendes an, und nach dem Anwenden ist er leer', () => {
  const start = [
    { summary: 'Milch kaufen', uid: 'm1', status: 'needs_action', description: 'Bio' },
    { summary: 'Pika-Tag 2026-11-08 · futter=2 streicheln=5 putzen=0 paeckchen=0 besuch=-', uid: 'c9', status: 'needs_action' },
    { summary: 'Pika-Tag 2026-11-08 · futter=3 streicheln=1 putzen=0 paeckchen=0 besuch=pino', uid: 'b2', status: 'completed', description: 'Notiz von Mama' },
    { summary: 'Pika-Tag 2026-11-08 · futter=1 streicheln=9 putzen=1 paeckchen=0 besuch=-', uid: 'd1', status: 'needs_action' },
    { summary: 'Pika-Tag 2026-11-09 war ein schöner Tag', uid: 'a0', status: 'needs_action' }, // fremd für diesen Tag
    { summary: 'Pika-Tag 2026-11-07   futter=1 besuch=vogel,pino', uid: 'e5', status: 'needs_action' }, // lesbar, nur anders formatiert
    { summary: 'Pika-Tag 2026-11-06 · futter=4 besuch=- zukunft=ja', uid: 'f1', status: 'needs_action' },
    { summary: 'Pika-Tag 2026-11-06 · futter=4 besuch=- zukunft=ja', uid: 'f0', status: 'needs_action' }, // zweimal dasselbe
    { summary: 'Pika-Tag 2026-11-05 · futter=1', uid: '9', status: 'needs_action' },
    { summary: 'Pika-Tag 2026-11-05 · futter=2', uid: '10', status: 'needs_action' }, // als Text ist „10“ kleiner als „9“
  ];
  const L = todoListe(start);
  const ohne = plain(T.chronikPlan(L.lies({ entity_id: CH }).items));
  assert.deepEqual(ohne, [
    { op: 'remove', d: '2026-11-05', uid: '9' },
    { op: 'remove', d: '2026-11-06', uid: 'f1' },
    { op: 'update', d: '2026-11-08', uid: 'b2', summary: 'Pika-Tag 2026-11-08 · futter=3 streicheln=9 putzen=1 paeckchen=0 besuch=pino' },
    { op: 'remove', d: '2026-11-08', uid: 'c9' },
    { op: 'remove', d: '2026-11-08', uid: 'd1' },
  ]);
  // mit soll: neue Tage anlegen (aufsteigend), in Lesbares hineinmischen (nur wenn sich die Bedeutung ändert), Fremdes lassen
  const soll = new Map([
    ['2026-11-10', eintrag('2026-11-10', { futter: 1, streicheln: 0, putzen: 0, paeckchen: 0, besuch: [] })],
    ['2026-11-04', eintrag('2026-11-04', { futter: 7, besuch: ['falter'] })],
    ['2026-11-09', eintrag('2026-11-09', { futter: 5 })], // der Tag ist „fremd“ belegt: nichts
    ['2026-11-07', eintrag('2026-11-07', { futter: 1, besuch: ['pino'] })], // steht schon drin: nichts
    ['2026-11-08', eintrag('2026-11-08', { paeckchen: 2 })],
    ['2026-13-01', eintrag('2026-13-01', { futter: 1 })], // kein Datum: nichts
  ]);
  const mit = plain(T.chronikPlan(L.lies({ entity_id: CH }).items, soll));
  assert.deepEqual(mit, [
    { op: 'add', d: '2026-11-04', summary: 'Pika-Tag 2026-11-04 · futter=7 besuch=falter' },
    ohne[0], ohne[1],
    { op: 'update', d: '2026-11-08', uid: 'b2', summary: 'Pika-Tag 2026-11-08 · futter=3 streicheln=9 putzen=1 paeckchen=2 besuch=pino' },
    ohne[3], ohne[4],
    { op: 'add', d: '2026-11-10', summary: 'Pika-Tag 2026-11-10 · futter=1 streicheln=0 putzen=0 paeckchen=0 besuch=-' },
  ]);
  // soll darf auch ein Objekt oder eine Liste von Paaren sein
  assert.deepEqual(plain(T.chronikPlan(L.lies({ entity_id: CH }).items, Object.fromEntries(soll))), mit);
  assert.deepEqual(plain(T.chronikPlan(L.lies({ entity_id: CH }).items, [...soll])), mit);
  // ändert sich die Bedeutung, bekommt auch der anders formatierte Eintrag den gemeinsamen Titel
  assert.deepEqual(plain(T.chronikPlan([start[5]], [['2026-11-07', eintrag('2026-11-07', { futter: 6 })]])),
    [{ op: 'update', d: '2026-11-07', uid: 'e5', summary: 'Pika-Tag 2026-11-07 · futter=6 besuch=pino,vogel' }]);
  planAnwenden(L, T.chronikPlan(L.lies({ entity_id: CH }).items, soll));
  assert.equal(L.weg, 0);
  const nach = L.lies({ entity_id: CH }).items;
  assert.deepEqual(plain(T.chronikPlan(nach)), [], 'nach dem Anwenden gibt es nichts mehr zu tun');
  assert.deepEqual(plain(T.chronikPlan(nach, soll)), [], 'auch nicht mit demselben soll');
  const von = (u) => nach.find((x) => x.uid === u);
  // Mensch und „fremd für diesen Tag“ unangetastet, der nur anders formatierte Eintrag nicht umgeschrieben
  for (const i of [0, 4, 5]) assert.deepEqual(von(start[i].uid), start[i]);
  // Status und Beschreibung des bleibenden Eintrags gehören dem Menschen
  assert.deepEqual(von('b2'), { ...start[2], summary: 'Pika-Tag 2026-11-08 · futter=3 streicheln=9 putzen=1 paeckchen=2 besuch=pino' });
  assert.deepEqual(nach.map((x) => x.uid), ['m1', 'b2', 'a0', 'e5', 'f0', '10', 'u001', 'u002']);
  const jeTag = nach.map((x) => T.chronikLies(x.summary)).filter((e) => e).map((e) => e.d);
  assert.equal(new Set(jeTag).size, jeTag.length, 'jeder Tag steht genau einmal da');
  assert.equal(jeTag.length, 7);
  // ohne uid ließe sich nichts ändern oder löschen: Der Tag bleibt, wie er ist
  assert.deepEqual(plain(T.chronikPlan([{ summary: 'Pika-Tag 2026-11-05 · futter=1' }, { summary: 'Pika-Tag 2026-11-05 · futter=2', uid: 'x' }],
    [['2026-11-05', eintrag('2026-11-05', { futter: 9 })]])), []);
});

// hass für die echten Methoden der Chronik: To-do-Liste L (todoListe) und ein Recorder, der aus V (chronikVerlauf)
// antwortet. Z.ruf zählt jeden Aufruf an HA mit, Z.hist die Anfragen an den Verlauf, Z.laut den fünften Parameter der
// Dienstaufrufe.
const chronikRecorder = (V, Z) => (m) => {
  Z?.hist.push(m);
  const from = Date.parse(m.start_time);
  const to = Date.parse(m.end_time);
  // wie HA: der letzte Stand vor dem Zeitraum als erster, mit dem Beginn als Zeit
  const aus = (all) => {
    const vor = all.filter((r) => r.t <= from).at(-1);
    return [...(vor ? [{ s: vor.s, lu: from / 1000 }] : []), ...all.filter((r) => r.t > from && r.t < to).map((r) => ({ s: r.s, lu: r.t / 1000 }))];
  };
  return Object.fromEntries(m.entity_ids.map((id) => [id, aus(id === 'input_text.s' ? V.S : id === 'input_text.p' ? V.P : [])]));
};
const chronikHass = (L, rec, Z = { ruf: [], hist: [] }) => {
  const ruf = (name, tun) => {
    Z.ruf.push(name);
    try {
      return Promise.resolve(tun());
    } catch (e) {
      return Promise.reject(e);
    }
  };
  return {
    connected: true,
    states: {
      'input_text.s': { state: '80.0,1,80.0,1,1,0,1' }, 'input_text.p': { state: 'p1|3.1.-.0|-|-|-', attributes: { max: 255 } },
      [CH]: { state: '0', attributes: { friendly_name: 'Pikas Chronik', supported_features: 127 } },
    },
    callWS: (m) => ruf(m.type, () => (m.type === 'todo/item/list' ? L.lies(m) : rec(m))),
    // (fünfter Parameter: notifyOnError. Mit allem außer false zeigt das Frontend von HA bei einer Ablehnung eine
    // Meldung am Bildschirm; Z.laut schreibt mit, was die Karte übergibt)
    callService: (dom, name, data, ziel, ...mehr) => ruf(`${dom}.${name}`, () => {
      (Z.laut ??= []).push(mehr[0]);
      if (dom !== 'todo') throw { code: 'not_found', message: 'Service not found' };
      return L.dienst(name, data, ziel);
    }),
  };
};
// Karte mit beiden Helfern in HA, Zustand und Plan geladen. um(t) stellt die Uhr von HA: die der Karte (_haNow) und
// den Zeitstempel, den HA zuletzt vergeben hat (last_updated am Helfer für den Zustand; daran erkennt die Chronik,
// dass HA den Tag erreicht hat). um(t, ha) stellt beides getrennt: eine Geräteuhr, die falsch geht, solange noch keine
// Zeitprobe von HA da ist (ha = null: kein Stempel).
const chronikKarte = (hass, cfg = {}) => {
  const c = Object.create(T.PikaPetCard.prototype);
  Object.assign(c, {
    _cfg: { name: 'Pika', entity: 'input_text.s', plan_entity: 'input_text.p', chronicle_entity: CH, ...cfg },
    _hass: hass, _synced: true, _planOk: true, _attached: true,
  });
  c.um = (t, ha = t) => {
    c._clockUse = t - Date.now();
    if (ha == null) delete hass.states['input_text.s'].last_updated;
    else hass.states['input_text.s'].last_updated = new Date(ha).toISOString();
  };
  return c;
};
const mitSpeicher = async (fn) => {
  const M = new Map();
  WELT.localStorage = { getItem: (k) => (M.has(k) ? M.get(k) : null), setItem: (k, v) => void M.set(k, String(v)), removeItem: (k) => void M.delete(k) };
  try {
    return await fn(M);
  } finally {
    delete WELT.localStorage;
  }
};
// Der Takt der Karte (_tick), alles andere darin stillgelegt
const nurTakt = (c) => Object.assign(c, {
  _away: () => false, _watchdog() {}, _tickCore() {}, _tickSky() {}, _tickFest() {}, _tickFriend() {}, _tickBote() {}, _tickCoffee() {},
  _tickGift() {}, _diaryDot() {},
});

test('Chronik am Gerät: ohne chronicle_entity kein Aufruf an HA, kein Zeitgeber, nichts im Browser', async () => {
  await mitSpeicher(async (M) => {
    const g = HEUTE - 1;
    const Z = { ruf: [], hist: [] };
    const L = todoListe();
    const c = nurTakt(chronikKarte(chronikHass(L, chronikRecorder(chronikVerlauf([[g, { futter: 2 }]]), Z), Z), { chronicle_entity: null }));
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    let takte = 0;
    const echt = c._chronikTick;
    c._chronikTick = function () {
      takte++;
      return echt.call(this);
    };
    const z0 = zeitgeber;
    const w0 = warned.length;
    const l0 = leise.length;
    for (let i = 0; i < 5; i++) c._tick();
    assert.equal(takte, 5, 'der Takt der Karte kommt bei der Chronik an');
    assert.equal(c._chronikOn(), false);
    assert.equal(await c._chronikNow(), null);
    assert.equal(await c._chronikLesen(), null);
    c._chronikStop(); // wie beim Abhängen
    await gleich();
    assert.deepEqual(Z.ruf, []);
    assert.equal(zeitgeber, z0, 'kein Zeitgeber');
    assert.equal(M.size, 0, 'nichts im Browser gemerkt');
    assert.equal(L.items.length, 0);
    assert.ok(!c._chronikBusy && !c._chronikStand && c._chronikJit === undefined);
    assert.equal(c._errs, undefined);
    assert.equal(warned.length, w0);
    assert.equal(leise.length, l0);
    // Gegenprobe mit derselben Karte und denselben Attrappen: Mit der Option wird gelesen, nachgetragen und gemerkt.
    // (Sonst wäre oben auch dann alles still, wenn die Attrappen gar nicht erreicht würden.)
    c._cfg.chronicle_entity = CH;
    c._dbgChronik = { check: 1 };
    c._chronikJit = 0;
    c._tick();
    assert.equal(takte, 6);
    assert.equal(await c._chronikBusy.p, true);
    assert.deepEqual(Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list']);
    assert.equal(zeitgeber, z0 + 1, 'ein Zeitgeber: die Wartezeit vor dem Nachprüfen');
    assert.deepEqual([...M], [['pika-pet-chronik:Pika', `${CH}|${HEUTE}`]]);
    assert.deepEqual(L.items.map((x) => x.summary), [`Pika-Tag ${datum(g)} · futter=2 streicheln=0 putzen=0 paeckchen=0 besuch=-`]);
  });
  // ein Fehler in der Chronik reißt den Takt nicht mit und steht unter „Chronik“ im Fehlerspeicher
  const d = nurTakt(chronikKarte(chronikHass(todoListe(), () => ({}))));
  d._chronikTick = () => d.gibtEsNicht();
  const w1 = warned.length;
  d._tick();
  assert.deepEqual(plain(d._errs).map((e) => [e.where, e.n]), [['Chronik', 1]]);
  assert.equal(warned.length, w1 + 1);
});

test('Chronik am Gerät: lesen, Verlauf, anlegen, nachprüfen; am selben Tag kein zweites Mal', async () => {
  const g = HEUTE - 1;
  // vorgestern nichts im Verlauf: Was kein Gerät gezeigt hat, wird nicht geschrieben
  const V = chronikVerlauf([[g - 2, { futter: 1, streicheln: 3 }], [g, { futter: 2, streicheln: 12, mem: 16 | 64, paeckchen: 1, putzen: 3 }]]);
  const L = todoListe(['Milch kaufen', `Pika-Tag ${datum(g - 3)} war schön`]);
  const Z = { ruf: [], hist: [] };
  // (mit einem Gerät für den Haus-Boten: Dessen Verlauf braucht das Tagebuch, die Chronik nicht)
  const c = chronikKarte(chronikHass(L, chronikRecorder(V, Z), Z), { appliances: [{ type: 'washer', state: 'sensor.waschmaschine' }] });
  c._dbgChronik = { check: 5 };
  const a = T.chronikStart(HEUTE);
  // der Versatz wird einmal je Karte gewürfelt, unter CHRONIK.jitter
  c.um(a + 60000);
  c._chronikTick();
  const jit = c._chronikJit;
  assert.ok(jit >= 0 && jit < T.CHRONIK.jitter);
  c._chronikTick();
  assert.equal(c._chronikJit, jit);
  const andere = chronikKarte(chronikHass(L, chronikRecorder(V)));
  andere.um(a + 60000);
  andere._chronikTick();
  assert.notEqual(andere._chronikJit, jit, 'zwei Karten würfeln nicht dasselbe');
  // frühestens Tagesbeginn + Wartezeit + Versatz
  c._chronikJit = 3 * 6e4;
  c.um(a + T.CHRONIK.wait + 3 * 6e4 - 5000);
  c._chronikTick();
  // und erst, wenn Zustand und Plan geladen und frisch sind
  c.um(a + T.CHRONIK.wait + 3 * 6e4 + 1000);
  for (const [k, v] of [['_synced', false], ['_planOk', false], ['_planStale', true]]) {
    const alt = c[k];
    c[k] = v;
    c._chronikTick();
    c[k] = alt;
  }
  assert.ok(!c._chronikBusy);
  assert.deepEqual(Z.ruf, []);
  c._chronikTick();
  const lauf = c._chronikBusy;
  assert.ok(lauf);
  c._chronikTick(); // während ein Lauf läuft, beginnt kein zweiter
  assert.equal(c._chronikBusy, lauf);
  assert.equal(await lauf.p, true);
  assert.deepEqual(Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo.add_item', 'todo/item/list']);
  // jeder Dienstaufruf mit notifyOnError = false: Eine Ablehnung zeigt in HA keine Meldung am Bildschirm
  assert.deepEqual(Z.laut, [false, false]);
  // EIN Abruf, vom Beginn des ältesten fehlenden Tags bis jetzt, nur die beiden Helfer (ohne die Geräte des Haus-Boten)
  assert.equal(Z.hist.length, 1);
  assert.equal(Date.parse(Z.hist[0].start_time), T.chronikStart(HEUTE - 7));
  assert.ok(Math.abs(Date.parse(Z.hist[0].end_time) - (c._haNow() + 60000)) < 5000);
  assert.deepEqual(plain(Z.hist[0].entity_ids), ['input_text.s', 'input_text.p']);
  assert.deepEqual(L.items.map((x) => x.summary), ['Milch kaufen', `Pika-Tag ${datum(g - 3)} war schön`,
    `Pika-Tag ${datum(g - 2)} · futter=1 streicheln=3 putzen=0 paeckchen=0 besuch=-`,
    `Pika-Tag ${datum(g)} · futter=2 streicheln=12 putzen=3 paeckchen=1 besuch=pino,vogel`]);
  // der gelesene Stand hängt an der Karte (nach dem Nachprüfen: mit den eigenen Einträgen)
  assert.deepEqual([...c._chronikStand.tage.keys()], [datum(g - 2), datum(g)]);
  assert.equal(c._chronikStand.tage.get(datum(g)).streicheln, 12);
  assert.ok(Math.abs(c._chronikStand.t - c._haNow()) < 5000);
  assert.ok(!c._chronikBusy);
  // am selben Tag: kein Aufruf mehr
  for (let i = 0; i < 3; i++) c._chronikTick();
  await gleich();
  assert.equal(Z.ruf.length, 5);
  // am nächsten Tag wieder. Es fehlen noch Tage, aber der Verlauf weiß nichts über sie: lesen, Verlauf, fertig
  c.um(a + 864e5 + T.CHRONIK.wait + 3 * 6e4 + 1000);
  c._chronikTick();
  assert.equal(await c._chronikBusy.p, true);
  assert.deepEqual(Z.ruf.slice(5), ['todo/item/list', 'history/history_during_period']);
  assert.equal(Date.parse(Z.hist[1].start_time), T.chronikStart(HEUTE - 6));
  assert.equal(L.items.length, 4);
  // _chronikLesen: nur lesen
  const S = await c._chronikLesen();
  assert.equal(S, c._chronikStand);
  assert.equal(Z.ruf.length, 8);
  assert.equal(Z.ruf[7], 'todo/item/list');
  assert.equal(S.tage.size, 2);
  assert.ok(Z.ruf.every((r) => !r.startsWith('input_text.')), 'die Helfer schreibt die Chronik nie');
  assert.equal(c._errs, undefined);
  // Das Tagebuch fragt wie bisher: auch nach den Geräten des Haus-Boten, und ein Fehlschlag ist dort eine Warnung
  const H = await c._diaryHist(T.chronikStart(g), c._haNow());
  assert.deepEqual(plain(Z.hist.at(-1).entity_ids), ['input_text.s', 'input_text.p', 'sensor.waschmaschine']);
  assert.deepEqual(Object.keys(H).sort(), ['P', 'S', 'bote', 'fail', 'ha', 'none']);
  assert.deepEqual([H.fail, H.none, H.ha, H.bote.length, H.S.length > 1, H.P.length > 1], [false, false, true, 0, true, true]);
  c._hass.callWS = () => Promise.reject({ code: 'unknown_error', message: 'x' });
  const w0 = warned.length;
  const l0 = leise.length;
  assert.equal((await c._diaryHist(T.chronikStart(g), c._haNow())).fail, true);
  assert.deepEqual([warned.length - w0, leise.length - l0], [1, 0]);
  assert.equal((await c._diaryHist(T.chronikStart(g), c._haNow(), true)).fail, true);
  assert.deepEqual([warned.length - w0, leise.length - l0], [1, 1]);
});

test('Chronik am Gerät: „heute geprüft“ steht im Browser, je Name und Liste', async () => {
  await mitSpeicher(async (M) => {
    const g = HEUTE - 1;
    const V = chronikVerlauf([[g, { futter: 1 }]]);
    const L = todoListe();
    const Z = { ruf: [], hist: [] };
    const karte = (cfg) => {
      const c = chronikKarte(chronikHass(L, chronikRecorder(V, Z), Z), cfg);
      c._dbgChronik = { check: 1 };
      c._chronikJit = 0;
      c.um(T.chronikStart(HEUTE) + 6 * 36e5);
      return c;
    };
    const A = karte();
    A._chronikTick();
    assert.equal(await A._chronikBusy.p, true);
    assert.deepEqual([...M], [['pika-pet-chronik:Pika', `${CH}|${HEUTE}`]]);
    const n = Z.ruf.length;
    assert.equal(n, 4);
    // neu geladen (eine frische Karte im selben Browser): prüft heute nicht noch einmal
    const B = karte();
    for (let i = 0; i < 3; i++) B._chronikTick();
    assert.ok(!B._chronikBusy);
    assert.equal(Z.ruf.length, n);
    // ein anderer Name oder eine andere Liste ist eine andere Chronik: Die wird geprüft
    const C = karte({ name: 'Momo' });
    C._chronikTick();
    assert.equal(await C._chronikBusy.p, true);
    assert.deepEqual(Z.ruf.slice(n), ['todo/item/list', 'history/history_during_period'], 'gelesen; der Tag steht schon da, zu den älteren weiß der Verlauf nichts');
    assert.equal(M.get('pika-pet-chronik:Momo'), `${CH}|${HEUTE}`);
    M.set('pika-pet-chronik:Pika', `todo.alt|${HEUTE}`);
    const D = karte();
    D._chronikTick();
    assert.equal(await D._chronikBusy.p, true);
    assert.equal(Z.ruf.length, n + 4);
    assert.equal(M.get('pika-pet-chronik:Pika'), `${CH}|${HEUTE}`);
    // im Editor umbenannt: Der Merker zieht mit um
    D._lsRename('Pika', 'Pikachu');
    assert.equal(M.get('pika-pet-chronik:Pikachu'), `${CH}|${HEUTE}`);
    assert.equal(L.items.length, 1);
  });
});

test('Chronik am Gerät: eine vorgehende Geräteuhr löst nichts aus, geprüft wird erst, wenn HA den neuen Tag selbst gestempelt hat', async () => {
  const g = HEUTE - 1;
  const a = T.chronikStart(HEUTE);
  const echt = a + 6 * 36e5; // 10 Uhr am echten Tag
  // gestern ist abgeschlossen, heute läuft noch: Bisher wurde einmal gefüttert, am Abend kommt noch etwas dazu
  const V = chronikVerlauf([[g, { futter: 2, streicheln: 4 }], [HEUTE, { futter: 1 }]]);
  const gestern = `Pika-Tag ${datum(g)} · futter=2 streicheln=4 putzen=0 paeckchen=0 besuch=-`;
  const alle = ['sun.sun', 'input_text.s', 'input_text.p', 'weather.zuhause', CH];
  const neu = (cfg = {}) => {
    const L = todoListe();
    const Z = { ruf: [], hist: [] };
    const h = chronikHass(L, chronikRecorder(V, Z), Z);
    Object.assign(h.states, { 'sun.sun': { state: 'above_horizon' }, 'weather.zuhause': { state: 'cloudy' }, 'sensor.fremd': { state: '1' } });
    const c = chronikKarte(h, { sun_entity: 'sun.sun', weather_entity: 'weather.zuhause', ...cfg });
    c._dbgChronik = { check: 1 };
    c._chronikJit = 0;
    return { L, Z, h, c };
  };
  const iso = (t) => new Date(t).toISOString();
  await mitSpeicher(async (M) => {
    const { L, Z, h, c } = neu();
    // Die Geräteuhr geht einen Tag vor, eine Zeitprobe von HA gibt es noch nicht: Für die Karte ist „heute“ schon
    // morgen. HA hat zuletzt am echten Tag gestempelt.
    c.um(echt + 864e5, echt);
    assert.equal(T.pikaDay(c._haNow()), HEUTE + 1);
    assert.equal(c._chronikStempel(), echt);
    const z0 = zeitgeber;
    const l0 = leise.length;
    const still = (wo) => {
      for (let i = 0; i < 3; i++) c._chronikTick();
      assert.deepEqual(Z.ruf, [], wo);
      assert.ok(!c._chronikBusy && !c._chronikNext && !c._chronikOk, wo);
    };
    still('Stempel vom echten Tag');
    // kein Stempel, ein ungültiger, einer an einem Zustand, den die Karte nicht liest, einer knapp vor dem neuen Tag
    c.um(echt + 864e5, null);
    assert.equal(c._chronikStempel(), -Infinity);
    still('kein Stempel');
    h.states['input_text.s'].last_updated = 'gestern Abend';
    h.states['sun.sun'].last_updated = '';
    h.states[CH].last_updated = null;
    assert.equal(c._chronikStempel(), -Infinity);
    still('ungültige Stempel');
    h.states['sensor.fremd'].last_updated = iso(echt + 864e5);
    still('ein fremder Zustand zählt nicht');
    h.states['weather.zuhause'].last_updated = iso(a + 864e5 - 1);
    assert.equal(c._chronikStempel(), a + 864e5 - 1);
    still('eine Millisekunde vor dem neuen Tag');
    await gleich();
    assert.deepEqual(Z.ruf, []);
    assert.equal(L.items.length, 0, 'der laufende Tag steht nicht als abgeschlossen in der Liste');
    assert.equal(M.size, 0, 'nichts als geprüft gemerkt');
    assert.equal(zeitgeber, z0, 'kein Zeitgeber');
    assert.equal(leise.length, l0);
    assert.equal(c._errs, undefined);
    // Die erste Zeitprobe von HA stellt die Uhr: Es ist der echte Tag, und für den hat HA längst gestempelt
    c.um(echt, echt);
    assert.equal(T.pikaDay(c._haNow()), HEUTE);
    c._chronikTick();
    assert.equal(await c._chronikBusy.p, true);
    assert.deepEqual(Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list']);
    assert.deepEqual(L.items.map((x) => x.summary), [gestern], 'nur der abgeschlossene Tag');
    assert.deepEqual([...M], [['pika-pet-chronik:Pika', `${CH}|${HEUTE}`]]);
  });
  // Gegenprobe: _chronikNow (Vorschau, Tests) achtet nicht auf den Stempel. Mit derselben falschen Uhr stünde der
  // laufende Tag halb in der Liste, und niemand ergänzte ihn mehr.
  const F = neu();
  F.c.um(echt + 864e5, echt);
  assert.equal(await F.c._chronikNow(), true);
  assert.deepEqual(F.L.items.map((x) => x.summary), [gestern, `Pika-Tag ${datum(HEUTE)} · futter=1 streicheln=0 putzen=0 paeckchen=0 besuch=-`]);
  // Jeder der Zustände, die die Karte ohnehin liest, kann den Tag belegen (und nur, soweit er eingestellt ist). Die
  // Uhr stimmt hier: Auch dann wartet die Karte, bis HA nach 4 Uhr etwas gestempelt hat.
  for (const id of alle) {
    const { L, Z, h, c } = neu();
    c.um(echt, null);
    for (const k of [...alle, 'sensor.fremd']) h.states[k].last_updated = iso(a - 1);
    c._chronikTick();
    assert.ok(!c._chronikBusy, id);
    h.states[id].last_updated = iso(a); // genau zum Tagesbeginn
    c._chronikTick();
    assert.ok(c._chronikBusy, id);
    assert.equal(await c._chronikBusy.p, true, id);
    assert.deepEqual(L.items.map((x) => x.summary), [gestern], id);
    assert.equal(Z.ruf.length, 4, id);
  }
  for (const [k, id] of [['sun_entity', 'sun.sun'], ['weather_entity', 'weather.zuhause']]) {
    const { Z, h, c } = neu({ [k]: null });
    c.um(echt, null);
    h.states[id].last_updated = iso(echt);
    for (let i = 0; i < 3; i++) c._chronikTick();
    assert.ok(!c._chronikBusy, `${k} nicht eingestellt: Der Zustand zählt nicht`);
    assert.deepEqual(Z.ruf, []);
  }
  assert.equal(quell.split('this._chronikStempel()').length - 1, 1, 'genau eine Stelle fragt nach dem Stempel: _chronikTick');
});

test('Chronik am Gerät: Liste fehlt, lehnt ab oder die Verbindung ist weg: kein Fehler, der Lauf endet, später ein neuer Versuch', async () => {
  const g = HEUTE - 1;
  const V = chronikVerlauf([[g, { futter: 2 }]]);
  const ab = (wert) => () => Promise.reject(wert);
  // [Name, stören (gibt zurück, wie es wieder heil wird), so viele Aufrufe bis zum Ende, steht leise in der Konsole]
  const faelle = [
    ['Liste gibt es nicht', (K) => { const alt = K.h.states[CH]; delete K.h.states[CH]; return () => { K.h.states[CH] = alt; }; }, 0],
    ['Liste nicht erreichbar', (K) => { K.h.states[CH].state = 'unavailable'; return () => { K.h.states[CH].state = '0'; }; }, 0],
    ['Liste unbekannt', (K) => { K.h.states[CH].state = 'unknown'; return () => { K.h.states[CH].state = '0'; }; }, 0],
    ['Liste nimmt nichts an', (K) => { K.h.states[CH].attributes.supported_features = 126; return () => { K.h.states[CH].attributes.supported_features = 127; }; }, 0],
    ['Verbindung getrennt', (K) => { K.h.connected = false; return () => { K.h.connected = true; }; }, 0],
    ['Zustand liegt nicht in HA', (K) => { K.c._noEntity = true; return () => { K.c._noEntity = false; }; }, 0],
    ['Tagesplan liegt nicht in HA', (K) => { const alt = K.h.states['input_text.p']; delete K.h.states['input_text.p']; return () => { K.h.states['input_text.p'] = alt; }; }, 0],
    ['Lesen abgelehnt', (K) => K.stoer('callWS', 'todo/item/list', ab({ code: 'not_found', message: 'Entity not found' })), 1, 1],
    ['Verbindung reißt beim Lesen', (K) => K.stoer('callWS', 'todo/item/list', ab(3)), 1, 1],
    ['Antwort ohne Liste', (K) => K.stoer('callWS', 'todo/item/list', () => Promise.resolve({})), 1, 0],
    ['Verlauf abgelehnt', (K) => K.stoer('callWS', 'history/history_during_period', ab({ code: 'unknown_command', message: 'Unknown command.' })), 2, 1],
    ['Recorder zeichnet die Helfer nicht auf', (K) => K.stoer('callWS', 'history/history_during_period', () => Promise.resolve({})), 2, 0],
    ['Anlegen abgelehnt', (K) => K.stoer('callService', 'todo.add_item', ab({ code: 'service_validation_error', message: 'Validation error: nope' })), 3, 1],
    ['Verbindung reißt beim Anlegen', (K) => K.stoer('callService', 'todo.add_item', ab({ code: 3, message: 'Connection lost' })), 3, 1],
  ];
  const w0 = warned.length;
  let leiseDazu = 0;
  for (const [name, stoeren, rufe, sagt = 0] of faelle) {
    const L = todoListe(['Milch kaufen']);
    const Z = { ruf: [], hist: [] };
    const h = chronikHass(L, chronikRecorder(V, Z), Z);
    const c = chronikKarte(h);
    const K = { h, c, stoer: (wo, was, statt) => {
      const alt = h[wo];
      h[wo] = (...a) => {
        const ruf = wo === 'callWS' ? a[0].type : `${a[0]}.${a[1]}`;
        if (ruf !== was) return alt(...a);
        Z.ruf.push(ruf);
        return statt();
      };
      return () => { h[wo] = alt; };
    } };
    c._dbgChronik = { check: 1 };
    c._chronikJit = 0;
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    const heil = stoeren(K);
    const l0 = leise.length;
    c._chronikTick();
    if (rufe) {
      assert.ok(c._chronikBusy, name);
      assert.equal(await c._chronikBusy.p, false, name);
      // nicht als geprüft gemerkt, und der nächste Versuch frühestens nach CHRONIK.retry
      assert.ok(Math.abs(c._chronikNext - Date.now() - T.CHRONIK.retry) < 5000, name);
      leiseDazu += sagt;
    } else {
      assert.ok(!c._chronikBusy && !c._chronikNext, name);
      assert.equal(await c._chronikNow(), null, name);
      assert.equal(await c._chronikLesen(), null, name);
    }
    assert.equal(Z.ruf.length, rufe, `${name}: ${Z.ruf.join(', ')}`);
    assert.equal(leise.length - l0, sagt, `${name}: höchstens eine leise Zeile in der Konsole`);
    assert.ok(!c._chronikBusy, `${name}: der Lauf ist zu Ende`);
    assert.equal(c._errs, undefined, `${name}: kein Fehler der Karte`);
    assert.deepEqual(L.items.map((x) => x.summary), ['Milch kaufen'], name);
    for (let i = 0; i < 3; i++) c._chronikTick();
    await gleich();
    assert.equal(Z.ruf.length, rufe, `${name}: solange es so bleibt, kein weiterer Aufruf`);
    // wieder heil: ohne Fehlschlag gleich, nach einem Fehlschlag erst, wenn die Pause um ist
    heil();
    c._chronikTick();
    assert.equal(!!c._chronikBusy, !rufe, name);
    c._chronikNext = Date.now() - 1;
    c._chronikTick();
    assert.equal(await c._chronikBusy.p, true, name);
    assert.deepEqual(Z.ruf.slice(rufe), ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list'], name);
    assert.deepEqual(L.items.map((x) => x.summary), ['Milch kaufen', `Pika-Tag ${datum(g)} · futter=2 streicheln=0 putzen=0 paeckchen=0 besuch=-`], name);
    assert.equal(c._errs, undefined, name);
  }
  assert.equal(faelle.length, 14);
  assert.equal(leiseDazu, 5);
  assert.equal(warned.length, w0, 'nichts davon ist eine Warnung');
});

test('Chronik am Gerät: ein Fehler im eigenen Code steht im Fehlerspeicher, der Lauf endet trotzdem', async () => {
  const L = todoListe();
  const Z = { ruf: [], hist: [] };
  const c = chronikKarte(chronikHass(L, chronikRecorder(chronikVerlauf([[HEUTE - 1, { futter: 2 }]]), Z), Z));
  c._chronikJit = 0;
  c.um(T.chronikStart(HEUTE) + 6 * 36e5);
  c._chronikDo = null; // „this._chronikDo is not a function“: ein Error aus der Karte selbst
  const l0 = leise.length;
  c._chronikTick();
  assert.equal(await c._chronikBusy.p, false);
  assert.deepEqual(plain(c._errs).map((e) => [e.where, e.n]), [['Chronik', 1]]);
  assert.match(c._errs[0].msg, /_chronikDo/);
  assert.equal(leise.length, l0);
  assert.ok(!c._chronikBusy);
  assert.ok(c._chronikNext > Date.now());
  assert.deepEqual(Z.ruf, ['todo/item/list', 'history/history_during_period']);
  // ein Lauf, der hängt (HA antwortet nie), wird nach CHRONIK.hang aufgegeben
  delete c._chronikDo;
  c._hass.callWS = () => new Promise(() => {});
  c._chronikNext = 0;
  c._chronikTick();
  const haengt = c._chronikBusy;
  assert.ok(haengt);
  c._chronikTick();
  assert.equal(c._chronikBusy, haengt);
  haengt.at -= T.CHRONIK.hang + 1000;
  c._chronikTick();
  assert.equal(c._chronikBusy, null);
  assert.ok(c._chronikNext > Date.now());
});

test('Chronik am Gerät: gelöscht wird erst nach frischem Lesen; eine verlorene Änderung kostet nichts', async () => {
  const d = datum(HEUTE - 1);
  // alle anderen Tage der Woche sind belegt, es fehlt nichts: kein Abruf des Verlaufs
  const rest = [2, 3, 4, 5, 6, 7].map((i) => `Pika-Tag ${datum(HEUTE - i)} · futter=0`);
  const zwei = [`Pika-Tag ${d} · futter=3 streicheln=1 putzen=0 paeckchen=0 besuch=-`, `Pika-Tag ${d} · futter=1 streicheln=8 putzen=0 paeckchen=0 besuch=pino`];
  const eins = `Pika-Tag ${d} · futter=3 streicheln=8 putzen=0 paeckchen=0 besuch=pino`;
  const lauf = async (L, feat = 127) => {
    const Z = { ruf: [], hist: [] };
    const c = chronikKarte(chronikHass(L, () => { throw new Error('der Verlauf wird nicht gebraucht'); }, Z));
    c._hass.states[CH].attributes.supported_features = feat;
    c._dbgChronik = { check: 1 };
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    assert.equal(await c._chronikNow(), true);
    assert.equal(c._errs, undefined);
    return { Z, c, titel: L.items.map((x) => x.summary).filter((s) => s.includes(d)) };
  };
  // gewöhnlich: ändern, lesen, löschen, lesen
  let R = await lauf(todoListe([...rest, ...zwei]));
  assert.deepEqual(R.Z.ruf, ['todo/item/list', 'todo.update_item', 'todo/item/list', 'todo.remove_item', 'todo/item/list']);
  assert.deepEqual(R.Z.laut, [false, false], 'auch Ändern und Löschen ohne Meldung am Bildschirm');
  assert.deepEqual(R.titel, [eins]);
  assert.equal(R.c._chronikStand.tage.get(d).streicheln, 8);
  // Die erste Änderung meldet Erfolg und geht verloren (gemessen: zwei gleichzeitige update_item). Gleich danach zu
  // löschen hieße, den Eintrag mit „streicheln=8“ zu verlieren. So fällt es beim Nachlesen auf.
  let L = todoListe([...rest, ...zwei]);
  const echt = L.dienst;
  let verloren = 0;
  L.dienst = (name, data, z) => (name === 'update_item' && !verloren++ ? { context: {} } : echt(name, data, z));
  R = await lauf(L);
  assert.equal(verloren, 2);
  assert.deepEqual(R.Z.ruf, ['todo/item/list', 'todo.update_item', 'todo/item/list', 'todo.update_item', 'todo/item/list', 'todo.remove_item', 'todo/item/list']);
  assert.deepEqual(R.titel, [eins]);
  // Der bleibende Eintrag ist inzwischen weg (jemand hat ihn gelöscht): nichts löschen, neu lesen. Der andere bleibt.
  L = todoListe([...rest, ...zwei]);
  const echt2 = L.dienst;
  L.dienst = (name, data, z) => {
    if (name === 'update_item') echt2('remove_item', { item: data.item }, z);
    return echt2(name, data, z);
  };
  R = await lauf(L);
  assert.deepEqual([L.weg, L.spaet], [1, 1]);
  assert.deepEqual(R.Z.ruf, ['todo/item/list', 'todo.update_item', 'todo/item/list']);
  assert.deepEqual(R.titel, [zwei[1]]);
  // Die Liste kann nicht ändern (ohne Bit 4): Dann wird auch nicht gelöscht, sonst ginge die Hälfte verloren
  R = await lauf(todoListe([...rest, ...zwei]), 1 | 2);
  assert.deepEqual(R.Z.ruf, ['todo/item/list']);
  assert.deepEqual(R.titel, zwei);
  // … zwei gleiche darf sie aufräumen
  R = await lauf(todoListe([...rest, zwei[0], zwei[0]]), 1 | 2);
  assert.deepEqual(R.Z.ruf, ['todo/item/list', 'todo.remove_item', 'todo/item/list']);
  assert.deepEqual(R.titel, [zwei[0]]);
  // Die Liste kann nicht löschen (ohne Bit 2): der gemeinsame Titel ja, die Dopplung bleibt
  R = await lauf(todoListe([...rest, ...zwei]), 1 | 4);
  assert.deepEqual(R.Z.ruf, ['todo/item/list', 'todo.update_item', 'todo/item/list']);
  assert.deepEqual(R.titel, [eins, zwei[1]]);
});

test('Chronik am Gerät: „den Eintrag gibt es nicht mehr“ sagt HA auf zwei Arten, beide heißen weitermachen und nachprüfen', async () => {
  const d = datum(HEUTE - 1);
  const rest = [2, 3, 4, 5, 6, 7].map((i) => `Pika-Tag ${datum(HEUTE - i)} · futter=0`);
  const a = `Pika-Tag ${d} · futter=3 streicheln=1 putzen=0 paeckchen=0 besuch=-`;
  const b = `Pika-Tag ${d} · futter=1 streicheln=8 putzen=0 paeckchen=0 besuch=pino`;
  // Beide Formen sind an HA 2026.11.1 gemessen: die erste für eine uid, die die Liste nicht kennt, die zweite, wenn
  // ein anderes Gerät denselben Eintrag eben erst gelöscht hat (der Fall „zwei Karten räumen dieselbe Dopplung ab“)
  const formen = [
    ['unbekannte uid', (uid) => ({ code: 'service_validation_error', message: `Validation error: Unable to find to-do list item: ${uid}` })],
    ['eben gelöscht', (uid) => ({ code: 'unknown_error', message: `No existing item with uid/recurrence_id: ${uid}/None` })],
    ['eben gelöscht, von der Attrappe selbst', null],
  ];
  // Das andere Gerät ist beim Ändern (op = update_item) oder beim Löschen (remove_item) um einen Aufruf schneller: Es
  // hat den Eintrag schon gelöscht. → Liste, Karte, Aufrufe, Ergebnis des Laufs
  const lauf = async (titel, op, sagt) => {
    const L = todoListe([...rest, ...titel]);
    const echt = L.dienst;
    L.dienst = (name, data, z) => {
      if (name !== op) return echt(name, data, z);
      echt('remove_item', { item: data.item }, z);
      if (typeof sagt !== 'function') return echt(name, data, z); // die Attrappe lehnt selbst ab
      throw sagt(data.item);
    };
    const Z = { ruf: [], hist: [] };
    const c = chronikKarte(chronikHass(L, () => { throw new Error('der Verlauf wird nicht gebraucht'); }, Z));
    c._dbgChronik = { check: 1 };
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    const erg = await c._chronikNow();
    return { L, c, ruf: Z.ruf, erg, titel: L.items.map((x) => x.summary).filter((s) => s.includes(d)) };
  };
  const w0 = warned.length;
  const l0 = leise.length;
  for (const [name, sagt] of formen) {
    // Löschen: zwei gleiche Einträge, der zweite ist schon weg
    let R = await lauf([a, a], 'remove_item', sagt);
    assert.equal(R.erg, true, name);
    assert.deepEqual(R.ruf, ['todo/item/list', 'todo.remove_item', 'todo/item/list'], `${name}: weiter, und nachgeprüft`);
    assert.deepEqual(R.titel, [a], name);
    assert.ok(R.c._errs === undefined && !R.c._chronikNext && !R.c._chronikBusy, name);
    if (!sagt) assert.deepEqual([R.L.weg, R.L.spaet], [1, 1], 'die Attrappe sagt „No existing item“');
    // Ändern: Der bleibende Eintrag ist schon weg. Nichts löschen, neu lesen: Der andere steht jetzt allein da.
    R = await lauf([a, b], 'update_item', sagt);
    assert.equal(R.erg, true, name);
    assert.deepEqual(R.ruf, ['todo/item/list', 'todo.update_item', 'todo/item/list'], name);
    assert.deepEqual(R.titel, [b], name);
    assert.ok(R.c._errs === undefined && !R.c._chronikNext && !R.c._chronikBusy, name);
    if (!sagt) assert.deepEqual([R.L.weg, R.L.spaet], [1, 1]);
  }
  assert.deepEqual([warned.length - w0, leise.length - l0], [0, 0], 'weder Warnung noch leise Zeile: Das ist der gewöhnliche Fall');
  // Gegenprobe: Derselbe code mit einer anderen Meldung ist etwas anderes: Fehlschlag, später noch einmal
  let R = await lauf([a, a], 'remove_item', () => ({ code: 'unknown_error', message: 'Unknown error' }));
  assert.equal(R.erg, false);
  assert.deepEqual(R.ruf, ['todo/item/list', 'todo.remove_item']);
  assert.ok(R.c._chronikNext > Date.now() && R.c._errs === undefined);
  assert.equal(leise.length - l0, 1);
  // … und ein Error mit passendem Text stammt aus dem eigenen Code: Der gehört in den Fehlerspeicher
  // (Error aus der Welt der Karte: Nur den erkennt sie mit instanceof)
  const KartenError = vm.runInContext('Error', WELT);
  R = await lauf([a, a], 'remove_item', () => new KartenError('No existing item with uid/recurrence_id: x/None'));
  assert.equal(R.erg, false);
  assert.deepEqual(plain(R.c._errs).map((e) => [e.where, e.n]), [['Chronik', 1]]);
  // die erkannten Formen für sich (auch ohne code; nie eine Zahl, ein Text oder nichts)
  const c = chronikKarte(chronikHass(todoListe(), () => ({})));
  assert.deepEqual([formen[0][1]('x'), formen[1][1]('x'), { message: 'no existing item' }, { code: 'unknown_error', message: 'x' }, { code: 'service_validation_error', message: 'Validation error: nope' },
    3, 'No existing item', null, undefined].map((e) => c._chronikGone(e)), [true, true, true, false, false, false, false, false, false]);
});

test('Chronik am Gerät: abgehängt oder andere Liste: der Lauf endet und schreibt nichts mehr', async () => {
  const g = HEUTE - 1;
  const V = chronikVerlauf([[g, { futter: 2 }]]);
  const L = todoListe();
  const Z = { ruf: [], hist: [] };
  const c = chronikKarte(chronikHass(L, chronikRecorder(V, Z), Z));
  c._dbgChronik = { check: 60000 }; // lange genug, dass der Lauf sicher noch wartet, wenn der Test ihn abbricht
  c.um(T.chronikStart(HEUTE) + 6 * 36e5);
  const z0 = zeitgeber;
  const p = c._chronikNow();
  for (let i = 0; i < 5 && !c._chronikW; i++) await gleich();
  assert.ok(c._chronikW, 'angelegt ist, der Lauf wartet vor dem Nachprüfen');
  assert.equal(zeitgeber, z0 + 1);
  assert.deepEqual(Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item']);
  const t = c._chronikW.t;
  c._chronikStop(); // das ruft _detach
  const weg = abgeraeumt.has(t);
  clearTimeout(t); // (bliebe er stehen, hielte er den Testlauf noch eine Minute offen)
  assert.ok(weg, 'der Zeitgeber ist abgeräumt');
  assert.equal(await p, null);
  assert.equal(Z.ruf.length, 3);
  assert.ok(!c._chronikBusy && !c._chronikW && !c._chronikOk && !c._chronikNext, 'weder geprüft noch Fehlschlag');
  const ab = [...quell.matchAll(/\n  _detach\(\) \{\n[\s\S]*?\n  \}\n/g)];
  assert.equal(ab.length, 1);
  assert.equal(ab[0][0].split('this._chronikStop();').length - 1, 1, '_detach beendet den Lauf');
  // wieder eingehängt: Der nächste Takt prüft neu (der Tag steht schon da: lesen, nichts fehlt … doch, die Tage davor)
  c._dbgChronik = { check: 1 };
  c._chronikJit = 0;
  c._chronikTick();
  assert.equal(await c._chronikBusy.p, true);
  assert.deepEqual(Z.ruf.slice(3), ['todo/item/list', 'history/history_during_period']);
  assert.equal(L.items.length, 1);

  // Andere Liste, während ein Aufruf unterwegs ist: Was danach käme, unterbleibt
  let weiter = null;
  const L2 = todoListe();
  const Z2 = { ruf: [], hist: [] };
  const h = chronikHass(L2, chronikRecorder(V, Z2), Z2);
  const ws = h.callWS;
  h.callWS = (m) => (m.type === 'todo/item/list' ? ws(m) : new Promise((ja) => { weiter = () => ja(ws(m)); }));
  const e = chronikKarte(h);
  e.um(T.chronikStart(HEUTE) + 6 * 36e5);
  const q = e._chronikNow();
  for (let i = 0; i < 5 && !weiter; i++) await gleich();
  assert.ok(weiter, 'der Verlauf ist angefragt');
  e._chronikStand = { t: 1, tage: new Map() };
  e._cfg = { ...e._cfg, chronicle_entity: 'todo.andere' };
  e._chronikReset(); // das ruft setConfig bei einer anderen Liste
  assert.equal(e._chronikStand, null);
  weiter();
  assert.equal(await q, null);
  await gleich();
  assert.deepEqual(Z2.ruf, ['todo/item/list', 'history/history_during_period']);
  assert.equal(L2.items.length, 0);
  assert.equal(e._errs, undefined);

  // Abgehängt, während das Anlegen unterwegs ist: Der Eintrag kommt noch an, danach stellt der Lauf keinen Zeitgeber
  // mehr (er prüft nicht nach; das holt der nächste Lauf)
  let fertig = null;
  const L3 = todoListe();
  const Z3 = { ruf: [], hist: [] };
  const h3 = chronikHass(L3, chronikRecorder(V, Z3), Z3);
  const sv = h3.callService;
  h3.callService = (...x) => new Promise((ja) => { fertig = () => ja(sv(...x)); });
  const f = chronikKarte(h3);
  f.um(T.chronikStart(HEUTE) + 6 * 36e5);
  const r = f._chronikNow();
  for (let i = 0; i < 5 && !fertig; i++) await gleich();
  assert.ok(fertig, 'das Anlegen ist unterwegs');
  const z1 = zeitgeber;
  f._chronikStop();
  fertig();
  assert.equal(await r, null);
  await gleich();
  assert.equal(L3.items.length, 1);
  assert.deepEqual(Z3.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item']);
  assert.equal(zeitgeber, z1, 'kein Zeitgeber an einer abgehängten Karte');
  assert.ok(!f._chronikW && !f._chronikBusy);

  // Zwei Tage fehlen, abgehängt wird, während der erste angelegt wird: Der zweite geht nicht mehr hinaus
  let los = null;
  const L4 = todoListe();
  const Z4 = { ruf: [], hist: [] };
  const h4 = chronikHass(L4, chronikRecorder(chronikVerlauf([[g - 1, { futter: 1 }], [g, { futter: 2 }]]), Z4), Z4);
  const sv4 = h4.callService;
  h4.callService = (...x) => new Promise((ja) => { los = () => ja(sv4(...x)); });
  const k = chronikKarte(h4);
  k.um(T.chronikStart(HEUTE) + 6 * 36e5);
  const r4 = k._chronikNow();
  for (let i = 0; i < 5 && !los; i++) await gleich();
  assert.ok(los, 'das erste Anlegen ist unterwegs');
  k._chronikStop();
  los();
  los = null;
  for (let i = 0; i < 5; i++) await gleich();
  assert.equal(los, null, 'kein zweiter Aufruf');
  assert.equal(await r4, null);
  assert.deepEqual(Z4.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item']);
  assert.deepEqual(L4.items.map((x) => x.summary), [`Pika-Tag ${datum(g - 1)} · futter=1 streicheln=0 putzen=0 paeckchen=0 besuch=-`]);
  // Gegenprobe mit denselben Attrappen, ohne abzuhängen: Beide Tage werden angelegt
  h4.callService = sv4;
  const k2 = chronikKarte(h4);
  k2._dbgChronik = { check: 1 };
  k2.um(T.chronikStart(HEUTE) + 6 * 36e5);
  assert.equal(await k2._chronikNow(), true);
  assert.equal(L4.items.length, 2);
});

test('Chronik am Gerät: still aus in einer anderen Zeitzone als HA, in der Editor-Vorschau und solange die Karte nicht zu sehen ist', async () => {
  const g = HEUTE - 1;
  const V = chronikVerlauf([[g, { futter: 2 }]]);
  const lauf = ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list'];
  const neu = (config) => {
    const L = todoListe();
    const Z = { ruf: [], hist: [] };
    const h = chronikHass(L, chronikRecorder(V, Z), Z);
    if (config) h.config = config;
    const c = nurTakt(chronikKarte(h));
    c._dbgChronik = { check: 1 };
    c._chronikJit = 0;
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    return { L, Z, h, c };
  };
  const w0 = warned.length;
  const l0 = leise.length;
  const z0 = zeitgeber;
  // still: kein Aufruf, kein Zeitgeber, keine Pause, nichts in der Konsole, auch nicht über _chronikNow und _chronikLesen
  const still = async ({ L, Z, c }, wo) => {
    for (let i = 0; i < 3; i++) c._tick();
    assert.equal(c._chronikOn(), false, wo);
    assert.equal(await c._chronikNow(), null, wo);
    assert.equal(await c._chronikLesen(), null, wo);
    await gleich();
    assert.deepEqual(Z.ruf, [], wo);
    assert.ok(!c._chronikBusy && !c._chronikNext && !c._chronikOk && !c._chronikStand && c._errs === undefined, wo);
    assert.equal(L.items.length, 0, wo);
  };
  const geht = async ({ L, Z, c }, wo) => {
    c._tick();
    assert.ok(c._chronikBusy, wo);
    assert.equal(await c._chronikBusy.p, true, wo);
    assert.deepEqual(Z.ruf, lauf, wo);
    assert.equal(L.items.length, 1, wo);
  };
  // Zeitzone: HA steht woanders als das Gerät (das Handy auf Reisen). Sein Pika-Tag beginnt zu einer anderen Stunde.
  const fremd = andereZone(T.chronikStart(HEUTE) + 6 * 36e5);
  assert.ok(fremd);
  let K = neu({ time_zone: fremd });
  await still(K, `HA in ${fremd}, das Gerät in ${HIER}`);
  assert.equal(zeitgeber, z0);
  // wieder zu Hause (dieselbe Karte, dieselben Attrappen): Der nächste Takt prüft
  K.h.config.time_zone = HIER;
  await geht(K, HIER);
  // nicht prüfbar: HA nennt keine Zone (config fehlt, ist leer) oder der Browser kennt sie nicht → wie bisher erlaubt
  for (const config of [undefined, {}, { time_zone: null }, { time_zone: 'Mars/Olympus' }]) await geht(neu(config), JSON.stringify(config));
  // Zwei Zonen können heute gleich gehen und vor einer Woche nicht (eine hat inzwischen die Uhr umgestellt). Geprüft
  // wird darum auch der Beginn des ältesten Tags, der nachgetragen würde. Gesucht: eine Zone und ein Zeitpunkt in
  // 2026, für die genau das auf diesem Rechner gilt (feste Zonen für jede volle Stunde, dazu einige mit Sommerzeit).
  const lokal = (t) => -new Date(t).getTimezoneOffset();
  const davor = (t) => T.chronikStart(T.pikaDay(t) - T.CHRONIK.back);
  const zonen = [...Array.from({ length: 27 }, (_, i) => (i === 14 ? 'Etc/GMT' : `Etc/GMT${i > 14 ? '+' : ''}${i - 14}`)),
    'Europe/London', 'Europe/Berlin', 'Europe/Helsinki', 'America/New_York', 'America/Santiago', 'Australia/Sydney', 'Pacific/Auckland'];
  assert.ok(zonen.every((z) => T.chronikVersatz(z, NOW) != null), 'der Rechner kennt alle diese Zonen');
  let paar = null;
  let stelltUm = false;
  for (let t = Date.UTC(2026, 0, 8, 12); t < Date.UTC(2027, 0, 1); t += 7 * 864e5) {
    if (lokal(t) !== lokal(davor(t))) stelltUm = true;
    paar ??= zonen.map((z) => ({ z, t })).find(({ z }) => T.chronikVersatz(z, t) === lokal(t) && T.chronikVersatz(z, davor(t)) !== lokal(davor(t)));
  }
  // (Stellt der Rechner selbst nie um und geht keine der Zonen mit Sommerzeit zeitweise wie er, gibt es kein solches
  // Paar, etwa mit TZ=Asia/Tokyo. Mit Sommerzeit oder in UTC gibt es eines.)
  assert.ok(paar || !stelltUm, `kein Paar für ${HIER}`);
  if (HIER === 'Europe/Berlin' || HIER === 'UTC') assert.ok(paar);
  if (paar) {
    K = neu({ time_zone: paar.z });
    K.c.um(paar.t);
    assert.equal(T.chronikZoneOk(paar.z, [paar.t]), true, 'jetzt gehen beide gleich');
    assert.equal(K.c._chronikOn(), false, `${paar.z} gegen ${HIER} am ${new Date(paar.t).toISOString()}`);
    K.h.config.time_zone = HIER;
    assert.equal(K.c._chronikOn(), true);
  }

  // Editor von HA: Die Vorschau-Karte (preview = true) schriebe sonst sofort, noch vor dem Speichern
  K = neu({ time_zone: HIER });
  K.c.preview = true;
  await still(K, 'Vorschau im Editor');
  K.c.preview = false; // die gespeicherte Karte im Dashboard
  await geht(K, 'gespeicherte Karte');

  // Nicht zu sehen (Tab im Hintergrund, Bildschirm aus): Der Takt pflegt nur Fristen, die Chronik prüft nicht
  K = neu();
  let kaffee = 0;
  Object.assign(K.c, { _away: () => true, _tickCoffee: () => { kaffee++; } });
  for (let i = 0; i < 3; i++) K.c._tick();
  await gleich();
  assert.equal(kaffee, 3, 'der Takt läuft');
  assert.deepEqual(K.Z.ruf, []);
  assert.ok(!K.c._chronikBusy);
  K.c._away = () => false;
  await geht(K, 'wieder zu sehen');
  assert.deepEqual([warned.length - w0, leise.length - l0], [0, 0]);
});

test('Chronik am Gerät: geändert und gelöscht wird nur aus einem frischen Lesestand (drei Geräte, eines kommt spät)', async () => {
  const d = datum(HEUTE - 1);
  const d1 = HEUTE - 2;
  const rest = [3, 4, 5, 6, 7].map((i) => `Pika-Tag ${datum(HEUTE - i)} · futter=0`);
  const V = chronikVerlauf([[d1, { futter: 1 }]]);
  const neuerTag = `Pika-Tag ${datum(d1)} · futter=1 streicheln=0 putzen=0 paeckchen=0 besuch=-`;
  const t = (x) => `Pika-Tag ${d} · ${x}`;
  const a = t('futter=3 streicheln=4 putzen=0 paeckchen=0 besuch=vogel');
  const b = t('futter=2 streicheln=2 putzen=0 paeckchen=1 besuch=falter');
  const c3 = t('futter=1 streicheln=9 putzen=2 paeckchen=0 besuch=pino');
  const voll = t('futter=3 streicheln=9 putzen=2 paeckchen=1 besuch=pino,vogel,falter');
  const ziel = { entity_id: CH };
  // Die Uhr des Geräts lässt sich vorstellen: So „hängt“ ein Aufruf, ohne dass der Test wartet
  const echtNow = Date.now;
  let vor = 0;
  Date.now = () => echtNow() + vor;
  // Das Gerät liest, dann hängt sein erstes Anlegen (das Handy schläft ein): Inzwischen vergeht dauer, und
  // andere(L) geschieht an der Liste. → Liste, Aufrufe, Ergebnis, Titel des Tags d
  const lauf = async (titel, dauer, andere = () => {}) => {
    const L = todoListe([...rest, ...titel]);
    const echt = L.dienst;
    let erstes = true;
    L.dienst = (name, data, z) => {
      if (name === 'add_item' && erstes) {
        erstes = false;
        andere(L, echt);
        vor += dauer;
      }
      return echt(name, data, z);
    };
    const Z = { ruf: [], hist: [] };
    const c = chronikKarte(chronikHass(L, chronikRecorder(V, Z), Z));
    c._dbgChronik = { check: 1 };
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    const erg = await c._chronikNow();
    assert.equal(c._errs, undefined);
    return { L, Z, erg, titel: L.items.map((x) => x.summary).filter((s) => s.includes(d)) };
  };
  try {
    // Zwei Einträge für gestern (von Gerät A und von diesem, C), vorgestern fehlt. Der Plan: vorgestern anlegen, dann
    // den Eintrag von A auf „A und C“ ändern. Während das Anlegen hängt, legt Gerät B seinen an, und A räumt auf:
    // Der bleibende Eintrag enthält jetzt alles von A, B und C, die anderen beiden sind gelöscht.
    const dritte = (L, echt) => {
      echt('add_item', { item: b }, ziel);
      const uid = (s) => L.items.find((x) => x.summary === s).uid;
      echt('update_item', { item: uid(a), rename: voll }, ziel);
      echt('remove_item', { item: uid(b) }, ziel);
      echt('remove_item', { item: uid(c3) }, ziel);
    };
    let R = await lauf([a, c3], T.CHRONIK.frisch + 1000, dritte);
    // Der alte Plan wird nicht mehr ausgeführt („A und C“ nähme dem Eintrag wieder, was B beitrug, und B ist gelöscht):
    // kein update_item, stattdessen neu lesen. Dort ist nichts mehr zu tun.
    assert.deepEqual(R.Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list']);
    assert.equal(R.erg, true);
    assert.deepEqual(R.titel, [voll], 'nichts von dem, was B beitrug, ist verloren');
    assert.ok(R.L.items.some((x) => x.summary === neuerTag), 'das späte Anlegen kommt an');
    assert.equal(R.L.weg, 0);
    // Derselbe Ablauf ohne die anderen Geräte: Der alte Plan wäre noch richtig, aber das weiß das Gerät nicht. Es
    // liest neu und führt ihn dann aus (ändern, lesen, löschen, lesen).
    R = await lauf([a, c3], T.CHRONIK.frisch + 1000);
    assert.deepEqual(R.Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list', 'todo.update_item',
      'todo/item/list', 'todo.remove_item', 'todo/item/list']);
    assert.equal(R.erg, true);
    assert.deepEqual(R.titel, [t('futter=3 streicheln=9 putzen=2 paeckchen=0 besuch=pino,vogel')]);
    // … und das Löschen einer reinen Dopplung ebenso: erst neu lesen
    R = await lauf([a, a], T.CHRONIK.frisch + 1000);
    assert.deepEqual(R.Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list', 'todo.remove_item', 'todo/item/list']);
    assert.deepEqual([R.erg, R.titel], [true, [a]]);
    // Ist der Lesestand noch frisch (das Anlegen dauerte kürzer), geht es ohne Umweg weiter
    R = await lauf([a, a], T.CHRONIK.frisch - 2000);
    assert.deepEqual(R.Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo.remove_item', 'todo/item/list']);
    assert.deepEqual([R.erg, R.titel], [true, [a]]);
    assert.equal(T.CHRONIK.frisch, 10000);
    // Anlegen bleibt davon unberührt: Braucht schon der Verlauf länger, wird trotzdem angelegt. Ein spätes Anlegen
    // kostet höchstens eine Dopplung, und die wird abgeräumt.
    const L = todoListe([...rest, a]);
    const Z = { ruf: [], hist: [] };
    const rec = chronikRecorder(V, Z);
    const spaet = chronikKarte(chronikHass(L, (m) => {
      vor += T.CHRONIK.frisch + 1000;
      return rec(m);
    }, Z));
    spaet._dbgChronik = { check: 1 };
    spaet.um(T.chronikStart(HEUTE) + 6 * 36e5);
    assert.equal(await spaet._chronikNow(), true);
    assert.deepEqual(Z.ruf, ['todo/item/list', 'history/history_during_period', 'todo.add_item', 'todo/item/list']);
    assert.ok(L.items.some((x) => x.summary === neuerTag));
    // Die Zeit zählt ab dem Lesen der Liste, auch der Abruf des Verlaufs gehört dazu. Braucht er lange und gibt es
    // danach nichts anzulegen (an dem fehlenden Tag tat sich nichts), ist das Verwerfen des alten Stands das Einzige,
    // was die Runde „geschrieben“ hat: Trotzdem wird neu gelesen und dann erst gelöscht.
    const L2 = todoListe([...rest, a, a]);
    const Z2 = { ruf: [], hist: [] };
    const rec2 = chronikRecorder(chronikVerlauf([[HEUTE - 9, { futter: 1 }]]), Z2);
    const lahm = chronikKarte(chronikHass(L2, (m) => {
      vor += T.CHRONIK.frisch + 1000;
      return rec2(m);
    }, Z2));
    lahm._dbgChronik = { check: 1 };
    lahm.um(T.chronikStart(HEUTE) + 6 * 36e5);
    assert.equal(await lahm._chronikNow(), true);
    assert.deepEqual(Z2.ruf, ['todo/item/list', 'history/history_during_period', 'todo/item/list', 'todo.remove_item', 'todo/item/list']);
    assert.deepEqual(L2.items.map((x) => x.summary).filter((x) => x.includes(d)), [a]);
  } finally {
    Date.now = echtNow;
  }
});

test('Chronik am Gerät: Fehlschläge in Folge verdoppeln die Pause bis zu einem Tag, ein fertiger Lauf fängt wieder bei einer Stunde an', async () => {
  const g = HEUTE - 1;
  const L = todoListe();
  const Z = { ruf: [], hist: [] };
  // Der Recorder zeichnet die Helfer nicht auf: Das bleibt so, bis es jemand ändert
  let rec = () => ({});
  const c = chronikKarte(chronikHass(L, (m) => rec(m), Z));
  c._dbgChronik = { check: 1 };
  c._chronikJit = 0;
  c.um(T.chronikStart(HEUTE) + 6 * 36e5);
  const pause = () => Math.round((c._chronikNext - Date.now()) / 36e4) / 10; // Stunden, auf eine Stelle
  const fehlschlag = async () => {
    c._chronikNext = Date.now() - 1; // die Pause ist um
    c._chronikTick();
    assert.ok(c._chronikBusy);
    assert.equal(await c._chronikBusy.p, false);
    return pause();
  };
  const pausen = [];
  for (let i = 0; i < 8; i++) pausen.push(await fehlschlag());
  assert.deepEqual(pausen, [1, 2, 4, 8, 16, 24, 24, 24]);
  assert.equal(c._chronikFails, 8);
  assert.deepEqual([T.CHRONIK.retry, T.CHRONIK.retryMax], [36e5, 24 * 36e5]);
  // in der Pause: kein Aufruf
  const n = Z.ruf.length;
  assert.equal(n, 16);
  for (let i = 0; i < 3; i++) c._chronikTick();
  assert.ok(!c._chronikBusy);
  assert.equal(Z.ruf.length, n);
  // Der Recorder zeichnet wieder auf: Der nächste Lauf wird fertig, danach beginnt es wieder bei einer Stunde
  const heil = chronikRecorder(chronikVerlauf([[g, { futter: 2 }]]), Z);
  rec = heil;
  c._chronikNext = Date.now() - 1;
  c._chronikTick();
  assert.equal(await c._chronikBusy.p, true);
  assert.deepEqual([c._chronikFails, c._chronikNext], [0, 0]);
  rec = () => ({});
  assert.equal(await c._chronikNow(), false); // (die Tage davor fehlen noch: Der Verlauf wird wieder gefragt)
  assert.deepEqual([c._chronikFails, pause()], [1, 1]);
  assert.equal(await c._chronikNow(), false);
  assert.deepEqual([c._chronikFails, pause()], [2, 2]);
  // Ein Lauf, der hängt und aufgegeben wird, zählt als Fehlschlag
  c._hass.callWS = () => new Promise(() => {});
  c._chronikNext = 0;
  c._chronikOk = null;
  c._chronikTick();
  assert.ok(c._chronikBusy);
  c._chronikBusy.at -= T.CHRONIK.hang + 1000;
  c._chronikTick();
  assert.deepEqual([c._chronikBusy, c._chronikFails, pause()], [null, 3, 4]);
  // andere Liste: von vorn
  c._chronikReset();
  assert.deepEqual([c._chronikFails, c._chronikNext], [0, 0]);
  assert.equal(c._errs, undefined);
});

test('Chronik am Gerät: schreibt auch die letzte Runde noch, gilt der Tag nicht als geprüft; vor jedem Nachprüfen 30 bis 60 Sekunden', async () => {
  await mitSpeicher(async (M) => {
    const d = datum(HEUTE - 1);
    const rest = [2, 3, 4, 5, 6, 7].map((i) => `Pika-Tag ${datum(HEUTE - i)} · futter=0`);
    const a = `Pika-Tag ${d} · futter=3 streicheln=1 putzen=0 paeckchen=0 besuch=-`;
    const L = todoListe([...rest, a]);
    // Ein anderes Gerät legt denselben Tag immer wieder an (vor jedem Lesen steht eine neue Dopplung da)
    let stoert = true;
    const lies = L.lies;
    L.lies = (m) => {
      if (stoert) L.dienst('add_item', { item: a }, { entity_id: CH });
      return lies(m);
    };
    const Z = { ruf: [], hist: [] };
    const c = chronikKarte(chronikHass(L, () => { throw new Error('der Verlauf wird nicht gebraucht'); }, Z));
    c._chronikJit = 0;
    c.um(T.chronikStart(HEUTE) + 6 * 36e5);
    // (ohne _dbgChronik: die echte Wartezeit, hier nur mitgeschrieben statt abgewartet)
    const warten = [];
    c._chronikWait = (ms) => {
      warten.push(ms);
      return Promise.resolve();
    };
    const l0 = leise.length;
    c._chronikTick();
    assert.equal(await c._chronikBusy.p, false, 'nach drei Runden ist nicht bewiesen, dass die Liste sauber ist');
    assert.deepEqual(Z.ruf, ['todo/item/list', 'todo.remove_item', 'todo/item/list', 'todo.remove_item', 'todo/item/list', 'todo.remove_item',
      'todo/item/list', 'todo.remove_item']);
    assert.equal(warten.length, T.CHRONIK.rounds);
    assert.ok(warten.every((ms) => ms >= 30000 && ms < 60000), `Wartezeiten ${warten.join(', ')}`);
    assert.equal(new Set(warten).size, warten.length, 'jedes Mal neu gewürfelt');
    assert.deepEqual([T.CHRONIK.check, T.CHRONIK.checkJit, T.CHRONIK.rounds], [30000, 30000, 3]);
    // nicht als geprüft gemerkt, und nach der Pause von vorn (kein Fehler, nichts in der Konsole)
    assert.equal(M.size, 0);
    assert.ok(!c._chronikOk && !c._chronikBusy && c._errs === undefined);
    assert.ok(Math.abs(c._chronikNext - Date.now() - T.CHRONIK.retry) < 5000);
    assert.equal(leise.length, l0);
    const n = Z.ruf.length;
    for (let i = 0; i < 3; i++) c._chronikTick();
    assert.equal(Z.ruf.length, n);
    // Das andere Gerät gibt Ruhe: Der nächste Versuch findet die Liste sauber vor (die letzte Dopplung ist abgeräumt)
    // und wird fertig
    stoert = false;
    c._chronikNext = Date.now() - 1;
    c._chronikTick();
    assert.equal(await c._chronikBusy.p, true);
    assert.deepEqual(Z.ruf.slice(n), ['todo/item/list']);
    assert.deepEqual(L.items.map((x) => x.summary).filter((s) => s.includes(d)), [a]);
    assert.deepEqual([...M], [['pika-pet-chronik:Pika', `${CH}|${HEUTE}`]]);
    assert.equal(warten.length, T.CHRONIK.rounds, 'wer nichts schreibt, prüft nicht nach');
    assert.deepEqual([c._chronikFails, c._chronikNext], [0, 0]);
  });
});

test('Chronik: setConfig lehnt alles ab, was keine To-do-Liste ist, und fängt bei einer anderen Liste von vorn an', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  for (const id of ['input_text.pika', 'todo', 'todo.', 'pikas_chronik', 'todo.a b', 'sensor.todo.x']) {
    assert.throws(() => c.setConfig({ chronicle_entity: id }), (e) => e.message === `pika-pet-card: chronicle_entity muss eine To-do-Liste sein (ist "${id}")`, id);
  }
  // der Rest von setConfig mit Attrappen für alles, was die Szene braucht
  let resets = 0;
  const echt = c._chronikReset;
  Object.assign(c, {
    _el: { name: {}, stats: {}, scene: { style: { removeProperty() {}, setProperty() {} }, classList: { toggle() {} } } },
    _applyAreal() {}, _diarySync() {}, _planReset() {}, _renderStats() {}, _loadLocal() {}, _lsRename() {},
    _chronikReset() {
      resets++;
      return echt.call(this);
    },
  });
  c.setConfig({ name: 'Pika' });
  assert.equal(c._cfg.chronicle_entity, null, 'Standard: keine Chronik');
  assert.equal(resets, 1);
  c.setConfig({ name: 'Pika', chronicle_entity: CH });
  assert.equal(resets, 2);
  Object.assign(c, { _chronikStand: { t: 1 }, _chronikOk: `${CH}|1`, _chronikNext: 5, _chronikBusy: { at: 0 } });
  // der Editor ruft setConfig bei jeder Änderung: Bleibt die Liste, bleibt alles
  c.setConfig({ name: 'Pikachu', chronicle_entity: CH, height: 200 });
  assert.equal(resets, 2);
  assert.deepEqual(plain(c._chronikStand), { t: 1 });
  c.setConfig({ name: 'Pikachu', chronicle_entity: 'todo.andere' });
  assert.equal(resets, 3);
  assert.deepEqual([c._chronikStand, c._chronikOk, c._chronikNext, c._chronikBusy], [null, null, 0, null]);
  c.setConfig({ name: 'Pikachu' });
  assert.equal(resets, 4);
  // im Editor: ein Feld für die Domäne todo, mit Beschriftung und Hilfetext, gleich unter den beiden Helfern
  const form = T.PikaPetCard.getConfigForm();
  const namen = form.schema.map((s) => s.name);
  assert.equal(namen.indexOf('chronicle_entity'), namen.indexOf('plan_entity') + 1);
  const feld = form.schema.find((s) => s.name === 'chronicle_entity');
  assert.deepEqual(plain(feld.selector), { entity: { filter: { domain: 'todo' } } });
  assert.match(form.computeLabel(feld), /To-do-Liste/);
  assert.ok(form.computeHelper(feld).length > 20);
});

// Zwei Karten an einer Liste. Jeder Aufruf an HA (Liste lesen, Verlauf, anlegen, ändern, löschen) bleibt stehen, bis
// der Test ihn freigibt: pfad[i] sagt, welches der wartenden Geräte beim i-ten Schritt drankommt.
// → Liste, Geräte (neu: so oft hat es angelegt) und wie viele bei jedem Schritt zur Wahl standen
const chronikZuZweit = async (pfad, { start, uid, verlauf, jetzt }) => {
  const L = todoListe(start, uid);
  const G = verlauf.map((V) => {
    const D = { los: null, erg: undefined, fertig: false, neu: 0 };
    const tor = (tun) => new Promise((ja, nein) => {
      D.los = () => {
        D.los = null;
        try {
          ja(tun());
        } catch (e) {
          nein(e);
        }
      };
    });
    const rec = chronikRecorder(V);
    D.c = chronikKarte({
      ...chronikHass(L, rec),
      callWS: (m) => tor(() => (m.type === 'todo/item/list' ? L.lies(m) : rec(m))),
      callService: (dom, name, data, ziel) => tor(() => {
        if (name === 'add_item') D.neu++;
        return L.dienst(name, data, ziel);
      }),
    });
    D.c._chronikWait = () => Promise.resolve(); // Wartezeit vor dem Nachprüfen: Die Reihenfolge bestimmt hier der Test
    D.c.um(jetzt);
    D.c._chronikNow().then((r) => {
      D.erg = r;
      D.fertig = true;
    });
    return D;
  });
  const wahl = [];
  for (;;) {
    for (let i = 0; i < 200 && G.some((D) => !D.fertig && !D.los); i++) await Promise.resolve();
    assert.ok(G.every((D) => D.fertig || D.los), 'ein Gerät hängt zwischen zwei Aufrufen');
    const bereit = G.filter((D) => D.los);
    if (!bereit.length) break;
    const k = pfad[wahl.length] ?? 0;
    assert.ok(k < bereit.length);
    wahl.push(bereit.length);
    bereit[k].los();
  }
  return { L, G, wahl };
};
// Alle Reihenfolgen durchgehen: wie ein Kilometerzähler die letzte Stelle hochzählen, an der noch eine Wahl offen ist
const allePfade = async (lauf) => {
  let pfad = [];
  for (let n = 1; ; n++) {
    const wahl = await lauf(pfad);
    const p = wahl.map((_, i) => pfad[i] ?? 0);
    let i = p.length - 1;
    while (i >= 0 && p[i] + 1 >= wahl[i]) i--;
    if (i < 0) return n;
    pfad = [...p.slice(0, i), p[i] + 1];
  }
};

test('Chronik, zwei Geräte an einer Liste: in jeder Reihenfolge der Aufrufe bleibt genau ein Eintrag je Tag, nichts geht verloren', async () => {
  const g = HEUTE - 1;
  const d = datum(g);
  const start = [{ summary: 'Milch kaufen', uid: 'm1', status: 'completed', description: 'Bio' },
    { summary: `Pika-Tag ${datum(g - 1)} da waren wir im Zoo`, uid: 'z1', status: 'needs_action', due: '2026-11-09' }];
  const auf = (n) => `u${String(n).padStart(3, '0')}`;
  const ab = (n) => `u${String(999 - n).padStart(3, '0')}`; // HA vergibt die uid zufällig: Der jüngere Eintrag kann der kleinere sein
  const t = (rest) => `Pika-Tag ${d} · ${rest}`;
  const faelle = [
    // beide Geräte leiten dieselbe Bilanz ab
    { name: 'gleiche Bilanz', uid: auf, a: { futter: 2, streicheln: 5 }, b: { futter: 2, streicheln: 5 }, min: 200,
      ta: t('futter=2 streicheln=5 putzen=0 paeckchen=0 besuch=-'), tb: t('futter=2 streicheln=5 putzen=0 paeckchen=0 besuch=-'),
      beide: t('futter=2 streicheln=5 putzen=0 paeckchen=0 besuch=-') },
    // das zweite hat schon mehr im Verlauf (einmal mehr gefüttert, Pino war da)
    { name: 'eine Bilanz enthält die andere', uid: auf, a: { futter: 2, streicheln: 5 }, b: { futter: 3, streicheln: 5, mem: 16 }, min: 1000,
      ta: t('futter=2 streicheln=5 putzen=0 paeckchen=0 besuch=-'), tb: t('futter=3 streicheln=5 putzen=0 paeckchen=0 besuch=pino'),
      beide: t('futter=3 streicheln=5 putzen=0 paeckchen=0 besuch=pino') },
    // jedes weiß etwas, das dem anderen fehlt (und hier bekommt der jüngere Eintrag die kleinere uid: Er bleibt)
    { name: 'jede Bilanz hat etwas für sich', uid: ab, a: { futter: 3, streicheln: 4, mem: 64 }, b: { futter: 1, streicheln: 9, mem: 16, putzen: 2 }, min: 2000,
      ta: t('futter=3 streicheln=4 putzen=0 paeckchen=0 besuch=vogel'), tb: t('futter=1 streicheln=9 putzen=2 paeckchen=0 besuch=pino'),
      beide: t('futter=3 streicheln=9 putzen=2 paeckchen=0 besuch=pino,vogel') },
  ];
  for (const F of faelle) {
    const opt = { start, uid: F.uid, verlauf: [chronikVerlauf([[g, F.a]]), chronikVerlauf([[g, F.b]])], jetzt: T.chronikStart(HEUTE) + 6 * 36e5 };
    const zahl = { doppelt: 0, nurA: 0, nurB: 0, zuSpaet: 0, laengster: 0 };
    const pfade = await allePfade(async (pfad) => {
      const { L, G, wahl } = await chronikZuZweit(pfad, opt);
      const wo = `${F.name}, Reihenfolge ${pfad.join('') || '0'}`;
      for (const D of G) {
        assert.equal(D.erg, true, wo);
        assert.equal(D.c._errs, undefined, wo);
        assert.ok(!D.c._chronikBusy, wo);
      }
      // Mensch und „fremd für diesen Tag“ unangetastet
      assert.deepEqual(L.items.slice(0, 2), start, wo);
      // Genau ein Eintrag für den Tag. Haben beide Geräte angelegt (keines sah den Eintrag des anderen), steht darin
      // alles von beiden. Fand das zweite den Tag schon vor, hat es nichts nachgetragen: Dann gilt, was das erste schrieb.
      const [erster, zweiter] = L.neu;
      assert.ok(L.neu.length === 1 || L.neu.length === 2, wo);
      assert.ok([F.ta, F.tb].includes(erster) && [F.ta, F.tb, undefined].includes(zweiter), wo);
      assert.deepEqual(L.items.slice(2).map((x) => x.summary), [zweiter ? F.beide : erster], wo);
      assert.equal(G[0].neu + G[1].neu, L.neu.length, wo);
      zahl[zweiter ? 'doppelt' : G[0].neu ? 'nurA' : 'nurB']++;
      // (wer zu spät kommt, hört von der Liste „No existing item“: Der Eintrag wurde eben erst gelöscht)
      assert.equal(L.spaet, L.weg, wo);
      if (L.weg) zahl.zuSpaet++;
      zahl.laengster = Math.max(zahl.laengster, wahl.length);
      return wahl;
    });
    // Damit der Test nicht still nichts prüft: Es gab viele Reihenfolgen, solche mit zwei Einträgen, solche, in denen
    // nur ein Gerät schrieb, und solche, in denen ein Gerät beim Ändern oder Löschen zu spät kam
    assert.ok(pfade >= F.min, `${F.name}: nur ${pfade} Reihenfolgen`);
    assert.equal(zahl.doppelt + zahl.nurA + zahl.nurB, pfade);
    assert.ok(zahl.doppelt >= F.min / 2 && zahl.nurA > 0 && zahl.nurB > 0 && zahl.zuSpaet > 0 && zahl.laengster >= 12, `${F.name}: ${JSON.stringify(zahl)}`);
  }
});

// ==================== 0.35 Faire Päckchen: gute Tage, Pech-Schutz, Meilensteine, Urlaub ====================

// Die Karte von 0.34 (aus git), um zu prüfen, was ein Gerät mit zwischengespeicherter alter Version mit den neuen
// Ständen macht. Ohne git (z. B. ein ausgepacktes Archiv) werden diese Tests übersprungen.
let ALT = null;
try {
  const altSrc = (await import('node:child_process')).execSync('git show f95604f:pika-pet-card.js', {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'],
  });
  vm.runInNewContext(altSrc, { ...WELT, __pikaTest: (x) => (ALT = x) }, { filename: 'alt-0.34.js' });
} catch (e) { ALT = null; }

// Ein voller Plan mit allem, was 0.35 dazubringt: Freundschaftstage, Kennung des Schenkers, Ende eines Urlaubs
const fullPlan35 = (rec) => {
  const P = fullPlan(rec);
  P.gift = { ...P.gift, f: 1500, r: 35 };
  P.ur = { t: sek(NOW - 9 * 864e5), d: 30 * 864e5 };
  return P;
};

test('Tagesplan 0.35: Freundschaftstage, Schenker und Urlaub kommen heil hin und zurück', () => {
  const k = Math.floor(NOW / 840000);
  const s = T.planSer(fullPlan35([[k, 'paint', 'flieger']]));
  const P = T.planParse(s);
  assert.equal(T.planSer(P), s);
  assert.equal(P.gift.f, 1500);
  assert.equal(P.gift.u, 255);
  assert.equal(P.gift.r, 35);
  assert.deepEqual(plain(P.ur), { t: sek(NOW - 9 * 864e5), d: 30 * 864e5 });
  // läuft: ohne Dauer; ohne Päckchen steht davor ein „-“
  const L = T.planParse(T.planSer({ ...T.planBlank(NOW), ur: { t: sek(NOW), d: null } }));
  assert.deepEqual(plain(L.ur), { t: sek(NOW), d: null });
  assert.equal(L.gift, null);
  assert.match(T.planSer(L), /\|-\|u[0-9a-z]+$/);
  // f: 0 ist ein Wert (übernommen, noch kein guter Tag), null heißt „noch nicht übernommen“
  const G0 = T.planParse(T.planSer({ ...T.planBlank(NOW), gift: { ...fullPlan([]).gift, f: 0 } })).gift;
  assert.equal(G0.f, 0);
  const Gn = T.planParse(T.planSer({ ...T.planBlank(NOW), gift: { ...fullPlan([]).gift, f: null } })).gift;
  assert.equal(Gn.f, null);
  // Etwas anderes als ein Urlaub an siebter Stelle, oder acht Abschnitte: unbekannt
  assert.equal(T.planParse(`${T.planSer(T.planBlank(NOW))}|-|x12`), null);
  assert.equal(T.planParse(`${T.planSer(fullPlan35([]))}|u1`), null);
});

test('Tagesplan 0.35: passt in den Helfer, PLAN_MIN reicht ohne Verlauf', () => {
  const k = Math.floor(NOW / 840000);
  const ohne = T.planSer(fullPlan35([]));
  assert.ok(ohne.length <= T.PLAN_MIN, `ohne Verlauf ${ohne.length} Zeichen, PLAN_MIN ist ${T.PLAN_MIN}`);
  const voll = T.planSer(fullPlan35([[k, 'paint', 'flieger'], [k - 1, 'bubbles', ''], [k - 2, 'tablet', ''], [k - 3, 'music', '']]));
  assert.ok(voll.length <= 255, `mit Verlauf ${voll.length} Zeichen, ein input_text fasst 255`);
  assert.ok(T.PLAN_MIN <= 255);
  // Schlimmster Fall (viermal Malen mit dem längsten Motiv): Die Karte lässt ältere Einträge des Verlaufs weg
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { plan_entity: 'input_text.p' };
  c._hass = { states: { 'input_text.p': { state: '', attributes: { max: 255 } } } };
  const F = c._planFit(fullPlan35([0, 1, 2, 3].map((i) => [k - i, 'paint', 'regenbogen'])));
  assert.ok(T.planSer(F).length <= 255 && F.rec.length >= 3, `${T.planSer(F).length} Zeichen, ${F.rec.length} im Verlauf`);
});

test('Gute Tage: einmal je Tag, jeder siebte bringt ein goldenes, höchstens zwei im Vorrat', () => {
  let P = T.planApply(T.planBlank(NOW), { t: 'gstart', k: sek(NOW) }, NOW);
  assert.equal(P.gift.f, 0);
  const tag = T.pikaDay(NOW);
  for (let i = 0; i < 21; i++) {
    const op = { t: 'ggood', d: tag + i };
    const a = T.planApply(P, op, NOW);
    // wiederholbar: dasselbe zweimal zählt einmal
    assert.equal(T.planSer(T.planApply(a, op, NOW)), T.planSer(a));
    P = a;
    // am nächsten Tag streichelt jemand (neuer Tag im Plan), das Bit „gut“ gilt nur für seinen Tag
    P = T.planApply(P, { t: 'pet', d: tag + i + 1, n: 1 }, NOW);
  }
  assert.equal(P.gift.f, 21);
  assert.equal(P.gift.y, 2); // drei verdient, zwei passen in den Vorrat
  // ein später Eintrag für einen Tag, den der Plan schon hinter sich hat, zählt nicht
  const spaet = T.planApply(P, { t: 'ggood', d: tag + 3 }, NOW);
  assert.equal(spaet.gift.f, 21);
  // nicht übernommen (f fehlt): keine Zählung, bis gmig
  const Q = T.planApply(T.planBlank(NOW), { t: 'gstart', k: sek(NOW) }, NOW);
  Q.gift.f = null;
  assert.equal(T.planApply(Q, { t: 'ggood', d: tag }, NOW).gift.f, null);
  const M = T.planApply(Q, { t: 'gmig', k: Q.gift.k, f: 9 }, NOW);
  assert.equal(M.gift.f, 9);
  assert.equal(T.planApply(M, { t: 'gmig', k: Q.gift.k, f: 2 }, NOW).gift.f, 9); // nur einmal
  // Das Bit „gut“ ist keins der Erlebnisse, von denen er träumt
  assert.equal(T.MEM_GUT, 1 << 9);
});

test('Pech-Schutz: nie mehr als zwei Leckerli in Folge, das erste ist ein Schatz, auf allen Geräten gleich', () => {
  let run = 0;
  let schaetze = 0;
  assert.equal(T.giftTre(1), true);
  for (let z = 1; z <= 2000; z++) {
    if (T.giftTre(z)) {
      schaetze++;
      run = 0;
    } else assert.ok(++run <= 2, `Päckchen ${z}: ${run} Leckerli in Folge`);
  }
  // etwa jedes dritte bis zweite ist ein Schatz (vorher genau eins von dreien)
  assert.ok(schaetze > 2000 / 3 && schaetze < 2000 / 2, `${schaetze} Schätze`);
  assert.deepEqual([10, 25, 50, 100, 200, 300].map(T.giftMile), [true, true, true, true, true, true]);
  assert.deepEqual([1, 9, 11, 26, 75, 150].map(T.giftMile), [false, false, false, false, false, false]);
  assert.equal(T.giftAllGold({ u: 255, v: 0xffff }), true);
  assert.equal(T.giftAllGold({ u: 255, v: 0x7fff }), false);
});

test('Urlaub: an, zurück, weg; was ein Gerät ohne Wissen davon rechnete, gilt nicht', () => {
  const t0 = sek(NOW);
  let P = T.planApply(T.planBlank(NOW - 864e5), { t: 'gstart', k: sek(NOW - 864e5) }, NOW);
  P = T.planApply(P, { t: 'von', t0 }, NOW);
  assert.deepEqual(plain(P.ur), { t: t0, d: null });
  // ein zweites „an“ (anderes Gerät, später) ändert nichts
  assert.equal(T.planApply(P, { t: 'von', t0: t0 + 6e4 }, NOW).ur.t, t0);
  // Warnung und Verdientes aus der Urlaubszeit gelten nicht; von davor schon
  assert.equal(T.planApply(P, { t: 'gbad', k: P.gift.k, b: t0 + 36e5 }, NOW).gift.b, null);
  assert.equal(T.planApply(P, { t: 'gbad', k: P.gift.k, b: t0 - 36e5 }, NOW).gift.b, t0 - 36e5);
  assert.equal(T.planApply(P, { t: 'gearn', k: P.gift.k, e: 1, p: t0 + 36e5 }, NOW).gift.a, 0);
  // zurück: einmal, nur für diesen Urlaub, Anker der Serie und des Vorrats rücken
  const off = { t: 'voff', t0, d: 3 * 864e5, gp: t0 + 3 * 864e5, ht: P.hay.t + 3 * 864e5 };
  const Q = T.planApply(P, off, NOW);
  assert.deepEqual(plain(Q.ur), { t: t0, d: 3 * 864e5 });
  assert.equal(Q.gift.p, t0 + 3 * 864e5);
  assert.equal(Q.hay.t, P.hay.t + 3 * 864e5);
  assert.equal(T.planSer(T.planApply(Q, off, NOW)), T.planSer(Q));
  assert.equal(T.planApply(Q, { ...off, t0: t0 + 1000 }, NOW).ur.d, 3 * 864e5);
  // ein neuer Urlaub erst nach dem Ende des alten; vclear räumt nur das bekannte Ende weg
  assert.equal(T.planApply(Q, { t: 'von', t0: t0 + 864e5 }, NOW).ur.t, t0);
  assert.equal(T.planApply(Q, { t: 'von', t0: t0 + 4 * 864e5 }, NOW).ur.t, t0 + 4 * 864e5);
  assert.equal(T.planApply(Q, { t: 'vclear', t0 }, NOW).ur, null);
  assert.equal(T.planApply(P, { t: 'vclear', t0 }, NOW).ur.t, t0); // läuft noch: bleibt
});

test('Urlaub: Satt und Glück stehen, solange er läuft, und rechnen danach ohne die Urlaubszeit', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { sleep_start: '21:00', sleep_end: '07:00' };
  const day = new Date(2026, 10, 2, 12).getTime();
  const t0 = day + 2 * 36e5;
  const h = (a, b) => c._decayH(a, b);
  c._plan = { ur: null };
  const ohne = h(day, t0);
  c._plan = { ur: { t: t0, d: null } };
  assert.equal(h(day, t0 + 5 * 864e5), ohne); // im Urlaub kein Abbau
  c._plan = { ur: { t: t0, d: 5 * 864e5 } };
  // danach: Abbau vor dem Urlaub plus Abbau nach der Rückkehr
  c._plan = { ur: null };
  const nach = h(t0 + 5 * 864e5, t0 + 5 * 864e5 + 36e5);
  c._plan = { ur: { t: t0, d: 5 * 864e5 } };
  assert.ok(Math.abs(h(day, t0 + 5 * 864e5 + 36e5) - (ohne + nach)) < 1e-9);
  // Wachzeit rückwärts: dieselbe Wachzeit wie bis zur Abreise, jetzt bis zur Rückkehr
  const back = c._awakeBack(t0 + 5 * 864e5, c._awakeMs(day, t0));
  assert.ok(Math.abs(c._awakeMs(back, t0 + 5 * 864e5) - c._awakeMs(day, t0)) < 1000);
  assert.deepEqual(plain(T.urlaubCut({ t: t0, d: 864e5 }, day, t0 + 2 * 864e5)), [t0, t0 + 864e5]);
  assert.equal(T.urlaubCut({ t: t0, d: 864e5 }, day, t0), null);
});

test('Tagebuch: zwei Geräte fast gleichzeitig, jedes Ereignis steht nur einmal da', () => {
  const d = T.pikaDay(NOW);
  let P0 = T.planApply(T.planBlank(NOW), { t: 'gstart', k: NOW - 864e5 }, NOW);
  P0.gift = { ...P0.gift, n: 1, a: 1, z: 2, o: 2 };
  const A = T.planApply(T.planApply(P0, { t: 'mem', d, b: 16 }, NOW), { t: 'give', z: 3, i: 9, gold: false, x: NOW }, NOW);
  const A2 = T.planApply(A, { t: 'gopen', z: 3 }, NOW);
  const B = T.planApply(P0, { t: 'gather', c: '2', m: 999 }, NOW);
  const M = T.planApply(T.planApply(T.planApply(A2, { t: 'gather', c: '2', m: 999 }, NOW), { t: 'mem', d, b: 16 }, NOW), { t: 'gopen', z: 3 }, NOW);
  const P = [P0, A2, B, M].map((v, i) => ({ t: NOW + i * 1000, v: T.planParse(T.planSer(v)) }));
  // Zustand: zwei Geräte putzen je ein Häufchen, der dritte Stand führt beide zusammen
  const s0 = { s: 80, st: NOW, g: 80, gt: NOW, c: NOW - 864e5, m: 0, l: NOW };
  const S = [s0, { ...s0, m: 1 }, { ...s0, m: 2 }, { ...s0, m: 3 }].map((v, i) => ({ t: NOW + i * 1000, v }));
  const r = T.diaryDerive(S, P, NOW - 1e7, { decayAt: () => Infinity, until: NOW + 1e4 });
  const n = (k, b) => r.ev.filter((e) => e.k === k && (b == null || e.b === b)).length;
  assert.equal(n('mem', 'pino'), 1);
  assert.equal(n('parcel'), 1);
  assert.equal(n('gather'), 1);
  assert.equal(r.ev.filter((e) => e.k === 'clean').reduce((x, e) => x + e.n, 0), 2);
});

test('Tagebuch: „ein Päckchen wartet“ nur, wenn eins in den Vorrat kam; Gold nach sieben guten Tagen', () => {
  const k = sek(NOW - 864e5);
  let F = T.planApply(T.planBlank(NOW), { t: 'gstart', k }, NOW);
  F.gift = { ...F.gift, n: 3, a: 5, f: 6 };
  const voll = T.planApply(F, { t: 'gearn', k, e: 6, p: NOW }, NOW);
  const H = (L) => L.map((v, i) => ({ t: NOW + i, v: T.planParse(T.planSer(v)) }));
  const ev = (L) => plain(T.diaryDerive([], H(L), NOW - 1e7, { decayAt: () => Infinity, until: NOW + 1e4 }).ev.map((e) => e.k));
  assert.deepEqual(ev([F, voll]), []);
  const zwei = { ...F, gift: { ...F.gift, n: 2 } };
  assert.deepEqual(ev([zwei, T.planApply(zwei, { t: 'gearn', k, e: 6, p: NOW }, NOW)]), ['earn']);
  const gut = T.planApply(F, { t: 'ggood', d: T.pikaDay(NOW) }, NOW);
  assert.deepEqual(ev([F, gut]), ['mem', 'earnGold']);
});

test('Tagebuch: Urlaub mit Abreise und Rückkehr, das Neuansetzen danach ist kein Putzen, ein ganz kurzer steht nicht da', () => {
  const t0 = sek(NOW - 3 * 864e5);
  const t1 = sek(NOW - 36e5);
  const P0 = T.planBlank(NOW - 4 * 864e5);
  const P1 = T.planApply(P0, { t: 'von', t0 }, NOW);
  const P2 = T.planApply(P1, { t: 'voff', t0, d: t1 - t0 }, NOW);
  const P = [[NOW - 4 * 864e5, P0], [t0, P1], [t1, P2]].map(([t, v]) => ({ t, v: T.planParse(T.planSer(v)) }));
  // eine Stunde vor der Abreise 40 % satt: ohne Urlaub knurrte der Bauch eine Stunde nach der Abreise
  const s0 = { s: 40, st: t0 - 36e5, g: 80, gt: t0 - 36e5, c: NOW - 4 * 864e5, m: 0, l: NOW - 4 * 864e5 };
  const S = [{ t: s0.st, v: s0 }, { t: t1 + 2000, v: { ...s0, st: t1, gt: t1, c: t1, l: t1 } }];
  const r = T.diaryDerive(S, P, NOW - 5 * 864e5, { decayAt: (t, h) => t + h * 36e5, until: NOW });
  const ks = r.ev.map((e) => e.k);
  assert.ok(ks.includes('urlaub') && ks.includes('heim'), ks.join(' '));
  assert.ok(!ks.includes('clean'), 'Neuansetzen gilt als Putzen');
  assert.ok(!ks.includes('hungry'), 'Hunger mitten im Urlaub');
  assert.deepEqual(plain(r.urlaub), [[t0, t1]]);
  // eine Minute lang (aus Versehen): kein Eintrag, die Zeit zählt trotzdem als Urlaub
  const Q = [[NOW - 4 * 864e5, P0], [t0, P1], [t0 + 6e4, T.planApply(P1, { t: 'voff', t0, d: 6e4 }, NOW)]]
    .map(([t, v]) => ({ t, v: T.planParse(T.planSer(v)) }));
  const q = T.diaryDerive([], Q, NOW - 5 * 864e5, { decayAt: () => Infinity, until: NOW });
  assert.deepEqual(plain(q.ev.map((e) => e.k)), []);
  assert.deepEqual(plain(q.urlaub), [[t0, t0 + 6e4]]);
  // Chronik: gut=1 und urlaub=1 als Felder, die 0.34 erhält
  const tag = T.pikaDay(t0 + 36e5);
  const a = T.chronikStart(tag);
  const e = T.chronikBilanz([{ t: a + 36e5, k: 'mem', b: 'gut' }], {}, a, a + 864e5, tag, [[t0, t1]]);
  assert.match(T.chronikKod(e), / gut=1 urlaub=1$/);
  assert.equal(T.chronikUrlaub([[t0, t1]], t1, t1 + 864e5), false);
});

test('Ältere Karte (0.34) und Stände von 0.35: nichts geht verloren, im Urlaub schreibt sie den Plan nicht', { skip: !ALT && 'git oder der Stand f95604f fehlt' }, () => {
  const k = Math.floor(NOW / 840000);
  // Ohne Urlaub liest 0.34 den Plan, schreibt ihn mit Freundschaftstagen zurück (sie stecken in u), nur die Kennung
  // des Schenkers fällt weg (dann gilt die alte Prüfung)
  const P = fullPlan35([[k, 'read', '']]);
  P.ur = null;
  const s = T.planSer(P);
  const alt = ALT.planParse(s);
  assert.ok(alt, '0.34 liest den Plan nicht');
  const zurueck = T.planParse(ALT.planSer(ALT.planApply(alt, { t: 'gopen', z: P.gift.z }, NOW)));
  assert.equal(zurueck.gift.f, 1500);
  assert.equal(zurueck.gift.u, 255);
  assert.equal(zurueck.gift.r, null);
  // 0.34 verschenkt (Album-Bit dazu): die Freundschaftstage bleiben
  const Q = T.planParse(T.planSer({ ...T.planBlank(NOW), gift: { ...P.gift, u: 0, v: 0, z: 0, o: 0, n: 1, f: 12 } }));
  const gab = ALT.planApply(ALT.planParse(T.planSer(Q)), { t: 'give', z: 1, i: 2, gold: false, x: NOW }, NOW);
  assert.equal(T.planParse(ALT.planSer(gab)).gift.f, 12);
  assert.equal(T.planParse(ALT.planSer(gab)).gift.u, 4);
  // Im Urlaub (siebter Abschnitt): 0.34 kennt das Format nicht, liest nichts und hält es für das einer neueren Karte
  // (dann schreibt sie den Plan nicht, siehe _hassPlan in 0.34)
  const U = T.planSer({ ...P, ur: { t: sek(NOW), d: null } });
  assert.equal(ALT.planParse(U), null);
  assert.ok(/^p\d+\|/.test(U) && (!U.startsWith('p1|') || U.split('|').length > 6));
  // Der Zustand hat sein Format behalten: 0.34 liest, was 0.35 schreibt
  const st = { s: 61.5, st: sek(NOW), g: 40, gt: sek(NOW), c: sek(NOW), m: 5, l: sek(NOW) };
  assert.deepEqual(plain(ALT.parseStats(T.serialize(st))), plain(st));
});

test('Tagebuch: jeder Kaffee aus dem Verlauf des Automaten, Neustart von HA und Spülen zählen nicht', () => {
  const P = 'consumer_products_coffee_maker_program_beverage_';
  const h = (hh, mm, ss = 0) => new Date(2026, 10, 12, hh, mm, ss).getTime();
  // so stand es am 12. 11. 2026 im Recorder: zwei Latte macchiato, dazwischen „unknown“
  const rows = [
    { t: h(4, 0), s: 'unknown' }, { t: h(7, 8, 39), s: `${P}latte_macchiato` }, { t: h(7, 10, 22), s: 'unknown' },
    { t: h(8, 55, 19), s: `${P}latte_macchiato` }, { t: h(8, 57, 2), s: 'unknown' },
  ];
  assert.deepEqual(plain(T.coffeeBrews(rows).map((b) => [b.t, b.label])), [[h(7, 10, 22), 'Latte macchiato'], [h(8, 57, 2), 'Latte macchiato']]);
  // lief schon zu Beginn des Verlaufs, kam aus „unavailable“, endete in „unavailable“, zu kurz: kein Bezug
  assert.deepEqual(plain(T.coffeeBrews([{ t: h(4, 0), s: `${P}espresso` }, { t: h(4, 1), s: 'unknown' }])), []);
  assert.deepEqual(plain(T.coffeeBrews([{ t: h(9, 0), s: 'unavailable' }, { t: h(9, 1), s: `${P}espresso` }, { t: h(9, 2), s: 'unknown' }])), []);
  assert.deepEqual(plain(T.coffeeBrews([{ t: h(9, 0), s: 'unknown' }, { t: h(9, 1), s: `${P}espresso` }, { t: h(9, 2), s: 'unavailable' }])), []);
  assert.deepEqual(plain(T.coffeeBrews([{ t: h(9, 0), s: 'unknown' }, { t: h(9, 1), s: `${P}espresso` }, { t: h(9, 1, 10), s: 'unknown' }])), []);
  // Programmwechsel ohne Pause: zwei Bezüge; Spülen setzt kein Getränkeprogramm
  const zwei = T.coffeeBrews([{ t: h(9, 0), s: 'off' }, { t: h(9, 1), s: `${P}espresso` }, { t: h(9, 2), s: `${P}cappuccino` },
    { t: h(9, 3), s: 'unknown' }, { t: h(9, 4), s: 'consumer_products_coffee_maker_program_cleaning_mode_rinse' }, { t: h(9, 5), s: 'unknown' }]);
  assert.deepEqual(plain(zwei.map((b) => b.label)), ['Espresso', 'Cappuccino']);
  assert.equal(T.coffeeLabel(`${P}caffe_crema`), 'Caffe crema');
  assert.equal(T.coffeeLabel('consumer_products_coffee_maker_program_coffee_world_wiener_melange'), 'Wiener melange');
});

// Haus-Bote am Gerät: Zustände der Reihe nach einspielen (wie aus dem Verlauf), Phase zu Zeitpunkten ablesen
const boteGeraet = (cfg) => {
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { appliances: [cfg] };
  c._hass = { states: {} };
  const a = c._boteSync().list[0];
  const run = (ev, checks) => {
    // ev: [Zeit, 's' | 'd', Wert] aufsteigend; checks: [Zeit, erwartete Phase]
    let st = null;
    let dr = null;
    const o = (x) => x && { state: x[2], last_changed: new Date(x[0]).toISOString() };
    const all = [...ev.map((e) => ({ e })), ...checks.map((k) => ({ k }))].sort((x, y) => (x.e || x.k)[0] - (y.e || y.k)[0]);
    const got = [];
    for (const x of all) {
      if (x.e) {
        if (x.e[1] === 'd') dr = x.e;
        else st = x.e;
        if (st) c._boteRead(a, [o(st), null, null, o(dr)], x.e[0], true);
      } else got.push([x.k[0], c._botePhase(a, x.k[0])]);
    }
    return got.map(([t, p]) => `${new Date(t).toISOString().slice(5, 16)} ${p}`);
  };
  return { c, a, run };
};

test('Haus-Bote: Spülmaschine meldet nach einer Minute „ready“, ausgeräumt ist sie erst, wenn die Tür aufgeht (Verlauf vom 7. 11.)', () => {
  const t = (d, hh, mm, ss = 0) => Date.UTC(2026, 10, d, hh, mm, ss);
  const { run, a } = boteGeraet({ type: 'dishwasher', state: 'sensor.s', door: 'sensor.d' });
  assert.equal(a.emptyOn, 'door');
  // so stand es im Recorder (Sa 7. 11. bis So 8. 11.), Uhrzeiten hier in UTC
  const ev = [
    [t(7, 7, 3, 36), 's', 'ready'], [t(7, 7, 3, 36), 'd', 'closed'],
    [t(7, 21, 12, 45), 'd', 'open'], [t(7, 21, 15, 37), 's', 'run'], [t(7, 21, 15, 38), 'd', 'closed'],
    [t(7, 22, 59, 53), 's', 'finished'], [t(7, 23, 0, 53), 's', 'ready'],
    [t(8, 13, 58, 34), 'd', 'open'], [t(8, 13, 58, 51), 'd', 'closed'],
  ];
  assert.deepEqual(run(ev, [[t(7, 22, 0), 0], [t(7, 23, 30), 0], [t(8, 9, 0), 0], [t(8, 14, 0), 0], [t(8, 14, 30), 0]]), [
    '11-07T22:00 run', '11-07T23:30 done', '11-08T09:00 done', '11-08T14:00 empty', '11-08T14:30 null',
  ]);
  // Mi 11. 11.: drei Minuten nach Programmende kurz unavailable → closed (kein Öffnen), die Tür ging erst um 20:28 auf
  const { run: run2 } = boteGeraet({ type: 'dishwasher', state: 'sensor.s', door: 'sensor.d' });
  const ev2 = [
    [t(11, 13, 7, 6), 's', 'ready'], [t(11, 13, 7, 6), 'd', 'closed'], [t(11, 16, 2, 49), 's', 'run'],
    [t(11, 17, 47, 14), 's', 'finished'], [t(11, 17, 48, 14), 's', 'ready'],
    [t(11, 17, 50, 6), 'd', 'unavailable'], [t(11, 17, 50, 7), 'd', 'closed'], [t(11, 20, 28, 59), 'd', 'open'],
  ];
  assert.deepEqual(run2(ev2, [[t(11, 18, 0), 0], [t(11, 20, 0), 0], [t(11, 20, 30), 0]]), ['11-11T18:00 done', '11-11T20:00 done', '11-11T20:30 empty']);
  // ohne Tür nach einem Tag nicht mehr „fertig“
  assert.deepEqual(run2([], [[t(12, 18, 0), 0]]), ['11-12T18:00 null']);
});

test('Haus-Bote: Waschmaschine ohne Tür (empty_on: idle), state_map, Abbruch mit altem Fortschritt zählt nicht', () => {
  const t = (hh, mm, ss = 0) => Date.UTC(2026, 10, 8, hh, mm, ss);
  const { run, a } = boteGeraet({ type: 'washer', state: 'sensor.w' });
  assert.equal(a.emptyOn, 'idle');
  // So 8. 11.: fertig 15:33, Tür auf (ready) 16:21
  assert.deepEqual(run([[t(13, 59, 36), 's', 'ready'], [t(13, 59, 48), 's', 'run'], [t(15, 33, 17), 's', 'finished'], [t(16, 21, 25), 's', 'ready']],
    [[t(15, 0), 0], [t(16, 0), 0], [t(16, 30), 0], [t(16, 45), 0]]), ['11-08T15:00 run', '11-08T16:00 done', '11-08T16:30 empty', '11-08T16:45 null']);
  // eigene Zustandsnamen; „Spülen“ läuft, „Ende“ ist fertig, „Bereit“ aus
  const { run: run2, a: a2 } = boteGeraet({ type: 'washer', state: 'sensor.w', state_map: { Spülen: 'running', Ende: 'finished', Bereit: 'ready', Quatsch: 'egal' } });
  assert.deepEqual(plain(a2.map), { spülen: 'run', ende: 'finished', bereit: 'ready' });
  assert.deepEqual(run2([[t(9, 0), 's', 'Bereit'], [t(9, 1), 's', 'Spülen'], [t(10, 30), 's', 'Ende']], [[t(10, 0), 0], [t(10, 40), 0]]),
    ['11-08T10:00 run', '11-08T10:40 done']);
  // Abbruch: Fortschritt 100 stammt vom letzten Lauf (vor dem Start gemeldet) → kein Programmende
  const { c, a: a3 } = boteGeraet({ type: 'washer', state: 'sensor.w', progress: 'sensor.p' });
  const o = (s, at) => ({ state: s, last_changed: new Date(at).toISOString(), attributes: { unit_of_measurement: '%' } });
  c._boteRead(a3, [o('ready', t(9, 0)), o('100', t(8, 0)), null, null], t(9, 0), true);
  c._boteRead(a3, [o('run', t(9, 1)), o('100', t(8, 0)), null, null], t(9, 1), true);
  c._boteRead(a3, [o('ready', t(9, 3)), o('100', t(8, 0)), null, null], t(9, 3), true);
  assert.equal(c._botePhase(a3, t(9, 4)), null);
  // empty_on: door ohne Tür geht nicht, empty_on: idle mit Tür schon
  assert.equal(T.boteEmptyOn({ empty_on: 'door' }), 'idle');
  assert.equal(T.boteEmptyOn({ door: 'sensor.d', empty_on: 'idle' }), 'idle');
});

test('Kaffee: ein zweiter Bezug stellt sich hinten an, statt zu verfallen', () => {
  const P1 = { t0: 0, end: 13000 + 240000 };
  const esp = { t0: 133000, end: 133000 + 13000 + 120000 }; // Espresso, eine halbe Minute nach dem Latte bezogen
  const Q = T.coffeeQueue(P1.end, esp);
  assert.equal(Q.t0, P1.end + T.COFFEE_NEXT_GAP);
  assert.equal(Q.end - Q.t0, esp.end - esp.t0); // dieselbe Trinkzeit, nur später
  // weit genug auseinander: unverändert (dasselbe Objekt)
  const spaet = { t0: 10 * 6e4, end: 10 * 6e4 + 133000 };
  assert.equal(T.coffeeQueue(P1.end, spaet), spaet);
});

test('Haus-Bote: Schilder zeigen Restzeit, Fortschritt oder seit wann fertig, kurz genug für drei Meter', () => {
  const now = Date.UTC(2026, 10, 12, 12);
  const L = (a) => T.boteLabel(a, now);
  assert.equal(L({ phase: 'run', st: 'run', end: now + 42 * 6e4, pct: 62 }), '0:42');
  assert.equal(L({ phase: 'run', st: 'run', end: now + 98 * 6e4 }), '1:38');
  assert.equal(L({ phase: 'run', st: 'run', end: now - 6e4 }), 'gleich');
  assert.equal(L({ phase: 'run', st: 'run', end: null, pct: 61.6 }), '62 %');
  assert.equal(L({ phase: 'run', st: 'run', end: null, pct: null }), null);
  assert.equal(L({ phase: 'run', st: 'pause', end: now + 6e5 }), 'Pause');
  assert.equal(L({ phase: 'run', st: 'delayedstart', end: now + 6e5 }), 'wartet');
  assert.equal(L({ phase: 'done', finAt: now - 20000 }), 'fertig');
  assert.equal(L({ phase: 'done', finAt: now - 35 * 6e4 }), 'fertig 35 Min');
  assert.equal(L({ phase: 'done', finAt: now - 150 * 6e4 }), 'fertig 2 Std.');
  assert.equal(L({ phase: 'empty' }), null);
  // Wäsche müffelt ab 30 Min, ab 2 Std. stärker; Trockner und Spülmaschine haben keine Eile
  const S = (type, m) => T.boteSmell({ type, phase: 'done', finAt: now - m * 6e4 }, now);
  assert.deepEqual([S('washer', 10), S('washer', 31), S('washer', 125), S('dryer', 300), S('dishwasher', 300)], [0, 1, 2, 0, 0]);
});

test('Haus-Bote: appliance_labels: alles, nur „fertig“ oder nichts (auch true/false und 2/1/0)', () => {
  const M = T.boteLabelMode;
  assert.deepEqual([undefined, true, 'all', 2, '2'].map(M), ['all', 'all', 'all', 'all', 'all']);
  assert.deepEqual(['done', 1, 'fertig', ' Done '].map(M), ['done', 'done', 'done', 'done']);
  assert.deepEqual([false, 'none', 0, 'off'].map(M), ['none', 'none', 'none', 'none']);
});
