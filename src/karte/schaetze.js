// Schätze: Spiele mit Wollknäuel, Gießkanne, Hängematte und Fernrohr, Tricks und Gold (mit Wirkung, seit 0.44)

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { flowerMid } from '../logik/wetter.js';
import { giftLvs, GOLD, goldDue, GOLD_BLOOM, goldHamGuest } from '../logik/paeckchen.js';
import {
  GIFT_ITEMS, GIFT_HAM_W, GIFT_HAM_LIFT, GIFT_HAM_MS, GOLD_STAR, GOLD_HEART, GOLD_PLANE, GOLD_FIREFLY, GOLD_FLOWER,
} from '../grafik/paeckchen.js';
import { BFLY_COLORS, BFLY_SVG } from '../grafik/momente.js';

export class Schaetze {
  // Wollknäuel anstupsen, es kullert, er hinterher
  async _giftYarn() {
    const el = this._gtEls?.get(0);
    if (!el) return;
    const p = this._el.pika;
    const { pW, fMin, fMax, gy } = this._g;
    const W = this._W;
    await this._approach(this._giftX(0), 1.2);
    // (Vorschau: _dbgYarnBack gilt für einen Lauf, er stupst dann nur einmal, und das goldene kullert sicher zurück)
    const once = !!this._dbgYarnBack;
    this._dbgYarnBack = false;
    const n = once ? 1 : Math.random() < 0.5 ? 2 : 1;
    // Golden: Dem rollenden Knäuel folgt eine kurze Spur aus Funken (F: Teilchen dieses Laufs, bei Abbruch gleich weg)
    const gold = this._goldOk(0);
    const F = [];
    try {
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
        if (gold) this._goldTrail(F, [...Array(5).keys()].map((k) => [from + (to - from) * (k + 0.5) / 5, gy - this._H * 0.055, 100 + k * 120]));
        this._say(pick(['hihi!', 'kuller!', 'fang!', 'hopp!']), 1000);
        await this._wait(450);
        if (Math.abs(to - from) < 4) break;
        // Golden: Ab und zu kullert es nach dem letzten Stups von selbst zu ihm zurück (nicht bei „Bewegung reduzieren“)
        if (i === n - 1 && gold && !calmMotion() && this._goldOk(0, 'yarnBack')) {
          await this._goldYarnBack(el, to, F);
          break;
        }
        await this._walkTo(to - this._dir * pW * 0.42, 1.9);
      }
      el.style.transition = '';
      if (giftLvs(this._plan?.gift)[0] >= 2 && Math.random() < 0.6) return await this._giftHeader();
      this._happy(1000);
      await this._wait(800);
    } catch (e) {
      this._goldDrop(F);
      throw e;
    }
  }

  // Trick des Wollknäuels: mit der Nase hochstupsen, Kopfball, es fliegt im Bogen weiter über die Wiese
  async _giftHeader() {
    // Die Flug-Animationen halten ihren Endstand (fill: forwards): bei Abbruch mitten im Flug beenden, sonst bliebe
    // das Knäuel in der Luft hängen bzw. versetzt liegen
    const A = [];
    const F = []; // Funken des goldenen Knäuels: laufen sie zu Ende, verschwinden sie von selbst
    let ok = false;
    try {
      await this._giftHeaderRun(A, F);
      ok = true;
    } finally {
      A.forEach((a) => a.cancel());
      if (!ok) this._goldDrop(F);
    }
  }

  async _giftHeaderRun(A, F) {
    const el = this._gtEls?.get(0);
    if (!el) return;
    const p = this._el.pika;
    const { pW, pH, fMin, fMax, gy } = this._g;
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
    // Golden: Funken entlang des Bogens (der Flug ist bei 85 % der Zeit am Boden, danach hüpft es einmal nach)
    if (this._goldOk(0)) {
      this._goldTrail(F, [...Array(5).keys()].map((k) => {
        const s = (k + 0.6) / 5;
        return [x0 + hx + (dx - hx) * s, gy - this._H * 0.035 + hy * (1 + 3.535 * s - 4.535 * s * s), Math.round(935 * s) + 80];
      }));
    }
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
    const F = []; // Funken der goldenen Kanne (bei Abbruch gleich weg)
    let ok = false;
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
      const neu = []; // was diesmal gewachsen ist
      for (let i = 0; i < nf && this._flowers.length < 8; i++) {
        const vor = this._flowers.length;
        this._addFlower(true, (sx + (nf === 2 ? (i ? 1 : -1) * rnd(8, 20) : (i - 1) * rnd(12, 20))) / W);
        if (this._flowers.length > vor) neu.push(this._flowers[this._flowers.length - 1]);
      }
      // Golden: Eine der neuen Blumen ist eine goldgelbe Sonnenblume
      const sun = this._goldOk(6) && this._goldBloom(neu, sx, F);
      this._say(sun ? pick(['eine goldene!', 'oh, wie die leuchtet!', 'Sonnenblume!']) : pick(['wachs!', 'hübsch!', '♥']), 1200);
      this._happy(1000);
      await this._wait(1600);
      await this._approach(cx, 1);
      ok = true;
    } finally {
      p.classList.remove('wcan', 'pour');
      can.classList.remove('away');
      if (!ok) this._goldDrop(F);
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
    // Golden: Solange er döst, kommt Besuch aufs Gestell (Schmetterling, Glühwürmchen), sonst läuft ein Schimmer übers Netz
    const F = [];
    const bye = this._goldOk(5) ? this._goldHam(el, F) : null;
    let ok = false;
    try {
      await this._wait(rnd(18000, 32000));
      ok = true;
    } finally {
      bye?.(ok);
    }
    // (ausgeschlafen fliegt der Besuch davon; wird er dabei unterbrochen, ist auch der gleich weg)
    try {
      await this._giftHamDown();
    } catch (e) {
      this._goldDrop(F);
      throw e;
    }
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
    // Golden: Er entdeckt jedes Mal etwas, auch wenn kein echtes Flugzeug fliegt. Der erste Blick findet immer etwas
    // (ein winziges Flugzeug in der Ferne, abends ein Stern), jeder weitere mit GOLD.spot.p. Ins Tagebuch kommt das
    // nicht (kein _memo): Dort stehen nur echte Flugzeuge.
    const gold = this._goldOk(4);
    const F = [];
    try {
      for (let i = 0; i < 3; i++) {
        const pl = this._planeToWatch();
        const spot = !pl && gold && (i === 0 || this._goldOk(4, 'spot'));
        if (pl) this._face(pl.x >= this._x ? 1 : -1);
        else if (i) this._face(-this._dir);
        p.classList.toggle('look-up', !!pl || stars || spot || Math.random() < 0.5);
        if (pl) {
          this._memo('plane');
          this._say(pick(['Flugzeug!', 'da oben!', 'brumm!']), 1300);
        } else if (spot) {
          this._say(pick(this._goldSpot(F) ? ['da!', 'da funkelt was!', 'da, ein Stern!'] : ['da!', 'da hinten!', 'da fliegt was!']), 1300);
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
    } catch (e) {
      this._goldDrop(F);
      throw e;
    }
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
    // _giftScene endet hier: Steht die Gießkanne jetzt neben der Tür (oder nicht mehr), rücken die Gummistiefel der
    // Garderobe gleich zur Seite bzw. zurück (_sigBootSpot), nicht erst beim nächsten Takt
    this._sigWearSync();
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
    const F = []; // Herzchen des goldenen Plüsch-Pinos (bei Abbruch gleich weg)
    let ok = false;
    try {
      if (this._action !== 'giftOpen') {
        await this._walkTo(hole.cx + pW * 0.15, 1);
        this._face(-1);
        await this._wait(500);
        // Der Plüsch-Pino heißt wie Pino (friend_name), nicht wie der Gast, der zuletzt da war (_frGuest)
        this._say(pick([`komm, ${this._frName()}!`, 'hab dich!']), 1200);
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
      // Golden: Ab und zu steigt beim Kuscheln ein winziges goldenes Herz auf (zwei Gelegenheiten je Kuscheln)
      await this._wait(ms / 4);
      this._goldHeart(F);
      await this._wait(ms / 4);
      p.classList.add('squint');
      this._happy(1500);
      await this._wait(ms / 4);
      this._goldHeart(F);
      await this._wait(ms / 4);
      p.classList.remove('squint', 'tilt', 'content');
      this._say(pick(['bis heut Abend!', 'ab ins Bett mit dir!', '♥']), 1200);
      await this._wait(900);
      ok = true;
    } finally {
      if (!ok) this._goldDrop(F);
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
    const F = [];
    try {
      await this._wait(450);
      // Golden: „bling“, am Brillenrand blitzt ein Stern auf
      if (this._goldOk(3)) this._goldBling(F);
      p.classList.add('wink');
      this._say(pick(['lässig!', 'na?', 'cool, oder?']), 1300);
      await this._wait(1100);
      p.classList.remove('wink');
      await this._wait(300);
      p.classList.remove('shup');
      await this._wait(800);
    } catch (e) {
      this._goldDrop(F);
      throw e;
    }
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

  // ---------- Gold mit Wirkung (Stufe 3, seit 0.44) ----------
  // Jeder goldene Schatz hat eine kleine Zugabe. Sie ist Zierde auf diesem Gerät: Nichts davon steht im Plan oder im
  // Zustand, und wann eine zuletzt kam, merkt sich nur diese Karte bis zum Neuladen (_goldAt). Was an einer Aktion
  // hängt, räumt deren Abbruch weg (_goldDrop); was von selbst kommt (Windrad, Glöckchen, Reflex, Herzchen nachts),
  // dauert höchstens drei Sekunden und verschwindet mit seinem Zeitgeber oder mit _goldClear.

  // Darf die Zugabe des Schatzes t jetzt? Nur golden und schon ausgepackt (giftLvs: wie .gilt in der Szene), nicht
  // solange er verreist ist, nicht wenn keiner hinsieht. k: Eintrag in GOLD mit Abstand und Wahrscheinlichkeit (ohne:
  // nur die Stufe). Die Vorschau (_dbgGold) überspringt Abstand und Würfel.
  _goldOk(t, k = null) {
    if (!this._g || !this._giftOn() || this._urlaubFern() || this._away()) return false;
    if (!(giftLvs(this._plan?.gift, this._giftHide)[t] >= 3)) return false;
    if (!k || this._dbgGold) return true;
    const at = (this._goldAt ??= {});
    const now = Date.now();
    if (!goldDue(GOLD[k], at[k], now, Math.random())) return false;
    at[k] = now;
    return true;
  }

  // Ein Gold-Teilchen in die Effekt-Ebene (Stil .gfx.<kind>, src/stil/paeckchen.js) an die Stelle x/y (px der Szene).
  // Bei „Bewegung reduzieren“ steht es still (.still: blendet am Platz ein und aus). ms: Lebensdauer ab delay, danach
  // räumt es sich selbst weg. vars: CSS-Variablen (Drift --dx/--dy). Jedes steht in _goldEls, bis es weg ist.
  _goldFx(kind, x, y, { ms = 1200, html = GOLD_STAR, vars = null, delay = 0 } = {}) {
    const el = document.createElement('span');
    el.className = `gfx ${kind}${calmMotion() ? ' still' : ''}`;
    el.innerHTML = html;
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
    for (const [n, v] of Object.entries(vars || {})) el.style.setProperty(n, v);
    if (delay) el.style.animationDelay = `${delay}ms`;
    this._el.fx.appendChild(el);
    (this._goldEls ??= new Set()).add(el);
    setTimeout(() => this._goldDrop([el]), ms + delay);
    return el;
  }

  // Diese Teilchen sofort wegnehmen (Abbruch der Aktion, Ende der Lebensdauer)
  _goldDrop(F) {
    for (const el of F.splice(0)) {
      this._goldEls?.delete(el);
      el.remove();
    }
  }

  // Alles Goldene dieser Karte abräumen (Karte aus dem DOM): Teilchen, Zeitgeber der Vogel-Antwort, Reflex, Schimmer
  _goldClear() {
    clearTimeout(this._goldBellT);
    this._goldDrop([...(this._goldEls || [])]);
    this._el?.pika.classList.remove('gsheen', 'gglow');
    this._gtEls?.get(5)?.classList.remove('gshim', 'gglow');
  }

  // Kasten eines Elements in Pixeln der Szene; null, wenn es nicht zu messen ist (nicht im Bild)
  _goldBox(el) {
    const r = el?.getBoundingClientRect?.();
    if (!r || !r.width) return null;
    const s = this._el.scene.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  }

  // Funkenspur: pts = [[x, y, Verzögerung in ms], …] entlang des Wegs. Ruhig: ein einzelner stiller Funke am Ziel.
  _goldTrail(F, pts) {
    if (!pts.length || Math.abs(pts[pts.length - 1][0] - pts[0][0]) < 6) return;
    if (calmMotion()) {
      const [x, y] = pts[pts.length - 1];
      F.push(this._goldFx('trail', x, y - this._H * 0.04, { ms: 1400 }));
      return;
    }
    for (const [x, y, delay] of pts) F.push(this._goldFx('trail', x, y + rnd(-0.015, 0.015) * this._H, { ms: 900, delay }));
  }

  // Goldenes Wollknäuel: Es bleibt liegen, wo er es hingestupst hat (from), und kullert dann von selbst vor seine Pfoten
  async _goldYarnBack(el, from, F) {
    const p = this._el.pika;
    const { pW, fMin, fMax, gy } = this._g;
    const W = this._W;
    await this._wait(800);
    const to = clamp(this._x + this._dir * pW * 0.5, fMin * W, fMax * W);
    if (Math.abs(to - from) < 8) return;
    p.classList.add('look-f');
    this._say(pick(['nanu?', 'oh?']), 900);
    this._yarnXf = to / W;
    this._yarnRot = (this._yarnRot || 0) + ((to - from) / (Math.PI * this._H * 0.075)) * 360;
    el.style.transition = 'left 1.4s cubic-bezier(.35, .1, .3, 1)';
    el.style.left = `${to.toFixed(1)}px`;
    el.querySelector('svg').style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
    this._goldTrail(F, [...Array(5).keys()].map((k) => [from + (to - from) * (k + 0.5) / 5, gy - this._H * 0.055, 250 + k * 190]));
    await this._wait(1500);
    p.classList.remove('look-f');
    this._mimik('awe', 1000);
    this._say(pick(['es kommt zurück!', 'von ganz allein!', 'Zauberknäuel!']), 1300);
    await this._wait(1000);
  }

  // Goldenes Windrad: Dreht es sich schnell (angepustet, angetippt: k 'wheel'; echter Wind: 'wheelWind'), wirft es ein
  // paar goldene Lichtfunken, die über die Wiese treiben (weg vom Bau, bei viel Wind weiter). Ruhig: ein stiller
  // Funke an der Nabe.
  _goldWheel(k = 'wheel') {
    const el = this._gtEls?.get(1);
    if (!el?.isConnected || !this._goldOk(1, k)) return;
    const B = this._goldBox(el);
    const hx = B ? B.x + B.w / 2 : Math.min(this._g.hayR + this._H * 0.05, this._g.fMax * this._W);
    const hy = B ? B.y + B.w / 2 : this._g.gy - this._H * 0.19; // Nabe: eine halbe Breite unter der Oberkante
    const dir = hx <= this._W / 2 ? 1 : -1;
    const far = clamp((this._wind || 0) / 40, 0, 1) * 0.1;
    for (let i = 0, n = calmMotion() ? 1 : 3; i < n; i++) {
      this._goldFx('glint', hx, hy + (n > 1 ? rnd(-0.02, 0.02) * this._H : 0), {
        ms: 2500, delay: i * 280,
        vars: { '--dx': `${(dir * this._W * (far + rnd(0.14, 0.32))).toFixed(1)}px`, '--dy': `${(this._H * rnd(-0.04, 0.11)).toFixed(1)}px` },
      });
    }
  }

  // Goldener Plüsch-Pino: ein winziges goldenes Herz steigt auf. Am Tag beim Kuscheln auf der Wiese (F: Teilchen der
  // Aktion), nachts über dem Bett im Bau (night, aus dem Takt).
  _goldHeart(F, night = false) {
    if (!this._gtEls?.has(2) || !this._goldOk(2, night ? 'heartNight' : 'heart')) return;
    const { hole, gy } = this._g;
    const out = this._plushX != null;
    const x = out ? this._plushX : hole.l + (hole.r - hole.l) * 0.32;
    const y = out ? gy - this._H * 0.13 : hole.lip - this._H * 0.08;
    const el = this._goldFx('heart', x, y, { ms: 1800, html: GOLD_HEART, vars: { '--dx': `${(rnd(-0.03, 0.03) * this._H).toFixed(1)}px` } });
    F?.push(el);
  }

  // Goldene Sonnenbrille, hochgeschoben: ein Stern blitzt am äußeren Rand auf (ruhig: Er blendet nur ein und aus)
  _goldBling(F) {
    const { pW, pH, gy } = this._g;
    const B = this._goldBox(this._el.pika.querySelector('.shades'));
    const x = B ? B.x + B.w * (this._dir > 0 ? 0.95 : 0.05) : this._x + this._dir * pW * 0.37;
    const y = B ? B.y + B.h * 0.1 : gy - pH * 0.69 - (this._lift || 0) - this._laneDy();
    F.push(this._goldFx('bling', x, y, { ms: 800 }));
  }

  // Goldene Sonnenbrille bei Sonne: Ab und zu wandert ein kleiner Lichtreflex über die Gläser (aus dem Takt). Ruhig
  // glimmt er nur auf (.gglow). Beide Klassen stehen in GIFT_CLS, _cleanup nimmt sie mit.
  _goldSheen() {
    if (!this._goldOk(3, 'sheen')) return;
    this._cls(calmMotion() ? 'gglow' : 'gsheen', 1500, true);
  }

  // Goldenes Fernrohr: was er entdeckt, dort wo er hinschaut. Am Tag ein winziges Flugzeug in der Ferne, in Dämmerung
  // und Nacht ein Stern, der aufblinkt. → true: Stern
  _goldSpot(F) {
    const sc = this._el.scene.classList;
    const dark = sc.contains('dusk') || sc.contains('night');
    const x = clamp(this._x + this._dir * this._W * rnd(0.15, 0.35), 14, this._W - 14);
    F.push(this._goldFx(dark ? 'star' : 'plane', x, this._sy(rnd(0.08, 0.2)), {
      ms: 2400, html: dark ? GOLD_STAR : GOLD_PLANE,
      vars: { '--dx': `${(this._dir * this._H * 0.1).toFixed(1)}px`, '--fl': String(this._dir) },
    }));
    return dark;
  }

  // Goldene Hängematte, solange er darin döst: Ein Schmetterling oder ein Glühwürmchen setzt sich auf ein Gestell,
  // sonst läuft ein langsamer Schimmer übers Netz (wer kommt: goldHamGuest; die Vorschau wählt mit _dbgHam).
  // F: nimmt das Teilchen des Besuchs auf. → Funktion fürs Ende des Nickerchens: (ok) ok = ausgeschlafen, der Besuch
  // fliegt davon; sonst (Abbruch) ist er gleich weg
  _goldHam(el, F) {
    const sc = this._el.scene.classList;
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const kind = this._dbgHam || goldHamGuest({
      mo: (new Date(this._dbgDate ?? Date.now()).getMonth() + (south ? 6 : 0)) % 12,
      dark: sc.contains('dusk') || sc.contains('night'), summer: this._skySummer(),
      wet: !!(this._wx.wet || this._wx.snowcover), cold: !!this._wx.cold, wind: this._wind, flies: this._cfg.fireflies,
    });
    const calm = calmMotion();
    if (kind === 'shim') {
      const c = calm ? 'gglow' : 'gshim';
      el.classList.add(c);
      return () => el.classList.remove(c);
    }
    // Spitze eines der beiden Gestelle (GIFT_HAMMOCK: 60 × 20, die Spitzen bei x 5 und 55, y 2)
    const w = this._g.pW * GIFT_HAM_W;
    const side = pick([-1, 1]);
    const x = this._giftX(5) + side * w * (25 / 60);
    const y = this._g.gy + 2 - (w / 3) * 0.9;
    const g = this._goldFx(kind === 'bfly' ? 'hbfly' : 'hff', x, y, { ms: 90000, html: kind === 'bfly' ? BFLY_SVG(pick(BFLY_COLORS)) : GOLD_FIREFLY });
    F.push(g);
    // Der Schmetterling flattert nach ein paar Sekunden Dösen heran (ruhig: Er blendet am Platz ein, Stil .still)
    const at = (dx, dy, o) => ({ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`, opacity: o });
    const dx = side * this._W * rnd(0.3, 0.5);
    const dy = -this._H * rnd(0.3, 0.45);
    const fly = kind === 'bfly' && !calm ? g.animate?.([at(dx, dy, 0), { ...at(dx * 0.55, dy * 0.75, 1), offset: 0.3 },
      { ...at(dx * 0.2, dy * 0.2, 1), offset: 0.7 }, { ...at(dx * 0.05, dy * 0.3, 1), offset: 0.88 }, at(0, 0, 1)],
    { duration: 2800, delay: 2500, easing: 'ease-out', fill: 'backwards' }) : null;
    return (ok) => {
      if (!ok || calm || !g.isConnected) {
        fly?.cancel();
        this._goldDrop([g]);
        return;
      }
      g.classList.add('off');
      setTimeout(() => {
        fly?.cancel();
        this._goldDrop([g]);
      }, 800);
    };
  }

  // Goldene Gießkanne: Eine der neuen Blumen (neu, von _addFlower) wird eine goldgelbe Sonnenblume. Sie bleibt eine
  // ganz normale Wiesenblume im selben Platz von _flowers: dieselben Felder (xf, color, el), color ist das Gelb der
  // Wiesenpalette (an der Farbe hängen Sammeln, Knabbern, Blumengeschenk und der Wechsel der Jahreszeit), nur die
  // Grafik ist eine andere (GOLD_FLOWER, dieselben Lichtvariablen wie FLOWER_SVG) und gold merkt, dass sie es ist.
  // Wechselt die Jahreszeit, malt _light sie als gewöhnliche Blume neu. Höchstens eine zugleich. Ohne Gelb in der
  // Palette (Winter: verblasste Samenstände) und solange schon eine steht: goldene Funken über den frisch Gegossenen.
  // → true: eine goldene Blume ist gewachsen
  _goldBloom(neu, sx, F) {
    const gelb = this._flowerPal().find((c) => GOLD_BLOOM.includes(c));
    const f = neu[Math.floor(neu.length / 2)];
    const { gy } = this._g;
    if (!f || !gelb || this._flowers.some((o) => this._goldIsBloom(o))) {
      const n = calmMotion() ? 1 : 5;
      for (let i = 0; i < n; i++) {
        F.push(this._goldFx('trail', sx + (n > 1 ? rnd(-0.09, 0.09) * this._H : 0), gy - this._H * rnd(0.06, 0.16), { ms: 900, delay: i * 130 }));
      }
      return false;
    }
    f.gold = true;
    f.color = gelb;
    f.el.classList.add('gbloom');
    f.el.innerHTML = GOLD_FLOWER(gelb, flowerMid(gelb));
    this._flowerTint(f);
    // … und geht mit einem Funken auf
    F.push(this._goldFx('trail', f.xf * this._W, gy - this._H * 0.13, { ms: 900, delay: 1000 }));
    return true;
  }

  // Ist f die goldene Blume, und sieht sie noch so aus? (Nach einem Wechsel der Jahreszeit ist sie eine gewöhnliche.)
  _goldIsBloom(f) {
    return !!f.gold && !f.el.classList.contains('picked') && !!f.el.querySelector('.gsun');
  }

  // Goldenes Glöckchen hat gebimmelt: Ein Vogel antwortet. Sitzt gerade einer da, zwitschert er zurück (_tweet), sonst
  // kommt ein kurzes Zwitschern vom Bildrand gegenüber dem Bau. Besuche legt das nicht an und verschiebt sie nicht:
  // Die folgen der Uhr und sind auf allen Geräten gleich. Das Glockenspiel bimmelt mehrmals: eine Antwort (GOLD.bell).
  _goldBell() {
    if (!this._goldOk(7, 'bell')) return;
    clearTimeout(this._goldBellT);
    this._goldBellT = setTimeout(() => {
      if (!this._goldOk(7)) return;
      if (this._bird?.sitting) return this._tweet(this._bird);
      const side = this._g.hole.cx < this._W / 2 ? 1 : -1;
      const x = side > 0 ? this._W - this._H * 0.07 : this._H * 0.07;
      const y = this._sy(rnd(0.3, 0.42));
      for (let i = 0, n = calmMotion() ? 1 : 2; i < n; i++) {
        this._goldFx('tweet', x, y + i * this._H * 0.05, { ms: 1500, delay: i * 260, html: i ? '♫' : '♪', vars: { '--dx': `${(-side * rnd(8, 18)).toFixed(1)}px` } });
      }
    }, 900);
  }

  // Golden: ab und zu ein Funkeln (auch an der goldenen Blume der Gießkanne)
  _giftGlint() {
    if (this._asleep || !this._gtEls || Math.random() > 0.2) return;
    const gl = [...this._gtEls.values(), ...(this._a2Els?.values() || [])].filter((el) => el.classList.contains('gilt') && el.isConnected);
    for (const f of this._flowers || []) if (this._goldIsBloom(f) && f.el.isConnected) gl.push(f.el);
    if (!gl.length) return;
    const el = pick(gl);
    const r = el.getBoundingClientRect();
    const sc = this._el.scene.getBoundingClientRect();
    if (r.width) this._sparkle(r.left - sc.left + r.width * rnd(0.3, 0.7), r.top - sc.top + r.height * rnd(0.1, 0.5), 1);
  }
}
