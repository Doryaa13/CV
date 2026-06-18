// ===== Year =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== Nav scroll state + progress bar =====
const nav = document.getElementById('nav');
const bar = document.getElementById('progressBar');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 30);
  const h = document.documentElement;
  const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
  bar.style.width = pct + '%';
}, { passive: true });

// ===== Reveal on scroll =====
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      // skill bars
      e.target.querySelectorAll('i[data-fill]').forEach(b => {
        b.style.width = b.dataset.fill + '%';
      });
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.16 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (i % 4) * 0.06 + 's';
  io.observe(el);
});

// ===== Animated counters =====
const counters = document.querySelectorAll('.stat b[data-count]');
const cObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    const dur = 1400, start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    cObs.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(c => cObs.observe(c));

// ===== Rotating hero words =====
const words = document.querySelectorAll('.rotator-words em');
let wi = 0;
if (words.length) {
  words[0].classList.add('active');
  setInterval(() => {
    words[wi].classList.remove('active');
    wi = (wi + 1) % words.length;
    words[wi].classList.add('active');
  }, 2400);
}

// ===== Auto-play work/lecture videos when in view =====
const vObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { v.play && v.play().catch(() => {}); }
    else { v.pause && v.pause(); }
  });
}, { threshold: 0.4 });
document.querySelectorAll('video').forEach(v => vObs.observe(v));

// ===== Lightweight particle field =====
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.getElementById('particles');
  const ctx = c.getContext('2d');
  let w, h, pts, raf;
  const COUNT = window.innerWidth < 700 ? 34 : 70;
  const colors = ['#6d6bff', '#22d3ee', '#ff5d8f'];

  function resize() {
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
  }
  function init() {
    pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.8 + .6,
      col: colors[(Math.random() * colors.length) | 0]
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.col;
      ctx.globalAlpha = .55;
      ctx.fill();
      // links
      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d = dx * dx + dy * dy;
        if (d < 13000) {
          ctx.globalAlpha = (1 - d / 13000) * .18;
          ctx.strokeStyle = p.col;
          ctx.lineWidth = .6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }
  resize(); init(); tick();
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); init(); tick(); });
})();

// ===== Subtle parallax on hero photo =====
const photo = document.querySelector('.hero-photo');
if (photo && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - .5) * 16;
    const y = (e.clientY / window.innerHeight - .5) * 16;
    photo.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: true });
}
