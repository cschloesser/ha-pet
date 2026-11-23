// Album 2: die Laterne (Schatz t2 = 1) – Daten, Wahl der Aktionen (Dämmerung, Nacht, Abendrunde, Wetter), Platz am Bau,
// Spiel, Abbruch, Trick, Gold, Tipp, Auspacken, Aufräumen, Tagebuch. Ohne echte Szene: Elemente sind Attrappen, die Uhr
// ist die der Welt (W.vor). node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { welt } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const sek = (t) => Math.round(t / 1000) * 1000;
const STAY = 4 * 6e4;

// Ein Element, soweit Szene, Schein, Glühwürmchen und Auspacken es anfassen
class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.cls = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => this.cls.add(x)), remove: (...k) => k.forEach((x) => this.cls.delete(x)),
      contains: (k) => this.cls.has(k), toggle: (k, on) => ((on ?? !this.cls.has(k)) ? this.cls.add(k) : this.cls.delete(k)),
    };
    this.style = { setProperty() {} };
    this.dataset = {};
    this.kinder = [];
    this.weg = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.parentElement = null;
    this.offsetWidth = 10;
  }

  set className(v) {
    this.cls = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this.cls].join(' ');
  }

  querySelector() {
    this.unter ??= new El();
    return this.unter;
  }

  addEventListener() {}

  appendChild(k) {
    k.parentElement?.kinder && (k.parentElement.kinder = k.parentElement.kinder.filter((x) => x !== k));
    this.kinder.push(k);
    k.parentElement = this;
    return k;
  }

  remove() {
    this.weg = true;
    this.isConnected = false;
  }

  animate() {
    return { cancel() {}, finish() {} };
  }

  getBoundingClientRect() {
    return { left: 140, top: 150, right: 160, bottom: 180, width: 20, height: 30 };
  }
}

// Eine Karte ohne Szene, mit Album 1 voll (Trick) und der Laterne auf Stufe lv. cls: Tageszeit der Szene. ruf: was sie tut
const karte = (lv = 1, cls = ['dusk'], extra = {}) => {
  const W = welt({ start: new Date(2026, 10, 15, 17).getTime() });
  W.dok.createElement = (t) => new El(t);
  const { T } = W;
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 2 : 0) | (lv >= 2 ? 0x200 : 0) | (lv >= 3 ? 0x20000 : 0);
  const leer = () => {};
  const scene = new El();
  scene.cls = new Set(cls);
  Object.assign(c, {
    _cfg: { gifts: true, depth: true }, _W: 600, _H: 248, _x: 300, _dir: 1, _lane: 0, _lift: 0, _wx: {}, _wind: 0, _dbgSleep: false,
    _g: { gy: 210, pW: 119, pH: 99, hayL: 182, hayR: 222, hay: 202, stash: true, home: 96, xR: 546, fMin: 0.43, fMax: 0.72,
      rock: { l: 441, w: 150, ku: 1.5, cx: 516 }, hole: { l: 70, r: 121, cx: 96, top: 161 } },
    _el: { pika: new El(), fx: new El(), gifts: new El(), birds: new El(), scene },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 33 } },
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _face: (d) => (c._dir = d),
    _walkTo: async (x, v, steady, lane = 0) => {
      ruf.push(['geht', Math.round(x), c._cfg.depth ? lane : 0]);
      c._x = x;
      c._lane = c._cfg.depth ? lane : 0;
    },
    _enterBurrow: async () => ruf.push(['in den Bau']), _comeOut: async () => ruf.push(['heraus']),
    _nosePos: () => ({ x: c._x + c._dir * 30.7, y: 167 }),
    _mouth: (col, svg) => ruf.push(['maul', svg ?? col]),
    _sparkle: leer, _mimik: leer, _happy: () => ruf.push(['freut']), _jump: (k) => ruf.push(['springt', k]), _note: (t) => ruf.push(['note', t]),
    _peep: (x, y, t) => ruf.push(['piep', t]), _found: (k) => ruf.push(['entdeckt', k]), _away: () => false, _urlaubFern: () => false,
    _planOp: (op) => ruf.push(['op', op.t, op.z]), _giftFromPlan: () => ruf.push(['plan']), _giftFeier: async (was) => ruf.push(['feier', was]),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  return { W, T, c, ruf };
};
const geht = (ruf) => ruf.filter((r) => r[0] === 'geht').map((r) => r.slice(1));
const glow = (c) => c._el.fx.kinder.find((k) => k.cls.has('a2lglow'));

test('Laterne: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, ganzjährig, Aktionen gibt es', () => {
  const { c } = karte();
  const it = c._a2Item(1);
  assert.equal(it.key, 'lantern');
  assert.equal(it.built, true);
  assert.equal(it.mo, null);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.ok(it.find?.t && it.find?.h);
  assert.equal(it.dbg.length, 3);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // Im Maul: 24 × 24 ohne id und class (sonst griffe das Stylesheet des Pikas), golden in Gold
  const { c: c1, ruf: r1 } = karte(1);
  const { c: c3, ruf: r3 } = karte(3);
  c1._a2LanternHold(true);
  c3._a2LanternHold(true);
  const svg = (r) => r.find((x) => x[0] === 'maul')[1];
  for (const s of [svg(r1), svg(r3)]) {
    assert.match(s, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
    assert.doesNotMatch(s, /\sid=|\sclass=|NaN|undefined/);
  }
  assert.doesNotMatch(svg(r1), /#f2c230/);
  assert.match(svg(r3), /#f2c230/, 'golden');
  assert.ok(c1._el.pika.cls.has('carry') && c1._el.pika.cls.has('a2lc'));
  c1._a2LanternHold(false);
  assert.ok(!c1._el.pika.cls.has('carry') && !c1._el.pika.cls.has('a2lc'));
});

test('Laterne: Er mag sie in der Dämmerung und nachts, in der Abendrunde am liebsten; nicht bei Tag, Regen, Gewitter, Sturm', () => {
  const { c } = karte(1, []);
  const acts = (wx = {}, cls = []) => {
    c._el.scene.cls = new Set(cls);
    return plain(c._a2LanternActs({ wx }, c._a2Lv('lantern')));
  };
  assert.deepEqual(acts({}, ['day']), []);
  assert.deepEqual(acts({}, ['dusk']), [[0.5, 'a2LanternPlay'], [0, 'a2LanternRun']]);
  assert.deepEqual(acts({}, ['night']), [[0.4, 'a2LanternPlay'], [0, 'a2LanternRun']]);
  for (const wx of [{ wet: true }, { storm: true }, { shelter: true }]) assert.deepEqual(acts(wx, ['night']), [], JSON.stringify(wx));
  c._wind = 45;
  assert.deepEqual(acts({}, ['night']), []);
  c._wind = 0;
  // Schnee und Nebel halten ihn nicht ab
  assert.ok(acts({ snowcover: true, fog: true }, ['night'])[0][0] > 0);
  // Morgendämmerung (vor Sonnenaufgang ist die Szene auch .dusk): nicht, die Laterne ist fürs Abendlicht
  c._dbgDate = new Date(2026, 10, 15, 7, 10).getTime();
  assert.equal(c._a2LanternMorning(), true);
  assert.deepEqual(acts({}, ['dusk']), []);
  assert.deepEqual(acts({}, ['night']), []);
  c._dbgDate = new Date(2026, 10, 15, 0, 30).getTime();
  assert.equal(c._a2LanternMorning(), false, 'nach Mitternacht ist noch Abend');
  c._dbgDate = null;
  assert.equal(c._a2LanternMorning(), false, 'Uhr der Welt: 17 Uhr');
  // Abendrunde: die letzte halbe Stunde vor der Schlafenszeit, auch wenn es noch hell ist (Sommer)
  c._dbgSleep = null;
  const t = c._haNow();
  c._wakeWins = () => [[t - 10 * 36e5, t + 20 * 6e4]];
  assert.equal(c._a2LanternEve(), true);
  assert.deepEqual(acts({}, ['day']), [[0.5, 'a2LanternPlay'], [0, 'a2LanternRun']]);
  assert.equal(acts({}, ['dusk'])[0][0], 1);
  assert.deepEqual(acts({ wet: true }, ['dusk']), []);
  c._wakeWins = () => [[t - 10 * 36e5, t + 50 * 6e4]];
  assert.equal(c._a2LanternEve(), false);
  // Stellt die Vorschau die Schlafenszeit von Hand, gilt die Abendrunde nicht
  c._wakeWins = () => [[t - 10 * 36e5, t + 20 * 6e4]];
  c._dbgSleep = false;
  assert.equal(c._a2LanternEve(), false);
  // Trick ab Stufe 2; steht sie schon brennend am Bau, seltener
  const { c: c2 } = karte(2, ['dusk']);
  const a2 = plain(c2._a2LanternActs({ wx: {} }, 2));
  assert.ok(a2[1][0] > 0);
  c2._a2LanternStand = { x: 150, foot: 0.02, until: Date.now() + STAY };
  assert.ok(c2._a2LanternActs({ wx: {} }, 2)[0][0] < a2[0][0]);
  // Wahl über die Schnittstelle: nur mit Album 2, nicht mit Ballon
  c._el.scene.cls = new Set(['dusk']);
  assert.ok(plain(c._a2Acts({ wx: {} })).some((a) => a[1] === 'a2LanternPlay'));
  c._gb = { z: 5 };
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  const { c: c0 } = karte(0, ['dusk']);
  assert.ok(!plain(c0._a2Acts({ wx: {} })).some((a) => /Lantern/.test(a[1])));
});

test('Laterne: Platz rechts neben der Tür, zwischen Tür und Heu; steht dort Festdeko, links der Tür', () => {
  const { c } = karte();
  const S = c._a2LanternSpot();
  assert.ok(S.x > c._g.hole.r && S.x < c._g.hayL, `${S.x}`);
  assert.ok(Math.abs(S.x - (121 + 182) / 2) < 0.01);
  assert.equal(S.foot, 0.02);
  c._festPos = { pumpkin: { l: S.x - 10, w: 20 } };
  assert.ok(c._a2LanternSpot().x < c._g.hole.l);
});

test('Laterne, Stufe 1: aus dem Bau holen, im Maul über die Wiese tragen, neben die Tür stellen; dort brennt sie eine Weile', async () => {
  const { W, c, ruf } = karte(1, ['dusk']);
  await c._a2LanternPlay();
  // erst in den Bau, mit ihr im Maul heraus, dann auf die Wiese
  const i = ruf.findIndex((r) => r[0] === 'in den Bau');
  const j = ruf.findIndex((r) => r[0] === 'maul' && /^<svg/.test(r[1]));
  const k = ruf.findIndex((r) => r[0] === 'heraus');
  assert.ok(i >= 0 && i < j && j < k, 'holt sie aus dem Bau');
  const G = geht(ruf);
  assert.ok(G[0][0] > c._g.home + c._g.pW, 'trägt sie ein Stück über die Wiese');
  // abgestellt: Maul über dem Platz, dann ein paar Schritte zurück (er verdeckt sie nicht); sie steht dort als Element
  // der Szene
  const S = c._a2LanternSpot();
  assert.deepEqual(G.slice(-2), [[Math.round(S.x + c._g.pW * 0.26), 0], [Math.round(S.x + c._g.pW * 0.95), 0]]);
  assert.equal(c._a2LanternStand.x, S.x);
  assert.equal(c._a2LanternCarry, false);
  assert.equal(c._a2LanternBusy, false);
  const el = c._a2Els.get('lantern');
  assert.ok(el.cls.has('gt') && el.cls.has('a2-lantern'));
  assert.equal(el.style.left, `${S.x.toFixed(1)}px`);
  assert.match(el.style.bottom, /var\(--gb\)/);
  assert.ok(Number(el.style.zIndex) > 0);
  assert.match(el.innerHTML, /class="a2lfl"/);
  // der Schein steht in .fx über dem Glas
  const g = glow(c);
  assert.ok(g && !g.cls.has('off'));
  assert.equal(g.style.left, `${S.x.toFixed(1)}px`);
  assert.ok(ruf.some((r) => r[0] === 'freut'));
  assert.ok(!c._el.pika.cls.has('a2lc'));
  // golden: .gilt (wie alle Schätze aus _a2El)
  c._plan.gift.w = 0x20202;
  c._a2Scene();
  assert.ok(el.cls.has('gilt'));
  // nach LANTERN_STAY geht sie aus: blendet aus, dann ist sie weg, der Schein auch
  await W.vor(STAY - 1000);
  c._a2Scene();
  assert.ok(c._a2LanternStand, 'brennt noch');
  await W.vor(2000);
  c._a2Scene();
  assert.equal(c._a2LanternStand, null);
  assert.ok(el.cls.has('a2out'));
  await W.vor(700);
  assert.equal(c._a2Els.has('lantern'), false);
  assert.equal(el.weg, true);
  assert.equal(g.weg, true);
  assert.equal(c._a2LanternGlow, null);
});

test('Laterne: steht sie schon, nimmt er sie dort auf; schläft er oder ist er verreist, geht sie aus; Abbruch: abstellen, wo er ist', async () => {
  const { W, c, ruf } = karte(1, ['night']);
  c._a2LanternStand = { x: 400, foot: 0, until: Date.now() + STAY };
  c._a2Scene();
  c._x = 250;
  await c._a2LanternPlay();
  assert.ok(!ruf.some((r) => r[0] === 'in den Bau'), 'nicht aus dem Bau');
  assert.deepEqual(geht(ruf)[0], [Math.round(400 - c._g.pW * 0.26), 0]);
  assert.equal(c._a2LanternStand.x, c._a2LanternSpot().x, 'jetzt am Bau');
  // Schlafen: aus
  c._asleep = true;
  c._a2Scene();
  assert.equal(c._a2LanternStand, null);
  await W.vor(700);
  assert.equal(c._a2Els.has('lantern'), false);
  c._asleep = false;
  // verreist: aus
  c._a2LanternStand = { x: 150, foot: 0.02, until: Date.now() + STAY };
  c._urlaubFern = () => true;
  c._a2Scene();
  assert.equal(c._a2LanternStand, null);
  c._urlaubFern = () => false;
  // Abbruch mitten im Weg (Futter fällt): Er stellt sie ab, wo er ist, auf seiner Spur; das Aufräumen lässt sie stehen
  const { c: a } = karte(1, ['dusk']);
  let n = 0;
  a._walkTo = async (x, v, s, lane = 0) => {
    if (++n === 2) throw new Error('Abbruch');
    a._x = x;
    a._lane = lane;
  };
  a._x = 350;
  await assert.rejects(a._a2LanternPlay({ hold: true }), /Abbruch/);
  a._cleanup = null;
  a._a2Cleanup();
  assert.equal(a._a2LanternCarry, false);
  assert.equal(a._a2LanternBusy, false);
  assert.ok(a._a2LanternStand, 'steht');
  assert.equal(a._a2LanternStand.foot, 0);
  assert.ok(Math.abs(a._a2LanternStand.x - a._nosePos().x) < 0.01);
  assert.ok(a._a2Els.has('lantern'));
  // im Bau abgebrochen: an ihren Platz
  const { c: b } = karte(1, ['dusk']);
  b._a2LanternHold(true, false);
  b._inside = true;
  b._a2LanternDropHere();
  assert.equal(b._a2LanternStand.x, b._a2LanternSpot().x);
});

test('Laterne, Stufe 2: Laternenlauf – mit depth eine Runde (vorn hin, hinten zurück, vor dem Stein), sonst hin und zurück', async () => {
  const { c, ruf } = karte(2, ['night']);
  await c._a2LanternRun();
  const G = geht(ruf);
  assert.ok(G.some((g) => g[1] === 1), 'auf der hinteren Spur');
  const hinten = G.filter((g) => g[1] === 1);
  assert.ok(hinten.every((g) => g[0] < c._g.rock.l), 'wendet vor dem Stein');
  assert.ok(ruf.some((r) => r[0] === 'note'));
  assert.ok(ruf.some((r) => r[0] === 'springt'), 'hält sie hoch');
  assert.ok(!c._el.pika.cls.has('a2lsw') && !c._el.pika.cls.has('a2lbig'));
  assert.ok(c._a2LanternStand, 'danach am Bau');
  // ohne depth: nur vorn
  const { c: d, ruf: rd } = karte(2, ['night']);
  d._cfg.depth = false;
  await d._a2LanternRun();
  assert.ok(geht(rd).every((g) => g[1] === 0));
  assert.ok(rd.some((r) => r[0] === 'sagt' && r[1] === '♪ ♫ ♪'));
  // schmale Karte (zu wenig Wiese vor dem Stein): auch mit depth hin und zurück
  const { c: s, ruf: rs } = karte(2, ['night']);
  Object.assign(s, { _W: 380 });
  Object.assign(s._g, { pW: 88, pH: 74, home: 71, hayL: 135, hayR: 180, hay: 157, xR: 340, fMin: 0.5, fMax: 0.67, rock: { l: 240, w: 120, ku: 1, cx: 300 }, hole: { l: 52, r: 90, cx: 71, top: 120 } });
  await s._a2LanternRun();
  assert.ok(geht(rs).every((g) => g[1] === 0));
  // Stufe 1: kein Trick
  const { c: e, ruf: re } = karte(1, ['night']);
  await e._a2LanternRun();
  assert.deepEqual(re, []);
  // Regen (nur aus der Vorschau): keine Runde, nur bis vor die Tür
  const { c: r, ruf: rr } = karte(2, ['night']);
  r._wx = { wet: true };
  await r._a2LanternRun();
  assert.ok(rr.some((x) => x[0] === 'sagt' && /nass|keine Runde/.test(x[1])));
  assert.ok(geht(rr).every((g) => g[0] < r._g.hayL + r._g.pW), 'bleibt am Bau');
  assert.ok(r._a2LanternStand);
});

test('Laterne, Stufe 3: Glühwürmchen kommen zum Licht und bleiben bei ihr; ohne Option fireflies goldene Funken', async () => {
  const { W, c } = karte(3, ['night']);
  c._dbgGold = true;
  await c._a2LanternPlay();
  const g = glow(c);
  const F = g.kinder.filter((k) => k.cls.has('a2lff'));
  assert.equal(F.length, 3);
  assert.ok(F.every((f) => f.cls.has('gfx') && f.cls.has('hff') && f.innerHTML === '<i></i>'), 'GOLD_FIREFLY');
  assert.equal(c._a2LanternFF.length, 3);
  // sie gehen mit aus
  await W.vor(STAY + 1000);
  c._a2Scene();
  await W.vor(700);
  assert.ok(F.every((f) => f.cls.has('off')));
  await W.vor(900);
  assert.equal(c._a2LanternFF.length, 0);
  assert.ok(F.every((f) => f.weg));
  // ohne Option fireflies: keine Glühwürmchen, Funken (goldene Spur) statt dessen
  const { c: o } = karte(3, ['night']);
  o._cfg.fireflies = false;
  o._dbgGold = true;
  await o._a2LanternPlay();
  assert.equal((o._a2LanternFF || []).length, 0);
  assert.ok(o._el.fx.kinder.some((k) => k.cls.has('gfx') && k.cls.has('trail')));
  // nicht golden: nie, auch nicht mit _dbgGold (die Vorschau setzt es für ihre Gold-Knöpfe)
  const { c: n } = karte(2, ['night']);
  n._dbgGold = true;
  assert.equal(n._a2LanternGoldNow(false), false);
  // von selbst: nur im Dunkeln, mit Abstand
  const { c: h } = karte(3, ['day']);
  assert.equal(h._a2LanternGoldNow(false), false);
  h._el.scene.cls = new Set(['night']);
  const R = { cd: 3 * 6e4, p: 1 };
  assert.equal(h._a2GoldOk('lantern', R), true);
  assert.equal(h._a2GoldOk('lantern', R), false);
});

test('Laterne: Tipp auf die brennende Laterne – Flamme flackert, eine Minute länger, Zone in der Welt, Entdeckung zählt', async () => {
  const { W, c, ruf, T } = karte(3, ['dusk']);
  // getragen oder weggeräumt: keine Zone
  let Z = [];
  c._a2Zones(Z, { left: 0, top: 0 });
  assert.equal(Z.length, 0);
  await c._a2LanternPlay();
  Z = [];
  c._a2Zones(Z, { left: 0, top: 0 });
  const z = Z.find((x) => x.k === 'lantern');
  assert.ok(z && z.a2);
  const until = c._a2LanternStand.until;
  await W.vor(30000);
  assert.equal(c._a2Tap(z), true);
  assert.ok(c._a2Els.get('lantern').cls.has('a2ltap'));
  assert.ok(glow(c).cls.has('flare'));
  assert.ok(ruf.some((r) => r[0] === 'piep' && /flacker/.test(r[1])));
  assert.ok(c._a2LanternStand.until > until);
  // golden: ein Glühwürmchen kommt dazu (höchstens vier)
  for (let i = 0; i < 6; i++) c._a2Tap(z);
  assert.equal(c._a2LanternFF.length, 4);
  await W.vor(900);
  assert.ok(!c._a2Els.get('lantern').cls.has('a2ltap'));
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('head,lantern,unbekannt')], ['head', 'lantern']);
});

test('Laterne auspacken: neu (kurze Runde), Trick (Laternenlauf), golden (mit Glühwürmchen); Abhängen räumt alles weg', async () => {
  const { c, ruf } = karte(1, ['dusk']);
  await c._a2LanternStow(1);
  assert.ok(!ruf.some((r) => r[0] === 'in den Bau'), 'hat sie schon im Maul');
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /Abend|Licht/.test(r[1])));
  assert.ok(c._a2LanternStand);
  const { c: c2, ruf: r2 } = karte(2, ['dusk']);
  await c2._a2LanternStow(2);
  assert.ok(r2.some((r) => r[0] === 'note'), 'Laternenlauf');
  const { c: c3 } = karte(3, ['dusk']);
  await c3._a2LanternStow(3);
  assert.equal(c3._a2LanternFF.length, 3, 'Glühwürmchen sicher');
  // steht sie noch brennend am Bau, holt er sie dort (sie springt ihm nicht ins Maul)
  const { c: c4, ruf: r4 } = karte(3, ['dusk']);
  c4._a2LanternStand = { x: 150, foot: 0.02, until: Date.now() + STAY };
  c4._a2Scene();
  c4._x = 400;
  await c4._a2LanternStow(3);
  const G4 = geht(r4);
  assert.deepEqual(G4[0], [Math.round(150 + c4._g.pW * 0.26), 0], 'geht erst zu ihr');
  assert.ok(r4.findIndex((r) => r[0] === 'maul') > r4.findIndex((r) => r[0] === 'geht'));
  // Abhängen: nichts bleibt
  const g = glow(c3);
  const F = [...c3._a2LanternFF];
  c3._a2LanternHold(true);
  c3._a2LanternDetach();
  assert.equal(c3._a2LanternStand, null);
  assert.equal(c3._a2LanternCarry, false);
  assert.equal(c3._a2Els.has('lantern'), false);
  assert.ok(g.weg && F.every((f) => f.weg));
  assert.equal(c3._a2LanternGlow, null);
});

test('Laterne auspacken über das Päckchen: was er sagt (neu, Trick, golden), dann vorführen; Tagebuch erzählt davon', async () => {
  const auspacken = async (lv, w) => {
    const { c, ruf } = karte(lv, ['dusk']);
    c._plan = { gift: { u: 255, v: 255, w, z: 7, o: 6, i: 33 } };
    c._gb = { z: 7, el: new El(), x: 300, gold: lv === 3, item: 1, alb: 2, stage: 'ground' };
    c._a2Stow = async (t, ie, l) => ruf.push(['zeigt', t, l]);
    await c._giftOpen();
    return ruf;
  };
  let ruf = await auspacken(1, 2);
  assert.ok(ruf.some((r) => r[0] === 'sagt' && r[1] === 'eine Laterne!'));
  assert.deepEqual(ruf.find((r) => r[0] === 'zeigt'), ['zeigt', 1, 1]);
  ruf = await auspacken(2, 0x202);
  assert.ok(ruf.some((r) => r[1] === 'neuer Trick: Laternenlauf!'));
  ruf = await auspacken(3, 0x20202);
  assert.ok(ruf.some((r) => r[1] === 'eine goldene Laterne!'));
  // Tagebuch
  const { W, T, c } = karte(0);
  const t0 = W.jetzt();
  let P = T.planApply(T.planBlank(t0), { t: 'gstart', k: sek(t0 - 864e5) }, t0);
  P = T.planApply(P, { t: 'gdbg', f: { n: 3, y: 2, u: 255, v: 0xffff, z: 10, o: 10, w: 0xfdfdfd } }, t0);
  const L = [{ t: t0 - 9e5, v: P }];
  const schenken = (t, gold) => {
    const a = L.at(-1).v;
    const b = T.planApply(T.planApply(a, { t: 'gdbg', f: gold ? { y: 1 } : { n: 1 } }, t), { t: 'give', z: a.gift.z + 1, i: 33 + (gold ? 16 : 0), gold, x: sek(t), r: 1 }, t);
    L.push({ t, v: b }, { t: t + 30000, v: T.planApply(b, { t: 'gopen', z: b.gift.z }, t + 30000) });
  };
  schenken(t0 - 8e5, false);
  schenken(t0 - 7e5, false);
  schenken(t0 - 6e5, true);
  const R = T.diaryDerive([], L, t0 - 1e6, { decayAt: () => Infinity, until: t0 });
  const pk = plain(R.ev.filter((e) => e.k === 'parcel'));
  assert.deepEqual(pk.map((e) => [e.it, e.alb, e.what]), [[1, 2, 'new'], [1, 2, 'trick'], [1, 2, 'gilt']]);
  assert.match(c._diaryParcel(pk[0], t0), /Drin war eine Laterne!$/);
  assert.match(c._diaryParcel(pk[1], t0), /neuen Trick: Laternenlauf!$/);
  assert.match(c._diaryParcel(pk[2], t0), /Jetzt hab ich eine goldene Laterne\.$/);
});

test('Laterne: Größe oder Areal geändert – am Bau rückt sie an den neuen Platz, sonst bleibt sie im Bild; ohne Tiefe vorn; Abhängen beim Tragen nimmt die Klassen', () => {
  const { c } = karte(1, ['night']);
  c._a2LanternSet(c._a2LanternSpot());
  // Bau und Heu rücken (anderes Areal, andere Höhe der Karte)
  c._g = { ...c._g, hole: { ...c._g.hole, l: 50, r: 90 }, hayL: 160 };
  c._a2Scene();
  assert.equal(c._a2LanternStand.x, c._a2LanternSpot().x);
  // mitten auf der Wiese abgestellt, die Karte wird schmaler: nicht außerhalb
  const { c: m } = karte(1, ['night']);
  m._a2LanternSet({ x: 530, foot: 0.075 });
  m._g = { ...m._g, xR: 300 };
  m._cfg = { ...m._cfg, depth: false };
  m._a2Scene();
  assert.ok(m._a2LanternStand.x <= 300 + m._g.pW * 0.25);
  assert.equal(m._a2LanternStand.foot, 0);
  // abgehängt, während er sie trägt (die Aktion läuft noch, _cleanup hat sie übergangen)
  const { c: d } = karte(2, ['night']);
  d._a2LanternHold(true);
  d._el.pika.classList.add('a2lsw');
  d._a2LanternDetach();
  assert.ok(!['a2lc', 'a2lsw', 'a2lbig'].some((k) => d._el.pika.classList.contains(k)));
});

// 0.48.1: Im Abendritual (nach der Mütze, Hook Bed über _a2Bed) pustet er die Laterne aus, die noch am Bau brennt: hin,
// zu ihr drehen, „pff…“, Flamme schrumpft, Rauchfaden, aus. Abgebrochen (Füttern, Streicheln) brennt sie weiter.
test('Laterne im Abendritual: hingehen, „pff…“, Flamme schrumpft, Rauchfaden, aus; abgebrochen brennt sie weiter', async () => {
  const quell = fs.readFileSync(new URL('../src/karte/momente.js', import.meta.url), 'utf8');
  const r = quell.indexOf("p.classList.add('rcap')");
  assert.ok(r > 0 && quell.indexOf('await this._a2Bed()', r) > r, 'das Ritual ruft den Hook nach der Mütze');
  const { c, ruf } = karte(1);
  c._a2LanternSet(c._a2LanternSpot());
  c._a2Scene();
  const S = c._a2LanternStand;
  const el = c._a2Els.get('lantern');
  assert.ok(S && el);
  c._x = 420;
  let mitten = null;
  c._wait = async () => {
    const sm = c._el.fx.kinder.find((k) => k.cls.has('a2lsmoke') && !k.weg);
    if (sm && !mitten) mitten = { puff: el.cls.has('a2lpuff'), blow: c._a2LanternBlow, tap: c._a2LanternTap({ el }), off: glow(c)?.cls.has('off'), x: c._x, dir: c._dir };
  };
  S.until = Date.now() - 1; // (abgelaufen: Die Szene löscht sie nicht unter ihm)
  c._a2Scene();
  assert.equal(c._a2LanternStand, S, 'während er pustet, bleibt sie');
  await c._a2Bed();
  assert.ok(ruf.some((x) => x[0] === 'sagt' && x[1] === 'pff…'));
  assert.ok(Math.abs(c._x - S.x) < c._g.pW * 0.85, 'hingegangen: ' + c._x);
  assert.ok(mitten, 'Rauchfaden');
  assert.deepEqual(plain(mitten), { puff: true, blow: true, tap: false, off: true, x: c._x, dir: S.x >= c._x ? 1 : -1 });
  assert.equal(c._a2LanternStand, null, 'aus');
  assert.ok(el.cls.has('a2out'));
  assert.equal(c._a2LanternBlow, false);
  assert.ok(c._el.fx.kinder.filter((k) => k.cls.has('a2lsmoke')).every((k) => k.weg), 'Rauch weg');
  // nichts zu tun ohne brennende Laterne
  const n = ruf.length;
  await c._a2Bed();
  assert.equal(ruf.length, n);
  // abgebrochen (beim zweiten Warten): Sie brennt weiter, nichts bleibt hängen
  const { c: b } = karte(1);
  b._a2LanternSet(b._a2LanternSpot());
  b._a2Scene();
  const el2 = b._a2Els.get('lantern');
  let k = 0;
  b._wait = async () => {
    if (++k >= 2) {
      b._ac = { signal: { aborted: true } };
      throw new Error('abgebrochen');
    }
  };
  await assert.rejects(b._a2Bed(), /abgebrochen/);
  assert.ok(b._a2LanternStand, 'brennt weiter');
  assert.ok(!el2.cls.has('a2lpuff') && !el2.cls.has('a2out'));
  assert.ok(!glow(b)?.cls.has('off'));
  assert.equal(b._a2LanternBlow, false);
  // ein anderer Fehler im Hook bleibt bei der Laterne, das Ritual geht weiter
  const { c: e } = karte(1);
  const err = [];
  e._err = (wo) => err.push(wo);
  e._a2LanternSet(e._a2LanternSpot());
  e._a2Scene();
  e._walkTo = async () => {
    throw new Error('kaputt');
  };
  e._x = 500;
  await e._a2Bed();
  assert.deepEqual(err, ['Album 2 lantern']);
});

// 0.48.1: Glühwürmchen der Laterne anderthalbmal so groß wie die der Hängematte (eigener Stil, GOLD_FIREFLY bleibt)
test('Laterne: Glühwürmchen anderthalbmal so groß wie .gfx.hff', () => {
  const st = fs.readFileSync(new URL('../src/stil/album2-lantern.js', import.meta.url), 'utf8');
  const pk = fs.readFileSync(new URL('../src/stil/paeckchen.js', import.meta.url), 'utf8');
  const w = (s, sel) => Number(s.match(new RegExp(sel.replace(/\./g, '\\.') + ' \\{ width: calc\\(var\\(--H\\) \\* ([.\\d]+)\\)'))[1]);
  assert.ok(Math.abs(w(st, '.gfx.hff.a2lff') / w(pk, '.gfx.hff') - 1.5) < 0.01);
});

// 0.49.0: Beim Abhängen räumt eine andere Aktion (Schlitten, Vogelhäuschen) noch die Szene auf, während die Karte schon
// nicht mehr im DOM hängt: Der Schein der stehenden Laterne gilt dann als verloren und wird neu angelegt. Der alte darf
// nicht in .fx liegen bleiben (er leuchtete dort für immer, bei jedem Mal einer mehr)
test('Laterne: Szene nach dem Abhängen legt keinen zweiten Schein an, der liegen bleibt', () => {
  const { c } = karte(1);
  c._a2LanternSet(c._a2LanternSpot());
  const alle = () => c._el.fx.kinder.filter((k) => k.cls.has('a2lglow') && !k.weg);
  assert.equal(alle().length, 1);
  alle()[0].isConnected = false; // (die Karte hängt nicht mehr im DOM, das Element liegt aber noch in .fx)
  c._a2Scene(); // (Aufräumen einer anderen Aktion)
  assert.equal(alle().length, 1, 'nur ein Schein');
  assert.equal(alle()[0], c._a2LanternGlow);
  c._a2LanternDetach();
  assert.equal(alle().length, 0, 'nach dem Abhängen keiner');
});
