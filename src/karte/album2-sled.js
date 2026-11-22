// Album 2: der Schlitten (key 'sled', t2 = 2). Er steht nicht in der Szene; liegt Schnee, holt er ihn für seinen
// Moment aus dem Bau und räumt ihn danach wieder weg (wie die Hängematte). Rodeln geht vom Aussichtsstein: An dessen
// linker Flanke liegt dann eine Schneewehe (DRIFT_SVG, ein Requisit), der Stein selbst ist zu steil und oben schmaler
// als der Pika. Stufe 1: Er zieht den Schlitten am Seil die Wehe hinauf, dreht ihn oben um, setzt sich drauf und
// rodelt hinunter, Schnee stiebt; dann zieht er ihn zum Bau zurück. Stufe 2 (Trick): Bauchrutscher, bäuchlings mit dem
// Kopf voran, schneller und weiter, am Ende rutscht er noch vom Schlitten in den Schnee. Stufe 3 (Gold): eine Spur aus
// Schneefunken hinter dem Schlitten (bei jeder Fahrt; Rodeln ist selten genug, wie das Nickerchen der Hängematte).
// Ohne Schnee wählt er ihn nie (Gewicht 0), nur die Vorschau-Knöpfe (_forced) und das Vorführen nach dem Auspacken.
//
// Bewegung: Am Hang folgt der Pika der Oberfläche der Wehe, das kann keine CSS-Transition (sie fährt gerade Linien).
// Darum stellt ein Bild-für-Bild-Takt (requestAnimationFrame) dort Pika und Schlitten selbst (_a2SledPika), auf ebenem
// Boden läuft er wie immer mit _walkTo, und der Schlitten folgt am Seil seiner echten Nase (_a2SledTow). Ohne Takt
// (Tests, verborgene Karte) stimmt jeder Abschnitt an seinem Ende trotzdem: Er setzt das Ziel selbst.
// Reduzierte Bewegung: kein Hang, kein Umdrehen, kein Hüpfen; der Schlitten blendet neben ihm ein, er setzt sich
// (bzw. legt sich) hinein, freut sich, steht auf, der Schlitten blendet aus.

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import {
  SLED_SVG, SLED_W, SLED_HOOK, SLED_SEAT, SLED_SINK, ROPE_MOUTH, SEIL, DRIFT_TOP, DRIFT_U0, driftY, DRIFT_SVG, FUNKE_SVG,
} from '../grafik/album2/sled.js';

// Ebenen: der Schlitten unter dem Pika (Rang vogel, über den Requisiten), die Wehe am Stein (Reihe des Steins, davor)
const SLED_Z = () => buehneZ(REIHE.vorn, 'vogel');
const DRIFT_Z = () => buehneZ(REIHE.stein, 'schatz');
// Tempo am Fuß der Wehe in Pika-Breiten je Sekunde (Sitzen, Bauch); Seillänge in Pika-Breiten (vom Maul durch ihn
// hindurch bis zum Haken: So liegt der Schlitten gestreckt knapp hinter ihm)
const SLED_V = { sit: 2.1, belly: 2.6 };
const SLED_ROPE = 0.75;
// Pika-Klassen dieses Schatzes (_cleanup kennt sie nicht, das Aufräumen nimmt sie ab)
const SLED_CLS = ['a2sl-sit', 'a2sl-belly'];

export class Album2Sled {
  // ---------- Szene ----------

  // Szene (Hook): Er steht nie dauerhaft. Nur, solange er ihn benutzt (_a2SledS), bleibt das Element; sonst weg. Hat
  // sich die Größe der Karte geändert, stehen Schlitten und Seil an alten Pixeln: abbrechen (wie _layout bei Requisiten)
  _a2SledScene(lv) {
    const S = this._a2SledS;
    if (S && (S.W !== this._W || S.H !== this._H) && this._a2SledBusy) this._interrupt();
    else if (!S || !(lv > 0)) this._a2SledEnd();
  }

  // Maße des Schlittens (px): Breite, Höhe, Sitzhöhe über dem Schnee (um die Kufendicke tiefer: Er sitzt im Schlitten,
  // nicht obenauf)
  _a2SledDim() {
    const w = this._g.pW * SLED_W;
    const h = (w * 22) / 48;
    return { w, h, seat: h * (SLED_SEAT - SLED_SINK) };
  }

  // Schlitten anlegen (Element aus _a2El: Tippfläche, Licht, golden) bei x, Spitze nach fdir. pop: ploppt auf
  _a2SledMake(x, fdir, pop = true) {
    const old = this._a2SledS;
    if (old) this._a2SledEnd(true);
    const { w, h } = this._a2SledDim();
    const el = this._a2El('sled', `<div class="a2slw"><div class="a2slf">${SLED_SVG}</div></div>`);
    el.classList.remove('a2out');
    el.style.width = `${w.toFixed(1)}px`;
    el.style.height = `${h.toFixed(1)}px`;
    el.style.bottom = `calc(var(--gb) - ${(h * SLED_SINK).toFixed(1)}px)`;
    el.style.zIndex = String(SLED_Z());
    const rope = document.createElement('div');
    rope.className = 'a2slrope';
    rope.style.zIndex = String(SLED_Z());
    rope.style.background = SEIL;
    rope.hidden = true;
    this._el.gifts.appendChild(rope);
    const S = { W: this._W, H: this._H, el, rope, x, fdir: 0, ang: 0, ride: false, tow: false, line: false, drive: null, ctl: false, u0: DRIFT_U0, drift: null, raf: 0, fx: new Set(), t: [] };
    this._a2SledS = S;
    this._a2SledFace(fdir, true);
    this._a2Scene(); // (golden: .gilt)
    if (pop && !calmMotion()) {
      const w = el.querySelector('.a2slw');
      w?.classList.add('pop');
      S.t.push(setTimeout(() => w?.classList.remove('pop'), 800));
    } else if (el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
    this._a2SledPlace();
    this._a2SledRun();
    return S;
  }

  // Spitze nach dir (1 rechts, −1 links). Umdrehen dreht ihn sichtbar (außer instant und bei reduzierter Bewegung)
  _a2SledFace(dir, instant = false) {
    const S = this._a2SledS;
    if (!S || S.fdir === dir) return;
    S.fdir = dir;
    const f = S.el.querySelector('.a2slf');
    if (!f) return;
    f.style.transition = instant || calmMotion() ? 'none' : '';
    f.classList.toggle('left', dir < 0);
  }

  // Schneewehe am Stein (Requisit: Ändert sich die Größe der Karte, bricht _layout die Aktion ab). Ihr Fuß liegt auf
  // breiten Karten bei DRIFT_U0, auf schmalen näher am Stein, aber nie weniger als 0,6 Pika-Breiten rechts vom Vorrat.
  _a2SledDrift() {
    const S = this._a2SledS;
    if (!S || S.drift) return;
    const { rock } = this._g;
    const ku = rock.ku;
    const u0 = this._a2SledU0();
    S.u0 = u0;
    const w = (40 - u0) * ku;
    S.drift = this._aprop('a2sl-drift', DRIFT_SVG(u0), rock.l + (u0 - 2) * ku + w / 2, w, 36 * ku, false, ku);
    S.drift.style.zIndex = String(DRIFT_Z());
  }

  // Fuß der Wehe in Einheiten des Steins (negativ, links von ihm), auch bevor sie liegt
  _a2SledU0() {
    const { rock, hayR, pW } = this._g;
    return Math.min(-20, (Math.max(rock.l + DRIFT_U0 * rock.ku, hayR + pW * 0.6) - rock.l) / rock.ku);
  }

  // Fuß der Wehe (px)
  _a2SledFoot() {
    const { rock } = this._g;
    return rock.l + (this._a2SledS?.drift ? this._a2SledS.u0 : this._a2SledU0()) * rock.ku;
  }

  // Höhe des Schnees über der Bodenlinie bei x (px): Wehe, oben der Stein, sonst 0. Ohne Wehe ist alles eben.
  _a2SledH(x) {
    const S = this._a2SledS;
    if (!S?.drift) return 0;
    const { rock } = this._g;
    const u = (x - rock.l) / rock.ku;
    if (u > 80) return 0;
    return Math.max(0, (46 - driftY(u, S.u0)) * rock.ku);
  }

  // Neigung der Oberfläche bei x in Grad (CSS: negativ = links tiefer)
  _a2SledAng(x) {
    const d = 2;
    return (-Math.atan2(this._a2SledH(x + d) - this._a2SledH(x - d), 2 * d) * 180) / Math.PI;
  }

  // Pika selbst stellen (statt _setX): bei x in der Höhe lift, Neigung ang (für das Sitzen auf dem Schlitten). Auf dem
  // Stein steht er um 0,9 verkleinert (weiter hinten, wie _setX); dazwischen gleitet die Größe mit der Höhe, sonst
  // schnappte er am Fuß der Wehe um 10 % größer.
  _a2SledPika(x, lift, ang = 0) {
    const p = this._el.pika;
    const { pW, rock } = this._g;
    this._x = x;
    this._lift = lift;
    this._lane = 0;
    const s = 1 - 0.1 * clamp(lift / rock.lift, 0, 1);
    const tr = `translate(${(x - pW / 2).toFixed(1)}px, ${(-lift).toFixed(1)}px)${s !== 1 ? ` scale(${s.toFixed(3)})` : ''}`;
    p.style.transition = 'none';
    p.style.transform = tr;
    const t = this._el.psay.style;
    t.transition = 'none';
    t.transform = tr;
    p.style.setProperty('--a2sla', `${ang.toFixed(1)}deg`);
    if (this._a2SledS) this._a2SledS.ang = ang;
  }

  // Wieder normal stellen (_setX), auf dem Boden oder, falls er noch oben ist, dort (dann hüpft _step herunter)
  _a2SledLand() {
    const S = this._a2SledS;
    if (S) S.ctl = false;
    if (!(this._lift > 1)) this._lift = 0;
    this._setX(this._x, true);
    this._el.pika.style.removeProperty('--a2sla');
  }

  // ---------- Takt ----------

  // Bild für Bild: laufender Abschnitt (drive), Seil ziehen, Schlitten und Seil stellen
  _a2SledRun() {
    const S = this._a2SledS;
    if (!S || S.raf || typeof requestAnimationFrame !== 'function') return;
    const frame = (now) => {
      if (this._a2SledS !== S) return;
      S.raf = 0;
      try {
        if (S.drive) S.drive.step(clamp((now - S.drive.t0) / S.drive.ms, 0, 1));
        if (S.tow) this._a2SledTow();
        this._a2SledPlace();
      } catch (e) {
        this._err?.('Album 2 sled', e);
        return;
      }
      S.raf = requestAnimationFrame(frame);
    };
    S.raf = requestAnimationFrame(frame);
  }

  // Ein Abschnitt von ms Dauer: step(f) mit f von 0 bis 1 stellt alles; am Ende gilt step(1) sicher
  async _a2SledDrive(ms, step) {
    const S = this._a2SledS;
    if (!S) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    S.drive = { t0, ms, step };
    step(0);
    try {
      await this._wait(ms);
    } finally {
      if (S.drive?.step === step) S.drive = null;
    }
    step(1);
    this._a2SledPlace();
  }

  // Das Seil zieht: Wird es länger als SLED_ROPE, rutscht der Schlitten nach (nur gezogen, nie geschoben)
  _a2SledTow() {
    const S = this._a2SledS;
    if (!S) return;
    const N = this._a2SledMouth();
    const hx = this._a2SledHook().x;
    const L = this._g.pW * SLED_ROPE;
    const dx = N.x - hx;
    if (Math.abs(dx) > L) S.x += dx - Math.sign(dx) * L;
  }

  // Wo das Seil im Maul steckt (Szene-Pixel): etwas unter der Nasenspitze
  _a2SledMouth() {
    const n = this._nosePos();
    return { x: n.x - this._dir * this._g.pW * 0.02, y: n.y + this._g.pH * 0.06 };
  }

  // Stand des Schlittens: unter ihm, wenn er drauf ist, sonst wo er liegt (auf dem Schnee)
  _a2SledAt() {
    const S = this._a2SledS;
    if (S.ride) return { x: this._x, lift: this._lift, ang: S.ang };
    return { x: S.x, lift: this._a2SledH(S.x), ang: this._a2SledAng(S.x) };
  }

  // Haken vorn an der Spitze (Szene-Pixel)
  _a2SledHook() {
    const S = this._a2SledS;
    const { w, h } = this._a2SledDim();
    const A = this._a2SledAt();
    const s = 1 - 0.1 * clamp(A.lift / this._g.rock.lift, 0, 1);
    const lx = (SLED_HOOK[0] - 0.5) * w * S.fdir * s;
    const ly = -(1 - SLED_HOOK[1] - SLED_SINK) * h * s;
    const r = (A.ang * Math.PI) / 180;
    return { x: A.x + lx * Math.cos(r) - ly * Math.sin(r), y: this._g.gy - A.lift + lx * Math.sin(r) + ly * Math.cos(r) };
  }

  _a2SledPlace() {
    const S = this._a2SledS;
    if (!S) return;
    const { w } = this._a2SledDim();
    const A = this._a2SledAt();
    const s = 1 - 0.1 * clamp(A.lift / this._g.rock.lift, 0, 1);
    S.el.style.left = '0px';
    S.el.style.transform = `translate(${(A.x - w / 2).toFixed(1)}px, ${(-A.lift).toFixed(1)}px) rotate(${A.ang.toFixed(1)}deg)${s !== 1 ? ` scale(${s.toFixed(3)})` : ''}`;
    S.rope.hidden = !S.line;
    if (!S.line) return;
    const H = this._a2SledHook();
    const N = this._a2SledMouth();
    const dx = N.x - H.x;
    const dy = N.y - H.y;
    S.rope.style.left = `${H.x.toFixed(1)}px`;
    S.rope.style.top = `${H.y.toFixed(1)}px`;
    S.rope.style.width = `${Math.hypot(dx, dy).toFixed(1)}px`;
    S.rope.style.transform = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
  }

  // Seil ins Maul (an) oder loslassen
  _a2SledHold(on) {
    const S = this._a2SledS;
    const p = this._el.pika;
    if (S) S.tow = S.line = on;
    p.classList.toggle('carry', on);
    this._mouth(on ? SEIL : null, on ? ROPE_MOUTH : null);
    this._a2SledPlace();
  }

  // ---------- Was er damit tut ----------

  // Rodelwetter: Schnee liegt, kein Regen darauf (wie bei Schneeengel und Schneeball, miniProg), kein Sturm, nicht
  // nachts, kein starker Wind
  _a2SledWeather(wx = this._wx || {}) {
    return !!wx.snowcover && !wx.wet && !wx.storm && !wx.shelter && !this._el.scene.classList.contains('night') && (this._wind || 0) < 40;
  }

  // Hook: nur bei Rodelwetter; in der Dämmerung selten
  _a2SledActs({ wx }, lv) {
    if (!this._a2SledWeather(wx)) return [];
    const w = 0.5 * (this._el.scene.classList.contains('dusk') ? 0.4 : 1);
    return [[w, 'a2SledPlay'], [lv >= 2 ? w * 0.7 : 0, 'a2SledBelly']];
  }

  // Stufe 1 (Aktion 'a2SledPlay'). o: { short: nach dem Auspacken (der Schlitten kommt gleich neben ihm, kein
  // Zurückziehen), gold: Schneefunken sicher }
  async _a2SledPlay(o = {}) {
    return this._a2SledGo('sit', o);
  }

  // Stufe 2, der Trick (Aktion 'a2SledBelly')
  async _a2SledBelly(o = {}) {
    if (this._a2Lv('sled') < 2) return;
    return this._a2SledGo('belly', o);
  }

  async _a2SledGo(mode, o) {
    const lv = this._a2Lv('sled');
    if (!lv || (!this._a2SledWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('sled'));
    this._a2SledBusy = true;
    try {
      if (calmMotion()) await this._a2SledCalm(mode, gold, o);
      else await this._a2SledRide(mode, gold, o);
    } finally {
      this._a2SledBusy = false;
      this._a2SledEnd(true);
    }
  }

  // Holen: zum Bau, der Schlitten ploppt vor dem Eingang auf, Seil ins Maul. short: gleich neben ihm, erst links vor
  // die Wehe (er zieht ihn nach rechts hinauf), mit Platz für den Schlitten links von ihm
  async _a2SledFetch(short) {
    const { hole, pW } = this._g;
    if (short) {
      const x = Math.max(Math.min(this._x, this._a2SledFoot() - pW * 0.5), pW * 1.55);
      if (Math.abs(x - this._x) > 4) await this._walkTo(x, 1.1);
      this._a2SledMake(this._x - pW * 0.73, 1);
      this._a2SledDrift();
      this._face(-1);
      this._say(pick(['schnell!', 'auf geht\'s!', 'Schlitten!']), 1100);
      await this._wait(700);
      this._face(1);
    } else {
      await this._walkTo(hole.cx + pW * 0.75, 1.1);
      this._face(-1);
      this._say(pick(['Schlitten holen!', 'wo ist er…', 'Schnee! Schlitten!']), 1300);
      await this._wait(600);
      this._a2SledMake(hole.cx + pW * 0.05, 1);
      this._a2SledDrift(); // (schon jetzt: Ein Requisit am Boden lässt _layout bei einer Größenänderung abbrechen)
      await this._wait(800);
      this._face(1);
    }
    this._el.pika.classList.add('crouch');
    await this._wait(260);
    this._el.pika.classList.remove('crouch');
    this._a2SledHold(true);
    await this._wait(200);
  }

  // Spiel und Trick mit Bewegung: holen, zur Wehe ziehen, hinauf, umdrehen, drauf, rodeln, zurück
  async _a2SledRide(mode, gold, o) {
    const p = this._el.pika;
    const { pW, rock, hayR } = this._g;
    const H = this._H;
    await this._a2SledFetch(!!o.short);
    const S = this._a2SledS;
    this._a2SledDrift();
    const foot = this._a2SledFoot();
    // ziehen bis an den Fuß der Wehe (kommt er von rechts, erst um sie herum nach links)
    if (this._x > foot) {
      await this._walkTo(Math.max(hayR + pW * 0.3, foot - pW * 0.5), 1);
      this._face(1);
    }
    await this._walkTo(foot, 0.9);
    // sitzt ein Vögelchen auf dem Stein, fliegt es vorher weg
    if (this._bird?.perch === 'rock') {
      this._bird.scare();
      await this._wait(600);
    }
    // hinauf: Er stapft die Wehe hoch, der Schlitten rutscht am Seil hinterher
    const top = rock.cx + rock.ku * 4;
    const x0 = this._x;
    S.ctl = true;
    p.classList.add('walking', 'trip');
    this._say(pick(['hau ruck!', 'hinauf!', 'uff…']), 1200);
    await this._a2SledDrive(Math.abs(top - x0) / (pW * 0.5) * 1000, (f) => {
      const x = x0 + (top - x0) * f;
      this._a2SledPika(x, this._a2SledH(x));
    });
    p.classList.remove('walking', 'trip');
    await this._wait(400);
    // oben: umdrehen und den Schlitten am Seil bis an die Kante heraufholen (dort beginnt die Fahrt), Seil los, den
    // Schlitten umdrehen (Spitze talwärts)
    this._face(-1);
    await this._wait(250);
    const sx = rock.l + (DRIFT_TOP - 6) * rock.ku;
    const s0 = S.x;
    S.tow = false; // (das Seil bleibt zu sehen, zieht aber nicht: Am Ende liegt der Schlitten näher als die Seillänge)
    p.classList.add('crouch');
    await this._a2SledDrive(650, (f) => {
      S.x = s0 + (sx - s0) * (1 - (1 - f) ** 2);
    });
    p.classList.remove('crouch');
    this._a2SledHold(false);
    await this._wait(250);
    p.classList.add('crouch');
    this._a2SledFace(-1);
    await this._wait(420);
    p.classList.remove('crouch');
    this._say(mode === 'belly' ? pick(['Bauch voraus!', 'jetzt bäuchlings!', 'Kopf voran!']) : pick(['eins, zwei…', 'festhalten!', 'achtung…']), 1200);
    await this._wait(500);
    // drauf: kleiner Hüpfer auf den Schlitten
    const xa = this._x;
    const la = this._lift;
    this._jump('hop1', true);
    await this._a2SledDrive(420, (f) => {
      const x = xa + (sx - xa) * f;
      this._a2SledPika(x, la + (this._a2SledH(sx) - la) * f, this._a2SledAng(sx) * f);
    });
    const { seat } = this._a2SledDim();
    p.style.setProperty('--a2sly', `${(seat * (mode === 'belly' ? 0.7 : 1)).toFixed(1)}px`);
    p.classList.add(mode === 'belly' ? 'a2sl-belly' : 'a2sl-sit');
    S.ride = true;
    await this._wait(mode === 'belly' ? 500 : 350);
    // rodeln: bis zum Fuß gleichmäßig schneller, danach gleichmäßig langsamer bis zum Halt
    const far = mode === 'belly' ? 1.9 : 1.5;
    const xEnd = Math.min(foot - pW * 0.3, Math.max(foot - pW * far, hayR + pW * 0.25, pW * 0.5));
    const v1 = pW * SLED_V[mode] / 1000;
    const L1 = Math.max(1, sx - foot);
    const L2 = Math.max(1, foot - xEnd);
    const tA = (2 * L1) / v1;
    const tB = (2 * L2) / v1;
    const at = (t) => (t < tA ? sx - (v1 / tA) * t * t / 2 : foot - (v1 * (t - tA) - (v1 / tB) * (t - tA) ** 2 / 2));
    const speed = (t) => (t < tA ? (v1 * t) / tA : v1 * (1 - (t - tA) / tB));
    this._say(mode === 'belly' ? pick(['wuiii!', 'juhuuu!', 'schneller!']) : pick(['juhuu!', 'wiii!', 'hui!']), 1400);
    p.classList.add('happy');
    let tick = 0;
    await this._a2SledDrive(tA + tB, (f) => {
      const t = f * (tA + tB);
      const x = f >= 1 ? xEnd : at(t);
      this._a2SledPika(x, this._a2SledH(x), this._a2SledAng(x));
      // Schnee stiebt hinter dem Schlitten, golden zieht er eine Spur aus Funken
      const n = Math.floor(t / 70);
      if (n > tick && f < 1) {
        tick = n;
        const v = speed(t) / v1;
        const rx = x + pW * SLED_W * 0.42;
        const ry = this._g.gy - this._a2SledH(rx);
        if (v > 0.35 && n % 2) this._a2SledSpray(rx, ry, 1, v);
        if (gold && v > 0.12) this._a2SledSpark(rx, ry - H * 0.02);
      }
    });
    S.ride = false;
    S.x = xEnd;
    this._a2SledSpray(xEnd - pW * 0.3, this._g.gy, 4, 1);
    p.classList.remove('happy', 'a2sl-sit', 'a2sl-belly');
    if (mode === 'belly') {
      // vom Schlitten weiter in den Schnee: plumps, dann aufrappeln und abschütteln
      const xb = Math.max(pW * 0.45, xEnd - pW * 0.45);
      p.classList.add('lying');
      await this._a2SledDrive(450, (f) => this._a2SledPika(xEnd + (xb - xEnd) * (1 - (1 - f) ** 2), 0));
      this._a2SledSpray(xb - pW * 0.25, this._g.gy, 4, 1);
      this._say(pick(['plumps!', 'pfff!', 'Schnee im Gesicht!']), 1100);
      await this._wait(900);
      p.classList.remove('lying');
      this._a2SledLand();
      this._jump('hop1');
      this._say(pick(['brrr!', 'hihi!', 'nochmal!']), 1100);
    } else {
      this._a2SledLand();
      await this._wait(300);
      // absteigen nach vorn (links)
      const xs = Math.max(pW * 0.45, this._x - pW * 0.5);
      await this._hopTo(xs, 0, false);
      this._say(pick(['nochmal!', 'juhu!', 'so schnell!']), 1100);
    }
    this._a2SledLand();
    this._happy(1200);
    if (gold) this._sparkle(S.x, this._g.gy - H * 0.12, 2);
    await this._wait(1300);
    if (o.short) return;
    // zurück zum Bau ziehen (der Schlitten liegt rechts von ihm, die Spitze zu ihm)
    this._face(1);
    await this._wait(300);
    this._face(-1);
    this._a2SledHold(true);
    this._apropsAway(S.drift);
    S.drift = null;
    await this._walkTo(this._g.hole.cx + pW * 0.9, 0.9);
    await this._wait(300);
  }

  // Reduzierte Bewegung: neben ihm blendet er ein, er setzt bzw. legt sich hinein, freut sich, steht auf
  async _a2SledCalm(mode, gold, o) {
    const p = this._el.pika;
    const { pW, rock, hayR, xR } = this._g;
    if (!o.short) await this._walkTo(clamp(rock.l - pW * 0.7, hayR + pW * 0.5, xR), 0.9);
    const S = this._a2SledMake(this._x, -1, false);
    S.ride = true;
    this._face(-1);
    await this._wait(600);
    const { seat } = this._a2SledDim();
    p.style.setProperty('--a2sly', `${(seat * (mode === 'belly' ? 0.7 : 1)).toFixed(1)}px`);
    p.style.setProperty('--a2sla', '0deg');
    p.classList.add(mode === 'belly' ? 'a2sl-belly' : 'a2sl-sit');
    if (mode === 'belly') p.classList.add('lying');
    this._say(mode === 'belly' ? pick(['Bauchrutscher!', 'bäuchlings!']) : pick(['juhuu!', 'Schlitten!']), 1300);
    if (gold) for (let i = 0; i < 3; i++) this._a2SledSpark(this._x + (i - 1) * pW * 0.25, this._g.gy - this._H * 0.06);
    p.classList.add('happy');
    await this._wait(2200);
    p.classList.remove('happy', 'lying', ...SLED_CLS);
    S.ride = false;
    S.x = this._x;
    await this._wait(400);
    this._happy(1000);
    await this._wait(900);
  }

  // Nach dem Auspacken (Hook): Bei Rodelwetter gleich eine kurze Fahrt (Stufe 1 rodeln, 2 Bauchrutscher, 3 mit Funken).
  // Sonst nur zeigen: Der Schlitten kommt neben ihn, er setzt sich kurz hinein, schaut sich um und vertröstet.
  async _a2SledStow(lv) {
    if (this._a2SledWeather()) return lv === 2 ? this._a2SledBelly({ short: true }) : this._a2SledPlay({ short: true, gold: lv >= 3 });
    this._a2SledBusy = true;
    const p = this._el.pika;
    try {
      const { pW, hole } = this._g;
      const d = this._x - pW * 0.9 > hole.r ? -1 : 1;
      const S = this._a2SledMake(this._x + d * pW * 0.73, -d, !calmMotion());
      this._face(d);
      this._say(lv >= 3 ? pick(['goldig!', 'der glänzt!']) : pick(['zum Rodeln!', 'für den Winter!']), 1300);
      await this._wait(1000);
      if (calmMotion()) {
        S.x = this._x;
      } else {
        await this._hopTo(S.x, 0, false);
      }
      S.ride = true;
      this._face(-d);
      const { seat } = this._a2SledDim();
      p.style.setProperty('--a2sly', `${(seat * (lv === 2 ? 0.7 : 1)).toFixed(1)}px`);
      p.style.setProperty('--a2sla', '0deg');
      p.classList.add(lv === 2 ? 'a2sl-belly' : 'a2sl-sit');
      if (lv === 2) p.classList.add('lying');
      if (lv >= 3) for (let i = 0; i < 3; i++) S.t.push(setTimeout(() => this._a2SledS === S && this._a2SledSpark(this._x + rnd(-0.3, 0.3) * pW, this._g.gy - this._H * rnd(0.03, 0.09)), i * 300));
      await this._wait(900);
      p.classList.add('look-up');
      // Liegt doch Schnee (nur nicht zum Rodeln: nachts, Regen darauf, Sturm), wartet er nicht auf Schnee
      const snow = !!this._wx?.snowcover;
      this._say(lv === 2 ? pick(['so geht der Bauchrutscher!', 'bäuchlings!'])
        : snow ? pick(['heute nicht mehr…', 'gleich morgen!']) : pick(['kein Schnee…', 'wo bleibt der Schnee?']), 1500);
      await this._wait(1700);
      p.classList.remove('look-up', 'lying', ...SLED_CLS);
      S.ride = false;
      this._say(snow ? pick(['bald!', 'im Schnee!']) : pick(['wenn\'s schneit!', 'bald!', 'im Schnee!']), 1300);
      this._happy(1000);
      await this._wait(1400);
    } finally {
      this._a2SledBusy = false;
      this._a2SledEnd(true);
    }
  }

  // ---------- Schnee und Funken ----------

  // Schnee stiebt bei x, y (Szene-Pixel): n Flöckchen, v: wie schnell er gerade ist (0–1). Bewegung reduzieren: keine.
  _a2SledSpray(x, y, n, v = 1) {
    const S = this._a2SledS;
    if (calmMotion() || !S) return;
    const H = this._H;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'puff snowy a2slsp';
      const side = n > 1 ? (i % 2 ? 1 : -1) : 1;
      el.style.left = `${(x + side * rnd(0, H * 0.03)).toFixed(1)}px`;
      el.style.top = `${(y - H * 0.03).toFixed(1)}px`;
      el.style.setProperty('--px', `${(side * H * (0.03 + v * 0.05) * rnd(0.6, 1)).toFixed(1)}px`);
      this._el.fx.appendChild(el);
      S.fx.add(el);
      S.t.push(setTimeout(() => (el.remove(), S.fx.delete(el)), 650));
    }
  }

  // Ein Schneefunke der goldenen Spur: blitzt auf und verglimmt an seiner Stelle
  _a2SledSpark(x, y) {
    const S = this._a2SledS;
    if (!S) return;
    const el = document.createElement('span');
    el.className = `a2sls${calmMotion() ? ' still' : ''}`;
    el.innerHTML = FUNKE_SVG;
    el.style.left = `${(x + rnd(-3, 3)).toFixed(1)}px`;
    el.style.top = `${(y + rnd(-3, 3)).toFixed(1)}px`;
    el.style.setProperty('--sk', rnd(0.6, 1.1).toFixed(2));
    this._el.fx.appendChild(el);
    S.fx.add(el);
    S.t.push(setTimeout(() => (el.remove(), S.fx.delete(el)), 1300));
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Tipp auf den Schlitten (nur, solange er draußen ist): Er wackelt, Schnee stiebt auf
  _a2SledTap(z) {
    const S = this._a2SledS;
    if (!S) return false;
    const w = S.el.querySelector('.a2slw');
    if (w && !calmMotion()) {
      w.classList.remove('a2tap');
      void w.offsetWidth;
      w.classList.add('a2tap');
      clearTimeout(this._a2SledTapT);
      this._a2SledTapT = setTimeout(() => w.classList.remove('a2tap'), 700);
    }
    const A = this._a2SledAt();
    this._a2SledSpray(A.x, this._g.gy - A.lift, 3, 0.6);
    this._peep(A.x, this._g.gy - A.lift - this._a2SledDim().h * 1.2, pick(['rutsch!', 'klonk!', 'schlitt!']));
    return true;
  }

  // Ende der Aktion oder Abbruch (auch aus _cleanup nach jeder Aktion): Schlitten, Seil, Wehe, Teilchen, Zeitgeber
  // weg; stellte er den Pika selbst, steht der wieder normal (auf dem Boden oder oben, dann hüpft _step herunter)
  // (force: aus der eigenen Aktion. Sonst, mitten in ihr, aus Szene oder Aufräumen: nichts, sie räumt in ihrem finally
  // selbst auf; nur nach einem Abbruch gleich)
  _a2SledEnd(force = false) {
    const S = this._a2SledS;
    if (!S) return;
    if (!force && this._a2SledBusy && !this._ac?.signal?.aborted) return;
    this._a2SledS = null;
    if (S.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(S.raf);
    for (const t of S.t) clearTimeout(t);
    for (const el of S.fx) el.remove();
    S.rope.remove();
    const p = this._el.pika;
    p.classList.remove(...SLED_CLS);
    p.style.removeProperty('--a2sly');
    if (S.line) {
      p.classList.remove('carry');
      this._mouth(null);
    }
    if (S.ctl) {
      this._a2SledS = S; // (für _a2SledLand)
      this._a2SledLand();
      this._a2SledS = null;
    }
    p.style.removeProperty('--a2sla');
    if (S.drift) this._apropsAway(S.drift);
    const el = S.el;
    if (el.isConnected && !calmMotion() && this._a2Els?.get('sled') === el) {
      el.classList.add('a2out');
      setTimeout(() => !this._a2SledS && this._a2Drop('sled'), 450);
    } else this._a2Drop('sled');
  }

  _a2SledCleanup() {
    this._a2SledEnd();
  }

  // Karte aus dem DOM: alles sofort weg
  _a2SledDetach() {
    clearTimeout(this._a2SledTapT);
    this._a2SledBusy = false;
    const S = this._a2SledS;
    this._a2SledEnd(true);
    if (S) this._a2Drop('sled');
  }
}
