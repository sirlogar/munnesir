import { state } from "./state.js";


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


export {
  bindEvents
};