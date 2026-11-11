// Flugzeuge: Längenunterschied, Takt, Städtenamen, Flugnummer, Art, Meldungen prüfen, Uhren eines Fliegers

import { clamp } from './hilfen.js';

// Längenunterschied in Grad, über die Datumsgrenze gefaltet (−180…180)
const lonDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
// Takt der Flieger in Sekunden. Zwischen zwei Meldungen fliegen sie geradeaus weiter, darum genügt alle 5 s ein
// Zielpunkt (5 s voraus), den ein linearer Übergang gleich lang ansteuert: Weg und Tempo bleiben exakt gleich.
// Muss zu den 5s-Übergängen bei .plane, .pl-s, .pl-f, .phit und .ptag passen.
const PLANE_STEP = 5;

// Städte, wie sie Flightradar24 liefert (englisch), auf Deutsch
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
// Am Himmel? Nicht am Boden, über 80 ft und in Fahrt (unter 30 kn rollt er oder die Meldung ist kaputt). Ein
// Hubschrauber darf in der Luft auch stehen.
const flightAloft = (f, kind = planeKind(f)) => !f.on_ground && Number(f.altitude) > 80
  && (Number(f.ground_speed) > 30 || kind === 'heli');
// Hängengebliebene Meldung: Die Integration führt einen Flug manchmal mit seiner letzten Position weiter. Nach 75 s
// (PLANE_OLD) ohne neue Position ist er ausgeflogen, g merkt sich die Position ({ lat, lon }); erst eine andere holt ihn zurück.
const flightGhost = (g, f) => !!g && g.lat === Number(f.latitude) && g.lon === Number(f.longitude);
// Kommt eine Position verspätet, liegt sie hinter dem Punkt, an dem der Flieger im Bild schon ist: Der nächste
// Schritt ginge rückwärts. So viele Sekunden ist die Meldung demnach alt (höchstens max). cur: sichtbarer Punkt
// { e, n } in km, nxt: die neue Bahn jetzt { e, n, ve, vn } (km, km/s).
const planeLag = (cur, nxt, max = 30) => {
  const v2 = nxt.ve * nxt.ve + nxt.vn * nxt.vn;
  if (!(v2 > 1e-9)) return 0;
  return clamp(((cur.e - nxt.e) * nxt.ve + (cur.n - nxt.n) * nxt.vn) / v2, 0, max);
};
// Ein Flieger führt zwei Uhren. tm: wann seine Position gemeldet wurde, daran hängt das Ausaltern (planeStale:
// PLANE_OLD s ohne neue Position). t0: ab wann seine Bahn gerechnet wird, daran hängt nur der Ort im Bild; t0 liegt
// um den Versatz aus planeLag vor tm. Beides in einer Uhr hieße: Ein bremsender Anflug (ein paar Sekunden Versatz
// bei jeder Meldung) gälte nach einer einzigen ausgebliebenen Position als ausgeflogen und käme als neuer wieder.
const PLANE_OLD = 75;
const planeStale = (p, now) => (now - (p.tm ?? p.t0)) / 1000 > PLANE_OLD;
// Uhren nach einer neuen Position. p: der Flieger bisher { e, n, ve, vn, t0, tm } oder null, wenn es keinen
// sichtbaren Punkt zu schützen gibt (neu, eben versetzt); nxt: gemeldete Bahn { e, n, ve, vn }; tm: Meldezeit.
// Ist die alte Meldung schon ausgealtert (Karte war unsichtbar oder abgehängt), stand er auch nirgends: kein Versatz.
const planeClock = (p, nxt, now, tm) => {
  let lag = 0;
  if (p && !planeStale(p, now)) {
    const dt = (now - p.t0) / 1000;
    const dn = (now - tm) / 1000;
    lag = planeLag({ e: p.e + p.ve * dt, n: p.n + p.vn * dt }, { e: nxt.e + nxt.ve * dn, n: nxt.n + nxt.vn * dn, ve: nxt.ve, vn: nxt.vn });
  }
  return { tm, t0: tm - lag * 1000 };
};

export {
  lonDiff, PLANE_STEP, cityDe, flightNo, planeKind, flightAloft, flightGhost, planeLag, PLANE_OLD, planeStale,
  planeClock,
};
