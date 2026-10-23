// Kelimelerim: tüm kelimeler, favoriler, tekrar durumu, kişisel listeler ve özel kelimeler.
import { api } from '../api.js';
import { store, refresh, everyWord, wordStatus, findWord } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, on, toast, modal, relativeDue, confirmDialog } from '../ui.js';
import { speak } from '../speech.js';

export const title = 'Kelimelerim';

const TABS = [['all', 'Tümü'], ['learned', 'Öğrendiklerim'], ['fav', 'Favoriler'], ['hard', 'Zorlandıklarım'], ['custom', 'Kendi kelimelerim'], ['lists', 'Listelerim']];

export function render(el) {
  let tab = 'all';
  let query = '';
  let level = '';

  const filtered = () => {
    const s = store.state;
    let list = tab === 'custom' ? s.customWords : everyWord();
    if (tab === 'learned') list = list.filter((w) => s.words[w.id]?.inSrs);
    if (tab === 'fav') list = list.filter((w) => s.words[w.id]?.favorite);
    if (tab === 'hard') list = list.filter((w) => { const p = s.words[w.id]; return p && (p.lapses > 0 || p.wrong > p.correct || (p.inSrs && p.ease < 2.3)); }).sort((a, b) => (s.words[a.id].ease - s.words[b.id].ease));
    if (level) list = list.filter((w) => (w.custom ? level === 'custom' : w.level === level));
    if (query) {
      const q = query.toLocaleLowerCase('tr');
      list = list.filter((w) => w.en.toLowerCase().includes(q) || w.tr.toLocaleLowerCase('tr').includes(q));
    }
    return list;
  };

  const wordRow = (w) => {
    const p = store.state.words[w.id];
    const st = wordStatus(w.id);
    return `<div class="list-item">
      <span class="srs-dot ${st.key}" title="${st.label}"></span>
      <button class="icon-btn" data-say="${esc(w.en)}" aria-label="Dinle: ${esc(w.en)}">${icons.volume}</button>
      <button class="word-main grow" style="background:none;border:0;text-align:left;cursor:pointer;padding:0" data-detail="${esc(w.id)}">
        <span><span class="w">${esc(w.en)}</span> ${w.pron ? `<span class="pron">${esc(w.pron)}</span>` : ''}</span>
        <span class="small">${esc(w.tr)}</span>
        <span class="tiny muted">${w.custom ? 'Kendi kelimen' : `${w.level} · ${esc(w.topic)}`} · ${st.label}${p?.inSrs ? ` · tekrar ${relativeDue(p.dueAt)}` : ''}</span>
      </button>
      <button class="icon-btn ${p?.favorite ? 'active' : ''}" data-fav="${esc(w.id)}" aria-pressed="${Boolean(p?.favorite)}" aria-label="Favori">${p?.favorite ? icons.heartFill : icons.heart}</button>
      <button class="icon-btn" data-addlist="${esc(w.id)}" aria-label="Listeye ekle" title="Listeye ekle">${icons.plus}</button>
    </div>`;
  };

  const listsHtml = () => {
    const lists = store.state.lists;
    return `<div class="row mb"><form class="row grow" data-newlist><input class="input grow" name="name" maxlength="40" placeholder="Yeni liste adı (ör. Seyahat kelimeleri)" aria-label="Yeni liste adı" required><button class="btn btn-primary" type="submit">${icons.plus} Oluştur</button></form></div>
      ${lists.length ? lists.map((l) => `<section class="card flat mb"><div class="card-title"><div><h3>${esc(l.name)}</h3><span class="small muted">${l.items.length} kelime</span></div>
        <div class="row"><a class="btn btn-sm btn-primary ${l.items.length ? '' : 'hidden'}" href="#/review?list=${l.id}">Pratik yap</a><button class="icon-btn" data-dellist="${l.id}" aria-label="Listeyi sil">${icons.trash}</button></div></div>
        ${l.items.length ? `<div class="list word-list">${l.items.map(findWord).filter(Boolean).map((w) => `<div class="list-item"><button class="icon-btn" data-say="${esc(w.en)}" aria-label="Dinle">${icons.volume}</button><div class="grow"><b>${esc(w.en)}</b> <span class="muted">· ${esc(w.tr)}</span></div><button class="btn btn-sm btn-ghost" data-rmitem="${l.id}|${esc(w.id)}">Çıkar</button></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Bu liste boş. Kelimelerin yanındaki + düğmesiyle ekleyebilirsin.</p>'}</section>`).join('') : '<div class="empty"><div class="big">🗂️</div><p>Henüz listen yok. Konulara göre kendi kelime listelerini oluştur.</p></div>'}`;
  };

  const draw = () => {
    const s = store.state;
    const learned = Object.values(s.words).filter((w) => w.inSrs).length;
    const mastered = Object.values(s.words).filter((w) => w.inSrs && w.interval >= 21).length;
    const favs = Object.values(s.words).filter((w) => w.favorite).length;
    const items = tab === 'lists' ? null : filtered();
    el.innerHTML = `<div class="page narrow">
      <div class="header"><div><h1>Kelimelerim</h1><p>Öğrendiğin kelimeler aralıklı tekrar sistemiyle planlanır; zorlandıkların daha sık karşına çıkar.</p></div>
        <button class="btn btn-secondary btn-sm" data-newword>${icons.plus} Kelime ekle</button></div>
      <div class="grid three mb">
        <div class="card"><div class="small muted">Tekrar bekleyen</div><div class="big-num">${s.dueCount}</div>
          <div class="row mt"><a class="btn btn-sm btn-accent ${s.dueCount ? '' : 'hidden'}" href="#/review">Alıştırmayla</a><a class="btn btn-sm btn-secondary ${s.dueCount ? '' : 'hidden'}" href="#/review?mode=flash">Kartlarla</a>${s.dueCount ? '' : '<span class="small muted">Şu an bekleyen yok ✨</span>'}</div></div>
        <div class="card"><div class="small muted">Öğrenilen</div><div class="big-num">${learned}</div><div class="small muted">${mastered} kelimede ustalaştın</div></div>
        <div class="card"><div class="small muted">Favoriler</div><div class="big-num">${favs}</div><div class="small muted">${s.customWords.length} kendi kelimen</div></div>
      </div>
      <div class="tabs" role="tablist">${TABS.map(([k, label]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'active' : ''}" data-tab="${k}">${label}</button>`).join('')}</div>
      ${tab === 'lists' ? listsHtml() : `
        <div class="row mb"><input class="input grow" type="search" data-q value="${esc(query)}" placeholder="İngilizce veya Türkçe ara…" aria-label="Kelime ara">
          <select class="input" style="width:auto" data-level aria-label="Seviye"><option value="">Tüm seviyeler</option><option ${level === 'A1' ? 'selected' : ''}>A1</option><option ${level === 'A2' ? 'selected' : ''}>A2</option><option value="custom" ${level === 'custom' ? 'selected' : ''}>Kendi kelimelerim</option></select></div>
        <div class="row small muted mb" style="gap:14px"><span class="row" style="gap:5px"><span class="srs-dot new"></span>Yeni</span><span class="row" style="gap:5px"><span class="srs-dot learning"></span>Öğreniliyor</span><span class="row" style="gap:5px"><span class="srs-dot known"></span>Biliniyor</span><span class="row" style="gap:5px"><span class="srs-dot mastered"></span>Ustalaşıldı</span></div>
        <section class="card" style="padding:8px 16px">${items.length ? `<div class="list word-list">${items.map(wordRow).join('')}</div>${items.length > 1 ? `<div class="row" style="padding:12px 0"><a class="btn btn-sm btn-secondary" href="#/review?ids=${items.slice(0, 20).map((w) => encodeURIComponent(w.id)).join(',')}">Bu kelimelerle pratik yap${items.length > 20 ? ' (ilk 20)' : ''}</a></div>` : ''}`
          : `<div class="empty"><div class="big">🔎</div><p>${{ learned: 'Ders tamamladıkça öğrendiğin kelimeler burada görünür.', fav: 'Kalp simgesine dokunarak kelimeleri favorilerine ekleyebilirsin.', hard: 'Zorlandığın kelime yok. Böyle devam!', custom: 'Kendi kelimelerini "Kelime ekle" ile oluşturabilirsin.' }[tab] || 'Aramana uygun kelime bulunamadı.'}</p></div>`}</section>`}
    </div>`;
    const q = $('[data-q]', el);
    if (q && query) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  };

  const act = async (fn, msg) => {
    try { await fn(); await refresh(); draw(); if (msg) toast(msg, 'success'); } catch (err) { toast(err.message, 'error'); }
  };

  on(el, 'click', '[data-tab]', (e, b) => { tab = b.dataset.tab; draw(); });
  on(el, 'input', '[data-q]', (e, i) => { query = i.value.trim(); draw(); });
  on(el, 'change', '[data-level]', (e, s) => { level = s.value; draw(); });
  on(el, 'click', '[data-say]', (e, b) => speak(b.dataset.say));
  on(el, 'click', '[data-fav]', (e, b) => {
    const fav = b.getAttribute('aria-pressed') !== 'true';
    act(() => api('/api/words/favorite', { method: 'POST', body: { wordId: b.dataset.fav, favorite: fav } }), fav ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
  });
  on(el, 'click', '[data-detail]', (e, b) => details(b.dataset.detail));
  on(el, 'click', '[data-addlist]', (e, b) => addToList(b.dataset.addlist));
  on(el, 'submit', '[data-newlist]', (e, f) => { e.preventDefault(); const name = new FormData(f).get('name'); act(() => api('/api/lists', { method: 'POST', body: { name } }), 'Liste oluşturuldu'); });
  on(el, 'click', '[data-dellist]', async (e, b) => { if (await confirmDialog('Liste silinsin mi?', 'Listedeki kelimeler silinmez, yalnızca liste kaldırılır.', { confirmText: 'Sil', danger: true })) act(() => api(`/api/lists/${b.dataset.dellist}`, { method: 'DELETE' }), 'Liste silindi'); });
  on(el, 'click', '[data-rmitem]', (e, b) => { const [lid, wid] = b.dataset.rmitem.split('|'); act(() => api(`/api/lists/${lid}/items`, { method: 'POST', body: { wordId: wid, add: false } })); });
  on(el, 'click', '[data-newword]', () => newWord());

  function details(id) {
    const w = findWord(id);
    const p = store.state.words[id];
    const st = wordStatus(id);
    modal(`<div class="row between"><div class="row"><h2 style="margin:0">${esc(w.en)}</h2>${w.pron ? `<span class="pron">${esc(w.pron)}</span>` : ''}</div><button class="icon-btn" data-close aria-label="Kapat">${icons.close}</button></div>
      <p class="mt"><b>${esc(w.tr)}</b></p>
      ${w.ex ? `<div class="example"><button class="icon-btn" data-msay="${esc(w.ex)}" aria-label="Dinle">${icons.volume}</button><div><b>${esc(w.ex)}</b><div class="small muted">${esc(w.exTr || '')}</div></div></div>` : ''}
      <div class="grid two mt"><div class="card flat"><div class="small muted">Durum</div><b>${st.label}</b></div><div class="card flat"><div class="small muted">Sonraki tekrar</div><b>${p?.inSrs ? relativeDue(p.dueAt) : 'Planlanmadı'}</b></div>
        <div class="card flat"><div class="small muted">Doğru / Yanlış</div><b>${p?.correct || 0} / ${p?.wrong || 0}</b></div><div class="card flat"><div class="small muted">Seviye · Konu</div><b>${w.custom ? 'Kendi kelimen' : `${w.level} · ${esc(w.topic)}`}</b></div></div>
      ${p?.history?.length ? `<p class="small muted mt">Son cevapların: ${p.history.slice(-10).map((h) => (h.g > 0 ? '✅' : '❌')).join(' ')}</p>` : ''}
      <div class="row mt">${p?.inSrs ? '<button class="btn btn-sm btn-ghost" data-srs="0">Tekrar listemden çıkar</button>' : '<button class="btn btn-sm btn-primary" data-srs="1">Tekrar listeme ekle</button>'}
        ${w.custom ? '<button class="btn btn-sm btn-danger" data-delcustom>Kelimeyi sil</button>' : ''}</div>`, {
      label: w.en,
      onMount: (m, close) => {
        m.addEventListener('click', (e) => { const s = e.target.closest('[data-msay]'); if (s) speak(s.dataset.msay); });
        m.querySelector('[data-srs]')?.addEventListener('click', (e) => { close(); act(() => api('/api/words/srs', { method: 'POST', body: { wordId: id, add: e.currentTarget.dataset.srs === '1' } }), 'Güncellendi'); });
        m.querySelector('[data-delcustom]')?.addEventListener('click', () => { close(); act(() => api(`/api/custom-words/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Kelime silindi'); });
      },
    });
  }

  function addToList(id) {
    const lists = store.state.lists;
    const w = findWord(id);
    modal(`<div class="row between"><h2 style="margin:0">"${esc(w.en)}" listeye ekle</h2><button class="icon-btn" data-close aria-label="Kapat">${icons.close}</button></div>
      ${lists.length ? `<div class="stack mt">${lists.map((l) => `<label class="setting" style="cursor:pointer"><span class="label"><b>${esc(l.name)}</b><span>${l.items.length} kelime</span></span><span class="switch"><input type="checkbox" data-list="${l.id}" ${l.items.includes(id) ? 'checked' : ''}><span></span></span></label>`).join('')}</div>` : '<p class="muted mt">Önce "Listelerim" sekmesinden bir liste oluştur.</p>'}
      <form class="row mt" data-quick><input class="input grow" name="name" maxlength="40" placeholder="Yeni liste adı" aria-label="Yeni liste adı" required><button class="btn btn-secondary" type="submit">Oluştur ve ekle</button></form>`, {
      label: 'Listeye ekle',
      onMount: (m, close) => {
        m.querySelectorAll('[data-list]').forEach((c) => c.addEventListener('change', async () => {
          try { await api(`/api/lists/${c.dataset.list}/items`, { method: 'POST', body: { wordId: id, add: c.checked } }); await refresh(); toast(c.checked ? 'Listeye eklendi' : 'Listeden çıkarıldı'); } catch (err) { toast(err.message, 'error'); c.checked = !c.checked; }
        }));
        m.querySelector('[data-quick]').addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            const { list } = await api('/api/lists', { method: 'POST', body: { name: new FormData(e.target).get('name') } });
            await api(`/api/lists/${list.id}/items`, { method: 'POST', body: { wordId: id } });
            await refresh(); close(); draw(); toast('Liste oluşturuldu ve kelime eklendi', 'success');
          } catch (err) { toast(err.message, 'error'); }
        });
      },
    });
  }

  function newWord() {
    modal(`<div class="row between"><h2 style="margin:0">Yeni kelime ekle</h2><button class="icon-btn" data-close aria-label="Kapat">${icons.close}</button></div>
      <form class="stack mt" data-form novalidate>
        <div class="field"><label for="nw-en">İngilizce</label><input class="input" id="nw-en" name="en" maxlength="60" required></div>
        <div class="field"><label for="nw-tr">Türkçe anlamı</label><input class="input" id="nw-tr" name="tr" maxlength="80" required></div>
        <div class="field"><label for="nw-ex">Örnek cümle (isteğe bağlı)</label><input class="input" id="nw-ex" name="ex" maxlength="200"></div>
        <div class="field"><label for="nw-extr">Örnek çevirisi (isteğe bağlı)</label><input class="input" id="nw-extr" name="exTr" maxlength="200"></div>
        <div class="form-error hidden" data-err role="alert"></div>
        <button class="btn btn-primary" type="submit">Ekle ve tekrar listeme koy</button></form>`, {
      label: 'Yeni kelime',
      onMount: (m, close) => {
        m.querySelector('[data-form]').addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.target));
          const err = m.querySelector('[data-err]');
          if (!data.en.trim() || !data.tr.trim()) { err.textContent = 'İngilizce kelime ve Türkçe anlamı zorunlu.'; err.classList.remove('hidden'); return; }
          try { await api('/api/custom-words', { method: 'POST', body: data }); await refresh(); close(); tab = 'custom'; draw(); toast('Kelime eklendi', 'success'); } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
        });
      },
    });
  }

  draw();
}
