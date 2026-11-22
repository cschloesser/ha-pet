// Album 2: die Laterne (key 'lantern', t2 = 1). Schnittstelle im Kopf von src/karte/album2.js, Vorbild ist das
// Vogelhäuschen (src/karte/album2-feeder.js). Die Laterne steht nicht dauernd herum: In der Dämmerung, nachts und in der
// letzten halben Stunde vor der Schlafenszeit (Abendrunde) holt er sie aus dem Bau und trägt sie im Maul.
// Stufe 1: Er trägt sie ein Stück über die Wiese, schaut sich im Licht um und stellt sie neben die Tür des Baus. Dort
// brennt sie noch ein paar Minuten (LANTERN_STAY), bis er schlafen geht oder bis zum nächsten Mal; solange kann man sie
// antippen. Stufe 2 (Trick): Laternenlauf, eine Runde über die Wiese (mit depth vorn hin und auf der hinteren Spur
// zurück), die Laterne schwingt. Stufe 3 (Gold): Glühwürmchen kommen zum Licht, kreisen um die Laterne und bleiben bei
// ihr, solange sie brennt.
// Licht: ein Schein in .fx (.a2lglow), der der Laterne folgt (_nosePos, solange er sie trägt). Wie hell er ist, sagt
// allein der Stil nach der Tageszeit der Szene (.dusk, .sun-down, .night); bei Tag brennt nur die kleine Flamme.
// Wetter: Bei Regen, Gewitter und Sturm geht er nicht mit ihr hinaus (aus der Vorschau erzwungen: nur bis vor die Tür).
// Alles bleibt auf diesem Gerät, nichts davon steht im Plan oder im Zustand.

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { LANE_DY, LANE_S } from '../logik/einstellungen.js';
import { buehneZ } from '../logik/buehne.js';
import { GOLD_FIREFLY } from '../grafik/paeckchen.js';
import { LANTERN_SVG, LANTERN_CARRY, LANTERN_CARRY_GOLD, LANTERN_W, LANTERN_FOOT, LANTERN_GLASS, CARRY_GLASS } from '../grafik/album2/lantern.js';

// Glühwürmchen von selbst höchstens alle 3 Minuten und dann zu jeder zweiten Runde (wie GOLD in src/logik/paeckchen.js)
const LANTERN_GOLD = { cd: 3 * 6e4, p: 0.5 };
// So lange brennt sie noch neben dem Bau, nachdem er sie abgestellt hat (ms); jeder Tipp darauf gibt eine Minute dazu
const LANTERN_STAY = 4 * 6e4;
const LANTERN_TAP_MORE = 6e4;
// Abendrunde: in den letzten 30 Minuten vor der Schlafenszeit, auch wenn es (im Sommer) noch hell ist
const LANTERN_EVE = 30 * 6e4;
// Tempo beim Tragen (vorsichtig) und beim Laternenlauf
const LANTERN_V = 0.6;
const LANTERN_RUN_V = 0.75;

export class Album2Lantern {
  // ---------- Lage ----------

  // Dämmerung oder Nacht (dann leuchtet sie)
  _a2LanternDark() {
    const sc = this._el.scene.classList;
    return sc.contains('dusk') || sc.contains('night');
  }

  // Letzte halbe Stunde vor der Schlafenszeit (Wachfenster wie in _bedOf). Stellt die Vorschau die Schlafenszeit von
  // Hand (_dbgSleep), gilt das nicht.
  _a2LanternEve() {
    if (this._dbgSleep != null || !this._cfg || typeof this._wakeWins !== 'function') return false;
    const t = this._haNow();
    const w = this._wakeWins(t, t).find(([ws, we]) => t >= ws && t < we);
    return !!w && w[1] - t <= LANTERN_EVE;
  }

  // Morgens (3 bis 12 Uhr, Uhr von HA; die Vorschau stellt sie mit _dbgDate): Die Dämmerung ist dann die vor Sonnenaufgang,
  // .dusk unterscheidet das nicht. Die Laterne ist fürs Abendlicht (so steht es auch im Album).
  _a2LanternMorning() {
    const h = new Date(this._dbgDate ?? this._haNow()).getHours();
    return h >= 3 && h < 12;
  }

  // Hook: Er mag sie in der Abenddämmerung und abends im Dunkeln, in der Abendrunde am liebsten; nicht morgens, nicht bei
  // Regen, Gewitter, Sturm. Steht sie schon brennend am Bau, seltener.
  _a2LanternActs({ wx }, lv) {
    if (wx.wet || wx.storm || wx.shelter || (this._wind || 0) >= 40 || this._a2LanternBusy) return [];
    const dark = this._a2LanternDark();
    const eve = this._a2LanternEve();
    if ((!dark && !eve) || (!eve && this._a2LanternMorning())) return [];
    let w = this._el.scene.classList.contains('night') ? 0.4 : 0.5;
    if (eve) w = dark ? 1 : 0.5;
    if (this._a2LanternStand) w *= 0.4;
    return [[w, 'a2LanternPlay'], [lv >= 2 ? w * 0.6 : 0, 'a2LanternRun']];
  }

  // Platz am Bau: rechts neben der Tür, mitten zwischen Tür und Heu bzw. Nische (an allen vier Arealen frei: links der
  // Tür steht am Erdhügel schon dessen Laterne). Steht dort Festdeko, links der Tür. → { x, foot, home }
  _a2LanternSpot() {
    const { hole, hayL } = this._g;
    const w = this._H * LANTERN_W;
    const gap = hayL - hole.r;
    const R = gap >= w * 1.5 ? hole.r + gap / 2 : hole.r + w * 0.75;
    const L = Math.max(w * 0.6, hole.l - w * 0.9);
    const frei = (x) => !Object.values(this._festPos || {}).some((q) => q && q.l < x + w * 0.6 && q.l + q.w > x - w * 0.6);
    return { x: frei(R) || !frei(L) ? R : L, foot: LANTERN_FOOT, home: true };
  }

  // Mitte des Glases, während er sie im Maul trägt (px der Szene): vom Maul (_nosePos) aus nach vorn und unten, auf dem
  // Stein und auf der hinteren Spur kleiner wie er
  _a2LanternGlass() {
    const n = this._nosePos();
    const s = (this._lift > 0 ? 0.9 : 1) * (this._laneDy() ? LANE_S : 1);
    const k = (0.68 * this._g.pH / 100) * s;
    return { x: n.x + this._dir * CARRY_GLASS[0] * k, y: n.y + CARRY_GLASS[1] * k };
  }

  // ---------- Szene ----------

  // Hook: Die abgestellte Laterne steht, solange sie brennt (oder er gerade mit ihr beschäftigt ist); schläft er, ist er
  // verreist oder ist der Schatz nicht (mehr) da, geht sie aus
  _a2LanternScene(lv) {
    const S = this._a2LanternStand;
    if (!S) return;
    if (!(lv > 0) || this._asleep || this._urlaubFern() || (!this._a2LanternBusy && Date.now() >= S.until)) {
      this._a2LanternOut();
      return;
    }
    // Größe der Szene oder Areal geändert (Pixel von damals): am Bau an den neuen Platz neben der Tür, sonst im Bild
    // bleiben; ohne Tiefe nicht auf der hinteren Spur
    const { pW, xR } = this._g;
    S.x = S.home ? this._a2LanternSpot().x : clamp(S.x, pW * 0.2, xR + pW * 0.25);
    if (!this._cfg.depth && S.foot === LANE_DY) S.foot = 0;
    const el = this._a2El('lantern', LANTERN_SVG);
    el.classList.remove('a2out');
    el.style.left = `${S.x.toFixed(1)}px`;
    el.style.bottom = `calc(var(--gb) + var(--H) * ${S.foot})`;
    el.style.zIndex = String(buehneZ(-S.foot, 'schatz'));
    const H = this._H;
    this._a2LanternGlowAt(S.x, this._g.gy - S.foot * H - LANTERN_W * 1.5 * H * LANTERN_GLASS, false);
  }

  // Lichtschein in .fx an x/y (mv: er trägt sie, der Schein flackert ein wenig mit). → das Element
  _a2LanternGlowAt(x, y, mv) {
    let g = this._a2LanternGlow;
    if (!g || !g.isConnected) {
      g = document.createElement('span');
      g.className = 'a2lglow';
      g.innerHTML = '<i class="a2lh"></i>';
      this._el.fx.appendChild(g);
      this._a2LanternGlow = g;
    }
    g.classList.remove('off');
    g.style.left = `${x.toFixed(1)}px`;
    g.style.top = `${y.toFixed(1)}px`;
    g.classList.toggle('mv', !!mv && !calmMotion());
    return g;
  }

  // Schein (und Glühwürmchen) folgen der Laterne im Maul, Bild für Bild, solange er sie trägt
  _a2LanternFollow(on) {
    if (this._a2LanternRaf) cancelAnimationFrame(this._a2LanternRaf);
    this._a2LanternRaf = 0;
    if (!on || typeof requestAnimationFrame !== 'function') return;
    const step = () => {
      this._a2LanternRaf = 0;
      if (!this._a2LanternCarry || !this._g || !this._a2LanternGlow) return;
      const q = this._a2LanternGlass();
      this._a2LanternGlowAt(q.x, q.y, true);
      this._a2LanternRaf = requestAnimationFrame(step);
    };
    step();
  }

  // Ins Maul nehmen (on) bzw. aus dem Maul (off). glow: der Schein kommt gleich mit (nicht, solange er noch im Bau ist)
  _a2LanternHold(on, glow = true) {
    const p = this._el.pika;
    if (on) {
      // Steht sie noch irgendwo (aus der Vorschau, nach dem Auspacken): Es gibt nur eine
      if (this._a2LanternStand) {
        this._a2LanternStand = null;
        this._a2Drop('lantern');
      }
      this._a2LanternCarry = true;
      this._mouth('#e8584e', this._a2Lv('lantern') >= 3 ? LANTERN_CARRY_GOLD : LANTERN_CARRY);
      p.classList.add('carry', 'a2lc');
      if (glow) this._a2LanternLight();
      return;
    }
    this._a2LanternCarry = false;
    this._a2LanternFollow(false);
    this._mouth(null);
    p.classList.remove('carry', 'a2lc', 'a2lsw', 'a2lbig');
  }

  // Der Schein geht an (er trägt sie). Ging sie eben erst aus (_a2LanternOut blendet noch aus), bleiben Schein und
  // Glühwürmchen
  _a2LanternLight() {
    if (!this._a2LanternCarry) return;
    const q = this._a2LanternGlass();
    this._a2LanternGlowAt(q.x, q.y, true);
    for (const f of this._a2LanternFF || []) f.classList.remove('off');
    this._a2LanternFollow(true);
  }

  // Abstellen: am Platz S { x, foot, home: ihr Platz am Bau }, sie brennt dort noch LANTERN_STAY
  _a2LanternSet(S) {
    this._a2LanternHold(false);
    this._a2LanternStand = { x: S.x, foot: S.foot, home: !!S.home, until: Date.now() + LANTERN_STAY };
    this._a2Scene();
  }

  // Abgebrochen, während er sie trägt (Futter, Tipp, Schlafenszeit): Er stellt sie ab, wo er gerade ist (im Bau: an
  // ihren Platz neben der Tür)
  _a2LanternDropHere() {
    if (!this._a2LanternCarry || !this._g) return;
    if (this._inside) return this._a2LanternSet(this._a2LanternSpot());
    const n = this._nosePos();
    const { pW, xR } = this._g;
    this._a2LanternSet({ x: clamp(n.x, pW * 0.2, xR + pW * 0.25), foot: this._laneDy() ? LANE_DY : 0 });
  }

  // Sie geht aus: Schein und Glühwürmchen blenden aus, die Laterne verschwindet (er hat sie weggeräumt)
  _a2LanternOut() {
    this._a2LanternStand = null;
    const gen = (this._a2LanternGen = (this._a2LanternGen || 0) + 1);
    const el = this._a2Els?.get('lantern');
    el?.classList.add('a2out');
    if (!this._a2LanternCarry) {
      this._a2LanternGlow?.classList.add('off');
      for (const f of this._a2LanternFF || []) f.classList.add('off');
    }
    setTimeout(() => {
      if (gen !== this._a2LanternGen || this._a2LanternStand) return;
      if (this._a2Els?.get('lantern') === el) this._a2Drop('lantern');
      if (this._a2LanternCarry) return;
      this._a2LanternGlow?.remove();
      this._a2LanternGlow = null;
      this._a2LanternFlyOff();
    }, 600);
  }

  // ---------- Glühwürmchen (Stufe 3) ----------

  // n Glühwürmchen kommen zum Licht und kreisen um die Laterne (Kinder des Scheins, so folgen sie ihr). Die Teilchen
  // sind die der goldenen Hängematte (GOLD_FIREFLY, Stil .gfx.hff), mit eigener Bahn (.a2lff). Ohne die Option
  // fireflies glitzert stattdessen ein goldener Funkenkranz um die Laterne. → true, wenn welche gekommen sind
  _a2LanternFlies(n = 3) {
    const g = this._a2LanternGlow;
    if (!g) return false;
    if (this._cfg?.fireflies === false) {
      const r = g.getBoundingClientRect?.();
      const s = this._el.scene.getBoundingClientRect?.();
      const x = r && s ? r.left - s.left : this._x;
      const y = r && s ? r.top - s.top : this._g.gy - this._H * 0.15;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this._goldFx('trail', x + Math.cos(a) * this._H * 0.08, y + Math.sin(a) * this._H * 0.06, { ms: 900, delay: i * 140 });
      }
      return false;
    }
    // (ohne die, deren Lebensdauer um ist: _goldFx hat sie schon weggeräumt)
    const F = (this._a2LanternFF = (this._a2LanternFF || []).filter((f) => f.isConnected));
    const calm = calmMotion();
    for (let i = 0; i < n && F.length < 4; i++) {
      const f = this._goldFx('hff a2lff', 0, 0, { ms: LANTERN_STAY + 12e4, html: GOLD_FIREFLY });
      f.style.left = f.style.top = '0';
      const r = this._H * rnd(0.075, 0.13);
      f.style.setProperty('--r', `${r.toFixed(1)}px`);
      f.style.setProperty('--a0', `${Math.round(rnd(0, 360))}deg`);
      f.style.setProperty('--d', `${rnd(2.6, 4.2).toFixed(2)}s`);
      f.style.animationDelay = `${(i * 0.45).toFixed(2)}s, 0s, ${(1 + i * 0.45).toFixed(2)}s`;
      if (Math.random() < 0.4) f.classList.add('rev');
      // Ruhig: kein Kreisen, sie sitzen still um die Laterne und blenden ein (je eins auf einem von vier Plätzen)
      if (calm) {
        const a = ((F.length + 0.5) / 4) * Math.PI * 2;
        f.style.transform = `translate(${(Math.cos(a) * r).toFixed(1)}px, ${(Math.sin(a) * r * 0.7).toFixed(1)}px)`;
      }
      g.appendChild(f);
      F.push(f);
    }
    return true;
  }

  // Die Glühwürmchen fliegen davon (blenden aus)
  _a2LanternFlyOff() {
    const F = this._a2LanternFF || [];
    this._a2LanternFF = [];
    for (const f of F) f.classList.add('off');
    setTimeout(() => this._goldDrop(F), 800);
  }

  // Kommen sie jetzt? sure: sicher (Auspacken). Sonst nur golden, und dann in der Vorschau mit _dbgGold immer, von
  // selbst nur, wenn es dunkel genug ist, mit Abstand und Würfel
  _a2LanternGoldNow(sure) {
    if (sure) return true;
    if (this._a2Lv('lantern') < 3) return false;
    if (this._dbgGold) return true;
    return this._a2LanternDark() && this._a2GoldOk('lantern', LANTERN_GOLD);
  }

  // ---------- Was er damit tut ----------

  // Holen: Steht sie (am Bau oder wo er sie abgestellt hat), hingehen, bücken, aufnehmen; sonst aus dem Bau holen (er
  // kommt mit ihr im Maul heraus)
  async _a2LanternFetch() {
    if (this._a2LanternCarry) return;
    const p = this._el.pika;
    if (this._lane) await this._walkTo(this._x, 1, true, 0);
    const S = this._a2LanternStand;
    if (S) {
      const { pW, xR } = this._g;
      let side = this._x >= S.x ? 1 : -1;
      if (S.x + side * pW * 0.26 > xR || S.x + side * pW * 0.26 < pW * 0.45) side = -side;
      await this._walkTo(S.x + side * pW * 0.26, 0.9);
      this._face(-side);
      p.classList.add('crouch');
      await this._wait(380);
      this._a2LanternHold(true);
      p.classList.remove('crouch');
      await this._wait(300);
      return;
    }
    await this._enterBurrow(0.9);
    const { home, hole } = this._g;
    this._peep(home, hole.top, pick(['kram, kram…', 'wo ist sie…', 'raschel…']));
    await this._wait(rnd(800, 1200));
    this._a2LanternHold(true, false);
    await this._comeOut();
    this._a2LanternLight();
  }

  // Zurück an ihren Platz neben der Tür: so hinstellen, dass das Maul über dem Platz ist (von rechts, zum Bau gewandt),
  // bücken, abstellen
  async _a2LanternPut() {
    const S = this._a2LanternSpot();
    const { pW, xR } = this._g;
    const p = this._el.pika;
    let side = 1;
    if (S.x + pW * 0.26 > xR) side = -1;
    await this._walkTo(S.x + side * pW * 0.26, LANTERN_V);
    this._face(-side);
    await this._wait(200);
    p.classList.add('crouch');
    await this._wait(320);
    this._a2LanternSet(S);
    p.classList.remove('crouch');
    await this._wait(250);
    // ein paar Schritte zurück (ohne sich umzudrehen), sonst verdeckte er sie: Er schaut sie sich an
    await this._walkTo(S.x + side * pW * 0.95, 0.8, true, 0, true);
  }

  // Bei Regen (nur aus der Vorschau, von sich aus geht er da nicht): in der Tür in den Regen leuchten, wieder abstellen
  async _a2LanternWet() {
    this._face(1);
    this._say(pick(['brr, zu nass!', 'heute keine Runde…']), 1600);
    this._el.pika.classList.add('look-up');
    await this._wait(1800);
    this._el.pika.classList.remove('look-up');
    await this._a2LanternPut();
  }

  // Stufe 1 (Aktion 'a2LanternPlay'): holen, ein Stück über die Wiese tragen, sich im Licht umschauen, neben den Bau
  // stellen, kurz daneben sitzen. o: { hold: hat sie schon im Maul (Auspacken), short: kurz, gold: Glühwürmchen sicher }
  async _a2LanternPlay(o = {}) {
    if (!this._a2Lv('lantern')) return;
    this._a2LanternBusy = true;
    const p = this._el.pika;
    try {
      if (o.hold) this._a2LanternHold(true);
      else await this._a2LanternFetch();
      if (this._wx?.wet) return await this._a2LanternWet();
      const gold = this._a2LanternGoldNow(o.gold);
      const { fMin, fMax } = this._g;
      const W = this._W;
      const x = clamp(rnd(fMin + (fMax - fMin) * 0.3, fMax) * W, this._g.home + this._g.pW, this._g.xR);
      await this._walkTo(x, LANTERN_V);
      await this._wait(300);
      if (gold) this._a2LanternFlies(3);
      p.classList.add('look-up');
      const sc = this._el.scene.classList;
      this._say(gold ? pick(['Glühwürmchen!', 'oh, sie kommen zum Licht!'])
        : sc.contains('night') ? pick(['so hell!', 'da, die Sterne!', 'mein Licht!'])
          : this._a2LanternDark() ? pick(['Abendrunde!', 'schön hell!', 'gleich ist es dunkel'])
            : pick(['Abendrunde!', 'bald ist Schlafenszeit']), 1700);
      if (gold) this._mimik('awe', 1600);
      await this._wait(o.short ? 1500 : rnd(1800, 2600));
      p.classList.remove('look-up');
      if (!o.short) {
        this._face(-this._dir);
        await this._wait(rnd(900, 1500));
        this._face(-this._dir);
        await this._wait(rnd(400, 800));
      }
      await this._a2LanternPut();
      p.classList.add('content');
      this._happy(1000);
      await this._wait(o.short ? 900 : rnd(1500, 2400));
      p.classList.remove('content');
    } finally {
      this._a2LanternBusy = false;
      this._a2LanternDropHere();
    }
  }

  // Stufe 2, der Trick (Aktion 'a2LanternRun'): Laternenlauf. Er trägt sie eine Runde über die Wiese und lässt sie
  // schwingen: mit depth vorn hin und auf der hinteren Spur zurück, ohne hin und zurück. Am Ende hält er sie hoch
  // (Hüpfer), dann stellt er sie neben den Bau. o wie bei _a2LanternPlay.
  async _a2LanternRun(o = {}) {
    if (this._a2Lv('lantern') < 2) return;
    this._a2LanternBusy = true;
    const p = this._el.pika;
    const calm = calmMotion();
    try {
      if (o.hold) this._a2LanternHold(true);
      else await this._a2LanternFetch();
      if (this._wx?.wet) return await this._a2LanternWet();
      const gold = this._a2LanternGoldNow(o.gold);
      if (gold) this._a2LanternFlies(3);
      const { home, pW, xR, rock } = this._g;
      const near = Math.max(home + pW * 0.9, this._g.fMin * this._W);
      // Die Runde (depth) wendet vor dem Stein: Hinter ihm sähe man nur den Schein über dem Stein. Ist dafür zu wenig
      // Wiese (schmale Karte), geht er vorn hin und zurück, bis vor den Stein oder knapp davor.
      const back = Math.max(near, this._laneRange()[0]);
      const turn = Math.min(this._W * 0.8, rock.l - pW * 0.25);
      const ring = !!this._cfg.depth && turn - back > pW * 0.8;
      const far = ring ? turn : clamp(this._W * 0.8, near + pW * 1.2, xR);
      if (!calm) p.classList.add('a2lsw');
      this._say(pick(['Laternenlauf!', '♪ ich geh mit meiner Laterne…']), 1800);
      await this._walkTo(near, LANTERN_RUN_V, true);
      await this._walkTo(far, LANTERN_RUN_V, true);
      this._note(pick(['♪', '♫']));
      if (ring) {
        // die Runde: auf die hintere Spur, dort zurück, wieder nach vorn
        await this._walkTo(far, LANTERN_RUN_V, true, 1);
        this._note('♪');
        await this._walkTo(back, LANTERN_RUN_V, true, 1);
        this._note('♫');
        await this._walkTo(back, LANTERN_RUN_V, true, 0);
      } else {
        // am Ende der Wiese kurz stehen und die Laterne weit schwingen lassen, dann zurück
        if (!calm) p.classList.add('a2lbig');
        this._say('♪ ♫ ♪', 1300);
        await this._wait(1400);
        p.classList.remove('a2lbig');
        await this._walkTo(near, LANTERN_RUN_V, true);
        this._note('♫');
      }
      p.classList.remove('a2lsw');
      // hochhalten: Kopf hoch, ein Hüpfer, Funkeln um das Licht
      p.classList.add('look-up');
      if (!calm) this._jump('hop1');
      this._say(pick(['Laterne, Laterne!', '…Sonne, Mond und Sterne!', 'tadaa!']), 1600);
      const q = this._a2LanternGlass();
      this._sparkle(q.x, q.y - this._H * 0.04, 2);
      await this._wait(o.short ? 1200 : 1700);
      p.classList.remove('look-up');
      await this._a2LanternPut();
      this._happy(1100);
      p.classList.add('content');
      await this._wait(o.short ? 800 : rnd(1300, 2000));
      p.classList.remove('content');
    } finally {
      this._a2LanternBusy = false;
      p.classList.remove('a2lsw', 'a2lbig');
      this._a2LanternDropHere();
    }
  }

  // Nach dem Auspacken (Hook): Das Bild ist beim Pika verblasst, er hat sie schon im Maul. Stufe 1 die Runde kurz, 2 der
  // Laternenlauf, 3 mit Glühwürmchen
  // Steht sie noch brennend neben dem Bau (Stufe 2 und 3), holt er sie dort.
  async _a2LanternStow(lv) {
    const hold = !this._a2LanternStand;
    if (lv === 2) return this._a2LanternRun({ hold, short: true });
    if (hold) this._a2LanternHold(true);
    this._say(lv >= 3 ? pick(['goldig!', 'die glänzt!']) : pick(['für den Abend!', 'mein Licht!']), 1400);
    await this._wait(900);
    await this._a2LanternPlay({ hold, short: true, gold: lv >= 3 });
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Tipp auf die brennende Laterne: Die Flamme flackert auf, der Schein mit, sie wackelt am Fuß; golden kommt (bis zu
  // vier) ein Glühwürmchen dazu. Sie brennt danach eine Minute länger (höchstens LANTERN_STAY ab jetzt).
  _a2LanternTap(z) {
    const el = z.el;
    const S = this._a2LanternStand;
    if (!S) return false;
    const calm = calmMotion();
    if (!calm) {
      el.classList.remove('a2ltap');
      void el.offsetWidth;
      el.classList.add('a2ltap');
    }
    this._a2LanternGlow?.classList.add('flare');
    clearTimeout(this._a2LanternTapT);
    this._a2LanternTapT = setTimeout(() => {
      el.classList.remove('a2ltap');
      this._a2LanternGlow?.classList.remove('flare');
    }, 800);
    const H = this._H;
    this._peep(S.x, this._g.gy - S.foot * H - LANTERN_W * 1.5 * H - 2, pick(['flacker!', 'flacker, flacker']));
    S.until = Math.min(S.until + LANTERN_TAP_MORE, Date.now() + LANTERN_STAY);
    if (this._a2Lv('lantern') >= 3 && (this._a2LanternFF?.length || 0) < 4) this._a2LanternFlies(1);
    return true;
  }

  // Ende jeder Aktion: Was zu einer eigenen Aktion gehört, räumt deren finally ab (sie stellt die Laterne ab). Hier nur,
  // was ohne sie übrig wäre.
  _a2LanternCleanup() {
    if (this._a2LanternBusy) return;
    if (this._a2LanternCarry) this._a2LanternDropHere();
    this._el.pika.classList.remove('a2lc', 'a2lsw', 'a2lbig');
  }

  // Karte aus dem DOM: alles sofort weg
  _a2LanternDetach() {
    clearTimeout(this._a2LanternTapT);
    this._a2LanternFollow(false);
    this._a2LanternGen = (this._a2LanternGen || 0) + 1;
    this._a2LanternStand = null;
    this._a2LanternCarry = false;
    this._a2LanternBusy = false;
    // (mitten im Tragen abgehängt: _cleanup aus _stop hat sie übergangen, weil die Aktion noch lief, und deren finally
    // findet nichts mehr im Maul; ohne das bliebe .a2lc am Pika bis zum Ende der nächsten Aktion)
    this._el?.pika.classList.remove('a2lc', 'a2lsw', 'a2lbig');
    this._a2Drop('lantern');
    this._a2LanternGlow?.remove();
    this._a2LanternGlow = null;
    this._goldDrop(this._a2LanternFF || []);
    this._a2LanternFF = [];
  }
}
