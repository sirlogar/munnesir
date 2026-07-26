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
    
    const tagSet = new Set();
    state.poems.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          if (t && t !== '(boş)') tagSet.add(t.trim());
        });
      }
    });

    const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'tr'));
    
    let html = `<button class="tagChip ${!state.selectedTag ? 'active' : ''}" data-tag="">#(tümü)</button>`;
    sortedTags.forEach(tag => {
      const active = state.selectedTag === tag ? 'active' : '';
      html += `<button class="tagChip ${active}" data-tag="${tag}">#${tag}</button>`;
    });

    container.innerHTML = html;
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

    // SIRALAMA ALGORİTMASI (Ezilmemiş Oluşturulma Tarihine Göre)
    list.sort((a, b) => {
      if (state.sortOrder === 'titleAsc') {
        return (a.title || '').localeCompare(b.title || '', 'tr');
      } else {
        // En yeni oluşturulan en üstte
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

    grid.innerHTML = list.map((p) => `
      <article class="poemCard" data-id="${p.id}">
        <h3>${p.favorite ? '★ ' : ''}${plain(p.title)}</h3>
        <p class="${state.poemFont}">${plain(p.content).slice(0, 150)}...</p>
        <span style="font-size:0.8rem; opacity:0.6;">${getPoemDate(p)}</span>
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

    document.body.classList.add('modal-open'); // Arka planı dondur
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

    $('#newPoemFabBtn')?.addEventListener('click', () => openEditor());
    $('#closePoemBtn')?.addEventListener('click', () => $('#poemDialog')?.close());

    $('#scrollTopBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#scrollBottomBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });

    $('#sortSelect')?.addEventListener('change', (e) => {
      state.sortOrder = e.target.value;
      renderFeed();
    });

    // DETAYLI SENKRONİZASYON POP-UP DİNLEYİCİLERİ
    $('#openSyncAdvBtn')?.addEventListener('click', () => {
      $('#syncAdvDialog')?.showModal();
    });

    $('#closeSyncAdvBtn')?.addEventListener('click', () => {
      $('#syncAdvDialog')?.close();
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

    // Kapatma Butonları
    $('#closePoemBtn')?.addEventListener('click', () => closeModal('#poemDialog'));
    $('#closeReaderBtn')?.addEventListener('click', () => closeModal('#readerDialog'));
    $('#closeBookBtn')?.addEventListener('click', () => closeModal('#bookDialog'));
    $('#closeTrashBtn')?.addEventListener('click', () => closeModal('#trashDialog'));
    $('#closeSettingsBtn')?.addEventListener('click', () => closeModal('#settingsDialog'));
    $('#closeSyncAdvBtn')?.addEventListener('click', () => closeModal('#syncAdvDialog'));

    // Açma Butonları
    $('#newPoemFabBtn')?.addEventListener('click', () => { openEditor(); document.body.classList.add('modal-open'); });
    $('#bookViewBtn')?.addEventListener('click', () => openModal('#bookDialog'));
    $('#trashViewBtn')?.addEventListener('click', () => openModal('#trashDialog'));
    $('#settingsOpenBtn')?.addEventListener('click', () => openModal('#settingsDialog'));
    $('#openSyncAdvBtn')?.addEventListener('click', () => openModal('#syncAdvDialog'));


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


    // GİRİŞ YAP VE SENKRONİZE ET (GÜVENLİ VE GERÇEK SAYI OKUYAN DÜZELTME)
    $('#syncSignInBtn')?.addEventListener('click', async () => {
      const passInput = $('#syncPasswordInput');
      const statusEl = $('#syncStatusText');
      const password = passInput ? passInput.value.trim() : '';

      if (!password) {
        if (statusEl) statusEl.textContent = '⚠️ Lütfen şifrenizi girin.';
        return;
      }

      if (statusEl) statusEl.textContent = '⏳ Senkronize ediliyor...';

      try {
        // Şifreyi kaydet
        if (window.Sync && typeof window.Sync.setAuth === 'function') {
          await window.Sync.setAuth(password);
        } else if (localStorage) {
          localStorage.setItem('munnesir_sync_pass', password);
        }

        // Senkronizasyonu çalıştır
        if (window.Sync && typeof window.Sync.runSync === 'function') {
          await window.Sync.runSync();
        }

        // Veritabanını tazeleyip gerçek şiir sayısını oku
        await refresh();
        const all = await getAllPoems();
        const count = all ? all.length : 0;

        if (statusEl) {
          statusEl.textContent = `✓ Senkronizasyon tamam: ${count} şiir senkronize edildi.`;
        }
      } catch (err) {
        console.error(err);
        if (statusEl) statusEl.textContent = '❌ Senkronizasyon sırasında hata oluştu.';
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

    // BU CİHAZI BULUTA GÖNDER (ONAYLI)
    $('#syncUploadBtn')?.addEventListener('click', () => {
      showConfirm(
        'Buluta Gönderilsin mi?',
        'Yereldeki tüm şiirleriniz bulut veritabanına aktarılacak ve buluttaki eski verilerin üzerine yazılacaktır. Emin misiniz?',
        async () => {
          const advStatus = $('#syncAdvStatusText');
          if (advStatus) advStatus.textContent = '⏳ Cihaz verileri buluta aktarılıyor...';
          try {
            if (window.Sync && typeof window.Sync.pushLocalToCloud === 'function') {
              await window.Sync.pushLocalToCloud();
            }
            if (advStatus) advStatus.textContent = '✓ Cihaz verileri başarıyla buluta gönderildi.';
          } catch (e) {
            if (advStatus) advStatus.textContent = '❌ Buluta aktarım sırasında hata oluştu.';
          }
        }
      );
    });

    // BULUTU BU CİHAZA AL (ONAYLI & 0 ŞİİR FİXİ)
    $('#syncDownloadBtn')?.addEventListener('click', () => {
      showConfirm(
        'Buluttan İndirilsin mi?',
        'Buluttaki tüm şiirleriniz bu cihaza indirilecek ve yerel arşiviniz güncellenecektir. Emin misiniz?',
        async () => {
          const advStatus = $('#syncAdvStatusText');
          if (advStatus) advStatus.textContent = '⏳ Buluttaki veriler indiriliyor...';
          try {
            const pass = $('#syncPasswordInput')?.value.trim() || localStorage.getItem('munnesir_sync_pass') || '';
            
            // Doğrudan API Fetch İsteği
            const res = await fetch('/api/sync', {
              headers: { 'X-Munnesir-Auth': pass }
            });
            
            if (!res.ok) throw new Error('Auth error');
            const data = await res.json();

            if (data && data.poems && Array.isArray(data.poems)) {
              await window.saveMany(data.poems);
              await refresh();
              if (advStatus) advStatus.textContent = `✓ Bulut verileri alındı: ${data.poems.length} şiir yüklendi.`;
            } else {
              if (advStatus) advStatus.textContent = '⚠️ Bulutta henüz kaydedilmiş şiir bulunamadı.';
            }
          } catch (e) {
            console.error(e);
            if (advStatus) advStatus.textContent = '❌ Buluttan indirme başarısız. Şifrenizi kontrol edin.';
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

    // JSON İÇE AKTAR (KEEP / ARŞİV YÜKLE)
    const jsonInput = document.getElementById('jsonFileInput');
    
    $('#importJsonBtn')?.addEventListener('click', () => {
      if (jsonInput) {
        jsonInput.value = ''; // Aynı dosya tekrar seçilebilsin diye temizle
        jsonInput.click();
      }
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
            rawPoems = parsed.poems; // Tam senin paylaştığın Munnesir yapısı
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
            // Etiket Temizliği: "(boş)" olanları ele, metin içindeki #etiket'leri de tara
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
          await openDB();
          if (!db) {
            if (advStatus) advStatus.textContent = '❌ Veritabanı bağlantısı kurulamadı.';
            return;
          }

          const tx = db.transaction('poems', 'readwrite');
          const store = tx.objectStore('poems');

          formattedPoems.forEach(p => store.put(p));

          tx.oncomplete = async () => {
            // Bellek Durumunu Güncelle ve Ekranı Yenile
            await refresh();
            const allInDb = await getAllPoems();
            
            if (advStatus) {
              advStatus.textContent = `✓ Başarılı! ${formattedPoems.length} şiir yüklendi (Toplam: ${allInDb.length}).`;
            }

            // Etiket Bulutunu Tekrar Çiz
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



  }//****** initEvents sonu ******

  document.addEventListener('DOMContentLoaded', async () => {
    initEvents();
    await openDB();
    await refresh();
  });


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

  // Sync snapshot indirdiğinde tetiklenen ana fonksiyon
  window.importJsonPayloads = async function(payloads) {
    if (!payloads || !payloads.length) return;
    let allPoems = [];
    for (const item of payloads) {
      const raw = item.raw || item;
      const poems = raw.poems || (Array.isArray(raw) ? raw : []);
      if (poems.length) allPoems.push(...poems);
    }
    if (allPoems.length) {
      await window.saveMany(allPoems);
    } else {
      await refresh();
    }
  };

  // Sayfa yüklendiğinde ve sync tamamlandığında otomatik tetikleme
  window.addEventListener('load', () => {
    setTimeout(async () => {
      await refresh();
    }, 1000);
  });

})();


// SENKRONİZASYON OTO-TETİKLEYİCİSİ
  window.addEventListener('DOMContentLoaded', async () => {
    await openDB();
    await refresh();
    if (window.Sync && typeof window.Sync.init === 'function') {
      window.Sync.init();
    }
  });