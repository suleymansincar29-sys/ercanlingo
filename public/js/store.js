// Uygulama durumu: sunucudan gelen kullanıcı verisi ve küçük yardımcılar.
import { api } from './api.js';
import { allWords, getWord } from '/shared/curriculum.js';

const listeners = new Set();
export const store = { config: null, state: null };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(store));

export async function loadConfig() {
  store.config = await api('/api/config');
  return store.config;
}

export async function refresh() {
  store.state = await api('/api/state');
  applyTheme(store.state.user.settings.theme);
  emit();
  return store.state;
}

export function setState(next) {
  store.state = next;
  applyTheme(next.user.settings.theme);
  emit();
}

export function clearState() { store.state = null; emit(); }

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  try { localStorage.setItem('el-theme', theme || 'system'); } catch { /* depolama kapalı olabilir */ }
}

export const user = () => store.state?.user;
export const settings = () => store.state?.user.settings || {};

export function completedSet() {
  const s = new Set();
  for (const [id, p] of Object.entries(store.state?.lessons || {})) if (p.completedAt) s.add(id);
  return s;
}

// Hem müfredat hem de kullanıcının eklediği kelimeler.
export function findWord(id) {
  return getWord(id) || store.state?.customWords.find((w) => w.id === id) || null;
}
export function everyWord() {
  return [...allWords(), ...(store.state?.customWords || [])];
}

export function wordStatus(id) {
  const p = store.state?.words[id];
  if (!p || !p.inSrs) return { key: 'new', label: 'Yeni' };
  if (p.interval >= 21) return { key: 'mastered', label: 'Ustalaşıldı' };
  if (p.reps >= 2) return { key: 'known', label: 'Biliniyor' };
  return { key: 'learning', label: 'Öğreniliyor' };
}

export function dueWords() {
  const now = Date.now();
  return Object.entries(store.state?.words || {})
    .filter(([id, p]) => p.inSrs && p.dueAt && p.dueAt <= now && findWord(id))
    .sort((a, b) => a[1].ease - b[1].ease || a[1].dueAt - b[1].dueAt)
    .map(([id]) => findWord(id));
}
