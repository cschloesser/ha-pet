// Ein Gerät, das im Helfer den Plan einer neueren Version findet (_planNewer), schreibt den Plan nicht mehr. Dann darf
// es auch keine Päckchen verdienen, verschenken oder belohnen (Fund 2 des Audits 0.48): Das gälte nur hier, und die
// Belohnung käme ohne Bestätigung. Und ein zu kurzer Helfer (max. Länge unter PLAN_MIN) ist kein neueres Format
// (Fund 4). node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const sek = (t) => Math.round(t / 1000) * 1000;

// Helfer mit drei Päckchen im Vorrat (Album 1 fertig); text(P): was im Helfer steht, max: seine Länge, g: mehr im Päckchen
const anfang = (text = (s) => s, max = 255, g = {}) => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  const t0 = W.jetzt();
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 3, a: 10, f: 3, p: sek(t0 - 36e5), u: 255, v: 255, z: 9, o: 9, y: 0, ...g } },
    { t: 'pet', d: T.pikaDay(t0), n: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, text(T.planSer(P)), 'anfang', { max });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  return { W, T, P };
};
// Belohnung und Pflege echt (in welt.mjs stillgelegt), Belohnungen mitschreiben
const echt = (K) => {
  delete K.c._giftCredit;
  delete K.c._careEval;
  K.c._giftRender = () => {}; // (der Knopf ist hier eine Attrappe)
  K.c._g ??= {};
  K.c._blooms ??= [];
  const lohn = [];
  const add = K.c._add;
  K.c._add = function (k, d, self) {
    if (self) lohn.push(k);
    return add.call(this, k, d, self);
  };
  return lohn;
};

test('Neuere Version im Helfer: kein Verdienen, kein Verschenken, keine Belohnung; im Reiter Schätze „bitte neu laden“', async () => {
  const { W, T } = anfang();
  const A = W.karte('A', { gifts: true });
  const lohn = echt(A);
  await W.vor(1000);
  const c = A.c;
  assert.equal(c._planNewer, false);
  // Ein schon aktualisiertes Gerät schreibt einen Abschnitt mehr, als diese Version kennt
  W.ha.setze(PLAN, `${W.ha.wert(PLAN)}|zukunft`, 'neu', { max: 255 });
  await W.vor(1000);
  assert.equal(c._planNewer, true);
  assert.equal(W.warnungen.filter((x) => /neueren Karte/.test(x)).length, 1);
  const z = c._plan.gift.z;
  assert.equal(c._plan.gift.n, 3, 'Päckchen lägen im Vorrat');
  // Pflege bewerten: ruht (sonst verdiente es Päckchen und Freundschaftstage, die nur hier gälten)
  assert.equal(c._careEval(true), null);
  // Knopf: nichts verschenkt, nichts in den Plan, nichts gesendet
  c._onGiftBtn();
  await W.vor(30000);
  assert.deepEqual([c._plan.gift.z, c._plan.gift.n, c._giftOwn ?? null], [z, 3, null]);
  assert.deepEqual(A.geschrieben(PLAN), []);
  // Ein eigenes Verschenken von vorher (eben noch alter Stand) wird nicht mehr belohnt, auch wenn es im eigenen Plan steht
  const G = c._plan.gift;
  c._planBase = T.planApply(c._planBase, { t: 'give', z: z + 1, i: 3, gold: false, x: sek(W.jetzt()), r: 5 }, W.jetzt());
  c._giftOwn = { z: z + 1, i: 3, x: sek(W.jetzt()), r: 5, at: c._haNow() };
  c._giftCredit();
  assert.deepEqual(lohn, []);
  assert.ok(c._giftOwn, 'wartet weiter (nach 30 Min vergessen)');
  await W.vor(31 * 6e4);
  W.regung();
  await W.vor(1000);
  c._giftCredit();
  assert.deepEqual([lohn.length, c._giftOwn], [0, null]);
  assert.equal(G.z, z);
  // Reiter Schätze: statt „nächstes in …“ der Hinweis
  assert.match(c._giftInfo().next, /bitte neu laden/);
  assert.match(c._diaryTreasures(), /bitte neu laden/);
  assert.equal(c._giftInfo().warn, false);
});

test('Zu kurzer Helfer (unter PLAN_MIN) mit einem Plan dieser Version: keine Warnung „neuere Karte“, Päckchen gehen auf diesem Gerät', async () => {
  // (mit Album 2 begonnen: acht Abschnitte; bis 0.48.0 hielt die Karte das im zu kurzen Helfer für neuer)
  const { W, T } = anfang(undefined, 150, { w: 1 });
  assert.ok(150 < T.PLAN_MIN);
  const vorher = W.ha.wert(PLAN);
  assert.equal(vorher.split('|').length, 8);
  const A = W.karte('A', { gifts: true });
  const lohn = echt(A);
  await W.vor(1000);
  const c = A.c;
  assert.equal(c._planNewer, false);
  assert.deepEqual(W.warnungen.filter((x) => /neueren Karte/.test(x)), []);
  assert.notEqual(c._careEval(true), null, 'die Pflege zählt');
  // Der Plan bleibt im Browser (der eingefrorene Stand im Helfer zählt nicht, siehe _hassPlan): Vorrat wie in der Vorschau
  c._planOp({ t: 'gdbg', f: { n: 2 } });
  // Verschenken geht, der Helfer wird nicht beschrieben, belohnt wird
  const z = c._plan.gift.z;
  c._onGiftBtn();
  await W.vor(30000);
  assert.equal(c._plan.gift.z, z + 1);
  assert.equal(W.ha.wert(PLAN), vorher);
  assert.deepEqual(A.geschrieben(PLAN), []);
  assert.ok(lohn.includes('g'), `Belohnung ${lohn.join('')}`);
  assert.deepEqual(W.warnungen.filter((x) => !/zu kurz/.test(x)), [], 'nur die Warnung „zu kurz“');
});
