// „Alles golden“ mit zwei Alben (Fund 3 des Audits 0.48 und Nachtrag „Aussehen“): Ist Album 1 ganz golden, hat Album 2
// schon begonnen, „alle Schätze“ wären es dann nicht. Was im Reiter Schätze steht, kommt aus den ausgepackten Stufen;
// Meilenstein und Feier auf demselben Päckchen stehen beide im Tagebuch; die Vorschau wählt mit ihrem Monat. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const sek = (t) => Math.round(t / 1000) * 1000;

const zuhause = async () => {
  const W = welt();
  const { T } = W;
  const t0 = W.jetzt();
  let P = T.planBlank(t0);
  for (const op of [{ t: 'gstart', k: sek(t0 - 5 * 864e5) }, { t: 'gdbg', f: { n: 2, a: 10, f: 3, u: 255, v: 0xffff, z: 6, o: 6, p: sek(t0 - 36e5) } }]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 50, g: 50 }), 'anfang', { max: 100 });
  const K = W.karte('K', { gifts: true });
  await W.vor(1000);
  K.c._blooms ??= [];
  return { W, T, c: K.c, t0 };
};

test('Feier: Album 1 ganz golden heißt so, sobald Album 2 begonnen hat', async () => {
  const { T } = welt();
  const c = Object.create(T.PikaPetCard.prototype);
  const sagt = [];
  const leer = () => {};
  Object.assign(c, {
    _g: { gy: 210, pH: 99 }, _H: 248, _x: 200, _el: { fx: { appendChild: leer } }, _gtEls: new Map(), _a2Els: new Map(),
    _say: (t) => sagt.push(t), _happy: leer, _jump: leer, _hearts: leer, _wait: async () => {},
  });
  c._plan = { gift: { u: 255, v: 0xffff, w: 0x0303, z: 10, o: 10, i: 23 } };
  await c._giftFeier('gold');
  c._plan = { gift: { u: 255, v: 0xffff, w: 0xffffff, z: 11, o: 11, i: 55 } };
  await c._giftFeier('gold2');
  await c._giftFeier(25);
  assert.deepEqual(sagt, ['Album 1 ganz golden!', 'Album 2 ganz golden!', 'Mein 25. Päckchen!']);
});

test('Reiter Schätze: golden, „beide Alben golden“ und Album 2 erst mit den ausgepackten Stufen; Album 1 mit Überschrift', async () => {
  const { c } = await zuhause();
  const seite = (g) => {
    c._plan = { ...c._plan, gift: { ...c._plan.gift, n: 1, y: 0, ...g } };
    return { I: plain(c._giftInfo()), h: c._diaryTreasures() };
  };
  // Der letzte goldene Schatz aus Album 1 (Glöckchen, t = 7) hängt noch am Ballon: noch nicht alles golden
  let { I, h } = seite({ u: 255, v: 0xffff, w: 0, z: 11, o: 10, i: 7 + 16 });
  assert.deepEqual([I.allGold, I.lvs[7]], [false, 2]);
  assert.doesNotMatch(h, / golden!/);
  ({ I, h } = seite({ o: 11 }));
  assert.equal(I.allGold, true);
  assert.match(h, /11 Päckchen · Album 1 golden!/);
  // Album 2: das letzte goldene (Planschbecken, t2 = 7) fliegt noch
  ({ I, h } = seite({ w: 0xffffff, z: 12, o: 11, i: 32 + 7 + 16 }));
  assert.deepEqual([I.allGold2, I.lvs2[7]], [false, 2]);
  assert.doesNotMatch(h, /beide Alben golden/);
  ({ I, h } = seite({ o: 12 }));
  assert.equal(I.allGold2, true);
  assert.match(h, /beide Alben golden!/);
  // Der letzte Trick aus Album 1 fliegt noch: Album 2 hat noch nicht begonnen, keine Überschriften
  ({ I, h } = seite({ v: 0xff, w: 0, z: 13, o: 12, i: 7 }));
  assert.equal(I.a2, false);
  assert.doesNotMatch(h, /<h3>Album/);
  // … ausgepackt: zwei Alben, jedes mit Überschrift, Album 1 zuerst
  ({ I, h } = seite({ o: 13 }));
  assert.equal(I.a2, true);
  assert.ok(h.indexOf('<h3>Album 1</h3>') >= 0 && h.indexOf('<h3>Album 1</h3>') < h.indexOf('<h3>Album 2</h3>'), 'Album 1, dann Album 2');
  assert.ok(h.indexOf('<h3>Album 1</h3>') < h.indexOf('class="tre"'), 'die Überschrift steht über den Plätzen');
});

test('Tagebuch: Album 1 golden mit begonnenem Album 2 heißt „erstes Album“, und der Meilenstein auf demselben Päckchen steht auch da', async () => {
  const { W, T, c, t0 } = await zuhause();
  let P = T.planApply(T.planBlank(t0), { t: 'gstart', k: sek(t0 - 864e5) }, t0);
  P = T.planApply(P, { t: 'gdbg', f: { n: 3, y: 2, u: 255, v: 0xffff & ~(1 << 15), z: 9, o: 9, w: 0x0303 } }, t0);
  const L = [{ t: t0 - 9e5, v: P }];
  const b = T.planApply(P, { t: 'give', z: 10, i: 7 + 16, gold: true, x: sek(t0 - 8e5), r: 1 }, t0 - 8e5);
  L.push({ t: t0 - 8e5, v: b }, { t: t0 - 7e5, v: T.planApply(b, { t: 'gopen', z: 10 }, t0 - 7e5) });
  const R = T.diaryDerive([], L, t0 - 1e6, { decayAt: () => Infinity, until: t0 });
  const pk = plain(R.ev.filter((e) => e.k === 'parcel'));
  assert.deepEqual(pk.map((e) => [e.o, e.what, e.all, e.mile, e.a2]), [[10, 'gilt', true, true, true]]);
  c._dbgDiary = () => ({ ev: pk, stamps: [], pets: {} });
  const D = await c._diaryBuild();
  const texte = D.days[0].entries.filter((e) => e.icon === 'parcel').map((e) => e.text);
  assert.equal(texte.length, 3, texte.join(' / '));
  assert.match(texte.join(' / '), /Mein erstes Album ist ganz golden/);
  assert.doesNotMatch(texte.join(' / '), /alle meine Schätze/);
  assert.match(texte.join(' / '), /10\. Päckchen/);
  // Ohne Album 2 (ältere Verläufe gibt es so nicht mehr, aber das Ereignis ohne a2) bleibt es bei „alle meine Schätze“
  c._dbgDiary = () => ({ ev: [{ ...pk[0], a2: undefined, mile: false }], stamps: [], pets: {} });
  const D2 = await c._diaryBuild();
  assert.match(D2.days[0].entries.map((e) => e.text).join(' / '), /alle meine Schätze golden/);
  W.pruefe();
});

test('Päckchen-Inhalt: Die Vorschau wählt mit ihrem Monat (_dbgDate), wie die Schätze', async () => {
  const { c } = await zuhause();
  const G = { u: 255, v: 255, w: 0x3b };
  // Im Oktober ist das Planschbecken dran, im November (Uhr der Welt) der Schlitten
  assert.equal(c._giftPick(G, 10, false), 32 + 2);
  c._dbgDate = new Date(2026, 9, 15, 12).getTime();
  assert.equal(c._giftPick(G, 10, false), 32 + 7);
  c._dbgDate = null;
  assert.equal(c._giftPick(G, 10, false), 32 + 2);
});
