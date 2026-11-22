// Zustand und Uhr: Werte, Abbau, Speichern mit Echo-Abgleich, Balken, Uhr von HA, Neustart von HA erkennen

import { clamp } from '../logik/hilfen.js';
import {
  RATE, SLEEP_DECAY, CLOCK_KEEP, CLOCK_STEP, SELF_MAX, ECHO_JUDGE, sec, freshStats, serialize, parseStats, mergeStats,
} from '../logik/zustand.js';
import { CRIT_KINDS } from '../logik/besucher.js';
import { urlaubCut } from '../logik/urlaub.js';

// Alles, was im Browser unter „<Schlüssel>:<Name der Karte>“ liegt (siehe _lsRename): Zustand, Tagesplan, Päckchen-Knopf
// gesehen, Tagebuch (Verlauf ohne Helfer, zuletzt gelesen), Chronik, Entdeckungen (Tagebuch), Postkarte gesehen (Urlaub)
const LS_KEYS = ['pika-pet-card', 'pika-pet-plan', 'pika-pet-gift', 'pika-pet-diary', 'pika-pet-diary-seen', 'pika-pet-chronik', 'pika-pet-finds', 'pika-pet-post'];
// Zustand speichern: so lange nach dem Senden wird zum ersten Mal nach dem Echo geschaut, danach mit doppelter Pause bis
// SENT_MAX, und insgesamt höchstens SENT_END lang (siehe _sentLook)
const SENT_FIRST = 15000;
const SENT_MAX = 3e5;
const SENT_END = 30 * 6e4;

export class Zustand {
  // Die gemeinsame Uhr wurde nachgestellt: wartende Besuche und den Beginn der nächsten Beschäftigung neu planen
  // (Vögelchen, Maus, Frosch und Schnecke, die gerade da sind, bleiben; danach wird ohnehin mit der neuen Uhr geplant).
  // by: um so viele ms wurde die Uhr vorgestellt (negativ: zurück)
  _clockMoved(by = 0) {
    if (this._critOn && this._critPlan) {
      for (const k of CRIT_KINDS) {
        if (!this._critT[k]) continue;
        clearTimeout(this._critT[k]);
        this._critPlan(k, this._critLast[k]);
      }
    }
    if (this._running) {
      this._slotNext = null;
      this._slotArm();
    }
    // Pinos nächster Besuch wartet noch mit der alten Uhr: Er käme um den Versatz zu spät oder gar nicht
    if (this._frT && !this._fr) this._friendPlan();
    // Pino ist schon da: Sein Abschied hängt noch an der alten Uhr, er ginge um den Versatz zu früh oder zu spät
    // (Geräteuhr geht beim Laden falsch, die erste Probe kommt erst nach seiner Ankunft). Ein Besuch aus der
    // Vorschau (force) hat eine feste Dauer.
    const fr = this._fr;
    if (by && fr && fr.planned && !fr.leaving) this._friendUntil(fr, fr.until - by);
    // Wecker für Mitternacht und „Helau!“ neu stellen (der alte tut zur falschen Zeit nichts, siehe _festArm)
    if (this._festArmed) {
      this._festArmed = null;
      this._festArm();
    }
  }

  // ---------- Zustand ----------

  _raw(k) {
    if (!this._stats) return 70;
    const t = this._stats[k + 't'];
    const now = this._haNow();
    // Wird oft gefragt (Balken, Auswahl der Aktionen): je Sekunde einmal rechnen
    const ur = this._plan?.ur;
    const key = `${t}|${Math.floor(now / 1000)}|${this._wdSig}|${ur ? `${ur.t}.${ur.d}` : ''}`;
    const M = (this._rawM ??= {});
    if (M[k]?.key !== key) M[k] = { key, h: this._decayH(t, now) };
    return clamp(this._stats[k] - M[k].h * RATE[k], 0, 100);
  }

  // Abbau-Stunden zwischen t1 und t2: wach voll, im Schlaf SLEEP_DECAY (Wachfenster wie bei Schlafenszeit und Häufchen).
  // Die Zeit eines Urlaubs (Tagesplan) zählt nicht: Solange er läuft, stehen die Werte.
  _decayH(t1, t2) {
    if (!(t2 > t1)) return (t2 - t1) / 3.6e6; // Stand aus der Zukunft (Uhr): gleichmäßig
    const h = (a, b) => {
      const aw = this._awakeMs(a, b);
      return (aw + SLEEP_DECAY * (b - a - aw)) / 3.6e6;
    };
    const cut = urlaubCut(this._plan?.ur, t1, t2);
    return h(t1, t2) - (cut ? h(cut[0], cut[1]) : 0);
  }

  // Umkehrung: wann ab t h Abbau-Stunden vergangen sind (wann ein Wert unter eine Grenze fällt)
  _decayAt(t, h) {
    return this._awakeAdd(t, h * 3.6e6, SLEEP_DECAY);
  }

  // Glück ist durch Schmutz gedeckelt: bei 0 % sauber höchstens 60 %. Streicheln zählt trotzdem
  // weiter, nach dem Putzen zeigt der Balken dann den vollen Wert.
  _get(k) {
    const v = this._raw(k);
    return k === 'g' ? Math.min(v, 60 + 0.4 * this._poopsSeen().clean) : v;
  }

  // Satt durch selbst Gefressenes, höchstens bis SELF_MAX
  _selfFed(d) {
    // Nur ganze Bissen: Knapp unter SELF_MAX schrieb sonst jedes Knabbern (alle paar Minuten) ein Zehntel in den
    // Helfer, Hunderte Zeilen am Tag im Verlauf von HA
    if (SELF_MAX - this._raw('s') >= d) this._add('s', d, true);
  }

  // self: zählt nicht als Pflege (selbst gefressen, Inhalt eines Päckchens). Füttern, Streicheln, Putzen kommen von dir
  // und zählen: Ist danach alles wieder über GIFT.min, endet die Lücke in der Pflege-Serie.
  _add(k, d, self = false) {
    this._careEval(); // vorher: lag schon etwas unter GIFT.min, steht es damit fest
    if (!this._stats) this._stats = freshStats(this._haNow());
    this._stats[k] = clamp(this._raw(k) + d, 0, 100);
    this._stats[k + 't'] = this._haNow();
    this._gain[k] += d; // noch nicht gesendet (für das Zusammenführen mit fremden Ständen)
    this._renderStats();
    this._save();
    if (!self) this._careEval(true);
  }

  // Alles, was dieses Gerät gewonnen, aber HA noch nicht bestätigt hat (ungesendet + unterwegs)
  _sentGain() {
    const g = { ...this._gain };
    for (const e of this._sent) {
      g.s += e.gain.s;
      g.g += e.gain.g;
      g.c ||= e.gain.c;
    }
    return g;
  }

  // Ein Schreiben ging verloren (Fehler, keine Bestätigung): seinen Gewinn zurücknehmen und neu senden. Gemerkt
  // (30 Min), falls sein Echo doch noch kommt (siehe set hass).
  _sentLost(e) {
    const i = this._sent.indexOf(e);
    if (i < 0) return;
    this._sent.splice(i, 1);
    const now = Date.now();
    this._lostW = [...(this._lostW || []).filter((l) => now - l.at < 30 * 6e4), { v: e.v, gain: e.gain, at: now }].slice(-8);
    this._gain.s += e.gain.s;
    this._gain.g += e.gain.g;
    this._gain.c ||= e.gain.c;
    // (vielleicht ist es doch angekommen: Das nächste Schreiben trägt dann einen Gewinn, der schon in HA steht)
    this._gainOld = true;
    this._save();
  }

  // Gewinn g ist doch schon in HA: aus dem Ungesendeten und den unbestätigten Schreiben (neueste zuerst) nehmen
  _gainSub(g) {
    for (const k of ['s', 'g']) {
      let r = g[k];
      for (const o of [this._gain, ...this._sent.map((e) => e.gain).reverse()]) {
        if (!(r > 0)) break;
        const d = Math.min(r, o[k]);
        if (d > 0) {
          o[k] -= d;
          r -= d;
        }
      }
    }
  }

  // ---------- Echo oder fremder Stand? ----------
  // Ein eigenes Schreiben kommt als neuer Stand des Helfers zurück (Echo). Erkannt wird es am Wortlaut. Das reicht nicht,
  // wenn zwei Geräte im selben Augenblick dasselbe tun (beide füttern in derselben Sekunde, beide streicheln einmal):
  // Beide senden denselben Text, das zweite Schreiben ändert in HA nichts mehr, und das zweite Gerät hielte den Stand
  // des ersten für sein Echo: Eine Portion Futter, ein Streicheln wären weg. Darum zusätzlich die Kennung des Aufrufs:
  // hass.callService antwortet mit { context: { id } }, und der Stand, den der Aufruf erzeugt hat, trägt dieselbe id
  // (hass.states[…].context.id). Jedes gesendete Schreiben e merkt sich
  //   e.ctx: undefined, solange die Antwort aussteht; die Kennung; oder null (Antwort ohne Kennung: ältere HA-Version)
  //   e.seen: die Kennung des Stands, der nach dem Wortlaut als Echo angenommen wurde, als die Antwort noch ausstand
  // Antwort und Stand kommen in beliebiger Reihenfolge (HA schickt erst den Stand, dann die Antwort; im Browser läuft
  // die Antwort als Promise aber oft vor dem hass, das erst durch die Elemente gereicht wird):
  //   - Antwort zuerst: Beim Eintreffen des Stands steht fest, ob es das eigene Schreiben war.
  //   - Stand zuerst: wie bisher als Echo annehmen und die Kennung merken (seen); die Antwort entscheidet nachträglich.
  // Als fremd gilt ein gleichlautender Stand nur, wenn beide Kennungen bekannt und verschieden sind. In jedem anderen
  // Fall (HA ohne Kennungen, Antwort bleibt aus oder ist ein Fehler, Tests ohne context) gilt wie bis 0.43.0 der Wortlaut.
  // Und er gilt auch dann, wenn die andere Kennung noch etwas anderes heißen kann als „ein anderes Gerät hat im selben
  // Augenblick dasselbe getan“ (e.txt, nur der Wortlaut zählt). Geurteilt wird also nur, wenn diese Karte genau diesen
  // Text genau einmal gesendet hat, seitdem lückenlos zugehört hat und der gleichlautende Stand der erste ist, den sie
  // danach sieht:
  //   - Der Text ging schon einmal hinaus (neuer Versuch nach einem Fehler oder ohne Echo, _sentLost; der Plan nach
  //     _planRetry): War der erste Versuch doch angekommen, trägt der Stand dessen Kennung, und der zweite, der in HA
  //     nichts mehr ändert, bekommt eine andere. Das Echo des eigenen Schreibens sähe fremd aus (Füttern zählte doppelt).
  //   - Tagesplan: Die Karte war seit dem Senden abgehängt oder getrennt, ihr Echo kann sie verpasst haben. Ein anderes
  //     Gerät kann den Plan inzwischen überschrieben und genau diesen Wortlaut wiederhergestellt haben (planKeep kopiert,
  //     was fehlt), dann unter seiner Kennung: Das Streicheln steckt darin und zählte doppelt. Beim Zustand gibt es
  //     kein solches Wiederherstellen: Wer dort denselben Text schreibt, hat selbst gefüttert, dem Stand fehlt dann
  //     auch nach einer Lücke eine der beiden Portionen.
  //   - Sie hat seit dem Senden einen anderen Stand des Helfers gesehen: Dann kann das eigene Echo in einer Meldung mit
  //     ihm untergegangen sein, und was jetzt gleich lautet, kann wieder eine Wiederherstellung sein.
  //   - Der Gewinn darin stammt aus einem früheren Schreiben, das vielleicht schon angekommen war (_gainOld).

  // Das Schreiben in list, dessen Echo der Stand st mit der Kennung ctx ist (→ Index, -1: keins): das mit dieser
  // Kennung, sonst das erste mit diesem Wortlaut
  _echoFind(list, st, ctx) {
    const i = ctx ? list.findIndex((e) => e.v === st && e.ctx === ctx) : -1;
    return i >= 0 ? i : list.findIndex((e) => e.v === st);
  }

  // Ein Stand mit dem Wortlaut von e und der Kennung ctx wurde als Echo angenommen. War er es? → true: erwiesen nicht,
  // es war der gleichlautende Stand eines anderen Geräts. Steht die Antwort noch aus, merkt sich e die Kennung (die
  // Antwort entscheidet, siehe _saveNow und _planSaveNow). ms: wann e gesendet wurde (Gerätezeit); nach ECHO_JUDGE
  // wird nicht mehr geurteilt.
  _echoFremd(e, ctx, ms) {
    if (!ctx || e.txt || Date.now() - ms >= ECHO_JUDGE) return false;
    if (e.ctx === undefined) e.seen = ctx;
    return !!e.ctx && e.ctx !== ctx;
  }

  // Der als Echo angenommene Stand war der gleichlautende eines anderen Geräts: Das eigene Schreiben e hat in HA nichts
  // mehr geändert, sein Gewinn fehlt dort. Wie bei jedem fremden Stand obendrauf legen und schreiben. (Putzen braucht
  // das nicht: Dasselbe Häufchen zweimal wegzumachen ändert nichts.)
  _sentAgain(e) {
    const g = e.gain;
    if (!this._stats || !(g.s || g.g)) return;
    e.gain = { s: 0, g: 0, c: false };
    this._gain.s += g.s;
    this._gain.g += g.g;
    this._gain.c ||= g.c;
    const cur = parseStats(this._hass?.states[this._cfg.entity]?.state);
    if (cur) this._statsMerge(cur);
    else this._save();
    this._renderStats();
  }

  // Für alle Schreiben in list (unbestätigte des Zustands oder des Plans) zählt ab jetzt nur noch der Wortlaut
  _echoTxt(list) {
    for (const e of list) e.txt = true;
  }

  // Ein Schreiben mit dem Text v geht hinaus: Ging derselbe Text von dieser Karte schon einmal hinaus (seen: die
  // letzten gesendeten Texte, wird fortgeschrieben)? Dann zählt für alle mit diesem Text nur der Wortlaut. → ob
  _echoDup(list, seen, v) {
    const dup = seen.includes(v);
    if (dup) for (const e of list) if (e.v === v) e.txt = true;
    seen.push(v);
    if (seen.length > 8) seen.shift();
    return dup;
  }

  // Fremden Stand (parsed, eben aus dem Helfer gelesen) mit dem eigenen zusammenführen: Alles, was hier noch offen ist
  // (ungesendet oder unbestätigt), kommt obendrauf und geht mit dem nächsten Schreiben hinaus.
  _statsMerge(parsed, gain = this._sentGain()) {
    // (War eins der unbestätigten doch schon angekommen, steht sein Gewinn bereits in HA, siehe _echoFremd)
    if (this._sent.some((e) => e.gain.s || e.gain.g)) this._gainOld = true;
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
  }

  // Vor dem Zusammenführen mit einem fremden Stand: Ein unbestätigtes Schreiben, das HA ausgeführt hat (ok: die Antwort
  // ist da, und HA antwortet erst nach dem Ausführen), dessen Echo diese Karte aber verpasst haben kann, weil sie seit
  // dem Senden abgehängt oder getrennt war (gap), gilt als angekommen. Der fremde Stand ist dann nicht einer, der HA
  // vor dem eigenen erreichte (das ist die Annahme beim Zusammenführen), sondern der letzte nach einer Lücke: Die
  // anderen Geräte haben den eigenen längst gesehen und darauf aufgebaut, sein Gewinn steckt schon darin. Bis 0.43.0
  // kam er ein zweites Mal obendrauf: füttern, gleich die Ansicht wechseln, ein anderes Gerät füttert – beim
  // Zurückkommen zählte das eigene Füttern doppelt. Hat die Karte ohne Lücke zugehört, bleibt es bei der Annahme.
  _sentSettle() {
    const n = this._sent.length;
    for (let i = n - 1; i >= 0; i--) if (this._sent[i].ok && this._sent[i].gap) this._sent.splice(i, 1);
    if (this._sent.length !== n) this._sentArm();
  }

  // Ein Zeitgeber für alle unbestätigten Schreiben: Er läuft bis zum frühesten Termin (e.due), dann wird nachgesehen
  // (_sentLook). Abgehängt läuft keiner (_sentPark): Bis 0.43.0 stellte sich die Prüfung ohne frisches hass alle 5 Min
  // neu, ohne Ende, und eine weggeworfene Karte hielt so für immer einen Zeitgeber (und sich selbst) am Leben.
  _sentArm() {
    clearTimeout(this._sentT);
    this._sentT = null;
    if (this._sentOff) return;
    const due = Math.min(...this._sent.map((e) => e.due ?? Infinity));
    if (due < Infinity) this._sentT = setTimeout(() => this._sentLook(), Math.max(0, due - Date.now()));
  }

  // Kein Echo bis zum Termin: Steht der Wert doch in HA, gilt er als angekommen. Verloren ist er erst, wenn seit dem
  // Senden ein frischer, verbundener Stand von HA kam (sonst bekommt die Karte gerade gar nichts mit und sendete endlos
  // denselben Wert): dann neu senden, sonst später wieder schauen (nach 15 s, dann mit doppelter Pause bis 5 Min).
  // Höchstens SENT_END lang: Danach ruht es, bis HA wieder liefert (_sentWake). Ein abgelehntes Schreiben (failed) geht
  // nach seiner Pause neu hinaus.
  _sentLook() {
    this._sentT = null;
    const now = Date.now();
    for (const e of [...this._sent]) {
      if (!this._sent.includes(e) || e.due == null || e.due > now) continue;
      if (e.failed) {
        this._sentLost(e);
        continue;
      }
      // (Wessen Schreiben es war, wird hier nicht mehr gefragt: Dafür ist es zu spät, siehe ECHO_JUDGE. Ein Echo
      // erkennt ohnehin set hass; hierher kommt nur, was dort nie ankam.)
      if (this._hass?.states[this._cfg.entity]?.state === e.v) this._sent.splice(this._sent.indexOf(e), 1);
      else if (this._hassN === e.n || this._hass?.connected === false) {
        e.step = Math.min(e.step * 2, SENT_MAX);
        e.due = now - e.at < SENT_END ? now + e.step : null;
      } else this._sentLost(e);
    }
    this._sentArm();
  }

  // Karte wird abgehängt (ab hier kommt kein hass mehr): nicht weiter nach Echos schauen. Was jetzt noch unbestätigt
  // ist, verpasst sein Echo vielleicht (siehe _sentSettle).
  _sentPark() {
    this._sentOff = true;
    clearTimeout(this._sentT);
    this._sentT = null;
    this._sentGap();
  }

  // Ab jetzt kann diese Karte Stände verpassen (abgehängt, Verbindung weg)
  _sentGap() {
    for (const e of this._sent) e.gap = true;
  }

  // Wieder eingehängt, oder HA liefert wieder (set hass): nach dem, was noch unbestätigt ist, weiterschauen. Was längst
  // fällig war, bekommt eine neue Frist, in der das Echo oder ein frischer Stand kommen kann.
  _sentWake() {
    if (!this._sentOff && (this._sentT || !this._sent.length)) return;
    this._sentOff = false;
    const now = Date.now();
    for (const e of this._sent) if (!(e.due > now)) Object.assign(e, { due: now + (e.failed ? 5000 : SENT_FIRST), step: SENT_FIRST });
    this._sentArm();
  }

  _save() {
    this._pendingWrite = true;
    this._saveWait = false;
    clearTimeout(this._saveT);
    // Gebündelt: 1,2 s nach der letzten Änderung, bei Dauerstreicheln aber spätestens 4 s nach der ersten
    this._saveSince ??= Date.now();
    this._saveT = setTimeout(() => this._saveNow(), clamp(this._saveSince + 4000 - Date.now(), 0, 1200));
  }

  _saveNow() {
    clearTimeout(this._saveT);
    this._saveT = null;
    this._saveSince = null;
    const v = serialize(this._stats);
    if (this._cfg.entity && !this._noEntity) {
      // Stand aus HA noch nicht da (Start, unavailable): warten, beim Eintreffen wird zusammengeführt
      if (!this._synced || !this._hass) return;
      // Vorschau-Karte im Editor von HA (das Frontend setzt dort preview = true, ebenso an den Karten des Dashboards,
      // solange es bearbeitet wird): nichts in den Helfer schreiben. Wer im Editor versehentlich einen anderen
      // Text-Helfer auswählte, hatte ihn sonst nach 1,2 s mit Startwerten überschrieben, noch vor dem Speichern (wie
      // bei der Chronik, _chronikOn). Die Karte spielt im Speicher weiter und führt fremde Stände zusammen; endet die
      // Vorschau an derselben Karte, geht ihr Stand mit dem nächsten hass hinaus (set hass). Gefragt wird erst hier
      // beim Senden: HA setzt preview nach dem ersten hass.
      if (this.preview === true) {
        this._saveHeld = true;
        return;
      }
      this._saveHeld = false;
      const id = this._cfg.entity;
      const st = this._hass.states[id]?.state;
      // Getrennt oder Helfer gerade nicht erreichbar: nicht ins Leere senden (es käme nie ein Echo). Bleibt
      // ungesendet und geht beim nächsten verbundenen hass bzw. zusammengeführt mit dem wiederkehrenden Stand hinaus.
      // ("unknown" ist ein frisch angelegter, leerer Helfer: _synced kommt dort erst nach 20 s, dann beschreiben)
      // Getrennt auch, wenn die Verbindung selbst es sagt (hass.connection): Einer Karte in einem im Hintergrund
      // weggeräumten Panel setzt HA kein hass mehr, ihr letztes sagt noch „verbunden“ (siehe _planBlind).
      if (this._hass.connected === false || this._hass.connection?.connected === false || st === 'unavailable') {
        this._saveWait = true;
        return;
      }
      // Derselbe Wert ändert in HA nichts (es käme kein Echo): nicht senden
      if (st !== v) {
        const L = this._sent;
        const now = Date.now();
        // n: so viele hass-Objekte kamen bis zum Senden; due, step: wann nach dem Echo geschaut wird (_sentLook);
        // gap: Die Karte ist schon abgehängt (der Zeitgeber von _save lief noch), sie wird das Echo nicht sehen
        // txt: Ob ein gleichlautender Stand das eigene Echo ist, entscheidet nur der Wortlaut (siehe _echoFremd)
        const dup = this._echoDup(L, (this._sentV ??= []), v);
        const e = { v, gain: this._gain, at: now, n: this._hassN, step: SENT_FIRST, due: now + SENT_FIRST, gap: this._sentOff === true, txt: dup || !!this._gainOld };
        L.push(e);
        if (L.length > 8) L.shift();
        this._hass
          .callService('input_text', 'set_value', { entity_id: id, value: v })
          .then((r) => {
            // HA hat das Schreiben ausgeführt. Kam ein gleichlautender Stand schon vorher an und trug eine andere
            // Kennung, war er nicht das Echo (siehe „Echo oder fremder Stand?“).
            e.ok = true;
            e.ctx = r?.context?.id || null;
            // Nur, wenn die Antwort bald kommt (HA schickt sie gleich nach dem Stand): Eine, die erst viel später
            // eintrifft, gehört zu einem Schreiben, das so lange unterwegs war, und sagt über den Stand von damals nichts.
            if (this._sent === L && e.seen && e.ctx && e.seen !== e.ctx && Date.now() - e.at < ECHO_JUDGE) this._guard('Zustand', () => this._sentAgain(e));
          }, (err) => {
            console.warn('pika-pet-card: Speichern fehlgeschlagen, neuer Versuch', err);
            // mit wachsender Pause (5 s, 10 s … höchstens 5 Min): lehnt HA den Wert ab, nicht alle paar Sekunden
            this._saveFail = (this._saveFail || 0) + 1;
            e.failed = true; // die Pause hier gilt, _sentLook wertet es nicht vorher schon als verloren
            e.due = Date.now() + Math.min(5000 * 2 ** (this._saveFail - 1), SENT_MAX);
            if (this._sent === L) this._sentArm();
          });
        this._sentArm();
      }
    } else {
      try {
        localStorage.setItem(this._lsKey(), v);
      } catch (e) { /* egal */ }
      this._diaryLog('s', v);
      // Helfer fehlt oder war beim Laden nicht erreichbar: Gewinne behalten, kommt er, gehen sie auf seinen Stand
      if (this._cfg.entity) {
        this._pendingWrite = false;
        return;
      }
    }
    this._gain = { s: 0, g: 0, c: false };
    this._gainOld = false;
    this._pendingWrite = false;
  }

  _lsKey() {
    return `pika-pet-card:${this._cfg.name}`;
  }

  // Im Editor umbenannt: Der Name steckt in den Schlüsseln, unter denen ohne Helfer Zustand, Tagesplan (Vorrat, Serie,
  // Album) und „Päckchen-Knopf schon gesehen“ im Browser liegen (und mit Chronik, für welchen Tag sie schon geprüft
  // ist; dazu die Entdeckungen im Tagebuch und die schon gesehene Postkarte aus dem Urlaub). Den Stand unter den neuen
  // Namen mitnehmen, sonst finge er von vorn an. Kopiert, nicht verschoben: Bricht
  // man das Bearbeiten ab, gilt der alte Name weiter. Der Editor ruft setConfig bei jedem Tastendruck, Zwischenstände
  // („Pik“, „Pi“ …) werden darum wieder entfernt. fest: Die Kopie bleibt auch dann (siehe setConfig: der bereinigte Name).
  _lsRename(from, to, fest = false) {
    if (from == null || to == null || from === to) return;
    try {
      const mine = (this._lsCopies ??= new Set());
      for (const p of LS_KEYS) {
        const v = localStorage.getItem(`${p}:${from}`);
        if (v != null && localStorage.getItem(`${p}:${to}`) == null) {
          localStorage.setItem(`${p}:${to}`, v);
          if (!fest) mine.add(`${p}:${to}`);
        }
        if (mine.delete(`${p}:${from}`)) localStorage.removeItem(`${p}:${from}`);
      }
    } catch (e) { /* kein Speicher: dann gibt es auch nichts mitzunehmen */ }
  }

  _loadLocal() {
    let parsed = null;
    try {
      parsed = parseStats(localStorage.getItem(this._lsKey()));
    } catch (e) { /* egal */ }
    this._stats = parsed || freshStats(this._haNow());
  }

  _renderStats() {
    if (!this._el) return;
    this._renderPiles();
    this._renderBars();
  }

  // Die drei Balken (auch für sich: sobald ein zurückgehaltenes Häufchen daliegt, zählt es, _poopsSeen)
  _renderBars() {
    if (!this._el?.barS || !this._stats) return;
    const s = this._get('s');
    const g = this._get('g');
    const c = this._poopsSeen().clean;
    this._el.barS.style.width = `${s}%`;
    this._el.barG.style.width = `${g}%`;
    this._el.barC.style.width = `${c}%`;
    this._el.stS.classList.toggle('low', s < 30);
    this._el.stG.classList.toggle('low', g < 30);
    this._el.stC.classList.toggle('low', c < 30);
    this._el.stS.title = `Satt: ${Math.round(s)} %`;
    this._el.stG.title = `Glücklich: ${Math.round(g)} %`;
    this._el.stC.title = `Sauber: ${Math.round(c)} %`;
  }

  // Uhr der Häufchen: Uhr von HA (Vorschau: um _dbgShift vorgestellt)
  _now() {
    return this._haNow() + this._dbgShift;
  }

  // ---------- Uhr von HA ----------
  // Geräteuhren gehen oft ein paar Sekunden bis Minuten falsch (Tablet ohne Zeitabgleich). Alles, was alle Geräte
  // gleich sehen sollen (Tagesplan, Besuche, Schlafenszeit, Zustand, Päckchen, Haus-Bote, Kaffee), läuft darum auf
  // der Uhr von HA: Gerätezeit + geschätzter Versatz. Auch die Zeiten im Zustand (satt seit, Großputz) sind HA-Zeit,
  // so rechnen alle Geräte aus demselben Stand dieselben Werte und dieselben Häufchen.
  _haNow() {
    return Date.now() + (this._clockUse || 0);
  }

  // Versatz aus den Zeitstempeln (last_updated) von Meldungen, die gerade eben ankamen: HA stempelt sie kurz vor dem
  // Senden, lu − jetzt ist also etwas kleiner als der wahre Versatz (siehe _clockSample). Erste Sicht und die
  // Sekunden nach dem (Wieder-)Verbinden zählen nicht: Das sind alte Stände.
  _clockHass(hass) {
    const now = Date.now();
    const conn = hass.connected !== false;
    if (conn && !this._clkConn) this._clkSkip = now + 5000;
    this._clkConn = conn;
    const c = this._cfg;
    const seen = (this._clkSeen ??= {});
    for (const id of [c.sun_entity, c.entity, c.plan_entity, c.weather_entity, c.flight_entity]) {
      const o = id ? hass.states[id] : undefined;
      if (o && seen[id] && o !== seen[id] && conn && now > this._clkSkip) this._clockSample(Date.parse(o.last_updated), now);
      if (id) seen[id] = o;
    }
  }

  _clockSample(lu, now = Date.now()) {
    // Im Hintergrund kommen Meldungen verspätet an: nicht werten
    if (!Number.isFinite(lu) || document.hidden) return;
    // Der größte Wert der letzten Meldungen (die mit der kürzesten Laufzeit) passt am besten. Eine später gestellte
    // Geräteuhr (NTP) ist nach CLOCK_KEEP neuen Meldungen vergessen.
    const S = (this._clockS ??= []);
    S.push(lu - now);
    if (S.length > CLOCK_KEEP) S.shift();
    this._clockOff = Math.max(...S);
    // Angewandt wird nur eine Änderung ab CLOCK_STEP: die gemeinsame Uhr soll nicht bei jeder Meldung um ein paar
    // Millisekunden springen, Beschäftigungen und Besuche hängen daran. Geräte liegen so höchstens etwa eine
    // Viertelsekunde auseinander (früher bis 2 s).
    const use = this._clockUse || 0;
    if (Math.abs(this._clockOff - use) < CLOCK_STEP) return;
    this._clockUse = Math.round(this._clockOff);
    this._rawM = null;
    this._clockMoved(this._clockUse - use);
  }

  // Kurz nach einem Neustart von HA? sun.sun entsteht dabei neu (sonst ändert es sich nur bei Auf- und
  // Untergang), alle Entities bekommen dann last_changed um dieselbe Zeit
  _haBoot(t) {
    const S = this._hass?.states || {};
    const b = Date.parse(S[this._cfg.sun_entity]?.last_changed);
    if (!(t >= b - 60000 && t - b <= 3 * 60000)) return false;
    // Wechselt sun.sun nur bei Sonnenauf- oder -untergang, ist das kein Neustart: Beim Neustart bekommen sehr viele
    // Entities dieselbe Zeit (nur selten aufgerufen: Bezugsende, Neuladen beim Haus-Boten)
    let same = 0;
    for (const k in S) if (Math.abs(Date.parse(S[k]?.last_changed) - b) < 3000 && ++same >= 6) return true;
    return false;
  }
}
