// Die Karte: constructor, setConfig, set hass, Größe, Ein- und Aushängen, Fehlernetz

import { clamp } from './logik/hilfen.js';
import { WAKE_EVENTS, DEFAULTS } from './logik/einstellungen.js';
import { sec, freshStats, parseStats, mergeStats } from './logik/zustand.js';
import { AREALE } from './grafik/areale.js';
import { Editor } from './karte/editor.js';
import { Aufbau } from './karte/aufbau.js';
import { Schlaf } from './karte/schlaf.js';
import { Lebensschleife } from './karte/lebensschleife.js';
import { Alltag } from './karte/alltag.js';
import { Wiese } from './karte/wiese.js';
import { Haeufchen } from './karte/haeufchen.js';
import { Besucher } from './karte/besucher.js';
import { Flugzeuge } from './karte/flugzeuge.js';
import { Beschaeftigungen } from './karte/beschaeftigungen.js';
import { BeschaeftigungenGross } from './karte/beschaeftigungen-gross.js';
import { Bausteine } from './karte/bausteine.js';
import { Interaktion } from './karte/interaktion.js';
import { Tagebuch } from './karte/tagebuch.js';
import { Momente } from './karte/momente.js';
import { Feste } from './karte/feste.js';
import { Zustand } from './karte/zustand.js';
import { Pino } from './karte/pino.js';
import { Himmel } from './karte/himmel.js';
import { Wetter } from './karte/wetter.js';
import { HausBote } from './karte/haus-bote.js';
import { Kaffee } from './karte/kaffee.js';
import { Paeckchen } from './karte/paeckchen.js';
import { Schaetze } from './karte/schaetze.js';
import { Tagesplan } from './karte/tagesplan.js';
import { BeschaeftigungenKlein } from './karte/beschaeftigungen-klein.js';
import { Chronik } from './karte/chronik.js';
import { Urlaub } from './karte/urlaub.js';
import { Signale } from './karte/signale.js';
import { Fenster } from './karte/fenster.js';
import { Messung } from './karte/messung.js';

class PikaPetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._runId = 0;
    this._x = 0;
    this._dir = 1;
    this._flowers = [];
    this._foods = [];
    this._asleep = false;
    this._inside = false; // im Bau
    this._lift = 0; // Höhe über dem Boden (auf dem Stein)
    this._poseName = null;
    this._next = null; // nächste Aktion erzwingen (Vorschau)
    this._stats = null;
    this._elev = null;
    this._az = null;
    this._wx = {};
    this._timers = [];
    this._loops = [];
    this._dbgSleep = null;
    this._dbgElev = null;
    this._dbgShift = 0; // Vorschau: Uhr für die Häufchen vorstellen
    this._dbgShiftMs = 0; // Vorschau: Uhr für die Besuche (Vögelchen, Maus, Pino) vorstellen
    this._pileEls = new Map(); // sichtbare Häufchen: Schlüssel "großputz:k" → Element
    this._poopPending = null; // Häufchen, das er gerade live macht
    this._critId = 0; // Besucher (Vögelchen, Maus, Frosch, Schnecke): Lauf-Nummer zum Abbrechen
    this._critT = [];
    this._bird = this._mouse = this._frog = this._snail = null;
    this._planes = new Map(); // Flug-ID → Flugzeug am Himmel
    this._planeT = null;
    this._sent = [];
  }

  setConfig(config) {
    const cfg = { ...DEFAULTS, ...(config || {}) };
    // Grobe Fehler gleich als Fehlerkarte zeigen statt still falsch zu speichern
    for (const k of ['entity', 'plan_entity']) {
      if (cfg[k] && !/^input_text\.\w+$/.test(cfg[k])) throw new Error(`pika-pet-card: ${k} muss ein input_text-Helfer sein (ist "${cfg[k]}")`);
    }
    if (cfg.entity && cfg.entity === cfg.plan_entity) throw new Error('pika-pet-card: entity und plan_entity brauchen zwei verschiedene Helfer');
    if (cfg.chronicle_entity && !/^todo\.\w+$/.test(cfg.chronicle_entity)) throw new Error(`pika-pet-card: chronicle_entity muss eine To-do-Liste sein (ist "${cfg.chronicle_entity}")`);
    if (cfg.areal && !AREALE[cfg.areal]) console.warn(`pika-pet-card: areal "${cfg.areal}" gibt es nicht (${Object.keys(AREALE).join(', ')}), nehme huegel`);
    this._lsRename(this._cfg?.name, cfg.name);
    this._cfg = cfg;
    if (!this._el) this._build();
    this._applyAreal();
    this._el.name.textContent = this._cfg.name;
    this._el.stats.hidden = !this._cfg.show_stats;
    this._diarySync();
    if (this._W) this._btnFit();
    this._el.scene.style.minHeight = `${Number(this._cfg.height) || DEFAULTS.height}px`;
    // Prototyp Tiefe an/aus: ausgeschaltet zurück auf die vordere Spur, Kulisse in die Mitte
    this._el.scene.classList.toggle('tiefe', !!this._cfg.depth);
    if (!this._cfg.depth) {
      this._el.scene.style.removeProperty('--plx');
      if (this._lane) {
        this._lane = 0;
        if (this._g) this._setX(this._x, true);
      }
    } else if (this._W) this._el.scene.style.setProperty('--plx', clamp(this._x / this._W * 2 - 1, -1, 1).toFixed(3));
    // Zustand nur beim ersten Mal und bei anderem Helfer neu laden: Der Editor ruft setConfig bei jeder
    // Änderung, ein noch nicht gespeicherter Stand (1,2 s Wartezeit beim Speichern) ginge sonst verloren
    const ent = this._cfg.entity || '';
    if (ent !== this._entKey) {
      this._entKey = ent;
      clearTimeout(this._saveT);
      this._saveT = this._saveSince = null;
      clearTimeout(this._freshT);
      clearTimeout(this._unavT);
      this._pendingWrite = this._synced = this._noEntity = this._saveWait = false;
      this._lostW = [];
      this._saveFail = 0;
      this._gain = { s: 0, g: 0, c: false };
      this._sent = []; // gesendet, von HA noch nicht bestätigt: { v, gain, at }
      this._lastEntityState = null; // beim nächsten hass neu lesen, auch wenn der Helfer fehlt
      this._stats = null;
      if (!ent) this._loadLocal();
    }
    const pk = `${this._cfg.plan_entity || ''}|${this._cfg.name}`;
    if (pk !== this._planKey) {
      this._planKey = pk;
      this._planReset();
    }
    // Chronik: andere Liste (oder keine mehr), dann gilt nichts mehr von dem, was zur alten gemerkt ist
    const ck = this._cfg.chronicle_entity || '';
    if (ck !== this._chronikKey) {
      this._chronikKey = ck;
      this._chronikReset();
    }
    this._renderStats();
    if (this.isConnected) this._attach();
  }

  set hass(hass) {
    const fresh = hass !== this._hass;
    this._hass = hass;
    const c = this._cfg;
    this._guard('Uhr', () => this._clockHass(hass));
    if (fresh && hass.connected !== false) this._hassN = (this._hassN || 0) + 1;
    if (c.entity) {
      const st = hass.states[c.entity]?.state;
      // Ungesendetes, weil die Verbindung weg war: jetzt hinaus
      if (this._saveWait && hass.connected !== false && st !== 'unavailable') this._save();
      if (st !== this._lastEntityState) {
        this._lastEntityState = st;
        const parsed = parseStats(st);
        clearTimeout(this._freshT);
        clearTimeout(this._unavT);
        // Helfer gibt es nicht: auf diesem Gerät weiterspielen (localStorage) statt ins Leere zu schreiben
        if (st === undefined && !this._noEntity) {
          console.warn(`pika-pet-card: ${c.entity} gibt es nicht, der Zustand bleibt auf diesem Gerät`);
          if (!this._stats) this._loadLocal();
        }
        this._noEntity = st === undefined;
        // Beim Laden länger als 60 s unavailable: wie ein fehlender Helfer lokal weiterspielen statt gar nicht zu
        // speichern. Kommt er wieder, kommen die Gewinne von hier auf seinen Stand (siehe _save).
        if (st === 'unavailable' && !this._synced) {
          this._unavT = setTimeout(() => {
            if (this._lastEntityState !== 'unavailable' || this._synced) return;
            console.warn(`pika-pet-card: ${c.entity} ist nicht erreichbar, der Zustand bleibt vorerst auf diesem Gerät`);
            this._noEntity = true;
            if (!this._stats) this._loadLocal();
            this._renderStats();
          }, 60000);
        }
        const own = parsed ? this._sent.findIndex((e) => e.v === st) : -1;
        const late = own < 0 && parsed ? this._lostW?.find((e) => e.v === st) : null;
        if (own >= 0) {
          // Echo eines eigenen Schreibens: bestätigt (ältere auch, HA arbeitet der Reihe nach). Der eigene Stand
          // ist schon so weit oder weiter, nichts übernehmen.
          this._sent.splice(0, own + 1);
          this._lostW = this._lostW?.filter((e) => e.v !== st);
          this._saveFail = 0;
        } else if (late) {
          // Spätes Echo eines Schreibens, das schon als verloren galt: Es ist doch angekommen und gilt als eigenes.
          // Sein Gewinn liegt inzwischen wieder im Ungesendeten bzw. im neuen Schreiben: dort heraus, sonst käme er
          // beim nächsten fremden Stand ein zweites Mal obendrauf.
          this._lostW = this._lostW.filter((e) => e !== late);
          this._gainSub(late.gain);
          this._saveFail = 0;
        } else if (parsed) {
          this._synced = true;
          // Den eigenen, jetzt veralteten Stand hier nicht mehr bewerten: Wer gepflegt hat, hat das vor seiner Änderung
          // selbst getan (_add, _cleanPile) und schon entwarnt. Eine Warnung von hier käme danach und bliebe stehen,
          // die Serie risse trotz Füttern.
          const gain = this._sentGain();
          if (this._stats && (this._pendingWrite || gain.s || gain.g || gain.c)) {
            // Eigene Änderung ungesendet oder noch unbestätigt: zusammenführen statt den fremden Stand zu
            // übernehmen. Der fremde kam bei HA vor dem eigenen an, ihm fehlt also alles, was hier noch offen ist.
            this._stats = mergeStats(this._stats, parsed, gain, this._haNow(), (a, b) => this._decayH(a, b));
            // Zwei Geräte haben fast gleichzeitig die letzten Häufchen einzeln weggemacht: Zusammen ist alles
            // sauber, aber keines hat den Großputz gesehen. Den jetzt nachholen, sonst blieben alle Plätze belegt
            // (nach dem achten käme nie wieder eins).
            this._poopCache = null;
            if (gain.c && this._stats.m && !this._poops().piles.length) {
              const t = sec(this._now());
              Object.assign(this._stats, { c: t, l: t, m: 0 });
              this._poopCache = null;
            }
            this._sent.forEach((e) => (e.gain = { s: 0, g: 0, c: false })); // steckt jetzt im nächsten Schreiben
            this._gain = gain;
            this._save();
          } else {
            this._stats = parsed;
          }
        } else if (!this._synced && st !== undefined && st !== 'unavailable') {
          // Helfer neu angelegt, leer oder mit fremdem Inhalt: mit Startwerten füllen. "unknown" gibt es auch kurz
          // beim Start von HA, darum erst, wenn es so bleibt – sonst wäre der gespeicherte Stand weg. unavailable: abwarten.
          if (st !== '' && st !== 'unknown') console.warn(`pika-pet-card: ${c.entity} enthält "${st}", fange neu an`);
          const fill = () => {
            this._synced = true;
            this._stats ??= freshStats(this._haNow());
            this._save();
            this._renderStats();
          };
          if (st !== 'unknown') fill();
          else this._freshT = setTimeout(() => this._lastEntityState === 'unknown' && !this._synced && fill(), 20000);
        }
        this._renderStats();
      }
    }
    const sun = hass.states[c.sun_entity];
    const elev = Number(sun?.attributes?.elevation);
    const az = Number(sun?.attributes?.azimuth);
    // unavailable/unknown: Sonnenstand unbekannt (null) statt Nacht – der Himmel richtet sich dann nach der Schlafenszeit
    const sunOk = sun && sun.state !== 'unavailable' && sun.state !== 'unknown';
    this._elev = sunOk ? (Number.isFinite(elev) ? elev : sun.state === 'above_horizon' ? 10 : -10) : null;
    this._az = Number.isFinite(az) ? az : null;
    // Erste Sonnenzeiten: Lag die Karte schon ohne hass, sofort richtig schlafen/wach sein statt hinzulaufen
    if (!this._hadHass && this._g) {
      this._hadHass = true;
      if (this._sleepTime() !== this._asleep) {
        this._stop();
        this._sleepNow(!this._asleep);
        this._start();
      }
    }
    const w = hass.states[c.weather_entity];
    const pr = c.precip_entity ? hass.states[c.precip_entity] : undefined;
    if (w !== this._lastWeather || pr !== this._lastPrecip) {
      this._lastWeather = w;
      this._lastPrecip = pr;
      this._guard('Wetter', () => this._readWeather(w, pr));
    }
    // Verbindung wieder da: Was in der Lücke am Wetter geschah, steht im Recorder
    const conn = hass.connected !== false;
    if (conn && this._wxConn === false) this._guard('Wetterverlauf', () => this._wxHistAsk());
    this._wxConn = conn;
    const fl = c.flight_entity ? hass.states[c.flight_entity] : undefined;
    if (fl !== this._lastFlights) {
      this._lastFlights = fl;
      this._guard('Flugzeuge', () => this._readFlights(fl));
    }
    // Ein Fehler in einer Erweiterung (unerwartete Daten) soll die anderen nicht mitreißen
    for (const f of [this._hassSky, this._hassFest, this._hassFriend, this._hassBote, this._hassCoffee, this._hassPlan, this._hassSig, this._hassAct]) {
      this._guard(f.name, () => f.call(this, hass));
    }
    this._guard('Himmel', () => this._updateSky());
    // Veralteter Plan nach langer Pause: erst frisch, wenn verbunden und sich seitdem etwas geändert hat (ein neues
    // hass-Objekt allein kann nur "verbunden: ja/nein" sein, mit noch altem Stand)
    if (fresh && this._planStale && hass.connected !== false && hass.states !== this._staleStates) this._planFresh();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    // Mindestens 9 von 12 Spalten: Auf dem Handy (ein Abschnitt, etwa 340–400 px) sind das gut 250 px, darunter
    // passen Statusleiste und Szene nicht mehr (6 Spalten wären dort nur rund 170 px).
    return { columns: 12, rows: 4, min_rows: 3, min_columns: 9 };
  }

  connectedCallback() {
    if (this._el) this._attach();
  }

  disconnectedCallback() {
    this._detach();
  }

  _attach() {
    if (this._attached) return;
    this._attached = true;
    this._ro = new ResizeObserver(() => this._layout());
    this._ro.observe(this._el.scene);
    this._onVis = () => this._visSync();
    document.addEventListener('visibilitychange', this._onVis);
    // Seite geht zu oder lädt neu: Ungesendetes noch hinausschicken
    this._onHide = () => this._flush();
    window.addEventListener('pagehide', this._onHide);
    // Bedient jemand das Gerät, obwohl screen_entity „aus“ meldet, ist es nicht dieser Bildschirm (oder er ging eben an
    // und Fully meldet es noch nicht): bis zur nächsten Meldung des Schalters läuft die Karte hier
    this._onWake = () => {
      if (!this._screenDark()) return;
      this._screenWoke = true;
      this._visSync();
    };
    for (const t of WAKE_EVENTS) document.addEventListener(t, this._onWake, { capture: true, passive: true });
    // Karte aus dem Bild gescrollt (Handy, iPad): wie ein versteckter Tab alles anhalten
    this._offscreen = false;
    this._away0 = this._away();
    // Beim Wegsehen angehaltene Effekte (Seifenblasen …) laufen weiter, auch wenn dazwischen abgehängt wurde
    if (!this._away0) this._fxAnims(false);
    this._el.scene.classList.toggle('paused', this._away0);
    this._io = new IntersectionObserver((es) => {
      this._offscreen = !es[es.length - 1].isIntersecting;
      this._visSync();
    });
    this._io.observe(this._el.scene);
    this._loop(() => this._blink(), 2200, 6000);
    this._loop(() => this._twitch(), 5000, 13000);
    this._loop(() => this._noseWiggle(), 4000, 10000);
    this._loop(() => this._lightning(), 6000, 16000);
    this._timers.push(setInterval(() => this._tick(), 20000));
    this._timers.push(setInterval(() => this._regrow(), 150000));
    this._layout();
    // Wieder eingehängt (Ansicht aus dem Zwischenspeicher von HA): Der Stand ist so alt wie die Trennung, den frischen
    // setzt HA erst gleich nach dem Einhängen. Bis dahin (höchstens 0,6 s) wählt die Schleife keine Beschäftigung,
    // sonst zeigte dieses Gerät gelegentlich eine andere als die übrigen.
    if (this._g && this._detachAt) {
      this._blindAt = Date.now();
      this._blindFirst = false;
      // (auch wenn beim Abhängen noch auf einen frischen Stand gewartet wurde: dessen Frist ist mit abgeräumt)
      if (this._hass && (this._planStale || Date.now() - this._detachAt > 2000)) this._planStaleArm(600);
    }
    this._showReq();
    this._start();
    // Wie beim Sichtbarwerden (_visSync → _tick) gleich den Stand zeigen: Häufchen, die während der Trennung fällig
    // wurden, liegen da, statt erst mit dem nächsten Takt (bis 20 s später) zu erscheinen
    if (this._g && this._detachAt && this._stats) this._renderStats();
    this._startCritters();
    this._readFlights(this._lastFlights); // Flieger, die während der Trennung gemeldet wurden
    this._planeLoop();
    this._attachSky();
    this._attachFest();
    this._attachFriend();
    this._attachBote();
    this._attachGift();
    this._attachSig();
  }

  _detach() {
    if (!this._attached) return;
    this._attached = false;
    this._detachAt = Date.now();
    this._stop();
    this._stopCritters();
    this._ro?.disconnect();
    this._io?.disconnect();
    clearTimeout(this._staleT);
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('pagehide', this._onHide);
    for (const t of WAKE_EVENTS) document.removeEventListener(t, this._onWake, { capture: true });
    this._timers.forEach((t) => clearInterval(t));
    this._timers = [];
    clearInterval(this._planeT);
    this._planeT = null;
    this._loops.forEach((h) => clearTimeout(h.t));
    this._loops = [];
    this._detachSky();
    this._detachFest();
    this._detachFriend();
    this._detachBote();
    this._detachGift();
    this._detachSig();
    this._chronikStop();
    this._diaryClose();
  }

  // Fehler merken (die letzten 10, zu sehen im Fuß des Tagebuchs) und einmal je Stelle und Meldung in die Konsole
  // schreiben: Auf dem Wand-Tablet schaut niemand in die Konsole, und derselbe Fehler käme sonst alle paar Sekunden.
  _err(where, e) {
    const msg = String(e?.message ?? e).slice(0, 140);
    const L = (this._errs ??= []);
    const old = L.find((x) => x.where === where && x.msg === msg);
    if (old) {
      old.n++;
      old.t = Date.now();
      return;
    }
    L.push({ where, msg, t: Date.now(), n: 1 });
    if (L.length > 10) L.shift();
    console.warn(`pika-pet-card: ${where}`, e);
  }

  // Ein Fehler in einem Teil (unerwartete Daten) soll die anderen nicht mitreißen
  _guard(where, fn) {
    try {
      return fn();
    } catch (e) {
      this._err(where, e);
    }
  }
}

// Hier wird die Klasse zusammengesetzt: Jedes Modul unter karte/ liefert einen Teil der Methoden (als Klasse ohne
// eigenen Zustand), sie werden an PikaPetCard gehängt. Für die Karte ist es danach eine einzige Klasse. Dass kein
// Name zweimal vergeben ist (zwei Methoden, oder ein Feld `this._x`, das eine Methode `_x` überdeckt), prüft der
// Bau (dev/build.mjs) und bricht sonst ab.
const TEILE = [
  Editor, Aufbau, Schlaf, Lebensschleife, Alltag, Wiese, Haeufchen, Besucher, Flugzeuge, Beschaeftigungen,
  BeschaeftigungenGross, Bausteine, Interaktion, Tagebuch, Momente, Feste, Zustand, Pino, Himmel, Wetter, HausBote,
  Kaffee, Paeckchen, Schaetze, Tagesplan, BeschaeftigungenKlein, Chronik, Urlaub, Signale, Fenster, Messung,
];
for (const Teil of TEILE) {
  for (const k of Reflect.ownKeys(Teil.prototype)) {
    if (k !== 'constructor') Object.defineProperty(PikaPetCard.prototype, k, Object.getOwnPropertyDescriptor(Teil.prototype, k));
  }
  for (const k of Reflect.ownKeys(Teil)) {
    if (!['length', 'name', 'prototype'].includes(k)) Object.defineProperty(PikaPetCard, k, Object.getOwnPropertyDescriptor(Teil, k));
  }
}

export { PikaPetCard };
