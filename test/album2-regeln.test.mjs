// Album 2: Was ein Päckchen bringt (giftPickTre, _giftPick), Jahreszeit, nur gebaute Schätze, und dass ein Schatz aus
// Album 2 nicht satt macht. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt } from './welt.mjs';

const W0 = welt();
const T = W0.T;
const plain = (v) => JSON.parse(JSON.stringify(v));
// alle acht gebaut, mit den Monaten aus der Spezifikation (Schlitten Nov–März, Picknick Apr–Sep, Planschbecken Jun–Aug)
const ALLE = T.A2_KEYS.map((k) => ({ built: true, mo: { sled: [10, 11, 0, 1, 2], picnic: [3, 4, 5, 6, 7, 8], pool: [5, 6, 7] }[k] || null }));
// Schatz-Plätze und die anderen (Leckerli)
const TRE = [...Array(300).keys()].map((n) => n + 1).filter((z) => T.giftTre(z));
const NIX = [...Array(300).keys()].map((n) => n + 1).filter((z) => !T.giftTre(z));
// Stufe lv für alle Schätze eines Albums als Bits
const a1 = (lv) => ({ u: lv ? 255 : 0, v: (lv >= 2 ? 255 : 0) | (lv >= 3 ? 0xff00 : 0) });
const w2 = (lv) => (lv ? 0xff : 0) | (lv >= 2 ? 0xff00 : 0) | (lv >= 3 ? 0xff0000 : 0);
const arten = (G, gold, info = ALLE, mo = 5, Z = TRE) => [...new Set(Z.map((z) => T.giftPickTre(G, z, gold, info, mo)))].sort((a, b) => (a ?? -1) - (b ?? -1));

test('Album 2 beginnt, sobald kein Schatz aus Album 1 mehr auf Stufe 0 oder 1 steht (oder schon etwas aus Album 2 da ist)', () => {
  assert.equal(T.a2Begun(null), false);
  assert.equal(T.a2Begun({ ...a1(1), w: 0 }), false);
  assert.equal(T.a2Begun({ u: 255, v: 0xfe, w: 0 }), false, 'einer noch ohne Trick');
  assert.equal(T.a2Begun({ ...a1(2), w: 0 }), true);
  assert.equal(T.a2Begun({ ...a1(3), w: 0 }), true);
  assert.equal(T.a2Begun({ ...a1(1), w: 1 }), true);
});

test('Normales Päckchen: Album 1 Stufe 0, dann Trick, dann Album 2 Stufe 0, dann Trick, dann Leckerli', () => {
  // Album 1 zuerst, wie bis 0.45 (Album 2 kommt nicht dazwischen)
  assert.deepEqual(arten({ ...a1(0), w: 0 }, false), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(arten({ u: 255, v: 0, w: 0 }, false), [0, 1, 2, 3, 4, 5, 6, 7]);
  // ein Rest in Album 1: nur der, auch wenn Album 2 schon etwas hat
  assert.deepEqual(arten({ u: 255, v: 0xff ^ 8, w: 1 }, false), [3]);
  // Album 1 mit Trick: Album 2 Stufe 0 (alle acht gebaut, im Juni alle der Jahreszeit außer dem Schlitten)
  assert.deepEqual(arten({ ...a1(2), w: 0 }, false), [32, 33, 35, 36, 37, 38, 39]);
  // Album 2 alle da: die Tricks
  assert.deepEqual(arten({ ...a1(2), w: w2(1) }, false), [32, 33, 35, 36, 37, 38, 39]);
  assert.deepEqual(arten({ ...a1(2), w: w2(1) | 0xff00 ^ 0x100 }, false), [32]);
  // alles mit Trick: Leckerli, auch wenn nichts golden ist
  assert.deepEqual(arten({ ...a1(2), w: w2(2) }, false), [null]);
  // Kein Schatz-Platz: immer Leckerli
  assert.deepEqual(arten({ ...a1(2), w: 0 }, false, ALLE, 5, NIX), [null]);
});

test('Goldenes Päckchen: Album 1 nach der alten Regel, erst ganz golden dann Album 2 Stufe 0, vergolden, Trick', () => {
  assert.deepEqual(arten({ u: 0b11, v: 0b11, w: 0 }, true), [2, 3, 4, 5, 6, 7]);
  // Album 1 voll, mit Trick: vergolden
  assert.deepEqual(arten({ ...a1(2), w: 0 }, true), [0, 1, 2, 3, 4, 5, 6, 7]);
  // Album 1 da, einer ohne Trick, keiner golden: erst der Trick (Stufe 2 vergolden gibt es nur für die mit Trick)
  assert.deepEqual(arten({ u: 255, v: 0xff ^ 1, w: 0 }, true), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(arten({ u: 255, v: 0xffff ^ 1 ^ 0x100, w: 0 }, true), [0]);
  // Album 1 golden: Album 2 Stufe 0 …
  assert.deepEqual(arten({ ...a1(3), w: 0 }, true), [32, 33, 35, 36, 37, 38, 39]);
  // … dann vergolden (vor neuen Tricks) …
  assert.deepEqual(arten({ ...a1(3), w: 0xff | 0x0300 }, true), [32, 33]);
  // … dann die Tricks
  // (im Juni ohne den Schlitten)
  assert.deepEqual(arten({ ...a1(3), w: 0xff | 0x0300 | 0x030000 }, true), [35, 36, 37, 38, 39]);
  // alles golden: Leckerli
  assert.deepEqual(arten({ ...a1(3), w: w2(3) }, true), [null]);
  // golden ist immer ein Schatz, auch ohne Schatz-Platz
  assert.deepEqual(arten({ ...a1(3), w: 0 }, true, ALLE, 5, NIX), [32, 33, 35, 36, 37, 38, 39]);
});

test('Jahreszeit: innerhalb einer Stufe zuerst die der Jahreszeit, sonst alle (Monat des schenkenden Geräts)', () => {
  const G = { ...a1(2), w: 0 };
  // Dezember: kein Picknick, kein Planschbecken, aber der Schlitten
  assert.deepEqual(arten(G, false, ALLE, 11), [32, 33, 34, 35, 36, 37]);
  // Juli: Planschbecken und Picknick, kein Schlitten
  assert.deepEqual(arten(G, false, ALLE, 6), [32, 33, 35, 36, 37, 38, 39]);
  // Oktober: weder Schlitten noch Picknick noch Planschbecken
  assert.deepEqual(arten(G, false, ALLE, 9), [32, 33, 35, 36, 37]);
  // Fehlt auf der Stufe nur noch einer außerhalb seiner Zeit, kommt er trotzdem (vor einem Trick)
  assert.deepEqual(arten({ ...a1(2), w: 0xff ^ 4 }, false, ALLE, 6), [34]);
  // … und auf der Stufe Trick entsprechend
  assert.deepEqual(arten({ ...a1(2), w: 0xff | 0xff00 ^ 0x8000 }, false, ALLE, 11), [39]);
});

test('Nur gebaute Schätze kommen (in 0.46 das Vogelhäuschen); sind sie fertig, gibt es Leckerli', () => {
  const info = T.A2_KEYS.map((k, t) => ({ built: t === 0, mo: null }));
  assert.deepEqual(arten({ ...a1(2), w: 0 }, false, info), [32]);
  assert.deepEqual(arten({ ...a1(2), w: 1 }, false, info), [32]);
  assert.deepEqual(arten({ ...a1(2), w: 0x101 }, false, info), [null]);
  assert.deepEqual(arten({ ...a1(3), w: 0x101 }, true, info), [32]);
  assert.deepEqual(arten({ ...a1(3), w: 0x10101 }, true, info), [null]);
  // die Karte mit ihrer Liste: was gebaut ist, und Leckerli der Jahreszeit danach
  const c = Object.create(T.PikaPetCard.prototype);
  c._hass = { config: { latitude: 50 } };
  const gebaut = T.A2_KEYS.filter((k, t) => c._a2Item(t).built);
  assert.ok(gebaut.includes('feeder'));
  const z = TRE[3];
  // (fehlt nur das Vogelhäuschen, kommt es: gleich, welche anderen inzwischen gebaut sind)
  assert.equal(c._giftPick({ ...a1(2), w: 0xfe }, z, false), 32);
  assert.ok(c._giftPick({ ...a1(2), w: 0xffffff }, z, false) >= 8);
  assert.ok(c._giftPick({ ...a1(2), w: 0xffffff }, z, false) < 16);
  // Würfel nur über z: zweimal dasselbe
  assert.equal(T.giftPickTre({ ...a1(2), w: 0 }, z, false, ALLE, 5), T.giftPickTre({ ...a1(2), w: 0 }, z, false, ALLE, 5));
});

test('Ein Schatz aus Album 2 macht nicht satt (nur ein Leckerli), Freude gibt es wie immer', () => {
  const gutschrift = (i) => {
    const c = Object.create(T.PikaPetCard.prototype);
    const add = [];
    Object.assign(c, {
      _cfg: {}, _haNow: () => 1e12, _add: (k, n) => add.push([k, n]),
      _giftOwn: { z: 5, i, x: 7, r: 3, at: 1e12 }, _planBase: { gift: { z: 5, i, x: 7, r: 3 } },
    });
    c._giftCredit();
    return plain(add);
  };
  assert.deepEqual(gutschrift(32), [['g', T.GIFT.joy]]);
  assert.deepEqual(gutschrift(48 + 2), [['g', T.GIFT.joy]]);
  assert.deepEqual(gutschrift(3), [['g', T.GIFT.joy]]);
  assert.deepEqual(gutschrift(12), [['s', T.GIFT.treat], ['g', T.GIFT.joy]]);
  assert.deepEqual(gutschrift(28), [['s', T.GIFT.treat], ['g', T.GIFT.joy]]);
});
