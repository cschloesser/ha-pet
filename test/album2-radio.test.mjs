// Album 2: das Radio (Schatz t2 = 4) – Daten, Wahl der Aktionen, Holen und Wegbringen, Tanz, Drehtanz, Gold mit
// Vögelchen, Tipp (Senderwechsel), Auspacken (auch bei Regen), Abbruch, reduzierte Bewegung. node --test
// Wie gold.test.mjs lädt die Datei das gebaute Bündel selbst (mit einem Schalter für „Bewegung reduzieren“: ruhe und
// Zeitgebern, die nur mit vor() laufen). Die Szene sind Attrappen, die mitschreiben, welche Klassen je gesetzt wurden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---------- die Welt der Karte ----------
let T = null;
const ruhe = { matches: false }; // prefers-reduced-motion: Die Karte liest es einmal beim Laden und behält das Objekt
let wecker = [];
const vor = () => {
  for (let i = 0; i < 1000 && wecker.length; i++) {
    const w = wecker.shift();
    if (!w.aus) w.fn();
  }
};

// Ein Element, soweit Szene, Noten, Vögelchen und Auspacken es anfassen; je: alle Klassen, die es je hatte
class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.cls = new Set();
    this.je = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => (this.cls.add(x), this.je.add(x))), remove: (...k) => k.forEach((x) => this.cls.delete(x)),
      contains: (k) => this.cls.has(k), toggle: (k, on) => ((on ?? !this.cls.has(k)) ? this.classList.add(k) : this.cls.delete(k)),
    };
    const st = {};
    this.style = Object.assign(st, { setProperty: (k, v) => (st[k] = v), removeProperty: (k) => delete st[k] });
    this.dataset = {};
    this.kinder = [];
    this.weg = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.parentElement = null;
    this.offsetLeft = 0;
    this.offsetWidth = 10;
    this.hoerer = {};
    this.unter = null;
    this.anim = [];
  }

  set className(v) {
    this.cls = new Set(String(v).split(/\s+/).filter(Boolean));
    for (const k of this.cls) this.je.add(k);
  }

  get className() {
    return [...this.cls].join(' ');
  }

  querySelector() {
    this.unter ??= new El();
    return this.unter;
  }

  addEventListener(k, f) {
    this.hoerer[k] = f;
  }

  appendChild(k) {
    this.kinder.push(k);
    k.parentElement = this;
    return k;
  }

  remove() {
    this.weg = true;
    this.isConnected = false;
  }

  animate(kf, opt) {
    const a = { kf, opt, cancel() {}, finish() {} };
    this.anim.push(a);
    return a;
  }

  getBoundingClientRect() {
    return { left: 100, top: 50, right: 130, bottom: 110, width: 30, height: 60 };
  }

  getAnimations() {
    return [];
  }
}

vm.runInNewContext(src, {
  window: { matchMedia: () => ruhe, customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: (t) => new El(t) },
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug() {} },
  setTimeout: (fn) => {
    const w = { fn, aus: false };
    wecker.push(w);
    return w;
  },
  clearTimeout: (w) => {
    if (w && typeof w === 'object') w.aus = true;
  },
  setInterval: () => 0, clearInterval() {}, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });

// Eine Karte ohne Szene, mit Album 1 voll (Trick) und dem Radio auf Stufe lv (alle anderen aus Album 2 fehlen). ruf: was
// sie tut. abbruch: der n-te Aufruf von _wait bricht ab (wie Cancel)
const karte = (lv = 1, extra = {}, abbruch = 0) => {
  wecker = [];
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const t2 = T.A2_KEYS.indexOf('radio');
  const w = (lv >= 1 ? 1 << t2 : 0) | (lv >= 2 ? 1 << (8 + t2) : 0) | (lv >= 3 ? 1 << (16 + t2) : 0);
  const leer = () => {};
  let n = 0;
  Object.assign(c, {
    _cfg: { gifts: true, depth: true }, _W: 600, _H: 248, _x: 200, _dir: 1, _wx: {}, _wind: 0, _lane: 0,
    _g: { gy: 210, pW: 119, pH: 99, hayR: 160, xR: 546, home: 90, fMin: 0.4, fMax: 0.72, rock: { l: 440, w: 150, ku: 1.5, cx: 515 }, hole: { l: 60, r: 120, cx: 90, top: 150 } },
    _el: { pika: new El(), fx: new El(), gifts: new El(), birds: new El(), scene: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 32 + t2 } },
    _say: (t) => ruf.push(['sagt', t]),
    _wait: async () => {
      if (abbruch && ++n >= abbruch) throw new Error('abgebrochen');
    },
    _walkTo: async (x) => ruf.push(['geht', Math.round(x)]), _face: (d) => (c._dir = d),
    _enterBurrow: async () => ruf.push(['bau rein']), _comeOut: async () => ruf.push(['bau raus']),
    _mouth: (f, svg) => ruf.push(['maul', svg ? 'radio' : null]), _jump: (k) => ruf.push(['hüpft', k]),
    _sparkle: leer, _mimik: leer, _happy: () => ruf.push(['freut']), _peep: (x, y, t) => ruf.push(['piep', t]),
    _tweet: () => ruf.push(['zwitschert']), _found: (k) => ruf.push(['entdeckt', k]), _keyTap: leer, _away: () => false, _urlaubFern: () => false,
    _interrupt: () => ruf.push(['abbruch']), _poops: () => ({ piles: [] }),
    _planOp: (op) => ruf.push(['op', op.t, op.z]), _giftFromPlan: () => ruf.push(['plan']), _giftFeier: async (was) => ruf.push(['feier', was]),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  return { c, ruf };
};
const noten = (c) => c._el.fx.kinder.filter((k) => k.cls.has('a2rn'));

test('Radio: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, ganzjährig, Vorschau-Knöpfe gibt es', () => {
  const { c } = karte();
  const it = c._a2Item('radio');
  assert.equal(it, c._a2Item(4));
  assert.equal(it.built, true);
  assert.equal(it.mo, null);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.equal(it.trick, 'Drehtanz');
  assert.ok(it.find?.t && it.find?.h);
  assert.deepEqual(plain(it.dbg.map((d) => d[2])), [1, 2, 3]);
  for (const [label, act] of it.dbg) assert.equal(typeof c[`_${act}`], 'function', label);
  // Im Maul ohne Klassen und ids (sonst griffe das Stylesheet des Pikas), in der Szene mit
  const R = c._a2RadioMake(300);
  assert.match(R.el.innerHTML, /class="a2rant"/);
  let svg = null;
  c._mouth = (f, s) => (svg = s);
  c._a2RadioHold(true);
  assert.ok(c._el.pika.cls.has('carry'));
  assert.match(svg, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(svg, /\sid=|\sclass=|NaN|undefined/);
});

test('Radio: Er mag es ab und zu bei Tag und abends (dunkel seltener); nicht bei Regen, Schnee aus den Wolken, Sturm', () => {
  const { c } = karte(1);
  const acts = (wx = {}, cls = []) => {
    c._el.scene.cls = new Set(cls);
    return plain(c._a2RadioActs({ wx }, c._a2Lv('radio')));
  };
  assert.deepEqual(acts(), [[0.3, 'a2RadioPlay'], [0, 'a2RadioSpin']]);
  assert.deepEqual(acts({}, ['dusk']), [[0.3, 'a2RadioPlay'], [0, 'a2RadioSpin']]);
  assert.deepEqual(acts({}, ['night']), [[0.15, 'a2RadioPlay'], [0, 'a2RadioSpin']]);
  for (const wx of [{ wet: true }, { storm: true }, { shelter: true }, { hail: true }, { snow: 1 }]) assert.deepEqual(acts(wx), [], JSON.stringify(wx));
  // Schnee am Boden, Nebel, Wolken: geht
  assert.equal(acts({ snowcover: true, fog: true, cover: 90 }).length, 2);
  // Stufe 2: der Drehtanz kommt dazu
  const { c: c2 } = karte(2);
  c2._el.scene.cls = new Set();
  assert.ok(c2._a2RadioActs({ wx: {} }, 2)[1][0] > 0);
  // über die Schnittstelle: nur, wenn es da ist, nicht mit Ballon unterwegs
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2RadioPlay']);
  c._gb = { z: 5 };
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  const { c: c0 } = karte(0);
  assert.deepEqual(plain(c0._a2Acts({ wx: {} })).filter((a) => /Radio/.test(a[1])), []);
});

test('Radio, Stufe 1: holt es aus dem Bau, trägt es im Maul, stellt es ab, schaltet ein, tanzt, bringt es zurück', async () => {
  const { c, ruf } = karte(1);
  c._a2Scene();
  assert.equal(c._a2Els?.has('radio') ?? false, false, 'steht nicht dauerhaft');
  await c._a2RadioPlay();
  const was = ruf.map((r) => r[0] + (r[1] ? ` ${r[1]}` : ''));
  // Reihenfolge: in den Bau, mit dem Radio im Maul heraus, abstellen, … wieder ins Maul, in den Bau, ohne heraus
  const i = (s, from = 0) => was.indexOf(s, from);
  assert.ok(i('bau rein') >= 0 && i('maul radio') > i('bau rein') && i('bau raus') > i('maul radio'));
  const ab = i('maul', i('bau raus'));
  assert.ok(ab > 0, 'abgestellt');
  const zurueck = i('maul radio', ab);
  assert.ok(zurueck > ab && i('bau rein', zurueck) > zurueck && i('maul', i('bau rein', zurueck)) > 0);
  // Das Radio stand (Element aus _a2El, auf der vorderen Reihe), Antenne raus, Knopf, Rauschen, Musik
  const el = c._el.gifts.kinder.find((k) => k.cls.has('a2-radio') || k.je.has('a2-radio'));
  assert.ok(el, 'Radio stand in der Szene');
  for (const k of ['gt', 'ant', 'knob', 'a2rtune', 'on']) assert.ok(el.je.has(k), k);
  assert.ok(Number(el.style.zIndex) > 0);
  assert.ok(ruf.some((r) => r[0] === 'piep' && /krr|ksch/.test(r[1])), 'es rauscht');
  // Noten stiegen auf, bunt (nicht golden), und er hat getanzt: Wippen, Hüpfer, Mitsingen
  assert.ok(noten(c).length >= 4);
  assert.ok(!noten(c).some((k) => k.cls.has('gold')));
  assert.ok(noten(c).every((k) => /^#/.test(k.style.color)));
  const p = c._el.pika;
  assert.ok(p.je.has('a2r-bop') && p.je.has('sing') && !p.je.has('a2r-spin'));
  assert.ok(ruf.some((r) => r[0] === 'hüpft'));
  // Danach ist alles weg: kein Radio, keine Klassen, kein Vögelchen auf Stufe 1
  assert.equal(c._a2RadioS, null);
  assert.equal(c._a2Els.has('radio'), false);
  assert.equal(el.weg, true);
  assert.ok(!p.cls.has('a2r-bop') && !p.cls.has('carry'));
  assert.equal(c._a2RadioBusy, false);
  assert.equal(c._el.birds.kinder.length, 0);
  // Abstand beim Tanzen: Er verdeckt es nicht (mindestens 0,6 Pika-Breiten zwischen ihm und der Mitte des Radios)
  const { c: d } = karte(1);
  for (let k = 0; k < 20; k++) {
    const P = d._a2RadioSpot();
    assert.ok(Math.abs(P.px - P.x) >= d._g.pW * 0.6 - 0.5, JSON.stringify(P));
    assert.ok(P.x >= d._g.pW * 0.45 && P.x <= d._g.xR);
    assert.equal(P.dir, P.px >= P.x ? 1 : -1);
  }
  // schmale Karte (380 × 184)
  const { c: s } = karte(1, { _W: 380, _H: 184, _g: { gy: 160, pW: 88, pH: 74, hayR: 130, xR: 336, home: 70, rock: { l: 270, w: 110, ku: 1.1, cx: 325 }, hole: { l: 40, r: 95, cx: 68, top: 110 } } });
  const P = s._a2RadioSpot();
  assert.ok(Math.abs(P.px - P.x) >= s._g.pW * 0.6 - 0.5 && P.px + s._g.pW * 0.17 <= 380, JSON.stringify(P));
});

test('Radio, Stufe 2: Drehtanz mit Pirouetten, „Ta-da!“ und Verbeugung; auf Stufe 1 gibt es ihn nicht', async () => {
  const { c, ruf } = karte(2);
  await c._a2RadioSpin();
  const p = c._el.pika;
  assert.equal(c._a2Lv('radio'), 2);
  assert.ok(p.je.has('a2r-spin'), [...p.je].join(' '));
  assert.ok(p.je.has('bowing'));
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /Ta-?da|hui/i.test(r[1])));
  assert.ok(!p.cls.has('a2r-spin') && !p.cls.has('bowing'));
  const { c: c1, ruf: r1 } = karte(1);
  await c1._a2RadioSpin();
  assert.deepEqual(r1, []);
});

test('Radio, Stufe 3: goldene Noten, ein Vögelchen setzt sich auf den Henkel und wippt mit (mit Abstand und Würfel)', async () => {
  const { c, ruf } = karte(3, { _dbgGold: true });
  let vogel = null;
  const orig = c._a2RadioBird;
  c._a2RadioBird = function () {
    orig.call(this);
    vogel = this._a2RadioS?.bird;
  };
  await c._a2RadioPlay();
  assert.ok(noten(c).some((k) => k.cls.has('gold')), 'goldene Noten');
  assert.ok(vogel, 'Vögelchen kam');
  assert.ok(vogel.el.cls.has('a2rb') && vogel.el.je.has('bird'));
  assert.equal(c._el.birds.kinder[0], vogel.el);
  assert.ok(vogel.gone, 'flog am Ende weg');
  // Auf dem Henkel: Füße über dem Radio (oberhalb der Bodenlinie), nicht this._bird (Besuch bleibt unberührt)
  assert.ok(vogel.y < c._g.gy - 20);
  assert.equal(c._bird, undefined);
  // Golden zum Schluss: ein Schwarm goldener Noten (nacheinander, über Zeitgeber), gefächert
  const { c: s } = karte(3);
  const SS = s._a2RadioMake(300);
  SS.on = true;
  s._a2RadioGoldBurst();
  vor();
  const schwarm = noten(s);
  assert.equal(schwarm.length, 5);
  assert.ok(schwarm.every((k) => k.cls.has('gold')));
  assert.equal(new Set(schwarm.map((k) => k.style['--dx'])).size, 5);
  // Antippen des Vögelchens: Es fliegt weg (Entdeckung „Besuch“)
  const { c: c2, ruf: r2 } = karte(3);
  c2._a2RadioMake(300);
  c2._a2RadioS.on = true;
  c2._a2RadioBird();
  const b = c2._a2RadioS.bird;
  b.el.unter.hoerer.click({ stopPropagation() {} });
  assert.equal(b.gone, true);
  assert.deepEqual(r2.filter((r) => r[0] === 'entdeckt'), [['entdeckt', 'visitor']]);
  // ohne _dbgGold: höchstens alle 3 Minuten
  const { c: h } = karte(3);
  const R = { cd: 3 * 6e4, p: 1 };
  assert.equal(h._a2GoldOk('radio', R, 'radio-bird'), true);
  assert.equal(h._a2GoldOk('radio', R, 'radio-bird'), false);
  // nicht golden: keine goldenen Noten, kein Vögelchen
  const { c: n } = karte(2, { _dbgGold: true }); // (die Vorschau setzt _dbgGold nur für Gold-Knöpfe und lässt es stehen)
  await n._a2RadioPlay();
  assert.ok(!noten(n).some((k) => k.cls.has('gold')));
  assert.equal(n._el.birds.kinder.length, 0);
  assert.ok(!ruf.some((r) => r[0] === 'abbruch'));
});

test('Radio: Tipp, solange es steht: Rauschen, Zeiger springt, anderer Sender; Zone in der Welt, Entdeckung zählt', () => {
  const { c, ruf } = karte(1);
  assert.equal(c._a2RadioTap({}), false, 'ohne Radio keine Antwort');
  const S = c._a2RadioMake(300);
  S.on = true;
  S.dance = true;
  const Z = [];
  c._a2Zones(Z, { left: 0, top: 0 });
  assert.equal(Z.length, 1);
  assert.deepEqual([Z[0].k, Z[0].a2], ['radio', true]);
  assert.equal(c._a2Tap(Z[0]), true);
  assert.ok(S.el.cls.has('a2rtune'));
  assert.ok(ruf.some((r) => r[0] === 'piep'));
  vor();
  assert.equal(S.st, 1);
  assert.ok(!S.el.cls.has('a2rtune'));
  assert.notEqual(S.el.style['--a2rn'], '0px');
  assert.ok(c._el.pika.style['--a2rbt']);
  assert.ok(noten(c).length >= 1);
  assert.ok(ruf.some((r) => r[0] === 'sagt'));
  // dreimal: wieder der erste Sender
  c._a2RadioTap();
  vor();
  c._a2RadioTap();
  vor();
  assert.equal(S.st, 0);
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('head,radio')], ['head', 'radio']);
});

test('Radio auspacken: Stufe 1 tanzt gleich (ohne Bau), 2 Drehtanz, 3 golden mit Vögelchen; bei Regen nur kurz zeigen', async () => {
  const { c, ruf } = karte(1);
  await c._a2RadioStow(1);
  assert.ok(!ruf.some((r) => r[0] === 'bau rein'), 'kein Weg in den Bau');
  assert.ok(c._el.pika.je.has('a2r-bop'));
  assert.ok(c._el.gifts.kinder.some((k) => k.je.has('a2-radio')));
  assert.equal(c._a2RadioS, null);
  const { c: c2 } = karte(2);
  await c2._a2RadioStow(2);
  assert.ok(c2._el.pika.je.has('a2r-spin'));
  const { c: c3 } = karte(3);
  await c3._a2RadioStow(3);
  assert.ok(noten(c3).some((k) => k.cls.has('gold')));
  assert.equal(c3._el.birds.kinder.length, 1);
  // Regen: kein Tanz, nur Rauschen, eine Note, „bei Regen lieber nicht“; von sich aus wählt er es nicht
  const { c: r, ruf: rr } = karte(1, { _wx: { wet: true, rain: 2 } });
  await r._a2RadioPlay();
  assert.deepEqual(rr, []);
  await r._a2RadioStow(1);
  assert.ok(rr.some((x) => x[0] === 'sagt' && /Regen|nass/.test(x[1])));
  assert.ok(!r._el.pika.je.has('a2r-bop'));
  assert.equal(r._a2RadioS, null);
  // die Vorschau (_forced) darf auch bei Regen
  r._forced = true;
  await r._a2RadioPlay();
  assert.ok(r._el.pika.je.has('a2r-bop'));
  // über _giftOpen: was er sagt, dann der Hook
  const { c: g, ruf: rg } = karte(1);
  g._plan = { gift: { u: 255, v: 255, w: 1 << 4, z: 7, o: 6, i: 36 } };
  g._gb = { z: 7, el: new El(), x: 300, gold: false, item: 4, alb: 2, stage: 'ground' };
  g._a2Stow = async (t, ie, l) => rg.push(['zeigt', t, l]);
  await g._giftOpen();
  assert.ok(rg.some((x) => x[0] === 'sagt' && x[1] === 'ein Radio!'));
  assert.deepEqual(rg.find((x) => x[0] === 'zeigt'), ['zeigt', 4, 1]);
});

test('Radio: Abbruch an jeder Wartestelle räumt alles ab (Radio, Vögelchen, Klassen); Szene, Aufräumen, Abhängen', async () => {
  for (let k = 1; k < 40; k += 3) {
    const { c } = karte(3, { _dbgGold: true }, k);
    // (wie _wait mit Cancel: Abbruch heißt, das Signal ist abgebrochen)
    c._ac = { signal: { aborted: true } };
    await c._a2RadioPlay().catch(() => {});
    c._a2Cleanup();
    assert.equal(c._a2RadioS ?? null, null, `Stelle ${k}`);
    assert.equal(c._a2RadioBusy, false);
    // (es blendet aus, dann ist es weg)
    const el = c._a2Els?.get('radio');
    assert.ok(!el || el.cls.has('a2out'));
    vor();
    assert.equal(c._a2Els?.has('radio') ?? false, false);
    assert.ok(!c._el.pika.cls.has('a2r-bop') && !c._el.pika.cls.has('a2r-spin'));
    assert.ok(c._el.birds.kinder.every((b) => b.cls.has('flying') || b.weg || b.anim.length), 'Vögelchen fliegt weg');
  }
  // Aufräumen mitten in der eigenen Aktion (nicht abgebrochen): nichts, sie räumt selbst auf
  const { c } = karte(1);
  c._ac = { signal: { aborted: false } };
  const S = c._a2RadioMake(300);
  c._a2RadioBusy = true;
  c._a2Cleanup();
  assert.equal(c._a2RadioS, S);
  // Größe der Karte geändert, während es steht: abbrechen
  const { c: z, ruf: rz } = karte(1);
  z._a2RadioMake(300);
  z._a2RadioBusy = true;
  z._W = 500;
  z._a2Scene();
  assert.deepEqual(rz.filter((r) => r[0] === 'abbruch'), [['abbruch']]);
  // Karte aus dem DOM: Radio, Noten, Vögelchen sofort weg
  const { c: d } = karte(3);
  const D = d._a2RadioMake(300);
  D.on = true;
  d._a2RadioNote();
  d._a2RadioBird();
  const b = D.bird;
  d._a2Detach();
  assert.equal(d._a2RadioS, null);
  assert.equal(D.el.weg, true);
  assert.equal(b.el.weg, true);
  assert.ok(noten(d).every((n) => n.weg));
  assert.equal(d._a2RadioFx.size, 0);
});

test('Radio mit „Bewegung reduzieren“: kein Bau, kein Wippen, Hüpfen, Drehen; Noten blenden am Platz ein', async () => {
  ruhe.matches = true;
  try {
    const { c, ruf } = karte(2);
    await c._a2RadioPlay();
    await c._a2RadioSpin();
    const p = c._el.pika;
    assert.ok(!ruf.some((r) => r[0] === 'bau rein' || r[0] === 'hüpft'));
    assert.ok(!p.je.has('a2r-bop') && !p.je.has('a2r-spin') && !p.je.has('carry'));
    assert.ok(p.je.has('bowing'), 'Drehtanz: verbeugen');
    assert.ok(noten(c).length > 0 && noten(c).every((n) => n.cls.has('still')));
    const el = c._el.gifts.kinder.find((k) => k.je.has('a2-radio'));
    assert.ok(el.anim.some((a) => a.kf?.[0]?.opacity === 0), 'blendet ein');
    assert.ok(!(el.unter?.je.has('pop')));
    assert.equal(c._a2RadioS, null);
  } finally {
    ruhe.matches = false;
  }
});

test('Radio: Nur die Höhe der Karte ändert sich (die Größeneinheit H mit ihr), während es steht: abbrechen wie bei neuer Breite', () => {
  const { c, ruf } = karte(1);
  c._a2RadioMake(300);
  c._a2RadioBusy = true;
  c._H = 300;
  c._a2Scene();
  assert.deepEqual(ruf.filter((r) => r[0] === 'abbruch'), [['abbruch']]);
});

// Ein Ding am Boden (wie das Windrad aus Album 1: _gtEls, in .gifts, ohne top) von l bis r
const amBoden = (c, l, r, t = 1) => {
  const el = { parentElement: c._el.gifts, offsetLeft: l, offsetWidth: r - l, style: {} };
  c._gtEls = new Map([...(c._gtEls || []), [t, el]]);
  return el;
};
const frei = (x, w, l, r, pad) => x + w / 2 <= l - pad + 0.01 || x - w / 2 >= r + pad - 0.01;

test('Radio: steht nicht vor dem, was schon am Boden steht (Windrad, Vogelhäuschen, Laterne …; seit 0.48.1)', () => {
  for (const geo of [{}, { _W: 380, _H: 184, _g: { gy: 160, pW: 88, pH: 74, hayR: 130, xR: 336, home: 70, rock: { l: 270, w: 110, ku: 1.1, cx: 325 }, hole: { l: 40, r: 95, cx: 68, top: 110 } } }]) {
    const { c } = karte(1, geo);
    const { pW, hayR, rock } = c._g;
    const B = [[hayR - 5, hayR + 25], [rock.l - 10, rock.l + 20]];
    B.forEach(([l, r], i) => amBoden(c, l, r, i + 1));
    const pad = c._H * 0.015;
    const { w } = c._a2RadioDim();
    for (let k = 0; k < 30; k++) {
      const P = c._a2RadioSpot();
      const msg = JSON.stringify([c._W, P]);
      for (const [l, r] of B) assert.ok(frei(P.px, w, l, r, pad), msg);
      assert.ok(Math.abs(P.px - P.x) >= pW * 0.6 - 0.5, msg);
      assert.ok(P.x >= pW * 0.45 - 0.01 && P.x <= c._g.xR + 0.01, msg);
    }
    c._x = hayR + pW * 0.2;
    const px = c._a2RadioBeside();
    for (const [l, r] of B) assert.ok(frei(px, w, l, r, pad), JSON.stringify([c._W, px]));
  }
});

// 0.48.1: Der Freund sitzt nicht auf dem Radio (_a2FrAside): Steht er unbeschäftigt dort, hoppelt er beiseite, und bis
// zum Ende der Aktion endet keiner seiner Wege dort (_frKeepX); beschäftigt (Spiel, Herein- oder Hinaushoppeln) bietet
// er das Radio gar nicht erst an.
test('Radio: Der Freund geht beiseite, bevor es steht, und bleibt draußen; ist er beschäftigt, kein Radio', async () => {
  const { c, ruf } = karte(1, { _frRange: () => [150, 560] });
  const fr = { kind: 'pino', x: 352, lane: 0, lift: 0, arrived: true, greeted: true, leaving: false, busy: false };
  c._fr = fr;
  c._a2RadioSpot = () => ({ px: 350, x: 267, dir: 1 });
  c._frTake = (f) => {
    ruf.push(['freund beiseite']);
    f.x = c._frKeepX(f.x, ...c._frRange()); // (wie _friendIdle: hinaus an den nächsten Rand)
  };
  let K = null;
  let steht = null;
  const mk = c._a2RadioMake;
  c._a2RadioMake = function (...a) {
    K = c._frKeep && [...c._frKeep];
    steht = fr.x;
    return mk.apply(this, a);
  };
  await c._a2RadioPlay();
  const { w } = c._a2RadioDim();
  assert.ok(ruf.findIndex((r) => r[0] === 'freund beiseite') >= 0 && ruf.findIndex((r) => r[0] === 'freund beiseite') < ruf.findIndex((r) => r[0] === 'maul' && r[1] === null), 'erst beiseite, dann stellt er es ab');
  assert.ok(K && K[0] <= 350 - w / 2 && K[1] >= 350 + w / 2, JSON.stringify(K));
  // er steht draußen, als es kommt; Wege in den Bereich enden draußen, solange es steht; danach ist der Platz frei
  c._frKeep = K;
  assert.ok((steht < K[0] || steht > K[1]) && c._frKeepX(steht, 150, 560) === steht, 'draußen: ' + steht);
  assert.ok(Math.abs(c._frKeepX(350, 150, 560) - 350) >= w / 2);
  c._a2Cleanup();
  assert.equal(c._frKeep, null);
  assert.equal(c._frKeepX(350, 150, 560), 350);
  // beschäftigt: kein Radio (die übrigen Schätze ohne Platzbedarf bleiben)
  c._el.scene.cls = new Set();
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2RadioPlay']);
  for (const f of [{ busy: true }, { arrived: false }, { leaving: true }]) {
    c._fr = { ...fr, ...f };
    assert.deepEqual(plain(c._a2Acts({ wx: {} })), [], JSON.stringify(f));
  }
  c._fr = null;
});

// 0.48.1: nachts kein Vögelchen auf dem Henkel (auch nicht erzwungen, und ohne den Abstand zu verbrauchen); Abhängen
// räumt wie bei der Laterne über End ab: auch die Klassen und der Takt am Pika
test('Radio: nachts kein Vögelchen; Abhängen nimmt auch Klassen und Takt am Pika ab', async () => {
  const { c } = karte(3, { _dbgGold: true });
  c._el.scene.cls = new Set(['night']);
  let kam = false;
  c._a2RadioBird = () => (kam = true);
  await c._a2RadioPlay({ bird: true });
  assert.equal(kam, false);
  assert.equal(c._goldAt?.['a2:radio-bird'], undefined, 'Abstand nicht verbraucht');
  // abends (Dämmerung) kommt es wie bisher
  const { c: d } = karte(3, { _dbgGold: true });
  d._el.scene.cls = new Set(['dusk']);
  let kam2 = false;
  d._a2RadioBird = () => (kam2 = true);
  await d._a2RadioPlay();
  assert.equal(kam2, true);
  // abgehängt mitten im Tanz
  const { c: a } = karte(1);
  a._a2RadioMake(300);
  a._a2RadioBusy = true;
  a._el.pika.classList.add('a2r-bop', 'a2r-spin');
  a._el.pika.style.setProperty('--a2rbt', '800ms');
  a._a2Detach();
  assert.equal(a._a2RadioS, null);
  assert.equal(a._a2RadioBusy, false);
  assert.ok(!a._el.pika.cls.has('a2r-bop') && !a._el.pika.cls.has('a2r-spin'));
  assert.equal(a._el.pika.style['--a2rbt'], undefined);
  assert.equal(a._a2Els.has('radio'), false);
});

// 0.48.1 (Nachtrag A, B, C): Gleichgewicht. Von selbst wiegt jede Aktion nur 36 s / ihre typische Dauer (das Radio
// dauert etwa 32 s), danach pausiert der Schatz 6 Minuten (nicht nach Vorschau-Knöpfen); kommt die nächste
// Beschäftigung aus dem Tagesplan, bevor es fertig wäre, bietet er es nicht an; ohne freien Platz auch nicht.
test('Radio: Gewicht nach Dauer gedämpft, 6 Minuten Pause, nicht kurz vor einer Beschäftigung, nicht ohne Platz', async () => {
  const { c } = karte(2, { _planNow: () => 1e9 });
  c._el.scene.cls = new Set();
  const A = plain(c._a2Acts({ wx: {} }));
  assert.deepEqual(A.map((a) => a[1]), ['a2RadioPlay', 'a2RadioSpin']);
  assert.ok(Math.abs(A[0][0] - 0.3 * Math.min(1, 36 / 32)) < 1e-9, String(A[0][0]));
  assert.ok(Math.abs(A[1][0] - 0.18 * Math.min(1, 36 / 33)) < 1e-9, String(A[1][0]));
  // von selbst gespielt: Pause (geräteweise, nichts im Plan)
  const vorher = plain(c._plan);
  c._action = 'a2RadioPlay';
  c._a2Cleanup();
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  assert.deepEqual(plain(c._plan), vorher);
  c._a2Last.radio = Date.now() - 6 * 6e4 + 1000;
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), [], 'nach 5 Minuten noch nicht');
  c._a2Last.radio = Date.now() - 6 * 6e4 - 1;
  assert.equal(c._a2Acts({ wx: {} }).length, 2, 'nach 6 Minuten wieder');
  // aus der Vorschau (_forced): keine Pause
  c._a2Last = {};
  c._forced = true;
  c._action = 'a2RadioSpin';
  c._a2Cleanup();
  c._forced = false;
  assert.equal(c._a2Acts({ wx: {} }).length, 2);
  // Beschäftigung in 30 s: das Radio (32 s + 5 s) nicht; in 40 s schon
  c._slotNext = 1e9 + 30000;
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  c._slotNext = 1e9 + 37500;
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2RadioPlay']);
  c._slotNext = null;
  // kein freier Platz (die ganze Wiese belegt): nicht angeboten; erzwungen läuft es trotzdem
  c._gtEls = new Map([[1, { parentElement: c._el.gifts, offsetLeft: 0, offsetWidth: 600, style: {} }]]);
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  c._forced = true;
  await c._a2RadioPlay();
  assert.ok(c._el.gifts.kinder.some((k) => k.je.has('a2-radio')), 'erzwungen: steht trotzdem');
});

// 0.48.1 (Nachtrag E): Setzt mitten im Tanz Regen ein, endet die Aktion (Abbruch über die Szene); regnete es schon
// beim Aufbau (Vorschau), nicht.
test('Radio: Regen setzt mitten im Tanz ein – die Aktion endet; regnete es schon beim Aufbau, bleibt es', () => {
  const { c, ruf } = karte(1);
  c._wx = {};
  c._a2RadioMake(300);
  c._a2RadioBusy = true;
  c._a2Scene();
  assert.equal(ruf.filter((r) => r[0] === 'abbruch').length, 0);
  c._wx = { wet: true };
  c._a2Scene();
  assert.equal(ruf.filter((r) => r[0] === 'abbruch').length, 1);
  const { c: d, ruf: rd } = karte(1);
  d._wx = { wet: true };
  d._a2RadioMake(300);
  d._a2RadioBusy = true;
  d._a2Scene();
  assert.equal(rd.filter((r) => r[0] === 'abbruch').length, 0);
});
