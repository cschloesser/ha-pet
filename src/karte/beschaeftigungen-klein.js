// Kleine Beschäftigungen: Pfütze, Schiffchen, Tropfen fangen, Blattschirm kreiseln, Schnee-Pika, Schneeengel,
// Schneeball, Hula-Hoop, Jo-Jo, Pusteblume, Purzelbaum, Steintürmchen, Jonglieren, Blumenkranz, Papierflieger

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { seasonKey } from '../logik/wetter.js';
import { HAY_MAX } from '../logik/tagesplan.js';
import { ACT_WALK, walkSpeed, JUMPS, HOP_MS, hopRound } from '../logik/beschaeftigungen.js';
import {
  PUDDLE_MS, puddleJumps, BOAT_T, BOAT_EASE, boatPuffs, boatPos, YOYO_MS, YOYO_DEAD, yoyoThrows, yoyoDead, PUSTE_MS,
  PURZEL_MS, PURZEL_ROLL, purzelRolls, STONE_MS, GLIDER_FLY, GLIDER_WALK, GLIDER_STEP, gliderThrows, groundSpot,
  ANGEL_T, angelSweeps, SNOWBALL_T, SNOWBALL_EASE, SNOWBALL_BIG, snowballRuns, snowballR, snowballPos,
  DROPS_T, dropsPlan, DROPS_COUNT, TWIRL_T, twirlFast, twirlLifts, twirlRings,
} from '../logik/beschaeftigungen-klein.js';
import {
  DROP_SVG, PUDDLE_SVG, BOAT_SVG, SNOWPIKA_SVG, STONES_SVG, GLIDER_SVG, ANGEL_SVG, SNOWBALL_SVG, LEAF_SVG,
} from '../grafik/beschaeftigungen.js';
import { GIFT_ITEMS } from '../grafik/paeckchen.js';

export class BeschaeftigungenKlein {
  // ==================== Kleine Beschäftigungen ab 0.32 ====================
  // Hula-Hoop, Jo-Jo, Pusteblume, Purzelbaum, Steintürmchen, Jonglieren, Blumenkranz und Papierflieger bei trockenem
  // Wetter, Pfützenspringen, Papierschiffchen, Tropfen fangen und Blattschirm kreiseln bei Regen, Schnee-Pika,
  // Schneeengel und Schneeball bei liegendem Schnee. Auswahl: miniChain (MINI_PROG, MINI_W, miniOk). Alle kommen aus
  // dem Tagesplan (_miniAt) und stehen nicht im Helfer. Pfütze, Schiffchen, Tropfen fangen, Schnee-Pika und
  // Schneeball laufen nach der Planzeit: Ein Gerät, das später dazukommt, steigt mitten hinein ein.

  // Lage für die Wahl der kleinen Beschäftigungen (miniProg, miniOk): Wetter, Wind und Kälte kommen von der
  // Wetter-Entität und sind auf allen Geräten gleich, die Jahreszeit hängt am Datum. Der Vorrat ist nur mit
  // plan_entity überall derselbe (ohne Helfer zählt jedes Gerät für sich). Was an der Konfiguration der einzelnen
  // Karte hängt (der Festtagshut: festive, birthdays), steht nicht in der Lage, sondern in _actOk.
  _lage() {
    const wx = this._wx;
    this._seasonK ??= seasonKey(this._festNow(), this._viewN());
    return {
      wet: !!wx.wet, rain: wx.rain || 0, storm: !!wx.storm, shelter: !!wx.shelter, snowcover: !!wx.snowcover, cold: !!wx.cold,
      wind: this._wind || 0, hayFull: this._hay >= HAY_MAX, winter: this._seasonK === 'winter',
    };
  }

  // Sperren am Boden für die Requisiten: Geräte des Haus-Boten, Festdeko mit festem Platz, Schätze auf der Wiese
  // und liegende Häufchen. Das steht in der Regel überall an derselben Stelle; gerechnet wird aber mit dem, was
  // jetzt da ist: Ein Gerät, das später einsteigt, kann die Pfütze woanders hinlegen, wenn inzwischen ein Gerät des
  // Haus-Boten fertig wurde oder ein Häufchen dazukam. Das Wollknäuel zählt nicht: Es liegt nach einem Tipp auf
  // jedem Gerät woanders.
  _groundBlocks() {
    const H = this._H;
    const pad = H * 0.015;
    const out = [];
    for (const a of this._bote?.list || []) if (a.el && a.spec && a.w) out.push([a.l - pad, a.l + a.w + pad]);
    for (const [n, q] of Object.entries(this._festPos || {})) if (!/^(egg|stick)/.test(n)) out.push([q.l - pad, q.l + q.w + pad]);
    for (const [t, el] of this._gtEls || []) {
      if (GIFT_ITEMS[t]?.key === 'yarn') continue;
      if (el.parentElement === this._el.gifts && !el.style.top) out.push([el.offsetLeft - pad, el.offsetLeft + el.offsetWidth + pad]);
    }
    for (const q of this._poops().piles) out.push([this._pileX(q) - H * 0.05, this._pileX(q) + H * 0.05]);
    return out;
  }

  // Platz für ein Requisit der Breite w auf der Wiese, aus der festen Zahl u des Fensters: zwischen Vorrat und
  // Stein (Tür, Vorrat und Stein bleiben damit frei), neben allem, was dort schon steht. Ergebnis { x, w }.
  _groundSpot(u, w, kMin = 0.6) {
    const g = this._g;
    return groundSpot(u, w, g.hayR + this._H * 0.03, g.rock.l - this._H * 0.01, this._groundBlocks(), kMin);
  }

  // Platz für ein Requisit der Breite w, das hinter dem Pika steht (Schnee-Pika, Steintürmchen), und ihn daneben:
  // { x: wo er steht, px: Mitte des Requisits, dir: sein Blick dorthin }. Auf welcher Seite er steht, steht mit dem
  // Fenster fest (v). Reicht die Wiese nicht für beide (schmale Karte), bleibt der Abstand trotzdem, sonst
  // verdeckte er, was er baut: Das Requisit steht dann zum Stein hin, er vor dem Vorrat. Beide rücken dabei so
  // weit vom Stein weg, dass das Requisit links von der Klo-Ecke am Steinfuß steht (dort liegen die Häufchen
  // davor, und ein Vogel auf dem Stein säße vor dem Schnee-Pika), höchstens aber, bis der Pika an der Tür steht:
  // Auf den schmalsten Karten (340 × 248, 320 × 400) reicht das nicht ganz, das Requisit ragt dort noch vor den Stein.
  _besideSpot(u, v, w) {
    const { pW, hayR, rock, hole } = this._g;
    const U = this._groundSpot(u, w + pW * 0.9, 1);
    const tight = rock.l - hayR - this._H * 0.04 < U.w;
    const dir = tight || v < 0.5 ? 1 : -1;
    const x = U.x - dir * (U.w / 2 - pW * 0.45);
    const px = U.x + dir * (U.w / 2 - w / 2);
    const d = tight ? clamp(px + w / 2 - (rock.l - rock.w * 0.08 - this._H * 0.05), 0, Math.max(0, Math.min(x - pW * 0.5 - hole.r, px - w / 2 - hayR))) : 0;
    return { dir, x: x - d, px: px - d };
  }

  // Requisit am Boden aufstellen: Mitte x, Breite w, Höhe h; die Unterkante liegt sink px unter der Bodenlinie
  // (bottom über --gb, also von gy aus). front: vorn auf dem Wiesenstreifen vor dem Pika (.actsf), sonst hinter ihm.
  _aprop(cls, svg, x, w, h, front = false, sink = 0) {
    const el = document.createElement('div');
    el.className = `aprop ${cls}`;
    Object.assign(el.style, {
      left: `${(x - w / 2).toFixed(1)}px`, width: `${w.toFixed(1)}px`, height: `${h.toFixed(1)}px`,
      bottom: `calc(var(--gb) - ${sink.toFixed(1)}px)`,
    });
    el.innerHTML = svg;
    (front ? this._el.actsf : this._el.acts).appendChild(el);
    (this._aprops ??= new Set()).add(el);
    void el.offsetWidth;
    el.classList.add('on');
    return el;
  }

  // Requisiten am Boden wegräumen (only: nur dieses): ausblenden, dann entfernen. _cleanup räumt alle ab.
  _apropsAway(only = null) {
    for (const el of only ? [only] : [...(this._aprops || [])]) {
      if (!this._aprops?.delete(el)) continue;
      el.classList.remove('on');
      el.classList.add('off');
      setTimeout(() => el.remove(), 950);
    }
  }

  // ---------- Regen: Pfützenspringen ----------

  // Die Pfütze liegt vorn auf dem Wiesenstreifen (Platz aus dem Fenster, _groundSpot). Er springt im festen Takt
  // hinein (PUDDLE_MS ab der Planzeit: Alle Geräte springen gleichzeitig, wer später einsteigt, im selben Takt),
  // bei jeder Landung spritzt es. Der letzte Sprung ist der größte. Die Schleife endet mit einer Landung.
  async _puddle() {
    const S = this._slotFor('puddle');
    const { pW, pH } = this._g;
    const P = this._groundSpot(S.r(2), pW * 1.3);
    const h = P.w * 0.16;
    const el = this._aprop('puddle', PUDDLE_SVG, P.x, P.w, h, true, h - pH * 0.045);
    await this._goSpot(S, P.x, 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const t0 = S.start + ACT_WALK + 800;
    const n = puddleJumps(S.r);
    if (this._planNow() < t0 - 300) this._say(pick(['Eine Pfütze!', 'Pfütze!', 'oh!']), 1000);
    for (let i = Math.max(0, Math.ceil((this._planNow() - t0) / PUDDLE_MS)); i < n; i++) {
      await this._at(t0 + i * PUDDLE_MS);
      const big = i === n - 1 && !calmMotion();
      this._jump(big ? 'binky' : 'hop1', true);
      await this._wait(JUMPS[big ? 'binky' : 'hop1'].air[1]);
      this._splash(el, big ? 9 : 5);
      if (i === n - 1) this._say('PLATSCH!', 1200);
      else if (i % 2 === 0) this._say(pick(['platsch!', 'plitsch!', 'hihi']), 700);
    }
    await this._wait(600);
    this._happy(1300);
    await this._wait(1400);
    this._apropsAway(el);
    await this._wait(400);
  }

  // Es spritzt: n Tropfen fliegen von den Füßen im Bogen zur Seite, auf der Pfütze läuft ein Ring nach außen.
  // Bewegung reduzieren: nur der Ring.
  _splash(el, n) {
    if (el?.isConnected) {
      el.classList.remove('rip');
      void el.offsetWidth;
      el.classList.add('rip');
    }
    if (calmMotion()) return;
    const { pW, pH, gy } = this._g;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const s = document.createElement('span');
      s.className = 'splash';
      s.innerHTML = DROP_SVG;
      s.style.left = `${(this._x + side * rnd(0.22, 0.46) * pW).toFixed(1)}px`;
      s.style.top = `${(gy - pH * 0.06).toFixed(1)}px`;
      s.style.setProperty('--dx', `${(side * rnd(0.1, 0.4) * pW).toFixed(1)}px`);
      s.style.setProperty('--dy', `${(-rnd(0.2, 0.55) * pH).toFixed(1)}px`);
      this._el.fx.appendChild(s);
      setTimeout(() => s.remove(), 800);
    }
  }

  // ---------- Regen: Papierschiffchen ----------

  // Er setzt ein Papierschiffchen auf die Pfütze und pustet es Etappe für Etappe hinüber; am anderen Ufer treibt
  // es von selbst zurück, dann fischt er es heraus. Wo das Schiffchen ist, steht mit der Planzeit fest (BOAT_T):
  // Wer später einsteigt, sieht es an derselben Stelle. Bei Regen hält die andere Pfote das Blatt.
  async _boat() {
    const S = this._slotFor('boat');
    const { pW, pH } = this._g;
    // Pfütze und Standplatz daneben als ein Stück; auf welcher Seite er steht, steht mit dem Fenster fest
    const U = this._groundSpot(S.r(2), pW * 1.95);
    const dir = S.r(3) < 0.5 ? 1 : -1;
    const pw = Math.max(pW * 0.6, U.w - pW * 0.62);
    const h = pw * 0.16;
    const el = this._aprop('puddle', PUDDLE_SVG, U.x + dir * (U.w / 2 - pw / 2), pw, h, true, h - pH * 0.045);
    const bw = Math.min(pW * 0.3, pw * 0.4);
    const boat = document.createElement('div');
    boat.className = 'pboat';
    boat.innerHTML = BOAT_SVG;
    boat.style.width = `${bw.toFixed(1)}px`;
    boat.style[dir > 0 ? 'left' : 'right'] = '7%';
    el.appendChild(boat);
    const span = pw * 0.86 - bw;
    // f: 0 = an seinem Ufer, 1 = drüben; ms: so lange gleitet es dorthin; skip: so viele ms davon sind schon um
    // (negative Verzögerung: Die Fahrt läuft mittendrin weiter)
    const sail = (f, ms, ease, skip = 0) => {
      boat.style.transition = `transform ${Math.round(ms)}ms ${ease} ${-Math.round(skip)}ms, opacity .25s`;
      boat.style.transform = `translateX(${(dir * f * span).toFixed(1)}px)`;
    };
    // Eine Fahrt von a nach b, die zur Planzeit t0 begann und ms dauert: Wer später dazukommt (oder dessen
    // Zeitgeber sich verspätet), sieht das Schiffchen dort, wo es auf den anderen Geräten gerade ist
    const trip = (a, b, t0, ms, ease = `cubic-bezier(${BOAT_EASE.join(', ')})`) => {
      const late = this._planNow() - t0;
      if (late >= ms) return sail(b, 0, 'linear');
      sail(a, 0, 'linear');
      void boat.offsetWidth;
      sail(b, ms, ease, Math.max(0, late));
    };
    await this._goSpot(S, U.x - dir * (U.w / 2 - pW * 0.36), 0.9);
    this._face(dir);
    const p = this._el.pika;
    const T0 = S.start + ACT_WALK;
    const K = boatPuffs(S.r);
    const T1 = T0 + BOAT_T.launch + K * BOAT_T.puff;
    if (this._planNow() < T0 + 1000) {
      // hervorkramen, zeigen, bücken und aufs Wasser setzen
      this._propOn('boating');
      if (this._planNow() < T0 + 400) this._say(pick(['Ahoi!', 'Schiff ahoi!', 'Leinen los!']), 1300);
      await this._at(T0 + 900);
      p.classList.add('sniff');
      await this._at(T0 + 1300);
      await this._propOff('boating');
    }
    // Späteinstieg: Das Schiffchen liegt dort, wo es nach der Planzeit gerade ist (boatPos), nicht eine Etappe
    // voraus. Die laufende Etappe nimmt er mittendrin auf.
    const now = this._planNow();
    sail(boatPos(now - T0, K), 0, 'linear');
    void boat.offsetWidth;
    boat.classList.add('afloat');
    await this._waitMax(400, T0 + BOAT_T.launch);
    p.classList.remove('sniff');
    for (let k = clamp(Math.floor((now - T0 - BOAT_T.launch) / BOAT_T.puff), 0, K); k < K; k++) {
      // Luft holen, pusten, das Schiffchen gleitet: jeder Schritt zu seiner Planzeit
      const tk = T0 + BOAT_T.launch + k * BOAT_T.puff;
      const tb = tk + BOAT_T.blow;
      await this._at(tk);
      if (this._planNow() < tk + 450) {
        p.classList.add('pu-in');
        await this._at(tk + 450);
        p.classList.remove('pu-in');
      }
      if (this._planNow() < tb + 600) p.classList.add('blow');
      await this._at(tb);
      trip(k / K, (k + 1) / K, tb, BOAT_T.glide);
      await this._at(tb + 600);
      p.classList.remove('blow');
      if (k === K - 1 && this._planNow() < tb + 1200) this._say(pick(['drüben!', 'angekommen!', 'geschafft!']), 1100);
    }
    await this._at(T1);
    // Am anderen Ufer dreht es bei und treibt zurück
    trip(1, 0, T1, BOAT_T.back - BOAT_T.home, 'ease-in-out');
    p.classList.add('look-f');
    await this._waitMax(1200, S.end);
    if (this._planNow() < S.end - 1200) this._say(pick(['es kommt zurück!', 'hui!', 'schön!']), 1200);
    await this._at(S.end);
    p.classList.remove('look-f');
    // herausfischen und wegstecken
    p.classList.add('sniff');
    await this._wait(450);
    boat.classList.remove('afloat');
    p.classList.remove('sniff');
    this._propOn('boating');
    this._happy(1200);
    await this._wait(1100);
    await this._propOff('boating');
    this._apropsAway(el);
    await this._wait(400);
  }

  // ---------- Regen: Tropfen fangen ----------

  // Ein dicker Tropfen fällt in ms Millisekunden auf den Punkt (vx, vy) der Pika-Grafik, up px darüber (so hoch ist
  // das Maul im Hüpfer). hit: Er verschwindet im Maul, sonst zerplatzt er (auf der Nase). Ein eigenes Element in
  // .fx mit eigenem Zeitgeber, kein Tropfen der Regenebene. Bewegung reduzieren: Er fällt nicht, er blendet am
  // Ziel ein und aus (Stil).
  _bigDrop(vx, vy, up, hit, ms) {
    const { pH } = this._g;
    const o = this._svgPt(vx, vy);
    const el = document.createElement('span');
    el.className = hit ? 'bigdrop hit' : 'bigdrop';
    el.innerHTML = DROP_SVG;
    el.style.left = `${o.x.toFixed(1)}px`;
    el.style.top = `${(o.y - up).toFixed(1)}px`;
    // von oberhalb des Bildrands, höchstens aber aus 1,7 Pika-Höhen (hohe Karten: Er fiele sonst zu schnell)
    el.style.setProperty('--fy', `${(-Math.min(o.y - up + pH * 0.25, pH * 1.7)).toFixed(1)}px`);
    el.style.setProperty('--fd', `${Math.round(ms)}ms`);
    this._el.fx.appendChild(el);
    setTimeout(() => el.remove(), ms + 420);
  }

  // Der Tropfen ist auf der Nase zerplatzt: n Spritzer fliegen vom Punkt (vx, vy) der Pika-Grafik zur Seite. Wie
  // _splash, aber mit den festen Zahlen u(0), u(1) … des Fensters statt gewürfelt. Bewegung reduzieren: keine.
  _noseSplash(vx, vy, n, u) {
    if (calmMotion()) return;
    const { pW, pH } = this._g;
    const o = this._svgPt(vx, vy);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const el = document.createElement('span');
      el.className = 'splash sn';
      el.innerHTML = DROP_SVG;
      el.style.left = `${(o.x + side * pW * 0.03).toFixed(1)}px`;
      el.style.top = `${o.y.toFixed(1)}px`;
      el.style.setProperty('--dx', `${(side * (0.12 + u(2 * i) * 0.2) * pW).toFixed(1)}px`);
      el.style.setProperty('--dy', `${(-(0.08 + u(2 * i + 1) * 0.12) * pH).toFixed(1)}px`);
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 800);
    }
  }

  // Er legt das Blatt neben sich ins Gras, schaut zum Himmel, legt den Kopf zurück, streckt die Zunge heraus und
  // fängt Regentropfen: drei bis fünf Versuche im festen Takt (DROPS_T.try ab der Planzeit: Alle Geräte fangen
  // gleichzeitig, wer später einsteigt, im selben Takt). Zu jedem fällt ein dicker Tropfen (_bigDrop), dem er
  // entgegenhüpft oder sich entgegenstreckt. Ein gefangener schmeckt („mmh!“, er wackelt vergnügt); springt er zu
  // früh, landet der Tropfen auf seiner Nase („plitsch!“, er schüttelt den Kopf). Zahl und Ausgang der Versuche,
  // Platz, Seite und Sprüche stehen mit dem Fenster fest (dropsPlan); am Ende zählt er stolz, was er erwischt hat
  // (auch ein später eingestiegenes Gerät nennt dieselbe Zahl), und hebt das Blatt wieder auf.
  // Bewegung reduzieren: kein Hüpfer, kein Strecken, kein Kopfschütteln; die Tropfen blenden an seinem Maul ein.
  async _drops() {
    const S = this._slotFor('drops');
    const { pW, pH } = this._g;
    const p = this._el.pika;
    const calm = calmMotion();
    const plan = dropsPlan(S.r);
    const line = (i, list) => list[Math.floor(S.r(i) * list.length)];
    // Das Blatt (eine halbe Pika-Breite) liegt hinter ihm im Gras. Platz für beide wie bei Schnee-Pika und
    // Steintürmchen (_besideSpot): zwischen Vorrat und Stein, neben dem, was dort schon steht; auf welcher Seite, steht
    // mit dem Fenster fest.
    const lw = pW * 0.5;
    const U = this._besideSpot(S.r(2), S.r(3), lw);
    const dir = -U.dir;
    await this._goSpot(S, U.x, 0.9);
    this._face(dir);
    const T0 = S.start + ACT_WALK;
    const t0 = T0 + DROPS_T.look;
    // Blatt weglegen (nur bei Regen hat er eins): bücken, es liegt im Gras, die Pfote ist frei
    const fresh = this._planNow() < T0 + 500;
    if (fresh) {
      await this._at(T0);
      p.classList.add('sniff');
      await this._wait(450);
    }
    const leaf = this._wx.wet ? this._aprop('leafp', LEAF_SVG, U.px, lw, lw * (22 / 64), false, pH * 0.02) : null;
    if (leaf && dir < 0) leaf.classList.add('mir');
    p.classList.add('drops');
    p.classList.remove('sniff');
    p.classList.add('look-up');
    if (fresh) this._say(line(40, ['Regentropfen!', 'Tropfen fangen!', 'aaah …']), 1100);
    // Die Versuche: jeder Schritt zu seiner Planzeit
    for (let i = Math.max(0, Math.ceil((this._planNow() - t0) / DROPS_T.try)); i < plan.length; i++) {
      const tk = t0 + i * DROPS_T.try;
      const { hit } = plan[i];
      const hop = !calm && (plan[i].hop || !hit);
      const reach = !calm && hit && !hop;
      // so hoch ist das Maul, wenn der Tropfen ankommt: oben im Hüpfer, gestreckt, oder am Boden
      const up = hit ? (hop ? pH * 0.27 : reach ? pH * 0.035 : 0) : 0;
      await this._at(tk + DROPS_T.drop - 60);
      p.classList.add('drops-up');
      await this._at(tk + DROPS_T.drop);
      if (hit) this._bigDrop(93.4, 55.6, up, true, DROPS_T.fall);
      else this._bigDrop(92.4, 49.4, 0, false, DROPS_T.fall);
      if (hop) {
        // Absprung so, dass er oben ist, wenn der Tropfen kommt; daneben: zu früh, er ist schon wieder unten
        const tj = tk + (hit ? DROPS_T.at - DROPS_T.jump : DROPS_T.early);
        await this._at(tj - 150);
        p.classList.add('crouch');
        await this._at(tj);
        p.classList.remove('crouch');
        this._jump('hop1', true);
      } else if (reach) {
        await this._at(tk + DROPS_T.at - DROPS_T.reach);
        p.classList.add('drops-st');
      }
      await this._at(tk + DROPS_T.at);
      if (hit) {
        // im Maul: Zunge herein; wieder am Boden (nach dem Hüpfer) schmeckt es
        await this._at(tk + DROPS_T.at + 120);
        p.classList.remove('drops-up', 'drops-st');
        const tl = tk + DROPS_T.at + (hop ? DROPS_T.land : 120);
        await this._at(tl);
        this._say(line(50 + i, ['mmh!', 'nass!', 'lecker!', 'mmh!']), 800);
        p.classList.add('drops-yum', 'happy');
        await this._at(tl + 660);
        p.classList.remove('drops-yum', 'happy');
      } else {
        this._noseSplash(92.4, 49.4, 4, (j) => S.r(60 + i * 8 + j));
        this._say(line(50 + i, ['plitsch!', 'plitsch!', 'daneben!']), 800);
        p.classList.add('crosseye');
        await this._at(tk + DROPS_T.at + 160);
        p.classList.remove('drops-up');
        p.classList.add('drops-no');
        await this._at(tk + DROPS_T.at + 800);
        p.classList.remove('drops-no', 'crosseye');
      }
    }
    await this._at(S.end);
    // stolz zählen
    p.classList.remove('look-up');
    this._mimik('proud', 1800);
    this._happy(1400);
    this._say(DROPS_COUNT[plan.filter((v) => v.hit).length], 1600);
    if (!calm) this._jump('hop1');
    await this._wait(1800);
    // das Blatt wieder aufheben
    p.classList.add('sniff');
    await this._wait(450);
    if (leaf) this._apropsAway(leaf);
    p.classList.remove('sniff', 'drops');
    await this._wait(400);
  }

  // ---------- Regen: Blattschirm kreiseln ----------

  // Tropfen fliegen im Ring vom kreiselnden Blatt: n Stück vom Blattrand nach außen und ein Stück hinunter, far-mal
  // so weit wie beim langsamen Kreiseln. Der Ring ist von der Seite gesehen ein flaches Oval; die Tropfen sitzen
  // abwechselnd an seiner linken und rechten Hälfte (die vorn und hinten flögen auf den Betrachter zu, man sähe sie
  // nur fallen). Verteilt mit den festen Zahlen u(0), u(1) … des Fensters. Bewegung reduzieren: Sie fliegen nicht,
  // sie blenden am Rand ein und aus (Stil).
  _twRing(n, far, u) {
    const { pW, pH } = this._g;
    const c = this._svgPt(89.5, 6);
    const rx = pW * 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i % 2 ? Math.PI : 0) + (u(i) - 0.5) * 1.7;
      const el = document.createElement('span');
      el.className = 'twdrop';
      el.innerHTML = DROP_SVG;
      el.style.left = `${(c.x + Math.cos(a) * rx).toFixed(1)}px`;
      el.style.top = `${(c.y + Math.sin(a) * rx * 0.3).toFixed(1)}px`;
      el.style.setProperty('--dx', `${(Math.cos(a) * pW * (0.26 + u(n + i) * 0.26) * far).toFixed(1)}px`);
      el.style.setProperty('--dy', `${(pH * (0.12 + 0.1 * Math.sin(a))).toFixed(1)}px`);
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 700);
    }
  }

  // Er nimmt den Stiel des Blattschirms in beide Pfoten und kreiselt ihn: Das Blatt dreht sich um seinen Stiel, in
  // drei Stufen immer schneller, und die Tropfen fliegen im Ring davon (_twRing, zu festen Planzeiten: twirlRings).
  // Dann hält er es an, ihm ist kurz schwindlig, „Ta-da!“. Manchmal (twirlLifts: feste Zahl des Fensters, bei Wind
  // ab TWIRL_WIND öfter; der Wind ist auf allen Geräten derselbe) fasst der Wind unter das Blatt: Es hebt ab und
  // treibt ein Stück mit dem Wind, er hüpft hinterher und fängt es („hui!“ … „hab dich!“). Beide Schlüsse dauern
  // gleich lang. Alle Geräte beginnen zur selben Planzeit; ein Gerät, das später dazukommt, steigt nicht ein
  // (ACT_NOJOIN). Ohne Regen (aus der Vorschau) holt er das Blatt dafür hervor.
  // Schmale Karten: Reicht der Platz in Windrichtung nicht für den Hüpfer, tritt er vorher zurück; reicht er auch
  // dann nicht, steigt das Blatt gerade hoch, und er springt ihm auf der Stelle nach.
  // Bewegung reduzieren: Das Blatt dreht sich nicht (es steht schräg), je Stufe blendet ein Ring Tropfen ein, und
  // es hebt nie ab.
  async _twirl() {
    const S = this._slotFor('twirl');
    const { pW, xR } = this._g;
    const p = this._el.pika;
    const calm = calmMotion();
    const line = (i, list) => list[Math.floor(S.r(i) * list.length)];
    // einmal zu Beginn entschieden: Dreht der Wind mittendrin, bleibt es dabei
    const lift = !calm && twirlLifts(S.r, this._wind);
    const dir = this._windDir || (S.r(3) < 0.5 ? -1 : 1);
    let x = this._hobbySpot(S.r(2));
    let to = x;
    if (lift) {
      const D = pW * 0.7;
      const lim = (v) => clamp(v, pW * 0.45, xR);
      to = lim(x + dir * D);
      x = lim(to - dir * D);
      if (Math.abs(to - x) < pW * 0.3) to = x;
    }
    await this._goSpot(S, x, 0.9);
    this._face(dir);
    p.classList.add('twirl');
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil): Wer früh am Platz ist, hält das Blatt so lange bereit
    const T0 = S.start + ACT_WALK;
    const tEnd = T0 + TWIRL_T.grip + TWIRL_T.slow + TWIRL_T.mid + twirlFast(S.r);
    await this._at(T0);
    this._say(line(40, ['Kreisel!', 'dreh dich!', 'und rum!']), 1000);
    await this._at(T0 + TWIRL_T.grip);
    p.classList.add('tw-go');
    let st = 0;
    for (const [i, R] of twirlRings(S.r).entries()) {
      await this._at(T0 + R.t);
      // Kam er zu spät an seinen Platz, holt er die Stufen nach, aber nicht alle versäumten Ringe auf einmal
      const now = this._planNow() < T0 + R.t + 300;
      const first = R.st !== st || i === 0;
      if (R.st !== st) {
        st = R.st;
        p.classList.add(st === 1 ? 'tw-2' : 'tw-3');
        if (now) this._say(st === 1 ? line(41, ['schneller!', 'und schneller!', 'hui!']) : line(42, ['huiii!', 'noch schneller!', 'wusch!']), 900);
      }
      if (now && (!calm || first)) this._twRing(4 + R.st, 1 + R.st * 0.3, (j) => S.r(100 + i * 16 + j));
    }
    await this._at(tEnd);
    p.classList.remove('tw-go', 'tw-2', 'tw-3');
    if (lift) {
      // Der Wind fasst unter das Blatt: Es steigt und treibt bis über die Stelle, an der er es gleich fängt
      p.style.setProperty('--twx', `${((Math.abs(to - x) / pW) * 120).toFixed(1)}px`);
      p.classList.add('tw-off', 'look-up');
      this._mimik('awe', 1400);
      this._say(line(45, ['hui!', 'oh!', 'mein Blatt!']), 900);
      await this._at(tEnd + TWIRL_T.lift);
      p.classList.add('crouch');
      await this._wait(TWIRL_T.crouch);
      p.classList.remove('crouch');
      // Es sinkt ihm entgegen, während er springt (im Stil dieselbe Dauer und Kurve wie der Hüpfer)
      p.classList.add('tw-back');
      if (to !== x) await this._hopTo(to, 0, false);
      else {
        this._jump('hop1', true);
        await this._wait(TWIRL_T.hop);
      }
      this._face(dir);
      p.classList.remove('tw-off', 'tw-back', 'look-up');
      p.classList.add('happy');
      this._say(line(46, ['hab dich!', 'gefangen!', 'hiergeblieben!']), 1100);
      await this._at(S.end);
      p.classList.remove('happy');
    } else {
      // anhalten: Das Blatt dreht noch eine halbe Runde aus (.tw-end), ein letzter Schwung Tropfen, ihm ist kurz schwindlig
      if (!calm) this._twRing(8, 1.5, (j) => S.r(80 + j));
      p.classList.add('tw-end', 'crosseye');
      this._say(line(43, ['huch …', 'alles dreht sich!', 'puh!']), 1000);
      await this._at(tEnd + 1100);
      p.classList.remove('tw-end', 'crosseye');
      p.classList.add('tilt');
      this._mimik('proud', 1600);
      this._say(line(44, ['Ta-da!', 'Kreisel! ♥', 'trocken!']), 1300);
      await this._at(S.end);
      p.classList.remove('tilt');
    }
    this._happy(1200);
    await this._wait(1200);
    p.classList.remove('twirl');
    await this._wait(100);
  }

  // ---------- Schnee: Schnee-Pika ----------

  // Bei liegendem Schnee baut er sich einen Zwilling: Bauch, Kopf, Ohren, Gesicht. Jede Schicht hat ihr festes
  // Stück des Fensters (wie beim Malen): Wer später einsteigt, sieht ihn so weit wie die anderen. Er scharrt Schnee
  // zusammen (Kopf tief) und klopft ihn fest, dabei wächst die Schicht. Am Ende tritt er zurück und ist stolz;
  // der Schnee-Pika bleibt noch kurz stehen und sackt dann zusammen.
  async _snowpika() {
    const S = this._slotFor('snowpika');
    const late = this._jumpIn(S);
    const { pW, pH } = this._g;
    const FH = pH * 0.84;
    const FW = FH * (60 / 72);
    const U = this._besideSpot(S.r(2), S.r(3), FW);
    const dir = U.dir;
    await this._goSpot(S, U.x);
    this._face(dir);
    const p = this._el.pika;
    const el = this._aprop('snowp', SNOWPIKA_SVG, U.px, FW, FH, false, pH * 0.03);
    const t0 = S.start + ACT_WALK + 600;
    const L = (S.end - t0) / 4;
    if (!late && this._planNow() < t0) this._say(pick(['Schnee!', 'Ein Schnee-Pika!', 'Bauen!']), 1300);
    for (let i = 0; i < 4; i++) {
      const lEnd = t0 + (i + 1) * L;
      if (this._planNow() >= lEnd - 900) {
        el.classList.add('now', `s${i + 1}`); // schon gebaut
        continue;
      }
      await this._at(t0 + i * L);
      p.classList.add('sniff');
      await this._waitMax(800, lEnd - 800);
      p.classList.remove('sniff');
      void el.offsetWidth;
      el.classList.remove('now');
      el.style.setProperty('--sg', `${Math.max(300, lEnd - 600 - this._planNow()).toFixed(0)}ms`);
      el.classList.add(`s${i + 1}`);
      p.classList.add('spat');
      await this._at(lEnd - 600);
      p.classList.remove('spat');
      if (i < 3 && S.r(10 + i) < 0.5) this._say(pick(['klopf, klopf', 'noch mehr!', 'hmm …']), 900);
      await this._at(lEnd);
    }
    // zurücktreten, anschauen, stolz sein
    await this._walkTo(this._x - dir * pW * 0.3, 0.6, true, 0, true);
    this._face(dir);
    p.classList.add('look-f');
    await this._wait(700);
    this._happy(1400);
    this._mimik('proud', 2600);
    this._say(pick(['Fertig!', 'Hallo, du!', 'Mein Zwilling!', '♥']), 1500);
    this._jump('hop1');
    await this._wait(4000 + S.r(7) * 3000);
    p.classList.remove('look-f');
    this._apropsAway(el);
    await this._wait(700);
  }

  // ---------- Schnee: Schneeengel ----------

  // Platz für den Abdruck und ihn daneben: { px: Mitte des Abdrucks, w: seine Breite, x: dort steht er danach,
  // dir: sein Blick von dort zum Abdruck }. Der Abdruck liegt zwischen Vorrat und Stein (_groundSpot), eine gute
  // Pika-Breite groß; ist die Wiese schmaler (schmale Karte), wird er kleiner, höchstens bis auf 0,62 Pika-Breiten
  // (dann ragt er vor Vorrat und Stein). Auf welche Seite er zum Anschauen hüpft, steht mit dem Fenster fest; ist
  // dort kein Platz oder die Wiese schmal, nach links (vor den Vorrat, wie beim Schnee-Pika).
  _angelSpot(S) {
    const { pW, hayR, rock, xR } = this._g;
    const room = rock.l - hayR - this._H * 0.04;
    const w = clamp(room, pW * 0.62, pW * 1.05);
    const px = this._groundSpot(S.r(2), w, 1).x;
    const off = w / 2 + pW * 0.42;
    const dir = room < w + pW * 0.9 || S.r(3) < 0.5 || px + off > xR ? 1 : -1;
    return { px, w, dir, x: clamp(px - dir * off, pW * 0.45, xR) };
  }

  // Schnee stiebt auf: n Flöckchen links und rechts von x am Boden. Wie _puff, aber weiß und mit den festen Zahlen
  // u(0), u(1) … des Fensters statt gewürfelt. Bewegung reduzieren: keine.
  _snowPuff(x, n, u) {
    if (calmMotion()) return;
    const { pW, gy } = this._g;
    const H = this._H;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'puff snowy';
      const side = i % 2 ? 1 : -1;
      el.style.left = `${(x + side * pW * (0.2 + u(2 * i) * 0.3)).toFixed(1)}px`;
      el.style.top = `${(gy - H * 0.04).toFixed(1)}px`;
      el.style.setProperty('--px', `${(side * H * (0.04 + u(2 * i + 1) * 0.05)).toFixed(1)}px`);
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 650);
    }
  }

  // Er schaut sich um, plumpst rückwärts in den Schnee, schwingt zwei- oder dreimal Arme und Beine (der Abdruck
  // bekommt mit jedem Schwung breitere Flügel), rappelt sich auf, hüpft zur Seite und schaut sich den Engel stolz
  // an. Der Abdruck bleibt noch ein paar Sekunden, dann weht Schnee darüber. Zahl der Schwünge, Platz, Seite und
  // Sprüche stehen mit dem Fenster fest. Ein Gerät, das später dazukommt, steigt nicht ein (ACT_NOJOIN).
  // Bewegung reduzieren: Er legt sich nicht hin; der Abdruck blendet neben ihm ein.
  async _angel() {
    const S = this._slotFor('angel');
    const p = this._el.pika;
    const calm = calmMotion();
    const n = angelSweeps(S.r);
    const A = this._angelSpot(S);
    const h = A.w * 0.48;
    const line = (i, list) => list[Math.floor(S.r(i) * list.length)];
    // Der Abdruck liegt von Anfang an da (noch leer): Ändert sich die Größe der Karte, bricht _layout damit ab
    const el = this._aprop('angelp', ANGEL_SVG, A.px, A.w, h, false, h * 0.1);
    await this._goSpot(S, calm ? A.x : A.px, 0.9);
    this._face(calm ? A.dir : S.r(4) < 0.5 ? -1 : 1);
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil)
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    this._say(line(20, ['Schnee!', 'So viel Schnee!', 'hui, Schnee!']), 1100);
    p.classList.add('look-b');
    await this._wait(ANGEL_T.look / 2);
    p.classList.remove('look-b');
    p.classList.add('look-f');
    await this._wait(ANGEL_T.look / 2);
    p.classList.remove('look-f');
    if (calm) {
      // er schaut zu, wie der ganze Abdruck langsam erscheint (so lange, wie er sonst im Schnee läge)
      el.style.setProperty('--ag', `${ANGEL_T.flop + n * ANGEL_T.sweep}ms`);
      el.classList.add('b', 'w');
      p.classList.add('look-f');
      await this._wait(ANGEL_T.flop + n * ANGEL_T.sweep + ANGEL_T.up + ANGEL_T.hop);
    } else {
      p.classList.add('angel-dn');
      await this._wait(ANGEL_T.flop * 0.75);
      // gelandet: Der Abdruck von Bauch, Kopf und Ohren ist da
      el.classList.add('b');
      this._snowPuff(this._x, 4, (i) => S.r(30 + i));
      this._say(line(21, ['plumps!', 'uff!', 'hihi']), 800);
      await this._wait(ANGEL_T.flop * 0.25);
      p.classList.add('angel-go', 'happy');
      for (let k = 1; k <= n; k++) {
        el.style.setProperty('--aw', (0.2 + (0.8 * k) / n).toFixed(2));
        el.classList.add('w');
        this._snowPuff(this._x, 2, (i) => S.r(40 + k * 8 + i));
        if (k === 2) this._say(line(22, ['wusch, wusch!', 'und nochmal!', 'hui!']), 900);
        await this._wait(ANGEL_T.sweep / 2);
        this._snowPuff(this._x, 2, (i) => S.r(44 + k * 8 + i));
        await this._wait(ANGEL_T.sweep / 2);
      }
      p.classList.remove('angel-go', 'happy', 'angel-dn');
      p.classList.add('angel-up');
      await this._wait(ANGEL_T.up);
      p.classList.remove('angel-up');
      // zur Seite, damit man ihn sieht
      await this._hopTo(A.x, 0, false);
      await this._wait(Math.max(0, ANGEL_T.hop - 620));
    }
    this._face(A.dir);
    p.classList.add('look-f');
    this._happy(1400);
    this._mimik('proud', ANGEL_T.proud);
    this._say(line(23, ['Ein Schneeengel!', 'Ein Schneeengel!', 'Mein Schneeengel! ♥']), 1700);
    if (!calm) this._jump('hop1');
    await this._wait(ANGEL_T.proud);
    // er bleibt noch liegen, dann weht Schnee darüber
    const stay = ANGEL_T.stay + S.r(7) * ANGEL_T.stayMore;
    await this._wait(stay * 0.4);
    p.classList.add('tilt');
    await this._wait(stay * 0.6);
    p.classList.remove('tilt', 'look-f');
    el.classList.add('drift');
    await this._wait(ANGEL_T.drift);
    this._apropsAway(el);
    await this._wait(300);
  }

  // ---------- Schnee: Schneeball rollen ----------

  // Er scharrt einen kleinen Schneeball zusammen und schiebt ihn mit Nase und Pfoten in zwei Etappen über die Wiese:
  // Die Kugel wächst mit dem Weg (drei Größen, snowballR) und hinterlässt eine Spur. Am Ende klopft er sie fest und
  // lehnt sich an („so groß!“). Manchmal (snowballRuns, steht mit dem Fenster fest) wird sie zu groß und rollt das
  // letzte Stück von selbst: Er hüpft hinterher („halt!“). Wo die Kugel ist und wie groß, steht mit der Planzeit fest
  // (snowballPos): Wer später einsteigt, sieht sie an derselben Stelle. Sie bleibt noch kurz stehen und sackt dann
  // zusammen wie der Schnee-Pika.
  // Der Weg liegt zwischen Vorrat und Stein (_groundSpot, höchstens 1,5 Pika-Breiten) und wird kürzer, wenn dort
  // weniger Platz ist. Bleibt kaum ein Weg (schmale Karte) oder gilt „Bewegung reduzieren“, wächst die Kugel an Ort
  // und Stelle (still): Er steht daneben und klopft, nichts rollt.
  async _snowball() {
    const S = this._slotFor('snowball');
    const { pW, pH, xR, hayR, rock } = this._g;
    const H = this._H;
    const p = this._el.pika;
    const T0 = S.start + ACT_WALK;
    const t3 = SNOWBALL_T.scrape + SNOWBALL_T.leg + SNOWBALL_T.rest;
    const t4 = t3 + SNOWBALL_T.leg;
    const rad = (s) => snowballR(s) * pH;
    const rMax = rad(SNOWBALL_BIG);
    const line = (i, list) => list[Math.floor(S.r(i) * list.length)];
    const now = () => this._planNow() - T0;
    // Weg der Kugelmitte von c0 aus in Richtung dir: Am Anfang ist sie klein, am Ende groß, beides bleibt im Streifen
    // zwischen Vorrat und Stein, links von der Klo-Ecke am Steinfuß (wie _besideSpot), neben allem, was dort steht
    const lo = hayR + H * 0.03;
    const U = groundSpot(S.r(2), pW * 1.5 + rad(1) + rMax, lo, Math.max(lo, rock.l - rock.w * 0.08 - H * 0.04), this._groundBlocks(), 0.2);
    const still = calmMotion() || U.w - rad(1) - rMax < pW * 0.35;
    const run = !still && snowballRuns(S.r);
    const B = still ? this._besideSpot(S.r(2), S.r(3), 2 * rad(3)) : null;
    const dir = B ? B.dir : S.r(3) < 0.5 ? 1 : -1;
    const travel = B ? 0 : U.w - rad(1) - rMax;
    const c0 = B ? B.px : U.x - dir * (U.w / 2 - rad(1));
    const fa = snowballPos(SNOWBALL_T.scrape + SNOWBALL_T.leg, run).f;
    const fb = snowballPos(t4, run).f;
    // dort steht er, wenn die Kugel bei f ist und die Größe s hat: mit Nase und Pfoten an ihr
    const xAt = (f, s) => (B ? B.x : clamp(c0 + dir * (f * travel - pW * 0.4 - rad(s) * 0.9), pW * 0.45, xR));
    // Das Requisit überspannt den ganzen Weg: darin die Spur und die Kugel (Kasten für die größte Kugel)
    const el = this._aprop('sbp', '', c0 + (dir * travel) / 2, travel + 2 * rMax, 2 * rMax, false, pH * 0.03);
    const part = (cls, parent) => {
      const d = document.createElement('div');
      d.className = cls;
      parent.appendChild(d);
      return d;
    };
    const track = part('sb-track', el);
    Object.assign(track.style, {
      left: `${rMax.toFixed(1)}px`, width: `${travel.toFixed(1)}px`, height: `${(pH * 0.1).toFixed(1)}px`, bottom: `${(pH * 0.045).toFixed(1)}px`,
      transformOrigin: dir > 0 ? '0 50%' : '100% 50%', display: travel > 0 ? '' : 'none',
    });
    const ball = part('sb-ball', el);
    Object.assign(ball.style, { left: `${(dir > 0 ? 0 : travel).toFixed(1)}px`, width: `${(2 * rMax).toFixed(1)}px`, height: `${(2 * rMax).toFixed(1)}px` });
    const size = part('sb-size', part('sb-sink', ball));
    size.innerHTML = SNOWBALL_SVG;
    const marks = size.querySelector('.sb-rot');
    const turn = (travel / rad(2)) * 57.3; // Grad über den ganzen Weg
    // Kugel bei f (Weg 0 … 1) mit Größe s: schieben, wachsen, Kerben drehen, Spur aufziehen. ms: so lange braucht
    // sie dorthin; skip: so viele ms davon sind schon um (negative Verzögerung, wie beim Schiffchen)
    const put = (f, s, ms = 0, ease = 'linear', skip = 0) => {
      const tr = `transform ${Math.round(ms)}ms ${ease} ${-Math.round(skip)}ms`;
      const set = (node, v) => node && Object.assign(node.style, { transition: tr, transform: v });
      set(ball, `translateX(${(dir * f * travel).toFixed(1)}px)`);
      set(size, `scale(${(rad(s) / rMax).toFixed(3)})`);
      set(marks, `rotate(${(dir * f * turn).toFixed(0)}deg)`);
      set(track, `scaleX(${f.toFixed(3)})`);
    };
    // Von a nach b ([f, s]), begonnen zur Planzeit t0 (ms ab T0), Dauer ms: Wer später dazukommt, sieht die Kugel
    // dort, wo sie auf den anderen Geräten gerade ist
    const roll = (a, b, t0, ms, ease = 'linear') => {
      const late = now() - t0;
      if (late >= ms) return put(...b);
      put(...a);
      void ball.offsetWidth;
      put(...b, ms, ease, Math.max(0, late));
    };
    // Späteinstieg: Die Kugel liegt gleich dort, wo sie nach der Planzeit gerade ist, er steht an ihr. Rollt sie
    // gerade von selbst davon, steht er noch dort, wo die zweite Etappe endete (gleich hüpft er hinterher).
    const P0 = snowballPos(Math.max(0, now()), run);
    const chasing = run && now() > t4 && now() < t4 + SNOWBALL_T.gasp + SNOWBALL_T.chase - 600;
    put(P0.f, P0.s);
    await this._goSpot(S, chasing ? xAt(fb, 3) : xAt(P0.f, Math.max(1, P0.s)), 0.9);
    this._face(dir);
    // 1. Schnee zusammenscharren: bücken, festklopfen, die erste Kugel wächst
    if (now() < SNOWBALL_T.scrape - 300) {
      if (now() < 300) this._say(line(20, ['Ein Schneeball!', 'Rollen!', 'Eine Kugel!']), 1200);
      await this._at(T0 + 150);
      p.classList.add('sniff');
      await this._at(T0 + SNOWBALL_T.dig);
      p.classList.remove('sniff');
      p.classList.add('sb-pat');
      roll([0, 0], [0, 1], SNOWBALL_T.dig, SNOWBALL_T.scrape - SNOWBALL_T.dig);
      await this._at(T0 + SNOWBALL_T.scrape);
      p.classList.remove('sb-pat');
    }
    // 2. zwei Etappen schieben (still: klopfen), die Kugel wächst von Stufe zu Stufe
    for (const [i, ts, a, b] of [[0, SNOWBALL_T.scrape, [0, 1], [fa, 2]], [1, t3, [fa, 2], [fb, 3]]]) {
      const te = ts + SNOWBALL_T.leg;
      if (now() >= te - HOP_MS.trip) {
        put(...b); // schon geschoben
        continue;
      }
      await this._at(T0 + ts);
      roll(a, b, ts, SNOWBALL_T.leg);
      if (still) {
        p.classList.add('sb-pat');
        await this._at(T0 + te);
        p.classList.remove('sb-pat');
      } else {
        // in ganzen Trippelschritten bis ans Ende der Etappe (wie _walkTo, nur mit der Dauer der Etappe statt einem
        // Tempo); .walking hält ihn bei einem Abbruch dort an, wo er gerade ist (_cleanup, _freeze)
        const ms = hopRound(T0 + te - this._planNow(), HOP_MS.trip);
        p.classList.add('sb-push', 'trip');
        p.style.transition = `transform ${ms}ms linear`;
        this._setX(xAt(b[0], b[1]));
        p.classList.toggle('walking', true);
        await this._wait(ms);
        p.classList.remove('walking', 'trip', 'sb-push');
      }
      if (i === 0 && now() < te + 300) this._say(line(21, ['uff!', 'sie wächst!', 'noch ein Stück!']), 900);
    }
    await this._at(T0 + t4);
    if (run) {
      // 3a. zu groß geworden: Sie rollt von selbst weiter, er erschrickt, hüpft hinterher und hält sie fest
      const t5 = t4 + SNOWBALL_T.gasp;
      const t6 = t5 + SNOWBALL_T.chase;
      roll([fb, 3], [1, SNOWBALL_BIG], t4, SNOWBALL_T.away, `cubic-bezier(${SNOWBALL_EASE.join(', ')})`);
      if (now() < t5 - 200) {
        this._mimik('awe', 1500);
        this._say(line(22, ['oh!', 'huch!', 'oh, oh!']), 500);
      }
      await this._at(T0 + t5);
      if (now() < t6 - 600) {
        this._say(line(23, ['halt!', 'Halt!', 'bleib hier!']), 1000);
        const to = xAt(1, SNOWBALL_BIG);
        await this._hopTo((this._x + to) / 2, 0, false);
        await this._hopTo(to, 0, false);
        this._face(dir);
      }
      await this._at(T0 + t6);
      p.classList.add('spat');
      if (now() < t6 + 400) this._say(line(24, ['hab dich!', 'gefangen!', 'puh!']), 1000);
      await this._at(T0 + t6 + SNOWBALL_T.hold);
    } else {
      // 3b. festklopfen
      p.classList.add('spat');
      await this._at(T0 + t4 + SNOWBALL_T.pat);
    }
    p.classList.remove('spat');
    // 4. anlehnen und stolz sein
    if (this._planNow() < S.end - 800) {
      p.classList.add('sb-lean');
      this._happy(Math.min(2200, S.end - this._planNow()));
      this._say(line(25, ['so groß!', 'So groß!', 'so groß! ♥']), 1600);
      await this._at(S.end);
      p.classList.remove('sb-lean');
    }
    // sie bleibt noch stehen, dann sackt sie zusammen
    p.classList.add('look-f');
    await this._wait(SNOWBALL_T.stay + S.r(7) * SNOWBALL_T.stayMore);
    p.classList.remove('look-f');
    this._apropsAway(el);
    await this._wait(700);
  }

  // ---------- Hula-Hoop ----------

  // Der Reifen kreist um den Bauch, die Hüfte schwingt mit. Manchmal wird er zum Schluss schneller, manchmal
  // rutscht der Reifen herunter. Was passiert, steht mit dem Fenster fest.
  async _hula() {
    const S = this._slotFor('hula');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('hula');
    // Alle Geräte beginnen zur selben Planzeit (wer früh am Platz ist, hält den Reifen so lange bereit)
    const T0 = S.start + ACT_WALK;
    if (S.k >= 0) await this._at(T0);
    await this._wait(700);
    p.classList.add('hula-go');
    const drop = S.r(6) < 0.3;
    const fast = !drop && S.r(7) < 0.5;
    const mid = S.end - (S.end - T0) * 0.4;
    // „schneller!“ und die Ausrufe kommen zu festen Planzeiten aus den Zahlen des Fensters: auf allen Geräten im
    // selben Augenblick, nicht nach einem eigenen Würfelraster
    const cues = fast ? [[mid, true]] : [];
    for (let j = 0, t = T0 + 700; j < 12; j++) {
      t += 1600 + S.r(20 + j) * 1000;
      if (t > S.end - 400) break;
      if (S.r(40 + j) < 0.5 && !(fast && Math.abs(t - mid) < 1000)) cues.push([t, false]);
    }
    cues.sort((a, b) => a[0] - b[0]);
    for (const [t, x] of cues) {
      await this._at(t);
      if (x) p.classList.add('hula-x');
      this._say(x ? 'schneller!' : pick(['huii!', 'hihi', 'und rum!', 'hui!']), 900);
    }
    await this._at(S.end);
    p.classList.remove('hula-go', 'hula-x');
    if (drop) {
      p.classList.add('hula-dn', 'meh');
      this._say(pick(['hoppla!', 'uups', 'gerutscht!']), 1300);
      await this._wait(1600);
      p.classList.remove('meh');
    } else {
      this._happy(1200);
      this._say(pick(['Ta-da!', 'Hula! ♥', 'geschafft!']), 1300);
      await this._wait(1300);
    }
    await this._propOff('hula', 'hula-dn');
    await this._wait(100);
  }

  // ---------- Jo-Jo ----------

  // Hinunter, kurz frei drehen, wieder hoch. Würfe und Animation laufen auf derselben Uhr (wie beim Seil: t0 ist
  // der Beginn der Animation, der k-te Wurf ist bei t0 + k · YOYO_MS wieder oben). Manchmal bleibt es unten
  // hängen: Dann schaut er, und es wickelt sich langsam wieder auf.
  async _yoyo() {
    const S = this._slotFor('yoyo');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('yoyo');
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil)
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    await this._wait(600);
    const n = yoyoThrows(S.r);
    const dead = yoyoDead(S.r);
    let t0 = 0;
    let k = 0;
    const go = () => {
      p.classList.remove('yo-go');
      void p.offsetWidth;
      p.classList.add('yo-go');
      t0 = Date.now();
      k = 0;
    };
    const until = (ms) => this._wait(Math.max(0, t0 + ms - Date.now()));
    go();
    for (let i = 1; i <= n; i++) {
      if (i === dead && !calmMotion()) {
        // unten angekommen dreht es aus: hängt
        await until((k + 0.49) * YOYO_MS);
        p.classList.add('yo-dead');
        p.classList.remove('yo-go');
        this._say(pick(['hm?', 'oh.', 'hängt!']), 1100);
        await this._wait(1500);
        p.classList.remove('yo-dead'); // aufwickeln (1,1 s, Stil)
        await this._wait(YOYO_DEAD - 1500 - 0.49 * YOYO_MS);
        go();
        continue;
      }
      k++;
      await until(k * YOYO_MS);
      if (i % 3 === 0) this._say(pick(['hui!', 'zack!', 'hopp!']), 700);
    }
    // Die Schleife endet oben in der Pfote
    p.classList.remove('yo-go');
    this._happy(1100);
    this._say(pick(['Ta-da!', 'Jo-Jo! ♥', 'gekonnt!']), 1300);
    await this._wait(1300);
    await this._propOff('yoyo', 'yo-dead');
    await this._wait(100);
  }

  // ---------- Pusteblume ----------

  // Dreimal Luft holen und pusten: Die Schirmchen fliegen mit dem Wind davon, die Kugel wird kahl. Er pustet mit
  // dem Wind und schaut den letzten Schirmchen nach.
  async _puste() {
    const S = this._slotFor('puste');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(this._windDir || (S.r(3) < 0.5 ? -1 : 1));
    const p = this._el.pika;
    const LEFT = ['pu-2', 'pu-1', 'pu-0'];
    this._propOn('puste');
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil)
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    await this._wait(800);
    for (let i = 0; i < 3; i++) {
      p.classList.add('pu-in');
      await this._wait(650);
      p.classList.remove('pu-in');
      p.classList.add('blow');
      await this._wait(220);
      p.classList.add(LEFT[i]);
      this._seeds([127, 47], 3 + Math.floor(rnd(0, 3)));
      await this._wait(650);
      p.classList.remove('blow');
      if (i < 2) await this._wait(PUSTE_MS - 1520);
    }
    p.classList.add('look-up');
    this._mimik('awe', 1500);
    this._say(pick(['flieg!', 'oooh!', 'weg sind sie']), 1300);
    await this._wait(1700);
    p.classList.remove('look-up');
    await this._propOff('puste', ...LEFT);
    await this._wait(100);
  }

  // ---------- Purzelbaum ----------

  // Anlauf in der Hocke, einmal vornüber (dabei kommt er eine Pika-Breite weiter), kurz schwindlig; der nächste geht
  // zurück. Bewegung reduzieren: Er hüpft die Strecke, ohne sich zu überschlagen.
  async _purzel() {
    const S = this._slotFor('purzel');
    const { pW, xR, gy } = this._g;
    const D = pW * 0.95;
    const x = this._hobbySpot(S.r(2));
    let dir = S.r(3) < 0.5 ? -1 : 1;
    // Platz für die Rolle: sonst in die andere Richtung
    const room = (d) => (d > 0 ? xR - x : x - pW * 0.45) >= D;
    if (!room(dir) && room(-dir)) dir = -dir;
    await this._goSpot(S, x, 0.9);
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil)
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    const p = this._el.pika;
    const n = purzelRolls(S.r);
    for (let i = 0; i < n; i++) {
      this._face(dir);
      await this._wait(250);
      p.classList.add('crouch');
      await this._wait(350);
      p.classList.remove('crouch');
      const to = clamp(this._x + dir * D, pW * 0.45, xR);
      if (i === 0) this._say(pick(['huiii!', 'Purzelbaum!', 'und hopp!']), 900);
      if (calmMotion()) await this._hopTo(to, 0, false);
      else {
        p.style.transition = `transform ${PURZEL_ROLL}ms cubic-bezier(.4, .1, .5, 1)`;
        this._setX(to);
        p.classList.add('purzel');
        await this._wait(PURZEL_ROLL);
        p.classList.remove('purzel');
        this._cls('lnd', 600, true);
      }
      this._puff(this._x, gy, 2);
      // kurz schwindlig
      p.classList.add('crosseye');
      await this._wait(750);
      p.classList.remove('crosseye');
      await this._wait(Math.max(0, PURZEL_MS - 1350 - PURZEL_ROLL));
      dir = -dir;
    }
    this._happy(1200);
    this._say(pick(['Ta-da!', 'nochmal!', 'hui! ♥']), 1300);
    await this._wait(1300);
  }

  // ---------- Steintürmchen ----------

  // Vier Kiesel übereinander: bücken, Stein in der Pfote, drauf damit. Ab dem dritten wackelt der Turm. Meist hält
  // er (stolz), manchmal purzeln die Steine herunter. Der Ausgang steht mit dem Fenster fest.
  async _stones() {
    const S = this._slotFor('stones');
    const { pW, pH } = this._g;
    const TW = pH * 0.44;
    const TH = TW * 1.4;
    const U = this._besideSpot(S.r(2), S.r(3), TW);
    const dir = U.dir;
    await this._goSpot(S, U.x, 0.9);
    this._face(dir);
    const p = this._el.pika;
    const el = this._aprop('stonep', STONES_SVG, U.px, TW, TH, false, pH * 0.02);
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil); bis dahin steht noch kein Stein
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    await this._wait(400);
    for (let i = 1; i <= 4; i++) {
      p.classList.add('sniff'); // einen Kiesel aufheben
      await this._wait(550);
      p.classList.remove('sniff');
      this._propOn('pebble');
      await this._wait(650);
      p.classList.remove('pebble', 'kram'); // abgelegt
      el.classList.add(`n${i}`);
      if (i >= 3) {
        el.classList.remove('wob');
        void el.offsetWidth;
        el.classList.add('wob');
        p.classList.add('look-f');
        if (i === 3) this._say(pick(['vorsichtig …', 'wackelt!', 'uii']), 900);
      }
      await this._wait(STONE_MS - 1200);
      p.classList.remove('look-f');
    }
    await this._wait(500);
    if (S.r(6) < 0.3) {
      el.classList.add('fall');
      this._say(pick(['oh!', 'och …', 'plumps!']), 1200);
      this._mimik('sad', 1600);
      await this._wait(1900);
    } else {
      this._happy(1300);
      this._mimik('proud', 2200);
      this._say(pick(['Hält!', 'Ta-da!', 'Kunst!']), 1300);
      await this._wait(2400);
    }
    this._apropsAway(el);
    await this._wait(500);
  }

  // ---------- Jonglieren ----------

  // Drei Beeren im Bogen über den Kopf, der Blick geht mit. Meist fängt er alle (stolz), manchmal bekommt er eine
  // auf die Nase. Wie es ausgeht, steht mit dem Fenster fest.
  async _juggle() {
    const S = this._slotFor('juggle');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('juggle');
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil)
    if (S.k >= 0) await this._at(S.start + ACT_WALK);
    await this._wait(800);
    p.classList.add('jug-go', 'look-up');
    while (this._planNow() < S.end) {
      await this._waitMax(rnd(1800, 3000), S.end);
      if (this._planNow() < S.end - 800 && Math.random() < 0.5) this._say(pick(['hopp!', 'und hopp!', 'eins, zwei, drei …', 'hui!']), 900);
    }
    p.classList.remove('jug-go', 'look-up');
    if (S.r(6) < 0.3) {
      // eine landet auf der Nase
      p.classList.remove('juggle', 'kram');
      p.classList.add('crosseye');
      this._cls('lnd', 600, true);
      this._say(pick(['autsch!', 'plopp!', 'uff!']), 1100);
      await this._wait(1200);
      p.classList.remove('crosseye');
      this._blush(1500);
      await this._wait(600);
    } else {
      this._happy(1300);
      this._mimik('proud', 1800);
      this._say(pick(['Ta-da!', 'Gefangen!', 'Zirkus! ♥']), 1300);
      await this._wait(1400);
    }
    await this._propOff('juggle');
    await this._wait(100);
  }

  // ---------- Blumenkranz ----------

  // Er flicht eine Kette aus Gänseblümchen, setzt sie sich als Kranz auf den Kopf und zeigt sich von beiden Seiten.
  async _crown() {
    const S = this._slotFor('crown');
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    this._face(S.r(3) < 0.5 ? -1 : 1);
    const p = this._el.pika;
    this._propOn('plait');
    await this._waitMax(1500, S.end - 4500);
    if (this._planNow() < S.end - 5500) this._say(pick(['Gänseblümchen …', 'eins noch …', 'hmm, hmm ♪']), 1300);
    await this._at(S.end - 4500);
    await this._propOff('plait');
    this._propOn('crowned');
    await this._wait(500);
    p.classList.add('tilt');
    this._mimik('proud', 2600);
    this._hearts(2);
    this._say(pick(['Hübsch!', 'Ein Kranz!', 'Krönchen! ♥']), 1400);
    await this._wait(1500);
    p.classList.remove('tilt');
    this._face(-this._dir);
    await this._wait(300);
    p.classList.add('tilt-b');
    await this._wait(1300);
    p.classList.remove('tilt-b');
    await this._at(S.end);
    await this._wait(1200);
    await this._propOff('crowned');
    await this._wait(100);
  }

  // ---------- Papierflieger ----------

  // Zweimal werfen: Der Flieger steigt, gleitet im Bogen und landet auf der Wiese; er hoppelt hinterher und hebt
  // ihn auf. Der zweite Wurf geht zurück. Wohin er fliegt, steht mit dem Fenster und dem Standplatz fest
  // (gliderThrows): rechts bis vor den Stein, links nur bis zum Vorrat, immer in der Karte. Auf schmalen Karten
  // wirft er steil, der Flieger landet vor seinen Füßen. Beide Würfe kommen zur festen Planzeit.
  async _glider() {
    const S = this._slotFor('glider');
    const { pW, pH, gy } = this._g;
    const H = this._H;
    await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
    const p = this._el.pika;
    const throws = gliderThrows(this._x, [S.r(10), S.r(11)], { W: this._W, ...this._g });
    this._face(throws[0].dir);
    this._propOn('gliding');
    // Alle Geräte beginnen zur selben Planzeit (wie beim Seil)
    const T0 = S.start + ACT_WALK;
    if (S.k >= 0) await this._at(T0);
    await this._wait(700);
    for (const [i, T] of throws.entries()) {
      // Auch der zweite Wurf: Wer schneller beim Flieger war (kurzer Wurf, schmale Karte), wartet so lange
      if (i && S.k >= 0) await this._at(T0 + 700 + i * GLIDER_STEP);
      const { dir, gw } = T;
      this._face(dir);
      p.classList.add('crouch');
      await this._wait(380);
      p.classList.remove('crouch', 'gliding', 'kram');
      const o = this._svgPt(122, 34); // dort ist der Flieger in der Pfote
      const h0 = gy - o.y;
      const dx = T.land - o.x;
      const el = this._aprop('glid', GLIDER_SVG, gw / 2, gw, gw * (14 / 26), true);
      const pt = (f, h, a) => ({
        transform: `translate(${(o.x - gw / 2 + dx * f).toFixed(1)}px, ${(-h).toFixed(1)}px) rotate(${(dir * a).toFixed(0)}deg) scaleX(${dir})`,
      });
      // Bewegung reduzieren: gerade hinübergleiten, ohne Bogen. Steiler Wurf: hoch hinauf, kippen, herunter.
      const frames = calmMotion() ? [pt(0, h0, 4), pt(1, pH * 0.05, 4)] : T.steep ? [
        { ...pt(0, h0, -52), easing: 'ease-out' }, { ...pt(0.3, h0 + H * 0.26, -24), offset: 0.3 },
        { ...pt(0.6, h0 + H * 0.24, 22), offset: 0.52 }, { ...pt(0.9, h0 * 0.5, 46), offset: 0.82, easing: 'ease-out' }, pt(1, pH * 0.05, 3)] : [
        { ...pt(0, h0, -14), easing: 'ease-out' }, { ...pt(0.3, h0 + H * 0.2, -8), offset: 0.26 },
        { ...pt(0.56, h0 + H * 0.17, 7), offset: 0.5 }, { ...pt(0.87, h0 * 0.5, 17), offset: 0.82, easing: 'ease-out' }, pt(1, pH * 0.05, 3)];
      el.style.transform = frames[frames.length - 1].transform;
      el.animate?.(frames, { duration: GLIDER_FLY, easing: 'linear' });
      this._say(i === 0 ? pick(['wuiii!', 'flieg!', 'Start!']) : pick(['und zurück!', 'nochmal!', 'hui!']), 1000);
      p.classList.add('look-up');
      await this._wait(GLIDER_FLY * 0.55);
      p.classList.remove('look-up');
      p.classList.add('look-f');
      await this._wait(GLIDER_FLY * 0.45 + 300);
      p.classList.remove('look-f');
      // hinterher (weite Wege zügig, damit er zum nächsten Wurf zurück ist) und aufheben
      await this._walkTo(T.to, walkSpeed(Math.abs(T.to - this._x), pW, GLIDER_WALK, 1.2));
      this._face(dir);
      p.classList.add('sniff');
      await this._wait(450);
      this._apropsAway(el);
      p.classList.remove('sniff');
      this._propOn('gliding');
      await this._wait(600);
    }
    this._happy(1200);
    this._say(pick(['Guter Flug!', 'Ta-da!', 'Pilot Pika! ♥']), 1300);
    await this._wait(1300);
    await this._propOff('gliding');
    await this._wait(100);
  }
}
