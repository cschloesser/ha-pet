// Aufbau: Schattenbaum bauen, Areal einsetzen, Knöpfe einpassen, Maße der Szene (_layout)

import { rnd, clamp, sceneUnit } from '../logik/hilfen.js';
import { CRIT_KINDS } from '../logik/besucher.js';
import { ACT_PX } from '../logik/beschaeftigungen.js';
import { PIKA_SVG } from '../grafik/pika.js';
import { AREALE } from '../grafik/areale.js';
import { HAY_SVG, TUFTS_SVG, LOOKOUT_SVG, FOOD, ICON_LEAF, ICON_HEART, ICON_SPARK } from '../grafik/szene.js';
import { GIFT_PARCEL } from '../grafik/paeckchen.js';
import { DIARY_BOOK } from '../grafik/tagebuch.js';
import { STYLE } from '../stil/szene.js';
import { STYLE_SKY } from '../stil/himmel.js';
import { STYLE_FEST } from '../stil/feste.js';
import { STYLE_FRIEND } from '../stil/pino.js';
import { STYLE_BOTE } from '../stil/haus-bote.js';
import { STYLE_COFFEE } from '../stil/kaffee.js';
import { STYLE_ACT } from '../stil/beschaeftigungen.js';
import { STYLE_GIFT } from '../stil/paeckchen.js';
import { STYLE_DIARY_BTN } from '../stil/tagebuch.js';
import { STYLE_URLAUB } from '../stil/urlaub.js';
import { STYLE_SIG } from '../stil/signale.js';

export class Aufbau {
  _build() {
    // 24 Sterne in drei Ebenen zu je acht: funkeln ebenenweise versetzt, also drei Animationen statt 24
    const stars = Array.from({ length: 3 }, () => '<b>' + Array.from({ length: 8 }, () =>
      `<i style="left:${rnd(2, 98).toFixed(1)}%;top:${rnd(3, 55).toFixed(1)}%;transform:scale(${rnd(0.7, 1.3).toFixed(2)})"></i>`
    ).join('') + '</b>').join('');
    const flies = Array.from({ length: 6 }, () =>
      `<i style="left:${rnd(25, 90).toFixed(1)}%;top:${rnd(45, 80).toFixed(1)}%;animation-delay:${rnd(-9, 0).toFixed(2)}s,${rnd(0, 1.8).toFixed(2)}s"></i>`
    ).join('');
    // Sechs Wolken in verschiedenen Höhen, Größen und Geschwindigkeiten (Dauer --d, Versatz --dl)
    const clouds = [
      [14, 1, 110, -45], [32, 0.72, 150, -100], [8, 0.85, 130, -15],
      [24, 1.15, 95, -70], [40, 0.6, 170, -140], [18, 0.95, 120, -95],
    ].map(([top, s, d, dl]) => `<div class="cloud" style="top:${top}%;--s:${s};--d:${d}s;--dl:${dl}s"></div>`).join('');

    this.shadowRoot.innerHTML = `
        <style>${STYLE}${STYLE_SKY}${STYLE_FEST}${STYLE_FRIEND}${STYLE_BOTE}${STYLE_COFFEE}${STYLE_ACT}${STYLE_GIFT}${STYLE_DIARY_BTN}${STYLE_URLAUB}${STYLE_SIG}</style>
        <ha-card>
          <div class="scene day">
            <div class="sky sky-day"></div><div class="sky sky-dusk"></div><div class="sky sky-night"></div>
            <div class="sky sky-grey"></div><div class="sky sky-storm"></div>
            <div class="stars">${stars}</div>
            <div class="meteors"></div>
            <div class="sun"></div>
            <div class="moon"><svg viewBox="0 0 100 100"><circle class="moon-dark" cx="50" cy="50" r="50"/><path class="moon-lit"/></svg></div>
            <svg class="mtns" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <g class="mtn">
                <path class="m1" d="M0 58 L10 40 L17 46 L30 22 L40 36 L47 30 L60 50 L70 34 L78 40 L88 18 L100 36 V100 H0Z"/>
                <path class="mcap" d="M30 22 L34.3 28 L32 27 L30.5 29 L28.5 27.2 L26.75 28Z"/>
                <path class="mcap" d="M88 18 L92.7 25 L90.5 24 L88.5 26 L86.5 24.2 L84.8 25Z"/>
                <path class="mcap" d="M70 34 L74 37 L72 36.4 L70.5 37.6 L69 36.5 L68.1 37Z"/>
                <path class="mcap" d="M47 30 L49.6 34 L48.3 33.5 L47 34.6 L45.8 33.6 L44.6 34Z"/>
              </g>
            </svg>
            <div class="rbow"></div>
            <div class="clouds">${clouds}</div>
            <div class="planes"></div>
            <svg class="hills" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path class="h0" d="M0 55 Q12 47 26 52 T56 48 T82 51 T100 46 V100 H0Z"/>
              <path class="h1" d="M0 64 Q16 50 36 60 T72 55 T100 50 V100 H0Z"/>
              <path class="h2" d="M0 83 Q25 79 50 83 T100 82 V100 H0Z"/>
            </svg>
            <div class="mice"></div>
            <div class="fest-b"></div>
            <div class="land">
              <div class="burrow"></div>
              <div class="lookout">${LOOKOUT_SVG}</div>
            </div>
            <div class="lights"></div>
            <div class="tvl"><i class="tvg"></i><i class="scr"></i></div>
            <div class="birds"></div>
            <div class="kites"></div>
            <div class="flowers"></div>
            <div class="foods"></div>
            <div class="gifts"></div>
            <div class="props"></div>
            <div class="friends"></div>
            <div class="ff">${flies}</div>
            <div class="acts"></div>
            <div class="pika" role="button" tabindex="0" aria-label="Streicheln">
              <div class="clipw">
                <div class="shadow"></div>
                <div class="depth"><div class="flip"><div class="jump"><div class="hop"><div class="br">${PIKA_SVG}</div></div></div></div></div>
              </div>
            </div>
            <div class="held"></div>
            <div class="psay">
              <div class="anchor">
                <div class="zzz"><span>z</span><span>z</span><span>Z</span></div>
                <div class="bubble say"></div>
                <div class="bubble think">${FOOD.lz.svg}</div>
              </div>
            </div>
            <div class="fore"><div class="hay">${HAY_SVG}</div></div>
            <div class="fest-f"></div>
            <div class="grass">${TUFTS_SVG()}</div>
            <div class="actsf"></div>
            <div class="poops"></div>
            <div class="precip"></div>
            <div class="fog"><i></i><i></i></div>
            <div class="flash"></div>
            <div class="phits"></div>
            <div class="ptags"></div>
            <div class="fx"></div>
            <div class="stats">
              <span class="tb">${DIARY_BOOK}</span><span class="nm"></span>
              <span class="st st-s" title="Satt">${ICON_LEAF}<i><b class="bar-s"></b></i></span>
              <span class="st st-g" title="Glücklich">${ICON_HEART}<i><b class="bar-g"></b></i></span>
              <span class="st st-c" title="Sauber">${ICON_SPARK}<i><b class="bar-c"></b></i></span>
            </div>
            <button class="tbbtn" hidden title="Tagebuch" aria-label="Tagebuch öffnen">${DIARY_BOOK}</button>
            <button class="feed" title="Füttern" aria-label="Füttern">${FOOD.lz.svg}</button>
            <button class="gbtn" hidden title="Päckchen schenken" aria-label="Päckchen schenken">
              <svg class="gring" viewBox="0 0 44 44" aria-hidden="true"><circle class="gr0" cx="22" cy="22" r="20"/><circle class="gr1" cx="22" cy="22" r="20" pathLength="100"/></svg>
              <span class="gico">${GIFT_PARCEL}</span><b class="gnum"></b><i class="gcrit"></i>
            </button>
            <div class="sr" aria-live="polite"></div>
          </div>
        </ha-card>`;

    const $ = (s) => this.shadowRoot.querySelector(s);
    this._el = {
      scene: $('.scene'), pika: $('.pika'), jump: $('.jump'), shadow: $('.pika .shadow'), mfood: $('.mfood'),
      flowers: $('.flowers'), foods: $('.foods'), fx: $('.fx'), hay: $('.hay'),
      stats: $('.stats'), name: $('.nm'), barS: $('.bar-s'), barG: $('.bar-g'),
      birds: $('.birds'), mice: $('.mice'), planes: $('.planes'), ptags: $('.ptags'), phits: $('.phits'),
      tvl: $('.tvl'), kites: $('.kites'), bflip: $('.bflip'),
      stS: $('.st-s'), stG: $('.st-g'), barC: $('.bar-c'), stC: $('.st-c'), poops: $('.poops'), feed: $('.feed'), say: $('.say'), think: $('.think'),
      sun: $('.sun'), moon: $('.moon'), moonLit: $('.moon-lit'), clouds: [...this.shadowRoot.querySelectorAll('.cloud')],
      precip: $('.precip'), flash: $('.flash'),
      skyDusk: $('.sky-dusk'), skyNight: $('.sky-night'), skyGrey: $('.sky-grey'), skyStorm: $('.sky-storm'), rbow: $('.rbow'),
      burrow: $('.burrow'), lights: $('.lights'), clipw: $('.clipw'), depth: $('.depth'), rock: $('.lookout'),
      meteors: $('.meteors'), ff: $('.ff'), festB: $('.fest-b'), festF: $('.fest-f'), props: $('.props'), friends: $('.friends'),
      acts: $('.acts'), actsf: $('.actsf'), gifts: $('.gifts'), gbtn: $('.gbtn'), tbbtn: $('.tbbtn'),
    };
    this._el.psay = $('.psay');
    this._el.held = $('.held');
    this._el.anchor = this._el.psay.querySelector('.anchor');
    this._el.sr = this.shadowRoot.querySelector('.sr');
    this._el.starEls = [...this.shadowRoot.querySelectorAll('.stars i')];
    // Tastatur: Enter oder Leertaste streichelt (ohne Stelle: Rücken). Eine gehaltene Taste wiederholt sich: Das zählt
    // nicht (die Leertaste soll trotzdem nicht die Seite rollen).
    this._el.pika.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat) this._pet(null);
    });
    this._el.pika.addEventListener('click', (e) => (e.stopPropagation(), this._onPet(e)));
    // Antippen, lang drücken = kraulen, waagerecht über ihn wischen = übers Fell streichen
    this._pressBind(this._el.pika);
    this._el.feed.addEventListener('click', (e) => (e.stopPropagation(), this._onFeed()));
    // Statusleiste (oder, ist sie ausgeblendet, der Buch-Knopf) öffnet das Tagebuch
    const diary = (e) => {
      if (!this._diaryOn()) return;
      e.stopPropagation();
      this._diaryOpen();
    };
    this._el.stats.addEventListener('click', diary);
    this._el.tbbtn.addEventListener('click', diary);
    this._el.stats.addEventListener('keydown', (e) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || !this._diaryOn()) return;
      e.preventDefault();
      if (!e.repeat) this._diaryOpen();
    });
    // Päckchen-Knopf: tippen = verschenken, lang drücken = Schätze im Tagebuch (früher das Album)
    const gb = this._el.gbtn;
    gb.addEventListener('click', (e) => (e.stopPropagation(), this._onGiftBtn()));
    gb.addEventListener('contextmenu', (e) => e.preventDefault());
    gb.addEventListener('pointerdown', () => {
      // Nach langem Drücken kommt auf Touch (oder beim Wegziehen) oft kein Klick: den Merker nicht stehen lassen
      this._albumHeld = false;
      clearTimeout(this._albumPT);
      this._albumPT = setTimeout(() => {
        this._albumHeld = true;
        this._found('album');
        this._diaryOpen('schatz');
      }, 550);
    });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) gb.addEventListener(t, () => clearTimeout(this._albumPT));
    this._el.scene.addEventListener('click', (e) => this._onLookAt(e));
    this._hay = 3;
    this._blooms = []; // Blüten im Vorrat: { color, sx, sy }, kommen aus dem Tagesplan (_hayFromPlan)
  }

  _areal() {
    return AREALE[this._arealKey] || AREALE.huegel;
  }

  // Bau-Grafik einsetzen. Wechselt das Areal bei laufender Karte (Editor), fängt die Wiese neu an.
  _applyAreal() {
    const key = AREALE[this._cfg.areal] ? this._cfg.areal : 'huegel';
    if (key === this._arealKey) return;
    const sc = this._el.scene.classList;
    if (this._arealKey) sc.remove(`areal-${this._arealKey}`);
    this._arealKey = key;
    sc.add(`areal-${key}`);
    const A = this._areal();
    sc.toggle('stash', !!A.stash);
    const svg = (body) => (body ? `<svg viewBox="0 0 100 ${A.vh}" aria-hidden="true">${body}</svg>` : '');
    this._el.burrow.innerHTML = svg(A.svg);
    this._el.lights.innerHTML = svg(A.lights);
    if (this._plan) this._hayFromPlan();
    if (this._g) {
      this._stop();
      this._g = null;
      this._flowers.forEach((f) => f.el.remove());
      this._flowers = [];
      this._asleep = this._inside = false;
      this._lift = 0;
      this._poseName = null;
      this._el.pika.classList.remove('sleeping', 'inside');
      this._pikaZ();
      this._el.clipw.style.clipPath = '';
      this._layout();
      this._restartCritters();
    }
  }

  // Futter- und Päckchen-Knopf oben rechts nebeneinander (Päckchen-Knopf links, 36 px, 8 px Abstand). Stoßen sie an
  // die Statusleiste (schmale Karte, langer Name), stehen sie untereinander.
  _btnFit() {
    const { scene, stats, tbbtn, name } = this._el;
    // Statusleiste: Passt der Name nicht ganz hinein, erst die kompakte Stufe; bleibt dann kaum etwas von ihm übrig
    // (unter etwa drei Buchstaben), ganz ohne Namen
    const cl = scene.classList;
    cl.remove('slim', 'tiny');
    if (!stats.hidden) {
      if (name.scrollWidth > name.clientWidth) cl.add('slim');
      if (name.scrollWidth > name.clientWidth && name.clientWidth < 26) cl.add('tiny');
    }
    const left = stats.hidden ? tbbtn : stats;
    const sR = left.hidden ? 0 : left.offsetLeft + left.offsetWidth;
    scene.classList.toggle('btncol', sR + 8 > scene.clientWidth - 88);
  }

  _layout() {
    const W = this._el.scene.clientWidth;
    const Hs = this._el.scene.clientHeight;
    if (!W || !Hs) return;
    const first = !this._g;
    // Gleiche Größe (z. B. der erste Aufruf des ResizeObservers gleich nach _attach): nichts zu tun
    if (!first && W === this._W && Hs === this._Hs) return;
    // H ist die Größeneinheit (this._H, --H), nicht immer die Höhe der Karte (this._Hs): siehe sceneUnit. Was am
    // Boden steht, rechnet von gy aus; nur der Himmel (Flugzeuge, Sternschnuppen, Raketen) nimmt die echte Höhe.
    const H = sceneUnit(W, Hs);
    // Beim Laufen ist this._x schon das Ziel: echte Stelle merken (noch mit der alten Pika-Breite)
    const liveX = !first && !this._inside && !(this._lift > 0) && this._el.pika.classList.contains('walking') ? this._liveX() : null;
    const ratio = first ? 1 : W / this._W;
    this._W = W;
    this._H = H;
    this._Hs = Hs;
    this._btnFit();
    const pH = clamp(H * 0.4, 48, 170);
    const pW = pH * 1.2;
    const gy = Hs - H * 0.1;
    // Bau: viewBox-Einheit u, Boden der Grafik liegt auf gy
    const A = this._areal();
    const bW = H * A.w;
    const bL0 = bW * A.left;
    const S = A.stash;
    const hay0 = bL0 + (S ? bW * S.x1 / 100 : bW * A.hay);
    // Schmale Karte (Handy): Stein bis 60 % und Heuhaufen bis 85 % kleiner, so dass Heu, Lücke und Stein
    // in die Breite passen. Die Nische (stash) gehört zum Bau und bleibt so groß wie er.
    const gap = pW * 0.4;
    const sW = S ? bW * (S.x2 - S.x1) / 100 : 0;
    const sk = S
      ? clamp((W - hay0 - sW - gap) / (H * 0.6), 0.6, 1)
      : clamp((W - hay0 - H * 0.26 * 0.75 - gap) / (H * 0.26 * 0.25 + H * 0.6), 0.6, 1);
    const hW = S ? sW : H * 0.26 * (0.75 + 0.25 * sk);
    const kW = H * 0.6 * sk;
    // Bleibt Platz, rückt der Bau etwas nach rechts: Laterne und Blumen am linken Rand ganz im Bild
    const bL = bL0 + clamp(W - (hay0 + hW + gap + kW), 0, Math.max(0, -bL0 * 0.5));
    const u = bW / 100;
    const Y = (v) => gy - (A.vh - A.sink - v) * u;
    const hole = { l: bL + A.hole.x1 * u, r: bL + A.hole.x2 * u, top: Y(A.hole.top), lip: Y(A.hole.lip) };
    hole.cx = (hole.l + hole.r) / 2;
    const hL = bL + (S ? S.x1 * u : bW * A.hay);
    // Aussichtsstein rechts, knapp vor dem rechten Rand, aber nie darüber hinaus
    const ku = kW / 100;
    const kL = Math.min(Math.max(hL + hW + gap, W - 10 - kW), W - kW);
    const rock = { l: kL, w: kW, cx: kL + kW / 2, lift: (46 - 13) * ku };
    const rs = this._el.rock.style;
    rs.left = `${kL}px`;
    rs.top = `${gy - 46 * ku}px`;
    rs.width = `${kW}px`;
    rock.ku = ku;
    rock.top0 = gy - 46 * ku; // Oberkante der Stein-Grafik
    this._g = {
      pH, pW, gy, hole, rock,
      bur: { l: bL, u, base: gy - (A.vh - A.sink) * u }, // Bau-Einheiten → px
      home: hole.cx,
      hay: hL + hW / 2,
      hW, // Breite des Heuhaufens (auf schmaler Karte kleiner als 0,26 H) bzw. der Nische
      stash: !!S,
      // Fläche am Boden, die Heuhaufen (volle Größe) bzw. Nische einnehmen, und wo der Pika zum Ablegen steht:
      // am Haufen rechts davon, an der Nische rechts neben ihr (wirft hinein, sie bleibt sichtbar)
      hayL: S ? hL : hL + hW / 2 - H * 0.138,
      hayR: S ? hL + hW : hL + hW / 2 + H * 0.138,
      stand: S ? hL + hW + pW * 0.5 : hL + hW / 2 + pW * 0.34,
      // Blumen und Futter zwischen Heuhaufen und Stein
      fMin: (hL + hW + pW * 0.3) / W,
      fMax: Math.max((hL + hW + pW * 0.3) / W + 0.08, (kL - H * 0.03) / W),
      // Rechte Grenze am Boden: ganz im Bild wie links (die Knöpfe sitzen oben rechts)
      xR: Math.max(pW * 0.45, W - pW * 0.45),
    };
    for (const el of [this._el.burrow, this._el.lights]) {
      el.style.left = `${bL}px`;
      el.style.top = `${Y(0)}px`;
      el.style.width = `${bW}px`;
    }
    // Fernsehlicht füllt den Eingang
    const ts = this._el.tvl.style;
    const tw = hole.r - hole.l;
    ts.left = `${hole.l}px`;
    ts.top = `${hole.top}px`;
    ts.width = `${tw}px`;
    ts.height = `${hole.lip - hole.top}px`;
    ts.borderRadius = `${tw / 2}px ${tw / 2}px 0 0`;
    // --gb: Abstand der Bodenlinie vom unteren Rand (für alles, was mit bottom am Boden steht)
    const vars = { W, H, pw: pW, ph: pH, gy, gb: Hs - gy, hw: hW, hl: hL, fw: H * 0.085, dw: H * 0.13 };
    for (const [k, v] of Object.entries(vars)) this._el.scene.style.setProperty(`--${k}`, `${v}px`);

    if (first) {
      this._initFlowers();
      if (this._sleepTime()) this._sleepNow(true);
      else this._setX(rnd(this._g.home + pW, W * 0.7), true);
      this._updateSky();
      this._placePiles(); // neues Areal: schon liegende Häufchen an die neuen Stellen
      this._renderStats();
      // Frisch geladen: Noch hat ihn niemand gesehen, in eine laufende Beschäftigung steigt er ohne Hinlaufen ein
      this._blindAt = Date.now();
      this._blindFirst = true;
      this._start();
      // Bildrate messen, nur mit pika_messung in der Adresse (src/karte/messung.js)
      this._messung().catch((e) => console.warn('pika-pet-card: Messung', e));
    } else if (this._inside) {
      this._setX(this._g.home, true);
      this._pose(this._poseName, 0);
    } else if (this._lift > 0) {
      this._onHam = false; // aus der Hängematte auf den Stein: von dort hüpft er herunter
      this._lift = rock.lift;
      this._setX(rock.cx, true);
    } else {
      // Auf der hinteren Spur (depth) in ihrem Bereich bleiben: anteilig gerückt läge er sonst ein paar Pixel davor
      const [lo, hi] = this._cfg.depth && this._lane ? this._laneRange() : [pW * 0.45, this._g.xR];
      this._setX(clamp((liveX ?? this._x) * ratio, lo, hi), true);
      // Mitten im Laufen angehalten: Aktion neu wählen, sonst hoppelt er bis zum Ende auf der Stelle
      if (liveX != null) this._interrupt();
    }
    // Fähnchen neu messen (Schriftgröße hängt an --H)
    for (const p of this._planes.values()) p.tw = 0;
    this._layoutSky(first);
    this._layoutFest(first);
    this._layoutFriend(first);
    this._layoutBote(first);
    this._layoutSig();
    this._layoutGift(first);
    if (!first) {
      this._planeSnap();
      this._placePiles();
      // Besucher sitzen an festen Pixeln: bei Größenänderung lieber neu kommen lassen
      if (CRIT_KINDS.some((k) => this['_' + k])) this._restartCritters();
      // Staffelei, Drache und die Requisiten am Boden (Pfütze, Schnee-Pika …) stehen an festen Pixeln, Papierflieger
      // und Purzelbaum rechnen mit Wegen in Pixeln (ACT_PX): abbrechen, das räumt auf. Was nach der Planzeit läuft
      // (Malen, Drachen, Pfütze, Schiffchen, Schnee-Pika), nimmt er gleich wieder auf; Steintürmchen, Papierflieger
      // und Purzelbaum sind für dieses Fenster vorbei (ACT_NOJOIN). Ohne Größenänderung kommt _layout nicht bis hier.
      if (this._easelEl || this._kiteEl || this._aprops?.size || ACT_PX.has(this._action)) this._interrupt();
      if (this._giftEl) this._flowerGiftPlace(this._giftEl); // Blumengeschenk an seiner relativen Stelle
    } else {
      this._flowerFromPlan(); // lag schon eins (anderes Gerät, Neuladen)
      this._foodFromPlan();
    }
  }
}
