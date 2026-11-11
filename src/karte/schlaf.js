// Schlaf: Schlafenszeit und Wachfenster, Wachzeit rechnen, einschlafen, aufwachen, Tagesgedächtnis und Träume

import { rnd, pick, weighted, minutes } from '../logik/hilfen.js';
import { sunTimes } from '../logik/himmel.js';
import { MEM_BITS, pikaDay } from '../logik/tagesplan.js';
import { FOOD } from '../grafik/szene.js';
import { DREAM } from '../grafik/momente.js';

export class Schlaf {
  // Ohne Übergang einschlafen (im Bau) bzw. aufwachen (vor dem Bau)
  _sleepNow(on) {
    const p = this._el.pika;
    this._asleep = on;
    this._lift = 0;
    this._lane = 0;
    p.classList.toggle('sleeping', on);
    this._giftScene();
    if (on) {
      this._setX(this._g.home, true);
      this._inside = true;
      this._pose('sleep', 0);
    } else if (this._inside) {
      this._inside = false;
      this._pose('out', 0);
    }
  }

  async _goSleep() {
    const p = this._el.pika;
    this._say('*gähn*');
    p.classList.add('yawning');
    await this._wait(2200);
    p.classList.remove('yawning');
    if (!this._inside) await this._enterBurrow(0.7, true);
    await this._wait(900);
    this._face(1);
    this._el.pika.classList.add('sleeping');
    this._pose('sleep', 1400);
    this._asleep = true;
    this._updateSky();
    this._giftScene();
  }

  async _wakeUp() {
    this._asleep = false;
    const p = this._el.pika;
    if (this._inside) this._pose('peek', 900);
    p.classList.remove('sleeping', 'peek');
    p.classList.add('stretch');
    this._updateSky();
    this._giftScene();
    try {
      await this._wait(1300);
    } finally {
      p.classList.remove('stretch');
    }
    this._say('iiep!');
    await this._wait(900);
  }

  // ---------- Träume ----------

  // Tagesgedächtnis im Tagesplan: was der Pika heute erlebt hat (Pino, Kaffee, Flieger …), egal auf welchem Gerät
  // es zu sehen war. Geschrieben wird nur beim ersten Mal je Art und Tag.
  _memo(kind) {
    const b = 1 << MEM_BITS.indexOf(kind);
    if (b < 1) return;
    const c = this._cuteToday();
    if (!(c.m & b)) this._planOp({ t: 'mem', d: c.d, b });
  }

  // Was er an diesem Pika-Tag erlebt hat, träumt er dreimal so oft. Schläft er schon vor 4 Uhr ein, ist es heute;
  // wacht er nach 4 Uhr noch nicht gleich auf, gilt noch der Vortag.
  _dreamSvg() {
    const opts = [[1, 'lz'], [1, 'heart'], [0.6, 'klee']];
    const c = this._plan?.cute;
    if (c && c.d >= pikaDay(this._haNow()) - 1) MEM_BITS.forEach((k, i) => c.m & (1 << i) && opts.push([3, k]));
    return DREAM[weighted(opts)];
  }

  // Denkblase nach Traum oder Kaffeeduft wieder mit dem Löwenzahn füllen (für „hat Hunger“): erst, wenn sie
  // ausgeblendet ist. Sofort getauscht, zeigte sie beim Abbruch (aufgeweckt) im Ausblenden kurz den Löwenzahn in der
  // bläulichen Traumblase. now: gleich (die Blase wird jetzt gebraucht).
  _thinkReset(now = false) {
    clearTimeout(this._thinkT);
    const think = this._el.think;
    const reset = () => {
      think.innerHTML = FOOD.lz.svg;
      think.classList.remove('dream');
    };
    if (now) return reset();
    this._bubble(think, false);
    this._thinkT = setTimeout(reset, 350);
  }

  // Im Schlaf: ab und zu ein Traum, Zucken, Schmatzen oder Murmeln
  async _dream() {
    const dbg = this._dbgDream; // Vorschau: gleich träumen
    this._dbgDream = false;
    await this._wait(dbg ? 300 : rnd(25000, 55000));
    if (!this._asleep) return;
    const p = this._el.pika;
    const r = dbg ? 0 : Math.random();
    if (r < 0.4) {
      const think = this._el.think;
      clearTimeout(this._thinkT);
      think.innerHTML = this._dreamSvg();
      think.classList.add('dream');
      try {
        this._bubble(think, true);
        p.classList.add('content');
        await this._wait(rnd(4000, 6500));
        if (Math.random() < 0.5) this._cls('mlem', 950, true);
        await this._wait(1200);
        this._bubble(think, false);
        await this._wait(400);
      } finally {
        this._thinkReset();
      }
    } else if (r < 0.6) {
      this._cls('stw', 550, true);
    } else if (r < 0.75) {
      // vom Freund murmelt er nur, wenn der auch zu Besuch kommt (friend: false)
      this._say(pick(['mip…', 'mmh…', 'zzz… Löwenzahn…', ...(this._cfg.friend ? [`${this._frName()}…`] : []), 'hihi…']), 1800);
    } else if (r < 0.85) {
      this._cls('mlem', 950, true);
    }
  }

  // Schläft er jetzt (Uhr von HA)? Dieselben Wachfenster wie für Häufchen, Päckchen und den Abbau im Schlaf.
  _sleepTime() {
    if (this._dbgSleep != null) return this._dbgSleep;
    const t = this._haNow();
    return !this._wakeWins(t, t).some(([ws, we]) => t >= ws && t < we);
  }

  // Wachfenster [Beginn, Ende] (ms) am Kalendertag day (Ortszeit). Schlafen nach Mitternacht: Ende am Folgetag.
  // Mit Ort (hass.config) aus Datum und Ort gerechnet, also auf allen Geräten gleich und am Tag der Zeitumstellung
  // richtig; gemerkt je Tag, solange Einstellung und Ort gleich bleiben.
  _wakeDay(day) {
    const [y, mo, d] = [day.getFullYear(), day.getMonth(), day.getDate()];
    const cfg = this._hass?.config;
    const geo = !!cfg && Number.isFinite(cfg.latitude) && Number.isFinite(cfg.longitude);
    const fixed = !/sun/i.test(`${this._cfg.sleep_start} ${this._cfg.sleep_end}`);
    const sig = `${this._cfg.sleep_start}|${this._cfg.sleep_end}|${geo ? `${cfg.latitude},${cfg.longitude},${cfg.elevation}` : '-'}`;
    if (this._wdSig !== sig) {
      this._wdSig = sig;
      this._wdC = new Map();
    }
    const key = y * 400 + mo * 32 + d;
    const hit = this._wdC.get(key);
    if (hit) return hit;
    const a = this._sleepMinutes(this._cfg.sleep_start, 21 * 60, day);
    const b = this._sleepMinutes(this._cfg.sleep_end, 7 * 60, day);
    const w = [new Date(y, mo, d, 0, b).getTime(), new Date(y, mo, d + (a > b ? 0 : 1), 0, a).getTime()];
    // Ohne Ort kommen Sonnenzeiten aus sun.sun (je Gerät): nicht merken
    if (geo || fixed) {
      if (this._wdC.size > 400) this._wdC.clear();
      this._wdC.set(key, w);
    }
    return w;
  }

  // "21:00", "sunset", "sunset+01:00", "sunrise-30" (Minuten) → Minuten nach Mitternacht, Unverständliches → fallback.
  // Sonnenauf- und -untergang am Kalendertag day (ohne: heute) aus Ort und Datum (sunTimes): so hat jeder Tag seine
  // eigenen Zeiten, alle Geräte rechnen gleich, und am Abend vor der Zeitumstellung stimmt es auch. Nur ohne Ort aus
  // sun.sun (next_rising/next_setting). Die springen genau beim Ereignis auf morgen: Ist das morgige ein, zwei Minuten
  // später, wäre direkt nach dem Aufwachen wieder Schlafenszeit. Darum gilt dort je Kalendertag der erste Wert, der kam.
  _sleepMinutes(spec, fallback, day) {
    const m = String(spec ?? '').trim().toLowerCase()
      .match(/^(sunrise|sunset)\s*(?:([+-])\s*(?:(\d{1,2}):(\d{2})|(\d+)))?$/);
    if (!m) {
      const v = minutes(spec);
      if (v == null && !this._badSpec?.has(spec)) {
        (this._badSpec ??= new Set()).add(spec);
        console.warn(`pika-pet-card: Uhrzeit "${spec}" nicht verstanden (erlaubt: "21:00", "sunset", "sunset+01:00", "sunrise-30")`);
      }
      return v ?? fallback;
    }
    const rise = m[1] === 'sunrise';
    const cfg = this._hass?.config;
    const at = cfg && Number.isFinite(cfg.latitude) && Number.isFinite(cfg.longitude)
      && sunTimes(day || new Date(this._haNow()), cfg.latitude, cfg.longitude, Number(cfg.elevation) || 0);
    let v;
    if (at) {
      const t = new Date(rise ? at.rise : at.set);
      v = t.getHours() * 60 + t.getMinutes();
    } else {
      const attr = rise ? 'next_rising' : 'next_setting';
      const today = new Date(this._haNow()).toDateString();
      const c = this._sunMin?.[attr];
      if (c?.day === today) v = c.v;
      else {
        const t = new Date(this._hass?.states[this._cfg.sun_entity]?.attributes?.[attr] ?? NaN);
        if (Number.isNaN(t.getTime())) return fallback; // sun.sun (noch) nicht da: nicht merken
        v = t.getHours() * 60 + t.getMinutes();
        (this._sunMin ??= {})[attr] = { day: today, v };
      }
    }
    const sign = m[2] === '-' ? -1 : 1;
    const off = m[3] != null ? Number(m[3]) * 60 + Number(m[4]) : Number(m[5] || 0);
    return (((v + sign * off) % 1440) + 1440) % 1440;
  }

  // Wachfenster [Beginn, Ende] (ms) je Tag, von einem Tag vor t1 bis einen Tag nach t2 (siehe _wakeDay)
  _wakeWins(t1, t2) {
    const w = [];
    const day = new Date(t1);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 1);
    for (let i = 0; i < 20000 && day.getTime() <= t2 + 864e5; i++) {
      w.push(this._wakeDay(day));
      day.setDate(day.getDate() + 1);
    }
    return w;
  }

  // Wachzeit (ms) zwischen t1 und t2
  _awakeMs(t1, t2) {
    if (!(t2 > t1)) return 0;
    let ms = 0;
    for (const [ws, we] of this._wakeWins(t1, t2)) ms += Math.max(0, Math.min(we, t2) - Math.max(ws, t1));
    return ms;
  }

  // Wann nach t weitere ms Wachzeit vergangen sind (sleepK: so zählt Schlaf, 0 = gar nicht). Tag für Tag, ohne Grenze
  // nach vorn: auch eine lange Serie oder ein langer Abbau kommt ans Ende.
  _awakeAdd(t, ms, sleepK = 0) {
    const day = new Date(t);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 1);
    for (let i = 0; i < 20000; i++) {
      const [ws, we] = this._wakeDay(day);
      day.setDate(day.getDate() + 1);
      if (we <= t) continue;
      if (ws > t && sleepK > 0) {
        const d = (ws - t) * sleepK;
        if (d >= ms) return t + ms / sleepK;
        ms -= d;
      }
      const s = Math.max(ws, t);
      if (s + ms <= we) return s + ms;
      ms -= we - s;
      t = we;
    }
    return t + ms;
  }
}
