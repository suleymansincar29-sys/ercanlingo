// Konuşma bölümü: senaryolar, telaffuz ayrımı ve gölgeleme (shadowing).
import { SCENARIOS, SHADOWING, MINIMAL_PAIRS } from '/shared/content/speaking.js';
import { store } from '../store.js';
import { icons } from '../icons.js';
import { esc, $, on } from '../ui.js';
import { mountSpeak, speechNotice } from '../speakwidget.js';
import { accentAvailability, ttsSupported, sttSupported } from '../speech.js';

export const title = 'Konuşma';

export function render(el) {
  const accents = accentAvailability();
  let shadowIdx = 0;
  el.innerHTML = `<div class="page">
    <div class="header"><div><h1>Konuşma</h1><p>Gerçek hayat senaryolarında konuş, dinle ve telaffuzunu çalış.</p></div></div>
    ${speechNotice()}
    <div class="row mb small muted" style="gap:14px">
      <span>🔊 Sesli okuma: <b>${ttsSupported() ? 'destekleniyor' : 'desteklenmiyor'}</b></span>
      <span>🎤 Konuşmayı metne çevirme: <b>${sttSupported() ? 'destekleniyor' : 'desteklenmiyor'}</b></span>
      <span>🌍 Aksanlar: ${accents.map((a) => `${a.label}${a.available ? ' ✓' : ' (ses yok)'}`).join(', ')} · <a href="#/profile">değiştir</a></span>
    </div>
    <h2>Senaryolar</h2>
    <div class="grid auto mb">${SCENARIOS.map((s) => `<a class="card interactive scenario-card" href="#/speak/${s.id}" style="text-decoration:none;color:inherit">
      <div class="row between"><span class="emoji" aria-hidden="true">${s.icon}</span><span class="tag primary">${s.level}</span></div>
      <h3 style="margin:0">${esc(s.title)}</h3><p class="small muted" style="margin:0">${esc(s.description)}</p>
      <span class="small muted">${s.lines.filter((l) => l[0] === 'you').length} replik</span></a>`).join('')}</div>
    <div class="grid two">
      <section class="card"><div class="card-title"><h3>🎧 Telaffuz ayrımı</h3><span class="tag">${MINIMAL_PAIRS.length} çift</span></div>
        <p class="muted">ship / sheep gibi birbirine benzeyen kelimeleri dinle ve hangisini duyduğunu seç. Kulağını İngilizce seslere alıştırır.</p>
        <a class="btn btn-primary" href="#/pairs">${icons.headphones} Alıştırmaya başla</a></section>
      <section class="card"><div class="card-title"><h3>🔁 Gölgeleme (shadowing)</h3><button class="btn btn-sm btn-ghost" data-next>Sonraki ${icons.next}</button></div>
        <p class="muted small">Cümleyi dinle ve hemen ardından aynı ritimle tekrar et.</p><div data-shadow></div></section>
    </div>
  </div>`;
  const drawShadow = () => {
    const [en, tr] = SHADOWING[shadowIdx % SHADOWING.length];
    mountSpeak($('[data-shadow]', el), { en, tr });
  };
  drawShadow();
  on(el, 'click', '[data-next]', () => { shadowIdx++; drawShadow(); });
  void store;
}
