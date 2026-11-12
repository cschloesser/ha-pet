// Zustand und Uhr: Werte, Abbau, Speichern mit Echo-Abgleich, Balken, Uhr von HA, Neustart von HA erkennen

import { clamp } from '../logik/hilfen.js';
import {
  RATE, SLEEP_DECAY, CLOCK_KEEP, CLOCK_STEP, SELF_MAX, freshStats, serialize, parseStats,
} from '../logik/zustand.js';
import { CRIT_KINDS } from '../logik/besucher.js';
import { urlaubCut } from '../logik/urlaub.js';

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
      const id = this._cfg.entity;
      const st = this._hass.states[id]?.state;
      // Getrennt oder Helfer gerade nicht erreichbar: nicht ins Leere senden (es käme nie ein Echo). Bleibt
      // ungesendet und geht beim nächsten verbundenen hass bzw. zusammengeführt mit dem wiederkehrenden Stand hinaus.
      // ("unknown" ist ein frisch angelegter, leerer Helfer: _synced kommt dort erst nach 20 s, dann beschreiben)
      if (this._hass.connected === false || st === 'unavailable') {
        this._saveWait = true;
        return;
      }
      // Derselbe Wert ändert in HA nichts (es käme kein Echo): nicht senden
      if (st !== v) {
        const e = { v, gain: this._gain, at: Date.now(), n: this._hassN };
        this._sent.push(e);
        if (this._sent.length > 8) this._sent.shift();
        this._hass
          .callService('input_text', 'set_value', { entity_id: id, value: v })
          .catch((err) => {
            console.warn('pika-pet-card: Speichern fehlgeschlagen, neuer Versuch', err);
            // mit wachsender Pause (5 s, 10 s … höchstens 5 Min): lehnt HA den Wert ab, nicht alle paar Sekunden
            this._saveFail = (this._saveFail || 0) + 1;
            e.failed = true; // die Pause hier gilt, _sentCheck wertet es nicht vorher schon als verloren
            setTimeout(() => this._sentLost(e), Math.min(5000 * 2 ** (this._saveFail - 1), 3e5));
          });
        this._sentCheck(e, 15000);
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
    this._pendingWrite = false;
  }

  // Kein Echo nach ms: Steht der Wert doch in HA, gilt er als angekommen. Verloren ist er erst, wenn seit dem Senden
  // ein frischer, verbundener Stand von HA kam (sonst bekommt die Karte gerade gar nichts mit, z. B. in einer
  // abgehängten Ansicht, und sendete endlos denselben Wert): dann neu senden, sonst später wieder schauen.
  _sentCheck(e, ms) {
    setTimeout(() => {
      if (!this._sent.includes(e) || e.failed) return;
      if (this._hass?.states[this._cfg.entity]?.state === e.v) return void this._sent.splice(this._sent.indexOf(e), 1);
      if (this._hassN === e.n || this._hass?.connected === false) return this._sentCheck(e, Math.min(ms * 2, 3e5));
      this._sentLost(e);
    }, ms);
  }

  _lsKey() {
    return `pika-pet-card:${this._cfg.name}`;
  }

  // Im Editor umbenannt: Der Name steckt in den Schlüsseln, unter denen ohne Helfer Zustand, Tagesplan (Vorrat, Serie,
  // Album) und „Päckchen-Knopf schon gesehen“ im Browser liegen (und mit Chronik, für welchen Tag sie schon geprüft
  // ist). Den Stand unter den neuen Namen mitnehmen, sonst finge er von vorn an. Kopiert, nicht verschoben: Bricht
  // man das Bearbeiten ab, gilt der alte Name weiter. Der Editor ruft setConfig bei jedem Tastendruck, Zwischenstände
  // („Pik“, „Pi“ …) werden darum wieder entfernt.
  _lsRename(from, to) {
    if (from == null || to == null || from === to) return;
    try {
      const mine = (this._lsCopies ??= new Set());
      for (const p of ['pika-pet-card', 'pika-pet-plan', 'pika-pet-gift', 'pika-pet-diary', 'pika-pet-diary-seen', 'pika-pet-chronik']) {
        const v = localStorage.getItem(`${p}:${from}`);
        if (v != null && localStorage.getItem(`${p}:${to}`) == null) {
          localStorage.setItem(`${p}:${to}`, v);
          mine.add(`${p}:${to}`);
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
