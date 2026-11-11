// Kaffee: Bezug erkennen, schnuppern, holen, trinken

import { rnd, pick, clamp, seedRnd } from '../logik/hilfen.js';
import {
  COFFEE_PROG, coffeeKind, COFFEE_CUP, COFFEE_SIPS, COFFEE_FOAM, coffeeName, COFFEE_FETCH, COFFEE_CTR_MS, COFFEE_LATE,
  COFFEE_DRINK, COFFEE_CLS,
} from '../logik/kaffee.js';
import { JUMP_IN } from '../logik/beschaeftigungen.js';
import { COFFEE_THINK } from '../grafik/momente.js';

export class Kaffee {
  // Kaffeevollautomat aus `coffee` ({ active, counter, selected }):
  // - active: aktives Programm (select). Ein Getränkeprogramm heißt: gerade wird ein Bezug gemacht. Der Pika
  //   schnuppert dann und denkt an Kaffee. Einschalten mit Spülen und Reinigen setzen kein Programm.
  // - counter: Tassenzähler (zählt zu Beginn des Bezugs hoch). Fertig ist ein Bezug, wenn kein Getränk mehr
  //   läuft und das Programm mindestens 15 s nach dem Zählerstand endete (ohne live gesehenen Bezug höchstens
  //   COFFEE_CTR_MS danach). So erkennt jedes Gerät denselben Bezug, auch nach dem Neuladen. Ein Neustart von HA
  //   zählt nicht (Programm kam aus "unavailable" oder Zähler kurz nach dem Start gültig).
  // - selected: ausgewähltes Programm. Daraus kommt die Getränkeart, wenn die Karte den Bezug nicht live sah.
  // Gleich danach holt er sich dasselbe Getränk aus dem Bau und trinkt es (Schlaf unterbricht er dafür), nach einer
  // festen Zeitleiste ab Bezugsende (COFFEE_FETCH, COFFEE_DRINK): Alle Geräte trinken im selben Takt, ein neu
  // geladenes steigt mit dem passend leeren Gefäß ein. Gemerkt wird dafür nichts.

  _hassCoffee(hass) {
    const c = this._cfg?.coffee;
    if (!c?.active) return;
    const S = hass.states;
    const a = S[c.active];
    const n = c.counter ? S[c.counter] : undefined;
    const sel = c.selected ? S[c.selected] : undefined;
    if (a === this._cofA && n === this._cofN && sel === this._cofS) return;
    this._cofA = a;
    this._cofN = n;
    this._cofS = sel;
    const C = (this._cof ??= { brew: null, pend: null, next: null, done: [] });
    const prevSt = C.st; // zuletzt gesehener Zustand des Programms (undefined: frisch geladen)
    C.st = a?.state;
    const prog = String(a?.state || '').toLowerCase();
    const now = this._haNow();
    if (COFFEE_PROG.test(prog)) {
      if (C.brew?.prog !== prog) {
        C.brew = { prog, at: Date.parse(a.last_changed) || now, sniffed: false };
        // Steht er nur herum, gleich die Nase heben; schläft er, zuckt er kurz im Schlaf
        if (this._asleep && this._el && now - C.brew.at < 60000) {
          this._el.pika.classList.add('peek');
          setTimeout(() => this._el.pika.classList.remove('peek'), 900);
        } else if (['idle', 'look', 'wander', 'groom'].includes(this._action)) this._interrupt();
      }
      return;
    }
    // Kurz nicht erreichbar: der laufende Bezug bleibt gemerkt
    if (!a || a.state === 'unavailable') return;
    const brew = C.brew;
    C.brew = null;
    const end = Date.parse(a.last_changed) || now;
    let key = null;
    const t0 = n && n.state !== 'unavailable' && n.state !== 'unknown' && Date.parse(n.last_changed);
    const used = (k) => C.done.includes(k) || C.pend?.key === k || C.next?.key === k;
    // Live gesehen zählt auch, wenn der Zähler spät noch einmal hochging (zwei Tassen)
    if (brew) {
      if (t0 && end - t0 < 15 * 60000 && (end - t0 >= 15000 || end - brew.at >= 15000)) key = n.last_changed;
    } else if (t0 && end - t0 >= 15000 && end - t0 <= COFFEE_CTR_MS && prevSt !== 'unavailable') {
      // Nur aus dem Zähler (neu geladen, Bezug nicht live gesehen): ein Bezug dauert keine 3 Minuten. Nicht nach
      // einem Neustart von HA: Kam das Programm gerade aus "unavailable" zurück, oder wurde der Zähler kurz nach dem
      // Start gültig (_haBoot), melden sich Zähler und Programm nur nacheinander zurück.
      if (!this._haBoot(t0)) key = n.last_changed;
    }
    // Zählte der Zähler diesen Bezug nicht (Heißwasser/Tee, eigener Zähler: sein Stand ist alt oder schon
    // getrunken), gilt, was die Karte live sah. brew.at ist die Zeit von HA, auf allen zusehenden Geräten gleich.
    if ((!key || used(key)) && brew && end - brew.at >= 15000 && end - brew.at < 15 * 60000) key = `live ${brew.at}`;
    if (!key || used(key)) return;
    const p = brew?.prog || String(sel?.state || '').toLowerCase();
    const kind = coffeeKind(p);
    const r = (i) => seedRnd('coffee', key, i);
    const sip = (COFFEE_DRINK[kind] * (0.85 + r(0) * 0.3)) / COFFEE_SIPS[kind];
    const P = {
      key, kind, name: coffeeName(p, kind), t0: end, sip, end: end + COFFEE_FETCH + COFFEE_SIPS[kind] * sip,
      rockR: r(1), faceR: r(2), stage: 'fetch', lv: 1, j: 0,
    };
    // Auf den anderen Geräten längst ausgetrunken. Gemerkt, damit ein späteres Zucken des Programms (WLAN weg,
    // unavailable → unknown) denselben Bezug nicht noch einmal auslöst.
    if (now > P.end - 3000) return this._coffeeMark(key);
    // Trinkt er noch den vorigen (oder holt ihn gerade): dieser kommt gleich danach dran
    if (C.pend) {
      if (C.next) this._coffeeMark(C.next.key);
      C.next = P;
      return;
    }
    C.pend = P;
    // Sofort holen, auch mitten in einer Beschäftigung (die geht danach an ihrer Stelle im Plan weiter);
    // im Schlaf weckt ihn der Duft
    // Auspacken und Ausräumen macht er noch fertig (danach ist der Kaffee dran)
    if (!['eatFood', 'coffee', 'goSleep', 'wakeUp', 'giftShoot', 'giftOpen', 'boteEmpty'].includes(this._action)) this._interrupt();
  }

  _tickCoffee() {
    const C = this._cof;
    if (!C) return;
    const now = this._haNow();
    // Nicht abgeholt (Sturm, Karte war versteckt): verfällt. Hängt ein Bezug ewig, nicht mehr schnuppern.
    if (C.pend?.stage === 'fetch' && now > C.pend.end - 3000) {
      this._coffeeMark(C.pend.key);
      C.pend = null;
    }
    // Angetrunken und dann unterbrochen (Bildschirm aus, Gewitter): auf den anderen Geräten längst leer. Nicht Stunden
    // später den letzten Schluck nehmen (oder ihn dafür nachts wecken), sondern verfallen lassen.
    if (C.pend && C.pend.stage !== 'fetch' && now > C.pend.end + COFFEE_LATE && this._action !== 'coffee') {
      this._coffeeMark(C.pend.key);
      C.pend = null;
    }
    if (!C.pend && C.next) {
      C.pend = C.next;
      C.next = null;
    }
    if (C.brew && now - C.brew.at > 10 * 60000) C.brew.sniffed = true;
  }

  _coffeeDue() {
    const P = this._cof?.pend;
    return !!P && !this._next && !this._wx.shelter && this._haNow() <= P.end + (P.stage === 'fetch' ? -3000 : COFFEE_LATE);
  }

  _coffeeActs() {
    const B = this._cof?.brew;
    return B && !B.sniffed ? [[60, 'coffeeSniff']] : [];
  }

  _coffeeMark(key) {
    const C = this._cof;
    C.done = [...C.done.filter((k) => k !== key), key].slice(-6);
  }

  // Kaffeeduft: Nase hoch, schnuppern, an Kaffee denken, dann erwartungsvoll zum Bau
  async _coffeeSniff() {
    const B = this._cof?.brew;
    if (!B) return;
    B.sniffed = true;
    const p = this._el.pika;
    const think = this._el.think;
    p.classList.add('look-up');
    await this._wait(500);
    this._twitch();
    await this._wait(450);
    this._twitch();
    this._say(pick(['schnupper…', 'hm?', 'riecht gut!']), 1300);
    await this._wait(1300);
    p.classList.remove('look-up');
    clearTimeout(this._thinkT);
    think.innerHTML = COFFEE_THINK;
    try {
      this._bubble(think, true);
      await this._wait(2600);
      this._bubble(think, false);
      await this._wait(300);
    } finally {
      this._thinkReset();
    }
    // neben die Nische (bzw. den Heuhaufen), mit Blick zur Tür
    await this._walkTo(this._g.stand + this._g.pW * 0.16, 1.2);
    this._face(-1);
    await this._wait(rnd(1500, 3000));
  }

  // Im Bau eine Tasse holen, mit ihr herauskommen und trinken: auf dem Stein oder vor der Tür, Schluck für Schluck.
  // Unterbrochen (Futter, Größenänderung) geht es an derselben Stelle im Ablauf weiter.
  async _coffee() {
    this._memo('coffee');
    const P = this._cof.pend;
    const p = this._el.pika;
    const { stand, pW, rock } = this._g;
    const night = this._sleepTime();
    const setLv = () => {
      p.style.setProperty('--lv', P.lv.toFixed(2));
      p.classList.toggle('hot', P.lv > 0.45);
    };
    const sips = COFFEE_SIPS[P.kind];
    if (P.stage === 'fetch') {
      this._coffeeMark(P.key);
      P.rock = !night && !this._wx.wet && P.rockR < 0.5;
    }
    // Neu geladen, während die anderen Geräte schon trinken: gleich am Trinkplatz, das Gefäß so leer wie dort
    const since = this._sinceBlind(); // < 0: Geräteuhr zurückgestellt, dann wie gesehen (er läuft hin)
    if (P.stage === 'fetch' && this._haNow() - P.t0 > 4000 && since >= 0 && since < (this._blindFirst ? JUMP_IN.first : JUMP_IN.again)) {
      P.j = clamp(Math.floor((this._haNow() - P.t0 - COFFEE_FETCH) / P.sip) + 1, 0, sips - 1);
      P.lv = 1 - P.j / sips;
      P.foam = P.j > 0 && COFFEE_FOAM.has(P.kind);
      this._inside = false;
      this._pose('out', 0);
      if (P.rock) {
        this._lift = rock.lift;
        this._setX(rock.cx, true);
      } else {
        this._lift = 0;
        this._setX(stand + pW * 0.16, true);
      }
      this._face(P.rock ? (P.faceR < 0.5 ? -1 : 1) : 1);
      P.stage = 'drink';
    }
    if (P.stage === 'fetch') {
      if (!this._inside) {
        this._say(night ? '*gähn*' : P.name, 1200);
        await this._wait(500);
        await this._enterBurrow(1.3);
      } else {
        if (night) {
          this._say('*gähn*', 1200);
          await this._wait(1000);
        }
        await this._to('hidden', 400);
      }
      await this._wait(clamp(P.t0 + 4500 - this._haNow(), 800, 2800)); // drinnen klappert es
      P.stage = 'out';
    }
    p.classList.add('coffee', `ck-${COFFEE_CUP[P.kind]}`, `ck-${P.kind}`);
    p.classList.toggle('foam', !!P.foam);
    setLv();
    // Nach einem Gewitter im Bau: zum Weitertrinken vor die Tür
    if (P.stage === 'drink' && this._inside) {
      await this._to('peek', 450);
      await this._comeOut();
    }
    // Nach einer Unterbrechung ist er vom Stein schon heruntergehüpft
    if (P.stage === 'drink') P.rock = this._lift > 0;
    if (P.stage === 'out') {
      if (this._inside) {
        await this._to('peek', 450);
        await this._wait(rnd(500, 900));
        await this._comeOut();
      }
      if (!night) this._say(P.name, 1300);
      // Tagsüber und trocken gern oben auf dem Aussichtsstein (fest je Bezug), sonst vor der Tür
      if (P.rock) {
        await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1), 0.7);
        if (this._bird?.perch === 'rock') {
          this._bird.scare();
          await this._wait(600);
        }
        await this._hopTo(rock.cx, rock.lift);
        this._puff(rock.cx, this._g.gy - rock.lift, 2);
      } else await this._walkTo(stand + pW * 0.16, 0.7); // wie beim Lesen: die Nische bleibt frei
      this._face(P.rock ? (P.faceR < 0.5 ? -1 : 1) : 1);
      P.stage = 'drink';
      await this._wait(800);
    }
    // Schluck j zur festen Zeit t0 + COFFEE_FETCH + j · sip. Hängt er mehr als einen Schluck hinterher (aufgewacht,
    // Bildschirm erst später an), ist das Gefäß gleich so leer wie auf den anderen Geräten, statt hastig aufzuholen.
    const sipAt = () => P.t0 + COFFEE_FETCH + P.j * P.sip;
    while (P.lv > 0.01) {
      const due = Math.floor((this._haNow() - P.t0 - COFFEE_FETCH) / P.sip) + 1; // nächster Schluck nach Plan
      if (due > P.j + 1) {
        P.j = Math.min(due, sips - 1);
        P.lv = 1 - P.j / sips;
        P.foam = COFFEE_FOAM.has(P.kind);
        p.classList.toggle('foam', P.foam);
        setLv();
      }
      // Zwischen den Schlucken: Gefäß in den Pfoten, genießen, umschauen
      while (sipAt() - this._haNow() > 9000) {
        await this._wait(rnd(5000, 8000));
        const r = Math.random();
        if (r < 0.3) this._twitch();
        else if (r < 0.5 && !night) this._face(-this._dir);
        else if (r < 0.62) this._say(night ? pick(['*gähn*', 'mmh…']) : P.lv > 0.45 ? pick(['pust…', 'mmh…']) : pick(['mmh…', 'ahh…', '♥']), 1100);
      }
      await this._wait(Math.max(300, sipAt() - this._haNow()));
      p.classList.add('sip');
      await this._wait(1400);
      const first = P.j === 0;
      P.j++;
      P.lv = Math.max(0, 1 - P.j / sips);
      p.classList.remove('sip');
      setLv();
      if (COFFEE_FOAM.has(P.kind)) {
        P.foam = true;
        p.classList.add('foam');
      }
      await this._wait(400);
      const r = Math.random();
      if (first && P.kind !== 'milk' && r < 0.4) {
        this._say('heiß!', 900);
        this._twitch();
      } else if (r < 0.45) this._say(pick(['mmh…', 'ahh…', '♥', 'lecker!', 'schlürf']), 1200);
      else if (r < 0.65) this._twitch();
      else if (r < 0.8 && !night) this._face(-this._dir);
    }
    // Leer: zufrieden, Schaum ablecken
    await this._wait(600);
    this._happy(1400);
    this._say('ahh!', 1200);
    await this._wait(1500);
    if (P.foam) {
      p.classList.add('lick');
      this._say('schleck!', 900);
      await this._wait(600);
      p.classList.remove('lick', 'foam');
      await this._wait(400);
    }
    // Kam inzwischen ein zweiter Bezug, ist der als Nächstes dran (nicht einfach löschen)
    if (this._cof.pend === P) {
      this._cof.pend = this._cof.next;
      this._cof.next = null;
    }
    // Koffein! Tagsüber ein paar Freudensprünge, nachts ein Gähnen (er schläft gleich weiter)
    if (!night && P.kind !== 'tea' && P.kind !== 'milk' && Math.random() < 0.7) {
      if (P.rock) {
        await this._hopDown();
        P.rock = false;
      }
      this._say(pick(['wach!', 'wuiii!', 'zack!']), 1100);
      for (let i = 0; i < 2; i++) {
        this._jump('binky');
        await this._wait(1000);
      }
    } else if (night) {
      this._say('*gähn*', 1200);
      await this._wait(1200);
    }
    // Leere Tasse zurück in den Bau
    if (P.rock) await this._hopDown();
    await this._enterBurrow(1.1);
    p.classList.remove('coffee', 'hot', ...COFFEE_CLS);
    await this._wait(600);
  }
}
