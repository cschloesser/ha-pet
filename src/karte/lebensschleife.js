// Lebensschleife: Sichtbarkeit, frischer Stand nach einer Pause, Start und Stopp, Wachhund, Warten, Aufräumen,
// Auswahl des nächsten Schritts, Takt

import { Cancel, rnd, pick, pause, weighted } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { screenElsewhere } from '../logik/einstellungen.js';
import { POOP } from '../logik/zustand.js';
import { WX_HOLD } from '../logik/wetter.js';
import { COFFEE_CLS } from '../logik/kaffee.js';
import { TOUCH_NEXT, TOUCH_TTL, PET_NEXT, PET_HOLD, CUTE_CLS } from '../logik/interaktion.js';
import { ACT_SMALL, JUMP_IN, ACT_GREET, ACT_CLS } from '../logik/beschaeftigungen.js';
import { GIFT_CLS } from '../logik/paeckchen.js';

export class Lebensschleife {
  // Schaut keiner hin? Tab im Hintergrund, aus dem Bild gescrollt oder (mit screen_entity) Bildschirm aus. Ein dunkler
  // Kiosk-Bildschirm lässt den Tab sichtbar: ohne screen_entity liefe dann alles die ganze Nacht weiter.
  _away() {
    return document.hidden || !!this._offscreen || this._screenDark();
  }

  // Ist der Bildschirm von screen_entity aus, und ist es der Bildschirm dieses Geräts? Auf einem anderen Gerät mit
  // demselben Dashboard (Rechner mit Maus; Handy, das gerade bedient wird) läuft die Karte weiter.
  _screenDark() {
    return this._screenSt === 'off' && !this._screenWoke && !screenElsewhere();
  }

  // Sichtbarkeit hat sich geändert: unsichtbar ruht alles (Schleife, Besucher, Animationen), sichtbar geht es weiter
  // fresh: Der Anlass kam mit einem frischen Stand aus HA (screen_entity meldet „an“): nicht erst auf einen warten
  _visSync(fresh = false) {
    const away = this._away();
    if (!this._attached || away === this._away0) return;
    this._away0 = away;
    this._el.scene.classList.toggle('paused', away);
    this._fxAnims(away);
    if (away) {
      this._hidAt = document.hidden || this._screenDark() ? Date.now() : null;
      this._goneAt ??= Date.now(); // für das Wiedersehen
      this._flush();
      this._stop();
      // Ein Sprung auf der Stelle stünde mit .paused in der Luft still, gezählt wird aber weiter (jumpBusy, _jumpT):
      // Er endet jetzt, ungesehen, am Boden
      this._jumpOn = null;
      for (const el of [this._el.jump, this._el.shadow]) el.classList.remove('hop1', 'binky');
      this._stopCritters();
      this._hiddenFeatures(true);
      this._giftFromPlan(); // woanders schon ausgepackt: hier schaut jetzt keiner mehr zu, dann ist es weg
      return;
    }
    // Länger versteckt: Der Stand aus HA (Tagesplan, Wetter) ist wohl veraltet, die Verbindung baut sich gerade neu
    // auf. Beschäftigungen erst wählen, wenn ein frischer Stand da ist, sonst zeigte dieses Gerät eine andere.
    // Geht der Bildschirm über screen_entity an, kam die Meldung über dieselbe Verbindung wie Tagesplan und Wetter:
    // Der Stand ist frisch, der Pika steht im selben Augenblick mitten in der laufenden Beschäftigung.
    const long = !!this._hidAt && Date.now() - this._hidAt > 30000;
    if (long && !fresh) this._planStaleArm();
    this._hidAt = null;
    // Wieder zu sehen: Nur jetzt gleich darf er ohne Hinlaufen an einem anderen Platz stehen (_jumpIn). Muss er erst
    // auf den frischen Stand warten, hat man ihn inzwischen gesehen, dann hoppelt er hin.
    this._blindAt = Date.now();
    this._blindFirst = false;
    // Über die Pause wurde es Schlafenszeit (Bildschirm abends aus, nachts an): Er liegt längst im Bett, statt jetzt erst
    // hinzulaufen. Das Aufwachen am Morgen spielt dagegen die Schleife (_wakeUp), danach begrüßt er (_showReq).
    if (long && this._g && !this._asleep && this._sleepTime()) {
      if (this._next === 'poop') this._next = null;
      this._revealPending();
      this._sleepNow(true);
      this._updateSky();
    }
    this._showReq();
    this._start();
    this._startCritters();
    this._hiddenFeatures(false);
    this._planeSnap();
    this._tick();
  }

  // screen_entity (z. B. der Bildschirm-Schalter von Fully Kiosk): geht er an, ist das wie Sichtbarwerden. Fully
  // meldet das mit etwas Verzug; kam die Sichtbarkeit schon, verhindert die Sperre eine zweite Begrüßung.
  _hassAct(hass) {
    const id = this._cfg.screen_entity;
    const st = id ? hass.states[id]?.state : undefined;
    if (st === this._screenSt) return;
    this._screenSt = st;
    this._screenWoke = false;
    // Bildschirm aus: wie ein versteckter Tab ruht alles (Schleife, Besuche, Animationen). Geht er an, steigt der Pika
    // wie nach dem Neuladen gleich mitten in der Beschäftigung ein und winkt (_visSync → _start, _showReq). Die Meldung
    // „an“ kam eben über die Verbindung: Tagesplan und Wetter (in set hass vor _hassAct schon gelesen) sind so frisch
    // wie sie, er muss nicht erst an seiner alten Stelle auf einen neuen Stand warten.
    if (this._el) this._visSync(st === 'on' && hass.connected !== false);
  }

  // .paused hält nur CSS-Animationen an: die Web Animations der Effekte (Seifenblasen, Schmetterling, Blütenwurf)
  // ebenso anhalten und beim Wiedersehen weiterlaufen lassen
  _fxAnims(stop) {
    if (stop) {
      const all = this._el.fx.getAnimations?.({ subtree: true }) || [];
      this._fxPaused = all.filter((a) => a.playState === 'running'
        && !(typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation)
        && !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition));
      this._fxPaused.forEach((a) => a.pause());
    } else {
      (this._fxPaused || []).forEach((a) => a.playState === 'paused' && a.play());
      this._fxPaused = null;
    }
  }

  _planStaleArm(ms = 4000) {
    this._planStale = true;
    this._staleStates = this._hass?.states;
    clearTimeout(this._staleT);
    // Kommt kein neuer Stand (es hat sich nichts geändert), gilt der alte nach 4 s, sobald die Verbindung steht
    const check = () => {
      if (this._hass?.connected === false) this._staleT = setTimeout(check, 2000);
      else this._planFresh();
    };
    this._staleT = setTimeout(check, ms);
  }

  // Weiß die Schleife noch nicht, was gerade läuft (Stand nach langer Pause veraltet, Helfer des Tagesplans noch
  // nicht gelesen)? Dann wartet sie kurz, statt zu grüßen oder etwas anzufangen: Sonst winkte er an einer Stelle
  // und stünde gleich darauf samt Requisit an einer anderen. Höchstens JUMP_IN.first ms, danach lebt er weiter.
  _planWait() {
    // since < 0: Die Geräteuhr wurde zurückgestellt. Dann nicht warten (wie jumpInOk), sonst wartete er, bis die Uhr
    // den alten Stand wieder erreicht.
    const since = this._sinceBlind();
    return (this._planStale || (!!this._cfg.plan_entity && !this._planOk)) && since >= 0 && since < JUMP_IN.first;
  }

  _planFresh() {
    if (!this._planStale) return;
    this._planStale = false;
    clearTimeout(this._staleT);
    if (this._running && (this._planWaiting || (ACT_SMALL.includes(this._action) && this._slotNow()))) this._interrupt();
  }

  _start() {
    if (this._running || !this.isConnected || this._away() || !this._g) return;
    this._running = true;
    this._slotArm();
    const run = ++this._runId;
    (async () => {
      while (run === this._runId) {
        this._ac = new AbortController();
        this._waitDue = Date.now(); // für den Wachhund (_watchdog)
        try {
          await this._step();
        } catch (e) {
          if (!(e instanceof Cancel)) {
            this._err(`Schleife (${this._action || 'Auswahl'})`, e);
            await pause(2000);
          }
        }
        if (run !== this._runId) return;
        // Auch das Aufräumen darf die Schleife nicht beenden: Sie liefe nie wieder an (_running bliebe wahr), der Pika
        // stünde auf einem Bildschirm, der immer an ist, bis zum Neuladen still.
        try {
          // Wird gleich weitergestreichelt, bleibt die Streichel-Mimik bis zur nächsten Reaktion stehen (PET_HOLD)
          this._cleanup(PET_NEXT.has(this._next) && Date.now() - (this._nextAt || 0) < TOUCH_TTL);
        } catch (e) {
          this._err('Aufräumen', e);
        }
        await pause(40);
      }
    })();
  }

  // Wachhund: Die Schleife wartet immer mit Frist (_wait). Ist die bei zwei Ticks hintereinander (20 s Abstand) seit
  // über 90 s um, hängt sie an etwas, das nie fertig wird: neu starten. Zwei Ticks, weil nach einem Geräteschlaf
  // alle Zeitgeber auf einmal fällig sind und der Tick vor dem nächsten _wait drankommen kann.
  _watchdog() {
    const late = this._running && this._waitDue > 0 && Date.now() - this._waitDue > 90000;
    this._wdHit = late ? (this._wdHit || 0) + 1 : 0;
    if (this._wdHit < 2) return;
    this._wdHit = 0;
    this._err('Wachhund', new Error(`Schleife stand bei „${this._action || 'Auswahl'}“, neu gestartet`));
    this._stop();
    this._start();
  }

  _stop() {
    this._running = false;
    this._waitDue = 0;
    this._planWaiting = false; // sonst bräche der nächste frische Stand ab, was nach dem Wiederanlaufen gerade läuft
    clearTimeout(this._slotT);
    this._slotT = null;
    this._runId++;
    this._ac?.abort();
    // Ein Finger, der beim Anhalten noch lag: Sein Zeitgeber streichelte sonst die angehaltene Karte
    clearTimeout(this._pressT);
    this._press = null;
    this._kraulOn = false;
    if (this._el) {
      this._pressFx(null);
      this._cleanup();
      // Ein zurückgehaltenes Häufchen liegt jetzt einfach da: Bis die Schleife wieder läuft (Bildschirm an, Ansicht
      // wieder da), kann es Stunden her sein, er führte es sonst vor, obwohl es überall längst liegt
      this._layPending();
    }
  }

  _interrupt() {
    this._ac?.abort();
  }

  _wait(ms) {
    const sig = this._ac.signal;
    this._waitDue = Date.now() + ms;
    return new Promise((resolve, reject) => {
      if (sig.aborted) return reject(new Cancel());
      const onAbort = () => (clearTimeout(t), reject(new Cancel()));
      const t = setTimeout(() => (sig.removeEventListener('abort', onAbort), resolve()), ms);
      sig.addEventListener('abort', onAbort, { once: true });
    });
  }

  // hold: Die nächste Streichel-Reaktion steht schon an. Dann bleiben geschlossene Augen, Lächeln und Haltung
  // (PET_HOLD) stehen, bis _step sie zusammen mit den neuen Klassen tauscht.
  _cleanup(hold = false) {
    const p = this._el.pika;
    // Mitten im Laufen oder im Purzelbaum: stehen bleiben, wo er gerade ist (sonst glitte er zum Ziel weiter)
    if (p.classList.contains('walking') || p.classList.contains('purzel')) this._freeze();
    const all = ['walking', 'eating', 'groom', 'carry', 'look-f', 'look-b', 'look-up', 'happy', 'calling', 'crouch', 'squat', 'sniff',
      'reading', 'doze', 'gaming', 'meh', 'lying', 'tablet', 'tplane', 'swipe', 'kiting', 'tv',
      'coffee', 'sip', 'hot', 'foam', 'lick', ...COFFEE_CLS, ...ACT_CLS, ...CUTE_CLS, ...GIFT_CLS];
    p.classList.remove(...(hold ? all.filter((c) => !PET_HOLD.includes(c)) : all));
    // Der kurze Blick vom letzten Tipp (_glance) ist mit weg: sein Zeitgeber nähme sonst der nächsten Aktion den Blick
    clearTimeout(this._lookT);
    this._lookC = null;
    this._petHeld = hold;
    this._mimik(null);
    this._tvOn(false);
    this._kiteAway();
    this._easelAway();
    this._apropsAway();
    this._mouth(null);
    this._bubble(this._el.think, false);
    this._action = null;
  }

  async _step() {
    // Der Merker gilt nur für diesen Schritt: Biegt er vor der Wartezeile ab (herunter vom Stein, Kaffee, Schlafen,
    // Aufwachen, Traum), bräche der frische Stand sonst die fremde Aktion ab (_planFresh, _planReady)
    this._planWaiting = false;
    // Über das Aufräumen gehaltene Streichel-Mimik: jetzt weg, im selben Atemzug setzt die nächste Aktion ihre eigene
    if (this._petHeld) {
      this._petHeld = false;
      this._el.pika.classList.remove(...PET_HOLD);
    }
    if (!this._g) return this._wait(500);
    // Eine Berührung von vor Kaffee, Schlafengehen oder Begrüßung ist vorbei: nicht Minuten später darauf reagieren
    if (TOUCH_NEXT.has(this._next) && Date.now() - (this._nextAt || 0) > TOUCH_TTL) this._next = null;
    // In der Hängematte unterbrochen: aus ihr heraus (nicht zum Stein). Am Boden (z. B. schon beim Anlauf
    // unterbrochen, _lift kommt erst mit dem Sprung) gilt der Merker nicht mehr.
    if (!(this._lift > 0)) this._onHam = false;
    if (this._lift > 0 && this._onHam) return this._run('giftHamDown');
    // Unterbrochen, während er auf dem Stein stand: erst herunter. Trinkt er dort oben Kaffee, trinkt er weiter.
    const cof = this._cof?.pend;
    if (this._lift > 0 && !(cof?.rock && cof.stage === 'drink' && this._coffeeDue())) return this._run('hopDown');
    // Frischer Kaffee: holt er sich sofort, der Duft weckt ihn sogar auf (danach schläft er weiter)
    if (this._coffeeDue()) return this._run(this._asleep ? 'wakeUp' : 'coffee');
    const sleepy = this._sleepTime();
    if (sleepy && !this._asleep) {
      // Wollte er gerade ein Häufchen machen: liegt es eben gleich da, sonst bliebe es bis morgen unsichtbar
      if (this._next === 'poop') this._next = null;
      this._revealPending();
      return this._run('goSleep');
    }
    if (!sleepy && this._asleep) return this._run('wakeUp');
    if (this._asleep) return this._run('dream');
    const food = this._foods.find((f) => f.landed);
    const next = this._next;
    this._slot = null;
    this._slotArm();
    // Noch unklar, was gerade läuft: kurz stillhalten (Berührung und Futter gehen vor). Kommt der Stand, weckt
    // _planFresh bzw. _planReady die Schleife sofort.
    this._planWaiting = !next && !food && this._planWait();
    if (this._planWaiting) return this._wait(100);
    const fu = next || food || this._inside ? null : this._friendUrgent();
    if (fu) return this._run(fu);
    // Beschäftigung aus dem Tagesplan: läuft gerade eine, macht er mit (Futter und Vorschau-Knöpfe gehen vor)
    const S = next || food ? null : this._slotNow();
    if (S) {
      if (this._greetDue) {
        this._greetDue = false;
        this._reunion = false;
        if (Date.now() - this._showAt < 30000) setTimeout(() => this._action === S.act && this._say(pick(ACT_GREET), 1500), 900);
      }
      return this._runSlot(S);
    }
    if (this._greetDue) {
      this._greetDue = false;
      if (Date.now() - this._showAt < 30000) return this._run('greet');
    }

    const wx = this._wx;
    const stayIn = next ? next === 'burrow' || next === 'tv' : wx.shelter && !food;
    if (this._inside && !stayIn) return this._run('comeOut');
    if (next) {
      this._next = null;
      this._forced = !TOUCH_NEXT.has(next); // Vorschau: auch ohne passendes Wetter
      return this._run(next);
    }
    this._forced = false;
    // Ein Häufchen wurde fällig, während er beschäftigt war, und hat gewartet (_renderPiles): jetzt ist Zeit dafür.
    // Nur solange es frisch ist: Ein älteres liegt auf den anderen Geräten längst da, hier dann auch.
    if (this._poopPending) {
      if (this._canPoopLive() && this._now() - this._poopPending.due < POOP.live * 6e4) return this._run('poop');
      this._layPending();
    }
    if (food) return this._run('eatFood', food);
    // Päckchen am Ballon: herunterschießen, dann auspacken (nach Futter und Beschäftigungen aus dem Plan)
    const gd = this._giftDue();
    if (gd) return this._run(gd);
    // Bei Starkregen und Gewitter im Bau bleiben und ab und zu herausschauen (fernsehen kommt aus dem Tagesplan)
    if (wx.shelter) return this._run(this._inside ? 'hideout' : 'shelter');

    const s = this._get('s');
    const g = this._get('g');
    const { piles, clean } = this._poops();
    this._el.pika.classList.toggle('sad', g < 25 || s < 15 || clean < 30);
    // satt und zufrieden: ruhiger atmen
    this._el.pika.classList.toggle('calm', s > 70 && g > 75 && clean > 60);
    // Unter Schnee gibt es keine Blumen, bei Regen bleibt das Heu trocken (kein Sammeln)
    const hasFlowers = this._flowers.length > 0 && !wx.snowcover;
    const elev = this._dbgElev ?? this._elev;
    // Zusatz-Aktionen der Erweiterungen (Himmel, Festtage, Freund, Haus-Bote) bekommen dieselbe Lage.
    // Beschäftigungen und das Sammeln für den Vorrat kommen nur aus dem Tagesplan (oben).
    const ctx = { s, g, wx, elev, piles, clean, hasFlowers };
    const act = weighted([
      [3, 'idle'],
      [3, 'look'],
      [3, 'wander'],
      [wx.wet ? 2 : 1, 'burrow'],
      [wx.wet ? 0.4 : 1.6, 'lookout'],
      [hasFlowers ? (s < 50 ? 3 : 1.2) : 0, 'nibble'],
      [wx.snowcover || wx.wet ? 1.2 : 0, 'haySnack'],
      [wx.wet ? 0 : 1.4, 'groom'], // eine Pfote hält bei Regen das Blatt
      [0.8, 'squeak'],
      [wx.wet || calmMotion() ? 0 : g > 70 ? 1.2 : g > 40 ? 0.4 : 0, 'binky'],
      [s < 30 ? 3 : 0, 'hungry'],
      [piles.length && clean < 60 ? 1.2 : 0, 'sniff'],
      [this._bird?.sitting ? 2.5 : 0, 'watchBird'],
      [this._mouse?.out ? 2.5 : 0, 'watchMouse'],
      [this._frog?.out ? 2.5 : 0, 'watchFrog'],
      [this._snail?.out && !this._snail.hidden ? 2.5 : 0, 'watchSnail'],
      [this._planeToWatch() ? 2.5 : 0, 'watchPlane'],
      ...this._cuteActs(ctx),
      ...this._skyActs(ctx),
      ...this._festActs(ctx),
      ...this._friendActs(ctx),
      ...this._boteActs(ctx),
      ...this._coffeeActs(ctx),
      ...this._giftActs(ctx),
    ]);
    return this._run(act);
  }

  _run(name, ...args) {
    this._action = name;
    return this['_' + name](...args);
  }

  _loop(fn, min, max) {
    const h = { t: 0 };
    // Unsichtbar nur weiterzählen, nichts tun (Blinzeln, Ohrenzucken, Blitze sieht keiner)
    // Wirft fn einmal, läuft die Schleife trotzdem weiter (sonst blinzelte er bis zum Neuladen nie wieder)
    const next = () => (h.t = setTimeout(() => {
      try {
        if (!this._away()) fn();
      } catch (e) {
        this._err('Kleinigkeit', e);
      } finally {
        next();
      }
    }, rnd(min, max)));
    this._loops.push(h);
    next();
  }

  _tick() {
    // Unsichtbar: nur Fristen pflegen, alles andere holt der Tick beim Sichtbarwerden nach
    if (this._away()) return this._tickCoffee();
    this._watchdog();
    // Ein Fehler in einem Teil soll die anderen nicht mitreißen (wie in set hass)
    for (const f of [this._tickCore, this._tickSky, this._tickFest, this._tickFriend, this._tickBote, this._tickCoffee,
      this._tickGift, this._diaryDot]) {
      this._guard(f.name, () => f.call(this));
    }
  }

  _tickCore() {
    this._renderStats();
    // Vorrat verfällt auch ohne neue Plan-Änderung (ändert nur etwas, wenn ein Tag um ist)
    if (this._plan) this._hayFromPlan();
    // Frischer Kaffee hält ihn kurz wach (er trinkt aus und schläft dann weiter). Ein Päckchen packt er noch fertig
    // aus (sonst verschwände der Inhalt ohne Vorführung), danach geht er von selbst schlafen (_step).
    if (this._sleepTime() !== this._asleep && !['goSleep', 'wakeUp', 'coffee', 'giftOpen'].includes(this._action)) {
      this._interrupt();
    }
    if (this._wxDeadAt > 0 && Date.now() - this._wxDeadAt >= WX_HOLD) this._readWeather(this._lastWeather, this._lastPrecip);
    this._updateSky();
  }

  _hiddenFeatures(hidden) {
    if (!hidden) this._readFlights(this._lastFlights); // unsichtbar wurden keine Flieger angelegt
    this._hiddenSky(hidden);
    this._hiddenFest(hidden);
    this._hiddenFriend(hidden);
    this._hiddenBote(hidden);
  }
}
