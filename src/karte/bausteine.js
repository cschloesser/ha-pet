// Bausteine: laufen, stellen, schauen, fressen, springen, sprechen, Herzchen, Mimik, Zeichen über dem Kopf,
// Schriftzug, Funkeln

import { rnd, pick, clamp, hasKey } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { LANE_DY, LANE_S } from '../logik/einstellungen.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import { FRIEND_SCALE } from '../logik/besucher.js';
import { MIMIK, MIMIK_CLS } from '../logik/interaktion.js';
import { HOP_MS, hopRound, EAR_SWING, jumpBusy } from '../logik/beschaeftigungen.js';
import { ICON_HEART, STAR } from '../grafik/szene.js';
import { EMOTE } from '../grafik/momente.js';

export class Bausteine {
  // lane (Prototyp Tiefe): 1 = hintere Spur. Alle anderen Wege führen auf die vordere Spur zurück.
  // back: rückwärts, er dreht sich nicht in Laufrichtung (ein paar Schritte vom Bild zurücktreten)
  async _walkTo(x, speed = 1, steady = false, lane = 0, back = false) {
    const { pW, xR } = this._g;
    x = clamp(x, pW * 0.45, xR);
    const dx = x - this._x;
    lane = this._cfg.depth ? lane : 0;
    const vor = this._lane || 0;
    const dl = lane !== vor;
    if (Math.abs(dx) < 4 && !dl) return;
    if (Math.abs(dx) >= 4 && !back) this._face(dx > 0 ? 1 : -1);
    // Der Spurwechsel zählt wie ein kurzes Stück Weg
    const dist = Math.max(Math.abs(dx), dl ? pW * 0.6 : 0);
    const p = this._el.pika;
    // Gangart: kurze Wege trippelt er, eilig macht er große Hopser
    const gait = dist < pW * 0.8 && speed <= 1.2 ? 'trip' : speed >= 1.8 ? 'bighop' : null;
    // Der Weg dauert ganze Hopser (das Tempo gibt dafür ein wenig nach): Er kommt am Boden an statt mitten im Sprung
    const dur = hopRound((dist / (pW * 0.85 * speed)) * 1000, HOP_MS[gait || 'hop']) / 1000;
    // Beim Herumhoppeln stolpert er selten über die eigenen Füße
    const stumble = !steady && !dl && this._action === 'wander' && Math.abs(dx) > pW * 1.5 && Math.random() < 0.05;
    p.style.transition = `transform ${dur.toFixed(2)}s linear`;
    this._lane = lane;
    this._setX(x);
    // Ebene (Bühne) erst auf halbem Weg wechseln: bis dahin steht er noch auf der alten Spur
    if (dl) {
      this._pikaZ(vor);
      this._laneZT = setTimeout(() => this._pikaZ(), dur * 500);
    }
    p.classList.add('walking');
    if (gait) p.classList.add(gait);
    try {
      if (stumble) {
        await this._wait(dur * 550);
        this._freeze();
        p.classList.remove('walking');
        p.classList.add('stumble');
        this._emote('drop', 1400);
        await this._wait(750);
        p.classList.remove('stumble');
        this._say('hoppla!', 900);
        this._blush(1500);
        await this._wait(500);
        return await this._walkTo(x, speed, true, lane);
      }
      await this._wait(dur * 1000);
    } finally {
      if (gait) p.classList.remove(gait);
    }
    p.classList.remove('walking');
    this._cls('lnd', 600, true);
  }

  async _approach(x, speed) {
    const dir = Math.abs(x - this._x) < 2 ? this._dir : Math.sign(x - this._x);
    await this._walkTo(x - dir * this._g.pW * 0.36, speed);
    this._face(x >= this._x ? 1 : -1);
  }

  // svg: Grafik des Futters (24 × 24), wenn es keine Blüte ist
  async _eat(color, ms, svg = null) {
    const p = this._el.pika;
    const m = this._el.mfood;
    this._mouth(color, svg);
    p.style.setProperty('--eat', `${ms}ms`);
    m.classList.remove('shrink');
    void m.getBoundingClientRect();
    m.classList.add('shrink');
    p.classList.add('eating');
    await this._wait(ms);
    p.classList.remove('eating');
    this._mouth(null);
  }

  _setX(x, instant) {
    const p = this._el.pika;
    this._x = x;
    if (instant) p.style.transition = 'none';
    // Auf dem Stein (weiter hinten) etwas kleiner, Ursprung sind die Füße. Prototyp Tiefe: auf der
    // hinteren Spur höher und kleiner
    const ly = this._laneDy();
    // Beim Mitfahren mit depth steht er vorn auf dem Roboter (_reiter): nicht weiter hinten, also nicht kleiner
    const s = (this._lift > 0 && !this._reiter ? 0.9 : 1) * (ly ? LANE_S : 1);
    p.style.transform = `translate(${(x - this._g.pW / 2).toFixed(1)}px, ${(-this._lift - ly).toFixed(1)}px)`
      + (s !== 1 ? ` scale(${s.toFixed(3)})` : '');
    // Die Sprech-Ebene läuft mit: gleiche Überblendung (gesetzt in _walkTo, _hopTo oder hier), gleiches Ziel
    const t = this._el.psay.style;
    t.transition = p.style.transition;
    t.transform = p.style.transform;
    p.classList.toggle('lane1', !!ly);
    clearTimeout(this._laneZT);
    this._pikaZ();
    // Kulisse folgt dem Pika ein wenig (-1 links … 1 rechts), die Übergänge macht das CSS
    if (this._cfg.depth && this._W) this._el.scene.style.setProperty('--plx', clamp(x / this._W * 2 - 1, -1, 1).toFixed(3));
    if (instant) void p.offsetWidth;
    this._bubbleRefit();
  }

  // Tiefe (depth): Bereich der hinteren Spur für eine Figur der Breite w (px, Mitte der Figur). Sie führt über die
  // ganze Wiese, hinter Heu und Stein vorbei (beide stehen davor, siehe REIHE): von der Mitte des Heuhaufens bzw.
  // rechts neben der Nische bis an den rechten Rand. Links davon steht der Bau (er liegt hinter der Spur, seine
  // Tür auf der Bodenlinie: Wer hinten an ihm vorbeiginge, stünde in der Wand).
  _laneRange(w = this._g.pW) {
    const g = this._g;
    const l = g.stash ? g.hayR + w * 0.3 : g.hay;
    return [l, Math.max(l, this._W - w * 0.45)];
  }

  // Bühne: Ebene des Pikas aus seinem Fußpunkt (lane: die Spur, sonst die jetzige). Im Bau zählt der Eingang (Rang
  // pikaBau, vor den Vögeln, hinter Pino). Auf dem Stein, im Sprung und beim Mitfahren zählt der Fußpunkt, von dem er
  // abgesprungen ist: Hochspringen geht nur von der vorderen Spur (_hopTo), die Höhe (_lift) zählt nicht. Ausnahme
  // mit depth: Auf dem Saugroboter (_reiter, _sigRide) steht er vorn auf dem vorderen Wiesenstreifen, vor allem.
  _pikaZ(lane = this._lane) {
    const p = this._el.pika;
    const hinten = this._cfg.depth && lane && !(this._lift > 0) ? LANE_DY : 0;
    p.style.zIndex = String(p.classList.contains('inside') ? buehneZ(0, 'pikaBau')
      : this._reiter ? buehneZ(REIHE.rand, 'reiter') : buehneZ(-hinten, 'pika'));
  }

  // y für den Anteil f der Größeneinheit, gemessen ab der Oberkante der Bühne (die unteren H px der Karte): für
  // alles in der Luft, das zum Pika gehört (Drachen, Ballon, Funkeln am Himmel). Auf normalen Karten H · f.
  _sy(f) {
    return this._Hs - this._H + this._H * f;
  }

  // Prototyp Tiefe (depth: true): Höhe der hinteren Spur über der Bodenlinie, sonst 0
  _laneDy() {
    return this._cfg.depth && this._lane && !(this._lift > 0) ? this._H * LANE_DY : 0;
  }

  // Wo der Pika gerade wirklich steht. Beim Laufen ist this._x schon das Ziel, die CSS-Transition
  // bewegt ihn erst noch dorthin.
  _liveX() {
    const t = getComputedStyle(this._el.pika).transform;
    return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 + this._g.pW / 2 : this._x;
  }

  _liveLift() {
    const t = getComputedStyle(this._el.pika).transform;
    return t && t !== 'none' ? -new DOMMatrixReadOnly(t).m42 : this._lift;
  }

  _freeze() {
    const x = this._liveX();
    const e = this._liveLift();
    // Mitten im Spurwechsel: auf der Spur bleiben, der er schon näher ist
    if (this._cfg.depth && !(this._lift > 0)) this._lane = e > this._H * LANE_DY / 2 ? 1 : 0;
    this._lift = Math.max(0, e - this._laneDy());
    this._setX(x, true);
  }

  _face(dir) {
    this._dir = dir;
    this._el.pika.classList.toggle('left', dir < 0);
    this._bubbleRefit(); // der Anker wechselt die Seite
  }

  // Was er im Maul hat: eine Blüte in color, oder mit svg (24 × 24) genau dieses Futter. null: nichts mehr.
  _mouth(color, svg = null) {
    const m = this._el.mfood;
    if (!color) return m.classList.remove('shrink');
    this._el.pika.style.setProperty('--mf', color);
    const it = m.querySelector('.mf-item');
    if (it && (it._svg || null) !== svg) {
      it._svg = svg;
      it.innerHTML = svg ? svg.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '') : '';
    }
    m.classList.toggle('item', !!svg && !!it);
  }

  // fresh: der Sprung trägt ihn woandershin (_hopTo), er beginnt in jedem Fall neu
  _jump(kind, fresh = false) {
    if (kind === 'binky' && calmMotion()) kind = 'hop1'; // Bewegung reduzieren: ruhiger Hüpfer statt Luftsprung
    // Noch in der Luft vom letzten Sprung (schnelle Tipps, Schreck beim Blitz): den zu Ende springen. Ein neuer
    // finge am Boden an, er schnappte aus der Luft herunter.
    const J = this._jumpOn;
    if (!fresh && J && jumpBusy(J.kind, Date.now() - J.at)) return;
    this._jumpOn = { kind, at: Date.now() };
    const j = [this._el.jump, this._el.shadow]; // der Schatten macht den Sprung mit (wird kleiner)
    for (const el of j) el.classList.remove('hop1', 'binky');
    void j[0].offsetWidth;
    for (const el of j) el.classList.add(kind);
    clearTimeout(this._jumpT);
    this._jumpT = setTimeout(() => j.forEach((el) => el.classList.remove(kind)), 1000);
    this._earSwing(this._el.pika, kind);
  }

  // Ohren schwingen bei einem Sprung auf der Stelle nach (EAR_SWING), bei Pika und Pino (root: .pika bzw. .friend).
  // Als eigene Animation der Eigenschaft rotate statt über den Stil: Die Drehung kommt zur Haltung der Ohren dazu
  // (hängend bei .sad und .meh, angelegt bei .flat: Sie schwingen um ihre Lage, nicht bis fast senkrecht hoch), und
  // sie nimmt keiner Ohr-Regel den Platz (Flappen beim Antippen, Zucken, Wippen beim Seilspringen, Verbeugung;
  // als Regel am Sprung schlug sie alle und wurde beim Fangen auf 0,21 s gekürzt). Nicht mitten im Hoppeln (da
  // wippen die Ohren schon) und nicht mit „Bewegung reduzieren“. Ein Browser ohne rotate lässt es einfach weg.
  _earSwing(root, kind) {
    root._earAn?.forEach((a) => a.cancel());
    root._earAn = null;
    const S = EAR_SWING[kind];
    if (!S || calmMotion() || root.classList.contains('walking')) return;
    const frames = [{ rotate: '0deg', easing: 'ease-out' },
      ...S.k.map(([offset, deg]) => ({ offset, rotate: `${deg}deg`, easing: 'ease-out' })), { rotate: '0deg' }];
    root._earAn = [...root.querySelectorAll('.ear-l, .ear-r')].map((ear) =>
      ear.animate?.(frames, { duration: S.ms, delay: ear.classList.contains('ear-r') ? 50 : 0 })).filter(Boolean);
  }

  _happy(ms = 1200) {
    const p = this._el.pika;
    p.classList.add('happy');
    clearTimeout(this._happyT);
    this._happyT = setTimeout(() => p.classList.remove('happy'), ms);
    this._hearts(3);
  }

  // loud: auch dem Bildschirmleser ansagen (sparsam, siehe _announce)
  _say(text, ms = 1400, loud = false) {
    if (loud) this._announce(text);
    this._el.say.textContent = text;
    this._bubble(this._el.say, true);
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => this._bubble(this._el.say, false), ms);
  }

  // Höchstens alle 20 s etwas in die aria-live-Region, damit der Bildschirmleser nicht dauernd plappert
  _announce(text) {
    const now = Date.now();
    if (!this._el.sr || now - (this._srAt || 0) < 20000) return;
    this._srAt = now;
    this._el.sr.textContent = `${this._cfg?.name || 'Pika'}: ${text}`;
  }

  _bubble(el, on) {
    el.classList.toggle('on', on);
    if (!on) return;
    // Am Kartenrand ins Bild schieben: der Pika (auf dem Stein 0,9 groß um die Füße) bzw. Pino an seinem Ziel
    const fr = this._fr?.say === el ? this._fr : null;
    if (fr) this._bubbleFit(el, fr.x, this._g.pW * FRIEND_SCALE);
    else if (el.parentElement === this._el.anchor) this._bubbleFit(el, this._x, this._g?.pW, this._lift > 0 ? 0.9 : 1);
  }

  // Blase el so verschieben (--bx), dass sie 4 px vom Rand bleibt. cx: Mitte der Hülle (Ziel, beim Laufen schon dort),
  // w0: deren Breite, s: Verkleinerung um die Mitte. Gemessen wird nur, wenn sie gerade zu sehen ist.
  _bubbleFit(el, cx, w0, s = 1) {
    if (!this._g || !el.classList.contains('on')) return;
    const w = el.offsetWidth;
    const ax = cx + (el.parentElement.offsetLeft - w0 / 2) * s;
    const inside = el.parentElement === this._el.anchor && this._el.pika.classList.contains('inside');
    const L = ax - w * (inside ? 0.06 : 0.35);
    // Auf gleicher Höhe wie Futter- oder Päckchen-Knopf: links davon bleiben, sonst verdeckt der Knopf die Blase
    let R = this._W - 4;
    const sr = this._el.scene.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    for (const b of [this._el.feed, this._el.gbtn]) {
      const r = b?.getBoundingClientRect();
      if (r?.width && er.bottom > r.top && er.top < r.bottom) R = Math.min(R, r.left - sr.left - 4);
    }
    const bx = L < 4 ? 4 - L : L + w > R ? Math.max(4 - L, R - (L + w)) : 0;
    el.style.setProperty('--bx', `${bx.toFixed(1)}px`);
  }

  // Sprech- und Denkblase des Pikas neu einpassen (nach Drehen, Laufen, Bau)
  _bubbleRefit() {
    if (!this._g) return;
    const s = this._lift > 0 ? 0.9 : 1;
    for (const el of [this._el.say, this._el.think]) this._bubbleFit(el, this._x, this._g.pW, s);
  }

  _hearts(n) {
    const { pW, pH, gy, hole } = this._g;
    let x = this._liveX() + this._dir * pW * 0.25;
    let y = gy - pH * 0.945 + pH * 0.25 - this._liveLift();
    if (this._inside) {
      x = hole.cx;
      y = hole.top + (hole.lip - hole.top) * 0.2;
    }
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.innerHTML = ICON_HEART;
      h.style.left = `${x + rnd(-pW * 0.12, pW * 0.12)}px`;
      h.style.top = `${y}px`;
      h.style.setProperty('--dx', `${rnd(-pW * 0.3, pW * 0.3)}px`);
      h.style.animationDelay = `${i * 110}ms`;
      this._el.fx.appendChild(h);
      setTimeout(() => h.remove(), 1700 + i * 110);
    }
  }

  _blink() {
    const p = this._el.pika;
    if (this._asleep) return;
    p.classList.add('blink');
    setTimeout(() => p.classList.remove('blink'), 140);
    if (Math.random() < 0.25) {
      setTimeout(() => p.classList.add('blink'), 280);
      setTimeout(() => p.classList.remove('blink'), 420);
    }
  }

  _twitch() {
    if (this._asleep) return;
    const c = pick(['twitch-l', 'twitch-r']);
    const p = this._el.pika;
    p.classList.add(c);
    setTimeout(() => p.classList.remove(c), 550);
  }

  // ---------- Mimik ----------

  // Brauen und Mund für Trauer ('sad'), Trotz ('defy'), Stolz ('proud') und Staunen ('awe'); null nimmt sie zurück.
  // ms: so lange, sonst bis zum Ende der Aktion (_cleanup). Die Teile sitzen im Gesicht (.face): Sie wandern mit dem
  // Blick und der Spiegelung mit und fehlen in der Rückansicht. Im Schlaf, beim Fressen, Gähnen, Pfeifen und Trinken
  // blendet das CSS sie aus.
  _mimik(name, ms = 0) {
    const p = this._el?.pika;
    if (!p) return;
    clearTimeout(this._mimT);
    const d = name && hasKey(MIMIK, name) ? MIMIK[name] : null;
    if (this._mim || d) p.classList.remove('mi', ...MIMIK_CLS);
    this._mim = d ? name : null;
    if (!d) return;
    (this._el.mim ??= p.querySelector('.mim'))?.setAttribute('d', d);
    p.classList.add('mi', `mi-${name}`);
    if (ms > 0) this._mimT = setTimeout(() => this._mimik(null), ms);
  }

  // Zustandsklasse c für ms Millisekunden (eigener Zeitgeber je Klasse; restart spielt die Animation neu ab)
  _cls(c, ms, restart) {
    const p = this._el.pika;
    if (restart && p.classList.contains(c)) {
      p.classList.remove(c);
      void p.offsetWidth;
    }
    p.classList.add(c);
    const T = (this._clsT ??= {});
    clearTimeout(T[c]);
    T[c] = setTimeout(() => p.classList.remove(c), ms);
  }

  _blush(ms = 1800) {
    if (!this._asleep) this._cls('blush', ms);
  }

  _noseWiggle() {
    if (this._asleep || this._action === 'eatFood' || this._action === 'nod') return;
    this._cls('nosey', 850, true);
  }

  // Kleines Zeichen über dem Kopf: ? ! Schweißtropfen, Funkeln, Grummelwolke
  _emote(kind, ms = 1500) {
    const a = this._el.anchor;
    if (!a) return;
    const el = document.createElement('span');
    el.className = `emo emo-${kind}`;
    el.innerHTML = EMOTE[kind] ?? kind;
    el.style.setProperty('--emt', `${ms}ms`);
    a.appendChild(el);
    setTimeout(() => el.remove(), ms + 60);
  }

  // Wo die Nase gerade ist (Szene-Pixel). Auf dem Stein steht er um 0,9 verkleinert (Ursprung: Füße).
  _nosePos() {
    const { pW, pH, gy } = this._g;
    const lift = this._liveLift();
    const s = lift > 0 ? 0.9 : 1;
    return { x: this._liveX() + this._dir * pW * 0.258 * s, y: gy - lift - pH * 0.43 * s };
  }

  // Kleiner Schriftzug („piep!“, „plopp!“), der aufsteigt und verblasst. Nicht _squeak: das ist die Aktion.
  _peep(x, y, text) {
    const s = document.createElement('span');
    s.className = 'squeak';
    s.textContent = text;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    this._el.fx.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }

  _sparkle(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.innerHTML = `<svg viewBox="0 0 24 24"><path d="${STAR}"/></svg>`;
      s.style.left = `${x + rnd(-8, 8)}px`;
      s.style.top = `${y + rnd(-4, 4)}px`;
      s.style.setProperty('--dx', `${rnd(-12, 12).toFixed(1)}px`);
      s.style.animationDelay = `${i * 120}ms`;
      this._el.fx.appendChild(s);
      setTimeout(() => s.remove(), 1000 + i * 120);
    }
  }
}
