// Urlaub bei Pino: Fristen, Zeitabschnitte, die nicht zählen, Rückwärtsrechnen der Wachzeit

// Der Urlaub steht im Tagesplan (ur: { t Beginn, d Dauer oder null, solange er läuft }, siehe tagesplan.js). Solange
// er läuft, ruhen Satt, Glück, Häufchen, Pflege-Serie und Vorrat; der Pika ist bei seinem Freund, an der Tür hängt ein
// Schild. keep: so lange nach der Rückkehr steht das Ende noch im Plan (Postkarte, und wer den Zustand noch nicht neu
// angesetzt hat, rechnet so weiter richtig). restore: Fehlt der Urlaub im Helfer so kurz nachdem dieses Gerät ihn dort
// zuletzt gesehen hat, ohne dass er beendet wurde, hat ihn ein Gerät mit älterer Karte in derselben Sekunde
// überschrieben: Dann wird er wieder eingetragen. min: kürzer gilt als „aus Versehen“ und schickt keine Postkarte.
const URLAUB = { keep: 24 * 36e5, restore: 15 * 6e4, min: 30 * 6e4 };

// Urlaub ur zum Zeitpunkt t (an, noch nicht zurück bzw. vor dem Ende)?
const urlaubAt = (ur, t) => !!ur && t >= ur.t && (ur.d == null || t < ur.t + ur.d);
// Ende des Urlaubs (Infinity, solange er läuft)
const urlaubEnd = (ur) => (!ur ? -Infinity : ur.d == null ? Infinity : ur.t + ur.d);
// Wie viel von [a, b] in den Urlaub fällt (als Abschnitt [von, bis], oder null)
const urlaubCut = (ur, a, b) => {
  if (!ur || !(b > a)) return null;
  const x = Math.max(a, ur.t);
  const y = Math.min(b, urlaubEnd(ur));
  return y > x ? [x, y] : null;
};
// Dauer in Worten (Postkarte, Tagebuch)
const urlaubDauer = (ms) => {
  const d = Math.round(ms / 864e5);
  if (d >= 1) return d === 1 ? 'einen Tag' : `${d} Tage`;
  const h = Math.max(1, Math.round(ms / 36e5));
  return h === 1 ? 'eine Stunde' : `${h} Stunden`;
};

export { URLAUB, urlaubAt, urlaubEnd, urlaubCut, urlaubDauer };
