// Album 2 in der Zwei-Karten-Welt (welt.mjs): zwei neue Karten teilen Album 2 über den Helfer, und eine Karte von
// 0.45.2 (aus git) verstummt, sobald Album 2 im Plan steht, statt es zu löschen. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const sek = (t) => Math.round(t / 1000) * 1000;
let ALT = null;
try {
  ALT = execSync('git show 25dc2c7:pika-pet-card.js', { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) { ALT = null; }

// Helfer gefüllt: Album 1 voll mit Trick, ein Päckchen im Vorrat, heute einmal gestreichelt
const anfang = (opt) => {
  const W = welt(opt);
  const { T } = W;
  const t0 = W.jetzt();
  const tag = T.pikaDay(t0);
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 2, a: 10, f: 3, p: sek(t0 - 36e5), u: 255, v: 255, z: 9, o: 9 } },
    { t: 'pet', d: tag, n: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  return { W, T, tag, helfer: () => T.planParse(W.ha.wert(PLAN)) };
};
// Das Vogelhäuschen verschenken und auspacken (wie die Karte: give mit i = 32, dann gopen)
const schenken = async (W, K, z, gold = false) => {
  K.c._planOp({ t: 'give', z, i: 32 + (gold ? 16 : 0), gold, x: sek(W.jetzt()), r: 5 });
  await W.vor(1000);
  K.c._planOp({ t: 'gopen', z });
  await W.vor(1000);
};

test('Zwei Karten: Album 2 kommt über den Helfer auf beide, Stufen wachsen, der Text hat acht Abschnitte', async () => {
  const { W, T, tag, helfer } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  await schenken(W, A, 10);
  assert.equal(helfer().gift.w, 1);
  assert.equal(W.ha.wert(PLAN).split('|').length, 8);
  assert.match(W.ha.wert(PLAN), /\|-\|a1$/);
  assert.equal(B.c._plan.gift.w, 1);
  assert.equal(B.c._a2Lv('feeder'), 1, 'B kennt die Stufe (ausgepackt)');
  // B streichelt: der Plan bleibt mit Album 2
  B.streicheln();
  await W.vor(3000);
  assert.deepEqual([helfer().gift.w, helfer().cute.n, helfer().cute.d], [1, 2, tag]);
  await schenken(W, B, 11);
  assert.equal(helfer().gift.w, 0x101);
  assert.equal(A.c._plan.gift.w, 0x101);
  for (const K of [A, B]) assert.equal(T.planSer(K.c._plan), W.ha.wert(PLAN), `${K.name} sieht den Plan aus dem Helfer`);
  assert.deepEqual(W.warnungen, []);
});

test('Zwei Karten: Eine Karte von 0.45.2 schreibt weiter, solange Album 2 leer ist, und verstummt, sobald es im Plan steht',
  { skip: !ALT && 'ohne git keine alte Karte' }, async () => {
    const { W, helfer } = anfang({ alt: ALT });
    const A = W.karte('A');
    const C = W.karte('C', {}, { alt: true });
    await W.vor(100);
    // vorher: die alte Karte schreibt (Streicheln), die neue liest es
    C.c._petCount();
    await W.vor(3000);
    assert.equal(helfer().cute.n, 2);
    assert.equal(C.c._planNewer, false);
    assert.equal(A.c._plan.cute.n, 2);
    const vonC = () => W.ha.zeilen(PLAN).filter((z) => z.startsWith('C:')).length;
    const vorher = vonC();
    assert.ok(vorher >= 1);
    // A schenkt das Vogelhäuschen: Album 2 steht im Plan, die alte Karte hält ihn für das Format einer neueren
    await schenken(W, A, 10);
    assert.equal(helfer().gift.w, 1);
    assert.equal(C.c._planNewer, true);
    assert.ok(W.warnungen.some((x) => /Format einer neueren Karte/.test(x)), W.warnungen.join(' | '));
    // C streichelt und merkt sich etwas: nichts davon kommt in den Helfer, Album 2 bleibt
    for (let i = 0; i < 3; i++) C.c._petCount();
    C.c._planOp({ t: 'mem', d: W.T.pikaDay(W.jetzt()), b: 4 });
    await W.vor(20 * 6e4);
    assert.equal(vonC(), vorher, 'C hat nichts mehr geschrieben');
    assert.equal(helfer().gift.w, 1);
    assert.equal(helfer().gift.i, 32);
    // A schreibt weiter wie immer
    A.streicheln();
    await W.vor(3000);
    assert.equal(helfer().cute.n, 3);
    assert.equal(helfer().gift.w, 1);
  });
