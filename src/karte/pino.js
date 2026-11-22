// Pino: Besuchsplan, Kommen und Gehen, eigenes Leben, gemeinsame Spiele

import { Cancel, rnd, pick, clamp, pause, weighted, seedRnd } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { SELF } from '../logik/zustand.js';
import { LANE_DY, LANE_S } from '../logik/einstellungen.js';
import { buehneZ } from '../logik/buehne.js';
import {
  FRIEND_SCALE, FRIENDS, FRIEND_KEYS, friendKind, FRIEND_WIN, FRIEND_LAST, FRIEND_GAME, FRIEND_GAME_W, FRIEND_ACTS, FRIEND_YIELD, FRIEND_CLS,
} from '../logik/besucher.js';
import { HOP_MS, hopRound, jumpBusy, chaseFar } from '../logik/beschaeftigungen.js';
import { PURZEL_ROLL } from '../logik/beschaeftigungen-klein.js';
import { MEM_BITS, pikaDay } from '../logik/tagesplan.js';
import { ICON_HEART } from '../grafik/szene.js';
import { FRIEND_SVG } from '../grafik/besucher.js';
import { KIRBY_SVG, RUFUS_SVG, KATZUMI_SVG, FRIEND_TOY, TOY_S } from '../grafik/freunde.js';

const FRIEND_ART = { pino: FRIEND_SVG, kirby: KIRBY_SVG, rufus: RUFUS_SVG, katzumi: KATZUMI_SVG };

export class Pino {
  // Pino, ein Freund-Pika, kommt ein paarmal am Tag zu Besuch. Er lebt in der Ebene .friends hinter dem Pika
  // und hat einen eigenen Ablauf (_friendVisit: hereinhoppeln, Eigenleben, verabschieden, hinaus). Die
  // gemeinsamen Spiele sind Aktionen des Pikas (_friendActs); solange eine läuft (fr.busy), steuert sie Pino.
  // Wann er kommt, wie lange er bleibt und von welcher Seite, entscheidet allein _friendSchedule().

  _hassFriend(hass) {
    this._friendCheck();
  }

  _attachFriend() {
    this._loop(() => this._frBlink(), 2400, 6500);
    this._loop(() => this._frTwitch(), 4500, 12000);
    this._friendPlan();
  }

  _detachFriend() {
    this._friendStop();
  }

  // Tab unsichtbar: Pino ist sofort weg (wie die Besucher), danach wird neu geplant
  _hiddenFriend(hidden) {
    if (hidden) this._friendStop();
    else this._friendPlan();
  }

  _layoutFriend(first) {
    const g = this._g;
    if (!g) return;
    const s = this._el.friends.style;
    s.setProperty('--ph', `${g.pH * this._frSc()}px`);
    s.setProperty('--pw', `${g.pW * this._frSc()}px`);
    const ratio = this._frLW ? this._W / this._frLW : 1;
    this._frLW = this._W;
    const fr = this._fr;
    if (!fr) return;
    // Beim Herein- und Hinaushoppeln (oder neuem Areal) verschwindet er lieber und kommt später wieder
    if (first || !fr.arrived || fr.leaving) {
      this._friendGone(fr);
      this._friendPlan();
      return;
    }
    // Sonst wie der Pika an dieselbe Stelle der Wiese; ein gemeinsames Spiel fängt neu an
    if (fr.busy) this._interrupt();
    this._frTake(fr);
    this._friendSettle(fr);
    fr.lift = 0;
    fr.mv = null;
    // Auf der hinteren Spur bleibt er dort (ihr Bereich ist ein anderer), ohne depth gibt es sie nicht mehr
    if (!this._cfg.depth) fr.lane = 0;
    const [lo, hi] = fr.lane ? this._laneRange(g.pW * this._frSc()) : this._frRange();
    this._frSetX(fr, clamp(fr.x * ratio, lo, hi));
  }

  _tickFriend() {
    this._friendCheck();
  }

  // Begrüßen und Verabschieden dauern nur Sekunden und gehen sogar der Beschäftigung aus dem Tagesplan vor;
  // sonst verpasste er Pino, solange er liest oder malt (der Abschied gilt nur 15 s)
  _friendUrgent() {
    const bye = this._frBye;
    if (bye && !bye.done && Date.now() < bye.until) return 'byeFriend';
    const fr = this._fr;
    return fr && fr.arrived && !fr.leaving && !fr.greeted ? 'greetFriend' : null;
  }

  _friendActs(ctx) {
    const bye = this._frBye;
    if (bye && !bye.done && Date.now() < bye.until) return [[80, 'byeFriend']];
    const fr = this._fr;
    if (!fr || !fr.arrived || fr.leaving) return [];
    if (!fr.greeted) return [[80, 'greetFriend']];
    // In den letzten 25 s des Besuchs kein neues Spiel mehr: Pino geht pünktlich nach der Uhr (untilT in
    // _friendUntil), ein eben begonnenes Spiel risse sonst gleich wieder ab. Die meisten sind in der Zeit vorbei;
    // ein längeres (Zusammensitzen, Fangen auf breiten Karten) bricht der Abschied trotzdem ab.
    if (Date.now() >= fr.until - FRIEND_LAST) return [];
    // Zusammen zählen sie etwas mehr als alles andere, und die Spiele dauern länger: so verbringt
    // der Pika die meiste Zeit mit Pino, macht aber auch mal Eigenes
    const wet = ctx.wx.wet;
    // Das eigene Spiel des Gasts (FRIEND_GAME: Rufus holt das Stöckchen, Katzumi jagt, Kirby kullert) gibt es nur,
    // solange genau er da ist. Beim ersten Mal im Besuch wiegt es am meisten, danach wie ein gemeinsames; direkt
    // nach sich selbst kommt es nie (fr.last: das letzte Spiel der beiden, _withFriend).
    const game = FRIEND_GAME[fr.kind];
    const gw = !game || fr.last === game ? 0 : fr.sig ? FRIEND_GAME_W.again : FRIEND_GAME_W.first;
    return [
      [wet ? 1 : 7, 'chaseFriend'],
      [6, 'sitWithFriend'],
      [wet ? 1 : 4, 'rockWithFriend'],
      [ctx.hasFlowers ? (ctx.s < 50 ? 5 : 3.5) : 0, 'nibbleWithFriend'],
      [3.5, 'squeakDuet'],
      ...(game ? [[wet ? Math.min(1, gw) : gw, game]] : []),
    ];
  }

  // Der Pika wird gestreichelt: Pino kommt neugierig näher und schaut zu
  _petFriend() {
    const fr = this._fr;
    if (!fr || !fr.arrived || fr.leaving || this._asleep) return;
    if (fr.busy) {
      this._frFace(fr, this._liveX() >= fr.x ? 1 : -1);
      this._frLook(fr, 'look-f', 1500);
      return;
    }
    fr.want = 'curious';
    this._frTake(fr);
  }

  // ---------- Besuchsplan ----------

  // Die EINZIGE Stelle, die entscheidet, wann Pino kommt, wie lange er bleibt und von welcher Seite.
  // Liefert den nächsten Besuch, der noch nicht vorbei ist: nextInMs bis zur Ankunft (0, wenn er gerade
  // fällig ist), stayMs Dauer ab Ankunft (bei einem laufenden Besuch: was davon noch übrig ist), side -1 von
  // links, 1 von rechts. Aus der Uhrzeit berechnet (FRIEND_WIN, seedRnd), darum auf allen Geräten gleich.
  // Ob er wirklich kommt (Pika wach, Tag, trocken), prüft _friendDue; passt es gerade nicht, kommt er später
  // im selben Fenster. Ein Besuch, der mit Abschied endete, wird nicht wiederholt (_frUsed).
  _friendSchedule() {
    const now = this._visitNow();
    const { win, p, spread, stay: [s0, s1] } = FRIEND_WIN;
    // ein Besuch endet in seinem Fenster (spread + Dauer < win), das vorige Fenster prüfen schadet nicht
    for (let k = Math.floor(now / win) - 1; ; k++) {
      const r = (n) => seedRnd('friend', k, n);
      if (r(0) >= p) continue;
      const at = k * win + Math.floor(r(1) * spread);
      const end = at + Math.round((s0 + r(2) * (s1 - s0)) * 6e4);
      if (now >= end) continue;
      const start = Math.max(now, at);
      return { nextInMs: start - now, stayMs: end - start, side: r(3) < 0.5 ? -1 : 1, kind: friendKind(r(4)) };
    }
  }

  _friendOn() {
    return !!this._cfg?.friend && !!this._attached && !this._away();
  }

  // Nächsten Besuch einplanen. Einer, der schon mit Abschied endete, zählt nicht noch einmal:
  // dann erst nach seinem Ende wieder nachfragen.
  _friendPlan() {
    clearTimeout(this._frT);
    this._frT = null;
    if (!this._friendOn() || this._fr) return;
    const now = this._visitNow();
    const s = this._friendSchedule();
    const end = now + s.nextInMs + s.stayMs;
    if (end <= (this._frUsed || 0) + 500) this._frT = setTimeout(() => this._friendPlan(), this._frUsed - now + 1000);
    else this._frT = setTimeout(() => this._friendDue(), s.nextInMs);
  }

  _friendDue() {
    this._frT = null;
    if (!this._friendOn() || this._fr) return;
    const s = this._friendSchedule();
    if (s.nextInMs > 1000) return this._friendPlan(); // Plan hat sich verschoben
    const end = this._visitNow() + s.nextInMs + s.stayMs;
    if (end <= (this._frUsed || 0) + 500) return this._friendPlan();
    // Für einen kurzen Rest lohnt sich das Hereinhoppeln nicht mehr: Fenster abhaken
    if (s.stayMs < 45000) {
      this._frUsed = end;
      return this._friendPlan();
    }
    if (this._g && !this._friendBad()) this._friendCome(s.side, s.stayMs);
    // Passt es gerade nicht (Pika wacht auf, kurzer Niesel, Tab war weg), in 20 s noch einmal: solange das
    // Fenster läuft, kommt er dann eben mitten darin
    else this._frT = setTimeout(() => this._friendDue(), 20000);
  }

  // Was gegen Besuch spricht (Bits): 1 Pika schläft oder geht schlafen, 2 Regen/Gewitter, 4 nicht Tag, 8 Urlaub (er ist
  // ja bei Pino)
  _friendBad() {
    const sleepy = this._asleep || this._sleepTime() || this._action === 'goSleep';
    const wx = this._wx;
    const e = this._dbgElev ?? this._elev;
    return (sleepy ? 1 : 0) | (wx.wet || wx.storm || wx.shelter ? 2 : 0) | ((e == null ? sleepy : e <= 3) ? 4 : 0)
      | (this._urlaubOn() || this._fort ? 8 : 0);
  }

  // Bei jedem hass-Update und alle 20 s: abgeschaltet? Plan da? Muss Pino gehen?
  _friendCheck() {
    if (!this._cfg || !this._el) return;
    if (!this._cfg.friend) {
      if (this._fr || this._frT) this._friendStop();
      return;
    }
    if (!this._fr && !this._frT) this._friendPlan();
    const fr = this._fr;
    if (!fr) return;
    fr.el.classList.toggle('cold', !!this._wx.cold);
    if (fr.leaving) return;
    // nur, was sich seit der Ankunft verschlechtert hat (Vorschau: erzwungener Besuch bei jedem Wetter)
    const bad = this._friendBad() & ~fr.bad0;
    if (bad) this._friendLeave(true, !!(bad & 1));
  }

  // Pino ist auf einem anderen Gerät vor der Zeit gegangen: hier geht er auch und kommt in dem Fenster nicht wieder
  _friendFromPlan() {
    const fu = this._plan?.fu || 0;
    if (!this._el || fu <= (this._frUsed || 0)) return;
    this._frUsed = fu;
    const fr = this._fr;
    if (fr && !fr.leaving && fu > this._visitNow()) this._friendLeave(true);
  }

  _friendStop() {
    clearTimeout(this._frT);
    this._frT = null;
    this._frBye = null; // sonst verabschiedete er sich später von einem Pino, der gar nicht mehr da ist
    if (this._fr) this._friendGone(this._fr);
  }

  _frName() {
    return String(this._cfg.friend_name || 'Pino');
  }

  // Name des Besuchers, mit dem der Pika ihn begrüßt und verabschiedet („Kirby!“, „tschüss, Kirby!“; sonst braucht
  // ihn niemand). _frWho setzt die Ankunft und bleibt über den Abschied hinaus stehen (er winkt ihm nach, wenn der
  // Freund schon weg ist). Pino heißt wie in friend_name, die anderen fest.
  _frGuest() {
    return this._frWho || this._frName();
  }

  // Größe des Freunds, der gerade da ist, gegenüber dem Pika
  _frSc(fr = this._fr) {
    return FRIENDS[fr?.kind]?.scale ?? FRIEND_SCALE;
  }

  // ---------- Besuch ----------

  // Pino (oder wer laut Plan dran ist, kind) kommt (force: sofort, bei jedem Wetter und jeder Tageszeit, für die Vorschau)
  _friendCome(side, stayMs, force = false, kind = null) {
    if (!this._g || this._fr || !this._cfg?.friend) return;
    if (side == null || stayMs == null || !kind) {
      const s = this._friendSchedule();
      kind ??= s.kind;
      side ??= s.side;
      stayMs ??= Math.max(s.stayMs, 9e4);
    }
    clearTimeout(this._frT);
    this._frT = null;
    this._frBye = null;
    const fr = this._friendBuild(FRIEND_ART[kind] ? kind : 'pino');
    fr.side = side < 0 ? -1 : 1;
    fr.planned = !force; // aus dem Besuchsplan: Das Ende folgt einer Uhrkorrektur (_clockMoved)
    fr.bad0 = force ? this._friendBad() : 0;
    this._fr = fr;
    // Der Besuch endet nach der Uhr (fr.until kommt aus dem Besuchsplan, also aus der Uhr von HA): Pino geht dann
    // auf allen Geräten im selben Augenblick, auch mitten in einem Spiel oder einem eigenen Schritt. Bisher wartete
    // sein Ablauf das Ende des Spiels ab (bis über 20 s), jedes Gerät verabschiedete ihn zu einer anderen Zeit.
    this._friendUntil(fr, Date.now() + stayMs);
    this._friendVisit(fr);
  }

  // Ende des Besuchs (Gerätezeit) setzen und den Wecker für den Abschied stellen
  _friendUntil(fr, until) {
    fr.until = until;
    clearTimeout(fr.untilT);
    fr.untilT = setTimeout(() => this._fr === fr && this._friendLeave(), Math.max(0, until - Date.now()));
  }

  _friendBuild(kind = 'pino') {
    this._frWho = FRIENDS[kind].name || this._frName();
    const el = document.createElement('div');
    el.className = `friend fr-${kind}`;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${this._frWho} streicheln`);
    el.innerHTML = '<div class="clipw"><div class="shadow"></div><div class="depth"><div class="flip"><div class="jump">'
      + `<div class="hop"><div class="br">${FRIEND_ART[kind]}</div></div></div></div></div></div>`;
    el.querySelectorAll('.book, .gb, .tab, .kpaw, .bk, .brolly, .cap, .cup, .cfoam, .rope, .band, .arms, .uke, .brush, .wand, .rgrip, .bar, .wpaw, .slg, .gspy, .gcan, .shades, .hoop, .yo, .pbl, .jug, .dchain, .dcrown, .pgl, .peb, .sboat').forEach((n) => n.remove());
    // Sprechblase in eigener Hülle in der Sprech-Ebene; sie läuft mit Pino mit (_frSetX, _frFace)
    const sw = document.createElement('div');
    sw.className = 'frsay';
    sw.innerHTML = '<div class="anchor"><div class="bubble say"></div></div>';
    const fr = {
      kind, el, sw, jump: el.querySelector('.jump'), say: sw.querySelector('.say'), mfood: el.querySelector('.mfood'),
      x: 0, dir: 1, lift: 0, lane: 0, tok: 0, arrived: false, greeted: false, leaving: false, hurry: false, busy: false, want: null,
    };
    fr.kickP = new Promise((r) => (fr.kick = r));
    el.addEventListener('click', (e) => (e.stopPropagation(), this._frPet(fr)));
    this._keyTap(el);
    el.classList.toggle('cold', !!this._wx.cold);
    this._frZ(fr);
    // Sprechblase, Schatten usw. skalieren über --ph/--pw mit seiner Größe
    const fs = this._el.friends.style;
    fs.setProperty('--ph', `${this._g.pH * this._frSc(fr)}px`);
    fs.setProperty('--pw', `${this._g.pW * this._frSc(fr)}px`);
    this._el.friends.append(el, sw);
    return fr;
  }

  // Ohne Abschied entfernen (Tab unsichtbar, Größenänderung, abgeschaltet, Ende des Besuchs)
  _friendGone(fr) {
    if (this._fr === fr) this._fr = null;
    this._frTake(fr); // wartende Schritte wecken, sie brechen dann ab
    for (const t of ['sayT', 'callT', 'jumpT', 'happyT', 'lookT', 'untilT', 'laneZT']) clearTimeout(fr[t]);
    fr.el.remove();
    fr.sw.remove();
    this._frToysAway(); // Stöckchen am Boden oder in der Luft: ohne ihn liegt nichts mehr herum
    if (FRIEND_ACTS.has(this._action)) this._interrupt();
  }

  // Pinos Ablauf: herein, eigene kleine Schleife (pausiert, solange ein gemeinsames Spiel läuft), hinaus
  async _friendVisit(fr) {
    try {
      try {
        await this._friendArrive(fr);
      } catch (e) {
        if (e !== FRIEND_YIELD) throw e;
      }
      fr.arrived = true;
      this._frNotice();
      while (!fr.leaving) {
        if (fr.busy) {
          await this._fw(fr, 400);
          continue;
        }
        if (Date.now() >= fr.until) {
          this._friendLeave();
          break;
        }
        const tok = fr.tok;
        try {
          await this._friendIdle(fr, (ms) => this._fw(fr, ms, tok));
        } catch (e) {
          if (e !== FRIEND_YIELD) throw e;
        }
        if (!fr.busy) this._friendSettle(fr);
        await this._fw(fr, rnd(150, 400));
      }
      // ein laufendes Spiel wird beim Gehen abgebrochen
      while (fr.busy) await this._fw(fr, 200);
      await this._friendExit(fr);
    } catch (e) {
      if (!(e instanceof Cancel) && e !== FRIEND_YIELD) console.warn('pika-pet-card:', e);
    } finally {
      if (this._fr === fr) {
        this._friendGone(fr);
        this._friendPlan();
      }
    }
  }

  // Vom Rand herein hoppeln, piepsen
  async _friendArrive(fr) {
    const W = this._W;
    const fW = this._g.pW * this._frSc();
    const [lo, hi] = this._frRange();
    const w = (ms) => this._fw(fr, ms, fr.tok);
    this._frFace(fr, -fr.side);
    this._frSetX(fr, fr.side < 0 ? -fW * 0.7 : W + fW * 0.7);
    const tx = clamp(W * (fr.side < 0 ? rnd(0.3, 0.42) : rnd(0.6, 0.75)), lo, hi);
    await this._friendWalkTo(fr, tx, 0.9, w, true);
    this._frFace(fr, this._x >= fr.x ? 1 : -1);
    fr.arrived = true;
    this._giftBell();
    this._frCall(fr, pick(['iiep!', 'mip!', 'iiiep!']));
    await w(800);
  }

  // Der Pika bemerkt ihn: aus Nebensächlichem herausholen, dann wählt _step die Begrüßung
  _frNotice() {
    if (this._asleep || this._inside || this._lift > 0) return;
    if (['idle', 'look', 'wander', 'groom', 'binky', 'sniff'].includes(this._action)) this._interrupt();
  }

  // Pino verabschiedet sich. now: gleich (Pika geht schlafen, Wetter schlägt um, Vorschau-Knopf).
  // sleep: der Pika geht schlafen und schaut ihm nicht nach.
  _friendLeave(now = false, sleep = false) {
    const fr = this._fr;
    if (!fr || fr.leaving) return;
    fr.leaving = true;
    fr.hurry = now;
    // nach dem Abschied kommt er in diesem Fenster nicht wieder (auch nicht nach Display aus/an)
    const s = this._friendSchedule();
    if (!s.nextInMs) {
      this._frUsed = Math.max(this._frUsed || 0, this._visitNow() + s.stayMs);
      // Vor der Zeit gegangen: gilt für alle Geräte (_friendFromPlan)
      if (now) this._planOp({ t: 'frgone', u: Math.ceil(this._frUsed / 1000) * 1000 });
    }
    this._frTake(fr);
    if (!sleep && !this._asleep) {
      this._frBye = { x: fr.x, until: Date.now() + 15000, done: false };
      if (FRIEND_ACTS.has(this._action) || ['idle', 'look', 'wander', 'groom'].includes(this._action)) this._interrupt();
    } else if (FRIEND_ACTS.has(this._action)) {
      this._interrupt();
    }
  }

  // "tschüss!", dann zum nächsten Rand hinaus
  async _friendExit(fr) {
    const w = (ms) => this._fw(fr, ms);
    this._friendSettle(fr);
    if (fr.lift > 0) await this._frHopDown(fr, w);
    const fW = this._g.pW * this._frSc();
    const out = fr.x < this._W / 2 ? -1 : 1;
    this._frFace(fr, this._liveX() >= fr.x ? 1 : -1);
    this._frSay(fr, 'tschüss!', 1600);
    if (!fr.hurry) this._frJump(fr, 'hop1');
    await w(fr.hurry ? 900 : 1500);
    if (this._frBye) this._frBye.x = out < 0 ? 0 : this._W;
    await this._friendWalkTo(fr, out < 0 ? -fW : this._W + fW, fr.hurry ? 1.8 : 1.1, w, true);
  }

  // Eigenleben, ein Schritt: hoppeln, umschauen, putzen, piepsen, zum Pika, sitzen
  async _friendIdle(fr, w) {
    const { pW } = this._g;
    const F = fr.el.classList;
    if (fr.lift > 0) return this._frHopDown(fr, w);
    const toPika = () => (this._x >= fr.x ? 1 : -1);
    if (fr.want === 'curious') {
      // der Pika wird gestreichelt: neugierig näher und zuschauen
      fr.want = null;
      const d = Math.abs(this._x - fr.x);
      if (d > pW * 1.3 || d < pW * 0.6) await this._friendWalkTo(fr, this._x - toPika() * pW * rnd(0.85, 1.1), 1.2, w);
      this._frFace(fr, toPika());
      F.add('look-f');
      if (Math.random() < 0.5) this._frSay(fr, pick(['mip?', '♥', 'oh!']), 1000);
      await w(rnd(1500, 2500));
      F.remove('look-f');
      return;
    }
    const far = Math.abs(this._x - fr.x) > this._W * 0.35;
    // Vorschau: _frLaneNext (0/1) macht den nächsten Schritt zu einem Hoppeln auf diese Spur
    const act = this._frLaneNext != null ? 'hop' : weighted([
      [fr.greeted ? 3 : 0.5, 'hop'],
      [2, 'look'],
      [fr.greeted ? 1.5 : 0.4, 'groom'],
      [1, 'squeak'],
      [fr.greeted ? 0.5 : 0, 'binky'],
      [!fr.greeted || far ? 3 : 0.8, 'toPika'],
      [2, 'sit'],
    ]);
    if (act === 'hop') {
      // Tiefe: manchmal auf die hintere Spur, irgendwohin auf der ganzen Wiese hinter Heu und Stein (_laneRange);
      // bei Nässe nicht. Jeder andere Weg führt ihn wieder nach vorn (_friendWalkTo, Spur 0).
      const want = this._cfg.depth ? this._frLaneNext ?? (this._wx.wet ? 0 : Math.random() < 0.35 ? 1 : 0) : 0;
      this._frLaneNext = null;
      const [l, r] = want ? this._laneRange(pW * this._frSc()) : [0, 0];
      if (want && r - l > pW * 0.3) await this._friendWalkTo(fr, rnd(l, r), 0.9, w, false, 1);
      else await this._friendWalkTo(fr, fr.x + rnd(0.5, 1.5) * pW * pick([-1, 1]), 0.9, w);
      await w(rnd(300, 900));
    } else if (act === 'look') {
      const n = 1 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        const c = pick(['look-f', 'look-b', 'look-up']);
        F.add(c);
        await w(rnd(700, 1700));
        F.remove(c);
        await w(rnd(200, 600));
      }
    } else if (act === 'groom') {
      F.add('groom');
      await w(rnd(1500, 2800));
      F.remove('groom');
    } else if (act === 'squeak') {
      this._frCall(fr, pick(['mip!', 'iiep!', 'pip!']));
      await w(1300);
    } else if (act === 'binky') {
      this._frJump(fr, 'binky');
      await w(1100);
    } else if (act === 'toPika') {
      // Abstand halten, hinschauen
      await this._friendWalkTo(fr, this._x - toPika() * pW * rnd(0.9, 1.4), 1, w);
      this._frFace(fr, toPika());
      F.add('look-f');
      await w(rnd(1000, 2200));
      F.remove('look-f');
    } else {
      if (Math.random() < 0.5) this._frFace(fr, toPika());
      await w(rnd(1500, 4000));
    }
  }

  // Warten in Pinos eigenem Ablauf: endet früher, wenn ihm jemand die Kontrolle abnimmt (tok) oder er
  // gehen soll (FRIEND_YIELD); bricht ab (Cancel), wenn er verschwunden ist.
  async _fw(fr, ms, tok) {
    const check = () => {
      if (this._fr !== fr) throw new Cancel();
      if (tok != null && (tok !== fr.tok || fr.leaving)) throw FRIEND_YIELD;
    };
    check();
    await Promise.race([pause(ms), fr.kickP]);
    check();
  }

  // Kontrolle übernehmen: Pinos laufender eigener Schritt endet
  _frTake(fr) {
    fr.tok++;
    const k = fr.kick;
    fr.kickP = new Promise((r) => (fr.kick = r));
    k();
  }

  // Gemeinsames Spiel: Pino gehört solange der Aktion des Pikas. w(ms) wartet wie _wait und bricht ab,
  // wenn Pino weg ist oder gehen will. keepLane: Pino bleibt auf seiner Spur (Fangen wechselt sie selbst).
  async _withFriend(fn, keepLane = false) {
    let fr = this._fr;
    for (let i = 0; fr && !fr.arrived && i < 40; i++) {
      await this._wait(200);
      fr = this._fr;
    }
    if (!fr || !fr.arrived || fr.leaving) return;
    fr.busy = true;
    // Für die Wahl des nächsten Spiels (_friendActs): das letzte, und ob das eigene Spiel des Gasts schon dran war
    fr.last = this._action;
    if (this._action === FRIEND_GAME[fr.kind]) fr.sig = true;
    this._frTake(fr);
    this._friendSettle(fr);
    const w = async (ms) => {
      await this._wait(ms);
      if (this._fr !== fr || fr.leaving) throw new Cancel();
    };
    try {
      if (fr.lift > 0) await this._frHopDown(fr, w);
      // Gespielt wird vorn, wie jede Aktion des Pikas dort stattfindet: von der hinteren Spur an derselben Stelle
      // nach vorn (in den Bereich der vorderen, _frRange)
      else if (fr.lane && !keepLane) await this._friendWalkTo(fr, fr.x, 1, w);
      await fn(fr, w);
    } finally {
      this._el.pika.classList.remove('nuzzle', 'wiggle');
      // Spielzeug der eigenen Spiele (Stöckchen in der Luft oder am Boden) ist mit dem Spiel weg, auch bei Abbruch an
      // irgendeiner Wartestelle. Was der Pika im Maul trägt (carry) und seine Haltungen (crouch, sniff, purzel,
      // crosseye, lean) nimmt _cleanup; walking und purzel bleiben bis dahin stehen, daran friert es ihn ein.
      this._frToysAway();
      if (this._fr === fr) {
        fr.busy = false;
        this._friendSettle(fr);
      }
    }
  }

  // ---------- Pinos Bausteine ----------

  // Pinos Wiese: rechts vom Bau bis zum rechten Rand (in den Bau darf er nicht). Auf schmalen Karten auch
  // rechts vom Heu (volle Größe, halbe Breite H · 0,13), sonst verschwände er dahinter (.fore liegt vorn).
  // Die Nische gehört zum Bau und liegt hinten, vor ihr darf er stehen.
  _frRange() {
    const { pW, home, hay, stash } = this._g;
    const lo = Math.max(home + pW * 0.8, stash ? 0 : hay + this._H * 0.13 + pW * this._frSc() * 0.3);
    // Rechts wie beim Pika (xR) ganz im Bild bleiben
    return [lo, Math.max(lo, this._W - pW * this._frSc() * 0.45)];
  }

  // free: ohne Begrenzung auf die Wiese (herein- und hinaushoppeln). lane (Tiefe): 1 = hintere Spur, im Bereich
  // _laneRange; jeder Weg ohne lane führt auf die vordere zurück (wie beim Pika, _walkTo)
  async _friendWalkTo(fr, x, speed = 1, w, free = false, lane = 0) {
    const { pW } = this._g;
    lane = this._cfg.depth ? lane : 0;
    if (!free) {
      const [lo, hi] = lane ? this._laneRange(pW * this._frSc()) : this._frRange();
      x = clamp(x, lo, hi);
    }
    const dx = x - fr.x;
    const dl = lane !== (fr.lane || 0);
    if (Math.abs(dx) < 4 && !dl) return;
    if (Math.abs(dx) >= 4) this._frFace(fr, dx > 0 ? 1 : -1);
    // ganze Hopser wie beim Pika (_walkTo): Pino landet am Boden. Der Spurwechsel zählt wie ein kurzes Stück Weg.
    const dist = Math.max(Math.abs(dx), dl ? pW * 0.6 : 0);
    const dur = hopRound((dist / (pW * 0.85 * speed)) * 1000, HOP_MS.hop) / 1000;
    this._frSetX(fr, x, dur * 1000, 'linear', fr.lift, lane);
    fr.el.classList.add('walking');
    await w(dur * 1000);
    fr.el.classList.remove('walking');
  }

  async _frHop(fr, x, lift, w) {
    if (Math.abs(x - fr.x) > 2) this._frFace(fr, x > fr.x ? 1 : -1);
    fr.el.classList.add('crouch');
    await w(180);
    fr.el.classList.remove('crouch');
    // Gesprungen wird von der vorderen Spur und auf sie (wie der Pika, _hopTo)
    this._frSetX(fr, x, 550, 'cubic-bezier(.3, .6, .4, 1)', lift, 0);
    this._frJump(fr, 'hop1', true);
    await w(620);
  }

  async _frHopDown(fr, w) {
    const { rock, pW, gy } = this._g;
    const side = fr.x >= rock.cx && this._footX(1) ? 1 : -1;
    await this._frHop(fr, rock.cx + side * (rock.w / 2 + pW * 0.1), 0, w);
    this._puff(fr.x, gy, 2);
  }

  // Pino nach x (und Höhe lift, Spur lane) bewegen, ms = Dauer der Überblendung (0 = sofort). Die Bewegung wird
  // mitgeschrieben, damit _frLive weiß, wo er gerade ist – auch wenn der Browser gerade nichts zeichnet.
  _frSetX(fr, x, ms = 0, ease = 'linear', lift = fr.lift, lane = fr.lane) {
    const from = this._frLive(fr);
    const vor = fr.lane;
    fr.x = x;
    fr.lift = lift;
    fr.lane = lane;
    // Tiefe: auf der hinteren Spur höher und kleiner (Ursprung: die Füße, siehe STYLE_FRIEND), wie der Pika (_setX)
    const dy = this._frLaneDy(fr);
    const sc = dy ? LANE_S : 1;
    fr.mv = ms > 0 ? { ...from, x1: x, l1: lift, dy1: dy, t0: performance.now(), ms } : null;
    for (const s of [fr.el.style, fr.sw.style]) {
      s.transition = ms > 0 ? `transform ${Math.round(ms)}ms ${ease}` : 'none';
      s.transform = `translate(${(x - (this._g.pW * this._frSc()) / 2).toFixed(1)}px, ${(-lift - dy).toFixed(1)}px)`
        + (sc !== 1 ? ` scale(${sc.toFixed(3)})` : '');
    }
    fr.el.classList.toggle('lane1', !!dy);
    // auch an der Hülle der Sprechblase: Sie ist dort mit verkleinert, der Stil hält die Schrift trotzdem lesbar
    fr.sw.classList.toggle('lane1', !!dy);
    // Bühne: Ebene erst auf halbem Weg wechseln, bis dahin steht er noch auf der alten Spur (wie _walkTo)
    clearTimeout(fr.laneZT);
    if (ms > 0 && (lane || 0) !== (vor || 0)) {
      this._frZ(fr, vor);
      fr.laneZT = setTimeout(() => this._frZ(fr), ms / 2);
    } else this._frZ(fr);
    if (!(ms > 0)) void fr.el.offsetWidth;
    this._bubbleFit(fr.say, x, this._g.pW * this._frSc(), sc);
  }

  // Tiefe (depth): Höhe der hinteren Spur über der Bodenlinie für Pino (px), sonst 0. Auf dem Stein zählt die vordere.
  _frLaneDy(fr, lane = fr.lane) {
    return this._cfg.depth && lane && !(fr.lift > 0) ? this._H * LANE_DY : 0;
  }

  // Bühne: Pinos Ebene aus seinem Fußpunkt (lane: die Spur, sonst die jetzige). Auf dem Stein zählt die Spur, von
  // der er hochgesprungen ist, und das ist immer die vordere (_frHop). Auf derselben Spur steht der Pika vor ihm
  // (Rang), auf verschiedenen der auf der vorderen. Ohne depth immer BZ.pino.
  _frZ(fr, lane = fr.lane) {
    const hinten = this._cfg.depth && lane && !(fr.lift > 0) ? LANE_DY : 0;
    fr.el.style.zIndex = String(buehneZ(-hinten, 'pino'));
  }

  // Wo Pino gerade wirklich steht (beim Hoppeln ist fr.x schon das Ziel). dy: wie hoch ihn die Spur gerade hebt
  // (px, beim Spurwechsel dazwischen); lift zählt nur die Höhe auf dem Stein.
  _frLive(fr) {
    const m = fr.mv;
    if (!m) return { x: fr.x, lift: fr.lift, dy: this._frLaneDy(fr) };
    const k = clamp((performance.now() - m.t0) / m.ms, 0, 1);
    const dy0 = m.dy || 0;
    return { x: m.x + (m.x1 - m.x) * k, lift: m.lift + (m.l1 - m.lift) * k, dy: dy0 + ((m.dy1 || 0) - dy0) * k };
  }

  // Anhalten, wo er gerade ist, Haltungen zurücksetzen. Mitten im Spurwechsel bleibt er auf der Spur, der er schon
  // näher ist (wie der Pika, _freeze).
  _friendSettle(fr) {
    const live = this._frLive(fr);
    const lift = live.lift < 1 ? 0 : live.lift;
    const lane = this._cfg.depth && !(lift > 0) && live.dy > this._H * LANE_DY / 2 ? 1 : 0;
    this._frSetX(fr, live.x, 0, 'linear', lift, lane);
    fr.el.classList.remove(...FRIEND_CLS);
    // (item: was er im Maul trug, _frCarry; ohne .carry ist es ohnehin nicht zu sehen)
    fr.mfood?.classList.remove('shrink', 'item');
  }

  _frFace(fr, dir) {
    fr.dir = dir;
    fr.el.classList.toggle('left', dir < 0);
    fr.sw.classList.toggle('left', dir < 0);
    this._bubbleFit(fr.say, fr.x, this._g.pW * this._frSc(), this._frLaneDy(fr) ? LANE_S : 1);
  }

  // wie _jump: ein Sprung, der noch in der Luft ist, wird zu Ende gesprungen (fresh: _frHop trägt ihn woandershin)
  _frJump(fr, kind, fresh = false) {
    if (kind === 'binky' && calmMotion()) kind = 'hop1';
    const J = fr.jumpOn;
    if (!fresh && J && jumpBusy(J.kind, Date.now() - J.at)) return;
    fr.jumpOn = { kind, at: Date.now() };
    const j = [fr.jump, fr.el.querySelector('.shadow')];
    for (const el of j) el.classList.remove('hop1', 'binky');
    void j[0].offsetWidth;
    for (const el of j) el.classList.add(kind);
    clearTimeout(fr.jumpT);
    fr.jumpT = setTimeout(() => j.forEach((el) => el.classList.remove(kind)), 1000);
    this._earSwing(fr.el, kind);
  }

  _frSay(fr, text, ms = 1400) {
    fr.say.textContent = text;
    this._bubble(fr.say, true);
    clearTimeout(fr.sayT);
    fr.sayT = setTimeout(() => this._bubble(fr.say, false), ms);
  }

  // Piepsen: aufrichten, Maul auf, kleiner Hüpfer
  _frCall(fr, text) {
    const c = fr.el.classList;
    c.remove('calling');
    void fr.el.offsetWidth;
    c.add('calling');
    this._frSay(fr, text, 900);
    this._frJump(fr, 'hop1');
    clearTimeout(fr.callT);
    fr.callT = setTimeout(() => c.remove('calling'), 650);
  }

  _frLook(fr, c, ms) {
    fr.el.classList.add(c);
    clearTimeout(fr.lookT);
    fr.lookT = setTimeout(() => fr.el.classList.remove(c), ms);
  }

  _frHappy(fr, ms = 1200) {
    fr.el.classList.add('happy');
    clearTimeout(fr.happyT);
    fr.happyT = setTimeout(() => fr.el.classList.remove('happy'), ms);
    this._frHearts(fr, 3);
  }

  _frHearts(fr, n) {
    const { pW, pH, gy } = this._g;
    const fW = pW * this._frSc();
    const fH = pH * this._frSc();
    const live = this._frLive(fr);
    // Auf der hinteren Spur steht er höher und um LANE_S kleiner (um die Füße): der Kopf liegt entsprechend tiefer
    const s = live.dy ? 1 - (1 - LANE_S) * Math.min(1, live.dy / (this._H * LANE_DY)) : 1;
    const x = live.x + fr.dir * fW * 0.25 * s;
    const y = gy - fH * 0.945 * s + fH * 0.25 * s - live.lift - live.dy;
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.innerHTML = ICON_HEART;
      h.style.setProperty('--ph', `${fH}px`);
      h.style.left = `${x + rnd(-fW * 0.12, fW * 0.12)}px`;
      h.style.top = `${y}px`;
      h.style.setProperty('--dx', `${rnd(-fW * 0.3, fW * 0.3)}px`);
      h.style.animationDelay = `${i * 110}ms`;
      this._el.fx.appendChild(h);
      setTimeout(() => h.remove(), 1700 + i * 110);
    }
  }

  // Knabbern ohne die Blume zu nehmen; endet mit _frEatEnd
  _frEat(fr, color, ms) {
    const m = fr.mfood;
    fr.el.style.setProperty('--mf', color);
    fr.el.style.setProperty('--eat', `${Math.round(ms)}ms`);
    m.classList.remove('shrink', 'item');
    void m.getBoundingClientRect();
    m.classList.add('shrink');
    fr.el.classList.add('eating');
  }

  _frEatEnd(fr) {
    fr.el.classList.remove('eating');
    fr.mfood.classList.remove('shrink');
  }

  _frBlink() {
    const fr = this._fr;
    if (!fr) return;
    const c = fr.el.classList;
    c.add('blink');
    setTimeout(() => c.remove('blink'), 140);
    if (Math.random() < 0.25) {
      setTimeout(() => c.add('blink'), 280);
      setTimeout(() => c.remove('blink'), 420);
    }
  }

  _frTwitch() {
    const fr = this._fr;
    if (!fr) return;
    const t = pick(['twitch-l', 'twitch-r']);
    fr.el.classList.add(t);
    setTimeout(() => fr.el.classList.remove(t), 550);
  }

  // Pino antippen: Herzen, Freudensprung, kurzer Piep (die Werte des Pikas bleiben, wie sie sind)
  _frPet(fr) {
    if (this._fr !== fr) return;
    this._found('pino');
    this._frHappy(fr);
    this._frJump(fr, Math.random() < 0.3 ? 'binky' : 'hop1');
    this._frSay(fr, pick(['mip!', 'iiep!', '♥', 'pip!']), 1000);
  }

  // ---------- Gemeinsame Spiele (Aktionen des Pikas) ----------

  // Der Pika hoppelt zu Pino, bis sie Nase an Nase stehen. Ist auf seiner Seite kein Platz, rückt Pino.
  // gap: Abstand der beiden (für die eigenen Spiele etwas mehr, damit ein kleiner Gast nicht hinter dem Pika steht)
  async _frMeet(fr, w, speed = 1, gap = this._g.pW * 0.5) {
    const { pW } = this._g;
    const d = fr.x >= this._x ? 1 : -1; // Pino liegt in Richtung d
    const min = pW * 0.45;
    // Der Pika kommt nur bis xR (_walkTo klemmt dort), und Pino soll auch beim Stupsen nicht hinter den Knöpfen stehen
    const max = Math.max(min, d > 0 ? Math.min(this._g.xR, this._frRange()[1] - gap) : this._g.xR);
    const tx = fr.x - d * gap;
    if (tx < min || tx > max) {
      const cx = clamp(tx, min, max);
      await Promise.all([this._walkTo(cx, speed), this._friendWalkTo(fr, cx + d * gap, speed, w, true)]);
    } else {
      await this._walkTo(tx, speed);
    }
    this._face(d);
    this._frFace(fr, -d);
  }

  // Nasenstupsen: beide lehnen sich kurz zueinander, Augen zu, Herzen
  async _frNuzzle(fr, w) {
    const P = this._el.pika.classList;
    const F = fr.el.classList;
    P.remove('nuzzle');
    F.remove('nuzzle');
    void fr.el.offsetWidth;
    P.add('nuzzle');
    F.add('nuzzle');
    await w(320);
    P.add('happy');
    F.add('happy');
    this._hearts(2);
    this._frHearts(fr, 2);
    await w(650);
    P.remove('nuzzle', 'happy');
    F.remove('nuzzle', 'happy');
  }

  // Begrüßung: hinschauen, "Pino!", hinhoppeln, Nasenstupsen
  async _greetFriend() {
    this._memo(this._fr?.kind || 'pino');
    await this._withFriend(async (fr, w) => {
      const P = this._el.pika.classList;
      this._face(fr.x >= this._x ? 1 : -1);
      P.add('look-f');
      this._say(`${this._frGuest()}!`, 1600);
      this._jump('hop1');
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      await w(900);
      P.remove('look-f');
      this._frCall(fr, pick(['mip!', 'iiep!']));
      await w(600);
      await this._frMeet(fr, w, 1.3);
      await w(200);
      await this._frNuzzle(fr, w);
      fr.greeted = true;
      await w(rnd(500, 900));
      if (Math.random() < 0.6) {
        this._jump('binky');
        this._frJump(fr, 'hop1');
        await w(1100);
      }
    });
  }

  // Fangen: abwechselnd hoppelt einer davon, der andere hinterher, mit Staubwölkchen. Tiefe (depth): Sie spielen
  // umeinander herum. Der Läufer nimmt die andere Spur als der Fänger; der folgt ihm mal auf seine Spur, mal bleibt
  // er auf seiner. Stehen sie so auf verschiedenen Spuren, schlüpft der nächste Läufer manchmal mitten an ihm vorbei,
  // vor oder hinter ihm. Zum Schluss kommen beide wieder nach vorn.
  async _chaseFriend() {
    await this._withFriend(async (fr, w) => {
      const { pW, gy } = this._g;
      // Bereich je Spur: vorn wie immer (_frRange), hinten _laneRange für die größere Figur (den Pika). Ist hinten
      // kaum Platz (schmale Karte), bleiben beide vorn.
      const front = this._frRange();
      const back = this._cfg.depth ? this._laneRange(pW) : front;
      const deep = !!this._cfg.depth && back[1] - back[0] > pW * 2;
      const range = (l) => (l ? back : front);
      const lyOf = (l) => (deep && l ? this._H * LANE_DY : 0);
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      this._frSay(fr, 'fang mich!', 1400);
      this._frJump(fr, 'hop1');
      await w(800);
      const pino = (x, speed, delay, lane) => (async () => {
        if (delay) await w(delay);
        await this._friendWalkTo(fr, x, speed, w, true, lane);
      })();
      const pika = (x, speed, delay, lane) => (async () => {
        if (delay) await w(delay);
        await this._walkTo(x, speed, false, lane);
      })();
      const rounds = 3 + Math.floor(rnd(0, 3));
      for (let i = 0; i < rounds; i++) {
        const pinoRuns = i % 2 === 0;
        const rx = pinoRuns ? fr.x : this._x;
        const cx = pinoRuns ? this._x : fr.x;
        const rl0 = deep ? (pinoRuns ? fr.lane : this._lane) || 0 : 0;
        const cl0 = deep ? (pinoRuns ? this._lane : fr.lane) || 0 : 0;
        // Spur des Läufers: die andere als die des Fängers
        let rl = deep ? 1 - cl0 : 0;
        let [lo, hi] = range(rl);
        // weg vom Fänger (chaseFar): nach der Seite, auf der der Läufer von ihm aus steht. Bisher zählte nur, auf
        // welcher Hälfte der Fänger stand, die erste Runde führte darum oft mitten durch ihn hindurch. Ist am Rand
        // kein Platz mehr, rennt der Läufer an ihm vorbei auf die andere Seite.
        let far = chaseFar(rx, cx, lo, hi, pW);
        const via = (f) => (f ? cx > rx : cx < rx); // liegt der Fänger auf dem Weg?
        // An ihm vorbei nie mit Spurwechsel: Die Ebene wechselt erst auf halbem Weg, und das Vorbeilaufen liegt in
        // der ersten Hälfte; er liefe sichtbar durch ihn hindurch. Dann bleibt er auf seiner Spur.
        if (rl !== rl0 && via(far)) {
          rl = rl0;
          [lo, hi] = range(rl);
          far = chaseFar(rx, cx, lo, hi, pW);
        }
        // Auf verschiedenen Spuren (ohne Wechsel, die Ebenen stimmen den ganzen Weg): manchmal mitten an ihm
        // vorbei, wenn dahinter noch eine Pika-Breite Platz ist
        const around = rl0 !== cl0 && !via(far) && Math.random() < 0.5 && (rx < cx ? hi - cx : cx - lo) >= pW;
        if (around) far = rx < cx;
        const past = around || via(far);
        // Der Fänger folgt auf die Spur des Läufers, nach einem Vorbeilaufen nicht (er dreht nur um)
        const cl = past || !deep || Math.random() < 0.5 ? cl0 : rl;
        const mid = (lo + hi) / 2;
        // Ziel im äußeren Drittel der Fluchtseite, mindestens eine Pika-Breite weiter als der Läufer schon steht
        // (beim Vorbeilaufen: als der Fänger)
        const ref = around ? cx : rx;
        const T = clamp(far ? rnd(Math.max(ref + pW, mid + (hi - mid) * 0.4), hi) : rnd(lo, Math.min(ref - pW, mid - (mid - lo) * 0.4)), lo, hi);
        const d = T > rx ? 1 : -1;
        const C = clamp(T - d * pW * 0.7, ...range(cl));
        const speed = rnd(1.9, 2.4);
        this._puff(fr.x, gy - this._frLaneDy(fr), 2);
        this._puff(this._x, gy - this._laneDy(), 2);
        await Promise.all(pinoRuns ? [pino(T, speed, 0, rl), pika(C, speed, 280, cl)] : [pika(T, speed, 0, rl), pino(C, speed, 280, cl)]);
        this._puff(T, gy - lyOf(rl), 2);
        // eingeholt: umdrehen, kichern, Rollen tauschen
        if (pinoRuns) {
          this._frFace(fr, -d);
          this._frSay(fr, pick(['hihi!', 'iiep!', 'du!']), 900);
          this._jump('hop1');
        } else {
          this._face(-d);
          this._say(pick(['hihi!', 'iiep!', 'du!']), 900);
          this._frJump(fr, 'hop1');
        }
        await w(rnd(450, 800));
      }
      // Tiefe: zum Schluss beide wieder auf die vordere Spur (Pino in ihren Bereich), dann erst Freudensprung
      if (deep && (fr.lane || this._lane)) {
        await Promise.all([this._walkTo(this._x, 1.2), this._friendWalkTo(fr, fr.x, 1.2, w)]);
      }
      // außer Atem und glücklich
      this._face(fr.x >= this._x ? 1 : -1);
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      this._jump('binky');
      this._frJump(fr, 'binky');
      this._hearts(2);
      this._frHearts(fr, 2);
      await w(1100);
      this._say('puh!', 1100);
      await w(rnd(900, 1500));
    }, true);
  }

  // Zusammen sitzen: nebeneinander, beide schauen in dieselbe Richtung, Ohrenwackeln, einer putzt den anderen
  async _sitWithFriend() {
    await this._withFriend(async (fr, w) => {
      const { pW } = this._g;
      const D = fr.x < this._W / 2 ? 1 : -1; // beide schauen zur Mitte
      let px = fr.x - D * pW * 0.8;
      if (px < pW * 0.45 || px > this._W - pW * 0.45) px = fr.x + D * pW * 0.8;
      await this._walkTo(px, 0.9);
      this._face(D);
      this._frFace(fr, D);
      const P = this._el.pika.classList;
      const F = fr.el.classList;
      await w(rnd(500, 900));
      const until = Date.now() + rnd(10000, 17000);
      let groomed = false;
      while (Date.now() < until) {
        const r = Math.random();
        if (r < 0.28) {
          P.add('wiggle');
          await w(220);
          F.add('wiggle');
          await w(1400);
          P.remove('wiggle');
          F.remove('wiggle');
        } else if (r < 0.48) {
          P.add('look-up');
          F.add('look-up');
          await w(rnd(1500, 2500));
          P.remove('look-up');
          F.remove('look-up');
        } else if (r < 0.7 && !groomed) {
          groomed = true;
          await this._frGroomEach(fr, w, Math.random() < 0.5, D);
        } else if (r < 0.8) {
          if (Math.random() < 0.5) this._say(pick(['hach…', '♥']), 1200);
          else this._frSay(fr, pick(['hach…', '♥', 'mip']), 1200);
          await w(1200);
        } else {
          if (Math.random() < 0.5) this._twitch();
          else this._frTwitch();
          await w(rnd(900, 1800));
        }
        await w(rnd(400, 900));
      }
    });
  }

  // Einer putzt den anderen: dreht sich hin, rückt heran, Pfoten reiben; der andere schließt die Augen
  async _frGroomEach(fr, w, pikaGrooms, D) {
    const { pW } = this._g;
    const P = this._el.pika;
    const F = fr.el;
    const d = fr.x >= this._x ? 1 : -1; // vom Pika zu Pino
    const lean = pW * 0.22;
    if (pikaGrooms) {
      this._face(d);
      P.style.transition = 'transform .35s ease-out';
      this._setX(this._x + d * lean);
      await w(380);
      P.classList.add('groom');
      F.classList.add('happy');
      await w(rnd(1600, 2300));
      P.classList.remove('groom');
      F.classList.remove('happy');
      this._frHearts(fr, 1);
      P.style.transition = 'transform .35s ease-out';
      this._setX(this._x - d * lean);
      await w(400);
      this._face(D);
    } else {
      this._frFace(fr, -d);
      this._frSetX(fr, fr.x - d * lean, 350, 'ease-out');
      await w(380);
      F.classList.add('groom');
      P.classList.add('happy');
      await w(rnd(1600, 2300));
      F.classList.remove('groom');
      P.classList.remove('happy');
      this._hearts(1);
      this._frSetX(fr, fr.x + d * lean, 350, 'ease-out');
      await w(400);
      this._frFace(fr, D);
    }
  }

  // Aussichtsstein: der Pika springt hinauf und pfeift, Pino schaut von unten hoch und piepst zurück –
  // oder hüpft hinterher und setzt sich hinter ihn (er ist kleiner)
  async _rockWithFriend() {
    await this._withFriend(async (fr, w) => {
      const { rock, pW, gy } = this._g;
      const [lo, hi] = this._frRange();
      const right = this._x > rock.cx && this._footX(1) != null;
      const foot = right ? this._footX(1) : this._footX(-1);
      const px = clamp(foot + (right ? 1 : -1) * pW * 0.55, lo, hi);
      await Promise.all([this._walkTo(foot), this._friendWalkTo(fr, px, 1.1, w)]);
      await w(rnd(200, 500));
      if (this._bird?.perch === 'rock') {
        this._bird.scare();
        await w(600);
      }
      await this._hopTo(rock.cx, rock.lift);
      this._puff(rock.cx, gy - rock.lift, 2);
      const F = fr.el.classList;
      const both = Math.random() < 0.45;
      await w(rnd(300, 600));
      if (both) {
        this._frSay(fr, 'ich auch!', 1100);
        await w(700);
        await this._frHop(fr, rock.cx - this._dir * pW * 0.32, rock.lift, w);
        this._frFace(fr, this._dir);
        this._puff(fr.x, gy - rock.lift, 1);
        await w(rnd(400, 800));
      } else {
        this._frFace(fr, rock.cx >= fr.x ? 1 : -1);
        F.add('look-up');
      }
      const n = 2 + Math.floor(rnd(0, 2));
      for (let i = 0; i < n; i++) {
        await this._call();
        await w(rnd(300, 600));
        F.remove('look-up');
        this._frCall(fr, pick(['mip!', 'iiep!', 'pip!']));
        await w(800);
        if (!both) {
          F.add('look-up');
          if (Math.random() < 0.5) this._face(fr.x >= this._x ? 1 : -1); // schaut zu ihm hinunter
        } else if (Math.random() < 0.5) {
          const P = this._el.pika.classList;
          P.add('wiggle');
          F.add('wiggle');
          await w(1300);
          P.remove('wiggle');
          F.remove('wiggle');
        }
        await w(rnd(600, 1200));
      }
      F.remove('look-up');
      if (both) {
        // Pino springt zuerst; der Pika nimmt die andere Seite des Steins. Ist rechts kein Platz (beide links),
        // rückt Pino vorher ein Stück zur Seite.
        await this._frHopDown(fr, w);
        const x = this._footX(fr.x >= rock.cx ? -1 : 1);
        if (x == null) await this._friendWalkTo(fr, fr.x - pW * 0.8, 1, w);
        await this._hopTo(x ?? this._footX(-1), 0);
        this._puff(this._x, gy, 3);
      } else await this._hopDown();
      if (!both) {
        this._frFace(fr, this._x >= fr.x ? 1 : -1);
        this._frJump(fr, 'hop1');
        this._frSay(fr, '♥', 900);
      }
      await w(rnd(500, 900));
    });
  }

  // Zusammen knabbern: der Pika pflückt eine Blume, Pino knabbert an der nächsten (sie bleibt stehen)
  // oder von der anderen Seite an derselben
  async _nibbleWithFriend() {
    await this._withFriend(async (fr, w) => {
      if (!this._flowers.length || this._wx.snowcover) return;
      const { pW } = this._g;
      const W = this._W;
      const mid = (this._x + fr.x) / 2;
      const near = (x) => (a, b) => Math.abs(a.xf * W - x) - Math.abs(b.xf * W - x);
      const f1 = [...this._flowers].sort(near(mid))[0];
      const x1 = f1.xf * W;
      const f2 = this._flowers
        .filter((f) => f !== f1 && Math.abs(f.xf * W - x1) > pW * 0.7 && Math.abs(f.xf * W - x1) < W * 0.3)
        .sort(near(x1))[0];
      const s = this._x <= x1 ? -1 : 1; // Seite des Pikas an Blume 1
      const fx = f2 ? f2.xf * W + (f2.xf * W > x1 ? 1 : -1) * pW * 0.32 : x1 - s * pW * 0.33;
      const tx = f2 ? f2.xf * W : x1;
      await Promise.all([this._walkTo(x1 + s * pW * 0.36), this._friendWalkTo(fr, fx, 1, w)]);
      this._face(x1 >= this._x ? 1 : -1);
      this._frFace(fr, tx >= fr.x ? 1 : -1);
      await w(250);
      if (!this._flowers.includes(f1)) return;
      this._pickFlower(f1);
      const ms = rnd(2600, 3800);
      this._frEat(fr, f2 ? f2.color : f1.color, ms + 300);
      await this._eat(f1.color, ms);
      this._selfFed(SELF.flower);
      await w(300);
      this._frEatEnd(fr);
      this._frSay(fr, pick(['mmh!', 'lecker!', '♥']), 1100);
      await w(rnd(700, 1200));
    });
  }

  // Piep-Duett: abwechselnd piepsen, immer schneller, zum Schluss zusammen
  async _squeakDuet() {
    await this._withFriend(async (fr, w) => {
      const { pW } = this._g;
      const dist = Math.abs(fr.x - this._x);
      if (dist > this._W * 0.4 || dist < pW * 0.6) {
        const d = fr.x >= this._x ? 1 : -1;
        await this._walkTo(fr.x - d * pW * rnd(1, 1.3));
      } else if (this._cfg.depth && this._lane) {
        await this._walkTo(this._x); // Tiefe: von der hinteren Spur nach vorn zu Pino
      }
      this._face(fr.x >= this._x ? 1 : -1);
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      const P = this._el.pika.classList;
      await w(400);
      const n = 3 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        const fast = i >= 2;
        P.add('calling');
        this._say(pick(['iiep!', 'mip!', 'iiiep!', 'pip!']), 800);
        await w(600);
        P.remove('calling');
        await w(fast ? 120 : 320);
        this._frCall(fr, pick(['mip!', 'pip!', 'iiep!', 'piep!']));
        await w(fast ? 600 : 760);
        await w(fast ? 120 : 320);
      }
      P.add('calling');
      this._say('iiiiep!', 1000);
      this._frCall(fr, 'iiiiep!');
      await w(700);
      P.remove('calling');
      this._happy();
      this._frHappy(fr);
      await w(1300);
    });
  }

  // ---------- Eigene Spiele der Freunde (ab 0.44) ----------
  // Rufus holt das Stöckchen (_fetchFriend), Katzumi jagt das Wollknäuel oder eine Feder am Halm (_pounceFriend),
  // Kirby kullert (_rollFriend). Sie laufen wie die gemeinsamen Spiele in _withFriend: Geht der Gast (nach der Uhr),
  // wird gefüttert, ist Schlafenszeit oder verschwindet die Karte, bricht die Wartestelle ab, an der sie gerade
  // stehen, und das finally dort räumt Spielzeug und Haltungen ab. Gespielt wird vorn (_withFriend holt den Gast von
  // der hinteren Spur, der Pika kommt mit seinem ersten _walkTo nach vorn). Jedes Gerät würfelt für sich wie bei
  // den gemeinsamen Spielen (rnd, pick), im Tagesplan steht davon nichts. Mit „Bewegung reduzieren“ (calmMotion)
  // und wo der Platz für Wurf oder Rolle fehlt (sehr schmale Karten), gibt es je eine ruhige Fassung.

  // Spielzeug als eigenes Element in der Effekt-Ebene (das Stöckchen im Flug und am Boden), Mitte bei (x, y), so
  // groß, wie es im Maul des Pikas aussieht. _frToysAway räumt es ab (im finally von _withFriend alle).
  _frToy(svg, x, y, rot = 0) {
    const size = (this._g.pW * TOY_S.stick * 0.68 * 24) / 120;
    const el = document.createElement('div');
    el.className = 'ftoy';
    Object.assign(el.style, {
      width: `${size.toFixed(1)}px`, height: `${size.toFixed(1)}px`, margin: `${(-size / 2).toFixed(1)}px 0 0 ${(-size / 2).toFixed(1)}px`,
    });
    el.innerHTML = svg;
    this._el.fx.appendChild(el);
    (this._frToys ??= new Set()).add(el);
    this._frToyAt(el, x, y, rot);
    return el;
  }

  _frToyAt(el, x, y, rot = 0) {
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(0)}deg)`;
  }

  // Wurf: in ms im Bogen von (x0, y0) nach (x1, y1), Scheitel h über der geraden Linie, dabei turns Umdrehungen.
  // Die Endlage steht gleich im Stil, die Flugbahn liegt als Animation darüber: Bricht sie ab, liegt es am Ziel.
  _frToyFly(el, x0, y0, x1, y1, h, ms, turns) {
    const frames = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = Math.max(this._g.pH * 0.08, y0 + (y1 - y0) * t - 4 * h * t * (1 - t));
      frames.push({ transform: `translate(${(x0 + (x1 - x0) * t).toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(turns * 360 * t).toFixed(0)}deg)` });
    }
    el._fly?.cancel();
    el._fly = el.animate?.(frames, { duration: ms, easing: 'linear' }) || null;
    this._frToyAt(el, x1, y1, 0);
  }

  // Spielzeug weg: alles oder nur dieses (only), fade: erst ausblenden. Eine laufende Flugbahn endet mit.
  _frToysAway(only = null, fade = false) {
    for (const el of only ? [only] : [...(this._frToys || [])]) {
      if (!this._frToys?.delete(el)) continue;
      el._fly?.cancel();
      if (fade) {
        el.classList.add('off');
        setTimeout(() => el.remove(), 450);
      } else el.remove();
    }
  }

  // Der Freund trägt etwas im Maul (svg wie für _mouth: 24 × 24 vor der Schnauze; null: nichts mehr). Es steckt wie
  // ein Leckerli in .mf-item seiner Grafik, .carry zeigt es; _friendSettle nimmt beides wieder weg.
  _frCarry(fr, svg) {
    const m = fr.mfood;
    const it = m?.querySelector('.mf-item');
    if (!it) return;
    it.innerHTML = svg ? svg.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '') : '';
    m.classList.remove('shrink');
    m.classList.toggle('item', !!svg);
    fr.el.classList.toggle('carry', !!svg);
  }

  // Der Pika trägt etwas im Maul (Stöckchen, Angel mit Feder): über _mouth und .carry, beides räumt _cleanup ab
  _frPikaCarry(svg) {
    if (svg) this._mouth('#b98a55', svg);
    this._el.pika.classList.toggle('carry', !!svg);
  }

  // Schwindlig: Sternchen über dem Kopf des Freunds bzw. (ohne fr) des Pikas
  _frStars(fr = null) {
    const { pW, pH, gy } = this._g;
    if (!fr) {
      const n = this._nosePos();
      return this._sparkle(n.x - this._dir * pW * 0.1, n.y - pH * 0.34, 3);
    }
    const s = this._frSc(fr);
    const live = this._frLive(fr);
    this._sparkle(live.x + fr.dir * pW * s * 0.15, gy - pH * s * 0.82 - live.lift - live.dy, 3);
  }

  // Rufus holt das Stöckchen: Der Pika findet eins, wirft es im Bogen über die Wiese, Rufus saust mit fliegenden
  // Ohren hinterher, bringt es im Maul zurück und legt es ihm vor die Füße (zwei- oder dreimal). Zum Schluss sitzen
  // beide nebeneinander. Die Wurfweite richtet sich nach der Wiese (höchstens 2,4 Pika-Breiten).
  // Ruhig (Bewegung reduzieren, oder die Wiese ist kürzer als ein Wurf): Der Pika trägt es ihm hin, Rufus trägt es
  // eine kleine Runde und bringt es wieder. Kein Wurf, kein Rennen.
  async _fetchFriend() {
    await this._withFriend(async (fr, w) => {
      if (fr.kind !== 'rufus') return;
      const { pW, pH, gy, xR } = this._g;
      const P = this._el.pika.classList;
      const F = fr.el.classList;
      const [lo, hi] = this._frRange();
      const fW = pW * this._frSc(fr);
      // So weit steht Rufus vor dem Pika: Er ist kleiner und steht in der Ebene hinter ihm, näher verschwände er
      // hinter dessen Kopf (anders als beim Nasenstupsen soll man hier sehen, was er im Maul hat)
      const gap = pW * 0.48 + fW * 0.52;
      const D = Math.min(pW * 2.4, hi - lo - pW * 0.3);
      const calm = calmMotion() || D < pW * 0.7;
      const ground = gy - pH * 0.035;
      // Aufheben und Ablegen: kurz ducken
      const duck = async (C, ms) => {
        C.add('crouch');
        await w(ms);
        C.remove('crouch');
      };
      const find = async () => {
        P.add('sniff');
        await w(650);
        P.remove('sniff');
        this._frPikaCarry(FRIEND_TOY.stickPika);
        this._say(pick(['ein Stöckchen!', 'oh, ein Stock!', 'schau mal!']), 1200);
        await w(600);
      };
      let toy = null;
      // Rufus legt das Stöckchen zwischen sich und den Pika
      const drop = async () => {
        await duck(F, 240);
        this._frCarry(fr, null);
        toy = this._frToy(FRIEND_TOY.stick, (this._x + fr.x) / 2 + (fr.x >= this._x ? 1 : -1) * pW * 0.08, ground, -4);
      };
      const take = async () => {
        await duck(F, 260);
        this._frToysAway(toy);
        this._frCarry(fr, FRIEND_TOY.stickRufus);
        await w(250);
      };
      let dir;
      if (calm) {
        // hintragen statt werfen
        if (this._lane) await this._walkTo(this._x);
        await find();
        await this._frMeet(fr, w, 0.9, gap);
        dir = fr.x >= this._x ? 1 : -1;
        await duck(P, 260);
        this._frPikaCarry(null);
        toy = this._frToy(FRIEND_TOY.stick, (this._x + fr.x) / 2, ground, -4);
        this._say('für dich!', 1100);
        await w(900);
        await take();
        this._frSay(fr, 'wuff!', 900);
        await w(700);
        // eine kleine Runde mit dem Stöckchen im Maul, und wieder her
        const r0 = fr.x;
        const far = dir > 0 ? hi - r0 : r0 - lo;
        if (far > pW * 0.3) {
          await this._friendWalkTo(fr, r0 + dir * Math.min(far, pW * 0.9), 0.9, w);
          await w(400);
          await this._friendWalkTo(fr, r0, 0.9, w);
        }
        this._frFace(fr, -dir);
        await drop();
        this._frSay(fr, 'wuff!', 900);
        await w(600);
      } else {
        // Der Pika wirft zur Seite mit mehr Platz und steht am anderen Ende, Rufus wartet vor ihm
        dir = this._x <= (lo + hi) / 2 ? 1 : -1;
        const px = dir > 0 ? clamp(this._x, Math.max(pW * 0.45, lo - gap), Math.max(pW * 0.45, hi - D - gap))
          : clamp(this._x, Math.min(xR, lo + D + gap), Math.min(xR, hi + gap));
        const r0 = clamp(px + dir * gap, lo, hi);
        await Promise.all([this._walkTo(px, 1.1), this._friendWalkTo(fr, r0, 1.2, w)]);
        this._face(dir);
        this._frFace(fr, -dir);
        await find();
        this._frCall(fr, 'wuff!');
        await w(800);
        const n = D > pW * 1.4 && Math.random() < 0.5 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const land = clamp(fr.x + dir * D * rnd(0.75, 1), lo, hi);
          // ausholen, werfen
          await duck(P, 240);
          this._frPikaCarry(null);
          this._jump('hop1');
          this._say(pick(['hol!', 'hol das Stöckchen!', 'los, Rufus!']), 1000);
          const m = this._nosePos();
          const far = Math.abs(land - m.x) / (pW * 2.4);
          const ms = 620 + 280 * far;
          toy = this._frToy(FRIEND_TOY.stick, m.x, m.y);
          this._frToyFly(toy, m.x, m.y, land, ground, pH * (0.3 + 0.3 * far), ms, dir * 2);
          // Rufus schaut ihm kurz nach und saust hinterher, die Schlappohren fliegen. Er kommt an, wenn es gelandet ist
          // (ohne den Augenblick des Nachschauens überholte er auf schmalen Karten das Stöckchen).
          this._frFace(fr, dir);
          F.add('look-up');
          await Promise.all([
            (async () => {
              await w(ms);
              this._puff(land, gy, 1);
            })(),
            (async () => {
              await w(ms * 0.4);
              F.remove('look-up');
              this._puff(fr.x, gy, 2);
              F.add('fdash');
              await this._friendWalkTo(fr, clamp(land - dir * fW * 0.32, lo, hi), 2.4, w);
            })(),
          ]);
          F.remove('fdash');
          await take();
          // zurück zum Pika
          F.add('fdash');
          await this._friendWalkTo(fr, r0, 2, w);
          F.remove('fdash');
          this._frFace(fr, -dir);
          await drop();
          this._frCall(fr, 'wuff!');
          F.add('wiggle');
          await w(500);
          this._say(i === n - 1 ? 'guter Rufus!' : pick(['guter Rufus!', 'fein gemacht!', 'toll!']), 1200);
          P.add('happy');
          this._frHearts(fr, 1);
          await w(900);
          P.remove('happy');
          F.remove('wiggle');
          if (i < n - 1) {
            this._frSay(fr, 'nochmal!', 1000);
            this._frJump(fr, 'hop1');
            await w(800);
            // der Pika hebt es wieder auf
            P.add('sniff');
            await w(450);
            P.remove('sniff');
            this._frToysAway(toy);
            this._frPikaCarry(FRIEND_TOY.stickPika);
            await w(400);
          }
        }
      }
      // Zum Schluss sitzen beide nebeneinander, das Stöckchen vor sich
      if (calm) this._say('guter Rufus!', 1300);
      this._face(dir);
      this._frFace(fr, dir);
      this._hearts(1);
      this._frHearts(fr, 2);
      await w(900);
      P.add('wiggle');
      F.add('wiggle');
      await w(1400);
      P.remove('wiggle');
      F.remove('wiggle');
      this._frToysAway(toy, true);
      await w(rnd(500, 900));
    });
  }

  // Katzumi jagt. Liegt das Wollknäuel aus den Päckchen auf der Wiese und ist darum Platz (_frYarnPlan), stupst der
  // Pika es an, und sie springt ihm nach und schlägt es zurück (_frYarnHunt). Sonst (und mit „Bewegung reduzieren“
  // immer) hält der Pika einen Grashalm mit einer Feder am Faden, im Herbst mit einem Blatt (_frDangleHunt).
  async _pounceFriend() {
    await this._withFriend(async (fr, w) => {
      if (fr.kind !== 'katzumi') return;
      const calm = calmMotion();
      const yarn = calm ? null : this._frYarnPlan(fr);
      if (yarn) await this._frYarnHunt(fr, w, yarn);
      else await this._frDangleHunt(fr, w, calm);
    });
  }

  // Taugt das echte Wollknäuel (Schatz 0, _gtEls) für die Jagd? Es muss auf der Wiese liegen, dort, wo Katzumi hin
  // darf (_frRange: nicht am Bau), und in eine Richtung mindestens eine knappe halbe Pika-Breite weit rollen können,
  // ohne die Wiese der Schätze (fMin … fMax) oder ihren Bereich zu verlassen; der Pika steht auf der anderen Seite.
  // → { el, dir, d: Rollweite } oder null (dann die Feder).
  _frYarnPlan(fr) {
    const el = this._gtEls?.get(0);
    if (!el?.isConnected) return null;
    const { pW, fMin, fMax, xR } = this._g;
    const W = this._W;
    const [lo, hi] = this._frRange();
    const fW = pW * this._frSc(fr);
    const x = this._giftX(0);
    const opt = [1, -1].map((dir) => {
      const end = dir > 0 ? Math.min(hi - fW * 0.6, fMax * W) : Math.max(lo + fW * 0.6, fMin * W);
      const px = x - dir * pW * 0.36;
      return { dir, d: (end - x) * dir, ok: px >= pW * 0.45 - 1 && px <= xR + 1 && x >= lo - pW * 0.2 && x <= hi + pW * 0.2 };
    }).filter((o) => o.ok && o.d >= pW * 0.45).sort((a, b) => b.d - a.d)[0];
    return opt ? { el, dir: opt.dir, d: Math.min(opt.d, pW * 1.5) } : null;
  }

  // Jagd auf das Wollknäuel: Der Pika stupst es an, es kullert auf Katzumi zu. Sie duckt sich, wackelt, springt
  // darauf und schlägt es zurück; beim letzten Mal hält sie es fest. Bewegt wird es genau wie in seinem eigenen
  // Spiel (_giftYarn: left mit Überblendung, _yarnXf, _yarnRot), es bleibt am Ende liegen, wo es hingerollt ist.
  // Tippt jemand es zwischendurch weg (_yarnTap), geht es von dort weiter; ist es weg (Plan geändert), ist Schluss.
  async _frYarnHunt(fr, w, Y) {
    const { pW, gy, fMin, fMax } = this._g;
    const W = this._W;
    const P = this._el.pika.classList;
    const F = fr.el.classList;
    const [lo, hi] = this._frRange();
    const fW = pW * this._frSc(fr);
    const { el, dir } = Y;
    const home = this._giftX(0);
    // äußerste Stelle, bis zu der es auf ihrer Seite rollen darf
    const edge = dir > 0 ? Math.min(hi - fW * 0.6, fMax * W) : Math.max(lo + fW * 0.6, fMin * W);
    const roll = (to, ms) => {
      const from = this._giftX(0);
      this._yarnXf = to / W;
      this._yarnRot = (this._yarnRot || 0) + ((to - from) / (Math.PI * this._H * 0.075)) * 360;
      el.style.transition = `left ${ms}ms cubic-bezier(.2, .7, .4, 1)`;
      el.style.left = `${to.toFixed(1)}px`;
      const svg = el.querySelector('svg');
      if (svg) svg.style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
    };
    const lurk = clamp(home + dir * (Y.d + fW * 0.5), lo, hi);
    try {
      // der Pika hinter das Knäuel, Katzumi gegenüber auf die Lauer
      await Promise.all([this._walkTo(home - dir * pW * 0.36, 1.2), this._friendWalkTo(fr, lurk, 1.2, w)]);
      this._face(dir);
      this._frFace(fr, -dir);
      await w(350);
      const n = Math.random() < 0.5 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        if (!el.isConnected) return;
        const from = this._giftX(0);
        const to = clamp(from + dir * Y.d * rnd(0.7, 1), Math.min(from, edge), Math.max(from, edge));
        // anstupsen
        P.add('crouch');
        await w(260);
        P.remove('crouch');
        this._jump('hop1');
        roll(to, 1000);
        if (i === 0) this._say(pick(['fang!', 'kuller!', 'hopp!']), 900);
        // ducken, wackeln, Sprung auf das Knäuel
        this._frFace(fr, to >= fr.x ? 1 : -1);
        F.add('kwig');
        await w(650);
        F.remove('kwig');
        await this._frHop(fr, clamp(to + dir * fW * 0.35, lo, hi), 0, w);
        this._frFace(fr, -dir);
        this._puff(fr.x, gy, 1);
        this._frSay(fr, 'mau!', 800);
        await w(400);
        if (!el.isConnected) return;
        if (i === n - 1) break;
        // mit Schwung zurück zum Pika
        F.add('nuzzle');
        await w(280);
        roll(clamp(this._x + dir * pW * 0.36, fMin * W, fMax * W), 900);
        await w(560);
        F.remove('nuzzle');
        this._jump('hop1');
        if (Math.random() < 0.5) this._say(pick(['hihi!', 'nochmal!']), 900);
        await this._friendWalkTo(fr, lurk, 1.3, w);
        this._frFace(fr, -dir);
        await w(rnd(300, 600));
      }
      // erwischt
      this._frSay(fr, 'hab es!', 1300);
      this._frJump(fr, 'hop1');
      this._frHearts(fr, 2);
      await w(500);
      this._happy(1100);
      this._say(pick(['gut gefangen!', 'hihi!']), 1100);
      await w(1300);
    } finally {
      el.style.transition = '';
    }
  }

  // Jagd auf die Feder am Halm: Der Pika findet sie, hält den Halm im Maul, die Feder pendelt vor seiner Nase.
  // Katzumi duckt sich, wackelt, springt – daneben, denn der Pika tritt im letzten Augenblick einen Schritt zurück –,
  // wackelt wieder, springt und hat sie. Stolz trägt sie die Beute ein paar Schritte.
  // calm (Bewegung reduzieren): kein Sprung. Sie kommt heran und tippt die Feder zweimal an, dann bekommt sie sie.
  async _frDangleHunt(fr, w, calm) {
    const { pW, gy, xR } = this._g;
    const P = this._el.pika.classList;
    const F = fr.el.classList;
    const [lo, hi] = this._frRange();
    const fW = pW * this._frSc(fr);
    const kind = this._seasonK === 'autumn' ? 'leaf' : 'feather';
    const reach = pW * TOY_S.reach; // so weit vor seiner Mitte hängt die Feder (FRIEND_TOY.dangle)
    // Dort landet Katzumi: mit dem Gesicht unter der Feder, aber nicht hinter dem Kopf des Pikas (sie steht in der
    // Ebene hinter ihm)
    const under = reach + pW * 0.12;
    const wait = under + pW * 0.6; // … und dort lauert sie
    const step = calm ? 0 : pW * 0.5; // Schritt zurück beim ersten Sprung
    // Der Pika schaut zur Seite mit mehr Platz; hinter sich braucht er den Schritt, Katzumi landet in ihrem Bereich
    const dir = this._x <= (lo + hi) / 2 ? 1 : -1;
    const px = dir > 0 ? clamp(this._x, Math.max(pW * 0.45 + step, lo + step - under), Math.max(pW * 0.45 + step, hi - wait))
      : clamp(this._x, Math.min(xR - step, lo + wait), Math.min(xR - step, hi - step + under));
    await Promise.all([this._walkTo(px, 1), this._friendWalkTo(fr, clamp(px + dir * wait, lo, hi), 1.1, w)]);
    this._face(dir);
    this._frFace(fr, -dir);
    P.add('sniff');
    await w(600);
    P.remove('sniff');
    this._frPikaCarry(FRIEND_TOY.dangle[kind]);
    this._say(kind === 'leaf' ? 'ein Blatt!' : 'eine Feder!', 1200);
    await w(700);
    this._frSay(fr, 'mau?', 900);
    F.add('look-f');
    await w(900);
    F.remove('look-f');
    const spot = () => clamp(this._x + dir * under, lo, hi);
    if (calm) {
      await this._friendWalkTo(fr, spot(), 0.8, w);
      this._frFace(fr, -dir);
      for (let i = 0; i < 2; i++) {
        F.add('look-up');
        await w(700);
        F.add('crouch');
        await w(260);
        F.remove('crouch');
        this._frSay(fr, 'mau!', 800);
        await w(900);
        F.remove('look-up');
      }
    } else {
      // erster Sprung: daneben
      F.add('kwig');
      await w(650);
      F.remove('kwig');
      await Promise.all([
        this._frHop(fr, spot(), 0, w),
        (async () => {
          await w(220);
          await this._walkTo(this._x - dir * step, 1.6, true, 0, true);
        })(),
      ]);
      this._frFace(fr, -dir);
      this._puff(fr.x, gy, 1);
      this._frSay(fr, 'mau!', 800);
      await w(350);
      this._say(pick(['hihi!', 'daneben!']), 900);
      await w(800);
      // zweiter Sprung: erwischt
      F.add('kwig');
      await w(550);
      F.remove('kwig');
      await this._frHop(fr, spot(), 0, w);
      this._frFace(fr, -dir);
      this._puff(fr.x, gy, 1);
    }
    // gefangen: Die Feder wechselt vom Halm ins Maul der Katze
    this._frPikaCarry(null);
    this._frCarry(fr, FRIEND_TOY.catch[kind]);
    this._frSay(fr, 'hab es!', 1300);
    if (!calm) this._frJump(fr, 'hop1');
    this._frHearts(fr, 2);
    await w(600);
    P.add('happy');
    this._say(pick(['gut gefangen!', 'oh!', 'hihi!']), 1100);
    await w(1200);
    P.remove('happy');
    // stolz mit der Beute ein paar Schritte
    await this._friendWalkTo(fr, fr.x + dir * pW * 0.6, 0.9, w);
    this._frFace(fr, -dir);
    await w(rnd(800, 1300));
    this._frCarry(fr, null);
  }

  // Kirby kullert: Er rollt sich ein und kullert wie ein Ball über die Wiese, der Pika hoppelt hinterher. Zurück
  // schlägt der Pika Purzelbäume voraus (wie in seiner kleinen Beschäftigung, _purzel), Kirby kullert hinterdrein.
  // Am Ende sind beide schwindlig (Sternchen) und kichern. Die Strecke richtet sich nach der Wiese (höchstens drei
  // Pika-Breiten); gedreht wird um so viele ganze Umdrehungen, wie sein Umfang in die Strecke passt.
  // Ruhig (Bewegung reduzieren, oder weniger als gut eine Pika-Breite Platz): Sie sitzen nebeneinander und schunkeln.
  async _rollFriend() {
    await this._withFriend(async (fr, w) => {
      if (fr.kind !== 'kirby') return;
      const { pW, gy, xR } = this._g;
      const P = this._el.pika.classList;
      const F = fr.el.classList;
      const fW = pW * this._frSc(fr);
      // ein wenig Rand zum Kartenrand: Dort bleibt er schwindlig stehen, mit Sternchen über dem Kopf
      const [lo, hi0] = this._frRange();
      const hi = Math.max(lo, hi0 - fW * 0.12);
      const D = Math.min(hi - lo, pW * 3);
      if (calmMotion() || D < pW * 1.1) return this._frSway(fr, w);
      const round = fW * 0.62 * Math.PI; // Umfang der Kugel
      const behind = pW * 0.95; // Abstand des Pikas
      // Kirby kullert von seinem Ende der Wiese zum anderen
      const dir = fr.x <= (lo + hi) / 2 ? 1 : -1;
      const a = dir > 0 ? clamp(fr.x, lo, hi - D) : clamp(fr.x, lo + D, hi);
      const pika = (x) => clamp(x, pW * 0.45, xR);
      await Promise.all([this._friendWalkTo(fr, a, 1.2, w), this._walkTo(pika(a - dir * behind), 1.2)]);
      this._face(fr.x >= this._x ? 1 : -1);
      this._frFace(fr, dir);
      this._frSay(fr, 'kuller, kuller!', 1300);
      this._frJump(fr, 'hop1');
      await w(1000);
      // einrollen und los: Weg und Drehung laufen gleich lang und gleichmäßig
      const kroll = async (to) => {
        const dist = Math.abs(to - fr.x);
        if (dist < 4) return;
        const ms = Math.round(clamp((dist / (pW * 1.5)) * 1000, 700, 2400));
        this._frFace(fr, to >= fr.x ? 1 : -1);
        F.add('crouch');
        await w(240);
        F.remove('crouch');
        fr.el.style.setProperty('--krd', `${ms}ms`);
        fr.el.style.setProperty('--kra', `${Math.max(1, Math.round(dist / round)) * 360}deg`);
        this._puff(fr.x, gy, 2);
        this._frSetX(fr, to, ms, 'linear');
        F.add('kroll');
        await w(ms);
        F.remove('kroll');
        this._puff(fr.x, gy, 2);
      };
      await Promise.all([
        kroll(a + dir * D),
        (async () => {
          await w(500);
          this._say(pick(['warte!', 'huiii!', 'hinterher!']), 900);
          await this._walkTo(pika(a + dir * D - dir * behind), 2);
        })(),
      ]);
      // Kirby ist schwindlig
      this._face(fr.x >= this._x ? 1 : -1);
      F.add('crosseye');
      this._frStars(fr);
      await w(1100);
      F.remove('crosseye');
      // zurück: Der Pika purzelt voraus (höchstens zwei Purzelbäume, sonst hoppelt er), Kirby kullert hinterher
      this._frFace(fr, -dir);
      this._say(pick(['ich auch!', 'jetzt ich!']), 1000);
      await w(800);
      const PD = pW * 0.95;
      const room = dir > 0 ? this._x - pW * 0.45 : xR - this._x;
      const m = Math.min(2, Math.floor(room / PD));
      const back = m ? m * PD : Math.max(0, Math.min(room, D * 0.7));
      await Promise.all([
        (async () => {
          this._face(-dir);
          if (!m) return this._walkTo(this._x - dir * back, 1.8);
          const p = this._el.pika;
          for (let i = 0; i < m; i++) {
            P.add('crouch');
            await w(300);
            P.remove('crouch');
            p.style.transition = `transform ${PURZEL_ROLL}ms cubic-bezier(.4, .1, .5, 1)`;
            this._setX(pika(this._x - dir * PD));
            P.add('purzel');
            await w(PURZEL_ROLL);
            P.remove('purzel');
            this._cls('lnd', 600, true);
            this._puff(this._x, gy, 2);
            await w(150);
          }
        })(),
        (async () => {
          // mit Abstand hinterher: Er kommt an, wenn der Pika seinen letzten Purzelbaum hinter sich hat (sonst
          // rollte er ihm von hinten in die Beine)
          await w(900);
          await kroll(clamp(fr.x - dir * back, lo, hi));
        })(),
      ]);
      // beide schwindlig, dann kichern
      this._face(fr.x >= this._x ? 1 : -1);
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      P.add('crosseye');
      F.add('crosseye');
      this._frStars();
      this._frStars(fr);
      await w(1200);
      P.remove('crosseye');
      F.remove('crosseye');
      this._say(pick(['hihi!', 'kuller, kuller!', 'hui!']), 1100);
      await w(350);
      this._frSay(fr, pick(['hihi!', 'nochmal!']), 1100);
      this._happy(1200);
      this._frHappy(fr);
      await w(1400);
    });
  }

  // Ruhige Fassung des Kullerns: nebeneinander sitzen, beide schauen zur Mitte, und abwechselnd sacht zur Seite
  // neigen (.lean, eine kurze Überblendung, kein Dauerlauf)
  async _frSway(fr, w) {
    const { pW, xR } = this._g;
    const P = this._el.pika.classList;
    const F = fr.el.classList;
    const D = fr.x < this._W / 2 ? 1 : -1;
    let px = fr.x - D * pW * 0.8;
    if (px < pW * 0.45 || px > xR) px = fr.x + D * pW * 0.8;
    await this._walkTo(px, 0.9);
    this._face(D);
    this._frFace(fr, D);
    await w(500);
    this._frSay(fr, 'schunkel, schunkel!', 1500);
    await w(900);
    for (let i = 0; i < 3; i++) {
      P.add('lean');
      await w(450);
      F.add('lean');
      await w(750);
      P.remove('lean');
      await w(450);
      F.remove('lean');
      await w(550);
    }
    this._say(pick(['hihi!', 'schön!']), 1100);
    this._hearts(1);
    this._frHearts(fr, 1);
    await w(1300);
  }

  // Von wem er im Schlaf murmelt (_dream): von einem Freund, der an diesem Pika-Tag zu Besuch war (Tagesgedächtnis
  // im Plan, dieselbe Frist wie bei den Träumen), sonst von Pino. Nicht _frGuest: Das ist der letzte Gast auf diesem
  // Gerät, auch wenn der vor Tagen da war.
  _frMumble() {
    const c = this._plan?.cute;
    const heute = c && c.d >= pikaDay(this._haNow()) - 1
      ? FRIEND_KEYS.filter((k) => MEM_BITS.includes(k) && c.m & (1 << MEM_BITS.indexOf(k))) : [];
    return FRIENDS[heute.length ? pick(heute) : 'pino'].name || this._frName();
  }

  // Abschied: Pino nachschauen (dreht sich mit), "tschüss", kurz die Ohren hängen lassen
  async _byeFriend() {
    const bye = this._frBye;
    if (!bye) return;
    bye.done = true;
    const P = this._el.pika.classList;
    const where = () => (this._fr ? this._frLive(this._fr).x : bye.x);
    this._face(where() >= this._x ? 1 : -1);
    P.add('look-f');
    // auch bei Abbruch (Streicheln, Futter, Schlaf) nicht traurig hängen bleiben: sad räumt _cleanup nicht ab
    try {
      await this._wait(800);
      this._say(`tschüss, ${this._frGuest()}!`, 1500);
      const end = Date.now() + 5000;
      while (this._fr && Date.now() < end) {
        await this._wait(300);
        this._face(where() >= this._x ? 1 : -1);
      }
      P.add('sad');
      await this._wait(rnd(2200, 3200));
    } finally {
      P.remove('sad', 'look-f');
    }
    await this._wait(rnd(300, 700));
  }
}
