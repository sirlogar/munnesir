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


function renderStatusButtons() {
  const counts = getHomeStatusCounts();
  $$('[data-status]').forEach((btn) => {
    const key = btn.dataset.status;
    btn.classList.toggle('active', key === state.selectedStatus);
    btn.innerHTML = `<span>${plain(homeStatusLabel(key))}</span><span class="tagCount">${counts[key] || 0}</span>`;
  });
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


function renderNavigation() {
  els.bookViewBtn?.classList.toggle('active', state.view === 'books');
  els.trashViewBtn?.classList.toggle('active', state.view === 'trash');
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