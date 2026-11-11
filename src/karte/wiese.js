// Wiese: Blumen, Futter, Heu und Blütenvorrat

import { rnd, pick, clamp, seedRnd } from '../logik/hilfen.js';
import { GAIN, SELF, sec } from '../logik/zustand.js';
import {
  FLOWER_COLORS, hexRgb, rgbHex, dimRgb, seasonKey, FLOWER_SEASON, FLOWER_SEASON_ALPIN, flowerMid,
} from '../logik/wetter.js';
import { HAY_MAX, FOOD_KINDS, hayNow } from '../logik/tagesplan.js';
import { STASH_MAX, FLOWER_SVG, HAY_BITE, FOOD } from '../grafik/szene.js';

export class Wiese {
  async _haySnack() {
    await this._walkTo(this._g.stand);
    this._face(-1);
    await this._wait(300);
    await this._eat('#dcbc6a', rnd(2500, 3500), HAY_BITE);
    this._selfFed(SELF.hay);
    await this._wait(rnd(300, 900));
  }

  async _nibble() {
    const f = this._nearestFlower();
    if (!f) return;
    await this._approach(f.xf * this._W);
    await this._sniffPick(f);
    await this._eat(f.color, rnd(2500, 4000));
    this._selfFed(SELF.flower);
    if (Math.random() < 0.4) this._cls('mlem', 950, true);
    await this._wait(rnd(300, 900));
  }

  // Eine Blüte für den Vorrat holen (kleine Beschäftigung aus dem Tagesplan). Die Farbe steht mit dem Fenster
  // fest, damit alle Geräte dieselbe Blüte in die Nische legen; hat dieses Gerät keine Blume der Farbe auf der
  // Wiese, pflückt er die nächste. Sie behält auf der Wiese ihre Farbe (früher färbte sie sich um, während er noch
  // hinlief); erst die gepflückte Blüte im Maul hat die Farbe des Fensters.
  async _gather() {
    const S = this._slotFor('gather');
    const pal = this._flowerPal();
    const ci = Math.floor(S.r(2) * pal.length);
    const color = pal[ci];
    if (this._inside) await this._comeOut();
    const f = this._flowers.filter((o) => o.color === color)
      .sort((a, b) => Math.abs(a.xf * this._W - this._x) - Math.abs(b.xf * this._W - this._x))[0]
      || this._nearestFlower();
    if (f) {
      await this._approach(f.xf * this._W);
      await this._sniffPick(f);
    }
    this._mouth(color);
    this._el.pika.classList.add('carry');
    await this._walkTo(this._g.stand);
    this._face(-1);
    await this._wait(350);
    // Blüte im Bogen auf den Haufen bzw. in die Nische werfen, dort bleibt sie liegen
    this._el.pika.classList.remove('carry');
    this._mouth(null);
    this._toss(color, this._haySpot(Math.min(this._blooms.length, HAY_MAX - 1)));
    await this._wait(460);
    this._planOp({ t: 'gather', m: S.k >= 0 ? S.k : null, c: String(ci) });
    await this._wait(900);
  }

  // Stelle i auf der Oberfläche des Heuhaufens (Koordinaten der Heu-Grafik, 60 × 40), fest je Platz
  _haySpot(i) {
    const sx = 15 + seedRnd('hay', i, 0) * 30;
    const top = 10 + ((sx - 30) / 28) ** 2 * 26;
    const lo = top + 3;
    return { sx: +sx.toFixed(1), sy: +(lo + seedRnd('hay', i, 1) * (Math.min(35, top + 11) - lo)).toFixed(1) };
  }

  // Liegeplätze der Blüten in der Nische (Bau-Einheiten): Reihen von unten nach oben, abwechselnd 6 und 5
  _stashSlots() {
    const S = this._areal().stash;
    if (!S) return [];
    const F = this._areal().vh - this._areal().sink;
    const P = [];
    for (let row = 0; P.length < STASH_MAX; row++) {
      for (let k = 0; k < 6 - (row % 2) && P.length < STASH_MAX; k++) {
        P.push([S.x1 + 3.2 + (row % 2) * 1.5 + k * 2.75, F - 3.6 - row * 1.7 + (k % 2 ? 0.25 : -0.15)]);
      }
    }
    return P;
  }

  _toss(color, spot) {
    const { pW, pH, gy, hay } = this._g;
    const x0 = this._x + this._dir * 0.4 * pW;
    const y0 = gy - pH * 0.335 - this._lift;
    let dx;
    let dy;
    if (this._g.stash) {
      // Ziel: der Platz, auf dem die Blüte gleich in der Nische liegt
      const { l, u, base } = this._g.bur;
      const [bx, by] = this._stashSlots()[Math.min(this._blooms.length, STASH_MAX - 1)];
      dx = l + bx * u - x0;
      dy = base + by * u - y0;
    } else {
      // Ziel bei der Größe, die der Haufen gleich hat
      const hW = this._g.hW;
      const hs = 0.4 + Math.min(12, this._hay + 1) * 0.055;
      dx = hay + ((spot.sx - 30) / 60) * hW * hs - x0;
      dy = gy + 4 - ((40 - spot.sy) / 40) * hW * (2 / 3) * hs - y0;
    }
    const el = document.createElement('span');
    el.className = 'toss';
    el.innerHTML = `<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.4" fill="${color}" stroke="rgba(0,0,0,.15)" stroke-width=".6"/>`
      + '<circle cx="5" cy="5" r="1.6" fill="#e0a032" opacity=".8"/></svg>';
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    this._el.fx.appendChild(el);
    el.animate([
      { transform: 'translate(0, 0) rotate(0deg)' },
      { transform: `translate(${dx * 0.5}px, ${Math.min(dy, 0) - pH * 0.28}px) rotate(200deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(.75)` },
    ], { duration: 460, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(() => el.remove(), 480);
  }

  async _eatFood(food) {
    this._say('!');
    await this._wait(400);
    await this._approach(food.xf * this._W, 1.6);
    if (!this._foods.includes(food)) return;
    this._removeFood(food);
    // Gefressen gilt für alle Geräte: Wer später dazukommt (oder gerade schläft, nicht zu sehen ist), zeigt es nicht mehr
    if (food.t != null) {
      (this._foodDone ??= new Set()).add(food.t);
      this._planOp({ t: 'fate', ft: food.t });
    }
    await this._eat(FOOD[food.kind].color, 3800);
    this._memo(food.kind);
    this._cls('mlem', 950, true); // Zungenspitze: lecker
    // Zu hastig gefressen: gleich Schluckauf
    if (Math.random() < 0.25) this._hicDue = true;
    await this._wait(500);
    this._happy();
    this._jump('hop1');
    await this._wait(1300);
  }

  _onFeed() {
    if (!this._g) return;
    if (this._foods.length >= 3) {
      const b = this._el.feed;
      b.classList.remove('no');
      void b.offsetWidth;
      b.classList.add('no');
      return;
    }
    this._found('feed');
    this._add('s', GAIN.feed);
    const { fMin, fMax } = this._g;
    let xf = rnd(fMin, fMax);
    // nicht direkt auf den Pika fallen lassen
    if (Math.abs(xf * this._W - this._x) < this._g.pW * 0.6) xf = clamp(xf + 0.25 * pick([-1, 1]), fMin, fMax);
    // Das Futter steht im Tagesplan und fällt von dort auf allen Geräten (_foodFromPlan). t ist seine Kennung.
    const t = Math.max(sec(this._haNow()), ...(this._plan.fd || []).map((f) => f.t + 1000));
    const x = clamp(Math.round(((xf - fMin) / Math.max(1e-6, fMax - fMin)) * 99), 0, 99);
    this._planOp({ t: 'feed', f: { t, x, k: Math.random() < 0.6 ? 0 : 1, e: false } });
  }

  // Futter aus dem Tagesplan auf die Wiese: gerade gefüttert (auch auf einem anderen Gerät) fällt es herunter, sonst
  // liegt es schon da (Neuladen, Bildschirm war aus). Was dieses Gerät schon fressen sah, kommt nicht wieder.
  _foodFromPlan() {
    if (!this._el || !this._g) return;
    const now = this._haNow();
    const done = (this._foodDone ??= new Set());
    for (const f of this._plan?.fd || []) {
      const have = this._foods.find((o) => o.t === f.t);
      if (f.e) {
        // Woanders gefressen, hier sah keiner zu (schläft, Karte nicht zu sehen): dann ist es auch hier weg.
        // Schaut man zu, frisst er es gleich selbst.
        if (have && (this._asleep || !this._running)) this._removeFood(have);
        continue;
      }
      if (have || done.has(f.t) || now - f.t > 864e5) continue;
      this._foodAdd(f, now - f.t < 2500);
    }
  }

  _foodAdd(f, drop) {
    const { fMin, fMax } = this._g;
    const xf = fMin + (f.x / 99) * (fMax - fMin);
    const kind = FOOD_KINDS[f.k] || 'lz';
    const el = document.createElement('div');
    el.className = drop ? 'food drop' : 'food';
    el.style.setProperty('--xf', xf.toFixed(4));
    el.innerHTML = FOOD[kind].svg;
    this._el.foods.appendChild(el);
    const food = { xf, kind, el, landed: !drop, t: f.t };
    this._foods.push(food);
    const land = () => {
      food.landed = true;
      el.classList.remove('drop');
      if (this._asleep) {
        if (!drop) return;
        this._el.pika.classList.add('peek');
        setTimeout(() => this._el.pika.classList.remove('peek'), 900);
      } else if (!['eatFood', 'coffee', 'giftOpen'].includes(this._action)) {
        // Beim Kaffee nicht: das Futter frisst er ohnehin erst danach, er hüpfte nur vom Stein. Beim Auspacken
        // nicht: Der Inhalt verschwände ohne Vorführung („neuer Trick!“), das Futter frisst er gleich danach.
        this._interrupt();
      }
    };
    if (!drop) return land();
    // Sternchenaugen, wenn Futter kommt
    if (!this._asleep) this._cls('sparkle', 2600);
    setTimeout(land, 800);
  }

  // ---------- Wiese ----------

  _initFlowers() {
    for (let i = 0; i < 5; i++) this._addFlower(false);
  }

  _addFlower(grow = true, at = null) {
    const { fMin, fMax } = this._g;
    let xf = at == null ? null : clamp(at, fMin, fMax);
    for (let tries = 0; xf == null || (at == null && tries < 12); tries++) {
      xf = rnd(fMin, fMax);
      if (this._flowers.every((f) => Math.abs(f.xf - xf) * this._W > 26)) break;
    }
    const color = pick(this._flowerPal());
    const el = document.createElement('div');
    el.className = grow ? 'flower grow' : 'flower';
    el.style.setProperty('--xf', xf.toFixed(4));
    el.style.animationDelay = grow ? '' : `${rnd(-3.6, 0).toFixed(2)}s`;
    el.innerHTML = FLOWER_SVG(color);
    this._el.flowers.appendChild(el);
    const f = { xf, color, el };
    this._flowers.push(f);
    this._flowerTint(f);
  }

  // Die fünf Blumenfarben dieses Areals in dieser Jahreszeit. Im Tagesplan stehen nur ihre Nummern (Vorrat,
  // Blumengeschenk): Frühling und Sommer malen sie wie bis 0.30, Herbst und Winter in ihren eigenen Farben.
  _flowerPal() {
    this._seasonK ??= seasonKey(this._festNow(), this._viewN());
    const own = this._areal().flowers;
    return (own ? FLOWER_SEASON_ALPIN : FLOWER_SEASON)[this._seasonK] || own || FLOWER_COLORS;
  }

  // Blumen im Licht des Augenblicks, ohne Filter über der schaukelnden Ebene: je Blume Blüte und Mitte, an der
  // Ebene Stiel und Blatt in den Farben der Jahreszeit. only: nur diese eine (neu gewachsen, umgefärbt).
  _flowerTint(only) {
    const L = this._lit;
    if (!L) return;
    const dim = (c) => rgbHex(dimRgb(c, L.lb, L.ls));
    if (!only) {
      const fs = this._el.flowers.style;
      fs.setProperty('--fst', dim(L.pal.stem));
      fs.setProperty('--flf', dim(L.pal.leaf));
    }
    for (const f of only ? [only] : this._flowers) {
      f.el.style.setProperty('--fc', dim(hexRgb(f.color)));
      f.el.style.setProperty('--fm', dim(hexRgb(flowerMid(f.color))));
    }
  }

  _regrow() {
    if (this._g && this._flowers.length < 6) this._addFlower(true);
  }

  _nearestFlower() {
    let best = null;
    for (const f of this._flowers) {
      if (!best || Math.abs(f.xf * this._W - this._x) < Math.abs(best.xf * this._W - this._x)) best = f;
    }
    return best;
  }

  // Erst an der Blüte schnuppern (Nase wackelt, Kopf tief), dann pflücken
  async _sniffPick(f) {
    const p = this._el.pika;
    p.classList.add('sniff');
    await this._wait(rnd(600, 900));
    p.classList.remove('sniff');
    this._pickFlower(f);
  }

  _pickFlower(f) {
    this._flowers = this._flowers.filter((o) => o !== f);
    f.el.classList.add('picked');
    setTimeout(() => f.el.remove(), 400);
  }

  _removeFood(food) {
    this._foods = this._foods.filter((o) => o !== food);
    food.el.classList.add('gone');
    setTimeout(() => food.el.remove(), 350);
  }

  // Vorrat aus dem Tagesplan zeigen; wippt, wenn ein Bündel dazukam
  _hayFromPlan() {
    if (!this._el) return;
    const { n, c } = hayNow(this._plan.hay, this._haNow());
    const pal = this._flowerPal();
    const key = `${n}|${c}|${this._arealKey}|${this._seasonK}`;
    if (key === this._hayKey) return;
    const more = this._hayKey != null && n > this._hay;
    this._hayKey = key;
    this._hay = n;
    this._blooms = [...c].slice(-STASH_MAX).map((d, i) => ({ color: pal[Number(d) % pal.length], ...this._haySpot(i) }));
    this._renderHay(more);
  }

  _renderHay(bounce) {
    const S = this._areal().stash;
    const sb = S && this._el.burrow.querySelector('.stashb');
    if (S) {
      if (!sb) return;
      // Heubett auf dem Nischenboden (wächst mit dem Vorrat), darauf die Blüten mit Stiel
      const F = this._areal().vh - this._areal().sink;
      const P = this._stashSlots();
      const n = this._blooms.length;
      const top = F - 2.2 - Math.max(Math.ceil(n / 5.5), this._hay / 3) * 1.7;
      const cx = (S.x1 + S.x2) / 2;
      const f = (v) => +v.toFixed(2);
      sb.innerHTML = `<path d="M${S.x1 + 0.8} ${F + 1} V${F - 1.4} Q${cx} ${f(top)} ${S.x2 - 0.8} ${F - 1.4} V${F + 1}Z"`
        + ' fill="#dcbc6a" stroke="#a9853a" stroke-width=".45"/>'
        + `<path d="M${S.x1 + 3} ${F - 1.2} l2.2 -1.4 M${cx - 2} ${F - 1} l2.6 -1.6 M${S.x2 - 6} ${F - 1.3} l2 -1.2"`
        + ' stroke="#b38c3c" stroke-width=".4" fill="none"/>'
        + this._blooms.map((b, i) => {
          const [x, y] = P[i];
          return `<g${bounce && i === n - 1 ? ' class="new"' : ''}>`
            + `<path d="M${f(x - 2.1)} ${f(y + 1.1)} Q${f(x - 1.1)} ${f(y + 0.3)} ${f(x)} ${f(y)}" stroke="#5e8f3e" stroke-width=".5" fill="none"/>`
            + `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="${b.color}" stroke="rgba(0,0,0,.22)" stroke-width=".25"/>`
            + `<circle cx="${f(x)}" cy="${f(y)}" r=".55" fill="#e0a032"/></g>`;
        }).join('');
      return;
    }
    const hay = this._el.hay;
    hay.style.setProperty('--hs', (0.4 + this._hay * 0.055).toFixed(3));
    hay.querySelector('.hayb').innerHTML = this._blooms.map((b) =>
      `<circle cx="${b.sx}" cy="${b.sy}" r="2.4" fill="${b.color}" stroke="rgba(0,0,0,.15)" stroke-width=".4"/>`
      + `<circle cx="${b.sx}" cy="${b.sy}" r=".9" fill="#e0a032" opacity=".8"/>`).join('');
    if (bounce) {
      hay.classList.remove('boing');
      void hay.offsetWidth;
      hay.classList.add('boing');
    }
  }
}
