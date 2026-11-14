// Schätze: Spiele mit Wollknäuel, Gießkanne, Hängematte und Fernrohr, Tricks und Gold

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { giftLvs } from '../logik/paeckchen.js';
import { GIFT_ITEMS, GIFT_HAM_W, GIFT_HAM_LIFT, GIFT_HAM_MS } from '../grafik/paeckchen.js';

export class Schaetze {
  // Wollknäuel anstupsen, es kullert, er hinterher
  async _giftYarn() {
    const el = this._gtEls?.get(0);
    if (!el) return;
    const p = this._el.pika;
    const { pW, fMin, fMax } = this._g;
    const W = this._W;
    await this._approach(this._giftX(0), 1.2);
    const n = Math.random() < 0.5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      p.classList.add('crouch');
      await this._wait(260);
      p.classList.remove('crouch');
      this._jump('hop1');
      const from = this._giftX(0);
      const to = clamp(from + this._dir * W * rnd(0.12, 0.28), fMin * W, fMax * W);
      this._yarnXf = to / W;
      this._yarnRot = (this._yarnRot || 0) + ((to - from) / (Math.PI * this._H * 0.075)) * 360;
      el.style.transition = 'left 1.2s cubic-bezier(.2, .7, .4, 1)';
      el.style.left = `${to.toFixed(1)}px`;
      el.querySelector('svg').style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
      this._say(pick(['hihi!', 'kuller!', 'fang!', 'hopp!']), 1000);
      await this._wait(450);
      if (Math.abs(to - from) < 4) break;
      await this._walkTo(to - this._dir * pW * 0.42, 1.9);
    }
    el.style.transition = '';
    if (giftLvs(this._plan?.gift)[0] >= 2 && Math.random() < 0.6) return this._giftHeader();
    this._happy(1000);
    await this._wait(800);
  }

  // Trick des Wollknäuels: mit der Nase hochstupsen, Kopfball, es fliegt im Bogen weiter über die Wiese
  async _giftHeader() {
    // Die Flug-Animationen halten ihren Endstand (fill: forwards): bei Abbruch mitten im Flug beenden, sonst bliebe
    // das Knäuel in der Luft hängen bzw. versetzt liegen
    const A = [];
    try {
      await this._giftHeaderRun(A);
    } finally {
      A.forEach((a) => a.cancel());
    }
  }

  async _giftHeaderRun(A) {
    const el = this._gtEls?.get(0);
    if (!el) return;
    const p = this._el.pika;
    const { pW, pH, fMin, fMax } = this._g;
    const W = this._W;
    await this._approach(this._giftX(0), 1.2);
    const x0 = this._giftX(0);
    const dir = this._dir;
    const hx = this._x + dir * pW * 0.22 - x0;
    const hy = -pH * 0.72;
    // Richtung mit genug Platz, notfalls über ihn hinweg nach hinten
    const room = dir > 0 ? fMax * W - x0 : x0 - fMin * W;
    const kd = room > W * 0.15 ? dir : -dir;
    const x1 = clamp(x0 + kd * W * rnd(0.15, 0.3), fMin * W, fMax * W);
    p.classList.add('crouch');
    await this._wait(260);
    p.classList.remove('crouch');
    this._say('hopp!', 700);
    // hoch über den Kopf, er springt ihm entgegen
    const up = el.animate([
      { transform: 'none' },
      { transform: `translate(${(hx * 0.6).toFixed(1)}px, ${(hy * 1.7).toFixed(1)}px)`, offset: 0.55 },
      { transform: `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px)` },
    ], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
    A.push(up);
    setTimeout(() => this._g && this._jump('hop1'), 520);
    await this._wait(900);
    this._say('Kopfball!', 1200);
    const dx = x1 - x0;
    const away = el.animate([
      { transform: `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px)` },
      { transform: `translate(${((hx + dx) / 2).toFixed(1)}px, ${(hy * 1.6).toFixed(1)}px)`, offset: 0.45 },
      { transform: `translate(${dx.toFixed(1)}px, 0)`, offset: 0.85 },
      { transform: `translate(${dx.toFixed(1)}px, ${(hy * 0.12).toFixed(1)}px)`, offset: 0.93 },
      { transform: `translate(${dx.toFixed(1)}px, 0)` },
    ], { duration: 1100, easing: 'ease-in-out', fill: 'forwards' });
    A.push(away);
    up.cancel();
    this._yarnRot = (this._yarnRot || 0) + kd * 540;
    el.querySelector('svg').style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
    await this._wait(1100);
    this._yarnXf = x1 / W;
    el.style.left = `${x1.toFixed(1)}px`;
    away.cancel();
    this._puff(x1, this._g.gy, 2);
    this._happy(1400);
    this._jump('binky');
    this._say(pick(['Tor!', 'jaaa!', 'hihi!']), 1200);
    await this._wait(1300);
  }

  // Gießkanne holen, Blumen gießen, zwei neue wachsen
  async _giftWater() {
    const can = this._gtEls?.get(6);
    if (!can) return;
    const p = this._el.pika;
    const { pW, fMin, fMax, gy } = this._g;
    const W = this._W;
    const cx = this._giftX(6);
    await this._approach(cx, 1);
    can.classList.add('away');
    p.classList.add('wcan');
    try {
      this._say(pick(['gießen!', 'Wasser marsch!', 'plitsch!']), 1200);
      await this._wait(500);
      // zu einer Stelle mit wenig Blumen
      let best = null;
      for (let i = 0; i < 8; i++) {
        const xf = rnd(fMin, fMax);
        const d = Math.min(1, ...this._flowers.map((f) => Math.abs(f.xf - xf)));
        if (!best || d > best.d) best = { xf, d };
      }
      const spot = best.xf * W;
      const dir = spot >= this._x ? 1 : -1;
      await this._walkTo(spot - dir * pW * 0.52, 0.9);
      this._face(dir);
      await this._wait(300);
      p.classList.add('pour');
      await this._wait(400);
      const sx = this._x + dir * pW * 0.5;
      // Trick: Regenbogen im Wasserstrahl, wenn die Sonne scheint
      const lvW = giftLvs(this._plan?.gift)[6];
      if (lvW >= 2 && this._wx.cover < 70 && !this._el.scene.classList.contains('night')) this._giftRainbow(sx, gy - this._H * 0.12, dir);
      for (let i = 0; i < 12; i++) {
        const d = document.createElement('span');
        d.className = 'gdrop';
        d.style.left = `${(sx + rnd(-pW * 0.05, pW * 0.05)).toFixed(1)}px`;
        d.style.top = `${(gy - this._H * 0.14 + rnd(-2, 2)).toFixed(1)}px`;
        this._el.fx.appendChild(d);
        setTimeout(() => d.remove(), 600);
        await this._wait(160);
      }
      p.classList.remove('pour');
      await this._wait(500);
      const nf = lvW >= 2 ? 3 : 2;
      for (let i = 0; i < nf && this._flowers.length < 8; i++) {
        this._addFlower(true, (sx + (nf === 2 ? (i ? 1 : -1) * rnd(8, 20) : (i - 1) * rnd(12, 20))) / W);
      }
      this._say(pick(['wachs!', 'hübsch!', '♥']), 1200);
      this._happy(1000);
      await this._wait(1600);
      await this._approach(cx, 1);
    } finally {
      p.classList.remove('wcan', 'pour');
      can.classList.remove('away');
    }
  }

  // Nachmittags ein Nickerchen in der Hängematte: Er stellt sie erst auf (linkes Gestell, rechtes, dann das Netz)
  // und baut sie danach wieder ab (_giftHamDown). Unterbrochen, bevor er drinliegt, räumt _cleanup sie weg.
  async _giftHammock() {
    const p = this._el.pika;
    const { pW, gy } = this._g;
    const cx = this._hamSpot();
    const side = this._x < cx ? -1 : 1;
    await this._walkTo(cx + side * pW * 0.95, 1);
    this._face(-side);
    this._say(pick(['erst aufbauen…', 'Hängematte!', 'so, aufstellen…']), 1300);
    await this._wait(500);
    this._hamOut = true;
    this._hamBuild = true;
    this._giftScene();
    this._hamBuild = false;
    const el = this._gtEls?.get(5);
    if (!el) return;
    const half = (pW * GIFT_HAM_W) / 2;
    p.classList.add('crouch');
    this._puff(cx - half * 0.85, gy, 2);
    await this._wait(500);
    this._puff(cx + half * 0.85, gy, 2);
    await this._wait(GIFT_HAM_MS.build - 500);
    el.classList.remove('build');
    p.classList.remove('crouch');
    this._happy(900);
    await this._wait(500);
    this._say(pick(['Nickerchen…', '*gähn*', 'Päuschen!']), 1300);
    await this._wait(800);
    this._onHam = true;
    await this._hopTo(cx, pW * GIFT_HAM_W * GIFT_HAM_LIFT);
    p.classList.add('lying');
    if (giftLvs(this._plan?.gift)[5] >= 2 && (this._dbgSwing || Math.random() < 0.7)) await this._giftSwing(el);
    this._dbgSwing = false;
    el.classList.add('sway');
    await this._wait(900);
    p.classList.add('doze');
    await this._wait(rnd(18000, 32000));
    await this._giftHamDown();
  }

  async _giftHamDown() {
    const p = this._el.pika;
    const el = this._gtEls?.get(5);
    p.classList.remove('doze');
    if (p.classList.contains('lying')) {
      this._say(pick(['ausgeschlafen!', '*streck*', 'hmm…']), 1200);
      await this._wait(900);
    }
    p.classList.remove('lying', 'hswing');
    el?.classList.remove('sway', 'swing');
    const cx = el ? this._giftX(5) : this._x;
    await this._hopTo(cx + pick([-1, 1]) * this._g.pW * 0.95, 0);
    this._onHam = false;
    this._puff(this._x, this._g.gy, 2);
    // und wieder abbauen
    await this._wait(500);
    this._face(cx > this._x ? 1 : -1);
    p.classList.add('crouch');
    await this._hamFold();
    p.classList.remove('crouch');
  }

  // Mit dem Fernrohr auf dem Stein: Ausschau halten, am liebsten nach Flugzeugen
  async _giftScope() {
    const p = this._el.pika;
    const { rock } = this._g;
    await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1));
    if (this._bird?.perch === 'rock') {
      this._bird.scare();
      await this._wait(600);
    }
    await this._hopTo(rock.cx, rock.lift);
    this._puff(rock.cx, this._g.gy - rock.lift, 2);
    await this._wait(500);
    p.classList.add('spy');
    // Trick: in der Dämmerung schaut er nach den ersten Sternen
    const stars = giftLvs(this._plan?.gift)[4] >= 2 && this._el.scene.classList.contains('dusk');
    for (let i = 0; i < 3; i++) {
      const pl = this._planeToWatch();
      if (pl) this._face(pl.x >= this._x ? 1 : -1);
      else if (i) this._face(-this._dir);
      p.classList.toggle('look-up', !!pl || stars || Math.random() < 0.5);
      if (pl) {
        this._memo('plane');
        this._say(pick(['Flugzeug!', 'da oben!', 'brumm!']), 1300);
      } else if (stars) {
        const sx = clamp(this._x + this._dir * this._W * rnd(0.15, 0.35), 10, this._W - 10);
        this._sparkle(sx, this._sy(rnd(0.08, 0.2)), 1);
        this._say(pick(['ein Stern!', 'Abendstern!', 'noch einer!', 'funkel!', 'wünsch dir was!']), 1400);
      } else if (Math.random() < 0.5) this._say(pick(['Land in Sicht!', 'ahoi!', 'hmm…', 'ich seh dich!']), 1300);
      await this._wait(rnd(1800, 3000));
    }
    p.classList.remove('spy', 'look-up');
    await this._wait(400);
    await this._hopDown();
  }

  // ---------- Tricks (Stufe 2) und Gold (Stufe 3) ----------

  // Neuen Trick gleich nach dem Auspacken vorführen (kurz)
  async _giftTrick(t) {
    const key = GIFT_ITEMS[t].key;
    const p = this._el.pika;
    if (key === 'yarn' && this._gtEls?.has(0)) return this._giftHeader();
    if (key === 'wheel') return this._giftBlow();
    if (key === 'plush') return this._giftPlush(4000);
    if (key === 'bell') return this._giftTune();
    if (key === 'scope') {
      p.classList.add('spy', 'look-up');
      this._sparkle(clamp(this._x + this._dir * this._W * 0.2, 10, this._W - 10), this._sy(0.12), 2);
      this._say('Sterne gucken!', 1500);
      await this._wait(2400);
      p.classList.remove('spy', 'look-up');
      return;
    }
    if (key === 'hammock') {
      const el = this._gtEls?.get(5);
      el?.classList.add('swing');
      this._say('hui!', 1200);
      await this._wait(2600);
      el?.classList.remove('swing');
      return;
    }
    if (key === 'can') {
      const el = this._gtEls?.get(6);
      const r = el?.getBoundingClientRect();
      const sc = this._el.scene.getBoundingClientRect();
      if (r) this._giftRainbow(r.left - sc.left + r.width * 0.9, r.top - sc.top, 1);
      this._say('ein Regenbogen!', 1500);
      await this._wait(2400);
    }
  }

  // Goldene Schätze, die er trägt bzw. hält: Sonnenbrille, Fernrohr, Gießkanne (lvs: Stufen aus _giftScene)
  _giftDress(lvs) {
    const p = this._el?.pika;
    if (!p) return;
    const lv = lvs || (this._giftOn() ? giftLvs(this._plan?.gift, this._giftHide) : []);
    p.classList.toggle('g-shd', lv[3] >= 3);
    p.classList.toggle('g-scp', lv[4] >= 3);
    p.classList.toggle('g-can', lv[6] >= 3);
  }

  // Trick des Windrads: bei wenig Wind hinhoppeln und es anpusten, dann dreht es sich kurz ganz schnell
  async _giftBlow() {
    const el = this._gtEls?.get(1);
    if (!el) return;
    const p = this._el.pika;
    const { pW, pH, gy } = this._g;
    const r = el.getBoundingClientRect();
    const sc = this._el.scene.getBoundingClientRect();
    const wx = r.left - sc.left + r.width / 2;
    // mit Abstand daneben (meist rechts davon, links steht der Bau), damit man das Windrad sieht
    const side = wx + pW * 0.85 < this._g.fMax * this._W ? 1 : -1;
    await this._walkTo(wx + side * pW * 0.8, 1);
    this._face(-side);
    await this._wait(300);
    p.classList.add('look-up', 'puffy');
    await this._wait(500);
    this._say('puuuh!', 1300);
    this._blowUntil = this._haNow() + 3500;
    this._giftScene();
    const mx = this._x + this._dir * pW * 0.45;
    const my = gy - pH * 0.5;
    for (let i = 0; i < 4; i++) {
      const a = document.createElement('span');
      a.className = 'gair';
      a.style.left = `${mx.toFixed(1)}px`;
      a.style.top = `${(my + rnd(-3, 3)).toFixed(1)}px`;
      a.style.setProperty('--dx', `${(wx - mx).toFixed(1)}px`);
      a.style.setProperty('--dy', `${(r.top - sc.top + r.width * 0.25 - my).toFixed(1)}px`);
      a.style.animationDelay = `${i * 110}ms`;
      this._el.fx.appendChild(a);
      setTimeout(() => a.remove(), 900 + i * 110);
    }
    await this._wait(700);
    p.classList.remove('puffy');
    await this._wait(1600);
    p.classList.remove('look-up');
    this._say(pick(['huii!', 'schnell!', 'hihi!']), 1100);
    this._happy(1200);
    await this._wait(1400);
    this._giftScene();
  }

  // Trick des Plüsch-Pinos: tagsüber aus dem Bau holen und auf der Wiese mit ihm kuscheln
  async _giftPlush(ms = rnd(6000, 10000)) {
    const p = this._el.pika;
    const { hole, pW, gy } = this._g;
    try {
      if (this._action !== 'giftOpen') {
        await this._walkTo(hole.cx + pW * 0.15, 1);
        this._face(-1);
        await this._wait(500);
        this._say(pick([`komm, ${this._frGuest()}!`, 'hab dich!']), 1200);
        await this._wait(900);
        // mit ihm hinaus auf die Wiese
        const { fMin, fMax } = this._g;
        await this._walkTo((fMin + rnd(0.2, 0.45) * (fMax - fMin)) * this._W, 0.9);
      }
      // er sitzt vor ihm, Blick zu ihm
      const d = this._x + pW * 0.7 < this._g.fMax * this._W ? 1 : -1;
      this._face(d);
      this._plushX = this._x + d * pW * 0.52;
      this._giftScene();
      const el = this._gtEls?.get(2);
      el?.classList.add('new');
      setTimeout(() => el?.classList.remove('new'), 800);
      this._puff(this._plushX, gy, 2);
      await this._wait(600);
      p.classList.add('content', 'tilt');
      this._blush(2200);
      this._say('♥', 1300);
      await this._wait(ms / 2);
      p.classList.add('squint');
      this._happy(1500);
      await this._wait(ms / 2);
      p.classList.remove('squint', 'tilt', 'content');
      this._say(pick(['bis heut Abend!', 'ab ins Bett mit dir!', '♥']), 1200);
      await this._wait(900);
    } finally {
      if (this._plushX != null) {
        this._puff(this._plushX, gy, 2);
        this._plushX = null;
        this._giftScene();
      }
    }
  }

  // Trick der Sonnenbrille: hochschieben, zwinkern, wieder runter
  async _giftShades() {
    const p = this._el.pika;
    if (!p.classList.contains('cool')) return;
    this._face(1);
    p.classList.add('shup');
    await this._wait(450);
    p.classList.add('wink');
    this._say(pick(['lässig!', 'na?', 'cool, oder?']), 1300);
    await this._wait(1100);
    p.classList.remove('wink');
    await this._wait(300);
    p.classList.remove('shup');
    await this._wait(800);
  }

  // Trick der Hängematte: mit Schwung schaukeln, bevor er einnickt
  async _giftSwing(el) {
    const p = this._el.pika;
    el.classList.add('swing');
    p.classList.add('hswing');
    this._say(pick(['hui!', 'schauuukel!', 'juhu!']), 1300);
    await this._wait(rnd(3500, 5000));
    el.classList.remove('swing');
    p.classList.remove('hswing');
    await this._wait(300);
  }

  // Kleiner Regenbogen im Wasserstrahl (x, y: Mitte des Strahls, dir: wohin er gießt)
  _giftRainbow(x, y, dir) {
    const el = document.createElement('div');
    el.className = 'grbow';
    el.innerHTML = `<svg viewBox="0 0 40 22" aria-hidden="true">${['#e8584e', '#f6a345', '#f6d845', '#7cc35a', '#5fb9de', '#9b7fe0']
      .map((c, i) => `<path d="M${2 + i * 1.6} 22 A${18 - i * 1.6} ${18 - i * 1.6} 0 0 1 ${38 - i * 1.6} 22" stroke="${c}" stroke-width="1.7" fill="none"/>`).join('')}</svg>`;
    el.style.left = `${(x + dir * this._H * 0.03).toFixed(1)}px`;
    el.style.top = `${(y - this._H * 0.1).toFixed(1)}px`;
    this._el.fx.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  // Trick des Glöckchens: an die Tür hoppeln und eine kleine Melodie bimmeln
  async _giftTune() {
    const el = this._gtEls?.get(7);
    if (!el) return;
    const p = this._el.pika;
    const sc = this._el.scene.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const bx = r.left - sc.left + r.width / 2;
    if (this._action !== 'giftOpen') await this._walkTo(bx + this._g.pW * 0.42, 1);
    this._face(-1);
    await this._wait(400);
    const tune = pick([['bimm!', 'bamm!', 'bimm!'], ['ding!', 'dong!', 'ding-ding!'], ['bimm!', 'bimm!', 'bamm!', 'bimm!']]);
    for (const t of tune) {
      p.classList.add('look-up');
      this._giftBell(t);
      this._jump('hop1');
      await this._wait(520);
      p.classList.remove('look-up');
      await this._wait(180);
    }
    this._peep(this._x, this._g.gy - this._g.pH * 1.05, '♪');
    this._happy(1500);
    this._say(pick(['♪♫', 'Musik!', 'tadaa!']), 1200);
    await this._wait(1500);
  }

  // Golden: ab und zu ein Funkeln
  _giftGlint() {
    if (this._asleep || !this._gtEls || Math.random() > 0.2) return;
    const gl = [...this._gtEls.values()].filter((el) => el.classList.contains('gilt') && el.isConnected);
    if (!gl.length) return;
    const el = pick(gl);
    const r = el.getBoundingClientRect();
    const sc = this._el.scene.getBoundingClientRect();
    if (r.width) this._sparkle(r.left - sc.left + r.width * rnd(0.3, 0.7), r.top - sc.top + r.height * rnd(0.1, 0.5), 1);
  }
}
