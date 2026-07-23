import { state } from "./state.js";

import {
  nowIso,
  plain,
  formatDate,
  poemLineCount
} from "./utils.js";

import {
  saveMany,
  deleteMany,
  deletePoem
} from "./db.js";


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


async function handleRestoreSelected() {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  await restoreMany(ids);
  state.selectedIds.clear();
  state.multiSelect = false;
  await refresh();
  toast(`${ids.length} şiir geri yüklendi.`);
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


export {
  activePoems,
  trashPoems,
  moveManyToTrash,
  restoreMany,
  getTrashFilteredPoems,
  renderTrashView,
  handleRestoreSelected,
  handleDeleteSelected
};