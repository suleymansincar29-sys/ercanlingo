// AI Öğretmen: sunucu üzerinden Claude ile konuşma.
import { api } from '../api.js';
import { store, refresh } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, on, toast, renderMarkdown, celebrate, confirmDialog, loadingView } from '../ui.js';
import { speak, listen, sttSupported } from '../speech.js';

export const title = 'AI Öğretmen';

const MODES = [
  ['chat', '💬 Sohbet', 'İngilizce sohbet et; hatalarını nazikçe düzeltir.'],
  ['correct', '✅ Cümle düzelt', 'Cümleni yaz, düzeltip Türkçe açıklasın.'],
  ['grammar', '📘 Dil bilgisi anlat', 'Bir konuyu Türkçe ve örneklerle anlatsın.'],
  ['practice', '🧩 Alıştırma hazırla', 'Seviyene uygun mini alıştırma hazırlasın.'],
  ['writing', '📝 Metin değerlendir', 'Paragrafını değerlendirip geri bildirim versin.'],
  ['natural', '✨ Doğal ifade', 'Cümleni daha doğal hâle getirsin.'],
];
const STARTERS = {
  chat: ['Hi! Can we talk about my weekend?', 'Let\'s practice ordering food at a café.', 'Bana basit sorular sorar mısın?'],
  correct: ['I am go to school every day.', 'She don\'t like coffee.', 'Yesterday I have seen a good film.'],
  grammar: ['Present perfect ile past simple farkı ne?', '"a" ve "an" ne zaman kullanılır?', 'some ve any farkını anlatır mısın?'],
  practice: ['Bana geniş zaman alıştırması hazırla.', 'Yemek kelimeleriyle bir alıştırma yap.', 'Geçmiş zaman için 5 soru sor.'],
  writing: ['My name is Ali. I am live in Bursa. I like play football with my friends.'],
  natural: ['I want a coffee.', 'Give me the bill.', 'I am very happy for meet you.'],
};
const CATEGORY_TR = { 'to be': 'to be (am/is/are)', 'present simple': 'Geniş zaman', 'past simple': 'Geçmiş zaman', 'present perfect': 'Present perfect', future: 'Gelecek zaman', articles: 'Artikeller (a/an/the)', prepositions: 'Edatlar', plurals: 'Çoğul', 'word order': 'Kelime sırası', spelling: 'Yazım', vocabulary: 'Kelime seçimi', pronouns: 'Zamirler', modals: 'Modal fiiller', comparatives: 'Karşılaştırma', other: 'Diğer' };

export async function render(el) {
  el.innerHTML = loadingView('AI öğretmen yükleniyor');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let mode = MODES.some((m) => m[0] === params.get('mode')) ? params.get('mode') : 'chat';
  const prefill = params.get('q') || '';
  const { enabled, messages } = await api('/api/ai/history');
  const mistakes = store.state.mistakes.stats.filter((m) => m.source === 'ai');

  if (!enabled) {
    el.innerHTML = `<div class="page narrow">
      <div class="header"><div><h1>AI Öğretmen</h1><p>Kişisel İngilizce öğretmenin.</p></div></div>
      <div class="card pad-lg stack">
        <div class="row"><span style="font-size:2.4rem">🤖</span><div><h2 style="margin:0">AI öğretmen şu anda devre dışı</h2><p class="muted" style="margin:0">Bu sunucuda bir yapay zekâ servisi anahtarı tanımlı değil.</p></div></div>
        <p>AI öğretmen gerçek bir dil modeline (Anthropic Claude) güvenli şekilde, yalnızca sunucu üzerinden bağlanacak biçimde kodlandı. Etkinleştirmek için uygulamayı çalıştıran kişinin sunucu ortamına <code>ANTHROPIC_API_KEY</code> değişkenini eklemesi yeterli; anahtar hiçbir zaman tarayıcıya gönderilmez.</p>
        <p class="muted">Sahte cevaplar üretmemek için bu bölümde yapay bir sohbet göstermiyoruz. Bu sırada şunları kullanabilirsin:</p>
        <div class="grid two">
          <a class="card interactive" href="#/grammar" style="text-decoration:none;color:inherit"><b>📘 Dil Bilgisi</b><div class="small muted">Türkçe açıklamalar ve sesli örnekler</div></a>
          <a class="card interactive" href="#/speak" style="text-decoration:none;color:inherit"><b>🎙️ Konuşma</b><div class="small muted">Senaryolar ve telaffuz ayrımı</div></a>
          <a class="card interactive" href="#/words" style="text-decoration:none;color:inherit"><b>🔁 Kelime tekrarı</b><div class="small muted">Aralıklı tekrar sistemi</div></a>
          <a class="card interactive" href="#/learn" style="text-decoration:none;color:inherit"><b>📚 Dersler</b><div class="small muted">Yanlışlarda açıklamalı alıştırmalar</div></a>
        </div>
      </div></div>`;
    return;
  }

  el.innerHTML = `<div class="page">
    <div class="header"><div><h1>AI Öğretmen</h1><p>Sorularını Türkçe veya İngilizce sorabilirsin. Seviyen: <b>${store.state.user.level}</b></p></div>
      <button class="btn btn-ghost btn-sm" data-clear>${icons.trash} Sohbeti temizle</button></div>
    <div class="dash chat-layout">
      <section class="card chat">
        <div class="mode-chips" role="tablist" aria-label="Öğretmen modu">${MODES.map(([k, label, desc]) => `<button role="tab" aria-selected="${k === mode}" class="${k === mode ? 'active' : ''}" data-mode="${k}" title="${esc(desc)}">${label}</button>`).join('')}</div>
        <div class="chat-log" data-log aria-live="polite"></div>
        <form class="composer" data-form>
          ${sttSupported() ? `<button type="button" class="icon-btn" data-dictate aria-label="Sesle yaz (İngilizce)">${icons.speak}</button>` : ''}
          <textarea class="input grow" name="text" rows="1" maxlength="3000" placeholder="Mesajını yaz… (Enter gönderir, Shift+Enter yeni satır)" aria-label="Mesaj"></textarea>
          <button class="btn btn-primary" type="submit" aria-label="Gönder">${icons.send}</button>
        </form>
      </section>
      <aside class="stack">
        <section class="card"><h3>Sık yaptığın hatalar</h3>
          ${mistakes.length ? mistakes.slice(0, 6).map((m) => `<div class="row between small" style="padding:4px 0"><span>${esc(CATEGORY_TR[m.category] || m.category)}</span><span class="tag danger">${m.n}</span></div>`).join('') : '<p class="small muted" style="margin:0">Öğretmen, İngilizce mesajlarındaki hataları burada kategorilere ayırarak takip eder.</p>'}
          ${store.state.mistakes.recent.length ? `<details class="mt"><summary class="small" style="cursor:pointer;font-weight:700">Son düzeltmeler</summary>${store.state.mistakes.recent.map((m) => `<div class="small" style="padding:6px 0;border-bottom:1px dashed var(--border)"><s class="muted">${esc(m.wrong)}</s> → <b>${esc(m.right)}</b></div>`).join('')}</details>` : ''}
        </section>
        <section class="card small muted">Cevaplar yapay zekâ tarafından üretilir ve zaman zaman hatalı olabilir. Önemli konularda ders içeriğiyle karşılaştır.</section>
      </aside>
    </div></div>`;

  const log = $('[data-log]', el);
  const form = $('[data-form]', el);
  const input = form.elements.text;
  const msgHtml = (m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? renderMarkdown(m.content) : esc(m.content).replace(/\n/g, '<br>')}
    ${m.role === 'assistant' ? `<div class="row" style="margin-top:6px"><button class="btn btn-sm btn-ghost" data-read="${esc(m.content.replace(/[*`#]/g, ''))}" aria-label="Sesli oku">${icons.volume} Dinle</button></div>` : ''}
    ${m.mistakes?.length ? `<div>${m.mistakes.map((x) => `<span class="mistake-pill">${esc(CATEGORY_TR[x.category] || x.category)}</span>`).join('')}</div>` : ''}</div>`;
  const starters = () => `<div class="empty" data-starters><div class="big">👩‍🏫</div><p>Merhaba ${esc(store.state.user.name)}! Ben senin İngilizce öğretmeninim. Bir mod seç ve başla:</p>
    <div class="stack" style="width:100%;max-width:420px">${STARTERS[mode].map((t) => `<button class="option" data-starter="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
  const drawLog = () => {
    log.innerHTML = messages.length ? messages.map(msgHtml).join('') : starters();
    log.scrollTop = log.scrollHeight;
  };
  drawLog();
  if (prefill) { input.value = prefill; input.focus(); }

  let busy = false;
  async function send(text) {
    if (busy || !text.trim()) return;
    busy = true;
    $('[data-starters]', log)?.remove();
    messages.push({ role: 'user', content: text });
    log.insertAdjacentHTML('beforeend', msgHtml({ role: 'user', content: text }) + '<div class="msg assistant typing" data-typing aria-label="Yazıyor"><i></i><i></i><i></i></div>');
    log.scrollTop = log.scrollHeight;
    input.value = '';
    try {
      const r = await api('/api/ai/chat', { method: 'POST', body: { mode, text } });
      const m = { role: 'assistant', content: r.reply, mistakes: r.mistakes };
      messages.push(m);
      $('[data-typing]', log)?.remove();
      log.insertAdjacentHTML('beforeend', msgHtml(m));
      celebrate(r);
      refresh().catch(() => {});
    } catch (err) {
      $('[data-typing]', log)?.remove();
      messages.pop();
      log.insertAdjacentHTML('beforeend', `<div class="form-error">${esc(err.message)}</div>`);
      input.value = text;
    }
    log.scrollTop = log.scrollHeight;
    busy = false;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  on(el, 'click', '[data-mode]', (e, b) => {
    mode = b.dataset.mode;
    el.querySelectorAll('[data-mode]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); });
    if (!messages.length) drawLog();
    input.placeholder = MODES.find((m) => m[0] === mode)[2];
  });
  on(el, 'click', '[data-starter]', (e, b) => send(b.dataset.starter));
  on(el, 'click', '[data-read]', (e, b) => speak(b.dataset.read));
  on(el, 'click', '[data-dictate]', async (e, b) => {
    b.classList.add('speaking');
    try { const alts = await listen(); input.value = `${input.value} ${alts[0].transcript}`.trim(); input.focus(); } catch (err) { toast(err.message, 'error'); }
    b.classList.remove('speaking');
  });
  on(el, 'click', '[data-clear]', async () => {
    if (!(await confirmDialog('Sohbet temizlensin mi?', 'Öğretmenle olan tüm mesajların silinir.', { confirmText: 'Temizle', danger: true }))) return;
    try { await api('/api/ai/history', { method: 'DELETE' }); messages.length = 0; drawLog(); } catch (err) { toast(err.message, 'error'); }
  });
}
