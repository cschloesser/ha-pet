// Kaffee: Programme, Gefäße, Schlucke, Zeitleiste

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
// Getränk in Worten fürs Tagebuch: "…_program_beverage_latte_macchiato" → "Latte macchiato"
const coffeeLabel = (prog) => {
  const m = /(?:beverage|coffee_world)_([a-z0-9_]+)$/.exec(String(prog || '').toLowerCase());
  const w = (m ? m[1] : '').replace(/_/g, ' ').trim();
  return w ? w[0].toUpperCase() + w.slice(1) : 'Kaffee';
};
// Bezüge aus dem Verlauf des aktiven Programms (rows: [{ t, s }] aufsteigend) → [{ t (Ende des Bezugs), at (Beginn),
// prog, label }]. Ein Bezug ist ein Getränkeprogramm, das 15 s bis 15 Min läuft und danach in einen Zustand außer
// "unavailable" wechselt (wie live, siehe _hassCoffee). Nicht dazu: ein Programm, das schon zu Beginn des Verlaufs lief
// (sein Anfang fehlt), und eins, das aus "unavailable" kam oder darin endete (Neustart von HA, Verbindung weg).
const coffeeBrews = (rows) => {
  const out = [];
  let run = null;
  let prev;
  for (const r of rows || []) {
    const st = String(r.s ?? '').toLowerCase();
    const prog = COFFEE_PROG.test(st);
    let next = false; // ein Getränk folgt direkt auf das vorige (anderes Programm ohne Pause)
    if (run && (!prog || st !== run.prog)) {
      next = prog;
      const d = r.t - run.at;
      if (st !== 'unavailable' && d >= 15000 && d < 15 * 60000) out.push({ t: r.t, at: run.at, prog: run.prog, label: coffeeLabel(run.prog) });
      run = null;
    }
    if (prog && !run && prev !== undefined && prev !== 'unavailable' && (next || !COFFEE_PROG.test(prev))) run = { at: r.t, prog: st };
    prev = st;
  }
  return out;
};
const COFFEE_CLS = [...new Set([...Object.values(COFFEE_CUP), ...Object.keys(COFFEE_CUP)])].map((k) => `ck-${k}`);

export {
  COFFEE_PROG, coffeeKind, COFFEE_CUP, COFFEE_SIPS, COFFEE_FOAM, coffeeName, COFFEE_FETCH, COFFEE_CTR_MS, COFFEE_LATE,
  COFFEE_DRINK, COFFEE_CLS, coffeeLabel, coffeeBrews,
};
