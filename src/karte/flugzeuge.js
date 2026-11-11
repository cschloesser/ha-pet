// Flugzeuge: Meldungen lesen, Flieger anlegen, Takt, Fähnchen, nachschauen

import { rnd, pick, clamp, esc } from '../logik/hilfen.js';
import { RAD } from '../logik/himmel.js';
import {
  lonDiff, PLANE_STEP, cityDe, flightNo, planeKind, flightAloft, flightGhost, planeStale, planeClock,
} from '../logik/flugzeuge.js';
import { PLANE_SVG, PLANE_SIZE, TAIL, TAIL_DEFAULT } from '../grafik/flugzeuge.js';

export class Flugzeuge {
  // Einem tief fliegenden Flugzeug nachschauen; ganz nah und laut erschrickt er kurz
  async _watchPlane() {
    const pl = this._planeToWatch();
    if (!pl) return;
    pl.watched = (pl.watched || 0) + 1;
    this._memo('plane');
    const p = this._el.pika;
    this._face(pl.x >= this._x ? 1 : -1);
    if (pl.slant < 3) {
      this._jump('hop1');
      this._say('!', 900);
      await this._wait(700);
    }
    p.classList.add('look-up');
    if (Math.random() < 0.4) p.classList.add('tilt-b');
    this._mimik('awe', 1500);
    await this._wait(rnd(1500, 2500));
    // dreht sich mit, wenn es schon vorbei ist
    this._face(pl.x >= this._x ? 1 : -1);
    if (Math.random() < 0.55) this._say(pick(['brumm!', 'wuiii!', 'oh!', 'iiep!']), 1100);
    await this._wait(rnd(1500, 2800));
  }

  // Echte Flüge aus der Flightradar24-Integration (Attribut flights, Meldung alle 10–30 s). Dazwischen fliegen
  // sie mit Kurs und Geschwindigkeit weiter. Im Bild: Osten links, Westen rechts (Südhalbkugel umgekehrt, _viewN),
  // der Bildrand liegt bei flight_radius. Die Flughöhe bestimmt, wie hoch sie am Himmel stehen, die Entfernung
  // ihre Größe.
  _readFlights(st) {
    const cfg = this._hass?.config;
    if (!this._el || !cfg || !Number.isFinite(cfg.latitude)) return;
    const now = Date.now();
    // Uhr von HA und Gerät können auseinandergehen: Versatz wie überall aus _clockHass (ungeglättet, die Flieger
    // brauchen ihn genau). Sonst verschwänden alle Flieger, wenn die Geräteuhr mehr als 75 s vorgeht. Solange noch
    // keiner geschätzt ist, gilt die Meldung als frisch.
    const lu = Date.parse(st?.last_updated);
    const t0 = Number.isFinite(lu) ? Math.min(now, lu - (this._clockOff ?? lu - now)) : now;
    // Getrennt oder unsichtbar: keine Elemente anlegen, die Meldung liegt in _lastFlights und wird beim
    // Wiederkommen gelesen
    if (!this._attached || this._away()) return;
    const kx = 111.32 * Math.cos(cfg.latitude * RAD);
    const R = Number(this._cfg.flight_radius) || 15;
    // Ohne Kennung (id, Rufzeichen, Flugnummer, Kennzeichen) ließe er sich von Meldung zu Meldung nicht
    // wiedererkennen: jede Meldung gäbe ein neues Flugzeug, das alte flöge doppelt weiter. Solche auslassen.
    const idOf = (f) => String(f.id || f.callsign || f.flight_number || f.aircraft_registration || '');
    const list = [];
    const ghosts = (this._ghosts ??= new Map());
    const seen = new Set();
    for (const f of Array.isArray(st?.attributes?.flights) ? st.attributes.flights : []) {
      if (!f || typeof f !== 'object' || !idOf(f)) continue;
      const alt = Number(f.altitude);
      const gs = Number(f.ground_speed) || 0;
      const lat = Number(f.latitude);
      const lon = Number(f.longitude);
      // Rollt am Flughafen oder hat keine Position: nicht am Himmel (ein Hubschrauber darf schweben)
      if (!flightAloft(f) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      // Hängengebliebene Meldung: Dieser Flug ist mit genau dieser Position schon einmal ausgeflogen. Er käme sonst
      // alle 75 s von derselben Stelle wieder, und der Pika erschräke jedes Mal. Erst eine neue Position zählt.
      seen.add(idOf(f));
      if (flightGhost(ghosts.get(idOf(f)), f)) continue;
      ghosts.delete(idOf(f));
      const e = lonDiff(lon, cfg.longitude) * kx;
      const n = (lat - cfg.latitude) * 110.57;
      // Außerhalb von flight_radius (bzw. ganz am Rand, wo er schon ausgeblendet ist, vgl. pa in _planeTick)
      // sieht man ihn nicht: dann belegt er auch keinen der max_flights-Plätze, ein schon gezeigter gibt
      // seinen Platz ab und fliegt ausgeblendet weiter
      if (Math.max(Math.abs(e), Math.abs(n)) >= 0.99 * R) continue;
      list.push({ f, e, n, alt, gs, slant: Math.hypot(e, n, alt * 0.0003048) });
    }
    // nicht mehr gemeldet: vergessen
    for (const id of ghosts.keys()) if (!seen.has(id)) ghosts.delete(id);
    list.sort((a, b) => a.slant - b.slant);
    const max = Math.max(0, Math.round(Number(this._cfg.max_flights) || 0));
    // Wer schon am Himmel steht, behält seinen Platz, solange er gemeldet wird. Sonst tauschen zwei fast gleich
    // weite Flieger bei jeder Meldung die Plätze, und einer verschwindet mitten am Himmel. Neue füllen freie
    // Plätze; ein deutlich näherer darf als einer mehr dazukommen, die anderen fliegen dann normal aus dem Bild.
    const pick = list.filter((s) => {
      const p = this._planes.get(idOf(s.f));
      return p && !p.dead && !p.gone;
    }).slice(0, max && max + 1);
    for (const s of list) {
      if (pick.includes(s)) continue;
      const worst = Math.max(0, ...pick.map((o) => o.slant));
      if (pick.length < max || (max && pick.length === max && s.slant < 0.6 * worst)) pick.push(s);
    }
    const keep = new Set();
    for (const s of pick) {
      const id = idOf(s.f);
      keep.add(id);
      const p = this._planes.get(id) || this._newPlane(id, s.f);
      // Die Integration meldet oft dieselbe Position noch einmal (Flightradar24 hat noch nichts Neues). Dann
      // weiter von der alten Meldung aus rechnen, sonst springt der Flieger um eine Meldung zurück.
      const same = p.t0 != null && Number(p.f.latitude) === Number(s.f.latitude)
        && Number(p.f.longitude) === Number(s.f.longitude);
      // Gibt es einen sichtbaren Punkt, den eine verspätete Position nicht zurückwerfen darf? Nicht bei einem neuen
      // und nicht, wenn er ohnehin gleich an seinen Platz gesetzt wird (Karte war unsichtbar, neue Größe).
      const had = p.t0 != null && !p.fresh && !p.snap;
      Object.assign(p, { f: s.f, gone: 0, dead: 0 });
      // Schwebt er (unter 30 kn), ist dieselbe Position keine alte Meldung: Er bleibt, solange er gemeldet wird,
      // höchstens zehn Minuten am selben Fleck (danach gilt auch das als hängengeblieben)
      if (same && s.gs <= 30) {
        p.still ||= now;
        if (now - p.still < 600000) p.t0 = p.tm = t0;
      } else p.still = 0;
      if (!same) {
        const v = (s.gs * 1.852) / 3600; // km/s
        const h = Number(s.f.heading) * RAD;
        const ve = Number.isFinite(h) ? v * Math.sin(h) : 0;
        const vn = Number.isFinite(h) ? v * Math.cos(h) : 0;
        // Verspätete Position: Sie liegt hinter dem Punkt, an dem er im Bild schon ist, der nächste Schritt ginge
        // rückwärts. Dann rechnet die Bahn eben von so viel früher an (planeLag): Er fliegt vom sichtbaren Punkt aus
        // weiter, nur ein Versatz quer zur Bahn gleitet sich aus. Die Meldezeit (tm) bleibt, wie sie ist: An ihr
        // hängt das Ausaltern (planeClock).
        Object.assign(p, {
          e: s.e, n: s.n, alt: s.alt, ve, vn, ...planeClock(had ? p : null, { e: s.e, n: s.n, ve, vn }, now, t0),
          vz: clamp(Number(s.f.vertical_speed) || 0, -6000, 6000) / 60, // ft/s
        });
      }
      this._planeText(p);
    }
    // Aus dem Umkreis (oder nicht mehr unter den nächsten): fliegt noch weiter, bis es aus dem Bild ist
    for (const [id, p] of this._planes) if (!keep.has(id) && !p.gone) p.gone = now;
    this._planeLoop();
  }

  // Was an dieser Stelle unter der Tippfläche eines Flugzeugs antippbar ist: Pika, Pino, Häufchen, Besucher, Geräte,
  // Ostereier, Knöpfe. Es zählt nur das Oberste, wie bei einem Tipp ohne Flugzeug; null: Himmel oder Wiese.
  _tapBelow(e) {
    for (const el of this.shadowRoot.elementsFromPoint(e.clientX, e.clientY)) {
      if (el.closest('.phits, .ptags')) continue;
      return el.closest('.pika, .friend, .poo, .hb, .stats, button, [role="button"]');
    }
    return null;
  }

  _newPlane(id, f) {
    const kind = planeKind(f);
    const el = document.createElement('div');
    el.className = `plane ${kind}`;
    el.innerHTML = `<div class="pl-s"><div class="pl-f"><div class="trail"></div>${PLANE_SVG[kind]}</div></div>`;
    el.style.setProperty('--tail', TAIL[f.airline_icao] || TAIL_DEFAULT[kind]);
    const tag = document.createElement('div');
    tag.className = 'ptag';
    const hit = document.createElement('div');
    hit.className = 'phit';
    hit.setAttribute('role', 'button');
    const p = { id, kind, f, el, tag, hit, s: el.firstElementChild, size: PLANE_SIZE[kind], fresh: true };
    // Flugzeug antippen: Flugnummer, Ziel, Airline, Typ, Strecke, Höhe und Tempo; nochmal tippen schließt
    // Die Tippfläche eines tiefen Fliegers liegt über Pika, Pino, Häufchen, Besuchern und Geräten: die haben Vorrang
    const below = (e) => this._tapBelow(e);
    const flip = () => {
      clearTimeout(p.openT);
      const open = !tag.classList.contains('open');
      if (open) {
        this._planeText(p);
        this._found('plane');
        p.openT = setTimeout(() => tag.classList.remove('open'), 9000);
      }
      tag.classList.toggle('open', open);
    };
    const toggle = (e) => {
      e.stopPropagation();
      if (e.currentTarget === hit) {
        const under = below(e);
        // mit der Stelle weiterreichen: die Streichel-Zone hängt daran
        if (under) {
          return under.dispatchEvent(new MouseEvent('click', {
            bubbles: true, composed: true, cancelable: true, clientX: e.clientX, clientY: e.clientY,
          }));
        }
      }
      flip();
    };
    hit.addEventListener('click', toggle);
    tag.addEventListener('click', toggle);
    // Tastatur: ohne Stelle gibt es nichts darunter, Enter und Leertaste klappen das Fähnchen auf und zu
    hit.setAttribute('aria-label', 'Flugzeug');
    this._keyTap(hit, flip);
    // Tippen, Kraulen und Übers-Fell-Streichen unter dem Flieger: die Tippfläche hält den Finger fest und reicht ihn durch
    this._pressBind(hit, (e) => !!below(e)?.classList.contains('pika'), false);
    this._el.planes.appendChild(el);
    this._el.phits.appendChild(hit);
    this._el.ptags.appendChild(tag);
    this._planes.set(id, p);
    return p;
  }

  _planeText(p) {
    const f = p.f;
    const cfg = this._hass?.config;
    const orig = cityDe(f.airport_origin_city);
    const dest = cityDe(f.airport_destination_city);
    // Landet es hier in der Nähe, ist die Herkunft spannender als das Ziel
    const dLat = Number(f.airport_destination_latitude);
    const dLon = Number(f.airport_destination_longitude);
    const landsHere = cfg && Number.isFinite(dLat) && Number.isFinite(dLon)
      && Math.hypot(lonDiff(dLon, cfg.longitude) * 111.32 * Math.cos(cfg.latitude * RAD), (dLat - cfg.latitude) * 110.57) < 30;
    const route = landsHere && orig ? `aus ${orig}` : dest ? `→ ${dest}` : '';
    const alt = Math.round(((p.altNow ?? p.alt ?? Number(f.altitude)) * 0.3048) / 10) * 10;
    const kmh = Math.round(Number(f.ground_speed) * 1.852);
    const more = [
      [f.airline_short || f.airline, String(f.aircraft_model || '').replace(/-\S+$/, '')].filter(Boolean).join(' · '),
      orig && dest ? `${orig} → ${dest}` : '',
      `${alt.toLocaleString('de-DE')} m${kmh ? ` · ${kmh} km/h` : ''}`,
    ].filter(Boolean);
    const html = `<b>${esc(flightNo(f))}</b>${route ? ` ${esc(route)}` : ''}`
      + more.map((l) => `<div class="more">${esc(l)}</div>`).join('');
    if (html === p.html) return;
    p.html = html;
    p.tag.innerHTML = html;
    p.hit.setAttribute('aria-label', `Flug ${flightNo(f)} ${route}`.trim());
    p.tw = 0;
  }

  // Auch bei laufendem Takt gleich neu rechnen (neue Meldung): Jeder Schritt startet am gerade sichtbaren Punkt
  // und steuert den Punkt PLANE_STEP voraus an, ein früherer Schritt ändert also Weg und Tempo nicht
  _planeLoop() {
    if (!this._planes.size || !this._attached) return;
    clearInterval(this._planeT);
    this._planeT = setInterval(() => this._planeTick(), PLANE_STEP * 1000);
    this._planeTick();
  }

  // Neue Kartengröße oder zurück aus dem Hintergrund: Flieger gleich an den richtigen Platz setzen statt sie
  // einen ganzen Takt lang dorthin gleiten zu lassen
  _planeSnap() {
    for (const p of this._planes.values()) p.snap = true;
    this._planeLoop();
  }

  _planeTick() {
    if (!this._planes.size) {
      clearInterval(this._planeT);
      this._planeT = null;
      return;
    }
    if (this._away() || !this._g) return;
    const now = Date.now();
    const W = this._W;
    const H = this._H;
    const Hs = this._Hs; // Flughöhe und Fähnchen am ganzen Himmel, Größen in der Einheit
    const R = Number(this._cfg.flight_radius) || 15;
    const vs = this._viewN() ? -1 : 1;
    const shown = [];
    const fresh = [];
    const pos = [];
    for (const [id, p] of this._planes) {
      const age = (now - p.t0) / 1000;
      // Ziel: wo er am Ende des Übergangs ist. Neue/versetzte erst ohne Übergang auf den Punkt von jetzt (der
      // zweite Durchlauf unten schickt sie dann wie alle anderen los)
      const dt = age + (p.fresh || p.snap ? 0 : PLANE_STEP);
      const e = p.e + p.ve * dt;
      const n = p.n + p.vn * dt;
      const alt = Math.max(80, p.alt + p.vz * Math.min(dt, 30));
      // Blick nach Süden: Osten links; nach Norden (Südhalbkugel, vs −1): Osten rechts
      const x = W * (0.5 - ((vs * e) / R) * 0.46);
      // Höhe logarithmisch: Anflug knapp über den Hügeln, Reiseflughöhe oben; hinter uns (beim Blick nach
      // Süden nördlich) etwas höher
      const af = clamp(Math.log1p(alt / 1000) / Math.log1p(40), 0, 1);
      const y = (Hs * clamp(49 - af * 36 - clamp((vs * n) / R, -1, 1) * 4, 13, 49)) / 100;
      const slant = Math.hypot(e, n, alt * 0.0003048);
      const sc = (clamp(1.6 / slant, 0.1, 0.36) / 0.3) * p.size;
      Object.assign(p, { x, y, slant, altNow: alt });
      const out = x < -W * 0.2 || x > W * 1.2;
      // Ohne neue Position nach 75 s (seit der Meldung, nicht seit dem vorverlegten Beginn der Bahn: planeStale)
      // ausblenden, ein verlassenes spätestens nach 45 s
      const ending = p.gone ? out || now - p.gone > 45000 : planeStale(p, now);
      // Wird er mit dieser alten Position weiter gemeldet, kommt er nicht wieder (flightGhost in _readFlights)
      if (ending && !p.dead && !p.gone) (this._ghosts ??= new Map()).set(id, { lat: Number(p.f.latitude), lon: Number(p.f.longitude) });
      if (ending && !p.dead) p.dead = now;
      if (p.dead && now - p.dead > 2500) {
        clearTimeout(p.openT);
        p.el.remove();
        p.tag.remove();
        p.hit.remove();
        this._planes.delete(id);
        continue;
      }
      // nach Osten = im Bild nach links (Blick nach Norden: rechts); erst ab etwa 40 km/h quer, sonst dreht ein
      // kurvender Hubschrauber hin und her
      if (Math.abs(p.ve) > 0.012) p.left = vs * p.ve > 0;
      // Schwellen mit etwas Spiel, damit ein Flieger knapp an der Grenze nicht bei jeder Meldung umschaltet
      p.hi = alt > (p.hi ? 7500 : 8500);
      p.ct = alt > (p.ct ? 25500 : 26500);
      const cl = p.el.classList;
      cl.toggle('left', !!p.left);
      cl.toggle('contrail', p.ct && !this._wx.wet);
      cl.toggle('hi', p.hi);
      // Die Integration meldet ein Quadrat um das Haus (bis in die Ecken fast 1,5 × Radius). Zum Rand hin sanft
      // ein- und ausblenden, sonst taucht ein Flieger, der nördlich oder südlich vorbeizieht, mitten im Bild auf
      const pa = clamp((R - Math.max(Math.abs(e), Math.abs(n))) / (0.2 * R), 0, 1);
      p.el.style.setProperty('--pa', pa.toFixed(2));
      if (p.fresh || p.snap) {
        p.el.style.transition = p.s.style.transition = p.tag.style.transition = p.hit.style.transition = 'none';
        p.s.firstElementChild.style.transition = 'none'; // .pl-f: Randausblendung gleich auf dem richtigen Wert
        fresh.push(p);
      }
      p.show = !p.dead && !out && pa > 0.02;
      // auch ein gerade ausblendender zählt beim Ausweichen mit, sonst springt der andere zurück
      pos.push({ p, x, y, sc, vis: !out && pa > 0.02 });
    }

    this._planeSpread(pos.filter((o) => o.vis), H, Hs);
    for (const { p, x, y, sc, vis } of pos) {
      if (!vis) p.dy = 0;
      p.y = y; // was man sieht: mit Ausweichen
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      p.s.style.transform = `scale(${sc.toFixed(3)})`;
      // Tippfläche so groß wie das Flugzeug, aber mindestens fingergroß
      const hw = Math.max(44, Math.round(H * 0.3 * sc));
      const hh = Math.max(36, Math.round(H * 0.12 * sc));
      // Größe nur schreiben, wenn sie sich ändert (sonst jedes Mal neues Layout)
      if (p.hw !== hw || p.hh !== hh) {
        p.hw = hw;
        p.hh = hh;
        p.hit.style.width = `${hw}px`;
        p.hit.style.height = `${hh}px`;
      }
      p.hit.style.transform = `translate(${(x - hw / 2).toFixed(1)}px, ${(y - hh / 2).toFixed(1)}px)`;
      if (p.show) shown.push({ p, x, y, half: H * 0.06 * sc });
    }

    // Fähnchen unter dem Flugzeug, im Bild gehalten. Überdecken sich zwei, kommt das obere über sein Flugzeug.
    for (const t of shown) {
      if (!t.p.tw) {
        t.p.tw = t.p.tag.offsetWidth;
        t.p.th = t.p.tag.offsetHeight;
      }
      t.w = t.p.tw;
      t.h = t.p.th;
      t.tx = clamp(t.x - t.w / 2, 4, Math.max(4, W - t.w - 4)); // breiter als die Karte: links bündig
      t.ty = t.y + t.half + 3;
    }
    shown.sort((a, b) => a.y - b.y);
    for (let i = 0; i < shown.length; i++) {
      for (let j = i + 1; j < shown.length; j++) {
        const a = shown[i];
        const b = shown[j];
        if (a.tx < b.tx + b.w && b.tx < a.tx + a.w && a.ty < b.ty + b.h && b.ty < a.ty + a.h) a.ty = a.y - a.half - a.h - 3;
      }
    }
    for (const t of shown) t.p.tag.style.transform = `translate(${t.tx.toFixed(1)}px, ${clamp(t.ty, 2, Math.max(2, Hs - t.h - 4)).toFixed(1)}px)`;

    // Neue erst an ihren Platz setzen, dann einblenden
    if (fresh.length) {
      void this._el.planes.offsetWidth;
      for (const p of fresh) {
        p.el.style.transition = p.s.style.transition = p.tag.style.transition = p.hit.style.transition = '';
        p.s.firstElementChild.style.transition = '';
        if (p.fresh && p.show && p.altNow < 5000 && p.slant < 8) this._noticeCritter(p.x, true);
        p.fresh = p.snap = false;
      }
      // Gleich weiter: jetzt mit Übergang auf den Punkt PLANE_STEP voraus (bei den übrigen ändert sich nichts)
      this._planeTick();
      return;
    }
    for (const p of this._planes.values()) {
      p.el.classList.toggle('on', !!p.show);
      p.tag.classList.toggle('on', !!p.show);
      p.hit.classList.toggle('on', !!p.show);
    }
  }

  // Überdecken dürfen sich zwei Flieger etwas, deckungsgleich sollen sie nie stehen (etwa Anflug und Abflug auf
  // derselben Linie in gleicher Höhe, die sich begegnen). Wer sich im Bild nahe kommt, weicht senkrecht aus:
  // ab Berührung der Flügelspitzen langsam, ab halber Breite voll, bis die Mitten 0,7 Flugzeughöhen auseinander
  // liegen. Die Reihenfolge oben/unten bleibt wie beim letzten Mal, sonst tauschen gleich hohe die Plätze.
  _planeSpread(list, H, Hs = H) {
    for (const o of list) {
      o.dy = 0;
      o.hw = H * 0.15 * o.sc;
      o.hh = H * 0.06 * o.sc;
    }
    list.sort((a, b) => a.y + (a.p.dy || 0) - (b.y + (b.p.dy || 0)));
    const top = Hs * 0.1;
    const bot = Hs * 0.52;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const wx = a.hw + b.hw;
          const dx = Math.abs(a.x - b.x);
          if (dx >= wx) continue;
          const need = 0.7 * (a.hh + b.hh) * Math.min(1, 2 * (1 - dx / wx));
          const gap = b.y + b.dy - (a.y + a.dy);
          if (gap >= need) continue;
          // je zur Hälfte; stößt einer an den Himmelsrand, schiebt die nächste Runde den anderen weiter
          a.dy = Math.max(a.dy - (need - gap) / 2, top - a.y);
          b.dy = Math.min(b.dy + (need - gap) / 2, bot - b.y);
        }
      }
    }
    for (const o of list) {
      o.p.dy = o.dy;
      o.y += o.dy;
    }
  }

  // Tief und nah genug zum Hinschauen (jedes Flugzeug höchstens zweimal)
  _planeToWatch() {
    if (this._asleep || this._inside || this._lift > 0) return null;
    let best = null;
    for (const p of this._planes.values()) {
      if (!p.show || p.gone || p.x < 0 || p.x > this._W || (p.watched || 0) >= 2) continue;
      if (p.altNow < 5000 && p.slant < 8 && (!best || p.slant < best.slant)) best = p;
    }
    return best;
  }
}
