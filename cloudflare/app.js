import { state } from "./state.js";
import { openDB, getAllPoems, savePoem, deletePoem, deleteMany } from "./db.js";
import { activePoems, trashPoems, getTrashFilteredPoems, moveManyToTrash, restoreMany } from "./trash.js";
import { plain, formatDate, poemLineCount, poemWordCount, nowIso, uid } from "./utils.js";
import { applyTheme } from "./theme.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// 1. ARKA PLAN KİLİTLEME VE POP-UP DIŞINA BASINCA KAPATMA (Mdd 4)
function lockScroll() { document.body.classList.add('modal-open'); }
function unlockScroll() { document.body.classList.remove('modal-open'); }

function setupBackdropClose() {
  document.querySelectorAll('dialog, .settings-panel').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (typeof overlay.close === 'function') overlay.close();
        overlay.classList.remove('active');
        unlockScroll();
      }
    });
  });
}

// 2. ANA RENDER MOTORU
async function refresh() {
  state.poems = await getAllPoems();
  renderFeed();
}

function renderFeed() {
  const grid = $('#poemGrid');
  if (!grid) return;

  let poems = state.view === 'trash' ? getTrashFilteredPoems() : activePoems();

  if (state.selectedStatus !== 'all') {
    if (state.selectedStatus === 'favorite') poems = poems.filter(p => p.favorite);
    else poems = poems.filter(p => p.status === state.selectedStatus);
  }

  if (state.selectedTag) {
    poems = poems.filter(p => (p.tags || []).includes(state.selectedTag));
  }

  if (!poems.length) {
    grid.innerHTML = `<div class="emptyState"><h2>Şiir bulunamadı.</h2></div>`;
    return;
  }

  grid.innerHTML = poems.map((poem) => {
    const preview = plain(poem.content).slice(0, 300);
    const safeId = plain(poem.id);
    return `
      <article class="poemCard" data-id="${safeId}">
        <div class="cardTitleRow">
          <h3>${poem.favorite ? '★ ' : ''}${plain(poem.title)}</h3>
        </div>
        <p class="${state.poemFont || 'font-times'}">${preview}...</p>
        <div class="cardMeta">
          <span>${formatDate(poem.updatedAt)} · ${poemLineCount(poem)} dize</span>
        </div>
      </article>
    `;
  }).join('');

  $$('.poemCard').forEach((card) => {
    card.addEventListener('click', () => openReader(card.dataset.id));
  });
}

// 3. ŞİİR OKUYUCU (READER)
function openReader(id) {
  const poem = state.poems.find((p) => p.id === id);
  if (!poem) return;
  
  $('#readerTitle').textContent = poem.title;
  $('#readerMeta').textContent = `${formatDate(poem.updatedAt)} · ${poemWordCount(poem)} kelime`;
  
  const contentEl = $('#readerContent');
  contentEl.textContent = poem.content;
  contentEl.className = `reader-content ${state.poemFont || 'font-times'}`;

  const dialog = $('#readerDialog');
  lockScroll();
  dialog.showModal();
}

// 4. ŞİİR EKLEME / DÜZENLEME PANELİ (Mdd 1.3, 2.1)
function openPoemEditor(id = null) {
  const dialog = $('#poemDialog');
  const titleInput = $('#poemTitle');
  const bodyInput = $('#poemContent');
  const fontSelect = $('#editorFontSelect');

  if (id) {
    const poem = state.poems.find(p => p.id === id);
    if (poem) {
      titleInput.value = poem.title;
      bodyInput.value = poem.content;
      dialog.dataset.editId = id;
    }
  } else {
    titleInput.value = '';
    bodyInput.value = '';
    delete dialog.dataset.editId;
  }

  bodyInput.className = `poem-body-textarea ${state.poemFont || 'font-times'}`;
  if (fontSelect) fontSelect.value = state.poemFont || 'font-times';

  lockScroll();
  dialog.showModal();
}

// 5. ANLIK FONT UYGULAMA (Mdd 1.8, 3)
function setupFontHandlers() {
  const editorFontSelect = $('#editorFontSelect');
  const globalFontSelect = $('#globalFontSelect');
  const poemContent = $('#poemContent');

  const updateFont = (fontClass) => {
    state.poemFont = fontClass;
    localStorage.setItem('munnesir-poem-font', fontClass);
    if (poemContent) poemContent.className = `poem-body-textarea ${fontClass}`;
    renderFeed();
  };

  editorFontSelect?.addEventListener('change', (e) => updateFont(e.target.value));
  globalFontSelect?.addEventListener('change', (e) => updateFont(e.target.value));
}

// 6. AYARLAR PANELİ AÇ/KAPA VE SEKME GEÇİŞLERİ (Mdd 1.4, 1.5, 1.6)
function setupSettingsPanel() {
  const openBtn = $('#btnOpenSettings');
  const closeBtn = $('#btnCloseSettings');
  const panel = $('#settingsPanel');

  openBtn?.addEventListener('click', () => {
    lockScroll();
    panel?.classList.add('active');
  });

  closeBtn?.addEventListener('click', () => {
    panel?.classList.remove('active');
    unlockScroll();
  });

  $$('.setting-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.setting-item').forEach((i) => i.classList.remove('active'));
      $$('.sub-page').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      $(`#${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

// 7. EVENT LISTENERS VE BAŞLATMA
document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await refresh();

  window.refresh = refresh;

  setupBackdropClose();
  setupFontHandlers();
  setupSettingsPanel();

  // Keep usulü + butonu
  $('#btnNewPoem')?.addEventListener('click', () => openPoemEditor());
  $('#closePoemDialogBtn')?.addEventListener('click', () => {
    $('#poemDialog')?.close();
    unlockScroll();
  });

  // Şiir Kaydet
  $('#poemDialog')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dialog = $('#poemDialog');
    const title = $('#poemTitle').value.trim() || 'Başlıksız Şiir';
    const content = $('#poemContent').value.trim();

    if (!content) return;

    const id = dialog.dataset.editId || uid();
    const existing = state.poems.find(p => p.id === id);

    const poemData = {
      id,
      title,
      content,
      updatedAt: nowIso(),
      createdAt: existing ? existing.createdAt : nowIso(),
      status: existing ? existing.status : 'draft',
      favorite: existing ? existing.favorite : false,
      tags: existing ? existing.tags : []
    };

    await savePoem(poemData);
    dialog.close();
    unlockScroll();
    await refresh();
  });

  // Reader Kapat
  $('#closeReaderBtn')?.addEventListener('click', () => {
    $('#readerDialog')?.close();
    unlockScroll();
  });

  // Hamburger Mobil
  $('#hamburgerToggle')?.addEventListener('click', () => {
    $('#sidebar')?.classList.toggle('open');
  });

  // Tema Butonları
  $$('.themeChoice').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
  });

  // Durum Filtreleri
  $$('#statusFilters .nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#statusFilters .nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedStatus = btn.dataset.status;
      renderFeed();
    });
  });
});