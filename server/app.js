import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize as normPath, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import { hashPassword, verifyPassword, createSessionStore, parseCookies, sessionCookie, clearCookie, rateLimiter, SESSION_COOKIE } from './auth.js';
import { createGame, dayFor, isValidTz, schedule, XP_RULES, BADGES, DAY_MS } from './game.js';
import { createTutor, MODES } from './ai.js';
import { BRAND } from '../shared/brand.js';
import {
  getLesson, getUnit, getWord, lessonExerciseCount, isLessonUnlocked, isUnitTestUnlocked,
  UNIT_TEST_SIZE, UNIT_PASS_RATIO, LEVEL_ORDER, availableLessons,
} from '../shared/curriculum.js';
import { SCENARIOS, MINIMAL_PAIRS } from '../shared/content/speaking.js';
import { PLACEMENT, placementResult } from '../shared/content/placement.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const STATIC_DIRS = { '/shared/': join(ROOT, 'shared'), '/': join(ROOT, 'public') };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

const DEFAULT_SETTINGS = { theme: 'system', accent: 'en-US', rate: 0.9, autoplay: true, sound: true, notifications: false, reminderHour: 20, tz: 'Europe/Istanbul' };

function cleanSettings(input, current) {
  const s = { ...DEFAULT_SETTINGS, ...current };
  if (!input || typeof input !== 'object') return s;
  if (['system', 'light', 'dark'].includes(input.theme)) s.theme = input.theme;
  if (['en-US', 'en-GB', 'en-AU', 'en-IN'].includes(input.accent)) s.accent = input.accent;
  if (typeof input.rate === 'number' && input.rate >= 0.5 && input.rate <= 1.5) s.rate = Math.round(input.rate * 100) / 100;
  for (const k of ['autoplay', 'sound', 'notifications']) if (typeof input[k] === 'boolean') s[k] = input[k];
  if (Number.isInteger(input.reminderHour) && input.reminderHour >= 6 && input.reminderHour <= 23) s.reminderHour = input.reminderHour;
  if (isValidTz(input.tz)) s.tz = input.tz;
  return s;
}

const str = (v, { min = 0, max = 200, name = 'Alan' } = {}) => {
  if (typeof v !== 'string') throw bad(`${name} geçersiz.`);
  const t = v.trim();
  if (t.length < min) throw bad(`${name} en az ${min} karakter olmalı.`);
  if (t.length > max) throw bad(`${name} en fazla ${max} karakter olabilir.`);
  return t;
};

export function createApp({ dbFile = process.env.ERCANLINGO_DB || join(ROOT, 'data', 'ercanlingo.db'), tutor = createTutor(), secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const db = openDb(dbFile);
  const sessions = createSessionStore(db);
  const game = createGame(db, { aiEnabled: () => tutor.enabled });
  const authLimit = rateLimiter({ limit: 10, windowMs: 10 * 60_000 });
  const aiLimit = rateLimiter({ limit: 40, windowMs: 60 * 60_000 });
  const guestLimit = rateLimiter({ limit: 20, windowMs: 60 * 60_000 });

  const st = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    insertUser: db.prepare('INSERT INTO users (name, email, pass_hash, is_guest, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    lessonRows: db.prepare('SELECT lesson_id, best_score, attempts, completed_at, last_at FROM lesson_progress WHERE user_id = ?'),
    lessonRow: db.prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?'),
    upsertLesson: db.prepare(`INSERT INTO lesson_progress (user_id, lesson_id, best_score, attempts, completed_at, last_at) VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, lesson_id) DO UPDATE SET best_score = MAX(best_score, excluded.best_score), attempts = attempts + 1,
      completed_at = COALESCE(completed_at, excluded.completed_at), last_at = excluded.last_at`),
    insertResult: db.prepare('INSERT INTO results (user_id, kind, ref, correct, total, xp, wrong_topics, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    recentResults: db.prepare('SELECT kind, ref, correct, total, xp, wrong_topics, created_at FROM results WHERE user_id = ? ORDER BY id DESC LIMIT ?'),
    wordRows: db.prepare('SELECT * FROM word_progress WHERE user_id = ?'),
    wordRow: db.prepare('SELECT * FROM word_progress WHERE user_id = ? AND word_id = ?'),
    ensureWord: db.prepare('INSERT OR IGNORE INTO word_progress (user_id, word_id) VALUES (?, ?)'),
    learnWord: db.prepare('UPDATE word_progress SET in_srs = 1, learned_at = COALESCE(learned_at, ?), learned_day = COALESCE(learned_day, ?), due_at = COALESCE(due_at, ?) WHERE user_id = ? AND word_id = ?'),
    unlearnWord: db.prepare('UPDATE word_progress SET in_srs = 0 WHERE user_id = ? AND word_id = ?'),
    reviewWord: db.prepare('UPDATE word_progress SET in_srs = 1, ease = ?, interval_days = ?, reps = ?, lapses = ?, due_at = ?, correct = correct + ?, wrong = wrong + ?, last_review_at = ?, history = ?, learned_at = COALESCE(learned_at, ?), learned_day = COALESCE(learned_day, ?) WHERE user_id = ? AND word_id = ?'),
    favWord: db.prepare('UPDATE word_progress SET favorite = ? WHERE user_id = ? AND word_id = ?'),
    customWords: db.prepare('SELECT id, en, tr, example, example_tr, created_at FROM custom_words WHERE user_id = ? ORDER BY id DESC'),
    customWord: db.prepare('SELECT * FROM custom_words WHERE user_id = ? AND id = ?'),
    insertCustom: db.prepare('INSERT INTO custom_words (user_id, en, tr, example, example_tr, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    deleteCustom: db.prepare('DELETE FROM custom_words WHERE user_id = ? AND id = ?'),
    countCustom: db.prepare('SELECT COUNT(*) AS n FROM custom_words WHERE user_id = ?'),
    lists: db.prepare('SELECT id, name, created_at FROM word_lists WHERE user_id = ? ORDER BY id'),
    list: db.prepare('SELECT * FROM word_lists WHERE user_id = ? AND id = ?'),
    listItems: db.prepare('SELECT i.list_id, i.word_id FROM word_list_items i JOIN word_lists l ON l.id = i.list_id WHERE l.user_id = ?'),
    insertList: db.prepare('INSERT INTO word_lists (user_id, name, created_at) VALUES (?, ?, ?)'),
    deleteList: db.prepare('DELETE FROM word_lists WHERE user_id = ? AND id = ?'),
    countLists: db.prepare('SELECT COUNT(*) AS n FROM word_lists WHERE user_id = ?'),
    addItem: db.prepare('INSERT OR IGNORE INTO word_list_items (list_id, word_id) VALUES (?, ?)'),
    removeItem: db.prepare('DELETE FROM word_list_items WHERE list_id = ? AND word_id = ?'),
    insertMistake: db.prepare('INSERT INTO mistakes (user_id, source, category, wrong, right, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    mistakeStats: db.prepare('SELECT category, source, COUNT(*) AS n FROM mistakes WHERE user_id = ? AND created_at > ? GROUP BY category, source ORDER BY n DESC LIMIT 12'),
    recentMistakes: db.prepare("SELECT category, wrong, right, created_at FROM mistakes WHERE user_id = ? AND source = 'ai' ORDER BY id DESC LIMIT 8"),
    tutorHistory: db.prepare('SELECT id, role, mode, content, created_at FROM tutor_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?'),
    insertTutor: db.prepare('INSERT INTO tutor_messages (user_id, role, mode, content, created_at) VALUES (?, ?, ?, ?, ?)'),
    clearTutor: db.prepare('DELETE FROM tutor_messages WHERE user_id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  };

  const publicUser = (u) => ({
    id: u.id, name: u.name, email: u.email, isGuest: Boolean(u.is_guest), level: u.level,
    dailyGoal: u.daily_goal, weeklyDays: u.weekly_days, onboarded: Boolean(u.onboarded),
    settings: cleanSettings(null, JSON.parse(u.settings || '{}')), createdAt: u.created_at,
  });
  const tzOf = (u, req) => {
    const header = req.headers['x-timezone'];
    if (isValidTz(header)) return header;
    return JSON.parse(u.settings || '{}').tz || DEFAULT_SETTINGS.tz;
  };

  // Kullanıcıya ait özel kelimeler "u<id>" kimliğiyle saklanır.
  const resolveWord = (userId, wordId) => {
    if (typeof wordId !== 'string' || wordId.length > 80) return null;
    if (/^u\d+$/.test(wordId)) {
      const row = st.customWord.get(userId, Number(wordId.slice(1)));
      return row ? { id: wordId, en: row.en, tr: row.tr } : null;
    }
    return getWord(wordId) || null;
  };

  function completedSet(userId) {
    return new Set(st.lessonRows.all(userId).filter((r) => r.completed_at).map((r) => r.lesson_id));
  }

  function fullState(user, day) {
    const now = Date.now();
    const words = {};
    let due = 0;
    for (const w of st.wordRows.all(user.id)) {
      words[w.word_id] = { favorite: Boolean(w.favorite), inSrs: Boolean(w.in_srs), ease: w.ease, interval: w.interval_days, reps: w.reps, lapses: w.lapses, dueAt: w.due_at, correct: w.correct, wrong: w.wrong, learnedAt: w.learned_at, lastReviewAt: w.last_review_at, history: JSON.parse(w.history) };
      if (w.in_srs && w.due_at && w.due_at <= now) due++;
    }
    const lists = st.lists.all(user.id).map((l) => ({ ...l, items: [] }));
    for (const it of st.listItems.all(user.id)) lists.find((l) => l.id === it.list_id)?.items.push(it.word_id);
    const results = st.recentResults.all(user.id, 40).map((r) => ({ ...r, wrong_topics: JSON.parse(r.wrong_topics) }));
    const weak = {};
    for (const r of results) for (const t of r.wrong_topics) weak[t] = (weak[t] || 0) + 1;
    return {
      user: publicUser(user),
      ai: { enabled: tutor.enabled },
      game: game.summary(user, day),
      lessons: Object.fromEntries(st.lessonRows.all(user.id).map((r) => [r.lesson_id, { best: r.best_score, attempts: r.attempts, completedAt: r.completed_at, lastAt: r.last_at }])),
      words,
      dueCount: due,
      customWords: st.customWords.all(user.id).map((c) => ({ id: `u${c.id}`, en: c.en, tr: c.tr, ex: c.example, exTr: c.example_tr, custom: true })),
      lists,
      results: results.slice(0, 15),
      weakTopics: Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, n]) => ({ topic, n })),
      mistakes: { stats: st.mistakeStats.all(user.id, now - 60 * DAY_MS), recent: st.recentMistakes.all(user.id) },
      today: day,
    };
  }

  function startSession(res, userId) {
    const token = sessions.create(userId);
    res.setHeader('Set-Cookie', sessionCookie(token, { secure: secureCookies }));
  }

  // --- Rotalar ---------------------------------------------------------------------
  const routes = [];
  const route = (method, pattern, handler, { auth = true } = {}) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, re, keys, handler, auth });
  };

  route('GET', '/api/config', () => ({
    appName: BRAND.appName, creator: BRAND.creatorName, version: BRAND.version,
    ai: { enabled: tutor.enabled, model: tutor.enabled ? tutor.model : null },
    xpRules: XP_RULES, badges: BADGES,
  }), { auth: false });

  route('POST', '/api/auth/guest', async ({ body, res, ip }) => {
    if (!guestLimit(ip).ok) throw new HttpError(429, 'Çok fazla misafir hesabı oluşturuldu. Lütfen biraz sonra tekrar dene.');
    const name = body.name ? str(body.name, { min: 1, max: 40, name: 'İsim' }) : 'Misafir';
    const settings = cleanSettings({ tz: body.tz }, {});
    const { lastInsertRowid } = st.insertUser.run(name, null, null, 1, JSON.stringify(settings), Date.now());
    startSession(res, Number(lastInsertRowid));
    return { user: publicUser(st.userById.get(lastInsertRowid)) };
  }, { auth: false });

  route('POST', '/api/auth/register', async ({ body, res, ip, user }) => {
    if (!authLimit(ip).ok) throw new HttpError(429, 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.');
    const name = str(body.name, { min: 1, max: 40, name: 'İsim' });
    const email = str(body.email, { min: 5, max: 254, name: 'E-posta' }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw bad('Geçerli bir e-posta adresi gir.');
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8 || password.length > 128) throw bad('Şifre 8 ile 128 karakter arasında olmalı.');
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) throw bad('Şifre en az bir harf ve bir rakam içermeli.');
    if (st.userByEmail.get(email)) throw new HttpError(409, 'Bu e-posta adresiyle zaten bir hesap var.');
    const hash = await hashPassword(password);
    let id;
    if (user?.is_guest) {
      // Misafir ilerlemesi kaybolmasın: misafir hesabı gerçek hesaba dönüştürülür.
      db.prepare('UPDATE users SET name = ?, email = ?, pass_hash = ?, is_guest = 0 WHERE id = ?').run(name, email, hash, user.id);
      id = user.id;
    } else {
      const settings = cleanSettings({ tz: body.tz }, {});
      id = Number(st.insertUser.run(name, email, hash, 0, JSON.stringify(settings), Date.now()).lastInsertRowid);
    }
    startSession(res, id);
    return { user: publicUser(st.userById.get(id)), upgraded: Boolean(user?.is_guest) };
  }, { auth: false });

  route('POST', '/api/auth/login', async ({ body, res, ip }) => {
    if (!authLimit(ip).ok) throw new HttpError(429, 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const u = email && st.userByEmail.get(email);
    const ok = u ? await verifyPassword(password, u.pass_hash) : (await hashPassword('zamanlama-dengesi'), false);
    if (!ok) throw new HttpError(401, 'E-posta veya şifre hatalı.');
    startSession(res, u.id);
    return { user: publicUser(u) };
  }, { auth: false });

  route('POST', '/api/auth/logout', ({ req, res }) => {
    sessions.destroy(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    res.setHeader('Set-Cookie', clearCookie());
    return { ok: true };
  }, { auth: false });

  route('GET', '/api/me', ({ user }) => ({ user: publicUser(user) }));

  route('PATCH', '/api/me', ({ user, body }) => {
    const sets = [];
    const vals = [];
    if (body.name !== undefined) { sets.push('name = ?'); vals.push(str(body.name, { min: 1, max: 40, name: 'İsim' })); }
    if (body.level !== undefined) {
      if (!LEVEL_ORDER.includes(body.level)) throw bad('Geçersiz seviye.');
      sets.push('level = ?'); vals.push(body.level);
    }
    if (body.dailyGoal !== undefined) {
      if (![10, 20, 30, 50, 80].includes(body.dailyGoal)) throw bad('Günlük hedef 10, 20, 30, 50 veya 80 XP olabilir.');
      sets.push('daily_goal = ?'); vals.push(body.dailyGoal);
    }
    if (body.weeklyDays !== undefined) {
      if (!Number.isInteger(body.weeklyDays) || body.weeklyDays < 1 || body.weeklyDays > 7) throw bad('Haftalık hedef 1-7 gün olmalı.');
      sets.push('weekly_days = ?'); vals.push(body.weeklyDays);
    }
    if (body.onboarded === true) sets.push('onboarded = 1');
    if (body.settings !== undefined) { sets.push('settings = ?'); vals.push(JSON.stringify(cleanSettings(body.settings, JSON.parse(user.settings || '{}')))); }
    if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, user.id);
    return { user: publicUser(st.userById.get(user.id)) };
  });

  route('DELETE', '/api/me', ({ user, res }) => {
    tx(db, () => { st.deleteUserSessions.run(user.id); st.deleteUser.run(user.id); });
    res.setHeader('Set-Cookie', clearCookie());
    return { ok: true };
  });

  route('GET', '/api/me/export', ({ user, req, res }) => {
    const data = fullState(user, dayFor(Date.now(), tzOf(user, req)));
    data.tutorMessages = st.tutorHistory.all(user.id, 1000).reverse();
    res.setHeader('Content-Disposition', 'attachment; filename="ercanlingo-verilerim.json"');
    return data;
  });

  route('GET', '/api/state', ({ user, req }) => fullState(user, dayFor(Date.now(), tzOf(user, req))));

  route('POST', '/api/lessons/complete', ({ user, body, req }) => {
    const lesson = getLesson(body.lessonId);
    if (!lesson || lesson.planned) throw new HttpError(404, 'Ders bulunamadı.');
    const total = lessonExerciseCount(lesson);
    const correct = body.correct;
    if (body.total !== total || !Number.isInteger(correct) || correct < 0 || correct > total) throw bad('Ders sonucu geçersiz.');
    const done = completedSet(user.id);
    if (!isLessonUnlocked(lesson.id, done, user.level)) throw new HttpError(403, 'Bu ders henüz kilitli.');
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    const already = done.has(lesson.id);
    const passed = correct / total >= XP_RULES.lessonPassRatio;
    const perfect = correct === total;
    const wrongTopics = Array.isArray(body.wrongTopics) ? [...new Set(body.wrongTopics.filter((t) => typeof t === 'string' && t.length < 60))].slice(0, 10) : [];
    const wrongWords = Array.isArray(body.wrongWordIds) ? body.wrongWordIds.filter((id) => lesson.wordIds.includes(id)) : [];
    return tx(db, () => {
      const { xp, reason, repeat } = game.lessonXp(user.id, lesson.id, correct, total, already, day);
      game.award(user.id, repeat ? 'lesson-repeat' : 'lesson', lesson.id, xp, day, now);
      st.upsertLesson.run(user.id, lesson.id, Math.round((correct / total) * 100), passed ? now : null, now);
      st.insertResult.run(user.id, 'lesson', lesson.id, correct, total, xp, JSON.stringify(wrongTopics), day, now);
      for (const t of wrongTopics) if (!['vocab', 'listening', 'reading'].includes(t)) st.insertMistake.run(user.id, 'exercise', t, '', '', now);
      let newWords = 0;
      if (passed) {
        game.track(user.id, day, 'lesson');
        if (perfect) game.track(user.id, day, 'perfect');
        for (const wid of lesson.wordIds) {
          st.ensureWord.run(user.id, wid);
          const before = st.wordRow.get(user.id, wid);
          if (!before.learned_at) newWords++;
          st.learnWord.run(now, day, now + DAY_MS, user.id, wid);
        }
        if (newWords) game.track(user.id, day, 'learn', newWords);
      } else {
        game.track(user.id, day, 'attempt');
      }
      // Derste yanlış yapılan kelimeler tekrar listesinde öne çekilir.
      for (const wid of wrongWords) {
        const row = st.wordRow.get(user.id, wid);
        if (row?.in_srs) {
          const c = schedule(row, 0, now);
          st.reviewWord.run(c.ease, c.interval_days, c.reps, c.lapses, c.due_at, 0, 1, now, row.history, now, day, user.id, wid);
        }
      }
      const extra = game.afterActivity(user, day, now);
      return { passed, perfect, firstCompletion: passed && !already, xp, reason, bonusXp: extra.bonusXp, newBadges: extra.newBadges, newWords, state: fullState(st.userById.get(user.id), day) };
    });
  });

  route('POST', '/api/units/complete', ({ user, body, req }) => {
    const unit = getUnit(body.unitId);
    if (!unit || unit.planned) throw new HttpError(404, 'Ünite bulunamadı.');
    const { correct } = body;
    if (body.total !== UNIT_TEST_SIZE || !Number.isInteger(correct) || correct < 0 || correct > UNIT_TEST_SIZE) throw bad('Test sonucu geçersiz.');
    if (!isUnitTestUnlocked(unit.id, completedSet(user.id))) throw new HttpError(403, 'Ünite testini açmak için ünitedeki tüm dersleri bitir.');
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    const wrongTopics = Array.isArray(body.wrongTopics) ? [...new Set(body.wrongTopics.filter((t) => typeof t === 'string' && t.length < 60))].slice(0, 10) : [];
    return tx(db, () => {
      const r = game.unitXp(user.id, unit.id, correct, UNIT_TEST_SIZE, day);
      game.award(user.id, r.source || 'unit', unit.id, r.xp, day, now);
      st.insertResult.run(user.id, 'unit', unit.id, correct, UNIT_TEST_SIZE, r.xp, JSON.stringify(wrongTopics), day, now);
      game.track(user.id, day, 'unit');
      const extra = game.afterActivity(user, day, now);
      return { passed: correct / UNIT_TEST_SIZE >= UNIT_PASS_RATIO, xp: r.xp, reason: r.reason, bonusXp: extra.bonusXp, newBadges: extra.newBadges, state: fullState(user, day) };
    });
  });

  route('POST', '/api/placement', ({ user, body, req }) => {
    if (!Array.isArray(body.answers) || body.answers.length !== PLACEMENT.length) throw bad('Test cevapları eksik.');
    const answers = body.answers.map((a) => (Number.isInteger(a) ? a : -1));
    const result = placementResult(answers);
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    const correct = answers.filter((a, i) => a === PLACEMENT[i].answer).length;
    st.insertResult.run(user.id, 'placement', result.recommended, correct, PLACEMENT.length, 0, '[]', day, now);
    game.track(user.id, day, 'placement');
    const extra = game.afterActivity(user, day, now);
    return { ...result, correct, total: PLACEMENT.length, newBadges: extra.newBadges };
  });

  route('POST', '/api/words/review', ({ user, body, req }) => {
    const word = resolveWord(user.id, body.wordId);
    if (!word) throw new HttpError(404, 'Kelime bulunamadı.');
    if (![0, 1, 2, 3].includes(body.grade)) throw bad('Geçersiz değerlendirme.');
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    return tx(db, () => {
      st.ensureWord.run(user.id, word.id);
      const row = st.wordRow.get(user.id, word.id);
      const wasDue = Boolean(row.in_srs && row.due_at && row.due_at <= now);
      const c = schedule(row, body.grade, now);
      const history = [...JSON.parse(row.history), { t: now, g: body.grade }].slice(-20);
      const ok = body.grade > 0;
      st.reviewWord.run(c.ease, c.interval_days, c.reps, c.lapses, c.due_at, ok ? 1 : 0, ok ? 0 : 1, now, JSON.stringify(history), now, day, user.id, word.id);
      let xp = 0;
      if (wasDue && ok) xp = game.award(user.id, 'review', word.id, game.cappedXp(user.id, day, 'review', XP_RULES.reviewPerWord, XP_RULES.reviewDailyCap), day, now);
      game.track(user.id, day, 'review');
      const extra = game.afterActivity(user, day, now);
      return { xp, wasDue, dueAt: c.due_at, interval: c.interval_days, bonusXp: extra.bonusXp, newBadges: extra.newBadges };
    });
  });

  route('POST', '/api/words/favorite', ({ user, body }) => {
    const word = resolveWord(user.id, body.wordId);
    if (!word) throw new HttpError(404, 'Kelime bulunamadı.');
    st.ensureWord.run(user.id, word.id);
    st.favWord.run(body.favorite ? 1 : 0, user.id, word.id);
    return { ok: true, favorite: Boolean(body.favorite) };
  });

  route('POST', '/api/words/srs', ({ user, body, req }) => {
    const word = resolveWord(user.id, body.wordId);
    if (!word) throw new HttpError(404, 'Kelime bulunamadı.');
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    st.ensureWord.run(user.id, word.id);
    if (body.add) st.learnWord.run(now, day, now, user.id, word.id);
    else st.unlearnWord.run(user.id, word.id);
    return { ok: true };
  });

  route('POST', '/api/custom-words', ({ user, body, req }) => {
    if (st.countCustom.get(user.id).n >= 500) throw bad('En fazla 500 özel kelime ekleyebilirsin.');
    const en = str(body.en, { min: 1, max: 60, name: 'İngilizce kelime' });
    const tr = str(body.tr, { min: 1, max: 80, name: 'Türkçe anlam' });
    const ex = body.ex ? str(body.ex, { max: 200, name: 'Örnek cümle' }) : '';
    const exTr = body.exTr ? str(body.exTr, { max: 200, name: 'Örnek çevirisi' }) : '';
    const now = Date.now();
    const id = `u${st.insertCustom.run(user.id, en, tr, ex, exTr, now).lastInsertRowid}`;
    st.ensureWord.run(user.id, id);
    st.learnWord.run(now, dayFor(now, tzOf(user, req)), now, user.id, id);
    return { word: { id, en, tr, ex, exTr, custom: true } };
  });

  route('DELETE', '/api/custom-words/:id', ({ user, params }) => {
    const m = /^u(\d+)$/.exec(params.id);
    if (!m) throw new HttpError(404, 'Kelime bulunamadı.');
    tx(db, () => {
      st.deleteCustom.run(user.id, Number(m[1]));
      db.prepare('DELETE FROM word_progress WHERE user_id = ? AND word_id = ?').run(user.id, params.id);
      db.prepare('DELETE FROM word_list_items WHERE word_id = ? AND list_id IN (SELECT id FROM word_lists WHERE user_id = ?)').run(params.id, user.id);
    });
    return { ok: true };
  });

  route('POST', '/api/lists', ({ user, body }) => {
    if (st.countLists.get(user.id).n >= 30) throw bad('En fazla 30 liste oluşturabilirsin.');
    const name = str(body.name, { min: 1, max: 40, name: 'Liste adı' });
    const id = Number(st.insertList.run(user.id, name, Date.now()).lastInsertRowid);
    return { list: { id, name, items: [] } };
  });

  route('DELETE', '/api/lists/:id', ({ user, params }) => {
    st.deleteList.run(user.id, Number(params.id));
    return { ok: true };
  });

  route('POST', '/api/lists/:id/items', ({ user, params, body }) => {
    const list = st.list.get(user.id, Number(params.id));
    if (!list) throw new HttpError(404, 'Liste bulunamadı.');
    if (!resolveWord(user.id, body.wordId)) throw new HttpError(404, 'Kelime bulunamadı.');
    if (body.add === false) st.removeItem.run(list.id, body.wordId);
    else st.addItem.run(list.id, body.wordId);
    return { ok: true };
  });

  route('POST', '/api/speaking/complete', ({ user, body, req }) => {
    if (!SCENARIOS.some((s) => s.id === body.scenarioId)) throw new HttpError(404, 'Senaryo bulunamadı.');
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    return tx(db, () => {
      const doneToday = db.prepare("SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND day = ? AND source = 'speak' AND ref = ?").get(user.id, day, body.scenarioId).n;
      const xp = doneToday ? 0 : game.award(user.id, 'speak', body.scenarioId, game.cappedXp(user.id, day, 'speak', XP_RULES.speakPerScenario, XP_RULES.speakDailyCap), day, now);
      game.track(user.id, day, 'speak');
      const extra = game.afterActivity(user, day, now);
      return { xp, reason: xp ? 'Senaryo tamamlandı.' : 'Bu senaryonun bugünkü XP ödülü alındı ya da günlük konuşma sınırına ulaşıldı.', bonusXp: extra.bonusXp, newBadges: extra.newBadges };
    });
  });

  route('POST', '/api/listening/answer', ({ user, body, req }) => {
    if (!MINIMAL_PAIRS.some((p) => p.id === body.pairId)) throw new HttpError(404, 'Alıştırma bulunamadı.');
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    return tx(db, () => {
      let xp = 0;
      if (body.correct === true) {
        xp = game.award(user.id, 'listen', body.pairId, game.cappedXp(user.id, day, 'listen', XP_RULES.listenPerCorrect, XP_RULES.listenDailyCap), day, now);
        game.track(user.id, day, 'listen');
      }
      const extra = game.afterActivity(user, day, now);
      return { xp, bonusXp: extra.bonusXp, newBadges: extra.newBadges };
    });
  });

  route('GET', '/api/ai/history', ({ user }) => ({ enabled: tutor.enabled, messages: st.tutorHistory.all(user.id, 60).reverse() }));

  route('DELETE', '/api/ai/history', ({ user }) => { st.clearTutor.run(user.id); return { ok: true }; });

  route('POST', '/api/ai/chat', async ({ user, body, req }) => {
    if (!tutor.enabled) throw new HttpError(503, 'AI öğretmen şu anda kullanılamıyor: sunucuda bir Anthropic API anahtarı (ANTHROPIC_API_KEY) tanımlı değil.');
    const mode = Object.hasOwn(MODES, body.mode) ? body.mode : 'chat';
    const text = str(body.text, { min: 1, max: 3000, name: 'Mesaj' });
    const limit = aiLimit(`u${user.id}`);
    if (!limit.ok) throw new HttpError(429, `Saatlik mesaj sınırına ulaştın. ${Math.ceil(limit.retryAfter / 60)} dakika sonra tekrar dene.`);
    const now = Date.now();
    const day = dayFor(now, tzOf(user, req));
    // Son mesajlar bağlam olarak gönderilir; roller sırayla olmalı ve kullanıcıyla başlamalı.
    const past = st.tutorHistory.all(user.id, 16).reverse().map((m) => ({ role: m.role, content: m.content }));
    const history = [];
    for (const m of [...past, { role: 'user', content: text }]) {
      if (history.length && history.at(-1).role === m.role) history.at(-1).content += `\n\n${m.content}`;
      else history.push({ ...m });
    }
    while (history.length && history[0].role !== 'user') history.shift();
    const frequent = st.mistakeStats.all(user.id, now - 30 * DAY_MS).filter((m) => m.source === 'ai').slice(0, 4).map((m) => m.category);
    let out;
    try {
      out = await tutor.reply({ user, mode, history, frequentMistakes: frequent });
    } catch (err) {
      console.error('AI hatası:', err.status || '', err.message);
      throw new HttpError(err.status === 429 ? 429 : 502, err.status === 429 ? 'AI servisi şu an yoğun. Lütfen biraz sonra tekrar dene.' : 'AI öğretmene şu anda ulaşılamıyor. Lütfen biraz sonra tekrar dene.');
    }
    tx(db, () => {
      st.insertTutor.run(user.id, 'user', mode, text, now);
      st.insertTutor.run(user.id, 'assistant', mode, out.reply, Date.now());
      for (const m of out.mistakes) st.insertMistake.run(user.id, 'ai', m.category, m.wrong, m.right, now);
      game.track(user.id, day, 'ai');
    });
    const extra = game.afterActivity(user, day, now);
    return { reply: out.reply, mistakes: out.mistakes, bonusXp: extra.bonusXp, newBadges: extra.newBadges };
  });

  // --- HTTP katmanı -----------------------------------------------------------------
  async function readJson(req) {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return {};
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 64 * 1024) throw new HttpError(413, 'İstek çok büyük.');
      chunks.push(c);
    }
    if (!size) return {};
    if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'JSON bekleniyor.');
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}; } catch { throw bad('Geçersiz JSON.'); }
  }

  const send = (res, status, data) => {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  };

  async function handleApi(req, res, url) {
    const match = routes.map((r) => ({ r, m: r.method === req.method && r.re.exec(url.pathname) })).find((x) => x.m);
    if (!match) return send(res, 404, { error: 'Bulunamadı.' });
    // CSRF koruması: durum değiştiren isteklerde özel başlık zorunlu (başka siteler bunu gönderemez).
    if (req.method !== 'GET' && req.headers['x-ercanlingo'] !== '1') return send(res, 403, { error: 'Geçersiz istek kaynağı.' });
    const user = sessions.user(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    if (match.r.auth && !user) return send(res, 401, { error: 'Oturum bulunamadı. Lütfen giriş yap.' });
    const params = Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m[i + 1])]));
    const ip = req.socket.remoteAddress || 'local';
    const body = await readJson(req);
    const out = await match.r.handler({ req, res, url, body, params, user, ip });
    send(res, 200, out);
  }

  async function handleStatic(req, res, url) {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    const prefix = pathname.startsWith('/shared/') ? '/shared/' : '/';
    const base = STATIC_DIRS[prefix];
    let file = normPath(join(base, pathname.slice(prefix.length)));
    if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info) {
      if (extname(pathname)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
      file = join(STATIC_DIRS['/'], 'index.html'); // Tek sayfa uygulaması yönlendirmesi
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function handler(req, res) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
    res.setHeader('X-Frame-Options', 'DENY');
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else await handleStatic(req, res, url);
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      if (!res.headersSent) send(res, err instanceof HttpError ? err.status : 500, { error: err instanceof HttpError ? err.message : 'Beklenmeyen bir sunucu hatası oluştu.' });
    }
  }

  setInterval(() => sessions.purge(), 3_600_000).unref();
  return { handler, db };
}

export const _test = { availableLessons };
