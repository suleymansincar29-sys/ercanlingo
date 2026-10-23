// Sunucu API testleri: kimlik doğrulama, XP kuralları, aralıklı tekrar, güvenlik ve AI proxy.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';
import { createTutor, extractMistakes } from '../server/ai.js';
import { schedule, levelFromXp } from '../server/game.js';
import { checkTyped, normalize, wordMatch } from '../shared/text.js';
import { availableLessons, buildLessonExercises, lessonExerciseCount, allWords, isLessonUnlocked } from '../shared/curriculum.js';
import { placementResult, PLACEMENT } from '../shared/content/placement.js';

// Sahte Anthropic API: gerçek SDK'nın gönderdiği isteği yakalar ve sabit bir cevap döner.
let lastAiRequest = null;
const fakeAnthropic = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    lastAiRequest = { url: req.url, headers: req.headers, body: JSON.parse(body) };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: lastAiRequest.body.model, stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: 'Doğrusu: **I go to school.**\n<<<HATALAR>>>[{"category":"present simple","wrong":"I am go","right":"I go"}]' }],
    }));
  });
});

let base, baseAi, apps = [];
const servers = [];
async function start(opts) {
  const app = createApp({ dbFile: ':memory:', ...opts });
  apps.push(app);
  const srv = createServer(app.handler);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  servers.push(srv);
  return `http://127.0.0.1:${srv.address().port}`;
}

before(async () => {
  await new Promise((r) => fakeAnthropic.listen(0, '127.0.0.1', r));
  base = await start({ tutor: createTutor({ apiKey: '' }) });
  baseAi = await start({ tutor: createTutor({ apiKey: 'test-key', baseURL: `http://127.0.0.1:${fakeAnthropic.address().port}` }) });
});
after(() => { servers.forEach((s) => s.close()); fakeAnthropic.close(); });

function client(root = base) {
  let cookie = '';
  return async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(root + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-ercanlingo': '1', 'x-timezone': 'Europe/Istanbul', ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
  };
}

test('müfredat: A1 ve A2 dersleri eksiksiz ve tutarlı', () => {
  const lessons = availableLessons();
  assert.equal(lessons.filter((l) => l.level === 'A1').length, 15);
  assert.equal(lessons.filter((l) => l.level === 'A2').length, 12);
  for (const l of lessons) {
    assert.equal(l.words.length, 6, l.id);
    assert.ok(l.grammar.examples.length >= 3, l.id);
    assert.equal(l.reading.qs.length, 2, l.id);
    const ex = buildLessonExercises(l, 1);
    assert.equal(ex.length, lessonExerciseCount(l));
    for (const e of ex) {
      if (e.options) assert.ok(e.options.includes(e.answer), `${l.id} ${e.type}: cevap seçeneklerde yok`);
      if (e.type === 'build') assert.ok(e.answer.split(' ').every((t) => e.tiles.includes(t)), `${l.id} build`);
      if (e.accepted) assert.ok(checkTyped(e.accepted[0], e.accepted).correct, `${l.id} ${e.type}`);
    }
    // Her ders temel soru türlerini içerir.
    const types = new Set(ex.map((e) => e.type));
    for (const t of ['match', 'mc', 'fill', 'listen', 'listen-tr', 'build', 'type', 'tr2en', 'fix', 'dlg', 'read']) assert.ok(types.has(t), `${l.id} ${t} eksik`);
  }
  const all = new Set(lessons.flatMap((l) => buildLessonExercises(l, 1).map((e) => e.type)));
  assert.ok(all.has('en2tr'));
  assert.equal(allWords().length, 162);
});

test('metin karşılaştırma: kısaltmalar, noktalama ve küçük yazım hatası', () => {
  assert.equal(normalize("I'm fine, thanks!"), 'i am fine thanks');
  assert.ok(checkTyped("She doesn't like coffee", ['She does not like coffee']).correct);
  assert.ok(checkTyped('where are you from', ['Where are you from?']).correct);
  const typo = checkTyped('I have a headahe', ['I have a headache']);
  assert.ok(typo.correct && typo.typo);
  assert.equal(checkTyped('I am fine', ['I am a student']).correct, false);
  assert.equal(wordMatch('hello my name is can', 'Hello, my name is Deniz.').ratio, 0.8);
});

test('aralıklı tekrar: yanlış cevap kısa süre sonra, doğru cevaplar giderek uzayan aralıklarla', () => {
  const now = 0;
  let c = schedule({}, 2, now);
  assert.equal(c.interval_days, 1);
  c = schedule(c, 2, now);
  assert.equal(c.interval_days, 3);
  c = schedule(c, 2, now);
  assert.ok(c.interval_days >= 7);
  const lapse = schedule(c, 0, now);
  assert.equal(lapse.reps, 0);
  assert.equal(lapse.due_at, 10 * 60_000);
  assert.ok(lapse.ease < c.ease);
});

test('seviye eşikleri ve seviye testi', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(300).level, 3);
  const all = PLACEMENT.map((q) => q.answer);
  assert.equal(placementResult(all).recommended, 'C1');
  const a1Only = PLACEMENT.map((q) => (q.level === 'A1' ? q.answer : -1));
  assert.equal(placementResult(a1Only).recommended, 'A2');
  assert.equal(placementResult(PLACEMENT.map(() => -1)).recommended, 'A1');
});

test('kilit kuralı: sıralı açılır, seçilen seviyenin altı serbesttir', () => {
  const done = new Set();
  assert.ok(isLessonUnlocked('a1-u1-l1', done, 'A1'));
  assert.equal(isLessonUnlocked('a1-u1-l2', done, 'A1'), false);
  assert.equal(isLessonUnlocked('a2-u1-l1', done, 'A1'), false);
  assert.ok(isLessonUnlocked('a2-u1-l1', done, 'A2'));
  assert.ok(isLessonUnlocked('a1-u3-l2', done, 'A2'));
});

test('güvenlik: CSRF başlığı, oturum, güvenlik başlıkları, dizin dışına çıkma', async () => {
  const r1 = await fetch(`${base}/api/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r1.status, 403);
  const r2 = await fetch(`${base}/api/state`);
  assert.equal(r2.status, 401);
  const r3 = await fetch(`${base}/`);
  assert.match(r3.headers.get('content-security-policy'), /default-src 'self'/);
  const r4 = await fetch(`${base}/shared/..%2f..%2fpackage.json`);
  assert.notEqual(r4.status, 200);
  const r5 = await fetch(`${base}/shared/brand.js`);
  assert.match(await r5.text(), /Ercan Sincar/);
});

test('kayıt, giriş ve form doğrulaması', async () => {
  const api = client();
  assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'kötü', password: 'abcdefgh1' } })).status, 400);
  assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'a@b.co', password: 'kisa1' } })).status, 400);
  assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'a@b.co', password: 'sadeceharf' } })).status, 400);
  const ok = await api('/api/auth/register', { method: 'POST', body: { name: 'Ayşe', email: 'Ayse@Example.com', password: 'guvenli123' } });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
  assert.equal(ok.data.user.email, 'ayse@example.com');
  assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'B', email: 'ayse@example.com', password: 'guvenli123' } })).status, 409);
  await api('/api/auth/logout', { method: 'POST' });
  assert.equal((await api('/api/state')).status, 401);
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'ayse@example.com', password: 'yanlis123' } })).status, 401);
  const login = await api('/api/auth/login', { method: 'POST', body: { email: 'ayse@example.com', password: 'guvenli123' } });
  assert.equal(login.data.user.name, 'Ayşe');
});

test('misafir ilerlemesi hesap oluşturunca korunur', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: { name: 'Misafir Can' } });
  await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 12, total: 15 } });
  const reg = await api('/api/auth/register', { method: 'POST', body: { name: 'Can', email: 'can@example.com', password: 'sifre1234' } });
  assert.equal(reg.data.upgraded, true);
  const st = await api('/api/state');
  assert.ok(st.data.lessons['a1-u1-l1'].completedAt);
  assert.equal(st.data.user.isGuest, false);
});

test('ders XP kuralları: ilk geçiş, tekrar sınırı, başarısızlık, kilit ve hile denemesi', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: {} });
  const fail = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 5, total: 15 } });
  assert.equal(fail.data.xp, 0);
  assert.equal(fail.data.passed, false);
  const locked = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l2', correct: 15, total: 15 } });
  assert.equal(locked.status, 403);
  const bogus = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 500, total: 500 } });
  assert.equal(bogus.status, 400);
  const first = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 15, total: 15 } });
  assert.equal(first.data.xp, 30);
  assert.equal(first.data.newWords, 6);
  assert.ok(first.data.newBadges.some((b) => b.id === 'first-lesson'));
  const rep1 = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 15, total: 15 } });
  const rep2 = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 15, total: 15 } });
  const rep3 = await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 15, total: 15 } });
  assert.equal(rep1.data.xp, 5);
  assert.equal(rep2.data.xp, 5);
  assert.equal(rep3.data.xp, 0);
  const st = (await api('/api/state')).data;
  assert.equal(st.game.streak.count, 1);
  assert.equal(Object.values(st.words).filter((w) => w.inSrs).length, 6);
  // Günlük hedef görevi (30 XP) ödüllendirildi, ikinci kez ödüllendirilmez.
  assert.ok(st.game.quests.find((q) => q.id === 'xpgoal').claimed);
});

test('ünite testi yalnızca dersler bitince açılır ve ilk geçişte 40 XP verir', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: {} });
  assert.equal((await api('/api/units/complete', { method: 'POST', body: { unitId: 'a1-u1', correct: 15, total: 15 } })).status, 403);
  for (const id of ['a1-u1-l1', 'a1-u1-l2', 'a1-u1-l3']) await api('/api/lessons/complete', { method: 'POST', body: { lessonId: id, correct: 15, total: 15 } });
  const low = await api('/api/units/complete', { method: 'POST', body: { unitId: 'a1-u1', correct: 9, total: 15 } });
  assert.equal(low.data.xp, 0);
  const pass = await api('/api/units/complete', { method: 'POST', body: { unitId: 'a1-u1', correct: 12, total: 15 } });
  assert.equal(pass.data.xp, 40);
  const again = await api('/api/units/complete', { method: 'POST', body: { unitId: 'a1-u1', correct: 15, total: 15 } });
  assert.equal(again.data.xp, 5);
  const again2 = await api('/api/units/complete', { method: 'POST', body: { unitId: 'a1-u1', correct: 15, total: 15 } });
  assert.equal(again2.data.xp, 0);
});

test('kelime tekrarı: yalnızca vakti gelen kelime XP kazandırır; favori, liste ve özel kelime', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: {} });
  await api('/api/lessons/complete', { method: 'POST', body: { lessonId: 'a1-u1-l1', correct: 15, total: 15 } });
  const notDue = await api('/api/words/review', { method: 'POST', body: { wordId: 'hello', grade: 2 } });
  assert.equal(notDue.data.xp, 0);
  assert.equal(notDue.data.wasDue, false);
  const wrong = await api('/api/words/review', { method: 'POST', body: { wordId: 'please', grade: 0 } });
  assert.ok(wrong.data.dueAt - Date.now() <= 10 * 60_000 + 1000);
  // Elle tekrar listesine eklenen kelime hemen tekrar vakti gelmiş sayılır.
  await api('/api/words/srs', { method: 'POST', body: { wordId: 'mother', add: true } });
  const due = await api('/api/words/review', { method: 'POST', body: { wordId: 'mother', grade: 2 } });
  assert.equal(due.data.xp, 1);
  assert.equal((await api('/api/words/review', { method: 'POST', body: { wordId: 'yok-boyle-kelime', grade: 2 } })).status, 404);
  await api('/api/words/favorite', { method: 'POST', body: { wordId: 'hello', favorite: true } });
  const list = await api('/api/lists', { method: 'POST', body: { name: 'Seyahat' } });
  await api(`/api/lists/${list.data.list.id}/items`, { method: 'POST', body: { wordId: 'hello' } });
  const cw = await api('/api/custom-words', { method: 'POST', body: { en: 'sunset', tr: 'gün batımı', ex: 'What a sunset!' } });
  assert.match(cw.data.word.id, /^u\d+$/);
  assert.equal((await api('/api/custom-words', { method: 'POST', body: { en: '', tr: 'x' } })).status, 400);
  const st = (await api('/api/state')).data;
  assert.ok(st.words.hello.favorite);
  assert.deepEqual(st.lists[0].items, ['hello']);
  assert.equal(st.customWords[0].en, 'sunset');
  assert.ok(st.words[cw.data.word.id].inSrs);
  // Başka kullanıcının listesine erişilemez.
  const other = client();
  await other('/api/auth/guest', { method: 'POST', body: {} });
  assert.equal((await other(`/api/lists/${list.data.list.id}/items`, { method: 'POST', body: { wordId: 'hello' } })).status, 404);
});

test('konuşma senaryosu XP: senaryo başına günde bir kez', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: {} });
  assert.equal((await api('/api/speaking/complete', { method: 'POST', body: { scenarioId: 'restaurant' } })).data.xp, 5);
  assert.equal((await api('/api/speaking/complete', { method: 'POST', body: { scenarioId: 'restaurant' } })).data.xp, 0);
  assert.equal((await api('/api/speaking/complete', { method: 'POST', body: { scenarioId: 'nope' } })).status, 404);
  for (let i = 0; i < 15; i++) await api('/api/listening/answer', { method: 'POST', body: { pairId: 'ship-sheep', correct: true } });
  const st = (await api('/api/state')).data;
  assert.equal(st.game.days.at(-1).xp - 5 - st.game.quests.filter((q) => q.claimed).length * 10, 10);
});

test('ayarlar ve hesap silme', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: {} });
  const r = await api('/api/me', { method: 'PATCH', body: { level: 'A2', dailyGoal: 50, settings: { theme: 'dark', accent: 'en-GB', rate: 1.1, evil: 'x' } } });
  assert.equal(r.data.user.level, 'A2');
  assert.equal(r.data.user.settings.theme, 'dark');
  assert.equal(r.data.user.settings.accent, 'en-GB');
  assert.equal(r.data.user.settings.evil, undefined);
  assert.equal((await api('/api/me', { method: 'PATCH', body: { dailyGoal: 9999 } })).status, 400);
  assert.equal((await api('/api/me', { method: 'PATCH', body: { level: 'Z9' } })).status, 400);
  const exp = await api('/api/me/export');
  assert.equal(exp.data.user.level, 'A2');
  await api('/api/me', { method: 'DELETE' });
  assert.equal((await api('/api/state')).status, 401);
});

test('AI öğretmen: anahtar yoksa açıkça 503 döner', async () => {
  const api = client();
  await api('/api/auth/guest', { method: 'POST', body: {} });
  const r = await api('/api/ai/chat', { method: 'POST', body: { text: 'Hello' } });
  assert.equal(r.status, 503);
  assert.match(r.data.error, /ANTHROPIC_API_KEY/);
  assert.equal((await api('/api/config')).data.ai.enabled, false);
});

test('AI öğretmen: sunucu üzerinden Claude API çağrısı, hata kaydı ve anahtarın gizliliği', async () => {
  const api = client(baseAi);
  await api('/api/auth/guest', { method: 'POST', body: { name: 'Ece' } });
  const r = await api('/api/ai/chat', { method: 'POST', body: { mode: 'correct', text: 'I am go to school.' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.reply, 'Doğrusu: **I go to school.**');
  assert.equal(r.data.mistakes[0].category, 'present simple');
  assert.equal(lastAiRequest.url, '/v1/messages?beta=true');
  assert.ok(lastAiRequest.headers['x-api-key'] === 'test-key' || lastAiRequest.headers.authorization === 'Bearer test-key');
  assert.equal(lastAiRequest.body.model, 'claude-opus-5-5');
  assert.match(lastAiRequest.body.system, /Seviyesi: A1/);
  assert.match(lastAiRequest.body.system, /düzelt/);
  assert.deepEqual(lastAiRequest.body.messages, [{ role: 'user', content: 'I am go to school.' }]);
  // İkinci mesajda önceki konuşma bağlam olarak gönderilir.
  await api('/api/ai/chat', { method: 'POST', body: { mode: 'chat', text: 'Thanks!' } });
  assert.equal(lastAiRequest.body.messages.length, 3);
  const st = (await api('/api/state')).data;
  assert.equal(st.mistakes.stats[0].category, 'present simple');
  assert.ok(st.game.badges.some((b) => b.badge_id === 'tutor'));
  const hist = await api('/api/ai/history');
  assert.equal(hist.data.messages.length, 4);
  // Anahtar hiçbir yanıtta istemciye gönderilmez.
  const cfg = await fetch(`${baseAi}/api/config`).then((x) => x.text());
  assert.doesNotMatch(cfg, /test-key/);
  assert.equal((await api('/api/ai/chat', { method: 'POST', body: { text: 'x'.repeat(3001) } })).status, 400);
});

test('AI cevabındaki hata işareti ayıklanır, bozuk işaret yok sayılır', () => {
  assert.deepEqual(extractMistakes('Merhaba').mistakes, []);
  assert.equal(extractMistakes('Cevap\n<<<HATALAR>>>[bozuk').reply, 'Cevap');
  assert.equal(extractMistakes('C\n<<<HATALAR>>>[{"category":"uydurma","wrong":"a","right":"b"}]').mistakes[0].category, 'other');
});
