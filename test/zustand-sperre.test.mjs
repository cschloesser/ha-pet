// Schreibsperre des Zustands nach dem Wiedereinhängen (Nach-Audit 0.45.1): Wie der Tagesplan (_planDoubt) schreibt
// eine Karte, die länger abgehängt war, ihren Zustand erst, wenn HA einen frischen Stand geliefert hat. Bis 0.45.0
// ging er 1,2 s nach dem ersten Streicheln oder Füttern hinaus, mit dem Stand von vor der Trennung, und überschrieb, was
// andere Geräte inzwischen gefüttert hatten. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const sek = (t) => Math.round(t / 1000) * 1000;
const um = (a, b, d = 0.3) => Math.abs(a - b) <= d;

// Satt 40, B füttert zweimal +20, während A 2 Min abgehängt ist. → { W, T, A, B, stand() }
const anfang = async () => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  const t0 = W.jetzt();
  let P = T.planBlank(t0);
  for (const op of [{ t: 'gstart', k: sek(t0 - 5 * 864e5) }, { t: 'pet', d: T.pikaDay(t0), n: 3 }]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 40, g: 60 }), 'anfang', { max: 100 });
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  A.abhaengen();
  await W.vor(60000);
  B.fuettern(20);
  await W.vor(5000);
  B.fuettern(20);
  await W.vor(55000);
  return { W, T, A, B, stand: () => T.parseStats(W.ha.wert(ZUSTAND)) };
};
// Was im Helfer stehen soll: B's Stand plus die eigenen Portionen, abzüglich Abbau seitdem (5 je Stunde)
const einig = (A, B) => { const [a, b] = [A.werte(), B.werte()]; assert.ok(um(a.s, b.s, 0.2) && um(a.g, b.g, 0.2), `A ${JSON.stringify(a)} B ${JSON.stringify(b)}`); };
const soll = (vor, nach, plus) => vor.s + plus - 5 * (nach.st - vor.st) / 3.6e6;

for (const [name, streicheln] of [['gestreichelt und gefüttert', true], ['nur gefüttert', false]]) {
  test(`Zustand: wieder eingehängt, aber HA setzt kein hass, ${name} – A überschreibt das Füttern von B nicht`, async () => {
    const { W, A, B, stand } = await anfang();
    const vor = stand();
    assert.ok(um(vor.s, 79.9), `B hat zweimal gefüttert (${vor.s})`);
    A.einhaengen({ hass: false });
    await W.vor(1000);
    if (streicheln) A.streicheln(4);
    A.fuettern(5);
    await W.vor(5 * 6e4);
    // Ohne frischen Stand schreibt A nicht (auch nicht nach einer Frist): Dass nichts kommt, heißt nicht, dass nichts geschah
    assert.equal(A.geschrieben(ZUSTAND).length, 0);
    assert.ok(um(stand().s, vor.s), 'B\'s Füttern steht noch im Helfer');
    // Das erste hass bringt den frischen Stand: A legt seine Portion darauf
    A.liefere();
    await W.vor(5000);
    const nach = stand();
    assert.ok(um(nach.s, soll(vor, nach, 5)), `satt ${nach.s}, soll ${soll(vor, nach, 5).toFixed(1)}`);
    assert.equal(A.geschrieben(ZUSTAND).length, 1);
    await W.vor(60000);
    einig(A, B);
    assert.deepEqual(W.warnungen, []);
  });
}

test('Zustand: wieder eingehängt mit frischem hass – A schreibt gleich wie bisher', async () => {
  const { W, A, B, stand } = await anfang();
  const vor = stand();
  A.einhaengen();
  await W.vor(1000);
  A.fuettern(5);
  await W.vor(3000);
  assert.equal(A.geschrieben(ZUSTAND).length, 1, 'kein Warten: der frische Stand war schon da');
  const nach = stand();
  assert.ok(um(nach.s, soll(vor, nach, 5)), `satt ${nach.s}`);
  await W.vor(60000);
  einig(A, B);
});

test('Zustand: nur kurz abgehängt (unter 2 s, z. B. ein Umsortieren der Karten) – kein Zweifel, kein Warten', async () => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(W.jetzt()), s: 40, g: 60 }), 'anfang', { max: 100 });
  const A = W.karte('A');
  await W.vor(100);
  A.abhaengen();
  await W.vor(1000);
  A.einhaengen({ hass: false });
  A.fuettern(5);
  await W.vor(3000);
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
});

test('Zustand: HA liefert nach dem Einhängen dieselben Zustände wieder (dort hat sich nichts geändert) – nach der Frist geht A\'s Portion hinaus, ohne weiteres hass', async () => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(W.jetzt()), s: 40, g: 60 }), 'anfang', { max: 100 });
  const A = W.karte('A');
  await W.vor(100);
  A.abhaengen();
  await W.vor(60000);
  A.einhaengen({ hass: false });
  await W.vor(500);
  // ein neues hass-Objekt mit denselben Zuständen (nur „verbunden“, sonst nichts Neues)
  A.c.hass = { ...A.c._hass };
  A.fuettern(5);
  await W.vor(3000);
  assert.equal(A.geschrieben(ZUSTAND).length, 0, 'innerhalb der Frist noch nicht');
  await W.vor(10000);
  assert.equal(A.geschrieben(ZUSTAND).length, 1, 'nach der Frist gilt der eigene Stand');
  assert.ok(T.parseStats(W.ha.wert(ZUSTAND)).s > 44);
});

// Ruhiges Haus: Während A weg war, hat sich in HA nichts geändert, beim Einhängen kommen dieselben Zustände (die Frist
// läuft, siehe _stDoubt). → { W, T, A, B, stand() } mit Satt 40
const ruhig = async () => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(W.jetzt()), s: 40, g: 60 }), 'anfang', { max: 100 });
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  A.abhaengen();
  await W.vor(60000);
  A.einhaengen();
  await W.vor(300);
  return { W, T, A, B, stand: () => T.parseStats(W.ha.wert(ZUSTAND)) };
};

test('Zustand: in der Frist wieder abgehängt – A sendet nicht blind, B\'s Füttern bleibt, A\'s Portion kommt beim Wiedereinhängen dazu', async () => {
  const { W, A, B, stand } = await ruhig();
  A.fuettern(5);
  await W.vor(2000);
  A.abhaengen();
  await W.vor(3000);
  B.fuettern(20);
  await W.vor(20000);
  assert.equal(A.geschrieben(ZUSTAND).length, 0, 'abgehängt schreibt A nicht (die Frist sähe sonst blind „gilt“)');
  const mitB = stand().s;
  assert.ok(mitB > 59, `B's Portion steht im Helfer (${mitB})`);
  A.einhaengen();
  await W.vor(30000);
  assert.ok(um(stand().s, mitB + 5, 0.4), `satt ${stand().s}, soll ≈ ${(mitB + 5).toFixed(1)}`);
  einig(A, B);
});

test('Zustand: die App geht in der Frist zu – hat HA dieselben Zustände bestätigt, geht die Portion noch hinaus', async () => {
  const { W, A, stand } = await ruhig();
  A.fuettern(15);
  await W.vor(5000);
  assert.equal(A.geschrieben(ZUSTAND).length, 0, 'noch in der Frist');
  A.c._flush(); // pagehide
  await W.vor(2000);
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
  assert.ok(um(stand().s, 55, 0.3), `satt ${stand().s}`);
});
