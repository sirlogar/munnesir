(function() {
  let db = null;
  let currentEditingId = null;
  let currentSelectedFont = 'font-tinos';

  const state = {
    poems: [],
    selectedStatus: 'all',
    selectedTag: '',
    searchQuery: '',
    sortOrder: 'updatedDesc'
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];


// APK İLE AYNI CANLI SUNUCU ADRESİNİ YAKALAYAN KÖPRÜ
  function getApiUrl(endpoint) {
    // Eğer sync.js içinde tanımlı bir baseUrl varsa onu kullan, yoksa yerel origin'e git
    const baseUrl = (window.Sync && window.Sync.baseUrl) 
      ? window.Sync.baseUrl 
      : (window.location.origin.includes('localhost') || window.location.protocol === 'file:')
        ? 'https://munnesir.pages.dev' // <--- APK'nın bağlandığı kendi Cloudflare Pages / Worker alan adın
        : '';
    return `${baseUrl}${endpoint}`;
  }

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

  function getPoemDate(p) {
    // Öncelik 1: Şiirin asıl ilk oluşturulma tarihi (createdAt)
    // Öncelik 2: Güncelleme tarihi (updatedAt)
    const rawDate = p.createdAt || p.updatedAt;
    if (!rawDate) return '';
    
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
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
    const container = $('#tagCloud');
    if (!container) return;
    
    // Yalnızca silinmemiş (aktif) şiirleri filtrele
    const activePoems = state.poems.filter(p => !p.trashedAt && p.status !== 'trash' && p.status !== 'deleted');

    const tagCounts = {};
    activePoems.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          if (t && t !== '(boş)') {
            const clean = t.trim();
            tagCounts[clean] = (tagCounts[clean] || 0) + 1;
          }
        });
      }
    });

    const sortedTags = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b, 'tr'));
    
    // Sayıyı tamamen aktif şiirlerin sayısına eşitle
    let html = `
      <button class="tagItem ${!state.selectedTag ? 'active' : ''}" data-tag="">
        <span>#(tümü)</span>
        <small style="opacity:0.6;">${activePoems.length}</small>
      </button>
    `;

    sortedTags.forEach(tag => {
      const active = state.selectedTag === tag ? 'active' : '';
      html += `
        <button class="tagItem ${active}" data-tag="${tag}">
          <span>#${plain(tag)}</span>
          <small style="opacity:0.6;">${tagCounts[tag]}</small>
        </button>
      `;
    });

    container.innerHTML = html;

    // Etiket Tıklama Dinleyicileri
    $$('#tagCloud .tagItem').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clickedTag = btn.dataset.tag;
        state.selectedTag = clickedTag;
        
        const editBox = $('#tagEditBox');
        const editInput = $('#editTagInput');
        if (editBox && editInput) {
          if (clickedTag) {
            editBox.hidden = false;
            editInput.value = clickedTag;
          } else {
            editBox.hidden = true;
          }
        }

        renderTags();
        renderFeed();
      });
    });
  }

  function renderFeed() {
    const grid = $('#poemGrid');
    const emptyState = $('#emptyState');
    if (!grid) return;

    let list = state.poems.filter(p => !p.trashedAt && p.status !== 'trash' && p.status !== 'deleted');
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

    list.sort((a, b) => {
      if (state.sortOrder === 'titleAsc') {
        return (a.title || '').localeCompare(b.title || '', 'tr');
      } else {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateB - dateA;
      }
    });

    const statsLine = $('#statsLine');
    if (statsLine) statsLine.textContent = `${list.length} şiir`;

    if (!list.length) {
      grid.innerHTML = '';
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    // SAĞA YASLI DÜZENLE VE PAYLAŞ BUTONLU KART YAPISI
    grid.innerHTML = list.map((p) => `
      <article class="poemCard" data-id="${p.id}">
        <div class="cardMainClick" onclick="window.openReader('${p.id}')">
          <h3>${p.favorite ? '★ ' : ''}${plain(p.title)}</h3>
          <p class="${p.fontFamily || 'font-tinos'}">${plain(p.content).slice(0, 140)}...</p>
        </div>
        <div class="cardFooterActions">
          <span style="font-size:0.75rem; opacity:0.6;">${getPoemDate(p)}</span>
          <div class="cardActionBtns">
            <button class="stdBtn cardActionBtn" onclick="window.sharePoem('${p.id}', event)">🔗 Paylaş</button>
            <button class="stdBtn cardActionBtn" onclick="window.editPoem('${p.id}', event)">✏️ Düzenle</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  function openReader(id) {
    const poem = state.poems.find(p => p.id === id);
    if (!poem) return;

    $('#readerTitle').textContent = poem.title;
    $('#readerMeta').textContent = formatDate(poem.updatedAt);
    const content = $('#readerContent');
    content.textContent = poem.content;
    content.className = `readerContent ${state.poemFont}`;

    document.body.classList.add('modal-open'); // Arka planı dondur
    $('#readerDialog')?.showModal();
  }

  function applyTheme(t) {
    const selected = ['light', 'purple', 'black'].includes(t) ? t : 'purple';
    document.documentElement.className = `theme-${selected}`;
    localStorage.setItem('munnesir-theme', selected);
  }

  function showEditor(poemId = null) {
    currentEditingId = poemId;
    const feed = $('#feedView');
    const editor = $('#editorView');

    if (feed) {
      feed.hidden = true;
      feed.style.display = 'none';
    }
    if (editor) {
      editor.hidden = false;
      editor.removeAttribute('hidden');
      editor.style.display = 'flex';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const fontMap = {
      'font-tinos': 'Tinos (Klasik Serif)',
      'font-cormorant': 'Cormorant Garamond (Şiirsel)',
      'font-playfair': 'Playfair Display (Zarif)',
      'font-cinzel': 'Cinzel (Epik)',
      'font-roboto': 'Roboto (Modern Sans)'
    };

    if (poemId) {
      const poem = state.poems.find(p => p.id === poemId);
      if (poem) {
        if ($('#editorTitleInput')) $('#editorTitleInput').value = poem.title || '';
        if ($('#editorContentInput')) $('#editorContentInput').value = poem.content || '';
        currentSelectedFont = poem.fontFamily || 'font-tinos';
        
        const fontLabel = $('#fontDropdownLabel');
        if (fontLabel) fontLabel.textContent = fontMap[currentSelectedFont] || 'Tinos (Klasik Serif)';
        applyEditorFont(currentSelectedFont);
        
        $$('#fontDropdownMenu .dropdownOption').forEach(opt => {
          opt.classList.toggle('active', opt.dataset.value === currentSelectedFont);
        });
        if ($('#editorStatusSelect')) $('#editorStatusSelect').value = poem.status || 'ready';
      }
    } else {
      if ($('#editorTitleInput')) $('#editorTitleInput').value = '';
      if ($('#editorContentInput')) $('#editorContentInput').value = '';
      currentSelectedFont = 'font-tinos';
      if ($('#fontDropdownLabel')) $('#fontDropdownLabel').textContent = 'Tinos (Klasik Serif)';
      applyEditorFont('font-tinos');
      if ($('#editorStatusSelect')) $('#editorStatusSelect').value = 'ready';
    }
    updateEditorStats();
  }

  function hideEditor() {
    const feed = $('#feedView');
    const editor = $('#editorView');
    if (editor) {
      editor.hidden = true;
      editor.setAttribute('hidden', '');
      editor.style.display = 'none';
    }
    if (feed) {
      feed.hidden = false;
      feed.removeAttribute('hidden');
      feed.style.display = 'block';
    }
    currentEditingId = null;
    refresh();
  }

  function initEvents() {

    $('#sidebarToggle')?.addEventListener('click', () => {
      $('#sidebar')?.classList.toggle('open');
    });

    $('#scrollTopBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#scrollBottomBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });


    // ARKA PLAN DONDURMA KÖPRÜLERİ
    const closeModal = (dialogId) => {
      $(dialogId)?.close();
      // Eğer ekranda başka açık modal kalmadıysa arka plan kilidini kaldır
      if (!document.querySelector('dialog[open]')) {
        document.body.classList.remove('modal-open');
      }
    };

    const openModal = (dialogId) => {
      document.body.classList.add('modal-open');
      $(dialogId)?.showModal();
    };

// TEKİL MODAL VE EDİTÖR KÖPRÜLERİ
    $('#newPoemFabBtn')?.addEventListener('click', () => showEditor(null));
    $('#closeEditorBtn')?.addEventListener('click', () => hideEditor());

    $('#settingsOpenBtn')?.addEventListener('click', () => $('#settingsDialog')?.showModal());
    $('#closeSettingsBtn')?.addEventListener('click', () => $('#settingsDialog')?.close());

    $('#openSyncAdvBtn')?.addEventListener('click', () => $('#syncAdvDialog')?.showModal());
    $('#closeSyncAdvBtn')?.addEventListener('click', () => $('#syncAdvDialog')?.close());

    $('#closeReaderBtn')?.addEventListener('click', () => $('#readerDialog')?.close());
    $('#closeBookBtn')?.addEventListener('click', () => $('#bookDialog')?.close());
    $('#closeTrashBtn')?.addEventListener('click', () => $('#trashDialog')?.close());


    // AUTOFILL (OTOMATİK DOLDURMA) ENGELLEMELİ ARAMA
    const searchEl = $('#searchInput');
    if (searchEl) {
      // Sayfa ilk açıldığında tarayıcı otomatik doldurduysa temizle
      if (searchEl.value.includes('http') || searchEl.value.includes('munnesir')) {
        searchEl.value = '';
        state.searchQuery = '';
      }

      searchEl.addEventListener('input', (e) => {
        // Eğer kullanıcı kendisi odaklanıp yazmadıysa (autofill sapmasıysa) temizle
        if (e.target.value.includes('http://') || e.target.value.includes('https://')) {
          e.target.value = '';
          state.searchQuery = '';
          renderFeed();
          return;
        }
        state.searchQuery = e.target.value.trim();
        renderFeed();
      });
    }

    // ARKA PLANA TIKLANINCA EDİTÖRÜN KAPANMASINI ENGELLEME
    const poemDlg = $('#poemDialog');
    poemDlg?.addEventListener('click', (e) => {
      const rect = poemDlg.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        e.preventDefault(); // Dışarı tıklansa bile kapanmaz
      }
    });


    // KİTAP ADAYLARI
    $('#bookViewBtn')?.addEventListener('click', () => {
      const localBooks = JSON.parse(localStorage.getItem('munnesir-books') || '[]');
      const bookPoemIds = new Set();
      localBooks.forEach(b => (b.poemIds || []).forEach(id => bookPoemIds.add(id)));

      const books = state.poems.filter(p => p.isBookCandidate || p.status === 'book' || bookPoemIds.has(p.id));
      const container = $('#bookListContainer');

      if (books.length) {
        container.innerHTML = books.map(b => `
          <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="display:block;">• ${plain(b.title)}</strong>
              <small style="opacity:0.6;">${formatDate(b.updatedAt)}</small>
            </div>
            <span style="font-size: 0.8rem; color: #a855f7; background: rgba(168, 85, 247, 0.1); padding: 4px 8px; border-radius: 6px;">Kitap Adayı</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>Henüz kitap adayı olarak işaretlenmiş bir çalışma bulunamadı.</p>';
      }
      $('#bookDialog')?.showModal();
    });


    // ÇÖP KUTUSU
    $('#trashViewBtn')?.addEventListener('click', async () => {
      const deletedSyncIds = new Set(JSON.parse(localStorage.getItem('munnesir-sync-deleted-ids') || '[]').map(x => x.id));
      const trashed = state.poems.filter(p => p.trashedAt || p.status === 'trash' || p.status === 'deleted' || deletedSyncIds.has(p.id));
      const container = $('#trashListContainer');

      if (trashed.length) {
        container.innerHTML = trashed.map(t => `
          <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="display:block;">${plain(t.title)}</strong>
              <small style="opacity:0.6;">${formatDate(t.updatedAt || t.trashedAt)}</small>
            </div>
            <span style="font-size: 0.8rem; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 6px;">Silindi</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>Çöp kutusu boş.</p>';
      }
      $('#trashDialog')?.showModal();
    });

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


    // GİRİŞ YAP VE SENKRONİZE ET (GERÇEK CLOUDFLARE D1 & TOKEN AKIŞI)
    $('#syncSignInBtn')?.addEventListener('click', async () => {
      const passInput = $('#syncPasswordInput');
      const statusEl = $('#syncStatusText');
      const password = passInput ? passInput.value.trim() : '';

      if (!password) {
        if (statusEl) statusEl.textContent = '⚠️ Lütfen şifrenizi girin.';
        return;
      }

      if (statusEl) statusEl.textContent = '⏳ Şifre doğrulanıyor...';

      try {
        // 1. Önce /api/auth/login ile Token al
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password })
        });

        const loginData = await loginRes.json();

        if (!loginRes.ok || !loginData.token) {
          if (statusEl) statusEl.textContent = `❌ ${loginData.error || 'Şifre hatalı!'}`;
          return;
        }

        // Token'ı yerelde sakla
        const token = loginData.token;
        localStorage.setItem('munnesir_token', token);
        if (window.Sync && typeof window.Sync.setAuth === 'function') {
          await window.Sync.setAuth(password);
        }

        if (statusEl) statusEl.textContent = '⏳ Snapshot çekiliyor...';

        // 2. Token ile Bearer yetkilendirmeli /api/snapshot İsteği At
        const snapshotRes = await fetch('/api/snapshot', {
          headers: { 'authorization': `Bearer ${token}` }
        });

        if (!snapshotRes.ok) {
          if (statusEl) statusEl.textContent = '❌ Snapshot alınamadı.';
          return;
        }

        const snapshotData = await snapshotRes.json();
        const payload = snapshotData.payload || snapshotData;
        const poems = payload.poems || [];

        if (poems.length > 0) {
          await window.saveMany(poems);
          await refresh();
          if (statusEl) statusEl.textContent = `✓ Senkronizasyon başarılı: ${poems.length} şiir yüklendi.`;
        } else {
          if (statusEl) statusEl.textContent = '⚠️ Buluttaki snapshot henüz boş.';
        }

      } catch (err) {
        console.error('Login/Sync Error:', err);
        if (statusEl) statusEl.textContent = '❌ Bağlantı hatası oluştu.';
      }
    });


    // ONAY POP-UP MEKANİZMASI
    let pendingAction = null;

    const showConfirm = (title, message, action) => {
      $('#confirmTitle').textContent = title;
      $('#confirmMessage').textContent = message;
      pendingAction = action;
      document.body.classList.add('modal-open');
      $('#confirmDialog')?.showModal();
    };

    $('#confirmNoBtn')?.addEventListener('click', () => {
      pendingAction = null;
      $('#confirmDialog')?.close();
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });

    $('#confirmYesBtn')?.addEventListener('click', async () => {
      $('#confirmDialog')?.close();
      if (pendingAction) {
        await pendingAction();
        pendingAction = null;
      }
    });

    // BU CİHAZI BULUTA GÖNDER (D1 SCHEMA VE OTURUM GARANTİLİ)
    $('#syncUploadBtn')?.addEventListener('click', () => {
      showConfirm(
        'Buluta Gönderilsin mi?',
        'Yereldeki tüm şiirleriniz bulut veritabanına aktarılacak ve buluttaki eski verilerin üzerine yazılacaktır. Emin misiniz?',
        async () => {
          const advStatus = $('#syncAdvStatusText');
          if (advStatus) advStatus.textContent = '⏳ Cihaz verileri buluta aktarılıyor...';
          
          try {
            let token = localStorage.getItem('munnesir_token') || '';
            const pass = $('#syncPasswordInput')?.value.trim() || localStorage.getItem('munnesir_sync_pass') || '';

            // Token yoksa şifreyle anında al
            if (!token && pass) {
              const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ password: pass })
              });

              if (loginRes.ok) {
                const loginData = await loginRes.json();
                if (loginData.token) {
                  token = loginData.token;
                  localStorage.setItem('munnesir_token', token);
                }
              }
            }

            if (!token) {
              if (advStatus) advStatus.textContent = '❌ Lütfen Munnesir şifrenizi girip Giriş Yapın.';
              return;
            }

            const allPoems = await getAllPoems();

            if (!allPoems || allPoems.length === 0) {
              if (advStatus) advStatus.textContent = '⚠️ Yüklenecek şiir bulunamadı. Yerel arşiv boş.';
              return;
            }

            // Cloudflare D1 Backend'inin Beklediği Eksiksiz Payload Yapısı
            const payload = {
              app: 'munnesir',
              version: '1.0.1',
              schema: 3,
              exportedAt: new Date().toISOString(),
              poems: allPoems,
              books: JSON.parse(localStorage.getItem('munnesir-books') || '[]'),
              deleted: JSON.parse(localStorage.getItem('munnesir-sync-deleted-ids') || '[]')
            };

            const res = await fetch('/api/snapshot', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || 'D1 veritabanı kayıt hatası');
            }

            const resData = await res.json();
            const activePoems = allPoems.filter(p => !p.trashedAt && p.status !== 'trash' && p.status !== 'deleted');

            if (advStatus) {
              advStatus.textContent = `✓ Başarılı! ${activePoems.length} şiir bulut veritabanına aktarıldı (Revizyon: ${resData.revision || 1}).`;
            }

          } catch (e) {
            console.error('Upload Error:', e);
            if (advStatus) advStatus.textContent = `❌ ${e.message || 'Aktarım başarısız. Şifrenizi kontrol edin.'}`;
          }
        }
      );
    });

    // BULUTU BU CİHAZA AL (TOKEN DESTEKLİ)
    $('#syncDownloadBtn')?.addEventListener('click', () => {
      showConfirm(
        'Buluttan İndirilsin mi?',
        'Buluttaki tüm şiirleriniz bu cihaza indirilecek ve yerel arşiviniz güncellenecektir. Emin misiniz?',
        async () => {
          const advStatus = $('#syncAdvStatusText');
          if (advStatus) advStatus.textContent = '⏳ Snapshot indiriliyor...';
          try {
            const token = localStorage.getItem('munnesir_token') || '';
            const res = await fetch('/api/snapshot', {
              headers: { 'authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error('Auth Error');
            const data = await res.json();
            const payload = data.payload || data;
            const poems = payload.poems || [];

            if (poems.length > 0) {
              await window.saveMany(poems);
              await refresh();
              if (advStatus) advStatus.textContent = `✓ Bulut verileri alındı: ${poems.length} şiir yüklendi.`;
            } else {
              if (advStatus) advStatus.textContent = '⚠️ Buluttaki snapshot boş.';
            }
          } catch (e) {
            if (advStatus) advStatus.textContent = '❌ İndirme başarısız. Lütfen önce Giriş Yapın.';
          }
        }
      );
    });

    // JSON DIŞA AKTAR (YEDEK AL)
    $('#exportJsonBtn')?.addEventListener('click', async () => {
      const all = await getAllPoems();
      const advStatus = $('#syncAdvStatusText');
      if (!all || all.length === 0) {
        if (advStatus) advStatus.textContent = '⚠️ İndirilecek şiir bulunamadı.';
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ poems: all }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `munnesir_arsiv_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      if (advStatus) advStatus.textContent = `✓ ${all.length} şiir JSON olarak indirildi.`;
    });

    // ANDROID & WEB UYUMLU GELİŞMİŞ JSON IMPORT PARSER
    const jsonInput = document.getElementById('jsonFileInput');
    
    $('#importJsonBtn')?.addEventListener('click', () => {
      if (jsonInput) {
        jsonInput.value = '';
        jsonInput.click();
      }
    });

    jsonInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const advStatus = document.getElementById('syncAdvStatusText');
      if (!file) return;

      if (advStatus) advStatus.textContent = '⏳ JSON okunuyor ve veritabanı hazırlanıyor...';

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          let rawPoems = [];

          // 1. FORMAT TESPİTİ (Munnesir v1.0, Keep Export, Dizi)
          if (parsed && Array.isArray(parsed.poems)) {
            rawPoems = parsed.poems;
          } else if (Array.isArray(parsed)) {
            rawPoems = parsed;
          } else if (typeof parsed === 'object') {
            rawPoems = [parsed];
          }

          if (!rawPoems.length) {
            if (advStatus) advStatus.textContent = '⚠️ Geçerli şiir verisi bulunamadı.';
            return;
          }

          // 2. VERİ RESTORASYONU VE ETİKET DÜZENLEME
          const formattedPoems = rawPoems.map((item, idx) => {
            let tags = Array.isArray(item.tags) ? item.tags.filter(t => t && t !== '(boş)') : [];
            
            const contentText = item.content || item.textContent || item.text || '';
            const titleText = item.title || item.userTitle || 'Başlıksız Şiir';

            // İçerikten dinamik #etiket çıkarma
            const bodyTags = contentText.match(/#([\wğüşıöçGÜŞİÖÇ-]+)/g);
            if (bodyTags) {
              bodyTags.forEach(bt => {
                const cleanTag = bt.replace('#', '').trim();
                if (cleanTag && !tags.includes(cleanTag)) tags.push(cleanTag);
              });
            }

            return {
              id: item.id || `poem_${Date.now()}_${idx}`,
              title: titleText,
              content: contentText,
              status: item.status || 'ready',
              favorite: Boolean(item.favorite),
              source: item.source || 'manual',
              tags: tags.length ? tags : ['(boş)'],
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString()
            };
          }).filter(p => p.content && p.content.trim() !== '');

          // 3. ANDROID WEBVIEW INDEXEDDB YAZMA KİLİDİ
          const currentDb = await openDB();
          if (!currentDb) {
            if (advStatus) advStatus.textContent = '❌ Veritabanı bağlantısı kurulamadı.';
            return;
          }

          const tx = currentDb.transaction('poems', 'readwrite');
          const store = tx.objectStore('poems');

          formattedPoems.forEach(p => store.put(p));

          tx.oncomplete = async () => {
            await refresh();
            const allInDb = await getAllPoems();
            
            if (advStatus) {
              advStatus.textContent = `✓ Başarılı! ${formattedPoems.length} şiir yüklendi (Toplam: ${allInDb.length}).`;
            }

            if (typeof renderTags === 'function') renderTags();
          };

          tx.onerror = (err) => {
            console.error('DB Write Error:', err);
            if (advStatus) advStatus.textContent = '❌ Veritabanına yazılırken hata oluştu.';
          };

        } catch (err) {
          console.error('JSON Parsing Error:', err);
          if (advStatus) advStatus.textContent = '❌ Dosya okunamadı. Geçersiz JSON formatı.';
        }
      };

      reader.readAsText(file, 'UTF-8');
    });

    // ETİKET İSMİNİ TÜM ŞİİRLERDE TOPLU GÜNCELLEME VE SENKRONİZE ETME
    $('#saveTagRenameBtn')?.addEventListener('click', async () => {
      const oldTag = state.selectedTag;
      const newTag = $('#editTagInput')?.value.trim();

      if (!oldTag || !newTag || oldTag === newTag) return;

      const advStatus = $('#syncAdvStatusText');
      let updatedCount = 0;

      // Etikete sahip tüm şiirleri güncelle
      for (const poem of state.poems) {
        if (Array.isArray(poem.tags) && poem.tags.includes(oldTag)) {
          poem.tags = poem.tags.map(t => t === oldTag ? newTag : t);
          // Metin içindeki #eskiEtiket varsa onu da değiştir
          if (poem.content) {
            poem.content = poem.content.replaceAll(`#${oldTag}`, `#${newTag}`);
          }
          poem.updatedAt = new Date().toISOString();
          await savePoemToDB(poem);
          updatedCount++;
        }
      }
      state.selectedTag = newTag;
      await refresh();
      if (advStatus) {
        advStatus.textContent = `✓ '${oldTag}' etiketi '${newTag}' olarak değiştirildi (${updatedCount} şiir güncellendi).`;
      }
    });


    // SIRALAMA SEKME DİNLEYİCİLERİ
    const sortTabButtons = $$('#sortTabsContainer .sortTabBtn');
    sortTabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortTabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        state.sortOrder = btn.dataset.value;
        renderFeed();
      });
    });

  // FONT DROPDOWN (ÖZEL SEÇİCİ) DİNLEYİCİSİ
    const fontCustomDropdown = $('#fontCustomDropdown');
    const fontDropdownBtn = $('#fontDropdownBtn');
    const fontDropdownLabel = $('#fontDropdownLabel');
    const fontDropdownOptions = $$('#fontDropdownMenu .dropdownOption');

    fontDropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fontCustomDropdown?.classList.toggle('open');
    });

    fontDropdownOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        fontDropdownOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');

        const val = opt.dataset.value;
        if (fontDropdownLabel) fontDropdownLabel.textContent = opt.textContent;
        currentSelectedFont = val;

        applyEditorFont(val);
        fontCustomDropdown?.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      fontCustomDropdown?.classList.remove('open');
    });

  $('#editorContentInput')?.addEventListener('input', () => updateEditorStats());

  // TAM EKRAN EDİTÖR KAYDET BUTONU
  $('#editorSaveBtn')?.addEventListener('click', async () => {
    const title = $('#editorTitleInput')?.value.trim() || 'Başlıksız Şiir';
    const content = $('#editorContentInput')?.value.trim() || '';
    if (!content) return;

    const selectedFont = currentSelectedFont || 'font-tinos';
    const selectedStatus = $('#editorStatusSelect')?.value || 'ready';
    const extractedTags = (content.match(/#[\wığüşöçİĞÜŞÖÇ]+/g) || []).map(t => t.replace('#', ''));

    const poemData = {
      id: currentEditingId || `poem-${Date.now()}`,
      title,
      content,
      tags: extractedTags,
      fontFamily: selectedFont,
      status: selectedStatus,
      updatedAt: new Date().toISOString(),
      createdAt: currentEditingId ? (state.poems.find(p => p.id === currentEditingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      favorite: currentEditingId ? (state.poems.find(p => p.id === currentEditingId)?.favorite || false) : false
    };

    await savePoemToDB(poemData);
    hideEditor();
  });

  $('#editorAddTagBtn')?.addEventListener('click', () => {
    const input = $('#editorContentInput');
    if (input) {
      input.value += ' #yeniEtiket';
      input.focus();
      updateEditorStats();
    }
  });

  $('#editorShareBtn')?.addEventListener('click', () => {
    const title = $('#editorTitleInput').value.trim();
    const content = $('#editorContentInput').value.trim();
    if (!content) return;
    const shareText = `${title}\n\n${content}\n\n— Munnesir`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Şiir metni kopyalandı!');
      });
    }
  });
  // YAZI EDİTÖRÜ DİNLEYİCİLERİ SONU

  }//****** initEvents sonu ******



  // SYNC VE VERİ TABANI KÖPRÜSÜ (1276 ŞİİRİ EKRANA DÖKER)
  window.getAllPoems = getAllPoems;
  window.savePoem = savePoemToDB;
  window.refresh = refresh;
  window.refreshAll = refresh;

  // Sync.js veriyi indirince veritabanına toplu yazar ve ekranı günceller
  window.saveMany = async function(poems) {
    if (!poems || !Array.isArray(poems)) return;
    await openDB();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction('poems', 'readwrite');
      const store = tx.objectStore('poems');
      poems.forEach(p => {
        if (p && p.id) store.put(p);
      });
      tx.oncomplete = async () => {
        await refresh();
        resolve();
      };
    });
  };

  // SYNC SNAPSHOT PAYLOAD ÇÖZÜCÜ (STRING/JSON GARANTİLİ PARSER)
  window.importJsonPayloads = async function(payloads) {
    if (!payloads || !payloads.length) return;
    let allPoems = [];

    for (const item of payloads) {
      let raw = item.raw || item.payload || item.data || item;
      
      // Eğer Cloudflare KV'den gelen 'raw' verisi bir JSON String ise çöz
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch (e) {
          console.error('Snapshot Parse Error:', e);
        }
      }

      let poems = [];
      if (raw && Array.isArray(raw.poems)) {
        poems = raw.poems;
      } else if (Array.isArray(raw)) {
        poems = raw;
      } else if (raw && typeof raw === 'object' && raw.content) {
        poems = [raw];
      }

      if (poems.length) allPoems.push(...poems);
    }

    if (allPoems.length) {
      await window.saveMany(allPoems);
      await refresh();
    } else {
      await refresh();
    }
  };

  function applyEditorFont(fontClass) {
    const title = $('#editorTitleInput');
    const content = $('#editorContentInput');
    if (title && content) {
      title.className = `editorTitleInput ${fontClass}`;
      content.className = `editorContentArea ${fontClass}`;
    }
  }

  function updateEditorStats() {
    const content = $('#editorContentInput')?.value || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    const statsEl = $('#editorStats');
    if (statsEl) statsEl.textContent = `${words} kelime | ${chars} karakter`;
  }

  // GLOBAL DÜZENLEME VE PAYLAŞMA KÖPRÜLERİ
  window.openReader = function(id) {
    const poem = state.poems.find(p => p.id === id);
    if (!poem) return;
    $('#readerTitle').textContent = poem.title;
    $('#readerMeta').textContent = formatDate(poem.updatedAt);
    const content = $('#readerContent');
    content.textContent = poem.content;
    content.className = `readerContent ${poem.fontFamily || 'font-tinos'}`;
    document.body.classList.add('modal-open');
    $('#readerDialog')?.showModal();
  };

  window.editPoem = function(id, e) {
    if (e) e.stopPropagation();
    showEditor(id);
  };

  window.sharePoem = function(id, e) {
    if (e) e.stopPropagation();
    const poem = state.poems.find(p => p.id === id);
    if (!poem) return;

    const shareText = `${poem.title}\n\n${poem.content}\n\n— Munnesir`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Şiir metni panoya kopyalandı!');
      });
    }
  };

// SAYFA İLK AÇILDIĞINDA EDİTÖRÜ GİZLİ TUT, AKIŞI GÖSTER
  document.addEventListener('DOMContentLoaded', async () => {
    await openDB();
    initEvents();
    
    const editor = $('#editorView');
    const feed = $('#feedView');
    if (editor) {
      editor.hidden = true;
      editor.style.display = 'none';
    }
    if (feed) feed.style.display = 'block';

    await refresh();
  });

})();