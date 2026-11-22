// Album 2 im Tagesplan (seit 0.46): Abschnitt "a<w>", gift.i 32+/48+, giftKind, Länge, Zusammenführen, und dass eine
// Karte bis 0.45.2 den neuen Plan für das Format einer neueren hält (und dann nicht schreibt). node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const laden = (src) => {
  let T = null;
  vm.runInNewContext(src, {
    window: { matchMedia: () => ({ matches: false }), customCards: [] }, document: { addEventListener() {}, removeEventListener() {} },
    HTMLElement: class {}, customElements: { get: () => null, define() {} }, console: { info() {}, log() {}, warn() {}, debug() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
    __pikaTest: (x) => (T = x),
  });
  return T;
};
const T = laden(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'));
// Die Karte von 0.45.2 (aus git), ohne git wird übersprungen
let TA = null;
try {
  TA = laden(execSync('git show 25dc2c7:pika-pet-card.js', { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }));
} catch (e) { TA = null; }

const plain = (v) => JSON.parse(JSON.stringify(v));
const NOW = Date.UTC(2026, 10, 22, 12);
const sek = (t) => Math.round(t / 1000) * 1000;
// Ein Plan, in dem alles belegt ist, auch Album 2 (so lang, wie er im Alltag höchstens wird)
const voll = (rec = [], gift = {}, ur = { t: sek(NOW - 9 * 864e5), d: 30 * 864e5 }) => ({
  hay: { n: 12, t: sek(NOW), c: '012340123401', m: Math.floor(NOW / 240000) },
  fl: { t: sek(NOW - 6e5), c: 3, x: 77, k: true },
  sport: { d: Math.floor(NOW / 864e5), k: Math.floor(NOW / 840000) },
  fd: [{ t: sek(NOW - 3000), x: 12, k: 0, e: false }, { t: sek(NOW - 2000), x: 55, k: 1, e: true }, { t: sek(NOW - 1000), x: 99, k: 1, e: false }],
  rec,
  cute: { d: Math.floor(NOW / 864e5), n: 99, m: (1 << T.MEM_BITS.length) - 1 },
  fu: sek(NOW + 6e5),
  gift: { k: sek(NOW - 30 * 864e5), a: 999, p: sek(NOW - 36e5), n: 3, u: 255, v: 0xffff, z: 999, o: 999, b: sek(NOW - 6e5), x: sek(NOW - 9e5), y: 2, d: 99, i: 55, f: 1500, r: 35, w: 0xffffff, ...gift },
  ur,
});
const k0 = Math.floor(NOW / 840000);
const REC = [[k0, 'paint', 'katzumi'], [k0 - 1, 'bubbles', ''], [k0 - 2, 'tablet', ''], [k0 - 3, 'music', '']];

test('Album 2: giftKind liest jeden Inhalt, giftCode schreibt ihn zurück', () => {
  for (let t = 0; t < 8; t++) {
    assert.deepEqual(plain(T.giftKind(t)), { alb: 1, t, gold: false });
    assert.deepEqual(plain(T.giftKind(t + 16)), { alb: 1, t, gold: true });
    assert.deepEqual(plain(T.giftKind(32 + t)), { alb: 2, t, gold: false });
    assert.deepEqual(plain(T.giftKind(48 + t)), { alb: 2, t, gold: true });
    assert.equal(T.giftCode(2, t, true), 48 + t);
    assert.equal(T.giftCode(1, t, false), t);
  }
  for (let t = 8; t < 16; t++) assert.deepEqual(plain(T.giftKind(t + 16)), { alb: 0, t, gold: true });
  // Unbekanntes (ein Schatz aus Album 2 über 7, ab 64 etwas Neueres): ein Leckerli, das die Karte nicht kennt
  for (const i of [40, 47, 56, 63, 64, 99, 1000]) assert.equal(T.giftKind(i).alb, 0, `Nummer ${i}`);
  assert.equal(T.giftKind(40).t, 99);
});

test('Album 2: Hin- und Rückweg mit vollem Album 2, mit und ohne Urlaub, Länge ≤ 255 und ohne Verlauf ≤ PLAN_MIN', () => {
  for (const ur of [{ t: sek(NOW - 9 * 864e5), d: 30 * 864e5 }, { t: sek(NOW - 864e5), d: null }, null]) {
    for (const w of [1, 0x010101, 0xffffff, 0x80]) {
      const s = T.planSer(voll(REC, { w }, ur));
      const P = T.planParse(s);
      assert.ok(P, s);
      assert.equal(P.gift.w, w);
      assert.equal(T.planSer(P), s);
      assert.deepEqual(plain(P.ur), plain(ur));
      assert.match(s, ur ? /\|u[0-9a-z.]+\|a[0-9a-z]+$/ : /\|-\|a[0-9a-z]+$/);
      assert.equal(s.split('|').length, 8);
    }
  }
  // Schlimmster Fall: alles voll, längster Verlauf
  const lang = T.planSer(voll(REC));
  assert.ok(lang.length <= 255, `mit Verlauf ${lang.length} Zeichen`);
  const ohne = T.planSer(voll([]));
  assert.ok(ohne.length <= 190, `ohne Verlauf ${ohne.length} Zeichen`);
  assert.equal(T.PLAN_MIN, 180, 'ein Helfer, der bis 0.45 reichte, wird weiter gelesen');
  // _planFit kürzt nur den Verlauf, und mit vollem Album 2 bleiben noch drei Einträge
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { plan_entity: 'input_text.p' };
  c._hass = { states: { 'input_text.p': { state: '', attributes: { max: 255 } } } };
  const F = c._planFit(voll([0, 1, 2, 3].map((i) => [k0 - i, 'paint', 'katzumi'])));
  assert.ok(T.planSer(F).length <= 255 && F.rec.length >= 3, `${T.planSer(F).length} Zeichen, ${F.rec.length} im Verlauf`);
  // w = 0: kein Abschnitt, und ohne Urlaub auch kein „-“ davor
  const s0 = T.planSer(voll([], { w: 0, i: 31 }, null));
  assert.equal(s0.split('|').length, 6);
  assert.equal(T.planParse(s0).gift.w, 0);
});

test('Album 2: ein Plan ohne den Abschnitt bleibt Zeichen für Zeichen derselbe, auch so, wie ihn 0.45.2 schrieb', () => {
  const alte = [
    T.planSer(T.planBlank(NOW)),
    T.planSer(voll(REC, { w: 0, i: 31 })),
    T.planSer(voll([], { w: 0, i: 3 }, null)),
    T.planSer({ ...T.planBlank(NOW), ur: { t: sek(NOW), d: null } }),
    T.planSer({ ...voll([], { w: 0 }), gift: null }),
  ];
  for (const s of alte) {
    assert.equal(T.planSer(T.planParse(s)), s);
    if (TA) {
      // dieselben Texte schreibt und liest auch 0.45.2
      assert.equal(TA.planSer(TA.planParse(s)), s);
      assert.equal(T.planSer(T.planParse(TA.planSer(TA.planParse(s)))), s);
    }
  }
});

test('Album 2: Unbekanntes und Kaputtes wird abgelehnt (das Format einer neueren Karte)', () => {
  const s = T.planSer(voll([], { w: 5 }));
  assert.ok(T.planParse(s));
  assert.equal(T.planParse(`${s}|b1`), null, 'neun Abschnitte');
  assert.equal(T.planParse(s.replace(/\|a5$/, '|x5')), null, 'unbekannter achter Abschnitt');
  assert.equal(T.planParse(s.replace(/\|a5$/, '|a')), null, 'leerer Abschnitt');
  assert.equal(T.planParse(s.replace(/\|u[^|]+\|/, '|z1|')), null, 'kein Urlaub und kein „-“ an siebter Stelle');
  // sieben Abschnitte mit „-“ an siebter Stelle: wie bis 0.45 unbekannt
  assert.equal(T.planParse(`${T.planSer(voll([], { w: 0 }, null))}|-`), null);
  // ohne Päckchen gibt es kein Album 2 (robust gelesen, der Abschnitt wird überlesen)
  const ohneG = T.planParse(s.replace(/\|[^|]+(\|u[^|]+\|a5)$/, '|-$1'));
  assert.ok(ohneG);
  assert.equal(ohneG.gift, null);
});

test('Album 2: Die Karte von 0.45.2 hält den Plan mit Album 2 für neuer (kein Plan für sie, mehr als sechs Abschnitte)', { skip: !TA && 'ohne git keine alte Karte' }, () => {
  for (const ur of [null, { t: sek(NOW - 9 * 864e5), d: 30 * 864e5 }]) {
    const s = T.planSer(voll(REC, { w: 1 }, ur));
    assert.equal(TA.planParse(s), null);
    // die Bedingung aus _hassPlan von 0.45.2 (src/karte/tagesplan.js): kein Plan, Präfix p<Zahl>, mehr als 6 Abschnitte
    assert.ok(/^p\d+\|/.test(s) && (!s.startsWith('p1|') || s.split('|').length > 6));
    const quelle = execSync('git show 25dc2c7:src/karte/tagesplan.js', { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    assert.match(quelle, /const newer = !P && \/\^p\\d\+\\\|\/\.test\(st\) && \(!st\.startsWith\('p1\|'\) \|\| st\.split\('\|'\)\.length > 6\);/);
  }
});

test('Album 2: Schenken ist wiederholbar, jede Stufe einmal, Gold nur aus goldenen Päckchen und nur mit Trick', () => {
  let P = T.planApply(T.planBlank(NOW), { t: 'gstart', k: sek(NOW - 864e5) }, NOW);
  P = T.planApply(P, { t: 'gdbg', f: { n: 3, y: 2, u: 255, v: 0xffff, z: 10, o: 10 } }, NOW);
  const geben = (Q, z, i, gold) => {
    const op = { t: 'give', z, i: i + (gold ? 16 : 0), gold, x: sek(NOW), r: 3 };
    const A = T.planApply(Q, op, NOW);
    const B = T.planApply(A, op, NOW);
    assert.equal(T.planSer(B), T.planSer(A), `Päckchen ${z} zählt doppelt`);
    return T.planApply(A, { t: 'gopen', z }, NOW);
  };
  P = geben(P, 11, 32, false); // Vogelhäuschen kommt
  assert.equal(T.giftLv2(P.gift, 0), 1);
  P = geben(P, 12, 32, false); // Trick
  assert.equal(T.giftLv2(P.gift, 0), 2);
  assert.equal(P.gift.w, 0x101);
  P = geben(P, 13, 32, false); // normal: kein Gold
  assert.equal(T.giftLv2(P.gift, 0), 2);
  P = T.planApply(P, { t: 'gdbg', f: { y: 1 } }, NOW);
  P = geben(P, 14, 32, true); // golden
  assert.equal(T.giftLv2(P.gift, 0), 3);
  assert.equal(P.gift.w, 0x10101);
  // Album 1 bleibt, wie es ist; der Inhalt steht in i
  assert.deepEqual([P.gift.u, P.gift.v, P.gift.i], [255, 0xffff, 48]);
  // Gold-Bit ohne Trick zählt nicht als golden
  assert.equal(T.giftLv2({ w: 0x10001 }, 0), 1);
  // Text hin und zurück
  const s = T.planSer(P);
  assert.equal(T.planSer(T.planParse(s)), s);
  assert.equal(T.planParse(s).gift.w, 0x10101);
});

test('Album 2: Zusammenführen – ein veralteter fremder Stand bringt w zurück (nur per ODER), ein frischer darf es senken', () => {
  const t0 = NOW;
  const tag = T.pikaDay(t0);
  let A = T.planApply(T.planBlank(t0), { t: 'gstart', k: sek(t0 - 864e5) }, t0);
  A = T.planApply(A, { t: 'gdbg', f: { u: 255, v: 0xffff, z: 5, o: 5, w: 0x0103 } }, t0);
  A = T.planApply(A, { t: 'pet', d: tag, n: 5 }, t0);
  // B schrieb von einem älteren Stand aus: weniger gestreichelt (erwiesen veraltet), Album 2 noch leer
  let B = T.planApply(A, { t: 'gdbg', f: { w: 0 } }, t0);
  B = { ...B, cute: { ...B.cute, n: 2 } };
  assert.equal(T.planOld(B, A), true);
  const K = T.planKeep(B, A);
  assert.notEqual(K, B);
  assert.equal(K.gift.w, 0x0103);
  // dasselbe noch einmal: nichts mehr zu retten
  assert.equal(T.planKeep(K, A), K);
  // ein frischer Stand (nicht erwiesen veraltet, z. B. „A2 zurücksetzen“ in der Vorschau): w darf sinken
  const F = T.planApply(A, { t: 'gdbg', f: { w: 0 } }, t0);
  assert.equal(T.planOld(F, A), false);
  assert.equal(T.planKeep(F, A).gift.w, 0);
  // ODER, nie UND: Bits aus beiden Ständen
  const C = { ...B, gift: { ...B.gift, w: 0x0004 } };
  assert.equal(T.planKeep(C, A).gift.w, 0x0107);
});

test('Album 2: ein Abschnitt mit mehr Bits, als Album 2 hat, gilt als Format einer neueren Karte', () => {
  const s = T.planSer(voll([], { w: 1 }, null));
  assert.ok(T.planParse(s));
  assert.equal(T.planParse(s.replace(/|a[0-9a-z]+$/, `|a${(2 ** 24).toString(36)}`)), null);
  assert.equal(T.planParse(s.replace(/|a[0-9a-z]+$/, `|a${(0x40000001).toString(36)}`)), null);
});
