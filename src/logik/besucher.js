// Besucher und Pino: Fenster und Fristen der Besuche (Vögelchen, Maus, Frosch, Schnecke); Pino: Größe, Besuchsplan, gemeinsame Spiele, Zustandsklassen

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
// So lange vor dem Ende des Besuchs beginnen die beiden kein neues Spiel mehr (ms). Die meisten Spiele sind dann
// vorbei, wenn Pino geht; ein längeres (Zusammensitzen, Fangen auf breiten Karten) bricht der Abschied ab.
const FRIEND_LAST = 25000;
// Gemeinsame Spiele (Aktionen des Pikas). Solange eine läuft, steuert sie auch Pino.
const FRIEND_ACTS = new Set(['greetFriend', 'chaseFriend', 'sitWithFriend', 'rockWithFriend', 'nibbleWithFriend', 'squeakDuet']);
// Pinos eigener Ablauf gibt die Kontrolle ab (gemeinsames Spiel, Streicheln, Abschied)
const FRIEND_YIELD = { friendYield: true };
// Zustandsklassen an Pino, die beim Übergeben der Kontrolle zurückgesetzt werden
const FRIEND_CLS = ['walking', 'groom', 'eating', 'look-f', 'look-b', 'look-up', 'calling', 'crouch', 'happy', 'nuzzle', 'wiggle'];

export {
  CRIT, CRIT_KINDS, CRIT_BACK, critJoin, FRIEND_SCALE, FRIEND_WIN, FRIEND_LAST, FRIEND_ACTS, FRIEND_YIELD, FRIEND_CLS,
};
