// Tagesplan: Speicher im Helfer plan_entity oder im Browser, zusammenführen, senden, kürzen, erneut senden

import { clamp } from '../logik/hilfen.js';
import { HAY_MAX, PLAN_MIN, planBlank, planSer, planParse, planApply } from '../logik/tagesplan.js';
import { ACT_SMALL } from '../logik/beschaeftigungen.js';

export class Tagesplan {
  // ---------- Tagesplan: Speicher ----------

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
    }
    if (P) {
      // Ein anderes Gerät hat entwarnt (dort wurde gepflegt): Die eigene Warnung von eben nicht noch einmal obendrauf
      // legen und 10 s keine neue aussprechen, bis sein Zustand (kommt nach dem Plan) auch hier ist. Sonst schrieben
      // beide gegeneinander an, und die Warnung bliebe trotz Pflege stehen.
      if (sent < 0 && P.gift && P.gift.b == null && this._plan?.gift?.b != null) {
        this._planOps = this._planOps.filter((o) => o.t !== 'gbad');
        this._careHold = Date.now() + 10000;
      }
      this._planBase = P;
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

  _planSave() {
    clearTimeout(this._planT);
    this._planT = setTimeout(() => this._planSaveNow(), 400);
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
      if (v !== this._planSt && v !== this._planSent.at(-1)?.v) {
        this._planSent.push({ v, at: this._haNow() });
        if (this._planSent.length > 8) this._planSent.shift();
        this._hass.callService('input_text', 'set_value', { entity_id: id, value: v })
          .catch((e) => {
            console.warn('pika-pet-card: Tagesplan speichern fehlgeschlagen, neuer Versuch', e);
            this._planRetry(5000);
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
      const id = this._cfg.plan_entity;
      const st = id && this._hass?.states[id]?.state;
      if (!st || !this._planOk) return;
      this._planCompose(false); // zu alte Änderungen fallen hier weg
      if (!this._planOps.some((o) => o.at > this._planAck)) return; // alles bestätigt
      // Getrennt oder Helfer gerade nicht erreichbar: später noch einmal schauen
      if (this._hass.connected === false || st === 'unavailable') return this._planRetry(15000);
      this._planSent = [];
      this._planSave();
    }, ms);
  }
}
