// Ders ekranı: giriş (kelime + dil bilgisi + okuma), alıştırmalar, sonuç ve pratik.
import { getLesson, getUnit, buildLessonExercises, isLessonUnlocked, nextLesson, topicLabel, getWord } from '/shared/curriculum.js';
import { api } from '../api.js';
import { store, completedSet, setState } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, on, toast, confetti, celebrate, renderMarkdown } from '../ui.js';
import { speak } from '../speech.js';
import { runPlayer, wrongTopics, wrongWordIds } from '../player.js';
import { mountSpeak, speechNotice } from '../speakwidget.js';

export const title = (p) => getLesson(p.id)?.title || 'Ders';

export function grammarHtml(g) {
  return `<p>${esc(g.intro)}</p>
    <ul class="points">${g.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    ${g.table ? `<div class="table-wrap"><table class="grammar-table"><thead><tr>${g.table[0].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${g.table.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
    <h3 class="mt">Örnekler</h3>
    ${g.examples.map(([en, tr]) => `<div class="example"><button class="icon-btn" data-say="${esc(en)}" aria-label="Dinle">${icons.volume}</button><div><b>${esc(en)}</b><div class="small muted">${esc(tr)}</div></div></div>`).join('')}
    ${g.tip ? `<div class="tip mt">💡 ${esc(g.tip)}</div>` : ''}`;
}

export function wordCardHtml(w, state) {
  return `<div class="word-card">
    <button class="icon-btn" data-say="${esc(w.en)}" aria-label="Dinle: ${esc(w.en)}">${icons.volume}</button>
    <div class="grow"><div class="row" style="gap:8px"><span class="w">${esc(w.en)}</span><span class="pron">${esc(w.pron)}</span></div>
      <div><b>${esc(w.tr)}</b></div>
      <div class="small mt" style="margin-top:6px"><a href="#" data-say="${esc(w.ex)}" aria-label="Örnek cümleyi dinle">🔊</a> ${esc(w.ex)} <span class="muted">· ${esc(w.exTr)}</span></div></div>
    <button class="icon-btn ${state?.favorite ? 'active' : ''}" data-fav="${w.id}" aria-pressed="${Boolean(state?.favorite)}" aria-label="Favori">${state?.favorite ? icons.heartFill : icons.heart}</button>
  </div>`;
}

export async function render(el, { id }, { navigate }) {
  const lesson = getLesson(id);
  if (!lesson || lesson.planned) {
    el.innerHTML = `<div class="player"><div class="player-body"><div class="player-inner card empty"><div class="big">🛠️</div><h2>Bu ders henüz hazır değil</h2><p>İçeriği hazırlanıyor.</p><a class="btn btn-primary" href="#/learn">Öğren'e dön</a></div></div></div>`;
    return;
  }
  const unit = getUnit(lesson.unitId);
  const s = store.state;
  if (!isLessonUnlocked(lesson.id, completedSet(), s.user.level)) {
    el.innerHTML = `<div class="player"><div class="player-body"><div class="player-inner card empty"><div class="big">🔒</div><h2>Bu ders kilitli</h2><p>Önce bir önceki dersi en az %60 ile tamamla.</p><a class="btn btn-primary" href="#/learn">Öğren'e dön</a></div></div></div>`;
    return;
  }
  let stopPlayer = null;
  const words = lesson.wordIds.map(getWord);

  function intro() {
    el.innerHTML = `<div class="player">
      <div class="player-top"><a class="icon-btn" href="#/learn" aria-label="Kapat">${icons.close}</a><div class="grow"><div class="small muted">${lesson.level} · Ünite ${unit.index + 1}: ${esc(unit.title)}</div><b>${esc(lesson.title)}</b></div></div>
      <div class="player-body"><div class="player-inner stack" style="gap:18px">
        <div class="card hero"><span class="eyebrow">Ders ${lesson.index + 1} · ${esc(lesson.subtitle)}</span><h2 class="mt">${esc(lesson.title)}</h2><p class="muted" style="margin:0">🎯 ${esc(lesson.goal)}</p></div>
        <section class="card"><h2>📚 Yeni kelimeler</h2><div class="flash">${words.map((w) => wordCardHtml(w, store.state.words[w.id])).join('')}</div></section>
        <section class="card"><h2>✏️ ${esc(lesson.grammar.title)}</h2>${grammarHtml(lesson.grammar)}</section>
        <section class="card"><div class="row between"><h2 style="margin:0">📖 Okuma ve dinleme: ${esc(lesson.reading.title)}</h2><button class="btn btn-sm btn-secondary" data-say="${esc(lesson.reading.text.replace(/\n/g, ' '))}">${icons.volume} Dinle</button></div>
          <div class="reading mt">${esc(lesson.reading.text)}</div>
          <details class="mt"><summary class="small" style="cursor:pointer;font-weight:700">Türkçe çevirisini göster</summary><div class="reading muted mt">${esc(lesson.reading.tr)}</div></details></section>
      </div></div>
      <div class="player-foot"><div class="inner"><span class="muted small">15 soru · kelime, dil bilgisi, dinleme, okuma, çeviri</span><button class="btn btn-primary btn-lg" data-start>Alıştırmalara başla</button></div></div>
    </div>`;
    $('[data-start]', el).addEventListener('click', start);
  }

  function start() {
    const exercises = buildLessonExercises(lesson, Math.random());
    stopPlayer = runPlayer(el, {
      exercises,
      onExit: intro,
      onFinish: (res) => finish(res),
    });
  }

  async function finish(res) {
    stopPlayer?.();
    el.innerHTML = `<div class="player"><div class="player-body"><div class="player-inner result"><div class="skeleton" style="width:80px;height:80px;border-radius:50%"></div><p class="muted">Sonuçların kaydediliyor…</p></div></div></div>`;
    let out;
    try {
      out = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: lesson.id, correct: res.correct, total: res.total, wrongTopics: wrongTopics(res.results), wrongWordIds: wrongWordIds(res.results) } });
      setState(out.state);
    } catch (err) {
      el.innerHTML = `<div class="player"><div class="player-body"><div class="player-inner card empty"><div class="big">⚠️</div><h2>Sonuç kaydedilemedi</h2><p>${esc(err.message)}</p><div class="row"><button class="btn btn-primary" data-retry>Tekrar dene</button><a class="btn btn-ghost" href="#/learn">Çık</a></div></div></div></div>`;
      $('[data-retry]', el).addEventListener('click', () => finish(res));
      return;
    }
    results(res, out);
  }

  function results(res, out) {
    const pct = Math.round((res.correct / res.total) * 100);
    const topics = wrongTopics(res.results);
    const nxt = nextLesson(completedSet(), store.state.user.level);
    const wrong = res.results.filter((r) => !r.correct);
    if (out.passed) confetti(out.perfect ? 140 : 80);
    el.innerHTML = `<div class="player">
      <div class="player-body"><div class="player-inner result">
        <div class="trophy">${out.perfect ? '🏆' : out.passed ? '🎉' : '💪'}</div>
        <h1 style="margin:0">${out.perfect ? 'Kusursuz!' : out.passed ? 'Ders tamamlandı!' : 'Biraz daha pratik'}</h1>
        <p class="muted">${out.passed ? (out.firstCompletion ? `${out.newWords} yeni kelime tekrar listene eklendi.` : 'Tekrar çalışmak bilgini kalıcı hâle getirir.') : 'Dersi geçmek için en az %60 gerekiyor. Yanlışlarını gözden geçirip tekrar dene.'}</p>
        <div class="result-stats">
          <div class="stat xp"><b>+${out.xp + (out.bonusXp || 0)}</b><span>XP</span></div>
          <div class="stat acc"><b>%${pct}</b><span>Başarı</span></div>
          <div class="stat time"><b>${res.correct}/${res.total}</b><span>Doğru</span></div>
        </div>
        <p class="small muted" style="margin:0">${esc(out.reason)}${out.bonusXp ? ` Görev bonusu: +${out.bonusXp} XP.` : ''} Süre: ${Math.floor(res.seconds / 60)} dk ${res.seconds % 60} sn.</p>
        ${topics.length ? `<div class="card flat" style="width:100%;text-align:left"><h3>Tekrar etmen gereken konular</h3><div class="row">${topics.map((t) => `<span class="tag warning">${esc(topicLabel(t))}</span>`).join('')}</div>
          <details class="mt"><summary class="small" style="cursor:pointer;font-weight:700">Yanlış cevapları göster (${wrong.length})</summary>
          <div class="list mt">${wrong.map((r) => `<div class="list-item small"><span>❌</span><div class="grow"><b>${esc(r.ex.prompt || r.ex.sentence || r.ex.wrong || (r.ex.type === 'match' ? 'Kelime eşleştirme' : r.ex.audio || ''))}</b><div>Doğrusu: ${esc(r.ex.type === 'match' ? r.ex.pairs.map((p) => `${p.en} = ${p.tr}`).join(', ') : r.ex.answer)}</div>${r.ex.exp ? `<div class="muted">${esc(r.ex.exp)}</div>` : ''}</div></div>`).join('')}</div></details></div>` : ''}
        <div class="stack" style="width:100%;gap:10px">
          ${out.passed && nxt ? `<a class="btn btn-primary btn-lg btn-block" href="#/lesson/${nxt.id}">Sıradaki ders: ${esc(nxt.title)} ${icons.next}</a>` : ''}
          ${!out.passed ? `<button class="btn btn-primary btn-lg btn-block" data-again>${icons.refresh} Tekrar dene</button>` : ''}
          <button class="btn btn-secondary btn-block" data-practice>✍️ Yazma ve konuşma pratiği</button>
          ${out.passed ? `<button class="btn btn-ghost btn-block" data-again>${icons.refresh} Dersi tekrar çöz</button>` : ''}
          <a class="btn btn-ghost btn-block" href="#/learn">Öğren'e dön</a>
        </div>
      </div></div></div>`;
    celebrate(out);
    el.querySelectorAll('[data-again]').forEach((b) => b.addEventListener('click', start));
    $('[data-practice]', el).addEventListener('click', practice);
  }

  function practice() {
    const aiOn = store.state.ai.enabled;
    el.innerHTML = `<div class="player">
      <div class="player-top"><a class="icon-btn" href="#/learn" aria-label="Kapat">${icons.close}</a><b class="grow">Yazma ve konuşma pratiği</b></div>
      <div class="player-body"><div class="player-inner stack" style="gap:18px">
        <section class="card"><h2>✍️ Yazma</h2><p>${esc(lesson.write.prompt)}</p>
          <textarea class="input" data-writing maxlength="1500" placeholder="İngilizce yaz…" aria-label="Yazma alanı"></textarea>
          <div class="row mt">${aiOn ? '<button class="btn btn-primary" data-eval>AI öğretmene değerlendirt</button>' : ''}<button class="btn btn-secondary" data-model>Örnek cevabı göster</button></div>
          ${aiOn ? '' : '<p class="small muted mt">AI öğretmen şu anda kapalı (sunucuda API anahtarı yok). Metnini örnek cevapla kendin karşılaştırabilirsin.</p>'}
          <div data-feedback class="mt" aria-live="polite"></div></section>
        <section class="card"><h2>🎙️ Konuşma</h2>${speechNotice()}<p class="muted">Cümleyi dinle, sonra sesli söyle.</p>
          ${lesson.speak.map((_, i) => `<div data-speak="${i}" class="mb"></div>`).join('')}</section>
        <a class="btn btn-primary btn-lg" href="#/learn">Bitir</a>
      </div></div></div>`;
    lesson.speak.forEach(([en, tr], i) => mountSpeak($(`[data-speak="${i}"]`, el), { en, tr }));
    const fb = $('[data-feedback]', el);
    $('[data-model]', el).addEventListener('click', () => { fb.innerHTML = `<div class="tip"><b>Örnek cevap:</b> ${esc(lesson.write.model)}</div>`; });
    $('[data-eval]', el)?.addEventListener('click', async (e) => {
      const text = $('[data-writing]', el).value.trim();
      if (text.length < 3) return toast('Önce birkaç cümle yaz.');
      e.target.disabled = true;
      fb.innerHTML = '<p class="muted">AI öğretmen değerlendiriyor…</p>';
      try {
        const r = await api('/api/ai/chat', { method: 'POST', body: { mode: 'writing', text: `Görev: ${lesson.write.prompt}\n\nMetnim:\n${text}` } });
        fb.innerHTML = `<div class="msg assistant" style="max-width:100%">${renderMarkdown(r.reply)}</div>`;
        celebrate(r);
      } catch (err) { fb.innerHTML = `<div class="form-error">${esc(err.message)}</div>`; }
      e.target.disabled = false;
    });
  }

  on(el, 'click', '[data-say]', (e, b) => { e.preventDefault(); if (!b.closest('[role="application"]')) speak(b.dataset.say); });
  on(el, 'click', '[data-fav]', async (e, b) => {
    const fav = b.getAttribute('aria-pressed') !== 'true';
    try {
      await api('/api/words/favorite', { method: 'POST', body: { wordId: b.dataset.fav, favorite: fav } });
      b.setAttribute('aria-pressed', String(fav));
      b.classList.toggle('active', fav);
      b.innerHTML = fav ? icons.heartFill : icons.heart;
      const w = store.state.words[b.dataset.fav] || (store.state.words[b.dataset.fav] = {});
      w.favorite = fav;
    } catch (err) { toast(err.message, 'error'); }
  });
  intro();
  return () => stopPlayer?.();
}
