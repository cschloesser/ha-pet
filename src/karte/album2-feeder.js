// Album 2: das Vogelhäuschen (key 'feeder', t2 = 0), Vorbild für die übrigen Schätze aus Album 2 (Schnittstelle im
// Kopf von src/karte/album2.js). Es steht dauerhaft klein am Rand der Wiese, auf der hinteren Reihe am linken Fuß des
// Aussichtssteins, wenn dort ein ruhiger Platz ist (genug Wiese, keine Festdeko); sonst holt er es nur für seinen
// Moment heraus. Stufe 1: Vögel kommen und picken, er schaut zu. Stufe 2 (Trick): Er füllt Körner nach, dann kommen
// sie. Stufe 3 (Gold): Ab und zu kommt ein Gimpel und setzt sich aufs Dach. Im Winter (und bei Schnee) öfter.
// Die Vögel am Häuschen sind eigene Bilder (BIRD_SVG wie beim Besuch), nicht this._bird: Den Besuch nach der Uhr,
// _watchBird und die Antwort des goldenen Glöckchens lässt das unberührt, und alles bleibt auf diesem Gerät.

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { LANE_DY } from '../logik/einstellungen.js';
import { buehneZ } from '../logik/buehne.js';
import { BIRDS, BIRD_SVG } from '../grafik/besucher.js';
import { FEEDER_SVG, FEEDER_SPOTS, FEEDER_W, GIMPEL, SEED_SVG } from '../grafik/album2/feeder.js';

// Der Gimpel kommt höchstens alle 3 Minuten und dann zu jedem zweiten Mal Zuschauen (wie GOLD in src/logik/paeckchen.js)
const FEEDER_GOLD = { cd: 3 * 6e4, p: 0.5 };
// Ebene: das Häuschen auf der hinteren Reihe (hinter dem Stein, der Pika läuft davor), die Vögel darauf eine Stufe davor
const FEEDER_Z = () => buehneZ(-LANE_DY, 'schatz');
const FEEDER_BZ = () => buehneZ(-LANE_DY, 'vogel');

export class Album2Feeder {
  // ---------- Platz und Szene ----------

  // Wo es steht (px der Szene): Mitte x, Breite w, Höhe h, linke und obere Kante, Fuß des Pfahls
  _a2FeederPos() {
    const { rock, gy, hayR } = this._g;
    const H = this._H;
    const w = H * FEEDER_W;
    const h = w * 2;
    const foot = gy - H * LANE_DY;
    const D = this._a2FeederDrift();
    const x = typeof D === 'number' ? D : Math.max(hayR + w, rock.l + rock.ku * 6);
    return { x, w, h, left: x - w / 2, top: foot - h, foot };
  }

  // Schneewehe des Schlittens (seit 0.48.1): Am Fuß des Steins läge das Häuschen in der Wehe, der Schlitten führe darüber.
  // Liegt Schnee (und der Schlitten ist da) oder liegt die Wehe gerade, steht es links von ihrem Fuß, wenn dort Platz
  // ist (→ x); sonst ist es ausgeblendet, solange die Wehe liegt ('hide'). Ohne Wehe und Schnee: null (wie immer).
  _a2FeederDrift() {
    const drift = !!this._a2SledS?.drift;
    if (!drift && !(this._wx?.snowcover && this._a2Lv('sled') > 0)) return null;
    const w = this._H * FEEDER_W;
    const x = this._a2SledFoot() - w * 0.9;
    if (x >= this._g.hayR + w) return x;
    return drift ? 'hide' : null;
  }

  // Ist dort ein ruhiger Platz? Genug Wiese zwischen Vorrat und Stein (auf schmalen Karten nicht) und keine Festdeko
  _a2FeederRoom() {
    const { rock, hayR, pW } = this._g;
    if (rock.l - hayR < pW * 1.5) return false;
    const F = this._a2FeederPos();
    return !Object.values(this._festPos || {}).some((q) => q && q.l < F.x + F.w && q.l + q.w > F.x - F.w);
  }

  // Szene (Hook): da, solange der Schatz da ist und Platz hat, oder für seinen Moment (_a2FeederTemp)
  _a2FeederScene(lv) {
    if (!(lv > 0 && (this._a2FeederTemp || this._a2FeederRoom()))) {
      if (!this._a2FeederBusy) this._a2Drop('feeder');
      return;
    }
    const el = this._a2El('feeder', FEEDER_SVG);
    el.style.left = `${this._a2FeederPos().x.toFixed(1)}px`;
    el.style.zIndex = String(FEEDER_Z());
    // (kein Platz links von der Wehe: blendet aus, solange gerodelt wird)
    el.classList.toggle('a2hid', this._a2FeederDrift() === 'hide');
  }

  // Für eine Aktion: steht es nicht, holt er es heraus (ploppt auf). → true, wenn es nur für diesen Moment da ist
  _a2FeederShow() {
    const old = this._a2Els?.get('feeder');
    if (old && !old.classList.contains('a2out')) return false;
    this._a2FeederTemp = true;
    old?.classList.remove('a2out'); // (verschwand eben erst: bleibt)
    this._a2Scene();
    const el = this._a2Els?.get('feeder');
    if (!old && el) {
      el.classList.add('new');
      setTimeout(() => el.classList.remove('new'), 800);
    }
    return true;
  }

  // Der Freund verdeckt das Häuschen nicht, solange die Vögel kommen (_a2FrAside)
  async _a2FeederAside() {
    const F = this._a2FeederPos();
    await this._a2FrAside(F.left - F.w * 0.3, F.left + F.w * 1.3);
  }

  // Moment vorbei: Vögel fliegen weg, ein nur hervorgeholtes Häuschen verschwindet wieder
  _a2FeederEnd() {
    this._a2FeederShoo();
    if (!this._a2FeederTemp) return;
    this._a2FeederTemp = false;
    const el = this._a2Els?.get('feeder');
    if (this._a2FeederRoom() || !el) return;
    el.classList.add('a2out');
    setTimeout(() => !this._a2FeederTemp && el.isConnected && this._a2Scene(), 450);
  }

  // ---------- Was er damit tut ----------

  // Hook: Vögel füttern mag er bei Tag, ohne Regen und Sturm; im Winter (November bis Februar, Südhalbkugel versetzt)
  // und bei Schnee öfter, in der Dämmerung selten
  _a2FeederActs({ wx }, lv) {
    const sc = this._el.scene.classList;
    if (wx.wet || wx.storm || sc.contains('night') || (this._wind || 0) >= 40) return [];
    const w = (this._a2FeederWinter() || wx.snowcover ? 0.7 : 0.3) * (sc.contains('dusk') ? 0.3 : 1);
    return [[w, 'a2FeederPlay'], [lv >= 2 ? w * 0.5 : 0, 'a2FeederFill']];
  }

  _a2FeederWinter() {
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const mo = (new Date(this._dbgDate ?? Date.now()).getMonth() + (south ? 6 : 0)) % 12;
    return mo >= 10 || mo <= 1 || !!this._wx?.snowcover;
  }

  // Wo er zuschaut: links vom Häuschen mit Abstand (so sieht man es), auf schmalen Karten so weit es geht
  async _a2FeederGo(near = false) {
    const F = this._a2FeederPos();
    const { pW, hayR } = this._g;
    const x = Math.max(hayR + pW * 0.3, F.x - pW * (near ? 0.62 : 1.15));
    await this._walkTo(x, 0.9);
    this._face(F.x >= this._x ? 1 : -1);
  }

  // Stufe 1 (Aktion 'a2FeederPlay'): hin, Vögel kommen, picken, er schaut zu und piepst, sie fliegen wieder.
  // o: { n: so viele Vögel, gimpel: der Gimpel kommt sicher, short: kurz (nach dem Auspacken) }
  async _a2FeederPlay(o = {}) {
    if (!this._a2Lv('feeder')) return;
    this._a2FeederBusy = true;
    try {
      this._a2FeederShow();
      await this._a2FeederAside();
      await this._a2FeederGo();
      await this._wait(300);
      await this._a2FeederWatch(o);
    } finally {
      this._a2FeederBusy = false;
      this._a2FeederEnd();
    }
  }

  // Zuschauen (er steht schon da): Vögel kommen nacheinander, der Gimpel (golden) zuletzt aufs Dach
  async _a2FeederWatch(o = {}) {
    const p = this._el.pika;
    const lv = this._a2Lv('feeder');
    const gold = !!o.gimpel || (lv >= 3 && this._a2GoldOk('feeder', FEEDER_GOLD));
    const n = clamp(o.n ?? 1 + (Math.random() < 0.6 ? 1 : 0) + (!gold && this._a2FeederWinter() && Math.random() < 0.6 ? 1 : 0), 1, gold ? 2 : 3);
    // Plätze: erst das Futterbrett links und rechts, dann der First (golden: der Platz des Gimpels)
    const plan = [...Array(n).keys()].map((i) => [i, pick(BIRDS)]);
    if (gold) plan.push([2, GIMPEL]);
    p.classList.add('look-up');
    this._say(pick(['piep?', 'Vögelchen?', 'Futterzeit!']), 1100);
    const B = [];
    for (const [i, v] of plan) {
      await this._wait(rnd(700, 1300));
      B.push(this._a2FeederBird(i, v));
    }
    await this._wait(1700);
    if (gold) {
      const g = B.at(-1);
      this._mimik('awe', 1400);
      this._say(pick(['ein Gimpel!', 'oh, ein Gimpel!', 'so ein rotes Bäuchlein!']), 1700);
      if (g) for (let i = 0; i < 3; i++) setTimeout(() => this._g && !g.gone && this._sparkle(g.x, g.y - this._H * 0.05, 1), i * 350);
      await this._wait(1900);
    } else if (Math.random() < 0.6) {
      p.classList.add('calling');
      this._say(pick(['iiep!', 'mip!']), 900);
      await this._wait(650);
      p.classList.remove('calling');
      const b = pick(B);
      setTimeout(() => b?.sitting && this._tweet(b), 400);
    }
    p.classList.add('tilt');
    await this._wait(o.short ? 1600 : rnd(3500, 6500));
    p.classList.remove('tilt');
    p.classList.add('content');
    this._happy(1000);
    await this._wait(o.short ? 700 : rnd(1500, 2600));
    for (const b of B) {
      this._a2FeederFly(b);
      await this._wait(260);
    }
    await this._wait(700);
    p.classList.remove('look-up', 'content');
  }

  // Stufe 2, der Trick (Aktion 'a2FeederFill'): Das Brett ist leer, er hüpft hoch und füllt Körner nach, dann kommen
  // die Vögel
  async _a2FeederFill() {
    if (this._a2Lv('feeder') < 2) return;
    this._a2FeederBusy = true;
    const p = this._el.pika;
    let el = null;
    try {
      this._a2FeederShow();
      await this._a2FeederAside();
      el = this._a2Els?.get('feeder');
      el?.classList.add('leer');
      await this._a2FeederGo(true);
      this._say(pick(['leer!', 'Nachschub!', 'Körner!']), 1100);
      await this._wait(600);
      p.classList.add('look-up', 'crouch');
      await this._wait(280);
      p.classList.remove('crouch');
      this._jump('hop1');
      await this._wait(180);
      this._a2FeederSeeds(true);
      await this._wait(650);
      el?.classList.remove('leer');
      el?.classList.add('fill');
      setTimeout(() => el?.classList.remove('fill'), 700);
      const F = this._a2FeederPos();
      this._peep(F.x, F.top + F.h * 0.3, 'riesel!');
      await this._wait(800);
      this._happy(900);
      p.classList.remove('look-up');
      await this._wait(500);
      await this._a2FeederGo();
      await this._a2FeederWatch({ n: 2 });
    } finally {
      el?.classList.remove('leer', 'fill');
      this._a2FeederBusy = false;
      this._a2FeederEnd();
    }
  }

  // Nach dem Auspacken (Hook): Stufe 1 ein Vogel kommt gleich, 2 der Trick, 3 der Gimpel
  async _a2FeederStow(lv) {
    if (lv === 2) return this._a2FeederFill();
    this._say(lv >= 3 ? pick(['goldig!', 'glänzt!']) : pick(['für die Vögel!', 'ein Futterhaus!']), 1400);
    await this._wait(1000);
    await this._a2FeederPlay({ n: 1, gimpel: lv >= 3, short: true });
  }

  // ---------- Vögel und Körner ----------

  // Ein Vogel (Farben v, BIRDS oder GIMPEL) fliegt an Platz i des Häuschens (FEEDER_SPOTS) und pickt dort, bis er
  // wegfliegt (_a2FeederFly). → { el, x, y, dir, sitting, gone }
  _a2FeederBird(i, v) {
    const F = this._a2FeederPos();
    const [fx, fy] = FEEDER_SPOTS[i];
    const x = F.left + fx * F.w;
    const y = F.top + fy * F.h;
    const calm = calmMotion();
    const el = document.createElement('div');
    el.className = `bird a2b${calm ? '' : ' flying'}`;
    el.innerHTML = `<div class="bw" role="button" aria-label="${v.name}"><div class="bf"><div class="bb">${BIRD_SVG(v)}</div></div></div>`;
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
    el.style.zIndex = String(FEEDER_BZ());
    const b = { el, x, y, dir: 1, sitting: false, gone: false, roof: i === 2, t: null };
    // Antippen: Er fliegt weg (wie ein Besuch)
    el.querySelector('.bw').addEventListener('click', (e) => {
      e.stopPropagation();
      this._found('visitor');
      this._a2FeederFly(b, true);
    });
    this._keyTap?.(el.querySelector('.bw'));
    (this._a2FeederBirds ??= new Set()).add(b);
    this._el.birds.appendChild(el);
    // Blick: am Brett zur Mitte, auf dem Dach zum Pika
    this._a2FeederFace(b, i === 0 ? 1 : i === 1 ? -1 : this._x >= x ? 1 : -1);
    const land = () => {
      if (b.gone) return;
      el.classList.remove('flying');
      if (!calm) el.classList.add('land');
      b.sitting = true;
      b.t = setTimeout(() => this._a2FeederPeck(b), 350);
    };
    if (calm) {
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
      b.t = setTimeout(land, 500);
    } else {
      // Anflug von schräg oben, von der Seite, zu der er schaut
      const side = -b.dir;
      const dx = side * this._W * rnd(0.3, 0.5);
      const dy = -y - this._H * 0.1;
      b.dir = -side;
      el.classList.toggle('left', b.dir < 0);
      const dur = rnd(1300, 1800);
      b.fly = el.animate?.([
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` },
        { transform: `translate(${(dx * 0.4).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`, offset: 0.55 },
        { transform: `translate(${(dx * 0.08).toFixed(1)}px, ${(-this._H * 0.04).toFixed(1)}px)`, offset: 0.88 },
        { transform: 'translate(0, 0)' },
      ], { duration: dur, easing: 'ease-out' });
      b.t = setTimeout(() => {
        b.fly = null;
        this._a2FeederFace(b, i === 0 ? 1 : i === 1 ? -1 : this._x >= x ? 1 : -1);
        land();
      }, dur);
    }
    return b;
  }

  _a2FeederFace(b, dir) {
    b.dir = dir;
    b.el.classList.toggle('left', dir < 0);
  }

  // Sitzt er: picken (am Brett), Kopf schief, hüpfen, umdrehen, ab und zu ein Zwitschern
  _a2FeederPeck(b) {
    if (b.gone || !b.sitting) return;
    const calm = calmMotion();
    const el = b.el;
    el.classList.remove('land', 'peck', 'tilt', 'hop');
    const r = Math.random();
    let ms = 500;
    if (r < (b.roof ? 0.25 : 0.5) && !calm) {
      el.classList.add('peck');
      ms = 460;
    } else if (r < 0.72) {
      el.classList.add('tilt');
      ms = rnd(700, 1400);
    } else if (r < 0.82 && !calm) {
      el.classList.add('hop');
      ms = 340;
    } else if (r < 0.92) {
      if (!b.roof) this._a2FeederFace(b, -b.dir);
    } else this._tweet(b);
    b.t = setTimeout(() => {
      el.classList.remove('peck', 'tilt', 'hop');
      b.t = setTimeout(() => this._a2FeederPeck(b), rnd(150, 900));
    }, ms);
  }

  // Wegfliegen (fast: erschrocken), danach ist er weg
  _a2FeederFly(b, fast = false) {
    if (!b || b.gone) return;
    b.gone = true;
    b.sitting = false;
    clearTimeout(b.t);
    b.fly?.cancel();
    const el = b.el;
    el.classList.remove('land', 'peck', 'tilt', 'hop');
    const done = () => {
      el.remove();
      this._a2FeederBirds?.delete(b);
    };
    if (calmMotion() || !el.animate) {
      el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
      setTimeout(done, 420);
      return;
    }
    el.classList.add('flying');
    const out = b.x > this._W / 2 ? 1 : -1;
    this._a2FeederFace(b, out);
    const dur = fast ? 800 : rnd(1100, 1500);
    el.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${(out * this._W * 0.06).toFixed(1)}px, ${(-this._H * 0.07).toFixed(1)}px)`, offset: 0.25 },
      { transform: `translate(${(out * this._W * 0.55).toFixed(1)}px, ${(-b.y - this._H * 0.2).toFixed(1)}px)` },
    ], { duration: dur, easing: 'ease-in', fill: 'forwards' });
    setTimeout(done, dur + 40);
  }

  // Alle Vögel am Häuschen fliegen weg
  _a2FeederShoo() {
    for (const b of [...(this._a2FeederBirds || [])]) this._a2FeederFly(b);
  }

  // Körner: fill = er wirft sie aus den Pfoten aufs Brett, sonst rieseln ein paar vom Brett ins Gras (Antippen)
  _a2FeederSeeds(fill) {
    const F = this._a2FeederPos();
    const { pW, pH, gy } = this._g;
    const tray = F.top + F.h * (28 / 64);
    const n = calmMotion() ? 1 : fill ? 8 : 3;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = `a2seed${calmMotion() ? ' still' : ''}`;
      s.innerHTML = SEED_SVG;
      const x0 = fill ? this._x + this._dir * pW * 0.25 : F.left + F.w * pick([0.15, 0.85]) + rnd(-2, 2);
      const y0 = fill ? gy - pH * 0.55 : tray;
      const x1 = fill ? F.left + F.w * rnd(0.22, 0.78) : x0 + rnd(-6, 6);
      const y1 = fill ? tray - 1 : F.foot + this._H * LANE_DY * 0.6;
      s.style.left = `${x0.toFixed(1)}px`;
      s.style.top = `${y0.toFixed(1)}px`;
      this._el.fx.appendChild(s);
      const ms = fill ? 520 : 650;
      if (!calmMotion() && s.animate) {
        const up = fill ? -this._H * 0.08 : 0;
        s.animate([
          { transform: 'translate(0, 0)', opacity: 1 },
          { transform: `translate(${((x1 - x0) / 2).toFixed(1)}px, ${(Math.min(0, y1 - y0) + up).toFixed(1)}px)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${(x1 - x0).toFixed(1)}px, ${(y1 - y0).toFixed(1)}px)`, opacity: fill ? 1 : 0 },
        ], { duration: ms, delay: i * 70, easing: 'ease-in', fill: 'both' });
      }
      (this._a2FeederFx ??= new Set()).add(s);
      setTimeout(() => {
        s.remove();
        this._a2FeederFx?.delete(s);
      }, ms + i * 70 + (calmMotion() ? 600 : 60));
    }
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Tipp aufs Häuschen: Es wackelt am Pfahl, ein paar Körner rieseln, Vögel darauf hüpfen kurz
  _a2FeederTap(z) {
    const el = z.el;
    if (el.classList.contains('a2hid')) return false; // (ausgeblendet, solange die Schneewehe liegt)
    if (!calmMotion()) {
      el.classList.remove('a2tap');
      void el.offsetWidth;
      el.classList.add('a2tap');
      clearTimeout(this._a2FeederTapT);
      this._a2FeederTapT = setTimeout(() => el.classList.remove('a2tap'), 700);
    }
    this._a2FeederSeeds(false);
    const F = this._a2FeederPos();
    this._peep(F.x, F.top - 2, 'riesel!');
    for (const b of this._a2FeederBirds || []) {
      if (!b.sitting || calmMotion()) continue;
      b.el.classList.add('hop');
      setTimeout(() => b.el.classList.remove('hop'), 340);
    }
    return true;
  }

  // Ende jeder Aktion: Vögel weg, hervorgeholtes Häuschen weg
  _a2FeederCleanup() {
    if (this._a2FeederBusy) return;
    this._a2FeederShoo();
    if (this._a2FeederTemp) this._a2FeederEnd();
    this._a2Els?.get('feeder')?.classList.remove('leer', 'fill');
  }

  // Karte aus dem DOM: alles sofort weg
  _a2FeederDetach() {
    clearTimeout(this._a2FeederTapT);
    for (const b of [...(this._a2FeederBirds || [])]) {
      clearTimeout(b.t);
      b.gone = true;
      b.el.remove();
    }
    this._a2FeederBirds?.clear();
    for (const s of this._a2FeederFx || []) s.remove();
    this._a2FeederFx?.clear();
    this._a2FeederBusy = false;
    this._a2FeederTemp = false;
  }
}
