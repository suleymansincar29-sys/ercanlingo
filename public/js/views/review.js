// Aralıklı tekrar oturumu: vakti gelen kelimeler, ya da seçilen bir liste için pratik.
import { buildWordExercise } from '/shared/curriculum.js';
import { api } from '../api.js';
import { store, refresh, dueWords, everyWord, findWord } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, toast, celebrate, relativeDue } from '../ui.js';
import { speak } from '../speech.js';
import { runPlayer } from '../player.js';

export const title = 'Kelime tekrarı';

// Seçilen kelimeler: ?ids=a,b,c veya ?list=<id> veya ?mode=flash
function params() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  return { ids: q.get('ids')?.split(',').filter(Boolean), list: q.get('list'), mode: q.get('mode') };
}

export function render(el) {
  const p = params();
  let words;
  let practice = false;
  if (p.ids) { words = p.ids.map(findWord).filter(Boolean); practice = true; }
  else if (p.list) { words = (store.state.lists.find((l) => String(l.id) === p.list)?.items || []).map(findWord).filter(Boolean); practice = true; }
  else words = dueWords();
  words = words.slice(0, 20);

  const shell = (inner) => `<div class="player"><div class="player-top"><a class="icon-btn" href="#/words" aria-label="Kapat">${icons.close}</a><b class="grow">${practice ? 'Kelime pratiği' : 'Aralıklı tekrar'}</b></div><div class="player-body"><div class="player-inner">${inner}</div></div></div>`;

  if (!words.length) {
    el.innerHTML = shell(`<div class="card empty"><div class="big">✨</div><h2>Şu an tekrar edilecek kelime yok</h2><p>Aralıklı tekrar sistemi kelimeleri unutmaya başlayacağın zamana göre planlar. Yeni kelimeler için ders tamamla veya kelime listelerinden pratik yap.</p><a class="btn btn-primary" href="#/words">Kelimelerime dön</a></div>`);
    return;
  }

  // Kartlarla tekrar: kullanıcı kendini değerlendirir (bilemedim / zor / iyi / kolay).
  if (p.mode === 'flash') {
    let i = 0;
    let reviewed = 0;
    let gained = 0;
    const show = () => {
      if (i >= words.length) return done(reviewed, gained);
      const w = words[i];
      el.innerHTML = shell(`<div class="stack"><div class="row between"><span class="small muted">${i + 1} / ${words.length}</span><span class="small muted">Kartı çevirmek için dokun</span></div>
        <div class="flashcard" data-card tabindex="0" role="button" aria-label="Kartı çevir"><div class="inner">
          <div class="face"><div><div class="big-num">${esc(w.en)}</div>${w.pron ? `<span class="pron">${esc(w.pron)}</span>` : ''}</div></div>
          <div class="face back"><div><div class="big-num">${esc(w.tr)}</div>${w.ex ? `<p class="mt">${esc(w.ex)}</p><p class="small muted">${esc(w.exTr || '')}</p>` : ''}</div></div></div></div>
        <div class="row" style="justify-content:center"><button class="btn btn-secondary btn-sm" data-say="${esc(w.en)}">${icons.volume} Dinle</button></div>
        <div class="grade-row hidden" data-grades>
          <button class="btn btn-danger" data-g="0">Bilemedim<small>10 dk</small></button>
          <button class="btn btn-secondary" data-g="1">Zor<small>yakında</small></button>
          <button class="btn btn-primary" data-g="2">İyi<small>normal</small></button>
          <button class="btn btn-success" data-g="3">Kolay<small>daha geç</small></button></div></div>`);
      const card = $('[data-card]', el);
      const flip = () => { card.classList.toggle('flipped'); $('[data-grades]', el).classList.remove('hidden'); };
      card.addEventListener('click', flip);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      $('[data-say]', el).addEventListener('click', () => speak(w.en));
      el.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', async () => {
        try {
          const r = await api('/api/words/review', { method: 'POST', body: { wordId: w.id, grade: Number(b.dataset.g) } });
          reviewed++; gained += r.xp + (r.bonusXp || 0);
          celebrate(r);
        } catch (err) { toast(err.message, 'error'); }
        i++; show();
      }));
      if (store.state.user.settings.autoplay) speak(w.en);
    };
    show();
    return;
  }

  // Alıştırma türleriyle tekrar.
  const pool = everyWord();
  const exercises = words.map((w) => buildWordExercise(w, Math.random, pool));
  let gained = 0;
  const stop = runPlayer(el, {
    exercises,
    exitConfirm: false,
    onExit: () => { refresh(); location.hash = '#/words'; },
    onAnswer: async (ex, correct) => {
      try {
        const r = await api('/api/words/review', { method: 'POST', body: { wordId: ex.wordId, grade: correct ? 2 : 0 } });
        gained += r.xp + (r.bonusXp || 0);
        celebrate(r);
      } catch (err) { toast(err.message, 'error'); }
    },
    onFinish: (res) => done(res.total, gained, res),
  });

  async function done(count, xp, res) {
    await refresh().catch(() => {});
    const next = Object.values(store.state.words).filter((w) => w.inSrs && w.dueAt).sort((a, b) => a.dueAt - b.dueAt)[0];
    el.innerHTML = shell(`<div class="result"><div class="trophy">🧠</div><h1 style="margin:0">Tekrar tamamlandı!</h1>
      <div class="result-stats"><div class="stat xp"><b>+${xp}</b><span>XP</span></div><div class="stat acc"><b>${res ? `%${Math.round((res.correct / res.total) * 100)}` : count}</b><span>${res ? 'Başarı' : 'Kart'}</span></div><div class="stat time"><b>${store.state.dueCount}</b><span>Kalan tekrar</span></div></div>
      <p class="small muted">${practice ? 'Serbest pratikte yalnızca tekrar vakti gelmiş kelimeler XP kazandırır.' : 'Doğru bildiğin kelimelerin bir sonraki tekrarı ileri bir tarihe planlandı, bilemediklerin yakında tekrar sorulacak.'} ${next ? `Sıradaki tekrar: ${relativeDue(next.dueAt)}.` : ''}</p>
      <div class="row" style="justify-content:center">${store.state.dueCount ? `<a class="btn btn-primary" href="#/review?r=${Date.now()}">Devam et</a>` : ''}<a class="btn btn-secondary" href="#/words">Kelimelerime dön</a></div></div>`);
  }
  return stop;
}
