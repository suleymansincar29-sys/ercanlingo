// Konuşma senaryoları. "you" satırlarını kullanıcı söyler; diğer satırları uygulama seslendirir.
export const SCENARIOS = [
  {
    id: 'intro', title: 'Kendini Tanıtma', icon: '👋', level: 'A1',
    description: 'Yeni biriyle tanış, adını ve nereli olduğunu söyle.',
    lines: [
      ['them', 'Hi! I\'m Emma. What\'s your name?', 'Selam! Ben Emma. Adın ne?'],
      ['you', 'Hi Emma, my name is Can. Nice to meet you.', 'Selam Emma, benim adım Can. Tanıştığımıza memnun oldum.'],
      ['them', 'Nice to meet you too. Where are you from?', 'Ben de memnun oldum. Nerelisin?'],
      ['you', 'I\'m from Turkey. I live in Izmir.', 'Türkiyeliyim. İzmir\'de yaşıyorum.'],
      ['them', 'Oh, lovely! What do you do?', 'Ne güzel! Ne iş yapıyorsun?'],
      ['you', 'I\'m a student. I study engineering.', 'Öğrenciyim. Mühendislik okuyorum.'],
    ],
  },
  {
    id: 'daily', title: 'Günlük Sohbet', icon: '☀️', level: 'A1',
    description: 'Bir arkadaşınla gününü ve planlarını konuş.',
    lines: [
      ['them', 'Good morning! How are you today?', 'Günaydın! Bugün nasılsın?'],
      ['you', 'I\'m fine, thanks. A little tired.', 'İyiyim, teşekkürler. Biraz yorgunum.'],
      ['them', 'Why? Did you sleep late?', 'Neden? Geç mi yattın?'],
      ['you', 'Yes, I watched a film last night.', 'Evet, dün gece bir film izledim.'],
      ['them', 'What are you doing this evening?', 'Bu akşam ne yapıyorsun?'],
      ['you', 'I\'m going to stay at home and relax.', 'Evde kalıp dinleneceğim.'],
    ],
  },
  {
    id: 'restaurant', title: 'Restoranda Sipariş', icon: '🍽️', level: 'A1',
    description: 'Masa iste, yemek sipariş et ve hesabı öde.',
    lines: [
      ['them', 'Good evening. A table for how many?', 'İyi akşamlar. Kaç kişilik masa?'],
      ['you', 'A table for two, please.', 'İki kişilik bir masa lütfen.'],
      ['them', 'Are you ready to order?', 'Sipariş vermeye hazır mısınız?'],
      ['you', 'Yes, I\'d like the chicken soup and a salad.', 'Evet, tavuk çorbası ve bir salata alayım.'],
      ['them', 'Anything to drink?', 'İçecek bir şey?'],
      ['you', 'Can I have some water, please?', 'Biraz su alabilir miyim lütfen?'],
      ['them', 'Of course. Here you are.', 'Tabii. Buyurun.'],
      ['you', 'Thank you. Could I have the bill, please?', 'Teşekkürler. Hesabı alabilir miyim lütfen?'],
    ],
  },
  {
    id: 'shopping', title: 'Alışveriş', icon: '🛍️', level: 'A1',
    description: 'Bir mağazada beden ve fiyat sor.',
    lines: [
      ['them', 'Hello! Can I help you?', 'Merhaba! Yardımcı olabilir miyim?'],
      ['you', 'Yes, please. How much is this jacket?', 'Evet lütfen. Bu ceket ne kadar?'],
      ['them', 'It\'s eighty dollars.', 'Seksen dolar.'],
      ['you', 'Do you have it in a smaller size?', 'Daha küçük bedeni var mı?'],
      ['them', 'Yes, here you are. The fitting room is over there.', 'Evet, buyurun. Deneme kabini şurada.'],
      ['you', 'Thanks. I\'ll take it. Can I pay by card?', 'Teşekkürler. Alıyorum. Kartla ödeyebilir miyim?'],
    ],
  },
  {
    id: 'hotel', title: 'Otel ve Seyahat', icon: '🏨', level: 'A2',
    description: 'Otele giriş yap ve kibarca ricada bulun.',
    lines: [
      ['them', 'Good afternoon. Welcome to the Sea View Hotel.', 'İyi günler. Sea View Otel\'e hoş geldiniz.'],
      ['you', 'Hello, I have a reservation for three nights.', 'Merhaba, üç gecelik rezervasyonum var.'],
      ['them', 'Could I see your passport, please?', 'Pasaportunuzu görebilir miyim lütfen?'],
      ['you', 'Here you are. What time is breakfast?', 'Buyurun. Kahvaltı saat kaçta?'],
      ['them', 'Breakfast is from seven to ten.', 'Kahvaltı yediden ona kadar.'],
      ['you', 'Could you call me a taxi tomorrow morning?', 'Yarın sabah bana bir taksi çağırabilir misiniz?'],
    ],
  },
  {
    id: 'directions', title: 'Yol Sorma', icon: '🧭', level: 'A1',
    description: 'Şehirde kaybolduğunda yol sor.',
    lines: [
      ['you', 'Excuse me, where is the train station?', 'Affedersiniz, tren istasyonu nerede?'],
      ['them', 'Go straight and turn left at the bank.', 'Düz gidin ve bankadan sola dönün.'],
      ['you', 'Is it far from here?', 'Buradan uzak mı?'],
      ['them', 'No, it\'s about five minutes on foot.', 'Hayır, yürüyerek yaklaşık beş dakika.'],
      ['you', 'Thank you very much!', 'Çok teşekkür ederim!'],
    ],
  },
  {
    id: 'interview', title: 'İş Görüşmesi', icon: '💼', level: 'A2',
    description: 'Basit bir iş görüşmesinde kendini anlat.',
    lines: [
      ['them', 'Please, take a seat. Tell me about yourself.', 'Lütfen oturun. Bana kendinizden bahsedin.'],
      ['you', 'I\'m a graphic designer. I have three years of experience.', 'Grafik tasarımcıyım. Üç yıllık deneyimim var.'],
      ['them', 'Why do you want this job?', 'Bu işi neden istiyorsunuz?'],
      ['you', 'Because I love your products and I want to learn more.', 'Çünkü ürünlerinizi seviyorum ve daha çok öğrenmek istiyorum.'],
      ['them', 'What are your strengths?', 'Güçlü yönleriniz neler?'],
      ['you', 'I\'m creative and I work well in a team.', 'Yaratıcıyım ve takım hâlinde iyi çalışırım.'],
      ['them', 'Do you have any questions for us?', 'Bize sormak istediğiniz bir şey var mı?'],
      ['you', 'Yes. When can I start?', 'Evet. Ne zaman başlayabilirim?'],
    ],
  },
  {
    id: 'doctor', title: 'Doktorda', icon: '🩺', level: 'A2',
    description: 'Şikâyetini anlat ve tavsiye al.',
    lines: [
      ['them', 'Hello. What seems to be the problem?', 'Merhaba. Sorun nedir?'],
      ['you', 'I have a headache and a sore throat.', 'Başım ve boğazım ağrıyor.'],
      ['them', 'How long have you had it?', 'Ne zamandır böyle?'],
      ['you', 'Since Monday. I also have a fever.', 'Pazartesiden beri. Ateşim de var.'],
      ['them', 'You should rest and drink lots of water.', 'Dinlenmeli ve bol su içmelisiniz.'],
      ['you', 'Should I take any medicine?', 'İlaç almalı mıyım?'],
    ],
  },
];

// Telaffuz ayrımı için en küçük çiftler. Kullanıcı duyduğunu seçer; bu gerçek bir dinleme ölçümüdür.
export const MINIMAL_PAIRS = [
  { id: 'ship-sheep', a: 'ship', b: 'sheep', tip: 'ship kısa "i" (şip), sheep uzun "ii" (şiip).' },
  { id: 'think-sink', a: 'think', b: 'sink', tip: '"th" sesinde dil ucu dişlerin arasına hafifçe değer; "s" sesinde değmez.' },
  { id: 'very-berry', a: 'very', b: 'berry', tip: '"v" sesinde üst dişler alt dudağa değer; "b" sesinde iki dudak kapanır.' },
  { id: 'walk-work', a: 'walk', b: 'work', tip: 'walk "vook" gibi, l okunmaz; work ise "vörk".' },
  { id: 'full-fool', a: 'full', b: 'fool', tip: 'full kısa "u", fool uzun "uu".' },
  { id: 'live-leave', a: 'live', b: 'leave', tip: 'live kısa "i" (liv), leave uzun "ii" (liiv).' },
  { id: 'three-tree', a: 'three', b: 'tree', tip: 'three "th" ile başlar; tree "t" ile.' },
  { id: 'cap-cup', a: 'cap', b: 'cup', tip: 'cap ağız açık "e" (kep), cup kısa "a" (kap).' },
  { id: 'west-vest', a: 'west', b: 'vest', tip: '"w" sesi dudaklar yuvarlanarak (u gibi), "v" ise dişle dudakla çıkar.' },
  { id: 'hat-hot', a: 'hat', b: 'hot', tip: 'hat "het", hot "hot" (Amerikan aksanında "hat"a yakın).' },
];

export const SHADOWING = [
  ['How are you doing today?', 'Bugün nasılsın?'],
  ['Could you say that again, please?', 'Tekrar söyler misiniz lütfen?'],
  ['I\'m sorry, I don\'t understand.', 'Üzgünüm, anlamıyorum.'],
  ['What does this word mean?', 'Bu kelime ne demek?'],
  ['Can you speak more slowly, please?', 'Daha yavaş konuşabilir misiniz lütfen?'],
  ['It was really nice talking to you.', 'Seninle konuşmak gerçekten güzeldi.'],
  ['I think the weather will be better tomorrow.', 'Bence yarın hava daha iyi olacak.'],
  ['Three thin thieves thought a thousand thoughts.', 'Üç zayıf hırsız bin düşünce düşündü. (th tekerlemesi)'],
];
