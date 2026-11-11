// Bewegung reduzieren: die Systemeinstellung des Geräts (liest beim Laden window.matchMedia)

// Systemeinstellung „Bewegung reduzieren“; .matches folgt einer Änderung von selbst
const RED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const calmMotion = () => !!RED_MOTION?.matches;

export { calmMotion };
