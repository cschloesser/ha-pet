// Kleine Momente: neugierig, gähnen, niesen, kratzen, Schluckauf, Schmetterling, Flitzen, Blumengeschenk, Wiedersehen

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { GAIN } from '../logik/zustand.js';
import { FLGIFT } from '../logik/tagesplan.js';
import { ICON_HEART } from '../grafik/szene.js';
import { BFLY_COLORS, BFLY_SVG, GIFT_SVG } from '../grafik/momente.js';

export class Momente {
  _cuteActs({ s, g, wx, elev, hasFlowers }) {
    const d = new Date(this._dbgDate ?? Date.now());
    const h = d.getHours();
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const mo = (d.getMonth() + (south ? 6 : 0)) % 12;
    const dry = !wx.wet && !wx.snowcover;
    this._pollenSeason = dry && mo >= 2 && mo <= 5;
    const sleepyH = (h >= 13 && h < 15) || h >= 19 || (elev != null && elev < 6 && h >= 12);
    const bfly = mo >= 3 && mo <= 8 && dry && !wx.cold && (this._wind || 0) < 30 && (elev == null || elev > 8) && !this._bfly;
    const gift = hasFlowers && !wx.wet && g > 60 && !this._giftEl && this._haNow() - (this._plan?.fl?.t || 0) > FLGIFT.gap;
    return [
      [dry ? 0.5 : 0.25, 'curious'],
      [sleepyH ? 0.35 : 0.12, 'yawn'],
      [0.06 + (this._pollenSeason ? 0.14 : 0) + (wx.cold ? 0.08 : 0), 'sneeze'],
      [wx.wet ? 0 : 0.22, 'earClean'], // bei Regen hält eine Pfote das Blatt
      [wx.wet ? 0 : 0.16, 'scratch'],
      [this._hicDue ? 8 : 0, 'hiccup'],
      [wx.wet ? 0 : h >= 13 && h < 16 ? 0.08 : 0.02, 'nod'],
      [bfly ? 0.14 : 0, 'butterfly'],
      [dry && g > 85 && s > 40 && !this._fr && !calmMotion() ? 0.08 : 0, 'zoomies'], // Bewegung reduzieren: nie
      [gift ? 0.15 : 0, 'gift'],
    ];
  }

  // Kopf schief, manchmal mit Fragezeichen, manchmal erst links, dann rechts
  async _curious() {
    const p = this._el.pika;
    const a = Math.random() < 0.7 ? 'tilt' : 'tilt-b';
    p.classList.add(a);
    if (Math.random() < 0.6) this._emote('q', 1500);
    await this._wait(rnd(1100, 1800));
    p.classList.remove(a);
    if (Math.random() < 0.4) {
      await this._wait(250);
      const b = a === 'tilt' ? 'tilt-b' : 'tilt';
      p.classList.add(b);
      await this._wait(rnd(900, 1400));
      p.classList.remove(b);
    }
    await this._wait(rnd(300, 700));
  }

  async _yawn() {
    const p = this._el.pika;
    if (Math.random() < 0.35) this._say('*gähn*', 1400);
    p.classList.add('yawning');
    await this._wait(2300);
    p.classList.remove('yawning');
    this._cls('mlem', 950, true); // schmatzen
    await this._wait(600);
    this._blink();
    await this._wait(rnd(600, 1200));
  }

  // Niesen: Nase kribbelt, Kopf zurück, hatschi! onBurst läuft im Moment des Niesers (Schmetterling fliegt auf).
  async _sneeze(pollen = this._pollenSeason, onBurst) {
    const p = this._el.pika;
    if (pollen) this._pollen();
    p.classList.add('presneeze');
    this._say('ha…', 750);
    await this._wait(750);
    this._say('haa…', 700);
    await this._wait(600);
    p.classList.remove('presneeze');
    p.classList.add('sneezing');
    this._say(pick(['hatschi!', 'hatschii!', 'tschi!']), 1100);
    this._snzFx();
    onBurst?.();
    await this._wait(450);
    p.classList.remove('sneezing');
    this._cls('eflap-l', 950, true);
    this._cls('eflap-r', 950, true);
    await this._wait(800);
    if (Math.random() < 0.5) {
      this._blush(1500);
      this._say(pick(['hihi', 'pardon!', '…']), 1000);
    }
    await this._wait(800);
  }

  _snzFx() {
    const { pH } = this._g;
    const n = this._nosePos();
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('span');
      el.className = 'snz';
      el.style.left = `${n.x}px`;
      el.style.top = `${n.y}px`;
      el.style.setProperty('--px', `${this._dir * rnd(0.08, 0.22) * pH}px`);
      el.style.setProperty('--py', `${rnd(-0.12, 0.06) * pH}px`);
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 600);
    }
  }

  // Blütenstaub tanzt vor der Nase
  _pollen() {
    const { pH } = this._g;
    const n = this._nosePos();
    for (let i = 0; i < 6; i++) {
      const el = document.createElement('span');
      el.className = 'pol';
      el.style.left = `${n.x + this._dir * rnd(0.02, 0.16) * pH}px`;
      el.style.top = `${n.y + rnd(-0.12, 0.04) * pH}px`;
      el.style.setProperty('--px', `${rnd(-0.08, 0.08) * pH}px`);
      el.style.setProperty('--py', `${rnd(-0.14, -0.02) * pH}px`);
      el.style.animationDelay = `${i * 120}ms`;
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 1700 + i * 120);
    }
  }

  // Ohr putzen: das vordere Ohr mit beiden Pfoten herunterziehen, danach Ohren schütteln
  async _earClean() {
    const p = this._el.pika;
    p.classList.add('earwash');
    await this._wait(rnd(2200, 3600));
    p.classList.remove('earwash');
    await this._wait(350);
    this._cls('eflap-r', 950, true);
    this._cls('eflap-l', 950, true);
    await this._wait(rnd(700, 1200));
  }

  // Mit der Hinterpfote hinterm Ohr kratzen
  async _scratch() {
    const p = this._el.pika;
    p.classList.add('scratching', 'squint');
    await this._wait(rnd(1400, 2400));
    p.classList.remove('scratching', 'squint');
    this._cls('eflap-l', 950, true);
    await this._wait(rnd(500, 900));
  }

  // Schluckauf nach hastigem Fressen
  async _hiccup() {
    this._hicDue = false;
    const n = 3 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      this._cls('hic', 340, true);
      this._say(pick(['hicks!', 'hick!']), 700);
      if (i === 1) this._emote('drop', 1300);
      await this._wait(rnd(1100, 1900));
    }
    this._blink();
    await this._wait(500);
    this._say(pick(['…weg!', 'puh!']), 1100);
    await this._wait(1100);
  }

  // Einnicken am Nachmittag: der Kopf sinkt, er schreckt hoch und tut, als wäre nichts gewesen
  async _nod() {
    const p = this._el.pika;
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      p.classList.add('nodding');
      await this._wait(rnd(1700, 2600));
      p.classList.remove('nodding');
      if (i < n - 1) {
        this._blink();
        await this._wait(rnd(500, 900));
      }
    }
    this._cls('hic', 340, true);
    this._emote('ex', 1100);
    this._cls('eflap-l', 950, true);
    await this._wait(500);
    p.classList.add('look-b');
    await this._wait(500);
    p.classList.replace('look-b', 'look-f');
    await this._wait(500);
    p.classList.remove('look-f');
    this._emote('drop', 1500);
    this._blush(1800);
    if (Math.random() < 0.5) this._say(pick(['war nix!', 'hab nicht geschlafen!', 'hm?']), 1500);
    await this._wait(1500);
  }

  // Ein Schmetterling landet auf der Nase: schielen, stillhalten, dann niesen oder hinterherhopsen
  async _butterfly() {
    const { pW, pH, gy } = this._g;
    const p = this._el.pika;
    if (this._x < pW || this._x > this._W - pW) await this._walkTo(clamp(this._x, pW * 1.2, this._W - pW * 1.2));
    const el = document.createElement('div');
    el.className = 'bfly';
    el.innerHTML = BFLY_SVG(pick(BFLY_COLORS));
    this._el.fx.appendChild(el);
    this._bfly = el;
    this._memo('bfly');
    const at = (x, y) => ({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` });
    const flyOff = () => {
      if (this._bfly !== el) return;
      this._bfly = null;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      el.classList.remove('rest');
      const dx = (Math.random() < 0.5 ? -1 : 1) * this._W * rnd(0.4, 0.7);
      const kf = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        kf.push(at(m.m41 + dx * t, m.m42 - this._H * 0.75 * t + Math.sin(t * Math.PI * 4) * pH * 0.12));
      }
      el.animate(kf, { duration: 3200, easing: 'ease-in', fill: 'forwards' });
      setTimeout(() => el.remove(), 3300);
    };
    try {
      const n = this._nosePos();
      const tx = n.x;
      const ty = n.y - pH * 0.04;
      // von vorn heran, damit er ihn kommen sieht
      const sx = this._dir > 0 ? this._W + pH * 0.2 : -pH * 0.2;
      const sy = gy - this._H * rnd(0.45, 0.65);
      const kf = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        kf.push(at(sx + (tx - sx) * t, sy + (ty - sy) * t + Math.sin(t * Math.PI * 3) * pH * 0.2 * (1 - t)));
      }
      const dur = 4200;
      el.animate(kf, { duration: dur, easing: 'ease-out', fill: 'forwards' });
      await this._wait(dur * 0.5);
      p.classList.add('look-up');
      this._cls('sparkle', 2200);
      await this._wait(dur * 0.5);
      el.classList.add('rest');
      p.classList.remove('look-up');
      p.classList.add('crosseye');
      await this._wait(rnd(2200, 3400));
      p.classList.remove('crosseye');
      if (Math.random() < 0.5) {
        await this._sneeze(false, flyOff);
      } else {
        this._blink();
        await this._wait(400);
        flyOff();
        p.classList.add('look-up');
        await this._wait(500);
        this._jump('binky');
        this._say(pick(['oh!', 'tschüss!', 'wiii!']), 1100);
        await this._wait(1600);
      }
    } finally {
      flyOff();
    }
  }

  // Vor Freude wild über die Wiese flitzen, danach hecheln
  async _zoomies() {
    const { pW, home } = this._g;
    const p = this._el.pika;
    this._say(pick(['wiii!', 'juhuu!', 'iiiiiep!']), 1200);
    this._jump('binky');
    await this._wait(900);
    const lo = Math.max(home, pW * 0.5);
    const hi = this._g.xR;
    const legs = 3 + Math.floor(rnd(0, 2));
    for (let i = 0; i < legs; i++) {
      const mid = (lo + hi) / 2;
      const x = this._x < mid ? rnd(mid + (hi - mid) * 0.4, hi) : rnd(lo, mid - (mid - lo) * 0.4);
      await this._walkTo(x, 2.4, true);
      this._puff(this._x, this._g.gy, 3);
      this._jump(Math.random() < 0.6 ? 'binky' : 'hop1');
      await this._wait(700);
    }
    this._cls('excited', 25000);
    p.classList.add('pant', 'happy');
    this._say(pick(['puh!', 'hechel…', 'hihi!']), 1300);
    await this._wait(2600);
  }

  // Eine Blüte als Geschenk vorn ins Gras legen. Antippen nimmt sie an.
  async _gift() {
    const f = this._nearestFlower();
    if (!f || this._giftEl) return;
    const p = this._el.pika;
    const { pW } = this._g;
    await this._approach(f.xf * this._W);
    await this._sniffPick(f);
    this._mouth(f.color);
    p.classList.add('carry');
    // Unterwegs bricht Streicheln das Geschenk nicht ab (_petFree). Alles andere (Futter, Schlaf, Plan): dann legt er
    // die Blüte eben dort ab, wo er gerade ist, statt dass sie verschwindet
    this._giftCarry = true;
    try {
      await this._walkTo(clamp(this._W * rnd(0.4, 0.6), pW, this._W - pW));
    } finally {
      this._giftCarry = false;
      p.classList.remove('carry');
      this._mouth(null);
      // Hat unterwegs ein anderes Gerät eins hingelegt, liegt das schon da (und gilt auf allen)
      if (!this._giftEl) this._flowerGiftDrop(f.color);
    }
    this._say(pick(['für dich!', 'für dich ♥', 'hier!']), 1800, true);
    this._blush(3000);
    p.classList.add('happy');
    this._jump('hop1');
    await this._wait(1500);
    p.classList.remove('happy');
    p.classList.add('tilt');
    await this._wait(1600);
  }

  // Blüte mit Schleife vor ihm ins Gras legen; erst jetzt zählen die 90 Minuten bis zum nächsten Geschenk. Sie steht im
  // Tagesplan (fl), so liegt sie auf allen Geräten an derselben Stelle (siehe _flowerFromPlan).
  _flowerGiftDrop(color) {
    const pal = this._flowerPal();
    const x = clamp(this._liveX() + this._dir * this._g.pW * 0.45, this._g.pH * 0.35, this._W - this._g.pH * 0.35);
    this._planOp({ t: 'fdrop', f: { t: this._haNow(), c: Math.max(0, pal.indexOf(color)) % 10, x: Math.round((x / this._W) * 100), k: false } });
  }

  // Blumengeschenk nach dem Tagesplan zeigen: hinlegen (auch wenn es ein anderes Gerät hingelegt hat), auf allen Geräten
  // wegnehmen, sobald es auf einem angetippt wurde, und nach FLGIFT.life welken lassen
  _flowerFromPlan() {
    if (!this._g || !this._el) return;
    const f = this._plan?.fl;
    const left = f && !f.k ? f.t + FLGIFT.life - this._haNow() : 0;
    const el = this._giftEl;
    if (el && (el._t !== f?.t || left <= 0)) {
      this._giftEl = null;
      clearTimeout(this._giftT);
      if (el._t === f?.t && f.k) {
        // auf einem anderen Gerät angenommen
        el.classList.add('take');
        setTimeout(() => el.remove(), 950);
      } else {
        el.classList.add('wilt');
        if (el._t !== f?.t) el.style.transitionDuration = '.6s'; // durch ein anderes ersetzt
        setTimeout(() => el.remove(), 4200);
      }
    }
    if (this._giftEl || left <= 0 || left > FLGIFT.life + 6e4) return;
    const pal = this._flowerPal();
    const g = document.createElement('div');
    g.className = 'pgift';
    g.innerHTML = `${GIFT_SVG(pal[f.c % pal.length])}<i class="pspk"></i><i class="pspk"></i><i class="pspk"></i>`;
    g._t = f.t;
    g._xf = f.x / 100; // relativ: bei Größenänderung mitwandern
    this._flowerGiftPlace(g);
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', 'Blume annehmen');
    g.addEventListener('click', (e) => (e.stopPropagation(), this._takeGift()));
    this._keyTap(g);
    this._el.fx.appendChild(g);
    this._giftEl = g;
    clearTimeout(this._giftT);
    this._giftT = setTimeout(() => this._flowerFromPlan(), left + 100);
  }

  // Ganz vorn im Gras, nah am Betrachter
  _flowerGiftPlace(el) {
    const { pH, gy } = this._g;
    el.style.left = `${(el._xf * this._W).toFixed(1)}px`;
    el.style.top = `${(gy - pH * 0.1).toFixed(1)}px`;
  }

  _takeGift() {
    const el = this._giftEl;
    if (!el) return;
    this._giftEl = null;
    clearTimeout(this._giftT);
    this._found('bloom');
    this._planOp({ t: 'ftake', ft: el._t });
    const r = el.getBoundingClientRect();
    const s = this._el.scene.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.innerHTML = ICON_HEART;
      h.style.left = `${r.left - s.left + r.width * rnd(0.3, 0.8)}px`;
      h.style.top = `${r.top - s.top}px`;
      h.style.setProperty('--dx', `${rnd(-0.3, 0.3) * this._g.pW}px`);
      h.style.animationDelay = `${i * 110}ms`;
      this._el.fx.appendChild(h);
      setTimeout(() => h.remove(), 1700 + i * 110);
    }
    el.classList.add('take');
    setTimeout(() => el.remove(), 950);
    this._add('g', GAIN.pet);
    if (this._asleep) return;
    this._blush(2500);
    this._happy(1400);
    if (!this._el.pika.classList.contains('walking')) this._jump('binky');
    this._say(pick(['♥', 'hihi ♥', 'gern!']), 1300);
  }

  // Langes Wiedersehen (über 3 Stunden nicht zu sehen): er hoppelt nach vorn und freut sich riesig
  async _reunite() {
    const p = this._el.pika;
    if (this._inside) await this._comeOut();
    this._cls('sparkle', 6000);
    this._emote('ex', 1000);
    await this._wait(600);
    await this._walkTo(this._W * 0.5, 1.8);
    p.classList.add('waving');
    this._say(pick(['Da bist du ja!', 'Schön, dass du da bist!', 'Juhuu, du bist da!']), 2200, true);
    this._blush(4500);
    await this._wait(1800);
    p.classList.remove('waving');
    this._jump('binky');
    this._hearts(4);
    await this._wait(1000);
    this._jump('binky');
    await this._wait(1100);
  }
}
