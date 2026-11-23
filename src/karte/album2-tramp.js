// Album 2: das Trampolin (key 'tramp', t2 = 5). Es steht nicht in der Szene; ist es trocken und Tag, holt er es für
// seinen Moment heraus (wie die Hängematte): Auf der Wiese zwischen Vorrat und Stein liegt es erst zusammengeklappt da,
// er klappt es auf, hüpft hinauf und springt, jedes Mal höher, das Tuch federt unter ihm. Danach hüpft er herunter und
// klappt es wieder zusammen. Stufe 2 (Trick): Beim höchsten Sprung schlägt er einen Salto. Stufe 3 (Gold): Beim
// höchsten Sprung stieben goldene Sternchen um ihn (mit Abstand und Würfel wie GOLD, src/logik/paeckchen.js). Tippst du
// das Trampolin an, solange es draußen steht, federt das Tuch nach (steht er darauf, wippt er mit).
//
// Bewegung: Die Höhe (Tuch, Sprung) und der Salto stecken nur im transform von .depth im Pika, nie in _lift. Mit
// _lift > 0 hielte die Lebensschleife ihn nach einem Abbruch für einen, der auf dem Stein steht (hopDown), und _setX
// machte ihn kleiner. So bleibt _lift immer 0: Wird er mitten im Sprung unterbrochen, nimmt das Aufräumen das transform
// weg, und er landet (kurz nachgleitend) am Boden, wo er ist. Den Salto dreht .depth um die Körpermitte; .flip liegt
// darin, darum mal der Blickrichtung (vorwärts in beide Richtungen). Ein Bild-für-Bild-Takt (requestAnimationFrame)
// stellt Pika, Tuch und den Schatten auf dem Tuch; ohne Takt (Tests, verborgene Karte) stimmt jeder Abschnitt an seinem
// Ende trotzdem (_a2TrampDrive setzt das Ziel selbst). Die Sprechblase läuft nur mit der Höhe des Tuchs mit, nicht mit
// den Sprüngen: Er spricht nur, wenn er steht.
// Reduzierte Bewegung: kein Sprung, kein Salto. Das Trampolin blendet ein, er steigt hinauf, wippt sanft am Platz,
// golden blenden die Sternchen am Platz ein und aus, dann steigt er herunter und es blendet aus.

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import { GOLD_STAR } from '../grafik/paeckchen.js';
import { TRAMP_VB, TRAMP_FOOT, TRAMP_MAT, trampMat, TRAMP_BACK, TRAMP_FRONT, TRAMP_W } from '../grafik/album2/tramp.js';

// Sternchen höchstens alle 2 Minuten und dann zu sechs von zehn Sprüngen (wie GOLD in src/logik/paeckchen.js)
const TRAMP_GOLD = { cd: 2 * 6e4, p: 0.6 };
// Ebenen: was hinten liegt, unter dem Pika (Rang vogel, über den Requisiten); der vordere Bogen vor ihm
const TRAMP_Z = () => buehneZ(REIHE.vorn, 'vogel');
const TRAMP_FZ = () => buehneZ(REIHE.vorn, 'requisitVorn');
// Flugzeit des höchsten Sprungs (ms; niedrigere kürzer wie beim echten Wurf), Zeit im Tuch je Landung
const TRAMP_AIR = 920;
const TRAMP_DOWN = 200;
// So weit gibt das Tuch höchstens nach (Einheiten der Grafik, siehe trampMat)
const TRAMP_DIP = 3.4;
// Drehpunkt des Saltos in .depth (Körpermitte, in Anteilen des Pika-Kastens von oben)
const TRAMP_PIVOT = 0.58;
// Pika-Klassen dieses Schatzes (_cleanup kennt sie nicht, das Aufräumen nimmt sie ab)
const TRAMP_CLS = ['a2tr', 'a2tr-sq', 'a2tr-up', 'a2tr-tuck'];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const smooth = (f) => f * f * (3 - 2 * f);

export class Album2Tramp {
  // ---------- Szene ----------

  // Szene (Hook): Es steht nie dauerhaft. Nur, solange er es benutzt (_a2TrampS), bleibt es; sonst weg. Hat sich die
  // Größe der Karte geändert, steht es an alten Pixeln: abbrechen (wie der Schlitten)
  _a2TrampScene(lv) {
    const S = this._a2TrampS;
    if (S && this._a2TrampBusy && ((S.W !== this._W || S.H !== this._H) || this._a2WxTurned(S))) this._interrupt(); // (neue Größe; Regen setzt ein)
    else if (!S || !(lv > 0)) this._a2TrampEnd();
    if (S && this._a2TrampS === S) S.front.classList.toggle('gilt', lv >= 3);
  }

  // Wo es steht: auf der Wiese zwischen Vorrat und Stein, neben allem, was dort schon steht (_groundSpot, bevor es selbst
  // dort steht). Auf schmalen Karten, wo die Wiese nicht reicht, bis auf drei Viertel kleiner. → { x: Mitte, w: Breite }
  // Seit 0.48.1: Steht es dort auf etwas (auf schmalen Karten das Windrad dicht am Heu), darf es nach rechts bis vor den
  // Fuß des Steins rücken (der steht dahinter, wie beim Becken), wenn dort Platz ist (_a2Free).
  _a2TrampSpot() {
    const { pW, hayR, rock } = this._g;
    const U = this._groundSpot(Math.random(), pW * TRAMP_W * 1.06, 0.75);
    const w = U.w / 1.06;
    if (!this._a2Hit(U.x, w, 'tramp', [], true)) return { x: U.x, w };
    const lo = hayR + w / 2;
    const hi = Math.min(this._W - w / 2 - 2, rock.l + rock.w * 0.3);
    return { x: this._a2Free(lo, Math.max(lo, hi), w, clamp(U.x, lo, Math.max(lo, hi)), 'tramp'), w };
  }

  // Wie hoch er über dem Tuch höchstens springt (px): Der Kopf bleibt im Bild, auch quer im Salto (dann ragt er um
  // etwa 0,13 Pika-Höhen weiter hinauf), mit einem Rand oben; höchstens 0,8 Pika-Höhen. Seit 0.48.1 zählt oben die
  // Unterkante der Statusleiste, wenn sie zu sehen ist und er unter ihr springt (x: Mitte des Trampolins; auf schmalen
  // Karten tauchte er sonst hinter ihr durch)
  _a2TrampTop(mat, x = null) {
    const { gy, pH, pW } = this._g;
    let top = 0;
    const st = this._el?.stats;
    if (x != null && st && !st.hidden) {
      const l = st.offsetLeft;
      const r = l + st.offsetWidth;
      const b = st.offsetTop + st.offsetHeight;
      if (Number.isFinite(l) && Number.isFinite(r) && Number.isFinite(b) && st.offsetHeight > 0 && x - pW * 0.6 < r && x + pW * 0.6 > l) top = b;
    }
    const free = gy - pH * 0.945 - mat - top - Math.max(6, (this._Hs || this._H) * 0.04) - pH * 0.13;
    return clamp(free, pH * 0.2, pH * 0.8);
  }

  // Trampolin anlegen (Element aus _a2El: Tippfläche, Licht, golden; dazu der vordere Bogen) mit Mitte x, Breite w.
  // Es liegt zusammengeklappt da (fold) bzw. ist bei reduzierter Bewegung noch ausgeblendet. → der Zustand
  _a2TrampMake(x, w) {
    if (this._a2TrampS) this._a2TrampEnd(true);
    const s = w / TRAMP_VB[0];
    const h = TRAMP_VB[1] * s;
    const sink = (TRAMP_VB[1] - TRAMP_FOOT) * s;
    const box = (el) => {
      el.style.left = `${(x - w / 2).toFixed(1)}px`;
      el.style.width = `${w.toFixed(1)}px`;
      el.style.height = `${h.toFixed(1)}px`;
      el.style.bottom = `calc(var(--gb) - ${sink.toFixed(1)}px)`;
    };
    const el = this._a2El('tramp', `<div class="a2trw">${TRAMP_BACK}</div>`);
    el.classList.remove('a2out', 'fold');
    box(el);
    el.style.zIndex = String(TRAMP_Z());
    const front = document.createElement('div');
    front.className = 'gt a2-trampf';
    front.innerHTML = `<div class="a2trw">${TRAMP_FRONT}</div>`;
    box(front);
    front.style.zIndex = String(TRAMP_FZ());
    this._el.gifts.appendChild(front);
    const S = {
      W: this._W, H: this._H, wx0: this._a2WxBad(), el, front, x, w, s, mat: (TRAMP_FOOT - TRAMP_MAT) * s, mpath: el.querySelector('.a2trm'), msh: el.querySelector('.a2trs'),
      mode: 'off', y: 0, air: 0, dip: 0, rot: 0, ctl: false, spring: null, drive: null, raf: 0, F: [], t: [], hp: 0, folded: false,
    };
    S.top = this._a2TrampTop(S.mat, x);
    this._a2TrampS = S;
    this._a2Scene(); // (golden: .gilt am Element; den vorderen Bogen setzt der Hook Scene)
    for (const e of [el, front]) e.classList.add(calmMotion() ? 'a2out' : 'fold');
    void el.offsetWidth;
    this._a2TrampPlace();
    this._a2TrampRun();
    return S;
  }

  // Aufklappen (bzw. einblenden) und zusammenklappen (bzw. ausblenden)
  _a2TrampFold(on) {
    const S = this._a2TrampS;
    if (!S) return;
    const k = calmMotion() ? 'a2out' : 'fold';
    for (const e of [S.el, S.front]) e.classList.toggle(k, on);
    S.folded = on;
  }

  // ---------- Takt ----------

  // Bild für Bild: laufender Abschnitt (drive), dann Pika, Tuch und Schatten stellen. Seit 0.48.1 nur, solange sich
  // etwas bewegt (ein Abschnitt läuft oder das Tuch federt nach einem Tipp); Drive und Tipp starten den Takt wieder.
  _a2TrampRun() {
    const S = this._a2TrampS;
    if (!S || S.raf || typeof requestAnimationFrame !== 'function') return;
    const frame = (t) => {
      if (this._a2TrampS !== S) return;
      S.raf = 0;
      try {
        if (S.drive) S.drive.step(clamp((t - S.drive.t0) / S.drive.ms, 0, 1));
        this._a2TrampPlace();
      } catch (e) {
        this._err?.('Album 2 tramp', e);
        return;
      }
      if (S.drive || S.spring) S.raf = requestAnimationFrame(frame);
    };
    S.raf = requestAnimationFrame(frame);
  }

  // Ein Abschnitt von ms Dauer: step(f) mit f von 0 bis 1 stellt alles; am Ende gilt step(1) sicher
  async _a2TrampDrive(ms, step) {
    const S = this._a2TrampS;
    if (!S) return;
    S.drive = { t0: now(), ms, step };
    this._a2TrampRun();
    step(0);
    try {
      await this._wait(ms);
    } finally {
      if (S.drive?.step === step) S.drive = null;
    }
    step(1);
    this._a2TrampPlace();
  }

  // Wie weit das Tuch gerade nachfedert (nach einem Tipp): gedämpfte Schwingung, ruhig nur ein sanftes Nachgeben
  _a2TrampSpring(S, t = now()) {
    const P = S.spring;
    if (!P) return 0;
    const d = t - P.t0;
    if (d > 1500 || d < 0) {
      S.spring = null;
      return 0;
    }
    if (P.calm) return P.amp * Math.sin(Math.PI * Math.min(1, d / 900));
    return Math.max(-1, P.amp * Math.exp(-d / 380) * Math.sin((2 * Math.PI * d) / 280));
  }

  // Pika (Höhe und Drehung in .depth), Tuch und Schatten auf dem Tuch stellen. Auf dem Tuch (mode 'mat') stehen seine
  // Füße, solange er nicht in der Luft ist, dort, wo es gerade ist; sonst (mode 'off', beim Hinauf- und Herunterhüpfen)
  // in der Höhe S.y
  _a2TrampPlace() {
    const S = this._a2TrampS;
    if (!S) return;
    const dip = S.dip + this._a2TrampSpring(S);
    const y = S.mode === 'mat' ? S.mat + S.air - (S.air > 0 ? 0 : dip * S.s) : S.y;
    if (S.ctl) {
      const d = this._el.depth;
      d.style.transformOrigin = `50% ${(TRAMP_PIVOT * 100).toFixed(0)}%`;
      d.style.transform = `translateY(${(-y).toFixed(1)}px)${S.rot ? ` rotate(${(S.rot * this._dir).toFixed(1)}deg)` : ''}`;
    }
    S.mpath?.setAttribute?.('d', trampMat(dip));
    // Schatten auf dem Tuch: sinkt mit ihm, wird kleiner und blasser, je höher er ist; ohne ihn darauf keiner
    const up = S.mode === 'mat' ? S.air : Math.max(0, y - S.mat);
    const near = S.ctl && Math.abs(this._x - S.x) < S.w * 0.3;
    const k = near ? 1 / (1 + up / (this._g.pH * 0.5)) : 0;
    S.msh?.setAttribute?.('transform', `translate(32 ${(9.4 + dip * 0.8).toFixed(2)}) scale(${k.toFixed(3)}) translate(-32 -9.4)`);
  }

  // Er übernimmt (an) bzw. gibt ab: eigene Klasse am Pika (sein Schatten ist der auf dem Tuch), Sprechblase mit der Höhe
  // des Tuchs (an) bzw. wieder normal
  _a2TrampCtl(on) {
    const S = this._a2TrampS;
    const p = this._el.pika;
    const d = this._el.depth.style;
    if (S) S.ctl = on;
    p.classList.toggle('a2tr', on);
    // (Im Bau überblendet .depth sein transform, _pose setzt dafür eine Transition; die hinkte hier jedem Bild nach)
    if (on) {
      this._a2TrampDtr ??= d.transition || '';
      d.transition = 'none';
      return;
    }
    p.classList.remove(...TRAMP_CLS);
    d.transform = '';
    d.transformOrigin = '';
    void this._el.depth.offsetWidth; // (erst ohne Transition zurück, dann ihre alte wieder)
    if (this._a2TrampDtr != null) d.transition = this._a2TrampDtr;
    this._a2TrampDtr = null;
  }

  // Sprechblase auf die Höhe des Tuchs (er steht darauf) bzw. wieder auf den Boden
  _a2TrampSay(onMat) {
    const S = this._a2TrampS;
    const t = this._el.psay.style;
    const { pW } = this._g;
    t.transform = `translate(${(this._x - pW / 2).toFixed(1)}px, ${(onMat && S ? -S.mat : 0).toFixed(1)}px)`;
  }

  // ---------- Was er damit tut ----------

  // Trampolinwetter: trocken (kein Regen, kein Schnee, keiner liegt), kein Sturm, kein starker Wind, Tag (nicht in
  // der Dämmerung, nicht nachts)
  _a2TrampWeather(wx = this._wx || {}) {
    const sc = this._el.scene.classList;
    return !wx.wet && !(wx.snow > 0) && !wx.snowcover && !wx.storm && !wx.shelter && !wx.hail
      && !sc.contains('night') && !sc.contains('dusk') && (this._wind || 0) < 40;
  }

  // Hook: nur bei Trampolinwetter; der Salto erst ab Stufe 2
  _a2TrampActs({ wx }, lv) {
    if (!this._a2TrampWeather(wx)) return [];
    const T = this._a2TrampSpot(); // (kein freier Platz: lieber nicht)
    if (!this._a2Room(T.x, T.w, 'tramp')) return [];
    return [[0.35, 'a2TrampPlay'], [lv >= 2 ? 0.25 : 0, 'a2TrampFlip']];
  }

  // Stufe 1 (Aktion 'a2TrampPlay'): springen, immer höher. o: { short: nach dem Auspacken (weniger Sprünge), gold:
  // Sternchen sicher }
  async _a2TrampPlay(o = {}) {
    return this._a2TrampGo(false, o);
  }

  // Stufe 2, der Trick (Aktion 'a2TrampFlip'): Salto beim höchsten Sprung
  async _a2TrampFlip(o = {}) {
    if (this._a2Lv('tramp') < 2) return;
    return this._a2TrampGo(true, o);
  }

  async _a2TrampGo(flip, o) {
    const lv = this._a2Lv('tramp');
    if (!lv || (!this._a2TrampWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('tramp', TRAMP_GOLD));
    this._a2TrampBusy = true;
    try {
      await this._a2TrampOut();
      if (calmMotion()) await this._a2TrampCalm(flip, gold);
      else await this._a2TrampJump(flip, gold, o);
      await this._a2TrampAway();
    } finally {
      this._a2TrampBusy = false;
      this._a2TrampEnd(true);
    }
  }

  // Holen: neben die Stelle, es liegt zusammengeklappt da, er klappt es auf (bzw. es blendet ein). Er steht auf der
  // Seite, von der er kommt, außer dort ist kein Platz (Kartenrand). → der Zustand
  async _a2TrampOut() {
    const { pW, xR } = this._g;
    const T = this._a2TrampSpot();
    await this._a2FrAside(T.x - T.w / 2, T.x + T.w / 2); // (der Freund steht nicht darauf)
    const off = T.w / 2 + pW * 0.38;
    const ok = (x) => x >= pW * 0.45 && x <= xR;
    let side = this._x < T.x ? -1 : 1;
    if (!ok(T.x + side * off) && ok(T.x - side * off)) side = -side;
    await this._walkTo(clamp(T.x + side * off, pW * 0.45, xR), 1);
    this._face(T.x >= this._x ? 1 : -1);
    this._say(pick(['Trampolin!', 'aufklappen…', 'Zeit zum Hüpfen!']), 1200);
    await this._wait(500);
    const S = this._a2TrampMake(T.x, T.w);
    const p = this._el.pika;
    p.classList.add('crouch');
    await this._wait(250);
    this._a2TrampFold(false);
    if (!calmMotion()) {
      this._puff(T.x - T.w * 0.42, this._g.gy, 1);
      this._puff(T.x + T.w * 0.42, this._g.gy, 1);
    }
    await this._wait(600);
    p.classList.remove('crouch');
    this._peep(T.x + T.w * 0.3, this._g.gy - S.mat - 6, 'klack!');
    await this._wait(400);
    return S;
  }

  // Hinauf (Hüpfer aufs Tuch, bzw. ruhig: hinaufsteigen) und herunter, auf die Seite, auf der er stand
  async _a2TrampOn() {
    const S = this._a2TrampS;
    if (!S) return;
    const p = this._el.pika;
    const { pH } = this._g;
    S.from = this._x;
    const calm = calmMotion();
    const ms = calm ? 700 : 560;
    if (!calm) {
      p.classList.add('crouch');
      await this._wait(180);
      p.classList.remove('crouch');
    }
    p.style.transition = `transform ${ms}ms ${calm ? 'ease-in-out' : 'linear'}`;
    this._setX(S.x);
    this._a2TrampCtl(true);
    S.mode = 'off';
    S.y = 0;
    this._a2TrampSay(true);
    if (!calm) this._earSwing?.(p, 'hop1');
    await this._a2TrampDrive(ms, (f) => {
      S.y = calm ? S.mat * smooth(f) : S.mat * f + pH * 0.3 * 4 * f * (1 - f);
    });
    S.mode = 'mat';
    S.air = 0;
    S.y = S.mat;
    S.hp = pH * 0.3;
    this._a2TrampPlace();
  }

  async _a2TrampOff() {
    const S = this._a2TrampS;
    if (!S) return;
    const p = this._el.pika;
    const { pW, pH, xR } = this._g;
    const calm = calmMotion();
    const ms = calm ? 700 : 520;
    const x = clamp(S.from ?? S.x - S.w / 2 - pW * 0.38, pW * 0.45, xR);
    S.mode = 'off';
    S.dip = 0;
    p.classList.remove('a2tr-sq', 'a2tr-up', 'a2tr-tuck');
    p.style.transition = `transform ${ms}ms ${calm ? 'ease-in-out' : 'linear'}`;
    this._setX(x);
    if (!calm) this._earSwing?.(p, 'hop1');
    await this._a2TrampDrive(ms, (f) => {
      S.y = calm ? S.mat * (1 - smooth(f)) : S.mat * (1 - f) + pH * 0.25 * 4 * f * (1 - f);
    });
    this._a2TrampCtl(false);
    this._setX(this._x, true);
    if (!calm) this._puff(this._x, this._g.gy, 2);
  }

  // Ein Sprung: erst ins Tuch (es gibt nach, um so mehr, je höher er herkam), dann hinauf auf h px über dem Tuch.
  // flip: Salto; gold: Sternchen oben
  async _a2TrampBounce(h, flip = false, gold = false) {
    const S = this._a2TrampS;
    if (!S) return;
    const p = this._el.pika;
    const D = TRAMP_DIP * clamp(0.35 + 0.65 * (Math.max(S.hp, h) / S.top), 0.3, 1);
    S.mode = 'mat';
    S.air = 0;
    p.classList.remove('a2tr-up', 'a2tr-tuck');
    p.classList.add('a2tr-sq');
    await this._a2TrampDrive(TRAMP_DOWN, (f) => {
      S.dip = D * Math.sin(Math.PI * f);
    });
    S.dip = 0;
    if (!(h > 0)) {
      p.classList.remove('a2tr-sq');
      return;
    }
    p.classList.remove('a2tr-sq');
    p.classList.add('a2tr-up');
    this._earSwing?.(p, 'hop1');
    const ms = Math.max(300, TRAMP_AIR * Math.sqrt(h / S.top));
    let top = false;
    await this._a2TrampDrive(ms, (f) => {
      S.air = 4 * h * f * (1 - f);
      if (f > 0.3) p.classList.remove('a2tr-up');
      if (flip) {
        S.rot = 360 * smooth(clamp((f - 0.12) / 0.74, 0, 1));
        p.classList.toggle('a2tr-tuck', f > 0.14 && f < 0.82);
      }
      if (!top && f >= 0.5) {
        top = true;
        if (gold) this._a2TrampStars(h);
      }
    });
    S.air = 0;
    S.rot = 0;
    S.hp = h;
    p.classList.remove('a2tr-up', 'a2tr-tuck');
  }

  // Springen mit Bewegung: hinauf, ein paarmal immer höher, oben (beim höchsten) Salto und Sternchen, ausfedern,
  // herunter
  async _a2TrampJump(flip, gold, o) {
    const S = this._a2TrampS;
    if (!S) return;
    await this._a2TrampOn();
    await this._a2TrampBounce(0);
    this._say(flip ? pick(['jetzt ein Salto!', 'aufgepasst!', 'Salto, los!']) : pick(['hüpf!', 'los geht\'s!', 'boing, boing!']), 1100);
    await this._wait(700);
    const ks = o.short ? [0.42, 0.72, 1] : [0.26, 0.46, 0.7, 1];
    // „boing!“ neben ihm am Rand des Tuchs (auf schmalen Karten ist er breiter als das Trampolin)
    const bx = (side) => S.x + side * Math.max(S.w * 0.46, this._g.pW * 0.56);
    this._peep(bx(1), this._g.gy - S.mat * 0.6, 'boing!');
    for (let i = 0; i < ks.length; i++) {
      const last = i === ks.length - 1;
      await this._a2TrampBounce(S.top * ks[i], flip && last, gold && last);
      if (last) this._peep(bx(-1), this._g.gy - S.mat * 0.6, 'boing!');
    }
    // ausfedern
    await this._a2TrampBounce(S.top * 0.28);
    await this._a2TrampBounce(S.top * 0.09);
    await this._a2TrampBounce(0);
    this._say(flip ? pick(['tadaa!', 'Salto!', 'geschafft!']) : pick(['juhuu!', 'so hoch!', 'hui!']), 1200);
    await this._wait(900);
    await this._a2TrampOff();
    this._happy(1100);
    await this._wait(800);
  }

  // Reduzierte Bewegung: hinaufsteigen, sanft wippen (das Tuch gibt ein wenig nach, er mit), golden blenden Sternchen
  // am Platz ein und aus; statt des Saltos ein Gedanke daran
  async _a2TrampCalm(flip, gold) {
    const S = this._a2TrampS;
    if (!S) return;
    await this._a2TrampOn();
    this._say(flip ? pick(['stell dir einen Salto vor!', 'Salto – in Gedanken!']) : pick(['wipp, wipp…', 'schön federnd!']), 1500);
    for (let i = 0; i < 4; i++) {
      await this._a2TrampDrive(900, (f) => {
        S.dip = 1.1 * Math.sin(Math.PI * f);
      });
      if (i === 1 && gold) this._a2TrampStars(0);
    }
    S.dip = 0;
    await this._wait(500);
    await this._a2TrampOff();
    this._happy(1000);
    await this._wait(800);
  }

  // Wegräumen: zusammenklappen (bzw. ausblenden), dann ist es weg
  async _a2TrampAway() {
    const S = this._a2TrampS;
    if (!S) return;
    const p = this._el.pika;
    this._face(S.x >= this._x ? 1 : -1);
    p.classList.add('crouch');
    await this._wait(250);
    this._a2TrampFold(true);
    await this._wait(520);
    p.classList.remove('crouch');
    if (calmMotion()) return;
    // zusammengeklappt liegt es noch kurz da, dann blendet es aus
    this._puff(S.x, this._g.gy, 2);
    await this._wait(250);
    for (const e of [S.el, S.front]) e.classList.add('a2out');
    await this._wait(420);
  }

  // Nach dem Auspacken (Hook): Bei Trampolinwetter gleich ein paar Sprünge (Stufe 1 springen, 2 Salto, 3 mit
  // Sternchen). Sonst nur zeigen: Es klappt neben ihm auf, er drückt mit den Pfoten aufs Tuch, es federt, er vertröstet.
  async _a2TrampStow(lv) {
    if (this._a2TrampWeather()) return lv === 2 ? this._a2TrampFlip({ short: true }) : this._a2TrampPlay({ short: true, gold: lv >= 3 });
    this._a2TrampBusy = true;
    const p = this._el.pika;
    try {
      const S = await this._a2TrampOut();
      if (lv >= 3) this._a2TrampStars(-1);
      this._say(lv >= 3 ? pick(['goldig!', 'das glänzt!']) : lv === 2 ? pick(['für den Salto!', 'damit geht ein Salto!']) : pick(['zum Hüpfen!', 'ein Trampolin!']), 1300);
      await this._wait(900);
      p.classList.add('crouch');
      this._a2TrampTap(null);
      await this._wait(500);
      p.classList.remove('crouch');
      p.classList.add('look-up');
      const sc = this._el.scene.classList;
      this._say(sc.contains('night') || sc.contains('dusk') ? pick(['morgen hüpf ich!', 'wenn\'s hell ist!']) : pick(['wenn\'s trocken ist!', 'bald hüpf ich!']), 1500);
      await this._wait(1600);
      p.classList.remove('look-up');
      this._happy(1000);
      await this._wait(700);
      if (S) await this._a2TrampAway();
    } finally {
      this._a2TrampBusy = false;
      this._a2TrampEnd(true);
    }
  }

  // ---------- Sternchen ----------

  // Goldene Sternchen um ihn, h px über dem Tuch (oben im Sprung; −1: um das Tuch, er steht daneben). Ruhig blenden sie
  // am Platz ein und aus (_goldFx). Sie räumen sich selbst weg; bricht die Aktion ab, gleich (S.F).
  _a2TrampStars(h) {
    const S = this._a2TrampS;
    if (!S) return;
    const { gy, pH, pW } = this._g;
    const H = this._H;
    const n = calmMotion() ? 3 : 6;
    const cy = h < 0 ? gy - S.mat - H * 0.04 : gy - S.mat - h - pH * (1 - TRAMP_PIVOT) * 0.95;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * (i + rnd(-0.2, 0.2))) / n - Math.PI / 2;
      // (am Rand seines Körpers, dann nach außen: über ihm verschwänden sie im Fell)
      const rx = (h < 0 ? S.w * 0.45 : pW * 0.5) * rnd(0.9, 1.1);
      const ry = (h < 0 ? H * 0.04 : pH * 0.48) * rnd(0.9, 1.1);
      const x = S.x + Math.cos(a) * rx;
      const y = Math.max(H * 0.03, cy + Math.sin(a) * ry);
      S.F.push(this._goldFx('a2trst', x, y, {
        html: GOLD_STAR, ms: 1150, delay: i * 45,
        vars: { '--dx': `${(Math.cos(a) * rx * 0.45).toFixed(1)}px`, '--dy': `${(Math.max(-y + H * 0.03, Math.sin(a) * ry * 0.45)).toFixed(1)}px` },
      }));
    }
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Der vordere Bogen liegt in einem eigenen Element (.a2-trampf): Seine Zeichnung gehört zur Tippfläche (seit 0.48.1)
  _a2TrampParts() {
    return [this._a2TrampS?.front];
  }

  // Tipp aufs Trampolin (nur, solange es draußen steht): Das Tuch federt nach, steht er darauf, wippt er mit
  _a2TrampTap(z) {
    const S = this._a2TrampS;
    if (!S) return false;
    const calm = calmMotion();
    S.spring = { t0: now(), amp: calm ? 1 : 2.6, calm };
    this._a2TrampPlace();
    this._a2TrampRun(); // (der Takt ruht, solange nichts federt)
    // (am Rand des Tuchs: Steht er darauf, verdeckte der Schriftzug in der Mitte ihn)
    const off = Math.max(S.w * 0.46, this._g.pW * 0.56);
    if (z) this._peep(S.x + (S.x + off < this._W - 30 ? off : -off), this._g.gy - S.mat * 0.6, pick(['boing!', 'federt!', 'bouing!']));
    return true;
  }

  // Ende der Aktion oder Abbruch (auch aus _cleanup nach jeder Aktion): Trampolin, Sternchen, Zeitgeber weg; stellte
  // er den Pika selbst, steht der wieder am Boden (_lift ist ohnehin 0; die Höhe in .depth gleitet kurz nach unten aus)
  // (force: aus der eigenen Aktion. Sonst, mitten in ihr, aus Szene oder Aufräumen: nichts, sie räumt in ihrem finally
  // selbst auf; nur nach einem Abbruch gleich)
  _a2TrampEnd(force = false) {
    const S = this._a2TrampS;
    if (!S) return;
    if (!force && this._a2TrampBusy && !this._ac?.signal?.aborted) return;
    this._a2TrampS = null;
    if (S.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(S.raf);
    for (const t of S.t) clearTimeout(t);
    this._goldDrop?.(S.F);
    const p = this._el.pika;
    if (S.ctl) {
      const d = this._el.depth;
      const cur = d.style.transform;
      this._a2TrampCtl(false);
      // (mitten im Sprung: kurz herunterfallen statt springen; der nächste Weg nimmt die Stelle, wo er steht)
      if (cur && !calmMotion()) d.animate?.([{ transform: cur, transformOrigin: `50% ${TRAMP_PIVOT * 100}%` }, { transform: 'none', transformOrigin: `50% ${TRAMP_PIVOT * 100}%` }], { duration: 220, easing: 'ease-in' });
      this._lift = 0;
      // (beim Hinauf- oder Heruntersteigen ist this._x schon das Ziel: dort bleiben, wo er gerade ist)
      this._setX(S.mode === 'off' && typeof getComputedStyle === 'function' ? this._liveX() : this._x, true);
    }
    p.classList.remove(...TRAMP_CLS);
    const el = S.el;
    const front = S.front;
    if (!S.folded && el.isConnected && !calmMotion() && this._a2Els?.get('tramp') === el) {
      el.classList.add('a2out');
      front.classList.add('a2out');
      setTimeout(() => {
        front.remove();
        if (!this._a2TrampS) this._a2Drop('tramp');
      }, 450);
    } else {
      front.remove();
      this._a2Drop('tramp');
    }
  }

  _a2TrampCleanup() {
    this._a2TrampEnd();
  }

  // Karte aus dem DOM: alles sofort weg
  _a2TrampDetach() {
    this._a2TrampBusy = false;
    const S = this._a2TrampS;
    this._a2TrampEnd(true);
    if (S) {
      S.front.remove();
      this._a2Drop('tramp');
    }
  }
}
