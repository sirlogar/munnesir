import {
  state,
  EMPTY_TAG
} from "./state.js";

import {
  uid,
  nowIso,
  normalizeText,
  plain,
  formatDate
} from "./utils.js";

import {
  saveMany
} from "./db.js";


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

}

export {
  ensureActiveBook,
  bookSearchText,
  getBookCandidates,
  getBookCandidatePool,
  getBookStatusCounts,
  visibleBookPoemIds,
  bookForPoem,
  bookBadgeForPoem,
  isPoemInAnotherBook,
  renderBooksView,
  updatePoemBookControls,
  movePoemToBookFromDialog,
  removePoemFromBookFromDialog
};