// Ana sayfa: öğrenme yolculuğunun özeti.
import { BRAND } from '/shared/brand.js';
import { getLesson, getUnit, nextLesson, wordOfDay } from '/shared/curriculum.js';
import { SHADOWING } from '/shared/content/speaking.js';
import { api } from '../api.js';
import { store, completedSet, refresh } from '../store.js';
import { icons } from '../icons.js';
import { esc, ring, progressBar, dayName, on, toast } from '../ui.js';
import { speak } from '../speech.js';

export const title = 'Ana Sayfa';

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
};

function draw(el) {
  const s = store.state;
  const g = s.game;
  const done = completedSet();
  const next = nextLesson(done, s.user.level);
  // Devam edilen ders: en son denenen ama henüz geçilmemiş ders.
  const inProgress = Object.entries(s.lessons).filter(([, p]) => !p.completedAt).sort((a, b) => b[1].lastAt - a[1].lastAt)[0];
  const cont = inProgress ? getLesson(inProgress[0]) : null;
  const wod = wordOfDay(s.today);
  const wodState = s.words[wod.id];
  const week = g.days.slice(-7);
  const maxXp = Math.max(s.user.dailyGoal, ...week.map((d) => d.xp));
  const shadow = SHADOWING[new Date().getDate() % SHADOWING.length];
  const lessonCard = (lesson, label) => {
    const unit = getUnit(lesson.unitId);
    return `<div class="stack" style="gap:6px"><span class="eyebrow">${label}</span><h2 style="margin:0">${esc(lesson.title)}</h2>
      <span class="muted">${lesson.level} · ${esc(unit.title)} · ${esc(lesson.subtitle)}</span></div>`;
  };
  const allDone = !next;

  el.innerHTML = `<div class="page">
    <div class="header">
      <div><h1>${greeting()}, ${esc(s.user.name)}!</h1><p>${g.streak.activeToday ? 'Bugün çalıştın, serin güvende. 🔥' : g.streak.count ? `${g.streak.count} günlük serini korumak için bugün küçük bir etkinlik yap.` : 'Bugün yeni bir seri başlatmak için harika bir gün.'}</p></div>
      <div class="stats-chips"><span class="chip streak">${icons.flame}${g.streak.count} gün</span><span class="chip xp">${icons.bolt}${g.xp.total} XP</span><span class="chip level">${icons.star}Seviye ${g.xp.level}</span></div>
    </div>
    ${s.user.isGuest ? `<div class="notice info mb"><span class="ico">💾</span><div class="grow">Misafir olarak çalışıyorsun. İlerlemeni kaybetmemek ve başka cihazdan devam etmek için ücretsiz hesap oluştur.</div><a class="btn btn-sm btn-primary" href="#/register">Hesap oluştur</a></div>` : ''}
    <div class="dash">
      <div class="stack" style="gap:16px">
        <section class="card hero pad-lg">
          ${allDone
            ? `<div class="stack"><span class="eyebrow">Tebrikler</span><h2>Hazır olan tüm dersleri bitirdin! 🎉</h2><p class="muted">B1 dersleri hazırlanıyor. Bu sırada kelimelerini tekrar et ve AI öğretmenle konuş.</p><div class="row"><a class="btn btn-light" href="#/words">Kelimeleri tekrar et</a></div></div>`
            : `<div class="stack" style="gap:18px">${cont && cont.id !== next.id ? lessonCard(cont, 'Devam edilen ders') : lessonCard(next, done.size ? 'Önerilen sonraki ders' : 'İlk dersin')}
              <div class="row"><a class="btn btn-light btn-lg" href="#/lesson/${cont && cont.id !== next.id ? cont.id : next.id}">${icons.play} ${cont ? 'Devam et' : 'Derse başla'}</a>
              ${cont && cont.id !== next.id ? `<a class="btn btn-ghost" style="color:#fff" href="#/lesson/${next.id}">Sıradaki: ${esc(next.title)}</a>` : ''}</div></div>`}
        </section>

        <section class="card">
          <div class="card-title"><h3>Günlük hedef</h3><a class="small" href="#/profile">Hedefi değiştir</a></div>
          <div class="goal">
            ${ring(Math.min(g.xp.today, s.user.dailyGoal), s.user.dailyGoal, `${g.xp.today}/${s.user.dailyGoal}`, 'XP bugün')}
            <div class="stack grow" style="gap:8px">
              <div><b>${g.xp.today >= s.user.dailyGoal ? 'Günlük hedefe ulaştın! 🎯' : `Hedefe ${s.user.dailyGoal - g.xp.today} XP kaldı`}</b></div>
              <div class="small muted">Bugün öğrenilen kelime: <b>${g.wordsToday}</b> · Seviye ${g.xp.level} (${g.xp.total - g.xp.curr}/${g.xp.next - g.xp.curr} XP)</div>
              ${progressBar(g.xp.total - g.xp.curr, g.xp.next - g.xp.curr, 'thin')}
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title"><h3>Bu hafta</h3><span class="tag primary">Hedef: ${g.weekly.goalDays}/${g.weekly.target} gün</span></div>
          <div class="week" aria-label="Son 7 günün XP grafiği">
            ${week.map((d) => `<div class="bar ${d.xp >= s.user.dailyGoal ? 'hit' : ''} ${d.day === s.today ? 'today' : ''}" title="${d.day}: ${d.xp} XP"><small>${d.xp || ''}</small><span style="height:${Math.max(6, (d.xp / maxXp) * 80)}px"></span>${dayName(d.day)}</div>`).join('')}
          </div>
          <p class="small muted mt" style="margin-bottom:0">Haftalık hedef: günlük hedefe ${g.weekly.target} gün ulaş, ${g.weekly.reward} XP bonus kazan. ${g.weekly.rewarded ? '✅ Bu haftanın bonusu alındı.' : ''} Bu hafta toplam ${g.weekly.xp} XP.</p>
        </section>
      </div>

      <div class="stack" style="gap:16px">
        <section class="card">
          <div class="card-title"><h3>Günlük görevler</h3><span class="tag accent">+${g.quests[0]?.reward ?? 10} XP / görev</span></div>
          ${g.quests.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><div class="ico">${q.done ? '✅' : q.icon}</div><div class="grow"><b class="small">${esc(q.title)}</b>${progressBar(q.value, q.target, q.done ? 'success thin' : 'thin')}</div><span class="small muted">${q.value}/${q.target}</span></div>`).join('')}
        </section>

        <section class="card word-day">
          <div class="card-title"><h3>Günün kelimesi</h3><span class="tag">${wod.level} · ${esc(wod.topic)}</span></div>
          <div class="row"><span class="w">${esc(wod.en)}</span><button class="icon-btn" data-say="${esc(wod.en)}" aria-label="Dinle">${icons.volume}</button>
            <button class="icon-btn ${wodState?.favorite ? 'active' : ''}" data-fav="${wod.id}" aria-pressed="${Boolean(wodState?.favorite)}" aria-label="Favorilere ekle">${wodState?.favorite ? icons.heartFill : icons.heart}</button></div>
          <div class="row small"><span class="pron">${esc(wod.pron)}</span><b>${esc(wod.tr)}</b></div>
          <p class="mt" style="margin-bottom:2px"><button class="icon-btn" style="display:inline-grid;width:30px;height:30px;vertical-align:middle" data-say="${esc(wod.ex)}" aria-label="Örneği dinle">${icons.volume}</button> ${esc(wod.ex)}</p>
          <p class="small muted" style="margin:0">${esc(wod.exTr)}</p>
          ${wodState?.inSrs ? '' : `<button class="btn btn-sm btn-secondary mt" data-learn="${wod.id}">${icons.plus} Tekrar listeme ekle</button>`}
        </section>

        <section class="card">
          <div class="card-title"><h3>Tekrar zamanı</h3>${s.dueCount ? `<span class="tag warning">${s.dueCount} kelime</span>` : ''}</div>
          ${s.dueCount
            ? `<p class="muted">Aralıklı tekrar sistemine göre şu an tekrar etmen gereken ${s.dueCount} kelime var. Zorlandığın kelimeler önce gelir.</p><a class="btn btn-accent btn-block" href="#/review">${icons.refresh} Şimdi tekrar et</a>`
            : `<p class="muted" style="margin:0">${Object.values(s.words).some((w) => w.inSrs) ? 'Harika, şu an bekleyen tekrar yok. Bir sonraki tekrar zamanı geldiğinde burada göreceksin.' : 'Ders tamamladıkça öğrendiğin kelimeler burada tekrar için sıraya girer.'}</p>`}
        </section>

        <section class="card">
          <div class="card-title"><h3>Hızlı konuşma pratiği</h3><a class="small" href="#/speak">Tümü</a></div>
          <p style="margin-bottom:4px"><b>${esc(shadow[0])}</b></p><p class="small muted">${esc(shadow[1])}</p>
          <div class="row"><button class="btn btn-sm btn-secondary" data-say="${esc(shadow[0])}">${icons.volume} Dinle</button><a class="btn btn-sm btn-primary" href="#/speak">${icons.speak} Konuşma pratiği</a></div>
        </section>
      </div>
    </div>
    <p class="center small muted mt">${esc(BRAND.appName)} · Yapımcı: ${esc(BRAND.creatorName)}</p>
  </div>`;
}

export function render(el) {
  draw(el);

  on(el, 'click', '[data-say]', (e, b) => speak(b.dataset.say));
  on(el, 'click', '[data-fav]', async (e, b) => {
    const fav = b.getAttribute('aria-pressed') !== 'true';
    try { await api('/api/words/favorite', { method: 'POST', body: { wordId: b.dataset.fav, favorite: fav } }); await refresh(); draw(el); toast(fav ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı'); } catch (err) { toast(err.message, 'error'); }
  });
  on(el, 'click', '[data-learn]', async (e, b) => {
    try { await api('/api/words/srs', { method: 'POST', body: { wordId: b.dataset.learn, add: true } }); await refresh(); draw(el); toast('Kelime tekrar listene eklendi', 'success'); } catch (err) { toast(err.message, 'error'); }
  });
}
