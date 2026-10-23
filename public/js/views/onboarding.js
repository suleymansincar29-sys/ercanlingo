// İlk kurulum: hedef ve seviye seçimi.
import { BRAND } from '/shared/brand.js';
import { LEVELS } from '/shared/curriculum.js';
import { api } from '../api.js';
import { refresh, store } from '../store.js';
import { logo, wordmark } from '../icons.js';
import { esc, $, $$, toast } from '../ui.js';

export const title = 'Başlangıç';

const GOALS = [[10, 'Rahat', '5 dk/gün'], [20, 'Düzenli', '10 dk/gün'], [30, 'Ciddi', '15 dk/gün'], [50, 'Yoğun', '25 dk/gün']];

export async function render(el, params, { navigate }) {
  const u = store.state.user;
  let goal = u.dailyGoal;
  let level = u.level;
  el.innerHTML = `<div class="main"><div class="page narrow stack" style="gap:20px;padding-top:20px">
    <div class="row">${logo(40)}${wordmark(BRAND.appName)}</div>
    <div><h1>Merhaba ${esc(u.name)}! 👋</h1><p class="muted">Sana uygun bir öğrenme planı hazırlamak için iki küçük soru.</p></div>
    <section class="card stack">
      <h2>1. Günlük hedefin ne olsun?</h2>
      <div class="choice-grid" data-group="goal">${GOALS.map(([xp, name, time]) => `<button class="choice ${xp === goal ? 'active' : ''}" data-value="${xp}"><b>${name}</b><span>${xp} XP · ${time}</span></button>`).join('')}</div>
    </section>
    <section class="card stack">
      <h2>2. İngilizce seviyen ne?</h2>
      <p class="muted" style="margin:0">Emin değilsen seviye belirleme testini çöz (20 soru, yaklaşık 5 dakika).</p>
      <div class="choice-grid" data-group="level">${LEVELS.map((l) => `<button class="choice ${l.id === level ? 'active' : ''}" data-value="${l.id}"><b>${l.id} · ${l.title}</b><span>${l.planned ? 'İçerik hazırlanıyor' : esc(l.description)}</span></button>`).join('')}</div>
      <div class="notice info hidden" data-planned><span class="ico">ℹ️</span><div>Bu seviyenin dersleri henüz hazırlanıyor. Şimdilik A2 derslerini tekrar ederek ve AI öğretmenle pratik yaparak ilerleyebilirsin.</div></div>
      <a class="btn btn-secondary" href="#/placement">🧭 Seviye belirleme testini çöz</a>
    </section>
    <button class="btn btn-primary btn-lg" data-start>Öğrenmeye başla</button>
  </div></div>`;

  const plannedNote = $('[data-planned]', el);
  const syncPlanned = () => plannedNote.classList.toggle('hidden', !LEVELS.find((l) => l.id === level)?.planned);
  syncPlanned();
  $$('[data-group]', el).forEach((group) => group.addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (!b) return;
    $$('.choice', group).forEach((c) => c.classList.toggle('active', c === b));
    if (group.dataset.group === 'goal') goal = Number(b.dataset.value);
    else { level = b.dataset.value; syncPlanned(); }
  }));
  $('[data-start]', el).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await api('/api/me', { method: 'PATCH', body: { dailyGoal: goal, level, onboarded: true } });
      await refresh();
      navigate('');
    } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
  });
}
