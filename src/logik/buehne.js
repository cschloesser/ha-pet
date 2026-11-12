// Bühne (seit 0.38): Wer vor wem steht, folgt aus dem Fußpunkt. Figuren weiter unten im Bild (näher am Betrachter)
// liegen davor; stehen zwei auf demselben Fußpunkt, entscheidet eine feste Rangfolge. Bis 0.37 lagen ganze Schichten
// vor- oder hintereinander (.mice, .land, .flowers … .poops mit z-index und Lichtfilter je Schicht), so konnten sich
// Figuren aus verschiedenen Schichten nie richtig überlappen. Jetzt sind die Schichten nur noch Behälter ohne
// z-index und ohne Filter: Jede Figur bekommt ihre Ebene selbst (buehneZ), alle stehen im selben Stapel der Szene.
//
// Der Fußpunkt zählt in Größeneinheiten H ab der Bodenlinie gy (negativ = weiter hinten, höher im Bild). Was auf
// einer Reihe steht, hat genau deren Wert: Die paar Pixel, um die Blumen, Futter oder Heu ins Gras sinken, sind kein
// Schritt nach vorn. Darum stehen ohne depth fast alle Figuren auf der vorderen Reihe, und es entscheidet der Rang:
// Er bildet die Reihenfolge der Schichten bis 0.37 nach (test/buehne-szene.json hält sie fest).

import { clamp } from './hilfen.js';
import { LANE_DY } from './einstellungen.js';
import { BOTE_FRONT_DY } from './haus-bote.js';

// Reihen (Fußpunkt in H ab gy). bau: Bau und was an ihm hängt, ganz hinten. hinten: hintere Spur (depth). stein:
// Aussichtsstein (vor der hinteren Spur, hinter der vorderen). vorn: Bodenlinie, die vordere Spur. rand: der vordere
// Wiesenstreifen der Haushaltsgeräte, der Tonne und des Saugroboters.
const REIHE = { bau: -0.12, hinten: -LANE_DY, stein: -0.04, vorn: 0, rand: BOTE_FRONT_DY };

// Rangfolge bei gleichem Fußpunkt, hinten zuerst: die Mal-Reihenfolge der Schichten bis 0.37 (erst alles ohne
// z-index in DOM-Reihenfolge, dann die Ebenen 1 bis 4: Deko am Bau, Vögel und Pika im Bau, Bühne, vorderer Rand)
const RANG = [
  'maus', // Maus, Frosch, Schnecke hinter dem Stein
  'festHinten', // Festdeko hinter dem Bau (Baum, Maibaum, Wimpel)
  'bau', 'stein', 'licht', 'tv', // Bau, Stein, Fensterlicht, Fernsehlicht im Eingang
  'festBau', // Lichter, Girlanden, Laterne am Bau (bis 0.37 über Blumen, Schätzen, Schildern: siehe CHANGELOG 0.38)
  'drachen', 'blume', 'futter', 'schatz', // Schätze, Päckchen, Schild und Postkarte des Urlaubs, Garderobe
  'mausVorn', // Besucher draußen auf der Wiese (bis 0.38 eigene Schicht .mice-f); hinten: Reihe der hinteren Spur
  'schild', // Schild über einem Haushaltsgerät
  'gluehwurm', 'requisit', // Glühwürmchen; Requisiten am Boden hinter dem Pika (Staffelei, Steintürmchen …)
  'vogel', 'pikaBau', // Vögelchen; der Pika im Eingang des Baus
  'pino', 'pika', 'arm', // Pino, der Pika, der Plüsch-Pino
  'heu', 'festVorn', 'gras', 'requisitVorn', 'haeufchen',
  'geraet', 'balken', 'geraetVorn', 'tonne', 'sauger', // vorderer Wiesenstreifen
  'reiter', // depth: der Pika, der auf dem Saugroboter mitfährt, vor allem anderen (seit 0.39)
];
const RANG_N = 40; // Platz je Reihe (mehr Ränge als Platz: der Bau bricht über den Test ab)
const SPANNE = 300; // Fußpunkte von −0,3 H bis +0,3 H, in Tausendsteln von H

// Ebene (z-index) für einen Fußpunkt fuss (in H ab gy) und einen Rang (Name aus RANG oder Zahl). Immer ≥ 1: Was
// keine Ebene hat (Himmel, Hügel), liegt darunter.
const buehneZ = (fuss, rang) => {
  const r = typeof rang === 'number' ? rang : RANG.indexOf(rang);
  return 1 + (clamp(Math.round(fuss * 1000), -SPANNE, SPANNE) + SPANNE) * RANG_N + Math.max(0, r);
};
// Höchste Ebene am Boden: darüber Wetter, Sprechblasen, Leiste, Effekte und Fähnchen (--z-wx …, siehe STYLE)
const BUEHNE_MAX = buehneZ(SPANNE / 1000, RANG_N - 1);

// Figuren, deren Platz fest ist: Reihe je Art. Wer sich bewegt (Pika; ab 0.39 Pino und Besucher), rechnet seine
// Ebene selbst mit buehneZ. Die Namen sind die Arten der Aufnahme (dev/buehne-aufnahme.js).
const BUEHNE = {
  maus: 'bau', festHinten: 'bau', bau: 'bau', stein: 'stein', licht: 'bau', tv: 'bau', festBau: 'bau',
  drachen: 'vorn', blume: 'vorn', futter: 'vorn', schatz: 'vorn', mausVorn: 'vorn', schild: 'vorn', gluehwurm: 'vorn',
  requisit: 'vorn', vogel: 'vorn', pikaBau: 'vorn', pino: 'vorn', pika: 'vorn', arm: 'vorn',
  heu: 'vorn', festVorn: 'vorn', gras: 'vorn', requisitVorn: 'vorn', haeufchen: 'vorn',
  geraet: 'rand', balken: 'rand', geraetVorn: 'rand', tonne: 'rand', sauger: 'rand', reiter: 'rand',
};
// … und ihre Ebenen, für den Stil
const BZ = Object.fromEntries(Object.entries(BUEHNE).map(([art, reihe]) => [art, buehneZ(REIHE[reihe], art)]));

// Lichtfilter einer Figur am Boden (seit 0.38 je Figur statt je Schicht; nur mit .shade an der Szene, siehe _light).
// LICHT_P: Requisiten, die nachts etwas heller bleiben (--lbp)
const LICHT = 'brightness(var(--lb, 1)) saturate(var(--ls, 1))';
const LICHT_P = 'brightness(var(--lbp, 1)) saturate(var(--ls, 1))';

export { REIHE, RANG, RANG_N, buehneZ, BUEHNE_MAX, BUEHNE, BZ, LICHT, LICHT_P };
