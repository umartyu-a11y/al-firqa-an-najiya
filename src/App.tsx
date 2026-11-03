import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  BookOpenText,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Download,
  Headphones,
  Heart,
  Moon,
  Pause,
  Play,
  Printer,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  SunMedium,
  Volume2
} from 'lucide-react';
import { bookData } from './data/books';
import { cycles, lectureData, orderedCycleLectures } from './data/catalog';
import { BooksPage, CoursesPage } from './CollectionPages';
import type { Category, Lecture } from './types';
import { isSupabaseConfigured } from './lib/supabase';
import { loadCloudLibrary, loadCloudProgress, saveCloudLibrary, saveCloudProgress } from './lib/cloudLibrary';
import { getAuthSession, requestPersistentAccess, signOutUser, subscribeToAuth } from './lib/auth';
import type { Session } from '@supabase/supabase-js';

type SortType = 'newest' | 'title' | 'author' | 'duration';
type Theme = 'light' | 'dark';
type ResourceType = 'books' | 'texts' | 'dictionary' | 'courses';
type LibrarySearchType = 'all' | 'note' | 'bookmark';
type LibrarySearchSort = 'newest' | 'oldest';
type BookmarkItem = { id: string; lectureId: string; time: number; createdAt: string; note?: string; tags?: string[] };
type QuizQuestion = { id: string; prompt: string; options: string[]; correctIndex: number };

const readQuizQuestions = (lectureId: string): QuizQuestion[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(`affn-quiz-${lectureId}`) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const storageKeys = {
  theme: 'affn-theme',
  favorites: 'affn-favorites',
  history: 'affn-history',
  progress: 'affn-progress',
  bookmarks: 'affn-bookmarks'
};

const authorMap = {
  'abu-yahya-krymskiy': {
    id: 'abu-yahya-krymskiy',
    name: 'Абу Яхья Крымский',
    bio: 'В проекте указано только имя автора. Подтверждённые биографические сведения проверяются отдельно перед публикацией на сайте.'
  }
};

const categories: Category[] = [
  'Акыда',
  'Таухид',
  'Фикх',
  'Хадисы',
  'Коран и тафсир',
  'Нравственность',
  'Основы знания',
  'Разное'
];

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const parseHash = () => {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash || hash === '/') return 'home';
  if (hash.startsWith('/catalog')) return 'catalog';
  if (hash.startsWith('/library')) return 'library';
  if (hash.startsWith('/cycle/')) return 'cycle';
  if (hash.startsWith('/author/')) return 'author';
  if (hash.startsWith('/lecture/')) return 'lecture';
  if (hash.startsWith('/category/')) return 'category';
  if (hash.startsWith('/about')) return 'about';
  if (hash.startsWith('/books') || hash.startsWith('/texts') || hash.startsWith('/dictionary') || hash.startsWith('/courses')) return 'resource';
  return 'home';
};

const getLectureById = (id: string) => lectureData.find((lecture) => lecture.id === id);

const getAudioProgress = (id: string) => {
  try {
    const raw = localStorage.getItem(storageKeys.progress);
    const map = raw ? JSON.parse(raw) : {};
    return map[id]?.currentTime ?? 0;
  } catch {
    return 0;
  }
};

const saveProgress = (id: string, currentTime: number, duration = 0) => {
  try {
    const raw = localStorage.getItem(storageKeys.progress);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = { currentTime, duration, updatedAt: new Date().toISOString() };
    localStorage.setItem(storageKeys.progress, JSON.stringify(map));
  } catch {
    // ignore localStorage issues
  }
};

const mergeCloudProgress = (remote: Record<string, { currentTime: number; duration: number; updatedAt: string }>) => {
  try {
    const local = JSON.parse(localStorage.getItem(storageKeys.progress) || '{}');
    Object.entries(remote).forEach(([id, value]) => {
      if (!local[id] || new Date(value.updatedAt).getTime() > new Date(local[id].updatedAt || 0).getTime()) {
        local[id] = value;
      }
    });
    localStorage.setItem(storageKeys.progress, JSON.stringify(local));
  } catch {
    // ignore localStorage issues
  }
};

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[character] || character));

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(storageKeys.theme);
    if (saved === 'dark') return 'dark';
    if (saved === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [route, setRoute] = useState<'home' | 'catalog' | 'library' | 'cycle' | 'author' | 'lecture' | 'category' | 'about' | 'resource'>(() => parseHash());
  const [search, setSearch] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySearchType, setLibrarySearchType] = useState<LibrarySearchType>('all');
  const [librarySearchSort, setLibrarySearchSort] = useState<LibrarySearchSort>('newest');
  const [sort, setSort] = useState<SortType>('newest');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Все'>('Все');
  const [authorFilter, setAuthorFilter] = useState<string>('Все');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKeys.favorites) || '[]');
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKeys.history) || '[]');
    } catch {
      return [];
    }
  });
  const [currentLectureId, setCurrentLectureId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('affn-current-lecture');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKeys.bookmarks) || '[]');
    } catch {
      return [];
    }
  });

  const [cloudReady, setCloudReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const lastCloudProgressSave = useRef<Record<string, number>>({});
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    rate: 1,
    sleepMinutes: 0,
    volume: Number(localStorage.getItem('affn-volume') ?? 1)
  });
  const [repeatSegment, setRepeatSegment] = useState<{ start: number | null; end: number | null; active: boolean }>({ start: null, end: null, active: false });
  const [repeatLesson, setRepeatLesson] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restoringPosition = useRef(false);
  const handlingTrackEnd = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(storageKeys.theme, theme);
  }, [theme]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = playerState.volume;
    localStorage.setItem('affn-volume', String(playerState.volume));
  }, [playerState.volume]);

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKeys.favorites, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(storageKeys.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(storageKeys.bookmarks, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    if (currentLectureId) {
      localStorage.setItem('affn-current-lecture', currentLectureId);
    } else {
      localStorage.removeItem('affn-current-lecture');
    }
  }, [currentLectureId]);

  useEffect(() => {
    const saveCurrentPosition = () => {
      const audio = audioRef.current;
      if (!currentLectureId || !audio || restoringPosition.current || audio.readyState < 1) return;
      const currentTime = audio.currentTime;
      if (!Number.isFinite(currentTime) || currentTime <= 0) return;
      saveProgress(currentLectureId, currentTime, audio.duration || playerState.duration);
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') saveCurrentPosition();
    };
    window.addEventListener('pagehide', saveCurrentPosition);
    window.addEventListener('beforeunload', saveCurrentPosition);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      window.removeEventListener('pagehide', saveCurrentPosition);
      window.removeEventListener('beforeunload', saveCurrentPosition);
      document.removeEventListener('visibilitychange', saveWhenHidden);
    };
  }, [currentLectureId, playerState.duration]);

  useEffect(() => {
    let cancelled = false;

    const syncFromCloud = async () => {
      if (!isSupabaseConfigured) {
        setCloudReady(true);
        return;
      }

      const [remote, remoteProgress] = await Promise.all([loadCloudLibrary(), loadCloudProgress()]);
      if (cancelled) return;

      if (remote) {
        setFavorites((local) => Array.from(new Set([...remote.favorites, ...local])));
        setHistory((local) => Array.from(new Set([...remote.history, ...local])).slice(0, 12));
      }
      if (remoteProgress) mergeCloudProgress(remoteProgress);
      setCloudReady(true);
    };

    void syncFromCloud();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudReady || !isSupabaseConfigured) return;
    void saveCloudLibrary({ favorites, history });
  }, [cloudReady, favorites, history]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void getAuthSession().then((session) => {
      if (!cancelled) setAuthSession(session);
    });
    const unsubscribe = subscribeToAuth((_event, session) => {
      setAuthSession(session);
      if (!session) return;
      void Promise.all([loadCloudLibrary(), loadCloudProgress()]).then(([remote, remoteProgress]) => {
        if (cancelled) return;
        if (remote) {
          setFavorites((local) => Array.from(new Set([...remote.favorites, ...local])));
          setHistory((local) => Array.from(new Set([...remote.history, ...local])).slice(0, 12));
        }
        if (remoteProgress) mergeCloudProgress(remoteProgress);
        setCloudReady(true);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleRequestAccess = async () => {
    setAuthBusy(true);
    setAuthMessage('');
    const result = await requestPersistentAccess(authEmail);
    setAuthBusy(false);
    setAuthMessage(result.error || 'Проверьте почту и перейдите по ссылке подтверждения.');
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthMessage('Вы вышли. Локальная библиотека сохранена на этом устройстве.');
  };

  useEffect(() => {
    if (!playerState.sleepMinutes || !playerState.isPlaying) return;

    const timer = window.setInterval(() => {
      setPlayerState((prev) => {
        if (prev.sleepMinutes <= 1) {
          return { ...prev, sleepMinutes: 0, isPlaying: false };
        }
        return { ...prev, sleepMinutes: prev.sleepMinutes - 1 };
      });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [playerState.sleepMinutes, playerState.isPlaying]);

  const lectureMap = useMemo(() => {
    const result: Record<string, Lecture> = {};
    lectureData.forEach((lecture) => (result[lecture.id] = lecture));
    return result;
  }, []);

  const toggleFavorite = (lectureId: string) => {
    setFavorites((prev) => (prev.includes(lectureId) ? prev.filter((id) => id !== lectureId) : [...prev, lectureId]));
  };

  const pushHistory = (lectureId: string) => {
    setHistory((prev) => [lectureId, ...prev.filter((id) => id !== lectureId)].slice(0, 12));
  };

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const uniqueAuthors = ['Все', ...new Set(lectureData.map((lecture) => lecture.author))];

  const visibleLectures = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = [...lectureData];

    if (categoryFilter !== 'Все') {
      list = list.filter((lecture) => lecture.category === categoryFilter);
    }

    if (authorFilter !== 'Все') {
      list = list.filter((lecture) => lecture.author === authorFilter);
    }

    if (query) {
      list = list.filter((lecture) => {
        const haystack = [
          lecture.title,
          lecture.author,
          lecture.category,
          lecture.cycle,
          lecture.tags.join(' '),
          lecture.description,
          lecture.sourceFileName || ''
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    list.sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'author':
          return a.author.localeCompare(b.author);
        case 'duration':
          return b.duration - a.duration;
        case 'newest':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return list;
  }, [search, sort, categoryFilter, authorFilter]);

  const currentLecture = currentLectureId ? lectureMap[currentLectureId] : null;

  const updateMediaSessionPosition = (audio: HTMLAudioElement) => {
    if (!('mediaSession' in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch {
      // Some mobile browsers expose Media Session but reject position updates.
    }
  };

  useEffect(() => {
    if (!currentLectureId) {
      restoringPosition.current = false;
      return;
    }
    const lecture = getLectureById(currentLectureId);
    if (!lecture || !audioRef.current) {
      restoringPosition.current = false;
      return;
    }

    const audio = audioRef.current;
    restoringPosition.current = true;
    audio.src = lecture.audioUrl;
    audio.load();
  }, [currentLectureId]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    audio.playbackRate = playerState.rate;
    if (playerState.isPlaying && currentLectureId) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentLectureId, playerState.rate, playerState.isPlaying]);

  const handleTogglePlay = () => {
    if (!currentLectureId) {
      const firstLecture = lectureData[0];
      setCurrentLectureId(firstLecture.id);
      setPlayerState((prev) => ({ ...prev, isPlaying: true }));
      pushHistory(firstLecture.id);
      return;
    }

    setPlayerState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setPlayerState((prev) => ({ ...prev, currentTime: value }));
    persistPlaybackProgress(currentLectureId, value, audioRef.current.duration || playerState.duration, true);
  };

  const persistPlaybackProgress = (lectureId: string | null, currentTime: number, duration: number, force = false) => {
    if (!lectureId) return;
    saveProgress(lectureId, currentTime, duration);
    if (!cloudReady || !isSupabaseConfigured) return;
    const now = Date.now();
    const last = lastCloudProgressSave.current[lectureId] || 0;
    if (!force && now - last < 5000) return;
    lastCloudProgressSave.current[lectureId] = now;
    void saveCloudProgress(lectureId, currentTime, duration);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || restoringPosition.current) return;
    if (repeatSegment.active && repeatSegment.start !== null && repeatSegment.end !== null && audio.currentTime >= repeatSegment.end) {
      audio.currentTime = repeatSegment.start;
    }
    persistPlaybackProgress(currentLectureId, audio.currentTime, audio.duration || playerState.duration);
    updateMediaSessionPosition(audio);
    setPlayerState((prev) => ({
      ...prev,
      currentTime: audio.currentTime,
      duration: audio.duration || prev.duration
    }));
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const saved = currentLectureId ? getAudioProgress(currentLectureId) : 0;
    const canRestore = saved > 0 && saved < audio.duration;
    if (canRestore) audio.currentTime = saved;
    restoringPosition.current = false;
    updateMediaSessionPosition(audio);
    setPlayerState((prev) => ({
      ...prev,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      currentTime: canRestore ? saved : 0
    }));
  };

  const addBookmark = () => {
    if (!currentLectureId || playerState.currentTime <= 0) return;
    const time = Math.floor(playerState.currentTime);
    const id = `${currentLectureId}-${time}`;
    setBookmarks((prev) => [{ id, lectureId: currentLectureId, time, createdAt: new Date().toISOString(), note: prev.find((item) => item.id === id)?.note || '', tags: prev.find((item) => item.id === id)?.tags || [] }, ...prev.filter((item) => item.id !== id)].slice(0, 100));
  };

  const updateBookmarkNote = (id: string, note: string) => {
    setBookmarks((prev) => prev.map((item) => item.id === id ? { ...item, note } : item));
  };

  const updateBookmarkTags = (id: string, value: string) => {
    const tags = Array.from(new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))).slice(0, 8);
    setBookmarks((prev) => prev.map((item) => item.id === id ? { ...item, tags } : item));
  };

  const removeBookmark = (id: string) => setBookmarks((prev) => prev.filter((item) => item.id !== id));

  const setRepeatPoint = () => {
    const time = Math.floor(playerState.currentTime);
    if (repeatSegment.start === null || repeatSegment.end !== null) {
      setRepeatSegment({ start: time, end: null, active: false });
      return;
    }
    if (time > repeatSegment.start) setRepeatSegment({ start: repeatSegment.start, end: time, active: true });
  };

  const clearRepeat = () => setRepeatSegment({ start: null, end: null, active: false });

  const handleEnded = () => {
    const audio = audioRef.current;
    handlingTrackEnd.current = true;
    persistPlaybackProgress(currentLectureId, audio?.currentTime || playerState.currentTime, audio?.duration || playerState.duration, true);
    if (repeatLesson && audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      setPlayerState((prev) => ({ ...prev, currentTime: 0, isPlaying: true }));
      return;
    }
    if (repeatSegment.active) {
      clearRepeat();
    }
    const playlist = currentLecture ? orderedCycleLectures(currentLecture.cycleId) : lectureData;
    const currentIndex = playlist.findIndex((lecture) => lecture.id === currentLectureId);
    const next = playlist[currentIndex + 1];
    if (!next) {
      setPlayerState((prev) => ({ ...prev, isPlaying: false, currentTime: audio && Number.isFinite(audio.duration) ? audio.duration : prev.currentTime }));
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      return;
    }
    setCurrentLectureId(next.id);
    setPlayerState((prev) => ({ ...prev, isPlaying: true, currentTime: 0 }));
    pushHistory(next.id);
  };

  const prevLecture = () => {
    if (!currentLectureId) return;
    const playlist = currentLecture ? orderedCycleLectures(currentLecture.cycleId) : lectureData;
    const index = playlist.findIndex((lecture) => lecture.id === currentLectureId);
    const prev = playlist[index - 1] || playlist[playlist.length - 1];
    setCurrentLectureId(prev.id);
    setPlayerState((prevState) => ({ ...prevState, isPlaying: true, currentTime: 0 }));
    pushHistory(prev.id);
  };

  const nextLecture = () => {
    if (!currentLectureId) return;
    const playlist = currentLecture ? orderedCycleLectures(currentLecture.cycleId) : lectureData;
    const index = playlist.findIndex((lecture) => lecture.id === currentLectureId);
    const next = playlist[index + 1] || playlist[0];
    setCurrentLectureId(next.id);
    setPlayerState((prevState) => ({ ...prevState, isPlaying: true, currentTime: 0 }));
    pushHistory(next.id);
  };

  useEffect(() => {
    if (!currentLecture || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentLecture.title,
      artist: currentLecture.author,
      album: currentLecture.cycle,
      artwork: [{ src: new URL(`${import.meta.env.BASE_URL}favicon.svg`, window.location.origin).href, sizes: 'any', type: 'image/svg+xml' }]
    });
    navigator.mediaSession.playbackState = playerState.isPlaying ? 'playing' : 'paused';

    const seekBy = (offset: number) => {
      if (!audioRef.current) return;
      handleSeek(Math.max(0, Math.min(audioRef.current.duration || currentLecture.duration, audioRef.current.currentTime + offset)));
    };

    navigator.mediaSession.setActionHandler('play', () => setPlayerState((prev) => ({ ...prev, isPlaying: true })));
    navigator.mediaSession.setActionHandler('pause', () => setPlayerState((prev) => ({ ...prev, isPlaying: false })));
    navigator.mediaSession.setActionHandler('previoustrack', prevLecture);
    navigator.mediaSession.setActionHandler('nexttrack', nextLecture);
    navigator.mediaSession.setActionHandler('seekbackward', (details) => seekBy(-(details.seekOffset || 10)));
    navigator.mediaSession.setActionHandler('seekforward', (details) => seekBy(details.seekOffset || 10));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (!audioRef.current || details.seekTime === undefined) return;
      handleSeek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setPlayerState((prev) => ({ ...prev, currentTime: 0, isPlaying: false }));
    });

    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto', 'stop'].forEach((action) => {
        try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, null); } catch { /* unsupported action */ }
      });
    };
  }, [currentLectureId, currentLecture, playerState.isPlaying]);

  const handleOpenLecture = (lectureId: string) => {
    setCurrentLectureId(lectureId);
    setPlayerState((prev) => ({ ...prev, isPlaying: true, currentTime: getAudioProgress(lectureId) }));
    pushHistory(lectureId);
    navigate(`/lecture/${lectureId}`);
  };

  const exportBookmarksText = (lecture: Lecture, items: BookmarkItem[]) => {
    const lines = [
      'AL-FIRQA AN-NAJIYA',
      `Лекция: ${lecture.title}`,
      `Автор: ${lecture.author}`,
      `Цикл: ${lecture.cycle}`,
      '',
      ...items.flatMap((item, index) => [`${index + 1}. ${formatDuration(item.time)}`, `Теги: ${(item.tags || []).join(', ') || '—'}`, item.note?.trim() || 'Без заметки', ''])
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lecture.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'lecture'}-bookmarks.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBookmarksPdf = (lecture: Lecture, items: BookmarkItem[]) => {
    const popup = window.open('', '_blank', 'width=760,height=900');
    if (!popup) return;
    const rows = items.map((item) => `<article><h2>${escapeHtml(formatDuration(item.time))}</h2><div class="meta">Теги: ${escapeHtml((item.tags || []).join(', ') || '—')}</div><p>${escapeHtml(item.note?.trim() || 'Без заметки')}</p></article>`).join('');
    popup.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(lecture.title)} — закладки</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111820}h1{font-size:28px;margin-bottom:8px}header{border-bottom:1px solid #ddd;padding-bottom:20px;margin-bottom:24px}article{border:1px solid #ddd;border-radius:14px;padding:16px;margin:12px 0;break-inside:avoid}h2{font-size:18px;margin:0 0 8px;color:#9b6d32}p{white-space:pre-wrap;line-height:1.55;margin:0}@media print{body{margin:0 auto}}</style></head><body><header><h1>Закладки и заметки</h1><div>${escapeHtml(lecture.title)}</div><small>${escapeHtml(lecture.author)} · ${escapeHtml(lecture.cycle)}</small></header>${rows || '<p>Закладок пока нет.</p>'}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  };

  const exportAllBookmarksText = () => {
    const entries = bookmarks.map((item) => ({ item, lecture: getLectureById(item.lectureId) })).filter((entry): entry is { item: BookmarkItem; lecture: Lecture } => Boolean(entry.lecture));
    const lines = ['AL-FIRQA AN-NAJIYA', 'Все закладки и заметки', `Экспортировано: ${new Date().toLocaleString('ru-RU')}`, ''];
    entries.forEach(({ item, lecture }, index) => {
      lines.push(`${index + 1}. ${lecture.title}`, `Автор: ${lecture.author}`, `Позиция: ${formatDuration(item.time)}`, `Теги: ${(item.tags || []).join(', ') || '—'}`, item.note?.trim() || 'Без заметки', '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'al-firqa-an-najiya-bookmarks.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAllBookmarksPdf = () => {
    const entries = bookmarks.map((item) => ({ item, lecture: getLectureById(item.lectureId) })).filter((entry): entry is { item: BookmarkItem; lecture: Lecture } => Boolean(entry.lecture));
    const popup = window.open('', '_blank', 'width=760,height=900');
    if (!popup) return;
    const rows = entries.map(({ item, lecture }) => `<article><h2>${escapeHtml(lecture.title)}</h2><div class="meta">${escapeHtml(lecture.author)} · ${escapeHtml(formatDuration(item.time))} · Теги: ${escapeHtml((item.tags || []).join(', ') || '—')}</div><p>${escapeHtml(item.note?.trim() || 'Без заметки')}</p></article>`).join('');
    popup.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>AL-FIRQA AN-NAJIYA — все заметки</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111820}h1{font-size:28px;margin-bottom:8px}header{border-bottom:1px solid #ddd;padding-bottom:20px;margin-bottom:24px}article{border:1px solid #ddd;border-radius:14px;padding:16px;margin:12px 0;break-inside:avoid}h2{font-size:18px;margin:0 0 8px;color:#9b6d32}.meta{font-size:13px;color:#66717d;margin-bottom:10px}p{white-space:pre-wrap;line-height:1.55;margin:0}@media print{body{margin:0 auto}}</style></head><body><header><h1>Все закладки и заметки</h1><div>AL-FIRQA AN-NAJIYA</div><small>Экспортировано: ${escapeHtml(new Date().toLocaleString('ru-RU'))}</small></header>${rows || '<p>Закладок пока нет.</p>'}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  };

  const favoriteLectures = lectureData.filter((lecture) => favorites.includes(lecture.id));
  const continueLectures = lectureData.filter((lecture) => getAudioProgress(lecture.id) > 15);
  const recentLectures = history.map((id) => getLectureById(id)).filter(Boolean) as Lecture[];

  const renderRoute = () => {
    if (route === 'library') {
      return (
        <LibraryPage
          continueLectures={continueLectures}
          favoriteLectures={favoriteLectures}
          recentLectures={recentLectures}
          onOpenLecture={handleOpenLecture}
          onToggleFavorite={toggleFavorite}
          favorites={favorites}
          getProgress={getAudioProgress}
          cloudReady={cloudReady}
          cloudEnabled={isSupabaseConfigured}
          authSession={authSession}
          onOpenAuth={() => { setAuthMessage(''); setAuthOpen(true); }}
          onSignOut={handleSignOut}
          bookmarks={bookmarks}
          onExportAllText={exportAllBookmarksText}
          onExportAllPdf={exportAllBookmarksPdf}
          librarySearch={librarySearch}
          setLibrarySearch={setLibrarySearch}
          librarySearchType={librarySearchType}
          setLibrarySearchType={setLibrarySearchType}
          librarySearchSort={librarySearchSort}
          setLibrarySearchSort={setLibrarySearchSort}
        />
      );
    }

    if (route === 'catalog') {
      return (
        <CatalogPage
          lectures={visibleLectures}
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          authorFilter={authorFilter}
          setAuthorFilter={setAuthorFilter}
          uniqueAuthors={uniqueAuthors}
          categories={categories}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenLecture={handleOpenLecture}
          getProgress={getAudioProgress}
          highlightQuery={search}
        />
      );
    }

    if (route === 'cycle') {
      const cycleId = window.location.hash.replace(/^#\/cycle\//, '');
      const cycleLectures = orderedCycleLectures(cycleId);
      const cycle = cycles.find((item) => item.id === cycleId);

      if (!cycle || !cycleLectures.length) {
        return <EmptyState title="Цикл не найден" actionLabel="К каталогу" onAction={() => navigate('/catalog')} />;
      }

      return (
        <CyclePage
          cycle={cycle}
          lectures={cycleLectures}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenLecture={handleOpenLecture}
          getProgress={getAudioProgress}
        />
      );
    }

    if (route === 'author') {
      const authorId = window.location.hash.replace(/^#\/author\//, '');
      const authorLectures = lectureData.filter((lecture) => lecture.authorId === authorId);
      const author = authorMap[authorId as keyof typeof authorMap];
      if (!author) {
        return <EmptyState title="Автор не найден" actionLabel="К списку лекций" onAction={() => navigate('/catalog')} />;
      }

      return (
        <AuthorPage
          author={author}
          lectures={authorLectures}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenLecture={handleOpenLecture}
          getProgress={getAudioProgress}
        />
      );
    }

    if (route === 'lecture') {
      const lectureId = window.location.hash.replace(/^#\/lecture\//, '');
      const lecture = getLectureById(lectureId);
      if (!lecture) {
        return <EmptyState title="Лекция не найдена" actionLabel="К каталогу" onAction={() => navigate('/catalog')} />;
      }

      return (
        <LecturePage
          lecture={lecture}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenLecture={handleOpenLecture}
          currentLectureId={currentLectureId}
          setCurrentLectureId={setCurrentLectureId}
          playerState={playerState}
          setPlayerState={setPlayerState}
          audioRef={audioRef}
          prevLecture={prevLecture}
          nextLecture={nextLecture}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
          handleTimeUpdate={handleTimeUpdate}
          handleLoadedMetadata={handleLoadedMetadata}
          handleEnded={handleEnded}
          getProgress={getAudioProgress}
          bookmarks={bookmarks.filter((item) => item.lectureId === lecture.id)}
          onAddBookmark={addBookmark}
          onRemoveBookmark={removeBookmark}
          onUpdateBookmarkNote={updateBookmarkNote}
          onUpdateBookmarkTags={updateBookmarkTags}
          onExportText={(items) => exportBookmarksText(lecture, items)}
          onExportPdf={(items) => exportBookmarksPdf(lecture, items)}
          repeatSegment={repeatSegment}
          onSetRepeatPoint={setRepeatPoint}
          onClearRepeat={clearRepeat}
          repeatLesson={repeatLesson}
          onToggleRepeatLesson={() => setRepeatLesson((prev) => !prev)}
        />
      );
    }

    if (route === 'category') {
      const category = decodeURIComponent(window.location.hash.replace(/^#\/category\//, ''));
      const filtered = lectureData.filter((lecture) => lecture.category === category);

      return (
        <CategoryPage
          category={category as Category}
          lectures={filtered}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenLecture={handleOpenLecture}
          getProgress={getAudioProgress}
        />
      );
    }

    if (route === 'about') return <AboutPage />;

    if (route === 'resource') {
      const resource = window.location.hash.replace(/^#\//, '').split('/')[0] as ResourceType;
      if (resource === 'books') return <BooksPage onOpenCycle={(id) => navigate(`/cycle/${id}`)} />;
      if (resource === 'courses') return <CoursesPage onOpenCycle={(id) => navigate(`/cycle/${id}`)} />;
      return <ResourcePage resource={resource} onOpenCatalog={() => navigate('/catalog')} />;
    }

    return (
      <HomePage
        onOpenLecture={handleOpenLecture}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        getProgress={getAudioProgress}
        continueLectures={continueLectures}
      />
    );
  };

  const currentView = route === 'home' ? 'home' : route;

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-300 dark:bg-darkbg dark:text-darktext">
      <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-5 sm:px-6 lg:px-8">
        {!isOnline && <div role="status" className="mb-3 rounded-2xl border border-[#B8874A]/30 bg-[#B8874A]/10 px-4 py-3 text-sm text-text dark:border-[#E0821E]/30 dark:bg-[#E0821E]/10 dark:text-darktext">Офлайн-режим: доступна ранее загруженная оболочка и каталог. Аудио и облачная синхронизация возобновятся после подключения к сети.</div>}
        <header className="sticky top-3 z-40 mb-8">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(17,24,32,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101010]/85">
            <button className="flex items-center gap-3" onClick={() => navigate('/')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111820] p-1.5 dark:bg-[#F5F5F5]">
                <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="text-left">
                <div className="font-semibold tracking-[0.12em] text-[10px] uppercase text-muted dark:text-darkmuted">
                  AL-FIRQA
                </div>
                <div className="font-display text-lg leading-none text-text dark:text-darktext">AN-NAJIYA</div>
              </div>
            </button>

            <nav className="hidden items-center gap-8 md:flex">
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/catalog')}>
                Лекции
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/courses')}>
                Курсы
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/author/abu-yahya-krymskiy')}>
                Авторы
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/books')}>
                Книги
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/about')}>
                О проекте
              </button>
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted md:flex">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (currentView !== 'catalog') navigate('/catalog');
                  }}
                  placeholder="Найти лекцию, шейха или тему…"
                  className="w-48 bg-transparent outline-none placeholder:text-muted dark:placeholder:text-darkmuted"
                />
              </div>

              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white text-text transition hover:-translate-y-0.5 hover:shadow-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                aria-label="Переключить тему"
              >
                {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
              </button>

              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white text-text transition hover:-translate-y-0.5 hover:shadow-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext"
                onClick={() => navigate('/library')}
                aria-label="Избранное и библиотека"
              >
                <Heart size={16} />
              </button>
            </div>
          </div>
        </header>

        {renderRoute()}

        <nav aria-label="Быстрая навигация" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-2xl border border-black/5 bg-white/90 p-2 shadow-[0_18px_60px_rgba(17,24,32,0.14)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#101010]/90">
          {[
            { label: 'Главная', icon: <Sparkles size={16} />, path: '/' },
            { label: 'Лекции', icon: <BookOpenText size={16} />, path: '/catalog' },
            { label: 'Библиотека', icon: <Heart size={16} />, path: '/library' },
            { label: 'Книги', icon: <BookOpenText size={16} />, path: '/books' }
          ].map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium text-muted transition hover:bg-black/5 hover:text-text dark:text-darkmuted dark:hover:bg-white/10 dark:hover:text-darktext">
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>

        <footer className="mt-24 border-t border-black/5 pt-8 text-sm text-muted dark:border-white/10 dark:text-darkmuted">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="font-medium tracking-[0.08em] text-text dark:text-darktext">AL-FIRQA AN-NAJIYA</div>
            <div>Исламские лекции и архив знаний</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {[['Книги', '/books'], ['Тексты', '/texts'], ['Словарь', '/dictionary'], ['Курсы', '/courses'], ['О проекте', '/about']].map(([label, path]) => (
              <button key={path} onClick={() => navigate(path)} className="text-muted underline-offset-4 transition hover:text-text hover:underline dark:text-darkmuted dark:hover:text-darktext">{label}</button>
            ))}
          </div>
        </footer>
      </div>

      <MiniPlayer
        lecture={currentLecture}
        isPlaying={playerState.isPlaying}
        currentTime={playerState.currentTime}
        duration={playerState.duration || currentLecture?.duration || 0}
        rate={playerState.rate}
        setRate={(newRate) => setPlayerState((prev) => ({ ...prev, rate: newRate }))}
        volume={playerState.volume}
        setVolume={(volume) => setPlayerState((prev) => ({ ...prev, volume }))}
        onTogglePlay={handleTogglePlay}
        onPrev={prevLecture}
        onNext={nextLecture}
        onSeek={handleSeek}
        sleepMinutes={playerState.sleepMinutes}
        setSleepMinutes={(minutes) => setPlayerState((prev) => ({ ...prev, sleepMinutes: minutes }))}
      />

      {authOpen && (
        <AuthDialog
          email={authEmail}
          setEmail={setAuthEmail}
          busy={authBusy}
          message={authMessage}
          onSubmit={handleRequestAccess}
          onClose={() => setAuthOpen(false)}
        />
      )}

      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        aria-label="Аудиоплеер лекции"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPause={() => {
          const audio = audioRef.current;
          if (handlingTrackEnd.current || restoringPosition.current) return;
          if (!restoringPosition.current) {
            if (audio && audio.readyState >= 1) {
              persistPlaybackProgress(currentLectureId, audio.currentTime, audio.duration || playerState.duration, true);
            }
            navigator.mediaSession && (navigator.mediaSession.playbackState = 'paused');
            setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          }
        }}
        onPlay={() => {
          handlingTrackEnd.current = false;
          navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');
          setPlayerState((prev) => ({ ...prev, isPlaying: true }));
        }}
        onError={() => {
          handlingTrackEnd.current = false;
          restoringPosition.current = false;
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
        }}
      />
    </div>
  );
}

function HomePage({ onOpenLecture, favorites, onToggleFavorite, getProgress, continueLectures }: {
  onOpenLecture: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  getProgress: (id: string) => number;
  continueLectures: Lecture[];
}) {
  const categoryStats = categories
    .map((label) => ({ label, count: lectureData.filter((lecture) => lecture.category === label).length }))
    .filter((item) => item.count > 0);
  const latestLectures = lectureData.slice(0, 3);

  return (
    <main className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-7 sm:p-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#B8874A]/15 bg-[#B8874A]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8C5B22] dark:border-[#E0821E]/20 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">
            <Sparkles size={14} />
            Premium Digital Lecture Archive
          </div>

          <h1 className="font-display text-5xl leading-none tracking-[-0.04em] text-text dark:text-darktext sm:text-6xl">
            Лекции
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted dark:text-darkmuted">
            Аудиоархив исламских знаний.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">
              <Headphones size={16} />
              <span>{lectureData.length} лекций в архиве</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => window.location.hash = '#/catalog'}
              className="rounded-full bg-[#111820] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 dark:bg-[#F5F5F5] dark:text-[#111820]"
            >
              Перейти в каталог
            </button>
            <button
              onClick={() => window.location.hash = '#/library'}
              className="rounded-full border border-black/5 bg-white px-5 py-3 text-sm font-medium text-text transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#101010] dark:text-darktext"
            >
              Моя библиотека
            </button>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Популярные темы</div>
          </div>

          <div className="mt-6 space-y-3">
            {categoryStats.map((item) => (
              <button
                key={item.label}
                onClick={() => window.location.hash = `#/category/${encodeURIComponent(item.label)}`}
                className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 text-left transition hover:translate-x-0.5 dark:border-white/10 dark:bg-[#161616]"
              >
                <span className="text-sm font-medium text-text dark:text-darktext">{item.label}</span>
                <span className="text-xs text-muted dark:text-darkmuted">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Записей в архиве', value: String(lectureData.length) },
          { label: 'Учебных циклов', value: String(cycles.length) },
          { label: 'Категорий знания', value: String(categoryStats.length) }
        ].map((stat) => (
          <div key={stat.label} className="panel p-5">
            <div className="text-sm text-muted dark:text-darkmuted">{stat.label}</div>
            <div className="mt-3 font-display text-3xl tracking-[-0.03em] text-text dark:text-darktext">{stat.value}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Новые лекции</h2>
          <button onClick={() => window.location.hash = '#/catalog'} className="text-sm font-medium text-accent dark:text-darkaccent">
            Смотреть все
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {latestLectures.map((lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              onOpen={() => onOpenLecture(lecture.id)}
              isFavorite={favorites.includes(lecture.id)}
              onToggleFavorite={() => onToggleFavorite(lecture.id)}
              progress={getProgress(lecture.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Личная полка</div>
            <h2 className="mt-1 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Продолжить прослушивание</h2>
          </div>
          <button onClick={() => window.location.hash = '#/library'} className="text-sm font-medium text-accent dark:text-darkaccent">Открыть библиотеку</button>
        </div>
        {continueLectures.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {continueLectures.slice(0, 2).map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={favorites.includes(lecture.id)} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted dark:text-darkmuted">Начните слушать любую лекцию — архив запомнит позицию и вернёт вас сюда.</p>
            <button onClick={() => window.location.hash = '#/catalog'} className="shrink-0 rounded-full bg-[#111820] px-4 py-2 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Открыть каталог</button>
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Учебные циклы</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cycles.map((cycle) => (
            <button key={cycle.id} onClick={() => window.location.hash = `#/cycle/${cycle.id}`} className="panel overflow-hidden p-0 text-left">
              <div className={`h-28 bg-gradient-to-br ${cycle.coverTone}`} />
              <div className="p-5">
                <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">{cycle.author}</div>
                <h3 className="mt-3 font-display text-2xl leading-tight text-text dark:text-darktext">{cycle.title}</h3>
                <p className="mt-2 text-sm text-muted dark:text-darkmuted">{cycle.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-text dark:text-darktext">{cycle.totalLessons} уроков</span>
                  <span className="text-muted dark:text-darkmuted">{formatDuration(cycle.totalDuration)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function CatalogPage({
  lectures,
  search,
  setSearch,
  sort,
  setSort,
  categoryFilter,
  setCategoryFilter,
  authorFilter,
  setAuthorFilter,
  uniqueAuthors,
  categories,
  favorites,
  onToggleFavorite,
  onOpenLecture,
  getProgress,
  highlightQuery
}: {
  lectures: Lecture[];
  search: string;
  setSearch: (value: string) => void;
  sort: SortType;
  setSort: (value: SortType) => void;
  categoryFilter: Category | 'Все';
  setCategoryFilter: (value: Category | 'Все') => void;
  authorFilter: string;
  setAuthorFilter: (value: string) => void;
  uniqueAuthors: string[];
  categories: Category[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  getProgress: (id: string) => number;
  highlightQuery: string;
}) {
  return (
    <main className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Каталог</div>
            <h1 className="mt-2 font-display text-4xl leading-none tracking-[-0.04em] text-text dark:text-darktext">Лекции</h1>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти лекцию, шейха или тему…"
              className="w-full bg-transparent outline-none placeholder:text-muted dark:placeholder:text-darkmuted md:w-72"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
            <div className="mb-2 text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Категория</div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | 'Все')}
              className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext"
            >
              <option value="Все">Все</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
            <div className="mb-2 text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Автор</div>
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext"
            >
              {uniqueAuthors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
            <div className="mb-2 text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Сортировка</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
              className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext"
            >
              <option value="newest">Последние добавленные</option>
              <option value="title">По названию</option>
              <option value="author">По автору</option>
              <option value="duration">По продолжительности</option>
            </select>
          </div>
        </div>
      </section>

      {search.trim() && (
        <div className="flex flex-col gap-1 text-sm text-muted dark:text-darkmuted sm:flex-row sm:items-center sm:justify-between">
          <span>Найдено лекций: <strong className="font-medium text-text dark:text-darktext">{lectures.length}</strong></span>
          <span>Поиск по названию, автору, циклу, описанию, тегам и имени файла</span>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lectures.length ? (
          lectures.map((lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              onOpen={() => onOpenLecture(lecture.id)}
              isFavorite={favorites.includes(lecture.id)}
              onToggleFavorite={() => onToggleFavorite(lecture.id)}
              progress={getProgress(lecture.id)}
              highlightQuery={highlightQuery}
            />
          ))
        ) : (
          <div className="panel col-span-full p-8 text-center">
            <div className="font-display text-2xl">Ничего не найдено</div>
            <p className="mt-2 text-sm text-muted dark:text-darkmuted">Попробуйте изменить поисковый запрос или фильтры.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function CyclePage({ cycle, lectures, favorites, onToggleFavorite, onOpenLecture, getProgress }: {
  cycle: { id: string; title: string; author: string; authorId: string; description: string; totalLessons: number; totalDuration: number; coverTone: string };
  lectures: Lecture[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  getProgress: (id: string) => number;
}) {
  const listenedCount = lectures.filter((lecture) => getProgress(lecture.id) > 10).length;
  const book = bookData.find((item) => item.cycleId === cycle.id);
  return (
    <main className="space-y-6">
      <section className="panel overflow-hidden p-0">
        <div className={`h-48 bg-gradient-to-br ${cycle.coverTone}`} />
        <div className="p-6">
          <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">{cycle.author}</div>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">{cycle.title}</h1>
          <p className="mt-4 max-w-3xl text-sm text-muted dark:text-darkmuted">{cycle.description}</p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]">
              {cycle.totalLessons} уроков
            </div>
            <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]">
              {formatDuration(cycle.totalDuration)}
            </div>
            <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]">
              Прослушано: {listenedCount}/{cycle.totalLessons}
            </div>
          </div>
          {book && <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full border border-[#B8874A]/30 bg-[#B8874A]/10 px-4 py-2 text-sm font-medium text-[#8C5B22] transition hover:-translate-y-0.5 dark:border-[#E0821E]/30 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">Открыть книгу PDF</a>}
        </div>
      </section>

      <section className="space-y-3">
        {lectures.map((lecture, index) => (
          <div key={lecture.id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#111820] text-sm font-semibold text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
                {index + 1}
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Урок {lecture.lessonNumber}</div>
                <button onClick={() => onOpenLecture(lecture.id)} className="mt-1 text-left font-medium text-text dark:text-darktext">
                  {lecture.title}
                </button>
                <div className="mt-1 text-sm text-muted dark:text-darkmuted">
                  {lecture.category} · {formatDuration(lecture.duration)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-full border border-black/5 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#101010]" onClick={() => onToggleFavorite(lecture.id)}>
                {favorites.includes(lecture.id) ? 'В избранном' : 'В избранное'}
              </button>
              <button onClick={() => onOpenLecture(lecture.id)} className="rounded-full bg-[#111820] px-4 py-2 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
                Открыть
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function AuthorPage({ author, lectures, favorites, onToggleFavorite, onOpenLecture, getProgress }: {
  author: { id: string; name: string; bio: string };
  lectures: Lecture[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  getProgress: (id: string) => number;
}) {
  const categories = [...new Set(lectures.map((lecture) => lecture.category))];

  return (
    <main className="space-y-6">
      <section className="panel p-6">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Автор</div>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">{author.name}</h1>
        <p className="mt-4 max-w-3xl text-sm text-muted dark:text-darkmuted">{author.bio}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm dark:border-white/10 dark:bg-[#161616]">
            {lectures.length} лекций
          </div>
          <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm dark:border-white/10 dark:bg-[#161616]">
            {new Set(lectures.map((lecture) => lecture.cycle)).size} циклов
          </div>
          <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm dark:border-white/10 dark:bg-[#161616]">
            {categories.length} категорий
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lectures.map((lecture) => (
          <LectureCard
            key={lecture.id}
            lecture={lecture}
            onOpen={() => onOpenLecture(lecture.id)}
            isFavorite={favorites.includes(lecture.id)}
            onToggleFavorite={() => onToggleFavorite(lecture.id)}
            progress={getProgress(lecture.id)}
          />
        ))}
      </section>
    </main>
  );
}

function LecturePage({ lecture, favorites, onToggleFavorite, onOpenLecture, currentLectureId, setCurrentLectureId, playerState, setPlayerState, audioRef, prevLecture, nextLecture, onSeek, onTogglePlay, handleTimeUpdate, handleLoadedMetadata, handleEnded, getProgress, bookmarks, onAddBookmark, onRemoveBookmark, onUpdateBookmarkNote, onUpdateBookmarkTags, onExportText, onExportPdf, repeatSegment, onSetRepeatPoint, onClearRepeat, repeatLesson, onToggleRepeatLesson }: {
  lecture: Lecture;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  currentLectureId: string | null;
  setCurrentLectureId: (id: string) => void;
  playerState: { isPlaying: boolean; currentTime: number; duration: number; rate: number; sleepMinutes: number };
  setPlayerState: Dispatch<SetStateAction<{ isPlaying: boolean; currentTime: number; duration: number; rate: number; sleepMinutes: number; volume: number }>>;
  audioRef: RefObject<HTMLAudioElement>;
  prevLecture: () => void;
  nextLecture: () => void;
  onSeek: (value: number) => void;
  onTogglePlay: () => void;
  handleTimeUpdate: () => void;
  handleLoadedMetadata: () => void;
  handleEnded: () => void;
  getProgress: (id: string) => number;
  bookmarks: BookmarkItem[];
  onAddBookmark: () => void;
  onRemoveBookmark: (id: string) => void;
  onUpdateBookmarkNote: (id: string, note: string) => void;
  onUpdateBookmarkTags: (id: string, value: string) => void;
  onExportText: (items: BookmarkItem[]) => void;
  onExportPdf: (items: BookmarkItem[]) => void;
  repeatSegment: { start: number | null; end: number | null; active: boolean };
  onSetRepeatPoint: () => void;
  onClearRepeat: () => void;
  repeatLesson: boolean;
  onToggleRepeatLesson: () => void;
}) {
  const cycleLectures = lectureData.filter((item) => item.cycleId === lecture.cycleId);
  const progress = getProgress(lecture.id);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => readQuizQuestions(lecture.id));
  const [quizMode, setQuizMode] = useState<'take' | 'create'>('take');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftOptions, setDraftOptions] = useState(['', '', '', '']);
  const [draftCorrect, setDraftCorrect] = useState(0);

  useEffect(() => {
    setQuizQuestions(readQuizQuestions(lecture.id));
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizMode('take');
  }, [lecture.id]);

  useEffect(() => {
    localStorage.setItem(`affn-quiz-${lecture.id}`, JSON.stringify(quizQuestions));
  }, [lecture.id, quizQuestions]);

  const addQuizQuestion = () => {
    const options = draftOptions.map((option) => option.trim()).filter(Boolean);
    if (!draftPrompt.trim() || options.length < 2 || draftCorrect >= options.length) return;
    setQuizQuestions((prev) => [...prev, { id: `${lecture.id}-${Date.now()}`, prompt: draftPrompt.trim(), options, correctIndex: draftCorrect }]);
    setDraftPrompt('');
    setDraftOptions(['', '', '', '']);
    setDraftCorrect(0);
  };

  const removeQuizQuestion = (id: string) => setQuizQuestions((prev) => prev.filter((question) => question.id !== id));
  const quizScore = quizQuestions.reduce((score, question) => score + (quizAnswers[question.id] === question.correctIndex ? 1 : 0), 0);

  return (
    <main className="space-y-6">
      <section className="panel p-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">{lecture.category}</div>
            <h1 className="mt-3 font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">{lecture.title}</h1>
            <p className="mt-4 max-w-2xl text-base text-muted dark:text-darkmuted">{lecture.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted dark:text-darkmuted">
              <span>{lecture.author}</span>
              <span>•</span>
              <span>{lecture.cycle}</span>
              <span>•</span>
              <span>{formatDuration(lecture.duration)}</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={onTogglePlay} className="rounded-full bg-[#111820] px-5 py-3 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
                {playerState.isPlaying ? 'Пауза' : 'Слушать'}
              </button>
              <button onClick={() => onToggleFavorite(lecture.id)} className="rounded-full border border-black/5 bg-white px-5 py-3 text-sm dark:border-white/10 dark:bg-[#101010]">
                {favorites.includes(lecture.id) ? 'Удалить из избранного' : 'В избранное'}
              </button>
              {lecture.sourceUrl && (
                <a href={lecture.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-black/5 bg-white px-5 py-3 text-sm dark:border-white/10 dark:bg-[#101010]">
                  Открыть источник
                </a>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-[#F7F9FC] p-4 dark:border-white/10 dark:bg-[#171717]">
            <div className="mb-4 flex items-center justify-between text-sm text-muted dark:text-darkmuted">
              <span>Состояние</span>
              <span>{progress > 10 ? 'Возобновить' : 'Начать'}</span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#101010]">
                <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Позиция</div>
                <div className="mt-1 font-display text-3xl text-text dark:text-darktext">{formatDuration(playerState.currentTime)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Позиция воспроизведения</label>
                <input type="range" min={0} max={playerState.duration || lecture.duration} value={playerState.currentTime} onChange={(e) => onSeek(Number(e.target.value))} className="w-full accent-[#B8874A] dark:accent-[#E0821E]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Плеер</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted dark:text-darkmuted">{playerState.currentTime ? formatDuration(playerState.currentTime) : '00:00'}</span>
            <span className="text-muted dark:text-darkmuted">/</span>
            <span className="text-sm text-muted dark:text-darkmuted">{formatDuration(playerState.duration || lecture.duration)}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevLecture} className="icon-button"><SkipBack size={18} /></button>
            <button onClick={onTogglePlay} className="icon-button bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]">{playerState.isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
            <button onClick={nextLecture} className="icon-button"><SkipForward size={18} /></button>
          </div>

          <div className="flex items-center gap-2">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <button key={rate} onClick={() => setPlayerState((prev) => ({ ...prev, rate }))} className={`rounded-full px-3 py-1.5 text-sm ${playerState.rate === rate ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'bg-[#F7F9FC] text-text dark:bg-[#161616] dark:text-darktext'}`}>
                {rate}x
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[15, 30, 45, 60].map((minutes) => (
              <button key={minutes} aria-label={`Таймер сна ${minutes} минут`} onClick={() => setPlayerState((prev) => ({ ...prev, sleepMinutes: prev.sleepMinutes === minutes ? 0 : minutes }))} className={`rounded-full px-3 py-1.5 text-sm ${playerState.sleepMinutes === minutes ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'bg-[#F7F9FC] text-text dark:bg-[#161616] dark:text-darktext'}`}>
                {minutes}м
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/5 pt-4 dark:border-white/10">
          <button onClick={onAddBookmark} className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><Bookmark size={15} /> Закладка на {formatDuration(playerState.currentTime)}</button>
          <button onClick={onSetRepeatPoint} className={`rounded-full px-3 py-2 text-sm ${repeatSegment.start !== null && repeatSegment.end === null ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'border border-black/5 bg-[#F7F9FC] text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext'}`}>A: {repeatSegment.start === null ? '—' : formatDuration(repeatSegment.start)}</button>
          <button onClick={onSetRepeatPoint} disabled={repeatSegment.start === null} className={`rounded-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${repeatSegment.active ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'border border-black/5 bg-[#F7F9FC] text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext'}`}>B: {repeatSegment.end === null ? '—' : formatDuration(repeatSegment.end)}</button>
          {(repeatSegment.start !== null || repeatSegment.end !== null) && <button onClick={onClearRepeat} className="rounded-full px-3 py-2 text-sm text-muted underline underline-offset-4 dark:text-darkmuted">Сбросить A–B</button>}
          <button onClick={onToggleRepeatLesson} className={`rounded-full px-3 py-2 text-sm ${repeatLesson ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'border border-black/5 bg-[#F7F9FC] text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext'}`}>Повтор урока</button>
        </div>

        {bookmarks.length > 0 && (
          <div className="mt-4 rounded-2xl border border-black/5 bg-[#F7F9FC] p-4 dark:border-white/10 dark:bg-[#161616]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Закладки этой лекции</div>
              <div className="flex items-center gap-2">
                <button onClick={() => onExportText(bookmarks)} className="inline-flex items-center gap-1 rounded-full border border-black/5 px-2.5 py-1.5 text-xs text-muted dark:border-white/10 dark:text-darkmuted"><Download size={13} /> TXT</button>
                <button onClick={() => onExportPdf(bookmarks)} className="inline-flex items-center gap-1 rounded-full border border-black/5 px-2.5 py-1.5 text-xs text-muted dark:border-white/10 dark:text-darkmuted"><Printer size={13} /> PDF</button>
              </div>
            </div>
            <div className="space-y-3">
              {bookmarks.map((item) => (
                <div key={item.id} className="rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#101010]">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => onSeek(item.time)} className="font-medium text-text underline decoration-[#B8874A]/50 underline-offset-4 dark:text-darktext">{formatDuration(item.time)}</button>
                    <button onClick={() => onRemoveBookmark(item.id)} aria-label={`Удалить закладку ${formatDuration(item.time)}`} className="text-sm text-muted dark:text-darkmuted">Удалить</button>
                  </div>
                  <textarea value={item.note || ''} onChange={(event) => onUpdateBookmarkNote(item.id, event.target.value)} maxLength={500} rows={2} placeholder="Добавить заметку к этому фрагменту…" aria-label={`Заметка к закладке ${formatDuration(item.time)}`} className="mt-2 w-full resize-y rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-text outline-none placeholder:text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darktext dark:placeholder:text-darkmuted" />
                  <input value={(item.tags || []).join(', ')} onChange={(event) => onUpdateBookmarkTags(item.id, event.target.value)} placeholder="Теги через запятую: акыда, повторить" aria-label={`Теги к закладке ${formatDuration(item.time)}`} className="mt-2 w-full rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-xs text-text outline-none placeholder:text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darktext dark:placeholder:text-darkmuted" />
                  {!!item.tags?.length && <div className="mt-2 flex flex-wrap gap-1.5">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-[#B8874A]/10 px-2 py-1 text-[11px] text-[#8A612E] dark:bg-[#E0821E]/10 dark:text-[#E5A35B]">#{tag}</span>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Самопроверка</div><h2 className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Тест по лекции</h2><p className="mt-2 text-sm leading-6 text-muted dark:text-darkmuted">Создайте вопросы по материалу лекции и пройдите их позже без подключения к сети.</p></div>
          <div className="flex shrink-0 gap-2"><button onClick={() => { setQuizMode('take'); setQuizSubmitted(false); }} className={`rounded-full px-3 py-2 text-xs ${quizMode === 'take' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/5 text-muted dark:border-white/10 dark:text-darkmuted'}`}>Пройти</button><button onClick={() => setQuizMode('create')} className={`rounded-full px-3 py-2 text-xs ${quizMode === 'create' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/5 text-muted dark:border-white/10 dark:text-darkmuted'}`}>Создать</button></div>
        </div>

        {quizMode === 'create' ? (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-text dark:text-darktext">Вопрос<input value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} placeholder="Что важно запомнить из лекции?" className="mt-2 w-full rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 py-3 font-normal outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext" /></label>
            <div className="grid gap-2 sm:grid-cols-2">{draftOptions.map((option, index) => <label key={index} className="text-xs text-muted dark:text-darkmuted">Вариант {index + 1}<input value={option} onChange={(event) => setDraftOptions((prev) => prev.map((value, optionIndex) => optionIndex === index ? event.target.value : value))} placeholder={`Вариант ${index + 1}`} className="mt-1 w-full rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext" /></label>)}</div>
            <label className="block text-xs text-muted dark:text-darkmuted">Правильный вариант<select value={draftCorrect} onChange={(event) => setDraftCorrect(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext">{draftOptions.map((_, index) => <option key={index} value={index}>Вариант {index + 1}</option>)}</select></label>
            <button onClick={addQuizQuestion} disabled={!draftPrompt.trim() || draftOptions.filter(Boolean).length < 2} className="rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#F5F5F5] dark:text-[#111820]">Добавить вопрос</button>
            {!!quizQuestions.length && <div className="space-y-2 border-t border-black/5 pt-4 dark:border-white/10">{quizQuestions.map((question, index) => <div key={question.id} className="flex items-start justify-between gap-3 rounded-2xl bg-[#F7F9FC] p-3 dark:bg-[#161616]"><div className="text-sm text-text dark:text-darktext"><span className="mr-2 text-muted dark:text-darkmuted">{index + 1}.</span>{question.prompt}<div className="mt-1 text-xs text-muted dark:text-darkmuted">{question.options.length} варианта ответа</div></div><button onClick={() => removeQuizQuestion(question.id)} className="text-xs text-muted dark:text-darkmuted">Удалить</button></div>)}</div>}
          </div>
        ) : quizQuestions.length ? (
          <div className="mt-5 space-y-4">{quizQuestions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-black/5 p-4 dark:border-white/10"><legend className="max-w-full px-1 text-sm font-medium text-text dark:text-darktext">{index + 1}. {question.prompt}</legend><div className="mt-3 space-y-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ${quizSubmitted && optionIndex === question.correctIndex ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : quizSubmitted && quizAnswers[question.id] === optionIndex ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-[#F7F9FC] text-text dark:bg-[#161616] dark:text-darktext'}`}><input type="radio" name={question.id} checked={quizAnswers[question.id] === optionIndex} onChange={() => { setQuizAnswers((prev) => ({ ...prev, [question.id]: optionIndex })); setQuizSubmitted(false); }} />{option}</label>)}</div></fieldset>)}<div className="flex flex-wrap items-center gap-3"><button onClick={() => setQuizSubmitted(true)} disabled={Object.keys(quizAnswers).length < quizQuestions.length} className="rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#F5F5F5] dark:text-[#111820]">Проверить ответы</button>{quizSubmitted && <span className="text-sm font-medium text-text dark:text-darktext">Результат: {quizScore}/{quizQuestions.length}</span>}</div></div>
        ) : <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-5 text-sm leading-6 text-muted dark:bg-[#161616] dark:text-darkmuted">Пока нет вопросов. Переключитесь на «Создать», чтобы составить тест по прослушанному материалу.</div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="mb-4 text-sm uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Следующие уроки цикла</div>
          <div className="space-y-3">
            {cycleLectures.map((cycleLecture) => (
              <button key={cycleLecture.id} onClick={() => onOpenLecture(cycleLecture.id)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left ${circleCurrentCheck(cycleLecture.id, lecture.id) ? 'border-[#B8874A]/30 bg-[#B8874A]/5 dark:border-[#E0821E]/30 dark:bg-[#E0821E]/5' : 'border-black/5 bg-[#F7F9FC] dark:border-white/10 dark:bg-[#161616]'}`}>
                <div>
                  <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Урок {cycleLecture.lessonNumber}</div>
                  <div className="mt-1 text-sm font-medium text-text dark:text-darktext">{cycleLecture.title}</div>
                </div>
                <div className="text-sm text-muted dark:text-darkmuted">{formatDuration(cycleLecture.duration)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 text-sm uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Сведения</div>
          <div className="space-y-3 text-sm text-muted dark:text-darkmuted">
            <div className="flex items-center justify-between"><span>Автор</span><span className="font-medium text-text dark:text-darktext">{lecture.author}</span></div>
            <div className="flex items-center justify-between"><span>Цикл</span><span className="font-medium text-text dark:text-darktext">{lecture.cycle}</span></div>
            <div className="flex items-center justify-between"><span>Категория</span><span className="font-medium text-text dark:text-darktext">{lecture.category}</span></div>
            <div className="flex items-center justify-between"><span>Дата</span><span className="font-medium text-text dark:text-darktext">{lecture.date}</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function CategoryPage({ category, lectures, favorites, onToggleFavorite, onOpenLecture, getProgress }: {
  category: Category;
  lectures: Lecture[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  getProgress: (id: string) => number;
}) {
  return (
    <main className="space-y-6">
      <section className="panel p-6">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Категория</div>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">{category}</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lectures.length ? (
          lectures.map((lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              onOpen={() => onOpenLecture(lecture.id)}
              isFavorite={favorites.includes(lecture.id)}
              onToggleFavorite={() => onToggleFavorite(lecture.id)}
              progress={getProgress(lecture.id)}
            />
          ))
        ) : (
          <div className="panel col-span-full p-8 text-center">
            <div className="font-display text-2xl">Пустая категория</div>
            <p className="mt-2 text-sm text-muted dark:text-darkmuted">В этой категории пока нет материалов.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function LibraryPage({ continueLectures, favoriteLectures, recentLectures, onOpenLecture, onToggleFavorite, favorites, getProgress, cloudReady, cloudEnabled, authSession, onOpenAuth, onSignOut, bookmarks, onExportAllText, onExportAllPdf, librarySearch, setLibrarySearch, librarySearchType, setLibrarySearchType, librarySearchSort, setLibrarySearchSort }: {
  continueLectures: Lecture[];
  favoriteLectures: Lecture[];
  recentLectures: Lecture[];
  onOpenLecture: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  getProgress: (id: string) => number;
  cloudReady: boolean;
  cloudEnabled: boolean;
  authSession: Session | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  bookmarks: BookmarkItem[];
  onExportAllText: () => void;
  onExportAllPdf: () => void;
  librarySearch: string;
  setLibrarySearch: (value: string) => void;
  librarySearchType: LibrarySearchType;
  setLibrarySearchType: (value: LibrarySearchType) => void;
  librarySearchSort: LibrarySearchSort;
  setLibrarySearchSort: (value: LibrarySearchSort) => void;
}) {
  const normalizedSearch = librarySearch.trim().toLowerCase();
  const [selectedTag, setSelectedTag] = useState('all');
  const availableTags = Array.from(new Set(bookmarks.flatMap((item) => item.tags || []))).sort((a, b) => a.localeCompare(b, 'ru'));
  const matchingBookmarks = bookmarks.map((item) => ({ item, lecture: getLectureById(item.lectureId) })).filter((entry): entry is { item: BookmarkItem; lecture: Lecture } => Boolean(entry.lecture)).filter(({ item, lecture }) => {
    const haystack = [lecture.title, lecture.author, lecture.cycle, formatDuration(item.time), item.note || '', ...(item.tags || [])].join(' ').toLowerCase();
    const typeMatches = librarySearchType === 'all' || (librarySearchType === 'note' ? Boolean(item.note?.trim()) : !item.note?.trim());
    const tagMatches = selectedTag === 'all' || (item.tags || []).includes(selectedTag);
    return typeMatches && tagMatches && (!normalizedSearch || haystack.includes(normalizedSearch));
  }).sort((a, b) => {
    const difference = new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
    return librarySearchSort === 'newest' ? -difference : difference;
  });

  return (
    <main className="space-y-6">
      <section className="panel p-6">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Личный раздел</div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">Моя библиотека</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit items-center rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-1.5 text-xs text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">{cloudEnabled && cloudReady ? 'Синхронизация включена' : 'Сохранение на устройстве'}</span>
            {authSession?.user.email ? <button onClick={onSignOut} className="rounded-full border border-black/5 px-3 py-1.5 text-xs text-muted dark:border-white/10 dark:text-darkmuted">Выйти</button> : <button onClick={onOpenAuth} disabled={!cloudEnabled} className="rounded-full bg-[#111820] px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">Сохранить в облако</button>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><div className="text-sm text-muted dark:text-darkmuted">Продолжить прослушивание</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{continueLectures.length}</div></div>
        <div className="panel p-5"><div className="text-sm text-muted dark:text-darkmuted">Избранные лекции</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{favoriteLectures.length}</div></div>
        <div className="panel p-5"><div className="text-sm text-muted dark:text-darkmuted">Последние открытые</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{recentLectures.length}</div></div>
      </section>

      <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-sm font-medium text-text dark:text-darktext">Экспорт библиотеки</div><p className="mt-1 text-sm text-muted dark:text-darkmuted">Все закладки и заметки со всех лекций: {bookmarks.length}</p></div>
        <div className="flex shrink-0 gap-2"><button disabled={!bookmarks.length} onClick={onExportAllText} className="inline-flex items-center gap-1 rounded-full border border-black/5 px-3 py-2 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-darkmuted">TXT</button><button disabled={!bookmarks.length} onClick={onExportAllPdf} className="inline-flex items-center gap-1 rounded-full border border-black/5 px-3 py-2 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-darkmuted">PDF</button></div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row"><div className="flex flex-1 items-center gap-2 rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 py-3 dark:border-white/10 dark:bg-[#161616]"><Search size={16} className="text-muted dark:text-darkmuted" /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Найти в заметках и закладках…" aria-label="Поиск по сохранённым заметкам и закладкам" className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted dark:text-darktext dark:placeholder:text-darkmuted" /></div><select value={librarySearchType} onChange={(event) => setLibrarySearchType(event.target.value as LibrarySearchType)} aria-label="Тип сохранённой записи" className="rounded-2xl border border-black/5 bg-[#F7F9FC] px-3 py-3 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><option value="all">Все типы</option><option value="note">Только заметки</option><option value="bookmark">Только закладки</option></select><select value={librarySearchSort} onChange={(event) => setLibrarySearchSort(event.target.value as LibrarySearchSort)} aria-label="Сортировка сохранённых записей" className="rounded-2xl border border-black/5 bg-[#F7F9FC] px-3 py-3 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select>{availableTags.length > 0 && <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} aria-label="Фильтр по тегу" className="rounded-2xl border border-black/5 bg-[#F7F9FC] px-3 py-3 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><option value="all">Все теги</option>{availableTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}</select>}</div>
        {(normalizedSearch || librarySearchType !== 'all' || selectedTag !== 'all') && <div className="mt-4 space-y-3"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Найдено: {matchingBookmarks.length} · {librarySearchType === 'all' ? 'все типы' : librarySearchType === 'note' ? 'заметки' : 'закладки'}{selectedTag !== 'all' ? ` · #${selectedTag}` : ''}</div>{matchingBookmarks.length ? matchingBookmarks.map(({ item, lecture }) => <button key={item.id} onClick={() => onOpenLecture(lecture.id)} className="block w-full rounded-2xl border border-black/5 bg-[#F7F9FC] p-4 text-left transition hover:border-[#B8874A]/40 dark:border-white/10 dark:bg-[#161616]"><div className="flex items-center justify-between gap-3"><div className="font-medium text-text dark:text-darktext"><HighlightedText text={lecture.title} query={librarySearch} /></div><span className="shrink-0 text-right text-sm text-[#9B6D32] dark:text-[#E0821E]"><span className="block">{formatDuration(item.time)}</span><span className="text-[10px] uppercase tracking-[0.1em] text-muted dark:text-darkmuted">{item.note?.trim() ? 'Заметка' : 'Закладка'}</span></span></div><div className="mt-1 text-xs text-muted dark:text-darkmuted"><HighlightedText text={lecture.author} query={librarySearch} /></div>{item.note && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted dark:text-darkmuted"><HighlightedText text={item.note} query={librarySearch} /></p>}{!!item.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-[#B8874A]/10 px-2 py-1 text-[11px] text-[#8A612E] dark:bg-[#E0821E]/10 dark:text-[#E5A35B]">#{tag}</span>)}</div>}</button>) : <div className="rounded-2xl bg-[#F7F9FC] p-4 text-sm text-muted dark:bg-[#161616] dark:text-darkmuted">В сохранённых заметках и закладках ничего не найдено.</div>}</div>}
      </section>

      <section className="space-y-4">
        <div className="mb-3 text-sm uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Продолжить</div>
        {continueLectures.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {continueLectures.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={favorites.includes(lecture.id)} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted dark:text-darkmuted">Пока нет сохранённых мест прослушивания.</div>
        )}
      </section>

      <section className="space-y-4">
        <div className="mb-3 text-sm uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Избранное</div>
        {favoriteLectures.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favoriteLectures.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={true} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted dark:text-darkmuted">У вас пока нет избранных лекций.</div>
        )}
      </section>

      <section className="space-y-4">
        <div className="mb-3 text-sm uppercase tracking-[0.12em] text-muted dark:text-darkmuted">История</div>
        {recentLectures.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentLectures.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={favorites.includes(lecture.id)} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted dark:text-darkmuted">История прослушивания пока пуста.</div>
        )}
      </section>
    </main>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));
  return <>{parts.map((part, index) => part.toLowerCase() === normalizedQuery.toLowerCase() ? <mark key={`${part}-${index}`} className="search-highlight">{part}</mark> : part)}</>;
}

function LectureCard({ lecture, onOpen, isFavorite, onToggleFavorite, progress, highlightQuery }: {
  lecture: Lecture;
  onOpen: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  progress: number;
  highlightQuery?: string;
}) {
  return (
    <article className="panel group p-0">
      <div onClick={onOpen} className="cursor-pointer p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted"><HighlightedText text={lecture.category} query={highlightQuery || ''} /></div>
            <h3 className="mt-2 font-display text-2xl leading-tight text-text dark:text-darktext"><HighlightedText text={lecture.title} query={highlightQuery || ''} /></h3>
          </div>

          <button className="rounded-full border border-black/5 bg-white p-2 text-sm dark:border-white/10 dark:bg-[#101010]" onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} aria-label="Toggle favorite">
            <Heart size={15} fill={isFavorite ? '#B8874A' : 'none'} className={isFavorite ? 'text-[#B8874A]' : 'text-muted dark:text-darkmuted'} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted dark:text-darkmuted">
          <span><HighlightedText text={lecture.author} query={highlightQuery || ''} /></span>
          <span><HighlightedText text={lecture.cycle} query={highlightQuery || ''} /></span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted dark:text-darkmuted">
          <div className="flex items-center gap-1"><BookOpenText size={13} /> Урок {lecture.lessonNumber}</div>
          <div className="flex items-center justify-end gap-1"><Clock3 size={13} /> {formatDuration(lecture.duration)}</div>
        </div>

        <p className="mt-4 text-sm text-muted dark:text-darkmuted"><HighlightedText text={lecture.description} query={highlightQuery || ''} /></p>

        {progress > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">
              <span>Прогресс</span>
              <span>{Math.round((progress / lecture.duration) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#E6EBF2] dark:bg-[#202020]">
              <div className="h-full rounded-full bg-[#B8874A] dark:bg-[#E0821E]" style={{ width: `${Math.min(100, (progress / lecture.duration) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted dark:text-darkmuted">{lecture.date}</span>
          <button onClick={(event) => { event.stopPropagation(); onOpen(); }} className="inline-flex items-center gap-2 rounded-full bg-[#111820] px-3 py-2 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
            Открыть <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function MiniPlayer({ lecture, isPlaying, currentTime, duration, rate, setRate, volume, setVolume, onTogglePlay, onPrev, onNext, onSeek, sleepMinutes, setSleepMinutes }: {
  lecture: Lecture | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  setRate: (value: number) => void;
  volume: number;
  setVolume: (value: number) => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (value: number) => void;
  sleepMinutes: number;
  setSleepMinutes: (value: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const touchStart = useRef<{ x: number; y: number; blocked: boolean } | null>(null);
  if (!lecture) return null;

  if (collapsed) {
    return (
      <div className="fixed bottom-32 right-3 z-50 md:bottom-3 md:right-5">
        <button onClick={() => setCollapsed(false)} aria-label="Показать аудиоплеер" title="Показать аудиоплеер" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-black/5 bg-white/95 px-4 py-3 text-sm font-medium text-text shadow-[0_12px_40px_rgba(17,24,32,0.2)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#101010]/95 dark:text-darktext">
          <ChevronUp size={17} aria-hidden="true" />
          Плеер
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-5"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        const target = event.target;
        const blocked = target instanceof Element && Boolean(target.closest('button, input, select, label'));
        touchStart.current = touch ? { x: touch.clientX, y: touch.clientY, blocked } : null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const touch = event.changedTouches[0];
        touchStart.current = null;
        if (!start || !touch || start.blocked) return;
        const deltaY = touch.clientY - start.y;
        const deltaX = touch.clientX - start.x;
        const horizontalDistance = Math.abs(deltaX);
        const verticalDistance = Math.abs(deltaY);
        if (horizontalDistance > 64 && horizontalDistance > verticalDistance * 1.2) {
          if (deltaX < 0) onNext();
          else onPrev();
          return;
        }
        if (deltaY > 64 && deltaY > horizontalDistance * 1.2) setCollapsed(true);
      }}
      onTouchCancel={() => { touchStart.current = null; }}
    >
      <div className="mx-auto max-w-[1360px] rounded-[28px] border border-black/5 bg-white/90 p-3 shadow-[0_18px_60px_rgba(17,24,32,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101010]/90">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
              <div className="flex h-5 items-end gap-0.5" aria-label={isPlaying ? 'Воспроизведение' : 'Пауза'} role="img">
                {[3, 7, 11, 6, 14, 9, 5, 12].map((height, index) => (
                  <span key={index} className={`wave-bar w-0.5 rounded-full bg-current ${isPlaying ? 'wave-bar-active' : ''}`} style={{ height: `${height}px`, animationDelay: `${index * 80}ms` }} />
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text dark:text-darktext">{lecture.title}</div>
              <div className="flex items-center gap-2 truncate text-xs text-muted dark:text-darkmuted"><span>{lecture.author}</span><span aria-live="polite">{isPlaying ? 'Воспроизводится' : 'Пауза'}</span></div>
            </div>
            <button onClick={() => setCollapsed(true)} aria-label="Свернуть аудиоплеер" title="Свернуть аудиоплеер" className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/5 bg-[#F7F9FC] text-text transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#161616] dark:text-darktext">
              <ChevronDown size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2 lg:max-w-[640px]">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
            <input type="range" min={0} max={duration || 1} value={currentTime} onChange={(e) => onSeek(Number(e.target.value))} className="w-full accent-[#B8874A] dark:accent-[#E0821E]" />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={onPrev} aria-label="Предыдущая лекция" className="icon-button"><SkipBack size={16} /></button>
            <button onClick={onTogglePlay} aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'} className="icon-button bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]">{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
            <button onClick={onNext} aria-label="Следующая лекция" className="icon-button"><SkipForward size={16} /></button>

            <label className="flex items-center gap-1 rounded-full border border-black/5 bg-[#F7F9FC] px-2 py-2 text-xs dark:border-white/10 dark:bg-[#161616]" title="Громкость">
              <Volume2 size={13} aria-hidden="true" />
              <input aria-label="Громкость" type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-16 accent-[#B8874A] dark:accent-[#E0821E]" />
            </label>

            <select aria-label="Скорость воспроизведения" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="rounded-full border border-black/5 bg-[#F7F9FC] px-2 py-2 text-xs dark:border-white/10 dark:bg-[#161616]">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                <option key={value} value={value}>{value}x</option>
              ))}
            </select>

            <select aria-label="Таймер сна" value={sleepMinutes} onChange={(e) => setSleepMinutes(Number(e.target.value))} className="rounded-full border border-black/5 bg-[#F7F9FC] px-2 py-2 text-xs dark:border-white/10 dark:bg-[#161616]">
              <option value={0}>Без таймера</option>
              <option value={15}>15 мин</option>
              <option value={30}>30 мин</option>
              <option value={45}>45 мин</option>
              <option value={60}>60 мин</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcePage({ resource, onOpenCatalog }: { resource: ResourceType; onOpenCatalog: () => void }) {
  const content: Record<ResourceType, { eyebrow: string; title: string; description: string; note: string }> = {
    books: { eyebrow: 'Библиотека книг', title: 'Книги появятся после проверки прав на распространение.', description: 'Этот раздел подготовлен для PDF-книг, авторов, обложек и истории чтения.', note: 'Пока здесь нет опубликованных книг. Мы не добавляем файлы без подтверждённого разрешения.' },
    texts: { eyebrow: 'Тексты и переводы', title: 'Тексты требуют подтверждённых оригиналов и атрибуции.', description: 'Здесь будут полные тексты, переводы, временные метки и синхронизация с аудио.', note: 'Расшифровки и переводы ещё не опубликованы, поэтому мы не создаём их автоматически без проверки.' },
    dictionary: { eyebrow: 'Терминологический словарь', title: 'Словарь будет связан с реальными материалами архива.', description: 'Для каждой записи будут доступны арабское написание, огласовки, транслитерация, перевод и ссылки.', note: 'В текущем каталоге нет редакционно проверенных словарных записей.' },
    courses: { eyebrow: 'Учебные курсы', title: 'Академия начнётся с проверенных циклов и конспектов.', description: 'Этот раздел станет основой для учебных планов, прогресса, повторения и тестов.', note: 'Тесты и учебные планы не создаются до появления подтверждённых конспектов.' }
  };
  const item = content[resource] || content.books;
  return (
    <main className="space-y-6">
      <section className="panel p-7 sm:p-10">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">{item.eyebrow}</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-none tracking-[-0.04em] text-text dark:text-darktext">{item.title}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted dark:text-darkmuted">{item.description}</p>
      </section>
      <section className="panel flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-sm font-medium text-text dark:text-darktext">Раздел ещё не опубликован</div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">{item.note}</p></div>
        <button onClick={onOpenCatalog} className="shrink-0 rounded-full bg-[#111820] px-5 py-3 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Слушать лекции</button>
      </section>
    </main>
  );
}

function AuthDialog({ email, setEmail, busy, message, onSubmit, onClose }: { email: string; setEmail: (value: string) => void; busy: boolean; message: string; onSubmit: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111820]/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="w-full max-w-md rounded-[28px] border border-black/5 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#101010]">
        <div className="flex items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Постоянный доступ</div><h2 id="auth-title" className="mt-2 font-display text-3xl text-text dark:text-darktext">Сохранить библиотеку</h2></div><button onClick={onClose} aria-label="Закрыть" className="text-2xl text-muted dark:text-darkmuted">×</button></div>
        <p className="mt-4 text-sm leading-6 text-muted dark:text-darkmuted">Укажите email — мы отправим безопасную ссылку входа. Избранное и история сохранятся в постоянном аккаунте.</p>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="mt-5 space-y-3"><label className="block text-sm font-medium text-text dark:text-darktext">Email<input autoFocus type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F9FC] px-4 py-3 outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext" /></label><button disabled={busy} className="w-full rounded-full bg-[#111820] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">{busy ? 'Отправляем…' : 'Отправить ссылку входа'}</button></form>
        {message && <p className="mt-4 rounded-2xl bg-[#F7F9FC] p-3 text-sm leading-6 text-muted dark:bg-[#161616] dark:text-darkmuted">{message}</p>}
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <main className="space-y-6">
      <section className="panel p-7 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_240px]">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">О проекте</div>
            <h1 className="mt-3 max-w-3xl font-display text-5xl leading-none tracking-[-0.04em] text-text dark:text-darktext">Цифровая библиотека, построенная вокруг достоверности.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted dark:text-darkmuted">AL-FIRQA AN-NAJIYA собирает проверяемые аудиоматериалы в спокойную образовательную среду. Мы не публикуем неподтверждённые конспекты, цитаты или статистику активности.</p>
          </div>
          <img src={`${import.meta.env.BASE_URL}logo-full.png`} alt="AL-FIRQA AN-NAJIYA" className="mx-auto max-h-44 w-full object-contain opacity-90" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Архив</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{lectureData.length}</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">опубликованных аудиозаписей</p></div>
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Циклы</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{cycles.length}</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">учебных цикла в каталоге</p></div>
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Фокус</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">Да</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">без фиктивных материалов</p></div>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Что появится дальше</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {['Структурированные конспекты после получения расшифровок', 'Новые книги и тексты — после проверки источника и условий правообладателя', 'Синхронизация заметок и прогресса после подключения Supabase', 'Редакторская проверка AI-черновиков до публикации'].map((item) => (
            <div key={item} className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-4 text-sm leading-6 text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">{item}</div>
          ))}
        </div>
      </section>
    </main>
  );
}

function EmptyState({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="panel p-10 text-center">
      <div className="font-display text-3xl text-text dark:text-darktext">{title}</div>
      <button onClick={onAction} className="mt-4 rounded-full bg-[#111820] px-5 py-3 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
        {actionLabel}
      </button>
    </div>
  );
}

function circleCurrentCheck(id: string, currentId: string) {
  return id === currentId;
}

export default App;
