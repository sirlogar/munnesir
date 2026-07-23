function extractKeepPoem(raw, fileName = '') {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.isTrashed) return null;

  const text = normalizeText(raw.textContent || raw.listContent?.map((x) => x?.text).filter(Boolean).join('\n') || '');
  const title = normalizeText(raw.title || titleFromContent(text || fileName.replace(/\.json$/i, '')));
  const content = text || normalizeText(raw.title || '');
  if (!content) return null;

  const createdAt = usecToIso(raw.createdTimestampUsec) || usecToIso(raw.createdTimestamp) || nowIso();
  const updatedAt = usecToIso(raw.userEditedTimestampUsec) || usecToIso(raw.updatedTimestampUsec) || createdAt;
  const tags = normalizePoemTags(raw.labels || raw.labelNames || []);

  return {
    id: `keep-${fileName}-${createdAt}-${title}`.replace(/\s+/g, '-').slice(0, 180),
    title,
    content,
    tags,
    status: 'archive',
    favorite: tags.includes('seçme') || tags.includes('secme') || /seçme|selected|favori/i.test(title),
    source: 'google-keep',
    createdAt,
    updatedAt,
  };
}

async function importKeepFiles(files) {
  const imported = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await file.text());
      const poem = extractKeepPoem(raw, file.name);
      if (poem) imported.push(poem);
    } catch (err) {
      console.warn('Okunamayan dosya:', file.name, err);
    }
  }
  await saveMany(imported);
  await refresh();
  toast(`${imported.length} Keep notu içe aktarıldı.`);
}

function normalizeBackupPoem(p) {
  return {
    id: p.id || uid(),
    title: normalizeText(p.title) || titleFromContent(p.content),
    content: normalizeText(p.content),
    tags: normalizePoemTags(p.tags || []),
    status: p.status || 'archive',
    favorite: Boolean(p.favorite),
    source: p.source || 'backup',
    createdAt: p.createdAt || nowIso(),
    updatedAt: p.updatedAt || p.createdAt || nowIso(),
    ...(p.trashedAt ? { trashedAt: p.trashedAt } : {}),
  };
}

async function importJsonPayloads(items, mode = 'yedek') {
  const imported = [];
  for (const item of items) {
    try {
      const raw = typeof item.content === 'string' ? JSON.parse(item.content) : item.raw;
      const fileName = item.name || 'arsiv.json';
      const poems = Array.isArray(raw) ? raw : raw.poems;
      if (Array.isArray(raw?.books)) {
        const incomingBooks = raw.books.map(normalizeBook).filter(Boolean);
        const existingIds = new Set(state.books.map((book) => book.id));
        incomingBooks.forEach((book) => {
          if (existingIds.has(book.id)) {
            const i = state.books.findIndex((item) => item.id === book.id);
            state.books[i] = book;
          } else {
            state.books.push(book);
          }
        });
        saveBooks();
      }
      if (Array.isArray(poems)) {
        imported.push(...poems.map(normalizeBackupPoem).filter((p) => p.content));
        continue;
      }
      const keepPoem = extractKeepPoem(raw, fileName);
      if (keepPoem) imported.push(keepPoem);
    } catch (err) {
      console.warn('Okunamayan JSON:', item.name, err);
    }
  }
  if (!imported.length) {
    toast('Yüklenecek geçerli JSON bulunamadı.');
    return;
  }
  await saveMany(imported);
  await refresh();
  toast(`${imported.length} şiir ${mode} yüklendi.`);
}

async function importBackupFile(file) {
  await importJsonPayloads([{ name: file.name, content: await file.text() }], 'yedekten');
}