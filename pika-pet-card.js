
/*
 * Pika Pet Card – ein kleiner Pika (Pfeifhase) wohnt im Home-Assistant-Dashboard.
 *
 *   Pika antippen      → streicheln (Herzchen, Glück steigt)
 *   Löwenzahn-Knopf    → füttern (Futter fällt herunter, er hoppelt hin und frisst)
 *   Nachts             → schläft er mit Zipfelmütze im Bau (Standard: Sonnenuntergang bis -aufgang)
 *   Ab und zu, Gewitter → verschwindet er in seinem Bau und schaut heraus
 *   Über den Tag        → macht er kleine Häufchen (erst in die Klo-Ecke am Stein); antippen = wegmachen
 *   Ab und zu Besuch    → Vögelchen landet auf Bau, Laterne oder Stein; Maus schaut hinter dem Stein hervor
 *   Echte Flugzeuge     → ziehen über den Himmel, mit Flugnummer und Ziel (Flightradar24-Integration)
 *   Beschäftigungen     → liest, spielt Gameboy, liegt mit dem Tablet in der Wiese, lässt bei Wind einen
 *                         Drachen steigen, guckt bei Regen im Bau Fernsehen (höchstens alle 12–20 Minuten)
 *   Sonst              → schaut sich um, hoppelt, knabbert Blumen, sammelt Heu, putzt sich
 *   Haus-Bote           → zeigt Waschmaschine, Trockner und Spülmaschine (läuft mit Fortschritt, fertig,
 *                         ausgeräumt) als Requisiten am Bau und erinnert, solange nichts ausgeräumt ist
 *   Festtage            → Kürbis, Laterne, Adventskranz, Stiefel, Tannenbaum, Feuerwerk, Konfetti, Ostereier,
 *                         Maibaum, Wimpel, Geburtstagskuchen; dazu passende Hüte
 *   Freund-Pika Pino    → kommt zu Besuch, spielt Fangen, sitzt mit ihm, piepst im Duett
 *   Himmel              → Sternschnuppen in klaren Nächten, Glühwürmchen in Sommernächten
 *   Besuche (Vögelchen, Maus, Pino) werden aus der Uhrzeit berechnet und sind auf allen Geräten gleich.
 *
 * Konfiguration:
 *   type: custom:pika-pet-card
 *   name: Pika                       # Name in der Statusanzeige
 *   entity: input_text.pika_status   # optional: Zustand geräteübergreifend speichern
 *   sleep_start: sunset              # Schlafenszeit: "21:00", "sunset" oder z. B. "sunset+01:00"
 *   sleep_end: sunrise               # Aufwachzeit: "07:00", "sunrise" oder z. B. "sunrise-30" (Minuten)
 *   sun_entity: sun.sun              # Sonnenstand (Höhe + Azimut) für Himmel und Sonne
 *   weather_entity: weather.forecast_home   # Wolken, Regen, Schnee, Nebel, Gewitter, Wind
 *   areal: huegel                    # Bau: huegel (Erdhügel), fels, stumpf, alpin
 *   flight_entity: sensor.flightradar24_current_in_area   # Flüge im Umkreis (leer = keine Flugzeuge)
 *   flight_radius: 15                # Radius der Integration in km: so weit weg liegt der Bildrand
 *   max_flights: 2                   # höchstens so viele Flugzeuge gleichzeitig (die nächsten)
 *   show_stats: true                 # Satt-/Glück-/Sauber-Balken anzeigen
 *   height: 180                      # Mindesthöhe in px
 *   appliances: [...]                # Haus-Bote: Geräte (siehe README)
 *   festive: true / birthdays: []    # Festtage und Geburtstage
 *   friend: true / friend_name: Pino # Freund-Pika
 *   shooting_stars: true / fireflies: true   # Himmel-Extras
 *
 * Der Blick geht nach Süden: Osten (Sonnenaufgang) links, Westen rechts. Mondphase und Mondstand
 * werden aus Datum und Standort (hass.config) berechnet.
 */
(() => {
  const VERSION = '0.13.2';

  const DEFAULTS = {
    name: 'Pika',
    entity: null,
    sleep_start: 'sunset',
    sleep_end: 'sunrise',
    sun_entity: 'sun.sun',
    weather_entity: 'weather.forecast_home',
    areal: 'huegel',
    flight_entity: 'sensor.flightradar24_current_in_area',
    flight_radius: 15,
    max_flights: 2,
    show_stats: true,
    height: 180,
    // Haus-Bote: Geräte, deren Fortschritt und Fertig-Zustand der Pika zeigt (siehe Abschnitt "Haus-Bote")
    appliances: null,
    // Festtage: Deko im Jahreslauf und Geburtstage [{ name, date: 'MM-DD' }]
    festive: true,
    birthdays: [],
    // Freund-Pika, der zu Besuch kommt
    friend: true,
    friend_name: 'Pino',
    // Himmel: Sternschnuppen nachts, Glühwürmchen in Sommernächten
    shooting_stars: true,
    fireflies: true,
  };

  const RATE = { s: 5, g: 4 }; // Abnahme pro Stunde (satt, glücklich)
  const GAIN = { feed: 25, pet: 8, clean: 10 };
  // Häufchen: alle 80–140 Minuten Wachzeit eins, das erste 10–30 Minuten nach dem Aufwachen. Höchstens 8
  // seit dem letzten Großputz (einzeln weggemachte zählen mit), die ersten 3 in der Klo-Ecke am Stein. idx:
  // so viele Fälligkeiten rechnet die Karte höchstens (Bits der Maske für einzeln weggemachte Häufchen).
  // Besucher: Die Uhr ist in feste Fenster geteilt (win, ms). In jedem Fenster kommt mit Wahrscheinlichkeit p
  // höchstens ein Besuch, sein Start liegt in den ersten win − room ms (room: Platz für den Besuch selbst, damit
  // er vor dem nächsten Fenster vorbei ist). Mittlerer Abstand win / p wie früher: Vögelchen 3–7 Min Pause +
  // ~35 s Besuch ≈ 5,6 Min, Maus 2,5–6 Min + ~7 s ≈ 4,4 Min. Alles aus seedRnd, also auf allen Geräten gleich.
  const CRIT = { bird: { win: 240000, p: 0.72, room: 60000 }, mouse: { win: 180000, p: 0.69, room: 30000 } };
  const CRIT_LATE = 20000; // so lange nach dem Start kommt ein Besuch noch, danach wird er übersprungen
  const POOP = { every: 80, spread: 60, morning: [10, 20], max: 8, latrine: 3, idx: 24, fly: 4 };
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
  // "21:00" (auch "21:00:00") → Minuten nach Mitternacht. Eine reine Zahl gilt schon als Minuten: YAML ohne
  // Anführungszeichen macht aus 21:00 die Zahl 1260 (sexagesimal). Alles andere → null (dann gilt der Standard).
  const minutes = (hhmm) => {
    const s = String(hhmm ?? '').trim();
    if (/^\d+$/.test(s)) return Number(s) < 1440 ? Number(s) : null;
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  // Windrichtung in Grad: Zahl oder Kürzel wie "SW", "NNO" (deutsch O = Ost) → 0..360, sonst NaN
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const windDeg = (v) => {
    if (typeof v === 'number' || /^\s*-?\d+(\.\d+)?\s*$/.test(String(v ?? ''))) return Number(v);
    const i = COMPASS.indexOf(String(v ?? '').trim().toUpperCase().replace(/O/g, 'E'));
    return i < 0 ? NaN : i * 22.5;
  };
  // Sonnenauf- und -untergang (ms) am Kalendertag day (Ortszeit) nach der Sonnenaufgangsgleichung, auf ~1 Min
  // genau; elev: Höhe des Orts in m. Polartag/-nacht → null. Für die Häufchen der Vortage, sun.sun kennt nur das Nächste.
  const sunTimes = (day, lat, lng, elev = 0) => {
    const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
    const j = Math.round(noon / 864e5 + 2440587.5 - 2451545 + lng / 360) - lng / 360;
    const M = (357.5291 + 0.98560028 * j) % 360;
    const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
    const L = (M + C + 282.9372) % 360;
    const transit = 2451545 + j + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
    const dec = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));
    const h0 = (-0.833 - (2.076 * Math.sqrt(Math.max(0, elev))) / 60) * RAD;
    const cw = (Math.sin(h0) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec));
    if (!(Math.abs(cw) <= 1)) return null;
    const w = Math.acos(cw) / RAD / 360;
    const ms = (jd) => (jd - 2440587.5) * 864e5;
    return { rise: ms(transit - w), set: ms(transit + w) };
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

  // ---------- Flugzeuge ----------

  // Seitenansicht mit der Nase nach rechts, viewBox 0 0 100 40. --tail ist die Airline-Farbe.
  // .pl-body wird nachts abgedunkelt, Fenster (.win) leuchten dann, .bcn blinkt rot, .strobe blitzt weiß.
  const PLANE_SVG = {
    jet: `<svg viewBox="0 0 100 40" aria-hidden="true"><g class="pl-body">
      <path fill="var(--tail)" d="M9 17 L3 2.8 Q2.7 1.5 4.3 1.5 L11 1.5 Q12.4 1.5 13.4 2.8 L25 16.5Z"/>
      <path fill="#f8fafc" stroke="#b7c3cf" stroke-width=".6" d="M6 20 Q6 16 12 16 L78 16 Q93 16 98 21 Q94 26.5 80 26.5 L16 26.5 Q9 25 6 20Z"/>
      <path fill="var(--tail)" d="M15 24.6 L82 24.6 Q90 24.6 95.2 23.3 Q91 26.5 80 26.5 L16 26.5 Q15 25.6 15 24.6Z"/>
      <path fill="#4c6a8e" d="M86.5 18.2 Q91.5 18.4 94.2 20.4 L87.5 20.6 Q86 19.6 86.5 18.2Z"/>
      <path fill="var(--tail)" d="M4 20 L16 20.3 L22 21.6 L6 22Z"/>
      <path fill="#e6ecf2" stroke="#b7c3cf" stroke-width=".6" d="M40 23.5 L58 23.5 L47 36 Q46 37 44.5 37 L41 37Z"/>
      <rect x="46" y="27.5" width="13" height="5.4" rx="2.7" fill="#d5dde6" stroke="#aab7c4" stroke-width=".5"/>
      <ellipse cx="58.6" cy="30.2" rx="1" ry="2.2" fill="#7d8c9c"/>
    </g><g class="win">${Array.from({ length: 15 }, (_, i) => `<circle cx="${22 + i * 4}" cy="19.6" r="1.05"/>`).join('')}</g>
    <circle class="bcn" cx="52" cy="15.6" r="1.4"/><circle class="strobe" cx="44" cy="36.4" r="1.4"/><circle class="strobe" cx="3.6" cy="2.4" r="1.1"/></svg>`,
    prop: `<svg viewBox="0 0 100 40" aria-hidden="true"><g class="pl-body">
      <path fill="var(--tail)" d="M8 20 L5 7 Q5 6 6.5 6 L11 6 Q12 6 13 7.5 L24 18Z"/>
      <path fill="#f8fafc" stroke="#b7c3cf" stroke-width=".6" d="M6 21 Q8 18 24 17 L62 15.5 Q80 15 86 19 L87 24.5 Q78 27.5 64 27.5 L26 26 Q10 24.5 6 21Z"/>
      <path fill="var(--tail)" opacity=".85" d="M10 22.4 L86 22.6 L86.6 24 L10 23.6Z"/>
      <path fill="var(--tail)" d="M4 21 L16 21 L20 22.4 L6 22.8Z"/>
      <path d="M50 15.8 L58 25 M60 27 L58 32 M80 26 L80 31" stroke="#8b98a6" stroke-width="1.1" fill="none"/>
      <rect x="44" y="11.6" width="30" height="4.2" rx="2.1" fill="#e6ecf2" stroke="#b7c3cf" stroke-width=".6"/>
      <circle cx="58" cy="32.5" r="2" fill="#4a5562"/><circle cx="80" cy="31.5" r="1.8" fill="#4a5562"/>
      <path fill="#c9d2dc" d="M86 18.5 Q90.5 21.5 86.5 25Z"/>
    </g><g class="win"><path d="M62 17.2 L75 16.8 Q80 17.4 82 20.4 L63 20.6Z"/></g>
    <ellipse class="prop" cx="90" cy="21.8" rx="1.1" ry="9" fill="rgba(70, 78, 90, .45)"/>
    <circle class="bcn" cx="40" cy="16.8" r="1.2"/><circle class="strobe" cx="73" cy="13.6" r="1.1"/></svg>`,
    heli: `<svg viewBox="0 0 100 40" aria-hidden="true"><g class="pl-body">
      <path fill="var(--tail)" d="M42 20 L10 18.5 Q8 18.5 8 20 L8 21.5 Q8 23 10 23 L42 25.5Z"/>
      <path fill="var(--tail)" d="M10 19 L6 11 L10 11 L14 19Z"/>
      <path fill="var(--tail)" stroke="rgba(0, 0, 0, .15)" stroke-width=".6" d="M46 13.5 Q70 11 82 19.5 Q85 29 68 30.5 L50 30.5 Q38 30 38 22 Q38 14.5 46 13.5Z"/>
      <path fill="#9cc0de" d="M66 14.4 Q77 15.6 81.2 21 L68 21 Q66 18 66 14.4Z"/>
      <rect x="58" y="8.5" width="3.4" height="5.5" rx="1" fill="#59626d"/>
      <path d="M48 30.5 L46 34.5 M74 30.5 L76 34.5 M40 34.5 L84 34.5 Q86 34.5 86.5 33" stroke="#59626d" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </g><rect class="rotor" x="22" y="7" width="76" height="1.8" rx=".9" fill="rgba(60, 66, 74, .75)"/>
    <circle class="trotor" cx="8" cy="20" r="5" fill="rgba(60, 66, 74, .2)" stroke="rgba(60, 66, 74, .5)" stroke-width=".6"/>
    <circle class="bcn" cx="60" cy="13.6" r="1.2"/><circle class="strobe" cx="6.5" cy="11.2" r="1"/></svg>`,
  };
  const PLANE_SIZE = { jet: 1, prop: 0.55, heli: 0.5 };

  // Fernsehbild: wechselt alle paar Sekunden die Farbe (Schnitt), daraus Licht im Eingang und Lichtsaum
  const TV_COLORS = ['#9fd0ff', '#e8f4ff', '#a8f0c6', '#ffd59e', '#c8b6ff', '#ff9fb2', '#9fe7ff'];

  // Drachen in px um die Pfote (0, 0): Schnur bis (kx, ky), dort der Drache (Größe K) mit Gesicht und Schwanz
  const KITE_SVG = (kx, ky, K) => {
    const f = (n) => n.toFixed(1);
    const bows = [1.25, 1.85, 2.45].map((t, i) => {
      const a = f(-K * 0.12), b = f(K * 0.12), y1 = f(K * (t - 0.06)), y2 = f(K * (t + 0.06));
      return `<path d="M${a} ${y1} L${b} ${y2} L${b} ${y1} L${a} ${y2}Z" fill="${['#e8584e', '#5fb9de', '#f6c945'][i]}"/>`;
    }).join('');
    return `<svg width="1" height="1" aria-hidden="true"><g class="kl"><g class="kr">
      <path d="M0 0 Q${f(kx * 0.6)} ${f(ky * 0.3)} ${f(kx)} ${f(ky)}" stroke="rgba(255, 255, 255, .85)" stroke-width="1" fill="none"/>
      <g transform="translate(${f(kx)} ${f(ky)})"><g class="kb">
        <g class="kt">
          <path d="M0 ${f(K * 0.8)} q${f(K * 0.18)} ${f(K * 0.3)} 0 ${f(K * 0.6)} t0 ${f(K * 0.6)} t0 ${f(K * 0.6)}" stroke="#5a4030" stroke-width="1" fill="none"/>
          ${bows}
        </g>
        <path d="M0 ${f(-K * 0.6)} L${f(K * 0.42)} 0 L0 ${f(K * 0.8)} L${f(-K * 0.42)} 0Z" fill="#f6c945" stroke="#5a4030" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M0 ${f(-K * 0.6)} L${f(K * 0.42)} 0 L0 0Z M0 0 L${f(-K * 0.42)} 0 L0 ${f(K * 0.8)}Z" fill="#e8584e"/>
        <path d="M0 ${f(-K * 0.6)} V${f(K * 0.8)} M${f(-K * 0.42)} 0 H${f(K * 0.42)}" stroke="#7a5236" stroke-width=".8" opacity=".7"/>
        <circle cx="${f(-K * 0.13)}" cy="${f(-K * 0.14)}" r="${f(K * 0.035)}" fill="#2a1a12"/>
        <circle cx="${f(K * 0.13)}" cy="${f(-K * 0.14)}" r="${f(K * 0.035)}" fill="#2a1a12"/>
        <path d="M${f(-K * 0.1)} ${f(K * 0.03)} q${f(K * 0.1)} ${f(K * 0.09)} ${f(K * 0.2)} 0" stroke="#2a1a12" stroke-width="1" fill="none" stroke-linecap="round"/>
      </g></g>
    </g></g></svg>`;
  };
  // Leitwerk in Airline-Farbe (ICAO-Kürzel), sonst Himmelblau
  const TAIL = {
    WZZ: '#c6007e', WMT: '#c6007e', WUK: '#c6007e', EWG: '#a1195b', EWL: '#a1195b', RYR: '#073590', RUK: '#073590',
    DLH: '#0a1d3d', CLH: '#0a1d3d', KLM: '#00a1de', AFR: '#002157', BAW: '#075aaa', THY: '#c70a0c', PGT: '#f4b400',
    SXS: '#ff9e1b', CFG: '#f5b100', TUI: '#70cbf4', TFL: '#70cbf4', EZY: '#ff6600', UAE: '#d71921', SWR: '#e2001a',
    AUA: '#e2001a', SAS: '#00205b', LOT: '#11397e', CAI: '#e30613', DHK: '#ffcc00', BCS: '#ffcc00', UPS: '#5b3a1e',
    FDX: '#4d148c', QTR: '#5c0632', ETD: '#b38b4d', AEE: '#0a3d7a', TAP: '#00a14b', IBE: '#d7192d', VLG: '#ffcc00',
  };
  const TAIL_DEFAULT = { jet: '#3d8fd6', prop: '#d9473b', heli: '#e0b52c' };
  // Städte, wie sie Flightradar24 liefert (englisch), auf Deutsch
  // ==================== Himmel-Extras (Sternschnuppen, Glühwürmchen): Konstanten und Stil ====================
  // Sternschnuppen: alle 1,5–5 Minuten eine Gelegenheit, jede fünfte ein Bolide, jede zehnte mit Nachzügler.
  // Glühwürmchen: 10–14 Stück, gut die Hälfte tief über der Wiese, ein Drittel um den Heuhaufen.
  const SKY = { meteor: [90000, 300000], bolide: 0.2, twin: 0.1, watch: 0.5, watchMs: 4000, ff: [10, 14] };
  const STYLE_SKY = `
  .meteors { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  /* Sternschnuppe: Hülle steht am Startpunkt und ist in Flugrichtung gedreht, Kopf und Schweif laufen --len weit */
  .met { position: absolute; width: 0; height: 0; transform: rotate(var(--a)); }
  .met b { position: absolute; top: 0; right: 0; animation: var(--d) linear forwards; }
  .met .mt {
    width: var(--tail); height: 1.5px; margin-top: -.75px; border-radius: 1px; transform-origin: 100% 50%;
    background: linear-gradient(to right, rgba(190, 210, 255, 0), rgba(225, 235, 255, .75) 75%, rgba(255, 255, 255, .95));
    animation-name: met-tail;
  }
  .met .mh {
    width: 3px; height: 3px; margin: -1.5px -1.5px 0 0; border-radius: 50%; background: #fff;
    box-shadow: 0 0 4px 1px rgba(215, 228, 255, .9); animation-name: met-head;
  }
  .met.bolide .mt {
    height: 2.5px; margin-top: -1.25px;
    background: linear-gradient(to right, rgba(255, 230, 190, 0), rgba(255, 244, 220, .8) 70%, rgba(255, 255, 255, 1));
  }
  .met.bolide .mh {
    width: 5px; height: 5px; margin: -2.5px -2.5px 0 0; box-shadow: 0 0 8px 3px rgba(225, 255, 235, .95);
    animation-name: met-bolide;
  }
  @keyframes met-tail {
    0% { transform: translateX(0) scaleX(0); opacity: 0; }
    12% { opacity: 1; }
    45% { transform: translateX(calc(var(--len) * .45)) scaleX(1); }
    80% { opacity: .9; }
    100% { transform: translateX(var(--len)) scaleX(.45); opacity: 0; }
  }
  @keyframes met-head {
    0% { transform: translateX(0) scale(.4); opacity: 0; }
    12% { transform: translateX(calc(var(--len) * .12)) scale(1); opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translateX(var(--len)) scale(.5); opacity: 0; }
  }
  /* Bolide: leuchtet kurz vor dem Verglühen hell auf */
  @keyframes met-bolide {
    0% { transform: translateX(0) scale(.5); opacity: 0; }
    10% { transform: translateX(calc(var(--len) * .1)) scale(1); opacity: 1; }
    68% { transform: translateX(calc(var(--len) * .68)) scale(1.2); }
    78% { transform: translateX(calc(var(--len) * .78)) scale(2.6); opacity: 1; }
    100% { transform: translateX(var(--len)) scale(.4); opacity: 0; }
  }
  .mflash { position: absolute; inset: 0; opacity: 0; animation: met-flash .7s ease-out forwards; }
  @keyframes met-flash { 30% { opacity: 1; } 100% { opacity: 0; } }

  /* Glühwürmchen: Ebene blendet sanft ein und aus (Sommernacht voll, späte Dämmerung schwach) */
  .ff { position: absolute; inset: 0; pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 3s, visibility 0s linear 3s; }
  .ff.on, .ff.dim { visibility: visible; transition: opacity 3s, visibility 0s; }
  .ff.on { opacity: 1; }
  .ff.dim { opacity: .45; }
  .ff.rest { display: none; }
  .ff .fl {
    left: 0; top: 0; width: 3.5px; height: 3.5px; margin: -1.75px; opacity: .2; transition: none;
    background: #f3ffa6; box-shadow: 0 0 6px 2px rgba(214, 240, 92, .8);
    animation: ff-drift var(--fd) ease-in-out var(--fdl) infinite, ff-pulse var(--fp) linear var(--fpl) infinite;
  }
  .ff .fl.big { width: 5.5px; height: 5.5px; margin: -2.75px; background: #f8ffbe; box-shadow: 0 0 10px 4px rgba(222, 245, 100, .8); }
  @keyframes ff-drift {
    0%, 100% { transform: translate(var(--x0), var(--y0)); }
    25% { transform: translate(var(--x1), var(--y1)); }
    50% { transform: translate(var(--x2), var(--y2)); }
    75% { transform: translate(var(--x3), var(--y3)); }
  }
  /* unregelmäßig: zwei Aufleuchten verschiedener Stärke, dazwischen fast dunkel */
  @keyframes ff-pulse {
    0%, 100% { opacity: .15; }
    9% { opacity: 1; }
    20% { opacity: .3; }
    46% { opacity: .12; }
    56% { opacity: .7; }
    64% { opacity: .85; }
    78% { opacity: .15; }
  }
  `;
  // ==================== Ende Himmel-Extras ====================

  const CITY_DE = {
    Bucharest: 'Bukarest', Warsaw: 'Warschau', Krakow: 'Krakau', Cracow: 'Krakau', Lisbon: 'Lissabon', Rome: 'Rom',
    Milan: 'Mailand', Venice: 'Venedig', Naples: 'Neapel', Florence: 'Florenz', Genoa: 'Genua', Athens: 'Athen',
    Prague: 'Prag', Vienna: 'Wien', Munich: 'München', Cologne: 'Köln', Nuremberg: 'Nürnberg', Copenhagen: 'Kopenhagen',
    Brussels: 'Brüssel', Moscow: 'Moskau', Belgrade: 'Belgrad', Kiev: 'Kiew', Kyiv: 'Kiew', Seville: 'Sevilla',
    Gdansk: 'Danzig', Cairo: 'Kairo', Tenerife: 'Teneriffa', Rhodes: 'Rhodos', Corfu: 'Korfu', Heraklion: 'Heraklion',
    Marrakech: 'Marrakesch', Larnaca: 'Larnaka', Tbilisi: 'Tiflis', Yerevan: 'Eriwan', Nice: 'Nizza', Geneva: 'Genf',
    Zurich: 'Zürich', Majorca: 'Mallorca', Lyon: 'Lyon', Hanover: 'Hannover', Frankfurt: 'Frankfurt',
  };
  const cityDe = (c) => CITY_DE[c] || c || '';
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  // "W43092" → "W4 3092"; ohne Flugnummer das Rufzeichen
  const flightNo = (f) => {
    const n = String(f.flight_number || '').toUpperCase();
    const m = n.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
    return m ? `${m[1]} ${m[2]}` : n || f.callsign || f.aircraft_registration || '✈';
  };
  const planeKind = (f) => {
    const t = `${f.aircraft_category || ''} ${f.aircraft_model || ''}`;
    if (/heli|rotor|Eurocopter|Airbus Helicopters|Robinson|Agusta|Sikorsky|\bBell [24]\d\d|\bEC ?1\d\d|\bH1[2-6]\d|BK.?117|AW1\d\d/i.test(t)) return 'heli';
    if (/Cessna|Piper|Cirrus|Diamond|Robin|Beech|Mooney|Socata|Aquila|Extra|Ultralight|Glider|Grob|Tecnam|Zlin|Aeroprakt|Ikarus|Pilatus PC-6|light/i.test(t)
      && !/Citation|Jet|King Air|Pilatus PC-12|Phenom/i.test(t)) return 'prop';
    return 'jet';
  };

  // Zustand im Text-Helfer: satt,zeit,glück,zeit,großputz,maske,teilputz (Zeiten in Sekunden).
  // großputz = seitdem werden Häufchen gezählt, maske = einzeln weggemachte (Bit k = Häufchen k),
  // teilputz = wann seit dem Großputz zum ersten Mal einzeln geputzt wurde (wird nur noch mitgeführt). Alte Werte mit 4 Feldern gelten ab dem letzten Kontakt als sauber.
  const sec = (ms) => Math.floor(ms / 1000) * 1000;
  const freshStats = () => {
    const now = sec(Date.now());
    return { s: 80, st: now, g: 80, gt: now, c: now, m: 0, l: now };
  };
  const serialize = (st) =>
    [st.s.toFixed(1), Math.round(st.st / 1000), st.g.toFixed(1), Math.round(st.gt / 1000),
      Math.round(st.c / 1000), st.m, Math.round(st.l / 1000)].join(',');
  const parseStats = (str) => {
    const p = String(str ?? '').split(',').map(Number);
    if ((p.length !== 4 && p.length !== 7) || p.some((n) => !Number.isFinite(n))) return null;
    const st = { s: p[0], st: p[1] * 1000, g: p[2], gt: p[3] * 1000 };
    if (p.length === 7) return { ...st, c: p[4] * 1000, m: p[5] >>> 0, l: p[6] * 1000 };
    const c = sec(Math.max(st.st, st.gt));
    return { ...st, c, m: 0, l: c };
  };
  // Fremden Stand (anderes Gerät) mit dem eigenen, noch nicht gesendeten zusammenführen. Grundlage ist der fremde,
  // er ist der frischere. Satt/glücklich: die eigenen ungesendeten Gewinne (gain.s/g) kommen obendrauf – so geht
  // weder fremdes noch eigenes Füttern/Streicheln verloren. Hat dieses Gerät geputzt (gain.c): der neuere Großputz
  // gilt, beim selben zählen die Einzelputze beider Geräte (Maske ODER, Teilputz der spätere).
  const mergeStats = (own, other, gain, now) => {
    const out = { ...other };
    for (const k of ['s', 'g']) {
      if (!gain[k]) continue;
      const v = clamp(other[k] - ((now - other[k + 't']) / 3.6e6) * RATE[k], 0, 100);
      out[k] = clamp(v + gain[k], 0, 100);
      out[k + 't'] = now;
    }
    if (!gain.c) return out;
    if (own.c > other.c) Object.assign(out, { c: own.c, m: own.m, l: own.l });
    else if (own.c === other.c) Object.assign(out, { m: (own.m | other.m) >>> 0, l: Math.max(own.l, other.l) });
    return out;
  };
  // Fester Zufall: gleiche Zahlen auf allen Geräten, damit überall dieselben Häufchen an denselben Stellen liegen
  const seeded = (...n) => {
    let h = 2166136261;
    for (const v of n) {
      h = Math.imul(h ^ (v | 0), 16777619);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
    }
    return (h >>> 0) / 4294967296;
  };
  // Dasselbe mit Texten als Schlüssel (Besuche: seedRnd('bird', fenster, n)) → Zahl in [0, 1)
  const seedRnd = (...keys) => seeded(...keys.flatMap((k) => (typeof k === 'string' ? [...k].map((c) => c.charCodeAt(0)) : [k])));

  // ---------- Grafiken ----------

  const OUT = '#5a4030';
  // Fellfarben als CSS-Variablen (Name → Tagesfarbe). Nachts und im Bau setzt der STYLE dunklere Werte,
  // ein CSS-Filter auf dem atmenden Pika müsste sonst jedes Bild neu gerechnet werden.
  const PK_FILL = {
    fu1: '#d0ad8d', fu2: '#b08a68', fu3: '#8a664b', bel: '#f0e2cf', ear: '#efe3d3', ein: '#e3a990',
    paw: '#ecdcc6', mou: '#f4e8d8', cap: '#7c9be0',
  };
  const PK = (k) => `var(--pk-${k}, ${PK_FILL[k]})`;
  // Wie filter: brightness(b) saturate(s), nur einmal ausgerechnet
  const PK_DIM = (b, s) => Object.entries(PK_FILL).map(([k, hex]) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * b);
    const L = 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2];
    return `--pk-${k}: #${c.map((v) => Math.round(clamp(L + (v - L) * s, 0, 255)).toString(16).padStart(2, '0')).join('')};`;
  }).join(' ');
  // Körper als eine durchgehende Bohnenform (Pikas haben keinen sichtbaren Hals)
  const BODY = 'M30 90 C14 88 11 61 25 49 C37 37 55 31 67 28 C76 21 99 19 107 35 C113 48 112 66 104 78 C100 85 96 90 88 91 C70 94 46 94 30 90 Z';
  const EAR = (cx, cy, side) => `
    <g class="ear ear-${side}">
      <circle cx="${cx}" cy="${cy}" r="12.4" fill="${OUT}"/>
      <circle cx="${cx}" cy="${cy}" r="10.8" fill="${PK('ear')}"/>
      <circle cx="${cx}" cy="${cy + 0.8}" r="8.8" fill="url(#fur)"/>
      <ellipse cx="${cx}" cy="${cy + 1.8}" rx="4.9" ry="5.5" fill="${PK('ein')}"/>
    </g>`;
  const EYE = (cx, side) => `
    <g class="eye eye-${side}">
      <ellipse cx="${cx}" cy="46" rx="3.9" ry="4.6" fill="#2a1a12"/>
      <circle cx="${cx + 1.4}" cy="44.2" r="1.5" fill="#fff"/>
      <circle cx="${cx - 0.9}" cy="47.9" r=".7" fill="#fff"/>
    </g>
    <path class="seye seye-${side}" d="M${cx - 3.8} 46.6 q3.8 3.2 7.6 0"/>
    <path class="heye" d="M${cx - 3.8} 47.6 q3.8 -3.8 7.6 0"/>`;

  // Rückansicht beim Fernsehen: runder Rücken, Ohren von hinten, Lichtsaum in der Farbe des Fernsehbilds
  const BACK = 'M58 92 C53 74 60 54 69 45 C71 33 79 28 86.5 28 C94 28 102 33 104 45 C113 54 120 74 115 92 C102 96 71 96 58 92Z';
  const BACK_EAR = (cx, side) => `
    <g class="ear ear-${side}">
      <circle cx="${cx}" cy="28" r="11.5" fill="url(#fur)" stroke="${OUT}" stroke-width="2.2"/>
      <circle cx="${cx}" cy="28" r="11.5" fill="#140d1e" opacity=".5"/>
      <circle class="rim" cx="${cx}" cy="28" r="11.5" fill="none" stroke="var(--tvc, #9fd0ff)" stroke-width="1.4"/>
    </g>`;

  const PIKA_SVG = `
  <svg class="pk" viewBox="0 0 120 100" aria-hidden="true">
    <defs>
      <radialGradient id="fur" gradientUnits="userSpaceOnUse" cx="88" cy="40" r="72">
        <stop offset="0" stop-color="${PK('fu1')}"/>
        <stop offset=".55" stop-color="${PK('fu2')}"/>
        <stop offset="1" stop-color="${PK('fu3')}"/>
      </radialGradient>
      <clipPath id="bodyclip"><path d="${BODY}"/></clipPath>
    </defs>
    <g class="all">
      ${EAR(75, 26, 'l')}${EAR(101, 27, 'r')}
      <g class="body">
        <path d="${BODY}" fill="url(#fur)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <g clip-path="url(#bodyclip)">
          <ellipse cx="82" cy="82" rx="20" ry="13" fill="${PK('bel')}"/>
        </g>
      </g>
      <g class="feet" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.6">
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
          <ellipse cx="91" cy="55" rx="7.5" ry="5.2" fill="${PK('mou')}"/>
          <path d="M88.7 51.6 q2.3 -1.1 4.6 0 q-.6 1.9 -2.3 2.5 q-1.7 -.6 -2.3 -2.5z" fill="#7a4438"/>
          <path d="M91 54.1 v1.5 M91 55.6 q-1.5 1.7 -3 .4 M91 55.6 q1.5 1.7 3 .4"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round"/>
          <ellipse class="omouth" cx="91" cy="57.6" rx="1.8" ry="2.2" fill="#7a3a30" stroke="${OUT}" stroke-width=".6"/>
        </g>
        <g class="callfx" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
          <path d="M113 51 q4 5 0 10"/><path d="M118 47.5 q6 8.5 0 17"/><path d="M123 44 q8 12 0 24"/>
        </g>
      </g>
      <g class="mfood">
        <path d="M92 58 Q100 58 106 61" stroke="#4f8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="99" cy="61" rx="4.2" ry="1.7" fill="#6bab4c" transform="rotate(22 99 61)"/>
        <circle class="mbloom" cx="108" cy="61" r="4.4"/>
        <circle cx="108" cy="61" r="1.6" fill="#e0a032" opacity=".8"/>
      </g>
      <g class="paws" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
        <ellipse cx="84" cy="61" rx="4" ry="5"/>
        <ellipse cx="98" cy="61" rx="4" ry="5"/>
      </g>
      <g class="book">
        <path d="M91 62.5 L79.5 59.4 L79.5 57.8 L91 61Z M91 62.5 L102.5 58.6 L102.5 57 L91 61Z" fill="#fffaf0" stroke="${OUT}" stroke-width=".6" stroke-linejoin="round"/>
        <path class="bflip" d="M91 61 L101.5 56.8 L100.6 53.8 L91 58.4Z" fill="#fff" stroke="${OUT}" stroke-width=".5" stroke-linejoin="round"/>
        <path d="M91 62.5 L79 59.4 L79.5 72 L91 75.2Z" fill="#d9534f" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M91 62.5 L103 58.5 L102.5 71 L91 75.2Z" fill="#c94440" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M82.5 64.6 l5 1.3 M82.5 67.2 l3.6 .9" stroke="#f6d9a8" stroke-width=".9" stroke-linecap="round"/>
        <circle cx="97" cy="65.6" r="1.7" fill="#f6c945"/>
        <g fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
          <ellipse cx="79.5" cy="66.5" rx="3.6" ry="4.5"/><ellipse cx="102.6" cy="65" rx="3.6" ry="4.5"/>
        </g>
      </g>
      <g class="gb" transform="rotate(-6 91 68)">
        <rect x="82" y="56.5" width="18" height="24" rx="2.2" fill="#cfccc4" stroke="${OUT}" stroke-width="1.2"/>
        <rect x="84.2" y="58.6" width="13.6" height="10.6" rx="1" fill="#6d6f76"/>
        <rect x="85.6" y="59.8" width="10.8" height="8.2" fill="#9bbc0f"/>
        <g class="gbs" fill="#306230">
          <rect x="87.2" y="64.6" width="2" height="2"/><rect x="85.6" y="66.8" width="10.8" height="1.2"/><rect x="93.4" y="61.4" width="1.4" height="1.4"/>
        </g>
        <path d="M85.4 74 h4.2 M87.5 71.9 v4.2" stroke="#3c3c3c" stroke-width="1.4"/>
        <circle cx="94.6" cy="74.8" r="1.2" fill="#a8326e"/><circle cx="97.5" cy="73" r="1.2" fill="#a8326e"/>
        <g fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
          <ellipse class="th1" cx="83" cy="73.4" rx="3.6" ry="4.4"/><ellipse class="th2" cx="99.4" cy="72.4" rx="3.6" ry="4.4"/>
        </g>
      </g>
      <g class="tab">
        <ellipse class="tglow" cx="95" cy="66" rx="17" ry="11" fill="#bfe3ff"/>
        <path d="M81 70 L113 70 L118 84 L76 84Z" fill="#2f3440" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M82.8 71.6 L111.4 71.6 L115.4 82.4 L78.8 82.4Z" fill="#cfeaff"/>
        <g class="tscr-f">
          <path d="M79 82.4 Q90 78.6 100 80.6 T115.3 80 L115.4 82.4Z" fill="#86c46b"/>
          <path d="M101 80.4 V77.2" stroke="#4f8a3a" stroke-width=".7"/>
          <circle cx="101" cy="76.6" r="1.9" fill="#f28fb1"/><circle cx="101" cy="76.6" r=".7" fill="#f6c945"/>
          <circle cx="88" cy="75" r="1.5" fill="#ffd75a"/>
        </g>
        <g class="tscr-p">
          <path d="M80 81 L114 73.4" stroke="#7fb0d9" stroke-width=".6" stroke-dasharray="1.2 1"/>
          <path d="M92.5 78.4 l4.5 -.5 l-1.8 -1.9 h1.1 l2.9 1.6 l2.5 -.3 q1.1 .3 .1 .8 l-2.5 .3 l-2.5 2 h-1.1 l1.4 -2 l-4.5 .5z" fill="#2f4256"/>
        </g>
        <g fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.2">
          <ellipse cx="82" cy="82.6" rx="4" ry="2.8"/><ellipse class="tpaw" cx="105" cy="79.6" rx="3.8" ry="2.8"/>
        </g>
      </g>
      <ellipse class="kpaw" cx="105" cy="50" rx="3.8" ry="4.8" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4"/>
      <g class="cap">
        <path d="M77 28 Q80 12 62 9 Q91 0 103 27 Z" fill="${PK('cap')}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="79" cy="17" r="1.3" fill="#fff" opacity=".8"/>
        <circle cx="88" cy="13" r="1.3" fill="#fff" opacity=".8"/>
        <circle cx="91" cy="22" r="1.3" fill="#fff" opacity=".8"/>
        <path d="M76 28 Q90 22 104 27" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="62" cy="9" r="4.2" fill="#fff" stroke="${OUT}" stroke-width="1.2"/>
      </g>
      <g class="hats">
        <g class="hat-witch">
          <ellipse cx="89" cy="22.6" rx="15" ry="3.6" transform="rotate(-6 89 22.6)" fill="#3d2f55" stroke="${OUT}" stroke-width="1.3"/>
          <path d="M80.6 21.6 Q83.4 13 87.4 7 Q90.2 1.6 97.4 -.6 Q93.4 3.6 93.6 8.4 Q94.6 15 97.4 20.4 Q89 23.4 80.6 21.6Z"
                fill="#4a3a6a" stroke="${OUT}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M81.4 18.6 Q89 21 96.4 17.8 L97.2 20.2 Q89 23.2 80.8 21.2Z" fill="#f28c28"/>
          <rect x="87.2" y="18.8" width="3.4" height="3.2" rx=".6" fill="none" stroke="#f6c945" stroke-width="1"/>
          <path d="M90.6 9.6 l.7 1.5 1.6 .2 -1.2 1.1 .3 1.6 -1.4 -.8 -1.4 .8 .3 -1.6 -1.2 -1.1 1.6 -.2Z" fill="#f6c945"/>
        </g>
        <g class="hat-xmas">
          <path d="M77 28 Q80 12 62 9 Q91 0 103 27 Z" fill="#d9483b" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M80 16 Q86 9 94 13" stroke="#f08a7e" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>
          <path d="M76 28 Q90 22 104 27" stroke="${OUT}" stroke-width="7.4" fill="none" stroke-linecap="round"/>
          <path d="M76 28 Q90 22 104 27" stroke="#f6f1ea" stroke-width="5.6" fill="none" stroke-linecap="round"/>
          <circle cx="62" cy="9" r="4.6" fill="#f6f1ea" stroke="${OUT}" stroke-width="1.2"/>
        </g>
        <g class="hat-party">
          <path d="M80.5 23.5 Q89 26 97.5 21.5 L92.5 1.5Z" fill="#5fb9de" stroke="${OUT}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M84.7 15.8 Q90 17.6 95.75 14.5 M88.3 9.2 Q91.5 10.4 94.25 8.5" stroke="#f6c945" stroke-width="2" fill="none"/>
          <g fill="#f28fb1"><circle cx="86" cy="20.8" r="1.1"/><circle cx="92.8" cy="19.8" r="1.1"/><circle cx="90.4" cy="12.8" r="1"/></g>
          <circle cx="92.5" cy="1.5" r="3.2" fill="#e8584e" stroke="${OUT}" stroke-width="1"/>
        </g>
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
        <ellipse cx="105" cy="63" rx="4" ry="4.6" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4"/>
      </g>
    </g>
    <g class="bk">
      ${BACK_EAR(74, 'l')}${BACK_EAR(99, 'r')}
      <path d="${BACK}" fill="url(#fur)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M79 35 Q86.5 30.5 94 35" stroke="#d6b796" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M86.5 29.5 q-1.6 -3 0 -4.8 q1.5 1.9 0 4.8" fill="${PK('fu3')}"/>
      <path d="${BACK}" fill="#140d1e" opacity=".5"/>
      <path class="rim" d="${BACK}" fill="none" stroke="var(--tvc, #9fd0ff)" stroke-width="2.2"/>
    </g>
  </svg>`;

  // ---------- Areale ----------
  // Jedes Areal hat einen Bau mit Eingang. Grafik in viewBox 0 0 100 vh, der Boden liegt bei vh - sink.
  // w/left: Breite und Lage relativ zur Kartenhöhe bzw. Baubreite. hole: Ausschnitt, in dem der Pika im Bau
  // zu sehen ist (x1..x2, Bogenoberkante top, Vorderkante lip, unterhalb verschwindet er). hay: linke Kante
  // des Heuhaufens als Anteil der Baubreite. stash (statt Heuhaufen): Vorratsnische im Bau (x1..x2, Bogen top,
  // Boden auf der Bodenlinie), dort legt der Pika die Blüten ab. lights: leuchtet in Dämmerung und Nacht (ungedimmt).
  const HOLE_GRAD = `<radialGradient id="holeg" cx=".5" cy=".9" r=".85">
      <stop offset="0" stop-color="#0d0907"/><stop offset="1" stop-color="#3b302a"/></radialGradient>`;
  const GLOW_GRAD = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".75"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

  const AREALE = {
    fels: {
      name: 'Felsbau', w: 0.72, left: -0.1, vh: 66, sink: 5, hay: 0.86,
      perches: [[46, 10.2], [17, 26.2], [83, 30.2]],
      hole: { x1: 39.5, x2: 60.5, top: 34, lip: 57.5 },
      svg: `
        <defs>${HOLE_GRAD}</defs>
        <g stroke="#5c6166" stroke-width="1.5">
          <ellipse cx="50" cy="27" rx="27" ry="17" fill="#a7adb3"/>
          <ellipse cx="19" cy="45" rx="24" ry="19" fill="#979da4"/>
          <ellipse cx="81" cy="47" rx="22" ry="17" fill="#8e949b"/>
        </g>
        <ellipse cx="42" cy="16" rx="8" ry="3" fill="#fff" opacity=".25"/>
        <ellipse cx="11" cy="34" rx="8" ry="3.4" fill="#fff" opacity=".2"/>
        <ellipse cx="78" cy="37" rx="7" ry="3" fill="#fff" opacity=".2"/>
        <path d="M36 64 V45 A14 14 0 0 1 64 45 V64Z" fill="url(#holeg)" stroke="#5c6166" stroke-width="1.4"/>
        <g stroke="#5c6166" stroke-width="1.2" fill="#b4b9be">
          <ellipse cx="35.5" cy="46" rx="4" ry="5.5"/><ellipse cx="38.5" cy="35.5" rx="4.6" ry="4"/>
          <ellipse cx="50" cy="30.5" rx="6" ry="3.6"/><ellipse cx="61.5" cy="35.5" rx="4.6" ry="4"/>
          <ellipse cx="64.5" cy="46" rx="4" ry="5.5"/>
        </g>
        <g stroke="#5c6166" stroke-width="1.3">
          <ellipse cx="41" cy="61" rx="9" ry="3.8" fill="#a3a9ae"/><ellipse cx="58" cy="61.5" rx="9" ry="3.6" fill="#9aa0a6"/>
          <ellipse cx="8" cy="60" rx="12" ry="7" fill="#a3a9ae"/><ellipse cx="92" cy="61" rx="11" ry="6" fill="#9aa0a6"/>
        </g>
        <g fill="#79b25d">
          <ellipse cx="63" cy="13" rx="5" ry="2.4"/><ellipse cx="25" cy="28" rx="4" ry="2"/><ellipse cx="90" cy="33" rx="4" ry="1.8"/>
        </g>`,
    },
    huegel: {
      name: 'Erdhügel', w: 0.82, left: -0.06, vh: 60, sink: 4, stash: { x1: 92.5, x2: 112.5, top: 39 },
      // Laternendach, Schornstein, Schild, Blumenkasten, Hügelkuppe, Nischenbogen
      perches: [[13, 27.6], [65, 0.4], [47, 13.4], [84, 39.6], [36, 11.6], [102.5, 37.4]],
      hole: { x1: 37.5, x2: 62.5, top: 25.5, lip: 52.6 },
      svg: `
        <defs>${HOLE_GRAD}</defs>
        <g stroke="#6b625a" stroke-width="1.1">
          <rect x="61.5" y="2" width="7" height="14" fill="#a39488"/>
          <rect x="60.5" y=".4" width="9" height="3" rx=".6" fill="#8c7d72"/>
          <path d="M61.5 7 H68.5 M64 7 V11.5 M66.5 11.5 V16 M61.5 11.5 H68.5" stroke-width=".6" opacity=".6"/>
        </g>
        <path class="mound" d="M-4 60 C-3 30 22 10 50 10 C80 10 104 20 114 32 C121 41 125 50 126 60Z" stroke="#5f8f45" stroke-width="1.5"/>
        <path d="M14 30 Q28 15 46 13" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g stroke="#5f8f45" stroke-width="1.2" fill="none" stroke-linecap="round">
          <path d="M28 16.5 l-2 -4 M31 15 l.5 -4.5 M68 15 l1.5 -4 M72 17 l3 -3.5 M47 10 l-1 -4 M51 10 l1.5 -4.2"/>
        </g>
        <g fill="#fff"><circle cx="6" cy="48" r="1.6"/><circle cx="9" cy="42" r="1.3"/><circle cx="90" cy="30" r="1.5"/><circle cx="119.5" cy="50" r="1.2"/></g>
        <g fill="#f4c53d"><circle cx="6" cy="48" r=".6"/><circle cx="9" cy="42" r=".5"/><circle cx="90" cy="30" r=".6"/><circle cx="119.5" cy="50" r=".5"/></g>
        <g transform="translate(6 1)">
          <circle cx="74" cy="32" r="6.6" fill="#5e3d26"/>
          <circle cx="74" cy="32" r="5.6" fill="#9a6a45"/>
          <circle class="pane" cx="74" cy="32" r="4.3"/>
          <path d="M70.3 29.4 Q72.6 30 73.4 34.6 L70.4 34.6Z M77.7 29.4 Q75.4 30 74.6 34.6 L77.6 34.6Z" fill="#e58a7a" opacity=".85"/>
          <path d="M74 27.7 V36.3 M69.7 32 H78.3" stroke="#9a6a45" stroke-width="1"/>
          <rect x="67" y="38.6" width="14" height="3.4" rx=".8" fill="#9a6a45" stroke="#5e3d26" stroke-width=".8"/>
          <path d="M69 38.6 q.4 -2.6 1.6 -3.2 M72.5 38.6 q0 -2.6 -.8 -3.4 M76 38.6 q.3 -2.8 1.4 -3.2 M79 38.6 q-.2 -2.4 -1 -3" stroke="#4f8a3a" stroke-width=".7" fill="none"/>
          <g fill="#f07a95"><circle cx="70.6" cy="35.4" r="1.1"/><circle cx="77.4" cy="35.4" r="1.1"/></g>
          <g fill="#f6c945"><circle cx="71.7" cy="35.2" r="1"/><circle cx="78" cy="35.8" r=".9"/></g>
        </g>
        <defs><linearGradient id="stashg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#140d09"/><stop offset="1" stop-color="#3a2a1e"/></linearGradient></defs>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57Z" fill="url(#stashg)"/>
        <path d="M95.3 52.8 V46 C95.3 43.4 109.7 43.4 109.7 46 V52.8Z" fill="#4b3628" opacity=".7"/>
        <path d="M92.5 57 L95.3 52.8 H109.7 L112.5 57Z" fill="#6e4f37"/>
        <path d="M92.5 44.2 L95.3 46 M112.5 44.2 L109.7 46" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>
        <g class="stashb"></g>
        <path d="M93.3 43.8 C93.5 39.4 111.5 39.4 111.7 43.8" stroke="#000" stroke-opacity=".45" stroke-width="1.4" fill="none"/>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57" fill="none" stroke="#5e3d26" stroke-width="3.6"/>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57" fill="none" stroke="#9a6a45" stroke-width="2.4"/>
        <path d="M92.5 57 V43.2 C92.5 37.8 112.5 37.8 112.5 43.2 V57" fill="none" stroke="#5e3d26" stroke-width=".4"
          stroke-dasharray="2.5 4" opacity=".6"/>
        <path d="M36 55 V38 A14 14 0 0 1 64 38 V55Z" fill="url(#holeg)"/>
        <path d="M35 57 V38 A15 15 0 0 1 65 38 V57" fill="none" stroke="#5e3d26" stroke-width="5.6"/>
        <path d="M35 57 V38 A15 15 0 0 1 65 38 V57" fill="none" stroke="#9a6a45" stroke-width="3.8"/>
        <path d="M35 57 V38 A15 15 0 0 1 65 38 V57" fill="none" stroke="#5e3d26" stroke-width=".5" stroke-dasharray="3 5" opacity=".6"/>
        <g>
          <ellipse cx="27" cy="41.5" rx="5" ry="13.5" fill="#6a9c78" stroke="#3d6a4b" stroke-width="1.3"/>
          <path d="M25 30.5 V52.5 M28.5 29 V54" stroke="#3d6a4b" stroke-width=".6" opacity=".6"/>
          <circle cx="29.3" cy="42.5" r="1.1" fill="#e2c15a"/>
        </g>
        <g transform="rotate(-3 50 17)">
          <rect x="41" y="13.2" width="18" height="7" rx="1.4" fill="#d2a46c" stroke="#8a5a3b" stroke-width="1.1"/>
          <text x="50" y="18.6" text-anchor="middle" font-size="5" font-weight="800" fill="#5a4030" letter-spacing=".5">PIKA</text>
        </g>
        <path d="M30 53.4 Q50 51.6 70 53.4 L72.5 55 V57.6 H27.5 V55Z" fill="#b8a48a" stroke="#7d6a52" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M28.1 55.2 H71.9 V57 H28.1Z" fill="#8f7c62"/>
        <path d="M33 53.6 Q50 52.2 67 53.6" stroke="#fff" stroke-opacity=".3" stroke-width=".9" fill="none" stroke-linecap="round"/>
        <path d="M18 57.5 V27 Q18 24 15 24 H13 V27" stroke="#4a4a4a" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14.6 57 Q15 54.4 18 54.2 Q21 54.4 21.4 57Z" fill="#9aa0a6" stroke="#5c6166" stroke-width=".8"/>
        <path d="M10 27.6 H16 L15 29 H11Z" fill="#3c3c3c"/>
        <rect x="11" y="29" width="4" height="6" fill="#ffe7a3" fill-opacity=".45" stroke="#3c3c3c" stroke-width="1"/>
        <rect x="10.4" y="35" width="5.2" height="1.4" rx=".5" fill="#3c3c3c"/>`,
      lights: `
        <defs>${GLOW_GRAD('lg', '#ffd66b')}${GLOW_GRAD('ig', '#ffb347')}</defs>
        <g class="smoke"><circle cx="65" cy="-1" r="2.2"/><circle cx="65" cy="-1" r="2.2"/><circle cx="65" cy="-1" r="2.2"/></g>
        <path class="lt" d="M37.5 53 V38 A12.5 12.5 0 0 1 62.5 38 V53Z" fill="url(#ig)" fill-opacity=".7"/>
        <g transform="translate(6 1)">
          <circle class="lt" cx="74" cy="32" r="12" fill="url(#ig)" fill-opacity=".6"/>
          <circle class="lt" cx="74" cy="32" r="4.3" fill="#ffcf70"/>
          <path class="lt" d="M70.3 29.4 Q72.6 30 73.4 34.6 L70.4 34.6Z M77.7 29.4 Q75.4 30 74.6 34.6 L77.6 34.6Z" fill="#d9705f"/>
          <path class="lt" d="M74 27.7 V36.3 M69.7 32 H78.3" stroke="#7a5236" stroke-width="1"/>
          <circle class="tvw" cx="74" cy="32" r="4.3"/>
          <path class="tvw-x" d="M74 27.7 V36.3 M69.7 32 H78.3" stroke="#7a5236" stroke-width="1"/>
        </g>
        <circle class="lt flk" cx="13" cy="32" r="10" fill="url(#lg)"/>
        <rect class="lt" x="11.6" y="29.6" width="2.8" height="4.8" fill="#ffd66b"/>`,
    },
    stumpf: {
      name: 'Baumstumpf', w: 0.64, left: -0.06, vh: 84, sink: 5, hay: 0.9,
      perches: [[40, 23.5], [61, 23]],
      hole: { x1: 38.5, x2: 61.5, top: 42.5, lip: 76.6 },
      svg: `
        <defs>${HOLE_GRAD}</defs>
        <g fill="#7f5434" stroke="#5e3d26" stroke-width="1.4" stroke-linejoin="round">
          <path d="M1 81 Q12 77 20 62 L27 70 Q17 78 15 81Z"/>
          <path d="M99 81 Q88 77 80 62 L73 70 Q83 78 85 81Z"/>
        </g>
        <path d="M10 81 Q19 74 20 58 L21 24 H79 L80 58 Q81 74 90 81Z" fill="#93633f" stroke="#5e3d26" stroke-width="1.6" stroke-linejoin="round"/>
        <g stroke="#6f4a2f" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8">
          <path d="M28 30 Q26 40 29 52 M72 31 Q75 42 71 56 M35 29 V37 M65 29 Q63 34 65 39 M25 60 Q24 68 19 75 M76 60 Q78 68 83 75"/>
        </g>
        <ellipse class="stump-top" cx="50" cy="24" rx="29" ry="7.5" stroke="#5e3d26" stroke-width="1.6"/>
        <g fill="none" stroke="#b98c58" stroke-width="1">
          <ellipse cx="50" cy="24" rx="21" ry="5.2"/><ellipse cx="50" cy="24" rx="13" ry="3.2"/><ellipse cx="50" cy="24" rx="5" ry="1.2"/>
        </g>
        <path d="M21 26 Q23 19 33 21.5 Q31 27 25 29 Q22 29 21 26Z" fill="#7fb35c"/>
        <path d="M20 40 Q23 36 24 44 Q21 47 20 44Z" fill="#7fb35c" opacity=".85"/>
        <path d="M70 21 Q72 14 76 11" stroke="#4f8a3a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <ellipse cx="78" cy="10.5" rx="3.6" ry="1.8" fill="#6bab4c" transform="rotate(-25 78 10.5)"/>
        <ellipse cx="72" cy="15" rx="3" ry="1.5" fill="#6bab4c" transform="rotate(30 72 15)"/>
        <path d="M37 82 V54 A13 13 0 0 1 63 54 V82Z" fill="url(#holeg)" stroke="#5e3d26" stroke-width="1.6"/>
        <path d="M39 80 V54.5 A11 11 0 0 1 61 54.5 V80" fill="none" stroke="#c99a68" stroke-width="1" opacity=".5"/>
        <path d="M27 82 Q33 76.4 50 76.4 Q67 76.4 73 82Z" fill="#87593a" stroke="#5e3d26" stroke-width="1.4" stroke-linejoin="round"/>
        <g stroke="#7a2d22" stroke-width=".8">
          <rect x="84" y="71" width="3" height="7" rx="1.2" fill="#f3e6d2"/>
          <path d="M80.5 72.5 Q85.5 63.5 90.5 72.5Z" fill="#d9483b"/>
          <rect x="90.6" y="75.5" width="2" height="4.5" rx=".9" fill="#f3e6d2"/>
          <path d="M88.6 76.4 Q91.6 71 94.6 76.4Z" fill="#d9483b"/>
        </g>
        <g fill="#fff"><circle cx="83.5" cy="69.5" r=".9"/><circle cx="87" cy="68" r=".8"/><circle cx="85.6" cy="71" r=".6"/><circle cx="91.5" cy="74.4" r=".6"/></g>
        <g stroke="#6e5130" stroke-width=".7">
          <rect x="11" y="74" width="1.8" height="5" rx=".8" fill="#efe1c8"/><path d="M8.6 75 Q11.9 70.5 15.2 75Z" fill="#b08a5a"/>
          <rect x="15.8" y="76" width="1.5" height="4" rx=".7" fill="#efe1c8"/><path d="M14 76.8 Q16.6 73.4 19.2 76.8Z" fill="#b08a5a"/>
        </g>`,
      lights: `
        <defs>${GLOW_GRAD('mg', '#b8ffd9')}</defs>
        <circle class="lt flk" cx="85.5" cy="70" r="8" fill="url(#mg)"/>
        <circle class="lt flk" cx="91.6" cy="75" r="5" fill="url(#mg)"/>
        <circle class="lt flk" cx="12" cy="75" r="5.5" fill="url(#mg)"/>`,
    },
    alpin: {
      name: 'Geröllhalde', w: 0.78, left: -0.1, vh: 64, sink: 4, hay: 0.84, mountains: true,
      perches: [[55, 11.5], [21, 30], [81, 30.2]],
      flowers: ['#ffffff', '#3d6fd6', '#ffffff', '#f6c945', '#b99cf0'],
      hole: { x1: 39, x2: 61, top: 34, lip: 55.3 },
      svg: `
        <defs>${HOLE_GRAD}</defs>
        <g stroke="#565b61" stroke-width="1.4" stroke-linejoin="round">
          <path d="M28 42 L37 17 L56 11 L73 21 L72 42Z" fill="#adb3b9"/>
          <path d="M0 62 L3 42 L14 29 L31 31 L39 46 L37 62Z" fill="#9aa1a8"/>
          <path d="M63 62 L61 44 L72 29 L89 31 L99 46 L98 62Z" fill="#8e959c"/>
        </g>
        <g fill="#fff" opacity=".22"><path d="M37 17 L56 11 L49 24Z"/><path d="M14 29 L31 31 L21 37Z"/><path d="M72 29 L89 31 L80 36Z"/></g>
        <g fill="#000" opacity=".12"><path d="M56 11 L73 21 L72 42 L62 30Z"/><path d="M31 31 L39 46 L37 62 L30 50Z"/><path d="M89 31 L99 46 L98 62 L90 48Z"/></g>
        <g fill="#c9c86a" opacity=".8"><ellipse cx="45" cy="20" rx="2.4" ry="1.2"/><ellipse cx="10" cy="40" rx="2" ry="1"/><ellipse cx="84" cy="36" rx="2.2" ry="1"/></g>
        <path d="M38 64 V45 A12 12 0 0 1 62 45 V64Z" fill="url(#holeg)" stroke="#565b61" stroke-width="1.4"/>
        <path d="M30 56 L51 54.9 L70 56.3 L72 63 L28 63Z" fill="#a3a9ae" stroke="#565b61" stroke-width="1.3" stroke-linejoin="round"/>
        <g fill="#9aa1a8" stroke="#565b61" stroke-width="1">
          <path d="M18 63 L21 58.5 L26 59 L27 63Z"/><path d="M74 63 L76 59.5 L80 59.2 L82 63Z"/><path d="M2 63 L4 60 L8 60.4 L9 63Z"/>
        </g>`,
    },
  };

  // So viele eingesammelte Blüten bleiben liegen (Heuhaufen oder Nische), die älteste macht Platz
  const STASH_MAX = 12;

  const HAY_SVG = `
  <svg viewBox="0 0 60 40" aria-hidden="true">
    <path d="M2 40 Q3 15 30 10 Q57 15 58 40Z" fill="#dcbc6a" stroke="#a9853a" stroke-width="1.4"/>
    <g stroke="#b38c3c" stroke-width="1.1" stroke-linecap="round" fill="none">
      <path d="M12 34 Q18 24 26 20"/><path d="M22 37 Q30 27 40 22"/><path d="M38 36 Q44 30 50 28"/>
      <path d="M28 10 Q26 4 21 2"/><path d="M33 11 Q37 5 43 4"/><path d="M8 26 Q14 20 18 18"/>
    </g>
    <g class="hayb"></g>
  </svg>`;

  // Grasstreifen über die ganze Breite: Boden (soil, Wiesenfarbe) ab y 9 = Bodenlinie, davor Halme in
  // Büscheln, damit Stiele, Pfosten, Steine und Heu unten im Gras verschwinden
  const TUFTS_SVG = () => {
    let d = '';
    for (let x = 0; x < 400; x += rnd(1.6, 3.2)) {
      const tall = Math.sin(x * 0.11) + Math.sin(x * 0.037) > 0.6; // Büschel
      const h = tall ? rnd(5, 9) : rnd(2, 5);
      const tip = x + 1.1 + rnd(-1.4, 1.4);
      d += `M${x.toFixed(1)} 10.5 Q${(x + 0.5).toFixed(1)} ${(10.5 - h / 2).toFixed(1)} ${tip.toFixed(1)} ${(10.5 - h).toFixed(1)}`
        + ` Q${(x + 1.5).toFixed(1)} ${(10.5 - h / 2).toFixed(1)} ${(x + 2.3).toFixed(1)} 10.5Z`;
    }
    return `<svg viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true">`
      + `<rect class="soil" y="9" width="400" height="3"/><path class="blades" d="${d}"/></svg>`;
  };

  // Aussichtsstein mit Geröll: von oben pfeift er, wie echte Pikas. Boden bei y 46, flache Oberseite bei y 13.
  const LOOKOUT_SVG = `
  <svg viewBox="0 0 100 50" aria-hidden="true">
    <g stroke="#5c6166" stroke-width="1.2" transform="translate(0 -1.6)">
      <path d="M-14 47.5 L-12 40 L-4 37.5 L3 40 L4 47.5Z" fill="#8e949b" stroke-linejoin="round"/>
      <ellipse cx="-22" cy="47.6" rx="2.4" ry="1.5" fill="#9aa0a6"/><ellipse cx="-17.5" cy="46.8" rx="3.6" ry="2.2" fill="#b0b5ba"/>
      <ellipse cx="104" cy="46.2" rx="5" ry="3" fill="#a3a9ae"/><ellipse cx="111" cy="47.4" rx="3.2" ry="1.9" fill="#979da4"/>
      <ellipse cx="116.5" cy="47.9" rx="2" ry="1.3" fill="#b0b5ba"/>
    </g>
    <path d="M6 47 L10 27 Q13 16 28 13.5 L72 12.5 Q87 13.5 91 25 L95 47Z" fill="#a3a9ae" stroke="#5c6166" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M91 25 L95 47 L70 47 Q80 36 91 25Z" fill="#000" opacity=".1"/>
    <path d="M28 15.5 Q48 13.6 70 14.4" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path class="rock-snow" d="M26 14 L74 13 Q86 14 89 21 Q80 17.5 70 18 Q50 16.5 30 18 Q20 18 13 22 Q16 15 26 14Z" fill="#f2f6f9"/>
    <path d="M42 24 l4 6 l-2 6 M70 30 l-3 5" stroke="#5c6166" stroke-width="1" fill="none" stroke-linecap="round" opacity=".7"/>
    <g fill="#c9c86a" opacity=".8"><ellipse cx="22" cy="30" rx="2.6" ry="1.3"/><ellipse cx="80" cy="22" rx="2" ry="1"/></g>
    <g stroke="#5c6166" stroke-width="1.2" transform="translate(0 -1.6)">
      <ellipse cx="4" cy="45" rx="6" ry="3.6" fill="#979da4"/><ellipse cx="13" cy="47" rx="4.5" ry="2.6" fill="#b0b5ba"/>
      <ellipse cx="-6" cy="47.2" rx="4" ry="2.4" fill="#a3a9ae"/><ellipse cx="20" cy="48.2" rx="2.4" ry="1.4" fill="#9aa0a6"/>
      <ellipse cx="96" cy="45.5" rx="6.5" ry="3.8" fill="#8e949b"/><ellipse cx="86" cy="47.2" rx="4" ry="2.4" fill="#a3a9ae"/>
      <ellipse cx="79" cy="48.2" rx="2.4" ry="1.4" fill="#b0b5ba"/>
      <ellipse cx="34" cy="47.6" rx="3.2" ry="1.8" fill="#9aa0a6"/><ellipse cx="64" cy="47.8" rx="3.6" ry="1.9" fill="#b0b5ba"/>
      <ellipse cx="50" cy="48" rx="2.2" ry="1.4" fill="#979da4"/><ellipse cx="27" cy="48.4" rx="1.8" ry="1.1" fill="#b0b5ba"/>
      <ellipse cx="71" cy="48.5" rx="1.8" ry="1.1" fill="#979da4"/>
    </g>
    <path class="rtuft" d="M18 49 Q19 44 20 42 Q21 45 22 49Z M24 49 Q25 45 27 43.5 Q26.5 46 27 49Z M74 49 Q75 44.5 76.5 42.5 Q77 46 78 49Z M79 49 Q80.5 45.5 82 44.5 Q81.5 47 82 49Z M40 49 Q41 46 42.5 45 Q42 47 43 49Z"/>
  </svg>`;

  // ==================== Festtage: Konstanten, Grafiken und Stil ====================
  // Deko im Jahreslauf. Ebenen: .fest-b hinter dem Land (.fsky Himmel: Feuerwerk, Fledermaus; .fback Tannenbaum,
  // Maibaum, Wimpel; .fon liegt auf dem Bau, aber hinter dem Pika: Lichterkette, Luftschlangen, Laterne) und .fest-f
  // vor Pika und Heu (.ffront Kürbis, Kranz, Stiefel, Kuchen, Eier; .fcf Konfetti; .fwl Lichtschein).
  // Jede Grafik: viewBox mit dem Boden an der Unterkante, .b wird wie das Land abgedunkelt, .g (Flammen, Lämpchen)
  // nicht; .nite leuchtet nur in Dämmerung und Nacht.
  const FEST_COLORS = ['#e8584e', '#f6c945', '#5fb9de', '#7cc35a', '#f28fb1', '#b99cf0', '#ff9f5a'];
  const FEST_FW_COLORS = ['#ff5a5f', '#ffd166', '#5fd1ff', '#b48cff', '#7dff9a', '#ff8ad8', '#fff3c4'];
  // Tagesnummer (Ortsdatum, ohne Sommerzeit-Sprünge)
  const festDay = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5);
  // Ostersonntag nach Gauß/Meeus (gregorianisch) → [Monat, Tag]
  const festEaster = (y) => {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return [Math.floor(n / 31), (n % 31) + 1];
  };
  // 1. Advent: vierter Sonntag vor dem 25. 12. (Tagesnummer)
  const festAdvent1 = (y) => festDay(y, 12, 25) - (new Date(y, 11, 25).getDay() || 7) - 21;
  // "Mia" / "Mia und Tom" / "Mia, Tom und Lea"
  const festNames = (a) => (a.length < 2 ? a[0] || '' : `${a.slice(0, -1).join(', ')} und ${a[a.length - 1]}`);
  const festF1 = (n) => n.toFixed(1);
  const festSvg = (vb, body, cls) => `<svg class="${cls}" viewBox="0 0 ${vb[0]} ${vb[1]}" aria-hidden="true">${body}</svg>`;
  const festBez = (a, b, c, d, t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
  };
  // Oberkante des Baus je Areal (Bau-Einheiten, etwas unter dem Rand): daran hängen Lichterkette und Luftschlangen
  const FEST_EDGE = {
    huegel: [
      ...[0.3, 0.45, 0.6, 0.75, 0.9].map((t) => festBez([-4, 60], [-3, 30], [22, 10], [50, 10], t)),
      ...[0.1, 0.25, 0.4, 0.55, 0.7].map((t) => festBez([50, 10], [78, 10], [103, 30], [104, 60], t)),
    ].map(([x, y]) => [x, y + 1.4]),
    fels: [[1, 41], [7, 32], [18, 28], [27, 20.5], [36, 14], [50, 12], [64, 14], [73, 20.5], [81, 32], [92, 35], [100.5, 45]],
    stumpf: [[19.4, 50], [20.6, 36], [22, 27.4], [33, 30.8], [50, 32.4], [67, 30.8], [78, 27.4], [79.4, 36], [80.6, 50]],
    alpin: [[2, 46], [5, 40], [14, 31], [24, 32], [31, 33], [34, 27], [37, 19], [46, 15.5], [56, 13], [65, 17.5], [72, 22.5],
      [73, 30.5], [80, 31.5], [89, 33], [94, 39], [98.5, 47]],
  };
  // Durchhängende Kette durch die Punkte: dichte Punkte im Abstand ~step, je Feld sag Durchhang
  const festChain = (pts, step, sag) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let k = i ? 1 : 0; k <= n; k++) {
        const t = k / n;
        out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)]);
      }
    }
    return out;
  };
  const festPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${festF1(x)} ${festF1(y)}`).join('');
  // Leuchtpunkte (Lichterkette, Baum): Verlauf je Farbe, ids pro Grafik eindeutig
  const festGlows = (p) => FEST_COLORS.map((c, i) => GLOW_GRAD(`${p}${i}`, c)).join('');
  const festBulbs = (pts, p, r) => pts.map(([x, y], i) => {
    const ci = (i * 3) % FEST_COLORS.length;
    return `<g class="fbl" style="animation-delay:${(-((i * 0.83) % 2.8)).toFixed(2)}s">`
      + `<circle cx="${festF1(x)}" cy="${festF1(y)}" r="${r * 2.6}" fill="url(#${p}${ci})"/>`
      + `<ellipse cx="${festF1(x)}" cy="${festF1(y)}" rx="${r * 0.72}" ry="${r}" fill="${FEST_COLORS[ci]}"/>`
      + `<circle cx="${festF1(x - r * 0.2)}" cy="${festF1(y - r * 0.35)}" r="${r * 0.28}" fill="#fff" opacity=".8"/></g>`;
  }).join('');

  // Lichterkette am Bau (Bau-Einheiten): Kabel mit Lämpchen; tags matt, in Dämmerung und Nacht leuchtend
  const FEST_LIGHTS = (edge) => {
    const ch = festChain(edge, 5.2, 1.5);
    const bulbs = ch.map(([x, y]) => [x, y + 1.7]);
    return {
      b: `<path d="${festPath(ch)}" stroke="#2f4a2a" stroke-width=".55" fill="none"/>`
        + bulbs.map(([x, y], i) => `<rect x="${festF1(x - 0.55)}" y="${festF1(y - 1.9)}" width="1.1" height=".9" fill="#36443a"/>`
          + `<ellipse cx="${festF1(x)}" cy="${festF1(y)}" rx="1.05" ry="1.45" fill="${FEST_COLORS[(i * 3) % FEST_COLORS.length]}" opacity=".7"/>`).join(''),
      g: `<defs>${festGlows('fst-l')}</defs><g class="nite">${festBulbs(bulbs, 'fst-l', 1.45)}</g>`,
    };
  };
  // Luftschlangen: zwei bunte, gewellte Schlangen über den Bau, dazu hängende Kringel
  const FEST_STREAMERS = (edge) => {
    const ch = festChain(edge, 1.6, 1.2);
    const wave = (dy, ph) => festPath(ch.map(([x, y], i) => [x, y + dy + Math.sin(i * 1.15 + ph) * 0.9]));
    // Kringel nur seitlich, nicht vor Tür und Schild
    const curls = edge.slice(1, -1).filter(([x], i) => i % 2 === 0 && (x < 33 || x > 67)).map(([x, y], i) => {
      const n = 2 + (i % 3);
      return `<path d="M${festF1(x)} ${festF1(y + 1)} ${'q1.5 1.6 0 3.2 q-1.5 1.6 0 3.2 '.repeat(n).trim()}" stroke="${FEST_COLORS[(i + 2) % FEST_COLORS.length]}"`
        + ` stroke-width=".85" fill="none" stroke-linecap="round"/>`;
    }).join('');
    return {
      b: `<path d="${wave(0, 0)}" stroke="#f28fb1" stroke-width=".95" fill="none" stroke-linecap="round"/>`
        + `<path d="${wave(2.4, 1.7)}" stroke="#f6c945" stroke-width=".95" fill="none" stroke-linecap="round"/>`
        + curls,
    };
  };

  // Geschnitzter Kürbis (viewBox 40 × 34), nachts leuchtet das Gesicht flackernd von innen
  const FEST_FACE = 'M11.6 19 L16.4 19 L14.2 14.6Z M23.6 19 L28.4 19 L25.8 14.6Z M18.7 22 L21.3 22 L20 19.8Z'
    + ' M11.4 24 Q20 31.4 28.6 24 L26.8 24.4 L25.3 26 L23.6 24.6 L21.8 26.2 L20 24.8 L18.2 26.2 L16.4 24.6 L14.7 26 L13.2 24.4Z';
  const FEST_PUMPKIN = {
    vb: [40, 34],
    b: `<path d="M19.5 9.5 Q18.6 3.5 21.6 1.4 L23.6 2.8 Q21.6 4.8 22.4 9.5Z" fill="#6f8f3c" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M23 3 q4 -2.5 6.5 .5" stroke="#6f8f3c" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <ellipse cx="11.5" cy="21.6" rx="10" ry="11.6" fill="#e9802a" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="28.5" cy="21.6" rx="10" ry="11.6" fill="#e9802a" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="20" cy="21.3" rx="10.4" ry="12.4" fill="#f5973a" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M14.5 13 Q12.6 18 13.6 25" stroke="#ffc583" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".75"/>
      <path d="${FEST_FACE}" fill="#4a2a12"/>`,
    g: `<defs>${GLOW_GRAD('fst-pg', '#ffb347')}</defs><g class="nite"><g class="fflk">
      <ellipse cx="20" cy="22" rx="25" ry="19" fill="url(#fst-pg)" opacity=".75"/>
      <path d="${FEST_FACE}" fill="#ffcf4d"/></g></g>`,
  };
  // Papierlaterne am Bau (viewBox 26 × 34): Stöckchen links steckt im Bau, Laterne schaukelt
  const FEST_LANTERN_BODY = `
      <rect x="9.5" y="8.4" width="8" height="2.2" rx=".8" fill="${OUT}"/>
      <ellipse cx="13.5" cy="18" rx="8.5" ry="8" fill="#e8584e" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="13.5" cy="18" rx="5.4" ry="7.9" fill="#f6c945"/>
      <ellipse cx="13.5" cy="18" rx="2.1" ry="7.9" fill="#5fb9de"/>
      <path d="M5.4 14.6 Q13.5 12.6 21.6 14.6 M5.2 21.4 Q13.5 23.4 21.8 21.4" stroke="rgba(90, 64, 48, .35)" stroke-width=".6" fill="none"/>
      <rect x="9.5" y="25.4" width="8" height="2" rx=".8" fill="${OUT}"/>
      <path d="M13.5 27.4 V31.6 M12.4 31.6 H14.6" stroke="#e8584e" stroke-width="1" stroke-linecap="round"/>`;
  const FEST_LANTERN = {
    vb: [26, 34],
    b: `<path d="M1 4.2 L15 1.6" stroke="#8a5a3b" stroke-width="1.6" stroke-linecap="round"/>
      <g class="lsw"><path d="M13.5 2 V8.6" stroke="${OUT}" stroke-width=".6"/>${FEST_LANTERN_BODY}</g>`,
    g: `<defs>${GLOW_GRAD('fst-mg', '#ffd27a')}</defs><g class="lsw"><g class="nite"><g class="fflk">
      <circle cx="13.5" cy="18" r="15" fill="url(#fst-mg)"/>
      <ellipse cx="13.5" cy="18" rx="7" ry="6.6" fill="#fff1b8" opacity=".45"/></g></g></g>`,
  };
  // Laterne am Stab, die der Pika trägt (in den Koordinaten der Pika-Grafik, viewBox 120 × 100)
  const FEST_CARRY = `<svg viewBox="0 0 120 100" aria-hidden="true">
    <defs>${GLOW_GRAD('fst-cg', '#ffd27a')}</defs>
    <path d="M101 63 L128 6" stroke="#8a5a3b" stroke-width="1.9" stroke-linecap="round"/>
    <g class="lsw">
      <circle class="lgl" cx="128" cy="27.6" r="21" fill="url(#fst-cg)"/>
      <g transform="translate(128 6) scale(1.35) translate(-13.5 -2)">
        <path d="M13.5 2 V8.6" stroke="${OUT}" stroke-width=".6"/>${FEST_LANTERN_BODY.replace('#e8584e', '#f28fb1').replace('#5fb9de', '#7cc35a')}
        <ellipse class="lgl" cx="13.5" cy="18" rx="6" ry="5.6" fill="#fff1b8" opacity=".5"/>
      </g>
    </g>
    <ellipse cx="101" cy="62.4" rx="4" ry="5" fill="#ecdcc6" stroke="${OUT}" stroke-width="1.4"/>
  </svg>`;
  // Adventskranz (viewBox 44 × 28): n Kerzen brennen
  const FEST_CANDLES = [[15.5, 15.6], [28.5, 15.6], [9, 21.6], [35, 21.6]]; // Kerzenfuß; brennen in Reihenfolge 1–4
  const FEST_WREATH = (n) => ({
    vb: [44, 28],
    b: `<ellipse cx="22" cy="19.6" rx="18.6" ry="6.2" fill="none" stroke="${OUT}" stroke-width="7"/>
      <ellipse cx="22" cy="19.6" rx="18.6" ry="6.2" fill="none" stroke="#2f6b33" stroke-width="5.4"/>
      <path d="M5 18 l2.2 -1 M9 15.4 l2.4 -.5 M16 13.8 l2.4 .1 M26 13.8 l2.4 -.1 M33 15 l2.4 .6 M37.4 18.4 l1.6 1.4
        M6 22.6 l2 1.2 M12 25 l2.4 .5 M30 25.4 l2.4 -.4 M36 23.2 l2 -1.2" stroke="#5fae4a" stroke-width="1" stroke-linecap="round"/>
      ${FEST_CANDLES.map(([x, y]) => `<rect x="${x - 1.7}" y="${y - 9}" width="3.4" height="9" rx=".8" fill="#d9483b" stroke="${OUT}" stroke-width=".7"/>
        <path d="M${x - 0.7} ${y - 7.6} V${y - 1.4}" stroke="#f08a7e" stroke-width=".7" stroke-linecap="round"/>
        <path d="M${x} ${y - 9} v-1.3" stroke="#3a2a20" stroke-width=".6"/>`).join('')}
      <g fill="#d9483b"><circle cx="7.4" cy="21" r="1"/><circle cx="20" cy="13.6" r="1"/><circle cx="31.6" cy="14.4" r=".9"/><circle cx="38" cy="21.4" r="1"/></g>
      <path d="M22 25.5 Q16.5 21.5 16.6 26.2 Q17 28.4 22 25.5Z M22 25.5 Q27.5 21.5 27.4 26.2 Q27 28.4 22 25.5Z" fill="#e8584e" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>
      <path d="M21.3 26 L19.6 30.4 L21.4 29.6Z M22.7 26 L24.4 30.4 L22.6 29.6Z" fill="#c94440" stroke="${OUT}" stroke-width=".5"/>
      <circle cx="22" cy="25.6" r="1.3" fill="#c94440" stroke="${OUT}" stroke-width=".6"/>`,
    g: `<defs>${GLOW_GRAD('fst-wg', '#ffcf70')}</defs>${FEST_CANDLES.slice(0, n).map(([x, y]) => {
      const t = y - 9.8;
      return `<g class="nite"><circle cx="${x}" cy="${t - 1.6}" r="6" fill="url(#fst-wg)"/></g>`
        + `<g class="flm"><path d="M${x} ${t - 4} Q${x + 1.9} ${t - 1.2} ${x} ${t} Q${x - 1.9} ${t - 1.2} ${x} ${t - 4}Z" fill="#ffb53a"/>`
        + `<path d="M${x} ${t - 2.4} Q${x + 0.9} ${t - 0.8} ${x} ${t} Q${x - 0.9} ${t - 0.8} ${x} ${t - 2.4}Z" fill="#fff3b0"/></g>`;
    }).join('')}`,
  });
  // Nikolausstiefel (viewBox 30 × 38), am 6. 12. gefüllt
  const FEST_BOOT = (full) => ({
    vb: [30, 38],
    b: `${full ? `
      <path d="M10 14 V4.6 Q10 1.2 13 1.2 Q16 1.2 16 4.2" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M10 14 V4.6 Q10 1.2 13 1.2 Q16 1.2 16 4.2" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M10 14 V4.6 Q10 1.2 13 1.2 Q16 1.2 16 4.2" stroke="#e8584e" stroke-width="2.2" fill="none" stroke-dasharray="1.5 1.5"/>
      <path d="M18 14 Q18.4 8 19.6 4.4" stroke="#4f8a3a" stroke-width="1.2" fill="none"/>
      <circle cx="19.8" cy="3.8" r="3" fill="none" stroke="#f7cf2e" stroke-width="1.4" stroke-dasharray="1 .7"/>
      <circle cx="19.8" cy="3.8" r="2.3" fill="#f7cf2e"/><circle cx="19.8" cy="3.8" r="1" fill="#eeac1c"/>
      <ellipse cx="7.4" cy="10.6" rx="2.6" ry="2.2" fill="#a86d3a" stroke="${OUT}" stroke-width=".7"/>
      <ellipse cx="14" cy="10.2" rx="2.4" ry="2.1" fill="#b57a45" stroke="${OUT}" stroke-width=".7"/>
      <path d="M6.4 10 q1 -.8 2 0 M13.1 9.6 q.9 -.7 1.8 0" stroke="#7a4a26" stroke-width=".5" fill="none"/>` : ''}
      <path d="M6 14 L6 33.5 Q6 37 9.5 37 L25.5 37 Q29 37 28.6 33.6 Q28.2 29.6 22.6 28.8 L20.4 28.2 L20.4 14Z" fill="#d9483b" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M6.6 35 H28.2" stroke="#7a2d22" stroke-width="1.2"/>
      <path d="M8.7 17.5 V29.5" stroke="#f08a7e" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
      <rect x="4.4" y="10.4" width="17.6" height="5.8" rx="2.9" fill="#f6f1ea" stroke="${OUT}" stroke-width="1"/>
      <g fill="#e2d9cc"><circle cx="8" cy="13.4" r=".8"/><circle cx="12.6" cy="12.6" r=".8"/><circle cx="17.4" cy="13.6" r=".8"/></g>`,
  });
  // Tannenbaum (viewBox 50 × 66) mit Kugeln, Lichterkette und Stern
  const FEST_GARLANDS = [[[14, 26], [25, 31], [35, 25]], [[10, 41], [25, 47], [40, 40]], [[6, 56], [25, 62], [44, 55]]];
  const FEST_TREE = (() => {
    const q = ([a, c, b], t) => [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
    const bulbs = FEST_GARLANDS.flatMap((gl) => [0.12, 0.31, 0.5, 0.69, 0.88].map((t) => q(gl, t)).map(([x, y]) => [x, y + 1.2]));
    const balls = [[16, 51, '#e8584e'], [34, 52, '#f6c945'], [25, 45.5, '#5fb9de'], [19, 37, '#f6c945'], [31, 36, '#e8584e'], [25, 20, '#5fb9de']];
    const star = 'M0 -5 L1.5 -1.6 L5 -1.5 L2.3 .8 L3.1 4.4 L0 2.4 L-3.1 4.4 L-2.3 .8 L-5 -1.5 L-1.5 -1.6Z';
    return {
      vb: [50, 66],
      b: `<rect x="21.5" y="56" width="7" height="10" fill="#8a5a3b" stroke="${OUT}" stroke-width="1"/>
        <path d="M3 58 Q25 63 47 58 L31 35 Q25 36.4 19 35Z" fill="#3f8a4a" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M8 42.5 Q25 47 42 42.5 L29.5 22 Q25 23 20.5 22Z" fill="#46944f" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M13 27.5 Q25 31 37 27.5 L25 8Z" fill="#4f9e57" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M21 14 L16.5 25 M18.5 27 L12 40 M15 43 L7.5 56" stroke="#7cc35a" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>
        ${FEST_GARLANDS.map(([a, c, b]) => `<path d="M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}" stroke="#2a3f28" stroke-width=".5" fill="none"/>`).join('')}
        ${balls.map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.3" fill="${c}" stroke="${OUT}" stroke-width=".6"/><circle cx="${x - 0.7}" cy="${y - 0.8}" r=".7" fill="#fff" opacity=".7"/>`).join('')}
        ${bulbs.map(([x, y], i) => `<circle cx="${festF1(x)}" cy="${festF1(y)}" r=".9" fill="${FEST_COLORS[(i * 3) % FEST_COLORS.length]}" opacity=".75"/>`).join('')}`,
      g: `<defs>${festGlows('fst-t')}${GLOW_GRAD('fst-ts', '#ffe27a')}</defs>
        <g class="nite"><circle cx="25" cy="7" r="9" fill="url(#fst-ts)"/>${festBulbs(bulbs, 'fst-t', 1.1)}</g>
        <path transform="translate(25 7)" d="${star}" fill="#ffd75a" stroke="#b8862a" stroke-width=".6" stroke-linejoin="round"/>`,
    };
  })();
  const FEST_GIFT = {
    vb: [24, 20],
    b: `<rect x="2.5" y="8" width="19" height="11.6" rx="1.2" fill="#5fb9de" stroke="${OUT}" stroke-width="1"/>
      <rect x="1.5" y="5.6" width="21" height="4" rx="1" fill="#86d0ec" stroke="${OUT}" stroke-width="1"/>
      <rect x="10.6" y="5.6" width="2.8" height="14" fill="#e8584e"/>
      <path d="M12 5.6 Q6.5 .5 7.6 4.6 Q8.4 6.6 12 5.6Z M12 5.6 Q17.5 .5 16.4 4.6 Q15.6 6.6 12 5.6Z" fill="#e8584e" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`,
  };
  // Maibaum (viewBox 40 × 160): Birkenstamm, Birkenkrone, Kranz, Bänder wehen mit dem Wind (nach rechts gezeichnet)
  const FEST_MAI = {
    vb: [40, 160],
    b: `<rect x="18.3" y="24" width="3.4" height="140" fill="#f4efe6" stroke="${OUT}" stroke-width=".8"/>
      <path d="M18.4 50 h1.7 M20 60 h1.5 M18.4 71 h1.9 M20.2 82 h1.3 M18.4 94 h1.6 M20 106 h1.5 M18.4 118 h1.8 M20 130 h1.4 M18.4 142 h1.7"
        stroke="#3a3330" stroke-width="1.2"/>
      <path d="M20 28 Q6 30 4.5 18 Q5 4 20 2 Q35 4 35.5 18 Q34 30 20 28Z" fill="#6bab4c" stroke="${OUT}" stroke-width="1.1"/>
      <path d="M10 10 Q8 18 9 25 M16 6 Q14 16 15 27 M25 6 Q27 16 25.5 27 M31 11 Q33 18 31.5 24" stroke="#4f8a3a" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse cx="13" cy="11" rx="4" ry="5" fill="#86c46b"/><ellipse cx="25" cy="15" rx="4.4" ry="5.6" fill="#86c46b" opacity=".85"/>
      <g class="rd">${[8.5, 12, 15.5, 24.5, 28, 31.5].map((x, i) => {
        const len = [34, 44, 30, 40, 32, 46][i];
        const s = len / 3;
        return `<path class="rb" style="animation-delay:${(-i * 0.37).toFixed(2)}s;animation-duration:${(1 + (i % 3) * 0.18).toFixed(2)}s"`
          + ` d="M${x} 47 q${festF1(s * 0.55)} ${festF1(s * 0.4)} ${festF1(s * 0.7)} ${festF1(s * 0.9)} t${festF1(s * 0.75)} ${festF1(s * 0.8)} t${festF1(s * 0.8)} ${festF1(s * 0.75)}"`
          + ` stroke="${FEST_COLORS[i]}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      }).join('')}</g>
      <ellipse cx="20" cy="46" rx="13" ry="3.8" fill="none" stroke="${OUT}" stroke-width="5"/>
      <ellipse cx="20" cy="46" rx="13" ry="3.8" fill="none" stroke="#5fae4a" stroke-width="3.6"/>
      <g><circle cx="8" cy="46.8" r="1.5" fill="#f28fb1"/><circle cx="14" cy="49.4" r="1.5" fill="#f6c945"/><circle cx="21.5" cy="49.8" r="1.5" fill="#fff"/>
        <circle cx="29" cy="48.6" r="1.5" fill="#b99cf0"/><circle cx="31.5" cy="43.6" r="1.3" fill="#f6c945"/><circle cx="11" cy="43" r="1.3" fill="#f28fb1"/></g>`,
  };
  // Geburtstagskuchen (viewBox 32 × 32) mit einer Kerze; .out = ausgepustet, Rauchfaden steigt auf
  const FEST_CAKE = {
    vb: [32, 32],
    b: `<ellipse cx="16" cy="30.4" rx="15" ry="2.2" fill="#f4f1ea" stroke="${OUT}" stroke-width=".9"/>
      <path d="M4.5 18 V27 Q16 31 27.5 27 V18Z" fill="#f3d7a6" stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M4.6 23.2 Q16 26.6 27.4 23.2" stroke="#fff6ea" stroke-width="1.6" fill="none"/>
      <path d="M4.5 18 Q4.6 21.6 6.2 21.4 Q7.4 21.2 7.8 20 Q9 23.6 10.6 22.4 Q11.6 21.4 13 21.6 Q14.4 24.2 16 22.6 Q17.4 21.4 19 21.8
        Q20.6 23.8 22 22 Q23 21 24.6 21.4 Q26.2 22.4 27.5 18Z" fill="#f7a8c4"/>
      <ellipse cx="16" cy="18" rx="11.5" ry="3.6" fill="#f7a8c4" stroke="${OUT}" stroke-width="1.1"/>
      <g stroke-width="1" stroke-linecap="round"><path d="M8.6 18.2 l1.2 -.5" stroke="#5fb9de"/><path d="M12 19.6 l1 .6" stroke="#f6c945"/>
        <path d="M20.4 19.4 l1.2 -.4" stroke="#7cc35a"/><path d="M23.6 17.6 l.8 .8" stroke="#5fb9de"/><path d="M11.4 16.4 l1 -.4" stroke="#fff"/></g>
      <circle cx="8.6" cy="16.4" r="1.5" fill="#e8584e" stroke="${OUT}" stroke-width=".6"/><circle cx="23.4" cy="16.2" r="1.5" fill="#e8584e" stroke="${OUT}" stroke-width=".6"/>
      <rect x="14.7" y="8.4" width="2.6" height="9.4" rx=".7" fill="#5fb9de" stroke="${OUT}" stroke-width=".6"/>
      <path d="M14.9 11 l2.2 -1.1 M14.9 13.8 l2.2 -1.1 M14.9 16.6 l2.2 -1.1" stroke="#fff" stroke-width=".7"/>
      <path d="M16 8.4 v-1.3" stroke="#3a2a20" stroke-width=".6"/>`,
    g: `<defs>${GLOW_GRAD('fst-kg', '#ffcf70')}</defs>
      <g class="nite khalo"><circle cx="16" cy="5" r="7.5" fill="url(#fst-kg)"/></g>
      <g class="flm"><path d="M16 2 Q18 5.2 16 7.4 Q14 5.2 16 2Z" fill="#ffb53a"/><path d="M16 4 Q17 5.8 16 7.1 Q15 5.8 16 4Z" fill="#fff3b0"/></g>
      <path class="smk" d="M16 6.8 q-1.8 -2.6 0 -5 t0 -5 t0 -5" stroke="rgba(235, 235, 240, .9)" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  };
  // Osterei (viewBox 12 × 15), Muster 0 Zickzack, 1 Punkte, 2 Streifen
  const FEST_EGG_PATH = 'M6 .8 C9.6 .8 11.4 6 11.4 9.4 C11.4 12.6 9 14.4 6 14.4 C3 14.4 .6 12.6 .6 9.4 C.6 6 2.4 .8 6 .8Z';
  const FEST_EGG = (c1, c2, kind) => `<path d="${FEST_EGG_PATH}" fill="${c1}" stroke="${OUT}" stroke-width=".8"/>${[
    `<path d="M1.3 8.4 L3 6.9 L4.7 8.4 L6.4 6.9 L8.1 8.4 L9.8 6.9 L10.9 7.9" stroke="${c2}" stroke-width="1.1" fill="none" stroke-linejoin="round"/>`,
    `<g fill="${c2}"><circle cx="4.2" cy="6" r=".95"/><circle cx="8" cy="6.6" r=".95"/><circle cx="6" cy="9.6" r=".95"/><circle cx="3.2" cy="11.2" r=".85"/><circle cx="8.8" cy="11.4" r=".85"/></g>`,
    `<path d="M1 7.8 Q6 9.2 11 7.8 M.8 10.8 Q6 12.2 11.2 10.8" stroke="${c2}" stroke-width="1.3" fill="none"/>`,
  ][kind]}<ellipse cx="4" cy="4.6" rx="1.1" ry="1.9" fill="#fff" opacity=".45" transform="rotate(20 4 4.6)"/>`;
  // Abgebrannter Raketenstab (viewBox 40 × 8), liegt im Gras
  const FEST_STICK = {
    vb: [40, 8],
    b: `<path d="M1 6.6 L29 5.2" stroke="#b08a5a" stroke-width="1.1" stroke-linecap="round"/>
      <rect x="28" y="2.2" width="10" height="4.6" rx="1" fill="#4d4a52" stroke="${OUT}" stroke-width=".7"/>
      <rect x="31" y="2.2" width="2" height="4.6" fill="#c94440"/>
      <path d="M38 2.6 L39.6 4.5 L38 6.4Z" fill="#2a2a2a"/>`,
  };
  // Fledermaus (viewBox 40 × 22), Flügel schlagen am Körper
  const FEST_BAT = `<svg viewBox="0 0 40 22" aria-hidden="true">
    <path class="w" d="M18 10 Q11 2 1.5 6.5 Q5.5 8 5 11.5 Q8.5 9.6 10 13.4 Q13 10.6 18 13Z" fill="#3b3048" stroke="#1f1828" stroke-width=".6"/>
    <path class="w" d="M22 10 Q29 2 38.5 6.5 Q34.5 8 35 11.5 Q31.5 9.6 30 13.4 Q27 10.6 22 13Z" fill="#3b3048" stroke="#1f1828" stroke-width=".6"/>
    <ellipse cx="20" cy="12" rx="3.4" ry="4.6" fill="#3b3048"/>
    <circle cx="20" cy="7.4" r="3" fill="#3b3048"/>
    <path d="M17.6 5.6 L17.8 2.6 L19.2 4.8Z M22.4 5.6 L22.2 2.6 L20.8 4.8Z" fill="#3b3048"/>
    <circle cx="18.9" cy="7.2" r=".6" fill="#ffd45a"/><circle cx="21.1" cy="7.2" r=".6" fill="#ffd45a"/>
  </svg>`;

  const STYLE_FEST = `
  .fest-b, .fest-f, .fest-b > div, .fest-f > div { position: absolute; inset: 0; pointer-events: none; }
  .fest-f { z-index: 3; }
  /* liegt auf dem Bau, aber hinter dem Pika (z-index 3) */
  .fest-b > .fon { z-index: 1; }
  .fi { position: absolute; }
  .fi > svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
  .fi .b { transition: filter 2.5s; }
  .day.overcast .fi .b { filter: brightness(.9) saturate(.8); }
  .dusk .fi .b { filter: brightness(.85) saturate(.85); }
  .night .fi .b { filter: brightness(.5) saturate(.6); }
  .fi .nite { opacity: 0; transition: opacity 2.5s; }
  .dusk .fi .nite { opacity: .75; }
  .night .fi .nite { opacity: 1; }
  /* Flackern und Blinken nur in Dämmerung und Nacht: tags ist .nite unsichtbar, das Neuzeichnen spart sich das Tablet */
  .dusk .fflk, .night .fflk { animation: fflk 2.2s ease-in-out infinite alternate; }
  @keyframes fflk { 0% { opacity: 1; } 25% { opacity: .7; } 40% { opacity: .95; } 65% { opacity: .78; } 100% { opacity: 1; } }
  .flm { transform-box: fill-box; transform-origin: 50% 100%; animation: fflame .45s ease-in-out infinite alternate; }
  @keyframes fflame { from { transform: scale(.88, 1.06) rotate(-5deg); } to { transform: scale(1.06, .9) rotate(4deg); } }
  .dusk .fbl, .night .fbl { animation: fblink 2.8s ease-in-out infinite alternate; }
  @keyframes fblink { 0%, 45% { opacity: 1; } 100% { opacity: .3; } }
  .lsw { transform-box: view-box; animation: flsw 2.6s ease-in-out infinite alternate; }
  .flan .lsw { transform-origin: 13.5px 2px; }
  .fest-carry .lsw { transform-origin: 128px 6px; animation-duration: 1.3s; }
  @keyframes flsw { from { transform: rotate(-6deg); } to { transform: rotate(6deg); } }
  /* Ostereier: antippen = wackeln */
  .fegg { pointer-events: auto; cursor: pointer; }
  .fegg > svg { left: 6px; top: 6px; width: calc(100% - 12px); height: calc(100% - 12px); transform-origin: 50% 100%; }
  .fegg.wob > svg { animation: fwob .8s ease-in-out; }
  @keyframes fwob { 15% { transform: rotate(-14deg); } 35% { transform: rotate(11deg); } 55% { transform: rotate(-7deg); } 75% { transform: rotate(4deg); } }
  /* Kuchen: ausgepustet */
  .fcake .smk { opacity: 0; stroke-dasharray: 22; stroke-dashoffset: 22; transform-box: fill-box; }
  .fcake.out .flm, .fcake.out .khalo { display: none; }
  .fcake.out .smk { animation: fsmk 2.6s ease-out forwards; }
  @keyframes fsmk { 0% { opacity: .9; stroke-dashoffset: 22; } 50% { opacity: .7; } 100% { opacity: 0; stroke-dashoffset: 0; transform: translate(1px, -4px); } }
  /* Maibaum: Bänder wehen in Windrichtung (--wd) */
  .fmai .rd { transform-box: view-box; transform-origin: 20px 46px; transform: scaleX(var(--wd, 1)); transition: transform 3s; }
  .fmai .rb { transform-box: view-box; transform-origin: 20px 46px; animation: frib 1.2s ease-in-out infinite alternate; }
  @keyframes frib { from { transform: rotate(-4deg) skewY(3deg); } to { transform: rotate(5deg) skewY(-4deg); } }
  .windy .fmai .rb { animation-duration: .55s; }
  /* Wimpel und Girlande: die Grafik ist kartengroß, darum ohne Filter (der müsste jedes Bild neu gerechnet
     werden); abgedunkelt wird über die Deckkraft, nachts hängen die Wimpel still */
  .scene .fi.fwim .b { filter: none; transition: none; }
  .fwim { transition: opacity 2.5s; }
  .dusk .fwim { opacity: .85; }
  .night .fwim { opacity: .6; }
  .fpn { transform-box: fill-box; transform-origin: 50% 0; animation: fpn 2.4s ease-in-out infinite alternate; }
  @keyframes fpn { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
  .windy .fpn { animation-duration: .9s; }
  .night .fpn { animation-play-state: paused; }
  /* Hüte am Pika: Weihnachtsmütze ersetzt beim Schlafen die Zipfelmütze, die anderen nur wach */
  .hats > g { display: none; }
  .fest-witch .hat-witch, .fest-party .hat-party, .fest-xmas .hat-xmas { display: inline; }
  .sleeping .hat-witch, .sleeping .hat-party { display: none; }
  .pika.sleeping.fest-xmas .cap { display: none; }
  /* St. Martin: Laterne am Stab */
  .fest-carry { position: absolute; inset: 0; display: none; pointer-events: none; }
  .fest-lantern .fest-carry { display: block; }
  .fest-carry svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .fest-carry .lgl { opacity: .45; transition: opacity 2.5s; }
  .dusk .fest-carry .lgl { opacity: .8; }
  .night .fest-carry .lgl { opacity: 1; }
  /* Zucken beim Knall */
  .pika.fest-zuck .hop { animation: fzuck .4s ease-out; }
  @keyframes fzuck { 25% { transform: translateY(-6%) scale(.96, 1.05); } 60% { transform: scale(1.04, .96); } }
  /* Fledermaus */
  .fbat { position: absolute; left: 0; top: 0; width: calc(var(--H) * .085); margin: calc(var(--H) * -.024) 0 0 calc(var(--H) * -.042); }
  .fbat svg { display: block; width: 100%; height: auto; overflow: visible; }
  .fbat .w { transform-box: view-box; transform-origin: 20px 11px; animation: fbflap .15s ease-in-out infinite alternate; }
  @keyframes fbflap { to { transform: scaleY(-.45); } }
  /* Feuerwerk: Rakete mit Schweif, Kugel aus Sternchen, Funken rieseln, Lichtschein auf der Wiese */
  .fwr {
    position: absolute; left: 0; top: 0; width: 2px; height: calc(var(--H) * .06); margin-left: -1px; border-radius: 1px;
    transform-origin: 50% 0; background: linear-gradient(#fff6d6, rgba(255, 190, 110, .7) 30%, rgba(255, 160, 90, 0));
    box-shadow: 0 0 4px rgba(255, 230, 160, .8);
  }
  .fwb { position: absolute; width: 0; height: 0; }
  .fwb i { position: absolute; left: 0; top: 0; display: block; border-radius: 50%; }
  .fwb .fwp { width: calc(var(--H) * .018); height: calc(var(--H) * .018); margin: calc(var(--H) * -.009); background: var(--c); box-shadow: 0 0 5px 1.5px var(--c); }
  .fwb .fws { width: 2px; height: 2px; margin: -1px; background: #fff8dc; box-shadow: 0 0 3px 1px rgba(255, 240, 190, .9); }
  .fwb .fwc {
    width: calc(var(--H) * .07); height: calc(var(--H) * .07); margin: calc(var(--H) * -.035);
    background: radial-gradient(closest-side, #fff, var(--c) 45%, transparent); animation: fwc .5s ease-out forwards;
  }
  @keyframes fwc { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.7); opacity: 0; } }
  .fest-f > .fwl { opacity: 0; background: radial-gradient(ellipse 95% 85% at var(--fx, 50%) var(--fy, 20%), var(--fc, #fff), transparent 80%); }
  .fest-f > .fwl.go { animation: fwl 1.1s ease-out; }
  @keyframes fwl { 8% { opacity: .2; } 100% { opacity: 0; } }
  .fcf i { position: absolute; top: 0; display: block; }
  `;
  // ==================== Ende Festtage ====================

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

  // ==================== Freund-Pika: Konstanten, Grafiken und Stil ====================
  // Pino ist 0,85-mal so groß wie der Pika, ingwerfarben, mit hellem Fleck auf der Stirn und türkisem Halstuch
  // (so ist er auch auf dem kleinen Tablet gleich zu erkennen). Seine Grafik entsteht aus PIKA_SVG: eigene ids
  // für Fellverlauf und Bauch-Clip (sonst griffe er auf die des Pikas zu), warme Fell-, Bauch- und Ohrenfarben.
  // Zubehör, das er nie braucht, entfernt _friendBuild aus seinem DOM.
  const FRIEND_SCALE = 0.85;
  // Besuchsplan wie bei Vögelchen und Maus aus der Uhr: 45-Minuten-Fenster, in jedem ein Besuch (p 1, im Mittel
  // 45 Min wie früher 25–60 Min Pause + 1,5–4 Min Besuch), Start in den ersten 20 Minuten, also 21–65 Min
  // zwischen zwei Besuchen. Dauer 1,5–4 Minuten, Seite links/rechts – alles aus seedRnd('friend', fenster, n).
  const FRIEND_WIN = { win: 45 * 6e4, p: 1, spread: 20 * 6e4, stay: [1.5, 4] };
  const FRIEND_SVG = [
    ['id="fur"', 'id="fur2"'], ['url(#fur)', 'url(#fur2)'],
    ['id="bodyclip"', 'id="bodyclip2"'], ['url(#bodyclip)', 'url(#bodyclip2)'],
    ['#d0ad8d', '#f2b36e'], ['#b08a68', '#dc8640'], ['#8a664b', '#a9592a'], // Fellverlauf
    ['#f0e2cf', '#fbe7cb'], // Bauch
    ['#efe3d3', '#f8e4cc'], ['#e3a990', '#f0a184'], // Ohrenrand, Ohr innen
    ['#d6b796', '#efb47c'], // Rückansicht
  ].reduce((svg, [a, b]) => svg.split(a).join(b), PIKA_SVG)
    .replace('<g clip-path="url(#bodyclip2)">',
      '$&<ellipse class="blaze" cx="89.5" cy="32.5" rx="4.8" ry="3.2" fill="#fbf0e2" opacity=".92"/>')
    // Halstuch unter dem Kinn, hinter Pfoten und Blume (vor .mfood), der Winterschal liegt darüber
    .replace('<g class="mfood">', `<g class="bandana">
        <path d="M70.5 62 Q87.5 70.5 105 61.6" stroke="${OUT}" stroke-width="5.4" fill="none" stroke-linecap="round"/>
        <path d="M70.5 62 Q87.5 70.5 105 61.6" stroke="#22b5a6" stroke-width="3.8" fill="none" stroke-linecap="round"/>
        <path d="M79.5 65.2 L95.5 65.6 L86.6 76.4Z" fill="#22b5a6" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
        <g fill="#f4fbf8"><circle cx="84.4" cy="67.6" r="1"/><circle cx="90.4" cy="67.8" r="1"/><circle cx="87" cy="71.6" r=".9"/>
          <circle cx="75" cy="64.6" r=".8"/><circle cx="100" cy="64.2" r=".8"/></g>
      </g>
      $&`);
  // Gemeinsame Spiele (Aktionen des Pikas). Solange eine läuft, steuert sie auch Pino.
  const FRIEND_ACTS = new Set(['greetFriend', 'chaseFriend', 'sitWithFriend', 'rockWithFriend', 'nibbleWithFriend', 'squeakDuet']);
  // Pinos eigener Ablauf gibt die Kontrolle ab (gemeinsames Spiel, Streicheln, Abschied)
  const FRIEND_YIELD = { friendYield: true };
  // Zustandsklassen an Pino, die beim Übergeben der Kontrolle zurückgesetzt werden
  const FRIEND_CLS = ['walking', 'groom', 'eating', 'look-f', 'look-b', 'look-up', 'calling', 'crouch', 'happy', 'nuzzle', 'wiggle'];
  // Die Zustandsklassen (walking, blink, twitch-l, happy, groom, calling, look-f, left …) wirken über allgemeine
  // Regeln aus STYLE, die nicht an .pika hängen; Pino trägt sie an seinem eigenen .friend-Element. --ph/--pw
  // setzt das Skript an .friends auf Pinos Größe, damit Sprechblase, Schatten usw. mitskalieren.
  const STYLE_FRIEND = `
  .friends { position: absolute; inset: 0; pointer-events: none; }
  .friend {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: 3; cursor: pointer; pointer-events: auto; will-change: transform;
  }
  /* Pinos Sprechblase: gleiche Lage wie .friend, aber über dem Pika (beide z 3, der Pika liegt im DOM dahinter) */
  .frsay {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: 4; pointer-events: none;
  }
  /* Nasenstupsen und Heranrücken: kurz nach vorn zum anderen lehnen (Pika und Pino) */
  .pika.nuzzle .hop, .friend.nuzzle .hop { animation: nuzzle .8s ease-in-out; }
  @keyframes nuzzle { 35%, 60% { transform: translateX(8%) rotate(5deg) scale(1.03, .97); } }
  /* Ohrenwackeln beim Zusammensitzen */
  .pika.wiggle .ear-l, .friend.wiggle .ear-l { animation: fwiggle .3s ease-in-out 4 alternate; }
  .pika.wiggle .ear-r, .friend.wiggle .ear-r { animation: fwiggle .3s .12s ease-in-out 4 alternate-reverse; }
  @keyframes fwiggle { from { transform: rotate(-13deg); } to { transform: rotate(9deg); } }
  `;
  // ==================== Ende Freund-Pika ====================

  const ICON_LEAF = `<svg viewBox="0 0 24 24"><path fill="#6bb152" d="M17 8C8 10 5.9 16.2 3.8 21.3l1.9.7 1-2.3c.5.2 1 .3 1.3.3C19 20 22 3 22 3c-1 2-8 2.3-13 3.3S2 11.5 2 13.5s1.8 3.8 1.8 3.8C7 8 17 8 17 8z"/></svg>`;
  const ICON_HEART = `<svg viewBox="0 0 24 24"><path fill="#f07a95" d="M12 21.4l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.5z"/></svg>`;
  const STAR = 'M12 1 Q13.4 10.6 23 12 Q13.4 13.4 12 23 Q10.6 13.4 1 12 Q10.6 10.6 12 1Z';
  const ICON_SPARK = `<svg viewBox="0 0 24 24"><path fill="#5fb9de" d="${STAR}"/><path fill="#5fb9de" transform="translate(15 0) scale(.38)" d="${STAR}"/></svg>`;

  // Häufchen aus 3–5 runden Köttelchen (viewBox 24 × 14, Boden bei y 14). r = fester Zufall 0..1
  const POO_LAYOUTS = [
    [[8.5, 10.6], [15.5, 10.8], [12, 5.6]],
    [[5.5, 10.8], [12, 11], [18.5, 10.6], [9, 5.8], [15.4, 6]],
    [[6, 10.8], [12.4, 11], [18.6, 10.8], [12, 5.6]],
    [[8, 10.8], [14.6, 10.6], [11.4, 5.6], [20.6, 11.6]],
  ];
  const POO_SVG = (r) => {
    const pts = POO_LAYOUTS[Math.floor(r * POO_LAYOUTS.length)];
    return `<svg viewBox="0 0 24 14" aria-hidden="true">${pts.map(([x, y], i) => {
      const rx = 3.3 - (i % 2) * 0.25;
      return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.9}" fill="#6e4b30" stroke="#3f2a1b" stroke-width=".7"/>`
        + `<ellipse cx="${x - 1}" cy="${y - 1.1}" rx="1.1" ry=".75" fill="#a47a52" opacity=".75"/>`;
    }).join('')}</svg>`;
  };
  // ---------- Besucher ----------
  // Rundes Vögelchen (viewBox 30 × 26, Füße bei y 26, schaut nach rechts). Sitzend liegt der Flügel an (.wf),
  // im Flug schlägt der hochgestellte Flügel (.wu). Kopf .bh dreht sich am Hals (Picken, Kopf schief).
  const BIRDS = [
    { name: 'Rotkehlchen', body: '#a08b70', head: '#a08b70', wing: '#85705a', breast: '#f2843a', face: '#f2843a', beak: '#3a2f28' },
    { name: 'Blaumeise', body: '#f2d14f', head: '#fbfbf7', wing: '#5b97d8', breast: '#f6dc6a', cap: '#4f8fd6', stripe: '#2c3a5a', beak: '#3a2f28' },
    { name: 'Spatz', body: '#b38d66', head: '#a8805a', wing: '#86603f', breast: '#ebe0cf', cap: '#8e9196', bib: '#3a302a', beak: '#4a3a2c' },
  ];
  const BOUT = '#4a3a2c';
  const BIRD_SVG = (v) => `
  <svg viewBox="0 0 30 26" aria-hidden="true">
    <path d="M7.5 15.5 L.6 11.6 Q-.2 15.4 1.6 18.6Z" fill="${v.wing}" stroke="${BOUT}" stroke-width=".8" stroke-linejoin="round"/>
    <g class="legs" stroke="#c98a4b" stroke-width="1" stroke-linecap="round" fill="none">
      <path d="M12.5 22.5 V25.4 M11 25.6 H14 M16.5 22.5 V25.4 M15 25.6 H18"/>
    </g>
    <ellipse cx="14" cy="16.2" rx="10" ry="7.9" fill="${v.body}" stroke="${BOUT}" stroke-width="1"/>
    <ellipse cx="17.6" cy="18" rx="6" ry="4.8" fill="${v.breast}"/>
    <path class="wf" d="M6.6 13.8 Q13 10 18.6 14.6 Q14 20.4 7.4 17.2Z" fill="${v.wing}" stroke="${BOUT}" stroke-width=".7" stroke-linejoin="round"/>
    <path class="wu" d="M9 14 Q4.6 1.6 16.4 3.2 Q17.4 9 15.4 14Z" fill="${v.wing}" stroke="${BOUT}" stroke-width=".7" stroke-linejoin="round"/>
    <g class="bh">
      <circle cx="20.5" cy="9.6" r="6.3" fill="${v.head}" stroke="${BOUT}" stroke-width="1"/>
      ${v.face ? `<ellipse cx="22.2" cy="12.4" rx="4.3" ry="3.3" fill="${v.face}"/>` : ''}
      ${v.cap ? `<path d="M14.5 7.7 A6.3 6.3 0 0 1 26.5 7.7Z" fill="${v.cap}"/>` : ''}
      ${v.stripe ? `<path d="M15.2 10.6 Q20 9.6 26.6 9.4" stroke="${v.stripe}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` : ''}
      ${v.bib ? `<ellipse cx="23.6" cy="14" rx="1.9" ry="1.4" fill="${v.bib}"/>` : ''}
      <circle cx="23" cy="8.7" r="1.35" fill="#1f1a17"/><circle cx="23.4" cy="8.2" r=".45" fill="#fff"/>
      <circle cx="22.4" cy="11.8" r="1.3" fill="#f28fb1" opacity=".45"/>
      <path d="M26.3 9.2 L29.6 10.5 L26.3 11.8Z" fill="${v.beak}" stroke="${v.beak}" stroke-width=".4" stroke-linejoin="round"/>
    </g>
  </svg>`;
  // Kleine Maus (viewBox 32 × 18, Füße bei y 18, schaut nach rechts), Schwanz ragt links heraus
  const MOUSE_SVG = `
  <svg viewBox="0 0 32 18" aria-hidden="true">
    <path class="mtail" d="M5.5 14.5 Q-1 16 -3.5 11.5 Q-5.5 7 -1.5 5.5" stroke="#c99a98" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <circle cx="16.8" cy="5" r="3" fill="#a8998c" stroke="#5f544b" stroke-width=".8"/>
    <circle cx="16.8" cy="5" r="1.8" fill="#f2b8bd"/>
    <ellipse cx="12.6" cy="12" rx="8.8" ry="5.8" fill="#a8998c" stroke="#5f544b" stroke-width=".9"/>
    <ellipse cx="14" cy="14.6" rx="5.6" ry="2.8" fill="#e9ded2"/>
    <g class="mhead">
      <path d="M16 7.8 Q22 4.6 28.4 10.4 Q27.4 12.8 23 12.8 Q17.6 12.8 16 10Z" fill="#a8998c" stroke="#5f544b" stroke-width=".9" stroke-linejoin="round"/>
      <g class="mear"><circle cx="20.4" cy="4.4" r="3.4" fill="#a8998c" stroke="#5f544b" stroke-width=".8"/>
      <circle cx="20.4" cy="4.4" r="2.1" fill="#f2b8bd"/></g>
      <circle cx="23.4" cy="8.6" r="1.05" fill="#1f1a17"/><circle cx="23.7" cy="8.25" r=".35" fill="#fff"/>
      <circle class="mnose" cx="28.3" cy="10.3" r="1" fill="#e98a96"/>
      <path class="whisk" d="M27 11 L31.2 9.6 M27 11.3 L31.4 11.6 M26.8 11.6 L30.6 13.2" stroke="#5f544b" stroke-width=".35" fill="none"/>
    </g>
    <g fill="#f2b8bd"><ellipse cx="8.6" cy="17.4" rx="2" ry=".9"/><ellipse cx="18" cy="17.4" rx="2" ry=".9"/></g>
  </svg>`;
  // Kehrschaufel mit Holzstiel, liegt bei y 22 auf dem Boden
  const SCOOP_SVG = `
  <svg viewBox="0 0 44 24" aria-hidden="true">
    <path d="M23 12 L42 2" stroke="#a87c4f" stroke-width="3" stroke-linecap="round"/>
    <path d="M23 12 L42 2" stroke="#6b4a2f" stroke-width="3.6" stroke-linecap="round" opacity=".25"/>
    <path d="M1 22 L22 22 L25 9 L21.5 9 L19.6 18.6 L1.6 19.4Z" fill="#8fb4c9" stroke="#4d6878" stroke-width="1.1" stroke-linejoin="round"/>
  </svg>`;

  // ---------- Stil ----------

  // ==================== Haus-Bote: Konstanten, Grafiken und Stil ====================
  // Waschmaschine, Trockner und Spülmaschine (Home Connect) stehen als kleine Requisiten am Bau. Phasen je
  // Gerät: run (läuft), done (fertig, noch nicht geöffnet), empty (ausgeräumt, 20 Minuten lang).
  // Grafiken in Einheiten von BOTE_K × Kartenhöhe; vb = viewBox, ground = Bodenlinie, vt = sichtbare
  // Oberkante (für das Fähnchen), part = Hauptteil in x (Fortschrittsbalken, Hingehen), back = zu hoch für den
  // vorderen Wiesenstreifen (bleibt hinten).
  const BOTE_K = 0.004;
  const BOTE_EMPTY_MS = 20 * 60000;
  // Spüler mit AutoOpen öffnen die Tür am Programmende selbst einen Spalt: so lange zählt Tür auf nicht als ausgeräumt
  const BOTE_AUTOOPEN_MS = 2 * 60000;
  // Vorn auf dem Wiesenstreifen: so viel größer und so viel × Kartenhöhe tiefer als hinten
  const BOTE_FRONT = 1.1;
  const BOTE_FRONT_DY = 0.07; // ganz vorn am unteren Rand, der Fortschrittsbalken liegt auf dem Fuß des Requisits
  const BOTE_TALL = 0.55; // die hohe Wäscheleine steht vorn kleiner
  const BOTE_RUN = new Set(['run', 'pause', 'delayedstart', 'actionrequired', 'error', 'aborting']);
  const BOTE_HALT = new Set(['pause', 'delayedstart', 'actionrequired', 'error', 'aborting']);
  const BOTE_IDLE = new Set(['ready', 'inactive', 'off', 'standby']);
  // Kein echter Zustand (WLAN weg, Neustart): Gerät behält, was es zuletzt war
  const BOTE_DEAD = new Set(['', 'unavailable', 'unknown', 'none', 'notconnected']);
  const BOTE_WARNED = new Set(); // schon gemeldete Konfigurationsfehler (console.warn nur einmal)
  // Zustandsnamen anderer Integrationen (Miele, LG ThinQ, SmartThings …) auf Home Connect abbilden.
  // Schlüssel wie norm() in _boteRead: klein, ohne Leerzeichen, _ und -.
  const BOTE_ALIAS = {
    running: 'run', inuse: 'run', washing: 'run', rinsing: 'run', spinning: 'run', drying: 'run', cooling: 'run',
    detecting: 'run', steam: 'run', rinse: 'run', spin: 'run', wash: 'run', dry: 'run', active: 'run',
    paused: 'pause', rinsehold: 'pause',
    waitingtostart: 'delayedstart', reservation: 'delayedstart', reserved: 'delayedstart', delayed: 'delayedstart', scheduled: 'delayedstart',
    failure: 'error', fault: 'error', programinterrupted: 'error', service: 'actionrequired',
    programended: 'finished', end: 'finished', finish: 'finished', done: 'finished', complete: 'finished', completed: 'finished',
    on: 'ready', idle: 'ready', programmed: 'ready', initial: 'ready', stop: 'ready', standby: 'ready',
    off: 'inactive', poweroff: 'inactive', sleep: 'inactive',
  };
  const BOTE_TYPE = {
    washer: 'washer', washingmachine: 'washer', waschmaschine: 'washer',
    dryer: 'dryer', tumbledryer: 'dryer', trockner: 'dryer',
    dishwasher: 'dishwasher', dish: 'dishwasher', geschirrspueler: 'dishwasher', geschirrspuler: 'dishwasher',
    'geschirrspüler': 'dishwasher', spuelmaschine: 'dishwasher', 'spülmaschine': 'dishwasher',
  };
  const BOTE_NAME = { washer: 'Waschmaschine', dryer: 'Trockner', dishwasher: 'Spülmaschine' };
  const BOTE_COLOR = { washer: '#5fb9de', dryer: '#f0a04b', dishwasher: '#7cc35a' };
  const BOTE_ACT = { washer: 'boteStir', dryer: 'boteWatchDrum', dishwasher: 'boteDip' };
  const BOTE_SAY = { washer: ['Wäsche!', 'fertig!', 'Wäsche!'], dryer: ['fertig!', 'Trockner!'], dishwasher: ['Geschirr!', 'fertig!', 'Geschirr!'] };

  const BOTE_BUBS = (pts) => `<g class="hb-bubs">${pts.map(([x, y, r], i) =>
    `<circle cx="${x}" cy="${y}" r="${r}" style="animation-delay:${(-i * 0.65).toFixed(2)}s"/>`).join('')}</g>`;
  const BOTE_DROP = (x, y, d) => `<g transform="translate(${x} ${y})"><path class="hb-drip" style="animation-delay:${d}s" d="M0 0 q1.3 2 0 3 q-1.3 -1 0 -3z"/></g>`;

  // Holzzuber mit Seifenschaum (x 4..42, Boden y 42); im Betrieb steigen Blasen auf
  const BOTE_TUB = (run) => `
    <path d="M4 18 H42 L38.6 41 Q23 43.4 7.4 41Z" fill="#ad8664" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M13.5 19 L14.6 42 M23 19 V42.6 M32.5 19 L31.4 42" stroke="#8a664b" stroke-width=".9"/>
    <path d="M4.8 24.6 Q23 27.6 41.2 24.6 M6.3 35 Q23 38 39.7 35" stroke="#76838f" stroke-width="2.1" fill="none" stroke-linecap="round"/>
    <path d="M5 24 Q23 27 41 24 M6.5 34.4 Q23 37.4 39.5 34.4" stroke="#b5c0c9" stroke-width=".6" fill="none"/>
    <ellipse cx="23" cy="18" rx="19.5" ry="4.6" fill="#c9a27e" stroke="${OUT}" stroke-width="1.3"/>
    <ellipse cx="23" cy="18.4" rx="16.2" ry="3.1" fill="#8fc8e2"/>
    <g class="hb-paddle"><path d="M30 16 L38 1.6" stroke="${OUT}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M30 16 L38 1.6" stroke="#c9a27e" stroke-width="2" stroke-linecap="round"/></g>
    <g class="hb-foam" fill="#fff" stroke="#c9dde8" stroke-width=".5">
      <circle cx="12.5" cy="16.8" r="3.6"/><circle cx="18.5" cy="15.2" r="4.4"/><circle cx="26.2" cy="15.4" r="4.1"/>
      <circle cx="33" cy="16.8" r="3.4"/><circle cx="22.4" cy="17.8" r="3.2"/>
    </g>
    <g fill="#e3f3fb"><circle cx="17.2" cy="13.6" r="1.1"/><circle cx="25.4" cy="13.8" r="1"/><circle cx="32" cy="15.6" r=".7"/></g>
    ${run ? BOTE_BUBS([[15, 11, 1.8], [24, 10, 2.3], [30.5, 12, 1.5], [20, 11.5, 1.3]]) : ''}`;

  // Wäschekorb, Rand oben links bei (0, 0), 32 breit, Boden bei y 14.6. .hb-lau = nasse Wäsche (tropft)
  const BOTE_BASKET = `
    <g class="hb-lau">
      <path d="M3 2 Q3 -5 9 -4 Q12 -9 18 -6 Q23 -9 26 -4 Q31 -4 30 2Z" fill="#7cb4e0" stroke="${OUT}" stroke-width="1"/>
      <path d="M13 -.6 Q15 -6.5 20 -4.6 Q23.5 -5.4 24.4 0Z" fill="#f2a7b8" stroke="${OUT}" stroke-width=".8"/>
      <circle cx="7.6" cy="-.4" r="3.4" fill="#f6c945" stroke="${OUT}" stroke-width=".8"/>
    </g>
    <path d="M1 1.4 H31 L28.4 13.6 Q16 15.4 3.6 13.6Z" fill="#d9b07c" stroke="${OUT}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M2.2 5.8 Q16 7.4 29.8 5.8 M3 9.8 Q16 11.4 29 9.8" stroke="#b08550" stroke-width=".8" fill="none"/>
    <path d="M7 2.6 L7.7 14.2 M12 2.6 L12.3 14.8 M17 2.6 V15 M22 2.6 L21.7 14.8 M27 2.6 L26.3 14.2" stroke="#b08550" stroke-width=".7"/>
    <rect x="0" y="0" width="32" height="3.2" rx="1.6" fill="#c99a5f" stroke="${OUT}" stroke-width="1"/>
    <g class="hb-lau">
      <path d="M27 2 Q30.8 2.6 30.4 9 L28 9.2 Q28.2 5 25.6 3.6Z" fill="#7cb4e0" stroke="${OUT}" stroke-width=".8"/>
      ${BOTE_DROP(29.2, 9.2, 0)}${BOTE_DROP(3, 4, -0.8)}
    </g>`;

  // Wäscheleine: [x, Höhe der Leine, Form, Klammern]. Ursprung jedes Stücks = Punkt auf der Leine.
  const BOTE_LINE = [
    [19, 13.07, '<path d="M-7 0 L-2.6 0 Q0 2.4 2.6 0 L7 0 L11 4.6 L8 7.6 L6 6 V17 H-6 V6 L-8 7.6 L-11 4.6Z" fill="#6fa8dc"/><circle cx="2.6" cy="9.4" r="1.5" fill="#fff" stroke="none" opacity=".7"/>', [-4.6, 4.6]],
    [35, 14.82, '<path d="M-2.6 0 H3.6 V10 Q3.6 12.6 6.6 13.4 Q9.6 14.2 9 16.6 Q8.4 18.6 4.4 18 Q-2.6 17 -2.6 11Z" fill="#e8584e"/><path d="M-2.6 3.4 H3.6 M-2.6 6.4 H3.6" stroke="#fff" stroke-width="1.2"/>', [0.5]],
    [51, 14.7, '<path d="M-7 0 H7 L8.4 15 H2.2 L0 7 L-2.2 15 H-8.4Z" fill="#f6c945"/><path d="M-6.8 2.2 H6.8" stroke="#e0a032" stroke-width="1"/>', [-4.6, 4.6]],
    [67, 12.72, '<rect x="-6" y="0" width="12" height="18" rx="1.2" fill="#f2a7b8"/><path d="M-6 13 H6 M-6 15.2 H6" stroke="#fff" stroke-width=".9"/>', [-3.6, 3.6]],
  ];
  const BOTE_CLOTHESLINE = `
    <path d="M6 111 V8 M78 111 V8" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M6 111 V8 M78 111 V8" stroke="#ad8664" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M2.6 8.6 H9.4 M74.6 8.6 H81.4" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M2.6 8.6 H9.4 M74.6 8.6 H81.4" stroke="#c9a27e" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M5 10 Q42 20 79 10" stroke="${OUT}" stroke-width="1.4" fill="none" opacity=".5"/>
    <path d="M5 10 Q42 20 79 10" stroke="#f6f1ea" stroke-width=".7" fill="none"/>
    ${BOTE_LINE.map(([x, y, shape, pins], i) => `<g transform="translate(${x} ${y})"><g class="hb-cl hb-c${i}">
      <g class="hb-cs" style="animation-delay:${(-i * 0.7).toFixed(1)}s;animation-duration:calc(var(--hbs, 2.4s) * ${[1, 0.8, 1.15, 0.9][i]})">
        <g stroke="${OUT}" stroke-width=".9" stroke-linejoin="round">${shape}</g></g>
      ${pins.map((p) => `<rect x="${p - 1}" y="-2.4" width="2" height="4.6" rx=".7" fill="#c9a27e" stroke="${OUT}" stroke-width=".5"/>`).join('')}
    </g></g>`).join('')}
    <g transform="translate(42 95.6)">${BOTE_BASKET}</g>`;

  // Trommel des Trockners: Dauben, Nieten und ein Herzchen-Aufkleber drehen sich um (23, 24)
  const BOTE_DRUM_ROT = (() => {
    let s = '<circle cx="23" cy="24" r="16.4" fill="none"/>';
    for (let i = 0; i < 8; i++) {
      const r = (i * Math.PI) / 4;
      const c = Math.cos(r);
      const n = Math.sin(r);
      s += `<path d="M${(23 + c * 11).toFixed(2)} ${(24 + n * 11).toFixed(2)} L${(23 + c * 16.2).toFixed(2)} ${(24 + n * 16.2).toFixed(2)}" stroke="#8a664b" stroke-width="1"/>`;
    }
    for (let i = 0; i < 4; i++) {
      const r = ((i * 90 + 22.5) * Math.PI) / 180;
      s += `<circle cx="${(23 + Math.cos(r) * 13.6).toFixed(2)}" cy="${(24 + Math.sin(r) * 13.6).toFixed(2)}" r=".9" fill="#76838f"/>`;
    }
    const h = (-62 * Math.PI) / 180;
    return s + `<path transform="translate(${(23 + Math.cos(h) * 13.6).toFixed(2)} ${(24 + Math.sin(h) * 13.6).toFixed(2)})" `
      + 'd="M0 1.7 L-1.7 0 Q-2.5 -1 -1.5 -1.8 Q-.6 -2.2 0 -1.2 Q.6 -2.2 1.5 -1.8 Q2.5 -1 1.7 0Z" fill="#f07a95"/>';
  })();
  const BOTE_SOCK = (fill) => `<path d="M-2 -4 H1.6 V.4 Q1.6 1.6 3 2 L4 2.3 Q5.2 2.9 4.4 4.2 L1 4 Q-2 3.4 -2 .8Z" fill="${fill}" stroke="${OUT}" stroke-width=".5"/>`;
  // Aufsteigende Wellen; mit Rand (Dampf) liegt unter jeder Welle ein dunkler Strich statt eines drop-shadow
  const BOTE_WAVES = (cls, xs, y, d, rim) => `<g class="${cls}" fill="none" stroke-linecap="round">${xs.map((x, i) => {
    const p = `d="M${x} ${y + (i % 2) * 1.5} q1.6 -1.8 0 -3.6 q-1.6 -1.8 0 -3.6"`;
    return `<g style="animation-delay:${(-i * d).toFixed(2)}s">${rim ? `<path class="hb-rim" ${p}/>` : ''}<path ${p}/></g>`;
  }).join('')}</g>`;

  // Teller zum Tragen (Vorderansicht) und gefaltetes Handtuch im Maul
  const BOTE_PLATE_SVG = `<svg viewBox="-7 -7 14 14" aria-hidden="true"><circle r="6.3" fill="#fff" stroke="${OUT}" stroke-width="1"/>
    <circle r="4" fill="none" stroke="#7cb4e0" stroke-width=".9"/><path d="M-3.8 -2.4 Q-2.4 -4.2 0 -4.6" stroke="#dbeaf3" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`;
  const BOTE_TOWEL_SVG = `<svg viewBox="-9 -4 18 16" aria-hidden="true"><path d="M-6.4 -2 H6.4 Q7.6 -2 7.6 -.8 V9.4 H-7.6 V-.8 Q-7.6 -2 -6.4 -2Z"
    fill="#fff3c4" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/><path d="M-7.6 1.4 H7.6" stroke="#e6c97a" stroke-width=".7" stroke-dasharray="1.2 1.2"/>
    <path d="M-7.6 6 H7.6 M-7.6 7.6 H7.6" stroke="#f2a7b8" stroke-width=".9"/><path d="M-6 9.4 v1.2 M-3 9.4 v1.2 M0 9.4 v1.2 M3 9.4 v1.2 M6 9.4 v1.2" stroke="#e6c97a" stroke-width=".8"/></svg>`;

  // Spülschüssel auf dem Tisch (x 9.5..40.5, Rand y 19); voll mit Wasser, Schaum und eintauchendem Teller
  const BOTE_BASIN = (full) => `
    <ellipse cx="25" cy="19" rx="15.5" ry="3.4" fill="#e9f3fb" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="25" cy="19.4" rx="13.2" ry="2.3" fill="${full ? '#8fc8e2' : '#c4dce8'}"/>
    ${full ? `<g class="hb-dip"><circle cx="21" cy="13.6" r="6.2" fill="#fff" stroke="${OUT}" stroke-width="1"/>
      <circle cx="21" cy="13.6" r="4" fill="none" stroke="#7cb4e0" stroke-width=".9"/></g>
      <path d="M11.8 19.4 A13.2 2.3 0 0 0 38.2 19.4Z" fill="#8fc8e2" opacity=".85"/>` : ''}
    <path d="M9.5 19 Q10.4 31 25 31 Q39.6 31 40.5 19 Q25 23.6 9.5 19Z" fill="#6fa8dc" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M9.7 19.3 Q25 23.8 40.3 19.3" stroke="#e9f3fb" stroke-width="1.3" fill="none"/>
    <g fill="#fff" opacity=".75"><circle cx="16" cy="25.6" r="1"/><circle cx="25" cy="27.4" r="1"/><circle cx="34" cy="25.6" r="1"/></g>
    ${full ? `<g class="hb-foam" fill="#fff" stroke="#c9dde8" stroke-width=".5"><circle cx="16.4" cy="19.2" r="2.2"/>
      <circle cx="27.4" cy="19.6" r="2.6"/><circle cx="33" cy="19" r="2"/></g>
      ${BOTE_BUBS([[18, 15, 1.5], [28, 14.5, 1.9], [33, 16, 1.2]])}` : ''}`;
  const BOTE_TWINKLE = (pts) => pts.map(([x, y], i) =>
    `<g transform="translate(${x} ${y}) scale(.34) translate(-12 -12)"><path class="hb-tw" style="animation-delay:${(-i * 0.6).toFixed(1)}s" d="${STAR}"/></g>`).join('');

  const BOTE_SVG = {
    washer(view) {
      if (view === 'empty') return { vb: [0, 0, 84, 112], ground: 110, vt: 8, part: [6, 78], back: true, svg: BOTE_CLOTHESLINE };
      const done = view === 'done';
      return {
        vb: [0, 0, done ? 64 : 46, 44], ground: 42, vt: 2, part: done ? [4, 63] : [4, 42],
        svg: BOTE_TUB(view === 'run') + (done ? `<g transform="translate(31 27.6)">${BOTE_BASKET}</g>` : ''),
      };
    },
    dryer(view, id) {
      const done = view === 'done';
      const stand = `
        <path d="M9 49 L17 30 M37 49 L29 30" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M9 49 L17 30 M37 49 L29 30" stroke="#8a664b" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M11.5 42 H34.5" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M11.5 42 H34.5" stroke="#8a664b" stroke-width="1.8" stroke-linecap="round"/>`;
      const glass = view === 'empty'
        ? `<circle cx="23" cy="24" r="7" fill="#3b302a"/>
          <ellipse cx="35.2" cy="24" rx="3.4" ry="8.6" fill="#8d99a5" stroke="${OUT}" stroke-width="1"/>
          <ellipse cx="35.5" cy="24" rx="2.1" ry="6.8" fill="#d6ecf6"/>`
        : `<circle cx="23" cy="24" r="7" fill="#d6ecf6"/>
          <clipPath id="hb-dc${id}"><circle cx="23" cy="24" r="7"/></clipPath>
          <g clip-path="url(#hb-dc${id})"><g class="hb-sock"><circle cx="23" cy="24" r="7" fill="none"/>
            <g transform="translate(20.4 26) rotate(-24)">${BOTE_SOCK('#e8584e')}</g>
            <g transform="translate(25.8 21.6) rotate(150)">${BOTE_SOCK('#6fa8dc')}</g></g></g>
          <path d="M18.6 20.4 A6 6 0 0 1 24.4 18.2" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".85"/>`;
      const towels = done ? `<g class="hb-towels">
          <g class="hb-t1"><rect x="34" y="40.8" width="27" height="7.6" rx="3.7" fill="#f2a7b8" stroke="${OUT}" stroke-width="1"/>
            <path d="M37 44.6 H58" stroke="#fff" stroke-opacity=".75" stroke-width=".8" stroke-dasharray="1.4 1.6"/></g>
          <g class="hb-t2"><rect x="35.4" y="33.6" width="25" height="7.6" rx="3.7" fill="#a7d3f2" stroke="${OUT}" stroke-width="1"/>
            <path d="M38.4 37.4 H57.4" stroke="#fff" stroke-opacity=".75" stroke-width=".8" stroke-dasharray="1.4 1.6"/></g>
          <g class="hb-t3"><rect x="36.6" y="26.4" width="23" height="7.6" rx="3.7" fill="#fff3c4" stroke="${OUT}" stroke-width="1"/>
            <path d="M39.6 30.2 H56.6" stroke="#e6c97a" stroke-width=".8" stroke-dasharray="1.4 1.6"/></g>
        </g>${BOTE_WAVES('hb-steam', [42, 48, 54], 24, 0.9, true)}` : '';
      return {
        vb: [0, -12, done ? 64 : 46, 62], ground: 48, vt: 7, part: done ? [6, 62] : [6, 40],
        svg: `${stand}<circle cx="23" cy="24" r="17" fill="#ad8664" stroke="${OUT}" stroke-width="1.6"/>
          <g class="hb-rot">${BOTE_DRUM_ROT}</g>
          <circle cx="23" cy="24" r="10.6" fill="#8a664b" stroke="${OUT}" stroke-width="1"/>
          <circle cx="23" cy="24" r="8.6" fill="#8d99a5" stroke="${OUT}" stroke-width="1"/>
          ${glass}${view === 'run' ? BOTE_WAVES('hb-heat', [14, 23, 32], 5, 0.7) : ''}${towels}`,
      };
    },
    dishwasher(view) {
      const table = `
        <path d="M8 50.5 V35 M44 50.5 V35" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M8 50.5 V35 M44 50.5 V35" stroke="#8a664b" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M8 44 H44" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><path d="M8 44 H44" stroke="#8a664b" stroke-width="1.5"/>
        <rect x="2" y="31" width="48" height="5" rx="2" fill="#ad8664" stroke="${OUT}" stroke-width="1.3"/>
        <path d="M5 32.6 H47" stroke="#c9a27e" stroke-width="1" stroke-linecap="round"/>
        <rect x="42.4" y="27.6" width="7" height="3.6" rx="1" fill="#f6c945" stroke="${OUT}" stroke-width=".7"/>
        <path d="M42.8 28.4 H49" stroke="#6bab4c" stroke-width="1.2"/>`;
      let top;
      if (view === 'done') {
        top = `<g class="hb-plates">${[0, 1, 2, 3, 4].map((i) => {
          const y = 29.4 - i * 2.5;
          return `<g class="hb-p${i}"><ellipse cx="25" cy="${y}" rx="11" ry="2.8" fill="#fff" stroke="${OUT}" stroke-width=".9"/>`
            + `<path d="M15.6 ${(y + 0.8).toFixed(1)} Q25 ${(y + 3.6).toFixed(1)} 34.4 ${(y + 0.8).toFixed(1)}" stroke="#cfe0ea" stroke-width=".8" fill="none"/>`
            + (i === 4 ? '<ellipse cx="25" cy="19.4" rx="6.6" ry="1.5" fill="none" stroke="#7cb4e0" stroke-width=".8"/>'
              + '<path d="M17.6 18.6 Q20.6 17.5 23.6 17.4" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>' : '')
            + '</g>';
        }).join('')}</g>${BOTE_TWINKLE([[10, 14], [39, 16], [30, 8]])}`;
      } else if (view === 'empty') {
        top = `${BOTE_BASIN(false)}
          <path d="M5 33 H17 V43 L14.6 41.6 L12.2 43 L9.8 41.6 L7.4 43 L5 41.6Z" fill="#fff" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
          <path d="M5 36 H17 M5 39 H17 M8 33 V42 M11 33 V42.4 M14 33 V42" stroke="#e8584e" stroke-width=".8" opacity=".75"/>`;
      } else top = BOTE_BASIN(true);
      return { vb: [0, -6, 52, 56], ground: 50, vt: view === 'done' ? 12 : 8, part: [2, 50], svg: table + top };
    },
  };

  const STYLE_BOTE = `
  .props { position: absolute; inset: 0; pointer-events: none; }
  /* Requisit: left/top/width setzt das Skript, Boden der Grafik knapp unter der Bodenlinie (im Gras) */
  .hb { position: absolute; left: 0; top: 0; pointer-events: auto; cursor: pointer; transition: filter 2.5s, opacity .5s; }
  .hb.hb-placed { transition: left .5s ease, top .5s ease, width .5s ease, filter 2.5s, opacity .5s; }
  .hb::after { content: ''; position: absolute; inset: -8px -4px 0; }
  /* Vorn auf dem Wiesenstreifen: näher am Betrachter, also vor Pika, Gras und Heu (unter Regen, Statusleiste, Futterknopf) */
  .hb.hb-fr, .hb-bar { z-index: 4; }
  .hb.hb-bye { opacity: 0; pointer-events: none; }
  .hb-i { transform-origin: 50% 100%; }
  .hb svg { display: block; width: 100%; height: auto; overflow: visible; }
  .day.overcast .hb, .day.overcast .hb-carry, .day.overcast .hb-stick, .day.overcast .hb-dipw { filter: brightness(.9) saturate(.8); }
  .dusk .hb, .dusk .hb-carry, .dusk .hb-stick, .dusk .hb-dipw { filter: brightness(.85) saturate(.85); }
  .night .hb, .night .hb-carry, .night .hb-stick, .night .hb-dipw { filter: brightness(.5) saturate(.6); }
  /* Fertig: hüpft alle paar Sekunden kurz (Aufmerksamkeit), Antippen durch den Pika wackelt. Einblenden und
     Antippen haben Vorrang (die Regel greift dann nicht), im Schlaf und nachts ruht es. */
  .hb.hb-done:not(.hb-live):not(.hb-boop):not(.hb-in):not(.hb-still) .hb-i { animation: hb-nudge 4s ease-in-out infinite; }
  .hb.hb-in .hb-i { animation: hb-pin .55s cubic-bezier(.3, 1.6, .5, 1) both; }
  .hb.hb-boop .hb-i { animation: hb-boop .45s ease-out; }
  @keyframes hb-pin { from { transform: scale(.4); opacity: 0; } }
  @keyframes hb-nudge {
    0%, 78%, 100% { transform: none; }
    84% { transform: scale(1.05, .94); }
    90% { transform: translateY(-5%) scale(.97, 1.04); }
    95% { transform: scale(1.02, .98); }
  }
  @keyframes hb-boop { 30% { transform: scale(1.06, .92) rotate(-2deg); } 65% { transform: scale(.97, 1.04) rotate(1.5deg); } }
  .hb.hb-pause *:not(.hb-a) { animation-play-state: paused !important; }
  /* Pika schläft (oder Nacht und das Gerät läuft nicht): Endlos-Animationen anhalten, spart dem Tablet das
     ständige Neuzeichnen unter dem Nachtfilter */
  .hb.hb-still .hb-i *, .hb.hb-still .hb-a, .hb-bar.hb-still b { animation-play-state: paused !important; }
  .hb .hb-gone { opacity: 0; transition: opacity .7s; }
  /* Störung oder Hilfe nötig: rotes Ausrufezeichen */
  .hb-a {
    position: absolute; right: -4%; top: -8%; display: none; width: calc(var(--H) * .07); height: calc(var(--H) * .07);
    border-radius: 50%; background: #e8584e; color: #fff; font-weight: 800; font-size: calc(var(--H) * .05);
    line-height: calc(var(--H) * .07); text-align: center; box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
    animation: hb-alert .9s ease-in-out infinite alternate;
  }
  .hb.hb-alert .hb-a { display: block; }
  @keyframes hb-alert { to { transform: translateY(-15%) scale(1.08); } }
  /* Waschzuber: Schaum wogt, Blasen steigen, nasse Wäsche tropft */
  .hb-foam { transform-box: fill-box; transform-origin: 50% 100%; }
  .hb-run .hb-foam { animation: hb-foam 1.6s ease-in-out infinite alternate; }
  @keyframes hb-foam { to { transform: scale(1.04, 1.12); } }
  .hb-bubs circle {
    opacity: 0; fill: rgba(255, 255, 255, .55); stroke: #8fc0d8; stroke-width: .6;
    transform-box: fill-box; transform-origin: center; animation: hb-bub 2.6s ease-out infinite;
  }
  @keyframes hb-bub {
    0% { transform: translate(0, 0) scale(.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(2px, -13px) scale(1.15); opacity: 0; }
  }
  .hb-drip { fill: #8fd0f0; stroke: #5f9fc0; stroke-width: .4; opacity: 0; transform-box: fill-box; transform-origin: 50% 0; animation: hb-drip 1.6s ease-in infinite; }
  @keyframes hb-drip {
    0% { transform: scale(.2); opacity: 0; }
    25% { transform: scale(1); opacity: 1; }
    100% { transform: translateY(9px); opacity: 0; }
  }
  .hb-busy .hb-paddle, .hb-busy .hb-dip { display: none; }
  /* Wäscheleine: Stücke wehen mit dem Wind (--hbw Winkel samt Richtung, --hbs Tempo) */
  .hb-cs { transform-box: fill-box; transform-origin: 50% 0; animation: hb-sway var(--hbs, 2.4s) ease-in-out infinite alternate; }
  @keyframes hb-sway {
    from { transform: rotate(calc(var(--hbw, 5deg) * -.3)); }
    to { transform: rotate(var(--hbw, 5deg)); }
  }
  .hb-cl { transform-box: fill-box; transform-origin: 50% 0; transition: opacity .25s, transform .4s cubic-bezier(.3, 1.6, .5, 1); }
  .hb-hang .hb-cl:not(.on) { opacity: 0; transform: translateY(-3px) scale(.4); }
  .hb-empty:not(.hb-hang) .hb-lau { display: none; }
  .hb-lau { transition: opacity .7s; }
  .hb-emptied .hb-lau { opacity: 0; }
  /* Trockner: Trommel dreht sich, Socken purzeln, warme Luft steigt; fertig dampfen die Handtücher */
  .hb-rot, .hb-sock { transform-box: fill-box; transform-origin: 50% 50%; }
  .hb-run .hb-rot { animation: hb-spin 2.6s linear infinite; }
  .hb-run .hb-sock { animation: hb-spin 1.2s linear infinite; }
  @keyframes hb-spin { to { transform: rotate(360deg); } }
  .hb-heat > g, .hb-steam > g { opacity: 0; transform-box: fill-box; animation: hb-heat 2.2s ease-out infinite; }
  .hb-heat path { stroke: #f3a25a; stroke-width: 1.1; }
  .hb-steam > g { animation-duration: 2.8s; }
  .hb-steam path { stroke: #fff; stroke-width: 1.3; }
  .hb-steam path.hb-rim { stroke: rgba(90, 64, 48, .35); stroke-width: 2.3; }
  @keyframes hb-heat {
    0% { transform: translateY(2px); opacity: 0; }
    35% { opacity: .9; }
    100% { transform: translateY(-7px); opacity: 0; }
  }
  .hb-towels > g { transition: opacity .6s; }
  /* Spülschüssel: Teller taucht ein; fertig funkelt der Tellerstapel */
  .hb-dip { transform-box: fill-box; transform-origin: 50% 50%; }
  .hb-run .hb-dip { animation: hb-dip 2.8s ease-in-out infinite; }
  @keyframes hb-dip { 0%, 100% { transform: none; } 45% { transform: translateY(7px) rotate(-8deg); } 62% { transform: translateY(6px) rotate(6deg); } }
  .hb-tw { fill: #fff6b8; transform-box: fill-box; transform-origin: center; animation: hb-twk 1.8s ease-in-out infinite;
    stroke: rgba(240, 190, 70, .9); stroke-width: 2.4; stroke-linejoin: round; paint-order: stroke; }
  @keyframes hb-twk { 0%, 100% { transform: scale(0); opacity: 0; } 40% { transform: scale(1) rotate(35deg); opacity: 1; } 70% { transform: scale(.25); opacity: .3; } }
  .hb-plates > g { transition: opacity .6s; }

  /* Ebenen vor dem Pika: Werkzeug und Getragenes (z 4), Fähnchen über Statusleiste und Futterknopf (z 6).
     Der Fortschrittsbalken liegt wie sein Requisit: hinten unter dem Pika (über dem Gras), vorn davor. */
  .hb-f, .hb-t, .hb-bars { position: absolute; inset: 0; pointer-events: none; }
  .hb-f { z-index: 4; }
  .hb-t { z-index: 6; }
  .hb-bar {
    position: absolute; left: 0; top: 0; height: clamp(3px, calc(var(--H) * .018), 6px); border-radius: 99px; pointer-events: none;
    background: rgba(255, 255, 255, .78); box-shadow: 0 0 0 1px rgba(90, 64, 48, .4); overflow: hidden;
    opacity: 0; transition: opacity .5s, left .5s, top .5s, width .5s;
  }
  .hb-bar.on { opacity: 1; }
  .hb-bar b { display: block; height: 100%; width: var(--p, 0%); border-radius: inherit; background: var(--bc, #5fb9de); transition: width .8s; }
  .hb-bar.ind b { width: 34%; animation: hb-ind 1.5s ease-in-out infinite alternate; }
  .hb-bar.pause b { opacity: .45; animation-play-state: paused; }
  @keyframes hb-ind { from { transform: translateX(-15%); } to { transform: translateX(210%); } }
  .night .hb-bar { background: rgba(190, 200, 225, .55); }
  .hb-stick {
    position: absolute; width: calc(var(--H) * .014); margin-left: calc(var(--H) * -.007); border-radius: 99px;
    background: linear-gradient(90deg, #a07a58, #d8b48e 45%, #a07a58); box-shadow: 0 0 0 1px #5a4030;
    transform-origin: 50% 100%; transform: rotate(var(--ba)); animation: hb-stick .8s ease-in-out infinite;
  }
  @keyframes hb-stick { 0%, 100% { transform: rotate(calc(var(--ba) - 8deg)); } 50% { transform: rotate(calc(var(--ba) + 8deg)); } }
  .hb-ring {
    position: absolute; width: calc(var(--H) * .065); height: calc(var(--H) * .026); margin: calc(var(--H) * -.014) 0 0 calc(var(--H) * -.0325);
    border-radius: 50%; background: radial-gradient(#fff 50%, #e6f2f8); box-shadow: 0 0 0 1px #c9dde8;
    animation: hb-foam .8s ease-in-out infinite alternate;
  }
  .hb-bbl {
    position: absolute; width: calc(var(--H) * .022); height: calc(var(--H) * .022); margin: calc(var(--H) * -.011);
    border-radius: 50%; border: 1px solid rgba(120, 175, 205, .9); background: rgba(255, 255, 255, .55);
    opacity: 0; animation: hb-bblup 1.1s ease-out forwards;
  }
  @keyframes hb-bblup {
    0% { transform: translate(0, 0) scale(.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx, 0px), calc(var(--H) * -.09)) scale(1.1); opacity: 0; }
  }
  /* Seifenblase, die auf der Nase landet (Unterkante auf dem Punkt) */
  .hb-soap { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  .hb-soap i {
    position: absolute; display: block; width: calc(var(--H) * .055); height: calc(var(--H) * .055);
    left: calc(var(--H) * -.0275); top: calc(var(--H) * -.052); border-radius: 50%;
    background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, .95) 0 12%, rgba(255, 255, 255, .2) 30%, rgba(170, 220, 255, .25) 65%, rgba(255, 170, 230, .55) 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .8), 0 0 2px rgba(120, 170, 210, .6);
    animation: hb-wob 1.1s ease-in-out infinite alternate;
  }
  .hb-soap.pop i { animation: hb-pop .28s ease-out forwards; }
  @keyframes hb-wob { to { transform: scale(1.07, .94); } }
  @keyframes hb-pop { to { transform: scale(1.8); opacity: 0; } }
  /* Was der Pika trägt: folgt ihm (translate setzt das Skript), Mitte des Bilds auf dem Haltepunkt */
  .hb-carry { position: absolute; left: 0; top: 0; width: 0; height: 0; transition: opacity .35s; }
  .hb-carry > i { position: absolute; display: block; width: var(--cw); left: calc(var(--cw) * -.5); top: calc(var(--cw) * -.4); }
  .hb-carry svg { display: block; width: 100%; height: auto; overflow: visible; }
  .hb-carry.hb-gone { opacity: 0; }
  .hb-carry.hb-shine > i { animation: hb-plw .26s ease-in-out infinite alternate; }
  @keyframes hb-plw { from { transform: rotate(-14deg); } to { transform: rotate(14deg); } }
  /* Teller eintauchen: der Rahmen schneidet an der Wasserlinie ab */
  .hb-dipw { position: absolute; overflow: hidden; }
  .hb-dipw > i { position: absolute; display: block; }
  .hb-dipw svg { display: block; width: 100%; height: auto; }

  /* Haltungen des Pika bei der Arbeit */
  .pika.hb-hold .paws, .pika.hb-stir .paws, .pika.hb-polish .paws, .pika.hb-pat .paws { display: inline; }
  /* Bei Regen hält eine Pfote das Blatt (.brolly): dann arbeitet nur die andere, nie drei Pfoten.
     Gilt für jede Haltung, die .paws zeigt (Arbeit, Putzen, Fest-Aktionen) */
  .pika.wet:not(.inside) .paws ellipse + ellipse { display: none; }
  .pika.hb-stir .paws { transform-box: fill-box; animation: hb-stirp .8s linear infinite; }
  @keyframes hb-stirp { 0%, 100% { transform: translate(-1.6px, 0); } 25% { transform: translate(0, 1.2px); } 50% { transform: translate(1.6px, 0); } 75% { transform: translate(0, -1.2px); } }
  .pika.hb-stir .hop { animation: hb-stir .8s ease-in-out infinite; }
  @keyframes hb-stir { 50% { transform: translateX(1.5%) scale(1.03, .97); } }
  .pika.hb-polish .paws { transform-box: fill-box; animation: hb-pol .24s ease-in-out infinite alternate; }
  @keyframes hb-pol { from { transform: translateX(-2px); } to { transform: translateX(2px); } }
  .pika.hb-pat .hop { animation: hb-pat .45s ease-in-out; }
  @keyframes hb-pat { 40% { transform: translateX(4%) scale(1.04, .92); } }
  .pika.hb-drum .face { animation: hb-drumf 1.3s linear infinite; }
  @keyframes hb-drumf { 0%, 100% { transform: translate(2.2px, 0); } 25% { transform: translate(0, 2.2px); } 50% { transform: translate(-2.2px, 0); } 75% { transform: translate(0, -2.2px); } }
  /* Kopf zum Betrachter gedreht */
  .pika.hb-look .face { transform: translate(-3.5px, .5px); }

  /* Fähnchen wie beim Flugzeug: Gerätename und Stand */
  .hb-tag {
    position: absolute; left: 0; top: 0; padding: .12em .7em .18em; border-radius: .9em;
    font-size: clamp(10px, calc(var(--H) * .05), 14px); line-height: 1.35; white-space: nowrap;
    max-width: calc(100% - 8px); box-sizing: border-box;
    color: #4a3a2c; background: rgba(255, 255, 255, .86); box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
    opacity: 0; transform: translateY(4px); pointer-events: none; cursor: pointer;
    transition: opacity .25s, transform .25s, background 2.5s, color 2.5s;
  }
  .hb-tag.open { opacity: 1; transform: none; pointer-events: auto; }
  .hb-tag b { font-weight: 700; letter-spacing: .02em; }
  /* zu lang für eine schmale Karte: Zeilen mit … kürzen statt links abschneiden */
  .hb-tag b, .hb-tag .more { display: block; overflow: hidden; text-overflow: ellipsis; }
  .hb-tag .more { font-size: .9em; opacity: .85; }
  .night .hb-tag { color: #e4e9f6; background: rgba(22, 32, 62, .78); }
  `;
  // ==================== Ende Haus-Bote ====================

  const STYLE = `
  :host { display: block; height: 100%; }
  ha-card { display: block; height: 100%; overflow: hidden; background: none; border-radius: var(--ha-card-border-radius, 12px); }
  .scene {
    position: relative; height: 100%; overflow: hidden; border-radius: inherit;
    /* Größe kommt von außen, nichts ragt hinaus: Stil, Layout und Malen bleiben auf die Karte begrenzt */
    contain: strict;
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
  /* Dichte Wolken (auch Regen, Schnee) lassen nur einen Hauch der Scheibe durch, Gewitter und Nebel gar nichts */
  .overcast .sun { opacity: .07; }
  .storm .sun, .foggy .sun, .sun-down .sun { opacity: 0; }
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
  /* Ausgeblendete Wolken (und Nebel) stehen still: jede laufende Animation hält die Bildwiederholung in Gang */
  .cloud:not(.on), .scene:not(.foggy) .fog i { animation-play-state: paused; }
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

  .land, .flowers, .foods, .birds, .mice, .mice-f { position: absolute; inset: 0; transition: filter 2.5s, opacity 2s; }
  .birds, .mice, .mice-f { pointer-events: none; }
  .birds { z-index: 2; } /* über der Festdeko am Bau (.fon, z 1), hinter Pika, Pino, Heu und Gras (z 3) */
  .day.overcast .land, .day.overcast .flowers, .day.overcast .hills, .day.overcast .fore,
  .day.overcast .birds, .day.overcast .mice, .day.overcast .mice-f { filter: brightness(.9) saturate(.8); }
  .dusk .land, .dusk .flowers, .dusk .foods, .dusk .fore, .dusk .birds, .dusk .mice, .dusk .mice-f { filter: brightness(.85) saturate(.85); }
  .night .land, .night .flowers, .night .foods, .night .fore, .night .birds, .night .mice, .night .mice-f { filter: brightness(.5) saturate(.6); }
  .burrow, .lights { position: absolute; }
  .lights { pointer-events: none; }
  .burrow svg, .lights svg { display: block; width: 100%; height: auto; overflow: visible; }
  .mound { fill: var(--mound, #94c873); transition: fill 2.5s; }
  .stump-top { fill: #d9b07c; transition: fill 2.5s; }
  .snowcover { --mound: #e6edf2; }
  .snowcover .stump-top { fill: #eef3f6; }
  .lt { opacity: 0; transition: opacity 2.5s; }
  .dusk .lt { opacity: .6; }
  .night .lt { opacity: 1; }
  .night .lt.flk { animation: flicker 2.8s ease-in-out infinite alternate; }
  @keyframes flicker { 40% { opacity: .75; } 55% { opacity: 1; } 100% { opacity: .85; } }
  .lookout { position: absolute; }
  .lookout svg { display: block; width: 100%; height: auto; overflow: visible; }
  .rock-snow { display: none; }
  .snowcover .rock-snow { display: inline; }
  .rtuft { fill: var(--h3); transition: fill 2.5s; }
  /* Fernsehen: flackerndes Licht im Eingang (der Fernseher steht drinnen), Bau-Fenster flackert mit */
  .tvl { position: absolute; pointer-events: none; overflow: hidden; opacity: 0; transition: opacity .8s; }
  .tv-on .tvl { opacity: 1; }
  .tvl i { position: absolute; display: block; }
  .tvl .tvg {
    inset: 0; background: radial-gradient(ellipse 85% 75% at 50% 45%, var(--tvc, #9fd0ff), transparent 80%);
  }
  .tv-on .tvl .tvg { animation: tvflk 1.3s linear infinite; }
  .tvl .scr {
    left: 30%; width: 40%; top: 15%; height: 22%; border-radius: 3px; background: var(--tvc, #9fd0ff);
    border: 2px solid #1d1d22; box-shadow: 0 0 10px 4px var(--tvc, #9fd0ff);
  }
  .tvw, .tvw-x { opacity: 0; transition: opacity .8s; }
  .tvw { fill: var(--tvc, #9fd0ff); }
  .tv-on .tvw { opacity: .8; animation: tvflk 1.3s linear infinite; }
  .tv-on .tvw-x { opacity: 1; }
  @keyframes tvflk { 0%, 100% { opacity: .55; } 20% { opacity: .75; } 35% { opacity: .45; } 60% { opacity: .7; } 80% { opacity: .5; } }
  /* Drachen: Schnur und Drachen hängen an der Pfote (Ursprung), steigen auf und schwanken im Wind */
  .kites { position: absolute; inset: 0; pointer-events: none; transition: filter 2.5s; }
  .day.overcast .kites { filter: brightness(.9) saturate(.8); }
  .dusk .kites { filter: brightness(.85) saturate(.85); }
  .kite { position: absolute; width: 0; height: 0; transition: opacity .6s; }
  .kite.gone { opacity: 0; }
  .kite svg { position: absolute; left: 0; top: 0; overflow: visible; }
  .kite .kl { transform-box: view-box; transform-origin: 0 0; transform: rotate(var(--k0, 0deg)) scale(.25); transition: transform 3s ease-out; }
  .kite.up .kl { transform: none; }
  .kite .kr { transform-box: view-box; transform-origin: 0 0; animation: ksway var(--kd, 3s) ease-in-out infinite alternate; }
  .kite.tug .kr { animation: ktug .6s ease-out; }
  @keyframes ksway { from { transform: rotate(-3deg); } to { transform: rotate(4deg); } }
  @keyframes ktug { 40% { transform: rotate(6deg) scale(1.03); } }
  .kite .kb { transform-box: fill-box; transform-origin: 50% 30%; animation: kbob 1.2s ease-in-out infinite alternate; }
  @keyframes kbob { from { transform: rotate(-9deg); } to { transform: rotate(9deg); } }
  .kite .kt { transform-box: fill-box; transform-origin: 50% 0; animation: ktail .5s ease-in-out infinite alternate; }
  @keyframes ktail { from { transform: skewX(-14deg); } to { transform: skewX(14deg); } }
  .pane { fill: #cfe6f2; }
  /* Schornsteinrauch bei Kälte und abends, zieht mit dem Wind */
  .smoke circle { fill: #eef1f4; opacity: 0; transform-box: fill-box; transform-origin: center; }
  .chilly .smoke circle, .dusk .smoke circle, .night .smoke circle { animation: smoke 6s linear infinite; }
  .smoke circle:nth-child(2) { animation-delay: -2s; }
  .smoke circle:nth-child(3) { animation-delay: -4s; }
  .night .smoke circle { fill: #8f99ad; }
  @keyframes smoke {
    0% { transform: translate(0, 0) scale(.6); opacity: 0; }
    15% { opacity: .75; }
    100% { transform: translate(var(--smx, -6px), -16px) scale(2.3); opacity: 0; }
  }
  .hills .mtn { display: none; }
  .areal-alpin .hills .mtn { display: inline; }
  .m1 { fill: #8b9bb1; transition: fill 2.5s; }
  .mcap { fill: #f4f7fa; transition: fill 2.5s; }
  .dusk .m1 { fill: #6c6f8f; }
  .dusk .mcap { fill: #e6d3de; }
  .night .m1 { fill: #222c45; }
  .night .mcap { fill: #7d88a0; }
  .hay svg, .flower svg, .food svg { display: block; width: 100%; height: auto; overflow: visible; }
  /* Durchgehender Grasstreifen ganz vorn: Boden in Wiesenfarbe, davor Halme. Alles, was auf dem Boden
     steht, sinkt ein paar Pixel ein und verschwindet unten im Gras. */
  .grass {
    position: absolute; left: 0; right: 0; top: calc(var(--gy) - var(--H) * .045); bottom: 0;
    pointer-events: none; z-index: 3; transition: filter 2.5s;
  }
  .grass svg { display: block; width: 100%; height: calc(var(--H) * .06); }
  .grass::after {
    content: ''; position: absolute; left: 0; right: 0; top: calc(var(--H) * .06 - 1px); bottom: 0;
    background: var(--h2); transition: background 2.5s;
  }
  .grass .blades { fill: var(--h3); transition: fill 2.5s; }
  .grass .soil { fill: var(--h2); transition: fill 2.5s; }
  .day.overcast .grass { filter: brightness(.9) saturate(.8); }
  /* Heuhaufen vor dem Pika, damit man sieht, wie er Blüten hineinlegt */
  .fore { position: absolute; inset: 0; pointer-events: none; z-index: 3; transition: filter 2.5s; }
  .hay {
    position: absolute; left: var(--hl); width: var(--hw); bottom: calc(var(--H) - var(--gy) - 4px);
    transform-origin: 50% 100%; transform: scale(var(--hs, .6)); transition: transform .5s cubic-bezier(.3, 1.6, .5, 1);
  }
  .hay.boing { animation: boing .5s ease-out; }
  /* Areal mit Vorratsnische: kein Heuhaufen, die zuletzt abgelegte Blüte ploppt in der Nische auf */
  .stash .hay { display: none; }
  .stashb .new { transform-box: fill-box; transform-origin: 50% 50%; animation: stash-in .45s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes stash-in { from { transform: scale(0); } }
  @keyframes boing {
    35% { transform: scale(calc(var(--hs) * 1.1), calc(var(--hs) * .86)); }
    70% { transform: scale(calc(var(--hs) * .96), calc(var(--hs) * 1.06)); }
  }
  .toss { position: absolute; width: calc(var(--H) * .04); height: calc(var(--H) * .04); margin: calc(var(--H) * -.02); z-index: 4; }
  .toss svg { display: block; width: 100%; height: 100%; }
  .puff {
    position: absolute; width: calc(var(--H) * .05); height: calc(var(--H) * .035); margin-left: calc(var(--H) * -.025);
    border-radius: 50%; background: rgba(240, 232, 215, .85); pointer-events: none;
    animation: puff .6s ease-out forwards;
  }
  .night .puff { background: rgba(150, 150, 170, .5); }
  @keyframes puff {
    from { transform: translate(0, 0) scale(.4); opacity: .9; }
    to { transform: translate(var(--px), calc(var(--H) * -.03)) scale(1.3); opacity: 0; }
  }
  .flower {
    position: absolute; left: calc(var(--xf) * var(--W) - var(--fw) / 2); bottom: calc(var(--H) - var(--gy) - 5px);
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
    position: absolute; left: calc(var(--xf) * var(--W) - var(--dw) / 2); bottom: calc(var(--H) - var(--gy) - 6px);
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
    transform-origin: 50% 94.5%; /* Füße: auf dem Stein ist er etwas kleiner (weiter hinten) */
  }
  .shadow {
    position: absolute; left: 12%; right: 12%; bottom: 0; height: 10%; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(0, 0, 0, .22), transparent);
  }
  .flip, .jump, .hop, .clipw, .depth { position: absolute; inset: 0; transform-origin: 50% 100%; }
  /* Im Bau: Ausschnitt auf den Eingang (clip-path setzt das Skript), kleiner und dunkler (weiter hinten),
     --dy schiebt ihn hinter die Vorderkante. Der Kopf steht mittig im Eingang (--hc, --hh je Blickrichtung).
     Abgedunkelt wird über feste Fellfarben (PK_DIM), nicht per Filter. */
  .depth { --hd: 1; }
  .left .depth { --hd: -1; }
  .inside .depth {
    transform: translate(calc(var(--hc) - var(--hh) * var(--hd)), var(--dy)) scale(var(--ds));
  }
  .inside .shadow { opacity: 0; }
  .pika.inside .brolly { display: none; }
  .flip { transition: transform .25s; }
  .left .flip { transform: scaleX(-1); }
  .pk { display: block; width: 100%; height: 100%; overflow: visible; }
  /* Nachts und im Bau dunklere Fellfarben statt filter (der atmende Pika müsste sonst jedes Bild neu gefiltert werden).
     Pino (aus PIKA_SVG, eigene Fellfarben als Rückfallwerte) behält vorerst den Nachtfilter. */
  .night .pika .pk { ${PK_DIM(0.8, 0.85)} }
  .pika.inside .pk { ${PK_DIM(0.85, 1)} }
  .night .pika.inside .pk { ${PK_DIM(0.68, 0.85)} }
  .pk stop, .pk [fill^="var(--pk-"] { transition: fill 1s, stop-color 1s; }
  .friend .pk { transition: filter 2.5s; }
  .night .friend .pk { filter: brightness(.8) saturate(.85); }

  /* Hoppeln: kurz am Boden (gestaucht), aufwärts abbremsen, abwärts beschleunigen */
  .walking .hop { animation: hop .36s linear infinite; }
  @keyframes hop {
    0%, 100% { transform: translateY(0) scale(1.05, .95); animation-timing-function: ease-out; }
    10% { transform: translateY(-1.5%) scale(.98, 1.03); animation-timing-function: cubic-bezier(.3, .6, .5, 1); }
    50% { transform: translateY(-10%) scale(.98, 1.02); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
    88% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  }
  .jump.hop1 { animation: jump .6s cubic-bezier(.3, .7, .4, 1); }
  @keyframes jump {
    15% { transform: scale(1.08, .9); animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    45% { transform: translateY(-30%) scale(.95, 1.06); animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    75% { transform: translateY(0) scale(1.07, .93); animation-timing-function: ease-out; }
  }
  .jump.binky { animation: binky .9s ease-in-out; }
  @keyframes binky {
    12% { transform: scale(1.1, .88); animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    40% { transform: translateY(-40%) rotate(-14deg); }
    60% { transform: translateY(-26%) rotate(10deg); animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    82% { transform: translateY(0) scale(1.07, .93); animation-timing-function: ease-out; }
  }
  .stretch .hop { animation: stretch 1.2s ease-in-out; }
  @keyframes stretch {
    30% { transform: scale(1.14, .84); }
    60% { transform: scale(.94, 1.08); }
  }

  /* Atmen auf der HTML-Hülle statt auf <g class="all">: so rechnet es die Grafikkarte, nicht jedes Bild der
     Hauptthread. Drehpunkt = Mitte unten der Pika-Figur (viewBox 120 × 100: x 64,7, Füße bei y 95). */
  .br { position: absolute; inset: 0; transform-origin: 54% 95%; animation: breathe 3.4s ease-in-out infinite; }
  @keyframes breathe { 50% { transform: scale(1.012, 1.025); } }
  .sleeping .br { animation: breathe-deep 4.6s ease-in-out infinite; }
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

  .mfood, .paws, .cap, .scarf, .brolly, .omouth { display: none; }
  /* Pfiff vom Stein: aufrichten, Kopf hoch, Maul auf */
  .calling .omouth { display: inline; }
  .callfx { display: none; filter: drop-shadow(0 0 1px rgba(60, 40, 30, .55)); }
  .calling .callfx { display: inline; }
  .callfx path { opacity: 0; transform-box: fill-box; animation: wave .6s ease-out forwards; }
  .callfx path:nth-child(2) { animation-delay: .08s; }
  .callfx path:nth-child(3) { animation-delay: .16s; }
  @keyframes wave {
    from { opacity: 0; transform: translateX(-2px) scale(.8); }
    35% { opacity: 1; }
    to { opacity: 0; transform: translateX(3px) scale(1.1); }
  }
  /* Anlauf vor dem Sprung */
  .crouch .hop { transform: scale(1.1, .84); transition: transform .16s ease-out; }
  /* Geschäft: in die Hocke, Augen zu, Po wackelt */
  .squat .hop { animation: squat 1.3s ease-in-out; }
  @keyframes squat {
    15%, 85% { transform: scale(1.08, .88); }
    35% { transform: translateX(-2%) scale(1.08, .88); }
    50% { transform: translateX(2%) scale(1.08, .88); }
    65% { transform: translateX(-2%) scale(1.08, .88); }
  }
  .squat .eye { display: none; }
  .squat .seye { display: inline; }
  .squat .ear { transform: translateY(1.5px); }
  /* Schnuppern am Häufchen */
  .sniff .hop { transform: scale(1.06, .9); transition: transform .25s; }
  .sniff .face { transform: translate(3px, 2px); }
  /* Ohren wippen beim Hoppeln */
  .walking .ear-l { animation: earbob .36s ease-in-out infinite alternate; }
  .walking .ear-r { animation: earbob .36s .1s ease-in-out infinite alternate; }
  @keyframes earbob { from { transform: rotate(-7deg); } to { transform: rotate(5deg); } }
  .calling .hop { animation: call .6s ease-out; }
  .calling .face { transform: translate(1.5px, -3px); }
  .calling .ear { transform: translateY(-2px); }
  @keyframes call {
    30% { transform: scale(.94, 1.1); }
    70% { transform: scale(.97, 1.05); }
  }
  .cold .scarf, .wet .brolly { display: inline; }
  .sleeping .brolly { display: none; }
  .brolly { transform-box: fill-box; transform-origin: 70% 100%; }
  .wet .brolly { animation: brolly 2.6s ease-in-out infinite alternate; }
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

  /* Beschäftigungen: Buch, Gameboy, Tablet (auf dem Bauch), Drachenschnur, Fernsehen (Rückansicht im Bau) */
  .book, .gb, .tab, .kpaw, .bk { display: none; }
  .reading .book, .gaming .gb, .tablet .tab, .kiting .kpaw { display: inline; }
  .reading .face { animation: read 3.4s ease-in-out infinite; }
  @keyframes read { 0%, 100% { transform: translate(0, 2px); } 70% { transform: translate(2.6px, 2.6px); } 82% { transform: translate(-.4px, 2px); } }
  .book .bflip { opacity: 0; transform-box: view-box; transform-origin: 91px 61px; }
  .book .bflip.go { animation: flip .65s ease-in-out; }
  @keyframes flip { 0% { opacity: 1; transform: scaleX(1); } 100% { opacity: 1; transform: scaleX(-1); } }
  .doze .face { animation: none; transform: translate(1px, 4px); }
  .doze .eye { display: none; }
  .doze .seye { display: inline; }
  .doze .zzz { display: block; }
  .doze .book { transform-box: fill-box; transform-origin: 50% 100%; transform: translateY(3px) rotate(5deg); transition: transform 1.5s; }
  .gaming .face { transform: translate(1.5px, 2.2px); }
  .gaming .th1 { animation: tap .22s ease-in-out infinite alternate; }
  .gaming .th2 { animation: tap .3s .1s ease-in-out infinite alternate; }
  @keyframes tap { to { transform: translateY(-1.3px); } }
  /* nur beim Spielen: Chrome animiert SVG-Teile in ausgeblendeten (display: none) Gruppen sonst weiter */
  .gaming .gbs rect:first-child { animation: gbj .9s steps(1) infinite; }
  .gaming .gbs rect:last-child { animation: gbc 1.6s steps(1) infinite; }
  @keyframes gbj { 50% { transform: translateY(-2.6px); } }
  @keyframes gbc { 50% { opacity: 0; } }
  .meh .ear-l { transform: rotate(-26deg); }
  .meh .ear-r { transform: rotate(24deg); }
  .lying .hop { transform: scale(1.12, .8); transition: transform .4s ease-out; }
  .tablet .face { transform: translate(2px, 2.6px); }
  .tablet.look-up .face { transform: translate(1px, -2.5px); }
  .tab .tglow { opacity: .16; }
  .dusk .tab .tglow, .night .tab .tglow { opacity: .35; }
  .tab .tscr-p, .tplane .tab .tscr-f { display: none; }
  .tplane .tab .tscr-p { display: inline; }
  .tab .tpaw { transform-box: fill-box; }
  .swipe .tab .tpaw { animation: swipe .6s ease-in-out; }
  @keyframes swipe { 50% { transform: translateX(-9px); } }
  .kiting .face { transform: translate(1px, -2.5px); }
  .kiting .ear { transform: translateY(-1.5px); }
  .tv .all { display: none; }
  .tv .bk { display: inline; }
  .tv .bk .rim { animation: tvflk 1.3s linear infinite; }

  .anchor { position: absolute; left: 75%; top: 20%; width: 0; height: 0; }
  .left .anchor { left: 25%; }
  .inside .anchor { left: var(--ax); top: var(--ay); }
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
  /* Im Bau steht die Blase rechts neben dem Eingang (Anker --ax), damit das Schild darüber frei bleibt */
  .inside .bubble { transform: translateX(-6%) scale(.3); transform-origin: 6% 100%; }
  .inside .bubble.on { transform: translateX(-6%) scale(1); }
  .inside .say::after { left: 6%; }
  .inside .think::before { left: 8%; }
  .inside .think::after { left: 2%; }

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
  .bar-c { background: #5fb9de; }

  /* Vögelchen: .bird steht mit den Füßen auf dem Sitzplatz (left/top), Flug per Web Animation */
  .bird { position: absolute; width: 0; height: 0; --bw: calc(var(--H) * .1); }
  .bird .bw {
    position: absolute; left: calc(var(--bw) * -.5 - 8px); bottom: -4px; width: var(--bw); padding: 8px 8px 4px;
    pointer-events: auto; cursor: pointer;
  }
  .bird.flying .bw { pointer-events: none; }
  .bf, .bb { transform-origin: 50% 100%; }
  .bf { transition: transform .15s; }
  .bird.left .bf { transform: scaleX(-1); }
  .bird svg { display: block; width: 100%; height: auto; overflow: visible; }
  .bird .wu { display: none; transform-box: fill-box; transform-origin: 60% 100%; }
  .bird.flying .wu { display: inline; animation: flap .14s ease-in-out infinite alternate; }
  .bird.flying .wf { display: none; }
  .bird.flying .legs { opacity: 0; }
  @keyframes flap { to { transform: scaleY(-.75); } }
  .bh { transform-box: view-box; transform-origin: 18px 14px; transition: transform .18s ease-out; }
  .bird.tilt .bh { transform: rotate(-16deg); }
  .bird.peck .bh { animation: peck .45s ease-in-out; }
  @keyframes peck { 45% { transform: rotate(38deg) translateY(1px); } }
  .bird.hop .bb { animation: bhop .32s ease-out; }
  @keyframes bhop { 40% { transform: translateY(-35%) scale(.95, 1.06); } 80% { transform: scale(1.06, .92); } }
  .bird.fluff .bb { animation: fluff .7s ease-in-out; }
  @keyframes fluff { 30%, 60% { transform: scale(1.14, .94); } }
  .bird.land .bb { animation: bland .3s ease-out; }
  @keyframes bland { 30% { transform: scale(1.12, .84); } }
  .note {
    position: absolute; font-size: calc(var(--H) * .07); font-weight: 800; color: #fff; line-height: 1; pointer-events: none;
    text-shadow: 0 1px 2px rgba(60, 40, 30, .6); animation: note 1.3s ease-out forwards;
  }
  @keyframes note {
    0% { transform: translate(0, 0) scale(.4) rotate(-10deg); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx, 8px), calc(var(--H) * -.12)) scale(1) rotate(12deg); opacity: 0; }
  }

  /* Maus: läuft hinter Stein und Bau (Ebene davor), translate setzt das Skript */
  .mouse { position: absolute; left: 0; top: 0; width: 0; height: 0; --mw: calc(var(--H) * .13); }
  .mouse .mw {
    position: absolute; left: calc(var(--mw) * -.5 - 8px); bottom: -6px; width: var(--mw); padding: 10px 8px 6px;
    pointer-events: auto; cursor: pointer;
  }
  .mf, .mb { transform-origin: 50% 100%; }
  .mouse.left .mf { transform: scaleX(-1); }
  .mouse svg { display: block; width: 100%; height: auto; overflow: visible; }
  .mouse.run .mb { animation: scurry .12s linear infinite alternate; }
  @keyframes scurry { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-9%) rotate(2deg); } }
  .mouse.run .mtail { animation: tailw .24s ease-in-out infinite alternate; }
  .mtail { transform-box: view-box; transform-origin: 5px 14px; }
  @keyframes tailw { to { transform: rotate(10deg); } }
  .mouse.stand .mb { transform: scale(.88, 1.16); transition: transform .2s; }
  .mouse .mhead { transform-box: view-box; transform-origin: 17px 10px; transition: transform .2s; }
  .mouse.look .mhead { transform: rotate(-12deg); }
  .mouse .mnose, .mouse .whisk { transform-box: fill-box; transform-origin: 0% 50%; }
  .mouse.sniff .mnose { animation: mnose .18s ease-in-out infinite alternate; }
  .mouse.sniff .whisk { animation: whisk .18s ease-in-out infinite alternate; }
  @keyframes mnose { to { transform: translate(.4px, -.3px) scale(1.15); } }
  @keyframes whisk { to { transform: rotate(-8deg); } }
  .mear { transform-box: fill-box; transform-origin: 50% 90%; }
  .mouse.twitch .mear { animation: twitch .45s; }
  .squeak {
    position: absolute; padding: .1em .45em; border-radius: 999px; background: #fff; color: #4a3a2c; pointer-events: none;
    font-size: calc(var(--H) * .05); font-weight: 800; white-space: nowrap; box-shadow: 0 1px 4px rgba(0, 0, 0, .2);
    transform: translate(-50%, -100%); animation: squeak 1s ease-out forwards;
  }
  @keyframes squeak { 0% { opacity: 0; scale: .4; } 15% { opacity: 1; scale: 1; } 75% { opacity: 1; } 100% { opacity: 0; translate: 0 -6px; } }

  /* Häufchen liegen vorn auf dem Boden (vor dem Gras). Die Tippfläche ist größer als die Köttelchen. */
  .poops { position: absolute; inset: 0; z-index: 3; pointer-events: none; transition: filter 2.5s; }
  .day.overcast .poops { filter: brightness(.9) saturate(.8); }
  .dusk .poops { filter: brightness(.85) saturate(.85); }
  .night .poops { filter: brightness(.55) saturate(.6); }
  .poo {
    position: absolute; left: calc(var(--px) - 22px); bottom: calc(var(--H) - var(--gy) - var(--H) * .022 - 10px);
    width: 44px; padding: 14px 0 10px; display: flex; justify-content: center;
    pointer-events: auto; cursor: pointer;
  }
  .poo svg {
    display: block; width: calc(var(--H) * .11 * var(--ps, 1)); height: auto; overflow: visible;
    transform-origin: 50% 100%; filter: drop-shadow(0 1px 0 rgba(0, 0, 0, .18));
  }
  .poo.plop svg { animation: plop .5s cubic-bezier(.3, 1.6, .5, 1) both; }
  @keyframes plop {
    from { transform: translateY(-60%) scale(.3); opacity: 0; }
    55% { transform: scale(1.18, .8); opacity: 1; }
  }
  .poo.scooped { pointer-events: none; }
  .poo.scooped svg { animation: scooped .5s .2s ease-in forwards; }
  @keyframes scooped {
    30% { transform: translateX(-2px) scale(1.06, .88); }
    to { transform: translate(calc(var(--H) * .05), calc(var(--H) * -.12)) scale(.35); opacity: 0; }
  }
  .poo.gone { pointer-events: none; opacity: 0; transition: opacity .8s; }
  /* Alte Häufchen: eine kleine Fliege kreist darüber (nur bei Tag) */
  .fly { display: none; position: absolute; left: 50%; top: 6px; width: 0; height: 0; animation: buzz 2.6s linear infinite; }
  .poo.old .fly { display: block; }
  .night .poo .fly { display: none; }
  .fly::before {
    content: ''; position: absolute; left: -1.5px; top: -1.5px; width: 3.5px; height: 3px; border-radius: 50%; background: #2b2622;
  }
  .fly::after {
    content: ''; position: absolute; left: -1px; top: -4px; width: 3px; height: 2.6px; border-radius: 50%;
    background: rgba(255, 255, 255, .85); box-shadow: 0 0 0 .5px rgba(0, 0, 0, .25); animation: wing .09s linear infinite alternate;
  }
  @keyframes wing { to { transform: scaleY(.3) translateY(1px); } }
  @keyframes buzz {
    0% { transform: translate(0, 0); }
    20% { transform: translate(9px, -6px); }
    40% { transform: translate(3px, -12px); }
    55% { transform: translate(-8px, -7px); }
    75% { transform: translate(-5px, 1px); }
    90% { transform: translate(4px, -2px); }
    100% { transform: translate(0, 0); }
  }
  .scoop {
    position: absolute; width: calc(var(--H) * .14); margin-left: calc(var(--H) * -.045);
    pointer-events: none; animation: scoop .85s ease-in-out forwards;
  }
  .scoop svg { display: block; width: 100%; height: auto; transform-origin: 30% 90%; }
  @keyframes scoop {
    0% { transform: translateX(60%); opacity: 0; }
    20% { transform: translateX(20%); opacity: 1; }
    42% { transform: translateX(-12%); }
    70% { transform: translate(5%, -35%) rotate(-22deg); opacity: 1; }
    100% { transform: translate(35%, -80%) rotate(-30deg); opacity: 0; }
  }
  .spark {
    position: absolute; width: calc(var(--H) * .05); margin: calc(var(--H) * -.025); pointer-events: none;
    animation: spark .9s ease-out both;
  }
  .spark svg { display: block; width: 100%; height: auto; }
  .spark path { fill: #fff6b8; filter: drop-shadow(0 0 2px rgba(255, 236, 140, .9)); }
  @keyframes spark {
    0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
    30% { transform: translate(0, calc(var(--H) * -.03)) scale(1.1) rotate(25deg); opacity: 1; }
    100% { transform: translate(var(--dx, 0px), calc(var(--H) * -.1)) scale(.3) rotate(70deg); opacity: 0; }
  }

  /* Flugzeuge: Position und Größe setzt das Skript jede Sekunde (gleitet 1 s linear). Sie fliegen hinter den
     Hügeln, die Fähnchen liegen in einer eigenen Ebene darüber und sind antippbar. */
  .planes, .ptags { position: absolute; inset: 0; pointer-events: none; }
  .ptags { z-index: 4; }
  /* Offenes Fähnchen ist die wichtigste Info: dann liegt die Ebene vor Statusleiste und Futterknopf */
  .ptags.top { z-index: 6; }
  .plane { position: absolute; left: 0; top: 0; opacity: 0; transition: transform 1s linear, opacity 2s; will-change: transform; }
  .plane.on { opacity: var(--pa, 1); }
  /* Unsichtbare Tippfläche über dem Flugzeug (die Flugzeuge selbst liegen hinter den Hügeln) */
  .phit { position: absolute; left: 0; top: 0; display: none; pointer-events: auto; cursor: pointer; transition: transform 1s linear; }
  .phit.on { display: block; }
  .plane .pl-s {
    position: absolute; width: calc(var(--H) * .3); left: calc(var(--H) * -.15); top: calc(var(--H) * -.06);
    transition: transform 1s linear, opacity 3s;
  }
  .plane .pl-f { position: relative; transition: transform 1.2s ease-in-out; }
  .plane.left .pl-f { transform: scaleX(-1); }
  .plane svg { position: relative; display: block; width: 100%; height: auto; overflow: visible; }
  .plane .pl-body { transition: filter 2.5s; }
  .dusk .plane .pl-body { filter: brightness(.8) saturate(.9); }
  .night .plane .pl-body { filter: brightness(.28) saturate(.5); }
  .plane .win { fill: #6c8db3; transition: fill 2.5s; }
  .dusk .plane .win, .night .plane .win { fill: #ffe7a0; }
  .plane .bcn { fill: #ff3b30; animation: bcn 1.3s linear infinite; }
  .plane .strobe { fill: #fff; opacity: 0; }
  .dusk .plane .strobe, .night .plane .strobe { animation: strobe 1.7s linear infinite; filter: drop-shadow(0 0 2px #fff); }
  @keyframes bcn { 0%, 12% { opacity: 1; } 18%, 100% { opacity: .15; } }
  @keyframes strobe { 0%, 5% { opacity: 1; } 8%, 100% { opacity: 0; } }
  .plane .rotor { transform-box: fill-box; transform-origin: center; animation: rotor .14s linear infinite alternate; }
  .plane .prop, .plane .trotor { transform-box: fill-box; transform-origin: center; animation: prop .09s linear infinite alternate; }
  @keyframes rotor { to { transform: scaleX(.15); } }
  @keyframes prop { to { transform: scaleY(.2); } }
  /* Kondensstreifen in Reiseflughöhe, zieht hinter dem Heck her */
  .plane .trail {
    position: absolute; right: 93%; top: 46%; width: 520%; height: 6%; border-radius: 999px;
    background: linear-gradient(to left, rgba(255, 255, 255, .9), rgba(255, 255, 255, 0)); opacity: 0; transition: opacity 4s;
  }
  .plane.contrail .trail { opacity: 1; }
  .dusk .plane .trail { background: linear-gradient(to left, rgba(255, 226, 214, .8), rgba(255, 226, 214, 0)); }
  .night .plane .trail { background: linear-gradient(to left, rgba(180, 192, 228, .3), rgba(180, 192, 228, 0)); }
  .overcast .plane.hi .pl-s { opacity: .3; }
  .foggy .plane .pl-s { opacity: .25; }
  /* Nie breiter als die Karte (Handy): zu lange Zeilen enden mit … */
  .ptag {
    position: absolute; left: 0; top: 0; padding: .1em .65em .15em; border-radius: .9em;
    box-sizing: border-box; max-width: calc(100% - 8px); overflow: hidden; text-overflow: ellipsis;
    font-size: clamp(10px, calc(var(--H) * .05), 14px); line-height: 1.35; white-space: nowrap;
    color: #2f4256; background: rgba(255, 255, 255, .8); box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
    pointer-events: none; cursor: pointer; opacity: 0; transition: transform 1s linear, opacity .3s, background 2.5s, color 2.5s;
  }
  .ptag.on.open { opacity: 1; pointer-events: auto; z-index: 1; }
  .ptag b { font-weight: 700; letter-spacing: .02em; }
  .ptag .more { font-size: .9em; opacity: .85; overflow: hidden; text-overflow: ellipsis; }
  .dusk .ptag { background: rgba(255, 255, 255, .72); }
  .night .ptag { color: #e4e9f6; background: rgba(22, 32, 62, .72); }
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
      this._inside = false; // im Bau
      this._lift = 0; // Höhe über dem Boden (auf dem Stein)
      this._poseName = null;
      this._next = null; // nächste Aktion erzwingen (Vorschau)
      this._stats = null;
      this._elev = null;
      this._az = null;
      this._wx = {};
      this._timers = [];
      this._loops = [];
      this._dbgSleep = null;
      this._dbgElev = null;
      this._dbgShift = 0; // Vorschau: Uhr für die Häufchen vorstellen
      this._dbgShiftMs = 0; // Vorschau: Uhr für die Besuche (Vögelchen, Maus, Pino) vorstellen
      this._pileEls = new Map(); // sichtbare Häufchen: Schlüssel "großputz:k" → Element
      this._poopPending = null; // Häufchen, das er gerade live macht
      this._critId = 0; // Besucher (Vögelchen, Maus): Lauf-Nummer zum Abbrechen
      this._critT = [];
      this._bird = this._mouse = null;
      this._planes = new Map(); // Flug-ID → Flugzeug am Himmel
      this._planeT = null;
    }

    setConfig(config) {
      this._cfg = { ...DEFAULTS, ...(config || {}) };
      if (!this._el) this._build();
      this._applyAreal();
      this._el.name.textContent = this._cfg.name;
      this._el.stats.hidden = !this._cfg.show_stats;
      this._el.scene.style.minHeight = `${Number(this._cfg.height) || DEFAULTS.height}px`;
      // Zustand nur beim ersten Mal und bei anderem Helfer neu laden: Der Editor ruft setConfig bei jeder
      // Änderung, ein noch nicht gespeicherter Stand (1,2 s Wartezeit beim Speichern) ginge sonst verloren
      const ent = this._cfg.entity || '';
      if (ent !== this._entKey) {
        this._entKey = ent;
        clearTimeout(this._saveT);
        clearTimeout(this._freshT);
        this._pendingWrite = this._synced = this._noEntity = false;
        this._gain = { s: 0, g: 0, c: false };
        this._lastEntityState = null; // beim nächsten hass neu lesen, auch wenn der Helfer fehlt
        this._stats = null;
        if (!ent) this._loadLocal();
      }
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
          clearTimeout(this._freshT);
          // Helfer gibt es nicht: auf diesem Gerät weiterspielen (localStorage) statt ins Leere zu schreiben
          if (st === undefined && !this._noEntity) {
            console.warn(`pika-pet-card: ${c.entity} gibt es nicht, der Zustand bleibt auf diesem Gerät`);
            if (!this._stats) this._loadLocal();
          }
          this._noEntity = st === undefined;
          if (parsed) {
            this._synced = true;
            if (this._pendingWrite && this._stats) {
              // Eigene Änderung wartet noch aufs Senden: zusammenführen statt den fremden Stand zu verwerfen
              this._stats = mergeStats(this._stats, parsed, this._gain, Date.now());
              this._save();
            } else {
              this._stats = parsed;
            }
          } else if (!this._synced && st !== undefined && st !== 'unavailable') {
            // Helfer neu angelegt, leer oder mit fremdem Inhalt: mit Startwerten füllen. "unknown" gibt es auch kurz
            // beim Start von HA, darum erst, wenn es so bleibt – sonst wäre der gespeicherte Stand weg. unavailable: abwarten.
            if (st !== '' && st !== 'unknown') console.warn(`pika-pet-card: ${c.entity} enthält "${st}", fange neu an`);
            const fill = () => {
              this._synced = true;
              this._stats ??= freshStats();
              this._save();
              this._renderStats();
            };
            if (st !== 'unknown') fill();
            else this._freshT = setTimeout(() => this._lastEntityState === 'unknown' && !this._synced && fill(), 20000);
          }
          this._renderStats();
        }
      }
      const sun = hass.states[c.sun_entity];
      const elev = Number(sun?.attributes?.elevation);
      const az = Number(sun?.attributes?.azimuth);
      // unavailable/unknown: Sonnenstand unbekannt (null) statt Nacht – der Himmel richtet sich dann nach der Schlafenszeit
      const sunOk = sun && sun.state !== 'unavailable' && sun.state !== 'unknown';
      this._elev = sunOk ? (Number.isFinite(elev) ? elev : sun.state === 'above_horizon' ? 10 : -10) : null;
      this._az = Number.isFinite(az) ? az : null;
      // Erste Sonnenzeiten: Lag die Karte schon ohne hass, sofort richtig schlafen/wach sein statt hinzulaufen
      if (!this._hadHass && this._g) {
        this._hadHass = true;
        if (this._sleepTime() !== this._asleep) {
          this._stop();
          this._sleepNow(!this._asleep);
          this._start();
        }
      }
      const w = hass.states[c.weather_entity];
      if (w !== this._lastWeather) {
        this._lastWeather = w;
        this._readWeather(w);
      }
      const fl = c.flight_entity ? hass.states[c.flight_entity] : undefined;
      if (fl !== this._lastFlights) {
        this._lastFlights = fl;
        this._readFlights(fl);
      }
      this._hassSky(hass);
      this._hassFest(hass);
      this._hassFriend(hass);
      this._hassBote(hass);
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
      this._onVis = () => (document.hidden ? (this._stop(), this._stopCritters(), this._hiddenFeatures(true)) : (this._start(), this._startCritters(), this._hiddenFeatures(false)));
      document.addEventListener('visibilitychange', this._onVis);
      this._loop(() => this._blink(), 2200, 6000);
      this._loop(() => this._twitch(), 5000, 13000);
      this._loop(() => this._lightning(), 6000, 16000);
      this._timers.push(setInterval(() => this._tick(), 20000));
      this._timers.push(setInterval(() => this._regrow(), 150000));
      this._layout();
      this._start();
      this._startCritters();
      this._readFlights(this._lastFlights); // Flieger, die während der Trennung gemeldet wurden
      this._planeLoop();
      this._attachSky();
      this._attachFest();
      this._attachFriend();
      this._attachBote();
    }

    _detach() {
      if (!this._attached) return;
      this._attached = false;
      this._stop();
      this._stopCritters();
      this._ro?.disconnect();
      document.removeEventListener('visibilitychange', this._onVis);
      this._timers.forEach((t) => clearInterval(t));
      this._timers = [];
      clearInterval(this._planeT);
      this._planeT = null;
      this._loops.forEach((h) => clearTimeout(h.t));
      this._loops = [];
      this._detachSky();
      this._detachFest();
      this._detachFriend();
      this._detachBote();
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
        <style>${STYLE}${STYLE_SKY}${STYLE_FEST}${STYLE_FRIEND}${STYLE_BOTE}</style>
        <ha-card>
          <div class="scene day">
            <div class="sky sky-day"></div><div class="sky sky-dusk"></div><div class="sky sky-night"></div>
            <div class="sky sky-grey"></div>
            <div class="stars">${stars}</div>
            <div class="meteors"></div>
            <div class="sun"></div>
            <div class="moon"><svg viewBox="0 0 100 100"><circle class="moon-dark" cx="50" cy="50" r="50"/><path class="moon-lit"/></svg></div>
            <div class="clouds">${clouds}</div>
            <div class="planes"></div>
            <svg class="hills" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <g class="mtn">
                <path class="m1" d="M0 58 L10 40 L17 46 L30 22 L40 36 L47 30 L60 50 L70 34 L78 40 L88 18 L100 36 V100 H0Z"/>
                <path class="mcap" d="M30 22 L34.3 28 L32 27 L30.5 29 L28.5 27.2 L26.75 28Z"/>
                <path class="mcap" d="M88 18 L92.7 25 L90.5 24 L88.5 26 L86.5 24.2 L84.8 25Z"/>
                <path class="mcap" d="M70 34 L74 37 L72 36.4 L70.5 37.6 L69 36.5 L68.1 37Z"/>
                <path class="mcap" d="M47 30 L49.6 34 L48.3 33.5 L47 34.6 L45.8 33.6 L44.6 34Z"/>
              </g>
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
            <div class="mice-f"></div>
            <div class="props"></div>
            <div class="friends"></div>
            <div class="ff">${flies}</div>
            <div class="pika" role="button" aria-label="Streicheln">
              <div class="clipw">
                <div class="shadow"></div>
                <div class="depth"><div class="flip"><div class="jump"><div class="hop"><div class="br">${PIKA_SVG}</div></div></div></div></div>
              </div>
              <div class="anchor">
                <div class="zzz"><span>z</span><span>z</span><span>Z</span></div>
                <div class="bubble say"></div>
                <div class="bubble think">${FOOD.lz.svg}</div>
              </div>
            </div>
            <div class="fore"><div class="hay">${HAY_SVG}</div></div>
            <div class="fest-f"></div>
            <div class="grass">${TUFTS_SVG()}</div>
            <div class="poops"></div>
            <div class="precip"></div>
            <div class="fog"><i></i><i></i></div>
            <div class="flash"></div>
            <div class="ptags"></div>
            <div class="fx"></div>
            <div class="stats">
              <span class="nm"></span>
              <span class="st st-s" title="Satt">${ICON_LEAF}<i><b class="bar-s"></b></i></span>
              <span class="st st-g" title="Glücklich">${ICON_HEART}<i><b class="bar-g"></b></i></span>
              <span class="st st-c" title="Sauber">${ICON_SPARK}<i><b class="bar-c"></b></i></span>
            </div>
            <button class="feed" title="Füttern" aria-label="Füttern">${FOOD.lz.svg}</button>
          </div>
        </ha-card>`;

      const $ = (s) => this.shadowRoot.querySelector(s);
      this._el = {
        scene: $('.scene'), pika: $('.pika'), jump: $('.jump'), mfood: $('.mfood'),
        flowers: $('.flowers'), foods: $('.foods'), fx: $('.fx'), hay: $('.hay'),
        stats: $('.stats'), name: $('.nm'), barS: $('.bar-s'), barG: $('.bar-g'),
        birds: $('.birds'), mice: $('.mice'), miceF: $('.mice-f'), planes: $('.planes'), ptags: $('.ptags'),
        tvl: $('.tvl'), kites: $('.kites'), bflip: $('.bflip'),
        stS: $('.st-s'), stG: $('.st-g'), barC: $('.bar-c'), stC: $('.st-c'), poops: $('.poops'), feed: $('.feed'), say: $('.say'), think: $('.think'),
        sun: $('.sun'), moon: $('.moon'), moonLit: $('.moon-lit'), clouds: [...this.shadowRoot.querySelectorAll('.cloud')],
        precip: $('.precip'), flash: $('.flash'),
        burrow: $('.burrow'), lights: $('.lights'), clipw: $('.clipw'), depth: $('.depth'), rock: $('.lookout'),
        meteors: $('.meteors'), ff: $('.ff'), festB: $('.fest-b'), festF: $('.fest-f'), props: $('.props'), friends: $('.friends'),
      };
      this._el.pika.addEventListener('click', (e) => (e.stopPropagation(), this._onPet()));
      this._el.feed.addEventListener('click', (e) => (e.stopPropagation(), this._onFeed()));
      this._el.scene.addEventListener('click', (e) => this._onLookAt(e));
      this._loadHay();
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
      if (this._blooms) this._renderHay();
      if (this._g) {
        this._stop();
        this._g = null;
        this._flowers.forEach((f) => f.el.remove());
        this._flowers = [];
        this._asleep = this._inside = false;
        this._lift = 0;
        this._poseName = null;
        this._el.pika.classList.remove('sleeping', 'inside');
        this._el.clipw.style.clipPath = '';
        this._layout();
        this._restartCritters();
      }
    }

    _layout() {
      const W = this._el.scene.clientWidth;
      const H = this._el.scene.clientHeight;
      if (!W || !H) return;
      const first = !this._g;
      // Gleiche Größe (z. B. der erste Aufruf des ResizeObservers gleich nach _attach): nichts zu tun
      if (!first && W === this._W && H === this._H) return;
      // Beim Laufen ist this._x schon das Ziel: echte Stelle merken (noch mit der alten Pika-Breite)
      const liveX = !first && !this._inside && !(this._lift > 0) && this._el.pika.classList.contains('walking') ? this._liveX() : null;
      const ratio = first ? 1 : W / this._W;
      this._W = W;
      this._H = H;
      const pH = clamp(H * 0.4, 48, 170);
      const pW = pH * 1.2;
      const gy = H * 0.9;
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
      // Aussichtsstein rechts, links neben dem Futterknopf, aber nie über den rechten Rand hinaus
      const ku = kW / 100;
      const kL = Math.min(Math.max(hL + hW + gap, W - 66 - kW), W - kW);
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
      const vars = { W, H, pw: pW, ph: pH, gy, hw: hW, hl: hL, fw: H * 0.085, dw: H * 0.13 };
      for (const [k, v] of Object.entries(vars)) this._el.scene.style.setProperty(`--${k}`, `${v}px`);

      if (first) {
        this._initFlowers();
        if (this._sleepTime()) this._sleepNow(true);
        else this._setX(rnd(this._g.home + pW, W * 0.7), true);
        this._updateSky();
        this._placePiles(); // neues Areal: schon liegende Häufchen an die neuen Stellen
        this._renderStats();
        this._start();
      } else if (this._inside) {
        this._setX(this._g.home, true);
        this._pose(this._poseName, 0);
      } else if (this._lift > 0) {
        this._lift = rock.lift;
        this._setX(rock.cx, true);
      } else {
        this._setX((liveX ?? this._x) * ratio, true);
        // Mitten im Laufen angehalten: Aktion neu wählen, sonst hoppelt er bis zum Ende auf der Stelle
        if (liveX != null) this._interrupt();
      }
      // Fähnchen neu messen (Schriftgröße hängt an --H)
      for (const p of this._planes.values()) p.tw = 0;
      this._layoutSky(first);
      this._layoutFest(first);
      this._layoutFriend(first);
      this._layoutBote(first);
      if (!first) {
        this._placePiles();
        // Besucher sitzen an festen Pixeln: bei Größenänderung lieber neu kommen lassen
        if (this._bird || this._mouse) this._restartCritters();
      }
    }

    // Ohne Übergang einschlafen (im Bau) bzw. aufwachen (vor dem Bau)
    _sleepNow(on) {
      const p = this._el.pika;
      this._asleep = on;
      this._lift = 0;
      p.classList.toggle('sleeping', on);
      if (on) {
        this._setX(this._g.home, true);
        this._inside = true;
        this._pose('sleep', 0);
      } else if (this._inside) {
        this._inside = false;
        this._pose('out', 0);
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
      p.classList.remove('walking', 'eating', 'groom', 'carry', 'look-f', 'look-b', 'look-up', 'happy', 'calling', 'crouch', 'squat', 'sniff',
        'reading', 'doze', 'gaming', 'meh', 'lying', 'tablet', 'tplane', 'swipe', 'kiting', 'tv');
      this._tvOn(false);
      this._kiteAway();
      this._mouth(null);
      this._bubble(this._el.think, false);
      this._action = null;
    }

    async _step() {
      if (!this._g) return this._wait(500);
      // Unterbrochen, während er auf dem Stein stand: erst herunter
      if (this._lift > 0) return this._run('hopDown');
      const sleepy = this._sleepTime();
      if (sleepy && !this._asleep) {
        // Wollte er gerade ein Häufchen machen: liegt es eben gleich da, sonst bliebe es bis morgen unsichtbar
        if (this._next === 'poop') this._next = null;
        this._revealPending();
        return this._run('goSleep');
      }
      if (!sleepy && this._asleep) return this._run('wakeUp');
      if (this._asleep) return this._wait(60000);

      const food = this._foods.find((f) => f.landed);
      const wx = this._wx;
      const next = this._next;
      const stayIn = next ? next === 'burrow' || next === 'tv' : wx.shelter && !food;
      if (this._inside && !stayIn) return this._run('comeOut');
      if (next) {
        this._next = null;
        this._forced = true; // Vorschau: auch ohne passendes Wetter
        return this._run(next);
      }
      this._forced = false;
      if (food) return this._run('eatFood', food);
      // Bei Starkregen und Gewitter im Bau bleiben und ab und zu herausschauen – oder fernsehen
      if (wx.shelter) {
        if (this._inside && this._hobbyOk(true) && Math.random() < 0.5) return this._run('tv');
        return this._run(this._inside ? 'hideout' : 'shelter');
      }

      const s = this._get('s');
      const g = this._get('g');
      const { piles, clean } = this._poops();
      this._el.pika.classList.toggle('sad', g < 25 || s < 15 || clean < 30);
      // Unter Schnee gibt es keine Blumen, bei Regen bleibt das Heu trocken (kein Sammeln)
      const hasFlowers = this._flowers.length > 0 && !wx.snowcover;
      // Beschäftigungen höchstens alle 12–20 Minuten; Fernsehen bei Regen oder in der Dämmerung
      const hob = this._hobbyOk(wx.wet);
      const elev = this._dbgElev ?? this._elev;
      const dry = hob && !wx.wet;
      // Zusatz-Aktionen der Erweiterungen (Himmel, Festtage, Freund, Haus-Bote) bekommen dieselbe Lage
      const ctx = { s, g, wx, hob, dry, elev, piles, clean, hasFlowers };
      const act = weighted([
        [dry ? 1.2 : 0, 'read'],
        [dry ? 1 : 0, 'game'],
        [dry && !wx.snowcover ? 0.9 : 0, 'tablet'],
        [hob && this._kiteWind() ? 3 : 0, 'kite'],
        [hob ? (wx.wet ? 3 : elev != null && elev < 4 ? 1 : 0) : 0, 'tv'],
        [3, 'idle'],
        [3, 'look'],
        [3, 'wander'],
        [wx.wet ? 2 : 1, 'burrow'],
        [wx.wet ? 0.4 : 1.6, 'lookout'],
        [hasFlowers ? (s < 50 ? 3 : 1.2) : 0, 'nibble'],
        [hasFlowers && !wx.wet && this._hay < 12 ? 1.4 : 0, 'gather'],
        [wx.snowcover || wx.wet ? 1.2 : 0, 'haySnack'],
        [wx.wet ? 0 : 1.4, 'groom'], // eine Pfote hält bei Regen das Blatt
        [0.8, 'squeak'],
        [wx.wet ? 0 : g > 70 ? 1.2 : g > 40 ? 0.4 : 0, 'binky'],
        [s < 30 ? 3 : 0, 'hungry'],
        [piles.length && clean < 60 ? 1.2 : 0, 'sniff'],
        [this._bird?.sitting ? 2.5 : 0, 'watchBird'],
        [this._mouse?.out ? 2.5 : 0, 'watchMouse'],
        [this._planeToWatch() ? 2.5 : 0, 'watchPlane'],
        ...this._skyActs(ctx),
        ...this._festActs(ctx),
        ...this._friendActs(ctx),
        ...this._boteActs(ctx),
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

    // ---------- Aussichtsstein ----------

    // Auf den Stein springen, Ausschau halten und pfeifen, wieder herunter
    async _lookout() {
      const { rock } = this._g;
      await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1));
      await this._wait(rnd(200, 600));
      // Sitzt ein Vögelchen auf dem Stein, fliegt es vorher weg
      if (this._bird?.perch === 'rock') {
        this._bird.scare();
        await this._wait(600);
      }
      await this._hopTo(rock.cx, rock.lift);
      this._puff(rock.cx, this._g.gy - rock.lift, 2);
      await this._wait(rnd(400, 900));
      const n = 3 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        if (r < 0.5 || i === 0) await this._call();
        else if (r < 0.75) this._face(-this._dir);
        else {
          this._el.pika.classList.add('look-up');
          await this._wait(rnd(800, 1400));
          this._el.pika.classList.remove('look-up');
        }
        await this._wait(rnd(700, 1800));
      }
      await this._hopDown();
    }

    // Pfiff: aufrichten, Maul auf, iiep – manchmal zweimal hintereinander
    async _call() {
      const p = this._el.pika;
      const twice = Math.random() < 0.3;
      for (let i = 0; i < (twice ? 2 : 1); i++) {
        p.classList.remove('calling');
        void p.offsetWidth;
        p.classList.add('calling');
        this._say(pick(['iiiep!', 'iiep!', 'iiiiep!', 'mip!']), 900);
        await this._wait(650);
        p.classList.remove('calling');
        if (twice) await this._wait(250);
      }
      await this._wait(300);
    }

    async _hopDown() {
      await this._hopTo((Math.random() < 0.5 && this._footX(1)) || this._footX(-1), 0);
      this._puff(this._x, this._g.gy, 3);
    }

    // Staubwölkchen bei der Landung
    _puff(x, y, n) {
      const { pW } = this._g;
      for (let i = 0; i < n; i++) {
        const el = document.createElement('span');
        el.className = 'puff';
        const side = i % 2 ? 1 : -1;
        el.style.left = `${x + side * rnd(pW * 0.1, pW * 0.3)}px`;
        el.style.top = `${y - this._H * 0.03}px`;
        el.style.setProperty('--px', `${side * rnd(this._H * 0.03, this._H * 0.07)}px`);
        this._el.fx.appendChild(el);
        setTimeout(() => el.remove(), 650);
      }
    }

    // Absprungstelle neben dem Stein (side -1 links, 1 rechts). Rechts null, wenn dort kein Platz ist.
    _footX(side) {
      const { rock, pW } = this._g;
      const x = rock.cx + side * (rock.w / 2 + pW * 0.15);
      if (side > 0) return x > this._W - pW * 0.45 ? null : x;
      return Math.max(x, pW * 0.45);
    }

    async _hopTo(x, lift, crouch = true) {
      const { pW } = this._g;
      x = clamp(x, pW * 0.45, this._W - pW * 0.45); // wie beim Laufen im Bild bleiben
      if (Math.abs(x - this._x) > 2) this._face(x > this._x ? 1 : -1);
      const p = this._el.pika;
      if (crouch) {
        p.classList.add('crouch');
        await this._wait(180);
        p.classList.remove('crouch');
      }
      p.style.transition = 'transform .55s cubic-bezier(.3, .6, .4, 1)';
      this._lift = lift;
      this._setX(x);
      this._jump('hop1');
      await this._wait(620);
    }

    // ---------- Bau ----------

    // Rein, ein paarmal herausschauen, wieder raus
    async _burrow() {
      if (!this._inside) await this._enterBurrow();
      await this._wait(rnd(1500, 4000));
      const n = 1 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        await this._peekOut();
        if (i < n - 1) {
          await this._to('hidden', 450);
          await this._wait(rnd(1200, 3500));
        }
      }
      await this._comeOut();
    }

    async _shelter() {
      this._say('!');
      await this._enterBurrow(1.4);
      await this._wait(rnd(800, 1600));
      await this._peekOut();
    }

    async _hideout() {
      if (this._poseName !== 'hidden') await this._to('hidden', 450);
      await this._wait(rnd(2500, 7000));
      await this._peekOut();
    }

    async _enterBurrow(speed = 1) {
      await this._walkTo(this._g.home, speed);
      this._setX(this._g.home, true);
      this._inside = true;
      await this._to('door', 450);
      await this._wait(150);
      await this._to('hidden', 500);
    }

    // Erst die Ohrspitzen, kurz lauschen, dann der ganze Kopf. Manchmal duckt er sich noch einmal weg.
    async _peekOut() {
      await this._to('ears', 420);
      this._twitch();
      await this._wait(rnd(500, 1100));
      if (Math.random() < 0.25) {
        await this._to('hidden', 220);
        await this._wait(rnd(600, 1200));
        await this._to('ears', 300);
        await this._wait(rnd(300, 600));
      }
      await this._to('peek', 380);
      const p = this._el.pika;
      const n = 2 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        await this._wait(rnd(600, 1500));
        const r = Math.random();
        if (r < 0.45) this._face(-this._dir);
        else if (r < 0.7) {
          p.classList.add('look-up');
          await this._wait(rnd(700, 1200));
          p.classList.remove('look-up');
        } else if (r < 0.85) this._say(pick(['iiep!', 'mip!']));
        else this._twitch();
      }
      await this._wait(rnd(500, 1000));
    }

    async _comeOut() {
      if (this._poseName !== 'peek') await this._to('peek', 450);
      await this._wait(rnd(300, 700));
      await this._to('door', 350);
      this._inside = false;
      // groß werden und dabei aus der Tür nach vorn hüpfen
      this._face(1);
      this._pose('out', 450);
      await this._hopTo(this._g.home + this._g.pW * 0.35, 0, false);
      this._puff(this._x, this._g.gy, 2);
    }

    async _to(name, ms) {
      this._pose(name, ms);
      await this._wait(ms);
    }

    // Haltung im Bau: door = steht im Eingang, peek = Kopf schaut heraus, sleep = Mütze und Augen,
    // hidden = ganz drin, out = draußen in voller Größe
    _pose(name, ms) {
      if (!this._g || !name) return;
      this._poseName = name;
      const { pH, pW, gy, hole } = this._g;
      const p = this._el.pika;
      const cw = this._el.clipw;
      const top = gy - pH * 0.945;
      const L = this._x - pW / 2;
      const open = `inset(${-pH}px ${-pW}px ${-pH * 0.3}px ${-pW}px round 0px 0px 0px 0px)`;
      // clip-path lässt sich nur zwischen gleichen Formen überblenden
      if (!cw.style.clipPath) {
        cw.style.transition = 'none';
        cw.style.clipPath = open;
        void cw.offsetWidth;
      }
      const tr = ms ? `${ms}ms cubic-bezier(.45, 0, .4, 1)` : '0s';
      cw.style.transition = `clip-path ${tr}`;
      this._el.depth.style.transition = `transform ${tr}`;
      if (name === 'out') {
        p.classList.remove('inside');
        cw.style.clipPath = open;
        return;
      }
      const hw = hole.r - hole.l;
      // Im Bau ein Stück kleiner als die Tür (weiter hinten). Beim Fernsehen sitzt er noch weiter drinnen,
      // damit man das Licht vom Fernseher um ihn herum sieht.
      const ds = clamp((0.85 * hw) / (0.43 * pW), 0.4, 0.9) * (name === 'tv' ? 0.68 : 0.8);
      const v = { door: 0.945, peek: 0.6, sleep: 0.53, ears: 0.25, hidden: -0.15, tv: 0.8 }[name];
      const px = (n) => `${n.toFixed(1)}px`;
      cw.style.clipPath = `inset(${px(hole.top - top)} ${px(L + pW - hole.r)} ${px(top + pH - hole.lip)} ${px(hole.l - L)} `
        + `round ${px(hw / 2)} ${px(hw / 2)} 0px 0px)`;
      const s = p.style;
      s.setProperty('--ds', ds.toFixed(3));
      s.setProperty('--dy', px(hole.lip + pH * ds * (1 - v) - (top + pH)));
      s.setProperty('--hc', px(hole.cx - this._x));
      s.setProperty('--hh', px(0.22 * pW * ds));
      s.setProperty('--ax', px(hole.r - L + hw * 0.02)); // Sprechblase rechts neben dem Eingang
      s.setProperty('--ay', px(hole.top - top + pH * 0.02));
      p.classList.add('inside');
    }

    async _haySnack() {
      await this._walkTo(this._g.stand);
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
      await this._walkTo(this._g.stand);
      this._face(-1);
      await this._wait(350);
      // Blüte im Bogen auf den Haufen bzw. in die Nische werfen, dort bleibt sie liegen
      this._el.pika.classList.remove('carry');
      const spot = this._haySpot();
      this._toss(f.color, spot);
      await this._wait(460);
      this._addHay(f.color, spot);
      await this._wait(900);
    }

    // Zufällige Stelle auf der Oberfläche des Heuhaufens (Koordinaten der Heu-Grafik, 60 × 40)
    _haySpot() {
      const sx = rnd(15, 45);
      const top = 10 + ((sx - 30) / 28) ** 2 * 26;
      return { sx: +sx.toFixed(1), sy: +rnd(top + 3, Math.min(35, top + 11)).toFixed(1) };
    }

    // Liegeplätze der Blüten in der Nische (Bau-Einheiten): Reihen von unten nach oben, abwechselnd 6 und 5
    _stashSlots() {
      const S = this._areal().stash;
      if (!S) return [];
      const F = this._areal().vh - this._areal().sink;
      const P = [];
      for (let row = 0; P.length < STASH_MAX; row++) {
        for (let k = 0; k < 6 - (row % 2) && P.length < STASH_MAX; k++) {
          P.push([S.x1 + 3.2 + (row % 2) * 1.5 + k * 2.75, F - 3.6 - row * 1.7 + (k % 2 ? 0.25 : -0.15)]);
        }
      }
      return P;
    }

    _toss(color, spot) {
      const { pW, pH, gy, hay } = this._g;
      const x0 = this._x + this._dir * 0.4 * pW;
      const y0 = gy - pH * 0.335 - this._lift;
      let dx;
      let dy;
      if (this._g.stash) {
        // Ziel: der Platz, auf dem die Blüte gleich in der Nische liegt
        const { l, u, base } = this._g.bur;
        const [bx, by] = this._stashSlots()[Math.min(this._blooms.length, STASH_MAX - 1)];
        dx = l + bx * u - x0;
        dy = base + by * u - y0;
      } else {
        // Ziel bei der Größe, die der Haufen gleich hat
        const hW = this._g.hW;
        const hs = 0.4 + Math.min(12, this._hay + 1) * 0.055;
        dx = hay + ((spot.sx - 30) / 60) * hW * hs - x0;
        dy = gy + 4 - ((40 - spot.sy) / 40) * hW * (2 / 3) * hs - y0;
      }
      const el = document.createElement('span');
      el.className = 'toss';
      el.innerHTML = `<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.4" fill="${color}" stroke="rgba(0,0,0,.15)" stroke-width=".6"/>`
        + '<circle cx="5" cy="5" r="1.6" fill="#e0a032" opacity=".8"/></svg>';
      el.style.left = `${x0}px`;
      el.style.top = `${y0}px`;
      this._el.fx.appendChild(el);
      el.animate([
        { transform: 'translate(0, 0) rotate(0deg)' },
        { transform: `translate(${dx * 0.5}px, ${Math.min(dy, 0) - pH * 0.28}px) rotate(200deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(.75)` },
      ], { duration: 460, easing: 'ease-in-out', fill: 'forwards' });
      setTimeout(() => el.remove(), 480);
    }

    async _groom() {
      this._el.pika.classList.add('groom');
      await this._wait(rnd(1800, 3200));
    }

    async _squeak() {
      const p = this._el.pika;
      p.classList.add('calling');
      this._say(pick(['iiep!', 'iiep!', 'mip!', 'iiiep!']));
      this._jump('hop1');
      await this._wait(650);
      p.classList.remove('calling');
      await this._wait(950);
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
      this._face(-this._dir);
      this._jump('hop1');
      await this._wait(500);
      await this._walkTo(this._x + this._dir * this._g.pW * rnd(0.8, 1.6), 1.3);
      await this._wait(rnd(400, 900));
    }

    // Zum Vögelchen hinschauen, piepsen – es zwitschert zurück
    async _watchBird() {
      const b = this._bird;
      if (!b?.sitting) return;
      const { pW } = this._g;
      const d = b.x - this._x;
      if (Math.abs(d) > this._W * 0.3 || Math.abs(d) < pW * 0.4) {
        await this._walkTo(b.x - (Math.sign(d) || 1) * pW * rnd(0.8, 1.3), 0.8);
      }
      this._face(b.x >= this._x ? 1 : -1);
      const p = this._el.pika;
      p.classList.add('look-up');
      await this._wait(rnd(1200, 2200));
      if (Math.random() < 0.6 && this._bird === b) {
        p.classList.add('calling');
        this._say(pick(['iiep!', 'mip!']), 900);
        await this._wait(650);
        p.classList.remove('calling');
        setTimeout(() => this._bird === b && this._tweet(b), 400);
      }
      await this._wait(rnd(1200, 2500));
    }

    // Der Maus zuschauen, manchmal neugierig ein Stück hin (zu nah, und sie flitzt weg)
    async _watchMouse() {
      const m = this._mouse;
      if (!m?.visible) return;
      const p = this._el.pika;
      this._face(m.x >= this._x ? 1 : -1);
      p.classList.add('look-f');
      await this._wait(rnd(900, 1600));
      if (m.out && Math.random() < 0.5) {
        p.classList.remove('look-f');
        await this._walkTo(m.x - this._dir * this._g.pW * rnd(0.7, 1.1), 0.6);
        p.classList.add('look-f');
      }
      if (Math.random() < 0.4) this._say(pick(['mip?', 'iiep?']), 1000);
      await this._wait(rnd(1000, 2200));
    }

    // Einem tief fliegenden Flugzeug nachschauen; ganz nah und laut erschrickt er kurz
    async _watchPlane() {
      const pl = this._planeToWatch();
      if (!pl) return;
      pl.watched = (pl.watched || 0) + 1;
      const p = this._el.pika;
      this._face(pl.x >= this._x ? 1 : -1);
      if (pl.slant < 3) {
        this._jump('hop1');
        this._say('!', 900);
        await this._wait(700);
      }
      p.classList.add('look-up');
      await this._wait(rnd(1500, 2500));
      // dreht sich mit, wenn es schon vorbei ist
      this._face(pl.x >= this._x ? 1 : -1);
      if (Math.random() < 0.55) this._say(pick(['brumm!', 'wuiii!', 'oh!', 'iiep!']), 1100);
      await this._wait(rnd(1500, 2800));
    }

    // ---------- Beschäftigungen ----------

    // Höchstens alle 12–20 Minuten eine; die erste nach 2–6 Minuten. Bei Regen (Fernsehen) früher.
    _hobbyOk(wet) {
      const now = Date.now();
      this._hobbyNext ??= now + rnd(2, 6) * 60000;
      return now >= this._hobbyNext - (wet ? 8 * 60000 : 0);
    }

    _hobbyDone() {
      this._hobbyNext = Date.now() + rnd(12, 20) * 60000;
    }

    _hobbySpot() {
      const { fMin, fMax } = this._g;
      return rnd(fMin, fMax) * this._W;
    }

    // Drachenwetter: mäßiger bis frischer Wind, trocken, hell
    _kiteWind() {
      const e = this._dbgElev ?? this._elev;
      const w = this._wind || 0;
      return w >= 20 && w < 65 && !this._wx.wet && !this._wx.storm && (e == null || e > 3);
    }

    // Kleiner Ton über dem Kopf (Gameboy)
    _note(text) {
      const { pW, pH, gy } = this._g;
      const n = document.createElement('span');
      n.className = 'note';
      n.textContent = text;
      n.style.left = `${this._x + this._dir * pW * 0.2}px`;
      n.style.top = `${gy - pH * 0.75 - this._lift}px`;
      n.style.setProperty('--dx', `${this._dir * rnd(4, 14)}px`);
      this._el.fx.appendChild(n);
      setTimeout(() => n.remove(), 1400);
    }

    _pageFlip() {
      const b = this._el.bflip;
      b.classList.remove('go');
      b.getBoundingClientRect();
      b.classList.add('go');
    }

    // Lesen am Heuhaufen bzw. neben der Nische oder vor der Tür: Kopf wandert die Zeilen entlang, blättert um,
    // kichert. Nachmittags nickt er manchmal ein (Streicheln weckt ihn).
    async _read() {
      const { stand, home, pW } = this._g;
      await this._walkTo(Math.random() < 0.6 ? stand + pW * 0.16 : home + pW * 0.7, 0.8);
      this._face(1);
      const p = this._el.pika;
      p.classList.add('reading');
      this._hobbyDone();
      const h = new Date().getHours();
      const dozeNow = !!this._dbgDoze;
      this._dbgDoze = false;
      const sleepy = dozeNow || (h >= 13 && h < 17 && Math.random() < 0.35);
      const until = Date.now() + rnd(50000, 100000);
      let dozed = false;
      while (Date.now() < until) {
        await this._wait(rnd(2500, 5000));
        if (sleepy && !dozed && (dozeNow || Date.now() > until - 40000)) {
          dozed = true;
          p.classList.add('doze');
          const end = Date.now() + rnd(10000, 18000);
          while (Date.now() < end && p.classList.contains('doze')) await this._wait(500);
          if (p.classList.contains('doze')) {
            p.classList.remove('doze');
            this._jump('hop1');
            this._say('!', 900);
          }
          await this._wait(1200);
          continue;
        }
        const r = Math.random();
        if (r < 0.5) this._pageFlip();
        else if (r < 0.65) this._say(pick(['hihi', 'hihi!', 'oh!', 'hm…']), 1100);
        else if (r < 0.75) this._twitch();
      }
      await this._wait(600);
    }

    // Gameboy: Daumen tippen, Piepser steigen auf; nach jeder Runde Freudensprung oder hängende Ohren
    async _game() {
      await this._walkTo(this._hobbySpot(), 0.8);
      this._face(pick([-1, 1]));
      const p = this._el.pika;
      p.classList.add('gaming');
      this._hobbyDone();
      const rounds = 2 + Math.floor(rnd(0, 3));
      for (let i = 0; i < rounds; i++) {
        const end = Date.now() + rnd(8000, 18000);
        while (Date.now() < end) {
          await this._wait(rnd(900, 2600));
          this._note(pick(['♪', '♫', 'pi', 'pu', 'piu']));
        }
        if (Math.random() < 0.55) {
          this._jump('binky');
          this._say(pick(['Juhu!', 'Jaaa!']), 1200);
        } else {
          p.classList.add('meh');
          this._say(pick(['mööp', 'och…']), 1200);
          await this._wait(1600);
          p.classList.remove('meh');
        }
        await this._wait(1200);
      }
      await this._wait(400);
    }

    // Auf dem Bauch mit dem Tablet: wischt, kichert. Fliegt gerade ein echtes Flugzeug vorbei,
    // zeigt das Tablet die Flugkarte, und er schaut zum Himmel.
    async _tablet() {
      await this._walkTo(this._hobbySpot(), 0.8);
      this._face(pick([-1, 1]));
      const p = this._el.pika;
      p.classList.add('lying');
      await this._wait(400);
      p.classList.add('tablet');
      this._hobbyDone();
      const until = Date.now() + rnd(45000, 90000);
      while (Date.now() < until) {
        const plane = [...this._planes.values()].find((pl) => pl.show && !pl.gone);
        p.classList.toggle('tplane', !!plane);
        await this._wait(rnd(1800, 4000));
        const r = Math.random();
        if (plane && plane.show && r < 0.35) {
          this._face(plane.x >= this._x ? 1 : -1);
          p.classList.add('look-up');
          this._say(pick(['da!', 'oh!']), 1000);
          await this._wait(rnd(1800, 2800));
          p.classList.remove('look-up');
        } else if (r < 0.7) {
          p.classList.add('swipe');
          await this._wait(650);
          p.classList.remove('swipe');
        } else if (r < 0.82) {
          this._say(pick(['hihi', 'oh!', '♥']), 1000);
        }
      }
      p.classList.remove('tablet', 'tplane');
      await this._wait(300);
      p.classList.remove('lying');
      await this._wait(400);
    }

    // Drachen steigen lassen: der Drache steht im Wind (Windrichtung aus dem Wetter), schwankt und zerrt
    async _kite() {
      const { pW, pH, gy, fMin, fMax } = this._g;
      const W = this._W;
      const H = this._H;
      const kd = this._windDir || -1;
      await this._walkTo(clamp(W * (kd < 0 ? 0.64 : 0.38), fMin * W, fMax * W), 0.9);
      this._face(kd);
      const p = this._el.pika;
      p.classList.add('kiting');
      this._hobbyDone();
      // Pfote (viewBox 105/50) in px; der Drache steht schräg oben im Wind
      const px = this._x + kd * pW * (105 / 120 - 0.5);
      const py = gy - pH * 0.945 + pH * 0.5 - this._lift;
      const K = H * 0.12;
      const kx = clamp(px + kd * W * rnd(0.26, 0.38), K, W - K) - px;
      const ky = H * rnd(0.1, 0.17) - py;
      const el = document.createElement('div');
      el.className = 'kite';
      el.style.left = `${px.toFixed(1)}px`;
      el.style.top = `${py.toFixed(1)}px`;
      el.style.setProperty('--k0', `${kd * 60}deg`);
      el.style.setProperty('--kd', `${clamp(4.5 - (this._wind || 30) / 20, 1.6, 4).toFixed(2)}s`);
      el.innerHTML = KITE_SVG(kx, ky, K);
      this._kiteAway();
      this._kiteEl = el;
      this._el.kites.appendChild(el);
      void el.offsetWidth;
      el.classList.add('up');
      this._say(pick(['wuiii!', 'hoch!']), 1200);
      const until = Date.now() + rnd(40000, 80000);
      while (Date.now() < until && (this._forced || this._kiteWind())) {
        await this._wait(rnd(3000, 6000));
        const r = Math.random();
        if (r < 0.3) {
          el.classList.remove('tug');
          void el.offsetWidth;
          el.classList.add('tug');
        } else if (r < 0.5) {
          this._say(pick(['wuiii!', 'hihi', 'iiep!']), 1100);
        } else if (r < 0.6) {
          this._twitch();
        }
      }
      // einholen
      el.classList.remove('up');
      await this._wait(2800);
      this._kiteAway();
    }

    _kiteAway() {
      const el = this._kiteEl;
      if (!el) return;
      this._kiteEl = null;
      el.classList.add('gone');
      setTimeout(() => el.remove(), 700);
    }

    // Fernsehen im Bau: sitzt mit dem Rücken zu uns im Eingang, das Licht vom Fernseher flackert bunt
    async _tv() {
      const p = this._el.pika;
      if (!this._inside) await this._enterBurrow(this._wx.shelter ? 1.4 : 1);
      else if (this._poseName !== 'hidden') await this._to('hidden', 400);
      this._hobbyDone();
      this._tvOn(true);
      await this._wait(700);
      p.classList.add('tv');
      await this._to('tv', 700);
      const until = Date.now() + (this._wx.wet ? rnd(80000, 160000) : rnd(45000, 90000));
      while (Date.now() < until) {
        await this._wait(rnd(2500, 6000));
        // nach dem Streicheln wieder zum Fernseher drehen
        if (!p.classList.contains('tv')) {
          await this._wait(1200);
          p.classList.add('tv');
          await this._to('tv', 500);
          continue;
        }
        const r = Math.random();
        if (r < 0.25) {
          this._say(pick(['hihi', 'hihi!', 'ohh!', 'hihihi']), 1100);
        } else if (r < 0.45) {
          this._twitch();
        } else if (r < 0.57) {
          // dreht sich kurz um und schaut heraus
          p.classList.remove('tv');
          this._pose('peek', 400);
          await this._wait(500);
          if (Math.random() < 0.5) this._say(pick(['mip?', 'iiep!']), 900);
          await this._wait(rnd(1400, 2400));
          p.classList.add('tv');
          await this._to('tv', 500);
        } else if (r < 0.65) {
          this._jump('hop1');
          this._say('!', 800);
        }
      }
      this._tvOn(false);
      await this._wait(500);
      p.classList.remove('tv');
      await this._to('hidden', 500);
    }

    _tvOn(on) {
      if (!this._el) return;
      clearTimeout(this._tvT);
      this._el.scene.classList.toggle('tv-on', on);
      if (!on) return;
      // Farbe nur dort setzen, wo sie gebraucht wird (an der Szene würde sie den ganzen Baum neu berechnen)
      const next = () => {
        const c = pick(TV_COLORS);
        for (const el of [this._el.tvl, this._el.lights, this._el.pika]) el.style.setProperty('--tvc', c);
        this._tvT = setTimeout(next, rnd(600, 2600));
      };
      next();
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
      if (!this._inside) await this._enterBurrow(0.7);
      await this._wait(900);
      this._face(1);
      this._el.pika.classList.add('sleeping');
      this._pose('sleep', 1400);
      this._asleep = true;
      this._updateSky();
    }

    async _wakeUp() {
      this._asleep = false;
      const p = this._el.pika;
      if (this._inside) this._pose('peek', 900);
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
      // Auf dem Stein (weiter hinten) etwas kleiner, Ursprung sind die Füße
      p.style.transform = `translate(${(x - this._g.pW / 2).toFixed(1)}px, ${(-this._lift).toFixed(1)}px)`
        + (this._lift > 0 ? ' scale(.9)' : '');
      if (instant) void p.offsetWidth;
    }

    // Wo der Pika gerade wirklich steht. Beim Laufen ist this._x schon das Ziel, die CSS-Transition
    // bewegt ihn erst noch dorthin.
    _liveX() {
      const t = getComputedStyle(this._el.pika).transform;
      return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 + this._g.pW / 2 : this._x;
    }

    _liveLift() {
      const t = getComputedStyle(this._el.pika).transform;
      return t && t !== 'none' ? -new DOMMatrixReadOnly(t).m42 : this._lift;
    }

    _freeze() {
      const x = this._liveX();
      this._lift = Math.max(0, this._liveLift());
      this._setX(x, true);
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
      const { pW, pH, gy, hole } = this._g;
      let x = this._liveX() + this._dir * pW * 0.25;
      let y = gy - pH * 0.945 + pH * 0.25 - this._liveLift();
      if (this._inside) {
        x = hole.cx;
        y = hole.top + (hole.lip - hole.top) * 0.2;
      }
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
      this._tickSky();
      this._tickFest();
      this._tickFriend();
      this._tickBote();
    }

    _hiddenFeatures(hidden) {
      if (!hidden) this._readFlights(this._lastFlights); // unsichtbar wurden keine Flieger angelegt
      this._hiddenSky(hidden);
      this._hiddenFest(hidden);
      this._hiddenFriend(hidden);
      this._hiddenBote(hidden);
    }

    // ---------- Interaktion ----------

    _onPet() {
      this._add('g', GAIN.pet);
      this._petFriend();
      const p = this._el.pika;
      if (this._asleep) {
        p.classList.add('peek');
        clearTimeout(this._peekT);
        this._peekT = setTimeout(() => p.classList.remove('peek'), 1300);
        this._hearts(1);
        return;
      }
      this._happy();
      // Beim Fernsehen dreht er sich um, beim Lesen eingenickt wacht er auf
      if (p.classList.contains('tv')) p.classList.remove('tv');
      if (p.classList.contains('doze')) {
        p.classList.remove('doze');
        this._say('oh!', 900);
      }
      // Im Bau: kommt zum Streicheln an den Eingang
      if (this._inside) return this._pose('peek', 300);
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
      const color = pick(this._areal().flowers || FLOWER_COLORS);
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
      this._blooms = []; // eingesammelte Blüten auf dem Haufen: { color, sx, sy }
      try {
        const h = JSON.parse(localStorage.getItem('pika-pet-card-hay') || 'null');
        if (h) {
          const days = Math.floor((Date.now() - h.t) / 864e5);
          this._hay = clamp(h.n - days * 2, 1, 12);
          if (Array.isArray(h.b)) this._blooms = h.b.slice(-Math.min(this._hay, STASH_MAX));
        }
      } catch (e) { /* kein Speicher – egal */ }
      this._renderHay();
    }

    _addHay(color, spot) {
      this._hay = Math.min(12, this._hay + 1);
      if (color && spot) this._blooms = [...this._blooms, { color, ...spot }].slice(-STASH_MAX);
      this._renderHay(true);
      try {
        localStorage.setItem('pika-pet-card-hay', JSON.stringify({ n: this._hay, t: Date.now(), b: this._blooms }));
      } catch (e) { /* egal */ }
    }

    _renderHay(bounce) {
      const S = this._areal().stash;
      const sb = S && this._el.burrow.querySelector('.stashb');
      if (S) {
        if (!sb) return;
        // Heubett auf dem Nischenboden (wächst mit dem Vorrat), darauf die Blüten mit Stiel
        const F = this._areal().vh - this._areal().sink;
        const P = this._stashSlots();
        const n = this._blooms.length;
        const top = F - 2.2 - Math.max(Math.ceil(n / 5.5), this._hay / 3) * 1.7;
        const cx = (S.x1 + S.x2) / 2;
        const f = (v) => +v.toFixed(2);
        sb.innerHTML = `<path d="M${S.x1 + 0.8} ${F + 1} V${F - 1.4} Q${cx} ${f(top)} ${S.x2 - 0.8} ${F - 1.4} V${F + 1}Z"`
          + ' fill="#dcbc6a" stroke="#a9853a" stroke-width=".45"/>'
          + `<path d="M${S.x1 + 3} ${F - 1.2} l2.2 -1.4 M${cx - 2} ${F - 1} l2.6 -1.6 M${S.x2 - 6} ${F - 1.3} l2 -1.2"`
          + ' stroke="#b38c3c" stroke-width=".4" fill="none"/>'
          + this._blooms.map((b, i) => {
            const [x, y] = P[i];
            return `<g${bounce && i === n - 1 ? ' class="new"' : ''}>`
              + `<path d="M${f(x - 2.1)} ${f(y + 1.1)} Q${f(x - 1.1)} ${f(y + 0.3)} ${f(x)} ${f(y)}" stroke="#5e8f3e" stroke-width=".5" fill="none"/>`
              + `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="${b.color}" stroke="rgba(0,0,0,.22)" stroke-width=".25"/>`
              + `<circle cx="${f(x)}" cy="${f(y)}" r=".55" fill="#e0a032"/></g>`;
          }).join('');
        return;
      }
      const hay = this._el.hay;
      hay.style.setProperty('--hs', (0.4 + this._hay * 0.055).toFixed(3));
      hay.querySelector('.hayb').innerHTML = this._blooms.map((b) =>
        `<circle cx="${b.sx}" cy="${b.sy}" r="2.4" fill="${b.color}" stroke="rgba(0,0,0,.15)" stroke-width=".4"/>`
        + `<circle cx="${b.sx}" cy="${b.sy}" r=".9" fill="#e0a032" opacity=".8"/>`).join('');
      if (bounce) {
        hay.classList.remove('boing');
        void hay.offsetWidth;
        hay.classList.add('boing');
      }
    }

    // ---------- Besucher: Vögelchen und Maus ----------
    // Laufen neben der Pika-Schleife her und sind reine Zierde. Wann sie kommen, folgt aus der Uhrzeit (seedRnd),
    // darum sehen alle Geräte dieselben Besuche.


    // ==================== Festtage: Methoden ====================
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
      const now = new Date(this._festNow());
      // Mitternacht an Neujahr: Finale, und der Pika wacht auf und schaut aus dem Bau
      if (f.fireworks && now.getMonth() === 0 && now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 5
        && this._festMidY !== now.getFullYear()) {
        this._festMidY = now.getFullYear();
        this._festFinale();
        this._festForce('festFireworks');
      }
      if (document.hidden || !this._g) return;
      // Halloween-Nacht: ab und zu flattert eine Fledermaus über den Himmel
      if (f.witch && this._festDark() && Math.random() < 0.35) this._festBat();
      // Karneval: alle paar Minuten kurz Konfetti
      if (f.karneval) {
        const t = Date.now();
        this._festCfNext ??= t + rnd(5, 30) * 1000;
        if (t >= this._festCfNext) {
          this._festConfettiRain();
          this._festCfNext = t + rnd(2, 5) * 60000;
        }
      } else this._festCfNext = null;
      // Maibaum: Bänder drehen mit dem Wind
      const mai = this._festEls?.back.querySelector('.fmai');
      if (mai) mai.style.setProperty('--wd', this._windDir < 0 ? -1 : 1);
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

    _festNow() {
      return this._dbgDate ?? Date.now();
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

    // Aktive Feste am (Orts-)Datum. festive: false lässt nur die Geburtstage übrig.
    _festToday() {
      const now = new Date(this._festNow());
      const y = now.getFullYear();
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      const h = now.getHours();
      const hm = h * 60 + now.getMinutes();
      const md = mo * 100 + d;
      const day = festDay(y, mo, d);
      const f = { year: y };
      if (this._cfg?.festive !== false) {
        if (md >= 1024 && md <= 1031) f.halloween = true;
        if (md === 1031) f.witch = true;
        if (md === 1111) f.martin = { walk: h >= 16 };
        const adv = festAdvent1(y);
        if (day >= adv && md <= 1224) f.advent = { candles: Math.min(4, 1 + Math.floor((day - adv) / 7)) };
        if (day >= adv || md <= 106) f.lights = true; // Lichterkette vom 1. Advent bis Heilige Drei Könige
        if ((md === 1205 && h >= 18) || md === 1206) f.boot = { full: md === 1206 };
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
      // Geburtstage "MM-DD" (auch "YYYY-MM-DD" oder "TT.MM."); der 29. 2. wird sonst am 28. 2. gefeiert.
      // Ohne Anführungszeichen macht YAML daraus andere Typen: 14.10 → Zahl 14.1 (als TT.MM mit zwei Stellen
      // lesen), 1990-03-14 → Date-Objekt bzw. "1990-03-14T00:00:00.000Z" (Tag aus dem Datumsteil, UTC)
      const leap = new Date(y, 1, 29).getMonth() === 1;
      const names = (Array.isArray(this._cfg?.birthdays) ? this._cfg.birthdays : []).filter((b) => {
        const v = b?.date;
        const s = v instanceof Date ? (isNaN(v) ? '' : `${v.getUTCMonth() + 1}-${v.getUTCDate()}`)
          : typeof v === 'number' ? v.toFixed(2) : String(v ?? '').trim();
        let m = s.match(/^(?:\d{4}-)?(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/i);
        let bm;
        let bd;
        if (m) [bm, bd] = [Number(m[1]), Number(m[2])];
        else if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.?$/))) [bd, bm] = [Number(m[1]), Number(m[2])];
        else return false;
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
    // hinter dem Bau; Statusleiste links oben und Futterknopf rechts unten bleiben frei.
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
        + `width:${festF1(100 * bur.u)}px;height:${festF1(A.vh * bur.u)}px">${festSvg([100, A.vh], art.b, 'b')}`
        + `${art.g ? festSvg([100, A.vh], art.g, 'g') : ''}</div>`;
      const edge = FEST_EDGE[this._arealKey] || FEST_EDGE.huegel;

      // Boden-Deko auf einem Platz (prefs: Wunschreihenfolge)
      const ground = (cls, prefs, bottom, w, art, name) => {
        const [x, w2] = fit(slot(...prefs), w);
        front.push(item(cls, x, bottom, w2, art, name));
      };
      // Bodendeko zuerst auf die Wiese zwischen Heu bzw. Nische und Stein: vorn links stehen die Haus-Bote-Geräte
      // (an Weihnachten steht dort der Baum)
      const P = f.xmas ? ['R', 'L', 'M'] : ['M', 'R', 'L'];
      if (f.halloween) ground('fpump', P, gy + 1, H * 0.14, FEST_PUMPKIN, 'pumpkin');
      if (f.boot) ground('fboot', P, gy + 1, H * 0.11, FEST_BOOT(f.boot.full), 'boot');
      if (f.advent) ground('fwreath', P, gy, H * 0.2, FEST_WREATH(f.advent.candles), 'wreath');
      if (f.birthday) ground(`fcake${this._festCakeOut ? ' out' : ''}`, P, gy + 1, H * 0.14, FEST_CAKE, 'cake');
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
        used.add('M');
        const tw = (H * 0.42 * 50) / 66;
        back.push(item('ftree', slots.M.x, gy + 2, tw, FEST_TREE, 'tree'));
        // Geschenk vorn unter dem Baum, nicht vor dem Heu
        const gw = H * 0.1;
        front.push(item('fgift', Math.min(slots.M.x, Math.max(slots.M.x - tw * 0.32, hayR + gw / 2)), gy - 1, gw, FEST_GIFT, 'gift'));
      }
      if (f.maibaum) {
        // hinter dem Bau, die Krone unterhalb der Statusleiste
        const top = Math.max(44, H * 0.16);
        const mh = gy - top;
        const mw = mh / 4;
        const x = bur.l + 80 * bur.u;
        back.push(`<div class="fi fmai" style="left:${festF1(x - mw / 2)}px;top:${festF1(top)}px;width:${festF1(mw)}px;height:${festF1(mh)}px;`
          + `--wd:${this._windDir < 0 ? -1 : 1}">${festSvg(FEST_MAI.vb, FEST_MAI.b, 'b')}</div>`);
      }
      if (f.birthday || f.sommer) back.push(this._festString(f.birthday ? ['A', 'L', 'L', 'E', 'S', '♥', 'G', 'U', 'T', 'E'] : null));
      // Wiese für Eier und Raketenstäbe: rechts neben der Tür bis vor den Futterknopf, rechts von dem, was
      // schon neben der Tür steht (Kuchen an Ostern oder Neujahr)
      let lo = hole.r + H * 0.12;
      for (const p of Object.values(pos)) if (p.x < lo + H * 0.15) lo = Math.max(lo, p.l + p.w + H * 0.02);
      const hi = Math.max(lo + H * 0.3, Math.min(W - 64, rock.l + rock.w * 0.75));
      const eggX = [];
      if (f.ostern) {
        const n = 4 + Math.floor(seeded(f.year, 7) * 3);
        const seg = (hi - lo) / n;
        for (let i = 0; i < n; i++) {
          const r = (k) => seeded(f.year, i, k);
          const x = lo + seg * (i + 0.2 + 0.6 * r(1));
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
          const x = lo + (hi - lo) * (t + (seeded(f.year, 31, i) - 0.5) * 0.1);
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
        return { el, x: eggX[i] };
      });
      // Haus-Bote: Geräte weichen der Deko aus
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
      return `<div class="fi fwim" style="left:0;top:0;width:${W}px;height:${H}px">${festSvg([W, H], body, 'b')}</div>`;
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
      if (!sky || !this._g) return;
      const W = this._W;
      const H = this._H;
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
      const on = !!this._fest?.fireworks && this._attached && !document.hidden && !!this._g;
      if (on && !this._festFwT) {
        const go = () => {
          this._festRocket();
          this._festFwT = setTimeout(go, rnd(3000, 8000));
        };
        this._festFwT = setTimeout(go, rnd(400, 1500));
      } else if (!on && this._festFwT) {
        clearTimeout(this._festFwT);
        this._festFwT = null;
      }
    }

    _festFinale() {
      let t = 0;
      for (let i = 0; i < 14; i++) {
        t += rnd(250, 750);
        this._festLater(() => this._festRocket(), t);
      }
    }

    _festRocket() {
      const sky = this._festEls?.sky;
      if (!sky || !this._g || document.hidden) return;
      const W = this._W;
      const H = this._H;
      const x0 = rnd(0.3, 0.92) * W;
      const x1 = clamp(x0 + rnd(-0.06, 0.06) * W, 0.28 * W, 0.95 * W);
      const y0 = H * 0.62;
      const y1 = rnd(0.12, 0.36) * H;
      const r = document.createElement('i');
      r.className = 'fwr';
      r.style.left = `${festF1(x0)}px`;
      r.style.top = `${festF1(y0)}px`;
      sky.appendChild(r);
      const ang = (Math.atan2(x0 - x1, y0 - y1) * 180) / Math.PI;
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
      if (!sky) return;
      const H = this._H;
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
      const n = 14 + Math.floor(rnd(0, 6));
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
      for (let i = 0; i < 10; i++) {
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
    }

    _festConfettiRain() {
      const box = this._festEls?.cf;
      if (!box || !this._g || document.hidden) return;
      const { gy } = this._g;
      const W = this._W;
      const H = this._H;
      for (let i = 0; i < 46; i++) {
        const c = document.createElement('i');
        const w = H * rnd(0.014, 0.022);
        c.style.left = `${rnd(-2, 100).toFixed(1)}%`;
        c.style.width = `${festF1(w)}px`;
        c.style.height = `${festF1(w * (Math.random() < 0.3 ? 1 : rnd(1.5, 2.2)))}px`;
        c.style.borderRadius = Math.random() < 0.3 ? '50%' : '1px';
        c.style.background = pick(FEST_COLORS);
        box.appendChild(c);
        const dx = rnd(-0.06, 0.06) * W;
        const dur = rnd(2600, 4200);
        const delay = rnd(0, 1600);
        c.animate([
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
      this._festBang = () => this._festZuck();
      try {
        if (sleeping) {
          p.classList.remove('sleeping');
          await this._to('peek', 900);
          this._say('!', 900);
          await this._wait(900);
        } else {
          if (this._lift > 0) await this._hopDown();
          if (this._inside) await this._comeOut();
          await this._walkTo(this._g.home + this._g.pW * 0.8, 0.9);
          this._face(1);
        }
        p.classList.add('look-up');
        await this._wait(900);
        this._say('Frohes Neues!', 2400);
        const until = Date.now() + rnd(35000, 50000);
        let again = true;
        while (Date.now() < until && this._fest?.fireworks) {
          await this._wait(rnd(2500, 5000));
          const r = Math.random();
          if (r < 0.25) this._say(pick(['ohh!', 'wuiii!', 'oh!']), 1100);
          else if (r < 0.4 && again) {
            again = false;
            this._say('Frohes Neues!', 2200);
          } else if (r < 0.55 && !sleeping) this._face(-this._dir);
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
    // ==================== Ende Festtage ====================

    _startCritters() {
      if (!this._attached || document.hidden || this._critOn) return;
      this._critOn = true;
      const id = ++this._critId;
      // Start des letzten Besuchs je Art, über Neustarts hinweg (Display aus/an, Areal): kein Besuch kommt zweimal
      this._critLast ??= {};
      // je Art nur der eine Timer bis zum nächsten Start
      this._critT = {};
      // Timer bis zum nächsten berechneten Start; after: Start des letzten, damit keiner zweimal kommt
      const plan = (kind, after) => {
        const now = this._visitNow();
        const nx = this._critNext(kind, now, after);
        this._critT[kind] = setTimeout(async () => {
          if (id !== this._critId) return;
          this._critLast[kind] = nx.at;
          const late = this._visitNow() - nx.at;
          if (late <= CRIT_LATE) await this._visit(kind, id, false, nx.pick, Math.max(0, late));
          if (id === this._critId) plan(kind, nx.at);
        }, Math.max(0, nx.at - now));
      };
      plan('bird', this._critLast.bird);
      plan('mouse', this._critLast.mouse);
    }

    // Uhr der Besuche: echte Zeit (Vorschau: um _dbgShiftMs vorgestellt). Nicht _dbgDate, das steht fest.
    _visitNow() {
      return Date.now() + this._dbgShiftMs;
    }

    // Nächster Besuch von kind (bird, mouse), der höchstens CRIT_LATE her ist und nach after liegt:
    // { at: Startzeit, pick: feste Entscheidungen }. Gleiche Uhr → gleiches Ergebnis auf allen Geräten.
    _critNext(kind, now, after = -Infinity) {
      const { win, p, room } = CRIT[kind];
      for (let k = Math.floor(Math.max(now - CRIT_LATE, after + 1) / win); ; k++) {
        if (seedRnd(kind, k, 0) >= p) continue;
        const at = k * win + Math.floor(seedRnd(kind, k, 1) * (win - room));
        if (at < now - CRIT_LATE || at <= after) continue;
        return { at, pick: this._critPick(kind, (n) => seedRnd(kind, k, n)) };
      }
    }

    // Was beim Besuch feststeht; r(n) liefert Zahlen in [0, 1) (seedRnd fürs Fenster, Vorschau-Knöpfe: Math.random)
    _critPick(kind, r) {
      if (kind === 'bird') {
        return { bird: Math.floor(r(2) * BIRDS.length), spot: r(3), rockX: 35 + r(4) * 30,
          side: r(5) < 0.5 ? -1 : 1, out: r(6) < 0.5 ? -1 : 1, stay: 15000 + r(7) * 30000, alt: r(8) };
      }
      const k = r(2); // wie früher seitlich : oben : auf die Wiese = 3 : 2 : 3
      return { kind: k < 0.375 ? 'side' : k < 0.625 ? 'top' : 'run', x: 30 + r(3) * 40 };
    }

    _stopCritters() {
      this._critOn = false;
      this._critId++;
      Object.values(this._critT).forEach((t) => clearTimeout(t));
      this._critT = {};
      for (const c of [this._bird, this._mouse]) c?.el.remove();
      this._bird = this._mouse = null;
    }

    // Neue Größe oder neues Areal: wer gerade zu Besuch ist, kommt gleich wieder (falls sein Start höchstens
    // CRIT_LATE her ist); wer schon fertig war, nicht noch einmal
    _restartCritters() {
      if (this._critLast) {
        if (this._bird) delete this._critLast.bird;
        if (this._mouse) delete this._critLast.mouse;
      }
      this._stopCritters();
      this._startCritters();
    }

    // Vögel kommen nur bei Tag, beide nicht bei Regen oder Gewitter
    _critterWeather(kind) {
      if (!this._g || this._wx.wet || this._wx.storm) return false;
      if (kind === 'mouse') return true;
      const e = this._dbgElev ?? this._elev;
      return e == null ? !this._asleep : e > 3;
    }

    // pk: feste Entscheidungen aus _critNext (ohne: Zufall, Vorschau-Knöpfe); late: so viele ms nach dem Start
    async _visit(kind, id, force = false, pk = null, late = 0) {
      if (!this._g || (kind === 'bird' ? this._bird : this._mouse)) return;
      if (!force && !this._critterWeather(kind)) return;
      pk ??= this._critPick(kind, () => Math.random());
      try {
        await this[kind === 'bird' ? '_birdVisit' : '_mouseVisit'](id, force, pk, late);
      } catch (e) {
        if (!(e instanceof Cancel)) console.warn('pika-pet-card:', e);
      }
    }

    // Besucher-Objekt mit scare(): Antippen oder der Pika verscheucht ihn
    _critter(props) {
      const c = { ...props, scared: false };
      c.scaredP = new Promise((r) => (c.scare = () => ((c.scared = true), r())));
      return c;
    }

    // Warten; endet früher, wenn c verscheucht wird. Bricht ab, wenn die Besucher gestoppt wurden.
    async _cw(id, ms, c) {
      await (c ? Promise.race([pause(ms), c.scaredP]) : pause(ms));
      if (id !== this._critId) throw new Cancel();
    }

    // Pika schaut kurz hin, wenn er gerade nichts vorhat
    _noticeCritter(x, up) {
      if (this._asleep || this._inside || !['idle', 'look'].includes(this._action)) return;
      const p = this._el.pika;
      this._face(x >= this._x ? 1 : -1);
      const c = up ? 'look-up' : 'look-f';
      p.classList.remove('look-f', 'look-b', 'look-up');
      p.classList.add(c);
      clearTimeout(this._lookT);
      this._lookT = setTimeout(() => p.classList.remove(c), 1800);
    }

    // Vögelchen: fliegt im Bogen an, sitzt 15–45 s (Kopf schief, picken, hüpfen, zwitschern), fliegt weg
    async _birdVisit(id, force, pk, late = 0) {
      const { rock, bur } = this._g;
      const spots = this._areal().perches.map(([x, y], i) => ({ id: `p${i}`, x: bur.l + x * bur.u, y: bur.base + y * bur.u }));
      // Platz fest aus dem Seed: Sitzplätze des Areals, dahinter der Stein. Ist der Pika gerade oben, wartet der
      // Vogel kurz; ist der Stein dann noch besetzt, nimmt er den Ersatzplatz, ebenfalls aus dem Seed.
      const si = Math.floor(pk.spot * (spots.length + 1));
      const rockBusy = () => this._lift !== 0 || this._action === 'lookout';
      let waited = 0;
      if (si >= spots.length) {
        for (; waited < 6000 && rockBusy(); waited += 500) await this._cw(id, 500);
      }
      const spot = si < spots.length ? spots[si]
        : !rockBusy() ? { id: 'rock', x: rock.l + pk.rockX * rock.ku, y: rock.top0 + 13 * rock.ku }
          : spots[Math.floor(pk.alt * spots.length)];
      const v = BIRDS[pk.bird];
      const el = document.createElement('div');
      el.className = 'bird flying';
      el.innerHTML = `<div class="bw" role="button" aria-label="${v.name}"><div class="bf"><div class="bb">${BIRD_SVG(v)}</div></div></div>`;
      el.style.left = `${spot.x}px`;
      el.style.top = `${spot.y}px`;
      const b = this._critter({ el, perch: spot.id, x: spot.x, y: spot.y, sitting: false, dir: 1 });
      el.querySelector('.bw').addEventListener('click', (e) => (e.stopPropagation(), b.scare()));
      this._bird = b;
      this._el.birds.appendChild(el);
      try {
        // Anflug von schräg oben
        const side = pk.side;
        const dx = side * this._W * rnd(0.45, 0.7);
        const dy = -spot.y - this._H * 0.15;
        this._birdFace(b, -side);
        const dur = rnd(1500, 2100);
        const fly = el.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.3}px)`, offset: 0.5 },
          { transform: `translate(${dx * 0.1}px, ${-this._H * 0.07}px)`, offset: 0.85 },
          { transform: 'translate(0, 0)' },
        ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
        await this._cw(id, dur);
        fly.cancel();
        el.classList.remove('flying');
        el.classList.add('land');
        b.sitting = true;
        // zum Pika schauen
        if (Math.abs(this._x - spot.x) > 4) this._birdFace(b, this._x > spot.x ? 1 : -1);
        this._noticeCritter(spot.x, true);
        await this._cw(id, 350, b);
        el.classList.remove('land');
        const until = Date.now() + Math.max(4000, pk.stay - late - waited);
        while (!b.scared && Date.now() < until && (force || this._critterWeather('bird'))) {
          await this._cw(id, rnd(900, 2600), b);
          if (b.scared) break;
          const act = weighted([[3, 'tilt'], [3, 'peck'], [2, 'hop'], [2, 'tweet'], [1, 'fluff'], [2, 'turn']]);
          if (act === 'tweet') this._tweet(b);
          else if (act === 'turn') this._birdFace(b, -b.dir);
          else {
            const n = act === 'peck' ? 1 + Math.floor(rnd(0, 3)) : 1;
            for (let i = 0; i < n && !b.scared; i++) {
              el.classList.add(act);
              await this._cw(id, { tilt: rnd(800, 1600), peck: 460, hop: 340, fluff: 720 }[act], b);
              el.classList.remove(act);
              if (act === 'hop' && Math.random() < 0.4) this._birdFace(b, -b.dir);
              if (n > 1) await this._cw(id, 120, b);
            }
          }
        }
        // Abflug, erschrocken schneller
        b.sitting = false;
        el.classList.remove('tilt', 'peck', 'hop', 'fluff');
        el.classList.add('flying');
        const out = b.scared ? (this._x > spot.x ? -1 : 1) : pk.out;
        this._birdFace(b, out);
        const dur2 = b.scared ? 900 : rnd(1200, 1600);
        el.animate([
          { transform: 'translate(0, 0)' },
          { transform: `translate(${out * this._W * 0.08}px, ${-this._H * 0.08}px)`, offset: 0.25 },
          { transform: `translate(${out * this._W * 0.6}px, ${-spot.y - this._H * 0.2}px)` },
        ], { duration: dur2, easing: 'ease-in', fill: 'forwards' });
        await this._cw(id, dur2);
      } finally {
        if (this._bird === b) this._bird = null;
        el.remove();
      }
    }

    _birdFace(b, dir) {
      b.dir = dir;
      b.el.classList.toggle('left', dir < 0);
    }

    // ♪ steigt am Schnabel auf
    _tweet(b) {
      if (!b?.sitting) return;
      const bw = this._H * 0.1;
      for (let i = 0; i < (Math.random() < 0.4 ? 2 : 1); i++) {
        const n = document.createElement('span');
        n.className = 'note';
        n.textContent = pick(['♪', '♫', '♪']);
        n.style.left = `${b.x + b.dir * bw * 0.35}px`;
        n.style.top = `${b.y - bw * 0.95}px`;
        n.style.setProperty('--dx', `${b.dir * rnd(4, 14)}px`);
        n.style.animationDelay = `${i * 250}ms`;
        this._el.fx.appendChild(n);
        setTimeout(() => n.remove(), 1400 + i * 250);
      }
      b.el.classList.add('tilt');
      setTimeout(() => b.el.classList.remove('tilt'), 500);
    }

    // Maus: schaut seitlich oder oben hinter dem Aussichtsstein hervor, flitzt manchmal auf die Wiese
    async _mouseVisit(id, force, pk) {
      const { rock, gy, pW } = this._g;
      const mw = this._H * 0.13;
      const mh = mw * (18 / 32);
      const el = document.createElement('div');
      el.className = 'mouse';
      el.innerHTML = `<div class="mw" role="button" aria-label="Maus"><div class="mf"><div class="mb">${MOUSE_SVG}</div></div></div>`;
      const m = this._critter({ el, x: 0, y: 0, dir: 1, visible: false, out: false });
      el.querySelector('.mw').addEventListener('click', (e) => (e.stopPropagation(), m.scare()));
      this._mouse = m;
      this._el.mice.appendChild(el);

      const yG = gy - this._H * 0.022; // Laufweg knapp hinter dem Pika
      const edge = rock.l + 7 * rock.ku; // linke Steinkante
      const hideX = edge + mw * 0.75;
      const peekX = edge + mw * 0.1;
      const door = edge - mw * 0.6; // ganz neben dem Stein: hier wechselt sie zwischen hinterer und vorderer Ebene
      // Hinter dem Stein läuft sie in der Ebene hinter Bau und Stein, auf der Wiese vor den Blumen
      const layer = (front) => (front ? this._el.miceF : this._el.mice).appendChild(el);
      const topY = rock.top0 + 13.5 * rock.ku;
      const face = (d) => ((m.dir = d), el.classList.toggle('left', d < 0));
      const move = (x, y, ms = 0, ease = 'ease-out') => {
        el.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        m.x = x;
        m.y = y;
        if (!ms) void el.offsetWidth;
      };
      const liveX = () => {
        const t = getComputedStyle(el).transform;
        return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : m.x;
      };
      const pose = (c, on) => el.classList.toggle(c, on);
      // Warten; kommt der Pika zu nah, wird sie verscheucht
      const FLEE = {};
      const step = async (ms) => {
        await this._cw(id, ms, m);
        if (m.out && Math.abs(this._liveX() - m.x) < pW * 0.55) m.scare();
        if (m.scared) throw FLEE;
      };
      const run = async (x, speed = 1) => {
        face(x >= m.x ? 1 : -1);
        const ms = (Math.abs(x - m.x) / (this._H * 1.1 * speed)) * 1000;
        pose('run', true);
        move(x, yG, ms, 'linear');
        await step(ms);
        pose('run', false);
      };
      const lookAround = async (n) => {
        for (let i = 0; i < n; i++) {
          const r = Math.random();
          if (r < 0.35) {
            pose('sniff', true);
            await step(rnd(700, 1300));
            pose('sniff', false);
          } else if (r < 0.55) {
            pose('twitch', true);
            await step(450);
            pose('twitch', false);
          } else if (r < 0.75) {
            pose('look', true);
            await step(rnd(600, 1100));
            pose('look', false);
          } else {
            face(-m.dir);
            await step(rnd(400, 800));
          }
        }
      };
      const kind = pk.kind;
      try {
        try {
          if (kind === 'top') {
            // hinter der Steinkuppe hochkommen, nur Kopf und Ohren schauen heraus
            const x = rock.l + pk.x * rock.ku;
            face(this._x >= x ? 1 : -1);
            move(x, topY + mh * 1.1);
            await step(60);
            move(x, topY + mh * 0.2, 450);
            m.visible = true;
            await step(450);
            await lookAround(2 + Math.floor(rnd(0, 3)));
            m.visible = false;
            move(x, topY + mh * 1.1, 260, 'ease-in');
            await step(300);
          } else {
            face(-1);
            move(hideX, yG);
            await step(60);
            move(peekX, yG, 500);
            m.visible = true;
            await step(500);
            await lookAround(1 + Math.floor(rnd(0, 3)));
            if (kind === 'run') {
              // raus auf die Wiese, schnuppern, Männchen machen, zurück
              const minX = Math.max(this._g.fMin * this._W, mw);
              await run(door);
              layer(true);
              m.out = true;
              await run(rnd(minX, Math.max(minX, door - mw * 0.7)));
              this._noticeCritter(m.x, false);
              await lookAround(1);
              if (Math.random() < 0.6) {
                face(this._x >= m.x ? 1 : -1);
                pose('stand', true);
                await step(rnd(900, 1600));
                pose('stand', false);
              }
              await lookAround(1 + Math.floor(rnd(0, 2)));
              if (Math.random() < 0.4) await run(clamp(m.x + rnd(-1, 1) * mw * 2, minX, door), 0.8);
              await run(door);
              m.out = false;
              layer(false);
              await run(peekX);
              await step(rnd(300, 900));
            }
            m.visible = false;
            face(1);
            move(hideX, yG, 350);
            await step(400);
          }
        } catch (e) {
          if (e !== FLEE) throw e;
          // piep! und schnell zurück hinter den Stein
          const x = liveX();
          move(x, m.y);
          pose('run', false);
          pose('stand', false);
          m.out = m.visible = false;
          this._peep(x, m.y - mh * 1.2, 'piep!');
          if (kind === 'top') move(x, topY + mh * 1.1, 180, 'ease-in');
          else {
            face(1);
            pose('run', true);
            const dash = async (tx) => {
              const ms = (Math.abs(tx - m.x) / (this._H * 2)) * 1000;
              move(tx, yG, ms, 'linear');
              await this._cw(id, ms);
            };
            if (el.parentNode === this._el.miceF) {
              await dash(door);
              layer(false);
            }
            await dash(hideX);
          }
          await this._cw(id, 250);
        }
      } finally {
        if (this._mouse === m) this._mouse = null;
        el.remove();
      }
    }


    // ==================== Freund-Pika: Methoden ====================
    // Pino, ein Freund-Pika, kommt ein paarmal am Tag zu Besuch. Er lebt in der Ebene .friends hinter dem Pika
    // und hat einen eigenen Ablauf (_friendVisit: hereinhoppeln, Eigenleben, verabschieden, hinaus). Die
    // gemeinsamen Spiele sind Aktionen des Pikas (_friendActs); solange eine läuft (fr.busy), steuert sie Pino.
    // Wann er kommt, wie lange er bleibt und von welcher Seite, entscheidet allein _friendSchedule().

    _hassFriend(hass) {
      this._friendCheck();
    }

    _attachFriend() {
      this._loop(() => this._frBlink(), 2400, 6500);
      this._loop(() => this._frTwitch(), 4500, 12000);
      this._friendPlan();
    }

    _detachFriend() {
      this._friendStop();
    }

    // Tab unsichtbar: Pino ist sofort weg (wie die Besucher), danach wird neu geplant
    _hiddenFriend(hidden) {
      if (hidden) this._friendStop();
      else this._friendPlan();
    }

    _layoutFriend(first) {
      const g = this._g;
      if (!g) return;
      const s = this._el.friends.style;
      s.setProperty('--ph', `${g.pH * FRIEND_SCALE}px`);
      s.setProperty('--pw', `${g.pW * FRIEND_SCALE}px`);
      const ratio = this._frLW ? this._W / this._frLW : 1;
      this._frLW = this._W;
      const fr = this._fr;
      if (!fr) return;
      // Beim Herein- und Hinaushoppeln (oder neuem Areal) verschwindet er lieber und kommt später wieder
      if (first || !fr.arrived || fr.leaving) {
        this._friendGone(fr);
        this._friendPlan();
        return;
      }
      // Sonst wie der Pika an dieselbe Stelle der Wiese; ein gemeinsames Spiel fängt neu an
      if (fr.busy) this._interrupt();
      this._frTake(fr);
      this._friendSettle(fr);
      fr.lift = 0;
      fr.mv = null;
      const [lo, hi] = this._frRange();
      this._frSetX(fr, clamp(fr.x * ratio, lo, hi));
    }

    _tickFriend() {
      this._friendCheck();
    }

    _friendActs(ctx) {
      const bye = this._frBye;
      if (bye && !bye.done && Date.now() < bye.until) return [[80, 'byeFriend']];
      const fr = this._fr;
      if (!fr || !fr.arrived || fr.leaving) return [];
      if (!fr.greeted) return [[80, 'greetFriend']];
      // Zusammen zählen sie etwas mehr als alles andere, und die Spiele dauern länger: so verbringt
      // der Pika die meiste Zeit mit Pino, macht aber auch mal Eigenes
      const wet = ctx.wx.wet;
      return [
        [wet ? 1 : 7, 'chaseFriend'],
        [6, 'sitWithFriend'],
        [wet ? 1 : 4, 'rockWithFriend'],
        [ctx.hasFlowers ? (ctx.s < 50 ? 5 : 3.5) : 0, 'nibbleWithFriend'],
        [3.5, 'squeakDuet'],
      ];
    }

    // Der Pika wird gestreichelt: Pino kommt neugierig näher und schaut zu
    _petFriend() {
      const fr = this._fr;
      if (!fr || !fr.arrived || fr.leaving || this._asleep) return;
      if (fr.busy) {
        this._frFace(fr, this._liveX() >= fr.x ? 1 : -1);
        this._frLook(fr, 'look-f', 1500);
        return;
      }
      fr.want = 'curious';
      this._frTake(fr);
    }

    // ---------- Besuchsplan ----------

    // Die EINZIGE Stelle, die entscheidet, wann Pino kommt, wie lange er bleibt und von welcher Seite.
    // Liefert den nächsten Besuch, der noch nicht vorbei ist: nextInMs bis zur Ankunft (0, wenn er gerade
    // fällig ist), stayMs Dauer ab Ankunft (bei einem laufenden Besuch: was davon noch übrig ist), side -1 von
    // links, 1 von rechts. Aus der Uhrzeit berechnet (FRIEND_WIN, seedRnd), darum auf allen Geräten gleich.
    // Ob er wirklich kommt (Pika wach, Tag, trocken), prüft _friendDue; passt es gerade nicht, kommt er später
    // im selben Fenster. Ein Besuch, der mit Abschied endete, wird nicht wiederholt (_frUsed).
    _friendSchedule() {
      const now = this._visitNow();
      const { win, p, spread, stay: [s0, s1] } = FRIEND_WIN;
      // ein Besuch endet in seinem Fenster (spread + Dauer < win), das vorige Fenster prüfen schadet nicht
      for (let k = Math.floor(now / win) - 1; ; k++) {
        const r = (n) => seedRnd('friend', k, n);
        if (r(0) >= p) continue;
        const at = k * win + Math.floor(r(1) * spread);
        const end = at + Math.round((s0 + r(2) * (s1 - s0)) * 6e4);
        if (now >= end) continue;
        const start = Math.max(now, at);
        return { nextInMs: start - now, stayMs: end - start, side: r(3) < 0.5 ? -1 : 1 };
      }
    }

    _friendOn() {
      return !!this._cfg?.friend && !!this._attached && !document.hidden;
    }

    // Nächsten Besuch einplanen. Einer, der schon mit Abschied endete, zählt nicht noch einmal:
    // dann erst nach seinem Ende wieder nachfragen.
    _friendPlan() {
      clearTimeout(this._frT);
      this._frT = null;
      if (!this._friendOn() || this._fr) return;
      const now = this._visitNow();
      const s = this._friendSchedule();
      const end = now + s.nextInMs + s.stayMs;
      if (end <= (this._frUsed || 0) + 500) this._frT = setTimeout(() => this._friendPlan(), this._frUsed - now + 1000);
      else this._frT = setTimeout(() => this._friendDue(), s.nextInMs);
    }

    _friendDue() {
      this._frT = null;
      if (!this._friendOn() || this._fr) return;
      const s = this._friendSchedule();
      if (s.nextInMs > 1000) return this._friendPlan(); // Plan hat sich verschoben
      const end = this._visitNow() + s.nextInMs + s.stayMs;
      if (end <= (this._frUsed || 0) + 500) return this._friendPlan();
      // Für einen kurzen Rest lohnt sich das Hereinhoppeln nicht mehr: Fenster abhaken
      if (s.stayMs < 45000) {
        this._frUsed = end;
        return this._friendPlan();
      }
      if (this._g && !this._friendBad()) this._friendCome(s.side, s.stayMs);
      // Passt es gerade nicht (Pika wacht auf, kurzer Niesel, Tab war weg), in 20 s noch einmal: solange das
      // Fenster läuft, kommt er dann eben mitten darin
      else this._frT = setTimeout(() => this._friendDue(), 20000);
    }

    // Was gegen Besuch spricht (Bits): 1 Pika schläft oder geht schlafen, 2 Regen/Gewitter, 4 nicht Tag
    _friendBad() {
      const sleepy = this._asleep || this._sleepTime() || this._action === 'goSleep';
      const wx = this._wx;
      const e = this._dbgElev ?? this._elev;
      return (sleepy ? 1 : 0) | (wx.wet || wx.storm || wx.shelter ? 2 : 0) | ((e == null ? sleepy : e <= 3) ? 4 : 0);
    }

    // Bei jedem hass-Update und alle 20 s: abgeschaltet? Plan da? Muss Pino gehen?
    _friendCheck() {
      if (!this._cfg || !this._el) return;
      if (!this._cfg.friend) {
        if (this._fr || this._frT) this._friendStop();
        return;
      }
      if (!this._fr && !this._frT) this._friendPlan();
      const fr = this._fr;
      if (!fr) return;
      fr.el.classList.toggle('cold', !!this._wx.cold);
      if (fr.leaving) return;
      // nur, was sich seit der Ankunft verschlechtert hat (Vorschau: erzwungener Besuch bei jedem Wetter)
      const bad = this._friendBad() & ~fr.bad0;
      if (bad) this._friendLeave(true, !!(bad & 1));
    }

    _friendStop() {
      clearTimeout(this._frT);
      this._frT = null;
      if (this._fr) this._friendGone(this._fr);
    }

    _frName() {
      return String(this._cfg.friend_name || 'Pino');
    }

    // ---------- Besuch ----------

    // Pino kommt (force: sofort, bei jedem Wetter und jeder Tageszeit, für die Vorschau)
    _friendCome(side, stayMs, force = false) {
      if (!this._g || this._fr || !this._cfg?.friend) return;
      if (side == null || stayMs == null) {
        const s = this._friendSchedule();
        side ??= s.side;
        stayMs ??= Math.max(s.stayMs, 9e4);
      }
      clearTimeout(this._frT);
      this._frT = null;
      this._frBye = null;
      const fr = this._friendBuild();
      fr.side = side < 0 ? -1 : 1;
      fr.until = Date.now() + stayMs;
      fr.bad0 = force ? this._friendBad() : 0;
      this._fr = fr;
      this._friendVisit(fr);
    }

    _friendBuild() {
      const el = document.createElement('div');
      el.className = 'friend';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${this._frName()} streicheln`);
      el.innerHTML = '<div class="clipw"><div class="shadow"></div><div class="depth"><div class="flip"><div class="jump">'
        + `<div class="hop"><div class="br">${FRIEND_SVG}</div></div></div></div></div></div>`;
      el.querySelectorAll('.book, .gb, .tab, .kpaw, .bk, .brolly, .cap').forEach((n) => n.remove());
      // Sprechblase in eigener Hülle über dem Pika (z 4); sie läuft mit Pino mit (_frSetX, _frFace)
      const sw = document.createElement('div');
      sw.className = 'frsay';
      sw.innerHTML = '<div class="anchor"><div class="bubble say"></div></div>';
      const fr = {
        el, sw, jump: el.querySelector('.jump'), say: sw.querySelector('.say'), mfood: el.querySelector('.mfood'),
        x: 0, dir: 1, lift: 0, tok: 0, arrived: false, greeted: false, leaving: false, hurry: false, busy: false, want: null,
      };
      fr.kickP = new Promise((r) => (fr.kick = r));
      el.addEventListener('click', (e) => (e.stopPropagation(), this._frPet(fr)));
      el.classList.toggle('cold', !!this._wx.cold);
      this._el.friends.append(el, sw);
      return fr;
    }

    // Ohne Abschied entfernen (Tab unsichtbar, Größenänderung, abgeschaltet, Ende des Besuchs)
    _friendGone(fr) {
      if (this._fr === fr) this._fr = null;
      this._frTake(fr); // wartende Schritte wecken, sie brechen dann ab
      for (const t of ['sayT', 'callT', 'jumpT', 'happyT', 'lookT']) clearTimeout(fr[t]);
      fr.el.remove();
      fr.sw.remove();
      if (FRIEND_ACTS.has(this._action)) this._interrupt();
    }

    // Pinos Ablauf: herein, eigene kleine Schleife (pausiert, solange ein gemeinsames Spiel läuft), hinaus
    async _friendVisit(fr) {
      try {
        try {
          await this._friendArrive(fr);
        } catch (e) {
          if (e !== FRIEND_YIELD) throw e;
        }
        fr.arrived = true;
        this._frNotice();
        while (!fr.leaving) {
          if (fr.busy) {
            await this._fw(fr, 400);
            continue;
          }
          if (Date.now() >= fr.until) {
            this._friendLeave();
            break;
          }
          const tok = fr.tok;
          try {
            await this._friendIdle(fr, (ms) => this._fw(fr, ms, tok));
          } catch (e) {
            if (e !== FRIEND_YIELD) throw e;
          }
          if (!fr.busy) this._friendSettle(fr);
          await this._fw(fr, rnd(150, 400));
        }
        // ein laufendes Spiel wird beim Gehen abgebrochen
        while (fr.busy) await this._fw(fr, 200);
        await this._friendExit(fr);
      } catch (e) {
        if (!(e instanceof Cancel) && e !== FRIEND_YIELD) console.warn('pika-pet-card:', e);
      } finally {
        if (this._fr === fr) {
          this._friendGone(fr);
          this._friendPlan();
        }
      }
    }

    // Vom Rand herein hoppeln, piepsen
    async _friendArrive(fr) {
      const W = this._W;
      const fW = this._g.pW * FRIEND_SCALE;
      const [lo, hi] = this._frRange();
      const w = (ms) => this._fw(fr, ms, fr.tok);
      this._frFace(fr, -fr.side);
      this._frSetX(fr, fr.side < 0 ? -fW * 0.7 : W + fW * 0.7);
      const tx = clamp(W * (fr.side < 0 ? rnd(0.3, 0.42) : rnd(0.6, 0.75)), lo, hi);
      await this._friendWalkTo(fr, tx, 0.9, w, true);
      this._frFace(fr, this._x >= fr.x ? 1 : -1);
      fr.arrived = true;
      this._frCall(fr, pick(['iiep!', 'mip!', 'iiiep!']));
      await w(800);
    }

    // Der Pika bemerkt ihn: aus Nebensächlichem herausholen, dann wählt _step die Begrüßung
    _frNotice() {
      if (this._asleep || this._inside || this._lift > 0) return;
      if (['idle', 'look', 'wander', 'groom', 'binky', 'sniff'].includes(this._action)) this._interrupt();
    }

    // Pino verabschiedet sich. now: gleich (Pika geht schlafen, Wetter schlägt um, Vorschau-Knopf).
    // sleep: der Pika geht schlafen und schaut ihm nicht nach.
    _friendLeave(now = false, sleep = false) {
      const fr = this._fr;
      if (!fr || fr.leaving) return;
      fr.leaving = true;
      fr.hurry = now;
      // nach dem Abschied kommt er in diesem Fenster nicht wieder (auch nicht nach Display aus/an)
      const s = this._friendSchedule();
      if (!s.nextInMs) this._frUsed = Math.max(this._frUsed || 0, this._visitNow() + s.stayMs);
      this._frTake(fr);
      if (!sleep && !this._asleep) {
        this._frBye = { x: fr.x, until: Date.now() + 15000, done: false };
        if (FRIEND_ACTS.has(this._action) || ['idle', 'look', 'wander', 'groom'].includes(this._action)) this._interrupt();
      } else if (FRIEND_ACTS.has(this._action)) {
        this._interrupt();
      }
    }

    // "tschüss!", dann zum nächsten Rand hinaus
    async _friendExit(fr) {
      const w = (ms) => this._fw(fr, ms);
      this._friendSettle(fr);
      if (fr.lift > 0) await this._frHopDown(fr, w);
      const fW = this._g.pW * FRIEND_SCALE;
      const out = fr.x < this._W / 2 ? -1 : 1;
      this._frFace(fr, this._liveX() >= fr.x ? 1 : -1);
      this._frSay(fr, 'tschüss!', 1600);
      if (!fr.hurry) this._frJump(fr, 'hop1');
      await w(fr.hurry ? 900 : 1500);
      if (this._frBye) this._frBye.x = out < 0 ? 0 : this._W;
      await this._friendWalkTo(fr, out < 0 ? -fW : this._W + fW, fr.hurry ? 1.8 : 1.1, w, true);
    }

    // Eigenleben, ein Schritt: hoppeln, umschauen, putzen, piepsen, zum Pika, sitzen
    async _friendIdle(fr, w) {
      const { pW } = this._g;
      const F = fr.el.classList;
      if (fr.lift > 0) return this._frHopDown(fr, w);
      const toPika = () => (this._x >= fr.x ? 1 : -1);
      if (fr.want === 'curious') {
        // der Pika wird gestreichelt: neugierig näher und zuschauen
        fr.want = null;
        const d = Math.abs(this._x - fr.x);
        if (d > pW * 1.3 || d < pW * 0.6) await this._friendWalkTo(fr, this._x - toPika() * pW * rnd(0.85, 1.1), 1.2, w);
        this._frFace(fr, toPika());
        F.add('look-f');
        if (Math.random() < 0.5) this._frSay(fr, pick(['mip?', '♥', 'oh!']), 1000);
        await w(rnd(1500, 2500));
        F.remove('look-f');
        return;
      }
      const far = Math.abs(this._x - fr.x) > this._W * 0.35;
      const act = weighted([
        [fr.greeted ? 3 : 0.5, 'hop'],
        [2, 'look'],
        [fr.greeted ? 1.5 : 0.4, 'groom'],
        [1, 'squeak'],
        [fr.greeted ? 0.5 : 0, 'binky'],
        [!fr.greeted || far ? 3 : 0.8, 'toPika'],
        [2, 'sit'],
      ]);
      if (act === 'hop') {
        await this._friendWalkTo(fr, fr.x + rnd(0.5, 1.5) * pW * pick([-1, 1]), 0.9, w);
        await w(rnd(300, 900));
      } else if (act === 'look') {
        const n = 1 + Math.floor(rnd(0, 3));
        for (let i = 0; i < n; i++) {
          const c = pick(['look-f', 'look-b', 'look-up']);
          F.add(c);
          await w(rnd(700, 1700));
          F.remove(c);
          await w(rnd(200, 600));
        }
      } else if (act === 'groom') {
        F.add('groom');
        await w(rnd(1500, 2800));
        F.remove('groom');
      } else if (act === 'squeak') {
        this._frCall(fr, pick(['mip!', 'iiep!', 'pip!']));
        await w(1300);
      } else if (act === 'binky') {
        this._frJump(fr, 'binky');
        await w(1100);
      } else if (act === 'toPika') {
        // Abstand halten, hinschauen
        await this._friendWalkTo(fr, this._x - toPika() * pW * rnd(0.9, 1.4), 1, w);
        this._frFace(fr, toPika());
        F.add('look-f');
        await w(rnd(1000, 2200));
        F.remove('look-f');
      } else {
        if (Math.random() < 0.5) this._frFace(fr, toPika());
        await w(rnd(1500, 4000));
      }
    }

    // Warten in Pinos eigenem Ablauf: endet früher, wenn ihm jemand die Kontrolle abnimmt (tok) oder er
    // gehen soll (FRIEND_YIELD); bricht ab (Cancel), wenn er verschwunden ist.
    async _fw(fr, ms, tok) {
      const check = () => {
        if (this._fr !== fr) throw new Cancel();
        if (tok != null && (tok !== fr.tok || fr.leaving)) throw FRIEND_YIELD;
      };
      check();
      await Promise.race([pause(ms), fr.kickP]);
      check();
    }

    // Kontrolle übernehmen: Pinos laufender eigener Schritt endet
    _frTake(fr) {
      fr.tok++;
      const k = fr.kick;
      fr.kickP = new Promise((r) => (fr.kick = r));
      k();
    }

    // Gemeinsames Spiel: Pino gehört solange der Aktion des Pikas. w(ms) wartet wie _wait und bricht ab,
    // wenn Pino weg ist oder gehen will.
    async _withFriend(fn) {
      let fr = this._fr;
      for (let i = 0; fr && !fr.arrived && i < 40; i++) {
        await this._wait(200);
        fr = this._fr;
      }
      if (!fr || !fr.arrived || fr.leaving) return;
      fr.busy = true;
      this._frTake(fr);
      this._friendSettle(fr);
      const w = async (ms) => {
        await this._wait(ms);
        if (this._fr !== fr || fr.leaving) throw new Cancel();
      };
      try {
        if (fr.lift > 0) await this._frHopDown(fr, w);
        await fn(fr, w);
      } finally {
        this._el.pika.classList.remove('nuzzle', 'wiggle');
        if (this._fr === fr) {
          fr.busy = false;
          this._friendSettle(fr);
        }
      }
    }

    // ---------- Pinos Bausteine ----------

    // Pinos Wiese: rechts vom Bau bis zum rechten Rand (in den Bau darf er nicht). Auf schmalen Karten auch
    // rechts vom Heu (volle Größe, halbe Breite H · 0,13), sonst verschwände er dahinter (.fore liegt vorn).
    // Die Nische gehört zum Bau und liegt hinten, vor ihr darf er stehen.
    _frRange() {
      const { pW, home, hay, stash } = this._g;
      const lo = Math.max(home + pW * 0.8, stash ? 0 : hay + this._H * 0.13 + pW * FRIEND_SCALE * 0.3);
      return [lo, Math.max(lo, this._W - pW * FRIEND_SCALE * 0.45)];
    }

    // free: ohne Begrenzung auf die Wiese (herein- und hinaushoppeln)
    async _friendWalkTo(fr, x, speed = 1, w, free = false) {
      const { pW } = this._g;
      if (!free) {
        const [lo, hi] = this._frRange();
        x = clamp(x, lo, hi);
      }
      const dx = x - fr.x;
      if (Math.abs(dx) < 4) return;
      this._frFace(fr, dx > 0 ? 1 : -1);
      const dur = Math.abs(dx) / (pW * 0.85 * speed);
      this._frSetX(fr, x, dur * 1000);
      fr.el.classList.add('walking');
      await w(dur * 1000);
      fr.el.classList.remove('walking');
    }

    async _frHop(fr, x, lift, w) {
      if (Math.abs(x - fr.x) > 2) this._frFace(fr, x > fr.x ? 1 : -1);
      fr.el.classList.add('crouch');
      await w(180);
      fr.el.classList.remove('crouch');
      this._frSetX(fr, x, 550, 'cubic-bezier(.3, .6, .4, 1)', lift);
      this._frJump(fr, 'hop1');
      await w(620);
    }

    async _frHopDown(fr, w) {
      const { rock, pW, gy } = this._g;
      const side = fr.x >= rock.cx && this._footX(1) ? 1 : -1;
      await this._frHop(fr, rock.cx + side * (rock.w / 2 + pW * 0.1), 0, w);
      this._puff(fr.x, gy, 2);
    }

    // Pino nach x (und Höhe lift) bewegen, ms = Dauer der Überblendung (0 = sofort). Die Bewegung wird
    // mitgeschrieben, damit _frLive weiß, wo er gerade ist – auch wenn der Browser gerade nichts zeichnet.
    _frSetX(fr, x, ms = 0, ease = 'linear', lift = fr.lift) {
      const from = this._frLive(fr);
      fr.x = x;
      fr.lift = lift;
      fr.mv = ms > 0 ? { ...from, x1: x, l1: lift, t0: performance.now(), ms } : null;
      for (const s of [fr.el.style, fr.sw.style]) {
        s.transition = ms > 0 ? `transform ${Math.round(ms)}ms ${ease}` : 'none';
        s.transform = `translate(${(x - (this._g.pW * FRIEND_SCALE) / 2).toFixed(1)}px, ${(-lift).toFixed(1)}px)`;
      }
      if (!(ms > 0)) void fr.el.offsetWidth;
    }

    // Wo Pino gerade wirklich steht (beim Hoppeln ist fr.x schon das Ziel)
    _frLive(fr) {
      const m = fr.mv;
      if (!m) return { x: fr.x, lift: fr.lift };
      const k = clamp((performance.now() - m.t0) / m.ms, 0, 1);
      return { x: m.x + (m.x1 - m.x) * k, lift: m.lift + (m.l1 - m.lift) * k };
    }

    // Anhalten, wo er gerade ist, Haltungen zurücksetzen
    _friendSettle(fr) {
      const live = this._frLive(fr);
      this._frSetX(fr, live.x, 0, 'linear', live.lift < 1 ? 0 : live.lift);
      fr.el.classList.remove(...FRIEND_CLS);
      fr.mfood?.classList.remove('shrink');
    }

    _frFace(fr, dir) {
      fr.dir = dir;
      fr.el.classList.toggle('left', dir < 0);
      fr.sw.classList.toggle('left', dir < 0);
    }

    _frJump(fr, kind) {
      const j = fr.jump;
      j.classList.remove('hop1', 'binky');
      void j.offsetWidth;
      j.classList.add(kind);
      clearTimeout(fr.jumpT);
      fr.jumpT = setTimeout(() => j.classList.remove(kind), 1000);
    }

    _frSay(fr, text, ms = 1400) {
      fr.say.textContent = text;
      this._bubble(fr.say, true);
      clearTimeout(fr.sayT);
      fr.sayT = setTimeout(() => this._bubble(fr.say, false), ms);
    }

    // Piepsen: aufrichten, Maul auf, kleiner Hüpfer
    _frCall(fr, text) {
      const c = fr.el.classList;
      c.remove('calling');
      void fr.el.offsetWidth;
      c.add('calling');
      this._frSay(fr, text, 900);
      this._frJump(fr, 'hop1');
      clearTimeout(fr.callT);
      fr.callT = setTimeout(() => c.remove('calling'), 650);
    }

    _frLook(fr, c, ms) {
      fr.el.classList.add(c);
      clearTimeout(fr.lookT);
      fr.lookT = setTimeout(() => fr.el.classList.remove(c), ms);
    }

    _frHappy(fr, ms = 1200) {
      fr.el.classList.add('happy');
      clearTimeout(fr.happyT);
      fr.happyT = setTimeout(() => fr.el.classList.remove('happy'), ms);
      this._frHearts(fr, 3);
    }

    _frHearts(fr, n) {
      const { pW, pH, gy } = this._g;
      const fW = pW * FRIEND_SCALE;
      const fH = pH * FRIEND_SCALE;
      const live = this._frLive(fr);
      const x = live.x + fr.dir * fW * 0.25;
      const y = gy - fH * 0.945 + fH * 0.25 - live.lift;
      for (let i = 0; i < n; i++) {
        const h = document.createElement('span');
        h.className = 'heart';
        h.innerHTML = ICON_HEART;
        h.style.setProperty('--ph', `${fH}px`);
        h.style.left = `${x + rnd(-fW * 0.12, fW * 0.12)}px`;
        h.style.top = `${y}px`;
        h.style.setProperty('--dx', `${rnd(-fW * 0.3, fW * 0.3)}px`);
        h.style.animationDelay = `${i * 110}ms`;
        this._el.fx.appendChild(h);
        setTimeout(() => h.remove(), 1700 + i * 110);
      }
    }

    // Knabbern ohne die Blume zu nehmen; endet mit _frEatEnd
    _frEat(fr, color, ms) {
      const m = fr.mfood;
      fr.el.style.setProperty('--mf', color);
      fr.el.style.setProperty('--eat', `${Math.round(ms)}ms`);
      m.classList.remove('shrink');
      void m.getBoundingClientRect();
      m.classList.add('shrink');
      fr.el.classList.add('eating');
    }

    _frEatEnd(fr) {
      fr.el.classList.remove('eating');
      fr.mfood.classList.remove('shrink');
    }

    _frBlink() {
      const fr = this._fr;
      if (!fr) return;
      const c = fr.el.classList;
      c.add('blink');
      setTimeout(() => c.remove('blink'), 140);
      if (Math.random() < 0.25) {
        setTimeout(() => c.add('blink'), 280);
        setTimeout(() => c.remove('blink'), 420);
      }
    }

    _frTwitch() {
      const fr = this._fr;
      if (!fr) return;
      const t = pick(['twitch-l', 'twitch-r']);
      fr.el.classList.add(t);
      setTimeout(() => fr.el.classList.remove(t), 550);
    }

    // Pino antippen: Herzen, Freudensprung, kurzer Piep (die Werte des Pikas bleiben, wie sie sind)
    _frPet(fr) {
      if (this._fr !== fr) return;
      this._frHappy(fr);
      this._frJump(fr, Math.random() < 0.3 ? 'binky' : 'hop1');
      this._frSay(fr, pick(['mip!', 'iiep!', '♥', 'pip!']), 1000);
    }

    // ---------- Gemeinsame Spiele (Aktionen des Pikas) ----------

    // Der Pika hoppelt zu Pino, bis sie Nase an Nase stehen. Ist auf seiner Seite kein Platz, rückt Pino.
    async _frMeet(fr, w, speed = 1) {
      const { pW } = this._g;
      const gap = pW * 0.5;
      const d = fr.x >= this._x ? 1 : -1; // Pino liegt in Richtung d
      const min = pW * 0.45;
      const max = this._W - pW * 0.45;
      const tx = fr.x - d * gap;
      if (tx < min || tx > max) {
        const cx = clamp(tx, min, max);
        await Promise.all([this._walkTo(cx, speed), this._friendWalkTo(fr, cx + d * gap, speed, w, true)]);
      } else {
        await this._walkTo(tx, speed);
      }
      this._face(d);
      this._frFace(fr, -d);
    }

    // Nasenstupsen: beide lehnen sich kurz zueinander, Augen zu, Herzen
    async _frNuzzle(fr, w) {
      const P = this._el.pika.classList;
      const F = fr.el.classList;
      P.remove('nuzzle');
      F.remove('nuzzle');
      void fr.el.offsetWidth;
      P.add('nuzzle');
      F.add('nuzzle');
      await w(320);
      P.add('happy');
      F.add('happy');
      this._hearts(2);
      this._frHearts(fr, 2);
      await w(650);
      P.remove('nuzzle', 'happy');
      F.remove('nuzzle', 'happy');
    }

    // Begrüßung: hinschauen, "Pino!", hinhoppeln, Nasenstupsen
    async _greetFriend() {
      await this._withFriend(async (fr, w) => {
        const P = this._el.pika.classList;
        this._face(fr.x >= this._x ? 1 : -1);
        P.add('look-f');
        this._say(`${this._frName()}!`, 1600);
        this._jump('hop1');
        this._frFace(fr, this._x >= fr.x ? 1 : -1);
        await w(900);
        P.remove('look-f');
        this._frCall(fr, pick(['mip!', 'iiep!']));
        await w(600);
        await this._frMeet(fr, w, 1.3);
        await w(200);
        await this._frNuzzle(fr, w);
        fr.greeted = true;
        await w(rnd(500, 900));
        if (Math.random() < 0.6) {
          this._jump('binky');
          this._frJump(fr, 'hop1');
          await w(1100);
        }
      });
    }

    // Fangen: abwechselnd hoppelt einer davon, der andere hinterher, mit Staubwölkchen
    async _chaseFriend() {
      await this._withFriend(async (fr, w) => {
        const { pW, gy } = this._g;
        const [lo, hi] = this._frRange();
        const mid = (lo + hi) / 2;
        this._frFace(fr, this._x >= fr.x ? 1 : -1);
        this._frSay(fr, 'fang mich!', 1400);
        this._frJump(fr, 'hop1');
        await w(800);
        const pino = (x, speed, delay) => (async () => {
          if (delay) await w(delay);
          await this._friendWalkTo(fr, x, speed, w, true);
        })();
        const pika = (x, speed, delay) => (async () => {
          if (delay) await w(delay);
          await this._walkTo(x, speed);
        })();
        const rounds = 3 + Math.floor(rnd(0, 3));
        for (let i = 0; i < rounds; i++) {
          const pinoRuns = i % 2 === 0;
          const rx = pinoRuns ? fr.x : this._x;
          const cx = pinoRuns ? this._x : fr.x;
          // weg vom Fänger; steht der Läufer schon dort, rennt er an ihm vorbei auf die andere Seite
          let far = cx < mid;
          if (Math.abs((far ? hi : lo) - rx) < pW) far = !far;
          const T = far ? rnd(mid + (hi - mid) * 0.4, hi) : rnd(lo, mid - (mid - lo) * 0.4);
          const d = T > rx ? 1 : -1;
          const C = clamp(T - d * pW * 0.7, lo, hi);
          const speed = rnd(1.9, 2.4);
          this._puff(fr.x, gy, 2);
          this._puff(this._x, gy, 2);
          await Promise.all(pinoRuns ? [pino(T, speed, 0), pika(C, speed, 280)] : [pika(T, speed, 0), pino(C, speed, 280)]);
          this._puff(T, gy, 2);
          // eingeholt: umdrehen, kichern, Rollen tauschen
          if (pinoRuns) {
            this._frFace(fr, -d);
            this._frSay(fr, pick(['hihi!', 'iiep!', 'du!']), 900);
            this._jump('hop1');
          } else {
            this._face(-d);
            this._say(pick(['hihi!', 'iiep!', 'du!']), 900);
            this._frJump(fr, 'hop1');
          }
          await w(rnd(450, 800));
        }
        // außer Atem und glücklich
        this._face(fr.x >= this._x ? 1 : -1);
        this._frFace(fr, this._x >= fr.x ? 1 : -1);
        this._jump('binky');
        this._frJump(fr, 'binky');
        this._hearts(2);
        this._frHearts(fr, 2);
        await w(1100);
        this._say('puh!', 1100);
        await w(rnd(900, 1500));
      });
    }

    // Zusammen sitzen: nebeneinander, beide schauen in dieselbe Richtung, Ohrenwackeln, einer putzt den anderen
    async _sitWithFriend() {
      await this._withFriend(async (fr, w) => {
        const { pW } = this._g;
        const D = fr.x < this._W / 2 ? 1 : -1; // beide schauen zur Mitte
        let px = fr.x - D * pW * 0.8;
        if (px < pW * 0.45 || px > this._W - pW * 0.45) px = fr.x + D * pW * 0.8;
        await this._walkTo(px, 0.9);
        this._face(D);
        this._frFace(fr, D);
        const P = this._el.pika.classList;
        const F = fr.el.classList;
        await w(rnd(500, 900));
        const until = Date.now() + rnd(10000, 17000);
        let groomed = false;
        while (Date.now() < until) {
          const r = Math.random();
          if (r < 0.28) {
            P.add('wiggle');
            await w(220);
            F.add('wiggle');
            await w(1400);
            P.remove('wiggle');
            F.remove('wiggle');
          } else if (r < 0.48) {
            P.add('look-up');
            F.add('look-up');
            await w(rnd(1500, 2500));
            P.remove('look-up');
            F.remove('look-up');
          } else if (r < 0.7 && !groomed) {
            groomed = true;
            await this._frGroomEach(fr, w, Math.random() < 0.5, D);
          } else if (r < 0.8) {
            if (Math.random() < 0.5) this._say(pick(['hach…', '♥']), 1200);
            else this._frSay(fr, pick(['hach…', '♥', 'mip']), 1200);
            await w(1200);
          } else {
            if (Math.random() < 0.5) this._twitch();
            else this._frTwitch();
            await w(rnd(900, 1800));
          }
          await w(rnd(400, 900));
        }
      });
    }

    // Einer putzt den anderen: dreht sich hin, rückt heran, Pfoten reiben; der andere schließt die Augen
    async _frGroomEach(fr, w, pikaGrooms, D) {
      const { pW } = this._g;
      const P = this._el.pika;
      const F = fr.el;
      const d = fr.x >= this._x ? 1 : -1; // vom Pika zu Pino
      const lean = pW * 0.22;
      if (pikaGrooms) {
        this._face(d);
        P.style.transition = 'transform .35s ease-out';
        this._setX(this._x + d * lean);
        await w(380);
        P.classList.add('groom');
        F.classList.add('happy');
        await w(rnd(1600, 2300));
        P.classList.remove('groom');
        F.classList.remove('happy');
        this._frHearts(fr, 1);
        P.style.transition = 'transform .35s ease-out';
        this._setX(this._x - d * lean);
        await w(400);
        this._face(D);
      } else {
        this._frFace(fr, -d);
        this._frSetX(fr, fr.x - d * lean, 350, 'ease-out');
        await w(380);
        F.classList.add('groom');
        P.classList.add('happy');
        await w(rnd(1600, 2300));
        F.classList.remove('groom');
        P.classList.remove('happy');
        this._hearts(1);
        this._frSetX(fr, fr.x + d * lean, 350, 'ease-out');
        await w(400);
        this._frFace(fr, D);
      }
    }

    // Aussichtsstein: der Pika springt hinauf und pfeift, Pino schaut von unten hoch und piepst zurück –
    // oder hüpft hinterher und setzt sich hinter ihn (er ist kleiner)
    async _rockWithFriend() {
      await this._withFriend(async (fr, w) => {
        const { rock, pW, gy } = this._g;
        const [lo, hi] = this._frRange();
        const right = this._x > rock.cx && this._footX(1) != null;
        const foot = right ? this._footX(1) : this._footX(-1);
        const px = clamp(foot + (right ? 1 : -1) * pW * 0.55, lo, hi);
        await Promise.all([this._walkTo(foot), this._friendWalkTo(fr, px, 1.1, w)]);
        await w(rnd(200, 500));
        if (this._bird?.perch === 'rock') {
          this._bird.scare();
          await w(600);
        }
        await this._hopTo(rock.cx, rock.lift);
        this._puff(rock.cx, gy - rock.lift, 2);
        const F = fr.el.classList;
        const both = Math.random() < 0.45;
        await w(rnd(300, 600));
        if (both) {
          this._frSay(fr, 'ich auch!', 1100);
          await w(700);
          await this._frHop(fr, rock.cx - this._dir * pW * 0.32, rock.lift, w);
          this._frFace(fr, this._dir);
          this._puff(fr.x, gy - rock.lift, 1);
          await w(rnd(400, 800));
        } else {
          this._frFace(fr, rock.cx >= fr.x ? 1 : -1);
          F.add('look-up');
        }
        const n = 2 + Math.floor(rnd(0, 2));
        for (let i = 0; i < n; i++) {
          await this._call();
          await w(rnd(300, 600));
          F.remove('look-up');
          this._frCall(fr, pick(['mip!', 'iiep!', 'pip!']));
          await w(800);
          if (!both) {
            F.add('look-up');
            if (Math.random() < 0.5) this._face(fr.x >= this._x ? 1 : -1); // schaut zu ihm hinunter
          } else if (Math.random() < 0.5) {
            const P = this._el.pika.classList;
            P.add('wiggle');
            F.add('wiggle');
            await w(1300);
            P.remove('wiggle');
            F.remove('wiggle');
          }
          await w(rnd(600, 1200));
        }
        F.remove('look-up');
        if (both) {
          // Pino springt zuerst; der Pika nimmt die andere Seite des Steins. Ist rechts kein Platz (beide links),
          // rückt Pino vorher ein Stück zur Seite.
          await this._frHopDown(fr, w);
          const x = this._footX(fr.x >= rock.cx ? -1 : 1);
          if (x == null) await this._friendWalkTo(fr, fr.x - pW * 0.8, 1, w);
          await this._hopTo(x ?? this._footX(-1), 0);
          this._puff(this._x, gy, 3);
        } else await this._hopDown();
        if (!both) {
          this._frFace(fr, this._x >= fr.x ? 1 : -1);
          this._frJump(fr, 'hop1');
          this._frSay(fr, '♥', 900);
        }
        await w(rnd(500, 900));
      });
    }

    // Zusammen knabbern: der Pika pflückt eine Blume, Pino knabbert an der nächsten (sie bleibt stehen)
    // oder von der anderen Seite an derselben
    async _nibbleWithFriend() {
      await this._withFriend(async (fr, w) => {
        if (!this._flowers.length || this._wx.snowcover) return;
        const { pW } = this._g;
        const W = this._W;
        const mid = (this._x + fr.x) / 2;
        const near = (x) => (a, b) => Math.abs(a.xf * W - x) - Math.abs(b.xf * W - x);
        const f1 = [...this._flowers].sort(near(mid))[0];
        const x1 = f1.xf * W;
        const f2 = this._flowers
          .filter((f) => f !== f1 && Math.abs(f.xf * W - x1) > pW * 0.7 && Math.abs(f.xf * W - x1) < W * 0.3)
          .sort(near(x1))[0];
        const s = this._x <= x1 ? -1 : 1; // Seite des Pikas an Blume 1
        const fx = f2 ? f2.xf * W + (f2.xf * W > x1 ? 1 : -1) * pW * 0.32 : x1 - s * pW * 0.33;
        const tx = f2 ? f2.xf * W : x1;
        await Promise.all([this._walkTo(x1 + s * pW * 0.36), this._friendWalkTo(fr, fx, 1, w)]);
        this._face(x1 >= this._x ? 1 : -1);
        this._frFace(fr, tx >= fr.x ? 1 : -1);
        await w(250);
        if (!this._flowers.includes(f1)) return;
        this._pickFlower(f1);
        const ms = rnd(2600, 3800);
        this._frEat(fr, f2 ? f2.color : f1.color, ms + 300);
        await this._eat(f1.color, ms);
        await w(300);
        this._frEatEnd(fr);
        this._frSay(fr, pick(['mmh!', 'lecker!', '♥']), 1100);
        await w(rnd(700, 1200));
      });
    }

    // Piep-Duett: abwechselnd piepsen, immer schneller, zum Schluss zusammen
    async _squeakDuet() {
      await this._withFriend(async (fr, w) => {
        const { pW } = this._g;
        const dist = Math.abs(fr.x - this._x);
        if (dist > this._W * 0.4 || dist < pW * 0.6) {
          const d = fr.x >= this._x ? 1 : -1;
          await this._walkTo(fr.x - d * pW * rnd(1, 1.3));
        }
        this._face(fr.x >= this._x ? 1 : -1);
        this._frFace(fr, this._x >= fr.x ? 1 : -1);
        const P = this._el.pika.classList;
        await w(400);
        const n = 3 + Math.floor(rnd(0, 3));
        for (let i = 0; i < n; i++) {
          const fast = i >= 2;
          P.add('calling');
          this._say(pick(['iiep!', 'mip!', 'iiiep!', 'pip!']), 800);
          await w(600);
          P.remove('calling');
          await w(fast ? 120 : 320);
          this._frCall(fr, pick(['mip!', 'pip!', 'iiep!', 'piep!']));
          await w(fast ? 600 : 760);
          await w(fast ? 120 : 320);
        }
        P.add('calling');
        this._say('iiiiep!', 1000);
        this._frCall(fr, 'iiiiep!');
        await w(700);
        P.remove('calling');
        this._happy();
        this._frHappy(fr);
        await w(1300);
      });
    }

    // Abschied: Pino nachschauen (dreht sich mit), "tschüss", kurz die Ohren hängen lassen
    async _byeFriend() {
      const bye = this._frBye;
      if (!bye) return;
      bye.done = true;
      const P = this._el.pika.classList;
      const where = () => (this._fr ? this._frLive(this._fr).x : bye.x);
      this._face(where() >= this._x ? 1 : -1);
      P.add('look-f');
      // auch bei Abbruch (Streicheln, Futter, Schlaf) nicht traurig hängen bleiben: sad räumt _cleanup nicht ab
      try {
        await this._wait(800);
        this._say(`tschüss, ${this._frName()}!`, 1500);
        const end = Date.now() + 5000;
        while (this._fr && Date.now() < end) {
          await this._wait(300);
          this._face(where() >= this._x ? 1 : -1);
        }
        P.add('sad');
        await this._wait(rnd(2200, 3200));
      } finally {
        P.remove('sad', 'look-f');
      }
      await this._wait(rnd(300, 700));
    }
    // ==================== Ende Freund-Pika ====================

    // Kleiner Schriftzug („piep!“, „plopp!“), der aufsteigt und verblasst. Nicht _squeak: das ist die Aktion.
    _peep(x, y, text) {
      const s = document.createElement('span');
      s.className = 'squeak';
      s.textContent = text;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      this._el.fx.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }

    // ---------- Zustand ----------

    _raw(k) {
      if (!this._stats) return 70;
      const v = this._stats[k] - ((Date.now() - this._stats[k + 't']) / 3.6e6) * RATE[k];
      return clamp(v, 0, 100);
    }

    // Glück ist durch Schmutz gedeckelt: bei 0 % sauber höchstens 60 %. Streicheln zählt trotzdem
    // weiter, nach dem Putzen zeigt der Balken dann den vollen Wert.
    _get(k) {
      const v = this._raw(k);
      return k === 'g' ? Math.min(v, 60 + 0.4 * this._poops().clean) : v;
    }

    _add(k, d) {
      if (!this._stats) this._stats = freshStats();
      this._stats[k] = clamp(this._raw(k) + d, 0, 100);
      this._stats[k + 't'] = Date.now();
      this._gain[k] += d; // noch nicht gesendet (für das Zusammenführen mit fremden Ständen)
      this._renderStats();
      this._save();
    }

    _save() {
      this._pendingWrite = true;
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => {
        const v = serialize(this._stats);
        if (this._cfg.entity && !this._noEntity) {
          // Stand aus HA noch nicht da (Start, unavailable): warten, beim Eintreffen wird zusammengeführt
          if (!this._synced || !this._hass) return;
          this._lastEntityState = v;
          this._hass
            .callService('input_text', 'set_value', { entity_id: this._cfg.entity, value: v })
            .catch((e) => console.warn('pika-pet-card: Speichern fehlgeschlagen', e));
        } else {
          try {
            localStorage.setItem(this._lsKey(), v);
          } catch (e) { /* egal */ }
        }
        this._gain = { s: 0, g: 0, c: false };
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
      this._renderPiles();
      const s = this._get('s');
      const g = this._get('g');
      const c = this._poops().clean;
      this._el.barS.style.width = `${s}%`;
      this._el.barG.style.width = `${g}%`;
      this._el.barC.style.width = `${c}%`;
      this._el.stS.classList.toggle('low', s < 30);
      this._el.stG.classList.toggle('low', g < 30);
      this._el.stC.classList.toggle('low', c < 30);
      this._el.stS.title = `Satt: ${Math.round(s)} %`;
      this._el.stG.title = `Glücklich: ${Math.round(g)} %`;
      this._el.stC.title = `Sauber: ${Math.round(c)} %`;
    }

    // ---------- Häufchen ----------

    _now() {
      return Date.now() + this._dbgShift;
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
        const a = this._sleepMinutes(this._cfg.sleep_start, 21 * 60, day);
        const b = this._sleepMinutes(this._cfg.sleep_end, 7 * 60, day);
        const [y, mo, d] = [day.getFullYear(), day.getMonth(), day.getDate()];
        const ws = new Date(y, mo, d, 0, b).getTime();
        const we = new Date(y, mo, d + (a > b ? 0 : 1), 0, a).getTime(); // Schlafen nach Mitternacht: am Folgetag
        day.setDate(d + 1);
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
    _poops() {
      const st = this._stats;
      const now = this._now();
      const key = st && `${st.c},${st.m},${st.l},${Math.floor(now / 1e4)},${this._cfg.sleep_start},${this._cfg.sleep_end}`;
      if (this._poopCache?.key === key) return this._poopCache;
      const res = { key, piles: [], clean: 100 };
      this._poopCache = res;
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
      let dirt = 0;
      for (const p of res.piles) dirt += 10 + 2 * Math.min(20, (now - p.due) / 36e5);
      res.clean = clamp(100 - dirt, 0, 100);
      return res;
    }

    _pileKey(p) {
      return `${this._stats.c / 1000}:${p.k}`;
    }

    // Klo-Ecke: drei Plätze am linken Fuß des Aussichtssteins; Wiese: zwischen Heuhaufen und Klo-Ecke
    _pileX(p) {
      const { rock, fMin, pW } = this._g;
      if (p.slot != null) return rock.l + rock.w * [0.04, 0.16, -0.08][p.slot];
      const a = fMin * this._W;
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

    // Kann er das neue Häufchen live machen? Nur wenn er draußen ist und nichts Wichtigeres tut.
    _canPoopLive() {
      return this._running && !this._asleep && !this._inside && !this._wx.shelter && !this._next
        && !['eatFood', 'goSleep', 'wakeUp', 'poop'].includes(this._action);
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
        if (this._poopPending?.key === key) continue;
        // Gerade fällig und man schaut zu: er macht es vor den Augen
        if (this._pilesShown && !this._poopPending && now - p.due < 3 * 6e4 && this._canPoopLive()) {
          this._poopPending = { ...p, key };
          this._next = 'poop';
          this._interrupt();
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
    }

    _placePiles() {
      for (const el of this._pileEls.values()) el.style.setProperty('--px', `${this._pileX(el._pile).toFixed(1)}px`);
    }

    // Antippen: Schaufel kommt, Häufchen weg, Funkeln. Ist alles weg, gilt das als Großputz.
    _cleanPile(key) {
      const el = this._pileEls.get(key);
      if (!el || el.classList.contains('scooped')) return;
      const p = el._pile;
      const x = this._pileX(p);
      el.classList.add('scooped');
      this._pileEls.delete(key);
      setTimeout(() => el.remove(), 800);
      const sc = document.createElement('div');
      sc.className = 'scoop';
      sc.innerHTML = SCOOP_SVG;
      sc.style.left = `${x}px`;
      sc.style.bottom = `${this._H - this._g.gy - this._H * 0.03}px`;
      this._el.fx.appendChild(sc);
      setTimeout(() => sc.remove(), 900);
      setTimeout(() => this._sparkle(x, this._g.gy - this._H * 0.03, 3), 450);

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

    _sparkle(x, y, n) {
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'spark';
        s.innerHTML = `<svg viewBox="0 0 24 24"><path d="${STAR}"/></svg>`;
        s.style.left = `${x + rnd(-8, 8)}px`;
        s.style.top = `${y + rnd(-4, 4)}px`;
        s.style.setProperty('--dx', `${rnd(-12, 12).toFixed(1)}px`);
        s.style.animationDelay = `${i * 120}ms`;
        this._el.fx.appendChild(s);
        setTimeout(() => s.remove(), 1000 + i * 120);
      }
    }

    _sleepTime() {
      if (this._dbgSleep != null) return this._dbgSleep;
      const now = new Date();
      const m = now.getHours() * 60 + now.getMinutes();
      const a = this._sleepMinutes(this._cfg.sleep_start, 21 * 60);
      const b = this._sleepMinutes(this._cfg.sleep_end, 7 * 60);
      return a > b ? m >= a || m < b : m >= a && m < b;
    }

    // "21:00", "sunset", "sunset+01:00", "sunrise-30" (Minuten) → Minuten nach Mitternacht, Unverständliches → fallback.
    // Sonnenauf- und -untergang kommen aus sun.sun (next_rising/next_setting). Die springen genau beim Ereignis auf
    // morgen: Ist das morgige ein, zwei Minuten später (Aufgang im Herbst, Untergang im Frühjahr), wäre direkt nach
    // dem Aufwachen wieder Schlafenszeit. Darum gilt je Kalendertag der erste Wert, der kam (war das Ereignis heute
    // schon, ist es der von morgen – auf wenige Minuten dasselbe). Mit day (Häufchen-Plan) aus Ort und Datum gerechnet:
    // so hat jeder Vortag seine eigenen Zeiten, und alle Geräte rechnen gleich.
    _sleepMinutes(spec, fallback, day) {
      const m = String(spec ?? '').trim().toLowerCase()
        .match(/^(sunrise|sunset)\s*(?:([+-])\s*(?:(\d{1,2}):(\d{2})|(\d+)))?$/);
      if (!m) {
        const v = minutes(spec);
        if (v == null && !this._badSpec?.has(spec)) {
          (this._badSpec ??= new Set()).add(spec);
          console.warn(`pika-pet-card: Uhrzeit "${spec}" nicht verstanden (erlaubt: "21:00", "sunset", "sunset+01:00", "sunrise-30")`);
        }
        return v ?? fallback;
      }
      const rise = m[1] === 'sunrise';
      const cfg = this._hass?.config;
      const at = day && cfg && Number.isFinite(cfg.latitude) && Number.isFinite(cfg.longitude)
        && sunTimes(day, cfg.latitude, cfg.longitude, Number(cfg.elevation) || 0);
      let v;
      if (at) {
        const t = new Date(rise ? at.rise : at.set);
        v = t.getHours() * 60 + t.getMinutes();
      } else {
        const attr = rise ? 'next_rising' : 'next_setting';
        const today = new Date().toDateString();
        const c = this._sunMin?.[attr];
        if (c?.day === today) v = c.v;
        else {
          const t = new Date(this._hass?.states[this._cfg.sun_entity]?.attributes?.[attr] ?? NaN);
          if (Number.isNaN(t.getTime())) return fallback; // sun.sun (noch) nicht da: nicht merken
          v = t.getHours() * 60 + t.getMinutes();
          (this._sunMin ??= {})[attr] = { day: today, v };
        }
      }
      const sign = m[2] === '-' ? -1 : 1;
      const off = m[3] != null ? Number(m[3]) * 60 + Number(m[4]) : Number(m[5] || 0);
      return (((v + sign * off) % 1440) + 1440) % 1440;
    }

    _updateSky() {
      if (!this._el) return;
      const e = this._dbgElev ?? this._elev;
      let mode;
      if (e == null) mode = this._asleep ? 'night' : 'day';
      else if (e > 4) mode = this._asleep ? 'dusk' : 'day';
      else if (e > -5) mode = 'dusk';
      else mode = 'night';
      // Läuft bei jedem hass-Update: Klassen nur bei echter Änderung anfassen (toggle mit force schreibt nur
      // dann), jede Klassenänderung an der Szene lässt den ganzen Baum neu berechnen
      const sc = this._el.scene.classList;
      if (!sc.contains(mode)) {
        sc.remove('day', 'dusk', 'night');
        sc.add(mode);
      }
      const month = new Date(this._dbgDate ?? Date.now()).getMonth();
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
        const d = moonPath(ph);
        if (d !== this._moonD) this._el.moonLit.setAttribute('d', (this._moonD = d));
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

    // ---------- Flugzeuge ----------
    // Echte Flüge aus der Flightradar24-Integration (Attribut flights, Meldung alle 10–30 s). Dazwischen fliegen
    // sie mit Kurs und Geschwindigkeit weiter. Im Bild: Osten links, Westen rechts, der Bildrand liegt bei
    // flight_radius. Die Flughöhe bestimmt, wie hoch sie am Himmel stehen, die Entfernung ihre Größe.


    // ==================== Himmel-Extras: Methoden ====================
    // Sternschnuppen (nur zum Anschauen, kein Zähler): ein Zeitgeber alle 1,5–5 Minuten, der nur nachts bei
    // klarem Himmel eine losschickt. Jede läuft als CSS-Animation in .meteors und entfernt sich danach selbst.
    // Glühwürmchen: ersetzen die sechs Punkte aus _build durch 10–14 eigene; die Ebene .ff blendet je nach
    // Lage (Sommernacht, späte Sommerdämmerung, trocken) ein oder aus.
    _hassSky(hass) {
      // erst nach _updateSky im selben hass-Aufruf, damit die Szenen-Klassen schon stimmen
      if (this._skyQ) return;
      this._skyQ = true;
      queueMicrotask(() => {
        this._skyQ = false;
        this._skyState();
      });
    }

    _attachSky() {
      this._ffKey = null;
      this._skyState();
      if (!document.hidden) this._meteorPlan();
    }

    _detachSky() {
      this._meteorStop();
      clearTimeout(this._ffRestT);
      this._el.meteors.textContent = '';
    }

    _hiddenSky(hidden) {
      if (hidden) this._meteorStop();
      else {
        this._meteorPlan();
        this._skyState();
      }
    }

    _layoutSky(first) {
      // neue Größe: neue Orte und Wege (die alten lägen sonst über Statusleiste oder Futterknopf)
      if (this._ffSize !== `${this._W}x${this._H}`) this._ffPlace();
    }

    _tickSky() {
      this._skyState();
    }

    _skyActs(ctx) {
      const m = this._met;
      const meteor = m && m.watch && !m.seen && Date.now() - m.at < SKY.watchMs;
      return [
        [meteor ? 12 : 0, 'watchMeteor'],
        [this._ffShown() ? 1.5 : 0, 'watchFireflies'],
      ];
    }

    // Sommer = Mai bis September, nach der Vorschau-Uhr, falls gesetzt; auf der Südhalbkugel
    // (hass.config.latitude < 0) ein halbes Jahr versetzt, also November bis März
    _skySummer() {
      let month = new Date(this._dbgDate ?? Date.now()).getMonth();
      if (this._hass?.config?.latitude < 0) month = (month + 6) % 12;
      return month >= 4 && month <= 8;
    }

    // Glühwürmchen bauen (Option fireflies), Sichtbarkeit nach Tageszeit, Jahreszeit und Wetter setzen
    _skyState() {
      if (!this._el) return;
      const ff = this._el.ff;
      const want = this._cfg.fireflies !== false;
      if (want !== this._ffKey) {
        this._ffKey = want;
        this._ffBuild(want);
      }
      const sc = this._el.scene.classList;
      const wx = this._wx;
      const e = this._dbgElev ?? this._elev;
      const ok = want && this._skySummer() && !wx.wet && !wx.storm;
      const mode = !ok ? '' : sc.contains('night') ? 'on' : sc.contains('dusk') && e != null && e < -2 ? 'dim' : '';
      if (mode === (this._ffMode ?? '')) return;
      this._ffMode = mode;
      clearTimeout(this._ffRestT);
      if (mode) {
        // aus der Ruhe holen (display: none) und erst danach einblenden, sonst springt die Deckkraft
        if (ff.classList.contains('rest')) {
          ff.classList.remove('rest');
          void ff.offsetWidth;
        }
        ff.classList.toggle('on', mode === 'on');
        ff.classList.toggle('dim', mode === 'dim');
      } else {
        ff.classList.remove('on', 'dim');
        // nach dem Ausblenden ganz aus dem Bild, dann laufen auch keine Animationen mehr
        this._ffRestT = setTimeout(() => !this._ffMode && ff.classList.add('rest'), 3500);
      }
    }

    _ffShown() {
      return !!this._ffMode && !!this._ffKey;
    }

    _ffBuild(on) {
      const ff = this._el.ff;
      this._ffMode = null;
      ff.classList.remove('on', 'dim');
      ff.classList.add('rest');
      if (!on) {
        ff.textContent = '';
        return;
      }
      const n = Math.round(rnd(SKY.ff[0], SKY.ff[1]));
      let html = '';
      for (let i = 0; i < n; i++) {
        const big = Math.random() < 0.3;
        html += `<i class="fl${big ? ' big' : ''}" style="--fd:${rnd(7, 14).toFixed(1)}s;--fdl:${rnd(-14, 0).toFixed(2)}s;`
          + `--fp:${rnd(1.2, 2.6).toFixed(2)}s;--fpl:${rnd(-2.6, 0).toFixed(2)}s"></i>`;
      }
      ff.innerHTML = html;
      this._ffPlace();
    }

    // Jedem Glühwürmchen einen Ort und einen eigenen Driftweg (vier Punkte, px) geben. Gut die Hälfte schwirrt
    // tief über der Wiese, ein Drittel um den Heuhaufen (--hl, --hw), der Rest etwas höher. Kein Weg führt
    // über die Statusleiste oder den Futterknopf, durchs Heu oder ins Gras (beide liegen vorn, z 3).
    _ffPlace() {
      const g = this._g;
      const flies = this._el.ff.children;
      if (!g || !flies.length) return;
      const W = this._W;
      const H = this._H;
      this._ffSize = `${W}x${H}`;
      const { gy } = g;
      const hw = g.stash ? g.hW : H * 0.26;
      const hl = g.hay - hw / 2;
      const avoid = [];
      for (const el of [this._el.stats, this._el.feed]) {
        if (el.offsetWidth) {
          avoid.push({ l: el.offsetLeft - 10, t: el.offsetTop - 10, r: el.offsetLeft + el.offsetWidth + 10, b: el.offsetTop + el.offsetHeight + 10 });
        }
      }
      // Heuhaufen in voller Größe (wächst bis scale 1,06; Grafik 60 × 40, Spitze bei y 10). Die Nische liegt
      // hinten im Bau, vor ihr dürfen sie schwirren.
      const hs = hw * 1.06;
      if (!g.stash) avoid.push({ l: g.hay - hs / 2, r: g.hay + hs / 2, t: gy + 4 - hs * 0.5 - 4, b: gy });
      const grass = gy - H * 0.05; // Oberkante der Grashalme
      const zone = (i) => {
        const z = i % 3 === 0 ? 'hay' : i % 5 === 4 ? 'high' : 'low';
        if (z === 'hay') return [rnd(hl - hw * 0.4, hl + hw * 1.4), rnd(gy - H * 0.32, gy - H * 0.06)];
        if (z === 'high') return [rnd(W * 0.12, W * 0.95), rnd(H * 0.3, H * 0.55)];
        return [rnd(W * 0.04, W * 0.96), rnd(gy - H * 0.2, gy - H * 0.06)];
      };
      [...flies].forEach((el, i) => {
        let pts = null;
        for (let k = 0; k < 30 && !pts; k++) {
          const [x, y] = zone(i);
          const ax = H * rnd(0.05, 0.16);
          const ay = H * rnd(0.03, 0.1);
          const p = [[x, y]];
          for (let j = 1; j < 4; j++) p.push([x + rnd(-ax, ax), y + rnd(-ay, ay * 0.6)]);
          const xs = p.map((q) => q[0]);
          const ys = p.map((q) => q[1]);
          const box = { l: Math.min(...xs) - 4, r: Math.max(...xs) + 4, t: Math.min(...ys) - 4, b: Math.max(...ys) + 4 };
          const inside = box.l > 0 && box.r < W && box.t > H * 0.06 && box.b < grass;
          if (inside && !avoid.some((a) => box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t)) pts = p;
        }
        // kein freier Platz gefunden (sehr kleine Karte): dieses eine bleibt dunkel
        el.hidden = !pts;
        if (!pts) return;
        pts.forEach(([x, y], j) => {
          el.style.setProperty(`--x${j}`, `${x.toFixed(1)}px`);
          el.style.setProperty(`--y${j}`, `${y.toFixed(1)}px`);
        });
      });
    }

    _meteorPlan() {
      clearTimeout(this._metT);
      this._metT = setTimeout(() => {
        this._metT = null;
        this._meteorMaybe();
        this._meteorPlan();
      }, rnd(SKY.meteor[0], SKY.meteor[1]));
    }

    _meteorStop() {
      clearTimeout(this._metT);
      clearTimeout(this._metT2);
      this._metT = this._metT2 = null;
    }

    // Nachts bei weniger als 70 % Bewölkung, ohne Nebel, Regen und Schnee
    _meteorOk() {
      if (this._cfg.shooting_stars === false || !this._g) return false;
      const wx = this._wx;
      const cover = Number.isFinite(wx.cover) ? wx.cover : 0;
      return this._el.scene.classList.contains('night') && cover < 70 && !wx.fog && !wx.wet && !wx.snow;
    }

    _meteorMaybe() {
      if (!this._meteorOk()) return;
      this._meteor(Math.random() < SKY.bolide);
      if (Math.random() < SKY.twin) {
        clearTimeout(this._metT2);
        this._metT2 = setTimeout(() => this._meteorOk() && this._meteor(Math.random() < SKY.bolide / 2), rnd(500, 2200));
      }
    }

    // Eine Sternschnuppe: Start im oberen Himmel (ab 3 % der Höhe), 15–35 % der Breite weit (höchstens 0,9 H),
    // leicht abwärts. Das Ende bleibt über der halben Höhe, sonst verschwänden Schweif und Aufleuchten hinter
    // den Hügeln (breite Karten).
    _meteor(bolide = false) {
      if (!this._g) return;
      const W = this._W;
      const H = this._H;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const tilt = rnd(8, 26);
      const len = Math.min(W * rnd(0.15, 0.35), H * 0.9);
      const dx = len * Math.cos(tilt * RAD);
      const dy = len * Math.sin(tilt * RAD);
      const x = dir > 0 ? rnd(W * 0.04, Math.max(W * 0.05, W * 0.96 - dx)) : rnd(Math.min(W * 0.95, W * 0.04 + dx), W * 0.96);
      const y = rnd(H * 0.03, Math.max(H * 0.04, Math.min(H * 0.45, H * 0.5 - dy)));
      const dur = bolide ? rnd(0.95, 1.2) : rnd(0.5, 1.1);
      const el = document.createElement('div');
      el.className = `met${bolide ? ' bolide' : ''}`;
      el.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;--a:${(dir > 0 ? tilt : 180 - tilt).toFixed(1)}deg;`
        + `--len:${len.toFixed(1)}px;--tail:${(len * rnd(0.35, 0.5) * (bolide ? 1.3 : 1)).toFixed(1)}px;--d:${dur.toFixed(2)}s`;
      el.innerHTML = '<b class="mt"></b><b class="mh"></b>';
      this._el.meteors.appendChild(el);
      setTimeout(() => el.remove(), dur * 1000 + 200);
      if (bolide) {
        // kurzes Aufleuchten des Himmels um die Stelle, an der er aufglüht
        const fx = x + dir * dx * 0.78;
        const fy = y + dy * 0.78;
        const f = document.createElement('i');
        f.className = 'mflash';
        f.style.cssText = `background:radial-gradient(circle at ${fx.toFixed(0)}px ${fy.toFixed(0)}px, rgba(215, 235, 255, .3), rgba(215, 235, 255, 0) ${(H * 0.5).toFixed(0)}px);`
          + `animation-delay:${(dur * 0.68).toFixed(2)}s`;
        this._el.meteors.appendChild(f);
        setTimeout(() => f.remove(), dur * 680 + 900);
      }
      // Ist er wach, schaut er mit etwa jeder zweiten hin (Aktion watchMeteor in den 4 s danach)
      const watch = !this._asleep && Math.random() < SKY.watch;
      this._met = { at: Date.now(), x: x + (dir * dx) / 2, dir, bolide, watch, seen: false };
      if (watch && !this._inside && (this._action === 'idle' || this._action === 'look')) this._interrupt();
    }

    // Einer Sternschnuppe nachschauen
    async _watchMeteor() {
      const m = this._met;
      if (!m) return;
      m.seen = true;
      const p = this._el.pika;
      this._face(m.x >= this._x ? 1 : -1);
      p.classList.add('look-up');
      await this._wait(250);
      if (m.bolide) this._jump('hop1');
      this._say(m.bolide ? 'oooh!' : 'oh!', 1200);
      await this._wait(rnd(700, 1000));
      // mit dem Kopf hinterher, in Flugrichtung
      this._face(m.dir);
      await this._wait(rnd(1300, 2200));
      p.classList.remove('look-up');
      await this._wait(rnd(400, 900));
    }

    // Ort (px in der Szene) eines zufälligen sichtbaren Glühwürmchens
    _ffSpot() {
      const els = [...this._el.ff.children].filter((el) => !el.hidden);
      const el = els.length ? pick(els) : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width) return null;
      const s = this._el.scene.getBoundingClientRect();
      return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
    }

    // Den Glühwürmchen zuschauen: hinsetzen, hochschauen, mit dem Kopf folgen, einmal nach einem hüpfen
    async _watchFireflies() {
      const p = this._el.pika;
      const { pW } = this._g;
      let f = this._ffSpot();
      if (f && Math.abs(f.x - this._x) > this._W * 0.3) {
        await this._walkTo(f.x - Math.sign(f.x - this._x) * pW * rnd(0.6, 1.1), 0.7);
      }
      if (f) this._face(f.x >= this._x ? 1 : -1);
      p.classList.add('crouch', 'look-up');
      await this._wait(rnd(1200, 1900));
      p.classList.remove('look-up');
      let fwd = true;
      for (let i = 0, n = 2 + Math.floor(rnd(0, 3)); i < n; i++) {
        p.classList.toggle('look-f', fwd);
        p.classList.toggle('look-b', !fwd);
        fwd = !fwd;
        await this._wait(rnd(600, 1200));
      }
      p.classList.remove('look-f', 'look-b', 'crouch');
      f = this._ffSpot() || f;
      if (f) this._face(f.x >= this._x ? 1 : -1);
      p.classList.add('look-up');
      await this._wait(200);
      this._jump('hop1');
      this._say('oh!', 1100);
      await this._wait(rnd(1400, 2400));
    }
    // ==================== Ende Himmel-Extras ====================

    _readFlights(st) {
      const cfg = this._hass?.config;
      if (!this._el || !cfg || !Number.isFinite(cfg.latitude)) return;
      const now = Date.now();
      // Uhr von HA und Gerät können auseinandergehen: Versatz aus den Meldungen schätzen (die frischeste kommt
      // praktisch sofort an, der größte Wert passt also am besten). Sonst verschwänden alle Flieger, wenn die
      // Geräteuhr mehr als 75 s vorgeht. Die erste Meldung gilt als frisch.
      const lu = Date.parse(st?.last_updated);
      if (Number.isFinite(lu) && st !== this._flSeen) {
        this._flSeen = st;
        this._clockOff = Math.max(this._clockOff ?? -Infinity, lu - now);
      }
      const t0 = Number.isFinite(lu) ? Math.min(now, lu - this._clockOff) : now;
      // Getrennt oder unsichtbar: keine Elemente anlegen, die Meldung liegt in _lastFlights und wird beim
      // Wiederkommen gelesen
      if (!this._attached || document.hidden) return;
      const kx = 111.32 * Math.cos(cfg.latitude * RAD);
      const list = [];
      for (const f of Array.isArray(st?.attributes?.flights) ? st.attributes.flights : []) {
        const alt = Number(f.altitude);
        const gs = Number(f.ground_speed);
        const lat = Number(f.latitude);
        const lon = Number(f.longitude);
        // Rollt am Flughafen oder hat keine Position: nicht am Himmel
        if (f.on_ground || !(alt > 80) || !(gs > 30) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const e = (lon - cfg.longitude) * kx;
        const n = (lat - cfg.latitude) * 110.57;
        list.push({ f, e, n, alt, gs, slant: Math.hypot(e, n, alt * 0.0003048) });
      }
      list.sort((a, b) => a.slant - b.slant);
      const max = Math.max(0, Math.round(Number(this._cfg.max_flights) || 0));
      const idOf = (f) => String(f.id || f.callsign || f.flight_number);
      // Wer schon am Himmel steht, behält seinen Platz, solange er gemeldet wird. Sonst tauschen zwei fast gleich
      // weite Flieger bei jeder Meldung die Plätze, und einer verschwindet mitten am Himmel. Neue füllen freie
      // Plätze; ein deutlich näherer darf als einer mehr dazukommen, die anderen fliegen dann normal aus dem Bild.
      const pick = list.filter((s) => {
        const p = this._planes.get(idOf(s.f));
        return p && !p.dead && !p.gone;
      }).slice(0, max && max + 1);
      for (const s of list) {
        if (pick.includes(s)) continue;
        const worst = Math.max(0, ...pick.map((o) => o.slant));
        if (pick.length < max || (max && pick.length === max && s.slant < 0.6 * worst)) pick.push(s);
      }
      const keep = new Set();
      for (const s of pick) {
        const id = idOf(s.f);
        keep.add(id);
        const p = this._planes.get(id) || this._newPlane(id, s.f);
        // Die Integration meldet oft dieselbe Position noch einmal (Flightradar24 hat noch nichts Neues). Dann
        // weiter von der alten Meldung aus rechnen, sonst springt der Flieger um eine Meldung zurück.
        const same = p.t0 != null && Number(p.f.latitude) === Number(s.f.latitude)
          && Number(p.f.longitude) === Number(s.f.longitude);
        Object.assign(p, { f: s.f, gone: 0, dead: 0 });
        if (!same) {
          const v = (s.gs * 1.852) / 3600; // km/s
          const h = Number(s.f.heading) * RAD;
          Object.assign(p, {
            e: s.e, n: s.n, alt: s.alt, t0,
            ve: Number.isFinite(h) ? v * Math.sin(h) : 0,
            vn: Number.isFinite(h) ? v * Math.cos(h) : 0,
            vz: clamp(Number(s.f.vertical_speed) || 0, -6000, 6000) / 60, // ft/s
          });
        }
        this._planeText(p);
      }
      // Aus dem Umkreis (oder nicht mehr unter den nächsten): fliegt noch weiter, bis es aus dem Bild ist
      for (const [id, p] of this._planes) if (!keep.has(id) && !p.gone) p.gone = now;
      this._planeLoop();
    }

    // Solange ein Fähnchen offen ist, liegt die Fähnchen-Ebene ganz vorne
    _tagsTop() {
      const any = [...this._planes.values()].some((p) => p.tag.classList.contains('open'));
      this._el.ptags.classList.toggle('top', any);
    }

    _newPlane(id, f) {
      const kind = planeKind(f);
      const el = document.createElement('div');
      el.className = `plane ${kind}`;
      el.innerHTML = `<div class="pl-s"><div class="pl-f"><div class="trail"></div>${PLANE_SVG[kind]}</div></div>`;
      el.style.setProperty('--tail', TAIL[f.airline_icao] || TAIL_DEFAULT[kind]);
      const tag = document.createElement('div');
      tag.className = 'ptag';
      const hit = document.createElement('div');
      hit.className = 'phit';
      hit.setAttribute('role', 'button');
      const p = { id, kind, f, el, tag, hit, s: el.firstElementChild, size: PLANE_SIZE[kind], fresh: true };
      // Flugzeug antippen: Flugnummer, Ziel, Airline, Typ, Strecke, Höhe und Tempo; nochmal tippen schließt
      const toggle = (e) => {
        e.stopPropagation();
        // Die Tippfläche eines tiefen Fliegers liegt über Pika und Häufchen: die haben Vorrang
        if (e.currentTarget === hit) {
          const under = this.shadowRoot.elementsFromPoint(e.clientX, e.clientY)
            .find((el) => !el.closest('.ptags') && el.closest('.pika, .poo'));
          if (under) return under.closest('.pika, .poo').click();
        }
        clearTimeout(p.openT);
        const open = !tag.classList.contains('open');
        if (open) {
          this._planeText(p);
          p.openT = setTimeout(() => {
            tag.classList.remove('open');
            this._tagsTop();
          }, 9000);
        }
        tag.classList.toggle('open', open);
        this._tagsTop();
      };
      hit.addEventListener('click', toggle);
      tag.addEventListener('click', toggle);
      this._el.planes.appendChild(el);
      this._el.ptags.append(hit, tag);
      this._planes.set(id, p);
      return p;
    }

    _planeText(p) {
      const f = p.f;
      const cfg = this._hass?.config;
      const orig = cityDe(f.airport_origin_city);
      const dest = cityDe(f.airport_destination_city);
      // Landet es hier in der Nähe, ist die Herkunft spannender als das Ziel
      const dLat = Number(f.airport_destination_latitude);
      const dLon = Number(f.airport_destination_longitude);
      const landsHere = cfg && Number.isFinite(dLat) && Number.isFinite(dLon)
        && Math.hypot((dLon - cfg.longitude) * 111.32 * Math.cos(cfg.latitude * RAD), (dLat - cfg.latitude) * 110.57) < 30;
      const route = landsHere && orig ? `aus ${orig}` : dest ? `→ ${dest}` : '';
      const alt = Math.round(((p.altNow ?? p.alt ?? Number(f.altitude)) * 0.3048) / 10) * 10;
      const kmh = Math.round(Number(f.ground_speed) * 1.852);
      const more = [
        [f.airline_short || f.airline, String(f.aircraft_model || '').replace(/-\S+$/, '')].filter(Boolean).join(' · '),
        orig && dest ? `${orig} → ${dest}` : '',
        `${alt.toLocaleString('de-DE')} m${kmh ? ` · ${kmh} km/h` : ''}`,
      ].filter(Boolean);
      const html = `<b>${esc(flightNo(f))}</b>${route ? ` ${esc(route)}` : ''}`
        + more.map((l) => `<div class="more">${esc(l)}</div>`).join('');
      if (html === p.html) return;
      p.html = html;
      p.tag.innerHTML = html;
      p.hit.setAttribute('aria-label', `Flug ${flightNo(f)} ${route}`.trim());
      p.tw = 0;
    }

    _planeLoop() {
      if (!this._planes.size || !this._attached || this._planeT) return;
      this._planeT = setInterval(() => this._planeTick(), 1000);
      this._planeTick();
    }

    _planeTick() {
      if (!this._planes.size) {
        clearInterval(this._planeT);
        this._planeT = null;
        return;
      }
      if (document.hidden || !this._g) return;
      const now = Date.now();
      const W = this._W;
      const H = this._H;
      const R = Number(this._cfg.flight_radius) || 15;
      const shown = [];
      const fresh = [];
      const pos = [];
      for (const [id, p] of this._planes) {
        const dt = (now - p.t0) / 1000;
        const e = p.e + p.ve * dt;
        const n = p.n + p.vn * dt;
        const alt = Math.max(80, p.alt + p.vz * Math.min(dt, 30));
        const x = W * (0.5 - (e / R) * 0.46);
        // Höhe logarithmisch: Anflug knapp über den Hügeln, Reiseflughöhe oben; nördlich (hinter uns) etwas höher
        const af = clamp(Math.log1p(alt / 1000) / Math.log1p(40), 0, 1);
        const y = (H * clamp(49 - af * 36 - clamp(n / R, -1, 1) * 4, 13, 49)) / 100;
        const slant = Math.hypot(e, n, alt * 0.0003048);
        const sc = (clamp(1.6 / slant, 0.1, 0.36) / 0.3) * p.size;
        Object.assign(p, { x, y, slant, altNow: alt });
        const out = x < -W * 0.2 || x > W * 1.2;
        // Ohne neue Meldung nach 75 s ausblenden, ein verlassenes spätestens nach 45 s
        const ending = p.gone ? out || now - p.gone > 45000 : dt > 75;
        if (ending && !p.dead) p.dead = now;
        if (p.dead && now - p.dead > 2500) {
          clearTimeout(p.openT);
          p.el.remove();
          p.tag.remove();
          p.hit.remove();
          this._planes.delete(id);
          this._tagsTop();
          continue;
        }
        // nach Osten = im Bild nach links; erst ab etwa 40 km/h quer, sonst dreht ein kurvender Hubschrauber hin und her
        if (Math.abs(p.ve) > 0.012) p.left = p.ve > 0;
        // Schwellen mit etwas Spiel, damit ein Flieger knapp an der Grenze nicht bei jeder Meldung umschaltet
        p.hi = alt > (p.hi ? 7500 : 8500);
        p.ct = alt > (p.ct ? 25500 : 26500);
        const cl = p.el.classList;
        cl.toggle('left', !!p.left);
        cl.toggle('contrail', p.ct && !this._wx.wet);
        cl.toggle('hi', p.hi);
        // Die Integration meldet ein Quadrat um das Haus (bis in die Ecken fast 1,5 × Radius). Zum Rand hin sanft
        // ein- und ausblenden, sonst taucht ein Flieger, der nördlich oder südlich vorbeizieht, mitten im Bild auf
        const pa = clamp((R - Math.max(Math.abs(e), Math.abs(n))) / (0.2 * R), 0, 1);
        p.el.style.setProperty('--pa', pa.toFixed(2));
        if (p.fresh) {
          p.el.style.transition = p.s.style.transition = p.tag.style.transition = p.hit.style.transition = 'none';
          fresh.push(p);
        }
        p.show = !p.dead && !out && pa > 0.02;
        // auch ein gerade ausblendender zählt beim Ausweichen mit, sonst springt der andere zurück
        pos.push({ p, x, y, sc, vis: !out && pa > 0.02 });
      }

      this._planeSpread(pos.filter((o) => o.vis), H);
      for (const { p, x, y, sc, vis } of pos) {
        if (!vis) p.dy = 0;
        p.y = y; // was man sieht: mit Ausweichen
        p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        p.s.style.transform = `scale(${sc.toFixed(3)})`;
        // Tippfläche so groß wie das Flugzeug, aber mindestens fingergroß
        const hw = Math.max(44, H * 0.3 * sc);
        const hh = Math.max(36, H * 0.12 * sc);
        p.hit.style.width = `${hw.toFixed(0)}px`;
        p.hit.style.height = `${hh.toFixed(0)}px`;
        p.hit.style.transform = `translate(${(x - hw / 2).toFixed(1)}px, ${(y - hh / 2).toFixed(1)}px)`;
        if (p.show) shown.push({ p, x, y, half: H * 0.06 * sc });
      }

      // Fähnchen unter dem Flugzeug, im Bild gehalten. Überdecken sich zwei, kommt das obere über sein Flugzeug.
      for (const t of shown) {
        if (!t.p.tw) {
          t.p.tw = t.p.tag.offsetWidth;
          t.p.th = t.p.tag.offsetHeight;
        }
        t.w = t.p.tw;
        t.h = t.p.th;
        t.tx = clamp(t.x - t.w / 2, 4, Math.max(4, W - t.w - 4)); // breiter als die Karte: links bündig
        t.ty = t.y + t.half + 3;
      }
      shown.sort((a, b) => a.y - b.y);
      for (let i = 0; i < shown.length; i++) {
        for (let j = i + 1; j < shown.length; j++) {
          const a = shown[i];
          const b = shown[j];
          if (a.tx < b.tx + b.w && b.tx < a.tx + a.w && a.ty < b.ty + b.h && b.ty < a.ty + a.h) a.ty = a.y - a.half - a.h - 3;
        }
      }
      for (const t of shown) t.p.tag.style.transform = `translate(${t.tx.toFixed(1)}px, ${clamp(t.ty, 2, Math.max(2, H - t.h - 4)).toFixed(1)}px)`;

      // Neue erst an ihren Platz setzen, dann einblenden
      if (fresh.length) {
        void this._el.planes.offsetWidth;
        for (const p of fresh) {
          p.el.style.transition = p.s.style.transition = p.tag.style.transition = p.hit.style.transition = '';
          p.fresh = false;
          if (p.show && p.altNow < 5000 && p.slant < 8) this._noticeCritter(p.x, true);
        }
      }
      for (const p of this._planes.values()) {
        p.el.classList.toggle('on', !!p.show);
        p.tag.classList.toggle('on', !!p.show);
        p.hit.classList.toggle('on', !!p.show);
      }
    }

    // Überdecken dürfen sich zwei Flieger etwas, deckungsgleich sollen sie nie stehen (etwa Anflug und Abflug auf
    // derselben Linie in gleicher Höhe, die sich begegnen). Wer sich im Bild nahe kommt, weicht senkrecht aus:
    // ab Berührung der Flügelspitzen langsam, ab halber Breite voll, bis die Mitten 0,7 Flugzeughöhen auseinander
    // liegen. Die Reihenfolge oben/unten bleibt wie beim letzten Mal, sonst tauschen gleich hohe die Plätze.
    _planeSpread(list, H) {
      for (const o of list) {
        o.dy = 0;
        o.hw = H * 0.15 * o.sc;
        o.hh = H * 0.06 * o.sc;
      }
      list.sort((a, b) => a.y + (a.p.dy || 0) - (b.y + (b.p.dy || 0)));
      const top = H * 0.1;
      const bot = H * 0.52;
      for (let k = 0; k < 4; k++) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            const wx = a.hw + b.hw;
            const dx = Math.abs(a.x - b.x);
            if (dx >= wx) continue;
            const need = 0.7 * (a.hh + b.hh) * Math.min(1, 2 * (1 - dx / wx));
            const gap = b.y + b.dy - (a.y + a.dy);
            if (gap >= need) continue;
            // je zur Hälfte; stößt einer an den Himmelsrand, schiebt die nächste Runde den anderen weiter
            a.dy = Math.max(a.dy - (need - gap) / 2, top - a.y);
            b.dy = Math.min(b.dy + (need - gap) / 2, bot - b.y);
          }
        }
      }
      for (const o of list) {
        o.p.dy = o.dy;
        o.y += o.dy;
      }
    }

    // Tief und nah genug zum Hinschauen (jedes Flugzeug höchstens zweimal)
    _planeToWatch() {
      if (this._asleep || this._inside || this._lift > 0) return null;
      let best = null;
      for (const p of this._planes.values()) {
        if (!p.show || p.gone || p.x < 0 || p.x > this._W || (p.watched || 0) >= 2) continue;
        if (p.altNow < 5000 && p.slant < 8 && (!best || p.slant < best.slant)) best = p;
      }
      return best;
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
          bearing: windDeg(a.wind_bearing),
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
        chilly: raw.temp != null && raw.temp < 12, // Ofen an, Schornstein raucht
        snowcover: raw.cond === 'snowy' || (raw.cond === 'snowy-rainy' && raw.temp != null && raw.temp <= 0),
      };
      fx.wet = fx.rain > 0 || fx.flash; // Blatt als Regenschirm
      fx.shelter = fx.storm; // bei Starkregen und Gewitter bleibt er vor seinem Bau
      // Windrichtung = woher der Wind kommt. Aus Westen ziehen Wolken nach Osten, im Bild also nach links.
      const fromWest = !(raw.bearing > 0 && raw.bearing < 180);
      this._wind = raw.wind;
      this._windDir = fromWest ? -1 : 1; // wohin der Wind im Bild weht (Drachen)
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
      sc.toggle('chilly', fx.chilly);
      sc.toggle('wind-w', fromWest);
      const st = this._el.scene.style;
      const lean = Math.min(raw.wind * 0.7, 28) * (fromWest ? -1 : 1);
      st.setProperty('--cs', clamp(1.3 - raw.wind / 35, 0.3, 1.3).toFixed(2));
      st.setProperty('--slant', `${lean.toFixed(1)}deg`);
      st.setProperty('--sw1', fromWest ? '-14deg' : '-2deg');
      st.setProperty('--sw2', fromWest ? '2deg' : '14deg');
      st.setProperty('--smx', `${((fromWest ? -1 : 1) * (4 + Math.min(raw.wind, 40) / 4)).toFixed(1)}px`);
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

    // ==================== Haus-Bote: Methoden ====================
    // Waschmaschine, Trockner, Spülmaschine aus `appliances`. Jedes Gerät hat ein Requisit am Bau (.hb in .props),
    // das seine Phase zeigt: run (läuft), done (fertig, noch zu), empty (ausgeräumt, 20 Minuten).
    // "Ausgeräumt" nur nach einem echten Programmende: live (fertig → ready/inactive, oder Tür bei "fertig" auf;
    // der Pika räumt sichtbar auf), läuft → aus kurz vor Schluss, und nach dem Neuladen nur, wenn last_changed und
    // Fortschritt/Endzeit plausibel ein Programmende zeigen. Einschalten, Abbruch und Ausfälle zählen nicht.

    _hassBote(hass) {
      const B = this._boteSync();
      if (!B.list.length) return;
      const S = hass.states;
      const now = Date.now();
      for (const a of B.list) {
        const c = a.cfg;
        const o = [S[c.state], c.progress && S[c.progress], c.end && S[c.end], c.door && S[c.door]];
        if (a.seen && o.every((v, i) => v === a.objs[i])) continue;
        a.objs = o;
        this._boteRead(a, o, now);
      }
    }

    _attachBote() {
      if (this._boteSync().list.length) this._boteRefresh();
    }

    _detachBote() {
      if (!this._bote) return;
      this._boteFxClear();
      for (const a of this._bote.list) this._boteTag(a, false);
    }

    _hiddenBote(hidden) {
      if (!hidden && this._bote?.list.length) this._boteRefresh();
    }

    _layoutBote(first) {
      const B = this._boteSync();
      if (!B.list.length || !this._g) return;
      for (const a of B.list) this._boteRender(a, true);
      this._boteLayout();
    }

    _tickBote() {
      const B = this._boteSync();
      if (!B.list.length) return;
      // Live-Aufräumen, das der Pika nicht innerhalb von 3 Minuten geschafft hat: einfach ausgeräumt zeigen
      const now = Date.now();
      for (const a of B.queue) if (now - a.liveAt > 180000) a.live = false;
      B.queue = B.queue.filter((a) => a.live);
      this._boteRefresh();
    }

    _boteActs(ctx) {
      const B = this._bote;
      if (!B?.list.length || !this._g) return [];
      B.queue = B.queue.filter((a) => a.live && a.phase === 'empty');
      if (B.queue.length) return [[1000, 'boteEmpty']];
      const now = Date.now();
      const acts = [];
      // Fertig und noch zu: alle 3–6 Minuten hinhoppeln und Bescheid sagen
      if (B.list.some((a) => a.phase === 'done' && a.el && !a.live && now >= a.nudgeAt)) acts.push([8, 'boteNudge']);
      // Läuft: ab und zu damit beschäftigen, höchstens alle 2 Minuten
      if (now - B.runAt > 120000) {
        for (const a of B.list) if (a.phase === 'run' && a.el && !BOTE_HALT.has(a.st)) acts.push([0.6, BOTE_ACT[a.type]]);
      }
      return acts;
    }

    // ---------- Haus-Bote: Zustand ----------

    // Geräteliste aus der Konfiguration; ändert sie sich, fängt alles neu an. Ohne Geräte entsteht kein Element.
    _boteSync() {
      const cfg = this._cfg?.appliances;
      const B0 = this._bote;
      if (B0 && B0.ref === cfg) return B0;
      const key = Array.isArray(cfg) && cfg.length ? JSON.stringify(cfg) : '';
      if (B0 && B0.key === key) {
        B0.ref = cfg;
        return B0;
      }
      if (B0) this._boteDrop(B0);
      const list = [];
      if (key) {
        cfg.forEach((c, i) => {
          const type = BOTE_TYPE[String(c?.type || '').toLowerCase().replace(/[\s_-]/g, '')];
          if (!type || !c.state) return;
          list.push({ idx: i, type, cfg: c, name: String(c.name || BOTE_NAME[type]), phase: null, view: null, nudgeAt: 0, objs: [] });
        });
        // Zwei Geräte gleichen Typs ohne eigenen Namen: durchnummerieren, damit die Fähnchen eindeutig sind
        for (const t of Object.keys(BOTE_NAME)) {
          const same = list.filter((a) => a.type === t && !a.cfg.name);
          if (same.length > 1) same.forEach((a, n) => (a.name = `${BOTE_NAME[t]} ${n + 1}`));
        }
      }
      this._bote = { ref: cfg, key, list, queue: [], runAt: 0, f: null, t: null };
      return this._bote;
    }

    _boteDrop(B) {
      // Eine laufende Bote-Aktion hängt an den alten Geräten und Ebenen: abbrechen
      if (this._action?.startsWith('bote')) this._interrupt();
      cancelAnimationFrame(this._boteRaf);
      for (const a of B.list) {
        clearTimeout(a.tagT);
        a.el?.remove();
        a.bar?.remove();
        a.tag?.remove();
      }
      B.bars?.remove();
      B.f?.remove();
      B.t?.remove();
    }

    // Neue Zustände eines Geräts lesen. Home Connect bleibt nach Programmende auf "finished", bis die Tür
    // aufgeht, dann "ready", später "inactive"; andere Hersteller über BOTE_ALIAS. "Ausgeräumt" gilt nur nach
    // einem echten Programmende (fertig → aus, Tür bei "fertig" geöffnet, oder läuft → aus kurz vor Schluss),
    // nicht beim Einschalten, Abbrechen oder Löschen der Startvorwahl. Ohne echten Zustand (unavailable,
    // unknown) bleibt das Gerät, wie es war.
    _boteRead(a, [st, pr, en, dr], now) {
      const norm = (v) => String(v ?? '').split('.').pop().toLowerCase().replace(/[\s_-]/g, '');
      const lc = (o) => Math.min(now, Date.parse(o?.last_changed) || Date.parse(o?.last_updated) || now);
      const first = !a.seen;
      a.seen = true;
      const raw = norm(st?.state);
      const s = BOTE_ALIAS[raw] || raw;
      const dead = BOTE_DEAD.has(s);
      this._boteWarn(a, st, s, dead, [pr, en, dr]);
      const pct = this._botePct(pr);
      const end = this._boteEnd(en, now);
      const doorDead = !dr || BOTE_DEAD.has(norm(dr.state));
      const door = doorDead ? !!a.door : ['open', 'on', 'opened', 'offen', 'auf', 'ajar'].includes(norm(dr.state));
      const doorAt = doorDead ? now : lc(dr);
      const prevSt = a.st;
      const prevPct = a.pct;
      const prevEnd = a.end;
      const prevDoor = !!a.door;
      const prevOpened = !!a.opened;
      // Ausfall: alter Zustand gilt weiter (keine neue Phase, kein neues Stupsen), gültige Werte kommen trotzdem an
      const cur = dead && !first ? prevSt : s;
      const stChanged = first || cur !== prevSt;
      Object.assign(a, {
        st: cur, door,
        changed: stChanged && !dead ? lc(st) : a.changed ?? now,
        pct: pct ?? (dead ? prevPct : null),
        end: end ?? (dead ? prevEnd : null),
      });
      if (cur !== 'finished') a.opened = false;
      else if (stChanged) {
        a.finAt = a.changed;
        a.opened = false;
      }
      // Frist für "ausgeräumt" (emptyUntil): 0 = keine, null = läuft/fertig
      const idle = BOTE_IDLE.has(cur);
      let live = false;
      if (first) {
        if (BOTE_RUN.has(cur)) a.emptyUntil = null;
        else if (cur === 'finished') {
          // Tür später als 2 Minuten nach Programmende geöffnet: ausgeräumt
          a.opened = door && !doorDead && doorAt - a.finAt > BOTE_AUTOOPEN_MS;
          a.emptyUntil = a.opened ? doorAt + BOTE_EMPTY_MS : null;
        } else if (idle) {
          // Nach dem Neuladen nur, wenn es plausibel ein Programmende war: Fortschritt steht noch auf (fast) 100,
          // oder (ohne Fortschritt) eine gültige Endzeit hat sich um dieselbe Zeit geändert. Im Zweifel nicht (auch
          // nicht nach einem HA-Neustart, der alle last_changed gleichsetzt).
          const near = [pr, en].some((o) => o && !BOTE_DEAD.has(norm(o.state)) && Math.abs(lc(o) - a.changed) <= 5 * 60000);
          a.emptyUntil = (pct != null ? pct >= 95 : near) ? a.changed + BOTE_EMPTY_MS : 0;
        } else a.emptyUntil = 0;
      } else if (BOTE_RUN.has(cur)) a.emptyUntil = null;
      else if (cur === 'finished') {
        if (stChanged) a.emptyUntil = null;
        // Tür bei "fertig" geöffnet (nicht der AutoOpen-Spalt direkt am Programmende): gilt als ausgeräumt, bis der
        // Zustand "fertig" verlässt; Tür wieder zu ändert daran nichts
        else if (door && !prevDoor && !a.opened && now - a.finAt > BOTE_AUTOOPEN_MS) {
          a.opened = true;
          a.emptyUntil = now + BOTE_EMPTY_MS;
          live = true;
        }
      } else if (stChanged) {
        const ended = (prevPct == null && prevEnd == null) || (prevPct != null && prevPct >= 95)
          || (prevEnd != null && Math.abs(prevEnd - a.changed) < 10 * 60000);
        if (idle && prevSt === 'finished') {
          // schon beim Türöffnen gewertet: die Frist läuft weiter
          if (!prevOpened) {
            a.emptyUntil = now + BOTE_EMPTY_MS;
            live = true;
          }
        } else if (idle && prevSt === 'run' && ended) {
          a.emptyUntil = a.changed + BOTE_EMPTY_MS;
        } else if (a.emptyUntil == null) {
          // Abbruch, Einschalten, ready → inactive …: keine neue Frist, eine laufende behält ihr Ende
          a.emptyUntil = 0;
        }
      }
      const ph = this._botePhase(a, now);
      const from = a.phase;
      if (ph !== from) {
        a.phase = ph;
        if (ph === 'done') a.nudgeAt = now + (first ? rnd(20000, 60000) : rnd(5000, 12000));
        if (ph !== 'empty') a.live = false;
        // Programm vorbei, während er gerade damit spielt: aufhören
        if (from === 'run' && this._action === BOTE_ACT[a.type]) this._interrupt();
        if (live && from === 'done' && ph === 'empty') this._boteLive(a);
      }
      this._boteRender(a);
    }

    _botePhase(a, now) {
      if (BOTE_RUN.has(a.st)) return 'run';
      if (a.st === 'finished' && !a.opened) return 'done';
      return a.emptyUntil && now < a.emptyUntil ? 'empty' : null;
    }

    // Einmal je Seite und Grund melden (auch bei mehreren Karten): Entity fehlt oder Zustand unbekannt
    _boteWarn(a, st, s, dead, more) {
      const c = a.cfg;
      const msgs = [];
      if (!st) msgs.push(`Entity ${c.state} nicht gefunden`);
      else if (!dead && !BOTE_RUN.has(s) && !BOTE_IDLE.has(s) && s !== 'finished') msgs.push(`unbekannter Zustand "${st.state}" von ${c.state}`);
      ['progress', 'end', 'door'].forEach((k, i) => c[k] && !more[i] && msgs.push(`Entity ${c[k]} nicht gefunden`));
      for (const m of msgs) {
        if (BOTE_WARNED.has(m)) continue;
        BOTE_WARNED.add(m);
        console.warn(`pika-pet-card Haus-Bote: ${m}`);
      }
    }

    // Fortschritt in %; ohne Einheit "%" gilt ein Wert über 0 bis 1 als Anteil (0.45 → 45 %)
    _botePct(pr) {
      let v = Number.parseFloat(pr?.state);
      if (!Number.isFinite(v)) return null;
      if (pr.attributes?.unit_of_measurement !== '%' && v > 0 && v <= 1) v *= 100;
      return clamp(v, 0, 100);
    }

    // Endzeit: Zeitstempel, oder Restzeit als Zahl (Einheit s/min/h aus unit_of_measurement, sonst Minuten) bzw.
    // als h:mm(:ss). Nur Werte von jetzt −1 h bis +24 h zählen, alles andere (z. B. "83" als Jahr) wird ignoriert.
    _boteEnd(en, now) {
      const v = String(en?.state ?? '').trim();
      if (BOTE_DEAD.has(v.toLowerCase())) return null;
      const base = Math.min(now, Date.parse(en.last_changed) || Date.parse(en.last_updated) || now);
      let t;
      if (/^-?\d+(\.\d+)?$/.test(v)) {
        const u = String(en.attributes?.unit_of_measurement || 'min').toLowerCase();
        t = base + Number(v) * ({ ms: 1, s: 1e3, sec: 1e3, m: 6e4, min: 6e4, h: 36e5, d: 864e5 }[u] ?? 6e4);
      } else if (/^\d+:\d\d(:\d\d)?$/.test(v)) {
        const [h, m, sec = 0] = v.split(':').map(Number);
        t = base + ((h * 60 + m) * 60 + sec) * 1000;
      } else t = Date.parse(v);
      return Number.isFinite(t) && t >= now - 36e5 && t <= now + 864e5 ? t : null;
    }

    // Zeitabhängiges neu bewerten (Frist abgelaufen, "fertig seit …"), Wind für die Wäscheleine
    _boteRefresh() {
      const B = this._bote;
      if (!B?.list.length) return;
      const now = Date.now();
      for (const a of B.list) {
        if (!a.seen) continue;
        const ph = this._botePhase(a, now);
        if (ph !== a.phase) {
          a.phase = ph;
          if (ph !== 'empty') a.live = false;
        }
        this._boteRender(a, true);
      }
      this._boteLayout();
    }

    // Gerade live ausgeräumt: Der Pika räumt sichtbar auf, wenn man zuschaut und er wach ist
    _boteLive(a) {
      if (!this._g || !this._attached || document.hidden || this._asleep) return;
      const B = this._bote;
      a.live = true;
      a.liveAt = Date.now();
      if (!B.queue.includes(a)) B.queue.push(a);
      if (this._running && !this._wx.shelter && !this._next
        && !['eatFood', 'goSleep', 'wakeUp', 'poop', 'boteEmpty'].includes(this._action)) this._interrupt();
    }

    _boteText(a) {
      // Uhrzeit in der Zeitzone, die HA im Profil eingestellt hat (Server- oder Browserzeit)
      const hs = this._hass;
      const tz = hs?.locale?.time_zone === 'server' ? hs.config?.time_zone : undefined;
      const hm = (t) => {
        const o = { hour: '2-digit', minute: '2-digit' };
        try {
          return new Date(t).toLocaleTimeString('de-DE', tz ? { ...o, timeZone: tz } : o);
        } catch (e) {
          return new Date(t).toLocaleTimeString('de-DE', o); // unbekannte Zeitzone
        }
      };
      if (a.phase === 'run') {
        const p = [];
        const s = a.st;
        const label = { pause: 'Pause', delayedstart: 'Startvorwahl', actionrequired: 'braucht Hilfe', error: 'Störung', aborting: 'bricht ab' }[s];
        if (label) p.push(label);
        if (a.pct != null && s !== 'delayedstart') p.push(`${Math.round(a.pct)} %`);
        else if (!p.length) p.push('läuft');
        if (a.end && s !== 'aborting') p.push(`fertig um ${hm(a.end)}`);
        return p.join(' · ');
      }
      if (a.phase === 'done') {
        const m = Math.floor((Date.now() - a.changed) / 60000);
        if (m < 1) return 'gerade fertig';
        return `fertig seit ${m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min` : ''}`}`;
      }
      return 'ausgeräumt';
    }

    // ---------- Haus-Bote: Requisiten ----------

    // Ebenen in .props: Requisiten, davor die Fortschrittsbalken (.hb-bars ohne eigenen Stapelkontext, damit vordere
    // Balken mit ihrem Requisit vor den Pika kommen), Werkzeug/Getragenes (.hb-f) und Fähnchen (.hb-t)
    _boteLayers() {
      const B = this._bote;
      if (B.f) return;
      B.bars = document.createElement('div');
      B.bars.className = 'hb-bars';
      B.f = document.createElement('div');
      B.f.className = 'hb-f';
      B.t = document.createElement('div');
      B.t.className = 'hb-t';
      this._el.props.append(B.bars, B.f, B.t);
    }

    // Requisit an die Phase angleichen. Beim Live-Aufräumen bleibt das Bild davor stehen (Wäsche im Korb,
    // Handtuchstapel, Tellerstapel), bis der Pika fertig ist.
    _boteRender(a, noLayout) {
      if (!this._g || !this._el) return;
      const view = a.phase && a.live ? (a.type === 'washer' ? 'empty' : 'done') : a.phase;
      if (!view) {
        if (a.el) {
          const { el, bar } = a;
          a.el = a.bar = a.spec = a.view = null;
          el.classList.add('hb-bye');
          bar.classList.remove('on');
          setTimeout(() => (el.remove(), bar.remove()), 600);
          this._boteTag(a, false);
          if (!noLayout) this._boteLayout();
        }
        return;
      }
      this._boteLayers();
      let relayout = false;
      if (!a.el) {
        const el = document.createElement('div');
        el.className = `hb hb-${a.type}`;
        el.setAttribute('role', 'button');
        el.innerHTML = '<div class="hb-i"></div><span class="hb-a">!</span>';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this._boteTag(a, !a.tag?.classList.contains('open'));
        });
        this._el.props.insertBefore(el, this._bote.bars);
        const bar = document.createElement('div');
        bar.className = 'hb-bar';
        bar.innerHTML = '<b></b>';
        bar.style.setProperty('--bc', BOTE_COLOR[a.type]);
        this._bote.bars.appendChild(bar);
        a.el = el;
        a.bar = bar;
      }
      const el = a.el;
      if (view !== a.view) {
        a.view = view;
        a.spec = BOTE_SVG[a.type](view, a.idx);
        el.firstElementChild.innerHTML = `<svg viewBox="${a.spec.vb.join(' ')}" aria-hidden="true">${a.spec.svg}</svg>`;
        el.classList.remove('hb-in', 'hb-emptied', 'hb-boop');
        void el.offsetWidth;
        el.classList.add('hb-in');
        clearTimeout(a.inT);
        a.inT = setTimeout(() => el.classList.remove('hb-in'), 650);
        relayout = true;
      }
      const cl = el.classList;
      for (const p of ['run', 'done', 'empty']) cl.toggle(`hb-${p}`, view === p);
      cl.toggle('hb-live', !!a.live);
      cl.toggle('hb-hang', !!a.live && a.type === 'washer');
      if (!a.live) cl.remove('hb-emptied');
      const halt = view === 'run' && BOTE_HALT.has(a.st);
      cl.toggle('hb-pause', halt);
      cl.toggle('hb-alert', view === 'run' && (a.st === 'error' || a.st === 'actionrequired'));
      // Ruhe, solange der Pika schläft, und nachts außer bei laufenden Geräten (schwaches Tablet)
      const still = !!this._asleep || (view !== 'run' && this._el.scene.classList.contains('night'));
      cl.toggle('hb-still', still);
      // Wind: Richtung aus dem Wetter, Stärke macht das Wehen weiter und schneller
      const wind = this._wind || 0;
      el.style.setProperty('--hbw', `${(-(this._windDir || -1) * clamp(3 + wind / 3.5, 3, 18)).toFixed(1)}deg`);
      el.style.setProperty('--hbs', `${clamp(2.6 - wind / 25, 0.8, 2.6).toFixed(2)}s`);
      const bar = a.bar;
      bar.classList.toggle('on', view === 'run');
      bar.classList.toggle('ind', a.pct == null);
      bar.classList.toggle('pause', halt);
      bar.classList.toggle('hb-still', still);
      if (a.pct != null) bar.style.setProperty('--p', `${a.pct.toFixed(1)}%`);
      const text = this._boteText(a);
      el.setAttribute('aria-label', `${a.name}: ${text}`);
      if (a.tag?.classList.contains('open')) this._boteTagText(a);
      if (relayout && !noLayout) this._boteLayout();
    }

    // Alle Geräte stehen nebeneinander ganz vorn links am unteren Rand (näher am Betrachter, also etwas größer und
    // vor dem Pika), in der Reihenfolge der Konfiguration. Reicht der Platz bis zum Futterknopf nicht, werden alle
    // gemeinsam gleich stark kleiner. Setzt nur Positionen und tut nichts, wenn sich nichts ändert.
    _boteLayout() {
      const B = this._bote;
      if (!this._g || !this._el || !B?.list.length) return;
      const row = B.list.filter((a) => a.el && a.spec).sort((x, y) => x.idx - y.idx);
      if (!row.length) return;
      const H = this._H;
      const W = this._W;
      const left = 6;
      const right = W - 60; // Futterknopf rechts unten
      const gap = 0.02 * H;
      // die hohe Wäscheleine steht vorn deutlich kleiner, sonst überragt sie den Pika
      const w1 = row.map((a) => a.spec.vb[2] * BOTE_K * H * BOTE_FRONT * (a.spec.back ? BOTE_TALL : 1));
      const sum = w1.reduce((t, w) => t + w, 0);
      const k = clamp((right - left - gap * (row.length - 1)) / sum, 0.4, 1);
      let x = left;
      const out = row.map((a, i) => {
        const p = { a, l: x, w: w1[i] * k };
        x += p.w + gap;
        return p;
      });
      const sig = `${W}x${H}|${out.map((p) => `${p.a.idx}${p.a.view}:${p.l.toFixed(1)}:${p.w.toFixed(1)}`).join('|')}`;
      if (sig === B.sig) return;
      B.sig = sig;
      for (const p of out) this._botePlace(p.a, p.l, p.w);
    }

    // Requisit vorn am unteren Rand setzen
    _botePlace(a, l, w) {
      const fr = true;
      const sp = a.spec;
      const H = this._H;
      const k = w / sp.vb[2];
      const { gy } = this._g;
      const ground = gy + BOTE_FRONT_DY * H;
      Object.assign(a, { l, k, w, fr, x: l + w / 2, top: ground - (sp.ground - sp.vb[1]) * k });
      a.vTop = this._boteY(a, sp.vt);
      const s = a.el.style;
      s.left = `${l.toFixed(1)}px`;
      s.top = `${a.top.toFixed(1)}px`;
      s.width = `${w.toFixed(1)}px`;
      a.el.classList.toggle('hb-fr', fr);
      if (!a.el.classList.contains('hb-placed')) requestAnimationFrame(() => a.el?.classList.add('hb-placed'));
      // Fortschrittsbalken immer unter dem Requisit: vorn mit kleinem Abstand unter der Grafik, hinten im
      // Grasstreifen unter dem sichtbaren Teil (dort steckt auch der Pika im Gras, seine Pfoten bleiben frei)
      const [u0, u1] = sp.part;
      const bw = Math.min((u1 - u0) * k * 0.72, H * 0.16);
      const bh = clamp(H * 0.018, 3, 6);
      const bs = a.bar.style;
      a.bar.classList.toggle('hb-fr', fr);
      bs.left = `${(this._boteX(a, (u0 + u1) / 2) - bw / 2).toFixed(1)}px`;
      const bottom = Math.max(ground, a.top + sp.vb[3] * k);
      bs.top = `${(fr ? Math.min(bottom + 0.012 * H, H - bh - 0.02 * H) : gy - 0.03 * H).toFixed(1)}px`;
      bs.width = `${bw.toFixed(1)}px`;
      if (a.tag?.classList.contains('open')) this._boteTagPos(a);
    }

    // Requisit-Einheiten → px; ist das Requisit schon weg (Phase vorbei), die Pika-Position bzw. die Bodenlinie
    _boteX(a, u) {
      return a.spec && a.k ? a.l + u * a.k : this._x;
    }

    _boteY(a, v) {
      return a.spec && a.k ? a.top + (v - a.spec.vb[1]) * a.k : this._g.gy;
    }

    // Fähnchen: Gerätename und Stand, schließt nach 9 s; liegt über Statusleiste und Futterknopf
    _boteTag(a, open) {
      clearTimeout(a.tagT);
      if (!open) {
        a.tag?.classList.remove('open');
        return;
      }
      if (!a.el) return;
      // immer nur ein Fähnchen offen, damit sie sich nicht überdecken
      for (const o of this._bote.list) if (o !== a) this._boteTag(o, false);
      if (!a.tag) {
        a.tag = document.createElement('div');
        a.tag.className = 'hb-tag';
        a.tag.addEventListener('click', (e) => (e.stopPropagation(), this._boteTag(a, false)));
        this._bote.t.appendChild(a.tag);
      }
      a.tag.classList.add('open');
      this._boteTagText(a);
      a.tagT = setTimeout(() => this._boteTag(a, false), 9000);
    }

    _boteTagText(a) {
      const html = `<b>${esc(a.name)}</b><div class="more">${esc(this._boteText(a))}</div>`;
      if (html !== a.tagHtml) {
        a.tagHtml = html;
        a.tag.innerHTML = html;
      }
      this._boteTagPos(a);
    }

    // Breite erst an der linken Kante messen (sonst begrenzt die alte Lage die Breite), dann über dem Requisit
    // mittig, aber ganz in der Karte; breiter als die Karte geht es dank max-width und … nicht
    _boteTagPos(a) {
      if (!a.tag || !a.el || !this._g) return;
      const ts = a.tag.style;
      ts.left = '0px';
      const w = Math.min(a.tag.offsetWidth, this._W - 8);
      const h = a.tag.offsetHeight;
      ts.left = `${clamp(a.x - w / 2, 4, Math.max(4, this._W - w - 4)).toFixed(1)}px`;
      ts.top = `${clamp(a.vTop - h - 6, 2, Math.max(2, this._H - h - 4)).toFixed(1)}px`;
    }

    // ---------- Haus-Bote: Aktionen ----------

    // Ziel-Gerät: Wunsch aus der Vorschau (_boteFocus = Typ oder Index), sonst das erste passende; beim Beschäftigen
    // mit laufenden Geräten keins, das gerade pausiert, auf den Start wartet oder eine Störung hat
    _boteFind(type, phase) {
      const f = this._boteFocus;
      this._boteFocus = null;
      const ok = (a) => a.el && a.spec && a.phase === phase && !a.live && (!type || a.type === type)
        && !(phase === 'run' && BOTE_HALT.has(a.st));
      const list = this._bote?.list || [];
      return list.find((a) => ok(a) && f != null && (a.type === f || a.idx === f)) || list.find(ok) || null;
    }

    // Standplatz neben einem Bereich L..R im Abstand off (px, von der Pika-Mitte): die nähere Seite, wenn dort Platz ist
    _boteSpot(L, R, off) {
      const { pW } = this._g;
      const lo = pW * 0.45;
      const hi = this._W - pW * 0.45;
      const xl = L - off;
      const xr = R + off;
      const cur = this._liveX();
      let face = Math.abs(cur - xl) <= Math.abs(cur - xr) ? 1 : -1;
      if (face > 0 && xl < lo) face = -1;
      else if (face < 0 && xr > hi) face = 1;
      return { x: face > 0 ? xl : xr, face };
    }

    _boteCls(...names) {
      this._boteC ??= new Set();
      for (const n of names) {
        this._boteC.add(n);
        this._el.pika.classList.add(n);
      }
    }

    _boteUncls() {
      for (const n of this._boteC || []) this._el.pika.classList.remove(n);
      this._boteC?.clear();
    }

    // Tätscheln/Stupsen: nach vorn lehnen, das Requisit wackelt
    _botePat(a, boop = true) {
      const p = this._el.pika;
      p.classList.remove('hb-pat');
      void p.offsetWidth;
      this._boteCls('hb-pat');
      if (boop && a.el) {
        a.el.classList.remove('hb-boop');
        void a.el.offsetWidth;
        a.el.classList.add('hb-boop');
      }
    }

    _boteFxClear() {
      cancelAnimationFrame(this._boteRaf);
      this._boteRaf = 0;
      this._bote?.f?.querySelectorAll('.hb-fx').forEach((e) => e.remove());
    }

    // Effekt in die vordere Ebene; false, wenn es sie nicht (mehr) gibt (Konfiguration gewechselt)
    _boteFx(...els) {
      const f = this._bote?.f;
      if (!f) return false;
      f.append(...els);
      return true;
    }

    _boteBubbles(x, y, n) {
      for (let i = 0; i < n; i++) {
        const b = document.createElement('span');
        b.className = 'hb-bbl hb-fx';
        b.style.left = `${(x + rnd(-0.025, 0.025) * this._H).toFixed(1)}px`;
        b.style.top = `${y.toFixed(1)}px`;
        b.style.setProperty('--dx', `${rnd(-8, 8).toFixed(1)}px`);
        b.style.animationDelay = `${i * 140}ms`;
        if (!this._boteFx(b)) return;
        setTimeout(() => b.remove(), 1300 + i * 140);
      }
    }

    // Etwas, das der Pika trägt: folgt ihm bei jedem Bild (Hoppeln und Sprünge eingerechnet).
    // rx/ry = Haltepunkt in Anteilen der Pika-Grafik (Pfoten 0.758/0.6, Maul 0.9/0.6), size = Breite × Kartenhöhe
    _boteCarry(svg, rx, ry, size) {
      const el = document.createElement('div');
      el.className = 'hb-carry hb-fx';
      el.style.setProperty('--cw', `${(this._H * size).toFixed(1)}px`);
      el.innerHTML = `<i>${svg}</i>`;
      this._boteFx(el);
      const hop = this.shadowRoot.querySelector('.hop');
      const ty = (e) => {
        const t = e && getComputedStyle(e).transform;
        return t && t !== 'none' ? new DOMMatrixReadOnly(t).m42 : 0;
      };
      cancelAnimationFrame(this._boteRaf);
      const step = () => {
        if (!el.isConnected || !this._g) return;
        const { pW, pH, gy } = this._g;
        const d = this._dir;
        const x = this._liveX() + d * (rx - 0.5) * pW;
        const y = gy - 0.945 * pH + ry * pH - this._liveLift() + ty(hop) + ty(this._el.jump);
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${d})`;
        this._boteRaf = requestAnimationFrame(step);
      };
      step();
      return el;
    }

    // Rührstock von der Pfote (px, py) schräg in den Schaum (tx, ty), mit Schaumkragen
    _boteStick(px, py, tx, ty) {
      const len = Math.hypot(px - tx, py - ty) + this._H * 0.025;
      const s = document.createElement('div');
      s.className = 'hb-stick hb-fx';
      s.style.left = `${tx.toFixed(1)}px`;
      s.style.top = `${(ty - len).toFixed(1)}px`;
      s.style.height = `${len.toFixed(1)}px`;
      s.style.setProperty('--ba', `${((Math.atan2(px - tx, ty - py) * 180) / Math.PI).toFixed(1)}deg`);
      const r = document.createElement('div');
      r.className = 'hb-ring hb-fx';
      r.style.left = `${tx.toFixed(1)}px`;
      r.style.top = `${ty.toFixed(1)}px`;
      this._boteFx(s, r);
    }

    // Waschmaschine läuft: hinter dem Zuber stehen und umrühren, dann landet eine Seifenblase auf der Nase
    async _boteStir() {
      const a = this._boteFind('washer', 'run');
      if (!a) return;
      this._bote.runAt = Date.now();
      const { pW, pH, gy } = this._g;
      const H = this._H;
      const tc = this._boteX(a, 23);
      const s = this._boteSpot(tc, tc, 0.258 * pW + 0.012 * H);
      await this._walkTo(s.x, 0.9);
      this._face(s.face);
      const p = this._el.pika;
      try {
        await this._wait(250);
        if (!a.el) return;
        a.el.classList.add('hb-busy');
        this._boteCls('hb-stir');
        const px = this._x + s.face * 0.258 * pW;
        this._boteStick(px, gy - 0.335 * pH - this._lift, tc + s.face * 0.012 * H, this._boteY(a, 16.8));
        const until = Date.now() + rnd(4500, 7000);
        while (Date.now() < until) {
          await this._wait(rnd(1300, 2100));
          if (a.el) this._boteBubbles(tc, this._boteY(a, 14), 2);
          if (Math.random() < 0.3) this._say(pick(['rühr, rühr…', 'blubb!', 'schaumig!']), 1100);
        }
        this._boteFxClear();
        this._boteUncls();
        a.el?.classList.remove('hb-busy');
        if (!a.el) return;
        // Seifenblase steigt aus dem Schaum, schwebt hoch und landet auf der Nase
        const nx = this._x + s.face * 0.258 * pW;
        const ny = gy - 0.42 * pH - this._lift;
        const fx = tc;
        const fy = this._boteY(a, 13);
        const b = document.createElement('div');
        b.className = 'hb-soap hb-fx';
        b.innerHTML = '<i></i>';
        this._boteFx(b);
        b.animate([
          { transform: `translate(${fx}px, ${fy}px) scale(.3)`, opacity: 0 },
          { transform: `translate(${(fx + nx) / 2 + rnd(-6, 6)}px, ${Math.min(fy, ny) - H * 0.12}px) scale(.9)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${nx}px, ${ny}px) scale(1)`, opacity: 1 },
        ], { duration: 2200, easing: 'ease-in-out', fill: 'forwards' });
        p.classList.add('look-up');
        await this._wait(1300);
        p.classList.remove('look-up');
        await this._wait(900);
        this._blink();
        await this._wait(900);
        this._twitch();
        await this._wait(500);
        b.classList.add('pop');
        this._peep(nx, ny - H * 0.06, 'plopp!');
        this._jump('hop1');
        await this._wait(400);
        this._say(pick(['hihi!', 'hatschi!', 'hihi']), 1200);
        await this._wait(1500);
      } finally {
        a.el?.classList.remove('hb-busy');
        p.classList.remove('look-up');
        this._boteFxClear();
        this._boteUncls();
      }
    }

    // Trockner läuft: der Trommel zuschauen, oft im Liegen; Augen und Kopf drehen mit
    async _boteWatchDrum() {
      const a = this._boteFind('dryer', 'run');
      if (!a) return;
      this._bote.runAt = Date.now();
      const { pW } = this._g;
      const s = this._boteSpot(this._boteX(a, 6), this._boteX(a, 40), 0.55 * pW);
      await this._walkTo(s.x, 0.8);
      this._face(s.face);
      const p = this._el.pika;
      try {
        p.classList.add('look-f');
        await this._wait(rnd(800, 1400));
        this._boteCls('hb-drum');
        if (Math.random() < 0.6) {
          p.classList.add('lying');
          await this._wait(500);
        }
        const until = Date.now() + rnd(7000, 12000);
        while (Date.now() < until) {
          await this._wait(rnd(1500, 3000));
          const r = Math.random();
          if (r < 0.25) this._say(pick(['rundherum…', 'hui!', 'oh!', 'Socken!']), 1100);
          else if (r < 0.45) this._twitch();
        }
        this._boteUncls();
        p.classList.remove('lying');
        await this._wait(500);
        if (Math.random() < 0.3) this._say('*gähn*', 1200);
        else this._jump('hop1');
        await this._wait(900);
      } finally {
        p.classList.remove('lying', 'look-f');
        this._boteUncls();
      }
    }

    // Spülmaschine läuft: hinter dem Tisch einen Teller ein paarmal in die Schüssel tunken
    async _boteDip() {
      const a = this._boteFind('dishwasher', 'run');
      if (!a) return;
      this._bote.runAt = Date.now();
      const { pW, pH, gy } = this._g;
      const H = this._H;
      const bc = this._boteX(a, 22);
      const s = this._boteSpot(bc, bc, 0.258 * pW);
      await this._walkTo(s.x, 0.9);
      this._face(s.face);
      try {
        await this._wait(250);
        if (!a.el) return;
        a.el.classList.add('hb-busy');
        this._boteCls('hb-hold');
        const px = this._x + s.face * 0.258 * pW;
        const py = gy - 0.335 * pH - this._lift;
        const wy = this._boteY(a, 19.6);
        const r = 0.032 * H;
        const top = py - 2.4 * r;
        const w = document.createElement('div');
        w.className = 'hb-dipw hb-fx';
        Object.assign(w.style, { left: `${px - 1.5 * r}px`, top: `${top}px`, width: `${3 * r}px`, height: `${Math.max(r, wy - top)}px` });
        w.innerHTML = `<i style="left:${0.5 * r}px;top:${1.4 * r}px;width:${2 * r}px">${BOTE_PLATE_SVG}</i>`;
        this._boteFx(w);
        const plate = w.firstElementChild;
        const deep = `translateY(${(wy - py + 1.25 * r).toFixed(1)}px)`;
        const n = 2 + Math.floor(rnd(0, 2));
        for (let i = 0; i < n; i++) {
          await this._wait(rnd(500, 900));
          plate.animate([{ transform: 'none' }, { transform: `${deep} rotate(-10deg)` }, { transform: 'none' }], { duration: 1200, easing: 'ease-in-out' });
          await this._wait(600);
          this._boteBubbles(px, wy, 3);
          if (i === 0) this._say(pick(['blubb!', 'plitsch!']), 900);
          await this._wait(600);
        }
        this._say(pick(['sauber!', 'blitzblank!', 'hihi']), 1100);
        await this._wait(700);
        // zurück in die Schüssel
        plate.animate([{ transform: 'none' }, { transform: deep }], { duration: 600, easing: 'ease-in', fill: 'forwards' });
        await this._wait(650);
        this._boteBubbles(px, wy, 2);
        await this._wait(700);
      } finally {
        a.el?.classList.remove('hb-busy');
        this._boteFxClear();
        this._boteUncls();
      }
    }

    // Fertig: hinhoppeln, tätscheln/stupsen, zum Betrachter schauen und Bescheid sagen
    async _boteNudge() {
      const B = this._bote;
      const f = this._boteFocus;
      this._boteFocus = null;
      const done = (B?.list || []).filter((o) => o.phase === 'done' && o.el && !o.live);
      const a = done.find((o) => f != null && (o.type === f || o.idx === f))
        || done.sort((x, y) => x.nudgeAt - y.nudgeAt)[0];
      if (!a) return;
      const { pW } = this._g;
      const p = this._el.pika;
      let patted = false;
      try {
        const [u0, u1] = a.spec.part;
        const s = this._boteSpot(this._boteX(a, u0), this._boteX(a, u1), 0.35 * pW);
        if (Math.abs(this._liveX() - s.x) > pW) {
          this._say('!', 700);
          await this._wait(450);
        }
        await this._walkTo(s.x, 1.3);
        this._face(s.face);
        await this._wait(250);
        const n = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          if (!a.el) return;
          this._botePat(a);
          await this._wait(560);
        }
        patted = true;
        this._boteUncls();
        if (a.type === 'dryer') {
          this._say('flauschig!', 1100);
          this._happy(1000);
          await this._wait(1200);
        }
        // Kopf zum Betrachter, Maul auf: "Wäsche!"
        this._boteCls('hb-look');
        p.classList.add('calling');
        this._say(pick(BOTE_SAY[a.type]), 1600);
        this._jump('hop1');
        await this._wait(900);
        p.classList.remove('calling');
        await this._wait(1000);
        this._boteUncls();
        await this._wait(rnd(400, 900));
      } finally {
        p.classList.remove('calling');
        this._boteUncls();
        a.el?.classList.remove('hb-boop');
        a.nudgeAt = Date.now() + (patted ? rnd(3, 6) * 60000 : 30000);
      }
    }

    // Gerade ausgeräumt (live): aufhängen, Handtuch oder Teller in den Bau tragen, dann Freude
    async _boteEmpty() {
      const B = this._bote;
      if (!B?.list.length) return;
      const f = this._boteFocus;
      this._boteFocus = null;
      let a = f != null ? B.list.find((o) => (o.type === f || o.idx === f) && o.phase === 'empty' && o.el) : null;
      a ||= B.queue.find((o) => o.live && o.phase === 'empty');
      if (!a) return;
      B.queue = B.queue.filter((o) => o !== a);
      a.live = true;
      a.liveAt = Date.now();
      this._boteRender(a);
      try {
        this._say('!', 800);
        await this._wait(500);
        if (a.type === 'washer') await this._boteHang(a);
        else if (a.type === 'dryer') await this._boteTowel(a);
        else await this._botePlate(a);
        this._happy();
        this._jump('binky');
        this._say(pick(['fertig!', 'geschafft!', '♥']), 1300);
        await this._wait(1300);
      } finally {
        this._boteFxClear();
        this._boteUncls();
        a.live = false;
        this._boteRender(a);
      }
    }

    // Wäsche aus dem Korb holen und Stück für Stück an die Leine hängen (hochspringen, Klammer dran)
    async _boteHang(a) {
      if (!a.el) return;
      a.el.querySelectorAll('.hb-cl').forEach((g) => g.classList.remove('on'));
      a.el.classList.remove('hb-emptied');
      const { pW } = this._g;
      const kx = this._boteX(a, 58);
      const s = this._boteSpot(kx, kx, 0.4 * pW);
      await this._walkTo(s.x, 1.1);
      this._face(s.face);
      await this._wait(200);
      this._botePat(a, false);
      await this._wait(600);
      this._boteUncls();
      const xs = BOTE_LINE.map(([u]) => this._boteX(a, u));
      const order = this._x > this._boteX(a, 42) ? [3, 2, 1, 0] : [0, 1, 2, 3];
      for (const i of order) {
        await this._walkTo(xs[i], 1.1);
        await this._wait(150);
        this._jump('hop1');
        await this._wait(280);
        a.el?.querySelector(`.hb-c${i}`)?.classList.add('on');
        await this._wait(520);
      }
      a.el?.classList.add('hb-emptied');
      this._face(this._x < this._W / 2 ? 1 : -1);
      await this._wait(400);
    }

    // Trockner ausgeräumt: oberstes Handtuch nehmen ("flauschig!") und in den Bau tragen, der Stapel ist weg
    async _boteTowel(a) {
      if (!a.el) return;
      const { pW } = this._g;
      const s = this._boteSpot(this._boteX(a, 36), this._boteX(a, 60), 0.32 * pW);
      await this._walkTo(s.x, 1.1);
      this._face(s.face);
      await this._wait(250);
      this._botePat(a, false);
      await this._wait(500);
      this._boteUncls();
      a.el?.querySelector('.hb-t3')?.classList.add('hb-gone');
      this._boteCarry(BOTE_TOWEL_SVG, 0.9, 0.6, 0.085);
      this._say('flauschig!', 1200);
      await this._wait(800);
      a.el?.querySelectorAll('.hb-t1, .hb-t2, .hb-steam').forEach((e) => e.classList.add('hb-gone'));
      await this._boteToBurrow();
    }

    // Spülmaschine ausgeräumt: obersten Teller nehmen, polieren (funkelt) und in den Bau tragen
    async _botePlate(a) {
      if (!a.el) return;
      const { pW, pH, gy } = this._g;
      const s = this._boteSpot(this._boteX(a, 14), this._boteX(a, 36), 0.3 * pW);
      await this._walkTo(s.x, 1.1);
      this._face(s.face);
      await this._wait(250);
      this._botePat(a, false);
      await this._wait(450);
      this._boteUncls();
      a.el?.querySelector('.hb-p4')?.classList.add('hb-gone');
      this._boteCls('hb-polish');
      const c = this._boteCarry(BOTE_PLATE_SVG, 0.758, 0.6, 0.065);
      c.classList.add('hb-shine');
      for (let i = 0; i < 4; i++) {
        await this._wait(650);
        this._sparkle(this._x + this._dir * 0.258 * pW, gy - 0.345 * pH - this._lift, 1);
      }
      this._say('blitzblank!', 1200);
      this._boteUncls();
      this._boteCls('hb-hold');
      c.classList.remove('hb-shine');
      a.el?.querySelectorAll('.hb-plates > g, .hb-tw').forEach((e) => e.classList.add('hb-gone'));
      await this._wait(500);
      await this._boteToBurrow();
    }

    // Zum Eingang tragen, Getragenes verschwindet an der Tür, kurz drinnen, wieder heraus
    async _boteToBurrow() {
      await this._walkTo(this._g.home, 0.9);
      this._bote?.f?.querySelectorAll('.hb-carry').forEach((e) => e.classList.add('hb-gone'));
      await this._enterBurrow();
      this._boteFxClear();
      this._boteUncls();
      await this._wait(rnd(1400, 2200));
      await this._comeOut();
    }
    // ==================== Ende Haus-Bote ====================

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
