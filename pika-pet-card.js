/*
 * Pika Pet Card – ein kleiner Pika (Pfeifhase) wohnt im Home-Assistant-Dashboard.
 *
 *   Pika antippen      → streicheln (Herzchen, Glück steigt)
 *   Löwenzahn-Knopf    → füttern (Futter fällt herunter, er hoppelt hin und frisst)
 *   Nachts             → schläft er mit Zipfelmütze vor seinem Bau
 *   Sonst              → schaut sich um, hoppelt, knabbert Blumen, sammelt Heu, putzt sich
 *
 * Konfiguration:
 *   type: custom:pika-pet-card
 *   name: Pika                       # Name in der Statusanzeige
 *   entity: input_text.pika_status   # optional: Zustand geräteübergreifend speichern
 *   sleep_start: "21:00"             # Schlafenszeit
 *   sleep_end: "07:00"               # Aufwachzeit
 *   sun_entity: sun.sun              # Sonnenstand (Höhe + Azimut) für Himmel und Sonne
 *   weather_entity: weather.forecast_home   # Wolken, Regen, Schnee, Nebel, Gewitter, Wind
 *   show_stats: true                 # Satt-/Glück-Balken anzeigen
 *   height: 180                      # Mindesthöhe in px
 *
 * Der Blick geht nach Süden: Osten (Sonnenaufgang) links, Westen rechts. Mondphase und Mondstand
 * werden aus Datum und Standort (hass.config) berechnet.
 */
(() => {
  const VERSION = '0.2.2';

  const DEFAULTS = {
    name: 'Pika',
    entity: null,
    sleep_start: '21:00',
    sleep_end: '07:00',
    sun_entity: 'sun.sun',
    weather_entity: 'weather.forecast_home',
    show_stats: true,
    height: 180,
  };

  const RATE = { s: 5, g: 4 }; // Abnahme pro Stunde (satt, glücklich)
  const GAIN = { feed: 25, pet: 8 };
  const FLOWER_COLORS = ['#f6c945', '#f28fb1', '#ffffff', '#b99cf0', '#ff9f5a'];

  class Cancel extends Error {}
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const weighted = (list) => {
    const total = list.reduce((t, [w]) => t + w, 0);
    let r = Math.random() * total;
    for (const [w, v] of list) if ((r -= w) < 0) return v;
    return list[list.length - 1][1];
  };
  const minutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // ---------- Himmel ----------

  // Mondstand nach den vereinfachten Formeln aus "Astronomical Algorithms" (Meeus), auf ~1° genau.
  const RAD = Math.PI / 180;
  const moonPosition = (date, lat, lng) => {
    const d = date / 864e5 - 0.5 + 2440588 - 2451545;
    const L = RAD * (218.316 + 13.176396 * d);
    const M = RAD * (134.963 + 13.064993 * d);
    const F = RAD * (93.272 + 13.22935 * d);
    const l = L + RAD * 6.289 * Math.sin(M);
    const b = RAD * 5.128 * Math.sin(F);
    const e = RAD * 23.4397;
    const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    const H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - ra;
    const phi = RAD * lat;
    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    return { alt: alt / RAD, az: az / RAD + 180 }; // Azimut ab Norden
  };
  // 0 = Neumond, 0.5 = Vollmond (Bezug: Neumond 6. 1. 2000 18:14 UTC)
  const moonPhase = (date) => {
    const p = ((date - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1;
    return p < 0 ? p + 1 : p;
  };
  // Beleuchteter Teil der Mondscheibe (Nordhalbkugel: zunehmend rechts hell), viewBox 0 0 100 100
  const moonPath = (p) => {
    const rx = Math.abs(Math.cos(2 * Math.PI * p)) * 50;
    const waxing = p < 0.5;
    const outer = waxing ? 1 : 0;
    const term = waxing ? (p < 0.25 ? 0 : 1) : p > 0.75 ? 1 : 0;
    return `M50 0 A50 50 0 0 ${outer} 50 100 A${rx.toFixed(2)} 50 0 0 ${term} 50 0Z`;
  };
  // Position am Bildhimmel in %: Azimut 90° (Ost) links, 270° (West) rechts; Höhe 0° am Hügelrand.
  const skyPos = (az, alt) => ({
    x: clamp((az - 90) / 180, 0.04, 0.96) * 100,
    y: 56 - (clamp(alt, -12, 62) / 62) * 47,
  });

  // Wetterlage → Bedeckung in %, Niederschlag (Tropfen, Flocken)
  const WEATHER = {
    sunny: { cover: 5 }, 'clear-night': { cover: 5 }, partlycloudy: { cover: 45 },
    cloudy: { cover: 90 }, fog: { cover: 80, fog: true }, windy: { cover: 35, wind: true },
    'windy-variant': { cover: 60, wind: true }, exceptional: { cover: 70 },
    rainy: { cover: 85, rain: 40 }, pouring: { cover: 95, rain: 95, storm: true },
    hail: { cover: 90, rain: 60, storm: true },
    lightning: { cover: 90, flash: true, storm: true },
    'lightning-rainy': { cover: 95, rain: 70, flash: true, storm: true },
    snowy: { cover: 90, snow: 55 }, 'snowy-rainy': { cover: 90, rain: 25, snow: 25 },
  };

  const freshStats = () =>({ s: 80, st: Date.now(), g: 80, gt: Date.now() });
  const serialize = (st) =>
    [st.s.toFixed(1), Math.round(st.st / 1000), st.g.toFixed(1), Math.round(st.gt / 1000)].join(',');
  const parseStats = (str) => {
    const p = String(str ?? '').split(',').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
    return { s: p[0], st: p[1] * 1000, g: p[2], gt: p[3] * 1000 };
  };

  // ---------- Grafiken ----------

  const OUT = '#5a4030';
  // Körper als eine durchgehende Bohnenform (Pikas haben keinen sichtbaren Hals)
  const BODY = 'M30 90 C14 88 11 61 25 49 C37 37 55 31 67 28 C76 21 99 19 107 35 C113 48 112 66 104 78 C100 85 96 90 88 91 C70 94 46 94 30 90 Z';
  const EAR = (cx, cy, side) => `
    <g class="ear ear-${side}">
      <circle cx="${cx}" cy="${cy}" r="12.4" fill="${OUT}"/>
      <circle cx="${cx}" cy="${cy}" r="10.8" fill="#efe3d3"/>
      <circle cx="${cx}" cy="${cy + 0.8}" r="8.8" fill="url(#fur)"/>
      <ellipse cx="${cx}" cy="${cy + 1.8}" rx="4.9" ry="5.5" fill="#e3a990"/>
    </g>`;
  const EYE = (cx, side) => `
    <g class="eye eye-${side}">
      <ellipse cx="${cx}" cy="46" rx="3.9" ry="4.6" fill="#2a1a12"/>
      <circle cx="${cx + 1.4}" cy="44.2" r="1.5" fill="#fff"/>
      <circle cx="${cx - 0.9}" cy="47.9" r=".7" fill="#fff"/>
    </g>
    <path class="seye seye-${side}" d="M${cx - 3.8} 46.6 q3.8 3.2 7.6 0"/>
    <path class="heye" d="M${cx - 3.8} 47.6 q3.8 -3.8 7.6 0"/>`;

  const PIKA_SVG = `
  <svg class="pk" viewBox="0 0 120 100" aria-hidden="true">
    <defs>
      <radialGradient id="fur" gradientUnits="userSpaceOnUse" cx="88" cy="40" r="72">
        <stop offset="0" stop-color="#d0ad8d"/>
        <stop offset=".55" stop-color="#b08a68"/>
        <stop offset="1" stop-color="#8a664b"/>
      </radialGradient>
      <clipPath id="bodyclip"><path d="${BODY}"/></clipPath>
    </defs>
    <g class="all">
      ${EAR(75, 26, 'l')}${EAR(101, 27, 'r')}
      <g class="body">
        <path d="${BODY}" fill="url(#fur)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <g clip-path="url(#bodyclip)">
          <ellipse cx="82" cy="82" rx="20" ry="13" fill="#f0e2cf"/>
        </g>
      </g>
      <g class="feet" fill="#ecdcc6" stroke="${OUT}" stroke-width="1.6">
        <ellipse cx="33" cy="90.5" rx="9" ry="3.6"/>
        <ellipse cx="82" cy="91" rx="6" ry="3.4"/>
        <ellipse cx="97" cy="90.5" rx="6" ry="3.4"/>
      </g>
      <g class="face">
        <ellipse cx="77.5" cy="55" rx="4.2" ry="2.5" fill="#f2998c" opacity=".55"/>
        <ellipse cx="104" cy="54.5" rx="3.8" ry="2.4" fill="#f2998c" opacity=".55"/>
        ${EYE(82, 'l')}${EYE(99, 'r')}
        <path d="M84 56 L70 53.5 M84 57.6 L70 59.8 M98 56 L113 53.5 M98 57.6 L113 59.8"
              stroke="${OUT}" stroke-width=".7" opacity=".45" stroke-linecap="round"/>
        <g class="mouth-g">
          <ellipse cx="91" cy="55" rx="7.5" ry="5.2" fill="#f4e8d8"/>
          <path d="M88.7 51.6 q2.3 -1.1 4.6 0 q-.6 1.9 -2.3 2.5 q-1.7 -.6 -2.3 -2.5z" fill="#7a4438"/>
          <path d="M91 54.1 v1.5 M91 55.6 q-1.5 1.7 -3 .4 M91 55.6 q1.5 1.7 3 .4"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round"/>
        </g>
      </g>
      <g class="mfood">
        <path d="M92 58 Q100 58 106 61" stroke="#4f8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="99" cy="61" rx="4.2" ry="1.7" fill="#6bab4c" transform="rotate(22 99 61)"/>
        <circle class="mbloom" cx="108" cy="61" r="4.4"/>
        <circle cx="108" cy="61" r="1.6" fill="#e0a032" opacity=".8"/>
      </g>
      <g class="paws" fill="#ecdcc6" stroke="${OUT}" stroke-width="1.4">
        <ellipse cx="84" cy="61" rx="4" ry="5"/>
        <ellipse cx="98" cy="61" rx="4" ry="5"/>
      </g>
      <g class="cap">
        <path d="M77 28 Q80 12 62 9 Q91 0 103 27 Z" fill="#7c9be0" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="79" cy="17" r="1.3" fill="#fff" opacity=".8"/>
        <circle cx="88" cy="13" r="1.3" fill="#fff" opacity=".8"/>
        <circle cx="91" cy="22" r="1.3" fill="#fff" opacity=".8"/>
        <path d="M76 28 Q90 22 104 27" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="62" cy="9" r="4.2" fill="#fff" stroke="${OUT}" stroke-width="1.2"/>
      </g>
      <g class="scarf">
        <path d="M68 63 Q87 73 107 63" stroke="#d9534f" stroke-width="6.5" fill="none" stroke-linecap="round"/>
        <path d="M70 64 Q87 73.5 105 64.6" stroke="#f6f1ea" stroke-width="1.6" fill="none" stroke-dasharray="3 4"/>
        <path d="M73 66 L69 80 L76.5 80.6 L79 67.5Z" fill="#d9534f" stroke="#a83a37" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M70.5 75 L77.5 75.6" stroke="#f6f1ea" stroke-width="1.4"/>
      </g>
      <g class="brolly">
        <path d="M105 63 Q115 34 99 3" stroke="#4f8a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M52 14 Q68 -16 100 -10 Q127 -4 125 18 Q113 6 101 8 Q93 0 84 8 Q72 2 52 14Z"
              fill="#5fae4a" stroke="#3f7f31" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M56 11 Q87 -10 121 14" stroke="#8fd16f" stroke-width="1.1" fill="none" stroke-linecap="round"/>
        <ellipse cx="105" cy="63" rx="4" ry="4.6" fill="#ecdcc6" stroke="${OUT}" stroke-width="1.4"/>
      </g>
    </g>
  </svg>`;

  const ROCKS_SVG = `
  <svg viewBox="0 0 100 60" aria-hidden="true">
    <g stroke="#5c6166" stroke-width="1.6">
      <ellipse cx="50" cy="24" rx="20" ry="14" fill="#a7adb3"/>
      <ellipse cx="27" cy="40" rx="25" ry="17" fill="#979da4"/>
      <ellipse cx="74" cy="43" rx="22" ry="15" fill="#8e949b"/>
    </g>
    <ellipse cx="43" cy="17" rx="7" ry="3" fill="#fff" opacity=".25"/>
    <ellipse cx="19" cy="31" rx="8" ry="3.4" fill="#fff" opacity=".2"/>
    <ellipse cx="68" cy="35" rx="7" ry="3" fill="#fff" opacity=".2"/>
    <path d="M39 61 Q39 43 51 43 Q63 43 63 61Z" fill="#3a3632" stroke="#5c6166" stroke-width="1.4"/>
    <g stroke="#5c6166" stroke-width="1.6">
      <ellipse cx="12" cy="54" rx="13" ry="8" fill="#a3a9ae"/>
      <ellipse cx="89" cy="55" rx="12" ry="7" fill="#9aa0a6"/>
    </g>
    <g fill="#79b25d">
      <ellipse cx="60" cy="12" rx="5" ry="2.4"/><ellipse cx="33" cy="24.5" rx="4" ry="2"/><ellipse cx="86" cy="49" rx="4" ry="1.8"/>
    </g>
  </svg>`;

  const HAY_SVG = `
  <svg viewBox="0 0 60 40" aria-hidden="true">
    <path d="M2 40 Q3 15 30 10 Q57 15 58 40Z" fill="#dcbc6a" stroke="#a9853a" stroke-width="1.4"/>
    <g stroke="#b38c3c" stroke-width="1.1" stroke-linecap="round" fill="none">
      <path d="M12 34 Q18 24 26 20"/><path d="M22 37 Q30 27 40 22"/><path d="M38 36 Q44 30 50 28"/>
      <path d="M28 10 Q26 4 21 2"/><path d="M33 11 Q37 5 43 4"/><path d="M8 26 Q14 20 18 18"/>
    </g>
  </svg>`;

  // Grashalme vor Steinen und Heuhaufen, damit deren Unterkante im Gras verschwindet
  const TUFTS_SVG = () => {
    let d = '';
    for (let x = 0; x < 200; x += rnd(2.2, 3.6)) {
      const h = rnd(5, 12);
      const tip = x + 1.2 + rnd(-1.6, 1.6);
      d += `M${x.toFixed(1)} 12 Q${(x + 0.6).toFixed(1)} ${(12 - h / 2).toFixed(1)} ${tip.toFixed(1)} ${(12 - h).toFixed(1)}`
        + ` Q${(x + 1.6).toFixed(1)} ${(12 - h / 2).toFixed(1)} ${(x + 2.6).toFixed(1)} 12Z`;
    }
    return `<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><rect y="9" width="200" height="3"/><path d="${d}"/></svg>`;
  };

  const FLOWER_SVG =(c) => `
  <svg viewBox="0 0 20 30" aria-hidden="true">
    <path d="M10 30 Q9 20 10 11" stroke="#4f8a3a" stroke-width="1.6" fill="none"/>
    <ellipse cx="6.5" cy="22" rx="3.6" ry="1.5" fill="#6bab4c" transform="rotate(-30 6.5 22)"/>
    <g fill="${c}" stroke="rgba(0,0,0,.12)" stroke-width=".5">
      ${[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180;
        return `<circle cx="${(10 + Math.sin(r) * 3.7).toFixed(2)}" cy="${(9 - Math.cos(r) * 3.7).toFixed(2)}" r="3.3"/>`;
      }).join('')}
    </g>
    <circle cx="10" cy="9" r="2.3" fill="${c === '#f6c945' ? '#c47f1a' : '#f4b73a'}"/>
  </svg>`;

  const FOOD = {
    lz: {
      color: '#f7cf2e',
      svg: `<svg viewBox="0 0 30 40" aria-hidden="true">
        <path d="M15 40 Q14 28 15 16" stroke="#4f8a3a" stroke-width="2" fill="none"/>
        <path d="M14 39 Q4 36 3 26 Q8 30 10 28 Q7 33 14 37Z" fill="#5fa548"/>
        <path d="M16 39 Q27 36 27 27 Q22 31 20 29 Q23 34 16 37Z" fill="#6bb152"/>
        <circle cx="15" cy="12" r="9" fill="none" stroke="#f7cf2e" stroke-width="3.2" stroke-dasharray="1.7 1.1"/>
        <circle cx="15" cy="12" r="7.2" fill="#f7cf2e"/>
        <circle cx="15" cy="12" r="3.2" fill="#eeac1c"/>
      </svg>`,
    },
    klee: {
      color: '#e57fb0',
      svg: `<svg viewBox="0 0 30 40" aria-hidden="true">
        <path d="M15 40 Q15 30 15 18" stroke="#4f8a3a" stroke-width="2" fill="none"/>
        <g fill="#5fae4a" stroke="#3f7f31" stroke-width=".8">
          <ellipse cx="9" cy="31" rx="4" ry="3"/><ellipse cx="21" cy="31" rx="4" ry="3"/><ellipse cx="15" cy="27" rx="3" ry="4"/>
        </g>
        <ellipse cx="15" cy="12" rx="7.5" ry="8.5" fill="#e57fb0" stroke="#c45c90" stroke-width="1"/>
        <g stroke="#c45c90" stroke-width=".9" fill="none" stroke-linecap="round">
          <path d="M11 8 l1.5 2.5 M15 6 v3 M19 8 l-1.5 2.5 M10.5 13 l2 1.5 M19.5 13 l-2 1.5 M15 12 v3"/>
        </g>
      </svg>`,
    },
  };

  const ICON_LEAF = `<svg viewBox="0 0 24 24"><path fill="#6bb152" d="M17 8C8 10 5.9 16.2 3.8 21.3l1.9.7 1-2.3c.5.2 1 .3 1.3.3C19 20 22 3 22 3c-1 2-8 2.3-13 3.3S2 11.5 2 13.5s1.8 3.8 1.8 3.8C7 8 17 8 17 8z"/></svg>`;
  const ICON_HEART = `<svg viewBox="0 0 24 24"><path fill="#f07a95" d="M12 21.4l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.5z"/></svg>`;

  // ---------- Stil ----------

  const STYLE = `
  :host { display: block; height: 100%; }
  ha-card { display: block; height: 100%; overflow: hidden; background: none; border-radius: var(--ha-card-border-radius, 12px); }
  .scene {
    position: relative; height: 100%; overflow: hidden; border-radius: inherit;
    user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, sans-serif));
    --h1: #a9d68f; --h2: #86c46b; --h3: #7ab960;
  }
  .scene.dusk { --h1: #8fa98a; --h2: #6e9562; --h3: #648c58; }
  .scene.night { --h1: #2c4547; --h2: #26433a; --h3: #223d34; }

  .sky { position: absolute; inset: 0; opacity: 0; transition: opacity 2.5s; }
  .sky-day { background: linear-gradient(#93cdf0, #dff1fa 78%); }
  .sky-dusk { background: linear-gradient(#5f62ad, #d996b2 55%, #f7c48e 88%); }
  .sky-night { background: linear-gradient(#0d1734, #27386a 85%); }
  .day .sky-day, .dusk .sky-dusk, .night .sky-night { opacity: 1; }
  .sky-grey { background: linear-gradient(#8f9eab, #d3dbe1 80%); }
  .dusk .sky-grey { background: linear-gradient(#5d6079, #b1a3ad 80%); }
  .night .sky-grey { background: linear-gradient(#141b2b, #2b3449 85%); }
  .overcast .sky-grey { opacity: .9; }

  /* Sonne und Mond: left/top setzt das Skript nach dem echten Stand, Wechsel gleiten langsam */
  .sun, .moon {
    position: absolute; left: 80%; top: 20%; aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%);
    opacity: 0; transition: opacity 2.5s, left 90s linear, top 90s linear, background 2.5s;
  }
  .sun {
    width: calc(var(--H) * .15);
    background: radial-gradient(#fff8d2, #ffd75a 70%); box-shadow: 0 0 22px 8px rgba(255, 222, 110, .45);
  }
  .day .sun, .dusk .sun { opacity: 1; }
  .sun-low .sun { background: radial-gradient(#ffe0b0, #ff9a5c 70%); box-shadow: 0 0 22px 8px rgba(255, 150, 90, .4); }
  .overcast .sun { opacity: .25; }
  .sun-down .sun { opacity: 0; }
  .moon { width: calc(var(--H) * .12); filter: drop-shadow(0 0 6px rgba(244, 239, 207, .55)); }
  .moon svg { display: block; width: 100%; height: 100%; }
  .moon-lit { fill: #f4efcf; }
  .moon-dark { fill: rgba(44, 56, 92, .55); }
  .day .moon-dark, .dusk .moon-dark { fill: rgba(255, 255, 255, .12); }
  .moon-up.night .moon, .moon-up.dusk .moon { opacity: 1; }
  .moon-up.day .moon { opacity: .5; filter: none; }
  .moon-up.overcast .moon { opacity: .2; }
  .stars i {
    position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff;
    opacity: 0; transition: opacity 3s;
  }
  .night .stars i { opacity: var(--starop, .85); animation: twinkle 3s ease-in-out infinite alternate; }
  .dusk .stars i:nth-child(3n) { opacity: calc(var(--starop, .85) * .6); }
  @keyframes twinkle { to { opacity: .25; } }

  /* Wolken: das Skript schaltet so viele ein, wie es die Bedeckung verlangt; Wind macht sie schneller */
  .cloud {
    position: absolute; left: calc(var(--H) * -.6); width: calc(var(--H) * .42 * var(--s)); height: calc(var(--H) * .1 * var(--s));
    border-radius: 999px; background: var(--cloud, #fff); opacity: 0; transition: opacity 3s, background 3s;
    animation: drift calc(var(--d) * var(--cs, 1)) linear infinite; animation-delay: calc(var(--dl) * var(--cs, 1));
  }
  .cloud::before, .cloud::after { content: ''; position: absolute; background: inherit; border-radius: 50%; }
  .cloud::before { width: 45%; aspect-ratio: 1; left: 15%; bottom: 30%; }
  .cloud::after { width: 32%; aspect-ratio: 1; left: 50%; bottom: 35%; }
  .wind-w .cloud { animation-direction: reverse; }
  .cloud.on { opacity: .92; }
  .dusk .cloud.on { opacity: .65; }
  .night .cloud.on { opacity: .5; }
  .scene.dusk { --cloud: #f1cfdd; }
  .scene.night { --cloud: #4a5674; }
  .scene.overcast { --cloud: #e1e6ea; }
  .scene.storm { --cloud: #a9b2ba; }
  .scene.dusk.overcast { --cloud: #b9aab8; }
  .scene.night.overcast { --cloud: #3a4560; }
  @keyframes drift { to { transform: translateX(calc(var(--W) + var(--H) * 1.2)); } }

  .hills { position: absolute; inset: 0; width: 100%; height: 100%; transition: filter 2.5s; }
  .hills .h1 { fill: var(--h1); transition: fill 2.5s; }
  .hills .h2 { fill: var(--h2); transition: fill 2.5s; }
  .scene.snowcover { --h1: #e9eff3; --h2: #dfe7ed; --h3: #cfdbe3; }
  .scene.dusk.snowcover { --h1: #b9bdd0; --h2: #aeb4c8; --h3: #a1a9bf; }
  .scene.night.snowcover { --h1: #55627c; --h2: #4c5974; --h3: #44516b; }
  .snowcover .flowers { opacity: 0; }

  .land, .flowers, .foods { position: absolute; inset: 0; transition: filter 2.5s, opacity 2s; }
  .day.overcast .land, .day.overcast .flowers, .day.overcast .hills { filter: brightness(.9) saturate(.8); }
  .dusk .land, .dusk .flowers, .dusk .foods { filter: brightness(.85) saturate(.85); }
  .night .land, .night .flowers, .night .foods { filter: brightness(.5) saturate(.6); }
  .rocks { position: absolute; left: var(--rl); width: var(--rw); bottom: calc(var(--H) - var(--gy) - var(--rw) * .04); }
  .rocks svg, .hay svg, .flower svg, .food svg { display: block; width: 100%; height: auto; overflow: visible; }
  .tufts {
    position: absolute; left: var(--rl); width: calc(var(--hl) + var(--hw) - var(--rl) + var(--H) * .04);
    bottom: calc(var(--H) - var(--gy) - var(--H) * .05); height: calc(var(--H) * .065);
  }
  .tufts svg { display: block; width: 100%; height: 100%; fill: var(--h3); transition: fill 2.5s; }
  .hay {
    position: absolute; left: var(--hl); width: var(--hw); bottom: calc(var(--H) - var(--gy) - 2px);
    transform-origin: 50% 100%; transform: scale(var(--hs, .6)); transition: transform .5s cubic-bezier(.3, 1.6, .5, 1);
  }
  .flower {
    position: absolute; left: calc(var(--xf) * var(--W) - var(--fw) / 2); bottom: calc(var(--H) - var(--gy) - 2px);
    width: var(--fw); transform-origin: 50% 100%; animation: sway 3.6s ease-in-out infinite alternate;
  }
  .flower.grow { animation: grow 1.4s ease-out, sway 3.6s 1.4s ease-in-out infinite alternate; }
  .flower.picked { animation: picked .35s forwards; }
  @keyframes sway { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  .windy .flower { animation: sway-wind 1.1s ease-in-out infinite alternate; }
  @keyframes sway-wind { from { transform: rotate(var(--sw1, -2deg)); } to { transform: rotate(var(--sw2, 14deg)); } }

  /* Regen, Schnee, Nebel, Blitz */
  .precip { position: absolute; inset: -10% -25%; pointer-events: none; z-index: 4; transform: skewX(var(--slant, 0deg)); }
  .precip i { position: absolute; top: 0; }
  .precip .r {
    width: 1.5px; height: calc(var(--H) * .08); border-radius: 1px;
    background: linear-gradient(rgba(255, 255, 255, 0), rgba(215, 232, 255, .85)); animation: rain .6s linear infinite;
  }
  @keyframes rain { from { transform: translateY(-100%); } to { transform: translateY(calc(var(--H) * 1.25)); } }
  .precip .s { border-radius: 50%; background: #fff; animation: snow 7s linear infinite; }
  @keyframes snow {
    0% { transform: translate(0, -10px); }
    25% { transform: translate(8px, calc(var(--H) * .3)); }
    50% { transform: translate(-6px, calc(var(--H) * .6)); }
    75% { transform: translate(6px, calc(var(--H) * .9)); }
    100% { transform: translate(0, calc(var(--H) * 1.22)); }
  }
  .fog { position: absolute; inset: 0; pointer-events: none; z-index: 4; opacity: 0; transition: opacity 3s; }
  .foggy .fog { opacity: 1; }
  .fog i {
    position: absolute; left: -50%; width: 200%; height: 50%;
    background: radial-gradient(closest-side, rgba(236, 240, 244, .8), rgba(236, 240, 244, 0));
    animation: fogdrift 40s ease-in-out infinite alternate;
  }
  .fog i:nth-child(1) { top: 28%; }
  .fog i:nth-child(2) { top: 55%; animation-duration: 55s; animation-delay: -20s; }
  .night .fog i { background: radial-gradient(closest-side, rgba(120, 132, 155, .55), rgba(120, 132, 155, 0)); }
  @keyframes fogdrift { to { transform: translateX(22%); } }
  .flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 4; }
  .flash.go { animation: flash .7s; }
  @keyframes flash { 8% { opacity: .75; } 16% { opacity: .1; } 26% { opacity: .55; } }
  @keyframes grow { from { transform: scale(0); } }
  @keyframes picked { to { transform: translateY(-30%) scale(.2); opacity: 0; } }
  .food {
    position: absolute; left: calc(var(--xf) * var(--W) - var(--dw) / 2); bottom: calc(var(--H) - var(--gy) - 3px);
    width: var(--dw); transform-origin: 50% 100%;
  }
  .food.drop { animation: drop .8s cubic-bezier(.45, 0, .7, 1) both; }
  .food.gone { animation: picked .3s forwards; }
  @keyframes drop {
    0% { transform: translateY(calc(var(--gy) * -1)) rotate(-40deg); }
    70% { transform: translateY(0) rotate(8deg) scale(1.05, .9); }
    85% { transform: translateY(-10%) rotate(-3deg); }
    100% { transform: none; }
  }

  .ff i {
    position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #fffbb0;
    box-shadow: 0 0 6px 2px rgba(247, 240, 138, .8); opacity: 0; transition: opacity 3s;
    animation: fly 9s ease-in-out infinite alternate, glow 1.8s ease-in-out infinite alternate;
  }
  .night.summer .ff i { opacity: 1; }
  @keyframes fly {
    33% { transform: translate(calc(var(--H) * .25), calc(var(--H) * -.12)); }
    66% { transform: translate(calc(var(--H) * -.1), calc(var(--H) * -.22)); }
    100% { transform: translate(calc(var(--H) * .15), calc(var(--H) * .05)); }
  }
  @keyframes glow { from { filter: brightness(.4); } }

  /* ---- Pika ---- */
  .pika {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: 3; cursor: pointer; will-change: transform;
  }
  .shadow {
    position: absolute; left: 12%; right: 12%; bottom: 0; height: 10%; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(0, 0, 0, .22), transparent);
  }
  .flip, .jump, .hop { position: absolute; inset: 0; transform-origin: 50% 100%; }
  .flip { transition: transform .25s; }
  .left .flip { transform: scaleX(-1); }
  .pk { display: block; width: 100%; height: 100%; overflow: visible; transition: filter 2.5s; }
  .night .pk { filter: brightness(.8) saturate(.85); }

  .walking .hop { animation: hop .36s ease-in-out infinite; }
  @keyframes hop {
    0%, 100% { transform: translateY(0) scale(1.03, .97); }
    50% { transform: translateY(-10%) scale(.97, 1.03); }
  }
  .jump.hop1 { animation: jump .6s cubic-bezier(.3, .7, .4, 1); }
  @keyframes jump {
    15% { transform: scale(1.08, .9); }
    45% { transform: translateY(-30%) scale(.95, 1.06); }
    75% { transform: translateY(0) scale(1.06, .94); }
  }
  .jump.binky { animation: binky .9s ease-in-out; }
  @keyframes binky {
    12% { transform: scale(1.1, .88); }
    40% { transform: translateY(-40%) rotate(-14deg); }
    60% { transform: translateY(-26%) rotate(10deg); }
    82% { transform: translateY(0) scale(1.06, .94); }
  }
  .stretch .hop { animation: stretch 1.2s ease-in-out; }
  @keyframes stretch {
    30% { transform: scale(1.14, .84); }
    60% { transform: scale(.94, 1.08); }
  }

  .all { transform-box: fill-box; transform-origin: 50% 100%; animation: breathe 3.4s ease-in-out infinite; }
  @keyframes breathe { 50% { transform: scale(1.012, 1.025); } }
  .sleeping .all { animation: breathe-deep 4.6s ease-in-out infinite; }
  @keyframes breathe-deep { 0%, 100% { transform: scale(1.03, .94); } 50% { transform: scale(1.06, .97); } }

  .ear { transform-box: fill-box; transform-origin: 50% 95%; transition: transform .45s; }
  .look-up .ear { transform: translateY(-1.5px); }
  .sad .ear-l { transform: rotate(-14deg); }
  .sad .ear-r { transform: rotate(14deg); }
  .sleeping .ear-l { transform: rotate(-30deg); }
  .sleeping .ear-r { transform: rotate(28deg); }
  .twitch-l .ear-l { animation: twitch .5s; }
  .twitch-r .ear-r { animation: twitch .5s reverse; }
  @keyframes twitch { 30% { transform: rotate(-12deg); } 65% { transform: rotate(7deg); } }

  .face { transition: transform .35s ease; }
  .look-f .face { transform: translateX(3px); }
  .look-b .face { transform: translateX(-4px); }
  .look-up .face { transform: translate(1px, -2.5px); }

  .eye { transform-box: fill-box; transform-origin: 50% 50%; transition: transform .07s; }
  .blink .eye { transform: scaleY(.12); }
  .seye, .heye { display: none; fill: none; stroke: #2a1a12; stroke-width: 1.8; stroke-linecap: round; }
  .sleeping .eye, .groom .eye, .happy .eye { display: none; }
  .sleeping .seye, .groom .seye { display: inline; }
  .happy .seye { display: none; }
  .happy .heye { display: inline; }
  .sleeping.peek .eye-r { display: inline; }
  .sleeping.peek .seye-r { display: none; }

  .mfood, .paws, .cap, .scarf, .brolly { display: none; }
  .cold .scarf, .wet .brolly { display: inline; }
  .sleeping .brolly { display: none; }
  .brolly { transform-box: fill-box; transform-origin: 70% 100%; animation: brolly 2.6s ease-in-out infinite alternate; }
  @keyframes brolly { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
  .carry .mfood, .eating .mfood { display: inline; }
  .mbloom { fill: var(--mf, #f6c945); stroke: rgba(0, 0, 0, .15); stroke-width: .5; }
  .mfood.shrink { transform-box: fill-box; transform-origin: 0% 30%; animation: shrink var(--eat, 3s) linear forwards; }
  @keyframes shrink { to { transform: scale(.1); opacity: .2; } }
  .mouth-g { transform-box: fill-box; transform-origin: 50% 0%; }
  .eating .mouth-g { animation: chew .26s ease-in-out infinite; }
  @keyframes chew { 50% { transform: translateY(.9px) scale(1.05, .88); } }
  .groom .paws { display: inline; transform-box: fill-box; animation: rub .3s ease-in-out infinite alternate; }
  @keyframes rub { from { transform: translateY(1px); } to { transform: translateY(-6px); } }
  .sleeping .cap { display: inline; }

  .anchor { position: absolute; left: 75%; top: 20%; width: 0; height: 0; }
  .left .anchor { left: 25%; }
  .zzz { display: none; }
  .sleeping .zzz { display: block; }
  .zzz span {
    position: absolute; left: 0; bottom: 0; font-weight: 800; color: #fff; opacity: 0;
    font-size: calc(var(--ph) * .17); text-shadow: 0 1px 3px rgba(0, 0, 0, .45);
    animation: zz 3.6s linear infinite;
  }
  .zzz span:nth-child(2) { animation-delay: 1.2s; }
  .zzz span:nth-child(3) { animation-delay: 2.4s; }
  @keyframes zz {
    0% { transform: translate(0, 0) scale(.5); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(calc(var(--ph) * .35), calc(var(--ph) * -.6)) scale(1.2); opacity: 0; }
  }
  .bubble {
    position: absolute; left: 0; bottom: 4px; transform: translateX(-35%) scale(.3); transform-origin: 35% 100%;
    opacity: 0; transition: transform .28s cubic-bezier(.3, 1.6, .5, 1), opacity .2s;
    background: #fff; color: #4a3a2c; border-radius: 999px; padding: .15em .6em; white-space: nowrap;
    font-size: calc(var(--ph) * .15); font-weight: 800; box-shadow: 0 2px 6px rgba(0, 0, 0, .18); pointer-events: none;
  }
  .bubble.on { opacity: 1; transform: translateX(-35%) scale(1); }
  .say::after {
    content: ''; position: absolute; left: 30%; bottom: -5px; border: 5px solid transparent;
    border-top-color: #fff; border-bottom: 0;
  }
  .think { padding: .3em .45em; bottom: 14px; }
  .think svg { display: block; width: calc(var(--ph) * .2); height: calc(var(--ph) * .2); }
  .think::before, .think::after { content: ''; position: absolute; background: #fff; border-radius: 50%; }
  .think::before { width: 8px; height: 8px; left: 28%; bottom: -8px; }
  .think::after { width: 4px; height: 4px; left: 22%; bottom: -14px; }

  .fx { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
  .heart {
    position: absolute; width: calc(var(--ph) * .2); margin-left: calc(var(--ph) * -.1);
    animation: heart 1.5s ease-out forwards;
  }
  .heart svg { display: block; width: 100%; height: auto; }
  @keyframes heart {
    0% { transform: translate(0, 0) scale(.3); opacity: 0; }
    15% { transform: translate(calc(var(--dx) * .2), calc(var(--ph) * -.08)) scale(1.1); opacity: 1; }
    100% { transform: translate(var(--dx), calc(var(--ph) * -.75)) scale(.8); opacity: 0; }
  }

  .stats {
    position: absolute; left: 10px; top: 10px; z-index: 5; display: flex; align-items: center; gap: 10px;
    padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700;
    background: rgba(255, 255, 255, .6); color: #4a3a2c; backdrop-filter: blur(4px);
    transition: background 2.5s, color 2.5s;
  }
  .stats[hidden] { display: none; }
  .night .stats { background: rgba(15, 22, 45, .55); color: #e8e6f5; }
  .st { display: flex; align-items: center; gap: 4px; }
  .st svg { width: 14px; height: 14px; }
  .st i { display: block; width: 34px; height: 6px; border-radius: 3px; background: rgba(0, 0, 0, .14); overflow: hidden; }
  .night .st i { background: rgba(255, 255, 255, .18); }
  .st b { display: block; height: 100%; border-radius: 3px; transition: width .6s; }
  .bar-s { background: #7cc35a; }
  .bar-g { background: #f07a95; }
  .st.low b { background: #e8a33a; }

  .feed {
    position: absolute; right: 10px; bottom: 10px; z-index: 5; width: 44px; height: 44px; padding: 6px;
    border: none; border-radius: 50%; cursor: pointer; background: rgba(255, 255, 255, .75);
    box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s;
  }
  .feed:active { transform: scale(.88); }
  .feed svg { display: block; width: 100%; height: 100%; }
  .night .feed { background: rgba(15, 22, 45, .55); }
  .feed.no { animation: no .4s; }
  @keyframes no { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  `;

  // ---------- Karte ----------

  class PikaPetCard extends HTMLElement {
    static getStubConfig() {
      return { name: 'Pika' };
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._runId = 0;
      this._x = 0;
      this._dir = 1;
      this._flowers = [];
      this._foods = [];
      this._asleep = false;
      this._stats = null;
      this._elev = null;
      this._az = null;
      this._wx = {};
      this._timers = [];
      this._loops = [];
      this._dbgSleep = null;
      this._dbgElev = null;
    }

    setConfig(config) {
      this._cfg = { ...DEFAULTS, ...(config || {}) };
      if (!this._el) this._build();
      this._el.name.textContent = this._cfg.name;
      this._el.stats.hidden = !this._cfg.show_stats;
      this._el.scene.style.minHeight = `${Number(this._cfg.height) || DEFAULTS.height}px`;
      if (!this._cfg.entity) this._loadLocal();
      this._renderStats();
      if (this.isConnected) this._attach();
    }

    set hass(hass) {
      this._hass = hass;
      const c = this._cfg;
      if (c.entity) {
        const st = hass.states[c.entity]?.state;
        if (st !== this._lastEntityState) {
          this._lastEntityState = st;
          const parsed = parseStats(st);
          if (parsed) {
            if (!this._pendingWrite) this._stats = parsed;
          } else if (st !== undefined && !this._stats) {
            // Helfer neu angelegt oder leer: mit Startwerten füllen
            this._stats = freshStats();
            this._save();
          }
          this._renderStats();
        }
      }
      const sun = hass.states[c.sun_entity];
      const elev = Number(sun?.attributes?.elevation);
      const az = Number(sun?.attributes?.azimuth);
      this._elev = sun ? (Number.isFinite(elev) ? elev : sun.state === 'above_horizon' ? 10 : -10) : null;
      this._az = Number.isFinite(az) ? az : null;
      const w = hass.states[c.weather_entity];
      if (w !== this._lastWeather) {
        this._lastWeather = w;
        this._readWeather(w);
      }
      this._updateSky();
    }

    getCardSize() {
      return 4;
    }

    getGridOptions() {
      return { columns: 12, rows: 4, min_rows: 3, min_columns: 6 };
    }

    connectedCallback() {
      if (this._el) this._attach();
    }

    disconnectedCallback() {
      this._detach();
    }

    _attach() {
      if (this._attached) return;
      this._attached = true;
      this._ro = new ResizeObserver(() => this._layout());
      this._ro.observe(this._el.scene);
      this._onVis = () => (document.hidden ? this._stop() : this._start());
      document.addEventListener('visibilitychange', this._onVis);
      this._loop(() => this._blink(), 2200, 6000);
      this._loop(() => this._twitch(), 5000, 13000);
      this._loop(() => this._lightning(), 6000, 16000);
      this._timers.push(setInterval(() => this._tick(), 20000));
      this._timers.push(setInterval(() => this._regrow(), 150000));
      this._layout();
      this._start();
    }

    _detach() {
      if (!this._attached) return;
      this._attached = false;
      this._stop();
      this._ro?.disconnect();
      document.removeEventListener('visibilitychange', this._onVis);
      this._timers.forEach((t) => clearInterval(t));
      this._timers = [];
      this._loops.forEach((h) => clearTimeout(h.t));
      this._loops = [];
    }

    // ---------- Aufbau ----------

    _build() {
      const stars = Array.from({ length: 24 }, () =>
        `<i style="left:${rnd(2, 98).toFixed(1)}%;top:${rnd(3, 55).toFixed(1)}%;animation-delay:${rnd(0, 3).toFixed(2)}s;transform:scale(${rnd(0.7, 1.3).toFixed(2)})"></i>`
      ).join('');
      const flies = Array.from({ length: 6 }, () =>
        `<i style="left:${rnd(25, 90).toFixed(1)}%;top:${rnd(45, 80).toFixed(1)}%;animation-delay:${rnd(-9, 0).toFixed(2)}s,${rnd(0, 1.8).toFixed(2)}s"></i>`
      ).join('');
      // Sechs Wolken in verschiedenen Höhen, Größen und Geschwindigkeiten (Dauer --d, Versatz --dl)
      const clouds = [
        [14, 1, 110, -45], [32, 0.72, 150, -100], [8, 0.85, 130, -15],
        [24, 1.15, 95, -70], [40, 0.6, 170, -140], [18, 0.95, 120, -95],
      ].map(([top, s, d, dl]) => `<div class="cloud" style="top:${top}%;--s:${s};--d:${d}s;--dl:${dl}s"></div>`).join('');

      this.shadowRoot.innerHTML = `
        <style>${STYLE}</style>
        <ha-card>
          <div class="scene day">
            <div class="sky sky-day"></div><div class="sky sky-dusk"></div><div class="sky sky-night"></div>
            <div class="sky sky-grey"></div>
            <div class="stars">${stars}</div>
            <div class="sun"></div>
            <div class="moon"><svg viewBox="0 0 100 100"><circle class="moon-dark" cx="50" cy="50" r="50"/><path class="moon-lit"/></svg></div>
            <div class="clouds">${clouds}</div>
            <svg class="hills" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path class="h1" d="M0 64 Q16 50 36 60 T72 55 T100 50 V100 H0Z"/>
              <path class="h2" d="M0 83 Q25 79 50 83 T100 82 V100 H0Z"/>
            </svg>
            <div class="land">
              <div class="rocks">${ROCKS_SVG}</div>
              <div class="hay">${HAY_SVG}</div>
              <div class="tufts">${TUFTS_SVG()}</div>
            </div>
            <div class="flowers"></div>
            <div class="foods"></div>
            <div class="ff">${flies}</div>
            <div class="pika" role="button" aria-label="Streicheln">
              <div class="shadow"></div>
              <div class="flip"><div class="jump"><div class="hop">${PIKA_SVG}</div></div></div>
              <div class="anchor">
                <div class="zzz"><span>z</span><span>z</span><span>Z</span></div>
                <div class="bubble say"></div>
                <div class="bubble think">${FOOD.lz.svg}</div>
              </div>
            </div>
            <div class="precip"></div>
            <div class="fog"><i></i><i></i></div>
            <div class="flash"></div>
            <div class="fx"></div>
            <div class="stats">
              <span class="nm"></span>
              <span class="st st-s" title="Satt">${ICON_LEAF}<i><b class="bar-s"></b></i></span>
              <span class="st st-g" title="Glücklich">${ICON_HEART}<i><b class="bar-g"></b></i></span>
            </div>
            <button class="feed" title="Füttern" aria-label="Füttern">${FOOD.lz.svg}</button>
          </div>
        </ha-card>`;

      const $ = (s) => this.shadowRoot.querySelector(s);
      this._el = {
        scene: $('.scene'), pika: $('.pika'), jump: $('.jump'), mfood: $('.mfood'),
        flowers: $('.flowers'), foods: $('.foods'), fx: $('.fx'), hay: $('.hay'),
        stats: $('.stats'), name: $('.nm'), barS: $('.bar-s'), barG: $('.bar-g'),
        stS: $('.st-s'), stG: $('.st-g'), feed: $('.feed'), say: $('.say'), think: $('.think'),
        sun: $('.sun'), moon: $('.moon'), moonLit: $('.moon-lit'), clouds: [...this.shadowRoot.querySelectorAll('.cloud')],
        precip: $('.precip'), flash: $('.flash'),
      };
      this._el.pika.addEventListener('click', (e) => (e.stopPropagation(), this._onPet()));
      this._el.feed.addEventListener('click', (e) => (e.stopPropagation(), this._onFeed()));
      this._el.scene.addEventListener('click', (e) => this._onLookAt(e));
      this._loadHay();
    }

    _layout() {
      const W = this._el.scene.clientWidth;
      const H = this._el.scene.clientHeight;
      if (!W || !H) return;
      const first = !this._g;
      const ratio = first ? 1 : W / this._W;
      this._W = W;
      this._H = H;
      const pH = clamp(H * 0.4, 48, 170);
      const pW = pH * 1.2;
      const gy = H * 0.9;
      const rW = H * 0.62;
      const rL = -rW * 0.12;
      const hW = H * 0.26;
      const hL = rL + rW * 0.84;
      this._g = {
        pH, pW, gy,
        home: rL + rW * 0.51,
        hay: hL + hW / 2,
        fMin: (hL + hW + pW * 0.3) / W,
        fMax: (W - 16) / W,
      };
      const vars = { W, H, pw: pW, ph: pH, gy, rw: rW, rl: rL, hw: hW, hl: hL, fw: H * 0.085, dw: H * 0.13 };
      for (const [k, v] of Object.entries(vars)) this._el.scene.style.setProperty(`--${k}`, `${v}px`);

      if (first) {
        this._initFlowers();
        if (this._sleepTime()) {
          this._asleep = true;
          this._el.pika.classList.add('sleeping');
          this._setX(this._g.home, true);
        } else {
          this._setX(rnd(this._g.home, W * 0.7), true);
        }
        this._updateSky();
        this._start();
      } else {
        this._setX(this._x * ratio, true);
      }
    }

    // ---------- Lebensschleife ----------

    _start() {
      if (this._running || !this.isConnected || document.hidden || !this._g) return;
      this._running = true;
      const run = ++this._runId;
      (async () => {
        while (run === this._runId) {
          this._ac = new AbortController();
          try {
            await this._step();
          } catch (e) {
            if (!(e instanceof Cancel)) {
              console.warn('pika-pet-card:', e);
              await pause(2000);
            }
          }
          if (run !== this._runId) return;
          this._cleanup();
          await pause(40);
        }
      })();
    }

    _stop() {
      this._running = false;
      this._runId++;
      this._ac?.abort();
      if (this._el) this._cleanup();
    }

    _interrupt() {
      this._ac?.abort();
    }

    _wait(ms) {
      const sig = this._ac.signal;
      return new Promise((resolve, reject) => {
        if (sig.aborted) return reject(new Cancel());
        const onAbort = () => (clearTimeout(t), reject(new Cancel()));
        const t = setTimeout(() => (sig.removeEventListener('abort', onAbort), resolve()), ms);
        sig.addEventListener('abort', onAbort, { once: true });
      });
    }

    _cleanup() {
      const p = this._el.pika;
      if (p.classList.contains('walking')) this._freeze();
      p.classList.remove('walking', 'eating', 'groom', 'carry', 'look-f', 'look-b', 'look-up', 'happy');
      this._mouth(null);
      this._bubble(this._el.think, false);
      this._action = null;
    }

    async _step() {
      if (!this._g) return this._wait(500);
      const sleepy = this._sleepTime();
      if (sleepy && !this._asleep) return this._run('goSleep');
      if (!sleepy && this._asleep) return this._run('wakeUp');
      if (this._asleep) return this._wait(60000);

      const food = this._foods.find((f) => f.landed);
      if (food) return this._run('eatFood', food);

      const s = this._get('s');
      const g = this._get('g');
      this._el.pika.classList.toggle('sad', g < 25 || s < 15);
      const wx = this._wx;
      if (wx.shelter && Math.abs(this._x - this._g.home) > this._g.pW * 0.4) return this._run('shelter');
      // Unter Schnee gibt es keine Blumen, bei Regen bleibt das Heu trocken (kein Sammeln)
      const hasFlowers = this._flowers.length > 0 && !wx.snowcover;
      const act = weighted([
        [3, 'idle'],
        [3, 'look'],
        [wx.shelter ? 0 : 3, 'wander'],
        [hasFlowers && !wx.shelter ? (s < 50 ? 3 : 1.2) : 0, 'nibble'],
        [hasFlowers && !wx.wet && this._hay < 12 ? 1.4 : 0, 'gather'],
        [wx.snowcover || wx.wet ? 1.2 : 0, 'haySnack'],
        [wx.wet ? 0 : 1.4, 'groom'], // eine Pfote hält bei Regen das Blatt
        [0.8, 'squeak'],
        [wx.wet ? 0 : g > 70 ? 1.2 : g > 40 ? 0.4 : 0, 'binky'],
        [s < 30 ? 3 : 0, 'hungry'],
      ]);
      return this._run(act);
    }

    _run(name, ...args) {
      this._action = name;
      return this['_' + name](...args);
    }

    // ---------- Aktionen ----------

    async _idle() {
      await this._wait(rnd(2000, 5000));
    }

    async _look() {
      const n = 1 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        const c = pick(['look-f', 'look-b', 'look-up']);
        this._el.pika.classList.add(c);
        await this._wait(rnd(700, 1700));
        this._el.pika.classList.remove(c);
        await this._wait(rnd(200, 600));
      }
    }

    async _wander() {
      const { pW, home } = this._g;
      let x = Math.random() < 0.3
        ? rnd(home, this._W)
        : this._x + rnd(pW * 0.6, Math.max(pW, this._W * 0.4)) * pick([-1, 1]);
      // Bei Regen nicht weit weg vom Bau
      if (this._wx.wet) x = rnd(home, home + this._W * 0.35);
      await this._walkTo(x);
      await this._wait(rnd(400, 1400));
    }

    async _shelter() {
      await this._walkTo(this._g.home, 1.3);
      this._face(1);
      await this._wait(rnd(800, 1500));
    }

    async _haySnack() {
      await this._walkTo(this._g.hay + this._g.pW * 0.34);
      this._face(-1);
      await this._wait(300);
      await this._eat('#dcbc6a', rnd(2500, 3500));
      await this._wait(rnd(300, 900));
    }

    async _nibble() {
      const f = this._nearestFlower();
      if (!f) return;
      await this._approach(f.xf * this._W);
      this._pickFlower(f);
      await this._eat(f.color, rnd(2500, 4000));
      await this._wait(rnd(300, 900));
    }

    async _gather() {
      const f = pick(this._flowers);
      await this._approach(f.xf * this._W);
      this._pickFlower(f);
      this._mouth(f.color);
      this._el.pika.classList.add('carry');
      await this._walkTo(this._g.hay + this._g.pW * 0.34);
      this._face(-1);
      await this._wait(450);
      this._el.pika.classList.remove('carry');
      this._addHay();
      await this._wait(900);
    }

    async _groom() {
      this._el.pika.classList.add('groom');
      await this._wait(rnd(1800, 3200));
    }

    async _squeak() {
      this._say(pick(['iiep!', 'iiep!', 'mip!', 'iiiep!']));
      this._jump('hop1');
      await this._wait(1600);
    }

    async _binky() {
      this._jump('binky');
      await this._wait(1100);
    }

    async _hungry() {
      this._bubble(this._el.think, true);
      this._el.pika.classList.add('look-up');
      await this._wait(3500);
    }

    async _eatFood(food) {
      this._say('!');
      await this._wait(400);
      await this._approach(food.xf * this._W, 1.6);
      if (!this._foods.includes(food)) return;
      this._removeFood(food);
      await this._eat(FOOD[food.kind].color, 3800);
      this._happy();
      this._jump('hop1');
      await this._wait(1300);
    }

    async _goSleep() {
      this._say('*gähn*');
      await this._wait(1200);
      await this._walkTo(this._g.home, 0.7);
      this._face(1);
      await this._wait(500);
      this._asleep = true;
      this._el.pika.classList.add('sleeping');
      this._updateSky();
    }

    async _wakeUp() {
      this._asleep = false;
      const p = this._el.pika;
      p.classList.remove('sleeping', 'peek');
      p.classList.add('stretch');
      this._updateSky();
      try {
        await this._wait(1300);
      } finally {
        p.classList.remove('stretch');
      }
      this._say('iiep!');
      await this._wait(900);
    }

    // ---------- Bausteine ----------

    async _walkTo(x, speed = 1) {
      const { pW } = this._g;
      x = clamp(x, pW * 0.45, this._W - pW * 0.45);
      const dx = x - this._x;
      if (Math.abs(dx) < 4) return;
      this._face(dx > 0 ? 1 : -1);
      const dur = Math.abs(dx) / (pW * 0.85 * speed);
      const p = this._el.pika;
      p.style.transition = `transform ${dur.toFixed(2)}s linear`;
      this._setX(x);
      p.classList.add('walking');
      await this._wait(dur * 1000);
      p.classList.remove('walking');
    }

    async _approach(x, speed) {
      const dir = Math.abs(x - this._x) < 2 ? this._dir : Math.sign(x - this._x);
      await this._walkTo(x - dir * this._g.pW * 0.36, speed);
      this._face(x >= this._x ? 1 : -1);
    }

    async _eat(color, ms) {
      const p = this._el.pika;
      const m = this._el.mfood;
      this._mouth(color);
      p.style.setProperty('--eat', `${ms}ms`);
      m.classList.remove('shrink');
      void m.getBoundingClientRect();
      m.classList.add('shrink');
      p.classList.add('eating');
      await this._wait(ms);
      p.classList.remove('eating');
      this._mouth(null);
    }

    _setX(x, instant) {
      const p = this._el.pika;
      this._x = x;
      if (instant) p.style.transition = 'none';
      p.style.transform = `translateX(${(x - this._g.pW / 2).toFixed(1)}px)`;
      if (instant) void p.offsetWidth;
    }

    // Wo der Pika gerade wirklich steht. Beim Laufen ist this._x schon das Ziel, die CSS-Transition
    // bewegt ihn erst noch dorthin.
    _liveX() {
      const t = getComputedStyle(this._el.pika).transform;
      return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 + this._g.pW / 2 : this._x;
    }

    _freeze() {
      this._setX(this._liveX(), true);
    }

    _face(dir) {
      this._dir = dir;
      this._el.pika.classList.toggle('left', dir < 0);
    }

    _mouth(color) {
      if (color) this._el.pika.style.setProperty('--mf', color);
      else this._el.mfood.classList.remove('shrink');
    }

    _jump(kind) {
      const j = this._el.jump;
      j.classList.remove('hop1', 'binky');
      void j.offsetWidth;
      j.classList.add(kind);
      clearTimeout(this._jumpT);
      this._jumpT = setTimeout(() => j.classList.remove(kind), 1000);
    }

    _happy(ms = 1200) {
      const p = this._el.pika;
      p.classList.add('happy');
      clearTimeout(this._happyT);
      this._happyT = setTimeout(() => p.classList.remove('happy'), ms);
      this._hearts(3);
    }

    _say(text, ms = 1400) {
      this._el.say.textContent = text;
      this._bubble(this._el.say, true);
      clearTimeout(this._sayT);
      this._sayT = setTimeout(() => this._bubble(this._el.say, false), ms);
    }

    _bubble(el, on) {
      el.classList.toggle('on', on);
    }

    _hearts(n) {
      const { pW, pH, gy } = this._g;
      const x = this._liveX() + this._dir * pW * 0.25;
      const y = gy - pH * 0.945 + pH * 0.25;
      for (let i = 0; i < n; i++) {
        const h = document.createElement('span');
        h.className = 'heart';
        h.innerHTML = ICON_HEART;
        h.style.left = `${x + rnd(-pW * 0.12, pW * 0.12)}px`;
        h.style.top = `${y}px`;
        h.style.setProperty('--dx', `${rnd(-pW * 0.3, pW * 0.3)}px`);
        h.style.animationDelay = `${i * 110}ms`;
        this._el.fx.appendChild(h);
        setTimeout(() => h.remove(), 1700 + i * 110);
      }
    }

    _blink() {
      const p = this._el.pika;
      if (this._asleep) return;
      p.classList.add('blink');
      setTimeout(() => p.classList.remove('blink'), 140);
      if (Math.random() < 0.25) {
        setTimeout(() => p.classList.add('blink'), 280);
        setTimeout(() => p.classList.remove('blink'), 420);
      }
    }

    _twitch() {
      if (this._asleep) return;
      const c = pick(['twitch-l', 'twitch-r']);
      const p = this._el.pika;
      p.classList.add(c);
      setTimeout(() => p.classList.remove(c), 550);
    }

    _loop(fn, min, max) {
      const h = { t: 0 };
      const next = () => (h.t = setTimeout(() => (fn(), next()), rnd(min, max)));
      this._loops.push(h);
      next();
    }

    _tick() {
      this._renderStats();
      if (this._sleepTime() !== this._asleep && this._action !== 'goSleep' && this._action !== 'wakeUp') {
        this._interrupt();
      }
      this._updateSky();
    }

    // ---------- Interaktion ----------

    _onPet() {
      this._add('g', GAIN.pet);
      const p = this._el.pika;
      if (this._asleep) {
        p.classList.add('peek');
        clearTimeout(this._peekT);
        this._peekT = setTimeout(() => p.classList.remove('peek'), 1300);
        this._hearts(1);
        return;
      }
      this._happy();
      if (!p.classList.contains('walking')) this._jump(Math.random() < 0.25 ? 'binky' : 'hop1');
      if (Math.random() < 0.35) this._say(pick(['iiep!', 'mip!', '♥']));
    }

    _onFeed() {
      if (!this._g) return;
      if (this._foods.length >= 3) {
        const b = this._el.feed;
        b.classList.remove('no');
        void b.offsetWidth;
        b.classList.add('no');
        return;
      }
      this._add('s', GAIN.feed);
      const kind = Math.random() < 0.6 ? 'lz' : 'klee';
      const { fMin, fMax } = this._g;
      let xf = rnd(fMin, fMax);
      // nicht direkt auf den Pika fallen lassen
      if (Math.abs(xf * this._W - this._x) < this._g.pW * 0.6) xf = clamp(xf + 0.25 * pick([-1, 1]), fMin, fMax);
      const el = document.createElement('div');
      el.className = 'food drop';
      el.style.setProperty('--xf', xf.toFixed(4));
      el.innerHTML = FOOD[kind].svg;
      this._el.foods.appendChild(el);
      const food = { xf, kind, el, landed: false };
      this._foods.push(food);
      setTimeout(() => {
        food.landed = true;
        el.classList.remove('drop');
        if (this._asleep) {
          this._el.pika.classList.add('peek');
          setTimeout(() => this._el.pika.classList.remove('peek'), 900);
        } else if (this._action !== 'eatFood') {
          this._interrupt();
        }
      }, 800);
    }

    _onLookAt(e) {
      if (this._asleep || !this._g || this._action === 'eatFood') return;
      const x = e.clientX - this._el.scene.getBoundingClientRect().left;
      const c = Math.sign(x - this._liveX()) === this._dir ? 'look-f' : 'look-b';
      const p = this._el.pika;
      p.classList.remove('look-f', 'look-b', 'look-up');
      p.classList.add(c);
      clearTimeout(this._lookT);
      this._lookT = setTimeout(() => p.classList.remove(c), 1500);
    }

    // ---------- Wiese ----------

    _initFlowers() {
      for (let i = 0; i < 5; i++) this._addFlower(false);
    }

    _addFlower(grow = true) {
      const { fMin, fMax } = this._g;
      let xf;
      for (let tries = 0; tries < 12; tries++) {
        xf = rnd(fMin, fMax);
        if (this._flowers.every((f) => Math.abs(f.xf - xf) * this._W > 26)) break;
      }
      const color = pick(FLOWER_COLORS);
      const el = document.createElement('div');
      el.className = grow ? 'flower grow' : 'flower';
      el.style.setProperty('--xf', xf.toFixed(4));
      el.style.animationDelay = grow ? '' : `${rnd(-3.6, 0).toFixed(2)}s`;
      el.innerHTML = FLOWER_SVG(color);
      this._el.flowers.appendChild(el);
      this._flowers.push({ xf, color, el });
    }

    _regrow() {
      if (this._g && this._flowers.length < 6) this._addFlower(true);
    }

    _nearestFlower() {
      let best = null;
      for (const f of this._flowers) {
        if (!best || Math.abs(f.xf * this._W - this._x) < Math.abs(best.xf * this._W - this._x)) best = f;
      }
      return best;
    }

    _pickFlower(f) {
      this._flowers = this._flowers.filter((o) => o !== f);
      f.el.classList.add('picked');
      setTimeout(() => f.el.remove(), 400);
    }

    _removeFood(food) {
      this._foods = this._foods.filter((o) => o !== food);
      food.el.classList.add('gone');
      setTimeout(() => food.el.remove(), 350);
    }

    _loadHay() {
      this._hay = 3;
      try {
        const h = JSON.parse(localStorage.getItem('pika-pet-card-hay') || 'null');
        if (h) {
          const days = Math.floor((Date.now() - h.t) / 864e5);
          this._hay = clamp(h.n - days * 2, 1, 12);
        }
      } catch (e) { /* kein Speicher – egal */ }
      this._renderHay();
    }

    _addHay() {
      this._hay = Math.min(12, this._hay + 1);
      this._renderHay();
      try {
        localStorage.setItem('pika-pet-card-hay', JSON.stringify({ n: this._hay, t: Date.now() }));
      } catch (e) { /* egal */ }
    }

    _renderHay() {
      this._el.hay.style.setProperty('--hs', (0.4 + this._hay * 0.055).toFixed(3));
    }

    // ---------- Zustand ----------

    _get(k) {
      if (!this._stats) return 70;
      const v = this._stats[k] - ((Date.now() - this._stats[k + 't']) / 3.6e6) * RATE[k];
      return clamp(v, 0, 100);
    }

    _add(k, d) {
      if (!this._stats) this._stats = freshStats();
      this._stats[k] = clamp(this._get(k) + d, 0, 100);
      this._stats[k + 't'] = Date.now();
      this._renderStats();
      this._save();
    }

    _save() {
      this._pendingWrite = true;
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => {
        const v = serialize(this._stats);
        if (this._cfg.entity && this._hass) {
          this._lastEntityState = v;
          this._hass
            .callService('input_text', 'set_value', { entity_id: this._cfg.entity, value: v })
            .catch((e) => console.warn('pika-pet-card: Speichern fehlgeschlagen', e));
        } else {
          try {
            localStorage.setItem(this._lsKey(), v);
          } catch (e) { /* egal */ }
        }
        this._pendingWrite = false;
      }, 1200);
    }

    _lsKey() {
      return `pika-pet-card:${this._cfg.name}`;
    }

    _loadLocal() {
      let parsed = null;
      try {
        parsed = parseStats(localStorage.getItem(this._lsKey()));
      } catch (e) { /* egal */ }
      this._stats = parsed || freshStats();
    }

    _renderStats() {
      if (!this._el) return;
      const s = this._get('s');
      const g = this._get('g');
      this._el.barS.style.width = `${s}%`;
      this._el.barG.style.width = `${g}%`;
      this._el.stS.classList.toggle('low', s < 30);
      this._el.stG.classList.toggle('low', g < 30);
      this._el.stS.title = `Satt: ${Math.round(s)} %`;
      this._el.stG.title = `Glücklich: ${Math.round(g)} %`;
    }

    _sleepTime() {
      if (this._dbgSleep != null) return this._dbgSleep;
      const now = new Date();
      const m = now.getHours() * 60 + now.getMinutes();
      const a = minutes(this._cfg.sleep_start);
      const b = minutes(this._cfg.sleep_end);
      return a > b ? m >= a || m < b : m >= a && m < b;
    }

    _updateSky() {
      if (!this._el) return;
      const e = this._dbgElev ?? this._elev;
      let mode;
      if (e == null) mode = this._asleep ? 'night' : 'day';
      else if (e > 4) mode = this._asleep ? 'dusk' : 'day';
      else if (e > -5) mode = 'dusk';
      else mode = 'night';
      const sc = this._el.scene.classList;
      sc.remove('day', 'dusk', 'night');
      sc.add(mode);
      const month = new Date().getMonth();
      sc.toggle('summer', month >= 4 && month <= 8);
      sc.toggle('sun-low', e != null && e < 8);
      sc.toggle('sun-down', e != null && e < -1);

      const az = this._dbgAz ?? this._az;
      if (e != null && az != null) this._place(this._el.sun, skyPos(az, e));

      // Mond höchstens alle 30 s neu berechnen, er bewegt sich gemächlich
      const now = this._dbgDate ?? Date.now();
      const cfg = this._hass?.config;
      if (cfg && Number.isFinite(cfg.latitude) && (this._dbgDate || !this._moonT || now - this._moonT > 30000)) {
        this._moonT = now;
        const m = moonPosition(now, cfg.latitude, cfg.longitude);
        const ph = moonPhase(now);
        this._place(this._el.moon, skyPos(m.az, m.alt));
        this._el.moonLit.setAttribute('d', moonPath(ph));
        this._moonUp = m.alt > 2 && ph > 0.03 && ph < 0.97;
      }
      sc.toggle('moon-up', !!this._moonUp);
    }

    _place(el, { x, y }) {
      const prev = el._pos;
      if (prev && Math.abs(prev.x - x) < 0.05 && Math.abs(prev.y - y) < 0.05) return;
      el._pos = { x, y };
      if (!prev) el.style.transition = 'none';
      el.style.left = `${x.toFixed(2)}%`;
      el.style.top = `${y.toFixed(2)}%`;
      if (!prev) {
        void el.offsetWidth;
        el.style.transition = '';
      }
    }

    // ---------- Wetter ----------

    _readWeather(w) {
      if (w) {
        const a = w.attributes || {};
        let wind = Number(a.wind_speed);
        const unit = String(a.wind_speed_unit || 'km/h');
        if (unit === 'm/s') wind *= 3.6;
        else if (unit === 'mph') wind *= 1.609;
        else if (unit === 'kn') wind *= 1.852;
        let temp = Number(a.temperature);
        if (a.temperature_unit === '°F') temp = (temp - 32) / 1.8;
        this._wxRaw = {
          cond: w.state,
          cover: Number(a.cloud_coverage),
          wind: Number.isFinite(wind) ? wind : 0,
          bearing: Number(a.wind_bearing),
          temp: Number.isFinite(temp) ? temp : null,
        };
      } else {
        this._wxRaw = null;
      }
      this._applyWeather();
    }

    _applyWeather() {
      if (!this._el) return;
      const raw = { cond: null, wind: 0, temp: null, ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
      const def = WEATHER[raw.cond] || { cover: 25 };
      // Bei trockener Lage zählt die gemeldete Bedeckung, bei Regen, Schnee & Co. die Wetterlage
      const dry = !def.rain && !def.snow && !def.storm && !def.fog;
      const cover = dry && Number.isFinite(raw.cover) ? raw.cover : def.cover;
      const fx = {
        cover,
        rain: def.rain || 0,
        snow: def.snow || 0,
        fog: !!def.fog,
        flash: !!def.flash,
        storm: !!def.storm,
        windy: !!def.wind || raw.wind >= 30,
        cold: raw.temp != null && raw.temp < 3,
        snowcover: raw.cond === 'snowy' || (raw.cond === 'snowy-rainy' && raw.temp != null && raw.temp <= 0),
      };
      fx.wet = fx.rain > 0 || fx.flash; // Blatt als Regenschirm
      fx.shelter = fx.storm; // bei Starkregen und Gewitter bleibt er vor seinem Bau
      // Windrichtung = woher der Wind kommt. Aus Westen ziehen Wolken nach Osten, im Bild also nach links.
      const fromWest = !(raw.bearing > 0 && raw.bearing < 180);
      const key = JSON.stringify([fx, Math.round(raw.wind / 5), fromWest]);
      if (key === this._wxKey) return;
      this._wxKey = key;
      const wasShelter = this._wx.shelter;
      this._wx = fx;

      const sc = this._el.scene.classList;
      sc.toggle('overcast', cover >= 70);
      sc.toggle('storm', fx.storm);
      sc.toggle('foggy', fx.fog);
      sc.toggle('windy', fx.windy);
      sc.toggle('snowcover', fx.snowcover);
      sc.toggle('wind-w', fromWest);
      const st = this._el.scene.style;
      const lean = Math.min(raw.wind * 0.7, 28) * (fromWest ? -1 : 1);
      st.setProperty('--cs', clamp(1.3 - raw.wind / 35, 0.3, 1.3).toFixed(2));
      st.setProperty('--slant', `${lean.toFixed(1)}deg`);
      st.setProperty('--sw1', fromWest ? '-14deg' : '-2deg');
      st.setProperty('--sw2', fromWest ? '2deg' : '14deg');
      st.setProperty('--starop', (0.85 * (1 - cover / 110)).toFixed(2));
      const n = Math.round((cover / 100) * this._el.clouds.length);
      this._el.clouds.forEach((c, i) => c.classList.toggle('on', i < n));
      this._setPrecip(fx.rain, fx.snow);
      const p = this._el.pika.classList;
      p.toggle('wet', fx.wet);
      p.toggle('cold', fx.cold);
      if (fx.shelter && !wasShelter && !this._asleep && this._action !== 'eatFood') this._interrupt();
    }

    _setPrecip(rain, snow) {
      const k = `${rain}/${snow}`;
      if (k === this._precipKey) return;
      this._precipKey = k;
      let html = '';
      for (let i = 0; i < rain; i++) {
        html += `<i class="r" style="left:${rnd(0, 100).toFixed(1)}%;animation-delay:${rnd(-1, 0).toFixed(2)}s;`
          + `animation-duration:${rnd(0.45, 0.75).toFixed(2)}s;opacity:${rnd(0.45, 0.95).toFixed(2)}"></i>`;
      }
      for (let i = 0; i < snow; i++) {
        const s = rnd(2.5, 5).toFixed(1);
        html += `<i class="s" style="left:${rnd(0, 100).toFixed(1)}%;width:${s}px;height:${s}px;animation-delay:${rnd(-9, 0).toFixed(2)}s;`
          + `animation-duration:${rnd(5.5, 9.5).toFixed(2)}s;opacity:${rnd(0.6, 1).toFixed(2)}"></i>`;
      }
      this._el.precip.innerHTML = html;
    }

    _lightning() {
      if (!this._wx.flash) return;
      const f = this._el.flash;
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
      if (!this._asleep && this._g) {
        // erschrickt kurz
        setTimeout(() => {
          this._jump('hop1');
          this._say('!', 900);
        }, 250);
      }
    }
  }

  if (!customElements.get('pika-pet-card')) {
    customElements.define('pika-pet-card', PikaPetCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: 'pika-pet-card',
      name: 'Pika Pet Card',
      description: 'Ein kleiner Pika wohnt im Dashboard – füttern, streicheln, beim Schlafen zuschauen.',
      preview: true,
    });
    console.info(`%c PIKA-PET-CARD %c ${VERSION} `, 'background:#ad8664;color:#fff;border-radius:3px 0 0 3px', 'background:#f0e2cf;color:#5a4030;border-radius:0 3px 3px 0');
  }
})();
