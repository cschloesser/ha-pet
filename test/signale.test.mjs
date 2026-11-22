// Haus-Signale (0.43.1): Abbruch beim Mitfahren, Abo der Vorhersage, Sauger ohne Zustand, Haustür über Nacht, Tonne
// am Morgen der Abholung. node --test
// Geladen wird das gebaute Bündel in der Welt aus welt.mjs (eigene Uhr und Zeitgeber). Die Methoden der Karte laufen
// an einer Attrappe (Object.create(Prototyp), wie in pika.test.mjs): echt ist, was unter src/karte/signale.js liegt,
// dazu _wait, _hopTo und _setX; der Rest (Laufen, Sprechen, Fenster) ist stillgelegt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, PLAN, ZUSTAND } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));

// Ein Element, soweit die Haus-Signale es anfassen
class El {
  constructor() {
    const s = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => s.add(x)), remove: (...k) => k.forEach((x) => s.delete(x)), contains: (k) => s.has(k),
      toggle: (k, on = !s.has(k)) => (on ? s.add(k) : s.delete(k)),
    };
    this.style = { setProperty() {}, removeProperty() {} };
    this.dataset = {};
    this.weg = false;
  }

  appendChild(k) {
    return k;
  }

  remove() {
    this.weg = true;
  }

  setAttribute() {}

  addEventListener() {}
}

// Eine Attrappe der Karte in einer eigenen Welt. → { W, T, c }
const attrappe = (felder = {}, opt) => {
  const W = welt(opt);
  W.dok.createElement = () => new El();
  const c = Object.create(W.T.PikaPetCard.prototype);
  Object.assign(c, {
    _cfg: { signals: {} }, _el: { pika: new El(), psay: new El(), scene: new El(), props: new El(), sigbin: null },
    _g: { pW: 60, pH: 50, gy: 150, xR: 560, fMin: 0.3 }, _H: 200, _W: 600, _x: 100, _dir: 1, _lift: 0, _lane: 0,
    _ac: new AbortController(), _asleep: false, _fort: false, _running: true, _next: null, _action: 'idle',
    _urlaubOn: () => false, _away: () => false, _face() {}, _jump() {}, _pikaZ() {}, _bubbleRefit() {}, _cls() {},
    _sigBinSync() {}, _sigWearSync() {}, _winHass() {}, _winTick() {}, _winDetach() {},
    gesagt: [], abbruch: 0,
    _say(text) {
      c.gesagt.push(text);
    },
    _interrupt() {
      c.abbruch++;
    },
    ...felder,
  });
  return { W, T: W.T, c };
};

// ---------- 1. Mitfahren auf dem Saugroboter: Abbruch mittendrin ----------

// Roboter steht bei 200 (Mitte 217), der Pika bei 100. Ablauf von _sigRide in dieser Szene (ms): hinlaufen nach 175
// (hier sofort), warten 500, ducken 180, Sprung auf den Roboter 620 (oben ab 1300), Fahrt von 217 nach 420 in 5075
// (bis 6375), ducken 180, Sprung herunter nach 468 in 620 (unten ab 7175), 900 warten.
const reitSzene = (depth) => {
  const S = attrappe({ _walkTo: async (x) => void (S.c._x = x), live: null });
  const { c } = S;
  c._cfg.depth = depth;
  // (wo die Überblendung ihn gerade zeigt; die Karte liest das aus dem berechneten Stil)
  c._liveX = () => c.live ?? c._x;
  S.V = c._sigVac = { el: new El(), mode: 'drive', x: 200, dir: 1, w: 34, top: 152, hold: false };
  S.p = c._el.pika;
  // Losfahren, nach ms abbrechen (wie _interrupt und _stop: Das Warten wirft)
  S.bisAbbruch = async (ms, live) => {
    const lauf = c._sigRide();
    lauf.catch(() => {});
    await S.W.vor(ms);
    c.live = live;
    c._ac.abort();
    await assert.rejects(lauf);
  };
  return S;
};

test('Mitfahren: mitten in der Fahrt abgebrochen, steht er dort am Boden, wo er und der Roboter gerade sind', async () => {
  const S = reitSzene(true);
  const { c, V } = S;
  // 1 s nach dem Aufspringen: 1000 von 5075 ms der Strecke 217 → 420
  const live = 217 + (420 - 217) * (1000 / 5075);
  await S.bisAbbruch(2300, live);
  assert.equal(c._x, live, 'nicht am Ziel der Fahrt (420), sondern da, wo er wirklich war');
  assert.equal(c._lift, 0);
  assert.equal(S.p.style.transition, 'none', 'ohne Überblendung hingestellt');
  assert.equal(c._reiter, false);
  // Der Roboter fährt von seiner wirklichen Stelle weiter, und der Pika steht genau über ihm
  assert.equal(V.hold, false);
  assert.ok(Math.abs(V.from + V.w / 2 - c._x) < 0.5, `Roboter ${V.from + V.w / 2}, Pika ${c._x}`);
});

for (const depth of [true, false]) {
  test(`Mitfahren: im Sprung auf den Roboter abgebrochen, landet er auf der Bodenlinie (depth: ${depth})`, async () => {
    const S = reitSzene(depth);
    const { c } = S;
    // halb im Sprung von 175 nach 217; _hopTo hat die Höhe schon gesetzt
    await S.bisAbbruch(500 + 180 + 300, 196);
    // (mit depth läge die Scheibe unter der Bodenlinie: Er stünde ein paar Pixel zu tief, bis zum nächsten Sprung.
    // Ohne depth schickte ihn _step von dort mit hopDown an den Fuß des Aussichtssteins.)
    assert.equal(c._lift, 0);
    assert.equal(c._x, 196);
    assert.equal(S.p.style.transition, 'none');
    assert.equal(c._reiter, false);
    assert.equal(S.V.hold, false);
  });
}

test('Mitfahren: im Sprung herunter abgebrochen, springt er nicht zum Landeplatz', async () => {
  const S = reitSzene(true);
  await S.bisAbbruch(6375 + 180 + 300, 444);
  assert.equal(S.c._x, 444);
  assert.equal(S.c._lift, 0);
});

test('Mitfahren: beim Hinlaufen abgebrochen oder zu Ende gefahren, bleibt er, wo ihn Laufen und Springen hingestellt haben', async () => {
  // vor dem Sprung: Er steht am Boden, das Anhalten im Lauf macht _cleanup (_freeze)
  const A = reitSzene(true);
  await A.bisAbbruch(200, 150);
  assert.deepEqual([A.c._x, A.c._lift, A.V.hold], [175, 0, false]);
  // ohne Abbruch: herunter neben den Roboter
  const S = reitSzene(false);
  const lauf = S.c._sigRide();
  await S.W.vor(2000);
  assert.ok(S.c._lift > 0, 'ohne depth steht er über der Kuppel');
  assert.equal(S.V.hold, true);
  S.c.live = 999;
  await S.W.vor(7000);
  await lauf;
  assert.deepEqual([S.c._x, S.c._lift, S.V.hold], [468, 0, false]);
  assert.equal(S.c.gesagt.length, 3);
});

// ---------- 2. Garderobe: Abo der Vorhersage ----------

// Die Verbindung, wie home-assistant-js-websocket sie gibt. Ein Abo mit resubscribe: false stirbt mit der Verbindung
// (seine Kennung gilt danach nicht mehr), jedes andere meldet die Bibliothek nach dem Wiederverbinden selbst wieder an.
const aboSzene = () => {
  const S = attrappe({ wear: 0 });
  const { c } = S;
  c._cfg = { weather_entity: 'weather.zuhause', signals: { wardrobe: true } };
  c._sigWearSync = () => void c.wear++;
  const L = {
    connected: true,
    art: 'ok', // 'ok' | 'ablehnen' | 'halten' (die Antwort steht noch aus: s.ok(), s.nein())
    rufe: [], // jeder Aufruf von subscribeMessage
    faul: 0, // abbestellt mit einer Kennung von vor dem Trennen
    subscribeMessage(cb, msg, opt) {
      const s = { cb, msg, opt, lebt: false, ab: 0, tot: false, selbst: opt?.resubscribe === false };
      const ab = () => {
        s.ab++;
        if (s.tot) L.faul++;
        s.lebt = false;
        return Promise.resolve();
      };
      L.rufe.push(s);
      if (L.art === 'ablehnen') return Promise.reject(Object.assign(new Error('Entity not found'), { code: 'invalid_entity_id' }));
      if (L.art === 'halten') {
        return new Promise((ok, nein) => Object.assign(s, { nein, ok: () => ((s.lebt = true), ok(ab)) }));
      }
      s.lebt = true;
      return Promise.resolve(ab);
    },
    trennen() {
      L.connected = false;
      for (const s of L.rufe) if (s.selbst) Object.assign(s, { lebt: false, tot: true });
    },
    lebend: () => L.rufe.filter((s) => s.lebt).length,
  };
  // HA setzt ein neues hass (wie set hass: erst merken, dann die Erweiterungen)
  const hass = () => {
    const h = { connected: L.connected, connection: L, states: {} };
    c._hass = h;
    c._hassSig(h);
  };
  return { ...S, L, hass };
};
const FC = [{ datetime: '2026-11-21T08:00:00+00:00', temperature: 2, precipitation: 0 }];

test('Garderobe: lehnt HA das Abo der Vorhersage ab, versucht es die Karte wieder, erst nach 30 s, dann immer seltener', async () => {
  const { W, c, L, hass } = aboSzene();
  L.art = 'ablehnen';
  hass();
  await W.vor(0);
  assert.equal(L.rufe.length, 1);
  assert.deepEqual(plain(L.rufe[0].msg), { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: 'weather.zuhause' });
  // 30 s, dann doppelt so lang, höchstens 30 Min. Was HA inzwischen meldet, ändert daran nichts.
  let n = 1;
  for (const s of [30, 60, 120, 240, 480, 960, 1800, 1800]) {
    hass();
    await W.vor(s * 1000 - 1000);
    hass();
    assert.equal(L.rufe.length, n, `vor ${s} s kein neuer Versuch`);
    await W.vor(1000);
    assert.equal(L.rufe.length, ++n, `nach ${s} s der nächste`);
  }
  assert.equal(L.lebend(), 0);
  // Jetzt gibt es die Entität (das Wetter war beim Start von HA noch nicht geladen): Der nächste Versuch sitzt
  L.art = 'ok';
  await W.vor(1800 * 1000);
  assert.equal(L.rufe.length, n + 1);
  assert.equal(L.lebend(), 1);
  L.rufe.at(-1).cb({ type: 'hourly', forecast: FC });
  assert.deepEqual([plain(c._sigFc), c.wear], [FC, 1]);
  // … und dabei bleibt es: kein weiterer Aufruf, kein zweites Abo
  for (let i = 0; i < 5; i++) {
    hass();
    await W.vor(3600 * 1000);
  }
  assert.deepEqual([L.rufe.length, L.lebend()], [n + 1, 1]);
});

test('Garderobe: nach dem Wiederverbinden abonniert die Karte neu, genau einmal, und bestellt nichts Totes ab', async () => {
  const { W, c, L, hass } = aboSzene();
  hass();
  await W.vor(0);
  assert.deepEqual([L.rufe.length, L.lebend()], [1, 1]);
  // Die Karte führt das Abo selbst: Meldete die Bibliothek es auch wieder an, gäbe es nach dem Wiederverbinden zwei
  assert.equal(L.rufe[0].opt?.resubscribe, false);
  L.rufe[0].cb({ forecast: FC });
  assert.equal(c.wear, 1);
  // Verbindung weg: nichts senden, auch nicht abbestellen (die Kennung gilt auf der neuen Verbindung nicht mehr)
  L.trennen();
  hass();
  hass();
  await W.vor(5000);
  assert.deepEqual([L.rufe.length, L.lebend(), L.rufe[0].ab], [1, 0, 0]);
  // … wieder da: neu abonnieren, auch wenn HA mehrmals „verbunden“ meldet
  L.connected = true;
  hass();
  hass();
  await W.vor(20);
  hass();
  assert.deepEqual([L.rufe.length, L.lebend(), L.faul], [2, 1, 0]);
  // Die alte Vorhersage gilt weiter, bis die neue kommt; eine Meldung des toten Abos zählt nicht mehr
  assert.deepEqual(plain(c._sigFc), FC);
  L.rufe[0].cb({ forecast: [] });
  assert.deepEqual([plain(c._sigFc), c.wear], [FC, 1]);
  L.rufe[1].cb({ forecast: [...FC, ...FC] });
  assert.deepEqual([c._sigFc.length, c.wear], [2, 2]);
  // Wartet sie nach einer Ablehnung gerade auf den nächsten Versuch, kommt er mit der Verbindung sofort, und die
  // Pausen beginnen wieder bei 30 s (HA ist neu gestartet, das Wetter lädt noch)
  L.trennen();
  hass();
  L.connected = true;
  L.art = 'ablehnen';
  hass();
  await W.vor(0);
  assert.equal(L.rufe.length, 3);
  await W.vor(30000);
  assert.equal(L.rufe.length, 4);
  await W.vor(5000);
  L.trennen();
  hass();
  await W.vor(120000);
  assert.equal(L.rufe.length, 4, 'getrennt kein Versuch');
  L.connected = true;
  L.art = 'ok';
  hass();
  await W.vor(0);
  assert.deepEqual([L.rufe.length, L.lebend()], [5, 1]);
  await W.vor(3600 * 1000);
  assert.deepEqual([L.rufe.length, L.lebend(), L.faul], [5, 1, 0], 'der alte Zeitgeber ist weg');
});

test('Garderobe: abgehängt, abgeschaltet oder andere Wetter-Entität – das Abo wird abbestellt, kein Zeitgeber bleibt', async () => {
  // abgehängt mit stehendem Abo
  let S = aboSzene();
  S.hass();
  await S.W.vor(0);
  S.c._detachSig();
  await S.W.vor(0);
  assert.deepEqual([S.L.lebend(), S.L.rufe[0].ab, S.L.faul], [0, 1, 0]);
  // … und wieder eingehängt: ein neues
  S.hass();
  await S.W.vor(0);
  assert.deepEqual([S.L.rufe.length, S.L.lebend()], [2, 1]);
  // abgehängt, während sie auf den nächsten Versuch wartet: Der kommt nicht mehr
  S = aboSzene();
  S.L.art = 'ablehnen';
  S.hass();
  await S.W.vor(1000);
  S.c._detachSig();
  await S.W.vor(3600 * 1000);
  assert.equal(S.L.rufe.length, 1);
  // abgehängt, bevor HA geantwortet hat: Eine Ablehnung löst keinen Versuch mehr aus, ein spätes Ja wird abbestellt
  for (const antwort of ['nein', 'ok']) {
    S = aboSzene();
    S.L.art = 'halten';
    S.hass();
    await S.W.vor(100);
    S.c._detachSig();
    S.L.rufe[0][antwort](new Error('zu spät'));
    await S.W.vor(3600 * 1000);
    assert.deepEqual([S.L.rufe.length, S.L.lebend(), S.L.rufe[0].ab], [1, 0, antwort === 'ok' ? 1 : 0], antwort);
  }
  // Garderobe abgeschaltet
  S = aboSzene();
  S.hass();
  await S.W.vor(0);
  S.c._cfg.signals.wardrobe = false;
  S.hass();
  await S.W.vor(0);
  assert.deepEqual([S.L.rufe.length, S.L.lebend(), S.L.rufe[0].ab], [1, 0, 1]);
  // andere Wetter-Entität: das alte ab, ein neues an
  S.c._cfg.signals.wardrobe = true;
  S.hass();
  await S.W.vor(0);
  S.c._cfg.weather_entity = 'weather.garten';
  S.hass();
  await S.W.vor(0);
  assert.deepEqual([S.L.rufe.length, S.L.lebend(), S.L.rufe[1].ab, S.L.rufe[2].msg.entity_id], [3, 1, 1, 'weather.garten']);
  // ohne Verbindung zum Abonnieren (Vorschau): nichts, auch kein Zeitgeber, der es immer wieder versucht
  S = aboSzene();
  const h = { connected: true, connection: {}, states: {} };
  S.c._hass = h;
  S.c._hassSig(h);
  S.c._hassSig(h);
  await S.W.vor(3600 * 1000);
  assert.equal(S.c._sigFc, undefined);
});

// ---------- 3. Saugroboter ohne Zustand ----------

const saugSzene = () => {
  const S = attrappe();
  const { W, c } = S;
  c._cfg.signals.vacuum = 'vacuum.robi';
  // Zustand des Saugers in HA (null: Die Entität fehlt), seit wann
  S.melde = (state, seit = W.jetzt()) => {
    const h = { connected: true, states: state == null ? {} : { 'vacuum.robi': { state, last_changed: new Date(seit).toISOString() } } };
    c._hass = h;
    c._hassSig(h);
  };
  S.will = () => plain(c._sigActs().map((a) => a[1]));
  return S;
};
const MIN = 60000;

test('Saugroboter: ohne Zustand fährt er noch 15 Minuten weiter, dann ist er weg, und kommt mit dem Zustand wieder', async () => {
  const { W, T, c, melde, will } = saugSzene();
  melde('cleaning');
  const V = c._sigVac;
  assert.equal(V.mode, 'drive');
  assert.deepEqual(will(), ['sigRide']);
  // kurzer Ausfall (WLAN): Er fährt weiter wie bisher, aber der Pika springt nicht auf
  melde('unavailable');
  assert.deepEqual([c._sigVac === V, V.mode], [true, 'drive']);
  assert.deepEqual(will(), []);
  // (auch nicht, wenn die Vorschau das Mitfahren erzwingt)
  await c._sigRide();
  assert.deepEqual([c.gesagt, V.hold], [[], false]);
  c._sigRideAt = 0;
  await W.vor(5 * MIN);
  c._tickSig();
  assert.equal(c._sigVac, V);
  melde('cleaning');
  assert.deepEqual([c._sigVac === V, V.mode, will()], [true, 'drive', ['sigRide']]);
  // langer Ausfall: Die Frist läuft ab dem Ausfall, nicht ab dem kurzen davor; nachgesehen wird im Takt
  melde('unavailable');
  await W.vor(15 * MIN - 10000);
  c._tickSig();
  assert.equal(c._sigVac, V, 'nach 14:50 noch da');
  // (er sitzt gerade oben: herunter mit ihm)
  c._action = 'sigRide';
  await W.vor(20000);
  c._tickSig();
  assert.equal(c._sigVac, null, 'nach 15 Minuten weg');
  assert.equal(V.el.classList.contains('out'), true);
  assert.equal(c.abbruch, 1, 'der Pika reitet keinen Roboter ohne Zustand');
  await W.vor(1000);
  assert.equal(V.el.weg, true);
  c._action = 'idle';
  // „unknown“ danach ist derselbe Ausfall, und weitere Takte ändern nichts
  melde('unknown');
  c._tickSig();
  await W.vor(60 * MIN);
  c._tickSig();
  assert.deepEqual([c._sigVac, will(), c.abbruch], [null, [], 1]);
  // Der Zustand ist wieder da: Der Roboter kommt wieder
  melde('cleaning');
  assert.equal(c._sigVac?.mode, 'drive');
  assert.notEqual(c._sigVac, V);
  assert.deepEqual(will(), ['sigRide']);
  // In der Station war er schon immer sofort weg
  melde('docked');
  assert.equal(c._sigVac, null);
  assert.equal(T.SIG.vacDead, 15 * MIN);
});

test('Saugroboter: die Frist zählt ab dem Ausfall in HA, auch wenn die Entität ganz fehlt oder er feststeckt', async () => {
  // Ein Tablet wacht auf, der Sauger ist seit 20 Minuten nicht erreichbar: sofort weg
  let S = saugSzene();
  S.melde('cleaning');
  S.melde('unavailable', S.W.jetzt() - 20 * MIN);
  assert.equal(S.c._sigVac, null);
  // … seit 10 Minuten: in 5 Minuten
  S = saugSzene();
  S.melde('cleaning');
  S.melde('unavailable', S.W.jetzt() - 10 * MIN);
  assert.ok(S.c._sigVac);
  await S.W.vor(5 * MIN);
  S.c._tickSig();
  assert.equal(S.c._sigVac, null);
  // Die Entität fehlt (umbenannt, Integration entfernt): ab jetzt 15 Minuten. Feststecken wird nicht mehr angeschoben.
  S = saugSzene();
  S.melde('error');
  assert.deepEqual([S.c._sigVac.mode, S.will()], ['stuck', ['sigPush']]);
  S.melde(null);
  assert.deepEqual([S.c._sigVac.mode, S.will()], ['stuck', []]);
  await S.W.vor(15 * MIN);
  S.c._tickSig();
  assert.equal(S.c._sigVac, null);
  // Die Karte war in der Zeit nicht zu sehen (kein Takt): beim Wiederkommen weg
  S = saugSzene();
  S.melde('cleaning');
  S.melde('unavailable');
  S.c._hiddenSig(true);
  await S.W.vor(16 * MIN);
  assert.ok(S.c._sigVac);
  S.c._hiddenSig(false);
  assert.equal(S.c._sigVac, null);
});

// ---------- 4. Haustür: Die Reaktion verfällt ----------

const tuerSzene = () => {
  const S = attrappe({ _walkTo: async () => {}, _sigVacSync() {} });
  const { W, c } = S;
  c._cfg.signals.door = 'binary_sensor.haustuer';
  S.tuer = (state) => {
    const h = { connected: true, states: { 'binary_sensor.haustuer': { state, last_changed: new Date(W.jetzt()).toISOString() } } };
    c._hass = h;
    c._hassSig(h);
  };
  S.auf = () => {
    S.tuer('off');
    S.tuer('on');
  };
  return S;
};

test('Haustür: kommt die Reaktion nicht gleich dran (Schlafenszeit), verfällt sie nach 20 s, statt am Morgen „Hallo?“ zu rufen', async () => {
  const { W, T, c, auf, tuer } = tuerSzene();
  auf();
  assert.deepEqual([c._next, c.abbruch], ['sigDoor', 1]);
  // _step geht stattdessen schlafen, _next bleibt liegen. Der Takt räumt es weg, sobald es zu alt ist.
  await W.vor(19000);
  c._tickSig();
  assert.equal(c._next, 'sigDoor');
  await W.vor(2000);
  c._tickSig();
  assert.equal(c._next, null);
  // Ohne Takt (Karte nicht zu sehen): beim nächsten hass, beim Sichtbarwerden, spätestens in der Aktion selbst
  await W.vor(3 * MIN);
  auf();
  assert.equal(c._next, 'sigDoor');
  await W.vor(21000);
  tuer('off');
  assert.equal(c._next, null, 'bei der nächsten Meldung von HA');
  await W.vor(3 * MIN);
  auf();
  await W.vor(21000);
  c._hiddenSig(false);
  assert.equal(c._next, null, 'beim Sichtbarwerden');
  await W.vor(3 * MIN);
  auf();
  assert.equal(c._next, 'sigDoor');
  await W.vor(8 * 3600 * 1000);
  // (am Morgen nimmt _step die liegen gebliebene Aktion und ruft sie auf)
  c._next = null;
  await c._sigDoor();
  assert.deepEqual(c.gesagt, [], 'kein „Hallo?“ acht Stunden nach der Tür');
  assert.equal(T.SIG.doorTtl, 20000);
});

test('Haustür: gleich drangekommen oder aus der Vorschau erzwungen, reagiert er wie bisher; Fremdes in _next bleibt', async () => {
  const { W, c, auf } = tuerSzene();
  const lauf = async () => {
    const l = c._sigDoor();
    await W.vor(4000);
    await l;
  };
  auf();
  await W.vor(900); // erst noch vom Stein herunter
  c._next = null;
  await lauf();
  assert.equal(c.gesagt.length, 1);
  // erzwungen ohne Tür (Vorschau, _next von Hand), auch lange nach der letzten Tür
  await W.vor(3600 * 1000);
  await lauf();
  assert.equal(c.gesagt.length, 2);
  // Kam nach der Tür etwas anderes in _next (eine Berührung), räumt der Takt das nicht weg …
  await W.vor(3 * MIN);
  auf();
  c._next = 'petReact';
  await W.vor(60000);
  c._tickSig();
  assert.equal(c._next, 'petReact');
  // … und die alte Tür gilt nicht mehr für eine spätere, von Hand erzwungene Reaktion
  c._next = null;
  await lauf();
  assert.equal(c.gesagt.length, 3);
});

// ---------- 5. Tonne: „steht draußen“ am Morgen der Abholung ----------

// November 2026: Montag 23., Dienstag 24. (Bio), Mittwoch 25. (Gelber Sack), Donnerstag 26. (Restmüll)
const am = (tag, h, min = 0) => new Date(2026, 10, tag, h, min).getTime();
const kal = (name, tag, zeit = '07:00') => ({ state: 'off', attributes: { message: name, start_time: `2026-11-${tag} ${zeit}:00` } });
const BIO = kal('Biotonne', 24);
const GELB = kal('Gelber Sack', 25);
const REST = kal('Restmüll', 26);
const tonnen = () => {
  const { T, c } = attrappe();
  const P = T.PikaPetCard.prototype;
  // so fragt die Karte: Welche Tonne steht jetzt da?
  const steht = (cal, plan, now) => P._sigBin.call({ _sigW: cal, _plan: plan, _urlaubOn: () => false, _haNow: () => now })?.kind ?? null;
  // Die Tonne antippen, wie die Karte es tut (_sigBinOut) → der Plan danach
  const tippe = (cal, plan, now) => {
    assert.notEqual(steht(cal, plan, now), null, 'angetippt wird nur eine Tonne, die dasteht');
    const k = Object.create(P);
    Object.assign(k, {
      _el: { sigbin: new El() }, _sigW: cal, _plan: plan, _urlaubOn: () => false, _haNow: () => now, _sigBinSync() {}, _sigAwake: () => false,
      _planOp(op) {
        k._plan = T.planApply(k._plan, op, now);
      },
    });
    k._sigBinOut();
    return k._plan;
  };
  const streichle = (plan, now) => T.planApply(plan, { t: 'pet', d: T.pikaDay(now), n: 1 }, now);
  const bits = (plan) => MEM(T, plan.cute);
  return { T, c, steht, tippe, streichle, bits, leer: T.planBlank(am(23, 12)) };
};
const MEM = (T, cute) => (cute ? `${cute.d - T.pikaDay(am(23, 12))}:${cute.m & T.MEM_TONNE ? 'T' : ''}${cute.m & T.MEM_TONNE2 ? '2' : ''}` : '');

test('Tonne: gar nicht angetippt – sie steht vom Vortag 14 Uhr bis zur Abholung da, die nächste danach auch', () => {
  const { steht, streichle, leer } = tonnen();
  assert.equal(steht(BIO, leer, am(23, 13, 59)), null);
  for (const plan of [leer, streichle(leer, am(23, 15)), streichle(streichle(leer, am(23, 15)), am(24, 5))]) {
    assert.equal(steht(BIO, plan, am(23, 15, 1)), 'bio');
    assert.equal(steht(BIO, plan, am(24, 6, 59)), 'bio');
    assert.equal(steht(BIO, plan, am(24, 7, 0)), null, 'ab der Abholung weg');
    assert.equal(steht(GELB, plan, am(24, 14, 30)), 'gelb');
    assert.equal(steht(GELB, plan, am(25, 6)), 'gelb');
  }
});

test('Tonne: am Vorabend angetippt – weg bis zur Abholung, mit und ohne Streicheln am Morgen; die nächste steht da', () => {
  const { steht, tippe, streichle, bits, leer } = tonnen();
  const mo = tippe(BIO, leer, am(23, 20));
  assert.equal(bits(mo), '0:T');
  const di = streichle(mo, am(24, 5));
  assert.equal(bits(di), '1:2', 'der neue Pika-Tag übernimmt es');
  for (const plan of [mo, di]) {
    assert.equal(steht(BIO, plan, am(23, 20, 1)), null);
    assert.equal(steht(BIO, plan, am(24, 6, 30)), null);
    assert.equal(steht(GELB, plan, am(24, 14, 30)), 'gelb');
    assert.equal(steht(GELB, plan, am(25, 6)), 'gelb');
    assert.equal(steht(GELB, streichle(plan, am(25, 5)), am(25, 6)), 'gelb');
  }
  // nach Mitternacht, vor 4 Uhr: noch der Pika-Tag des Vorabends
  const nachts = tippe(BIO, leer, am(24, 1));
  assert.equal(bits(nachts), '0:T');
  for (const plan of [nachts, streichle(nachts, am(24, 5))]) {
    assert.equal(steht(BIO, plan, am(24, 6, 30)), null);
    assert.equal(steht(GELB, plan, am(24, 14, 30)), 'gelb');
  }
});

test('Tonne: erst am Morgen der Abholung angetippt – die Tonne für den nächsten Tag steht am Nachmittag trotzdem da', () => {
  const { T, steht, tippe, streichle, bits, leer } = tonnen();
  // heute noch nichts erlebt (der Plan steht noch beim Montag oder ist leer) oder schon gestreichelt
  const vorher = { 'nichts erlebt': leer, 'Montag gestreichelt': streichle(leer, am(23, 18)), 'heute gestreichelt': streichle(leer, am(24, 6)) };
  for (const [wie, plan] of Object.entries(vorher)) {
    assert.equal(steht(BIO, plan, am(24, 6, 30)), 'bio', wie);
    const di = tippe(BIO, plan, am(24, 6, 30));
    // „die Tonne, die gestern schon dastand, ist draußen“: Das Bit von heute (MEM_TONNE) gälte für die nächste
    assert.equal(bits(di), '1:2', wie);
    assert.equal(steht(BIO, di, am(24, 6, 31)), null, wie);
    assert.equal(steht(BIO, streichle(di, am(24, 6, 40)), am(24, 6, 59)), null, wie);
    // Dienstag ab 14 Uhr: der Gelbe Sack für Mittwoch (bis 0.43.0 blieb er weg, bis Mittwoch früh)
    assert.equal(steht(GELB, di, am(24, 13, 59)), null, wie);
    assert.equal(steht(GELB, di, am(24, 14, 30)), 'gelb', wie);
    assert.equal(steht(GELB, streichle(di, am(24, 16)), am(24, 16, 1)), 'gelb', wie);
    // Mittwoch früh, mit und ohne Streicheln: Nichts wird übernommen
    assert.equal(steht(GELB, di, am(25, 6)), 'gelb', wie);
    const mi = streichle(di, am(25, 5));
    assert.equal(bits(mi), '2:', wie);
    assert.equal(steht(GELB, mi, am(25, 6)), 'gelb', wie);
    // der Plan sieht aus wie vorher (kein neues Feld, kein neues Bit)
    assert.equal(T.planSer(T.planParse(T.planSer(di))), T.planSer(di));
  }
  assert.deepEqual([T.MEM_TONNE, T.MEM_TONNE2], [1 << 10, 1 << 11]);
});

test('Tonne: Abholungen an zwei Tagen hintereinander, in jeder Reihenfolge von Vorabend und Morgen', () => {
  const { steht, tippe, streichle, bits, leer } = tonnen();
  // Bio am Vorabend oder am Morgen, dazwischen gestreichelt oder nicht
  const bioRaus = {
    'Vorabend': tippe(BIO, leer, am(23, 20)),
    'Vorabend, gestreichelt': streichle(tippe(BIO, leer, am(23, 20)), am(24, 5)),
    'Morgen': tippe(BIO, leer, am(24, 6, 30)),
    'Morgen, gestreichelt': tippe(BIO, streichle(leer, am(24, 6)), am(24, 6, 30)),
  };
  for (const [wie, di] of Object.entries(bioRaus)) {
    // Gelber Sack am Dienstagabend rausgestellt: weg, auch am Mittwochmorgen
    const abend = tippe(GELB, di, am(24, 18));
    assert.equal(bits(abend), '1:T2', wie);
    assert.equal(steht(GELB, abend, am(24, 18, 1)), null, wie);
    assert.equal(steht(GELB, abend, am(25, 6)), null, wie);
    const mi = streichle(abend, am(25, 5));
    assert.equal(bits(mi), '2:2', wie);
    assert.equal(steht(GELB, mi, am(25, 6)), null, wie);
    // … und die dritte am Mittwochnachmittag steht wieder da
    for (const plan of [abend, mi]) {
      assert.equal(steht(REST, plan, am(25, 14, 30)), 'rest', wie);
      assert.equal(steht(REST, streichle(plan, am(26, 5)), am(26, 6)), 'rest', wie);
    }
    // Gelber Sack erst am Mittwochmorgen rausgestellt (bis dahin steht er da)
    for (const vor of [di, streichle(di, am(25, 5))]) {
      assert.equal(steht(GELB, vor, am(25, 6, 29)), 'gelb', wie);
      const frueh = tippe(GELB, vor, am(25, 6, 30));
      assert.equal(bits(frueh), '2:2', wie);
      assert.equal(steht(GELB, frueh, am(25, 6, 31)), null, wie);
      assert.equal(steht(REST, frueh, am(25, 14, 30)), 'rest', wie);
      assert.equal(steht(REST, streichle(frueh, am(26, 5)), am(26, 6)), 'rest', wie);
    }
  }
});

test('Tonne: zwei Tage Abstand, Abholung vor 4 Uhr, und ein Tippen in den Sekunden nach Beginn der Abholung', () => {
  const { steht, tippe, streichle, bits, leer } = tonnen();
  // Dienstag Bio, Donnerstag Restmüll: Was auch immer für Bio getippt wurde, Restmüll steht ab Mittwoch 14 Uhr da
  for (const di of [tippe(BIO, leer, am(23, 20)), tippe(BIO, leer, am(24, 6, 30)), tippe(BIO, streichle(leer, am(24, 6)), am(24, 6, 30))]) {
    for (const plan of [di, streichle(di, am(24, 12)), streichle(di, am(25, 9)), streichle(streichle(di, am(24, 12)), am(25, 9))]) {
      assert.equal(steht(REST, plan, am(25, 13, 59)), null);
      assert.equal(steht(REST, plan, am(25, 14, 30)), 'rest');
      assert.equal(steht(REST, streichle(plan, am(26, 5)), am(26, 6)), 'rest');
    }
  }
  // Abholung um 3 Uhr nachts: Vortag und Abholung liegen im selben Pika-Tag, getippt wird immer „am Vorabend“
  const bio3 = kal('Biotonne', 24, '03:00');
  const gelb3 = kal('Gelber Sack', 25, '03:00');
  for (const wann of [am(23, 20), am(24, 1)]) {
    const p = tippe(bio3, leer, wann);
    assert.equal(bits(p), '0:T');
    assert.equal(steht(bio3, p, am(24, 2)), null);
    for (const plan of [p, streichle(p, am(24, 5))]) assert.equal(steht(gelb3, plan, am(24, 14, 30)), 'gelb');
  }
  // Die Abholung hat eben begonnen, die Tonne ist auf diesem Gerät noch nicht weggeräumt: Ein Tippen merkt sich
  // nichts mehr (es gälte sonst für die nächste Abholung)
  const { T, c } = tonnen();
  const ops = [];
  Object.assign(c, { _el: { sigbin: new El() }, _sigW: BIO, _plan: leer, _haNow: () => am(24, 7, 0) + 5000, _planOp: (op) => ops.push(op), _running: false });
  c._sigBinOut();
  assert.deepEqual(ops, []);
  c._haNow = () => am(24, 6, 59);
  c._sigBinOut();
  assert.deepEqual(plain(ops), [{ t: 'mem', d: T.pikaDay(am(24, 6, 59)), b: T.MEM_TONNE2 }]);
});

test('Tonne: am Morgen angetippt, zwei echte Karten – die andere sieht dasselbe, und das Tagebuch erkennt das Tippen', async () => {
  // Dienstag 6:30, Pika-Tag seit 4 Uhr; gestern wurde gestreichelt, heute noch nichts
  const W = welt({ start: am(24, 6, 30) });
  const { T } = W;
  W.ha.setze(PLAN, T.planSer(T.planApply(T.planBlank(am(23, 18)), { t: 'pet', d: T.pikaDay(am(23, 18)), n: 2 }, am(23, 18))), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize(T.freshStats(W.jetzt())), 'anfang', { max: 100 });
  const A = W.karte('Tablet');
  const B = W.karte('Handy');
  await W.vor(100);
  for (const K of [A, B]) K.c._sigW = BIO;
  assert.equal(B.c._sigBin()?.kind, 'bio');
  A.c._sigBinOut();
  await W.vor(2000);
  const cute = T.planParse(W.ha.wert(PLAN)).cute;
  assert.deepEqual([cute.d, cute.m], [T.pikaDay(W.jetzt()), T.MEM_TONNE2]);
  assert.equal(A.c._sigBin(), null);
  assert.equal(B.c._sigBin(), null, 'auf dem anderen Gerät auch weg');
  // nachmittags steht auf beiden der Gelbe Sack
  await W.vor(8 * 3600 * 1000);
  B.streicheln();
  await W.vor(2000);
  for (const K of [A, B]) {
    K.c._sigW = GELB;
    assert.equal(K.c._sigBin()?.kind, 'gelb', K.name);
  }
  // Tagebuch (aus dem Verlauf des Helfers): Das Tippen ist ein Erlebnis zur Zeit des Tippens. Bis das Tagebuch
  // „tonne2 ohne tonne am Vortag“ als Tippen liest, heißt es dort tonne2; ein übernommenes Bit heißt nie tonne.
  const verlauf = (rows) => plain(T.diaryDerive([], rows.map((r) => ({ t: r.t, v: T.planParse(r.s) })), am(23, 0), { decayAt: () => Infinity, until: am(26, 0) })
    .ev.filter((e) => e.k === 'mem' && /^tonne/.test(e.b)).map((e) => [e.t, e.b]));
  const ev = verlauf(W.ha.verlauf.filter((r) => r.id === PLAN));
  assert.equal(ev.length, 1);
  assert.ok(ev[0][0] >= am(24, 6, 30) && ev[0][0] < am(24, 6, 31), 'zur Zeit des Tippens');
  assert.match(ev[0][1], /^tonne$/);
  // Gegenprobe: am Vorabend getippt, am Morgen gestreichelt → tonne am Abend, das übernommene Bit ist kein zweites Tippen
  let p = T.planBlank(am(23, 12));
  const rows = [{ t: am(23, 12), s: T.planSer(p) }];
  for (const [t, op] of [[am(23, 20), { t: 'mem', b: T.MEM_TONNE }], [am(24, 5), { t: 'pet', n: 1 }]]) {
    p = T.planApply(p, { ...op, d: T.pikaDay(t) }, t);
    rows.push({ t, s: T.planSer(p) });
  }
  assert.deepEqual(verlauf(rows), [[am(23, 20), 'tonne'], [am(24, 5), 'tonne2']]);
});
