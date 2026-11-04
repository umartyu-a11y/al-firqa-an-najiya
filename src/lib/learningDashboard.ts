import type { BookmarkItem, Cycle, Lecture, LectureProgressEntry } from '../types';

export type LearningStorageMode = 'local-only' | 'checking' | 'offline' | 'cloud-ready' | 'local-fallback';

export interface LearningDashboardSnapshot {
  storage: {
    mode: LearningStorageMode;
    label: string;
    description: string;
    localFirst: true;
  };
  overview: {
    trackedLessons: number;
    availableLessons: number;
    cyclesWithProgress: number;
    availableCycles: number;
    favoriteCount: number;
    bookmarkCount: number;
  };
  recentActivity: Array<{
    lectureId: string;
    title: string;
    author: string;
    cycle: string;
    savedPosition: { currentTime: number; duration: number } | null;
  }>;
  savedResources: {
    favorites: Array<{ lectureId: string; title: string; author: string; cycle: string }>;
    bookmarks: Array<{
      id: string;
      lectureId: string;
      title: string;
      author: string;
      time: number;
      notePreview: string;
      hasHandwriting: boolean;
      tags: string[];
      createdAt: string;
    }>;
  };
}

export interface LearningDashboardInput {
  lectures: Lecture[];
  cycles: Cycle[];
  favorites: string[];
  history: string[];
  bookmarks: BookmarkItem[];
  progress: Record<string, LectureProgressEntry>;
  cloudConfigured: boolean;
  cloudReady: boolean;
  hasCloudSession: boolean;
  online: boolean;
}

const storageCopy: Record<LearningStorageMode, { label: string; description: string }> = {
  'local-only': {
    label: 'Только на этом устройстве',
    description: 'Избранное, история, позиции, заметки, рисунки и тесты сохраняются в браузере этого устройства. Облачная синхронизация не настроена.'
  },
  checking: {
    label: 'Проверяем облачное подключение',
    description: 'Локальное сохранение работает. Если облачный сеанс подключится, с ним будут синхронизироваться избранное, история и позиции прослушивания.'
  },
  offline: {
    label: 'Офлайн — сохранение локальное',
    description: 'Сейчас изменения остаются на этом устройстве. При восстановлении подключения синхронизация доступных данных может продолжиться.'
  },
  'cloud-ready': {
    label: 'Облачный сеанс подключён',
    description: 'Облачный адаптер предназначен для избранного, истории и позиций прослушивания. Заметки, рукописные рисунки, тесты и настройки остаются локальными. Локальная копия сохраняется в любом случае.'
  },
  'local-fallback': {
    label: 'Сохранение на этом устройстве',
    description: 'Облачный сеанс не подтверждён; панель продолжает работать с локальными данными. Заметки, рисунки, тесты и настройки не отправляются в облако.'
  }
};

const validPosition = (entry: LectureProgressEntry | undefined) => {
  if (!entry || !Number.isFinite(entry.currentTime) || entry.currentTime <= 0) return null;
  return {
    currentTime: Math.max(0, entry.currentTime),
    duration: Number.isFinite(entry.duration) && entry.duration > 0 ? entry.duration : 0
  };
};

export function buildLearningDashboardSnapshot(input: LearningDashboardInput): LearningDashboardSnapshot {
  const lectureById = new Map(input.lectures.map((lecture) => [lecture.id, lecture]));
  const trackedProgress = new Map<string, { currentTime: number; duration: number }>();

  for (const lecture of input.lectures) {
    const position = validPosition(input.progress[lecture.id]);
    if (position) {
      trackedProgress.set(lecture.id, {
        currentTime: position.currentTime,
        duration: position.duration || lecture.duration
      });
    }
  }

  const favoriteIds = Array.from(new Set(input.favorites)).filter((id) => lectureById.has(id));
  const recentIds = Array.from(new Set(input.history)).filter((id) => lectureById.has(id)).slice(0, 5);
  const validBookmarks = input.bookmarks.filter((bookmark) => lectureById.has(bookmark.lectureId));
  const cycleIdsWithProgress = new Set(
    Array.from(trackedProgress.keys()).map((id) => lectureById.get(id)!.cycleId)
  );

  let storageMode: LearningStorageMode = 'local-only';
  if (input.cloudConfigured) {
    if (!input.online) storageMode = 'offline';
    else if (!input.cloudReady) storageMode = 'checking';
    else if (input.hasCloudSession) storageMode = 'cloud-ready';
    else storageMode = 'local-fallback';
  }

  const copy = storageCopy[storageMode];
  return {
    storage: { mode: storageMode, ...copy, localFirst: true },
    overview: {
      trackedLessons: trackedProgress.size,
      availableLessons: input.lectures.length,
      cyclesWithProgress: input.cycles.filter((cycle) => cycleIdsWithProgress.has(cycle.id)).length,
      availableCycles: input.cycles.length,
      favoriteCount: favoriteIds.length,
      bookmarkCount: validBookmarks.length
    },
    recentActivity: recentIds.map((lectureId) => {
      const lecture = lectureById.get(lectureId)!;
      return {
        lectureId,
        title: lecture.title,
        author: lecture.author,
        cycle: lecture.cycle,
        savedPosition: trackedProgress.get(lectureId) || null
      };
    }),
    savedResources: {
      favorites: favoriteIds.map((lectureId) => {
        const lecture = lectureById.get(lectureId)!;
        return { lectureId, title: lecture.title, author: lecture.author, cycle: lecture.cycle };
      }),
      bookmarks: validBookmarks.map((bookmark) => {
        const lecture = lectureById.get(bookmark.lectureId)!;
        return {
          id: bookmark.id,
          lectureId: bookmark.lectureId,
          title: lecture.title,
          author: lecture.author,
          time: Number.isFinite(bookmark.time) ? Math.max(0, bookmark.time) : 0,
          notePreview: (bookmark.note || '').trim().slice(0, 140),
          hasHandwriting: Boolean(bookmark.handwriting?.length),
          tags: Array.isArray(bookmark.tags) ? bookmark.tags.filter((tag) => typeof tag === 'string').slice(0, 8) : [],
          createdAt: bookmark.createdAt
        };
      })
    }
  };
}
