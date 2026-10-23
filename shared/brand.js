// Uygulama kimliği tek yerden yönetilir. Ad veya yapımcı değişirse yalnızca bu dosyayı düzenleyin.
export const BRAND = Object.freeze({
  appName: 'Ercanlingo',
  creatorName: 'Ercan Sincar',
  tagline: 'İngilizceyi her gün biraz daha akıcı konuş.',
  version: '1.0.0',
});

export const creditLine = () => `${BRAND.creatorName} tarafından geliştirilmiştir`;
