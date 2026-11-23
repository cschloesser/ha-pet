// Helfer von Hand geleert, kurz nachdem ein Gerät sich wieder verbunden hat (Review 0.48.1): Seit 0.48.1 legt eine
// Karte ihre schon bestätigten Änderungen noch 15 s ab der Bestätigung auf fremde Stände (_planNear). Nach dem
// Wiederverbinden sind das auch die ohne Verbindung gesammelten (bis 30 Min alt). Wer den Helfer leert, will von vorn
// anfangen: Sie kommen nicht auf den frischen Plan, den ein neu geladenes Gerät danach schreibt. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const sek = (t) => Math.round(t / 1000) * 1000;

const lauf = async (s) => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  const t0 = W.jetzt();
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 3, a: 10, f: 3, p: sek(t0 - 36e5), u: 255, v: 255, z: 9, o: 9, y: 0 } },
    { t: 'pet', d: T.pikaDay(t0), n: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  const A = W.karte('A');
  await W.vor(500);
  // A ohne Verbindung: streicheln, ein Erlebnis, ein Eintrag im Verlauf, Urlaub; 20 Min später wieder verbunden
  A.trennen();
  await W.vor(60000);
  for (let i = 0; i < 4; i++) {
    A.streicheln();
    await W.vor(3000);
  }
  A.c._planOp({ t: 'mem', d: T.pikaDay(W.jetzt()), b: 4 });
  A.c._planOp({ t: 'rec', k: 9e6, a: 'read' });
  A.c._planOp({ t: 'von', t0: sek(W.jetzt()) });
  await W.vor(20 * 6e4);
  A.aufbauen();
  A.verbinden();
  await W.vor(s * 1000);
  assert.ok(T.planParse(W.ha.wert(PLAN)).ur, 'der Urlaub von A steht im Helfer (bestätigt)');
  // von Hand geleert, B lädt neu und schreibt einen frischen Plan
  W.ha.setze(PLAN, '', 'hand');
  await W.vor(300);
  const B = W.karte('B');
  await W.vor(1500);
  B.streicheln();
  await W.vor(3 * 6e4);
  return { H: T.planParse(W.ha.wert(PLAN)), A };
};

for (const s of [2, 8]) {
  test(`Helfer ${s} s nach dem Wiederverbinden von Hand geleert: Das Alte von A kommt nicht auf den frischen Plan`, async () => {
    const { H } = await lauf(s);
    assert.ok(H, 'im Helfer steht ein Plan');
    assert.equal(H.ur, null, 'kein Urlaub (A hatte ihn vor 20 Min begonnen, er ist mit dem Leeren weg)');
    assert.equal(H.rec.length, 0, 'kein Verlauf von A');
    assert.equal(H.cute?.m ?? 0, 0, 'kein Erlebnis von A');
    assert.equal(H.cute?.n, 1, 'nur das Streicheln von B');
  });
}

test('Helfer von Hand geleert: Was HA von A noch nicht bestätigt hat, kommt weiter obendrauf', async () => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  const t0 = W.jetzt();
  W.ha.setze(PLAN, T.planSer(T.planBlank(t0)), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  const A = W.karte('A');
  await W.vor(500);
  A.leitung = 'verlieren'; // (das Schreiben kommt nie an, also auch keine Bestätigung)
  A.c._planOp({ t: 'rec', k: 9e6, a: 'read' });
  await W.vor(1000);
  W.ha.setze(PLAN, '', 'hand');
  await W.vor(300);
  assert.ok(A.c._planOps.some((o) => o.t === 'rec'), 'die unbestätigte Änderung bleibt offen');
});
