// Ünite sonu testi.
import { getUnit, buildUnitTest, isUnitTestUnlocked, topicLabel, UNIT_PASS_RATIO, UNIT_TEST_SIZE } from '/shared/curriculum.js';
import { api } from '../api.js';
import { completedSet, setState } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, confetti, celebrate } from '../ui.js';
import { runPlayer, wrongTopics } from '../player.js';

export const title = 'Ünite testi';

export function render(el, { id }) {
  const unit = getUnit(id);
  const box = (inner) => `<div class="player"><div class="player-top"><a class="icon-btn" href="#/learn" aria-label="Kapat">${icons.close}</a></div><div class="player-body"><div class="player-inner">${inner}</div></div></div>`;
  if (!unit || unit.planned) { el.innerHTML = box('<div class="card empty"><div class="big">🛠️</div><h2>Bu ünite henüz hazır değil</h2></div>'); return; }
  if (!isUnitTestUnlocked(unit.id, completedSet())) {
    el.innerHTML = box(`<div class="card empty"><div class="big">🔒</div><h2>Ünite testi kilitli</h2><p>"${esc(unit.title)}" ünitesindeki tüm dersleri tamamlayınca açılır.</p><a class="btn btn-primary" href="#/learn">Öğren'e dön</a></div>`);
    return;
  }
  let stop = null;

  const intro = () => {
    el.innerHTML = box(`<div class="card result"><div class="trophy">🏁</div><h1 style="margin:0">${esc(unit.title)}: Ünite testi</h1>
      <p class="muted">${UNIT_TEST_SIZE} soru · Ünitedeki tüm derslerden karışık sorular. Geçmek için en az %${UNIT_PASS_RATIO * 100} doğru gerekir. İlk geçişte 40 XP kazanırsın.</p>
      <button class="btn btn-primary btn-lg" data-go>Teste başla</button></div>`);
    $('[data-go]', el).addEventListener('click', go);
  };

  const go = () => {
    stop = runPlayer(el, { exercises: buildUnitTest(unit, Math.random()), onExit: intro, onFinish: finish });
  };

  async function finish(res) {
    stop?.();
    try {
      const out = await api('/api/units/complete', { method: 'POST', body: { unitId: unit.id, correct: res.correct, total: res.total, wrongTopics: wrongTopics(res.results) } });
      setState(out.state);
      if (out.passed) confetti(120);
      const topics = wrongTopics(res.results);
      el.innerHTML = box(`<div class="result"><div class="trophy">${out.passed ? '🏅' : '📚'}</div>
        <h1 style="margin:0">${out.passed ? 'Testi geçtin!' : 'Bu sefer olmadı'}</h1>
        <div class="result-stats"><div class="stat xp"><b>+${out.xp + (out.bonusXp || 0)}</b><span>XP</span></div><div class="stat acc"><b>%${Math.round((res.correct / res.total) * 100)}</b><span>Başarı</span></div><div class="stat time"><b>${res.correct}/${res.total}</b><span>Doğru</span></div></div>
        <p class="small muted">${esc(out.reason)}</p>
        ${topics.length ? `<div class="card flat" style="width:100%;text-align:left"><h3>Tekrar edilmesi gereken konular</h3><div class="row">${topics.map((t) => `<span class="tag warning">${esc(topicLabel(t))}</span>`).join('')}</div></div>` : ''}
        <div class="row" style="justify-content:center"><button class="btn btn-secondary" data-again>${icons.refresh} Tekrar çöz</button><a class="btn btn-primary" href="#/learn">Öğren'e dön</a></div></div>`);
      $('[data-again]', el).addEventListener('click', go);
      celebrate(out);
    } catch (err) {
      el.innerHTML = box(`<div class="card empty"><div class="big">⚠️</div><h2>Sonuç kaydedilemedi</h2><p>${esc(err.message)}</p><a class="btn btn-primary" href="#/learn">Öğren'e dön</a></div>`);
    }
  }

  intro();
  return () => stop?.();
}
