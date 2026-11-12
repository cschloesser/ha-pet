// Offenes Fenster (seit 0.40): Ist im Haus ein Fenster offen, öffnet der Pika das runde Fenster an seinem Bau

import { clamp, pick } from '../logik/hilfen.js';
import { WIN, winIds, winName, winLage, winText } from '../logik/fenster.js';
import { FEN, FEN_INNEN, FEN_KOPF, FEN_FLUEGEL } from '../grafik/fenster.js';

// Aktionen, aus denen er sich für das Fenster losreißen lässt (wie bei der Haustür)
const WIN_FREI = ['idle', 'look', 'wander', 'groom', 'squeak', 'curious', 'nibble', 'lookout'];

export class Fenster {
  // Option signals.window (ein Kontakt oder eine Liste). Nur der Erdhügel (areal huegel) hat ein Fenster; die
  // anderen Areale lesen die Kontakte gar nicht erst.
  _winOn() {
    return this._arealKey === 'huegel' && winIds(this._sigCfg().window).length > 0;
  }

  // Aus _hassSig: Zustände merken, Lage neu bestimmen (nur wenn sich ein Kontakt geändert hat)
  _winHass(hass) {
    const ids = this._winOn() ? winIds(this._sigCfg().window) : [];
    const st = ids.map(({ id }) => hass.states[id]);
    const key = ids.map((x) => x.id + '|' + (x.name || '')).join(',');
    if (key === this._winKey && st.length === (this._winSt?.length ?? -1) && st.every((s, i) => s === this._winSt[i])) return;
    // andere Kontakte (Editor, Arealwechsel): wie nach dem Laden, ohne Auftritt
    if (key !== this._winKey) this._winL = null;
    this._winKey = key;
    this._winIds = ids;
    this._winSt = st;
    this._winEval();
  }

  // Lage aus Zustand und last_changed (Uhr von HA) → Fenster zeigen; Wechsel lösen den Pika oder das Fenster aus
  _winEval() {
    clearTimeout(this._winT);
    if (!this._winOn() || !this._winIds?.length) {
      this._winL = null;
      this._winShow(false, false);
      return;
    }
    const now = this._haNow();
    const rows = this._winIds.map(({ id, name }, i) => {
      const s = this._winSt?.[i];
      return { id, name: winName(s, id, name), state: s?.state, t: Date.parse(s?.last_changed) || 0 };
    });
    const was = this._winL;
    const L = winLage(rows, now, was);
    this._winL = L;
    if (L.due != null) this._winT = setTimeout(() => this._winEval(), clamp(L.due - now + 60, 60, 2 ** 31 - 1));
    this._winTagSync();
    if (!this._g || !this._el) return;
    // Erste Lage nach dem Laden (oder nach Areal- und Optionswechsel): so zeigen, wie es ist, ohne Auftritt
    if (was == null) {
      this._winFresh = now;
      return this._winShow(L.open, false);
    }
    if (L.open === !!was.open) return;
    // Kurz nach dem Laden kennt dieses Gerät die Vorgeschichte nicht (Flattern, Nachfrist, siehe winLage): Was
    // dann aufgeht, läuft auf den anderen Geräten womöglich schon. Zeigen ja, Auftritt nein.
    if (now - (this._winFresh || 0) < WIN.open + WIN.close) return this._winShow(L.open, true);
    if (L.open) this._winOpened();
    else this._winClosed();
  }

  // Wach, frei, zu sehen? Dann darf er hin. Schlaf, Urlaub, Nacht: nicht (das Fenster folgt trotzdem dem Haus).
  _winFrei() {
    return this._sigAwake() && this._running && !this._next && !this._inside && !this._wx?.shelter
      && !this._el.scene.classList.contains('night') && WIN_FREI.includes(this._action);
  }

  _winOpened() {
    if (this._winFrei()) {
      this._next = 'winAuf';
      this._interrupt();
      // Kommt er nicht dazu (etwas anderes ging vor), geht es von selbst auf
      this._winFallback(true);
    } else this._winShow(true, true);
  }

  _winClosed() {
    const E = this._el.fen;
    const near = this._g && E && (this._inside || Math.abs(this._x - E._x) < this._W * 0.3);
    if (this._winShown && near && this._winFrei()) {
      this._next = 'winZu';
      this._interrupt();
      this._winFallback(false);
    } else this._winShow(false, true);
  }

  _winFallback(open) {
    clearTimeout(this._winFbT);
    this._winFbT = setTimeout(() => {
      if (!!this._winL?.open === open && this._winShown !== open && !['winAuf', 'winZu'].includes(this._action)) this._winShow(open, true);
    }, 15000);
  }

  // Das Fenster-Element (drei Lagen, siehe grafik/fenster.js), einmal angelegt, solange der Erdhügel da ist
  _winEl() {
    if (!this._el || !this._g) return null;
    let E = this._el.fen;
    if (E) return E;
    E = document.createElement('div');
    E.className = 'fenster';
    E.setAttribute('role', 'button');
    E.innerHTML = `<div class="fen-in">${FEN_INNEN}</div><div class="fen-ko">${FEN_KOPF}</div><div class="fen-fl">${FEN_FLUEGEL}</div>`;
    E.addEventListener('click', (e) => {
      e.stopPropagation();
      this._winTag(!this._winTagEl?.classList.contains('open'));
    });
    this._keyTap(E);
    this._el.props.appendChild(E);
    this._el.fen = E;
    this._winLayout();
    return E;
  }

  // Lage und Größe: Fenstermitte im Bau (80 | 33 Bau-Einheiten), Wind für die Vorhänge
  _winLayout() {
    const E = this._el?.fen;
    if (!E) return;
    if (!this._g || this._arealKey !== 'huegel') {
      this._el.fen = null;
      E.remove();
      this._winTagClose();
      this._winShown = false;
      return;
    }
    const { l, u, base } = this._g.bur;
    const s = FEN.box * u;
    E._x = l + FEN.cx * u;
    E._y = base + FEN.cy * u;
    E._r = FEN.r * u;
    Object.assign(E.style, { left: `${(E._x - s).toFixed(1)}px`, top: `${(E._y - s).toFixed(1)}px`, width: `${(2 * s).toFixed(1)}px`, height: `${(2 * s).toFixed(1)}px` });
    this._winWind();
  }

  // Vorhänge wehen nach außen über den Rahmen, der auf der Seite, wohin der Wind im Bild weht, weit, der andere
  // wenig; bei mehr Wind weiter und schneller
  _winWind() {
    const E = this._el?.fen;
    if (!E) return;
    const w = this._wind || 0;
    const a = clamp(24 + w * 0.8, 24, 50);
    const links = this._windDir < 0;
    E.style.setProperty('--wl', `${(links ? a : a * 0.3).toFixed(1)}deg`);
    E.style.setProperty('--wr', `${(links ? a * 0.3 : a).toFixed(1)}deg`);
    E.style.setProperty('--ws', `${clamp(2.4 - w / 25, 0.7, 2.4).toFixed(2)}s`);
  }

  // Fenster auf oder zu zeigen. anim: aufschwingen bzw. zuschwingen (sonst sofort). Zu und fertig: ganz weg, dann
  // zeigen Bau und Lichter das geschlossene Fenster wie immer.
  _winShow(open, anim) {
    clearTimeout(this._winHideT);
    if (!open && !this._el?.fen) {
      this._winShown = false;
      return;
    }
    const E = this._winEl();
    if (!E) return;
    this._winShown = open;
    E.classList.toggle('still', !anim);
    clearTimeout(this._winStillT);
    if (!anim) this._winStillT = setTimeout(() => E.classList.remove('still'), 60);
    E.classList.add('da');
    if (open && anim && !E.classList.contains('auf')) {
      // erst zeigen (geschlossen), dann aufschwingen
      void E.offsetWidth;
    }
    E.classList.toggle('auf', open);
    E.setAttribute('aria-label', open && this._winL?.open ? `Fenster: ${winText(this._winL, this._haNow())}` : 'Fenster zu');
    if (!open) {
      E.classList.remove('kopf', 'schnupper');
      this._winTagClose();
      this._winHideT = setTimeout(() => !this._winShown && E.classList.remove('da'), anim ? 1000 : 0);
    }
  }

  // ---------- Auftritte ----------

  // Fenster geht auf: in den Bau hoppeln, Fenster aufschwingen, Kopf heraus, schnuppern, „frische Luft!“, raus
  async _winAuf() {
    const E = this._winEl();
    // Nur gleich nach dem Öffnen (ein _next, das über Schlaf oder Abhängen liegen blieb, verfällt)
    const L = this._winL;
    if (!E || !L?.open || this._winShown || this._haNow() - (L.since + WIN.open) > 60000) {
      if (L?.open && !this._winShown) this._winShow(true, true);
      return;
    }
    try {
      this._cls('stw', 550, true);
      await this._wait(400);
      await this._enterBurrow(1.3);
      await this._wait(400);
      if (!this._winL?.open) return;
      this._winShow(true, true);
      await this._wait(900);
      await this._winKopf(E, true);
      E.classList.add('schnupper');
      await this._wait(1300);
      E.classList.remove('schnupper');
      this._winSay(pick(['frische Luft!', 'frische Luft!', 'ahh, Luft!']), 1900);
      await this._wait(2100);
      await this._winKopf(E, false);
      await this._wait(300);
      await this._comeOut();
    } finally {
      E.classList.remove('kopf', 'schnupper');
      if (this._winL?.open && !this._winShown) this._winShow(true, true);
    }
  }

  // Alles zu: Ist er in der Nähe, schließt er sein Fenster selbst (Kopf heraus, Flügel zu, wieder heraus)
  async _winZu() {
    const E = this._el?.fen;
    if (!E || this._winL?.open || !this._winShown) return;
    try {
      await this._enterBurrow(1.2);
      await this._wait(300);
      if (this._winL?.open) return;
      await this._winKopf(E, true);
      await this._wait(500);
      if (this._winL?.open) return;
      this._winShow(false, true);
      this._winSay(pick(['zu!', 'so.', 'Fenster zu!']), 1300);
      await this._wait(1300);
      await this._comeOut();
    } finally {
      E.classList.remove('kopf', 'schnupper');
      if (!this._winL?.open && this._winShown) this._winShow(false, true);
    }
  }

  async _winKopf(E, on) {
    E.classList.toggle('kopf', on);
    await this._wait(on ? 650 : 450);
  }

  // Sprechblase am Fenster statt am Eingang (der Anker --ax/--ay gilt, solange er im Bau ist; _pose setzt ihn zurück)
  _winSay(text, ms) {
    const E = this._el.fen;
    if (E && this._inside) {
      const { pH, pW, gy } = this._g;
      const ts = this._el.psay.style;
      ts.setProperty('--ax', `${(E._x - E._r * 0.4 - (this._x - pW / 2)).toFixed(1)}px`);
      ts.setProperty('--ay', `${(E._y - E._r * 1.5 - (gy - pH * 0.945)).toFixed(1)}px`);
    }
    this._say(text, ms);
    this._bubbleRefit();
  }

  // ---------- Fähnchen ----------

  // Antippen des offenen Fensters: welche Fenster im Haus offen sind und seit wann (9 s, wie bei den Geräten)
  _winTag(open) {
    const E = this._el?.fen;
    clearTimeout(this._winTagT);
    if (!open || !E || !this._winL?.open) return this._winTagClose();
    let t = this._winTagEl;
    if (!t) {
      let box = this._el.fenTags;
      if (!box) {
        box = this._el.fenTags = document.createElement('div');
        box.className = 'fen-t';
        this._el.props.appendChild(box);
      }
      t = this._winTagEl = document.createElement('div');
      t.className = 'hb-tag fen-tag';
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        this._winTagClose();
      });
      box.appendChild(t);
    }
    this._winTagSync();
    t.style.left = '0px';
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    t.style.left = `${clamp(E._x - w / 2, 4, this._W - w - 4).toFixed(1)}px`;
    t.style.top = `${clamp(E._y - E._r * 1.7 - h - 4, 2, this._Hs - h - 4).toFixed(1)}px`;
    t.classList.add('open');
    this._winTagT = setTimeout(() => this._winTagClose(), 9000);
  }

  _winTagSync() {
    const t = this._winTagEl;
    const L = this._winL;
    const txt = L?.open ? winText(L, this._haNow()) : '';
    if (this._el?.fen && L?.open) this._el.fen.setAttribute('aria-label', `Fenster: ${txt}`);
    if (!t) return;
    if (!L?.open) return this._winTagClose();
    const i = txt.lastIndexOf(' · ');
    t.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = i > 0 ? txt.slice(0, i) : txt;
    const m = document.createElement('div');
    m.className = 'more';
    m.textContent = i > 0 ? txt.slice(i + 3) : '';
    t.append(b, m);
  }

  _winTagClose() {
    clearTimeout(this._winTagT);
    this._winTagEl?.classList.remove('open');
  }

  // ---------- Lebenszyklus (aus den Haus-Signalen) ----------

  // Nach dem Aufbau (auch Areal- oder Größenwechsel): Lage neu lesen und so zeigen, wie sie ist
  _winLayoutSig() {
    this._winLayout();
    if (this._hass) this._winHass(this._hass);
    const L = this._winL;
    if (this._g && L && !!L.open !== !!this._winShown && !['winAuf', 'winZu'].includes(this._action)) this._winShow(!!L.open, false);
  }

  _winTick() {
    this._winWind();
    // „seit 12 Min“ im offenen Fähnchen weiterzählen; Lage auch ohne hass-Änderung prüfen (Fristen, Uhr von HA)
    if (this._winIds?.length) this._winEval();
    this._winHeal();
  }

  // Gezeigt anders als die Lage (ein Auftritt kam nicht dran, die Karte war abgehängt): angleichen, außer ein Auftritt
  // läuft oder steht an (dafür gibt es die 15 s des Ersatz-Zeitgebers)
  _winHeal() {
    const L = this._winL;
    const busy = ['winAuf', 'winZu'].includes(this._action) || ['winAuf', 'winZu'].includes(this._next);
    if (this._g && L && !!L.open !== !!this._winShown && !busy) this._winShow(!!L.open, true);
  }

  _winAttach() {
    if (this._winIds?.length) this._winEval();
    this._winHeal();
  }

  _winDetach() {
    clearTimeout(this._winT);
    clearTimeout(this._winFbT);
    clearTimeout(this._winTagT);
    clearTimeout(this._winStillT);
    if (['winAuf', 'winZu'].includes(this._next)) this._next = null;
  }
}

