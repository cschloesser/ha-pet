// Eine kleine Welt für Tests mit mehreren Karten an einem Home Assistant (siehe zwei-karten.test.mjs).
//
// welt() lädt das gebaute Bündel (pika-pet-card.js) in einen eigenen Kontext, mit Attrappen wie in pika.test.mjs, aber
// - mit eigener Uhr und eigenen Zeitgebern: Nichts läuft von selbst, vor(ms) stellt die Uhr vor und lässt alles
//   Fällige der Reihe nach laufen (auch die Promise-Ketten dazwischen);
// - mit einem nachgestellten HA: ein Speicher für die beiden Helfer, callService('input_text', 'set_value', …), das ihn
//   beschreibt (sofort, verspätet, gar nicht oder mit Ablehnung), und ein Verlauf wie im Recorder. Wie das echte HA
//   vergibt es Kennungen: Jeder Aufruf bekommt eine (context.id), callService antwortet damit, sobald HA ihn
//   ausgeführt hat, und der Stand, den der Aufruf erzeugt hat, trägt sie (states[…].context.id);
// - mit Karten, die ihr hass über das echte `set hass` bekommen, jede mit eigener Verbindung.
// Echt sind an der Karte Konstruktor, setConfig, set hass, _attach, _detach, _visSync, Zustand (_add, _save …) und
// Tagesplan (_planOp, _planSaveNow …). Stillgelegt ist nur, was die Szene zeichnet oder die Lebensschleife treibt
// (ATTRAPPEN): Fehlt dort etwas, landet der Fehler in _guard und damit in _errs der Karte, und vor() bricht ab.
//
// Die Datei liegt unter test/ und wird darum von `node --test` mit ausgeführt: Beim Laden passiert hier nichts, und nur
// dann (nicht, wenn ein Test sie einbindet) prüft sie sich am Ende selbst.
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

export const ZUSTAND = 'input_text.pika';
export const PLAN = 'input_text.pika_plan';

// Ein Element der Szene, soweit setConfig, _attach und _visSync es anfassen
class Att {
  constructor() {
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.style = { setProperty() {}, removeProperty() {} };
  }
}
const leer = () => {};
// Was zeichnet oder die Schleife treibt: hier ohne Wirkung. (_careEval rechnete sonst bei jedem Füttern Päckchen aus
// und schriebe von sich aus in den Plan; die Tests legen ihre Änderungen selbst an.)
const ATTRAPPEN = {
  _applyAreal: leer, _diarySync: leer, _btnFit: leer, _renderStats: leer, _layout: leer, _loop: leer, _tick: leer, _regrow: leer,
  _showReq: leer, _start: leer, _stop: leer, _startCritters: leer, _stopCritters: leer, _readFlights: leer, _planeLoop: leer, _planeSnap: leer,
  _attachSky: leer, _attachFest: leer, _attachFriend: leer, _attachBote: leer, _attachGift: leer, _attachSig: leer,
  _detachSky: leer, _detachFest: leer, _detachFriend: leer, _detachBote: leer, _detachGift: leer, _detachSig: leer, _diaryClose: leer,
  _fxAnims: leer, _hiddenFeatures: leer, _updateSky: leer, _readWeather: leer, _wxHistAsk: leer, _interrupt: leer,
  _hassSky() {}, _hassFest() {}, _hassFriend() {}, _hassBote() {}, _hassCoffee() {}, _hassSig() {},
  _hayFromPlan: leer, _giftFromPlan: leer, _flowerFromPlan: leer, _foodFromPlan: leer, _friendFromPlan: leer, _urlaubFromPlan: leer,
  _sigBinSync: leer, _giftCredit: leer, _diaryLog: leer, _careEval: () => null, _sleepTime: () => false,
};

// start: Beginn der Uhr (Ortszeit mittags: Der Pika ist wach, bis zum Wechsel des Pika-Tags um 4 Uhr ist es weit).
// laufzeit: so lange braucht ein Schreiben bis zu HA und eine Meldung von HA bis zur Karte (ms).
// alt: Quelltext eines älteren Bündels (z. B. aus `git show b06aebc:pika-pet-card.js`). Es lebt in derselben Welt
// (dieselbe Uhr, dasselbe HA); karte(name, cfg, { alt: true }) ist dann eine Karte dieser Version: ein Gerät, das
// noch nicht aktualisiert ist.
// kontext: false stellt ein HA ohne Kennungen nach (ältere Version): Stände ohne context, callService antwortet leer.
// speicher: true gibt der Welt ein localStorage (W.speicher ist die Map dahinter); ohne wirft jeder Zugriff, wie in
// einem gesperrten Browser.
export const welt = ({ start = new Date(2026, 10, 21, 12).getTime(), laufzeit = 20, alt = null, kontext = true, speicher = false } = {}) => {
  // ---------- Uhr und Zeitgeber ----------
  let jetzt = start;
  let lfd = 0;
  const wecker = []; // { id, at, fn, alle }
  const stellen = (fn, ms, alle = null) => {
    const h = { id: ++lfd, at: jetzt + Math.max(0, Number(ms) || 0), fn, alle };
    wecker.push(h);
    return h;
  };
  const abstellen = (h) => {
    const i = wecker.indexOf(h);
    if (i >= 0) wecker.splice(i, 1);
  };
  class Uhr extends Date {
    constructor(...a) {
      if (a.length) super(...a);
      else super(jetzt);
    }

    static now() {
      return jetzt;
    }
  }
  // Promise-Ketten zu Ende laufen lassen (die .catch der Karte an callService sind echte Mikroaufgaben)
  const atmen = () => new Promise((r) => { setImmediate(r); });

  // ---------- das Bündel in seiner Welt ----------
  let T = null;
  const warnungen = [];
  const dok = { hidden: false, addEventListener: leer, removeEventListener: leer, createElement: () => new Att() };
  class Beobachter {
    // cb: Der Test meldet selbst (K.c._ro.cb() ist eine Meldung des ResizeObservers)
    constructor(cb) {
      this.cb = cb;
    }

    observe() {}

    disconnect() {}
  }
  const lager = new Map();
  const WELT = {
    window: { matchMedia: () => ({ matches: false }), customCards: [], addEventListener: leer, removeEventListener: leer },
    document: dok,
    HTMLElement: class {
      attachShadow() {
        return new Att();
      }
    },
    customElements: { get: () => null, define: leer },
    console: { info: leer, log: leer, debug: leer, warn: (...a) => warnungen.push(a.map(String).join(' ')) },
    setTimeout: (fn, ms) => stellen(fn, ms),
    clearTimeout: abstellen,
    setInterval: (fn, ms) => stellen(fn, ms, Math.max(1, Number(ms) || 0)),
    clearInterval: abstellen,
    ResizeObserver: Beobachter,
    IntersectionObserver: Beobachter,
    queueMicrotask, Date: Uhr, Math, JSON, Promise, Intl, AbortController, performance,
    ...(speicher ? { localStorage: { getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => void lager.set(k, String(v)), removeItem: (k) => void lager.delete(k) } } : {}),
    __pikaTest: (x) => (T = x),
  };
  vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), WELT, { filename: 'pika-pet-card.js' });
  let TA = null;
  if (alt) vm.runInNewContext(alt, { ...WELT, __pikaTest: (x) => (TA = x) }, { filename: 'pika-pet-card-alt.js' });

  // ---------- Home Assistant ----------
  const karten = [];
  let kennungen = 0;
  const neueKennung = () => `k${++kennungen}`;
  // Die wievielte Fassung der Zustände ein states-Objekt ist (siehe liefere: Eine Karte bekommt nie eine ältere)
  const folge = new WeakMap();
  let fassung = 0;
  const ha = {
    // Die Zustände. Bei jeder Änderung ein neues Objekt, wie hass.states im Frontend: Daran erkennt die Karte einen
    // frischen Stand.
    zustand: {},
    // Wie der Recorder: eine Zeile je tatsächlicher Änderung { t, id, s, von }. Derselbe Wert noch einmal gibt keine.
    verlauf: [],
    // Wert setzen (ein Schreiben kommt an, oder der Test stellt etwas ein). Meldet es allen verbundenen Karten, jede
    // bekommt es nach ihrer Laufzeit, und zwar die Zustände von diesem Augenblick: Ändert sich der Helfer zweimal kurz
    // hintereinander, sieht eine Karte beide Stände der Reihe nach (wie die Meldungen von HA). Mit K.nurLetzter
    // bekommt sie stattdessen jedes Mal den Stand von dann, wenn die Meldung ankommt (das Frontend fasst Meldungen
    // zusammen, die in dasselbe Bild fallen: Zwischenstände sieht die Karte dann nicht). → ob sich etwas geändert hat
    // kennung: die des Aufrufs, der den Wert setzt (sonst eine neue: irgendwer anders). Ändert sich nichts, bleibt der
    // Stand samt seiner alten Kennung, wie in HA.
    setze(id, s, von = 'ha', attributes = null, kennung = neueKennung()) {
      const alt = ha.zustand[id];
      if (alt && alt.state === s) return false;
      const t = new Date(jetzt).toISOString();
      ha.zustand = { ...ha.zustand, [id]: { state: s, attributes: attributes || alt?.attributes || {}, last_changed: t, last_updated: t, ...(kontext ? { context: { id: kennung, parent_id: null, user_id: null } } : {}) } };
      ha.verlauf.push({ t: jetzt, id, s, von });
      const bild = ha.zustand;
      folge.set(bild, ++fassung);
      for (const K of karten) if (K.verbunden) stellen(() => K.liefere({ bild }), K.laufzeit);
      return true;
    },
    wert: (id) => ha.zustand[id]?.state,
    // Die Zeilen eines Helfers im Verlauf, als „von: Wert“
    zeilen: (id) => ha.verlauf.filter((r) => r.id === id).map((r) => `${r.von}: ${r.s}`),
  };

  // Ein Schreiben der Karte K. Was damit geschieht, bestimmen ihre Verbindung und K.leitung. Die Antwort (das Promise
  // von callService) kommt wie bei HA erst, wenn der Aufruf ausgeführt ist, nach der Laufzeit zurück zur Karte: um den
  // Augenblick, in dem auch der neue Stand ankommt, je nach K.antwort 1 ms davor ('zuerst') oder danach ('danach').
  // (HA schickt erst den Stand, dann die Antwort. Im Browser läuft die Antwort als Promise aber oft, bevor das neue
  // hass durch die Elemente bis zur Karte gereicht ist: Beide Reihenfolgen kommen vor.) Ein verlorenes Schreiben
  // bekommt nie eine Antwort, ein gehaltenes erst nach dem Freigeben. Ein gekapptes ('kappen') erreicht HA und wird
  // ausgeführt, die Verbindung reißt aber vor der Antwort: Das Promise schlägt fehl, obwohl der Wert im Helfer steht.
  const ruf = (K, dom, dienst, daten) => {
    const e = { t: jetzt, von: K.name, id: daten?.entity_id, s: daten?.value, weg: null, kennung: neueKennung(), karte: K, ja: null };
    K.aufrufe.push(e);
    const antwort = new Promise((ja) => { e.ja = ja; });
    if (dom !== 'input_text' || dienst !== 'set_value') {
      e.weg = 'unbekannt';
      return Promise.reject(new Error(`${dom}.${dienst} gibt es in dieser Welt nicht`));
    }
    if (!K.verbunden) {
      // Wie home-assistant-js-websocket: Solange die Verbindung ruht (Tab im Hintergrund), schlägt das Senden fehl.
      // Baut sie sich gerade wieder auf, wartet die Nachricht und geht beim Verbinden als Erstes hinaus.
      if (K.phase !== 'aufbau') {
        e.weg = 'abgelehnt';
        return Promise.reject(new Error('Connection lost'));
      }
      e.weg = 'warteschlange';
      K.schlange.push(e);
      return antwort;
    }
    const art = typeof K.leitung === 'function' ? K.leitung(e) : K.leitung;
    if (art === 'ablehnen') {
      e.weg = 'abgelehnt';
      return Promise.reject(new Error('abgelehnt'));
    }
    if (art === 'verlieren') {
      e.weg = 'verloren';
      return antwort;
    }
    if (art === 'kappen') {
      e.weg = 'gekappt';
      stellen(() => {
        e.weg = 'angekommen-ohne-antwort';
        ha.setze(e.id, e.s, e.von, null, e.kennung);
      }, K.laufzeit);
      return Promise.reject(new Error('Connection lost'));
    }
    if (art === 'halten') {
      e.weg = 'gehalten';
      K.stau.push(e);
      return antwort;
    }
    e.weg = 'unterwegs';
    stellen(() => ankunft(e), K.laufzeit);
    return antwort;
  };
  const ankunft = (e) => {
    e.weg = 'angekommen';
    const K = e.karte;
    ha.setze(e.id, e.s, e.von, null, e.kennung);
    stellen(() => e.ja(kontext ? { context: { id: e.kennung, parent_id: null, user_id: null } } : undefined), Math.max(0, K.laufzeit + (K.antwort === 'zuerst' ? -1 : 1)));
  };

  // ---------- Karten ----------
  // Eine Karte auf ihrem eigenen Gerät. K.c ist die echte Karte.
  const karte = (name, cfg = {}, { alt: alte = false } = {}) => {
    const c = new (alte ? TA : T).PikaPetCard();
    Object.assign(c, ATTRAPPEN);
    // (die Maße der Szene: An ihnen erkennt die Karte, dass sie schon einmal ausgelegt war)
    c._layout = function () {
      this._g ??= {};
    };
    c._build = function () {
      this._el = new Proxy({}, { get: (t, k) => (t[k] ??= new Att()) });
    };
    const K = {
      name,
      c,
      laufzeit,
      verbunden: true, // die Verbindung dieses Geräts zu HA steht
      phase: null, // getrennt: 'ruht' (Senden schlägt fehl) oder 'aufbau' (Senden wartet in der Schlange)
      beliefert: true, // HA setzt dieser Karte hass (einer abgehängten nicht)
      leitung: 'sofort', // verbunden: 'sofort' | 'halten' | 'verlieren' | 'ablehnen' | 'kappen', oder eine Funktion (Aufruf) → eins davon
      nurLetzter: false, // Meldungen von HA bringen den Stand von dann, wenn sie ankommen, statt den vom Absenden (siehe ha.setze)
      antwort: 'zuerst', // die Antwort auf ein Schreiben erreicht die Karte 1 ms vor dem neuen Stand ('zuerst') oder 'danach'
      stau: [], // gehaltene Schreiben, siehe freigeben
      schlange: [], // während des Wiederverbindens gesendet
      aufrufe: [], // alles, was die Karte callService übergeben hat: { t, von, id, s, weg }
      bild: ha.zustand, // die Zustände, die dieses Gerät zuletzt von HA bekommen hat
      verbindung: {
        get connected() {
          return K.verbunden;
        },
      },
      // Der Karte ein neues hass-Objekt setzen, mit dem, was ihr Gerät gerade weiß
      setzeHass() {
        if (!K.beliefert) return;
        c.hass = {
          connected: K.verbunden,
          connection: K.verbindung,
          config: {},
          states: K.bild,
          callService: (dom, dienst, daten) => ruf(K, dom, dienst, daten),
          callWS: () => Promise.reject(new Error('unknown_command')),
        };
      },
      // Eine Meldung von HA kommt an: die Zustände aus bild (die von damals, als HA sie abschickte), ohne bild die von
      // jetzt. Getrennt kommt nichts an. neu: auch dann ein neues states-Objekt, wenn sich nichts geändert hat (nach
      // dem Wiederverbinden schickt HA alle Zustände neu). Eine ältere Fassung als die, die das Gerät schon hat, zählt
      // nicht (sie wurde überholt: neu verbunden, oder der Test hat die Laufzeit verkürzt).
      liefere({ neu = false, bild = null } = {}) {
        if (!K.verbunden) return;
        const b = neu ? { ...ha.zustand } : (bild && !K.nurLetzter ? bild : ha.zustand);
        if (neu) folge.set(b, folge.get(ha.zustand) || 0);
        if ((folge.get(b) || 0) < (folge.get(K.bild) || 0)) return;
        K.bild = b;
        K.setzeHass();
      },
      // Verbindung weg (Tab 5 Min im Hintergrund, WLAN weg). Eine eingehängte Karte erfährt es („connected: false“).
      trennen() {
        K.verbunden = false;
        K.phase = 'ruht';
        K.setzeHass();
      },
      // Das Gerät ist wieder da, die Verbindung baut sich auf: Was jetzt gesendet wird, wartet in der Schlange
      aufbauen() {
        if (!K.verbunden) K.phase = 'aufbau';
      },
      // Verbindung steht wieder. In der Reihenfolge von home-assistant-js-websocket: erst die Schlange (kommt bei HA
      // an, bevor die Karte irgendetwas Neues gesehen hat), dann „verbunden“ mit den alten Zuständen, und nach der
      // Laufzeit die frischen.
      verbinden() {
        K.verbunden = true;
        K.phase = null;
        for (const e of K.schlange.splice(0)) ankunft(e);
        K.setzeHass();
        stellen(() => K.liefere({ neu: true }), K.laufzeit);
      },
      // Gehaltene Schreiben kommen doch noch an (in ihrer Reihenfolge), n: nur die ersten n
      freigeben(n = Infinity) {
        for (const e of K.stau.splice(0, n)) ankunft(e);
      },
      // HA hängt die Karte ab (andere Ansicht, Panel im Hintergrund weggeräumt): kein hass mehr
      abhaengen() {
        c.disconnectedCallback();
        K.beliefert = false;
      },
      // … und wieder ein. hass: HA setzt gleich sein aktuelles hass (Ansicht aus dem Zwischenspeicher). Ohne: Es kommt
      // erst mit der nächsten Meldung (Panel kehrt aus dem Hintergrund zurück, die Verbindung baut sich noch auf).
      einhaengen({ hass = true } = {}) {
        c.connectedCallback();
        K.beliefert = true;
        if (hass) {
          if (K.verbunden) K.bild = ha.zustand;
          K.setzeHass();
        }
      },
      // Tab in den Hintergrund / wieder nach vorn (das echte _visSync). document gibt es je Welt nur einmal: hidden gilt
      // nur für den Augenblick dieses Aufrufs, danach merkt sich die Karte selbst, ob sie weggesehen hat.
      verstecken() {
        dok.hidden = true;
        c._visSync();
        dok.hidden = false;
        c._away = () => true;
      },
      zeigen() {
        delete c._away;
        c._visSync();
      },
      // Streicheln wie in der Karte: Zähler im Tagesplan und Glück im Zustand
      streicheln(g = 4) {
        c._petCount();
        c._add('g', g);
      },
      fuettern(s = 20) {
        c._add('s', s);
      },
      // Der Plan, wie ihn die Karte gerade sieht, und der Zustand (gerundet wie im Helfer)
      plan: () => JSON.parse(JSON.stringify(c._plan)),
      werte: () => ({ s: Math.round(c._raw('s') * 10) / 10, g: Math.round(c._raw('g') * 10) / 10 }),
      // Was sie in den Helfer id geschrieben hat (alles, was sie callService übergab)
      geschrieben: (id) => K.aufrufe.filter((e) => e.id === id).map((e) => e.s),
    };
    karten.push(K);
    c.setConfig({ name: 'Pika', entity: ZUSTAND, plan_entity: PLAN, sleep_start: '21:00', sleep_end: '07:00', ...cfg });
    c.connectedCallback();
    K.setzeHass();
    return K;
  };

  // Hat eine Karte einen Fehler geschluckt (_guard → _errs)? Dann stimmt eine Attrappe nicht oder die Karte selbst.
  const pruefe = () => {
    const f = karten.flatMap((K) => (K.c._errs || []).map((e) => `${K.name}: ${e.where}: ${e.msg}`));
    if (f.length) throw new Error(`Fehler in der Karte: ${f.join(' | ')}`);
  };
  // Uhr um ms vorstellen und alles Fällige laufen lassen, in der Reihenfolge der Fälligkeit
  const vor = async (ms = 0) => {
    const ziel = jetzt + ms;
    for (;;) {
      await atmen();
      let h = null;
      for (const x of wecker) if (x.at <= ziel && (!h || x.at < h.at || (x.at === h.at && x.id < h.id))) h = x;
      if (!h) break;
      jetzt = Math.max(jetzt, h.at);
      if (h.alle != null) h.at = jetzt + h.alle;
      else abstellen(h);
      h.fn();
    }
    jetzt = ziel;
    await atmen();
    pruefe();
  };

  return {
    get T() {
      return T;
    },
    ha, karte, karten, vor, pruefe, warnungen, dok,
    speicher: lager,
    // So viele Zeitgeber stehen gerade (alles zusammen: die der Karten und Meldungen von HA, die noch unterwegs sind)
    wecker: () => wecker.length,
    jetzt: () => jetzt,
    // Etwas anderes ändert sich in HA (irgendein Sensor): alle verbundenen Karten bekommen neue Zustände
    regung() {
      ha.setze('sensor.irgendwas', String(jetzt), 'ha');
    },
    // Zeitgeber wie in der Welt der Karte (für Tests, die selbst etwas auf die Uhr legen)
    stellen, abstellen,
  };
};

// Als Testdatei gestartet (node --test nimmt alles unter test/): die Welt selbst prüfen
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { test } = await import('node:test');
  const assert = (await import('node:assert/strict')).default;
  test('Testwelt: eigene Uhr, Zeitgeber der Reihe nach, HA meldet nur Änderungen, Karten bekommen ihr hass', async () => {
    const W = welt({ laufzeit: 20 });
    const t0 = W.jetzt();
    const lauf = [];
    W.stellen(() => lauf.push(['b', W.jetzt() - t0]), 300);
    W.stellen(() => lauf.push(['a', W.jetzt() - t0]), 100);
    const takt = W.stellen(() => lauf.push(['takt', W.jetzt() - t0]), 250, 250);
    const nie = W.stellen(() => lauf.push(['nie']), 200);
    W.abstellen(nie);
    await W.vor(600);
    W.abstellen(takt);
    await W.vor(1000);
    assert.deepEqual(lauf, [['a', 100], ['takt', 250], ['b', 300], ['takt', 500]]);
    assert.equal(W.jetzt(), t0 + 1600);
    // derselbe Wert noch einmal ist keine Änderung: keine Zeile, keine Meldung
    assert.equal(W.ha.setze(PLAN, W.T.planSer(W.T.planBlank(t0)), 'test', { max: 255 }), true);
    assert.equal(W.ha.setze(PLAN, W.T.planSer(W.T.planBlank(t0)), 'test'), false);
    assert.equal(W.ha.verlauf.length, 1);
    W.ha.setze(ZUSTAND, W.T.serialize(W.T.freshStats(t0)), 'test', { max: 100 });
    // Die Karte lebt in der Uhr der Welt und liest den Helfer über das echte set hass
    const K = W.karte('K');
    assert.equal(K.c._haNow(), W.jetzt());
    assert.equal(K.c._planOk, true);
    assert.equal(K.c._hass.states, W.ha.zustand);
    // Meldungen brauchen ihre Laufzeit, getrennt kommt nichts an, und nur eine Änderung gibt ein neues states-Objekt
    const s0 = K.bild;
    W.regung();
    await W.vor(19);
    assert.equal(K.bild, s0);
    await W.vor(1);
    assert.notEqual(K.bild, s0);
    const s1 = K.bild;
    K.trennen();
    W.regung();
    await W.vor(100);
    assert.deepEqual([K.bild === s1, K.c._hass.connected, K.c._hass.states === s1], [true, false, true]);
    // Getrennt schlägt das Senden fehl, im Aufbau wartet es, verbunden geht die Schlange als Erstes hinaus
    await assert.rejects(K.c._hass.callService('input_text', 'set_value', { entity_id: PLAN, value: 'x' }));
    K.aufbauen();
    // (die Antwort kommt erst, wenn HA den Aufruf ausgeführt hat: mit der Kennung, die dann auch der Stand trägt)
    let antwort = null;
    K.c._hass.callService('input_text', 'set_value', { entity_id: PLAN, value: 'y' }).then((r) => { antwort = r; });
    await W.vor(0);
    assert.notEqual(W.ha.wert(PLAN), 'y');
    assert.equal(antwort, null);
    K.verbinden();
    assert.equal(W.ha.wert(PLAN), 'y');
    assert.deepEqual([K.c._hass.connected, K.c._hass.states === s1], [true, true], 'erst „verbunden“ mit den alten Zuständen');
    await W.vor(20);
    assert.equal(K.c._hass.states[PLAN].state, 'y');
    assert.ok(antwort.context.id && antwort.context.id === K.c._hass.states[PLAN].context.id, 'Antwort und Stand tragen dieselbe Kennung');
    // derselbe Wert noch einmal ändert nichts: Der Stand behält die Kennung des ersten Aufrufs
    let zweite = null;
    K.c._hass.callService('input_text', 'set_value', { entity_id: PLAN, value: 'y' }).then((r) => { zweite = r; });
    await W.vor(100);
    assert.ok(zweite.context.id !== antwort.context.id && K.c._hass.states[PLAN].context.id === antwort.context.id);
    assert.deepEqual(K.aufrufe.map((e) => e.weg), ['abgelehnt', 'angekommen', 'angekommen']);
    // (der Helfer enthält jetzt Unsinn: Die Karte warnt, statt ihn zu lesen)
    assert.equal(W.warnungen.length, 1);
    assert.match(W.warnungen[0], /enthält "y", der Tagesplan fängt neu an/);
    // Zwei Änderungen kurz hintereinander: Die Karte sieht beide Stände der Reihe nach, jeden nach ihrer Laufzeit …
    const gesehen = () => K.c._hass.states['sensor.x']?.state;
    W.ha.setze('sensor.x', 'a');
    await W.vor(5);
    W.ha.setze('sensor.x', 'b');
    await W.vor(15);
    assert.equal(gesehen(), 'a');
    await W.vor(5);
    assert.equal(gesehen(), 'b');
    // … mit nurLetzter bringt jede Meldung den Stand von dann, wenn sie ankommt: Den Zwischenstand sieht sie nie
    K.nurLetzter = true;
    W.ha.setze('sensor.x', 'c');
    await W.vor(5);
    W.ha.setze('sensor.x', 'd');
    await W.vor(15);
    assert.equal(gesehen(), 'd');
    K.nurLetzter = false;
    // Eine ältere Meldung, die von einer neueren überholt wurde (die Laufzeit wurde kürzer), zählt nicht mehr
    K.laufzeit = 100;
    W.ha.setze('sensor.x', 'e');
    K.laufzeit = 10;
    W.ha.setze('sensor.x', 'f');
    await W.vor(200);
    assert.equal(gesehen(), 'f');
    K.laufzeit = 20;
    // Gekappt: Der Aufruf erreicht HA und wird ausgeführt, das Promise schlägt trotzdem fehl
    K.leitung = 'kappen';
    await assert.rejects(K.c._hass.callService('input_text', 'set_value', { entity_id: 'input_text.anderes', value: 'z' }));
    assert.equal(W.ha.wert('input_text.anderes'), undefined);
    await W.vor(40);
    assert.equal(K.c._hass.states['input_text.anderes'].state, 'z');
    assert.deepEqual([K.aufrufe.at(-1).weg, K.c._hass.states['input_text.anderes'].context.id], ['angekommen-ohne-antwort', K.aufrufe.at(-1).kennung]);
    assert.equal(W.warnungen.length, 1);
    W.pruefe();
  });
}
