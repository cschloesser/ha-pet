// Beschäftigungen: Auswahl aus dem Tagesplan, Fenster, Einstieg, Warten nach Planzeit, Requisit hervorkramen,
// Begrüßung, Tagesform

import { rnd, pick, clamp, hasKey, seedRnd, weightedR } from '../logik/hilfen.js';
import { wxProgThen } from '../logik/wetter.js';
import {
  ACT_WIN, ACT_GAP, ACT_WALK, ACT_LEN, ACT_JOIN_END, ACT_NOJOIN, bigStart, miniStart, miniHas, localDay, ACT_SMALL,
  ACT_BIG, ACT_MOOD, walkSpeed, jumpInOk, ACT_RECENT, ACT_SHOW_COOL, ACT_GREET, SPORT_WIN, KRAM,
} from '../logik/beschaeftigungen.js';
import { MINI_W, miniProg, miniOk, miniChain } from '../logik/beschaeftigungen-klein.js';

export class Beschaeftigungen {
  // Die Beschäftigungen selbst stehen in beschaeftigungen-gross.js und beschaeftigungen-klein.js, _slotNow wählt aus
  // dem Tagesplan. Alle holen sich ihr Fenster mit _slotFor(name): { k, start, end, r(n) }. end ist das Ende des
  // Hauptteils (Planzeit, _planNow), r(n) sind feste Zahlen des Fensters, auf allen Geräten gleich.

  // Zum Platz der Beschäftigung: frisch gestartet (Neuladen, Seite wieder sichtbar) und schon spät dran steht er
  // gleich dort, sonst läuft er hin. Aus dem Bau kommt er vorher heraus.
  async _goSpot(S, x, speed = 0.8) {
    if (this._jumpIn(S)) {
      this._inside = false;
      this._lift = 0;
      this._pose('out', 0);
      this._setX(x, true);
      await this._wait(60);
      return;
    }
    if (this._inside) await this._comeOut();
    // Tempo aus der Strecke: Der Hauptteil beginnt ACT_WALK nach dem Fensterbeginn. Mit festem Tempo käme er auf
    // breiten Karten Sekunden zu spät (walkSpeed). Ist die Zeit schon um (Wiedereinstieg), geht er kurze Wege im
    // Grundtempo und eilt nur für weite, ohne große Hopser.
    await this._walkTo(x, walkSpeed(Math.abs(x - this._x), this._g.pW, S.start + ACT_WALK - this._planNow(), speed));
  }

  // Steigt er in ein schon laufendes Fenster ein, ohne dass man ihn vorher sah? Nur dann steht er gleich am Platz;
  // hat man ihn schon woanders gesehen (er wartete auf den frischen Stand, wachte eben auf), hoppelt er hin.
  _jumpIn(S) {
    return S.k >= 0 && jumpInOk(this._planNow() - S.start, this._sinceBlind(), this._blindFirst);
  }

  // ms, seit die Karte (wieder) zu sehen ist: gesetzt beim ersten Aufbau, beim Sichtbarwerden und beim Wiedereinhängen
  _sinceBlind() {
    return Date.now() - (this._blindAt || 0);
  }

  // Bis zur Planzeit t warten (gleich weiter, wenn sie vorbei ist)
  _at(t) {
    return this._wait(Math.max(0, t - this._planNow()));
  }

  // Höchstens ms warten, aber nicht über die Planzeit t hinaus
  _waitMax(ms, t) {
    return this._wait(clamp(t - this._planNow(), 0, ms));
  }

  // Platz auf der Wiese zwischen Heu und Stein aus der festen Zahl u: relativ zur Breite überall dieselbe Stelle
  _hobbySpot(u) {
    const { fMin, fMax } = this._g;
    return (fMin + u * (fMax - fMin)) * this._W;
  }

  // Drachenwetter: mäßiger bis frischer Wind, trocken, hell
  _kiteWind() {
    const e = this._dbgElev ?? this._elev;
    const w = this._wind || 0;
    return w >= 20 && w < 65 && !this._wx.wet && !this._wx.storm && (e == null || e > 3);
  }

  // Requisit hervorkramen: Die Klassen cls zeigen es (z. B. 'reading' das Buch), dazu kurz .kram: Es kommt in
  // KRAM.in ms aus dem Fell, leicht überschwingend (Stil: kram, PROP_SEL). Für alle Beschäftigungen dasselbe.
  _propOn(...cls) {
    const p = this._el.pika;
    p.classList.remove('stow');
    p.classList.add(...cls, 'kram');
    clearTimeout(this._kramT);
    this._kramT = setTimeout(() => p.classList.remove('kram'), KRAM.in + 60);
  }

  // Requisit wegräumen: erst zurück ins Fell (KRAM.out ms, Stil: kramweg), dann die Klassen cls weg. Wird die
  // Aktion dabei abgebrochen, sind sie sofort weg (wie beim Aufräumen in _cleanup).
  async _propOff(...cls) {
    const p = this._el.pika;
    if (!cls.some((c) => p.classList.contains(c))) return;
    clearTimeout(this._kramT);
    p.classList.remove('kram');
    p.classList.add('stow');
    try {
      await this._wait(KRAM.out);
    } finally {
      p.classList.remove('stow', ...cls);
    }
  }

  // Schaut jemand hin? Unsichtbar läuft die Schleife ohnehin nicht; mit screen_entity zählt auch der Bildschirm.
  _watched() {
    return !this._away();
  }

  // Die Karte wird sichtbar (Bildschirm an, App geöffnet, Ansicht gewechselt): Begrüßung anmelden. Schläft er,
  // blinzelt er nur. Ist er mitten in einer Beschäftigung, ruft er nur kurz „Hallo!“ und macht weiter.
  _showReq() {
    if (!this._el) return;
    const now = Date.now();
    if (now - (this._showAt || 0) < ACT_SHOW_COOL) {
      // Er ist wieder zu sehen: Die Abwesenheit endet auch ohne Gruß, sonst zählte sie beim nächsten Mal mit
      this._goneAt = null;
      return;
    }
    this._showAt = now;
    // Über 3 Stunden nicht zu sehen (Tab im Hintergrund, Bildschirm aus): großes Wiedersehen
    this._reunion = !!this._goneAt && now - this._goneAt > 3 * 36e5;
    this._goneAt = null;
    // Es zählt, ob jetzt Schlafenszeit ist: _asleep ist nach einer Pause veraltet (Bildschirm nachts aus, morgens an).
    // Dann wacht er gleich auf (_step), und die Begrüßung bzw. das Wiedersehen kommt danach.
    if (this._g ? this._sleepTime() : this._asleep) return this._asleep ? this._sleepyHello() : undefined;
    this._greetDue = true;
    const a = this._action;
    if (!this._running || !a) return; // die Schleife startet gleich und begrüßt zuerst
    if (['idle', 'look', 'wander', 'groom', 'squeak', 'sniff', 'binky', 'hungry', 'lookout', 'burrow', 'shelter', 'hideout',
      'curious', 'yawn', 'earClean', 'scratch', 'nod'].includes(a)) {
      this._interrupt();
    } else {
      this._greetDue = false;
      const big = this._reunion;
      this._reunion = false;
      setTimeout(() => this._action && !this._asleep && (this._say(pick(ACT_GREET), 1500), this._hearts(big ? 3 : 1)), 500);
    }
  }

  _sleepyHello() {
    const p = this._el.pika;
    setTimeout(() => {
      if (!this._asleep) return;
      p.classList.add('peek');
      this._say(pick(['mh…?', '*gähn*', 'zzz… hallo']), 1700);
      clearTimeout(this._peekT);
      this._peekT = setTimeout(() => p.classList.remove('peek'), 2200);
    }, 700);
  }

  // Winkt mit einer Pfote. Eine Beschäftigung startet er danach nicht: die kommen nur aus dem Tagesplan.
  async _greet() {
    const p = this._el.pika;
    if (this._reunion) {
      this._reunion = false;
      return this._reunite();
    }
    if (this._inside) {
      this._pose('peek', 400);
      await this._wait(500);
      this._say(pick(ACT_GREET), 1500, true);
      await this._wait(1800);
      return;
    }
    p.classList.add('waving');
    this._say(pick(ACT_GREET), 1700, true);
    await this._wait(rnd(1500, 2100));
    p.classList.remove('waving');
    if (Math.random() < 0.5) this._jump('binky');
    else this._happy(1000);
    await this._wait(1000);
  }

  // ---------- Tagesplan: Auswahl ----------

  // Uhr des Tagesplans (Vorschau: um _dbgPlanMs vorgestellt)
  _planNow() {
    return this._haNow() + (this._dbgPlanMs || 0);
  }

  // Fenster der Beschäftigung name, die gerade aus dem Plan läuft. Aus der Vorschau erzwungen: eins ab jetzt.
  _slotFor(name) {
    if (this._slot?.act === name) return this._slot;
    const start = this._planNow();
    const r = (n) => seedRnd('frei', start, n);
    return { id: null, kind: 'frei', k: -1, act: name, start, end: start + ACT_WALK + ACT_LEN[name](r), r };
  }

  // Läuft jetzt eine Beschäftigung aus dem Plan, die dieses Gerät noch nicht gezeigt hat? Groß vor klein.
  _slotNow() {
    // Mit Helfer erst, wenn sein Stand da ist: sonst wählte ein frisch geladenes Gerät ohne den Verlauf
    if (!this._g || this._asleep || !this._watched() || !this._plan || !this._planOk || this._planStale) return null;
    this._slotsDone ??= new Set();
    const now = this._planNow();
    for (const S of [this._bigAt(now), this._miniAt(now)]) {
      if (!S || this._slotsDone.has(S.id)) continue;
      if (now > S.end - ACT_JOIN_END || (ACT_NOJOIN.has(S.act) && now - S.start > 4000)) continue;
      if (!this._actOk(S.act)) continue;
      if (S.kind === 'mini' && now - S.start > 4000 && !this._progSince(S)) continue;
      return S;
    }
    return null;
  }

  _runSlot(S) {
    this._slot = S;
    if (S.kind === 'big') {
      this._planOp({ t: 'rec', k: S.k, a: S.act });
      if (S.act === 'sport') this._planOp({ t: 'sport', d: localDay(S.start), k: S.k });
    }
    return this._run(S.act).then(() => {
      this._slotsDone.add(S.id);
      if (this._slotsDone.size > 20) this._slotsDone.delete(this._slotsDone.values().next().value);
    });
  }

  // Große Beschäftigung, die im Fenster von now begonnen hat (oder null)
  _bigAt(now) {
    const k = Math.floor(now / ACT_WIN.big);
    const start = bigStart(k);
    if (now < start) return null;
    const act = this._bigAct(k, start);
    if (!act) return null;
    const r = (n) => seedRnd('big', k, n);
    return { id: `b${k}`, kind: 'big', k, act, start, end: start + ACT_WALK + ACT_LEN[act](r), r };
  }

  // Welche große im Fenster k? Steht sie schon im Plan (ein Gerät hat sie begonnen), die; sonst ausgewürfelt.
  _bigAct(k, start) {
    const rec = this._plan.rec;
    const own = rec.find((e) => e[0] === k);
    if (own) return hasKey(ACT_LEN, own[1]) ? own[1] : null;
    if (this._sportSlot(k, start)) return 'sport';
    const recent = rec.filter((e) => e[0] < k).slice(0, ACT_RECENT).map((e) => e[1]);
    const tf = this._tagesform(start);
    const w = this._bigW(new Date(start).getHours());
    const ok = ACT_BIG.filter((a) => a !== 'sport' && w[a] > 0);
    // Bleibt nach der Sperre nichts übrig (Regen: nur Fernsehen), dann doch eine der letzten statt gar keiner
    const fresh = ok.filter((a) => !recent.includes(a));
    const list = (fresh.length ? fresh : ok).map((a) => [w[a] * (tf.fav.includes(a) ? 2 : tf.meh === a ? 0.2 : 1), a]);
    return weightedR(list, seedRnd('big', k, 99));
  }

  // Gewichte der großen nach Wetter, Licht und Stunde h (des Fensterbeginns)
  _bigW(h) {
    const wx = this._wx;
    const elev = this._dbgElev ?? this._elev;
    const dry = !wx.wet && !wx.storm && !wx.shelter;
    const light = elev == null ? !this._asleep : elev > 3;
    return {
      read: dry ? 1.2 * (h >= 13 && h < 17 ? 1.5 : 1) : 0,
      game: dry ? 1 : 0,
      tablet: dry && !wx.snowcover ? 0.9 : 0,
      kite: this._kiteWind() ? 3 : 0,
      tv: wx.wet ? 3 : elev != null && elev < 4 ? 1 : 0,
      music: dry ? 1.1 * (h >= 17 ? 1.5 : 1) : 0,
      paint: dry && light ? 1.1 * (h >= 10 && h < 16 ? 1.4 : 1) : 0,
      bubbles: dry && light && !wx.snowcover && (this._wind || 0) < 30 ? 1 : 0,
    };
  }

  // Geht die Beschäftigung bei diesem Wetter? Großzügiger als die Auswahl, damit ein später einsteigendes Gerät
  // nicht wegen eines Grads Sonnenhöhe etwas anderes macht: nur Regen, Sturm, Wind und Schnee zählen.
  _actOk(act) {
    const wx = this._wx;
    if (act === 'tv') return true;
    // Blumenkranz: nicht, wenn auf dem Kopf schon ein Festtagshut sitzt. Der Hut hängt an der Konfiguration dieser
    // Karte (festive, birthdays) und gehört deshalb nicht in die Auswahl: Auf einem Gerät mit Hut fällt der Kranz
    // aus, auf allen Geräten bleiben die Fenster davor und danach dieselben.
    const f = this._fest || {};
    if (act === 'crown' && (f.xmas || f.birthday || f.witch || f.karneval)) return false;
    // die kleinen (auch die für Regen und Schnee) nach derselben Regel wie bei der Auswahl
    if (hasKey(MINI_W, act)) return miniOk(act, this._lage());
    if (wx.shelter || wx.wet) return false;
    if (act === 'kite') return this._kiteWind();
    if (act === 'bubbles') return (this._wind || 0) < 40 && !wx.snowcover;
    return !wx.storm;
  }

  // Kleine Beschäftigung im Fenster von now (oder null): nicht in jedem Fenster und nie dicht an einer großen
  _miniAt(now) {
    const m = Math.floor(now / ACT_WIN.mini);
    if (!miniHas(m)) return null;
    const start = miniStart(m);
    if (now < start || this._nearBig(start)) return null;
    const act = this._miniAct(m);
    if (!act) return null;
    const r = (n) => seedRnd('mini', m, 10 + n);
    return { id: `m${m}`, kind: 'mini', k: m, act, start, end: start + ACT_WALK + ACT_LEN[act](r), r };
  }

  _nearBig(t) {
    const k = Math.floor(t / ACT_WIN.big);
    return [k - 1, k, k + 1].some((j) => t > bigStart(j) - ACT_GAP[0] && t < bigStart(j) + ACT_GAP[1]);
  }

  // Welche kleine im Fenster m? Aus dem Programm des Wetters (MINI_PROG, MINI_W), in der Regel nicht zweimal
  // dieselbe hintereinander (miniChain). Bei Regen Pfütze oder Schiffchen, bei Schnee oft der Schnee-Pika.
  // Feste Zahlen des Fensters: 2 und 3 für die Grundwahl, 4 bis 9 für den Ersatz (0 und 1: miniHas, miniStart;
  // ab 10: der Ablauf, S.r).
  _miniAct(m) {
    return miniChain(m, this._lage(), (j) => miniHas(j) && !this._nearBig(miniStart(j)), (j) => seedRnd('mini', j, 2), (j) => seedRnd('mini', j, 3),
      (j, k) => seedRnd('mini', j, 4 + k));
  }

  // Galt das Programm von jetzt (trocken, Regen, Schnee) schon, als das Fenster S begann? Nur dann steigt ein
  // Gerät später noch in Pfütze, Schiffchen oder Schnee-Pika ein. Schlug das Wetter erst im Fenster um, haben die
  // anderen dort schon etwas anderes gezeigt (oder nichts): Ein frisch geladenes Gerät begänne sonst allein. Aus
  // dem Wetterverlauf (wxProgThen); ist er unbekannt oder das Wetter aus der Vorschau gesetzt, gilt: ja. Beginnt
  // der Verlauf erst im Fenster (frisch geladen, die Lage von jetzt ist jünger als das Fenster): nein.
  _progSince(S) {
    if (this._dbgWeather || this._dbgSnow != null) return true;
    const then = wxProgThen(this._wxLog, S.start - (this._dbgPlanMs || 0));
    return then == null || then === (miniProg(this._lage()) || 'none');
  }

  // Beim Beginn der nächsten Beschäftigung (groß oder klein) die laufende Kleinigkeit abbrechen, damit alle
  // Geräte gleichzeitig anfangen
  _slotArm() {
    const now = this._planNow();
    const kb = Math.floor(now / ACT_WIN.big);
    const km = Math.floor(now / ACT_WIN.mini);
    const next = Math.min(...[bigStart(kb), bigStart(kb + 1), ...[km, km + 1].filter(miniHas).map(miniStart)]
      .filter((t) => t > now));
    if (next === this._slotNext && this._slotT) return;
    this._slotNext = next;
    clearTimeout(this._slotT);
    this._slotT = setTimeout(() => {
      this._slotT = null;
      if (this._running && ACT_SMALL.includes(this._action) && this._slotNow()) this._interrupt();
      if (this._running) this._slotArm();
    }, clamp(next - now + 50, 50, 2 ** 31 - 1));
  }

  // Tagesform: aus dem Kalendertag gewürfelt, auf allen Geräten gleich
  _tagesform(t = this._haNow()) {
    const day = localDay(t);
    if (this._tf?.day === day) return this._tf;
    const pool = [...ACT_MOOD];
    const take = (n) => pool.splice(Math.floor(seedRnd('tag', day, n) * pool.length), 1)[0];
    this._tf = { day, fav: [take(0), take(1)], meh: take(2) };
    return this._tf;
  }

  // Frühsport im Fenster k (Beginn start)? 10–180 Minuten nach dem Aufwachen, trocken, heute noch nicht – oder
  // genau in diesem Fenster begonnen. Der Tag steht im Tagesplan, so turnt er auch nach dem Neuladen nur einmal.
  _sportSlot(k, start) {
    const sp = this._plan.sport;
    if (sp && sp.d === localDay(start)) return sp.k === k;
    const wx = this._wx;
    if (wx.wet || wx.storm || wx.shelter) return false;
    // Minuten seit dem Aufwachen, aus demselben Wachfenster wie die Schlafenszeit
    const w = this._wakeWins(start, start).find(([ws, we]) => start >= ws && start < we);
    const since = w ? (start - w[0]) / 6e4 : -1;
    return since >= SPORT_WIN[0] && since <= SPORT_WIN[1];
  }

  // Die nächsten Beschäftigungen aus dem Plan (Vorschau): [{ start, act, kind }]
  _planPeek(n = 6) {
    const out = [];
    let t = this._planNow();
    for (let i = 0; out.length < n && i < 400; i++, t += 30000) {
      for (const S of [this._bigAt(t), this._miniAt(t)]) {
        if (S && !out.some((o) => o.id === S.id) && S.end > this._planNow()) out.push(S);
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }
}
