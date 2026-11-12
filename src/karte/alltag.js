// Alltag: umsehen, hoppeln, Aussichtsstein, Bau, putzen, piepsen, hungrig sein

import { rnd, pick, clamp } from '../logik/hilfen.js';

export class Alltag {
  async _idle() {
    // Glücklich: mit zufriedenem ω-Mund dasitzen
    if (this._get('g') > 75 && Math.random() < 0.35) this._el.pika.classList.add('content');
    else if (this._el.pika.classList.contains('sad') && Math.random() < 0.6) this._mimik('sad');
    await this._wait(rnd(2000, 5000));
  }

  async _look() {
    const n = 1 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      const c = pick(['look-f', 'look-b', 'look-up']);
      this._el.pika.classList.add(c);
      await this._wait(rnd(700, 1700));
      this._el.pika.classList.remove(c);
      await this._wait(rnd(200, 600));
    }
  }

  async _wander() {
    const { pW, home } = this._g;
    let x = Math.random() < 0.3
      ? rnd(home, this._W)
      : this._x + rnd(pW * 0.6, Math.max(pW, this._W * 0.4)) * pick([-1, 1]);
    // Bei Regen nicht weit weg vom Bau
    if (this._wx.wet) x = rnd(home, home + this._W * 0.35);
    // Tiefe: manchmal auf die hintere Spur, über die ganze Wiese, hinter Heu und Stein vorbei (_laneRange; beide
    // stehen auf der Bühne davor und verdecken ihn). _laneNext erzwingt die Spur, _laneX die Stelle (Vorschau).
    let lane = 0;
    if (this._cfg.depth) {
      const [l, r] = this._laneRange();
      const want = this._laneNext ?? (this._wx.wet ? 0 : Math.random() < 0.4 ? 1 : 0);
      this._laneNext = null;
      if (want && r - l > pW * 0.3) {
        lane = 1;
        x = this._laneX != null ? clamp(this._laneX, l, r) : rnd(l, r);
      }
    }
    this._laneX = null;
    await this._walkTo(x, 1, false, lane);
    await this._wait(rnd(400, 1400));
  }

  // ---------- Aussichtsstein ----------

  // Auf den Stein springen, Ausschau halten und pfeifen, wieder herunter
  async _lookout() {
    const { rock } = this._g;
    await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1));
    await this._wait(rnd(200, 600));
    // Sitzt ein Vögelchen auf dem Stein, fliegt es vorher weg
    if (this._bird?.perch === 'rock') {
      this._bird.scare();
      await this._wait(600);
    }
    await this._hopTo(rock.cx, rock.lift);
    this._puff(rock.cx, this._g.gy - rock.lift, 2);
    await this._wait(rnd(400, 900));
    const n = 3 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.5 || i === 0) await this._call();
      else if (r < 0.75) this._face(-this._dir);
      else {
        this._el.pika.classList.add('look-up');
        await this._wait(rnd(800, 1400));
        this._el.pika.classList.remove('look-up');
      }
      await this._wait(rnd(700, 1800));
    }
    await this._hopDown();
  }

  // Pfiff: aufrichten, Maul auf, iiep – manchmal zweimal hintereinander
  async _call() {
    const p = this._el.pika;
    const twice = Math.random() < 0.3;
    for (let i = 0; i < (twice ? 2 : 1); i++) {
      p.classList.remove('calling');
      void p.offsetWidth;
      p.classList.add('calling');
      this._say(pick(['iiiep!', 'iiep!', 'iiiiep!', 'mip!']), 900);
      await this._wait(650);
      p.classList.remove('calling');
      if (twice) await this._wait(250);
    }
    await this._wait(300);
  }

  async _hopDown() {
    await this._hopTo((Math.random() < 0.5 && this._footX(1)) || this._footX(-1), 0);
    this._puff(this._x, this._g.gy, 3);
  }

  // Staubwölkchen bei der Landung
  _puff(x, y, n) {
    const { pW } = this._g;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'puff';
      const side = i % 2 ? 1 : -1;
      el.style.left = `${x + side * rnd(pW * 0.1, pW * 0.3)}px`;
      el.style.top = `${y - this._H * 0.03}px`;
      el.style.setProperty('--px', `${side * rnd(this._H * 0.03, this._H * 0.07)}px`);
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 650);
    }
  }

  // Absprungstelle neben dem Stein (side -1 links, 1 rechts). Rechts null, wenn dort kein Platz ist.
  _footX(side) {
    const { rock, pW } = this._g;
    const x = rock.cx + side * (rock.w / 2 + pW * 0.15);
    if (side > 0) return x > this._g.xR ? null : x;
    return Math.max(x, pW * 0.45);
  }

  async _hopTo(x, lift, crouch = true) {
    const { pW } = this._g;
    // wie beim Laufen im Bild bleiben (auf den Stein darf er immer ganz nach rechts)
    x = clamp(x, pW * 0.45, lift > 0 ? this._W - pW * 0.45 : this._g.xR);
    if (Math.abs(x - this._x) > 2) this._face(x > this._x ? 1 : -1);
    const p = this._el.pika;
    p.classList.remove('lnd'); // das Nachwippen der Landung verdeckte sonst den Anlauf
    if (crouch) {
      p.classList.add('crouch');
      await this._wait(180);
      p.classList.remove('crouch');
    }
    p.style.transition = 'transform .55s cubic-bezier(.3, .6, .4, 1)';
    this._lift = lift;
    this._lane = 0;
    this._setX(x);
    this._jump('hop1', true);
    await this._wait(620);
  }

  // ---------- Bau ----------

  // Rein, ein paarmal herausschauen, wieder raus
  async _burrow() {
    if (!this._inside) await this._enterBurrow();
    await this._wait(rnd(1500, 4000));
    const n = 1 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      await this._peekOut();
      if (i < n - 1) {
        await this._to('hidden', 450);
        await this._wait(rnd(1200, 3500));
      }
    }
    await this._comeOut();
  }

  async _shelter() {
    this._say('!');
    await this._enterBurrow(1.4);
    await this._wait(rnd(800, 1600));
    await this._peekOut();
  }

  async _hideout() {
    if (this._poseName !== 'hidden') await this._to('hidden', 450);
    await this._wait(rnd(2500, 7000));
    await this._peekOut();
  }

  // lookBack: in der Tür dreht er sich noch einmal um und schaut zurück (Schlafengehen)
  async _enterBurrow(speed = 1, lookBack = false) {
    await this._walkTo(this._g.home, speed);
    this._setX(this._g.home, true);
    this._inside = true;
    await this._to('door', 450);
    if (lookBack) {
      this._face(-this._dir);
      await this._wait(500);
      this._blink();
      await this._wait(700);
    }
    await this._wait(150);
    await this._to('hidden', 500);
  }

  // Erst die Ohrspitzen, kurz lauschen, dann der ganze Kopf. Manchmal duckt er sich noch einmal weg.
  async _peekOut() {
    await this._to('ears', 420);
    this._twitch();
    await this._wait(rnd(500, 1100));
    if (Math.random() < 0.25) {
      await this._to('hidden', 220);
      await this._wait(rnd(600, 1200));
      await this._to('ears', 300);
      await this._wait(rnd(300, 600));
    }
    await this._to('peek', 380);
    const p = this._el.pika;
    const n = 2 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      await this._wait(rnd(600, 1500));
      const r = Math.random();
      if (r < 0.45) this._face(-this._dir);
      else if (r < 0.7) {
        p.classList.add('look-up');
        await this._wait(rnd(700, 1200));
        p.classList.remove('look-up');
      } else if (r < 0.85) this._say(pick(['iiep!', 'mip!']));
      else this._twitch();
    }
    await this._wait(rnd(500, 1000));
  }

  async _comeOut() {
    if (this._poseName !== 'peek') await this._to('peek', 450);
    await this._wait(rnd(300, 700));
    await this._to('door', 350);
    this._inside = false;
    // groß werden und dabei aus der Tür nach vorn hüpfen
    this._face(1);
    this._giftBell();
    this._pose('out', 450);
    await this._hopTo(this._g.home + this._g.pW * 0.35, 0, false);
    this._puff(this._x, this._g.gy, 2);
  }

  async _to(name, ms) {
    this._pose(name, ms);
    await this._wait(ms);
  }

  // Haltung im Bau: door = steht im Eingang, peek = Kopf schaut heraus, sleep = Mütze und Augen,
  // hidden = ganz drin, out = draußen in voller Größe
  _pose(name, ms) {
    if (!this._g || !name) return;
    this._poseName = name;
    const { pH, pW, gy, hole } = this._g;
    const p = this._el.pika;
    const cw = this._el.clipw;
    const top = gy - pH * 0.945;
    const L = this._x - pW / 2;
    const open = `inset(${-pH}px ${-pW}px ${-pH * 0.3}px ${-pW}px round 0px 0px 0px 0px)`;
    // clip-path lässt sich nur zwischen gleichen Formen überblenden
    if (!cw.style.clipPath) {
      cw.style.transition = 'none';
      cw.style.clipPath = open;
      void cw.offsetWidth;
    }
    const tr = ms ? `${ms}ms cubic-bezier(.45, 0, .4, 1)` : '0s';
    cw.style.transition = `clip-path ${tr}`;
    this._el.depth.style.transition = `transform ${tr}`;
    if (name === 'out') {
      p.classList.remove('inside');
      this._pikaZ();
      cw.style.clipPath = open;
      this._bubbleRefit();
      return;
    }
    const hw = hole.r - hole.l;
    // Im Bau ein Stück kleiner als die Tür (weiter hinten). Beim Fernsehen sitzt er noch weiter drinnen,
    // damit man das Licht vom Fernseher um ihn herum sieht.
    const ds = clamp((0.85 * hw) / (0.43 * pW), 0.4, 0.9) * (name === 'tv' ? 0.68 : 0.8);
    const v = { door: 0.945, peek: 0.6, sleep: 0.53, ears: 0.25, hidden: -0.15, tv: 0.8 }[name];
    const px = (n) => `${n.toFixed(1)}px`;
    cw.style.clipPath = `inset(${px(hole.top - top)} ${px(L + pW - hole.r)} ${px(top + pH - hole.lip)} ${px(hole.l - L)} `
      + `round ${px(hw / 2)} ${px(hw / 2)} 0px 0px)`;
    const s = p.style;
    s.setProperty('--ds', ds.toFixed(3));
    s.setProperty('--dy', px(hole.lip + pH * ds * (1 - v) - (top + pH)));
    s.setProperty('--hc', px(hole.cx - this._x));
    s.setProperty('--hh', px(0.22 * pW * ds));
    // Sprechblase rechts neben dem Eingang (die Blasen hängen an der Sprech-Ebene)
    const ts = this._el.psay.style;
    ts.setProperty('--ax', px(hole.r - L + hw * 0.02));
    ts.setProperty('--ay', px(hole.top - top + pH * 0.02));
    p.classList.add('inside');
    this._pikaZ();
    this._bubbleRefit();
  }

  async _groom() {
    this._el.pika.classList.add('groom');
    await this._wait(rnd(1800, 3200));
  }

  async _squeak() {
    const p = this._el.pika;
    p.classList.add('calling');
    this._say(pick(['iiep!', 'iiep!', 'mip!', 'iiiep!']));
    this._jump('hop1');
    await this._wait(650);
    p.classList.remove('calling');
    await this._wait(950);
  }

  async _binky() {
    this._jump('binky');
    await this._wait(1100);
  }

  async _hungry() {
    this._announce('hat Hunger');
    this._thinkReset(true);
    this._bubble(this._el.think, true);
    this._el.pika.classList.add('look-up');
    this._mimik('sad');
    await this._wait(3500);
  }
}
