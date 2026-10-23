// B1–C1: müfredat planı. Bu derslerin içeriği henüz yazılmadı; arayüz bunları "Hazırlanıyor" olarak gösterir.
const planned = (id, title, description, units) => ({
  id, title, description, planned: true,
  units: units.map(([uTitle, lessons], i) => ({
    id: `${id.toLowerCase()}-u${i + 1}`,
    title: uTitle,
    planned: true,
    lessons: lessons.map((t, j) => ({ id: `${id.toLowerCase()}-u${i + 1}-l${j + 1}`, title: t, planned: true })),
  })),
});

export const B1 = planned('B1', 'Orta', 'Deneyimlerini, fikirlerini ve planlarını ayrıntılı anlat.', [
  ['Hayat Hikâyeleri', ['Past continuous', 'used to', 'Past simple ve past continuous']],
  ['Sürekli Deneyimler', ['Present perfect continuous', 'for / since', 'Hâlâ ve henüz: still, yet, already']],
  ['Koşullar', ['First conditional', 'Second conditional', 'unless, as long as']],
  ['Medya ve Haberler', ['Edilgen yapı (passive) – şimdiki ve geçmiş', 'Dolaylı anlatım (reported speech)', 'Haber dili kelimeleri']],
  ['İlişkiler', ['Relative clauses: who, which, that', 'Phrasal verbs: get on with, break up', 'Fikir belirtme ve katılma']],
]);

export const B2 = planned('B2', 'Orta Üstü', 'Karmaşık konuları tartış, akıcı ve doğal konuş.', [
  ['Geçmişe Bakış', ['Past perfect', 'Third conditional', 'wish / if only']],
  ['Bilim ve Teknoloji', ['Future continuous ve future perfect', 'Edilgen yapı – ileri', 'Teknoloji kelimeleri']],
  ['İkna Etme', ['Modal verbs of deduction', 'Söylem belirteçleri: however, moreover', 'Görüş yazısı yazma']],
  ['İş Dünyası', ['Resmî e-posta yazma', 'Toplantı ifadeleri', 'Müzakere dili']],
]);

export const C1 = planned('C1', 'İleri', 'Akademik ve profesyonel ortamda incelikli ifade.', [
  ['İleri Dil Bilgisi', ['Inversion (devrik yapı)', 'Cleft sentences', 'Karma koşul cümleleri']],
  ['Akademik İngilizce', ['Akademik kelime dağarcığı', 'Özet ve parafraz', 'Sunum yapma']],
  ['Deyimler ve Üslup', ['Deyimler ve kalıplar', 'Resmî ve gündelik üslup', 'Nüanslı ifade']],
]);
