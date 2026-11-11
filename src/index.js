/*
 * Pika Pet Card – ein kleiner Pika (Pfeifhase) wohnt im Home-Assistant-Dashboard.
 *
 *   Pika antippen      → streicheln (Herzchen, Glück steigt); lang drücken = kraulen, das lohnt am meisten
 *   Szene antippen     → die Welt antwortet: Blume staubt, Wolke tröpfelt, Stern fällt, an der Tür klopft es
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
 *                         in HA abgeleitet), dazu seine Schätze und die Entdeckungen (was man alles tun kann)
 *   Besuche (Vögelchen, Maus, Frosch, Schnecke, Pino) werden aus der Uhrzeit berechnet und sind auf allen Geräten gleich.
 *
 * Konfiguration:
 *   type: custom:pika-pet-card
 *   name: Pika                       # Name in der Statusanzeige
 *   entity: input_text.pika_status   # optional: Zustand geräteübergreifend speichern
 *   plan_entity: input_text.pika_plan       # optional: Tagesplan (Vorrat, Päckchen, Verlauf) für alle Geräte gemeinsam
 *   chronicle_entity: todo.pikas_chronik    # optional: To-do-Liste als Langzeitgedächtnis, je Pika-Tag ein Eintrag
 *                                           # mit der Tagesbilanz (nur mit entity und plan_entity)
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

import { VERSION } from './version.js';
import { hasKey, seedRnd, weightedR, sceneUnit, clearSpot } from './logik/hilfen.js';
import { GAIN, POOP, freshStats, serialize, parseStats, mergeStats } from './logik/zustand.js';
import { sunTimes, skyPos } from './logik/himmel.js';
import {
  FLOWER_COLORS, numAttr, WEATHER, WX_HOLD, twilight, wxCover, starOp, hexRgb, seasonPos, seasonKey, seasonPal,
  FLOWER_SEASON, landColors, wxTemp, wxLogAdd, wxRows, wxLogMerge, SNOW, snowHours, snowDepth, wxProgThen, BOW,
  rainbow,
} from './logik/wetter.js';
import { flightAloft, flightGhost, planeLag, PLANE_OLD, planeStale, planeClock } from './logik/flugzeuge.js';
import { HAY_MAX, PLAN_MIN, planBlank, pikaDay, planSer, planParse, hayNow, planApply } from './logik/tagesplan.js';
import { festDay, festEaster, festAdvent1, FEST_AHEAD, festMoments, festBirthdate } from './logik/feste.js';
import { FRIEND_LAST } from './logik/besucher.js';
import { boteRow } from './logik/haus-bote.js';
import { PET_CALM, petGain, KRAUL, kraulGain, MIMIK, worldPick } from './logik/interaktion.js';
import {
  ACT_WIN, ACT_GAP, ACT_WALK, ACT_LEN, ACT_NOJOIN, bigStart, miniStart, miniHas, ACT_SMALL, poopClean, poopWhen,
  WALK_MAX, WALK_LATE, WALK_REJOIN, walkSpeed, HOP_MS, KITE_LEAN, kitePaw, hopRound, JUMPS, EAR_SWING, jumpBusy,
  JUMP_IN, jumpInOk, chaseFar, ACT_PX, WX_STOP, sportPlan, PROP_SEL, KRAM,
} from './logik/beschaeftigungen.js';
import {
  MINI_W, MINI_ACTS, MINI_PROG, MINI_REST, miniProg, miniOk, miniBase, miniSwap, miniChain, BOAT_T, boatPuffs, bezAt,
  boatPos, GLIDER_STEP, gliderThrows, groundSpot,
} from './logik/beschaeftigungen-klein.js';
import { GIFT, giftLv } from './logik/paeckchen.js';
import { FIND_GROUPS, FINDS, findsParse, findsSer, diaryDerive } from './logik/tagebuch.js';
import {
  CHRONIK, chronikDatum, chronikTag, chronikStart, chronikVersatz, chronikZoneOk, chronikKod, chronikLies, chronikMisch, chronikBilanz,
  chronikTage, chronikFehlt, chronikPlan,
} from './logik/chronik.js';
import { PikaPetCard } from './karte.js';

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
// Für die Tests (test/, node --test): reine Funktionen und die Klasse herausgeben. Im Browser setzt niemand
// __pikaTest, dort passiert nichts.
if (typeof globalThis !== 'undefined' && typeof globalThis.__pikaTest === 'function') {
  globalThis.__pikaTest({
    VERSION, PikaPetCard, PLAN_MIN, HAY_MAX, GIFT, ACT_LEN, hasKey, boteRow, clearSpot, sceneUnit,
    planBlank, planSer, planParse, planApply, hayNow, giftLv, pikaDay,
    freshStats, serialize, parseStats, mergeStats, seedRnd, weightedR,
    sunTimes, festDay, festEaster, festAdvent1, festBirthdate,
    GAIN, PET_CALM, KRAUL, petGain, kraulGain, worldPick, MIMIK, FINDS, FIND_GROUPS, findsParse, findsSer,
    WEATHER, twilight, wxCover, starOp, hexRgb, seasonPos, seasonKey, seasonPal, landColors, FLOWER_COLORS, FLOWER_SEASON,
    wxLogAdd, wxLogMerge, wxRows, wxTemp, numAttr, WX_HOLD, snowDepth, snowHours, SNOW, rainbow, BOW, skyPos, flightAloft, flightGhost, planeLag,
    planeClock, planeStale, PLANE_OLD,
    POOP, poopWhen, ACT_SMALL, ACT_WALK, WALK_MAX, walkSpeed, HOP_MS, hopRound, JUMPS, jumpBusy, JUMP_IN, jumpInOk, chaseFar,
    festMoments, FEST_AHEAD, FRIEND_LAST, KRAM, PROP_SEL, WALK_LATE, WALK_REJOIN, KITE_LEAN, kitePaw, EAR_SWING, poopClean, sportPlan,
    MINI_W, MINI_ACTS, MINI_REST, MINI_PROG, miniProg, miniOk, miniBase, miniSwap, miniChain, groundSpot, ACT_NOJOIN, WX_STOP, miniHas,
    miniStart, bigStart, ACT_WIN, ACT_GAP, BOAT_T, boatPos, boatPuffs, bezAt, gliderThrows, GLIDER_STEP, ACT_PX, wxProgThen,
    CHRONIK, chronikDatum, chronikTag, chronikStart, chronikVersatz, chronikZoneOk, chronikKod, chronikLies, chronikMisch, chronikBilanz,
    chronikTage, chronikFehlt, chronikPlan, diaryDerive,
  });
}
