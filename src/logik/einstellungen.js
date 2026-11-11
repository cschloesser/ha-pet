// Einstellungen: Vorgaben der Konfiguration, Texte des Editors, Bildschirm-Erkennung, Spur der Tiefe

// screen_entity gehört zu einem Gerät (dem Kiosk-Tablet), dasselbe Dashboard öffnen aber auch andere. Ein Rechner mit
// Maus ist sicher nicht dieser Bildschirm, Fully Kiosk mit JS-Schnittstelle dagegen schon.
const screenElsewhere = () => typeof window.fully === 'undefined'
  && !!window.matchMedia?.('(pointer: fine) and (hover: hover)').matches;
const WAKE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

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
  screen_entity: 'z. B. der Bildschirm-Schalter von Fully Kiosk: Bei „aus“ ruht die Karte auf dem Tablet (nicht auf Rechnern mit Maus), beim Einschalten winkt er.',
  birthdays: '- name: Mia\n  date: "03-14"',
  appliances: '- type: washer\n  state: sensor.waschmaschine_betriebszustand\n  progress: sensor.…_fortschritt\n  end: sensor.…_endzeit',
  coffee: 'active: select.…_aktives_programm\ncounter: sensor.…_tassen\nselected: select.…_ausgewahltes_programm',
};

export { screenElsewhere, WAKE_EVENTS, LANE_DY, LANE_S, DEFAULTS, EDITOR_LABEL, EDITOR_HELP };
