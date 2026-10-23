// Konuşma pratiği bileşeni: dinle, söyle (konuşma tanıma), kendi sesini kaydet.
import { wordMatch } from '/shared/text.js';
import { esc, $ } from './ui.js';
import { icons } from './icons.js';
import { speak, listen, sttSupported, recorderSupported, startRecording, ttsSupported } from './speech.js';

export const speechNotice = () => (sttSupported()
  ? ''
  : `<div class="notice mb"><span class="ico">🎤</span><div><b>Konuşma tanıma bu tarayıcıda desteklenmiyor.</b> Cümleleri dinleyip sesli tekrar edebilir ve kendi sesini kaydedip karşılaştırabilirsin. Konuşmanın metne çevrilmesi için Chrome veya Edge kullan.</div></div>`);

/**
 * @param host Kapsayıcı
 * @param target { en, tr }
 * @param onResult (ratio) => void  Konuşma tanıma sonucu geldiğinde
 */
export function mountSpeak(host, target, { onResult } = {}) {
  host.innerHTML = `<div class="stack" style="gap:14px">
    <div class="q-sentence" style="margin:0">${ttsSupported() ? `<button class="icon-btn" data-play aria-label="Dinle">${icons.volume}</button><button class="icon-btn" data-play-slow aria-label="Yavaş dinle">${icons.slow}</button>` : ''}<div><div>${esc(target.en)}</div><div class="small muted" style="font-weight:500">${esc(target.tr || '')}</div></div></div>
    <div class="row" style="justify-content:center;gap:18px">
      <div class="center"><button class="mic" data-mic ${sttSupported() ? '' : 'disabled'} aria-label="Söyle ve metne çevir">${icons.speak}</button><div class="small muted mt">Söyle</div></div>
      ${recorderSupported() ? `<div class="center"><button class="listen-big" style="width:84px;height:84px;margin:0;border-radius:50%" data-rec aria-label="Sesimi kaydet">${icons.headphones}</button><div class="small muted mt" data-rec-label>Kaydet</div></div>` : ''}
    </div>
    <div data-out aria-live="polite"></div>
    <audio data-audio class="hidden" controls></audio>
  </div>`;
  const out = $('[data-out]', host);
  $('[data-play]', host)?.addEventListener('click', () => speak(target.en));
  $('[data-play-slow]', host)?.addEventListener('click', () => speak(target.en, { slow: true }));

  const mic = $('[data-mic]', host);
  mic?.addEventListener('click', async () => {
    mic.classList.add('recording');
    out.innerHTML = '<p class="center muted">Dinliyorum… cümleyi şimdi söyle.</p>';
    try {
      const alts = await listen();
      // Tarayıcının verdiği alternatiflerden hedefe en yakın olanı seçilir.
      const best = alts.map((a) => ({ ...a, m: wordMatch(a.transcript, target.en) })).sort((a, b) => b.m.ratio - a.m.ratio)[0];
      const pct = Math.round(best.m.ratio * 100);
      out.innerHTML = `<div class="card flat">
        <div class="small muted">Tarayıcının duyduğu:</div><p class="heard" style="font-size:1.1rem">"${esc(best.transcript)}"</p>
        <div class="small muted">Hedef cümledeki kelimeler:</div>
        <p class="heard">${best.m.words.map((w) => `<span class="${w.ok ? 'ok' : 'miss'}">${esc(w.word)}</span>`).join(' ')}</p>
        <p class="small" style="margin:0"><b>Kelime eşleşmesi: %${pct}.</b> <span class="muted">Bu bir telaffuz puanı değildir; yalnızca tarayıcının konuşma tanıma sonucunun hedef cümleyle kaç kelimede örtüştüğünü gösterir. Kırmızı kelimeleri dinleyip tekrar dene.</span></p></div>`;
      onResult?.(best.m.ratio, best.transcript);
    } catch (err) {
      out.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    } finally {
      mic.classList.remove('recording');
    }
  });

  const recBtn = $('[data-rec]', host);
  let rec = null;
  recBtn?.addEventListener('click', async () => {
    const label = $('[data-rec-label]', host);
    if (!rec) {
      try {
        rec = await startRecording();
        recBtn.innerHTML = icons.stop;
        recBtn.classList.add('speaking');
        label.textContent = 'Durdur';
      } catch { out.innerHTML = '<div class="form-error">Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.</div>'; }
      return;
    }
    const url = await rec.stop();
    rec = null;
    recBtn.innerHTML = icons.headphones;
    recBtn.classList.remove('speaking');
    label.textContent = 'Tekrar kaydet';
    const audio = $('[data-audio]', host);
    audio.src = url;
    audio.classList.remove('hidden');
    audio.play().catch(() => {});
  });
}
