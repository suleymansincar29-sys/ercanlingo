// Karşılama, giriş ve kayıt ekranları.
import { BRAND, creditLine } from '/shared/brand.js';
import { api, timezone } from '../api.js';
import { refresh, store } from '../store.js';
import { logo, wordmark } from '../icons.js';
import { esc, $ } from '../ui.js';

export const title = 'Hoş geldin';

const art = () => `
  <section class="auth-art">
    <a class="brand" href="#/welcome">${logo(42)}${wordmark(BRAND.appName)}</a>
    <div>
      <h1>İngilizceyi oyun gibi öğren, gerçek hayatta konuş.</h1>
      <p>A1'den C1'e uzanan yol haritası, aralıklı tekrar, konuşma pratiği ve kişisel AI öğretmen tek bir yerde.</p>
    </div>
    <div class="float-cards" aria-hidden="true">
      <div class="fc" style="left:0;top:10px">🔥 7 günlük seri</div>
      <div class="fc" style="left:150px;top:80px;animation-delay:.15s">"How are you?" → Nasılsın?</div>
      <div class="fc" style="left:30px;top:150px;animation-delay:.3s">⭐ +30 XP · Ders tamamlandı</div>
    </div>
  </section>`;

const credit = () => `<p class="auth-credit">${esc(BRAND.appName)} · ${esc(creditLine())}</p>`;

function welcome() {
  return `<div class="box stack" style="gap:16px">
    <div class="center">${logo(64).replace('<svg', '<svg style="margin:0 auto 10px"')}<h1 style="margin-bottom:4px">${wordmark(BRAND.appName)}</h1><p class="muted">${esc(BRAND.tagline)}</p></div>
    <form class="stack" data-form="guest" novalidate>
      <div class="field"><label for="g-name">Sana nasıl hitap edelim?</label>
        <input class="input" id="g-name" name="name" maxlength="40" autocomplete="given-name" placeholder="Adın (isteğe bağlı)"></div>
      <div class="form-error hidden" data-error role="alert"></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Hemen başla</button>
      <p class="small muted center" style="margin:0">Misafir olarak başlarsın; ilerlemen bu tarayıcıda kalır. İstediğin zaman hesap oluşturup ilerlemeni koruyabilirsin.</p>
    </form>
    <div class="divider">veya</div>
    <div class="grid two"><a class="btn btn-secondary" href="#/login">Giriş yap</a><a class="btn btn-secondary" href="#/register">Kayıt ol</a></div>
    ${credit()}
  </div>`;
}

function login() {
  return `<div class="box stack" style="gap:16px">
    <div><a href="#/welcome" class="small">← Geri</a><h1 class="mt">Tekrar hoş geldin</h1><p class="muted">Kaldığın yerden devam etmek için giriş yap.</p></div>
    <form class="stack" data-form="login" novalidate>
      <div class="field"><label for="l-email">E-posta</label><input class="input" id="l-email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="l-pass">Şifre</label><input class="input" id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
      <div class="form-error hidden" data-error role="alert"></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Giriş yap</button>
    </form>
    <p class="center small">Hesabın yok mu? <a href="#/register">Kayıt ol</a></p>
    ${credit()}
  </div>`;
}

function register() {
  return `<div class="box stack" style="gap:16px">
    <div><a href="#/welcome" class="small">← Geri</a><h1 class="mt">Hesap oluştur</h1><p class="muted">İlerlemen, kelime listelerin ve rozetlerin hesabında güvende kalsın.</p></div>
    <form class="stack" data-form="register" novalidate>
      <div class="field"><label for="r-name">Ad</label><input class="input" id="r-name" name="name" maxlength="40" autocomplete="name" required><div class="error" data-err="name"></div></div>
      <div class="field"><label for="r-email">E-posta</label><input class="input" id="r-email" name="email" type="email" autocomplete="email" required><div class="error" data-err="email"></div></div>
      <div class="field"><label for="r-pass">Şifre</label><input class="input" id="r-pass" name="password" type="password" autocomplete="new-password" minlength="8" required aria-describedby="r-pass-help"><div class="small muted" id="r-pass-help">En az 8 karakter, bir harf ve bir rakam.</div><div class="error" data-err="password"></div></div>
      <div class="form-error hidden" data-error role="alert"></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Hesap oluştur</button>
    </form>
    <p class="center small">Zaten hesabın var mı? <a href="#/login">Giriş yap</a></p>
    ${credit()}
  </div>`;
}

export function validateRegister({ name, email, password }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Adını yaz.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errors.email = 'Geçerli bir e-posta adresi gir.';
  if (password.length < 8) errors.password = 'Şifre en az 8 karakter olmalı.';
  else if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) errors.password = 'Şifre en az bir harf ve bir rakam içermeli.';
  return errors;
}

export async function render(el, params, { pattern, navigate }) {
  const body = { welcome, login, register }[pattern]();
  el.innerHTML = `<div class="auth">${art()}<section class="auth-form">${body}</section></div>`;
  const form = $('form', el);
  const errorBox = $('[data-error]', el);
  const showError = (msg) => { errorBox.textContent = msg; errorBox.classList.remove('hidden'); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    const data = Object.fromEntries(new FormData(form));
    const submit = $('button[type="submit"]', form);
    if (pattern === 'register') {
      const errs = validateRegister(data);
      form.querySelectorAll('[data-err]').forEach((n) => { n.textContent = errs[n.dataset.err] || ''; });
      form.querySelectorAll('.input').forEach((i) => i.classList.toggle('invalid', Boolean(errs[i.name])));
      if (Object.keys(errs).length) return;
    }
    if (pattern === 'login' && (!data.email || !data.password)) return showError('E-posta ve şifreni yaz.');
    submit.disabled = true;
    submit.textContent = 'Lütfen bekle…';
    try {
      if (pattern === 'welcome') await api('/api/auth/guest', { method: 'POST', body: { name: data.name || undefined, tz: timezone } });
      if (pattern === 'login') await api('/api/auth/login', { method: 'POST', body: { email: data.email, password: data.password } });
      if (pattern === 'register') await api('/api/auth/register', { method: 'POST', body: { ...data, tz: timezone } });
      await refresh();
      navigate(store.state.user.onboarded ? '' : 'onboarding');
    } catch (err) {
      showError(err.message);
      submit.disabled = false;
      submit.textContent = { welcome: 'Hemen başla', login: 'Giriş yap', register: 'Hesap oluştur' }[pattern];
    }
  });
}
