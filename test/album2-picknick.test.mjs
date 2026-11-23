// Album 2: die Picknickdecke (Schatz t2 = 6) – Daten, Picknickwetter, Platz auf der Wiese, Picknick, Teilen (Freund,
// Besucher, für später), Schmetterlinge, Tipp, Auspacken (auch außerhalb der Jahreszeit), Abbruch. Ohne echte Szene:
// Elemente sind Attrappen. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { welt } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const JULI = new Date(2026, 6, 15, 13).getTime();
const NOVEMBER = new Date(2026, 10, 22, 13).getTime();

// Ein Element, soweit Decke, Korb, Schmetterlinge und Krümel es anfassen
class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.cls = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => this.cls.add(x)), remove: (...k) => k.forEach((x) => this.cls.delete(x)),
      contains: (k) => this.cls.has(k), toggle: (k, on) => ((on ?? !this.cls.has(k)) ? this.cls.add(k) : this.cls.delete(k)),
    };
    this.style = { setProperty() {} };
    this.kinder = [];
    this.weg = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.offsetWidth = 10;
    this.unter = null;
    this.anim = 0;
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
    this.kinder.push(k);
    return k;
  }

  remove() {
    this.weg = true;
    this.isConnected = false;
  }

  animate() {
    this.anim++;
    return { cancel() {}, finish() {} };
  }

  getBoundingClientRect() {
    return { left: 300, top: 180, right: 520, bottom: 230, width: 220, height: 50 };
  }
}

// Eine Karte ohne Szene (600 × 248 wie die Vorschau), Album 1 voll mit Trick, die Picknickdecke auf Stufe lv, Juli,
// Sonne, 22 °C. ruf: was sie tut
const karte = (lv = 1, extra = {}) => {
  const W = welt({ start: JULI });
  W.dok.createElement = (t) => new El(t);
  const { T } = W;
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 1 << 6 : 0) | (lv >= 2 ? 1 << 14 : 0) | (lv >= 3 ? 1 << 22 : 0);
  const leer = () => {};
  Object.assign(c, {
    _cfg: { gifts: true }, _W: 600, _H: 248, _x: 200, _dir: 1, _wx: {}, _wind: 0, _dbgDate: JULI, _wxRaw: { cond: 'sunny', temp: 22 },
    _g: { gy: 223, pW: 119, pH: 99, hayR: 223, xR: 546, home: 96, fMin: 0.43, fMax: 0.72, rock: { l: 440, w: 150, ku: 1.5, cx: 515 }, hole: { l: 70, r: 121, cx: 96, top: 150 } },
    _el: { pika: new El(), fx: new El(), gifts: new El(), birds: new El(), scene: new El(), mfood: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 32 } },
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _walkTo: async (x) => ((c._x = x), ruf.push(['geht', Math.round(x)])), _face: (d) => (c._dir = d),
    _enterBurrow: async () => ruf.push(['bau rein']), _comeOut: async () => ruf.push(['bau raus']),
    _eat: async (col, ms, svg) => ruf.push(['isst', col, !!svg]), _mouth: (col, svg) => ruf.push(['maul', col, svg ? svg.slice(0, 40) : null, svg]),
    _nosePos: () => ({ x: c._x + 30, y: 180 }), _frRange: () => [190, 554], _poops: () => ({ piles: [] }), _sparkle: leer, _cls: leer, _mimik: leer, _happy: () => ruf.push(['freut']),
    _hearts: leer, _jump: leer, _emote: leer, _peep: (x, y, t) => ruf.push(['piep', t]), _tweet: () => ruf.push(['zwitschert']), _found: (k) => ruf.push(['entdeckt', k]),
    _keyTap: leer, _away: () => false, _urlaubFern: () => false, _interrupt: () => ruf.push(['abbruch']),
    _frName: () => 'Pino', _frCall: leer, _frFace: leer, _frLook: leer, _frHappy: leer, _frHearts: leer, _frSay: (fr, t) => ruf.push(['freund sagt', t]),
    _frEat: (fr, col) => ruf.push(['freund isst', col]), _frEatEnd: leer, _frCarry: (fr, svg) => ruf.push(['freund maul', svg ? svg.slice(0, 40) : null]),
    _friendWalkTo: async (fr, x) => ((fr.x = x), ruf.push(['freund geht', Math.round(x)])),
    _planOp: (op) => ruf.push(['op', op.t]), _giftFromPlan: () => ruf.push(['plan']), _giftFeier: async (was) => ruf.push(['feier', was]),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  return { W, T, c, ruf };
};

// Ein Freund, der mit auf die Decke kann; _withFriend vereinfacht nach src/karte/pino.js, ohne Szene. geht: beim
// so-vielten Warten (w) muss er gehen, w wirft dann wie dort Cancel (Klasse in c._CancelT)
const mitFreund = (c, ruf, geht = null) => {
  const fr = { kind: 'kirby', x: 420, arrived: true, greeted: true, leaving: false, busy: false, until: Date.now() + 6e5, el: new El(), mfood: new El() };
  c._fr = fr;
  let n = 0;
  c._withFriend = async (fn) => {
    fr.busy = true;
    try {
      await fn(fr, async () => {
        if (geht != null && ++n >= geht) {
          fr.leaving = true;
          throw new c._CancelT();
        }
      });
    } finally {
      fr.busy = false;
      ruf.push(['freund frei']);
    }
  };
  return fr;
};

test('Picknickdecke: Daten wie die übrigen Schätze (24 × 24, ohne id und class), gebaut, April bis September', () => {
  const { c } = karte();
  const it = c._a2Item('picnic');
  assert.equal(c._a2Item(6), it);
  assert.equal(it.built, true);
  assert.deepEqual(plain(it.mo), [3, 4, 5, 6, 7, 8]);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.ok(it.find?.t && it.find?.h);
  assert.ok(it.dbg.length >= 3);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // Was er im Maul trägt (Bündel, Leckerli), ist wie die Leckerli: 24 × 24, ohne id und class (sonst griffe der Stil
  // des Pikas)
  const { c: k, ruf } = karte();
  k._a2PicnicCarry(true);
  k._a2PicnicHold(k._a2PicnicTreat());
  const svgs = ruf.filter((r) => r[0] === 'maul').map((r) => r[3]);
  assert.equal(svgs.length, 2);
  for (const s of svgs) {
    assert.match(s, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
    assert.doesNotMatch(s, /\sid=|\sclass=|NaN|undefined/);
  }
  // Leckerli der Jahreszeit: Juli Himbeeren, Mai Erdbeere, Oktober Apfelschnitz, Südhalbkugel versetzt
  assert.equal(k._a2PicnicTreat().key, 'rasp');
  k._dbgDate = new Date(2026, 4, 10).getTime();
  assert.equal(k._a2PicnicTreat().key, 'straw');
  k._dbgDate = new Date(2026, 9, 10).getTime();
  assert.equal(k._a2PicnicTreat().key, 'apple');
  k._hass = { config: { latitude: -34 } };
  k._dbgDate = new Date(2026, 0, 10).getTime();
  assert.equal(k._a2PicnicTreat().key, 'rasp');
});

test('Picknickdecke: Picknickwetter – sonnig oder heiter, trocken, ab 15 °C, bei Tag, Wind unter 30; Teilen ab Stufe 2', () => {
  const { c } = karte(1);
  const acts = (raw, wx = {}, cls = [], wind = 0) => {
    c._wxRaw = raw;
    c._wind = wind;
    c._el.scene.cls = new Set(cls);
    return plain(c._a2PicnicActs({ wx }, c._a2Lv('picnic')));
  };
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }), [[0.3, 'a2PicnicPlay'], [0, 'a2PicnicShare']]);
  assert.equal(acts({ cond: 'partlycloudy', temp: 15 }).length, 2);
  assert.deepEqual(acts({ cond: 'cloudy', temp: 22 }), []);
  assert.deepEqual(acts({ cond: 'sunny', temp: 14.5 }), []);
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }, { wet: true }), []);
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }, { snowcover: true }), []);
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }, {}, ['dusk']), []);
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }, {}, ['night']), []);
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }, {}, [], 30), []);
  assert.equal(acts({ cond: 'sunny', temp: 22 }, {}, [], 29).length, 2);
  // liegt ein Häufchen, kein Picknick (die Decke läge darunter)
  c._wxRaw = { cond: 'sunny', temp: 22 };
  c._wind = 0;
  c._el.scene.cls = new Set();
  assert.deepEqual(plain(c._a2PicnicActs({ wx: {}, piles: [{ k: 1, slot: 0 }] }, 1)), []);
  assert.equal(plain(c._a2PicnicActs({ wx: {}, piles: [] }, 1)).length, 2);
  // ohne Wetterlage und Temperatur entscheidet die Jahreszeit (Juli ja, November nein; Südhalbkugel umgekehrt)
  assert.equal(acts({}).length, 2);
  c._dbgDate = NOVEMBER;
  assert.deepEqual(acts({}), []);
  c._hass = { config: { latitude: -34 } };
  assert.equal(acts({}).length, 2);
  c._hass = null;
  // … und die Vorschau (_dbgWeather) geht vor
  c._dbgDate = JULI;
  c._dbgWeather = { cond: 'rainy' };
  assert.deepEqual(acts({ cond: 'sunny', temp: 22 }), []);
  c._dbgWeather = null;
  // Stufe 2: Teilen; mit dem Freund öfter, mit einem Besucher manchmal
  const { c: c2, ruf: r2, W: W2 } = karte(2);
  assert.ok(c2._a2PicnicActs({ wx: {} }, 2)[1][0] > 0);
  c2._bird = { sitting: true, x: 150, y: 120 };
  const vogel = c2._a2PicnicActs({ wx: {} }, 2)[1][0];
  c2._bird = null;
  mitFreund(c2, r2);
  const [[pf], [sf]] = c2._a2PicnicActs({ wx: {} }, 2);
  assert.ok(sf > vogel && vogel > 0.15 && pf > 0.3, `${sf} ${vogel} ${pf}`);
  // Ein Freund, dessen Besuch gleich endet, kommt nicht mit
  c2._fr.until = W2.jetzt() + 30000;
  assert.equal(c2._a2PicnicFriend(), null);
  // über die Schnittstelle: nur mit Album 2, ohne Ballon, nicht verreist
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2PicnicPlay']);
  c._gb = { z: 5 };
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
});

test('Picknickdecke: Platz auf der Wiese – rechts vom Heu, vor dem Stein, er und der Freund in ihrem Bereich, auch auf 380 px', () => {
  const { c } = karte(1);
  const pruefe = (P, fr, ziel = '') => {
    const { pW, hayR, xR } = c._g;
    assert.ok(P.bx - P.bw / 2 >= hayR - pW * 0.08 - 0.01, `${ziel} links: ${P.bx - P.bw / 2}`);
    assert.ok(P.bx + P.bw / 2 <= c._W - 2, `${ziel} rechts`);
    assert.ok(P.px >= pW * 0.45 - 0.01 && P.px <= xR + 0.01, `${ziel} er`);
    // der Korb vor ihm, auf der Decke
    assert.ok(P.d * (P.kx - P.px) > pW * 0.3, `${ziel} Korb vor ihm`);
    assert.ok(Math.abs(P.kx - P.bx) < P.bw / 2, `${ziel} Korb auf der Decke`);
    if (fr) {
      const [lo, hi] = c._frRange();
      assert.ok(P.fx >= lo - 0.01 && P.fx <= hi + 0.01, `${ziel} Freund`);
      assert.ok(P.d * (P.fx - P.kx) > 0, `${ziel} Freund gegenüber`);
    }
  };
  for (let i = 0; i < 20; i++) {
    const P = c._a2PicnicPlan(null);
    pruefe(P, false, 'allein');
    // breite Karte: vor dem Stein zu Ende
    assert.ok(P.bx + P.bw / 2 <= 440 + 150 * 0.12 + 0.01);
  }
  const fr = { x: 420 };
  const P = c._a2PicnicPlan(fr);
  pruefe(P, true, 'zu zweit');
  assert.ok(P.bw > c._a2PicnicPlan(null).bw);
  // schmale Karte (380 × 184 wie die Vorschau rechts)
  Object.assign(c, { _W: 380, _H: 184, _x: 100 });
  c._g = { gy: 165.6, pW: 88.3, pH: 73.6, hayR: 165.2, xR: 340.3, home: 71, rock: { l: 270, w: 110, ku: 1.1, cx: 325 }, hole: { l: 52, r: 90, cx: 71, top: 110 } };
  c._frRange = () => [141.6, 346.2];
  pruefe(c._a2PicnicPlan(null), false, 'schmal allein');
  pruefe(c._a2PicnicPlan({ x: 300 }), true, 'schmal zu zweit');
  // noch schmaler passt die Decke für zwei nicht: kein Plan (er macht dann allein Picknick)
  c._W = 300;
  c._g.xR = 270;
  assert.equal(c._a2PicnicPlan({ x: 250 }), null);
  assert.ok(c._a2PicnicFallback().bw > 0);
});

test('Picknickdecke, Stufe 1: holen, ausbreiten, sitzen, knabbern, in die Sonne schauen, aufrollen, zurück in den Bau', async () => {
  const { c, ruf } = karte(1);
  const vorher = plain(c._plan);
  await c._a2PicnicPlay();
  const was = ruf.map((r) => r[0]);
  assert.ok(was.indexOf('bau rein') < was.indexOf('bau raus'));
  // das Bündel im Maul auf dem Weg, dann wieder
  const maul = ruf.filter((r) => r[0] === 'maul');
  assert.ok(maul.length >= 4);
  assert.equal(maul[0][1], '#c98e4e');
  // geknabbert wird Löwenzahn oder Klee (als Blüte, kein Leckerli)
  const isst = ruf.filter((r) => r[0] === 'isst');
  assert.equal(isst.length, 1);
  assert.ok(['#f7cf2e', '#e57fb0'].includes(isst[0][1]) && !isst[0][2]);
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /Sonne|warm/.test(r[1])));
  // die Decke lag in der Szene (Element aus _a2El), jetzt ist sie weg; keine Schmetterlinge auf Stufe 1
  const el = c._el.gifts.kinder.find((k) => k.cls.has('a2-picnic'));
  assert.ok(el && el.cls.has('gt'));
  assert.equal(c._a2PicnicS, null);
  assert.equal(c._a2Els.has('picnic'), false);
  assert.equal(c._el.fx.kinder.filter((k) => k.cls.has('a2pkb')).length, 0);
  assert.equal(c._a2PicnicBusy, false);
  assert.ok(!c._el.pika.cls.has('a2pk-sit') && !c._el.pika.cls.has('carry'));
  // nichts in Plan oder Zustand
  assert.deepEqual(plain(c._plan), vorher);
  assert.ok(!was.includes('op'));
  assert.equal(c._errs, undefined);
  // ohne Picknickwetter nichts (außer aus der Vorschau, _forced)
  const { c: n, ruf: rn } = karte(1, { _wxRaw: { cond: 'rainy', temp: 12 } });
  await n._a2PicnicPlay();
  assert.deepEqual(rn, []);
  n._forced = true;
  await n._a2PicnicPlay();
  assert.ok(rn.some((r) => r[0] === 'isst'));
  // Stufe 0: nichts
  const { c: z, ruf: rz } = karte(0);
  await z._a2PicnicPlay();
  assert.deepEqual(rz, []);
});

test('Picknickdecke: der Freund setzt sich dazu und knabbert mit; muss er gehen, räumt er allein auf', async () => {
  const { c, ruf } = karte(1);
  mitFreund(c, ruf);
  await c._a2PicnicPlay();
  const geht = ruf.filter((r) => r[0] === 'freund geht');
  assert.ok(geht.length >= 2, 'auf die Decke und wieder herunter');
  assert.ok(ruf.some((r) => r[0] === 'freund isst'));
  assert.ok(ruf.some((r) => r[0] === 'freund frei'));
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /Kirby/.test(r[1])));
  assert.ok(ruf.some((r) => r[0] === 'bau raus'));
  // Er muss mitten im Picknick gehen: kein Abbruch, er verabschiedet sich und räumt auf
  const { c: k, ruf: rk } = karte(1);
  k._CancelT = cancelKlasse(k); // (die Klasse, die w wirft, wenn der Freund geht)
  mitFreund(k, rk, 3);
  await k._a2PicnicPlay();
  assert.ok(rk.some((r) => r[0] === 'sagt' && /tschüss|schade|bis bald/.test(r[1])));
  assert.ok(rk.some((r) => r[0] === 'bau raus'));
  assert.equal(k._a2PicnicS, null);
});

// Die Klasse Cancel des Bündels: _wait einer Karte mit abgebrochenem Signal wirft sie
function cancelKlasse(c) {
  const p = Object.getPrototypeOf(c);
  let K = null;
  const t = { _ac: { signal: { aborted: true, addEventListener() {} } } };
  p._wait.call(t, 1).catch((e) => (K = e.constructor));
  return new Proxy(function () {}, { construct: () => new (K || Error)() });
}

test('Picknickdecke, Stufe 2 (Teilen): mit dem Freund, sonst mit dem Vogel oder der Maus, sonst eins für später', async () => {
  // Freund: Er bekommt das Leckerli ins Maul, „und eins für mich“
  const { c, ruf } = karte(2);
  mitFreund(c, ruf);
  const vorher = plain(c._plan);
  await c._a2PicnicShare();
  assert.ok(ruf.some((r) => r[0] === 'freund maul' && r[1]?.startsWith('<svg viewBox="0 0 24 24"')));
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /für dich|halbe/.test(r[1])));
  assert.ok(ruf.some((r) => r[0] === 'isst' && r[2]), 'er isst eins (Leckerli-Bild)');
  assert.deepEqual(plain(c._plan), vorher);
  // Vogel: ein Stück fliegt hinüber, der Vogel zwitschert
  const { c: v, ruf: rv } = karte(2);
  v._bird = { sitting: true, x: 120, y: 110 };
  await v._a2PicnicShare();
  assert.equal(v._el.fx.kinder.filter((k) => k.cls.has('a2pkf')).length, 1);
  assert.ok(rv.some((r) => r[0] === 'zwitschert'));
  // Maus (schaut heraus): auch, und nie vor die eigenen Pfoten
  const { c: m } = karte(2);
  m._mouse = { visible: true, x: 240, y: 218 };
  m._x = 250;
  m._a2PicnicBusy = true; // (Decke hinlegen nur aus der Aktion: sonst räumt die Szene sie gleich ab)
  const S = m._a2PicnicMake(m._a2PicnicPlan(null), 'fade');
  m._a2PicnicToss(S, m._a2PicnicTreat(), m._a2PicnicGuest());
  const f = m._el.fx.kinder.find((k) => k.cls.has('a2pkf'));
  const fx = parseFloat(f.style.left) + parseFloat(f.style.width) / 2;
  assert.ok(Math.abs(fx - 250) >= 119 * 0.55 - 0.1, `${fx}`);
  m._a2PicnicEnd(true, true);
  assert.equal(f.weg, true);
  // niemand da: eins für später neben den Korb, zum Schluss wieder eingepackt
  const { c: s, ruf: rs } = karte(2);
  await s._a2PicnicShare();
  const t = s._el.gifts.kinder.find((k) => k.cls.has('a2pkt'));
  assert.ok(t, 'liegt neben dem Korb');
  assert.ok(t.cls.has('away'));
  assert.ok(rs.some((r) => r[0] === 'piep' && r[1] === 'für später'));
  // auf Stufe 1 gibt es das Teilen nicht
  const { c: e, ruf: re } = karte(1);
  await e._a2PicnicShare();
  assert.deepEqual(re, []);
});

test('Picknickdecke, Stufe 3: Schmetterlinge auf den Ecken und dem Henkel (Abstand und Würfel wie GOLD)', async () => {
  const { c, ruf } = karte(3);
  c._dbgGold = true;
  await c._a2PicnicPlay();
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /Schmetterlinge|Besuch|bunt/.test(r[1])));
  // auf Stufe 2 nicht
  const { c: c2, ruf: r2 } = karte(2);
  c2._dbgGold = true;
  await c2._a2PicnicPlay();
  assert.ok(!r2.some((r) => r[0] === 'sagt' && /Schmetterlinge|Besuch|bunt/.test(r[1])));
  // (sie kommen nacheinander über Zeitgeber) direkt: drei Schmetterlinge in .fx, mit BFLY_SVG
  const { c: g } = karte(3);
  g._a2PicnicBusy = true;
  const S = g._a2PicnicMake(g._a2PicnicPlan(null), 'fade');
  for (let i = 0; i < 3; i++) g._a2PicnicBfly(S, 300 + i * 40, 210, ['#ffb347', '#e07b1a'], i);
  const B = g._el.fx.kinder.filter((k) => k.cls.has('a2pkb'));
  assert.equal(B.length, 3);
  assert.match(B[0].innerHTML, /class="bwl"/);
  g._a2PicnicBflyOff(S);
  assert.equal(S.bf.size, 0);
  // golden: .gilt am Element
  assert.ok(S.el.cls.has('gilt'));
  g._a2PicnicBusy = false;
  g._a2PicnicEnd(true, true);
  // ohne _dbgGold: höchstens alle 2 Minuten
  const { c: h } = karte(3);
  const R = { cd: 2 * 6e4, p: 1 };
  assert.equal(h._a2GoldOk('picnic', R), true);
  assert.equal(h._a2GoldOk('picnic', R), false);
  const { c: k } = karte(2);
  assert.equal(k._a2GoldOk('picnic'), false);
});

test('Picknickdecke: Tipp auf Decke oder Korb – Deckel hebt sich, Krümel; nur solange sie liegt; Entdeckung zählt', () => {
  const { c, ruf, T } = karte(1);
  const Z0 = [];
  c._a2Zones(Z0, { left: 0, top: 0 });
  assert.equal(Z0.length, 0, 'ohne Decke keine Zone');
  c._a2PicnicBusy = true;
  c._a2PicnicMake(c._a2PicnicPlan(null), 'fade');
  const Z = [];
  c._a2Zones(Z, { left: 0, top: 0 });
  assert.equal(Z.length, 1);
  assert.deepEqual([Z[0].k, Z[0].a2], ['picnic', true]);
  assert.equal(c._a2Tap(Z[0]), true);
  const el = c._a2Els.get('picnic');
  assert.ok(el.cls.has('open') && el.cls.has('a2tap'));
  assert.ok(c._el.fx.kinder.some((k) => k.cls.has('a2pkc')), 'Krümel');
  assert.ok(ruf.some((r) => r[0] === 'piep' && /krümel|knusper/.test(r[1])));
  // Das Bündel (vorzeigen) hüpft nur
  c._a2PicnicMake({ d: 1, x: 300 }, 'bundle');
  assert.ok(c._a2Els.get('picnic').cls.has('rolled'));
  assert.equal(c._a2PicnicTap(), true);
  c._a2PicnicBusy = false;
  c._a2PicnicEnd(true, true);
  assert.equal(c._a2PicnicTap(), false);
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('head,picnic')], ['head', 'picnic']);
});

test('Picknickdecke auspacken: in der Jahreszeit ein kurzes Picknick, sonst zeigt er das Bündel und vertröstet', async () => {
  // Juli, Sonne: kurzes Picknick ohne Weg in den Bau
  const { c, ruf } = karte(1);
  await c._a2PicnicStow(1);
  assert.ok(ruf.some((r) => r[0] === 'isst'));
  assert.ok(!ruf.some((r) => r[0] === 'bau rein'));
  // Stufe 2: Teilen
  const { c: c2, ruf: r2 } = karte(2);
  await c2._a2PicnicStow(2);
  assert.ok(r2.some((r) => r[0] === 'piep' && r[1] === 'für später'));
  // November: vertrösten auf den Sommer (das Bündel steht kurz neben ihm)
  const { c: w, ruf: rw } = karte(1, { _dbgDate: NOVEMBER });
  assert.equal(w._a2PicnicNotNow(), 'season');
  await w._a2PicnicStow(1);
  assert.ok(rw.some((r) => r[0] === 'sagt' && /im Sommer/.test(r[1])));
  assert.ok(!rw.some((r) => r[0] === 'isst'));
  assert.ok(w._el.gifts.kinder.some((k) => k.cls.has('rolled')));
  assert.equal(w._a2PicnicS, null);
  // Juli, aber kalt; Juli, aber Regen
  const { c: k, ruf: rk } = karte(3, { _wxRaw: { cond: 'sunny', temp: 9 } });
  await k._a2PicnicStow(3);
  assert.ok(rk.some((r) => r[1] === 'brr, noch zu kalt!'));
  // (im Juli nicht „im Sommer …“, sondern auf Wärme vertrösten)
  assert.ok(rk.some((r) => r[1] === 'wenn’s wärmer ist!'));
  assert.ok(!rk.some((r) => /im Sommer/.test(r[1] || '')));
  const { c: r, ruf: rr } = karte(1, { _wx: { wet: true } });
  assert.equal(r._a2PicnicNotNow(), 'later');
  await r._a2PicnicStow(1);
  assert.ok(rr.some((x) => x[1] === 'wenn die Sonne scheint!'));
  // über _giftOpen: was er sagt, dann verstaut
  const auspacken = async (lv, w2) => {
    const { c: a, ruf: ra } = karte(lv);
    a._plan = { gift: { u: 255, v: 255, w: w2, z: 7, o: 6, i: 38 } };
    a._gb = { z: 7, el: new El(), x: 300, gold: lv === 3, item: 6, alb: 2, stage: 'ground' };
    a._a2Stow = async (t, ie, l) => ra.push(['zeigt', t, l]);
    await a._giftOpen();
    return ra;
  };
  let ra = await auspacken(1, 1 << 6);
  assert.ok(ra.some((x) => x[1] === 'eine Picknickdecke!'));
  assert.deepEqual(ra.find((x) => x[0] === 'zeigt'), ['zeigt', 6, 1]);
  ra = await auspacken(2, (1 << 6) | (1 << 14));
  assert.ok(ra.some((x) => x[1] === 'neuer Trick: Teilen!'));
  ra = await auspacken(3, (1 << 6) | (1 << 14) | (1 << 22));
  assert.ok(ra.some((x) => x[1] === 'eine goldene Picknickdecke!'));
});

test('Picknickdecke: Abbruch, Aufräumen, andere Kartengröße, Karte aus dem DOM – nichts bleibt liegen', () => {
  const { c, ruf } = karte(2);
  c._a2PicnicBusy = true;
  const S = c._a2PicnicMake(c._a2PicnicPlan(null), 'roll');
  c._a2PicnicKeep(S, c._a2PicnicTreat());
  c._a2PicnicBfly(S, 300, 210, ['#ffb347', '#e07b1a'], 0);
  c._el.pika.cls.add('a2pk-sit');
  // mitten in der Aktion: Aufräumen und Szene lassen sie in Ruhe
  c._a2Cleanup();
  c._a2Scene();
  assert.equal(c._a2PicnicS, S);
  // andere Größe: abbrechen
  c._W = 500;
  c._a2Scene();
  assert.ok(ruf.some((r) => r[0] === 'abbruch'));
  // nach dem Abbruch räumt das Aufräumen gleich ab
  c._ac = { signal: { aborted: true } };
  c._a2Cleanup();
  assert.equal(c._a2PicnicS, null);
  assert.ok(!c._el.pika.cls.has('a2pk-sit'));
  assert.ok(S.treat.cls.has('away'));
  // Karte aus dem DOM: sofort alles weg
  const { c: d } = karte(1);
  d._a2PicnicBusy = true;
  const S2 = d._a2PicnicMake(d._a2PicnicPlan(null), 'fade');
  d._a2PicnicBfly(S2, 300, 210, ['#ffb347', '#e07b1a'], 0);
  d._a2PicnicCarry(true);
  d._a2Detach();
  assert.equal(d._a2PicnicS, null);
  assert.equal(d._a2PicnicBusy, false);
  assert.ok([...S2.fx].length === 1 && [...S2.fx][0].weg);
  assert.equal(S2.el.weg, true);
  assert.equal(d._a2Els.has('picnic'), false);
  assert.ok(!d._el.pika.cls.has('carry'));
});

test('Picknickdecke: Nur die Höhe der Karte ändert sich (pW, gy neu, Decke und Korb an alten Pixeln) – auch das bricht ab', () => {
  const { c, ruf } = karte(1);
  c._a2PicnicBusy = true;
  const S = c._a2PicnicMake(c._a2PicnicPlan(null), 'roll');
  c._a2Scene();
  assert.ok(!ruf.some((r) => r[0] === 'abbruch'), 'gleiche Größe: nichts');
  c._H = 300;
  c._a2Scene();
  assert.ok(ruf.some((r) => r[0] === 'abbruch'), 'andere Höhe: abbrechen');
  assert.equal(c._a2PicnicS, S);
});

// Ein Ding am Boden (wie das Windrad aus Album 1: _gtEls, in .gifts, ohne top) von l bis r
const amBoden = (c, l, r, t = 1) => {
  const el = { parentElement: c._el.gifts, offsetLeft: l, offsetWidth: r - l, style: {} };
  c._gtEls = new Map([...(c._gtEls || []), [t, el]]);
  return el;
};
const frei = (x, w, l, r, pad) => x + w / 2 <= l - pad + 0.01 || x - w / 2 >= r + pad - 0.01;

test('Picknickdecke: liegt nicht über dem, was schon am Boden steht (Windrad, Vogelhäuschen …; seit 0.48.1)', () => {
  const { c } = karte(1);
  // das Windrad dicht rechts vom Heu: Die Decke rückt nach rechts (notfalls bis vor den Stein)
  amBoden(c, 210, 250);
  const pad = c._H * 0.015;
  for (let k = 0; k < 20; k++) {
    const P = c._a2PicnicPlan(null);
    assert.ok(frei(P.bx, P.bw, 210, 250, pad), JSON.stringify(P));
  }
  // mit dem Freund: die Decke weicht aus, er sitzt trotzdem an ihr (fx aus der Decke)
  const P = c._a2PicnicPlan({ kind: 'pino', x: 330 });
  assert.ok(P && frei(P.bx, P.bw, 210, 250, pad), JSON.stringify(P));
  // ist nirgends Platz (die ganze Wiese belegt), liegt sie wie bisher
  amBoden(c, 0, 600, 2);
  assert.ok(c._a2PicnicPlan(null));
});

// 0.48.1: Schmetterlinge auf der Decke anderthalbmal so groß (Stil und Platz der Füße gleich gerechnet)
test('Picknickdecke: Schmetterlinge anderthalbmal so groß wie bis 0.48.0, Füße auf dem Punkt', () => {
  const st = fs.readFileSync(new URL('../src/stil/album2-picnic.js', import.meta.url), 'utf8');
  const w = Number(st.match(/\.a2pkb \{ position: absolute; width: calc\(var\(--H\) \* ([.\d]+)\)/)[1]);
  assert.ok(Math.abs(w / 0.075 - 1.5) < 0.02, String(w));
  const { c } = karte(3);
  const S = { fx: new Set(), bf: new Set(), t: [] };
  const e = c._a2PicnicBfly(S, 300, 200, ['#f00', '#0f0'], 0);
  assert.equal(e.style.left, (300 - c._H * w / 2).toFixed(1) + 'px');
});

// 0.48.1 (Nachtrag C): Passt die Decke weder neben das Windrad noch neben das Vogelhäuschen, liegt sie vor dem Häuschen
// (es steht hinten) und wird angeboten; nur vor dem Windrad nie
test('Picknickdecke: kein Platz zwischen Windrad und Vogelhäuschen – vor dem Häuschen, angeboten', () => {
  const { c } = karte(1);
  amBoden(c, 210, 250);
  const fe = { parentElement: c._el.gifts, offsetLeft: 430, offsetWidth: 30, style: {}, classList: { contains: () => false, toggle() {}, add() {}, remove() {} } };
  c._a2Els = new Map([['feeder', fe]]);
  c._a2FeederScene = () => {};
  const pad = c._H * 0.015;
  for (let k = 0; k < 10; k++) {
    const P = c._a2PicnicPlan(null);
    assert.ok(frei(P.bx, P.bw, 210, 250, pad), JSON.stringify(P));
  }
  c._el.scene.cls = new Set();
  assert.ok(c._a2PicnicActs({ wx: {}, piles: [] }, 1).length > 0);
});
