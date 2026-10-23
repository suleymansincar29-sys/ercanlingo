// Hakkında sayfası.
import { BRAND, creditLine } from '/shared/brand.js';
import { availableLessons, allWords, LEVELS } from '/shared/curriculum.js';
import { SCENARIOS } from '/shared/content/speaking.js';
import { store } from '../store.js';
import { logo, wordmark } from '../icons.js';
import { esc } from '../ui.js';
import { ttsSupported, sttSupported } from '../speech.js';

export const title = 'Hakkında';

export function render(el) {
  const ai = store.config.ai;
  el.innerHTML = `<div class="page narrow">
    <section class="card pad-lg center stack" style="align-items:center">
      ${logo(88)}
      <h1 style="margin:0;font-size:2.4rem">${wordmark(BRAND.appName)}</h1>
      <p class="muted" style="margin:0">${esc(BRAND.tagline)}</p>
      <div class="card flat" style="min-width:min(100%,360px)">
        <div class="small muted">Uygulama</div><b style="font-size:1.2rem">${esc(BRAND.appName)}</b>
        <div class="small muted mt">Yapımcı</div><b style="font-size:1.2rem">${esc(BRAND.creatorName)}</b>
      </div>
      <p><b>${esc(creditLine())}.</b></p>
      <span class="tag">Sürüm ${esc(BRAND.version)}</span>
    </section>
    <section class="card mt"><h2>Neler var?</h2>
      <ul class="points">
        <li>${LEVELS.length} seviyelik müfredat (A1–C1). A1 ve A2 için ${availableLessons().length} tam ders ve ${allWords().length} kelime hazır; B1, B2 ve C1 içerikleri hazırlanıyor.</li>
        <li>13 farklı soru türü: eşleştirme, boşluk doldurma, cümle kurma, iki yönlü çeviri, dinleme, okuma, hatalı cümle düzeltme, diyalog tamamlama ve daha fazlası.</li>
        <li>Aralıklı tekrar sistemi: zorlandığın kelimeler daha sık karşına çıkar; her kelimenin geçmişi kaydedilir.</li>
        <li>${SCENARIOS.length} konuşma senaryosu, telaffuz ayrımı ve gölgeleme alıştırmaları.</li>
        <li>XP, seviye, seri, günlük görev, haftalık hedef ve rozetlerle oyunlaştırma.</li>
      </ul></section>
    <section class="card mt"><h2>Teknik durum</h2>
      <div class="list small">
        <div class="list-item"><span>${ai.enabled ? '🟢' : '⚪'}</span><div class="grow"><b>AI öğretmen</b><div class="muted">${ai.enabled ? 'Etkin. Sunucu üzerinden güvenli bağlantı.' : 'Devre dışı: sunucuda ANTHROPIC_API_KEY tanımlı değil. Anahtar eklendiğinde kod değişikliği gerekmeden çalışır.'}</div></div></div>
        <div class="list-item"><span>${ttsSupported() ? '🟢' : '⚪'}</span><div class="grow"><b>Sesli okuma</b><div class="muted">Tarayıcının yerleşik konuşma sentezi kullanılır; aksan seçenekleri cihazdaki seslere bağlıdır.</div></div></div>
        <div class="list-item"><span>${sttSupported() ? '🟢' : '⚪'}</span><div class="grow"><b>Konuşmayı metne çevirme</b><div class="muted">${sttSupported() ? 'Bu tarayıcıda destekleniyor.' : 'Bu tarayıcıda desteklenmiyor (Chrome veya Edge önerilir).'} Uygulama telaffuz puanı uydurmaz; yalnızca tanınan metnin hedef cümleyle kelime eşleşmesini gösterir.</div></div></div>
        <div class="list-item"><span>🟢</span><div class="grow"><b>Veri saklama</b><div class="muted">Hesaplar ve ilerleme sunucudaki SQLite veritabanında tutulur.</div></div></div>
      </div></section>
    <p class="center small muted mt">© ${new Date().getFullYear()} ${esc(BRAND.appName)} · ${esc(BRAND.creatorName)}</p>
  </div>`;
}
