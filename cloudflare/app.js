(function() {
  let db = null;
  const state = {
    poems: [],
    selectedStatus: 'all',
    selectedTag: '',
    searchQuery: '',
    poemFont: localStorage.getItem('munnesir-poem-font') || 'font-times'
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function openDB() {
    return new Promise((resolve) => {
      const req = indexedDB.open('munnesir-db', 1);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('poems')) {
          d.createObjectStore('poems', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    });
  }

  function getAllPoems() {
    return new Promise((resolve) => {
      if (!db) return resolve([]);
      const tx = db.transaction('poems', 'readonly');
      const store = tx.objectStore('poems');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  function savePoemToDB(poem) {
    return new Promise((resolve) => {
      if (!db) return resolve();
      const tx = db.transaction('poems', 'readwrite');
      const store = tx.objectStore('poems');
      store.put(poem);
      tx.oncomplete = () => resolve();
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

  // 4. ETİKETLERİ DİNAMİK ÇIKARMA VE BASTIRMA
  function renderTags() {
    const tagCloud = $('#tagCloud');
    if (!tagCloud) return;

    const tagsSet = new Set();
    state.poems.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(t => tagsSet.add(t));
      }
      // Metin içinde geçen #etiket taraması
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

  // 5. ARAMA VE FİLTRELEME MOTORU
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

    // ARAMA SÜZGECİ
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

  function openEditor(id = null) {
    const dialog = $('#poemDialog');
    const titleInput = $('#poemTitleInput');
    const contentInput = $('#poemContentInput');

    if (id) {
      const poem = state.poems.find(p => p.id === id);
      if (poem) {
        titleInput.value = poem.title;
        contentInput.value = poem.content;
        dialog.dataset.editId = id;
      }
    } else {
      titleInput.value = '';
      contentInput.value = '';
      delete dialog.dataset.editId;
    }

    dialog?.showModal();
  }

  // 2. TEMA DEĞİŞTİRME MOTORU
  function applyTheme(t) {
    document.documentElement.className = `theme-${t}`;
    localStorage.setItem('munnesir-theme', t);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await openDB();
    await refresh();

    // 1. HAMBURGER MENÜ TETİKLEYİCİSİ
    $('#sidebarToggle')?.addEventListener('click', () => {
      $('#sidebar')?.classList.toggle('open');
    });

    // 5. ANLIK CANLI ARAMA
    $('#searchInput')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderFeed();
    });

    // FLOATING FAB BUTTON
    $('#newPoemFabBtn')?.addEventListener('click', () => openEditor());
    $('#closePoemBtn')?.addEventListener('click', () => $('#poemDialog')?.close());

    // ŞİİR KAYDETME
    $('#poemForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dialog = $('#poemDialog');
      const title = $('#poemTitleInput').value.trim();
      const content = $('#poemContentInput').value.trim();

      if (!content) return;

      const id = dialog.dataset.editId || `poem-${Date.now()}`;
      const existing = state.poems.find(p => p.id === id);

      // Metinden Etiket Çıkarma
      const extractedTags = (content.match(/#[\wığüşöçİĞÜŞÖÇ]+/g) || []).map(t => t.replace('#', ''));

      const poemData = {
        id, title, content,
        tags: extractedTags,
        updatedAt: new Date().toISOString(),
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        status: existing ? existing.status : 'draft',
        favorite: existing ? existing.favorite : false
      };

      await savePoemToDB(poemData);
      dialog.close();
      await refresh();
    });

    // POP-UP TIKLAMALARI
    $('#bookViewBtn')?.addEventListener('click', () => $('#bookDialog')?.showModal());
    $('#closeBookBtn')?.addEventListener('click', () => $('#bookDialog')?.close());
    $('#trashViewBtn')?.addEventListener('click', () => $('#trashDialog')?.showModal());
    $('#closeTrashBtn')?.addEventListener('click', () => $('#trashDialog')?.close());
    $('#settingsOpenBtn')?.addEventListener('click', () => $('#settingsDialog')?.showModal());
    $('#closeSettingsBtn')?.addEventListener('click', () => $('#settingsDialog')?.close());
    $('#closeReaderBtn')?.addEventListener('click', () => $('#readerDialog')?.close());

    // 2. TEMA SEÇİM DİNLEYİCİSİ
    $$('.themeChoice').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
    });

    // DURUM FİLTRELERİ
    $$('#statusFilters button').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#statusFilters button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedStatus = btn.dataset.status;
        renderFeed();
      });
    });

    applyTheme(localStorage.getItem('munnesir-theme') || 'purple');
  });
})();