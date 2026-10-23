// İlerlemem: istatistikler, grafikler, rozetler.
import { availableLessons, topicLabel, getLesson, getUnit } from '/shared/curriculum.js';
import { store, completedSet } from '../store.js';
import { icons } from '../icons.js';
import { esc, progressBar, dayName } from '../ui.js';

export const title = 'İlerlemem';

export function render(el) {
  const s = store.state;
  const g = s.game;
  const done = completedSet();
  const lessons = availableLessons();
  const byLevel = ['A1', 'A2'].map((lv) => ({ lv, total: lessons.filter((l) => l.level === lv).length, done: lessons.filter((l) => l.level === lv && done.has(l.id)).length }));
  const words = Object.values(s.words);
  const learned = words.filter((w) => w.inSrs).length;
  const mastered = words.filter((w) => w.inSrs && w.interval >= 21).length;
  const answers = words.reduce((a, w) => ({ c: a.c + w.correct, w: a.w + w.wrong }), { c: 0, w: 0 });
  const lessonResults = s.results.filter((r) => r.kind === 'lesson');
  const avg = lessonResults.length ? Math.round(lessonResults.reduce((a, r) => a + r.correct / r.total, 0) / lessonResults.length * 100) : null;
  const maxXp = Math.max(10, ...g.days.map((d) => d.xp));
  const config = store.config;
  const earned = new Map(g.badges.map((b) => [b.badge_id, b.earned_at]));
  const kindLabel = { lesson: 'Ders', unit: 'Ünite testi', placement: 'Seviye testi' };
  const refName = (r) => (r.kind === 'lesson' ? getLesson(r.ref)?.title : r.kind === 'unit' ? getUnit(r.ref)?.title : `Önerilen: ${r.ref}`) || r.ref;

  el.innerHTML = `<div class="page">
    <div class="header"><div><h1>İlerlemem</h1><p>Bütün sayılar gerçekten tamamladığın etkinliklerden hesaplanır.</p></div></div>
    <div class="grid auto mb">
      <div class="card"><div class="small muted">Toplam XP</div><div class="big-num" style="color:var(--primary)">${g.xp.total}</div><div class="small muted">Seviye ${g.xp.level} · sonraki seviyeye ${g.xp.next - g.xp.total} XP</div>${progressBar(g.xp.total - g.xp.curr, g.xp.next - g.xp.curr, 'thin')}</div>
      <div class="card"><div class="small muted">Çalışma serisi</div><div class="big-num" style="color:var(--streak)">${g.streak.count} gün</div><div class="small muted">${g.streak.activeToday ? 'Bugün çalıştın ✅' : 'Bugün henüz çalışmadın'}</div></div>
      <div class="card"><div class="small muted">Tamamlanan ders</div><div class="big-num">${done.size}<span class="muted" style="font-size:1rem">/${lessons.length}</span></div><div class="small muted">Ortalama başarı: ${avg === null ? '—' : `%${avg}`}</div></div>
      <div class="card"><div class="small muted">Öğrenilen kelime</div><div class="big-num">${learned}</div><div class="small muted">${mastered} ustalaşıldı · tekrar doğruluğu ${answers.c + answers.w ? `%${Math.round(answers.c / (answers.c + answers.w) * 100)}` : '—'}</div></div>
    </div>
    <div class="dash">
      <div class="stack" style="gap:16px">
        <section class="card"><div class="card-title"><h3>Son 28 günün XP'si</h3><span class="small muted">Bugün ${g.xp.today} XP</span></div>
          <div class="chart" role="img" aria-label="Son 28 günün günlük XP grafiği">${g.days.map((d) => `<span class="${d.xp ? '' : 'zero'}" style="height:${Math.max(3, (d.xp / maxXp) * 130)}px" title="${d.day} (${dayName(d.day)}): ${d.xp} XP, ${d.lessons} ders, ${d.reviews} tekrar"></span>`).join('')}</div>
          <div class="row between tiny muted mt"><span>${g.days[0].day}</span><span>Bugün</span></div></section>
        <section class="card"><h3>Seviye ilerlemesi</h3>
          ${byLevel.map((b) => `<div class="row mb"><b style="width:36px">${b.lv}</b><div class="grow">${progressBar(b.done, b.total, b.done === b.total ? 'success' : '')}</div><span class="small muted">${b.done}/${b.total}</span></div>`).join('')}
          <div class="row"><b style="width:36px" class="muted">B1+</b><span class="small muted">İçerik hazırlanıyor</span></div></section>
        <section class="card"><h3>Son sonuçlar</h3>
          ${s.results.length ? `<div class="list">${s.results.slice(0, 8).map((r) => `<div class="list-item small"><span class="tag ${r.correct / r.total >= 0.6 ? 'success' : 'danger'}">%${Math.round(r.correct / r.total * 100)}</span><div class="grow"><b>${esc(refName(r))}</b><div class="muted">${kindLabel[r.kind] || r.kind} · ${r.correct}/${r.total} doğru · ${new Date(r.created_at).toLocaleDateString('tr-TR')}</div></div><span class="tag primary">+${r.xp} XP</span></div>`).join('')}</div>` : '<p class="muted" style="margin:0">Henüz test sonucu yok.</p>'}</section>
      </div>
      <div class="stack" style="gap:16px">
        <section class="card"><h3>Tekrar edilmesi gereken konular</h3>
          ${s.weakTopics.length ? s.weakTopics.map((w) => `<div class="row between small" style="padding:6px 0"><a href="${w.topic.match(/^(vocab|listening|reading)$/) ? '#/words' : `#/grammar/${w.topic}`}">${esc(topicLabel(w.topic))}</a><span class="tag warning">${w.n} hata</span></div>`).join('') : '<p class="small muted" style="margin:0">Son testlerinde öne çıkan zayıf konu yok.</p>'}</section>
        <section class="card"><h3>Haftalık hedef</h3><p class="small muted">Günlük hedefe (${s.user.dailyGoal} XP) ulaştığın gün sayısı.</p>
          ${progressBar(g.weekly.goalDays, g.weekly.target, g.weekly.done ? 'success' : 'accent')}<p class="small mt" style="margin-bottom:0"><b>${g.weekly.goalDays}/${g.weekly.target} gün</b> · ödül ${g.weekly.reward} XP ${g.weekly.rewarded ? '✅' : ''}</p></section>
        <section class="card"><h3>XP kuralları</h3><ul class="small muted points" style="margin:0">
          <li>Ders ilk geçişte: ${config.xpRules.lessonFirstBase} + doğru sayısı (en fazla ${config.xpRules.lessonFirstPerCorrectMax}) + hatasızsa ${config.xpRules.lessonPerfectBonus}</li>
          <li>Geçilmiş dersi tekrar: en fazla ${config.xpRules.lessonRepeatMax} XP, günde ${config.xpRules.lessonRepeatPerDay} kez</li>
          <li>Ünite testi ilk geçiş: ${config.xpRules.unitFirst} XP</li>
          <li>Vakti gelen kelime tekrarı: ${config.xpRules.reviewPerWord} XP (günde en fazla ${config.xpRules.reviewDailyCap})</li>
          <li>Konuşma senaryosu: ${config.xpRules.speakPerScenario} XP (senaryo başına günde bir kez)</li>
          <li>Günlük görev: ${config.xpRules.quest} XP · Haftalık hedef: ${config.xpRules.weekly} XP</li></ul></section>
      </div>
    </div>
    <h2 class="mt">Rozetler <span class="small muted">${earned.size}/${config.badges.length}</span></h2>
    <div class="badges">${config.badges.map((b) => `<div class="badge-card ${earned.has(b.id) ? '' : 'locked'}" title="${esc(b.desc)}"><div class="em" aria-hidden="true">${b.icon}</div><b>${esc(b.title)}</b><span>${earned.has(b.id) ? new Date(earned.get(b.id)).toLocaleDateString('tr-TR') : esc(b.desc)}</span></div>`).join('')}</div>
  </div>`;
  void icons;
}
