import { EMPTY_TAG } from "./state.js";

export function uid() {
  return crypto?.randomUUID
    ? crypto.randomUUID()
    : `poem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

export function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((t) => typeof t === 'string' ? t : t?.name).map(normalizeTag).filter(Boolean))];
  }
  return [...new Set(String(value || '').split(',').map(normalizeTag).filter(Boolean))];
}

function normalizePoemTags(value) {
  let tags = parseTags(value);
  if (tags.length > 1) tags = tags.filter((tag) => tag !== EMPTY_TAG);
  return tags.length ? tags : [EMPTY_TAG];
}

function titleFromContent(content) {
  const first = normalizeText(content).split('\n').find(Boolean) || 'Başlıksız şiir';
  return first.length > 70 ? `${first.slice(0, 67)}...` : first;
}

function usecToIso(value) {
  if (!value) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const ms = n > 10_000_000_000_000 ? Math.floor(n / 1000) : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function formatDate(value) {
  if (!value) return 'tarih yok';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'tarih yok';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(d);
}

function plain(s) {
  return String(s || '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[ch]));
}

function poemWordCount(poem) {
  const words = normalizeText(poem.content).split(/\s+/).filter(Boolean);
  return words.length;
}

function poemLineCount(poem) {
  return normalizeText(poem.content).split('\n').filter(Boolean).length;
}


function normalizeLookup(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ');
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

function backupFilename() {
  const d = new Date();
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = pad2(d.getFullYear() % 100);
  const hour = pad2(d.getHours());
  const minute = pad2(d.getMinutes());
  return `munnesir-${day}-${month}-${year}_${hour}-${minute}.json`;
}