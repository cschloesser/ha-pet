// Kleine Beschäftigungen: Auswahl nach Wetter, Takt, Pfütze, Schiffchen, Jo-Jo, Purzelbaum, Papierflieger,
// Platz am Boden

import { clamp, weightedR, clearSpot } from './hilfen.js';

// Grundgewichte. Bis 0.31 wechselten sich Seil und Hantel rund 40-mal am Tag ab; jetzt teilen sich elf den Tag,
// und Regen und Schnee haben ihr eigenes Programm (Pfützenspringen, Papierschiffchen; Schnee-Pika). Die Reihenfolge
// ist Teil der Wahl (weightedR): nicht umsortieren, sonst wählen Geräte mit altem und neuem Stand Verschiedenes.
const MINI_W = {
  rope: 0.7, weights: 0.6, gather: 1, hula: 0.9, yoyo: 0.9, puste: 0.9, purzel: 0.8, stones: 0.8, juggle: 0.8, crown: 0.6,
  glider: 0.8, puddle: 1.5, boat: 1.2, snowpika: 1.3,
};
const MINI_ACTS = Object.keys(MINI_W);
// Bei liegendem Schnee geht nur, was keinen freien Boden und keine Blumen braucht
const MINI_SNOW = new Set(['weights', 'hula', 'yoyo', 'purzel', 'juggle', 'glider']);
// Jedes Wetter hat sein Programm: trocken (dry), Regen (rain), Schnee liegt (snow). Gewählt wird aus der ganzen
// Liste des Programms, mit den Gewichten aus MINI_W (miniChain).
const MINI_PROG = {
  dry: MINI_ACTS.filter((a) => !['puddle', 'boat', 'snowpika'].includes(a)),
  rain: ['puddle', 'boat'],
  snow: MINI_ACTS.filter((a) => MINI_SNOW.has(a) || a === 'snowpika'),
};
// Bei Regen bleibt gut die Hälfte der Fenster leer (Gewicht für „nichts“): Pfütze und Schiffchen wechselten sich
// an einem Regentag sonst so oft ab wie früher Seil und Hantel
const MINI_REST = 3;
// Welches Programm gilt bei der Lage L? null: keines (Starkregen und Gewitter: er bleibt im Bau; Regen auf Schnee)
const miniProg = (L) => (L.shelter ? null : L.rain > 0 && !L.snowcover ? 'rain' : L.wet || L.storm ? null : L.snowcover ? 'snow' : 'dry');
// Geht die kleine Beschäftigung act bei dieser Lage? L: { wet, rain, storm, shelter, snowcover, cold, wind, hayFull,
// winter } (_lage). Bei Starkregen und Gewitter (shelter) bleibt er im Bau; bei Regen hält eine Pfote das Blatt,
// da gehen nur Pfütze und Schiffchen. Innerhalb eines Programms sperren nur drei Schalter etwas: voller Vorrat
// (Blüte sammeln), Kälte und Winter (Blumenkranz), Wind ab 40 km/h (Papierflieger, auch im Schnee). Der
// Festtagshut gehört nicht dazu: Er hängt an der Konfiguration der einzelnen Karte (_actOk).
const miniOk = (act, L) => {
  if (L.shelter) return false;
  if (act === 'puddle' || act === 'boat') return L.rain > 0 && !L.snowcover;
  if (act === 'gather') return !L.wet && !L.snowcover && !L.hayFull;
  if (L.wet || L.storm) return false;
  if (act === 'snowpika') return !!L.snowcover;
  if (act === 'glider') return (L.wind || 0) < 40;
  if (L.snowcover) return MINI_SNOW.has(act);
  if (act === 'crown') return !L.cold && !L.winter; // Gänseblümchen
  return true;
};
// Grundwahl eines Fensters im Programm prog: mit festen Gewichten aus allen Beschäftigungen des Programms (feste
// Zahl u), ohne auf Wind, Kälte oder Vorrat zu schauen. Nur wenn das dieselbe wäre wie die Grundwahl davor (prev),
// neu aus den übrigen (u2). Bei Regen ist „nichts“ (null) eine der Möglichkeiten.
const miniBase = (prog, prev, u, u2 = u) => {
  const list = (skip) => [...MINI_PROG[prog].map((a) => [a !== skip ? MINI_W[a] : 0, a]), [prog === 'rain' ? MINI_REST : 0, null]];
  const a = weightedR(list(null), u);
  return a === null || a !== prev ? a : weightedR(list(prev), u2);
};
// Ersatz, wenn die Grundwahl bei der Lage L gerade nicht geht: wieder mit den festen Gewichten des ganzen
// Programms ziehen (feste Zahlen un(0), un(1) …), bis eine kommt, die geht und nicht in skip steht (das Fenster
// davor und danach); nach MINI_TRIES − 1 Fehlgriffen aus denen, die übrig sind. null: es bleibt nichts übrig.
// So ändert auch ein zweiter Schalter nur die Fenster, in deren Zügen die gesperrte vorkommt.
const MINI_TRIES = 6;
const miniSwap = (prog, L, skip, un) => {
  const ok = (a) => !skip.includes(a) && miniOk(a, L);
  const all = MINI_PROG[prog].map((a) => [MINI_W[a], a]);
  for (let k = 0; k < MINI_TRIES - 1; k++) {
    const a = weightedR(all, un(k));
    if (ok(a)) return a;
  }
  return weightedR(all.map(([w, a]) => [ok(a) ? w : 0, a]), un(MINI_TRIES - 1));
};
// Welche kleine kommt im Fenster m bei der Lage L dran? null: keine.
// 1. Die Grundfolge des Programms (miniBase) hängt nur an den festen Zahlen der Fenster: Sie beginnt nach dem
//    letzten Fenster ohne kleine (dort steht fest: keine), höchstens MINI_BACK Fenster zurück, und enthält nie
//    dieselbe zweimal hintereinander. Jedes Fenster sieht seinen Vorgänger so wie der Nachfolger ihn, auf jedem
//    Gerät und bei jeder Lage. (Bis 0.31 begann die Kette fest vier Fenster vorher: Zwei Fenster konnten sich
//    über ihren gemeinsamen Vorgänger uneins sein.)
// 2. Nur wo die Grundwahl gerade nicht geht (miniOk: Wind, Kälte, voller Vorrat), kommt ein Ersatz (miniSwap):
//    nicht die Grundwahl davor oder danach und nicht, was im Fenster davor bei dieser Lage wirklich dran war.
// Ein Schalter ändert so nur die Fenster, die er trifft, statt die ganze Folge zu verschieben. Zweimal dieselbe
// hintereinander gibt es bei gleichbleibender Lage nie und auch nicht, wenn ein einzelner Schalter umspringt;
// möglich bleibt es, wenn zwischen zwei Fenstern das Programm wechselt (trocken ↔ Schnee) oder beide Fenster
// bei verschiedener Lage Ersatz brauchen.
// has(j): Gibt es im Fenster j eine kleine? u(j), u2(j): seine festen Zahlen für die Grundwahl; u3(j, k): für
// den k-ten Zug des Ersatzes.
const MINI_BACK = 24;
const miniChain = (m, L, has, u, u2 = u, u3 = (j) => u2(j)) => {
  const prog = miniProg(L);
  if (!prog || !has(m)) return null;
  let s = m;
  while (s > m - MINI_BACK && has(s - 1)) s--;
  const base = [];
  for (let j = s; j <= m + 1; j++) base.push(j <= m || has(j) ? miniBase(prog, base[base.length - 1] ?? null, u(j), u2(j)) : null);
  let act = null;
  for (let j = s; j <= m; j++) {
    const b = base[j - s];
    act = b === null || miniOk(b, L) ? b : miniSwap(prog, L, [act, base[j - s - 1] ?? null, base[j - s + 1]], (k) => u3(j, k));
  }
  return act;
};
// Takt und Länge der neuen kleinen (ms), aus den festen Zahlen r des Fensters
const PUDDLE_MS = 1150; // ein Sprung in die Pfütze
const puddleJumps = (r) => 5 + Math.floor(r(1) * 5);
// Papierschiffchen: zu Wasser lassen (launch), je Etappe (puff), Rückfahrt (back). In jeder Etappe holt er blow ms
// lang Luft und pustet, dann gleitet das Schiffchen glide ms lang ein Stück weiter (Kurve BOAT_EASE); home ms vor
// dem Ende ist es zurück an seinem Ufer.
const BOAT_T = { launch: 2000, puff: 2400, back: 4200, blow: 650, glide: 1800, home: 200 };
const BOAT_EASE = [0.2, 0.7, 0.3, 1];
const boatPuffs = (r) => 3 + Math.floor(r(1) * 2);
// Wert der CSS-Zeitkurve cubic-bezier(x1, y1, x2, y2) beim Anteil x der Dauer
const bezAt = (x1, y1, x2, y2, x) => {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    if (f(x1, x2, t) < x) lo = t;
    else hi = t;
  }
  return f(y1, y2, (lo + hi) / 2);
};
// Wo ist das Schiffchen t ms nach Beginn des Hauptteils (Planzeit) bei K Etappen? 0 = an seinem Ufer, 1 = drüben.
// Eine begonnene Etappe zählt erst, wenn er gepustet hat (blow), und dann nur so weit, wie das Schiffchen schon
// geglitten ist: Ein Gerät, das später einsteigt, setzt es genau dorthin, wo es auf den anderen gerade ist.
const boatPos = (t, K) => {
  const t1 = BOAT_T.launch + K * BOAT_T.puff;
  if (t >= t1) return 1 - bezAt(0.42, 0, 0.58, 1, (t - t1) / (BOAT_T.back - BOAT_T.home)); // ease-in-out
  const k = Math.floor((t - BOAT_T.launch) / BOAT_T.puff);
  if (k < 0) return 0;
  return (k + bezAt(...BOAT_EASE, (t - BOAT_T.launch - k * BOAT_T.puff - BOAT_T.blow) / BOAT_T.glide)) / K;
};
const YOYO_MS = 1000; // einmal hinunter und wieder hoch
const YOYO_DEAD = 3200; // es bleibt unten hängen und wird aufgewickelt
const yoyoThrows = (r) => 8 + Math.floor(r(1) * 6);
const yoyoDead = (r) => (r(6) < 0.35 ? 3 + Math.floor(r(7) * (yoyoThrows(r) - 4)) : -1);
const PUSTE_MS = 2700; // einmal Luft holen und pusten
const PURZEL_MS = 2600; // ein Purzelbaum mit Anlauf und Schwindel
const PURZEL_ROLL = 760; // die Rolle selbst, wie die Animation purzel
const purzelRolls = (r) => 2 + Math.floor(r(1) * 2);
const STONE_MS = 2300; // ein Stein aufs Türmchen
const GLIDER_FLY = 2300; // Flug des Papierfliegers
const GLIDER_WALK = 2000; // so lange hat er, um hinterherzulaufen (bei weiten Würfen auf breiten Karten eilt er)
// Von Wurf zu Wurf: ducken, Flug, nachschauen, hinterher (ganze Hopser), aufheben, wieder zur Hand
const GLIDER_STEP = 380 + GLIDER_FLY + 300 + GLIDER_WALK + 150 + 450 + 600;
const GLIDER_PAW = 122 / 120 - 0.5; // die Pfote mit dem Flieger, in Pika-Breiten vor seiner Mitte
// Papierflieger: die Würfe ab dem Standplatz x, je Wurf eine feste Zahl aus us (Weite). G: { W, pW, pH, xR, hayR }.
// Er fliegt über die Wiese, zuerst dorthin, wo mehr Platz ist, der nächste Wurf geht zurück. Landen darf er rechts
// bis vor dem Stein (dort hebt der Pika ihn auf), links nur bis zum Vorrat, nicht vor der Tür; die Mitte des
// Fliegers (Breite gw) bleibt in diesem Streifen, also auch in der Karte. Ist dafür kaum Platz (schmale Karte),
// wirft er steil (steep): Der Flieger steigt und landet vor seinen Füßen. Ergebnis je Wurf: { dir, ox: Abwurf,
// land: Mitte des gelandeten Fliegers, gw, steep, to: dorthin läuft er zum Aufheben }.
const gliderThrows = (x, us, { W, pW, pH, xR, hayR }) => {
  const gw = pH * 0.3;
  const lo = Math.max(pW * 0.45, hayR);
  const hi = xR + pW * 0.3;
  let dir = x - lo < hi - x ? 1 : -1;
  return us.map((u) => {
    const ox = x + dir * pW * GLIDER_PAW;
    const room = (dir > 0 ? hi - x : x - lo) - pW * 0.52 - gw;
    const land = clamp(ox + dir * clamp(room, 0, W * (0.26 + u * 0.12)), lo + gw / 2, hi - gw / 2);
    const T = { dir, ox, land, gw, steep: Math.abs(land - ox) < pW * 0.6, to: clamp(land - dir * pW * (GLIDER_PAW - 0.06), pW * 0.45, xR) };
    x = T.to;
    dir = -dir;
    return T;
  });
};
// Platz eines Requisits am Boden (Pfütze, Schnee-Pika, Steintürmchen): Mitte aus der festen Zahl u so zwischen a
// und b, dass es mit seiner Breite w ganz dazwischen liegt. Ist dort zu wenig Platz (schmale Karte), wird es
// schmaler (bis kMin · w) und liegt notfalls mittig. Sperren [l, r] (Geräte des Haus-Boten, Festdeko, Schätze,
// Häufchen) weicht es über clearSpot aus. Ergebnis: { x: Mitte, w: Breite }. Relativ zur Wiese überall dieselbe Stelle.
const groundSpot = (u, w, a, b, blocks = [], kMin = 0.6) => {
  const k = clamp((b - a) / w, kMin, 1);
  const m = (w * k) / 2;
  const lo = Math.min(a + m, (a + b) / 2);
  const hi = Math.max(b - m, (a + b) / 2);
  return { x: clearSpot(lo + u * (hi - lo), w * k, lo, hi, blocks), w: w * k };
};

export {
  MINI_W, MINI_ACTS, MINI_PROG, MINI_REST, miniProg, miniOk, miniBase, miniSwap, miniChain, PUDDLE_MS, puddleJumps,
  BOAT_T, BOAT_EASE, boatPuffs, bezAt, boatPos, YOYO_MS, YOYO_DEAD, yoyoThrows, yoyoDead, PUSTE_MS, PURZEL_MS,
  PURZEL_ROLL, purzelRolls, STONE_MS, GLIDER_FLY, GLIDER_WALK, GLIDER_STEP, gliderThrows, groundSpot,
};
