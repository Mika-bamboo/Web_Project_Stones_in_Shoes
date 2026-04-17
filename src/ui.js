// Page-level DOM wiring for index.html.
//
// Extracted from the inline <script> block that used to live at the
// bottom of index.html. Handles everything that is NOT the gait
// animation itself:
//
//   • Intersection-observer-driven act fade-in + nav-dot tracking
//   • Progress-bar width based on the current act
//   • Click handlers for the nav dots and the per-act "next" buttons
//   • Sound toggle (cosmetic only — audio isn't wired yet)
//   • Range-slider value displays (the `.val[data-for="<id>"]` spans)
//   • Placeholder interactions for Act 4 (shoe-card selection, Run
//     button) and Act 6 (shoe tabs, scene cards)
//
// Loaded as an ES module so it participates in the importmap's
// cache-buster versioning alongside the gait code.

// ── Intersection Observer: act visibility + nav dots ───────────────
const acts = document.querySelectorAll('.act');
const dots = document.querySelectorAll('.act-dot');
let currentAct = 1;

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        const actNum = parseInt(entry.target.dataset.act, 10);
        if (actNum !== currentAct) {
          currentAct = actNum;
          updateNav(actNum);
        }
      }
    });
  },
  { threshold: 0.25 },
);

acts.forEach((act) => observer.observe(act));

function updateNav(actNum) {
  dots.forEach((dot) => {
    dot.classList.toggle('active', parseInt(dot.dataset.act, 10) === actNum);
  });
  const pct = ((actNum - 1) / (acts.length - 1)) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
}

// ── Nav dot clicks ────────────────────────────────────────────────
dots.forEach((dot) => {
  dot.addEventListener('click', () => {
    const target = document.getElementById('act' + dot.dataset.act);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── Next buttons ──────────────────────────────────────────────────
document.querySelectorAll('.act-next').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── Sound toggle ─────────────────────────────────────────────────
// Cosmetic only at the moment; no audio assets are wired up. Toggling
// the .active class flips the icon between the muted and playing
// glyphs defined in index.html.
const soundBtn = document.getElementById('soundToggle');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    soundBtn.classList.toggle('active');
  });
}

// ── Slider value displays ─────────────────────────────────────────
// Each range input has a sibling `<span class="val" data-for="<id>">`
// that mirrors the current value. A couple of specific sliders want
// unit suffixes or a word-scale (Low / Med / High) instead of raw
// numbers.
const COLLAR_HEIGHT_LABELS = [
  '', 'Very low', 'Low', 'Low', 'Med-low', 'Med',
  'Med', 'Med-high', 'High', 'High', 'Very high',
];
const HEEL_NOTCH_LABELS = [
  '', 'Narrow', 'Narrow', 'Med-narrow', 'Med', 'Med',
  'Med', 'Med-wide', 'Wide', 'Wide', 'Very wide',
];

document.querySelectorAll('input[type="range"]').forEach((slider) => {
  const display = document.querySelector(`.val[data-for="${slider.id}"]`);
  if (!display) return;
  slider.addEventListener('input', () => {
    let text = slider.value;
    if (slider.id === 'stoneSize2' || slider.id === 'size6') text += ' mm';
    if (slider.id === 'collarHeight') {
      text = COLLAR_HEIGHT_LABELS[parseInt(slider.value, 10)] || slider.value;
    }
    if (slider.id === 'heelNotch') {
      text = HEEL_NOTCH_LABELS[parseInt(slider.value, 10)] || slider.value;
    }
    display.textContent = text;
  });
});

// ── Shoe card selection (Act 4 — placeholder) ─────────────────────
const shoeCards = document.querySelectorAll('#shoeGrid .shoe-card');
shoeCards.forEach((card) => {
  card.addEventListener('click', () => {
    shoeCards.forEach((c) => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');
  });
});

// ── Run button (Act 4 — placeholder) ──────────────────────────────
const runBtn = document.getElementById('runBtn');
if (runBtn) {
  runBtn.addEventListener('click', () => {
    const selected = document.querySelector('#shoeGrid .shoe-card.selected');
    if (!selected) {
      // Flash all cards briefly to hint selection is needed.
      shoeCards.forEach((c) => {
        c.style.borderColor = 'var(--accent)';
        setTimeout(() => { c.style.borderColor = ''; }, 600);
      });
      return;
    }
    document.getElementById('act5').scrollIntoView({ behavior: 'smooth' });
  });
}

// ── Shoe tabs (Act 6 — placeholder) ───────────────────────────────
const shoeTabs6 = document.querySelectorAll('#shoeTabs6 .shoe-tab');
shoeTabs6.forEach((tab) => {
  tab.addEventListener('click', () => {
    shoeTabs6.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-pressed', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-pressed', 'true');
  });
});

// ── Scene cards (Act 6 — placeholder) ─────────────────────────────
const sceneCards = document.querySelectorAll('#sceneCards .scene-card');
sceneCards.forEach((card) => {
  card.addEventListener('click', () => {
    sceneCards.forEach((c) => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('active');
    card.setAttribute('aria-pressed', 'true');
  });
});
