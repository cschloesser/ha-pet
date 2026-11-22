// Zwei Karten an einem Home Assistant: Zustand und Tagesplan über die echten Wege der Karte (set hass, _add, _save,
// _planOp, _planSaveNow), mit eigener Uhr und einem nachgestellten HA (siehe welt.mjs). node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const sek = (t) => Math.round(t / 1000) * 1000;

// Die Karte von 0.42.1 (aus git): ein Gerät, das noch nicht aktualisiert ist und den Fehler noch hat. Ohne git (z. B.
// ein ausgepacktes Archiv) wird der Test damit übersprungen.
let ALT = null;
try {
  ALT = execSync('git show b06aebc:pika-pet-card.js', { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) { ALT = null; }

// Eine Welt mit gefüllten Helfern: Zustand 60/60 von eben, im Plan zwei Päckchen im Vorrat, drei Freundschaftstage,
// heute dreimal gestreichelt, ein Erlebnis (Löwenzahn). → { W, T, tag, helfer(), gift(), cute() }
const anfang = (opt) => {
  const W = welt(opt);
  const { T } = W;
  const t0 = W.jetzt();
  const tag = T.pikaDay(t0);
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 2, a: 10, f: 3, p: sek(t0 - 36e5) } },
    { t: 'pet', d: tag, n: 3 },
    { t: 'mem', d: tag, b: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  const helfer = () => T.planParse(W.ha.wert(PLAN));
  return { W, T, tag, helfer, gift: () => plain(helfer().gift), cute: () => plain(helfer().cute), stand: () => T.parseStats(W.ha.wert(ZUSTAND)) };
};
// Ein Päckchen verschenken und auspacken, wie es die Karte tut (Schatz 3 kommt ins Album)
const schenken = async (W, K, z) => {
  K.c._planOp({ t: 'give', z, i: 3, gold: false, x: sek(W.jetzt()), r: 7 });
  await W.vor(1000);
  K.c._planOp({ t: 'gopen', z });
  await W.vor(1000);
};
// Alle Karten sehen, was im Helfer steht, und haben nichts mehr offen
const einig = (W, T, ...karten) => {
  for (const K of karten) {
    assert.equal(T.planSer(K.c._plan), W.ha.wert(PLAN), `${K.name} sieht den Plan aus dem Helfer`);
    assert.equal(K.c._planSent.length, 0, `${K.name}: kein Schreiben des Plans ohne Echo`);
    assert.ok(!K.c._planOps.some((o) => o.at > K.c._planAck), `${K.name}: keine unbestätigte Änderung`);
    assert.equal(K.c._sent.length, 0, `${K.name}: kein Schreiben des Zustands ohne Echo`);
  }
};
const zeilen = (W, id) => W.ha.verlauf.filter((r) => r.id === id).length;

test('Zwei Karten: Echo, fremder Stand und fast gleichzeitige Änderungen (Zustand und Plan)', async () => {
  const { W, T, tag, cute, stand } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  assert.equal(A.c._planOk && B.c._planOk && A.c._synced && B.c._synced, true, 'beide haben Zustand und Plan gelesen');
  assert.deepEqual(A.plan(), B.plan());
  // A streichelt: ein Schreiben je Helfer, A bekommt sein Echo, B den fremden Stand
  A.streicheln();
  await W.vor(3000);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 });
  assert.equal(B.plan().cute.n, 4);
  assert.deepEqual(W.ha.zeilen(PLAN).map((z) => z.split(':')[0]), ['anfang', 'A']);
  assert.deepEqual(W.ha.zeilen(ZUSTAND).map((z) => z.split(':')[0]), ['anfang', 'A']);
  assert.equal(A.c._planAck > 0, true, 'das Echo hat A die Änderung bestätigt');
  assert.deepEqual(B.werte(), A.werte());
  assert.ok(Math.abs(stand().g - 64) < 0.2, `glücklich ${stand().g}`);
  assert.deepEqual([B.geschrieben(PLAN).length, B.geschrieben(ZUSTAND).length], [0, 0], 'B hatte nichts zu schreiben');
  einig(W, T, A, B);
  // Beide zugleich, ehe einer vom anderen weiß: A füttert und merkt sich ein Erlebnis, B streichelt. Das spätere
  // Schreiben überschreibt im Helfer das frühere; wer überschrieben wurde, legt seine Änderung noch einmal obendrauf.
  A.fuettern(20);
  A.c._planOp({ t: 'mem', d: tag, b: 4 });
  B.streicheln();
  await W.vor(20000);
  assert.deepEqual(cute(), { d: tag, n: 5, m: 5 }, 'Streicheln von B und Erlebnis von A');
  assert.ok(Math.abs(stand().s - 80) < 0.3 && Math.abs(stand().g - 68) < 0.3, `satt ${stand().s}, glücklich ${stand().g}`);
  einig(W, T, A, B);
  // Kurz nacheinander gestreichelt: B sieht A's Zähler, ehe sein eigenes Streicheln hinausgeht. Beides zählt.
  A.streicheln(0);
  await W.vor(300);
  B.streicheln(0);
  await W.vor(20000);
  assert.equal(cute().n, 7, 'zweimal gestreichelt sind zwei mehr, nicht der höhere von zwei gleichen Zählern');
  einig(W, T, A, B);
  // … und danach ist Ruhe: Niemand schreibt weiter
  const [zp, zs] = [zeilen(W, PLAN), zeilen(W, ZUSTAND)];
  const rufe = A.aufrufe.length + B.aufrufe.length;
  await W.vor(5 * 6e4);
  assert.deepEqual([zeilen(W, PLAN), zeilen(W, ZUSTAND), A.aufrufe.length + B.aufrufe.length], [zp, zs, rufe]);
  assert.deepEqual(W.warnungen, []);
});

test('Zustand: verlorenes Schreiben mit spätem Echo zählt nur einmal (_sentCheck, _sentLost, _gainSub)', async () => {
  const { W, T, stand } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // A füttert, das Schreiben bleibt in der Leitung hängen
  A.leitung = 'halten';
  A.fuettern(20);
  await W.vor(2000);
  assert.equal(A.stau.length, 1);
  const e = A.c._sent[0];
  assert.equal(e.gain.s, 20, 'der Gewinn hängt am unbestätigten Schreiben');
  assert.equal(A.c._gain.s, 0);
  // 15 s ohne Echo, aber auch ohne irgendein hass: Die Karte bekommt gerade nichts mit, verloren ist noch nichts
  await W.vor(15000);
  assert.deepEqual([A.c._sent.length, A.c._sent[0] === e, A.c._gain.s], [1, true, 0]);
  // Jetzt meldet HA etwas (frisch und verbunden), das Echo fehlt weiter: beim nächsten Nachsehen gilt es als verloren.
  // Der Gewinn ist wieder ungesendet, das Schreiben gemerkt (_lostW), ein neues steht an.
  W.regung();
  await W.vor(29500);
  assert.deepEqual([A.c._sent.length, A.c._gain.s, A.c._lostW.length, !!A.c._saveT], [0, 20, 1, true]);
  assert.equal(A.c._lostW[0].v, e.v);
  // Da kommt das verloren Geglaubte doch noch an: Der Gewinn steckt schon im Helfer und wird aus dem Ungesendeten
  // genommen, sonst käme er beim nächsten fremden Stand ein zweites Mal obendrauf.
  A.leitung = 'sofort';
  A.freigeben();
  await W.vor(100);
  assert.equal(W.ha.wert(ZUSTAND), e.v);
  assert.deepEqual([A.c._gain.s, A.c._lostW.length], [0, 0]);
  await W.vor(5000);
  assert.equal(A.geschrieben(ZUSTAND).length, 1, 'derselbe Wert wird nicht noch einmal gesendet');
  assert.ok(Math.abs(stand().s - 80) < 0.2, `satt ${stand().s}`);
  // Probe: B füttert, A übernimmt den fremden Stand, ohne die 20 noch einmal daraufzulegen
  B.fuettern(10);
  await W.vor(20000);
  assert.ok(stand().s > 89.5 && stand().s <= 90, `satt ${stand().s} (einmal 20, einmal 10)`);
  assert.deepEqual(A.werte(), B.werte());
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
  einig(W, T, A, B);
  // Abgelehnt (HA nimmt den Wert nicht): neuer Versuch nach 5 s, auch der Gewinn geht nur einmal ein
  B.leitung = (x) => (B.aufrufe.filter((y) => y.id === ZUSTAND).length < 3 && x.id === ZUSTAND ? 'ablehnen' : 'sofort');
  B.fuettern(5);
  await W.vor(30000);
  assert.deepEqual(B.aufrufe.filter((x) => x.id === ZUSTAND).map((x) => x.weg), ['angekommen', 'abgelehnt', 'angekommen']);
  assert.ok(stand().s > 94 && stand().s <= 95, `satt ${stand().s}`);
  einig(W, T, A, B);
  assert.equal(W.warnungen.length, 1, 'eine Warnung für das abgelehnte Schreiben');
});

// Fehler Nr. 1 der Durchsicht. A war zwei Stunden weg und kennt nur den Plan von davor. B hat inzwischen ein Päckchen
// verschenkt und ausgepackt, gestreichelt und etwas erlebt. A kommt zurück, und jemand streichelt, bevor der frische
// Stand da ist. Am Ende muss im Helfer alles von B stehen und das Streicheln von A.
const veraltet = async (wie) => {
  const { W, T, tag, gift, cute, stand } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // A geht in den Hintergrund; nach 5 Min schließt HA die Verbindung
  A.verstecken();
  await W.vor(5 * 6e4);
  if (wie === 'panel') A.abhaengen(); // … und räumt das Panel weg: Die Karte erfährt vom Trennen nichts mehr
  A.trennen();
  await W.vor(30 * 6e4);
  await schenken(W, B, 1);
  B.streicheln();
  B.streicheln();
  B.c._planOp({ t: 'mem', d: tag, b: 4 });
  await W.vor(90 * 6e4);
  const frisch = W.ha.wert(PLAN);
  assert.deepEqual([gift().z, gift().o, gift().u, gift().n], [1, 1, 8, 1], 'B hat verschenkt und ausgepackt');
  assert.deepEqual(cute(), { d: tag, n: 5, m: 5 });
  assert.equal(A.plan().gift.z, 0, 'A weiß davon nichts');
  const g0 = B.werte().g;
  // A kommt nach vorn, die Verbindung baut sich auf
  A.aufbauen();
  if (wie === 'panel') {
    A.einhaengen({ hass: false });
    await W.vor(700); // die 0,6 s, nach denen der Stand einer wieder eingehängten Karte als frisch gilt, sind um
    assert.equal(A.c._hass.connected, true, 'ihr letztes hass-Objekt sagt noch „verbunden“');
  }
  A.zeigen();
  A.streicheln();
  await W.vor(3000);
  assert.deepEqual(A.schlange.filter((e) => e.id === PLAN), [], 'A sendet den Plan nicht in die Warteschlange der Verbindung');
  assert.equal(W.ha.wert(PLAN), frisch);
  assert.equal(A.plan().cute.n, 4, 'bei A ist schon gestreichelt');
  // Verbindung steht: erst geht hinaus, was wartete, dann kommt der frische Stand
  A.verbinden();
  await W.vor(30000);
  assert.deepEqual([gift().z, gift().o, gift().u, gift().n], [1, 1, 8, 1], 'Päckchen und Album von B sind noch da');
  assert.deepEqual(cute(), { d: tag, n: 6, m: 5 }, 'B hat zweimal gestreichelt, A einmal; die Erlebnisse von B sind noch da');
  assert.ok(A.geschrieben(PLAN).every((v) => T.planParse(v).gift.z === 1), 'A hat nie einen Plan ohne das Päckchen von B geschrieben');
  assert.equal(A.geschrieben(PLAN).length, 1);
  // Der Zustand wartet getrennt ebenfalls (_saveWait) und kommt auf den frischen Stand obendrauf, auch wenn das letzte
  // hass-Objekt der Karte noch „verbunden“ sagt (weggeräumtes Panel): Gefragt wird die Verbindung selbst.
  assert.deepEqual(A.schlange, []);
  assert.ok(B.werte().g > g0 + 3 && B.werte().g <= g0 + 4, `auch das Glück vom Streicheln bei A ist angekommen (${g0} → ${B.werte().g})`);
  assert.equal(stand().g, T.parseStats(A.geschrieben(ZUSTAND).at(-1)).g);
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
  einig(W, T, A, B);
  assert.deepEqual(W.warnungen, []);
};
test('Tagesplan: nach zwei Stunden ohne Verbindung überschreibt die Karte nicht, was inzwischen geschah', () => veraltet('tab'));
test('Tagesplan: auch nicht, wenn HA das Panel im Hintergrund weggeräumt hat und die Karte „verbunden“ glaubt', () => veraltet('panel'));

test('Tagesplan: nach dem Wiederverbinden bleibt nichts liegen, auch wenn niemand sonst geschrieben hat', async () => {
  const { W, T, tag, cute } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // Kurze Lücke (WLAN): Was A getrennt ändert, wartet und geht mit dem frischen Stand hinaus
  A.trennen();
  A.streicheln();
  await W.vor(20000);
  assert.deepEqual([A.geschrieben(PLAN).length, A.c._planHeld, A.plan().cute.n], [0, true, 4]);
  A.aufbauen();
  A.verbinden();
  assert.equal(A.c._planStale, true, 'nach jedem Wiederverbinden gilt der Stand erst einmal als veraltet');
  await W.vor(100);
  assert.equal(A.c._planStale, false, 'frische Zustände sind da');
  await W.vor(5000);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 });
  assert.deepEqual([A.geschrieben(PLAN).length, A.geschrieben(ZUSTAND).length], [1, 1]);
  einig(W, T, A, B);
  // Ein Gastgeber, der nach „verbunden“ keine neuen Zustände schickt (es hat sich nichts geändert): Nach der Frist
  // gilt der alte Stand, das Schreiben geht hinaus
  A.trennen();
  A.c._petCount();
  await W.vor(2000);
  Object.assign(A, { verbunden: true, phase: null });
  A.setzeHass();
  await W.vor(8000);
  assert.deepEqual([A.geschrieben(PLAN).length, A.c._planStale, !!A.c._planDoubt], [1, false, true], 'noch im Zweifel');
  await W.vor(10000);
  assert.equal(A.geschrieben(PLAN).length, 2);
  assert.equal(cute().n, 5);
  einig(W, T, A, B);
  // Lange versteckt, die Verbindung blieb (unter 5 Min): Der Stand kam die ganze Zeit an. Geschrieben wird, sobald er
  // nicht mehr als veraltet gilt (hier: 4 s ohne neue Zustände).
  A.verstecken();
  await W.vor(2 * 6e4);
  A.zeigen();
  assert.equal(A.c._planStale, true);
  A.c._petCount();
  await W.vor(3000);
  assert.equal(A.geschrieben(PLAN).length, 2, 'wartet auf den frischen Stand');
  await W.vor(8000);
  assert.equal(A.geschrieben(PLAN).length, 3);
  assert.equal(cute().n, 6);
  einig(W, T, A, B);
  // Danach wartet nichts mehr, und kein Zeitgeber des Plans läuft weiter
  await W.vor(60000);
  assert.deepEqual([A.c._planHeld, A.c._planDoubt, A.c._planT, A.c._planRT], [false, null, null, null]);
  assert.equal(A.geschrieben(PLAN).length, 3);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: ein abgelehntes Schreiben geht nach 5 s noch einmal hinaus, ein verlorenes erst, wenn HA wieder liefert', async () => {
  const { W, T, cute } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // Abgelehnt: sicher nicht angekommen. Neuer Versuch, auch wenn von HA sonst nichts kommt.
  A.leitung = () => (A.aufrufe.length === 1 ? 'ablehnen' : 'sofort');
  A.c._petCount();
  await W.vor(20000);
  assert.deepEqual(A.aufrufe.map((e) => [e.weg, e.t - A.aufrufe[0].t]), [['abgelehnt', 0], ['angekommen', 5400]]);
  assert.equal(cute().n, 4);
  einig(W, T, A, B);
  assert.equal(W.warnungen.length, 1);
  // Verloren (kein Fehler, kein Echo): Solange gar kein hass kommt, bekommt die Karte nichts mit und sendet nicht
  // wieder denselben Plan (wie eine abgehängte Karte, deren hass-Objekt noch senden kann)
  A.leitung = () => (A.aufrufe.length === 3 ? 'verlieren' : 'sofort');
  A.c._petCount();
  await W.vor(5 * 6e4);
  assert.deepEqual(A.aufrufe.map((e) => e.weg), ['abgelehnt', 'angekommen', 'verloren']);
  assert.equal(cute().n, 4);
  // HA liefert wieder (irgendetwas ändert sich), das Echo fehlt weiter: noch einmal senden
  W.regung();
  await W.vor(16000);
  assert.deepEqual(A.aufrufe.map((e) => e.weg), ['abgelehnt', 'angekommen', 'verloren', 'angekommen']);
  assert.equal(cute().n, 5);
  einig(W, T, A, B);
});

test('Tagesplan: eine abgehängte Karte schreibt keinen veralteten Plan', async () => {
  const { W, T, tag, gift, cute } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // A streichelt und wird abgehängt, bevor das Echo da ist (andere Ansicht): Die Änderung bleibt für A unbestätigt.
  // Bis 0.42.1 sendete A von da an alle 15,4 s wieder seinen Plan, bis zu 30 Min lang.
  A.streicheln(0);
  await W.vor(410);
  assert.equal(A.geschrieben(PLAN).length, 1);
  A.abhaengen();
  await W.vor(60000);
  assert.equal(cute().n, 4, 'das Streicheln selbst ist angekommen');
  await schenken(W, B, 1);
  B.streicheln(0);
  await W.vor(35 * 6e4);
  assert.equal(A.geschrieben(PLAN).length, 1, 'abgehängt kein weiteres Schreiben');
  assert.deepEqual([gift().z, gift().o, gift().u, cute().n], [1, 1, 8, 5]);
  assert.equal(W.ha.zeilen(PLAN).filter((z) => z.startsWith('A:')).length, 1);
  // Wieder eingehängt (Ansicht aus dem Zwischenspeicher, HA setzt gleich sein hass): A übernimmt, nichts zu schreiben
  A.einhaengen();
  await W.vor(30000);
  assert.equal(A.geschrieben(PLAN).length, 1);
  einig(W, T, A, B);
  // Die Zustände von eben tragen Zeitstempel von vor einer halben Stunde: keine Zeitproben, A's Uhr von HA geht richtig
  assert.ok(Math.abs(A.c._haNow() - W.jetzt()) < 500, `Uhr von A: ${A.c._haNow() - W.jetzt()} ms daneben`);
  // Streicheln und sofort weg (unter 0,4 s, noch nichts gesendet): Es geht beim Abhängen noch hinaus, danach nichts mehr
  A.streicheln(0);
  await W.vor(100);
  A.abhaengen();
  await W.vor(100);
  assert.equal(cute().n, 6);
  B.streicheln(0);
  await W.vor(20 * 6e4);
  assert.deepEqual([A.geschrieben(PLAN).length, cute().n], [2, 7]);
  // Eine Änderung, die erst in der abgehängten Karte entsteht (ein Zeitgeber, der noch lief): bleibt liegen …
  A.c._planOp({ t: 'mem', d: tag, b: 16 });
  await W.vor(5 * 6e4);
  assert.deepEqual([A.geschrieben(PLAN).length, cute().m], [2, 1]);
  B.c._planOp({ t: 'mem', d: tag, b: 2 });
  await W.vor(5 * 6e4);
  // … und geht beim Einhängen hinaus, auf den Stand von dann gelegt
  A.einhaengen();
  await W.vor(30000);
  assert.deepEqual(cute(), { d: tag, n: 7, m: 19 });
  assert.equal(A.geschrieben(PLAN).length, 3);
  assert.equal(T.planParse(A.geschrieben(PLAN)[2]).cute.n, 7, 'mit dem Streicheln von B');
  einig(W, T, A, B);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: was nur wächst, fällt nicht zurück, wenn ein Gerät von einem veralteten Stand aus schreibt', async () => {
  const { W, T, tag, helfer, gift, cute } = anfang();
  const alt = T.planParse(W.ha.wert(PLAN)); // der Stand, den das veraltete Gerät kennt
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // B verschenkt und packt aus, streichelt, erlebt etwas, und es wird ein guter Tag (Freundschaftstag 4)
  await schenken(W, B, 1);
  B.streicheln(0);
  B.c._planOp({ t: 'mem', d: tag, b: 4 });
  B.c._planOp({ t: 'feed', f: { t: sek(W.jetzt()), x: 40, k: 0, e: false } });
  B.c._planOp({ t: 'ggood', d: tag });
  B.c._planOp({ t: 'rec', k: 1000, a: 'paint', v: 'blume' });
  await W.vor(60000);
  assert.deepEqual([gift().z, gift().o, gift().u, gift().f, gift().n], [1, 1, 8, 4, 1]);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 | 4 | T.MEM_GUT });
  einig(W, T, A, B);
  // Ein Gerät mit einer Karte bis 0.42.1 schreibt vom alten Stand aus (dort einmal gestreichelt und etwas erlebt)
  const n0 = zeilen(W, PLAN);
  let S = T.planApply(alt, { t: 'pet', d: tag, n: 4 }, W.jetzt());
  S = T.planApply(S, { t: 'mem', d: tag, b: 64 }, W.jetzt());
  W.ha.setze(PLAN, T.planSer(S), 'alt');
  await W.vor(1000);
  assert.equal(gift().z, 0, 'im Helfer steht erst einmal der veraltete Stand');
  // (nicht sofort: Wäre es nur ein fast gleichzeitiges Schreiben gewesen, legte das andere Gerät seine Änderung selbst nach)
  await W.vor(30000);
  const G = gift();
  assert.deepEqual([G.z, G.o, G.u, G.f, G.i, G.r, G.x], [1, 1, 8, 4, 3, 7, B.plan().gift.x], 'verschenkt, ausgepackt, Album, Freundschaftstage');
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 | 4 | 64 | T.MEM_GUT }, 'Zähler und Erlebnisse beider Seiten');
  // Was auch sinken darf, bleibt, wie es das andere Gerät schrieb: Das Päckchen liegt wieder im Vorrat
  assert.equal(G.n, 2);
  assert.equal(zeilen(W, PLAN), n0 + 2, 'eine Zeile für den veralteten Stand, eine fürs Vervollständigen (beide Karten schreiben dasselbe)');
  // … und der Verlauf ist mit zurück (dem veralteten Stand fehlte das Malen)
  assert.deepEqual(plain(helfer().rec), [[1000, 'paint', 'blume']]);
  einig(W, T, A, B);
  // Kein Streicheln und kein Erlebnis dazwischen, aber im Verlauf fehlt die jüngste Beschäftigung: auch das ist erwiesen alt
  B.c._planOp({ t: 'rec', k: 1001, a: 'music' });
  B.c._planOp({ t: 'rec', k: 1002, a: 'read' });
  await schenken(W, B, 2);
  await W.vor(20000);
  assert.deepEqual([gift().z, gift().o], [2, 2]);
  const R = T.planParse(W.ha.wert(PLAN));
  W.ha.setze(PLAN, T.planSer({ ...R, rec: R.rec.filter((e) => e[0] !== 1002), gift: { ...R.gift, z: 1, o: 1, v: 0 } }), 'alt');
  await W.vor(30000);
  assert.deepEqual([gift().z, gift().o, gift().v], [2, 2, 8]);
  assert.equal(helfer().rec.map((e) => e[0]).join(), '1002,1001,1000');
  einig(W, T, A, B);

  // Und was sinken darf, sinkt weiter.
  // Vorschau „Päckchen zurücksetzen“, „Stufen weg“, Freundschaftstage setzen: Das kommt von einem frischen Stand
  // (gdbg), die andere Karte übernimmt es und schreibt nichts zurück.
  const ruhig = async (was, f) => {
    const vorher = B.geschrieben(PLAN).length;
    A.c._planOp({ t: 'gdbg', f });
    await W.vor(30000);
    assert.equal(B.geschrieben(PLAN).length, vorher, `${was}: B schreibt nichts zurück`);
    for (const [k, v] of Object.entries(f)) assert.equal(helfer().gift[k], v, `${was}: ${k}`);
    einig(W, T, A, B);
  };
  await ruhig('Stufen weg', { v: 0 });
  await ruhig('Freundschaftstage', { f: 2 });
  await ruhig('Meilenstein', { z: 1, o: 1, u: 255, v: 0 });
  await ruhig('Päckchen zurücksetzen', { k: sek(W.jetzt()), a: 0, n: 0, u: 0, v: 0, z: 0, o: 0, b: null, x: 0, y: 0, d: 0, i: 0 });
  // Urlaub und Rückkehr (voff rückt Fortschritt und Heu, _urlaubRebase setzt den Zustand neu an): nichts davon wächst nur
  const t0 = sek(W.jetzt());
  A.c._planOp({ t: 'von', t0 });
  await W.vor(3 * 36e5);
  const p0 = helfer().gift.p;
  A.c._planOp({ t: 'voff', t0, d: 3 * 36e5, gp: p0 + 3 * 36e5, ht: helfer().hay.t + 3 * 36e5 });
  await W.vor(30000);
  assert.deepEqual(plain(helfer().ur), { t: t0, d: 3 * 36e5 });
  assert.equal(helfer().gift.p, p0 + 3 * 36e5);
  einig(W, T, A, B);
  // Ein neuer Pika-Tag fängt bei null an: Das ist kein Rückfall
  const vorher = B.geschrieben(PLAN).length;
  W.ha.setze(PLAN, T.planSer(T.planApply(helfer(), { t: 'pet', d: tag + 1, n: 1 }, W.jetzt())), 'morgen');
  await W.vor(30000);
  assert.deepEqual(cute(), { d: tag + 1, n: 1, m: 0 });
  assert.equal(B.geschrieben(PLAN).length, vorher);
  // … und der alte Tag kommt danach nicht wieder
  W.ha.setze(PLAN, T.planSer({ ...helfer(), cute: { d: tag, n: 9, m: 1 } }), 'alt');
  await W.vor(30000);
  assert.deepEqual(cute(), { d: tag + 1, n: 1, m: 0 });
  einig(W, T, A, B);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: kommt der veraltete Stand kurz nach einer eigenen Änderung, legt die sich selbst wieder darauf, samt Vorrat und goldenem Päckchen', async () => {
  const { W, T, tag, gift, cute } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // Freundschaftstag 6: Der nächste gute Tag bringt ein goldenes Päckchen
  A.c._planOp({ t: 'gdbg', f: { f: 6 } });
  await W.vor(20000);
  const davor = T.planParse(W.ha.wert(PLAN)); // das kennt das veraltete Gerät
  B.c._petCount();
  await W.vor(60000);
  // B: ein guter Tag (f 7, goldenes Päckchen) und ein Päckchen verschenkt (Vorrat 2 → 1), von HA bestätigt
  B.c._planOp({ t: 'ggood', d: tag });
  B.c._planOp({ t: 'give', z: 1, i: 3, gold: false, x: sek(W.jetzt()), r: 7 });
  await W.vor(2000);
  assert.deepEqual([gift().f, gift().y, gift().z, gift().n, cute().n], [7, 1, 1, 1, 4]);
  einig(W, T, A, B);
  // Zwei Sekunden später überschreibt das veraltete Gerät alles. Würde B hier zuerst retten (f, „gut“, z aus dem
  // Gesehenen) und dann seine Änderungen darauflegen, gälten die als schon geschehen: Das verschenkte Päckchen läge
  // noch im Vorrat. Darum zuerst die eigenen Änderungen, gerettet wird nur der Rest (das Streicheln von vor einer Minute).
  W.ha.setze(PLAN, T.planSer(T.planApply(davor, { t: 'mem', d: tag, b: 64 }, W.jetzt())), 'alt');
  await W.vor(30000);
  assert.deepEqual([gift().f, gift().y, gift().z, gift().n, gift().u], [7, 1, 1, 1, 8], 'guter Tag samt goldenem Päckchen, verschenkt samt Vorrat');
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 | 64 | T.MEM_GUT });
  einig(W, T, A, B);
  // Ohne eigene Änderung in den letzten 15 s kommt f aus dem Gesehenen zurück, über die Sieben hinweg: Dann gilt beim
  // goldenen Päckchen der höhere Wert (ggood brächte es nicht wieder, „gut“ steht ja schon)
  await W.vor(60000);
  W.ha.setze(PLAN, T.planSer(T.planApply(davor, { t: 'mem', d: tag, b: 128 }, W.jetzt())), 'alt');
  await W.vor(30000);
  assert.deepEqual([gift().f, gift().y, gift().z, gift().u], [7, 1, 1, 8]);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 | 64 | 128 | T.MEM_GUT });
  einig(W, T, A, B);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: derselbe veraltete Stand immer wieder (Beweis nur im Verlauf) wird jedes Mal vervollständigt, auch wenn in den 2 s davor jemand etwas ändert', async () => {
  const { W, T, tag, gift, cute, helfer } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  B.c._planOp({ t: 'rec', k: 1000, a: 'paint' });
  await W.vor(20000);
  const alt = W.ha.wert(PLAN); // das kennt das veraltete Gerät
  // Inzwischen: eine große Beschäftigung, ein Päckchen verschenkt und ausgepackt. Kein Streicheln, kein Erlebnis:
  // Dass der alte Stand alt ist, zeigt nur der Verlauf.
  B.c._planOp({ t: 'rec', k: 1001, a: 'music' });
  await schenken(W, B, 1);
  await W.vor(20000);
  const ganz = () => [gift().z, gift().o, gift().u, helfer().rec.map((e) => e[0]).join()];
  assert.deepEqual(ganz(), [1, 1, 8, '1001,1000']);
  // Das veraltete Gerät schreibt seinen Stand sechsmal im Abstand von 15,4 s (wie eine Karte bis 0.42.1). Bis 0.42.2
  // im ersten Entwurf wurde nur das erste Mal gerettet: Danach kannte die Karte selbst nur noch den alten Verlauf.
  for (let i = 1; i <= 6; i++) {
    assert.equal(W.ha.setze(PLAN, alt, 'alt'), true);
    await W.vor(1000);
    assert.deepEqual(ganz(), [0, 0, 0, '1000'], `${i}. Mal: erst einmal steht der veraltete Stand im Helfer`);
    await W.vor(14400);
    assert.deepEqual(ganz(), [1, 1, 8, '1001,1000'], `${i}. Mal: Päckchen, Album und Verlauf sind zurück`);
  }
  assert.equal(W.ha.zeilen(PLAN).filter((z) => z.startsWith('alt:')).length, 6);
  einig(W, T, A, B);
  // Eine eigene Änderung in den 2 s vor dem Vervollständigen nimmt das Gerettete mit
  W.ha.setze(PLAN, alt, 'alt');
  await W.vor(500);
  A.c._planOp({ t: 'mem', d: tag, b: 32 });
  await W.vor(600);
  assert.deepEqual([...ganz(), cute().m], [1, 1, 8, '1001,1000', 1 | 32]);
  await W.vor(20000);
  assert.deepEqual([...ganz(), cute().m], [1, 1, 8, '1001,1000', 1 | 32]);
  einig(W, T, A, B);
  // Ein Gerät lädt gerade neu, sieht als Erstes den veralteten Stand und ändert darauf etwas, ehe gerettet ist. Sein
  // Stand trägt selbst keinen Beweis mehr (höherer Zähler, das Erlebnis von eben, derselbe Verlauf wie A ihn kennt …
  // hier mit dem Zähler: Der veraltete Stand hat einen weniger, das neue Gerät streichelt). Solange das Retten
  // aussteht, kann aber niemand auf dem Geretteten aufgebaut haben: Es bleibt dabei.
  B.c._petCount();
  await W.vor(20000);
  assert.equal(cute().n, 4);
  const R = T.planParse(W.ha.wert(PLAN));
  W.ha.setze(PLAN, T.planSer({ ...R, cute: { ...R.cute, n: 3 }, gift: { ...R.gift, z: 0, o: 0, u: 0 } }), 'alt');
  await W.vor(500);
  const C = W.karte('C');
  await W.vor(300);
  C.c._petCount();
  await W.vor(600);
  assert.deepEqual([helfer().gift.z, cute().n, W.ha.verlauf.at(-1).von], [0, 4, 'C'], 'C hat auf dem veralteten Stand gestreichelt');
  await W.vor(30000);
  assert.deepEqual([...ganz(), cute().n], [1, 1, 8, '1001,1000', 4]);
  einig(W, T, A, B, C);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: eine echte Karte 0.42.1, abgehängt und ohne Echo, sendet 30 Min lang ihren alten Plan – die neuen Karten halten Päckchen und Album', { skip: !ALT && 'ohne git keine alte Karte' }, async () => {
  const { W, T, tag, gift, helfer } = anfang({ alt: ALT });
  const A = W.karte('A');
  const B = W.karte('B');
  const C = W.karte('C', {}, { alt: true });
  await W.vor(100);
  B.c._planOp({ t: 'rec', k: 1000, a: 'paint' });
  await W.vor(20000);
  // C ändert etwas und wird abgehängt, ehe das Echo da ist: Von da an sendet sie alle 15,4 s wieder ihren Plan
  C.c._planOp({ t: 'mem', d: tag, b: 2 });
  await W.vor(410);
  C.abhaengen();
  await W.vor(5000);
  B.c._planOp({ t: 'rec', k: 1001, a: 'music' });
  await schenken(W, B, 1);
  await W.vor(3000);
  const ganz = () => [gift().z, gift().o, gift().u, helfer().rec.map((e) => e[0]).join()];
  assert.deepEqual(ganz(), [1, 1, 8, '1001,1000']);
  for (let i = 1; i <= 8; i++) {
    await W.vor(15400);
    assert.deepEqual(ganz(), [1, 1, 8, '1001,1000'], `nach dem ${i}. Mal`);
  }
  const vonC = () => W.ha.zeilen(PLAN).filter((z) => z.startsWith('C:')).length;
  assert.ok(vonC() >= 8, `C hat den Helfer ${vonC()}-mal überschrieben`);
  await W.vor(40 * 6e4);
  assert.deepEqual(ganz(), [1, 1, 8, '1001,1000']);
  assert.ok(C.geschrieben(PLAN).length > 100, `C hat ${C.geschrieben(PLAN).length}-mal gesendet`);
  einig(W, T, A, B);
});

test('Tagesplan: wieder eingehängt, aber HA setzt kein hass – die Karte schreibt nicht, auch nicht nach einer Frist', async () => {
  const { W, T, tag, gift, cute } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  A.abhaengen();
  await W.vor(60000);
  await schenken(W, B, 1);
  B.c._petCount();
  B.c._petCount();
  await W.vor(60000);
  A.c._planOp({ t: 'mem', d: tag, b: 16 }); // entsteht in der abgehängten Karte (ein Zeitgeber, der noch lief)
  await W.vor(60000);
  B.abhaengen(); // (B schaut gerade nicht zu, sonst vervollständigte B den Helfer nach 2 s wieder)
  // A wird eingehängt, die Verbindung steht, aber es kommt kein hass (HA ist gerade still, oder ein Behälter reicht
  // beim Einhängen keins nach). Dass nichts ankommt, heißt nicht, dass nichts geschah: A hat das Päckchen verpasst.
  A.einhaengen({ hass: false });
  await W.vor(10 * 6e4);
  assert.deepEqual([A.c._planStale, A.c._planHeld, !!A.c._planDoubt, A.geschrieben(PLAN).length], [false, true, true, 0]);
  assert.deepEqual([gift().z, gift().o, gift().u, cute().n, cute().m], [1, 1, 8, 5, 1]);
  // Das erste hass nach dem Einhängen bringt den frischen Stand: Jetzt geht A's Änderung hinaus, darauf gelegt
  A.liefere();
  await W.vor(5000);
  assert.deepEqual([gift().z, gift().o, gift().u, cute().n, cute().m], [1, 1, 8, 5, 1 | 16]);
  assert.equal(A.geschrieben(PLAN).length, 1);
  einig(W, T, A);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: lehnt HA das Vervollständigen ab, wird es mit wachsender Pause und höchstens 30 Min lang versucht', async () => {
  const { W, T, gift, cute } = anfang();
  const alt = W.ha.wert(PLAN);
  const A = W.karte('A');
  await W.vor(100);
  await schenken(W, A, 1);
  A.c._petCount();
  await W.vor(60000);
  A.leitung = 'ablehnen'; // HA nimmt den Plan nicht an (Rechte, Länge, Muster)
  const n0 = A.aufrufe.length;
  W.ha.setze(PLAN, alt, 'alt');
  await W.vor(31 * 6e4);
  const t = A.aufrufe.slice(n0).map((e) => e.t - A.aufrufe[n0].t);
  assert.deepEqual(t.slice(0, 5), [0, 5400, 15800, 36200, 76600], 'Pausen 5 s, 10 s, 20 s, 40 s (+ 0,4 s bis zum Senden)');
  assert.ok(t.length >= 8 && t.length <= 12 && t.at(-1) < 30 * 6e4, `${t.length} Versuche, der letzte nach ${Math.round(t.at(-1) / 6e4)} Min`);
  assert.equal(W.warnungen.length, t.length);
  await W.vor(3 * 36e5);
  assert.equal(A.aufrufe.length, n0 + t.length, 'nach 30 Min ist Schluss');
  assert.deepEqual([A.c._planT, A.c._planRT], [null, null]);
  // Im Plan der Karte steht das Gerettete weiter; mit ihrer nächsten Änderung geht es hinaus, sobald HA wieder annimmt
  assert.deepEqual([gift().z, A.plan().gift.z], [0, 1]);
  A.leitung = 'sofort';
  A.c._petCount();
  await W.vor(20000);
  assert.deepEqual([gift().z, gift().o, gift().u, cute().n], [1, 1, 8, 5]);
  einig(W, T, A);
});

test('Tagesplan: zweimal gestreichelt, das erste ist noch unterwegs, da kommt ein fremder Stand – beide zählen', async () => {
  const { W, T, tag, cute } = anfang({ laufzeit: 150 });
  const A = W.karte('A');
  await W.vor(1000);
  A.c._petCount(); // geht nach 0,4 s hinaus, ist nach 0,55 s in HA, das Echo nach 0,7 s da
  await W.vor(300);
  // ein fremdes Schreiben erreicht HA vor dem von A (auf dem Stand von eben, mit einem Erlebnis) und A nach 0,45 s
  W.ha.setze(PLAN, T.planSer(T.planApply(T.planParse(W.ha.wert(PLAN)), { t: 'mem', d: tag, b: 4 }, W.jetzt())), 'fremd');
  await W.vor(120);
  A.c._petCount(); // das zweite, noch ungesendet
  assert.equal(A.plan().cute.n, 5);
  await W.vor(40);
  assert.equal(A.c._planSt, W.ha.wert(PLAN), 'der fremde Stand ist bei A');
  assert.equal(A.plan().cute.n, 5, 'A zeigt weiter beide (das zweite zählt vom ersten aus, nicht vom fremden Stand)');
  await W.vor(60000);
  // (Das Erlebnis aus dem fremden Schreiben hat A's erstes, schon gesendetes Schreiben im Helfer überschrieben, wie
  // bisher: Ein Gerät, das es selbst geschrieben hat, legt es noch einmal darauf, hier gibt es keins.)
  assert.equal(cute().n, 5);
  einig(W, T, A);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: ein von Hand geleerter Helfer ist ein Neuanfang – der Plan eines danach frisch geladenen Geräts wird übernommen, nichts zurückgeholt', async () => {
  const { W, T, tag, gift, cute } = anfang();
  const A = W.karte('A');
  await W.vor(100);
  await schenken(W, A, 1);
  A.c._petCount();
  await W.vor(60000);
  assert.deepEqual([gift().z, gift().u, cute().n], [1, 8, 4]);
  // Gegenprobe: Schreibt jemand einen älteren, gültigen Plan hinein, sieht das aus wie ein veraltetes Gerät, und die
  // offene Karte holt zurück, was fehlt (nach 2 s)
  const N = [{ t: 'gstart', k: sek(W.jetzt()) }, { t: 'gdbg', f: { n: 1 } }, { t: 'pet', d: tag, n: 1 }]
    .reduce((P, op) => T.planApply(P, op, W.jetzt()), T.planBlank(W.jetzt()));
  W.ha.setze(PLAN, T.planSer(N), 'hand');
  await W.vor(5000);
  assert.deepEqual([gift().z, gift().u, cute().n], [1, 8, 4]);
  einig(W, T, A);
  // Leeren: Die offene Karte schreibt von sich aus nichts hinein (ihren Plan behält sie wie bisher im Speicher) …
  W.ha.setze(PLAN, '', 'hand');
  await W.vor(60000);
  assert.equal(W.ha.wert(PLAN), '');
  assert.equal(A.c._planKnown, null);
  // … und fängt danach ein neu geladenes Gerät frisch an, gilt dessen Plan: Album und Zähler kommen nicht wieder
  W.ha.setze(PLAN, T.planSer(N), 'neu');
  await W.vor(60000);
  assert.equal(W.ha.wert(PLAN), T.planSer(N));
  assert.deepEqual([A.plan().gift.z, A.plan().gift.u, A.plan().cute.n], [0, 0, 1]);
  assert.equal(W.ha.verlauf.at(-1).von, 'neu', 'A hat nichts zurückgeschrieben');
  einig(W, T, A);
  // Dasselbe mit etwas anderem als einem Plan im Helfer (die Karte warnt)
  await schenken(W, A, 1);
  await W.vor(20000);
  assert.equal(gift().z, 1);
  W.ha.setze(PLAN, 'kaputt', 'hand');
  await W.vor(5000);
  W.ha.setze(PLAN, T.planSer(N), 'neu');
  await W.vor(60000);
  assert.deepEqual([W.ha.wert(PLAN), A.plan().gift.z], [T.planSer(N), 0]);
  assert.equal(W.warnungen.length, 1);
  assert.match(W.warnungen[0], /enthält "kaputt", der Tagesplan fängt neu an/);
});
