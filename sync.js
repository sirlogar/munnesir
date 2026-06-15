// Munnesir 1.0.1 - Cloudflare D1 tek şifreli anlık senkron
// Otomatik senkron sessizdir; bildirim yalnızca elle senkron işlemlerinde gösterilir.
// Web ve APK aynı API'ye bağlanır. Eski JSON yedekleri yerel import ile çalışmaya devam eder.
(function () {
  const CONFIG_KEY = 'munnesir-cloudflare-sync-config';
  const BOOKS_KEY = 'munnesir-books';
  const DELETED_KEY = 'munnesir-sync-deleted-ids';
  const DEFAULT_API_BASE = 'https://munnesir.com';
  const POLL_MS = 4500;
  const PUSH_DEBOUNCE_MS = 1200;

  let pushTimer = null;
  let pollTimer = null;
  let isSyncing = false;
  let lastLocalHash = '';
  let initialHashReady = false;

  const qs = (s) => document.querySelector(s);

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value || ''); } catch (_) { return fallback; }
  }

  function normalizeBase(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
      return DEFAULT_API_BASE;
    }
    return raw.replace(/\/+$/, '');
  }

  function loadConfig() {
    const cfg = safeJsonParse(localStorage.getItem(CONFIG_KEY), {}) || {};
    return {
      apiBase: normalizeBase(cfg.apiBase || ''),
      token: cfg.token || '',
      auto: cfg.auto !== false,
      revision: Number(cfg.revision || 0),
      lastSyncAt: cfg.lastSyncAt || '',
    };
  }

  function saveConfig(next) {
    const old = loadConfig();
    const merged = { ...old, ...next };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    return merged;
  }

  function readBooks() {
    return safeJsonParse(localStorage.getItem(BOOKS_KEY), []) || [];
  }

  function writeBooks(books) {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(Array.isArray(books) ? books : []));
  }

  function readDeleted() {
    const arr = safeJsonParse(localStorage.getItem(DELETED_KEY), []) || [];
    return Array.isArray(arr) ? arr : [];
  }

  function writeDeleted(items) {
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  }

  function addTombstones(ids) {
    const stamp = new Date().toISOString();
    const map = new Map(readDeleted().map((item) => [item.id, item]));
    (ids || []).filter(Boolean).forEach((id) => map.set(id, { id, deletedAt: stamp }));
    writeDeleted([...map.values()].slice(-5000));
  }

  function stamp() { return new Date().toISOString(); }

  function showToast(text) {
    if (typeof window.toast === 'function') window.toast(text);
    else console.log(text);
  }

  function setStatus(text, tone) {
    const el = qs('#syncStatusText');
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || 'idle';
  }

  async function api(path, options = {}) {
    const cfg = loadConfig();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const res = await fetch(`${cfg.apiBase}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const text = await res.text();
    const data = text ? safeJsonParse(text, { raw: text }) : {};
    if (!res.ok) {
      const msg = data && data.error ? data.error : `Bulut hatası: ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function normalizePoem(p) {
    if (!p || typeof p !== 'object') return null;
    const content = String(p.content || p.text || p.textContent || '').replace(/\r\n/g, '\n').trim();
    const title = String(p.title || '').trim() || content.split('\n').find(Boolean) || 'Başlıksız şiir';
    if (!content) return null;
    return {
      ...p,
      id: p.id || (crypto.randomUUID ? crypto.randomUUID() : `poem-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      title,
      content,
      tags: Array.isArray(p.tags) ? p.tags : (Array.isArray(p.labels) ? p.labels : []),
      status: p.status || 'archive',
      favorite: Boolean(p.favorite),
      source: p.source || 'sync',
      createdAt: p.createdAt || p.created_at || stamp(),
      updatedAt: p.updatedAt || p.updated_at || p.createdAt || stamp(),
      ...(p.trashedAt || p.trashed_at ? { trashedAt: p.trashedAt || p.trashed_at } : {}),
    };
  }

  function normalizeBook(book) {
    if (!book || typeof book !== 'object') return null;
    const title = String(book.title || book.name || 'Kitap Adayı').trim() || 'Kitap Adayı';
    return {
      ...book,
      id: book.id || (crypto.randomUUID ? crypto.randomUUID() : `book-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      title,
      poemIds: [...new Set(Array.isArray(book.poemIds) ? book.poemIds.filter(Boolean) : [])],
      createdAt: book.createdAt || book.created_at || stamp(),
      updatedAt: book.updatedAt || book.updated_at || stamp(),
    };
  }

  function asPayload(raw) {
    if (!raw) return { poems: [], books: [], deleted: [] };
    if (Array.isArray(raw)) return { poems: raw.map(normalizePoem).filter(Boolean), books: [], deleted: [] };
    const poems = Array.isArray(raw.poems) ? raw.poems.map(normalizePoem).filter(Boolean) : [];
    const books = Array.isArray(raw.books) ? raw.books.map(normalizeBook).filter(Boolean) : [];
    const deleted = Array.isArray(raw.deleted) ? raw.deleted.filter((x) => x && x.id) : [];
    return { ...raw, poems, books, deleted };
  }

  function timeOf(item) {
    const t = new Date(item && (item.updatedAt || item.updated_at || item.deletedAt || item.deleted_at || item.createdAt || item.created_at || 0)).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function mergeById(localItems, cloudItems, normalizer) {
    const map = new Map();
    [...(cloudItems || []), ...(localItems || [])].forEach((item) => {
      const normalized = normalizer(item);
      if (!normalized || !normalized.id) return;
      const old = map.get(normalized.id);
      if (!old || timeOf(normalized) >= timeOf(old)) map.set(normalized.id, normalized);
    });
    return [...map.values()];
  }

  function mergeDeleted(localDeleted, cloudDeleted) {
    const map = new Map();
    [...(cloudDeleted || []), ...(localDeleted || [])].forEach((item) => {
      if (!item || !item.id) return;
      const old = map.get(item.id);
      if (!old || timeOf(item) >= timeOf(old)) map.set(item.id, { id: item.id, deletedAt: item.deletedAt || item.deleted_at || stamp() });
    });
    return [...map.values()].slice(-5000);
  }

  function enforceSingleBookPerPoem(books) {
    const normalized = (books || []).map(normalizeBook).filter(Boolean).sort((a, b) => timeOf(b) - timeOf(a));
    const used = new Set();
    const result = normalized.map((book) => {
      const poemIds = [];
      (book.poemIds || []).forEach((id) => {
        if (!used.has(id)) {
          used.add(id);
          poemIds.push(id);
        }
      });
      return { ...book, poemIds };
    });
    return result.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  }

  async function localSnapshot() {
    const poems = typeof window.getAllPoems === 'function' ? await window.getAllPoems() : [];
    return {
      app: 'munnesir',
      version: '1.0.1',
      schema: 3,
      exportedAt: stamp(),
      poems: poems.map(normalizePoem).filter(Boolean),
      books: readBooks().map(normalizeBook).filter(Boolean),
      deleted: readDeleted(),
    };
  }

  function mergeSnapshots(localRaw, cloudRaw) {
    const local = asPayload(localRaw);
    const cloud = asPayload(cloudRaw);
    const deleted = mergeDeleted(local.deleted, cloud.deleted);
    const deletedMap = new Map(deleted.map((x) => [x.id, timeOf(x)]));
    let poems = mergeById(local.poems, cloud.poems, normalizePoem).filter((poem) => {
      const deletedTime = deletedMap.get(poem.id);
      return !deletedTime || timeOf(poem) > deletedTime;
    });
    const activeIds = new Set(poems.map((p) => p.id));
    const books = enforceSingleBookPerPoem(mergeById(local.books, cloud.books, normalizeBook).map((book) => ({
      ...book,
      poemIds: (book.poemIds || []).filter((id) => activeIds.has(id)),
    })));
    return {
      app: 'munnesir',
      version: '1.0.1',
      schema: 3,
      exportedAt: stamp(),
      poems,
      books,
      deleted,
      poemCount: poems.length,
    };
  }

  async function applySnapshot(payload, options = {}) {
    const normalized = asPayload(payload);
    writeBooks(normalized.books);
    writeDeleted(normalized.deleted);
    if (typeof window.importJsonPayloads === 'function') {
      await window.importJsonPayloads([{ name: 'munnesir-bulut.json', raw: normalized }], 'buluttan', { silent: Boolean(options.silent) });
      const deletedIds = new Set(normalized.deleted.map((item) => item.id));
      if (deletedIds.size && typeof window.deleteMany === 'function') await window.deleteMany([...deletedIds]);
    } else if (typeof window.saveMany === 'function') {
      await window.saveMany(normalized.poems);
      if (typeof window.refresh === 'function') await window.refresh();
    }
  }

  async function fetchCloudSnapshot() {
    const data = await api('/api/snapshot');
    return data || { revision: 0, payload: null };
  }

  async function uploadSnapshot(payload) {
    const cfg = loadConfig();
    const data = await api('/api/snapshot', {
      method: 'PUT',
      body: { payload, clientRevision: cfg.revision || 0 },
    });
    saveConfig({ revision: data.revision || 0, lastSyncAt: stamp() });
    return data;
  }

  async function syncMerge(silent = false) {
    if (isSyncing) return;
    isSyncing = true;
    try {
      if (!silent) setStatus('Senkron başlıyor...', 'working');
      const local = await localSnapshot();
      const remote = await fetchCloudSnapshot();
      const merged = mergeSnapshots(local, remote.payload);
      await applySnapshot(merged, { silent });
      const result = await uploadSnapshot(merged);
      lastLocalHash = await localHash();
      initialHashReady = true;
      setStatus(`Senkron tamam: ${merged.poems.length} şiir.`, 'ok');
      if (!silent) showToast('Bulut senkronu tamamlandı.');
      return result;
    } finally {
      isSyncing = false;
    }
  }

  async function uploadLocalOnly() {
    setStatus('Yerel arşiv buluta gönderiliyor...', 'working');
    const payload = await localSnapshot();
    const result = await uploadSnapshot(payload);
    lastLocalHash = await localHash();
    initialHashReady = true;
    setStatus('Yerel arşiv buluta gönderildi.', 'ok');
    showToast('Yerel arşiv buluta gönderildi.');
    return result;
  }

  async function downloadCloudOnly() {
    setStatus('Bulut arşivi indiriliyor...', 'working');
    const row = await fetchCloudSnapshot();
    if (!row || !row.payload) throw new Error('Bulutta henüz Munnesir yedeği yok.');
    await applySnapshot(row.payload, { silent: false });
    saveConfig({ revision: row.revision || 0, lastSyncAt: stamp() });
    lastLocalHash = await localHash();
    initialHashReady = true;
    setStatus('Bulut arşivi bu cihaza alındı.', 'ok');
    showToast('Bulut arşivi bu cihaza alındı.');
  }

  async function runSafely(fn, silent = false) {
    try { return await fn(); }
    catch (err) {
      console.error(err);
      const message = err.message || 'Senkron hatası.';
      setStatus(message, 'error');
      if (!silent) showToast(message);
    }
  }

  async function localHash() {
    const snap = await localSnapshot();
    return JSON.stringify({ poems: snap.poems, books: snap.books, deleted: snap.deleted });
  }

  function scheduleSync() {
    const cfg = loadConfig();
    if (!cfg.auto || !cfg.token || !navigator.onLine) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => runSafely(() => syncMerge(true), true), PUSH_DEBOUNCE_MS);
  }

  function patchLocalMutations() {
    const names = ['savePoem', 'saveMany', 'deletePoem', 'deleteMany', 'moveManyToTrash', 'restoreMany', 'importJsonPayloads'];
    names.forEach((name) => {
      if (typeof window[name] !== 'function' || window[name].__munnesirPatched) return;
      const original = window[name];
      const wrapped = async function (...args) {
        if (name === 'deletePoem') addTombstones([args[0]]);
        if (name === 'deleteMany') addTombstones(args[0] || []);
        const result = await original.apply(this, args);
        scheduleSync();
        return result;
      };
      wrapped.__munnesirPatched = true;
      window[name] = wrapped;
    });
    if (typeof window.saveBooks === 'function' && !window.saveBooks.__munnesirPatched) {
      const original = window.saveBooks;
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        scheduleSync();
        return result;
      };
      wrapped.__munnesirPatched = true;
      window.saveBooks = wrapped;
    }
  }

  async function watchLocalChanges() {
    const cfg = loadConfig();
    if (!cfg.auto || !cfg.token || !navigator.onLine || isSyncing) return;
    const hash = await localHash().catch(() => '');
    if (!hash) return;
    if (!initialHashReady) {
      lastLocalHash = hash;
      initialHashReady = true;
      return;
    }
    if (hash !== lastLocalHash) {
      lastLocalHash = hash;
      scheduleSync();
    }
  }

  async function checkRemote() {
    const cfg = loadConfig();
    if (!cfg.auto || !cfg.token || !navigator.onLine || isSyncing) return;
    const meta = await api('/api/snapshot/meta').catch(() => null);
    if (!meta) return;
    if ((meta.revision || 0) > (cfg.revision || 0)) await syncMerge(true);
  }

  function startRealtimeLoop() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      runSafely(watchLocalChanges, true);
      runSafely(checkRemote, true);
    }, POLL_MS);
    setTimeout(() => runSafely(() => syncMerge(true), true), 1600);
  }

  function injectUi() {
    const sidebar = qs('#sidebar');
    if (!sidebar || qs('#syncOpenBtn')) return;
    const panel = document.createElement('section');
    panel.className = 'panel syncPanel';
    panel.innerHTML = `
      <h2>Bulut senkronu</h2>
      <p id="syncStatusText" class="syncStatus" data-tone="idle">Şifreli bulut bekleniyor.</p>
      <div class="syncPanelActions">
        <button id="syncOpenBtn" class="ghostBtn full" type="button">Bulut girişi</button>
        <button id="syncNowBtn" class="primaryBtn modernBtn full" type="button">Senkronize et</button>
      </div>
    `;
    const importPanel = qs('.importPanel');
    if (importPanel && importPanel.parentNode) importPanel.parentNode.insertBefore(panel, importPanel.nextSibling);
    else sidebar.appendChild(panel);

    const cfg = loadConfig();
    const dialog = document.createElement('dialog');
    dialog.id = 'syncDialog';
    dialog.className = 'themeDialog syncDialog';
    dialog.innerHTML = `
      <form method="dialog" class="themeForm syncForm">
        <div class="dialogHeader">
          <h2>Bulut senkronu</h2>
          <button class="iconBtn" type="button" id="closeSyncBtn" aria-label="Kapat">×</button>
        </div>
        <label class="inputLabel" for="syncBaseInput">Site adresi</label>
        <input id="syncBaseInput" class="textInput" type="url" value="${escapeAttr(cfg.apiBase || '')}" placeholder="https://munnesir.com" />
        <label class="inputLabel" for="syncPasswordInput">Munnesir şifresi</label>
        <input id="syncPasswordInput" class="textInput" type="password" autocomplete="current-password" placeholder="Şifre" />
        <label class="checkLabel syncCheck"><input id="syncAutoInput" type="checkbox" ${cfg.auto ? 'checked' : ''} /> İnternet gelince ve değişiklik olduğunda otomatik senkronize et</label>
        <div class="syncDialogActions">
          <button id="syncSignInBtn" class="primaryBtn modernBtn" type="button">Giriş yap</button>
          <button id="syncSignOutBtn" class="dangerBtn compactDanger" type="button">Çıkış</button>
        </div>
        <div class="syncDialogActions">
          <button id="syncMergeBtn" class="primaryBtn modernBtn" type="button">Tam senkron</button>
          <button id="syncUploadBtn" class="ghostBtn modernBtn" type="button">Bu cihazı buluta gönder</button>
          <button id="syncDownloadBtn" class="ghostBtn modernBtn" type="button">Bulutu bu cihaza al</button>
        </div>
        <p class="syncHint">E-posta yok. Kod yok. Tek şifreyle giriş yapılır; oturum bu cihazda saklanır. Eski JSON yedekleri yine Arşiv yedeği yükle ile içe alınır.</p>
      </form>
    `;
    document.body.appendChild(dialog);
  }

  function escapeAttr(value) {
    return String(value || '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
  }

  function bindUi() {
    qs('#syncOpenBtn')?.addEventListener('click', () => qs('#syncDialog')?.showModal());
    qs('#closeSyncBtn')?.addEventListener('click', () => qs('#syncDialog')?.close());
    qs('#syncNowBtn')?.addEventListener('click', () => runSafely(() => syncMerge(false)));
    qs('#syncMergeBtn')?.addEventListener('click', () => runSafely(() => syncMerge(false)));
    qs('#syncUploadBtn')?.addEventListener('click', () => {
      if (!confirm('Bu cihazdaki arşiv buluttaki kopyanın üzerine yazılsın mı?')) return;
      runSafely(uploadLocalOnly);
    });
    qs('#syncDownloadBtn')?.addEventListener('click', () => {
      if (!confirm('Buluttaki arşiv bu cihaza alınsın mı? Yerel şiirlerle birleştirilir.')) return;
      runSafely(downloadCloudOnly);
    });
    qs('#syncSignInBtn')?.addEventListener('click', () => runSafely(async () => {
      const apiBase = normalizeBase(qs('#syncBaseInput')?.value || '');
      const auto = Boolean(qs('#syncAutoInput')?.checked);
      const password = qs('#syncPasswordInput')?.value || '';
      saveConfig({ apiBase, auto });
      const data = await api('/api/auth/login', { method: 'POST', body: { password } });
      saveConfig({ token: data.token || '', revision: Number(data.revision || 0), lastSyncAt: stamp() });
      qs('#syncPasswordInput').value = '';
      setStatus('Giriş yapıldı. Anlık senkron açık.', 'ok');
      showToast('Bulut girişi tamam.');
      startRealtimeLoop();
      await syncMerge(true);
    }));
    qs('#syncSignOutBtn')?.addEventListener('click', () => {
      saveConfig({ token: '', revision: 0 });
      setStatus('Çıkış yapıldı.', 'idle');
      showToast('Buluttan çıkıldı.');
    });
    qs('#syncAutoInput')?.addEventListener('change', () => {
      saveConfig({ auto: Boolean(qs('#syncAutoInput')?.checked), apiBase: normalizeBase(qs('#syncBaseInput')?.value || '') });
      startRealtimeLoop();
    });
  }

  async function restoreStatus() {
    const cfg = loadConfig();
    if (!cfg.token) {
      setStatus('Bulut girişi bekleniyor.', 'idle');
      return;
    }
    const ok = await api('/api/auth/status').catch(() => null);
    if (ok && ok.ok) {
      setStatus('Bağlı. Anlık senkron açık.', 'ok');
      saveConfig({ revision: ok.revision || cfg.revision || 0 });
      startRealtimeLoop();
    } else {
      setStatus('Oturum süresi dolmuş. Şifre ile tekrar gir.', 'error');
    }
  }

  function bootSync() {
    injectUi();
    bindUi();
    patchLocalMutations();
    restoreStatus();
    window.addEventListener('online', () => runSafely(() => syncMerge(true), true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootSync);
  else bootSync();

  window.MunnesirSync = { syncMerge, uploadLocalOnly, downloadCloudOnly, localSnapshot, mergeSnapshots, scheduleSync };
})();
