// Päckchen: Pflege-Serie, Knopf, Ballon, Zwille, Auspacken, Schätze in der Szene

import { rnd, pick, clamp, seeded, seedRnd } from '../logik/hilfen.js';
import { RATE, sec } from '../logik/zustand.js';
import { PLAN_MIN, pikaDay, planParse } from '../logik/tagesplan.js';
import { GIFT, GIFT_TRE, giftLv, giftLvs, giftOwned } from '../logik/paeckchen.js';
import {
  GIFT_LOW, GIFT_ITEMS, GIFT_PAPER, GIFT_BALLOONS, GIFT_GOLD, GIFT_TRICK, GIFT_GILT, GIFT_PARCEL, GIFT_BALLOON,
  GIFT_HAMMOCK, GIFT_WHEEL,
} from '../grafik/paeckchen.js';

export class Paeckchen {
  // Pflege-Serie (Tagesplan-Feld gift), Knopf mit Fortschrittsring und Album, Ballon mit Zwille, Auspacken, Leckerli und
  // Schätze in der Szene. Was alle Geräte wissen müssen, steht im Plan. Ballon, Zwille und Auspacken zeigt jedes Gerät
  // selbst: Der Ballon schwebt nach fester Zeitleiste ab dem Verschenken (G.x) herein, ausgepackt ist es, sobald es
  // ein Gerät gezeigt hat (G.o). Geräte, auf denen gerade jemand zuschaut, zeigen es trotzdem noch zu Ende (der Pika
  // schießt und packt dort fast gleichzeitig aus); wo keiner zuschaut oder er schläft, verschwindet der Ballon.

  _giftOn() {
    return !!this._cfg?.gifts;
  }

  // Pflege bewerten. Zwischen zwei Änderungen sinken alle drei Werte nur (satt und glücklich gleichmäßig, sauber nach dem
  // festen Häufchen-Plan). Seit wann einer unter GIFT.min liegt, lässt sich darum jederzeit ausrechnen, auch wenn keiner
  // zugeschaut hat. Läuft vor jeder Änderung (dann steht ein Absinken fest, bevor es überdeckt wird), danach mit user (du
  // hast etwas getan: ist jetzt alles wieder darüber, endet die Lücke) und beim Tick. → { G, frac, left, warn, broken }
  _careEval(user = false) {
    if (!this._giftOn() || !this._stats || !this._plan || !this._planOk || this._planStale) return null;
    if (this._cfg.entity && !this._noEntity && !this._synced) return null;
    const now = this._haNow();
    if (!this._plan.gift) this._planOp({ t: 'gstart', k: sec(now) });
    let G = this._plan.gift;
    if (!G) return null;
    const min = GIFT.min;
    const st = this._stats;
    const lowS = ['s', 'g'].filter((k) => this._raw(k) < min);
    const lowC = this._poops().clean < min;
    const bad = lowS.length > 0 || lowC;
    // Seit wann? Nur nötig, solange es noch nicht feststeht
    const low = [];
    if (bad && G.b == null) {
      for (const k of lowS) low.push(st[k] > min ? this._decayAt(st[k + 't'], (st[k] - min) / RATE[k]) : st[k + 't']);
    }
    if (lowC && bad && G.b == null) {
      // Zeitpunkt eingrenzen (auf der Uhr der Häufchen, die in der Vorschau verstellt sein kann)
      const sh = this._now() - now;
      let lo = Math.max(G.k, now - 2 * 864e5) + sh;
      let hi = now + sh;
      if (this._poops(lo).clean < min) hi = lo;
      else {
        for (let i = 0; i < 16; i++) {
          const m = (lo + hi) / 2;
          if (this._poops(m).clean < min) hi = m;
          else lo = m;
        }
      }
      low.push(hi - sh);
    }
    // Nicht gleich nach der Entwarnung eines anderen Geräts (_hassPlan): Dessen Zustand ist noch unterwegs, der eigene
    // bis dahin veraltet. Liegt wirklich noch etwas darunter, steht es beim nächsten Tick fest.
    if (low.length && Date.now() >= (this._careHold || 0)) this._planOp({ t: 'gbad', k: G.k, b: sec(clamp(Math.min(...low), G.k, now)) });
    G = this._plan.gift;
    const over = G.b != null && this._awakeMs(G.b, now) > GIFT.grace;
    // Verdient bis jetzt bzw. bis die Serie riss. Gezählt wird ab p (bis dahin sind die a verdient), nicht jedes Mal
    // ab Serienbeginn: so verschiebt eine geänderte Schlafenszeit nichts rückwirkend, und auch eine lange Serie
    // rechnet nur die letzten Stunden. Ohne p (Stand einer älteren Version) einmal aus k und a nachrechnen.
    const end = G.b == null ? now : Math.min(now, this._awakeAdd(G.b, GIFT.grace));
    const p = G.p ?? this._awakeAdd(G.k, G.a * GIFT.every);
    const awake = Math.max(0, this._awakeMs(p, end));
    const de = Math.floor(awake / GIFT.every);
    if (de > 0 || G.p == null) this._planOp({ t: 'gearn', k: G.k, e: G.a + de, p: sec(this._awakeAdd(p, de * GIFT.every)) });
    const w = Math.floor((now - G.k) / GIFT.gold);
    if (!over && w > G.d) this._planOp({ t: 'ggold', k: G.k, w });
    let res = { frac: (awake % GIFT.every) / GIFT.every, left: GIFT.every - (awake % GIFT.every), warn: G.b != null && !over, broken: over };
    if (!bad && user && G.b != null) {
      this._planOp({ t: 'gok', k: G.k, b: G.b, brk: over, nk: sec(now) }); // nicht "at": das setzt _planOp
      res = over ? { frac: 0, left: GIFT.every, warn: false, broken: false } : { ...res, warn: false };
    }
    res.G = this._plan.gift;
    this._care = res;
    this._giftRender();
    return res;
  }

  // Bis der Fortschritt einmal berechnet ist, alle 0,5 s versuchen (_careEval braucht Plan, Zustand aus HA und
  // abgeglichenen Stand). Unsichtbar übernimmt das der Tick beim Sichtbarwerden.
  _careSoon() {
    if (this._care || this._careT) return;
    this._careT = setTimeout(() => {
      this._careT = null;
      if (this._care || !this._attached || this._away()) return;
      this._careEval();
      this._careSoon();
    }, 500);
  }

  // Welche Werte gerade unter GIFT.min liegen: s (Satt), g (Glück), c (Sauber), in dieser Reihenfolge
  _giftLow() {
    if (!this._stats) return [];
    const l = ['s', 'g'].filter((k) => this._raw(k) < GIFT.min);
    if (this._poops().clean < GIFT.min) l.push('c');
    return l;
  }

  // Knopf: erscheint mit dem ersten Päckchen, Ring = Fortschritt zum nächsten, Zahl = Vorrat
  _giftRender() {
    const b = this._el?.gbtn;
    if (!b) return;
    const G = this._plan?.gift;
    const on = this._giftOn() && !!G && (G.z > 0 || G.n > 0 || G.y > 0);
    if (!on) {
      b.hidden = true;
      return;
    }
    if (b.hidden) {
      b.hidden = false;
      // Zum allerersten Mal (je Gerät gemerkt): Der Knopf ploppt herein und funkelt
      let seen = true;
      const k = `pika-pet-gift:${this._cfg.name}`;
      try {
        seen = !!localStorage.getItem(k);
      } catch (e) { /* egal */ }
      if (!seen && this._g) {
        // erst jetzt merken: Stand die Szene noch nicht, käme das Funkeln sonst nie
        try {
          localStorage.setItem(k, '1');
        } catch (e) { /* egal */ }
        b.classList.add('new');
        setTimeout(() => b.classList.remove('new'), 1000);
        // um den Knopf herum (er sitzt oben rechts, auf schmalen Karten darunter)
        const bx = b.offsetLeft + b.offsetWidth / 2;
        const by = b.offsetTop + b.offsetHeight / 2;
        for (let i = 0; i < 5; i++) setTimeout(() => this._sparkle(bx + rnd(-16, 16), by + rnd(-16, 16), 1), 300 + i * 150);
        if (!this._asleep && !this._inside && this._running) this._say(pick(['oh!', 'ein Päckchen!']), 1300);
      }
    }
    const c = this._care || {};
    const n = G.n + G.y;
    const full = G.n >= GIFT.max;
    // Fortschritt noch nie berechnet (gerade geladen): Ring leer statt 0 % zeigen und gleich nachrechnen,
    // nicht erst im nächsten Takt (_tick, alle 20 s)
    b.classList.toggle('wait', !this._care && !full);
    if (!this._care) this._careSoon();
    b.style.setProperty('--gp', ((full ? 1 : c.frac || 0) * 100).toFixed(1));
    b.classList.toggle('warn', !!c.warn);
    b.classList.toggle('broken', !!c.broken && !full);
    // Was fehlt, als Zeichen am Knopf. Ist schon wieder alles darüber (nur selbst geknabbert), pulsiert der Ring nicht.
    const low = c.warn || (c.broken && !full) ? this._giftLow() : [];
    b.classList.toggle('ok', !!c.warn && !low.length);
    const ce = b.querySelector('.gcrit');
    if (ce.dataset.k !== (low[0] || '')) {
      ce.dataset.k = low[0] || '';
      ce.innerHTML = low[0] ? GIFT_LOW[low[0]][1] : '';
    }
    b.classList.toggle('empty', !n || G.z > G.o);
    b.classList.toggle('gold', G.y > 0);
    const [pp, pr] = G.y > 0 ? GIFT_GOLD : GIFT_PAPER[(G.z + 1) % GIFT_PAPER.length];
    b.style.setProperty('--gpp', pp);
    b.style.setProperty('--gpr', pr);
    b.querySelector('.gnum').textContent = n ? String(n) : '';
    b.title = n ? `Päckchen schenken (${n} da), lang drücken: Schätze` : 'Päckchen: gerade keins da, lang drücken: Schätze';
  }

  _onGiftBtn() {
    if (this._albumHeld) {
      this._albumHeld = false;
      return;
    }
    const G = this._plan?.gift;
    const b = this._el.gbtn;
    const no = () => {
      b.classList.remove('no');
      void b.offsetWidth;
      b.classList.add('no');
    };
    // Höchstens ein Ballon zugleich
    if (!G || !this._g || !this._planOk || G.z > G.o || !(G.n > 0 || G.y > 0)) return no();
    const gold = G.y > 0;
    const z = G.z + 1;
    const i = this._giftPick(G, z, gold) + (gold ? 16 : 0);
    const x = sec(this._haNow());
    this._planOp({ t: 'give', z, i, gold, x });
    if (this._plan.gift?.z !== z) return no();
    this._found('parcel');
    // Leckerli und Freude erst, wenn das Verschenken bestätigt ist (_giftCredit): Drückten zwei Geräte gleichzeitig,
    // gilt nur ein Päckchen, und nur dessen Gerät gibt die Belohnung
    this._giftOwn = { z, i, x, at: this._haNow() };
    this._giftCredit();
  }

  // Belohnung für das eigene Verschenken, sobald es im bestätigten Plan steht (mit Helfer: Stand von HA, sonst der
  // gespeicherte). Hat dort ein anderes Gerät dasselbe Päckchen verschenkt (anderes x/i), gibt es hier nichts.
  // Zählt nicht als Pflege (wie selbst Geknabbertes): Päckchen kommen aus guter Pflege, sie sollen sie nicht ersetzen.
  _giftCredit() {
    const o = this._giftOwn;
    if (!o) return;
    const H = this._cfg.plan_entity && this._planMax() >= PLAN_MIN ? planParse(this._planSt) : null;
    const G = (H || this._planBase)?.gift;
    if (G && G.z >= o.z) {
      this._giftOwn = null;
      if (G.z !== o.z || G.x !== o.x || G.i !== o.i) return;
      if ((o.i & 15) >= GIFT_TRE) this._add('s', GIFT.treat, true);
      this._add('g', GIFT.joy, true);
    } else if (this._haNow() - o.at > 30 * 6e4) this._giftOwn = null;
  }

  // Inhalt des Päckchens Nummer z, auf allen Geräten gleich: Das erste und eins von je dreien ist ein Schatz (goldene
  // immer), sonst ein Leckerli der Jahreszeit. Schatz heißt: erst einer, der noch fehlt, dann ein Trick für einen, der
  // noch keinen hat. Goldene vergolden lieber einen mit Trick, bevor sie einen neuen Trick bringen. Hat jeder Schatz
  // alles, was er aus solchen Päckchen bekommen kann, gibt es nur noch Leckerli.
  _giftPick(G, z, gold) {
    const T = [...Array(GIFT_TRE).keys()];
    const at = (lv) => T.filter((t) => giftLv(G, t) === lv);
    const miss = at(0).length ? at(0) : gold && at(2).length ? at(2) : at(1);
    const tre = miss.length && (gold || z === 1 || (z - 1) % 3 === Math.floor(seedRnd('gblk', Math.floor((z - 1) / 3)) * 3));
    if (tre) return miss[Math.floor(seedRnd('gtre', z) * miss.length)];
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const mo = (new Date().getMonth() + (south ? 6 : 0)) % 12;
    const ok = GIFT_ITEMS.map((it, n) => n).filter((n) => n >= GIFT_TRE && (!GIFT_ITEMS[n].mo || GIFT_ITEMS[n].mo.includes(mo)));
    return ok[Math.floor(seedRnd('gtreat', z) * ok.length)];
  }

  // Plan geändert: Knopf, Ballon und Schätze nachziehen
  _giftFromPlan() {
    if (!this._el) return;
    const G = this._plan?.gift;
    if (G) {
      this._giftKeep = G;
      this._planKeyGift = this._planKey;
    }
    this._giftRender();
    if (!this._g) return;
    const pend = this._giftOn() && !!G && G.z > G.o;
    const B = this._gb;
    // Abgeschaltet oder ein anderes Päckchen: weg. Auf einem anderen Gerät schon ausgepackt: Schaut hier jemand zu,
    // packt er es auch hier noch aus (sonst verschwände es vor den Augen), sonst ist es weg.
    const mine = !!B && this._giftOn() && !!G && B.z === G.z && B.item === (G.i & 15);
    const watch = this._running && !this._asleep && !this._away();
    if (B && B.stage !== 'open' && !(mine && (pend || watch))) this._giftDrop();
    if (pend && !this._gb) this._giftBalloon(G);
    this._giftScene();
  }

  _giftDrop() {
    const B = this._gb;
    if (!B) return;
    this._gb = null;
    clearTimeout(this._giftArrT);
    B.anim?.cancel();
    B.el.style.transition = 'opacity .8s';
    B.el.style.opacity = '0';
    setTimeout(() => B.el.remove(), 900);
    if (this._action === 'giftShoot' || this._action === 'giftOpen') this._interrupt();
  }

  // Wo der Ballon schwebt (Mitte des Päckchens, px): zwischen Heu und Stein, nicht unter der Statusanzeige
  _giftBalloonX(z) {
    const { fMin, fMax } = this._g;
    const w = this._H * 0.17;
    let lo = fMin * this._W;
    const hi = Math.max(lo, fMax * this._W - w * 0.3);
    const st = this._el.stats;
    if (!st.hidden && st.offsetWidth) lo = Math.min(hi, Math.max(lo, st.offsetLeft + st.offsetWidth + w * 0.6));
    return lo + seedRnd('gx', z) * (hi - lo);
  }

  // Ballon anlegen: schwebt in GIFT.arrive ms von der Seite herein, aus der der Wind kommt, dann bleibt er über der
  // Stelle, wo das Päckchen landen wird, bis der Pika wach ist und ihn herunterholt
  _giftBalloon(G) {
    const z = G.z;
    const gold = G.i >= 16;
    const H = this._H;
    const w = H * 0.17;
    const x = this._giftBalloonX(z);
    const y = this._sy(0.34);
    const [pp, pr] = gold ? GIFT_GOLD : GIFT_PAPER[z % GIFT_PAPER.length];
    const bc = gold ? '#f2c230' : GIFT_BALLOONS[Math.floor(seedRnd('gbc', z) * GIFT_BALLOONS.length)];
    const el = document.createElement('div');
    el.className = `gbal${gold ? ' gold' : ''}`;
    el.style.cssText = `--gpp:${pp};--gpr:${pr};--gbc:${bc};--gsw:${clamp((this._wind || 0) / 30, 0.35, 1.6).toFixed(2)};`
      + `left:${(x - w / 2).toFixed(1)}px;top:${(y - w * 2 * (66 / 80)).toFixed(1)}px`;
    el.innerHTML = `<div class="gdrift"><div class="gbob">${GIFT_BALLOON}</div></div>`;
    this._el.gifts.appendChild(el);
    const B = { z, el, x, gold, pp, pr, bc, item: G.i & 15, stage: 'hover' };
    this._gb = B;
    const left = G.x + GIFT.arrive - this._haNow();
    const calm = ['idle', 'look', 'wander', 'groom', 'squeak', 'curious', 'nibble'];
    if (left > 0) {
      B.stage = 'fly';
      const dx = this._windDir < 0 ? this._W - x + w : -(x + w);
      const dy = -H * 0.14;
      B.anim = el.animate([
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` },
        { transform: `translate(${(dx * 0.4).toFixed(1)}px, ${(-H * 0.06).toFixed(1)}px)`, offset: 0.55 },
        { transform: `translate(${(dx * 0.08).toFixed(1)}px, ${(H * 0.02).toFixed(1)}px)`, offset: 0.85 },
        { transform: 'none' },
      ], { duration: GIFT.arrive, easing: 'ease-out', fill: 'backwards' });
      B.anim.currentTime = Math.max(0, GIFT.arrive - left);
      clearTimeout(this._giftArrT);
      this._giftArrT = setTimeout(() => {
        if (this._gb !== B) return;
        // Angekommen (läuft die Animation hinterher, z. B. gedrosselt, steht er jetzt trotzdem an seinem Platz)
        B.anim?.finish();
        B.anim = null;
        B.stage = 'hover';
        if (calm.includes(this._action)) this._interrupt();
      }, left);
      // Er hat ihn schon kommen sehen
      if (!this._asleep && !this._inside && this._running && calm.includes(this._action)) {
        setTimeout(() => this._gb === B && this._action !== 'giftShoot' && this._say('oh?', 1000), Math.min(left, 2500));
      }
    } else if (!this._asleep && calm.includes(this._action)) this._interrupt();
  }

  _giftDue() {
    const B = this._gb;
    if (!B || this._asleep || this._wx.shelter || this._next || !this._giftOn()) return null;
    if (B.stage === 'ground') return 'giftOpen';
    return B.stage === 'hover' ? 'giftShoot' : null;
  }

  // Vom Aussichtsstein mit der Zwille: zielen (ein Auge zu), schnapp! Manchmal geht der erste daneben.
  async _giftShoot() {
    const B = this._gb;
    if (!B || B.stage !== 'hover') return;
    B.anim?.finish();
    B.anim = null;
    const p = this._el.pika;
    const { rock } = this._g;
    this._face(B.x >= this._x ? 1 : -1);
    p.classList.add('look-up');
    this._say(pick(['oh!', 'ein Ballon!', 'ein Päckchen!']), 1500);
    this._cls('sparkle', 1800);
    await this._wait(1400);
    p.classList.remove('look-up');
    await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1), 1.4);
    if (this._bird?.perch === 'rock') {
      this._bird.scare();
      await this._wait(600);
    }
    await this._hopTo(rock.cx, rock.lift);
    this._puff(rock.cx, this._g.gy - rock.lift, 2);
    this._face(B.x >= rock.cx ? 1 : -1);
    await this._wait(500);
    p.classList.add('sling');
    await this._wait(600);
    const miss = seedRnd('gmiss', B.z) < 0.35;
    for (let shot = 0; shot < (miss ? 2 : 1); shot++) {
      p.classList.add('aim', 'look-up', 'squint');
      await this._wait(rnd(1100, 1700));
      p.classList.add('snap');
      const hit = !miss || shot === 1;
      await this._giftPebble(hit);
      p.classList.remove('squint');
      if (hit) {
        this._giftPop();
        await this._wait(300);
        p.classList.remove('aim', 'look-up');
        this._say(pick(['getroffen!', 'juhu!', 'Treffer!']), 1300);
        this._jump('hop1');
      } else {
        this._say(pick(['knapp!', 'hoppla…', 'daneben!']), 1100);
        await this._wait(500);
        p.classList.remove('snap', 'aim');
        this._twitch();
        await this._wait(900);
      }
    }
    await this._wait(900);
    p.classList.remove('sling', 'snap');
    await this._hopDown();
  }

  // Steinchen aus der Zwille zum Ballon; daneben (hit = false) saust es vorbei
  async _giftPebble(hit) {
    const B = this._gb;
    if (!B || B.stage !== 'hover') return;
    const sc = this._el.scene.getBoundingClientRect();
    const f = this._el.pika.querySelector('.slf').getBoundingClientRect();
    const t = B.el.querySelector('.gb-ball').getBoundingClientRect();
    const x0 = f.left - sc.left + f.width / 2;
    const y0 = f.top - sc.top + f.height / 2;
    let x1 = t.left - sc.left + t.width / 2;
    let y1 = t.top - sc.top + t.height / 2;
    if (!hit) {
      x1 += (x1 > x0 ? 1 : -1) * t.width * 0.9;
      y1 -= t.height * 0.8;
      x1 = x0 + (x1 - x0) * 1.7;
      y1 = y0 + (y1 - y0) * 1.7;
    }
    const el = document.createElement('span');
    el.className = 'gpeb';
    el.style.left = `${x0.toFixed(1)}px`;
    el.style.top = `${y0.toFixed(1)}px`;
    this._el.fx.appendChild(el);
    const ms = hit ? 300 : 520;
    el.animate([{ transform: 'none' }, { transform: `translate(${(x1 - x0).toFixed(1)}px, ${(y1 - y0).toFixed(1)}px)`, opacity: hit ? 1 : 0 }],
      { duration: ms, easing: 'cubic-bezier(.2, .6, .5, 1)', fill: 'forwards' });
    setTimeout(() => el.remove(), ms + 40);
    await this._wait(ms);
  }

  // Plopp: Konfetti, der Ballon ist weg, das Päckchen fällt auf die Wiese und hüpft einmal auf
  _giftPop() {
    const B = this._gb;
    if (!B || B.stage !== 'hover') return;
    const sc = this._el.scene.getBoundingClientRect();
    const r = (el) => {
      const q = el.getBoundingClientRect();
      return { x: q.left - sc.left + q.width / 2, y: q.top - sc.top + q.height / 2, h: q.height, b: q.bottom - sc.top };
    };
    const ball = r(B.el.querySelector('.gb-ball'));
    const par = r(B.el.querySelector('.gb-p'));
    const cols = B.gold ? ['#f2c230', '#fff2b0', '#ffffff', '#ffd75a'] : [B.bc, ...GIFT_BALLOONS];
    for (let i = 0; i < 12; i++) {
      const c = document.createElement('span');
      c.className = 'gconf';
      const a = (i / 12) * Math.PI * 2 + rnd(-0.3, 0.3);
      const d = this._H * rnd(0.06, 0.14);
      c.style.cssText = `left:${ball.x.toFixed(1)}px;top:${ball.y.toFixed(1)}px;background:${i % 2 ? B.bc : cols[i % cols.length]};`
        + `--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d + this._H * 0.06).toFixed(1)}px;--r:${rnd(-320, 320).toFixed(0)}deg`;
      this._el.fx.appendChild(c);
      setTimeout(() => c.remove(), 1050);
    }
    this._peep(ball.x, ball.y - ball.h * 0.3, 'plopp!');
    B.anim?.cancel();
    B.el.remove();
    const el = document.createElement('div');
    el.className = `gpar${B.gold ? ' gold' : ''}`;
    el.style.cssText = `--gpp:${B.pp};--gpr:${B.pr};left:${par.x.toFixed(1)}px`;
    el.innerHTML = GIFT_PARCEL;
    this._el.gifts.appendChild(el);
    const dy = par.b - (this._g.gy + 3);
    el.animate([
      { transform: `translateY(${dy.toFixed(1)}px) rotate(-10deg)` },
      { transform: 'translateY(0) rotate(5deg) scale(1.12, .84)', offset: 0.72 },
      { transform: `translateY(${(-this._H * 0.03).toFixed(1)}px) rotate(-2deg)`, offset: 0.86 },
      { transform: 'none' },
    ], { duration: 900, easing: 'cubic-bezier(.45, 0, .7, 1)' });
    Object.assign(B, { el, x: par.x, stage: 'ground', anim: null });
    setTimeout(() => this._g && this._puff(par.x, this._g.gy, 2), 650);
  }

  // Hinhoppeln, schnuppern, Schleife aufzupfen, Deckel springt ab: Leckerli frisst er, Schätze kommen an ihren Platz
  async _giftOpen() {
    const B = this._gb;
    if (!B || B.stage !== 'ground') return;
    const p = this._el.pika;
    const { gy } = this._g;
    this._say('!', 900);
    await this._wait(350);
    // etwas Abstand, damit man Päckchen und Inhalt sieht
    const side = B.x >= this._x ? 1 : -1;
    await this._walkTo(B.x - side * this._g.pW * 0.62, 1.4);
    this._face(side);
    p.classList.add('sniff');
    await this._wait(900);
    p.classList.remove('sniff');
    p.classList.add('groom');
    await this._wait(1000);
    // Ab hier gilt es als ausgepackt, auch auf den anderen Geräten
    B.stage = 'open';
    // Stufe nach dem Auspacken (1 neu, 2 Trick, 3 golden); bis zum Verstauen zeigt die Szene noch die alte
    const PG = this._plan?.gift;
    const lv = B.item < GIFT_TRE && PG?.z === B.z ? giftLv(PG, B.item) : 1;
    this._giftHide = B.item < GIFT_TRE ? B.item : null;
    this._planOp({ t: 'gopen', z: B.z });
    const it = GIFT_ITEMS[B.item];
    let ie = null;
    try {
      B.el.querySelector('.gp-bow').classList.add('off');
      await this._wait(450);
      p.classList.remove('groom');
      B.el.querySelector('.gp-lid').classList.add('off');
      this._sparkle(B.x, gy - this._H * 0.1, B.gold ? 8 : 4);
      ie = document.createElement('div');
      ie.className = `gitem rise${B.gold ? ' gold' : ''}${lv === 3 ? ' gilt' : ''}`;
      ie.innerHTML = it.svg;
      ie.style.left = `${B.x.toFixed(1)}px`;
      ie.style.top = `${(gy - this._H * 0.2).toFixed(1)}px`;
      this._el.fx.appendChild(ie);
      this._cls('sparkle', 2600);
      this._mimik('awe', 1000);
      await this._wait(1000);
      B.el.classList.add('fade');
      if (B.item >= GIFT_TRE) {
        this._say(`${it.name}!`, 1400);
        await this._wait(1100);
        ie.classList.add('eat');
        await this._eat(it.color, 3200, it.svg);
        this._cls('mlem', 950, true);
        this._happy();
        this._jump('hop1');
        await this._wait(1300);
      } else {
        this._happy(1800);
        this._jump(B.gold ? 'binky' : 'hop1');
        const nm = it.key === 'plush' ? `Plüsch-${this._frName()}` : it.name;
        this._say(lv === 2 ? `neuer Trick: ${GIFT_TRICK[B.item]}!` : lv === 3 ? `${GIFT_GILT[B.item].replace('%', nm)}!`
          : it.key === 'plush' ? `ein ${nm}!` : it.say, 1800);
        if (lv === 3) for (let i = 0; i < 3; i++) setTimeout(() => this._g && this._sparkle(B.x, gy - this._H * 0.25, 2), 300 + i * 400);
        await this._wait(1900);
        await this._giftStow(B.item, ie, lv);
      }
    } finally {
      B.el.classList.add('fade');
      const el = B.el;
      setTimeout(() => el.remove(), 900);
      ie?.remove();
      this._giftHide = null;
      if (this._gb === B) this._gb = null;
      // Nicht nur die Schätze nachziehen: Wurde während des Auspackens schon das nächste Päckchen verschenkt, stand
      // dieses hier dem neuen Ballon im Weg (_giftFromPlan legt nur einen an, wenn keiner da ist). Jetzt kommt er.
      this._giftFromPlan();
    }
  }

  // Neuer Schatz an seinen Platz: fliegt hin und ploppt dort auf. Getragene probiert er gleich aus, einen neuen Trick
  // führt er gleich vor, golden funkelt er.
  async _giftStow(t, ie, lv = 1) {
    const key = GIFT_ITEMS[t].key;
    const p = this._el.pika;
    const sc = this._el.scene.getBoundingClientRect();
    this._giftHide = null;
    if (this._gb) this._gb.stowed = true;
    this._giftScene();
    const tgt = this._gtEls?.get(t);
    const from = ie.getBoundingClientRect();
    let to;
    if (tgt) {
      tgt.style.opacity = '0';
      to = tgt.getBoundingClientRect();
    } else {
      // Sonnenbrille und Fernrohr zum Pika, Plüsch-Pino in den Bau
      const { pW, pH, gy, hole } = this._g;
      const hx = key === 'plush' ? hole.cx : this._x + this._dir * pW * 0.25;
      const hy = key === 'plush' ? hole.top + (hole.lip - hole.top) * 0.5 : gy - pH * 0.55;
      to = { left: sc.left + hx - 4, top: sc.top + hy - 4, width: 8, height: 8 };
    }
    const k = clamp(to.width / Math.max(1, from.width), 0.1, 3);
    const cur = getComputedStyle(ie).transform;
    ie.animate([
      { transform: cur === 'none' ? 'none' : cur },
      { transform: `translate(${(to.left + to.width / 2 - from.left - from.width / 2).toFixed(1)}px, ${(to.top + to.height / 2 - from.top - from.height / 2).toFixed(1)}px) scale(${k.toFixed(2)})`, opacity: tgt ? 1 : 0.2 },
    ], { duration: 750, easing: 'cubic-bezier(.4, 0, .3, 1)', fill: 'forwards' });
    try {
      await this._wait(750);
    } finally {
      // auch bei Abbruch (Futter fällt, Bildschirm aus): sonst bliebe der Schatz bis zum Neuladen unsichtbar
      if (tgt) tgt.style.opacity = '';
    }
    ie.remove();
    if (tgt) {
      tgt.classList.add('new');
      setTimeout(() => tgt.classList.remove('new'), 800);
      this._sparkle(to.left - sc.left + to.width / 2, to.top - sc.top + to.height * 0.3, 3);
    }
    if (key === 'shades') {
      this._coolUntil = this._haNow() + 60000;
      this._giftDress();
      p.classList.add('cool');
      if (lv === 2) return this._giftShades();
      this._say(lv === 3 ? 'goldig!' : 'cool!', 1500);
      await this._wait(2500);
    } else if (lv === 2) {
      await this._wait(500);
      await this._giftTrick(t);
    } else if (lv === 3) {
      this._giftDress();
      this._say(pick(['ooh!', 'glänzt!', 'wie schön!']), 1400);
      await this._wait(1600);
    } else if (key === 'scope') {
      p.classList.add('spy', 'look-up');
      this._say('ahoi!', 1300);
      await this._wait(2400);
      p.classList.remove('spy', 'look-up');
    } else if (key === 'plush') {
      this._blush(2000);
      this._say('♥', 1300);
      await this._wait(1500);
    } else if (key === 'bell') {
      this._giftBell();
      await this._wait(1200);
    } else if (key === 'wheel') {
      p.classList.add('look-b');
      await this._wait(1500);
      p.classList.remove('look-b');
    }
  }

  // Schätze in der Szene: Windrad und Glöckchen am Bau, Plüsch-Pino nachts im Bett, auf der Wiese höchstens zwei
  // (Wollknäuel, Gießkanne, Hängematte; welche, wechselt jeden Tag, der neueste ist immer dabei)
  _giftScene() {
    if (!this._el || !this._g) return;
    const G = this._plan?.gift;
    // ohne den noch nicht ausgepackten, und den gerade ausgepackten noch auf seiner alten Stufe
    // ebenso der, der hier noch am Ballon hängt oder im Päckchen liegt (woanders schon ausgepackt)
    const B = this._gb;
    const hide = this._giftHide ?? (B && !B.stowed && B.item < GIFT_TRE && G && B.z === G.z ? B.item : null);
    const lvs = this._giftOn() ? giftLvs(G, hide) : [];
    const has = (t) => lvs[t] > 0;
    const newest = G && G.o === G.z && (G.i & 15) < GIFT_TRE ? G.i & 15 : -1;
    const day = pikaDay(this._haNow());
    let meadow = [0, 5, 6].filter(has);
    if (meadow.length > 2) {
      const rest = meadow.filter((t) => t !== newest).sort((a, b) => seeded(day, a, 71) - seeded(day, b, 71));
      meadow = [...(meadow.includes(newest) ? [newest] : []), ...rest].slice(0, 2);
    }
    const want = new Set(meadow);
    if (has(1)) want.add(1);
    if (has(7)) want.add(7);
    if (has(2) && (this._asleep || this._plushX != null)) want.add(2);
    this._el.gifts.classList.toggle('still', !!this._asleep);
    const E = (this._gtEls ??= new Map());
    for (const [t, el] of E) {
      if (want.has(t)) continue;
      el.remove();
      E.delete(t);
    }
    for (const t of want) {
      let el = E.get(t);
      if (!el) {
        const key = GIFT_ITEMS[t].key;
        el = document.createElement('div');
        el.className = `gt gt-${key === 'hammock' ? 'ham' : key}`;
        el.innerHTML = key === 'wheel' ? GIFT_WHEEL : key === 'hammock' ? GIFT_HAMMOCK : GIFT_ITEMS[t].svg;
        // Plüsch-Pino liegt vor ihm im Arm, also vor dem schlafenden Pika: eigene Ebene gleich nach ihm (unter Heu,
        // Gras, Geräten und Wetter, nicht in der Effekt-Ebene)
        (key === 'plush' ? this._el.held : this._el.gifts).appendChild(el);
        E.set(t, el);
      }
      el.classList.toggle('gilt', lvs[t] >= 3);
      if (t === 2) el.classList.toggle('out', this._plushX != null);
      this._giftPlace(t, el);
    }
    // Windrad: dreht sich mit dem Wind, bei Flaute ganz langsam (angepustet kurz schnell)
    const blow = this._haNow() < (this._blowUntil || 0);
    E.get(1)?.style.setProperty('--gws', `${blow ? 0.32 : clamp(9 - (this._wind || 0) / 4, 0.35, 9).toFixed(2)}s`);
    this._giftDress(lvs);
  }

  _giftPlace(t, el) {
    const { hole } = this._g;
    const H = this._H;
    const key = GIFT_ITEMS[t].key;
    let x;
    let top = null;
    if (key === 'wheel') x = Math.min(this._g.hayR + H * 0.05, this._g.fMax * this._W);
    else if (key === 'bell') {
      x = hole.cx + (hole.r - hole.cx) * 0.62;
      top = hole.top + (hole.lip - hole.top) * 0.06;
    } else if (key === 'plush' && this._plushX != null) {
      // tagsüber zum Kuscheln draußen auf der Wiese
      x = this._plushX;
      top = this._g.gy - H * 0.13 * 0.92;
    } else if (key === 'plush') {
      x = hole.l + (hole.r - hole.l) * 0.32;
      top = hole.lip - H * 0.085 * 0.82;
    } else x = this._giftX(t);
    el.style.left = `${x.toFixed(1)}px`;
    if (top != null) el.style.top = `${top.toFixed(1)}px`;
  }

  // Platz der Wiesen-Schätze (px): fest je Tag. Das Wollknäuel bleibt liegen, wo es hingerollt ist.
  _giftX(t) {
    const { fMin, fMax } = this._g;
    const W = this._W;
    const key = GIFT_ITEMS[t].key;
    if (key === 'yarn' && this._yarnXf != null) return clamp(this._yarnXf, fMin, fMax) * W;
    if (key === 'can') return Math.max(this._H * 0.05, this._g.hole.l - this._H * 0.07);
    const u = seeded(pikaDay(this._haNow()), t, 73);
    if (key === 'hammock') return (fMin + (0.45 + 0.25 * u) * (fMax - fMin)) * W;
    return (fMin + u * (fMax - fMin)) * W;
  }

  // Glöckchen an der Tür bimmelt (er kommt heraus, Pino kommt an)
  _giftBell(text = 'bimm!') {
    const el = this._gtEls?.get(7);
    if (!el || this._away()) return;
    el.classList.remove('ring');
    void el.offsetWidth;
    el.classList.add('ring');
    clearTimeout(this._bellT);
    this._bellT = setTimeout(() => el.classList.remove('ring'), 1700);
    const r = el.getBoundingClientRect();
    const s = this._el.scene.getBoundingClientRect();
    this._peep(r.left - s.left + r.width, r.top - s.top, text);
  }

  _layoutGift(first) {
    const B = this._gb;
    if (B && B.stage !== 'open' && (first || B.stage !== 'ground')) {
      // Ballon an festen Pixeln: neu anlegen (die Zeitleiste stimmt weiter)
      clearTimeout(this._giftArrT);
      B.anim?.cancel();
      B.el.remove();
      this._gb = null;
      if (this._action === 'giftShoot') this._interrupt();
    } else if (B?.stage === 'ground') {
      B.x = this._giftBalloonX(B.z);
      B.el.style.left = `${B.x.toFixed(1)}px`;
      if (this._action === 'giftOpen') this._interrupt();
    }
    this._giftFromPlan();
  }

  // Karte aus dem DOM (anderes Dashboard): Zeitgeber abräumen. Ein fliegender Ballon wird beim Wiederkommen nach
  // seiner Zeitleiste neu angelegt (sonst bliebe er ohne Ankunfts-Zeitgeber im Flug).
  _detachGift() {
    clearTimeout(this._albumPT);
    clearTimeout(this._bellT);
    clearTimeout(this._giftArrT);
    this._albumHeld = false;
    this._gtEls?.get(7)?.classList.remove('ring');
    const B = this._gb;
    if (B?.stage === 'fly') {
      B.anim?.cancel();
      B.el.remove();
      this._gb = null;
    }
  }

  _attachGift() {
    this._giftFromPlan();
  }

  _tickGift() {
    if (!this._g) return;
    this._careEval();
    this._giftScene();
    const G = this._plan?.gift;
    if (!G || !this._giftOn()) return;
    // Sonnenbrille bei Sonne ab 24 °C (und eine Minute nach dem Auspacken)
    const raw = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
    const e = this._dbgElev ?? this._elev;
    const sunny = ['sunny', 'clear', 'partlycloudy'].includes(raw.cond) && (e == null || e > 15) && (raw.temp ?? 0) >= 24;
    const cool = !!(giftOwned(G) & 8) && !this._wx.wet && !this._asleep && (sunny || this._haNow() < (this._coolUntil || 0));
    this._el.pika.classList.toggle('cool', cool);
    this._giftGlint();
    // Voller Vorrat: der Knopf wackelt ab und zu
    const b = this._el.gbtn;
    if (G.n >= GIFT.max && !b.hidden && Math.random() < 0.25) {
      b.classList.remove('wig');
      void b.offsetWidth;
      b.classList.add('wig');
    }
  }

  _giftActs({ wx }) {
    const G = this._plan?.gift;
    if (!this._giftOn() || !G || !G.u || this._gb) return [];
    const E = this._gtEls || new Map();
    const dry = !wx.wet && !wx.snowcover;
    const h = new Date(this._dbgDate ?? Date.now()).getHours();
    const lv = giftLvs(G);
    const dusk = this._el.scene.classList.contains('dusk') && !this._asleep;
    return [
      [E.has(0) && dry ? (lv[0] >= 2 ? 0.7 : 0.5) : 0, 'giftYarn'],
      [E.has(6) && dry && this._flowers.length < 7 ? 0.35 : 0, 'giftWater'],
      [E.has(5) && dry ? (h >= 12 && h < 18 ? 0.45 : 0.1) : 0, 'giftHammock'],
      [lv[4] && dry ? (this._planeToWatch() ? 3 : lv[4] >= 2 && dusk && wx.cover < 70 && !wx.fog ? 1.5 : 0.3) : 0, 'giftScope'],
      // Tricks (Stufe 2)
      [E.has(1) && lv[1] >= 2 && !wx.wet && (this._wind || 0) < 12 ? 0.3 : 0, 'giftBlow'],
      [lv[2] >= 2 && dry && !dusk ? 0.25 : 0, 'giftPlush'],
      [lv[3] >= 2 && this._el.pika.classList.contains('cool') ? 0.6 : 0, 'giftShades'],
      [E.has(7) && lv[7] >= 2 ? 0.25 : 0, 'giftTune'],
    ];
  }

  // Stand der Päckchen in Worten (Schätze im Tagebuch): Stufen, Serie, wann das nächste kommt, was gerade fehlt
  _giftInfo() {
    const G = this._plan?.gift;
    if (!G) return null;
    const c = this._careEval() || this._care || {};
    const lvs = giftLvs(G); // der Schatz im fliegenden Ballon erscheint erst nach dem Auspacken
    const fmt = (ms) => {
      const m = Math.max(1, Math.round(ms / 6e4));
      return m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ''}` : `${m} Min.`;
    };
    // Was fehlt, damit die Serie hält (bzw. wieder anfängt): "Hunger!", "Streicheln!", "Putzen!"
    const low = c.warn || c.broken ? this._giftLow().map((k) => GIFT_LOW[k][0]).join(' ') : '';
    const next = G.n >= GIFT.max ? `Vorrat voll${low ? ` · ${low}` : ''}` : c.broken ? `Serie gerissen${low ? `, neu ab 50 %: ${low}` : ''}`
      : c.warn ? (low ? `schnell: ${low}` : 'einmal kümmern, dann läuft sie weiter') : `nächstes in ${fmt(c.left ?? GIFT.every)} Wachzeit`;
    return {
      G, lvs, next, warn: !!(c.warn || c.broken),
      have: lvs.filter((lv) => lv > 0).length,
      days: c.broken ? 0 : Math.floor((this._haNow() - G.k) / 864e5),
    };
  }
}
