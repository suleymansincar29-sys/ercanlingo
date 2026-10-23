// Uçtan uca tarayıcı testi: sunucuyu geçici veritabanıyla başlatır ve ana kullanıcı akışlarını Chromium'da dener.
// Çalıştırma: npm run test:e2e   (ekran görüntüleri test/screenshots/ altına yazılır)
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }

const dir = mkdtempSync(join(tmpdir(), 'ercanlingo-e2e-'));
process.env.ERCANLINGO_DB = join(dir, 'e2e.db');
delete process.env.ANTHROPIC_API_KEY;
const { createApp } = await import('../server/app.js');
const { handler } = createApp({ dbFile: process.env.ERCANLINGO_DB });
const server = createServer(handler);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const shots = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await playwright.chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !m.text().includes('ERR_') && !/status of 40[19]/.test(m.text())) errors.push(`console: ${m.text()}`); });
};
const step = async (name, fn) => { process.stdout.write(`• ${name} … `); await fn(); console.log('tamam'); };

// Oynatıcıdaki mevcut soruyu doğru (veya bilerek yanlış) cevaplar.
async function answer(page, { wrong = false } = {}) {
  const ex = await page.evaluate(() => window.__elEx);
  if (wrong && ex.type !== 'match') {
    await page.click('[data-skip]');
  } else if (['mc', 'fill', 'listen', 'listen-tr', 'en2tr', 'dlg', 'read'].includes(ex.type)) {
    await page.evaluate((a) => [...document.querySelectorAll('[data-opt]')].find((b) => b.dataset.opt === a).click(), ex.answer);
  } else if (ex.type === 'build') {
    for (const tok of ex.answer.split(' ')) {
      await page.evaluate((t) => [...document.querySelectorAll('[data-tile]')].find((b) => !b.classList.contains('used') && b.textContent === t).click(), tok);
    }
  } else if (['type', 'gap', 'tr2en', 'fix'].includes(ex.type)) {
    await page.fill('[data-input]', ex.accepted[0]);
  } else if (ex.type === 'match') {
    for (const p of ex.pairs) {
      await page.click(`[data-left="${p.id}"]`);
      await page.click(`[data-right="${p.id}"]`);
    }
  }
  if (ex.type !== 'match' && !wrong) await page.click('[data-check]');
  await page.waitForSelector('.player-foot.correct, .player-foot.wrong');
  return { ex, ok: await page.$('.player-foot.correct') !== null };
}

async function playAll(page, { wrongAt = -1, shotAt = -1, shotName } = {}) {
  const total = await page.evaluate(() => Number(document.querySelector('[data-counter]').textContent.split('/')[1]));
  for (let i = 0; i < total; i++) {
    await page.waitForFunction((n) => document.querySelector('[data-counter]')?.textContent.startsWith(`${n} `), i + 1);
    const { ok } = await answer(page, { wrong: i === wrongAt });
    assert.equal(ok, i !== wrongAt, `Soru ${i + 1} beklenmeyen sonuç`);
    if (i === shotAt) await page.waitForTimeout(400), await page.screenshot({ path: `${shots}${shotName}` });
    await page.click('[data-check]');
  }
  return total;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'light' });
  await ctx.addInitScript(() => { window.__EL_TEST__ = true; });
  const page = await ctx.newPage();
  watch(page);

  await step('Karşılama ekranı', async () => {
    await page.goto(base);
    await page.waitForSelector('.auth');
    assert.match(await page.textContent('.auth'), /Ercan Sincar tarafından geliştirilmiştir/);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shots}01-karsilama.png` });
  });

  await step('Kayıt formu doğrulaması', async () => {
    await page.goto(`${base}/#/register`);
    await page.click('button[type="submit"]');
    assert.match(await page.textContent('[data-err="email"]'), /Geçerli bir e-posta/);
    await page.goto(`${base}/#/welcome`);
  });

  await step('Misafir olarak başla ve ilk kurulum', async () => {
    await page.fill('#g-name', 'Deniz');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-start]');
    await page.click('[data-group="goal"] [data-value="20"]');
    await page.screenshot({ path: `${shots}02-ilk-kurulum.png` });
    await page.click('[data-start]');
    await page.waitForSelector('.hero');
    assert.match(await page.textContent('h1'), /Deniz/);
    await page.screenshot({ path: `${shots}03-ana-sayfa.png`, fullPage: true });
  });

  await step('Öğren sayfası ve kilitli ders', async () => {
    await page.click('.sidebar a[href="#/learn"]');
    await page.waitForSelector('.lesson-row');
    assert.equal(await page.getAttribute('[data-lesson="a1-u1-l2"]', 'data-open'), 'false');
    await page.screenshot({ path: `${shots}04-ogren.png`, fullPage: true });
  });

  let firstXp;
  await step('İlk dersi çöz (bir yanlışla) ve sonucu kaydet', async () => {
    await page.click('[data-lesson="a1-u1-l1"]');
    await page.waitForSelector('[data-start]');
    await page.screenshot({ path: `${shots}05-ders-giris.png` });
    await page.click('[data-start]');
    const total = await playAll(page, { wrongAt: 3, shotAt: 3, shotName: '06-yanlis-cevap.png' });
    assert.equal(total, 15);
    await page.waitForSelector('.result .stat.xp');
    const txt = await page.textContent('.result');
    assert.match(txt, /Ders tamamlandı/);
    assert.match(txt, /14\/15/);
    await page.waitForTimeout(900);
    firstXp = Number((await page.textContent('.stat.xp b')).replace(/\D/g, ''));
    assert.ok(firstXp >= 24, `XP beklenenden düşük: ${firstXp}`);
    await page.screenshot({ path: `${shots}07-ders-sonucu.png` });
  });

  await step('Ders tekrarında XP sınırı', async () => {
    for (let r = 0; r < 3; r++) {
      await page.click('[data-again]');
      await playAll(page);
      await page.waitForSelector('.result .stat.xp');
      const xp = Number((await page.textContent('.stat.xp b')).replace(/\D/g, ''));
      const reason = await page.textContent('.result');
      if (r < 2) assert.ok(xp > 0 && xp <= 5 + 20, `Tekrar ${r + 1} XP: ${xp}`);
      else assert.match(reason, /tekrar XP hakkı doldu/);
    }
  });

  await step('Yazma ve konuşma pratiği ekranı', async () => {
    await page.click('[data-practice]');
    await page.waitForSelector('[data-writing]');
    await page.fill('[data-writing]', 'Good morning, Ali! How are you?');
    await page.click('[data-model]');
    assert.match(await page.textContent('[data-feedback]'), /Örnek cevap/);
    await page.screenshot({ path: `${shots}08-pratik.png`, fullPage: true });
    await page.click('.player a[href="#/learn"].btn');
    await page.waitForSelector('[data-lesson="a1-u1-l2"][data-open="true"]');
  });

  await step('Ana sayfa XP, seri ve görevler', async () => {
    await page.click('.sidebar a[href="#/"]');
    await page.waitForSelector('.hero');
    const chips = await page.textContent('.stats-chips');
    assert.match(chips, /1 gün/);
    assert.doesNotMatch(chips, /\b0 XP/);
  });

  await step('Kelimelerim: favori, liste, özel kelime, pratik', async () => {
    await page.click('.sidebar a[href="#/words"]');
    await page.waitForSelector('[data-tab="learned"]');
    await page.click('[data-tab="learned"]');
    assert.equal(await page.locator('.word-list .list-item').count(), 6);
    await page.click('.word-list [data-fav="hello"]');
    await page.waitForSelector('[data-fav="hello"].active');
    await page.click('[data-tab="lists"]');
    await page.fill('[data-newlist] input', 'Selamlar');
    await page.click('[data-newlist] button');
    await page.waitForSelector('[data-dellist]');
    await page.click('[data-tab="all"]');
    await page.click('[data-addlist="goodbye"]');
    await page.click('.modal label.setting');
    await page.waitForFunction(() => document.querySelector('.modal [data-list]').checked);
    await page.waitForTimeout(300);
    await page.click('.modal [data-close]');
    await page.click('[data-newword]');
    await page.fill('#nw-en', 'sunset');
    await page.fill('#nw-tr', 'gün batımı');
    await page.fill('#nw-ex', 'The sunset is beautiful.');
    await page.click('.modal button[type="submit"]');
    await page.waitForSelector('.word-list [data-detail^="u"]');
    await page.screenshot({ path: `${shots}09-kelimelerim.png`, fullPage: true });
    await page.click('[data-tab="learned"]');
    await page.click('a[href^="#/review?ids="]');
    await page.waitForSelector('[data-counter]');
    const n = await playAll(page);
    await page.waitForSelector('.result');
    assert.match(await page.textContent('.result'), /Tekrar tamamlandı/);
    assert.ok(n >= 6);
  });

  await step('Dil Bilgisi listesi ve konu sayfası', async () => {
    await page.goto(`${base}/#/grammar`);
    await page.waitForSelector('a[href="#/grammar/to-be"]');
    await page.click('a[href="#/grammar/to-be"]');
    await page.waitForSelector('.grammar-table');
    await page.screenshot({ path: `${shots}10-dil-bilgisi.png`, fullPage: true });
  });

  await step('Konuşma senaryosu ve telaffuz ayrımı', async () => {
    await page.goto(`${base}/#/speak`);
    await page.waitForSelector('a[href="#/speak/restaurant"]');
    await page.screenshot({ path: `${shots}11-konusma.png`, fullPage: true });
    await page.click('a[href="#/speak/restaurant"]');
    for (let i = 0; i < 8; i++) { await page.waitForSelector('.player [data-next]'); await page.click('.player [data-next]'); }
    await page.waitForSelector('.result');
    assert.match(await page.textContent('.result'), /Senaryo tamamlandı/);
    await page.goto(`${base}/#/pairs`);
    await page.waitForSelector('[data-w]');
    await page.click('[data-w] >> nth=0');
    await page.waitForSelector('.player [data-next]');
    await page.screenshot({ path: `${shots}12-telaffuz.png` });
  });

  await step('AI öğretmen (anahtar yokken dürüst durum)', async () => {
    await page.goto(`${base}/#/tutor`);
    await page.waitForSelector('text=AI öğretmen şu anda devre dışı');
    await page.screenshot({ path: `${shots}13-ai-ogretmen.png` });
  });

  await step('İlerlemem ve rozetler', async () => {
    await page.goto(`${base}/#/progress`);
    await page.waitForSelector('.badges');
    assert.ok(await page.locator('.badge-card:not(.locked)').count() >= 2);
    await page.screenshot({ path: `${shots}14-ilerlemem.png`, fullPage: true });
  });

  await step('Seviye belirleme testi', async () => {
    await page.goto(`${base}/#/placement`);
    await page.click('[data-go]');
    for (let i = 0; i < 20; i++) { await page.waitForSelector('[data-k]'); await page.click(i < 8 ? '[data-k="0"]' : '[data-k="-1"]'); }
    await page.waitForSelector('[data-set]');
    await page.screenshot({ path: `${shots}15-seviye-testi.png` });
    await page.click('[data-keep]');
    await page.waitForSelector('.lesson-row');
  });

  await step('Profil: koyu tema, hesap oluşturma, çıkış ve giriş', async () => {
    await page.goto(`${base}/#/profile`);
    await page.waitForSelector('[data-theme-set="dark"]');
    await page.click('[data-theme-set="dark"]');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.screenshot({ path: `${shots}16-profil-koyu.png`, fullPage: true });
    await page.fill('#u-name', 'Deniz');
    await page.fill('#u-email', 'deniz@example.com');
    await page.fill('#u-pass', 'sifre1234');
    await page.click('[data-upgrade] button[type="submit"]');
    await page.waitForSelector('text=deniz@example.com');
    await page.click('[data-logout]');
    await page.waitForSelector('.auth');
    await page.goto(`${base}/#/login`);
    await page.fill('#l-email', 'deniz@example.com');
    await page.fill('#l-pass', 'yanlis123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-error]:not(.hidden)');
    await page.fill('#l-pass', 'sifre1234');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.hero');
    assert.match(await page.textContent('.stats-chips'), /1 gün/);
    await page.goto(`${base}/#/about`);
    await page.waitForSelector('text=Yapımcı');
    assert.match(await page.textContent('#view'), /Ercan Sincar tarafından geliştirilmiştir/);
    await page.screenshot({ path: `${shots}17-hakkinda-koyu.png`, fullPage: true });
  });

  await step('Mobil görünüm', async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
    await m.addInitScript(() => { window.__EL_TEST__ = true; });
    const mp = await m.newPage();
    watch(mp);
    await mp.goto(base);
    await mp.waitForSelector('.auth');
    await mp.screenshot({ path: `${shots}20-mobil-karsilama.png`, fullPage: true });
    await mp.click('button[type="submit"]');
    await mp.waitForSelector('[data-start]');
    await mp.click('[data-start]');
    await mp.waitForSelector('.bottom-nav');
    await mp.screenshot({ path: `${shots}21-mobil-ana-sayfa.png`, fullPage: true });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, 'Mobilde yatay taşma var');
    await mp.click('.bottom-nav [data-action="more"]');
    await mp.waitForSelector('.modal');
    await mp.screenshot({ path: `${shots}22-mobil-menu.png` });
    await mp.click('.modal a[href="#/progress"]');
    await mp.waitForSelector('.badges');
    await mp.goto(`${base}/#/lesson/a1-u1-l1`);
    await mp.click('[data-start]');
    await mp.waitForSelector('[data-counter]');
    await answer(mp);
    await mp.screenshot({ path: `${shots}23-mobil-ders.png` });
    for (const p of ['learn', 'words', 'grammar', 'speak', 'tutor', 'profile']) {
      await mp.goto(`${base}/#/${p}`);
      await mp.waitForTimeout(250);
      const of = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(of, false, `Mobilde yatay taşma: ${p}`);
    }
    await mp.goto(`${base}/#/words`);
    await mp.waitForTimeout(300);
    await mp.screenshot({ path: `${shots}24-mobil-kelimeler.png`, fullPage: true });
    await m.close();
  });

  assert.deepEqual(errors, [], `Tarayıcı hataları:\n${errors.join('\n')}`);
  console.log('\nTüm uçtan uca testler geçti. Ekran görüntüleri:', shots);
} catch (err) {
  console.error('\nHATA:', err.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
