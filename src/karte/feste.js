// Festtage: Kalender, Deko, Feuerwerk, Konfetti und die Aktionen dazu

import { rnd, pick, clamp, seeded } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { festDay, festEaster, festAdvent1, FEST_AHEAD, festMoments, festBirthdate, festNames } from '../logik/feste.js';
import { OUT } from '../grafik/pika.js';
import {
  FEST_COLORS, FEST_FW_COLORS, festF1, festSvg, FEST_EDGE, FEST_LIGHTS, FEST_STREAMERS, FEST_PUMPKIN, FEST_LANTERN,
  FEST_CARRY, FEST_WREATH, FEST_BOOT, FEST_TREE, FEST_GIFT, FEST_MAI, FEST_CAKE, FEST_EGG, FEST_STICK, FEST_BAT,
} from '../grafik/feste.js';
import { RAND_SVG } from '../grafik/areale.js';

export class Feste {
  // Welche Feste heute sind, bestimmt _festToday() aus der Ortszeit (Vorschau: _dbgDate). Der 20-s-Takt prüft
  // neu; ändert sich etwas, wird die Deko neu aufgebaut. Alles ist Zierde: nichts kostet Werte, nichts wird gesammelt.
  _hassFest(hass) {
    // Geburtstage stehen in der Konfiguration: bei neuer Konfiguration gleich neu bestimmen
    if (this._cfg !== this._festCfg && this._el) {
      this._festCfg = this._cfg;
      this._festEnsure();
      this._festUpdate();
    }
  }

  _attachFest() {
    this._festEnsure();
    this._festUpdate(true);
  }

  _detachFest() {
    clearTimeout(this._festFwT);
    this._festFwT = null;
    clearTimeout(this._festCakeT);
    // Der Zeitgeber, der die Kerze wieder anzündet, ist weg: also gleich wieder an (sonst bliebe sie den Tag aus)
    this._festCakeOut = false;
    this._festT?.forEach((t) => clearTimeout(t));
    this._festT?.clear();
    this._festArmed = null; // die Wecker für Mitternacht und „Helau!“ sind mit weg
    if (this._festEls) this._festEls.sky.innerHTML = this._festEls.cf.innerHTML = '';
  }

  _hiddenFest(hidden) {
    if (hidden && this._festEls) this._festEls.sky.innerHTML = this._festEls.cf.innerHTML = '';
    this._festFwSync();
  }

  _layoutFest(first) {
    this._festEnsure();
    this._festUpdate(true);
  }

  _tickFest() {
    if (!this._el) return;
    this._festEnsure();
    this._festUpdate();
    const f = this._fest;
    // Jahreswechsel und „Helau!“: Steht einer bevor, wartet ein Zeitgeber genau bis dahin (_festArm). Hier wird nur
    // nachgeholt, was dieses Gerät verpasst hat (Bildschirm um 0:03 an)
    this._festArm();
    this._festMidnight();
    if (this._away() || !this._g) return;
    // Halloween-Nacht: ab und zu flattert eine Fledermaus über den Himmel
    if (f.witch && this._festDark() && Math.random() < 0.35) this._festBat();
    // Karneval: alle paar Minuten kurz Konfetti, aber nur, wenn er wach ist, es hell und trocken ist (nachts
    // sähe es keiner, im Regen passt es nicht; fällig gebliebenes kommt, sobald es wieder passt)
    const party = !this._asleep && !this._festDark() && !this._wx.wet;
    if (f.karneval) {
      const t = Date.now();
      this._festCfNext ??= t + rnd(5, 30) * 1000;
      if (t >= this._festCfNext && party) {
        this._festConfettiRain();
        this._festCfNext = t + rnd(2, 5) * 60000;
      }
    } else this._festCfNext = null;
    this._festHelau();
    // Maibaum: Bänder drehen mit dem Wind
    const mai = this._festEls?.back.querySelector('.fmai');
    if (mai) mai.style.setProperty('--wd', this._windDir < 0 ? -1 : 1);
  }

  // Zeitgeber für die Augenblicke, die überall in derselben Sekunde kommen (festMoments): Der 20-Sekunden-Takt hat
  // auf jedem Gerät eine andere Phase, Finale und „Helau!“ lagen darum bis zu 20 s auseinander. Jetzt löst die Uhr
  // von HA aus; der Takt stellt nur rechtzeitig den Wecker. Nach einem Uhrenabgleich wird neu gestellt (_clockMoved),
  // der alte Wecker prüft die Uhr selbst und tut zur falschen Zeit nichts.
  _festArm() {
    const now = this._festNow();
    const M = festMoments(now);
    const A = (this._festArmed ??= {});
    for (const [k, fn] of [['mid', () => this._festMidnight()], ['helau', () => this._festHelau()]]) {
      const ms = M[k] - now;
      if (ms <= 0 || ms > FEST_AHEAD || A[k] === M[k]) continue;
      A[k] = M[k];
      this._festLater(fn, ms + 30);
    }
  }

  // Mitternacht an Neujahr: Finale, und der Pika wacht auf und schaut aus dem Bau. Nur sichtbar: sonst liefe es
  // ungesehen ab, und wer den Bildschirm um 0:03 einschaltet, bekäme keins mehr (bis 0:05 holt der Takt es nach)
  _festMidnight() {
    const d = new Date(this._festNow());
    if (!this._fest?.fireworks || this._away() || !this._g || this._festMidY === d.getFullYear()
      || d.getMonth() !== 0 || d.getDate() !== 1 || d.getHours() !== 0 || d.getMinutes() >= 5) return;
    this._festMidY = d.getFullYear();
    this._festFinale();
    this._festForce('festFireworks');
  }

  // 11. 11. um 11:11: Auftakt der Karnevalszeit, einmal kurz Konfetti und „Helau!“, wenn er wach, es hell und
  // trocken ist (bis 11:13 holt der Takt es nach)
  _festHelau() {
    const d = new Date(this._festNow());
    if (this._cfg?.festive === false || this._away() || !this._g || this._festKickY === d.getFullYear()
      || d.getMonth() !== 10 || d.getDate() !== 11 || d.getHours() !== 11 || d.getMinutes() < 11 || d.getMinutes() >= 14) return;
    if (this._asleep || this._festDark() || this._wx.wet || this._wx.shelter) return;
    this._festKickY = d.getFullYear();
    if (this._inside || this._lift > 0) {
      this._festConfettiRain();
      this._say('Helau!', 1500);
    } else this._festForce('festConfetti');
  }

  _festActs({ wx, g }) {
    const f = this._fest || {};
    const pos = this._festPos || {};
    const ok = (n, min) => Date.now() >= ((this._festLast || {})[n] || 0) + min * 60000;
    const dry = !wx.wet;
    const out = [];
    // Gewicht 0 in der Pause: so bleibt der Name in der Liste (Vorschau „Aktion“)
    if (f.halloween && pos.pumpkin) out.push([dry && ok('festPumpkin', 4) ? 1.5 : 0, 'festPumpkin']);
    if (f.martin?.walk) out.push([dry && ok('festLantern', 3) ? 3 : 0, 'festLantern']);
    if (f.boot && pos.boot) out.push([ok('festBoot', 5) ? 1.6 : 0, 'festBoot']);
    if (f.xmas && pos.tree) out.push([ok('festTree', 4) ? 2 : 0, 'festTree']);
    if (f.fireworks) out.push([ok('festFireworks', 2) ? 12 : 0, 'festFireworks']);
    if (f.karneval) out.push([dry && ok('festConfetti', 4) ? 1.6 : 0, 'festConfetti']);
    if (f.ostern && this._festEggs?.length) out.push([ok('festEgg', 3) ? 2 : 0, 'festEgg']);
    if (f.birthday && pos.cake) out.push([!this._festCakeOut && ok('festBirthday', 4) ? 2.5 : 0, 'festBirthday']);
    // Sommerfest: öfter Freudensprünge
    if (f.sommer) out.push([dry && g > 30 ? 3 : 0, 'binky']);
    return out;
  }

  // Uhr von HA: Feuerwerk, Finale und „Helau!“ kommen auf allen Geräten im selben Moment
  _festNow() {
    return this._dbgDate ?? this._haNow();
  }

  _festDark() {
    const sc = this._el.scene.classList;
    return sc.contains('night') || sc.contains('dusk');
  }

  _festMark(name) {
    (this._festLast ||= {})[name] = Date.now();
  }

  // Kurzer Zeitgeber, der beim Abhängen der Karte mit aufgeräumt wird
  _festLater(fn, ms) {
    this._festT ||= new Set();
    const t = setTimeout(() => {
      this._festT.delete(t);
      fn();
    }, ms);
    this._festT.add(t);
  }

  // Beginn eines Abendfensters (Minuten nach Mitternacht): zur Uhrzeit at, bei früher Schlafenszeit (Standard:
  // Sonnenuntergang, im November gegen halb fünf) aber schon lead Minuten davor. Sonst verschliefe er Laternenumzug
  // und leeren Stiefel. Geht er erst nach Mitternacht schlafen, bleibt es bei at.
  _festEve(now, at, lead) {
    if (!this._cfg) return at;
    const bed = (this._wakeDay(now)[1] - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 60000;
    return Math.min(at, bed - lead);
  }

  // Aktive Feste am (Orts-)Datum. festive: false lässt nur die Geburtstage übrig.
  _festToday(at = this._festNow()) {
    const now = new Date(at);
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    const d = now.getDate();
    const h = now.getHours();
    const hm = h * 60 + now.getMinutes();
    const md = mo * 100 + d;
    const day = festDay(y, mo, d);
    const f = { year: y };
    if (this._cfg?.festive !== false) {
      // Die Halloween-Nacht geht bis zum Morgen: Kürbis, Hexenhut und Fledermäuse bleiben am 1. 11. bis 6 Uhr
      const hwNight = md === 1101 && h < 6;
      if ((md >= 1024 && md <= 1031) || hwNight) f.halloween = true;
      if (md === 1031 || hwNight) f.witch = true;
      if (md === 1111) f.martin = { walk: hm >= this._festEve(now, 16 * 60, 90) };
      const adv = festAdvent1(y);
      if (day >= adv && md <= 1224) f.advent = { candles: Math.min(4, 1 + Math.floor((day - adv) / 7)) };
      if (day >= adv || md <= 106) f.lights = true; // Lichterkette vom 1. Advent bis Heilige Drei Könige
      if ((md === 1205 && hm >= this._festEve(now, 18 * 60, 120)) || md === 1206) f.boot = { full: md === 1206 };
      if (md >= 1224 && md <= 1226) f.xmas = true;
      if ((md === 1231 && hm >= 23 * 60 + 55) || (md === 101 && h < 1)) f.fireworks = true;
      if (md === 101 && h >= 1) f.sticks = true;
      const [em, ed] = festEaster(y);
      const e = festDay(y, em, ed);
      // Weiberfastnacht (Ostern − 52) bis einschließlich Aschermittwoch (Ostern − 46)
      if (day >= e - 52 && day <= e - 46) f.karneval = true;
      if (day >= e - 2 && day <= e + 1) f.ostern = true; // Karfreitag bis Ostermontag
      if ((md === 430 && h >= 18) || md === 501) f.maibaum = true;
      if (md === 621) f.sommer = true;
    }
    // Geburtstage: der 29. 2. wird sonst am 28. 2. gefeiert. Lesen: festBirthdate (unbekannt: einmal warnen)
    const leap = new Date(y, 1, 29).getMonth() === 1;
    const names = (Array.isArray(this._cfg?.birthdays) ? this._cfg.birthdays : []).filter((b) => {
      const md2 = festBirthdate(b?.date);
      if (!md2) {
        const k = `${b?.name}|${b?.date}`;
        if (!(this._festWarned ||= new Set()).has(k)) {
          this._festWarned.add(k);
          console.warn(`pika-pet-card: Geburtstag ${b?.name ?? '?'}: Datum "${b?.date}" nicht erkannt (MM-TT, JJJJ-MM-TT, TT.MM. oder TT.MM.JJJJ)`);
        }
        return false;
      }
      let [bm, bd] = md2;
      if (bm === 2 && bd === 29 && !leap) bd = 28;
      return bm === mo && bd === d;
    }).map((b) => String(b.name || '').trim()).filter(Boolean);
    if (names.length) f.birthday = { names };
    return f;
  }

  _festEnsure() {
    if (this._festEls || !this._el?.festB) return;
    const B = this._el.festB;
    const F = this._el.festF;
    B.innerHTML = '<div class="fsky"></div><div class="fback"></div><div class="fon"></div>';
    F.innerHTML = '<div class="ffront"></div><div class="fcf"></div><div class="fwl"></div>';
    this._festEls = {
      sky: B.children[0], back: B.children[1], on: B.children[2],
      front: F.children[0], cf: F.children[1], light: F.children[2],
    };
    // Laterne am Stab hoppelt mit dem Pika mit (in der Ebene .hop, dreht sich mit ihm um)
    this._el.pika.querySelector('.hop').insertAdjacentHTML('beforeend', `<div class="fest-carry">${FEST_CARRY}</div>`);
  }

  // Feste neu bestimmen; bei Wechsel (oder force) Hüte und Deko neu
  _festUpdate(force) {
    const f = this._festToday();
    const key = JSON.stringify(f);
    const changed = key !== this._festKey;
    this._festKey = key;
    this._fest = f;
    if (changed && !f.birthday) this._festCakeOut = false;
    if (changed || force) {
      const p = this._el.pika.classList;
      const hat = f.xmas ? 'xmas' : f.birthday ? 'party' : f.witch ? 'witch' : f.karneval ? 'party' : null;
      for (const h of ['witch', 'xmas', 'party']) p.toggle(`fest-${h}`, hat === h);
      // Pino trägt an Weihnachten auch eine Mütze (Regel .fest-xmas .hat-xmas), Hexen- und Partyhut nie
      this._el.friends.classList.toggle('fest-xmas', !!f.xmas);
      this._festRender();
    }
    this._festFwSync();
  }

  // Deko aufbauen. Plätze: rechts und links neben der Tür, die Wiese zwischen Heu und Stein, die Bau-Oberkante,
  // hinter dem Bau; Statusleiste links oben und die Knöpfe rechts oben bleiben frei.
  _festRender() {
    const E = this._festEls;
    if (!E || !this._g) return;
    const f = this._fest || {};
    const { gy, hole, rock, bur, hayL, hayR } = this._g;
    const W = this._W;
    const H = this._H;
    const A = this._areal();
    const back = [];
    const on = [];
    const front = [];
    // Bodenrechtecke der Deko in px: { x: Mitte, l: linke Kante, top, w, h } (Kuchen, Kürbis, Stiefel, Baum
    // nutzen sie für ihre Aktionen).
    const pos = {};
    // hayL/hayR: Heuhaufen in voller Größe (wächst bis scale 1,06 von H · 0,26) bzw. Vorratsnische
    // Plätze: Wunschmitte x und freier Bereich a..b (Tür, Heu, Stein). Passt eine Grafik nicht hinein
    // (schmale Karte), wird sie bis auf 70 % kleiner, statt ins Heu zu ragen oder wegzufallen.
    const slots = {
      R: { x: hole.r + H * 0.1, a: hole.r, b: Math.max(hole.r + H * 0.1, hayL) },
      L: { x: hole.l - H * 0.075, a: 4, b: hole.l + H * 0.01 },
      M: { x: (hayR + rock.l) / 2, a: hayR, b: Math.max(hayR + H * 0.1, rock.l) },
    };
    const used = new Set();
    // Erster freier Platz der Wunschliste; sind alle belegt, der erste (lieber eng als gar nicht)
    const slot = (...prefs) => {
      const s = prefs.find((k) => !used.has(k)) || prefs[0];
      used.add(s);
      return slots[s];
    };
    // Breite und Mitte im Platz s für Wunschbreite w
    const fit = (s, w) => {
      const w2 = Math.max(w * 0.7, Math.min(w, s.b - s.a));
      return [w2 > s.b - s.a ? (s.a + s.b) / 2 : clamp(s.x, s.a + w2 / 2, s.b - w2 / 2), w2];
    };
    // Grafik mit Boden bei bottom, mittig über x
    const item = (cls, x, bottom, w, art, name, style = '') => {
      const h = (w * art.vb[1]) / art.vb[0];
      if (name) pos[name] = { x, l: x - w / 2, top: bottom - h, w, h };
      return `<div class="fi ${cls}" style="left:${festF1(x - w / 2)}px;top:${festF1(bottom - h)}px;width:${festF1(w)}px;height:${festF1(h)}px${style}">`
        + `${festSvg(art.vb, art.b, 'b')}${art.g ? festSvg(art.vb, art.g, 'g') : ''}</div>`;
    };
    // Grafik in Bau-Einheiten, genau über dem Bau
    const onBur = (cls, art) => `<div class="fi ${cls}" style="left:${festF1(bur.l)}px;top:${festF1(bur.base)}px;`
      + `width:${festF1(100 * bur.u)}px;height:${festF1(A.vh * bur.u)}px">${festSvg([100, A.vh], art.b, 'b', RAND_SVG(A.rand))}`
      + `${art.g ? festSvg([100, A.vh], art.g, 'g', RAND_SVG(A.rand)) : ''}</div>`;
    const edge = FEST_EDGE[this._arealKey] || FEST_EDGE.huegel;

    // Boden-Deko auf einem Platz (prefs: Wunschreihenfolge)
    const ground = (cls, prefs, bottom, w, art, name) => {
      const [x, w2] = fit(slot(...prefs), w);
      front.push(item(cls, x, bottom, w2, art, name));
    };
    // Jede Bodendeko hat ihren festen Platz, damit sie nicht von Tag zu Tag woandershin wandert: Kürbis und
    // Stiefel vor dem Stein (M, an Weihnachten steht dort der Baum), Adventskranz vor dem Bau rechts neben der
    // Tür (R). Der Kuchen steht ebenfalls dort, im Advent links neben der Tür (L; vorn links stehen sonst die
    // Haus-Bote-Geräte, die ihm ausweichen).
    if (f.xmas) used.add('M');
    if (f.halloween) ground('fpump', ['M', 'R', 'L'], gy + 1, H * 0.14, FEST_PUMPKIN, 'pumpkin');
    if (f.boot) ground('fboot', ['M', 'R', 'L'], gy + 1, H * 0.11, FEST_BOOT(f.boot.full), 'boot');
    if (f.advent) ground('fwreath', ['R', 'L', 'M'], gy, H * 0.2, FEST_WREATH(f.advent.candles), 'wreath');
    if (f.birthday) ground(`fcake${this._festCakeOut ? ' out' : ''}`, ['R', 'L', 'M'], gy + 1, H * 0.14, FEST_CAKE, 'cake');
    if (f.lights) on.push(onBur('flights', FEST_LIGHTS(edge)));
    if (f.karneval) on.push(onBur('fstream', FEST_STREAMERS(edge)));
    if (f.martin) {
      // Papierlaterne hängt an einem Stöckchen, das rechts oben aus dem Bau ragt (neben Tür und Fenster)
      const [ex, ey] = edge.reduce((a, p) => (Math.abs(p[0] - 88) < Math.abs(a[0] - 88) ? p : a));
      const w = H * 0.1;
      const ax = bur.l + ex * bur.u;
      const ay = bur.base + ey * bur.u;
      const h = (w * 34) / 26;
      on.push(`<div class="fi flan" style="left:${festF1(ax - w / 26)}px;top:${festF1(ay - (w * 4.2) / 26)}px;width:${festF1(w)}px;height:${festF1(h)}px">`
        + `${festSvg(FEST_LANTERN.vb, FEST_LANTERN.b, 'b')}${festSvg(FEST_LANTERN.vb, FEST_LANTERN.g, 'g')}</div>`);
    }
    if (f.xmas) {
      const tw = (H * 0.42 * 50) / 66;
      back.push(item('ftree', slots.M.x, gy + 2, tw, FEST_TREE, 'tree'));
      // Geschenk vorn unter dem Baum, nicht vor dem Heu
      const gw = H * 0.1;
      front.push(item('fgift', Math.min(slots.M.x, Math.max(slots.M.x - tw * 0.32, hayR + gw / 2)), gy - 1, gw, FEST_GIFT, 'gift'));
    }
    if (f.maibaum) {
      // hinter dem Bau, die Krone unterhalb der Statusleiste
      const top = Math.max(44, this._sy(0.16));
      const mh = gy - top;
      const mw = mh / 4;
      const x = bur.l + 80 * bur.u;
      back.push(`<div class="fi fmai" style="left:${festF1(x - mw / 2)}px;top:${festF1(top)}px;width:${festF1(mw)}px;height:${festF1(mh)}px;`
        + `--wd:${this._windDir < 0 ? -1 : 1}">${festSvg(FEST_MAI.vb, FEST_MAI.b, 'b')}</div>`);
    }
    if (f.birthday || f.sommer) back.push(this._festString(f.birthday ? ['A', 'L', 'L', 'E', 'S', '♥', 'G', 'U', 'T', 'E'] : null));
    // Wiese für Eier und Raketenstäbe: rechts neben der Tür bis kurz vor den rechten Rand, ohne die Stellen, an
    // denen schon Deko steht (Kuchen, Geschenk …). free(u, m): Stelle u ∈ [0, 1] entlang der freien Strecke,
    // m = halbe Breite des Teils plus Abstand. Ist alles belegt, gilt die ganze Strecke (lieber eng als gar nicht).
    const lo = hole.r + H * 0.12;
    const hi = Math.max(lo + H * 0.3, Math.min(W - 10, rock.l + rock.w * 0.75));
    const taken = Object.values(pos);
    const free = (u, m) => {
      let segs = [[lo, hi]];
      for (const p of taken) {
        const a = p.l - m;
        const b = p.l + p.w + m;
        segs = segs.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e]] : [[s, a], [b, e]].filter(([s2, e2]) => e2 - s2 > 1)));
      }
      const len = segs.reduce((t, [s, e]) => t + e - s, 0);
      if (!len) return lo + (hi - lo) * u;
      let k = u * len;
      for (const [s, e] of segs) {
        if (k <= e - s) return s + k;
        k -= e - s;
      }
      return hi;
    };
    const eggX = [];
    if (f.ostern) {
      const n = 4 + Math.floor(seeded(f.year, 7) * 3);
      for (let i = 0; i < n; i++) {
        const r = (k) => seeded(f.year, i, k);
        const x = free((i + 0.2 + 0.6 * r(1)) / n, H * 0.05);
        const c1 = FEST_COLORS[Math.floor(r(2) * FEST_COLORS.length)];
        let c2 = FEST_COLORS[Math.floor(r(3) * FEST_COLORS.length)];
        if (c2 === c1) c2 = '#fff';
        const w = H * 0.06;
        const h = w * 1.25;
        const b = gy + 1 + r(4) * 2.5;
        eggX.push(x);
        pos[`egg${i}`] = { x, l: x - w / 2, top: b - h, w, h };
        front.push(`<div class="fi fegg" role="button" aria-label="Osterei" style="left:${festF1(x - w / 2 - 6)}px;top:${festF1(b - h - 6)}px;`
          + `width:${festF1(w + 12)}px;height:${festF1(h + 12)}px">`
          + `<svg class="b" viewBox="0 0 12 15" aria-hidden="true" style="rotate:${festF1((r(5) - 0.5) * 24)}deg">${FEST_EGG(c1, c2, Math.floor(r(6) * 3))}</svg></div>`);
      }
    }
    if (f.sticks) {
      [[0.3, -6], [0.68, 9]].forEach(([t, rot], i) => {
        const x = free(t + (seeded(f.year, 31, i) - 0.5) * 0.1, H * 0.12);
        front.push(item('fstick', x, gy - H * 0.018, H * 0.2, FEST_STICK, `stick${i}`, `;rotate:${rot}deg`));
      });
    }

    E.back.innerHTML = back.join('');
    E.on.innerHTML = on.join('');
    E.front.innerHTML = front.join('');
    this._festPos = pos;
    this._festCakeEl = E.front.querySelector('.fcake');
    this._festEggs = [...E.front.querySelectorAll('.fegg')].map((el, i) => {
      el.addEventListener('click', (e) => (e.stopPropagation(), this._festWobble(el)));
      this._keyTap(el);
      return { el, x: eggX[i] };
    });
    // Haus-Bote: Geräte weichen der Bodendeko aus (boteRow)
    this._boteLayout?.();
  }

  // Wimpelkette zwischen Bau und Stein (Sommerfest) bzw. Girlande „Alles Gute“ (Geburtstag), in px.
  // Links hängt sie hinter der höchsten Stelle des Baus (Schornstein), rechts an einem Stöckchen hinter dem Stein.
  _festString(letters) {
    const { bur, rock } = this._g;
    const W = this._W;
    const H = this._H;
    const A = this._areal();
    const top = A.perches.reduce((a, p) => (p[1] < a[1] ? p : a));
    const x1 = bur.l + top[0] * bur.u;
    const y1 = bur.base + top[1] * bur.u + 1.5;
    const x2 = rock.l + rock.w * 0.8;
    const y2 = rock.top0 - H * 0.1;
    const cx = (x1 + x2) / 2;
    const cy = Math.max(y1, y2) + H * 0.07;
    const P = (t) => [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2];
    const len = Math.hypot(x2 - x1, y2 - y1) * 1.05;
    const n = letters ? letters.length : Math.max(7, Math.round(len / (H * 0.075)));
    const spacing = (len * 0.88) / n;
    const pw = letters ? Math.min(spacing * 0.9, H * 0.085) : Math.min(spacing * 0.8, H * 0.06);
    const ph = pw * (letters ? 1.15 : 1.25);
    let flags = '';
    for (let i = 0; i < n; i++) {
      const t = 0.06 + (0.88 * (i + 0.5)) / n;
      const [x, y] = P(t);
      const dx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
      const dy = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      const c = FEST_COLORS[i % FEST_COLORS.length];
      const ch = letters?.[i];
      flags += `<g transform="translate(${festF1(x)} ${festF1(y)}) rotate(${festF1(a * 0.6)})"><g class="fpn" style="animation-delay:${(-i * 0.29).toFixed(2)}s">`
        + `<path d="M${festF1(-pw / 2)} 0 L${festF1(pw / 2)} 0 L0 ${festF1(ph)}Z" fill="${c}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`
        + (ch ? `<text x="0" y="${festF1(ph * 0.36)}" text-anchor="middle" dominant-baseline="middle" font-size="${festF1(pw * 0.62)}" font-weight="900"`
          + ` fill="#fff" stroke="rgba(90, 64, 48, .55)" stroke-width=".7" paint-order="stroke">${ch}</text>` : '')
        + '</g></g>';
    }
    const sw = Math.max(1.6, H * 0.012);
    const body = `<path d="M${festF1(x2)} ${festF1(y2 - 3)} V${festF1(rock.top0 + 22 * rock.ku)}" stroke="#8a5a3b" stroke-width="${festF1(sw)}" stroke-linecap="round"/>`
      + `<path d="M${festF1(x1)} ${festF1(y1)} Q${festF1(cx)} ${festF1(cy)} ${festF1(x2)} ${festF1(y2)}" stroke="#7a6a5a" stroke-width="1" fill="none"/>${flags}`;
    return `<div class="fi fwim" style="left:0;top:0;width:${W}px;height:${this._Hs}px">${festSvg([W, this._Hs], body, 'b')}</div>`;
  }

  _festWobble(el) {
    if (!el) return;
    el.classList.remove('wob');
    void el.offsetWidth;
    el.classList.add('wob');
  }

  // ---- Himmel: Fledermaus, Feuerwerk, Konfetti ----

  _festBat() {
    const sky = this._festEls?.sky;
    // Bewegung reduzieren: keine Fledermäuse
    if (!sky || !this._g || calmMotion()) return;
    const W = this._W;
    const H = this._Hs; // ganzer Himmel
    const el = document.createElement('div');
    el.className = 'fbat';
    el.innerHTML = FEST_BAT;
    sky.appendChild(el);
    const dir = pick([-1, 1]);
    const y0 = H * rnd(0.12, 0.4);
    const kf = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = dir > 0 ? -0.08 * W + t * 1.16 * W : 1.08 * W - t * 1.16 * W;
      const y = y0 + Math.sin(t * Math.PI * 3.2) * H * 0.05 - Math.sin(t * Math.PI) * H * 0.06;
      kf.push({ transform: `translate(${festF1(x)}px, ${festF1(y)}px)` });
    }
    const dur = rnd(5000, 8000);
    el.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' });
    this._festLater(() => el.remove(), dur + 100);
  }

  // Läuft zwischen 23:55 und 1:00: alle 3–8 s eine Rakete
  _festFwSync() {
    const on = !!this._fest?.fireworks && this._attached && !this._away() && !!this._g;
    if (on && !this._festFwT) {
      const go = () => {
        this._festRocket();
        this._festFwT = setTimeout(go, calmMotion() ? rnd(9000, 16000) : rnd(3000, 8000));
      };
      this._festFwT = setTimeout(go, rnd(400, 1500));
    } else if (!on && this._festFwT) {
      clearTimeout(this._festFwT);
      this._festFwT = null;
    }
  }

  // Finale: 10 Raketen in etwa 6 s (gleichzeitig höchstens vier, fünf Kugeln); Bewegung reduzieren: drei
  _festFinale() {
    let t = 0;
    for (let i = 0, n = calmMotion() ? 3 : 10; i < n; i++) {
      t += rnd(400, 900);
      this._festLater(() => this._festRocket(), t);
    }
  }

  _festRocket() {
    const sky = this._festEls?.sky;
    if (!sky || !this._g || this._away()) return;
    const W = this._W;
    const H = this._Hs; // ganzer Himmel
    const x0 = rnd(0.3, 0.92) * W;
    const x1 = clamp(x0 + rnd(-0.06, 0.06) * W, 0.28 * W, 0.95 * W);
    const y0 = H * 0.62;
    const y1 = rnd(0.12, 0.36) * H;
    const r = document.createElement('i');
    r.className = 'fwr';
    r.style.left = `${festF1(x0)}px`;
    r.style.top = `${festF1(y0)}px`;
    sky.appendChild(r);
    // Schweif (zeigt im Element nach unten) entgegen der Flugrichtung: nach rechts oben → Schweif nach links unten
    const ang = (Math.atan2(x1 - x0, y0 - y1) * 180) / Math.PI;
    const dur = rnd(900, 1400);
    r.animate([
      { transform: `translate(0, 0) rotate(${festF1(ang)}deg)`, opacity: 1 },
      { transform: `translate(${festF1(x1 - x0)}px, ${festF1(y1 - y0)}px) rotate(${festF1(ang)}deg)`, opacity: 0.9 },
    ], { duration: dur, easing: 'cubic-bezier(.2, .6, .4, 1)', fill: 'forwards' });
    this._festLater(() => {
      r.remove();
      this._festBurst(x1, y1);
    }, dur);
  }

  _festBurst(x, y) {
    const sky = this._festEls?.sky;
    // Unsichtbar geworden, während die Rakete noch stieg: keine Kugel mehr ins Leere
    if (!sky || this._away()) return;
    const H = this._H;
    const calm = calmMotion();
    const c = pick(FEST_FW_COLORS);
    const c2 = Math.random() < 0.4 ? pick(FEST_FW_COLORS) : c;
    const R = H * rnd(0.09, 0.15);
    const box = document.createElement('div');
    box.className = 'fwb';
    box.style.left = `${festF1(x)}px`;
    box.style.top = `${festF1(y)}px`;
    box.style.setProperty('--c', c);
    const core = document.createElement('i');
    core.className = 'fwc';
    box.appendChild(core);
    // Sternchen und Funken (leuchten über einen Verlauf statt box-shadow, das spart dem Tablet das Weichzeichnen);
    // Bewegung reduzieren: nur das sanfte Aufleuchten in der Mitte
    const n = calm ? 0 : 11 + Math.floor(rnd(0, 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1);
      const d = R * rnd(0.85, 1.1);
      const p = document.createElement('i');
      p.className = 'fwp';
      p.style.setProperty('--c', i % 2 ? c2 : c);
      box.appendChild(p);
      p.animate([
        { transform: 'translate(0, 0) scale(1.4)', opacity: 1 },
        { transform: `translate(${festF1(Math.cos(a) * d * 0.8)}px, ${festF1(Math.sin(a) * d * 0.8)}px) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${festF1(Math.cos(a) * d)}px, ${festF1(Math.sin(a) * d + H * 0.06)}px) scale(.4)`, opacity: 0 },
      ], { duration: rnd(1300, 1700), easing: 'cubic-bezier(.15, .7, .35, 1)', fill: 'forwards' });
    }
    // Funken glitzern und rieseln langsam herunter
    for (let i = 0; i < (calm ? 0 : 6); i++) {
      const a = rnd(0, Math.PI * 2);
      const d = R * rnd(0.3, 0.9);
      const s = document.createElement('i');
      s.className = 'fws';
      box.appendChild(s);
      s.animate([
        { transform: `translate(${festF1(Math.cos(a) * d * 0.6)}px, ${festF1(Math.sin(a) * d * 0.6)}px)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { opacity: 0.3, offset: 0.5 },
        { opacity: 1, offset: 0.7 },
        { transform: `translate(${festF1(Math.cos(a) * d)}px, ${festF1(Math.sin(a) * d + H * 0.13)}px)`, opacity: 0 },
      ], { duration: rnd(1600, 2300), delay: 250 + rnd(0, 300), easing: 'ease-in', fill: 'both' });
    }
    sky.appendChild(box);
    this._festLater(() => box.remove(), 2900);
    // Lichtschein auf der Wiese, wie beim Blitz, nur bunt und sanft
    const L = this._festEls.light;
    L.style.setProperty('--fx', `${festF1(x)}px`);
    L.style.setProperty('--fy', `${festF1(y)}px`);
    L.style.setProperty('--fc', c);
    L.classList.remove('go');
    void L.offsetWidth;
    L.classList.add('go');
    this._festBang?.();
    // Vom Knall erschreckt: ein Vögelchen, das gerade sitzt, fliegt davon
    if (this._bird?.sitting) this._bird.scare();
  }

  _festConfettiRain() {
    const box = this._festEls?.cf;
    if (!box || !this._g || this._away()) return;
    const { gy } = this._g;
    const W = this._W;
    const H = this._H;
    // Bewegung reduzieren: nur ein paar Schnipsel, die ohne Drehen langsam herabsinken
    const calm = calmMotion();
    for (let i = 0; i < (calm ? 8 : 46); i++) {
      const c = document.createElement('i');
      const w = H * rnd(0.014, 0.022);
      c.style.left = `${rnd(-2, 100).toFixed(1)}%`;
      c.style.width = `${festF1(w)}px`;
      c.style.height = `${festF1(w * (Math.random() < 0.3 ? 1 : rnd(1.5, 2.2)))}px`;
      c.style.borderRadius = Math.random() < 0.3 ? '50%' : '1px';
      c.style.background = pick(FEST_COLORS);
      box.appendChild(c);
      const dx = rnd(-0.06, 0.06) * W;
      const dur = calm ? rnd(6000, 8000) : rnd(2600, 4200);
      const delay = rnd(0, 1600);
      c.animate(calm ? [
        { transform: 'translate(0, -14px)' },
        { transform: `translate(${festF1(dx * 0.3)}px, ${festF1(gy + 6)}px)` },
      ] : [
        { transform: 'translate(0, -14px) rotate(0deg) rotateY(0deg)' },
        { transform: `translate(${festF1(dx * 0.4 + rnd(-10, 10))}px, ${festF1(gy * 0.45)}px) rotate(${rnd(90, 300).toFixed(0)}deg) rotateY(180deg)`, offset: 0.45 },
        { transform: `translate(${festF1(dx)}px, ${festF1(gy + 6)}px) rotate(${rnd(300, 700).toFixed(0)}deg) rotateY(360deg)` },
      ], { duration: dur, delay, easing: 'linear', fill: 'both' });
      this._festLater(() => c.remove(), dur + delay + 60);
    }
  }

  // Erzwingt einmal eine Aktion, auch wenn er schläft: der nächste Schritt der Lebensschleife ist diese Aktion
  _festForce(name) {
    if (!this._g) return;
    this._step = () => {
      delete this._step;
      this._planWaiting = false; // wie in _step: Dieser Schritt wartet nicht auf den Plan
      return this._run(name);
    };
    this._interrupt();
  }

  // Kurz zusammenzucken (Knall)
  _festZuck() {
    const p = this._el.pika;
    p.classList.remove('fest-zuck');
    void p.offsetWidth;
    p.classList.add('fest-zuck');
    const c = pick(['twitch-l', 'twitch-r']);
    p.classList.add(c);
    setTimeout(() => p.classList.remove('fest-zuck', c), 500);
  }

  _festBlow() {
    this._festCakeOut = true;
    const el = this._festCakeEl;
    if (el) {
      el.classList.remove('out');
      void el.offsetWidth;
      el.classList.add('out');
    }
    clearTimeout(this._festCakeT);
    this._festCakeT = setTimeout(() => {
      this._festCakeOut = false;
      this._festCakeEl?.classList.remove('out');
    }, 20000);
  }

  // ---- Aktionen ----

  // Halloween: am Kürbis schnuppern, vor dem Gesicht erschrecken, kichern
  async _festPumpkin() {
    const it = this._festPos?.pumpkin;
    if (!it) return;
    this._festMark('festPumpkin');
    await this._approach(it.x, 0.8);
    const p = this._el.pika;
    await this._wait(300);
    p.classList.add('sniff');
    await this._wait(rnd(900, 1400));
    p.classList.remove('sniff');
    const toward = this._dir;
    this._jump('hop1');
    this._twitch();
    this._say('huch!', 1100);
    await this._wait(450);
    await this._walkTo(this._x - toward * this._g.pW * 0.45, 1.8);
    this._face(toward);
    await this._wait(600);
    p.classList.add('happy');
    this._say(pick(['hihi', 'hihihi']), 1200);
    await this._wait(1300);
    p.classList.remove('happy');
    await this._wait(rnd(400, 900));
  }

  // St. Martin: mit der Laterne am Stab über die Wiese, „Laterne, Laterne…“
  async _festLantern() {
    this._festMark('festLantern');
    const { home, pW } = this._g;
    const W = this._W;
    const p = this._el.pika;
    p.classList.add('fest-lantern');
    try {
      await this._wait(500);
      this._say('Laterne, Laterne…', 2600);
      const far = clamp(W * 0.78, home + pW * 1.5, W - pW * 0.6);
      const near = home + pW * 0.7;
      const legs = this._x > (far + near) / 2 ? [near, far] : [far, near];
      for (const x of legs) {
        await this._walkTo(x, 0.5);
        this._note(pick(['♪', '♫']));
        await this._wait(rnd(900, 1600));
        if (Math.random() < 0.6) this._say(pick(['Laterne, Laterne…', '♪ ♫ ♪']), 2200);
        await this._wait(rnd(600, 1200));
      }
      this._face(1);
      await this._wait(rnd(1200, 2000));
    } finally {
      p.classList.remove('fest-lantern');
    }
  }

  // Nikolaus: in den Stiefel schauen, freuen
  async _festBoot() {
    const it = this._festPos?.boot;
    if (!it) return;
    this._festMark('festBoot');
    await this._approach(it.x, 0.9);
    const p = this._el.pika;
    p.classList.add('sniff');
    await this._wait(rnd(900, 1300));
    p.classList.remove('sniff');
    if (this._fest.boot?.full) {
      this._say('oh!', 1100);
      this._jump('hop1');
      await this._wait(500);
      this._happy(1600);
      await this._wait(1700);
    } else {
      this._say(pick(['noch leer…', 'morgen?']), 1500);
      p.classList.add('look-up');
      await this._wait(1700);
    }
  }

  // Weihnachten: vor dem Baum sitzen und staunen, es funkelt
  async _festTree() {
    const t = this._festPos?.tree;
    if (!t) return;
    this._festMark('festTree');
    await this._approach(t.x, 0.8);
    const p = this._el.pika;
    await this._wait(400);
    p.classList.add('look-up');
    this._say('ohh…', 1500);
    for (let i = 0; i < 5; i++) {
      this._sparkle(t.x + rnd(-t.w * 0.3, t.w * 0.3), t.top + rnd(t.h * 0.1, t.h * 0.8), 2);
      await this._wait(rnd(900, 1600));
    }
    p.classList.remove('look-up');
    this._happy(1500);
    this._say(pick(['schön!', '♥']), 1200);
    await this._wait(1600);
  }

  // Silvester: hochschauen, bei jedem Knall zucken, „Frohes Neues!“. Schläft er, wacht er dafür auf
  // und schaut aus dem Bau; danach schläft er weiter.
  async _festFireworks() {
    if (!this._fest?.fireworks) return;
    this._festMark('festFireworks');
    const p = this._el.pika;
    const sleeping = this._asleep && this._inside;
    // Bei Starkregen und Gewitter bleibt er auch wach im Bau und schaut nur heraus (wie im Schlaf); steht er
    // dabei draußen, schaut er von dort aus zu, statt zur Wiese zu laufen
    const storm = !!this._wx.shelter;
    const peek = sleeping || (storm && this._inside);
    this._festBang = () => this._festZuck();
    try {
      if (peek) {
        p.classList.remove('sleeping');
        await this._to('peek', 900);
        this._say('!', 900);
        await this._wait(900);
      } else if (storm) {
        if (this._lift > 0) await this._hopDown();
        this._face(1);
      } else {
        if (this._lift > 0) await this._hopDown();
        if (this._inside) await this._comeOut();
        await this._walkTo(this._g.home + this._g.pW * 0.8, 0.9);
        this._face(1);
      }
      p.classList.add('look-up');
      await this._wait(900);
      // Vor Mitternacht (ab 23:55) wird noch nicht gratuliert
      const ny = () => new Date(this._festNow()).getMonth() === 0;
      this._say(ny() ? 'Frohes Neues!' : pick(['gleich!', 'bald ist Neujahr!', 'ohh!']), 2400);
      const until = Date.now() + rnd(35000, 50000);
      let again = true;
      while (Date.now() < until && this._fest?.fireworks) {
        await this._wait(rnd(2500, 5000));
        const r = Math.random();
        if (r < 0.25) this._say(pick(['ohh!', 'wuiii!', 'oh!']), 1100);
        else if (r < 0.4 && again && ny()) {
          again = false;
          this._say('Frohes Neues!', 2200);
        } else if (r < 0.55 && !peek) this._face(-this._dir);
      }
      p.classList.remove('look-up');
      this._happy(1400);
      await this._wait(1200);
    } finally {
      this._festBang = null;
      p.classList.remove('look-up', 'fest-zuck');
      if (sleeping && this._asleep) {
        p.classList.add('sleeping');
        this._pose('sleep', 1200);
      }
    }
  }

  // Karneval: im Konfetti herumhüpfen, „Helau!“
  async _festConfetti() {
    this._festMark('festConfetti');
    const { home, pW } = this._g;
    this._festConfettiRain();
    await this._wait(600);
    this._say('Helau!', 1300);
    this._jump('binky');
    await this._wait(1000);
    for (let i = 0; i < 3; i++) {
      const x = clamp(this._x + rnd(0.4, 0.9) * pW * pick([-1, 1]), home + pW * 0.6, this._W - pW * 0.6);
      await this._hopTo(x, 0);
      await this._wait(rnd(250, 600));
    }
    this._jump('binky');
    this._say('Helau!', 1300);
    await this._wait(1300);
  }

  // Ostern: zu einem Ei hoppeln, schnuppern, anstupsen (es wackelt), kichern
  async _festEgg() {
    const eggs = this._festEggs;
    if (!eggs?.length) return;
    this._festMark('festEgg');
    const i = Math.random() < 0.6
      ? eggs.reduce((b, e, k) => (Math.abs(e.x - this._x) < Math.abs(eggs[b].x - this._x) ? k : b), 0)
      : Math.floor(rnd(0, eggs.length));
    await this._approach(eggs[i].x, 0.9);
    const p = this._el.pika;
    p.classList.add('sniff');
    await this._wait(rnd(800, 1200));
    this._festWobble(this._festEggs?.[i]?.el);
    await this._wait(500);
    p.classList.remove('sniff');
    this._twitch();
    p.classList.add('happy');
    this._say(pick(['hihi', 'hihi!']), 1100);
    await this._wait(1300);
    p.classList.remove('happy');
    await this._wait(rnd(300, 800));
  }

  // Geburtstag: zum Kuchen, Kerze auspusten (geht nach 20 s wieder an), Herzen, „Alles Gute, …!“
  async _festBirthday() {
    const it = this._festPos?.cake;
    if (!it || this._festCakeOut) return;
    this._festMark('festBirthday');
    await this._approach(it.x, 1.1);
    await this._wait(400);
    const p = this._el.pika;
    p.classList.add('calling');
    await this._wait(300);
    this._festBlow();
    await this._wait(400);
    p.classList.remove('calling');
    await this._wait(500);
    this._happy(1600);
    this._say(`Alles Gute, ${festNames(this._fest.birthday?.names || [])}!`, 2800);
    this._jump('binky');
    await this._wait(2400);
  }
}
