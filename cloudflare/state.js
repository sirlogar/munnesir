export const DB_NAME = 'munnesir-db';
export const DB_VERSION = 1;
export const STORE = 'poems';
export const EMPTY_TAG = '(boş)';
export const BOOKS_KEY = 'munnesir-books';

export const STATUS_OPTIONS = [
  { key: 'draft', label: 'Taslak', aliases: ['taslak', 'draft'] },
  { key: 'ready', label: 'Yayına hazır', aliases: ['yayına hazır','yayina hazir','yayına','yayina','hazır','hazir','ready'] },
  { key: 'archive', label: 'Arşiv', aliases: ['arşiv','arsiv','archive'] },
  { key: 'favorite', label: 'Seçmeler', aliases: ['seçmeler','secmeler','seçme','secme','favori','favorite'] },
];

export const state = {
  poems: [],
  query: '',
  selectedTag: '',
  selectedStatus: 'all',
  sort: 'updatedDesc',
  readerPoemId: null,
  multiSelect: false,
  selectedIds: new Set(),
  bulkEditMode: '',
  view: 'home',
  books: [],
  activeBookId: '',
  bookQuery: '',
  bookTag: '',
  bookStatus: 'all',
  bookSort: 'updatedDesc',
  bookMultiSelect: false,
  bookSelectedIds: new Set(),
  poemFont: localStorage.getItem('munnesir-poem-font') || 'Lora',
  settingsPage: 'home',
};