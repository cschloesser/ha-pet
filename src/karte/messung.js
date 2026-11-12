// Messung (seit 0.39.2): Bildrate der Karte auf dem echten Gerät, bei Tag und in der Dämmerung, mit und ohne depth.
// Schläft, solange die Adresse der Seite nicht pika_messung nennt (…/dashboard/0?pika_messung=1). Dann misst sie
// einmal nach dem Laden, stellt alles zurück und schreibt das Ergebnis ins Systemprotokoll von HA (Logger
// pika_pet_card.messung; geht das nicht, als Benachrichtigung „Pika-Messung“) und in die Konsole. Gedacht für das
// Kiosk-Tablet, auf dem sich sonst nichts messen lässt: fully_kiosk.load_url mit dem Zusatz, Bildschirm an.

import { VERSION } from '../version.js';

export class Messung {
  _messungFrei() {
    try {
      return /[?&#]pika_messung(=|&|$)/.test(window.location.href);
    } catch {
      return false;
    }
  }

  // Bilder über ms Millisekunden zählen (requestAnimationFrame): Bilder je Sekunde, Median und 95. Perzentil der
  // Abstände, verpasste Bilder (Abstand über 34 ms, also mehr als zwei Takte bei 60 Hz) und der längste Abstand
  // Kommen keine Bilder (Bildschirm aus, Seite verborgen), endet sie trotzdem nach ms + 2 s, mit dem, was da ist.
  _messRaf(ms) {
    return new Promise((fertig) => {
      const t = [];
      let aus = false;
      const ende = () => {
        if (aus) return;
        aus = true;
        clearTimeout(notbremse);
        const d = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
        const q = (p) => (d.length ? d[Math.min(d.length - 1, Math.floor(p * d.length))] : 0);
        fertig({
          fps: d.length ? Math.round(((t.length - 1) / (t[t.length - 1] - t[0])) * 10000) / 10 : 0,
          med: Math.round(q(0.5) * 10) / 10, p95: Math.round(q(0.95) * 10) / 10,
          lang: d.filter((x) => x > 34).length, max: Math.round(d[d.length - 1] || 0), bilder: t.length,
        });
      };
      const notbremse = setTimeout(ende, ms + 2000);
      const takt = (now) => {
        if (aus) return;
        t.push(now);
        if (now - t[0] < ms) requestAnimationFrame(takt);
        else ende();
      };
      requestAnimationFrame(takt);
    });
  }

  async _messung() {
    if (this._messungLauf || !this._messungFrei()) return;
    this._messungLauf = true;
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    await warte(8000); // eingeschwungen: Verlauf geladen, Szene steht
    const cfg = this._cfg;
    const alt = { e: this._dbgElev, a: this._dbgAz, s: this._dbgSleep };
    // Reihenfolge abwechselnd, Dämmerung mit depth zweimal (Streuung sehen)
    const phasen = [[28, true], [3, true], [28, false], [3, false], [3, true], [28, true]]; // etwa 75 s
    const erg = [];
    try {
      for (const [elev, depth] of phasen) {
        if (!!this._cfg.depth !== depth) this.setConfig({ ...this._cfg, depth });
        this._dbgElev = elev;
        this._dbgAz = elev > 0 ? 180 : 245;
        this._dbgSleep = false;
        this._tick();
        this._updateSky(); // auch, wenn die Schleife gerade ruht (Licht und .shade sofort)
        await warte(3500); // Übergänge des Lichts (2,5 s) sind durch
        const r = await this._messRaf(8000);
        const filter = [...this.shadowRoot.querySelectorAll('*')].filter((el) => getComputedStyle(el).filter !== 'none').length;
        erg.push({ licht: elev >= 10 ? 'Tag' : 'Dämmerung', depth, shade: this._el.scene.classList.contains('shade'), filter, akt: this._action, ...r });
      }
    } finally {
      this._dbgElev = alt.e;
      this._dbgAz = alt.a;
      this._dbgSleep = alt.s;
      this.setConfig(cfg);
      this._tick();
      this._updateSky();
    }
    const zeile = (r) => `${r.licht}${r.depth ? ' depth' : ''}: ${r.fps} B/s, Median ${r.med} ms, p95 ${r.p95} ms, `
      + `${r.lang} lange, max ${r.max} ms, ${r.bilder} Bilder, ${r.filter} Filter${r.shade ? ' (shade)' : ''}, ${r.akt}`;
    const text = `Pika-Messung ${VERSION} ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}: `
      + erg.map(zeile).join(' | ');
    console.info(text);
    try {
      await this._hass.callService('system_log', 'write', { message: text, level: 'warning', logger: 'pika_pet_card.messung' }, undefined, false);
    } catch {
      try {
        await this._hass.callService('persistent_notification', 'create', { title: 'Pika-Messung', message: text, notification_id: 'pika_messung' }, undefined, false);
      } catch {
        // nur in der Konsole
      }
    }
  }
}
