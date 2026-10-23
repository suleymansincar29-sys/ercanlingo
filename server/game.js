// Oyunlaştırma ve aralıklı tekrar kuralları. Bütün XP hesapları sunucuda yapılır.
import { rng, shuffle, availableLessons, LEVELS } from '../shared/curriculum.js';

export const DAY_MS = 86_400_000;

export const XP_RULES = {
  lessonPassRatio: 0.6,
  lessonFirstBase: 10,
  lessonFirstPerCorrectMax: 15,
  lessonPerfectBonus: 5,
  lessonRepeatMax: 5,
  lessonRepeatPerDay: 2,
  unitFirst: 40,
  unitRepeat: 5,
  reviewPerWord: 1,
  reviewDailyCap: 30,
  speakPerScenario: 5,
  speakDailyCap: 20,
  listenPerCorrect: 1,
  listenDailyCap: 10,
  quest: 10,
  weekly: 50,
};

export function isValidTz(tz) {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}

export function dayFor(ts, tz = 'Europe/Istanbul') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: isValidTz(tz) ? tz : 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}

export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Pazartesi ile başlayan haftanın ilk günü.
export function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}

export function levelFromXp(xp) {
  let level = 1;
  while (xp >= 50 * (level + 1) * level) level++;
  const curr = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, curr, next, progress: (xp - curr) / (next - curr) };
}

// --- Aralıklı tekrar (SM-2 esinli) ---------------------------------------------
// grade: 0 = bilemedim, 1 = zor, 2 = iyi, 3 = kolay
export function schedule(card, grade, now = Date.now()) {
  const c = { ease: card.ease ?? 2.5, interval_days: card.interval_days ?? 0, reps: card.reps ?? 0, lapses: card.lapses ?? 0 };
  if (grade === 0) {
    c.lapses += 1;
    c.reps = 0;
    c.interval_days = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due_at = now + 10 * 60_000;
    return c;
  }
  c.reps += 1;
  if (c.reps === 1) c.interval_days = grade === 3 ? 2 : 1;
  else if (c.reps === 2) c.interval_days = grade === 1 ? 2 : grade === 3 ? 4 : 3;
  else c.interval_days = Math.max(1, Math.round(c.interval_days * c.ease * (grade === 1 ? 0.6 : grade === 3 ? 1.3 : 1)));
  c.ease = Math.min(3.0, Math.max(1.3, c.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.1 : 0)));
  c.due_at = now + c.interval_days * DAY_MS;
  return c;
}

// --- Rozetler -------------------------------------------------------------------
export const BADGES = [
  { id: 'first-lesson', icon: '🌱', title: 'İlk Adım', desc: 'İlk dersini tamamla.' },
  { id: 'five-lessons', icon: '📘', title: 'Çalışkan', desc: '5 ders tamamla.' },
  { id: 'ten-lessons', icon: '📚', title: 'Kitap Kurdu', desc: '10 ders tamamla.' },
  { id: 'perfect', icon: '💎', title: 'Kusursuz', desc: 'Bir dersi hatasız bitir.' },
  { id: 'unit-master', icon: '🏅', title: 'Ünite Ustası', desc: 'Bir ünite sonu testini geç.' },
  { id: 'a1-complete', icon: '🎓', title: 'A1 Mezunu', desc: 'A1 seviyesinin tüm derslerini bitir.' },
  { id: 'a2-complete', icon: '🏆', title: 'A2 Mezunu', desc: 'A2 seviyesinin tüm derslerini bitir.' },
  { id: 'streak-3', icon: '🔥', title: 'Isınma Turu', desc: '3 gün üst üste çalış.' },
  { id: 'streak-7', icon: '⚡', title: 'Bir Hafta', desc: '7 gün üst üste çalış.' },
  { id: 'streak-30', icon: '🌋', title: 'Durdurulamaz', desc: '30 gün üst üste çalış.' },
  { id: 'words-25', icon: '🔤', title: 'Kelime Avcısı', desc: '25 kelime öğren.' },
  { id: 'words-100', icon: '🧠', title: 'Kelime Hazinesi', desc: '100 kelime öğren.' },
  { id: 'reviewer', icon: '🔁', title: 'Tekrar Şampiyonu', desc: 'Toplam 50 kelime tekrarı yap.' },
  { id: 'speaker', icon: '🎙️', title: 'Konuşkan', desc: 'Bir konuşma senaryosunu bitir.' },
  { id: 'tutor', icon: '🤖', title: 'Meraklı Öğrenci', desc: 'AI öğretmene ilk sorunu sor.' },
  { id: 'xp-500', icon: '⭐', title: '500 XP', desc: 'Toplam 500 XP kazan.' },
  { id: 'xp-2000', icon: '🌟', title: '2000 XP', desc: 'Toplam 2000 XP kazan.' },
  { id: 'placement', icon: '🧭', title: 'Yön Bulucu', desc: 'Seviye belirleme testini çöz.' },
];

// --- Günlük görevler -------------------------------------------------------------
export const QUESTS = {
  xpgoal: { title: 'Günlük XP hedefine ulaş', icon: '🎯' },
  lesson: { title: '1 ders tamamla', icon: '📖', kind: 'lesson', target: 1 },
  review: { title: '10 kelime tekrar et', icon: '🔁', kind: 'review', target: 10 },
  speak: { title: '1 konuşma senaryosu bitir', icon: '🎙️', kind: 'speak', target: 1 },
  listen: { title: '5 dinleme sorusunu doğru cevapla', icon: '🎧', kind: 'listen', target: 5 },
  perfect: { title: 'Bir dersi hatasız bitir', icon: '💎', kind: 'perfect', target: 1 },
  ai: { title: 'AI öğretmene 3 mesaj gönder', icon: '🤖', kind: 'ai', target: 3 },
};

export function questsForDay(userId, day, aiEnabled) {
  const pool = ['lesson', 'review', 'speak', 'listen', 'perfect', ...(aiEnabled ? ['ai'] : [])];
  const chosen = shuffle(pool, rng(`${userId}:${day}`)).slice(0, 2);
  return ['xpgoal', ...chosen];
}

// --- Durum hesapları ---------------------------------------------------------------
export function createGame(db, { aiEnabled = () => false } = {}) {
  const q = {
    xpTotal: db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM xp_events WHERE user_id = ?'),
    xpDay: db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM xp_events WHERE user_id = ? AND day = ?'),
    xpDayCore: db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM xp_events WHERE user_id = ? AND day = ? AND source NOT IN ('quest','weekly')"),
    xpBySource: db.prepare('SELECT COALESCE(SUM(amount),0) AS v, COUNT(*) AS n FROM xp_events WHERE user_id = ? AND day = ? AND source = ?'),
    xpByRef: db.prepare('SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND day = ? AND source = ? AND ref = ?'),
    xpEverRef: db.prepare('SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND source = ? AND ref = ?'),
    addXp: db.prepare('INSERT INTO xp_events (user_id, source, ref, amount, day, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    xpRange: db.prepare('SELECT day, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND day >= ? GROUP BY day'),
    activity: db.prepare('INSERT INTO activity (user_id, day, kind, count) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + excluded.count'),
    activityDay: db.prepare('SELECT kind, count FROM activity WHERE user_id = ? AND day = ?'),
    activityRange: db.prepare('SELECT day, kind, count FROM activity WHERE user_id = ? AND day >= ?'),
    activeDays: db.prepare('SELECT DISTINCT day FROM activity WHERE user_id = ? AND count > 0 ORDER BY day DESC LIMIT 400'),
    badges: db.prepare('SELECT badge_id, earned_at FROM achievements WHERE user_id = ?'),
    addBadge: db.prepare('INSERT OR IGNORE INTO achievements (user_id, badge_id, earned_at) VALUES (?, ?, ?)'),
    completedLessons: db.prepare('SELECT lesson_id, best_score FROM lesson_progress WHERE user_id = ? AND completed_at IS NOT NULL'),
    learnedWords: db.prepare('SELECT COUNT(*) AS n FROM word_progress WHERE user_id = ? AND learned_at IS NOT NULL'),
    learnedOnDay: db.prepare('SELECT COUNT(*) AS n FROM word_progress WHERE user_id = ? AND learned_day = ?'),
    totalActivity: db.prepare('SELECT COALESCE(SUM(count),0) AS n FROM activity WHERE user_id = ? AND kind = ?'),
    passedUnits: db.prepare("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND kind = 'unit' AND correct * 10 >= total * 7"),
  };

  const award = (userId, source, ref, amount, day, now = Date.now()) => {
    if (amount > 0) q.addXp.run(userId, source, ref, amount, day, now);
    return amount;
  };
  const track = (userId, day, kind, count = 1) => q.activity.run(userId, day, kind, count);

  function streak(userId, today) {
    const days = new Set(q.activeDays.all(userId).map((r) => r.day));
    let cursor = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(cursor)) { n++; cursor = addDays(cursor, -1); }
    return { count: n, activeToday: days.has(today) };
  }

  function lessonXp(userId, lessonId, correct, total, alreadyCompleted, day) {
    const ratio = total ? correct / total : 0;
    if (ratio < XP_RULES.lessonPassRatio) return { xp: 0, reason: 'Geçme sınırı %60. Bu denemeden XP kazanılmadı.' };
    if (!alreadyCompleted) {
      const xp = XP_RULES.lessonFirstBase + Math.min(correct, XP_RULES.lessonFirstPerCorrectMax) + (correct === total ? XP_RULES.lessonPerfectBonus : 0);
      return { xp, reason: 'Ders ilk kez tamamlandı.' };
    }
    const repeats = q.xpByRef.get(userId, day, 'lesson-repeat', lessonId).n;
    if (repeats >= XP_RULES.lessonRepeatPerDay) return { xp: 0, reason: 'Bu dersin bugünkü tekrar XP hakkı doldu. Yarın tekrar kazanabilirsin.' };
    return { xp: Math.min(XP_RULES.lessonRepeatMax, Math.ceil(correct / 3)), reason: 'Tekrar ödülü (azaltılmış).', repeat: true };
  }

  function unitXp(userId, unitId, correct, total, day) {
    if (correct / total < 0.7) return { xp: 0, reason: 'Ünite testini geçmek için en az %70 gerekir.' };
    if (!q.xpEverRef.get(userId, 'unit', unitId).n) return { xp: XP_RULES.unitFirst, reason: 'Ünite testi ilk kez geçildi.', source: 'unit' };
    if (q.xpByRef.get(userId, day, 'unit-repeat', unitId).n) return { xp: 0, reason: 'Bu ünite testinin bugünkü tekrar ödülü alındı.' };
    return { xp: XP_RULES.unitRepeat, reason: 'Ünite testi tekrar ödülü.', source: 'unit-repeat' };
  }

  function cappedXp(userId, day, source, amount, cap) {
    const used = q.xpBySource.get(userId, day, source).v;
    return Math.max(0, Math.min(amount, cap - used));
  }

  function questState(user, day) {
    const acts = Object.fromEntries(q.activityDay.all(user.id, day).map((r) => [r.kind, r.count]));
    const xpCore = q.xpDayCore.get(user.id, day).v;
    return questsForDay(user.id, day, aiEnabled()).map((id) => {
      const def = QUESTS[id];
      const target = id === 'xpgoal' ? user.daily_goal : def.target;
      const value = id === 'xpgoal' ? xpCore : acts[def.kind] || 0;
      const claimed = q.xpByRef.get(user.id, day, 'quest', id).n > 0;
      return { id, title: id === 'xpgoal' ? `Günlük hedef: ${user.daily_goal} XP kazan` : def.title, icon: def.icon, value: Math.min(value, target), target, done: value >= target, claimed, reward: XP_RULES.quest };
    });
  }

  // Tamamlanan görevlerin ve haftalık hedefin ödülünü bir kez verir.
  function settleRewards(user, day, now = Date.now()) {
    let gained = 0;
    for (const quest of questState(user, day)) {
      if (quest.done && !quest.claimed) gained += award(user.id, 'quest', quest.id, XP_RULES.quest, day, now);
    }
    const week = weekly(user, day);
    if (week.done && !q.xpEverRef.get(user.id, 'weekly', week.start).n) gained += award(user.id, 'weekly', week.start, XP_RULES.weekly, day, now);
    return gained;
  }

  function weekly(user, day) {
    const start = weekStart(day);
    const rows = q.xpRange.all(user.id, start);
    const core = db.prepare("SELECT day, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND day >= ? AND source NOT IN ('quest','weekly') GROUP BY day").all(user.id, start);
    const goalDays = core.filter((r) => r.day <= addDays(start, 6) && r.xp >= user.daily_goal).length;
    const xp = rows.filter((r) => r.day <= addDays(start, 6)).reduce((s, r) => s + r.xp, 0);
    return { start, goalDays, target: user.weekly_days, xp, done: goalDays >= user.weekly_days, rewarded: q.xpEverRef.get(user.id, 'weekly', start).n > 0, reward: XP_RULES.weekly };
  }

  function checkBadges(user, day, now = Date.now()) {
    const have = new Set(q.badges.all(user.id).map((b) => b.badge_id));
    const completed = q.completedLessons.all(user.id);
    const doneIds = new Set(completed.map((r) => r.lesson_id));
    const words = q.learnedWords.get(user.id).n;
    const xp = q.xpTotal.get(user.id).v;
    const st = streak(user.id, day).count;
    const levelDone = (lv) => availableLessons().filter((l) => l.level === lv).every((l) => doneIds.has(l.id));
    const checks = {
      'first-lesson': completed.length >= 1,
      'five-lessons': completed.length >= 5,
      'ten-lessons': completed.length >= 10,
      perfect: q.totalActivity.get(user.id, 'perfect').n >= 1,
      'unit-master': q.passedUnits.get(user.id).n >= 1,
      'a1-complete': levelDone('A1'),
      'a2-complete': levelDone('A2'),
      'streak-3': st >= 3,
      'streak-7': st >= 7,
      'streak-30': st >= 30,
      'words-25': words >= 25,
      'words-100': words >= 100,
      reviewer: q.totalActivity.get(user.id, 'review').n >= 50,
      speaker: q.totalActivity.get(user.id, 'speak').n >= 1,
      tutor: q.totalActivity.get(user.id, 'ai').n >= 1,
      'xp-500': xp >= 500,
      'xp-2000': xp >= 2000,
      placement: q.totalActivity.get(user.id, 'placement').n >= 1,
    };
    const earned = [];
    for (const b of BADGES) {
      if (!have.has(b.id) && checks[b.id]) { q.addBadge.run(user.id, b.id, now); earned.push(b); }
    }
    return earned;
  }

  // Bir etkinlikten sonra çağrılır: görev ödülleri ve rozetler.
  function afterActivity(user, day, now = Date.now()) {
    const bonusXp = settleRewards(user, day, now);
    const newBadges = checkBadges(user, day, now);
    return { bonusXp, newBadges };
  }

  function summary(user, day) {
    const total = q.xpTotal.get(user.id).v;
    const from = addDays(day, -27);
    const xpRows = q.xpRange.all(user.id, from);
    const actRows = q.activityRange.all(user.id, from);
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = addDays(day, -i);
      const acts = Object.fromEntries(actRows.filter((r) => r.day === d).map((r) => [r.kind, r.count]));
      days.push({ day: d, xp: xpRows.find((r) => r.day === d)?.xp || 0, lessons: acts.lesson || 0, reviews: acts.review || 0, words: acts.learn || 0 });
    }
    return {
      xp: { total, today: q.xpDay.get(user.id, day).v, ...levelFromXp(total) },
      streak: streak(user.id, day),
      quests: questState(user, day),
      weekly: weekly(user, day),
      wordsToday: q.learnedOnDay.get(user.id, day).n,
      days,
      badges: q.badges.all(user.id),
    };
  }

  return { award, track, lessonXp, unitXp, cappedXp, afterActivity, summary, streak, questState, weekly, levels: LEVELS };
}
