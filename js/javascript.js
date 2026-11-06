/* ==========================================================
   Alejandro Mestizo · Portafolio
   1) Luz de fondo que sigue al cursor (rAF + interpolación)
   2) Navegación de página única con transiciones
   ========================================================== */
(() => {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- 1. Fondo interactivo ---------- */
  const bg = $('.bg');
  const glowMagenta = $('.glow--magenta');
  const glowTeal = $('.glow--teal');
  const blobs = $$('.blob');

  let W = window.innerWidth;
  let H = window.innerHeight;
  let target = { x: W / 2, y: H / 2 };   // posición objetivo del cursor
  let rafId = 0;

  // Cada capa tiene su propia "inercia" (k) para que el movimiento sea fluido y escalonado
  const layers = [
    { el: glowMagenta, k: 0.07,  glow: true, ox: -150, oy: 0 },
    { el: glowTeal,    k: 0.045, glow: true, ox: 150,  oy: 70 },
    ...blobs.map(el => ({ el, k: 0.03, glow: false, p: parseFloat(el.dataset.parallax) || 0 }))
  ];

  const goal = (l) => l.glow
    ? { x: target.x + l.ox, y: target.y + l.oy }
    : { x: (target.x - W / 2) * l.p * 3, y: (target.y - H / 2) * l.p * 3 };

  const paint = (l) => { l.el.style.transform = `translate3d(${l.x}px, ${l.y}px, 0)`; };

  // Posición inicial sin animación
  layers.forEach(l => { const g = goal(l); l.x = g.x; l.y = g.y; paint(l); });

  // El bucle solo corre mientras haya movimiento pendiente
  function tick() {
    let moving = false;
    for (const l of layers) {
      const g = goal(l);
      const dx = g.x - l.x, dy = g.y - l.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        l.x += dx * l.k; l.y += dy * l.k; moving = true;
        paint(l);
      }
    }
    rafId = moving ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!rafId) rafId = requestAnimationFrame(tick); };

  if (finePointer.matches) {
    window.addEventListener('pointermove', (e) => {
      if (reduceMotion.matches || e.pointerType === 'touch') return;
      target.x = e.clientX; target.y = e.clientY;
      bg.classList.add('is-live');
      kick();
    }, { passive: true });

    window.addEventListener('resize', () => {
      W = window.innerWidth; H = window.innerHeight;
      target.x = Math.min(target.x, W); target.y = Math.min(target.y, H);
      kick();
    }, { passive: true });
  }

  /* ---------- 2. Navegación entre secciones ---------- */
  const FADE_OUT = 260;  // ms (coincide con --fade-out)
  const FADE_IN  = 300;  // ms (coincide con --fade-in)

  const views = {
    'inicio':   $('#view-inicio'),
    'sobre-mi': $('#view-sobre-mi')
  };
  const links = $$('.nav__link');
  const toast = $('#toast');

  let current = 'inicio';
  let busy = false;          // evita clics repetidos durante la transición
  let toastTimer = 0;

  const wait = (ms) => new Promise(r => setTimeout(r, reduceMotion.matches ? 0 : ms));

  function setActive(name) {
    links.forEach(a => {
      if (a.dataset.view === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function showSoon() {
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800);
  }

  async function go(name) {
    if (busy || name === current || !views[name]) return;
    busy = true;
    const from = views[current];
    const to = views[name];
    try {
      setActive(name);
      from.classList.remove('is-visible');       // fade out
      await wait(FADE_OUT);
      from.hidden = true;
      to.hidden = false;
      window.scrollTo(0, 0);
      void to.offsetWidth;                       // reflow para que la transición arranque
      to.classList.add('is-visible');            // fade in
      current = name;
      history.replaceState(null, '', '#' + name);
      await wait(FADE_IN);
    } finally {
      busy = false;
    }
  }

  // Delegación de clics en el navbar
  $('#nav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-view]');
    if (!a) return;
    e.preventDefault();
    if (a.hasAttribute('data-soon')) { showSoon(); return; }
    go(a.dataset.view);
  });

  // Estado inicial (respeta #sobre-mi si se abre el enlace directo)
  const initial = location.hash.replace('#', '');
  if (views[initial]) current = initial;
  Object.entries(views).forEach(([name, el]) => { el.hidden = name !== current; });
  setActive(current);
  requestAnimationFrame(() => views[current].classList.add('is-visible'));
})();