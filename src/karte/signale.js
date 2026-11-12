// Haus-Signale: Mülltonne, Garderobe, Saugroboter, Haustür – lesen, zeigen, daran erinnern

import { rnd, pick } from '../logik/hilfen.js';
import { MEM_TONNE, MEM_TONNE2, pikaDay } from '../logik/tagesplan.js';
import { BOTE_FRONT_DY } from '../logik/haus-bote.js';
import { SIG, binPlan, binDone, wardrobePick, WARD_SAY, vacMode } from '../logik/signale.js';
import { SIG_BIN, SIG_VAC, SIG_WEAR } from '../grafik/signale.js';

export class Signale {
  // Konfiguration `signals`: { waste: calendar.*, wardrobe: true, vacuum: vacuum.*, door: binary_sensor.* }. Alles ist
  // aus, solange nichts eingetragen ist. Was alle Geräte gleich zeigen sollen, folgt aus den Zuständen in HA; nur
  // „Tonne steht draußen“ steht im Tagesplan (Bit MEM_TONNE, siehe logik/signale.js).

  _sigCfg() {
    const s = this._cfg?.signals;
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  }

  // Bei jedem hass: nur, was sich geändert hat
  _hassSig(hass) {
    const c = this._sigCfg();
    const S = hass.states;
    const w = c.waste ? S[c.waste] : undefined;
    if (w !== this._sigW) {
      this._sigW = w;
      this._sigBinSync();
    }
    if (c.wardrobe) this._sigFcSub(hass);
    else if (this._sigFcId) this._sigFcStop();
    const v = c.vacuum ? S[c.vacuum] : undefined;
    if (v !== this._sigV) {
      this._sigV = v;
      this._sigVacSync();
    }
    const d = c.door ? S[c.door] : undefined;
    if (d !== this._sigD) {
      const prev = this._sigD;
      this._sigD = d;
      if (prev && d?.state === 'on' && prev.state !== 'on') this._sigDoorOpen(d);
    }
  }

  _attachSig() {
    this._sigBinSync();
    this._sigWearSync();
    this._sigVacSync();
  }

  _detachSig() {
    this._sigFcStop();
    clearTimeout(this._sigVacT);
  }

  _hiddenSig(hidden) {
    if (hidden) clearTimeout(this._sigVacT);
    else this._sigVacSync(true);
  }

  _layoutSig() {
    this._sigBinSync(true);
    this._sigWearSync(true);
    this._sigVacSync(true);
  }

  _tickSig() {
    this._sigBinSync();
    this._sigWearSync();
  }

  // Wach, zu sehen und nicht verreist: Dann erinnert er
  _sigAwake() {
    return !!this._g && !this._asleep && !this._fort && !this._urlaubOn() && !this._away();
  }

  // Zusatz-Aktionen für die Auswahl in _step
  _sigActs() {
    if (!this._sigAwake()) return [];
    const now = this._haNow();
    const acts = [];
    if (this._el.sigbin && now >= (this._sigBinAt || 0)) acts.push([6, 'sigBinNudge']);
    if (this._sigWearEls?.size && now >= (this._sigWearAt || 0)) acts.push([3, 'sigWear']);
    const V = this._sigVac;
    if (V?.mode === 'drive' && !V.hold && now - (this._sigRideAt || 0) > SIG.rideGap) acts.push([4, 'sigRide']);
    if (V?.mode === 'stuck' && now - (this._sigPushAt || 0) > SIG.rideGap) acts.push([5, 'sigPush']);
    return acts;
  }

  // Bodenlinie vorn (wie die Haushaltsgeräte)
  _sigGround() {
    return this._g.gy + BOTE_FRONT_DY * this._H;
  }

  // ---------- Mülltonne ----------

  // Steht die Tonne heute da? → Abholung (binPlan) oder null
  _sigBin() {
    const st = this._sigW;
    if (!st || this._urlaubOn()) return null;
    const now = this._haNow();
    const P = binPlan(st, now);
    if (!P || now < P.from) return null;
    return binDone(this._plan?.cute, pikaDay(P.from), pikaDay(P.at), MEM_TONNE | MEM_TONNE2) ? null : P;
  }

  _sigBinSync(relayout = false) {
    if (!this._el || !this._g) return;
    const P = this._sigBin();
    let el = this._el.sigbin;
    const H = this._H;
    if (P && !el) {
      el = document.createElement('div');
      el.className = 'sig-bin in';
      el.setAttribute('role', 'button');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._sigBinOut();
      });
      this._keyTap(el);
      this._el.props.appendChild(el);
      this._el.sigbin = el;
      setTimeout(() => el.classList.remove('in'), 700);
      // Gerade aufgetaucht und jemand schaut zu: gleich hinhoppeln
      this._sigBinAt = this._haNow() + rnd(5000, 15000);
      relayout = true;
    } else if (!P && el) {
      this._el.sigbin = null;
      el.classList.add('out');
      setTimeout(() => el.remove(), 700);
      this._sigBinW = 0;
      this._boteLayout?.();
      return;
    }
    if (!el) return;
    if (el.dataset.k !== P.kind) {
      el.dataset.k = P.kind;
      el.innerHTML = SIG_BIN(P.color);
    }
    el.setAttribute('aria-label', `${P.name}: Tonne rausstellen (antippen, wenn sie draußen steht)`);
    el.title = `${P.name} · antippen, wenn sie draußen steht`;
    if (!relayout && el.style.width) return;
    const h = H * 0.2;
    const w = h * 0.75;
    const x = this._W - w - 0.02 * H;
    Object.assign(el.style, { width: `${w.toFixed(1)}px`, left: `${x.toFixed(1)}px`, top: `${(this._sigGround() - h * 0.97).toFixed(1)}px` });
    el._x = x + w / 2;
    // Die Haushaltsgeräte rücken nicht darunter
    this._sigBinW = w + 0.03 * H;
    this._boteLayout?.();
  }

  // Angetippt: steht draußen. Gilt auf allen Geräten (Tagesplan), bis zur Abholung.
  _sigBinOut() {
    const el = this._el?.sigbin;
    if (!el) return;
    this._planOp({ t: 'mem', d: pikaDay(this._haNow()), b: MEM_TONNE });
    this._sigBinSync();
    if (this._sigAwake() && this._running) this._say(pick(['danke!', 'steht draußen!', 'super!']), 1300);
  }

  // Erinnern: hinhoppeln, die Tonne anstupsen, zum Betrachter schauen
  async _sigBinNudge() {
    const el = this._el.sigbin;
    const P = this._sigBin();
    this._sigBinAt = this._haNow() + rnd(...SIG.binNudge);
    if (!el || !P) return;
    const p = this._el.pika;
    await this._walkTo(el._x - this._g.pW * 0.75, 1.3);
    this._face(1);
    await this._wait(300);
    for (let i = 0; i < 2; i++) {
      el.classList.remove('boop');
      void el.offsetWidth;
      el.classList.add('boop');
      this._cls('hb-pat', 450, true);
      await this._wait(520);
    }
    this._face(-1);
    p.classList.add('calling');
    this._say(pick(['Tonne raus!', 'Müllabfuhr!', `${P.name}!`]), 1700);
    this._jump('hop1');
    try {
      await this._wait(1700);
    } finally {
      p.classList.remove('calling');
    }
  }

  // ---------- Garderobe ----------

  // Stündliche Vorhersage abonnieren (wie die Wetter-Karte von HA). Ohne Verbindung (Vorschau) bleibt _sigFc leer.
  _sigFcSub(hass) {
    const id = this._cfg.weather_entity;
    if (this._sigFcId === id) return;
    this._sigFcStop();
    this._sigFcId = id;
    const conn = hass.connection;
    if (!id || typeof conn?.subscribeMessage !== 'function') return;
    try {
      const p = conn.subscribeMessage((m) => {
        this._sigFc = Array.isArray(m?.forecast) ? m.forecast : [];
        this._sigWearSync();
      }, { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: id });
      this._sigFcUn = p;
      Promise.resolve(p).catch((e) => console.debug('pika-pet-card: Vorhersage nicht abonnierbar', e));
    } catch (e) {
      console.debug('pika-pet-card: Vorhersage nicht abonnierbar', e);
    }
  }

  _sigFcStop() {
    const p = this._sigFcUn;
    this._sigFcUn = null;
    this._sigFcId = null;
    if (p) Promise.resolve(p).then((u) => typeof u === 'function' && u()).catch(() => {});
  }

  // Was heute an der Tür hängt (SIG.ward von bis), oder nichts
  _sigWearNow() {
    if (!this._sigCfg().wardrobe || this._urlaubOn()) return [];
    const now = this._haNow();
    const h = new Date(now).getHours();
    if (h < SIG.ward[0] || h >= SIG.ward[1]) return [];
    return wardrobePick(this._dbgForecast || this._sigFc, now);
  }

  _sigWearSync(relayout = false) {
    if (!this._el || !this._g) return;
    const want = this._sigWearNow();
    const E = (this._sigWearEls ??= new Map());
    for (const [k, el] of E) {
      if (want.includes(k)) continue;
      E.delete(k);
      el.classList.add('out');
      setTimeout(() => el.remove(), 700);
    }
    let fresh = false;
    for (const k of want) {
      if (E.has(k)) continue;
      const el = document.createElement('div');
      el.className = `sig-wear sig-${k} in${k === 'boots' ? '' : ' hang'}`;
      el.innerHTML = SIG_WEAR[k];
      this._el.gifts.appendChild(el);
      E.set(k, el);
      setTimeout(() => el.classList.remove('in'), 700);
      fresh = true;
    }
    if (fresh) this._sigWearAt = Math.min(this._sigWearAt || Infinity, this._haNow() + rnd(10000, 30000));
    if (!fresh && !relayout) return;
    // Plätze: Stiefel links neben der Tür am Boden, das andere hängt links oben am Türrahmen nebeneinander
    const { hole } = this._g;
    const H = this._H;
    const size = { boots: 0.1, umbrella: 0.05, hat: 0.075, sunhat: 0.1 };
    const ratio = { boots: 20 / 26, umbrella: 30 / 12, hat: 26 / 24, sunhat: 16 / 28 };
    let hx = hole.l - 0.01 * H;
    for (const k of ['boots', 'umbrella', 'hat', 'sunhat']) {
      const el = E.get(k);
      if (!el) continue;
      const w = H * size[k];
      const h = w * ratio[k];
      let left;
      let top;
      if (k === 'boots') {
        left = hole.l - w * 0.95;
        top = hole.lip - h * 0.92;
      } else {
        hx -= w;
        left = hx;
        top = hole.top + (hole.lip - hole.top) * 0.08;
        hx -= 0.01 * H;
      }
      Object.assign(el.style, { width: `${w.toFixed(1)}px`, left: `${left.toFixed(1)}px`, top: `${top.toFixed(1)}px` });
    }
  }


  // Probiert, was an der Tür hängt: hinhoppeln, eins hochhalten, sagen, was man heute braucht
  async _sigWear() {
    const E = this._sigWearEls;
    this._sigWearAt = this._haNow() + rnd(20, 40) * 6e4;
    if (!E?.size) return;
    const [k, el] = [...E][Math.floor(Math.random() * E.size)];
    const { hole, pW, pH, gy } = this._g;
    await this._walkTo(hole.l - pW * 0.2, 1.2);
    this._face(-1);
    await this._wait(400);
    const hold = document.createElement('div');
    hold.className = 'sig-hold';
    hold.innerHTML = SIG_WEAR[k];
    const w = this._H * 0.09;
    Object.assign(hold.style, { width: `${w.toFixed(1)}px`, left: `${(this._x - w / 2).toFixed(1)}px`, top: `${(gy - pH * 1.15 - w).toFixed(1)}px` });
    el.style.opacity = '0';
    this._el.fx.appendChild(hold);
    try {
      this._face(1);
      this._mimik('proud', 1600);
      this._say(pick(WARD_SAY[k]), 1800);
      this._jump('hop1');
      await this._wait(2200);
    } finally {
      hold.remove();
      el.style.opacity = '';
    }
  }

  // ---------- Saugroboter ----------

  // Zustand des Saugers → Roboter vorn auf der Wiese: fährt hin und her, fährt heim (aus dem Bild), steht, steckt fest
  _sigVacSync(relayout = false) {
    if (!this._el || !this._g) return;
    const st = this._sigV;
    const dead = !st || ['unavailable', 'unknown'].includes(st.state);
    const mode = dead ? this._sigVac?.mode ?? null : vacMode(st.state);
    let V = this._sigVac;
    if (!mode) {
      if (V) {
        this._sigVac = null;
        clearTimeout(this._sigVacT);
        V.el.classList.add('out');
        setTimeout(() => V.el.remove(), 700);
        if (this._action === 'sigRide' || this._action === 'sigPush') this._interrupt();
      }
      return;
    }
    const H = this._H;
    const w = H * 0.17;
    const h = w * (18 / 44);
    if (!V) {
      const el = document.createElement('div');
      el.className = 'sig-vac';
      el.innerHTML = `<i>${SIG_VAC}</i>`;
      this._el.props.appendChild(el);
      // kommt von links aus der Station
      V = this._sigVac = { el, mode: null, x: -w, dir: 1, w, hold: false };
      this._sigVacPos(V, -w, 0);
      relayout = true;
    }
    V.w = w;
    V.top = this._sigGround() - h * 0.95;
    V.el.style.width = `${w.toFixed(1)}px`;
    V.el.style.top = `${V.top.toFixed(1)}px`;
    const changed = V.mode !== mode;
    V.mode = mode;
    for (const m of ['drive', 'home', 'stop', 'stuck']) V.el.classList.toggle(m, m === mode);
    if ((changed || relayout) && !V.hold) this._sigVacMove();
  }

  // Wo der Roboter gerade ist (mitten in einer Fahrt aus der Zeit gerechnet)
  _sigVacNow(V) {
    if (!V.to) return V.x;
    const k = Math.min(1, (Date.now() - V.at) / Math.max(1, V.ms));
    return V.from + (V.to - V.from) * k;
  }

  _sigVacPos(V, x, ms) {
    V.from = ms ? this._sigVacNow(V) : x;
    V.to = x;
    V.at = Date.now();
    V.ms = ms;
    V.x = x;
    V.el.style.transition = ms ? `left ${(ms / 1000).toFixed(2)}s linear` : 'none';
    V.el.style.left = `${x.toFixed(1)}px`;
    V.el.classList.toggle('flip', V.dir < 0);
  }

  // Nächste Fahrt: hin und her zwischen Bau und Stein (gemächlich, ein Fünftel der Kartenhöhe je Sekunde), heim nach
  // links aus dem Bild, sonst stehen bleiben, wo er gerade ist
  _sigVacMove() {
    const V = this._sigVac;
    clearTimeout(this._sigVacT);
    if (!V || !this._g) return;
    const cur = this._sigVacNow(V);
    const speed = this._H * 0.2 / 1000;
    if (V.mode === 'drive' && !this._away()) {
      const a = this._g.fMin * this._W * 0.5;
      const b = this._W - V.w - (this._sigBinW || 0) - 0.03 * this._H;
      let to = V.dir > 0 ? b : a;
      if (Math.abs(to - cur) < 4) {
        V.dir = -V.dir;
        to = V.dir > 0 ? b : a;
      }
      V.dir = to > cur ? 1 : -1;
      const ms = Math.abs(to - cur) / speed;
      this._sigVacPos(V, to, ms);
      // an der Wand kurz warten, dann umdrehen
      this._sigVacT = setTimeout(() => {
        V.dir = -V.dir;
        this._sigVacMove();
      }, ms + rnd(800, 2500));
    } else if (V.mode === 'home') {
      V.dir = -1;
      const to = -V.w - 4;
      this._sigVacPos(V, to, Math.abs(to - cur) / speed);
    } else this._sigVacPos(V, cur, 0);
  }

  // Mitfahren: Der Roboter hält an, er hoppelt hin, springt auf, beide fahren ein Stück, er springt ab
  async _sigRide() {
    const V = this._sigVac;
    this._sigRideAt = this._haNow();
    if (!V || V.mode !== 'drive') return;
    const p = this._el.pika;
    const { pW, gy } = this._g;
    V.hold = true;
    clearTimeout(this._sigVacT);
    this._sigVacPos(V, this._sigVacNow(V), 0);
    let on = false;
    try {
      const vx = V.x + V.w / 2;
      const side = this._x < vx ? -1 : 1;
      await this._walkTo(vx + side * pW * 0.7, 1.4);
      this._face(-side);
      this._say(pick(['hopp!', 'mitfahren!', 'oh!']), 1000);
      await this._wait(500);
      // Mit depth steht er vorn auf der Scheibe (Oberkante bei 7 von 18 der Grafik), vor dem Roboter und allem
      // anderen (_reiter, Rang reiter); ohne steht er wie bisher knapp über der Kuppel, hinter dem Roboter.
      this._reiter = !!this._cfg.depth;
      // Die Scheibe liegt auf dem vorderen Wiesenstreifen, unter der Bodenlinie: dann ist die Höhe negativ (er steht tiefer)
      await this._hopTo(vx, this._reiter ? gy - (V.top + V.w * (18 / 44) * (7 / 18)) : Math.max(0, gy - V.top) + this._H * 0.02);
      on = true;
      this._say(pick(['juhu!', 'wiii!', 'brumm brumm!']), 1600);
      const to = vx < this._W / 2 ? this._W * 0.7 : this._W * 0.3;
      const ms = Math.abs(to - vx) / (this._H * 0.2 / 1000);
      V.dir = to > vx ? 1 : -1;
      this._face(V.dir);
      this._sigVacPos(V, to - V.w / 2, ms);
      p.style.transition = `transform ${(ms / 1000).toFixed(2)}s linear`;
      this._setX(to);
      p.classList.add('happy');
      await this._wait(ms);
      p.classList.remove('happy');
      await this._hopTo(to + V.dir * pW * 0.8, 0);
      on = false;
      // unten angekommen: zurück auf die Bühne der Bodenlinie
      this._reiter = false;
      this._pikaZ();
      this._say(pick(['nochmal!', 'lustig!', 'hihi']), 1200);
      await this._wait(900);
    } finally {
      this._reiter = false;
      if (on) {
        // unterbrochen, während er oben saß: wieder auf den Boden
        this._lift = 0;
        this._setX(this._x, true);
      } else this._pikaZ();
      p.classList.remove('happy');
      V.hold = false;
      if (this._sigVac === V) this._sigVacMove();
    }
  }

  // Steckt fest: hinhoppeln und anschieben
  async _sigPush() {
    const V = this._sigVac;
    this._sigPushAt = this._haNow();
    if (!V || V.mode !== 'stuck') return;
    const vx = V.x + V.w / 2;
    const side = this._x < vx ? -1 : 1;
    await this._walkTo(vx + side * this._g.pW * 0.6, 1.3);
    this._face(-side);
    for (let i = 0; i < 3; i++) {
      this._cls('hb-pat', 450, true);
      await this._wait(550);
    }
    this._say(pick(['hau ruck!', 'steckt fest!', 'na komm!']), 1500);
    await this._wait(1500);
  }

  // ---------- Haustür ----------

  // Die Haustür ging auf: Ohren spitzen, zum Bildrand schauen. Schläft er, zuckt nur ein Ohr. Höchstens alle
  // SIG.doorGap, nur bei einem frischen Öffnen, nicht im Urlaub.
  _sigDoorOpen(d) {
    const now = this._haNow();
    const t = Date.parse(d.last_changed) || now;
    if (this._urlaubOn() || this._fort || !this._g || now - t > SIG.doorFresh || now - (this._sigDoorAt || 0) < SIG.doorGap) return;
    this._sigDoorAt = now;
    if (this._away()) return;
    if (this._asleep) return void this._cls('stw', 550, true);
    if (this._running && !this._next && ['idle', 'look', 'wander', 'groom', 'squeak', 'curious', 'nibble', 'lookout'].includes(this._action)) {
      this._next = 'sigDoor';
      this._interrupt();
    }
  }

  async _sigDoor() {
    const p = this._el.pika;
    this._face(-1);
    this._cls('stw', 550, true);
    p.classList.add('look-f');
    this._say(pick(['Hallo?', '!', 'wer kommt da?']), 1500);
    try {
      await this._wait(1600);
      if (Math.random() < 0.5) {
        await this._walkTo(this._x - this._g.pW * 0.6, 1.2);
        await this._wait(700);
      }
    } finally {
      p.classList.remove('look-f');
    }
  }
}
