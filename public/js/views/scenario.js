// Konuşma senaryosu: uygulama karşı tarafı seslendirir, kullanıcı kendi repliklerini söyler.
import { SCENARIOS } from '/shared/content/speaking.js';
import { api } from '../api.js';
import { refresh } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, toast, celebrate, confetti } from '../ui.js';
import { speak, stopSpeaking } from '../speech.js';
import { mountSpeak, speechNotice } from '../speakwidget.js';

export const title = (p) => SCENARIOS.find((s) => s.id === p.id)?.title || 'Senaryo';

export function render(el, { id }) {
  const sc = SCENARIOS.find((s) => s.id === id);
  const frame = (inner, foot = '') => `<div class="player"><div class="player-top"><a class="icon-btn" href="#/speak" aria-label="Kapat">${icons.close}</a><b class="grow">${sc ? `${sc.icon} ${esc(sc.title)}` : 'Senaryo'}</b></div>
    <div class="player-body"><div class="player-inner">${inner}</div></div>${foot ? `<div class="player-foot"><div class="inner">${foot}</div></div>` : ''}</div>`;
  if (!sc) { el.innerHTML = frame('<div class="card empty"><h2>Senaryo bulunamadı</h2><a class="btn btn-primary" href="#/speak">Geri dön</a></div>'); return; }

  let step = 0;
  let showTr = true;
  const draw = () => {
    const shown = sc.lines.slice(0, step + 1);
    const line = sc.lines[step];
    const isMe = line[0] === 'you';
    const last = step === sc.lines.length - 1;
    el.innerHTML = frame(`${speechNotice()}
      <p class="muted">${esc(sc.description)} Senin repliklerin sağda görünür.</p>
      <div class="row mb"><label class="row small" style="gap:8px;cursor:pointer"><span class="switch"><input type="checkbox" data-tr ${showTr ? 'checked' : ''}><span></span></span>Türkçe çeviriyi göster</label></div>
      <div class="dialog">${shown.map(([who, en, tr], i) => `<div class="bubble ${who === 'you' ? 'me' : ''}"><span class="who">${who === 'you' ? 'Sen' : 'Karşındaki'}</span>
        <span class="row" style="gap:6px;flex-wrap:nowrap"><button class="icon-btn" style="width:30px;height:30px" data-say="${esc(en)}" aria-label="Dinle">${icons.volume}</button><span>${esc(en)}</span></span>
        ${showTr ? `<span class="small muted" style="font-weight:500">${esc(tr)}</span>` : ''}${i === step && who === 'you' ? '' : ''}</div>`).join('')}</div>
      ${isMe ? '<div class="card"><h3>Senin sıran: bu cümleyi söyle</h3><div data-speak></div></div>' : ''}`,
    `<span class="small muted">${step + 1} / ${sc.lines.length}</span><button class="btn btn-primary btn-lg" data-next>${last ? 'Senaryoyu bitir' : isMe ? 'Söyledim, devam' : 'Devam'}</button>`);
    if (isMe) mountSpeak($('[data-speak]', el), { en: line[1], tr: showTr ? line[2] : '' });
    else speak(line[1]);
    $('[data-tr]', el).addEventListener('change', (e) => { showTr = e.target.checked; draw(); });
    el.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.say)));
    $('[data-next]', el).addEventListener('click', async (e) => {
      if (!last) { step++; draw(); $('.player-body', el).scrollTop = 1e6; return; }
      e.target.disabled = true;
      try {
        const r = await api('/api/speaking/complete', { method: 'POST', body: { scenarioId: sc.id } });
        await refresh();
        confetti(70);
        celebrate(r);
        el.innerHTML = frame(`<div class="result"><div class="trophy">🎙️</div><h1 style="margin:0">Senaryo tamamlandı!</h1>
          <div class="result-stats"><div class="stat xp"><b>+${r.xp + (r.bonusXp || 0)}</b><span>XP</span></div><div class="stat acc"><b>${sc.lines.filter((l) => l[0] === 'you').length}</b><span>Replik</span></div><div class="stat time"><b>${sc.level}</b><span>Seviye</span></div></div>
          <p class="small muted">${esc(r.reason)}</p>
          <div class="row" style="justify-content:center"><button class="btn btn-secondary" data-again>${icons.refresh} Tekrar oyna</button><a class="btn btn-primary" href="#/speak">Diğer senaryolar</a></div></div>`);
        $('[data-again]', el).addEventListener('click', () => { step = 0; draw(); });
      } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
    });
  };
  draw();
  return () => stopSpeaking();
}
