(function() {
  let db = null;
  const state = {
    poems: [],
    selectedStatus: 'all',
    selectedTag: '',
    searchQuery: '',
    poemFont: 'font-times'
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function openDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('munnesir-db', 1);
        req.onupgradeneeded = (e) => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('poems')) {
            d.createObjectStore('poems', { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => { db = e.target.result; resolve(db); };
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function getAllPoems() {
    return new Promise((resolve) => {
      if (!db) return resolve([]);
      try {
        const tx = db.transaction('poems', 'readonly');
        const store = tx.objectStore('poems');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  function savePoemToDB(poem) {
    return new Promise((resolve) => {
      if (!db) return resolve();
      try {
        const tx = db.transaction('poems', 'readwrite');
        const store = tx.objectStore('poems');
        store.put(poem);
        tx.oncomplete = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  function formatDate(dStr) {
    if (!dStr) return '';
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR');
  }

  function plain(str) {
    return String(str || '').replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[c]));
  }

  async function refresh() {
    state.poems = await getAllPoems();
    renderTags();
    renderFeed();
  }

  function renderTags() {
    const tagCloud = $('#tagCloud');
    if (!tagCloud) return;

    const tagsSet = new Set();
    state.poems.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(t => tagsSet.add(t));
      }
      const matches = (p.content || '').match(/#[\wığüşöçİĞÜŞÖÇ]+/g);
      if (matches) matches.forEach(m => tagsSet.add(m.replace('#', '')));
    });

    if (!tagsSet.size) {
      tagCloud.innerHTML = '<span style="font-size:0.8rem; opacity:0.5;">Etiket yok</span>';
      return;
    }

    tagCloud.innerHTML = [...tagsSet].map(tag => `
      <span class="tagItem ${state.selectedTag === tag ? 'active' : ''}" data-tag="${tag}">#${plain(tag)}</span>
    `).join('');

    $$('.tagItem').forEach(el => {
      el.addEventListener('click', () => {
        const tag = el.dataset.tag;
        state.selectedTag = (state.selectedTag === tag) ? '' : tag;
        renderTags();
        renderFeed();
      });
    });
  }

  function renderFeed() {
    const grid = $('#poemGrid');
    const emptyState = $('#emptyState');
    if (!grid) return;

    let list = state.poems.filter(p => !p.trashedAt);

    if (state.selectedStatus !== 'all') {
      if (state.selectedStatus === 'favorite') list = list.filter(p => p.favorite);
      else list = list.filter(p => p.status === state.selectedStatus);
    }

    if (state.selectedTag) {
      list = list.filter(p => (p.content || '').includes(`#${state.selectedTag}`) || (p.tags && p.tags.includes(state.selectedTag)));
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase('tr');
      list = list.filter(p => 
        (p.title || '').toLowerCase('tr').includes(q) || 
        (p.content || '').toLowerCase('tr').includes(q)
      );
    }

    const statsLine = $('#statsLine');
    if (statsLine) statsLine.textContent = `${list.length} şiir`;

    if (!list.length) {
      grid.innerHTML = '';
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    grid.innerHTML = list.map((p) => `
      <article class="poemCard" data-id="${p.id}">
        <h3>${p.favorite ? '★ ' : ''}${plain(p.title)}</h3>
        <p class="${state.poemFont}">${plain(p.content).slice(0, 150)}...</p>
        <span style="font-size:0.8rem; opacity:0.6;">${formatDate(p.updatedAt)}</span>
      </article>
    `).join('');

    $$('.poemCard').forEach(card => {
      card.addEventListener('click', () => openReader(card.dataset.id));
    });
  }

  function openReader(id) {
    const poem = state.poems.find(p => p.id === id);
    if (!poem) return;

    $('#readerTitle').textContent = poem.title;
    $('#readerMeta').textContent = formatDate(poem.updatedAt);
    const content = $('#readerContent');
    content.textContent = poem.content;
    content.className = `readerContent ${state.poemFont}`;

    $('#readerDialog')?.showModal();
  }

  function openEditor() {
    const dialog = $('#poemDialog');
    $('#poemTitleInput').value = '';
    $('#poemContentInput').value = '';
    delete dialog.dataset.editId;
    dialog?.showModal();
  }

  function applyTheme(t) {
    const selected = ['light', 'purple', 'black'].includes(t) ? t : 'purple';
    document.documentElement.className = `theme-${selected}`;
    localStorage.setItem('munnesir-theme', selected);
  }

  function initEvents() {
    $('#sidebarToggle')?.addEventListener('click', () => {
      $('#sidebar')?.classList.toggle('open');
    });

    $('#searchInput')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderFeed();
    });

    $('#newPoemFabBtn')?.addEventListener('click', () => openEditor());
    $('#closePoemBtn')?.addEventListener('click', () => $('#poemDialog')?.close());

    $('#poemForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('#poemTitleInput').value.trim();
      const content = $('#poemContentInput').value.trim();
      if (!content) return;

      const id = `poem-${Date.now()}`;
      const extractedTags = (content.match(/#[\wığüşöçİĞÜŞÖÇ]+/g) || []).map(t => t.replace('#', ''));

      const poemData = {
        id, title, content,
        tags: extractedTags,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'archive',
        favorite: false
      };

      await savePoemToDB(poemData);
      $('#poemDialog')?.close();
      await refresh();
    });

    $('#bookViewBtn')?.addEventListener('click', () => $('#bookDialog')?.showModal());
    $('#closeBookBtn')?.addEventListener('click', () => $('#bookDialog')?.close());
    $('#trashViewBtn')?.addEventListener('click', () => $('#trashDialog')?.showModal());
    $('#closeTrashBtn')?.addEventListener('click', () => $('#trashDialog')?.close());
    $('#settingsOpenBtn')?.addEventListener('click', () => $('#settingsDialog')?.showModal());
    $('#closeSettingsBtn')?.addEventListener('click', () => $('#settingsDialog')?.close());
    $('#closeReaderBtn')?.addEventListener('click', () => $('#readerDialog')?.close());

    $$('.themeChoice').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
    });

    $$('#statusFilters button').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#statusFilters button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedStatus = btn.dataset.status;
        renderFeed();
      });
    });

    applyTheme(localStorage.getItem('munnesir-theme') || 'purple');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initEvents();
    await openDB();
    await refresh();
  });

  window.refreshAll = refresh;
})();