// Album 2: das Radio (key 'radio', t2 = 4), ein kleines Kofferradio mit Antenne. Es steht nicht in der Szene: Ab und
// zu, bei Tag und abends (dunkel, aber noch wach: seltener), nie bei Regen, Schnee aus den Wolken oder Sturm, holt er
// es aus dem Bau, trägt es am Henkel im Maul auf die Wiese und stellt es ab. Er zieht die Antenne aus und dreht am
// Knopf, es rauscht kurz, dann läuft Musik: Der Lautsprecher pumpt, Noten steigen auf, er wippt im Takt, dreht sich um,
// hüpft, singt mit. Danach dreht er es aus, nimmt es wieder ins Maul und bringt es in den Bau zurück.
// Stufe 2 (Trick): Drehtanz, zwei Pirouetten mit „Ta-da!“ und Verbeugung. Stufe 3 (Gold): Jede zweite Note ist golden,
// am Ende fliegt ein Schwarm goldener Noten; ab und zu (GOLD-Abstand) setzt sich ein Vögelchen auf den Henkel und wippt
// mit. Das Vögelchen ist ein eigenes Bild (BIRD_SVG wie beim Besuch), nicht this._bird: Der Besuch nach der Uhr bleibt
// unberührt, und alles bleibt auf diesem Gerät. Sitzt gerade ein Besuchsvögelchen da, zwitschert es mit.
// Tipp aufs Radio, solange es steht: Es rauscht (Bild), der Zeiger springt, ein anderer Sender (Farben der Noten, Takt).
// Ton gibt es keinen: Die Karte spielt nirgends etwas ab, und das bleibt so.
// Reduzierte Bewegung: kein Weg in den Bau (dort hüpft er heraus), kein Wippen, Hüpfen, Drehen. Das Radio blendet neben
// ihm ein und aus, die Noten blenden am Platz ein; beim Drehtanz schaut er nur nach links und rechts und verbeugt sich.

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import { BIRDS, BIRD_SVG } from '../grafik/besucher.js';
import { RADIO_SVG, RADIO_CARRY, RADIO_W, RADIO_H, RADIO_HANDLE, RADIO_SPEAKER, RADIO_SENDER, NOTE_SVG } from '../grafik/album2/radio.js';

// Das Vögelchen auf dem Henkel kommt höchstens alle 3 Minuten und dann zu jedem zweiten Tanz (wie GOLD in
// src/logik/paeckchen.js; der Tanz ist selten genug)
const RADIO_GOLD = { cd: 3 * 6e4, p: 0.5 };
// Ebenen: das Radio auf der vorderen Reihe hinter dem Pika (Rang schatz), das Vögelchen darauf eine Stufe davor
const RADIO_Z = () => buehneZ(REIHE.vorn, 'schatz');
const RADIO_BZ = () => buehneZ(REIHE.vorn, 'vogel');
// Pika-Klassen dieses Schatzes (_cleanup kennt sie nicht, das Aufräumen nimmt sie ab)
const RADIO_CLS = ['a2r-bop', 'a2r-spin'];
// Abstand der Mitte des Radios zu ihm (in pW): beim Tanzen (so verdeckt er es nicht, auch auf schmalen Karten), beim
// Ein- und Ausschalten (die Pfote am Knopf: Stünde er näher, verdeckte sein Kopf das Radio, es steht hinter ihm)
// und beim Abstellen und Aufnehmen (dann hängt es genau unter dem Maul)
const RADIO_FAR = 0.7;
const RADIO_TOUCH = 0.56;
const RADIO_NEAR = 0.28;

export class Album2Radio {
  // ---------- Szene ----------

  // Szene (Hook): Es steht nie dauerhaft. Nur, solange er es benutzt (_a2RadioS), bleibt das Element. Hat sich die
  // Größe der Karte geändert, steht es an alten Pixeln: abbrechen (wie _layout bei Requisiten)
  _a2RadioScene(lv) {
    const S = this._a2RadioS;
    if (S && this._a2RadioBusy && ((S.W !== this._W || S.H !== this._H) || this._a2WxTurned(S))) this._interrupt(); // (neue Größe; Regen setzt ein)
    else if (!S || !(lv > 0)) this._a2RadioEnd();
  }

  // Maße in der Szene (px)
  _a2RadioDim() {
    const w = this._g.pW * RADIO_W;
    return { w, h: this._g.pW * RADIO_H };
  }

  // Wo es steht und wo er tanzt: { px: Mitte des Radios, x: sein Platz, dir: sein Blick zum Radio }. Ein Platz auf der
  // Wiese wie für die Requisiten (_besideSpot: zwischen Vorrat und Stein, neben dem, was dort steht), so breit, dass
  // zwischen ihm und dem Radio RADIO_FAR bleibt
  _a2RadioSpot() {
    const { pW, hayR, xR } = this._g;
    const { w } = this._a2RadioDim();
    // (_besideSpot hält zwischen ihm und der Mitte eines Requisits der Breite q den Abstand q / 2 + 0,45 pW)
    const B = this._besideSpot(Math.random(), Math.random(), (RADIO_FAR - 0.45) * pW * 2);
    // (seit 0.48.1 nicht vor dem, was dort steht: Windrad, Vogelhäuschen, Laterne, Festdeko …; er steht auf der Seite, wo
    // Platz ist)
    const px = this._a2Free(hayR + w * 0.6, xR + pW * 0.3, w, clamp(B.px, hayR + w * 0.6, xR + pW * 0.3), 'radio');
    const far = pW * RADIO_FAR;
    const d = px - B.dir * far >= pW * 0.45 && px - B.dir * far <= xR ? B.dir : -B.dir;
    const x = clamp(px - d * far, pW * 0.45, xR);
    return { px, x, dir: px >= x ? 1 : -1 };
  }

  // Gleich neben ihm (nach dem Auspacken, reduzierte Bewegung): zur Seite mit mehr Platz, RADIO_FAR entfernt, aber nicht
  // vor dem, was dort steht (_a2Free). → Mitte des Radios
  _a2RadioBeside() {
    const { pW, xR } = this._g;
    const d = this._x < this._W / 2 ? 1 : -1;
    return this._a2Free(pW * 0.5, xR + pW * 0.3, this._a2RadioDim().w, clamp(this._x + d * pW * RADIO_FAR, pW * 0.5, xR + pW * 0.3), 'radio');
  }

  // Der Freund sitzt nicht auf dem Radio (_a2FrAside)
  async _a2RadioAside(px) {
    const { w } = this._a2RadioDim();
    await this._a2FrAside(px - w * 0.6, px + w * 0.6);
  }

  // Radio hinstellen (Element aus _a2El: Tippfläche, Licht, golden) mit der Mitte bei px. pop: ploppt auf, sonst blendet
  // es ein (reduzierte Bewegung) oder ist einfach da (aus dem Maul abgestellt: fade = false)
  _a2RadioMake(px, pop = false, fade = false) {
    if (this._a2RadioS) this._a2RadioEnd(true);
    const el = this._a2El('radio', `<div class="a2rw">${RADIO_SVG}</div>`);
    el.classList.remove('a2out', 'on', 'ant', 'knob', 'a2rtune');
    el.style.left = `${px.toFixed(1)}px`;
    el.style.zIndex = String(RADIO_Z());
    el.style.setProperty('--a2rn', '0px');
    const S = { W: this._W, H: this._H, wx0: this._a2WxBad(), el, x: px, st: 0, on: false, gold: false, dance: false, bird: null, t: [] };
    this._a2RadioS = S;
    this._a2Scene(); // (golden: .gilt)
    const w = el.querySelector('.a2rw');
    if (pop && !calmMotion()) {
      w?.classList.add('pop');
      S.t.push(setTimeout(() => w?.classList.remove('pop'), 800));
    } else if ((pop || fade) && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
    return S;
  }

  // Ins Maul nehmen (am Henkel) oder loslassen
  _a2RadioHold(on) {
    this._el.pika.classList.toggle('carry', on);
    this._mouth(on ? '#4fa9a0' : null, on ? RADIO_CARRY : null);
  }

  // Stellen am Radio (Szene-Pixel): Henkel oben, Mitte des Lautsprechers
  _a2RadioAt([fx, fy]) {
    const S = this._a2RadioS;
    const { w, h } = this._a2RadioDim();
    return { x: (S?.x ?? this._x) + (fx - 0.5) * w, y: this._g.gy + 1 - h * (1 - fy) };
  }

  // Schriftzug über dem Radio („krrz…“), über der Antenne, damit er es nicht verdeckt
  _a2RadioPeep(text) {
    const T = this._a2RadioAt(RADIO_HANDLE);
    this._peep(T.x, T.y - this._a2RadioDim().h * 0.55, text);
  }

  // ---------- Was er damit tut ----------

  // Radiowetter: nicht bei Regen, Schnee aus den Wolken, Gewitter oder Sturm (Nebel, Wolken, Schnee am Boden gehen)
  _a2RadioWeather(wx = this._wx || {}) {
    return !wx.wet && !wx.storm && !wx.shelter && !wx.hail && !(wx.snow > 0);
  }

  // Hook: ab und zu bei Radiowetter, bei Tag und in der Dämmerung; ist es schon dunkel (er ist noch wach), seltener.
  // Der Drehtanz ab Stufe 2 etwas seltener als der Tanz
  _a2RadioActs({ wx }, lv) {
    if (!this._a2RadioWeather(wx)) return [];
    // (findet sich kein freier Platz, lieber nicht: _a2Free, das Vogelhäuschen hinten zählt nicht)
    const P = this._a2RadioSpot();
    if (!this._a2Room(P.px, this._a2RadioDim().w, 'radio')) return [];
    const w = 0.3 * (this._el.scene.classList.contains('night') ? 0.5 : 1);
    return [[w, 'a2RadioPlay'], [lv >= 2 ? w * 0.6 : 0, 'a2RadioSpin']];
  }

  // Stufe 1 (Aktion 'a2RadioPlay'). o: { short: nach dem Auspacken (das Radio kommt gleich neben ihm, kein Weg in den
  // Bau), gold: goldene Noten sicher, bird: das Vögelchen kommt sicher }
  async _a2RadioPlay(o = {}) {
    return this._a2RadioGo('dance', o);
  }

  // Stufe 2, der Trick (Aktion 'a2RadioSpin')
  async _a2RadioSpin(o = {}) {
    if (this._a2Lv('radio') < 2) return;
    return this._a2RadioGo('spin', o);
  }

  async _a2RadioGo(mode, o) {
    const lv = this._a2Lv('radio');
    if (!lv || (!this._a2RadioWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('radio'));
    // (nachts kommt kein Vögelchen, auch nicht erzwungen; vor _a2GoldOk geprüft, das den Abstand stempelt)
    const night = this._el.scene.classList.contains('night');
    const bird = !night && (!!o.bird || (lv >= 3 && this._a2GoldOk('radio', RADIO_GOLD, 'radio-bird')));
    this._a2RadioBusy = true;
    try {
      if (calmMotion()) await this._a2RadioCalm(mode, gold, bird, o);
      else await this._a2RadioMove(mode, gold, bird, o);
    } finally {
      this._a2RadioBusy = false;
      this._a2RadioEnd(true);
    }
  }

  // Mit Bewegung: holen, hinstellen, einschalten, zurücktreten, tanzen, ausschalten, wegbringen
  async _a2RadioMove(mode, gold, bird, o) {
    const { pW } = this._g;
    let P;
    if (o.short) {
      // gleich hier: Es ploppt neben ihm auf (zur Seite mit mehr Platz), er tritt einen Schritt heran
      const px = this._a2RadioBeside();
      const d = px >= this._x ? 1 : -1;
      P = { px, x: this._x, dir: d };
      await this._a2RadioAside(px);
      this._face(d);
      this._a2RadioMake(px, true);
      await this._wait(700);
      await this._walkTo(px - d * pW * RADIO_TOUCH, 0.8);
    } else {
      await this._a2RadioFetch();
      P = this._a2RadioSpot(); // (erst jetzt: Hat sich die Karte währenddessen verändert, gilt der neue Platz)
      await this._a2RadioAside(P.px);
      await this._walkTo(P.px - P.dir * pW * RADIO_NEAR, 0.9);
      this._face(P.dir);
      await this._wait(200);
      const p = this._el.pika;
      p.classList.add('crouch');
      await this._wait(320);
      this._a2RadioHold(false);
      this._a2RadioMake(P.px);
      p.classList.remove('crouch');
      await this._wait(250);
      await this._walkTo(P.px - P.dir * pW * RADIO_TOUCH, 0.6, true, 0, true);
    }
    this._face(P.dir);
    await this._a2RadioOn(gold);
    // ein paar Schritte zurück (ohne sich umzudrehen), sonst verdeckte er es
    await this._walkTo(P.px - P.dir * pW * RADIO_FAR, 0.8, true, 0, true);
    this._face(P.dir);
    if (bird) this._a2RadioBird();
    await this._a2RadioDance(mode, gold, o);
    // aus: hin, Musik aus, Antenne ein
    await this._walkTo(P.px - P.dir * pW * RADIO_TOUCH, 0.8);
    this._face(P.dir);
    await this._a2RadioOff();
    if (o.short) return;
    // wegbringen: ins Maul und zurück in den Bau
    await this._walkTo(P.px - P.dir * pW * RADIO_NEAR, 0.6);
    this._face(P.dir);
    const p = this._el.pika;
    p.classList.add('crouch');
    await this._wait(320);
    p.classList.remove('crouch');
    this._a2RadioEnd(true, true);
    this._a2RadioHold(true);
    await this._wait(250);
    await this._enterBurrow(0.9);
    this._a2RadioHold(false);
    await this._wait(rnd(500, 900));
    await this._comeOut();
  }

  // Aus dem Bau holen: Er kramt drinnen und kommt mit dem Radio im Maul heraus
  async _a2RadioFetch() {
    await this._enterBurrow(1);
    const { home, hole } = this._g;
    this._peep(home, hole.top, pick(['kram, kram…', 'wo ist es…', 'raschel…']));
    await this._wait(rnd(800, 1200));
    this._a2RadioHold(true);
    await this._comeOut();
  }

  // Einschalten (er steht dicht davor): Antenne ausziehen, am Knopf drehen, es rauscht, dann Musik
  async _a2RadioOn(gold) {
    const S = this._a2RadioS;
    if (!S) return;
    const p = this._el.pika;
    const el = S.el;
    p.classList.add('crouch');
    await this._wait(260);
    el.classList.add('ant');
    this._a2RadioPeep(pick(['zieh!', 'Antenne!']));
    await this._wait(450);
    el.classList.add('knob', 'a2rtune');
    this._a2RadioPeep(pick(['krrz…', 'kschhh…', 'krrrk…']));
    await this._wait(800);
    el.classList.remove('a2rtune');
    p.classList.remove('crouch');
    S.on = true;
    S.gold = gold;
    el.classList.add('on');
    el.style.setProperty('--a2rbt', `${RADIO_SENDER[S.st].beat * 2}ms`);
    this._a2RadioNote(gold);
    this._say(pick(RADIO_SENDER[S.st].say), 1300);
    p.classList.add('happy');
    await this._wait(600);
    p.classList.remove('happy');
  }

  // Ausschalten (er steht dicht davor): Knopf zurück, Musik aus, Antenne ein
  async _a2RadioOff() {
    const S = this._a2RadioS;
    if (!S) return;
    const p = this._el.pika;
    p.classList.add('crouch');
    await this._wait(260);
    S.on = false;
    S.el.classList.remove('on', 'knob');
    this._a2RadioBirdGo();
    await this._wait(300);
    S.el.classList.remove('ant');
    p.classList.remove('crouch');
    this._say(pick(['schön war\'s!', 'Musik aus!', '♪ ♥']), 1200);
    await this._wait(700);
  }

  // Tanzen im Takt des Senders (Wippen über .a2r-bop, ein Wippen je Schlag), mit Umdrehen, Hüpfern und Mitsingen.
  // spin: in der Mitte der Drehtanz. Am Ende golden ein Schwarm goldener Noten.
  async _a2RadioDance(mode, gold, o) {
    const S = this._a2RadioS;
    if (!S) return;
    const p = this._el.pika;
    S.dance = true;
    p.style.setProperty('--a2rbt', `${RADIO_SENDER[S.st].beat * 2}ms`);
    p.classList.add('a2r-bop');
    const d0 = this._dir;
    await this._a2RadioBeats(o.short ? 4 : 6, (i) => {
      if (i === 3) this._jump('hop1');
    });
    if (mode === 'spin') {
      await this._a2RadioPirouette();
      p.classList.add('a2r-bop');
      await this._a2RadioBeats(4);
    } else {
      this._face(-d0);
      await this._a2RadioBeats(o.short ? 2 : 4, (i) => {
        if (i === 1) this._jump('hop1');
      });
      this._face(d0);
    }
    if (!o.short) {
      p.classList.add('sing');
      this._say(pick(['la-la-la ♪', '♪ dum-di-dum ♪', 'tralala!', '♪ mip-mip ♪']), 1800);
      if (this._bird?.sitting) this._tweet(this._bird);
      await this._a2RadioBeats(4);
      p.classList.remove('sing');
      await this._a2RadioBeats(2, (i) => {
        if (i === 0) this._jump('hop1');
      });
    }
    p.classList.remove('a2r-bop');
    if (gold) this._a2RadioGoldBurst();
    this._happy(1200);
    S.dance = false;
    await this._wait(900);
  }

  // n Schläge: Jeden zweiten steigt eine Note auf (golden: jede vierte golden), fn(i) zu jedem Schlag. Gezählt, nicht
  // nach der Uhr (ein Tipp kann den Sender und damit den Takt wechseln)
  async _a2RadioBeats(n, fn = null) {
    for (let i = 0; i < n; i++) {
      const S = this._a2RadioS;
      if (!S) return;
      if (i % 2 === 0) this._a2RadioNote(S.gold && (S.nt = (S.nt || 0) + 1) % 2 === 0);
      fn?.(i);
      await this._wait(RADIO_SENDER[S.st].beat);
    }
  }

  // Der Drehtanz: in die Knie, zwei Pirouetten (die zweite schneller), Glitzer, „Ta-da!“, Verbeugung
  async _a2RadioPirouette() {
    const p = this._el.pika;
    p.classList.remove('a2r-bop');
    this._say(pick(['Drehtanz!', 'und… dreh!', 'Pirouette!']), 1300);
    p.classList.add('crouch');
    await this._wait(300);
    p.classList.remove('crouch');
    for (const ms of [900, 700]) {
      p.style.setProperty('--a2rsp', `${ms}ms`);
      p.classList.remove('a2r-spin');
      void p.offsetWidth;
      p.classList.add('a2r-spin');
      this._a2RadioNote(this._a2RadioS?.gold);
      await this._wait(ms);
    }
    p.classList.remove('a2r-spin');
    const { pH, gy } = this._g;
    this._sparkle(this._x, gy - pH * 0.6, 3);
    this._say(pick(['Ta-da!', 'tadaa!', 'hui!']), 1200);
    p.classList.add('bowing');
    await this._wait(1600);
    p.classList.remove('bowing');
  }

  // Reduzierte Bewegung: hingehen, das Radio blendet neben ihm ein, es rauscht, Musik (Noten blenden am Platz ein), er
  // freut sich und singt; Drehtanz: nach links und rechts schauen, verbeugen. Am Ende blendet es aus.
  async _a2RadioCalm(mode, gold, bird, o) {
    const p = this._el.pika;
    const { pW } = this._g;
    let P;
    if (o.short) {
      const px = this._a2RadioBeside();
      P = { x: this._x, px, dir: px >= this._x ? 1 : -1 };
    } else {
      P = this._a2RadioSpot();
    }
    await this._a2RadioAside(P.px);
    if (!o.short) {
      await this._walkTo(P.x, 0.9);
    }
    this._face(P.dir);
    const S = this._a2RadioMake(P.px, false, true);
    await this._wait(700);
    S.el.classList.add('ant', 'knob', 'a2rtune');
    this._a2RadioPeep(pick(['krrz…', 'kschhh…']));
    await this._wait(900);
    S.el.classList.remove('a2rtune');
    S.on = true;
    S.gold = gold;
    S.el.classList.add('on');
    this._say(pick(RADIO_SENDER[S.st].say), 1300);
    if (bird) this._a2RadioBird();
    S.dance = true;
    p.classList.add('content');
    await this._a2RadioBeats(6);
    if (mode === 'spin') {
      this._say(pick(['Drehtanz!', 'und… dreh!']), 1200);
      for (const d of [-P.dir, P.dir, -P.dir, P.dir]) {
        this._face(d);
        await this._a2RadioBeats(1);
      }
      p.classList.add('bowing');
      this._say('Ta-da!', 1200);
      await this._wait(1600);
      p.classList.remove('bowing');
    } else {
      p.classList.add('sing');
      this._say(pick(['la-la-la ♪', 'tralala!']), 1600);
      await this._a2RadioBeats(4);
      p.classList.remove('sing');
    }
    await this._a2RadioBeats(2);
    p.classList.remove('content');
    if (gold) this._a2RadioGoldBurst();
    this._happy(1000);
    S.dance = false;
    await this._wait(900);
    S.on = false;
    S.el.classList.remove('on', 'knob', 'ant');
    this._a2RadioBirdGo();
    await this._wait(500);
  }

  // Nach dem Auspacken (Hook): gleich ausprobieren (Stufe 1 tanzen, 2 Drehtanz, 3 mit goldenen Noten und Vögelchen).
  // Regnet es, nur kurz zeigen: Es ploppt neben ihm auf, rauscht, eine Note, „bei Regen lieber nicht“, weg.
  async _a2RadioStow(lv) {
    if (this._a2RadioWeather()) return lv === 2 ? this._a2RadioSpin({ short: true }) : this._a2RadioPlay({ short: true, gold: lv >= 3, bird: lv >= 3 });
    this._a2RadioBusy = true;
    try {
      const { pW } = this._g;
      const d = this._x < this._W / 2 ? 1 : -1;
      const S = this._a2RadioMake(clamp(this._x + d * pW * RADIO_FAR, pW * 0.5, this._g.xR + pW * 0.3), true);
      this._face(d);
      this._say(lv >= 3 ? pick(['goldig!', 'es glänzt!']) : pick(['Musik!', 'ein Radio!']), 1300);
      await this._wait(900);
      S.el.classList.add('ant', 'a2rtune');
      this._a2RadioPeep('krrz…');
      await this._wait(700);
      S.el.classList.remove('a2rtune');
      S.on = true;
      S.gold = lv >= 3;
      S.el.classList.add('on');
      this._a2RadioNote(lv >= 3);
      await this._wait(800);
      this._el.pika.classList.add('look-up');
      this._say(pick(['bei Regen lieber nicht…', 'zu nass zum Tanzen!']), 1600);
      await this._wait(1700);
      this._el.pika.classList.remove('look-up');
      S.on = false;
      S.el.classList.remove('on', 'ant');
      this._say(pick(['wenn die Sonne scheint!', 'bald!']), 1300);
      this._happy(1000);
      await this._wait(1300);
    } finally {
      this._a2RadioBusy = false;
      this._a2RadioEnd(true);
    }
  }

  // ---------- Noten ----------

  // Eine Note steigt aus dem Lautsprecher (gold: golden, weiter und höher). Bewegung reduzieren: Sie blendet über dem
  // Radio am Platz ein und aus.
  _a2RadioNote(gold = false) {
    const S = this._a2RadioS;
    if (!S?.on || !this._el?.fx) return null;
    const calm = calmMotion();
    const { w, h } = this._a2RadioDim();
    const L = this._a2RadioAt(RADIO_SPEAKER);
    const H = this._H;
    const n = document.createElement('span');
    n.className = `a2rn${gold ? ' gold' : ''}${calm ? ' still' : ''}`;
    n.innerHTML = pick(NOTE_SVG);
    if (!gold) n.style.color = pick(RADIO_SENDER[S.st].col);
    const x = calm ? S.x + rnd(-0.6, 0.6) * w : L.x;
    const y = calm ? L.y - h * rnd(0.9, 1.6) : L.y - h * 0.1;
    n.style.left = `${x.toFixed(1)}px`;
    n.style.top = `${y.toFixed(1)}px`;
    const k = gold ? 1.5 : 1;
    n.style.setProperty('--dx', `${(rnd(-0.5, 1) * H * 0.1 * k).toFixed(1)}px`);
    n.style.setProperty('--dy', `${(-H * rnd(0.17, 0.25) * k).toFixed(1)}px`);
    n.style.setProperty('--nr', `${Math.round(rnd(-25, 25))}deg`);
    this._el.fx.appendChild(n);
    const F = (this._a2RadioFx ??= new Set());
    F.add(n);
    // (eigene Zeitgeber, nicht in S.t: Ist die Musik aus, steigen die letzten Noten noch zu Ende)
    setTimeout(() => {
      n.remove();
      F.delete(n);
    }, gold ? 2400 : 1900);
    return n;
  }

  // Golden zum Schluss: ein Schwarm goldener Noten fächert aus dem Lautsprecher, dazu Glitzer
  _a2RadioGoldBurst() {
    const S = this._a2RadioS;
    if (!S?.on) return;
    for (let i = 0; i < 5; i++) {
      S.t.push(setTimeout(() => {
        const n = this._a2RadioNote(true);
        if (n && !calmMotion()) n.style.setProperty('--dx', `${((i - 2) * this._H * 0.07).toFixed(1)}px`);
      }, i * 140));
    }
    const L = this._a2RadioAt(RADIO_SPEAKER);
    this._sparkle(L.x, L.y - this._H * 0.08, 2);
  }

  // ---------- Das Vögelchen (Stufe 3) ----------

  // Ein Vögelchen fliegt auf den Henkel und wippt im Takt mit, bis die Musik aus ist (_a2RadioBirdGo)
  _a2RadioBird() {
    const S = this._a2RadioS;
    if (!S || S.bird || !this._el?.birds) return;
    const v = pick(BIRDS);
    const T = this._a2RadioAt(RADIO_HANDLE);
    const calm = calmMotion();
    const el = document.createElement('div');
    el.className = `bird a2rb${calm ? '' : ' flying'}`;
    el.innerHTML = `<div class="bw" role="button" aria-label="${v.name}"><div class="bf"><div class="bb">${BIRD_SVG(v)}</div></div></div>`;
    el.style.left = `${T.x.toFixed(1)}px`;
    el.style.top = `${T.y.toFixed(1)}px`;
    el.style.zIndex = String(RADIO_BZ());
    el.style.setProperty('--a2rbt', `${RADIO_SENDER[S.st].beat * 2}ms`);
    const dir = this._x >= T.x ? 1 : -1;
    const b = { el, v, x: T.x, y: T.y, dir, sitting: false, gone: false, t: null, fly: null };
    S.bird = b;
    el.classList.toggle('left', dir < 0);
    // Antippen: Es fliegt weg (wie ein Besuch)
    el.querySelector('.bw')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._found('visitor');
      this._a2RadioBirdGo(true);
    });
    this._keyTap?.(el.querySelector('.bw'));
    this._el.birds.appendChild(el);
    const land = () => {
      if (b.gone) return;
      b.fly = null;
      el.classList.remove('flying');
      if (!calmMotion()) el.classList.add('land');
      b.sitting = true;
      b.t = setTimeout(() => {
        el.classList.remove('land');
        if (!calmMotion()) el.classList.add('bob');
        this._tweet?.(b);
      }, 320);
    };
    if (calm || !el.animate) {
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
      b.t = setTimeout(land, 500);
      return;
    }
    // Anflug von schräg oben, von der Seite, zu der es schaut
    const dx = -dir * this._W * rnd(0.3, 0.45);
    const dy = -T.y - this._H * 0.1;
    const dur = rnd(1300, 1700);
    b.fly = el.animate([
      { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` },
      { transform: `translate(${(dx * 0.4).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`, offset: 0.55 },
      { transform: `translate(${(dx * 0.08).toFixed(1)}px, ${(-this._H * 0.04).toFixed(1)}px)`, offset: 0.88 },
      { transform: 'translate(0, 0)' },
    ], { duration: dur, easing: 'ease-out' });
    b.t = setTimeout(land, dur);
  }

  // Das Vögelchen fliegt weg (fast: erschrocken); now: sofort weg (Karte aus dem DOM)
  _a2RadioBirdGo(fast = false, now = false, S = this._a2RadioS) {
    const b = S?.bird;
    if (!b || b.gone) return;
    b.gone = true;
    b.sitting = false;
    clearTimeout(b.t);
    b.fly?.cancel?.();
    const el = b.el;
    el.classList.remove('land', 'bob');
    if (now) return el.remove();
    if (calmMotion() || !el.animate) {
      el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
      setTimeout(() => el.remove(), 420);
      return;
    }
    el.classList.add('flying');
    const out = b.x > this._W / 2 ? 1 : -1;
    el.classList.toggle('left', out < 0);
    const dur = fast ? 800 : rnd(1100, 1500);
    el.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${(out * this._W * 0.06).toFixed(1)}px, ${(-this._H * 0.07).toFixed(1)}px)`, offset: 0.25 },
      { transform: `translate(${(out * this._W * 0.55).toFixed(1)}px, ${(-b.y - this._H * 0.2).toFixed(1)}px)` },
    ], { duration: dur, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => el.remove(), dur + 40);
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Tipp aufs Radio (nur, solange es steht): Es rauscht (Bild über der Front), der Zeiger springt, ein anderer Sender
  // kommt: neue Farben der Noten, anderer Takt. Tanzt er gerade, sagt er etwas dazu.
  _a2RadioTap() {
    const S = this._a2RadioS;
    if (!S) return false;
    const el = S.el;
    el.classList.remove('a2rtune');
    void el.offsetWidth;
    el.classList.add('a2rtune');
    this._a2RadioPeep(pick(['krrz…', 'kschhh…', 'krrrk…', 'fiiiep…']));
    clearTimeout(this._a2RadioTapT);
    this._a2RadioTapT = setTimeout(() => {
      if (this._a2RadioS !== S) return;
      el.classList.remove('a2rtune');
      S.st = (S.st + 1) % RADIO_SENDER.length;
      const R = RADIO_SENDER[S.st];
      el.style.setProperty('--a2rn', `${R.nd}px`);
      const bt = `${R.beat * 2}ms`;
      el.style.setProperty('--a2rbt', bt);
      if (S.dance) this._el.pika.style.setProperty('--a2rbt', bt);
      S.bird?.el.style.setProperty('--a2rbt', bt);
      if (!S.on) return;
      this._a2RadioNote(S.gold);
      if (S.dance && !this._asleep) this._say(pick(R.say), 1100);
    }, 650);
    return true;
  }

  // Ende der Aktion oder Abbruch (auch aus _cleanup nach jeder Aktion): Radio, Vögelchen, Zeitgeber weg, eigene Klassen
  // am Pika ab. force: aus der eigenen Aktion; sonst, mitten in ihr (Szene, Aufräumen), nichts: Sie räumt in ihrem
  // finally selbst auf, nur nach einem Abbruch gleich. now: sofort weg (er nimmt es ins Maul), sonst blendet es aus
  _a2RadioEnd(force = false, now = false) {
    const S = this._a2RadioS;
    if (!S) return;
    if (!force && this._a2RadioBusy && !this._ac?.signal?.aborted) return;
    this._a2RadioS = null;
    for (const t of S.t) clearTimeout(t);
    clearTimeout(this._a2RadioTapT);
    this._a2RadioBirdGo(false, false, S);
    const p = this._el.pika;
    p.classList.remove(...RADIO_CLS);
    p.style.removeProperty?.('--a2rbt');
    const el = S.el;
    el.classList.remove('on', 'a2rtune');
    if (!now && el.isConnected && !calmMotion() && this._a2Els?.get('radio') === el) {
      el.classList.add('a2out');
      setTimeout(() => !this._a2RadioS && this._a2Els?.get('radio') === el && this._a2Drop('radio'), 450);
    } else if (!now && el.isConnected && el.animate && this._a2Els?.get('radio') === el) {
      // (reduzierte Bewegung: ausblenden ohne Transition der Klasse)
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' });
      setTimeout(() => !this._a2RadioS && this._a2Els?.get('radio') === el && this._a2Drop('radio'), 460);
    } else this._a2Drop('radio');
  }

  _a2RadioCleanup() {
    this._a2RadioEnd();
    if (!this._a2RadioBusy) this._el?.pika?.classList.remove(...RADIO_CLS);
  }

  // Karte aus dem DOM: alles sofort weg (wie _a2LanternDetach: über End, damit auch die eigenen Klassen und der Takt am
  // Pika abgehen; bis 0.48.0 blieben sie bis zum Ende der nächsten Aktion stehen)
  _a2RadioDetach() {
    clearTimeout(this._a2RadioTapT);
    const S = this._a2RadioS;
    if (S) this._a2RadioBirdGo(false, true, S); // (das Vögelchen sofort, nicht davonfliegend)
    this._a2RadioBusy = false;
    this._a2RadioEnd(true, true);
    this._el?.pika?.classList.remove(...RADIO_CLS);
    this._el?.pika?.style.removeProperty?.('--a2rbt');
    this._a2Drop('radio');
    for (const n of this._a2RadioFx || []) n.remove();
    this._a2RadioFx?.clear();
  }
}
