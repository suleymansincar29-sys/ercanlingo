// Dil Bilgisi: konu listesi ve konu ayrıntısı.
import { allGrammar, getGrammar, plannedGrammar, getLesson, isLessonUnlocked } from '/shared/curriculum.js';
import { store, completedSet } from '../store.js';
import { icons } from '../icons.js';
import { esc, on } from '../ui.js';
import { speak } from '../speech.js';
import { grammarHtml } from './lesson.js';

export const title = (p) => (p.id ? getGrammar(p.id)?.title || 'Dil Bilgisi' : 'Dil Bilgisi');

export function render(el, { id }) {
  const done = completedSet();
  const weak = new Map(store.state.weakTopics.map((w) => [w.topic, w.n]));
  on(el, 'click', '[data-say]', (e, b) => speak(b.dataset.say));

  if (id) {
    const g = getGrammar(id);
    if (!g) { el.innerHTML = '<div class="page narrow"><div class="card empty"><div class="big">🔎</div><h2>Konu bulunamadı</h2><a class="btn btn-primary" href="#/grammar">Dil Bilgisi\'ne dön</a></div></div>'; return; }
    const lesson = getLesson(g.lessonId);
    const open = isLessonUnlocked(lesson.id, done, store.state.user.level);
    el.innerHTML = `<div class="page narrow">
      <a href="#/grammar" class="small">← Tüm konular</a>
      <div class="header mt"><div><span class="tag primary">${g.level}</span> <span class="tag">${esc(g.unitTitle)}</span><h1 class="mt">${esc(g.title)}</h1></div></div>
      ${weak.has(g.id) ? `<div class="notice mb"><span class="ico">⚠️</span><div>Son testlerinde bu konuda ${weak.get(g.id)} kez hata yaptın. Örnekleri dinleyip dersi tekrar çözmen faydalı olur.</div></div>` : ''}
      <section class="card pad-lg">${grammarHtml(g)}</section>
      <section class="card mt row between"><div><b>Bu konuyu pekiştir</b><div class="small muted">"${esc(lesson.title)}" dersi bu konuyu alıştırmalarla çalıştırır.</div></div>
        ${open ? `<a class="btn btn-primary" href="#/lesson/${lesson.id}">${icons.play} Derse git</a>` : `<span class="tag">${icons.lock} Önceki dersleri bitir</span>`}
        ${store.state.ai.enabled ? `<a class="btn btn-secondary" href="#/tutor?mode=grammar&q=${encodeURIComponent(`${g.title} konusunu bana basitçe anlatır mısın?`)}">${icons.ai} AI öğretmene sor</a>` : ''}</section>
    </div>`;
    return;
  }

  const groups = {};
  for (const g of allGrammar()) (groups[g.level] ||= []).push(g);
  const planned = plannedGrammar();
  el.innerHTML = `<div class="page narrow">
    <div class="header"><div><h1>Dil Bilgisi</h1><p>Konular Türkçe açıklamalar, tablolar ve sesli örneklerle anlatılır.</p></div></div>
    ${Object.entries(groups).map(([lv, items]) => `<div class="level-head"><div class="level-badge">${lv}</div><h2 style="margin:0">${lv} konuları</h2></div>
      <div class="grid two">${items.map((g) => `<a class="card interactive" href="#/grammar/${g.id}" style="text-decoration:none;color:inherit">
        <div class="row between"><span class="tag">${esc(g.unitTitle)}</span>${done.has(g.lessonId) ? '<span class="tag success">Çalışıldı</span>' : ''}${weak.has(g.id) ? '<span class="tag warning">Tekrar et</span>' : ''}</div>
        <h3 class="mt" style="margin-bottom:4px">${esc(g.title)}</h3><p class="small muted" style="margin:0">${esc(g.intro.slice(0, 110))}${g.intro.length > 110 ? '…' : ''}</p></a>`).join('')}</div>`).join('')}
    <div class="level-head"><div class="level-badge muted-badge">B1+</div><div><h2 style="margin:0">Planlanan konular</h2><p class="small muted" style="margin:0">Bu konuların içeriği henüz hazırlanıyor.</p></div></div>
    <div class="planned-list">${planned.map((p) => `<div class="planned-item"><span class="tag">${p.level}</span><span class="grow">${esc(p.title)}</span><span class="tiny">${esc(p.unitTitle)}</span></div>`).join('')}</div>
  </div>`;
}
