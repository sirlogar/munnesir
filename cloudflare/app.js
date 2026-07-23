import {
    openDb,
    getAllPoems,
    savePoem,
    deletePoem,
    deleteMany,
    saveMany
} from "./db.js";


import {
  uid,
  nowIso,
  normalizeText,
  normalizeTag,
  parseTags,
  normalizePoemTags,
  titleFromContent,
  usecToIso,
  formatDate,
  plain,
  poemWordCount,
  poemLineCount,
  normalizeLookup,
  pad2,
  backupFilename
} from "./utils.js";


import {
    state,
    DB_NAME,
    DB_VERSION,
    STORE,
    EMPTY_TAG,
    BOOKS_KEY,
    STATUS_OPTIONS
} from "./state.js";


const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  statsLine: $('#statsLine'),
  menuBtn: $('#menuBtn'),
  settingsBtn: $('#settingsBtn'),
  settingsDialog: $('#settingsDialog'),
  closeSettingsBtn: $('#closeSettingsBtn'),
  settingsTitle: $('#settingsTitle'),
  settingsHome: $('#settingsHome'),
  settingsDetail: $('#settingsDetail'),
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
  sidebarBooks: $('#sidebarBooks'),
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


function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
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





function visiblePoemIds() {
  if (state.view === 'trash') return getTrashFilteredPoems().map((poem) => poem.id);
  return getFilteredPoems().map((poem) => poem.id);
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



async function refresh() {
  state.poems = await getAllPoems();
  const ids = new Set(state.poems.map((poem) => poem.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => ids.has(id)));
  render();
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



function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW kaydı başarısız:', err));
  }
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
