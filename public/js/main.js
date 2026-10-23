import { BRAND, creditLine } from '/shared/brand.js';
import { loadConfig, refresh, store, subscribe, applyTheme } from './store.js';
import { ApiError } from './api.js';
import { icons, logo, wordmark } from './icons.js';
import { esc, modal, loadingView, errorView, on } from './ui.js';

// Navigasyon: ana bölümler (8 bölüm) ve ek sayfalar.
export const NAV = [
  { path: '', label: 'Ana Sayfa', icon: 'home' },
  { path: 'learn', label: 'Öğren', icon: 'learn' },
  { path: 'words', label: 'Kelimelerim', icon: 'words' },
  { path: 'grammar', label: 'Dil Bilgisi', icon: 'grammar' },
  { path: 'speak', label: 'Konuşma', icon: 'speak' },
  { path: 'tutor', label: 'AI Öğretmen', icon: 'ai' },
  { path: 'progress', label: 'İlerlemem', icon: 'progress' },
  { path: 'profile', label: 'Profil ve Ayarlar', icon: 'profile' },
];
const MOBILE_NAV = ['', 'learn', 'words', 'speak'];

const ROUTES = [
  ['', () => import('./views/home.js')],
  ['learn', () => import('./views/learn.js')],
  ['lesson/:id', () => import('./views/lesson.js'), { full: true }],
  ['unit-test/:id', () => import('./views/unittest.js'), { full: true }],
  ['review', () => import('./views/review.js'), { full: true }],
  ['placement', () => import('./views/placement.js'), { full: true }],
  ['words', () => import('./views/words.js')],
  ['grammar', () => import('./views/grammar.js')],
  ['grammar/:id', () => import('./views/grammar.js')],
  ['speak', () => import('./views/speak.js')],
  ['speak/:id', () => import('./views/scenario.js'), { full: true }],
  ['pairs', () => import('./views/pairs.js'), { full: true }],
  ['tutor', () => import('./views/tutor.js')],
  ['progress', () => import('./views/progress.js')],
  ['profile', () => import('./views/profile.js')],
  ['about', () => import('./views/about.js')],
  ['welcome', () => import('./views/auth.js'), { public: true }],
  ['login', () => import('./views/auth.js'), { public: true }],
  ['register', () => import('./views/auth.js'), { public: true }],
  ['onboarding', () => import('./views/onboarding.js'), { bare: true }],
];

const app = document.getElementById('app');
let cleanup = null;
let renderId = 0;

export const navigate = (path) => { location.hash = `#/${path}`; };
const currentPath = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('?')[0];

function match(path) {
  for (const [pattern, loader, opts = {}] of ROUTES) {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    const m = re.exec(path);
    if (m) return { pattern, loader, opts, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
  }
  return null;
}

function shellHtml() {
  const due = store.state?.dueCount || 0;
  const g = store.state?.game;
  const link = (n) => `<a class="nav-link" href="#/${n.path}" data-path="${n.path}">${icons[n.icon]}<span>${n.label}</span>${n.path === 'words' && due ? `<span class="count" title="Tekrar bekleyen kelime">${due}</span>` : ''}</a>`;
  return `
  <div class="shell">
    <aside class="sidebar" aria-label="Ana menü">
      <a class="brand" href="#/">${logo(38)}${wordmark(BRAND.appName)}</a>
      <nav class="stack" style="gap:4px">${NAV.map(link).join('')}</nav>
      <div class="sidebar-foot"><a href="#/about" class="muted">Hakkında</a> · ${esc(creditLine())}</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <a class="brand" href="#/">${logo(30)}${wordmark(BRAND.appName)}</a>
        <div class="row" style="gap:6px">
          <span class="chip streak" title="Çalışma serisi">${icons.flame}<span data-bind="streak">${g?.streak.count ?? 0}</span></span>
          <span class="chip xp" title="Toplam XP">${icons.bolt}<span data-bind="xp">${g?.xp.total ?? 0}</span></span>
        </div>
      </header>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav" aria-label="Alt menü">
      ${MOBILE_NAV.map((p) => NAV.find((n) => n.path === p)).map((n) => `<a href="#/${n.path}" data-path="${n.path}">${icons[n.icon]}<span>${n.label}</span></a>`).join('')}
      <button type="button" data-action="more">${icons.menu}<span>Daha fazla</span></button>
    </nav>
  </div>`;
}

function ensureShell() {
  if (!document.querySelector('.shell')) {
    app.innerHTML = shellHtml();
    on(app, 'click', '[data-action="more"]', () => openMore());
  }
  return document.getElementById('view');
}

function updateShell(path) {
  const top = path.split('/')[0];
  const section = { lesson: 'learn', 'unit-test': 'learn', placement: 'learn', review: 'words', pairs: 'speak', about: 'profile' }[top] ?? top;
  document.querySelectorAll('[data-path]').forEach((a) => a.classList.toggle('active', a.dataset.path === section));
  document.querySelectorAll('[data-path]').forEach((a) => (a.dataset.path === section ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const g = store.state?.game;
  if (g) {
    document.querySelectorAll('[data-bind="streak"]').forEach((e) => { e.textContent = g.streak.count; });
    document.querySelectorAll('[data-bind="xp"]').forEach((e) => { e.textContent = g.xp.total; });
  }
  const due = store.state?.dueCount || 0;
  document.querySelectorAll('.nav-link[data-path="words"]').forEach((a) => {
    a.querySelector('.count')?.remove();
    if (due) a.insertAdjacentHTML('beforeend', `<span class="count" title="Tekrar bekleyen kelime">${due}</span>`);
  });
}

function openMore() {
  const items = NAV.filter((n) => !MOBILE_NAV.includes(n.path));
  modal(`<div class="row between mb"><h2 style="margin:0">Menü</h2><button class="icon-btn" data-close aria-label="Kapat">${icons.close}</button></div>
    <div class="sheet-links">${items.map((n) => `<a class="nav-link" href="#/${n.path}" data-close>${icons[n.icon]}<span>${n.label}</span></a>`).join('')}
    <a class="nav-link" href="#/about" data-close>${icons.info}<span>Hakkında</span></a></div>`, { label: 'Menü' });
}

async function route() {
  const id = ++renderId;
  const path = currentPath();
  const found = match(path) || match('');
  cleanup?.();
  cleanup = null;
  const loggedIn = Boolean(store.state);

  if (!found.opts.public && !loggedIn) return navigate('welcome');
  if (found.opts.public && loggedIn) return navigate('');
  if (loggedIn && !store.state.user.onboarded && found.pattern !== 'onboarding' && found.pattern !== 'placement') return navigate('onboarding');

  let target;
  if (found.opts.public || found.opts.bare) {
    app.innerHTML = '<div id="view"></div>';
    target = document.getElementById('view');
  } else if (found.opts.full) {
    ensureShell();
    document.querySelector('.player-root')?.remove();
    target = document.createElement('div');
    target.className = 'player-root';
    document.body.append(target);
    document.querySelector('.shell')?.setAttribute('inert', '');
  } else {
    document.querySelector('.player-root')?.remove();
    const view = ensureShell();
    target = document.createElement('div');
    target.className = 'enter';
    setTimeout(() => target.classList.remove('enter'), 600);
    view.replaceChildren(target);
    target.innerHTML = loadingView();
    updateShell(path);
  }
  if (!found.opts.full) { document.querySelector('.player-root')?.remove(); document.querySelector('.shell')?.removeAttribute('inert'); }

  try {
    const mod = await found.loader();
    if (id !== renderId) return;
    const result = await mod.render(target, found.params, { path, pattern: found.pattern, navigate });
    if (id !== renderId) return;
    cleanup = typeof result === 'function' ? result : null;
    document.title = `${mod.title ? `${typeof mod.title === 'function' ? mod.title(found.params) : mod.title} · ` : ''}${BRAND.appName}`;
    if (!found.opts.full) { window.scrollTo(0, 0); document.getElementById('view')?.focus({ preventScroll: true }); }
  } catch (err) {
    console.error(err);
    if (err instanceof ApiError && err.status === 401) { store.state = null; return navigate('welcome'); }
    target.innerHTML = errorView(err.message || 'Sayfa yüklenemedi.');
    target.querySelector('[data-action="reload"]')?.addEventListener('click', route);
  }
}

subscribe(() => updateShell(currentPath()));
window.addEventListener('hashchange', route);

export async function boot() {
  try { applyTheme(localStorage.getItem('el-theme')); } catch { /* depolama kapalı */ }
  const splash = document.getElementById('splash');
  splash?.querySelector('.splash-name')?.replaceChildren(document.createRange().createContextualFragment(wordmark(BRAND.appName)));
  splash?.querySelector('.splash-credit')?.replaceChildren(creditLine());
  const started = Date.now();
  try {
    await loadConfig();
    try { await refresh(); } catch (err) { if (!(err instanceof ApiError && err.status === 401)) throw err; }
  } catch (err) {
    app.innerHTML = errorView(err.message || 'Uygulama başlatılamadı.');
    app.querySelector('[data-action="reload"]')?.addEventListener('click', () => location.reload());
    splash?.classList.add('done');
    return;
  }
  await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
  splash?.classList.add('done');
  setTimeout(() => splash?.remove(), 600);
  await route();
  scheduleReminder();
}

// Hatırlatma: yalnızca uygulama açıkken, izin verildiyse ve günlük hedef tamamlanmadıysa çalışır.
function scheduleReminder() {
  setInterval(() => {
    const s = store.state;
    if (!s || !s.user.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    if (now.getHours() < s.user.settings.reminderHour) return;
    const key = `el-reminded-${s.today}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { return; }
    if (s.game.xp.today < s.user.dailyGoal) new Notification(BRAND.appName, { body: `Bugünkü hedefine ${s.user.dailyGoal - s.game.xp.today} XP kaldı. Kısa bir ders yapalım mı?`, icon: '/assets/icon.svg' });
  }, 60_000);
}

boot();
