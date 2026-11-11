// Besucher: Vögelchen, Maus, Frosch und Schnecke nach der Uhr, und wie der Pika auf sie schaut

import { Cancel, rnd, pick, clamp, pause, weighted, seedRnd, clearSpot } from '../logik/hilfen.js';
import { CRIT, CRIT_KINDS, CRIT_BACK, critJoin } from '../logik/besucher.js';
import { BIRDS, BIRD_SVG, MOUSE_SVG, FROG_SVG, SNAILS, SNAIL_SVG } from '../grafik/besucher.js';

export class Besucher {
  // Zum Vögelchen hinschauen, piepsen – es zwitschert zurück
  async _watchBird() {
    const b = this._bird;
    if (!b?.sitting) return;
    const { pW } = this._g;
    const d = b.x - this._x;
    if (Math.abs(d) > this._W * 0.3 || Math.abs(d) < pW * 0.4) {
      await this._walkTo(b.x - (Math.sign(d) || 1) * pW * rnd(0.8, 1.3), 0.8);
    }
    this._face(b.x >= this._x ? 1 : -1);
    const p = this._el.pika;
    p.classList.add('look-up');
    await this._wait(rnd(1200, 2200));
    if (Math.random() < 0.6 && this._bird === b) {
      p.classList.add('calling');
      this._say(pick(['iiep!', 'mip!']), 900);
      await this._wait(650);
      p.classList.remove('calling');
      setTimeout(() => this._bird === b && this._tweet(b), 400);
    }
    this._memo('bird');
    // Es zwitschert zurück: Kopf schief
    if (Math.random() < 0.6) {
      p.classList.add('tilt');
      if (Math.random() < 0.4) this._emote('q', 1400);
    }
    await this._wait(rnd(1200, 2500));
  }

  // Der Maus zuschauen, manchmal neugierig ein Stück hin (zu nah, und sie flitzt weg)
  async _watchMouse() {
    const m = this._mouse;
    if (!m?.visible) return;
    const p = this._el.pika;
    this._face(m.x >= this._x ? 1 : -1);
    p.classList.add('look-f');
    if (Math.random() < 0.4) p.classList.add('tilt');
    await this._wait(rnd(900, 1600));
    if (m.out && Math.random() < 0.5) {
      p.classList.remove('look-f');
      await this._walkTo(m.x - this._dir * this._g.pW * rnd(0.7, 1.1), 0.6);
      p.classList.add('look-f');
    }
    if (Math.random() < 0.4) this._say(pick(['mip?', 'iiep?']), 1000);
    await this._wait(rnd(1000, 2200));
  }

  // Den Frosch anpiepsen: Er quakt zurück, der Pika zuckt zusammen
  async _watchFrog() {
    const f = this._frog;
    if (!f?.out) return;
    const p = this._el.pika;
    const there = () => this._frog === f && f.out;
    this._face(f.x >= this._x ? 1 : -1);
    p.classList.add('look-f');
    await this._wait(rnd(900, 1600));
    if (!there()) return;
    p.classList.add('calling');
    this._say(pick(['mip?', 'iiep?']), 900);
    await this._wait(650);
    p.classList.remove('calling');
    await this._wait(rnd(300, 700));
    if (there()) {
      this._croak(f);
      await this._wait(350);
      this._jump('hop1');
      this._say('!', 800);
      await this._wait(900);
      p.classList.add('tilt');
      if (Math.random() < 0.5) this._emote('q', 1400);
    }
    await this._wait(rnd(1000, 2000));
  }

  // Zur Schnecke hin und an ihr schnuppern: Sie zieht sich ins Haus zurück, er wartet, bis sie wieder herausschaut
  async _watchSnail() {
    const s = this._snail;
    if (!s?.out) return;
    const p = this._el.pika;
    const there = () => this._snail === s && s.out;
    this._face(s.x >= this._x ? 1 : -1);
    p.classList.add('look-f');
    if (Math.random() < 0.4) p.classList.add('tilt');
    await this._wait(rnd(900, 1500));
    if (!there() || Math.random() < 0.3) return this._wait(rnd(800, 1600));
    p.classList.remove('look-f', 'tilt');
    await this._approach(s.x, 0.6);
    if (!there()) return;
    p.classList.add('sniff');
    await this._wait(500);
    s.poke();
    await this._wait(rnd(500, 900));
    p.classList.remove('sniff');
    p.classList.add('tilt');
    this._emote('q', 1400);
    // warten, bis sie wieder herausschaut
    for (let i = 0; i < 14 && there() && s.hidden; i++) await this._wait(500);
    p.classList.remove('tilt');
    if (there() && !s.hidden) {
      await this._wait(700);
      this._twitch();
      this._say(pick(['oh!', 'mip!']), 1000);
    }
    await this._wait(rnd(900, 1600));
  }

  // Besucher laufen neben der Pika-Schleife her und sind reine Zierde. Wann sie kommen, folgt aus der Uhrzeit
  // (seedRnd), darum sehen alle Geräte dieselben Besuche.
  _startCritters() {
    if (!this._attached || this._away() || this._critOn) return;
    this._critOn = true;
    const id = ++this._critId;
    // Start des letzten Besuchs je Art, über Neustarts hinweg (Display aus/an, Areal): kein Besuch kommt zweimal
    this._critLast ??= {};
    // je Art nur der eine Timer bis zum nächsten Start
    this._critT = {};
    // Timer bis zum nächsten berechneten Start; after: Start des letzten, damit keiner zweimal kommt
    const plan = (kind, after) => {
      const now = this._visitNow();
      const nx = this._critNext(kind, now, after);
      this._critT[kind] = setTimeout(async () => {
        if (id !== this._critId) return;
        this._critT[kind] = null;
        const late = this._visitNow() - nx.at;
        // Die Uhr wurde inzwischen zurückgestellt (Abgleich mit HA): noch nicht so weit, neu planen
        if (late < -500) return plan(kind, after);
        this._critLast[kind] = nx.at;
        if (late <= critJoin(kind, nx.pick)) await this._visit(kind, id, false, nx.pick, Math.max(0, late));
        if (id === this._critId) plan(kind, nx.at);
      }, Math.max(0, nx.at - now));
    };
    this._critPlan = plan;
    for (const k of CRIT_KINDS) plan(k, this._critLast[k]);
  }

  // Uhr der Besuche: Uhr von HA (Vorschau: um _dbgShiftMs vorgestellt). Nicht _dbgDate, das steht fest.
  _visitNow() {
    return this._haNow() + this._dbgShiftMs;
  }

  // Nächster Besuch von kind (bird, mouse, frog, snail), der noch läuft (critJoin) und nach after liegt:
  // { at: Startzeit, pick: feste Entscheidungen }. Gleiche Uhr → gleiches Ergebnis auf allen Geräten.
  _critNext(kind, now, after = -Infinity) {
    const { win, p, room } = CRIT[kind];
    for (let k = Math.floor(Math.max(now - CRIT_BACK, after + 1) / win); ; k++) {
      if (seedRnd(kind, k, 0) >= p) continue;
      const at = k * win + Math.floor(seedRnd(kind, k, 1) * (win - room));
      if (at <= after) continue;
      const pick = this._critPick(kind, (n) => seedRnd(kind, k, n));
      if (at < now - critJoin(kind, pick)) continue;
      return { at, pick };
    }
  }

  // Was beim Besuch feststeht; r(n) liefert Zahlen in [0, 1) (seedRnd fürs Fenster, Vorschau-Knöpfe: Math.random)
  _critPick(kind, r) {
    if (kind === 'bird') {
      return { bird: Math.floor(r(2) * BIRDS.length), spot: r(3), rockX: 35 + r(4) * 30,
        side: r(5) < 0.5 ? -1 : 1, out: r(6) < 0.5 ? -1 : 1, stay: 15000 + r(7) * 30000, alt: r(8) };
    }
    // Frosch: wie weit auf die Wiese und wie lange; Schnecke: Hausfarbe und wie weit
    if (kind === 'frog') return { x: r(2), stay: 12000 + r(3) * 14000 };
    if (kind === 'snail') return { shell: Math.floor(r(2) * SNAILS.length), far: r(3) };
    const k = r(2); // seitlich : oben : auf die Wiese = 2 : 1 : 5 (auf der Wiese sieht man sie am besten)
    return { kind: k < 0.25 ? 'side' : k < 0.375 ? 'top' : 'run', x: 30 + r(3) * 40 };
  }

  _stopCritters() {
    this._critOn = false;
    this._critId++;
    Object.values(this._critT).forEach((t) => clearTimeout(t));
    this._critT = {};
    for (const k of CRIT_KINDS) {
      const c = this['_' + k];
      // Wer gerade zu Besuch ist, kommt beim Weitermachen für den Rest wieder (kurz weggescrollt, Bildschirm
      // aus und an, neue Größe), solange sein Besuch noch läuft. Verscheucht bleibt verscheucht.
      if (c && !c.scared && this._critLast) delete this._critLast[k];
      c?.el.remove();
      this['_' + k] = null;
    }
  }

  // Neue Größe oder neues Areal: wer gerade zu Besuch ist, kommt gleich wieder (falls sein Besuch noch läuft,
  // siehe _stopCritters); wer schon fertig war, nicht noch einmal
  _restartCritters() {
    this._stopCritters();
    this._startCritters();
  }

  // Vögel kommen nur bei Tag, Vögel und Maus nicht bei Regen oder Gewitter. Frosch und Schnecke kommen nur bei
  // Regen (auch nachts und bei Starkregen), aber nicht bei Gewitter, Schneeregen oder unter 3 °C.
  _critterWeather(kind) {
    const wx = this._wx;
    if (!this._g) return false;
    if (kind === 'frog' || kind === 'snail') return wx.rain > 0 && !wx.snow && !wx.flash && !wx.cold && !wx.hail;
    if (wx.wet || wx.storm) return false;
    if (kind === 'mouse') return true;
    const e = this._dbgElev ?? this._elev;
    return e == null ? !this._asleep : e > 3;
  }

  // Frosch, Schnecke und Maus sitzen knapp hinter dem Pika, die Bodendeko der Festtage vorn (Kürbis, Stiefel, Kranz,
  // Kuchen, Geschenk) steht eine Ebene davor. Wo sie anhalten, rücken sie darum neben die Deko statt dahinter.
  // Ostereier und Raketenstäbe sind klein und liegen überall, der Baum steht hinter ihnen: die zählen nicht.
  _festClear(x, w, a, b) {
    const pos = this._festPos || {};
    const pad = this._H * 0.01;
    const blocks = ['pumpkin', 'boot', 'wreath', 'cake', 'gift'].filter((n) => pos[n])
      .map((n) => [pos[n].l - pad, pos[n].l + pos[n].w + pad]);
    return blocks.length ? clearSpot(x, w, a, b, blocks) : x;
  }

  // pk: feste Entscheidungen aus _critNext (ohne: Zufall, Vorschau-Knöpfe); late: so viele ms nach dem Start
  async _visit(kind, id, force = false, pk = null, late = 0) {
    if (!this._g || this['_' + kind]) return;
    if (!force && !this._critterWeather(kind)) return;
    pk ??= this._critPick(kind, () => Math.random());
    try {
      await this[`_${kind}Visit`](id, force, pk, late);
    } catch (e) {
      if (!(e instanceof Cancel)) console.warn('pika-pet-card:', e);
    }
  }

  // Besucher-Objekt mit scare(): Antippen oder der Pika verscheucht ihn
  _critter(props) {
    const c = { ...props, scared: false };
    c.scaredP = new Promise((r) => (c.scare = () => ((c.scared = true), r())));
    return c;
  }

  // Warten; endet früher, wenn c verscheucht wird. Bricht ab, wenn die Besucher gestoppt wurden.
  async _cw(id, ms, c) {
    await (c ? Promise.race([pause(ms), c.scaredP]) : pause(ms));
    if (id !== this._critId) throw new Cancel();
  }

  // Pika schaut kurz hin, wenn er gerade nichts vorhat
  _noticeCritter(x, up) {
    if (this._asleep || this._inside || !['idle', 'look'].includes(this._action)) return;
    const p = this._el.pika;
    this._face(x >= this._x ? 1 : -1);
    const c = up ? 'look-up' : 'look-f';
    p.classList.remove('look-f', 'look-b', 'look-up');
    p.classList.add(c);
    clearTimeout(this._lookT);
    this._lookT = setTimeout(() => p.classList.remove(c), 1800);
  }

  // Vögelchen: fliegt im Bogen an, sitzt 15–45 s (Kopf schief, picken, hüpfen, zwitschern), fliegt weg
  async _birdVisit(id, force, pk, late = 0) {
    const { rock, bur } = this._g;
    const spots = this._areal().perches.map(([x, y], i) => ({ id: `p${i}`, x: bur.l + x * bur.u, y: bur.base + y * bur.u }));
    // Platz fest aus dem Seed: Sitzplätze des Areals, dahinter der Stein. Ist der Pika gerade oben, wartet der
    // Vogel kurz; ist der Stein dann noch besetzt, nimmt er den Ersatzplatz, ebenfalls aus dem Seed.
    const si = Math.floor(pk.spot * (spots.length + 1));
    const rockBusy = () => this._lift !== 0 || this._action === 'lookout';
    let waited = 0;
    if (si >= spots.length) {
      for (; waited < 6000 && rockBusy(); waited += 500) await this._cw(id, 500);
    }
    const spot = si < spots.length ? spots[si]
      : !rockBusy() ? { id: 'rock', x: rock.l + pk.rockX * rock.ku, y: rock.top0 + 13 * rock.ku }
        : spots[Math.floor(pk.alt * spots.length)];
    const v = BIRDS[pk.bird];
    const el = document.createElement('div');
    el.className = 'bird flying';
    el.innerHTML = `<div class="bw" role="button" aria-label="${v.name}"><div class="bf"><div class="bb">${BIRD_SVG(v)}</div></div></div>`;
    el.style.left = `${spot.x}px`;
    el.style.top = `${spot.y}px`;
    const b = this._critter({ el, perch: spot.id, x: spot.x, y: spot.y, sitting: false, dir: 1 });
    el.querySelector('.bw').addEventListener('click', (e) => (e.stopPropagation(), this._found('visitor'), b.scare()));
    this._keyTap(el.querySelector('.bw'));
    this._bird = b;
    this._el.birds.appendChild(el);
    try {
      // Anflug von schräg oben
      const side = pk.side;
      const dx = side * this._W * rnd(0.45, 0.7);
      const dy = -spot.y - this._H * 0.15;
      this._birdFace(b, -side);
      const dur = rnd(1500, 2100);
      const fly = el.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.3}px)`, offset: 0.5 },
        { transform: `translate(${dx * 0.1}px, ${-this._H * 0.07}px)`, offset: 0.85 },
        { transform: 'translate(0, 0)' },
      ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
      // Schon im Anflug lässt er sich verscheuchen (Antippen; der Pika springt auf den Stein): Er dreht dann in der
      // Luft ab, statt erst noch zu landen. Bisher landete er auch auf einem Stein, auf den der Pika gerade sprang.
      await this._cw(id, dur, b);
      let from = 'translate(0, 0)';
      if (b.scared) {
        fly.pause();
        const m = getComputedStyle(el).transform;
        const M = m && m !== 'none' ? new DOMMatrixReadOnly(m) : null;
        if (M && (M.m41 || M.m42)) from = `translate(${M.m41.toFixed(1)}px, ${M.m42.toFixed(1)}px)`;
      }
      fly.cancel();
      if (!b.scared) {
        el.classList.remove('flying');
        el.classList.add('land');
        b.sitting = true;
        // zum Pika schauen
        if (Math.abs(this._x - spot.x) > 4) this._birdFace(b, this._x > spot.x ? 1 : -1);
        this._noticeCritter(spot.x, true);
        await this._cw(id, 350, b);
        el.classList.remove('land');
      }
      const until = Date.now() + Math.max(4000, pk.stay - late - waited);
      while (!b.scared && Date.now() < until && (force || this._critterWeather('bird'))) {
        await this._cw(id, rnd(900, 2600), b);
        if (b.scared) break;
        const act = weighted([[3, 'tilt'], [3, 'peck'], [2, 'hop'], [2, 'tweet'], [1, 'fluff'], [2, 'turn']]);
        if (act === 'tweet') this._tweet(b);
        else if (act === 'turn') this._birdFace(b, -b.dir);
        else {
          const n = act === 'peck' ? 1 + Math.floor(rnd(0, 3)) : 1;
          for (let i = 0; i < n && !b.scared; i++) {
            el.classList.add(act);
            await this._cw(id, { tilt: rnd(800, 1600), peck: 460, hop: 340, fluff: 720 }[act], b);
            el.classList.remove(act);
            if (act === 'hop' && Math.random() < 0.4) this._birdFace(b, -b.dir);
            if (n > 1) await this._cw(id, 120, b);
          }
        }
      }
      // Abflug, erschrocken schneller
      b.sitting = false;
      el.classList.remove('tilt', 'peck', 'hop', 'fluff');
      el.classList.add('flying');
      const out = b.scared ? (this._x > spot.x ? -1 : 1) : pk.out;
      this._birdFace(b, out);
      const dur2 = b.scared ? 900 : rnd(1200, 1600);
      el.animate([
        { transform: from },
        // vom Sitzplatz erst ein Stück hoch; in der Luft abgedreht geht es gleich davon
        ...(from === 'translate(0, 0)' ? [{ transform: `translate(${out * this._W * 0.08}px, ${-this._H * 0.08}px)`, offset: 0.25 }] : []),
        { transform: `translate(${out * this._W * 0.6}px, ${-spot.y - this._H * 0.2}px)` },
      ], { duration: dur2, easing: 'ease-in', fill: 'forwards' });
      await this._cw(id, dur2);
    } finally {
      if (this._bird === b) this._bird = null;
      el.remove();
    }
  }

  _birdFace(b, dir) {
    b.dir = dir;
    b.el.classList.toggle('left', dir < 0);
  }

  // ♪ steigt am Schnabel auf
  _tweet(b) {
    if (!b?.sitting) return;
    const bw = this._H * 0.1;
    for (let i = 0; i < (Math.random() < 0.4 ? 2 : 1); i++) {
      const n = document.createElement('span');
      n.className = 'note';
      n.textContent = pick(['♪', '♫', '♪']);
      n.style.left = `${b.x + b.dir * bw * 0.35}px`;
      n.style.top = `${b.y - bw * 0.95}px`;
      n.style.setProperty('--dx', `${b.dir * rnd(4, 14)}px`);
      n.style.animationDelay = `${i * 250}ms`;
      this._el.fx.appendChild(n);
      setTimeout(() => n.remove(), 1400 + i * 250);
    }
    b.el.classList.add('tilt');
    setTimeout(() => b.el.classList.remove('tilt'), 500);
  }

  // Maus: schaut seitlich oder oben hinter dem Aussichtsstein hervor, flitzt manchmal auf die Wiese
  async _mouseVisit(id, force, pk, late = 0) {
    const { rock, gy, pW } = this._g;
    const mw = this._H * 0.15;
    const mh = mw * (18 / 32);
    const el = document.createElement('div');
    el.className = 'mouse';
    el.innerHTML = `<div class="mw" role="button" aria-label="Maus"><div class="mf"><div class="mb">${MOUSE_SVG}</div></div></div>`;
    const m = this._critter({ el, x: 0, y: 0, dir: 1, visible: false, out: false });
    el.querySelector('.mw').addEventListener('click', (e) => (e.stopPropagation(), this._found('visitor'), m.scare()));
    this._keyTap(el.querySelector('.mw'));
    this._mouse = m;
    this._el.mice.appendChild(el);

    const yG = gy - this._H * 0.022; // Laufweg knapp hinter dem Pika
    const edge = rock.l + 7 * rock.ku; // linke Steinkante
    const hideX = edge + mw * 0.75;
    const peekX = edge + mw * 0.1;
    const door = edge - mw * 0.6; // ganz neben dem Stein: hier wechselt sie zwischen hinterer und vorderer Ebene
    // Hinter dem Stein läuft sie in der Ebene hinter Bau und Stein, auf der Wiese vor den Blumen
    // Umhängen setzt den Stil zurück: gleich neu berechnen, sonst spränge sie ohne Übergang ans nächste Ziel
    const layer = (front) => {
      (front ? this._el.miceF : this._el.mice).appendChild(el);
      void el.offsetWidth;
    };
    const topY = rock.top0 + 13.5 * rock.ku;
    const face = (d) => ((m.dir = d), el.classList.toggle('left', d < 0));
    const move = (x, y, ms = 0, ease = 'ease-out') => {
      el.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      m.x = x;
      m.y = y;
      if (!ms) void el.offsetWidth;
    };
    const liveX = () => {
      const t = getComputedStyle(el).transform;
      return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : m.x;
    };
    const pose = (c, on) => el.classList.toggle(c, on);
    // Warten; kommt der Pika zu nah, wird sie verscheucht
    const FLEE = {};
    const step = async (ms) => {
      await this._cw(id, ms, m);
      if (m.out && Math.abs(this._liveX() - m.x) < pW * 0.55) m.scare();
      if (m.scared) throw FLEE;
    };
    const run = async (x, speed = 1) => {
      face(x >= m.x ? 1 : -1);
      const ms = (Math.abs(x - m.x) / (this._H * 1.1 * speed)) * 1000;
      pose('run', true);
      move(x, yG, ms, 'linear');
      await step(ms);
      pose('run', false);
    };
    // Später eingestiegen (Bildschirm an, Neuladen): so viel Herumschauen weglassen, dass sie etwa zur selben
    // Zeit wie auf den anderen Geräten wieder verschwindet
    let behind = late;
    const lookAround = async (n) => {
      for (let i = 0; i < n; i++) {
        if (behind > 0) {
          behind -= 950;
          continue;
        }
        const r = Math.random();
        if (r < 0.35) {
          pose('sniff', true);
          await step(rnd(700, 1300));
          pose('sniff', false);
        } else if (r < 0.55) {
          pose('twitch', true);
          await step(450);
          pose('twitch', false);
        } else if (r < 0.75) {
          pose('look', true);
          await step(rnd(600, 1100));
          pose('look', false);
        } else {
          face(-m.dir);
          await step(rnd(400, 800));
        }
      }
    };
    const kind = pk.kind;
    try {
      try {
        if (kind === 'top') {
          // hinter der Steinkuppe hochkommen, nur Kopf und Ohren schauen heraus
          const x = rock.l + pk.x * rock.ku;
          face(this._x >= x ? 1 : -1);
          move(x, topY + mh * 1.1);
          await step(60);
          move(x, topY + mh * 0.2, 450);
          m.visible = true;
          await step(450);
          await lookAround(4 + Math.floor(rnd(0, 4)));
          m.visible = false;
          move(x, topY + mh * 1.1, 260, 'ease-in');
          await step(300);
        } else {
          face(-1);
          move(hideX, yG);
          await step(60);
          move(peekX, yG, 500);
          m.visible = true;
          await step(500);
          await lookAround(kind === 'run' ? 1 + Math.floor(rnd(0, 2)) : 4 + Math.floor(rnd(0, 4)));
          if (kind === 'run') {
            // raus auf die Wiese, schnuppern, Männchen machen, zurück
            const minX = Math.max(this._g.fMin * this._W, mw);
            await run(door);
            layer(true);
            m.out = true;
            await run(this._festClear(rnd(minX, Math.max(minX, door - mw * 0.7)), mw, minX, door));
            this._noticeCritter(m.x, false);
            await lookAround(2);
            if (Math.random() < 0.8) {
              face(this._x >= m.x ? 1 : -1);
              pose('stand', true);
              await step(rnd(1200, 2400));
              pose('stand', false);
            }
            await lookAround(2 + Math.floor(rnd(0, 3)));
            // ein, zwei Stückchen weiter über die Wiese, schnuppern
            for (let n = Math.random() < 0.5 ? 2 : 1; n > 0; n--) {
              await run(this._festClear(clamp(m.x + rnd(-1, 1) * mw * 2.5, minX, door), mw, minX, door), 0.8);
              await lookAround(1 + Math.floor(rnd(0, 3)));
            }
            await run(door);
            m.out = false;
            layer(false);
            await run(peekX);
            await step(rnd(300, 900));
          }
          m.visible = false;
          face(1);
          move(hideX, yG, 350);
          await step(400);
        }
      } catch (e) {
        if (e !== FLEE) throw e;
        // piep! und schnell zurück hinter den Stein
        const x = liveX();
        move(x, m.y);
        pose('run', false);
        pose('stand', false);
        m.out = m.visible = false;
        this._peep(x, m.y - mh * 1.2, 'piep!');
        if (kind === 'top') move(x, topY + mh * 1.1, 180, 'ease-in');
        else {
          face(1);
          pose('run', true);
          const dash = async (tx) => {
            const ms = (Math.abs(tx - m.x) / (this._H * 2)) * 1000;
            move(tx, yG, ms, 'linear');
            await this._cw(id, ms);
          };
          if (el.parentNode === this._el.miceF) {
            await dash(door);
            layer(false);
          }
          await dash(hideX);
        }
        await this._cw(id, 250);
      }
    } finally {
      if (this._mouse === m) this._mouse = null;
      el.remove();
    }
  }

  // Frosch (nur bei Regen): hüpft hinter dem Aussichtsstein hervor auf die Wiese, sitzt da, quakt, schnappt mit der
  // Zunge nach Tropfen und hüpft zurück. Antippen oder ein zu naher Pika: „quak!“ und mit großen Sätzen davon.
  async _frogVisit(id, force, pk, late = 0) {
    const { rock, gy, pW } = this._g;
    const fw = this._H * 0.13;
    const el = document.createElement('div');
    el.className = 'frog left';
    el.innerHTML = `<div class="cw" role="button" aria-label="Frosch"><div class="cf"><div class="cb">${FROG_SVG}</div></div></div>`;
    const yG = gy - this._H * 0.02; // knapp hinter dem Pika
    const f = this._critter({ el, x: 0, y: yG, w: fw, dir: -1, out: false });
    el.querySelector('.cw').addEventListener('click', (e) => (e.stopPropagation(), this._found('visitor'), f.scare()));
    this._keyTap(el.querySelector('.cw'));
    this._frog = f;
    this._el.mice.appendChild(el);

    const edge = rock.l + 7 * rock.ku; // linke Steinkante
    const hideX = edge + fw * 0.8;
    const door = edge - fw * 0.6; // neben dem Stein: hier wechselt er zwischen hinterer und vorderer Ebene
    const minX = Math.min(Math.max(this._g.fMin * this._W, fw), door);
    const maxX = Math.max(minX, door - fw * 0.7);
    // Umhängen setzt den Stil zurück: gleich neu berechnen, sonst spränge das nächste Stück ohne Übergang ans Ziel
    const layer = (front) => {
      (front ? this._el.miceF : this._el.mice).appendChild(el);
      void el.offsetWidth;
    };
    const face = (d) => ((f.dir = d), el.classList.toggle('left', d < 0));
    const move = (x, ms = 0) => {
      el.style.transition = ms ? `transform ${ms}ms linear` : 'none';
      el.style.transform = `translate(${x.toFixed(1)}px, ${yG.toFixed(1)}px)`;
      f.x = x;
      if (!ms) void el.offsetWidth;
    };
    // Warten; kommt der Pika zu nah, erschrickt er
    const FLEE = {};
    const step = async (ms) => {
      await this._cw(id, ms, f);
      if (f.out && Math.abs(this._liveX() - f.x) < pW * 0.55) f.scare();
      if (f.scared) throw FLEE;
    };
    // In Sätzen bis x. fast: große, schnelle Sätze auf der Flucht (dann erschrickt er nicht noch einmal)
    const hop = async (x, fast = false) => {
      const L = this._H * (fast ? 0.34 : 0.22);
      while (Math.abs(x - f.x) > 1) {
        const d = clamp(x - f.x, -L, L);
        const k = Math.abs(d) / L;
        face(d > 0 ? 1 : -1);
        const ms = (fast ? 240 : 320) + k * 90;
        el.style.setProperty('--hd', `${ms}ms`);
        el.style.setProperty('--fh', `${-Math.round(40 + 80 * k)}%`);
        el.classList.add('leap');
        move(f.x + d, ms);
        await (fast ? this._cw(id, ms) : step(ms));
        el.classList.remove('leap');
        await (fast ? this._cw(id, 50) : step(rnd(140, 420)));
      }
    };
    // Nicht auf der Schnecke sitzen: liegt x zu nah an ihr, den Platz daneben nehmen (auf der Seite, wo Wiese ist)
    const free = (x) => {
      const s = this._snail;
      if (!s?.out || Math.abs(x - s.x) >= fw) return x;
      const side = (x < s.x && s.x - fw * 1.1 >= minX) || s.x + fw * 1.1 > maxX ? -1 : 1;
      return clamp(s.x + side * fw * 1.1, minX, maxX);
    };
    try {
      try {
        move(hideX);
        await step(60);
        await hop(door);
        layer(true);
        f.out = true;
        // neue Ziele: neben der Festdeko statt dahinter
        const spot = (x) => free(this._festClear(x, fw, minX, maxX));
        await hop(spot(maxX - pk.x * Math.min(maxX - minX, this._H * 0.7)));
        this._noticeCritter(f.x, false);
        const until = Date.now() + Math.max(3000, pk.stay - late);
        // angekommen quakt er gleich, danach, was ihm einfällt
        let act = 'croak';
        let gap = 500;
        while (Date.now() < until && (force || this._critterWeather('frog'))) {
          await step(gap);
          // die Schnecke ist herangekrochen: zur Seite hüpfen
          if (free(f.x) !== f.x) await hop(free(f.x));
          else if (act === 'croak') {
            for (let n = Math.random() < 0.4 ? 2 : 1; n > 0; n--) {
              this._croak(f);
              await step(1050);
            }
          } else if (act === 'turn') face(-f.dir);
          else if (act === 'zap') {
            el.classList.add('zap');
            await step(400);
            el.classList.remove('zap');
          } else await hop(spot(clamp(f.x + rnd(0.8, 2) * fw * pick([-1, 1]), minX, maxX)));
          act = weighted([[3, 'croak'], [2, 'turn'], [2, 'hop'], [1.5, 'zap']]);
          gap = rnd(900, 2400);
        }
        await hop(door);
        f.out = false;
        layer(false);
        await hop(hideX);
      } catch (e) {
        if (e !== FLEE) throw e;
        // „quak!“ und mit großen Sätzen zurück hinter den Stein
        const t = getComputedStyle(el).transform;
        move(t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : f.x);
        el.classList.remove('leap', 'croak', 'zap');
        f.out = false;
        this._peep(f.x, yG - fw * 0.95, 'quak!');
        await this._cw(id, 120);
        if (el.parentNode === this._el.miceF) {
          await hop(door, true);
          layer(false);
        }
        await hop(hideX, true);
        await this._cw(id, 200);
      }
    } finally {
      if (this._frog === f) this._frog = null;
      el.remove();
    }
  }

  // Schallblase bläht sich zweimal, „quak!“ steigt auf
  _croak(f) {
    if (!f?.out || f.scared) return;
    const el = f.el;
    el.classList.remove('croak');
    void el.offsetWidth;
    el.classList.add('croak');
    clearTimeout(f.croakT);
    f.croakT = setTimeout(() => el.classList.remove('croak'), 950);
    this._peep(f.x + f.dir * f.w * 0.3, f.y - f.w * 0.85, pick(['quak!', 'quak!', 'quaak!']));
  }

  // Schnecke (nur bei Regen): kriecht hinter dem Aussichtsstein hervor ein Stück über die Wiese, reckt die Fühler,
  // schaut sich um und kriecht zurück. Weglaufen kann sie nicht: Antippen oder ein naher Pika, und sie zieht sich
  // ins Haus zurück; nach ein paar Sekunden kommt sie wieder heraus.
  async _snailVisit(id, force, pk, late = 0) {
    const { rock, gy, pW } = this._g;
    const sw = this._H * 0.12;
    const v = this._H * 0.035; // Kriechtempo in px/s
    const el = document.createElement('div');
    el.className = 'snail left';
    el.innerHTML = `<div class="cw" role="button" aria-label="Schnecke"><div class="cf"><div class="cb">${SNAIL_SVG(SNAILS[pk.shell])}</div></div></div>`;
    const yG = gy - this._H * 0.02;
    const s = { el, x: 0, y: yG, dir: -1, out: false, hidden: false, poked: false };
    const wob = () => {
      el.classList.remove('wob');
      void el.offsetWidth;
      el.classList.add('wob');
    };
    // Anstupsen (Antippen, Pika-Nase): ins Haus; ist sie schon drin, wackelt es und sie bleibt länger
    s.poke = () => {
      s.poked = true;
      if (s.hidden) wob();
    };
    el.querySelector('.cw').addEventListener('click', (e) => (e.stopPropagation(), this._found('visitor'), s.poke()));
    this._keyTap(el.querySelector('.cw'));
    this._snail = s;
    this._el.mice.appendChild(el);

    const edge = rock.l + 7 * rock.ku; // linke Steinkante
    const hideX = edge + sw * 0.8;
    const door = edge - sw * 0.6; // neben dem Stein: Wechsel zwischen hinterer und vorderer Ebene
    const minX = Math.min(Math.max(this._g.fMin * this._W, sw), door);
    // Umhängen setzt den Stil zurück: gleich neu berechnen, sonst spränge das nächste Stück ohne Übergang ans Ziel
    const layer = (front) => {
      (front ? this._el.miceF : this._el.mice).appendChild(el);
      void el.offsetWidth;
    };
    const face = (d) => ((s.dir = d), el.classList.toggle('left', d < 0));
    const liveX = () => {
      const t = getComputedStyle(el).transform;
      return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : s.x;
    };
    // Ohne Dauer steht sie sofort dort; mit Dauer kriecht sie hin (s.x folgt in wait)
    const put = (x, ms = 0) => {
      el.style.transition = ms ? `transform ${ms}ms linear` : 'none';
      el.style.transform = `translate(${x.toFixed(1)}px, ${yG.toFixed(1)}px)`;
      if (!ms) {
        s.x = x;
        void el.offsetWidth;
      }
    };
    // Vor einem nahen Pika erschrickt sie einmal; erst wenn er wieder weg war, beim nächsten Mal wieder
    let shy = true;
    const near = () => {
      const n = s.out && Math.abs(this._liveX() - s.x) < pW * 0.6;
      const hit = n && shy;
      shy = !n;
      return hit;
    };
    // In kleinen Schritten warten; true: angestupst oder der Pika kam zu nah
    const wait = async (ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        await this._cw(id, clamp(end - Date.now(), 20, 200));
        s.x = liveX();
        if (s.poked || near()) return true;
      }
      return false;
    };
    const hide = async () => {
      put(liveX());
      el.classList.remove('crawl', 'peer');
      el.classList.add('hide');
      s.hidden = true;
      do {
        s.poked = false;
        await this._cw(id, rnd(2600, 4200));
      } while (s.poked);
      el.classList.remove('hide', 'wob');
      s.hidden = false;
      near(); // steht der Pika noch da, erschrickt sie davor nicht gleich wieder
      await this._cw(id, 900);
    };
    const crawl = async (x) => {
      while (Math.abs(x - s.x) > 1) {
        face(x > s.x ? 1 : -1);
        const ms = (Math.abs(x - s.x) / v) * 1000;
        el.classList.add('crawl');
        put(x, ms);
        const hit = await wait(ms);
        el.classList.remove('crawl');
        if (hit) await hide();
        else put(x);
      }
    };
    const rest = async (ms) => {
      el.classList.add('peer');
      while (await wait(ms)) {
        await hide();
        el.classList.add('peer');
        ms = 1500;
      }
      el.classList.remove('peer');
    };
    try {
      put(hideX);
      await this._cw(id, 60);
      await crawl(door);
      layer(true);
      s.out = true;
      this._noticeCritter(s.x, false);
      await crawl(this._festClear(door - (0.3 + 0.6 * pk.far) * Math.min(door - minX, this._H * 0.7), sw, minX, door));
      // Fühler recken und umschauen (später eingestiegen: kürzer)
      await rest(Math.max(1500, rnd(5000, 9000) - late));
      await crawl(door);
      s.out = false;
      layer(false);
      await crawl(hideX);
    } finally {
      if (this._snail === s) this._snail = null;
      el.remove();
    }
  }
}
