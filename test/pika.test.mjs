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
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Date, Math, JSON, Promise, Intl,
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
