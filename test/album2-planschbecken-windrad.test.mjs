// Planschbecken neben dem Windrad auf 380 px (Review 0.48.1): In der Vorschau steht das Windrad rechts vom Heu
// (offsetLeft 162, 26 breit), das Becken passt nur rechts davon, und er steht links zwischen beiden. Die Grenze dafür
// rechnete _a2PoolSpot als hayR + 0,15 pW + gap und prüfte sie mit x - gap ≥ hayR + 0,15 pW: Durch Rundung fiel das
// knapp darunter, das Becken lag über dem Windrad, und _a2Room bot es von selbst nie an. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class El {
  constructor() {
    this.cls = new Set();
    this.classList = { add: (...k) => k.forEach((x) => this.cls.add(x)), remove: (...k) => k.forEach((x) => this.cls.delete(x)), contains: (k) => this.cls.has(k), toggle() {} };
    this.style = { setProperty() {}, removeProperty() {} };
    this.offsetLeft = 0;
    this.offsetWidth = 0;
    this.parentElement = null;
  }
}

let T = null;
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), {
  window: { matchMedia: () => ({ matches: false }), customCards: [] },
  document: { addEventListener() {}, removeEventListener() {}, createElement: () => new El() },
  HTMLElement: class {}, customElements: { get: () => null, define() {} }, console: { info() {}, log() {}, warn() {}, debug() {} },
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, queueMicrotask, Date, Math, JSON, Promise, Intl,
  AbortController, performance, __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });

// Geometrie der schmalen Karte (380 × 184, wie _layout; hayR genau so, dass die Rundung zuschlägt)
const G = { W: 380, H: 184, gy: 165.6, pW: 88.32, pH: 73.6, hayR: 165.21, hole: { l: 52.1, r: 89.8, cx: 70.9 }, rock: { l: 259.6, w: 110.4, cx: 314.8, lift: 36.4, ku: 1.104 }, xR: 340.3 };

const karte = (wheel = true) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const gifts = new El();
  const wh = new El();
  Object.assign(wh, { offsetLeft: 162, offsetWidth: 26, parentElement: gifts });
  Object.assign(c, {
    _cfg: { gifts: true }, _W: G.W, _H: G.H, _g: { gy: G.gy, pW: G.pW, pH: G.pH, hayR: G.hayR, hole: G.hole, rock: G.rock, xR: G.xR },
    _el: { gifts }, _gtEls: new Map(wheel ? [[1, wh]] : []), _a2Els: new Map(), _festPos: {},
    _poops: () => ({ piles: [] }), _groundSpot: (u, w2) => ({ x: (G.hayR + G.rock.l) / 2, w: w2 }),
  });
  return c;
};

test('Planschbecken (380 px, Windrad rechts vom Heu): liegt rechts vom Windrad, er steht links daneben, von selbst angeboten', () => {
  const c = karte();
  const P = c._a2PoolSpot();
  const msg = JSON.stringify(P);
  const rand = 162 + 26 + G.H * 0.015; // (rechter Rand der Sperre des Windrads)
  assert.ok(P.cx - P.w / 2 >= rand - 0.01, `nicht über dem Windrad ${msg}`);
  assert.equal(P.side, -1, `er steht links ${msg}`);
  assert.ok(P.sx >= G.hayR + G.pW * 0.15 - 0.02 && P.sx < P.cx - P.w / 2, `zwischen Heu und Becken ${msg}`);
  assert.ok(P.cx + P.w / 2 <= G.W, `im Bild ${msg}`);
  assert.ok(c._a2Room(P.cx, P.w, 'pool'), 'Platz genug: _a2PoolActs bietet es an');
});

test('Planschbecken (380 px, ohne Windrad): wie bisher', () => {
  const P = karte(false)._a2PoolSpot();
  assert.ok(P.side !== 0 && P.cx + P.w / 2 <= G.W);
});
