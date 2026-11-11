// Chronik: Tagesbilanz in die To-do-Liste von HA nachtragen, Liste lesen, Dopplungen aufräumen

import { pikaDay } from '../logik/tagesplan.js';
import { diaryDerive } from '../logik/tagebuch.js';
import { CHRONIK, chronikDatum, chronikStart, chronikZoneOk, chronikBilanz, chronikTage, chronikFehlt, chronikPlan } from '../logik/chronik.js';

export class Chronik {
  // Mit chronicle_entity (einer To-do-Liste von HA) trägt die Karte einmal am Tag nach, was an den vergangenen
  // Pika-Tagen geschah: je Tag ein Eintrag (Format und Regeln in src/logik/chronik.js). Abgeleitet wird die Bilanz wie
  // das Tagebuch aus dem Verlauf der beiden Helfer. Gezeigt wird sie noch nirgends. Ohne die Option passiert hier
  // nichts: kein Aufruf an HA, kein Zeitgeber.

  // Andere Liste (oder keine mehr): von vorn. Ein laufender Lauf gehört zur alten Liste und endet.
  _chronikReset() {
    this._chronikStop();
    this._chronikStand = null; // zuletzt gelesen: { t, tage: Map Datum → Eintrag }
    this._chronikOk = null; // „<Liste>|<Tag>“: für diesen Tag fertig geprüft
    this._chronikNext = 0; // nach einem Fehlschlag: frühestens dann wieder
    this._chronikFails = 0; // Fehlschläge in Folge (siehe _chronikPause)
  }

  // Laufenden Lauf beenden (Karte abgehängt, andere Liste): Die Wartezeit vor dem Nachprüfen endet sofort, und nach
  // dem Aufruf, der gerade unterwegs ist, tut der Lauf nichts mehr (er ist nicht mehr der von _chronikBusy).
  _chronikStop() {
    const w = this._chronikW;
    this._chronikW = null;
    this._chronikBusy = null;
    if (w) {
      clearTimeout(w.t);
      w.done();
    }
  }

  // Geschrieben wird nur in eine Liste, die es gibt, die erreichbar ist und Einträge annimmt, und nur, wenn beide
  // Helfer in HA liegen (dann liest auch das Tagebuch aus dem Recorder): Ohne gemeinsame Helfer hat jedes Gerät seinen
  // eigenen Pika, der gehört nicht in die gemeinsame Liste.
  // Still aus (kein Fehler, keine Zeile in der Konsole) ist die Chronik außerdem
  // - an der Vorschau-Karte im Editor von HA (das Frontend setzt dort preview = true): Sie schriebe sonst sofort, noch
  //   vor dem Speichern, und wer im Editor versehentlich die Einkaufsliste auswählt, hätte dort bis zu sieben Einträge;
  // - auf einem Gerät, dessen Ortszeit nicht zur Zeitzone von HA passt (chronikZoneOk): Sein Pika-Tag beginnt zu einer
  //   anderen Stunde, es hielte den Tag von zu Hause für abgeschlossen, während er noch läuft. Geprüft für jetzt und
  //   für den Beginn des ältesten Tags, der nachgetragen werden könnte.
  _chronikOn() {
    const id = this._cfg?.chronicle_entity;
    const hass = this._hass;
    if (!id || !hass || hass.connected === false || this.preview === true) return false;
    const ent = hass.states[id];
    if (!ent || ent.state === 'unavailable' || ent.state === 'unknown' || !(Number(ent.attributes?.supported_features) & 1)) return false;
    const { haS, haP } = this._diaryHa();
    if (!haS || !haP) return false;
    const now = this._haNow();
    return chronikZoneOk(hass.config?.time_zone, [now, chronikStart(pikaDay(now) - CHRONIK.back)]);
  }

  _chronikLsKey() {
    return `pika-pet-chronik:${this._cfg.name}`;
  }

  // Heute schon fertig geprüft? Das steht im Browser, damit ein Handy, das zehnmal am Tag lädt, einmal prüft (und eine
  // zweite Karte gleichen Namens gar nicht). Ohne Speicher gilt es bis zum Neuladen.
  _chronikDone(heute) {
    const v = `${this._cfg.chronicle_entity}|${heute}`;
    if (this._chronikOk === v) return true;
    try {
      if (localStorage.getItem(this._chronikLsKey()) !== v) return false;
    } catch (e) {
      return false;
    }
    this._chronikOk = v;
    return true;
  }

  _chronikMark(heute) {
    this._chronikOk = `${this._cfg.chronicle_entity}|${heute}`;
    try {
      localStorage.setItem(this._chronikLsKey(), this._chronikOk);
    } catch (e) { /* kein Speicher: gilt bis zum Neuladen */ }
  }

  // Alle 20 s aus _tick: einmal je Pika-Tag und Browser prüfen, ob Tage fehlen.
  _chronikTick() {
    if (!this._chronikOn()) return;
    const busy = this._chronikBusy;
    if (busy) {
      // Ein Lauf dauert mit allen Runden wenige Minuten. Hängt er viel länger (ein Aufruf, auf den HA nie antwortet),
      // wird er aufgegeben, sonst prüfte dieses Gerät bis zum Neuladen nie wieder.
      if (Date.now() - busy.at < CHRONIK.hang) return;
      this._chronikStop();
      this._chronikPause();
    }
    // Erst wenn Zustand und Tagesplan geladen und frisch sind: Vorher ist nicht sicher, dass die Verbindung steht
    // (nach langer Pause baut sie sich gerade neu auf), und der Lauf endete gleich wieder in einem Fehlschlag.
    if (!this._synced || !this._planOk || this._planStale || Date.now() < (this._chronikNext || 0)) return;
    const now = this._haNow();
    const heute = pikaDay(now);
    // Versatz je Karte, mit Math.random und nicht mit festem Zufall: Zwei Geräte sollen sich hier gerade NICHT gleich
    // verhalten. Prüften alle zur selben Sekunde, legten alle denselben Tag an, und die Dopplungen müssten jeden
    // Morgen wieder abgeräumt werden. So ist meist eines zuerst fertig, die anderen finden den Tag schon vor.
    this._chronikJit ??= Math.random() * CHRONIK.jitter;
    if (now < chronikStart(heute) + CHRONIK.wait + this._chronikJit || this._chronikDone(heute)) return;
    // „Heute“ kommt aus _haNow, und das ist die Geräteuhr, solange noch keine Zeitprobe von HA da ist (gleich nach dem
    // Laden). Geht sie vor, schlimmstenfalls einen Tag, trüge die Karte den noch laufenden Tag als abgeschlossen nach,
    // und der halbe Eintrag bliebe stehen: Ein Tag, der dasteht, wird nicht mehr ergänzt. Darum erst, wenn HA selbst
    // den neuen Tag nachweislich erreicht hat. Ohne einen solchen Stempel wird (noch) nicht geprüft: Das kostet
    // höchstens Zeit, nie einen falschen Eintrag.
    if (!(this._chronikStempel() >= chronikStart(heute))) return;
    this._chronikRun(heute);
  }

  // Der jüngste Zeitstempel (last_updated) unter den Zuständen, die die Karte ohnehin liest. Den vergibt HA, nicht
  // das Gerät. → ms; -Infinity, wenn keiner einen gültigen trägt
  _chronikStempel() {
    const c = this._cfg;
    const S = this._hass?.states || {};
    let t = -Infinity;
    for (const id of [c.sun_entity, c.entity, c.plan_entity, c.weather_entity, c.chronicle_entity]) {
      const lu = id ? Date.parse(S[id]?.last_updated) : NaN;
      if (lu > t) t = lu;
    }
    return t;
  }

  // Vorschau und Tests: sofort prüfen, ohne auf Tagesbeginn, Versatz, „heute schon geprüft“, den Stempel von HA und
  // die Pause nach einem Fehlschlag zu achten. this._dbgChronik = { check: ms } verkürzt dazu die Wartezeit vor dem Nachprüfen.
  // → Promise wie _chronikRun
  _chronikNow() {
    return this._chronikOn() ? this._chronikRun(pikaDay(this._haNow())) : Promise.resolve(null);
  }

  // Ein Lauf. → Promise (wird nie abgelehnt): true = fertig, der Tag gilt als geprüft; false = Fehlschlag, nach einer
  // Pause noch einmal (_chronikPause); null = abgebrochen (_chronikStop).
  // Eine fehlende, nicht erreichbare oder ablehnende Liste ist kein Fehler der Karte: Was HA ablehnt, kommt als
  // schlichtes Objekt oder Zahl (nie als Error) und steht höchstens in der Konsole. Ein Error stammt aus dem eigenen
  // Code und gehört in den Fehlerspeicher.
  _chronikRun(heute) {
    if (this._chronikBusy) return this._chronikBusy.p;
    const lauf = { at: Date.now(), p: null };
    const live = () => this._chronikBusy === lauf;
    this._chronikBusy = lauf;
    lauf.p = (async () => {
      let ok = null;
      try {
        ok = await this._chronikRounds(heute, live);
      } catch (e) {
        ok = false;
        this._chronikFail(e);
      } finally {
        // (ein abgebrochener Lauf hat den Merker nicht mehr: Den hat _chronikStop gelöst, vielleicht läuft schon ein neuer)
        if (live()) this._chronikBusy = null;
        else ok = null;
      }
      if (ok) {
        this._chronikFails = 0;
        this._chronikNext = 0;
        this._chronikMark(heute);
      } else if (ok === false) this._chronikPause();
      return ok;
    })();
    return lauf.p;
  }

  // Nach einem Fehlschlag: Pause bis zum nächsten Versuch, eine Stunde, mit jedem weiteren Fehlschlag in Folge das
  // Doppelte, höchstens ein Tag. Was auf Dauer nicht geht (der Recorder zeichnet die Helfer nicht auf, die Liste nimmt
  // nichts an), fragte sonst jedes sichtbare Gerät stündlich, ohne Ende. Ein fertiger Lauf fängt wieder bei einer
  // Stunde an, eine andere Liste auch.
  _chronikPause() {
    this._chronikFails = (this._chronikFails || 0) + 1;
    this._chronikNext = Date.now() + Math.min(CHRONIK.retry * 2 ** (this._chronikFails - 1), CHRONIK.retryMax);
  }

  _chronikFail(e) {
    if (e instanceof Error) this._err('Chronik', e);
    else console.debug('pika-pet-card: Chronik gerade nicht erreichbar, später noch einmal', e);
  }

  // Lesen, Fehlendes aus dem Verlauf nachtragen, Dopplungen auflösen, und nach eigenem Schreiben nachprüfen
  async _chronikRounds(heute, live) {
    let items = await this._chronikItems();
    if (!live()) return null;
    if (!items) return false;
    const at = Date.now(); // wann gelesen (siehe _chronikDo)
    const fehlt = chronikFehlt(items, heute, CHRONIK.back);
    const soll = new Map();
    if (fehlt.length) {
      // EIN Abruf vom Beginn des ältesten fehlenden Tags bis jetzt, nur die beiden Helfer
      const now = this._haNow();
      const from = chronikStart(fehlt[0]);
      const H = await this._diaryHist(from, now + 60000, true);
      if (!live()) return null;
      // Verlauf nicht lesbar, Recorder zeichnet nicht auf, oder ein Helfer liegt inzwischen nicht mehr in HA: Aus
      // einem halben Verlauf entstünde eine falsche Bilanz, die niemand mehr berichtigt. Später noch einmal.
      if (H.fail || H.none || !H.ha) return false;
      // (decayAt: nie. Wann der Bauch knurrte, rechnet das Tagebuch aus dem Abbau nach: Das ist keine Änderung im
      // Verlauf und steht nicht in der Bilanz.)
      const R = diaryDerive(H.S, H.P, from, { decayAt: () => Infinity, until: now });
      for (const tag of fehlt) {
        const a = chronikStart(tag);
        const b = chronikStart(tag + 1);
        const drin = (t) => t >= a && t < b;
        // Ein Tag ohne jede Änderung im Verlauf wird nicht geschrieben: Was kein Gerät gezeigt hat, erfindet die
        // Chronik nicht (wie das Tagebuch, dort bleibt es „mein Geheimnis“)
        if (R.stamps.some(drin) || R.ev.some((e) => drin(e.t))) soll.set(chronikDatum(tag), chronikBilanz(R.ev, R.pets, a, b, tag));
      }
    }
    let n = await this._chronikDo(chronikPlan(items, soll), live, at);
    // Wurde geschrieben: nach einer Wartezeit noch einmal lesen. Hat ein anderes Gerät denselben Tag im selben
    // Augenblick angelegt, stehen jetzt zwei da; chronikPlan (ohne soll) räumt das ab. (Ein abgebrochener Lauf stellt
    // keinen Zeitgeber mehr.)
    for (let r = 0; n > 0 && r < CHRONIK.rounds && live(); r++) {
      await this._chronikWait(this._dbgChronik?.check ?? CHRONIK.check + Math.random() * CHRONIK.checkJit);
      if (!live()) return null;
      items = await this._chronikItems();
      if (!live()) return null;
      if (!items) return false;
      n = await this._chronikDo(chronikPlan(items), live, Date.now());
    }
    if (!live()) return null;
    // Hat auch die letzte Runde noch geschrieben (oder ihren Lesestand verworfen), ist nicht bewiesen, dass die Liste
    // sauber ist: nicht als geprüft merken und nach der Pause von vorn, statt bis morgen zu warten.
    return n === 0;
  }

  // Liste lesen (ein Aufruf, erzeugt in HA keinen Recorder-Eintrag) und den Stand merken. → Einträge; null, wenn die
  // Chronik gerade aus ist oder die Antwort keine Liste enthält. Lehnt HA ab, wirft der Aufruf.
  async _chronikItems() {
    if (!this._chronikOn()) return null;
    const id = this._cfg.chronicle_entity;
    const r = await this._hass.callWS({ type: 'todo/item/list', entity_id: id });
    if (!Array.isArray(r?.items) || id !== this._cfg?.chronicle_entity) return null;
    this._chronikStand = { t: this._haNow(), tage: chronikTage(r.items) };
    return r.items;
  }

  // Liste lesen. → { t, tage: Map Datum → Eintrag } (auch in this._chronikStand) oder null, wenn sie gerade nicht
  // lesbar ist. Schreibt nichts.
  async _chronikLesen() {
    try {
      return (await this._chronikItems()) ? this._chronikStand : null;
    } catch (e) {
      this._chronikFail(e);
      return null;
    }
  }

  // Schritte aus chronikPlan der Reihe nach ausführen, jeden einzeln abgewartet (eine Liste von uids lehnt HA ganz
  // ab, wenn eine fehlt). gelesen: wann die Liste gelesen wurde, aus der die Schritte stammen (Date.now()).
  // → wie viele etwas geschrieben haben: Dann wird nachgeprüft.
  // Der fünfte Parameter von callService (notifyOnError) ist false: Sonst zeigte das Frontend von HA bei jeder
  // Ablehnung zehn Sekunden lang eine Meldung am Bildschirm, auch im gewöhnlichen Fall „das andere Gerät war schneller“.
  async _chronikDo(steps, live, gelesen) {
    const id = this._cfg.chronicle_entity;
    const ziel = { entity_id: id };
    const offen = new Set(); // Tage, deren bleibender Eintrag in dieser Runde erst noch den gemeinsamen Titel bekommt
    let n = 0;
    for (const s of steps) {
      if (!live()) break;
      const feat = Number(this._hass.states[id]?.attributes?.supported_features) || 0; // 2 löschen, 4 ändern
      if (s.op === 'update') {
        offen.add(s.d);
        if (!(feat & 4)) continue;
      }
      // Gelöscht wird erst in der nächsten Runde, wenn frisch gelesen ist, dass der bleibende Eintrag alles enthält:
      // HA schreibt beim Ändern den ganzen Eintrag zurück, zwei gleichzeitige Änderungen melden beide Erfolg und eine
      // geht still verloren. Wer danach gleich löschte, löschte das Einzige, was es noch gab.
      if (s.op === 'remove' && (offen.has(s.d) || !(feat & 2))) continue;
      // Ändern und Löschen nur aus einem frischen Lesestand. Beides gilt einem Stand der Liste, der sich inzwischen
      // geändert haben kann (das Anlegen davor hing, das Handy schlief): Ein später Titel aus altem Stand ließe einen
      // Eintrag wieder schrumpfen, den ein drittes Gerät vervollständigt hat, und die Dopplung mit dem Rest ist dann
      // schon gelöscht. Also den Rest lassen und neu lesen (zählt wie geschrieben: Es folgt eine Runde). Ein spätes
      // Anlegen kostet dagegen höchstens eine Dopplung, die abgeräumt wird.
      if (s.op !== 'add' && Date.now() - gelesen > CHRONIK.frisch) {
        n++;
        break;
      }
      try {
        if (s.op === 'add') await this._hass.callService('todo', 'add_item', { item: s.summary }, ziel, false);
        else if (s.op === 'update') await this._hass.callService('todo', 'update_item', { item: s.uid, rename: s.summary }, ziel, false);
        else await this._hass.callService('todo', 'remove_item', { item: s.uid }, ziel, false);
        n++;
      } catch (e) {
        // „Eintrag gibt es nicht“ beim Ändern oder Löschen: Das andere Gerät war schneller. Weiter, und nachprüfen.
        if (s.op === 'add' || !this._chronikGone(e)) throw e;
        n++;
      }
    }
    return n;
  }

  // Ablehnung „den Eintrag gibt es nicht (mehr)“: ein schlichtes Objekt mit code und message, kein Error. Gemessen
  // sind zwei Formen:
  //   { code: 'service_validation_error', message: 'Validation error: Unable to find to-do list item: <uid>' }
  //   { code: 'unknown_error', message: 'No existing item with uid/recurrence_id: <uid>/None' }
  // Die zweite kommt, wenn ein anderes Gerät denselben Eintrag eben erst gelöscht hat (zwei Karten räumen dieselbe
  // Dopplung ab): HA prüft die uid zuerst gegen seinen gemerkten Stand der Liste, der dem Speicher kurz
  // hinterherhinkt, und scheitert dann erst im Speicher. Darum zählt die Meldung, nicht der code.
  _chronikGone(e) {
    return !!e && typeof e === 'object' && !(e instanceof Error)
      && (e.translation_key === 'item_not_found' || /unable to find|no existing item/i.test(String(e.message)));
  }

  // Wartezeit vor dem Nachprüfen. Endet auch, wenn der Lauf abgebrochen wird (_chronikStop): Er soll enden und nicht
  // für immer an einem abgeräumten Zeitgeber hängen.
  _chronikWait(ms) {
    return new Promise((done) => {
      const w = { done, t: setTimeout(() => {
        if (this._chronikW === w) this._chronikW = null;
        done();
      }, ms) };
      this._chronikW = w;
    });
  }
}
