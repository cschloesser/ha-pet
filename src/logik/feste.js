// Festtage: Tagesnummer, Ostern, Advent, gemeinsame Augenblicke, Geburtsdaten

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
// Augenblicke, die auf allen Geräten in derselben Sekunde kommen sollen (Ortszeit, ms): der nächste Jahreswechsel
// und 11:11 Uhr am 11. 11. dieses Jahres. Der 20-Sekunden-Takt jedes Geräts hat seine eigene Phase: Er stellt nur
// den Zeitgeber, ausgelöst wird nach der Uhr von HA.
const FEST_AHEAD = 45000;
const festMoments = (t) => {
  const y = new Date(t).getFullYear();
  return { mid: new Date(y + 1, 0, 1).getTime(), helau: new Date(y, 10, 11, 11, 11).getTime() };
};
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
  // Tage, die es nicht gibt („31.04.“, „30.02.“), gelten als nicht erkannt: Sie würden nie gefeiert, ohne Hinweis
  return bm >= 1 && bm <= 12 && bd >= 1 && bd <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][bm - 1] ? [bm, bd] : null;
};
// "Mia" / "Mia und Tom" / "Mia, Tom und Lea"
const festNames = (a) => (a.length < 2 ? a[0] || '' : `${a.slice(0, -1).join(', ')} und ${a[a.length - 1]}`);

export { festDay, festEaster, festAdvent1, FEST_AHEAD, festMoments, festBirthdate, festNames };
