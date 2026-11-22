// Tests für 0.44: Mehr von der Welt antwortet auf einen Tipp (Aussichtsstein, Vorrat, Sonne, Mond, Schornstein,
// Saugroboter), und das Abendritual vor dem Schlafengehen. node --test
// Wie schnee.test.mjs lädt die Datei das gebaute Bündel mit Attrappen in node: eigene Uhr (jetzt), Zeitgeber, die erst
// auf Zuruf laufen (klingeln), ein Schalter für „Bewegung reduzieren“ (ruhe) und Elemente, die mitschreiben. Daran
// laufen die echten Methoden: _worldZones, _worldTap und _onLookAt mit der Geometrie von _layout, _goSleep samt
// Ritual von Anfang bis Ende oder an jeder Wartestelle abgebrochen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
const quell = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Eine Tabelle aus dem Quelltext lesen (was src/index.js den Tests nicht herausgibt): const NAME = { … }; bzw. [ … ];
const tabelle = (f, name) => {
  const m = quell(f).match(new RegExp(`\\nconst ${name} = ([\\[{][\\s\\S]*?[\\]}]);\\n`));
  assert.ok(m, `${name} in ${f}`);
  return new Function(`return (${m[1]});`)();
};

// ---------- die Welt der Karte ----------
let T = null;
const ABEND = new Date(2026, 10, 22, 20, 59, 0).getTime(); // eine Minute vor der Schlafenszeit (21:00)
let jetzt = ABEND;
const ruhe = { matches: false }; // prefers-reduced-motion: Die Karte liest es einmal beim Laden und behält das Objekt
const zufall = { wert: 0.5 };
let wecker = []; // Zeitgeber der Karte: laufen erst mit klingeln()
let lfd = 0;
let gebaut = []; // alle Elemente, die die Karte anlegt
class Uhr extends Date {
  constructor(...a) {
    if (a.length) super(...a);
    else super(jetzt);
  }

  static now() {
    return jetzt;
  }
}
const Mathe = Object.create(Math);
Mathe.random = () => zufall.wert;
// Klassenliste, die mitschreibt, was je gesetzt wurde (je)
class Kl {
  constructor() {
    this.s = new Set();
    this.je = new Set();
  }

  add(...k) {
    for (const x of k) {
      this.s.add(x);
      this.je.add(x);
    }
  }

  remove(...k) {
    for (const x of k) this.s.delete(x);
  }

  toggle(k, an) {
    const v = an === undefined ? !this.s.has(k) : !!an;
    if (v) this.add(k);
    else this.s.delete(k);
    return v;
  }

  contains(k) {
    return this.s.has(k);
  }
}
// Ein Element, soweit die Karte es hier anfasst. rect: [l, t, r, b] auf dem Bildschirm, op: Deckkraft, passt:
// Selektoren mit Vorfahren, die matches bejaht ('.hills *'); closest kennt Klassen, Tags und [role="button"].
class Att {
  constructor(tag = 'div') {
    this.tag = tag;
    this.classList = new Kl();
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.children = [];
    this.parentElement = null;
    this.attrs = {};
    this.hoerer = {};
    this.anim = [];
    this.teile = {};
    this.listen = {};
    this.gesendet = [];
    this.passt = new Set();
    this.rect = null;
    this.op = 1;
    this.html = '';
  }

  set className(v) {
    const je = this.classList.je;
    this.classList = new Kl();
    this.classList.je = je;
    String(v).split(/\s+/).filter(Boolean).forEach((k) => this.classList.add(k));
  }

  get className() {
    return [...this.classList.s].join(' ');
  }

  set innerHTML(v) {
    this.html = String(v);
  }

  get innerHTML() {
    return this.html;
  }

  get isConnected() {
    return !!this.parentElement;
  }

  get firstElementChild() {
    return (this.erstes ??= new Att());
  }

  get offsetWidth() {
    return 0;
  }

  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'class') this.className = String(v);
  }

  getAttribute(k) {
    return this.attrs[k] ?? null;
  }

  appendChild(k) {
    k.parentElement = this;
    this.children.push(k);
    return k;
  }

  remove() {
    const p = this.parentElement;
    if (p) p.children.splice(p.children.indexOf(this), 1);
    this.parentElement = null;
  }

  querySelector(sel) {
    if (sel === '.wface') return this.children.find((k) => k.classList.contains('wface')) || null;
    return sel in this.teile ? this.teile[sel] : (this.teile[sel] = new Att());
  }

  querySelectorAll(sel) {
    return this.listen[sel] || [];
  }

  getBoundingClientRect() {
    const [l, t, r, b] = this.rect || [0, 0, 0, 0];
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }

  animate(frames, opt) {
    this.anim.push({ frames, opt });
    return { cancel() {} };
  }

  getAnimations() {
    return [];
  }

  addEventListener(t, fn) {
    (this.hoerer[t] ||= []).push(fn);
  }

  dispatchEvent(e) {
    this.gesendet.push(e);
    return true;
  }

  setPointerCapture() {}

  selbst(teil) {
    if (teil.startsWith('.')) return this.classList.contains(teil.slice(1));
    if (teil === '[role="button"]') return this.attrs.role === 'button';
    return this.tag === teil;
  }

  matches(sel) {
    return sel.split(',').map((s) => s.trim()).some((s) => this.passt.has(s) || (!s.includes(' ') && this.selbst(s)));
  }

  closest(sel) {
    const teile = sel.split(',').map((s) => s.trim());
    for (let el = this; el; el = el.parentElement) if (teile.some((s) => el.selbst(s))) return el;
    return null;
  }
}
const neuesEl = (tag) => {
  const el = new Att(tag);
  gebaut.push(el);
  return el;
};
vm.runInNewContext(src, {
  window: { matchMedia: () => ruhe, customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: neuesEl, createElementNS: (ns, tag) => neuesEl(tag) },
  HTMLElement: class {},
  MouseEvent: class {
    constructor(type, init) {
      Object.assign(this, init, { type });
    }
  },
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug() {} },
  getComputedStyle: (el) => ({ opacity: String(el.op), transform: 'none', pointerEvents: 'auto' }),
  setTimeout: (fn, ms) => {
    const w = { fn, at: jetzt + Math.max(0, Number(ms) || 0), n: lfd++ };
    wecker.push(w);
    return w;
  },
  clearTimeout: (w) => {
    const i = wecker.indexOf(w);
    if (i >= 0) wecker.splice(i, 1);
  },
  setInterval: () => 0, clearInterval() {}, queueMicrotask, Date: Uhr, Math: Mathe, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });
// Die gestellten Zeitgeber der Reihe nach laufen lassen (die Uhr geht mit), höchstens ms weit
const klingeln = (ms = Infinity) => {
  const ende = jetzt + ms;
  for (let n = 0; ; n++) {
    // (eine Kette, die sich immer neu stellt, soll den Test kippen und nicht aufhängen)
    assert.ok(n < 2000, 'Zeitgeber ohne Ende');
    let w = null;
    for (const x of wecker) if (x.at <= ende && (!w || x.at < w.at || (x.at === w.at && x.n < w.n))) w = x;
    if (!w) break;
    wecker.splice(wecker.indexOf(w), 1);
    jetzt = Math.max(jetzt, w.at);
    w.fn();
  }
  if (Number.isFinite(ende)) jetzt = ende;
};
const frisch = (t = ABEND) => {
  jetzt = t;
  wecker = [];
  gebaut = [];
  ruhe.matches = false;
  zufall.wert = 0.5;
};
const plain = (v) => JSON.parse(JSON.stringify(v));
const CHIMNEY = tabelle('logik/interaktion.js', 'CHIMNEY');
const RITUAL = tabelle('logik/interaktion.js', 'RITUAL');
const RITUAL_STORY = tabelle('logik/interaktion.js', 'RITUAL_STORY');
const WORLD_MIN = Number(quell('logik/interaktion.js').match(/\nconst WORLD_MIN = (\d+);/)[1]);
const NEU = ['rock', 'hay', 'sun', 'moon', 'chimney', 'vac']; // was seit 0.44 antwortet
const GROESSEN = [[600, 248], [380, 184], [250, 184], [320, 400], [1000, 200]];
const AREALE = Object.keys(T.AREALE);

// ---------- Karte mit der Geometrie von _layout, ohne Schleife ----------
// Zählt mit, was eine Antwort der Welt nicht tun darf (Plan, Werte, Abbruch) und was sie tut (Schriftzug, Entdeckung).
const karte = ({ W = 600, Hs = 248, areal = 'huegel' } = {}) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const scene = new Att();
  Object.assign(scene, { clientWidth: W, clientHeight: Hs, rect: [0, 0, W, Hs] });
  scene.classList.add('day');
  const leer = () => {};
  Object.assign(c, {
    _el: new Proxy({ scene, starEls: [], clouds: [] }, { get: (t, k) => (t[k] ??= new Att()) }), _g: { pW: 1 }, _W: 0, _Hs: 0, _inside: true,
    _cfg: { name: 'Pika', sleep_start: '21:00', sleep_end: '07:00' }, _arealKey: areal, _planes: new Map(), _flowers: [], _lift: 0,
    _poseName: 'out', _dir: 1, _plan: T.planBlank(jetzt), _blooms: [], _hay: 3, _wind: 5, _seasonK: 'herbst', _fest: {}, _festPos: {},
    _wx: { wet: false, storm: false, shelter: false }, _bote: null, _gtEls: null,
    zaehler: { plan: 0, add: 0, abbr: 0, next: 0, szene: 0, sky: 0 }, log: [], gefunden: [], blicke: [], posen: [],
    _btnFit: leer, _layoutSky: leer, _layoutFest: leer, _layoutFriend: leer, _layoutBote: leer, _layoutGift: leer, _layoutSig: leer,
    _planeSnap: leer, _placePiles: leer, _restartCritters: leer, _flowerGiftPlace: leer, _poops: () => ({ piles: [] }),
    _pose(n) { this.posen.push(n); },
    _interrupt() { this.zaehler.abbr++; },
    _planOp() { this.zaehler.plan++; },
    _add() { this.zaehler.add++; },
    _touchNext() { this.zaehler.next++; },
    _setX(x) { this._x = x; },
    _freeze: leer,
    _liveX() { return this._x; },
    _liveLift() { return this._lift; },
    _face(d) { this._dir = d; },
    _say(t) { this.log.push(`„${t}“`); },
    _peep(x, y, t) { this.log.push(`(${t})`); },
    _found(k) { this.gefunden.push(k); },
    _glance(k) { this.blicke.push(k); },
    _cls(k) { this.log.push(`~${k}`); },
    _blush: leer, _puff: leer, _jump: leer, _hearts: leer, _mimik: leer, _tvOn: leer, _kiteAway: leer, _easelAway: leer, _mouth: leer,
    _bubble: leer, _bubbleRefit: leer, _emote: leer, _petFriend: leer, _petCount: leer,
    _updateSky() { this.zaehler.sky++; },
    // Die Szene der Schätze, soweit es den Plüsch-Pino angeht (wie _giftScene: nachts im Bett oder draußen bei _plushX)
    _giftScene() {
      this.zaehler.szene++;
      const E = (this._gtEls ??= new Map());
      if (this.pluesch && (this._asleep || this._plushX != null)) {
        if (!E.has(2)) E.set(2, new Att());
        E.get(2).draussen = this._plushX != null;
      } else E.delete(2);
    },
    // Wie die echte Methode: Der Weg in den Bau ist eine Wartestelle
    async _enterBurrow() {
      await this._wait(1000);
      this._inside = true;
    },
  });
  // Was an einer Stelle gemalt ist (_skyAt): hier nur die Hügel, ab 55 % der Höhe
  const huegel = new Att('path');
  huegel.passt.add('.hills *');
  c.gemalt = [{ box: [0, Hs * 0.55, W, Hs], el: huegel }];
  c.shadowRoot = {
    elementsFromPoint: (x, y) => c.gemalt.filter(({ box: [l, t, r, b] }) => x >= l && x <= r && y >= t && y <= b).map((o) => o.el),
  };
  c._layout();
  c._inside = false;
  c._x = c._W * 0.5;
  c.posen.length = 0;
  c.zaehler.abbr = 0;
  // Heuhaufen (ohne Nische): so groß, wie ihn das Layout an seine Stelle setzt
  if (!c._g.stash) c._el.hay.rect = [c._g.hay - c._g.hW * 0.3, c._g.gy - c._g.hW * 0.36, c._g.hay + c._g.hW * 0.3, c._g.gy + 4];
  return c;
};
// Sonne oder Mond an den Himmel setzen (Mitte in px der Szene)
const gestirn = (c, k, x, y, op = 1) => {
  const r = c._H * (k === 'sun' ? 0.075 : 0.06);
  Object.assign(c._el[k], { rect: [x - r, y - r, x + r, y + r], op });
};
// Saugroboter wie aus _sigVacSync: steht bei x (px), fährt oder steht
const sauger = (c, x, extra = {}) => {
  const w = c._H * 0.17;
  const el = new Att();
  el.className = 'sig-vac drive';
  c._sigVac = { el, mode: 'drive', x, dir: 1, w, hold: false, top: c._g.gy - w * (18 / 44) * 0.2, ...extra };
  return c._sigVac;
};
// Zone der Art k: die gemalte Fläche (kern) bzw. ihr Hof
const zonen = (c, sky = 2) => c._worldZones(sky);
const kern = (c, k, sky = 2) => zonen(c, sky).find((z) => z.k === k && z.rect && z.l === z.rect.l && z.t === z.rect.t);
const hof = (c, k, sky = 2) => zonen(c, sky).filter((z) => z.k === k).at(-1);
const mitte = (z) => [(z.l + z.r) / 2, (z.t + z.b) / 2];
// Tipp in die Szene an der Stelle (x, y), wie ihn der Klick an der Szene meldet
const tipp = (c, x, y) => c._onLookAt({ clientX: x, clientY: y, target: c._el.scene });
// Alle neuen Dinge auf einer Karte: Sonne und Mond am Himmel, Saugroboter auf der Wiese
const allesDa = (opt) => {
  const c = karte(opt);
  gestirn(c, 'sun', c._W * 0.55, c._Hs * 0.2);
  gestirn(c, 'moon', c._W * 0.3, c._Hs * 0.12);
  sauger(c, c._W * 0.45);
  return c;
};
const fx = (c, kl) => c._el.fx.children.filter((el) => el.classList.contains(kl));

// ---------- Entdeckungen ----------

test('Entdeckungen: Stein, Vorrat, Sonne und Mond stehen unter „Meine Welt“ und sagen, wie es geht', () => {
  const welt = T.FIND_GROUPS.indexOf('Meine Welt');
  const nach = (k) => T.FINDS.findIndex((f) => f.k === k);
  for (const k of ['rock', 'hay', 'sun', 'moon']) {
    const f = T.FINDS.find((o) => o.k === k);
    assert.ok(f, `Zeile ${k}`);
    assert.equal(f.g, welt, k);
    // Diese vier gibt es auf jeder Karte: keine Bedingung
    assert.equal(f.need, undefined, k);
    assert.match(f.h, /^(Tipp|Klopf) /, `${k}: sagt, was zu tun ist`);
    assert.ok(nach(k) > nach('door') && nach(k) < nach('visitor'), `${k}: bei den Dingen der Welt`);
  }
  // Schornstein und Saugroboter gibt es nicht überall. Ihre Zeilen brauchen eine Bedingung, die _diaryFinds kennt:
  // Stehen sie auf der Seite, dann mit need (sonst erschienen sie auf jeder Karte).
  for (const [k, need] of [['chimney', 'chimney'], ['vac', 'vac']]) {
    const f = T.FINDS.find((o) => o.k === k);
    if (f) assert.deepEqual([f.g, f.need], [welt, need], k);
  }
  // Was antwortet, meldet sich mit genau dieser Kennung als ausprobiert (auch die beiden ohne Zeile: Die Pfote
  // erscheint, sobald es die Zeile gibt)
  const c = allesDa();
  for (const k of NEU) {
    c._worldT = {};
    c._worldTap(hof(c, k));
  }
  assert.deepEqual(plain(c.gefunden), NEU);
});

// ---------- Flächen und Rangfolge ----------

test('Welt: die neuen Dinge haben ihre Fläche nur, wo es sie gibt', () => {
  for (const areal of AREALE) {
    for (const [W, Hs] of GROESSEN) {
      frisch();
      const c = karte({ W, Hs, areal });
      const g = c._g;
      const wo = `${areal} ${W}×${Hs}`;
      // ohne Sonne, Mond und Saugroboter: Stein und Vorrat immer, Schornstein nur am Erdhügel
      const arten = new Set(zonen(c).map((z) => z.k));
      assert.deepEqual(['rock', 'hay', 'sun', 'moon', 'vac'].map((k) => arten.has(k)), [true, true, false, false, false], wo);
      assert.equal(arten.has('chimney'), areal === 'huegel', `${wo}: Schornstein`);
      // Stein: der große Stein zwischen Kuppe und Boden, ganz im Bild
      const R = kern(c, 'rock');
      assert.ok(R.l >= g.rock.l && R.r <= g.rock.l + g.rock.w && R.t > g.rock.top0 && R.b === g.gy && R.r <= W + 0.01, `${wo}: Stein`);
      // Vorrat: die Nische des Hügels bzw. der Heuhaufen, wie er gemalt ist
      const V = kern(c, 'hay');
      if (g.stash) assert.deepEqual([V.l, V.r, V.b].map(Math.round), [g.hayL, g.hayR, g.gy].map(Math.round), `${wo}: Nische`);
      else assert.deepEqual([V.l, V.t, V.r, V.b], c._el.hay.rect, `${wo}: Heuhaufen`);
      // Tippfläche mindestens 40 px, auch wo die Zeichnung kleiner ist
      for (const k of arten) {
        if (!NEU.includes(k)) continue;
        const H = hof(c, k);
        assert.ok(H.r - H.l >= WORLD_MIN - 0.01 && H.b - H.t >= WORLD_MIN - 0.01, `${wo}: ${k} ${Math.round(H.r - H.l)}×${Math.round(H.b - H.t)}`);
        // der Hof liegt um die gemalte Fläche und merkt sie sich (dort erscheint die Antwort)
        const K = kern(c, k);
        assert.ok(H.l <= K.l && H.t <= K.t && H.r >= K.r && H.b >= K.b, `${wo}: Hof um ${k}`);
        assert.deepEqual(H.rect, K.rect);
      }
    }
  }
  // ein ausgeblendeter Heuhaufen (keine Fläche) ist kein Ziel
  const c = karte({ areal: 'fels' });
  c._el.hay.rect = null;
  assert.equal(kern(c, 'hay'), undefined);
});

test('Welt: der Schornstein steht, wo ihn das Areal malt, und nur der Erdhügel hat einen', () => {
  // Die Tabelle CHIMNEY (logik/interaktion.js) gegen die Grafik (grafik/areale.js): Wer den Bau umzeichnet, merkt es hier
  for (const [key, A] of Object.entries(T.AREALE)) {
    const raucht = /class="smoke"/.test(A.lights || '');
    assert.equal(key in CHIMNEY, raucht, `${key}: Schornstein in der Tabelle genau dann, wenn das Areal Rauch malt`);
  }
  const A = T.AREALE.huegel;
  const C = CHIMNEY.huegel;
  const schacht = A.svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#a39488"\/>/).slice(1).map(Number);
  const kranz = A.svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="\.6" fill="#8c7d72"\/>/).slice(1).map(Number);
  assert.deepEqual([C.x1, C.x2, C.top, C.bot], [kranz[0], kranz[0] + kranz[2], kranz[1], schacht[1] + schacht[3]]);
  const rauch = A.lights.match(/<g class="smoke"><circle cx="([\d.-]+)" cy="([\d.-]+)"/).slice(1).map(Number);
  assert.deepEqual([C.cx, C.cy], rauch);
  // in px: aus den Maßen des Baus
  const c = karte();
  const { l, u, base } = c._g.bur;
  const K = kern(c, 'chimney');
  assert.deepEqual([K.l, K.t, K.r, K.b], [l + C.x1 * u, base + C.top * u, l + C.x2 * u, base + C.bot * u]);
  // über der Tür, ohne sie zu berühren: auch der Hof nimmt ihr keinen Tipp
  assert.ok(hof(c, 'chimney').b < c._g.hole.top);
});

test('Welt: Sonne und Mond zählen an ihrem wirklichen Platz und nur, solange man sie sieht', () => {
  frisch();
  const c = karte();
  const [x, y] = [c._W * 0.55, c._Hs * 0.2];
  gestirn(c, 'sun', x, y);
  assert.deepEqual(mitte(kern(c, 'sun')), [x, y]);
  // wandert sie, wandert die Fläche mit
  gestirn(c, 'sun', x + 80, y + 10);
  assert.deepEqual(mitte(kern(c, 'sun')), [x + 80, y + 10]);
  gestirn(c, 'sun', x, y);
  // nur vor freiem Himmel: nicht, wenn die Tippstelle Berge (1) oder Hügel, Bau und Stein (0) zeigt
  assert.equal(kern(c, 'sun', 1), undefined);
  assert.equal(kern(c, 'sun', 0), undefined);
  // fast ausgeblendet (bedeckt: 0,07; Gewitter, Nebel, untergegangen: 0)
  for (const op of [0.07, 0, 0.2]) {
    gestirn(c, 'sun', x, y, op);
    assert.equal(kern(c, 'sun'), undefined, `Deckkraft ${op}`);
  }
  // tagsüber steht der Mond blass am Himmel (0,5): zu sehen, also antippbar
  gestirn(c, 'moon', x, y, 0.5);
  assert.ok(kern(c, 'moon'));
  // hinter dem Hügelkamm: Die Mitte der Scheibe entscheidet, nicht die Tippstelle. Der Hof ragte sonst in den Himmel.
  gestirn(c, 'sun', x, c._Hs * 0.56);
  assert.equal(kern(c, 'sun'), undefined);
  assert.equal(hof(c, 'sun'), undefined);
  // knapp über dem Kamm (Mitte frei) zählt sie
  gestirn(c, 'sun', x, c._Hs * 0.5);
  assert.ok(kern(c, 'sun'));
  // hinter den Bergen (Areal alpin)
  gestirn(c, 'sun', x, y);
  const berg = new Att('path');
  berg.passt.add('.mtns *');
  c.gemalt.push({ box: [x - 5, y - 5, x + 5, y + 5], el: berg });
  assert.equal(kern(c, 'sun'), undefined);
  c.gemalt.pop();
  // die Mitte hinter einer Wolke: Dann gehört der Tipp der Wolke. Eine ausgeblendete Wolke verdeckt nichts.
  const wolke = new Att();
  wolke.rect = [x - 40, y - 8, x + 40, y + 8];
  c._el.clouds.push(wolke);
  assert.ok(kern(c, 'sun'));
  wolke.classList.add('on');
  assert.equal(kern(c, 'sun'), undefined);
  assert.equal(T.worldPick(x, y, zonen(c)).k, 'cloud');
  // streift die Wolke sie nur, bleibt die Sonne Ziel, auch dort, wo beide liegen
  wolke.rect = [x + 6, y - 8, x + 90, y + 8];
  assert.equal(T.worldPick(x + 8, y, zonen(c)).k, 'sun');
});

test('Welt: der Saugroboter zählt nur, solange er auf der Wiese zu sehen ist', () => {
  frisch();
  const c = karte();
  assert.equal(kern(c, 'vac'), undefined, 'kein Sauger eingerichtet oder in der Station');
  const V = sauger(c, 200);
  const K = kern(c, 'vac');
  assert.deepEqual([K.l, K.t, K.r].map(Math.round), [200, V.top, 200 + V.w].map(Math.round));
  assert.equal(K.el, V.el);
  // mitten in der Fahrt: dort, wo er nach der Zeit gerade ist (_sigVacNow), nicht am Ziel
  Object.assign(V, { from: 100, to: 300, at: jetzt - 1000, ms: 4000, x: 300 });
  assert.equal(Math.round(kern(c, 'vac').l), 150);
  // fährt er heim, ist er links aus dem Bild; verschwindet er (.out), ist er kein Ziel mehr
  Object.assign(V, { from: -V.w - 4, to: -V.w - 4, x: -V.w - 4, ms: 0 });
  assert.equal(kern(c, 'vac'), undefined);
  Object.assign(V, { from: 200, to: 200, x: 200 });
  V.el.classList.add('out');
  assert.equal(kern(c, 'vac'), undefined);
});

test('Welt: Rangfolge – was schon antwortete, behält seine Fläche; der Hof der neuen Ziele steht ganz hinten', () => {
  frisch();
  const c = allesDa();
  c._el.scene.classList.remove('day');
  c._el.scene.classList.add('night');
  const g = c._g;
  const R = kern(c, 'rock');
  // eine Blume direkt am Stein, ein Wollknäuel vor dem Vorrat, ein Stern dicht neben dem Mond
  const blume = new Att();
  blume.rect = [R.l - 10, g.gy - 30, R.l + 4, g.gy];
  c._flowers = [{ el: blume }];
  const knaeuel = new Att();
  const V = kern(c, 'hay');
  knaeuel.rect = [V.r - 6, g.gy - 14, V.r + 10, g.gy];
  c._gtEls = new Map([[0, knaeuel]]);
  const M = kern(c, 'moon');
  const stern = new Att();
  stern.rect = [M.r + 3, M.t + 4, M.r + 5, M.t + 6];
  c._el.starEls.push(stern);
  const Z = zonen(c);
  const an = (x, y) => T.worldPick(x, y, Z)?.k;
  // Reihenfolge der Arten: Saugroboter ganz vorn, dann die alten Ziele der Wiese, dann Vorrat, Stein, Schornstein, Tür
  const erst = [...new Set(Z.map((z) => z.k))];
  assert.deepEqual(erst, ['vac', 'yarn', 'flower', 'hay', 'rock', 'chimney', 'door', 'sun', 'moon', 'star']);
  // hinter der letzten alten Art kommen nur noch Höfe
  const ende = Z.slice(Z.findLastIndex((z) => !z.rect) + 1);
  assert.deepEqual(plain(ende.map((z) => z.k)), ['vac', 'hay', 'rock', 'chimney', 'sun', 'moon']);
  assert.ok(ende.every((z) => z.rect && (z.l < z.rect.l || z.t < z.rect.t)), 'alles Höfe');
  // Blume am Stein: Sie bekommt ihren Tipp, auch wo ihr Tipp-Rand über dem Stein liegt
  assert.equal(an(R.l + 3, g.gy - 10), 'flower');
  assert.equal(an(R.l + 30, g.gy - 10), 'rock');
  // Wollknäuel vor dem Vorrat
  assert.equal(an(V.r - 2, g.gy - 6), 'yarn');
  assert.equal(an((V.l + V.r) / 2 - 8, g.gy - 8), 'hay');
  // Stern neben dem Mond: auf der Scheibe der Mond, daneben der Stern, obwohl der Hof des Monds dorthin reicht
  const [mx, my] = mitte(M);
  assert.equal(an(mx, my), 'moon');
  assert.equal(an(M.r - 2, my), 'moon', 'auf der Scheibe gewinnt der Mond gegen den Tipp-Rand des Sterns');
  assert.equal(an(M.r + 4, M.t + 5), 'star');
  const H = hof(c, 'moon');
  assert.ok(H.r > M.r + 4, 'der Hof reicht bis zum Stern');
  assert.equal(an(M.l - 4, my), 'moon', 'im Hof, wo sonst nichts ist');
  assert.equal(an(M.l - 12, my), undefined, 'daneben: freier Himmel');
  // Saugroboter vor einer Blume: Was vorn fährt, bekommt den Tipp auf seine Zeichnung; sein Hof nimmt der Blume nichts
  const S = kern(c, 'vac');
  blume.rect = [S.l + 6, S.t - 24, S.l + 20, S.t + 4];
  const Z2 = zonen(c);
  assert.equal(T.worldPick(S.l + 12, S.t + 2, Z2).k, 'vac');
  assert.equal(T.worldPick(S.l + 12, S.t - 8, Z2).k, 'flower');
  assert.equal(T.worldPick(S.r - 4, S.t - 8, Z2).k, 'vac', 'Hof');
});

test('Welt: Was ein eigenes Tippziel hat, behält den Vorrang – der Pika auf dem Stein, das Fähnchen des Flugzeugs', () => {
  frisch();
  const c = allesDa();
  // Der Tipp auf den Pika kommt gar nicht erst bei der Welt an: Sein Klick hält an (auch oben auf dem Stein), und nur
  // was niemand wollte, erreicht die Szene
  const bau = quell('karte/aufbau.js');
  assert.match(bau, /this\._el\.pika\.addEventListener\('click', \(e\) => \(e\.stopPropagation\(\), this\._onPet\(e\)\)\);/);
  assert.match(bau, /this\._el\.scene\.addEventListener\('click', \(e\) => this\._onLookAt\(e\)\);/);
  // Die neuen Ziele sind keine eigenen Tippziele (keine Tab-Stopps, wie Blume, Wolke und Tür): Sie fangen nichts ab
  const stil = quell('stil/szene.js') + quell('stil/signale.js');
  assert.match(stil, /\.fore \{ position: absolute; inset: 0; pointer-events: none; \}/, 'Heuhaufen');
  assert.match(stil, /\.sig-vac \{ pointer-events: none;/, 'Saugroboter');
  assert.match(stil, /\.mouse\.wpeek \.mw \{ pointer-events: none;/, 'die Maus hinter dem Stein');
  // Sitzt er oben, bleibt die Maus weg (der Stein antwortet mit einem Kiesel): Der Tipp auf ihn gehört ihm
  c._lift = c._g.rock.lift;
  c._worldTap(hof(c, 'rock'));
  assert.equal(c._wpeek, undefined);
  assert.equal(fx(c, 'wpeb').length, 1);

  // Unter der Tippfläche eines Flugzeugs (echtes _newPlane): Liegt dort der Pika, bekommt er den Klick mit der
  // Stelle; liegt dort eine Blume oder eins der neuen Dinge, geht das Fähnchen auf, und die Welt antwortet nicht.
  const p = c._newPlane('f1', { flight_number: 'LH123', airport_destination_city: 'Rom' });
  c._el.phits.classList.add('phits');
  const klick = p.hit.hoerer.click[0];
  const pika = c._el.pika;
  pika.classList.add('pika');
  const fell = new Att('path');
  fell.parentElement = pika;
  const stein = new Att('path');
  stein.parentElement = c._el.rock;
  const blume = new Att();
  blume.classList.add('flower');
  const hinter = { clientX: 300, clientY: 100, currentTarget: p.hit, stopPropagation() {} };
  const antworten = () => c.log.filter((s) => s.startsWith('(')).length;
  // Pika auf dem Stein unter dem Flugzeug
  c.shadowRoot.elementsFromPoint = () => [p.hit, fell, stein];
  klick(hinter);
  assert.equal(pika.gesendet.length, 1);
  assert.deepEqual([pika.gesendet[0].type, pika.gesendet[0].clientX, pika.gesendet[0].clientY], ['click', 300, 100]);
  assert.equal(p.tag.classList.contains('open'), false);
  // Blume, Stein, Heu, Sonne, Saugroboter und die linsende Maus: Das Fähnchen geht auf und wieder zu
  c._lift = 0;
  c._worldT = {};
  c._worldTap(hof(c, 'rock'));
  const maus = c._wpeek;
  assert.ok(maus);
  const vorher = antworten();
  let offen = false;
  for (const el of [blume, stein, c._el.hay, c._el.sun, c._sigVac.el, maus]) {
    c.shadowRoot.elementsFromPoint = () => [p.hit, el];
    assert.equal(c._tapBelow(hinter), null);
    klick(hinter);
    offen = !offen;
    assert.equal(p.tag.classList.contains('open'), offen);
  }
  assert.equal(pika.gesendet.length, 1);
  assert.equal(antworten(), vorher, 'unter dem Flugzeug antwortet die Welt nicht');
  assert.ok(c.gefunden.includes('plane'));
});

// ---------- die Antworten ----------

test('Aussichtsstein: tock, tock – die Maus linst hervor, wenn kein Besuch da ist, es trocken ist und er nicht oben sitzt', () => {
  frisch();
  const c = karte();
  const z = hof(c, 'rock');
  c._worldTap(z);
  assert.deepEqual(plain(c.log), ['(tock, tock)']);
  const m = c._wpeek;
  assert.ok(m, 'die Maus kommt');
  assert.equal(m.parentElement, c._el.mice);
  assert.deepEqual([...m.classList.s], ['mouse', 'left', 'wpeek']);
  assert.match(m.html, /^<div class="mw"><div class="mf"><div class="mb">\s*<svg /);
  // nur ein Bild: kein Knopf, kein Besuch nach der Uhr (this._mouse bleibt frei, _watchMouse und der Plan hängen daran)
  assert.doesNotMatch(m.html, /role=|aria-label/);
  assert.equal(m.hoerer.click, undefined);
  assert.equal(c._mouse, undefined);
  assert.equal(m.style.zIndex, String(T.BZ.maus), 'hinter dem Stein');
  assert.equal(fx(c, 'wpeb').length, 0, 'kein Kiesel, wenn die Maus kommt');
  // Sie huscht hinter dem Stein hervor und wieder zurück
  const x0 = Number(m.style.transform.match(/translate\(([\d.]+)px/)[1]);
  klingeln(100);
  const x1 = Number(m.style.transform.match(/translate\(([\d.]+)px/)[1]);
  assert.ok(x1 < x0 && x1 > c._g.rock.l, 'zur linken Steinkante');
  // noch ein Tock, solange sie herausschaut: Die Ohren zucken, kein zweites Bild, kein Kiesel
  jetzt += 300;
  c._worldTap(z);
  assert.equal(c._el.mice.children.length, 1);
  assert.ok(m.classList.contains('twitch'));
  assert.equal(fx(c, 'wpeb').length, 0);
  klingeln();
  assert.equal(m.parentElement, null, 'nach knapp zwei Sekunden ist sie weg');
  assert.equal(c._wpeek, null);
  assert.equal(c._el.mice.children.length, 0);

  // Kein Platz für die Maus: Dann hüpft ein Kiesel
  const lagen = [
    ['ein Vögelchen ist zu Besuch', (k) => (k._bird = {})], ['die Maus ist selbst zu Besuch', (k) => (k._mouse = {})],
    ['der Frosch', (k) => (k._frog = {})], ['die Schnecke', (k) => (k._snail = {})],
    ['es regnet', (k) => (k._wx.wet = true)], ['Gewitter', (k) => (k._wx.storm = true)],
    ['er sitzt oben', (k) => (k._lift = k._g.rock.lift)], ['er springt gerade hinauf', (k) => (k._action = 'lookout')],
  ];
  for (const [was, stell] of lagen) {
    frisch();
    const k = karte();
    stell(k);
    k._worldTap(hof(k, 'rock'));
    assert.equal(k._wpeek, undefined, was);
    assert.equal(k._el.mice.children.length, 0, was);
    assert.equal(fx(k, 'wpeb').length, 1, `${was}: Kiesel`);
    assert.deepEqual(plain(k.log), ['(tock, tock)'], was);
    assert.deepEqual(plain(k.gefunden), ['rock'], was);
    klingeln();
    assert.equal(fx(k, 'wpeb').length, 0, `${was}: der Kiesel räumt sich weg`);
  }
  // Kommt ein echter Besuch, während sie herausschaut, macht ihr Bild sofort Platz
  frisch();
  const k = karte();
  k._worldTap(hof(k, 'rock'));
  const bild = k._wpeek;
  k._mouse = {};
  klingeln(700);
  assert.equal(bild.parentElement, null);
  assert.equal(k._wpeek, null);
});

test('Vorrat: es raschelt, Halme fliegen auf, eine Blüte hüpft – der Vorrat bleibt, wie er ist', () => {
  for (const areal of ['huegel', 'fels']) {
    frisch();
    const c = karte({ areal });
    const blueten = [0, 1, 2].map(() => new Att('g'));
    const kreise = [0, 1, 2, 3, 4, 5].map(() => new Att('circle'));
    c._el.burrow.listen['.stashb g'] = blueten;
    c._el.hay.listen['.hayb circle'] = kreise;
    // leer: Halme, aber nichts hüpft
    c._worldTap(hof(c, 'hay'));
    assert.deepEqual(plain(c.log), ['(raschel!)'], areal);
    assert.equal(fx(c, 'wstalk').length, 5, areal);
    assert.equal([...blueten, ...kreise].some((el) => el.anim.length), false, `${areal}: leer hüpft nichts`);
    const R = kern(c, 'hay');
    for (const h of fx(c, 'wstalk')) {
      const [x, y] = [parseFloat(h.style.left), parseFloat(h.style.top)];
      assert.ok(x >= R.l && x <= R.r && y >= R.t && y <= R.b, `${areal}: Halm beginnt im Vorrat`);
      assert.ok(parseFloat(h.style['--py']) < 0, `${areal}: fliegt nach oben`);
    }
    klingeln();
    assert.equal(fx(c, 'wstalk').length, 0, `${areal}: Halme räumen sich weg`);
    // mit drei Blüten: genau eine hüpft (Nische: ihr <g>; Heuhaufen: ihre beiden Kreise)
    c._blooms = [{ color: '#f00' }, { color: '#0f0' }, { color: '#00f' }];
    c._hay = 7;
    c._worldT = {};
    c._worldTap(hof(c, 'hay'));
    const huepft = (c._g.stash ? blueten : kreise).filter((el) => el.anim.length);
    assert.equal(huepft.length, c._g.stash ? 1 : 2, areal);
    assert.ok(huepft.every((el) => /^0 -/.test(el.anim[0].frames.translate[1])), `${areal}: nach oben`);
    if (!c._g.stash) {
      assert.deepEqual(huepft, kreise.slice(2, 4), 'die beiden Kreise derselben Blüte');
      // der Haufen wackelt über scale, das sich über seine Größe (--hs im transform) legt
      assert.ok(c._el.hay.anim[0].frames.scale);
    }
    // nichts gezählt, nichts geschrieben
    assert.deepEqual([c._hay, c._blooms.length], [7, 3], areal);
    assert.deepEqual(plain(c.zaehler), { plan: 0, add: 0, abbr: 0, next: 0, szene: 0, sky: 0 }, areal);
  }
});

test('Sonne und Mond: ein Gesicht für anderthalb Sekunden an der Scheibe, er schaut hoch', () => {
  frisch();
  const c = allesDa();
  for (const k of ['sun', 'moon']) {
    const [x, y] = mitte(kern(c, k));
    tipp(c, x, y);
    const el = c._el[k];
    const f = el.children.at(-1);
    assert.deepEqual([...f.classList.s], ['wface', `w${k}`], k);
    // Sonne: Strahlenkranz und zusammengekniffene Augen. Mond: gähnt, ein kleines „z z“.
    if (k === 'sun') assert.match(f.html, /class="wrays"[\s\S]*<path d="M25 42 l13 6 l-13 6"\/>/);
    else assert.match(f.html, /class="wyawn"[\s\S]*<b class="wz">z<\/b><b class="wz">z<\/b>/);
    // noch ein Tipp ersetzt es, statt es zu stapeln
    jetzt += 400;
    tipp(c, x, y);
    assert.equal(el.children.length, 1, k);
    assert.notEqual(el.children[0], f);
    klingeln();
    assert.equal(el.children.length, 0, `${k}: räumt sich weg`);
    jetzt += 400;
  }
  assert.deepEqual(plain(c.blicke), ['look-up', 'look-up', 'look-up', 'look-up']);
  assert.deepEqual(plain(c.gefunden), ['sun', 'sun', 'moon', 'moon']);
  assert.deepEqual(plain(c.zaehler), { plan: 0, add: 0, abbr: 0, next: 0, szene: 0, sky: 0 });
  // Daneben getippt (freier Himmel): keine Antwort der Welt
  const n = c.gefunden.length;
  tipp(c, c._W * 0.8, c._Hs * 0.3);
  assert.equal(c.gefunden.length, n);
});

test('Schornstein: ein Rauchring pafft heraus, auch bei Wärme – in der Ebene des Rauchs, aber nicht als Rauch', () => {
  frisch();
  const c = karte();
  const svg = c._el.lights.querySelector('svg');
  const K = kern(c, 'chimney');
  tipp(c, ...mitte(K));
  assert.deepEqual(plain(c.log), ['(paff!)']);
  assert.equal(svg.children.length, 1);
  const ring = svg.children[0];
  // ein eigenes Element neben .smoke: Dessen Regeln (.smoke circle: Dauerschleife bei Kälte, steht mit „Bewegung
  // reduzieren“) dürfen ihn nicht treffen
  assert.equal(ring.tag, 'ellipse');
  assert.deepEqual([...ring.classList.s], ['wring']);
  assert.deepEqual([ring.attrs.cx, ring.attrs.cy], [String(CHIMNEY.huegel.cx), String(CHIMNEY.huegel.cy)]);
  assert.doesNotMatch(quell('stil/szene.js'), /\.smoke [^{]*\.wring|\.wring[^{]*circle/);
  klingeln();
  assert.equal(svg.children.length, 0);
  assert.deepEqual(plain(c.gefunden), ['chimney']);
  // im Hof (neben dem Schornstein, im Himmel) genauso
  const H = hof(c, 'chimney');
  jetzt += 400;
  tipp(c, H.l + 2, H.t + 2);
  assert.equal(svg.children.length, 1);
  // Ein Bau ohne Schornstein: keine Fläche, kein Ring, keine Entdeckung
  for (const areal of AREALE.filter((a) => a !== 'huegel')) {
    frisch();
    const k = karte({ areal });
    assert.equal(k._smokeRing(false), false, areal);
    k._worldTap({ k: 'chimney', l: 0, t: 0, r: 40, b: 40, rect: { l: 10, t: 10, r: 30, b: 30 } });
    assert.deepEqual([k.gefunden.length, k.log.length, k._el.lights.querySelector('svg').children.length], [0, 0, 0], areal);
  }
});

test('Saugroboter: er piept und blinkt einmal, an seiner Fahrt ändert sich nichts', () => {
  frisch();
  const c = karte();
  const V = sauger(c, 220, { from: 100, to: 400, at: jetzt - 2000, ms: 6000, x: 400 });
  c._sigVacT = 'takt';
  const vorher = plain({ ...V, el: null });
  const klassen = [...V.el.classList.s];
  const [x, y] = mitte(kern(c, 'vac'));
  tipp(c, x, y);
  assert.deepEqual(plain(c.log), ['(piep!)']);
  assert.deepEqual([...V.el.classList.s], [...klassen, 'wbeep']);
  // nur die Klasse am Bild: Ziel, Richtung, Zustand und Takt der Fahrt bleiben
  assert.deepEqual(plain({ ...V, el: null }), vorher);
  assert.equal(c._sigVacT, 'takt');
  assert.equal(V.el.style.left, undefined);
  klingeln();
  assert.deepEqual([...V.el.classList.s], klassen, 'das Blinken ist vorbei');
  assert.deepEqual(plain(c.gefunden), ['vac']);
  assert.deepEqual(plain(c.zaehler), { plan: 0, add: 0, abbr: 0, next: 0, szene: 0, sky: 0 });
  // Das Blinken schlägt Farbe und Dauerblinken von „steht“ und „steckt fest“ (STYLE_SIG steht später im Stil)
  assert.match(quell('stil/szene.js'), /\.scene \.sig-vac\.wbeep \.sig-led \{ animation: wbeep/);
});

test('Welt: keine Antwort schreibt in Plan oder Zustand oder stört, was er gerade tut', () => {
  for (const areal of AREALE) {
    for (const [lage, stell] of [['wach', () => {}], ['beschäftigt', (c) => (c._action = 'read')], ['schläft', (c) => (c._asleep = true)]]) {
      frisch();
      const c = allesDa({ areal });
      c._blooms = [{ color: '#f00' }];
      c._el.burrow.listen['.stashb g'] = [new Att('g')];
      c._el.hay.listen['.hayb circle'] = [new Att('circle'), new Att('circle')];
      stell(c);
      const vorher = plain({ plan: c._plan, hay: c._hay, x: c._x, dir: c._dir, action: c._action ?? null, asleep: !!c._asleep });
      const pika = [...c._el.pika.classList.s];
      for (const k of NEU) {
        const K = kern(c, k);
        if (!K) {
          assert.equal(`${areal} ${k}`, `${areal} chimney`, 'nur der Schornstein fehlt, und nur ohne Erdhügel');
          continue;
        }
        tipp(c, ...mitte(K));
        jetzt += 300;
      }
      klingeln();
      const wo = `${areal}, ${lage}`;
      assert.deepEqual(plain(c.gefunden), NEU.filter((k) => k !== 'chimney' || areal === 'huegel'), wo);
      assert.deepEqual(plain(c.zaehler), { plan: 0, add: 0, abbr: 0, next: 0, szene: 0, sky: 0 }, wo);
      assert.deepEqual(plain({ plan: c._plan, hay: c._hay, x: c._x, dir: c._dir, action: c._action ?? null, asleep: !!c._asleep }), vorher, wo);
      assert.deepEqual([...c._el.pika.classList.s], pika, `${wo}: am Pika ändert sich keine Klasse`);
      assert.equal(c.log.some((s) => s.startsWith('„')), false, `${wo}: er sagt nichts dazu`);
      // alles Kurzlebige ist wieder weg
      assert.deepEqual([c._el.fx.children.length, c._el.mice.children.length, c._el.sun.children.length, c._el.moon.children.length], [0, 0, 0, 0], wo);
    }
  }
});

test('Welt: schläft er oder ist er verreist, antworten nur die Dinge – er schaut nicht hin', () => {
  for (const [lage, stell, schaut] of [
    ['wach', () => {}, true], ['schläft', (c) => (c._asleep = true), false], ['verreist', (c) => (c._fort = true), false],
    ['im Bau', (c) => (c._inside = true), false], ['frisst', (c) => (c._action = 'eatFood'), false],
  ]) {
    frisch();
    const c = allesDa();
    stell(c);
    for (const k of NEU) {
      tipp(c, ...mitte(kern(c, k)));
      jetzt += 300;
    }
    // die Dinge antworten in jeder Lage
    assert.deepEqual(plain(c.gefunden), NEU, lage);
    assert.equal(c._el.mice.children.length + fx(c, 'wpeb').length, 1, `${lage}: Maus oder Kiesel`);
    assert.equal(c._el.sun.children.length, 1, lage);
    // er schaut nur wach und draußen hin: hoch zu Sonne und Mond, sonst zur Seite der Stelle
    if (!schaut) assert.deepEqual(plain(c.blicke), [], lage);
    else {
      assert.equal(c.blicke.length, NEU.length);
      assert.deepEqual([c.blicke[NEU.indexOf('sun')], c.blicke[NEU.indexOf('moon')]], ['look-up', 'look-up']);
      assert.match(c.blicke[NEU.indexOf('rock')], /^look-[fb]$/);
    }
  }
});

test('Welt: mit „Bewegung reduzieren“ blenden die Antworten auf, statt zu fliegen, zu hüpfen oder hervorzuhuschen', () => {
  frisch();
  ruhe.matches = true;
  const c = allesDa();
  c._blooms = [{ color: '#f00' }];
  const bluete = new Att('g');
  c._el.burrow.listen['.stashb g'] = [bluete];
  for (const k of NEU) tipp(c, ...mitte(kern(c, k)));
  assert.deepEqual(plain(c.gefunden), NEU, 'geantwortet wird trotzdem');
  // Maus: steht gleich an der Kante und blendet ein, kein Huschen
  const m = c._wpeek;
  assert.ok(m.classList.contains('calm'));
  const x0 = m.style.transform;
  klingeln(200);
  assert.equal(m.style.transform, x0);
  assert.equal(m.style.transition, undefined);
  // Halme, Gesichter und Rauchring tragen .calm, die Blüte blinkt (Deckkraft) statt zu hüpfen
  assert.ok(fx(c, 'wstalk').length === 5 && fx(c, 'wstalk').every((el) => el.classList.contains('calm')));
  assert.ok(c._el.sun.children[0].classList.contains('calm') && c._el.moon.children[0].classList.contains('calm'));
  assert.ok(c._el.lights.querySelector('svg').children[0].classList.contains('calm'));
  assert.deepEqual(Object.keys(bluete.anim[0].frames), ['opacity']);
  // und der Kiesel, wenn die Maus nicht kommt
  frisch();
  ruhe.matches = true;
  const k = karte();
  k._bird = {};
  k._worldTap(hof(k, 'rock'));
  assert.ok(fx(k, 'wpeb')[0].classList.contains('calm'));
  // Jede .calm-Fassung hat ihre Regel im Stil: Ohne sie liefe die Bewegung trotzdem
  const stil = quell('stil/szene.js');
  for (const sel of ['.mouse.wpeek.calm', '.wpeb.calm', '.wstalk.calm', '.wface.calm .wrays', '.wface.calm .wz', '.wring.calm']) {
    assert.ok(stil.includes(`${sel}`), sel);
  }
  ruhe.matches = false;
});

// ---------- Abendritual ----------

// Die Karte abends auf der Wiese, bereit fürs Bett. pluesch: Er hat den Plüsch-Pino.
const abends = ({ pluesch = false, t = ABEND + 80000 } = {}) => {
  frisch(t);
  const c = karte();
  c.pluesch = pluesch;
  c._el.scene.classList.add('dusk');
  return c;
};
class Abbruch extends Error {}
// _goSleep laufen lassen, wie es die Schleife tut. Jedes Warten stellt nur die Uhr vor; stopp: bei diesem Warten
// (0, 1, 2 …) wird abgebrochen. bei(n, c, ms): vor jedem Warten. Danach räumt das echte _cleanup auf.
const schlafen = async (c, { stopp = Infinity, bei = null } = {}) => {
  let n = 0;
  const waits = [];
  c._action = 'goSleep';
  c._wait = (ms) => {
    bei?.(n, c, ms);
    if (n++ === stopp) return Promise.reject(new Abbruch());
    waits.push(ms);
    jetzt += Math.max(0, ms);
    return Promise.resolve();
  };
  let fertig = true;
  try {
    await c._goSleep();
  } catch (e) {
    if (!(e instanceof Abbruch)) throw e;
    fertig = false;
  }
  c._cleanup();
  return { fertig, n, waits };
};
const RIT_KLASSEN = ['rstretch', 'yawning', 'rcap', 'rread', 'reading', 'look-up', 'content'];
// Der Zustand, in dem er nach dem Einschlafen ist (ohne das, was nur mitzählt)
const bett = (c) => ({
  asleep: c._asleep, inside: c._inside, klassen: [...c._el.pika.classList.s].sort(), dir: c._dir, ritOn: !!c._ritOn, plushX: c._plushX ?? null,
  pose: c.posen.at(-1), pluesch: c._gtEls?.has(2) ? (c._gtEls.get(2).draussen ? 'draußen' : 'im Bett') : null, action: c._action,
});

test('Abendritual: einmal je Nacht, kurz nach der Schlafenszeit, draußen und nur, wenn er da ist', () => {
  const c = abends();
  // 21:00:20: fällig
  assert.equal(c._sleepTime(), true);
  assert.equal(c._bedOf(), new Date(2026, 10, 22, 21).getTime());
  assert.equal(c._ritualDue(), true);
  // fragen ändert nichts
  assert.equal(c._ritualDue(), true);
  // nicht im Bau (Gewitter, Starkregen, Fernsehen), nicht bei „im Bau bleiben“, nicht oben, nicht verreist
  for (const [was, stell] of [
    ['im Bau', (k) => (k._inside = true)], ['Gewitter: bleibt im Bau', (k) => (k._wx.shelter = true)], ['auf dem Stein', (k) => (k._lift = 30)],
    ['schon fort', (k) => (k._fort = true)], ['Urlaub läuft', (k) => (k._plan.ur = { t: jetzt - 1000 })],
  ]) {
    const k = abends();
    stell(k);
    assert.equal(k._ritualDue(), false, was);
  }
  // zehn Minuten nach der Schlafenszeit ist Schluss: Wer später ins Bett geht (vom Kaffee geweckt, gefüttert), ohne
  assert.equal(abends({ t: ABEND + 60000 + RITUAL.late })._ritualDue(), true);
  assert.equal(abends({ t: ABEND + 60000 + RITUAL.late + 1000 })._ritualDue(), false);
  for (const h of [23, 26, 30]) assert.equal(abends({ t: new Date(2026, 10, 22, h, 30).getTime() })._ritualDue(), false, `${h % 24}:30 Uhr`);
  // vor der Schlafenszeit gibt es kein „heute Abend“: Die letzte Schlafenszeit war gestern
  const vor = abends({ t: ABEND });
  assert.equal(vor._bedOf(), new Date(2026, 10, 21, 21).getTime());
  assert.equal(vor._ritualDue(), false);
  // Lag er in dieser Nacht schon im Bett (beim Laden schlief er: _sleepNow), bleibt es aus, auch gleich danach
  const lud = abends();
  lud._sleepNow(true);
  assert.equal(lud._ritNight, lud._bedOf());
  lud._asleep = false; // der Kaffeeduft weckt ihn
  lud._inside = false;
  assert.equal(lud._ritualDue(), false);
  // … am nächsten Abend wieder
  jetzt += 864e5;
  assert.equal(lud._ritualDue(), true);
  // Aufwachen ohne Übergang (_sleepNow(false)) merkt nichts
  const wach = abends();
  wach._inside = true;
  wach._sleepNow(false);
  assert.equal(wach._ritNight, undefined);
  // Die Vorschau stellt die Schlafenszeit von Hand (ohne Ritual) und erzwingt es mit ihrem Knopf (aber nie im Bau)
  const v = abends({ t: new Date(2026, 10, 22, 12).getTime() });
  v._dbgSleep = true;
  assert.equal(v._ritualDue(), false);
  v._dbgRitual = 'star';
  assert.equal(v._ritualDue(), true);
  v._inside = true;
  assert.equal(v._ritualDue(), false);
});

test('Abendritual ohne Plüsch-Pino: strecken, gähnen, Zipfelmütze, Gute Nacht zum Himmel – dann ins Bett wie immer', async () => {
  const c = abends();
  const t0 = jetzt;
  const schritte = [];
  let bisBau = null;
  const hinein = c._enterBurrow;
  c._enterBurrow = function () {
    bisBau = jetzt - t0;
    schritte.push('→ Bau');
    return hinein.call(this);
  };
  const R = await schlafen(c, {
    bei: (n, k) => {
      // die ganze Zeit ist es „goSleep“: Der Takt, das Häufchen und der Kaffee nehmen das Schlafengehen schon aus
      assert.equal(k._action, 'goSleep');
      schritte.push([...k._el.pika.classList.s].filter((x) => RIT_KLASSEN.includes(x)).join('+') || '–');
    },
  });
  assert.equal(R.fertig, true);
  // Ablauf: lang strecken, kurz stehen, gähnen, Mütze auf, hochschauen, Gute Nacht; dann der Weg in den Bau
  assert.deepEqual(schritte, ['rstretch', '–', 'yawning', 'rcap', 'rcap+look-up', 'rcap+look-up', '→ Bau', 'rcap', 'rcap']);
  assert.deepEqual(R.waits.slice(0, 6), [RITUAL.stretch, RITUAL.gap, RITUAL.yawn, RITUAL.cap, RITUAL.look, RITUAL.star]);
  assert.ok(bisBau >= 6000 && bisBau <= 10000, `Ritual ${bisBau} ms`);
  const gesagt = c.log.filter((s) => s.startsWith('„'));
  assert.equal(gesagt.length, 3);
  assert.equal(gesagt[1], '„*gähn*“');
  assert.match(gesagt[2], /^„Gute Nacht(, Sterne)?!“$/);
  assert.ok(c.log.includes('~mlem'), 'nach dem Gähnen schmatzt er');
  // kein Plüsch, kein Buch
  assert.equal(c._el.pika.classList.je.has('reading'), false);
  assert.equal(c._gtEls.has(2), false);
  // am Ende: im Bau, schläft, die Nacht ist gemerkt, nichts vom Ritual ist übrig
  assert.deepEqual(bett(c), { asleep: true, inside: true, klassen: ['sleeping'], dir: 1, ritOn: false, plushX: null, pose: 'sleep', pluesch: null, action: null });
  assert.equal(c._ritNight, c._bedOf());
  assert.equal(c._ritualDue(), false);
  assert.deepEqual([c.zaehler.plan, c.zaehler.add], [0, 0], 'je Gerät: nichts im Plan, nichts im Zustand');
  // Mit dem Mond am Himmel schaut er zu ihm und sagt es ihm
  const m = abends();
  m._moonUp = true;
  m._el.moon._pos = { x: 12, y: 20 };
  await schlafen(m);
  assert.ok(m.log.includes('„Gute Nacht, Mond!“'));
  // … hinter dichten Wolken nicht
  const w = abends();
  w._moonUp = true;
  w._el.moon._pos = { x: 12, y: 20 };
  w._el.scene.classList.add('overcast');
  await schlafen(w);
  assert.deepEqual(w.log.filter((s) => s.startsWith('„')).at(-1), '„Gute Nacht!“');
});

test('Abendritual mit Plüsch-Pino: er setzt ihn neben sich, liest ihm den letzten Satz vor und sagt ihm Gute Nacht', async () => {
  const c = abends({ pluesch: true });
  const t0 = jetzt;
  const schritte = [];
  let bisBau = null;
  const hinein = c._enterBurrow;
  c._enterBurrow = function () {
    bisBau = jetzt - t0;
    schritte.push('→ Bau');
    return hinein.call(this);
  };
  const R = await schlafen(c, {
    bei: (n, k) => schritte.push(`${[...k._el.pika.classList.s].filter((x) => RIT_KLASSEN.includes(x)).join('+') || '–'}${k._gtEls?.get(2)?.draussen ? ' *' : ''}`),
  });
  assert.equal(R.fertig, true);
  // (* = der Plüsch-Pino sitzt draußen neben ihm)
  assert.deepEqual(schritte, ['rstretch', '–', 'yawning', 'rcap', 'rcap *', 'rcap+reading+rread *', 'rcap+content *', '→ Bau', 'rcap', 'rcap']);
  assert.ok(bisBau >= 6000 && bisBau <= 10000, `Ritual ${bisBau} ms`);
  const gesagt = c.log.filter((s) => s.startsWith('„'));
  assert.ok(RITUAL_STORY.includes(gesagt[2].slice(1, -1)), gesagt[2]);
  assert.equal(RITUAL_STORY[0], '…und dann schliefen alle ein.');
  assert.equal(gesagt[3], '„Gute Nacht, Plüsch-Pino.“');
  // danach liegt der Plüsch-Pino wie jede Nacht bei ihm im Bett
  assert.deepEqual(bett(c), { asleep: true, inside: true, klassen: ['sleeping'], dir: 1, ritOn: false, plushX: null, pose: 'sleep', pluesch: 'im Bett', action: null });
  // er heißt wie der Freund (friend_name)
  const k = abends({ pluesch: true });
  k._cfg.friend_name = 'Momo';
  await schlafen(k);
  assert.ok(k.log.includes('„Gute Nacht, Plüsch-Momo.“'));
  // Der Plüsch-Pino sitzt auf der Seite zur freien Wiese hin (zwischen Vorrat und Stein), nicht vor Heu oder Stein,
  // und immer im Bild
  for (const areal of AREALE) {
    for (const [W, Hs] of GROESSEN) {
      const { fMin, fMax } = karte({ W, Hs, areal })._g;
      for (const x of [0.03, 0.2, fMin, (fMin + fMax) / 2 - 0.01, (fMin + fMax) / 2 + 0.01, fMax, 0.9, 0.97]) {
        frisch(ABEND + 80000);
        const r = karte({ W, Hs, areal });
        r.pluesch = true;
        r._x = W * x;
        let px = null;
        await schlafen(r, { bei: (n, q) => (px ??= q._plushX ?? null) });
        const wo = `${areal} ${W}×${Hs}, x = ${x.toFixed(2)}`;
        assert.ok(px > 0 && px < W, `${wo}: im Bild`);
        const zurMitte = Math.sign(((fMin + fMax) / 2) * W - W * x);
        // (nur ganz am Rand einer sehr schmalen Karte weicht er nach innen aus)
        if (W * x > r._g.pW * 0.8 && W * x < W - r._g.pW * 0.8) assert.equal(Math.sign(px - W * x), zurMitte, `${wo}: zur Wiese hin`);
      }
    }
  }
  // Das kleine Buch ist das Buch vom Lesen, verkleinert: keine neue Requisite an der Grafik
  assert.match(quell('stil/szene.js'), /\.rread \.book \{[^}]*scale\(\.72\)/);
  assert.doesNotMatch(quell('grafik/pika.js'), /rread|rstretch|rcap/);
});

test('Abendritual mit Tiefe: von der hinteren Spur kommt er erst nach vorn, und es bleibt unter zehn Sekunden', async () => {
  for (const pluesch of [false, true]) {
    const c = abends({ pluesch });
    c._cfg.depth = true;
    c._lane = 1;
    const t0 = jetzt;
    let bisBau = null;
    let spur = null;
    const hinein = c._enterBurrow;
    c._enterBurrow = function () {
      bisBau = jetzt - t0;
      return hinein.call(this);
    };
    const R = await schlafen(c, { bei: (n, k) => k._el.pika.classList.contains('rstretch') && (spur = k._lane) });
    const wo = pluesch ? 'mit Plüsch' : 'ohne Plüsch';
    assert.equal(R.fertig, true, wo);
    // erst der Schritt nach vorn (echtes _walkTo: ein paar Trippelschritte), dann streckt er sich auf der vorderen Spur
    assert.ok(R.waits[0] >= 400 && R.waits[0] <= 1000, `${wo}: Schritt nach vorn ${R.waits[0]} ms`);
    assert.equal(R.waits[1], RITUAL.stretch, wo);
    assert.equal(spur, 0, wo);
    assert.equal(c._lane, 0, wo);
    assert.ok(bisBau >= 6000 && bisBau <= 10000, `${wo}: Ritual samt Schritt ${bisBau} ms`);
    assert.deepEqual(bett(c), {
      asleep: true, inside: true, klassen: ['sleeping'], dir: 1, ritOn: false, plushX: null, pose: 'sleep', pluesch: pluesch ? 'im Bett' : null, action: null,
    }, wo);
  }
  // schon beim Schritt nach vorn abgebrochen: nichts bleibt, die Nacht ist gemerkt, danach schlicht ins Bett
  const c = abends({ pluesch: true });
  c._cfg.depth = true;
  c._lane = 1;
  const R = await schlafen(c, { stopp: 0 });
  assert.equal(R.fertig, false);
  assert.deepEqual([[...c._el.pika.classList.s], !!c._ritOn, c._plushX ?? null, c._ritualDue()], [[], false, null, false]);
  assert.deepEqual((await schlafen(c)).waits, [2200, 1000, 900]);
  assert.equal(c._asleep, true);
});

test('Abendritual: an jeder Wartestelle abgebrochen bleibt nichts zurück, und er geht wie sonst ins Bett', async () => {
  // So sieht das Bett nach dem schlichten Schlafengehen aus (spät in der Nacht, ohne Ritual)
  const schlicht = async (pluesch) => {
    const k = abends({ pluesch, t: new Date(2026, 10, 22, 23).getTime() });
    const R = await schlafen(k);
    assert.deepEqual(R.waits, [2200, 1000, 900], 'gähnen, in den Bau, hinlegen');
    return bett(k);
  };
  for (const pluesch of [false, true]) {
    const soll = await schlicht(pluesch);
    const ganz = await schlafen(abends({ pluesch }));
    assert.ok(ganz.n >= 8);
    for (let stopp = 0; stopp < ganz.n; stopp++) {
      const c = abends({ pluesch });
      const R = await schlafen(c, { stopp });
      const wo = `${pluesch ? 'mit' : 'ohne'} Plüsch, Abbruch bei Warten ${stopp}`;
      assert.equal(R.fertig, false, wo);
      // nichts bleibt zurück: keine Klasse, kein Plüsch-Pino auf der Wiese, kein Merker
      assert.deepEqual([...c._el.pika.classList.s], [], wo);
      assert.deepEqual([!!c._ritOn, c._plushX ?? null, c._gtEls?.has(2) ?? false, !!c._asleep], [false, null, false, false], wo);
      // die Nacht ist gemerkt: Der nächste Schritt der Schleife bringt ihn ohne Ritual ins Bett
      assert.equal(c._ritualDue(), false, wo);
      c.log.length = 0;
      // (war er beim Abbruch schon im Bau, entfällt der Weg dorthin)
      const drin = c._inside;
      const R2 = await schlafen(c);
      assert.deepEqual(R2.waits, drin ? [2200, 900] : [2200, 1000, 900], wo);
      assert.deepEqual(plain(c.log), ['„*gähn*“'], wo);
      assert.equal(c._el.pika.classList.contains('rcap'), false);
      assert.deepEqual(bett(c), soll, wo);
    }
  }
  // Die Klassen des Rituals räumt auch _cleanup ab (CUTE_CLS): etwa wenn die Karte mittendrin verdeckt wird
  const cute = quell('logik/interaktion.js').match(/const CUTE_CLS = \[([\s\S]*?)\];/)[1];
  for (const k of ['rstretch', 'rcap', 'rread', 'yawning']) assert.ok(cute.includes(`'${k}'`), k);
});

test('Abendritual: wird die Karte mittendrin verdeckt, räumt es auch nach dem Aufräumen der Schleife richtig auf', async () => {
  // _stop bricht ab und räumt sofort auf (_cleanup), erst danach läuft das finally des Rituals; kommt die Karte nach
  // langer Pause wieder, liegt er inzwischen ohne Übergang im Bett (_sleepNow). Das finally darf daran nichts verderben.
  const c = abends({ pluesch: true });
  let kippen = null;
  let n = 0;
  c._action = 'goSleep';
  c._wait = (ms) => {
    jetzt += ms;
    // beim Vorlesen (Warten 5) kommt der Abbruch von außen
    return n++ === 5 ? new Promise((res, rej) => (kippen = rej)) : Promise.resolve();
  };
  const lauf = c._goSleep().catch((e) => e);
  for (let i = 0; i < 20 && !kippen; i++) await new Promise((r) => { setImmediate(r); });
  assert.ok(c._el.pika.classList.contains('rread') && c._plushX != null && c._ritOn, 'mitten im Vorlesen');
  c._cleanup(); // wie _stop
  c._sleepNow(true); // wie _visSync nach langer Pause in der Nacht
  kippen(new Abbruch());
  assert.ok((await lauf) instanceof Abbruch);
  assert.deepEqual(bett(c), {
    asleep: true, inside: true, klassen: ['sleeping'], dir: 1, ritOn: false, plushX: null, pose: 'sleep', pluesch: 'im Bett', action: null,
  });
});

test('Abendritual: Streicheln bringt die gewohnten Herzchen und bricht es ab – nur das Ritual, nicht den Weg ins Bett', () => {
  const c = abends();
  let herzen = 0;
  c._happy = () => herzen++;
  c._action = 'goSleep';
  // auf dem Weg in den Bau (ohne Ritual): Herzchen, aber er geht weiter
  c._pet(null);
  assert.deepEqual([herzen, c.zaehler.add, c.zaehler.abbr], [1, 1, 0]);
  c._onStroke();
  assert.deepEqual([c.zaehler.add, c.zaehler.abbr], [2, 0]);
  // im Ritual: Herzchen und Glück wie immer, und das Ritual endet
  c._ritOn = true;
  c._combo = [];
  c._pet(null);
  assert.deepEqual([herzen, c.zaehler.add, c.zaehler.abbr], [2, 3, 1]);
  c._onStroke();
  assert.deepEqual([c.zaehler.add, c.zaehler.abbr], [4, 2]);
  // Füttern bricht jedes Schlafengehen ab, sobald das Futter landet (goSleep steht nicht bei den Ausnahmen)
  assert.match(quell('karte/wiese.js'), /\} else if \(!\['eatFood', 'coffee', 'giftOpen'\]\.includes\(this\._action\)\) \{[\s\S]{0,400}?this\._interrupt\(\);/);
  // Der Takt und das Häufchen nehmen goSleep aus: Das Ritual verzögert für sie nichts
  assert.match(quell('karte/lebensschleife.js'), /this\._sleepTime\(\) !== this\._asleep && !\['goSleep', /);
  assert.equal(T.poopWhen(0, 'goSleep'), 'lay');
});

test('Abendritual mit „Bewegung reduzieren“: kein Strecken, nur Gähnen, Mütze und der Gutenachtgruß', async () => {
  for (const pluesch of [false, true]) {
    const c = abends({ pluesch });
    ruhe.matches = true;
    const R = await schlafen(c);
    ruhe.matches = false;
    const wo = pluesch ? 'mit Plüsch' : 'ohne Plüsch';
    assert.equal(R.fertig, true, wo);
    assert.equal(c._el.pika.classList.je.has('rstretch'), false, wo);
    assert.equal(c.log.includes('~mlem'), false, wo);
    assert.equal(R.waits[0], RITUAL.yawn, wo);
    const gesagt = c.log.filter((s) => s.startsWith('„'));
    assert.equal(gesagt[0], '„*gähn*“', wo);
    assert.match(gesagt.at(-1), /^„Gute Nacht/, wo);
    assert.equal(c._el.pika.classList.je.has('rcap'), true, wo);
    assert.equal(bett(c).asleep, true, wo);
  }
  // im Stil: Die Mütze plumpst nicht, beim Vorlesen wandert der Blick nicht
  const stil = quell('stil/szene.js');
  const ruhig = stil.slice(stil.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(ruhig, /\.rcap \.cap \{ animation: none; \}/);
  assert.match(ruhig, /\.rread \.face \{ animation: none;/);
});

test('Abendritual: die Dauer der Schritte ergibt 6 bis 10 Sekunden, mit und ohne Plüsch-Pino', () => {
  const ohne = RITUAL.stretch + RITUAL.gap + RITUAL.yawn + RITUAL.cap + RITUAL.look + RITUAL.star;
  const mit = RITUAL.stretch + RITUAL.gap + RITUAL.yawn + RITUAL.cap + RITUAL.sit + RITUAL.read + RITUAL.night;
  for (const ms of [ohne, mit]) assert.ok(ms >= 6000 && ms <= 10000, `${ms} ms`);
  assert.equal(RITUAL.late, 10 * 60000);
  // In schlaf.js ruft nur der Weg ins Bett das Ritual (und merkt die Nacht): _goSleep und _sleepNow
  const schlaf = quell('karte/schlaf.js');
  assert.equal(schlaf.match(/this\._bedRitual\(\)/g).length, 1);
  assert.equal(schlaf.match(/this\._bedMark\(\)/g).length, 2);
  assert.match(schlaf, /async _goSleep\(\) \{[\s\S]*?if \(this\._ritualDue\(\)\) await this\._bedRitual\(\);\n    else \{\n      this\._say\('\*gähn\*'\);/);
});

// Review 0.44.0: Im Regen kein Abendritual (Blattschirm, Buch und Zipfelmütze zugleich), und wer ohne Hinlaufen in
// eine Beschäftigung einsteigt, steht auf der vorderen Spur.
test('Review 0.44: Abendritual nicht im Regen, Einstieg ohne Hinlaufen holt ihn nach vorn', async () => {
  const fs = await import('node:fs');
  const lies = (f) => fs.readFileSync(new URL(`../src/karte/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(lies('momente.js'), /_ritualDue\(\) \{\n\s+if \(this\._inside \|\| this\._lift > 0 \|\| this\._wx\?\.shelter \|\| this\._wx\?\.wet \|\| this\._urlaubFern\(\)\) return false;/);
  const spot = /async _goSpot\(S, x, speed = 0\.8\) \{\n\s+if \(this\._jumpIn\(S\)\) \{([\s\S]*?)\n\s+return;/.exec(lies('beschaeftigungen.js'))[1];
  assert.match(spot, /this\._lane = 0;[\s\S]*this\._setX\(x, true\);/, 'erst die Spur, dann der Platz');
  const tv = /async _tv\(\) \{[\s\S]*?if \(this\._jumpIn\(S\)\) \{([\s\S]*?)\} else if/.exec(lies('beschaeftigungen-gross.js'))[1];
  assert.match(tv, /this\._lane = 0;[\s\S]*this\._setX\(this\._g\.home, true\);/);
});
