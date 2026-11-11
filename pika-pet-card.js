
/*
 * Pika Pet Card – ein kleiner Pika (Pfeifhase) wohnt im Home-Assistant-Dashboard.
 *
 *   Pika antippen      → streicheln (Herzchen, Glück steigt)
 *   Löwenzahn-Knopf    → füttern (Futter fällt herunter, er hoppelt hin und frisst)
 *   Nachts             → schläft er mit Zipfelmütze im Bau (Standard: Sonnenuntergang bis -aufgang)
 *   Ab und zu, Gewitter → verschwindet er in seinem Bau und schaut heraus
 *   Über den Tag        → macht er kleine Häufchen (erst in die Klo-Ecke am Stein); antippen = wegmachen
 *   Ab und zu Besuch    → Vögelchen landet auf Bau, Laterne oder Stein; Maus schaut hinter dem Stein hervor
 *   Bei Regen           → hüpft ein Frosch auf die Wiese und quakt, eine Schnecke kriecht ein Stück heraus
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
 *   Päckchen            → wer sich gut kümmert (nichts lange unter 50 %), verdient Päckchen: Sie schweben am Ballon
 *                         herein, der Pika schießt sie mit der Zwille vom Himmel. Leckerli oder Schätze fürs Album,
 *                         ist es voll, Tricks und Gold für die Schätze.
 *   Tagebuch            → Tipp auf die Statusleiste: was er heute und gestern erlebt hat (aus dem Verlauf der Helfer
 *                         in HA abgeleitet), dazu seine Schätze
 *   Besuche (Vögelchen, Maus, Frosch, Schnecke, Pino) werden aus der Uhrzeit berechnet und sind auf allen Geräten gleich.
 *
 * Konfiguration:
 *   type: custom:pika-pet-card
 *   name: Pika                       # Name in der Statusanzeige
 *   entity: input_text.pika_status   # optional: Zustand geräteübergreifend speichern
 *   sleep_start: sunset              # Schlafenszeit: "21:00", "sunset" oder z. B. "sunset+01:00"
 *   sleep_end: sunrise               # Aufwachzeit: "07:00", "sunrise" oder z. B. "sunrise-30" (Minuten)
 *   sun_entity: sun.sun              # Sonnenstand (Höhe + Azimut) für Himmel und Sonne
 *   weather_entity: weather.forecast_home   # Wolken, Regen, Schnee, Nebel, Gewitter, Wind
 *   precip_entity: sensor.niederschlag      # optional: Niederschlag in mm/h, darunter bleibt "rainy" trocken
 *   rain_min: 0.3                    # ab so viel mm/h regnet es bei "rainy" (nur mit precip_entity)
 *   areal: huegel                    # Bau: huegel (Erdhügel), fels, stumpf, alpin
 *   flight_entity: sensor.flightradar24_current_in_area   # Flüge im Umkreis (leer = keine Flugzeuge)
 *   flight_radius: 15                # Radius der Integration in km: so weit weg liegt der Bildrand
 *   max_flights: 2                   # höchstens so viele Flugzeuge gleichzeitig (die nächsten)
 *   show_stats: true                 # Satt-/Glück-/Sauber-Balken anzeigen
 *   height: 180                      # Mindesthöhe in px
 *   appliances: [...]                # Haus-Bote: Geräte (siehe README)
 *   coffee: { active, counter, selected }   # Kaffee: Pika trinkt nach jedem Bezug mit (siehe README)
 *   festive: true / birthdays: []    # Festtage und Geburtstage
 *   friend: true / friend_name: Pino # Freund-Pika
 *   shooting_stars: true / fireflies: true   # Himmel-Extras
 *   gifts: true                      # Päckchen für gute Pflege (false = keine)
 *   diary: true / diary_house: true  # Tagebuch (Leiste antippen); Kaffee und Haushaltsgeräte darin
 *   screen_entity: switch.tablet_bildschirm  # optional: Bildschirm-Schalter (Fully Kiosk); an = Begrüßung wie beim Sichtbarwerden
 *
 * Der Blick geht nach Süden: Osten (Sonnenaufgang) links, Westen rechts; auf der Südhalbkugel nach Norden
 * (Osten rechts, Westen links: Sonne, Mond, Flugzeuge, Wind). Mondphase und Mondstand
 * werden aus Datum und Standort (hass.config) berechnet.
 */
(() => {
  const VERSION = '0.27.0';

  // Prototyp Tiefe (depth: true): hintere Spur liegt LANE_DY × Kartenhöhe über der Bodenlinie, Pika dort um LANE_S kleiner
  const LANE_DY = 0.075;
  const LANE_S = 0.8;

  const DEFAULTS = {
    name: 'Pika',
    entity: null,
    // Tagesplan (Vorrat, Frühsport, Verlauf der Beschäftigungen) für alle Geräte gemeinsam; ohne: je Gerät
    plan_entity: null,
    sleep_start: 'sunset',
    sleep_end: 'sunrise',
    sun_entity: 'sun.sun',
    weather_entity: 'weather.forecast_home',
    // Niederschlag in mm/h: Meldet das Wetter "rainy" bei weniger als rain_min, ist es nur bewölkt
    precip_entity: null,
    rain_min: 0.3,
    areal: 'huegel',
    flight_entity: 'sensor.flightradar24_current_in_area',
    flight_radius: 15,
    max_flights: 2,
    show_stats: true,
    height: 180,
    // Haus-Bote: Geräte, deren Fortschritt und Fertig-Zustand der Pika zeigt (siehe Abschnitt "Haus-Bote")
    appliances: null,
    // Kaffee: Kaffeevollautomat, nach jedem Bezug trinkt der Pika mit (siehe Abschnitt "Kaffee")
    coffee: null,
    // Festtage: Deko im Jahreslauf und Geburtstage [{ name, date: 'MM-DD' }]
    festive: true,
    birthdays: [],
    // Freund-Pika, der zu Besuch kommt
    friend: true,
    friend_name: 'Pino',
    // Himmel: Sternschnuppen nachts, Glühwürmchen in Sommernächten
    shooting_stars: true,
    fireflies: true,
    // Päckchen: für gute Pflege verdient, am Ballon verschenkt (siehe Abschnitt "Päckchen")
    gifts: true,
    // Prototyp: Kulisse mit Parallax, hintere Spur zum Herumhoppeln (nur YAML, nicht im Editor)
    depth: false,
    // Tagebuch: Antippen der Statusleiste zeigt, was er heute und gestern erlebt hat, und seine Schätze.
    // diary_house: false lässt Kaffee und Haushaltsgeräte darin weg.
    diary: true,
    diary_house: true,
  };

  // Karten-Editor (getConfigForm): Beschriftungen und Hilfetexte der Felder
  const EDITOR_LABEL = {
    name: 'Name', areal: 'Bau', entity: 'Zustand (Text-Helfer, max. 100)', plan_entity: 'Tagesplan (Text-Helfer, max. 255)',
    show_stats: 'Balken anzeigen', gifts: 'Päckchen', friend: 'Pino kommt zu Besuch', festive: 'Festtage-Deko',
    sleep_start: 'Schlafenszeit', sleep_end: 'Aufwachzeit', sun_entity: 'Sonne', weather_entity: 'Wetter',
    precip_entity: 'Niederschlag (mm/h)', rain_min: 'Regen ab', shooting_stars: 'Sternschnuppen', fireflies: 'Glühwürmchen',
    flight_entity: 'Flüge (Flightradar24)', flight_radius: 'Radius', max_flights: 'Höchstens gleichzeitig',
    friend_name: 'Name des Freunds', screen_entity: 'Bildschirm-Schalter', height: 'Mindesthöhe',
    birthdays: 'Geburtstage', appliances: 'Haushaltsgeräte (Haus-Bote)', coffee: 'Kaffeevollautomat',
    diary: 'Tagebuch', diary_house: 'Haushalt im Tagebuch',
  };
  const EDITOR_HELP = {
    entity: 'Damit alle Geräte denselben Pika sehen. Leer: nur in diesem Browser.',
    plan_entity: 'Vorrat, Abwechslung, Päckchen und Träume für alle Geräte. Muss ein anderer Helfer sein als der Zustand.',
    diary: 'Antippen der Leiste öffnet sein Tagebuch.',
    diary_house: 'Kaffee, Wäsche und Geschirr stehen mit Uhrzeit drin.',
    sleep_start: 'z. B. sunset, sunset+01:00 oder 21:00',
    sleep_end: 'z. B. sunrise, sunrise-30 oder 07:00',
    rain_min: 'Meldet das Wetter „rainy“ bei weniger, bleibt es trocken (nur mit Niederschlags-Sensor).',
    flight_radius: 'So groß wie der Radius der Flightradar24-Integration.',
    screen_entity: 'z. B. der Bildschirm-Schalter von Fully Kiosk: Bei „aus“ ruht die Karte, beim Einschalten winkt er.',
    birthdays: '- name: Mia\n  date: "03-14"',
    appliances: '- type: washer\n  state: sensor.waschmaschine_betriebszustand\n  progress: sensor.…_fortschritt\n  end: sensor.…_endzeit',
    coffee: 'active: select.…_aktives_programm\ncounter: sensor.…_tassen\nselected: select.…_ausgewahltes_programm',
  };

  const RATE = { s: 5, g: 4 }; // Abnahme pro Stunde (satt, glücklich)
  // Im Schlaf sinken satt und glücklich nur halb so schnell (Schlafenszeit wie überall aus sleep_start/sleep_end)
  const SLEEP_DECAY = 0.5;
  // Uhr von HA (_clockSample): so viele Meldungen zählen, ab so viel ms Unterschied wird nachgestellt
  const CLOCK_KEEP = 12;
  const CLOCK_STEP = 250;
  const GAIN = { feed: 25, pet: 8, clean: 10 };
  // Selbst gefressen (Wiesenblume, Heu): wenig und nur bis SELF_MAX. Jedes Gerät knabbert für sich und Blumen
  // wachsen alle 2,5 Min nach, ohne Grenze wäre er immer satt. Über die Hälfte bringt ihn nur das Füttern.
  const SELF = { flower: 3, hay: 2 };
  const SELF_MAX = 50;
  // Häufchen: alle 80–140 Minuten Wachzeit eins, das erste 10–30 Minuten nach dem Aufwachen. Höchstens 8
  // seit dem letzten Großputz (einzeln weggemachte zählen mit), die ersten 3 in der Klo-Ecke am Stein. idx:
  // so viele Fälligkeiten rechnet die Karte höchstens (Bits der Maske für einzeln weggemachte Häufchen).
  // Besucher: Die Uhr ist in feste Fenster geteilt (win, ms). In jedem Fenster kommt mit Wahrscheinlichkeit p
  // höchstens ein Besuch, sein Start liegt in den ersten win − room ms (room: Platz für den Besuch selbst, damit
  // er vor dem nächsten Fenster vorbei ist). Mittlerer Abstand win / p wie früher: Vögelchen 3–7 Min Pause +
  // ~35 s Besuch ≈ 5,6 Min, Maus 2–5 Min + ~15–25 s ≈ 4,4 Min. Alles aus seedRnd, also auf allen Geräten gleich.
  // Frosch und Schnecke kommen nur bei Regen (_critterWeather): der Frosch im Mittel alle 5,7 Min für ~20–35 s,
  // die Schnecke alle 10 Min für ~40–70 s.
  const CRIT = {
    bird: { win: 240000, p: 0.72, room: 60000 }, mouse: { win: 180000, p: 0.69, room: 50000 },
    frog: { win: 240000, p: 0.7, room: 70000 }, snail: { win: 420000, p: 0.7, room: 120000 },
  };
  const CRIT_KINDS = Object.keys(CRIT);
  const CRIT_LATE = 20000; // so lange nach dem Start kommt ein Besuch mindestens noch, danach wird er übersprungen
  // Länger, wenn der Besuch selbst länger dauert: Ein Gerät, das mittendrin dazukommt (Bildschirm an, kurz
  // weggescrollt), zeigt ihn für den Rest. Höchstens CRIT_BACK zurück wird nach einem laufenden Besuch gesucht.
  const CRIT_BACK = 45000;
  const critJoin = (kind, pk) => Math.max(CRIT_LATE, kind === 'bird' ? pk.stay - 5000 : kind === 'frog' ? pk.stay - 3000
    : kind === 'snail' ? 30000 : 0);
  const POOP = { every: 80, spread: 60, morning: [10, 20], max: 8, latrine: 3, idx: 24, fly: 4 };
  const FLOWER_COLORS = ['#f6c945', '#f28fb1', '#ffffff', '#b99cf0', '#ff9f5a'];

  class Cancel extends Error {}
  // Systemeinstellung „Bewegung reduzieren“; .matches folgt einer Änderung von selbst
  const RED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const calmMotion = () => !!RED_MOTION?.matches;
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
  // Längenunterschied in Grad, über die Datumsgrenze gefaltet (−180…180)
  const lonDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
  // Windgeschwindigkeit aus der Einheit der Wetter-Entität (wind_speed_unit) in km/h; unbekannt: schon km/h.
  // Beaufort nach v = 0,836 · B^1,5 m/s.
  const windKmh = (v, unit) => {
    const u = String(unit || 'km/h').trim().toLowerCase();
    if (u === 'm/s') return v * 3.6;
    if (u === 'mph') return v * 1.609344;
    if (u === 'kn' || u === 'kt' || u === 'knots') return v * 1.852;
    if (u === 'ft/s') return v * 1.09728;
    if (u === 'beaufort' || u === 'bft') return 0.836 * Math.max(0, v) ** 1.5 * 3.6;
    return v;
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
  // Beleuchteter Teil der Mondscheibe (Nordhalbkugel: zunehmend rechts hell), viewBox 0 0 100 100.
  // mirror: Blick nach Norden (Südhalbkugel), dort ist der zunehmende Mond links hell (Bogen gespiegelt).
  const moonPath = (p, mirror = false) => {
    const rx = Math.abs(Math.cos(2 * Math.PI * p)) * 50;
    const waxing = p < 0.5;
    let outer = waxing ? 1 : 0;
    let term = waxing ? (p < 0.25 ? 0 : 1) : p > 0.75 ? 1 : 0;
    if (mirror) [outer, term] = [1 - outer, 1 - term];
    return `M50 0 A50 50 0 0 ${outer} 50 100 A${rx.toFixed(2)} 50 0 0 ${term} 50 0Z`;
  };
  // Position am Bildhimmel in %: Höhe 0° am Hügelrand. Blick nach Süden (Nordhalbkugel): Azimut 90° (Ost) links,
  // 270° (West) rechts. Blick nach Norden (viewN, Südhalbkugel): Ost rechts, West links. Was hinter dem
  // Betrachter steht, bleibt am näheren Rand.
  const skyPos = (az, alt, viewN = false) => {
    const d = ((((az - (viewN ? 0 : 180)) % 360) + 540) % 360) - 180; // −180…180 um die Blickrichtung
    return {
      x: clamp((d + 90) / 180, 0.04, 0.96) * 100,
      y: 56 - (clamp(alt, -12, 62) / 62) * 47,
    };
  };

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
  // So lange gilt das letzte Wetter weiter, wenn die Wetter-Entität unavailable/unknown ist
  const WX_HOLD = 30 * 60000;

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
  // Takt der Flieger in Sekunden. Zwischen zwei Meldungen fliegen sie geradeaus weiter, darum genügt alle 5 s ein
  // Zielpunkt (5 s voraus), den ein linearer Übergang gleich lang ansteuert: Weg und Tempo bleiben exakt gleich.
  // Muss zu den 5s-Übergängen bei .plane, .pl-s, .pl-f, .phit und .ptag passen.
  const PLANE_STEP = 5;

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
  /* Weniger Bewegung gewünscht: Glühwürmchen schweben nicht umher, sie glimmen nur langsam an ihrem Platz;
     Sternschnuppen ohne Aufleuchten des Himmels (und ohne Boliden, siehe _meteorMaybe) */
  @media (prefers-reduced-motion: reduce) {
    .ff .fl { animation: ff-pulse calc(var(--fp) * 3) linear var(--fpl) infinite; transform: translate(var(--x0), var(--y0)); }
    .mflash { display: none; }
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
  const freshStats = (t = Date.now()) => {
    const now = sec(t);
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
  // decayH(t1, t2): Abbau-Stunden dazwischen (im Schlaf halb), ohne: gleichmäßig
  const mergeStats = (own, other, gain, now, decayH = (t1, t2) => (t2 - t1) / 3.6e6) => {
    const out = { ...other };
    for (const k of ['s', 'g']) {
      if (!gain[k]) continue;
      const v = clamp(other[k] - decayH(other[k + 't'], now) * RATE[k], 0, 100);
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
  // weighted mit fester Zahl u in [0, 1) statt Math.random; leere Liste oder nur Nullen → null
  const weightedR = (list, u) => {
    const total = list.reduce((t, [w]) => t + w, 0);
    if (!(total > 0)) return null;
    let r = u * total;
    for (const [w, v] of list) if (w > 0 && (r -= w) < 0) return v;
    return list.filter(([w]) => w > 0).pop()[1];
  };

  // ---------- Tagesplan (Helfer plan_entity) ----------
  // Was alle Geräte gemeinsam wissen müssen, ohne es aus der Uhr rechnen zu können:
  // - hay: Vorrat (n Bündel, t letzte Änderung, c Blütenfarben als Ziffern der Areal-Palette, m letztes Sammel-Fenster)
  // - sport: Frühsport heute schon (d Kalendertag, k Fenster)
  // - rec: die letzten großen Beschäftigungen [Fenster, Name, Variante] (neueste zuerst)
  // - cute: Pika-Tag d, wie oft er an dem Tag gestreichelt wurde (n, bis PET_CAP) und was er erlebt hat (m, ein Bit je
  //   Eintrag in MEM_BITS, für die Träume). Stände bis 0.17 haben das Feld nicht und werden weiter gelesen.
  // - gift: Päckchen (siehe GIFT): k Beginn der Pflege-Serie, a in der Serie schon verdiente, n Vorrat, u Album (ein Bit je
  //   Schatz), z verschenkte (laufende Nummer), o ausgepackte, b seit wann ein Wert unter GIFT.min liegt (sonst leer),
  //   x wann das letzte verschenkt wurde (Ballon), y goldenes im Vorrat, d schon belohnte Serien-Wochen, i Inhalt des
  //   letzten (Index in GIFT_ITEMS, +16 = golden). Stände bis 0.18 haben das Feld nicht. Hinter a steht mit "_" noch p:
  //   ab wann die Wachzeit fürs nächste Päckchen zählt (bis dahin sind die a verdient). Ältere Stände lesen nur a
  //   (parseInt hört beim "_" auf) und schreiben es ohne p zurück, dann rechnet die Karte p einmal aus k und a nach.
  //   Ebenso hinter u mit "_" noch v: die Stufen der Schätze (Bit t = Trick, Bit 8 + t = Gold, siehe giftLv). Geräte
  //   bis 0.22 lesen nur u und schreiben es ohne v zurück; dann trägt die Karte das zuletzt bekannte v wieder ein.
  // - fl: das Blumengeschenk im Gras (t wann er es hinlegte, c Blütenfarbe als Ziffer der Areal-Palette, x Stelle in % der
  //   Breite, k angenommen). Steht mit "_" hinter m von hay: Geräte bis 0.23 lesen nur m und schreiben es ohne fl zurück.
  // - fu: Pino ist vor der Zeit gegangen (Regen, Schlafenszeit) und kommt bis dahin nicht wieder, auch nicht auf einem
  //   Gerät, das erst danach dazukommt. Steht mit "_" hinter cute.
  // - fd: Futter auf der Wiese, höchstens 3 (t wann es fiel, x Stelle 0–99 zwischen Heu und Stein, k Sorte: 0 Löwenzahn,
  //   1 Klee, e gefressen). So fällt es auf allen Geräten, er frisst überall, und nach dem Neuladen liegt es noch da.
  //   Steht mit "_" je Futter hinter sport ("t-xxf"): Geräte bis 0.25 lesen nur d.k und schreiben es ohne fd zurück.
  // Text: "p1|n.t.c.m_t_cxxk|d.k_t-xxf…|k:name:v,…|d.n.m|k.a.n.u.z.o.b.x.y.d.i" (Zahlen zur Basis 36), passt in die 255 Zeichen eines input_text.
  const HAY_MAX = 12;
  const PLAN_REC = 4;
  // Kürzer als so darf der Helfer für den Tagesplan nicht sein (mit Päckchen sind es bis ~100 Zeichen ohne Verlauf)
  const PLAN_MIN = 120;
  const planBlank = (now = Date.now()) => ({ hay: { n: 3, t: now, c: '', m: 0 }, sport: null, rec: [], cute: null, gift: null, fl: null, fd: [] });
  const FOOD_MAX = 3;
  const FOOD_KINDS = ['lz', 'klee'];
  // Blumengeschenk: höchstens alle 90 Minuten (auf allen Geräten zusammen), welkt nach 12 Minuten
  const FLGIFT = { gap: 90 * 6e4, life: 12 * 6e4 };
  const GIFT_F = ['k', 'a', 'n', 'u', 'z', 'o', 'b', 'x', 'y', 'd', 'i'];
  const GIFT_T = new Set(['k', 'b', 'x']); // Zeiten: im Text in Sekunden
  // Streicheln: ab PET_CLING ist er anhänglich. Gezählt wird fürs Tagebuch weiter bis PET_CAP, danach wird der Helfer
  // dafür nicht mehr geschrieben. (Geräte bis 0.26 zählen nur bis 10 und schreiben höchstens das zurück.)
  const PET_CLING = 10;
  const PET_CAP = 99;
  // Erlebnisse für die Träume, je ein Bit
  const MEM_BITS = ['lz', 'klee', 'coffee', 'heart', 'pino', 'plane', 'bird', 'note', 'bfly'];
  // Pika-Tag: wechselt um 4 Uhr nachts, so träumt er nach Mitternacht noch vom Vortag
  const pikaDay = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4 - 4 * 36e5) / 864e5);
  const planSer = (P) => {
    const h = P.hay;
    const f = P.fl;
    const fs = f ? `_${Math.round(f.t / 1000).toString(36)}_${f.c}${f.x.toString(36).padStart(2, '0')}${f.k ? 1 : 0}` : '';
    return ['p1', [h.n, Math.round(h.t / 1000).toString(36), h.c || '-', h.m.toString(36) + fs].join('.'),
      (P.sport ? `${P.sport.d.toString(36)}.${P.sport.k.toString(36)}` : '-')
        + (P.fd || []).map((f) => `_${Math.round(f.t / 1000).toString(36)}-${f.x.toString(36).padStart(2, '0')}${(f.k ? 1 : 0) + (f.e ? 2 : 0)}`).join(''),
      P.rec.map(([k, a, v]) => (v ? `${k.toString(36)}:${a}:${v}` : `${k.toString(36)}:${a}`)).join(',') || '-',
      (P.cute ? [P.cute.d, P.cute.n, P.cute.m].map((x) => x.toString(36)).join('.') : '-')
        + (P.fu ? `_${Math.round(P.fu / 1000).toString(36)}` : ''),
      ...(P.gift ? [GIFT_F.map((f) => (P.gift[f] == null ? '-' : Math.round(GIFT_T.has(f) ? P.gift[f] / 1000 : P.gift[f]).toString(36)
        + (f === 'a' && P.gift.p != null ? `_${Math.round(P.gift.p / 1000).toString(36)}` : '')
        + (f === 'u' && P.gift.v != null ? `_${P.gift.v.toString(36)}` : ''))).join('.')] : []),
    ].join('|');
  };
  const planParse = (str) => {
    const p = String(str ?? '').split('|');
    if (p.length < 4 || p.length > 6 || p[0] !== 'p1') return null;
    const h = p[1].split('.');
    const n = Number(h[0]);
    const t = parseInt(h[1], 36) * 1000;
    const m = parseInt(h[3], 36);
    if (h.length !== 4 || !Number.isFinite(n) || !Number.isFinite(t) || !Number.isFinite(m)) return null;
    const P = { hay: { n: clamp(n, 1, HAY_MAX), t, c: h[2] === '-' ? '' : h[2].replace(/\D/g, ''), m }, sport: null, rec: [], cute: null, gift: null, fl: null, fd: [] };
    const fq = h[3].split('_');
    if (fq.length === 3 && /^\d[0-9a-z]{2}[01]$/.test(fq[2])) {
      const ft = parseInt(fq[1], 36) * 1000;
      if (Number.isFinite(ft)) P.fl = { t: ft, c: Number(fq[2][0]), x: clamp(parseInt(fq[2].slice(1, 3), 36), 0, 100), k: fq[2][3] === '1' };
    }
    const gq = (p[5] || '').split('.');
    if (gq.length === GIFT_F.length) {
      const G = {};
      GIFT_F.forEach((f, i) => (G[f] = gq[i] === '-' ? null : parseInt(gq[i], 36) * (GIFT_T.has(f) ? 1000 : 1)));
      const gp = parseInt(gq[1].split('_')[1] ?? '', 36) * 1000;
      G.p = Number.isFinite(gp) ? gp : null;
      // Stufen: "u_v". Ohne Anhang (Stand bis 0.22, oder ein Gerät bis 0.22 hat sie weggelassen) 0 und nov: dann trägt
      // _planCompose die zuletzt bekannten wieder ein
      const gv = parseInt(gq[3].split('_')[1] ?? '', 36);
      G.v = Number.isFinite(gv) ? gv & 0xffff : 0;
      if (!Number.isFinite(gv)) G.nov = true;
      if (GIFT_F.every((f) => f === 'b' || Number.isFinite(G[f]))) P.gift = G;
    }
    const [cq, fuq] = (p[4] || '-').split('_');
    const fu = parseInt(fuq ?? '', 36) * 1000;
    P.fu = Number.isFinite(fu) ? fu : 0;
    const q = cq.split('.').map((x) => parseInt(x, 36));
    if (q.length === 3 && q.every(Number.isFinite)) P.cute = { d: q[0], n: clamp(q[1], 0, PET_CAP), m: q[2] };
    const [sp, ...fds] = p[2].split('_');
    const s = sp.split('.').map((x) => parseInt(x, 36));
    if (s.length === 2 && s.every(Number.isFinite)) P.sport = { d: s[0], k: s[1] };
    for (const e of fds.slice(0, FOOD_MAX)) {
      const m2 = /^([0-9a-z]+)-([0-9a-z]{2})([0-3])$/.exec(e);
      if (m2) P.fd.push({ t: parseInt(m2[1], 36) * 1000, x: clamp(parseInt(m2[2], 36), 0, 99), k: Number(m2[3]) & 1, e: Number(m2[3]) > 1 });
    }
    if (p[3] !== '-') {
      for (const e of p[3].split(',')) {
        const [k, a, v] = e.split(':');
        if (Number.isFinite(parseInt(k, 36)) && a) P.rec.push([parseInt(k, 36), a, v || '']);
      }
    }
    return P;
  };
  // Päckchen-Änderung auf den Plan legen (verändert out.gift). Wiederholbar wie alle Plan-Änderungen: jede gilt nur für die
  // Serie k, in der sie entstand, und nur einmal (Zähler wachsen nur, verschenkt wird mit laufender Nummer z).
  const GIFT_OPS = new Set(['gstart', 'gbad', 'gok', 'gearn', 'ggold', 'give', 'gopen', 'gdbg']);
  const giftApply = (out, op) => {
    const G = out.gift;
    if (op.t === 'gstart') {
      if (!G) out.gift = { k: op.k, a: 0, n: 0, u: 0, v: 0, z: 0, o: 0, b: null, x: 0, y: 0, d: 0, i: 0, p: op.k };
      return;
    }
    if (!G) return;
    if (op.t === 'gbad') {
      if (G.k === op.k && G.b == null) G.b = op.b;
    } else if (op.t === 'gok') {
      // Wieder alles über GIFT.min. War es zu lange darunter (brk), beginnt eine neue Serie.
      if (G.k === op.k && G.b === op.b) Object.assign(G, op.brk ? { k: op.nk, a: 0, b: null, d: 0, p: op.nk } : { b: null });
    } else if (op.t === 'gearn') {
      // p: ab da zählt die Wachzeit fürs nächste. Mit e === a trägt ein Gerät nur p zu einem älteren Stand nach.
      if (G.k === op.k && (op.e > G.a || (op.e === G.a && G.p == null && op.p != null))) {
        G.n = Math.min(GIFT.max, G.n + op.e - G.a);
        G.a = op.e;
        if (op.p != null) G.p = op.p;
      }
    } else if (op.t === 'ggold') {
      // je volle Woche eins dazu, höchstens GIFT.goldMax auf Vorrat
      if (G.k === op.k && op.w > G.d) Object.assign(G, { y: Math.min(GIFT.goldMax, G.y + op.w - G.d), d: op.w });
    } else if (op.t === 'give') {
      if (op.z !== G.z + 1 || G.o < G.z || !(op.gold ? G.y > 0 : G.n > 0)) return;
      if (op.gold) G.y--;
      else G.n--;
      Object.assign(G, { z: op.z, x: op.x, i: op.i });
      // Schatz: fehlt er, kommt er ins Album, sonst eine Stufe höher (Gold nur aus goldenen Päckchen)
      const t = op.i & 15;
      if (t < GIFT_TRE) {
        const lv = giftLv(G, t);
        if (!lv) G.u |= 1 << t;
        else if (lv === 1) G.v = (G.v || 0) | (1 << t);
        else if (lv === 2 && op.gold) G.v = (G.v || 0) | (1 << (8 + t));
      }
    } else if (op.t === 'gopen') {
      G.o = Math.max(G.o, Math.min(op.z, G.z));
    } else if (op.t === 'gdbg') {
      Object.assign(G, op.f); // Vorschau
      if ('v' in op.f) delete G.nov;
    }
  };
  // Vorrat jetzt: 2 Bündel weniger je Tag seit der letzten Änderung, die ältesten Blüten fallen zuerst weg
  const hayNow = (h, now) => {
    const n = clamp(h.n - Math.floor(Math.max(0, now - h.t) / 864e5) * 2, 1, HAY_MAX);
    return { n, c: h.c.slice(-n) };
  };
  // Änderung op auf den Plan P anwenden. Alle Änderungen sind wiederholbar (gleiches Ergebnis beim zweiten Mal), so
  // dürfen sie auf jeden neu eintreffenden Stand eines anderen Geräts noch einmal gelegt werden.
  const planApply = (P, op, now) => {
    const out = { hay: { ...P.hay }, sport: P.sport, rec: P.rec.map((e) => [...e]), cute: P.cute, gift: P.gift && { ...P.gift }, fl: P.fl, fd: P.fd || [], fu: P.fu || 0 };
    if (GIFT_OPS.has(op.t)) {
      giftApply(out, op);
      return out;
    }
    if (op.t === 'rec') {
      const e = out.rec.find((x) => x[0] === op.k);
      if (e) {
        if (op.v && !e[2]) e[2] = op.v;
      } else {
        out.rec.push([op.k, op.a, op.v || '']);
        out.rec.sort((a, b) => b[0] - a[0]);
        out.rec.length = Math.min(out.rec.length, PLAN_REC);
      }
    } else if (op.t === 'sport') {
      if (out.sport?.d !== op.d) out.sport = { d: op.d, k: op.k };
    } else if (op.t === 'gather') {
      // Dasselbe Sammel-Fenster zählt nur einmal, egal wie viele Geräte es gezeigt haben
      if (op.m != null && out.hay.m >= op.m) return out;
      const { n, c } = hayNow(out.hay, now);
      if (n >= HAY_MAX) return out;
      // t ist der Anker für den Verfall: nur um die schon verfallenen ganzen Tage weiterrücken. Mit t = now fiele bei
      // täglichem Sammeln nie etwas weg (der angebrochene Tag ginge jedes Mal verloren).
      const t = out.hay.t + Math.floor(Math.max(0, now - out.hay.t) / 864e5) * 864e5;
      out.hay = { n: n + 1, t, c: (c + op.c).slice(-(n + 1)), m: op.m ?? out.hay.m };
    } else if (op.t === 'fdrop') {
      // Hat ein anderes Gerät gerade eins hingelegt (weniger als FLGIFT.gap davor oder danach), gilt das: So zeigen alle
      // Geräte dasselbe, egal in welcher Reihenfolge die Stände ankommen
      const f = out.fl;
      if (!f || (f.t !== op.f.t && Math.abs(op.f.t - f.t) >= FLGIFT.gap)) out.fl = { ...op.f };
    } else if (op.t === 'frgone') {
      out.fu = Math.max(out.fu, op.u);
    } else if (op.t === 'feed') {
      // Jedes Futter einmal (t ist seine Kennung); mehr als FOOD_MAX liegen nie da, die ältesten fallen heraus
      if (!out.fd.some((f) => f.t === op.f.t)) out.fd = [...out.fd, { ...op.f }].sort((a, b) => a.t - b.t).slice(-FOOD_MAX);
    } else if (op.t === 'fate') {
      out.fd = out.fd.map((f) => (f.t === op.ft ? { ...f, e: true } : f));
    } else if (op.t === 'ftake') {
      if (out.fl?.t === op.ft) out.fl = { ...out.fl, k: true };
    } else if (op.t === 'pet' || op.t === 'mem') {
      // Ein neuer Pika-Tag fängt bei null an. Der höchste Zähler gewinnt, Erlebnisse werden zusammengelegt.
      const c = out.cute;
      if (c && c.d > op.d) return out;
      const b = c?.d === op.d ? c : { d: op.d, n: 0, m: 0 };
      out.cute = op.t === 'pet' ? { ...b, n: Math.max(b.n, Math.min(op.n, PET_CAP)) } : { ...b, m: b.m | op.b };
    }
    return out;
  };

  // ---------- Grafiken ----------

  const OUT = '#5a4030';
  // Fellfarben als CSS-Variablen (Name → Tagesfarbe). Nachts und im Bau setzt der STYLE dunklere Werte,
  // ein CSS-Filter auf dem atmenden Pika müsste sonst jedes Bild neu gerechnet werden.
  const PK_FILL = {
    fu1: '#d0ad8d', fu2: '#b08a68', fu3: '#8a664b', bel: '#f0e2cf', ear: '#efe3d3', ein: '#e3a990',
    paw: '#ecdcc6', mou: '#f4e8d8', cap: '#7c9be0', cpw: '#ffffff',
  };
  const PK = (k) => `var(--pk-${k}, ${PK_FILL[k]})`;
  // Wie filter: brightness(b) saturate(s), nur einmal ausgerechnet
  const PK_DIM = (b, s) => Object.entries(PK_FILL).map(([k, hex]) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * b);
    const L = 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2];
    return `--pk-${k}: #${c.map((v) => Math.round(clamp(L + (v - L) * s, 0, 255)).toString(16).padStart(2, '0')).join('')};`;
  }).join(' ');
  // Accessoires mit festen Farben (Schal, Hüte, Tasse ohne die Pfoten, Milchschaum) unter dem Vorsatz pre
  const PK_ACC = (pre) => ['.scarf', '.hats', '.cfoam', '.cup > g > g > :not(.cps)'].map((s) => `${pre} ${s}`).join(', ');
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
      <circle class="hl1" cx="${cx + 1.4}" cy="44.2" r="1.5" fill="#fff"/>
      <circle cx="${cx - 0.9}" cy="47.9" r=".7" fill="#fff"/>
      <path class="estar" d="M${cx + 1.2} 41.6 Q${cx + 1.6} 43.8 ${cx + 3.6} 44.2 Q${cx + 1.6} 44.6 ${cx + 1.2} 46.8 Q${cx + 0.8} 44.6 ${cx - 1.2} 44.2 Q${cx + 0.8} 43.8 ${cx + 1.2} 41.6Z" fill="#fff"/>
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

  // Kaffee in den Pfoten (Abschnitt "Kaffee"): Glas (Latte, Milch), Tasse mit Schaum (Cappuccino & Co.), Espressotasse,
  // Becher (Kaffee, Tee). .lq sinkt mit --lv (Füllstand 1 … 0), .lqs (Schaum, Crema) verblasst, .cst = Dampf.
  // Gezeichnet in 1:1, dann um 1,35 vergrößert und etwas tiefer an den Bauch gesetzt. .cpr ist die Pfote, die bei Regen den Blattschirm hält.
  const CUP_STEAM = (x, y) => `<g class="cst" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round">
        <path d="M${x - 2} ${y} q-1.4 -2.2 0 -4.4 q1.4 -2.2 0 -4.4"/><path d="M${x + 2} ${y - 0.6} q-1.4 -2.2 0 -4.4 q1.4 -2.2 0 -4.4"/></g>`;
  const CUP_PAWS = (l, r) => `<g class="cps" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.05">
        <ellipse cx="${l[0]}" cy="${l[1]}" rx="3" ry="3.8"/><ellipse class="cpr" cx="${r[0]}" cy="${r[1]}" rx="3" ry="3.8"/></g>`;
  const CUP_SVG = `
      <g class="cup"><g transform="translate(0 4) translate(92 80) scale(1.35) translate(-92 -80)">
        <g class="k-glass">
          ${CUP_STEAM(92, 62)}
          <path d="M95.2 64 L99.6 55.6" stroke="#b9c0c8" stroke-width="1.1" stroke-linecap="round"/>
          <g class="lq">
            <path d="M87.5 74.2 H96.5 L96.4 80 Q92 81.2 87.6 80Z" fill="#f4ead9"/>
            <path class="cof" d="M87.2 69 H96.8 L96.5 74.2 H87.5Z" fill="#b07a4c"/>
            <path d="M86.9 64.6 H97.1 L96.8 69 H87.2Z" fill="#fffaf3"/>
          </g>
          <path d="M86.6 63 L97.4 63 L96.4 80 Q92 81.2 87.6 80 Z" fill="#dff1ff" fill-opacity=".22" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <path d="M88.6 65 L89.2 78" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".7"/>
          ${CUP_PAWS([86.4, 72], [97.6, 71.4])}
        </g>
        <g class="k-capp">
          ${CUP_STEAM(92, 67.6)}
          <ellipse cx="92" cy="79.4" rx="11" ry="2.2" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9"/>
          <path d="M99.2 71 q4.4 -.4 3.8 3.1 q-.6 2.7 -4.6 2.4" fill="none" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M99.2 71 q4.4 -.4 3.8 3.1 q-.6 2.7 -4.6 2.4" fill="none" stroke="#f6f1ea" stroke-width=".9" stroke-linecap="round"/>
          <path d="M84.5 69 H99.5 Q99 78.2 92 78.4 Q85 78.2 84.5 69Z" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <ellipse cx="92" cy="69" rx="7.5" ry="1.7" fill="#5b3620"/>
          <g class="lqs">
            <ellipse cx="92" cy="69.1" rx="6.6" ry="1.35" fill="#fff6e8"/>
            <path d="M91.2 68.6 q-1 -.9 0 -1.2 q.8 -.1 .8 .5 q0 -.6 .8 -.5 q1 .3 0 1.2 l-.8 .6z" fill="#c9915e"/>
          </g>
          ${CUP_PAWS([83.8, 74.4], [100.6, 78.6])}
        </g>
        <g class="k-esp">
          ${CUP_STEAM(92, 71.6)}
          <ellipse cx="92" cy="79.6" rx="8.2" ry="1.8" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9"/>
          <path d="M96.2 73.8 q3 -.2 2.6 2 q-.4 1.8 -3.2 1.6" fill="none" stroke="${OUT}" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M87.6 73 H96.4 Q96 78.6 92 78.7 Q88 78.6 87.6 73Z" fill="#f6f1ea" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <ellipse cx="92" cy="73" rx="4.4" ry="1.05" fill="#3b2417"/>
          <ellipse class="lqs" cx="92" cy="73.05" rx="3.8" ry=".8" fill="#c58a52"/>
          ${CUP_PAWS([86.2, 76.4], [98.2, 79])}
        </g>
        <g class="k-mug">
          ${CUP_STEAM(92, 64.6)}
          <path d="M99 68.6 q4.8 0 4.8 4 q0 4 -4.8 4" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M99 68.6 q4.8 0 4.8 4 q0 4 -4.8 4" fill="none" stroke="#4f86c6" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M85 66 H99 V77.6 Q99 80 96.6 80 H87.4 Q85 80 85 77.6Z" fill="#4f86c6" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <g fill="#fff" opacity=".85"><circle cx="88.6" cy="70.6" r=".9"/><circle cx="92.4" cy="74.2" r=".9"/><circle cx="95.8" cy="70.2" r=".9"/><circle cx="89.4" cy="77" r=".9"/></g>
          <ellipse cx="92" cy="66" rx="7" ry="1.5" fill="#2b1a10"/>
          <ellipse class="lqs" cx="92" cy="66.1" rx="6.1" ry="1.05" fill="#6b4428"/>
          <g class="ttag"><path d="M95.6 66 Q97.6 64.6 99.4 66.4 V70" stroke="#e8e2d6" stroke-width=".6" fill="none"/>
            <rect x="97.6" y="69.6" width="3.6" height="4.2" rx=".5" fill="#f6c945" stroke="${OUT}" stroke-width=".5"/></g>
          ${CUP_PAWS([85, 72.6], [99, 74.6])}
        </g>
      </g></g>`;
  // Milchschaum-Bärtchen unter der Nase nach dem ersten Schluck
  const CUP_FOAM = `<path class="cfoam" d="M85.6 55.6 q1.4 -1.8 3 -.6 q1.2 -1.2 2.4 -.2 q1.2 -1 2.4 .2 q1.6 -1.2 3 .6 q-2.6 1.6 -5.4 1 q-2.8 .6 -5.4 -1z"
          fill="#fffaf2" stroke="rgba(0,0,0,.2)" stroke-width=".4"/>`;

  // ---------- Aktivitäten: Requisiten am Pika (Musik, Malen, Seifenblasen, Frühsport, Seil, Hantel, Winken) ----------
  // Alle in derselben viewBox wie der Pika (120 × 100, Blick nach rechts), sichtbar nur mit der Klasse am .pika.
  const ACT_PAW = (cx, cy, cls = '', rx = 3.8, ry = 4.6) =>
    `<ellipse${cls ? ` class="${cls}"` : ''} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4"/>`;
  // Springseil: dieselbe Schlaufe zweimal, hinter dem Körper (rope-b) und davor (rope-f); hinten ist der Griff verdeckt
  const ROPE_D = 'M24 56 C22 115 110 115 108 56';
  const ACT_BACK = `
      <g class="rope rope-b"><path d="${ROPE_D}" fill="none" stroke="#d9443a" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></g>`;
  const ACT_FRONT = `
      <g class="band">
        <path d="M70.5 37.5 q-6.5 -1.6 -9.4 3.4 q4.4 .2 7 2.4z M70.5 38 q-4.6 3.4 -5.6 8.6 q3.8 -2.8 7.6 -4z" fill="#e8584e" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M70 37.5 Q88 21 108 36" stroke="${OUT}" stroke-width="6.4" fill="none" stroke-linecap="round"/>
        <path d="M70 37.5 Q88 21 108 36" stroke="#e8584e" stroke-width="4.8" fill="none" stroke-linecap="round"/>
        <path d="M71 36.6 Q88 21.6 107.2 35.2" stroke="#fff" stroke-width="1.1" fill="none" opacity=".9"/>
      </g>
      <g class="arms">${ACT_PAW(68, 42)}${ACT_PAW(116, 40)}</g>
      <g class="uke">
        <g transform="translate(79 75) rotate(-30)">
          <rect x="12" y="-1.7" width="22" height="3.4" rx=".8" fill="#8a5a32" stroke="${OUT}" stroke-width=".8"/>
          <path d="M33 -3 h6.5 q1.5 0 1.5 1.5 v3 q0 1.5 -1.5 1.5 h-6.5z" fill="#6b4426" stroke="${OUT}" stroke-width=".8"/>
          <g fill="#efe6d2"><circle cx="35.5" cy="-3.7" r=".9"/><circle cx="38.6" cy="-3.7" r=".9"/><circle cx="35.5" cy="3.7" r=".9"/><circle cx="38.6" cy="3.7" r=".9"/></g>
          <path d="M-8 0 C-8 -7.5 -1 -8.5 3 -5.5 C5.5 -7.5 12.5 -7 12.5 0 C12.5 7 5.5 7.5 3 5.5 C-1 8.5 -8 7.5 -8 0Z" fill="#dc9a4e" stroke="${OUT}" stroke-width="1.2"/>
          <path d="M-6 -2.6 C-5 -5.6 -1.4 -6 1.4 -4.2" stroke="#f3c48a" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>
          <circle cx="5.5" cy="0" r="2.4" fill="#5a3a22"/>
          <rect x="-5.6" y="-2.6" width="1.8" height="5.2" rx=".5" fill="#6b4426"/>
          <path d="M16 -1.7 v3.4 M20 -1.7 v3.4 M24 -1.7 v3.4 M28 -1.7 v3.4" stroke="#d8c39a" stroke-width=".45"/>
          <path d="M-4.7 -1.1 H37 M-4.7 -.37 H37 M-4.7 .37 H37 M-4.7 1.1 H37" stroke="#f6efe0" stroke-width=".28"/>
        </g>
        ${ACT_PAW(100, 63)}${ACT_PAW(83.5, 73.5, 'ustrum')}
      </g>
      <g class="brush">
        <g class="bpal">
          <path d="M70.6 71 q-2.4 -6.4 5 -7.8 q9.4 -1.6 12.4 3.2 q2.4 4.2 -2.6 6.6 q-3 1.4 -4.6 -.6 q-1.6 -1.6 -3.8 .4 q-4.6 2.6 -6.4 -1.8z"
                fill="#ead2a2" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
          <circle cx="75" cy="67.6" r="1.6" fill="#e8584e"/><circle cx="79.2" cy="65.6" r="1.6" fill="#4f86c6"/>
          <circle cx="83.6" cy="66" r="1.6" fill="#f6c945"/><circle cx="85.8" cy="69" r="1.5" fill="#5fae4a"/>
          ${ACT_PAW(79.5, 72.4)}
        </g>
        <g class="bstick">
          <path d="M100 65 L114 49" stroke="#b5793e" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M113.2 50 L116 46.8" stroke="#9aa3ad" stroke-width="2.6"/>
          <ellipse cx="117.2" cy="45.4" rx="1.7" ry="2.7" transform="rotate(41 117.2 45.4)" fill="var(--pc, #e8584e)" stroke="rgba(0,0,0,.25)" stroke-width=".4"/>
          ${ACT_PAW(101, 63)}
        </g>
      </g>
      <g class="wand">
        <path d="M100 65 L110.6 52.2" stroke="#f28fb1" stroke-width="1.9" stroke-linecap="round"/>
        <circle class="wfilm" cx="113" cy="48.5" r="4.4" fill="#dff1ff" opacity=".45"/>
        <circle cx="113" cy="48.5" r="4.4" fill="none" stroke="#f28fb1" stroke-width="1.6"/>
        ${ACT_PAW(100, 64)}
      </g>
      <g class="rope rope-f"><path d="${ROPE_D}" fill="none" stroke="#d9443a" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></g>
      <g class="rgrip"><rect x="105.8" y="52" width="4.4" height="9" rx="1.8" fill="#4f86c6" stroke="${OUT}" stroke-width=".8"/>${ACT_PAW(107, 59)}</g>
      <g class="bar"><g class="barm">
        <path d="M67 64 H115" stroke="#7a5230" stroke-width="2.2" stroke-linecap="round"/>
        ${[67, 115].map((x) => `<g transform="translate(${x} 64)">
          <circle r="7.6" fill="#fbfaf3" stroke="#d6d3c4" stroke-width=".8"/>
          <path d="M0 -6.6 V6.6 M-6.6 0 H6.6 M-4.7 -4.7 L4.7 4.7 M-4.7 4.7 L4.7 -4.7" stroke="#e2dfd0" stroke-width=".55"/>
          <circle r="1.6" fill="#c9b27a"/></g>`).join('')}
        ${ACT_PAW(84, 65)}${ACT_PAW(98, 65)}
      </g></g>
      ${ACT_PAW(107, 40, 'wpaw')}`;

  // Päckchen: Zwille, Fernrohr und Gießkanne in den Pfoten, Sonnenbrille auf der Nase (Stil im Abschnitt "Päckchen")
  const GIFT_FRONT = `
      <g class="slg"><g class="slr">
        <path d="M112 62 L121 37 M121 37 L117 25.5 M121 37 L128.5 27.5" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
        <path d="M112 62 L121 37 M121 37 L117 25.5 M121 37 L128.5 27.5" stroke="#b07a42" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <path class="slb-p" d="M117 26.4 L107.6 43.4 L128.2 28.4" stroke="#d9443a" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        <path class="slb-r" d="M117 26.4 Q122.6 29.6 128.2 28.4" stroke="#d9443a" stroke-width="1.5" fill="none"/>
        <circle class="slp" cx="107.6" cy="43.4" r="2.1" fill="#8e9196" stroke="${OUT}" stroke-width=".6"/>
        <circle class="slf" cx="122.6" cy="28" r=".4" fill="none"/>
        ${ACT_PAW(112.6, 58.4)}${ACT_PAW(106.6, 46)}
      </g></g>
      <g class="gspy"><g transform="rotate(-24 101 46)">
        <rect x="100" y="42.6" width="9" height="6.8" rx="1.2" fill="#b8862e" stroke="${OUT}" stroke-width=".9"/>
        <rect x="108.4" y="41.4" width="9" height="9.2" rx="1.4" fill="#d9a441" stroke="${OUT}" stroke-width=".9"/>
        <rect x="116.8" y="40.2" width="5" height="11.6" rx="1.4" fill="#8a5a32" stroke="${OUT}" stroke-width=".9"/>
        <path d="M111.4 41.6 v8.8 M114.4 41.6 v8.8" stroke="#f3cf7a" stroke-width=".9"/>
      </g>${ACT_PAW(106, 54)}</g>
      <g class="gcan"><g class="gcr"><g transform="translate(-26.5 -16) scale(1.25)">
        <path d="M99 57 h13 v11.5 q0 2 -2 2 h-9 q-2 0 -2 -2z" fill="#5fae4a" stroke="${OUT}" stroke-width="1"/>
        <path d="M112 60.5 L120.5 55 l1.6 1.8 -8.2 7.6" fill="#5fae4a" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
        <path d="M101.5 57 q4 -5.6 8 0" stroke="${OUT}" stroke-width="1.4" fill="none"/>
        <path d="M101 61 h9" stroke="#8fd16f" stroke-width="1.2" stroke-linecap="round"/>
      </g></g>${ACT_PAW(100, 58)}</g>`;
  const GIFT_SHADES = `
        <g class="shades">
          <path d="M75.5 44.6 H105.5" stroke="#2c2f3a" stroke-width="1.3"/>
          <path d="M76.4 43.4 h11.2 q0 7.2 -5.6 7.2 q-5.6 0 -5.6 -7.2z M93.4 43.4 h11.2 q0 7.2 -5.6 7.2 q-5.6 0 -5.6 -7.2z"
                fill="#2c2f3a" stroke="#15171d" stroke-width=".8"/>
          <path d="M78.8 45 l2.6 2.8 M95.8 45 l2.6 2.8" stroke="#fff" stroke-width=".9" opacity=".55" stroke-linecap="round"/>
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
      ${ACT_BACK}
      <g class="hd">${EAR(75, 26, 'l')}${EAR(101, 27, 'r')}</g>
      <g class="body">
        <path d="${BODY}" fill="url(#fur)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
        <g clip-path="url(#bodyclip)">
          <ellipse cx="82" cy="82" rx="20" ry="13" fill="${PK('bel')}"/>
        </g>
      </g>
      <g class="feet" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.6">
        <ellipse class="bfoot" cx="33" cy="90.5" rx="9" ry="3.6"/>
        <ellipse class="ffoot" cx="82" cy="91" rx="6" ry="3.4"/>
        <ellipse class="ffoot" cx="97" cy="90.5" rx="6" ry="3.4"/>
      </g>
      <g class="sleg"><ellipse cx="64" cy="50" rx="5.2" ry="7.4" transform="rotate(-38 64 50)" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.5"/></g>
      <g class="hd"><g class="face">
        <ellipse class="chk" cx="77.5" cy="55" rx="4.2" ry="2.5" fill="#f2998c" opacity=".55"/>
        <ellipse class="chk" cx="104" cy="54.5" rx="3.8" ry="2.4" fill="#f2998c" opacity=".55"/>
        <path class="blines" d="M75.2 55.4 l1.1 -1.8 M77.4 55.6 l1.1 -1.8 M79.6 55.8 l1.1 -1.8 M101.8 55 l1.1 -1.8 M104 55.2 l1.1 -1.8"
              stroke="#e06a5e" stroke-width=".7" stroke-linecap="round"/>
        ${EYE(82, 'l')}${EYE(99, 'r')}
        <path class="wsk" d="M84 56 L70 53.5 M84 57.6 L70 59.8 M98 56 L113 53.5 M98 57.6 L113 59.8"
              stroke="${OUT}" stroke-width=".7" opacity=".45" stroke-linecap="round"/>
        <g class="mouth-g">
          <ellipse cx="91" cy="55" rx="7.5" ry="5.2" fill="${PK('mou')}"/>
          <g class="yawnm">
            <ellipse cx="91" cy="58.6" rx="3" ry="3.9" fill="#7a3a30" stroke="${OUT}" stroke-width=".7"/>
            <ellipse cx="91" cy="61" rx="1.9" ry="1.1" fill="#e8838b"/>
          </g>
          <path class="nose" d="M88.7 51.6 q2.3 -1.1 4.6 0 q-.6 1.9 -2.3 2.5 q-1.7 -.6 -2.3 -2.5z" fill="#7a4438"/>
          <path class="nsm" d="M90.6 50 q1.7 -1.2 3 .1 q1.1 1.5 -.4 2.5 q-1.7 .8 -2.9 -.5 q-.8 -1.1 .3 -2.1z M94.4 52.6 a.7 .7 0 1 0 .01 0z"
                fill="var(--nsm, #e8584e)" stroke="rgba(0,0,0,.25)" stroke-width=".35"/>
          <path class="mth" d="M91 54.1 v1.5 M91 55.6 q-1.5 1.7 -3 .4 M91 55.6 q1.5 1.7 3 .4"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round"/>
          <path class="wmouth" d="M91 54.1 v1.2 M87.6 55.2 q1.7 2.6 3.4 .1 q1.7 2.5 3.4 -.1"
                stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <ellipse class="tongue" cx="91" cy="57.5" rx="1.35" ry="1.8" fill="#ee7f88" stroke="${OUT}" stroke-width=".5"/>
          <ellipse class="omouth" cx="91" cy="57.6" rx="1.8" ry="2.2" fill="#7a3a30" stroke="${OUT}" stroke-width=".6"/>
        </g>
        ${CUP_FOAM}
        <g class="callfx" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
          <path d="M113 51 q4 5 0 10"/><path d="M118 47.5 q6 8.5 0 17"/><path d="M123 44 q8 12 0 24"/>
        </g>
      </g></g>
      <g class="mfood"><g class="mf-bloom">
        <path d="M92 58 Q100 58 106 61" stroke="#4f8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="99" cy="61" rx="4.2" ry="1.7" fill="#6bab4c" transform="rotate(22 99 61)"/>
        <circle class="mbloom" cx="108" cy="61" r="4.4"/>
        <circle cx="108" cy="61" r="1.6" fill="#e0a032" opacity=".8"/>
      </g><g class="mf-item" transform="translate(94.8 52.2) scale(.68)"></g></g>
      <g class="paws" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
        <ellipse cx="84" cy="61" rx="4" ry="5"/>
        <ellipse cx="98" cy="61" rx="4" ry="5"/>
      </g>
      <g class="hd fear">${EAR(101, 27, 'f')}</g>
      <g class="epaws" fill="${PK('paw')}" stroke="${OUT}" stroke-width="1.4">
        <ellipse cx="103.5" cy="44" rx="3.8" ry="4.8" transform="rotate(-20 103.5 44)"/>
        <ellipse cx="110.5" cy="40" rx="3.8" ry="4.8" transform="rotate(-20 110.5 40)"/>
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
      <g class="hd"><g class="cap">
        <path d="M77 28 Q80 12 62 9 Q91 0 103 27 Z" fill="${PK('cap')}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="79" cy="17" r="1.3" fill="${PK('cpw')}" opacity=".8"/>
        <circle cx="88" cy="13" r="1.3" fill="${PK('cpw')}" opacity=".8"/>
        <circle cx="91" cy="22" r="1.3" fill="${PK('cpw')}" opacity=".8"/>
        <path d="M76 28 Q90 22 104 27" stroke="${PK('cpw')}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="62" cy="9" r="4.2" fill="${PK('cpw')}" stroke="${OUT}" stroke-width="1.2"/>
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
      </g>${GIFT_SHADES}</g>
      <g class="scarf">
        <path d="M68 63 Q87 73 107 63" stroke="#d9534f" stroke-width="6.5" fill="none" stroke-linecap="round"/>
        <path d="M70 64 Q87 73.5 105 64.6" stroke="#f6f1ea" stroke-width="1.6" fill="none" stroke-dasharray="3 4"/>
        <path d="M73 66 L69 80 L76.5 80.6 L79 67.5Z" fill="#d9534f" stroke="#a83a37" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M70.5 75 L77.5 75.6" stroke="#f6f1ea" stroke-width="1.4"/>
      </g>
      ${ACT_FRONT}
      ${GIFT_FRONT}
      ${CUP_SVG}
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
  // Geburtsdatum → [Monat, Tag] oder null. Als Text "MM-TT", "JJJJ-MM-TT" (auch mit Uhrzeit), "TT.MM." oder
  // "TT.MM.JJJJ". Ohne Anführungszeichen macht YAML daraus andere Typen: 1990-03-14 → Date-Objekt (Tag aus dem
  // Datumsteil, UTC); 14.03 → Zahl 14.03, 14.10 → Zahl 14.1. Eine Nachkommastelle: ",1" kann nur der Oktober
  // sein (der Januar steht mit Null da: 14.01), ",2"…",9" ist der Monat selbst (14.2 → 14. 2.; 20…90 gibt es nicht).
  const festBirthdate = (v) => {
    let bm;
    let bd;
    if (v instanceof Date) {
      if (isNaN(v)) return null;
      [bm, bd] = [v.getUTCMonth() + 1, v.getUTCDate()];
    } else if (typeof v === 'number') {
      const m = String(v).match(/^(\d{1,2})(?:\.(\d{1,2}))?$/);
      if (!m || !m[2]) return null;
      [bd, bm] = [Number(m[1]), m[2] === '1' ? 10 : Number(m[2])];
    } else {
      const s = String(v ?? '').trim();
      let m = s.match(/^(?:\d{4}-)?(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/i);
      if (m) [bm, bd] = [Number(m[1]), Number(m[2])];
      else if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(?:\d{2}|\d{4})?$|^(\d{1,2})\.(\d{1,2})$/))) {
        [bd, bm] = [Number(m[1] ?? m[3]), Number(m[2] ?? m[4])];
      } else return null;
    }
    return bm >= 1 && bm <= 12 && bd >= 1 && bd <= 31 ? [bm, bd] : null;
  };
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
    return `<g class="fbl" style="animation-delay:${(-(i % 3) * 0.93).toFixed(2)}s">`
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
  /* Flammen flackern in Stufen (ein Kerzenflackern ist ohnehin sprunghaft): Kranz und Kuchen stehen tage- und
     wochenlang, so wird ihr SVG nur etwa neunmal pro Sekunde neu gemalt */
  .flm { transform-box: fill-box; transform-origin: 50% 100%; animation: fflame .45s steps(4) infinite alternate; }
  @keyframes fflame { from { transform: scale(.88, 1.06) rotate(-5deg); } to { transform: scale(1.06, .9) rotate(4deg); } }
  /* Lämpchen in drei Gruppen, die im Wechsel blinken (Verzögerung je Gruppe), in Stufen: wenige Neuzeichnungen pro
     Sekunde statt jedes Bild für jedes Lämpchen einzeln */
  .dusk .fbl, .night .fbl { animation: fblink 2.8s steps(6) infinite alternate; }
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
  /* Leuchten über einen Verlauf statt box-shadow: der Schatten müsste bei jedem Bild weichgezeichnet werden */
  .fwb .fwp {
    width: calc(var(--H) * .036); height: calc(var(--H) * .036); margin: calc(var(--H) * -.018);
    background: radial-gradient(closest-side, #fff 0, var(--c) 32%, transparent);
  }
  .fwb .fws { width: 6px; height: 6px; margin: -3px; background: radial-gradient(closest-side, #fffbe8 0, rgba(255, 240, 190, .8) 40%, transparent); }
  .fwb .fwc {
    width: calc(var(--H) * .07); height: calc(var(--H) * .07); margin: calc(var(--H) * -.035);
    background: radial-gradient(closest-side, #fff, var(--c) 45%, transparent); animation: fwc .5s ease-out forwards;
  }
  @keyframes fwc { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.7); opacity: 0; } }
  .fest-f > .fwl { opacity: 0; background: radial-gradient(ellipse 95% 85% at var(--fx, 50%) var(--fy, 20%), var(--fc, #fff), transparent 80%); }
  .fest-f > .fwl.go { animation: fwl 1.1s ease-out; }
  @keyframes fwl { 8% { opacity: .2; } 100% { opacity: 0; } }
  .fcf i { position: absolute; top: 0; display: block; }
  /* Weniger Bewegung gewünscht: Wimpel und Maibaum-Bänder hängen still (Teilchen spart das Skript, calmMotion) */
  @media (prefers-reduced-motion: reduce) {
    .fpn, .fmai .rb { animation: none !important; }
  }
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

  // Ein Maulvoll Heu (Heu-Snack am Haufen), gleiche Größe wie die Leckerli aus den Päckchen (24 × 24)
  const HAY_BITE = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-linecap="round">
    <path d="M2 13.5 L21 9 M3 17 L22 13.5 M4.5 10 L20 17.5" stroke="#b8963f" stroke-width="2.6"/>
    <path d="M2 13.5 L21 9 M3 17 L22 13.5 M4.5 10 L20 17.5 M6 19.5 L18.5 7" stroke="#dcbc6a" stroke-width="1.6"/>
    <path d="M5 15 L19 11.6" stroke="#f0d98e" stroke-width="1"/></g></svg>`;
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
  // Besuchsplan wie bei Vögelchen und Maus aus der Uhr: 30-Minuten-Fenster, in jedem ein Besuch (p 1), Start in den
  // ersten 20 Minuten, Dauer 3–6 Minuten (spread + Dauer < Fenster), Seite links/rechts – alles aus
  // seedRnd('friend', fenster, n). Bis 0.14 waren es 45-Minuten-Fenster mit 1,5–4 Minuten: kaum je zu sehen.
  const FRIEND_WIN = { win: 30 * 6e4, p: 1, spread: 20 * 6e4, stay: [3, 6] };
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
  // Frosch (viewBox 30 × 22, Füße bei y 22, schaut nach rechts). Sitzend ist das Hinterbein gefaltet (.fhl), im
  // Sprung gestreckt (.fxl). .fsac ist die Schallblase (bläht sich beim Quaken), .ftng die Zunge, .flid das Lid.
  const FOUT = '#35581f';
  const FROG_SVG = `
  <svg viewBox="0 0 30 22" aria-hidden="true">
    <g class="fxl" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 16.4 L2.4 19.6 L-3.6 23.4" stroke="${FOUT}" stroke-width="4"/>
      <path d="M9 16.4 L2.4 19.6 L-3.6 23.4" stroke="#62a441" stroke-width="2.4"/>
      <path d="M-3.6 23.4 L-7 23 M-3.6 23.4 L-6.4 25.4" stroke="${FOUT}" stroke-width="1.5"/>
    </g>
    <path d="M5 19.5 Q3.4 14 9 11 Q15 7.2 21.5 7.6 Q27.8 8.2 28.2 12.4 Q28.3 15 24.8 16.6 Q22 20.5 14 20.7 Q6 20.9 5 19.5Z"
      fill="#74b64d" stroke="${FOUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M11.6 20.2 Q19.6 20.6 24.4 16.4 Q26.8 15.4 27.7 13.5 Q24 15.5 19 16.6 Q13.8 17.7 11.6 20.2Z" fill="#e6efb2"/>
    <ellipse class="fsac" cx="25" cy="16.9" rx="4.2" ry="3.5" fill="#f4f6cf" stroke="${FOUT}" stroke-width=".7"/>
    <g fill="#5a9a3b"><circle cx="11" cy="13.2" r="1.05"/><circle cx="14.8" cy="10.7" r=".8"/><circle cx="8.3" cy="15.8" r=".7"/></g>
    <circle cx="21.2" cy="7.3" r="3.1" fill="#74b64d" stroke="${FOUT}" stroke-width=".9"/>
    <circle cx="21.7" cy="7.1" r="2" fill="#fdf6c9"/>
    <ellipse cx="22.2" cy="7.2" rx="1" ry="1.35" fill="#1f1a17"/><circle cx="22.6" cy="6.6" r=".4" fill="#fff"/>
    <circle class="flid" cx="21.7" cy="7.1" r="2.15" fill="#74b64d"/>
    <path class="ftng" d="M27.4 13.2 Q32 12.6 36.4 8.4" stroke="#f07a95" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M27.8 13.1 Q23.6 14.9 19.6 13.3" stroke="${FOUT}" stroke-width=".7" fill="none" stroke-linecap="round"/>
    <circle cx="27" cy="10.7" r=".4" fill="${FOUT}"/>
    <circle cx="19.8" cy="12.3" r="1.3" fill="#f28fb1" opacity=".5"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.4 16.6 Q19.7 19.4 21 21.1 H24" stroke="${FOUT}" stroke-width="2.7"/>
      <path d="M20.4 16.6 Q19.7 19.4 21 21.1 H24" stroke="#74b64d" stroke-width="1.3"/>
    </g>
    <g class="fhl">
      <path d="M4.6 19.6 Q3 13.6 9.4 13 Q14.4 12.8 14 17.6 Q13.6 20.4 10 20.6Z" fill="#62a441" stroke="${FOUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M6 20.2 Q11 19.5 16.8 20.7 Q17.8 21.2 17 21.8 H6.4 Q5.2 21.3 6 20.2Z" fill="#74b64d" stroke="${FOUT}" stroke-width=".8" stroke-linejoin="round"/>
    </g>
  </svg>`;
  // Schnecke (viewBox 30 × 20, Sohle bei y 20, schaut nach rechts). .sbody zieht sich ins Haus zurück (.hide),
  // .sfeel sind die Fühler mit den Augen. Hausfarben: [Haus, Spirale].
  const SNAILS = [['#d99a5b', '#8a5a2c'], ['#f0d27a', '#a8792c'], ['#e9a7a0', '#a85f5a']];
  const SNAIL_SVG = ([shell, line]) => `
  <svg viewBox="0 0 30 20" aria-hidden="true">
    <g class="sbody">
      <g class="sfeel" stroke="#7a5a3a" stroke-width=".9" stroke-linecap="round">
        <path d="M25 10.4 L23.8 5.2 M27.3 10.4 L28.6 5.8"/>
        <circle cx="23.7" cy="4.5" r="1.1" fill="#1f1a17" stroke="none"/><circle cx="28.8" cy="5.1" r="1.1" fill="#1f1a17" stroke="none"/>
        <circle cx="24" cy="4.2" r=".35" fill="#fff" stroke="none"/><circle cx="29.1" cy="4.8" r=".35" fill="#fff" stroke="none"/>
      </g>
      <path d="M1.6 19.3 Q4 17.3 10 17.4 L19 17.4 Q22.2 17.2 22.8 13.6 Q23.4 9.8 26.1 9.8 Q28.9 10 28.6 13.8 Q28.2 19.5 22 19.7 H3 Q1 19.8 1.6 19.3Z"
        fill="#ecd6ac" stroke="#7a5a3a" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M26.3 14.7 q1 .8 1.8 -.1" stroke="#7a5a3a" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <circle cx="25" cy="15.6" r="1" fill="#f28fb1" opacity=".5"/>
    </g>
    <g class="sshell">
      <circle cx="12.6" cy="10" r="8" fill="${shell}" stroke="#6b4a2f" stroke-width="1"/>
      <path d="M18.2 10 A5.6 5.6 0 0 0 7 10 A4.3 4.3 0 0 0 15.6 10 A3 3 0 0 0 9.6 10 A1.9 1.9 0 0 0 13.4 10" stroke="${line}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M6.9 6.4 Q9 3.6 12.4 3.2" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".55"/>
    </g>
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

  // ==================== Kaffee: Konstanten und Stil ====================
  // Getränkeprogramme (Home Connect): "…_program_beverage_<name>" bzw. "…_program_coffee_world_<name>".
  // Spülen und Reinigen setzen kein aktives Programm.
  const COFFEE_PROG = /beverage|coffee_world/;
  // Programmname → Gefäß (Reihenfolge zählt: "latte_macchiato" vor "macchiato")
  const COFFEE_KIND = [
    [/latte_macchiato|caffe_latte|galao/, 'latte'],
    [/milk_froth|warm_milk/, 'milk'],
    [/cappuccino|flat_white|cortado|melange|au_lait|con_leche|brauner|macchiato|mocha|with_milk/, 'capp'],
    [/ristretto|espresso/, 'esp'],
    [/hot_water|tea/, 'tea'],
  ];
  const coffeeKind = (prog) => (COFFEE_KIND.find(([re]) => re.test(prog)) || [0, 'mug'])[1];
  // Gefäß in der Grafik, Schlucke bis leer, Milchschaum-Bärtchen
  const COFFEE_CUP = { latte: 'glass', milk: 'glass', capp: 'capp', esp: 'esp', mug: 'mug', tea: 'mug' };
  const COFFEE_SIPS = { latte: 8, milk: 6, capp: 6, esp: 3, mug: 7, tea: 7 };
  const COFFEE_FOAM = new Set(['latte', 'milk', 'capp']);
  const coffeeName = (prog, kind) => (/cappuccino/.test(prog) ? 'Cappuccino!' : /flat_white/.test(prog) ? 'Flat White!'
    : { latte: 'Latte!', milk: 'Milch!', esp: 'Espresso!', tea: 'Tee!' }[kind] || 'Kaffee!');
  // Zeitleiste ab Bezugsende (auf allen Geräten dieselbe): so lange dauert das Holen, danach genießt er das Getränk
  // COFFEE_DRINK ms lang (× 0,85–1,15 fest je Bezug), die Schlucke gleichmäßig verteilt. So lange, damit man ihn
  // noch trinken sieht, wenn man mit der Tasse vom Automaten zum Tablet kommt. Wer später einsteigt (Neuladen,
  // Bildschirm an), steht gleich mit dem passend leeren Gefäß da; ist es überall ausgetrunken, gibt es nichts mehr.
  const COFFEE_FETCH = 13000;
  // Ohne live gesehenen Bezug: so lange darf das Programm höchstens nach dem Hochzählen des Zählers enden
  const COFFEE_CTR_MS = 3 * 60000;
  // So lange nach dem letzten Schluck nach Plan darf ein unterbrochenes Trinken noch weitergehen, danach verfällt es
  const COFFEE_LATE = 30000;
  const COFFEE_DRINK = { latte: 240000, milk: 180000, capp: 210000, esp: 120000, mug: 210000, tea: 240000 };
  const COFFEE_CLS = [...new Set([...Object.values(COFFEE_CUP), ...Object.keys(COFFEE_CUP)])].map((k) => `ck-${k}`);
  // Denkblase beim Schnuppern: Tasse mit Dampf
  const COFFEE_THINK = `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 8 q-1.4 -2 0 -4 q1.4 -2 0 -4 M12.5 8 q-1.4 -2 0 -4 q1.4 -2 0 -4" fill="none" stroke="#b9a48c" stroke-width="1.3" stroke-linecap="round" transform="translate(0 2)"/>
    <path d="M17.4 12.4 q4.2 0 4.2 3.4 q0 3.4 -4.4 3.2" fill="none" stroke="#6b4428" stroke-width="1.8"/>
    <path d="M3 11 H18 Q18 21.5 10.5 21.5 Q3 21.5 3 11Z" fill="#f6f1ea" stroke="#6b4428" stroke-width="1.2"/>
    <ellipse cx="10.5" cy="11" rx="7.5" ry="1.6" fill="#b07a4c"/></svg>`;

  // ---------- Mimik, Streicheln, kleine Momente, Träume, Geschenk ----------
  // Zeichen über dem Kopf (_emote)
  const EMOTE = {
    q: '?',
    ex: '!',
    drop: `<svg viewBox="0 0 10 14"><path d="M5 .5 C7 4.2 9.5 6.8 9.5 9.4 A4.5 4.5 0 0 1 .5 9.4 C.5 6.8 3 4.2 5 .5Z" fill="#a8dcff" stroke="#4f86b8" stroke-width="1"/>
      <path d="M3.2 9 q0 1.8 1.6 2.4" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="#fff6b0" stroke="#e0a032" stroke-width=".8" stroke-linejoin="round">
      <path d="M8 2 Q9 7 14 8 Q9 9 8 14 Q7 9 2 8 Q7 7 8 2Z"/><path d="M18 10 Q18.6 13.4 22 14 Q18.6 14.6 18 18 Q17.4 14.6 14 14 Q17.4 13.4 18 10Z"/>
      <path d="M7 16 Q7.4 18.6 10 19 Q7.4 19.4 7 22 Q6.6 19.4 4 19 Q6.6 18.6 7 16Z"/></svg>`,
    grump: `<svg viewBox="0 0 28 18"><path d="M7 16 Q1 16 1.5 11 Q2 7 6.5 7.5 Q7.5 2 13 2.5 Q18.5 2 20 6.5 Q26.5 6 26.5 11.5 Q26.5 16 21 16Z"
      fill="#c9ced8" stroke="#6f7686" stroke-width="1.2"/><path d="M9.5 10.5 l2.4 1.4 M18.5 10.5 l-2.4 1.4 M11.5 13.6 q2.5 -1.4 5 0" stroke="#5c6272" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
  };
  // Schmetterling von vorn (viewBox 20 × 16, Körper bei x 10), Flügel schlagen um die Mitte
  const BFLY_COLORS = [['#ffb347', '#e07b1a'], ['#8fc4ff', '#4f86c6'], ['#f6a5c8', '#d4669a'], ['#fff2a0', '#d9b640'], ['#c7b2ff', '#8a6fd9']];
  const BFLY_SVG = ([c, d]) => `<svg viewBox="0 0 20 16" aria-hidden="true">
    <g class="bwl"><path d="M10 7.5 C6.5 .5 .8 .6 1 5 C1.2 7.6 4.4 8.6 7 8.4 C3.2 9.6 2.6 14.6 6.4 14.4 C8.6 14.2 9.8 11.4 10 9Z" fill="${c}" stroke="${d}" stroke-width=".8"/>
      <circle cx="4.6" cy="4.8" r="1.3" fill="${d}" opacity=".6"/></g>
    <g class="bwr"><path d="M10 7.5 C13.5 .5 19.2 .6 19 5 C18.8 7.6 15.6 8.6 13 8.4 C16.8 9.6 17.4 14.6 13.6 14.4 C11.4 14.2 10.2 11.4 10 9Z" fill="${c}" stroke="${d}" stroke-width=".8"/>
      <circle cx="15.4" cy="4.8" r="1.3" fill="${d}" opacity=".6"/></g>
    <ellipse cx="10" cy="8.6" rx="1" ry="4" fill="#4a3628"/>
    <path d="M9.6 4.8 Q8.6 2.4 7.4 1.8 M10.4 4.8 Q11.4 2.4 12.6 1.8" stroke="#4a3628" stroke-width=".55" fill="none" stroke-linecap="round"/></svg>`;
  // Geschenk: liegende Blüte mit großer rosa Schleife (viewBox 34 × 16)
  const GIFT_SVG = (c) => `<svg viewBox="0 0 34 16" aria-hidden="true">
    <path d="M2 13 Q13 11.6 24 8.6" stroke="#4f8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="9" cy="10.4" rx="3.6" ry="1.5" fill="#6bab4c" transform="rotate(-24 9 10.4)"/>
    <g fill="${c}" stroke="rgba(0,0,0,.15)" stroke-width=".5">
      ${[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180;
        return `<circle cx="${(27 + Math.sin(r) * 3.6).toFixed(2)}" cy="${(7.6 - Math.cos(r) * 3.6).toFixed(2)}" r="3.2"/>`;
      }).join('')}
    </g>
    <circle cx="27" cy="7.6" r="1.7" fill="#e0a032"/>
    <g fill="#f2789f" stroke="#b8406a" stroke-width=".5" stroke-linejoin="round" transform="translate(15 11) scale(1.45) translate(-15 -11)">
      <path d="M15 11 L10.8 7.6 L11.4 12.6Z"/><path d="M15 11 L19.4 8.4 L18.6 13.2Z"/>
      <path d="M15 11 L13.2 15.4 M15 11 L16.6 15.2" fill="none" stroke-linecap="round"/>
      <circle cx="15" cy="11" r="1.2"/></g></svg>`;
  // Traummotive (Denkblase im Schlaf). Was er am Tag erlebt hat, träumt er öfter (_memo).
  const DREAM = {
    lz: FOOD.lz.svg,
    klee: FOOD.klee.svg,
    coffee: COFFEE_THINK,
    heart: ICON_HEART,
    pino: `<svg viewBox="0 0 24 24" stroke="#5a4030" stroke-width="1">
      <circle cx="6.6" cy="6.4" r="4" fill="#f2b36e"/><circle cx="17.4" cy="6.4" r="4" fill="#f2b36e"/>
      <circle cx="6.6" cy="6.8" r="2.1" fill="#f0a184" stroke="none"/><circle cx="17.4" cy="6.8" r="2.1" fill="#f0a184" stroke="none"/>
      <ellipse cx="12" cy="13.2" rx="9" ry="7.4" fill="#f2b36e"/>
      <ellipse cx="12" cy="8.8" rx="2.2" ry="1.4" fill="#fbf0e2" stroke="none"/>
      <circle cx="8.4" cy="12.4" r="1.3" fill="#2a1a12" stroke="none"/><circle cx="15.6" cy="12.4" r="1.3" fill="#2a1a12" stroke="none"/>
      <ellipse cx="12" cy="15.8" rx="3" ry="2.2" fill="#fbe7cb" stroke="none"/>
      <path d="M11 14.6 h2 l-1 1z" fill="#7a4438" stroke="none"/>
      <path d="M5.2 19 Q12 23.4 18.8 19 L12 23.6Z" fill="#3fb6a8"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" stroke="#5a6a7a" stroke-width=".8" stroke-linejoin="round">
      <path d="M2.6 13.6 L20.4 10.6 Q23 10.4 22 12.4 L5 15.6Z" fill="#eef3f8"/>
      <path d="M10.4 12.4 L13.4 5.8 H15.4 L14.4 11.8Z" fill="#dfe7ef"/><path d="M11 14.6 L14.6 19.4 H16.6 L14.8 14Z" fill="#dfe7ef"/>
      <path d="M3.2 13.4 L1.8 8.6 H3.6 L6.4 13Z" fill="#d9473b"/></svg>`,
    bird: `<svg viewBox="0 0 24 24" stroke="#5a4030" stroke-width=".9">
      <circle cx="11.5" cy="13" r="7.6" fill="#8a6a50"/><circle cx="13.4" cy="15" r="4.8" fill="#e8743b" stroke="none"/>
      <path d="M6 14.6 Q8.6 12 11.4 15.4" fill="#6f523d"/><circle cx="14.6" cy="10.4" r="1.1" fill="#2a1a12" stroke="none"/>
      <path d="M18.6 10.4 L22 11.6 L18.8 12.8Z" fill="#f2b53c"/></svg>`,
    note: `<svg viewBox="0 0 24 24"><path d="M9 18 V6.2 L19 4 V15.6" stroke="#5a4030" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
      <ellipse cx="6.8" cy="18" rx="2.8" ry="2.1" fill="#5a4030"/><ellipse cx="16.8" cy="15.8" rx="2.8" ry="2.1" fill="#5a4030"/></svg>`,
    bfly: BFLY_SVG(BFLY_COLORS[0]),
  };
  // Neue kleine Momente. Leicht genug, dass der Beginn einer Beschäftigung aus dem Tagesplan sie abbricht.
  const CUTE_SMALL = ['curious', 'yawn', 'sneeze', 'earClean', 'scratch', 'hiccup', 'nod', 'butterfly', 'zoomies', 'gift', 'comeHere'];
  // Dabei darf Streicheln eine eigene Reaktion starten (sonst nur Herzchen und Hüpfer obendrauf)
  const PET_FREE = new Set(['idle', 'look', 'wander', 'groom', 'squeak', 'sniff', 'binky', 'hungry', 'watchBird', 'watchMouse',
    'watchFrog', 'watchSnail', 'watchPlane', 'curious', 'yawn', 'earClean', 'scratch', 'nod', 'hiccup', 'comeHere', 'petReact', 'stroke', 'gift']);
  // Reaktionen auf Berührung, die über _next laufen: verfallen nach TOUCH_TTL, wenn Wichtigeres vorging
  const TOUCH_NEXT = new Set(['petReact', 'kraul', 'stroke', 'comeHere']);
  const TOUCH_TTL = 2000;
  // Zustandsklassen der neuen Momente, die _cleanup zurücksetzt (zeitgesteuerte wie blush, mlem, lnd gehen von selbst)
  const CUTE_CLS = ['tilt', 'tilt-b', 'content', 'squint', 'flat', 'crosseye', 'lean', 'tickle', 'roll', 'melt', 'thump',
    'yawning', 'presneeze', 'sneezing', 'earwash', 'scratching', 'nodding', 'stumble', 'pant', 'trip', 'bighop'];

  const STYLE_COFFEE = `
  .cup, .cfoam, .cup > g > g, .cup .ttag, .cup .cst { display: none; }
  .coffee .cup { display: inline; }
  .ck-glass .cup .k-glass, .ck-capp .cup .k-capp, .ck-esp .cup .k-esp, .ck-mug .cup .k-mug, .ck-tea .cup .ttag { display: inline; }
  .ck-milk .cup .cof { fill: #f7efe2; }
  .ck-tea .cup .lqs { fill: #c98a3a; }
  /* Glas sinkt (Inhalt kleiner), Tassen: Schaum/Crema verschwindet und gibt den dunklen Rest frei */
  .cup .lq { transform-box: fill-box; transform-origin: 50% 100%; transform: scaleY(var(--lv, 1)); transition: transform 1.2s ease; }
  .cup .lqs { opacity: var(--lv, 1); transition: opacity 1.2s; }
  /* Schluck: Gefäß samt Pfoten an den Mund, Augen zu */
  .cup { transform-box: view-box; transform-origin: 92px 74px; transition: transform .45s cubic-bezier(.45, 0, .4, 1); }
  .pika.ck-glass { --cupy: -8px; }
  .pika.ck-capp { --cupy: -14px; }
  .pika.ck-esp { --cupy: -18px; }
  .pika.ck-mug, .pika.ck-tea { --cupy: -10.5px; }
  .sip .cup { transform: translate(-1px, var(--cupy, -9px)) rotate(-14deg); }
  .sip .eye { display: none; }
  .sip .seye { display: inline; }
  .coffee:not(.sip) .face { transform: translate(.6px, 1.4px); }
  .foam .cfoam { display: inline; }
  .lick .omouth { display: inline; }
  /* Dampf nur, solange es heiß ist (und nur dann animiert) */
  .coffee.hot .cup .cst { display: inline; }
  .coffee.hot .cup .cst path { opacity: 0; transform-box: fill-box; animation: cst 2.6s ease-out infinite; }
  .coffee.hot .cup .cst path + path { animation-delay: 1.3s; }
  @keyframes cst {
    from { opacity: 0; transform: translateY(1.5px) scaleY(.8); }
    35% { opacity: .75; }
    to { opacity: 0; transform: translateY(-6px) scaleY(1.15); }
  }
  /* Bei Regen hält die rechte Pfote den Blattschirm */
  .pika.wet:not(.inside) .cup .cpr { display: none; }
  `;
  // ==================== Ende Kaffee ====================

  // ==================== Aktivitäten: Konstanten, Grafiken und Stil ====================
  // Tagesplan: Beschäftigungen kommen aus der Uhrzeit (seedRnd), damit alle Geräte zur selben Zeit dasselbe zeigen
  // und ein neu geladenes Gerät mitten in die laufende einsteigt.
  // - Groß (Lesen, Gameboy, Tablet, Drachen, TV, Musik, Malen, Seifenblasen, Frühsport; 1–2,5 Min): die Uhr ist in
  //   Fenster von ACT_WIN.big geteilt, in jedem beginnt eine in den ersten ACT_WIN.spread. Abstand also 9–19 Min.
  // - Klein (Seilspringen, Gewichtheben, Blüte für den Vorrat sammeln; 10–30 s): Fenster ACT_WIN.mini, mit
  //   Wahrscheinlichkeit ACT_WIN.miniP, nie dicht an einer großen.
  // - Welche es wird, hängt am Wetter (auf allen Geräten dasselbe), an der Tagesform und am Verlauf: Die letzten
  //   ACT_RECENT großen kommen nicht gleich wieder dran. Der Verlauf liegt im Helfer plan_entity; wer ein Fenster
  //   zuerst beginnt, trägt es dort ein, die anderen übernehmen die Wahl (auch wenn sich das Wetter inzwischen änderte).
  // - Tagesform: je Kalendertag zwei Lieblinge (× 2) und eine Unlust (× 0,2) aus ACT_MOOD, aus dem Datum gewürfelt.
  // - Schaut keiner hin (Bildschirm aus), lässt das Gerät die Beschäftigungen aus; geht er an, steigt es ein.
  const ACT_WIN = { big: 14 * 6e4, spread: 5 * 6e4, mini: 4 * 6e4, miniP: 0.8, miniRoom: 50000 };
  // Rund um den Beginn einer großen keine kleine (davor / danach in ms)
  const ACT_GAP = [45000, 200000];
  const WEIGHT_REP = 9000; // eine Wiederholung Gewichtheben
  // Dauer des Hauptteils in ms (ohne Hinlaufen ACT_WALK und Ausklang), aus den festen Zahlen r(1…) des Fensters
  const ACT_WALK = 5000;
  const ACT_LEN = {
    read: (r) => 50000 + r(1) * 50000,
    game: (r) => 35000 + r(1) * 35000,
    tablet: (r) => 45000 + r(1) * 45000,
    kite: (r) => 40000 + r(1) * 40000,
    tv: (r) => 60000 + r(1) * 70000,
    music: (r) => 60000 + r(1) * 50000,
    paint: (r) => 30000 + r(1) * 15000,
    bubbles: (r) => 45000 + r(1) * 35000,
    sport: (r) => sportPlan(r).len - ACT_WALK,
    rope: (r) => 600 + ropeJumps(r) * (620 + r(4) * 100),
    weights: (r) => 600 + (1 + Math.floor(r(1) * 3)) * WEIGHT_REP,
    gather: () => 9000,
  };
  const ropeJumps = (r) => 12 + Math.floor(r(5) * 18);
  // Einsteigen nach Neuladen oder Bildschirm an: bis so viele ms vor dem Ende des Hauptteils. Die kleinen nur gleich
  // zu Beginn (sie sind schnell vorbei).
  const ACT_JOIN_END = 4000;
  const ACT_NOJOIN = new Set(['gather', 'rope', 'weights']);
  // Beginn der großen im Fenster k bzw. der kleinen im Fenster m (Planzeit, ms)
  const bigStart = (k) => k * ACT_WIN.big + Math.floor(seedRnd('big', k, 0) * ACT_WIN.spread);
  const miniStart = (m) => m * ACT_WIN.mini + Math.floor(seedRnd('mini', m, 1) * (ACT_WIN.mini - ACT_WIN.miniRoom));
  const miniHas = (m) => seedRnd('mini', m, 0) < ACT_WIN.miniP;
  // Kalendertag (Ortszeit) als Zahl
  const localDay = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / 864e5);
  // Kleinigkeiten, die der Beginn einer Beschäftigung aus dem Plan sofort abbricht
  const ACT_SMALL = ['idle', 'look', 'wander', 'groom', 'squeak', 'sniff', 'binky', 'hungry', 'lookout', 'burrow', 'nibble',
    'haySnack', 'hideout', 'watchBird', 'watchMouse', 'watchFrog', 'watchSnail', 'watchPlane', ...CUTE_SMALL];
  const ACT_BIG = ['read', 'game', 'tablet', 'kite', 'tv', 'music', 'paint', 'bubbles', 'sport'];
  const ACT_MOOD = ['read', 'game', 'tablet', 'music', 'paint', 'bubbles'];
  // Beschäftigungen, die beginnender Regen oder Schnee abbricht, wenn sie bei diesem Wetter nicht gehen (_actOk)
  const WX_STOP = [...ACT_BIG, 'rope', 'weights', 'gather'];
  const ACT_RECENT = 3;
  // Wird die Karte sichtbar (Bildschirm an, App geöffnet, Ansicht gewechselt), winkt er; höchstens alle 5 Minuten.
  const ACT_SHOW_COOL = 5 * 6e4;
  const ACT_GREET = ['Hallo!', 'Hi!', 'Da bist du ja!', 'iiep!', 'Hallöchen!', 'Huhu!'];
  const ACT_CLS = ['waving', 'music', 'sing', 'painting', 'dab', 'mix', 'blowing', 'blow', 'sport', 'jjack', 'knee',
    'roping', 'rope-hold', 'rdbl', 'lifting', 'lift-gnd', 'lift-lo', 'lift-hi', 'strain', 'stretch', 'bowing', 'smudge'];
  // Frühsport nur morgens: 10–180 Minuten nach dem Aufwachen, einmal am Tag (im Helfer plan_entity vermerkt)
  const SPORT_WIN = [10, 180];
  const SPORT_INTRO = 1700;
  const SPORT_PAUSE = 1700; // nach jeder Übung: verschnaufen, schwitzen
  // Ablauf des Frühsports aus den festen Zahlen des Fensters: 3 oder 4 Übungen mit Beginn t (ms ab Fensterbeginn),
  // Dauer und Wiederholungen. len reicht vom Beginn des Fensters (mit Hinlaufen) bis zum Ende der letzten Übung.
  const sportPlan = (r) => {
    const all = ['jjack', 'knee', 'jog', 'stretch'];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(r(20 + i) * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const segs = all.slice(0, r(30) < 0.4 ? 4 : 3).map((ex, i) => {
      if (ex === 'jjack') {
        const rep = (0.62 + r(40 + i) * 0.18) * 1000;
        const reps = 10 + Math.floor(r(50 + i) * 7);
        return { ex, rep, reps, len: rep * reps };
      }
      if (ex === 'knee') {
        const reps = 6 + Math.floor(r(50 + i) * 5);
        return { ex, rep: 1400, reps, len: 1400 * reps };
      }
      if (ex === 'jog') return { ex, len: 8000 + r(50 + i) * 4000 };
      return { ex, len: 3200 };
    });
    let t = ACT_WALK + SPORT_INTRO;
    for (const s of segs) {
      s.t = t;
      t += s.len + SPORT_PAUSE;
    }
    return { segs, len: t };
  };

  // Staffelei (viewBox 60 × 80): Leinwand x 9–51, y 7–51. Das Bild entsteht in fünf Schichten (Himmel, Sonne oder
  // Mond, Hügel, Motiv, Kleinkram); der Himmel folgt der Tageszeit der Szene. Motiv: [Pinselfarbe, Grafik]
  const EASEL_MOTIF = {
    blume: ['#f28fb1', `<path d="M24 47 V37" stroke="#4f8a3a" stroke-width="1.2"/>
      <ellipse cx="26.6" cy="42.2" rx="2.6" ry="1" fill="#5fae4a" transform="rotate(-30 26.6 42.2)"/>
      <g fill="#f28fb1"><circle cx="24" cy="32.8" r="2.1"/><circle cx="26.7" cy="34.9" r="2.1"/><circle cx="21.3" cy="34.9" r="2.1"/>
      <circle cx="25.7" cy="37.7" r="2.1"/><circle cx="22.3" cy="37.7" r="2.1"/></g><circle cx="24" cy="35.6" r="1.6" fill="#f6c945"/>`],
    pika: ['#c49a74', `<circle cx="23.4" cy="38.4" r="2.4" fill="#b08a68" stroke="#5a4030" stroke-width=".5"/>
      <circle cx="29.2" cy="38.2" r="2.4" fill="#b08a68" stroke="#5a4030" stroke-width=".5"/>
      <ellipse cx="26.4" cy="43.6" rx="6.8" ry="4.9" fill="#c49a74" stroke="#5a4030" stroke-width=".6"/>
      <circle cx="24.4" cy="42.4" r=".75" fill="#2a1a12"/><circle cx="28.6" cy="42.4" r=".75" fill="#2a1a12"/>
      <ellipse cx="26.5" cy="44.2" rx="1.1" ry=".65" fill="#7a4438"/>`],
    pino: ['#f2b36e', `<circle cx="23.4" cy="38.4" r="2.4" fill="#dc8640" stroke="#5a4030" stroke-width=".5"/>
      <circle cx="29.2" cy="38.2" r="2.4" fill="#dc8640" stroke="#5a4030" stroke-width=".5"/>
      <ellipse cx="26.4" cy="43.6" rx="6.8" ry="4.9" fill="#f2b36e" stroke="#5a4030" stroke-width=".6"/>
      <path d="M21 46.4 Q26.4 48.6 31.8 46.4" stroke="#3fb8b0" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle cx="24.4" cy="42.4" r=".75" fill="#2a1a12"/><circle cx="28.6" cy="42.4" r=".75" fill="#2a1a12"/>`],
    bau: ['#8a6a4a', `<path d="M12 48 Q25 26 40 48Z" fill="#8a6a4a" stroke="#5a4030" stroke-width=".6"/>
      <path d="M22.6 48 V43 a3.2 3.2 0 0 1 6.4 0 V48Z" fill="#5fae4a" stroke="#3f7f31" stroke-width=".5"/>
      <circle cx="33" cy="40.6" r="1.7" fill="#ffe08a" stroke="#5a4030" stroke-width=".5"/>`],
    flieger: ['#f4f6f8', `<path d="M12 23 L27 16.4" stroke="#fff" stroke-width="1" opacity=".85" stroke-dasharray="2 1.4"/>
      <path d="M27 16.6 l6 -1.4 l-2 -2.4 h1.4 l3.6 2 l3 -.6 q1.4 .4 .2 1 l-3 .7 l-3 2.6 h-1.4 l1.6 -2.6 l-5.6 1.2z"
            fill="#f4f6f8" stroke="#5a6470" stroke-width=".4"/>`],
    regenbogen: ['#e8584e', ['#e8584e', '#f28c28', '#f6c945', '#5fae4a', '#4f86c6'].map((c, i) => {
      const r = 17 - i * 1.6;
      return `<path d="M${30 - r} 41 A${r} ${r} 0 0 1 ${30 + r} 41" stroke="${c}" stroke-width="1.7" fill="none"/>`;
    }).join('')],
  };
  const EASEL_SVG = (motif) => `
    <svg viewBox="0 0 60 80" aria-hidden="true">
      <defs><clipPath id="cvclip"><rect x="9" y="7" width="42" height="44"/></clipPath></defs>
      <path d="M30 6 L31 77" stroke="#7a5230" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M26 3 L9 79 M34 3 L51 79" stroke="#a0703f" stroke-width="3" stroke-linecap="round"/>
      <rect x="9" y="7" width="42" height="44" rx="1" fill="#fbf8f0"/>
      <g clip-path="url(#cvclip)">
        <g class="cvl"><rect class="cv-sky" x="9" y="7" width="42" height="44"/></g>
        <g class="cvl"><circle class="cv-sun" cx="42" cy="16" r="4.6"/></g>
        <g class="cvl"><path d="M9 38 Q21 30 33 36 T51 33 V51 H9Z" fill="#86c46b"/><path d="M9 45 Q26 40 51 45 V51 H9Z" fill="#5fae4a"/></g>
        <g class="cvl">${EASEL_MOTIF[motif][1]}</g>
        <g class="cvl">
          <path d="M15 22 q1.2 -1.2 2.4 0 q1.2 -1.2 2.4 0 M36 26 q1 -1 2 0 q1 -1 2 0" stroke="#4a3a2c" stroke-width=".6" fill="none"/>
          <g fill="#fff"><circle cx="40" cy="47" r=".9"/><circle cx="45" cy="45.6" r=".9"/><circle cx="13.6" cy="48" r=".9"/></g>
          <g fill="#f6c945"><circle cx="40" cy="47" r=".35"/><circle cx="45" cy="45.6" r=".35"/><circle cx="13.6" cy="48" r=".35"/></g>
        </g>
      </g>
      <rect x="9" y="7" width="42" height="44" rx="1" fill="none" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="6" y="51" width="48" height="3.4" rx="1" fill="#a0703f" stroke="${OUT}" stroke-width=".8"/>
      <rect x="26" y="2" width="8" height="5" rx="1" fill="#a0703f" stroke="${OUT}" stroke-width=".8"/>
    </svg>`;
  const SEED_SVG = `<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 6 V15" stroke="#b9ad8e" stroke-width=".8"/>
    <path d="M6 6 L1 2 M6 6 L3 .8 M6 6 L6 0 M6 6 L9 .8 M6 6 L11 2" stroke="#fff" stroke-width=".7" stroke-linecap="round"/>
    <ellipse cx="6" cy="15" rx=".9" ry="1.3" fill="#8a6a4a"/></svg>`;
  const DROP_SVG = '<svg viewBox="0 0 10 14" aria-hidden="true"><path d="M5 0 Q10 8 5 13.4 Q0 8 5 0Z" fill="#9fdcff" stroke="#5a9cc8" stroke-width=".7"/></svg>';

  const STYLE_ACT = `
  .acts { position: absolute; inset: 0; pointer-events: none; transition: filter 2.5s; }
  .day.overcast .acts { filter: brightness(.9) saturate(.8); }
  .dusk .acts { filter: brightness(.85) saturate(.85); }
  .night .acts { filter: brightness(.55) saturate(.6); }

  .band, .arms, .uke, .brush, .wand, .rope, .rgrip, .bar, .wpaw { display: none; }
  .music .uke, .painting .brush, .blowing .wand, .sport .band, .jjack .arms, .roping .rope, .roping .rgrip,
  .rope-hold .rope, .rope-hold .rgrip, .lifting .bar, .waving .wpaw { display: inline; }

  /* Winken (Begrüßung) */
  .wpaw { transform-box: view-box; transform-origin: 103px 52px; }
  .waving .wpaw { animation: wpaw .42s ease-in-out infinite alternate; }
  @keyframes wpaw { from { transform: rotate(-18deg); } to { transform: rotate(14deg); } }
  .waving .face { transform: translate(1px, -1px); }

  /* Musik: Ukulele, wiegt sich, Schlagpfote */
  .music .hop { animation: msway 1.7s ease-in-out infinite alternate; }
  @keyframes msway { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
  .music .face { transform: translate(.6px, 1.4px); }
  .ustrum { transform-box: fill-box; }
  .music .ustrum { animation: strum .32s ease-in-out infinite alternate; }
  @keyframes strum { from { transform: translate(-.6px, -2.4px); } to { transform: translate(.6px, 2.2px); } }
  .sing .omouth { display: inline; }
  /* Verbeugung nach dem Ständchen: Pfoten vor dem Bauch, Oberkörper und Kopf tief, die Ohren fallen nach vorn */
  .bowing .paws { display: inline; transform: translateY(6px); }
  .bowing .hop { animation: bow 1.6s ease-in-out; }
  @keyframes bow { 28%, 64% { transform: translateY(-4%) rotate(10deg) scale(1.03, .95); } }
  .bowing .face { animation: bowf 1.6s ease-in-out; }
  @keyframes bowf { 28%, 64% { transform: translate(2.5px, 4.5px); } }
  .bowing .ear { animation: bowe 1.6s ease-in-out; }
  @keyframes bowe { 34%, 64% { transform: rotate(18deg); } 80% { transform: rotate(-5deg); } }

  /* Malen: Pinsel tupft, Blick auf die Palette */
  .painting .face { transform: translate(1.5px, -.6px); }
  .bstick { transform-box: view-box; transform-origin: 100px 65px; transition: transform .14s ease-out; }
  .dab .bstick { transform: translate(1.6px, -.9px) rotate(-7deg); }
  .mix .face { transform: translate(-1.6px, 2.6px); }
  .mix .bstick { transform: rotate(14deg); }
  /* Farbklecks auf der Nase (--nsm = die Farbe, mit der er gerade malte) */
  .nsm { display: none; }
  .smudge .nsm { display: inline; }
  .easel { position: absolute; opacity: 0; transition: opacity .6s; }
  .easel.on { opacity: 1; }
  .easel svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .easel .cvl { opacity: 0; transition: opacity .6s; }
  .cv-sky { fill: #9fd6f7; }
  .day.overcast .cv-sky { fill: #bccbd8; }
  .dusk .cv-sky { fill: #f2a477; }
  .night .cv-sky { fill: #2c3a6e; }
  .cv-sun { fill: #ffd54a; }
  .dusk .cv-sun { fill: #ff9a4a; }
  .night .cv-sun { fill: #f4f1dc; }

  /* Seifenblasen */
  .wfilm { transform-box: fill-box; transform-origin: 0% 50%; transition: transform .5s; }
  .blow .wfilm { transform: scale(1.5, 1.2); }
  .blow .omouth { display: inline; }
  .blow .face { transform: translate(1.2px, 0); }
  .bub { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  .bub i {
    position: absolute; left: calc(var(--bs) * -.5); top: calc(var(--bs) * -.5); width: var(--bs); height: var(--bs);
    border-radius: 50%; pointer-events: auto; cursor: pointer;
    background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, .95) 0 8%, rgba(255, 255, 255, 0) 21%),
      radial-gradient(circle, rgba(255, 255, 255, .08) 50%, rgba(140, 210, 255, .6) 70%, rgba(255, 150, 220, .7) 86%, rgba(160, 255, 210, .9) 100%);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .9), 0 0 3px 1px rgba(50, 90, 130, .3); animation: wob 1.1s ease-in-out infinite alternate;
    will-change: transform; /* eigene Ebene: Verlauf und Schatten werden beim Wabern nicht jedes Bild neu gemalt */
  }
  .bub i::after { content: ''; position: absolute; inset: -8px; }
  @keyframes wob { to { transform: scale(1.07, .93); } }
  .bub.pop i { animation: bpop .2s ease-out forwards; pointer-events: none; }
  @keyframes bpop { to { transform: scale(1.45); opacity: 0; } }

  /* Frühsport: Stirnband, Hampelmann, Kniebeugen, Schweißtropfen */
  .jjack .paws { display: inline; animation: jpaws var(--jj, .7s) steps(1) infinite; }
  .jjack .arms { animation: jarms var(--jj, .7s) steps(1) infinite; }
  @keyframes jarms { 0% { opacity: 1; } 50%, 100% { opacity: 0; } }
  @keyframes jpaws { 0% { opacity: 0; } 50%, 100% { opacity: 1; } }
  .jjack .jump { animation: jjump var(--jj, .7s) ease-in-out infinite; }
  .jjack .ear { transform: translateY(-1.5px); }
  @keyframes jjump {
    0%, 50%, 100% { transform: translateY(0) scale(1.04, .96); }
    25% { transform: translateY(-14%); }
    75% { transform: translateY(0); }
  }
  .knee .hop { animation: knee 1.4s ease-in-out infinite; }
  @keyframes knee { 50% { transform: scale(1.1, .8); } }
  .knee .paws { display: inline; transform: translate(5px, 1px); }
  .sweat { position: absolute; width: calc(var(--ph) * .07); animation: sweat 1.1s ease-in forwards; pointer-events: none; }
  .sweat svg, .seed svg { display: block; width: 100%; height: auto; }
  @keyframes sweat {
    0% { transform: translate(0, 0) scale(.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx), calc(var(--ph) * .25)) scale(1); opacity: 0; }
  }

  /* Seilspringen: dieselbe Schlaufe hinter (rope-b) und vor dem Körper (rope-f), gespiegelt um die Griffhöhe */
  .roping { --rr: var(--rp, .66s); }
  .rdbl { --rr: calc(var(--rp, .66s) / 2); }
  .rope { transform-box: view-box; transform-origin: 0 56px; }
  .roping .rope-f { animation: rope var(--rr) infinite, ropef var(--rr) steps(1) infinite; }
  .roping .rope-b { animation: rope var(--rr) infinite, ropeb var(--rr) steps(1) infinite; }
  @keyframes rope {
    0%, 100% { transform: scaleY(-1); animation-timing-function: ease-in; }
    25% { transform: scaleY(0); animation-timing-function: ease-out; }
    50% { transform: scaleY(1); animation-timing-function: ease-in; }
    75% { transform: scaleY(0); animation-timing-function: ease-out; }
  }
  @keyframes ropef { 0% { opacity: 1; } 50%, 100% { opacity: 0; } }
  @keyframes ropeb { 0% { opacity: 0; } 50%, 100% { opacity: 1; } }
  .roping .jump { animation: rjump var(--rp, .66s) linear infinite; }
  /* Absprung bremst nach oben ab, oben kurz gestreckt, abwärts beschleunigt er (das Seil ist bei 50 % unten) */
  @keyframes rjump {
    0%, 80%, 100% { transform: translateY(0); }
    22% { transform: translateY(0); animation-timing-function: ease-in; }
    32% { transform: scale(1.06, .93); animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: translateY(-16%) scale(.98, 1.03); animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
    68% { transform: translateY(0) scale(1.06, .94); animation-timing-function: ease-out; }
  }
  .rdbl .jump { animation-name: rjump2; }
  @keyframes rjump2 {
    0%, 100% { transform: translateY(0); animation-timing-function: ease-in; }
    10% { transform: scale(1.07, .92); animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: translateY(-27%) scale(.97, 1.04); animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
    90% { transform: translateY(0) scale(1.06, .94); animation-timing-function: ease-out; }
  }
  .roping .bfoot { animation: fb-rope var(--rp, .66s) ease-in-out infinite; }
  .roping .ffoot { animation: ff-rope var(--rp, .66s) ease-in-out infinite; }
  @keyframes fb-rope { 0%, 28%, 72%, 100% { transform: none; } 44%, 56% { transform: translate(3px, -1.5px) rotate(16deg); } }
  @keyframes ff-rope { 0%, 28%, 72%, 100% { transform: none; } 44%, 56% { transform: translate(-1px, -1.5px) rotate(14deg); } }
  .rdbl .bfoot { animation-name: fb-air; }
  .rdbl .ffoot { animation-name: ff-air; }
  .roping .shadow { animation: sh-rope var(--rp, .66s) linear infinite; }
  @keyframes sh-rope {
    0%, 68%, 100% { transform: none; opacity: 1; }
    32% { transform: none; opacity: 1; animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: scale(.8); opacity: .58; animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
  }
  .rdbl .shadow { animation-name: sh-rope2; }
  @keyframes sh-rope2 {
    0%, 90%, 100% { transform: none; opacity: 1; }
    10% { transform: none; opacity: 1; animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: scale(.7); opacity: .45; animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
  }
  .jjack .shadow { animation: sh-jj var(--jj, .7s) ease-in-out infinite; }
  @keyframes sh-jj { 0%, 50%, 100% { transform: none; opacity: 1; } 25% { transform: scale(.82); opacity: .6; } }

  /* Gewichtheben: Pusteblumen-Hantel vom Boden über den Kopf */
  .barm { transform-box: view-box; transition: transform .5s cubic-bezier(.4, 0, .3, 1); }
  .lift-gnd .barm { transform: translateY(25px); }
  .lift-hi .barm { transform: translateY(-53px); transition-duration: .9s; }
  .bar { transform-box: view-box; }
  .strain .bar { animation: strain .09s linear infinite alternate; }
  @keyframes strain { from { transform: translateX(-.7px); } to { transform: translateX(.7px); } }
  .strain .eye { display: none; }
  .strain .seye { display: inline; }
  .lift-hi .face { transform: translate(1px, -1.6px); }
  .seed { position: absolute; width: calc(var(--ph) * .09); animation: seed 3.4s ease-out forwards; pointer-events: none; }
  @keyframes seed {
    0% { transform: translate(0, 0) rotate(0); opacity: 0; }
    10% { opacity: 1; }
    100% { transform: translate(var(--dx), calc(var(--ph) * -.8)) rotate(var(--rt)); opacity: 0; }
  }
  `;
  // ==================== Ende Aktivitäten ====================

  // ==================== Päckchen: Konstanten, Grafiken und Stil ====================
  // Pflege: Liegt keiner der drei Werte länger als grace (Wachzeit) unter min, läuft die Serie weiter. Je every Wachzeit
  // ohne Unterbrechung gibt es ein Päckchen (höchstens max im Vorrat), nach gold am Stück ein goldenes. Verschenkt schwebt
  // es arrive ms lang an einem Ballon herein, der Pika schießt ihn vom Aussichtsstein mit der Zwille herunter und packt aus.
  // Leckerli bringen treat Satt, jedes Päckchen joy Glück.
  const GIFT = { min: 50, grace: 60 * 6e4, every: 6 * 36e5, max: 3, gold: 7 * 864e5, goldMax: 2, arrive: 12000, treat: 15, joy: 15 };
  const GIFT_TRE = 8; // GIFT_ITEMS 0–7 sind Schätze (Album, ein Bit je Schatz), danach Leckerli
  // Stufe des Schatzes t im Plan: 0 fehlt, 1 Schatz, 2 mit Trick, 3 golden (u: Bit t, v: Bit t und Bit 8 + t)
  const giftLv = (G, t) => (!G || !(G.u & (1 << t)) ? 0 : !(G.v & (1 << t)) ? 1 : G.v & (1 << (8 + t)) ? 3 : 2);
  // Stufen aller Schätze, wie sie schon ausgepackt sind: Die Stufe kommt beim Verschenken, fliegt der Ballon noch,
  // zählt sie nicht (hide: diesen Schatz ebenfalls eine Stufe tiefer, solange er ausgepackt wird)
  const giftLvs = (G, hide = null) => [...Array(GIFT_TRE).keys()].map((t) => {
    const lv = giftLv(G, t);
    return Math.max(0, lv - ((G && G.z > G.o && (G.i & 15) === t) || hide === t ? 1 : 0));
  });
  // Schätze, die schon ausgepackt sind, als Bits
  const giftOwned = (G) => giftLvs(G).reduce((m, lv, t) => (lv ? m | (1 << t) : m), 0);
  // Was die Serie gerade gefährdet (unter GIFT.min): Hinweis im Album und Zeichen am Knopf
  const GIFT_LOW = { s: ['Hunger!', ICON_LEAF], g: ['Streicheln!', ICON_HEART], c: ['Putzen!', ICON_SPARK] };
  const GIFT_ITEMS = [
    { key: 'yarn', name: 'Wollknäuel', say: 'ein Wollknäuel!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.4 17.6 q3.6 1.6 1.6 4 q-2 1.6 -4.4 .2" stroke="#f28fb1" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="13" r="8" fill="#f28fb1" stroke="${OUT}" stroke-width="1"/>
      <path d="M5.4 10 q6.6 2.4 12.6 -1.6 M4.8 13.8 q7.4 3 14.4 -1.4 M6.6 17.8 q6 1.6 11 -2.2 M10 5.4 q-3.4 7 .6 15.4 M14.6 5.6 q2.6 6 -.6 15"
            stroke="#d96a92" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M7.6 8.6 q1.6 -1.8 3.6 -2.4" stroke="#fff" stroke-width="1" fill="none" opacity=".6" stroke-linecap="round"/></svg>` },
    { key: 'wheel', name: 'Windrad', say: 'ein Windrad!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12 V23" stroke="#b5793e" stroke-width="1.8" stroke-linecap="round"/>
      <g class="gwhl">${['#e8584e', '#5fb9de', '#f6c945', '#7cc35a'].map((c, i) => `<path transform="rotate(${i * 90} 12 12)"
        d="M12 12 L12 2.6 Q18 4.4 12 12Z" fill="${c}" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>`).join('')}
        <circle cx="12" cy="12" r="1.4" fill="#fff" stroke="${OUT}" stroke-width=".7"/></g></svg>` },
    { key: 'plush', name: 'Plüsch-Pino', say: 'ein Plüsch-Pino!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.8" cy="7.4" r="3.4" fill="#d98a4e" stroke="${OUT}" stroke-width=".9"/><circle cx="6.8" cy="7.6" r="1.6" fill="#efc7a0"/>
      <circle cx="17.2" cy="7.4" r="3.4" fill="#d98a4e" stroke="${OUT}" stroke-width=".9"/><circle cx="17.2" cy="7.6" r="1.6" fill="#efc7a0"/>
      <ellipse cx="12" cy="14.2" rx="8.2" ry="7.6" fill="#e09a5c" stroke="${OUT}" stroke-width="1"/>
      <ellipse cx="12" cy="10.2" rx="1.6" ry="1.1" fill="#f6e3c8"/>
      <circle cx="9" cy="13.4" r="1.1" fill="#2a1a12"/><circle cx="15" cy="13.4" r="1.1" fill="#2a1a12"/>
      <path d="M11 15.4 q1 .9 2 0" fill="#7a4438"/><path d="M12 16 v.8 M12 16.8 q-1 1 -1.8 .2 M12 16.8 q1 1 1.8 .2" stroke="${OUT}" stroke-width=".6" fill="none"/>
      <path d="M5.2 18.8 q6.8 3.2 13.6 0" stroke="#3cb6b0" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>` },
    { key: 'shades', name: 'Sonnenbrille', say: 'eine Sonnenbrille!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.6 10.4 H22.4 M1.8 10.4 l-.6 3 M22.2 10.4 l.6 3" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M2.8 10 h8 q0 6 -4 6 q-4 0 -4 -6z M13.2 10 h8 q0 6 -4 6 q-4 0 -4 -6z" fill="#2c2f3a" stroke="#15171d" stroke-width=".8"/>
      <path d="M4.4 11.4 l2.2 2.4 M14.8 11.4 l2.2 2.4" stroke="#fff" stroke-width=".9" opacity=".6" stroke-linecap="round"/></svg>` },
    { key: 'scope', name: 'Fernrohr', say: 'ein Fernrohr!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-30 12 12)">
      <rect x="1.6" y="9.6" width="9" height="4.8" rx="1" fill="#b8862e" stroke="${OUT}" stroke-width=".8"/>
      <rect x="10.2" y="8.6" width="8" height="6.8" rx="1.2" fill="#d9a441" stroke="${OUT}" stroke-width=".8"/>
      <rect x="17.8" y="7.8" width="4" height="8.4" rx="1" fill="#8a5a32" stroke="${OUT}" stroke-width=".8"/>
      <path d="M12.8 8.6 v6.8 M15.4 8.6 v6.8" stroke="#f3cf7a" stroke-width=".8"/></g></svg>` },
    { key: 'hammock', name: 'Hängematte', say: 'eine Hängematte!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 22 L5 5 L7.4 22 M16.6 22 L19 5 L21.4 22" stroke="#9a6a3c" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
      <path d="M5 7 Q12 21 19 7" stroke="${OUT}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
      <path d="M5 7 Q12 21 19 7" stroke="#f6efe0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M5 7 Q12 21 19 7" stroke="#e8584e" stroke-width="3" fill="none" stroke-dasharray="1.8 2.2"/></svg>` },
    { key: 'can', name: 'Gießkanne', say: 'eine Gießkanne!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.4 9.6 h10.4 v9.6 q0 2 -2 2 h-6.4 q-2 0 -2 -2z" fill="#5fae4a" stroke="${OUT}" stroke-width="1"/>
      <path d="M14.8 13 L21 7.6 l1.4 1.6 -6.2 6.6" fill="#5fae4a" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M6.4 9.6 q3.2 -5.4 6.4 0" stroke="${OUT}" stroke-width="1.3" fill="none"/>
      <path d="M6 13 h7" stroke="#8fd16f" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M22.6 6.4 l1 -1 M23 9 l1.2 .2" stroke="#7cc4ee" stroke-width="1" stroke-linecap="round"/></svg>` },
    { key: 'bell', name: 'Glöckchen', say: 'ein Glöckchen!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.2 q3 -2.4 6 0 l-3 1.4z" fill="#e8584e" stroke="${OUT}" stroke-width=".6"/>
      <path d="M12 5 v1.4" stroke="${OUT}" stroke-width="1"/>
      <path d="M5.8 18 q0 -11.6 6.2 -11.6 q6.2 0 6.2 11.6 l1.6 1.6 h-15.6z" fill="#f2c230" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M8.6 10 q1 -2 3 -2.4" stroke="#fff3b0" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="20.6" r="1.7" fill="#d9a441" stroke="${OUT}" stroke-width=".7"/></svg>` },
    // Leckerli: mo = Monate (0 = Januar, Südhalbkugel um ein halbes Jahr versetzt), ohne = immer
    { key: 'straw', name: 'Erdbeere', color: '#e8473f', mo: [4, 5, 6], svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21.6 C4.6 17.6 4.2 10 7.4 8 Q12 6.4 16.6 8 C19.8 10 19.4 17.6 12 21.6Z" fill="#e8473f" stroke="${OUT}" stroke-width=".9"/>
      <g fill="#ffe08a">${[[9, 11], [12, 10.4], [15, 11], [8.6, 14.4], [11.6, 13.6], [14.8, 14.4], [10.4, 17], [13.6, 17]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx=".5" ry=".8"/>`).join('')}</g>
      <path d="M6.8 8 l2.6 -2.6 l2.6 2 l2 -3 l1.8 3 l2.8 -.8 l-1.8 2.4z" fill="#5fae4a" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/></svg>` },
    { key: 'rasp', name: 'Himbeeren', color: '#d9406a', mo: [6, 7, 8], svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      ${[[9, 12], [12.6, 11], [15.6, 13.4], [8.4, 16], [12, 15], [15.2, 17.4], [11, 19.2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.7" fill="#d9406a" stroke="${OUT}" stroke-width=".7"/>
      <circle cx="${x - 0.8}" cy="${y - 0.9}" r=".6" fill="#fff" opacity=".5"/>`).join('')}
      <path d="M11 9 q-3 -4 -6 -3 q2 3 6 3z M12 9 q3 -5 7 -4 q-2 4 -7 4z" fill="#5fae4a" stroke="${OUT}" stroke-width=".7"/></svg>` },
    { key: 'apple', name: 'Apfelschnitz', color: '#f3e6c4', mo: [8, 9, 10], svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 11 a9.4 9.4 0 0 0 18.8 0z" fill="#f6ecd0" stroke="#d9483b" stroke-width="1.8"/>
      <path d="M2.6 11 a9.4 9.4 0 0 0 18.8 0z" fill="none" stroke="${OUT}" stroke-width=".6"/>
      <ellipse cx="10" cy="14" rx=".8" ry="1.3" fill="#5a3a22"/><ellipse cx="14" cy="14" rx=".8" ry="1.3" fill="#5a3a22"/>
      <path d="M12 11 V7.4 q2.4 -2.4 4.6 -1.6 q-1.2 2.8 -4.6 1.6" fill="#5fae4a" stroke="${OUT}" stroke-width=".7"/></svg>` },
    { key: 'posy', name: 'Blumensträußchen', color: '#f28fb1', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22 L7 9 M12 22 L12 7 M12 22 L17 9" stroke="#4f8a3a" stroke-width="1.2"/>
      ${[[7, 8, '#f28fb1'], [12, 6, '#f6c945'], [17, 8, '#b99cf0']].map(([x, y, c]) => `<g transform="translate(${x} ${y})">
        ${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="1.6" ry="2.4" transform="rotate(${a}) translate(0 -2)" fill="${c}" stroke="${OUT}" stroke-width=".5"/>`).join('')}
        <circle r="1.3" fill="#e0a032"/></g>`).join('')}
      <path d="M9.4 16.4 l2.6 1.4 2.6 -1.4 -.6 3 -2 -.8 -2 .8z" fill="#5fb9de" stroke="${OUT}" stroke-width=".6"/></svg>` },
  ];
  // Papier und Band der Päckchen (je Nummer), Ballonfarben, golden
  const GIFT_PAPER = [['#5fb9de', '#f6c945'], ['#f28fb1', '#ffffff'], ['#7cc35a', '#e8584e'], ['#b99cf0', '#f6c945'], ['#ff9f5a', '#5fb9de']];
  const GIFT_BALLOONS = ['#e8584e', '#5fb9de', '#f6c945', '#b99cf0', '#7cc35a', '#f28fb1'];
  const GIFT_GOLD = ['#f2c230', '#fff7d6'];
  // Stufe 2 der Schätze: ein neuer Trick (je Schatz, Reihenfolge wie GIFT_ITEMS). Stufe 3 macht ihn golden.
  const GIFT_TRICK = ['Kopfball', 'Anpusten', 'Kuscheln', 'Brille lupfen', 'Sterngucken', 'Schaukeln', 'Regenbogen', 'Glockenspiel'];
  const GIFT_GILT = ['ein goldenes %', 'ein goldenes %', 'ein goldener %', 'eine goldene %', 'ein goldenes %', 'eine goldene %',
    'eine goldene %', 'ein goldenes %'];
  const GIFT_PARCEL = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <g class="gp-box">
        <rect x="3.6" y="11" width="16.8" height="11" rx="1.2" fill="var(--gpp, #5fb9de)" stroke="${OUT}" stroke-width="1"/>
        <rect x="10.6" y="11" width="2.8" height="11" fill="var(--gpr, #f6c945)"/>
        <path d="M5.4 13 v6.6" stroke="#fff" stroke-width="1" opacity=".45" stroke-linecap="round"/>
      </g>
      <g class="gp-lid">
        <rect x="2.6" y="8" width="18.8" height="4" rx="1" fill="var(--gpp, #5fb9de)" stroke="${OUT}" stroke-width="1"/>
        <rect x="10.6" y="8" width="2.8" height="4" fill="var(--gpr, #f6c945)"/>
      </g>
      <g class="gp-bow">
        <path d="M12 8 C8 2.6 4.2 5.2 7 8Z M12 8 C16 2.6 19.8 5.2 17 8Z" fill="var(--gpr, #f6c945)" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <circle cx="12" cy="8" r="1.5" fill="var(--gpr, #f6c945)" stroke="${OUT}" stroke-width=".7"/>
      </g></svg>`;
  // Ballon mit Päckchen: viewBox 40 × 80, die Mitte des Päckchens liegt bei y 66
  const GIFT_BALLOON = `<svg viewBox="0 0 40 80" aria-hidden="true">
      <g class="gb-b">
        <path d="M20 36 C17 42 23 47 20 52 C18 55 20 58 20 61.6" stroke="#7d6a5a" stroke-width=".8" fill="none"/>
        <ellipse class="gb-ball" cx="20" cy="19" rx="13.4" ry="15.6" fill="var(--gbc, #e8584e)" stroke="${OUT}" stroke-width="1"/>
        <path d="M17.6 34.4 L20 37.2 L22.4 34.4Z" fill="var(--gbc, #e8584e)" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <ellipse cx="14.4" cy="12" rx="3.2" ry="5.4" transform="rotate(24 14.4 12)" fill="#fff" opacity=".45"/>
        <ellipse cx="13" cy="20.6" rx="1" ry="1.6" fill="#fff" opacity=".35"/>
      </g>
      <svg class="gb-p" x="8" y="54" width="24" height="24" viewBox="0 0 24 24" overflow="visible">${GIFT_PARCEL.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
    </svg>`;
  // Hängematte auf der Wiese: viewBox 60 × 20, tiefste Stelle des Netzes bei y 14 (darauf liegt er, GIFT_HAM_LIFT × Breite)
  const GIFT_HAMMOCK = `<svg viewBox="0 0 60 20" aria-hidden="true">
      <path d="M1.8 20 L5 2 L8.2 20 M51.8 20 L55 2 L58.2 20" stroke="#9a6a3c" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
      <path d="M3 13 H7 M53 13 H57" stroke="#9a6a3c" stroke-width="1.1"/>
      <g class="gnet">
        <path d="M5 3.4 L10 5 M55 3.4 L50 5" stroke="#cdbb93" stroke-width=".9"/>
        <path d="M10 5 Q30 23 50 5" stroke="${OUT}" stroke-width="4.4" fill="none" stroke-linecap="round"/>
        <path d="M10 5 Q30 23 50 5" stroke="#f6efe0" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M10 5 Q30 23 50 5" stroke="#e8584e" stroke-width="3.2" fill="none" stroke-dasharray="2.4 3"/>
      </g></svg>`;
  const GIFT_HAM_W = 1.25; // Breite in Pika-Breiten
  const GIFT_HAM_LIFT = 0.1; // Höhe der Liegefläche in Breiten der Hängematte
  // Windrad am Bau: viewBox 24 × 44, Nabe bei 12/12
  const GIFT_WHEEL = `<svg viewBox="0 0 24 44" aria-hidden="true">
      <path d="M12 12 V44" stroke="#b5793e" stroke-width="1.6" stroke-linecap="round"/>
      ${GIFT_ITEMS[1].svg.replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/<path d="M12 12 V23"[^>]*\/>/, '')}</svg>`;
  // Umfärben nach Gold (Stufe 3 der Schätze)
  const GILT_F = 'sepia(1) saturate(2.6) hue-rotate(8deg) brightness(1.12)';
  const GIFT_CLS = ['sling', 'aim', 'snap', 'spy', 'wcan', 'pour', 'shup', 'wink', 'hswing', 'puffy'];

  const STYLE_GIFT = `
  .gifts { position: absolute; inset: 0; pointer-events: none; transition: filter 2.5s; }
  .day.overcast .gifts { filter: brightness(.9) saturate(.8); }
  .dusk .gifts { filter: brightness(.85) saturate(.85); }
  .night .gifts { filter: brightness(.55) saturate(.6); }
  .gifts svg { display: block; width: 100%; height: auto; overflow: visible; }
  .gold svg { filter: drop-shadow(0 0 3px rgba(255, 226, 120, .95)); }

  /* Ballon: .gbal schwebt herein (Web Animation), .gdrift treibt langsam, .gbob schaukelt am Band */
  .gbal { position: absolute; width: calc(var(--H) * .17); }
  .gdrift { animation: gdrift 15s ease-in-out infinite alternate; }
  @keyframes gdrift {
    0% { transform: translate(calc(var(--H) * -.035), 0); }
    45% { transform: translate(calc(var(--H) * .015), calc(var(--H) * -.02)); }
    100% { transform: translate(calc(var(--H) * .035), calc(var(--H) * .012)); }
  }
  .gbob { transform-origin: 50% 24%; animation: gbob 3.2s ease-in-out infinite alternate; }
  @keyframes gbob {
    from { transform: translateY(calc(var(--H) * -.012)) rotate(calc(var(--gsw, .5) * -8deg)); }
    to { transform: translateY(calc(var(--H) * .01)) rotate(calc(var(--gsw, .5) * 8deg)); }
  }
  .gconf { position: absolute; width: calc(var(--H) * .018); height: calc(var(--H) * .028); margin: calc(var(--H) * -.014);
    border-radius: 1px; animation: gconf 1s ease-out forwards; }
  @keyframes gconf { to { transform: translate(var(--dx), var(--dy)) rotate(var(--r)); opacity: 0; } }
  .gpeb { position: absolute; width: calc(var(--H) * .022); height: calc(var(--H) * .022); margin: calc(var(--H) * -.011);
    border-radius: 50%; background: #8e9196; box-shadow: inset -1px -1px 0 rgba(0, 0, 0, .25); }

  /* Päckchen am Boden, Auspacken */
  .gpar { position: absolute; width: calc(var(--H) * .09); margin-left: calc(var(--H) * -.045); bottom: calc(var(--H) - var(--gy) - 3px); transform-origin: 50% 100%; }
  .gpar .gp-bow, .gpar .gp-lid { transform-box: fill-box; transform-origin: 50% 100%; }
  .gpar .gp-bow.off { animation: gbowoff .6s ease-out forwards; }
  .gpar .gp-lid.off { animation: glidoff .7s ease-out forwards; }
  @keyframes gbowoff { to { transform: translate(-30%, -260%) rotate(-40deg); opacity: 0; } }
  @keyframes glidoff { 30% { transform: translate(10%, -120%) rotate(18deg); opacity: 1; } to { transform: translate(60%, -260%) rotate(50deg); opacity: 0; } }
  .gpar.fade { transition: opacity .8s; opacity: 0; }
  .gitem { position: absolute; width: calc(var(--H) * .11); margin-left: calc(var(--H) * -.055); }
  .gitem svg { display: block; width: 100%; height: auto; overflow: visible; }
  .night .gitem { filter: brightness(.7) saturate(.8); }
  .gitem.rise { animation: grise 1s cubic-bezier(.3, 1.4, .5, 1) forwards; }
  @keyframes grise { from { transform: translateY(40%) scale(.2); opacity: 0; } to { transform: translateY(-40%) scale(1.25); opacity: 1; } }
  .gitem.eat { animation: picked .4s forwards; }
  .gdrop { position: absolute; width: calc(var(--H) * .012); height: calc(var(--H) * .02); margin-left: calc(var(--H) * -.006);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: #7cc4ee; animation: gdrop .55s ease-in forwards; }
  @keyframes gdrop { to { transform: translateY(calc(var(--H) * .1)); opacity: .2; } }

  /* Schätze in der Szene */
  .gt { position: absolute; }
  .gt.new { animation: grow .7s cubic-bezier(.3, 1.6, .5, 1); transform-origin: 50% 100%; }
  .gt-wheel { width: calc(var(--H) * .14); bottom: calc(var(--H) - var(--gy) - 2px); margin-left: calc(var(--H) * -.07); }
  .gt-wheel .gwhl { transform-box: view-box; transform-origin: 12px 12px; animation: gspin var(--gws, 3s) linear infinite; }
  .wind-w .gt-wheel .gwhl { animation-direction: reverse; }
  @keyframes gspin { to { transform: rotate(360deg); } }
  .gt-bell { width: calc(var(--H) * .05); margin-left: calc(var(--H) * -.025); transform-origin: 50% 8%; }
  .gt-bell.ring { animation: gring .22s ease-in-out 7 alternate; }
  @keyframes gring { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
  .gt-yarn { width: calc(var(--H) * .075); margin-left: calc(var(--H) * -.0375); bottom: calc(var(--H) - var(--gy) - 3px); }
  .gt-yarn svg { transition: transform 1.2s ease-out; }
  .gt-can { width: calc(var(--H) * .085); margin-left: calc(var(--H) * -.0425); bottom: calc(var(--H) - var(--gy) - 3px); transition: opacity .3s; }
  .gt-can.away { opacity: 0; }
  .gt-ham { width: calc(var(--pw) * 1.25); margin-left: calc(var(--pw) * -.625); bottom: calc(var(--H) - var(--gy) - 2px); }
  .gt-ham .gnet { transform-box: view-box; transform-origin: 30px 3px; }
  .gt-ham.sway .gnet { animation: gham 2.8s ease-in-out infinite alternate; }
  @keyframes gham { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
  .gt-plush { width: calc(var(--H) * .085); margin-left: calc(var(--H) * -.0425); transform: rotate(-12deg); }
  .gt-plush svg { display: block; width: 100%; height: auto; }
  .gt-plush.out { width: calc(var(--H) * .13); margin-left: calc(var(--H) * -.065); transform: rotate(-5deg); }
  .night .gt-plush { filter: brightness(.72) saturate(.75); }
  /* Golden (Stufe 3): Farben nach Gold umgefärbt, leichter Schimmer */
  .gt.gilt, .gitem.gilt svg { filter: ${GILT_F} drop-shadow(0 0 2px rgba(255, 220, 110, .75)); }
  .night .gt-plush.gilt { filter: ${GILT_F} brightness(.72); }
  /* Tricks: Schaukeln, Anpusten, Regenbogen */
  .gt-ham.swing .gnet { animation: gswing .9s ease-in-out infinite alternate; }
  @keyframes gswing { from { transform: rotate(-9deg); } to { transform: rotate(9deg); } }
  .hswing .depth { transform-origin: 50% -40%; animation: gswing-p .9s ease-in-out infinite alternate; }
  @keyframes gswing-p { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  .gair { position: absolute; width: calc(var(--H) * .022); height: calc(var(--H) * .012); margin: calc(var(--H) * -.006);
    border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, .85); border-left-color: transparent; opacity: 0;
    animation: gair .8s ease-out forwards; }
  @keyframes gair { 15% { opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.6); opacity: 0; } }
  .grbow { position: absolute; width: calc(var(--H) * .22); margin-left: calc(var(--H) * -.11); opacity: 0;
    animation: grbow 2.6s ease-in-out forwards; pointer-events: none; }
  .grbow svg { display: block; width: 100%; height: auto; }
  @keyframes grbow { 20%, 70% { opacity: .75; } to { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .gt-ham.swing .gnet, .hswing .depth { animation: none !important; } }
  .scene.night:not(.windy) .gwhl, .scene.night:not(.windy) .gbob, .scene.night:not(.windy) .gdrift { animation-play-state: paused; }
  /* Pika schläft: Windrad und Ballon halten still (wie .hb-still), das spart das Neuzeichnen unter dem Filter */
  .gifts.still .gwhl, .gifts.still .gbob, .gifts.still .gdrift { animation-play-state: paused; }
  @media (prefers-reduced-motion: reduce) { .gwhl, .gbob, .gdrift, .gt-ham .gnet { animation: none !important; } }

  /* Pika: Zwille, Fernrohr, Gießkanne, Sonnenbrille */
  .slg, .gspy, .gcan, .shades { display: none; }
  .sling .slg, .spy .gspy, .wcan .gcan, .cool .shades { display: inline; }
  .pika.sling .brolly, .pika.spy .brolly, .pika.wcan .brolly, .pika.sling .mfood { display: none; }
  .sleeping .shades, .inside .shades { display: none; }
  .slr { transform-box: view-box; transform-origin: 112px 62px; transform: rotate(32deg); transition: transform .35s; }
  .aim .slr { transform: none; }
  .slb-r { display: none; }
  .snap .slb-p, .snap .slp { display: none; }
  .snap .slb-r { display: inline; }
  .gcr { transform-box: view-box; transform-origin: 106px 62px; transition: transform .45s; }
  /* Tricks: Brille hochschieben und zwinkern, Backen aufblasen beim Pusten */
  .shades { transition: transform .35s ease-out; }
  .shup .shades { transform: translateY(-12px); }
  .wink .eye-r { display: none; }
  .wink .seye-r { display: inline; }
  .puffy .omouth { display: inline; }
  /* Goldene Sonnenbrille, goldenes Fernrohr, goldene Gießkanne */
  .g-shd .shades path:first-child { stroke: #e0a820; stroke-width: 1.6; }
  .g-shd .shades path:nth-child(2) { stroke: #c98a0c; stroke-width: 1.2; }
  .g-scp .gspy [fill="#b8862e"] { fill: #e8b52a; }
  .g-scp .gspy [fill="#d9a441"] { fill: #ffd75a; }
  .g-scp .gspy [fill="#8a5a32"] { fill: #c98a0c; }
  .g-scp .gspy [stroke="#f3cf7a"] { stroke: #fff4c2; }
  .g-can .gcan [fill="#5fae4a"] { fill: #f2c230; }
  .g-can .gcan [stroke="#8fd16f"] { stroke: #fff2b0; }
  .pour .gcr { transform: rotate(32deg); }

  /* Knopf (links neben dem Futterknopf, oben rechts) mit Fortschrittsring, Album */
  .gbtn {
    position: absolute; right: 52px; top: 6px; z-index: 5; width: 36px; height: 36px; padding: 0;
    border: none; border-radius: 50%; cursor: pointer; background: rgba(255, 255, 255, .75); -webkit-touch-callout: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s; user-select: none;
  }
  .gbtn[hidden] { display: none; }
  .gbtn:active { transform: scale(.88); }
  .night .gbtn { background: rgba(15, 22, 45, .55); }
  .gbtn .gico { position: absolute; inset: 7px 7px 7.5px; transition: opacity .4s, filter .4s; }
  .gbtn .gico svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .gring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
  .gring circle { fill: none; stroke-width: 3.4; }
  .gr0 { stroke: rgba(0, 0, 0, .1); }
  .night .gr0 { stroke: rgba(255, 255, 255, .15); }
  .gr1 { stroke: #f2b632; stroke-linecap: round; stroke-dasharray: var(--gp, 0) 100; transition: stroke-dasharray .8s, opacity .3s; }
  /* Fortschritt noch nicht berechnet (gerade geladen): kein Punkt bei 0 %, danach füllt sich der Ring */
  .gbtn.wait .gr1 { opacity: 0; }
  .gbtn.warn .gr1 { stroke: #e8892a; animation: gwarn 1.6s ease-in-out infinite; }
  /* Alles wieder über 50 %, nur selbst geknabbert: ruhig orange, eine Pflege-Aktion schließt die Lücke */
  .gbtn.warn.ok .gr1 { animation: none; }
  @keyframes gwarn { 50% { opacity: .3; } }
  /* Was fehlt (Satt, Glück, Sauber): kleines Zeichen links unten am Knopf */
  .gcrit { position: absolute; left: -5px; bottom: -5px; width: 16px; height: 16px; padding: 2px; box-sizing: border-box;
    border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); }
  .gcrit:empty { display: none; }
  .gcrit svg { display: block; width: 100%; height: 100%; }
  .gbtn.broken .gr1 { stroke: #b8b2a8; }
  .gbtn.empty .gico { opacity: .45; filter: grayscale(.7); }
  .gnum { position: absolute; right: -4px; top: -3px; min-width: 15px; height: 15px; padding: 0 3px; box-sizing: border-box;
    border-radius: 8px; background: #e8584e; color: #fff; font: 700 10px/15px sans-serif; text-align: center; }
  .gnum:empty { display: none; }
  .gbtn.gold .gnum { background: #d99a12; }
  .gbtn.wig { animation: gwig .7s; }
  @keyframes gwig { 20% { transform: rotate(-12deg); } 40% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(3deg); } }
  .gbtn.new { animation: gnew .9s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes gnew { from { transform: scale(0) rotate(-40deg); } }
  .gbtn.no { animation: no .4s; }
  `;
  // ==================== Ende Päckchen ====================

  // ==================== Tagebuch ====================
  // Tippt man auf die Statusleiste, geht „Pikas Tagebuch“ auf: was er heute und gestern erlebt hat (aus seiner Sicht),
  // dazu seine Schätze. Gespeichert wird dafür nichts Neues: Die Einträge entstehen beim Öffnen aus dem Verlauf der
  // beiden Helfer in HA (history/history_during_period), also aus den Änderungen von Zustand und Tagesplan samt
  // Uhrzeit. Ohne Helfer schreibt das Gerät dieselbe Liste selbst im Browser mit (DIARY.keep). Was kein Gerät gezeigt
  // hat, steht nicht im Verlauf: Dafür erfindet das Tagebuch nichts, eine lange Lücke bleibt „mein Geheimnis“.
  // keep/max: Mitschrift im Browser, close: schließt sich nach so langer Ruhe selbst (Wand-Tablet), gap: ab so langer
  // Lücke in der Wachzeit ein Geheimnis, acts: so viele Beschäftigungen je Tageszeit ausführlich (der Rest in einer Zeile)
  const DIARY = { keep: 3 * 864e5, max: 400, close: 60000, gap: 100 * 6e4, acts: 2 };
  const DI = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const DIARY_BOOK = DI(`<rect x="4.6" y="2.6" width="15" height="18.8" rx="2.2" fill="#e9a23b" stroke="${OUT}" stroke-width="1.1"/>
    <path d="M8.2 2.8 V21.2" stroke="${OUT}" stroke-width="1"/><rect x="10.4" y="6.4" width="6.6" height="4.4" rx=".8" fill="#fff3d6" stroke="${OUT}" stroke-width=".7"/>
    <path d="M14.6 21.2 v2 l1.3 -1 l1.3 1 v-2" fill="#e8584e" stroke="${OUT}" stroke-width=".6" stroke-linejoin="round"/>`);
  const DIARY_PAW = DI(`<g fill="currentColor"><ellipse cx="12" cy="15.6" rx="5" ry="4.2"/><ellipse cx="5.6" cy="10.4" rx="2" ry="2.6"/>
    <ellipse cx="9.6" cy="6.8" rx="2" ry="2.7"/><ellipse cx="14.4" cy="6.8" rx="2" ry="2.7"/><ellipse cx="18.4" cy="10.4" rx="2" ry="2.6"/></g>`);
  const DIARY_ICON = {
    wake: DI(`<path d="M12 3 v3 M4.6 7.6 l2 2 M19.4 7.6 l-2 2 M2.4 15.6 h2.6 M19 15.6 h2.6" stroke="#f0a02c" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M6 17 a6 6 0 0 1 12 0Z" fill="#f6c945" stroke="${OUT}" stroke-width="1"/><path d="M2 20 h20" stroke="#7cc35a" stroke-width="2.2" stroke-linecap="round"/>`),
    sleep: DI(`<path d="M15.5 3.5 a8.6 8.6 0 1 0 5 12.4 A7.2 7.2 0 0 1 15.5 3.5Z" fill="#f6e7a8" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M16.6 5.4 h3.6 l-3.6 3.8 h3.6" fill="none" stroke="#7c9be0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`),
    read: DI(`<path d="M3 5.4 q4.5 -2.2 9 0 v14 q-4.5 -2.2 -9 0Z" fill="#7cc4ee" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M21 5.4 q-4.5 -2.2 -9 0 v14 q4.5 -2.2 9 0Z" fill="#a8dcf5" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M5.4 8.6 q2 -.8 4.2 0 M5.4 11.6 q2 -.8 4.2 0 M14.4 8.6 q2.2 -.8 4.2 0 M14.4 11.6 q2.2 -.8 4.2 0" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round"/>`),
    game: DI(`<rect x="6" y="2.4" width="12" height="19.2" rx="2.2" fill="#c9cfd8" stroke="${OUT}" stroke-width="1"/>
      <rect x="8" y="4.8" width="8" height="6.4" rx=".9" fill="#9ccf6a" stroke="${OUT}" stroke-width=".7"/>
      <path d="M8.6 15.4 h3.2 M10.2 13.8 v3.2" stroke="${OUT}" stroke-width="1.3" stroke-linecap="round"/><circle cx="15" cy="15.4" r="1.2" fill="#e8584e"/>`),
    tablet: DI(`<rect x="2.4" y="5" width="19.2" height="14" rx="2.2" fill="#4a4f5c" stroke="${OUT}" stroke-width="1"/>
      <rect x="4.4" y="7" width="15.2" height="10" rx=".7" fill="#8fd0f2"/><path d="M6.6 14.6 l3 -3.2 l2.6 2.2 l2.2 -2.8 l3 3.8" stroke="#fff" stroke-width="1.1" fill="none" stroke-linejoin="round"/>`),
    kite: DI(`<path d="M12 1.8 L18.2 9 L12 17.4 L5.8 9Z" fill="#e8584e" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M12 1.8 V17.4 M5.8 9 H18.2" stroke="${OUT}" stroke-width=".7"/><path d="M12 17.4 q-2.4 1.8 0 3.2 q2 1.2 .4 2.6" stroke="#5fb9de" stroke-width="1.2" fill="none" stroke-linecap="round"/>`),
    tv: DI(`<path d="M8 2.6 l4 3.4 l4 -3.4" stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round"/>
      <rect x="2.8" y="6" width="18.4" height="12.6" rx="2.2" fill="#a0703f" stroke="${OUT}" stroke-width="1"/>
      <rect x="4.8" y="8" width="11.4" height="8.6" rx="1.2" fill="#9fdcff" stroke="${OUT}" stroke-width=".6"/>
      <circle cx="18.6" cy="10.2" r=".9" fill="#f6c945"/><circle cx="18.6" cy="13.4" r=".9" fill="#f6c945"/><path d="M7 21 h10" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>`),
    music: DI(`<path d="M9.2 17.4 V5 L19.4 3 v12.4" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="6.6" cy="17.6" rx="3" ry="2.3" fill="#b99cf0" stroke="${OUT}" stroke-width="1"/><ellipse cx="16.8" cy="15.6" rx="3" ry="2.3" fill="#b99cf0" stroke="${OUT}" stroke-width="1"/>`),
    paint: DI(`<path d="M12 3 a9 9 0 1 0 0 18 c1.7 0 2.1 -1.2 1.4 -2.3 c-.8 -1.3 0 -2.7 1.6 -2.7 H17 a4 4 0 0 0 4 -4 c0 -5 -4 -9 -9 -9Z" fill="#f0e2cf" stroke="${OUT}" stroke-width="1"/>
      <circle cx="7.4" cy="11" r="1.5" fill="#e8584e"/><circle cx="10.6" cy="7" r="1.5" fill="#f6c945"/><circle cx="15.4" cy="7.6" r="1.5" fill="#5fb9de"/><circle cx="8.6" cy="15.4" r="1.5" fill="#7cc35a"/>`),
    bubbles: DI(`<circle cx="8.4" cy="14.4" r="5.6" fill="#d9f1fb" stroke="#5a9cc8" stroke-width="1"/><circle cx="16.8" cy="7.2" r="3.6" fill="#e6f6fd" stroke="#5a9cc8" stroke-width=".9"/>
      <circle cx="18.4" cy="17.4" r="2.2" fill="#e6f6fd" stroke="#5a9cc8" stroke-width=".8"/><path d="M5.4 12.6 q.8 -2 2.6 -2.4 M15 6.2 q.6 -1 1.6 -1.2" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>`),
    sport: DI(`<path d="M7 12 h10" stroke="${OUT}" stroke-width="2.2"/><rect x="3" y="7.4" width="4.2" height="9.2" rx="1.3" fill="#e8584e" stroke="${OUT}" stroke-width="1"/>
      <rect x="16.8" y="7.4" width="4.2" height="9.2" rx="1.3" fill="#e8584e" stroke="${OUT}" stroke-width="1"/>`),
    bird: DI(`<path d="M9 18.6 v2.8 M13 18.6 v2.8" stroke="${OUT}" stroke-width="1" stroke-linecap="round"/><circle cx="11" cy="12" r="7.2" fill="#b5895f" stroke="${OUT}" stroke-width="1"/>
      <path d="M6.8 13.4 q4.2 3.8 8.4 0 q-.6 4.4 -4.2 4.8 q-3.6 -.4 -4.2 -4.8Z" fill="#f08a4b"/><path d="M17.8 10.4 l3.4 1.3 l-3.3 1.4Z" fill="#f6c945" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>
      <circle cx="14" cy="9.6" r="1" fill="#2a1a12"/>`),
    plane: DI(`<path d="M12.2 9.8 L8.6 4.4 h2.2 l5.4 4.2" fill="#f4f6f8" stroke="#5a6470" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M2.4 13.6 L19.4 9 q2.6 -.4 2.2 1.2 q-.4 1.2 -2.2 1.7 l-5 1.5 l-4 5.2 h-2 l2 -4.4 l-4 1.2 l-1.6 1.8 H3.4 l1 -3.2Z" fill="#f4f6f8" stroke="#5a6470" stroke-width=".9" stroke-linejoin="round"/>`),
    bfly: DI(`<path d="M12 12 C9 3.6 1.8 5 3.8 11 c1 3 5.2 3 8.2 1Z M12 12 c3 -8.4 10.2 -7 8.2 -1 c-1 3 -5.2 3 -8.2 1Z" fill="#f28fb1" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M12 12 c-3 1 -6 4.2 -3.2 7 c2 1 3.2 -3 3.2 -7Z M12 12 c3 1 6 4.2 3.2 7 c-2 1 -3.2 -3 -3.2 -7Z" fill="#b99cf0" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M12 8 v10" stroke="${OUT}" stroke-width="1.5" stroke-linecap="round"/>`),
    secret: DI(`<path d="M3 10.6 q9 8 18 0" fill="none" stroke="${OUT}" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M5.6 14.4 l-1.5 2 M9.6 16.2 l-.7 2.4 M14.4 16.2 l.7 2.4 M18.4 14.4 l1.5 2" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round"/>`),
    gather: DI(`<path d="M12 13 v9" stroke="#4f8a3a" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="15" cy="17.6" rx="2.6" ry="1.1" fill="#5fae4a" transform="rotate(-30 15 17.6)"/>
      <g transform="translate(12 9)">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="2.5" ry="3.7" transform="rotate(${a}) translate(0 -3.3)" fill="#f6c945" stroke="${OUT}" stroke-width=".7"/>`).join('')}
      <circle r="2.2" fill="#e0a032"/></g>`),
    washer: DI(`<rect x="4" y="2.8" width="16" height="18.4" rx="2.2" fill="#e9eef2" stroke="${OUT}" stroke-width="1"/><circle cx="12" cy="13.6" r="4.7" fill="#8fd0f2" stroke="${OUT}" stroke-width="1"/>
      <circle cx="7" cy="5.8" r=".9" fill="#5fb9de"/><path d="M9.4 14.2 q2.6 -2 5.2 0" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>`),
    dryer: DI(`<rect x="4" y="2.8" width="16" height="18.4" rx="2.2" fill="#f3e6d2" stroke="${OUT}" stroke-width="1"/><circle cx="12" cy="13.6" r="4.7" fill="#f6c08a" stroke="${OUT}" stroke-width="1"/>
      <circle cx="7" cy="5.8" r=".9" fill="#f0a04b"/><path d="M10 12.4 q1.2 1.2 0 2.6 M13.4 12.4 q1.2 1.2 0 2.6" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>`),
    dishwasher: DI(`<circle cx="11" cy="13" r="8.4" fill="#fff" stroke="${OUT}" stroke-width="1"/><circle cx="11" cy="13" r="5" fill="none" stroke="#c9d3da" stroke-width="1"/>
      <path fill="#5fb9de" transform="translate(13.4 -.6) scale(.42)" d="${STAR}"/>`),
    fest: DI(`<path d="${STAR}" fill="#f6c945" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`),
    more: DI('<circle cx="5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="19" cy="12" r="1.9" fill="currentColor"/>'),
    coffee: COFFEE_THINK, heart: ICON_HEART, clean: ICON_SPARK, hungry: FOOD.lz.svg, parcel: GIFT_PARCEL,
    pino: GIFT_ITEMS[2].svg, flower: GIFT_ITEMS[11].svg,
  };
  // Das gemalte Bild zum Einkleben (Leinwand der Staffelei ohne Gestell)
  const diaryPainting = (motif) => (!EASEL_MOTIF[motif] ? '' : `<svg class="pic" viewBox="9 7 42 44" aria-hidden="true">
    <rect x="9" y="7" width="42" height="44" fill="#bfe3f7"/><circle cx="42" cy="16" r="4.6" fill="#f6c945"/>
    <path d="M9 38 Q21 30 33 36 T51 33 V51 H9Z" fill="#86c46b"/><path d="M9 45 Q26 40 51 45 V51 H9Z" fill="#5fae4a"/>${EASEL_MOTIF[motif][1]}</svg>`);
  // Texte aus seiner Sicht. Mehrere Fassungen je Ereignis: Welche erscheint, hängt an Ereignis und Minute (diaryPick),
  // so steht auf Tablet und Handy derselbe Satz, auch beim zweiten Öffnen. {n} = Name des Freunds.
  const DIARY_TXT = {
    wake: ['Aufgewacht! Erst mal strecken und gähnen.', 'Guten Morgen! Die Nase zuerst aus dem Bau gesteckt.', 'Zipfelmütze ab, der Tag kann losgehen.'],
    sleep: ['Zipfelmütze auf und ab in den Bau. Gute Nacht!', 'Müde. Ich hab mich im Bau eingekuschelt.', 'Augen zu. Schlaf gut, liebes Tagebuch.'],
    act: {
      read: ['Ein Buch gelesen. An der lustigen Stelle musste ich kichern.', 'Gelesen, bis mir fast die Augen zugefallen sind.',
        'Mein Buch war so spannend, dass ich das Umblättern vergessen hab.'],
      game: ['Gameboy gespielt. Eine Runde gewonnen, juhu!', 'Am Gameboy war der Wurm drin. Mööp.', 'Gameboy gespielt, bis die Daumen müde waren.'],
      tablet: ['Auf dem Bauch gelegen und am Tablet gewischt.', 'Am Tablet geschaut, wohin die Flugzeuge fliegen.'],
      kite: ['Drachen steigen lassen! Der Wind hat ganz schön gezerrt.', 'Mein Drache stand hoch am Himmel. Ich hab die Schnur gut festgehalten.'],
      tv: ['Im Bau ferngesehen. Draußen war es mir zu ungemütlich.', 'Fernsehen im Bau. Gemütlich!'],
      music: ['Ukulele gespielt und mitgesungen. La-la-la!', 'Musik gemacht. Ein Ton ging daneben, plonk. Egal.',
        'Ein kleines Konzert gegeben. Zum Schluss hab ich mich verbeugt.'],
      paint: ['Ich hab {m} gemalt. Ich finde, es ist richtig gut geworden.', 'An der Staffelei gestanden und {m} gemalt.',
        'Ich hab {m} gemalt. Dabei hatte ich einen Farbklecks auf der Nase.'],
      bubbles: ['Seifenblasen gepustet und hinterhergesprungen. Plopp!', 'Seifenblasen! Eine ist direkt vor meiner Nase geplatzt.'],
      sport: ['Frühsport! Hampelmann, Kniebeugen, Strecken. Danach war ich platt.', 'Stirnband auf und los: Frühsport. Ich hab sogar mitgezählt.'],
    },
    // dasselbe kurz, für die Zeile „Außerdem: …“, und als Hauptwort für die Tagesform
    actShort: { read: 'gelesen', game: 'Gameboy gespielt', tablet: 'am Tablet gewischt', kite: 'Drachen steigen lassen', tv: 'ferngesehen',
      music: 'Musik gemacht', paint: 'gemalt', bubbles: 'Seifenblasen gepustet', sport: 'geturnt' },
    actNoun: { read: 'Lesen', game: 'Gameboy', tablet: 'Tablet', music: 'Musik', paint: 'Malen', bubbles: 'Seifenblasen' },
    motif: { blume: 'eine Blume', pika: 'mich selbst', pino: '{n}', bau: 'meinen Bau', flieger: 'ein Flugzeug', regenbogen: 'einen Regenbogen' },
    pino: ['{n} war zu Besuch! Wir haben uns mit den Nasen angestupst.', '{n} kam vorbei. Zusammen ist alles schöner.',
      'Mit {n} gespielt. Beim Abschied hingen meine Ohren kurz.'],
    coffee: ['Es roch nach Kaffee. Ich hab mir auch einen geholt.', 'Kaffeeduft! Ich hab mitgetrunken, Schluck für Schluck.'],
    bird: ['Ein Vögelchen saß da. Ich hab gepiepst, es hat zurückgezwitschert.', 'Besuch von einem Vögelchen. Wir haben uns nett unterhalten.'],
    plane: ['Ein Flugzeug! Ich hab ihm lange nachgeschaut. Brumm.', 'Hoch oben flog ein Flugzeug. Wo es wohl hinwollte?'],
    bfly: ['Ein Schmetterling ist auf meiner Nase gelandet. Ich hab ganz still gehalten.', 'Schmetterling auf der Nase! Ich musste schielen.'],
    heart: ['So viel gestreichelt worden. Mein Fell steht noch ganz flauschig ab.', 'Ganz viele Streicheleinheiten bekommen. Ich bin fast geschmolzen.'],
    parcel: ['Ein Päckchen am Ballon! Ich hab es mit der Zwille heruntergeholt.', 'Ein Päckchen! Schleife auf, Deckel ab.'],
    earn: ['Du kümmerst dich so gut um mich, dass ein Päckchen für mich bereitliegt.', 'Ein neues Päckchen wartet auf mich. Danke fürs Kümmern!'],
    earnGold: ['Eine ganze Woche am Stück gut umsorgt: Dafür gibt es ein goldenes Päckchen!'],
    flowerTaken: ['Ich hab dir eine Blume gepflückt und ins Gras gelegt. Du hast sie genommen!', 'Für dich: eine Blume mit Schleife. Du hast sie angenommen, da hab ich mich gefreut.'],
    flowerWait: ['Ich hab dir eine Blume ins Gras gelegt. Sie wartet auf dich.'],
    flowerWilt: ['Ich hab dir eine Blume hingelegt. Sie ist leider verwelkt. Ich pflück dir bald eine neue.'],
    gather1: ['Eine Blüte für meinen Vorrat gesammelt.'],
    gatherN: ['{c} Blüten für meinen Vorrat gesammelt. Der Winter kann kommen.', '{c} Blüten gepflückt und in den Vorrat gelegt.'],
    hungry: ['Mein Bauch hat geknurrt. Zum Glück gab es bald etwas zu knabbern.'],
    hungryNow: ['Mein Bauch hat geknurrt. Ich hab ganz fest an Löwenzahn gedacht.'],
    clean: ['Alles blitzblank! Danke fürs Saubermachen, da hab ich einen Freudensprung gemacht.', 'Meine Wiese ist wieder sauber. Sie funkelt richtig!'],
    streak: ['Meine Päckchen-Serie fängt von vorn an. Macht nichts, das schaffen wir zusammen.'],
    secret: ['Da steht nichts in meinem Tagebuch. Was ich gemacht habe, bleibt mein Geheimnis.',
      'Da steht nichts. Vielleicht hab ich Purzelbäume geübt. Vielleicht auch nicht.'],
    bote: { washer: ['Die Wäsche war fertig. Ich hab ganz laut Bescheid gesagt!'], dryer: ['Der Trockner war fertig. Die Handtücher waren schön flauschig.'],
      dishwasher: ['Das Geschirr war fertig und hat geglänzt.'] },
    fest: { witch: 'Halloween! Ich hab einen Hexenhut auf.', martin: 'St. Martin! Laterne, Laterne …', boot: 'Nikolaus! Mein Stiefel ist voll.',
      xmas: 'Weihnachten! Bei mir steht ein Tannenbaum.', sticks: 'Frohes Neues! Ich hab das Feuerwerk gesehen.', karneval: 'Helau! Es regnet Konfetti.',
      ostern: 'Ostern! Im Gras liegen bunte Eier.', maibaum: 'Hinter meinem Bau steht ein Maibaum.', sommer: 'Sommerfest! Die Wimpel flattern.' },
    treasure: ['Stups ich an und flitze hinterher.', 'Dreht sich im echten Wind.', 'Mit dem kuschle ich nachts.', 'Für sonnige Tage ab 24 Grad.',
      'Damit schau ich Flugzeugen nach.', 'Für mein Nickerchen.', 'Damit gieße ich die Blumen.', 'Bimmelt, wenn ich rauskomme.'],
    wx: { sunny: 'sonnig', clear: 'klar', 'clear-night': 'klar', partlycloudy: 'heiter', cloudy: 'bewölkt', rainy: 'Regen', pouring: 'Starkregen',
      snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', fog: 'Nebel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', hail: 'Hagel',
      windy: 'windig', 'windy-variant': 'windig' },
  };
  const diaryPick = (list, ...key) => list[Math.floor(seedRnd('tb', ...key) * list.length)];
  const diaryTime = (t) => {
    const d = new Date(t);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const bitCount = (n) => {
    let c = 0;
    for (let v = n >>> 0; v; v &= v - 1) c++;
    return c;
  };
  // Verlauf → Roh-Ereignisse { t, k, … }. S und P: [{ t, v }] mit geparstem Zustand bzw. Tagesplan, aufsteigend; der
  // jeweils erste Stand ist nur die Ausgangslage. from: Ereignisse davor zählen nicht. decayAt(t, h): wann ab t h
  // Abbau-Stunden um sind (für „Bauch hat geknurrt“), until: jetzt.
  // → { ev, stamps (wann sich überhaupt etwas änderte), pets (Pika-Tag → wie oft gestreichelt) }
  const diaryDerive = (S, P, from, { decayAt, until }) => {
    const ev = [];
    const stamps = [];
    const pets = {};
    const add = (t, k, x) => t >= from && ev.push({ t, k, ...x });
    const acts = new Map(); // Fenster → Ereignis (das Motiv beim Malen kommt erst am Ende dazu)
    const fed = new Set((P[0]?.v.fd || []).map((f) => f.t));
    let pend = null; // verschenktes, noch nicht ausgepacktes Päckchen
    const petMax = (c) => c && (pets[c.d] = Math.max(pets[c.d] || 0, c.n));
    petMax(P[0]?.v.cute);
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1].v;
      const b = P[i].v;
      const t = P[i].t;
      stamps.push(t);
      for (const [k, name, v] of b.rec) {
        if (acts.has(k)) {
          if (v) acts.get(k).v = v;
        } else if (!a.rec.some((e) => e[0] === k) && k * ACT_WIN.big > t - 3 * 36e5) {
          // (ein Fenster von vor Stunden ist kein neues: Es fiel nur aus dem Verlauf und kam zurück)
          const e = { t, k: 'act', a: name, v: v || '' };
          acts.set(k, e);
          if (t >= from) ev.push(e);
        }
      }
      if (b.hay.c !== a.hay.c || b.hay.m > a.hay.m) add(t, 'gather');
      if (b.fl && b.fl.t !== a.fl?.t) add(b.fl.t, 'flower', { id: b.fl.t, taken: !!b.fl.k });
      else if (b.fl?.k && !a.fl?.k) {
        const e = ev.find((x) => x.k === 'flower' && x.id === b.fl.t);
        if (e) e.taken = true;
        else add(t, 'flower', { id: b.fl.t, taken: true });
      }
      for (const f of b.fd) {
        if (fed.has(f.t)) continue;
        fed.add(f.t);
        add(f.t, 'feed');
      }
      const c = b.cute;
      if (c) {
        petMax(c);
        const neu = c.m & ~(a.cute?.d === c.d ? a.cute.m : 0);
        MEM_BITS.forEach((name, bit) => neu & (1 << bit) && add(t, 'mem', { b: name }));
      }
      const g0 = a.gift;
      const g1 = b.gift;
      if (g0 && g1) {
        if (g1.k === g0.k && g1.a > g0.a) add(t, 'earn');
        if (g1.k === g0.k && g1.d > g0.d) add(t, 'earnGold');
        if (g1.k !== g0.k && g0.b != null && g1.a === 0) add(t, 'streak');
        if (g1.z > g0.z) {
          const it = g1.i & 15;
          const bit = 1 << it;
          const v0 = g0.v || 0;
          const v1 = g1.v || 0;
          pend = { z: g1.z, it, gold: !!(g1.i & 16), what: it >= GIFT_TRE ? 'treat' : !(g0.u & bit) ? 'new'
            : v1 & (bit << 8) && !(v0 & (bit << 8)) ? 'gilt' : v1 & bit && !(v0 & bit) ? 'trick' : 'new' };
        }
        if (g1.o > g0.o) {
          const it = g1.i & 15;
          add(t, 'parcel', pend && pend.z <= g1.o ? pend : { it, gold: !!(g1.i & 16), what: it >= GIFT_TRE ? 'treat' : 'new' });
          pend = null;
        }
      }
    }
    // Zustand: Großputz, einzeln weggemachte Häufchen, und wann der Bauch knurrte (satt unter 30 %, bevor es wieder stieg)
    let food = S[0]?.v;
    const growl = (v, end, eaten) => {
      if (!v || !(v.s > 30)) return;
      const x = decayAt(v.st, (v.s - 30) / RATE.s);
      if (x < end) add(x, 'hungry', { eaten });
    };
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1].v;
      const b = S[i].v;
      const t = S[i].t;
      stamps.push(t);
      if (b.c > a.c) add(t, 'clean', { n: 1, all: true });
      else if (b.c === a.c && b.m & ~a.m) add(t, 'clean', { n: bitCount(b.m & ~a.m) });
      if (b.st !== food.st) {
        growl(food, b.st, true);
        food = b;
      }
    }
    growl(food, until, false);
    return { ev, stamps: stamps.sort((x, y) => x - y), pets };
  };
  // Fenster über dem Dashboard (eigener Schattenbaum an document.body): Notizbuch mit Klebestreifen und Linien
  const STYLE_DIARY = `
  :host { all: initial; }
  .bd {
    position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 14px;
    box-sizing: border-box; background: rgba(40, 28, 18, .5); animation: tbin .2s; -webkit-tap-highlight-color: transparent;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, "Segoe UI", system-ui, sans-serif));
    --pp: #fbf5e6; --ink: #4a3a2c; --soft: #8a7461; --line: rgba(90, 64, 48, .09); --tab: rgba(90, 64, 48, .08); --acc: #c9853a;
  }
  .bd.night { --pp: #262d4a; --ink: #ecebf7; --soft: #a9add0; --line: rgba(255, 255, 255, .07); --tab: rgba(255, 255, 255, .09); --acc: #f2c56b; }
  .sheet {
    position: relative; display: flex; flex-direction: column; width: min(440px, 100%); height: min(640px, 100%);
    box-sizing: border-box; border-radius: 18px; background: var(--pp); color: var(--ink); outline: none;
    box-shadow: 0 14px 44px rgba(0, 0, 0, .4); animation: tbup .3s cubic-bezier(.3, 1.3, .5, 1);
  }
  .sheet::before {
    content: ''; position: absolute; left: 50%; top: -8px; width: 92px; height: 21px; margin-left: -46px; border-radius: 2px;
    background: repeating-linear-gradient(90deg, rgba(242, 143, 177, .85) 0 8px, rgba(246, 201, 69, .85) 8px 16px);
    transform: rotate(-2deg); box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
  }
  .hd { display: flex; align-items: center; gap: 10px; padding: 18px 12px 6px 18px; }
  .hd .bk { flex: none; width: 34px; height: 34px; transform: rotate(-6deg); }
  .hd svg, .ic svg, .chips svg, .t i svg, .row > i svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .ht { flex: 1; min-width: 0; }
  .ht b { display: block; font-size: 19px; font-weight: 800; line-height: 1.2; }
  .ht span { display: block; font-size: 13px; color: var(--soft); margin-top: 1px; }
  button { font: inherit; color: inherit; border: none; background: none; cursor: pointer; padding: 0; }
  button:focus-visible, .page:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px; }
  .x { flex: none; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; color: var(--soft); }
  .x:hover { background: var(--tab); }
  .tabs { display: flex; gap: 6px; padding: 6px 16px 10px; }
  .tabs button { flex: 1; height: 38px; border-radius: 12px; font-size: 14px; font-weight: 700; color: var(--soft); background: var(--tab); }
  .tabs button[aria-selected="true"] { background: var(--acc); color: #fff; }
  .night .tabs button[aria-selected="true"] { color: #2a2238; }
  .page {
    flex: 1; min-height: 120px; overflow-y: auto; overscroll-behavior: contain; padding: 4px 18px 16px; border-radius: 0 0 18px 18px;
    background: repeating-linear-gradient(transparent 0 31px, var(--line) 31px 32px) local;
    scrollbar-width: thin; scrollbar-color: var(--soft) transparent;
  }
  .fazit { margin: 6px 0 10px; font-size: 16px; line-height: 1.45; font-weight: 600; font-style: italic; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
  .chips span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px 4px 7px; border-radius: 999px; font-size: 13px; font-weight: 700; background: var(--tab); }
  .chips i { display: block; width: 15px; height: 15px; }
  h3 { margin: 16px 0 2px; font-size: 13px; font-weight: 800; letter-spacing: .02em; color: var(--acc); }
  .e { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 11px; padding: 8px 0; }
  .ic { display: block; width: 40px; height: 40px; box-sizing: border-box; padding: 7px; border-radius: 50%; background: rgba(255, 255, 255, .75);
    box-shadow: 0 1px 3px rgba(90, 64, 48, .22); transform: rotate(-4deg); color: var(--soft); }
  .e:nth-child(even) .ic { transform: rotate(3deg); }
  .night .ic { background: rgba(255, 255, 255, .14); box-shadow: none; }
  .tm { display: block; font-size: 12px; font-weight: 700; color: var(--soft); }
  .e p { margin: 1px 0 0; font-size: 15px; line-height: 1.45; }
  .e.dim p { color: var(--soft); }
  .e.sub p { font-size: 14px; color: var(--soft); }
  .pic { display: block; width: 84px; height: 88px; margin: 8px 0 2px 4px; padding: 5px 5px 14px; background: #fff; border-radius: 2px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .25); transform: rotate(-3deg); box-sizing: border-box; }
  .wait, .none { margin: 26px 4px; text-align: center; font-size: 15px; line-height: 1.5; color: var(--soft); }
  .note { margin: 14px 0 0; font-size: 12px; color: var(--soft); }
  .sign { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 700; color: var(--soft); }
  .sign i { display: block; width: 18px; height: 18px; transform: rotate(14deg); }
  .sign svg { display: block; width: 100%; height: 100%; }
  .tre { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
  .t { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 9px; align-items: center; padding: 8px; border-radius: 12px; background: var(--tab); }
  .t i, .row > i { display: block; width: 38px; height: 38px; position: relative; }
  .t b, .row b { display: block; font-size: 14px; font-weight: 800; line-height: 1.25; }
  .t span, .row span { display: block; font-size: 12px; line-height: 1.3; color: var(--soft); }
  .t.miss i svg { filter: brightness(0); opacity: .16; }
  .night .t.miss i svg { filter: brightness(0) invert(1); opacity: .2; }
  .t.lv2 i::after { content: ''; position: absolute; right: -2px; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: #5fb9de; box-shadow: 0 0 0 2px var(--pp); }
  .t.gilt i svg { filter: ${GILT_F} drop-shadow(0 0 2px rgba(255, 214, 90, .9)); }
  .t.gilt i::after { background: #f2b632; }
  .row { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 11px; align-items: center; padding: 10px 8px 0; }
  .row .w { color: #d9622b; font-weight: 800; }
  .dots { display: inline-flex; gap: 3px; margin-left: 6px; vertical-align: -1px; }
  .dots u { width: 9px; height: 9px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(90, 64, 48, .35); }
  @keyframes tbin { from { opacity: 0; } }
  @keyframes tbup { from { transform: translateY(24px) scale(.96); opacity: 0; } }
  @media (max-width: 520px) {
    .bd { align-items: flex-end; padding: 0; }
    .sheet { width: 100%; height: min(640px, 90%); border-radius: 20px 20px 0 0; }
    .page { border-radius: 0; padding-bottom: 24px; }
    .tre { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) { .bd, .sheet { animation: none; } }
  `;
  // In der Karte: Die Statusleiste ist der Einstieg (Buch und Punkt für Neues), ohne Leiste ein kleiner Buch-Knopf
  const STYLE_DIARY_BTN = `
  .stats .tb { display: none; position: relative; width: 16px; height: 16px; margin-right: -3px; }
  .stats .tb svg { display: block; width: 100%; height: 100%; }
  .stats.dia { cursor: pointer; }
  .stats.dia .tb { display: block; }
  .stats.dia:active { transform: scale(.97); }
  .stats:focus-visible, .tbbtn:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  .stats.neu .tb::after, .tbbtn.neu::after {
    content: ''; position: absolute; right: -3px; top: -3px; width: 7px; height: 7px; border-radius: 50%; background: #e8584e;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, .9);
  }
  .tbbtn {
    position: absolute; left: 8px; top: 6px; z-index: 5; width: 32px; height: 32px; padding: 6px; border: none; border-radius: 50%;
    cursor: pointer; background: rgba(255, 255, 255, .75); box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s;
  }
  .tbbtn[hidden] { display: none; }
  .tbbtn:active { transform: scale(.88); }
  .tbbtn svg { display: block; width: 100%; height: 100%; }
  .night .tbbtn { background: rgba(15, 22, 45, .55); }
  `;
  // ==================== Ende Tagebuch ====================

  const STYLE = `
  :host { display: block; height: 100%; }
  ha-card { display: block; height: 100%; overflow: hidden; background: none; border-radius: var(--ha-card-border-radius, 12px); }
  .scene {
    /* clip statt hidden, wo es das gibt: hidden bleibt per Skript scrollbar (Fokus, scrollIntoView auf ein Element, das
       über den Rand ragt), die ganze Szene stünde dann verschoben und käme nie zurück */
    position: relative; height: 100%; overflow: hidden; overflow: clip; border-radius: inherit;
    /* Größe kommt von außen, nichts ragt hinaus: Stil, Layout und Malen bleiben auf die Karte begrenzt */
    contain: strict;
    user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, sans-serif));
    --h1: #a9d68f; --h2: #86c46b; --h3: #7ab960;
    --h0: #b4dcc2; /* ferne Hügelkette (depth): --h1 halb mit dem Himmel auf ihrer Höhe gemischt, deckend */
  }
  .scene.dusk { --h1: #8fa98a; --h2: #6e9562; --h3: #648c58; --h0: #b4a09e; }
  .scene.night { --h1: #2c4547; --h2: #26433a; --h3: #223d34; --h0: #273a52; }

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
  .night .stars i { opacity: var(--starop, .85); }
  .dusk .stars i:nth-child(3n + 1) { opacity: calc(var(--starop, .85) * .6); }
  /* Funkeln pro Ebene (je acht Sterne), mit eigenem Takt und Versatz, damit es nicht im Gleichschritt pulsiert */
  .stars b { position: absolute; inset: 0; }
  .night .stars b { animation: twinkle 3s ease-in-out infinite alternate; }
  .night .stars b:nth-child(2) { animation-duration: 2.6s; animation-delay: -1.9s; }
  .night .stars b:nth-child(3) { animation-duration: 3.4s; animation-delay: -4.1s; }
  @keyframes twinkle { to { opacity: .3; } }

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
  .scene.snowcover { --h1: #e9eff3; --h2: #dfe7ed; --h3: #cfdbe3; --h0: #d4e8f4; }
  .scene.dusk.snowcover { --h1: #b9bdd0; --h2: #aeb4c8; --h3: #a1a9bf; --h0: #c9aac1; }
  .scene.night.snowcover { --h1: #55627c; --h2: #4c5974; --h3: #44516b; --h0: #3c496d; }
  .snowcover .flowers { opacity: 0; }

  /* ---- Prototyp Tiefe (depth: true) ----
     Kulisse in Ebenen: Je weiter weg, desto mehr wandert sie mit dem Pika mit (--plx -1 … 1, die Wiese
     mit Bau, Stein und Heu bleibt stehen). Ferne Hügelkette im Dunst nur hier, deckend im Dunstton (--h0),
     sonst schiene die tiefstehende Sonne durch. Einheiten der viewBox (100 breit), scaleX deckt die Ränder
     beim Verschieben ab. */
  .hills .h0 { display: none; fill: var(--h0); transition: fill 2.5s; }
  .tiefe .hills .h0 { display: inline; }
  .tiefe .hills .mtn, .tiefe .hills .h0, .tiefe .hills .h1 { transform-box: view-box; transform-origin: 50% 100%; }
  .tiefe .hills .mtn { transform: translateX(calc(var(--plx, 0) * 3.2px)) scaleX(1.08); transition: transform 4s ease-in-out; }
  .tiefe .hills .h0 { transform: translateX(calc(var(--plx, 0) * 2.4px)) scaleX(1.06); transition: fill 2.5s, transform 4s ease-in-out; }
  .tiefe .hills .h1 { transform: translateX(calc(var(--plx, 0) * 1.2px)) scaleX(1.03); transition: fill 2.5s, transform 4s ease-in-out; }
  .tiefe .clouds { transform: translateX(calc(var(--plx, 0) * 2%)); transition: transform 4s ease-in-out; }
  /* Hintere Spur: Schatten etwas blasser, tagsüber ein Hauch Dunst (heller, weniger satt) */
  .pika.lane1 .shadow { opacity: .75; }
  .pika .br { transition: filter 1s; }
  .day:not(.overcast) .pika.lane1 .br { filter: saturate(.85) brightness(1.05); }
  /* Hintere Spur (.hinten an der Szene, wechselt auf halbem Weg): Blumen, Futter, Geschenke und Mäuse vorn
     liegen im DOM vor dem Pika und ohne z-index, sonst stünde er vor ihnen. Darum der Pika unter sie,
     über Bau, Stein und Festdeko am Bau (z 1, im DOM davor), unter Vögeln (z 2), Pino, Heu und Gras (z 3). */
  .hinten .pika { z-index: 1; }
  .hinten .flowers, .hinten .foods, .hinten .gifts, .hinten .mice-f { z-index: 2; }
  /* Die Ebenen füllen die ganze Szene: Tipps zum Pika durchlassen (Antippbares darin setzt selbst auto) */
  .hinten .flowers, .hinten .foods { pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .tiefe .hills *, .tiefe .clouds { transition: none !important; } }

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
  @keyframes sway { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  .windy .flower { animation: sway-wind 1.1s ease-in-out infinite alternate; }
  /* Nach der Wind-Regel (gleiche Spezifität, die spätere gewinnt): Auch bei Wind wächst eine Blume und wird gepflückt */
  .windy .flower.grow { animation: grow 1.4s ease-out, sway-wind 1.1s 1.4s ease-in-out infinite alternate; }
  .flower.picked, .windy .flower.picked { animation: picked .35s forwards; }
  @keyframes sway-wind { from { transform: rotate(var(--sw1, -2deg)); } to { transform: rotate(var(--sw2, 14deg)); } }

  /* Regen, Schnee, Nebel, Blitz */
  .precip { position: absolute; inset: -10% -25%; pointer-events: none; z-index: 4; transform: skewX(var(--slant, 0deg)); }
  /* Tropfen und Flocken fallen nicht einzeln, sondern in drei Ebenen (fern, mitte, nah) mit eigenem Tempo.
     Jede Ebene ist doppelt so hoch wie der Niederschlagsbereich und enthält ihr Muster zweimal übereinander.
     Sie rutscht genau eine Höhe nach unten und beginnt von vorn: nahtlos, ohne Wiederholung im Bild, und statt
     bis zu 55 Animationen laufen nur drei (Schnee: sechs, das Schaukeln liegt auf einer eigenen Hülle). */
  .precip .pl { position: absolute; left: 0; right: 0; top: -100%; height: 200%; animation: pfall var(--pd) linear infinite; }
  @keyframes pfall { to { transform: translateY(50%); } }
  .precip .pw { position: absolute; inset: 0; animation: psway var(--pw) ease-in-out infinite; }
  @keyframes psway { 25% { transform: translateX(8px); } 50% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
  .precip i { position: absolute; }
  .precip .r {
    width: 1.5px; height: calc(var(--H) * .08); border-radius: 1px;
    background: linear-gradient(rgba(255, 255, 255, 0), rgba(215, 232, 255, .85));
  }
  .precip .s { border-radius: 50%; background: #fff; }
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
    z-index: 3; cursor: pointer; will-change: transform; touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
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
  /* Im Bau liegt er hinter Pino (z 3), der draußen vor dem Eingang vorbeihoppelt; Vögel (z 2) stehen im DOM davor */
  .pika.inside { z-index: 2; }
  /* In der Luft schrumpft und verblasst der Schatten, im Takt von hop, hops, hopb, jump und binky (--shs, --sho = am Scheitel) */
  .walking .shadow { --shs: .86; --sho: .66; animation: sh-hop .36s linear infinite; }
  .walking.trip .shadow { --shs: .93; --sho: .84; animation: sh-trip .24s linear infinite; }
  .walking.bighop .shadow { --shs: .78; --sho: .52; animation-duration: .42s; }
  @keyframes sh-hop {
    0%, 100% { transform: scale(1.04); opacity: 1; animation-timing-function: ease-out; }
    11% { transform: none; opacity: 1; animation-timing-function: cubic-bezier(.3, .6, .5, 1); }
    50% { transform: scale(var(--shs)); opacity: var(--sho); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
    88% { transform: none; opacity: 1; animation-timing-function: ease-out; }
  }
  @keyframes sh-trip {
    0%, 100% { transform: none; opacity: 1; animation-timing-function: ease-out; }
    50% { transform: scale(var(--shs)); opacity: var(--sho); animation-timing-function: ease-in; }
  }
  .shadow.hop1 { animation: sh-jump .6s cubic-bezier(.3, .7, .4, 1); }
  @keyframes sh-jump {
    15% { transform: scale(1.05); opacity: 1; animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    45% { transform: scale(.7); opacity: .45; animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    75% { transform: scale(1.05); opacity: 1; animation-timing-function: ease-out; }
  }
  .shadow.binky { animation: sh-binky .9s ease-in-out; }
  @keyframes sh-binky {
    12% { transform: scale(1.06); opacity: 1; animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    40% { transform: scale(.62); opacity: .38; }
    60% { transform: scale(.72); opacity: .48; animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    82% { transform: scale(1.05); opacity: 1; animation-timing-function: ease-out; }
  }
  .pika.inside .brolly { display: none; }
  .flip { transition: transform .25s; }
  .left .flip { transform: scaleX(-1); }
  .pk { display: block; width: 100%; height: 100%; overflow: visible; }
  /* Nachts und im Bau dunklere Fellfarben statt filter (der atmende Pika müsste sonst jedes Bild neu gefiltert werden).
     Pino (aus PIKA_SVG, eigene Fellfarben als Rückfallwerte) behält vorerst den Nachtfilter. */
  .night .pika .pk { ${PK_DIM(0.8, 0.85)} }
  .pika.inside .pk { ${PK_DIM(0.85, 1)} }
  .night .pika.inside .pk { ${PK_DIM(0.68, 0.85)} }
  .pk stop, .pk [fill^="var(--pk-"], .pk [stroke^="var(--pk-"] { transition: fill 1s, stop-color 1s, stroke 1s; }
  /* Schal, Hüte und Tasse haben feste Farben: nachts und im Bau per Filter so gedimmt wie das Fell. Die Gruppen sind
     klein und stehen still; die Pfoten an der Tasse (.cps) und die Zipfelmütze laufen schon über die Fellfarben. */
  ${PK_ACC('.pika')} { transition: filter 1s; }
  ${PK_ACC('.night .pika')} { filter: brightness(.8) saturate(.85); }
  ${PK_ACC('.pika.inside')} { filter: brightness(.85); }
  ${PK_ACC('.night .pika.inside')} { filter: brightness(.68) saturate(.85); }
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
  /* .happy doppelt: schlägt die späteren Regeln, die .seye einblenden (.squat, .doze, .sip, .strain, .yawning …).
     Sonst lägen beim Streicheln in der Hocke, beim Kaffee oder Gewichtheben beide Augenpaare übereinander. */
  .happy.happy .seye { display: none; }
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
  /* In Stufen: das Blatt dreht nur ±3°, stufenweise sieht man keinen Unterschied, das Pika-SVG wird aber nur
     etwa viermal pro Sekunde neu gemalt statt in jedem Bild (Regen dauert oft Stunden). Im Bau und im Schlaf ruht es. */
  .wet:not(.inside):not(.sleeping) .brolly { animation: brolly 2.6s steps(10) infinite alternate; }
  @keyframes brolly { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
  .carry .mfood, .eating .mfood { display: inline; }
  /* Anderes Futter als eine Blüte (Leckerli aus dem Päckchen, Heu): dessen Grafik statt der Blüte */
  .mf-item, .mfood.item .mf-bloom { display: none; }
  .mfood.item .mf-item { display: inline; }
  .mbloom { fill: var(--mf, #f6c945); stroke: rgba(0, 0, 0, .15); stroke-width: .5; }
  .mfood.shrink { transform-box: fill-box; transform-origin: 0% 30%; animation: shrink var(--eat, 3s) linear forwards; }
  @keyframes shrink { to { transform: scale(.1); opacity: .2; } }
  .mouth-g { transform-box: fill-box; transform-origin: 50% 0%; }
  .eating .mouth-g { animation: chew .26s ease-in-out infinite; }
  @keyframes chew { 50% { transform: translateY(.9px) scale(1.05, .88); } }
  .groom .paws { display: inline; transform-box: fill-box; animation: rub .3s ease-in-out infinite alternate; }
  @keyframes rub { from { transform: translateY(1px); } to { transform: translateY(-6px); } }
  .sleeping .cap { display: inline; }

  /* ---- Mimik, Streicheln, kleine Momente ----
     Fast alles läuft einmal über eine Zustandsklasse ab (keine Dauerschleifen), so bleibt es auf schwachen Tablets leicht.
     Kopf (Ohren, Gesicht, Mützen) dreht um die Kopfmitte, der Körperumriss bleibt: das reicht zum Schiefhalten. */
  .hd { transform-box: view-box; transform-origin: 90px 50px; transition: transform .4s cubic-bezier(.3, 1.5, .5, 1); }
  .tilt .hd { transform: rotate(11deg); }
  .tilt-b .hd { transform: rotate(-9deg); }
  /* Bäckchen werden rot, bei viel Streicheln mit Strichelchen */
  .chk { transform-box: fill-box; transform-origin: 50% 50%; transition: opacity .5s, transform .5s; }
  .blush .chk { opacity: .95; transform: scale(1.35, 1.3); }
  .blines { display: none; }
  .blush .blines { display: inline; }
  /* Nase wackelt, Schnurrhaare zittern mit */
  .nose { transform-box: fill-box; transform-origin: 50% 80%; }
  .wsk { transform-box: fill-box; transform-origin: 50% 50%; }
  .nosey .nose { animation: nwig .13s ease-in-out 6 alternate; }
  .nosey .wsk { animation: wskj .13s ease-in-out 6 alternate; }
  .sniff .nose, .presneeze .nose { animation: nwig .11s ease-in-out infinite alternate; }
  @keyframes nwig { to { transform: translateY(-.6px) scale(1.14, .84); } }
  @keyframes wskj { to { transform: translateY(-.6px); } }
  /* Münder: zufrieden (ω), Zungenspitze (mlem), Hecheln, Gähnen */
  .wmouth, .tongue, .yawnm, .estar, .sleg, .epaws { display: none; }
  .content .mth { display: none; }
  .content .wmouth { display: inline; }
  .tongue { transform-box: fill-box; transform-origin: 50% 0%; }
  .mlem .tongue { display: inline; animation: mlem .9s ease-in-out forwards; }
  @keyframes mlem { 0% { transform: scaleY(0); } 25%, 65% { transform: scaleY(1); } 45% { transform: translateX(.7px) scaleY(.75); } 100% { transform: scaleY(0); } }
  .pant .tongue { display: inline; animation: pant .28s ease-in-out infinite alternate; }
  @keyframes pant { from { transform: scaleY(.65); } }
  .yawnm { transform-box: fill-box; transform-origin: 50% 8%; }
  .yawning .yawnm { display: inline; animation: yawnm 2.2s ease-in-out forwards; }
  .yawning .mth, .yawning .wmouth { display: none; }
  @keyframes yawnm { 0% { transform: scale(.3, .1); } 30%, 72% { transform: scale(1); } 100% { transform: scale(.3, .05); } }
  .yawning .face { transform: translate(1px, -2.5px); }
  .yawning .ear-l { transform: rotate(-12deg); }
  .yawning .ear-r { transform: rotate(12deg); }
  .yawning .hop { animation: yawnb 2.2s ease-in-out; }
  @keyframes yawnb { 30%, 72% { transform: scale(.95, 1.07); } }
  /* Augen: zu und genießen, Glanzsterne, schielen */
  .bowing .eye, .squint .eye, .yawning .eye, .earwash .eye, .nodding .eye, .sneezing .eye { display: none; }
  .bowing .seye, .squint .seye, .yawning .seye, .earwash .seye, .nodding .seye, .sneezing .seye { display: inline; }
  .happy.squint .seye { display: none; }
  .estar { transform-box: fill-box; transform-origin: 50% 50%; }
  .sparkle .estar { display: inline; animation: estar .7s ease-in-out infinite alternate; }
  .sparkle .hl1 { display: none; }
  .sparkle:not(.blink) .eye { transform: scale(1.14); }
  @keyframes estar { from { transform: scale(.7) rotate(-12deg); } to { transform: scale(1.15) rotate(12deg); } }
  .crosseye .eye-l { transform: translate(2.2px, 1px) scale(.82); }
  .crosseye .eye-r { transform: translate(-2.4px, 1px) scale(.82); }
  .presneeze .eye { transform: scaleY(.4); }
  /* Ohren: flach angelegt, Nachschwingen, angetippt flappen */
  .flat .ear-l { transform: rotate(-36deg); }
  .flat .ear-r { transform: rotate(32deg); }
  .eflap-l .ear-l, .eflap-r .ear-r { animation: eflap .9s ease-out; }
  @keyframes eflap { 12% { transform: rotate(-28deg); } 30% { transform: rotate(20deg); } 48% { transform: rotate(-12deg); } 66% { transform: rotate(7deg); } 84% { transform: rotate(-3deg); } }
  .lnd:not(.walking) .ear-l { animation: eswing .55s ease-out; }
  .lnd:not(.walking) .ear-r { animation: eswing .55s .06s ease-out; }
  @keyframes eswing { 25% { transform: rotate(10deg); } 55% { transform: rotate(-5deg); } 80% { transform: rotate(2deg); } }
  /* Im Schlaf zucken (Ohren bleiben dabei angelegt) */
  .sleeping.stw .hop { animation: stw .45s ease-out; }
  @keyframes stw { 30% { transform: scale(1.03, .96) translateY(1%); } }
  .sleeping.stw .ear-l { animation: stwear .5s ease-out; }
  @keyframes stwear { 0%, 100% { transform: rotate(-30deg); } 35% { transform: rotate(-40deg); } 70% { transform: rotate(-25deg); } }
  /* Bewegung: Landen mit Nachwippen, Trippeln, große Hopser, Stolpern */
  .lnd:not(.walking) .hop { animation: lnd .36s ease-out; }
  @keyframes lnd { 25% { transform: scale(1.07, .93); } 60% { transform: scale(.98, 1.02); } }
  .walking.trip .hop { animation: hops .24s linear infinite; }
  @keyframes hops {
    0%, 100% { transform: translateY(0) scale(1.03, .97); animation-timing-function: ease-out; }
    50% { transform: translateY(-4.5%) scale(.99, 1.01); animation-timing-function: ease-in; }
  }
  .walking.bighop .hop { animation: hopb .42s linear infinite; }
  @keyframes hopb {
    0%, 100% { transform: translateY(0) scale(1.08, .92); animation-timing-function: ease-out; }
    12% { transform: translateY(-2%) scale(.96, 1.05); animation-timing-function: cubic-bezier(.3, .6, .5, 1); }
    50% { transform: translateY(-17%) scale(.97, 1.03); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
    88% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  }
  .walking.bighop .ear-l, .walking.bighop .ear-r { animation-duration: .21s; }
  .stumble .hop { animation: stumble .75s ease-out; }
  @keyframes stumble { 18% { transform: rotate(17deg) translateY(2%) scale(1.06, .9); } 45% { transform: rotate(-6deg); } 70% { transform: rotate(3deg); } }
  /* Streicheln: reinlehnen, kichern, auf den Rücken kippen, dahinschmelzen, Fell plustern, Klopfbein */
  .hop { transition: transform .35s ease-out; }
  .lean .hop { transform: rotate(4deg) scale(1.02, .98); }
  .tickle .hop { animation: tickle .15s ease-in-out 6 alternate; }
  @keyframes tickle { from { transform: rotate(-3.5deg); } to { transform: rotate(3.5deg) scale(1.02, .98); } }
  .roll .hop { transform: rotate(-26deg) translateY(-3%); }
  .melt .hop { transform: scale(1.16, .8); transition: transform .7s ease-out; }
  .body { transform-box: fill-box; transform-origin: 50% 100%; }
  .fluffy .body { animation: fluffy .8s ease-out; }
  @keyframes fluffy { 30% { transform: scale(1.07, 1.06); } 55% { transform: scale(1.04, 1.03) skewX(-2deg); } }
  .bfoot { transform-box: fill-box; transform-origin: 20% 50%; }
  .ffoot { transform-box: fill-box; transform-origin: 50% 50%; }
  /* Hoppeln: Der Hinterlauf stößt ab und streckt sich nach hinten, die Vorderpfoten greifen nach vorn und setzen zuerst auf */
  .walking .bfoot { animation: fb-hop .36s linear infinite; }
  .walking .ffoot { animation: ff-hop .36s linear infinite; }
  .walking.trip .bfoot, .walking.trip .ffoot { animation-duration: .24s; }
  .walking.bighop .bfoot, .walking.bighop .ffoot { animation-duration: .42s; }
  @keyframes fb-hop {
    0%, 88%, 100% { transform: none; }
    10% { transform: rotate(12deg); }
    45% { transform: translate(-3.5px, -.5px) rotate(28deg); }
    74% { transform: translate(1px, 0) rotate(-10deg); }
  }
  @keyframes ff-hop {
    0%, 88%, 100% { transform: none; }
    10% { transform: translate(1px, -1.5px) rotate(-14deg); }
    45% { transform: translate(3px, -1px) rotate(-8deg); }
    74% { transform: translate(2.5px, .5px) rotate(8deg); }
  }
  /* Sprünge auf der Stelle: Füße in der Luft angezogen */
  .jump.hop1 .bfoot { animation: fb-air .6s ease-in-out; }
  .jump.hop1 .ffoot { animation: ff-air .6s ease-in-out; }
  .jump.binky .bfoot { animation: fb-air .9s ease-in-out; }
  .jump.binky .ffoot { animation: ff-air .9s ease-in-out; }
  @keyframes fb-air { 0%, 12%, 84%, 100% { transform: none; } 32%, 62% { transform: translate(3px, -1.5px) rotate(16deg); } }
  @keyframes ff-air { 0%, 12%, 84%, 100% { transform: none; } 32%, 62% { transform: translate(-1px, -1.5px) rotate(14deg); } }
  .thump .bfoot { animation: thump .13s ease-in-out infinite alternate; }
  @keyframes thump { to { transform: translateY(-3.5px) rotate(-14deg); } }
  /* Hinterpfote kratzt am Ohr */
  .scratching .sleg { display: inline; animation: scr .12s ease-in-out infinite alternate; }
  @keyframes scr { from { transform: translate(-1px, 2px); } to { transform: translate(1.5px, -2.5px); } }
  .scratching .hd { transform: rotate(-12deg); }
  .scratching .hop { transform: rotate(-5deg); }
  .scratching .ear-l { animation: twitch .3s infinite; }
  /* Ohr putzen: das vordere Ohr mit beiden Pfoten herunterziehen */
  .fear { display: none; }
  .earwash .fear { display: inline; }
  .earwash .ear-r { opacity: 0; }
  .earwash .ear-f { transform: rotate(68deg); }
  .earwash .epaws { display: inline; transform-box: fill-box; animation: rub .32s ease-in-out infinite alternate; }
  .earwash .hd { transform: rotate(8deg); }
  /* Schluckauf, Einnicken, Niesen */
  .hic .hop { animation: hic .34s ease-out; }
  @keyframes hic { 30% { transform: translateY(-6%) scale(.95, 1.06); } }
  .nodding .hd { transform: translateY(3px) rotate(13deg); transition: transform 1.8s ease-in; }
  .nodding .zzz { display: block; }
  .presneeze .hd { transform: rotate(-11deg) translateY(-1px); transition: transform .5s; }
  .sneezing .hop { animation: sneeze .45s ease-out; }
  @keyframes sneeze { 20% { transform: rotate(9deg) scale(1.06, .92); } 55% { transform: rotate(-2deg); } }
  /* Atmen nach Stimmung: aufgeregt schneller, satt und zufrieden ruhiger */
  .excited .br { animation-duration: 1.5s; }
  .calm:not(.excited):not(.sleeping) .br { animation: breathe-calm 4.8s ease-in-out infinite; }
  @keyframes breathe-calm { 50% { transform: scale(1.016, 1.03); } }
  .sleeping .br { animation: breathe-deep 4.6s ease-in-out infinite; }

  /* Kleine Zeichen über dem Kopf: ?, !, Schweißtropfen, Funkeln, Grummelwolke */
  .emo {
    position: absolute; left: 0; bottom: 0; pointer-events: none; font-weight: 900; color: #fff; line-height: 1;
    font-size: calc(var(--ph) * .22); text-shadow: 0 1px 3px rgba(0, 0, 0, .5);
    animation: emo var(--emt, 1.4s) ease-out forwards;
  }
  .emo svg { display: block; width: calc(var(--ph) * .17); height: auto; overflow: visible; filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, .35)); }
  .emo-drop { left: calc(var(--ph) * -.2); bottom: calc(var(--ph) * -.1); }
  .emo-drop svg { width: calc(var(--ph) * .09); }
  .emo-grump svg { width: calc(var(--ph) * .22); }
  @keyframes emo {
    0% { transform: translate(-50%, 0) scale(.2); opacity: 0; }
    15% { transform: translate(-50%, -30%) scale(1.15); opacity: 1; }
    25% { transform: translate(-50%, -25%) scale(1); }
    80% { opacity: 1; }
    100% { transform: translate(-50%, -45%) scale(1); opacity: 0; }
  }
  .emo-drop { animation-name: emodrop; }
  @keyframes emodrop { 0% { transform: translateY(-20%) scale(.3); opacity: 0; } 20% { transform: none; opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(60%); opacity: 0; } }
  /* Traumblase: etwas bläulicher als die Denkblase */
  .think.dream, .think.dream::before, .think.dream::after { background: #e9ecff; }
  /* Nieser, Pollen */
  .snz, .pol { position: absolute; border-radius: 50%; pointer-events: none; }
  .snz { width: calc(var(--ph) * .035); height: calc(var(--ph) * .035); background: rgba(255, 255, 255, .9); animation: snz .55s ease-out forwards; }
  @keyframes snz { from { transform: scale(.4); opacity: 1; } to { transform: translate(var(--px), var(--py)) scale(1); opacity: 0; } }
  .pol { width: calc(var(--ph) * .025); height: calc(var(--ph) * .025); background: #ffe066; box-shadow: 0 0 3px #fff3a6; animation: pol 1.6s ease-in-out forwards; }
  @keyframes pol { 0% { opacity: 0; } 25%, 70% { opacity: 1; } 100% { transform: translate(var(--px), var(--py)); opacity: 0; } }
  /* Schmetterling (fliegt per Web Animations, die Flügel schlagen per CSS) */
  .bfly { position: absolute; left: 0; top: 0; width: calc(var(--ph) * .14); margin: calc(var(--ph) * -.1) 0 0 calc(var(--ph) * -.07); pointer-events: none; }
  .bfly svg { display: block; width: 100%; height: auto; overflow: visible; }
  .bfly .bwl, .bfly .bwr { transform-box: view-box; transform-origin: 10px 8px; animation: bfw .15s ease-in-out infinite alternate; }
  .bfly.rest .bwl, .bfly.rest .bwr { animation-duration: 1.3s; }
  @keyframes bfw { to { transform: scaleX(.2); } }
  /* Geschenk: eine Blüte mit großer Schleife ganz vorn im Gras, antippen nimmt sie an. Damit sie neben den Wiesenblumen
     auffällt: warmer Lichthof, der pulsiert, drei Funken und ab und zu ein Wackeln. Nachts weniger gedimmt als die Wiese. */
  .pgift {
    position: absolute; width: calc(var(--ph) * .68); margin-left: calc(var(--ph) * -.34); pointer-events: auto; cursor: pointer;
    transform-origin: 50% 100%; animation: giftin .5s ease-out; isolation: isolate;
  }
  .pgift::before {
    content: ''; position: absolute; left: -30%; right: -30%; top: -55%; bottom: -35%; z-index: -1; border-radius: 50%;
    background: radial-gradient(closest-side, #fffbe0, rgba(255, 212, 84, .85) 40%, rgba(255, 170, 60, .35) 70%, rgba(255, 170, 60, 0));
    animation: pglow 2.2s ease-in-out infinite;
  }
  .pgift svg {
    display: block; width: 100%; height: auto; overflow: visible; transform-origin: 50% 90%;
    filter: drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 1px 2px rgba(0, 0, 0, .35));
    animation: pwig 4.5s ease-in-out 1s infinite;
  }
  .pspk {
    position: absolute; width: 22%; aspect-ratio: 1; pointer-events: none; background: #ffd23a;
    clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
    animation: pspk 1.8s ease-in-out infinite;
  }
  .pspk:nth-of-type(1) { left: -6%; top: -45%; }
  .pspk:nth-of-type(2) { left: 70%; top: -70%; width: 16%; animation-delay: .6s; }
  .pspk:nth-of-type(3) { left: 92%; top: 10%; width: 13%; animation-delay: 1.2s; }
  .pgift.take { animation: gifttake .9s ease-in forwards; pointer-events: none; }
  .pgift.take::before, .pgift.take .pspk, .pgift.wilt::before, .pgift.wilt .pspk { display: none; }
  .pgift.wilt { transition: opacity 4s; opacity: 0; pointer-events: none; }
  .night .pgift svg { filter: brightness(.8) saturate(.8) drop-shadow(0 0 1.5px rgba(255, 246, 196, .8)); }
  .night .pgift::before { opacity: .6; }
  @keyframes giftin { from { transform: translateY(-50%) rotate(-25deg); opacity: 0; } }
  @keyframes gifttake { 30% { transform: translateY(-20%) scale(1.15); } to { transform: translateY(-160%) scale(1.3) rotate(12deg); opacity: 0; } }
  @keyframes pglow { 50% { transform: scale(1.12); opacity: .7; } }
  @keyframes pwig { 0%, 76%, 100% { transform: none; } 80% { transform: rotate(-7deg) scale(1.06); } 85% { transform: rotate(6deg) scale(1.06); } 90% { transform: rotate(-3deg); } }
  @keyframes pspk { 0%, 100% { transform: scale(.2) rotate(0); opacity: 0; } 50% { transform: scale(1) rotate(45deg); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .pgift::before, .pgift svg { animation: none; }
    .pspk { animation: none; transform: scale(.7); }
  }

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
  /* Sprechblase: --bx (px, aus _bubbleFit) schiebt sie am Kartenrand ins Bild, die Spitze bleibt am Anker. Ist der
     Text länger, als die Karte breit ist, bricht er um. --bf: Anteil der Blase links vom Anker. */
  .bubble {
    position: absolute; left: 0; bottom: 4px; --bf: 35%;
    transform: translateX(calc(var(--bx, 0px) - var(--bf))) scale(.3); transform-origin: calc(var(--bf) - var(--bx, 0px)) 100%;
    opacity: 0; transition: transform .28s cubic-bezier(.3, 1.6, .5, 1), opacity .2s;
    background: #fff; color: #4a3a2c; border-radius: 999px; padding: .15em .6em;
    width: max-content; max-width: calc(var(--W, 300px) - 8px); box-sizing: border-box; text-align: center;
    font-size: calc(var(--ph) * .15); font-weight: 800; box-shadow: 0 2px 6px rgba(0, 0, 0, .18); pointer-events: none;
  }
  .bubble.on { opacity: 1; transform: translateX(calc(var(--bx, 0px) - var(--bf))) scale(1); }
  .say::after {
    content: ''; position: absolute; left: clamp(6px, calc(30% - var(--bx, 0px)), calc(100% - 16px)); bottom: -5px;
    border: 5px solid transparent; border-top-color: #fff; border-bottom: 0;
  }
  .think { padding: .3em .45em; bottom: 14px; }
  .think svg { display: block; width: calc(var(--ph) * .2); height: calc(var(--ph) * .2); }
  .think::before, .think::after { content: ''; position: absolute; background: #fff; border-radius: 50%; }
  .think::before { width: 8px; height: 8px; left: clamp(2px, calc(28% - var(--bx, 0px)), calc(100% - 10px)); bottom: -8px; }
  .think::after { width: 4px; height: 4px; left: clamp(2px, calc(22% - var(--bx, 0px)), calc(100% - 6px)); bottom: -14px; }
  /* Im Bau steht die Blase rechts neben dem Eingang (Anker --ax), damit das Schild darüber frei bleibt */
  .inside .bubble { --bf: 6%; }
  .inside .say::after { left: clamp(6px, calc(6% - var(--bx, 0px)), calc(100% - 16px)); }
  .inside .think::before { left: clamp(2px, calc(8% - var(--bx, 0px)), calc(100% - 10px)); }
  .inside .think::after { left: clamp(2px, calc(2% - var(--bx, 0px)), calc(100% - 6px)); }

  .fx { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
  /* Ansagen für Bildschirmleser (nur Begrüßung, Wiedersehen, Geschenk, Hunger) */
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .pika:focus { outline: none; }
  .pika:focus-visible { outline: 2px dashed rgba(255, 255, 255, .9); outline-offset: -2px; border-radius: 14px; }
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

  /* Futter- und Päckchen-Knopf oben rechts nebeneinander (unten rechts verdeckten sie Pika, Pino und Wiese). Ist die
     Karte so schmal, dass sie an die Statusleiste stoßen, stehen sie untereinander (.btncol). */
  .feed {
    position: absolute; right: 8px; top: 6px; z-index: 5; width: 36px; height: 36px; padding: 5px;
    border: none; border-radius: 50%; cursor: pointer; background: rgba(255, 255, 255, .75);
    box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s;
  }
  .feed:active { transform: scale(.88); }
  .feed svg { display: block; width: 100%; height: 100%; }
  .night .feed { background: rgba(15, 22, 45, .55); }
  .feed.no { animation: no .4s; }
  .btncol .gbtn { right: 8px; top: 48px; }
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
  .mouse { position: absolute; left: 0; top: 0; width: 0; height: 0; --mw: calc(var(--H) * .15); }
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
  /* Regen-Besucher Frosch und Schnecke: kommen hinter dem Stein hervor wie die Maus, translate setzt das Skript */
  .frog, .snail { position: absolute; left: 0; top: 0; width: 0; height: 0; --cw: calc(var(--H) * .13); }
  .snail { --cw: calc(var(--H) * .12); }
  .cw {
    position: absolute; left: calc(var(--cw) * -.5 - 8px); bottom: -6px; width: var(--cw); padding: 10px 8px 6px;
    pointer-events: auto; cursor: pointer;
  }
  .cf, .cb { transform-origin: 50% 100%; }
  .frog.left .cf, .snail.left .cf { transform: scaleX(-1); }
  .cw svg { display: block; width: 100%; height: auto; overflow: visible; transform-origin: 50% 100%; }
  .fxl, .frog.leap .fhl { display: none; }
  .frog.leap .fxl { display: inline; }
  /* Ein Satz (.leap, nicht .hop: das ist eine Ebene des Pikas): --hd Dauer, --fh Höhe (in Froschhöhen); die Strecke läuft als transition am .frog */
  .frog.leap .cb { animation: fhop var(--hd, .4s) both; }
  @keyframes fhop {
    0% { transform: scale(1.1, .86); animation-timing-function: cubic-bezier(.2, .6, .5, 1); }
    50% { transform: translateY(var(--fh, -100%)) rotate(-9deg) scale(.94, 1.08); animation-timing-function: cubic-bezier(.5, 0, .8, .4); }
    100% { transform: rotate(7deg) scale(1.06, .92); }
  }
  .fsac { transform-box: fill-box; transform-origin: 40% 15%; transform: scale(0); }
  .frog.croak .fsac { animation: fsac .9s ease-in-out; }
  @keyframes fsac {
    18%, 42% { transform: scale(1); } 30% { transform: scale(.7); }
    58%, 82% { transform: scale(1.08); } 70% { transform: scale(.75); } 100% { transform: scale(0); }
  }
  .frog.croak svg { animation: fpuff .9s ease-in-out; }
  @keyframes fpuff { 18%, 58% { transform: scale(1.04, .96); } 42%, 82% { transform: scale(.98, 1.03); } }
  .flid { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: fblink 4.6s infinite; }
  @keyframes fblink { 0%, 93%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }
  .ftng { transform-box: fill-box; transform-origin: 0 100%; transform: scale(0); }
  .frog.zap .ftng { animation: fzap .38s ease-out; }
  @keyframes fzap { 40%, 55% { transform: scale(1); } 100% { transform: scale(0); } }
  .sbody { transform-box: view-box; transform-origin: 13px 19px; transition: transform .9s ease-out; }
  .sshell { transform-box: view-box; transform-origin: 12.6px 18px; transition: transform .3s; }
  .sfeel { transform-box: view-box; transform-origin: 26px 10.5px; }
  .snail.crawl .sbody { animation: scrawl 1.4s ease-in-out infinite; }
  @keyframes scrawl { 50% { transform: scaleX(1.07); } }
  .snail.crawl .sshell { animation: sbob 1.4s ease-in-out infinite; }
  @keyframes sbob { 50% { transform: translateX(.5px) rotate(2deg); } }
  .snail.crawl .sfeel { animation: sfeel 1.9s ease-in-out infinite alternate; }
  @keyframes sfeel { from { transform: rotate(-5deg); } to { transform: rotate(6deg); } }
  .snail.peer .sfeel { animation: speer 2.6s ease-in-out infinite alternate; }
  @keyframes speer {
    from { transform: rotate(-12deg) scaleY(1.2); } 50% { transform: rotate(4deg) scaleY(1.3); } to { transform: rotate(12deg) scaleY(1.15); }
  }
  .snail.hide .sbody { transform: scale(.3, .45); transition: transform .22s ease-in; }
  .snail.hide .sshell { transform: translateY(1.6px) rotate(-6deg); }
  .snail.hide.wob .sshell { animation: swob .5s ease-in-out; }
  @keyframes swob {
    0%, 100% { transform: translateY(1.6px) rotate(-6deg); } 30% { transform: translateY(1.6px) rotate(-14deg); }
    65% { transform: translateY(1.6px) rotate(2deg); }
  }
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
  /* Übergänge 5 s = PLANE_STEP; Randausblendung (--pa) auf .pl-f, damit sie mitgleitet statt zu springen */
  .plane { position: absolute; left: 0; top: 0; opacity: 0; transition: transform 5s linear, opacity 2s; will-change: transform; }
  .plane.on { opacity: 1; }
  /* Unsichtbare Tippfläche über dem Flugzeug (die Flugzeuge selbst liegen hinter den Hügeln) */
  .phit { position: absolute; left: 0; top: 0; display: none; pointer-events: auto; cursor: pointer; touch-action: pan-y; transition: transform 5s linear; }
  .phit.on { display: block; }
  .plane .pl-s {
    position: absolute; width: calc(var(--H) * .3); left: calc(var(--H) * -.15); top: calc(var(--H) * -.06);
    transition: transform 5s linear, opacity 3s;
  }
  .plane .pl-f { position: relative; opacity: var(--pa, 1); transition: transform 1.2s ease-in-out, opacity 5s linear; }
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
    pointer-events: none; cursor: pointer; opacity: 0; transition: transform 5s linear, opacity .3s, background 2.5s, color 2.5s;
  }
  .ptag.on.open { opacity: 1; pointer-events: auto; z-index: 1; }
  .ptag b { font-weight: 700; letter-spacing: .02em; }
  .ptag .more { font-size: .9em; opacity: .85; overflow: hidden; text-overflow: ellipsis; }
  .dusk .ptag { background: rgba(255, 255, 255, .72); }
  .night .ptag { color: #e4e9f6; background: rgba(22, 32, 62, .72); }

  /* ---- Sparen ---- */
  /* Niemand sieht hin (Tab versteckt, Karte aus dem Bild): alle Animationen anhalten, sie laufen danach weiter */
  .scene.paused, .scene.paused * { animation-play-state: paused !important; }
  /* Nachts ohne Wind stehen die Blumen still (die Ebene ist dann gefiltert, jedes Schaukeln kostete ein Neufiltern);
     eine nachwachsende wächst trotzdem fertig */
  .scene.night:not(.windy) .flower { animation-play-state: paused; }
  .scene.night:not(.windy) .flower.grow { animation-play-state: running, paused; }
  .scene.night:not(.windy) .flower.picked { animation-play-state: running; }
  /* Weniger Bewegung gewünscht (Systemeinstellung): Wolken, Sterne, Blumen, Rauch, Niederschlag und Blinklichter ruhen */
  @media (prefers-reduced-motion: reduce) {
    .stars b, .flower, .smoke circle, .precip .pl, .precip .pw, .fog i, .lt.flk, .br, .brolly,
    .plane .bcn, .plane .strobe, .fbl, .flm, .fflk, .lsw, .hb-i, .hb-tw, .hb-heat > g, .hb-steam > g {
      animation: none !important;
    }
    /* Wolken stehen still, bleiben aber am Himmel: Ohne Animation lägen alle links außerhalb des Bildes (sie kommen
       nur über drift herein), angehalten stehen sie dank des negativen Versatzes --dl verteilt */
    .cloud { animation-play-state: paused !important; }
    .precip { opacity: .6; }
    /* Blitz: nur ein sanftes, einmaliges Aufhellen statt Flackern über die ganze Karte */
    .flash.go { animation: flash-soft 1.2s ease-out; }
    @keyframes flash-soft { 15% { opacity: .18; } }
  }
  `;

  // ---------- Karte ----------

  class PikaPetCard extends HTMLElement {
    // Karten-Editor (HA-Formular): die häufigen Optionen mit Auswahlfeldern, Geräte, Kaffee und Geburtstage als YAML-Felder.
    // Ältere HA-Versionen ohne getConfigForm zeigen einfach weiter den YAML-Editor.
    static getConfigForm() {
      const ent = (domain) => ({ entity: { filter: { domain } } });
      const num = (min, max, step = 1, unit) => ({ number: { min, max, step, mode: 'box', ...(unit ? { unit_of_measurement: unit } : {}) } });
      const bool = { boolean: {} };
      const text = { text: {} };
      const group = (title, icon, schema) => ({ type: 'expandable', name: '', flatten: true, title, icon, schema });
      return {
        schema: [
          { type: 'grid', name: '', schema: [
            { name: 'name', selector: text },
            { name: 'areal', default: 'huegel', selector: { select: { mode: 'dropdown', options: [
              { value: 'huegel', label: 'Erdhügel' }, { value: 'fels', label: 'Felsen' },
              { value: 'stumpf', label: 'Baumstumpf' }, { value: 'alpin', label: 'Alpin' },
            ] } } },
          ] },
          { name: 'entity', selector: ent('input_text') },
          { name: 'plan_entity', selector: ent('input_text') },
          { type: 'grid', name: '', schema: [
            { name: 'show_stats', selector: bool, default: true },
            { name: 'gifts', selector: bool, default: true },
            { name: 'friend', selector: bool, default: true },
            { name: 'festive', selector: bool, default: true },
            { name: 'diary', selector: bool, default: true },
            { name: 'diary_house', selector: bool, default: true },
          ] },
          group('Schlaf, Wetter und Himmel', 'mdi:weather-night', [
            { type: 'grid', name: '', schema: [
              { name: 'sleep_start', selector: text },
              { name: 'sleep_end', selector: text },
            ] },
            { name: 'sun_entity', selector: ent('sun') },
            { name: 'weather_entity', selector: ent('weather') },
            { type: 'grid', name: '', schema: [
              { name: 'precip_entity', selector: ent('sensor') },
              { name: 'rain_min', selector: num(0, 5, 0.1, 'mm/h') },
            ] },
            { type: 'grid', name: '', schema: [
              { name: 'shooting_stars', selector: bool, default: true },
              { name: 'fireflies', selector: bool, default: true },
            ] },
          ]),
          group('Flugzeuge', 'mdi:airplane', [
            { name: 'flight_entity', selector: ent('sensor') },
            { type: 'grid', name: '', schema: [
              { name: 'flight_radius', selector: num(1, 200, 1, 'km') },
              { name: 'max_flights', selector: num(0, 6) },
            ] },
          ]),
          group('Pino, Tablet und Größe', 'mdi:tablet', [
            { name: 'friend_name', selector: text },
            { name: 'screen_entity', selector: ent(['switch', 'light', 'input_boolean', 'binary_sensor']) },
            { name: 'height', selector: num(120, 800, 10, 'px') },
          ]),
          group('Geburtstage, Haushaltsgeräte, Kaffee (YAML)', 'mdi:code-braces', [
            { name: 'birthdays', selector: { object: {} } },
            { name: 'appliances', selector: { object: {} } },
            { name: 'coffee', selector: { object: {} } },
          ]),
        ],
        computeLabel: (s) => EDITOR_LABEL[s.name],
        computeHelper: (s) => EDITOR_HELP[s.name],
      };
    }

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
      this._critId = 0; // Besucher (Vögelchen, Maus, Frosch, Schnecke): Lauf-Nummer zum Abbrechen
      this._critT = [];
      this._bird = this._mouse = this._frog = this._snail = null;
      this._planes = new Map(); // Flug-ID → Flugzeug am Himmel
      this._planeT = null;
      this._sent = [];
    }

    setConfig(config) {
      const cfg = { ...DEFAULTS, ...(config || {}) };
      // Grobe Fehler gleich als Fehlerkarte zeigen statt still falsch zu speichern
      for (const k of ['entity', 'plan_entity']) {
        if (cfg[k] && !/^input_text\.\w+$/.test(cfg[k])) throw new Error(`pika-pet-card: ${k} muss ein input_text-Helfer sein (ist "${cfg[k]}")`);
      }
      if (cfg.entity && cfg.entity === cfg.plan_entity) throw new Error('pika-pet-card: entity und plan_entity brauchen zwei verschiedene Helfer');
      if (cfg.areal && !AREALE[cfg.areal]) console.warn(`pika-pet-card: areal "${cfg.areal}" gibt es nicht (${Object.keys(AREALE).join(', ')}), nehme huegel`);
      this._lsRename(this._cfg?.name, cfg.name);
      this._cfg = cfg;
      if (!this._el) this._build();
      this._applyAreal();
      this._el.name.textContent = this._cfg.name;
      this._el.stats.hidden = !this._cfg.show_stats;
      this._diarySync();
      if (this._W) this._btnFit();
      this._el.scene.style.minHeight = `${Number(this._cfg.height) || DEFAULTS.height}px`;
      // Prototyp Tiefe an/aus: ausgeschaltet zurück auf die vordere Spur, Kulisse in die Mitte
      this._el.scene.classList.toggle('tiefe', !!this._cfg.depth);
      if (!this._cfg.depth) {
        this._el.scene.style.removeProperty('--plx');
        if (this._lane) {
          this._lane = 0;
          if (this._g) this._setX(this._x, true);
        }
      } else if (this._W) this._el.scene.style.setProperty('--plx', clamp(this._x / this._W * 2 - 1, -1, 1).toFixed(3));
      // Zustand nur beim ersten Mal und bei anderem Helfer neu laden: Der Editor ruft setConfig bei jeder
      // Änderung, ein noch nicht gespeicherter Stand (1,2 s Wartezeit beim Speichern) ginge sonst verloren
      const ent = this._cfg.entity || '';
      if (ent !== this._entKey) {
        this._entKey = ent;
        clearTimeout(this._saveT);
        clearTimeout(this._freshT);
        clearTimeout(this._unavT);
        this._pendingWrite = this._synced = this._noEntity = this._saveWait = false;
        this._lostW = [];
        this._saveFail = 0;
        this._gain = { s: 0, g: 0, c: false };
        this._sent = []; // gesendet, von HA noch nicht bestätigt: { v, gain, at }
        this._lastEntityState = null; // beim nächsten hass neu lesen, auch wenn der Helfer fehlt
        this._stats = null;
        if (!ent) this._loadLocal();
      }
      const pk = `${this._cfg.plan_entity || ''}|${this._cfg.name}`;
      if (pk !== this._planKey) {
        this._planKey = pk;
        this._planReset();
      }
      this._renderStats();
      if (this.isConnected) this._attach();
    }

    set hass(hass) {
      const fresh = hass !== this._hass;
      this._hass = hass;
      const c = this._cfg;
      this._clockHass(hass);
      if (fresh && hass.connected !== false) this._hassN = (this._hassN || 0) + 1;
      if (c.entity) {
        const st = hass.states[c.entity]?.state;
        // Ungesendetes, weil die Verbindung weg war: jetzt hinaus
        if (this._saveWait && hass.connected !== false && st !== 'unavailable') this._save();
        if (st !== this._lastEntityState) {
          this._lastEntityState = st;
          const parsed = parseStats(st);
          clearTimeout(this._freshT);
          clearTimeout(this._unavT);
          // Helfer gibt es nicht: auf diesem Gerät weiterspielen (localStorage) statt ins Leere zu schreiben
          if (st === undefined && !this._noEntity) {
            console.warn(`pika-pet-card: ${c.entity} gibt es nicht, der Zustand bleibt auf diesem Gerät`);
            if (!this._stats) this._loadLocal();
          }
          this._noEntity = st === undefined;
          // Beim Laden länger als 60 s unavailable: wie ein fehlender Helfer lokal weiterspielen statt gar nicht zu
          // speichern. Kommt er wieder, kommen die Gewinne von hier auf seinen Stand (siehe _save).
          if (st === 'unavailable' && !this._synced) {
            this._unavT = setTimeout(() => {
              if (this._lastEntityState !== 'unavailable' || this._synced) return;
              console.warn(`pika-pet-card: ${c.entity} ist nicht erreichbar, der Zustand bleibt vorerst auf diesem Gerät`);
              this._noEntity = true;
              if (!this._stats) this._loadLocal();
              this._renderStats();
            }, 60000);
          }
          const own = parsed ? this._sent.findIndex((e) => e.v === st) : -1;
          const late = own < 0 && parsed ? this._lostW?.find((e) => e.v === st) : null;
          if (own >= 0) {
            // Echo eines eigenen Schreibens: bestätigt (ältere auch, HA arbeitet der Reihe nach). Der eigene Stand
            // ist schon so weit oder weiter, nichts übernehmen.
            this._sent.splice(0, own + 1);
            this._lostW = this._lostW?.filter((e) => e.v !== st);
            this._saveFail = 0;
          } else if (late) {
            // Spätes Echo eines Schreibens, das schon als verloren galt: Es ist doch angekommen und gilt als eigenes.
            // Sein Gewinn liegt inzwischen wieder im Ungesendeten bzw. im neuen Schreiben: dort heraus, sonst käme er
            // beim nächsten fremden Stand ein zweites Mal obendrauf.
            this._lostW = this._lostW.filter((e) => e !== late);
            this._gainSub(late.gain);
            this._saveFail = 0;
          } else if (parsed) {
            this._synced = true;
            // Den eigenen, jetzt veralteten Stand hier nicht mehr bewerten: Wer gepflegt hat, hat das vor seiner Änderung
            // selbst getan (_add, _cleanPile) und schon entwarnt. Eine Warnung von hier käme danach und bliebe stehen,
            // die Serie risse trotz Füttern.
            const gain = this._sentGain();
            if (this._stats && (this._pendingWrite || gain.s || gain.g || gain.c)) {
              // Eigene Änderung ungesendet oder noch unbestätigt: zusammenführen statt den fremden Stand zu
              // übernehmen. Der fremde kam bei HA vor dem eigenen an, ihm fehlt also alles, was hier noch offen ist.
              this._stats = mergeStats(this._stats, parsed, gain, this._haNow(), (a, b) => this._decayH(a, b));
              this._sent.forEach((e) => (e.gain = { s: 0, g: 0, c: false })); // steckt jetzt im nächsten Schreiben
              this._gain = gain;
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
              this._stats ??= freshStats(this._haNow());
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
      const pr = c.precip_entity ? hass.states[c.precip_entity] : undefined;
      if (w !== this._lastWeather || pr !== this._lastPrecip) {
        this._lastWeather = w;
        this._lastPrecip = pr;
        this._readWeather(w, pr);
      }
      const fl = c.flight_entity ? hass.states[c.flight_entity] : undefined;
      if (fl !== this._lastFlights) {
        this._lastFlights = fl;
        this._readFlights(fl);
      }
      // Ein Fehler in einer Erweiterung (unerwartete Daten) soll die anderen nicht mitreißen
      for (const f of [this._hassSky, this._hassFest, this._hassFriend, this._hassBote, this._hassCoffee, this._hassPlan, this._hassAct]) {
        try {
          f.call(this, hass);
        } catch (e) {
          if (!this._hassErr?.has(f.name)) {
            (this._hassErr ??= new Set()).add(f.name);
            console.warn(`pika-pet-card: ${f.name}`, e);
          }
        }
      }
      this._updateSky();
      // Veralteter Plan nach langer Pause: erst frisch, wenn verbunden und sich seitdem etwas geändert hat (ein neues
      // hass-Objekt allein kann nur "verbunden: ja/nein" sein, mit noch altem Stand)
      if (fresh && this._planStale && hass.connected !== false && hass.states !== this._staleStates) this._planFresh();
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
      this._onVis = () => this._visSync();
      document.addEventListener('visibilitychange', this._onVis);
      // Karte aus dem Bild gescrollt (Handy, iPad): wie ein versteckter Tab alles anhalten
      this._offscreen = false;
      this._away0 = this._away();
      // Beim Wegsehen angehaltene Effekte (Seifenblasen …) laufen weiter, auch wenn dazwischen abgehängt wurde
      if (!this._away0) this._fxAnims(false);
      this._el.scene.classList.toggle('paused', this._away0);
      this._io = new IntersectionObserver((es) => {
        this._offscreen = !es[es.length - 1].isIntersecting;
        this._visSync();
      });
      this._io.observe(this._el.scene);
      this._loop(() => this._blink(), 2200, 6000);
      this._loop(() => this._twitch(), 5000, 13000);
      this._loop(() => this._noseWiggle(), 4000, 10000);
      this._loop(() => this._lightning(), 6000, 16000);
      this._timers.push(setInterval(() => this._tick(), 20000));
      this._timers.push(setInterval(() => this._regrow(), 150000));
      this._layout();
      this._showReq();
      this._start();
      this._startCritters();
      this._readFlights(this._lastFlights); // Flieger, die während der Trennung gemeldet wurden
      this._planeLoop();
      this._attachSky();
      this._attachFest();
      this._attachFriend();
      this._attachBote();
      this._attachGift();
    }

    _detach() {
      if (!this._attached) return;
      this._attached = false;
      this._stop();
      this._stopCritters();
      this._ro?.disconnect();
      this._io?.disconnect();
      clearTimeout(this._staleT);
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
      this._detachGift();
      this._diaryClose();
    }

    // ---------- Aufbau ----------

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
        <style>${STYLE}${STYLE_SKY}${STYLE_FEST}${STYLE_FRIEND}${STYLE_BOTE}${STYLE_COFFEE}${STYLE_ACT}${STYLE_GIFT}${STYLE_DIARY_BTN}</style>
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
            <div class="mice-f"></div>
            <div class="props"></div>
            <div class="friends"></div>
            <div class="ff">${flies}</div>
            <div class="acts"></div>
            <div class="pika" role="button" tabindex="0" aria-label="Streicheln">
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
        birds: $('.birds'), mice: $('.mice'), miceF: $('.mice-f'), planes: $('.planes'), ptags: $('.ptags'),
        tvl: $('.tvl'), kites: $('.kites'), bflip: $('.bflip'),
        stS: $('.st-s'), stG: $('.st-g'), barC: $('.bar-c'), stC: $('.st-c'), poops: $('.poops'), feed: $('.feed'), say: $('.say'), think: $('.think'),
        sun: $('.sun'), moon: $('.moon'), moonLit: $('.moon-lit'), clouds: [...this.shadowRoot.querySelectorAll('.cloud')],
        precip: $('.precip'), flash: $('.flash'),
        burrow: $('.burrow'), lights: $('.lights'), clipw: $('.clipw'), depth: $('.depth'), rock: $('.lookout'),
        meteors: $('.meteors'), ff: $('.ff'), festB: $('.fest-b'), festF: $('.fest-f'), props: $('.props'), friends: $('.friends'),
        acts: $('.acts'), gifts: $('.gifts'), gbtn: $('.gbtn'), tbbtn: $('.tbbtn'),
      };
      this._el.anchor = this._el.pika.querySelector('.anchor');
      this._el.sr = this.shadowRoot.querySelector('.sr');
      // Tastatur: Enter oder Leertaste streichelt (ohne Stelle: Rücken)
      this._el.pika.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        this._onPet(null);
      });
      this._el.pika.addEventListener('click', (e) => (e.stopPropagation(), this._onPet(e)));
      // Lang drücken = kraulen, waagerecht über ihn wischen = übers Fell streichen
      this._el.pika.addEventListener('pointerdown', (e) => this._pressStart(e));
      this._el.pika.addEventListener('pointermove', (e) => this._pressMove(e));
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) this._el.pika.addEventListener(t, (e) => this._pressEnd(e));
      // Lang drücken auf Touch (z. B. Windows-Tablet) öffnete sonst das Kontextmenü des Browsers
      this._el.pika.addEventListener('contextmenu', (e) => e.preventDefault());
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
        this._diaryOpen();
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
        this._el.clipw.style.clipPath = '';
        this._layout();
        this._restartCritters();
      }
    }

    // Futter- und Päckchen-Knopf oben rechts nebeneinander (Päckchen-Knopf links, 36 px, 8 px Abstand). Stoßen sie an
    // die Statusleiste (schmale Karte, langer Name), stehen sie untereinander.
    _btnFit() {
      const { scene, stats, tbbtn } = this._el;
      const left = stats.hidden ? tbbtn : stats;
      const sR = left.hidden ? 0 : left.offsetLeft + left.offsetWidth;
      scene.classList.toggle('btncol', sR + 8 > scene.clientWidth - 88);
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
      this._btnFit();
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
        this._onHam = false; // aus der Hängematte auf den Stein: von dort hüpft er herunter
        this._lift = rock.lift;
        this._setX(rock.cx, true);
      } else {
        this._setX(clamp((liveX ?? this._x) * ratio, pW * 0.45, this._g.xR), true);
        // Mitten im Laufen angehalten: Aktion neu wählen, sonst hoppelt er bis zum Ende auf der Stelle
        if (liveX != null) this._interrupt();
      }
      // Fähnchen neu messen (Schriftgröße hängt an --H)
      for (const p of this._planes.values()) p.tw = 0;
      this._layoutSky(first);
      this._layoutFest(first);
      this._layoutFriend(first);
      this._layoutBote(first);
      this._layoutGift(first);
      if (!first) {
        this._planeSnap();
        this._placePiles();
        // Besucher sitzen an festen Pixeln: bei Größenänderung lieber neu kommen lassen
        if (CRIT_KINDS.some((k) => this['_' + k])) this._restartCritters();
        // Staffelei und Drache stehen an festen Pixeln: abbrechen (räumt sie weg), er steigt gleich wieder ein
        if (this._easelEl || this._kiteEl) this._interrupt();
        if (this._giftEl) this._flowerGiftPlace(this._giftEl); // Blumengeschenk an seiner relativen Stelle
      } else {
        this._flowerFromPlan(); // lag schon eins (anderes Gerät, Neuladen)
        this._foodFromPlan();
      }
    }

    // Ohne Übergang einschlafen (im Bau) bzw. aufwachen (vor dem Bau)
    _sleepNow(on) {
      const p = this._el.pika;
      this._asleep = on;
      this._lift = 0;
      this._lane = 0;
      p.classList.toggle('sleeping', on);
      this._giftScene();
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

    // Sieht gerade niemand die Karte? Tab versteckt (beim Tablet auch: Bildschirm aus) oder außerhalb des Bildes
    // Schaut keiner hin? Tab im Hintergrund, aus dem Bild gescrollt oder (mit screen_entity) Bildschirm aus. Ein dunkler
    // Kiosk-Bildschirm lässt den Tab sichtbar: ohne screen_entity liefe dann alles die ganze Nacht weiter.
    _away() {
      return document.hidden || !!this._offscreen || this._screenSt === 'off';
    }

    // Sichtbarkeit hat sich geändert: unsichtbar ruht alles (Schleife, Besucher, Animationen), sichtbar geht es weiter
    _visSync() {
      const away = this._away();
      if (!this._attached || away === this._away0) return;
      this._away0 = away;
      this._el.scene.classList.toggle('paused', away);
      this._fxAnims(away);
      if (away) {
        this._hidAt = document.hidden || this._screenSt === 'off' ? Date.now() : null;
        this._goneAt ??= Date.now(); // für das Wiedersehen
        this._stop();
        this._stopCritters();
        this._hiddenFeatures(true);
        this._giftFromPlan(); // woanders schon ausgepackt: hier schaut jetzt keiner mehr zu, dann ist es weg
        return;
      }
      // Länger versteckt: Der Stand aus HA (Tagesplan, Wetter) ist wohl veraltet, die Verbindung baut sich gerade neu
      // auf. Beschäftigungen erst wählen, wenn ein frischer Stand da ist, sonst zeigte dieses Gerät eine andere.
      const long = !!this._hidAt && Date.now() - this._hidAt > 30000;
      if (long) this._planStaleArm();
      this._hidAt = null;
      // Über die Pause wurde es Schlafenszeit (Bildschirm abends aus, nachts an): Er liegt längst im Bett, statt jetzt erst
      // hinzulaufen. Das Aufwachen am Morgen spielt dagegen die Schleife (_wakeUp), danach begrüßt er (_showReq).
      if (long && this._g && !this._asleep && this._sleepTime()) {
        if (this._next === 'poop') this._next = null;
        this._revealPending();
        this._sleepNow(true);
        this._updateSky();
      }
      this._showReq();
      this._start();
      this._startCritters();
      this._hiddenFeatures(false);
      this._planeSnap();
      this._tick();
    }

    // .paused hält nur CSS-Animationen an: die Web Animations der Effekte (Seifenblasen, Schmetterling, Blütenwurf)
    // ebenso anhalten und beim Wiedersehen weiterlaufen lassen
    _fxAnims(stop) {
      if (stop) {
        const all = this._el.fx.getAnimations?.({ subtree: true }) || [];
        this._fxPaused = all.filter((a) => a.playState === 'running'
          && !(typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation)
          && !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition));
        this._fxPaused.forEach((a) => a.pause());
      } else {
        (this._fxPaused || []).forEach((a) => a.playState === 'paused' && a.play());
        this._fxPaused = null;
      }
    }

    _planStaleArm() {
      this._planStale = true;
      this._staleStates = this._hass?.states;
      clearTimeout(this._staleT);
      // Kommt kein neuer Stand (es hat sich nichts geändert), gilt der alte nach 4 s, sobald die Verbindung steht
      const check = () => {
        if (this._hass?.connected === false) this._staleT = setTimeout(check, 2000);
        else this._planFresh();
      };
      this._staleT = setTimeout(check, 4000);
    }

    _planFresh() {
      if (!this._planStale) return;
      this._planStale = false;
      clearTimeout(this._staleT);
      if (this._running && ACT_SMALL.includes(this._action) && this._slotNow()) this._interrupt();
    }

    _start() {
      if (this._running || !this.isConnected || this._away() || !this._g) return;
      this._running = true;
      this._loopAt = Date.now(); // frisch gestartet: in eine laufende Beschäftigung ohne Hinlaufen einsteigen
      this._slotArm();
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
      clearTimeout(this._slotT);
      this._slotT = null;
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
        'reading', 'doze', 'gaming', 'meh', 'lying', 'tablet', 'tplane', 'swipe', 'kiting', 'tv',
        'coffee', 'sip', 'hot', 'foam', 'lick', ...COFFEE_CLS, ...ACT_CLS, ...CUTE_CLS, ...GIFT_CLS);
      this._tvOn(false);
      this._kiteAway();
      this._easelAway();
      this._mouth(null);
      this._bubble(this._el.think, false);
      this._action = null;
    }

    async _step() {
      if (!this._g) return this._wait(500);
      // Eine Berührung von vor Kaffee, Schlafengehen oder Begrüßung ist vorbei: nicht Minuten später darauf reagieren
      if (TOUCH_NEXT.has(this._next) && Date.now() - (this._nextAt || 0) > TOUCH_TTL) this._next = null;
      // In der Hängematte unterbrochen: aus ihr heraus (nicht zum Stein). Am Boden (z. B. schon beim Anlauf
      // unterbrochen, _lift kommt erst mit dem Sprung) gilt der Merker nicht mehr.
      if (!(this._lift > 0)) this._onHam = false;
      if (this._lift > 0 && this._onHam) return this._run('giftHamDown');
      // Unterbrochen, während er auf dem Stein stand: erst herunter. Trinkt er dort oben Kaffee, trinkt er weiter.
      const cof = this._cof?.pend;
      if (this._lift > 0 && !(cof?.rock && cof.stage === 'drink' && this._coffeeDue())) return this._run('hopDown');
      // Frischer Kaffee: holt er sich sofort, der Duft weckt ihn sogar auf (danach schläft er weiter)
      if (this._coffeeDue()) return this._run(this._asleep ? 'wakeUp' : 'coffee');
      const sleepy = this._sleepTime();
      if (sleepy && !this._asleep) {
        // Wollte er gerade ein Häufchen machen: liegt es eben gleich da, sonst bliebe es bis morgen unsichtbar
        if (this._next === 'poop') this._next = null;
        this._revealPending();
        return this._run('goSleep');
      }
      if (!sleepy && this._asleep) return this._run('wakeUp');
      if (this._asleep) return this._run('dream');
      const food = this._foods.find((f) => f.landed);
      const next = this._next;
      this._slot = null;
      this._slotArm();
      const fu = next || food || this._inside ? null : this._friendUrgent();
      if (fu) return this._run(fu);
      // Beschäftigung aus dem Tagesplan: läuft gerade eine, macht er mit (Futter und Vorschau-Knöpfe gehen vor)
      const S = next || food ? null : this._slotNow();
      if (S) {
        if (this._greetDue) {
          this._greetDue = false;
          this._reunion = false;
          if (Date.now() - this._showAt < 30000) setTimeout(() => this._action === S.act && this._say(pick(ACT_GREET), 1500), 900);
        }
        return this._runSlot(S);
      }
      if (this._greetDue) {
        this._greetDue = false;
        if (Date.now() - this._showAt < 30000) return this._run('greet');
      }

      const wx = this._wx;
      const stayIn = next ? next === 'burrow' || next === 'tv' : wx.shelter && !food;
      if (this._inside && !stayIn) return this._run('comeOut');
      if (next) {
        this._next = null;
        this._forced = !TOUCH_NEXT.has(next); // Vorschau: auch ohne passendes Wetter
        return this._run(next);
      }
      this._forced = false;
      if (food) return this._run('eatFood', food);
      // Päckchen am Ballon: herunterschießen, dann auspacken (nach Futter und Beschäftigungen aus dem Plan)
      const gd = this._giftDue();
      if (gd) return this._run(gd);
      // Bei Starkregen und Gewitter im Bau bleiben und ab und zu herausschauen (fernsehen kommt aus dem Tagesplan)
      if (wx.shelter) return this._run(this._inside ? 'hideout' : 'shelter');

      const s = this._get('s');
      const g = this._get('g');
      const { piles, clean } = this._poops();
      this._el.pika.classList.toggle('sad', g < 25 || s < 15 || clean < 30);
      // satt und zufrieden: ruhiger atmen
      this._el.pika.classList.toggle('calm', s > 70 && g > 75 && clean > 60);
      // Unter Schnee gibt es keine Blumen, bei Regen bleibt das Heu trocken (kein Sammeln)
      const hasFlowers = this._flowers.length > 0 && !wx.snowcover;
      const elev = this._dbgElev ?? this._elev;
      // Zusatz-Aktionen der Erweiterungen (Himmel, Festtage, Freund, Haus-Bote) bekommen dieselbe Lage.
      // Beschäftigungen und das Sammeln für den Vorrat kommen nur aus dem Tagesplan (oben).
      const ctx = { s, g, wx, elev, piles, clean, hasFlowers };
      const act = weighted([
        [3, 'idle'],
        [3, 'look'],
        [3, 'wander'],
        [wx.wet ? 2 : 1, 'burrow'],
        [wx.wet ? 0.4 : 1.6, 'lookout'],
        [hasFlowers ? (s < 50 ? 3 : 1.2) : 0, 'nibble'],
        [wx.snowcover || wx.wet ? 1.2 : 0, 'haySnack'],
        [wx.wet ? 0 : 1.4, 'groom'], // eine Pfote hält bei Regen das Blatt
        [0.8, 'squeak'],
        [wx.wet || calmMotion() ? 0 : g > 70 ? 1.2 : g > 40 ? 0.4 : 0, 'binky'],
        [s < 30 ? 3 : 0, 'hungry'],
        [piles.length && clean < 60 ? 1.2 : 0, 'sniff'],
        [this._bird?.sitting ? 2.5 : 0, 'watchBird'],
        [this._mouse?.out ? 2.5 : 0, 'watchMouse'],
        [this._frog?.out ? 2.5 : 0, 'watchFrog'],
        [this._snail?.out && !this._snail.hidden ? 2.5 : 0, 'watchSnail'],
        [this._planeToWatch() ? 2.5 : 0, 'watchPlane'],
        ...this._cuteActs(ctx),
        ...this._skyActs(ctx),
        ...this._festActs(ctx),
        ...this._friendActs(ctx),
        ...this._boteActs(ctx),
        ...this._coffeeActs(ctx),
        ...this._giftActs(ctx),
      ]);
      return this._run(act);
    }

    _run(name, ...args) {
      this._action = name;
      return this['_' + name](...args);
    }

    // ---------- Aktionen ----------

    async _idle() {
      // Glücklich: mit zufriedenem ω-Mund dasitzen
      if (this._get('g') > 75 && Math.random() < 0.35) this._el.pika.classList.add('content');
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
      // Prototyp Tiefe: manchmal auf die hintere Spur, zwischen Heuhaufen (hinter ihm vorbei) und Stein,
      // der vor der Spur liegt und ihn sonst nicht verdecken könnte. _laneNext erzwingt die Spur (Vorschau).
      let lane = 0;
      if (this._cfg.depth) {
        const g = this._g;
        const l = g.stash ? g.fMin * this._W : g.hay;
        const r = g.rock.l - pW * 0.55;
        const want = this._laneNext ?? (this._wx.wet ? 0 : Math.random() < 0.4 ? 1 : 0);
        this._laneNext = null;
        if (want && r - l > pW * 0.3) {
          lane = 1;
          x = rnd(l, r);
        }
      }
      await this._walkTo(x, 1, false, lane);
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
      if (side > 0) return x > this._g.xR ? null : x;
      return Math.max(x, pW * 0.45);
    }

    async _hopTo(x, lift, crouch = true) {
      const { pW } = this._g;
      // wie beim Laufen im Bild bleiben (auf den Stein darf er immer ganz nach rechts)
      x = clamp(x, pW * 0.45, lift > 0 ? this._W - pW * 0.45 : this._g.xR);
      if (Math.abs(x - this._x) > 2) this._face(x > this._x ? 1 : -1);
      const p = this._el.pika;
      p.classList.remove('lnd'); // das Nachwippen der Landung verdeckte sonst den Anlauf
      if (crouch) {
        p.classList.add('crouch');
        await this._wait(180);
        p.classList.remove('crouch');
      }
      p.style.transition = 'transform .55s cubic-bezier(.3, .6, .4, 1)';
      this._lift = lift;
      this._lane = 0;
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

    // lookBack: in der Tür dreht er sich noch einmal um und schaut zurück (Schlafengehen)
    async _enterBurrow(speed = 1, lookBack = false) {
      await this._walkTo(this._g.home, speed);
      this._setX(this._g.home, true);
      this._inside = true;
      await this._to('door', 450);
      if (lookBack) {
        this._face(-this._dir);
        await this._wait(500);
        this._blink();
        await this._wait(700);
      }
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
      this._giftBell();
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
        this._bubbleRefit();
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
      this._bubbleRefit();
    }

    async _haySnack() {
      await this._walkTo(this._g.stand);
      this._face(-1);
      await this._wait(300);
      await this._eat('#dcbc6a', rnd(2500, 3500), HAY_BITE);
      this._selfFed(SELF.hay);
      await this._wait(rnd(300, 900));
    }

    async _nibble() {
      const f = this._nearestFlower();
      if (!f) return;
      await this._approach(f.xf * this._W);
      await this._sniffPick(f);
      await this._eat(f.color, rnd(2500, 4000));
      this._selfFed(SELF.flower);
      if (Math.random() < 0.4) this._cls('mlem', 950, true);
      await this._wait(rnd(300, 900));
    }

    // Eine Blüte für den Vorrat holen (kleine Beschäftigung aus dem Tagesplan). Die Farbe steht mit dem Fenster
    // fest, damit alle Geräte dieselbe Blüte in die Nische legen; hat dieses Gerät keine Blume der Farbe auf der
    // Wiese, nimmt er die nächste und sie bekommt die Farbe.
    async _gather() {
      const S = this._slotFor('gather');
      const pal = this._areal().flowers || FLOWER_COLORS;
      const ci = Math.floor(S.r(2) * pal.length);
      const color = pal[ci];
      if (this._inside) await this._comeOut();
      let f = this._flowers.filter((o) => o.color === color)
        .sort((a, b) => Math.abs(a.xf * this._W - this._x) - Math.abs(b.xf * this._W - this._x))[0];
      if (!f) {
        f = this._nearestFlower();
        if (f) {
          f.color = color;
          f.el.innerHTML = FLOWER_SVG(color);
        }
      }
      if (f) {
        await this._approach(f.xf * this._W);
        await this._sniffPick(f);
      }
      this._mouth(color);
      this._el.pika.classList.add('carry');
      await this._walkTo(this._g.stand);
      this._face(-1);
      await this._wait(350);
      // Blüte im Bogen auf den Haufen bzw. in die Nische werfen, dort bleibt sie liegen
      this._el.pika.classList.remove('carry');
      this._mouth(null);
      this._toss(color, this._haySpot(Math.min(this._blooms.length, HAY_MAX - 1)));
      await this._wait(460);
      this._planOp({ t: 'gather', m: S.k >= 0 ? S.k : null, c: String(ci) });
      await this._wait(900);
    }

    // Stelle i auf der Oberfläche des Heuhaufens (Koordinaten der Heu-Grafik, 60 × 40), fest je Platz
    _haySpot(i) {
      const sx = 15 + seedRnd('hay', i, 0) * 30;
      const top = 10 + ((sx - 30) / 28) ** 2 * 26;
      const lo = top + 3;
      return { sx: +sx.toFixed(1), sy: +(lo + seedRnd('hay', i, 1) * (Math.min(35, top + 11) - lo)).toFixed(1) };
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
      this._announce('hat Hunger');
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
      this._memo('bird');
      // Es zwitschert zurück: Kopf schief
      if (Math.random() < 0.6) {
        p.classList.add('tilt');
        if (Math.random() < 0.4) this._emote('q', 1400);
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
      if (Math.random() < 0.4) p.classList.add('tilt');
      await this._wait(rnd(900, 1600));
      if (m.out && Math.random() < 0.5) {
        p.classList.remove('look-f');
        await this._walkTo(m.x - this._dir * this._g.pW * rnd(0.7, 1.1), 0.6);
        p.classList.add('look-f');
      }
      if (Math.random() < 0.4) this._say(pick(['mip?', 'iiep?']), 1000);
      await this._wait(rnd(1000, 2200));
    }

    // Den Frosch anpiepsen: Er quakt zurück, der Pika zuckt zusammen
    async _watchFrog() {
      const f = this._frog;
      if (!f?.out) return;
      const p = this._el.pika;
      const there = () => this._frog === f && f.out;
      this._face(f.x >= this._x ? 1 : -1);
      p.classList.add('look-f');
      await this._wait(rnd(900, 1600));
      if (!there()) return;
      p.classList.add('calling');
      this._say(pick(['mip?', 'iiep?']), 900);
      await this._wait(650);
      p.classList.remove('calling');
      await this._wait(rnd(300, 700));
      if (there()) {
        this._croak(f);
        await this._wait(350);
        this._jump('hop1');
        this._say('!', 800);
        await this._wait(900);
        p.classList.add('tilt');
        if (Math.random() < 0.5) this._emote('q', 1400);
      }
      await this._wait(rnd(1000, 2000));
    }

    // Zur Schnecke hin und an ihr schnuppern: Sie zieht sich ins Haus zurück, er wartet, bis sie wieder herausschaut
    async _watchSnail() {
      const s = this._snail;
      if (!s?.out) return;
      const p = this._el.pika;
      const there = () => this._snail === s && s.out;
      this._face(s.x >= this._x ? 1 : -1);
      p.classList.add('look-f');
      if (Math.random() < 0.4) p.classList.add('tilt');
      await this._wait(rnd(900, 1500));
      if (!there() || Math.random() < 0.3) return this._wait(rnd(800, 1600));
      p.classList.remove('look-f', 'tilt');
      await this._approach(s.x, 0.6);
      if (!there()) return;
      p.classList.add('sniff');
      await this._wait(500);
      s.poke();
      await this._wait(rnd(500, 900));
      p.classList.remove('sniff');
      p.classList.add('tilt');
      this._emote('q', 1400);
      // warten, bis sie wieder herausschaut
      for (let i = 0; i < 14 && there() && s.hidden; i++) await this._wait(500);
      p.classList.remove('tilt');
      if (there() && !s.hidden) {
        await this._wait(700);
        this._twitch();
        this._say(pick(['oh!', 'mip!']), 1000);
      }
      await this._wait(rnd(900, 1600));
    }

    // Einem tief fliegenden Flugzeug nachschauen; ganz nah und laut erschrickt er kurz
    async _watchPlane() {
      const pl = this._planeToWatch();
      if (!pl) return;
      pl.watched = (pl.watched || 0) + 1;
      this._memo('plane');
      const p = this._el.pika;
      this._face(pl.x >= this._x ? 1 : -1);
      if (pl.slant < 3) {
        this._jump('hop1');
        this._say('!', 900);
        await this._wait(700);
      }
      p.classList.add('look-up');
      if (Math.random() < 0.4) p.classList.add('tilt-b');
      await this._wait(rnd(1500, 2500));
      // dreht sich mit, wenn es schon vorbei ist
      this._face(pl.x >= this._x ? 1 : -1);
      if (Math.random() < 0.55) this._say(pick(['brumm!', 'wuiii!', 'oh!', 'iiep!']), 1100);
      await this._wait(rnd(1500, 2800));
    }

    // ---------- Beschäftigungen ----------

    // Zeitplan, Einstieg und die Beschäftigungen von 0.15 stehen im Abschnitt "Aktivitäten". Alle Beschäftigungen
    // holen sich ihr Fenster mit _slotFor(name): { k, start, end, r(n) }. end ist das Ende des Hauptteils (Planzeit,
    // _planNow), r(n) sind feste Zahlen des Fensters, auf allen Geräten gleich.

    // Zum Platz der Beschäftigung: frisch gestartet (Neuladen, Seite wieder sichtbar) und schon spät dran steht er
    // gleich dort, sonst läuft er hin. Aus dem Bau kommt er vorher heraus.
    async _goSpot(S, x, speed = 0.8) {
      if (this._jumpIn(S)) {
        this._inside = false;
        this._lift = 0;
        this._pose('out', 0);
        this._setX(x, true);
        await this._wait(60);
        return;
      }
      if (this._inside) await this._comeOut();
      await this._walkTo(x, speed);
    }

    // Steigt er in ein schon laufendes Fenster ein, ohne dass man ihn vorher sah?
    _jumpIn(S) {
      return S.k >= 0 && this._planNow() - S.start > 6000 && Date.now() - (this._loopAt || 0) < 5000;
    }

    // Bis zur Planzeit t warten (gleich weiter, wenn sie vorbei ist)
    _at(t) {
      return this._wait(Math.max(0, t - this._planNow()));
    }

    // Höchstens ms warten, aber nicht über die Planzeit t hinaus
    _waitMax(ms, t) {
      return this._wait(clamp(t - this._planNow(), 0, ms));
    }

    // Platz auf der Wiese zwischen Heu und Stein aus der festen Zahl u: relativ zur Breite überall dieselbe Stelle
    _hobbySpot(u) {
      const { fMin, fMax } = this._g;
      return (fMin + u * (fMax - fMin)) * this._W;
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
    // kichert. Nachmittags nickt er manchmal ein (fest im Fenster, 40 s vor dem Ende; Streicheln weckt ihn).
    async _read() {
      const S = this._slotFor('read');
      const { stand, home, pW } = this._g;
      await this._goSpot(S, S.r(2) < 0.6 ? stand + pW * 0.16 : home + pW * 0.7);
      this._face(1);
      const p = this._el.pika;
      p.classList.add('reading');
      const h = new Date(S.start).getHours();
      const now0 = this._planNow();
      const doze = this._dbgDoze ? [now0 + 2500, now0 + 14000]
        : h >= 13 && h < 17 && S.r(3) < 0.35 ? [S.end - 40000, S.end - 30000 + S.r(4) * 8000] : null;
      this._dbgDoze = false;
      let dozed = false;
      while (this._planNow() < S.end) {
        const now = this._planNow();
        if (doze && !dozed && now >= doze[0] && now < doze[1]) {
          dozed = true;
          p.classList.add('doze');
          while (this._planNow() < doze[1] && p.classList.contains('doze')) await this._wait(500);
          if (p.classList.contains('doze')) {
            p.classList.remove('doze');
            this._jump('hop1');
            this._say('!', 900);
          }
          await this._wait(1200);
          continue;
        }
        const ev = doze && !dozed && doze[0] > now ? doze[0] : S.end;
        await this._waitMax(rnd(2500, 5000), ev);
        if (this._planNow() >= ev) continue;
        const r = Math.random();
        if (r < 0.5) this._pageFlip();
        else if (r < 0.65) this._say(pick(['hihi', 'hihi!', 'oh!', 'hm…']), 1100);
        else if (r < 0.75) this._twitch();
      }
      await this._wait(600);
    }

    // Gameboy: Daumen tippen, Piepser steigen auf; nach jeder Runde Freudensprung oder hängende Ohren
    // (Rundenzahl und Ausgang stehen mit dem Fenster fest)
    async _game() {
      const S = this._slotFor('game');
      await this._goSpot(S, this._hobbySpot(S.r(2)));
      this._face(S.r(3) < 0.5 ? -1 : 1);
      const p = this._el.pika;
      p.classList.add('gaming');
      const t0 = S.start + ACT_WALK;
      const rounds = 2 + Math.floor(S.r(4) * 3);
      const L = (S.end - t0) / rounds;
      for (let i = clamp(Math.floor((this._planNow() - t0) / L), 0, rounds); i < rounds; i++) {
        const end = t0 + (i + 1) * L - 2800;
        while (this._planNow() < end) {
          await this._waitMax(rnd(900, 2600), end);
          if (this._planNow() < end) this._note(pick(['♪', '♫', 'pi', 'pu', 'piu']));
        }
        if (S.r(10 + i) < 0.55) {
          this._jump('binky');
          this._say(pick(['Juhu!', 'Jaaa!']), 1200);
        } else {
          p.classList.add('meh');
          this._say(pick(['mööp', 'och…']), 1200);
          await this._wait(1600);
          p.classList.remove('meh');
        }
        await this._at(t0 + (i + 1) * L);
      }
      await this._wait(400);
    }

    // Auf dem Bauch mit dem Tablet: wischt, kichert. Fliegt gerade ein echtes Flugzeug vorbei,
    // zeigt das Tablet die Flugkarte, und er schaut zum Himmel.
    async _tablet() {
      const S = this._slotFor('tablet');
      await this._goSpot(S, this._hobbySpot(S.r(2)));
      this._face(S.r(3) < 0.5 ? -1 : 1);
      const p = this._el.pika;
      p.classList.add('lying');
      await this._wait(400);
      p.classList.add('tablet');
      while (this._planNow() < S.end) {
        const plane = [...this._planes.values()].find((pl) => pl.show && !pl.gone);
        p.classList.toggle('tplane', !!plane);
        await this._waitMax(rnd(1800, 4000), S.end);
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
      const S = this._slotFor('kite');
      const { pW, pH, gy, fMin, fMax } = this._g;
      const W = this._W;
      const H = this._H;
      const kd = this._windDir || -1;
      await this._goSpot(S, clamp(W * (kd < 0 ? 0.64 : 0.38), fMin * W, fMax * W), 0.9);
      this._face(kd);
      const p = this._el.pika;
      p.classList.add('kiting');
      // Pfote (viewBox 105/50) in px; der Drache steht schräg oben im Wind
      const px = this._x + kd * pW * (105 / 120 - 0.5);
      const py = gy - pH * 0.945 + pH * 0.5 - this._lift;
      const K = H * 0.12;
      const kx = clamp(px + kd * W * (0.26 + S.r(2) * 0.12), K, W - K) - px;
      const ky = H * (0.1 + S.r(3) * 0.07) - py;
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
      while (this._planNow() < S.end && (this._forced || this._kiteWind())) {
        await this._waitMax(rnd(3000, 6000), S.end);
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
      const S = this._slotFor('tv');
      const p = this._el.pika;
      if (this._jumpIn(S)) {
        this._lift = 0;
        this._setX(this._g.home, true);
        this._inside = true;
        this._pose('hidden', 0);
      } else if (!this._inside) await this._enterBurrow(this._wx.shelter ? 1.4 : 1);
      else if (this._poseName !== 'hidden') await this._to('hidden', 400);
      this._tvOn(true);
      await this._wait(700);
      p.classList.add('tv');
      await this._to('tv', 700);
      while (this._planNow() < S.end) {
        await this._waitMax(rnd(2500, 6000), S.end);
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
      // Gefressen gilt für alle Geräte: Wer später dazukommt (oder gerade schläft, nicht zu sehen ist), zeigt es nicht mehr
      if (food.t != null) {
        (this._foodDone ??= new Set()).add(food.t);
        this._planOp({ t: 'fate', ft: food.t });
      }
      await this._eat(FOOD[food.kind].color, 3800);
      this._memo(food.kind);
      this._cls('mlem', 950, true); // Zungenspitze: lecker
      // Zu hastig gefressen: gleich Schluckauf
      if (Math.random() < 0.25) this._hicDue = true;
      await this._wait(500);
      this._happy();
      this._jump('hop1');
      await this._wait(1300);
    }

    async _goSleep() {
      const p = this._el.pika;
      this._say('*gähn*');
      p.classList.add('yawning');
      await this._wait(2200);
      p.classList.remove('yawning');
      if (!this._inside) await this._enterBurrow(0.7, true);
      await this._wait(900);
      this._face(1);
      this._el.pika.classList.add('sleeping');
      this._pose('sleep', 1400);
      this._asleep = true;
      this._updateSky();
      this._giftScene();
    }

    async _wakeUp() {
      this._asleep = false;
      const p = this._el.pika;
      if (this._inside) this._pose('peek', 900);
      p.classList.remove('sleeping', 'peek');
      p.classList.add('stretch');
      this._updateSky();
      this._giftScene();
      try {
        await this._wait(1300);
      } finally {
        p.classList.remove('stretch');
      }
      this._say('iiep!');
      await this._wait(900);
    }

    // ---------- Bausteine ----------

    // lane (Prototyp Tiefe): 1 = hintere Spur. Alle anderen Wege führen auf die vordere Spur zurück.
    async _walkTo(x, speed = 1, steady = false, lane = 0) {
      const { pW, xR } = this._g;
      x = clamp(x, pW * 0.45, xR);
      const dx = x - this._x;
      lane = this._cfg.depth ? lane : 0;
      const dl = lane !== (this._lane || 0);
      if (Math.abs(dx) < 4 && !dl) return;
      if (Math.abs(dx) >= 4) this._face(dx > 0 ? 1 : -1);
      // Der Spurwechsel zählt wie ein kurzes Stück Weg
      const dist = Math.max(Math.abs(dx), dl ? pW * 0.6 : 0);
      const dur = dist / (pW * 0.85 * speed);
      const p = this._el.pika;
      // Gangart: kurze Wege trippelt er, eilig macht er große Hopser
      const gait = dist < pW * 0.8 && speed <= 1.2 ? 'trip' : speed >= 1.8 ? 'bighop' : null;
      // Beim Herumhoppeln stolpert er selten über die eigenen Füße
      const stumble = !steady && !dl && this._action === 'wander' && Math.abs(dx) > pW * 1.5 && Math.random() < 0.05;
      p.style.transition = `transform ${dur.toFixed(2)}s linear`;
      this._lane = lane;
      this._setX(x);
      // Ebene vor/hinter dem Vordergrund erst auf halbem Weg wechseln
      if (dl) {
        this._el.scene.classList.toggle('hinten', !lane);
        this._laneZT = setTimeout(() => this._el.scene.classList.toggle('hinten', !!this._laneDy()), dur * 500);
      }
      p.classList.add('walking');
      if (gait) p.classList.add(gait);
      try {
        if (stumble) {
          await this._wait(dur * 550);
          this._freeze();
          p.classList.remove('walking');
          p.classList.add('stumble');
          this._emote('drop', 1400);
          await this._wait(750);
          p.classList.remove('stumble');
          this._say('hoppla!', 900);
          this._blush(1500);
          await this._wait(500);
          return await this._walkTo(x, speed, true, lane);
        }
        await this._wait(dur * 1000);
      } finally {
        if (gait) p.classList.remove(gait);
      }
      p.classList.remove('walking');
      this._cls('lnd', 600, true);
    }

    async _approach(x, speed) {
      const dir = Math.abs(x - this._x) < 2 ? this._dir : Math.sign(x - this._x);
      await this._walkTo(x - dir * this._g.pW * 0.36, speed);
      this._face(x >= this._x ? 1 : -1);
    }

    // svg: Grafik des Futters (24 × 24), wenn es keine Blüte ist
    async _eat(color, ms, svg = null) {
      const p = this._el.pika;
      const m = this._el.mfood;
      this._mouth(color, svg);
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
      // Auf dem Stein (weiter hinten) etwas kleiner, Ursprung sind die Füße. Prototyp Tiefe: auf der
      // hinteren Spur höher und kleiner
      const ly = this._laneDy();
      const s = (this._lift > 0 ? 0.9 : 1) * (ly ? LANE_S : 1);
      p.style.transform = `translate(${(x - this._g.pW / 2).toFixed(1)}px, ${(-this._lift - ly).toFixed(1)}px)`
        + (s !== 1 ? ` scale(${s.toFixed(3)})` : '');
      p.classList.toggle('lane1', !!ly);
      clearTimeout(this._laneZT);
      this._el.scene.classList.toggle('hinten', !!ly);
      // Kulisse folgt dem Pika ein wenig (-1 links … 1 rechts), die Übergänge macht das CSS
      if (this._cfg.depth && this._W) this._el.scene.style.setProperty('--plx', clamp(x / this._W * 2 - 1, -1, 1).toFixed(3));
      if (instant) void p.offsetWidth;
      this._bubbleRefit();
    }

    // Prototyp Tiefe (depth: true): Höhe der hinteren Spur über der Bodenlinie, sonst 0
    _laneDy() {
      return this._cfg.depth && this._lane && !(this._lift > 0) ? this._H * LANE_DY : 0;
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
      const e = this._liveLift();
      // Mitten im Spurwechsel: auf der Spur bleiben, der er schon näher ist
      if (this._cfg.depth && !(this._lift > 0)) this._lane = e > this._H * LANE_DY / 2 ? 1 : 0;
      this._lift = Math.max(0, e - this._laneDy());
      this._setX(x, true);
    }

    _face(dir) {
      this._dir = dir;
      this._el.pika.classList.toggle('left', dir < 0);
      this._bubbleRefit(); // der Anker wechselt die Seite
    }

    // Was er im Maul hat: eine Blüte in color, oder mit svg (24 × 24) genau dieses Futter. null: nichts mehr.
    _mouth(color, svg = null) {
      const m = this._el.mfood;
      if (!color) return m.classList.remove('shrink');
      this._el.pika.style.setProperty('--mf', color);
      const it = m.querySelector('.mf-item');
      if (it && (it._svg || null) !== svg) {
        it._svg = svg;
        it.innerHTML = svg ? svg.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '') : '';
      }
      m.classList.toggle('item', !!svg && !!it);
    }

    _jump(kind) {
      if (kind === 'binky' && calmMotion()) kind = 'hop1'; // Bewegung reduzieren: ruhiger Hüpfer statt Luftsprung
      const j = [this._el.jump, this._el.shadow]; // der Schatten macht den Sprung mit (wird kleiner)
      for (const el of j) el.classList.remove('hop1', 'binky');
      void j[0].offsetWidth;
      for (const el of j) el.classList.add(kind);
      clearTimeout(this._jumpT);
      this._jumpT = setTimeout(() => j.forEach((el) => el.classList.remove(kind)), 1000);
    }

    _happy(ms = 1200) {
      const p = this._el.pika;
      p.classList.add('happy');
      clearTimeout(this._happyT);
      this._happyT = setTimeout(() => p.classList.remove('happy'), ms);
      this._hearts(3);
    }

    // loud: auch dem Bildschirmleser ansagen (sparsam, siehe _announce)
    _say(text, ms = 1400, loud = false) {
      if (loud) this._announce(text);
      this._el.say.textContent = text;
      this._bubble(this._el.say, true);
      clearTimeout(this._sayT);
      this._sayT = setTimeout(() => this._bubble(this._el.say, false), ms);
    }

    // Höchstens alle 20 s etwas in die aria-live-Region, damit der Bildschirmleser nicht dauernd plappert
    _announce(text) {
      const now = Date.now();
      if (!this._el.sr || now - (this._srAt || 0) < 20000) return;
      this._srAt = now;
      this._el.sr.textContent = `${this._cfg?.name || 'Pika'}: ${text}`;
    }

    _bubble(el, on) {
      el.classList.toggle('on', on);
      if (!on) return;
      // Am Kartenrand ins Bild schieben: der Pika (auf dem Stein 0,9 groß um die Füße) bzw. Pino an seinem Ziel
      const fr = this._fr?.say === el ? this._fr : null;
      if (fr) this._bubbleFit(el, fr.x, this._g.pW * FRIEND_SCALE);
      else if (el.parentElement === this._el.anchor) this._bubbleFit(el, this._x, this._g?.pW, this._lift > 0 ? 0.9 : 1);
    }

    // Blase el so verschieben (--bx), dass sie 4 px vom Rand bleibt. cx: Mitte der Hülle (Ziel, beim Laufen schon dort),
    // w0: deren Breite, s: Verkleinerung um die Mitte. Gemessen wird nur, wenn sie gerade zu sehen ist.
    _bubbleFit(el, cx, w0, s = 1) {
      if (!this._g || !el.classList.contains('on')) return;
      const w = el.offsetWidth;
      const ax = cx + (el.parentElement.offsetLeft - w0 / 2) * s;
      const L = ax - w * (el.closest('.inside') ? 0.06 : 0.35);
      // Auf gleicher Höhe wie Futter- oder Päckchen-Knopf: links davon bleiben, sonst verdeckt der Knopf die Blase
      let R = this._W - 4;
      const sr = this._el.scene.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      for (const b of [this._el.feed, this._el.gbtn]) {
        const r = b?.getBoundingClientRect();
        if (r?.width && er.bottom > r.top && er.top < r.bottom) R = Math.min(R, r.left - sr.left - 4);
      }
      const bx = L < 4 ? 4 - L : L + w > R ? Math.max(4 - L, R - (L + w)) : 0;
      el.style.setProperty('--bx', `${bx.toFixed(1)}px`);
    }

    // Sprech- und Denkblase des Pikas neu einpassen (nach Drehen, Laufen, Bau)
    _bubbleRefit() {
      if (!this._g) return;
      const s = this._lift > 0 ? 0.9 : 1;
      for (const el of [this._el.say, this._el.think]) this._bubbleFit(el, this._x, this._g.pW, s);
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
      // Unsichtbar nur weiterzählen, nichts tun (Blinzeln, Ohrenzucken, Blitze sieht keiner)
      const next = () => (h.t = setTimeout(() => (this._away() || fn(), next()), rnd(min, max)));
      this._loops.push(h);
      next();
    }

    _tick() {
      // Unsichtbar: nur Fristen pflegen, alles andere holt der Tick beim Sichtbarwerden nach
      if (this._away()) return this._tickCoffee();
      this._renderStats();
      // Vorrat verfällt auch ohne neue Plan-Änderung (ändert nur etwas, wenn ein Tag um ist)
      if (this._plan) this._hayFromPlan();
      // Frischer Kaffee hält ihn kurz wach (er trinkt aus und schläft dann weiter)
      if (this._sleepTime() !== this._asleep && !['goSleep', 'wakeUp', 'coffee'].includes(this._action)) {
        this._interrupt();
      }
      if (this._wxDeadAt > 0 && Date.now() - this._wxDeadAt >= WX_HOLD) this._readWeather(this._lastWeather, this._lastPrecip);
      this._updateSky();
      this._tickSky();
      this._tickFest();
      this._tickFriend();
      this._tickBote();
      this._tickCoffee();
      this._tickGift();
      this._diaryDot();
    }

    _hiddenFeatures(hidden) {
      if (!hidden) this._readFlights(this._lastFlights); // unsichtbar wurden keine Flieger angelegt
      this._hiddenSky(hidden);
      this._hiddenFest(hidden);
      this._hiddenFriend(hidden);
      this._hiddenBote(hidden);
    }

    // ---------- Interaktion ----------

    _onPet(e) {
      // Nach dem Kraulen oder Wischen kommt beim Loslassen noch ein Klick: der zählt nicht extra
      if (this._eatClick) {
        this._eatClick = false;
        return;
      }
      this._add('g', GAIN.pet);
      this._petFriend();
      this._petCount();
      const p = this._el.pika;
      if (this._asleep) return this._sleepTouch('tap');
      // Er schmollt gerade („hmpf!“): Das Streicheln zählt fürs Glück, aber er lässt sich nicht stören, und die
      // nächste Combo beginnt erst danach
      if (this._pout) return this._blush(1600);
      // Mehrmals hintereinander: Combo (innerhalb von 6 s)
      const now = Date.now();
      this._combo = (this._combo || []).filter((t) => now - t < 6000);
      this._combo.push(now);
      const n = this._combo.length;
      this._blush(1600 + n * 250);
      if (this._petFree()) {
        this._petReq = { zone: this._petZone(e), n, from: this._action };
        if (n >= 11) this._combo = [];
        this._touchNext('petReact');
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

    // ---------- Streicheln: Zonen, Combo, Kraulen, Wischen ----------

    // Darf Streicheln eine eigene Reaktion starten? Nur bei Kleinigkeiten, draußen auf der Wiese, und nicht, wenn
    // schon etwas anderes ansteht (Häufchen, Vorschau-Knopf): das bliebe sonst liegen
    _petFree() {
      return this._running && !!this._g && !this._inside && !(this._lift > 0) && !this._asleep && !this._giftCarry && !this._pout
        && (this._action == null || PET_FREE.has(this._action)) && (!this._next || TOUCH_NEXT.has(this._next));
    }

    // Reaktion auf eine Berührung als nächste Aktion (mit Zeitstempel, siehe TOUCH_TTL)
    _touchNext(name) {
      this._next = name;
      this._nextAt = Date.now();
      this._interrupt();
    }

    // Im Schlaf gestreichelt, gekrault oder übers Fell gestrichen: ein Auge auf, Herzchen, manchmal „mmh…“.
    // Viermal in 6 s: „noch fünf Minuten…“, und er dreht sich auf die andere Seite.
    _sleepTouch(kind) {
      const p = this._el.pika;
      const now = Date.now();
      this._zzCombo = (this._zzCombo || []).filter((t) => now - t < 6000);
      this._zzCombo.push(now);
      clearTimeout(this._peekT);
      if (this._zzCombo.length >= 4) {
        this._zzCombo = [];
        p.classList.remove('peek');
        this._say('noch fünf Minuten…', 2200);
        this._face(-this._dir);
        this._cls('stw', 550, true);
        return;
      }
      p.classList.add('peek');
      this._peekT = setTimeout(() => p.classList.remove('peek'), kind === 'kraul' ? 2400 : 1300);
      this._hearts(1);
      if (kind !== 'tap' || Math.random() < 0.3) this._say(pick(['mmh…', 'mip…', 'mmmh…']), 1400);
      if (kind === 'kraul') this._cls('content', 2600);
    }

    // Wo wurde er angetippt? In Koordinaten der Pika-Grafik (120 × 100, Blick nach rechts)
    _petZone(e) {
      const svg = this._el.pika.querySelector('.pk');
      const r = svg?.getBoundingClientRect();
      if (!e || !r?.width) return 'body';
      let x = ((e.clientX - r.left) / r.width) * 120;
      const y = ((e.clientY - r.top) / r.height) * 100;
      if (this._dir < 0) x = 120 - x;
      const d = (ax, ay) => Math.hypot(x - ax, y - ay);
      // Auf kleinen Karten (Handy) wären Nase und Ohren nur 13–16 px groß: Ohren mindestens 14 px Radius, die Nase
      // (zuerst geprüft) 10 px, sonst schluckte sie auf dem Handy den ganzen Kopf
      const m = (20 / r.width) * 120;
      if (d(91, 53) < Math.max(9, m * 0.5)) return 'nose';
      const el = d(75, 24);
      const er = d(101, 25);
      if (Math.min(el, er) < Math.max(11.5, m * 0.7)) return el < er ? 'ear-l' : 'ear-r';
      if (x > 62 && y < 63) return 'head';
      if (x > 62 && y >= 66) return 'belly';
      return 'body';
    }

    async _petReact() {
      const R = this._petReq;
      this._petReq = null;
      if (!R) return;
      const p = this._el.pika;
      if (R.from === 'nod') {
        this._cls('hic', 340, true);
        this._say('oh!', 900);
        this._emote('drop', 1400);
        await this._wait(900);
      }
      if (R.n >= 11) return this._petPout();
      if (R.n >= 8) return this._petMelt();
      if (R.n === 5) {
        this._jump('binky');
        this._emote('spark', 1500);
        p.classList.add('happy');
        this._hearts(3);
        await this._wait(1200);
        return;
      }
      if (R.zone === 'nose') return this._petNose();
      if (R.zone === 'ear-l' || R.zone === 'ear-r') return this._petEar(R.zone.slice(-1));
      if (R.zone === 'belly') return this._petBelly();
      if (R.zone === 'head') return this._petHead();
      // Rücken und Po: Freudensprung wie bisher
      this._happy();
      this._jump(Math.random() < 0.25 ? 'binky' : 'hop1');
      if (Math.random() < 0.35) this._say(pick(['iiep!', 'mip!', '♥']));
      await this._wait(1200);
    }

    // Kopf: in die Hand lehnen, Augen zu, Ohren angelegt
    async _petHead() {
      this._el.pika.classList.add('lean', 'tilt', 'squint', 'content', 'flat');
      this._hearts(2);
      if (Math.random() < 0.4) this._say(pick(['mmh…', '♥', 'mip…']), 1200);
      await this._wait(rnd(1500, 2100));
    }

    // Nase: boop! Er schielt auf die Nase, manchmal muss er niesen
    async _petNose() {
      const p = this._el.pika;
      this._say('boop!', 900);
      p.classList.add('crosseye');
      this._noseWiggle();
      await this._wait(1000);
      p.classList.remove('crosseye');
      if (Math.random() < 0.45) return this._sneeze(false);
      this._blink();
      this._hearts(1);
      await this._wait(400);
      if (Math.random() < 0.5) this._say(pick(['hihi', 'nochmal!', 'mip!']), 1000);
      await this._wait(900);
    }

    // Ohr: flappt nach
    async _petEar(side) {
      const p = this._el.pika;
      this._cls(`eflap-${side}`, 950, true);
      this._blink();
      await this._wait(350);
      p.classList.add('happy');
      if (Math.random() < 0.5) this._say(pick(['hihi', 'iiep!', '!']), 900);
      this._hearts(1);
      await this._wait(1000);
    }

    // Bauch: kichern, manchmal kurz auf den Rücken kippen
    async _petBelly() {
      const p = this._el.pika;
      this._say(pick(['hihi!', 'hihihi!', 'kicher!']), 1300);
      p.classList.add('happy', 'tickle');
      await this._wait(1000);
      p.classList.remove('tickle');
      if (Math.random() < 0.6) {
        p.classList.add('roll');
        await this._wait(rnd(1100, 1600));
        p.classList.remove('roll');
        await this._wait(400);
      }
      this._hearts(2);
      await this._wait(600);
    }

    // Achtmal: schmilzt zum runden Fellknäuel
    async _petMelt() {
      this._el.pika.classList.add('melt', 'squint', 'content', 'flat');
      this._say('♥♥♥', 1800);
      this._hearts(4);
      this._blush(4500);
      await this._wait(3400);
    }

    // Elfmal: genug! Er dreht sich beleidigt weg und linst dann doch zurück
    async _petPout() {
      const p = this._el.pika;
      const dir = this._dir;
      // Solange er schmollt, bricht weiteres Tippen das nicht ab (_petFree, _onPet): Wer elfmal tippt, tippt meist weiter
      this._pout = true;
      try {
        this._face(-dir);
        this._emote('grump', 2400);
        this._say('hmpf!', 1300);
        p.classList.add('look-up', 'squint');
        await this._wait(2500);
        p.classList.remove('look-up', 'squint');
        p.classList.add('look-b');
        await this._wait(900);
        p.classList.remove('look-b');
        this._face(dir);
        this._say(pick(['…na gut', '…na schön', 'hihi']), 1300);
        this._blush(2200);
        this._hearts(1);
        await this._wait(1300);
      } finally {
        this._pout = false;
      }
    }

    // el: wer den Finger festhält (sonst der Pika; die Tippfläche eines tiefen Fliegers reicht ihn durch)
    _pressStart(e, el = this._el.pika) {
      // Ein neuer Finger: der Klick zum letzten Drücken ist dann längst durch
      this._eatClick = false;
      // Nur der erste Finger zählt (ein zweiter beendete sonst das Kraulen)
      if (e.button > 0 || e.isPrimary === false || !this._g) return;
      this._press = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try {
        el.setPointerCapture(e.pointerId); // beim Wischen nicht vom Pika abrutschen
      } catch (err) { /* nicht unterstützt */ }
      clearTimeout(this._pressT);
      this._pressT = setTimeout(() => {
        const P = this._press;
        if (!P || P.swiped) return;
        if (this._asleep) {
          // im Schlaf gekrault: wohlig, aber er bleibt liegen
          P.kraul = true;
          this._add('g', GAIN.pet);
          this._petCount();
          return this._sleepTouch('kraul');
        }
        if (!this._petFree()) return;
        P.kraul = true;
        this._kraulOn = true;
        this._petFriend();
        this._touchNext('kraul');
      }, 550);
    }

    _pressMove(e) {
      const P = this._press;
      if (!P || P.id !== e.pointerId || P.kraul || P.swiped || !this._g) return;
      const dx = Math.abs(e.clientX - P.x);
      const dy = Math.abs(e.clientY - P.y);
      if (dx > this._g.pW * 0.35 && dx > dy * 1.5) {
        P.swiped = true;
        clearTimeout(this._pressT);
        this._onStroke();
      } else if (Math.hypot(dx, dy) > 12) clearTimeout(this._pressT); // bewegt: kein Kraulen
    }

    _pressEnd(e) {
      const P = this._press;
      if (!P || (e && e.pointerId !== P.id)) return;
      clearTimeout(this._pressT);
      this._press = null;
      // Der Klick beim Loslassen gehört zum Kraulen bzw. Wischen: den nächsten verschlucken. Bleibt er aus (Touch
      // nach Bewegung), räumt der nächste Druck bzw. die Frist den Merker weg.
      if (P.kraul || P.swiped) {
        this._eatClick = true;
        clearTimeout(this._eatClickT);
        this._eatClickT = setTimeout(() => (this._eatClick = false), 2000);
      }
      if (P.kraul) this._kraulOn = false;
    }

    // Über das Fell gestrichen: es plustert sich auf und legt sich wieder
    _onStroke() {
      this._add('g', GAIN.pet);
      this._petCount();
      if (this._asleep) return this._sleepTouch('stroke');
      this._blush(2000);
      if (this._petFree()) this._touchNext('stroke');
      else this._cls('fluffy', 850, true);
    }

    async _stroke() {
      const p = this._el.pika;
      this._cls('fluffy', 850, true);
      this._blink();
      await this._wait(500);
      p.classList.add('squint', 'content');
      this._hearts(1);
      await this._wait(1000);
      this._noseWiggle();
      await this._wait(600);
    }

    // Kraulen, solange der Finger liegt (höchstens 20 s): Augen zu, Klopfbein, prrr
    async _kraul() {
      const p = this._el.pika;
      p.classList.add('squint', 'content', 'flat', 'tilt');
      this._say('prrr…', 1500);
      this._add('g', GAIN.pet);
      this._petCount();
      const t0 = Date.now();
      try {
        for (let i = 0; this._kraulOn && Date.now() - t0 < 20000; i++) {
          if (i === 1) p.classList.add('thump');
          this._blush(2500);
          if (i % 2) this._hearts(1);
          if (i % 3 === 2) this._add('g', GAIN.pet / 2);
          if (i === 4) this._say(pick(['prrrr…', 'mmmh…', '♥']), 1500);
          await this._wait(900);
        }
      } finally {
        this._kraulOn = false;
      }
      p.classList.remove('thump');
      await this._wait(500);
      p.classList.remove('squint');
      this._hearts(1);
      await this._wait(700);
    }

    // Stand des heutigen Pika-Tags aus dem Tagesplan (mit plan_entity auf allen Geräten gleich): n gestreichelt, m Erlebnisse
    _cuteToday() {
      const d = pikaDay(this._haNow());
      const c = this._plan?.cute;
      return c?.d === d ? c : { d, n: 0, m: 0 };
    }

    // Wie oft er heute gestreichelt wurde, auf allen Geräten zusammen: ab 10 kommt er auch mal angehoppelt
    _petCount() {
      const c = this._cuteToday();
      if (c.n >= PET_CAP) return; // mehr muss keiner wissen, der Helfer wird dafür nicht mehr geschrieben
      this._planOp({ t: 'pet', d: c.d, n: c.n + 1 });
      if (c.n + 1 === 8) this._memo('heart');
    }

    _clingy() {
      return this._cuteToday().n >= PET_CLING;
    }

    async _comeHere() {
      const x = this._comeX;
      this._comeX = null;
      if (x == null) return;
      const p = this._el.pika;
      this._noseWiggle();
      await this._walkTo(x - Math.sign(x - this._x) * this._g.pW * 0.3, 1.3);
      p.classList.add('tilt');
      if (Math.random() < 0.5) this._emote('q', 1400);
      else this._hearts(1);
      await this._wait(rnd(1200, 1800));
    }

    // ---------- Mimik ----------

    // Zustandsklasse c für ms Millisekunden (eigener Zeitgeber je Klasse; restart spielt die Animation neu ab)
    _cls(c, ms, restart) {
      const p = this._el.pika;
      if (restart && p.classList.contains(c)) {
        p.classList.remove(c);
        void p.offsetWidth;
      }
      p.classList.add(c);
      const T = (this._clsT ??= {});
      clearTimeout(T[c]);
      T[c] = setTimeout(() => p.classList.remove(c), ms);
    }

    _blush(ms = 1800) {
      if (!this._asleep) this._cls('blush', ms);
    }

    _noseWiggle() {
      if (this._asleep || this._action === 'eatFood' || this._action === 'nod') return;
      this._cls('nosey', 850, true);
    }

    // Kleines Zeichen über dem Kopf: ? ! Schweißtropfen, Funkeln, Grummelwolke
    _emote(kind, ms = 1500) {
      const a = this._el.anchor;
      if (!a) return;
      const el = document.createElement('span');
      el.className = `emo emo-${kind}`;
      el.innerHTML = EMOTE[kind] ?? kind;
      el.style.setProperty('--emt', `${ms}ms`);
      a.appendChild(el);
      setTimeout(() => el.remove(), ms + 60);
    }

    // Wo die Nase gerade ist (Szene-Pixel). Auf dem Stein steht er um 0,9 verkleinert (Ursprung: Füße).
    _nosePos() {
      const { pW, pH, gy } = this._g;
      const lift = this._liveLift();
      const s = lift > 0 ? 0.9 : 1;
      return { x: this._liveX() + this._dir * pW * 0.258 * s, y: gy - lift - pH * 0.43 * s };
    }

    // ---------- Kleine Momente ----------

    _cuteActs({ s, g, wx, elev, hasFlowers }) {
      const d = new Date(this._dbgDate ?? Date.now());
      const h = d.getHours();
      const south = (this._hass?.config?.latitude ?? 50) < 0;
      const mo = (d.getMonth() + (south ? 6 : 0)) % 12;
      const dry = !wx.wet && !wx.snowcover;
      this._pollenSeason = dry && mo >= 2 && mo <= 5;
      const sleepyH = (h >= 13 && h < 15) || h >= 19 || (elev != null && elev < 6 && h >= 12);
      const bfly = mo >= 3 && mo <= 8 && dry && !wx.cold && (this._wind || 0) < 30 && (elev == null || elev > 8) && !this._bfly;
      const gift = hasFlowers && !wx.wet && g > 60 && !this._giftEl && this._haNow() - (this._plan?.fl?.t || 0) > FLGIFT.gap;
      return [
        [dry ? 0.5 : 0.25, 'curious'],
        [sleepyH ? 0.35 : 0.12, 'yawn'],
        [0.06 + (this._pollenSeason ? 0.14 : 0) + (wx.cold ? 0.08 : 0), 'sneeze'],
        [wx.wet ? 0 : 0.22, 'earClean'], // bei Regen hält eine Pfote das Blatt
        [wx.wet ? 0 : 0.16, 'scratch'],
        [this._hicDue ? 8 : 0, 'hiccup'],
        [wx.wet ? 0 : h >= 13 && h < 16 ? 0.08 : 0.02, 'nod'],
        [bfly ? 0.14 : 0, 'butterfly'],
        [dry && g > 85 && s > 40 && !this._fr && !calmMotion() ? 0.08 : 0, 'zoomies'], // Bewegung reduzieren: nie
        [gift ? 0.15 : 0, 'gift'],
      ];
    }

    // Kopf schief, manchmal mit Fragezeichen, manchmal erst links, dann rechts
    async _curious() {
      const p = this._el.pika;
      const a = Math.random() < 0.7 ? 'tilt' : 'tilt-b';
      p.classList.add(a);
      if (Math.random() < 0.6) this._emote('q', 1500);
      await this._wait(rnd(1100, 1800));
      p.classList.remove(a);
      if (Math.random() < 0.4) {
        await this._wait(250);
        const b = a === 'tilt' ? 'tilt-b' : 'tilt';
        p.classList.add(b);
        await this._wait(rnd(900, 1400));
        p.classList.remove(b);
      }
      await this._wait(rnd(300, 700));
    }

    async _yawn() {
      const p = this._el.pika;
      if (Math.random() < 0.35) this._say('*gähn*', 1400);
      p.classList.add('yawning');
      await this._wait(2300);
      p.classList.remove('yawning');
      this._cls('mlem', 950, true); // schmatzen
      await this._wait(600);
      this._blink();
      await this._wait(rnd(600, 1200));
    }

    // Niesen: Nase kribbelt, Kopf zurück, hatschi! onBurst läuft im Moment des Niesers (Schmetterling fliegt auf).
    async _sneeze(pollen = this._pollenSeason, onBurst) {
      const p = this._el.pika;
      if (pollen) this._pollen();
      p.classList.add('presneeze');
      this._say('ha…', 750);
      await this._wait(750);
      this._say('haa…', 700);
      await this._wait(600);
      p.classList.remove('presneeze');
      p.classList.add('sneezing');
      this._say(pick(['hatschi!', 'hatschii!', 'tschi!']), 1100);
      this._snzFx();
      onBurst?.();
      await this._wait(450);
      p.classList.remove('sneezing');
      this._cls('eflap-l', 950, true);
      this._cls('eflap-r', 950, true);
      await this._wait(800);
      if (Math.random() < 0.5) {
        this._blush(1500);
        this._say(pick(['hihi', 'pardon!', '…']), 1000);
      }
      await this._wait(800);
    }

    _snzFx() {
      const { pH } = this._g;
      const n = this._nosePos();
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('span');
        el.className = 'snz';
        el.style.left = `${n.x}px`;
        el.style.top = `${n.y}px`;
        el.style.setProperty('--px', `${this._dir * rnd(0.08, 0.22) * pH}px`);
        el.style.setProperty('--py', `${rnd(-0.12, 0.06) * pH}px`);
        this._el.fx.appendChild(el);
        setTimeout(() => el.remove(), 600);
      }
    }

    // Blütenstaub tanzt vor der Nase
    _pollen() {
      const { pH } = this._g;
      const n = this._nosePos();
      for (let i = 0; i < 6; i++) {
        const el = document.createElement('span');
        el.className = 'pol';
        el.style.left = `${n.x + this._dir * rnd(0.02, 0.16) * pH}px`;
        el.style.top = `${n.y + rnd(-0.12, 0.04) * pH}px`;
        el.style.setProperty('--px', `${rnd(-0.08, 0.08) * pH}px`);
        el.style.setProperty('--py', `${rnd(-0.14, -0.02) * pH}px`);
        el.style.animationDelay = `${i * 120}ms`;
        this._el.fx.appendChild(el);
        setTimeout(() => el.remove(), 1700 + i * 120);
      }
    }

    // Ohr putzen: das vordere Ohr mit beiden Pfoten herunterziehen, danach Ohren schütteln
    async _earClean() {
      const p = this._el.pika;
      p.classList.add('earwash');
      await this._wait(rnd(2200, 3600));
      p.classList.remove('earwash');
      await this._wait(350);
      this._cls('eflap-r', 950, true);
      this._cls('eflap-l', 950, true);
      await this._wait(rnd(700, 1200));
    }

    // Mit der Hinterpfote hinterm Ohr kratzen
    async _scratch() {
      const p = this._el.pika;
      p.classList.add('scratching', 'squint');
      await this._wait(rnd(1400, 2400));
      p.classList.remove('scratching', 'squint');
      this._cls('eflap-l', 950, true);
      await this._wait(rnd(500, 900));
    }

    // Schluckauf nach hastigem Fressen
    async _hiccup() {
      this._hicDue = false;
      const n = 3 + Math.floor(rnd(0, 3));
      for (let i = 0; i < n; i++) {
        this._cls('hic', 340, true);
        this._say(pick(['hicks!', 'hick!']), 700);
        if (i === 1) this._emote('drop', 1300);
        await this._wait(rnd(1100, 1900));
      }
      this._blink();
      await this._wait(500);
      this._say(pick(['…weg!', 'puh!']), 1100);
      await this._wait(1100);
    }

    // Einnicken am Nachmittag: der Kopf sinkt, er schreckt hoch und tut, als wäre nichts gewesen
    async _nod() {
      const p = this._el.pika;
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        p.classList.add('nodding');
        await this._wait(rnd(1700, 2600));
        p.classList.remove('nodding');
        if (i < n - 1) {
          this._blink();
          await this._wait(rnd(500, 900));
        }
      }
      this._cls('hic', 340, true);
      this._emote('ex', 1100);
      this._cls('eflap-l', 950, true);
      await this._wait(500);
      p.classList.add('look-b');
      await this._wait(500);
      p.classList.replace('look-b', 'look-f');
      await this._wait(500);
      p.classList.remove('look-f');
      this._emote('drop', 1500);
      this._blush(1800);
      if (Math.random() < 0.5) this._say(pick(['war nix!', 'hab nicht geschlafen!', 'hm?']), 1500);
      await this._wait(1500);
    }

    // Ein Schmetterling landet auf der Nase: schielen, stillhalten, dann niesen oder hinterherhopsen
    async _butterfly() {
      const { pW, pH, gy } = this._g;
      const p = this._el.pika;
      if (this._x < pW || this._x > this._W - pW) await this._walkTo(clamp(this._x, pW * 1.2, this._W - pW * 1.2));
      const el = document.createElement('div');
      el.className = 'bfly';
      el.innerHTML = BFLY_SVG(pick(BFLY_COLORS));
      this._el.fx.appendChild(el);
      this._bfly = el;
      this._memo('bfly');
      const at = (x, y) => ({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` });
      const flyOff = () => {
        if (this._bfly !== el) return;
        this._bfly = null;
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        el.classList.remove('rest');
        const dx = (Math.random() < 0.5 ? -1 : 1) * this._W * rnd(0.4, 0.7);
        const kf = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          kf.push(at(m.m41 + dx * t, m.m42 - this._H * 0.75 * t + Math.sin(t * Math.PI * 4) * pH * 0.12));
        }
        el.animate(kf, { duration: 3200, easing: 'ease-in', fill: 'forwards' });
        setTimeout(() => el.remove(), 3300);
      };
      try {
        const n = this._nosePos();
        const tx = n.x;
        const ty = n.y - pH * 0.04;
        // von vorn heran, damit er ihn kommen sieht
        const sx = this._dir > 0 ? this._W + pH * 0.2 : -pH * 0.2;
        const sy = gy - this._H * rnd(0.45, 0.65);
        const kf = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          kf.push(at(sx + (tx - sx) * t, sy + (ty - sy) * t + Math.sin(t * Math.PI * 3) * pH * 0.2 * (1 - t)));
        }
        const dur = 4200;
        el.animate(kf, { duration: dur, easing: 'ease-out', fill: 'forwards' });
        await this._wait(dur * 0.5);
        p.classList.add('look-up');
        this._cls('sparkle', 2200);
        await this._wait(dur * 0.5);
        el.classList.add('rest');
        p.classList.remove('look-up');
        p.classList.add('crosseye');
        await this._wait(rnd(2200, 3400));
        p.classList.remove('crosseye');
        if (Math.random() < 0.5) {
          await this._sneeze(false, flyOff);
        } else {
          this._blink();
          await this._wait(400);
          flyOff();
          p.classList.add('look-up');
          await this._wait(500);
          this._jump('binky');
          this._say(pick(['oh!', 'tschüss!', 'wiii!']), 1100);
          await this._wait(1600);
        }
      } finally {
        flyOff();
      }
    }

    // Vor Freude wild über die Wiese flitzen, danach hecheln
    async _zoomies() {
      const { pW, home } = this._g;
      const p = this._el.pika;
      this._say(pick(['wiii!', 'juhuu!', 'iiiiiep!']), 1200);
      this._jump('binky');
      await this._wait(900);
      const lo = Math.max(home, pW * 0.5);
      const hi = this._g.xR;
      const legs = 3 + Math.floor(rnd(0, 2));
      for (let i = 0; i < legs; i++) {
        const mid = (lo + hi) / 2;
        const x = this._x < mid ? rnd(mid + (hi - mid) * 0.4, hi) : rnd(lo, mid - (mid - lo) * 0.4);
        await this._walkTo(x, 2.4, true);
        this._puff(this._x, this._g.gy, 3);
        this._jump(Math.random() < 0.6 ? 'binky' : 'hop1');
        await this._wait(700);
      }
      this._cls('excited', 25000);
      p.classList.add('pant', 'happy');
      this._say(pick(['puh!', 'hechel…', 'hihi!']), 1300);
      await this._wait(2600);
    }

    // Eine Blüte als Geschenk vorn ins Gras legen. Antippen nimmt sie an.
    async _gift() {
      const f = this._nearestFlower();
      if (!f || this._giftEl) return;
      const p = this._el.pika;
      const { pW } = this._g;
      await this._approach(f.xf * this._W);
      await this._sniffPick(f);
      this._mouth(f.color);
      p.classList.add('carry');
      // Unterwegs bricht Streicheln das Geschenk nicht ab (_petFree). Alles andere (Futter, Schlaf, Plan): dann legt er
      // die Blüte eben dort ab, wo er gerade ist, statt dass sie verschwindet
      this._giftCarry = true;
      try {
        await this._walkTo(clamp(this._W * rnd(0.4, 0.6), pW, this._W - pW));
      } finally {
        this._giftCarry = false;
        p.classList.remove('carry');
        this._mouth(null);
        // Hat unterwegs ein anderes Gerät eins hingelegt, liegt das schon da (und gilt auf allen)
        if (!this._giftEl) this._flowerGiftDrop(f.color);
      }
      this._say(pick(['für dich!', 'für dich ♥', 'hier!']), 1800, true);
      this._blush(3000);
      p.classList.add('happy');
      this._jump('hop1');
      await this._wait(1500);
      p.classList.remove('happy');
      p.classList.add('tilt');
      await this._wait(1600);
    }

    // Blüte mit Schleife vor ihm ins Gras legen; erst jetzt zählen die 90 Minuten bis zum nächsten Geschenk. Sie steht im
    // Tagesplan (fl), so liegt sie auf allen Geräten an derselben Stelle (siehe _flowerFromPlan).
    _flowerGiftDrop(color) {
      const pal = this._areal().flowers || FLOWER_COLORS;
      const x = clamp(this._liveX() + this._dir * this._g.pW * 0.45, this._g.pH * 0.35, this._W - this._g.pH * 0.35);
      this._planOp({ t: 'fdrop', f: { t: this._haNow(), c: Math.max(0, pal.indexOf(color)) % 10, x: Math.round((x / this._W) * 100), k: false } });
    }

    // Blumengeschenk nach dem Tagesplan zeigen: hinlegen (auch wenn es ein anderes Gerät hingelegt hat), auf allen Geräten
    // wegnehmen, sobald es auf einem angetippt wurde, und nach FLGIFT.life welken lassen
    _flowerFromPlan() {
      if (!this._g || !this._el) return;
      const f = this._plan?.fl;
      const left = f && !f.k ? f.t + FLGIFT.life - this._haNow() : 0;
      const el = this._giftEl;
      if (el && (el._t !== f?.t || left <= 0)) {
        this._giftEl = null;
        clearTimeout(this._giftT);
        if (el._t === f?.t && f.k) {
          // auf einem anderen Gerät angenommen
          el.classList.add('take');
          setTimeout(() => el.remove(), 950);
        } else {
          el.classList.add('wilt');
          if (el._t !== f?.t) el.style.transitionDuration = '.6s'; // durch ein anderes ersetzt
          setTimeout(() => el.remove(), 4200);
        }
      }
      if (this._giftEl || left <= 0 || left > FLGIFT.life + 6e4) return;
      const pal = this._areal().flowers || FLOWER_COLORS;
      const g = document.createElement('div');
      g.className = 'pgift';
      g.innerHTML = `${GIFT_SVG(pal[f.c % pal.length])}<i class="pspk"></i><i class="pspk"></i><i class="pspk"></i>`;
      g._t = f.t;
      g._xf = f.x / 100; // relativ: bei Größenänderung mitwandern
      this._flowerGiftPlace(g);
      g.addEventListener('click', (e) => (e.stopPropagation(), this._takeGift()));
      this._el.fx.appendChild(g);
      this._giftEl = g;
      clearTimeout(this._giftT);
      this._giftT = setTimeout(() => this._flowerFromPlan(), left + 100);
    }

    // Ganz vorn im Gras, nah am Betrachter
    _flowerGiftPlace(el) {
      const { pH, gy } = this._g;
      el.style.left = `${(el._xf * this._W).toFixed(1)}px`;
      el.style.top = `${(gy - pH * 0.1).toFixed(1)}px`;
    }

    _takeGift() {
      const el = this._giftEl;
      if (!el) return;
      this._giftEl = null;
      clearTimeout(this._giftT);
      this._planOp({ t: 'ftake', ft: el._t });
      const r = el.getBoundingClientRect();
      const s = this._el.scene.getBoundingClientRect();
      for (let i = 0; i < 3; i++) {
        const h = document.createElement('span');
        h.className = 'heart';
        h.innerHTML = ICON_HEART;
        h.style.left = `${r.left - s.left + r.width * rnd(0.3, 0.8)}px`;
        h.style.top = `${r.top - s.top}px`;
        h.style.setProperty('--dx', `${rnd(-0.3, 0.3) * this._g.pW}px`);
        h.style.animationDelay = `${i * 110}ms`;
        this._el.fx.appendChild(h);
        setTimeout(() => h.remove(), 1700 + i * 110);
      }
      el.classList.add('take');
      setTimeout(() => el.remove(), 950);
      this._add('g', GAIN.pet);
      if (this._asleep) return;
      this._blush(2500);
      this._happy(1400);
      if (!this._el.pika.classList.contains('walking')) this._jump('binky');
      this._say(pick(['♥', 'hihi ♥', 'gern!']), 1300);
    }

    // Langes Wiedersehen (über 3 Stunden nicht zu sehen): er hoppelt nach vorn und freut sich riesig
    async _reunite() {
      const p = this._el.pika;
      if (this._inside) await this._comeOut();
      this._cls('sparkle', 6000);
      this._emote('ex', 1000);
      await this._wait(600);
      await this._walkTo(this._W * 0.5, 1.8);
      p.classList.add('waving');
      this._say(pick(['Da bist du ja endlich!', 'Du warst lange weg!', 'Juhuu, du bist da!']), 2200, true);
      this._blush(4500);
      await this._wait(1800);
      p.classList.remove('waving');
      this._jump('binky');
      this._hearts(4);
      await this._wait(1000);
      this._jump('binky');
      await this._wait(1100);
    }

    // ---------- Träume ----------

    // Tagesgedächtnis im Tagesplan: was der Pika heute erlebt hat (Pino, Kaffee, Flieger …), egal auf welchem Gerät
    // es zu sehen war. Geschrieben wird nur beim ersten Mal je Art und Tag.
    _memo(kind) {
      const b = 1 << MEM_BITS.indexOf(kind);
      if (b < 1) return;
      const c = this._cuteToday();
      if (!(c.m & b)) this._planOp({ t: 'mem', d: c.d, b });
    }

    // Was er an diesem Pika-Tag erlebt hat, träumt er dreimal so oft. Schläft er schon vor 4 Uhr ein, ist es heute;
    // wacht er nach 4 Uhr noch nicht gleich auf, gilt noch der Vortag.
    _dreamSvg() {
      const opts = [[1, 'lz'], [1, 'heart'], [0.6, 'klee']];
      const c = this._plan?.cute;
      if (c && c.d >= pikaDay(this._haNow()) - 1) MEM_BITS.forEach((k, i) => c.m & (1 << i) && opts.push([3, k]));
      return DREAM[weighted(opts)];
    }

    // Im Schlaf: ab und zu ein Traum, Zucken, Schmatzen oder Murmeln
    async _dream() {
      const dbg = this._dbgDream; // Vorschau: gleich träumen
      this._dbgDream = false;
      await this._wait(dbg ? 300 : rnd(25000, 55000));
      if (!this._asleep) return;
      const p = this._el.pika;
      const r = dbg ? 0 : Math.random();
      if (r < 0.4) {
        const think = this._el.think;
        think.innerHTML = this._dreamSvg();
        think.classList.add('dream');
        try {
          this._bubble(think, true);
          p.classList.add('content');
          await this._wait(rnd(4000, 6500));
          if (Math.random() < 0.5) this._cls('mlem', 950, true);
          await this._wait(1200);
          this._bubble(think, false);
          await this._wait(400);
        } finally {
          think.innerHTML = FOOD.lz.svg;
          think.classList.remove('dream');
        }
      } else if (r < 0.6) {
        this._cls('stw', 550, true);
      } else if (r < 0.75) {
        this._say(pick(['mip…', 'mmh…', 'zzz… Löwenzahn…', `${this._frName()}…`, 'hihi…']), 1800);
      } else if (r < 0.85) {
        this._cls('mlem', 950, true);
      }
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
      const { fMin, fMax } = this._g;
      let xf = rnd(fMin, fMax);
      // nicht direkt auf den Pika fallen lassen
      if (Math.abs(xf * this._W - this._x) < this._g.pW * 0.6) xf = clamp(xf + 0.25 * pick([-1, 1]), fMin, fMax);
      // Das Futter steht im Tagesplan und fällt von dort auf allen Geräten (_foodFromPlan). t ist seine Kennung.
      const t = Math.max(sec(this._haNow()), ...(this._plan.fd || []).map((f) => f.t + 1000));
      const x = clamp(Math.round(((xf - fMin) / Math.max(1e-6, fMax - fMin)) * 99), 0, 99);
      this._planOp({ t: 'feed', f: { t, x, k: Math.random() < 0.6 ? 0 : 1, e: false } });
    }

    // Futter aus dem Tagesplan auf die Wiese: gerade gefüttert (auch auf einem anderen Gerät) fällt es herunter, sonst
    // liegt es schon da (Neuladen, Bildschirm war aus). Was dieses Gerät schon fressen sah, kommt nicht wieder.
    _foodFromPlan() {
      if (!this._el || !this._g) return;
      const now = this._haNow();
      const done = (this._foodDone ??= new Set());
      for (const f of this._plan?.fd || []) {
        const have = this._foods.find((o) => o.t === f.t);
        if (f.e) {
          // Woanders gefressen, hier sah keiner zu (schläft, Karte nicht zu sehen): dann ist es auch hier weg.
          // Schaut man zu, frisst er es gleich selbst.
          if (have && (this._asleep || !this._running)) this._removeFood(have);
          continue;
        }
        if (have || done.has(f.t) || now - f.t > 864e5) continue;
        this._foodAdd(f, now - f.t < 2500);
      }
    }

    _foodAdd(f, drop) {
      const { fMin, fMax } = this._g;
      const xf = fMin + (f.x / 99) * (fMax - fMin);
      const kind = FOOD_KINDS[f.k] || 'lz';
      const el = document.createElement('div');
      el.className = drop ? 'food drop' : 'food';
      el.style.setProperty('--xf', xf.toFixed(4));
      el.innerHTML = FOOD[kind].svg;
      this._el.foods.appendChild(el);
      const food = { xf, kind, el, landed: !drop, t: f.t };
      this._foods.push(food);
      const land = () => {
        food.landed = true;
        el.classList.remove('drop');
        if (this._asleep) {
          if (!drop) return;
          this._el.pika.classList.add('peek');
          setTimeout(() => this._el.pika.classList.remove('peek'), 900);
        } else if (this._action !== 'eatFood' && this._action !== 'coffee') {
          // Beim Kaffee nicht: das Futter frisst er ohnehin erst danach, er hüpfte nur vom Stein
          this._interrupt();
        }
      };
      if (!drop) return land();
      // Sternchenaugen, wenn Futter kommt
      if (!this._asleep) this._cls('sparkle', 2600);
      setTimeout(land, 800);
    }

    _onLookAt(e) {
      const p = this._el.pika;
      // Im Bau (auch beim Fernsehen, Rückansicht) schaut er nicht herum
      if (this._asleep || !this._g || this._action === 'eatFood' || this._inside || p.classList.contains('tv')) return;
      const sr = this._el.scene.getBoundingClientRect();
      const x = e.clientX - sr.left;
      const c = Math.sign(x - this._liveX()) === this._dir ? 'look-f' : 'look-b';
      // Nur den eigenen Blick vom letzten Tipp ersetzen; schaut er gerade für seine Aktion (Vögelchen, Hunger,
      // Bild betrachten), bleibt der Blick dort
      clearTimeout(this._lookT);
      if (this._lookC) p.classList.remove(this._lookC);
      this._lookC = null;
      if (!['look-f', 'look-b', 'look-up'].some((k) => p.classList.contains(k))) {
        p.classList.add(c);
        this._lookC = c;
        this._lookT = setTimeout(() => (p.classList.remove(c), (this._lookC = null)), 1500);
      }
      // Heute oft gestreichelt: auf die Wiese getippt, hoppelt er gern hin. Sonst legt er manchmal den Kopf schief.
      const meadow = e.clientY - sr.top > this._g.gy - this._H * 0.3;
      if (meadow && this._clingy() && this._petFree() && Math.random() < 0.6) {
        this._comeX = clamp(x, this._g.pW * 0.5, this._W - this._g.pW * 0.5);
        this._touchNext('comeHere');
      } else if (!p.classList.contains('tilt') && Math.random() < 0.35) {
        this._cls('tilt', 1400);
        if (Math.random() < 0.5) this._emote('q', 1400);
      }
    }

    // ---------- Wiese ----------

    _initFlowers() {
      for (let i = 0; i < 5; i++) this._addFlower(false);
    }

    _addFlower(grow = true, at = null) {
      const { fMin, fMax } = this._g;
      let xf = at == null ? null : clamp(at, fMin, fMax);
      for (let tries = 0; xf == null || (at == null && tries < 12); tries++) {
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

    // Erst an der Blüte schnuppern (Nase wackelt, Kopf tief), dann pflücken
    async _sniffPick(f) {
      const p = this._el.pika;
      p.classList.add('sniff');
      await this._wait(rnd(600, 900));
      p.classList.remove('sniff');
      this._pickFlower(f);
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

    // Vorrat aus dem Tagesplan zeigen; wippt, wenn ein Bündel dazukam
    _hayFromPlan() {
      if (!this._el) return;
      const { n, c } = hayNow(this._plan.hay, this._haNow());
      const pal = this._areal().flowers || FLOWER_COLORS;
      const key = `${n}|${c}|${this._arealKey}`;
      if (key === this._hayKey) return;
      const more = this._hayKey != null && n > this._hay;
      this._hayKey = key;
      this._hay = n;
      this._blooms = [...c].slice(-STASH_MAX).map((d, i) => ({ color: pal[Number(d) % pal.length], ...this._haySpot(i) }));
      this._renderHay(more);
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
      // Mitternacht an Neujahr: Finale, und der Pika wacht auf und schaut aus dem Bau. Nur sichtbar: sonst liefe es
      // ungesehen ab, und wer den Bildschirm um 0:03 einschaltet, bekäme keins mehr
      if (f.fireworks && !this._away() && this._g && now.getMonth() === 0 && now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 5
        && this._festMidY !== now.getFullYear()) {
        this._festMidY = now.getFullYear();
        this._festFinale();
        this._festForce('festFireworks');
      }
      if (this._away() || !this._g) return;
      // Halloween-Nacht: ab und zu flattert eine Fledermaus über den Himmel
      if (f.witch && this._festDark() && Math.random() < 0.35) this._festBat();
      // Karneval: alle paar Minuten kurz Konfetti, aber nur, wenn er wach ist, es hell und trocken ist (nachts
      // sähe es keiner, im Regen passt es nicht; fällig gebliebenes kommt, sobald es wieder passt)
      const party = !this._asleep && !this._festDark() && !this._wx.wet;
      if (f.karneval) {
        const t = Date.now();
        this._festCfNext ??= t + rnd(5, 30) * 1000;
        if (t >= this._festCfNext && party) {
          this._festConfettiRain();
          this._festCfNext = t + rnd(2, 5) * 60000;
        }
      } else this._festCfNext = null;
      // 11. 11. um 11:11: Auftakt der Karnevalszeit, einmal kurz Konfetti und „Helau!“ (der 20-s-Takt trifft das
      // Fenster bis 11:13 sicher)
      if (this._cfg?.festive !== false && now.getMonth() === 10 && now.getDate() === 11 && now.getHours() === 11
        && now.getMinutes() >= 11 && now.getMinutes() < 14 && this._festKickY !== now.getFullYear() && party && !this._wx.shelter) {
        this._festKickY = now.getFullYear();
        if (this._inside || this._lift > 0) {
          this._festConfettiRain();
          this._say('Helau!', 1500);
        } else this._festForce('festConfetti');
      }
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

    // Uhr von HA: Feuerwerk, Finale und „Helau!“ kommen auf allen Geräten im selben Moment
    _festNow() {
      return this._dbgDate ?? this._haNow();
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

    // Beginn eines Abendfensters (Minuten nach Mitternacht): zur Uhrzeit at, bei früher Schlafenszeit (Standard:
    // Sonnenuntergang, im November gegen halb fünf) aber schon lead Minuten davor. Sonst verschliefe er Laternenumzug
    // und leeren Stiefel. Geht er erst nach Mitternacht schlafen, bleibt es bei at.
    _festEve(now, at, lead) {
      if (!this._cfg) return at;
      const bed = (this._wakeDay(now)[1] - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 60000;
      return Math.min(at, bed - lead);
    }

    // Aktive Feste am (Orts-)Datum. festive: false lässt nur die Geburtstage übrig.
    _festToday(at = this._festNow()) {
      const now = new Date(at);
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
        if (md === 1111) f.martin = { walk: hm >= this._festEve(now, 16 * 60, 90) };
        const adv = festAdvent1(y);
        if (day >= adv && md <= 1224) f.advent = { candles: Math.min(4, 1 + Math.floor((day - adv) / 7)) };
        if (day >= adv || md <= 106) f.lights = true; // Lichterkette vom 1. Advent bis Heilige Drei Könige
        if ((md === 1205 && hm >= this._festEve(now, 18 * 60, 120)) || md === 1206) f.boot = { full: md === 1206 };
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
      // Geburtstage: der 29. 2. wird sonst am 28. 2. gefeiert. Lesen: festBirthdate (unbekannt: einmal warnen)
      const leap = new Date(y, 1, 29).getMonth() === 1;
      const names = (Array.isArray(this._cfg?.birthdays) ? this._cfg.birthdays : []).filter((b) => {
        const md2 = festBirthdate(b?.date);
        if (!md2) {
          const k = `${b?.name}|${b?.date}`;
          if (!(this._festWarned ||= new Set()).has(k)) {
            this._festWarned.add(k);
            console.warn(`pika-pet-card: Geburtstag ${b?.name ?? '?'}: Datum "${b?.date}" nicht erkannt (MM-TT, JJJJ-MM-TT, TT.MM. oder TT.MM.JJJJ)`);
          }
          return false;
        }
        let [bm, bd] = md2;
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
    // hinter dem Bau; Statusleiste links oben und die Knöpfe rechts oben bleiben frei.
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
      // Jede Bodendeko hat ihren festen Platz, damit sie nicht von Tag zu Tag woandershin wandert: Kürbis und
      // Stiefel vor dem Stein (M, an Weihnachten steht dort der Baum), Adventskranz vor dem Bau rechts neben der
      // Tür (R). Der Kuchen steht ebenfalls dort, im Advent links neben der Tür (L; vorn links stehen sonst die
      // Haus-Bote-Geräte, die ihm ausweichen).
      if (f.xmas) used.add('M');
      if (f.halloween) ground('fpump', ['M', 'R', 'L'], gy + 1, H * 0.14, FEST_PUMPKIN, 'pumpkin');
      if (f.boot) ground('fboot', ['M', 'R', 'L'], gy + 1, H * 0.11, FEST_BOOT(f.boot.full), 'boot');
      if (f.advent) ground('fwreath', ['R', 'L', 'M'], gy, H * 0.2, FEST_WREATH(f.advent.candles), 'wreath');
      if (f.birthday) ground(`fcake${this._festCakeOut ? ' out' : ''}`, ['R', 'L', 'M'], gy + 1, H * 0.14, FEST_CAKE, 'cake');
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
      // Wiese für Eier und Raketenstäbe: rechts neben der Tür bis kurz vor den rechten Rand, ohne die Stellen, an
      // denen schon Deko steht (Kuchen, Geschenk …). free(u, m): Stelle u ∈ [0, 1] entlang der freien Strecke,
      // m = halbe Breite des Teils plus Abstand. Ist alles belegt, gilt die ganze Strecke (lieber eng als gar nicht).
      const lo = hole.r + H * 0.12;
      const hi = Math.max(lo + H * 0.3, Math.min(W - 10, rock.l + rock.w * 0.75));
      const taken = Object.values(pos);
      const free = (u, m) => {
        let segs = [[lo, hi]];
        for (const p of taken) {
          const a = p.l - m;
          const b = p.l + p.w + m;
          segs = segs.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e]] : [[s, a], [b, e]].filter(([s2, e2]) => e2 - s2 > 1)));
        }
        const len = segs.reduce((t, [s, e]) => t + e - s, 0);
        if (!len) return lo + (hi - lo) * u;
        let k = u * len;
        for (const [s, e] of segs) {
          if (k <= e - s) return s + k;
          k -= e - s;
        }
        return hi;
      };
      const eggX = [];
      if (f.ostern) {
        const n = 4 + Math.floor(seeded(f.year, 7) * 3);
        for (let i = 0; i < n; i++) {
          const r = (k) => seeded(f.year, i, k);
          const x = free((i + 0.2 + 0.6 * r(1)) / n, H * 0.05);
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
          const x = free(t + (seeded(f.year, 31, i) - 0.5) * 0.1, H * 0.12);
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
      // Bewegung reduzieren: keine Fledermäuse
      if (!sky || !this._g || calmMotion()) return;
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
      const on = !!this._fest?.fireworks && this._attached && !this._away() && !!this._g;
      if (on && !this._festFwT) {
        const go = () => {
          this._festRocket();
          this._festFwT = setTimeout(go, calmMotion() ? rnd(9000, 16000) : rnd(3000, 8000));
        };
        this._festFwT = setTimeout(go, rnd(400, 1500));
      } else if (!on && this._festFwT) {
        clearTimeout(this._festFwT);
        this._festFwT = null;
      }
    }

    // Finale: 10 Raketen in etwa 6 s (gleichzeitig höchstens vier, fünf Kugeln); Bewegung reduzieren: drei
    _festFinale() {
      let t = 0;
      for (let i = 0, n = calmMotion() ? 3 : 10; i < n; i++) {
        t += rnd(400, 900);
        this._festLater(() => this._festRocket(), t);
      }
    }

    _festRocket() {
      const sky = this._festEls?.sky;
      if (!sky || !this._g || this._away()) return;
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
      // Schweif (zeigt im Element nach unten) entgegen der Flugrichtung: nach rechts oben → Schweif nach links unten
      const ang = (Math.atan2(x1 - x0, y0 - y1) * 180) / Math.PI;
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
      // Unsichtbar geworden, während die Rakete noch stieg: keine Kugel mehr ins Leere
      if (!sky || this._away()) return;
      const H = this._H;
      const calm = calmMotion();
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
      // Sternchen und Funken (leuchten über einen Verlauf statt box-shadow, das spart dem Tablet das Weichzeichnen);
      // Bewegung reduzieren: nur das sanfte Aufleuchten in der Mitte
      const n = calm ? 0 : 11 + Math.floor(rnd(0, 4));
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
      for (let i = 0; i < (calm ? 0 : 6); i++) {
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
      // Vom Knall erschreckt: ein Vögelchen, das gerade sitzt, fliegt davon
      if (this._bird?.sitting) this._bird.scare();
    }

    _festConfettiRain() {
      const box = this._festEls?.cf;
      if (!box || !this._g || this._away()) return;
      const { gy } = this._g;
      const W = this._W;
      const H = this._H;
      // Bewegung reduzieren: nur ein paar Schnipsel, die ohne Drehen langsam herabsinken
      const calm = calmMotion();
      for (let i = 0; i < (calm ? 8 : 46); i++) {
        const c = document.createElement('i');
        const w = H * rnd(0.014, 0.022);
        c.style.left = `${rnd(-2, 100).toFixed(1)}%`;
        c.style.width = `${festF1(w)}px`;
        c.style.height = `${festF1(w * (Math.random() < 0.3 ? 1 : rnd(1.5, 2.2)))}px`;
        c.style.borderRadius = Math.random() < 0.3 ? '50%' : '1px';
        c.style.background = pick(FEST_COLORS);
        box.appendChild(c);
        const dx = rnd(-0.06, 0.06) * W;
        const dur = calm ? rnd(6000, 8000) : rnd(2600, 4200);
        const delay = rnd(0, 1600);
        c.animate(calm ? [
          { transform: 'translate(0, -14px)' },
          { transform: `translate(${festF1(dx * 0.3)}px, ${festF1(gy + 6)}px)` },
        ] : [
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
      // Bei Starkregen und Gewitter bleibt er auch wach im Bau und schaut nur heraus (wie im Schlaf); steht er
      // dabei draußen, schaut er von dort aus zu, statt zur Wiese zu laufen
      const storm = !!this._wx.shelter;
      const peek = sleeping || (storm && this._inside);
      this._festBang = () => this._festZuck();
      try {
        if (peek) {
          p.classList.remove('sleeping');
          await this._to('peek', 900);
          this._say('!', 900);
          await this._wait(900);
        } else if (storm) {
          if (this._lift > 0) await this._hopDown();
          this._face(1);
        } else {
          if (this._lift > 0) await this._hopDown();
          if (this._inside) await this._comeOut();
          await this._walkTo(this._g.home + this._g.pW * 0.8, 0.9);
          this._face(1);
        }
        p.classList.add('look-up');
        await this._wait(900);
        // Vor Mitternacht (ab 23:55) wird noch nicht gratuliert
        const ny = () => new Date(this._festNow()).getMonth() === 0;
        this._say(ny() ? 'Frohes Neues!' : pick(['gleich!', 'bald ist Neujahr!', 'ohh!']), 2400);
        const until = Date.now() + rnd(35000, 50000);
        let again = true;
        while (Date.now() < until && this._fest?.fireworks) {
          await this._wait(rnd(2500, 5000));
          const r = Math.random();
          if (r < 0.25) this._say(pick(['ohh!', 'wuiii!', 'oh!']), 1100);
          else if (r < 0.4 && again && ny()) {
            again = false;
            this._say('Frohes Neues!', 2200);
          } else if (r < 0.55 && !peek) this._face(-this._dir);
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
      if (!this._attached || this._away() || this._critOn) return;
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
          this._critT[kind] = null;
          const late = this._visitNow() - nx.at;
          // Die Uhr wurde inzwischen zurückgestellt (Abgleich mit HA): noch nicht so weit, neu planen
          if (late < -500) return plan(kind, after);
          this._critLast[kind] = nx.at;
          if (late <= critJoin(kind, nx.pick)) await this._visit(kind, id, false, nx.pick, Math.max(0, late));
          if (id === this._critId) plan(kind, nx.at);
        }, Math.max(0, nx.at - now));
      };
      this._critPlan = plan;
      for (const k of CRIT_KINDS) plan(k, this._critLast[k]);
    }

    // Die gemeinsame Uhr wurde nachgestellt: wartende Besuche und den Beginn der nächsten Beschäftigung neu planen
    // (wer gerade zu Besuch ist, bleibt; danach wird ohnehin mit der neuen Uhr geplant)
    _clockMoved() {
      if (this._critOn && this._critPlan) {
        for (const k of CRIT_KINDS) {
          if (!this._critT[k]) continue;
          clearTimeout(this._critT[k]);
          this._critPlan(k, this._critLast[k]);
        }
      }
      if (this._running) {
        this._slotNext = null;
        this._slotArm();
      }
    }

    // Uhr der Besuche: Uhr von HA (Vorschau: um _dbgShiftMs vorgestellt). Nicht _dbgDate, das steht fest.
    _visitNow() {
      return this._haNow() + this._dbgShiftMs;
    }

    // Nächster Besuch von kind (bird, mouse, frog, snail), der noch läuft (critJoin) und nach after liegt:
    // { at: Startzeit, pick: feste Entscheidungen }. Gleiche Uhr → gleiches Ergebnis auf allen Geräten.
    _critNext(kind, now, after = -Infinity) {
      const { win, p, room } = CRIT[kind];
      for (let k = Math.floor(Math.max(now - CRIT_BACK, after + 1) / win); ; k++) {
        if (seedRnd(kind, k, 0) >= p) continue;
        const at = k * win + Math.floor(seedRnd(kind, k, 1) * (win - room));
        if (at <= after) continue;
        const pick = this._critPick(kind, (n) => seedRnd(kind, k, n));
        if (at < now - critJoin(kind, pick)) continue;
        return { at, pick };
      }
    }

    // Was beim Besuch feststeht; r(n) liefert Zahlen in [0, 1) (seedRnd fürs Fenster, Vorschau-Knöpfe: Math.random)
    _critPick(kind, r) {
      if (kind === 'bird') {
        return { bird: Math.floor(r(2) * BIRDS.length), spot: r(3), rockX: 35 + r(4) * 30,
          side: r(5) < 0.5 ? -1 : 1, out: r(6) < 0.5 ? -1 : 1, stay: 15000 + r(7) * 30000, alt: r(8) };
      }
      // Frosch: wie weit auf die Wiese und wie lange; Schnecke: Hausfarbe und wie weit
      if (kind === 'frog') return { x: r(2), stay: 12000 + r(3) * 14000 };
      if (kind === 'snail') return { shell: Math.floor(r(2) * SNAILS.length), far: r(3) };
      const k = r(2); // seitlich : oben : auf die Wiese = 2 : 1 : 5 (auf der Wiese sieht man sie am besten)
      return { kind: k < 0.25 ? 'side' : k < 0.375 ? 'top' : 'run', x: 30 + r(3) * 40 };
    }

    _stopCritters() {
      this._critOn = false;
      this._critId++;
      Object.values(this._critT).forEach((t) => clearTimeout(t));
      this._critT = {};
      for (const k of CRIT_KINDS) {
        const c = this['_' + k];
        // Wer gerade zu Besuch ist, kommt beim Weitermachen für den Rest wieder (kurz weggescrollt, Bildschirm
        // aus und an, neue Größe), solange sein Besuch noch läuft. Verscheucht bleibt verscheucht.
        if (c && !c.scared && this._critLast) delete this._critLast[k];
        c?.el.remove();
        this['_' + k] = null;
      }
    }

    // Neue Größe oder neues Areal: wer gerade zu Besuch ist, kommt gleich wieder (falls sein Besuch noch läuft,
    // siehe _stopCritters); wer schon fertig war, nicht noch einmal
    _restartCritters() {
      this._stopCritters();
      this._startCritters();
    }

    // Vögel kommen nur bei Tag, Vögel und Maus nicht bei Regen oder Gewitter. Frosch und Schnecke kommen nur bei
    // Regen (auch nachts und bei Starkregen), aber nicht bei Gewitter, Schneeregen oder unter 3 °C.
    _critterWeather(kind) {
      const wx = this._wx;
      if (!this._g) return false;
      if (kind === 'frog' || kind === 'snail') return wx.rain > 0 && !wx.snow && !wx.flash && !wx.cold;
      if (wx.wet || wx.storm) return false;
      if (kind === 'mouse') return true;
      const e = this._dbgElev ?? this._elev;
      return e == null ? !this._asleep : e > 3;
    }

    // pk: feste Entscheidungen aus _critNext (ohne: Zufall, Vorschau-Knöpfe); late: so viele ms nach dem Start
    async _visit(kind, id, force = false, pk = null, late = 0) {
      if (!this._g || this['_' + kind]) return;
      if (!force && !this._critterWeather(kind)) return;
      pk ??= this._critPick(kind, () => Math.random());
      try {
        await this[`_${kind}Visit`](id, force, pk, late);
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
    async _mouseVisit(id, force, pk, late = 0) {
      const { rock, gy, pW } = this._g;
      const mw = this._H * 0.15;
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
      // Umhängen setzt den Stil zurück: gleich neu berechnen, sonst spränge sie ohne Übergang ans nächste Ziel
      const layer = (front) => {
        (front ? this._el.miceF : this._el.mice).appendChild(el);
        void el.offsetWidth;
      };
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
      // Später eingestiegen (Bildschirm an, Neuladen): so viel Herumschauen weglassen, dass sie etwa zur selben
      // Zeit wie auf den anderen Geräten wieder verschwindet
      let behind = late;
      const lookAround = async (n) => {
        for (let i = 0; i < n; i++) {
          if (behind > 0) {
            behind -= 950;
            continue;
          }
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
            await lookAround(4 + Math.floor(rnd(0, 4)));
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
            await lookAround(kind === 'run' ? 1 + Math.floor(rnd(0, 2)) : 4 + Math.floor(rnd(0, 4)));
            if (kind === 'run') {
              // raus auf die Wiese, schnuppern, Männchen machen, zurück
              const minX = Math.max(this._g.fMin * this._W, mw);
              await run(door);
              layer(true);
              m.out = true;
              await run(rnd(minX, Math.max(minX, door - mw * 0.7)));
              this._noticeCritter(m.x, false);
              await lookAround(2);
              if (Math.random() < 0.8) {
                face(this._x >= m.x ? 1 : -1);
                pose('stand', true);
                await step(rnd(1200, 2400));
                pose('stand', false);
              }
              await lookAround(2 + Math.floor(rnd(0, 3)));
              // ein, zwei Stückchen weiter über die Wiese, schnuppern
              for (let n = Math.random() < 0.5 ? 2 : 1; n > 0; n--) {
                await run(clamp(m.x + rnd(-1, 1) * mw * 2.5, minX, door), 0.8);
                await lookAround(1 + Math.floor(rnd(0, 3)));
              }
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

    // Frosch (nur bei Regen): hüpft hinter dem Aussichtsstein hervor auf die Wiese, sitzt da, quakt, schnappt mit der
    // Zunge nach Tropfen und hüpft zurück. Antippen oder ein zu naher Pika: „quak!“ und mit großen Sätzen davon.
    async _frogVisit(id, force, pk, late = 0) {
      const { rock, gy, pW } = this._g;
      const fw = this._H * 0.13;
      const el = document.createElement('div');
      el.className = 'frog left';
      el.innerHTML = `<div class="cw" role="button" aria-label="Frosch"><div class="cf"><div class="cb">${FROG_SVG}</div></div></div>`;
      const yG = gy - this._H * 0.02; // knapp hinter dem Pika
      const f = this._critter({ el, x: 0, y: yG, w: fw, dir: -1, out: false });
      el.querySelector('.cw').addEventListener('click', (e) => (e.stopPropagation(), f.scare()));
      this._frog = f;
      this._el.mice.appendChild(el);

      const edge = rock.l + 7 * rock.ku; // linke Steinkante
      const hideX = edge + fw * 0.8;
      const door = edge - fw * 0.6; // neben dem Stein: hier wechselt er zwischen hinterer und vorderer Ebene
      const minX = Math.min(Math.max(this._g.fMin * this._W, fw), door);
      const maxX = Math.max(minX, door - fw * 0.7);
      // Umhängen setzt den Stil zurück: gleich neu berechnen, sonst spränge das nächste Stück ohne Übergang ans Ziel
      const layer = (front) => {
        (front ? this._el.miceF : this._el.mice).appendChild(el);
        void el.offsetWidth;
      };
      const face = (d) => ((f.dir = d), el.classList.toggle('left', d < 0));
      const move = (x, ms = 0) => {
        el.style.transition = ms ? `transform ${ms}ms linear` : 'none';
        el.style.transform = `translate(${x.toFixed(1)}px, ${yG.toFixed(1)}px)`;
        f.x = x;
        if (!ms) void el.offsetWidth;
      };
      // Warten; kommt der Pika zu nah, erschrickt er
      const FLEE = {};
      const step = async (ms) => {
        await this._cw(id, ms, f);
        if (f.out && Math.abs(this._liveX() - f.x) < pW * 0.55) f.scare();
        if (f.scared) throw FLEE;
      };
      // In Sätzen bis x. fast: große, schnelle Sätze auf der Flucht (dann erschrickt er nicht noch einmal)
      const hop = async (x, fast = false) => {
        const L = this._H * (fast ? 0.34 : 0.22);
        while (Math.abs(x - f.x) > 1) {
          const d = clamp(x - f.x, -L, L);
          const k = Math.abs(d) / L;
          face(d > 0 ? 1 : -1);
          const ms = (fast ? 240 : 320) + k * 90;
          el.style.setProperty('--hd', `${ms}ms`);
          el.style.setProperty('--fh', `${-Math.round(40 + 80 * k)}%`);
          el.classList.add('leap');
          move(f.x + d, ms);
          await (fast ? this._cw(id, ms) : step(ms));
          el.classList.remove('leap');
          await (fast ? this._cw(id, 50) : step(rnd(140, 420)));
        }
      };
      // Nicht auf der Schnecke sitzen: liegt x zu nah an ihr, den Platz daneben nehmen (auf der Seite, wo Wiese ist)
      const free = (x) => {
        const s = this._snail;
        if (!s?.out || Math.abs(x - s.x) >= fw) return x;
        const side = (x < s.x && s.x - fw * 1.1 >= minX) || s.x + fw * 1.1 > maxX ? -1 : 1;
        return clamp(s.x + side * fw * 1.1, minX, maxX);
      };
      try {
        try {
          move(hideX);
          await step(60);
          await hop(door);
          layer(true);
          f.out = true;
          await hop(free(maxX - pk.x * Math.min(maxX - minX, this._H * 0.7)));
          this._noticeCritter(f.x, false);
          const until = Date.now() + Math.max(3000, pk.stay - late);
          // angekommen quakt er gleich, danach, was ihm einfällt
          let act = 'croak';
          let gap = 500;
          while (Date.now() < until && (force || this._critterWeather('frog'))) {
            await step(gap);
            // die Schnecke ist herangekrochen: zur Seite hüpfen
            if (free(f.x) !== f.x) await hop(free(f.x));
            else if (act === 'croak') {
              for (let n = Math.random() < 0.4 ? 2 : 1; n > 0; n--) {
                this._croak(f);
                await step(1050);
              }
            } else if (act === 'turn') face(-f.dir);
            else if (act === 'zap') {
              el.classList.add('zap');
              await step(400);
              el.classList.remove('zap');
            } else await hop(free(clamp(f.x + rnd(0.8, 2) * fw * pick([-1, 1]), minX, maxX)));
            act = weighted([[3, 'croak'], [2, 'turn'], [2, 'hop'], [1.5, 'zap']]);
            gap = rnd(900, 2400);
          }
          await hop(door);
          f.out = false;
          layer(false);
          await hop(hideX);
        } catch (e) {
          if (e !== FLEE) throw e;
          // „quak!“ und mit großen Sätzen zurück hinter den Stein
          const t = getComputedStyle(el).transform;
          move(t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : f.x);
          el.classList.remove('leap', 'croak', 'zap');
          f.out = false;
          this._peep(f.x, yG - fw * 0.95, 'quak!');
          await this._cw(id, 120);
          if (el.parentNode === this._el.miceF) {
            await hop(door, true);
            layer(false);
          }
          await hop(hideX, true);
          await this._cw(id, 200);
        }
      } finally {
        if (this._frog === f) this._frog = null;
        el.remove();
      }
    }

    // Schallblase bläht sich zweimal, „quak!“ steigt auf
    _croak(f) {
      if (!f?.out || f.scared) return;
      const el = f.el;
      el.classList.remove('croak');
      void el.offsetWidth;
      el.classList.add('croak');
      clearTimeout(f.croakT);
      f.croakT = setTimeout(() => el.classList.remove('croak'), 950);
      this._peep(f.x + f.dir * f.w * 0.3, f.y - f.w * 0.85, pick(['quak!', 'quak!', 'quaak!']));
    }

    // Schnecke (nur bei Regen): kriecht hinter dem Aussichtsstein hervor ein Stück über die Wiese, reckt die Fühler,
    // schaut sich um und kriecht zurück. Weglaufen kann sie nicht: Antippen oder ein naher Pika, und sie zieht sich
    // ins Haus zurück; nach ein paar Sekunden kommt sie wieder heraus.
    async _snailVisit(id, force, pk, late = 0) {
      const { rock, gy, pW } = this._g;
      const sw = this._H * 0.12;
      const v = this._H * 0.035; // Kriechtempo in px/s
      const el = document.createElement('div');
      el.className = 'snail left';
      el.innerHTML = `<div class="cw" role="button" aria-label="Schnecke"><div class="cf"><div class="cb">${SNAIL_SVG(SNAILS[pk.shell])}</div></div></div>`;
      const yG = gy - this._H * 0.02;
      const s = { el, x: 0, y: yG, dir: -1, out: false, hidden: false, poked: false };
      const wob = () => {
        el.classList.remove('wob');
        void el.offsetWidth;
        el.classList.add('wob');
      };
      // Anstupsen (Antippen, Pika-Nase): ins Haus; ist sie schon drin, wackelt es und sie bleibt länger
      s.poke = () => {
        s.poked = true;
        if (s.hidden) wob();
      };
      el.querySelector('.cw').addEventListener('click', (e) => (e.stopPropagation(), s.poke()));
      this._snail = s;
      this._el.mice.appendChild(el);

      const edge = rock.l + 7 * rock.ku; // linke Steinkante
      const hideX = edge + sw * 0.8;
      const door = edge - sw * 0.6; // neben dem Stein: Wechsel zwischen hinterer und vorderer Ebene
      const minX = Math.min(Math.max(this._g.fMin * this._W, sw), door);
      // Umhängen setzt den Stil zurück: gleich neu berechnen, sonst spränge das nächste Stück ohne Übergang ans Ziel
      const layer = (front) => {
        (front ? this._el.miceF : this._el.mice).appendChild(el);
        void el.offsetWidth;
      };
      const face = (d) => ((s.dir = d), el.classList.toggle('left', d < 0));
      const liveX = () => {
        const t = getComputedStyle(el).transform;
        return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : s.x;
      };
      // Ohne Dauer steht sie sofort dort; mit Dauer kriecht sie hin (s.x folgt in wait)
      const put = (x, ms = 0) => {
        el.style.transition = ms ? `transform ${ms}ms linear` : 'none';
        el.style.transform = `translate(${x.toFixed(1)}px, ${yG.toFixed(1)}px)`;
        if (!ms) {
          s.x = x;
          void el.offsetWidth;
        }
      };
      // Vor einem nahen Pika erschrickt sie einmal; erst wenn er wieder weg war, beim nächsten Mal wieder
      let shy = true;
      const near = () => {
        const n = s.out && Math.abs(this._liveX() - s.x) < pW * 0.6;
        const hit = n && shy;
        shy = !n;
        return hit;
      };
      // In kleinen Schritten warten; true: angestupst oder der Pika kam zu nah
      const wait = async (ms) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
          await this._cw(id, clamp(end - Date.now(), 20, 200));
          s.x = liveX();
          if (s.poked || near()) return true;
        }
        return false;
      };
      const hide = async () => {
        put(liveX());
        el.classList.remove('crawl', 'peer');
        el.classList.add('hide');
        s.hidden = true;
        do {
          s.poked = false;
          await this._cw(id, rnd(2600, 4200));
        } while (s.poked);
        el.classList.remove('hide', 'wob');
        s.hidden = false;
        near(); // steht der Pika noch da, erschrickt sie davor nicht gleich wieder
        await this._cw(id, 900);
      };
      const crawl = async (x) => {
        while (Math.abs(x - s.x) > 1) {
          face(x > s.x ? 1 : -1);
          const ms = (Math.abs(x - s.x) / v) * 1000;
          el.classList.add('crawl');
          put(x, ms);
          const hit = await wait(ms);
          el.classList.remove('crawl');
          if (hit) await hide();
          else put(x);
        }
      };
      const rest = async (ms) => {
        el.classList.add('peer');
        while (await wait(ms)) {
          await hide();
          el.classList.add('peer');
          ms = 1500;
        }
        el.classList.remove('peer');
      };
      try {
        put(hideX);
        await this._cw(id, 60);
        await crawl(door);
        layer(true);
        s.out = true;
        this._noticeCritter(s.x, false);
        await crawl(door - (0.3 + 0.6 * pk.far) * Math.min(door - minX, this._H * 0.7));
        // Fühler recken und umschauen (später eingestiegen: kürzer)
        await rest(Math.max(1500, rnd(5000, 9000) - late));
        await crawl(door);
        s.out = false;
        layer(false);
        await crawl(hideX);
      } finally {
        if (this._snail === s) this._snail = null;
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

    // Begrüßen und Verabschieden dauern nur Sekunden und gehen sogar der Beschäftigung aus dem Tagesplan vor;
    // sonst verpasste er Pino, solange er liest oder malt (der Abschied gilt nur 15 s)
    _friendUrgent() {
      const bye = this._frBye;
      if (bye && !bye.done && Date.now() < bye.until) return 'byeFriend';
      const fr = this._fr;
      return fr && fr.arrived && !fr.leaving && !fr.greeted ? 'greetFriend' : null;
    }

    _friendActs(ctx) {
      const bye = this._frBye;
      if (bye && !bye.done && Date.now() < bye.until) return [[80, 'byeFriend']];
      const fr = this._fr;
      if (!fr || !fr.arrived || fr.leaving) return [];
      if (!fr.greeted) return [[80, 'greetFriend']];
      // In den letzten 10 s des Besuchs kein neues Spiel mehr: sonst hängte der Pika ein Spiel ans andere, Pinos
      // Ablauf (prüft fr.until nur zwischen den Spielen) käme nicht zum Gehen, und jedes Gerät verabschiedete
      // ihn zu einer anderen Zeit
      if (Date.now() >= fr.until - 10000) return [];
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
      return !!this._cfg?.friend && !!this._attached && !this._away();
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

    // Pino ist auf einem anderen Gerät vor der Zeit gegangen: hier geht er auch und kommt in dem Fenster nicht wieder
    _friendFromPlan() {
      const fu = this._plan?.fu || 0;
      if (!this._el || fu <= (this._frUsed || 0)) return;
      this._frUsed = fu;
      const fr = this._fr;
      if (fr && !fr.leaving && fu > this._visitNow()) this._friendLeave(true);
    }

    _friendStop() {
      clearTimeout(this._frT);
      this._frT = null;
      this._frBye = null; // sonst verabschiedete er sich später von einem Pino, der gar nicht mehr da ist
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
      el.querySelectorAll('.book, .gb, .tab, .kpaw, .bk, .brolly, .cap, .cup, .cfoam, .rope, .band, .arms, .uke, .brush, .wand, .rgrip, .bar, .wpaw, .slg, .gspy, .gcan, .shades').forEach((n) => n.remove());
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
      this._giftBell();
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
      if (!s.nextInMs) {
        this._frUsed = Math.max(this._frUsed || 0, this._visitNow() + s.stayMs);
        // Vor der Zeit gegangen: gilt für alle Geräte (_friendFromPlan)
        if (now) this._planOp({ t: 'frgone', u: Math.ceil(this._frUsed / 1000) * 1000 });
      }
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
      // Rechts wie beim Pika (xR) ganz im Bild bleiben
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
      this._bubbleFit(fr.say, x, this._g.pW * FRIEND_SCALE);
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
      this._bubbleFit(fr.say, fr.x, this._g.pW * FRIEND_SCALE);
    }

    _frJump(fr, kind) {
      if (kind === 'binky' && calmMotion()) kind = 'hop1';
      const j = [fr.jump, fr.el.querySelector('.shadow')];
      for (const el of j) el.classList.remove('hop1', 'binky');
      void j[0].offsetWidth;
      for (const el of j) el.classList.add(kind);
      clearTimeout(fr.jumpT);
      fr.jumpT = setTimeout(() => j.forEach((el) => el.classList.remove(kind)), 1000);
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
      // Der Pika kommt nur bis xR (_walkTo klemmt dort), und Pino soll auch beim Stupsen nicht hinter den Knöpfen stehen
      const max = Math.max(min, d > 0 ? Math.min(this._g.xR, this._frRange()[1] - gap) : this._g.xR);
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
      this._memo('pino');
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
        this._selfFed(SELF.flower);
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
      const t = this._stats[k + 't'];
      const now = this._haNow();
      // Wird oft gefragt (Balken, Auswahl der Aktionen): je Sekunde einmal rechnen
      const key = `${t}|${Math.floor(now / 1000)}|${this._wdSig}`;
      const M = (this._rawM ??= {});
      if (M[k]?.key !== key) M[k] = { key, h: this._decayH(t, now) };
      return clamp(this._stats[k] - M[k].h * RATE[k], 0, 100);
    }

    // Abbau-Stunden zwischen t1 und t2: wach voll, im Schlaf SLEEP_DECAY (Wachfenster wie bei Schlafenszeit und Häufchen)
    _decayH(t1, t2) {
      if (!(t2 > t1)) return (t2 - t1) / 3.6e6; // Stand aus der Zukunft (Uhr): gleichmäßig
      const aw = this._awakeMs(t1, t2);
      return (aw + SLEEP_DECAY * (t2 - t1 - aw)) / 3.6e6;
    }

    // Umkehrung: wann ab t h Abbau-Stunden vergangen sind (wann ein Wert unter eine Grenze fällt)
    _decayAt(t, h) {
      return this._awakeAdd(t, h * 3.6e6, SLEEP_DECAY);
    }

    // Glück ist durch Schmutz gedeckelt: bei 0 % sauber höchstens 60 %. Streicheln zählt trotzdem
    // weiter, nach dem Putzen zeigt der Balken dann den vollen Wert.
    _get(k) {
      const v = this._raw(k);
      return k === 'g' ? Math.min(v, 60 + 0.4 * this._poops().clean) : v;
    }

    // Satt durch selbst Gefressenes, höchstens bis SELF_MAX
    _selfFed(d) {
      const room = SELF_MAX - this._raw('s');
      if (room > 0) this._add('s', Math.min(d, room), true);
    }

    // self: zählt nicht als Pflege (selbst gefressen, Inhalt eines Päckchens). Füttern, Streicheln, Putzen kommen von dir
    // und zählen: Ist danach alles wieder über GIFT.min, endet die Lücke in der Pflege-Serie.
    _add(k, d, self = false) {
      this._careEval(); // vorher: lag schon etwas unter GIFT.min, steht es damit fest
      if (!this._stats) this._stats = freshStats(this._haNow());
      this._stats[k] = clamp(this._raw(k) + d, 0, 100);
      this._stats[k + 't'] = this._haNow();
      this._gain[k] += d; // noch nicht gesendet (für das Zusammenführen mit fremden Ständen)
      this._renderStats();
      this._save();
      if (!self) this._careEval(true);
    }

    // Alles, was dieses Gerät gewonnen, aber HA noch nicht bestätigt hat (ungesendet + unterwegs)
    _sentGain() {
      const g = { ...this._gain };
      for (const e of this._sent) {
        g.s += e.gain.s;
        g.g += e.gain.g;
        g.c ||= e.gain.c;
      }
      return g;
    }

    // Ein Schreiben ging verloren (Fehler, keine Bestätigung): seinen Gewinn zurücknehmen und neu senden. Gemerkt
    // (30 Min), falls sein Echo doch noch kommt (siehe set hass).
    _sentLost(e) {
      const i = this._sent.indexOf(e);
      if (i < 0) return;
      this._sent.splice(i, 1);
      const now = Date.now();
      this._lostW = [...(this._lostW || []).filter((l) => now - l.at < 30 * 6e4), { v: e.v, gain: e.gain, at: now }].slice(-8);
      this._gain.s += e.gain.s;
      this._gain.g += e.gain.g;
      this._gain.c ||= e.gain.c;
      this._save();
    }

    // Gewinn g ist doch schon in HA: aus dem Ungesendeten und den unbestätigten Schreiben (neueste zuerst) nehmen
    _gainSub(g) {
      for (const k of ['s', 'g']) {
        let r = g[k];
        for (const o of [this._gain, ...this._sent.map((e) => e.gain).reverse()]) {
          if (!(r > 0)) break;
          const d = Math.min(r, o[k]);
          if (d > 0) {
            o[k] -= d;
            r -= d;
          }
        }
      }
    }

    _save() {
      this._pendingWrite = true;
      this._saveWait = false;
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => {
        const v = serialize(this._stats);
        if (this._cfg.entity && !this._noEntity) {
          // Stand aus HA noch nicht da (Start, unavailable): warten, beim Eintreffen wird zusammengeführt
          if (!this._synced || !this._hass) return;
          const id = this._cfg.entity;
          const st = this._hass.states[id]?.state;
          // Getrennt oder Helfer gerade nicht erreichbar: nicht ins Leere senden (es käme nie ein Echo). Bleibt
          // ungesendet und geht beim nächsten verbundenen hass bzw. zusammengeführt mit dem wiederkehrenden Stand hinaus.
          // ("unknown" ist ein frisch angelegter, leerer Helfer: _synced kommt dort erst nach 20 s, dann beschreiben)
          if (this._hass.connected === false || st === 'unavailable') {
            this._saveWait = true;
            return;
          }
          // Derselbe Wert ändert in HA nichts (es käme kein Echo): nicht senden
          if (st !== v) {
            const e = { v, gain: this._gain, at: Date.now(), n: this._hassN };
            this._sent.push(e);
            if (this._sent.length > 8) this._sent.shift();
            this._hass
              .callService('input_text', 'set_value', { entity_id: id, value: v })
              .catch((err) => {
                console.warn('pika-pet-card: Speichern fehlgeschlagen, neuer Versuch', err);
                // mit wachsender Pause (5 s, 10 s … höchstens 5 Min): lehnt HA den Wert ab, nicht alle paar Sekunden
                this._saveFail = (this._saveFail || 0) + 1;
                e.failed = true; // die Pause hier gilt, _sentCheck wertet es nicht vorher schon als verloren
                setTimeout(() => this._sentLost(e), Math.min(5000 * 2 ** (this._saveFail - 1), 3e5));
              });
            this._sentCheck(e, 15000);
          }
        } else {
          try {
            localStorage.setItem(this._lsKey(), v);
          } catch (e) { /* egal */ }
          this._diaryLog('s', v);
          // Helfer fehlt oder war beim Laden nicht erreichbar: Gewinne behalten, kommt er, gehen sie auf seinen Stand
          if (this._cfg.entity) {
            this._pendingWrite = false;
            return;
          }
        }
        this._gain = { s: 0, g: 0, c: false };
        this._pendingWrite = false;
      }, 1200);
    }

    // Kein Echo nach ms: Steht der Wert doch in HA, gilt er als angekommen. Verloren ist er erst, wenn seit dem Senden
    // ein frischer, verbundener Stand von HA kam (sonst bekommt die Karte gerade gar nichts mit, z. B. in einer
    // abgehängten Ansicht, und sendete endlos denselben Wert): dann neu senden, sonst später wieder schauen.
    _sentCheck(e, ms) {
      setTimeout(() => {
        if (!this._sent.includes(e) || e.failed) return;
        if (this._hass?.states[this._cfg.entity]?.state === e.v) return void this._sent.splice(this._sent.indexOf(e), 1);
        if (this._hassN === e.n || this._hass?.connected === false) return this._sentCheck(e, Math.min(ms * 2, 3e5));
        this._sentLost(e);
      }, ms);
    }

    _lsKey() {
      return `pika-pet-card:${this._cfg.name}`;
    }

    // Im Editor umbenannt: Der Name steckt in den Schlüsseln, unter denen ohne Helfer Zustand, Tagesplan (Vorrat, Serie,
    // Album) und „Päckchen-Knopf schon gesehen“ im Browser liegen. Den Stand unter den neuen Namen mitnehmen, sonst
    // finge er von vorn an. Kopiert, nicht verschoben: Bricht man das Bearbeiten ab, gilt der alte Name weiter. Der
    // Editor ruft setConfig bei jedem Tastendruck, Zwischenstände („Pik“, „Pi“ …) werden darum wieder entfernt.
    _lsRename(from, to) {
      if (from == null || to == null || from === to) return;
      try {
        const mine = (this._lsCopies ??= new Set());
        for (const p of ['pika-pet-card', 'pika-pet-plan', 'pika-pet-gift', 'pika-pet-diary']) {
          const v = localStorage.getItem(`${p}:${from}`);
          if (v != null && localStorage.getItem(`${p}:${to}`) == null) {
            localStorage.setItem(`${p}:${to}`, v);
            mine.add(`${p}:${to}`);
          }
          if (mine.delete(`${p}:${from}`)) localStorage.removeItem(`${p}:${from}`);
        }
      } catch (e) { /* kein Speicher: dann gibt es auch nichts mitzunehmen */ }
    }

    _loadLocal() {
      let parsed = null;
      try {
        parsed = parseStats(localStorage.getItem(this._lsKey()));
      } catch (e) { /* egal */ }
      this._stats = parsed || freshStats(this._haNow());
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
      return this._haNow() + this._dbgShift;
    }

    // ---------- Uhr von HA ----------
    // Geräteuhren gehen oft ein paar Sekunden bis Minuten falsch (Tablet ohne Zeitabgleich). Alles, was alle Geräte
    // gleich sehen sollen (Tagesplan, Besuche, Schlafenszeit, Zustand, Päckchen, Haus-Bote, Kaffee), läuft darum auf
    // der Uhr von HA: Gerätezeit + geschätzter Versatz. Auch die Zeiten im Zustand (satt seit, Großputz) sind HA-Zeit,
    // so rechnen alle Geräte aus demselben Stand dieselben Werte und dieselben Häufchen.
    _haNow() {
      return Date.now() + (this._clockUse || 0);
    }

    // Versatz aus den Zeitstempeln (last_updated) von Meldungen, die gerade eben ankamen: HA stempelt sie kurz vor dem
    // Senden, lu − jetzt ist also etwas kleiner als der wahre Versatz (siehe _clockSample). Erste Sicht und die
    // Sekunden nach dem (Wieder-)Verbinden zählen nicht: Das sind alte Stände.
    _clockHass(hass) {
      const now = Date.now();
      const conn = hass.connected !== false;
      if (conn && !this._clkConn) this._clkSkip = now + 5000;
      this._clkConn = conn;
      const c = this._cfg;
      const seen = (this._clkSeen ??= {});
      for (const id of [c.sun_entity, c.entity, c.plan_entity, c.weather_entity, c.flight_entity]) {
        const o = id ? hass.states[id] : undefined;
        if (o && seen[id] && o !== seen[id] && conn && now > this._clkSkip) this._clockSample(Date.parse(o.last_updated), now);
        if (id) seen[id] = o;
      }
    }

    _clockSample(lu, now = Date.now()) {
      // Im Hintergrund kommen Meldungen verspätet an: nicht werten
      if (!Number.isFinite(lu) || document.hidden) return;
      // Der größte Wert der letzten Meldungen (die mit der kürzesten Laufzeit) passt am besten. Eine später gestellte
      // Geräteuhr (NTP) ist nach CLOCK_KEEP neuen Meldungen vergessen.
      const S = (this._clockS ??= []);
      S.push(lu - now);
      if (S.length > CLOCK_KEEP) S.shift();
      this._clockOff = Math.max(...S);
      // Angewandt wird nur eine Änderung ab CLOCK_STEP: die gemeinsame Uhr soll nicht bei jeder Meldung um ein paar
      // Millisekunden springen, Beschäftigungen und Besuche hängen daran. Geräte liegen so höchstens etwa eine
      // Viertelsekunde auseinander (früher bis 2 s).
      const use = this._clockUse || 0;
      if (Math.abs(this._clockOff - use) < CLOCK_STEP) return;
      this._clockUse = Math.round(this._clockOff);
      this._rawM = null;
      this._clockMoved();
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
    _poops(at) {
      const st = this._stats;
      const now = at ?? this._now();
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
        && !['eatFood', 'goSleep', 'wakeUp', 'poop', 'coffee'].includes(this._action);
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

    // Schläft er jetzt (Uhr von HA)? Dieselben Wachfenster wie für Häufchen, Päckchen und den Abbau im Schlaf.
    _sleepTime() {
      if (this._dbgSleep != null) return this._dbgSleep;
      const t = this._haNow();
      return !this._wakeWins(t, t).some(([ws, we]) => t >= ws && t < we);
    }

    // Wachfenster [Beginn, Ende] (ms) am Kalendertag day (Ortszeit). Schlafen nach Mitternacht: Ende am Folgetag.
    // Mit Ort (hass.config) aus Datum und Ort gerechnet, also auf allen Geräten gleich und am Tag der Zeitumstellung
    // richtig; gemerkt je Tag, solange Einstellung und Ort gleich bleiben.
    _wakeDay(day) {
      const [y, mo, d] = [day.getFullYear(), day.getMonth(), day.getDate()];
      const cfg = this._hass?.config;
      const geo = !!cfg && Number.isFinite(cfg.latitude) && Number.isFinite(cfg.longitude);
      const fixed = !/sun/i.test(`${this._cfg.sleep_start} ${this._cfg.sleep_end}`);
      const sig = `${this._cfg.sleep_start}|${this._cfg.sleep_end}|${geo ? `${cfg.latitude},${cfg.longitude},${cfg.elevation}` : '-'}`;
      if (this._wdSig !== sig) {
        this._wdSig = sig;
        this._wdC = new Map();
      }
      const key = y * 400 + mo * 32 + d;
      const hit = this._wdC.get(key);
      if (hit) return hit;
      const a = this._sleepMinutes(this._cfg.sleep_start, 21 * 60, day);
      const b = this._sleepMinutes(this._cfg.sleep_end, 7 * 60, day);
      const w = [new Date(y, mo, d, 0, b).getTime(), new Date(y, mo, d + (a > b ? 0 : 1), 0, a).getTime()];
      // Ohne Ort kommen Sonnenzeiten aus sun.sun (je Gerät): nicht merken
      if (geo || fixed) {
        if (this._wdC.size > 400) this._wdC.clear();
        this._wdC.set(key, w);
      }
      return w;
    }

    // "21:00", "sunset", "sunset+01:00", "sunrise-30" (Minuten) → Minuten nach Mitternacht, Unverständliches → fallback.
    // Sonnenauf- und -untergang am Kalendertag day (ohne: heute) aus Ort und Datum (sunTimes): so hat jeder Tag seine
    // eigenen Zeiten, alle Geräte rechnen gleich, und am Abend vor der Zeitumstellung stimmt es auch. Nur ohne Ort aus
    // sun.sun (next_rising/next_setting). Die springen genau beim Ereignis auf morgen: Ist das morgige ein, zwei Minuten
    // später, wäre direkt nach dem Aufwachen wieder Schlafenszeit. Darum gilt dort je Kalendertag der erste Wert, der kam.
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
      const at = cfg && Number.isFinite(cfg.latitude) && Number.isFinite(cfg.longitude)
        && sunTimes(day || new Date(this._haNow()), cfg.latitude, cfg.longitude, Number(cfg.elevation) || 0);
      let v;
      if (at) {
        const t = new Date(rise ? at.rise : at.set);
        v = t.getHours() * 60 + t.getMinutes();
      } else {
        const attr = rise ? 'next_rising' : 'next_setting';
        const today = new Date(this._haNow()).toDateString();
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

    // Blickrichtung: auf der Südhalbkugel (hass.config.latitude < 0) nach Norden, dann liegt Osten rechts und
    // Westen links (Sonne, Mond, Flugzeuge, Wind). Sonst nach Süden: Osten links, Westen rechts.
    _viewN() {
      return this._hass?.config?.latitude < 0;
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
      const vn = this._viewN();
      if (e != null && az != null) this._place(this._el.sun, skyPos(az, e, vn));

      // Mond höchstens alle 30 s neu berechnen, er bewegt sich gemächlich
      const now = this._dbgDate ?? Date.now();
      const cfg = this._hass?.config;
      if (cfg && Number.isFinite(cfg.latitude) && (this._dbgDate || !this._moonT || now - this._moonT > 30000)) {
        this._moonT = now;
        const m = moonPosition(now, cfg.latitude, cfg.longitude);
        const ph = moonPhase(now);
        this._place(this._el.moon, skyPos(m.az, m.alt, vn));
        const d = moonPath(ph, vn);
        if (d !== this._moonD) this._el.moonLit.setAttribute('d', (this._moonD = d));
        this._moonUp = m.alt > 2 && ph > 0.03 && ph < 0.97;
      }
      sc.toggle('moon-up', !!this._moonUp);
    }

    _place(el, { x, y }) {
      const prev = el._pos;
      if (prev && Math.abs(prev.x - x) < 0.05 && Math.abs(prev.y - y) < 0.05) return;
      el._pos = { x, y };
      // Kleine Schritte (der Mond wandert alle 30 s ein Stückchen) ohne Gleiten: ein 90-s-Übergang, der ständig neu
      // startet, ließe Layout und Malen in jedem Bild laufen. Nur Sprünge (Sonnenuntergang, Neuladen) gleiten.
      const now = Date.now();
      if (prev && Math.hypot(prev.x - x, prev.y - y) > 1) el._glide = now + 90000;
      el.style.transition = !prev ? 'none' : now < (el._glide || 0) ? '' : 'opacity 2.5s, background 2.5s';
      el.style.left = `${x.toFixed(2)}%`;
      el.style.top = `${y.toFixed(2)}%`;
      if (!prev) {
        void el.offsetWidth;
        el.style.transition = '';
      }
    }

    // ---------- Flugzeuge ----------
    // Echte Flüge aus der Flightradar24-Integration (Attribut flights, Meldung alle 10–30 s). Dazwischen fliegen
    // sie mit Kurs und Geschwindigkeit weiter. Im Bild: Osten links, Westen rechts (Südhalbkugel umgekehrt, _viewN), der Bildrand liegt bei
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
      if (!this._away()) this._meteorPlan();
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
    // über die Statusleiste oder die Knöpfe, durchs Heu oder ins Gras (beide liegen vorn, z 3).
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
      for (const el of [this._el.stats, this._el.feed, this._el.gbtn]) {
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
      }, rnd(SKY.meteor[0], SKY.meteor[1]) / (this._meteorShower() ? 3 : 1));
    }

    // Meteorstrom: Perseiden um den 12. 8. (± 3 Tage), Geminiden um den 14. 12. (± 2 Tage): dreimal so oft
    _meteorShower() {
      const d = new Date(this._dbgDate ?? Date.now());
      const y = d.getFullYear();
      const day = festDay(y, d.getMonth() + 1, d.getDate());
      return Math.abs(day - festDay(y, 8, 12)) <= 3 || Math.abs(day - festDay(y, 12, 14)) <= 2;
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
      // Bewegung reduzieren: keine aufleuchtenden Boliden, keine Nachzügler
      const calm = calmMotion();
      this._meteor(!calm && Math.random() < SKY.bolide);
      if (!calm && Math.random() < SKY.twin) {
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
      // Uhr von HA und Gerät können auseinandergehen: Versatz wie überall aus _clockHass (ungeglättet, die Flieger
      // brauchen ihn genau). Sonst verschwänden alle Flieger, wenn die Geräteuhr mehr als 75 s vorgeht. Solange noch
      // keiner geschätzt ist, gilt die Meldung als frisch.
      const lu = Date.parse(st?.last_updated);
      const t0 = Number.isFinite(lu) ? Math.min(now, lu - (this._clockOff ?? lu - now)) : now;
      // Getrennt oder unsichtbar: keine Elemente anlegen, die Meldung liegt in _lastFlights und wird beim
      // Wiederkommen gelesen
      if (!this._attached || this._away()) return;
      const kx = 111.32 * Math.cos(cfg.latitude * RAD);
      const R = Number(this._cfg.flight_radius) || 15;
      // Ohne Kennung (id, Rufzeichen, Flugnummer, Kennzeichen) ließe er sich von Meldung zu Meldung nicht
      // wiedererkennen: jede Meldung gäbe ein neues Flugzeug, das alte flöge doppelt weiter. Solche auslassen.
      const idOf = (f) => String(f.id || f.callsign || f.flight_number || f.aircraft_registration || '');
      const list = [];
      for (const f of Array.isArray(st?.attributes?.flights) ? st.attributes.flights : []) {
        if (!f || typeof f !== 'object' || !idOf(f)) continue;
        const alt = Number(f.altitude);
        const gs = Number(f.ground_speed);
        const lat = Number(f.latitude);
        const lon = Number(f.longitude);
        // Rollt am Flughafen oder hat keine Position: nicht am Himmel
        if (f.on_ground || !(alt > 80) || !(gs > 30) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const e = lonDiff(lon, cfg.longitude) * kx;
        const n = (lat - cfg.latitude) * 110.57;
        // Außerhalb von flight_radius (bzw. ganz am Rand, wo er schon ausgeblendet ist, vgl. pa in _planeTick)
        // sieht man ihn nicht: dann belegt er auch keinen der max_flights-Plätze, ein schon gezeigter gibt
        // seinen Platz ab und fliegt ausgeblendet weiter
        if (Math.max(Math.abs(e), Math.abs(n)) >= 0.99 * R) continue;
        list.push({ f, e, n, alt, gs, slant: Math.hypot(e, n, alt * 0.0003048) });
      }
      list.sort((a, b) => a.slant - b.slant);
      const max = Math.max(0, Math.round(Number(this._cfg.max_flights) || 0));
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
      // Die Tippfläche eines tiefen Fliegers liegt über Pika und Häufchen: die haben Vorrang
      const below = (e) => this.shadowRoot.elementsFromPoint(e.clientX, e.clientY)
        .find((el) => !el.closest('.ptags') && el.closest('.pika, .poo'))?.closest('.pika, .poo');
      const toggle = (e) => {
        e.stopPropagation();
        if (e.currentTarget === hit) {
          const under = below(e);
          // mit der Stelle weiterreichen: die Streichel-Zone hängt daran
          if (under) {
            return under.dispatchEvent(new MouseEvent('click', {
              bubbles: true, composed: true, cancelable: true, clientX: e.clientX, clientY: e.clientY,
            }));
          }
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
      // Kraulen und Übers-Fell-Streichen unter dem Flieger: die Tippfläche hält den Finger fest und reicht ihn durch
      hit.addEventListener('pointerdown', (e) => below(e)?.classList.contains('pika') && this._pressStart(e, hit));
      hit.addEventListener('pointermove', (e) => this._pressMove(e));
      for (const t of ['pointerup', 'pointercancel']) hit.addEventListener(t, (e) => this._pressEnd(e));
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
        && Math.hypot(lonDiff(dLon, cfg.longitude) * 111.32 * Math.cos(cfg.latitude * RAD), (dLat - cfg.latitude) * 110.57) < 30;
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

    // Auch bei laufendem Takt gleich neu rechnen (neue Meldung): Jeder Schritt startet am gerade sichtbaren Punkt
    // und steuert den Punkt PLANE_STEP voraus an, ein früherer Schritt ändert also Weg und Tempo nicht
    _planeLoop() {
      if (!this._planes.size || !this._attached) return;
      clearInterval(this._planeT);
      this._planeT = setInterval(() => this._planeTick(), PLANE_STEP * 1000);
      this._planeTick();
    }

    // Neue Kartengröße oder zurück aus dem Hintergrund: Flieger gleich an den richtigen Platz setzen statt sie
    // einen ganzen Takt lang dorthin gleiten zu lassen
    _planeSnap() {
      for (const p of this._planes.values()) p.snap = true;
      this._planeLoop();
    }

    _planeTick() {
      if (!this._planes.size) {
        clearInterval(this._planeT);
        this._planeT = null;
        return;
      }
      if (this._away() || !this._g) return;
      const now = Date.now();
      const W = this._W;
      const H = this._H;
      const R = Number(this._cfg.flight_radius) || 15;
      const vs = this._viewN() ? -1 : 1;
      const shown = [];
      const fresh = [];
      const pos = [];
      for (const [id, p] of this._planes) {
        const age = (now - p.t0) / 1000;
        // Ziel: wo er am Ende des Übergangs ist. Neue/versetzte erst ohne Übergang auf den Punkt von jetzt (der
        // zweite Durchlauf unten schickt sie dann wie alle anderen los)
        const dt = age + (p.fresh || p.snap ? 0 : PLANE_STEP);
        const e = p.e + p.ve * dt;
        const n = p.n + p.vn * dt;
        const alt = Math.max(80, p.alt + p.vz * Math.min(dt, 30));
        // Blick nach Süden: Osten links; nach Norden (Südhalbkugel, vs −1): Osten rechts
        const x = W * (0.5 - ((vs * e) / R) * 0.46);
        // Höhe logarithmisch: Anflug knapp über den Hügeln, Reiseflughöhe oben; hinter uns (beim Blick nach
        // Süden nördlich) etwas höher
        const af = clamp(Math.log1p(alt / 1000) / Math.log1p(40), 0, 1);
        const y = (H * clamp(49 - af * 36 - clamp((vs * n) / R, -1, 1) * 4, 13, 49)) / 100;
        const slant = Math.hypot(e, n, alt * 0.0003048);
        const sc = (clamp(1.6 / slant, 0.1, 0.36) / 0.3) * p.size;
        Object.assign(p, { x, y, slant, altNow: alt });
        const out = x < -W * 0.2 || x > W * 1.2;
        // Ohne neue Meldung nach 75 s ausblenden, ein verlassenes spätestens nach 45 s
        const ending = p.gone ? out || now - p.gone > 45000 : age > 75;
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
        // nach Osten = im Bild nach links (Blick nach Norden: rechts); erst ab etwa 40 km/h quer, sonst dreht ein
        // kurvender Hubschrauber hin und her
        if (Math.abs(p.ve) > 0.012) p.left = vs * p.ve > 0;
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
        if (p.fresh || p.snap) {
          p.el.style.transition = p.s.style.transition = p.tag.style.transition = p.hit.style.transition = 'none';
          p.s.firstElementChild.style.transition = 'none'; // .pl-f: Randausblendung gleich auf dem richtigen Wert
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
        const hw = Math.max(44, Math.round(H * 0.3 * sc));
        const hh = Math.max(36, Math.round(H * 0.12 * sc));
        // Größe nur schreiben, wenn sie sich ändert (sonst jedes Mal neues Layout)
        if (p.hw !== hw || p.hh !== hh) {
          p.hw = hw;
          p.hh = hh;
          p.hit.style.width = `${hw}px`;
          p.hit.style.height = `${hh}px`;
        }
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
          p.s.firstElementChild.style.transition = '';
          if (p.fresh && p.show && p.altNow < 5000 && p.slant < 8) this._noticeCritter(p.x, true);
          p.fresh = p.snap = false;
        }
        // Gleich weiter: jetzt mit Übergang auf den Punkt PLANE_STEP voraus (bei den übrigen ändert sich nichts)
        this._planeTick();
        return;
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

    _readWeather(w, pr) {
      // Wetter kurz nicht erreichbar (Aussetzer des Dienstes, Integration lädt neu): Das letzte gilt bis zu WX_HOLD
      // weiter. Sonst wäre für die Dauer des Aussetzers Schönwetter, und er käme mitten im Gewitter heraus.
      const dead = !!w && (w.state === 'unavailable' || w.state === 'unknown');
      if (!dead) this._wxDeadAt = 0;
      else if (this._wxRaw && this._wxDeadAt !== -1) {
        this._wxDeadAt ||= Date.now();
        if (Date.now() - this._wxDeadAt < WX_HOLD) return;
        this._wxDeadAt = -1; // Frist um (_tick): ab jetzt ist das Wetter unbekannt
      }
      if (w) {
        const a = w.attributes || {};
        let wind = Number(a.wind_speed);
        wind = windKmh(wind, a.wind_speed_unit);
        let temp = Number(a.temperature);
        if (a.temperature_unit === '°F') temp = (temp - 32) / 1.8;
        this._wxRaw = {
          cond: w.state,
          cover: Number(a.cloud_coverage),
          wind: Number.isFinite(wind) ? wind : 0,
          bearing: windDeg(a.wind_bearing),
          temp: Number.isFinite(temp) ? temp : null,
          // NaN ohne Sensor oder wenn er nicht verfügbar ist, dann zählt nur die Wetterlage
          precip: pr ? parseFloat(pr.state) : NaN,
        };
      } else {
        this._wxRaw = null;
      }
      this._applyWeather();
    }

    _applyWeather() {
      if (!this._el) return;
      const raw = { cond: null, wind: 0, temp: null, ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
      // Vorhersagen melden "rainy" schon bei Niesel: unter rain_min mm/h ist es nur bewölkt
      const drizzle = raw.cond === 'rainy' && raw.precip < this._cfg.rain_min;
      const def = drizzle ? WEATHER.cloudy : WEATHER[raw.cond] || { cover: 25 };
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
      // Windrichtung = woher der Wind kommt. Aus Westen ziehen Wolken nach Osten, im Bild (Blick nach Süden) also
      // nach links; beim Blick nach Norden (Südhalbkugel) nach rechts. fromWest heißt ab hier: weht im Bild nach links.
      const fromWest = !(raw.bearing > 0 && raw.bearing < 180) !== this._viewN();
      this._wind = raw.wind;
      this._windDir = fromWest ? -1 : 1; // wohin der Wind im Bild weht (Drachen)
      const key = JSON.stringify([fx, Math.round(raw.wind / 5), fromWest]);
      if (key === this._wxKey) return;
      this._wxKey = key;
      const wasShelter = this._wx.shelter;
      const wasWet = this._wx.wet;
      const wasSnow = this._wx.snowcover;
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
      // Fängt es an zu regnen oder zu schneien: eine Beschäftigung, die bei diesem Wetter nicht geht, einpacken
      // (sonst springt er Seil mit dem Blatt als Schirm oder liegt mit dem Tablet im Regen)
      else if (((fx.wet && !wasWet) || (fx.snowcover && !wasSnow)) && !this._asleep
        && WX_STOP.includes(this._action) && !this._actOk(this._action)) this._interrupt();
    }

    _setPrecip(rain, snow) {
      const k = `${rain}/${snow}`;
      if (k === this._precipKey) return;
      this._precipKey = k;
      // Jedes Teilchen steht zweimal in seiner Ebene, eine halbe Ebenenhöhe auseinander (siehe .precip .pl)
      const twice = (cls, y, style) => `<i class="${cls}" style="top:${y.toFixed(1)}%;${style}"></i>`
        + `<i class="${cls}" style="top:${(y + 50).toFixed(1)}%;${style}"></i>`;
      // Dauer einer Runde (1,2 Kartenhöhen): Regen 1,85–2,75 Höhen/s, Schnee 0,14–0,21 Höhen/s wie bisher
      const layers = (n, durs, sways, one) => durs.map((d, l) => {
        let h = '';
        for (let i = l; i < n; i += durs.length) h += one(rnd(0, 50));
        const inner = sways ? `<div class="pw" style="--pw:${sways[l]}s">${h}</div>` : h;
        return `<div class="pl" style="--pd:${d}s;animation-delay:${rnd(-d, 0).toFixed(2)}s">${inner}</div>`;
      }).join('');
      let html = '';
      if (rain) {
        html += layers(rain, [0.65, 0.53, 0.44], null, (y) =>
          twice('r', y, `left:${rnd(0, 100).toFixed(1)}%;opacity:${rnd(0.45, 0.95).toFixed(2)}`));
      }
      if (snow) {
        html += layers(snow, [8.6, 7.1, 5.7], [7.7, 6.3, 5.3], (y) => {
          const s = rnd(2.5, 5).toFixed(1);
          return twice('s', y, `left:${rnd(0, 100).toFixed(1)}%;width:${s}px;height:${s}px;opacity:${rnd(0.6, 1).toFixed(2)}`);
        });
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
      const now = this._haNow();
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
      const now = this._haNow();
      for (const a of B.queue) if (now - a.liveAt > 180000) a.live = false;
      B.queue = B.queue.filter((a) => a.live);
      this._boteRefresh();
    }

    _boteActs(ctx) {
      const B = this._bote;
      if (!B?.list.length || !this._g) return [];
      B.queue = B.queue.filter((a) => a.live && a.phase === 'empty');
      if (B.queue.length) return [[1000, 'boteEmpty']];
      const now = this._haNow();
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
          if (!type || !c.state) {
            const m = !type ? `unbekannter Gerätetyp "${c?.type}" (washer, dryer, dishwasher)` : `Gerät ${i + 1} ohne state`;
            if (!BOTE_WARNED.has(m)) {
              BOTE_WARNED.add(m);
              console.warn(`pika-pet-card Haus-Bote: ${m}`);
            }
            return;
          }
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
        clearTimeout(a.inT);
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
      const raw = norm(st?.state);
      let s = BOTE_ALIAS[raw] || raw;
      const dead = BOTE_DEAD.has(s);
      // Lange nicht erreichbar (> 15 Min): wie nach dem Neuladen lesen, sonst käme das Aufräumen zur falschen Zeit
      const longDead = !dead && a.deadAt != null && now - a.deadAt > 15 * 60000;
      a.deadAt = dead ? a.deadAt ?? now : null;
      const first = !a.seen || longDead;
      a.seen = true;
      // Trockner im Knitterschutz: Tür auf meldet manchmal "pause" – er bleibt fertig
      if (a.st === 'finished' && s === 'pause' && !first) s = 'finished';
      this._boteWarn(a, st, s, dead, [pr, en, dr]);
      const pct = this._botePct(pr, a);
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
      // Programmlauf merken: seit wann, und die letzten gültigen Werte (gehen am Ende oft vor dem Zustand auf
      // unavailable). Daran erkennt "läuft → aus", ob es ein Programmende oder ein Abbruch war.
      if (BOTE_RUN.has(cur)) {
        if (!BOTE_RUN.has(prevSt) || first) a.run = { at: first ? a.changed : now, pct: null, end: null };
        if (pct != null) a.run.pct = pct;
        if (end != null) a.run.end = end;
      }
      // Frist für "ausgeräumt" (emptyUntil): 0 = keine, null = läuft/fertig
      const idle = BOTE_IDLE.has(cur);
      let live = false;
      if (first) {
        if (BOTE_RUN.has(cur)) a.emptyUntil = null;
        else if (cur === 'finished') {
          // Tür später als 2 Minuten nach Programmende bewegt: ausgeräumt. Auch wenn sie jetzt wieder zu ist (geöffnet
          // und geschlossen), sonst riefe ein später geladenes Gerät weiter, während die anderen schon Ruhe geben.
          a.opened = !!dr && !doorDead && doorAt - a.finAt > BOTE_AUTOOPEN_MS;
          a.emptyUntil = a.opened ? doorAt + BOTE_EMPTY_MS : null;
        } else if (idle) {
          // Nach dem Neuladen nur, wenn es plausibel ein Programmende war: Fortschritt steht noch auf (fast) 100,
          // oder (ohne Fortschritt) eine gültige Endzeit hat sich um dieselbe Zeit geändert. Im Zweifel nicht (auch
          // nicht nach einem HA-Neustart, der alle last_changed gleichsetzt).
          // Kein Neustart: der setzt alle last_changed auf dieselbe Zeit (_haBoot). Der Fortschritt muss außerdem in
          // der Stunde vor dem Ausschalten so weit gekommen sein (nicht ein alter Stand vom Vortag beim Einschalten).
          const near = [pr, en].some((o) => o && !BOTE_DEAD.has(norm(o.state)) && Math.abs(lc(o) - a.changed) <= 5 * 60000);
          const pAge = pr ? a.changed - lc(pr) : NaN;
          const ok = pct != null ? pct >= 95 && pAge >= -60000 && pAge <= 60 * 60000 : near;
          a.emptyUntil = ok && !this._haBoot(a.changed) ? a.changed + BOTE_EMPTY_MS : 0;
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
        } else if (!door && prevDoor && !doorDead && !a.opened && now - a.finAt > BOTE_AUTOOPEN_MS) {
          // AutoOpen hatte die Tür schon geöffnet, jetzt ist sie nach dem Ausräumen wieder zu
          a.opened = true;
          a.emptyUntil = now + BOTE_EMPTY_MS;
          live = true;
        }
      } else if (stChanged) {
        // Programmende oder Abbruch? Nach den letzten gültigen Werten des Laufs; ohne Werte erst ab 10 Minuten
        // Laufzeit (ein Abbruch gleich nach dem Start, bevor Fortschritt oder Endzeit kamen, zählt nicht)
        const R = a.run || {};
        const ended = R.pct == null && R.end == null ? a.changed - (R.at ?? a.changed) >= 10 * 60000
          : (R.pct != null && R.pct >= 95) || (R.end != null && Math.abs(R.end - a.changed) < 10 * 60000);
        if (idle && prevSt === 'finished') {
          // schon beim Türöffnen gewertet: die Frist läuft weiter
          if (!prevOpened) {
            a.emptyUntil = now + BOTE_EMPTY_MS;
            live = true;
          }
        } else if (idle && prevSt === 'run' && ended) {
          // direkt aus (ohne "fertig"): auch dann räumt er sichtbar mit auf
          a.emptyUntil = a.changed + BOTE_EMPTY_MS;
          live = true;
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
        if (live && (from === 'done' || from === 'run') && ph === 'empty') this._boteLive(a);
      }
      this._boteRender(a);
    }

    // Kurz nach einem Neustart von HA? sun.sun entsteht dabei neu (sonst ändert es sich nur bei Auf- und
    // Untergang), alle Entities bekommen dann last_changed um dieselbe Zeit
    _haBoot(t) {
      const S = this._hass?.states || {};
      const b = Date.parse(S[this._cfg.sun_entity]?.last_changed);
      if (!(t >= b - 60000 && t - b <= 3 * 60000)) return false;
      // Wechselt sun.sun nur bei Sonnenauf- oder -untergang, ist das kein Neustart: Beim Neustart bekommen sehr viele
      // Entities dieselbe Zeit (nur selten aufgerufen: Bezugsende, Neuladen beim Haus-Boten)
      let same = 0;
      for (const k in S) if (Math.abs(Date.parse(S[k]?.last_changed) - b) < 3000 && ++same >= 6) return true;
      return false;
    }

    _botePhase(a, now) {
      // Seit über 30 Minuten nicht erreichbar: lieber nichts zeigen als ewig "fertig"
      if (a.deadAt != null && now - a.deadAt > 30 * 60000) return null;
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

    // Fortschritt in %; ohne Einheit "%" gilt ein Wert zwischen 0 und 1 als Anteil (0.45 → 45 %), eine ganze 1 aber
    // als 1 % (ganzzahlige Prozent ohne Einheit), außer das Gerät meldete schon Anteile (a.frac) oder "1.0"
    _botePct(pr, a) {
      let v = Number.parseFloat(pr?.state);
      if (!Number.isFinite(v)) return null;
      if (pr.attributes?.unit_of_measurement !== '%' && v > 0 && v <= 1) {
        if (v < 1) a.frac = true;
        if (v < 1 || a.frac || /\./.test(pr.state)) v *= 100;
      }
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
      const now = this._haNow();
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
      if (!this._g || !this._attached || this._away() || this._asleep) return;
      const B = this._bote;
      a.live = true;
      a.liveAt = this._haNow();
      if (!B.queue.includes(a)) B.queue.push(a);
      // Eine Beschäftigung aus dem Tagesplan macht er fertig (sie finge sonst von vorn an), aufgeräumt wird danach
      const slot = this._slot && this._action === this._slot.act;
      if (this._running && !this._wx.shelter && !this._next && !slot
        && !['eatFood', 'goSleep', 'wakeUp', 'poop', 'boteEmpty', 'coffee', 'giftShoot', 'giftOpen'].includes(this._action)) this._interrupt();
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
        const m = Math.floor((this._haNow() - a.changed) / 60000);
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
      // Seit über einer Stunde fertig: auch ruhig (der Pika erinnert ja weiter daran)
      const still = !!this._asleep || (view !== 'run' && this._el.scene.classList.contains('night'))
        || (view === 'done' && this._haNow() - (a.finAt || 0) > 60 * 60000);
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
    // vor dem Pika), in der Reihenfolge der Konfiguration. Reicht der Platz bis zum rechten Rand nicht, werden alle
    // gemeinsam gleich stark kleiner. Setzt nur Positionen und tut nichts, wenn sich nichts ändert.
    _boteLayout() {
      const B = this._bote;
      if (!this._g || !this._el || !B?.list.length) return;
      const row = B.list.filter((a) => a.el && a.spec).sort((x, y) => x.idx - y.idx);
      if (!row.length) return;
      const H = this._H;
      const W = this._W;
      const left = 6;
      const right = W - 6;
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
      this._bote.runAt = this._haNow();
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
      this._bote.runAt = this._haNow();
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
      this._bote.runAt = this._haNow();
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
        // Seit über einer Stunde fertig: nur noch alle 20–30 Minuten daran erinnern
        const late = this._haNow() - (a.finAt || 0) > 60 * 60000;
        a.nudgeAt = this._haNow() + (patted ? rnd(late ? 20 : 3, late ? 30 : 6) * 60000 : 30000);
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
      a.liveAt = this._haNow();
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

    // ==================== Kaffee: Methoden ====================
    // Kaffeevollautomat aus `coffee` ({ active, counter, selected }):
    // - active: aktives Programm (select). Ein Getränkeprogramm heißt: gerade wird ein Bezug gemacht. Der Pika
    //   schnuppert dann und denkt an Kaffee. Einschalten mit Spülen und Reinigen setzen kein Programm.
    // - counter: Tassenzähler (zählt zu Beginn des Bezugs hoch). Fertig ist ein Bezug, wenn kein Getränk mehr
    //   läuft und das Programm mindestens 15 s nach dem Zählerstand endete (ohne live gesehenen Bezug höchstens
    //   COFFEE_CTR_MS danach). So erkennt jedes Gerät denselben Bezug, auch nach dem Neuladen. Ein Neustart von HA
    //   zählt nicht (Programm kam aus "unavailable" oder Zähler kurz nach dem Start gültig).
    // - selected: ausgewähltes Programm. Daraus kommt die Getränkeart, wenn die Karte den Bezug nicht live sah.
    // Gleich danach holt er sich dasselbe Getränk aus dem Bau und trinkt es (Schlaf unterbricht er dafür), nach einer
    // festen Zeitleiste ab Bezugsende (COFFEE_FETCH, COFFEE_DRINK): Alle Geräte trinken im selben Takt, ein neu
    // geladenes steigt mit dem passend leeren Gefäß ein. Gemerkt wird dafür nichts.

    _hassCoffee(hass) {
      const c = this._cfg?.coffee;
      if (!c?.active) return;
      const S = hass.states;
      const a = S[c.active];
      const n = c.counter ? S[c.counter] : undefined;
      const sel = c.selected ? S[c.selected] : undefined;
      if (a === this._cofA && n === this._cofN && sel === this._cofS) return;
      this._cofA = a;
      this._cofN = n;
      this._cofS = sel;
      const C = (this._cof ??= { brew: null, pend: null, next: null, done: [] });
      const prevSt = C.st; // zuletzt gesehener Zustand des Programms (undefined: frisch geladen)
      C.st = a?.state;
      const prog = String(a?.state || '').toLowerCase();
      const now = this._haNow();
      if (COFFEE_PROG.test(prog)) {
        if (C.brew?.prog !== prog) {
          C.brew = { prog, at: Date.parse(a.last_changed) || now, sniffed: false };
          // Steht er nur herum, gleich die Nase heben; schläft er, zuckt er kurz im Schlaf
          if (this._asleep && this._el && now - C.brew.at < 60000) {
            this._el.pika.classList.add('peek');
            setTimeout(() => this._el.pika.classList.remove('peek'), 900);
          } else if (['idle', 'look', 'wander', 'groom'].includes(this._action)) this._interrupt();
        }
        return;
      }
      // Kurz nicht erreichbar: der laufende Bezug bleibt gemerkt
      if (!a || a.state === 'unavailable') return;
      const brew = C.brew;
      C.brew = null;
      const end = Date.parse(a.last_changed) || now;
      let key = null;
      const t0 = n && n.state !== 'unavailable' && n.state !== 'unknown' && Date.parse(n.last_changed);
      const used = (k) => C.done.includes(k) || C.pend?.key === k || C.next?.key === k;
      // Live gesehen zählt auch, wenn der Zähler spät noch einmal hochging (zwei Tassen)
      if (brew) {
        if (t0 && end - t0 < 15 * 60000 && (end - t0 >= 15000 || end - brew.at >= 15000)) key = n.last_changed;
      } else if (t0 && end - t0 >= 15000 && end - t0 <= COFFEE_CTR_MS && prevSt !== 'unavailable') {
        // Nur aus dem Zähler (neu geladen, Bezug nicht live gesehen): ein Bezug dauert keine 3 Minuten. Nicht nach
        // einem Neustart von HA: Kam das Programm gerade aus "unavailable" zurück, oder wurde der Zähler kurz nach dem
        // Start gültig (_haBoot), melden sich Zähler und Programm nur nacheinander zurück.
        if (!this._haBoot(t0)) key = n.last_changed;
      }
      // Zählte der Zähler diesen Bezug nicht (Heißwasser/Tee, eigener Zähler: sein Stand ist alt oder schon
      // getrunken), gilt, was die Karte live sah. brew.at ist die Zeit von HA, auf allen zusehenden Geräten gleich.
      if ((!key || used(key)) && brew && end - brew.at >= 15000 && end - brew.at < 15 * 60000) key = `live ${brew.at}`;
      if (!key || used(key)) return;
      const p = brew?.prog || String(sel?.state || '').toLowerCase();
      const kind = coffeeKind(p);
      const r = (i) => seedRnd('coffee', key, i);
      const sip = (COFFEE_DRINK[kind] * (0.85 + r(0) * 0.3)) / COFFEE_SIPS[kind];
      const P = {
        key, kind, name: coffeeName(p, kind), t0: end, sip, end: end + COFFEE_FETCH + COFFEE_SIPS[kind] * sip,
        rockR: r(1), faceR: r(2), stage: 'fetch', lv: 1, j: 0,
      };
      // Auf den anderen Geräten längst ausgetrunken. Gemerkt, damit ein späteres Zucken des Programms (WLAN weg,
      // unavailable → unknown) denselben Bezug nicht noch einmal auslöst.
      if (now > P.end - 3000) return this._coffeeMark(key);
      // Trinkt er noch den vorigen (oder holt ihn gerade): dieser kommt gleich danach dran
      if (C.pend) {
        if (C.next) this._coffeeMark(C.next.key);
        C.next = P;
        return;
      }
      C.pend = P;
      // Sofort holen, auch mitten in einer Beschäftigung (die geht danach an ihrer Stelle im Plan weiter);
      // im Schlaf weckt ihn der Duft
      // Auspacken und Ausräumen macht er noch fertig (danach ist der Kaffee dran)
      if (!['eatFood', 'coffee', 'goSleep', 'wakeUp', 'giftShoot', 'giftOpen', 'boteEmpty'].includes(this._action)) this._interrupt();
    }

    _tickCoffee() {
      const C = this._cof;
      if (!C) return;
      const now = this._haNow();
      // Nicht abgeholt (Sturm, Karte war versteckt): verfällt. Hängt ein Bezug ewig, nicht mehr schnuppern.
      if (C.pend?.stage === 'fetch' && now > C.pend.end - 3000) {
        this._coffeeMark(C.pend.key);
        C.pend = null;
      }
      // Angetrunken und dann unterbrochen (Bildschirm aus, Gewitter): auf den anderen Geräten längst leer. Nicht Stunden
      // später den letzten Schluck nehmen (oder ihn dafür nachts wecken), sondern verfallen lassen.
      if (C.pend && C.pend.stage !== 'fetch' && now > C.pend.end + COFFEE_LATE && this._action !== 'coffee') {
        this._coffeeMark(C.pend.key);
        C.pend = null;
      }
      if (!C.pend && C.next) {
        C.pend = C.next;
        C.next = null;
      }
      if (C.brew && now - C.brew.at > 10 * 60000) C.brew.sniffed = true;
    }

    _coffeeDue() {
      const P = this._cof?.pend;
      return !!P && !this._next && !this._wx.shelter && this._haNow() <= P.end + (P.stage === 'fetch' ? -3000 : COFFEE_LATE);
    }

    _coffeeActs() {
      const B = this._cof?.brew;
      return B && !B.sniffed ? [[60, 'coffeeSniff']] : [];
    }

    _coffeeMark(key) {
      const C = this._cof;
      C.done = [...C.done.filter((k) => k !== key), key].slice(-6);
    }

    // Kaffeeduft: Nase hoch, schnuppern, an Kaffee denken, dann erwartungsvoll zum Bau
    async _coffeeSniff() {
      const B = this._cof?.brew;
      if (!B) return;
      B.sniffed = true;
      const p = this._el.pika;
      const think = this._el.think;
      p.classList.add('look-up');
      await this._wait(500);
      this._twitch();
      await this._wait(450);
      this._twitch();
      this._say(pick(['schnupper…', 'hm?', 'riecht gut!']), 1300);
      await this._wait(1300);
      p.classList.remove('look-up');
      think.innerHTML = COFFEE_THINK;
      try {
        this._bubble(think, true);
        await this._wait(2600);
        this._bubble(think, false);
        await this._wait(300);
      } finally {
        think.innerHTML = FOOD.lz.svg;
      }
      // neben die Nische (bzw. den Heuhaufen), mit Blick zur Tür
      await this._walkTo(this._g.stand + this._g.pW * 0.16, 1.2);
      this._face(-1);
      await this._wait(rnd(1500, 3000));
    }

    // Im Bau eine Tasse holen, mit ihr herauskommen und trinken: auf dem Stein oder vor der Tür, Schluck für Schluck.
    // Unterbrochen (Futter, Größenänderung) geht es an derselben Stelle im Ablauf weiter.
    async _coffee() {
      this._memo('coffee');
      const P = this._cof.pend;
      const p = this._el.pika;
      const { stand, pW, rock } = this._g;
      const night = this._sleepTime();
      const setLv = () => {
        p.style.setProperty('--lv', P.lv.toFixed(2));
        p.classList.toggle('hot', P.lv > 0.45);
      };
      const sips = COFFEE_SIPS[P.kind];
      if (P.stage === 'fetch') {
        this._coffeeMark(P.key);
        P.rock = !night && !this._wx.wet && P.rockR < 0.5;
      }
      // Neu geladen, während die anderen Geräte schon trinken: gleich am Trinkplatz, das Gefäß so leer wie dort
      if (P.stage === 'fetch' && this._haNow() - P.t0 > 4000 && Date.now() - (this._loopAt || 0) < 5000) {
        P.j = clamp(Math.floor((this._haNow() - P.t0 - COFFEE_FETCH) / P.sip) + 1, 0, sips - 1);
        P.lv = 1 - P.j / sips;
        P.foam = P.j > 0 && COFFEE_FOAM.has(P.kind);
        this._inside = false;
        this._pose('out', 0);
        if (P.rock) {
          this._lift = rock.lift;
          this._setX(rock.cx, true);
        } else {
          this._lift = 0;
          this._setX(stand + pW * 0.16, true);
        }
        this._face(P.rock ? (P.faceR < 0.5 ? -1 : 1) : 1);
        P.stage = 'drink';
      }
      if (P.stage === 'fetch') {
        if (!this._inside) {
          this._say(night ? '*gähn*' : P.name, 1200);
          await this._wait(500);
          await this._enterBurrow(1.3);
        } else {
          if (night) {
            this._say('*gähn*', 1200);
            await this._wait(1000);
          }
          await this._to('hidden', 400);
        }
        await this._wait(clamp(P.t0 + 4500 - this._haNow(), 800, 2800)); // drinnen klappert es
        P.stage = 'out';
      }
      p.classList.add('coffee', `ck-${COFFEE_CUP[P.kind]}`, `ck-${P.kind}`);
      p.classList.toggle('foam', !!P.foam);
      setLv();
      // Nach einem Gewitter im Bau: zum Weitertrinken vor die Tür
      if (P.stage === 'drink' && this._inside) {
        await this._to('peek', 450);
        await this._comeOut();
      }
      // Nach einer Unterbrechung ist er vom Stein schon heruntergehüpft
      if (P.stage === 'drink') P.rock = this._lift > 0;
      if (P.stage === 'out') {
        if (this._inside) {
          await this._to('peek', 450);
          await this._wait(rnd(500, 900));
          await this._comeOut();
        }
        if (!night) this._say(P.name, 1300);
        // Tagsüber und trocken gern oben auf dem Aussichtsstein (fest je Bezug), sonst vor der Tür
        if (P.rock) {
          await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1), 0.7);
          if (this._bird?.perch === 'rock') {
            this._bird.scare();
            await this._wait(600);
          }
          await this._hopTo(rock.cx, rock.lift);
          this._puff(rock.cx, this._g.gy - rock.lift, 2);
        } else await this._walkTo(stand + pW * 0.16, 0.7); // wie beim Lesen: die Nische bleibt frei
        this._face(P.rock ? (P.faceR < 0.5 ? -1 : 1) : 1);
        P.stage = 'drink';
        await this._wait(800);
      }
      // Schluck j zur festen Zeit t0 + COFFEE_FETCH + j · sip. Hängt er mehr als einen Schluck hinterher (aufgewacht,
      // Bildschirm erst später an), ist das Gefäß gleich so leer wie auf den anderen Geräten, statt hastig aufzuholen.
      const sipAt = () => P.t0 + COFFEE_FETCH + P.j * P.sip;
      while (P.lv > 0.01) {
        const due = Math.floor((this._haNow() - P.t0 - COFFEE_FETCH) / P.sip) + 1; // nächster Schluck nach Plan
        if (due > P.j + 1) {
          P.j = Math.min(due, sips - 1);
          P.lv = 1 - P.j / sips;
          P.foam = COFFEE_FOAM.has(P.kind);
          p.classList.toggle('foam', P.foam);
          setLv();
        }
        // Zwischen den Schlucken: Gefäß in den Pfoten, genießen, umschauen
        while (sipAt() - this._haNow() > 9000) {
          await this._wait(rnd(5000, 8000));
          const r = Math.random();
          if (r < 0.3) this._twitch();
          else if (r < 0.5 && !night) this._face(-this._dir);
          else if (r < 0.62) this._say(night ? pick(['*gähn*', 'mmh…']) : P.lv > 0.45 ? pick(['pust…', 'mmh…']) : pick(['mmh…', 'ahh…', '♥']), 1100);
        }
        await this._wait(Math.max(300, sipAt() - this._haNow()));
        p.classList.add('sip');
        await this._wait(1400);
        const first = P.j === 0;
        P.j++;
        P.lv = Math.max(0, 1 - P.j / sips);
        p.classList.remove('sip');
        setLv();
        if (COFFEE_FOAM.has(P.kind)) {
          P.foam = true;
          p.classList.add('foam');
        }
        await this._wait(400);
        const r = Math.random();
        if (first && P.kind !== 'milk' && r < 0.4) {
          this._say('heiß!', 900);
          this._twitch();
        } else if (r < 0.45) this._say(pick(['mmh…', 'ahh…', '♥', 'lecker!', 'schlürf']), 1200);
        else if (r < 0.65) this._twitch();
        else if (r < 0.8 && !night) this._face(-this._dir);
      }
      // Leer: zufrieden, Schaum ablecken
      await this._wait(600);
      this._happy(1400);
      this._say('ahh!', 1200);
      await this._wait(1500);
      if (P.foam) {
        p.classList.add('lick');
        this._say('schleck!', 900);
        await this._wait(600);
        p.classList.remove('lick', 'foam');
        await this._wait(400);
      }
      // Kam inzwischen ein zweiter Bezug, ist der als Nächstes dran (nicht einfach löschen)
      if (this._cof.pend === P) {
        this._cof.pend = this._cof.next;
        this._cof.next = null;
      }
      // Koffein! Tagsüber ein paar Freudensprünge, nachts ein Gähnen (er schläft gleich weiter)
      if (!night && P.kind !== 'tea' && P.kind !== 'milk' && Math.random() < 0.7) {
        if (P.rock) {
          await this._hopDown();
          P.rock = false;
        }
        this._say(pick(['wach!', 'wuiii!', 'zack!']), 1100);
        for (let i = 0; i < 2; i++) {
          this._jump('binky');
          await this._wait(1000);
        }
      } else if (night) {
        this._say('*gähn*', 1200);
        await this._wait(1200);
      }
      // Leere Tasse zurück in den Bau
      if (P.rock) await this._hopDown();
      await this._enterBurrow(1.1);
      p.classList.remove('coffee', 'hot', ...COFFEE_CLS);
      await this._wait(600);
    }
    // ==================== Ende Kaffee ====================

    // ==================== Päckchen: Methoden ====================
    // Pflege-Serie (Tagesplan-Feld gift), Knopf mit Fortschrittsring und Album, Ballon mit Zwille, Auspacken, Leckerli und
    // Schätze in der Szene. Was alle Geräte wissen müssen, steht im Plan. Ballon, Zwille und Auspacken zeigt jedes Gerät
    // selbst: Der Ballon schwebt nach fester Zeitleiste ab dem Verschenken (G.x) herein, ausgepackt ist es, sobald es
    // ein Gerät gezeigt hat (G.o). Geräte, auf denen gerade jemand zuschaut, zeigen es trotzdem noch zu Ende (der Pika
    // schießt und packt dort fast gleichzeitig aus); wo keiner zuschaut oder er schläft, verschwindet der Ballon.

    _giftOn() {
      return !!this._cfg?.gifts;
    }

    // Wachfenster [Beginn, Ende] (ms) je Tag, von einem Tag vor t1 bis einen Tag nach t2 (siehe _wakeDay)
    _wakeWins(t1, t2) {
      const w = [];
      const day = new Date(t1);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - 1);
      for (let i = 0; i < 20000 && day.getTime() <= t2 + 864e5; i++) {
        w.push(this._wakeDay(day));
        day.setDate(day.getDate() + 1);
      }
      return w;
    }

    // Wachzeit (ms) zwischen t1 und t2
    _awakeMs(t1, t2) {
      if (!(t2 > t1)) return 0;
      let ms = 0;
      for (const [ws, we] of this._wakeWins(t1, t2)) ms += Math.max(0, Math.min(we, t2) - Math.max(ws, t1));
      return ms;
    }

    // Wann nach t weitere ms Wachzeit vergangen sind (sleepK: so zählt Schlaf, 0 = gar nicht). Tag für Tag, ohne Grenze
    // nach vorn: auch eine lange Serie oder ein langer Abbau kommt ans Ende.
    _awakeAdd(t, ms, sleepK = 0) {
      const day = new Date(t);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - 1);
      for (let i = 0; i < 20000; i++) {
        const [ws, we] = this._wakeDay(day);
        day.setDate(day.getDate() + 1);
        if (we <= t) continue;
        if (ws > t && sleepK > 0) {
          const d = (ws - t) * sleepK;
          if (d >= ms) return t + ms / sleepK;
          ms -= d;
        }
        const s = Math.max(ws, t);
        if (s + ms <= we) return s + ms;
        ms -= we - s;
        t = we;
      }
      return t + ms;
    }

    // Pflege bewerten. Zwischen zwei Änderungen sinken alle drei Werte nur (satt und glücklich gleichmäßig, sauber nach dem
    // festen Häufchen-Plan). Seit wann einer unter GIFT.min liegt, lässt sich darum jederzeit ausrechnen, auch wenn keiner
    // zugeschaut hat. Läuft vor jeder Änderung (dann steht ein Absinken fest, bevor es überdeckt wird), danach mit user (du
    // hast etwas getan: ist jetzt alles wieder darüber, endet die Lücke) und beim Tick. → { G, frac, left, warn, broken }
    _careEval(user = false) {
      if (!this._giftOn() || !this._stats || !this._plan || !this._planOk || this._planStale) return null;
      if (this._cfg.entity && !this._noEntity && !this._synced) return null;
      const now = this._haNow();
      if (!this._plan.gift) this._planOp({ t: 'gstart', k: sec(now) });
      let G = this._plan.gift;
      if (!G) return null;
      const min = GIFT.min;
      const st = this._stats;
      const lowS = ['s', 'g'].filter((k) => this._raw(k) < min);
      const lowC = this._poops().clean < min;
      const bad = lowS.length > 0 || lowC;
      // Seit wann? Nur nötig, solange es noch nicht feststeht
      const low = [];
      if (bad && G.b == null) {
        for (const k of lowS) low.push(st[k] > min ? this._decayAt(st[k + 't'], (st[k] - min) / RATE[k]) : st[k + 't']);
      }
      if (lowC && bad && G.b == null) {
        // Zeitpunkt eingrenzen (auf der Uhr der Häufchen, die in der Vorschau verstellt sein kann)
        const sh = this._now() - now;
        let lo = Math.max(G.k, now - 2 * 864e5) + sh;
        let hi = now + sh;
        if (this._poops(lo).clean < min) hi = lo;
        else {
          for (let i = 0; i < 16; i++) {
            const m = (lo + hi) / 2;
            if (this._poops(m).clean < min) hi = m;
            else lo = m;
          }
        }
        low.push(hi - sh);
      }
      // Nicht gleich nach der Entwarnung eines anderen Geräts (_hassPlan): Dessen Zustand ist noch unterwegs, der eigene
      // bis dahin veraltet. Liegt wirklich noch etwas darunter, steht es beim nächsten Tick fest.
      if (low.length && Date.now() >= (this._careHold || 0)) this._planOp({ t: 'gbad', k: G.k, b: sec(clamp(Math.min(...low), G.k, now)) });
      G = this._plan.gift;
      const over = G.b != null && this._awakeMs(G.b, now) > GIFT.grace;
      // Verdient bis jetzt bzw. bis die Serie riss. Gezählt wird ab p (bis dahin sind die a verdient), nicht jedes Mal
      // ab Serienbeginn: so verschiebt eine geänderte Schlafenszeit nichts rückwirkend, und auch eine lange Serie
      // rechnet nur die letzten Stunden. Ohne p (Stand einer älteren Version) einmal aus k und a nachrechnen.
      const end = G.b == null ? now : Math.min(now, this._awakeAdd(G.b, GIFT.grace));
      const p = G.p ?? this._awakeAdd(G.k, G.a * GIFT.every);
      const awake = Math.max(0, this._awakeMs(p, end));
      const de = Math.floor(awake / GIFT.every);
      if (de > 0 || G.p == null) this._planOp({ t: 'gearn', k: G.k, e: G.a + de, p: sec(this._awakeAdd(p, de * GIFT.every)) });
      const w = Math.floor((now - G.k) / GIFT.gold);
      if (!over && w > G.d) this._planOp({ t: 'ggold', k: G.k, w });
      let res = { frac: (awake % GIFT.every) / GIFT.every, left: GIFT.every - (awake % GIFT.every), warn: G.b != null && !over, broken: over };
      if (!bad && user && G.b != null) {
        this._planOp({ t: 'gok', k: G.k, b: G.b, brk: over, nk: sec(now) }); // nicht "at": das setzt _planOp
        res = over ? { frac: 0, left: GIFT.every, warn: false, broken: false } : { ...res, warn: false };
      }
      res.G = this._plan.gift;
      this._care = res;
      this._giftRender();
      return res;
    }

    // Bis der Fortschritt einmal berechnet ist, alle 0,5 s versuchen (_careEval braucht Plan, Zustand aus HA und
    // abgeglichenen Stand). Unsichtbar übernimmt das der Tick beim Sichtbarwerden.
    _careSoon() {
      if (this._care || this._careT) return;
      this._careT = setTimeout(() => {
        this._careT = null;
        if (this._care || !this._attached || this._away()) return;
        this._careEval();
        this._careSoon();
      }, 500);
    }

    // Welche Werte gerade unter GIFT.min liegen: s (Satt), g (Glück), c (Sauber), in dieser Reihenfolge
    _giftLow() {
      if (!this._stats) return [];
      const l = ['s', 'g'].filter((k) => this._raw(k) < GIFT.min);
      if (this._poops().clean < GIFT.min) l.push('c');
      return l;
    }

    // Knopf: erscheint mit dem ersten Päckchen, Ring = Fortschritt zum nächsten, Zahl = Vorrat
    _giftRender() {
      const b = this._el?.gbtn;
      if (!b) return;
      const G = this._plan?.gift;
      const on = this._giftOn() && !!G && (G.z > 0 || G.n > 0 || G.y > 0);
      if (!on) {
        b.hidden = true;
        return;
      }
      if (b.hidden) {
        b.hidden = false;
        // Zum allerersten Mal (je Gerät gemerkt): Der Knopf ploppt herein und funkelt
        let seen = true;
        try {
          const k = `pika-pet-gift:${this._cfg.name}`;
          seen = !!localStorage.getItem(k);
          localStorage.setItem(k, '1');
        } catch (e) { /* egal */ }
        if (!seen && this._g) {
          b.classList.add('new');
          setTimeout(() => b.classList.remove('new'), 1000);
          for (let i = 0; i < 5; i++) setTimeout(() => this._sparkle(this._W - 32 + rnd(-16, 16), this._H - 84 + rnd(-16, 16), 1), 300 + i * 150);
          if (!this._asleep && !this._inside && this._running) this._say(pick(['oh!', 'ein Päckchen!']), 1300);
        }
      }
      const c = this._care || {};
      const n = G.n + G.y;
      const full = G.n >= GIFT.max;
      // Fortschritt noch nie berechnet (gerade geladen): Ring leer statt 0 % zeigen und gleich nachrechnen,
      // nicht erst im nächsten Takt (_tick, alle 20 s)
      b.classList.toggle('wait', !this._care && !full);
      if (!this._care) this._careSoon();
      b.style.setProperty('--gp', ((full ? 1 : c.frac || 0) * 100).toFixed(1));
      b.classList.toggle('warn', !!c.warn);
      b.classList.toggle('broken', !!c.broken && !full);
      // Was fehlt, als Zeichen am Knopf. Ist schon wieder alles darüber (nur selbst geknabbert), pulsiert der Ring nicht.
      const low = c.warn || (c.broken && !full) ? this._giftLow() : [];
      b.classList.toggle('ok', !!c.warn && !low.length);
      const ce = b.querySelector('.gcrit');
      if (ce.dataset.k !== (low[0] || '')) {
        ce.dataset.k = low[0] || '';
        ce.innerHTML = low[0] ? GIFT_LOW[low[0]][1] : '';
      }
      b.classList.toggle('empty', !n || G.z > G.o);
      b.classList.toggle('gold', G.y > 0);
      const [pp, pr] = G.y > 0 ? GIFT_GOLD : GIFT_PAPER[(G.z + 1) % GIFT_PAPER.length];
      b.style.setProperty('--gpp', pp);
      b.style.setProperty('--gpr', pr);
      b.querySelector('.gnum').textContent = n ? String(n) : '';
      b.title = n ? `Päckchen schenken (${n} da), lang drücken: Schätze` : 'Päckchen: gerade keins da, lang drücken: Schätze';
    }

    _onGiftBtn() {
      if (this._albumHeld) {
        this._albumHeld = false;
        return;
      }
      const G = this._plan?.gift;
      const b = this._el.gbtn;
      const no = () => {
        b.classList.remove('no');
        void b.offsetWidth;
        b.classList.add('no');
      };
      // Höchstens ein Ballon zugleich
      if (!G || !this._g || !this._planOk || G.z > G.o || !(G.n > 0 || G.y > 0)) return no();
      const gold = G.y > 0;
      const z = G.z + 1;
      const i = this._giftPick(G, z, gold) + (gold ? 16 : 0);
      const x = sec(this._haNow());
      this._planOp({ t: 'give', z, i, gold, x });
      if (this._plan.gift?.z !== z) return no();
      // Leckerli und Freude erst, wenn das Verschenken bestätigt ist (_giftCredit): Drückten zwei Geräte gleichzeitig,
      // gilt nur ein Päckchen, und nur dessen Gerät gibt die Belohnung
      this._giftOwn = { z, i, x, at: this._haNow() };
      this._giftCredit();
    }

    // Belohnung für das eigene Verschenken, sobald es im bestätigten Plan steht (mit Helfer: Stand von HA, sonst der
    // gespeicherte). Hat dort ein anderes Gerät dasselbe Päckchen verschenkt (anderes x/i), gibt es hier nichts.
    // Zählt nicht als Pflege (wie selbst Geknabbertes): Päckchen kommen aus guter Pflege, sie sollen sie nicht ersetzen.
    _giftCredit() {
      const o = this._giftOwn;
      if (!o) return;
      const H = this._cfg.plan_entity && this._planMax() >= PLAN_MIN ? planParse(this._planSt) : null;
      const G = (H || this._planBase)?.gift;
      if (G && G.z >= o.z) {
        this._giftOwn = null;
        if (G.z !== o.z || G.x !== o.x || G.i !== o.i) return;
        if ((o.i & 15) >= GIFT_TRE) this._add('s', GIFT.treat, true);
        this._add('g', GIFT.joy, true);
      } else if (this._haNow() - o.at > 30 * 6e4) this._giftOwn = null;
    }

    // Inhalt des Päckchens Nummer z, auf allen Geräten gleich: Das erste und eins von je dreien ist ein Schatz (goldene
    // immer), sonst ein Leckerli der Jahreszeit. Schatz heißt: erst einer, der noch fehlt, dann ein Trick für einen, der
    // noch keinen hat. Goldene vergolden lieber einen mit Trick, bevor sie einen neuen Trick bringen. Hat jeder Schatz
    // alles, was er aus solchen Päckchen bekommen kann, gibt es nur noch Leckerli.
    _giftPick(G, z, gold) {
      const T = [...Array(GIFT_TRE).keys()];
      const at = (lv) => T.filter((t) => giftLv(G, t) === lv);
      const miss = at(0).length ? at(0) : gold && at(2).length ? at(2) : at(1);
      const tre = miss.length && (gold || z === 1 || (z - 1) % 3 === Math.floor(seedRnd('gblk', Math.floor((z - 1) / 3)) * 3));
      if (tre) return miss[Math.floor(seedRnd('gtre', z) * miss.length)];
      const south = (this._hass?.config?.latitude ?? 50) < 0;
      const mo = (new Date().getMonth() + (south ? 6 : 0)) % 12;
      const ok = GIFT_ITEMS.map((it, n) => n).filter((n) => n >= GIFT_TRE && (!GIFT_ITEMS[n].mo || GIFT_ITEMS[n].mo.includes(mo)));
      return ok[Math.floor(seedRnd('gtreat', z) * ok.length)];
    }

    // Plan geändert: Knopf, Ballon und Schätze nachziehen
    _giftFromPlan() {
      if (!this._el) return;
      const G = this._plan?.gift;
      if (G) {
        this._giftKeep = G;
        this._planKeyGift = this._planKey;
      }
      this._giftRender();
      if (!this._g) return;
      const pend = this._giftOn() && !!G && G.z > G.o;
      const B = this._gb;
      // Abgeschaltet oder ein anderes Päckchen: weg. Auf einem anderen Gerät schon ausgepackt: Schaut hier jemand zu,
      // packt er es auch hier noch aus (sonst verschwände es vor den Augen), sonst ist es weg.
      const mine = !!B && this._giftOn() && !!G && B.z === G.z && B.item === (G.i & 15);
      const watch = this._running && !this._asleep && !this._away();
      if (B && B.stage !== 'open' && !(mine && (pend || watch))) this._giftDrop();
      if (pend && !this._gb) this._giftBalloon(G);
      this._giftScene();
    }

    _giftDrop() {
      const B = this._gb;
      if (!B) return;
      this._gb = null;
      clearTimeout(this._giftArrT);
      B.anim?.cancel();
      B.el.style.transition = 'opacity .8s';
      B.el.style.opacity = '0';
      setTimeout(() => B.el.remove(), 900);
      if (this._action === 'giftShoot' || this._action === 'giftOpen') this._interrupt();
    }

    // Wo der Ballon schwebt (Mitte des Päckchens, px): zwischen Heu und Stein, nicht unter der Statusanzeige
    _giftBalloonX(z) {
      const { fMin, fMax } = this._g;
      const w = this._H * 0.17;
      let lo = fMin * this._W;
      const hi = Math.max(lo, fMax * this._W - w * 0.3);
      const st = this._el.stats;
      if (!st.hidden && st.offsetWidth) lo = Math.min(hi, Math.max(lo, st.offsetLeft + st.offsetWidth + w * 0.6));
      return lo + seedRnd('gx', z) * (hi - lo);
    }

    // Ballon anlegen: schwebt in GIFT.arrive ms von der Seite herein, aus der der Wind kommt, dann bleibt er über der
    // Stelle, wo das Päckchen landen wird, bis der Pika wach ist und ihn herunterholt
    _giftBalloon(G) {
      const z = G.z;
      const gold = G.i >= 16;
      const H = this._H;
      const w = H * 0.17;
      const x = this._giftBalloonX(z);
      const y = H * 0.34;
      const [pp, pr] = gold ? GIFT_GOLD : GIFT_PAPER[z % GIFT_PAPER.length];
      const bc = gold ? '#f2c230' : GIFT_BALLOONS[Math.floor(seedRnd('gbc', z) * GIFT_BALLOONS.length)];
      const el = document.createElement('div');
      el.className = `gbal${gold ? ' gold' : ''}`;
      el.style.cssText = `--gpp:${pp};--gpr:${pr};--gbc:${bc};--gsw:${clamp((this._wind || 0) / 30, 0.35, 1.6).toFixed(2)};`
        + `left:${(x - w / 2).toFixed(1)}px;top:${(y - w * 2 * (66 / 80)).toFixed(1)}px`;
      el.innerHTML = `<div class="gdrift"><div class="gbob">${GIFT_BALLOON}</div></div>`;
      this._el.gifts.appendChild(el);
      const B = { z, el, x, gold, pp, pr, bc, item: G.i & 15, stage: 'hover' };
      this._gb = B;
      const left = G.x + GIFT.arrive - this._haNow();
      const calm = ['idle', 'look', 'wander', 'groom', 'squeak', 'curious', 'nibble'];
      if (left > 0) {
        B.stage = 'fly';
        const dx = this._windDir < 0 ? this._W - x + w : -(x + w);
        const dy = -H * 0.14;
        B.anim = el.animate([
          { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` },
          { transform: `translate(${(dx * 0.4).toFixed(1)}px, ${(-H * 0.06).toFixed(1)}px)`, offset: 0.55 },
          { transform: `translate(${(dx * 0.08).toFixed(1)}px, ${(H * 0.02).toFixed(1)}px)`, offset: 0.85 },
          { transform: 'none' },
        ], { duration: GIFT.arrive, easing: 'ease-out', fill: 'backwards' });
        B.anim.currentTime = Math.max(0, GIFT.arrive - left);
        clearTimeout(this._giftArrT);
        this._giftArrT = setTimeout(() => {
          if (this._gb !== B) return;
          // Angekommen (läuft die Animation hinterher, z. B. gedrosselt, steht er jetzt trotzdem an seinem Platz)
          B.anim?.finish();
          B.anim = null;
          B.stage = 'hover';
          if (calm.includes(this._action)) this._interrupt();
        }, left);
        // Er hat ihn schon kommen sehen
        if (!this._asleep && !this._inside && this._running && calm.includes(this._action)) {
          setTimeout(() => this._gb === B && this._action !== 'giftShoot' && this._say('oh?', 1000), Math.min(left, 2500));
        }
      } else if (!this._asleep && calm.includes(this._action)) this._interrupt();
    }

    _giftDue() {
      const B = this._gb;
      if (!B || this._asleep || this._wx.shelter || this._next || !this._giftOn()) return null;
      if (B.stage === 'ground') return 'giftOpen';
      return B.stage === 'hover' ? 'giftShoot' : null;
    }

    // Vom Aussichtsstein mit der Zwille: zielen (ein Auge zu), schnapp! Manchmal geht der erste daneben.
    async _giftShoot() {
      const B = this._gb;
      if (!B || B.stage !== 'hover') return;
      B.anim?.finish();
      B.anim = null;
      const p = this._el.pika;
      const { rock } = this._g;
      this._face(B.x >= this._x ? 1 : -1);
      p.classList.add('look-up');
      this._say(pick(['oh!', 'ein Ballon!', 'ein Päckchen!']), 1500);
      this._cls('sparkle', 1800);
      await this._wait(1400);
      p.classList.remove('look-up');
      await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1), 1.4);
      if (this._bird?.perch === 'rock') {
        this._bird.scare();
        await this._wait(600);
      }
      await this._hopTo(rock.cx, rock.lift);
      this._puff(rock.cx, this._g.gy - rock.lift, 2);
      this._face(B.x >= rock.cx ? 1 : -1);
      await this._wait(500);
      p.classList.add('sling');
      await this._wait(600);
      const miss = seedRnd('gmiss', B.z) < 0.35;
      for (let shot = 0; shot < (miss ? 2 : 1); shot++) {
        p.classList.add('aim', 'look-up', 'squint');
        await this._wait(rnd(1100, 1700));
        p.classList.add('snap');
        const hit = !miss || shot === 1;
        await this._giftPebble(hit);
        p.classList.remove('squint');
        if (hit) {
          this._giftPop();
          await this._wait(300);
          p.classList.remove('aim', 'look-up');
          this._say(pick(['getroffen!', 'juhu!', 'Treffer!']), 1300);
          this._jump('hop1');
        } else {
          this._say(pick(['knapp!', 'hoppla…', 'daneben!']), 1100);
          await this._wait(500);
          p.classList.remove('snap', 'aim');
          this._twitch();
          await this._wait(900);
        }
      }
      await this._wait(900);
      p.classList.remove('sling', 'snap');
      await this._hopDown();
    }

    // Steinchen aus der Zwille zum Ballon; daneben (hit = false) saust es vorbei
    async _giftPebble(hit) {
      const B = this._gb;
      if (!B || B.stage !== 'hover') return;
      const sc = this._el.scene.getBoundingClientRect();
      const f = this._el.pika.querySelector('.slf').getBoundingClientRect();
      const t = B.el.querySelector('.gb-ball').getBoundingClientRect();
      const x0 = f.left - sc.left + f.width / 2;
      const y0 = f.top - sc.top + f.height / 2;
      let x1 = t.left - sc.left + t.width / 2;
      let y1 = t.top - sc.top + t.height / 2;
      if (!hit) {
        x1 += (x1 > x0 ? 1 : -1) * t.width * 0.9;
        y1 -= t.height * 0.8;
        x1 = x0 + (x1 - x0) * 1.7;
        y1 = y0 + (y1 - y0) * 1.7;
      }
      const el = document.createElement('span');
      el.className = 'gpeb';
      el.style.left = `${x0.toFixed(1)}px`;
      el.style.top = `${y0.toFixed(1)}px`;
      this._el.fx.appendChild(el);
      const ms = hit ? 300 : 520;
      el.animate([{ transform: 'none' }, { transform: `translate(${(x1 - x0).toFixed(1)}px, ${(y1 - y0).toFixed(1)}px)`, opacity: hit ? 1 : 0 }],
        { duration: ms, easing: 'cubic-bezier(.2, .6, .5, 1)', fill: 'forwards' });
      setTimeout(() => el.remove(), ms + 40);
      await this._wait(ms);
    }

    // Plopp: Konfetti, der Ballon ist weg, das Päckchen fällt auf die Wiese und hüpft einmal auf
    _giftPop() {
      const B = this._gb;
      if (!B || B.stage !== 'hover') return;
      const sc = this._el.scene.getBoundingClientRect();
      const r = (el) => {
        const q = el.getBoundingClientRect();
        return { x: q.left - sc.left + q.width / 2, y: q.top - sc.top + q.height / 2, h: q.height, b: q.bottom - sc.top };
      };
      const ball = r(B.el.querySelector('.gb-ball'));
      const par = r(B.el.querySelector('.gb-p'));
      const cols = B.gold ? ['#f2c230', '#fff2b0', '#ffffff', '#ffd75a'] : [B.bc, ...GIFT_BALLOONS];
      for (let i = 0; i < 12; i++) {
        const c = document.createElement('span');
        c.className = 'gconf';
        const a = (i / 12) * Math.PI * 2 + rnd(-0.3, 0.3);
        const d = this._H * rnd(0.06, 0.14);
        c.style.cssText = `left:${ball.x.toFixed(1)}px;top:${ball.y.toFixed(1)}px;background:${i % 2 ? B.bc : cols[i % cols.length]};`
          + `--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d + this._H * 0.06).toFixed(1)}px;--r:${rnd(-320, 320).toFixed(0)}deg`;
        this._el.fx.appendChild(c);
        setTimeout(() => c.remove(), 1050);
      }
      this._peep(ball.x, ball.y - ball.h * 0.3, 'plopp!');
      B.anim?.cancel();
      B.el.remove();
      const el = document.createElement('div');
      el.className = `gpar${B.gold ? ' gold' : ''}`;
      el.style.cssText = `--gpp:${B.pp};--gpr:${B.pr};left:${par.x.toFixed(1)}px`;
      el.innerHTML = GIFT_PARCEL;
      this._el.gifts.appendChild(el);
      const dy = par.b - (this._g.gy + 3);
      el.animate([
        { transform: `translateY(${dy.toFixed(1)}px) rotate(-10deg)` },
        { transform: 'translateY(0) rotate(5deg) scale(1.12, .84)', offset: 0.72 },
        { transform: `translateY(${(-this._H * 0.03).toFixed(1)}px) rotate(-2deg)`, offset: 0.86 },
        { transform: 'none' },
      ], { duration: 900, easing: 'cubic-bezier(.45, 0, .7, 1)' });
      Object.assign(B, { el, x: par.x, stage: 'ground', anim: null });
      setTimeout(() => this._g && this._puff(par.x, this._g.gy, 2), 650);
    }

    // Hinhoppeln, schnuppern, Schleife aufzupfen, Deckel springt ab: Leckerli frisst er, Schätze kommen an ihren Platz
    async _giftOpen() {
      const B = this._gb;
      if (!B || B.stage !== 'ground') return;
      const p = this._el.pika;
      const { gy } = this._g;
      this._say('!', 900);
      await this._wait(350);
      // etwas Abstand, damit man Päckchen und Inhalt sieht
      const side = B.x >= this._x ? 1 : -1;
      await this._walkTo(B.x - side * this._g.pW * 0.62, 1.4);
      this._face(side);
      p.classList.add('sniff');
      await this._wait(900);
      p.classList.remove('sniff');
      p.classList.add('groom');
      await this._wait(1000);
      // Ab hier gilt es als ausgepackt, auch auf den anderen Geräten
      B.stage = 'open';
      // Stufe nach dem Auspacken (1 neu, 2 Trick, 3 golden); bis zum Verstauen zeigt die Szene noch die alte
      const PG = this._plan?.gift;
      const lv = B.item < GIFT_TRE && PG?.z === B.z ? giftLv(PG, B.item) : 1;
      this._giftHide = B.item < GIFT_TRE ? B.item : null;
      this._planOp({ t: 'gopen', z: B.z });
      const it = GIFT_ITEMS[B.item];
      let ie = null;
      try {
        B.el.querySelector('.gp-bow').classList.add('off');
        await this._wait(450);
        p.classList.remove('groom');
        B.el.querySelector('.gp-lid').classList.add('off');
        this._sparkle(B.x, gy - this._H * 0.1, B.gold ? 8 : 4);
        ie = document.createElement('div');
        ie.className = `gitem rise${B.gold ? ' gold' : ''}${lv === 3 ? ' gilt' : ''}`;
        ie.innerHTML = it.svg;
        ie.style.left = `${B.x.toFixed(1)}px`;
        ie.style.top = `${(gy - this._H * 0.2).toFixed(1)}px`;
        this._el.fx.appendChild(ie);
        this._cls('sparkle', 2600);
        await this._wait(1000);
        B.el.classList.add('fade');
        if (B.item >= GIFT_TRE) {
          this._say(`${it.name}!`, 1400);
          await this._wait(1100);
          ie.classList.add('eat');
          await this._eat(it.color, 3200, it.svg);
          this._cls('mlem', 950, true);
          this._happy();
          this._jump('hop1');
          await this._wait(1300);
        } else {
          this._happy(1800);
          this._jump(B.gold ? 'binky' : 'hop1');
          const nm = it.key === 'plush' ? `Plüsch-${this._frName()}` : it.name;
          this._say(lv === 2 ? `neuer Trick: ${GIFT_TRICK[B.item]}!` : lv === 3 ? `${GIFT_GILT[B.item].replace('%', nm)}!`
            : it.key === 'plush' ? `ein ${nm}!` : it.say, 1800);
          if (lv === 3) for (let i = 0; i < 3; i++) setTimeout(() => this._g && this._sparkle(B.x, gy - this._H * 0.25, 2), 300 + i * 400);
          await this._wait(1900);
          await this._giftStow(B.item, ie, lv);
        }
      } finally {
        B.el.classList.add('fade');
        const el = B.el;
        setTimeout(() => el.remove(), 900);
        ie?.remove();
        this._giftHide = null;
        if (this._gb === B) this._gb = null;
        // Nicht nur die Schätze nachziehen: Wurde während des Auspackens schon das nächste Päckchen verschenkt, stand
        // dieses hier dem neuen Ballon im Weg (_giftFromPlan legt nur einen an, wenn keiner da ist). Jetzt kommt er.
        this._giftFromPlan();
      }
    }

    // Neuer Schatz an seinen Platz: fliegt hin und ploppt dort auf. Getragene probiert er gleich aus, einen neuen Trick
    // führt er gleich vor, golden funkelt er.
    async _giftStow(t, ie, lv = 1) {
      const key = GIFT_ITEMS[t].key;
      const p = this._el.pika;
      const sc = this._el.scene.getBoundingClientRect();
      this._giftHide = null;
      if (this._gb) this._gb.stowed = true;
      this._giftScene();
      const tgt = this._gtEls?.get(t);
      const from = ie.getBoundingClientRect();
      let to;
      if (tgt) {
        tgt.style.opacity = '0';
        to = tgt.getBoundingClientRect();
      } else {
        // Sonnenbrille und Fernrohr zum Pika, Plüsch-Pino in den Bau
        const { pW, pH, gy, hole } = this._g;
        const hx = key === 'plush' ? hole.cx : this._x + this._dir * pW * 0.25;
        const hy = key === 'plush' ? hole.top + (hole.lip - hole.top) * 0.5 : gy - pH * 0.55;
        to = { left: sc.left + hx - 4, top: sc.top + hy - 4, width: 8, height: 8 };
      }
      const k = clamp(to.width / Math.max(1, from.width), 0.1, 3);
      const cur = getComputedStyle(ie).transform;
      ie.animate([
        { transform: cur === 'none' ? 'none' : cur },
        { transform: `translate(${(to.left + to.width / 2 - from.left - from.width / 2).toFixed(1)}px, ${(to.top + to.height / 2 - from.top - from.height / 2).toFixed(1)}px) scale(${k.toFixed(2)})`, opacity: tgt ? 1 : 0.2 },
      ], { duration: 750, easing: 'cubic-bezier(.4, 0, .3, 1)', fill: 'forwards' });
      await this._wait(750);
      ie.remove();
      if (tgt) {
        tgt.style.opacity = '';
        tgt.classList.add('new');
        setTimeout(() => tgt.classList.remove('new'), 800);
        this._sparkle(to.left - sc.left + to.width / 2, to.top - sc.top + to.height * 0.3, 3);
      }
      if (key === 'shades') {
        this._coolUntil = this._haNow() + 60000;
        this._giftDress();
        p.classList.add('cool');
        if (lv === 2) return this._giftShades();
        this._say(lv === 3 ? 'goldig!' : 'cool!', 1500);
        await this._wait(2500);
      } else if (lv === 2) {
        await this._wait(500);
        await this._giftTrick(t);
      } else if (lv === 3) {
        this._giftDress();
        this._say(pick(['ooh!', 'glänzt!', 'wie schön!']), 1400);
        await this._wait(1600);
      } else if (key === 'scope') {
        p.classList.add('spy', 'look-up');
        this._say('ahoi!', 1300);
        await this._wait(2400);
        p.classList.remove('spy', 'look-up');
      } else if (key === 'plush') {
        this._blush(2000);
        this._say('♥', 1300);
        await this._wait(1500);
      } else if (key === 'bell') {
        this._giftBell();
        await this._wait(1200);
      } else if (key === 'wheel') {
        p.classList.add('look-b');
        await this._wait(1500);
        p.classList.remove('look-b');
      }
    }

    // Schätze in der Szene: Windrad und Glöckchen am Bau, Plüsch-Pino nachts im Bett, auf der Wiese höchstens zwei
    // (Wollknäuel, Gießkanne, Hängematte; welche, wechselt jeden Tag, der neueste ist immer dabei)
    _giftScene() {
      if (!this._el || !this._g) return;
      const G = this._plan?.gift;
      // ohne den noch nicht ausgepackten, und den gerade ausgepackten noch auf seiner alten Stufe
      // ebenso der, der hier noch am Ballon hängt oder im Päckchen liegt (woanders schon ausgepackt)
      const B = this._gb;
      const hide = this._giftHide ?? (B && !B.stowed && B.item < GIFT_TRE && G && B.z === G.z ? B.item : null);
      const lvs = this._giftOn() ? giftLvs(G, hide) : [];
      const has = (t) => lvs[t] > 0;
      const newest = G && G.o === G.z && (G.i & 15) < GIFT_TRE ? G.i & 15 : -1;
      const day = pikaDay(this._haNow());
      let meadow = [0, 5, 6].filter(has);
      if (meadow.length > 2) {
        const rest = meadow.filter((t) => t !== newest).sort((a, b) => seeded(day, a, 71) - seeded(day, b, 71));
        meadow = [...(meadow.includes(newest) ? [newest] : []), ...rest].slice(0, 2);
      }
      const want = new Set(meadow);
      if (has(1)) want.add(1);
      if (has(7)) want.add(7);
      if (has(2) && (this._asleep || this._plushX != null)) want.add(2);
      this._el.gifts.classList.toggle('still', !!this._asleep);
      const E = (this._gtEls ??= new Map());
      for (const [t, el] of E) {
        if (want.has(t)) continue;
        el.remove();
        E.delete(t);
      }
      for (const t of want) {
        let el = E.get(t);
        if (!el) {
          const key = GIFT_ITEMS[t].key;
          el = document.createElement('div');
          el.className = `gt gt-${key === 'hammock' ? 'ham' : key}`;
          el.innerHTML = key === 'wheel' ? GIFT_WHEEL : key === 'hammock' ? GIFT_HAMMOCK : GIFT_ITEMS[t].svg;
          // Plüsch-Pino liegt vor ihm im Arm, also vor dem schlafenden Pika
          (key === 'plush' ? this._el.fx : this._el.gifts).appendChild(el);
          E.set(t, el);
        }
        el.classList.toggle('gilt', lvs[t] >= 3);
        if (t === 2) el.classList.toggle('out', this._plushX != null);
        this._giftPlace(t, el);
      }
      // Windrad: dreht sich mit dem Wind, bei Flaute ganz langsam (angepustet kurz schnell)
      const blow = this._haNow() < (this._blowUntil || 0);
      E.get(1)?.style.setProperty('--gws', `${blow ? 0.32 : clamp(9 - (this._wind || 0) / 4, 0.35, 9).toFixed(2)}s`);
      this._giftDress(lvs);
    }

    _giftPlace(t, el) {
      const { hole } = this._g;
      const H = this._H;
      const key = GIFT_ITEMS[t].key;
      let x;
      let top = null;
      if (key === 'wheel') x = Math.min(this._g.hayR + H * 0.05, this._g.fMax * this._W);
      else if (key === 'bell') {
        x = hole.cx + (hole.r - hole.cx) * 0.62;
        top = hole.top + (hole.lip - hole.top) * 0.06;
      } else if (key === 'plush' && this._plushX != null) {
        // tagsüber zum Kuscheln draußen auf der Wiese
        x = this._plushX;
        top = this._g.gy - H * 0.13 * 0.92;
      } else if (key === 'plush') {
        x = hole.l + (hole.r - hole.l) * 0.32;
        top = hole.lip - H * 0.085 * 0.82;
      } else x = this._giftX(t);
      el.style.left = `${x.toFixed(1)}px`;
      if (top != null) el.style.top = `${top.toFixed(1)}px`;
    }

    // Platz der Wiesen-Schätze (px): fest je Tag. Das Wollknäuel bleibt liegen, wo es hingerollt ist.
    _giftX(t) {
      const { fMin, fMax } = this._g;
      const W = this._W;
      const key = GIFT_ITEMS[t].key;
      if (key === 'yarn' && this._yarnXf != null) return clamp(this._yarnXf, fMin, fMax) * W;
      if (key === 'can') return Math.max(this._H * 0.05, this._g.hole.l - this._H * 0.07);
      const u = seeded(pikaDay(this._haNow()), t, 73);
      if (key === 'hammock') return (fMin + (0.45 + 0.25 * u) * (fMax - fMin)) * W;
      return (fMin + u * (fMax - fMin)) * W;
    }

    // Glöckchen an der Tür bimmelt (er kommt heraus, Pino kommt an)
    _giftBell(text = 'bimm!') {
      const el = this._gtEls?.get(7);
      if (!el || this._away()) return;
      el.classList.remove('ring');
      void el.offsetWidth;
      el.classList.add('ring');
      clearTimeout(this._bellT);
      this._bellT = setTimeout(() => el.classList.remove('ring'), 1700);
      const r = el.getBoundingClientRect();
      const s = this._el.scene.getBoundingClientRect();
      this._peep(r.left - s.left + r.width, r.top - s.top, text);
    }

    _layoutGift(first) {
      const B = this._gb;
      if (B && B.stage !== 'open' && (first || B.stage !== 'ground')) {
        // Ballon an festen Pixeln: neu anlegen (die Zeitleiste stimmt weiter)
        clearTimeout(this._giftArrT);
        B.anim?.cancel();
        B.el.remove();
        this._gb = null;
        if (this._action === 'giftShoot') this._interrupt();
      } else if (B?.stage === 'ground') {
        B.x = this._giftBalloonX(B.z);
        B.el.style.left = `${B.x.toFixed(1)}px`;
        if (this._action === 'giftOpen') this._interrupt();
      }
      this._giftFromPlan();
    }

    // Karte aus dem DOM (anderes Dashboard): Zeitgeber abräumen. Ein fliegender Ballon wird beim Wiederkommen nach
    // seiner Zeitleiste neu angelegt (sonst bliebe er ohne Ankunfts-Zeitgeber im Flug).
    _detachGift() {
      clearTimeout(this._albumPT);
      clearTimeout(this._bellT);
      clearTimeout(this._giftArrT);
      this._albumHeld = false;
      this._gtEls?.get(7)?.classList.remove('ring');
      const B = this._gb;
      if (B?.stage === 'fly') {
        B.anim?.cancel();
        B.el.remove();
        this._gb = null;
      }
    }

    _attachGift() {
      this._giftFromPlan();
    }

    _tickGift() {
      if (!this._g) return;
      this._careEval();
      this._giftScene();
      const G = this._plan?.gift;
      if (!G || !this._giftOn()) return;
      // Sonnenbrille bei Sonne ab 24 °C (und eine Minute nach dem Auspacken)
      const raw = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
      const e = this._dbgElev ?? this._elev;
      const sunny = ['sunny', 'clear', 'partlycloudy'].includes(raw.cond) && (e == null || e > 15) && (raw.temp ?? 0) >= 24;
      const cool = !!(giftOwned(G) & 8) && !this._wx.wet && !this._asleep && (sunny || this._haNow() < (this._coolUntil || 0));
      this._el.pika.classList.toggle('cool', cool);
      this._giftGlint();
      // Voller Vorrat: der Knopf wackelt ab und zu
      const b = this._el.gbtn;
      if (G.n >= GIFT.max && !b.hidden && Math.random() < 0.25) {
        b.classList.remove('wig');
        void b.offsetWidth;
        b.classList.add('wig');
      }
    }

    _giftActs({ wx }) {
      const G = this._plan?.gift;
      if (!this._giftOn() || !G || !G.u || this._gb) return [];
      const E = this._gtEls || new Map();
      const dry = !wx.wet && !wx.snowcover;
      const h = new Date(this._dbgDate ?? Date.now()).getHours();
      const lv = giftLvs(G);
      const dusk = this._el.scene.classList.contains('dusk') && !this._asleep;
      return [
        [E.has(0) && dry ? (lv[0] >= 2 ? 0.7 : 0.5) : 0, 'giftYarn'],
        [E.has(6) && dry && this._flowers.length < 7 ? 0.35 : 0, 'giftWater'],
        [E.has(5) && dry ? (h >= 12 && h < 18 ? 0.45 : 0.1) : 0, 'giftHammock'],
        [lv[4] && dry ? (this._planeToWatch() ? 3 : lv[4] >= 2 && dusk && wx.cover < 70 && !wx.fog ? 1.5 : 0.3) : 0, 'giftScope'],
        // Tricks (Stufe 2)
        [E.has(1) && lv[1] >= 2 && !wx.wet && (this._wind || 0) < 12 ? 0.3 : 0, 'giftBlow'],
        [lv[2] >= 2 && dry && !dusk ? 0.25 : 0, 'giftPlush'],
        [lv[3] >= 2 && this._el.pika.classList.contains('cool') ? 0.6 : 0, 'giftShades'],
        [E.has(7) && lv[7] >= 2 ? 0.25 : 0, 'giftTune'],
      ];
    }

    // Wollknäuel anstupsen, es kullert, er hinterher
    async _giftYarn() {
      const el = this._gtEls?.get(0);
      if (!el) return;
      const p = this._el.pika;
      const { pW, fMin, fMax } = this._g;
      const W = this._W;
      await this._approach(this._giftX(0), 1.2);
      const n = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        p.classList.add('crouch');
        await this._wait(260);
        p.classList.remove('crouch');
        this._jump('hop1');
        const from = this._giftX(0);
        const to = clamp(from + this._dir * W * rnd(0.12, 0.28), fMin * W, fMax * W);
        this._yarnXf = to / W;
        this._yarnRot = (this._yarnRot || 0) + ((to - from) / (Math.PI * this._H * 0.075)) * 360;
        el.style.transition = 'left 1.2s cubic-bezier(.2, .7, .4, 1)';
        el.style.left = `${to.toFixed(1)}px`;
        el.querySelector('svg').style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
        this._say(pick(['hihi!', 'kuller!', 'fang!', 'hopp!']), 1000);
        await this._wait(450);
        if (Math.abs(to - from) < 4) break;
        await this._walkTo(to - this._dir * pW * 0.42, 1.9);
      }
      el.style.transition = '';
      if (giftLvs(this._plan?.gift)[0] >= 2 && Math.random() < 0.6) return this._giftHeader();
      this._happy(1000);
      await this._wait(800);
    }

    // Trick des Wollknäuels: mit der Nase hochstupsen, Kopfball, es fliegt im Bogen weiter über die Wiese
    async _giftHeader() {
      const el = this._gtEls?.get(0);
      if (!el) return;
      const p = this._el.pika;
      const { pW, pH, fMin, fMax } = this._g;
      const W = this._W;
      await this._approach(this._giftX(0), 1.2);
      const x0 = this._giftX(0);
      const dir = this._dir;
      const hx = this._x + dir * pW * 0.22 - x0;
      const hy = -pH * 0.72;
      // Richtung mit genug Platz, notfalls über ihn hinweg nach hinten
      const room = dir > 0 ? fMax * W - x0 : x0 - fMin * W;
      const kd = room > W * 0.15 ? dir : -dir;
      const x1 = clamp(x0 + kd * W * rnd(0.15, 0.3), fMin * W, fMax * W);
      p.classList.add('crouch');
      await this._wait(260);
      p.classList.remove('crouch');
      this._say('hopp!', 700);
      // hoch über den Kopf, er springt ihm entgegen
      const up = el.animate([
        { transform: 'none' },
        { transform: `translate(${(hx * 0.6).toFixed(1)}px, ${(hy * 1.7).toFixed(1)}px)`, offset: 0.55 },
        { transform: `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px)` },
      ], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
      setTimeout(() => this._g && this._jump('hop1'), 520);
      await this._wait(900);
      this._say('Kopfball!', 1200);
      const dx = x1 - x0;
      const away = el.animate([
        { transform: `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px)` },
        { transform: `translate(${((hx + dx) / 2).toFixed(1)}px, ${(hy * 1.6).toFixed(1)}px)`, offset: 0.45 },
        { transform: `translate(${dx.toFixed(1)}px, 0)`, offset: 0.85 },
        { transform: `translate(${dx.toFixed(1)}px, ${(hy * 0.12).toFixed(1)}px)`, offset: 0.93 },
        { transform: `translate(${dx.toFixed(1)}px, 0)` },
      ], { duration: 1100, easing: 'ease-in-out', fill: 'forwards' });
      up.cancel();
      this._yarnRot = (this._yarnRot || 0) + kd * 540;
      el.querySelector('svg').style.transform = `rotate(${this._yarnRot.toFixed(0)}deg)`;
      await this._wait(1100);
      this._yarnXf = x1 / W;
      el.style.left = `${x1.toFixed(1)}px`;
      away.cancel();
      this._puff(x1, this._g.gy, 2);
      this._happy(1400);
      this._jump('binky');
      this._say(pick(['Tor!', 'jaaa!', 'hihi!']), 1200);
      await this._wait(1300);
    }

    // Gießkanne holen, Blumen gießen, zwei neue wachsen
    async _giftWater() {
      const can = this._gtEls?.get(6);
      if (!can) return;
      const p = this._el.pika;
      const { pW, fMin, fMax, gy } = this._g;
      const W = this._W;
      const cx = this._giftX(6);
      await this._approach(cx, 1);
      can.classList.add('away');
      p.classList.add('wcan');
      try {
        this._say(pick(['gießen!', 'Wasser marsch!', 'plitsch!']), 1200);
        await this._wait(500);
        // zu einer Stelle mit wenig Blumen
        let best = null;
        for (let i = 0; i < 8; i++) {
          const xf = rnd(fMin, fMax);
          const d = Math.min(1, ...this._flowers.map((f) => Math.abs(f.xf - xf)));
          if (!best || d > best.d) best = { xf, d };
        }
        const spot = best.xf * W;
        const dir = spot >= this._x ? 1 : -1;
        await this._walkTo(spot - dir * pW * 0.52, 0.9);
        this._face(dir);
        await this._wait(300);
        p.classList.add('pour');
        await this._wait(400);
        const sx = this._x + dir * pW * 0.5;
        // Trick: Regenbogen im Wasserstrahl, wenn die Sonne scheint
        const lvW = giftLvs(this._plan?.gift)[6];
        if (lvW >= 2 && this._wx.cover < 70 && !this._el.scene.classList.contains('night')) this._giftRainbow(sx, gy - this._H * 0.12, dir);
        for (let i = 0; i < 12; i++) {
          const d = document.createElement('span');
          d.className = 'gdrop';
          d.style.left = `${(sx + rnd(-pW * 0.05, pW * 0.05)).toFixed(1)}px`;
          d.style.top = `${(gy - this._H * 0.14 + rnd(-2, 2)).toFixed(1)}px`;
          this._el.fx.appendChild(d);
          setTimeout(() => d.remove(), 600);
          await this._wait(160);
        }
        p.classList.remove('pour');
        await this._wait(500);
        const nf = lvW >= 2 ? 3 : 2;
        for (let i = 0; i < nf && this._flowers.length < 8; i++) {
          this._addFlower(true, (sx + (nf === 2 ? (i ? 1 : -1) * rnd(8, 20) : (i - 1) * rnd(12, 20))) / W);
        }
        this._say(pick(['wachs!', 'hübsch!', '♥']), 1200);
        this._happy(1000);
        await this._wait(1600);
        await this._approach(cx, 1);
      } finally {
        p.classList.remove('wcan', 'pour');
        can.classList.remove('away');
      }
    }

    // Nachmittags ein Nickerchen in der Hängematte
    async _giftHammock() {
      const el = this._gtEls?.get(5);
      if (!el) return;
      const p = this._el.pika;
      const { pW } = this._g;
      const cx = this._giftX(5);
      await this._walkTo(cx + (this._x < cx ? -1 : 1) * pW * 0.95, 1);
      this._say(pick(['Nickerchen…', '*gähn*', 'Päuschen!']), 1300);
      await this._wait(800);
      this._onHam = true;
      await this._hopTo(cx, pW * GIFT_HAM_W * GIFT_HAM_LIFT);
      p.classList.add('lying');
      if (giftLvs(this._plan?.gift)[5] >= 2 && (this._dbgSwing || Math.random() < 0.7)) await this._giftSwing(el);
      this._dbgSwing = false;
      el.classList.add('sway');
      await this._wait(900);
      p.classList.add('doze');
      await this._wait(rnd(18000, 32000));
      await this._giftHamDown();
    }

    async _giftHamDown() {
      const p = this._el.pika;
      const el = this._gtEls?.get(5);
      p.classList.remove('doze');
      if (p.classList.contains('lying')) {
        this._say(pick(['ausgeschlafen!', '*streck*', 'hmm…']), 1200);
        await this._wait(900);
      }
      p.classList.remove('lying', 'hswing');
      el?.classList.remove('sway', 'swing');
      const cx = el ? this._giftX(5) : this._x;
      await this._hopTo(cx + pick([-1, 1]) * this._g.pW * 0.95, 0);
      this._onHam = false;
      this._puff(this._x, this._g.gy, 2);
    }

    // Mit dem Fernrohr auf dem Stein: Ausschau halten, am liebsten nach Flugzeugen
    async _giftScope() {
      const p = this._el.pika;
      const { rock } = this._g;
      await this._walkTo((this._x > rock.cx && this._footX(1)) || this._footX(-1));
      if (this._bird?.perch === 'rock') {
        this._bird.scare();
        await this._wait(600);
      }
      await this._hopTo(rock.cx, rock.lift);
      this._puff(rock.cx, this._g.gy - rock.lift, 2);
      await this._wait(500);
      p.classList.add('spy');
      // Trick: in der Dämmerung schaut er nach den ersten Sternen
      const stars = giftLvs(this._plan?.gift)[4] >= 2 && this._el.scene.classList.contains('dusk');
      for (let i = 0; i < 3; i++) {
        const pl = this._planeToWatch();
        if (pl) this._face(pl.x >= this._x ? 1 : -1);
        else if (i) this._face(-this._dir);
        p.classList.toggle('look-up', !!pl || stars || Math.random() < 0.5);
        if (pl) {
          this._memo('plane');
          this._say(pick(['Flugzeug!', 'da oben!', 'brumm!']), 1300);
        } else if (stars) {
          const sx = clamp(this._x + this._dir * this._W * rnd(0.15, 0.35), 10, this._W - 10);
          this._sparkle(sx, this._H * rnd(0.08, 0.2), 1);
          this._say(pick(['ein Stern!', 'Abendstern!', 'noch einer!', 'funkel!', 'wünsch dir was!']), 1400);
        } else if (Math.random() < 0.5) this._say(pick(['Land in Sicht!', 'ahoi!', 'hmm…', 'ich seh dich!']), 1300);
        await this._wait(rnd(1800, 3000));
      }
      p.classList.remove('spy', 'look-up');
      await this._wait(400);
      await this._hopDown();
    }

    // ---------- Tricks (Stufe 2) und Gold (Stufe 3) ----------

    // Neuen Trick gleich nach dem Auspacken vorführen (kurz)
    async _giftTrick(t) {
      const key = GIFT_ITEMS[t].key;
      const p = this._el.pika;
      if (key === 'yarn' && this._gtEls?.has(0)) return this._giftHeader();
      if (key === 'wheel') return this._giftBlow();
      if (key === 'plush') return this._giftPlush(4000);
      if (key === 'bell') return this._giftTune();
      if (key === 'scope') {
        p.classList.add('spy', 'look-up');
        this._sparkle(clamp(this._x + this._dir * this._W * 0.2, 10, this._W - 10), this._H * 0.12, 2);
        this._say('Sterne gucken!', 1500);
        await this._wait(2400);
        p.classList.remove('spy', 'look-up');
        return;
      }
      if (key === 'hammock') {
        const el = this._gtEls?.get(5);
        el?.classList.add('swing');
        this._say('hui!', 1200);
        await this._wait(2600);
        el?.classList.remove('swing');
        return;
      }
      if (key === 'can') {
        const el = this._gtEls?.get(6);
        const r = el?.getBoundingClientRect();
        const sc = this._el.scene.getBoundingClientRect();
        if (r) this._giftRainbow(r.left - sc.left + r.width * 0.9, r.top - sc.top, 1);
        this._say('ein Regenbogen!', 1500);
        await this._wait(2400);
      }
    }

    // Goldene Schätze, die er trägt bzw. hält: Sonnenbrille, Fernrohr, Gießkanne (lvs: Stufen aus _giftScene)
    _giftDress(lvs) {
      const p = this._el?.pika;
      if (!p) return;
      const lv = lvs || (this._giftOn() ? giftLvs(this._plan?.gift, this._giftHide) : []);
      p.classList.toggle('g-shd', lv[3] >= 3);
      p.classList.toggle('g-scp', lv[4] >= 3);
      p.classList.toggle('g-can', lv[6] >= 3);
    }

    // Trick des Windrads: bei wenig Wind hinhoppeln und es anpusten, dann dreht es sich kurz ganz schnell
    async _giftBlow() {
      const el = this._gtEls?.get(1);
      if (!el) return;
      const p = this._el.pika;
      const { pW, pH, gy } = this._g;
      const r = el.getBoundingClientRect();
      const sc = this._el.scene.getBoundingClientRect();
      const wx = r.left - sc.left + r.width / 2;
      // mit Abstand daneben (meist rechts davon, links steht der Bau), damit man das Windrad sieht
      const side = wx + pW * 0.85 < this._g.fMax * this._W ? 1 : -1;
      await this._walkTo(wx + side * pW * 0.8, 1);
      this._face(-side);
      await this._wait(300);
      p.classList.add('look-up', 'puffy');
      await this._wait(500);
      this._say('puuuh!', 1300);
      this._blowUntil = this._haNow() + 3500;
      this._giftScene();
      const mx = this._x + this._dir * pW * 0.45;
      const my = gy - pH * 0.5;
      for (let i = 0; i < 4; i++) {
        const a = document.createElement('span');
        a.className = 'gair';
        a.style.left = `${mx.toFixed(1)}px`;
        a.style.top = `${(my + rnd(-3, 3)).toFixed(1)}px`;
        a.style.setProperty('--dx', `${(wx - mx).toFixed(1)}px`);
        a.style.setProperty('--dy', `${(r.top - sc.top + r.width * 0.25 - my).toFixed(1)}px`);
        a.style.animationDelay = `${i * 110}ms`;
        this._el.fx.appendChild(a);
        setTimeout(() => a.remove(), 900 + i * 110);
      }
      await this._wait(700);
      p.classList.remove('puffy');
      await this._wait(1600);
      p.classList.remove('look-up');
      this._say(pick(['huii!', 'schnell!', 'hihi!']), 1100);
      this._happy(1200);
      await this._wait(1400);
      this._giftScene();
    }

    // Trick des Plüsch-Pinos: tagsüber aus dem Bau holen und auf der Wiese mit ihm kuscheln
    async _giftPlush(ms = rnd(6000, 10000)) {
      const p = this._el.pika;
      const { hole, pW, gy } = this._g;
      try {
        if (this._action !== 'giftOpen') {
          await this._walkTo(hole.cx + pW * 0.15, 1);
          this._face(-1);
          await this._wait(500);
          this._say(pick([`komm, ${this._frName()}!`, 'hab dich!']), 1200);
          await this._wait(900);
          // mit ihm hinaus auf die Wiese
          const { fMin, fMax } = this._g;
          await this._walkTo((fMin + rnd(0.2, 0.45) * (fMax - fMin)) * this._W, 0.9);
        }
        // er sitzt vor ihm, Blick zu ihm
        const d = this._x + pW * 0.7 < this._g.fMax * this._W ? 1 : -1;
        this._face(d);
        this._plushX = this._x + d * pW * 0.52;
        this._giftScene();
        const el = this._gtEls?.get(2);
        el?.classList.add('new');
        setTimeout(() => el?.classList.remove('new'), 800);
        this._puff(this._plushX, gy, 2);
        await this._wait(600);
        p.classList.add('content', 'tilt');
        this._blush(2200);
        this._say('♥', 1300);
        await this._wait(ms / 2);
        p.classList.add('squint');
        this._happy(1500);
        await this._wait(ms / 2);
        p.classList.remove('squint', 'tilt', 'content');
        this._say(pick(['bis heut Abend!', 'ab ins Bett mit dir!', '♥']), 1200);
        await this._wait(900);
      } finally {
        if (this._plushX != null) {
          this._puff(this._plushX, gy, 2);
          this._plushX = null;
          this._giftScene();
        }
      }
    }

    // Trick der Sonnenbrille: hochschieben, zwinkern, wieder runter
    async _giftShades() {
      const p = this._el.pika;
      if (!p.classList.contains('cool')) return;
      this._face(1);
      p.classList.add('shup');
      await this._wait(450);
      p.classList.add('wink');
      this._say(pick(['lässig!', 'na?', 'cool, oder?']), 1300);
      await this._wait(1100);
      p.classList.remove('wink');
      await this._wait(300);
      p.classList.remove('shup');
      await this._wait(800);
    }

    // Trick der Hängematte: mit Schwung schaukeln, bevor er einnickt
    async _giftSwing(el) {
      const p = this._el.pika;
      el.classList.add('swing');
      p.classList.add('hswing');
      this._say(pick(['hui!', 'schauuukel!', 'juhu!']), 1300);
      await this._wait(rnd(3500, 5000));
      el.classList.remove('swing');
      p.classList.remove('hswing');
      await this._wait(300);
    }

    // Kleiner Regenbogen im Wasserstrahl (x, y: Mitte des Strahls, dir: wohin er gießt)
    _giftRainbow(x, y, dir) {
      const el = document.createElement('div');
      el.className = 'grbow';
      el.innerHTML = `<svg viewBox="0 0 40 22" aria-hidden="true">${['#e8584e', '#f6a345', '#f6d845', '#7cc35a', '#5fb9de', '#9b7fe0']
        .map((c, i) => `<path d="M${2 + i * 1.6} 22 A${18 - i * 1.6} ${18 - i * 1.6} 0 0 1 ${38 - i * 1.6} 22" stroke="${c}" stroke-width="1.7" fill="none"/>`).join('')}</svg>`;
      el.style.left = `${(x + dir * this._H * 0.03).toFixed(1)}px`;
      el.style.top = `${(y - this._H * 0.1).toFixed(1)}px`;
      this._el.fx.appendChild(el);
      setTimeout(() => el.remove(), 2700);
    }

    // Trick des Glöckchens: an die Tür hoppeln und eine kleine Melodie bimmeln
    async _giftTune() {
      const el = this._gtEls?.get(7);
      if (!el) return;
      const p = this._el.pika;
      const sc = this._el.scene.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const bx = r.left - sc.left + r.width / 2;
      if (this._action !== 'giftOpen') await this._walkTo(bx + this._g.pW * 0.42, 1);
      this._face(-1);
      await this._wait(400);
      const tune = pick([['bimm!', 'bamm!', 'bimm!'], ['ding!', 'dong!', 'ding-ding!'], ['bimm!', 'bimm!', 'bamm!', 'bimm!']]);
      for (const t of tune) {
        p.classList.add('look-up');
        this._giftBell(t);
        this._jump('hop1');
        await this._wait(520);
        p.classList.remove('look-up');
        await this._wait(180);
      }
      this._peep(this._x, this._g.gy - this._g.pH * 1.05, '♪');
      this._happy(1500);
      this._say(pick(['♪♫', 'Musik!', 'tadaa!']), 1200);
      await this._wait(1500);
    }

    // Golden: ab und zu ein Funkeln
    _giftGlint() {
      if (this._asleep || !this._gtEls || Math.random() > 0.2) return;
      const gl = [...this._gtEls.values()].filter((el) => el.classList.contains('gilt') && el.isConnected);
      if (!gl.length) return;
      const el = pick(gl);
      const r = el.getBoundingClientRect();
      const sc = this._el.scene.getBoundingClientRect();
      if (r.width) this._sparkle(r.left - sc.left + r.width * rnd(0.3, 0.7), r.top - sc.top + r.height * rnd(0.1, 0.5), 1);
    }

    // Stand der Päckchen in Worten (Schätze im Tagebuch): Stufen, Serie, wann das nächste kommt, was gerade fehlt
    _giftInfo() {
      const G = this._plan?.gift;
      if (!G) return null;
      const c = this._careEval() || this._care || {};
      const lvs = giftLvs(G); // der Schatz im fliegenden Ballon erscheint erst nach dem Auspacken
      const fmt = (ms) => {
        const m = Math.max(1, Math.round(ms / 6e4));
        return m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ''}` : `${m} Min.`;
      };
      // Was fehlt, damit die Serie hält (bzw. wieder anfängt): "Hunger!", "Streicheln!", "Putzen!"
      const low = c.warn || c.broken ? this._giftLow().map((k) => GIFT_LOW[k][0]).join(' ') : '';
      const next = G.n >= GIFT.max ? `Vorrat voll${low ? ` · ${low}` : ''}` : c.broken ? `Serie gerissen${low ? `, neu ab 50 %: ${low}` : ''}`
        : c.warn ? (low ? `schnell: ${low}` : 'einmal kümmern, dann läuft sie weiter') : `nächstes in ${fmt(c.left ?? GIFT.every)} Wachzeit`;
      return {
        G, lvs, next, warn: !!(c.warn || c.broken),
        have: lvs.filter((lv) => lv > 0).length,
        days: c.broken ? 0 : Math.floor((this._haNow() - G.k) / 864e5),
      };
    }
    // ==================== Ende Päckchen ====================

    // ==================== Tagebuch: Methoden ====================

    _diaryOn() {
      return this._cfg?.diary !== false;
    }

    _diaryLsKey() {
      return `pika-pet-diary:${this._cfg.name}`;
    }

    // Einstieg: Die Statusleiste wird zum Knopf (Buch davor); ist sie ausgeblendet, gibt es einen kleinen Buch-Knopf
    _diarySync() {
      const on = this._diaryOn();
      const { stats, tbbtn } = this._el;
      stats.classList.toggle('dia', on);
      for (const [k, v] of [['role', 'button'], ['tabindex', '0'], ['aria-label', `Tagebuch von ${this._cfg.name} öffnen`]]) {
        if (on) stats.setAttribute(k, v);
        else stats.removeAttribute(k);
      }
      tbbtn.hidden = !on || !!this._cfg.show_stats;
      this._diaryDot();
    }

    // Punkt am Buch: ein neuer Tag oder ein ausgepacktes Päckchen seit dem letzten Aufschlagen (je Gerät gemerkt)
    _diarySig() {
      const G = this._plan?.gift;
      return `${pikaDay(this._haNow())}.${G ? `${G.o}.${G.u}.${G.v || 0}` : '-'}`;
    }

    _diaryDot() {
      if (!this._el || !this._planOk) return;
      let seen = null;
      try {
        seen = localStorage.getItem(`pika-pet-diary-seen:${this._cfg.name}`);
      } catch (e) { /* egal */ }
      const neu = this._diaryOn() && seen !== this._diarySig();
      this._el.stats.classList.toggle('neu', neu);
      this._el.tbbtn.classList.toggle('neu', neu);
    }

    // Ohne Helfer gibt es keinen Verlauf in HA: Dann schreibt das Gerät jeden gespeicherten Stand mit Uhrzeit im Browser
    // mit (k: 's' Zustand, 'p' Tagesplan), DIARY.keep lang und dazu den letzten Stand davor als Ausgangslage.
    _diaryLog(k, v) {
      try {
        const key = this._diaryLsKey();
        if (this._dlogKey !== key) {
          this._dlogKey = key;
          this._dlog = JSON.parse(localStorage.getItem(key) || 'null') || {};
        }
        const a = (this._dlog[k] ||= []);
        if (a.at(-1)?.[1] === v) return;
        const now = Math.round(this._haNow() / 1000);
        a.push([now, v]);
        const i = a.findIndex((e) => e[0] >= now - DIARY.keep / 1000);
        if (i > 1) a.splice(0, i - 1);
        if (a.length > DIARY.max) a.splice(0, a.length - DIARY.max);
        localStorage.setItem(key, JSON.stringify(this._dlog));
      } catch (e) { /* kein Speicher: dann ohne Tagebuch */ }
    }

    // Beginn des Pika-Tags (4 Uhr nachts, wie pikaDay), back Tage zurück
    _diaryDay(back = 0) {
      const d = new Date(this._haNow() - 4 * 36e5);
      d.setHours(4, 0, 0, 0);
      d.setDate(d.getDate() - back);
      return d.getTime();
    }

    // Verlauf von Zustand und Tagesplan (und der Geräte des Haus-Boten) zwischen from und to. Mit Helfer aus HA,
    // ohne aus der Mitschrift im Browser. → { S, P (geparst, aufsteigend), bote (Ereignisse), fail }
    async _diaryHist(from, to) {
      const c = this._cfg;
      const hass = this._hass;
      const haS = !!c.entity && !this._noEntity;
      const haP = !!c.plan_entity && !!hass?.states[c.plan_entity] && this._planMax() >= PLAN_MIN;
      const house = c.diary_house !== false ? this._boteSync().list : [];
      const ids = [...new Set([...(haS ? [c.entity] : []), ...(haP ? [c.plan_entity] : []), ...house.map((a) => a.cfg.state)])];
      let res = {};
      let fail = false;
      if (ids.length) {
        try {
          res = (await hass.callWS({
            type: 'history/history_during_period', start_time: new Date(from).toISOString(), end_time: new Date(to).toISOString(),
            entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
          })) || {};
        } catch (e) {
          fail = true;
          console.warn('pika-pet-card: Verlauf für das Tagebuch nicht lesbar', e);
        }
      }
      // HA liefert je Helfer [{ s: Stand, lu: Sekunden }], ältere Versionen { state, last_updated }
      const rows = (id) => (Array.isArray(res[id]) ? res[id] : [])
        .map((r) => ({ t: Math.round((Number(r.lu ?? r.lc) || Date.parse(r.last_updated || r.last_changed) / 1000) * 1000), s: r.s ?? r.state }))
        .filter((r) => Number.isFinite(r.t))
        .sort((a, b) => a.t - b.t);
      let L = null;
      const local = (k) => {
        try {
          L ??= JSON.parse(localStorage.getItem(this._diaryLsKey()) || 'null') || {};
        } catch (e) {
          L = {};
        }
        return (L[k] || []).map(([t, s]) => ({ t: t * 1000, s }));
      };
      // (Zustände mit vier Feldern, bis 0.4, kennen keinen Großputz: auslassen)
      const S = (haS ? rows(c.entity) : local('s'))
        .map((r) => ({ t: r.t, v: String(r.s).split(',').length === 7 ? parseStats(r.s) : null })).filter((r) => r.v);
      const P = (haP ? rows(c.plan_entity) : local('p')).map((r) => ({ t: r.t, v: planParse(r.s) })).filter((r) => r.v);
      // Haus-Bote: ein Programm ging zu Ende (läuft → fertig)
      const bote = [];
      const norm = (v) => String(v ?? '').split('.').pop().toLowerCase().replace(/[\s_-]/g, '');
      for (const a of house) {
        let last = null;
        for (const r of rows(a.cfg.state)) {
          const raw = norm(r.s);
          const s = BOTE_ALIAS[raw] || raw;
          if (BOTE_DEAD.has(s)) continue;
          if (s === 'finished' && BOTE_RUN.has(last) && r.t >= from) bote.push({ t: r.t, k: 'bote', type: a.type, name: a.name });
          last = s;
        }
      }
      // Helfer da, aber kein einziger Stand im Verlauf: Der Recorder zeichnet ihn nicht auf
      return { S, P, bote, fail, none: !fail && ((haS && !S.length) || (haP && !P.length)) };
    }

    // Beide Seiten (heute, gestern) aus dem Verlauf. Vorschau: _dbgDiary liefert fertige Roh-Ereignisse.
    async _diaryBuild() {
      const now = this._haNow();
      const d0 = this._diaryDay(0);
      const d1 = this._diaryDay(1);
      let R;
      let H = { bote: [], fail: false, none: false, S: [], P: [] };
      if (this._dbgDiary) R = { stamps: [], pets: {}, ...this._dbgDiary(d0, d1, now), data: true };
      else {
        H = await this._diaryHist(d1, now + 60000);
        R = { ...diaryDerive(H.S, H.P, d1, { decayAt: (t, h) => this._decayAt(t, h), until: now }), data: H.S.length + H.P.length > 0 };
      }
      const page = (start, end, today) => this._diaryModel(start, end, R, H.bote, today, H.fail);
      return { fail: H.fail, none: H.none, days: [page(d0, now + 1, true), page(d1, d0, false)] };
    }

    _diaryParcel(e, t) {
      const it = GIFT_ITEMS[e.it];
      const fr = this._frName();
      const lead = e.gold ? 'Ein goldenes Päckchen! Ich hab es mit der Zwille vom Himmel geholt.' : diaryPick(DIARY_TXT.parcel, 'parcel', Math.floor(t / 60000));
      if (!it) return lead;
      const nm = it.key === 'plush' ? `Plüsch-${fr}` : it.name;
      if (e.what === 'treat') return `${lead} Drin war ein Leckerli: ${nm}. Sofort aufgefuttert!`;
      if (e.what === 'trick') return `${lead} Jetzt kann ich einen neuen Trick: ${GIFT_TRICK[e.it]}!`;
      if (e.what === 'gilt') return `${lead} Jetzt hab ich ${GIFT_GILT[e.it].replace('%', nm)}.`;
      return `${lead} Drin war ${it.key === 'plush' ? `ein ${nm}!` : it.say}`;
    }

    // Eine Seite: Einträge { t, part, icon, text, … } in Reihenfolge, Zähler (chips) und der Satz oben
    _diaryModel(start, end, R, extra, today, fail) {
      const now = this._haNow();
      const day = new Date(start);
      const [ws, we] = this._wakeDay(day);
      const fr = this._frName();
      const T = DIARY_TXT;
      const tx = (list, k, t) => diaryPick(list, k, Math.floor(t / 60000)).replace('{n}', fr);
      const hourPart = (t) => {
        const h = new Date(t).getHours();
        return h < 4 ? 'Nachts' : h < 11 ? 'Morgens' : h < 14 ? 'Mittags' : h < 18 ? 'Nachmittags' : 'Abends';
      };
      const partOf = (t) => (t < ws || t > we ? 'Nachts' : hourPart(t));
      const out = [];
      const put = (t, icon, text, x) => out.push({ t, icon, text, ...x });
      const house = this._cfg.diary_house !== false;
      const until = Math.min(end, now);

      if (ws >= start && ws <= until) {
        const favs = this._tagesform(ws).fav.map((a) => T.actNoun[a]).join(' und ');
        put(ws, 'wake', `${tx(T.wake, 'wake', ws)} Heute hab ich Lust auf ${favs}.`);
        // Festtage (wie sie mittags gelten)
        const f = this._festToday(start + 8 * 36e5);
        const fl = ['witch', 'martin', 'xmas', 'sticks', 'karneval', 'ostern', 'maibaum', 'sommer'].filter((k) => f[k]).map((k) => T.fest[k]);
        if (f.boot?.full) fl.push(T.fest.boot);
        if (f.advent && day.getDay() === 0) fl.push(`Der ${f.advent.candles}. Advent! Am Kranz brennt eine Kerze mehr.`);
        if (f.birthday) {
          const n = f.birthday.names;
          fl.push(`Alles Gute, ${n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n.at(-1)}` : n[0]}! Es gibt Kuchen.`);
        }
        fl.forEach((text, i) => put(ws + 1 + i, 'fest', text, { tm: 'Heute ist ein besonderer Tag' }));
      }

      const mine = [...R.ev, ...extra].filter((e) => e.t >= start && e.t < end).sort((a, b) => a.t - b.t);
      const one = new Set(); // manches steht nur einmal am Tag da
      const once = (k) => !one.has(k) && !!one.add(k);
      const acts = [];
      const cnt = { feed: 0, clean: 0 };
      let gather = null;
      for (const e of mine) {
        const t = e.t;
        if (e.k === 'act') acts.push(e);
        else if (e.k === 'feed') cnt.feed++;
        else if (e.k === 'clean') {
          cnt.clean += e.n;
          if (e.all && once('clean')) put(t, 'clean', tx(T.clean, 'clean', t));
        } else if (e.k === 'gather') {
          if (gather) gather.c++;
          else out.push((gather = { t, icon: 'gather', c: 1 }));
        } else if (e.k === 'mem') {
          if (['pino', 'bird', 'plane', 'bfly', 'heart'].includes(e.b) || (e.b === 'coffee' && house)) put(t, e.b, tx(T[e.b], e.b, t));
        } else if (e.k === 'parcel') {
          one.add('parcel');
          put(t, 'parcel', this._diaryParcel(e, t), { svg: GIFT_ITEMS[e.it]?.svg });
        } else if (e.k === 'earn') {
          if (once('earn')) put(t, 'parcel', tx(T.earn, 'earn', t));
        } else if (e.k === 'earnGold') put(t, 'parcel', tx(T.earnGold, 'gold', t));
        else if (e.k === 'streak') {
          if (once('streak')) put(t, 'parcel', tx(T.streak, 'streak', t), { dim: true });
        } else if (e.k === 'flower') {
          // verwelkt steht nur einmal am Tag da
          const wilt = !e.taken && now > e.id + FLGIFT.life;
          if (!wilt || once('wilt')) put(t, 'flower', tx(e.taken ? T.flowerTaken : wilt ? T.flowerWilt : T.flowerWait, 'flower', t));
        } else if (e.k === 'hungry') {
          if (once('hungry')) put(t, 'hungry', tx(e.eaten ? T.hungry : T.hungryNow, 'hungry', t));
        } else if (e.k === 'bote' && house && T.bote[e.type]) put(t, e.type, tx(T.bote[e.type], 'bote', t), { tm: `${diaryTime(t)} · ${e.name}` });
      }
      if (gather) gather.text = gather.c > 1 ? tx(T.gatherN, 'gather', gather.t).replace('{c}', gather.c) : T.gather1[0];

      // Beschäftigungen: je Tageszeit die wichtigsten ausführlich (gemaltes Bild, Frühsport, Lieblinge des Tages zuerst),
      // der Rest in einer Zeile. Ein Tablet, das den ganzen Tag an ist, sähe sonst drei Dutzend Einträge.
      const fav = this._tagesform(start + 8 * 36e5).fav;
      const rank = (a) => (a === 'paint' ? 0 : a === 'sport' ? 1 : fav.includes(a) ? 2 : 3);
      const parts = new Map();
      for (const e of acts) {
        if (!T.act[e.a]) continue;
        const p = partOf(e.t);
        if (!parts.has(p)) parts.set(p, []);
        parts.get(p).push(e);
      }
      for (const list of parts.values()) {
        const names = [...new Set(list.map((e) => e.a))].sort((a, b) => rank(a) - rank(b));
        for (const a of names.slice(0, DIARY.acts)) {
          const all = list.filter((e) => e.a === a);
          const e = all.find((x) => x.v) || all[0];
          let text = tx(T.act[a], a, e.t);
          const motif = T.motif[e.v];
          if (a === 'paint') text = motif ? text.replace('{m}', motif.replace('{n}', fr)) : 'Ein Bild gemalt. Was drauf ist, verrate ich nicht.';
          put(all[0].t, a, text, { n: all.length, pic: a === 'paint' && motif ? diaryPainting(e.v) : '' });
        }
        const rest = names.slice(DIARY.acts).map((a) => T.actShort[a]);
        if (rest.length) {
          const text = `Außerdem: ${rest.length > 1 ? `${rest.slice(0, -1).join(', ')} und ${rest.at(-1)}` : rest[0]}.`;
          put(list.at(-1).t + 1, 'more', text, { sub: true, tm: '', last: true });
        }
      }

      // Lange nichts im Verlauf, obwohl er wach war: Dann hat ihn kein Gerät gezeigt (oder es gab nichts zu tun).
      // Die längste solche Lücke wird sein Geheimnis.
      const a0 = Math.max(ws, start);
      const b0 = Math.min(we, until);
      if (!fail && R.data && b0 - a0 >= DIARY.gap) {
        const ts = [a0, ...R.stamps.filter((t) => t > a0 && t < b0), b0];
        let bi = 1;
        for (let i = 2; i < ts.length; i++) if (ts[i] - ts[i - 1] > ts[bi] - ts[bi - 1]) bi = i;
        if (ts[bi] - ts[bi - 1] >= DIARY.gap) {
          put(ts[bi - 1] + 2, 'secret', tx(T.secret, 'secret', ts[bi - 1]), { dim: true, tm: `${diaryTime(ts[bi - 1])} bis ${diaryTime(ts[bi])}` });
        }
      }
      if (we > start && we <= until) put(we, 'sleep', tx(T.sleep, 'sleep', we), { part: hourPart(we) });

      for (const e of out) e.part ??= partOf(e.t);
      // „Außerdem: …“ steht am Ende seiner Tageszeit
      for (const m of out.filter((e) => e.last)) m.t = Math.max(...out.filter((e) => e.part === m.part && !e.last).map((e) => e.t), m.t) + 1;
      out.sort((a, b) => a.t - b.t);

      const pet = Math.max(R.pets[pikaDay(start + 36e5)] || 0, today ? this._cuteToday().n : 0);
      const chips = [];
      if (cnt.feed) chips.push([ICON_LEAF, `${cnt.feed}× gefüttert`]);
      if (pet) chips.push([ICON_HEART, `${pet >= PET_CAP ? `über ${PET_CAP - 1}` : pet}× gestreichelt`]);
      if (cnt.clean) chips.push([ICON_SPARK, `${cnt.clean}× geputzt`]);

      let fazit;
      if (today) {
        const s = this._get('s');
        const g = this._get('g');
        const c = this._poops().clean;
        fazit = this._sleepTime() ? 'Psst, ich schlafe gerade. Blättere ruhig leise.'
          : s < 30 ? 'Liebes Tagebuch, mein Bauch knurrt gerade ein bisschen.'
            : c < 30 ? 'Liebes Tagebuch, auf meiner Wiese müsste mal jemand sauber machen.'
              : g < 30 ? 'Liebes Tagebuch, ich hätte gern ein paar Streicheleinheiten.'
                : one.has('parcel') ? 'Liebes Tagebuch, heute ist ein aufregender Tag: Es gab ein Päckchen!'
                  : Math.min(s, g, c) >= 70 ? 'Liebes Tagebuch, heute geht es mir richtig gut.'
                    : 'Liebes Tagebuch, heute ist ein gemütlicher Tag.';
      } else {
        fazit = !mine.length ? 'Liebes Tagebuch, über gestern weiß ich leider nichts mehr.'
          : one.has('parcel') ? 'Liebes Tagebuch, gestern war ein aufregender Tag: Es gab ein Päckchen!'
            : one.has('hungry') && pet >= 10 ? 'Liebes Tagebuch, gestern hat mein Bauch mal geknurrt. Aber gestreichelt wurde ich ganz viel.'
              : one.has('hungry') ? 'Liebes Tagebuch, gestern hat mein Bauch mal geknurrt. Sonst war es schön.'
                : pet >= 10 ? 'Liebes Tagebuch, gestern wurde ich ganz viel gestreichelt. Das war schön.'
                  : 'Liebes Tagebuch, gestern war ein schöner Tag.';
      }
      return { start, entries: out, chips, fazit, early: today && ws > now };
    }

    _diaryPage(M, today, fail, none) {
      let h = `<p class="fazit">${esc(M.fazit)}</p>`;
      if (M.chips.length) h += `<div class="chips">${M.chips.map(([i, t]) => `<span><i>${i}</i>${esc(t)}</span>`).join('')}</div>`;
      let part = null;
      for (const e of M.entries) {
        if (e.part !== part) {
          part = e.part;
          h += `<h3>${part}</h3>`;
        }
        const tm = e.tm ?? `${diaryTime(e.t)}${e.n > 1 ? ` · ${e.n}×` : ''}`;
        h += `<div class="e${e.dim ? ' dim' : ''}${e.sub ? ' sub' : ''}"><i class="ic">${e.svg || DIARY_ICON[e.icon] || ''}</i>`
          + `<div>${tm ? `<span class="tm">${esc(tm)}</span>` : ''}<p>${esc(e.text)}</p>${e.pic || ''}</div></div>`;
      }
      if (!M.entries.length) {
        h += `<p class="none">${M.early ? 'Der Tag hat noch nicht angefangen.' : today ? 'Hier steht noch nichts. Das kommt noch!' : 'Diese Seite ist leer geblieben.'}</p>`;
      } else h += `<div class="sign">${esc(this._cfg.name)}<i>${DIARY_PAW}</i></div>`;
      if (fail) h += '<p class="note">Ich finde nicht alle Seiten: Der Verlauf von Home Assistant antwortet gerade nicht.</p>';
      else if (none) h += '<p class="note">Ich finde nicht alle Seiten: Home Assistant zeichnet für meine Helfer keinen Verlauf auf (Recorder).</p>';
      return h;
    }

    // Reiter „Schätze“ (früher das Album am Päckchen-Knopf): alle acht mit Stufe, Päckchen, Serie, Vorrat
    _diaryTreasures() {
      const I = this._giftOn() ? this._giftInfo() : null;
      const fr = this._frName();
      const row = (svg, title, text, warn) => `<div class="row"><i>${svg}</i><div><b>${esc(title)}</b><span${warn ? ' class="w"' : ''}>${text}</span></div></div>`;
      let h = '';
      if (I) {
        const G = I.G;
        h += `<p class="fazit">${!I.have ? 'Noch hab ich keine Schätze. Sie stecken in den Päckchen.'
          : I.have === GIFT_TRE ? 'Das sind meine Schätze. Ich hab alle acht!' : `Das sind meine Schätze. ${I.have} von ${GIFT_TRE} hab ich schon.`}</p>`;
        h += `<div class="tre">${GIFT_ITEMS.slice(0, GIFT_TRE).map((it, t) => {
          const lv = I.lvs[t];
          const nm = it.key === 'plush' ? `Plüsch-${fr}` : it.name;
          const sub = !lv ? 'noch ein Geheimnis' : lv >= 3 ? `golden · Trick: ${GIFT_TRICK[t]}` : lv === 2 ? `Trick: ${GIFT_TRICK[t]}` : DIARY_TXT.treasure[t];
          return `<div class="t ${['miss', '', 'lv2', 'lv2 gilt'][lv]}"><i>${it.svg}</i><div><b>${esc(lv ? nm : '???')}</b><span>${esc(sub)}</span></div></div>`;
        }).join('')}</div>`;
        const n = G.n + G.y;
        h += row(GIFT_PARCEL, 'Päckchen', esc(`${n ? `${n} im Vorrat${G.y ? ` (${G.y === n ? 'golden' : `${G.y} golden`})` : ''}` : 'gerade keins da'} · ${I.next}`), I.warn);
        h += row(ICON_HEART, 'Pflege-Serie', esc(I.days === 1 ? '1 Tag am Stück' : `${I.days} Tage am Stück`));
      } else h += '<p class="fazit">Hier sammle ich, was mir gehört.</p>';
      const dots = this._blooms.map((b) => `<u style="background:${esc(b.color)}"></u>`).join('');
      const k = this._blooms.length;
      h += row(DIARY_ICON.gather, 'Mein Vorrat', `${k ? `${k} ${k === 1 ? 'Blüte' : 'Blüten'} gesammelt` : 'noch keine Blüten gesammelt'}${dots ? `<span class="dots">${dots}</span>` : ''}`);
      return h;
    }

    // Fenster über dem Dashboard öffnen (tab: 'heute', 'gestern', 'schatz'). Lang drücken auf den Päckchen-Knopf
    // schlägt gleich die Schätze auf.
    _diaryOpen(tab = 'heute') {
      if (!this._el) return;
      if (this._dia) return this._diaryTab(tab);
      const n = String(this._cfg.name || 'Pika');
      const title = `${/[sßxz]$/i.test(n) ? `${n}’` : `${n}s`} Tagebuch`;
      const host = document.createElement('div');
      host.className = 'pika-pet-diary';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${STYLE_DIARY}</style>
        <div class="bd${this._el.scene.classList.contains('night') ? ' night' : ''}">
          <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
            <div class="hd"><span class="bk">${DIARY_BOOK}</span><div class="ht"><b>${esc(title)}</b><span class="dt"></span></div>
              <button class="x" aria-label="Schließen" title="Schließen">✕</button></div>
            <div class="tabs" role="tablist">
              <button role="tab" data-tab="heute">Heute</button><button role="tab" data-tab="gestern">Gestern</button><button role="tab" data-tab="schatz">Schätze</button>
            </div>
            <div class="page" role="tabpanel" tabindex="0"></div>
          </div>
        </div>`;
      document.body.appendChild(host);
      const D = (this._dia = { host, root, tab, data: null, t: null });
      const bd = root.querySelector('.bd');
      bd.addEventListener('click', (e) => e.target === bd && this._diaryClose());
      root.querySelector('.x').addEventListener('click', () => this._diaryClose());
      root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this._diaryTab(b.dataset.tab)));
      host.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this._diaryClose();
        } else if (e.key === 'Tab') {
          // der Fokus bleibt im Fenster
          const f = [...root.querySelectorAll('button, .page')];
          const i = f.indexOf(root.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      });
      // Wand-Tablet: nach DIARY.close ohne Berührung von selbst wieder zu
      const poke = () => {
        clearTimeout(D.t);
        D.t = setTimeout(() => this._diaryClose(), DIARY.close);
      };
      for (const t of ['pointerdown', 'keydown', 'wheel', 'touchmove']) host.addEventListener(t, poke, { passive: true });
      root.querySelector('.page').addEventListener('scroll', poke, { passive: true });
      poke();
      this._diaryRender();
      root.querySelector('.sheet').focus();
      try {
        localStorage.setItem(`pika-pet-diary-seen:${this._cfg.name}`, this._diarySig());
      } catch (e) { /* egal */ }
      this._diaryDot();
      this._diaryBuild().then((data) => {
        if (this._dia !== D) return;
        D.data = data;
        this._diaryRender();
      }).catch((e) => {
        console.warn('pika-pet-card: Tagebuch', e);
        if (this._dia !== D) return;
        D.data = { fail: true, days: [] };
        this._diaryRender();
      });
    }

    _diaryTab(tab) {
      if (!this._dia) return;
      this._dia.tab = tab;
      this._diaryRender();
    }

    _diaryRender() {
      const D = this._dia;
      if (!D) return;
      const pg = D.root.querySelector('.page');
      D.root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === D.tab)));
      const dt = D.root.querySelector('.dt');
      const today = D.tab === 'heute';
      if (D.tab === 'schatz') {
        dt.textContent = 'Was mir gehört';
        pg.innerHTML = this._diaryTreasures();
      } else {
        const M = D.data?.days[today ? 0 : 1];
        const raw = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
        const wx = today ? [DIARY_TXT.wx[raw.cond], raw.temp != null ? `${Math.round(raw.temp)} °C` : ''].filter(Boolean).join(', ') : '';
        const date = new Date(this._diaryDay(today ? 0 : 1)).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
        dt.textContent = `${date}${wx ? ` · ${wx}` : ''}`;
        pg.innerHTML = !D.data ? '<p class="wait">Ich blättere …</p>'
          : M ? this._diaryPage(M, today, D.data.fail, D.data.none) : '<p class="none">Mein Tagebuch klemmt gerade. Versuch es gleich noch einmal.</p>';
      }
      pg.scrollTop = 0;
    }

    _diaryClose() {
      const D = this._dia;
      if (!D) return;
      this._dia = null;
      clearTimeout(D.t);
      D.host.remove();
      const back = this._el?.stats.hidden ? this._el.tbbtn : this._el?.stats;
      if (back?.isConnected && !back.hidden) back.focus({ preventScroll: true });
    }
    // ==================== Ende Tagebuch ====================

    // ==================== Aktivitäten: Methoden ====================
    // Tagesplan der Beschäftigungen (ACT_WIN, Helfer plan_entity), Tagesform, Begrüßung, wenn die Karte sichtbar
    // wird, und die Beschäftigungen Musik, Malen, Seifenblasen, Frühsport (groß) sowie Seilspringen und Gewichtheben.

    // screen_entity (z. B. der Bildschirm-Schalter von Fully Kiosk): geht er an, ist das wie Sichtbarwerden. Fully
    // meldet das mit etwas Verzug; kam die Sichtbarkeit schon, verhindert die Sperre eine zweite Begrüßung.
    _hassAct(hass) {
      const id = this._cfg.screen_entity;
      const st = id ? hass.states[id]?.state : undefined;
      if (st === this._screenSt) return;
      this._screenSt = st;
      // Bildschirm aus: wie ein versteckter Tab ruht alles (Schleife, Besuche, Animationen). Geht er an, steigt der Pika
      // wie nach dem Neuladen gleich mitten in der Beschäftigung ein und winkt (_visSync → _start, _showReq).
      if (this._el) this._visSync();
    }

    // Schaut jemand hin? Unsichtbar läuft die Schleife ohnehin nicht; mit screen_entity zählt auch der Bildschirm.
    _watched() {
      return !this._away();
    }

    // Die Karte wird sichtbar (Bildschirm an, App geöffnet, Ansicht gewechselt): Begrüßung anmelden. Schläft er,
    // blinzelt er nur. Ist er mitten in einer Beschäftigung, ruft er nur kurz „Hallo!“ und macht weiter.
    _showReq() {
      if (!this._el) return;
      const now = Date.now();
      if (now - (this._showAt || 0) < ACT_SHOW_COOL) {
        // Er ist wieder zu sehen: Die Abwesenheit endet auch ohne Gruß, sonst zählte sie beim nächsten Mal mit
        this._goneAt = null;
        return;
      }
      this._showAt = now;
      // Über 3 Stunden nicht zu sehen (Tab im Hintergrund, Bildschirm aus): großes Wiedersehen
      this._reunion = !!this._goneAt && now - this._goneAt > 3 * 36e5;
      this._goneAt = null;
      // Es zählt, ob jetzt Schlafenszeit ist: _asleep ist nach einer Pause veraltet (Bildschirm nachts aus, morgens an).
      // Dann wacht er gleich auf (_step), und die Begrüßung bzw. das Wiedersehen kommt danach.
      if (this._g ? this._sleepTime() : this._asleep) return this._asleep ? this._sleepyHello() : undefined;
      this._greetDue = true;
      const a = this._action;
      if (!this._running || !a) return; // die Schleife startet gleich und begrüßt zuerst
      if (['idle', 'look', 'wander', 'groom', 'squeak', 'sniff', 'binky', 'hungry', 'lookout', 'burrow', 'shelter', 'hideout',
        'curious', 'yawn', 'earClean', 'scratch', 'nod'].includes(a)) {
        this._interrupt();
      } else {
        this._greetDue = false;
        const big = this._reunion;
        this._reunion = false;
        setTimeout(() => this._action && !this._asleep && (this._say(pick(ACT_GREET), 1500), this._hearts(big ? 3 : 1)), 500);
      }
    }

    _sleepyHello() {
      const p = this._el.pika;
      setTimeout(() => {
        if (!this._asleep) return;
        p.classList.add('peek');
        this._say(pick(['mh…?', '*gähn*', 'zzz… hallo']), 1700);
        clearTimeout(this._peekT);
        this._peekT = setTimeout(() => p.classList.remove('peek'), 2200);
      }, 700);
    }

    // Winkt mit einer Pfote. Eine Beschäftigung startet er danach nicht: die kommen nur aus dem Tagesplan.
    async _greet() {
      const p = this._el.pika;
      if (this._reunion) {
        this._reunion = false;
        return this._reunite();
      }
      if (this._inside) {
        this._pose('peek', 400);
        await this._wait(500);
        this._say(pick(ACT_GREET), 1500, true);
        await this._wait(1800);
        return;
      }
      p.classList.add('waving');
      this._say(pick(ACT_GREET), 1700, true);
      await this._wait(rnd(1500, 2100));
      p.classList.remove('waving');
      if (Math.random() < 0.5) this._jump('binky');
      else this._happy(1000);
      await this._wait(1000);
    }

    // ---------- Tagesplan: Auswahl ----------

    // Uhr des Tagesplans (Vorschau: um _dbgPlanMs vorgestellt)
    _planNow() {
      return this._haNow() + (this._dbgPlanMs || 0);
    }

    // Fenster der Beschäftigung name, die gerade aus dem Plan läuft. Aus der Vorschau erzwungen: eins ab jetzt.
    _slotFor(name) {
      if (this._slot?.act === name) return this._slot;
      const start = this._planNow();
      const r = (n) => seedRnd('frei', start, n);
      return { id: null, kind: 'frei', k: -1, act: name, start, end: start + ACT_WALK + ACT_LEN[name](r), r };
    }

    // Läuft jetzt eine Beschäftigung aus dem Plan, die dieses Gerät noch nicht gezeigt hat? Groß vor klein.
    _slotNow() {
      // Mit Helfer erst, wenn sein Stand da ist: sonst wählte ein frisch geladenes Gerät ohne den Verlauf
      if (!this._g || this._asleep || !this._watched() || !this._plan || !this._planOk || this._planStale) return null;
      this._slotsDone ??= new Set();
      const now = this._planNow();
      for (const S of [this._bigAt(now), this._miniAt(now)]) {
        if (!S || this._slotsDone.has(S.id)) continue;
        if (now > S.end - ACT_JOIN_END || (ACT_NOJOIN.has(S.act) && now - S.start > 4000)) continue;
        if (!this._actOk(S.act)) continue;
        return S;
      }
      return null;
    }

    _runSlot(S) {
      this._slot = S;
      if (S.kind === 'big') {
        this._planOp({ t: 'rec', k: S.k, a: S.act });
        if (S.act === 'sport') this._planOp({ t: 'sport', d: localDay(S.start), k: S.k });
      }
      return this._run(S.act).then(() => {
        this._slotsDone.add(S.id);
        if (this._slotsDone.size > 20) this._slotsDone.delete(this._slotsDone.values().next().value);
      });
    }

    // Große Beschäftigung, die im Fenster von now begonnen hat (oder null)
    _bigAt(now) {
      const k = Math.floor(now / ACT_WIN.big);
      const start = bigStart(k);
      if (now < start) return null;
      const act = this._bigAct(k, start);
      if (!act) return null;
      const r = (n) => seedRnd('big', k, n);
      return { id: `b${k}`, kind: 'big', k, act, start, end: start + ACT_WALK + ACT_LEN[act](r), r };
    }

    // Welche große im Fenster k? Steht sie schon im Plan (ein Gerät hat sie begonnen), die; sonst ausgewürfelt.
    _bigAct(k, start) {
      const rec = this._plan.rec;
      const own = rec.find((e) => e[0] === k);
      if (own) return ACT_LEN[own[1]] ? own[1] : null;
      if (this._sportSlot(k, start)) return 'sport';
      const recent = rec.filter((e) => e[0] < k).slice(0, ACT_RECENT).map((e) => e[1]);
      const tf = this._tagesform(start);
      const w = this._bigW(new Date(start).getHours());
      const ok = ACT_BIG.filter((a) => a !== 'sport' && w[a] > 0);
      // Bleibt nach der Sperre nichts übrig (Regen: nur Fernsehen), dann doch eine der letzten statt gar keiner
      const fresh = ok.filter((a) => !recent.includes(a));
      const list = (fresh.length ? fresh : ok).map((a) => [w[a] * (tf.fav.includes(a) ? 2 : tf.meh === a ? 0.2 : 1), a]);
      return weightedR(list, seedRnd('big', k, 99));
    }

    // Gewichte der großen nach Wetter, Licht und Stunde h (des Fensterbeginns)
    _bigW(h) {
      const wx = this._wx;
      const elev = this._dbgElev ?? this._elev;
      const dry = !wx.wet && !wx.storm && !wx.shelter;
      const light = elev == null ? !this._asleep : elev > 3;
      return {
        read: dry ? 1.2 * (h >= 13 && h < 17 ? 1.5 : 1) : 0,
        game: dry ? 1 : 0,
        tablet: dry && !wx.snowcover ? 0.9 : 0,
        kite: this._kiteWind() ? 3 : 0,
        tv: wx.wet ? 3 : elev != null && elev < 4 ? 1 : 0,
        music: dry ? 1.1 * (h >= 17 ? 1.5 : 1) : 0,
        paint: dry && light ? 1.1 * (h >= 10 && h < 16 ? 1.4 : 1) : 0,
        bubbles: dry && light && !wx.snowcover && (this._wind || 0) < 30 ? 1 : 0,
      };
    }

    // Geht die Beschäftigung bei diesem Wetter? Großzügiger als die Auswahl, damit ein später einsteigendes Gerät
    // nicht wegen eines Grads Sonnenhöhe etwas anderes macht: nur Regen, Sturm, Wind und Schnee zählen.
    _actOk(act) {
      const wx = this._wx;
      if (act === 'tv') return true;
      if (wx.shelter || (wx.wet && act !== 'gather')) return false;
      const dry = !wx.wet && !wx.storm;
      if (act === 'kite') return this._kiteWind();
      if (act === 'bubbles') return (this._wind || 0) < 40 && !wx.snowcover;
      if (act === 'rope') return dry && !wx.snowcover;
      if (act === 'weights') return dry;
      if (act === 'gather') return !wx.wet && !wx.snowcover && this._hay < HAY_MAX;
      return dry;
    }

    // Kleine Beschäftigung im Fenster von now (oder null): nicht in jedem Fenster und nie dicht an einer großen
    _miniAt(now) {
      const m = Math.floor(now / ACT_WIN.mini);
      if (!miniHas(m)) return null;
      const start = miniStart(m);
      if (now < start || this._nearBig(start)) return null;
      const act = this._miniAct(m);
      if (!act) return null;
      const r = (n) => seedRnd('mini', m, 10 + n);
      return { id: `m${m}`, kind: 'mini', k: m, act, start, end: start + ACT_WALK + ACT_LEN[act](r), r };
    }

    _nearBig(t) {
      const k = Math.floor(t / ACT_WIN.big);
      return [k - 1, k, k + 1].some((j) => t > bigStart(j) - ACT_GAP[0] && t < bigStart(j) + ACT_GAP[1]);
    }

    // Seilspringen, Gewichtheben oder eine Blüte für den Vorrat; nicht zweimal dieselbe hintereinander. Die Kette
    // beginnt ein paar Fenster vorher, damit jedes Fenster seinen Vorgänger so sieht wie der Nachfolger ihn.
    _miniAct(m) {
      const wx = this._wx;
      const dry = !wx.wet && !wx.storm && !wx.shelter;
      let act = null;
      for (let j = m - 4; j <= m; j++) {
        const prev = act;
        act = miniHas(j) && !this._nearBig(miniStart(j)) ? weightedR([
          [dry && !wx.snowcover && prev !== 'rope' ? 1.6 : 0, 'rope'],
          [dry && prev !== 'weights' ? 1.4 : 0, 'weights'],
          [!wx.wet && !wx.snowcover && this._hay < HAY_MAX && prev !== 'gather' ? 1.4 : 0, 'gather'],
        ], seedRnd('mini', j, 2)) : null;
      }
      return act;
    }

    // Beim Beginn der nächsten Beschäftigung (groß oder klein) die laufende Kleinigkeit abbrechen, damit alle
    // Geräte gleichzeitig anfangen
    _slotArm() {
      const now = this._planNow();
      const kb = Math.floor(now / ACT_WIN.big);
      const km = Math.floor(now / ACT_WIN.mini);
      const next = Math.min(...[bigStart(kb), bigStart(kb + 1), ...[km, km + 1].filter(miniHas).map(miniStart)]
        .filter((t) => t > now));
      if (next === this._slotNext && this._slotT) return;
      this._slotNext = next;
      clearTimeout(this._slotT);
      this._slotT = setTimeout(() => {
        this._slotT = null;
        if (this._running && ACT_SMALL.includes(this._action) && this._slotNow()) this._interrupt();
        if (this._running) this._slotArm();
      }, clamp(next - now + 50, 50, 2 ** 31 - 1));
    }

    // Tagesform: aus dem Kalendertag gewürfelt, auf allen Geräten gleich
    _tagesform(t = this._haNow()) {
      const day = localDay(t);
      if (this._tf?.day === day) return this._tf;
      const pool = [...ACT_MOOD];
      const take = (n) => pool.splice(Math.floor(seedRnd('tag', day, n) * pool.length), 1)[0];
      this._tf = { day, fav: [take(0), take(1)], meh: take(2) };
      return this._tf;
    }

    // Frühsport im Fenster k (Beginn start)? 10–180 Minuten nach dem Aufwachen, trocken, heute noch nicht – oder
    // genau in diesem Fenster begonnen. Der Tag steht im Tagesplan, so turnt er auch nach dem Neuladen nur einmal.
    _sportSlot(k, start) {
      const sp = this._plan.sport;
      if (sp && sp.d === localDay(start)) return sp.k === k;
      const wx = this._wx;
      if (wx.wet || wx.storm || wx.shelter) return false;
      // Minuten seit dem Aufwachen, aus demselben Wachfenster wie die Schlafenszeit
      const w = this._wakeWins(start, start).find(([ws, we]) => start >= ws && start < we);
      const since = w ? (start - w[0]) / 6e4 : -1;
      return since >= SPORT_WIN[0] && since <= SPORT_WIN[1];
    }

    // Die nächsten Beschäftigungen aus dem Plan (Vorschau): [{ start, act, kind }]
    _planPeek(n = 6) {
      const out = [];
      let t = this._planNow();
      for (let i = 0; out.length < n && i < 400; i++, t += 30000) {
        for (const S of [this._bigAt(t), this._miniAt(t)]) {
          if (S && !out.some((o) => o.id === S.id) && S.end > this._planNow()) out.push(S);
        }
      }
      return out.sort((a, b) => a.start - b.start);
    }

    // ---------- Tagesplan: Speicher ----------

    // Anderer Helfer oder Name: von vorn. Ohne plan_entity bleibt der Plan im Browser (je Gerät).
    _planReset() {
      clearTimeout(this._planT);
      clearTimeout(this._planFreshT);
      clearTimeout(this._planRT);
      this._planOps = [];
      this._planSent = []; // gesendet, noch ohne Echo: { v, at }
      this._planAck = 0; // Änderungen bis zu dieser Zeit hat HA bestätigt
      this._planSt = null; // nicht undefined: sonst bliebe ein fehlender Helfer unbemerkt und _planOk für immer falsch
      this._planOk = !this._cfg.plan_entity; // mit Helfer erst schreiben, wenn sein Stand da ist
      this._planBase = this._planLocal();
      this._plan = this._planBase;
      this._hayKey = null;
      this._hayFromPlan();
    }

    _planLsKey() {
      return `pika-pet-plan:${this._cfg.name}`;
    }

    // Plan aus diesem Browser; beim ersten Mal der Vorrat von früher (bis 0.15 je Gerät gespeichert)
    _planLocal() {
      try {
        const P = planParse(localStorage.getItem(this._planLsKey()));
        if (P) return P;
        const h = JSON.parse(localStorage.getItem('pika-pet-card-hay') || 'null');
        if (h && Number.isFinite(h.n) && Number.isFinite(h.t)) {
          const pal = this._areal().flowers || FLOWER_COLORS;
          const c = (Array.isArray(h.b) ? h.b : []).map((b) => Math.max(0, pal.indexOf(b?.color))).join('');
          return { ...planBlank(this._haNow()), hay: { n: clamp(h.n, 1, HAY_MAX), t: h.t, c, m: 0 } };
        }
      } catch (e) { /* kein Speicher: frisch anfangen */ }
      return planBlank(this._haNow());
    }

    _hassPlan(hass) {
      const id = this._cfg.plan_entity;
      if (!id) return;
      const st = hass.states[id]?.state;
      if (st === this._planSt) return;
      this._planSt = st;
      // Echo eines eigenen Schreibens: alles, was bis dahin geändert wurde, ist in HA angekommen
      const sent = this._planSent.findIndex((e) => e.v === st);
      if (sent >= 0) {
        this._planAck = Math.max(this._planAck, this._planSent[sent].at);
        this._planSent.splice(0, sent + 1);
      }
      // Helfer zu kurz für den Plan: er wird nicht beschrieben, sein eingefrorener Stand zählt nicht (sonst sprängen Serie,
      // Album und Vorrat bei jedem Neuladen zurück). Der Plan bleibt im Browser, siehe _planSave.
      const P = this._planMax() < PLAN_MIN ? null : planParse(st);
      if (P) {
        // Ein anderes Gerät hat entwarnt (dort wurde gepflegt): Die eigene Warnung von eben nicht noch einmal obendrauf
        // legen und 10 s keine neue aussprechen, bis sein Zustand (kommt nach dem Plan) auch hier ist. Sonst schrieben
        // beide gegeneinander an, und die Warnung bliebe trotz Pflege stehen.
        if (sent < 0 && P.gift && P.gift.b == null && this._plan?.gift?.b != null) {
          this._planOps = this._planOps.filter((o) => o.t !== 'gbad');
          this._careHold = Date.now() + 10000;
        }
        this._planBase = P;
        // Ein anderes Gerät hat alle eigenen Änderungen schon mitgeschrieben (zusammengeführt): auch das ist bestätigt
        const last = this._planOps.at(-1);
        if (last && last.at > this._planAck && planSer(this._planOps.reduce((Q, o) => planApply(Q, o, o.at), P)) === planSer(P)) {
          this._planAck = last.at;
        }
      }
      if (st === undefined && !this._planWarned) {
        this._planWarned = true;
        console.warn(`pika-pet-card: ${id} gibt es nicht, der Tagesplan bleibt auf diesem Gerät`);
      } else if (!P && st && st !== 'unknown' && st !== 'unavailable' && this._planMax() >= PLAN_MIN) {
        console.warn(`pika-pet-card: ${id} enthält "${st}", der Tagesplan fängt neu an`);
      }
      // unknown/unavailable (Start von HA): abwarten, sonst wäre der gespeicherte Plan überschrieben. Ein neu
      // angelegter Helfer bleibt aber "unknown": nach 20 s gilt er als leer.
      clearTimeout(this._planFreshT);
      if (st !== 'unknown' && st !== 'unavailable') this._planReady();
      else if (st === 'unknown' && !this._planOk) {
        this._planFreshT = setTimeout(() => this._planSt === 'unknown' && this._planReady(), 20000);
      } else if (st === 'unavailable' && !this._planOk) {
        // Beim Laden länger nicht erreichbar: trotzdem planen (Beschäftigungen, Päckchen), erst einmal auf diesem Gerät.
        // Kommt der Helfer wieder, kommen die noch unbestätigten eigenen Änderungen auf seinen Stand.
        this._planFreshT = setTimeout(() => {
          if (this._planSt !== 'unavailable') return;
          console.warn(`pika-pet-card: ${id} ist nicht erreichbar, der Tagesplan läuft vorerst auf diesem Gerät`);
          this._planReady();
        }, 60000);
      }
      this._planCompose(true);
    }

    _planReady() {
      if (this._planOk) return;
      this._planOk = true;
      this._planCompose(true);
      // Jetzt ist klar, was gerade läuft: gleich einsteigen statt die Kleinigkeit zu Ende zu machen
      if (this._running && ACT_SMALL.includes(this._action) && this._slotNow()) this._interrupt();
    }

    // Plan = letzter bekannter Stand + eigene Änderungen der letzten 15 s. Die kommen auch auf einen fremden Stand
    // noch einmal obendrauf: Schrieben zwei Geräte fast gleichzeitig, geht so keine verloren. Hat HA eine Änderung
    // noch nicht bestätigt (Verbindung weg, Fehler), bleibt sie länger (höchstens 30 Min) und wird erneut gesendet.
    // Behalten wird immer ein zusammenhängendes jüngstes Stück, so bleibt die Reihenfolge beim Wiederholen gleich.
    _planCompose(incoming) {
      const now = this._haNow();
      // Nicht länger behalten: 'gbad' (würde eine inzwischen von einem anderen Gerät geschriebene Entwarnung wieder
      // aufheben, die Serie risse) und 'gdbg' (Vorschau, nicht wiederholbar)
      this._planOps = this._planOps.filter((o) => now - o.at < 15000
        || (o.at > this._planAck && o.t !== 'gdbg' && o.t !== 'gbad' && now - o.at < 30 * 6e4));
      let P = this._planBase;
      for (const o of this._planOps) P = planApply(P, o, o.at);
      // Ein Gerät bis 0.18 schrieb den Plan ohne Päckchen zurück: den letzten Stand behalten und wieder eintragen
      const keep = this._giftKeep && this._planKeyGift === this._planKey ? this._giftKeep : null;
      let lost = !P.gift && !!keep;
      if (lost) P = { ...P, gift: { ...keep } };
      // Ein Gerät bis 0.22 schrieb das Album ohne Stufen zurück (v fehlt): Stufen wachsen nur, also wieder dazunehmen
      else if (P.gift?.nov && keep?.v && (P.gift.v & keep.v) !== keep.v && P.gift.u === (P.gift.u | keep.u)) {
        P = { ...P, gift: { ...P.gift, v: P.gift.v | keep.v, nov: undefined } };
        lost = true;
      }
      P = this._planFit(P);
      const changed = planSer(P) !== planSer(this._plan);
      this._plan = P;
      this._hayFromPlan();
      this._giftFromPlan();
      this._flowerFromPlan();
      this._foodFromPlan();
      this._friendFromPlan();
      this._giftCredit();
      // Fehlt dem fremden Stand etwas von hier: noch einmal schreiben
      if (incoming && (this._planOps.length || lost) && planSer(P) !== planSer(this._planBase)) this._planSave();
      return changed;
    }

    _planOp(op) {
      op.at = this._haNow();
      this._planOps.push(op);
      if (this._planCompose(false)) this._planSave();
    }

    _planSave() {
      clearTimeout(this._planT);
      this._planT = setTimeout(() => {
        const id = this._cfg.plan_entity;
        const ent = id && this._hass?.states[id];
        const P = this._plan;
        const v = planSer(P);
        // Helfer zu kurz (max. Länge unter PLAN_MIN): Päckchen und Verlauf passen nicht hinein, darum gar nicht
        // senden (HA lehnte jeden Wert ab), sondern einmal deutlich warnen und im Browser weiterplanen
        const short = ent && this._planMax() < PLAN_MIN;
        if (short && !this._planShortW) {
          this._planShortW = true;
          console.warn(`pika-pet-card: ${id} ist zu kurz (max. Länge ${this._planMax()}), bitte auf 255 stellen. Der Tagesplan bleibt bis dahin auf diesem Gerät.`);
        }
        if (ent && !short) {
          // Stand aus HA noch nicht da (Start): beim Eintreffen wird zusammengeführt und geschrieben
          if (!this._planOk) return;
          // Nicht erreichbar (war es schon beim Laden, plant die Karte nach 60 s lokal weiter): nicht ins Leere senden,
          // später noch einmal; die eigenen Änderungen bleiben bis zur Bestätigung (siehe _planCompose)
          // ("unknown" ist ein frisch angelegter, leerer Helfer: den beschreiben, _planOk kam erst nach 20 s)
          if (ent.state === 'unavailable') {
            this._planBase = P;
            return this._planRetry(15000);
          }
          // _planSt bleibt der Stand von HA (erst das Echo ändert ihn): so liest nicht jedes fremde hass-Update bis zum
          // Echo den alten Stand neu ein und schreibt denselben Wert noch einmal
          if (v !== this._planSt && v !== this._planSent.at(-1)?.v) {
            this._planSent.push({ v, at: this._haNow() });
            if (this._planSent.length > 8) this._planSent.shift();
            this._hass.callService('input_text', 'set_value', { entity_id: id, value: v })
              .catch((e) => {
                console.warn('pika-pet-card: Tagesplan speichern fehlgeschlagen, neuer Versuch', e);
                this._planRetry(5000);
              });
            this._planRetry(15000);
          }
        } else {
          try {
            localStorage.setItem(this._planLsKey(), v);
          } catch (e) { /* privat/gesperrt: dann nur bis zum Neuladen */ }
          this._diaryLog('p', v);
          this._planAck = this._haNow(); // lokal gibt es kein Echo
        }
        this._planBase = P;
        this._giftCredit();
        // Sammeln aus der Vorschau (ohne Fenster) lässt sich nicht wiederholen, ohne doppelt zu zählen
        this._planOps = this._planOps.filter((o) => !(o.t === 'gather' && o.m == null));
      }, 400);
    }

    // Max. Länge des Helfers (ohne Helfer: unbegrenzt, der Plan bleibt im Browser)
    _planMax() {
      const ent = this._cfg.plan_entity && this._hass?.states[this._cfg.plan_entity];
      return ent ? Number(ent.attributes?.max) || 255 : Infinity;
    }

    // Zu lang für den Helfer (max. Länge knapp eingestellt): ältere Einträge des Verlaufs weglassen. Auch im eigenen Plan,
    // nicht nur beim Senden: so plant dieses Gerät mit demselben Verlauf weiter wie die anderen.
    _planFit(P) {
      const max = this._planMax();
      if (max < PLAN_MIN) return P;
      let v = planSer(P);
      for (let n = P.rec.length - 1; v.length > max && n >= 0; n--) {
        P = { ...P, rec: P.rec.slice(0, n) };
        v = planSer(P);
      }
      return P;
    }

    // Kein Echo (Verbindung weg, HA neu gestartet) oder Fehler: noch einmal senden, solange eigene Änderungen offen sind
    _planRetry(ms) {
      clearTimeout(this._planRT);
      this._planRT = setTimeout(() => {
        this._planRT = null;
        const id = this._cfg.plan_entity;
        const st = id && this._hass?.states[id]?.state;
        if (!st || !this._planOk) return;
        this._planCompose(false); // zu alte Änderungen fallen hier weg
        if (!this._planOps.some((o) => o.at > this._planAck)) return; // alles bestätigt
        // Getrennt oder Helfer gerade nicht erreichbar: später noch einmal schauen
        if (this._hass.connected === false || st === 'unavailable') return this._planRetry(15000);
        this._planSent = [];
        this._planSave();
      }, ms);
    }

    // Punkt der Pika-Grafik (viewBox 120 × 100) in Szenen-Pixeln, ohne Atmen und Hüpfer
    _svgPt(vx, vy) {
      const { pW, pH, gy } = this._g;
      return { x: this._x + this._dir * pW * (vx / 120 - 0.5), y: gy - pH * 0.945 + pH * (vy / 100) - this._lift };
    }

    // ---------- Musik ----------

    // Ukulele: wiegt sich, schlägt die Saiten, Noten steigen auf. Singt manchmal mit, verspielt sich, und sitzt ein
    // Vögelchen da, zwitschert es mit. Am Ende eine Verbeugung.
    async _music() {
      this._memo('note');
      const S = this._slotFor('music');
      const { home, pW } = this._g;
      await this._goSpot(S, S.r(2) < 0.55 ? this._hobbySpot(S.r(3)) : home + pW * 0.75);
      this._face(this._x < this._W * 0.5 ? 1 : -1);
      const p = this._el.pika;
      p.classList.add('music');
      while (this._planNow() < S.end) {
        await this._waitMax(rnd(700, 1500), S.end);
        this._note(pick(['♪', '♫', '♪', '♬']));
        const r = Math.random();
        if (r < 0.13) {
          p.classList.add('sing');
          this._say(pick(['la-la-la ♪', 'lalala!', '♪ mip-mip ♪', 'dum-di-dum', 'tralala']), 1900);
          await this._wait(1900);
          p.classList.remove('sing');
        } else if (r < 0.18) {
          p.classList.add('meh');
          this._say(pick(['plonk!', 'hoppla', 'oje']), 1100);
          await this._wait(1300);
          p.classList.remove('meh');
        } else if (r < 0.26 && this._bird?.sitting) {
          this._tweet(this._bird);
        } else if (r < 0.3) {
          this._twitch();
        }
      }
      p.classList.remove('music', 'sing');
      await this._wait(300);
      p.classList.add('bowing');
      this._say(pick(['Danke! ♥', 'Tadaa!', '♪ ♥']), 1400);
      await this._wait(1600);
      p.classList.remove('bowing');
      this._hearts(2);
      await this._wait(500);
    }

    // ---------- Malen ----------

    // Staffelei neben sich, das Bild entsteht Schicht für Schicht: Farbe von der Palette holen, tupfen, ab und zu
    // betrachten. Am Ende tritt er zurück und ist stolz (oder nicht ganz zufrieden); das Bild bleibt kurz stehen.
    // Jede Schicht hat ihr festes Stück des Fensters: Wer später einsteigt, sieht das Bild so weit wie die anderen.
    async _paint() {
      const S = this._slotFor('paint');
      const late = this._jumpIn(S);
      const { pW, pH, gy } = this._g;
      const W = this._W;
      const EH = pH;
      const EW = EH * 0.75;
      const tip = pW * (117.2 / 120 - 0.5);
      // Staffelei auf der Seite mit Platz, ganz im Bild
      const maxR = W - 4 - EW * 0.83 - tip;
      const minL = 4 + tip + EW * 0.83;
      let x = this._hobbySpot(S.r(2));
      let dir = S.r(3) < 0.5 ? 1 : -1;
      if (dir > 0 && x > maxR) dir = x >= minL ? -1 : 1;
      if (dir < 0 && x < minL) dir = x <= maxR ? 1 : -1;
      x = dir > 0 ? Math.min(x, maxR) : Math.max(x, minL);
      await this._goSpot(S, x);
      this._face(dir);
      // Motiv: Wer das Fenster zuerst malt, trägt es in den Plan ein, die anderen malen dasselbe
      const own = S.k >= 0 && this._plan.rec.find((e) => e[0] === S.k);
      const motif = own && EASEL_MOTIF[own[2]] ? own[2] : this._paintMotif(S.r(4), S.r(5));
      if (S.k >= 0) this._planOp({ t: 'rec', k: S.k, a: 'paint', v: motif });
      const el = document.createElement('div');
      el.className = 'easel';
      const left = dir > 0 ? this._x + tip - EW * 0.17 : this._x - tip - EW * 0.83;
      Object.assign(el.style, {
        left: `${left.toFixed(1)}px`, top: `${(gy - EH * 0.9875).toFixed(1)}px`, width: `${EW.toFixed(1)}px`, height: `${EH.toFixed(1)}px`,
      });
      el.innerHTML = EASEL_SVG(motif);
      this._easelAway();
      this._easelEl = el;
      this._el.acts.appendChild(el);
      void el.offsetWidth;
      el.classList.add('on');
      const p = this._el.pika;
      p.classList.add('painting');
      if (!late) {
        this._say(pick(['Malzeit!', 'hmm …', 'Ein Bild!']), 1300);
        await this._wait(900);
      }
      const layers = [...el.querySelectorAll('.cvl')];
      const fill = (sel) => getComputedStyle(el.querySelector(sel)).fill;
      const colors = [fill('.cv-sky'), fill('.cv-sun'), '#86c46b', EASEL_MOTIF[motif][0], '#ffffff'];
      const t0 = S.start + ACT_WALK + 1500;
      const L = (S.end - t0) / layers.length;
      // Bei einer Schicht landet ein Klecks auf der Nase (feste Zahlen: auf allen Geräten dieselbe Farbe, auch für Späteinsteiger)
      const smudge = S.r(40) < 0.6 ? Math.floor(S.r(41) * layers.length) : -1;
      for (let i = 0; i < layers.length; i++) {
        const lEnd = t0 + (i + 1) * L;
        if (i === smudge) {
          p.style.setProperty('--nsm', colors[i]);
          p.classList.add('smudge');
        }
        if (this._planNow() >= lEnd - 600) {
          layers[i].style.opacity = '1'; // schon gemalt
          continue;
        }
        p.classList.add('mix');
        p.style.setProperty('--pc', colors[i]);
        await this._wait(900);
        p.classList.remove('mix');
        const n = 3 + Math.floor(S.r(10 + i) * 4);
        const look = i < layers.length - 1 && S.r(20 + i) < 0.45;
        const d0 = t0 + i * L + 900;
        const d1 = lEnd - (look ? 2600 : 300);
        for (let k = 1; k <= n; k++) {
          const tk = d0 + ((d1 - d0) * k) / n - 220;
          if (this._planNow() > tk + 800) {
            layers[i].style.opacity = (k / n).toFixed(2);
            continue;
          }
          await this._at(tk);
          p.classList.add('dab');
          await this._wait(220);
          p.classList.remove('dab');
          layers[i].style.opacity = (k / n).toFixed(2);
        }
        if (look) {
          await this._wait(400);
          p.classList.add('look-f');
          if (S.r(30 + i) < 0.5) this._say(pick(['hmm …', 'schön!', 'noch etwas …']), 1200);
          await this._at(lEnd);
          p.classList.remove('look-f');
        }
        await this._at(lEnd);
      }
      p.classList.remove('painting');
      // zurücktreten und anschauen
      await this._walkTo(this._x - dir * pW * 0.35, 0.6);
      this._face(dir);
      p.classList.add('look-f');
      await this._wait(900);
      if (S.r(6) < 0.75) {
        this._happy(1400);
        this._say(pick(['Fertig!', 'Kunst!', 'Meisterwerk!', '♥']), 1500);
        this._jump('hop1');
      } else {
        p.classList.add('meh');
        this._say(pick(['naja …', 'hm.', 'nächstes Mal']), 1400);
        await this._wait(1500);
        p.classList.remove('meh');
      }
      await this._wait(5000 + S.r(7) * 4000);
      p.classList.remove('look-f');
      this._easelAway();
      // Klecks von der Nase putzen
      if (p.classList.contains('smudge')) {
        p.classList.add('groom');
        await this._wait(900);
        p.classList.remove('groom', 'smudge');
      }
      await this._wait(600);
    }

    // Motiv aus festen Zahlen u, u2: Blume, Selbstbildnis, Bau, Regenbogen; Pino, wenn er da ist (sonst selten);
    // Flieger, wenn einer fliegt
    _paintMotif(u, u2) {
      const m = ['blume', 'pika', 'bau', 'regenbogen'];
      if (this._fr || u2 < 0.15) m.push('pino');
      if ([...this._planes.values()].some((pl) => pl.show && !pl.gone)) m.push('flieger', 'flieger');
      return m[Math.floor(u * m.length)];
    }

    _easelAway() {
      const el = this._easelEl;
      if (!el) return;
      this._easelEl = null;
      el.classList.remove('on');
      setTimeout(() => el.remove(), 700);
    }

    // ---------- Seifenblasen ----------

    // Pustet durch den Ring, die Blasen treiben mit dem Wind, schillern und platzen. Ab und zu springt er einer
    // hinterher. Antippen bringt eine Blase zum Platzen.
    async _bubbles() {
      const S = this._slotFor('bubbles');
      await this._goSpot(S, this._hobbySpot(S.r(2)));
      this._face(this._windDir || (S.r(3) < 0.5 ? -1 : 1));
      const p = this._el.pika;
      p.classList.add('blowing');
      while (this._planNow() < S.end && (this._forced || (!this._wx.wet && (this._wind || 0) < 40))) {
        await this._waitMax(rnd(1200, 2600), S.end);
        p.classList.add('blow');
        await this._wait(450);
        const n = 1 + Math.floor(rnd(0, 4));
        for (let i = 0; i < n; i++) {
          this._soapBubble();
          await this._wait(rnd(120, 280));
        }
        p.classList.remove('blow');
        if (Math.random() < 0.3) await this._chaseBubble();
        else if (Math.random() < 0.2) this._say(pick(['oooh!', 'hihi', 'schön!']), 1100);
      }
      p.classList.remove('blowing', 'blow');
      await this._wait(500);
    }

    _soapBubble() {
      const bubs = (this._bubs ??= new Set());
      if (!this._g || bubs.size >= 8) return; // jede Blase ist eine eigene Ebene: schwache Tablets schonen
      const { pW, pH } = this._g;
      const W = this._W;
      const H = this._H;
      const o = this._svgPt(118, 48.5);
      const el = document.createElement('div');
      el.className = 'bub';
      el.style.setProperty('--bs', `${(pH * rnd(0.09, 0.2)).toFixed(1)}px`);
      el.innerHTML = '<i></i>';
      // erst ein Stück aus dem Ring heraus, dann mit dem Wind (ohne Wind langsam nach oben)
      const kd = this._windDir || this._dir;
      const wind = clamp((this._wind || 6) / 25, 0.2, 1.4);
      const out = this._dir * pW * rnd(0.25, 0.5);
      const dx = kd * W * 0.35 * wind * rnd(0.6, 1.3);
      const dy = -H * rnd(0.15, 0.45);
      const at = (t, wob) => ({ x: o.x + out * Math.min(1, t * 3) + dx * t + wob * pW * 0.2, y: o.y + dy * t + Math.abs(wob) * H * 0.03 });
      // Stützpunkte merken: _bubPos rechnet daraus, wo die Blase gleich ist
      const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => at(t, t ? rnd(-1, 1) : 0));
      const frames = pts.map((q) => ({ transform: `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)` }));
      this._el.fx.appendChild(el);
      const dur = rnd(3500, 7500);
      const anim = el.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
      const b = { el, anim, pts, dur };
      bubs.add(b);
      el.firstChild.addEventListener('click', (e) => (e.stopPropagation(), this._popBubble(b, true)));
      anim.finished.then(() => this._popBubble(b), () => {});
    }

    // Wo Blase b in ms Millisekunden ist (Szenen-Pixel; die Animation ist linear zwischen den Stützpunkten)
    _bubPos(b, ms = 0) {
      const t = clamp(((b.anim.currentTime || 0) + ms) / b.dur, 0, 1) * 4;
      const i = Math.min(3, Math.floor(t));
      const a = b.pts[i];
      const c = b.pts[i + 1];
      return { x: a.x + (c.x - a.x) * (t - i), y: a.y + (c.y - a.y) * (t - i) };
    }

    // tap: angetippt. Platzt sie dabei direkt vor seiner Nase, muss er niesen.
    _popBubble(b, tap = false) {
      if (!this._bubs?.delete(b)) return;
      const q = tap && this._g && !this._asleep && !this._inside ? this._bubPos(b) : null;
      b.anim.pause();
      b.el.classList.add('pop');
      setTimeout(() => b.el.remove(), 220);
      if (q && Date.now() - (this._bubSnzAt || 0) > 15000) {
        const n = this._nosePos();
        if (Math.hypot(q.x - n.x, q.y - n.y) < this._g.pH * 0.3) {
          this._bubSnzAt = Date.now();
          setTimeout(() => this._bubSneeze(), 250);
        }
      }
    }

    // Kurzer Nieser nebenher (läuft neben der Aktion, nur Mimik und Tröpfchen)
    _bubSneeze() {
      if (this._asleep || this._inside) return;
      this._cls('sneezing', 450, true);
      this._say(pick(['hatschi!', 'tschi!']), 1000);
      this._snzFx();
      setTimeout(() => (this._cls('eflap-l', 950, true), this._cls('eflap-r', 950, true)), 450);
    }

    // Einer tief hängenden Blase hinterher und hochspringen: plopp! Gezielt wird dorthin, wo sie bei der Ankunft
    // ist; ist sie dann doch woanders, geht der Sprung daneben.
    async _chaseBubble() {
      const { pH, pW, gy } = this._g;
      const v = pW * 0.85 * 1.5; // px/s wie _walkTo mit speed 1,5
      const low = (q) => q.y > gy - pH * 1.5 && q.y < gy - pH * 0.5;
      let best = null;
      for (const b of this._bubs || []) {
        // Ankunftszeit zweimal genähert: erst zur jetzigen Stelle, dann zur vorhergesagten
        let q = this._bubPos(b);
        q = this._bubPos(b, (Math.abs(q.x - this._x) / v) * 1000 + 260);
        q = this._bubPos(b, (Math.abs(q.x - this._x) / v) * 1000 + 260);
        if (low(q) && (!best || Math.abs(q.x - this._x) < Math.abs(best.x - this._x))) best = { b, x: q.x };
      }
      if (!best) return;
      await this._walkTo(best.x, 1.5);
      this._jump('hop1');
      await this._wait(260);
      const q = this._bubs.has(best.b) ? this._bubPos(best.b) : null;
      if (q && Math.abs(q.x - this._x) < pW * 0.6 && low(q)) {
        this._popBubble(best.b);
        this._say(pick(['plopp!', 'hab dich!', 'hihi']), 1000);
      } else this._say(pick(['och…', 'daneben!', 'huch']), 1000);
      await this._wait(800);
      this._face(this._windDir || this._dir);
    }

    // ---------- Frühsport ----------

    // Mit Stirnband: drei oder vier Übungen (Hampelmann, Kniebeugen, Laufen auf der Stelle, Strecken), er zählt mit,
    // schwitzt und ist am Ende stolz. Einmal am Morgen. Ablauf und Takt aus sportPlan: Alle Geräte zählen gleich.
    async _sport() {
      const S = this._slotFor('sport');
      const plan = sportPlan(S.r);
      const late = this._jumpIn(S);
      await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
      this._face(S.r(3) < 0.5 ? -1 : 1);
      const p = this._el.pika;
      p.classList.add('sport');
      if (!late) this._say(pick(['Frühsport!', 'Auf geht’s!', 'Fit bleiben!']), 1500);
      await this._at(S.start + ACT_WALK + SPORT_INTRO);
      for (const seg of plan.segs) {
        const t0 = S.start + seg.t;
        const t1 = t0 + seg.len;
        if (this._planNow() >= t1 + SPORT_PAUSE - 500) continue; // diese Übung ist schon vorbei
        if (this._planNow() < t1) {
          if (seg.ex === 'jjack' || seg.ex === 'knee') {
            if (seg.ex === 'jjack') p.style.setProperty('--jj', `${(seg.rep / 1000).toFixed(2)}s`);
            p.classList.add(seg.ex);
            for (let i = Math.max(1, Math.ceil((this._planNow() - t0) / seg.rep)); i <= seg.reps; i++) {
              await this._at(t0 + i * seg.rep);
              this._say(`${i}!`, seg.ex === 'jjack' ? seg.rep * 0.8 : 800);
            }
            p.classList.remove(seg.ex);
          } else if (seg.ex === 'jog') {
            p.classList.add('walking');
            while (this._planNow() < t1) {
              await this._waitMax(rnd(1200, 2000), t1);
              if (Math.random() < 0.5) this._face(-this._dir);
            }
            p.classList.remove('walking');
          } else {
            for (let i = 0; i < 2; i++) {
              p.classList.add('stretch');
              await this._wait(1300);
              p.classList.remove('stretch');
              await this._wait(300);
            }
            this._say('aaah!', 1000);
          }
        }
        await this._wait(500);
        this._sweat();
        if (Math.random() < 0.6) this._say(pick(['puh!', 'uff', 'weiter!', 'hechel']), 900);
        await this._at(t1 + SPORT_PAUSE);
      }
      // Schweiß abwischen, stolz
      p.classList.add('groom');
      await this._wait(1200);
      p.classList.remove('groom');
      this._happy(1400);
      this._say(pick(['Geschafft!', 'Stark!', 'Fit! ♥']), 1500);
      this._jump('binky');
      await this._wait(1500);
      p.classList.remove('sport');
      await this._wait(300);
    }

    _sweat() {
      for (let i = 0; i < 2; i++) {
        const o = this._svgPt(rnd(78, 104), rnd(28, 34));
        const s = document.createElement('span');
        s.className = 'sweat';
        s.innerHTML = DROP_SVG;
        s.style.left = `${o.x.toFixed(1)}px`;
        s.style.top = `${o.y.toFixed(1)}px`;
        s.style.setProperty('--dx', `${((i ? 1 : -1) * rnd(4, 12)).toFixed(1)}px`);
        s.style.animationDelay = `${i * 200}ms`;
        this._el.fx.appendChild(s);
        setTimeout(() => s.remove(), 1300 + i * 200);
      }
    }

    // ---------- Seilspringen ----------

    // Zählt mit, wird manchmal schneller oder springt doppelt durch; verheddert er sich, ist Schluss. Seil und
    // Sprung laufen über dieselbe Dauer --rp; bei jedem Wechsel starten beide neu (das Seil ist dann gerade oben).
    // Wie viele Sprünge, ob schneller, doppelt oder verheddert, steht mit dem Fenster fest.
    async _rope() {
      const S = this._slotFor('rope');
      await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
      this._face(S.r(3) < 0.5 ? -1 : 1);
      const p = this._el.pika;
      let rp = 0.62 + S.r(4) * 0.1;
      const go = (dbl) => {
        p.classList.remove('roping', 'rdbl');
        p.style.setProperty('--rp', `${rp.toFixed(3)}s`);
        void p.offsetWidth;
        p.classList.add('roping');
        if (dbl) p.classList.add('rdbl');
      };
      p.classList.add('rope-hold');
      await this._wait(600);
      go(false);
      const total = ropeJumps(S.r);
      const trip = S.r(6) < 0.3 ? 6 + Math.floor(S.r(7) * (total - 6)) : -1;
      let i = 0;
      while (i < total) {
        await this._wait(rp * 1000);
        i++;
        if (i === trip) break;
        if (i % 2 === 0 || i > total - 3) this._say(`${i}!`, Math.min(900, rp * 1600));
        if (i === 8 && S.r(8) < 0.5) {
          rp *= 0.8;
          go(false);
          this._say('schneller!', 900);
        } else if (i === 14 && S.r(9) < 0.45) {
          go(true);
          this._say('doppelt!', 1000);
          await this._wait(rp * 2000);
          i += 2;
          go(false);
        }
      }
      p.classList.remove('roping', 'rdbl');
      if (i === trip) {
        p.classList.add('meh');
        this._say(pick(['hoppla!', 'uups', 'verheddert!']), 1300);
        await this._wait(1600);
        p.classList.remove('meh');
      } else {
        this._happy(1200);
        this._say(S.r(11) < 0.3 ? 'Rekord!' : `${i}! ♥`, 1400);
        await this._wait(1300);
      }
      p.classList.remove('rope-hold');
      await this._wait(300);
    }

    // ---------- Gewichtheben ----------

    // Pusteblumen-Hantel: in die Hocke, „hnnngh!“, über den Kopf, zittern. Meist klappt es (stolz), manchmal
    // plumpst sie herunter. Oben fliegen gern ein paar Schirmchen davon. Wiederholungen und Ausgang stehen fest.
    async _weights() {
      const S = this._slotFor('weights');
      await this._goSpot(S, this._hobbySpot(S.r(2)), 0.9);
      this._face(S.r(3) < 0.5 ? -1 : 1);
      const p = this._el.pika;
      p.classList.add('lifting', 'lift-gnd');
      await this._wait(600);
      const reps = 1 + Math.floor(S.r(1) * 3);
      for (let r = 0; r < reps; r++) {
        p.classList.add('crouch');
        this._say(pick(['hnnn …', 'konzentrieren …', 'auf drei …']), 1100);
        await this._wait(rnd(900, 1400));
        p.classList.add('strain');
        p.classList.remove('lift-gnd');
        await this._wait(700);
        p.classList.remove('crouch');
        this._say('hnnngh!', 1200);
        await this._wait(rnd(500, 1000));
        p.classList.add('lift-hi');
        if (S.r(10 + r) < 0.22) {
          // zu schwer: plumps
          await this._wait(450);
          p.classList.remove('lift-hi', 'strain');
          p.classList.add('lift-gnd');
          this._say('uff!', 1000);
          p.classList.add('meh');
          await this._wait(1600);
          p.classList.remove('meh');
          continue;
        }
        await this._wait(900);
        if (S.r(20 + r) < 0.5) this._seeds();
        await this._wait(rnd(1200, 2200));
        p.classList.remove('strain');
        this._say(pick(['Ta-da!', 'Stark!', 'Muskeln!']), 1300);
        this._hearts(2);
        await this._wait(1300);
        p.classList.remove('lift-hi');
        await this._wait(600);
        p.classList.add('lift-gnd');
        await this._wait(800);
      }
      p.classList.remove('lifting', 'lift-gnd', 'lift-hi', 'strain', 'crouch');
      await this._wait(300);
    }

    // Schirmchen fliegen von den Pusteblumen (oben über dem Kopf) mit dem Wind davon
    _seeds() {
      const kd = this._windDir || this._dir;
      const n = 2 + Math.floor(rnd(0, 4));
      for (let i = 0; i < n; i++) {
        const o = this._svgPt(pick([67, 115]) + rnd(-4, 4), 11 + rnd(-4, 4));
        const s = document.createElement('span');
        s.className = 'seed';
        s.innerHTML = SEED_SVG;
        s.style.left = `${o.x.toFixed(1)}px`;
        s.style.top = `${o.y.toFixed(1)}px`;
        s.style.setProperty('--dx', `${(kd * rnd(0.15, 0.45) * this._W).toFixed(1)}px`);
        s.style.setProperty('--rt', `${rnd(-40, 40).toFixed(0)}deg`);
        s.style.animationDelay = `${i * 150}ms`;
        this._el.fx.appendChild(s);
        setTimeout(() => s.remove(), 3600 + i * 150);
      }
      this._say(pick(['oh!', 'huch!']), 900);
    }
    // ==================== Ende Aktivitäten ====================

  }

  if (!customElements.get('pika-pet-card')) {
    customElements.define('pika-pet-card', PikaPetCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: 'pika-pet-card',
      name: 'Pika Pet Card',
      description: 'Ein kleiner Pika wohnt im Dashboard – füttern, streicheln, beim Schlafen zuschauen.',
      preview: true,
      documentationURL: 'https://github.com/cschloesser/ha-pet#readme',
    });
    console.info(`%c PIKA-PET-CARD %c ${VERSION} `, 'background:#ad8664;color:#fff;border-radius:3px 0 0 3px', 'background:#f0e2cf;color:#5a4030;border-radius:0 3px 3px 0');
  }
})();
