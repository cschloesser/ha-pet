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
//   bekommen eine Zone, und nur, wenn es den Hook gibt.
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
import { rnd, clamp, pick } from '../logik/hilfen.js';
import { goldDue } from '../logik/paeckchen.js';
import { A2_KEYS, giftLvs2 } from '../logik/album2.js';
import { A2_ITEMS } from '../grafik/album2.js';
import { A2_PLATZHALTER } from '../grafik/album2/platzhalter.js';

const cap = (k) => k[0].toUpperCase() + k.slice(1);

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
    A2_ITEMS.forEach((it, t) => {
      if (!(lvs[t] > 0)) return;
      const A = this._a2Hook(it.key, 'Acts', ctx, lvs[t]);
      if (Array.isArray(A)) out.push(...A.filter((a) => Array.isArray(a) && a[0] > 0 && typeof this[`_${a[1]}`] === 'function'));
    });
    return out;
  }

  // Aus _cleanup (Ende oder Abbruch einer Aktion)
  _a2Cleanup() {
    for (const it of A2_ITEMS) this._a2Hook(it.key, 'Cleanup');
  }

  // Aus _tickGift
  _a2Tick() {
    const lvs = this._a2Lvs();
    A2_ITEMS.forEach((it, t) => lvs[t] > 0 && this._a2Hook(it.key, 'Tick', lvs[t]));
  }

  // Aus _detachGift
  _a2Detach() {
    for (const it of A2_ITEMS) this._a2Hook(it.key, 'Detach');
  }

  // Tippflächen für _worldZones: jedes Element aus _a2El, dessen Schatz einen Hook Tap hat
  _a2Zones(Z, sr) {
    for (const [key, el] of this._a2Els || []) {
      if (typeof this[`_a2${cap(key)}Tap`] !== 'function' || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const pad = 6;
      Z.push({ k: key, a2: true, el, l: r.left - sr.left - pad, t: r.top - sr.top - pad, r: r.right - sr.left + pad, b: r.bottom - sr.top + pad, pad });
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
