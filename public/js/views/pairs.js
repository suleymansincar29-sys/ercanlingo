// Telaffuz ayrımı (en küçük çiftler): dinlenen kelimeyi seçme. Sonuç gerçek cevaplara dayanır.
import { MINIMAL_PAIRS } from '/shared/content/speaking.js';
import { shuffle } from '/shared/curriculum.js';
import { api } from '../api.js';
import { refresh } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, $$, progressBar, celebrate } from '../ui.js';
import { speak, ttsSupported, stopSpeaking } from '../speech.js';

export const title = 'Telaffuz ayrımı';

export function render(el) {
  const rounds = shuffle(MINIMAL_PAIRS).map((p) => ({ ...p, target: Math.random() < 0.5 ? p.a : p.b }));
  let i = 0;
  let score = 0;
  let xp = 0;
  const frame = (inner) => `<div class="player"><div class="player-top"><a class="icon-btn" href="#/speak" aria-label="Kapat">${icons.close}</a><div class="grow">${progressBar(i, rounds.length)}</div><span class="chip">${Math.min(i + 1, rounds.length)} / ${rounds.length}</span></div><div class="player-body"><div class="player-inner">${inner}</div></div></div>`;
  if (!ttsSupported()) {
    el.innerHTML = frame('<div class="card empty"><div class="big">🔇</div><h2>Sesli okuma desteklenmiyor</h2><p>Bu alıştırma tarayıcının metin okuma özelliğini kullanır. Chrome, Edge veya Safari ile dene.</p><a class="btn btn-primary" href="#/speak">Geri dön</a></div>');
    return;
  }
  const ask = () => {
    const r = rounds[i];
    el.innerHTML = frame(`<div class="q-kind">Telaffuz ayrımı</div><div class="q-title center">Hangi kelimeyi duydun?</div>
      <div class="listen-row"><button class="listen-big" data-play aria-label="Dinle">${icons.volume}</button><button class="icon-btn" data-slow aria-label="Yavaş dinle">${icons.slow}</button></div>
      <div class="options cols">${[r.a, r.b].map((w) => `<button class="option" data-w="${esc(w)}" style="justify-content:center;font-size:1.3rem">${esc(w)}</button>`).join('')}</div>
      <div data-fb class="mt" aria-live="polite"></div>`);
    const play = (slow) => speak(r.target, { slow });
    $('[data-play]', el).addEventListener('click', () => play(false));
    $('[data-slow]', el).addEventListener('click', () => play(true));
    setTimeout(() => play(false), 300);
    $$('[data-w]', el).forEach((b) => b.addEventListener('click', async () => {
      const ok = b.dataset.w === r.target;
      if (ok) score++;
      $$('[data-w]', el).forEach((x) => { x.disabled = true; if (x.dataset.w === r.target) x.classList.add('correct'); else if (x === b) x.classList.add('wrong'); });
      $('[data-fb]', el).innerHTML = `<div class="card flat"><b>${ok ? '✅ Doğru!' : `❌ Duyduğun kelime "${esc(r.target)}" idi.`}</b><p class="small" style="margin:6px 0 10px">💡 ${esc(r.tip)}</p>
        <div class="row"><button class="btn btn-sm btn-secondary" data-say="${esc(r.a)}">${icons.volume} ${esc(r.a)}</button><button class="btn btn-sm btn-secondary" data-say="${esc(r.b)}">${icons.volume} ${esc(r.b)}</button><button class="btn btn-primary grow" data-next>${i === rounds.length - 1 ? 'Sonuçları gör' : 'Devam'}</button></div></div>`;
      el.querySelectorAll('[data-say]').forEach((x) => x.addEventListener('click', () => speak(x.dataset.say)));
      $('[data-next]', el).addEventListener('click', () => { i++; if (i < rounds.length) ask(); else finish(); });
      $('[data-next]', el).focus();
      try { const out = await api('/api/listening/answer', { method: 'POST', body: { pairId: r.id, correct: ok } }); xp += out.xp + (out.bonusXp || 0); celebrate(out); } catch { /* sonuç kaydı başarısız olsa da alıştırma sürer */ }
    }));
  };
  const finish = async () => {
    await refresh().catch(() => {});
    el.innerHTML = frame(`<div class="result"><div class="trophy">🎧</div><h1 style="margin:0">${score}/${rounds.length} doğru</h1>
      <div class="result-stats"><div class="stat xp"><b>+${xp}</b><span>XP</span></div><div class="stat acc"><b>%${Math.round((score / rounds.length) * 100)}</b><span>Doğru ayırt etme</span></div><div class="stat time"><b>${rounds.length}</b><span>Çift</span></div></div>
      <p class="small muted">Bu sonuç, sentezlenmiş sesleri doğru ayırt etme oranındır. Dinleme XP'si günde en fazla 10'dur.</p>
      <div class="row" style="justify-content:center"><a class="btn btn-secondary" href="#/pairs?r=${Date.now()}">${icons.refresh} Tekrar</a><a class="btn btn-primary" href="#/speak">Konuşma'ya dön</a></div></div>`);
  };
  ask();
  return () => stopSpeaking();
}
