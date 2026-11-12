// Bühne: Mal-Reihenfolge der Figuren am Boden aus dem echten DOM einer Karte (Vorschau, Browser).
// buehneAufnahme(karte) → { W, Hs, H, gy, areal, depth, figuren: [{ art, name, r: [x, y, b, h], z }] }, hinten zuerst.
// Bestimmt wird die Reihenfolge so, wie der Browser malt: Stapelkontexte (position + z-index, filter, opacity,
// transform, will-change, contain …) von der Szene abwärts, je Ebene nach z und dann nach DOM-Reihenfolge. Das ist
// unabhängig davon, wie die Karte ihre Ebenen baut: Dieselbe Aufnahme gilt für 0.37 (Schichten) und 0.38 (Bühne).
// Mit test/buehne-szene.json vergleicht test/pika.test.mjs die Reihenfolge vor und nach dem Umbau.
(() => {
  // Figuren: Art und Auswahl im Schattenbaum. Gezählt wird, was zu sehen ist (Fläche, nicht unsichtbar).
  const ARTEN = [
    ['maus', '.mice > *'],
    ['festHinten', '.fest-b > :not(.fon) > *'],
    ['bau', '.burrow'],
    ['stein', '.lookout'],
    ['licht', '.lights'],
    ['tv', '.tvl'],
    ['vogel', '.birds > *'],
    ['drachen', '.kites > *'],
    ['blume', '.flowers > *'],
    ['futter', '.foods > *'],
    ['schatz', '.gifts > *'],
    ['mausVorn', '.mice-f > *'],
    ['geraet', '.props > .hb'],
    ['schild', '.hb-bars > .hb-lab'],
    ['balken', '.hb-bars > .hb-bar'],
    ['geraetVorn', '.hb-f > *'],
    ['tonne', '.sig-bin'],
    ['sauger', '.sig-vac'],
    ['gluehwurm', '.ff > *'],
    ['requisit', '.acts > *'],
    ['festBau', '.fest-b > .fon > *'],
    ['pino', '.friend'],
    ['pika', '.pika'],
    ['arm', '.held > *'],
    ['heu', '.hay'],
    ['festVorn', '.fest-f > * > *'],
    ['gras', '.grass'],
    ['requisitVorn', '.actsf > *'],
    ['haeufchen', '.poops > *'],
  ];
  const kontext = (el, cs) => {
    const pos = cs.position !== 'static';
    return (pos && cs.zIndex !== 'auto') || cs.filter !== 'none' || Number(cs.opacity) < 1 || cs.transform !== 'none'
      || /transform|opacity|filter/.test(cs.willChange) || cs.isolation === 'isolate' || /paint|strict|content/.test(cs.contain)
      || cs.mixBlendMode !== 'normal';
  };
  window.buehneAufnahme = (karte, nur) => {
    const root = karte.shadowRoot;
    const scene = root.querySelector('.scene');
    const alle = [...scene.querySelectorAll('*')];
    const idx = new Map(alle.map((e, i) => [e, i]));
    const sr = scene.getBoundingClientRect();
    const zoom = sr.width / scene.offsetWidth || 1;
    // Schlüssel: je Stapelkontext von der Szene abwärts [z, DOM-Stelle], zuletzt das Element selbst
    const schluessel = (el) => {
      const kette = [];
      for (let e = el; e && e !== scene; e = e.parentElement) kette.unshift(e);
      const k = [];
      kette.forEach((e, i) => {
        const cs = getComputedStyle(e);
        const z = cs.position !== 'static' && cs.zIndex !== 'auto' ? Number(cs.zIndex) : 0;
        if (kontext(e, cs) || i === kette.length - 1) k.push([z, idx.get(e)]);
      });
      return k;
    };
    const vgl = (a, b) => {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i][0] !== b[i][0]) return a[i][0] - b[i][0];
        if (a[i][1] !== b[i][1]) return a[i][1] - b[i][1];
      }
      return a.length - b.length;
    };
    // Deckkraft zählt nicht: Für die Reihenfolge ist auch ein gerade eingeblendetes Element dabei (und in einer
    // verborgenen Vorschau bleiben Übergänge stehen)
    const sichtbar = (el) => {
      for (let e = el; e && e !== scene; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      }
      return true;
    };
    const figuren = [];
    for (const [art, sel] of ARTEN) {
      if (nur && !nur.includes(art)) continue;
      root.querySelectorAll(sel).forEach((el, i) => {
        if (figuren.some((f) => f.el === el)) return;
        // Hüllen ohne eigene Fläche (Besucher: 0 × 0 an ihrem Fußpunkt) zählen mit der Fläche ihrer Kinder
        let r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) {
          const rs = [...el.querySelectorAll('*')].map((q) => q.getBoundingClientRect()).filter((q) => q.width >= 1 && q.height >= 1);
          if (rs.length) {
            const l = Math.min(...rs.map((q) => q.left));
            const t = Math.min(...rs.map((q) => q.top));
            r = { left: l, top: t, width: Math.max(...rs.map((q) => q.right)) - l, height: Math.max(...rs.map((q) => q.bottom)) - t };
          }
        }
        if (r.width < 1 || r.height < 1 || !sichtbar(el)) return;
        const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
        figuren.push({
          el, art: art === 'pika' && el.classList.contains('inside') ? 'pikaBau' : art, name: `${art}:${cls.split(' ')[0] || el.tagName.toLowerCase()}:${i}`, k: schluessel(el),
          r: [r.left - sr.left, r.top - sr.top, r.width, r.height].map((v) => Math.round(v / zoom)),
        });
      });
    }
    figuren.sort((a, b) => vgl(a.k, b.k));
    const g = karte._g;
    return {
      W: karte._W, Hs: karte._Hs, H: karte._H, gy: Math.round(g.gy), areal: karte._arealKey, depth: !!karte._cfg.depth,
      figuren: figuren.map(({ art, name, r, el }) => ({ art, name, r, z: getComputedStyle(el).zIndex })),
    };
  };
  // Volle Szene in preview.html: Album voll (Schätze auf der Wiese), Advent, Haus-Bote, Tonne, Garderobe, Sauger,
  // Häufchen, Pino, Futter und alle Besucher; Nikolaus (6. 12., Tag: Festdeko vorn und am Bau).
  // Tageszeit danach mit buehneLicht(karten, Sonnenhöhe).
  window.buehneSzene = async (karten, areal = 'fels') => {
    const klick = (s) => document.querySelector(s)?.click();
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const c of karten) if (c._cfg.areal !== areal) c.setConfig({ ...c._cfg, areal });
    await warte(500);
    for (const s of ['[data-wx="sunny"]', '#gift-full', '[data-fest="nikolaus"]', '[data-hb="washer:done"]',
      '[data-hb="dryer:run30"]', '[data-hb="dishwasher:done"]', '[data-sig="bin-gelb"]', '[data-sig="ward-cold"]',
      '[data-sig="vac-cleaning"]', '#poo1', '#poo1']) {
      klick(s);
      await warte(150);
    }
    for (const c of karten) {
      if (!c._friend) c._friendCome(undefined, undefined, true);
      c._onFeed();
    }
    await warte(2500);
    for (const c of karten) for (const k of ['mouse', 'frog', 'snail', 'bird']) c._visit(k, c._critId, true);
    await warte(2500);
    // Futter zuletzt (er frisst es sonst gleich): drei Stück, liegen schon
    for (const c of karten) [10, 50, 90].forEach((x, k) => c._foodAdd({ t: Date.now(), x, k: k % 2 }, false));
    await warte(300);
  };
  // Sonnenhöhe einstellen, das Datum (Festtag) bleibt
  window.buehneLicht = (karten, elev) => karten.forEach((c) => {
    c._dbgElev = elev;
    c._dbgAz = elev > 0 ? 180 : 330;
    c._dbgSleep = false;
    c._tick();
  });
  // Alle Aufnahmen für test/buehne-szene.json: drei volle Szenen, vier Beschäftigungen, Advent-Nacht (Pika im Bau).
  // Kurzform je Figur: [art, x, y, b, h], hinten zuerst.
  window.buehneAlle = async (karten) => {
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    const klick = (s) => document.querySelector(s).click();
    const kurz = (a, tag) => ({ tag, W: a.W, Hs: a.Hs, H: Math.round(a.H * 10) / 10, gy: a.gy, areal: a.areal, f: a.figuren.map((f) => [f.art, ...f.r]) });
    const out = [];
    await buehneSzene(karten, 'fels');
    buehneLicht(karten, 28);
    await warte(1200);
    out.push(kurz(buehneAufnahme(karten[0]), 'fels-breit'), kurz(buehneAufnahme(karten[1]), 'fels-schmal'));
    await buehneSzene(karten, 'huegel');
    buehneLicht(karten, 28);
    await warte(1200);
    out.push(kurz(buehneAufnahme(karten[0]), 'huegel-breit'));
    // Ein Besucher vor dem Stein (.mice-f), Pino da
    await buehneSzene(karten, 'fels');
    buehneLicht(karten, 28);
    for (let n = 0; n < 120; n++) {
      if (karten[0].shadowRoot.querySelector('.mice-f > *') && karten[0]._friend) break;
      if (n % 30 === 29) for (const k of ['mouse', 'frog', 'snail']) karten[0]._visit(k, karten[0]._critId, true);
      await warte(250);
    }
    out.push(kurz(buehneAufnahme(karten[0]), 'besuch-vorn'));
    // Beschäftigungen ohne Pino und Besucher, im Areal fels
    for (const c of karten) {
      if (c._friend) c._friendLeave(true);
      c.setConfig({ ...c._cfg, areal: 'fels' });
    }
    klick('[data-sun="180,28,0"]');
    await warte(1500);
    for (const [act, wx, sel] of [['paint', 'sunny', '.acts .easel'], ['stones', 'sunny', '.acts .aprop.on'],
      ['puddle', 'rainy', '.actsf .aprop.on'], ['kite', 'windy', '.kite']]) {
      klick(`[data-wx="${wx}"]`);
      await warte(400);
      for (const c of karten) {
        c._next = act;
        c._interrupt();
      }
      for (let n = 0; n < 40 && !karten[0].shadowRoot.querySelector(sel); n++) await warte(250);
      await warte(600);
      out.push(kurz(buehneAufnahme(karten[0]), `akt-${act}`));
    }
    klick('[data-wx="sunny"]');
    // Advent, Nacht: Lichter am Bau und an der Tür, er geht in den Bau und schaut heraus
    klick('[data-fest="advent"]');
    await warte(1000);
    buehneLicht(karten, -20);
    for (const c of karten) {
      c._next = 'burrow';
      c._interrupt();
    }
    for (let n = 0; n < 120 && !karten[0]._inside; n++) await warte(250);
    await warte(500);
    out.push(kurz(buehneAufnahme(karten[0]), 'advent-nacht'));
    return out;
  };
  // Vor einem Bildschirmfoto: laufende Übergänge ans Ende (in einer verborgenen Vorschau stehen sie sonst still)
  window.buehneFertig = (karten) => karten.forEach((c) => c.shadowRoot.getAnimations({ subtree: true })
    .forEach((a) => a instanceof CSSTransition && a.finish()));
  // Zählt die Elemente der Szene, die einen Filter tragen (Lichtfilter bei Dämmerung)
  window.buehneFilter = (karte) => {
    const scene = karte.shadowRoot.querySelector('.scene');
    const mit = [...scene.querySelectorAll('*')].filter((e) => getComputedStyle(e).filter !== 'none');
    return { n: mit.length, wer: mit.map((e) => (typeof e.className === 'string' ? e.className : e.getAttribute('class') || e.tagName).split(' ')[0]) };
  };
})();
