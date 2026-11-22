// Album 2: das Trampolin (Schatz t2 = 5) – Daten, Wahl der Aktionen (nur trocken und bei Tag), Springen, Salto, Gold,
// Tipp, Auspacken mit und ohne Trampolinwetter, Abbruch an jeder Stelle (er landet am Boden, _lift bleibt 0), reduzierte
// Bewegung, schmale Karte, Höhe im Bild. Ohne echte Szene: Elemente sind Attrappen, Laufen stellt nur die Stelle.
// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plain = (v) => JSON.parse(JSON.stringify(v));

// Ein Element, soweit Trampolin, Tuch, Pika und Teilchen es anfassen
class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.cls = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => this.cls.add(x)), remove: (...k) => k.forEach((x) => this.cls.delete(x)),
      contains: (k) => this.cls.has(k), toggle: (k, on) => ((on ?? !this.cls.has(k)) ? this.cls.add(k) : this.cls.delete(k)),
    };
    const props = (this.props = {});
    this.style = { setProperty: (k, v) => (props[k] = v), removeProperty: (k) => delete props[k] };
    this.attrs = {};
    this.kinder = [];
    this.weg = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.offsetWidth = 10;
    this.unter = null;
    this.anim = [];
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

  setAttribute(k, v) {
    this.attrs[k] = v;
  }

  appendChild(k) {
    this.kinder.push(k);
    return k;
  }

  remove() {
    this.weg = true;
    this.isConnected = false;
  }

  animate(k) {
    this.anim.push(k);
    return { cancel() {}, finish() {} };
  }

  getBoundingClientRect() {
    return { left: 260, top: 170, right: 400, bottom: 222, width: 140, height: 52 };
  }
}

// Das gebaute Bündel in einer eigenen Welt: „Bewegung reduzieren“ schaltet ruhe.matches, Zeitgeber laufen nie von
// selbst (lauf() lässt die gestellten laufen)
const ruhe = { matches: false };
let wecker = [];
let T = null;
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), {
  window: { matchMedia: () => ruhe, customCards: [] },
  document: { addEventListener() {}, removeEventListener() {}, createElement: (t) => new El(t) },
  HTMLElement: class {}, customElements: { get: () => null, define() {} }, console: { info() {}, log() {}, warn() {}, debug() {} },
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
const lauf = () => {
  const w = wecker;
  wecker = [];
  for (const x of w) if (!x.aus) x.fn();
};

// Karte mit Geometrie wie _layout (600 × 248 bzw. schmal 380 × 184), Album 2 mit dem Trampolin auf Stufe lv. ruf: was
// sie tut. wx: Wetter (trocken: {})
const GEO = {
  breit: { W: 600, H: 248, gy: 223.2, pW: 119.04, pH: 99.2, hayR: 222.68, hole: { l: 70.2, r: 121, cx: 95.6 }, rock: { l: 441.2, w: 148.8, cx: 515.6, lift: 49.1, ku: 1.488 }, xR: 546.4 },
  schmal: { W: 380, H: 184, gy: 165.6, pW: 88.32, pH: 73.6, hayR: 165.21, hole: { l: 52.1, r: 89.8, cx: 70.9 }, rock: { l: 259.6, w: 110.4, cx: 314.8, lift: 36.4, ku: 1.104 }, xR: 340.3 },
};
const BIT = 5;
const karte = (lv = 1, { wx = {}, geo = 'breit', ...extra } = {}) => {
  const G = GEO[geo];
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 1 << BIT : 0) | (lv >= 2 ? 1 << (8 + BIT) : 0) | (lv >= 3 ? 1 << (16 + BIT) : 0);
  const leer = () => {};
  Object.assign(c, {
    _cfg: { gifts: true }, _W: G.W, _H: G.H, _Hs: G.H, _x: 300, _dir: 1, _lift: 0, _lane: 0, _wx: wx, _wind: 0,
    _g: { gy: G.gy, pW: G.pW, pH: G.pH, hayR: G.hayR, hole: G.hole, rock: G.rock, xR: G.xR, home: G.hole.cx },
    _el: { pika: new El(), psay: new El(), depth: new El(), fx: new El(), gifts: new El(), scene: new El(), say: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 32 + BIT } },
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _face: (d) => (c._dir = d),
    _walkTo: async (x) => {
      c._face(x >= c._x ? 1 : -1);
      c._x = x;
      ruf.push(['geht', Math.round(x)]);
    },
    _setX: (x) => (c._x = x),
    // wie _groundSpot ohne andere Requisiten: zwischen Vorrat und Stein, in der Mitte
    _groundSpot: (u, wd, kMin = 0.6) => {
      const a = G.hayR + G.H * 0.03;
      const b = G.rock.l - G.H * 0.01;
      const k = Math.min(1, Math.max(kMin, (b - a) / wd));
      return { x: (a + b) / 2, w: wd * k };
    },
    _sparkle: leer, _mimik: leer, _happy: () => ruf.push(['freut']), _jump: leer, _puff: leer, _earSwing: leer,
    _peep: (x, y, t) => ruf.push(['piep', t]), _interrupt: () => ruf.push(['abbruch']),
    _found: (k) => ruf.push(['entdeckt', k]), _away: () => false, _urlaubFern: () => false, _err: (wo, e) => ruf.push(['fehler', wo, String(e)]),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  wecker = [];
  return { c, ruf, G };
};
// Abschnitte Bild für Bild durchspielen (sonst stellt der Test ohne requestAnimationFrame nur Anfang und Ende) und dabei
// mitschreiben: höchster Sprung (S.air) und größte Drehung je Abschnitt, Höhe des Pikas aus dem transform von .depth
const bilder = (c) => {
  const B = [];
  const drive = c._a2TrampDrive;
  c._a2TrampDrive = async function (ms, step) {
    const S = this._a2TrampS;
    const b = { ms, air: 0, rot: 0, y: 0, dip: 0, cls: new Set() };
    for (let f = 0; f <= 1.0001; f += 0.02) {
      step(Math.min(1, f));
      this._a2TrampPlace();
      b.air = Math.max(b.air, S?.air || 0);
      b.rot = Math.max(b.rot, S?.rot || 0);
      b.dip = Math.max(b.dip, S?.dip || 0);
      const m = /translateY\((-?[\d.]+)px\)/.exec(this._el.depth.style.transform || '');
      if (m) b.y = Math.max(b.y, -Number(m[1]));
      for (const k of this._el.pika.cls) b.cls.add(k);
    }
    B.push(b);
    return drive.call(this, ms, step);
  };
  return B;
};
// Sternchen im Effekt-Layer
const sterne = (c) => c._el.fx.kinder.filter((e) => e.cls.has('a2trst'));
// Aufgeräumt? Kein Zustand, keine eigenen Klassen, .depth ohne transform, das Trampolin ist weg oder blendet aus
const sauber = (c, msg = '') => {
  assert.ok(!c._a2TrampS, `kein Trampolin-Zustand ${msg}`);
  for (const k of ['a2tr', 'a2tr-sq', 'a2tr-up', 'a2tr-tuck']) assert.ok(!c._el.pika.cls.has(k), `${k} ${msg}`);
  assert.equal(c._el.depth.style.transform || '', '', `.depth ohne transform ${msg}`);
  assert.equal(c._lift, 0, `_lift ${msg}`);
  const el = c._a2Els?.get('tramp');
  assert.ok(!el || el.cls.has('a2out'), `Trampolin weg ${msg}`);
  const fr = c._el.gifts.kinder.filter((e) => e.cls.has('a2-trampf'));
  assert.ok(fr.every((e) => e.weg || e.cls.has('a2out')), `vorderer Bogen weg ${msg}`);
  assert.equal(c._a2TrampBusy, false, msg);
};

test('Trampolin: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, ganzjährig, Aktionen gibt es', () => {
  const { c } = karte();
  const it = c._a2Item(BIT);
  assert.equal(it.key, 'tramp');
  assert.equal(it.built, true);
  assert.equal(it.mo, null);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.equal(it.trick, 'Salto');
  assert.ok(it.find?.t && it.find?.h);
  assert.ok(it.dbg.length >= 3);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('tramp,unbekannt')], ['tramp']);
});

test('Trampolin: Er mag es nur trocken und bei Tag; nicht bei Regen, Schnee, Sturm, Wind, Dämmerung, Nacht; Salto ab Stufe 2', () => {
  const { c } = karte(1);
  const acts = (wx = {}, cls = [], lv = 1) => {
    c._el.scene.cls = new Set(cls);
    return plain(c._a2TrampActs({ wx }, lv));
  };
  assert.deepEqual(acts(), [[0.35, 'a2TrampPlay'], [0, 'a2TrampFlip']]);
  for (const wx of [{ wet: true }, { snow: 0.5 }, { snowcover: true }, { storm: true, shelter: true }, { hail: true }]) assert.deepEqual(acts(wx), [], JSON.stringify(wx));
  assert.deepEqual(acts({}, ['night']), []);
  assert.deepEqual(acts({}, ['dusk']), []);
  c._wind = 45;
  assert.deepEqual(acts(), []);
  c._wind = 0;
  assert.ok(acts({}, [], 2)[1][0] > 0);
  // über die Schnittstelle: trocken dabei, nass nicht
  c._el.scene.cls = new Set();
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2TrampPlay']);
  assert.deepEqual(plain(c._a2Acts({ wx: { wet: true } })), []);
});

test('Trampolin, Stufe 1: neben die Stelle, aufklappen, hinauf, immer höher springen, ausfedern, herunter, zuklappen', async () => {
  for (const geo of ['breit', 'schmal']) {
    const { c, ruf, G } = karte(1, { geo });
    const B = bilder(c);
    let made = null;
    const make = c._a2TrampMake;
    c._a2TrampMake = function (x, w) {
      const S = make.call(this, x, w);
      made = { x, w, el: S.el, front: S.front, mat: S.mat, top: S.top, folded: S.el.cls.has('fold') };
      return S;
    };
    let hoch = 0;
    c._wait = async () => {
      hoch = Math.max(hoch, c._lift);
    };
    await c._a2TrampPlay();
    const msg = `(${geo})`;
    // es stand zwischen Vorrat und Stein, er daneben (nicht darin)
    assert.ok(made, msg);
    assert.ok(made.x - made.w / 2 >= G.hayR - 1 && made.x + made.w / 2 <= G.rock.l + 1, `Platz ${msg}`);
    assert.ok(made.folded, `lag zusammengeklappt da ${msg}`);
    assert.ok(made.el.cls.has('gt') && made.el.cls.has('a2-tramp'));
    assert.ok(made.front.cls.has('gt') && made.front.cls.has('a2-trampf'));
    assert.ok(Number(made.front.style.zIndex) > Number(made.el.style.zIndex), 'vorderer Bogen vor dem hinteren Teil');
    const geht = ruf.find((r) => r[0] === 'geht');
    assert.ok(Math.abs(geht[1] - made.x) >= made.w / 2, `steht daneben ${msg}`);
    // Sprünge: werden höher, der höchste ist S.top; die Höhe steckt in .depth, _lift bleibt 0
    const spr = B.filter((b) => b.air > 0).map((b) => b.air);
    assert.ok(spr.length >= 4, `${spr.length} Sprünge ${msg}`);
    const max = Math.max(...spr);
    assert.ok(Math.abs(max - made.top) < 0.5, msg);
    const i = spr.indexOf(max);
    for (let k = 1; k <= i; k++) assert.ok(spr[k] > spr[k - 1], `immer höher ${msg}`);
    assert.ok(spr.slice(i + 1).every((h) => h < max * 0.5), `danach ausfedern ${msg}`);
    assert.equal(hoch, 0, `_lift bleibt 0 ${msg}`);
    // im Tuch federt es: es gibt nach, er sinkt mit
    assert.ok(B.some((b) => b.dip > 1), msg);
    assert.ok(Math.max(...B.map((b) => b.y)) >= made.mat + made.top - 0.5);
    // Kein Salto beim Spiel
    assert.equal(Math.max(...B.map((b) => b.rot)), 0);
    assert.ok(ruf.some((r) => r[0] === 'sagt' && /juhuu|so hoch|hui/.test(r[1])));
    assert.ok(ruf.some((r) => r[0] === 'piep' && r[1] === 'boing!'));
    // Ganz oben bleibt der Kopf im Bild, auch quer im Salto (0,13 Pika-Höhen mehr), mit Rand
    const kopf = G.gy - G.pH * 0.945 - made.mat - made.top - G.pH * 0.13;
    assert.ok(kopf >= G.H * 0.04 - 0.5, `Kopf oben bei ${kopf.toFixed(1)} px ${msg}`);
    assert.ok(made.top >= G.pH * 0.5, `springt ordentlich hoch (${made.top.toFixed(1)}) ${msg}`);
    sauber(c, msg);
    assert.ok(made.el.cls.has('fold'), 'zugeklappt');
    // danach ist es ganz weg
    lauf();
    assert.equal(c._a2Els.has('tramp'), false);
    assert.ok(made.front.weg);
    assert.deepEqual(ruf.filter((r) => r[0] === 'fehler'), []);
  }
  // auf der schmalen Karte kleiner
  const { c: b } = karte(1);
  const { c: s } = karte(1, { geo: 'schmal' });
  assert.ok(s._a2TrampSpot().w < b._a2TrampSpot().w);
});

test('Trampolin: ohne Trampolinwetter nur aus der Vorschau (_forced); Salto erst ab Stufe 2; ohne Schatz nichts', async () => {
  const { c, ruf } = karte(2, { wx: { wet: true } });
  await c._a2TrampPlay();
  assert.deepEqual(ruf, []);
  c._forced = true;
  await c._a2TrampPlay();
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /juhuu|so hoch|hui/.test(r[1])));
  sauber(c);
  const { c: c1, ruf: r1 } = karte(1);
  await c1._a2TrampFlip();
  assert.deepEqual(r1, []);
  const { c: c0, ruf: r0 } = karte(0);
  await c0._a2TrampPlay();
  c0._a2Scene();
  assert.deepEqual(r0, []);
  assert.equal(c0._a2Els?.has('tramp') ?? false, false);
});

test('Trampolin, Stufe 2: Salto beim höchsten Sprung – eine ganze Drehung, zusammengerollt; nur dort', async () => {
  const { c, ruf } = karte(2);
  const B = bilder(c);
  await c._a2TrampFlip();
  const spr = B.filter((b) => b.air > 0);
  const max = Math.max(...spr.map((b) => b.air));
  const flips = spr.filter((b) => b.rot > 0);
  assert.equal(flips.length, 1);
  assert.equal(flips[0].air, max);
  assert.equal(flips[0].rot, 360);
  assert.ok(flips[0].cls.has('a2tr-tuck'));
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /tadaa|Salto!|geschafft/.test(r[1])));
  sauber(c);
});

test('Trampolin, Stufe 3: Sternchen beim höchsten Sprung (GOLD_STAR, mit Abstand und Würfel); ohne Gold keine', async () => {
  const { c } = karte(3);
  c._dbgGold = true;
  bilder(c);
  let beim = null;
  const bounce = c._a2TrampBounce;
  c._a2TrampBounce = async function (h, flip, gold) {
    const n = sterne(this).length;
    await bounce.call(this, h, flip, gold);
    if (sterne(this).length > n) beim = h;
  };
  await c._a2TrampPlay();
  const st = sterne(c);
  assert.ok(st.length >= 5, 'Sternchen');
  assert.ok(st.every((e) => e.cls.has('gfx') && /viewBox="0 0 24 24"/.test(e.innerHTML)));
  assert.ok(Math.abs(beim - c._a2TrampTop(GEO.breit.pW * 1.2 / 64 * 12.4)) < 1, 'beim höchsten Sprung');
  // im Bild: nicht über den oberen Rand hinaus (Start und Flug)
  for (const e of st) assert.ok(parseFloat(e.style.top) + parseFloat(e.props['--dy']) >= 0, e.style.top);
  // nicht golden: keine; verreist: auch golden keine
  const { c: c2 } = karte(2);
  bilder(c2);
  await c2._a2TrampPlay();
  assert.equal(sterne(c2).length, 0);
  const { c: c3 } = karte(3, { _away: () => true });
  bilder(c3);
  await c3._a2TrampPlay();
  assert.equal(sterne(c3).length, 0);
  // ohne die Vorschau: höchstens alle 2 Minuten
  const { c: h } = karte(3);
  const R = { cd: 2 * 6e4, p: 1 };
  assert.equal(h._a2GoldOk('tramp', R), true);
  assert.equal(h._a2GoldOk('tramp', R), false);
});

test('Trampolin: Abbruch an jeder Stelle räumt auf; er steht danach am Boden (_lift 0, .depth ohne Höhe)', async () => {
  for (const calm of [false, true]) {
    ruhe.matches = calm;
    for (const geo of ['breit', 'schmal']) {
      for (const lv of [1, 2, 3]) {
        for (let n = 1; n < 60; n++) {
          let k = 0;
          const { c } = karte(lv, { geo });
          c._dbgGold = true;
          c._wait = async () => {
            if (++k >= n) {
              c._ac = { signal: { aborted: true } };
              throw new Error('Cancel');
            }
          };
          const fertig = await (lv === 2 ? c._a2TrampFlip() : c._a2TrampPlay()).then(() => true, () => false);
          const msg = `(${calm ? 'ruhig, ' : ''}${geo}, Stufe ${lv}, Abbruch beim ${n}. Warten${fertig ? ', schon fertig' : ''})`;
          // _cleanup ruft den Hook danach auf, auch zweimal
          c._a2Cleanup();
          c._a2Cleanup();
          sauber(c, msg);
          assert.ok(Number.isFinite(c._x) && c._x > 0 && c._x < GEO[geo].W, msg);
          // nach dem Ausblenden ist alles weg
          lauf();
          assert.equal(c._a2Els?.has('tramp') ?? false, false, msg);
          if (fertig) break;
        }
      }
    }
  }
  ruhe.matches = false;
});

test('Trampolin: Abbruch hoch in der Luft – er gleitet kurz zu Boden, keine Sprünge mehr, nicht hopDown', async () => {
  const { c } = karte(1);
  let oben = null;
  c._wait = async () => {
    const S = c._a2TrampS;
    if (S?.drive?.ms >= 300 && S.mode === 'mat' && S.hp > S.top * 0.6 && !oben) {
      // (im höchsten Sprung: bis zum Scheitel, dann unterbrechen)
      S.drive.step(0.5);
      c._a2TrampPlace();
      oben = c._el.depth.style.transform;
      assert.ok(S.air > S.top * 0.99);
      c._ac = { signal: { aborted: true } };
      throw new Error('Cancel');
    }
  };
  await c._a2TrampPlay().catch(() => {});
  assert.match(oben, /translateY\(-\d+/);
  c._a2Cleanup();
  sauber(c);
  // das Herunterfallen ist nur eine kurze Animation von der alten Höhe aus
  assert.ok(c._el.depth.anim.some((k) => k[0].transform === oben && k[1].transform === 'none'));
});

test('Trampolin: Szene und Aufräumen mitten in der Aktion lassen es stehen; neue Größe bricht ab; Abhängen', async () => {
  const { c, ruf } = karte(1);
  let mitten = null;
  c._wait = async () => {
    if (!mitten && c._a2TrampS?.mode === 'mat') {
      c._a2Scene();
      c._a2Cleanup();
      mitten = !!c._a2TrampS && c._a2Els.has('tramp');
      c._W = 500;
      c._a2Scene();
      c._W = 600;
    }
  };
  await c._a2TrampPlay();
  assert.equal(mitten, true);
  assert.ok(ruf.some((r) => r[0] === 'abbruch'), 'neue Größe: abbrechen');
  sauber(c);
  // golden: auch der vordere Bogen glänzt
  const { c: g } = karte(3);
  let gilt = null;
  g._wait = async () => {
    if (gilt == null && g._a2TrampS) gilt = [g._a2TrampS.el.cls.has('gilt'), g._a2TrampS.front.cls.has('gilt')];
  };
  await g._a2TrampPlay();
  assert.deepEqual(gilt, [true, true]);
  // Karte aus dem DOM mitten im Sprung: alles sofort weg
  const { c: d } = karte(3);
  let front = null;
  d._wait = async () => {
    if (d._a2TrampS?.mode === 'mat') {
      front = d._a2TrampS.front;
      d._a2Detach();
      throw new Error('Cancel');
    }
  };
  await d._a2TrampPlay().catch(() => {});
  assert.equal(d._a2TrampS, null);
  assert.equal(d._a2Els.has('tramp'), false);
  assert.ok(front.weg);
  assert.equal(d._el.depth.style.transform, '');
});

test('Trampolin: Tipp darauf, solange es draußen steht – das Tuch federt nach, Entdeckung zählt; sonst keine Zone', async () => {
  const { c, ruf } = karte(1);
  let Z = null;
  let tuch = null;
  c._wait = async () => {
    const S = c._a2TrampS;
    if (!Z && S?.mode === 'mat' && !S.drive) {
      Z = [];
      c._a2Zones(Z, { left: 0, top: 0 });
      ruf.push(['tipp', c._a2Tap(Z[0])]);
      // gleich danach gibt das Tuch nach (gedämpfte Schwingung), er steht darauf und sinkt mit
      const t0 = S.spring.t0;
      tuch = [70, 140, 210].map((dt) => c._a2TrampSpring(S, t0 + dt));
      S.spring = null;
    }
  };
  await c._a2TrampPlay();
  assert.deepEqual(Z.map((z) => [z.k, z.a2]), [['tramp', true]]);
  assert.ok(ruf.some((r) => r[0] === 'tipp' && r[1] === true));
  assert.ok(ruf.some((r) => r[0] === 'piep' && /boing|federt|bouing/.test(r[1])));
  assert.ok(tuch[0] > 1 && tuch[2] < 0, `schwingt: ${tuch.map((x) => x.toFixed(2))}`);
  // nach der Aktion: keine Zone mehr, Tipp ohne Trampolin antwortet nicht
  lauf();
  const Z2 = [];
  c._a2Zones(Z2, { left: 0, top: 0 });
  assert.deepEqual(Z2, []);
  assert.equal(c._a2TrampTap({ k: 'tramp' }), false);
});

test('Trampolin auspacken: trocken gleich ein paar Sprünge (Salto, Sternchen), sonst zeigen und vertrösten', async () => {
  for (const lv of [1, 2, 3]) {
    const { c, ruf } = karte(lv);
    const B = bilder(c);
    await c._a2TrampStow(lv);
    const spr = B.filter((b) => b.air > 0);
    assert.ok(spr.length >= 3 && spr.length < 6, `kurz, Stufe ${lv}: ${spr.length}`);
    assert.equal(spr.some((b) => b.rot === 360), lv === 2, `Salto nur auf Stufe 2 (${lv})`);
    assert.equal(sterne(c).length > 0, lv === 3, `Sternchen nur golden (${lv})`);
    assert.ok(ruf.some((r) => r[0] === 'sagt' && /juhuu|so hoch|hui|tadaa|Salto!|geschafft/.test(r[1])));
    sauber(c, `trocken, Stufe ${lv}`);
    // Regen: aufklappen, drücken, es federt, vertrösten, zuklappen; kein Sprung
    const { c: n, ruf: rn } = karte(lv, { wx: { wet: true } });
    const Bn = bilder(n);
    await n._a2TrampStow(lv);
    assert.ok(rn.some((r) => r[0] === 'sagt' && /trocken|bald/.test(r[1])), `Regen, Stufe ${lv}`);
    assert.ok(!Bn.some((b) => b.air > 0));
    assert.ok(!n._el.pika.cls.has('look-up'));
    if (lv === 3) assert.ok(sterne(n).length > 0);
    sauber(n, `Regen, Stufe ${lv}`);
    // nachts: „morgen“
    const { c: m, ruf: rm } = karte(lv);
    m._el.scene.cls.add('night');
    await m._a2TrampStow(lv);
    assert.ok(rm.some((r) => r[0] === 'sagt' && /morgen|hell/.test(r[1])));
    sauber(m, `nachts, Stufe ${lv}`);
  }
});

test('Trampolin, Bewegung reduzieren: kein Sprung, kein Salto; er steigt hinauf, wippt sanft, Sternchen stehen still', async () => {
  ruhe.matches = true;
  try {
    for (const lv of [1, 2, 3]) {
      const { c, ruf } = karte(lv);
      c._dbgGold = true;
      const B = bilder(c);
      let made = null;
      const make = c._a2TrampMake;
      c._a2TrampMake = function (x, w) {
        const S = make.call(this, x, w);
        made = { out: S.el.cls.has('a2out'), fold: S.el.cls.has('fold') };
        return S;
      };
      await (lv === 2 ? c._a2TrampFlip() : c._a2TrampPlay());
      assert.deepEqual(made, { out: true, fold: false }, 'blendet ein statt aufzuklappen');
      assert.equal(Math.max(...B.map((b) => b.air)), 0, 'kein Sprung');
      assert.equal(Math.max(...B.map((b) => b.rot)), 0, 'kein Salto');
      assert.ok(B.some((b) => b.dip > 0.5 && b.dip < 1.5), 'wippt sanft');
      assert.ok(!B.some((b) => b.cls.has('a2tr-sq') || b.cls.has('a2tr-tuck')));
      if (lv === 2) assert.ok(ruf.some((r) => r[0] === 'sagt' && /Salto/.test(r[1])));
      if (lv === 3) {
        assert.ok(sterne(c).length > 0);
        assert.ok(sterne(c).every((e) => e.cls.has('still')));
      }
      sauber(c, `ruhig, Stufe ${lv}`);
    }
  } finally {
    ruhe.matches = false;
  }
});

test('Trampolin: Nur die Höhe der Karte ändert sich (H, pW, gy mit ihr) mitten im Sprung: abbrechen wie bei neuer Breite', async () => {
  // (sonst sprängen Tuch, Breite und höchster Punkt S.top mit den Pixeln von vorher weiter)
  const { c, ruf } = karte(1, { geo: 'schmal' });
  let einmal = false;
  c._wait = async () => {
    if (!einmal && c._a2TrampS?.mode === 'mat') {
      einmal = true;
      c._H = 300;
      c._Hs = 300;
      c._a2Scene();
    }
  };
  await c._a2TrampPlay();
  assert.ok(einmal);
  assert.ok(ruf.some((r) => r[0] === 'abbruch'), 'neue Höhe: abbrechen');
});
