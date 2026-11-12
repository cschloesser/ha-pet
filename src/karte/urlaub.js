// Urlaub bei Pino: Schalter (im Tagebuch), was ruht, Abreise und Rückkehr in der Szene, Schild und Postkarte

import { pick, rnd } from '../logik/hilfen.js';
import { sec } from '../logik/zustand.js';
import { PLAN_MIN, urOn } from '../logik/tagesplan.js';
import { URLAUB, urlaubEnd } from '../logik/urlaub.js';
import { URLAUB_SIGN, URLAUB_CARD } from '../grafik/urlaub.js';

export class Urlaub {
  // Fahren alle weg, besucht er so lange seinen Freund. Eingeschaltet wird das im Tagebuch, es gilt für alle Geräte
  // (Tagesplan, Feld ur). Solange er weg ist, ruhen Satt, Glück, Häufchen, Pflege-Serie und Vorrat: Der Abbau rechnet
  // die Urlaubszeit heraus (_decayH), die Häufchen bleiben auf dem Stand vom Beginn (_poops), die Serie wartet
  // (_careEval). Bei der Rückkehr rücken Fortschritt und Toleranz der Serie um die Urlaubszeit (voff), und der Zustand
  // wird neu angesetzt: dieselben Werte wie bei der Abreise, alles sauber.

  // Läuft gerade ein Urlaub?
  _urlaubOn() {
    return urOn(this._plan);
  }

  // Urlaub vorbei, aber der Zustand im Helfer ist noch der von vorher (das Neuansetzen ist unterwegs oder ging
  // verloren): Bis es da ist, ruht die Serie noch, die Werte rechnen die Urlaubszeit weiter heraus
  _urlaubStale() {
    const ur = this._plan?.ur;
    const st = this._stats;
    if (!ur || ur.d == null || !st) return false;
    const end = urlaubEnd(ur);
    return st.st < end || st.gt < end || st.c < end;
  }

  // Darf dieses Gerät den Schalter zeigen? Nicht mit vacation: false, nicht ohne Tagebuch, und nur, wenn der Urlaub dort
  // gilt, wo auch der Zustand liegt: Mit Zustand in HA braucht es den Tagesplan in HA (sonst wäre er nur auf diesem
  // Gerät verreist, und die anderen ließen ihn hungern).
  _urlaubMay() {
    const c = this._cfg;
    if (c.vacation === false || c.diary === false || !this._planOk || this._planNewer) return false;
    if (!c.plan_entity) return !c.entity;
    return !!this._hass?.states[c.plan_entity] && this._planMax() >= PLAN_MIN;
  }

  // Ein Päckchen fliegt noch oder liegt noch verpackt: erst auspacken
  _urlaubBusy() {
    const G = this._plan?.gift;
    return !!G && G.z > G.o;
  }

  // Schalter: verreisen
  _urlaubStart() {
    if (!this._urlaubMay() || this._urlaubOn() || this._urlaubBusy()) return false;
    // Was bis jetzt verdient ist und ob eine Warnung läuft, steht damit fest
    this._careEval();
    this._planOp({ t: 'von', t0: sec(this._haNow()) });
    this._urlaubFromPlan();
    return this._urlaubOn();
  }

  // Schalter: zurückholen
  _urlaubEnde() {
    const P = this._plan;
    if (!this._urlaubOn()) return false;
    const now = sec(this._haNow());
    const t0 = P.ur.t;
    const d = Math.max(0, now - t0);
    // (der Vorrat: Anker um die Urlaubszeit weiter, aber nie über jetzt hinaus)
    const op = { t: 'voff', t0, d, ht: P.hay.t < t0 ? Math.min(now, P.hay.t + d) : P.hay.t };
    // Fortschritt zum nächsten Päckchen und schon verbrauchte Toleranz: dieselbe Wachzeit wie bei der Abreise, nur
    // jetzt bis zur Rückkehr gerechnet
    const G = P.gift;
    if (G?.p != null) op.gp = sec(this._awakeBack(now, this._awakeMs(G.p, t0)));
    if (G?.b != null) op.gb = sec(this._awakeBack(now, this._awakeMs(G.b, t0)));
    this._planOp(op);
    this._urlaubRebase();
    this._urlaubFromPlan();
    return true;
  }

  // Wann vor t genau ms Wachzeit beginnen (Umkehrung von _awakeMs für ein festes Ende)
  _awakeBack(t, ms) {
    if (!(ms > 0)) return t;
    let lo = t - ms;
    for (let i = 0; i < 400 && this._awakeMs(lo, t) < ms; i++) lo -= 864e5;
    let hi = t;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (this._awakeMs(m, t) > ms) lo = m;
      else hi = m;
    }
    return hi;
  }

  // Nach der Rückkehr den Zustand neu ansetzen: die Werte von der Abreise (der Abbau lässt die Urlaubszeit aus), alle
  // Zeiten jetzt, alles sauber. Jedes Gerät, das den alten Stand noch sieht, tut es (dasselbe Ergebnis).
  _urlaubRebase() {
    if (!this._urlaubStale()) return;
    if (this._cfg.entity && !this._noEntity && !this._synced) return;
    const t = sec(this._haNow());
    const s = this._raw('s');
    const g = this._raw('g');
    this._stats = { ...this._stats, s, st: t, g, gt: t, c: t, m: 0, l: t };
    this._rawM = null;
    this._poopCache = null;
    this._save();
    this._renderStats();
  }

  // Plan geändert: Schild und Postkarte nachziehen, die Schleife umlenken, einen überschriebenen Urlaub wieder
  // eintragen, ein lange bekanntes Ende wegräumen
  _urlaubFromPlan() {
    if (!this._el) return;
    const on = this._urlaubOn();
    // Was im Helfer stand (nicht der eigene, zusammengesetzte Plan): Fehlt dort ein laufender Urlaub, den dieses Gerät
    // eben noch dort gesehen hat, ohne dass irgendwo ein Ende stand, hat ihn ein Gerät mit älterer Karte in derselben
    // Sekunde überschrieben (es kennt den Urlaub nicht). Dann wieder eintragen.
    const B = this._cfg.plan_entity ? this._planBase?.ur : null;
    if (B && B.d == null) this._urSeen = { t: B.t, at: Date.now() };
    else if (B) this._urSeen = null;
    else if (this._urSeen && !on && this._planOk) {
      const S = this._urSeen;
      this._urSeen = null;
      if (Date.now() - S.at < URLAUB.restore) setTimeout(() => this._planOp({ t: 'von', t0: S.t }), 0);
    }
    if (on !== !!this._urWas) {
      this._urWas = on;
      if (this._running) this._interrupt();
      this._diaryRender(true);
    }
    this._urlaubScene();
    this._urlaubRebase();
  }

  _tickUrlaub() {
    const ur = this._plan?.ur;
    // Ende lange genug bekannt: weg damit (ältere Karten schreiben den Plan danach wieder mit)
    if (ur && ur.d != null && this._haNow() > urlaubEnd(ur) + URLAUB.keep && this._planOk && !this._planNewer) {
      this._planOp({ t: 'vclear', t0: ur.t });
    }
    this._urlaubRebase();
    this._urlaubScene();
  }

  // Postkarte an der Tür: nach einer Rückkehr URLAUB.keep lang, bis dieses Gerät das Tagebuch aufgeschlagen hat
  _urlaubCard() {
    const ur = this._plan?.ur;
    if (!ur || ur.d == null || ur.d < URLAUB.min || this._haNow() > urlaubEnd(ur) + URLAUB.keep) return null;
    try {
      if (localStorage.getItem(`pika-pet-post:${this._cfg.name}`) === String(ur.t)) return null;
    } catch (e) { /* ohne Speicher: bis zum Ablauf zeigen */ }
    return ur;
  }

  _urlaubCardSeen() {
    const ur = this._urlaubCard();
    if (!ur) return;
    try {
      localStorage.setItem(`pika-pet-post:${this._cfg.name}`, String(ur.t));
    } catch (e) { /* egal */ }
    this._urlaubScene();
  }

  // Meer im Sommer, Berge sonst (auf allen Geräten gleich, nach dem Beginn)
  _urlaubSea(ur) {
    const m = new Date(ur.t).getMonth();
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    return (south ? [11, 0, 1] : [5, 6, 7]).includes(m);
  }

  // Schild und Postkarte an der Tür
  _urlaubScene() {
    if (!this._el || !this._g) return;
    const { hole } = this._g;
    const H = this._H;
    const on = this._urlaubOn();
    let el = this._el.ursign;
    if (on && !el) {
      el = document.createElement('div');
      el.className = 'ursign in';
      el.innerHTML = URLAUB_SIGN(this._frName());
      this._el.gifts.appendChild(el);
      this._el.ursign = el;
      setTimeout(() => el.classList.remove('in'), 800);
    } else if (!on && el) {
      this._el.ursign = null;
      el.classList.add('out');
      setTimeout(() => el.remove(), 900);
      el = null;
    }
    if (el) {
      const w = Math.min(H * 0.24, (hole.r - hole.l) * 1.25);
      el.style.width = `${w.toFixed(1)}px`;
      el.style.left = `${(hole.cx - w / 2).toFixed(1)}px`;
      el.style.top = `${(hole.top + (hole.lip - hole.top) * 0.18).toFixed(1)}px`;
    }
    const ur = on ? null : this._urlaubCard();
    let pc = this._el.urcard;
    if (ur && !pc) {
      pc = document.createElement('div');
      pc.className = 'urcard in';
      pc.innerHTML = URLAUB_CARD(this._urlaubSea(ur));
      this._el.gifts.appendChild(pc);
      this._el.urcard = pc;
    } else if (!ur && pc) {
      this._el.urcard = null;
      pc.classList.add('out');
      setTimeout(() => pc.remove(), 900);
      pc = null;
    }
    if (pc) {
      const w = H * 0.15;
      pc.style.width = `${w.toFixed(1)}px`;
      pc.style.left = `${(hole.cx + (hole.r - hole.cx) * 0.2 - w / 2).toFixed(1)}px`;
      pc.style.top = `${(hole.top + (hole.lip - hole.top) * 0.3).toFixed(1)}px`;
    }
  }

  // Das Schild sagt etwas (Futterknopf, Tür, Päckchen-Knopf im Urlaub)
  _urlaubPeep() {
    const el = this._el?.ursign;
    if (!el) return;
    el.classList.remove('wig');
    void el.offsetWidth;
    el.classList.add('wig');
    const r = el.getBoundingClientRect();
    const s = this._el.scene.getBoundingClientRect();
    this._peep(r.left - s.left + r.width / 2, r.top - s.top, `Bin bei ${this._frName()}!`);
  }

  // Tür angetippt: im Urlaub Schild und Tagebuch, nach der Rückkehr die Postkarte. → true, wenn das die Antwort war
  _urlaubDoor() {
    if (this._urlaubOn()) {
      this._urlaubPeep();
      if (this._diaryOn()) setTimeout(() => this._diaryOpen('heute'), 500);
      return true;
    }
    if (this._el?.urcard && this._diaryOn()) {
      this._diaryOpen('heute');
      return true;
    }
    return false;
  }

  // ---------- Schleife ----------

  // Welche Aktion die Schleife wählt, solange er verreist ist oder eben zurückkommt (null: wie sonst)
  _urlaubNext() {
    if (this._urlaubOn()) return this._fort ? 'urlFort' : 'urlAbreise';
    return this._fort ? 'urlHeim' : null;
  }

  // Abreise: Hat es eben erst angefangen und schaut jemand zu, winkt er und hoppelt aus dem Bild (zu Pino). Sonst
  // (Neuladen mitten im Urlaub, er schlief, im Bau) ist er einfach weg.
  async _urlAbreise() {
    const p = this._el.pika;
    const fresh = this._haNow() - this._plan.ur.t < 2 * 6e4;
    if (!fresh || this._asleep || this._inside || this._sleepTime()) return this._urlaubWeg();
    try {
      // auf dem Stein (oder in der Hängematte): erst herunter
      if (this._lift > 0) await (this._onHam ? this._giftHamDown() : this._hopDown());
      this._face(this._x < this._W / 2 ? -1 : 1);
      this._say(pick([`Ich besuche ${this._frName()}!`, 'Bis bald!', 'Tschüss!']), 1800);
      p.classList.add('waving');
      await this._wait(1600);
      p.classList.remove('waving');
      this._jump('hop1');
      await this._wait(400);
      const side = this._x < this._W / 2 ? -1 : 1;
      await this._urlaubLauf(side < 0 ? -this._g.pW : this._W + this._g.pW);
    } finally {
      p.classList.remove('waving');
      this._urlaubWeg();
    }
  }

  _urlaubWeg() {
    this._fort = true;
    this._el.pika.classList.add('fort');
    this._el.psay?.classList.add('fort');
  }

  // Weg: nur warten (eine Änderung des Plans weckt die Schleife)
  async _urlFort() {
    await this._wait(60000);
  }

  // Zurück: Er hoppelt von der Seite herein und freut sich (nachts liegt er gleich wieder im Bau)
  async _urlHeim() {
    const p = this._el.pika;
    this._fort = false;
    this._el.psay?.classList.remove('fort');
    if (this._sleepTime()) {
      this._sleepNow(true);
      p.classList.remove('fort');
      return;
    }
    if (this._asleep || this._inside) this._sleepNow(false);
    const side = Math.random() < 0.5 ? -1 : 1;
    this._setX(side < 0 ? -this._g.pW : this._W + this._g.pW, true);
    p.classList.remove('fort');
    await this._urlaubLauf(this._W * rnd(0.4, 0.55));
    this._face(1);
    p.classList.add('waving');
    this._say('Da bin ich wieder!', 2200, true);
    this._blush(3000);
    await this._wait(1700);
    p.classList.remove('waving');
    this._jump('binky');
    this._hearts(3);
    await this._wait(1200);
  }

  // Geradeaus laufen, auch über den Rand hinaus (_walkTo bleibt auf der Wiese)
  async _urlaubLauf(x) {
    const p = this._el.pika;
    const dist = Math.abs(x - this._x);
    if (dist < 4) return;
    const dur = dist / (this._g.pW * 0.85 * 1.4);
    this._face(x > this._x ? 1 : -1);
    p.style.transition = `transform ${dur.toFixed(2)}s linear`;
    this._setX(x);
    p.classList.add('walking');
    try {
      await this._wait(dur * 1000);
    } finally {
      p.classList.remove('walking');
    }
  }
}
