// Große Beschäftigungen: Lesen, Gameboy, Tablet, Drachen, Fernsehen, Musik, Malen, Seifenblasen, Frühsport, Seil,
// Hantel

import { rnd, pick, clamp, hasKey } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import {
  ACT_WALK, ropeJumps, HOP_MS, KITE_LEAN, kitePaw, hopRound, SPORT_INTRO, SPORT_PAUSE, sportPlan, KRAM,
} from '../logik/beschaeftigungen.js';
import { TV_COLORS, KITE_SVG, EASEL_MOTIF, EASEL_SVG, SEED_SVG, DROP_SVG } from '../grafik/beschaeftigungen.js';

export class BeschaeftigungenGross {
  // Kleiner Ton über dem Kopf (Gameboy)
  _note(text) {
    const { pW, pH, gy } = this._g;
    const n = document.createElement('span');
    n.className = 'note';
    n.textContent = text;
    n.style.left = `${this._x + this._dir * pW * 0.2}px`;
    n.style.top = `${gy - pH * 0.75 - this._lift}px`;
    n.style.setProperty('--dx', `${this._dir * rnd(4, 14)}px`);
    this._el.fx.appendChild(n);
    setTimeout(() => n.remove(), 1400);
  }

  _pageFlip() {
    const b = this._el.bflip;
    b.classList.remove('go');
    b.getBoundingClientRect();
    b.classList.add('go');
  }

  // Lesen am Heuhaufen bzw. neben der Nische oder vor der Tür: Kopf wandert die Zeilen entlang, blättert um,
  // kichert. Nachmittags nickt er manchmal ein (fest im Fenster, 40 s vor dem Ende; Streicheln weckt ihn).
  async _read() {
    const S = this._slotFor('read');
    const { stand, home, pW } = this._g;
    await this._goSpot(S, S.r(2) < 0.6 ? stand + pW * 0.16 : home + pW * 0.7);
    this._face(1);
    const p = this._el.pika;
    this._propOn('reading');
    const h = new Date(S.start).getHours();
    const now0 = this._planNow();
    const doze = this._dbgDoze ? [now0 + 2500, now0 + 14000]
      : h >= 13 && h < 17 && S.r(3) < 0.35 ? [S.end - 40000, S.end - 30000 + S.r(4) * 8000] : null;
    this._dbgDoze = false;
    let dozed = false;
    while (this._planNow() < S.end) {
      const now = this._planNow();
      if (doze && !dozed && now >= doze[0] && now < doze[1]) {
        dozed = true;
        p.classList.add('doze');
        while (this._planNow() < doze[1] && p.classList.contains('doze')) await this._wait(500);
        if (p.classList.contains('doze')) {
          p.classList.remove('doze');
          this._jump('hop1');
          this._say('!', 900);
        }
        await this._wait(1200);
        continue;
      }
      const ev = doze && !dozed && doze[0] > now ? doze[0] : S.end;
      await this._waitMax(rnd(2500, 5000), ev);
      if (this._planNow() >= ev) continue;
      const r = Math.random();
      if (r < 0.5) this._pageFlip();
      else if (r < 0.65) this._say(pick(['hihi', 'hihi!', 'oh!', 'hm…']), 1100);
      else if (r < 0.75) this._twitch();
    }
    await this._wait(400);
    await this._propOff('reading', 'doze');
  }

  // Gameboy: Daumen tippen, Piepser steigen auf; nach jeder Runde Freudensprung oder hängende Ohren
  // (Rundenzahl und Ausgang stehen mit dem Fenster fest)
  async _game() {
    const S = this._slotFor('game');
    await this._goSpot(S, this._hobbySpot(S.r(2)));
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('gaming');
    const t0 = S.start + ACT_WALK;
    const rounds = 2 + Math.floor(S.r(4) * 3);
    const L = (S.end - t0) / rounds;
    for (let i = clamp(Math.floor((this._planNow() - t0) / L), 0, rounds); i < rounds; i++) {
      const end = t0 + (i + 1) * L - 2800;
      while (this._planNow() < end) {
        await this._waitMax(rnd(900, 2600), end);
        if (this._planNow() < end) this._note(pick(['♪', '♫', 'pi', 'pu', 'piu']));
      }
      if (S.r(10 + i) < 0.55) {
        this._jump('binky');
        this._say(pick(['Juhu!', 'Jaaa!']), 1200);
      } else {
        p.classList.add('meh');
        this._mimik('sad', 1600);
        this._say(pick(['mööp', 'och…']), 1200);
        await this._wait(1600);
        p.classList.remove('meh');
      }
      await this._at(t0 + (i + 1) * L);
    }
    await this._wait(200);
    await this._propOff('gaming');
  }

  // Auf dem Bauch mit dem Tablet: wischt, kichert. Fliegt gerade ein echtes Flugzeug vorbei,
  // zeigt das Tablet die Flugkarte, und er schaut zum Himmel.
  async _tablet() {
    const S = this._slotFor('tablet');
    await this._goSpot(S, this._hobbySpot(S.r(2)));
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    p.classList.add('lying');
    await this._wait(400);
    this._propOn('tablet');
    while (this._planNow() < S.end) {
      const plane = [...this._planes.values()].find((pl) => pl.show && !pl.gone);
      p.classList.toggle('tplane', !!plane);
      await this._waitMax(rnd(1800, 4000), S.end);
      const r = Math.random();
      if (plane && plane.show && r < 0.35) {
        this._face(plane.x >= this._x ? 1 : -1);
        p.classList.add('look-up');
        this._say(pick(['da!', 'oh!']), 1000);
        await this._wait(rnd(1800, 2800));
        p.classList.remove('look-up');
      } else if (r < 0.7) {
        p.classList.add('swipe');
        await this._wait(650);
        p.classList.remove('swipe');
      } else if (r < 0.82) {
        this._say(pick(['hihi', 'oh!', '♥']), 1000);
      }
    }
    await this._propOff('tablet');
    p.classList.remove('tplane');
    await this._wait(100);
    p.classList.remove('lying');
    await this._wait(400);
  }

  // Drachen steigen lassen: der Drache steht im Wind (Windrichtung aus dem Wetter), schwankt und zerrt
  async _kite() {
    const S = this._slotFor('kite');
    const { pW, pH, gy, fMin, fMax } = this._g;
    const W = this._W;
    const H = this._H;
    const kd = this._windDir || -1;
    await this._goSpot(S, clamp(W * (kd < 0 ? 0.64 : 0.38), fMin * W, fMax * W), 0.9);
    this._face(kd);
    const p = this._el.pika;
    p.classList.add('kiting');
    // Pfote in px, mit ihm gegen den Zug gelehnt (kitePaw, ab den Füßen); der Drache steht schräg oben im Wind
    const [rx, ry] = kitePaw(pW, pH, KITE_LEAN.rest);
    const [tx, ty] = kitePaw(pW, pH, KITE_LEAN.tug, KITE_LEAN.sx, KITE_LEAN.sy);
    const px = this._x + kd * rx;
    const py = gy + pH * 0.055 - this._lift + ry;
    const K = H * 0.12;
    const kx = clamp(px + kd * W * (0.26 + S.r(2) * 0.12), K, W - K) - px;
    const ky = this._sy(0.1 + S.r(3) * 0.07) - py;
    const el = document.createElement('div');
    el.className = 'kite';
    el.style.left = `${px.toFixed(1)}px`;
    el.style.top = `${py.toFixed(1)}px`;
    el.style.setProperty('--k0', `${kd * 60}deg`);
    // so weit wandert die Pfote bei einem Ruck
    el.style.setProperty('--ktx', `${(kd * (tx - rx)).toFixed(2)}px`);
    el.style.setProperty('--kty', `${(ty - ry).toFixed(2)}px`);
    el.style.setProperty('--kd', `${clamp(4.5 - (this._wind || 30) / 20, 1.6, 4).toFixed(2)}s`);
    el.innerHTML = KITE_SVG(kx, ky, K);
    this._kiteAway();
    this._kiteEl = el;
    this._el.kites.appendChild(el);
    void el.offsetWidth;
    el.classList.add('up');
    this._say(pick(['wuiii!', 'hoch!']), 1200);
    while (this._planNow() < S.end && (this._forced || this._kiteWind())) {
      await this._waitMax(rnd(3000, 6000), S.end);
      const r = Math.random();
      if (r < 0.3) {
        el.classList.remove('tug');
        void el.offsetWidth;
        el.classList.add('tug');
        // er stemmt sich gegen den Ruck, der Anfang der Schnur geht mit der Pfote mit
        this._cls('ktug', KITE_LEAN.ms, true);
        el.classList.add('kpull');
        clearTimeout(this._kpullT);
        this._kpullT = setTimeout(() => el.classList.remove('kpull'), KITE_LEAN.ms);
      } else if (r < 0.5) {
        this._say(pick(['wuiii!', 'hihi', 'iiep!']), 1100);
      } else if (r < 0.6) {
        this._twitch();
      }
    }
    // einholen
    el.classList.remove('up');
    await this._wait(2800);
    this._kiteAway();
  }

  _kiteAway() {
    const el = this._kiteEl;
    if (!el) return;
    this._kiteEl = null;
    el.classList.add('gone');
    setTimeout(() => el.remove(), 700);
  }

  // Fernsehen im Bau: sitzt mit dem Rücken zu uns im Eingang, das Licht vom Fernseher flackert bunt
  async _tv() {
    const S = this._slotFor('tv');
    const p = this._el.pika;
    if (this._jumpIn(S)) {
      this._lift = 0;
      this._setX(this._g.home, true);
      this._inside = true;
      this._pose('hidden', 0);
    } else if (!this._inside) await this._enterBurrow(this._wx.shelter ? 1.4 : 1);
    else if (this._poseName !== 'hidden') await this._to('hidden', 400);
    this._tvOn(true);
    await this._wait(700);
    p.classList.add('tv');
    await this._to('tv', 700);
    while (this._planNow() < S.end) {
      await this._waitMax(rnd(2500, 6000), S.end);
      // nach dem Streicheln wieder zum Fernseher drehen
      if (!p.classList.contains('tv')) {
        await this._wait(1200);
        this._pose('tv', 500);
        await this._tvFace(true);
        await this._wait(220);
        continue;
      }
      const r = Math.random();
      if (r < 0.25) {
        this._say(pick(['hihi', 'hihi!', 'ohh!', 'hihihi']), 1100);
      } else if (r < 0.45) {
        this._twitch();
      } else if (r < 0.57) {
        // dreht sich kurz um und schaut heraus
        this._pose('peek', 400);
        await this._tvFace(false);
        await this._wait(220);
        if (Math.random() < 0.5) this._say(pick(['mip?', 'iiep!']), 900);
        await this._wait(rnd(1400, 2400));
        this._pose('tv', 500);
        await this._tvFace(true);
        await this._wait(220);
      } else if (r < 0.65) {
        this._jump('hop1');
        this._say('!', 800);
      }
    }
    this._tvOn(false);
    await this._wait(300);
    await this._tvFace(false);
    await this._to('hidden', 500);
  }

  // Vorder- und Rückansicht im Bau wechseln (back: Rücken zu uns) als Drehung statt als Schnitt: Er wird schmal,
  // in der Mitte tauscht die Ansicht, dann wird er wieder breit (Stil: tvturn, 280 ms). Bewegung reduzieren: Schnitt.
  async _tvFace(back) {
    const p = this._el.pika;
    if (p.classList.contains('tv') === back) return;
    if (calmMotion()) {
      p.classList.toggle('tv', back);
      return;
    }
    p.classList.add('tvturn');
    try {
      await this._wait(130);
      p.classList.toggle('tv', back);
      await this._wait(150);
    } finally {
      p.classList.remove('tvturn');
    }
  }

  _tvOn(on) {
    if (!this._el) return;
    clearTimeout(this._tvT);
    this._el.scene.classList.toggle('tv-on', on);
    if (!on) return;
    // Farbe nur dort setzen, wo sie gebraucht wird (an der Szene würde sie den ganzen Baum neu berechnen)
    const next = () => {
      const c = pick(TV_COLORS);
      for (const el of [this._el.tvl, this._el.lights, this._el.pika]) el.style.setProperty('--tvc', c);
      // Bewegung reduzieren: Das Bild wechselt seltener (und flackert nicht, siehe Stil)
      this._tvT = setTimeout(next, calmMotion() ? rnd(4000, 9000) : rnd(600, 2600));
    };
    next();
  }

  // Punkt der Pika-Grafik (viewBox 120 × 100) in Szenen-Pixeln, ohne Atmen und Hüpfer
  _svgPt(vx, vy) {
    const { pW, pH, gy } = this._g;
    return { x: this._x + this._dir * pW * (vx / 120 - 0.5), y: gy - pH * 0.945 + pH * (vy / 100) - this._lift };
  }

  // ---------- Musik ----------

  // Ukulele: wiegt sich, schlägt die Saiten, Noten steigen auf. Singt manchmal mit, verspielt sich, und sitzt ein
  // Vögelchen da, zwitschert es mit. Am Ende eine Verbeugung.
  async _music() {
    this._memo('note');
    const S = this._slotFor('music');
    const { home, pW } = this._g;
    await this._goSpot(S, S.r(2) < 0.55 ? this._hobbySpot(S.r(3)) : home + pW * 0.75);
    this._face(this._x < this._W * 0.5 ? 1 : -1);
    const p = this._el.pika;
    this._propOn('music');
    while (this._planNow() < S.end) {
      await this._waitMax(rnd(700, 1500), S.end);
      this._note(pick(['♪', '♫', '♪', '♬']));
      const r = Math.random();
      if (r < 0.13) {
        p.classList.add('sing');
        this._say(pick(['la-la-la ♪', 'lalala!', '♪ mip-mip ♪', 'dum-di-dum', 'tralala']), 1900);
        await this._wait(1900);
        p.classList.remove('sing');
      } else if (r < 0.18) {
        p.classList.add('meh');
        this._say(pick(['plonk!', 'hoppla', 'oje']), 1100);
        await this._wait(1300);
        p.classList.remove('meh');
      } else if (r < 0.26 && this._bird?.sitting) {
        this._tweet(this._bird);
      } else if (r < 0.3) {
        this._twitch();
      }
    }
    p.classList.remove('sing');
    await this._propOff('music');
    await this._wait(100);
    p.classList.add('bowing');
    this._say(pick(['Danke! ♥', 'Tadaa!', '♪ ♥']), 1400);
    await this._wait(1600);
    p.classList.remove('bowing');
    this._hearts(2);
    await this._wait(500);
  }

  // ---------- Malen ----------

  // Staffelei neben sich, das Bild entsteht Schicht für Schicht: Farbe von der Palette holen, tupfen, ab und zu
  // betrachten. Am Ende tritt er zurück und ist stolz (oder nicht ganz zufrieden); das Bild bleibt kurz stehen.
  // Jede Schicht hat ihr festes Stück des Fensters: Wer später einsteigt, sieht das Bild so weit wie die anderen.
  async _paint() {
    const S = this._slotFor('paint');
    const late = this._jumpIn(S);
    const { pW, pH, gy } = this._g;
    const W = this._W;
    const EH = pH;
    const EW = EH * 0.75;
    const tip = pW * (117.2 / 120 - 0.5);
    // Staffelei auf der Seite mit Platz, ganz im Bild
    const maxR = W - 4 - EW * 0.83 - tip;
    const minL = 4 + tip + EW * 0.83;
    let x = this._hobbySpot(S.r(2));
    let dir = S.r(3) < 0.5 ? 1 : -1;
    if (dir > 0 && x > maxR) dir = x >= minL ? -1 : 1;
    if (dir < 0 && x < minL) dir = x <= maxR ? 1 : -1;
    x = dir > 0 ? Math.min(x, maxR) : Math.max(x, minL);
    await this._goSpot(S, x);
    this._face(dir);
    // Motiv: Wer das Fenster zuerst malt, trägt es in den Plan ein, die anderen malen dasselbe
    const own = S.k >= 0 && this._plan.rec.find((e) => e[0] === S.k);
    const motif = own && hasKey(EASEL_MOTIF, own[2]) ? own[2] : this._paintMotif(S.r(4), S.r(5));
    if (S.k >= 0) this._planOp({ t: 'rec', k: S.k, a: 'paint', v: motif });
    const el = document.createElement('div');
    el.className = 'easel';
    const left = dir > 0 ? this._x + tip - EW * 0.17 : this._x - tip - EW * 0.83;
    Object.assign(el.style, {
      left: `${left.toFixed(1)}px`, top: `${(gy - EH * 0.9875).toFixed(1)}px`, width: `${EW.toFixed(1)}px`, height: `${EH.toFixed(1)}px`,
    });
    el.innerHTML = EASEL_SVG(motif);
    this._easelAway();
    this._easelEl = el;
    this._el.acts.appendChild(el);
    void el.offsetWidth;
    el.classList.add('on');
    const p = this._el.pika;
    this._propOn('painting');
    if (!late) {
      this._say(pick(['Malzeit!', 'hmm …', 'Ein Bild!']), 1300);
      await this._wait(900);
    }
    const layers = [...el.querySelectorAll('.cvl')];
    const fill = (sel) => getComputedStyle(el.querySelector(sel)).fill;
    const colors = [fill('.cv-sky'), fill('.cv-sun'), '#86c46b', EASEL_MOTIF[motif][0], '#ffffff'];
    const t0 = S.start + ACT_WALK + 1500;
    const L = (S.end - t0) / layers.length;
    // Bei einer Schicht landet ein Klecks auf der Nase (feste Zahlen: auf allen Geräten dieselbe Farbe, auch für Späteinsteiger)
    const smudge = S.r(40) < 0.6 ? Math.floor(S.r(41) * layers.length) : -1;
    for (let i = 0; i < layers.length; i++) {
      const lEnd = t0 + (i + 1) * L;
      if (i === smudge) {
        p.style.setProperty('--nsm', colors[i]);
        p.classList.add('smudge');
      }
      if (this._planNow() >= lEnd - 600) {
        layers[i].style.opacity = '1'; // schon gemalt
        continue;
      }
      p.classList.add('mix');
      p.style.setProperty('--pc', colors[i]);
      await this._wait(900);
      p.classList.remove('mix');
      const n = 3 + Math.floor(S.r(10 + i) * 4);
      const look = i < layers.length - 1 && S.r(20 + i) < 0.45;
      const d0 = t0 + i * L + 900;
      const d1 = lEnd - (look ? 2600 : 300);
      for (let k = 1; k <= n; k++) {
        const tk = d0 + ((d1 - d0) * k) / n - 220;
        if (this._planNow() > tk + 800) {
          layers[i].style.opacity = (k / n).toFixed(2);
          continue;
        }
        await this._at(tk);
        p.classList.add('dab');
        await this._wait(220);
        p.classList.remove('dab');
        layers[i].style.opacity = (k / n).toFixed(2);
      }
      if (look) {
        await this._wait(400);
        p.classList.add('look-f');
        if (S.r(30 + i) < 0.5) this._say(pick(['hmm …', 'schön!', 'noch etwas …']), 1200);
        await this._at(lEnd);
        p.classList.remove('look-f');
      }
      await this._at(lEnd);
    }
    await this._propOff('painting');
    // rückwärts zurücktreten, den Blick auf dem Bild, und anschauen
    await this._walkTo(this._x - dir * pW * 0.35, 0.6, true, 0, true);
    this._face(dir);
    p.classList.add('look-f');
    await this._wait(900);
    if (S.r(6) < 0.75) {
      this._happy(1400);
      this._mimik('proud', 2600);
      this._say(pick(['Fertig!', 'Kunst!', 'Meisterwerk!', '♥']), 1500);
      this._jump('hop1');
    } else {
      p.classList.add('meh');
      this._mimik('sad', 1500);
      this._say(pick(['naja …', 'hm.', 'nächstes Mal']), 1400);
      await this._wait(1500);
      p.classList.remove('meh');
    }
    await this._wait(5000 + S.r(7) * 4000);
    p.classList.remove('look-f');
    this._easelAway();
    // Klecks von der Nase putzen
    if (p.classList.contains('smudge')) {
      p.classList.add('groom');
      await this._wait(900);
      p.classList.remove('groom', 'smudge');
    }
    await this._wait(600);
  }

  // Motiv aus festen Zahlen u, u2: Blume, Selbstbildnis, Bau, Regenbogen; Pino, wenn er da ist (sonst selten);
  // Flieger, wenn einer fliegt
  _paintMotif(u, u2) {
    const m = ['blume', 'pika', 'bau', 'regenbogen'];
    if (this._fr || u2 < 0.15) m.push('pino');
    if ([...this._planes.values()].some((pl) => pl.show && !pl.gone)) m.push('flieger', 'flieger');
    return m[Math.floor(u * m.length)];
  }

  _easelAway() {
    const el = this._easelEl;
    if (!el) return;
    this._easelEl = null;
    el.classList.add('off');
    setTimeout(() => el.remove(), KRAM.out + 60);
  }

  // ---------- Seifenblasen ----------

  // Pustet durch den Ring, die Blasen treiben mit dem Wind, schillern und platzen. Ab und zu springt er einer
  // hinterher. Antippen bringt eine Blase zum Platzen.
  async _bubbles() {
    const S = this._slotFor('bubbles');
    await this._goSpot(S, this._hobbySpot(S.r(2)));
    this._face(this._windDir || (S.r(3) < 0.5 ? -1 : 1));
    const p = this._el.pika;
    this._propOn('blowing');
    while (this._planNow() < S.end && (this._forced || (!this._wx.wet && (this._wind || 0) < 40))) {
      await this._waitMax(rnd(1200, 2600), S.end);
      p.classList.add('blow');
      await this._wait(450);
      const n = 1 + Math.floor(rnd(0, 4));
      for (let i = 0; i < n; i++) {
        this._soapBubble();
        await this._wait(rnd(120, 280));
      }
      p.classList.remove('blow');
      if (Math.random() < 0.3) await this._chaseBubble();
      else if (Math.random() < 0.2) this._say(pick(['oooh!', 'hihi', 'schön!']), 1100);
    }
    p.classList.remove('blow');
    await this._propOff('blowing');
    await this._wait(300);
  }

  _soapBubble() {
    const bubs = (this._bubs ??= new Set());
    if (!this._g || bubs.size >= 8) return; // jede Blase ist eine eigene Ebene: schwache Tablets schonen
    const { pW, pH } = this._g;
    const W = this._W;
    const H = this._H;
    const o = this._svgPt(118, 48.5);
    const el = document.createElement('div');
    el.className = 'bub';
    el.style.setProperty('--bs', `${(pH * rnd(0.09, 0.2)).toFixed(1)}px`);
    el.innerHTML = '<i></i>';
    // erst ein Stück aus dem Ring heraus, dann mit dem Wind (ohne Wind langsam nach oben)
    const kd = this._windDir || this._dir;
    const wind = clamp((this._wind || 6) / 25, 0.2, 1.4);
    const out = this._dir * pW * rnd(0.25, 0.5);
    const dx = kd * W * 0.35 * wind * rnd(0.6, 1.3);
    const dy = -H * rnd(0.15, 0.45);
    const at = (t, wob) => ({ x: o.x + out * Math.min(1, t * 3) + dx * t + wob * pW * 0.2, y: o.y + dy * t + Math.abs(wob) * H * 0.03 });
    // Stützpunkte merken: _bubPos rechnet daraus, wo die Blase gleich ist
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => at(t, t ? rnd(-1, 1) : 0));
    const frames = pts.map((q) => ({ transform: `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)` }));
    this._el.fx.appendChild(el);
    const dur = rnd(3500, 7500);
    const anim = el.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
    const b = { el, anim, pts, dur };
    bubs.add(b);
    el.firstChild.addEventListener('click', (e) => (e.stopPropagation(), this._found('bubble'), this._popBubble(b, true)));
    anim.finished.then(() => this._popBubble(b), () => {});
  }

  // Wo Blase b in ms Millisekunden ist (Szenen-Pixel; die Animation ist linear zwischen den Stützpunkten)
  _bubPos(b, ms = 0) {
    const t = clamp(((b.anim.currentTime || 0) + ms) / b.dur, 0, 1) * 4;
    const i = Math.min(3, Math.floor(t));
    const a = b.pts[i];
    const c = b.pts[i + 1];
    return { x: a.x + (c.x - a.x) * (t - i), y: a.y + (c.y - a.y) * (t - i) };
  }

  // tap: angetippt. Platzt sie dabei direkt vor seiner Nase, muss er niesen.
  _popBubble(b, tap = false) {
    if (!this._bubs?.delete(b)) return;
    const q = tap && this._g && !this._asleep && !this._inside ? this._bubPos(b) : null;
    b.anim.pause();
    b.el.classList.add('pop');
    setTimeout(() => b.el.remove(), 220);
    if (q && Date.now() - (this._bubSnzAt || 0) > 15000) {
      const n = this._nosePos();
      if (Math.hypot(q.x - n.x, q.y - n.y) < this._g.pH * 0.3) {
        this._bubSnzAt = Date.now();
        setTimeout(() => this._bubSneeze(), 250);
      }
    }
  }

  // Kurzer Nieser nebenher (läuft neben der Aktion, nur Mimik und Tröpfchen)
  _bubSneeze() {
    if (this._asleep || this._inside) return;
    this._cls('sneezing', 450, true);
    this._say(pick(['hatschi!', 'tschi!']), 1000);
    this._snzFx();
    setTimeout(() => (this._cls('eflap-l', 950, true), this._cls('eflap-r', 950, true)), 450);
  }

  // Einer tief hängenden Blase hinterher und hochspringen: plopp! Gezielt wird dorthin, wo sie bei der Ankunft
  // ist; ist sie dann doch woanders, geht der Sprung daneben.
  async _chaseBubble() {
    const { pH, pW, gy } = this._g;
    const v = pW * 0.85 * 1.5; // px/s wie _walkTo mit speed 1,5
    const low = (q) => q.y > gy - pH * 1.5 && q.y < gy - pH * 0.5;
    let best = null;
    for (const b of this._bubs || []) {
      // Ankunftszeit zweimal genähert: erst zur jetzigen Stelle, dann zur vorhergesagten
      let q = this._bubPos(b);
      q = this._bubPos(b, (Math.abs(q.x - this._x) / v) * 1000 + 260);
      q = this._bubPos(b, (Math.abs(q.x - this._x) / v) * 1000 + 260);
      if (low(q) && (!best || Math.abs(q.x - this._x) < Math.abs(best.x - this._x))) best = { b, x: q.x };
    }
    if (!best) return;
    await this._walkTo(best.x, 1.5);
    this._jump('hop1');
    await this._wait(260);
    const q = this._bubs.has(best.b) ? this._bubPos(best.b) : null;
    if (q && Math.abs(q.x - this._x) < pW * 0.6 && low(q)) {
      this._popBubble(best.b);
      this._say(pick(['plopp!', 'hab dich!', 'hihi']), 1000);
    } else this._say(pick(['och…', 'daneben!', 'huch']), 1000);
    await this._wait(800);
    this._face(this._windDir || this._dir);
  }

  // ---------- Frühsport ----------

  // Mit Stirnband: drei oder vier Übungen (Hampelmann, Kniebeugen, Laufen auf der Stelle, Strecken), er zählt mit,
  // schwitzt und ist am Ende stolz. Einmal am Morgen. Ablauf und Takt aus sportPlan: Alle Geräte zählen gleich.
  async _sport() {
    const S = this._slotFor('sport');
    const plan = sportPlan(S.r);
    const late = this._jumpIn(S);
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('sport');
    if (!late) this._say(pick(['Frühsport!', 'Auf geht’s!', 'Fit bleiben!']), 1500);
    await this._at(S.start + ACT_WALK + SPORT_INTRO);
    for (const seg of plan.segs) {
      const t0 = S.start + seg.t;
      const t1 = t0 + seg.len;
      if (this._planNow() >= t1 + SPORT_PAUSE - 500) continue; // diese Übung ist schon vorbei
      if (this._planNow() < t1) {
        if (seg.ex === 'jjack' || seg.ex === 'knee') {
          // Dieselbe Periode wie beim Zählen (seg.rep, auf die Mikrosekunde): Auf 10 ms gerundet lief die Animation
          // dem Zähler über 16 Wiederholungen bis zu 80 ms davon und hörte in der Luft auf
          if (seg.ex === 'jjack') p.style.setProperty('--jj', `${seg.rep.toFixed(3)}ms`);
          // Mitten in der Übung eingestiegen: Die Animation beginnt im Takt der Planzeit (--jd), sonst spränge er
          // neben den gezählten Zahlen her und hörte mitten in der Luft auf
          p.style.setProperty('--jd', `${(-(Math.max(0, this._planNow() - t0) % seg.rep) / 1000).toFixed(3)}s`);
          p.classList.add(seg.ex);
          for (let i = Math.max(1, Math.ceil((this._planNow() - t0) / seg.rep)); i <= seg.reps; i++) {
            await this._at(t0 + i * seg.rep);
            this._say(`${i}!`, seg.ex === 'jjack' ? seg.rep * 0.8 : 800);
          }
          p.classList.remove(seg.ex);
        } else if (seg.ex === 'jog') {
          // Laufen auf der Stelle dauert ganze Hopser ab jetzt (wie jeder Weg, hopRound): Er hört am Boden auf statt
          // irgendwo im Hopser. Das Ende gibt dafür bis zu einem halben Hopser nach, die Pause danach fängt es auf;
          // der Plan (seg.len) bleibt, wie er ist.
          const jEnd = Date.now() + hopRound(t1 - this._planNow(), HOP_MS.hop);
          p.classList.add('walking');
          while (Date.now() < jEnd) {
            await this._wait(Math.max(0, Math.min(rnd(1200, 2000), jEnd - Date.now())));
            if (Date.now() < jEnd && Math.random() < 0.5) this._face(-this._dir);
          }
          p.classList.remove('walking');
        } else {
          for (let i = 0; i < 2; i++) {
            p.classList.add('stretch');
            await this._wait(1300);
            p.classList.remove('stretch');
            await this._wait(300);
          }
          this._say('aaah!', 1000);
        }
      }
      await this._wait(500);
      this._sweat();
      if (Math.random() < 0.6) this._say(pick(['puh!', 'uff', 'weiter!', 'hechel']), 900);
      await this._at(t1 + SPORT_PAUSE);
    }
    // Schweiß abwischen, stolz
    p.classList.add('groom');
    await this._wait(1200);
    p.classList.remove('groom');
    this._happy(1400);
    this._say(pick(['Geschafft!', 'Stark!', 'Fit! ♥']), 1500);
    this._jump('binky');
    await this._wait(1500);
    await this._propOff('sport');
    await this._wait(100);
  }

  _sweat() {
    for (let i = 0; i < 2; i++) {
      const o = this._svgPt(rnd(78, 104), rnd(28, 34));
      const s = document.createElement('span');
      s.className = 'sweat';
      s.innerHTML = DROP_SVG;
      s.style.left = `${o.x.toFixed(1)}px`;
      s.style.top = `${o.y.toFixed(1)}px`;
      s.style.setProperty('--dx', `${((i ? 1 : -1) * rnd(4, 12)).toFixed(1)}px`);
      s.style.animationDelay = `${i * 200}ms`;
      this._el.fx.appendChild(s);
      setTimeout(() => s.remove(), 1300 + i * 200);
    }
  }

  // ---------- Seilspringen ----------

  // Zählt mit, wird manchmal schneller oder springt doppelt durch; verheddert er sich, ist Schluss. Seil und
  // Sprung laufen über dieselbe Dauer --rp; bei jedem Wechsel starten beide neu (das Seil ist dann gerade oben).
  // Wie viele Sprünge, ob schneller, doppelt oder verheddert, steht mit dem Fenster fest.
  async _rope() {
    const S = this._slotFor('rope');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    let rp = 0.62 + S.r(4) * 0.1;
    // Zähler und Animation laufen auf derselben Uhr: t0 ist der Augenblick, in dem die Animation (neu) beginnt, der
    // n-te Sprung seitdem landet bei t0 + n · rp. Gewartet wird bis zu diesem Augenblick, nicht jedes Mal rp nach
    // dem letzten Aufwachen: Sonst sammelten sich die Verspätungen der Zeitgeber, bis er neben den Sprüngen zählte.
    let t0 = 0;
    let n = 0;
    const go = (dbl) => {
      p.classList.remove('roping', 'rdbl');
      p.style.setProperty('--rp', `${rp.toFixed(3)}s`);
      void p.offsetWidth;
      p.classList.add('roping');
      if (dbl) p.classList.add('rdbl');
      t0 = Date.now();
      n = 0;
    };
    const land = (k = 1) => {
      n += k;
      return this._wait(Math.max(0, t0 + n * rp * 1000 - Date.now()));
    };
    this._propOn('rope-hold');
    // Alle Geräte beginnen zur selben Planzeit (wer früh am Platz ist, hält das Seil so lange bereit)
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    await this._wait(600);
    go(false);
    const total = ropeJumps(S.r);
    const trip = S.r(6) < 0.3 ? 6 + Math.floor(S.r(7) * (total - 6)) : -1;
    let i = 0;
    while (i < total) {
      await land();
      i++;
      if (i === trip) break;
      if (i % 2 === 0 || i > total - 3) this._say(`${i}!`, Math.min(900, rp * 1600));
      if (i === 8 && S.r(8) < 0.5) {
        rp *= 0.8;
        go(false);
        this._say('schneller!', 900);
      } else if (i === 14 && S.r(9) < 0.45) {
        go(true);
        this._say('doppelt!', 1000);
        await land(2);
        i += 2;
        go(false);
      }
    }
    // Die Schleife endet mit einer Landung: Er steht am Boden, wenn das Seil ruht
    p.classList.remove('roping', 'rdbl');
    if (i === trip) {
      p.classList.add('meh');
      this._say(pick(['hoppla!', 'uups', 'verheddert!']), 1300);
      await this._wait(1600);
      p.classList.remove('meh');
    } else {
      this._happy(1200);
      this._say(S.r(11) < 0.3 ? 'Rekord!' : `${i}! ♥`, 1400);
      await this._wait(1300);
    }
    await this._propOff('rope-hold');
    await this._wait(100);
  }

  // ---------- Gewichtheben ----------

  // Pusteblumen-Hantel: in die Hocke, „hnnngh!“, über den Kopf, zittern. Meist klappt es (stolz), manchmal
  // plumpst sie herunter. Oben fliegen gern ein paar Schirmchen davon. Wiederholungen und Ausgang stehen fest.
  async _weights() {
    const S = this._slotFor('weights');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('lifting', 'lift-gnd');
    await this._wait(600);
    const reps = 1 + Math.floor(S.r(1) * 3);
    for (let r = 0; r < reps; r++) {
      p.classList.add('crouch');
      this._say(pick(['hnnn …', 'konzentrieren …', 'auf drei …']), 1100);
      await this._wait(rnd(900, 1400));
      p.classList.add('strain');
      p.classList.remove('lift-gnd');
      await this._wait(700);
      p.classList.remove('crouch');
      this._say('hnnngh!', 1200);
      await this._wait(rnd(500, 1000));
      p.classList.add('lift-hi');
      if (S.r(10 + r) < 0.22) {
        // zu schwer: plumps
        await this._wait(450);
        p.classList.remove('lift-hi', 'strain');
        p.classList.add('lift-gnd');
        this._say('uff!', 1000);
        p.classList.add('meh');
        this._mimik('sad', 1600);
        await this._wait(1600);
        p.classList.remove('meh');
        continue;
      }
      await this._wait(900);
      if (S.r(20 + r) < 0.5) this._seeds();
      await this._wait(rnd(1200, 2200));
      p.classList.remove('strain');
      this._say(pick(['Ta-da!', 'Stark!', 'Muskeln!']), 1300);
      this._mimik('proud', 1700);
      this._hearts(2);
      await this._wait(1300);
      p.classList.remove('lift-hi');
      await this._wait(600);
      p.classList.add('lift-gnd');
      await this._wait(800);
    }
    p.classList.remove('lift-hi', 'strain', 'crouch');
    await this._propOff('lifting', 'lift-gnd');
    await this._wait(100);
  }

  // Schirmchen fliegen von den Pusteblumen der Hantel (oben über dem Kopf) mit dem Wind davon; at: stattdessen von
  // diesem Punkt der Pika-Grafik (Pusteblume in der Pfote), n Stück, ohne Ausruf
  _seeds(at = null, n = 2 + Math.floor(rnd(0, 4))) {
    const kd = this._windDir || this._dir;
    for (let i = 0; i < n; i++) {
      const o = at ? this._svgPt(at[0] + rnd(-3, 3), at[1] + rnd(-4, 4)) : this._svgPt(pick([67, 115]) + rnd(-4, 4), 11 + rnd(-4, 4));
      const s = document.createElement('span');
      s.className = 'seed';
      s.innerHTML = SEED_SVG;
      s.style.left = `${o.x.toFixed(1)}px`;
      s.style.top = `${o.y.toFixed(1)}px`;
      s.style.setProperty('--dx', `${(kd * rnd(0.15, 0.45) * this._W).toFixed(1)}px`);
      s.style.setProperty('--rt', `${rnd(-40, 40).toFixed(0)}deg`);
      s.style.animationDelay = `${i * 150}ms`;
      this._el.fx.appendChild(s);
      setTimeout(() => s.remove(), 3600 + i * 150);
    }
    if (!at) this._say(pick(['oh!', 'huch!']), 900);
  }
}
