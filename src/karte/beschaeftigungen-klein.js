// Kleine Beschäftigungen: Pfütze, Schiffchen, Schnee-Pika, Hula-Hoop, Jo-Jo, Pusteblume, Purzelbaum, Steintürmchen,
// Jonglieren, Blumenkranz, Papierflieger

import { rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { seasonKey } from '../logik/wetter.js';
import { HAY_MAX } from '../logik/tagesplan.js';
import { ACT_WALK, walkSpeed, JUMPS } from '../logik/beschaeftigungen.js';
import {
  PUDDLE_MS, puddleJumps, BOAT_T, BOAT_EASE, boatPuffs, boatPos, YOYO_MS, YOYO_DEAD, yoyoThrows, yoyoDead, PUSTE_MS,
  PURZEL_MS, PURZEL_ROLL, purzelRolls, STONE_MS, GLIDER_FLY, GLIDER_WALK, GLIDER_STEP, gliderThrows, groundSpot,
} from '../logik/beschaeftigungen-klein.js';
import { DROP_SVG, PUDDLE_SVG, BOAT_SVG, SNOWPIKA_SVG, STONES_SVG, GLIDER_SVG } from '../grafik/beschaeftigungen.js';
import { GIFT_ITEMS } from '../grafik/paeckchen.js';

export class BeschaeftigungenKlein {
  // ==================== Kleine Beschäftigungen ab 0.32 ====================
  // Hula-Hoop, Jo-Jo, Pusteblume, Purzelbaum, Steintürmchen, Jonglieren, Blumenkranz und Papierflieger bei trockenem
  // Wetter, Pfützenspringen und Papierschiffchen bei Regen, der Schnee-Pika bei liegendem Schnee. Auswahl: miniChain
  // (MINI_PROG, MINI_W, miniOk). Alle kommen aus dem Tagesplan (_miniAt) und stehen nicht im Helfer. Die drei für
  // Regen und Schnee laufen nach der Planzeit: Ein Gerät, das später dazukommt, steigt mitten hinein ein.

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
