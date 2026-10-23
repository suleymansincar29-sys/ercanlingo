# Ercanlingo

**Yapımcı: Ercan Sincar**

Ercanlingo; oyunlaştırılmış dersler, aralıklı tekrar sistemi, konuşma pratiği ve yapay zekâ destekli bir öğretmeni bir araya getiren İngilizce öğrenme uygulamasıdır. Arayüz Türkçedir.

## Hızlı başlangıç

Gereksinim: **Node.js 22.13 veya üzeri** (yerleşik `node:sqlite` modülü kullanılır, ayrı veritabanı kurulumu gerekmez).

```bash
npm install          # tek bağımlılık: @anthropic-ai/sdk (AI öğretmen için)
npm start            # http://localhost:3000
```

AI öğretmeni açmak için sunucuyu bir Anthropic API anahtarıyla başlatın:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Anahtar yalnızca sunucuda kalır; tarayıcıya hiçbir zaman gönderilmez. Anahtar yoksa AI öğretmen sayfası bunu açıkça söyler ve diğer bütün özellikler çalışmaya devam eder.

| Ortam değişkeni | Varsayılan | Açıklama |
| --- | --- | --- |
| `PORT` | `3000` | Sunucu portu |
| `ERCANLINGO_DB` | `data/ercanlingo.db` | SQLite veritabanı dosyası |
| `ANTHROPIC_API_KEY` | (yok) | AI öğretmeni etkinleştirir |
| `ERCANLINGO_AI_MODEL` | `claude-opus-5-5` | Kullanılacak Claude modeli |
| `NODE_ENV` | | `production` olduğunda oturum çerezi `Secure` işaretlenir (HTTPS arkasında kullanın) |

## Testler

```bash
npm test             # API ve iş kuralı testleri (node:test)
npm run test:e2e     # Chromium ile uçtan uca test; ekran görüntüleri test/screenshots/ altına
```

## Neler var?

- **Müfredat:** A1 (5 ünite, 15 ders) ve A2 (4 ünite, 12 ders) tamamen hazır: 162 kelime (Türkçe anlam, telaffuz rehberi, örnek cümle ve çevirisi), her derste dil bilgisi anlatımı, okuma metni, yazma ve konuşma görevi. B1, B2 ve C1 müfredatı planlandı ve arayüzde "Hazırlanıyor" olarak gösterilir.
- **13 soru türü:** eşleştirme, çoktan seçmeli, boşluk doldurma, kelime yazma, dinleyerek cevaplama, dinlediğini anlama, cümle oluşturma, Türkçeden İngilizceye ve İngilizceden Türkçeye çeviri, hatalı cümle düzeltme, diyalog tamamlama, okuduğunu anlama. Yanlışlarda doğru cevap ve açıklama gösterilir; küçük yazım hataları tolere edilir.
- **Ünite sonu testleri** ve **seviye belirleme testi** (20 soru, A1–C1).
- **Aralıklı tekrar (SM-2 esinli):** her kelimenin durumu, sonraki tekrar zamanı ve doğru/yanlış geçmişi saklanır. Zorlanılan kelimeler öne alınır. Favoriler, kişisel listeler ve kendi kelimelerini ekleme.
- **Konuşma:** 8 gerçek hayat senaryosu, telaffuz ayrımı (en küçük çiftler), gölgeleme. Tarayıcının konuşma sentezi (aksan seçimi) ve konuşma tanıma özellikleri kullanılır. Uygulama telaffuz puanı uydurmaz; yalnızca tanınan metnin hedef cümleyle kelime eşleşmesini gösterir.
- **AI öğretmen:** sohbet, cümle düzeltme, Türkçe dil bilgisi anlatımı, alıştırma hazırlama, yazı değerlendirme, doğal ifade önerme. Kullanıcının sık yaptığı hatalar kategorilere ayrılıp kaydedilir.
- **Oyunlaştırma:** XP, kullanıcı seviyesi, günlük seri, günlük görevler, haftalık hedef, 18 rozet. Bütün XP sunucuda hesaplanır ve tekrar sınırları vardır (aşağıda).
- **Hesaplar:** misafir olarak hemen başlama, sonra ilerlemeyi kaybetmeden hesaba dönüştürme; e-posta/şifre ile kayıt ve giriş, veri indirme, hesap silme.
- Açık/koyu tema, telefon/tablet/masaüstü uyumlu arayüz, klavye kısayolları (1-4 seçenek, Enter kontrol).

### XP kuralları (sınırsız puan kazanmayı engeller)

- Ders ilk geçişte (%60 ve üzeri): 10 + doğru sayısı (en fazla 15) + hatasızsa 5 XP.
- Geçilmiş bir dersin tekrarı: en fazla 5 XP, ders başına günde 2 kez. %60 altı denemeler XP vermez.
- Ünite testi ilk geçişte 40 XP, sonraki geçişlerde günde bir kez 5 XP.
- Kelime tekrarı: yalnızca tekrar vakti gelmiş kelime doğru bilinirse 1 XP (günde en fazla 30).
- Konuşma senaryosu: senaryo başına günde bir kez 5 XP (günde en fazla 20). Telaffuz ayrımı: doğru cevap başına 1 XP (günde en fazla 10).
- Günlük görev 10 XP, haftalık hedef 50 XP; her biri bir kez verilir.

## Yapı

```
shared/      İstemci ve sunucunun ortak kullandığı kod
  brand.js       Uygulama adı ve yapımcı (tek yerden değiştirilir)
  curriculum.js  Müfredat indeksi, alıştırma üretimi, kilit kuralları
  text.js        Cevap karşılaştırma
  content/       A1, A2, planlanan seviyeler, konuşma senaryoları, seviye testi
server/      Node.js HTTP sunucusu (bağımlılıksız), SQLite, oturumlar, XP kuralları, AI proxy
public/      Derleme adımı gerektirmeyen ES modülleri, CSS ve görseller
test/        API testleri ve uçtan uca tarayıcı testi
```

Uygulamanın adını veya yapımcı adını değiştirmek için yalnızca `shared/brand.js` dosyasını düzenleyin.

## Güvenlik notları

- Şifreler scrypt ile özetlenir; oturum belirteçleri veritabanında SHA-256 özeti olarak tutulur ve `HttpOnly; SameSite=Lax` çerezde taşınır.
- Durum değiştiren her istek özel bir başlık gerektirir (CSRF koruması); sıkı bir Content-Security-Policy uygulanır.
- Giriş, misafir hesabı oluşturma ve AI istekleri hız sınırlıdır. Bütün girdiler sunucuda doğrulanır.
- Gerçek ortamda HTTPS arkasında `NODE_ENV=production` ile çalıştırın. Bu sürümde e-posta doğrulama ve şifre sıfırlama yoktur (e-posta gönderim servisi gerektirir).

© Ercanlingo · Ercan Sincar tarafından geliştirilmiştir.
