// Ortak arayüz yardımcıları.
import { icons } from './icons.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  });
}

export function toast(message, type = 'info', ms = 3200) {
  let host = $('.toasts');
  if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.append(host); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
}

export function modal(contentHtml, { onMount, label = 'Pencere' } = {}) {
  const prev = document.activeElement;
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label)}">${contentHtml}</div>`;
  document.body.append(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  onMount?.(back.firstElementChild, close);
  (back.querySelector('input, textarea, button:not([data-close])') || back.querySelector('button'))?.focus();
  return close;
}

export function confirmDialog(title, text, { confirmText = 'Onayla', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const close = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" data-close>Vazgeç</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>
      </div>`, {
      label: title,
      onMount: (m, c) => {
        m.querySelector('[data-ok]').addEventListener('click', () => { done = true; c(); resolve(true); });
        new MutationObserver((_, obs) => { if (!m.isConnected) { obs.disconnect(); if (!done) resolve(false); } }).observe(document.body, { childList: true });
      },
    });
    return close;
  });
}

export function confetti(count = 90) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  const colors = ['#5b4cf0', '#ff7a59', '#12a87a', '#f2a516', '#8a7dff'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = `${1.6 + Math.random() * 1.8}s`;
    p.style.animationDelay = `${Math.random() * .4}s`;
    host.append(p);
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 4000);
}

export function ring(value, max, label, sub = '', size = 120) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return `<div class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(label)} ${esc(sub)}">
    <svg viewBox="0 0 120 120"><defs><linearGradient id="ringGrad" x1="0" x2="1"><stop offset="0" stop-color="var(--primary)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
    <circle class="track" cx="60" cy="60" r="${r}" fill="none" stroke-width="12"/>
    <circle class="bar" cx="60" cy="60" r="${r}" fill="none" stroke-width="12" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>
    <div class="label"><div>${esc(label)}<small>${esc(sub)}</small></div></div></div>`;
}

export const progressBar = (value, max, cls = '') => `<div class="progress ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><span style="width:${Math.round(Math.min(1, max ? value / max : 0) * 100)}%"></span></div>`;

export function relativeDue(ts) {
  if (!ts) return '—';
  const diff = ts - Date.now();
  if (diff <= 0) return 'şimdi';
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m} dk sonra`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa sonra`;
  return `${Math.round(h / 24)} gün sonra`;
}

export const dayName = (iso) => ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];

// AI cevapları için güvenli, sınırlı markdown: önce kaçışlanır, sonra biçimlenir.
export function renderMarkdown(text) {
  const lines = esc(text).split('\n');
  let out = '';
  let list = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = /^\s*[-•*]\s+(.*)/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)/.exec(line);
    const h = /^#{1,4}\s+(.*)/.exec(line);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (list !== type) { closeList(); out += `<${type}>`; list = type; }
      out += `<li>${inline((ul || ol)[1])}</li>`;
    } else if (h) { closeList(); out += `<p><strong>${inline(h[1])}</strong></p>`; }
    else if (!line.trim()) closeList();
    else { closeList(); out += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return out;
}

export function celebrate(result) {
  if (!result) return;
  if (result.bonusXp) toast(`🎯 Görev ödülü: +${result.bonusXp} XP`, 'success');
  for (const b of result.newBadges || []) toast(`${b.icon} Yeni rozet: ${b.title}`, 'success', 4500);
  if (result.newBadges?.length) confetti(60);
}

export const icon = (name) => icons[name] || '';

export function loadingView(text = 'Yükleniyor…') {
  return `<div class="page"><div class="stack" aria-busy="true" aria-label="${esc(text)}">
    <div class="skeleton" style="height:36px;width:40%"></div>
    <div class="skeleton" style="height:160px"></div>
    <div class="grid two"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:120px"></div></div></div></div>`;
}

export function errorView(message, retry = true) {
  return `<div class="page narrow"><div class="card empty"><div class="big">😕</div><h2>Bir sorun oluştu</h2><p>${esc(message)}</p>
    ${retry ? '<button class="btn btn-primary" data-action="reload">Tekrar dene</button>' : ''}</div></div>`;
}
