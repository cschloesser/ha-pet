// Album 2 (seit 0.46): gemeinsame Schnittstelle der acht Schätze in der Szene
//
// ---------- Wie ein Schatz aus Album 2 gebaut wird ----------
// Jeder Schatz hat drei Dateien, die nur ihm gehören (Vorbild: das Vogelhäuschen, key 'feeder'):
//   src/grafik/album2/<key>.js   A2_<KEY>: Daten und Bilder (Felder im Kopf von src/grafik/album2.js). built: true
//                                schaltet ihn frei; erst dann kann er aus einem Päckchen kommen.
//   src/karte/album2-<key>.js    export class Album2<Key>: die Hooks unten (steht schon in TEILE, src/karte.js)
//   src/stil/album2-<key>.js     STYLE_A2_<KEY> (hängt schon in STYLE_A2, src/stil/album2.js)
// Geteilt (nicht anfassen, außer die Schnittstelle selbst ändert sich): diese Datei, src/logik/album2.js (Reihenfolge,
// Stufen, Ziehen), src/grafik/album2.js (Liste), src/stil/album2.js, Tagebuch, Vorschau. Tests in eigene Dateien
// test/album2-<key>.test.mjs.
//
// Stufen kommen aus dem Plan (gift.w, siehe src/logik/album2.js), so wie sie ausgepackt sind: this._a2Lv(key) bzw.
// this._a2Lvs() (0 = noch nicht da oder noch im Päckchen, 1 Schatz, 2 Trick, 3 golden). Gold ist Zierde je Gerät,
// nichts davon steht im Plan oder im Zustand: this._a2GoldOk(key, R, name) sagt, ob eine Zugabe jetzt darf (golden,
// ausgepackt, jemand schaut zu, nicht verreist; R = { cd, p } wie in GOLD, src/logik/paeckchen.js: Abstand in ms und
// Wahrscheinlichkeit, ohne R nur die Stufe; die Vorschau mit _dbgGold überspringt Abstand und Würfel).
//
// Hooks: Methoden mit festem Namen _a2<Key><Hook>, Key mit großem Anfangsbuchstaben (_a2FeederActs). Jede ist
// freiwillig, eine leere Klasse tut nichts. Ein Fehler in einem Hook bleibt bei diesem Schatz (_guard, steht im Fuß des
// Tagebuchs). Methodennamen der Klasse sind global (eine Klasse): Eigene Hilfsmethoden heißen _a2<Key>…, Felder
// this._a2<Key>… (der Bau bricht bei doppelten Namen ab).
// - _a2<Key>Acts(ctx, lv) → [[Gewicht, 'aktion'], …]: was er von sich aus damit tun mag. Aufgerufen bei jeder Wahl der
//   nächsten Kleinigkeit (_step in src/karte/lebensschleife.js, neben _giftActs), nur wenn der Schatz da ist (lv ≥ 1),
//   Päckchen an sind, kein Ballon unterwegs ist und er nicht verreist ist. ctx: { s, g, wx, elev, piles, clean,
//   hasFlowers } wie bei _giftActs (wx: this._wx mit wet, snowcover, cold, cover, fog …). Gewichte wie dort: 0 = nicht,
//   0,3 selten, 1 oft (idle, look, wander haben je 3). Die Bedingung steckt im Gewicht (Wetter, Tageszeit:
//   this._el.scene.classList 'dusk'/'night', Monat: new Date(this._dbgDate ?? Date.now())).
//   'aktion' ist der Name einer async-Methode this['_' + aktion], Konvention 'a2<Key><Was>' (z. B. 'a2FeederPlay'). Sie
//   läuft wie jede Aktion: warten nur mit await this._wait(ms) (bricht mit Cancel ab, wenn etwas dazwischenkommt), sich
//   bewegen mit _walkTo/_approach/_hopTo/_face, sprechen mit _say/_peep, freuen mit _happy/_jump/_sparkle. Vorschau-
//   Knöpfe setzen this._next = 'aktion' (dann gilt this._forced: auch ohne passendes Wetter).
//   Seit 0.48.1 rechnet _a2Acts die Gewichte noch um (A2_REF, A2_DUR, A2_PAUSE, A2_SLOT_GAP unten): Jede Aktion wiegt
//   höchstens 36 s / ihre typische Dauer (neue Aktionen tragen dort ihre Dauer ein), ein Schatz pausiert nach seinem Mal 6 Minuten,
//   und nichts wird angeboten, was bis zur nächsten Beschäftigung aus dem Tagesplan nicht fertig wäre. Braucht ein Schatz
//   Platz am Boden: findet sich mit _a2Free keiner (_a2Hit), Gewicht 0; den Freund vorher beiseite (_a2FrAside); schlägt
//   das Wetter mitten in der Aktion um, bricht der Hook Scene ab (_a2WxTurned).
// - _a2<Key>Scene(lv): Szene nachziehen. Läuft bei jedem Takt, jeder Änderung des Plans und nach jedem Auslegen
//   (_giftScene), auch nachts. Was dauerhaft steht (Vogelhäuschen), legt man mit this._a2El(key, html) an (ein
//   div.gt.a2-<key> in der Ebene .gifts, Rang schatz, Licht wie die Schätze aus Album 1) und setzt dort left/bottom und
//   die Ebene (z-index mit buehneZ, src/logik/buehne.js); weg mit this._a2Drop(key) (lv 0, kein Platz). Nach dem Hook
//   bekommt das Element .gilt, wenn er golden ist. Schätze, die nur für ihren Moment kommen (wie die Hängematte: er holt
//   sie, nutzt sie, räumt sie weg), legen ihr Element in der Aktion an und nehmen es im finally und in Cleanup weg.
// - _a2<Key>Stow(lv): async, gleich nach dem Auspacken, wenn die neue Stufe lv gilt (das Bild ist schon zu seinem
//   Element in der Szene geflogen bzw. beim Pika verblasst): kurz vorführen, was neu ist (Stufe 1 die Nutzung, 2 der
//   Trick, 3 die Zugabe). Läuft als Teil der Aktion giftOpen.
// - _a2<Key>Cleanup(): Die Aktion ist zu Ende oder wurde abgebrochen (_cleanup: Futter fällt, Tipp, Schlafenszeit,
//   Bildschirm aus). Synchron und wiederholbar: eigene Klassen am Pika, Requisiten, Teilchen, Zeitgeber wegnehmen. (Die
//   üblichen Klassen am Pika wie look-up, crouch, happy nimmt _cleanup selbst.)
// - _a2<Key>Tap(z) → true: Tipp auf sein Element in der Szene (Zone { k: key, el, l, t, r, b } in px der Szene). Nur auf
//   diesem Gerät, nichts in die Helfer. Mit true zählt die Entdeckung key (find in den Daten). Nur Elemente aus _a2El
//   bekommen eine Zone, und nur, wenn es den Hook gibt. Die Zone folgt der Zeichnung (je Form ein Rechteck); hat der
//   Schatz vorn ein zweites Stück außerhalb seines Elements (Rand des Beckens, Bogen des Trampolins), nennt
//   _a2<Key>Parts() → [Elemente] es, dann zählt dessen Zeichnung mit.
// - _a2<Key>Bed(lv): async, im Abendritual (_bedRitual in src/karte/momente.js) nach der Mütze, vor Gute Nacht (seit
//   0.48.1; Vorbild: die Laterne pustet er aus, wenn sie am Bau brennt). Warten mit this._wait: Füttern und Streicheln
//   brechen das Ritual dort ab (Cancel), aufräumen im finally. Reduzierte Bewegung: ohne Laufen. Nur, wenn der Schatz da
//   ist; nichts zu tun: sofort zurück.
// - _a2<Key>Tick(lv): im Takt (alle 20 s, nur sichtbar), für Zugaben, die von selbst kommen (mit _a2GoldOk und R).
// - _a2<Key>Detach(): Karte aus dem DOM (anderes Dashboard): eigene Zeitgeber abräumen, Teilchen weg.
// Reduzierte Bewegung (calmMotion aus src/logik/bewegung-reduzieren.js): ohne Flug, Hüpfen, Drehen; Dinge blenden am
// Platz ein und aus. Schlafen, Urlaub und Bearbeiten brauchen nichts Eigenes: Im Schlaf und im Urlaub wählt die
// Schleife keine Aktionen, und alles bleibt auf dem Gerät. PIKA_SVG und die Bilder anderer Schätze nicht ändern (die
// getragenen Schätze aus Album 1, Gießkanne, Fernrohr, Brille, stecken im PIKA_SVG; das ist für Album 2 zu): Was er
// trägt und was mit ihm laufen und sich umdrehen soll, nimmt er ins Maul, mit this._mouth(farbe, svg) und der Klasse
// carry am Pika (svg 24 × 24 ohne id und class, sonst griffe das Stylesheet des Pikas; wie _frPikaCarry in
// src/karte/pino.js, beides nimmt _cleanup ab). Wo es gerade ist (z. B. für einen Lichtschein in .fx): this._nosePos().
// Was am Boden steht, während er es benutzt, ist ein Element aus _a2El oder ein Requisit (_aprop in
// src/karte/beschaeftigungen-klein.js). Ein Test verbietet Kommentare im PIKA_SVG.
//
// Vorschau: die Knöpfe der Leiste „Album 2“ in preview.html entstehen aus dbg in den Daten ([Text, Aktion, Stufe]):
// Der Schatz bekommt die Stufe, dann läuft die Aktion auf beiden Karten (Stufe 3 mit _dbgGold).

import { calmMotion } from '../logik/bewegung-reduzieren.js';
import { Cancel, rnd, clamp, pick, clearSpot } from '../logik/hilfen.js';
import { goldDue } from '../logik/paeckchen.js';
import { A2_KEYS, giftLvs2 } from '../logik/album2.js';
import { A2_ITEMS } from '../grafik/album2.js';
import { A2_PLATZHALTER } from '../grafik/album2/platzhalter.js';

const cap = (k) => k[0].toUpperCase() + k.slice(1);
// Schätze, die Platz brauchen, auf dem der Freund stehen könnte (sie rufen _a2FrAside vor dem Aufbau). Ist der Freund
// gerade beschäftigt (_a2FrBusy), bietet _a2Acts ihre Aktionen nicht an, statt in ihn hineinzubauen.
const A2_FR_ASIDE = new Set(['sled', 'radio', 'feeder', 'camera', 'tramp', 'pool']);
// Gleichgewicht (seit 0.48.1): Die Gewichte der Aktionen zählen ihre Dauer nicht mit, Becken, Picknick und Radio dauern
// aber 30–50 s, idle, look und wander 2–3 s. Bis 0.48.0 nahmen die acht Schätze an trockenen Tagen 35–50 % der freien
// Zeit ein. Darum wiegt jede Aktion von selbst nur A2_REF / ihre typische Dauer (A2_DUR, gemessen in der Vorschau, s),
// und nach jedem Mal (von selbst, ab seinem Ende) pausiert der Schatz A2_PAUSE auf diesem Gerät (nichts im Plan oder im Zustand;
// Vorschau-Knöpfe und Auspacken zählen nicht). Simuliert (freie Wahl ohne Freund, alle mit Trick): A2 9–13 % der
// Zeit an trockenen Tagen, Album 1 etwa 30 %, Grundverhalten gut die Hälfte (mit 12 s / 12 Min waren es nur 5–8 %).
const A2_REF = 36;
const A2_PAUSE = 6 * 6e4;
const A2_DUR = {
  a2FeederPlay: 15, a2FeederFill: 21, a2LanternPlay: 23, a2LanternRun: 15, a2SledPlay: 16, a2SledBelly: 16,
  a2CameraPlay: 13, a2CameraSelfie: 16, a2RadioPlay: 32, a2RadioSpin: 33, a2TrampPlay: 13, a2TrampFlip: 13,
  a2PicnicPlay: 34, a2PicnicShare: 30, a2PoolPlay: 45, a2PoolBomb: 50,
};
// Spielraum bis zur nächsten Beschäftigung aus dem Tagesplan (ms): Eine Aktion, die bis dahin nicht fertig wäre, bietet
// _a2Acts nicht an (sonst begänne die große Beschäftigung hier 25–40 s später als auf den anderen Geräten, eine kleine
// fiele aus)
const A2_SLOT_GAP = 5000;

export class Album2 {
  // Daten des Schatzes t (0–7) oder key. Unbekannt: ein Platzhalter (wirft nicht)
  _a2Item(t) {
    const it = typeof t === 'string' ? A2_ITEMS.find((x) => x.key === t) : A2_ITEMS[t];
    return it || { key: '?', name: 'Schatz', say: 'ein Schatz!', built: false, icon: A2_PLATZHALTER, trick: 'Trick', gilt: 'ein goldener %', use: '', gold: '' };
  }

  // Für die Vorschau (preview.html baut daraus ihre Knöpfe)
  _a2Items() {
    return A2_ITEMS;
  }

  // Hook name des Schatzes key aufrufen, wenn es ihn gibt (sonst undefined)
  _a2Hook(key, name, ...args) {
    const f = this[`_a2${cap(key)}${name}`];
    return typeof f === 'function' ? this._guard(`Album 2 ${key}`, () => f.apply(this, args)) : undefined;
  }

  // Stufen aller acht, wie sie ausgepackt sind. Wie bei Album 1 (_giftScene): ohne den, der noch am Ballon hängt oder
  // im Päckchen liegt, und der gerade ausgepackte noch auf seiner alten Stufe (_a2Hide), bis er verstaut ist.
  _a2Lvs() {
    if (!this._giftOn()) return A2_KEYS.map(() => 0);
    const G = this._plan?.gift;
    const B = this._gb;
    const hide = this._a2Hide ?? (B && !B.stowed && B.alb === 2 && G && B.z === G.z ? B.item : null);
    return giftLvs2(G, hide);
  }

  // Stufe eines Schatzes (key oder t2)
  _a2Lv(k) {
    const t = typeof k === 'string' ? A2_KEYS.indexOf(k) : k;
    return this._a2Lvs()[t] || 0;
  }

  // Darf die goldene Zugabe des Schatzes key jetzt? Wie _goldOk (src/karte/schaetze.js); name: welche Zugabe (für den
  // Abstand, wenn ein Schatz mehrere hat)
  _a2GoldOk(key, R = null, name = key) {
    if (!this._g || !this._giftOn() || this._urlaubFern() || this._away()) return false;
    if (!(this._a2Lv(key) >= 3)) return false;
    if (!R || this._dbgGold) return true;
    const at = (this._goldAt ??= {});
    const k = `a2:${name}`;
    const now = Date.now();
    if (!goldDue(R, at[k], now, Math.random())) return false;
    at[k] = now;
    return true;
  }

  // Dauerhaftes Element des Schatzes key in der Szene (Ebene .gifts), html beim Anlegen. → das Element
  _a2El(key, html, cls = '') {
    const E = (this._a2Els ??= new Map());
    let el = E.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = `gt a2-${key}${cls ? ` ${cls}` : ''}`;
      el.innerHTML = html;
      this._el.gifts.appendChild(el);
      E.set(key, el);
    }
    return el;
  }

  _a2Drop(key) {
    const el = this._a2Els?.get(key);
    if (!el) return;
    this._a2Els.delete(key);
    el.remove();
  }

  // Freier Platz am Boden für ein Ding der Breite w (seit 0.48.1): Mitte möglichst bei want, zwischen lo und hi (Mitte),
  // neben allem, was dort schon steht (_groundBlocks: Geräte des Haus-Boten, Festdeko, Schätze aus Album 1 und 2, auch
  // die abgestellte Laterne und das Vogelhäuschen, Häufchen; das Wollknäuel nicht, es liegt auf jedem Gerät woanders).
  // own: key des Schatzes, dessen eigenes Element nicht zählt; extra: weitere Sperren [l, r] in px. Ist want frei,
  // bleibt es dabei. Ist nirgends Platz, darf es vor dem Vogelhäuschen stehen (es steht auf der hinteren Reihe, dahinter;
  // auf 600 px passte die Picknickdecke sonst nie zwischen Windrad und Häuschen), ist auch dann keiner: want (wie bis
  // 0.48.0; die Hooks Acts bieten die Aktion dann nicht an, _a2Hit mit soft).
  _a2Free(lo, hi, w, want, own = null, extra = []) {
    const B = this._a2Blocks(own, extra);
    const hit = (x, L) => L.some(([l, r]) => x + w / 2 > l + 1e-6 && x - w / 2 < r - 1e-6);
    const x = clearSpot(want, w, lo, Math.max(lo, hi), B);
    if (!hit(x, B)) return x;
    const S = this._a2Blocks(own, extra, true);
    return clearSpot(want, w, lo, Math.max(lo, hi), S);
  }

  // Stünde ein Ding der Breite w mit der Mitte x auf etwas (wie _a2Free)? soft: das Vogelhäuschen zählt nicht
  _a2Hit(x, w, own = null, extra = [], soft = false, tol = 0) {
    return this._a2Blocks(own, extra, soft).some(([l, r]) => x + w / 2 > l + tol + 1e-6 && x - w / 2 < r - tol - 1e-6);
  }

  // Ist dort Platz genug, um die Aktion anzubieten (Hooks Acts)? Wie _a2Hit mit soft; den Rand der Sperren (1,5 % von H)
  // darf es berühren, die Zeichnung daneben nicht
  _a2Room(x, w, own) {
    return !this._a2Hit(x, w, own, [], true, this._H * 0.015);
  }

  _a2Blocks(own, extra, soft = false) {
    const skip = new Set([own && this._a2Els?.get(own), soft && this._a2Els?.get('feeder')].filter(Boolean));
    return this._groundBlocks(skip).concat(extra);
  }

  // Wetterumschwung (seit 0.48.1): Ist das Wetter jetzt schlecht für einen Schatz draußen (Schnee aus den Wolken,
  // Starkregen, Hagel, Gewitter, Sturm; wetOk false: auch jeder Regen)? Die Schätze merken es sich beim Aufbau (S.wx0) und
  // brechen in ihrem Hook Scene ab, wenn es erst während der Aktion umschlägt (_a2WxTurned). War es schon beim Aufbau
  // so (Vorschau-Knopf, Auspacken), bleibt es dabei.
  _a2WxBad(wetOk = false) {
    const wx = this._wx || {};
    return !!((!wetOk && wx.wet) || (wx.snow || 0) > 0 || (wx.rain || 0) > 40 || wx.storm || wx.shelter || wx.hail || wx.flash);
  }

  _a2WxTurned(S, wetOk = false) {
    return !!S && !S.wx0 && this._a2WxBad(wetOk);
  }

  // Szene: jeder Schatz zieht seine nach (Hook Scene), dann golden markieren
  _a2Scene() {
    if (!this._el || !this._g) return;
    const lvs = this._a2Lvs();
    A2_ITEMS.forEach((it, t) => this._a2Hook(it.key, 'Scene', lvs[t]));
    for (const [key, el] of this._a2Els || []) el.classList.toggle('gilt', lvs[A2_KEYS.indexOf(key)] >= 3);
  }

  // Was er von sich aus mit den Schätzen aus Album 2 tun mag (zur Wahl in _step, neben _giftActs)
  _a2Acts(ctx) {
    const G = this._plan?.gift;
    if (!this._giftOn() || !G?.w || this._gb || this._urlaubFern()) return [];
    const lvs = this._a2Lvs();
    const out = [];
    const frBusy = this._a2FrBusy();
    const now = Date.now();
    const slot = this._a2SlotLeft();
    A2_ITEMS.forEach((it, t) => {
      if (!(lvs[t] > 0) || (frBusy && A2_FR_ASIDE.has(it.key))) return;
      if (now - (this._a2Last?.[it.key] ?? -Infinity) < A2_PAUSE) return; // (pausiert nach dem letzten Mal)
      const A = this._a2Hook(it.key, 'Acts', ctx, lvs[t]);
      if (!Array.isArray(A)) return;
      for (const a of A) {
        if (!Array.isArray(a) || !(a[0] > 0) || typeof this[`_${a[1]}`] !== 'function') continue;
        const d = A2_DUR[a[1]] ?? A2_REF;
        if (slot < d * 1000 + A2_SLOT_GAP) continue; // (die nächste Beschäftigung käme mittendrin)
        out.push([a[0] * Math.min(1, A2_REF / d), a[1]]);
      }
    });
    return out;
  }

  // Wie lange noch bis zur nächsten Beschäftigung aus dem Tagesplan (ms, Uhr des Plans; _slotArm hat _slotNext eben
  // in _step gesetzt)? Infinity, wenn keine bekannt ist.
  _a2SlotLeft() {
    const n = this._slotNext;
    if (!Number.isFinite(n) || typeof this._planNow !== 'function') return Infinity;
    return n - this._planNow();
  }

  // Aus _cleanup (Ende oder Abbruch einer Aktion). Der freigehaltene Platz (_a2FrAside) gilt nur für die Aktion. War
  // es eine Aktion eines Schatzes, die er von selbst gewählt hat (nicht aus der Vorschau, _forced), pausiert der
  // Schatz jetzt A2_PAUSE (Auspacken läuft als giftOpen und zählt nicht).
  _a2Cleanup() {
    this._frKeep = null;
    const m = typeof this._action === 'string' && !this._forced && this._action.match(/^a2([A-Z][a-z]+)[A-Z]/);
    if (m && A2_KEYS.includes(m[1].toLowerCase())) (this._a2Last ??= {})[m[1].toLowerCase()] = Date.now();
    for (const it of A2_ITEMS) this._a2Hook(it.key, 'Cleanup');
  }

  // Aus dem Abendritual (_bedRitual in src/karte/momente.js, nach der Mütze): Hook Bed jedes Schatzes, der da ist,
  // nacheinander. Abbruch (Cancel: Füttern, Streicheln) bricht das Ritual ab wie jedes Warten darin; ein anderer Fehler
  // bleibt beim Schatz (_err), das Ritual geht weiter.
  async _a2Bed() {
    const lvs = this._a2Lvs();
    for (const [t, it] of A2_ITEMS.entries()) {
      const f = this[`_a2${cap(it.key)}Bed`];
      if (!(lvs[t] > 0) || typeof f !== 'function') continue;
      try {
        await f.call(this, lvs[t]);
      } catch (e) {
        if (e instanceof Cancel || this._ac?.signal?.aborted) throw e;
        this._err(`Album 2 ${it.key}`, e);
      }
    }
  }

  // Aus _tickGift
  _a2Tick() {
    const lvs = this._a2Lvs();
    A2_ITEMS.forEach((it, t) => lvs[t] > 0 && this._a2Hook(it.key, 'Tick', lvs[t]));
  }

  // Aus _detachGift
  _a2Detach() {
    this._frKeep = null;
    for (const it of A2_ITEMS) this._a2Hook(it.key, 'Detach');
  }

  // Ist der Freund gerade beschäftigt (gemeinsames oder eigenes Spiel, _withFriend), hoppelt er noch herein oder geht er
  // schon? Dann kein Schatz, der Platz braucht (A2_FR_ASIDE).
  _a2FrBusy() {
    const fr = this._fr;
    return !!fr && (!!fr.busy || !fr.arrived || !!fr.leaving);
  }

  // Platz von l bis r (px der Szene, vordere Reihe) für einen Schatz freihalten, bevor er dort aufgebaut wird (seit
  // 0.48.1): Steht der Freund unbeschäftigt darin (oder oben auf dem Stein), hoppelt er beiseite (_frTake beendet seinen
  // Schritt, _friendIdle führt ihn hinaus), und bis zum Ende der Aktion endet keiner seiner Wege darin (_frKeepX in
  // src/karte/pino.js; _a2Cleanup gibt den Platz wieder frei). Wartet, bis er draußen ist (höchstens etwa 2,5 s). Nicht für
  // Selfie und Picknick: Dort stellt die Aktion ihn selbst hin.
  async _a2FrAside(l, r) {
    this._frKeep = [Math.min(l, r), Math.max(l, r)];
    const fr = this._fr;
    if (!fr || fr.busy || !fr.arrived || fr.leaving || !this._frInKeep?.(fr)) return;
    this._frTake(fr);
    for (let i = 0; i < 16 && this._fr === fr && this._frInKeep(fr); i++) await this._wait(160);
  }

  // Tippflächen für _worldZones: jedes Element aus _a2El, dessen Schatz einen Hook Tap hat. Seit 0.48.1 nur, wo
  // gezeichnet ist: je Form der Zeichnung ein Rechteck mit 4 px Rand (bis 0.48.0 die ganze Box mit 6 px: Ein Tipp rechts
  // neben den Pfahl des Vogelhäuschens traf das Häuschen statt des Steins dahinter). Was ausblendet (.a2out) oder
  // ausgeblendet ist (.a2hid), bekommt keine. Ohne Formen (Attrappen): die Box.
  _a2Zones(Z, sr) {
    const pad = 4;
    for (const [key, el] of this._a2Els || []) {
      if (typeof this[`_a2${cap(key)}Tap`] !== 'function' || !el.isConnected) continue;
      if (el.classList?.contains('a2out') || el.classList?.contains('a2hid')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const parts = [el, ...(this[`_a2${cap(key)}Parts`]?.() || [])].filter((e) => e?.isConnected);
      const F = parts.flatMap((e) => [...(e.querySelectorAll?.('path, rect, circle, ellipse, polygon, polyline, line') || [])])
        .filter((f) => !f.closest?.('defs, clipPath, mask'))
        .map((f) => f.getBoundingClientRect())
        .filter((q) => q.width >= 0.5 || q.height >= 0.5);
      for (const q of F.length ? F : [r]) {
        Z.push({ k: key, a2: true, el, l: q.left - sr.left - pad, t: q.top - sr.top - pad, r: q.right - sr.left + pad, b: q.bottom - sr.top + pad, pad });
      }
    }
  }

  // Tipp auf eine Zone aus _a2Zones → true, wenn der Schatz geantwortet hat
  _a2Tap(z) {
    return !!this._a2Hook(z.k, 'Tap', z);
  }

  // Ausgepackt (aus _giftOpen): freuen, sagen, was es ist, an seinen Platz bringen, vorführen. ie: das Bild über dem
  // Päckchen, lv: die neue Stufe, B: das Päckchen
  async _a2Unpack(t, ie, lv, B) {
    const it = this._a2Item(t);
    const { gy } = this._g;
    this._happy(1800);
    this._jump(B.gold ? 'binky' : 'hop1');
    this._say(lv === 2 ? `neuer Trick: ${it.trick}!` : lv === 3 ? `${it.gilt.replace('%', it.name)}!` : it.say, 1800);
    if (lv === 3) for (let i = 0; i < 3; i++) setTimeout(() => this._g && this._sparkle(B.x, gy - this._H * 0.25, 2), 300 + i * 400);
    await this._wait(1900);
    await this._a2Stow(t, ie, lv);
  }

  // An seinen Platz: Steht der Schatz in der Szene (Element aus _a2El), fliegt das Bild dorthin und er ploppt auf,
  // sonst schwebt es zum Pika und verblasst (er holt ihn später für seinen Moment). Danach führt er vor (Hook Stow).
  async _a2Stow(t, ie, lv) {
    const it = this._a2Item(t);
    const sc = this._el.scene.getBoundingClientRect();
    this._a2Hide = null;
    if (this._gb) this._gb.stowed = true;
    this._giftScene();
    const tgt = this._a2Els?.get(it.key);
    const from = ie.getBoundingClientRect();
    let to;
    if (tgt) {
      tgt.style.opacity = '0';
      to = tgt.getBoundingClientRect();
    } else {
      const { pW, pH, gy } = this._g;
      to = { left: sc.left + this._x + this._dir * pW * 0.25 - 4, top: sc.top + gy - pH * 0.55 - 4, width: 8, height: 8 };
    }
    const k = clamp(to.width / Math.max(1, from.width), 0.1, 3);
    const cur = getComputedStyle(ie).transform;
    ie.animate([
      { transform: cur === 'none' ? 'none' : cur },
      { transform: `translate(${(to.left + to.width / 2 - from.left - from.width / 2).toFixed(1)}px, ${(to.top + to.height / 2 - from.top - from.height / 2).toFixed(1)}px) scale(${k.toFixed(2)})`, opacity: tgt ? 1 : 0.2 },
    ], { duration: calmMotion() ? 1 : 750, easing: 'cubic-bezier(.4, 0, .3, 1)', fill: 'forwards' });
    try {
      await this._wait(750);
    } finally {
      if (tgt) tgt.style.opacity = '';
    }
    ie.remove();
    if (tgt) {
      tgt.classList.add('new');
      setTimeout(() => tgt.classList.remove('new'), 800);
      this._sparkle(to.left - sc.left + to.width / 2, to.top - sc.top + to.height * 0.3, 3);
    }
    if (typeof this[`_a2${cap(it.key)}Stow`] === 'function') await this[`_a2${cap(it.key)}Stow`](lv);
    else {
      // (ein Schatz, den diese Version noch nicht kann: freuen genügt)
      this._say(pick(['ooh!', 'hübsch!', '♥']), 1300);
      await this._wait(rnd(1200, 1600));
    }
  }
}
