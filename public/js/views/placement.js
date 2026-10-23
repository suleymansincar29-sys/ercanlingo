// Seviye belirleme testi.
import { PLACEMENT } from '/shared/content/placement.js';
import { getLevel } from '/shared/curriculum.js';
import { api } from '../api.js';
import { store, refresh } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, $$, progressBar, toast, celebrate } from '../ui.js';

export const title = 'Seviye testi';

export function render(el, params, { navigate }) {
  const answers = [];
  let i = 0;
  const back = store.state.user.onboarded ? 'learn' : 'onboarding';
  const frame = (inner, prog = '') => `<div class="player"><div class="player-top"><a class="icon-btn" href="#/${back}" aria-label="Kapat">${icons.close}</a><div class="grow">${prog}</div></div><div class="player-body"><div class="player-inner">${inner}</div></div></div>`;

  const intro = () => {
    el.innerHTML = frame(`<div class="card result"><div class="trophy">🧭</div><h1 style="margin:0">Seviye belirleme testi</h1>
      <p class="muted">${PLACEMENT.length} soru, kolaydan zora. Bilmediğin soruda "Bilmiyorum" de; tahmin etmek sonucu yanıltır. Sonunda sana uygun başlangıç seviyesini önereceğiz.</p>
      <button class="btn btn-primary btn-lg" data-go>Başla</button></div>`);
    $('[data-go]', el).addEventListener('click', () => { i = 0; answers.length = 0; ask(); });
  };

  const ask = () => {
    const q = PLACEMENT[i];
    el.innerHTML = frame(`<div class="q-kind">Soru ${i + 1} / ${PLACEMENT.length}</div><div class="q-title">${esc(q.q)}</div>
      <div class="options">${q.options.map((o, k) => `<button class="option" data-k="${k}"><span class="key">${k + 1}</span>${esc(o)}</button>`).join('')}</div>
      <button class="btn btn-ghost mt" data-k="-1">Bilmiyorum</button>`, progressBar(i, PLACEMENT.length));
    $$('[data-k]', el).forEach((b) => b.addEventListener('click', () => {
      answers[i] = Number(b.dataset.k);
      if (++i < PLACEMENT.length) ask(); else finish();
    }));
  };

  const finish = async () => {
    try {
      const r = await api('/api/placement', { method: 'POST', body: { answers } });
      celebrate(r);
      const lv = getLevel(r.recommended);
      el.innerHTML = frame(`<div class="result"><div class="trophy">🎯</div><h1 style="margin:0">Önerilen seviye: ${r.recommended}</h1>
        <p class="muted">${esc(lv.title)} · ${r.correct}/${r.total} doğru</p>
        <div class="card flat" style="width:100%;text-align:left">${Object.entries(r.byLevel).map(([l, n]) => `<div class="row" style="margin-bottom:6px"><b style="width:36px">${l}</b><div class="grow">${progressBar(n, 4, n >= 3 ? 'success' : '')}</div><span class="small muted">${n}/4</span></div>`).join('')}</div>
        ${lv.planned ? `<div class="notice" style="text-align:left"><span class="ico">ℹ️</span><div>${r.recommended} içeriği henüz hazırlanıyor. Seviyeni ${r.recommended} olarak kaydedebilirsin; bu durumda A1 ve A2 dersleri tekrar için açık kalır.</div></div>` : ''}
        <div class="row" style="justify-content:center"><button class="btn btn-primary btn-lg" data-set>${r.recommended} seviyesiyle devam et</button><button class="btn btn-ghost" data-keep>Mevcut seviyemi koru (${store.state.user.level})</button></div></div>`);
      $('[data-set]', el).addEventListener('click', async () => {
        try { await api('/api/me', { method: 'PATCH', body: { level: r.recommended } }); await refresh(); toast(`Seviyen ${r.recommended} olarak ayarlandı`, 'success'); navigate(back); } catch (err) { toast(err.message, 'error'); }
      });
      $('[data-keep]', el).addEventListener('click', async () => { await refresh(); navigate(back); });
    } catch (err) {
      el.innerHTML = frame(`<div class="card empty"><div class="big">⚠️</div><h2>Sonuç alınamadı</h2><p>${esc(err.message)}</p><button class="btn btn-primary" data-retry>Tekrar dene</button></div>`);
      $('[data-retry]', el).addEventListener('click', finish);
    }
  };
  intro();
}
