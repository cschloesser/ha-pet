// Himmel: Sonne, Mond, Sterne, Licht der Szene, Sternschnuppen, Glühwürmchen

import { rnd, pick } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { RAD, moonPosition, moonPhase, moonPath, skyPos, SKY } from '../logik/himmel.js';
import { twilight, seasonPos, seasonKey, seasonPal, landColors } from '../logik/wetter.js';
import { festDay } from '../logik/feste.js';
import { FLOWER_SVG } from '../grafik/szene.js';

export class Himmel {
  // Blickrichtung: auf der Südhalbkugel (hass.config.latitude < 0) nach Norden, dann liegt Osten rechts und
  // Westen links (Sonne, Mond, Flugzeuge, Wind). Sonst nach Süden: Osten links, Westen rechts.
  _viewN() {
    return this._hass?.config?.latitude < 0;
  }

  _updateSky() {
    if (!this._el) return;
    const e = this._dbgElev ?? this._elev;
    let mode;
    if (e == null) mode = this._asleep ? 'night' : 'day';
    else if (e > 4) mode = this._asleep ? 'dusk' : 'day';
    else if (e > -5) mode = 'dusk';
    else mode = 'night';
    // Läuft bei jedem hass-Update: Klassen nur bei echter Änderung anfassen (toggle mit force schreibt nur
    // dann), jede Klassenänderung an der Szene lässt den ganzen Baum neu berechnen
    const sc = this._el.scene.classList;
    if (!sc.contains(mode)) {
      sc.remove('day', 'dusk', 'night');
      sc.add(mode);
    }
    const month = new Date(this._dbgDate ?? Date.now()).getMonth();
    sc.toggle('summer', month >= 4 && month <= 8);
    sc.toggle('sun-low', e != null && e < 8);
    sc.toggle('sun-down', e != null && e < -1);
    this._light(mode);

    const az = this._dbgAz ?? this._az;
    const vn = this._viewN();
    // Im Areal alpin stehen Sonne und Mond über dem Grat (skyPos)
    const ridge = this._arealKey === 'alpin';
    if (e != null && az != null) this._place(this._el.sun, skyPos(az, e, vn, ridge));

    // Mond höchstens alle 30 s neu berechnen, er bewegt sich gemächlich
    const now = this._dbgDate ?? Date.now();
    const cfg = this._hass?.config;
    const size = `${this._W}x${this._Hs}`;
    if (cfg && Number.isFinite(cfg.latitude) && (this._dbgDate || !this._moonT || now - this._moonT > 30000 || this._moonRidge !== ridge)) {
      this._moonT = now;
      this._moonRidge = ridge;
      const m = moonPosition(now, cfg.latitude, cfg.longitude);
      const ph = moonPhase(now);
      this._place(this._el.moon, skyPos(m.az, m.alt, vn, ridge));
      const d = moonPath(ph, vn);
      if (d !== this._moonD) this._el.moonLit.setAttribute('d', (this._moonD = d));
      this._moonUp = m.alt > 2 && ph > 0.03 && ph < 0.97;
      this._starOcc();
    } else if (this._starSize !== size) this._starOcc();
    sc.toggle('moon-up', !!this._moonUp);
  }

  // Licht der Szene: Schichten des Himmels, Farben von Hügel und Wiese, Helligkeit auf dem Land, Farben der Blumen.
  // Alles stufenlos aus Sonnenhöhe, Jahreszeit, Wetter und Schneedecke (twilight, seasonPal, landColors). Läuft bei
  // jedem hass-Update: Gerechnet und geschrieben wird nur, wenn sich etwas geändert hat (jede Variable an der Szene
  // lässt den ganzen Baum neu berechnen); Stufen von 1/50 sieht man nicht.
  _light(mode) {
    const E = this._el;
    const cl = E.scene.classList;
    const e = this._dbgElev ?? this._elev;
    mode ??= cl.contains('night') ? 'night' : cl.contains('dusk') ? 'dusk' : 'day';
    // Ohne Sonnenstand richtet sich der Himmel nach der Schlafenszeit. Schläft er bei hoher Sonne (feste
    // Schlafenszeit im Sommer), ist Abend.
    const tw = e == null ? { d: mode === 'day' ? 0 : 1, n: mode === 'night' ? 1 : 0 } : twilight(mode === 'dusk' && e > 4 ? 2 : e);
    const wx = this._wx;
    const L = {
      d: Math.round(tw.d * 50) / 50, n: Math.round(tw.n * 50) / 50,
      grey: wx.cover >= 70 ? 1 : 0, storm: wx.storm ? 1 : 0, snow: wx.snow01 || 0,
    };
    const south = this._viewN();
    const at = this._festNow(); // Vorschau: das gestellte Datum
    const day = Math.floor((at - new Date(at).getTimezoneOffset() * 6e4) / 864e5);
    const key = `${L.d}|${L.n}|${L.grey}|${L.storm}|${L.snow}|${day}|${south}`;
    if (key === this._lightKey) return;
    this._lightKey = key;
    const pal = seasonPal(seasonPos(at, south));
    const C = landColors(pal, L);
    const st = E.scene.style;
    for (const [k, v] of [['h0', C.h0], ['h1', C.h1], ['h2', C.h2], ['h3', C.h3], ['m1', C.m1], ['mcap', C.mcap],
      ['mound', C.mound], ['mound-s', C.moundS],
      ['lb', C.lb.toFixed(3)], ['ls', C.ls.toFixed(3)], ['lbp', C.lbp.toFixed(3)]]) st.setProperty(`--${k}`, v);
    // Der Filter auf Land, Vordergrund und Besuchern kostet volle Leistung, auch wenn er nichts ändert: erst ab
    // 4 % Unterschied (Sonne unter gut 7°, bedeckt, Gewitter). Das Zuschalten gleitet (transition: filter).
    cl.toggle('shade', C.lb < 0.96 || C.ls < 0.96);
    E.skyDusk.style.opacity = L.d;
    E.skyNight.style.opacity = L.n;
    E.skyGrey.style.setProperty('--gd', L.d);
    E.skyGrey.style.setProperty('--gn', L.n);
    // Der Gewitterschleier nimmt dem Tag das Licht; die Nacht ist schon dunkel
    E.skyStorm.style.opacity = L.storm ? (1 - 0.75 * L.n).toFixed(2) : 0;
    this._lit = { lb: C.lb, ls: C.ls, pal };
    // Neue Jahreszeit (die Karte läuft monatelang): Blumen auf der Wiese und Blüten im Vorrat in den neuen Farben
    const sk = seasonKey(at, south);
    if (this._seasonK && this._seasonK !== sk) {
      const from = this._flowerPal();
      this._seasonK = sk;
      const to = this._flowerPal();
      for (const f of this._flowers) {
        f.color = to[Math.max(0, from.indexOf(f.color))];
        f.el.innerHTML = FLOWER_SVG(f.color);
      }
      if (this._plan) this._hayFromPlan();
    }
    this._seasonK = sk;
    this._flowerTint();
  }

  // Sterne hinter der Mondscheibe ausblenden (ihre dunkle Seite ist durchscheinend gemalt)
  _starOcc() {
    const E = this._el;
    const pos = E.moon._pos;
    if (!pos || !this._W) return;
    this._starSize = `${this._W}x${this._Hs}`;
    const r = this._H * 0.06 + 2;
    for (const el of E.starEls) {
      el._at ??= [parseFloat(el.style.left), parseFloat(el.style.top)];
      const dx = ((el._at[0] - pos.x) / 100) * this._W;
      const dy = ((el._at[1] - pos.y) / 100) * this._Hs;
      el.classList.toggle('occ', !!this._moonUp && dx * dx + dy * dy < r * r);
    }
  }

  _place(el, { x, y }) {
    const prev = el._pos;
    if (prev && Math.abs(prev.x - x) < 0.05 && Math.abs(prev.y - y) < 0.05) return;
    el._pos = { x, y };
    // Kleine Schritte (der Mond wandert alle 30 s ein Stückchen) ohne Gleiten: ein 90-s-Übergang, der ständig neu
    // startet, ließe Layout und Malen in jedem Bild laufen. Nur Sprünge (Sonnenuntergang, Neuladen) gleiten.
    const now = Date.now();
    if (prev && Math.hypot(prev.x - x, prev.y - y) > 1) el._glide = now + 90000;
    el.style.transition = !prev ? 'none' : now < (el._glide || 0) ? '' : 'opacity 2.5s, background 2.5s';
    el.style.left = `${x.toFixed(2)}%`;
    el.style.top = `${y.toFixed(2)}%`;
    if (!prev) {
      void el.offsetWidth;
      el.style.transition = '';
    }
  }

  // Sternschnuppen (nur zum Anschauen, kein Zähler): ein Zeitgeber alle 1,5–5 Minuten, der nur nachts bei
  // klarem Himmel eine losschickt. Jede läuft als CSS-Animation in .meteors und entfernt sich danach selbst.
  // Glühwürmchen: ersetzen die sechs Punkte aus _build durch 10–14 eigene; die Ebene .ff blendet je nach
  // Lage (Sommernacht, späte Sommerdämmerung, trocken) ein oder aus.
  _hassSky(hass) {
    // erst nach _updateSky im selben hass-Aufruf, damit die Szenen-Klassen schon stimmen
    if (this._skyQ) return;
    this._skyQ = true;
    queueMicrotask(() => {
      this._skyQ = false;
      this._skyState();
    });
  }

  _attachSky() {
    this._ffKey = null;
    this._skyState();
    if (!this._away()) this._meteorPlan();
    // Neu eingehängt laufen die Wolken wieder mit ihrem Grundtempo: Wind neu stellen
    this._cloudSig = null;
    this._cloudWind();
    this._wxHistAsk(15 * 60000, false);
  }

  _detachSky() {
    this._meteorStop();
    clearTimeout(this._ffRestT);
    this._el.meteors.textContent = '';
  }

  _hiddenSky(hidden) {
    if (hidden) this._meteorStop();
    else {
      this._meteorPlan();
      this._skyState();
      // erst im nächsten Bild: Dann laufen die Animationen wieder, und ein neues Tempo setzt an der Stelle an, an
      // der die Wolken stehen
      requestAnimationFrame(() => this._guard('Wolken', () => this._cloudWind()));
      this._wxHistAsk(15 * 60000, false);
    }
  }

  _layoutSky(first) {
    // neue Größe: neue Orte und Wege (die alten lägen sonst über Statusleiste oder Futterknopf)
    if (this._ffSize !== `${this._W}x${this._Hs}`) this._ffPlace();
    this._bowSync();
    this._cloudWind();
  }

  _tickSky() {
    this._skyState();
    // Schneedecke taut, Regenbogen kommt und geht: beides hängt an der Zeit, nicht nur an neuen Meldungen
    this._applyWeather();
    this._bowSync();
    this._cloudWind();
    // fälliger Abruf des Wetterverlaufs (erster Versuch gescheitert, Verbindung war weg)
    this._wxHist();
  }

  _skyActs(ctx) {
    const m = this._met;
    const meteor = m && m.watch && !m.seen && Date.now() - m.at < SKY.watchMs;
    return [
      [meteor ? 12 : 0, 'watchMeteor'],
      [this._ffShown() ? 1.5 : 0, 'watchFireflies'],
    ];
  }

  // Sommer = Mai bis September, nach der Vorschau-Uhr, falls gesetzt; auf der Südhalbkugel
  // (hass.config.latitude < 0) ein halbes Jahr versetzt, also November bis März
  _skySummer() {
    let month = new Date(this._dbgDate ?? Date.now()).getMonth();
    if (this._hass?.config?.latitude < 0) month = (month + 6) % 12;
    return month >= 4 && month <= 8;
  }

  // Glühwürmchen bauen (Option fireflies), Sichtbarkeit nach Tageszeit, Jahreszeit und Wetter setzen
  _skyState() {
    if (!this._el) return;
    const ff = this._el.ff;
    const want = this._cfg.fireflies !== false;
    if (want !== this._ffKey) {
      this._ffKey = want;
      this._ffBuild(want);
    }
    const sc = this._el.scene.classList;
    const wx = this._wx;
    const e = this._dbgElev ?? this._elev;
    const ok = want && this._skySummer() && !wx.wet && !wx.storm;
    const mode = !ok ? '' : sc.contains('night') ? 'on' : sc.contains('dusk') && e != null && e < -2 ? 'dim' : '';
    if (mode === (this._ffMode ?? '')) return;
    this._ffMode = mode;
    clearTimeout(this._ffRestT);
    if (mode) {
      // aus der Ruhe holen (display: none) und erst danach einblenden, sonst springt die Deckkraft
      if (ff.classList.contains('rest')) {
        ff.classList.remove('rest');
        void ff.offsetWidth;
      }
      ff.classList.toggle('on', mode === 'on');
      ff.classList.toggle('dim', mode === 'dim');
    } else {
      ff.classList.remove('on', 'dim');
      // nach dem Ausblenden ganz aus dem Bild, dann laufen auch keine Animationen mehr
      this._ffRestT = setTimeout(() => !this._ffMode && ff.classList.add('rest'), 3500);
    }
  }

  _ffShown() {
    return !!this._ffMode && !!this._ffKey;
  }

  _ffBuild(on) {
    const ff = this._el.ff;
    this._ffMode = null;
    ff.classList.remove('on', 'dim');
    ff.classList.add('rest');
    if (!on) {
      ff.textContent = '';
      return;
    }
    const n = Math.round(rnd(SKY.ff[0], SKY.ff[1]));
    let html = '';
    for (let i = 0; i < n; i++) {
      const big = Math.random() < 0.3;
      html += `<i class="fl${big ? ' big' : ''}" style="--fd:${rnd(7, 14).toFixed(1)}s;--fdl:${rnd(-14, 0).toFixed(2)}s;`
        + `--fp:${rnd(1.2, 2.6).toFixed(2)}s;--fpl:${rnd(-2.6, 0).toFixed(2)}s"></i>`;
    }
    ff.innerHTML = html;
    this._ffPlace();
  }

  // Jedem Glühwürmchen einen Ort und einen eigenen Driftweg (vier Punkte, px) geben. Gut die Hälfte schwirrt
  // tief über der Wiese, ein Drittel um den Heuhaufen (--hl, --hw), der Rest etwas höher. Kein Weg führt
  // über die Statusleiste oder die Knöpfe, durchs Heu oder ins Gras (beide liegen eine Ebene davor, --z-stage).
  _ffPlace() {
    const g = this._g;
    const flies = this._el.ff.children;
    if (!g || !flies.length) return;
    const W = this._W;
    const H = this._H;
    this._ffSize = `${W}x${this._Hs}`;
    const { gy } = g;
    const hw = g.stash ? g.hW : H * 0.26;
    const hl = g.hay - hw / 2;
    const avoid = [];
    for (const el of [this._el.stats, this._el.feed, this._el.gbtn]) {
      if (el.offsetWidth) {
        avoid.push({ l: el.offsetLeft - 10, t: el.offsetTop - 10, r: el.offsetLeft + el.offsetWidth + 10, b: el.offsetTop + el.offsetHeight + 10 });
      }
    }
    // Heuhaufen in voller Größe (wächst bis scale 1,06; Grafik 60 × 40, Spitze bei y 10). Die Nische liegt
    // hinten im Bau, vor ihr dürfen sie schwirren.
    const hs = hw * 1.06;
    if (!g.stash) avoid.push({ l: g.hay - hs / 2, r: g.hay + hs / 2, t: gy + 4 - hs * 0.5 - 4, b: gy });
    const grass = gy - H * 0.05; // Oberkante der Grashalme
    const zone = (i) => {
      const z = i % 3 === 0 ? 'hay' : i % 5 === 4 ? 'high' : 'low';
      if (z === 'hay') return [rnd(hl - hw * 0.4, hl + hw * 1.4), rnd(gy - H * 0.32, gy - H * 0.06)];
      if (z === 'high') return [rnd(W * 0.12, W * 0.95), rnd(this._sy(0.3), this._sy(0.55))];
      return [rnd(W * 0.04, W * 0.96), rnd(gy - H * 0.2, gy - H * 0.06)];
    };
    [...flies].forEach((el, i) => {
      let pts = null;
      for (let k = 0; k < 30 && !pts; k++) {
        const [x, y] = zone(i);
        const ax = H * rnd(0.05, 0.16);
        const ay = H * rnd(0.03, 0.1);
        const p = [[x, y]];
        for (let j = 1; j < 4; j++) p.push([x + rnd(-ax, ax), y + rnd(-ay, ay * 0.6)]);
        const xs = p.map((q) => q[0]);
        const ys = p.map((q) => q[1]);
        const box = { l: Math.min(...xs) - 4, r: Math.max(...xs) + 4, t: Math.min(...ys) - 4, b: Math.max(...ys) + 4 };
        const inside = box.l > 0 && box.r < W && box.t > H * 0.06 && box.b < grass;
        if (inside && !avoid.some((a) => box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t)) pts = p;
      }
      // kein freier Platz gefunden (sehr kleine Karte): dieses eine bleibt dunkel
      el.hidden = !pts;
      if (!pts) return;
      pts.forEach(([x, y], j) => {
        el.style.setProperty(`--x${j}`, `${x.toFixed(1)}px`);
        el.style.setProperty(`--y${j}`, `${y.toFixed(1)}px`);
      });
    });
  }

  _meteorPlan() {
    clearTimeout(this._metT);
    this._metT = setTimeout(() => {
      this._metT = null;
      this._meteorMaybe();
      this._meteorPlan();
    }, rnd(SKY.meteor[0], SKY.meteor[1]) / (this._meteorShower() ? 3 : 1));
  }

  // Meteorstrom: Perseiden um den 12. 8. (± 3 Tage), Geminiden um den 14. 12. (± 2 Tage): dreimal so oft
  _meteorShower() {
    const d = new Date(this._dbgDate ?? Date.now());
    const y = d.getFullYear();
    const day = festDay(y, d.getMonth() + 1, d.getDate());
    return Math.abs(day - festDay(y, 8, 12)) <= 3 || Math.abs(day - festDay(y, 12, 14)) <= 2;
  }

  _meteorStop() {
    clearTimeout(this._metT);
    clearTimeout(this._metT2);
    this._metT = this._metT2 = null;
  }

  // Nachts bei weniger als 70 % Bewölkung, ohne Nebel, Regen und Schnee
  _meteorOk() {
    if (this._cfg.shooting_stars === false || !this._g) return false;
    const wx = this._wx;
    const cover = Number.isFinite(wx.cover) ? wx.cover : 0;
    return this._el.scene.classList.contains('night') && cover < 70 && !wx.fog && !wx.wet && !wx.snow;
  }

  _meteorMaybe() {
    if (!this._meteorOk()) return;
    // Bewegung reduzieren: keine aufleuchtenden Boliden, keine Nachzügler
    const calm = calmMotion();
    this._meteor(!calm && Math.random() < SKY.bolide);
    if (!calm && Math.random() < SKY.twin) {
      clearTimeout(this._metT2);
      this._metT2 = setTimeout(() => this._meteorOk() && this._meteor(Math.random() < SKY.bolide / 2), rnd(500, 2200));
    }
  }

  // Eine Sternschnuppe: Start im oberen Himmel (ab 3 % der Höhe), 15–35 % der Breite weit (höchstens 0,9 H),
  // leicht abwärts. Das Ende bleibt über der halben Höhe, sonst verschwänden Schweif und Aufleuchten hinter
  // den Hügeln (breite Karten).
  _meteor(bolide = false) {
    if (!this._g) return;
    const W = this._W;
    const H = this._Hs; // ganzer Himmel
    const dir = Math.random() < 0.5 ? 1 : -1;
    const tilt = rnd(8, 26);
    const len = Math.min(W * rnd(0.15, 0.35), H * 0.9);
    const dx = len * Math.cos(tilt * RAD);
    const dy = len * Math.sin(tilt * RAD);
    const x = dir > 0 ? rnd(W * 0.04, Math.max(W * 0.05, W * 0.96 - dx)) : rnd(Math.min(W * 0.95, W * 0.04 + dx), W * 0.96);
    const y = rnd(H * 0.03, Math.max(H * 0.04, Math.min(H * 0.45, H * 0.5 - dy)));
    const dur = bolide ? rnd(0.95, 1.2) : rnd(0.5, 1.1);
    const el = document.createElement('div');
    el.className = `met${bolide ? ' bolide' : ''}`;
    el.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;--a:${(dir > 0 ? tilt : 180 - tilt).toFixed(1)}deg;`
      + `--len:${len.toFixed(1)}px;--tail:${(len * rnd(0.35, 0.5) * (bolide ? 1.3 : 1)).toFixed(1)}px;--d:${dur.toFixed(2)}s`;
    el.innerHTML = '<b class="mt"></b><b class="mh"></b>';
    this._el.meteors.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000 + 200);
    if (bolide) {
      // kurzes Aufleuchten des Himmels um die Stelle, an der er aufglüht
      const fx = x + dir * dx * 0.78;
      const fy = y + dy * 0.78;
      const f = document.createElement('i');
      f.className = 'mflash';
      f.style.cssText = `background:radial-gradient(circle at ${fx.toFixed(0)}px ${fy.toFixed(0)}px, rgba(215, 235, 255, .3), rgba(215, 235, 255, 0) ${(H * 0.5).toFixed(0)}px);`
        + `animation-delay:${(dur * 0.68).toFixed(2)}s`;
      this._el.meteors.appendChild(f);
      setTimeout(() => f.remove(), dur * 680 + 900);
    }
    // Ist er wach, schaut er mit etwa jeder zweiten hin (Aktion watchMeteor in den 4 s danach)
    const watch = !this._asleep && Math.random() < SKY.watch;
    this._met = { at: Date.now(), x: x + (dir * dx) / 2, dir, bolide, watch, seen: false };
    if (watch && !this._inside && (this._action === 'idle' || this._action === 'look')) this._interrupt();
  }

  // Einer Sternschnuppe nachschauen
  async _watchMeteor() {
    const m = this._met;
    if (!m) return;
    m.seen = true;
    const p = this._el.pika;
    this._face(m.x >= this._x ? 1 : -1);
    p.classList.add('look-up');
    await this._wait(250);
    if (m.bolide) this._jump('hop1');
    this._mimik('awe', m.bolide ? 2200 : 1500);
    this._say(m.bolide ? 'oooh!' : 'oh!', 1200);
    await this._wait(rnd(700, 1000));
    // mit dem Kopf hinterher, in Flugrichtung
    this._face(m.dir);
    await this._wait(rnd(1300, 2200));
    p.classList.remove('look-up');
    await this._wait(rnd(400, 900));
  }

  // Ort (px in der Szene) eines zufälligen sichtbaren Glühwürmchens
  _ffSpot() {
    const els = [...this._el.ff.children].filter((el) => !el.hidden);
    const el = els.length ? pick(els) : null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    const s = this._el.scene.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  }

  // Den Glühwürmchen zuschauen: hinsetzen, hochschauen, mit dem Kopf folgen, einmal nach einem hüpfen
  async _watchFireflies() {
    const p = this._el.pika;
    const { pW } = this._g;
    let f = this._ffSpot();
    if (f && Math.abs(f.x - this._x) > this._W * 0.3) {
      await this._walkTo(f.x - Math.sign(f.x - this._x) * pW * rnd(0.6, 1.1), 0.7);
    }
    if (f) this._face(f.x >= this._x ? 1 : -1);
    p.classList.add('crouch', 'look-up');
    await this._wait(rnd(1200, 1900));
    p.classList.remove('look-up');
    let fwd = true;
    for (let i = 0, n = 2 + Math.floor(rnd(0, 3)); i < n; i++) {
      p.classList.toggle('look-f', fwd);
      p.classList.toggle('look-b', !fwd);
      fwd = !fwd;
      await this._wait(rnd(600, 1200));
    }
    p.classList.remove('look-f', 'look-b', 'crouch');
    f = this._ffSpot() || f;
    if (f) this._face(f.x >= this._x ? 1 : -1);
    p.classList.add('look-up');
    await this._wait(200);
    this._jump('hop1');
    this._say('oh!', 1100);
    await this._wait(rnd(1400, 2400));
  }
}
