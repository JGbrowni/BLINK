/* ==========================================================
   Alejandro Mestizo · Portafolio
   1) Luz de fondo que sigue al cursor (rAF + interpolación)
   2) Navegación de página única con transiciones
   3) Galería de TRABAJOS + integración del Lightbox original
   4) Cubo 3D multicolor que rebota por la pantalla
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
    'sobre-mi': $('#view-sobre-mi'),
    'trabajos': $('#view-trabajos')
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

  /* ---------- 3. Galería de TRABAJOS + Lightbox ---------- */
  // Las miniaturas son enlaces <a data-lightbox="grupo"> que el Lightbox original ya detecta solo.
  // Aquí solo se configura con sus opciones oficiales y se ajustan detalles de la galería.
  const works = $('#view-trabajos');

  // Orientación: el marco se adapta a cada obra (vertical / cuadrada / horizontal)
  const classify = (img) => {
    if (!img.naturalWidth) return;
    const r = img.naturalWidth / img.naturalHeight;
    const li = img.closest('.work');
    li.classList.toggle('work--landscape', r > 1.2);
    li.classList.toggle('work--square', r >= 0.9 && r <= 1.2);
  };
  // 'load' y 'error' no burbujean: se escuchan en fase de captura (cubre también el lazy-loading)
  works.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') classify(e.target); }, true);
  // Si falta la miniatura, se usa la imagen original como respaldo
  works.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = img.closest('a').getAttribute('href');
  }, true);
  $$('img', works).forEach(img => { if (img.complete) classify(img); });

  // Opciones oficiales de Lightbox2 (sin tocar sus archivos)
  const lb = window.lightbox;
  if (lb) {
    lb.option({
      albumLabel: 'Imagen %1 de %2',
      wrapAround: true,
      disableScrolling: true,     // bloquea el scroll del fondo mientras está abierto
      positionFromTop: 40,
      fadeDuration: reduceMotion.matches ? 0 : 300,
      imageFadeDuration: reduceMotion.matches ? 0 : 300,
      resizeDuration: reduceMotion.matches ? 0 : 400
    });

    // El Lightbox crea su HTML cuando jQuery está listo (después de este script),
    // así que las etiquetas accesibles se aplican en ese momento.
    window.jQuery(() => {
    const box = $('#lightbox');
    if (box) {
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Vista ampliada del proyecto');
      $('.lb-close', box)?.setAttribute('aria-label', 'Cerrar');
      $('.lb-cancel', box)?.setAttribute('aria-label', 'Cancelar carga');
      $('.lb-prev', box)?.setAttribute('aria-label', 'Imagen anterior');
      $('.lb-next', box)?.setAttribute('aria-label', 'Imagen siguiente');
    }

    // Al cerrar, devolver el foco a la miniatura que se abrió
    let lastLink = null;
    works.addEventListener('click', (e) => { lastLink = e.target.closest('a[data-lightbox]') || lastLink; });
    const overlay = $('#lightboxOverlay');
    if (overlay) {
      new MutationObserver(() => {
        if (overlay.style.display === 'none' && lastLink) { lastLink.focus({ preventScroll: true }); lastLink = null; }
      }).observe(overlay, { attributes: true, attributeFilter: ['style'] });
    }
    });
  }

  /* ---------- 4. Cubo 3D que rebota ---------- */
  // El giro 3D lo hace CSS (transform, en la GPU). Aquí solo se mueve el contenedor
  // con requestAnimationFrame y se cambia el tono de color en cada rebote.
  const cube = $('.cube-wrap');
  if (cube) {
    const vw = () => window.innerWidth;
    const vh = () => window.innerHeight;
    let S = cube.offsetWidth;                          // tamaño actual del cubo
    let x = vw() * 0.62, y = vh() * 0.22;
    const speed = Math.min(vw(), vh()) * 0.12;         // px/s, proporcional a la pantalla
    let vx = speed, vy = speed * 0.7;
    let hue = 285, last = 0;

    const place = () => { cube.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    const bounds = () => {                             // margen para que el cubo girando no se corte
      const m = S * 0.22;
      return { minX: m, minY: m, maxX: Math.max(m, vw() - S - m), maxY: Math.max(m, vh() - S - m) };
    };
    place();

    if (!reduceMotion.matches) {
      const step = (t) => {
        const dt = Math.min((t - last) / 1000, 0.05);  // evita saltos al volver a la pestaña
        last = t;
        const b = bounds();
        let hit = false;
        x += vx * dt; y += vy * dt;
        if (x <= b.minX)      { x = b.minX; vx =  Math.abs(vx); hit = true; }
        else if (x >= b.maxX) { x = b.maxX; vx = -Math.abs(vx); hit = true; }
        if (y <= b.minY)      { y = b.minY; vy =  Math.abs(vy); hit = true; }
        else if (y >= b.maxY) { y = b.maxY; vy = -Math.abs(vy); hit = true; }
        if (hit) { hue += 55; cube.style.setProperty('--cube-h', hue); }   // cambia de color al rebotar
        place();
        requestAnimationFrame(step);
      };
      requestAnimationFrame((t) => { last = t; requestAnimationFrame(step); });
    }

    window.addEventListener('resize', () => {
      S = cube.offsetWidth;
      const b = bounds();
      x = Math.min(Math.max(x, b.minX), b.maxX);
      y = Math.min(Math.max(y, b.minY), b.maxY);
      place();
    }, { passive: true });
  }
})();