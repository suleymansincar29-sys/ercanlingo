// Öğren: seviyeler, üniteler ve dersler.
import { LEVELS, isLessonUnlocked, isUnitTestUnlocked, nextLesson, UNIT_PASS_RATIO } from '/shared/curriculum.js';
import { store, completedSet } from '../store.js';
import { icons } from '../icons.js';
import { esc, progressBar, toast, on, $ } from '../ui.js';

export const title = 'Öğren';

export function render(el) {
  const s = store.state;
  const done = completedSet();
  const next = nextLesson(done, s.user.level);
  const unitResults = {};
  for (const r of s.results) if (r.kind === 'unit') unitResults[r.ref] = Math.max(unitResults[r.ref] || 0, r.correct / r.total);
  let selected = sessionStorageGet('el-learn-level') || s.user.level;
  if (!LEVELS.some((l) => l.id === selected)) selected = 'A1';

  const levelHtml = (level) => {
    if (level.planned) {
      return `<div class="notice mb"><span class="ico">🛠️</span><div><b>${level.id} içeriği hazırlanıyor.</b> Aşağıdaki müfredat planlandı ama dersler henüz yazılmadı; tamamlanmış gibi gösterilmez. Bu sırada AI öğretmenle bu konularda pratik yapabilirsin.</div></div>
      ${level.units.map((u) => `<section class="card unit"><div class="unit-head"><div><span class="tag">Ünite ${u.index + 1}</span><h3 class="mt" style="margin-bottom:0">${esc(u.title)}</h3></div><span class="tag warning">Hazırlanıyor</span></div>
        <div class="planned-list">${u.lessons.map((l) => `<div class="planned-item">${icons.lock}<span>${esc(l.title)}</span></div>`).join('')}</div></section>`).join('')}`;
    }
    return level.units.map((u) => {
      const doneCount = u.lessons.filter((l) => done.has(l.id)).length;
      const testOpen = isUnitTestUnlocked(u.id, done);
      const best = unitResults[u.id];
      return `<section class="card unit">
        <div class="unit-head"><div class="grow"><span class="tag primary">Ünite ${u.index + 1}</span><h3 class="mt" style="margin-bottom:2px">${esc(u.title)}</h3><p class="small muted" style="margin:0">${esc(u.description)}</p></div>
          <div style="min-width:140px"><div class="small muted" style="text-align:right">${doneCount}/${u.lessons.length} ders</div>${progressBar(doneCount, u.lessons.length, doneCount === u.lessons.length ? 'success' : '')}</div></div>
        <div class="path">
          ${u.lessons.map((l) => {
            const open = isLessonUnlocked(l.id, done, s.user.level);
            const isDone = done.has(l.id);
            const p = s.lessons[l.id];
            const cls = isDone ? 'done' : next?.id === l.id ? 'current' : open ? '' : 'locked';
            return `<button class="lesson-row ${cls}" data-lesson="${l.id}" data-open="${open}" ${open ? '' : 'aria-disabled="true"'}>
              <span class="node">${isDone ? icons.check : open ? l.index + 1 : icons.lock}</span>
              <span class="grow"><b>${esc(l.title)}</b> <span class="muted small">· ${esc(l.subtitle)}</span><br><span class="small muted">${esc(l.goal)}</span></span>
              ${p ? `<span class="tag ${isDone ? 'success' : 'warning'}">%${p.best}</span>` : ''}
            </button>`;
          }).join('')}
          <button class="lesson-row ${testOpen ? '' : 'locked'} ${best >= UNIT_PASS_RATIO ? 'done' : ''}" data-test="${u.id}" data-open="${testOpen}">
            <span class="node">🏁</span>
            <span class="grow"><b>Ünite sonu testi</b><br><span class="small muted">${testOpen ? '15 soru · geçmek için %70' : 'Tüm dersleri bitirince açılır'}</span></span>
            ${best !== undefined ? `<span class="tag ${best >= UNIT_PASS_RATIO ? 'success' : 'danger'}">%${Math.round(best * 100)}</span>` : ''}
          </button>
        </div>
      </section>`;
    }).join('');
  };

  const draw = () => {
    const level = LEVELS.find((l) => l.id === selected);
    el.innerHTML = `<div class="page narrow">
      <div class="header"><div><h1>Öğren</h1><p>Dersler kolaydan zora sıralanır. Bir dersi %60 ile geçince sıradaki açılır.</p></div>
        <a class="btn btn-secondary btn-sm" href="#/placement">🧭 Seviye testi</a></div>
      <div class="tabs" role="tablist">${LEVELS.map((l) => `<button role="tab" aria-selected="${l.id === selected}" class="${l.id === selected ? 'active' : ''}" data-level="${l.id}">${l.id} · ${l.title}${l.planned ? ' (yakında)' : ''}</button>`).join('')}</div>
      <div class="level-head"><div class="level-badge ${level.planned ? 'muted-badge' : ''}">${level.id}</div><div><h2 style="margin:0">${esc(level.title)}</h2><p class="muted" style="margin:0">${esc(level.description)}</p></div></div>
      ${levelHtml(level)}
    </div>`;
  };
  draw();

  on(el, 'click', '[data-level]', (e, b) => { selected = b.dataset.level; sessionStorageSet('el-learn-level', selected); draw(); $('.tabs .active', el)?.focus(); });
  on(el, 'click', '[data-lesson]', (e, b) => {
    if (b.dataset.open !== 'true') return toast('Bu dersi açmak için önceki dersi tamamla.');
    location.hash = `#/lesson/${b.dataset.lesson}`;
  });
  on(el, 'click', '[data-test]', (e, b) => {
    if (b.dataset.open !== 'true') return toast('Ünite testi, ünitedeki tüm dersleri bitirince açılır.');
    location.hash = `#/unit-test/${b.dataset.test}`;
  });
}

function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* yok say */ } }
