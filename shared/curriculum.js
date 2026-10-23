import { A1 } from './content/a1.js';
import { A2 } from './content/a2.js';
import { B1, B2, C1 } from './content/planned.js';
import { slug } from './text.js';

export const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const LEVELS = [A1, A2, B1, B2, C1];

// --- İndeksler ---------------------------------------------------------------
const lessonIndex = new Map();
const unitIndex = new Map();
const wordIndex = new Map();
const grammarIndex = [];

for (const level of LEVELS) {
  level.units.forEach((unit, ui) => {
    unit.level = level.id;
    unit.index = ui;
    unitIndex.set(unit.id, unit);
    unit.lessons.forEach((lesson, li) => {
      lesson.level = level.id;
      lesson.unitId = unit.id;
      lesson.index = li;
      lessonIndex.set(lesson.id, lesson);
      if (lesson.planned) return;
      lesson.wordIds = lesson.words.map(([en, tr, pron, ex, exTr]) => {
        const id = slug(en);
        if (wordIndex.has(id)) throw new Error(`Yinelenen kelime: ${id}`);
        wordIndex.set(id, { id, en, tr, pron, ex, exTr, level: level.id, topic: unit.title, lessonId: lesson.id });
        return id;
      });
      grammarIndex.push({ ...lesson.grammar, level: level.id, lessonId: lesson.id, lessonTitle: lesson.title, unitTitle: unit.title });
    });
  });
}

export const getLesson = (id) => lessonIndex.get(id);
export const getUnit = (id) => unitIndex.get(id);
export const getWord = (id) => wordIndex.get(id);
export const allWords = () => [...wordIndex.values()];
export const allGrammar = () => grammarIndex;
export const getGrammar = (id) => grammarIndex.find((g) => g.id === id);
export const getLevel = (id) => LEVELS.find((l) => l.id === id);
export const availableLessons = () => [...lessonIndex.values()].filter((l) => !l.planned);
export const plannedGrammar = () => LEVELS.filter((l) => l.planned).flatMap((l) => l.units.flatMap((u) => u.lessons.map((x) => ({ level: l.id, title: x.title, unitTitle: u.title }))));

// Düz sıralı ders listesi (öneri ve kilit mantığı için).
export const lessonSequence = () => LEVELS.flatMap((l) => l.units.flatMap((u) => u.lessons)).filter((l) => !l.planned);

// --- Rastgelelik (tohumlu) ------------------------------------------------------
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed : hashString(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (arr, n, rand) => shuffle(arr, rand).slice(0, n);

// --- Alıştırma üretimi ----------------------------------------------------------
// Elle yazılmış alıştırmaları oynatıcının anlayacağı biçime çevirir.
function fromHand(item, topic, rand) {
  const [type] = item;
  switch (type) {
    case 'fill': {
      const [, sentence, options, answer, exp] = item;
      return { type: 'fill', sentence, options: shuffle(options, rand), answer: options[answer], exp, topic };
    }
    case 'build': {
      const [, prompt, answer, extra = [], exp] = item;
      const tokens = answer.split(' ');
      return { type: 'build', prompt, answer, tiles: shuffle([...tokens, ...extra], rand), exp, topic };
    }
    case 'tr2en': {
      const [, prompt, accepted, exp] = item;
      return { type: 'tr2en', prompt, accepted, answer: accepted[0], exp, topic };
    }
    case 'en2tr': {
      const [, sentence, options, answer, exp] = item;
      return { type: 'en2tr', sentence, options: shuffle(options, rand), answer: options[answer], exp, topic };
    }
    case 'fix': {
      const [, wrong, accepted, exp] = item;
      return { type: 'fix', wrong, accepted, answer: accepted[0], exp, topic };
    }
    case 'dlg': {
      const [, lines, options, answer, exp] = item;
      return { type: 'dlg', lines, options: shuffle(options, rand), answer: options[answer], exp, topic };
    }
    default:
      throw new Error(`Bilinmeyen alıştırma türü: ${type}`);
  }
}

function vocabExercises(lesson, rand) {
  const words = lesson.wordIds.map(getWord);
  const others = allWords().filter((w) => w.level === lesson.level && w.lessonId !== lesson.id);
  const distract = (w, field, n) => pick([...words, ...others].filter((x) => x.id !== w.id), n, rand).map((x) => x[field]);
  const [w1, w2, w3, w4, w5] = shuffle(words, rand);
  const exampleWord = w5 || w1;
  const exampleOthers = pick(allWords().filter((x) => x.id !== exampleWord.id && x.level === lesson.level), 2, rand).map((x) => x.exTr);
  return {
    match: { type: 'match', pairs: pick(words, 4, rand).map((w) => ({ id: w.id, en: w.en, tr: w.tr })), topic: 'vocab', exp: 'Kelimeleri anlamlarıyla eşleştir.' },
    mcEn: { type: 'mc', prompt: `"${w1.en}" ne demek?`, audio: w1.en, options: shuffle([w1.tr, ...distract(w1, 'tr', 2)], rand), answer: w1.tr, wordId: w1.id, exp: `${w1.en} = ${w1.tr}. Örnek: ${w1.ex}`, topic: 'vocab' },
    mcTr: { type: 'mc', prompt: `"${w2.tr}" İngilizcede hangisi?`, options: shuffle([w2.en, ...distract(w2, 'en', 2)], rand), answer: w2.en, wordId: w2.id, exp: `${w2.tr} = ${w2.en} (${w2.pron})`, topic: 'vocab' },
    listen: { type: 'listen', audio: w3.en, options: shuffle([w3.en, ...distract(w3, 'en', 3)], rand), answer: w3.en, wordId: w3.id, exp: `Duyduğun kelime: ${w3.en} (${w3.pron}) = ${w3.tr}`, topic: 'listening' },
    type: { type: 'type', prompt: w4.tr, hint: w4.pron, accepted: [w4.en], answer: w4.en, wordId: w4.id, exp: `${w4.tr} = ${w4.en}. Örnek: ${w4.ex}`, topic: 'vocab' },
    listenSentence: { type: 'listen-tr', audio: exampleWord.ex, options: shuffle([exampleWord.exTr, ...exampleOthers], rand), answer: exampleWord.exTr, exp: `"${exampleWord.ex}" = ${exampleWord.exTr}`, topic: 'listening' },
  };
}

export function readingExercises(lesson, rand = Math.random) {
  return lesson.reading.qs.map(([q, options, answer, exp]) => ({
    type: 'read', title: lesson.reading.title, text: lesson.reading.text, prompt: q,
    options: shuffle(options, rand), answer: options[answer], exp, topic: 'reading',
  }));
}

export function buildLessonExercises(lesson, seed = Math.random()) {
  const rand = rng(`${lesson.id}:${seed}`);
  const topic = lesson.grammar.id;
  const v = vocabExercises(lesson, rand);
  const hand = lesson.ex.map((e) => fromHand(e, topic, rand));
  const fills = hand.filter((e) => e.type === 'fill');
  const rest = hand.filter((e) => e.type !== 'fill');
  return [v.match, v.mcEn, ...fills, v.listen, v.mcTr, ...rest.slice(0, 2), v.type, v.listenSentence, ...rest.slice(2), ...readingExercises(lesson, rand)];
}

export const lessonExerciseCount = (lesson) => buildLessonExercises(lesson, 0).length;

export const UNIT_TEST_SIZE = 15;
export const UNIT_PASS_RATIO = 0.7;

export function buildUnitTest(unit, seed = Math.random()) {
  const rand = rng(`${unit.id}:test:${seed}`);
  const pool = [];
  for (const lesson of unit.lessons) {
    const hand = lesson.ex.map((e) => fromHand(e, lesson.grammar.id, rand));
    pool.push(...pick(hand, 4, rand));
    const v = vocabExercises(lesson, rand);
    pool.push(v.mcEn);
  }
  return shuffle(pool, rand).slice(0, UNIT_TEST_SIZE);
}

// Kelime tekrar oturumu için alıştırma (tek kelime).
export function buildWordExercise(word, rand = Math.random, pool = allWords()) {
  const others = pick(pool.filter((x) => x.id !== word.id), 3, rand);
  const modes = ['mc-en', 'mc-tr', 'type', 'listen'];
  if (word.ex && word.ex.toLowerCase().includes(word.en.toLowerCase())) modes.push('gap');
  const mode = modes[Math.floor(rand() * modes.length)];
  const base = { wordId: word.id, topic: 'vocab', exp: `${word.en} = ${word.tr}${word.ex ? `. Örnek: ${word.ex}` : ''}` };
  if (mode === 'mc-en') return { ...base, type: 'mc', prompt: `"${word.en}" ne demek?`, audio: word.en, options: shuffle([word.tr, ...others.slice(0, 2).map((o) => o.tr)], rand), answer: word.tr };
  if (mode === 'mc-tr') return { ...base, type: 'mc', prompt: `"${word.tr}" İngilizcede hangisi?`, options: shuffle([word.en, ...others.slice(0, 2).map((o) => o.en)], rand), answer: word.en };
  if (mode === 'listen') return { ...base, type: 'listen', audio: word.en, options: shuffle([word.en, ...others.map((o) => o.en)], rand), answer: word.en };
  if (mode === 'gap') {
    const re = new RegExp(word.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return { ...base, type: 'gap', sentence: word.ex.replace(re, '___'), translation: word.exTr, accepted: [word.en], answer: word.en };
  }
  return { ...base, type: 'type', prompt: word.tr, hint: word.pron, accepted: [word.en], answer: word.en };
}

// Günün kelimesi: tarihe göre sabit seçim.
export function wordOfDay(day) {
  const words = allWords();
  return words[hashString(day) % words.length];
}

export const TOPIC_LABELS = {
  vocab: 'Kelime bilgisi',
  listening: 'Dinleme',
  reading: 'Okuma',
};
export const topicLabel = (id) => TOPIC_LABELS[id] || getGrammar(id)?.title || id;

// Kilit kuralı: kullanıcının seçtiği seviyenin altındaki seviyeler serbesttir.
// Seçili seviye ve üstünde dersler sırayla açılır; bir seviyenin ilk dersi, önceki seviye bittiyse veya seviye seçildiyse açıktır.
export function isLessonUnlocked(lessonId, completed, userLevel = 'A1') {
  const lesson = getLesson(lessonId);
  if (!lesson || lesson.planned) return false;
  const lvIdx = LEVEL_ORDER.indexOf(lesson.level);
  const userIdx = LEVEL_ORDER.indexOf(userLevel);
  if (lvIdx < userIdx) return true;
  const seq = lessonSequence().filter((l) => l.level === lesson.level);
  const i = seq.findIndex((l) => l.id === lessonId);
  if (i > 0) return completed.has(seq[i - 1].id);
  if (lvIdx <= userIdx) return true;
  const prevLevel = lessonSequence().filter((l) => l.level === LEVEL_ORDER[lvIdx - 1]);
  return prevLevel.length > 0 && prevLevel.every((l) => completed.has(l.id));
}

export const isUnitTestUnlocked = (unitId, completed) => {
  const unit = getUnit(unitId);
  return Boolean(unit && !unit.planned && unit.lessons.every((l) => completed.has(l.id)));
};

// Sıradaki önerilen ders: kullanıcının seviyesinden başlayarak açık ve bitmemiş ilk ders.
export function nextLesson(completed, userLevel = 'A1') {
  const seq = lessonSequence();
  const start = Math.max(0, seq.findIndex((l) => LEVEL_ORDER.indexOf(l.level) >= LEVEL_ORDER.indexOf(userLevel)));
  for (const l of [...seq.slice(start), ...seq.slice(0, start)]) {
    if (!completed.has(l.id) && isLessonUnlocked(l.id, completed, userLevel)) return l;
  }
  return null;
}
