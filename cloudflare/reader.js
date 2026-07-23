function openReader(id, allowEdit = true) {
  const poem = state.poems.find((p) => p.id === id);
  if (!poem) return;
  state.readerPoemId = id;
  els.readerTitle.textContent = poem.favorite ? `★ ${poem.title}` : poem.title;
  els.readerMeta.textContent = `${formatDate(poem.updatedAt)} · ${poemWordCount(poem)} kelime · ${poemLineCount(poem)} dize`;
  els.readerTags.innerHTML = visibleTagsForPoem(poem).map((tag) => `<button class="tagChip" data-reader-tag="${plain(tag)}" type="button">#${plain(tag)}</button>`).join('');
  els.readerContent.textContent = poem.content;
  els.readerEditBtn.hidden = !allowEdit;
  els.readerDialog.showModal();
  $$('[data-reader-tag]').forEach((btn) => btn.addEventListener('click', () => {
    state.selectedTag = btn.dataset.readerTag;
    els.readerDialog.close();
    render();
  }));
}


async function sharePoem(id) {
  const poem = state.poems.find((p) => p.id === id);
  if (!poem) return;
  const title = poem.title || 'Şiir';
  const text = String(poem.content || '');
  try {
    if (window.AndroidBridge?.shareText) {
      window.AndroidBridge.shareText(title, text);
      return;
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Paylaşım desteklenmedi, metin panoya kopyalandı.');
  } catch (err) {
    console.warn(err);
    toast('Paylaşım iptal edildi veya başarısız oldu.');
  }
}