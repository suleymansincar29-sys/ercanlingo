// Profil ve Ayarlar.
import { BRAND, creditLine } from '/shared/brand.js';
import { LEVELS } from '/shared/curriculum.js';
import { api } from '../api.js';
import { store, refresh, setState, clearState, completedSet } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, on, toast, confirmDialog } from '../ui.js';
import { ACCENTS, accentAvailability, speak } from '../speech.js';
import { validateRegister } from './auth.js';

export const title = 'Profil ve Ayarlar';

export function render(el, params, { navigate }) {
  const draw = () => {
    const s = store.state;
    const u = s.user;
    const st = u.settings;
    const learned = Object.values(s.words).filter((w) => w.inSrs).length;
    const accents = accentAvailability();
    el.innerHTML = `<div class="page narrow">
      <section class="card pad-lg mb">
        <div class="row" style="gap:18px"><div class="avatar" aria-hidden="true">${esc(u.name.slice(0, 1).toLocaleUpperCase('tr'))}</div>
          <div class="grow"><h1 style="margin:0">${esc(u.name)}</h1><div class="muted">${u.isGuest ? 'Misafir hesap' : esc(u.email)} · ${u.level} seviyesi</div>
            <div class="row mt"><span class="chip streak">${icons.flame}${s.game.streak.count} gün</span><span class="chip xp">${icons.bolt}${s.game.xp.total} XP</span><span class="chip level">${icons.star}Seviye ${s.game.xp.level}</span></div></div></div>
        <div class="grid three mt">
          <div class="card flat center"><div class="big-num">${learned}</div><div class="small muted">Öğrenilen kelime</div></div>
          <div class="card flat center"><div class="big-num">${completedSet().size}</div><div class="small muted">Tamamlanan ders</div></div>
          <div class="card flat center"><div class="big-num">${s.game.badges.length}</div><div class="small muted">Başarı rozeti</div></div>
        </div>
        ${s.game.badges.length ? `<div class="row mt">${s.game.badges.map((b) => store.config.badges.find((x) => x.id === b.badge_id)).filter(Boolean).map((b) => `<span class="chip" title="${esc(b.desc)}">${b.icon} ${esc(b.title)}</span>`).join('')}</div>` : ''}
      </section>

      ${u.isGuest ? `<section class="card mb"><h2>💾 Hesabını oluştur</h2><p class="muted">Şu anki bütün ilerlemen (dersler, kelimeler, rozetler) yeni hesabına aktarılır.</p>
        <form class="stack" data-upgrade novalidate>
          <div class="field"><label for="u-name">Ad</label><input class="input" id="u-name" name="name" value="${esc(u.name === 'Misafir' ? '' : u.name)}" maxlength="40" required><div class="error" data-err="name"></div></div>
          <div class="field"><label for="u-email">E-posta</label><input class="input" id="u-email" name="email" type="email" autocomplete="email" required><div class="error" data-err="email"></div></div>
          <div class="field"><label for="u-pass">Şifre</label><input class="input" id="u-pass" name="password" type="password" autocomplete="new-password" required><div class="small muted">En az 8 karakter, bir harf ve bir rakam.</div><div class="error" data-err="password"></div></div>
          <div class="form-error hidden" data-formerr role="alert"></div>
          <button class="btn btn-primary" type="submit">Hesap oluştur ve ilerlememi koru</button></form></section>` : ''}

      <section class="card mb"><h2>Öğrenme</h2>
        <div class="setting"><div class="label"><b>Adın</b><span>Uygulamada sana böyle hitap ederiz.</span></div><form class="row" data-name><input class="input" style="width:180px" name="name" value="${esc(u.name)}" maxlength="40" aria-label="Ad"><button class="btn btn-sm btn-secondary" type="submit">Kaydet</button></form></div>
        <div class="setting"><div class="label"><b>Öğrenme seviyesi</b><span>Önerilen dersler ve AI öğretmenin dili buna göre ayarlanır.</span></div>
          <select class="input" style="width:auto" data-set="level" aria-label="Seviye">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === u.level ? 'selected' : ''}>${l.id} · ${l.title}${l.planned ? ' (içerik hazırlanıyor)' : ''}</option>`).join('')}</select></div>
        <div class="setting"><div class="label"><b>Günlük hedef</b><span>Her gün kazanmak istediğin XP.</span></div>
          <select class="input" style="width:auto" data-set="dailyGoal" aria-label="Günlük hedef">${[10, 20, 30, 50, 80].map((v) => `<option value="${v}" ${v === u.dailyGoal ? 'selected' : ''}>${v} XP</option>`).join('')}</select></div>
        <div class="setting"><div class="label"><b>Haftalık hedef</b><span>Haftada kaç gün günlük hedefe ulaşmak istiyorsun?</span></div>
          <select class="input" style="width:auto" data-set="weeklyDays" aria-label="Haftalık hedef">${[1, 2, 3, 4, 5, 6, 7].map((v) => `<option value="${v}" ${v === u.weeklyDays ? 'selected' : ''}>${v} gün</option>`).join('')}</select></div>
        <div class="setting"><div class="label"><b>Seviye belirleme testi</b><span>20 soruluk testle seviyeni yeniden ölç.</span></div><a class="btn btn-sm btn-secondary" href="#/placement">Teste başla</a></div>
      </section>

      <section class="card mb"><h2>Görünüm ve ses</h2>
        <div class="setting"><div class="label"><b>Tema</b><span>Açık, koyu ya da cihazınla aynı.</span></div>
          <div class="segmented" role="radiogroup" aria-label="Tema">${[['light', 'Açık'], ['dark', 'Koyu'], ['system', 'Sistem']].map(([v, l]) => `<button role="radio" aria-checked="${st.theme === v}" class="${st.theme === v ? 'active' : ''}" data-theme-set="${v}">${l}</button>`).join('')}</div></div>
        <div class="setting"><div class="label"><b>İngilizce aksan</b><span>Sesli okuma için tercih edilen aksan. Ses bulunmayan aksanlarda en yakın İngilizce ses kullanılır.</span></div>
          <div class="row"><select class="input" style="width:auto" data-pref="accent" aria-label="Aksan">${ACCENTS.map((a) => `<option value="${a.id}" ${a.id === st.accent ? 'selected' : ''}>${a.label}${accents.find((x) => x.id === a.id)?.available ? '' : ' (bu cihazda ses yok)'}</option>`).join('')}</select>
          <button class="icon-btn" data-test-voice aria-label="Sesi dene">${icons.volume}</button></div></div>
        <div class="setting"><div class="label"><b>Konuşma hızı</b><span>${st.rate}x</span></div><input type="range" min="0.6" max="1.2" step="0.05" value="${st.rate}" data-pref="rate" aria-label="Konuşma hızı"></div>
        <div class="setting"><div class="label"><b>Dinleme sorularında otomatik oynat</b><span>Soru açılınca ses kendiliğinden çalar.</span></div><label class="switch"><input type="checkbox" data-pref="autoplay" ${st.autoplay ? 'checked' : ''} aria-label="Otomatik oynat"><span></span></label></div>
        <div class="setting"><div class="label"><b>Eşleştirmede kelimeleri seslendir</b><span>Kelimeye dokununca telaffuzu çalınır.</span></div><label class="switch"><input type="checkbox" data-pref="sound" ${st.sound ? 'checked' : ''} aria-label="Ses efektleri"><span></span></label></div>
      </section>

      <section class="card mb"><h2>Bildirimler</h2>
        <div class="setting"><div class="label"><b>Günlük hatırlatma</b><span>Uygulama tarayıcıda açıkken, hedefini tamamlamadıysan seçtiğin saatten sonra bir kez hatırlatır. Uygulama kapalıyken bildirim gönderilmez.</span></div><label class="switch"><input type="checkbox" data-notify ${st.notifications ? 'checked' : ''} aria-label="Günlük hatırlatma"><span></span></label></div>
        <div class="setting"><div class="label"><b>Hatırlatma saati</b></div><select class="input" style="width:auto" data-pref="reminderHour" aria-label="Hatırlatma saati">${Array.from({ length: 18 }, (_, i) => i + 6).map((h) => `<option value="${h}" ${h === st.reminderHour ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></div>
      </section>

      <section class="card mb"><h2>Hesap ve gizlilik</h2>
        <p class="small muted">Verilerin bu sunucudaki veritabanında saklanır. Şifren geri döndürülemez biçimde (scrypt) özetlenir; oturum çerezi tarayıcı betiklerinin erişemeyeceği şekilde (HttpOnly) tutulur. AI öğretmene yazdığın mesajlar yalnızca cevap üretmek için yapay zekâ sağlayıcısına gönderilir.</p>
        <div class="setting"><div class="label"><b>Verilerimi indir</b><span>Tüm ilerlemeni JSON dosyası olarak al.</span></div><a class="btn btn-sm btn-secondary" href="/api/me/export" download>${icons.download} İndir</a></div>
        <div class="setting"><div class="label"><b>Oturumu kapat</b><span>${u.isGuest ? 'Misafir hesaptan çıkarsan ilerlemene tekrar ulaşamazsın.' : 'Bu cihazdan çıkış yap.'}</span></div><button class="btn btn-sm btn-secondary" data-logout>${icons.logout} Çıkış yap</button></div>
        <div class="setting"><div class="label"><b>Hesabımı sil</b><span>Tüm verilerin kalıcı olarak silinir.</span></div><button class="btn btn-sm btn-danger" data-delete>${icons.trash} Sil</button></div>
      </section>

      <a class="card interactive row" href="#/about" style="text-decoration:none;color:inherit">${icons.info}<div class="grow"><b>Hakkında</b><div class="small muted">${esc(BRAND.appName)} · ${esc(creditLine())}</div></div>${icons.next}</a>
    </div>`;
  };

  const save = async (body, msg = 'Kaydedildi') => {
    try { const r = await api('/api/me', { method: 'PATCH', body }); store.state.user = r.user; setState(store.state); await refresh(); draw(); toast(msg, 'success'); } catch (err) { toast(err.message, 'error'); }
  };
  const saveSetting = (key, value) => save({ settings: { [key]: value } });

  on(el, 'change', '[data-set]', (e, s) => save({ [s.dataset.set]: s.dataset.set === 'level' ? s.value : Number(s.value) }));
  on(el, 'change', '[data-pref]', (e, i) => {
    const k = i.dataset.pref;
    saveSetting(k, i.type === 'checkbox' ? i.checked : ['rate', 'reminderHour'].includes(k) ? Number(i.value) : i.value);
  });
  on(el, 'click', '[data-theme-set]', (e, b) => saveSetting('theme', b.dataset.themeSet));
  on(el, 'click', '[data-test-voice]', () => speak('Hello! Welcome to Ercanlingo. How are you today?'));
  on(el, 'submit', '[data-name]', (e, f) => { e.preventDefault(); save({ name: new FormData(f).get('name') }); });
  on(el, 'change', '[data-notify]', async (e, c) => {
    if (c.checked) {
      if (!('Notification' in window)) { toast('Bu tarayıcı bildirimleri desteklemiyor.', 'error'); c.checked = false; return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Bildirim izni verilmedi.', 'error'); c.checked = false; return; }
    }
    saveSetting('notifications', c.checked);
  });
  on(el, 'submit', '[data-upgrade]', async (e, f) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    const errs = validateRegister(data);
    f.querySelectorAll('[data-err]').forEach((n) => { n.textContent = errs[n.dataset.err] || ''; });
    if (Object.keys(errs).length) return;
    try { await api('/api/auth/register', { method: 'POST', body: data }); await refresh(); draw(); toast('Hesabın oluşturuldu, ilerlemen korundu!', 'success'); } catch (err) { const box = $('[data-formerr]', el); box.textContent = err.message; box.classList.remove('hidden'); }
  });
  on(el, 'click', '[data-logout]', async () => {
    if (store.state.user.isGuest && !(await confirmDialog('Misafir hesaptan çıkılsın mı?', 'Hesap oluşturmadan çıkarsan bu ilerlemeye tekrar ulaşamazsın.', { confirmText: 'Yine de çık', danger: true }))) return;
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearState();
    navigate('welcome');
  });
  on(el, 'click', '[data-delete]', async () => {
    if (!(await confirmDialog('Hesabın kalıcı olarak silinsin mi?', 'Bütün dersler, kelimeler, rozetler ve mesajlar silinir. Bu işlem geri alınamaz.', { confirmText: 'Hesabımı sil', danger: true }))) return;
    try { await api('/api/me', { method: 'DELETE' }); clearState(); toast('Hesabın silindi.'); navigate('welcome'); } catch (err) { toast(err.message, 'error'); }
  });
  draw();
}
