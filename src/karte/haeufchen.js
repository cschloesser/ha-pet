// Häufchen: Fälligkeiten, Plätze, machen, zeigen, wegmachen

import { rnd, pick, seeded } from '../logik/hilfen.js';
import { GAIN, POOP, sec } from '../logik/zustand.js';
import { poopClean, poopWhen } from '../logik/beschaeftigungen.js';
import { POO_SVG, SCOOP_SVG } from '../grafik/szene.js';
import { urlaubEnd } from '../logik/urlaub.js';

export class Haeufchen {
  // Geschäft machen: mit dem Po über die Stelle, Hocke, Wackeln, plopp – dann ein Hüpfer nach vorn
  async _poop() {
    const pile = this._poopPending;
    if (!pile) return;
    try {
      const x = this._pileX(pile);
      const dir = Math.abs(x - this._x) < 2 ? this._dir : Math.sign(x - this._x);
      await this._walkTo(x + dir * this._g.pW * 0.36);
      this._face(dir);
      await this._wait(rnd(300, 600));
      // erst unauffällig umschauen
      const p = this._el.pika;
      p.classList.add('look-b');
      await this._wait(700);
      p.classList.remove('look-b');
      p.classList.add('squat');
      await this._wait(1000);
      this._revealPending();
      await this._wait(350);
      p.classList.remove('squat');
      await this._wait(250);
      await this._walkTo(this._x + dir * this._g.pW * 0.5, 1.3);
      this._face(-dir);
      if (Math.random() < 0.5) this._say(pick(['mip!', 'iiep!']));
      await this._wait(rnd(600, 1100));
    } finally {
      this._revealPending();
    }
  }

  // Am Häufchen schnuppern und sich angewidert abwenden
  async _sniff() {
    const pile = this._nearestPile();
    if (!pile) return;
    await this._approach(this._pileX(pile));
    const p = this._el.pika;
    p.classList.add('sniff');
    await this._wait(rnd(700, 1100));
    this._twitch();
    await this._wait(300);
    p.classList.remove('sniff');
    this._say(pick(['iih!', 'bäh!', 'iih!']), 1100);
    this._mimik('defy', 1700);
    this._face(-this._dir);
    this._jump('hop1');
    await this._wait(500);
    await this._walkTo(this._x + this._dir * this._g.pW * rnd(0.8, 1.6), 1.3);
    await this._wait(rnd(400, 900));
  }

  // Fälligkeiten (ms) der Häufchen 0, 1, 2 … seit dem letzten Großputz. Sie zählen nur Wachzeit:
  // das erste nach dem Aufwachen kommt 10–30 Minuten später, dann alle 80–140 Minuten. Das Wachfenster
  // gilt je Tag (Sonnenzeiten des Tages, Ortszeit – am Tag der Zeitumstellung stimmt es also auch).
  _poopTimes(c, until) {
    const cs = c / 1000;
    const out = [];
    const day = new Date(c);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 1);
    let t = c;
    let need = null; // restliche Wachzeit bis zum nächsten Häufchen
    for (let i = 0; i < 90 && out.length < POOP.idx; i++) {
      const [ws, we] = this._wakeDay(day);
      day.setDate(day.getDate() + 1);
      if (we <= t) continue;
      if (ws > until) break;
      let s = Math.max(t, ws);
      if (ws > t) {
        // dazwischen geschlafen: Morgenhäufchen
        const m = ws + (POOP.morning[0] + POOP.morning[1] * seeded(cs, out.length, 7)) * 6e4;
        if (m < we) {
          out.push(m);
          s = m;
        }
        need = null;
      }
      while (out.length < POOP.idx && s <= until) {
        if (need == null) need = (POOP.every + POOP.spread * seeded(cs, out.length, 3)) * 6e4;
        if (s + need > we) {
          need -= we - s;
          break;
        }
        s += need;
        out.push(s);
        need = null;
      }
      t = we;
    }
    return out;
  }

  // Was gerade liegt: { piles: [{ k, due, slot | u, r }], clean: 0..100 }. Alles folgt aus dem Zustand
  // (Großputz, Maske), damit jedes Gerät dasselbe zeigt. Die ersten 3 seit dem Großputz kommen in die Klo-Ecke,
  // nach 8 kommt keins mehr dazu. Platz und Höchstzahl zählen einzeln Weggemachtes mit: Wann es weggemacht
  // wurde, steht nicht im Zustand, mit der Maske würde ein späterer Putz rückwirkend verschieben, wo ein schon
  // liegendes Häufchen hinkam. Frei wird alles erst beim Großputz (das letzte Häufchen weg).
  // at: zu einem anderen Zeitpunkt (Uhr der Häufchen) rechnen, ohne den Zwischenspeicher
  // Urlaub: Ab seinem Beginn kommt nichts dazu und nichts altert (bis der Zustand nach der Rückkehr neu angesetzt ist)
  _poops(at) {
    const st = this._stats;
    let now = at ?? this._now();
    const ur = this._plan?.ur;
    if (st && ur && st.c < urlaubEnd(ur)) {
      const t0 = ur.t + (this._now() - this._haNow());
      if (now > t0) now = t0;
    }
    const key = st && `${st.c},${st.m},${st.l},${Math.floor(now / 1e4)},${this._cfg.sleep_start},${this._cfg.sleep_end}`;
    if (at == null && this._poopCache?.key === key) return this._poopCache;
    const res = { key, piles: [], clean: 100 };
    if (at == null) this._poopCache = res;
    if (!st) return res;
    const cs = st.c / 1000;
    const lying = [];
    for (const [k, due] of this._poopTimes(st.c, now).entries()) {
      if (due > now || lying.length >= POOP.max) break;
      const r = seeded(cs, k, 11);
      const taken = lying.filter((p) => p.slot != null).map((p) => p.slot);
      let pile;
      if (taken.length < POOP.latrine) {
        pile = { k, due, r, slot: [0, 1, 2].find((n) => !taken.includes(n)) };
      } else {
        // Wiese: Stelle mit Abstand zu den anderen Häufchen
        const others = lying.filter((p) => p.u != null).map((p) => p.u);
        let u = 0;
        for (let i = 0; i < 6; i++) {
          u = seeded(cs, k, 20 + i);
          if (others.every((o) => Math.abs(o - u) > 0.12)) break;
        }
        pile = { k, due, r, u };
      }
      lying.push(pile);
    }
    res.piles = lying.filter((p) => !(st.m & (1 << p.k)));
    res.clean = poopClean(res.piles, now);
    return res;
  }

  // Was davon auf diesem Gerät schon zu sehen ist. Ein zurückgehaltenes Häufchen (_poopPending: Er bringt erst zu
  // Ende, was er tut, bis gut POOP.live Minuten) liegt hier noch nicht, also zählt es hier auch noch nicht: nicht im
  // Balken „Sauber“, nicht im Deckel fürs Glück, nicht im Tagebuch. Der Zustand selbst und alles, was geteilt wird
  // (Putzen, Päckchen), rechnet weiter mit _poops.
  _poopsSeen() {
    const res = this._poops();
    const key = this._poopPending?.key;
    const held = key && this._stats ? res.piles.find((p) => this._pileKey(p) === key) : null;
    if (!held) return res;
    const piles = res.piles.filter((p) => p !== held);
    return { piles, clean: poopClean(piles, this._now()) };
  }

  _pileKey(p) {
    return `${this._stats.c / 1000}:${p.k}`;
  }

  // Klo-Ecke: drei Plätze am linken Fuß des Aussichtssteins; Wiese: zwischen Heuhaufen und Klo-Ecke
  _pileX(p) {
    const { rock, fMin, pW } = this._g;
    if (p.slot != null) return rock.l + rock.w * [0.04, 0.16, -0.08][p.slot];
    // nicht hinter einem Gerät des Haus-Boten (Tippfläche 44 px breit, siehe _boteEdge)
    const a = Math.max(fMin * this._W, (this._boteRowR || 0) + 26);
    const b = Math.max(a + pW * 0.5, rock.l - rock.w * 0.16);
    return a + (b - a) * p.u;
  }

  _nearestPile() {
    let best = null;
    let bd = Infinity;
    for (const p of this._poops().piles) {
      if (this._poopPending && this._pileKey(p) === this._poopPending.key) continue;
      const d = Math.abs(this._pileX(p) - this._x);
      if (d < bd) [best, bd] = [p, d];
    }
    return best;
  }

  // Kann er das neue Häufchen selbst machen? Nur wach und draußen: Im Bau, im Schlaf und bei Unwetter liegt es
  // einfach da. Ob gleich oder erst nach dem, was er gerade tut, entscheidet poopWhen.
  _canPoopLive() {
    return this._running && !this._asleep && !this._inside && !this._wx.shelter;
  }

  // Ein zurückgehaltenes Häufchen (_poopPending) liegt jetzt einfach da, ohne Vorführung
  _layPending() {
    const p = this._poopPending;
    if (!p) return;
    this._poopPending = null;
    if (this._next === 'poop') this._next = null;
    if (!this._pileEls.has(p.key) && this._poops().piles.some((o) => this._pileKey(o) === p.key)) this._addPile(p, p.key, false);
    this._renderBars(); // jetzt liegt es da und zählt
  }

  // Häufchen-Elemente an den berechneten Zustand angleichen
  _renderPiles() {
    if (!this._g || !this._stats) return;
    const { piles } = this._poops();
    const now = this._now();
    const keep = new Set();
    for (const p of piles) {
      const key = this._pileKey(p);
      keep.add(key);
      const el = this._pileEls.get(key);
      if (el) {
        el.classList.toggle('old', now - p.due > POOP.fly * 36e5);
        // Platz anders berechnet (z. B. anderer Stand nach dem Zusammenführen): mitwandern
        if (el._pile.slot !== p.slot || el._pile.u !== p.u) {
          el._pile = p;
          el.style.setProperty('--px', `${this._pileX(p).toFixed(1)}px`);
        }
        continue;
      }
      if (this._poopPending?.key === key) {
        // Zurückgehalten, bis er Zeit hat: Dauert das länger als POOP.live Minuten oder kann er gerade nicht (im Bau,
        // Unwetter, die Schleife ruht), liegt es einfach da. Mitten in der Vorführung bleibt es bei ihr.
        if (this._action !== 'poop' && (now - p.due >= POOP.live * 6e4 || !this._canPoopLive())) this._layPending();
        continue;
      }
      // Gerade fällig und man schaut zu: Er macht es vor den Augen. Eine Kleinigkeit bricht er dafür ab; eine
      // Beschäftigung (auch Fressen, Kaffee, Auspacken, ein Spiel mit Pino) bringt er erst zu Ende, das Häufchen
      // kommt danach (_step). Bisher brach es Malen, Musik und Seilspringen ab.
      const how = this._pilesShown && !this._poopPending && this._canPoopLive() ? poopWhen(now - p.due, this._action, !!this._next) : 'lay';
      if (how !== 'lay') {
        this._poopPending = { ...p, key };
        if (how === 'go') {
          this._next = 'poop';
          this._interrupt();
        }
        continue;
      }
      this._addPile(p, key, false);
    }
    for (const [key, el] of this._pileEls) {
      if (keep.has(key)) continue;
      // woanders weggemacht (anderes Gerät) oder Großputz
      this._pileEls.delete(key);
      if (!el.classList.contains('scooped')) {
        el.classList.add('gone');
        setTimeout(() => el.remove(), 900);
      }
    }
    if (this._poopPending && !keep.has(this._poopPending.key)) this._poopPending = null;
    this._pilesShown = true;
  }

  _addPile(p, key, plop) {
    const el = document.createElement('div');
    el.className = plop ? 'poo plop' : 'poo';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Saubermachen');
    el.style.setProperty('--px', `${this._pileX(p).toFixed(1)}px`);
    el.style.setProperty('--ps', (0.85 + p.r * 0.3).toFixed(2));
    el.innerHTML = POO_SVG(p.r) + '<i class="fly"></i>';
    el._pile = p;
    el.classList.toggle('old', this._now() - p.due > POOP.fly * 36e5);
    el.addEventListener('click', (e) => (e.stopPropagation(), this._cleanPile(key)));
    this._keyTap(el);
    this._el.poops.appendChild(el);
    this._pileEls.set(key, el);
  }

  _revealPending() {
    const p = this._poopPending;
    if (!p) return;
    this._poopPending = null;
    if (this._pileEls.has(p.key) || !this._poops().piles.some((o) => this._pileKey(o) === p.key)) return;
    this._addPile(p, p.key, true);
    this._puff(this._pileX(p), this._g.gy, 2);
    this._renderBars(); // jetzt liegt es da und zählt
  }

  _placePiles() {
    for (const el of this._pileEls.values()) el.style.setProperty('--px', `${this._pileX(el._pile).toFixed(1)}px`);
  }

  // Antippen: Schaufel kommt, Häufchen weg, Funkeln. Ist alles weg, gilt das als Großputz.
  _cleanPile(key) {
    if (this._urlaubOn()) return; // er ist verreist, die Wiese wartet
    const el = this._pileEls.get(key);
    if (!el || el.classList.contains('scooped')) return;
    const p = el._pile;
    const x = this._pileX(p);
    this._found('clean');
    el.classList.add('scooped');
    this._pileEls.delete(key);
    setTimeout(() => el.remove(), 800);
    const sc = document.createElement('div');
    sc.className = 'scoop';
    sc.innerHTML = SCOOP_SVG;
    sc.style.left = `${x}px`;
    sc.style.bottom = `${this._Hs - this._g.gy - this._H * 0.03}px`;
    this._el.fx.appendChild(sc);
    setTimeout(() => sc.remove(), 900);
    setTimeout(() => this._sparkle(x, this._g.gy - this._H * 0.03, 3), 450);

    this._careEval();
    const st = this._stats;
    const now = sec(this._now());
    const rest = this._poops().piles.filter((o) => o.k !== p.k);
    if (rest.length) {
      if (!st.m) st.l = now;
      st.m = (st.m | (1 << p.k)) >>> 0;
    } else {
      st.c = st.l = now;
      st.m = 0;
    }
    this._gain.c = true; // noch nicht gesendet (für das Zusammenführen mit fremden Ständen)
    this._poopCache = null;
    const awake = !this._asleep && !this._inside && this._g;
    if (rest.length) {
      this._renderStats();
      this._save();
      this._careEval(true);
      if (awake && !this._el.pika.classList.contains('walking')) this._jump('hop1');
      return;
    }
    // alles sauber: Funkeln über die Wiese, Freudensprung
    this._add('g', GAIN.clean);
    const { fMin, rock } = this._g;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => this._sparkle(rnd(fMin * this._W, rock.l + rock.w * 0.2), this._g.gy - this._H * rnd(0.02, 0.08), 1), 500 + i * 120);
    }
    if (this._asleep) {
      this._hearts(1);
      return;
    }
    setTimeout(() => {
      this._happy();
      if (!this._inside) this._jump('binky');
      this._say('♥');
    }, 600);
  }
}
