// Album 2: die Kamera (key 'camera', t2 = 3), eine Sofortbildkamera auf einem kleinen Stativ. Sie steht nicht in der
// Szene: Für ihren Moment holt er sie am Riemen aus dem Bau, stellt sie auf und räumt sie danach wieder weg (wie den
// Schlitten). Stufe 1: Er fotografiert, was es gerade gibt (den Vogel vom Besuch, eine Blume, sonst den Himmel mit
// Sonne, Wolken, Mond oder Regenbogen), es blitzt, oben schiebt sich ein Sofortbild heraus, er nimmt es in die Pfoten,
// dreht sich um und schaut zu, wie es sich entwickelt: eine winzige Zeichnung des Motivs. Stufe 2 (Trick): Selfie mit
// Selbstauslöser. Er drückt den Knopf, das Lämpchen blinkt, er hoppelt vor die Linse; ist der Freund (Kirby, Rufus,
// Katzumi oder Pino) gerade da, kommt er mit aufs Bild, und danach schauen beide es an. Stufe 3 (Gold): goldener Rahmen,
// und das Bild glitzert (mit Abstand und Würfel wie GOLD, nur auf diesem Gerät; nach dem Auspacken sicher).
// Nur bei Tag (in der Dämmerung selten), nicht bei starkem Regen, Gewitter und Sturm, nicht bei starkem Wind (das
// Stativ); bei normalem Regen hält er sein Blatt als Schirm, solange er nichts in den Pfoten hat. Tipp auf die
// Kamera, solange sie steht: Sie blitzt.
// Blitz: ein einzelner weicher Lichtpuls am Blitzfenster und ein schwacher über der Szene, höchstens alle FLASH_GAP
// (auch beim schnellen Antippen kein Flackern). Bewegung reduzieren: kein Lichtpuls, nur das Blitzfenster leuchtet
// langsam auf; die Kamera blendet neben ihm ein (kein Holen, kein Aufploppen), sie neigt sich ohne Schwenk, das Bild
// schiebt sich nicht heraus, es blendet in seinen Pfoten ein; das Lämpchen des Selbstauslösers leuchtet still.

import { pick, clamp, weighted } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import { FRIENDS, FRIEND_LAST } from '../logik/besucher.js';
import { BIRDS } from '../grafik/besucher.js';
import { CAMERA_SVG, CAMERA_MOUTH, CAM, CAM_W, PHOTO_SVG, PHOTO_SLOT, PHOTO_HELD } from '../grafik/album2/camera.js';

// Ebenen: die Kamera hinter dem Pika (seine Nase reicht an den Sucher), das Bild im Schlitz dahinter (es schiebt sich
// aus dem Gehäuse), in seinen Pfoten vor ihm (Rang des Plüsch-Pinos im Arm)
const CAM_Z = () => buehneZ(REIHE.vorn, 'vogel');
const PHOTO_Z = () => buehneZ(REIHE.vorn, 'requisit');
const HELD_Z = () => buehneZ(REIHE.vorn, 'arm');
// Goldener Rahmen: höchstens alle 2 Minuten, dann bei 3 von 5 Bildern
const CAMERA_GOLD = { cd: 2 * 6e4, p: 0.6 };
// Abstand zwischen zwei Lichtpulsen (ms)
const FLASH_GAP = 1200;
// So weit sinkt das Stativ ins Gras (px, wie bottom im Stil)
const CAM_SINK = 2;
// Farbe am Riemen (für _mouth)
const CAM_FARBE = '#6fb6c8';
// Pika-Klassen dieses Schatzes (_cleanup kennt sie nicht, das Aufräumen nimmt sie ab)
const CAMERA_CLS = ['a2cm-hold', 'a2cm-carry'];

export class Album2Camera {
  // ---------- Szene ----------

  // Szene (Hook): Sie steht nie dauerhaft. Nur, solange er sie benutzt, bleibt das Element. Hat sich die Größe der
  // Karte geändert, stehen Kamera und Bild an alten Pixeln: abbrechen (wie _layout bei Requisiten)
  _a2CameraScene(lv) {
    const S = this._a2CameraS;
    if (!S) return;
    if ((S.W !== this._W || S.H !== this._H) && this._a2CameraBusy) this._interrupt();
    else if (!(lv > 0) || !this._a2CameraBusy) this._a2CameraEnd();
  }

  // Breite der Kamera (px) und Maßstab der viewBox (px je Einheit)
  _a2CameraDim() {
    const w = this._g.pW * CAM_W;
    return { w, k: w / 40 };
  }

  // Punkt (lx, ly) der viewBox der Kamera in Szene-Pixeln, mit Neigung des Kopfs und Spiegelung (S: der Zustand)
  _a2CameraPt(lx, ly, S = this._a2CameraS) {
    const { k } = this._a2CameraDim();
    const [px, py] = CAM.pivot;
    const a = ((S?.tilt || 0) * Math.PI) / 180;
    const dx = lx - px;
    const dy = ly - py;
    const rx = px + dx * Math.cos(a) - dy * Math.sin(a);
    const ry = py + dx * Math.sin(a) + dy * Math.cos(a);
    return { x: (S?.x ?? this._x) + (S?.d ?? 1) * (rx - 20) * k, y: this._g.gy + CAM_SINK - (40 - ry) * k };
  }

  // Kamera aufstellen (Element aus _a2El: Tippfläche, Licht, golden): Mitte x, Linse nach d. pop: ploppt auf
  _a2CameraMake(x, d, pop = true) {
    if (this._a2CameraS) this._a2CameraEnd(true);
    const { w } = this._a2CameraDim();
    const el = this._a2El('camera', `<div class="a2cmw"><div class="a2cmf">${CAMERA_SVG}</div></div>`);
    el.classList.remove('a2out', 'glow', 'snap', 'timer');
    el.classList.toggle('a2left', d < 0);
    el.classList.toggle('still', calmMotion());
    el.style.left = `${(x - w / 2).toFixed(1)}px`;
    el.style.width = `${w.toFixed(1)}px`;
    el.style.zIndex = String(CAM_Z());
    el.style.setProperty('--a2cmt', '0deg');
    const S = { W: this._W, H: this._H, el, x, d, tilt: 0, ph: null, fx: new Set(), t: [] };
    this._a2CameraS = S;
    this._a2Scene(); // (golden: .gilt)
    if (pop && !calmMotion()) {
      el.classList.add('a2pop');
      S.t.push(setTimeout(() => el.classList.remove('a2pop'), 800));
    } else el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
    return S;
  }

  // Kopf neigen (Grad, negativ: Linse nach oben)
  _a2CameraTilt(deg) {
    const S = this._a2CameraS;
    if (!S) return;
    S.tilt = deg;
    S.el.style.setProperty('--a2cmt', `${deg.toFixed(1)}deg`);
  }

  // Kamera am Riemen im Maul (an) oder abgesetzt
  _a2CameraCarry(on) {
    this._a2CameraCarrying = on;
    this._el.pika.classList.toggle('carry', on);
    this._el.pika.classList.toggle('a2cm-carry', on); // (ohne Blatt-Schirm, siehe Stil)
    if (on) this._mouth(CAM_FARBE, CAMERA_MOUTH);
  }

  // ---------- Platz ----------

  // Wo cx (Mitte der Kamera, Linse nach d) liegen darf, damit jedes Stück F ([Abstand von cx in Richtung d, halbe
  // Breite, Art]) auf die Wiese passt: rechts vom Heu (.fore verdeckte, was dahinter steht), im Bild; der Pika bis xR,
  // der Freund in seinem Bereich (_frRange). → [kleinstes, größtes cx] oder null
  _a2CameraRoom(d, F) {
    const { pW, hayR, xR } = this._g;
    let lo = -Infinity;
    let hi = Infinity;
    for (const [off, half, kind] of F) {
      const o = d * off;
      let a = hayR + half * (kind === 'cam' ? 1 : 0.6);
      let b = this._W - half;
      if (kind === 'pika') {
        a = Math.max(a, pW * 0.45);
        b = Math.min(b, xR);
      } else if (kind === 'fr') {
        const [fl, fh] = this._frRange();
        a = Math.max(a, fl);
        b = Math.min(b, fh);
      }
      lo = Math.max(lo, a - o);
      hi = Math.min(hi, b - o);
    }
    return lo <= hi + 0.01 ? [lo, Math.max(lo, hi)] : null;
  }

  // Abstände (px) von der Mitte der Kamera: er hinter ihr am Sucher (behind), vor der Linse beim Knopf (front), auf
  // dem Platz fürs Selfie (pose), Spitze der Linse (tip), Höhe der Linse über dem Boden (lensY)
  _a2CameraOff() {
    const { pW } = this._g;
    const { w, k } = this._a2CameraDim();
    const tip = (CAM.tip - 20) * k;
    return { w, tip, behind: (20 - CAM.back) * k + pW * 0.44, front: tip + pW * 0.26, pose: tip + pW * 0.74, lensY: (40 - 14.4) * k };
  }

  // Für ein Foto: er hinter der Kamera, danach dreht er sich um, das Bild in seinen Pfoten auf der anderen Seite
  _a2CameraShotRoom(d) {
    const { pW } = this._g;
    const O = this._a2CameraOff();
    return this._a2CameraRoom(d, [[0, O.w / 2, 'cam'], [-O.behind, pW * 0.4, 'pika'], [-O.behind - pW * 0.2, pW * PHOTO_HELD * 0.55, 'cam']]);
  }

  // Himmel für das Bild (wie er gerade ist)
  _a2CameraSky() {
    const sc = this._el.scene.classList;
    const wx = this._wx || {};
    const night = sc.contains('night');
    return {
      night, dusk: !night && sc.contains('dusk'), cover: wx.cover ?? 20, bow: !night && !!this._bowKey && this._bowKey !== '0',
      rain: !!wx.wet, snow: (wx.snow || 0) > 0, fog: !!wx.fog, snowcover: !!wx.snowcover,
    };
  }

  // Motiv Vogel: der Besuch sitzt (auf dem Bau oder dem Stein). Kamera mit Abstand davor, Linse hinauf zu ihm
  _a2CameraAimBird(b) {
    const { pW, gy } = this._g;
    const O = this._a2CameraOff();
    const name = b.el?.querySelector?.('.bw')?.getAttribute?.('aria-label');
    const v = BIRDS.find((x) => x.name === name) || BIRDS[0];
    for (const d of [b.x >= this._x ? 1 : -1, b.x >= this._x ? -1 : 1]) {
      const R = this._a2CameraShotRoom(d);
      if (!R) continue;
      const cx = clamp(b.x - d * (O.tip + pW * 0.9), R[0], R[1]);
      const dx = d * (b.x - (cx + d * O.tip));
      if (dx < pW * 0.3) continue;
      const dy = gy - O.lensY - (b.y - this._H * 0.04);
      const tilt = clamp((-Math.atan2(dy, dx) * 180) / Math.PI, -48, 0);
      return { d, cx, tilt, M: { k: 'bird', bird: v, b } };
    }
    return null;
  }

  // Motiv Blume: die nächste, die mit Platz für ihn und die Kamera erreichbar ist (die Linse kurz vor der Blüte)
  _a2CameraAimFlower() {
    const { pW } = this._g;
    const O = this._a2CameraOff();
    const F = (this._flowers || []).filter((f) => !f.el?.classList?.contains('picked'))
      .map((f) => ({ f, x: f.xf * this._W })).sort((a, b) => Math.abs(a.x - this._x) - Math.abs(b.x - this._x));
    for (const { f, x } of F) {
      for (const d of [x >= this._x ? 1 : -1, x >= this._x ? -1 : 1]) {
        const R = this._a2CameraShotRoom(d);
        const cx = x - d * (O.tip + pW * 0.4);
        if (R && cx >= R[0] - 0.01 && cx <= R[1] + 0.01) {
          const o = (this._flowers || []).find((g) => g !== f && Math.abs(g.xf - f.xf) * this._W < pW * 0.8);
          return { d, cx, tilt: 8, M: { k: 'flower', color: f.color, color2: o?.color } };
        }
      }
    }
    return null;
  }

  // Motiv Himmel (gibt es immer): wo er gerade steht, Linse schräg nach oben
  _a2CameraAimSky() {
    const O = this._a2CameraOff();
    const pref = this._x + this._dir * this._g.pW * 1.2 <= this._g.xR ? this._dir || 1 : -(this._dir || 1);
    for (const d of [pref, -pref]) {
      const R = this._a2CameraShotRoom(d);
      if (R) return { d, cx: clamp(this._x + d * O.behind, R[0], R[1]), tilt: -30, M: { k: 'sky' } };
    }
    // (sehr schmale Wiese: so weit rechts wie möglich, Linse nach links)
    return { d: -1, cx: Math.max(this._g.hayR + O.w / 2, this._W - O.behind - this._g.pW * 0.45), tilt: -30, M: { k: 'sky' } };
  }

  // Was er fotografiert: der Vogel vom Besuch am liebsten, dann eine Blume, sonst der Himmel (mit Regenbogen gern).
  // want: dieses Motiv, wenn es geht (Tests, Vorschau: this._a2CameraDbgMotif)
  _a2CameraPick(want = null) {
    const C = [];
    const b = this._bird;
    if (b?.sitting && !b.scared) {
      const L = this._a2CameraAimBird(b);
      if (L) C.push([3, L]);
    }
    if (!this._wx?.snowcover) {
      const L = this._a2CameraAimFlower();
      if (L) C.push([2, L]);
    }
    const sky = this._a2CameraAimSky();
    C.push([this._a2CameraSky().bow ? 5 : 1, sky]);
    if (want) return C.find(([, L]) => L.M.k === want)?.[1] || sky;
    return weighted(C);
  }

  // Für ein Selfie: Kamera, er am Knopf (vor der Linse), sein Platz, der des Freunds (fr) dahinter. → Plan oder null
  _a2CameraSelfPlan(fr) {
    const { pW } = this._g;
    const O = this._a2CameraOff();
    const sc = fr ? FRIENDS[fr.kind]?.scale ?? 0.92 : 0;
    const ff = O.pose + pW * (0.4 + 0.32 * sc);
    const F = [[0, O.w / 2, 'cam'], [O.front, pW * 0.4, 'pika'], [O.pose, pW * 0.4, 'pika'], [O.front + pW * 0.2, pW * PHOTO_HELD * 0.55, 'cam']];
    if (fr) F.push([ff, pW * 0.45 * sc, 'fr']);
    const pref = fr ? (fr.x >= this._x ? 1 : -1) : this._x < this._W * 0.55 ? 1 : -1;
    for (const d of [pref, -pref]) {
      const R = this._a2CameraRoom(d, F);
      if (!R) continue;
      const cx = clamp(fr ? fr.x - d * ff : this._x - d * O.front, R[0], R[1]);
      return { d, cx, front: cx + d * O.front, pose: cx + d * O.pose, ffx: cx + d * ff };
    }
    return null;
  }

  // ---------- Was er damit tut ----------

  // Fotowetter: bei Tag (die Dämmerung zählt mit, das Gewicht ist dann kleiner), kein starker Regen, kein Gewitter,
  // kein Sturm, kaum Wind. Normaler Regen (rainy, 40) und Schneeregen gehen: Er hat dann sein Blatt als Schirm, die
  // Tropfen kommen mit aufs Bild. Starkregen, Hagel und Gewitter (pouring, hail, lightning: storm/flash) nicht.
  _a2CameraWeather(wx = this._wx || {}) {
    return !wx.storm && !wx.shelter && !wx.flash && !wx.hail && !((wx.rain || 0) > 40)
      && !this._el.scene.classList.contains('night') && (this._wind || 0) < 40;
  }

  // Der Freund, der mit aufs Selfie darf: da, begrüßt, nicht im Gehen und nicht in den letzten Sekunden des Besuchs
  _a2CameraFriend() {
    const fr = this._fr;
    return fr && fr.arrived && !fr.leaving && fr.greeted && !fr.busy && Date.now() < (fr.until ?? Infinity) - FRIEND_LAST ? fr : null;
  }

  // Hook: Fotos mag er ab und zu; das Selfie selten allein, oft, wenn der Freund da ist (dessen Spiele wiegen 3,5–7)
  _a2CameraActs({ wx }, lv) {
    if (!this._a2CameraWeather(wx)) return [];
    const k = this._el.scene.classList.contains('dusk') ? 0.3 : 1;
    return [[0.3 * k, 'a2CameraPlay'], [lv >= 2 ? (this._a2CameraFriend() ? 1.5 : 0.15) * k : 0, 'a2CameraSelfie']];
  }

  // Stufe 1 (Aktion 'a2CameraPlay'). o: { short: nach dem Auspacken (die Kamera kommt gleich neben ihn, auch bei
  // jedem Wetter), gold: goldener Rahmen sicher, motif: dieses Motiv, wenn es geht }
  async _a2CameraPlay(o = {}) {
    const lv = this._a2Lv('camera');
    if (!lv || (!this._a2CameraWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('camera', CAMERA_GOLD));
    this._a2CameraBusy = true;
    try {
      const L = this._a2CameraPick(o.motif ?? this._a2CameraDbgMotif ?? null);
      const O = this._a2CameraOff();
      await this._a2CameraSetUp(L.cx, L.d, L.cx - L.d * O.behind, o.short);
      await this._a2CameraShoot(L, gold);
    } finally {
      this._a2CameraBusy = false;
      this._a2CameraEnd(true);
    }
  }

  // Stufe 2, der Trick (Aktion 'a2CameraSelfie'): mit dem Freund, wenn er da ist (o.solo: allein)
  async _a2CameraSelfie(o = {}) {
    const lv = this._a2Lv('camera');
    if (lv < 2 || (!this._a2CameraWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('camera', CAMERA_GOLD));
    let fr = o.solo ? null : this._a2CameraFriend();
    if (fr && !this._a2CameraSelfPlan(fr)) fr = null; // (kein Platz für beide: allein)
    this._a2CameraBusy = true;
    try {
      if (fr) await this._withFriend((f, w) => this._a2CameraSelf(f, w, gold, o));
      else await this._a2CameraSelf(null, (ms) => this._wait(ms), gold, o);
    } finally {
      this._a2CameraBusy = false;
      this._a2CameraEnd(true);
    }
  }

  // Nach dem Auspacken (Hook): Stufe 1 gleich ein Foto, 2 das Selfie, 3 ein Foto im goldenen Rahmen
  async _a2CameraStow(lv) {
    if (lv === 2) return this._a2CameraSelfie({ short: true });
    this._say(lv >= 3 ? pick(['goldig!', 'die glänzt!']) : pick(['Fotozeit!', 'ein Foto!']), 1300);
    await this._wait(900);
    return this._a2CameraPlay({ short: true, gold: lv >= 3 });
  }

  // Holen und aufstellen: zum Bau, Kamera am Riemen ins Maul, zum Platz (x), absetzen; die Kamera steht bei cx, Linse
  // nach d. short (nach dem Auspacken) und Bewegung reduzieren: kein Holen, sie kommt neben ihm (ruhig: blendet ein)
  async _a2CameraSetUp(cx, d, x, short = false) {
    const p = this._el.pika;
    const { hole, pW } = this._g;
    const calm = calmMotion();
    if (!short && !calm) {
      await this._walkTo(hole.cx + pW * 0.75, 1.1);
      this._face(-1);
      this._say(pick(['Kamera holen!', 'wo ist sie…', 'Fotozeit!']), 1300);
      await this._wait(700);
      p.classList.add('crouch');
      await this._wait(260);
      p.classList.remove('crouch');
      this._a2CameraCarry(true);
      await this._wait(300);
    }
    await this._walkTo(x, 1);
    this._face(cx >= this._x ? 1 : -1);
    if (this._a2CameraCarrying) {
      p.classList.add('crouch');
      await this._wait(260);
      p.classList.remove('crouch');
      this._a2CameraCarry(false);
    }
    this._a2CameraMake(cx, d, !calm);
    await this._wait(calm ? 600 : 700);
  }

  // Auslösen: Knopf, Blitz (ein Lichtpuls), er blinzelt. → true, wenn es geblitzt hat
  _a2CameraSnap() {
    const S = this._a2CameraS;
    if (!S) return false;
    const F = this._a2CameraPt(...CAM.flash, S);
    this._peep(F.x, F.y - this._H * 0.03, 'klick!');
    const on = this._a2CameraFlash(S);
    if (!this._asleep) this._cls('blink', 260);
    return on;
  }

  // Knopf und Blitz. Der Knopf klickt immer; Licht höchstens alle FLASH_GAP. Bewegung reduzieren: nur das Blitzfenster
  // leuchtet langsam auf und ab, kein Lichtpuls
  _a2CameraFlash(S = this._a2CameraS) {
    if (!S) return false;
    const el = S.el;
    el.classList.add('snap');
    S.t.push(setTimeout(() => el.classList.remove('snap'), 220));
    const now = Date.now();
    if (now - (this._a2CameraFlashAt ?? -Infinity) < FLASH_GAP) return false;
    this._a2CameraFlashAt = now;
    const calm = calmMotion();
    el.classList.add('glow');
    S.t.push(setTimeout(() => el.classList.remove('glow'), calm ? 900 : 240));
    if (calm) return true;
    const F = this._a2CameraPt(...CAM.flash, S);
    const b = document.createElement('span');
    b.className = 'a2cmbu';
    b.style.left = `${F.x.toFixed(1)}px`;
    b.style.top = `${F.y.toFixed(1)}px`;
    const o = document.createElement('span');
    o.className = 'a2cmov';
    for (const e of [o, b]) {
      this._el.fx.appendChild(e);
      S.fx.add(e);
    }
    S.t.push(setTimeout(() => {
      for (const e of [o, b]) {
        e.remove();
        S.fx.delete(e);
      }
    }, 600));
    return true;
  }

  // Das Sofortbild zum Motiv M (golden: Rahmen und Glitzer)
  _a2CameraPhoto(M, gold) {
    const S = this._a2CameraS;
    const ph = document.createElement('div');
    ph.className = `a2cmph${gold ? ' gold' : ''}${calmMotion() ? ' still' : ''}`;
    ph.innerHTML = PHOTO_SVG(M, gold);
    this._el.gifts.appendChild(ph);
    if (S) S.ph = ph;
    return ph;
  }

  // Stellung des Bilds: Mitte x, Unterkante y, Breite w (px), gedreht um rot Grad (um die Unterkante)
  _a2CameraPhotoAt(ph, x, y, w, rot = 0) {
    ph.style.left = `${(x - w / 2).toFixed(1)}px`;
    ph.style.top = `${(y - w * 1.2).toFixed(1)}px`;
    ph.style.width = `${w.toFixed(1)}px`;
    ph.style.transform = rot ? `rotate(${rot.toFixed(1)}deg)` : 'none';
  }

  // Oben aus dem Schlitz schiebt es sich heraus (surrend)
  async _a2CameraEject(ph) {
    const S = this._a2CameraS;
    const { w } = this._a2CameraDim();
    const pw = w * PHOTO_SLOT;
    const P = this._a2CameraPt(...CAM.slot, S);
    const rot = (S?.tilt || 0) * (S?.d || 1);
    ph.style.zIndex = String(PHOTO_Z());
    this._a2CameraPhotoAt(ph, P.x, P.y + pw * 0.1, pw, rot);
    ph.animate?.([{ transform: `rotate(${rot.toFixed(1)}deg) translateY(100%)` }, { transform: `rotate(${rot.toFixed(1)}deg)` }], { duration: 1100, easing: 'ease-out', fill: 'backwards' });
    this._peep(P.x, P.y - pw * 1.6, 'surr…');
    await this._wait(1200);
  }

  // In die Pfoten: vor ihm, auf der Seite, zu der er schaut (ruhig: blendet dort ein). Die Klasse heißt a2cmheld, nicht
  // held: .held ist die Ebene des Plüsch-Pinos im Arm (STYLE_GIFT, inset: 0), das Bild reichte sonst bis zum Boden
  // der Szene, und es drehte sich um deren Unterkante statt um seine eigene
  _a2CameraHold(ph) {
    const { pW, pH, gy } = this._g;
    const first = !ph.classList.contains('a2cmheld');
    ph.style.zIndex = String(HELD_Z());
    ph.classList.add('a2cmheld');
    this._a2CameraPhotoAt(ph, this._x + this._dir * pW * 0.2, gy - pH * 0.04, pW * PHOTO_HELD, -this._dir * 5);
    this._el.pika.classList.add('a2cm-hold');
    if (first && calmMotion()) ph.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'backwards' });
  }

  // Nehmen (er steht an der Kamera, Gesicht zu ihr): hochrecken, das Bild in die Pfoten, umdrehen (weg von der Kamera),
  // dann entwickelt es sich
  async _a2CameraTake(ph, w) {
    const p = this._el.pika;
    if (!calmMotion()) {
      p.classList.add('look-up');
      await w(350);
      p.classList.remove('look-up');
    }
    this._face(-this._dir);
    this._a2CameraHold(ph);
    await w(400);
    ph.classList.add('dev');
  }

  // Zielen, auslösen, Bild nehmen und anschauen (Stufe 1; L: Motiv und Platz aus _a2CameraPick)
  async _a2CameraShoot(L, gold) {
    const p = this._el.pika;
    const M = L.M;
    const S = this._a2CameraS;
    if (!S) return;
    this._a2CameraTilt(L.tilt);
    const sk = this._a2CameraSky();
    this._say(M.k === 'bird' ? pick(['pssst…', 'nicht wegfliegen…', 'stillhalten…'])
      : M.k === 'flower' ? pick(['bitte lächeln!', 'schön stillhalten!', 'hübsch so!'])
        : sk.bow ? 'ein Regenbogen!' : pick(['so ein Himmel!', 'da oben…', 'schau mal!']), 1300);
    await this._wait(1300);
    // Der Vogel ist auf dem Bild, wenn er beim Klick noch sitzt
    const shot = { ...M, S: sk };
    if (M.k === 'bird') shot.bird = M.b && this._bird === M.b && M.b.sitting && !M.b.scared ? M.bird : null;
    delete shot.b;
    this._a2CameraSnap();
    await this._wait(600);
    const ph = this._a2CameraPhoto(shot, gold);
    if (!calmMotion()) await this._a2CameraEject(ph);
    await this._a2CameraTake(ph, (ms) => this._wait(ms));
    p.classList.add('tilt');
    this._say(pick(['mal sehen…', 'oh…', 'gleich…']), 1300);
    await this._wait(1900);
    p.classList.remove('tilt');
    p.classList.add('look-f');
    this._say(shot.k === 'bird' ? (shot.bird ? `${shot.bird.name === 'Blaumeise' ? 'eine' : 'ein'} ${shot.bird.name}!` : pick(['weggeflogen!', 'zu spät…']))
      : shot.k === 'flower' ? pick(['meine Blume!', 'so hübsch!', 'eine Blume!'])
        : sk.bow ? 'mit Regenbogen!' : sk.night ? 'der Mond!' : sk.snow ? 'Schneeflocken!' : sk.cover >= 70 ? 'Wolken!' : pick(['der Himmel!', 'schön blau!']), 1600);
    if (shot.k === 'bird' && !shot.bird) this._emote('drop', 1400);
    else this._happy(1400);
    await this._wait(1400);
    if (gold) await this._a2CameraGold(ph);
    this._say(pick(['fürs Album!', 'schön!', '♥']), 1200);
    await this._wait(1300);
    p.classList.remove('look-f');
  }

  // Golden: Funkeln ums Bild, er staunt
  async _a2CameraGold(ph, w = (ms) => this._wait(ms)) {
    const { pW, pH, gy } = this._g;
    const x = this._x + this._dir * pW * 0.2;
    for (let i = 0; i < 3; i++) setTimeout(() => this._g && ph.isConnected && this._sparkle(x, gy - pH * 0.35, 1), i * 300);
    this._mimik('awe', 1400);
    this._say(pick(['es glitzert!', 'goldig!', 'im Goldrahmen!']), 1500);
    await w(1600);
  }

  // Das Selfie (Stufe 2): aufstellen, Selbstauslöser, vor die Linse (der Freund kommt mit), Blitz, Bild holen,
  // anschauen (mit dem Freund). w: warten (mit dem Freund bricht es ab, wenn er gehen muss)
  async _a2CameraSelf(fr, w, gold, o) {
    const p = this._el.pika;
    const calm = calmMotion();
    const L = this._a2CameraSelfPlan(fr) || this._a2CameraSelfPlan(null) || (() => {
      const O = this._a2CameraOff();
      const cx = this._g.hayR + O.w / 2;
      return { d: 1, cx, front: cx + O.front, pose: Math.min(this._g.xR, cx + O.pose), ffx: cx + O.pose };
    })();
    await this._a2CameraSetUp(L.cx, L.d, L.front, o.short);
    const S = this._a2CameraS;
    if (!S) return;
    // (Pino heißt wie in friend_name; _frGuest gehört Begrüßung und Abschied)
    const who = fr ? FRIENDS[fr.kind]?.name || this._frName() : null;
    this._say(fr ? `${who}, ein Foto!` : pick(['ein Selfie!', 'jetzt ich!']), 1400);
    if (fr) {
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      this._frCall(fr, pick(['mip!', 'oh!']));
    }
    await w(1000);
    // Selbstauslöser: Knopf, das Lämpchen blinkt (ruhig: leuchtet), piep … piep
    if (!calm) {
      p.classList.add('look-up');
      await w(300);
      p.classList.remove('look-up');
    }
    S.el.classList.add('snap', 'timer');
    S.t.push(setTimeout(() => S.el.classList.remove('snap'), 220));
    const T = this._a2CameraPt(27.2, 12.6, S);
    for (let i = 0; i < 4; i++) S.t.push(setTimeout(() => this._a2CameraS === S && this._peep(T.x, T.y - this._H * 0.04, 'piep'), 200 + i * 750));
    this._say(pick(['schnell!', 'los, los!']), 900);
    const go = [this._walkTo(L.pose, calm ? 1.2 : 1.8)];
    if (fr) go.push(this._friendWalkTo(fr, L.ffx, 1.4, w));
    await Promise.all(go);
    this._face(-L.d);
    if (fr) this._frFace(fr, -L.d);
    p.classList.add('happy');
    if (fr) this._frHappy(fr, 1800);
    this._say(pick(['cheese!', 'Spaghetti!', 'lächeln!']), 1200);
    await w(1300);
    S.el.classList.remove('timer');
    this._a2CameraSnap();
    if (fr && fr.el) {
      // (nicht in S.t: Bräche die Aktion in diesen 260 ms ab, räumte das Ende den Zeitgeber ab, und der Freund behielte
      // die Augen zu bis zu seinem nächsten Blinzeln)
      const fe = fr.el;
      fe.classList.add('blink');
      setTimeout(() => fe.classList.remove('blink'), 260);
    }
    const shot = { k: 'self', S: this._a2CameraSky(), who: fr ? [{ k: fr.kind, s: FRIENDS[fr.kind]?.scale ?? 0.92 }] : [] };
    await w(600);
    p.classList.remove('happy');
    const ph = this._a2CameraPhoto(shot, gold);
    if (!calm) await this._a2CameraEject(ph);
    // holen: vor die Linse, nehmen, umdrehen (zum Freund)
    await this._walkTo(L.front, 1.1);
    this._face(-L.d);
    await this._a2CameraTake(ph, w);
    if (fr && this._fr === fr) {
      this._say(pick([`schau mal, ${who}!`, 'schau!']), 1300);
      await this._friendWalkTo(fr, this._x + L.d * this._g.pW * 0.72, 1, w);
      this._frFace(fr, -L.d);
      this._frLook(fr, 'look-f', 1600);
      await w(1200);
      p.classList.add('look-f');
      this._say(pick(['wir zwei!', 'das sind wir!']), 1500);
      this._frSay(fr, pick(['♥', 'mip!']), 1300);
      this._hearts(2);
      this._frHearts(fr, 2);
      await w(1500);
    } else {
      p.classList.add('tilt');
      await w(1500);
      p.classList.remove('tilt');
      p.classList.add('look-f');
      this._say(pick(['das bin ich!', 'hübsch!', 'ich!']), 1500);
      this._happy(1400);
      await w(1500);
    }
    if (gold) await this._a2CameraGold(ph, w);
    this._say(pick(['fürs Album!', '♥']), 1100);
    await w(1200);
    p.classList.remove('look-f');
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Tipp auf die Kamera (nur, solange sie steht): Sie blitzt (höchstens alle FLASH_GAP, sonst klickt sie nur)
  _a2CameraTap() {
    const S = this._a2CameraS;
    if (!S) return false;
    const on = this._a2CameraFlash(S);
    const F = this._a2CameraPt(...CAM.flash, S);
    this._peep(F.x, F.y - this._H * 0.03, on ? 'blitz!' : 'klick!');
    return true;
  }

  // Ende der Aktion oder Abbruch (auch aus _cleanup nach jeder Aktion): Kamera, Bild, Teilchen, Zeitgeber, Riemen im
  // Maul weg (force: aus der eigenen Aktion. Sonst, mitten in ihr, aus Szene oder Aufräumen: nichts, sie räumt in
  // ihrem finally selbst auf; nur nach einem Abbruch gleich). now: sofort, ohne Ausblenden (Karte aus dem DOM)
  _a2CameraEnd(force = false, now = false) {
    if (!force && this._a2CameraBusy && !this._ac?.signal?.aborted) return;
    if (this._a2CameraCarrying) this._a2CameraCarry(false);
    this._el.pika.classList.remove(...CAMERA_CLS);
    const S = this._a2CameraS;
    if (!S) return;
    this._a2CameraS = null;
    for (const t of S.t) clearTimeout(t);
    for (const e of S.fx) e.remove();
    const ph = S.ph;
    if (ph) {
      if (now || !ph.isConnected) ph.remove();
      else {
        ph.classList.add('away');
        setTimeout(() => ph.remove(), 550);
      }
    }
    const el = S.el;
    el.classList.remove('timer', 'glow', 'snap', 'a2pop');
    if (!now && el.isConnected && this._a2Els?.get('camera') === el) {
      el.classList.add('a2out');
      setTimeout(() => !this._a2CameraS && this._a2Drop('camera'), 450);
    } else this._a2Drop('camera');
  }

  _a2CameraCleanup() {
    this._a2CameraEnd();
  }

  // Karte aus dem DOM: alles sofort weg
  _a2CameraDetach() {
    this._a2CameraBusy = false;
    this._a2CameraEnd(true, true);
  }
}
