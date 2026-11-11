// Wetter: Lage lesen, Verlauf, Wolken, Niederschlag, Wind, Blitz, Regenbogen

import { clamp, seeded } from '../logik/hilfen.js';
import { skyPos } from '../logik/himmel.js';
import {
  windDeg, numAttr, windKmh, WEATHER, WX_HOLD, WX_LATE, WX_RETRY, wxCover, starOp, wxTemp, WX_KEEP, wxLogAdd, wxRows,
  wxLogMerge, SNOW, snowDepth, rainbow,
} from '../logik/wetter.js';
import { WX_STOP } from '../logik/beschaeftigungen.js';

export class Wetter {
  // Regenbogen nach dem Schauer (rainbow): gegenüber der Sonne, Scheitel umso tiefer, je höher sie steht
  _bowSync() {
    const el = this._el?.rbow;
    if (!el || !this._W) return;
    const e = this._dbgElev ?? this._elev;
    const az = this._dbgAz ?? this._az;
    const k = this._dbgBow ?? (e == null || this._asleep ? 0 : rainbow(this._wxLog || [], this._haNow(), e, this._wx.cover ?? 0));
    const s = Math.round(k * 20) / 20;
    // Sonne rechts: Bogen links. Solange er steht, bleibt er auf seiner Seite (mittags zieht die Sonne durch die Mitte)
    if (!s || !this._bowKey || this._bowKey === '0') this._bowLeft = az != null && skyPos(az, e ?? 0, this._viewN()).x > 50;
    const left = !!this._bowLeft;
    const key = s ? `${s}|${Math.round(e)}|${left}|${this._W}x${this._Hs}` : '0';
    if (key === this._bowKey) return;
    this._bowKey = key;
    el.style.opacity = (s * 0.6).toFixed(2);
    if (!s) return;
    // Kreis um den Gegenpunkt der Sonne: der liegt so weit unter dem Horizont (56 % der Höhe), wie die Sonne darüber
    const r = this._H * 0.46;
    const cx = this._W * (left ? 0.27 : 0.73);
    const cy = this._Hs * 0.56 + (clamp(e, 0, 42) / 42) * r;
    el.style.width = el.style.height = `${(2 * r).toFixed(1)}px`;
    el.style.left = `${(cx - r).toFixed(1)}px`;
    el.style.top = `${(cy - r).toFixed(1)}px`;
  }

  // ---------- Wetter ----------

  _readWeather(w, pr) {
    this._wxNote(w);
    // Wetter kurz nicht erreichbar (Aussetzer des Dienstes, Integration lädt neu): Das letzte gilt bis zu WX_HOLD
    // weiter. Sonst wäre für die Dauer des Aussetzers Schönwetter, und er käme mitten im Gewitter heraus.
    const dead = !!w && (w.state === 'unavailable' || w.state === 'unknown');
    if (!dead) this._wxDeadAt = 0;
    else if (this._wxRaw && this._wxDeadAt !== -1) {
      this._wxDeadAt ||= Date.now();
      if (Date.now() - this._wxDeadAt < WX_HOLD) return;
      this._wxDeadAt = -1; // Frist um (_tick): ab jetzt ist das Wetter unbekannt
    }
    if (w) {
      const a = w.attributes || {};
      let wind = Number(a.wind_speed);
      wind = windKmh(wind, a.wind_speed_unit);
      const temp = wxTemp(a);
      this._wxRaw = {
        cond: w.state,
        cover: numAttr(a.cloud_coverage),
        wind: Number.isFinite(wind) ? wind : 0,
        bearing: windDeg(a.wind_bearing),
        temp: Number.isFinite(temp) ? temp : null,
        // NaN ohne Sensor oder wenn er nicht verfügbar ist, dann zählt nur die Wetterlage
        precip: pr ? parseFloat(pr.state) : NaN,
      };
    } else {
      this._wxRaw = null;
    }
    this._applyWeather();
  }

  // Verlauf der Wetterlage für Schneedecke und Regenbogen fortschreiben (wxLogAdd): jede Meldung der Wetter-Entität
  // mit ihrem Zeitstempel von HA, auch die Aussetzer. So kommen alle Geräte auf dieselbe Reihe. Was vorher war und
  // was dieses Gerät verpasst hat, liefert der Recorder (_wxHist).
  _wxNote(w) {
    const id = this._cfg.weather_entity;
    if (!w || !id) {
      // Keine Wetter-Entität (entfernt, umbenannt, nicht eingestellt): kein Verlauf, also auch keine Schneedecke,
      // die für immer liegen bliebe. Kommt sie wieder, wird der Recorder neu gefragt.
      this._wxLog = [];
      this._wxLogId = this._wxCur = null;
      return;
    }
    if (this._wxLogId !== id) {
      // neue oder andere Wetter-Entität (Editor): Der Verlauf der alten gilt nicht mehr
      this._wxLogId = id;
      this._wxLog = [];
      this._wxCur = null;
      this._wxHistFail = 0;
      this._wxHistDue = 0;
    }
    const now = this._haNow();
    const lu = Date.parse(w.last_updated);
    const lc = Date.parse(w.last_changed);
    const t = Number.isFinite(lu) ? lu : Number.isFinite(lc) ? lc : now;
    const row = { t, c: w.state, T: wxTemp(w.attributes) };
    const seen = this._wxCur;
    this._wxCur = row;
    // Was die Mitschrift nach dieser Meldung noch führt, kann nicht stimmen (Uhr verstellt) und fällt heraus
    const log = (this._wxLog || []).filter((r) => r.t <= t);
    // Erste Meldung (eben geladen): Die Lage gilt schon seit last_changed. Mit der Temperatur von jetzt ist das nur
    // vorläufig; antwortet der Recorder, ersetzt sein Verlauf diesen Eintrag (wxLogMerge).
    const first = !log.length && Number.isFinite(lc) && lc < t ? [{ ...row, t: lc }] : [];
    this._wxLog = wxLogAdd(log, [...first, row], Math.max(now, t));
    // Eine neue Meldung, die schon alt ankommt: Dazwischen war die Verbindung weg, der Recorder weiß mehr
    if (seen && seen.t !== t && now - t > WX_LATE) this._wxHistAsk();
    this._wxHist();
  }

  // Den Recorder (noch einmal) fragen, frühestens pause ms nach dem letzten Versuch (gegen Dauerabfragen): wenn die
  // Verbindung wiederkommt oder eine Meldung verspätet eintrifft, nach einer Minute; ist die Karte wieder zu sehen
  // oder neu eingehängt, nur wenn der letzte Versuch 15 Minuten her ist (wait false: sonst gar nicht).
  _wxHistAsk(pause = 60000, wait = true) {
    const at = (this._wxHistTry || 0) + pause;
    if (wait || Date.now() >= at) this._wxHistDue = Math.min(this._wxHistDue ?? Infinity, at);
    this._wxHist();
  }

  // Wetterlage der letzten drei Tage aus dem Recorder von HA: alle Meldungen der Wetter-Entität, ausgedünnt auf die
  // Wechsel von Lage und Temperatur (wxRows, wxLogAdd). Damit weiß auch ein frisch geladenes Gerät, ob noch Schnee
  // liegt und ob eben ein Schauer durchzog, und steht danach da wie eines, das mitgeschrieben hat (wxLogMerge).
  // Gefragt wird, wenn ein Abruf fällig ist (_wxHistDue): beim Laden, bei einer anderen Wetter-Entität und auf
  // Anfrage (_wxHistAsk). Schlägt er fehl, gilt solange, was das Gerät selbst gesehen hat, und der nächste Versuch
  // folgt nach 1, 5, 15, dann alle 30 Minuten (WX_RETRY; angestoßen aus _tickSky und von jeder Wettermeldung).
  async _wxHist() {
    const id = this._cfg?.weather_entity;
    const hass = this._hass;
    if (!id || this._wxLogId !== id || this._wxHistBusy || !this._attached || !(Date.now() >= this._wxHistDue)
      || hass?.connected === false || typeof hass?.callWS !== 'function' || !hass.states?.[id]) return;
    this._wxHistBusy = true;
    this._wxHistTry = Date.now();
    this._wxHistDue = Infinity;
    let rows = null;
    try {
      const now = this._haNow();
      const res = await hass.callWS({
        type: 'history/history_during_period', start_time: new Date(now - WX_KEEP).toISOString(), end_time: new Date(now + 60000).toISOString(),
        // auch Meldungen, bei denen sich nur ein Attribut geändert hat: Die Temperatur gehört zum Verlauf
        entity_ids: [id], minimal_response: false, no_attributes: false, significant_changes_only: false,
      });
      rows = wxRows(res?.[id]);
    } catch (e) {
      if (!this._wxHistWarned) console.warn('pika-pet-card: Verlauf der Wetterlage nicht lesbar (Schneedecke und Regenbogen vorerst nur aus dem, was dieses Gerät gesehen hat; neuer Versuch folgt)', e);
      this._wxHistWarned = true;
    }
    this._wxHistBusy = false;
    // inzwischen eine andere Wetter-Entität: Diese Antwort gilt nicht mehr, ihr eigener Abruf ist schon fällig
    if (id === this._wxLogId) {
      if (rows) {
        this._wxHistFail = 0;
        this._guard('Wetterverlauf', () => {
          const now = Math.max(this._haNow(), this._wxCur?.t || 0);
          this._wxLog = wxLogMerge([...(this._wxLog || []), this._wxCur], rows, now);
          this._applyWeather();
          this._bowSync();
        });
      } else {
        const n = (this._wxHistFail = (this._wxHistFail || 0) + 1);
        this._wxHistDue = Math.min(this._wxHistDue, Date.now() + WX_RETRY[Math.min(n, WX_RETRY.length) - 1] * 60000);
      }
    }
    // während des Abrufs angemeldet (andere Entität, Verbindung kam wieder)
    if (Date.now() >= this._wxHistDue) this._wxHist();
  }

  _applyWeather() {
    if (!this._el) return;
    const raw = { cond: null, wind: 0, temp: null, ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
    // Vorhersagen melden "rainy" schon bei Niesel: unter rain_min mm/h ist es nur bewölkt
    const drizzle = raw.cond === 'rainy' && raw.precip < this._cfg.rain_min;
    const def = drizzle ? WEATHER.cloudy : WEATHER[raw.cond] || { cover: 25 };
    // Bei trockener Lage zählt die gemeldete Bedeckung (im Rahmen der Lage, wxCover), bei Regen, Schnee & Co. die Wetterlage
    const dry = !def.rain && !def.snow && !def.storm && !def.fog;
    const cover = dry ? wxCover(def, raw.cover) : def.cover;
    // Schneedecke: wächst bei Schneefall zu (ein Hauch liegt sofort), bleibt danach liegen und taut (snowDepth).
    // In Stufen von 1/20, sonst gälte alle 20 s ein neues Wetter.
    // (Schneeregen bei Frost: gerundet wie im Verlauf, wxLogAdd)
    const snowing = raw.cond === 'snowy' || (raw.cond === 'snowy-rainy' && raw.temp != null && Math.round(raw.temp) <= 0);
    const depth = this._dbgSnow ?? snowDepth(this._wxLog || [], this._haNow());
    const snow01 = Math.round(clamp(Math.max(depth, snowing ? SNOW.show : 0), 0, 1) * 20) / 20;
    const fx = {
      cover,
      rain: def.rain || 0,
      snow: def.snow || 0,
      fog: !!def.fog,
      flash: !!def.flash,
      storm: !!def.storm,
      hail: raw.cond === 'hail', // zählt als Starkregen, aber Frosch und Schnecke bleiben weg
      windy: !!def.wind || raw.wind >= 30,
      cold: raw.temp != null && raw.temp < 3,
      chilly: raw.temp != null && raw.temp < 12, // Ofen an, Schornstein raucht
      // Schnee liegt: bei Schneefall sofort (wie bisher) und danach, bis die Decke unter SNOW.show getaut ist
      snowcover: snowing || snow01 >= SNOW.show,
      snow01,
    };
    // Dichte Wolken: Mond und Sterne sind weg
    fx.dense = cover >= 85 || fx.rain > 0 || fx.snow > 0 || fx.storm || fx.fog;
    fx.wet = fx.rain > 0 || fx.flash; // Blatt als Regenschirm
    fx.shelter = fx.storm; // bei Starkregen und Gewitter bleibt er vor seinem Bau
    // Windrichtung = woher der Wind kommt. Aus Westen ziehen Wolken nach Osten, im Bild (Blick nach Süden) also
    // nach links; beim Blick nach Norden (Südhalbkugel) nach rechts. fromWest heißt ab hier: weht im Bild nach links.
    const fromWest = !(raw.bearing > 0 && raw.bearing < 180) !== this._viewN();
    this._wind = raw.wind;
    this._windDir = fromWest ? -1 : 1; // wohin der Wind im Bild weht (Drachen)
    const key = JSON.stringify([fx, Math.round(raw.wind / 5), fromWest]);
    if (key === this._wxKey) return;
    this._wxKey = key;
    const wasShelter = this._wx.shelter;
    const wasWet = this._wx.wet;
    const wasSnow = this._wx.snowcover;
    this._wx = fx;

    const sc = this._el.scene.classList;
    sc.toggle('overcast', cover >= 70);
    sc.toggle('dense', fx.dense);
    sc.toggle('storm', fx.storm);
    sc.toggle('foggy', fx.fog);
    sc.toggle('windy', fx.windy);
    sc.toggle('snowcover', fx.snowcover);
    sc.toggle('chilly', fx.chilly);
    sc.toggle('wind-w', fromWest);
    const st = this._el.scene.style;
    const lean = Math.min(raw.wind * 0.7, 28) * (fromWest ? -1 : 1);
    // Wolken: bei Windstille gemächlich (0,77-fach), bei Sturm gut dreimal so schnell; fromWest: nach links
    this._cloudRate = 1 / clamp(1.3 - raw.wind / 35, 0.3, 1.3);
    this._cloudRev = fromWest;
    st.setProperty('--slant', `${lean.toFixed(1)}deg`);
    st.setProperty('--sw1', fromWest ? '-14deg' : '-2deg');
    st.setProperty('--sw2', fromWest ? '2deg' : '14deg');
    st.setProperty('--smx', `${((fromWest ? -1 : 1) * (4 + Math.min(raw.wind, 40) / 4)).toFixed(1)}px`);
    st.setProperty('--starop', starOp(cover, fx.dense).toFixed(2));
    const n = Math.round((cover / 100) * this._el.clouds.length);
    this._el.clouds.forEach((c, i) => c.classList.toggle('on', i < n));
    this._setPrecip(fx.rain, fx.snow);
    this._light();
    this._bowSync();
    const p = this._el.pika.classList;
    p.toggle('wet', fx.wet);
    p.toggle('cold', fx.cold);
    // Wolken zuletzt: Die Animationen zu befragen lässt den Browser alle Stiländerungen von oben sofort durchrechnen
    this._cloudWind();
    // Unwetter beginnt: ab in den Bau. Sitzt er dort schon vor dem Fernseher, bleibt er sitzen (der Abbruch schaltete
    // den Fernseher aus und gleich wieder ein).
    if (fx.shelter && !wasShelter && !this._asleep && this._action !== 'eatFood' && !(this._action === 'tv' && this._inside)) this._interrupt();
    // Regen oder Schnee beginnt oder endet: eine Beschäftigung, die beim neuen Wetter nicht geht, einpacken (sonst
    // springt er Seil mit dem Blatt als Schirm, liegt mit dem Tablet im Regen, hüpft in der Sonne in eine Pfütze
    // oder baut auf der grünen Wiese am Schnee-Pika weiter)
    else if ((fx.wet !== wasWet || fx.snowcover !== wasSnow) && !this._asleep
      && WX_STOP.includes(this._action) && !this._actOk(this._action)) this._interrupt();
  }

  // Regen und Schnee je als eigener Satz von Teilchen. Ändert sich die Stärke, blendet der neue Satz ein und der alte
  // aus, statt hart umzuschalten. Die Teilchen stehen fest (seeded, nach ihrer Nummer): Von Regen auf Starkregen
  // bleiben die ersten 40 Tropfen, wo sie sind, es kommen nur welche dazu. Die Ebenen laufen nach der Uhr, ein
  // neuer Satz fällt also im Gleichschritt mit dem alten.
  _setPrecip(rain, snow) {
    this._precipSet('r', rain);
    this._precipSet('s', snow);
  }

  _precipSet(kind, n) {
    const sets = (this._precipSets ??= {});
    const old = sets[kind];
    if ((old?.n || 0) === n) return;
    if (old) {
      old.el.classList.remove('on');
      setTimeout(() => old.el.remove(), 2700);
    }
    sets[kind] = null;
    if (!n) return;
    const snow = kind === 's';
    const K = snow ? 2 : 1;
    const u = (i, j, a, b) => a + seeded(K, i, j) * (b - a);
    // Jedes Teilchen steht zweimal in seiner Ebene, eine halbe Ebenenhöhe auseinander (siehe .precip .pl)
    const twice = (y, style) => `<i class="${kind}" style="top:${y.toFixed(1)}%;${style}"></i>`
      + `<i class="${kind}" style="top:${(y + 50).toFixed(1)}%;${style}"></i>`;
    const one = (i) => {
      const at = `left:${u(i, 1, 0, 100).toFixed(1)}%`;
      if (!snow) return twice(u(i, 0, 0, 50), `${at};opacity:${u(i, 2, 0.45, 0.95).toFixed(2)}`);
      const s = u(i, 3, 2.5, 5).toFixed(1);
      return twice(u(i, 0, 0, 50), `${at};width:${s}px;height:${s}px;opacity:${u(i, 2, 0.6, 1).toFixed(2)}`);
    };
    // Dauer einer Runde (1,2 Kartenhöhen): Regen 1,85–2,75 Höhen/s, Schnee 0,14–0,21 Höhen/s
    const durs = snow ? [8.6, 7.1, 5.7] : [0.65, 0.53, 0.44];
    const sways = snow ? [7.7, 6.3, 5.3] : null;
    const t = Date.now() / 1000;
    const el = document.createElement('div');
    el.className = 'pset';
    el.innerHTML = durs.map((d, l) => {
      let h = '';
      for (let i = l; i < n; i += durs.length) h += one(i);
      const inner = sways ? `<div class="pw" style="--pw:${sways[l]}s;animation-delay:${(-(t % sways[l])).toFixed(2)}s">${h}</div>` : h;
      return `<div class="pl" style="--pd:${d}s;animation-delay:${(-((t + seeded(K, l) * d) % d)).toFixed(2)}s">${inner}</div>`;
    }).join('');
    this._el.precip.appendChild(el);
    void el.offsetWidth; // erst ohne Deckkraft im Bild, dann einblenden
    el.classList.add('on');
    sets[kind] = { n, el };
  }

  // Tempo und Richtung der Wolken an der laufenden Animation stellen. Dauer und Versatz im Stil stehen fest:
  // Ein anderes Tempo (playbackRate) lässt jede Wolke von ihrer Stelle aus weiterziehen. Dreht der Wind, läuft
  // die Animation andersherum, und ihre Zeit wird so gestellt, dass die Wolke bleibt, wo sie ist. Ohne die
  // Schnittstelle (sehr alte Browser) ziehen die Wolken gleichmäßig nach rechts.
  // Die Animationen zu befragen (playState) lässt den Browser offene Stiländerungen sofort durchrechnen: Darum
  // steht der Aufruf am Ende von _applyWeather und _layoutSky, und er steigt aus, bevor er eine Animation anfasst,
  // solange Tempo, Richtung und die eingeschalteten Wolken dieselben sind (_cloudSig; läuft auch im 20-s-Takt).
  _cloudWind() {
    // Unsichtbar ruhen die Animationen (.paused): erst beim Wiedersehen stellen (_hiddenSky)
    if (this._away()) return;
    const clouds = this._el?.clouds || [];
    const rate = this._cloudRate || 1;
    const dir = this._cloudRev ? 'reverse' : 'normal';
    const sig = `${rate.toFixed(3)}|${dir}|${clouds.map((el) => (el.classList.contains('on') ? 1 : 0)).join('')}`;
    if (sig === this._cloudSig) return;
    this._cloudSig = sig;
    for (const el of clouds) {
      // Nur eingeschaltete: Eine ausgeblendete Wolke steht still (animation-play-state) und wird gestellt, sobald sie
      // angeht. Das geschieht im selben Schritt nach dem Einschalten, sie zieht also nie erst falsch herum los.
      if (!el.classList.contains('on')) continue;
      // Die Animation je Wolke merken. Wird die Karte neu eingehängt, legt der Browser neue an (die alte ist „idle“).
      let a = el._drift;
      if (!a || a.playState === 'idle') {
        a = el._drift = el.getAnimations?.().find((x) => x.animationName === 'drift') || null;
      }
      const fx = a?.effect;
      if (!fx?.getComputedTiming || !fx.updateTiming) continue;
      // Das zuletzt verlangte Tempo merken: playbackRate nennt bis zum nächsten Bild noch das alte
      if (a._rate !== rate) {
        a._rate = rate;
        a.updatePlaybackRate(rate);
      }
      const T = fx.getComputedTiming();
      if (T.direction === dir || !(T.duration > 0)) continue;
      // Stelle im Durchlauf spiegeln: aus 30 % vorwärts werden 70 % rückwärts, das ist derselbe Ort
      const local = Number(a.currentTime ?? 0) - T.delay;
      const turn = Math.floor(local / T.duration);
      const part = local / T.duration - turn;
      // Die Zeit darf nicht unter null fallen (dort gälte die Animation als noch nicht begonnen): ganze Durchläufe dazu
      let ct = (turn + 1 - part) * T.duration + T.delay;
      while (ct < 0) ct += T.duration;
      fx.updateTiming({ direction: dir });
      a.currentTime = ct;
    }
  }

  _lightning() {
    if (!this._wx.flash) return;
    const f = this._el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
    if (!this._asleep && this._g) {
      // erschrickt kurz
      setTimeout(() => {
        this._jump('hop1');
        this._say('!', 900);
      }, 250);
    }
  }
}
