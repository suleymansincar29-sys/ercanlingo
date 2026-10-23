// Cevap karşılaştırma yardımcıları (istemci ve sunucu ortak kullanır).
const CONTRACTIONS = [
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\bi'm\b/g, 'i am'], [/\b(\w+)'re\b/g, '$1 are'], [/\b(\w+)'ve\b/g, '$1 have'],
  [/\b(\w+)'ll\b/g, '$1 will'], [/\b(\w+)'d\b/g, '$1 would'],
  [/\b(he|she|it|that|there|what|where|who|here|how)'s\b/g, '$1 is'],
  [/\blet's\b/g, 'let us'],
];

export function normalize(text) {
  let s = String(text || '').toLowerCase().normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/\(.*?\)/g, ' ');
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  return s
    .replace(/[.,!?;:"“”…\-–—]/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Kabul edilen cevaplardan biriyle eşleşiyor mu? Uzun cevaplarda tek harflik yazım hatasına izin verir.
export function checkTyped(input, accepted) {
  const given = normalize(input);
  if (!given) return { correct: false, typo: false };
  for (const a of accepted) {
    const target = normalize(a);
    if (given === target) return { correct: true, typo: false };
  }
  for (const a of accepted) {
    const target = normalize(a);
    if (target.length >= 8 && levenshtein(given, target) <= 1) return { correct: true, typo: true, expected: a };
  }
  return { correct: false, typo: false };
}

// Konuşma tanıma sonucunu hedef cümleyle kelime bazında karşılaştırır (telaffuz puanı DEĞİLDİR).
export function wordMatch(heard, target) {
  const h = normalize(heard).split(' ').filter(Boolean);
  const t = normalize(target).split(' ').filter(Boolean);
  const pool = [...h];
  const words = t.map((w) => {
    const idx = pool.indexOf(w);
    if (idx >= 0) { pool.splice(idx, 1); return { word: w, ok: true }; }
    return { word: w, ok: false };
  });
  const hits = words.filter((w) => w.ok).length;
  return { words, ratio: t.length ? hits / t.length : 0 };
}

export function slug(s) {
  return normalize(s).replace(/\s+/g, '-');
}
