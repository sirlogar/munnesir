const DB_NAME = 'munnesir-db';
const DB_VERSION = 1;
const STORE = 'poems';
const EMPTY_TAG = '(boş)';
const BOOKS_KEY = 'munnesir-books';

const state = {
  poems: [],
  query: '',
  selectedTag: '',
  selectedStatus: 'all',
  sort: 'updatedDesc',
  readerPoemId: null,
  multiSelect: false,
  selectedIds: new Set(),
  bulkEditMode: '',
  view: 'home',
  books: [],
  activeBookId: '',
  bookQuery: '',
  bookTag: '',
  bookStatus: 'all',
  bookSort: 'updatedDesc',
  bookMultiSelect: false,
  bookSelectedIds: new Set(),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  statsLine: $('#statsLine'),
  menuBtn: $('#menuBtn'),
  closeMenuBtn: $('#closeMenuBtn'),
  sidebar: $('#sidebar'),
  sidebarBackdrop: $('#sidebarBackdrop'),
  searchInput: $('#searchInput'),
  tagCloud: $('#tagCloud'),
  clearFiltersBtn: $('#clearFiltersBtn'),
  homeViewBtn: $('#homeViewBtn'),
  sortSelect: $('#sortSelect'),
  multiSelectBtn: $('#multiSelectBtn'),
  selectionBar: $('#selectionBar'),
  selectionCount: $('#selectionCount'),
  selectVisibleBtn: $('#selectVisibleBtn'),
  clearSelectionBtn: $('#clearSelectionBtn'),
  bulkTagBtn: $('#bulkTagBtn'),
  bulkStatusBtn: $('#bulkStatusBtn'),
  deleteSelectedBtn: $('#deleteSelectedBtn'),
  restoreSelectedBtn: $('#restoreSelectedBtn'),
  bookViewBtn: $('#bookViewBtn'),
  trashViewBtn: $('#trashViewBtn'),
  poemGrid: $('#poemGrid'),
  activeFilters: $('#activeFilters'),
  emptyState: $('#emptyState'),
  newPoemBtn: $('#newPoemBtn'),
  emptyNewPoemBtn: $('#emptyNewPoemBtn'),
  themeToggle: $('#themeToggle'),
  themeDialog: $('#themeDialog'),
  closeThemeBtn: $('#closeThemeBtn'),
  keepImportInput: $('#keepImportInput'),
  backupImportBtn: $('#backupImportBtn'),
  backupFileInput: $('#backupFileInput'),
  backupFolderInput: $('#backupFolderInput'),
  importChoiceDialog: $('#importChoiceDialog'),
  closeImportChoiceBtn: $('#closeImportChoiceBtn'),
  importFileChoiceBtn: $('#importFileChoiceBtn'),
  importFolderChoiceBtn: $('#importFolderChoiceBtn'),
  exportBtn: $('#exportBtn'),
  toast: $('#toast'),
  scrollTopBtn: $('#scrollTopBtn'),
  scrollBottomBtn: $('#scrollBottomBtn'),

  poemDialog: $('#poemDialog'),
  poemForm: $('#poemForm'),
  dialogTitle: $('#dialogTitle'),
  closeDialogBtn: $('#closeDialogBtn'),
  cancelDialogBtn: $('#cancelDialogBtn'),
  deletePoemBtn: $('#deletePoemBtn'),
  poemIdInput: $('#poemIdInput'),
  titleInput: $('#titleInput'),
  contentInput: $('#contentInput'),
  tagsInput: $('#tagsInput'),
  tagSuggestions: $('#tagSuggestions'),
  statusInput: $('#statusInput'),
  favoriteInput: $('#favoriteInput'),
  poemBookBlock: $('#poemBookBlock'),
  poemBookCurrent: $('#poemBookCurrent'),
  poemBookSelect: $('#poemBookSelect'),
  changePoemBookBtn: $('#changePoemBookBtn'),
  removePoemBookBtn: $('#removePoemBookBtn'),

  bulkEditDialog: $('#bulkEditDialog'),
  bulkEditForm: $('#bulkEditForm'),
  bulkEditTitle: $('#bulkEditTitle'),
  bulkEditDescription: $('#bulkEditDescription'),
  bulkRemoveLabel: $('#bulkRemoveLabel'),
  bulkRemoveInput: $('#bulkRemoveInput'),
  bulkRemoveSuggestions: $('#bulkRemoveSuggestions'),
  bulkAddLabel: $('#bulkAddLabel'),
  bulkAddInput: $('#bulkAddInput'),
  bulkAddSuggestions: $('#bulkAddSuggestions'),
  closeBulkEditBtn: $('#closeBulkEditBtn'),
  cancelBulkEditBtn: $('#cancelBulkEditBtn'),

  readerDialog: $('#readerDialog'),
  readerTitle: $('#readerTitle'),
  readerMeta: $('#readerMeta'),
  readerTags: $('#readerTags'),
  readerContent: $('#readerContent'),
  closeReaderBtn: $('#closeReaderBtn'),
  readerEditBtn: $('#readerEditBtn'),
  readerShareBtn: $('#readerShareBtn'),
};

const STATUS_OPTIONS = [
  { key: 'draft', label: 'Taslak', aliases: ['taslak', 'draft'] },
  { key: 'ready', label: 'Yayına hazır', aliases: ['yayına hazır', 'yayina hazir', 'yayına', 'yayina', 'hazır', 'hazir', 'ready'] },
  { key: 'archive', label: 'Arşiv', aliases: ['arşiv', 'arsiv', 'archive'] },
  { key: 'favorite', label: 'Seçmeler', aliases: ['seçmeler', 'secmeler', 'seçme', 'secme', 'favori', 'favorite'] },
];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAction(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = action(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

async function getAllPoems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

function savePoem(poem) {
  return dbAction('readwrite', (store) => store.put(poem));
}

function deletePoem(id) {
  return dbAction('readwrite', (store) => store.delete(id));
}

async function deleteMany(ids) {
  if (!ids.length) return;
  await dbAction('readwrite', (store) => ids.forEach((id) => store.delete(id)));
}

async function saveMany(poems) {
  if (!poems.length) return;
  await dbAction('readwrite', (store) => poems.forEach((poem) => store.put(poem)));
}

function loadBooks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeBook).filter(Boolean) : [];
  } catch (err) {
    console.warn('Kitap adayları okunamadı:', err);
    return [];
  }
}

function saveBooks() {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(state.books));
}

function normalizeBook(book) {
  if (!book || typeof book !== 'object') return null;
  const title = normalizeText(book.title || book.name || 'Adsız kitap');
  return {
    id: book.id || uid(),
    title: title || 'Adsız kitap',
    poemIds: [...new Set(Array.isArray(book.poemIds) ? book.poemIds.filter(Boolean) : [])],
    createdAt: book.createdAt || nowIso(),
    updatedAt: book.updatedAt || nowIso(),
  };
}

function activePoems() {
  return state.poems.filter((poem) => !poem.trashedAt);
}

function trashPoems() {
  return state.poems.filter((poem) => poem.trashedAt);
}

async function moveManyToTrash(ids) {
  const stamp = nowIso();
  const updated = state.poems
    .filter((poem) => ids.includes(poem.id) && !poem.trashedAt)
    .map((poem) => ({ ...poem, trashedAt: stamp, updatedAt: stamp }));
  await saveMany(updated);
}

async function restoreMany(ids) {
  const updated = state.poems
    .filter((poem) => ids.includes(poem.id) && poem.trashedAt)
    .map((poem) => {
      const next = { ...poem, updatedAt: nowIso() };
      delete next.trashedAt;
      return next;
    });
  await saveMany(updated);
}

function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : `poem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((t) => typeof t === 'string' ? t : t?.name).map(normalizeTag).filter(Boolean))];
  }
  return [...new Set(String(value || '').split(',').map(normalizeTag).filter(Boolean))];
}

function normalizePoemTags(value) {
  let tags = parseTags(value);
  if (tags.length > 1) tags = tags.filter((tag) => tag !== EMPTY_TAG);
  return tags.length ? tags : [EMPTY_TAG];
}

function titleFromContent(content) {
  const first = normalizeText(content).split('\n').find(Boolean) || 'Başlıksız şiir';
  return first.length > 70 ? `${first.slice(0, 67)}...` : first;
}

function usecToIso(value) {
  if (!value) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const ms = n > 10_000_000_000_000 ? Math.floor(n / 1000) : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function formatDate(value) {
  if (!value) return 'tarih yok';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'tarih yok';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(d);
}

function plain(s) {
  return String(s || '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[ch]));
}

function poemWordCount(poem) {
  const words = normalizeText(poem.content).split(/\s+/).filter(Boolean);
  return words.length;
}

function poemLineCount(poem) {
  return normalizeText(poem.content).split('\n').filter(Boolean).length;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function extractKeepPoem(raw, fileName = '') {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.isTrashed) return null;

  const text = normalizeText(raw.textContent || raw.listContent?.map((x) => x?.text).filter(Boolean).join('\n') || '');
  const title = normalizeText(raw.title || titleFromContent(text || fileName.replace(/\.json$/i, '')));
  const content = text || normalizeText(raw.title || '');
  if (!content) return null;

  const createdAt = usecToIso(raw.createdTimestampUsec) || usecToIso(raw.createdTimestamp) || nowIso();
  const updatedAt = usecToIso(raw.userEditedTimestampUsec) || usecToIso(raw.updatedTimestampUsec) || createdAt;
  const tags = normalizePoemTags(raw.labels || raw.labelNames || []);

  return {
    id: `keep-${fileName}-${createdAt}-${title}`.replace(/\s+/g, '-').slice(0, 180),
    title,
    content,
    tags,
    status: 'archive',
    favorite: tags.includes('seçme') || tags.includes('secme') || /seçme|selected|favori/i.test(title),
    source: 'google-keep',
    createdAt,
    updatedAt,
  };
}

function poemFromForm() {
  const id = els.poemIdInput.value || uid();
  const content = normalizeText(els.contentInput.value);
  const title = normalizeText(els.titleInput.value) || titleFromContent(content);
  const existing = state.poems.find((p) => p.id === id);
  return {
    id,
    title,
    content,
    tags: normalizePoemTags(els.tagsInput.value),
    status: els.statusInput.value || 'draft',
    favorite: els.favoriteInput.checked,
    source: existing?.source || 'manual',
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function matchesQuery(poem) {
  if (!state.query) return true;
  const q = state.query.toLocaleLowerCase('tr-TR');
  return [poem.title, poem.content, ...(poem.tags || []), statusLabel(poem.status), poem.favorite ? 'Seçmeler' : '']
    .join(' ')
    .toLocaleLowerCase('tr-TR')
    .includes(q);
}

function hasStatusClassification(poem) {
  return Boolean(poem.favorite || (poem.status && poem.status !== 'archive'));
}

function visibleTagsForPoem(poem) {
  const tags = normalizePoemTags(poem.tags || []);
  if (tags.length === 1 && tags[0] === EMPTY_TAG && hasStatusClassification(poem)) return [];
  return tags;
}

function matchesTag(poem) {
  return !state.selectedTag || visibleTagsForPoem(poem).includes(state.selectedTag);
}

function matchesStatus(poem) {
  if (state.selectedStatus === 'all') return true;
  if (state.selectedStatus === 'favorite') return Boolean(poem.favorite);
  return poem.status === state.selectedStatus;
}

function getFilteredPoems() {
  const poems = activePoems().filter((poem) => matchesQuery(poem) && matchesTag(poem) && matchesStatus(poem));
  return poems.sort((a, b) => {
    if (state.sort === 'createdDesc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (state.sort === 'titleAsc') return a.title.localeCompare(b.title, 'tr');
    if (state.sort === 'lengthDesc') return b.content.length - a.content.length;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}


function sortPoemList(poems, sortKey = 'updatedDesc') {
  return [...poems].sort((a, b) => {
    if (sortKey === 'createdDesc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortKey === 'titleAsc') return a.title.localeCompare(b.title, 'tr');
    if (sortKey === 'lengthDesc') return b.content.length - a.content.length;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function getTagStats() {
  const map = new Map();
  activePoems().forEach((poem) => {
    visibleTagsForPoem(poem).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1));
  });
  return [...map.entries()].sort((a, b) => {
    if (a[0] === EMPTY_TAG && b[0] !== EMPTY_TAG) return 1;
    if (b[0] === EMPTY_TAG && a[0] !== EMPTY_TAG) return -1;
    return b[1] - a[1] || a[0].localeCompare(b[0], 'tr');
  });
}

function renderStats() {
  const poems = activePoems();
  const total = poems.length;
  const tags = getTagStats().length;
  const selected = poems.filter((p) => p.favorite).length;
  els.statsLine.textContent = `${total} şiir · ${tags} etiket · ${selected} seçme`;
}

function renderTags() {
  const stats = getTagStats();
  els.tagCloud.innerHTML = stats.length ? stats.map(([tag, count]) => `
    <button class="tagChip ${state.selectedTag === tag ? 'active' : ''}" data-tag="${plain(tag)}" type="button">
      #${plain(tag)} <span class="tagCount">${count}</span>
    </button>
  `).join('') : '<p>Etiket yok. İlk etiket, ilk kapıdır.</p>';

  $$('.tagChip[data-tag]').forEach((btn) => btn.addEventListener('click', () => {
    state.selectedTag = state.selectedTag === btn.dataset.tag ? '' : btn.dataset.tag;
    setSidebarOpen(false);
    render();
  }));
}

function renderActiveFilters() {
  if (state.view === 'trash') {
    els.activeFilters.innerHTML = '<span class="tagChip active">Çöp kutusu</span>';
    return;
  }
  if (state.view === 'books') {
    els.activeFilters.innerHTML = '<span class="tagChip active">Kitap adayları</span>';
    return;
  }
  const parts = [];
  if (state.query) parts.push(`Arama: ${state.query}`);
  if (state.selectedTag) parts.push(`#${state.selectedTag}`);
  if (state.selectedStatus !== 'all') parts.push(state.selectedStatus === 'favorite' ? 'Seçmeler' : statusLabel(state.selectedStatus));
  els.activeFilters.innerHTML = parts.map((p) => `<span class="tagChip active">${plain(p)}</span>`).join('');
}

function getHomeStatusCounts() {
  const poems = activePoems();
  return {
    all: poems.length,
    favorite: poems.filter((poem) => poem.favorite).length,
    draft: poems.filter((poem) => poem.status === 'draft').length,
    ready: poems.filter((poem) => poem.status === 'ready').length,
  };
}

function homeStatusLabel(key) {
  if (key === 'all') return 'Hepsi';
  if (key === 'favorite') return 'Seçmeler';
  return statusLabel(key);
}

function renderStatusButtons() {
  const counts = getHomeStatusCounts();
  $$('[data-status]').forEach((btn) => {
    const key = btn.dataset.status;
    btn.classList.toggle('active', key === state.selectedStatus);
    btn.innerHTML = `<span>${plain(homeStatusLabel(key))}</span><span class="tagCount">${counts[key] || 0}</span>`;
  });
}


function isDesktopLayout() {
  return window.matchMedia('(min-width: 821px)').matches;
}

function setSidebarOpen(open) {
  if (isDesktopLayout()) {
    document.body.classList.toggle('sidebarCollapsed', !open);
    els.sidebar?.classList.remove('open');
    els.sidebarBackdrop?.classList.remove('open');
    document.body.classList.remove('sidebarOpen');
    return;
  }
  els.sidebar?.classList.toggle('open', Boolean(open));
  els.sidebarBackdrop?.classList.toggle('open', Boolean(open));
  document.body.classList.toggle('sidebarOpen', Boolean(open));
}

function toggleSidebar() {
  if (isDesktopLayout()) {
    setSidebarOpen(document.body.classList.contains('sidebarCollapsed'));
    return;
  }
  setSidebarOpen(!els.sidebar?.classList.contains('open'));
}

function renderNavigation() {
  els.bookViewBtn?.classList.toggle('active', state.view === 'books');
  els.trashViewBtn?.classList.toggle('active', state.view === 'trash');
}

function renderSelectionBar() {
  const count = state.selectedIds.size;
  const canSelect = state.view !== 'books';
  els.selectionBar.hidden = !state.multiSelect || !canSelect;
  els.selectionCount.textContent = `${count} seçili`;
  els.multiSelectBtn.hidden = !canSelect;
  els.sortSelect.hidden = state.view === 'books';
  els.multiSelectBtn.classList.toggle('active', state.multiSelect);
  els.multiSelectBtn.textContent = state.multiSelect ? 'Seçimi kapat' : 'Çoklu seç';

  const trashMode = state.view === 'trash';
  els.bulkTagBtn.hidden = trashMode;
  els.bulkStatusBtn.hidden = trashMode;
  els.restoreSelectedBtn.hidden = !trashMode;
  els.deleteSelectedBtn.textContent = trashMode ? 'Kalıcı sil' : 'Seçilenleri sil';
  els.deleteSelectedBtn.disabled = count === 0;
  els.restoreSelectedBtn.disabled = count === 0;
  els.bulkTagBtn.disabled = count === 0;
  els.bulkStatusBtn.disabled = count === 0;
  els.clearSelectionBtn.disabled = count === 0;
}

function visiblePoemIds() {
  if (state.view === 'trash') return getTrashFilteredPoems().map((poem) => poem.id);
  return getFilteredPoems().map((poem) => poem.id);
}

function renderPoems() {
  const poems = getFilteredPoems();
  const activeCount = activePoems().length;
  els.emptyState.hidden = poems.length !== 0 || activeCount !== 0;

  if (!poems.length && activeCount) {
    els.poemGrid.innerHTML = `<div class="emptyState"><h2>Bu filtrede şiir yok.</h2><p>Başka bir etiket veya arama dene.</p></div>`;
    return;
  }

  els.poemGrid.innerHTML = poems.map((poem) => {
    const preview = plain(poem.content).slice(0, 520);
    const safeId = plain(poem.id);
    const checked = state.selectedIds.has(poem.id) ? 'checked' : '';
    const selectedClass = state.selectedIds.has(poem.id) ? 'selected' : '';
    const tags = visibleTagsForPoem(poem).slice(0, 5).map((tag) => `<button class="smallTag" data-card-tag="${plain(tag)}" type="button">#${plain(tag)}</button>`).join('');
    const bookBadge = bookBadgeForPoem(poem.id);
    return `
      <article class="poemCard ${state.multiSelect ? 'selectable' : ''} ${selectedClass}" data-id="${safeId}">
        ${state.multiSelect ? `<label class="selectBox" aria-label="Şiiri seç"><input type="checkbox" data-select-poem="${safeId}" ${checked} /><span></span></label>` : ''}
        <div class="cardTitleRow"><h3>${poem.favorite ? '★ ' : ''}${plain(poem.title)}</h3>${bookBadge}</div>
        <p>${preview}</p>
        <div class="cardTags">${tags}</div>
        <div class="cardMeta">
          <span>${formatDate(poem.updatedAt)} · ${poemLineCount(poem)} dize</span>
          <span class="cardButtons">
            <button class="miniBtn" data-read="${safeId}" type="button">Oku</button>
            <button class="miniBtn" data-share="${safeId}" type="button">Paylaş</button>
            <button class="miniBtn" data-edit="${safeId}" type="button">Düzenle</button>
          </span>
        </div>
      </article>
    `;
  }).join('');

  $$('[data-select-poem]').forEach((input) => input.addEventListener('click', (e) => {
    e.stopPropagation();
    if (input.checked) state.selectedIds.add(input.dataset.selectPoem);
    else state.selectedIds.delete(input.dataset.selectPoem);
    render();
  }));
  $$('[data-read]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openReader(btn.dataset.read);
  }));
  $$('[data-share]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    sharePoem(btn.dataset.share);
  }));
  $$('[data-edit]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openPoemDialog(btn.dataset.edit);
  }));
  $$('[data-card-tag]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.selectedTag = btn.dataset.cardTag;
    render();
  }));
  $$('.poemCard').forEach((card) => card.addEventListener('click', () => {
    if (state.multiSelect) {
      if (state.selectedIds.has(card.dataset.id)) state.selectedIds.delete(card.dataset.id);
      else state.selectedIds.add(card.dataset.id);
      render();
      return;
    }
    openReader(card.dataset.id);
  }));
}


function getTrashFilteredPoems() {
  const q = state.query.toLocaleLowerCase('tr-TR');
  return trashPoems()
    .filter((poem) => {
      if (!q) return true;
      return [poem.title, poem.content, ...(poem.tags || []), statusLabel(poem.status), poem.favorite ? 'Seçmeler' : '']
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(q);
    })
    .sort((a, b) => new Date(b.trashedAt || b.updatedAt) - new Date(a.trashedAt || a.updatedAt));
}

function renderTrashView() {
  const poems = getTrashFilteredPoems();
  els.emptyState.hidden = poems.length !== 0 || trashPoems().length !== 0;
  if (!trashPoems().length) {
    els.poemGrid.innerHTML = `<div class="emptyState trashEmpty"><h2>Çöp kutusu boş.</h2><p>Silinen şiirler burada sen kalıcı olarak silene kadar bekler.</p></div>`;
    return;
  }
  if (!poems.length) {
    els.poemGrid.innerHTML = `<div class="emptyState"><h2>Bu aramada silinmiş şiir yok.</h2><p>Başka bir kelime dene.</p></div>`;
    return;
  }

  els.poemGrid.innerHTML = poems.map((poem) => {
    const preview = plain(poem.content).slice(0, 520);
    const safeId = plain(poem.id);
    const checked = state.selectedIds.has(poem.id) ? 'checked' : '';
    const selectedClass = state.selectedIds.has(poem.id) ? 'selected' : '';
    const tags = visibleTagsForPoem(poem).slice(0, 5).map((tag) => `<button class="smallTag" data-card-tag="${plain(tag)}" type="button">#${plain(tag)}</button>`).join('');
    const bookBadge = bookBadgeForPoem(poem.id);
    return `
      <article class="poemCard trashCard ${state.multiSelect ? 'selectable' : ''} ${selectedClass}" data-id="${safeId}">
        ${state.multiSelect ? `<label class="selectBox" aria-label="Şiiri seç"><input type="checkbox" data-select-poem="${safeId}" ${checked} /><span></span></label>` : ''}
        <div class="cardTitleRow"><h3>${plain(poem.title)}</h3>${bookBadge}</div>
        <p>${preview}</p>
        <div class="cardTags">${tags}</div>
        <div class="cardMeta">
          <span>Silinme: ${formatDate(poem.trashedAt)} · ${poemLineCount(poem)} dize</span>
          <span class="cardButtons">
            <button class="miniBtn" data-restore="${safeId}" type="button">Geri yükle</button>
            <button class="dangerBtn compactDanger" data-hard-delete="${safeId}" type="button">Kalıcı sil</button>
          </span>
        </div>
      </article>
    `;
  }).join('');

  $$('[data-select-poem]').forEach((input) => input.addEventListener('click', (e) => {
    e.stopPropagation();
    if (input.checked) state.selectedIds.add(input.dataset.selectPoem);
    else state.selectedIds.delete(input.dataset.selectPoem);
    render();
  }));
  $$('[data-restore]').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreMany([btn.dataset.restore]);
    state.selectedIds.delete(btn.dataset.restore);
    await refresh();
    toast('Şiir geri yüklendi.');
  }));
  $$('[data-hard-delete]').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Bu şiir kalıcı olarak silinsin mi?')) return;
    await deletePoem(btn.dataset.hardDelete);
    state.selectedIds.delete(btn.dataset.hardDelete);
    await refresh();
    toast('Şiir kalıcı olarak silindi.');
  }));
  $$('.poemCard').forEach((card) => card.addEventListener('click', () => {
    if (!state.multiSelect) return;
    if (state.selectedIds.has(card.dataset.id)) state.selectedIds.delete(card.dataset.id);
    else state.selectedIds.add(card.dataset.id);
    render();
  }));
}

function ensureActiveBook() {
  if (!state.books.length) {
    const book = normalizeBook({ title: 'Kitap Adayı' });
    state.books = [book];
    state.activeBookId = book.id;
    saveBooks();
    return book;
  }
  let active = state.books.find((book) => book.id === state.activeBookId);
  if (!active) {
    active = state.books[0];
    state.activeBookId = active.id;
  }
  return active;
}

function bookSearchText(poem) {
  return [
    poem.title,
    poem.content,
    ...(poem.tags || []),
    statusLabel(poem.status),
    poem.favorite ? 'Seçmeler' : '',
    poem.status === 'archive' ? 'Arşiv' : '',
  ].join(' ').toLocaleLowerCase('tr-TR');
}

function getBookCandidates(book) {
  const ids = new Set(book.poemIds || []);
  const q = state.bookQuery.toLocaleLowerCase('tr-TR');
  const filtered = activePoems()
    .filter((poem) => !ids.has(poem.id) && !isPoemInAnotherBook(poem.id, book.id))
    .filter((poem) => !q || bookSearchText(poem).includes(q))
    .filter((poem) => !state.bookTag || visibleTagsForPoem(poem).includes(state.bookTag))
    .filter((poem) => {
      if (state.bookStatus === 'all') return true;
      return poem.status === state.bookStatus;
    });
  return sortPoemList(filtered, state.bookSort);
}

function getBookCandidatePool(book) {
  const ids = new Set(book.poemIds || []);
  const q = state.bookQuery.toLocaleLowerCase('tr-TR');
  return activePoems()
    .filter((poem) => !ids.has(poem.id) && !isPoemInAnotherBook(poem.id, book.id))
    .filter((poem) => !q || bookSearchText(poem).includes(q))
    .filter((poem) => !state.bookTag || visibleTagsForPoem(poem).includes(state.bookTag));
}

function getBookStatusCounts(book) {
  const pool = getBookCandidatePool(book);
  return {
    all: pool.length,
    draft: pool.filter((poem) => poem.status === 'draft').length,
    ready: pool.filter((poem) => poem.status === 'ready').length,
    archive: pool.filter((poem) => poem.status === 'archive').length,
  };
}

function visibleBookPoemIds(book) {
  return (book.poemIds || []).filter((id) => state.poems.some((poem) => poem.id === id && !poem.trashedAt));
}

function bookForPoem(poemId) {
  return state.books.find((book) => (book.poemIds || []).includes(poemId)) || null;
}

function bookBadgeForPoem(poemId) {
  const book = bookForPoem(poemId);
  return book ? `<span class="bookBadge" title="Kitap adayı: ${plain(book.title)}">${plain(book.title)}</span>` : '';
}

function isPoemInAnotherBook(poemId, currentBookId = '') {
  const book = bookForPoem(poemId);
  return Boolean(book && book.id !== currentBookId);
}

function renderBooksView() {
  const book = ensureActiveBook();
  const activeIds = new Set(activePoems().map((poem) => poem.id));
  book.poemIds = (book.poemIds || []).filter((id) => activeIds.has(id));
  saveBooks();
  const bookPoems = book.poemIds.map((id) => state.poems.find((poem) => poem.id === id && !poem.trashedAt)).filter(Boolean);
  const candidates = getBookCandidates(book);
  const candidateIds = new Set(candidates.map((poem) => poem.id));
  state.bookSelectedIds = new Set([...state.bookSelectedIds].filter((id) => candidateIds.has(id)));
  const tagButtons = getTagStats().map(([tag, count]) => `
    <button class="tagChip ${state.bookTag === tag ? 'active' : ''}" data-book-tag="${plain(tag)}" type="button">#${plain(tag)} <span class="tagCount">${count}</span></button>
  `).join('');
  const bookStatusCounts = getBookStatusCounts(book);
  const bookStatusOptions = [
    { key: 'all', label: 'Hepsi' },
    { key: 'draft', label: 'Taslak' },
    { key: 'ready', label: 'Yayına hazır' },
    { key: 'archive', label: 'Arşiv' },
  ];
  const statusButtons = bookStatusOptions.map((item) => `
    <button class="filterBtn bookStatusBtn ${state.bookStatus === item.key ? 'active' : ''}" data-book-status="${plain(item.key)}" type="button"><span>${plain(item.label)}</span><span class="tagCount">${bookStatusCounts[item.key] || 0}</span></button>
  `).join('');

  els.emptyState.hidden = true;
  els.poemGrid.innerHTML = `
    <section class="bookWorkspace">
      <div class="bookHeaderPanel panel">
        <div>
          <h2>Kitap adayları</h2>
          <p>Kitap rafı oluştur, sonra şiirleri genel arama, etiket veya durum üzerinden bulup ekle.</p>
        </div>
        <div class="bookCreateRow">
          <input id="bookNameInput" class="textInput" type="text" placeholder="Yeni kitap adı" />
          <button id="addBookBtn" class="primaryBtn modernBtn" type="button">Kitap oluştur</button>
        </div>
      </div>

      <div class="bookTabs panel">
        ${state.books.map((item) => `<button class="sideNavBtn bookTab ${item.id === book.id ? 'active' : ''}" data-book-id="${plain(item.id)}" type="button">${plain(item.title)} <span class="tagCount">${(item.poemIds || []).length}</span></button>`).join('')}
      </div>

      <div class="bookStack">
        <section class="panel bookPanelMain">
          <div class="panelTitleRow">
            <h2>${plain(book.title)}</h2>
            <button id="deleteBookBtn" class="dangerBtn compactDanger" type="button">Kitabı sil</button>
          </div>
          <p>${bookPoems.length} şiir bu kitap adayında.</p>
          <div class="bookPoemList">
            ${bookPoems.length ? bookPoems.map((poem) => {
              const safeId = plain(poem.id);
              return `
              <article class="bookPoemRow" data-book-row-id="${safeId}">
                <button class="bookPoemTitle" data-read-book-poem="${safeId}" type="button">${poem.favorite ? '★ ' : ''}${plain(poem.title)}</button>
                <span>${statusLabel(poem.status)}${poem.favorite ? ' · Seçmeler' : ''}</span>
                <button class="miniBtn" data-remove-from-book="${safeId}" type="button">Çıkar</button>
              </article>`;
            }).join('') : '<p>Bu kitapta henüz şiir yok.</p>'}
          </div>
        </section>

        <section class="panel bookPanelMain">
          <h2>Şiir ekle</h2>
          <input id="bookSearchInput" class="textInput" type="search" placeholder="Başlık, dize, etiket, durum ara..." value="${plain(state.bookQuery)}" />
          <div class="bookFilterBlock">
            <strong>Etiketle ara</strong>
            <div class="tagCloud">${tagButtons || '<p>Etiket yok.</p>'}</div>
          </div>
          <div class="bookFilterBlock">
            <strong>Durumla ara</strong>
            <div class="filterGrid bookStatusGrid">${statusButtons}</div>
          </div>
          <div class="bookSelectionTools candidateSelectionTools">
            <button id="bookMultiSelectBtn" class="ghostBtn modernBtn" type="button">${state.bookMultiSelect ? 'Seçimi kapat' : 'Çoklu seç'}</button>
            <select id="bookSortSelect" class="selectInput bookSortSelect" aria-label="Kitap adayları sıralama">
              <option value="updatedDesc" ${state.bookSort === 'updatedDesc' ? 'selected' : ''}>Son düzenlenen</option>
              <option value="createdDesc" ${state.bookSort === 'createdDesc' ? 'selected' : ''}>Yeni eklenen</option>
              <option value="titleAsc" ${state.bookSort === 'titleAsc' ? 'selected' : ''}>Başlık A-Z</option>
              <option value="lengthDesc" ${state.bookSort === 'lengthDesc' ? 'selected' : ''}>Uzun şiirler</option>
            </select>
            <div class="selectionBar bookSelectionBar" ${state.bookMultiSelect ? '' : 'hidden'}>
              <span id="bookSelectionCount">${state.bookSelectedIds.size} seçili</span>
              <button id="bookSelectVisibleBtn" class="miniBtn" type="button">Görünenleri seç</button>
              <button id="bookClearSelectionBtn" class="miniBtn" type="button">Seçimi temizle</button>
              <button id="bookAddSelectedBtn" class="miniBtn" type="button" ${state.bookSelectedIds.size ? '' : 'disabled'}>Seçilenleri kitaba ekle</button>
            </div>
          </div>
          <div id="bookCandidateList" class="candidateList">
            ${candidates.length ? candidates.map((poem) => {
              const safeId = plain(poem.id);
              const checked = state.bookSelectedIds.has(poem.id) ? 'checked' : '';
              const selectedClass = state.bookSelectedIds.has(poem.id) ? 'selected' : '';
              return `
              <article class="candidateRow ${state.bookMultiSelect ? 'selectable' : ''} ${selectedClass}" data-candidate-row-id="${safeId}">
                ${state.bookMultiSelect ? `<label class="selectBox bookSelectBox" aria-label="Şiiri seç"><input type="checkbox" data-select-book-candidate="${safeId}" ${checked} /><span></span></label>` : ''}
                <div>
                  <button class="bookPoemTitle" data-read-book-poem="${safeId}" type="button">${poem.favorite ? '★ ' : ''}${plain(poem.title)}</button>
                  <span>${statusLabel(poem.status)}${poem.favorite ? ' · Seçmeler' : ''}</span>
                </div>
                <button class="miniBtn" data-add-to-book="${safeId}" type="button">Ekle</button>
              </article>`;
            }).join('') : '<p>Bu aramada eklenebilir şiir yok.</p>'}
          </div>
        </section>
      </div>
    </section>
  `;

  $('#addBookBtn')?.addEventListener('click', () => {
    const title = normalizeText($('#bookNameInput')?.value);
    if (!title) return toast('Kitap adı yaz.');
    const newBook = normalizeBook({ title });
    state.books.push(newBook);
    state.activeBookId = newBook.id;
    saveBooks();
    render();
  });
  $$('.bookTab').forEach((btn) => btn.addEventListener('click', () => {
    state.activeBookId = btn.dataset.bookId;
    state.bookSelectedIds.clear();
    state.bookMultiSelect = false;
    render();
  }));
  $('#deleteBookBtn')?.addEventListener('click', () => {
    if (state.books.length <= 1) return toast('En az bir kitap rafı kalsın.');
    if (!confirm(`“${book.title}” kitap adayı silinsin mi? Şiirlerin kendisi silinmez.`)) return;
    state.books = state.books.filter((item) => item.id !== book.id);
    state.activeBookId = state.books[0]?.id || '';
    saveBooks();
    render();
  });
  function candidateRowHtml(poem) {
    const safeId = plain(poem.id);
    const checked = state.bookSelectedIds.has(poem.id) ? 'checked' : '';
    const selectedClass = state.bookSelectedIds.has(poem.id) ? 'selected' : '';
    return `
      <article class="candidateRow ${state.bookMultiSelect ? 'selectable' : ''} ${selectedClass}" data-candidate-row-id="${safeId}">
        ${state.bookMultiSelect ? `<label class="selectBox bookSelectBox" aria-label="Şiiri seç"><input type="checkbox" data-select-book-candidate="${safeId}" ${checked} /><span></span></label>` : ''}
        <div>
          <button class="bookPoemTitle" data-read-book-poem="${safeId}" type="button">${poem.favorite ? '★ ' : ''}${plain(poem.title)}</button>
          <span>${statusLabel(poem.status)}${poem.favorite ? ' · Seçmeler' : ''}</span>
        </div>
        <button class="miniBtn" data-add-to-book="${safeId}" type="button">Ekle</button>
      </article>`;
  }

  function updateBookSelectionControls(currentCandidates = getBookCandidates(book)) {
    const candidateIdsNow = new Set(currentCandidates.map((poem) => poem.id));
    state.bookSelectedIds = new Set([...state.bookSelectedIds].filter((id) => candidateIdsNow.has(id)));
    const countEl = $('#bookSelectionCount');
    if (countEl) countEl.textContent = `${state.bookSelectedIds.size} seçili`;
    const addBtn = $('#bookAddSelectedBtn');
    if (addBtn) addBtn.disabled = state.bookSelectedIds.size === 0;
    const multiBtn = $('#bookMultiSelectBtn');
    if (multiBtn) multiBtn.textContent = state.bookMultiSelect ? 'Seçimi kapat' : 'Çoklu seç';
    const bar = $('.bookSelectionBar');
    if (bar) bar.hidden = !state.bookMultiSelect;
  }

  function updateBookStatusButtonCounts() {
    const counts = getBookStatusCounts(book);
    $$('.bookStatusBtn').forEach((btn) => {
      const key = btn.dataset.bookStatus;
      const label = bookStatusOptions.find((item) => item.key === key)?.label || key;
      btn.classList.toggle('active', state.bookStatus === key);
      btn.innerHTML = `<span>${plain(label)}</span><span class="tagCount">${counts[key] || 0}</span>`;
    });
  }

  function bindBookCandidateRows() {
    $$('#bookCandidateList [data-select-book-candidate]').forEach((input) => {
      input.addEventListener('change', (event) => {
        event.stopPropagation();
        if (input.checked) state.bookSelectedIds.add(input.dataset.selectBookCandidate);
        else state.bookSelectedIds.delete(input.dataset.selectBookCandidate);
        renderBookCandidatesOnly();
      });
    });
    $$('#bookCandidateList [data-candidate-row-id]').forEach((row) => row.addEventListener('click', (event) => {
      if (event.target.closest('[data-add-to-book]')) return;
      if (event.target.closest('[data-select-book-candidate], .bookSelectBox')) return;
      if (!state.bookMultiSelect) {
        openReader(row.dataset.candidateRowId, false);
        return;
      }
      if (event.target.closest('button')) return;
      if (state.bookSelectedIds.has(row.dataset.candidateRowId)) state.bookSelectedIds.delete(row.dataset.candidateRowId);
      else state.bookSelectedIds.add(row.dataset.candidateRowId);
      renderBookCandidatesOnly();
    }));
    $$('#bookCandidateList [data-add-to-book]').forEach((btn) => btn.addEventListener('click', (event) => {
      event.stopPropagation();
      addToBook([btn.dataset.addToBook]);
    }));
    $$('#bookCandidateList [data-read-book-poem]').forEach((btn) => btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openReader(btn.dataset.readBookPoem, false);
    }));
  }

  function renderBookCandidatesOnly() {
    const nextCandidates = getBookCandidates(book);
    updateBookSelectionControls(nextCandidates);
    updateBookStatusButtonCounts();
    const list = $('#bookCandidateList');
    if (list) {
      list.innerHTML = nextCandidates.length ? nextCandidates.map(candidateRowHtml).join('') : '<p>Bu aramada eklenebilir şiir yok.</p>';
    }
    bindBookCandidateRows();
  }

  $('#bookMultiSelectBtn')?.addEventListener('click', () => {
    state.bookMultiSelect = !state.bookMultiSelect;
    if (!state.bookMultiSelect) state.bookSelectedIds.clear();
    renderBookCandidatesOnly();
  });
  $('#bookSelectVisibleBtn')?.addEventListener('click', () => {
    getBookCandidates(book).map((poem) => poem.id).forEach((id) => state.bookSelectedIds.add(id));
    renderBookCandidatesOnly();
  });
  $('#bookClearSelectionBtn')?.addEventListener('click', () => {
    state.bookSelectedIds.clear();
    renderBookCandidatesOnly();
  });
  $('#bookAddSelectedBtn')?.addEventListener('click', () => {
    const ids = [...state.bookSelectedIds];
    if (!ids.length) return;
    addToBook(ids);
    state.bookSelectedIds.clear();
    state.bookMultiSelect = false;
    toast(`${ids.length} şiir kitaba eklendi.`);
  });
  $('#bookSearchInput')?.addEventListener('input', (event) => {
    state.bookQuery = event.target.value;
    renderBookCandidatesOnly();
  });
  $('#bookSortSelect')?.addEventListener('change', (event) => {
    state.bookSort = event.target.value;
    renderBookCandidatesOnly();
  });
  $$('[data-book-tag]').forEach((btn) => btn.addEventListener('click', () => {
    state.bookTag = state.bookTag === btn.dataset.bookTag ? '' : btn.dataset.bookTag;
    state.bookSelectedIds.clear();
    render();
  }));
  $$('[data-book-status]').forEach((btn) => btn.addEventListener('click', () => {
    state.bookStatus = btn.dataset.bookStatus;
    state.bookSelectedIds.clear();
    renderBookCandidatesOnly();
  }));
  function addToBook(ids) {
    const addableIds = ids.filter((id) => !isPoemInAnotherBook(id, book.id));
    if (!addableIds.length) {
      toast('Seçilen şiir zaten başka bir kitap adayında.');
      return;
    }
    book.poemIds = [...new Set([...(book.poemIds || []), ...addableIds])];
    book.updatedAt = nowIso();
    saveBooks();
    render();
  }
  bindBookCandidateRows();

  $$('[data-remove-from-book]').forEach((btn) => btn.addEventListener('click', () => {
    book.poemIds = (book.poemIds || []).filter((id) => id !== btn.dataset.removeFromBook);
    book.updatedAt = nowIso();
    saveBooks();
    render();
  }));
  $$('.bookPoemList [data-read-book-poem]').forEach((btn) => btn.addEventListener('click', (event) => { event.stopPropagation(); openReader(btn.dataset.readBookPoem, false); }));

}

function render() {
  renderStats();
  renderTags();
  renderNavigation();
  renderActiveFilters();
  renderStatusButtons();
  renderSelectionBar();
  if (state.view === 'books') renderBooksView();
  else if (state.view === 'trash') renderTrashView();
  else renderPoems();
}

async function refresh() {
  state.poems = await getAllPoems();
  const ids = new Set(state.poems.map((poem) => poem.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => ids.has(id)));
  render();
}


function updatePoemBookControls(poem) {
  if (!els.poemBookBlock) return;
  if (!poem) {
    els.poemBookBlock.hidden = true;
    return;
  }
  els.poemBookBlock.hidden = false;
  const currentBook = bookForPoem(poem.id);
  els.poemBookCurrent.textContent = currentBook ? `Şu an: ${currentBook.title}` : 'Kitaba bağlı değil';
  const options = ['<option value="">Kitap seç</option>', ...state.books.map((book) => `<option value="${plain(book.id)}">${plain(book.title)}</option>`)].join('');
  els.poemBookSelect.innerHTML = options;
  els.poemBookSelect.value = currentBook?.id || '';
  els.removePoemBookBtn.disabled = !currentBook;
  els.changePoemBookBtn.disabled = !state.books.length;
}

function movePoemToBookFromDialog() {
  const poemId = els.poemIdInput.value;
  const poem = state.poems.find((p) => p.id === poemId);
  const targetBookId = els.poemBookSelect.value;
  const targetBook = state.books.find((book) => book.id === targetBookId);
  if (!poem || !targetBook) {
    toast('Önce kitap seç.');
    return;
  }
  const currentBook = bookForPoem(poemId);
  if (currentBook?.id === targetBook.id) {
    toast('Şiir zaten bu kitapta.');
    return;
  }
  const message = currentBook
    ? `“${poem.title}” şiiri “${currentBook.title}” kitabından çıkarılıp “${targetBook.title}” kitabına taşınsın mı?`
    : `“${poem.title}” şiiri “${targetBook.title}” kitabına eklensin mi?`;
  if (!confirm(message)) return;
  state.books.forEach((book) => {
    book.poemIds = (book.poemIds || []).filter((id) => id !== poemId);
  });
  targetBook.poemIds = [...new Set([...(targetBook.poemIds || []), poemId])];
  targetBook.updatedAt = nowIso();
  saveBooks();
  updatePoemBookControls(poem);
  render();
  toast('Kitap bilgisi güncellendi.');
}

function removePoemFromBookFromDialog() {
  const poemId = els.poemIdInput.value;
  const poem = state.poems.find((p) => p.id === poemId);
  const currentBook = bookForPoem(poemId);
  if (!poem || !currentBook) return toast('Bu şiir bir kitaba bağlı değil.');
  if (!confirm(`“${poem.title}” şiiri “${currentBook.title}” kitabından çıkarılsın mı?`)) return;
  currentBook.poemIds = (currentBook.poemIds || []).filter((id) => id !== poemId);
  currentBook.updatedAt = nowIso();
  saveBooks();
  updatePoemBookControls(poem);
  render();
  toast('Şiir kitaptan çıkarıldı.');
}

function openPoemDialog(id = '') {
  const poem = id ? state.poems.find((p) => p.id === id) : null;
  els.dialogTitle.textContent = poem ? 'Şiiri düzenle' : 'Yeni şiir';
  els.poemIdInput.value = poem?.id || '';
  els.titleInput.value = poem?.title || '';
  els.contentInput.value = poem?.content || '';
  els.tagsInput.value = (poem?.tags || []).join(', ');
  els.statusInput.value = poem?.status || 'draft';
  els.favoriteInput.checked = Boolean(poem?.favorite);
  els.deletePoemBtn.hidden = !poem;
  updatePoemBookControls(poem);
  if (els.tagSuggestions) { els.tagSuggestions.hidden = true; els.tagSuggestions.innerHTML = ''; }
  els.poemDialog.showModal();
  setTimeout(() => (poem ? els.contentInput : els.titleInput).focus(), 60);
}

function openReader(id, allowEdit = true) {
  const poem = state.poems.find((p) => p.id === id);
  if (!poem) return;
  state.readerPoemId = id;
  els.readerTitle.textContent = poem.favorite ? `★ ${poem.title}` : poem.title;
  els.readerMeta.textContent = `${formatDate(poem.updatedAt)} · ${poemWordCount(poem)} kelime · ${poemLineCount(poem)} dize`;
  els.readerTags.innerHTML = visibleTagsForPoem(poem).map((tag) => `<button class="tagChip" data-reader-tag="${plain(tag)}" type="button">#${plain(tag)}</button>`).join('');
  els.readerContent.textContent = poem.content;
  els.readerEditBtn.hidden = !allowEdit;
  els.readerDialog.showModal();
  $$('[data-reader-tag]').forEach((btn) => btn.addEventListener('click', () => {
    state.selectedTag = btn.dataset.readerTag;
    els.readerDialog.close();
    render();
  }));
}


async function sharePoem(id) {
  const poem = state.poems.find((p) => p.id === id);
  if (!poem) return;
  const title = poem.title || 'Şiir';
  const text = String(poem.content || '');
  try {
    if (window.AndroidBridge?.shareText) {
      window.AndroidBridge.shareText(title, text);
      return;
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Paylaşım desteklenmedi, metin panoya kopyalandı.');
  } catch (err) {
    console.warn(err);
    toast('Paylaşım iptal edildi veya başarısız oldu.');
  }
}

async function handleSave(e) {
  e.preventDefault();
  const poem = poemFromForm();
  if (!poem.content) {
    toast('Şiir metni boş kalmasın.');
    return;
  }
  await savePoem(poem);
  els.poemDialog.close();
  await refresh();
  toast('Şiir kaydedildi.');
}

async function handleDelete() {
  const id = els.poemIdInput.value;
  if (!id) return;
  const poem = state.poems.find((p) => p.id === id);
  const ok = confirm(`“${poem?.title || 'Bu şiir'}” çöp kutusuna taşınsın mı?`);
  if (!ok) return;
  await moveManyToTrash([id]);
  els.poemDialog.close();
  await refresh();
  toast('Şiir çöp kutusuna taşındı.');
}


function openBulkEditDialog(mode) {
  const count = state.selectedIds.size;
  if (!count) return;

  state.bulkEditMode = mode;
  els.bulkEditDialog.dataset.mode = mode;
  els.bulkRemoveInput.value = '';
  els.bulkAddInput.value = '';
  els.bulkRemoveSuggestions.hidden = true;
  els.bulkAddSuggestions.hidden = true;
  els.bulkRemoveSuggestions.innerHTML = '';
  els.bulkAddSuggestions.innerHTML = '';

  if (mode === 'tag') {
    const suggestedRemove = state.selectedTag || '';
    els.bulkEditTitle.textContent = 'Etiket değiştir-sil';
    els.bulkEditDescription.textContent = `${count} seçili şiir için etiket ekleyebilir, silebilir veya değiştirebilirsin.`;
    els.bulkRemoveLabel.textContent = 'Silinecek/değiştirilecek etiketi yaz';
    els.bulkAddLabel.textContent = 'Yeni etiketi yaz';
    els.bulkRemoveInput.placeholder = 'Örn: munnesir, savaş, (boş)';
    els.bulkAddInput.placeholder = 'Örn: savaş, aşk, yalnızlık';
    els.bulkRemoveInput.value = suggestedRemove;
  } else {
    const suggestedStatus = state.selectedStatus && state.selectedStatus !== 'all' ? statusLabel(state.selectedStatus) : '';
    els.bulkEditTitle.textContent = 'Durum değiştir-sil';
    els.bulkEditDescription.textContent = `${count} seçili şiirin durumunu toplu değiştirebilirsin.`;
    els.bulkRemoveLabel.textContent = 'Silinecek/değiştirilecek durumu yaz';
    els.bulkAddLabel.textContent = 'Yeni durumu yaz';
    els.bulkRemoveInput.placeholder = 'Örn: Taslak, Yayına hazır, Seçmeler';
    els.bulkAddInput.placeholder = 'Örn: Yayına hazır, Taslak, Arşiv';
    els.bulkRemoveInput.value = suggestedStatus;
  }

  els.bulkEditDialog.showModal();
  setTimeout(() => els.bulkAddInput.focus(), 60);
}

function handleBulkTagEdit() {
  openBulkEditDialog('tag');
}

function handleBulkStatusEdit() {
  openBulkEditDialog('status');
}

function statusLabel(value) {
  const option = STATUS_OPTIONS.find((item) => item.key === value);
  return option ? option.label : String(value || '');
}

function normalizeLookup(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ');
}

function statusSearchText(option) {
  return [option.key, option.label, ...option.aliases].map(normalizeLookup).join(' ');
}

function getStatusSuggestions(term) {
  const q = normalizeLookup(term);
  if (!q) return [];
  return STATUS_OPTIONS
    .filter((option) => statusSearchText(option).includes(q))
    .slice(0, 8);
}

function resolveStatusInput(value) {
  const q = normalizeLookup(value);
  if (!q) return null;
  const exact = STATUS_OPTIONS.find((option) => (
    option.key === q ||
    normalizeLookup(option.label) === q ||
    option.aliases.some((alias) => normalizeLookup(alias) === q)
  ));
  if (exact) return exact;
  const matches = getStatusSuggestions(value);
  return matches.length === 1 ? matches[0] : null;
}

function suggestionItemsForBulk(term) {
  if (state.bulkEditMode === 'status') {
    return getStatusSuggestions(term).map((option) => ({ value: option.label, label: option.label }));
  }
  return getTagSuggestions(term, { includeEmpty: true }).map((tag) => ({ value: tag, label: `#${tag}` }));
}

function renderBulkSuggestions(input, box) {
  if (!input || !box) return;
  const suggestions = suggestionItemsForBulk(input.value);
  box.hidden = !suggestions.length;
  box.innerHTML = suggestions.map((item) => `
    <button class="tagSuggestion" data-bulk-suggest="${plain(item.value)}" type="button">${plain(item.label)}</button>
  `).join('');
}

async function applyBulkTagEdit(removeRaw, addRaw) {
  const ids = [...state.selectedIds];
  const removeTag = normalizeTag(removeRaw);
  const addTag = normalizeTag(addRaw);
  if (!removeTag && !addTag) {
    toast('Etiket değişikliği yapılmadı.');
    return;
  }

  const selectedPoems = state.poems.filter((poem) => ids.includes(poem.id));
  const updated = selectedPoems.map((poem) => {
    let tags = normalizePoemTags(poem.tags || []);
    if (removeTag) tags = tags.filter((tag) => tag !== removeTag);
    if (addTag && !tags.includes(addTag)) tags.push(addTag);
    tags = normalizePoemTags(tags);
    return { ...poem, tags, updatedAt: nowIso() };
  });

  await saveMany(updated);
  await refresh();
  toast(`${updated.length} şiirin etiketi güncellendi.`);
}

async function applyBulkStatusEdit(removeRaw, addRaw) {
  const ids = [...state.selectedIds];
  const removeStatus = resolveStatusInput(removeRaw);
  const addStatus = resolveStatusInput(addRaw);

  if (!removeStatus && !addStatus) {
    toast('Durum değişikliği yapılmadı.');
    return;
  }
  if ((removeRaw && !removeStatus) || (addRaw && !addStatus)) {
    toast('Durum anlaşılamadı. Önerilerden birini seç.');
    return;
  }

  const selectedPoems = state.poems.filter((poem) => ids.includes(poem.id));
  const updated = selectedPoems.map((poem) => {
    const next = { ...poem, updatedAt: nowIso() };

    if (removeStatus?.key === 'favorite') next.favorite = false;
    if (removeStatus && removeStatus.key !== 'favorite' && !addStatus) {
      if (next.status === removeStatus.key) next.status = 'archive';
    }

    if (addStatus?.key === 'favorite') next.favorite = true;
    if (addStatus && addStatus.key !== 'favorite') next.status = addStatus.key;

    return next;
  });

  await saveMany(updated);
  await refresh();
  toast(`${updated.length} şiirin durumu güncellendi.`);
}

async function handleBulkEditSubmit(e) {
  e.preventDefault();
  const removeRaw = els.bulkRemoveInput.value.trim();
  const addRaw = els.bulkAddInput.value.trim();
  if (state.bulkEditMode === 'status') await applyBulkStatusEdit(removeRaw, addRaw);
  else await applyBulkTagEdit(removeRaw, addRaw);
  els.bulkEditDialog.close();
}

function getTagSuggestions(term, options = {}) {
  const q = normalizeTag(term);
  if (!q) return [];
  return getTagStats()
    .map(([tag]) => tag)
    .filter((tag) => (options.includeEmpty || tag !== EMPTY_TAG) && tag.includes(q))
    .slice(0, 8);
}

function currentTagFragment(value) {
  return String(value || '').split(',').pop().trim();
}

function replaceCurrentTagFragment(value, suggestion) {
  const parts = String(value || '').split(',');
  parts[parts.length - 1] = ` ${suggestion}`;
  return parts.map((part) => part.trim()).filter(Boolean).join(', ') + ', ';
}

function renderTagSuggestions() {
  if (!els.tagSuggestions) return;
  const fragment = currentTagFragment(els.tagsInput.value);
  const suggestions = getTagSuggestions(fragment);
  els.tagSuggestions.hidden = !suggestions.length;
  els.tagSuggestions.innerHTML = suggestions.map((tag) => `
    <button class="tagSuggestion" data-suggest-tag="${plain(tag)}" type="button">#${plain(tag)}</button>
  `).join('');
  $$('[data-suggest-tag]').forEach((btn) => btn.addEventListener('click', () => {
    els.tagsInput.value = replaceCurrentTagFragment(els.tagsInput.value, btn.dataset.suggestTag);
    els.tagsInput.focus();
    renderTagSuggestions();
  }));
}

async function handleDeleteSelected() {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  if (state.view === 'trash') {
    const ok = confirm(`${ids.length} şiir kalıcı olarak silinsin mi?`);
    if (!ok) return;
    await deleteMany(ids);
    state.selectedIds.clear();
    state.multiSelect = false;
    await refresh();
    toast(`${ids.length} şiir kalıcı olarak silindi.`);
    return;
  }
  const ok = confirm(`${ids.length} şiir çöp kutusuna taşınsın mı?`);
  if (!ok) return;
  await moveManyToTrash(ids);
  state.selectedIds.clear();
  state.multiSelect = false;
  await refresh();
  toast(`${ids.length} şiir çöp kutusuna taşındı.`);
}

async function handleRestoreSelected() {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  await restoreMany(ids);
  state.selectedIds.clear();
  state.multiSelect = false;
  await refresh();
  toast(`${ids.length} şiir geri yüklendi.`);
}

async function importKeepFiles(files) {
  const imported = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await file.text());
      const poem = extractKeepPoem(raw, file.name);
      if (poem) imported.push(poem);
    } catch (err) {
      console.warn('Okunamayan dosya:', file.name, err);
    }
  }
  await saveMany(imported);
  await refresh();
  toast(`${imported.length} Keep notu içe aktarıldı.`);
}

function normalizeBackupPoem(p) {
  return {
    id: p.id || uid(),
    title: normalizeText(p.title) || titleFromContent(p.content),
    content: normalizeText(p.content),
    tags: normalizePoemTags(p.tags || []),
    status: p.status || 'archive',
    favorite: Boolean(p.favorite),
    source: p.source || 'backup',
    createdAt: p.createdAt || nowIso(),
    updatedAt: p.updatedAt || p.createdAt || nowIso(),
    ...(p.trashedAt ? { trashedAt: p.trashedAt } : {}),
  };
}

async function importJsonPayloads(items, mode = 'yedek') {
  const imported = [];
  for (const item of items) {
    try {
      const raw = typeof item.content === 'string' ? JSON.parse(item.content) : item.raw;
      const fileName = item.name || 'arsiv.json';
      const poems = Array.isArray(raw) ? raw : raw.poems;
      if (Array.isArray(raw?.books)) {
        const incomingBooks = raw.books.map(normalizeBook).filter(Boolean);
        const existingIds = new Set(state.books.map((book) => book.id));
        incomingBooks.forEach((book) => {
          if (existingIds.has(book.id)) {
            const i = state.books.findIndex((item) => item.id === book.id);
            state.books[i] = book;
          } else {
            state.books.push(book);
          }
        });
        saveBooks();
      }
      if (Array.isArray(poems)) {
        imported.push(...poems.map(normalizeBackupPoem).filter((p) => p.content));
        continue;
      }
      const keepPoem = extractKeepPoem(raw, fileName);
      if (keepPoem) imported.push(keepPoem);
    } catch (err) {
      console.warn('Okunamayan JSON:', item.name, err);
    }
  }
  if (!imported.length) {
    toast('Yüklenecek geçerli JSON bulunamadı.');
    return;
  }
  await saveMany(imported);
  await refresh();
  toast(`${imported.length} şiir ${mode} yüklendi.`);
}

async function importBackupFile(file) {
  await importJsonPayloads([{ name: file.name, content: await file.text() }], 'yedekten');
}

window.receiveAndroidFolderJsons = async function receiveAndroidFolderJsons(jsonText) {
  try {
    const items = JSON.parse(jsonText);
    if (!Array.isArray(items)) throw new Error('Klasör verisi geçersiz.');
    await importJsonPayloads(items, 'klasörden');
  } catch (err) {
    toast('Klasör JSONları okunamadı.');
    console.error(err);
  }
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function backupFilename() {
  const d = new Date();
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = pad2(d.getFullYear() % 100);
  const hour = pad2(d.getHours());
  const minute = pad2(d.getMinutes());
  return `munnesir-${day}-${month}-${year}_${hour}-${minute}.json`;
}

function exportBackup() {
  const payload = {
    app: 'munnesir',
    version: '1.0',
    exportedAt: nowIso(),
    poemCount: state.poems.length,
    poems: state.poems,
    books: state.books,
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = backupFilename();

  if (window.AndroidBridge?.saveJsonBackup) {
    window.AndroidBridge.saveJsonBackup(filename, json);
    toast('Yedek kaydetme penceresi açıldı.');
    return;
  }
  if (window.AndroidBridge?.saveBackup) {
    window.AndroidBridge.saveBackup(filename, json);
    toast('Yedek kaydetme penceresi açıldı.');
    return;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Yedek indirildi.');
}


function updateScrollJumpButtons() {
  const top = window.scrollY || document.documentElement.scrollTop || 0;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const farFromTop = top > Math.min(700, window.innerHeight * 0.8);
  const farFromBottom = max - top > Math.min(900, window.innerHeight * 1.05);
  if (els.scrollTopBtn) els.scrollTopBtn.hidden = !farFromTop;
  if (els.scrollBottomBtn) els.scrollBottomBtn.hidden = !farFromBottom;
}

function setupScrollJumpButtons() {
  updateScrollJumpButtons();
  window.addEventListener('scroll', updateScrollJumpButtons, { passive: true });
  window.addEventListener('resize', updateScrollJumpButtons);
  els.scrollTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  els.scrollBottomBtn?.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
}

function applyTheme(theme) {
  const selected = ['light', 'purple', 'black'].includes(theme) ? theme : 'purple';
  document.documentElement.classList.remove('light', 'theme-light', 'theme-purple', 'theme-black');
  document.documentElement.classList.add(`theme-${selected}`);
  if (selected === 'light') document.documentElement.classList.add('light');
  localStorage.setItem('munnesir-theme', selected);
  $$('.themeChoice').forEach((btn) => btn.classList.toggle('active', btn.dataset.themeChoice === selected));
}

function setupTheme() {
  const saved = localStorage.getItem('munnesir-theme');
  applyTheme(saved === 'dark' ? 'purple' : (saved || 'purple'));
  els.themeToggle.addEventListener('click', () => {
    els.themeDialog.showModal();
    applyTheme(localStorage.getItem('munnesir-theme') || 'purple');
  });
  els.closeThemeBtn?.addEventListener('click', () => els.themeDialog.close());
  $$('.themeChoice').forEach((btn) => btn.addEventListener('click', () => {
    applyTheme(btn.dataset.themeChoice);
    els.themeDialog.close();
  }));
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW kaydı başarısız:', err));
  }
}

function bindEvents() {
  els.menuBtn.addEventListener('click', toggleSidebar);
  els.closeMenuBtn.addEventListener('click', () => setSidebarOpen(false));
  els.sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
  window.addEventListener('resize', () => {
    if (isDesktopLayout()) {
      els.sidebar?.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('open');
      document.body.classList.remove('sidebarOpen');
    }
    updateScrollJumpButtons();
  });
  els.homeViewBtn?.addEventListener('click', () => {
    state.view = 'home';
    state.query = '';
    state.selectedTag = '';
    state.selectedStatus = 'all';
    state.multiSelect = false;
    state.selectedIds.clear();
    state.bookMultiSelect = false;
    state.bookSelectedIds.clear();
    if (els.searchInput) els.searchInput.value = '';
    setSidebarOpen(false);
    render();
  });
  els.bookViewBtn?.addEventListener('click', () => {
    state.view = state.view === 'books' ? 'home' : 'books';
    state.multiSelect = false;
    state.selectedIds.clear();
    state.bookMultiSelect = false;
    state.bookSelectedIds.clear();
    setSidebarOpen(false);
    render();
  });
  els.trashViewBtn?.addEventListener('click', () => {
    state.view = state.view === 'trash' ? 'home' : 'trash';
    state.multiSelect = false;
    state.selectedIds.clear();
    state.bookMultiSelect = false;
    state.bookSelectedIds.clear();
    setSidebarOpen(false);
    render();
  });
  els.newPoemBtn.addEventListener('click', () => openPoemDialog());
  els.emptyNewPoemBtn.addEventListener('click', () => openPoemDialog());
  els.closeDialogBtn.addEventListener('click', () => els.poemDialog.close());
  els.cancelDialogBtn.addEventListener('click', () => els.poemDialog.close());
  els.closeReaderBtn.addEventListener('click', () => els.readerDialog.close());
  els.readerShareBtn.addEventListener('click', () => sharePoem(state.readerPoemId));
  els.readerEditBtn.addEventListener('click', () => {
    const id = state.readerPoemId;
    els.readerDialog.close();
    openPoemDialog(id);
  });
  els.poemForm.addEventListener('submit', handleSave);
  els.tagsInput.addEventListener('input', renderTagSuggestions);
  els.tagsInput.addEventListener('focus', renderTagSuggestions);
  els.tagsInput.addEventListener('blur', () => setTimeout(() => { if (els.tagSuggestions) els.tagSuggestions.hidden = true; }, 120));
  els.deletePoemBtn.addEventListener('click', handleDelete);
  els.changePoemBookBtn?.addEventListener('click', movePoemToBookFromDialog);
  els.removePoemBookBtn?.addEventListener('click', removePoemFromBookFromDialog);
  els.searchInput.addEventListener('input', () => {
    state.query = els.searchInput.value.trim();
    render();
  });
  els.clearFiltersBtn.addEventListener('click', () => {
    state.query = '';
    state.selectedTag = '';
    state.selectedStatus = 'all';
    els.searchInput.value = '';
    render();
  });
  $$('[data-status]').forEach((btn) => btn.addEventListener('click', () => {
    state.selectedStatus = btn.dataset.status;
    setSidebarOpen(false);
    render();
  }));
  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    render();
  });
  els.multiSelectBtn.addEventListener('click', () => {
    state.multiSelect = !state.multiSelect;
    if (!state.multiSelect) state.selectedIds.clear();
    render();
  });
  els.selectVisibleBtn.addEventListener('click', () => {
    visiblePoemIds().forEach((id) => state.selectedIds.add(id));
    render();
  });
  els.clearSelectionBtn.addEventListener('click', () => {
    state.selectedIds.clear();
    render();
  });
  els.restoreSelectedBtn.addEventListener('click', handleRestoreSelected);
  els.bulkTagBtn.addEventListener('click', handleBulkTagEdit);
  els.bulkStatusBtn.addEventListener('click', handleBulkStatusEdit);
  els.bulkEditForm.addEventListener('submit', handleBulkEditSubmit);
  els.closeBulkEditBtn.addEventListener('click', () => els.bulkEditDialog.close());
  els.cancelBulkEditBtn.addEventListener('click', () => els.bulkEditDialog.close());
  [
    [els.bulkRemoveInput, els.bulkRemoveSuggestions],
    [els.bulkAddInput, els.bulkAddSuggestions],
  ].forEach(([input, box]) => {
    input.addEventListener('input', () => renderBulkSuggestions(input, box));
    input.addEventListener('focus', () => renderBulkSuggestions(input, box));
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 120));
    box.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-bulk-suggest]');
      if (!btn) return;
      input.value = btn.dataset.bulkSuggest;
      box.hidden = true;
      input.focus();
    });
  });
  els.deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
  els.keepImportInput?.addEventListener('change', async () => {
    await importKeepFiles([...els.keepImportInput.files]);
    els.keepImportInput.value = '';
  });
  async function importFromInput(input, mode = 'yedekten') {
    const files = [...(input?.files || [])].filter((file) => file.name.toLocaleLowerCase('tr-TR').endsWith('.json'));
    if (files.length) {
      const items = await Promise.all(files.map(async (file) => ({
        name: file.webkitRelativePath || file.name,
        content: await file.text(),
      })));
      await importJsonPayloads(items, mode);
    }
    if (input) input.value = '';
  }

  els.backupImportBtn?.addEventListener('click', (event) => {
    if (window.AndroidBridge?.openBackupImportOptions) {
      event.preventDefault();
      window.AndroidBridge.openBackupImportOptions();
      return;
    }
    if (window.AndroidBridge?.openJsonFolderImport) {
      event.preventDefault();
      window.AndroidBridge.openJsonFolderImport();
      return;
    }
    els.importChoiceDialog?.showModal();
  });
  els.closeImportChoiceBtn?.addEventListener('click', () => els.importChoiceDialog?.close());
  els.importFileChoiceBtn?.addEventListener('click', () => {
    els.importChoiceDialog?.close();
    els.backupFileInput?.click();
  });
  els.importFolderChoiceBtn?.addEventListener('click', () => {
    els.importChoiceDialog?.close();
    els.backupFolderInput?.click();
  });
  els.backupFileInput?.addEventListener('change', async () => importFromInput(els.backupFileInput, 'yedekten'));
  els.backupFolderInput?.addEventListener('change', async () => importFromInput(els.backupFolderInput, 'klasörden'));
  els.exportBtn.addEventListener('click', exportBackup);
}

async function boot() {
  state.books = loadBooks();
  setupTheme();
  setupScrollJumpButtons();
  bindEvents();
  registerServiceWorker();
  await refresh();
}

boot().catch((err) => {
  console.error(err);
  toast('Uygulama açılırken bir sorun oldu.');
});
