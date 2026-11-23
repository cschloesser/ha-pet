// Album 2: die Picknickdecke (key 'picnic', t2 = 6), rot-weiß kariert, mit einem kleinen Weidenkorb. Sie liegt nicht
// in der Szene: Ist es sonnig oder heiter, trocken, mindestens 15 °C warm, Tag und kaum Wind, holt er ab und zu das
// Bündel (Korb mit aufgerollter Decke) aus dem Bau, trägt es am Henkel auf die Wiese, rollt die Decke aus und stellt
// den Korb darauf. Er setzt sich, knabbert, was im Korb ist (Löwenzahn oder Klee, wie draußen auf der Wiese), und schaut
// mit geschlossenen Augen in die Sonne. Ist gerade ein Freund da (Kirby, Rufus, Katzumi oder Pino), ruft er ihn, der
// setzt sich mit auf die Decke und knabbert mit. Danach rollt er sie wieder auf und bringt alles in den Bau zurück.
// Stufe 2 (Trick): Teilen. Er holt ein Leckerli der Jahreszeit aus dem Korb (Erdbeere, Himbeeren, sonst Apfelschnitz)
// und gibt es dem Freund, „und eins für mich“. Ist kein Freund da, aber sitzt ein Vogel oder schaut die Maus heraus,
// wirft er ihm ein Stück hinüber (aus der Ferne: Die Maus flitzt weg, wenn er zu nah kommt; ein Vogel zwitschert); sonst
// legt er eins für später neben den Korb und packt es zum Schluss wieder ein. Das ist nur ein Bild: Nichts davon steht
// im Plan oder im Zustand, satt macht es nicht. Stufe 3 (Gold): Schmetterlinge (BFLY_SVG wie im Moment auf der Nase)
// flattern heran und setzen sich auf die Ecken der Decke und den Henkel (mit Abstand und Würfel wie GOLD, nur auf
// diesem Gerät; nach dem Auspacken sicher). Tipp auf Decke oder Korb, solange sie liegt: Der Deckel hebt sich, Krümel
// hüpfen heraus.
// Nach dem Auspacken außerhalb der Jahreszeit (April bis September, Südhalbkugel versetzt), bei Kälte oder ohne
// Picknickwetter zeigt er nur das Bündel und vertröstet auf den Sommer (bzw. auf Sonne).
// Reduzierte Bewegung: kein Weg in den Bau, kein Ausrollen; Decke und Korb blenden neben ihm ein und aus, Schmetterlinge
// und das geworfene Stück blenden am Platz ein, die Flügel ruhen.

import { Cancel, rnd, pick, clamp } from '../logik/hilfen.js';
import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { buehneZ, REIHE } from '../logik/buehne.js';
import { FRIENDS, FRIEND_LAST } from '../logik/besucher.js';
import { FOOD } from '../grafik/szene.js';
import { GIFT_ITEMS } from '../grafik/paeckchen.js';
import { BFLY_COLORS, BFLY_SVG } from '../grafik/momente.js';
import {
  A2_PICNIC, BLANKET_SVG, BLANKET_H, BLANKET_SINK, BASKET_SVG, BASKET_W, BUNDLE_SVG, BUNDLE_CARRY, BUNDLE_W, ROLL_SVG, CRUMB_SVG,
} from '../grafik/album2/picnic.js';

// Schmetterlinge höchstens alle 2 Minuten, dann bei 3 von 5 Picknicks
const PICNIC_GOLD = { cd: 2 * 6e4, p: 0.6 };
// Picknickwetter: diese Wetterlagen, ab dieser Temperatur (°C), unter diesem Wind (km/h)
const PICNIC_COND = ['sunny', 'partlycloudy', 'clear'];
const PICNIC_MIN_T = 15;
const PICNIC_WIND = 30;
// Ein Picknick dauert: Der Freund kommt nur mit, wenn sein Besuch noch so lange geht (ms)
const PICNIC_FR_LAST = FRIEND_LAST + 20000;
// Ebenen: die Decke mit dem Korb hinter Pika, Freund und Besuchern (Rang schatz), das Leckerli für später darauf
const PK_Z = () => buehneZ(REIHE.vorn, 'schatz');
const PK_TZ = () => buehneZ(REIHE.vorn, 'requisit');
// Pika-Klassen dieses Schatzes (_cleanup kennt sie nicht, das Aufräumen nimmt sie ab)
const PICNIC_CLS = ['a2pk-sit'];
// Farbe am Henkel (für _mouth)
const PK_FARBE = '#c98e4e';
// Breite der Decke (in pW): allein, zu zweit
const PK_W1 = 1.9;
const PK_W2 = 2.3;
// Plätze auf der Decke, Abstand von ihrer Mitte in Richtung d (in Breiten der Decke): er (p), der Korb (k), der Freund
// (f). Allein sitzt er fast in der Mitte (links und rechts von ihm sieht man die Karos), der Korb vor ihm; zu zweit steht
// der Korb hinten zwischen beiden.
const PK_OFF1 = { p: -0.1, k: 0.3 };
const PK_OFF2 = { p: -0.26, k: 0.02, f: 0.28 };
// Die Vorderkante liegt so weit unter der Bodenlinie (Anteil der Höhe der Decke; darunter verdeckt das Gras ohnehin),
// der Korb steht so weit hinter seinen Füßen
const PK_FRONT = 0.08;
const PK_KBACK = 0.2;
// Das Innere des Elements aus _a2El
const PK_HTML = `<div class="a2pkd">${BLANKET_SVG}</div><div class="a2pkk"><div>${BASKET_SVG}</div></div>`
  + `<div class="a2pkr">${ROLL_SVG}</div><div class="a2pkbu">${BUNDLE_SVG}</div>`;

export class Album2Picnic {
  // ---------- Szene ----------

  // Szene (Hook): Sie liegt nie dauerhaft. Nur, solange er sie benutzt, bleibt das Element. Hat sich die Größe der
  // Karte geändert, liegen Decke und Korb an alten Pixeln: abbrechen (wie _layout bei Requisiten)
  _a2PicnicScene(lv) {
    const S = this._a2PicnicS;
    if (!S) return;
    if (this._a2PicnicBusy && ((S.W !== this._W || S.H !== this._H) || this._a2WxTurned(S))) this._interrupt(); // (neue Größe; Regen setzt ein)
    else if (!(lv > 0) || !this._a2PicnicBusy) this._a2PicnicEnd();
  }

  // Maße zur Decke P (px): Höhe bh, Versenkung der Unterkante sink, Breite des Korbs kw, Fuß des Korbs (y), Rand des
  // Korbs (y), Scheitel des Henkels (y)
  _a2PicnicGeo(P) {
    const { pW, gy } = this._g;
    const bh = P.bw * BLANKET_H;
    const kw = pW * BASKET_W;
    const kfoot = gy - bh * PK_KBACK;
    return { bh, sink: bh * (BLANKET_SINK + PK_FRONT), kw, kfoot, krim: kfoot - kw * (10.8 / 24), ktop: kfoot - kw * (19.4 / 24) };
  }

  // Wo die Decke liegt: { d: sein Blick (zum Korb bzw. Freund), bx: Mitte, bw: Breite, px: sein Platz, kx: Mitte des
  // Korbs, fx: Platz des Freunds }. Die Decke ganz auf der Wiese (rechts vom Heu, das davor liegt, im Bild), am liebsten
  // vor dem Aussichtsstein zu Ende (sonst läge sie über seinem Fuß), er bis xR, der Freund in seinem Bereich
  // (_frRange). Zu zweit nahe beim Freund, sonst irgendwo (near: neben ihm). Seit 0.48.1 nicht über dem, was schon am
  // Boden steht (_a2Free): Lieber reicht sie bis vor den Stein als über das Windrad; geht beides nicht, wie bisher.
  // → null, wenn es nicht passt
  _a2PicnicPlan(fr = null, near = false) {
    const { pW, hayR, xR, rock } = this._g;
    const bw = pW * (fr ? PK_W2 : PK_W1);
    const O = fr ? PK_OFF2 : PK_OFF1;
    const lo0 = hayR + bw / 2 - pW * 0.08;
    const hi0 = this._W - bw / 2 - 3;
    const pref = fr ? (fr.x >= this._x ? 1 : -1) : this._x < this._W * 0.55 ? 1 : -1;
    const ends = rock ? [rock.l + rock.w * 0.12 - bw / 2, Infinity] : [Infinity];
    let first = null;
    let soft = null;
    for (const [end, d] of ends.flatMap((e) => [[e, pref], [e, -pref]])) {
      let lo = Math.max(lo0, pW * 0.45 - d * O.p * bw);
      let hi = Math.min(hi0, end, xR - d * O.p * bw);
      if (fr) {
        const [fl, fh] = this._frRange();
        lo = Math.max(lo, fl - d * O.f * bw);
        hi = Math.min(hi, fh - d * O.f * bw);
      }
      if (lo > hi + 0.01) continue;
      hi = Math.max(lo, hi);
      const want = fr ? fr.x - d * O.f * bw : near ? this._x - d * O.p * bw : lo + (hi - lo) * rnd(0.2, 0.8);
      const bx = this._a2Free(lo, hi, bw, clamp(want, lo, hi), 'picnic');
      const P = { d, bx, bw, px: bx + d * O.p * bw, kx: bx + d * O.k * bw, fx: fr ? bx + d * O.f * bw : null };
      if (!this._a2Hit(bx, bw, 'picnic')) return P;
      if (!this._a2Hit(bx, bw, 'picnic', [], true)) soft ??= P; // (nur vor dem Vogelhäuschen hinten)
      first ??= P;
    }
    return soft ?? first;
  }

  // Passt nicht einmal die Decke für einen (sehr schmale Wiese): so weit rechts vom Heu wie nötig
  _a2PicnicFallback() {
    const { pW, hayR } = this._g;
    const bw = pW * PK_W1;
    const lo = hayR + bw / 2 - pW * 0.08;
    const bx = clamp(this._x, lo, Math.max(lo, this._W - bw / 2 - 3));
    return { d: 1, bx, bw, px: bx + PK_OFF1.p * bw, kx: bx + PK_OFF1.k * bw, fx: null };
  }

  // Decke mit Korb hinlegen (Element aus _a2El: Tippfläche, Licht, golden). mode: 'roll' (er rollt sie aus), 'pop'
  // (ploppt neben ihm auf), 'fade' (blendet ein, reduzierte Bewegung); 'bundle' / 'bundle-fade': nur das Bündel bei
  // P.x (vorzeigen)
  _a2PicnicMake(P, mode = 'roll') {
    if (this._a2PicnicS) this._a2PicnicEnd(true, true);
    const { pW } = this._g;
    const el = this._a2El('picnic', PK_HTML);
    el.classList.remove('a2out', 'open', 'a2tap', 'a2roll', 'rolled', 'pop');
    el.classList.toggle('a2left', P.d < 0);
    el.style.zIndex = String(PK_Z());
    const S = { W: this._W, H: this._H, wx0: this._a2WxBad(), el, P, lid: false, t: [], fx: new Set(), bf: new Set(), off: new Set(), treat: null };
    this._a2PicnicS = S;
    const fade = () => el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'backwards' });
    if (mode.startsWith('bundle')) {
      const w = pW * BUNDLE_W;
      el.classList.add('rolled');
      el.style.left = `${(P.x - w / 2).toFixed(1)}px`;
      el.style.width = `${w.toFixed(1)}px`;
      el.style.height = `${w.toFixed(1)}px`;
      el.style.setProperty('--a2pks', `${((w * 1.2) / 24).toFixed(1)}px`);
      this._a2Scene(); // (golden: .gilt)
      if (mode === 'bundle' && !calmMotion()) {
        el.classList.add('pop');
        S.t.push(setTimeout(() => el.classList.remove('pop'), 700));
      } else fade();
      return S;
    }
    const G = this._a2PicnicGeo(P);
    const kb = G.sink + (this._g.gy - G.kfoot) - G.kw * (1.2 / 24);
    el.style.left = `${(P.bx - P.bw / 2).toFixed(1)}px`;
    el.style.width = `${P.bw.toFixed(1)}px`;
    el.style.height = `${Math.max(G.bh, kb + G.kw).toFixed(1)}px`;
    el.style.setProperty('--a2pks', `${G.sink.toFixed(1)}px`);
    const k = el.querySelector('.a2pkk');
    Object.assign(k.style, { left: `${(P.kx - G.kw / 2 - (P.bx - P.bw / 2)).toFixed(1)}px`, bottom: `${kb.toFixed(1)}px`, width: `${G.kw.toFixed(1)}px` });
    this._a2Scene(); // (golden: .gilt)
    if (mode === 'roll' && !calmMotion()) {
      // Ausrollen: von seiner Seite her, die Rolle läuft an der Vorderkante entlang; der Korb ploppt auf
      this._a2PicnicRoll(S, false);
      k.classList.add('pop');
      S.t.push(setTimeout(() => k.classList.remove('pop'), 700));
    } else if (mode === 'pop' && !calmMotion()) {
      el.classList.add('new');
      S.t.push(setTimeout(() => el.classList.remove('new'), 800));
    } else fade();
    return S;
  }

  // Aus- (up = false) oder Aufrollen: Die Decke wird von seiner Seite her sichtbar bzw. verschwindet zu ihr hin, die
  // Rolle läuft mit der Kante
  _a2PicnicRoll(S, up) {
    const { el, P } = S;
    const ms = up ? 800 : 900;
    const G = this._a2PicnicGeo(P);
    const shut = P.d > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
    const open = 'inset(0 0% 0 0%)';
    el.querySelector('.a2pkd')?.animate?.([{ clipPath: up ? open : shut }, { clipPath: up ? shut : open }], { duration: ms, easing: 'ease-out', fill: up ? 'forwards' : 'backwards' });
    const r = el.querySelector('.a2pkr');
    if (!r) return;
    const rw = G.bh * 0.9;
    Object.assign(r.style, { width: `${rw.toFixed(1)}px`, marginLeft: `${(-rw / 2).toFixed(1)}px`, bottom: `${(G.sink * 0.55).toFixed(1)}px` });
    el.classList.add('a2roll');
    const near = P.d > 0 ? '0%' : '100%';
    const far = P.d > 0 ? '100%' : '0%';
    const a = { left: near, transform: 'none', opacity: 1 };
    const b = { left: far, transform: `rotate(${P.d * 300}deg) scale(.45)`, opacity: 0.3 };
    r.animate?.(up ? [b, a] : [a, b], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    S.t.push(setTimeout(() => el.classList.remove('a2roll'), ms + 30));
  }

  // Deckel auf oder zu (die Aktion hält ihn; ein Tipp öffnet ihn nur kurz)
  _a2PicnicLid(S, open) {
    if (!S) return;
    S.lid = open;
    S.el.classList.toggle('open', open);
  }

  // Bündel am Henkel im Maul (an) oder abgesetzt
  _a2PicnicCarry(on) {
    this._a2PicnicHolding = on;
    this._el.pika.classList.toggle('carry', on);
    this._mouth(on ? PK_FARBE : null, on ? BUNDLE_CARRY : null);
  }

  // Ein Leckerli (T aus GIFT_ITEMS) im Maul oder (null) nicht mehr
  _a2PicnicHold(T) {
    this._a2PicnicHolding = !!T;
    this._el.pika.classList.toggle('carry', !!T);
    this._mouth(T ? T.color : null, T ? T.svg : null);
  }

  // ---------- Wann ----------

  // Monat dieses Geräts in der Jahreszeit des Schatzes (A2_PICNIC.mo; Südhalbkugel ein halbes Jahr versetzt)?
  _a2PicnicSeason() {
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const mo = (new Date(this._dbgDate ?? Date.now()).getMonth() + (south ? 6 : 0)) % 12;
    return A2_PICNIC.mo.includes(mo);
  }

  // Picknickwetter: bei Tag (nicht in der Dämmerung), trocken (kein Regen, Schnee, Nebel, nichts liegt), Wind unter
  // PICNIC_WIND, sonnig oder heiter und mindestens PICNIC_MIN_T. Ohne Wetterlage oder Temperatur (keine Entität, kein
  // Attribut) entscheidet die Jahreszeit.
  _a2PicnicWeather(wx = this._wx || {}) {
    const sc = this._el.scene.classList;
    if (sc.contains('night') || sc.contains('dusk')) return false;
    if (wx.wet || wx.storm || wx.shelter || wx.hail || wx.fog || wx.snow > 0 || wx.snowcover) return false;
    if ((this._wind || 0) >= PICNIC_WIND) return false;
    const raw = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
    if (raw.cond != null ? !PICNIC_COND.includes(raw.cond) : !this._a2PicnicSeason()) return false;
    return raw.temp != null ? raw.temp >= PICNIC_MIN_T : this._a2PicnicSeason();
  }

  // Nach dem Auspacken: Warum jetzt kein Picknick? 'season' (nicht die Jahreszeit), 'cold' (unter PICNIC_MIN_T), 'later'
  // (Regen, Schnee, Sturm, Nacht), sonst null. Wolken und Wind stören hier nicht, das Picknick ist dann kurz.
  _a2PicnicNotNow() {
    const raw = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
    const wx = this._wx || {};
    if (!this._a2PicnicSeason()) return 'season';
    if (raw.temp != null && raw.temp < PICNIC_MIN_T) return 'cold';
    if (wx.wet || wx.storm || wx.hail || wx.snow > 0 || wx.snowcover || this._el.scene.classList.contains('night')) return 'later';
    return null;
  }

  // Der Freund, der mitkommt: da, begrüßt, nicht im Gehen, nicht mit etwas anderem beschäftigt, und sein Besuch geht
  // noch lange genug
  _a2PicnicFriend() {
    const fr = this._fr;
    return fr && fr.arrived && !fr.leaving && fr.greeted && !fr.busy && Date.now() < (fr.until ?? Infinity) - PICNIC_FR_LAST ? fr : null;
  }

  // Ein Besucher, dem er etwas abgeben kann: der Vogel, der sitzt, sonst die Maus, die herausschaut (beide nur lesen:
  // Sie gehören dem Besuch nach der Uhr)
  _a2PicnicGuest() {
    const b = this._bird;
    if (b?.sitting && !b.scared) return { k: 'bird', x: b.x, y: b.y, b };
    const m = this._mouse;
    if (m?.visible && !m.scared) return { k: 'mouse', x: m.x, y: m.y, m };
    return null;
  }

  // Leckerli der Jahreszeit aus dem Korb: Erdbeere (April bis Juni), Himbeeren (Juli bis September), sonst Apfelschnitz
  _a2PicnicTreat() {
    const south = (this._hass?.config?.latitude ?? 50) < 0;
    const mo = (new Date(this._dbgDate ?? Date.now()).getMonth() + (south ? 6 : 0)) % 12;
    const key = mo >= 3 && mo <= 5 ? 'straw' : mo >= 6 && mo <= 8 ? 'rasp' : 'apple';
    return GIFT_ITEMS.find((x) => x.key === key) || GIFT_ITEMS.find((x) => x.color);
  }

  // ---------- Was er damit tut ----------

  // Hook: Picknick bei Picknickwetter ab und zu, mit dem Freund gern (dessen eigene Spiele wiegen 3,5–7). Teilen ab
  // Stufe 2: mit dem Freund oft, mit einem Besucher manchmal, allein selten
  // Liegt ein Häufchen, nicht: Die Decke läge darunter (die Häufchen liegen über allem am Boden), und erst wird
  // ohnehin sauber gemacht (Vorschau und Auspacken dürfen trotzdem)
  _a2PicnicActs({ wx, piles }, lv) {
    if (!this._a2PicnicWeather(wx) || piles?.length) return [];
    const P = this._a2PicnicPlan(null); // (kein freier Platz für die Decke: lieber nicht)
    if (!P || !this._a2Room(P.bx, P.bw, 'picnic')) return [];
    const fr = !!this._a2PicnicFriend();
    return [[fr ? 0.8 : 0.3, 'a2PicnicPlay'], [lv >= 2 ? (fr ? 1 : this._a2PicnicGuest() ? 0.5 : 0.15) : 0, 'a2PicnicShare']];
  }

  // Stufe 1 (Aktion 'a2PicnicPlay'). o: { short: nach dem Auspacken (alles kommt gleich neben ihn), gold: Schmetterlinge
  // sicher, solo: ohne den Freund }
  async _a2PicnicPlay(o = {}) {
    return this._a2PicnicGo('play', o);
  }

  // Stufe 2, der Trick (Aktion 'a2PicnicShare')
  async _a2PicnicShare(o = {}) {
    if (this._a2Lv('picnic') < 2) return;
    return this._a2PicnicGo('share', o);
  }

  async _a2PicnicGo(mode, o) {
    const lv = this._a2Lv('picnic');
    if (!lv || (!this._a2PicnicWeather() && !this._forced && !o.short)) return;
    const gold = !!o.gold || (lv >= 3 && this._a2GoldOk('picnic', PICNIC_GOLD));
    const quick = !!o.short || calmMotion();
    this._a2PicnicBusy = true;
    try {
      if (!quick) await this._a2PicnicFetch();
      // (erst jetzt: Wer jetzt da ist, kommt mit, und hat sich die Karte verändert, gilt der neue Platz)
      let fr = o.solo ? null : this._a2PicnicFriend();
      let P = fr ? this._a2PicnicPlan(fr, !!o.short) : null;
      if (!P) {
        fr = null;
        P = this._a2PicnicPlan(null, quick) || this._a2PicnicFallback();
      }
      await this._a2PicnicSpread(P, quick);
      let ran = false;
      if (fr && this._a2PicnicFriend() === fr) {
        try {
          await this._withFriend(async (f, w) => {
            ran = true;
            await this._a2PicnicWith(P, f, w, mode, gold, o);
          });
        } catch (e) {
          // Der Freund musste gehen: Er winkt ihm nach und räumt allein auf. Ein echter Abbruch geht weiter.
          if (!(e instanceof Cancel) || this._ac?.signal?.aborted) throw e;
          this._a2PicnicHold(null);
          this._el.pika.classList.remove('a2pk-sit', 'look-up', 'squint');
          this._say(pick(['tschüss!', 'schade…', 'bis bald!']), 1300);
          await this._wait(1100);
        }
      }
      if (!ran) await this._a2PicnicWith(P, null, (ms) => this._wait(ms), mode, gold, o);
      await this._a2PicnicPack(this._a2PicnicS, quick);
    } finally {
      this._a2PicnicBusy = false;
      this._a2PicnicEnd(true);
    }
  }

  // Aus dem Bau holen: Er kramt drinnen und kommt mit dem Bündel im Maul heraus
  async _a2PicnicFetch() {
    await this._enterBurrow(1);
    const { home, hole } = this._g;
    this._peep(home, hole.top, pick(['kram, kram…', 'wo ist der Korb…', 'raschel…']));
    await this._wait(rnd(800, 1200));
    this._a2PicnicCarry(true);
    await this._comeOut();
  }

  // Ausbreiten: hin, Bündel absetzen, Decke ausrollen, Korb drauf. quick (nach dem Auspacken, Bewegung reduzieren):
  // Decke und Korb kommen neben ihm, er geht hinauf
  async _a2PicnicSpread(P, quick) {
    const p = this._el.pika;
    if (quick) {
      this._a2PicnicMake(P, calmMotion() ? 'fade' : 'pop');
      await this._wait(600);
      await this._walkTo(P.px, 0.8);
      this._face(P.d);
      return;
    }
    await this._walkTo(P.px, 0.9);
    this._face(P.d);
    p.classList.add('crouch');
    await this._wait(320);
    this._a2PicnicCarry(false);
    this._a2PicnicMake(P, 'roll');
    p.classList.remove('crouch');
    this._say(pick(['ausbreiten!', 'Picknick!', 'so…']), 1100);
    await this._wait(1000);
  }

  // Auf der Decke (P): der Freund kommt dazu, hinsetzen, knabbern, in die Sonne schauen (golden: Schmetterlinge),
  // teilen (Stufe 2). w: warten (mit dem Freund bricht es ab, wenn er gehen muss)
  async _a2PicnicWith(P, fr, w, mode, gold, o) {
    const p = this._el.pika;
    const S = this._a2PicnicS;
    if (!S) return;
    const who = fr ? FRIENDS[fr.kind]?.name || this._frName() : null;
    if (fr) {
      this._face(fr.x >= this._x ? 1 : -1);
      this._say(pick([`${who}, Picknick!`, `komm, ${who}!`]), 1400);
      this._frCall(fr, pick(['mip!', 'oh!']));
      await w(700);
      await this._friendWalkTo(fr, P.fx, 1, w);
      this._frFace(fr, -P.d);
      this._frHappy(fr, 1000);
    }
    this._face(P.d);
    p.classList.add('a2pk-sit');
    await w(o.short ? 400 : 800);
    await this._a2PicnicNibble(S, fr, w, o);
    // in die Sonne
    p.classList.remove('content');
    p.classList.add('look-up');
    if (fr) this._frLook(fr, 'look-up', gold ? 6000 : 3500);
    await w(500);
    p.classList.add('squint', 'content');
    this._say(pick(['hach, Sonne…', 'schön warm…', 'Sonne!']), 1500);
    await w(o.short ? 1500 : rnd(2600, 4200));
    p.classList.remove('squint');
    if (gold) await this._a2PicnicGold(S, fr, w);
    p.classList.remove('look-up', 'content');
    if (mode === 'share') await this._a2PicnicGive(S, fr, w);
    if (fr && this._fr === fr) {
      this._frSay(fr, pick(['danke!', '♥', 'mip!']), 1300);
      await w(900);
      // von der Decke herunter, bevor er sie aufrollt
      await this._friendWalkTo(fr, P.fx + P.d * this._g.pW * 0.6, 0.8, w);
      this._frFace(fr, -P.d);
    }
  }

  // Knabbern: in den Korb, Löwenzahn oder Klee (der Freund das andere)
  async _a2PicnicNibble(S, fr, w, o) {
    const p = this._el.pika;
    const F = pick([FOOD.lz, FOOD.klee]);
    const ms = o.short ? 1500 : rnd(2200, 3000);
    this._a2PicnicLid(S, true);
    p.classList.add('crouch');
    await w(320);
    p.classList.remove('crouch');
    this._a2PicnicLid(S, false);
    this._say(F === FOOD.lz ? pick(['Löwenzahn!', 'mmh, Löwenzahn']) : pick(['Klee!', 'mmh, Klee']), 1200);
    if (fr) this._frEat(fr, (F === FOOD.lz ? FOOD.klee : FOOD.lz).color, ms);
    await this._eat(F.color, ms);
    if (fr) this._frEatEnd(fr);
    p.classList.add('content');
    await w(600);
  }

  // Stufe 2, Teilen: ein Leckerli aus dem Korb für den Freund (und eins für ihn), sonst für den Besucher (hinüber
  // geworfen), sonst für später (neben den Korb)
  async _a2PicnicGive(S, fr, w) {
    const p = this._el.pika;
    const { pW } = this._g;
    const P = S.P;
    const T = this._a2PicnicTreat();
    this._a2PicnicLid(S, true);
    p.classList.add('crouch');
    await w(320);
    p.classList.remove('crouch');
    this._a2PicnicLid(S, false);
    this._a2PicnicHold(T);
    this._say(`${T.name}!`, 1100);
    await w(1000);
    const G = fr ? null : this._a2PicnicGuest();
    if (fr && this._fr === fr) {
      const who = FRIENDS[fr.kind]?.name || this._frName();
      p.classList.remove('a2pk-sit');
      this._say(pick([`für dich, ${who}!`, 'halbe-halbe!']), 1400);
      await this._walkTo(this._x + P.d * pW * 0.16, 0.5);
      this._face(P.d);
      this._a2PicnicHold(null);
      this._a2PicnicFrEat(fr, T, 1900);
      this._frSay(fr, pick(['♥', 'mip!', 'danke!']), 1300);
      await w(500);
      await this._walkTo(P.px, 0.5, true, 0, true);
      this._face(P.d);
      p.classList.add('a2pk-sit');
      this._say(pick(['und eins für mich!', 'eins für mich!']), 1200);
      await this._eat(T.color, 1700, T.svg);
      this._frEatEnd(fr);
      this._frCarry(fr, null);
      this._hearts(2);
      this._frHearts(fr, 2);
      p.classList.add('content');
      await w(1400);
      p.classList.remove('content');
    } else if (G) {
      this._face(((G.b || G.m)?.x ?? G.x) >= this._x ? 1 : -1);
      this._say(G.k === 'bird' ? pick(['für dich, Vögelchen!', 'magst du?']) : pick(['psst… für dich!', 'magst du?']), 1400);
      await w(900);
      this._a2PicnicHold(null);
      this._a2PicnicToss(S, T, G);
      await w(900);
      if (G.k === 'bird') this._tweet(G.b);
      this._happy(1000);
      await w(1500);
      this._face(P.d);
      this._say(pick(['und eins für mich!', 'eins für mich!']), 1200);
      await this._eat(T.color, 1600, T.svg);
      await w(600);
    } else {
      this._say(pick(['eins für später!', 'das heb ich auf!']), 1400);
      await w(800);
      p.classList.add('crouch');
      await w(300);
      p.classList.remove('crouch');
      this._a2PicnicHold(null);
      this._a2PicnicKeep(S, T);
      this._happy(900);
      await w(1600);
    }
  }

  // Der Freund isst das Leckerli T: im Maul, es wird kleiner (endet mit _frEatEnd und _frCarry(fr, null))
  _a2PicnicFrEat(fr, T, ms) {
    this._frCarry(fr, T.svg);
    fr.el.style.setProperty('--eat', `${Math.round(ms)}ms`);
    const m = fr.mfood;
    if (m) {
      m.classList.remove('shrink');
      void m.getBoundingClientRect();
      m.classList.add('shrink');
    }
    fr.el.classList.add('eating');
  }

  // Ein Stück hinüber zum Besucher G: im Bogen aus seinem Maul ins Gras vor ihm (ruhig: blendet dort ein). Es bleibt ein
  // paar Sekunden liegen und ist dann weg (aufgegessen, das zeigt die Karte nicht)
  _a2PicnicToss(S, T, G) {
    const { pW, gy } = this._g;
    const n = this._nosePos();
    const w = pW * 0.13;
    // wo er jetzt ist (die Maus läuft herum); ist er schon fort, dorthin, wo er war. Nie vor die eigenen Pfoten.
    const gx = (G.b || G.m)?.x ?? G.x;
    const dir = gx >= this._x ? 1 : -1;
    const tx = clamp(dir * Math.max(dir * (gx - dir * pW * (G.k === 'bird' ? 0.12 : 0.32)), dir * this._x + pW * 0.55), pW * 0.2, this._W - pW * 0.2);
    const ty = gy - this._H * 0.03;
    const e = document.createElement('div');
    e.className = 'a2pkf';
    e.innerHTML = T.svg;
    Object.assign(e.style, { left: `${(tx - w / 2).toFixed(1)}px`, top: `${(ty - w * 0.85).toFixed(1)}px`, width: `${w.toFixed(1)}px` });
    this._el.fx.appendChild(e);
    S.fx.add(e);
    const dx = n.x - tx;
    const dy = n.y - (ty - w * 0.4);
    const h = this._H * 0.14;
    if (!calmMotion() && e.animate) {
      const kf = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        kf.push({ transform: `translate(${((1 - t) * dx).toFixed(1)}px, ${((1 - t) * dy - 4 * h * t * (1 - t)).toFixed(1)}px) rotate(${(t * dir * 200).toFixed(0)}deg)` });
      }
      e.animate(kf, { duration: 750, easing: 'linear', fill: 'backwards' });
      S.t.push(setTimeout(() => this._a2PicnicS === S && this._peep(tx, ty - w, 'plopp'), 760));
    } else e.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'backwards' });
    S.t.push(setTimeout(() => e.classList.add('away'), 3800));
  }

  // Eins für später: das Leckerli T neben dem Korb auf der Decke (zum Schluss packt er es wieder ein)
  _a2PicnicKeep(S, T) {
    const { pW, gy } = this._g;
    const G = this._a2PicnicGeo(S.P);
    const w = pW * 0.15;
    const x = S.P.kx + S.P.d * G.kw * 0.85;
    const y = gy - G.bh * 0.24;
    const e = document.createElement('div');
    e.className = `a2pkt${calmMotion() ? ' still' : ''}`;
    e.innerHTML = T.svg;
    Object.assign(e.style, { left: `${(x - w / 2).toFixed(1)}px`, top: `${(y - w * 0.9).toFixed(1)}px`, width: `${w.toFixed(1)}px`, zIndex: String(PK_TZ()) });
    this._el.gifts.appendChild(e);
    S.treat = e;
    e.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: calmMotion() ? 600 : 250, fill: 'backwards' });
    this._peep(x, y - w * 1.2, 'für später');
  }

  // Golden: Schmetterlinge flattern heran und setzen sich auf die Ecken der Decke und den Henkel, er staunt
  async _a2PicnicGold(S, fr, w) {
    const P = S.P;
    const { gy } = this._g;
    const G = this._a2PicnicGeo(P);
    const spots = [[P.bx - P.d * P.bw * 0.37, gy - G.bh * 0.12], [P.kx, G.ktop], [P.bx + P.d * P.bw * 0.43, gy - G.bh * 0.2]];
    const c0 = Math.floor(Math.random() * BFLY_COLORS.length);
    spots.forEach(([x, y], i) => S.t.push(setTimeout(() => this._a2PicnicS === S && this._a2PicnicBfly(S, x, y, BFLY_COLORS[(c0 + i * 2) % BFLY_COLORS.length], i), i * 650)));
    await w(calmMotion() ? 1200 : 2200);
    this._mimik('awe', 1600);
    this._say(pick(['Schmetterlinge!', 'oh, Besuch!', 'so bunt!']), 1600);
    if (fr && this._fr === fr) this._frSay(fr, pick(['oh!', '♥']), 1200);
    await w(1800);
    this._cls('sparkle', 2000);
    this._happy(1200);
    await w(2400);
  }

  // Ein Schmetterling (Farben c) fliegt zu (x, y) und sitzt dort mit langsamem Flügelschlag (ruhig: blendet dort ein).
  // Die Füße (Körper unten in der Mitte von BFLY_SVG, 20 × 16) auf dem Punkt
  _a2PicnicBfly(S, x, y, c, i) {
    const calm = calmMotion();
    const w = this._H * 0.1125; // (wie .a2pkb im Stil)
    const e = document.createElement('div');
    e.className = `a2pkb${calm ? ' still rest' : ''}`;
    e.innerHTML = BFLY_SVG(c);
    Object.assign(e.style, { left: `${(x - w / 2).toFixed(1)}px`, top: `${(y - w * 0.63).toFixed(1)}px` });
    this._el.fx.appendChild(e);
    S.fx.add(e);
    S.bf.add(e);
    if (calm || !e.animate) {
      e.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'backwards' });
      return e;
    }
    const side = i % 2 ? 1 : -1;
    const sx = side * this._W * rnd(0.3, 0.45);
    const sy = -this._H * rnd(0.35, 0.5);
    const kf = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const q = 1 - (1 - t) * (1 - t);
      kf.push({ transform: `translate(${(sx * (1 - q)).toFixed(1)}px, ${(sy * (1 - q) + Math.sin(t * Math.PI * 3) * this._H * 0.05 * (1 - t)).toFixed(1)}px)` });
    }
    const dur = 2200 + i * 300;
    e.animate(kf, { duration: dur, easing: 'linear', fill: 'backwards' });
    S.t.push(setTimeout(() => e.classList.add('rest'), dur));
    return e;
  }

  // Alle Schmetterlinge fliegen davon (ruhig: blenden aus)
  _a2PicnicBflyOff(S) {
    for (const e of S.bf) {
      S.bf.delete(e);
      S.off.add(e);
      e.classList.remove('rest');
      if (calmMotion() || !e.animate) e.classList.add('off');
      else {
        const side = Math.random() < 0.5 ? -1 : 1;
        e.animate([{ transform: 'none' }, { transform: `translate(${(side * this._W * 0.08).toFixed(1)}px, ${(-this._H * 0.12).toFixed(1)}px)`, offset: 0.3 },
          { transform: `translate(${(side * this._W * 0.5).toFixed(1)}px, ${(-this._H * 0.8).toFixed(1)}px)` }], { duration: 2400, easing: 'ease-in', fill: 'forwards' });
      }
      setTimeout(() => {
        e.remove();
        S.fx.delete(e);
      }, 2450);
    }
  }

  // Einpacken: Schmetterlinge fliegen, das Leckerli für später kommt in den Korb, Decke aufrollen, Bündel ins Maul,
  // zurück in den Bau. quick: Decke und Korb blenden aus
  async _a2PicnicPack(S, quick) {
    if (!S || this._a2PicnicS !== S) return;
    const p = this._el.pika;
    p.classList.remove('a2pk-sit', 'look-up', 'squint', 'content');
    this._a2PicnicBflyOff(S);
    if (S.treat) {
      this._a2PicnicLid(S, true);
      p.classList.add('crouch');
      await this._wait(250);
      S.treat.classList.add('away');
      p.classList.remove('crouch');
      await this._wait(550);
      this._a2PicnicLid(S, false);
    }
    this._say(pick(['schön war’s!', 'das war fein!', 'hach…']), 1300);
    await this._wait(1000);
    if (quick) {
      this._a2PicnicEnd(true);
      await this._wait(500);
      return;
    }
    p.classList.add('crouch');
    await this._wait(300);
    p.classList.remove('crouch');
    S.el.querySelector('.a2pkk')?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    this._a2PicnicRoll(S, true);
    await this._wait(850);
    this._a2PicnicEnd(true, true);
    this._a2PicnicCarry(true);
    await this._wait(250);
    await this._enterBurrow(0.9);
    this._a2PicnicCarry(false);
    await this._wait(rnd(500, 900));
    await this._comeOut();
  }

  // Nach dem Auspacken (Hook): Stufe 1 gleich ein kurzes Picknick, 2 Teilen, 3 mit Schmetterlingen. Außerhalb der
  // Jahreszeit, bei Kälte oder ohne Wetter dafür zeigt er nur das Bündel und vertröstet
  async _a2PicnicStow(lv) {
    const why = this._a2PicnicNotNow();
    if (why) return this._a2PicnicShow(lv, why);
    if (lv === 2) return this._a2PicnicShare({ short: true });
    this._say(lv >= 3 ? pick(['goldig!', 'die glänzt!']) : pick(['Picknick!', 'ein Picknick!']), 1300);
    await this._wait(900);
    return this._a2PicnicPlay({ short: true, gold: lv >= 3 });
  }

  // Vorzeigen: Das Bündel steht neben ihm, er schaut es an und vertröstet (why aus _a2PicnicNotNow), dann ist es weg
  async _a2PicnicShow(lv, why) {
    const p = this._el.pika;
    const { pW, hayR } = this._g;
    this._a2PicnicBusy = true;
    try {
      const d = this._x < this._W / 2 ? 1 : -1;
      const x = clamp(this._x + d * pW * 0.6, hayR + pW * 0.2, this._W - pW * 0.25);
      this._face(x >= this._x ? 1 : -1);
      this._a2PicnicMake({ d, x }, calmMotion() ? 'bundle-fade' : 'bundle');
      await this._wait(800);
      p.classList.add('tilt');
      this._say(why === 'cold' ? 'brr, noch zu kalt!' : why === 'later' ? 'wenn die Sonne scheint!' : pick(['die heb ich auf!', 'für später!']), 1600);
      await this._wait(1700);
      p.classList.remove('tilt');
      p.classList.add('look-f');
      this._say(why === 'later' ? 'dann Picknick!' : why === 'cold' ? 'wenn’s wärmer ist!' : lv === 2 ? 'im Sommer teil ich!' : lv >= 3 ? 'im Sommer kommen Schmetterlinge!' : 'im Sommer gibt’s Picknick!', 1800);
      this._happy(1000);
      await this._wait(1900);
      p.classList.remove('look-f');
    } finally {
      this._a2PicnicBusy = false;
      this._a2PicnicEnd(true);
    }
  }

  // ---------- Hooks: Tipp, Aufräumen, Abhängen ----------

  // Tipp auf Decke oder Korb (nur, solange sie liegt): Der Deckel hebt sich kurz, Krümel hüpfen heraus, der Korb hüpft.
  // Aufs Bündel: Es hüpft.
  _a2PicnicTap() {
    const S = this._a2PicnicS;
    if (!S) return false;
    const el = S.el;
    const calm = calmMotion();
    if (!calm) {
      el.classList.remove('a2tap', 'pop');
      void el.offsetWidth;
      el.classList.add(el.classList.contains('rolled') ? 'pop' : 'a2tap');
      clearTimeout(this._a2PicnicTapT);
      this._a2PicnicTapT = setTimeout(() => el.classList.remove('a2tap', 'pop'), 600);
    }
    if (el.classList.contains('rolled')) {
      this._peep(S.P.x, this._g.gy - this._g.pW * BUNDLE_W * 1.1, 'im Sommer!');
      return true;
    }
    const G = this._a2PicnicGeo(S.P);
    el.classList.add('open');
    clearTimeout(this._a2PicnicLidT);
    this._a2PicnicLidT = setTimeout(() => this._a2PicnicS === S && !S.lid && el.classList.remove('open'), 750);
    this._a2PicnicCrumbs(S, G);
    this._peep(S.P.kx, G.ktop - this._H * 0.02, pick(['krümel!', 'knusper!']));
    return true;
  }

  // Krümel aus dem Korb: in kleinen Bögen auf die Decke (ruhig: einer blendet am Rand ein und aus)
  _a2PicnicCrumbs(S, G) {
    const calm = calmMotion();
    const { gy } = this._g;
    const n = calm ? 1 : 4;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = `a2pkc${calm ? ' still' : ''}`;
      s.innerHTML = CRUMB_SVG;
      const x0 = S.P.kx + rnd(-0.25, 0.25) * G.kw;
      const y0 = G.krim;
      const x1 = x0 + (i % 2 ? 1 : -1) * G.kw * rnd(0.4, 0.9);
      const y1 = gy - G.bh * rnd(0.05, 0.2);
      s.style.left = `${x0.toFixed(1)}px`;
      s.style.top = `${y0.toFixed(1)}px`;
      this._el.fx.appendChild(s);
      S.fx.add(s);
      const ms = 600;
      if (!calm && s.animate) {
        s.animate([
          { transform: 'translate(0, 0)', opacity: 1 },
          { transform: `translate(${((x1 - x0) / 2).toFixed(1)}px, ${(-this._H * 0.07).toFixed(1)}px)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${(x1 - x0).toFixed(1)}px, ${(y1 - y0).toFixed(1)}px)`, opacity: 0 },
        ], { duration: ms, delay: i * 80, easing: 'ease-in', fill: 'both' });
      }
      setTimeout(() => {
        s.remove();
        S.fx.delete(s);
      }, ms + i * 80 + (calm ? 700 : 60));
    }
  }

  // Ende der Aktion oder Abbruch (auch aus _cleanup nach jeder Aktion): Decke, Korb, Leckerli, Schmetterlinge, Krümel,
  // Zeitgeber, Bündel im Maul weg (force: aus der eigenen Aktion. Sonst, mitten in ihr, aus Szene oder Aufräumen:
  // nichts, sie räumt in ihrem finally selbst auf; nur nach einem Abbruch gleich). now: sofort, ohne Ausblenden
  _a2PicnicEnd(force = false, now = false) {
    if (!force && this._a2PicnicBusy && !this._ac?.signal?.aborted) return;
    if (this._a2PicnicHolding) this._a2PicnicHold(null);
    this._el.pika.classList.remove(...PICNIC_CLS);
    const S = this._a2PicnicS;
    if (!S) return;
    this._a2PicnicS = null;
    clearTimeout(this._a2PicnicLidT);
    for (const t of S.t) clearTimeout(t);
    for (const e of S.fx) {
      // (wer schon davonfliegt, fliegt zu Ende: sein eigener Zeitgeber nimmt ihn weg)
      if (S.off.has(e) && !now) continue;
      if (now || !S.bf.has(e)) e.remove();
      else {
        e.classList.add('off');
        setTimeout(() => e.remove(), 650);
      }
    }
    const tr = S.treat;
    if (tr) {
      if (now || !tr.isConnected) tr.remove();
      else {
        tr.classList.add('away');
        setTimeout(() => tr.remove(), 550);
      }
    }
    const el = S.el;
    el.classList.remove('open', 'a2tap', 'a2roll', 'pop');
    if (!now && el.isConnected && this._a2Els?.get('picnic') === el) {
      el.classList.add('a2out');
      setTimeout(() => !this._a2PicnicS && this._a2Drop('picnic'), 450);
    } else this._a2Drop('picnic');
  }

  _a2PicnicCleanup() {
    this._a2PicnicEnd();
  }

  // Karte aus dem DOM: alles sofort weg
  _a2PicnicDetach() {
    clearTimeout(this._a2PicnicTapT);
    this._a2PicnicBusy = false;
    this._a2PicnicEnd(true, true);
  }
}
