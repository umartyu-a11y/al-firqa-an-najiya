import { lectureData } from '../data/catalog';
import { sanitizeHandwritingStrokes } from './handwriting';
import type { BookmarkItem, LectureProgressEntry, LocalLibraryBackup, QuizQuestion } from '../types';

export const MAX_LOCAL_BACKUP_BYTES = 5 * 1024 * 1024;

const formatId = 'al-firqa-an-najiya-local-library' as const;
const supportedLectureIds = new Set(lectureData.map((lecture) => lecture.id));
const supportedRates = new Set([0.5, 0.75, 1, 1.25, 1.5, 2]);

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const uniqueKnownIds = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && supportedLectureIds.has(id)))).slice(0, limit);
};

const parseBookmark = (value: unknown): BookmarkItem | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.lectureId !== 'string') return null;
  const id = value.id.trim().slice(0, 160);
  if (!id) return null;
  const lecture = lectureData.find((item) => item.id === value.lectureId);
  if (!lecture || !Number.isFinite(value.time) || Number(value.time) < 0 || Number(value.time) > 86400 || (lecture.duration > 0 && Number(value.time) > lecture.duration)) return null;
  if (!validDate(value.createdAt)) return null;

  const tags = Array.isArray(value.tags)
    ? Array.from(new Set(value.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().slice(0, 48)).filter(Boolean))).slice(0, 8)
    : [];
  const note = typeof value.note === 'string' ? value.note.slice(0, 500) : '';
  const handwriting = sanitizeHandwritingStrokes(value.handwriting);

  return {
    id,
    lectureId: value.lectureId,
    time: Number(value.time),
    createdAt: value.createdAt,
    note,
    tags,
    ...(handwriting.length ? { handwriting } : {})
  };
};

const parseQuestion = (value: unknown): QuizQuestion | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.prompt !== 'string' || !Array.isArray(value.options)) return null;
  const options = value.options.filter((option): option is string => typeof option === 'string').map((option) => option.slice(0, 300)).slice(0, 4);
  const correctIndex = Number(value.correctIndex);
  const prompt = value.prompt.trim().slice(0, 500);
  if (!prompt || options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
  return { id: value.id.slice(0, 160), prompt, options, correctIndex };
};

export const createLocalLibraryBackup = (
  data: Omit<LocalLibraryBackup, 'format' | 'version' | 'exportedAt'>
): LocalLibraryBackup => ({
  format: formatId,
  version: 1,
  exportedAt: new Date().toISOString(),
  ...data
});

export const parseLocalLibraryBackup = (text: string): LocalLibraryBackup => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён или содержит некорректный JSON.');
  }
  if (!isRecord(raw) || raw.format !== formatId || raw.version !== 1) {
    throw new Error('Файл не распознан как резервная копия AL-FIRQA AN-NAJIYA версии 1.');
  }

  const progress: Record<string, LectureProgressEntry> = {};
  if (isRecord(raw.progress)) {
    Object.entries(raw.progress).forEach(([id, value]) => {
      if (!supportedLectureIds.has(id) || !isRecord(value) || !validDate(value.updatedAt)) return;
      const lecture = lectureData.find((item) => item.id === id);
      const currentTime = Number(value.currentTime);
      const duration = Number(value.duration);
      if (!lecture || !Number.isFinite(currentTime) || !Number.isFinite(duration) || currentTime < 0 || duration < 0 || currentTime > 86400 || (lecture.duration > 0 && currentTime > lecture.duration + 5)) return;
      const durationLimit = lecture.duration > 0 ? lecture.duration : duration;
      progress[id] = {
        currentTime: durationLimit > 0 ? Math.min(currentTime, durationLimit) : currentTime,
        duration: lecture.duration > 0 ? Math.min(duration, lecture.duration) : duration,
        updatedAt: value.updatedAt
      };
    });
  }

  const bookmarks = Array.isArray(raw.bookmarks)
    ? raw.bookmarks.map(parseBookmark).filter((bookmark): bookmark is BookmarkItem => bookmark !== null).slice(0, 1000)
    : [];

  const quizzes: Record<string, QuizQuestion[]> = {};
  if (isRecord(raw.quizzes)) {
    Object.entries(raw.quizzes).forEach(([id, value]) => {
      if (!supportedLectureIds.has(id) || !Array.isArray(value)) return;
      quizzes[id] = value.map(parseQuestion).filter((question): question is QuizQuestion => question !== null).slice(0, 500);
    });
  }

  const preferencesRaw = isRecord(raw.preferences) ? raw.preferences : {};
  const currentLectureId = typeof preferencesRaw.currentLectureId === 'string' && supportedLectureIds.has(preferencesRaw.currentLectureId)
    ? preferencesRaw.currentLectureId
    : null;
  const volume = Number(preferencesRaw.volume);
  const rate = Number(preferencesRaw.rate);

  return {
    format: formatId,
    version: 1,
    exportedAt: validDate(raw.exportedAt) ? raw.exportedAt : new Date(0).toISOString(),
    favorites: uniqueKnownIds(raw.favorites, lectureData.length),
    history: uniqueKnownIds(raw.history, 100),
    progress,
    bookmarks: Array.from(new Map(bookmarks.map((item) => [item.id, item])).values()),
    quizzes,
    preferences: {
      theme: preferencesRaw.theme === 'dark' ? 'dark' : 'light',
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1,
      rate: supportedRates.has(rate) ? rate : 1,
      currentLectureId
    }
  };
};
