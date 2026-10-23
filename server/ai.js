// AI öğretmen: Anthropic Claude API'sine sunucu tarafından bağlanır. Anahtar yalnızca sunucu ortamında tutulur.
import { BRAND } from '../shared/brand.js';

export const MISTAKE_CATEGORIES = ['to be', 'present simple', 'past simple', 'present perfect', 'future', 'articles', 'prepositions', 'plurals', 'word order', 'spelling', 'vocabulary', 'pronouns', 'modals', 'comparatives', 'other'];
const MARKER = '<<<HATALAR>>>';

export const MODES = {
  chat: 'Kullanıcıyla seviyesine uygun, doğal bir İngilizce sohbet et. Kısa cevaplar ver ve sohbeti sürdürmek için bir soru sor. Kullanıcının İngilizce mesajında hata varsa önce nazikçe düzeltip kısa bir Türkçe açıklama ekle, sonra sohbete devam et.',
  correct: 'Kullanıcının yazdığı İngilizce cümleleri düzelt. Biçim: önce düzeltilmiş cümle, sonra her hata için Türkçe kısa açıklama. Cümle doğruysa bunu söyle ve varsa daha doğal bir alternatif öner.',
  grammar: 'Kullanıcının sorduğu dil bilgisi konusunu Türkçe, sade ve örneklerle açıkla. Her örnek cümlenin Türkçe çevirisini ver. Sonunda konuyu pekiştirecek 2 kısa soru sor.',
  practice: 'Kullanıcının seviyesine uygun 5 soruluk kısa bir alıştırma hazırla (kelime ve dil bilgisi karışık). Cevapları hemen verme; kullanıcı cevaplarını yazınca kontrol et ve Türkçe açıkla.',
  writing: 'Kullanıcının yazdığı İngilizce metni değerlendir: dil bilgisi, kelime seçimi, akıcılık ve yapı. Güçlü yönleri, hataları (düzeltmeleriyle) ve geliştirme önerilerini Türkçe başlıklar altında ver. Kesin olmayan bir puan uydurma; istenirse CEFR seviyesine yaklaşık bir tahmin ver ve bunun tahmin olduğunu belirt.',
  natural: 'Kullanıcının cümlesini anadili İngilizce olan birinin söyleyeceği daha doğal 2-3 farklı biçimde yeniden yaz. Her birinin hangi durumda (resmî, günlük, kibar) kullanıldığını Türkçe açıkla.',
};

export function systemPrompt(user, frequentMistakes = []) {
  const beginner = ['A1', 'A2'].includes(user.level);
  return [
    `Sen ${BRAND.appName} uygulamasının yapay zekâ İngilizce öğretmenisin. Öğrencilerin Türkçe konuşuyor.`,
    `Öğrencinin adı: ${user.name}. Seviyesi: ${user.level}.`,
    beginner
      ? 'Öğrenci başlangıç seviyesinde: çok basit İngilizce kullan, kısa cümleler kur, açıklamaları Türkçe yap ve yeni kelimelerin Türkçesini parantez içinde ver.'
      : 'Öğrencinin seviyesine uygun İngilizce kullan; dil bilgisi açıklamalarını Türkçe yap.',
    'Öğrenci anlamadığını söylerse veya Türkçe yazarsa konuyu Türkçe ve daha basit anlat.',
    'Sıcak, sabırlı ve cesaretlendirici ol. Cevapları kısa tut (genellikle 120 kelimeyi geçme), gerektiğinde madde işaretleri kullan.',
    'Konu dışı (İngilizce öğrenmeyle ilgisiz) isteklerde kibarca İngilizce öğrenmeye geri yönlendir.',
    frequentMistakes.length ? `Öğrencinin sık yaptığı hata türleri: ${frequentMistakes.join(', ')}. Uygun olduğunda bunlara dikkat çek.` : '',
    `Öğrencinin son mesajında İngilizce dil hatası varsa, cevabının EN SONUNA ayrı bir satırda tam olarak şu biçimde bir işaret ekle: ${MARKER}[{"category":"<kategori>","wrong":"<hatalı kısım>","right":"<doğrusu>"}]`,
    `Kategori şu listeden biri olmalı: ${MISTAKE_CATEGORIES.join(', ')}. Hata yoksa işareti hiç ekleme. Bu işaret öğrenciye gösterilmez.`,
  ].filter(Boolean).join('\n');
}

// Modelin cevabından hata işaretini ayıklar.
export function extractMistakes(text) {
  const i = text.lastIndexOf(MARKER);
  if (i < 0) return { reply: text.trim(), mistakes: [] };
  const reply = text.slice(0, i).trim();
  let mistakes = [];
  try {
    const parsed = JSON.parse(text.slice(i + MARKER.length).trim());
    if (Array.isArray(parsed)) {
      mistakes = parsed.slice(0, 5).filter((m) => m && typeof m === 'object').map((m) => ({
        category: MISTAKE_CATEGORIES.includes(m.category) ? m.category : 'other',
        wrong: String(m.wrong || '').slice(0, 200),
        right: String(m.right || '').slice(0, 200),
      }));
    }
  } catch { /* biçim bozuksa hataları yok say */ }
  return { reply, mistakes };
}

export function createTutor({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ERCANLINGO_AI_MODEL || 'claude-opus-5-5', baseURL = process.env.ERCANLINGO_AI_BASE_URL || 'https://api.anthropic.com' } = {}) {
  let clientPromise = null;
  const enabled = Boolean(apiKey);
  const getClient = () => {
    clientPromise ||= import('@anthropic-ai/sdk').then(({ default: Anthropic }) => new Anthropic({ apiKey, baseURL, maxRetries: 1, timeout: 60_000 }));
    return clientPromise;
  };

  async function reply({ user, mode, history, frequentMistakes }) {
    if (!enabled) {
      const err = new Error('AI öğretmen için sunucuda ANTHROPIC_API_KEY tanımlı değil.');
      err.status = 503;
      throw err;
    }
    const client = await getClient();
    const response = await client.beta.messages.create({
      model,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: `${systemPrompt(user, frequentMistakes)}\n\nGörev modu: ${MODES[mode] || MODES.chat}`,
      messages: history,
    });
    if (response.stop_reason === 'refusal') {
      return { reply: 'Bu isteğe yardımcı olamıyorum. İngilizce öğrenmeyle ilgili başka bir soru sorabilirsin.', mistakes: [] };
    }
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return extractMistakes(text);
  }

  return { enabled, model, reply };
}
