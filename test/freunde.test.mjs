// Tests für 0.44 „Freunde“: die eigenen Spiele von Rufus (Stöckchen), Katzumi (Jagd) und Kirby (Kullern), ihre Bilder
// in der Traumblase und auf der Staffelei. node --test
// Wie schnee.test.mjs lädt die Datei das gebaute Bündel mit Attrappen in node: eigene Uhr (jetzt), Zeitgeber, die erst
// auf Zuruf laufen (klingeln), fester Zufall (zufall) und ein Schalter für „Bewegung reduzieren“ (ruhe). Die echten
// Methoden _fetchFriend, _pounceFriend und _rollFriend laufen an einer Karte mit Attrappen-Elementen von Anfang bis
// Ende durch oder werden an jeder Wartestelle abgebrochen. Tabellen und Grafiken kommen direkt aus src/ (reine Module).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { welt, PLAN, ZUSTAND } from './welt.mjs';
import { FRIENDS, FRIEND_GAME, FRIEND_GAME_W, FRIEND_ACTS, FRIEND_CLS } from '../src/logik/besucher.js';
import { DREAM, FRIEND_FACE } from '../src/grafik/momente.js';
import { EASEL_MOTIF, EASEL_SVG } from '../src/grafik/beschaeftigungen.js';
import { DIARY_TXT } from '../src/logik/tagebuch.js';
import { diaryPainting } from '../src/grafik/tagebuch.js';
import { FRIEND_TOY, KIRBY_SVG, RUFUS_SVG, KATZUMI_SVG } from '../src/grafik/freunde.js';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
const quell = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const vorschau = fs.readFileSync(new URL('../preview.html', import.meta.url), 'utf8');

// ---------- die Welt der Karte ----------
let T = null;
let jetzt = new Date(2026, 5, 12, 11).getTime(); // ein Vormittag im Juni: kein Herbst (dann wäre die Feder ein Blatt)
const ruhe = { matches: false }; // prefers-reduced-motion: Die Karte liest es einmal beim Laden und behält das Objekt
const wecker = []; // { fn, aus }: Zeitgeber der Karte, laufen erst mit klingeln()
const zufall = { wert: 0.5, n: 0 }; // Math.random der Karte: fester Wert, Aufrufe gezählt
const gebaut = []; // alle Elemente, die die Karte mit document.createElement anlegt
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
Mathe.random = () => {
  zufall.n++;
  return zufall.wert;
};
// Klassenliste, die mitschreibt, was je gesetzt wurde (je)
class Kl {
  constructor(je = new Set()) {
    this.s = new Set();
    this.je = je;
  }

  add(...k) {
    for (const x of k) {
      this.s.add(x);
      this.je.add(x);
      this.log?.push(`+${x}`);
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
// Ein Element, soweit die Spiele es anfassen: Klassen, Stil, Kinder, Inhalt
class Att {
  constructor() {
    this.classList = new Kl();
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.children = [];
    this.parentElement = null;
    this.offsetWidth = 0;
    this.teile = {};
    this.html = '';
    this.textContent = '';
  }

  set className(v) {
    this.classList = new Kl(this.classList.je);
    v.split(/\s+/).filter(Boolean).forEach((k) => this.classList.add(k));
  }

  get className() {
    return [...this.classList.s].join(' ');
  }

  set innerHTML(v) {
    this.html = v;
  }

  get innerHTML() {
    return this.html;
  }

  get isConnected() {
    return !!this.parentElement;
  }

  appendChild(k) {
    k.parentElement = this;
    this.children.push(k);
    return k;
  }

  append(...k) {
    k.forEach((x) => this.appendChild(x));
  }

  remove() {
    const p = this.parentElement;
    if (p) p.children.splice(p.children.indexOf(this), 1);
    this.parentElement = null;
  }

  querySelector(sel) {
    return (this.teile[sel] ??= new Att());
  }

  querySelectorAll() {
    return [];
  }

  setAttribute() {}

  addEventListener() {}

  // Flugbahn des Stöckchens: mitschreiben, ob sie beendet wurde
  animate(frames, opt) {
    const a = { frames, opt, aus: false, cancel() { this.aus = true; } };
    (this.fluege ??= []).push(a);
    return a;
  }
}
const DOK = {
  hidden: false, addEventListener() {}, removeEventListener() {},
  createElement: () => {
    const el = new Att();
    gebaut.push(el);
    return el;
  },
};
const laden = (text, name, heraus) => vm.runInNewContext(text, {
  window: { matchMedia: () => ruhe, customCards: [] },
  document: DOK,
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
  // (performance: Die Karte rechnet damit aus, wo ein Freund mitten in einer Überblendung steht, _frLive)
  setInterval: () => 0, clearInterval() {}, queueMicrotask, Date: Uhr, Math: Mathe, JSON, Promise, Intl, AbortController,
  performance: { now: () => jetzt },
  __pikaTest: heraus,
}, { filename: name });
laden(src, 'pika-pet-card.js', (x) => (T = x));
// Alle gestellten Zeitgeber laufen lassen (Spielzeug nach dem Ausblenden entfernen, Herzchen wegräumen, zeitgesteuerte Klassen)
const klingeln = () => {
  while (wecker.length) {
    const w = wecker.shift();
    if (!w.aus) w.fn();
  }
};
const plain = (v) => JSON.parse(JSON.stringify(v));
// Die Karte 0.43.0 (vor den neuen Motiven) aus dem Verlauf: ein Gerät, das noch nicht neu geladen hat
let ALT = null;
try {
  ALT = execSync('git show 73c7868:pika-pet-card.js', { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  ALT = null;
}

const NEUE = ['kirby', 'rufus', 'katzumi'];
const SPIELE = Object.values(FRIEND_GAME);
const GROESSEN = [[600, 248], [380, 184], [250, 184], [320, 400], [340, 248], [1000, 200]];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Karte mit der Geometrie von _layout, ohne Schleife ----------
// pikaX, gastX, zeug: wohin Pika, Gast und Spielzeug je gesetzt wurden; log: was der Pika sagt und tut
const buehne = (W = 600, Hs = 248, cfg = {}) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const scene = new Att();
  Object.assign(scene, { clientWidth: W, clientHeight: Hs });
  const leer = () => {};
  Object.assign(c, {
    _el: new Proxy({ scene }, { get: (t, k) => (t[k] ??= new Att()) }), _g: { pW: 1 }, _W: 0, _Hs: 0, _inside: true,
    _cfg: { friend: true, friend_name: 'Pino', ...cfg }, _arealKey: 'huegel',
    _planes: new Map(), _lift: 0, _lane: 0, _poseName: 'out', _dir: 1, log: [], pikaX: [], gastX: [], zeug: [], planOps: 0, hopser: 0, eingefroren: 0,
    _btnFit: leer, _pose: leer, _layoutSky: leer, _layoutFest: leer, _layoutFriend: leer, _layoutBote: leer, _layoutGift: leer, _layoutSig: leer,
    _planeSnap: leer, _placePiles: leer, _restartCritters: leer, _flowerGiftPlace: leer,
    _interrupt: leer, _poops: () => ({ piles: [] }), _bote: null, _festPos: {}, _gtEls: null,
    _setX(x) {
      this._x = x;
      this.pikaX.push(x);
    },
    _freeze() { this.eingefroren++; },
    _liveX() { return this._x; },
    _liveLift() { return this._lift; },
    _planNow: () => jetzt, _haNow: () => jetzt, _visitNow: () => jetzt,
    _say(t) { this.log.push(`„${t}“`); },
    _frSay(fr, t) { this.log.push(`${fr.kind} „${t}“`); },
    _jump(k) { this.log.push(`Sprung ${k}`); },
    _hearts: leer, _mimik: leer, _tvOn: leer, _kiteAway: leer, _easelAway: leer, _bubble: leer, _bubbleFit: leer, _bubbleRefit: leer,
    _emote: leer, _keyTap: leer, _found: leer, _memo: leer, _giftBell: leer,
    _planOp() { this.planOps++; },
    _plan: { cute: null, rec: [] }, _flowers: [],
    _wx: {}, _hay: 0, _wind: 5, _seasonK: 'summer', _fest: {},
  });
  c._layout();
  c._inside = false;
  c._x = c._g.home + c._g.pW;
  c.pikaX.length = 0;
  c._el.pika.classList.log = c.log;
  for (const n of ['_frSetX', '_frHop', '_frToy', '_frToyAt', '_frToyFly']) {
    const echt = c[n];
    c[n] = function (...a) {
      if (n === '_frSetX') this.gastX.push([a[1], a[5] ?? a[0].lane]);
      if (n === '_frHop') this.hopser++;
      if (n === '_frToyAt') this.zeug.push([a[1], a[2]]);
      if (n === '_frToyFly') this.zeug.push([a[1], a[2]], [a[3], a[4]]);
      return echt.apply(this, a);
    };
  }
  return c;
};
// Ein Gast, schon hereingehoppelt und begrüßt, an der Stelle v (0 … 1) seiner Wiese; der Pika steht bei u der Karte
const besuch = (c, kind, u = 0.3, v = 0.6) => {
  const fr = c._friendBuild(kind);
  Object.assign(fr, { arrived: true, greeted: true, until: jetzt + 240000 });
  c._fr = fr;
  const [lo, hi] = c._frRange();
  c._frSetX(fr, lo + v * (hi - lo));
  c._x = clamp(u * c._W, c._g.pW * 0.45, c._g.xR);
  c.pikaX = [c._x]; // wo er anfangs steht, dann jeder Weg
  c.gastX.length = 0;
  fr.el.classList.log = (c.gastLog = []);
  return fr;
};
// Das Wollknäuel aus den Päckchen liegt bei x auf der Wiese
const garn = (c, x) => {
  const el = new Att();
  c._el.gifts.appendChild(el);
  el.style.left = `${x}px`;
  c._gtEls = new Map([[0, el]]);
  c._yarnXf = x / c._W;
  return el;
};
class Abbruch extends Error {}
const atmen = () => new Promise((r) => { setImmediate(r); });
// Die Aktion name an der Karte c laufen lassen. Die Wartestellen (_wait) hängen an einer eigenen Uhr: Immer die
// früheste läuft ab, auch wenn zwei Abläufe nebeneinander warten (Pika purzelt, Kirby kullert). stopp: Bei der
// Wartestelle mit dieser Nummer wird abgebrochen wie von _interrupt – alle offenen Wartestellen enden mit einem
// Fehler, jede spätere sofort. bei(n, c): vor jeder Wartestelle. Danach räumt das echte _cleanup auf wie in der Schleife.
// → { fertig, n: Zahl der Wartestellen }
const spiel = async (c, name, { stopp = Infinity, bei = null } = {}) => {
  const offen = [];
  let n = 0;
  let aus = false;
  const abbruch = () => {
    aus = true;
    for (const h of offen.splice(0)) h.nein(new Abbruch());
  };
  c._interrupt = abbruch;
  c._wait = (ms) => new Promise((ja, nein) => {
    if (aus) nein(new Abbruch());
    else offen.push({ um: jetzt + Math.max(0, ms), ja, nein });
  });
  c._action = name;
  let ende = null;
  c[`_${name}`]().then(() => { ende = { ok: true }; }, (e) => { ende = { e }; });
  for (let i = 0; i < 5000; i++) {
    await atmen();
    if (ende) break;
    assert.ok(offen.length > 0, `${name}: läuft noch, aber niemand wartet`);
    bei?.(n, c);
    if (aus) continue;
    if (n++ === stopp) {
      abbruch();
      continue;
    }
    offen.sort((a, b) => a.um - b.um);
    const h = offen.shift();
    jetzt = Math.max(jetzt, h.um);
    h.ja();
  }
  assert.ok(ende, `${name}: kommt nicht zum Ende`);
  // (Cancel wirft die Karte selbst, wenn der Gast geht oder weg ist: _withFriend)
  if (ende.e && !(ende.e instanceof Abbruch) && ende.e?.constructor?.name !== 'Cancel') throw ende.e;
  c._interrupt = () => {};
  c._cleanup();
  return { fertig: !!ende.ok, n };
};
// Nach einem Spiel, wie auch immer es endete: kein Spielzeug mehr, keine Haltung am Gast, nichts am Pika
const sauber = (c, fr, was) => {
  klingeln();
  assert.equal(c._frToys?.size || 0, 0, `${was}: Spielzeug noch gemerkt`);
  assert.deepEqual(gebaut.filter((e) => e.classList.je.has('ftoy') && e.isConnected).length, 0, `${was}: Spielzeug liegt noch da`);
  assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), [], `${was}: am Pika`);
  if (c._fr === fr) {
    assert.equal(fr.busy, false, `${was}: der Gast gehört noch dem Spiel`);
    assert.deepEqual([...fr.el.classList.s].filter((k) => !['friend', `fr-${fr.kind}`, 'left'].includes(k)), [], `${was}: am Gast`);
    assert.deepEqual([...fr.mfood.classList.s], [], `${was}: im Maul des Gasts`);
  }
  const g = c._gtEls?.get(0);
  if (g) assert.equal(g.style.transition || '', '', `${was}: Überblendung am Wollknäuel`);
};
// Wo alles stand: Pika und Gast auf ihrer Wiese, das Spielzeug in der Karte
const drin = (c, was) => {
  const { pW, xR, gy } = c._g;
  const [lo, hi] = c._frRange();
  for (const x of c.pikaX) assert.ok(x >= pW * 0.45 - 0.5 && x <= xR + 0.5, `${was}: Pika bei ${x.toFixed(1)}, erlaubt ${(pW * 0.45).toFixed(1)} … ${xR.toFixed(1)}`);
  for (const [x] of c.gastX) assert.ok(x >= lo - 0.5 && x <= hi + 0.5, `${was}: Gast bei ${x.toFixed(1)}, Wiese ${lo.toFixed(1)} … ${hi.toFixed(1)}`);
  for (const [x, y] of c.zeug) assert.ok(x >= 0 && x <= c._W && y >= 0 && y <= gy + 0.5, `${was}: Spielzeug bei ${x.toFixed(1)} | ${y.toFixed(1)} (Karte ${c._W} breit, Boden ${gy.toFixed(1)})`);
};
// Fall je Spiel: der Gast, und ob das Wollknäuel daliegt
const FAELLE = [
  { name: 'fetchFriend', kind: 'rufus' },
  { name: 'pounceFriend', kind: 'katzumi' },
  { name: 'pounceFriend', kind: 'katzumi', mitGarn: true },
  { name: 'rollFriend', kind: 'kirby' },
];
const auf = (F, W, Hs, { u = 0.3, v = 0.6, cfg = {} } = {}) => {
  gebaut.length = 0;
  const c = buehne(W, Hs, cfg);
  const fr = besuch(c, F.kind, u, v);
  // mitten auf ihrer Wiese, wo auch die Schätze liegen
  const [lo, hi] = c._frRange();
  const g = F.mitGarn ? garn(c, clamp((lo + hi) / 2, c._g.fMin * W, c._g.fMax * W)) : null;
  return { c, fr, g };
};
const titel = (F) => `${F.name}${F.mitGarn ? ' mit Wollknäuel' : ''}`;

// ---------- Auswahl ----------

test('Freunde 0.44: jeder der drei neuen hat sein eigenes Spiel, und nur er bekommt es angeboten', () => {
  assert.deepEqual(plain(FRIEND_GAME), { kirby: 'rollFriend', rufus: 'fetchFriend', katzumi: 'pounceFriend' });
  for (const g of SPIELE) {
    assert.equal(typeof T.PikaPetCard.prototype[`_${g}`], 'function', `Methode _${g}`);
    assert.ok(FRIEND_ACTS.has(g), `${g} fehlt in FRIEND_ACTS: Der Abschied bräche es nicht ab`);
  }
  // die gemeinsamen Spiele bleiben, wie sie waren
  const gemeinsam = ['chaseFriend', 'sitWithFriend', 'rockWithFriend', 'nibbleWithFriend', 'squeakDuet'];
  const ctx = { s: 80, g: 80, wx: {}, hasFlowers: true };
  const c = buehne();
  for (const kind of T.FRIEND_KEYS) {
    const fr = besuch(c, kind);
    const L = plain(c._friendActs(ctx));
    assert.deepEqual(L.map((e) => e[1]).filter((a) => gemeinsam.includes(a)), gemeinsam, kind);
    assert.deepEqual(L.filter((e) => gemeinsam.includes(e[1])).map((e) => e[0]), [7, 6, 4, 3.5, 3.5], `${kind}: Gewichte der gemeinsamen`);
    const eigen = L.filter((e) => SPIELE.includes(e[1]));
    if (kind === 'pino') assert.deepEqual(eigen, [], 'Pino spielt nur die gemeinsamen');
    else {
      assert.deepEqual(plain(eigen), [[FRIEND_GAME_W.first, FRIEND_GAME[kind]]], kind);
      // mehr als jedes gemeinsame, und für die anderen Freunde gibt es es nicht
      assert.ok(eigen[0][0] > Math.max(...L.filter((e) => gemeinsam.includes(e[1])).map((e) => e[0])), kind);
    }
    // schon einmal gespielt: wie ein gemeinsames; direkt danach gar nicht
    if (kind !== 'pino') {
      fr.sig = true;
      fr.last = 'sitWithFriend';
      assert.deepEqual(plain(c._friendActs(ctx).find((e) => e[1] === FRIEND_GAME[kind])), [FRIEND_GAME_W.again, FRIEND_GAME[kind]]);
      fr.last = FRIEND_GAME[kind];
      assert.equal(c._friendActs(ctx).find((e) => e[1] === FRIEND_GAME[kind])[0], 0, `${kind}: nie zweimal hintereinander`);
      fr.sig = false;
      assert.equal(c._friendActs(ctx).find((e) => e[1] === FRIEND_GAME[kind])[0], 0);
      fr.last = null;
      // bei Nässe wie Fangen fast nie
      assert.equal(c._friendActs({ ...ctx, wx: { wet: true } }).find((e) => e[1] === FRIEND_GAME[kind])[0], 1);
      // in den letzten 25 s des Besuchs kein neues Spiel, auch das eigene nicht
      fr.until = jetzt + T.FRIEND_LAST - 1;
      assert.deepEqual(plain(c._friendActs(ctx)), []);
      fr.until = jetzt + T.FRIEND_LAST + 1000;
      assert.ok(c._friendActs(ctx).length > 5);
      // noch nicht begrüßt, oder er geht schon: nichts davon
      fr.greeted = false;
      assert.deepEqual(plain(c._friendActs(ctx)), [[80, 'greetFriend']]);
      fr.greeted = true;
      fr.leaving = true;
      assert.deepEqual(plain(c._friendActs(ctx)), []);
    }
    c._friendGone(fr);
  }
  assert.ok(FRIEND_GAME_W.first > 7 && FRIEND_GAME_W.again > 0 && FRIEND_GAME_W.again < FRIEND_GAME_W.first);
});

test('Freunde 0.44: über einen Besuch kommt das eigene Spiel fast immer dran, aber nie zweimal hintereinander', () => {
  const ctx = { s: 80, g: 80, wx: {}, hasFlowers: true };
  // Was die Schleife sonst noch würfelt, wenn Besuch da ist (Herumsitzen, Schauen, Hoppeln …), grob zusammen
  const SONST = 22;
  let seed = 7;
  const u = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const kind of NEUE) {
    const c = buehne();
    let mit = 0;
    let doppelt = 0;
    let erstes = 0;
    const besuche = 400;
    for (let b = 0; b < besuche; b++) {
      const fr = besuch(c, kind);
      let vor = null;
      let drin0 = false;
      // etwa zwanzig Schritte hat ein Besuch von drei bis sechs Minuten
      for (let i = 0; i < 20; i++) {
        const a = T.weightedR([[SONST, 'sonst'], ...c._friendActs(ctx)], u());
        if (a === 'sonst') continue;
        if (a === FRIEND_GAME[kind]) {
          if (!drin0 && vor === null) erstes++;
          drin0 = true;
          if (vor === a) doppelt++;
        }
        // was _withFriend sich merkt
        fr.last = a;
        if (a === FRIEND_GAME[kind]) fr.sig = true;
        vor = a;
      }
      if (drin0) mit++;
      c._friendGone(fr);
    }
    assert.equal(doppelt, 0, `${kind}: zweimal hintereinander`);
    assert.ok(mit / besuche > 0.9, `${kind}: nur in ${mit} von ${besuche} Besuchen`);
    assert.ok(erstes / besuche > 0.2 && erstes / besuche < 0.5, `${kind}: als erstes Spiel in ${erstes} von ${besuche}`);
  }
});

test('Freunde 0.44: mit dem falschen Gast (Vorschau-Knopf) tut ein eigenes Spiel nichts', async () => {
  for (const F of FAELLE) {
    for (const kind of T.FRIEND_KEYS.filter((k) => k !== F.kind)) {
      const { c, fr } = auf({ ...F, kind }, 600, 248);
      const R = await spiel(c, F.name);
      assert.equal(R.fertig, true);
      // (der Gast wird nur angehalten, wo er steht: _friendSettle zu Beginn und am Ende)
      assert.deepEqual([c.pikaX.length, new Set(c.gastX.map((x) => x[0])).size, c.zeug.length, c.log.length], [1, 1, 0, 0], `${F.name} mit ${kind}`);
      sauber(c, fr, `${F.name} mit ${kind}`);
    }
  }
});

// ---------- Ablauf ----------

test('Rufus holt das Stöckchen: finden, werfen, hinterher mit fliegenden Ohren, im Maul zurück, ablegen – zwei- oder dreimal', async () => {
  for (const [wert, wuerfe] of [[0.3, 3], [0.7, 2]]) {
    zufall.wert = wert;
    const { c, fr } = auf(FAELLE[0], 600, 248);
    const im = []; // an jeder Wartestelle: wer hat das Stöckchen?
    const R = await spiel(c, 'fetchFriend', {
      bei: () => im.push(c._el.pika.classList.contains('carry') ? 'P' : fr.el.classList.contains('carry') ? 'R' : c._frToys?.size ? 'B' : '-'),
    });
    assert.equal(R.fertig, true);
    const log = c.log.join(' ');
    const stoecke = gebaut.filter((e) => e.classList.je.has('ftoy'));
    const fluege = stoecke.flatMap((e) => e.fluege || []);
    assert.equal(fluege.length, wuerfe, `Würfe bei Zufall ${wert}`);
    for (const e of stoecke) assert.equal(e.html, FRIEND_TOY.stick);
    // jeder Wurf ein Bogen: Die Bahn steigt erst und landet am Boden, das Stöckchen dreht sich zweimal
    for (const a of fluege) {
      const ys = a.frames.map((f) => Number(f.transform.match(/, (-?[\d.]+)px\)/)[1]));
      assert.ok(Math.min(...ys) < ys[0] - c._g.pH * 0.15 && ys.at(-1) > ys[0], `Bogen ${ys}`);
      assert.match(a.frames.at(-1).transform, /rotate\(-?720deg\)/);
      assert.ok(a.opt.duration >= 600 && a.opt.duration <= 950);
    }
    // was er im Maul trägt, ist dasselbe Stöckchen (als Leckerli-Feld der Pika-Grafik), bei Rufus größer gezeichnet
    assert.ok(c._el.mfood.teile['.mf-item'].html.includes('stroke="#b98a55"'));
    assert.ok(fr.mfood.teile['.mf-item'].html === '' && fr.mfood.classList.je.has('item'));
    assert.match(FRIEND_TOY.stickRufus, /scale\(2\.71\)/);
    for (const k of ['+sniff', '+carry', '+crouch', '+happy', '+wiggle', 'Sprung hop1']) assert.ok(log.includes(k), `Pika: ${k} fehlt in ${log}`);
    for (const k of ['fdash', 'carry', 'crouch', 'look-up', 'wiggle', 'calling']) assert.ok(fr.el.classList.je.has(k), `Rufus: ${k}`);
    assert.match(log, /„(ein Stöckchen!|oh, ein Stock!|schau mal!)“/);
    assert.equal((log.match(/„(hol!|hol das Stöckchen!|los, Rufus!)“/g) || []).length, wuerfe);
    assert.equal((log.match(/rufus „nochmal!“/g) || []).length, wuerfe - 1);
    assert.ok(log.lastIndexOf('„guter Rufus!“') > log.lastIndexOf('nochmal'), 'zum Schluss „guter Rufus!“');
    // Weg des Stöckchens: im Maul des Pikas (P), in der Luft und am Boden (B), im Maul von Rufus (R), abgelegt (B) –
    // und von vorn; zum Schluss liegt es da und blendet aus
    const folge = im.filter((x, i) => x !== im[i - 1]).join('');
    assert.equal(folge, `-${'PBRB'.repeat(wuerfe)}-`);
    // Rufus rennt bis zum Stöckchen und kommt wieder zum Pika zurück
    const [lo, hi] = c._frRange();
    const weit = Math.max(...c.gastX.map((g) => g[0])) - Math.min(...c.gastX.map((g) => g[0]));
    assert.ok(weit > c._g.pW * 1.5 && weit <= c._g.pW * 2.4 + 1 && weit <= hi - lo, `Wurfweite ${weit}`);
    assert.equal(c.planOps, 0, 'nichts davon steht im Tagesplan');
    drin(c, 'Stöckchen');
    sauber(c, fr, 'Stöckchen');
  }
  zufall.wert = 0.5;
});

test('Katzumi jagt die Feder am Halm: ducken, wackeln, Sprung daneben, noch ein Sprung, erwischt', async () => {
  for (const [jahreszeit, art, ruf] of [['summer', 'feather', 'eine Feder!'], ['autumn', 'leaf', 'ein Blatt!']]) {
    const { c, fr } = auf(FAELLE[1], 600, 248);
    c._seasonK = jahreszeit;
    const abstand = [];
    const R = await spiel(c, 'pounceFriend', { bei: () => abstand.push(Math.abs(fr.x - c._x) / c._g.pW) });
    assert.equal(R.fertig, true);
    const log = c.log.join(' ');
    assert.ok(log.includes(`„${ruf}“`), log);
    // der Pika hält die Angel im Maul, an ihr pendelt die Feder (das Blatt)
    assert.ok(c._el.mfood.teile['.mf-item'].html.includes('class="fdangle"'));
    assert.equal(FRIEND_TOY.dangle[art].includes(art === 'leaf' ? '#e98a35' : '#f6f9ff'), true);
    assert.equal(c.hopser, 2, 'zwei Sprünge');
    for (const k of ['kwig', 'crouch', 'carry', 'look-f']) assert.ok(fr.el.classList.je.has(k), `Katzumi: ${k}`);
    const kl = c.gastLog.join(' ');
    assert.ok(kl.indexOf('+kwig') < kl.indexOf('+crouch') && kl.lastIndexOf('+kwig') < kl.indexOf('+carry'), kl);
    // „mau!“ nach dem ersten Sprung, der Pika lacht, „hab es!“ nach dem zweiten
    const i1 = log.indexOf('katzumi „mau!“');
    const i2 = log.search(/„(hihi!|daneben!)“/);
    const i3 = log.indexOf('katzumi „hab es!“');
    assert.ok(i1 > 0 && i1 < i2 && i2 < i3, log);
    // daneben: Der Pika ist einen halben Schritt zurückgewichen (rückwärts, er dreht sich nicht um)
    assert.ok(Math.abs(Math.abs(c.pikaX.at(-1) - c.pikaX.at(-2)) - c._g.pW * 0.5) < 0.5, `${c.pikaX}`);
    // sie landet nie hinter seinem Kopf (sie steht in der Ebene hinter ihm): mindestens 0,65 Pika-Breiten Abstand
    assert.ok(Math.min(...abstand) >= 0.65, `Abstand ${Math.min(...abstand)}`);
    assert.equal(c.zeug.length, 0, 'kein eigenes Element: Angel und Beute stecken in den Figuren');
    assert.equal(c.planOps, 0);
    drin(c, 'Feder');
    sauber(c, fr, 'Feder');
  }
});

test('Katzumi jagt das Wollknäuel, wenn es auf der Wiese liegt: Es rollt wie in seinem eigenen Spiel und bleibt in der Wiese liegen', async () => {
  for (const wert of [0.3, 0.7]) {
    zufall.wert = wert;
    const { c, fr, g } = auf(FAELLE[2], 600, 248);
    const { fMin, fMax, pW } = c._g;
    const [lo, hi] = c._frRange();
    const x0 = c._giftX(0);
    assert.ok(c._frYarnPlan(fr), 'das Knäuel taugt');
    const wege = [];
    const R = await spiel(c, 'pounceFriend', {
      bei: () => {
        const x = parseFloat(g.style.left);
        if (x !== wege.at(-1)) wege.push(x);
      },
    });
    assert.equal(R.fertig, true);
    const runden = wert < 0.5 ? 3 : 2;
    assert.equal(c.hopser, runden, 'ein Sprung je Runde');
    // hin, zurück, hin …: beim letzten Mal hält sie es fest
    assert.equal(wege.length, 1 + runden * 2 - 1, `${wege}`);
    for (const x of wege) assert.ok(x >= fMin * 600 - 0.5 && x <= fMax * 600 + 0.5 && x >= lo - pW * 0.2 && x <= hi, `Knäuel bei ${x}`);
    assert.ok(Math.abs(wege[1] - x0) >= pW * 0.3, 'es rollt ein gutes Stück');
    assert.ok(Math.abs(wege[2] - x0) < pW * 0.1, 'und kommt zum Pika zurück');
    // am Ende stimmt, was das Knäuel-Spiel und der Tipp darauf lesen: _yarnXf ist die Stelle, an der es liegt
    assert.ok(Math.abs(c._giftX(0) - wege.at(-1)) < 0.1);
    assert.ok(Number.isFinite(c._yarnRot) && c._yarnRot !== 0);
    assert.match(g.teile.svg.style.transform, /^rotate\(-?\d+deg\)$/);
    assert.equal(c._el.pika.classList.je.has('carry'), false, 'keine Angel');
    const log = c.log.join(' ');
    assert.ok(log.indexOf('katzumi „mau!“') > 0 && log.indexOf('katzumi „hab es!“') > log.lastIndexOf('katzumi „mau!“'), log);
    for (const k of ['kwig', 'crouch']) assert.ok(fr.el.classList.je.has(k), k);
    assert.equal(fr.el.classList.je.has('nuzzle'), true, 'sie schlägt es zurück');
    assert.equal(c.planOps, 0);
    drin(c, 'Wollknäuel');
    sauber(c, fr, 'Wollknäuel');
  }
  zufall.wert = 0.5;
  // Liegt es dort, wo sie nicht hin darf (vor dem Bau), oder ist kein Platz zum Rollen: die Feder
  const { c, fr, g } = auf(FAELLE[2], 600, 248);
  c._yarnXf = c._g.fMin;
  if (c._g.fMin * 600 < c._frRange()[0] - c._g.pW * 0.2) assert.equal(c._frYarnPlan(fr), null, 'Knäuel vor dem Bau');
  g.remove();
  assert.equal(c._frYarnPlan(fr), null, 'Knäuel nicht mehr da');
  c._gtEls = null;
  assert.equal(c._frYarnPlan(fr), null);
  // Verschwindet es mitten im Spiel (Plan geändert), ist einfach Schluss
  const B = auf(FAELLE[2], 600, 248);
  const R = await spiel(B.c, 'pounceFriend', { bei: (n) => n === 6 && B.g.remove() });
  assert.equal(R.fertig, true);
  assert.equal(B.c.log.join(' ').includes('hab es!'), false);
  sauber(B.c, B.fr, 'Knäuel verschwunden');
});

test('Kirby kullert: eingerollt über die Wiese, der Pika hinterher und mit Purzelbäumen voraus zurück, beide schwindlig', async () => {
  const { c, fr } = auf(FAELLE[3], 600, 248);
  const { pW } = c._g;
  const stand = [];
  const R = await spiel(c, 'rollFriend', {
    bei: () => stand.push([fr.el.classList.contains('kroll'), c._el.pika.classList.contains('purzel')]),
  });
  assert.equal(R.fertig, true);
  const log = c.log.join(' ');
  assert.ok(log.includes('kirby „kuller, kuller!“'), log);
  for (const k of ['kroll', 'crouch', 'crosseye', 'happy']) assert.ok(fr.el.classList.je.has(k), `Kirby: ${k}`);
  for (const k of ['+purzel', '+crosseye', '+crouch', '+walking']) assert.ok(log.includes(k), `Pika: ${k}`);
  // zwei Rollen: hin über die ganze Strecke, zurück so weit wie die Purzelbäume des Pikas
  const kl = c.gastLog.filter((k) => k === '+kroll');
  assert.equal(kl.length, 2);
  // (ohne die Stellen, an denen er nur angehalten wurde)
  const xs = c.gastX.map((g) => g[0]).filter((x, i, a) => i === 0 || Math.abs(x - a[i - 1]) > 0.01);
  const [lo, hi] = c._frRange();
  const hin =Math.abs(xs.at(-2) - xs.at(-3));
  assert.ok(hin > pW * 2.5 && hin <= pW * 3 + 0.1 && hin <= hi - lo, `Strecke ${hin / pW} Pika-Breiten`);
  assert.equal((log.match(/\+purzel/g) || []).length, 2, 'zwei Purzelbäume');
  assert.ok(Math.abs(Math.abs(xs.at(-1) - xs.at(-2)) - 2 * pW * 0.95) < 0.5, 'Kirby kullert so weit zurück, wie der Pika purzelt');
  // ganze Umdrehungen (er kommt aufrecht an), etwa eine je Umfang seiner Kugel, in der Zeit des Wegs
  const grad = parseFloat(fr.el.style['--kra']);
  assert.ok(grad >= 360 && grad % 360 === 0, `${grad}°`);
  assert.match(fr.el.style['--krd'], /^\d+ms$/);
  assert.match(fr.el.style.transition, /^(none|transform \d+ms linear)$/);
  // Zurück rollt er dem Pika nicht in die Beine: Er kullert noch, wenn der seinen letzten Purzelbaum hinter sich hat,
  // und am Ende stehen sie nebeneinander
  const zuletzt = (i) => stand.map((s) => s[i]).lastIndexOf(true);
  assert.ok(zuletzt(1) > 0 && zuletzt(0) > zuletzt(1), `Kirby rollt bis Wartestelle ${zuletzt(0)}, der Pika purzelt bis ${zuletzt(1)}`);
  assert.ok(Math.abs(Math.abs(c._x - fr.x) / pW - 0.95) < 0.01, `am Ende ${Math.abs(c._x - fr.x) / pW} Pika-Breiten auseinander`);
  // Sternchen für beide (Funken in der Effekt-Ebene)
  assert.ok(gebaut.filter((e) => e.classList.je.has('spark')).length >= 9);
  assert.equal(c.planOps, 0);
  assert.equal(c.zeug.length, 0);
  drin(c, 'Kullern');
  sauber(c, fr, 'Kullern');
});

// ---------- Ruhig, schmal, Tiefe ----------

test('Freunde 0.44 mit „Bewegung reduzieren“: kein Wurf, kein Rennen, kein Sprung, kein Rollen – ruhige Fassungen', async () => {
  ruhe.matches = true;
  try {
    for (const F of FAELLE) {
      const { c, fr, g } = auf(F, 600, 248);
      const x0 = g ? g.style.left : null;
      const R = await spiel(c, F.name);
      assert.equal(R.fertig, true, titel(F));
      const log = c.log.join(' ');
      for (const k of ['kroll', 'kwig', 'fdash', 'nuzzle']) assert.equal(fr.el.classList.je.has(k), false, `${titel(F)}: ${k}`);
      assert.equal(c._el.pika.classList.je.has('purzel'), false);
      assert.equal(c.hopser, 0, `${titel(F)}: kein Sprung`);
      assert.equal(gebaut.flatMap((e) => e.fluege || []).length, 0, `${titel(F)}: nichts fliegt`);
      assert.equal(log.includes('Sprung binky'), false);
      if (F.name === 'fetchFriend') {
        // das Stöckchen wird hingetragen: Pika trägt, legt ab, Rufus trägt eine Runde, legt ab
        assert.ok(log.includes('+carry') && log.includes('„für dich!“') && log.includes('rufus „wuff!“') && log.includes('„guter Rufus!“'), log);
        assert.ok(fr.el.classList.je.has('carry') && fr.el.classList.je.has('walking'));
        assert.equal(gebaut.filter((e) => e.classList.je.has('ftoy')).length, 2, 'zweimal liegt es am Boden');
      } else if (F.name === 'pounceFriend') {
        // Katzumi tippt die Feder an und bekommt sie; das echte Wollknäuel bleibt, wo es liegt
        assert.ok(log.includes('„eine Feder!“') && log.includes('katzumi „mau!“') && log.includes('katzumi „hab es!“'), log);
        assert.ok(fr.el.classList.je.has('look-up') && fr.el.classList.je.has('carry'));
        if (g) assert.equal(g.style.left, x0, 'Wollknäuel unberührt');
      } else {
        // Kirby und der Pika sitzen nebeneinander und schunkeln
        assert.ok(log.includes('kirby „schunkel, schunkel!“') && (log.match(/\+lean/g) || []).length === 3, log);
        assert.ok(fr.el.classList.je.has('lean'));
        assert.equal(c._el.pika.classList.contains('left'), fr.el.classList.contains('left'), 'beide schauen in dieselbe Richtung');
      }
      assert.equal(c.planOps, 0);
      drin(c, `${titel(F)} ruhig`);
      sauber(c, fr, `${titel(F)} ruhig`);
    }
  } finally {
    ruhe.matches = false;
  }
  // der Stil lässt dann auch ruhen, was sich von selbst bewegt
  const stil = T.STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = stil.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.carry \.fdangle[^{}]*\{([^{}]*)\}/);
  assert.ok(m, 'Regel für „Bewegung reduzieren“');
  assert.match(m[1], /animation:\s*none/);
  for (const k of ['.friend.fdash .ear-l', '.friend.kwig .hop', '.friend.kroll .hop']) assert.ok(m[0].includes(k), k);
});

test('Freunde 0.44 auf jeder Kartengröße: alles bleibt auf der Wiese, auf schmalen Karten kürzer oder in der ruhigen Fassung', async () => {
  const gesehen = { wurf: 0, rolle: 0, schunkeln: 0, garn: 0, feder: 0 };
  for (const [W, Hs] of GROESSEN) {
    for (const F of FAELLE) {
      for (const [u, v] of [[0.2, 0.9], [0.8, 0.1], [0.5, 0.5]]) {
        for (const wert of [0.02, 0.5, 0.98]) {
          zufall.wert = wert;
          const { c, fr, g } = auf(F, W, Hs, { u, v });
          const was = `${titel(F)} auf ${W} × ${Hs}, Pika ${u}, Gast ${v}, Zufall ${wert}`;
          const R = await spiel(c, F.name);
          assert.equal(R.fertig, true, was);
          assert.ok(R.n >= 10 && R.n < 200, `${was}: ${R.n} Wartestellen`);
          drin(c, was);
          if (g) {
            const x = parseFloat(g.style.left);
            assert.ok(x >= c._g.fMin * W - 0.5 && x <= c._g.fMax * W + 0.5, `${was}: Knäuel bei ${x}`);
            gesehen[c._el.pika.classList.je.has('carry') ? 'feder' : 'garn']++;
          }
          if (F.name === 'fetchFriend' && gebaut.some((e) => e.fluege?.length)) gesehen.wurf++;
          if (F.name === 'rollFriend') gesehen[fr.el.classList.je.has('kroll') ? 'rolle' : 'schunkeln']++;
          sauber(c, fr, was);
        }
      }
    }
  }
  zufall.wert = 0.5;
  // Geworfen wird auf jeder dieser Karten (auf schmalen kürzer); gekullert und mit dem Wollknäuel gespielt nur, wo
  // Platz ist, sonst wird geschunkelt bzw. die Feder genommen
  for (const [k, n] of Object.entries(gesehen)) assert.ok(n > 0, `${k}: ${JSON.stringify(gesehen)}`);
  assert.equal(gesehen.wurf, GROESSEN.length * 9);
  // Ist die Wiese kürzer als ein Wurf (unter 0,7 Pika-Breiten), trägt der Pika das Stöckchen hin wie mit „Bewegung reduzieren“
  {
    const { c, fr } = auf(FAELLE[0], 600, 248);
    const x = fr.x;
    c._frRange = () => [x, x + c._g.pW * 0.9];
    const R = await spiel(c, 'fetchFriend');
    assert.equal(R.fertig, true);
    assert.equal(gebaut.flatMap((e) => e.fluege || []).length, 0, 'kein Wurf');
    assert.ok(c.log.join(' ').includes('„für dich!“') && !fr.el.classList.je.has('fdash'));
    drin(c, 'Stöckchen auf kurzer Wiese');
    sauber(c, fr, 'Stöckchen auf kurzer Wiese');
  }
  // 380 × 184 (Tablet-Kachel): geworfen und gekullert wird dort noch, nur kürzer als auf der breiten Karte
  const weite = async (W, Hs) => {
    const A = auf(FAELLE[0], W, Hs);
    await spiel(A.c, 'fetchFriend');
    const B = auf(FAELLE[3], W, Hs);
    await spiel(B.c, 'rollFriend');
    const xs = (c) => Math.max(...c.gastX.map((g) => g[0])) - Math.min(...c.gastX.map((g) => g[0]));
    return [xs(A.c) / A.c._g.pW, xs(B.c) / B.c._g.pW, gebaut.length];
  };
  const breit = await weite(600, 248);
  const schmal = await weite(380, 184);
  assert.ok(schmal[0] > 1 && schmal[0] < breit[0] && schmal[1] > 1.1 && schmal[1] < breit[1], `${schmal} gegen ${breit}`);
  klingeln();
});

test('Freunde 0.44 mit Tiefe (depth): gespielt wird vorn, wer hinten steht, kommt zuerst nach vorn', async () => {
  for (const F of FAELLE) {
    for (const still of [false, true]) {
      ruhe.matches = still;
      const { c, fr } = auf(F, 600, 248, { cfg: { depth: true } });
      // beide stehen auf der hinteren Spur
      const [l, r] = c._laneRange(c._g.pW);
      c._frSetX(fr, clamp(fr.x, l, r), 0, 'linear', 0, 1);
      c._lane = 1;
      c.gastX.length = 0;
      assert.equal(fr.el.classList.contains('lane1'), true);
      const spuren = [];
      const R = await spiel(c, F.name, { bei: (n) => spuren.push([n, fr.lane, c._lane]) });
      ruhe.matches = false;
      assert.equal(R.fertig, true);
      // der Gast geht als Erstes nach vorn (ein Weg auf der Stelle), der Pika mit seinem ersten Weg
      const gs = c.gastX.map((g) => g[1]);
      assert.ok(gs.indexOf(0) >= 0 && gs.indexOf(0) <= 1 && gs.slice(gs.indexOf(0)).every((ln) => ln === 0), `${titel(F)}: Spuren des Gasts ${gs}`);
      const ab = spuren.findIndex((s) => s[1] === 0 && s[2] === 0);
      assert.ok(ab >= 0 && ab <= 4, `${titel(F)}: beide vorn ab Wartestelle ${ab}`);
      assert.ok(spuren.slice(ab).every((s) => s[1] === 0 && s[2] === 0));
      assert.equal(fr.el.classList.contains('lane1'), false);
      assert.equal(fr.el.style.zIndex, String(T.buehneZ(0, 'pino')), 'Ebene der vorderen Spur');
      c._el.pika.classList.remove('lane1');
      sauber(c, fr, `${titel(F)} mit Tiefe`);
    }
  }
});

// ---------- Abbruch ----------

test('Freunde 0.44: an jeder Wartestelle abgebrochen bleibt nichts zurück – Füttern, Abschied nach der Uhr, Gast verschwunden', async () => {
  // 600 × 248: Wurf, Sprung, Rolle; 250 × 184: die ruhigen Fassungen aus Platzmangel; dazu „Bewegung reduzieren“
  const lagen = [[600, 248, false], [250, 184, false], [600, 248, true]];
  let laeufe = 0;
  for (const [W, Hs, still] of lagen) {
    for (const F of FAELLE) {
      ruhe.matches = still;
      const voll = auf(F, W, Hs);
      const { n } = await spiel(voll.c, F.name);
      sauber(voll.c, voll.fr, 'ganz');
      assert.ok(n >= 10, `${titel(F)}: ${n} Wartestellen`);
      for (let k = 0; k < n; k++) {
        // reihum: unterbrochen (Füttern, Schlafenszeit, Karte weg: _interrupt), der Gast geht nach der Uhr
        // (_friendLeave), der Gast ist weg (_friendGone: Tab unsichtbar, Größe geändert, abgeschaltet)
        const art = ['unterbrochen', 'Abschied', 'Gast weg'][k % 3];
        ruhe.matches = still;
        const { c, fr } = auf(F, W, Hs);
        const R = await spiel(c, F.name, art === 'unterbrochen' ? { stopp: k } : {
          bei: (i) => {
            if (i !== k) return;
            if (art === 'Abschied') c._friendLeave(true);
            else c._friendGone(fr);
          },
        });
        const was = `${titel(F)} auf ${W} × ${Hs}${still ? ', ruhig' : ''}, ${art} an Wartestelle ${k} von ${n}`;
        assert.equal(R.fertig, false, was);
        if (art === 'Abschied') assert.equal(fr.leaving, true);
        if (art === 'Gast weg') assert.equal(c._fr, null);
        sauber(c, fr, was);
        drin(c, was);
        laeufe++;
      }
    }
  }
  ruhe.matches = false;
  assert.ok(laeufe > 200, `${laeufe} Abbrüche geprüft`);
});

test('Freunde 0.44: jede Haltung, die ein Spiel setzt, wird auch wieder abgeräumt (FRIEND_CLS am Gast, _cleanup am Pika)', async () => {
  // (lnd: Nachwippen nach einem Weg, mit eigenem Zeitgeber; nuzzle und wiggle nimmt das finally in _withFriend)
  const raeumt = new Set(['walking', 'left', 'lnd', 'nuzzle', 'wiggle', ...[/const all = \[([\s\S]*?)\];/, /const ACT_CLS = \[([\s\S]*?)\];/, /const CUTE_CLS = \[([\s\S]*?)\];/]
    .flatMap((re, i) => [...quell(['karte/lebensschleife.js', 'logik/beschaeftigungen.js', 'logik/interaktion.js'][i]).match(re)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))]);
  assert.ok(raeumt.size > 80);
  const amGast = new Set();
  for (const still of [false, true]) {
    for (const F of FAELLE) {
      for (const wert of [0.1, 0.9]) {
        ruhe.matches = still;
        zufall.wert = wert;
        const { c, fr } = auf(F, 600, 248);
        await spiel(c, F.name);
        ruhe.matches = false;
        for (const k of c._el.pika.classList.je) assert.ok(raeumt.has(k), `${titel(F)}: Klasse ${k} am Pika räumt niemand ab`);
        for (const k of fr.el.classList.je) {
          if (['friend', `fr-${fr.kind}`, 'left', 'lane1'].includes(k)) continue;
          amGast.add(k);
          assert.ok(FRIEND_CLS.includes(k), `${titel(F)}: Klasse ${k} am Gast fehlt in FRIEND_CLS (_friendSettle nähme sie nicht weg)`);
        }
        klingeln();
      }
    }
  }
  zufall.wert = 0.5;
  // die Haltungen der eigenen Spiele kommen wirklich vor, und jede hat ihren Stil
  for (const k of ['carry', 'fdash', 'kwig', 'kroll', 'crosseye', 'lean']) {
    assert.ok(amGast.has(k), `${k} kam in keinem Spiel vor`);
    assert.ok(T.STYLES.includes(`.${k} `) || T.STYLES.includes(`.${k}.`) || T.STYLES.includes(`.${k},`), `Stil für .${k}`);
  }
  // Spielzeug steckt nie in den Figuren (es erschiene im Tagebuch und läge in einer ausgeblendeten Gruppe)
  for (const svg of [KIRBY_SVG, RUFUS_SVG, KATZUMI_SVG]) assert.doesNotMatch(svg, /fdangle|#b98a55|ftoy/);
});

test('Freunde 0.44: gewürfelt wird je Gerät wie bei den gemeinsamen Spielen, nichts steht im Plan – und was aus der Uhr kommt, würfelt nicht', async () => {
  // die gemeinsamen Spiele nehmen rnd, pick und Math.random (jedes Gerät für sich), die eigenen ebenso: kein seedRnd
  const pino = quell('karte/pino.js');
  const rumpf = (n) => pino.slice(pino.indexOf(`\n  async _${n}(`)).match(/\{([\s\S]*?)\n  \}\n/)[1];
  for (const n of ['chaseFriend', 'sitWithFriend', 'squeakDuet']) assert.match(rumpf(n), /Math\.random|\brnd\(|\bpick\(/, `${n} würfelt frei`);
  for (const n of [...SPIELE, 'frYarnHunt', 'frDangleHunt', 'frSway']) {
    assert.doesNotMatch(rumpf(n), /seedRnd|seeded\(|_planOp|_memo\(/, `${n}: nichts aus der Uhr, nichts in den Plan`);
  }
  // derselbe Zufall, derselbe Ablauf (nichts hängt an der echten Uhr oder an der Reihenfolge der Zeitgeber)
  for (const F of FAELLE) {
    const logs = [];
    for (let i = 0; i < 2; i++) {
      zufall.wert = 0.37;
      const t0 = jetzt;
      const { c } = auf(F, 600, 248);
      await spiel(c, F.name);
      logs.push(JSON.stringify([c.log, c.gastLog, c.pikaX, c.gastX, c.zeug, jetzt - t0]));
      klingeln();
    }
    assert.equal(logs[0], logs[1], titel(F));
    // anderer Zufall, anderer Ablauf: Es wird wirklich gewürfelt
    zufall.wert = 0.93;
    const { c } = auf(F, 600, 248);
    await spiel(c, F.name);
    klingeln();
    assert.notEqual(JSON.stringify([c.log, c.gastLog, c.pikaX, c.gastX, c.zeug]), JSON.stringify(JSON.parse(logs[0]).slice(0, 5)), `${titel(F)}: anderer Zufall, derselbe Ablauf`);
  }
  zufall.wert = 0.5;
  // Wer zu Besuch kommt und welches Motiv er malt, steht mit der Uhr fest: Dort wird Math.random nie gefragt
  const c = buehne();
  zufall.n = 0;
  for (let k = 0; k < 200; k++) T.friendKind(T.seedRnd('friend', k, 4));
  c._fr = { kind: 'kirby' };
  for (let i = 0; i < 50; i++) c._paintMotif(i / 50, (i * 7 % 50) / 50);
  assert.equal(zufall.n, 0);
});

// ---------- Träume ----------

// Eine Zeichnung aus einzelnen Tags: jedes geöffnete wird geschlossen, keine ids, keine kaputten Zahlen
const zeichnung = (svg, was, [lo, hi]) => {
  assert.doesNotMatch(svg, /NaN|undefined|Infinity|<!--|\bid="/, was);
  const offen = [];
  for (const [, zu, tag, , leer] of svg.matchAll(/<(\/)?([a-zA-Z]+)((?:"[^"]*"|[^>"])*?)(\/)?>/g)) {
    if (zu) assert.equal(offen.pop(), tag, `${was}: </${tag}>`);
    else if (!leer) offen.push(tag);
  }
  assert.deepEqual(offen, [], `${was}: offene Tags`);
  // Koordinaten: Absolute Punkte der Pfade (M, L, Q) und Mitten der Kreise liegen im Feld
  const zahlen = [];
  for (const [, d] of svg.matchAll(/\sd="([^"]+)"/g)) {
    for (const [, x, y] of d.matchAll(/[MLQ]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) zahlen.push(Number(x), Number(y));
  }
  for (const [, v] of svg.matchAll(/\sc[xy]="(-?[\d.]+)"/g)) zahlen.push(Number(v));
  assert.ok(zahlen.length >= 12, `${was}: nur ${zahlen.length} Zahlen gefunden`);
  for (const v of zahlen) assert.ok(Number.isFinite(v) && v >= lo && v <= hi, `${was}: ${v} außerhalb ${lo} … ${hi}`);
};

test('Träume: alle vier Freunde haben ein eigenes Bild in der Traumblase, sauber gezeichnet und zu unterscheiden', () => {
  const c = buehne();
  for (const k of T.FRIEND_KEYS) {
    assert.ok(T.MEM_BITS.includes(k), `Erlebnis-Bit ${k}`);
    assert.equal(typeof DREAM[k], 'string', `DREAM.${k}`);
    assert.match(DREAM[k], /^<svg viewBox="0 0 24 24"[^>]*>[\s\S]*<\/svg>$/);
    zeichnung(DREAM[k], `Traumbild ${k}`, [0, 24]);
    // das gebaute Bündel zeigt genau dieses Bild
    assert.equal(c._dreamSvg(k), DREAM[k], `Bündel: ${k}`);
  }
  assert.equal(new Set(T.FRIEND_KEYS.map((k) => DREAM[k])).size, 4);
  for (const k of NEUE) {
    assert.equal(DREAM[k], `<svg viewBox="0 0 24 24">${FRIEND_FACE[k]}</svg>`);
    // Augen, Nase und ein Umriss
    assert.equal((FRIEND_FACE[k].match(/fill="#2a1a12"/g) || []).length, 2, `${k}: zwei Augen`);
    assert.match(FRIEND_FACE[k], /stroke="#5a4030"/);
  }
  // woran man sie im Kleinen erkennt
  assert.ok(FRIEND_FACE.kirby.includes('#3b2218') && FRIEND_FACE.kirby.includes('#e4bf85'), 'Kirby: dunkle Nase, helle Bärenohren');
  assert.equal((FRIEND_FACE.rufus.match(/fill="#2b1c15"/g) || []).length, 2, 'Rufus: zwei Schlappohren mit dunklem Innern');
  assert.ok(FRIEND_FACE.katzumi.includes('#a9592b') && FRIEND_FACE.katzumi.includes('stroke="#c9d46c"') && FRIEND_FACE.katzumi.includes('#f2a6b4'),
    'Katzumi: Stirnstreifen, Augen mit gelbgrünem Rand, rosa Ohren');
  // Kirbys Rand ist zottelig, Rufus’ lockig: viele Bögen statt einer Ellipse
  for (const k of ['kirby', 'rufus']) assert.ok((FRIEND_FACE[k].match(/ Q/g) || []).length >= 11, `${k}: Büschel`);
});

test('Träume: Er träumt von dem Freund, der da war (dreimal so oft wie von Löwenzahn), und murmelt dessen Namen', async () => {
  const tag = T.pikaDay(jetzt);
  const bit = (...ks) => ks.reduce((m, k) => m | (1 << T.MEM_BITS.indexOf(k)), 0);
  const name = (svg) => Object.keys(DREAM).find((k) => DREAM[k] === svg);
  const traeume = (m, d = tag) => {
    const c = buehne();
    c._plan = { cute: { d, n: 0, m } };
    const n = {};
    for (let i = 0; i < 2000; i++) {
      zufall.wert = (i + 0.5) / 2000;
      const k = name(c._dreamSvg());
      n[k] = (n[k] || 0) + 1;
    }
    zufall.wert = 0.5;
    return n;
  };
  for (const k of T.FRIEND_KEYS) {
    const n = traeume(bit(k));
    assert.deepEqual(Object.keys(n).sort(), ['heart', 'klee', 'lz', k].sort(), `nur ${k} war da`);
    assert.ok(Math.abs(n[k] / n.lz - 3) < 0.05, `${k}: ${n[k]} gegen ${n.lz} Löwenzahn`);
  }
  // zwei waren da: von beiden gleich oft; war keiner da, träumt er von keinem
  const zwei = traeume(bit('kirby', 'katzumi'));
  assert.ok(Math.abs(zwei.kirby - zwei.katzumi) <= 2 && !zwei.rufus && !zwei.pino, JSON.stringify(zwei));
  assert.deepEqual(Object.keys(traeume(0)).sort(), ['heart', 'klee', 'lz']);
  // gestern zählt noch (er schläft über 4 Uhr hinweg), vorgestern nicht mehr
  assert.ok(traeume(bit('rufus'), tag - 1).rufus > 0);
  assert.equal(traeume(bit('rufus'), tag - 2).rufus, undefined);
  // die Vorschau legt das Motiv fest; Unbekanntes würfelt wie sonst
  const c = buehne();
  assert.equal(c._dreamSvg('katzumi'), DREAM.katzumi);
  assert.ok(Object.values(DREAM).includes(c._dreamSvg('gibtsnicht')));
  assert.ok(Object.values(DREAM).includes(c._dreamSvg(true)));
  assert.ok(Object.values(DREAM).includes(c._dreamSvg('constructor')));

  // Murmeln: der Name dessen, der heute da war; sonst Pino (friend_name), nie einfach der letzte Gast dieses Geräts
  const murmelt = async (cute, cfg = {}, wer = null) => {
    const k = buehne(600, 248, cfg);
    Object.assign(k, { _plan: { cute }, _asleep: true, _dbgDream: false, _frWho: wer, _wait: async () => {}, _cls() {} });
    // Zufall 0,7: im Schlaf wird gemurmelt, und zwar der vierte von fünf Sprüchen (der Name)
    zufall.wert = 0.7;
    await k._dream();
    zufall.wert = 0.5;
    return k.log.join(' ');
  };
  assert.equal(await murmelt({ d: tag, n: 0, m: bit('rufus') }), '„Rufus…“');
  assert.equal(await murmelt({ d: tag, n: 0, m: bit('katzumi') }, {}, 'Kirby'), '„Katzumi…“');
  assert.equal(await murmelt({ d: tag, n: 0, m: bit('pino') }, { friend_name: 'Fips' }), '„Fips…“');
  assert.equal(await murmelt({ d: tag, n: 0, m: 0 }, {}, 'Katzumi'), '„Pino…“', 'niemand war da: nicht der letzte Gast von irgendwann');
  assert.equal(await murmelt({ d: tag - 3, n: 0, m: bit('kirby') }), '„Pino…“', 'vor drei Tagen zählt nicht');
  assert.equal(await murmelt(null), '„Pino…“');
  // kommt kein Freund zu Besuch (friend: false), murmelt er von keinem
  assert.equal(await murmelt({ d: tag, n: 0, m: bit('rufus') }, { friend: false }), '„zzz… Löwenzahn…“');
  // mehrere waren da: einer von ihnen
  const c2 = buehne();
  c2._plan = { cute: { d: tag, n: 0, m: bit('kirby', 'rufus', 'pino') } };
  const namen = new Set();
  for (const w of [0.01, 0.4, 0.99]) {
    zufall.wert = w;
    namen.add(c2._frMumble());
  }
  zufall.wert = 0.5;
  assert.deepEqual([...namen].sort(), ['Kirby', 'Pino', 'Rufus']);
});

// ---------- Staffelei ----------

test('Malen: Er malt den Freund, der gerade da ist – die Liste ist so lang und so geordnet wie bis 0.43', () => {
  const c = buehne();
  // bis 0.43: an der Stelle des Gasts stand immer 'pino'
  const alt = (u, u2, da, flieger) => {
    const m = ['blume', 'pika', 'bau', 'regenbogen'];
    if (da || u2 < 0.15) m.push('pino');
    if (flieger) m.push('flieger', 'flieger');
    return m[Math.floor(u * m.length)];
  };
  for (const flieger of [false, true]) {
    c._planes = new Map(flieger ? [['a', { show: true, gone: false }]] : []);
    for (const kind of [null, ...T.FRIEND_KEYS]) {
      c._fr = kind ? { kind } : null;
      const gemalt = new Set();
      for (let i = 0; i < 40; i++) {
        for (const u2 of [0.05, 0.5]) {
          const u = (i + 0.5) / 40;
          const war = alt(u, u2, !!kind, flieger);
          const ist = c._paintMotif(u, u2);
          assert.equal(ist, war === 'pino' && kind ? kind : war, `${kind}, u ${u}, u2 ${u2}, Flieger ${flieger}`);
          gemalt.add(ist);
        }
      }
      // der Gast ist dabei, kein anderer Freund
      for (const k of T.FRIEND_KEYS) assert.equal(gemalt.has(k), k === (kind || 'pino'), `${kind}: ${k} gemalt`);
    }
  }
  // ein Gast, den die Staffelei nicht kennt (eine spätere Version): wie bisher Pino
  c._planes = new Map();
  c._fr = { kind: 'bello' };
  assert.equal(c._paintMotif(0.9, 0.5), 'pino');
  // Vorschau: einmal genau dieses Motiv, danach wieder gewürfelt
  c._fr = null;
  c._dbgMotif = 'rufus';
  assert.equal(c._paintMotif(0.01, 0.5), 'rufus');
  assert.equal(c._paintMotif(0.01, 0.5), 'blume');
  c._dbgMotif = 'unsinn';
  assert.equal(c._paintMotif(0.01, 0.5), 'blume');
});

test('Malen: die neuen Motive – kurze Namen, saubere Bilder auf der Leinwand und im Tagebuch', () => {
  for (const k of NEUE) {
    assert.ok(k.length <= 7, `${k}: höchstens 7 Zeichen im Tagesplan`);
    assert.ok(T.hasKey(EASEL_MOTIF, k), `EASEL_MOTIF.${k}`);
    assert.ok(T.hasKey(FRIENDS, k) && T.hasKey(DIARY_TXT.motif, k));
    const [farbe, bild] = EASEL_MOTIF[k];
    assert.match(farbe, /^#[0-9a-f]{6}$/);
    // der Kopf aus der Traumblase, verkleinert an der Stelle von Pinos Kopf: ganz auf der Leinwand (x 9–51, y 7–51)
    const m = bild.match(/^<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">([\s\S]*)<\/g>$/);
    assert.ok(m, k);
    assert.equal(m[4], FRIEND_FACE[k]);
    const [tx, ty, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
    assert.ok(tx >= 9 && tx + 24 * s <= 51 && ty >= 7 && ty + 24 * s <= 51, `${k}: ${tx} ${ty} ${s}`);
    zeichnung(bild, `Motiv ${k}`, [0, 24]);
    // Staffelei: fünf Schichten wie immer, eine einzige id (der Ausschnitt der Leinwand), das Motiv in der vierten
    const svg = EASEL_SVG(k);
    assert.deepEqual([...svg.matchAll(/id="([^"]+)"/g)].map((x) => x[1]), ['cvclip']);
    assert.equal((svg.match(/<g class="cvl">/g) || []).length, 5);
    assert.equal(svg.split('<g class="cvl">')[4].startsWith(bild), true);
    assert.equal((svg.match(/<g[\s>]/g) || []).length, (svg.match(/<\/g>/g) || []).length);
    // Tagebuch: dasselbe Bild zum Einkleben
    const pic = diaryPainting(k);
    assert.match(pic, /^<svg class="pic" viewBox="9 7 42 44"/);
    assert.ok(pic.includes(bild) && pic.endsWith('</svg>'));
    assert.doesNotMatch(pic, /\bid="/);
  }
  assert.equal(diaryPainting('gibtsnicht'), '');
  assert.equal(diaryPainting('constructor'), '');
  // die alten Motive sind unverändert da
  assert.deepEqual(Object.keys(EASEL_MOTIF), ['blume', 'pika', 'pino', 'bau', 'flieger', 'regenbogen', ...NEUE]);
  assert.ok(Math.max(...Object.keys(EASEL_MOTIF).map((k) => k.length)) === 'regenbogen'.length);
  assert.deepEqual(plain(DIARY_TXT.motif), {
    blume: 'eine Blume', pika: 'mich selbst', pino: '{n}', bau: 'meinen Bau', flieger: 'ein Flugzeug', regenbogen: 'einen Regenbogen',
    kirby: 'Kirby', rufus: 'Rufus', katzumi: 'Katzumi',
  });
  for (const k of NEUE) assert.equal(DIARY_TXT.motif[k], FRIENDS[k].name);
});

// Ein Plan, in dem alles steht (wie fullPlan35 in pika.test.mjs), mit allen Erlebnis-Bits bis katzumi
const NOW = Date.UTC(2026, 10, 11, 12);
const sek = (t) => Math.round(t / 1000) * 1000;
const vollerPlan = (rec) => ({
  hay: { n: 12, t: sek(NOW), c: '012340123401', m: Math.floor(NOW / 240000) },
  fl: { t: sek(NOW - 6e5), c: 3, x: 77, k: true },
  sport: { d: Math.floor(NOW / 864e5), k: Math.floor(NOW / 840000) },
  fd: [{ t: sek(NOW - 3000), x: 12, k: 0, e: false }, { t: sek(NOW - 2000), x: 55, k: 1, e: true }, { t: sek(NOW - 1000), x: 99, k: 1, e: false }],
  rec,
  cute: { d: Math.floor(NOW / 864e5), n: 99, m: (1 << T.MEM_BITS.length) - 1 },
  fu: sek(NOW + 6e5),
  gift: { k: sek(NOW - 30 * 864e5), a: 999, p: sek(NOW - 36e5), n: 3, u: 255, v: 0xffff, z: 999, o: 999, b: sek(NOW - 6e5), x: sek(NOW - 9e5), y: 2, d: 99, i: 31, f: 1500, r: 35 },
  ur: { t: sek(NOW - 9 * 864e5), d: 30 * 864e5 },
});

test('Tagesplan: die neuen Motive kommen heil hin und zurück, und ein voller Plan passt weiter in den Helfer', () => {
  const k = Math.floor(NOW / 840000);
  for (const motiv of NEUE) {
    const s = T.planSer(vollerPlan([[k, 'paint', motiv], [k - 1, 'bubbles', ''], [k - 2, 'tablet', ''], [k - 3, 'music', '']]));
    assert.ok(s.includes(`:paint:${motiv}`), s);
    const P = T.planParse(s);
    assert.deepEqual(plain(P.rec[0]), [k, 'paint', motiv]);
    assert.equal(T.planSer(P), s);
    assert.ok(s.length <= 255, `${motiv}: ${s.length} Zeichen`);
    // kürzer als mit dem längsten alten Motiv
    assert.ok(s.length < T.planSer(vollerPlan([[k, 'paint', 'regenbogen'], [k - 1, 'bubbles', ''], [k - 2, 'tablet', ''], [k - 3, 'music', '']])).length);
    // wer das Fenster zuerst malt, trägt das Motiv ein; ein zweites Gerät überschreibt es nicht
    const A = T.planApply(T.planBlank(NOW), { t: 'rec', k, a: 'paint', v: motiv }, NOW);
    assert.deepEqual(plain(T.planApply(A, { t: 'rec', k, a: 'paint', v: 'pino' }, NOW).rec), [[k, 'paint', motiv]]);
  }
  // Schlimmster Fall: viermal Malen mit dem längsten neuen Namen. Die Karte lässt notfalls ältere Einträge weg.
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { plan_entity: 'input_text.p' };
  c._hass = { states: { 'input_text.p': { state: '', attributes: { max: 255 } } } };
  const F = c._planFit(vollerPlan([0, 1, 2, 3].map((i) => [k - i, 'paint', 'katzumi'])));
  assert.ok(T.planSer(F).length <= 255 && F.rec.length >= 3, `${T.planSer(F).length} Zeichen, ${F.rec.length} im Verlauf`);
  assert.ok(T.PLAN_MIN <= 255);
});

test('Tagebuch: „Ich hab Kirby gemalt“ – für jedes Motiv der Satz mit dem Namen und das Bild zum Einkleben', async () => {
  const W = welt({ start: new Date(2026, 5, 12, 15).getTime() });
  const t0 = W.jetzt();
  W.ha.setze(PLAN, W.T.planSer(W.T.planBlank(t0)), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, W.T.serialize({ ...W.T.freshStats(t0), s: 80, g: 80 }), 'anfang', { max: 100 });
  const K = W.karte('K', { friend_name: 'Fips' });
  await W.vor(1000);
  const d0 = K.c._diaryDay(0);
  const eintrag = (v) => {
    const M = K.c._diaryModel(d0, W.jetzt() + 1, { ev: [{ t: t0 - 36e5, k: 'act', a: 'paint', v }], stamps: [], pets: {}, data: true }, [], true, false);
    const e = M.entries.filter((x) => x.icon === 'paint');
    assert.equal(e.length, 1, `${v}: ${M.entries.map((x) => x.icon)}`);
    return e[0];
  };
  for (const [v, wen] of [['kirby', 'Kirby'], ['rufus', 'Rufus'], ['katzumi', 'Katzumi'], ['pino', 'Fips'], ['blume', 'eine Blume']]) {
    const e = eintrag(v);
    assert.match(e.text, new RegExp(`(Ich hab|und) ${wen} gemalt`), e.text);
    assert.doesNotMatch(e.text, /\{[mn]\}/);
    assert.equal(e.pic, diaryPainting(v), `${v}: Bild`);
    if (NEUE.includes(v)) assert.ok(e.pic.includes(FRIEND_FACE[v]));
  }
  // ein Motiv, das diese Karte nicht kennt: ein Satz ohne Bild
  const fremd = eintrag('bello');
  assert.equal(fremd.text, 'Ein Bild gemalt. Was drauf ist, verrate ich nicht.');
  assert.equal(fremd.pic, '');
});

test('Malen mit einem Gerät, das noch 0.43.0 zeigt: Das neue Motiv bleibt im Plan, dort malt er etwas anderes und verrät im Tagebuch nichts',
  { skip: ALT ? false : 'git show 73c7868:pika-pet-card.js nicht möglich' }, async () => {
    let TA = null;
    laden(ALT, 'pika-pet-card-0.43.0.js', (x) => (TA = x));
    assert.equal(TA.VERSION, '0.43.0');
    const k = Math.floor(NOW / 840000);
    for (const motiv of NEUE) {
      // lesen und wieder schreiben: unverändert (das alte Gerät verliert den Namen nicht)
      const s = T.planSer(vollerPlan([[k, 'paint', motiv], [k - 1, 'music', '']]));
      const P = TA.planParse(s);
      assert.ok(P, 'das alte Gerät versteht den Plan');
      assert.deepEqual(plain(P.rec[0]), [k, 'paint', motiv]);
      assert.equal(TA.planSer(P), s);
      // Es malt dann sein eigenes Motiv (dort stand an der Stelle des Gasts 'pino') und meldet es, der Eintrag bleibt
      const danach = TA.planApply(P, { t: 'rec', k, a: 'paint', v: 'pino' }, NOW);
      assert.deepEqual(plain(danach.rec[0]), [k, 'paint', motiv]);
    }
    // Szene: Das alte Gerät nimmt ein Motiv aus dem Plan nur, wenn es das kennt, sonst würfelt es mit denselben Zahlen
    assert.match(ALT, /own && hasKey\(EASEL_MOTIF, own\[2\]\) \? own\[2\] : this\._paintMotif\(/);
    const alt = Object.create(TA.PikaPetCard.prototype);
    Object.assign(alt, { _planes: new Map(), _fr: { kind: 'kirby' } });
    const neu = buehne();
    neu._fr = { kind: 'kirby' };
    for (let i = 0; i < 20; i++) {
      const u = (i + 0.5) / 20;
      const a = alt._paintMotif(u, 0.5);
      assert.equal(neu._paintMotif(u, 0.5), a === 'pino' ? 'kirby' : a, `u ${u}: sonst dasselbe Motiv auf beiden`);
    }
    // Tagebuch des alten Geräts: ein Satz ohne Bild, kein Fehler
    const W = welt({ start: new Date(2026, 5, 12, 15).getTime(), alt: ALT });
    const t0 = W.jetzt();
    W.ha.setze(PLAN, W.T.planSer(W.T.planBlank(t0)), 'anfang', { max: 255 });
    W.ha.setze(ZUSTAND, W.T.serialize({ ...W.T.freshStats(t0), s: 80, g: 80 }), 'anfang', { max: 100 });
    const K = W.karte('alt', {}, { alt: true });
    await W.vor(1000);
    for (const motiv of NEUE) {
      const M = K.c._diaryModel(K.c._diaryDay(0), W.jetzt() + 1, { ev: [{ t: t0 - 36e5, k: 'act', a: 'paint', v: motiv }], stamps: [], pets: {}, data: true }, [], true, false);
      const e = M.entries.filter((x) => x.icon === 'paint');
      assert.equal(e.length, 1);
      assert.equal(e[0].text, 'Ein Bild gemalt. Was drauf ist, verrate ich nicht.');
      assert.equal(e[0].pic, '');
    }
    W.pruefe();
  });

// ---------- Vorschau ----------

test('Vorschau: Knöpfe für die drei eigenen Spiele (der passende Freund kommt zuerst), für jedes Traumbild und jedes Freund-Motiv', () => {
  const leiste = (id) => vorschau.match(new RegExp(`<div class="bar" id="${id}">([\\s\\S]*?)</div>`))[1];
  const fr = leiste('bar-friend');
  for (const [kind, spielName] of Object.entries(FRIEND_GAME)) {
    assert.match(fr, new RegExp(`<button data-frg="${spielName}" data-frgk="${kind}">`), spielName);
  }
  for (const k of T.FRIEND_KEYS) {
    assert.match(fr, new RegExp(`<button data-frm="${k}">`), `malen: ${k}`);
    assert.match(leiste('bar-cute'), new RegExp(`<button data-dream="${k}">`), `Traum: ${k}`);
  }
  // der falsche Gast verschwindet, der richtige kommt, dann erst die Aktion
  assert.match(vorschau, /c\._fr\.kind !== kind[^\n]*c\._friendGone\(c\._fr\)/);
  assert.match(vorschau, /frHol\(c, b\.dataset\.frgk\);\s*c\._next = b\.dataset\.frg;/);
  assert.match(vorschau, /c\._dbgMotif = b\.dataset\.frm;\s*c\._next = 'paint';/);
  assert.match(vorschau, /c\._dbgDream = b\.dataset\.dream;/);
});
