// Etkileşimli alıştırma oynatıcısı: ders, ünite testi ve kelime tekrarında ortak kullanılır.
import { checkTyped, normalize } from '/shared/text.js';
import { esc, $, $$, progressBar, confirmDialog } from './ui.js';
import { icons } from './icons.js';
import { speak, ttsSupported } from './speech.js';
import { settings } from './store.js';

const PRAISE = ['Harika!', 'Mükemmel!', 'Çok iyi!', 'Süper!', 'Aynen böyle!', 'Bravo!', 'Tam isabet!'];
const KIND_LABEL = {
  match: 'Kelime eşleştirme', mc: 'Çoktan seçmeli', fill: 'Boşluk doldurma', listen: 'Dinleyerek cevapla', 'listen-tr': 'Dinlediğini anla',
  en2tr: 'İngilizceden Türkçeye', dlg: 'Diyalog tamamlama', read: 'Okuduğunu anla', build: 'Cümle oluştur', type: 'Kelimeyi yaz',
  tr2en: 'Türkçeden İngilizceye', fix: 'Hatalı cümleyi düzelt', gap: 'Boşluk doldurma',
};

const audioBtns = (text) => ttsSupported()
  ? `<div class="listen-row"><button class="listen-big" data-say="${esc(text)}" aria-label="Dinle">${icons.volume}</button>
     <button class="icon-btn" data-say="${esc(text)}" data-slow="1" aria-label="Yavaş dinle" title="Yavaş dinle">${icons.slow}</button></div>`
  : '<div class="notice mb"><span class="ico">🔇</span><div>Bu tarayıcı sesli okumayı desteklemiyor. Metni görmek için "Cevabı göster"e basabilirsin.</div></div>';

const sayBtn = (text) => (ttsSupported() ? `<button class="icon-btn" data-say="${esc(text)}" aria-label="Dinle: ${esc(text)}">${icons.volume}</button>` : '');

function optionsHtml(options, cols = false) {
  return `<div class="options ${cols ? 'cols' : ''}" role="radiogroup">${options.map((o, i) => `<button class="option" role="radio" aria-checked="false" data-opt="${esc(o)}"><span class="key">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
}

// Her alıştırma türü: görünüm + etkileşim + kontrol.
const RENDER = {
  mc: (ex) => `<div class="q-title">${esc(ex.prompt)}</div>${ex.audio ? `<div class="row mb">${sayBtn(ex.audio)}<span class="muted small">Telaffuzu dinle</span></div>` : ''}${optionsHtml(ex.options)}`,
  fill: (ex) => `<div class="q-title">Boşluğu doldur</div><div class="q-sentence">${esc(ex.sentence).replace('___', '<span class="blank" data-blank>?</span>')}</div>${optionsHtml(ex.options, true)}`,
  listen: (ex) => `<div class="q-title center">Duyduğun kelimeyi seç</div>${audioBtns(ex.audio)}${optionsHtml(ex.options, true)}`,
  'listen-tr': (ex) => `<div class="q-title center">Duyduğun cümlenin anlamı ne?</div>${audioBtns(ex.audio)}${optionsHtml(ex.options)}`,
  en2tr: (ex) => `<div class="q-title">Bu cümlenin Türkçesi hangisi?</div><div class="q-sentence">${sayBtn(ex.sentence)}<span>${esc(ex.sentence)}</span></div>${optionsHtml(ex.options)}`,
  dlg: (ex) => `<div class="q-title">Diyaloğu tamamla</div><div class="dialog">${ex.lines.map(([who, text]) => `<div class="bubble ${who === 'B' ? 'me' : ''}"><span class="who">${who === 'B' ? 'Sen' : 'Karşındaki'}</span>${esc(text).replace('___', '<span class="blank" data-blank>?</span>')}</div>`).join('')}</div>${optionsHtml(ex.options)}`,
  read: (ex) => `<div class="q-title">${esc(ex.prompt)}</div><div class="card flat mb"><div class="row between"><h3 style="margin:0">${esc(ex.title)}</h3>${sayBtn(ex.text.replace(/\n/g, ' '))}</div><div class="reading">${esc(ex.text)}</div></div>${optionsHtml(ex.options)}`,
  build: (ex) => `<div class="q-title">Cümleyi oluştur</div><div class="q-sentence">${esc(ex.prompt)}</div><div class="answer-area" data-area aria-label="Cevabın" aria-live="polite"></div><div class="tiles">${ex.tiles.map((t, i) => `<button class="tile" data-tile="${i}">${esc(t)}</button>`).join('')}</div>`,
  type: (ex) => `<div class="q-title">İngilizcesini yaz</div><div class="q-sentence">${esc(ex.prompt)}</div><input class="input" data-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="İngilizce yaz…" aria-label="Cevabın">${ex.hint ? `<p class="small muted mt">İpucu: telaffuzu <span class="pron">${esc(ex.hint)}</span></p>` : ''}`,
  gap: (ex) => `<div class="q-title">Boşluğa uygun kelimeyi yaz</div><div class="q-sentence">${esc(ex.sentence).replace('___', '<span class="blank">?</span>')}</div><p class="muted">${esc(ex.translation)}</p><input class="input" data-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Kelimeyi yaz…" aria-label="Cevabın">`,
  tr2en: (ex) => `<div class="q-title">İngilizceye çevir</div><div class="q-sentence">${esc(ex.prompt)}</div><textarea class="input" data-input rows="2" autocapitalize="sentences" spellcheck="false" placeholder="İngilizce çevirini yaz…" aria-label="Çevirin"></textarea>`,
  fix: (ex) => `<div class="q-title">Hatalı cümleyi düzelt</div><div class="q-sentence" style="color:var(--danger)">${esc(ex.wrong)}</div><textarea class="input" data-input rows="2" spellcheck="false" placeholder="Doğru cümleyi yaz…" aria-label="Düzeltilmiş cümle">${esc(ex.wrong.replace(/\s*\(.*?\)\s*/g, ' ').trim())}</textarea>`,
  match: (ex) => {
    const right = [...ex.pairs].sort(() => Math.random() - 0.5);
    return `<div class="q-title">Eşleşen çiftleri seç</div><div class="match">
      <div class="options">${ex.pairs.map((p) => `<button class="option" data-left="${esc(p.id)}">${esc(p.en)}</button>`).join('')}</div>
      <div class="options">${right.map((p) => `<button class="option" data-right="${esc(p.id)}">${esc(p.tr)}</button>`).join('')}</div></div>`;
  },
};

function check(ex, answer) {
  if (['tr2en', 'fix', 'type', 'gap'].includes(ex.type)) return checkTyped(answer, ex.accepted);
  if (ex.type === 'build') return { correct: normalize(answer) === normalize(ex.answer) };
  if (ex.type === 'match') return { correct: answer === 0 };
  return { correct: answer === ex.answer };
}

/**
 * Oynatıcıyı başlatır.
 * @param target Kapsayıcı öğe
 * @param opts { title, exercises, onExit, onFinish(results) }
 */
export function runPlayer(target, { exercises, onExit, onFinish, onAnswer, exitConfirm = true }) {
  let index = 0;
  let answer = null;
  let checked = false;
  const results = [];
  const started = Date.now();

  target.innerHTML = `<div class="player" role="application" aria-label="Alıştırma">
    <div class="player-top">
      <button class="icon-btn" data-exit aria-label="Çık">${icons.close}</button>
      <div class="grow" data-progress></div>
      <span class="chip" data-counter></span>
    </div>
    <div class="player-body"><div class="player-inner" data-q></div></div>
    <div class="player-foot" data-foot><div class="inner">
      <div class="feedback" data-feedback aria-live="assertive"></div>
      <div class="row"><button class="btn btn-ghost" data-skip>Bilmiyorum</button><button class="btn btn-primary btn-lg" data-check disabled>Kontrol et</button></div>
    </div></div>
  </div>`;
  const root = target.firstElementChild;
  const q = $('[data-q]', root);
  const foot = $('[data-foot]', root);
  const btn = $('[data-check]', root);
  const skip = $('[data-skip]', root);
  const fb = $('[data-feedback]', root);

  const setReady = (val) => { answer = val; btn.disabled = val === null || val === ''; };

  function show() {
    const ex = exercises[index];
    if (window.__EL_TEST__) window.__elEx = ex;
    checked = false;
    answer = null;
    foot.className = 'player-foot';
    fb.innerHTML = '';
    btn.textContent = 'Kontrol et';
    btn.className = 'btn btn-primary btn-lg';
    btn.disabled = true;
    skip.classList.toggle('hidden', ex.type === 'match');
    $('[data-progress]', root).innerHTML = progressBar(index, exercises.length);
    $('[data-counter]', root).textContent = `${index + 1} / ${exercises.length}`;
    q.innerHTML = `<div class="q-kind">${KIND_LABEL[ex.type] || ''}</div>${RENDER[ex.type](ex)}`;
    q.style.animation = 'none'; void q.offsetWidth; q.style.animation = '';
    mount(ex);
    const auto = ex.type === 'listen' || ex.type === 'listen-tr';
    if (auto && settings().autoplay !== false) setTimeout(() => speak(ex.audio), 350);
    $('.player-body', root).scrollTop = 0;
  }

  function mount(ex) {
    const opts = $$('[data-opt]', q);
    opts.forEach((o) => o.addEventListener('click', () => {
      if (checked) return;
      opts.forEach((x) => { x.classList.remove('selected'); x.setAttribute('aria-checked', 'false'); });
      o.classList.add('selected');
      o.setAttribute('aria-checked', 'true');
      $$('[data-blank]', q).forEach((b) => { b.textContent = o.dataset.opt; });
      setReady(o.dataset.opt);
    }));
    const input = $('[data-input]', q);
    if (input) {
      input.addEventListener('input', () => setReady(input.value.trim() || null));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!btn.disabled) btn.click(); } });
      if (input.value.trim()) setReady(input.value.trim());
      setTimeout(() => input.focus(), 50);
    }
    if (ex.type === 'build') {
      const area = $('[data-area]', q);
      const picked = [];
      const sync = () => {
        area.innerHTML = picked.map((i, pos) => `<button class="tile" data-pos="${pos}">${esc(ex.tiles[i])}</button>`).join('');
        $$('[data-tile]', q).forEach((t) => t.classList.toggle('used', picked.includes(Number(t.dataset.tile))));
        setReady(picked.length ? picked.map((i) => ex.tiles[i]).join(' ') : null);
      };
      $$('[data-tile]', q).forEach((t) => t.addEventListener('click', () => { if (!checked && !picked.includes(Number(t.dataset.tile))) { picked.push(Number(t.dataset.tile)); sync(); } }));
      area.addEventListener('click', (e) => { const t = e.target.closest('[data-pos]'); if (t && !checked) { picked.splice(Number(t.dataset.pos), 1); sync(); } });
    }
    if (ex.type === 'match') {
      let left = null;
      let wrong = 0;
      let matched = 0;
      const pick = (el, side) => {
        if (el.classList.contains('matched')) return;
        if (side === 'left') {
          $$('[data-left]', q).forEach((x) => x.classList.remove('selected'));
          el.classList.add('selected');
          left = el;
          if (settings().sound !== false) speak(ex.pairs.find((p) => p.id === el.dataset.left).en);
          return;
        }
        if (!left) { el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 400); return; }
        if (left.dataset.left === el.dataset.right) {
          left.classList.remove('selected');
          left.classList.add('correct', 'matched'); el.classList.add('correct', 'matched');
          left.disabled = true; el.disabled = true;
          left = null;
          if (++matched === ex.pairs.length) { setReady(wrong); setTimeout(() => btn.click(), 300); }
        } else {
          wrong++;
          el.classList.add('wrong'); left.classList.add('wrong');
          const l = left;
          setTimeout(() => { el.classList.remove('wrong'); l.classList.remove('wrong'); }, 450);
        }
      };
      $$('[data-left]', q).forEach((el) => el.addEventListener('click', () => pick(el, 'left')));
      $$('[data-right]', q).forEach((el) => el.addEventListener('click', () => pick(el, 'right')));
    }
  }

  function doCheck(skipped = false) {
    const ex = exercises[index];
    const r = skipped ? { correct: false } : check(ex, answer);
    checked = true;
    results.push({ ex, correct: r.correct, answer: skipped ? null : answer });
    onAnswer?.(ex, r.correct);
    $$('[data-opt]', q).forEach((o) => {
      o.disabled = true;
      if (o.dataset.opt === ex.answer) o.classList.add('correct');
      else if (o.classList.contains('selected')) o.classList.add('wrong');
    });
    $$('[data-input]', q).forEach((i) => { i.readOnly = true; });
    foot.className = `player-foot ${r.correct ? 'correct' : 'wrong'}`;
    const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    let body = '';
    if (r.correct) {
      body = r.typo ? `Küçük bir yazım hatası var. Doğrusu: <b>${esc(r.expected)}</b>` : ex.type === 'match' ? 'Bütün çiftleri hatasız eşleştirdin.' : esc(ex.exp || '');
    } else {
      const right = ex.type === 'match' ? '' : `Doğru cevap: <b>${esc(ex.answer)}</b><br>`;
      body = `${right}${esc(ex.exp || '')}${ex.type === 'match' ? 'Bazı eşleştirmelerde hata yaptın; bu kelimeleri tekrar listende göreceksin.' : ''}`;
    }
    fb.innerHTML = `<div class="badge">${r.correct ? icons.check : icons.x}</div><div><h3>${r.correct ? praise : 'Doğru cevap bu değil'}</h3><p>${body}</p></div>`;
    skip.classList.add('hidden');
    btn.disabled = false;
    btn.textContent = index === exercises.length - 1 ? 'Bitir' : 'Devam et';
    btn.className = `btn btn-lg ${r.correct ? 'btn-success' : 'btn-danger'}`;
    btn.focus();
  }

  function next() {
    if (index < exercises.length - 1) { index++; show(); return; }
    const correct = results.filter((r) => r.correct).length;
    onFinish({ results, correct, total: exercises.length, seconds: Math.round((Date.now() - started) / 1000) });
  }

  btn.addEventListener('click', () => (checked ? next() : doCheck()));
  skip.addEventListener('click', () => { if (!checked) doCheck(true); });
  root.addEventListener('click', (e) => {
    const s = e.target.closest('[data-say]');
    if (s) speak(s.dataset.say, { slow: Boolean(s.dataset.slow) });
  });
  $('[data-exit]', root).addEventListener('click', async () => {
    if (!exitConfirm || !results.length || await confirmDialog('Dersten çıkılsın mı?', 'Bu denemedeki ilerlemen kaydedilmeyecek.', { confirmText: 'Çık', danger: true })) onExit();
  });
  const onKey = (e) => {
    if (!root.isConnected) return document.removeEventListener('keydown', onKey);
    if (e.target.matches('input, textarea') && e.key !== 'Enter') return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && !checked) $$('[data-opt]', q)[n - 1]?.click();
    if (e.key === 'Enter' && !e.target.matches('input, textarea, button') && !btn.disabled) btn.click();
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => document.removeEventListener('keydown', onKey);
}

// Sonuçlardan tekrar edilmesi gereken konuları çıkarır.
export function wrongTopics(results) {
  return [...new Set(results.filter((r) => !r.correct).map((r) => r.ex.topic).filter(Boolean))];
}
export function wrongWordIds(results) {
  const ids = new Set();
  for (const r of results.filter((x) => !x.correct)) {
    if (r.ex.wordId) ids.add(r.ex.wordId);
    if (r.ex.type === 'match') r.ex.pairs.forEach((p) => ids.add(p.id));
  }
  return [...ids];
}
