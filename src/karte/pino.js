// Pino: Besuchsplan, Kommen und Gehen, eigenes Leben, gemeinsame Spiele

import { Cancel, rnd, pick, clamp, pause, weighted, seedRnd } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { SELF } from '../logik/zustand.js';
import { FRIEND_SCALE, FRIEND_WIN, FRIEND_LAST, FRIEND_ACTS, FRIEND_YIELD, FRIEND_CLS } from '../logik/besucher.js';
import { HOP_MS, hopRound, jumpBusy, chaseFar } from '../logik/beschaeftigungen.js';
import { ICON_HEART } from '../grafik/szene.js';
import { FRIEND_SVG } from '../grafik/besucher.js';

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
    s.setProperty('--ph', `${g.pH * FRIEND_SCALE}px`);
    s.setProperty('--pw', `${g.pW * FRIEND_SCALE}px`);
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
    const [lo, hi] = this._frRange();
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
    return [
      [wet ? 1 : 7, 'chaseFriend'],
      [6, 'sitWithFriend'],
      [wet ? 1 : 4, 'rockWithFriend'],
      [ctx.hasFlowers ? (ctx.s < 50 ? 5 : 3.5) : 0, 'nibbleWithFriend'],
      [3.5, 'squeakDuet'],
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
      return { nextInMs: start - now, stayMs: end - start, side: r(3) < 0.5 ? -1 : 1 };
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

  // Was gegen Besuch spricht (Bits): 1 Pika schläft oder geht schlafen, 2 Regen/Gewitter, 4 nicht Tag
  _friendBad() {
    const sleepy = this._asleep || this._sleepTime() || this._action === 'goSleep';
    const wx = this._wx;
    const e = this._dbgElev ?? this._elev;
    return (sleepy ? 1 : 0) | (wx.wet || wx.storm || wx.shelter ? 2 : 0) | ((e == null ? sleepy : e <= 3) ? 4 : 0);
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

  // ---------- Besuch ----------

  // Pino kommt (force: sofort, bei jedem Wetter und jeder Tageszeit, für die Vorschau)
  _friendCome(side, stayMs, force = false) {
    if (!this._g || this._fr || !this._cfg?.friend) return;
    if (side == null || stayMs == null) {
      const s = this._friendSchedule();
      side ??= s.side;
      stayMs ??= Math.max(s.stayMs, 9e4);
    }
    clearTimeout(this._frT);
    this._frT = null;
    this._frBye = null;
    const fr = this._friendBuild();
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

  _friendBuild() {
    const el = document.createElement('div');
    el.className = 'friend';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${this._frName()} streicheln`);
    el.innerHTML = '<div class="clipw"><div class="shadow"></div><div class="depth"><div class="flip"><div class="jump">'
      + `<div class="hop"><div class="br">${FRIEND_SVG}</div></div></div></div></div></div>`;
    el.querySelectorAll('.book, .gb, .tab, .kpaw, .bk, .brolly, .cap, .cup, .cfoam, .rope, .band, .arms, .uke, .brush, .wand, .rgrip, .bar, .wpaw, .slg, .gspy, .gcan, .shades, .hoop, .yo, .pbl, .jug, .dchain, .dcrown, .pgl, .peb, .sboat').forEach((n) => n.remove());
    // Sprechblase in eigener Hülle in der Sprech-Ebene; sie läuft mit Pino mit (_frSetX, _frFace)
    const sw = document.createElement('div');
    sw.className = 'frsay';
    sw.innerHTML = '<div class="anchor"><div class="bubble say"></div></div>';
    const fr = {
      el, sw, jump: el.querySelector('.jump'), say: sw.querySelector('.say'), mfood: el.querySelector('.mfood'),
      x: 0, dir: 1, lift: 0, tok: 0, arrived: false, greeted: false, leaving: false, hurry: false, busy: false, want: null,
    };
    fr.kickP = new Promise((r) => (fr.kick = r));
    el.addEventListener('click', (e) => (e.stopPropagation(), this._frPet(fr)));
    this._keyTap(el);
    el.classList.toggle('cold', !!this._wx.cold);
    this._el.friends.append(el, sw);
    return fr;
  }

  // Ohne Abschied entfernen (Tab unsichtbar, Größenänderung, abgeschaltet, Ende des Besuchs)
  _friendGone(fr) {
    if (this._fr === fr) this._fr = null;
    this._frTake(fr); // wartende Schritte wecken, sie brechen dann ab
    for (const t of ['sayT', 'callT', 'jumpT', 'happyT', 'lookT', 'untilT']) clearTimeout(fr[t]);
    fr.el.remove();
    fr.sw.remove();
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
    const fW = this._g.pW * FRIEND_SCALE;
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
    const fW = this._g.pW * FRIEND_SCALE;
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
    const act = weighted([
      [fr.greeted ? 3 : 0.5, 'hop'],
      [2, 'look'],
      [fr.greeted ? 1.5 : 0.4, 'groom'],
      [1, 'squeak'],
      [fr.greeted ? 0.5 : 0, 'binky'],
      [!fr.greeted || far ? 3 : 0.8, 'toPika'],
      [2, 'sit'],
    ]);
    if (act === 'hop') {
      await this._friendWalkTo(fr, fr.x + rnd(0.5, 1.5) * pW * pick([-1, 1]), 0.9, w);
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
  // wenn Pino weg ist oder gehen will.
  async _withFriend(fn) {
    let fr = this._fr;
    for (let i = 0; fr && !fr.arrived && i < 40; i++) {
      await this._wait(200);
      fr = this._fr;
    }
    if (!fr || !fr.arrived || fr.leaving) return;
    fr.busy = true;
    this._frTake(fr);
    this._friendSettle(fr);
    const w = async (ms) => {
      await this._wait(ms);
      if (this._fr !== fr || fr.leaving) throw new Cancel();
    };
    try {
      if (fr.lift > 0) await this._frHopDown(fr, w);
      await fn(fr, w);
    } finally {
      this._el.pika.classList.remove('nuzzle', 'wiggle');
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
    const lo = Math.max(home + pW * 0.8, stash ? 0 : hay + this._H * 0.13 + pW * FRIEND_SCALE * 0.3);
    // Rechts wie beim Pika (xR) ganz im Bild bleiben
    return [lo, Math.max(lo, this._W - pW * FRIEND_SCALE * 0.45)];
  }

  // free: ohne Begrenzung auf die Wiese (herein- und hinaushoppeln)
  async _friendWalkTo(fr, x, speed = 1, w, free = false) {
    const { pW } = this._g;
    if (!free) {
      const [lo, hi] = this._frRange();
      x = clamp(x, lo, hi);
    }
    const dx = x - fr.x;
    if (Math.abs(dx) < 4) return;
    this._frFace(fr, dx > 0 ? 1 : -1);
    // ganze Hopser wie beim Pika (_walkTo): Pino landet am Boden
    const dur = hopRound((Math.abs(dx) / (pW * 0.85 * speed)) * 1000, HOP_MS.hop) / 1000;
    this._frSetX(fr, x, dur * 1000);
    fr.el.classList.add('walking');
    await w(dur * 1000);
    fr.el.classList.remove('walking');
  }

  async _frHop(fr, x, lift, w) {
    if (Math.abs(x - fr.x) > 2) this._frFace(fr, x > fr.x ? 1 : -1);
    fr.el.classList.add('crouch');
    await w(180);
    fr.el.classList.remove('crouch');
    this._frSetX(fr, x, 550, 'cubic-bezier(.3, .6, .4, 1)', lift);
    this._frJump(fr, 'hop1', true);
    await w(620);
  }

  async _frHopDown(fr, w) {
    const { rock, pW, gy } = this._g;
    const side = fr.x >= rock.cx && this._footX(1) ? 1 : -1;
    await this._frHop(fr, rock.cx + side * (rock.w / 2 + pW * 0.1), 0, w);
    this._puff(fr.x, gy, 2);
  }

  // Pino nach x (und Höhe lift) bewegen, ms = Dauer der Überblendung (0 = sofort). Die Bewegung wird
  // mitgeschrieben, damit _frLive weiß, wo er gerade ist – auch wenn der Browser gerade nichts zeichnet.
  _frSetX(fr, x, ms = 0, ease = 'linear', lift = fr.lift) {
    const from = this._frLive(fr);
    fr.x = x;
    fr.lift = lift;
    fr.mv = ms > 0 ? { ...from, x1: x, l1: lift, t0: performance.now(), ms } : null;
    for (const s of [fr.el.style, fr.sw.style]) {
      s.transition = ms > 0 ? `transform ${Math.round(ms)}ms ${ease}` : 'none';
      s.transform = `translate(${(x - (this._g.pW * FRIEND_SCALE) / 2).toFixed(1)}px, ${(-lift).toFixed(1)}px)`;
    }
    if (!(ms > 0)) void fr.el.offsetWidth;
    this._bubbleFit(fr.say, x, this._g.pW * FRIEND_SCALE);
  }

  // Wo Pino gerade wirklich steht (beim Hoppeln ist fr.x schon das Ziel)
  _frLive(fr) {
    const m = fr.mv;
    if (!m) return { x: fr.x, lift: fr.lift };
    const k = clamp((performance.now() - m.t0) / m.ms, 0, 1);
    return { x: m.x + (m.x1 - m.x) * k, lift: m.lift + (m.l1 - m.lift) * k };
  }

  // Anhalten, wo er gerade ist, Haltungen zurücksetzen
  _friendSettle(fr) {
    const live = this._frLive(fr);
    this._frSetX(fr, live.x, 0, 'linear', live.lift < 1 ? 0 : live.lift);
    fr.el.classList.remove(...FRIEND_CLS);
    fr.mfood?.classList.remove('shrink');
  }

  _frFace(fr, dir) {
    fr.dir = dir;
    fr.el.classList.toggle('left', dir < 0);
    fr.sw.classList.toggle('left', dir < 0);
    this._bubbleFit(fr.say, fr.x, this._g.pW * FRIEND_SCALE);
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
    const fW = pW * FRIEND_SCALE;
    const fH = pH * FRIEND_SCALE;
    const live = this._frLive(fr);
    const x = live.x + fr.dir * fW * 0.25;
    const y = gy - fH * 0.945 + fH * 0.25 - live.lift;
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
    m.classList.remove('shrink');
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
  async _frMeet(fr, w, speed = 1) {
    const { pW } = this._g;
    const gap = pW * 0.5;
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
    this._memo('pino');
    await this._withFriend(async (fr, w) => {
      const P = this._el.pika.classList;
      this._face(fr.x >= this._x ? 1 : -1);
      P.add('look-f');
      this._say(`${this._frName()}!`, 1600);
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

  // Fangen: abwechselnd hoppelt einer davon, der andere hinterher, mit Staubwölkchen
  async _chaseFriend() {
    await this._withFriend(async (fr, w) => {
      const { pW, gy } = this._g;
      const [lo, hi] = this._frRange();
      const mid = (lo + hi) / 2;
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      this._frSay(fr, 'fang mich!', 1400);
      this._frJump(fr, 'hop1');
      await w(800);
      const pino = (x, speed, delay) => (async () => {
        if (delay) await w(delay);
        await this._friendWalkTo(fr, x, speed, w, true);
      })();
      const pika = (x, speed, delay) => (async () => {
        if (delay) await w(delay);
        await this._walkTo(x, speed);
      })();
      const rounds = 3 + Math.floor(rnd(0, 3));
      for (let i = 0; i < rounds; i++) {
        const pinoRuns = i % 2 === 0;
        const rx = pinoRuns ? fr.x : this._x;
        const cx = pinoRuns ? this._x : fr.x;
        // weg vom Fänger (chaseFar): nach der Seite, auf der der Läufer von ihm aus steht. Bisher zählte nur, auf
        // welcher Hälfte der Fänger stand, die erste Runde führte darum oft mitten durch ihn hindurch. Ist am Rand
        // kein Platz mehr, rennt der Läufer an ihm vorbei auf die andere Seite.
        const far = chaseFar(rx, cx, lo, hi, pW);
        // Ziel im äußeren Drittel der Fluchtseite, mindestens eine Pika-Breite weiter als der Läufer schon steht
        const T = clamp(far ? rnd(Math.max(rx + pW, mid + (hi - mid) * 0.4), hi) : rnd(lo, Math.min(rx - pW, mid - (mid - lo) * 0.4)), lo, hi);
        const d = T > rx ? 1 : -1;
        const C = clamp(T - d * pW * 0.7, lo, hi);
        const speed = rnd(1.9, 2.4);
        this._puff(fr.x, gy, 2);
        this._puff(this._x, gy, 2);
        await Promise.all(pinoRuns ? [pino(T, speed, 0), pika(C, speed, 280)] : [pika(T, speed, 0), pino(C, speed, 280)]);
        this._puff(T, gy, 2);
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
    });
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
      this._say(`tschüss, ${this._frName()}!`, 1500);
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
