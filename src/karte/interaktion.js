// Interaktion: streicheln (Zonen, Combo), kraulen, wischen, die Welt antwortet

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { PET_CLING, PET_CAP, pikaDay } from '../logik/tagesplan.js';
import { PET_FREE, TOUCH_NEXT, petGain, KRAUL, PRESS_SLOP, worldPick } from '../logik/interaktion.js';

export class Interaktion {
  // Klick auf den Pika. Den Tipp mit Finger oder Maus löst schon das Loslassen aus (_pressEnd), der Klick des Browsers
  // dazu wird verschluckt. Hier kommt nur an, was ohne Zeiger klickt: der durchgereichte Tipp unter einem Flugzeug
  // (_tapBelow) und Hilfsmittel, die Klicks selbst auslösen.
  _onPet(e) {
    // Nach dem Tippen, Kraulen oder Wischen kommt beim Loslassen noch ein Klick: der zählt nicht extra
    if (this._eatClick) {
      this._eatClick = false;
      return;
    }
    this._pet(e);
  }

  // Glück für diese Berührung (petGain): voll nach einer ruhigen Pause, schnell hintereinander nur anteilig
  _petGainNow() {
    const now = Date.now();
    const g = petGain(now - (this._petAt ?? -Infinity));
    this._petAt = now;
    return g;
  }

  // Einmal streicheln. e: Zeiger- oder Mausereignis mit der Stelle (clientX/Y), null: ohne Stelle (Tastatur)
  _pet(e) {
    this._add('g', this._petGainNow());
    this._petFriend();
    this._petCount();
    const p = this._el.pika;
    if (this._asleep) {
      this._found('sleep');
      return this._sleepTouch('tap');
    }
    // Er schmollt gerade („hmpf!“): Das Streicheln zählt fürs Glück, aber er lässt sich nicht stören, und die
    // nächste Combo beginnt erst danach
    if (this._pout) return this._blush(1600);
    this._mimik(null); // gestreichelt schaut er nicht länger traurig oder trotzig
    // Mehrmals hintereinander: Combo (innerhalb von 6 s)
    const now = Date.now();
    this._combo = (this._combo || []).filter((t) => now - t < 6000);
    this._combo.push(now);
    const n = this._combo.length;
    this._blush(1600 + n * 250);
    if (this._petFree()) {
      this._petReq = { zone: this._petZone(e), n, from: this._action };
      if (n >= 11) this._combo = [];
      this._touchNext('petReact');
      return;
    }
    this._happy();
    // Beim Fernsehen dreht er sich um, beim Lesen eingenickt wacht er auf
    if (p.classList.contains('tv')) p.classList.remove('tv');
    if (p.classList.contains('doze')) {
      p.classList.remove('doze');
      this._say('oh!', 900);
    }
    // Im Bau: kommt zum Streicheln an den Eingang. War er gar nicht zu sehen, war das ein Klopfen an die Tür (sein
    // Tippfeld liegt auch im Bau über dem ganzen Eingang, der Klick kommt deshalb hier an und nicht bei _worldTap).
    if (this._inside) {
      if (e && ['hidden', 'ears'].includes(this._poseName)) this._knock();
      return this._pose('peek', 300);
    }
    if (!p.classList.contains('walking')) this._jump(Math.random() < 0.25 ? 'binky' : 'hop1');
    if (Math.random() < 0.35) this._say(pick(['iiep!', 'mip!', '♥']));
  }

  // ---------- Streicheln: Zonen, Combo, Kraulen, Wischen ----------

  // Darf Streicheln eine eigene Reaktion starten? Nur bei Kleinigkeiten, draußen auf der Wiese, und nicht, wenn
  // schon etwas anderes ansteht (Häufchen, Vorschau-Knopf): das bliebe sonst liegen
  _petFree() {
    return this._running && !!this._g && !this._inside && !(this._lift > 0) && !this._asleep && !this._giftCarry && !this._pout
      && !this._kraulOn // der Finger liegt noch: ein zweiter Finger oder Klick bricht das Kraulen nicht ab
      && (this._action == null || PET_FREE.has(this._action)) && (!this._next || TOUCH_NEXT.has(this._next));
  }

  // Reaktion auf eine Berührung als nächste Aktion (mit Zeitstempel, siehe TOUCH_TTL)
  _touchNext(name) {
    this._next = name;
    this._nextAt = Date.now();
    this._interrupt();
  }

  // Im Schlaf gestreichelt, gekrault oder übers Fell gestrichen: ein Auge auf, Herzchen, manchmal „mmh…“.
  // Viermal in 6 s: „noch fünf Minuten…“, und er dreht sich auf die andere Seite.
  _sleepTouch(kind) {
    const p = this._el.pika;
    const now = Date.now();
    this._zzCombo = (this._zzCombo || []).filter((t) => now - t < 6000);
    this._zzCombo.push(now);
    clearTimeout(this._peekT);
    if (this._zzCombo.length >= 4) {
      this._zzCombo = [];
      p.classList.remove('peek');
      this._say('noch fünf Minuten…', 2200);
      this._face(-this._dir);
      this._cls('stw', 550, true);
      return;
    }
    p.classList.add('peek');
    this._peekT = setTimeout(() => p.classList.remove('peek'), kind === 'kraul' ? 2400 : 1300);
    this._hearts(1);
    if (kind !== 'tap' || Math.random() < 0.3) this._say(pick(['mmh…', 'mip…', 'mmmh…']), 1400);
    if (kind === 'kraul') this._cls('content', 2600);
  }

  // Stelle eines Zeigerereignisses in Koordinaten der Pika-Grafik (120 × 100, Blick nach rechts); r: ihr Rechteck
  // auf dem Bildschirm. null ohne Ereignis oder solange die Grafik keine Fläche hat.
  _pkPoint(e) {
    const r = this._el.pika.querySelector('.pk')?.getBoundingClientRect();
    if (!e || !r?.width || !Number.isFinite(e.clientX)) return null;
    const x = ((e.clientX - r.left) / r.width) * 120;
    return { x: this._dir < 0 ? 120 - x : x, y: ((e.clientY - r.top) / r.height) * 100, r };
  }

  // Wo wurde er angetippt? In Koordinaten der Pika-Grafik (120 × 100, Blick nach rechts)
  _petZone(e) {
    const P = this._pkPoint(e);
    if (!P) return 'body';
    const { x, y, r } = P;
    const d = (ax, ay) => Math.hypot(x - ax, y - ay);
    // Auf kleinen Karten (Handy) wären Nase und Ohren nur 13–16 px groß: Ohren mindestens 14 px Radius, die Nase
    // (zuerst geprüft) 10 px, sonst schluckte sie auf dem Handy den ganzen Kopf
    const m = (20 / r.width) * 120;
    if (d(91, 53) < Math.max(9, m * 0.5)) return 'nose';
    const el = d(75, 24);
    const er = d(101, 25);
    if (Math.min(el, er) < Math.max(11.5, m * 0.7)) return el < er ? 'ear-l' : 'ear-r';
    if (x > 62 && y < 63) return 'head';
    if (x > 62 && y >= 66) return 'belly';
    return 'body';
  }

  async _petReact() {
    const R = this._petReq;
    this._petReq = null;
    if (!R) return;
    const p = this._el.pika;
    if (R.from === 'nod') {
      this._cls('hic', 340, true);
      this._say('oh!', 900);
      this._emote('drop', 1400);
      await this._wait(900);
    }
    if (R.n >= 11) return this._petPout();
    if (R.n >= 8) return this._petMelt();
    if (R.n === 5) {
      this._found('combo');
      this._jump('binky');
      this._emote('spark', 1500);
      p.classList.add('happy');
      this._hearts(3);
      await this._wait(1200);
      return;
    }
    this._found({ 'ear-l': 'ear', 'ear-r': 'ear', body: 'back' }[R.zone] || R.zone);
    if (R.zone === 'nose') return this._petNose();
    if (R.zone === 'ear-l' || R.zone === 'ear-r') return this._petEar(R.zone.slice(-1));
    if (R.zone === 'belly') return this._petBelly();
    if (R.zone === 'head') return this._petHead();
    // Rücken und Po: Freudensprung wie bisher
    this._happy();
    this._jump(Math.random() < 0.25 ? 'binky' : 'hop1');
    if (Math.random() < 0.35) this._say(pick(['iiep!', 'mip!', '♥']));
    await this._wait(1200);
  }

  // Kopf: in die Hand lehnen, Augen zu, Ohren angelegt
  async _petHead() {
    this._el.pika.classList.add('lean', 'tilt', 'squint', 'content', 'flat');
    this._hearts(2);
    if (Math.random() < 0.4) this._say(pick(['mmh…', '♥', 'mip…']), 1200);
    await this._wait(rnd(1500, 2100));
  }

  // Nase: boop! Er schielt auf die Nase, manchmal muss er niesen
  async _petNose() {
    const p = this._el.pika;
    this._say('boop!', 900);
    p.classList.add('crosseye');
    this._noseWiggle();
    await this._wait(1000);
    p.classList.remove('crosseye');
    if (Math.random() < 0.45) return this._sneeze(false);
    this._blink();
    this._hearts(1);
    await this._wait(400);
    if (Math.random() < 0.5) this._say(pick(['hihi', 'nochmal!', 'mip!']), 1000);
    await this._wait(900);
  }

  // Ohr: flappt nach
  async _petEar(side) {
    const p = this._el.pika;
    this._cls(`eflap-${side}`, 950, true);
    this._blink();
    await this._wait(350);
    p.classList.add('happy');
    if (Math.random() < 0.5) this._say(pick(['hihi', 'iiep!', '!']), 900);
    this._hearts(1);
    await this._wait(1000);
  }

  // Bauch: kichern, manchmal kurz auf den Rücken kippen
  async _petBelly() {
    const p = this._el.pika;
    this._say(pick(['hihi!', 'hihihi!', 'kicher!']), 1300);
    p.classList.add('happy', 'tickle');
    await this._wait(1000);
    p.classList.remove('tickle');
    if (Math.random() < 0.6) {
      p.classList.add('roll');
      await this._wait(rnd(1100, 1600));
      p.classList.remove('roll');
      await this._wait(400);
    }
    this._hearts(2);
    await this._wait(600);
  }

  // Achtmal: schmilzt zum runden Fellknäuel
  async _petMelt() {
    this._found('melt');
    this._el.pika.classList.add('melt', 'squint', 'content', 'flat');
    this._say('♥♥♥', 1800);
    this._hearts(4);
    this._blush(4500);
    await this._wait(3400);
  }

  // Elfmal: genug! Er dreht sich beleidigt weg und linst dann doch zurück
  async _petPout() {
    const p = this._el.pika;
    const dir = this._dir;
    // Solange er schmollt, bricht weiteres Tippen das nicht ab (_petFree, _onPet): Wer elfmal tippt, tippt meist weiter
    this._pout = true;
    this._found('pout');
    try {
      this._face(-dir);
      this._emote('grump', 2400);
      this._say('hmpf!', 1300);
      p.classList.add('look-up', 'squint');
      this._mimik('defy', 3400); // Trotz: Brauen zusammengezogen, Schmollmund
      await this._wait(2500);
      p.classList.remove('look-up', 'squint');
      p.classList.add('look-b');
      await this._wait(900);
      p.classList.remove('look-b');
      this._mimik(null);
      this._face(dir);
      this._say(pick(['…na gut', '…na schön', 'hihi']), 1300);
      this._blush(2200);
      this._hearts(1);
      await this._wait(1300);
    } finally {
      this._pout = false;
    }
  }

  // Zeiger und Touch fürs Streicheln an el hängen: der Pika selbst oder die Tippfläche eines tiefen Fliegers, die den
  // Finger durchreicht (ok(e): liegt der Pika darunter?). leave: pointerleave beendet den Druck (nicht an der
  // Tippfläche, die unter dem ruhenden Finger weiterzieht).
  //
  // Ablauf auf einem Touch-Gerät (Android Chrome und WebView, iOS): touchstart, dann pointerdown. Ruht der Finger,
  // meldet Android nach 400–500 ms „lang gedrückt“ (contextmenu: wird unterdrückt, zu markieren gibt es hier nichts)
  // und schickt nach dem Loslassen KEINEN Klick mehr. Darum hängt nichts am Klick: Der Tipp entsteht beim Loslassen
  // (pointerup), das Kraulen nach KRAUL.hold aus dem Zeitgeber. touch-action: pan-y lässt die Seite senkrecht rollen;
  // beginnt der Browser damit, meldet er pointercancel, und der Druck ist vorbei. Sobald gekrault wird, darf das
  // nicht mehr passieren. touch-action lässt sich mitten in der Geste nicht ändern, aber ein touchmove, das
  // preventDefault bekommt, bevor das Rollen begonnen hat, verhindert es (deshalb passive: false). Bis dahin rollt
  // die Seite wie gewohnt.
  _pressBind(el, ok = null, leave = true) {
    el.addEventListener('pointerdown', (e) => (!ok || ok(e)) && this._pressStart(e, el));
    el.addEventListener('pointermove', (e) => this._pressMove(e));
    for (const t of leave ? ['pointerup', 'pointercancel', 'pointerleave'] : ['pointerup', 'pointercancel']) {
      el.addEventListener(t, (e) => this._pressEnd(e));
    }
    // Lang drücken auf Touch (Windows-Tablet, Android) öffnete sonst das Kontextmenü des Browsers
    el.addEventListener('contextmenu', (e) => (!ok || this._press) && e.preventDefault());
    el.addEventListener('touchstart', () => (this._finger = true), { passive: true });
    el.addEventListener('touchmove', (e) => this._press?.kraul && e.cancelable && e.preventDefault(), { passive: false });
    for (const t of ['touchend', 'touchcancel']) {
      el.addEventListener(t, (e) => {
        if (e.targetTouches?.length) return;
        this._finger = false;
        // Der Browser hatte den Zeiger schon abgemeldet, der Finger lag aber noch (siehe _pressEnd): jetzt ist er weg
        if (this._press?.lost) this._pressEnd(null);
      }, { passive: true });
    }
  }

  // Finger oder Maus setzt auf. el: wer den Zeiger festhält (der Pika oder die Tippfläche eines tiefen Fliegers)
  _pressStart(e, el = this._el.pika) {
    // Ein neuer Finger: der Klick zum letzten Drücken ist dann längst durch
    this._eatClick = false;
    // Nur der erste Finger zählt (ein zweiter beendete sonst das Kraulen)
    if (e.button > 0 || e.isPrimary === false || !this._g) return;
    // Ein Kraulen, dessen Ende nie gemeldet wurde, endet spätestens mit dem nächsten Druck
    this._kraulOn = false;
    const P = (this._press = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch' });
    try {
      el.setPointerCapture(e.pointerId); // beim Wischen nicht vom Pika abrutschen
    } catch (err) { /* nicht unterstützt */ }
    this._pressFx(e);
    clearTimeout(this._pressT);
    this._pressT = setTimeout(() => {
      if (this._press !== P || P.swiped || !this._running) return;
      if (this._asleep) {
        // im Schlaf gekrault: wohlig, aber er bleibt liegen
        P.kraul = true;
        this._add('g', this._petGainNow());
        this._petCount();
        this._found('sleep');
        return this._sleepTouch('kraul');
      }
      if (!this._petFree()) {
        // Beschäftigt: Lang drücken zählt wie Antippen, und zwar jetzt. Auf das Loslassen zu warten hieße auf Android,
        // auf einen Klick zu warten, der nach langem Drücken nicht kommt.
        P.done = true;
        return this._pet({ clientX: P.x, clientY: P.y });
      }
      P.kraul = true;
      this._kraulOn = true;
      this._petFriend();
      this._touchNext('kraul');
    }, KRAUL.hold);
  }

  _pressMove(e) {
    const P = this._press;
    if (!P || P.id !== e.pointerId || P.kraul || P.swiped || P.done || !this._g) return;
    const dx = Math.abs(e.clientX - P.x);
    const dy = Math.abs(e.clientY - P.y);
    if (dx > this._g.pW * 0.35 && dx > dy * 1.5) {
      P.swiped = true;
      clearTimeout(this._pressT);
      this._onStroke();
    } else if (Math.hypot(dx, dy) > PRESS_SLOP) clearTimeout(this._pressT); // bewegt: kein Kraulen
    this._pressFx(e); // der Blick wandert mit
  }

  // e: pointerup, pointercancel oder pointerleave. null: Der Finger ist weg, ohne dass es der Zeiger gemeldet hat.
  _pressEnd(e) {
    const P = this._press;
    if (!P || (e && e.pointerId !== P.id)) return;
    // Ein Finger verlässt das Element nicht, solange er liegt (der Zeiger ist festgehalten): pointerleave kommt bei
    // Touch nur als Nachzügler von pointerup oder pointercancel. Nach einem pointercancel beim Kraulen (unten) beendete
    // er sonst doch noch, was weiterlaufen soll.
    if (e?.type === 'pointerleave' && P.touch) return;
    // Der Browser meldet den Zeiger ab (pointercancel), obwohl der Finger beim Kraulen noch liegt: Das Kraulen läuft
    // weiter, bis touchend oder touchcancel kommt (_pressBind). Nur wenn hier überhaupt Touch-Ereignisse ankommen.
    if (e?.type === 'pointercancel' && P.kraul && P.touch && this._finger && this._kraulOn) {
      P.lost = true;
      return;
    }
    clearTimeout(this._pressT);
    this._press = null;
    this._pressFx(null);
    // Losgelassen, ohne zu kraulen oder zu wischen: Das ist der Tipp. Nicht nach pointercancel (die Seite rollt) und
    // nicht nach pointerleave.
    const up = e?.type === 'pointerup';
    // Weit weggezogen und woanders losgelassen (der Zeiger ist festgehalten, pointerup kommt trotzdem hier an): kein Tipp
    const far = up && Math.hypot(e.clientX - P.x, e.clientY - P.y) > Math.max(PRESS_SLOP * 2, (this._g?.pW || 0) * 0.6);
    const tap = up && !far && !P.kraul && !P.swiped && !P.done;
    // Der Klick des Browsers beim Loslassen gehört dazu: den nächsten verschlucken. Bleibt er aus (Android nach langem
    // Drücken, Touch nach Bewegung), räumt der nächste Druck bzw. die Frist den Merker weg.
    if (P.kraul || P.swiped || P.done || tap || far) {
      this._eatClick = true;
      clearTimeout(this._eatClickT);
      this._eatClickT = setTimeout(() => (this._eatClick = false), tap ? 700 : 2000);
    }
    if (P.kraul) this._kraulOn = false;
    if (tap) this._pet(e);
  }

  // Sofort beim Aufsetzen, noch bevor feststeht, ob es ein Tipp, Kraulen oder Wischen wird: leicht stauchen, Bäckchen,
  // die Augen wandern zum Finger. Nur eine Klasse und zwei Variablen am Pika, keine Aktion: Was er gerade tut, läuft
  // unverändert weiter. e null: Finger weg. Im Schlaf bleibt er ruhig liegen.
  _pressFx(e) {
    const p = this._el.pika;
    if (!e || this._asleep) {
      clearTimeout(this._pressFxT);
      p.classList.remove('pressed');
      return;
    }
    const at = this._pkPoint(e);
    if (at) {
      // Auslenkung der Augen in Einheiten der Grafik, von der Gesichtsmitte (90/48) aus
      p.style.setProperty('--ex', `${(clamp((at.x - 90) / 34, -1, 1) * 1.2).toFixed(2)}px`);
      p.style.setProperty('--ey', `${(clamp((at.y - 48) / 34, -1, 1) * 0.9).toFixed(2)}px`);
    }
    if (p.classList.contains('pressed')) return;
    p.classList.add('pressed');
    this._blush(1400);
    // Sicherung: Bleibt die Meldung „Finger weg“ ganz aus, steht er nicht für immer gestaucht da
    clearTimeout(this._pressFxT);
    this._pressFxT = setTimeout(() => p.classList.remove('pressed'), KRAUL.max + 3000);
  }

  // Über das Fell gestrichen: es plustert sich auf und legt sich wieder
  _onStroke() {
    this._add('g', this._petGainNow());
    this._petCount();
    this._found('stroke');
    if (this._asleep) return this._sleepTouch('stroke');
    this._blush(2000);
    if (this._petFree()) this._touchNext('stroke');
    else this._cls('fluffy', 850, true);
  }

  async _stroke() {
    const p = this._el.pika;
    this._cls('fluffy', 850, true);
    this._blink();
    await this._wait(500);
    p.classList.add('squint', 'content');
    this._hearts(1);
    await this._wait(1000);
    this._noseWiggle();
    await this._wait(600);
  }

  // Kraulen, solange der Finger liegt (höchstens KRAUL.max): Augen zu, Klopfbein, prrr. Der Einstieg zählt wie ein
  // Tipp, danach gibt jeder Takt Glück: Ruhiges Kraulen bringt je Sekunde mehr als jedes Tippen (KRAUL, petGain).
  async _kraul() {
    const p = this._el.pika;
    p.classList.add('squint', 'content', 'flat', 'tilt');
    this._say('prrr…', 1500);
    this._add('g', this._petGainNow());
    this._petCount();
    this._found('kraul');
    const t0 = Date.now();
    const P = this._press; // der Druck, zu dem dieses Kraulen gehört
    try {
      for (let i = 0; this._kraulOn && Date.now() - t0 < KRAUL.max; i++) {
        if (i === 1) p.classList.add('thump');
        this._blush(2500);
        if (i % 2) this._hearts(1);
        if (i > 0) {
          this._add('g', KRAUL.gain);
          this._petAt = Date.now(); // ein Tipp gleich danach zählt nicht noch einmal voll
          if (i % KRAUL.count === 0) this._petCount();
        }
        if (i === 4) this._say(pick(['prrrr…', 'mmmh…', '♥']), 1500);
        await this._wait(KRAUL.beat);
      }
    } finally {
      // Nur das eigene Kraulen beenden. Kurz abgesetzt und wieder aufgelegt: Der neue Druck hat _kraulOn schon
      // gesetzt und dieses Kraulen abgebrochen; es nähme dem nächsten sonst gleich wieder den Finger weg.
      if (this._press === P || !this._press?.kraul) this._kraulOn = false;
    }
    p.classList.remove('thump');
    await this._wait(500);
    p.classList.remove('squint');
    this._hearts(1);
    await this._wait(700);
  }

  // Stand des heutigen Pika-Tags aus dem Tagesplan (mit plan_entity auf allen Geräten gleich): n gestreichelt, m Erlebnisse
  _cuteToday() {
    const d = pikaDay(this._haNow());
    const c = this._plan?.cute;
    return c?.d === d ? c : { d, n: 0, m: 0 };
  }

  // Wie oft er heute gestreichelt wurde, auf allen Geräten zusammen: ab 10 kommt er auch mal angehoppelt
  _petCount() {
    const c = this._cuteToday();
    if (c.n >= PET_CAP) return; // mehr muss keiner wissen, der Helfer wird dafür nicht mehr geschrieben
    this._planOp({ t: 'pet', d: c.d, n: c.n + 1 });
    if (c.n + 1 === 8) this._memo('heart');
  }

  _clingy() {
    return this._cuteToday().n >= PET_CLING;
  }

  async _comeHere() {
    const x = this._comeX;
    this._comeX = null;
    if (x == null) return;
    const p = this._el.pika;
    this._noseWiggle();
    await this._walkTo(x - Math.sign(x - this._x) * this._g.pW * 0.3, 1.3);
    p.classList.add('tilt');
    if (Math.random() < 0.5) this._emote('q', 1400);
    else this._hearts(1);
    await this._wait(rnd(1200, 1800));
  }

  // Tastatur: Was sich antippen lässt (role="button"), lässt sich mit Tab anwählen und mit Enter oder Leertaste
  // auslösen. fn: was dann geschieht; sonst ein Klick auf el, den dessen eigener Klick-Handler bekommt.
  _keyTap(el, fn = null) {
    el.tabIndex = 0;
    el.classList.add('ktap');
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      // Was der Zeiger gerade nicht trifft (Vogel im Flug, weggeräumtes Häufchen), löst auch die Taste nicht aus
      if (e.repeat || getComputedStyle(el).pointerEvents === 'none') return;
      if (fn) fn();
      else el.click();
    });
  }

  // ---------- Die Welt antwortet ----------
  // Ein Tipp auf Blume, Wolke, Stern, Tür, Windrad oder Wollknäuel bekommt eine kleine Antwort. Alles bleibt auf diesem
  // Gerät: Nichts davon steht im Zustand oder im Tagesplan, nichts wird in die Helfer geschrieben. Die Ziele bekommen
  // keine eigenen Tippflächen (sie lägen über Pika, Häufchen und Besuchern und stünden _tapBelow im Weg): Der Klick,
  // den sonst niemand wollte, kommt an der Szene an (_onLookAt) und wird hier nach Rechtecken gesucht. Was eine
  // eigene Tippfläche hat (Häufchen, Geschenk, Pino, Besucher, Flugzeuge, Geräte, Leiste, Knöpfe), fängt seinen
  // Klick vorher ab und behält so den Vorrang.

  // Was zeigt die Stelle vom Himmel? 2: freien Himmel. 1: die Berge (Areal alpin), vor ihnen ziehen die Wolken, die
  // Sterne stehen dahinter. 0: nichts, davor liegen die gemalten Flächen von Hügeln, Bau oder Stein.
  _skyAt(e) {
    const stack = this.shadowRoot.elementsFromPoint?.(e.clientX, e.clientY) || [];
    if (stack.some((el) => el.matches?.('.hills *, .burrow svg *, .lookout svg *'))) return 0;
    return stack.some((el) => el.matches?.('.mtns *')) ? 1 : 2;
  }

  // Flächen der antippbaren Dinge in px der Szene, in Rangfolge und mit Tipp-Rand (worldPick). sky: was die Stelle
  // vom Himmel zeigt (_skyAt). Wolken zählen vor freiem Himmel und vor den Bergen, Sterne nur vor freiem Himmel.
  _worldZones(sky) {
    const sc = this._el.scene;
    const sr = sc.getBoundingClientRect();
    const Z = [];
    const add = (k, el, pad) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      Z.push({ k, el, l: r.left - sr.left - pad, t: r.top - sr.top - pad, r: r.right - sr.left + pad, b: r.bottom - sr.top + pad, pad });
    };
    const E = this._gtEls;
    if (E?.has(0)) add('yarn', E.get(0), 8);
    if (E?.has(1)) add('wheel', E.get(1), 4);
    if (!sc.classList.contains('snowcover')) {
      for (const f of this._flowers) if (!f.el.classList.contains('picked')) add('flower', f.el, 6);
    }
    const { hole } = this._g;
    Z.push({ k: 'door', l: hole.l, t: hole.top, r: hole.r, b: hole.lip, pad: 0 });
    if (!sky) return Z;
    if (sky !== 1 && (sc.classList.contains('night') || sc.classList.contains('dusk'))) {
      for (const el of this._el.starEls) if (!el._fell && Number(getComputedStyle(el).opacity) > 0.25) add('star', el, 13);
    }
    for (const el of this._el.clouds) if (el.classList.contains('on')) add('cloud', el, 5);
    return Z;
  }

  // Hat er gerade nichts vor, das ein Blick oder ein „oh!“ stören könnte?
  _calm() {
    return this._petFree() && (this._action == null || ['idle', 'look', 'wander', 'squeak', 'comeHere'].includes(this._action));
  }

  // z: Treffer aus _worldZones. Schläft er, bleibt es leise: Die Dinge antworten, er nicht.
  _worldTap(z) {
    const now = Date.now();
    // je Art höchstens alle 250 ms (Dauerfeuer füllte sonst die Effekt-Ebene)
    const T = (this._worldT ??= {});
    if (now - (T[z.k] || 0) < 250) return;
    T[z.k] = now;
    const awake = !this._asleep;
    const p = this._el.pika;
    const calm = calmMotion();
    const pad = z.pad || 0;
    const cx = (z.l + z.r) / 2;
    const cy = (z.t + z.b) / 2;
    if (z.k === 'flower') {
      // Sie wackelt und staubt. Steht er daneben und hat nichts vor, kribbelt es in der Nase.
      if (!calm) this._wag(z.el, { rotate: ['0deg', '-13deg', '9deg', '-4deg', '0deg'] }, 520);
      this._dust(cx, z.t + pad + (z.b - z.t - 2 * pad) * 0.25);
      if (awake && this._petFree() && Math.abs(cx - this._liveX()) < Math.max(this._g.pW * 1.6, this._W * 0.22)) {
        this._worldReq = { k: 'flower', x: cx };
        this._touchNext('worldReact');
      }
    } else if (z.k === 'cloud') {
      // Sie zuckt zusammen und tröpfelt (in der Ebene der Wolken: hinter Hügeln und Bau)
      if (!calm) this._wag(z.el, { scale: ['1 1', '1.07 .88', '1 1'] }, 380);
      const host = z.el.parentElement;
      const o = (z.el.offsetParent || this._el.scene).getBoundingClientRect();
      const sr = this._el.scene.getBoundingClientRect();
      const w = z.r - z.l - 2 * pad;
      for (let i = 0; i < 5; i++) {
        const d = document.createElement('span');
        d.className = 'gdrop';
        d.style.left = `${(z.l + pad + w * rnd(0.12, 0.88) + sr.left - o.left).toFixed(1)}px`;
        d.style.top = `${(z.b - pad - 2 + sr.top - o.top).toFixed(1)}px`;
        d.style.animationDelay = `${i * 70}ms`;
        d.style.animationFillMode = 'both';
        host.appendChild(d);
        setTimeout(() => d.remove(), 650 + i * 70);
      }
    } else if (z.k === 'star') {
      // Er fällt vom Himmel und ist nach ein paar Sekunden wieder da
      const el = z.el;
      el._fell = true;
      el.style.transition = 'opacity .15s';
      el.style.opacity = '0';
      setTimeout(() => {
        el._fell = false;
        el.style.transition = el.style.opacity = '';
      }, 5000);
      if (!calm) {
        const len = this._Hs * rnd(0.2, 0.3);
        const tilt = rnd(56, 74);
        const m = document.createElement('div');
        m.className = 'met';
        m.style.cssText = `left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;--a:${(cx < this._W / 2 ? tilt : 180 - tilt).toFixed(1)}deg;`
          + `--len:${len.toFixed(1)}px;--tail:${(len * 0.4).toFixed(1)}px;--d:.75s`;
        m.innerHTML = '<b class="mt"></b><b class="mh"></b>';
        this._el.meteors.appendChild(m);
        setTimeout(() => m.remove(), 950);
      }
      if (awake && !this._inside && this._calm()) {
        this._mimik('awe', 1600); // Staunen
        if (Math.random() < 0.6) this._say(pick(['oh!', 'ooh!']), 900);
      }
    } else if (z.k === 'door') {
      // Klopf, klopf. Ist er im Bau, linst er heraus; schläft er, zuckt nur ein Ohr.
      if (!awake) this._cls('stw', 550, true);
      else {
        this._knock();
        if (this._inside) {
          if (!p.classList.contains('tv')) {
            this._pose('peek', 300);
            if (Math.random() < 0.5) this._say(pick(['ja?', 'hm?', 'iiep?']), 900);
          }
        } else if (this._calm() && !p.classList.contains('tilt')) {
          this._cls('tilt', 1400);
          this._emote('q', 1400);
        }
      }
    } else if (z.k === 'wheel') {
      // Es dreht sich kurz ganz schnell (auch nachts und bei Flaute, wo es sonst ruht)
      const el = z.el;
      this._blowUntil = Math.max(this._blowUntil || 0, this._haNow() + 2600);
      el.classList.add('tapspin');
      this._giftScene();
      clearTimeout(this._wheelT);
      this._wheelT = setTimeout(() => {
        el.classList.remove('tapspin');
        this._giftScene();
      }, 2700);
      this._peep(cx, z.t + pad + 2, 'surr!');
    } else if (z.k === 'yarn') {
      if (!this._yarnTap(z.el, cx)) return;
    } else return;
    this._found(z.k);
  }

  // Kurzes Wackeln über die Einzel-Eigenschaften rotate bzw. scale: Sie legen sich über die laufende Animation des
  // Elements (Schaukeln, Ziehen), statt deren transform zu ersetzen. Kennt ein alter Browser sie nicht, bleibt es aus.
  _wag(el, frames, ms) {
    try {
      el.animate?.(frames, { duration: ms, easing: 'ease-out' });
    } catch (e) { /* ohne Wackeln */ }
  }

  // Klopf, klopf: Schriftzug am Eingang
  _knock() {
    const { hole } = this._g;
    this._peep(hole.cx, hole.top + (hole.lip - hole.top) * 0.3, 'klopf, klopf');
    this._found('door');
  }

  // Blütenstaub steigt an der Stelle (x, y) auf
  _dust(x, y) {
    const { pH } = this._g;
    for (let i = 0; i < 6; i++) {
      const el = document.createElement('span');
      el.className = 'pol';
      el.style.left = `${(x + rnd(-0.05, 0.05) * pH).toFixed(1)}px`;
      el.style.top = `${(y + rnd(-0.04, 0.02) * pH).toFixed(1)}px`;
      el.style.setProperty('--px', `${(rnd(-0.14, 0.14) * pH).toFixed(1)}px`);
      el.style.setProperty('--py', `${(rnd(-0.22, -0.06) * pH).toFixed(1)}px`);
      el.style.animationDelay = `${i * 60}ms`;
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 1700 + i * 60);
    }
  }

  // Das Wollknäuel kullert ein Stück vom Finger weg (bleibt dort liegen wie nach seinem Spiel, nur auf diesem Gerät).
  // Nicht, während er selbst damit spielt oder es gerade durch die Luft fliegt (Kopfball: Web Animation, auch beim
  // Auspacken). → true, wenn es gerollt ist
  _yarnTap(el, x) {
    const flying = (a) => !(typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation)
      && !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition);
    if (['giftYarn', 'giftHeader'].includes(this._action) || el.getAnimations?.().some(flying)) return false;
    const { fMin, fMax } = this._g;
    const W = this._W;
    const from = this._giftX(0);
    const roll = (dir) => clamp(from + dir * W * rnd(0.07, 0.14), fMin * W, fMax * W);
    const min = Math.max(8, W * 0.04);
    let to = roll(x <= from ? 1 : -1);
    if (Math.abs(to - from) < min) to = roll(x <= from ? -1 : 1); // am Rand der Wiese: zurück
    if (Math.abs(to - from) < 8) return false;
    this._yarnXf = to / W;
    this._yarnRot = (this._yarnRot || 0) + ((to - from) / (Math.PI * this._H * 0.075)) * 360;
    el.style.transition = 'left .9s cubic-bezier(.2, .7, .4, 1)';
    el.style.left = `${to.toFixed(1)}px`;
    el.querySelector('svg').style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
    clearTimeout(this._yarnT);
    this._yarnT = setTimeout(() => !['giftYarn', 'giftHeader'].includes(this._action) && (el.style.transition = ''), 950);
    return true;
  }

  // Antwort des Pikas auf einen Tipp in die Welt, wo sie eine eigene Aktion braucht (nur, wenn er nichts vorhat)
  async _worldReact() {
    const R = this._worldReq;
    this._worldReq = null;
    if (!R) return;
    if (R.k === 'flower') {
      // Blütenstaub in der Nase
      if (Math.abs(R.x - this._x) > 2) this._face(R.x >= this._x ? 1 : -1);
      await this._wait(250);
      await this._sneeze(true);
    }
  }

  // Kurzer eigener Blick (look-f, look-b, look-up) für ms. Nur den Blick vom letzten Tipp ersetzen: Schaut er gerade
  // für seine Aktion (Vögelchen, Hunger, Bild betrachten), bleibt der Blick dort.
  _glance(c, ms = 1500) {
    const p = this._el.pika;
    clearTimeout(this._lookT);
    if (this._lookC) p.classList.remove(this._lookC);
    this._lookC = null;
    if (['look-f', 'look-b', 'look-up'].some((k) => p.classList.contains(k))) return;
    p.classList.add(c);
    this._lookC = c;
    this._lookT = setTimeout(() => (p.classList.remove(c), (this._lookC = null)), ms);
  }

  // Klick in die Szene, den kein Tippziel abgefangen hat: Die Welt antwortet (Blume, Wolke, Stern, Tür, Windrad,
  // Wollknäuel), und er schaut hin.
  _onLookAt(e) {
    if (!this._g) return;
    const p = this._el.pika;
    const sr = this._el.scene.getBoundingClientRect();
    const x = e.clientX - sr.left;
    const y = e.clientY - sr.top;
    // Leiste und Knöpfe (bei diary: false reicht die Leiste ihren Klick hierher durch) sind keine Welt
    const hit = e.target?.closest?.('.stats, button, .ptag') ? null : worldPick(x, y, this._worldZones(this._skyAt(e)));
    if (hit) this._worldTap(hit);
    // Im Bau (auch beim Fernsehen, Rückansicht) schaut er nicht herum
    if (this._asleep || this._action === 'eatFood' || this._inside || p.classList.contains('tv')) return;
    const up = hit?.k === 'cloud' || hit?.k === 'star';
    this._glance(up ? 'look-up' : Math.sign(x - this._liveX()) === this._dir ? 'look-f' : 'look-b');
    if (hit) return; // die Antwort der Welt ersetzt Herhoppeln und Kopf-schief
    // Heute oft gestreichelt: auf die Wiese getippt, hoppelt er gern hin. Sonst legt er manchmal den Kopf schief.
    const meadow = y > this._g.gy - this._H * 0.3;
    if (meadow) this._found('meadow');
    if (meadow && this._clingy() && this._petFree() && Math.random() < 0.6) {
      this._comeX = clamp(x, this._g.pW * 0.5, this._W - this._g.pW * 0.5);
      this._touchNext('comeHere');
    } else if (!p.classList.contains('tilt') && Math.random() < 0.35) {
      this._cls('tilt', 1400);
      if (Math.random() < 0.5) this._emote('q', 1400);
    }
  }
}
