// Tagesplan: Speicher im Helfer plan_entity oder im Browser, zusammenführen, senden, kürzen, erneut senden

import { clamp } from '../logik/hilfen.js';
import { HAY_MAX, PLAN_MIN, planBlank, planSer, planParse, planApply, planOld, planKeep, planRebase } from '../logik/tagesplan.js';
import { ACT_SMALL } from '../logik/beschaeftigungen.js';

// Schreibsperre (siehe _planBlind): so oft schaut ein zurückgehaltenes Schreiben nach, ob es hinaus darf
const PLAN_HOLD = 5000;
// … und so lange gilt ein Zweifel am eigenen Stand höchstens weiter, nachdem HA wieder verbunden liefert, ohne dass ein
// neuer Stand kam (dann hat sich dort nichts geändert)
const PLAN_DOUBT = 10000;
// Einen zurückgefallenen Stand (planKeep) erst nach so langer Zeit wieder vervollständigen: Schrieben nur zwei Geräte
// fast gleichzeitig, legt das überschriebene seine Änderung nach 0,4 s selbst wieder obendrauf, dann ist nichts mehr zu tun
const PLAN_HEAL = 2000;
// … und nur so lange darauf bestehen, wie eine eigene Änderung offen bleibt (siehe _planCompose): Nimmt HA den Wert
// nicht an, ist danach Schluss
const PLAN_MEND = 30 * 6e4;

export class Tagesplan {
  // Anderer Helfer oder Name: von vorn. Ohne plan_entity bleibt der Plan im Browser (je Gerät).
  _planReset() {
    clearTimeout(this._planT);
    this._planT = null;
    clearTimeout(this._planFreshT);
    clearTimeout(this._planRT);
    this._planSeen = false; // der Helfer war schon einmal da (fehlt er später kurz, startet HA wohl neu)
    this._planNewer = false; // im Helfer steht das Format einer neueren Karte: nur lesen
    this._planOps = [];
    this._planSent = []; // gesendet, noch ohne Echo: { v, at }
    this._planAck = 0; // Änderungen bis zu dieser Zeit hat HA bestätigt
    this._planKnown = null; // was dieses Gerät zuletzt im Helfer gesehen hat (für planKeep)
    this._planHeal = false; // im Helfer fehlt etwas, das dort schon stand: wieder hineinschreiben
    this._planHealAt = 0; // … seit wann (siehe _planMend)
    this._planFail = 0; // von HA abgelehnte Schreiben in Folge (wachsende Pause)
    this._planHeld = false; // ein Schreiben wartet, bis der eigene Stand wieder sicher ist (_planBlind)
    this._planDoubt = null; // Zweifel am eigenen Stand: { states, at, fed }
    this._planSt = null; // nicht undefined: sonst bliebe ein fehlender Helfer unbemerkt und _planOk für immer falsch
    this._planOk = !this._cfg.plan_entity; // mit Helfer erst schreiben, wenn sein Stand da ist
    this._planBase = this._planLocal();
    this._plan = this._planBase;
    this._hayKey = null;
    this._hayFromPlan();
  }

  _planLsKey() {
    return `pika-pet-plan:${this._cfg.name}`;
  }

  // Plan aus diesem Browser; beim ersten Mal der Vorrat von früher (bis 0.15 je Gerät gespeichert)
  _planLocal() {
    try {
      const P = planParse(localStorage.getItem(this._planLsKey()));
      if (P) return P;
      const h = JSON.parse(localStorage.getItem('pika-pet-card-hay') || 'null');
      if (h && Number.isFinite(h.n) && Number.isFinite(h.t)) {
        const pal = this._flowerPal();
        const c = (Array.isArray(h.b) ? h.b : []).map((b) => Math.max(0, pal.indexOf(b?.color))).join('');
        return { ...planBlank(this._haNow()), hay: { n: clamp(h.n, 1, HAY_MAX), t: h.t, c, m: 0 } };
      }
    } catch (e) { /* kein Speicher: frisch anfangen */ }
    return planBlank(this._haNow());
  }

  _hassPlan(hass) {
    const id = this._cfg.plan_entity;
    if (!id) return;
    const st = hass.states[id]?.state;
    if (st === this._planSt) return;
    this._planSt = st;
    // Echo eines eigenen Schreibens: alles, was bis dahin geändert wurde, ist in HA angekommen
    const sent = this._planSent.findIndex((e) => e.v === st);
    if (sent >= 0) {
      this._planAck = Math.max(this._planAck, this._planSent[sent].at);
      this._planSent.splice(0, sent + 1);
      this._planFail = 0;
    }
    // Helfer zu kurz für den Plan: er wird nicht beschrieben, sein eingefrorener Stand zählt nicht (sonst sprängen Serie,
    // Album und Vorrat bei jedem Neuladen zurück). Der Plan bleibt im Browser, siehe _planSave.
    const P = this._planMax() < PLAN_MIN ? null : planParse(st);
    if (st !== undefined) this._planSeen = true;
    // Format einer neueren Karte (höheres Präfix oder mehr Felder, als diese Version kennt): nicht überschreiben.
    // Dieses Gerät plant mit seinem letzten Stand weiter und schreibt nichts, bis es neu geladen ist.
    if (typeof st === 'string' && st !== 'unknown' && st !== 'unavailable') {
      const newer = !P && /^p\d+\|/.test(st) && (!st.startsWith('p1|') || st.split('|').length > 6);
      if (newer && !this._planNewer) console.warn(`pika-pet-card: ${id} hat das Format einer neueren Karte, dieses Gerät schreibt den Tagesplan nicht mehr. Bitte neu laden.`);
      this._planNewer = newer;
      // Leer oder etwas anderes als ein Plan: Jemand hat den Helfer von Hand geleert oder überschrieben, er will von
      // vorn anfangen. Was dieses Gerät dort zuvor gesehen hat, zählt dann nicht mehr als „stand schon im Helfer“:
      // Den Plan, mit dem ein neu geladenes Gerät danach frisch beginnt, übernimmt es, ohne etwas zurückzuholen.
      // (Der eigene Plan bleibt wie bisher im Speicher, bis ein Stand aus dem Helfer kommt.)
      if (!P && !newer && this._planMax() >= PLAN_MIN) {
        this._planKnown = null;
        this._planHeal = false;
      }
    }
    if (P) {
      // Ein anderes Gerät hat entwarnt (dort wurde gepflegt): Die eigene Warnung von eben nicht noch einmal obendrauf
      // legen und 10 s keine neue aussprechen, bis sein Zustand (kommt nach dem Plan) auch hier ist. Sonst schrieben
      // beide gegeneinander an, und die Warnung bliebe trotz Pflege stehen.
      if (sent < 0 && P.gift && P.gift.b == null && this._plan?.gift?.b != null) {
        this._planOps = this._planOps.filter((o) => o.t !== 'gbad');
        this._careHold = Date.now() + 10000;
      }
      // Ein fremder Stand, in dem etwas fehlt, das schon im Helfer stand (das andere Gerät schrieb von einem veralteten
      // Stand aus): behalten und, wenn es sonst keiner tut, wieder hineinschreiben. Verglichen wird mit dem, was dieses
      // Gerät zuletzt im Helfer gesehen hat (alt), nicht mit dem eigenen Plan. Die eigenen Änderungen müssen dabei
      // weiter gelten (verschenkt wird mit laufender Nummer, ein guter Tag zählt einmal):
      // - Was HA schon bestätigt hat (steckt in alt) und noch keine 15 s alt ist, legt _planCompose ohnehin wieder
      //   auf den fremden Stand. Darum kommen diese Änderungen zuerst darauf (Q), gerettet wird nur, was dann noch
      //   fehlt. Fehlt nichts, bleibt alles wie immer: Stand ist der fremde, _planCompose schreibt.
      // - Was noch offen ist (unbestätigt, ungesendet), entstand auf dem Stand von alt und kommt danach obendrauf.
      // Ein Echo ist der eigene Plan, daran gibt es nichts zu retten.
      // Erwiesen veraltet ist ein fremder Stand auch, solange das eigene Retten noch aussteht (_planMend): Bis es im
      // Helfer steht, kann kein Gerät darauf aufgebaut haben. Sonst gälte der Plan eines Geräts, das eben neu geladen
      // hat und auf dem veralteten Stand etwas ändert, als frisch, und das Gerettete wäre wieder weg.
      const alt = this._planKnown;
      const old = sent < 0 && !!alt && (planOld(P, alt) || this._planMend());
      const now = this._haNow();
      const Q = this._planOps.filter((o) => o.at <= this._planAck && now - o.at < 15000).reduce((X, o) => planApply(X, o, o.at), P);
      const K = sent < 0 ? planKeep(Q, alt, old) : Q;
      this._planKnown = sent < 0 ? planKeep(P, alt, old) : P;
      if (K !== Q && !this._planMend()) this._planHealAt = now;
      this._planHeal = K !== Q;
      this._planBase = this._planHeal ? K : P;
      // Noch nie gesendetes Streicheln zählt auf den fremden Stand obendrauf, statt in seinem Zähler unterzugehen
      if (sent < 0) this._planOps = planRebase(this._planOps, K);
      // Ein anderes Gerät hat alle eigenen Änderungen schon mitgeschrieben (zusammengeführt): auch das ist bestätigt
      const last = this._planOps.at(-1);
      if (last && last.at > this._planAck && planSer(this._planOps.reduce((Q, o) => planApply(Q, o, o.at), P)) === planSer(P)) {
        this._planAck = last.at;
      }
    }
    if (st === undefined && !this._planWarned) {
      this._planWarned = true;
      console.warn(`pika-pet-card: ${id} gibt es nicht, der Tagesplan bleibt auf diesem Gerät`);
    } else if (!P && st && st !== 'unknown' && st !== 'unavailable' && this._planMax() >= PLAN_MIN && !this._planNewer) {
      console.warn(`pika-pet-card: ${id} enthält "${st}", der Tagesplan fängt neu an`);
    }
    // unknown/unavailable (Start von HA): abwarten, sonst wäre der gespeicherte Plan überschrieben. Ein neu
    // angelegter Helfer bleibt aber "unknown": nach 20 s gilt er als leer.
    clearTimeout(this._planFreshT);
    if (st !== 'unknown' && st !== 'unavailable') this._planReady();
    else if (st === 'unknown' && !this._planOk) {
      this._planFreshT = setTimeout(() => this._planSt === 'unknown' && this._planReady(), 20000);
    } else if (st === 'unavailable' && !this._planOk) {
      // Beim Laden länger nicht erreichbar: trotzdem planen (Beschäftigungen, Päckchen), erst einmal auf diesem Gerät.
      // Kommt der Helfer wieder, kommen die noch unbestätigten eigenen Änderungen auf seinen Stand.
      this._planFreshT = setTimeout(() => {
        if (this._planSt !== 'unavailable') return;
        console.warn(`pika-pet-card: ${id} ist nicht erreichbar, der Tagesplan läuft vorerst auf diesem Gerät`);
        this._planReady();
      }, 60000);
    }
    this._planCompose(true);
    // (nicht, wenn ohnehin gleich geschrieben wird: Das nimmt das Gerettete mit)
    if (this._planMend() && !this._planT && planSer(this._plan) !== st) this._planSave(PLAN_HEAL);
  }

  // Steht ein Retten aus (im Helfer fehlt etwas, das dort schon stand)? Höchstens PLAN_MEND lang: Lehnt HA das
  // Schreiben ab, versuchte die Karte es sonst ohne Ende.
  _planMend() {
    return this._planHeal && this._haNow() - this._planHealAt < PLAN_MEND;
  }

  _planReady() {
    if (this._planOk) return;
    this._planOk = true;
    this._planCompose(true);
    // Jetzt ist klar, was gerade läuft: gleich einsteigen statt die Kleinigkeit zu Ende zu machen
    if (this._running && (this._planWaiting || (ACT_SMALL.includes(this._action) && this._slotNow()))) this._interrupt();
  }

  // Plan = letzter bekannter Stand + eigene Änderungen der letzten 15 s. Die kommen auch auf einen fremden Stand
  // noch einmal obendrauf: Schrieben zwei Geräte fast gleichzeitig, geht so keine verloren. Hat HA eine Änderung
  // noch nicht bestätigt (Verbindung weg, Fehler), bleibt sie länger (höchstens 30 Min) und wird erneut gesendet.
  // Behalten wird immer ein zusammenhängendes jüngstes Stück, so bleibt die Reihenfolge beim Wiederholen gleich.
  _planCompose(incoming) {
    const now = this._haNow();
    // Nicht länger behalten: 'gbad' (würde eine inzwischen von einem anderen Gerät geschriebene Entwarnung wieder
    // aufheben, die Serie risse) und 'gdbg' (Vorschau, nicht wiederholbar)
    this._planOps = this._planOps.filter((o) => now - o.at < 15000
      || (o.at > this._planAck && o.t !== 'gdbg' && o.t !== 'gbad' && now - o.at < 30 * 6e4));
    let P = this._planBase;
    for (const o of this._planOps) P = planApply(P, o, o.at);
    // Ein Gerät bis 0.18 schrieb den Plan ohne Päckchen zurück: den letzten Stand behalten und wieder eintragen
    const keep = this._giftKeep && this._planKeyGift === this._planKey ? this._giftKeep : null;
    let lost = !P.gift && !!keep;
    if (lost) P = { ...P, gift: { ...keep } };
    // Ein Gerät bis 0.22 schrieb das Album ohne Stufen zurück (v fehlt): Stufen wachsen nur, also wieder dazunehmen
    else if (P.gift?.nov && keep?.v && (P.gift.v & keep.v) !== keep.v && P.gift.u === (P.gift.u | keep.u)) {
      P = { ...P, gift: { ...P.gift, v: P.gift.v | keep.v, nov: undefined } };
      lost = true;
    }
    P = this._planFit(P);
    const changed = planSer(P) !== planSer(this._plan);
    this._plan = P;
    this._hayFromPlan();
    this._giftFromPlan();
    this._flowerFromPlan();
    this._foodFromPlan();
    this._friendFromPlan();
    this._urlaubFromPlan();
    this._sigBinSync(); // „Tonne steht draußen“ steht im Plan
    this._giftCredit();
    // Fehlt dem fremden Stand etwas von hier: noch einmal schreiben
    if (incoming && (this._planOps.length || lost) && planSer(P) !== planSer(this._planBase)) this._planSave();
    return changed;
  }

  _planOp(op) {
    op.at = this._haNow();
    this._planOps.push(op);
    if (this._planCompose(false)) this._planSave();
  }

  _planSave(ms = 400) {
    clearTimeout(this._planT);
    this._planT = setTimeout(() => this._planSaveNow(), ms);
  }

  // Weiß dieses Gerät gerade nicht sicher, was im Helfer steht? Dann schreibt es den Plan nicht: Es legte seine
  // Änderung auf einen veralteten Stand, und der überschriebe im Helfer alles, was die anderen Geräte inzwischen
  // geschrieben haben (verschenkte und ausgepackte Päckchen, Album, Streicheln, Erlebnisse). So ist es
  // - abgehängt (_planPark): HA liefert einer Karte in einer zwischengespeicherten Ansicht oder in einem nach 5 Min im
  //   Hintergrund weggeräumten Panel kein hass mehr. Ihr letztes hass-Objekt sagt weiter „verbunden“ und kann senden.
  // - getrennt. Auch nach dem letzten hass-Objekt gefragt (hass.connection, die Verbindung selbst): Die weggeräumte
  //   Karte bekommt das Trennen nicht mehr mit. Was in der Zeit des Wiederverbindens gesendet wird, stellt HA zurück
  //   und schickt es los, bevor der frische Stand kommt.
  // - nach langer Pause oder dem Wiederverbinden noch ohne frischen Stand (_planStale)
  // - im Zweifel (_planDoubt): Nach dem Trennen oder Wiedereinhängen gilt der eigene Stand erst wieder, wenn HA
  //   verbunden einen neuen geliefert hat (_planHass). Liefert HA verbunden ein hass mit denselben Zuständen und
  //   danach PLAN_DOUBT lang keine neuen, hat sich dort nichts geändert: Dann gilt der alte. Ohne ein einziges hass
  //   seit dem Zweifel endet er nie: Dass nichts ankommt, heißt nicht, dass nichts geschah (eine wieder eingehängte
  //   Karte hat alles verpasst, auch wenn die Verbindung steht).
  _planBlind() {
    const h = this._hass;
    if (this._planOff || !h) return true;
    if (h.connected === false || h.connection?.connected === false) {
      this._planDoubt = { states: h.states, at: Date.now(), fed: false };
      return true;
    }
    if (this._planStale) return true;
    const D = this._planDoubt;
    if (!D) return false;
    if (!D.fed || Date.now() - D.at < PLAN_DOUBT) return true;
    this._planDoubt = null;
    return false;
  }

  // Jedes hass (am Ende von set hass, der Plan ist dann schon gelesen): Zweifel am eigenen Stand führen und beenden,
  // Zurückgehaltenes hinausschicken, sobald es darf. fresh: ein neues hass-Objekt.
  _planHass(hass, fresh) {
    const D = this._planDoubt;
    if (hass.connected === false || hass.connection?.connected === false) {
      this._planDoubt = { states: hass.states, at: Date.now(), fed: false };
    } else if (D && fresh) {
      // Ein anderes states-Objekt als beim Aufkommen des Zweifels: Das ist der frische Stand. Dasselbe (nur „wieder
      // verbunden“, oder es hat sich nichts geändert): Ab jetzt läuft die Frist, der frische Stand kommt gleich.
      if (hass.states !== D.states) this._planDoubt = null;
      else if (!D.fed) Object.assign(D, { fed: true, at: Date.now() });
    }
    if (this._planHeld && !this._planBlind()) {
      this._planHeld = false;
      this._planSave();
    }
  }

  // Karte wird abgehängt: Ungesendetes noch hinaus (bis eben kam hass, der Stand ist frisch), danach schreibt sie den
  // Plan nicht mehr, bis sie wieder eingehängt ist. Ohne das sendete eine abgehängte Karte, der noch eine Bestätigung
  // fehlt, ihren alten Plan bis zu 30 Min lang alle 15 s neu (_planRetry) und überschrieb damit jedes Mal, was die
  // anderen Geräte gerade geschrieben hatten.
  _planPark() {
    if (this._planOff) return;
    if (this._planT) this._planSaveNow();
    this._planOff = true;
    clearTimeout(this._planRT);
    this._planRT = null;
  }

  // Wieder eingehängt. long: Sie war länger weg, ihr Stand ist so alt wie die Trennung (Zweifel, bis HA frisch liefert).
  _planWake(long) {
    if (!this._planOff) return;
    this._planOff = false;
    if (long) this._planDoubt = { states: this._hass?.states, at: Date.now(), fed: false };
    if (this._planHeld || this._planMend() || this._planOps.some((o) => o.at > this._planAck)) this._planRetry(PLAN_HOLD);
  }

  _planSaveNow() {
    clearTimeout(this._planT);
    this._planT = null;
    const id = this._cfg.plan_entity;
    const ent = id && this._hass?.states[id];
    const P = this._plan;
    const v = planSer(P);
    // Helfer zu kurz (max. Länge unter PLAN_MIN): Päckchen und Verlauf passen nicht hinein, darum gar nicht
    // senden (HA lehnte jeden Wert ab), sondern einmal deutlich warnen und im Browser weiterplanen
    const short = ent && this._planMax() < PLAN_MIN;
    if (short && !this._planShortW) {
      this._planShortW = true;
      console.warn(`pika-pet-card: ${id} ist zu kurz (max. Länge ${this._planMax()}), bitte auf 255 stellen. Der Tagesplan bleibt bis dahin auf diesem Gerät.`);
    }
    if (id && !short && (this._planNewer || (!ent && this._planSeen))) {
      // Im Helfer steht ein neueres Format (siehe _hassPlan): nichts senden. Oder der Helfer war da und fehlt gerade
      // (HA startet neu): nichts als bestätigt werten. Die eigenen Änderungen bleiben offen und kommen auf seinen
      // Stand, sobald er wieder da ist (_hassPlan → _planCompose); lokal bestätigt fielen sie nach 15 s weg.
      this._planBase = P;
      return;
    }
    if (ent && !short) {
      // Stand aus HA noch nicht da (Start): beim Eintreffen wird zusammengeführt und geschrieben
      if (!this._planOk) return;
      // Nicht erreichbar (war es schon beim Laden, plant die Karte nach 60 s lokal weiter): nicht ins Leere senden,
      // später noch einmal; die eigenen Änderungen bleiben bis zur Bestätigung (siehe _planCompose)
      // ("unknown" ist ein frisch angelegter, leerer Helfer: den beschreiben, _planOk kam erst nach 20 s)
      if (ent.state === 'unavailable') {
        this._planBase = P;
        return this._planRetry(15000);
      }
      // _planSt bleibt der Stand von HA (erst das Echo ändert ihn): so liest nicht jedes fremde hass-Update bis zum
      // Echo den alten Stand neu ein und schreibt denselben Wert noch einmal
      const neu = v !== this._planSt && v !== this._planSent.at(-1)?.v;
      // Der eigene Stand ist gerade nicht sicher der von HA (_planBlind): nicht senden. Die eigenen Änderungen bleiben
      // offen wie oben und gehen hinaus, sobald ein frischer Stand da ist, dann auf ihn gelegt (_planHass).
      this._planHeld = neu && this._planBlind();
      if (this._planHeld) {
        this._planBase = P;
        // (wie unten: nicht wiederholbar, und mit P als Stand zählte es beim nächsten Zusammensetzen doppelt)
        this._planOps = this._planOps.filter((o) => !(o.t === 'gather' && o.m == null));
        if (!this._planOff) this._planRetry(PLAN_HOLD);
        return;
      }
      if (neu) {
        // n: so viele hass-Objekte kamen bis zum Senden (siehe _planRetry)
        const e = { v, at: this._haNow(), n: this._hassN };
        this._planSent.push(e);
        if (this._planSent.length > 8) this._planSent.shift();
        // Ab jetzt kann jede dieser Änderungen in einem fremden Stand schon stecken (siehe planRebase)
        for (const o of this._planOps) o.out = true;
        this._hass.callService('input_text', 'set_value', { entity_id: id, value: v })
          .catch((err) => {
            console.warn('pika-pet-card: Tagesplan speichern fehlgeschlagen, neuer Versuch', err);
            e.failed = true;
            // mit wachsender Pause wie beim Zustand (5 s, 10 s … höchstens 5 Min): Lehnt HA den Wert ab, nicht alle
            // paar Sekunden wieder; das nächste Echo setzt sie zurück
            this._planFail++;
            this._planRetry(Math.min(5000 * 2 ** (this._planFail - 1), 3e5));
          });
        this._planRetry(15000);
      }
    } else {
      try {
        localStorage.setItem(this._planLsKey(), v);
      } catch (e) { /* privat/gesperrt: dann nur bis zum Neuladen */ }
      this._diaryLog('p', v);
      this._planAck = this._haNow(); // lokal gibt es kein Echo
    }
    this._planBase = P;
    this._giftCredit();
    // Sammeln aus der Vorschau (ohne Fenster) lässt sich nicht wiederholen, ohne doppelt zu zählen
    this._planOps = this._planOps.filter((o) => !(o.t === 'gather' && o.m == null));
  }

  // Seite wird versteckt oder geschlossen (App zu, Neuladen): Ungesendetes sofort hinaus, die Zeitgeber kämen nicht
  // mehr dran und das eben Gefütterte oder Gestreichelte wäre weg
  _flush() {
    if (this._saveT) this._saveNow();
    if (this._planT) this._planSaveNow();
  }

  // Max. Länge des Helfers (ohne Helfer: unbegrenzt, der Plan bleibt im Browser)
  _planMax() {
    const ent = this._cfg.plan_entity && this._hass?.states[this._cfg.plan_entity];
    return ent ? Number(ent.attributes?.max) || 255 : Infinity;
  }

  // Zu lang für den Helfer (max. Länge knapp eingestellt): ältere Einträge des Verlaufs weglassen. Auch im eigenen Plan,
  // nicht nur beim Senden: so plant dieses Gerät mit demselben Verlauf weiter wie die anderen.
  _planFit(P) {
    const max = this._planMax();
    if (max < PLAN_MIN) return P;
    let v = planSer(P);
    for (let n = P.rec.length - 1; v.length > max && n >= 0; n--) {
      P = { ...P, rec: P.rec.slice(0, n) };
      v = planSer(P);
    }
    return P;
  }

  // Kein Echo (Verbindung weg, HA neu gestartet) oder Fehler: noch einmal senden, solange eigene Änderungen offen sind
  _planRetry(ms) {
    clearTimeout(this._planRT);
    this._planRT = setTimeout(() => {
      this._planRT = null;
      // Abgehängt: nichts tun, beim Einhängen geht es weiter (_planWake)
      if (this._planOff) return;
      const id = this._cfg.plan_entity;
      const st = id && this._hass?.states[id]?.state;
      if (!st || !this._planOk) return;
      // Etwas offen? Eine unbestätigte Änderung, ein zurückgehaltenes Schreiben, oder im Helfer fehlt etwas, das
      // wieder hineinmuss.
      const open = () => this._planHeld || this._planOps.some((o) => o.at > this._planAck) || (this._planMend() && planSer(this._plan) !== st);
      // Eigener Stand gerade nicht sicher (getrennt, veraltet): später noch einmal schauen. (Ohne den Plan neu
      // zusammenzusetzen: Das zöge sonst, solange die Verbindung fehlt, alle 5 s die Szene nach.)
      if (this._planBlind()) {
        if (open()) this._planRetry(PLAN_HOLD);
        return;
      }
      this._planCompose(false); // zu alte Änderungen fallen hier weg
      // Nichts offen. Ein Schreiben, dessen Echo bis jetzt nicht kam (die Karte war abgehängt, ein anderes Gerät hat
      // die Änderung mitgeschrieben), gilt nicht länger als unterwegs: Stünde sein Wert später noch einmal im Helfer,
      // wäre das ein fremder Stand, kein Echo.
      if (!open()) {
        this._planSent = [];
        return;
      }
      // Helfer nicht erreichbar: später noch einmal schauen
      if (st === 'unavailable') return this._planRetry(15000);
      // Seit dem Senden kam gar kein hass: Dann konnte auch kein Echo kommen. Die Karte bekommt gerade nichts mit und
      // schriebe nur wieder denselben, inzwischen vielleicht veralteten Plan. Warten, bis HA wieder liefert (wie
      // _sentCheck beim Zustand). Ein abgelehntes Schreiben (failed) ist dagegen sicher nicht angekommen.
      const last = this._planSent.at(-1);
      if (last && !last.failed && last.n === this._hassN) return this._planRetry(15000);
      this._planSent = [];
      this._planSave();
    }, ms);
  }
}
