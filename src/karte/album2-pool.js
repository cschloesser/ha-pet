// Album 2: das Planschbecken (key 'pool', t2 = 7), ein kleines aufblasbares Becken, blau mit weißem Rand. Es steht nicht
// in der Szene: An heißen Tagen holt er es zusammengelegt aus dem Bau, legt es auf die Wiese und bläst es auf (drei
// Puster), füllt es mit der Gießkanne aus Album 1, wenn er sie hat (sonst ist es gleich voll), hüpft hinein und
// planscht, Tropfen spritzen, Ringe laufen über das Wasser. Danach hüpft er heraus, tropft, schüttelt sich, lässt das
// Wasser ab, die Luft heraus und trägt es zurück in den Bau. Stufe 2 (Trick): Arschbombe. Er klettert auf den Rand,
// wackelt, zählt bis drei und springt zusammengerollt hinein: großer Spritzer, das Wasser schwappt. Stufe 3 (Gold):
// Eine goldene Gummiente schwimmt mit (mit Abstand und Würfel wie GOLD, POOL_GOLD; nach dem Auspacken sicher), er
// bestaunt sie.
// Wann: ab 25 °C (Temperatur wie die Sonnenbrille, roh aus der Wetter-Entität), bei Tag (nicht in der Dämmerung, nicht
// nachts), kein Gewitter, kein Starkregen, kein Hagel, kein Schnee, kaum Wind; der Monat zählt dabei nicht (ein heißer
// Tag im Mai ist auch Planschwetter). Leichter Regen geht (seltener): Im Becken legt er das Blatt weg, nass wird er
// sowieso. Nach dem Auspacken ohne Planschwetter zeigt er es nur und vertröstet (außerhalb von Juni bis August, den
// Monaten aus den Daten, auf den Sommer, sonst auf einen heißen Tag).
//
// Zwei Stücke mit derselben Box: hinten (Element aus _a2El: Tippfläche, golden) Innenwand, Wasser, hinterer Rand, hinter
// dem Pika; vorn Außenwand, vorderer Rand und das Wasser vor ihm. Steht er im Becken, liegt das vordere Stück vor ihm
// (er sitzt ein wenig tiefer, POOL_SINK), sonst hinter ihm wie das hintere (so läuft er vorn am Becken vorbei).
// Im Becken und auf dem Rand stellt die Szene den Pika selbst (_a2PoolPika, wie _hopTo mit einem Übergang und dem
// Sprung der Hülle .jump), _lift bleibt dabei immer 0: Bricht etwas ab, steht er am Boden (_a2PoolEnd stellt ihn mit
// _setX zurück), und _step hüpft nicht zum Stein.
// Bewegung reduzieren: kein Holen, kein Aufblasen (es blendet neben ihm ein), keine Sprünge, keine Spritzer, kein
// Schütteln: Er geht hinein, setzt sich, ein Ring läuft über das Wasser; die Ente treibt nicht.

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import { JUMPS } from '../logik/beschaeftigungen.js';
import { DROP_SVG } from '../grafik/beschaeftigungen.js';
import { A2_POOL, POOL, POOL_BACK_SVG, POOL_FRONT_SVG, POOL_DUCK_SVG, POOL_MOUTH, POOL_FARBE, POOL_W } from '../grafik/album2/pool.js';

// Ab so viel Grad (wie die Sonnenbrille ab 24)
const POOL_TEMP = 25;
// Die Ente kommt höchstens alle 5 Minuten und dann zu 3 von 5 Malen (wie GOLD in src/logik/paeckchen.js)
const POOL_GOLD = { cd: 5 * 6e4, p: 0.6 };
// So tief sitzt er im Becken (Einheiten der viewBox, 160 breit)
const POOL_SINK = 4;
// Ebenen: beide Stücke auf der vorderen Reihe, hinter dem Pika (Rang requisit; das vordere liegt im DOM danach);
// steht er im Becken, das vordere vor ihm (Rang arm, wie der Plüsch-Pino im Arm)
const POOL_Z = () => buehneZ(REIHE.vorn, 'requisit');
const POOL_ZF = () => buehneZ(REIHE.vorn, 'arm');
// Übergang wie beim Hüpfen (_hopTo)
const HOP_EASE = 'cubic-bezier(.3, .6, .4, 1)';
// Pika-Klassen dieses Schatzes (_cleanup kennt sie nicht, das Aufräumen nimmt sie ab)
const POOL_CLS = ['a2pl-in', 'a2pl-ball', 'a2pl-wob', 'a2pl-drip', 'a2pl-shake'];

export class Album2Pool {
  // ---------- Szene ----------

  // Szene (Hook): Es steht nie dauerhaft. Nur, solange er es benutzt, bleibt es. Hat sich die Größe der Karte
  // geändert, steht es an alten Pixeln: abbrechen (wie _layout bei Requisiten)
  _a2PoolScene(lv) {
    const S = this._a2PoolS;
    if (!S) return;
    // (neue Größe; Schnee, Starkregen oder Gewitter setzen ein: Regen allein darf, darin planscht er auch)
    if (this._a2PoolBusy && ((S.W !== this._W || S.H !== this._H) || this._a2WxTurned(S, true))) this._interrupt();
    else if (!(lv > 0) || !this._a2PoolBusy) this._a2PoolEnd();
  }

  // Maße (px): Breite, Höhe, Einheit der viewBox
  _a2PoolDim() {
    const w = this._g.pW * POOL_W;
    return { w, h: (w * POOL.vb[1]) / POOL.vb[0], u: w / POOL.vb[0] };
  }

  // Wo es liegt: Mitte cx, und wo er daneben steht (sx, auf der Seite side, Blick zum Becken: -side). Rechts vom Heu
  // (.fore verdeckte, was dahinter liegt), über den Stein darf es ragen (der steht dahinter). Er steht lieber links
  // (zum Bau hin), wenn er dort nicht im Heu steht, sonst rechts; auf schmalen Karten rückt das Becken dafür nach links.
  // Seit 0.48.1 nicht über dem, was schon am Boden steht (_a2Free): Auf schmalen Karten liegt es dann rechts vom
  // Windrad, er steht links davon zwischen beiden.
  _a2PoolSpot() {
    const { pW, hayR, xR } = this._g;
    const { w } = this._a2PoolDim();
    const H = this._H;
    const lo = hayR + w / 2 + H * 0.01;
    const hi = Math.max(lo, this._W - w / 2 - H * 0.02);
    const gap = w / 2 + pW * 0.3;
    // (mit 0,01 px Spiel: right unten liegt genau auf der Grenze, und x - gap fiel durch Rundung knapp darunter; auf 380 px
    // lag das Becken dann über dem Windrad, und von selbst kam es nie, _a2Room)
    const sideAt = (x) => (x - gap >= hayR + pW * 0.15 - 0.01 ? -1 : x + gap <= xR + 0.01 ? 1 : 0);
    let cx = this._a2Free(lo, hi, w, clamp(this._groundSpot(rnd(0.2, 0.8), w, 1).x, lo, hi), 'pool');
    let side = sideAt(cx);
    if (!side) {
      // (kein Platz für ihn daneben: so weit nach links, dass er rechts steht, oder so weit nach rechts, dass er links
      // steht; was davon frei ist)
      const left = clamp(xR - gap, lo, hi);
      const right = clamp(hayR + pW * 0.15 + gap, lo, hi);
      cx = [left, right, this._a2Free(lo, left, w, left, 'pool'), this._a2Free(right, hi, w, right, 'pool')]
        .find((x) => sideAt(x) && !this._a2Hit(x, w, 'pool')) ?? left;
      side = sideAt(cx) || 1;
    }
    return { cx, w, side, sx: clamp(cx + side * gap, pW * 0.45, xR) };
  }

  // Höhe der Wasserfläche (y in der Szene)
  _a2PoolWaterY(S = this._a2PoolS) {
    return this._g.gy - (POOL.floor - POOL.water.cy) * (S?.u ?? this._a2PoolDim().u);
  }

  // Becken anlegen bei P (aus _a2PoolSpot). flat: zusammengelegt (er bläst es dann auf), empty: ohne Wasser (er füllt
  // es mit der Gießkanne), pop: ploppt auf (sonst blendet es ein), gold: mit der Gummiente
  _a2PoolMake(P, { flat = false, empty = false, pop = true, gold = false } = {}) {
    if (this._a2PoolS) this._a2PoolEnd(true);
    const { w, u } = this._a2PoolDim();
    const sink = (POOL.vb[1] - POOL.floor) * u;
    const el = this._a2El('pool', POOL_BACK_SVG);
    const fr = document.createElement('div');
    fr.className = 'a2plf';
    fr.innerHTML = POOL_FRONT_SVG;
    this._el.gifts.appendChild(fr);
    for (const e of [el, fr]) {
      e.classList.remove('a2out', 'rip', 'rip2', 'wave', 'deflate');
      e.classList.toggle('leer', !!empty);
      e.classList.toggle('still', calmMotion());
      e.style.left = `${(P.cx - w / 2).toFixed(1)}px`;
      e.style.width = `${w.toFixed(1)}px`;
      e.style.bottom = `calc(var(--gb) - ${sink.toFixed(1)}px)`;
      e.style.zIndex = String(POOL_Z());
      e.style.setProperty('--a2plf', flat ? '0' : '1');
    }
    const S = { W: this._W, H: this._H, wx0: this._a2WxBad(true), el, fr, duck: null, cx: P.cx, w, u, side: P.side, sx: P.sx, flat, ctl: false, can: null, fx: new Set(), t: [] };
    this._a2PoolS = S;
    this._a2Scene(); // (golden: .gilt am hinteren Stück, das vordere bekommt es hier)
    fr.classList.toggle('gilt', el.classList.contains('gilt'));
    if (gold) this._a2PoolDuck(S, !empty);
    if (pop && !calmMotion()) {
      if (!flat) {
        for (const e of [el, fr]) e.classList.add('new');
        S.t.push(setTimeout(() => [el, fr].forEach((e) => e.classList.remove('new')), 800));
      }
    } else for (const e of [el, fr]) e.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
    return S;
  }

  // Die Gummiente aufs Wasser (on: gleich zu sehen, sonst erst, wenn Wasser drin ist: _a2PoolWater)
  _a2PoolDuck(S, on) {
    const d = document.createElement('div');
    d.className = `a2pld${calmMotion() ? ' still' : ''}${on ? ' on' : ''}`;
    d.innerHTML = POOL_DUCK_SVG;
    S.fr.appendChild(d);
    S.duck = d;
  }

  // Aufblasen: f von 0 (flach) bis 1 (prall), beide Stücke
  _a2PoolInflate(f) {
    const S = this._a2PoolS;
    if (!S) return;
    S.flat = f < 1;
    for (const e of [S.el, S.fr]) e.style.setProperty('--a2plf', f.toFixed(2));
  }

  // Wasser hinein (on) oder heraus. Die Ente kommt mit dem Wasser
  _a2PoolWater(on) {
    const S = this._a2PoolS;
    if (!S) return;
    for (const e of [S.el, S.fr]) e.classList.toggle('leer', !on);
    S.duck?.classList.toggle('on', on);
  }

  // Steht er im Becken (in), liegt das vordere Stück vor ihm
  _a2PoolFront(inside) {
    const S = this._a2PoolS;
    if (S) S.fr.style.zIndex = String(inside ? POOL_ZF() : POOL_Z());
  }

  // Pika selbst stellen (statt _setX): bei x, um dy px tiefer (im Becken) bzw. höher (negativ: auf dem Rand), mit
  // einem Übergang von ms (0: sofort). _lift bleibt 0.
  _a2PoolPika(x, dy, ms = 0, ease = 'ease-out') {
    const S = this._a2PoolS;
    if (S) S.ctl = true;
    const p = this._el.pika;
    this._x = x;
    this._lift = 0;
    this._lane = 0;
    const tr = `translate(${(x - this._g.pW / 2).toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const tn = ms ? `transform ${ms}ms ${ease}` : 'none';
    p.style.transition = tn;
    p.style.transform = tr;
    const t = this._el.psay.style;
    t.transition = tn;
    t.transform = tr;
    this._pikaZ?.();
  }

  // Wieder normal stellen (_setX, am Boden)
  _a2PoolStand() {
    const S = this._a2PoolS;
    if (S) S.ctl = false;
    this._lift = 0;
    this._setX(this._x, true);
  }

  // Zusammengelegtes Becken im Maul (an) oder abgesetzt
  _a2PoolCarry(on) {
    this._a2PoolCarrying = on;
    this._el.pika.classList.toggle('carry', on);
    this._mouth(on ? POOL_FARBE : null, on ? POOL_MOUTH : null);
  }

  // Die Gießkanne aus Album 1, wenn sie in der Szene steht (und nicht gerade unterwegs ist)
  _a2PoolCan() {
    const can = this._gtEls?.get(6);
    return can && !can.classList.contains('away') ? can : null;
  }

  // ---------- Wetter ----------

  // Temperatur in °C (roh aus der Wetter-Entität wie bei der Sonnenbrille, _tickGift; die Vorschau mit _dbgWeather)
  _a2PoolTemp() {
    const t = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) }.temp;
    return Number.isFinite(t) ? t : null;
  }

  // Seine Jahreszeit: die Monate aus den Daten (Juni bis August; Südhalbkugel versetzt wie beim Vogelhäuschen). Nur für
  // das Vertrösten nach dem Auspacken („im Sommer!“)
  _a2PoolSummer() {
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const mo = (new Date(this._dbgDate ?? Date.now()).getMonth() + (south ? 6 : 0)) % 12;
    return A2_POOL.mo.includes(mo);
  }

  // Planschwetter: ab 25 °C bei Tag; kein Gewitter, kein Starkregen, Hagel oder Schnee, kaum Wind. Leichter Regen
  // (rainy, 40) geht.
  _a2PoolWeather(wx = this._wx || {}) {
    const sc = this._el.scene.classList;
    return (this._a2PoolTemp() ?? -99) >= POOL_TEMP && !wx.storm && !wx.shelter && !wx.flash && !wx.hail
      && !((wx.rain || 0) > 40) && !((wx.snow || 0) > 0) && !wx.snowcover && !sc.contains('night') && !sc.contains('dusk')
      && (this._wind || 0) < 40;
  }

  // ---------- Was er damit tut ----------

  // Hook: nur bei Planschwetter; ab 30 °C öfter, bei leichtem Regen seltener
  // Liegt ein Häufchen, nicht (das Becken stünde auf schmalen Karten darüber, und erst wird sauber gemacht)
  _a2PoolActs({ wx, piles }, lv) {
    if (!this._a2PoolWeather(wx) || piles?.length) return [];
    const P = this._a2PoolSpot(); // (kein freier Platz: lieber nicht)
    if (!this._a2Room(P.cx, P.w, 'pool')) return [];
    const w = ((this._a2PoolTemp() ?? 0) >= 30 ? 0.8 : 0.45) * (wx.wet ? 0.4 : 1);
    return [[w, 'a2PoolPlay'], [lv >= 2 ? w * 0.6 : 0, 'a2PoolBomb']];
  }

  // Stufe 1 (Aktion 'a2PoolPlay'). o: { short: nach dem Auspacken (das Becken kommt gleich neben ihn, voll, kein
  // Wegräumen), gold: die Ente sicher }
  async _a2PoolPlay(o = {}) {
    return this._a2PoolGo('play', o);
  }

  // Stufe 2, der Trick (Aktion 'a2PoolBomb')
  async _a2PoolBomb(o = {}) {
    if (this._a2Lv('pool') < 2) return;
    return this._a2PoolGo('bomb', o);
  }

  async _a2PoolGo(mode, o) {
    const lv = this._a2Lv('pool');
    if (!lv || (!this._a2PoolWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('pool', POOL_GOLD));
    this._a2PoolBusy = true;
    try {
      await this._a2PoolSetUp(!!o.short, gold);
      if (mode === 'bomb' && !calmMotion()) await this._a2PoolCannon();
      else await this._a2PoolGetIn(mode === 'bomb');
      await this._a2PoolSplashes(mode, !!o.short);
      await this._a2PoolGetOut();
      if (!o.short) await this._a2PoolPack();
    } finally {
      this._a2PoolBusy = false;
      this._a2PoolEnd(true);
    }
  }

  // Holen, hinlegen, aufblasen, füllen. short (nach dem Auspacken) und Bewegung reduzieren: kein Holen, kein Aufblasen,
  // es kommt neben ihm (ruhig: blendet ein); nach dem Auspacken ist es gleich voll
  async _a2PoolSetUp(short, gold) {
    const p = this._el.pika;
    const { hole, pW } = this._g;
    const calm = calmMotion();
    const P = this._a2PoolSpot();
    await this._a2FrAside(P.cx - P.w / 2, P.cx + P.w / 2); // (der Freund steht nicht darin)
    const can = short ? null : this._a2PoolCan();
    const fetch = !short && !calm;
    if (fetch) {
      await this._walkTo(hole.cx + pW * 0.75, 1.1);
      this._face(-1);
      this._say(pick(['Planschbecken holen!', 'wo ist es…', 'Badezeit!']), 1300);
      await this._wait(700);
      p.classList.add('crouch');
      await this._wait(260);
      p.classList.remove('crouch');
      this._a2PoolCarry(true);
      await this._wait(300);
    }
    await this._walkTo(P.sx, 1);
    this._face(-P.side);
    if (this._a2PoolCarrying) {
      p.classList.add('crouch');
      await this._wait(260);
      p.classList.remove('crouch');
      this._a2PoolCarry(false);
    }
    this._a2PoolMake(P, { flat: fetch, empty: !!can, pop: !calm, gold });
    if (fetch) {
      // aufblasen: drei Puster, bei jedem richtet es sich ein Stück weiter auf
      this._puff(P.cx, this._g.gy, 2);
      await this._wait(400);
      p.classList.add('puffy');
      for (let i = 1; i <= 3; i++) {
        const n = this._nosePos();
        this._peep(n.x, n.y - this._H * 0.05, i === 3 ? 'pffft!' : 'pff…');
        this._a2PoolInflate(i / 3);
        await this._wait(i === 3 ? 600 : 700);
      }
      p.classList.remove('puffy');
      this._happy(900);
      this._say(pick(['aufgeblasen!', 'prall!', 'fertig!']), 1100);
      await this._wait(800);
    } else await this._wait(calm ? 600 : 700);
    if (can) await this._a2PoolFill(can);
  }

  // Mit der Gießkanne füllen: holen, zum Becken, gießen (das Wasser steigt), zurückstellen, wieder ans Becken
  async _a2PoolFill(can) {
    const S = this._a2PoolS;
    if (!S) return;
    const p = this._el.pika;
    const { pW, gy } = this._g;
    const cx = this._giftX(6);
    this._say(pick(['Wasser holen!', 'Gießkanne!', 'noch leer…']), 1200);
    await this._approach(cx, 1.1);
    S.can = can;
    can.classList.add('away');
    p.classList.add('wcan');
    await this._wait(400);
    await this._walkTo(S.sx, 1);
    this._face(-S.side);
    await this._wait(300);
    p.classList.add('pour');
    await this._wait(400);
    this._a2PoolWater(true);
    const sx = this._x + this._dir * pW * 0.5;
    for (let i = 0; i < 12; i++) {
      const d = document.createElement('span');
      d.className = 'gdrop';
      d.style.left = `${(sx + rnd(-pW * 0.05, pW * 0.05)).toFixed(1)}px`;
      d.style.top = `${(gy - this._H * 0.14 + rnd(-2, 2)).toFixed(1)}px`;
      this._el.fx.appendChild(d);
      S.fx.add(d);
      S.t.push(setTimeout(() => (d.remove(), S.fx.delete(d)), 600));
      await this._wait(180);
    }
    p.classList.remove('pour');
    this._say(pick(['voll!', 'plätscher!', 'so!']), 1100);
    await this._wait(600);
    await this._approach(cx, 1.1);
    can.classList.remove('away');
    p.classList.remove('wcan');
    S.can = null;
    await this._wait(300);
    await this._walkTo(S.sx, 1);
    this._face(-S.side);
    await this._wait(300);
  }

  // Hinein: hüpfen (ruhig, und beim ruhigen Trick: hineingehen und sich setzen)
  async _a2PoolGetIn(bomb = false) {
    const S = this._a2PoolS;
    if (!S) return;
    const p = this._el.pika;
    const sink = POOL_SINK * S.u;
    if (calmMotion()) {
      this._a2PoolFront(true);
      await this._walkTo(S.cx, 0.7);
      this._a2PoolPika(S.cx, sink, 500);
      p.classList.add('a2pl-in');
      await this._wait(500);
      this._a2PoolSplash(0, bomb);
      this._say(bomb ? pick(['sanfte Arschbombe!', 'platsch… ganz leise!']) : pick(['herrlich!', 'schön kühl!']), 1400);
      await this._wait(1200);
      return;
    }
    this._say(pick(['rein!', 'eins, zwei…', 'hopp!']), 1000);
    p.classList.add('crouch');
    await this._wait(180);
    p.classList.remove('crouch');
    S.t.push(setTimeout(() => this._a2PoolS === S && this._a2PoolFront(true), 200));
    this._a2PoolPika(S.cx, sink, 550, HOP_EASE);
    this._jump('hop1', true);
    await this._wait(JUMPS.hop1.air[1]);
    this._a2PoolFront(true);
    p.classList.add('a2pl-in');
    this._a2PoolSplash(4);
    this._say(pick(['platsch!', 'plitsch!', 'huch, nass!']), 1100);
    await this._wait(500);
  }

  // Der Trick: auf den Rand, wackeln, bis drei zählen, zusammengerollt hinein. Großer Spritzer, das Wasser schwappt
  async _a2PoolCannon() {
    const S = this._a2PoolS;
    if (!S) return;
    const p = this._el.pika;
    const sink = POOL_SINK * S.u;
    const lift = (POOL.floor - POOL.rim.cy) * S.u;
    const rx = S.cx + S.side * (POOL.rim.rx - 3) * S.u;
    this._say(pick(['Arschbombe!', 'jetzt kommt\'s!', 'aufgepasst!']), 1200);
    await this._wait(700);
    // auf den Rand
    p.classList.add('crouch');
    await this._wait(200);
    p.classList.remove('crouch');
    this._a2PoolPika(rx, -lift, 550, HOP_EASE);
    this._jump('hop1', true);
    await this._wait(650);
    this._face(-S.side);
    p.classList.add('a2pl-wob');
    this._say('eins… zwei…', 1100);
    await this._wait(1100);
    p.classList.remove('a2pl-wob');
    this._say('…drei!', 800);
    p.classList.add('crouch');
    await this._wait(240);
    p.classList.remove('crouch');
    // hinein, zusammengerollt
    p.classList.add('a2pl-ball');
    S.t.push(setTimeout(() => this._a2PoolS === S && this._a2PoolFront(true), 300));
    this._a2PoolPika(S.cx, sink, 760, 'cubic-bezier(.45, 0, .7, .5)');
    this._jump('binky', true);
    await this._wait(JUMPS.binky.air[1]);
    p.classList.remove('a2pl-ball');
    this._a2PoolFront(true);
    p.classList.add('a2pl-in');
    this._a2PoolSplash(14, true);
    this._say('PLATSCH!', 1300);
    await this._wait(1200);
    this._happy(1200);
    this._say(pick(['hihi!', 'nochmal!', 'alles nass!']), 1200);
    await this._wait(900);
  }

  // Planschen: hüpfen, es spritzt; einmal umdrehen; golden die Ente bestaunen
  async _a2PoolSplashes(mode, short) {
    const S = this._a2PoolS;
    if (!S) return;
    const p = this._el.pika;
    const calm = calmMotion();
    const n = mode === 'bomb' ? (short ? 1 : 2) : short ? 2 : 3 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (!calm) {
        this._jump('hop1', true);
        await this._wait(JUMPS.hop1.air[1]);
        this._a2PoolSplash(5);
      } else this._a2PoolSplash(0);
      if (i % 2 === 0) this._say(pick(['plitsch!', 'platsch!', 'hihi!', 'spritz!']), 800);
      await this._wait(rnd(600, 900));
      if (i === 1) this._face(-this._dir);
    }
    this._happy(1400);
    this._say(pick(['schön kühl!', 'herrlich!', 'ahh…']), 1400);
    await this._wait(1500);
    const d = S.duck;
    if (d?.classList.contains('on')) {
      const r = d.getBoundingClientRect();
      const sc = this._el.scene.getBoundingClientRect();
      const x = r.left - sc.left + r.width / 2;
      const y = r.top - sc.top;
      this._face(x >= this._x ? 1 : -1);
      d.classList.remove('bob');
      void d.offsetWidth;
      d.classList.add('bob');
      S.t.push(setTimeout(() => d.classList.remove('bob'), 700));
      this._peep(x, y - 4, 'quietsch!');
      this._mimik('awe', 1400);
      this._say(pick(['meine Gummiente!', 'eine goldene Ente!', 'Entchen!']), 1500);
      for (let i = 0; i < 3; i++) S.t.push(setTimeout(() => this._a2PoolS === S && this._sparkle(x, y + 2, 1), i * 300));
      await this._wait(1800);
    }
    p.classList.add('content');
    await this._wait(short ? 700 : rnd(1500, 2500));
    p.classList.remove('content');
  }

  // Heraus (ruhig: hinausgehen), tropfen, schütteln
  async _a2PoolGetOut() {
    const S = this._a2PoolS;
    if (!S) return;
    const p = this._el.pika;
    if (calmMotion()) {
      this._a2PoolPika(S.cx, 0, 500);
      await this._wait(500);
      this._a2PoolStand();
      p.classList.remove('a2pl-in');
      await this._walkTo(S.sx, 0.7);
      this._a2PoolFront(false);
      this._face(-S.side);
      this._say(pick(['schön kühl!', 'erfrischend!']), 1200);
      await this._wait(1000);
      return;
    }
    p.classList.add('crouch');
    await this._wait(180);
    p.classList.remove('crouch');
    this._a2PoolPika(S.sx, 0, 550, HOP_EASE);
    this._jump('hop1', true);
    this._a2PoolSplash(2);
    S.t.push(setTimeout(() => this._a2PoolS === S && p.classList.remove('a2pl-in'), 150));
    S.t.push(setTimeout(() => this._a2PoolS === S && this._a2PoolFront(false), 380));
    await this._wait(650);
    this._a2PoolStand();
    p.classList.remove('a2pl-in');
    this._a2PoolFront(false);
    // tropft, dann schütteln
    p.classList.add('a2pl-drip');
    this._a2PoolDrip();
    for (let i = 1; i < 6; i++) S.t.push(setTimeout(() => this._a2PoolS === S && this._a2PoolDrip(), i * 230));
    this._say(pick(['tropf…', 'pitschnass!', 'nass!']), 1100);
    await this._wait(1300);
    p.classList.add('a2pl-shake');
    this._a2PoolShake();
    this._say(pick(['schüttel!', 'brrr-schüttel!', 'wusch!']), 900);
    await this._wait(700);
    p.classList.remove('a2pl-shake', 'a2pl-drip');
    this._happy(1000);
    await this._wait(900);
  }

  // Wegräumen: Wasser ablassen, Luft heraus, zusammenlegen, in den Bau tragen (ruhig: es blendet aus, _a2PoolEnd)
  async _a2PoolPack() {
    const S = this._a2PoolS;
    if (!S || calmMotion()) return;
    const p = this._el.pika;
    const { hole, pW } = this._g;
    this._face(-S.side);
    this._a2PoolWater(false);
    this._peep(S.cx, this._a2PoolWaterY(S) - this._H * 0.04, 'gluck, gluck');
    await this._wait(1300);
    for (const e of [S.el, S.fr]) e.classList.add('deflate');
    this._a2PoolInflate(0);
    const n = this._nosePos();
    this._peep(n.x, n.y - this._H * 0.05, 'pfffff…');
    p.classList.add('crouch');
    await this._wait(1000);
    p.classList.remove('crouch');
    this._a2PoolEnd(true, true);
    this._a2PoolCarry(true);
    await this._wait(250);
    await this._walkTo(hole.cx + pW * 0.75, 1);
    this._face(-1);
    p.classList.add('crouch');
    await this._wait(260);
    p.classList.remove('crouch');
    this._a2PoolCarry(false);
    this._say(pick(['bis zum nächsten Mal!', 'aufgeräumt!', 'das war schön!']), 1300);
    await this._wait(900);
  }

  // Nach dem Auspacken (Hook): Bei Planschwetter gleich kurz planschen (Stufe 2 die Arschbombe, 3 mit Ente). Sonst nur
  // zeigen: Das Becken kommt voll neben ihn, er tippt mit der Pfote hinein, es ist zu kalt (oder kein Sommer, kein
  // Wetter dafür), er vertröstet. Golden schwimmt die Ente schon („die Ente darf!“).
  async _a2PoolStow(lv) {
    if (this._a2PoolWeather()) return lv === 2 ? this._a2PoolBomb({ short: true }) : this._a2PoolPlay({ short: true, gold: lv >= 3 });
    this._a2PoolBusy = true;
    const p = this._el.pika;
    try {
      const P = this._a2PoolSpot();
      await this._a2FrAside(P.cx - P.w / 2, P.cx + P.w / 2);
      await this._walkTo(P.sx, 1);
      this._face(-P.side);
      this._a2PoolMake(P, { pop: !calmMotion(), gold: lv >= 3 });
      this._say(lv >= 3 ? pick(['goldig!', 'mit Gummiente!']) : lv === 2 ? pick(['für Arschbomben!', 'platsch, bald!']) : pick(['zum Planschen!', 'ein Becken!']), 1300);
      await this._wait(1300);
      p.classList.add('crouch');
      await this._wait(300);
      this._a2PoolSplash(0);
      const S = this._a2PoolS;
      if (S) this._peep(S.cx + S.side * S.w * 0.3, this._a2PoolWaterY(S) - 6, 'tipp');
      await this._wait(500);
      p.classList.remove('crouch');
      // warum nicht: zu kalt (außerhalb seiner Monate: kein Sommer), sonst das Wetter oder die Tageszeit
      const why = (this._a2PoolTemp() ?? -99) >= POOL_TEMP ? 'heute' : this._a2PoolSummer() ? 'kalt' : 'sommer';
      this._say(why === 'sommer' ? pick(['kein Sommer…', 'noch kein Badewetter…']) : why === 'kalt' ? pick(['brrr, zu kalt!', 'huh, kalt!']) : pick(['heute nicht…', 'ein andermal…']), 1500);
      await this._wait(1600);
      if (lv >= 3) {
        this._say('die Ente darf!', 1300);
        await this._wait(1400);
      }
      this._say(why === 'sommer' ? pick(['im Sommer!', 'bis zum Sommer!']) : why === 'kalt' ? pick(['wenn\'s heiß ist!', 'ab 25 Grad!']) : pick(['bald!', 'wenn die Sonne scheint!']), 1400);
      this._happy(1000);
      await this._wait(1500);
    } finally {
      this._a2PoolBusy = false;
      this._a2PoolEnd(true);
    }
  }

  // ---------- Wasser, Tropfen ----------

  // Ringe laufen über das Wasser (big: ein zweiter, größerer, und das Wasser schwappt), die Ente hüpft; n Tropfen
  // spritzen von der Wasserfläche um ihn auf. Bewegung reduzieren: nur der Ring.
  _a2PoolSplash(n, big = false) {
    const S = this._a2PoolS;
    if (!S) return;
    const cls = big && !calmMotion() ? ['rip', 'rip2', 'wave'] : ['rip'];
    for (const e of [S.el, S.fr]) {
      e.classList.remove(...cls);
      void e.offsetWidth;
      e.classList.add(...cls);
    }
    S.t.push(setTimeout(() => [S.el, S.fr].forEach((e) => e.classList.remove(...cls)), 950));
    if (S.duck && !calmMotion()) {
      S.duck.classList.remove('bob');
      void S.duck.offsetWidth;
      S.duck.classList.add('bob');
    }
    if (calmMotion() || !n) return;
    const { pW, pH } = this._g;
    const y = this._a2PoolWaterY(S);
    const k = big ? 1.7 : 1;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const s = document.createElement('span');
      s.className = 'splash a2plsp';
      s.innerHTML = DROP_SVG;
      s.style.left = `${clamp(this._x + side * rnd(0.15, 0.5) * pW, S.cx - S.w / 2, S.cx + S.w / 2).toFixed(1)}px`;
      s.style.top = `${(y - pH * 0.04).toFixed(1)}px`;
      s.style.setProperty('--dx', `${(side * rnd(0.1, 0.42) * pW * k).toFixed(1)}px`);
      s.style.setProperty('--dy', `${(-rnd(0.22, 0.55) * pH * k).toFixed(1)}px`);
      this._el.fx.appendChild(s);
      S.fx.add(s);
      S.t.push(setTimeout(() => (s.remove(), S.fx.delete(s)), 800));
    }
  }

  // Ein Tropfen fällt aus dem Fell (nach dem Planschen)
  _a2PoolDrip() {
    const S = this._a2PoolS;
    if (!S || calmMotion()) return;
    const { pW, pH, gy } = this._g;
    const s = document.createElement('span');
    s.className = 'a2pldrip';
    s.innerHTML = DROP_SVG;
    s.style.left = `${(this._x + rnd(-0.3, 0.3) * pW).toFixed(1)}px`;
    s.style.top = `${(gy - pH * rnd(0.15, 0.55)).toFixed(1)}px`;
    this._el.fx.appendChild(s);
    S.fx.add(s);
    S.t.push(setTimeout(() => (s.remove(), S.fx.delete(s)), 900));
  }

  // Schütteln: Tropfen fliegen nach beiden Seiten aus dem Fell
  _a2PoolShake() {
    const S = this._a2PoolS;
    if (!S || calmMotion()) return;
    const { pW, pH, gy } = this._g;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const s = document.createElement('span');
      s.className = 'splash a2plsp';
      s.innerHTML = DROP_SVG;
      s.style.left = `${(this._x + side * rnd(0.2, 0.4) * pW).toFixed(1)}px`;
      s.style.top = `${(gy - pH * rnd(0.3, 0.6)).toFixed(1)}px`;
      s.style.setProperty('--dx', `${(side * rnd(0.3, 0.6) * pW).toFixed(1)}px`);
      s.style.setProperty('--dy', `${(-rnd(0.08, 0.25) * pH).toFixed(1)}px`);
      this._el.fx.appendChild(s);
      S.fx.add(s);
      S.t.push(setTimeout(() => (s.remove(), S.fx.delete(s)), 800));
    }
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Der vordere Rand liegt in einem eigenen Element (.a2plf): Seine Zeichnung gehört zur Tippfläche (seit 0.48.1)
  _a2PoolParts() {
    return [this._a2PoolS?.fr];
  }

  // Tipp ins Becken (nur, solange es steht und aufgeblasen ist): Ring auf dem Wasser, plitsch, ein paar Tropfen
  _a2PoolTap() {
    const S = this._a2PoolS;
    if (!S || S.flat || S.el.classList.contains('leer')) return false;
    this._a2PoolSplash(0);
    const x = S.cx + rnd(-0.25, 0.25) * S.w;
    const y = this._a2PoolWaterY(S);
    this._peep(x, y - this._H * 0.06, pick(['plitsch!', 'platsch!', 'blubb!']));
    if (!calmMotion()) {
      const { pW, pH } = this._g;
      for (let i = 0; i < 2; i++) {
        const s = document.createElement('span');
        s.className = 'splash a2plsp';
        s.innerHTML = DROP_SVG;
        s.style.left = `${x.toFixed(1)}px`;
        s.style.top = `${(y - pH * 0.03).toFixed(1)}px`;
        s.style.setProperty('--dx', `${((i ? 1 : -1) * rnd(0.08, 0.2) * pW).toFixed(1)}px`);
        s.style.setProperty('--dy', `${(-rnd(0.12, 0.25) * pH).toFixed(1)}px`);
        this._el.fx.appendChild(s);
        S.fx.add(s);
        S.t.push(setTimeout(() => (s.remove(), S.fx.delete(s)), 800));
      }
    }
    return true;
  }

  // Ende der Aktion oder Abbruch (auch aus _cleanup nach jeder Aktion): Becken (beide Stücke), Ente, Tropfen,
  // Zeitgeber, das Becken im Maul weg, die Gießkanne wieder an ihren Platz; stellte er den Pika selbst, steht der wieder
  // normal am Boden. (force: aus der eigenen Aktion. Sonst, mitten in ihr, aus Szene oder Aufräumen: nichts, sie räumt
  // in ihrem finally selbst auf; nur nach einem Abbruch gleich.) now: sofort, ohne Ausblenden
  _a2PoolEnd(force = false, now = false) {
    if (!force && this._a2PoolBusy && !this._ac?.signal?.aborted) return;
    const p = this._el.pika;
    if (this._a2PoolCarrying) this._a2PoolCarry(false);
    p.classList.remove(...POOL_CLS);
    const S = this._a2PoolS;
    if (!S) return;
    this._a2PoolS = null;
    for (const t of S.t) clearTimeout(t);
    for (const e of S.fx) e.remove();
    if (S.can) {
      S.can.classList.remove('away');
      p.classList.remove('wcan', 'pour');
    }
    if (S.ctl) {
      this._lift = 0;
      this._setX(this._x, true);
    }
    const fr = S.fr;
    const el = S.el;
    if (now || !fr.isConnected) fr.remove();
    else {
      fr.classList.add('a2out');
      setTimeout(() => fr.remove(), 450);
    }
    if (!now && el.isConnected && this._a2Els?.get('pool') === el) {
      el.classList.add('a2out');
      setTimeout(() => !this._a2PoolS && this._a2Drop('pool'), 450);
    } else this._a2Drop('pool');
  }

  _a2PoolCleanup() {
    this._a2PoolEnd();
  }

  // Karte aus dem DOM: alles sofort weg
  _a2PoolDetach() {
    this._a2PoolBusy = false;
    this._a2PoolEnd(true, true);
  }
}
