import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  MessageCircle,
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
import { cycleArchives } from './data/cycle-archives';
import { compareLessonNumbers, cycles, lectureData } from './data/catalog';
import { formatDuration, getLectureTopicTitle, readQuizQuestions } from './lib/lecturePresentation';
import { lectureOutlines } from './data/lecture-outlines';
import type { LearningDashboardSnapshot } from './lib/learningDashboard';
import { buildLearningDashboardSnapshot } from './lib/learningDashboard';
import type { BookmarkItem, Category, HandwritingStroke, Lecture, LectureProgressEntry, QuizQuestion } from './types';
import type { SortType } from './CatalogPage';
import { isSupabaseConfigured } from './lib/supabaseConfig';
import { loadCloudLibrary, loadCloudProgress, saveCloudLibrary, saveCloudProgress } from './lib/cloudLibrary';
import { getAuthSession, requestPersistentAccess, signOutUser, subscribeToAuth } from './lib/auth';
import { createLocalLibraryBackup, MAX_LOCAL_BACKUP_BYTES, parseLocalLibraryBackup } from './lib/localBackup';
import { sanitizeHandwritingStrokes } from './lib/handwriting';
import type { Session } from '@supabase/supabase-js';

const CatalogPage = lazy(() => import('./CatalogPage').then(({ CatalogPage }) => ({ default: CatalogPage })));
const LecturePage = lazy(() => import('./LecturePage').then(({ LecturePage }) => ({ default: LecturePage })));
const BooksPage = lazy(() => import('./CollectionPages').then(({ BooksPage }) => ({ default: BooksPage })));
const CoursesPage = lazy(() => import('./CollectionPages').then(({ CoursesPage }) => ({ default: CoursesPage })));
const KnowledgeMap = lazy(() => import('./KnowledgeMap').then(({ KnowledgeMap }) => ({ default: KnowledgeMap })));
const HandwritingPreview = lazy(() => import('./HandwritingPad').then(({ HandwritingPreview }) => ({ default: HandwritingPreview })));
const LearningDashboard = lazy(() => import('./LearningDashboard').then(({ LearningDashboard }) => ({ default: LearningDashboard })));
const SocialPage = lazy(() => import('./SocialPage').then(({ SocialPage }) => ({ default: SocialPage })));

type Theme = 'light' | 'dark';
type ResourceType = 'books' | 'texts' | 'dictionary' | 'courses';
type LibrarySearchType = 'all' | 'note' | 'bookmark';
type LibrarySearchSort = 'newest' | 'oldest';
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
  'Сира',
  'Манхадж',
  'Разное'
];

const offsetPlaybackTime = (currentTime: number, duration: number, offset: number) =>
  Math.max(0, Math.min(duration > 0 ? duration : Number.POSITIVE_INFINITY, currentTime + offset));

const parseHash = () => {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash || hash === '/') return 'home';
  if (hash.startsWith('/catalog')) return 'catalog';
  if (hash.startsWith('/library')) return 'library';
  if (hash.startsWith('/social')) return 'social';
  if (hash.startsWith('/cycle/')) return 'cycle';
  if (hash.startsWith('/author/')) return 'author';
  if (hash.startsWith('/lecture/')) return 'lecture';
  if (hash.startsWith('/category/')) return 'category';
  if (hash.startsWith('/knowledge')) return 'knowledge';
  if (hash.startsWith('/about')) return 'about';
  if (hash.startsWith('/books') || hash.startsWith('/texts') || hash.startsWith('/dictionary') || hash.startsWith('/courses')) return 'resource';
  return 'home';
};

const additionalCycleIds = [
  'zhizneopisanie-proroka-muhammada',
  'hadis-vysshij-sonm',
  'hadis-abu-bakra',
  'metodologiya-myshleniya-o-realnosti'
] as const;
const isAdditionalCycleId = (id: string) => additionalCycleIds.some((cycleId) => cycleId === id);
const isAdditionalLectureId = (id: string) => additionalCycleIds.some((cycleId) => id.startsWith(`${cycleId}-`));
let additionalLecturesById: Record<string, Lecture> = {};
const getLectureById = (id: string) => additionalLecturesById[id] ?? lectureData.find((lecture) => lecture.id === id);

const readAudioProgressSnapshot = (): Record<string, LectureProgressEntry> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKeys.progress) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, LectureProgressEntry> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as Partial<LectureProgressEntry>;
      if (typeof entry.currentTime !== 'number' || !Number.isFinite(entry.currentTime) || typeof entry.duration !== 'number' || !Number.isFinite(entry.duration) || typeof entry.updatedAt !== 'string') continue;
      result[id] = { currentTime: Math.max(0, entry.currentTime), duration: Math.max(0, entry.duration), updatedAt: entry.updatedAt };
    }
    return result;
  } catch {
    return {};
  }
};

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

const renderHandwritingSvg = (drawing?: HandwritingStroke[]) => {
  const strokes = sanitizeHandwritingStrokes(drawing);
  if (!strokes.length) return '';
  const paths = strokes.map((stroke) => `<path d="${escapeHtml(stroke.path)}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width.toFixed(2)}" stroke-opacity="${(stroke.opacity ?? 1).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<div class="handwriting"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" preserveAspectRatio="none" role="img" aria-label="Рукописная заметка"><rect width="800" height="240" fill="#fffefb"/>${paths}</svg></div>`;
};

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(storageKeys.theme);
    if (saved === 'dark') return 'dark';
    if (saved === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [route, setRoute] = useState<'home' | 'catalog' | 'library' | 'social' | 'cycle' | 'author' | 'lecture' | 'category' | 'knowledge' | 'about' | 'resource'>(() => parseHash());
  const [search, setSearch] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySearchType, setLibrarySearchType] = useState<LibrarySearchType>('all');
  const [librarySearchSort, setLibrarySearchSort] = useState<LibrarySearchSort>('newest');
  const [sort, setSort] = useState<SortType>('newest');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Все'>('Все');
  const [authorFilter, setAuthorFilter] = useState<string>('Все');
  const [cycleFilter, setCycleFilter] = useState<string>('Все');
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
      const routeMatch = window.location.hash.match(/^#\/lecture\/(.+)$/);
      const routeLectureId = routeMatch ? decodeURIComponent(routeMatch[1]) : null;
      if (routeLectureId && (getLectureById(routeLectureId) || isAdditionalLectureId(routeLectureId))) return routeLectureId;
      const saved = localStorage.getItem('affn-current-lecture');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [additionalLectureData, setAdditionalLectureData] = useState<Lecture[] | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKeys.bookmarks) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter((item): item is BookmarkItem => Boolean(item && typeof item === 'object' && !Array.isArray(item))).map((item) => {
        const handwriting = sanitizeHandwritingStrokes((item as BookmarkItem).handwriting);
        return { ...(item as BookmarkItem), ...(handwriting.length ? { handwriting } : { handwriting: undefined }) };
      });
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
  const [backupMessage, setBackupMessage] = useState('');

  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    rate: 1,
    sleepMinutes: 0,
    volume: Number(localStorage.getItem('affn-volume') ?? 1)
  });
  const [audioStatus, setAudioStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [repeatSegment, setRepeatSegment] = useState<{ start: number | null; end: number | null; active: boolean }>({ start: null, end: null, active: false });
  const [repeatLesson, setRepeatLesson] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFallbackAttempted = useRef(false);
  const restoringPosition = useRef(false);
  const handlingTrackEnd = useRef(false);
  const pendingUserLectureNavigation = useRef<string | null>(null);
  const cycleIdFromHash = window.location.hash.match(/^#\/cycle\/([^?]+)/)?.[1] || '';
  const lectureIdFromHash = window.location.hash.match(/^#\/lecture\/([^?]+)/)?.[1] || '';
  const shouldLoadAdditionalLectures = route === 'catalog' || route === 'library' || route === 'author' || route === 'category'
    || (route === 'cycle' && isAdditionalCycleId(cycleIdFromHash))
    || (route === 'lecture' && isAdditionalLectureId(lectureIdFromHash))
    || isAdditionalLectureId(currentLectureId || '')
    || favorites.some((id) => isAdditionalLectureId(id))
    || history.some((id) => isAdditionalLectureId(id))
    || bookmarks.some((item) => isAdditionalLectureId(item.lectureId));

  useEffect(() => {
    if (!shouldLoadAdditionalLectures || additionalLectureData !== null) return;
    let isCurrent = true;
    import('./data/abuyahya-next-additions').then(({ abuyahyaNextLectures }) => {
      if (!isCurrent) return;
      additionalLecturesById = Object.fromEntries(abuyahyaNextLectures.map((lecture) => [lecture.id, lecture]));
      setAdditionalLectureData(abuyahyaNextLectures);
    }).catch(() => {
      if (isCurrent) setAdditionalLectureData([]);
    });
    return () => { isCurrent = false; };
  }, [shouldLoadAdditionalLectures, additionalLectureData]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(storageKeys.theme, theme);
  }, [theme]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = playerState.volume;
    localStorage.setItem('affn-volume', String(playerState.volume));
  }, [playerState.volume]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = parseHash();
      if (nextRoute === 'lecture') {
        const routeMatch = window.location.hash.match(/^#\/lecture\/(.+)$/);
        let lectureId: string | null = null;
        try {
          lectureId = routeMatch ? decodeURIComponent(routeMatch[1]) : null;
        } catch {
          lectureId = null;
        }
        if (lectureId && (getLectureById(lectureId) || isAdditionalLectureId(lectureId))) {
          if (pendingUserLectureNavigation.current === lectureId) {
            pendingUserLectureNavigation.current = null;
          } else if (lectureId !== currentLectureId) {
            setCurrentLectureId(lectureId);
            setPlayerState((prev) => ({ ...prev, isPlaying: false, currentTime: getAudioProgress(lectureId!) }));
          }
        }
      }
      setRoute(nextRoute);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentLectureId]);

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

  const allLectureData = useMemo(
    () => additionalLectureData ? [...lectureData, ...additionalLectureData] : lectureData,
    [additionalLectureData]
  );
  const lectureMap = useMemo(() => {
    const result: Record<string, Lecture> = {};
    allLectureData.forEach((lecture) => (result[lecture.id] = lecture));
    return result;
  }, [allLectureData]);
  const getOrderedCycleLectures = (cycleId: string) => allLectureData
    .filter((lecture) => lecture.cycleId === cycleId)
    .sort((left, right) => compareLessonNumbers(left.lessonNumber, right.lessonNumber));

  const toggleFavorite = (lectureId: string) => {
    setFavorites((prev) => (prev.includes(lectureId) ? prev.filter((id) => id !== lectureId) : [...prev, lectureId]));
  };

  const pushHistory = (lectureId: string) => {
    setHistory((prev) => [lectureId, ...prev.filter((id) => id !== lectureId)].slice(0, 12));
  };

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const uniqueAuthors = ['Все', ...new Set(allLectureData.map((lecture) => lecture.author))];
  const uniqueCycles = ['Все', ...new Set(allLectureData.map((lecture) => lecture.cycle))];

  const visibleLectures = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = [...allLectureData];

    if (categoryFilter !== 'Все') {
      list = list.filter((lecture) => lecture.category === categoryFilter);
    }

    if (authorFilter !== 'Все') {
      list = list.filter((lecture) => lecture.author === authorFilter);
    }

    if (cycleFilter !== 'Все') {
      list = list.filter((lecture) => lecture.cycle === cycleFilter);
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
  }, [search, sort, categoryFilter, authorFilter, cycleFilter, allLectureData]);

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
    audioFallbackAttempted.current = false;
    restoringPosition.current = true;
    setAudioStatus('loading');
    audio.src = lecture.audioUrl;
    audio.load();
  }, [currentLectureId, lectureMap]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    audio.playbackRate = playerState.rate;
    if (playerState.isPlaying && currentLectureId) {
      audio.play().catch(() => {
        setPlayerState((prev) => ({ ...prev, isPlaying: false }));
        setAudioStatus('error');
      });
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

  const retryAudio = () => {
    const audio = audioRef.current;
    if (!audio || !currentLectureId) return;
    setAudioStatus('loading');
    setPlayerState((prev) => ({ ...prev, isPlaying: true }));
    audio.load();
    audio.play().catch(() => {
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
      setAudioStatus('error');
    });
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
    setBookmarks((prev) => [{ id, lectureId: currentLectureId, time, createdAt: new Date().toISOString(), note: prev.find((item) => item.id === id)?.note || '', tags: prev.find((item) => item.id === id)?.tags || [], handwriting: prev.find((item) => item.id === id)?.handwriting || [] }, ...prev.filter((item) => item.id !== id)].slice(0, 100));
  };

  const updateBookmarkNote = (id: string, note: string) => {
    setBookmarks((prev) => prev.map((item) => item.id === id ? { ...item, note } : item));
  };

  const updateBookmarkDrawing = (id: string, handwriting: HandwritingStroke[]) => {
    setBookmarks((prev) => prev.map((item) => item.id === id ? { ...item, handwriting: sanitizeHandwritingStrokes(handwriting) } : item));
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
    const playlist = currentLecture ? getOrderedCycleLectures(currentLecture.cycleId) : allLectureData;
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
    const playlist = currentLecture ? getOrderedCycleLectures(currentLecture.cycleId) : allLectureData;
    const index = playlist.findIndex((lecture) => lecture.id === currentLectureId);
    const prev = playlist[index - 1] || playlist[playlist.length - 1];
    setCurrentLectureId(prev.id);
    setPlayerState((prevState) => ({ ...prevState, isPlaying: true, currentTime: 0 }));
    pushHistory(prev.id);
  };

  const nextLecture = () => {
    if (!currentLectureId) return;
    const playlist = currentLecture ? getOrderedCycleLectures(currentLecture.cycleId) : allLectureData;
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
    const targetHash = `#/lecture/${lectureId}`;
    pendingUserLectureNavigation.current = window.location.hash === targetHash ? null : lectureId;
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
      ...items.flatMap((item, index) => [`${index + 1}. ${formatDuration(item.time)}`, `Теги: ${(item.tags || []).join(', ') || '—'}`, item.note?.trim() || 'Без заметки', ...(item.handwriting?.length ? ['Рукописный рисунок включён в PDF и JSON-резервную копию.'] : []), ''])
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
    const rows = items.map((item) => `<article><h2>${escapeHtml(formatDuration(item.time))}</h2><div class="meta">Теги: ${escapeHtml((item.tags || []).join(', ') || '—')}</div>${renderHandwritingSvg(item.handwriting)}<p>${escapeHtml(item.note?.trim() || 'Без заметки')}</p></article>`).join('');
    popup.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(lecture.title)} — закладки</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111820}h1{font-size:28px;margin-bottom:8px}header{border-bottom:1px solid #ddd;padding-bottom:20px;margin-bottom:24px}article{border:1px solid #ddd;border-radius:14px;padding:16px;margin:12px 0;break-inside:avoid}h2{font-size:18px;margin:0 0 8px;color:#9b6d32}p{white-space:pre-wrap;line-height:1.55;margin:0}.handwriting svg{display:block;width:100%;height:auto;max-height:240px;margin:12px 0;border:1px solid #ddd;border-radius:10px}@media print{body{margin:0 auto}}</style></head><body><header><h1>Закладки и заметки</h1><div>${escapeHtml(lecture.title)}</div><small>${escapeHtml(lecture.author)} · ${escapeHtml(lecture.cycle)}</small></header>${rows || '<p>Закладок пока нет.</p>'}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  };

  const exportAllBookmarksText = () => {
    const entries = bookmarks.map((item) => ({ item, lecture: getLectureById(item.lectureId) })).filter((entry): entry is { item: BookmarkItem; lecture: Lecture } => Boolean(entry.lecture));
    const lines = ['AL-FIRQA AN-NAJIYA', 'Все закладки и заметки', `Экспортировано: ${new Date().toLocaleString('ru-RU')}`, ''];
    entries.forEach(({ item, lecture }, index) => {
      lines.push(`${index + 1}. ${lecture.title}`, `Автор: ${lecture.author}`, `Позиция: ${formatDuration(item.time)}`, `Теги: ${(item.tags || []).join(', ') || '—'}`, item.note?.trim() || 'Без заметки', ...(item.handwriting?.length ? ['Рукописный рисунок включён в PDF и JSON-резервную копию.'] : []), '');
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
    const rows = entries.map(({ item, lecture }) => `<article><h2>${escapeHtml(lecture.title)}</h2><div class="meta">${escapeHtml(lecture.author)} · ${escapeHtml(formatDuration(item.time))} · Теги: ${escapeHtml((item.tags || []).join(', ') || '—')}</div>${renderHandwritingSvg(item.handwriting)}<p>${escapeHtml(item.note?.trim() || 'Без заметки')}</p></article>`).join('');
    popup.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>AL-FIRQA AN-NAJIYA — все заметки</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111820}h1{font-size:28px;margin-bottom:8px}header{border-bottom:1px solid #ddd;padding-bottom:20px;margin-bottom:24px}article{border:1px solid #ddd;border-radius:14px;padding:16px;margin:12px 0;break-inside:avoid}h2{font-size:18px;margin:0 0 8px;color:#9b6d32}.meta{font-size:13px;color:#66717d;margin-bottom:10px}p{white-space:pre-wrap;line-height:1.55;margin:0}.handwriting svg{display:block;width:100%;height:auto;max-height:240px;margin:12px 0;border:1px solid #ddd;border-radius:10px}@media print{body{margin:0 auto}}</style></head><body><header><h1>Все закладки и заметки</h1><div>AL-FIRQA AN-NAJIYA</div><small>Экспортировано: ${escapeHtml(new Date().toLocaleString('ru-RU'))}</small></header>${rows || '<p>Закладок пока нет.</p>'}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  };

  const exportLocalLibraryBackup = () => {
    let progress: Record<string, LectureProgressEntry> = {};
    try {
      const stored = JSON.parse(localStorage.getItem(storageKeys.progress) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) progress = stored as Record<string, LectureProgressEntry>;
    } catch {
      progress = {};
    }

    const quizzes: Record<string, QuizQuestion[]> = {};
    allLectureData.forEach((lecture) => {
      try {
        const raw = localStorage.getItem(`affn-quiz-${lecture.id}`);
        if (!raw) return;
        const stored = JSON.parse(raw);
        if (Array.isArray(stored) && stored.length) quizzes[lecture.id] = stored as QuizQuestion[];
      } catch {
        // Skip a damaged per-lecture quiz entry; the rest of the backup remains usable.
      }
    });

    const backup = parseLocalLibraryBackup(JSON.stringify(createLocalLibraryBackup({
      favorites,
      history,
      progress,
      bookmarks,
      quizzes,
      preferences: { theme, volume: playerState.volume, rate: playerState.rate, currentLectureId }
    })));
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `al-firqa-an-najiya-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMessage(`Резервная копия подготовлена: ${backup.favorites.length} избранных, ${backup.progress ? Object.keys(backup.progress).length : 0} позиций, ${backup.bookmarks.length} заметок/закладок и ${Object.keys(backup.quizzes).length} наборов тестов.`);
  };

  const importLocalLibraryBackup = async (file: File) => {
    if (file.size > MAX_LOCAL_BACKUP_BYTES) {
      setBackupMessage('Файл больше допустимых 5 MiB. Выберите резервную копию AL-FIRQA AN-NAJIYA меньшего размера.');
      return;
    }
    try {
      const backup = parseLocalLibraryBackup(await file.text());

      let mergedProgress: Record<string, LectureProgressEntry> = {};
      try {
        const stored = JSON.parse(localStorage.getItem(storageKeys.progress) || '{}');
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) mergedProgress = stored as Record<string, LectureProgressEntry>;
      } catch {
        mergedProgress = {};
      }
      Object.entries(backup.progress).forEach(([id, incoming]) => {
        const existingDate = Date.parse(mergedProgress[id]?.updatedAt || '') || 0;
        if (!mergedProgress[id] || Date.parse(incoming.updatedAt) > existingDate) mergedProgress[id] = incoming;
      });
      localStorage.setItem(storageKeys.progress, JSON.stringify(mergedProgress));

      Object.entries(backup.quizzes).forEach(([lectureId, incoming]) => {
        const local = readQuizQuestions(lectureId);
        const merged = new Map(incoming.map((question) => [question.id, question]));
        local.forEach((question) => merged.set(question.id, question));
        localStorage.setItem(`affn-quiz-${lectureId}`, JSON.stringify(Array.from(merged.values()).slice(0, 500)));
      });

      setFavorites((local) => Array.from(new Set([...backup.favorites, ...local])));
      setHistory((local) => Array.from(new Set([...backup.history, ...local])).slice(0, 12));
      setBookmarks((local) => {
        const merged = new Map(backup.bookmarks.map((item) => [item.id, item]));
        local.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values()).slice(-100);
      });

      setTheme(backup.preferences.theme);
      const canRestoreSelectedLecture = route !== 'lecture' && !playerState.isPlaying && backup.preferences.currentLectureId;
      if (canRestoreSelectedLecture) {
        setCurrentLectureId(backup.preferences.currentLectureId);
        setPlayerState((local) => ({ ...local, isPlaying: false, currentTime: getAudioProgress(backup.preferences.currentLectureId!), volume: backup.preferences.volume, rate: backup.preferences.rate }));
      } else {
        setPlayerState((local) => ({ ...local, volume: backup.preferences.volume, rate: backup.preferences.rate }));
      }

      setBackupMessage(`Копия от ${new Date(backup.exportedAt).toLocaleString('ru-RU')} объединена с этой библиотекой. Совпадающие локальные закладки и тесты сохранены; текущий экран и воспроизведение не запускаются автоматически.`);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Не удалось прочитать файл резервной копии.');
    }
  };

  const favoriteLectures = allLectureData.filter((lecture) => favorites.includes(lecture.id));
  const continueLectures = allLectureData.filter((lecture) => getAudioProgress(lecture.id) > 15);
  const recentLectures = history.map((id) => getLectureById(id)).filter(Boolean) as Lecture[];
  const dashboardSnapshot = buildLearningDashboardSnapshot({
    lectures: allLectureData,
    cycles,
    favorites,
    history,
    bookmarks,
    progress: readAudioProgressSnapshot(),
    cloudConfigured: isSupabaseConfigured,
    cloudReady,
    hasCloudSession: Boolean(authSession),
    online: isOnline
  });

  const renderRoute = () => {
    if (shouldLoadAdditionalLectures && additionalLectureData === null && route !== 'home') {
      return <div className="panel p-8 text-center text-sm text-muted dark:text-darkmuted" role="status">Загружаем материалы архива…</div>;
    }
    if (route === 'library') {
      return (
        <LibraryPage
          continueLectures={continueLectures}
          favoriteLectures={favoriteLectures}
          recentLectures={recentLectures}
          onOpenLecture={handleOpenLecture}
          dashboard={dashboardSnapshot}
          onShowFavorites={() => document.getElementById('library-favorites')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onShowBookmarks={() => document.getElementById('library-bookmarks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onToggleFavorite={toggleFavorite}
          favorites={favorites}
          getProgress={getAudioProgress}
          cloudEnabled={isSupabaseConfigured}
          authSession={authSession}
          onOpenAuth={() => { setAuthMessage(''); setAuthOpen(true); }}
          onSignOut={handleSignOut}
          bookmarks={bookmarks}
          onExportAllText={exportAllBookmarksText}
          onExportAllPdf={exportAllBookmarksPdf}
          onExportBackup={exportLocalLibraryBackup}
          onImportBackup={importLocalLibraryBackup}
          backupMessage={backupMessage}
          onOpenCatalog={() => navigate('/catalog')}
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
          cycleFilter={cycleFilter}
          setCycleFilter={setCycleFilter}
          uniqueAuthors={uniqueAuthors}
          uniqueCycles={uniqueCycles}
          categories={categories}
          renderLectureCard={(lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              onOpen={() => handleOpenLecture(lecture.id)}
              isFavorite={favorites.includes(lecture.id)}
              onToggleFavorite={() => toggleFavorite(lecture.id)}
              progress={getAudioProgress(lecture.id)}
              highlightQuery={search}
            />
          )}
        />
      );
    }

    if (route === 'cycle') {
      const cycleId = window.location.hash.replace(/^#\/cycle\//, '');
      const cycleLectures = getOrderedCycleLectures(cycleId);
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
      const authorLectures = allLectureData.filter((lecture) => lecture.authorId === authorId);
      const author = authorMap[authorId as keyof typeof authorMap] ?? (authorLectures[0]
        ? { id: authorId, name: authorLectures[0].author, bio: 'Биографическая справка не добавлена.' }
        : undefined);
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
          cycleLectures={getOrderedCycleLectures(lecture.cycleId)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenLecture={handleOpenLecture}
          playerState={playerState}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
          bookmarks={bookmarks.filter((item) => item.lectureId === lecture.id)}
          onAddBookmark={addBookmark}
          onRemoveBookmark={removeBookmark}
          onUpdateBookmarkNote={updateBookmarkNote}
          onUpdateBookmarkDrawing={updateBookmarkDrawing}
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
      const filtered = allLectureData.filter((lecture) => lecture.category === category);

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

    if (route === 'knowledge') return <KnowledgeMap onNavigate={navigate} />;

    if (route === 'social') return <SocialPage session={authSession} onOpenAuth={() => setAuthOpen(true)} onOpenCatalog={() => navigate('/catalog')} />;

    if (route === 'about') return <AboutPage />;

    if (route === 'resource') {
      const resource = window.location.hash.replace(/^#\//, '').split('/')[0] as ResourceType;
      if (resource === 'books') return <BooksPage onOpenCycle={(id) => navigate(`/cycle/${id}`)} />;
      if (resource === 'courses') return <CoursesPage onOpenCycle={(id) => navigate(`/cycle/${id}`)} />;
      return <ResourcePage resource={resource} onOpenCatalog={() => navigate('/catalog')} onOpenCourses={() => navigate('/courses')} onOpenBooks={() => navigate('/books')} onOpenKnowledge={() => navigate('/knowledge')} />;
    }

    return <HomePage />;
  };

  const currentView = route === 'home' ? 'home' : route;
  const currentHashPath = window.location.hash.replace(/^#/, '').split('?')[0] || '/';

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-300 dark:bg-darkbg dark:text-darktext">
      <div className="mx-auto max-w-[1440px] px-4 pb-[calc(20rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:pb-32">
        {!isOnline && <div role="status" className="mb-3 rounded-2xl border border-[#B8874A]/30 bg-[#B8874A]/10 px-4 py-3 text-sm text-text dark:border-[#E0821E]/30 dark:bg-[#E0821E]/10 dark:text-darktext">Офлайн-режим: доступна ранее загруженная оболочка и каталог. Аудио и облачная синхронизация возобновятся после подключения к сети.</div>}
        <header className="sticky top-3 z-40 mb-8">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between rounded-[28px] border border-black/5 bg-white/80 px-3 py-2.5 shadow-[0_8px_30px_rgba(17,24,32,0.06)] backdrop-blur-xl sm:rounded-full sm:px-4 sm:py-3 dark:border-white/10 dark:bg-[#101010]/85">
            <button className="flex items-center gap-2 sm:gap-3" onClick={() => navigate('/')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111820] p-1.5 sm:h-10 sm:w-10 dark:bg-[#F5F5F5]">
                <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="text-left">
                <div className="font-semibold tracking-[0.12em] text-[10px] uppercase text-muted dark:text-darkmuted">
                  AL-FIRQA
                </div>
                <div className="font-display text-lg leading-none text-text dark:text-darktext">AN-NAJIYA</div>
              </div>
            </button>

            <nav className="hidden items-center gap-3 xl:flex 2xl:gap-4">
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
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/knowledge')}>
                Карта знаний
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/social')}>
                Сообщество
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/about')}>
                О проекте
              </button>
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden min-w-0 w-40 items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-muted focus-within:ring-2 focus-within:ring-[#B8874A]/60 md:flex lg:w-48 xl:w-56 dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">
                <Search size={15} />
                <input
                  value={search}
                  aria-label="Поиск по каталогу лекций"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (currentView !== 'catalog') navigate('/catalog');
                  }}
                  placeholder="Найти лекцию, шейха или тему…"
                  className="min-w-0 w-full bg-transparent outline-none placeholder:text-muted dark:placeholder:text-darkmuted"
                />
              </div>

              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white text-text transition hover:-translate-y-0.5 hover:shadow-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                aria-label="Переключить тему"
              >
                {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
              </button>

              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white text-text transition hover:-translate-y-0.5 hover:shadow-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext"
                onClick={() => navigate('/library')}
                aria-label="Избранное и библиотека"
              >
                <Heart size={16} />
              </button>
            </div>
          </div>
        </header>

        <Suspense fallback={<div className="panel my-6 min-h-40 p-6 text-sm text-muted dark:text-darkmuted" role="status" aria-live="polite">Загружаем раздел…</div>}>
          {renderRoute()}
        </Suspense>

        <nav aria-label="Быстрая навигация" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-6 gap-0.5 rounded-2xl border border-black/5 bg-white/90 p-1.5 shadow-[0_18px_60px_rgba(17,24,32,0.14)] backdrop-blur-xl sm:gap-1 sm:p-2 xl:hidden dark:border-white/10 dark:bg-[#101010]/90">
          {[
            { label: 'Главная', icon: <Sparkles size={16} />, path: '/' },
            { label: 'Лекции', icon: <BookOpenText size={16} />, path: '/catalog' },
            { label: 'Библиотека', icon: <Heart size={16} />, path: '/library' },
            { label: 'Карта', icon: <Search size={16} />, path: '/knowledge' },
            { label: 'Книги', icon: <BookOpenText size={16} />, path: '/books' },
            { label: 'Сообщество', icon: <MessageCircle size={16} />, path: '/social' }
          ].map((item) => {
            const isActive = item.path === '/'
              ? currentHashPath === '/'
              : currentHashPath === item.path || currentHashPath.startsWith(`${item.path}/`);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-center text-[9px] font-medium leading-tight transition sm:text-[10px] ${isActive ? 'bg-[#B8874A]/10 text-[#8C5B22] dark:bg-[#E0821E]/10 dark:text-[#F3B76B]' : 'text-muted hover:bg-black/5 hover:text-text dark:text-darkmuted dark:hover:bg-white/10 dark:hover:text-darktext'}`}
              >
                {item.icon}<span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <footer className="mt-24 border-t border-black/5 pt-8 text-sm text-muted dark:border-white/10 dark:text-darkmuted">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="font-medium tracking-[0.08em] text-text dark:text-darktext">AL-FIRQA AN-NAJIYA</div>
            <div>Исламские лекции и архив знаний</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {[['Книги', '/books'], ['Тексты', '/texts'], ['Словарь', '/dictionary'], ['Курсы', '/courses'], ['Карта знаний', '/knowledge'], ['Сообщество', '/social'], ['О проекте', '/about']].map(([label, path]) => (
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
        audioStatus={audioStatus}
        isOnline={isOnline}
        onRetry={retryAudio}
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
        onLoadStart={() => setAudioStatus('loading')}
        onCanPlay={() => setAudioStatus('ready')}
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
          const audio = audioRef.current;
          if (audio && currentLecture?.fallbackAudioUrl && !audioFallbackAttempted.current) {
            audioFallbackAttempted.current = true;
            setAudioStatus('loading');
            audio.src = currentLecture.fallbackAudioUrl;
            audio.load();
            if (playerState.isPlaying) {
              audio.play().catch(() => {
                setPlayerState((prev) => ({ ...prev, isPlaying: false }));
                setAudioStatus('error');
              });
            }
            return;
          }
          setAudioStatus('error');
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
        }}
      />
    </div>
  );
}

function HomePage() {
  const bookCycles = bookData.flatMap((book) => {
    const cycle = cycles.find((item) => item.id === book.cycleId);
    return cycle ? [{ book, cycle }] : [];
  });
  const audioCycles = cycles.filter((cycle) => !bookCycles.some((item) => item.cycle.id === cycle.id));
  const totalLessons = cycles.reduce((total, cycle) => total + cycle.totalLessons, 0);

  return (
    <main className="space-y-10">
      <section className="panel p-5 sm:p-9">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#B8874A]/15 bg-[#B8874A]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8C5B22] dark:border-[#E0821E]/20 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">
          <Sparkles size={14} />
          Архив лекций и знаний
        </div>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.04em] text-text dark:text-darktext sm:text-6xl">
          Исламские лекции и учебные материалы
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted dark:text-darkmuted">
          Найдите отдельную лекцию, слушайте учебные циклы по порядку и открывайте книги с указанием источников.
        </p>
        <div className="mt-7 flex flex-wrap gap-3 text-sm text-muted dark:text-darkmuted">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]"><BookOpenText size={16} />{bookCycles.length} циклов по книгам</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]"><Headphones size={16} />{audioCycles.length} аудиоциклов</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]"><BookOpenText size={16} />{totalLessons} уроков</div>
        </div>
        <div className="mt-8">
          <h2 className="font-display text-2xl tracking-[-0.03em] text-text dark:text-darktext">Начните здесь</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <a href="#/catalog" className="group rounded-2xl border border-black/5 bg-white p-4 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874A] dark:border-white/10 dark:bg-[#101010]">
              <div className="flex items-center justify-between gap-3 font-medium text-text dark:text-darktext"><span>Найти лекцию</span><span aria-hidden="true" className="text-accent dark:text-darkaccent">→</span></div>
              <p className="mt-1 text-sm text-muted dark:text-darkmuted">По названию, шейху или теме</p>
            </a>
            <a href="#/courses" className="group rounded-2xl border border-black/5 bg-white p-4 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874A] dark:border-white/10 dark:bg-[#101010]">
              <div className="flex items-center justify-between gap-3 font-medium text-text dark:text-darktext"><span>Учебные циклы</span><span aria-hidden="true" className="text-accent dark:text-darkaccent">→</span></div>
              <p className="mt-1 text-sm text-muted dark:text-darkmuted">Полные серии уроков по порядку</p>
            </a>
            <a href="#/books" className="group rounded-2xl border border-black/5 bg-white p-4 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874A] dark:border-white/10 dark:bg-[#101010]">
              <div className="flex items-center justify-between gap-3 font-medium text-text dark:text-darktext"><span>Книги и материалы</span><span aria-hidden="true" className="text-accent dark:text-darkaccent">→</span></div>
              <p className="mt-1 text-sm text-muted dark:text-darkmuted">Книги, доступные файлы и источники</p>
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Книга и связанный аудиокурс</div>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.04em] text-text dark:text-darktext sm:text-3xl">Учебные циклы по книгам</h2>
          </div>
          <button onClick={() => window.location.hash = '#/books'} className="shrink-0 text-sm font-medium text-accent dark:text-darkaccent">Все книги</button>
        </div>
        {bookCycles.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bookCycles.map(({ book, cycle }) => (
              <article key={book.id} className={`panel overflow-hidden p-0 ${bookCycles.length === 1 ? 'md:col-span-2 md:grid md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)] xl:col-span-2' : ''}`}>
                <div className={`flex h-28 items-end justify-between bg-gradient-to-br ${cycle.coverTone} p-5 text-white ${bookCycles.length === 1 ? 'md:min-h-64' : ''}`}>
                  <BookOpenText size={25} />
                  <span className="text-xs font-medium uppercase tracking-[0.12em]">{book.subtitle}</span>
                </div>
                <div className="p-5">
                  <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">{book.author}</div>
                  <h3 className="mt-3 font-display text-2xl leading-tight text-text dark:text-darktext">{book.title}</h3>
                  <p className="mt-2 text-sm text-muted dark:text-darkmuted">{book.description}</p>
                  <div className="mt-4 rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 text-sm dark:border-white/10 dark:bg-[#161616]">
                    <div className="text-xs uppercase tracking-[0.1em] text-muted dark:text-darkmuted">Аудиоцикл</div>
                    <div className="mt-1 font-medium text-text dark:text-darktext">{cycle.title} · {cycle.totalLessons} уроков</div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button onClick={() => window.location.hash = `#/cycle/${cycle.id}`} className="rounded-full bg-[#111820] px-4 py-2.5 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Открыть цикл</button>
                    <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="rounded-full border border-black/5 px-4 py-2.5 text-sm font-medium text-text dark:border-white/10 dark:text-darktext">PDF книги</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel p-5 text-sm text-muted dark:text-darkmuted">Связанные с книгами аудиоциклы пока не добавлены.</div>
        )}
      </section>

      {audioCycles.length > 0 && (
        <section>
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Отдельные аудиосерии</div>
            <h2 className="mt-1 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Аудиоциклы</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {audioCycles.map((cycle) => (
              <button key={cycle.id} onClick={() => window.location.hash = `#/cycle/${cycle.id}`} className="panel overflow-hidden p-0 text-left">
                <div className={`h-28 bg-gradient-to-br ${cycle.coverTone}`} />
                <div className="p-5">
                  <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">{cycle.author} · аудиоцикл</div>
                  <h3 className="mt-3 font-display text-2xl leading-tight text-text dark:text-darktext">{cycle.title}</h3>
                  <p className="mt-2 text-sm text-muted dark:text-darkmuted">{cycle.description}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-text dark:text-darktext">{cycle.totalLessons} уроков</span>
                    <span className="text-muted dark:text-darkmuted">{cycle.totalDuration > 0 ? formatDuration(cycle.totalDuration) : 'Длительность не указана'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function CyclePage({ cycle, lectures, favorites, onToggleFavorite, onOpenLecture, getProgress }: {
  cycle: { id: string; title: string; author: string; authorId: string; description: string; totalLessons: number; totalDuration: number; coverTone: string; sourceUrl?: string };
  lectures: Lecture[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  getProgress: (id: string) => number;
}) {
  const listenedCount = lectures.filter((lecture) => getProgress(lecture.id) > 10).length;
  const book = bookData.find((item) => item.cycleId === cycle.id);
  const archive = cycleArchives[cycle.id];
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
              {cycle.totalDuration > 0 ? formatDuration(cycle.totalDuration) : 'Длительность не указана'}
            </div>
            <div className="rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 dark:border-white/10 dark:bg-[#161616]">
              Прослушано: {listenedCount}/{cycle.totalLessons}
            </div>
          </div>
          {cycle.sourceUrl && <a href={cycle.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#8C5B22] underline underline-offset-4 dark:text-[#F3B76B]">Исходная страница и текст лекций на abuyahya.net</a>}
          {book && <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full border border-[#B8874A]/30 bg-[#B8874A]/10 px-4 py-2 text-sm font-medium text-[#8C5B22] transition hover:-translate-y-0.5 dark:border-[#E0821E]/30 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">Открыть книгу PDF</a>}
          {archive && <a href={archive.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111820] px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 dark:bg-[#F5F5F5] dark:text-[#111820]"><Download size={16} /><span>Скачать весь цикл ZIP</span><span className="text-xs opacity-75">{archive.trackCount} MP3 · {archive.sizeLabel}</span></a>}
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
                  {getLectureTopicTitle(lecture)}
                </button>
                {lectureOutlines[lecture.id]?.outline.length ? (
                  <details className="mt-2 text-sm text-muted dark:text-darkmuted">
                    <summary className="w-fit cursor-pointer underline underline-offset-4">Оглавление · {lectureOutlines[lecture.id].outline.length} пунктов</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 leading-5">
                      {lectureOutlines[lecture.id].outline.map((item, outlineIndex) => <li key={`${lecture.id}-cycle-outline-${outlineIndex}`}>{item}</li>)}
                    </ol>
                    {lectureOutlines[lecture.id].note && <p className="mt-2 text-xs leading-5">Примечание к источнику: {lectureOutlines[lecture.id].note}</p>}
                  </details>
                ) : (
                  <div className="mt-1 text-xs text-muted dark:text-darkmuted">Тема не подтверждена доступным текстом источника</div>
                )}
                <div className="mt-1 text-sm text-muted dark:text-darkmuted">
                  {lecture.category} · {lecture.duration > 0 ? formatDuration(lecture.duration) : '—'}
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

function LibraryPage({ continueLectures, favoriteLectures, recentLectures, onOpenLecture, dashboard, onShowFavorites, onShowBookmarks, onToggleFavorite, favorites, getProgress, cloudEnabled, authSession, onOpenAuth, onSignOut, bookmarks, onExportAllText, onExportAllPdf, onExportBackup, onImportBackup, backupMessage, onOpenCatalog, librarySearch, setLibrarySearch, librarySearchType, setLibrarySearchType, librarySearchSort, setLibrarySearchSort }: {
  continueLectures: Lecture[];
  favoriteLectures: Lecture[];
  recentLectures: Lecture[];
  onOpenLecture: (id: string) => void;
  dashboard: LearningDashboardSnapshot;
  onShowFavorites: () => void;
  onShowBookmarks: () => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  getProgress: (id: string) => number;
  cloudEnabled: boolean;
  authSession: Session | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  bookmarks: BookmarkItem[];
  onExportAllText: () => void;
  onExportAllPdf: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<void>;
  backupMessage: string;
  onOpenCatalog: () => void;
  librarySearch: string;
  setLibrarySearch: (value: string) => void;
  librarySearchType: LibrarySearchType;
  setLibrarySearchType: (value: LibrarySearchType) => void;
  librarySearchSort: LibrarySearchSort;
  setLibrarySearchSort: (value: LibrarySearchSort) => void;
}) {
  const normalizedSearch = librarySearch.trim().toLowerCase();
  const [selectedTag, setSelectedTag] = useState('all');
  const backupFileRef = useRef<HTMLInputElement>(null);
  const availableTags = Array.from(new Set(bookmarks.flatMap((item) => item.tags || []))).sort((a, b) => a.localeCompare(b, 'ru'));
  const matchingBookmarks = bookmarks.map((item) => ({ item, lecture: getLectureById(item.lectureId) })).filter((entry): entry is { item: BookmarkItem; lecture: Lecture } => Boolean(entry.lecture)).filter(({ item, lecture }) => {
    const haystack = [lecture.title, lecture.author, lecture.cycle, formatDuration(item.time), item.note || '', ...(item.tags || [])].join(' ').toLowerCase();
    const hasNote = Boolean(item.note?.trim() || item.handwriting?.length);
    const typeMatches = librarySearchType === 'all' || (librarySearchType === 'note' ? hasNote : !hasNote);
    const tagMatches = selectedTag === 'all' || (item.tags || []).includes(selectedTag);
    return typeMatches && tagMatches && (!normalizedSearch || haystack.includes(normalizedSearch));
  }).sort((a, b) => {
    const difference = new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
    return librarySearchSort === 'newest' ? -difference : difference;
  });

  return (
    <main className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Личный раздел</div>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <h1 className="break-words font-display text-3xl leading-tight tracking-[-0.04em] text-text dark:text-darktext sm:text-4xl">Панель обучения</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 w-fit items-center rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-xs text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">{dashboard.storage.label}</span>
            {!cloudEnabled && <span className="max-w-xs text-xs leading-5 text-muted dark:text-darkmuted">Данные остаются на этом устройстве; облачная синхронизация пока недоступна.</span>}
            {authSession?.user.email ? <button onClick={onSignOut} className="inline-flex min-h-11 items-center rounded-full border border-black/5 px-3 py-2 text-xs text-muted dark:border-white/10 dark:text-darkmuted">Выйти</button> : <button onClick={onOpenAuth} disabled={!cloudEnabled} title={!cloudEnabled ? "Облачная синхронизация недоступна: Supabase не настроен." : undefined} className="inline-flex min-h-11 items-center rounded-full bg-[#111820] px-4 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">Сохранить в облако</button>}
          </div>
        </div>
      </section>

      <LearningDashboard snapshot={dashboard} onOpenLecture={onOpenLecture} onOpenCatalog={onOpenCatalog} onShowFavorites={onShowFavorites} onShowBookmarks={onShowBookmarks} />

      <section className="panel space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-medium text-text dark:text-darktext">Резервная копия на устройстве</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">JSON включает избранное, историю, позиции, заметки/закладки, локальные тесты и настройки. Импорт объединяет данные, не заменяя совпадающие записи на этом устройстве; аудиофайлы и облачные ключи не включаются.</p>
            <p className="mt-2 text-xs leading-5 text-muted dark:text-darkmuted">Файл содержит личные заметки в незашифрованном виде — храните его приватно. Максимальный размер импорта: 5 MiB.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={onExportBackup} className="inline-flex min-h-11 items-center rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Скачать JSON</button>
            <button type="button" onClick={() => backupFileRef.current?.click()} className="inline-flex min-h-11 items-center rounded-full border border-black/10 px-4 py-2.5 text-sm text-muted transition hover:bg-black/5 dark:border-white/10 dark:text-darkmuted dark:hover:bg-white/10">Восстановить JSON</button>
            <input ref={backupFileRef} type="file" accept=".json,application/json" aria-label="Выбрать файл резервной копии JSON" className="sr-only" onChange={async (event) => { const input = event.currentTarget; const file = input.files?.[0]; input.value = ''; if (file) await onImportBackup(file); }} />
          </div>
        </div>
        {backupMessage && <p role="status" aria-live="polite" className="rounded-2xl bg-[#F7F9FC] p-3 text-sm leading-6 text-muted dark:bg-[#161616] dark:text-darkmuted">{backupMessage}</p>}
      </section>

      <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-sm font-medium text-text dark:text-darktext">Экспорт заметок для чтения</div><p className="mt-1 text-sm text-muted dark:text-darkmuted">Все закладки и заметки со всех лекций: {bookmarks.length}</p></div>
        <div className="flex shrink-0 gap-2"><button disabled={!bookmarks.length} onClick={onExportAllText} className="inline-flex items-center gap-1 rounded-full border border-black/5 px-3 py-2 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-darkmuted">TXT</button><button disabled={!bookmarks.length} onClick={onExportAllPdf} className="inline-flex items-center gap-1 rounded-full border border-black/5 px-3 py-2 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-darkmuted">PDF</button></div>
      </section>

      <section id="library-bookmarks" className="panel p-5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_repeat(4,auto)]"><div className="flex min-w-0 items-center gap-2 rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 py-3 focus-within:ring-2 focus-within:ring-[#B8874A]/60 dark:border-white/10 dark:bg-[#161616]"><Search size={16} className="text-muted dark:text-darkmuted" /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Найти в заметках и закладках…" aria-label="Поиск по сохранённым заметкам и закладкам" className="min-w-0 w-full bg-transparent text-sm text-text outline-none placeholder:text-muted dark:text-darktext dark:placeholder:text-darkmuted" /></div><select value={librarySearchType} onChange={(event) => setLibrarySearchType(event.target.value as LibrarySearchType)} aria-label="Тип сохранённой записи" className="w-full min-w-0 rounded-2xl border border-black/5 bg-[#F7F9FC] px-3 py-3 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><option value="all">Все типы</option><option value="note">Только заметки</option><option value="bookmark">Только закладки</option></select><select value={librarySearchSort} onChange={(event) => setLibrarySearchSort(event.target.value as LibrarySearchSort)} aria-label="Сортировка сохранённых записей" className="w-full min-w-0 rounded-2xl border border-black/5 bg-[#F7F9FC] px-3 py-3 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select>{availableTags.length > 0 && <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} aria-label="Фильтр по тегу" className="w-full min-w-0 rounded-2xl border border-black/5 bg-[#F7F9FC] px-3 py-3 text-sm text-text outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><option value="all">Все теги</option>{availableTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}</select>}</div>
        {(normalizedSearch || librarySearchType !== 'all' || selectedTag !== 'all') && <div className="mt-4 space-y-3"><div role="status" aria-live="polite" className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Найдено: {matchingBookmarks.length} · {librarySearchType === 'all' ? 'все типы' : librarySearchType === 'note' ? 'заметки' : 'закладки'}{selectedTag !== 'all' ? ` · #${selectedTag}` : ''}</div>{matchingBookmarks.length ? matchingBookmarks.map(({ item, lecture }) => <button key={item.id} onClick={() => onOpenLecture(lecture.id)} className="block w-full rounded-2xl border border-black/5 bg-[#F7F9FC] p-4 text-left transition hover:border-[#B8874A]/40 dark:border-white/10 dark:bg-[#161616]"><div className="flex items-center justify-between gap-3"><div className="font-medium text-text dark:text-darktext"><HighlightedText text={lecture.title} query={librarySearch} /></div><span className="shrink-0 text-right text-sm text-[#9B6D32] dark:text-[#E0821E]"><span className="block">{formatDuration(item.time)}</span><span className="text-[10px] uppercase tracking-[0.1em] text-muted dark:text-darkmuted">{item.handwriting?.length ? 'Рисунок от руки' : item.note?.trim() ? 'Заметка' : 'Закладка'}</span></span></div><div className="mt-1 text-xs text-muted dark:text-darkmuted"><HighlightedText text={lecture.author} query={librarySearch} /></div>{item.note && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted dark:text-darkmuted"><HighlightedText text={item.note} query={librarySearch} /></p>}<HandwritingPreview strokes={item.handwriting} />{!!item.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-[#B8874A]/10 px-2 py-1 text-[11px] text-[#8A612E] dark:bg-[#E0821E]/10 dark:text-[#E5A35B]">#{tag}</span>)}</div>}</button>) : <div className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-[#161616]"><p className="text-sm text-muted dark:text-darkmuted">Сохранённых записей, соответствующих этим условиям, нет. Измените запрос или сбросьте фильтры.</p><button type="button" onClick={() => { setLibrarySearch(''); setLibrarySearchType('all'); setSelectedTag('all'); }} className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-text hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8874A] dark:border-white/10 dark:text-darktext dark:hover:bg-white/10">Сбросить поиск и фильтры</button></div>}</div>}
        {bookmarks.length === 0 && !normalizedSearch && librarySearchType === 'all' && selectedTag === 'all' && <div className="mt-4"><LibraryEmptyState message="Здесь появятся ваши заметки и закладки по времени. Откройте лекцию и сохраните нужный фрагмент." onOpenCatalog={onOpenCatalog} /></div>}
      </section>

      <section className="space-y-4">
        <div className="mb-3 text-sm uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Продолжить</div>
        {continueLectures.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {continueLectures.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={favorites.includes(lecture.id)} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <LibraryEmptyState message="Сохранённый прогресс появится здесь после начала прослушивания. Выберите лекцию, чтобы продолжить в удобное время." onOpenCatalog={onOpenCatalog} />
        )}
      </section>

      <section id="library-favorites" className="scroll-mt-24 space-y-4">
        <div className="mb-3 text-sm uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Избранное</div>
        {favoriteLectures.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {favoriteLectures.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={true} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <LibraryEmptyState message="Отметьте лекцию как избранную, чтобы быстро вернуться к ней из этого раздела." onOpenCatalog={onOpenCatalog} />
        )}
      </section>

      <section className="space-y-4">
        <div className="mb-3 text-sm uppercase tracking-[0.12em] text-muted dark:text-darkmuted">История</div>
        {recentLectures.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recentLectures.map((lecture) => (
              <LectureCard key={lecture.id} lecture={lecture} onOpen={() => onOpenLecture(lecture.id)} isFavorite={favorites.includes(lecture.id)} onToggleFavorite={() => onToggleFavorite(lecture.id)} progress={getProgress(lecture.id)} />
            ))}
          </div>
        ) : (
          <LibraryEmptyState message="Открытые лекции будут появляться здесь автоматически; это устройство не отправляет историю без вашей настройки синхронизации." onOpenCatalog={onOpenCatalog} />
        )}
      </section>
    </main>
  );
}

function LibraryEmptyState({ message, onOpenCatalog }: { message: string; onOpenCatalog: () => void }) {
  return (
    <div className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">{message}</p>
      <button type="button" onClick={onOpenCatalog} className="shrink-0 rounded-full bg-[#111820] px-4 py-2.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8874A] dark:bg-[#F5F5F5] dark:text-[#111820]">Найти лекцию</button>
    </div>
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
    <article className="panel group p-0 transition duration-200 hover:-translate-y-0.5">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted"><HighlightedText text={lecture.category} query={highlightQuery || ''} /></div>
                <h3 className="mt-2 break-words font-display text-2xl leading-tight text-text dark:text-darktext"><button type="button" onClick={onOpen} className="text-left"><HighlightedText text={getLectureTopicTitle(lecture)} query={highlightQuery || ''} /></button></h3>
          </div>

          <button type="button" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white text-sm dark:border-white/10 dark:bg-[#101010]" onClick={onToggleFavorite} aria-label={isFavorite ? `Убрать из избранного: ${lecture.title}` : `Добавить в избранное: ${lecture.title}`}>
            <Heart size={15} fill={isFavorite ? '#B8874A' : 'none'} className={isFavorite ? 'text-[#B8874A]' : 'text-muted dark:text-darkmuted'} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm text-muted dark:text-darkmuted">
          <span className="min-w-0 break-words"><HighlightedText text={lecture.author} query={highlightQuery || ''} /></span>
          <span className="min-w-0 break-words"><HighlightedText text={lecture.cycle} query={highlightQuery || ''} /></span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted dark:text-darkmuted">
          <div className="flex items-center gap-1"><BookOpenText size={13} /> Урок {lecture.lessonNumber}</div>
          <div className="flex items-center justify-end gap-1"><Clock3 size={13} /> {lecture.duration > 0 ? formatDuration(lecture.duration) : '—'}</div>
        </div>

        <p className="mt-4 text-sm text-muted dark:text-darkmuted"><HighlightedText text={lecture.description} query={highlightQuery || ''} /></p>

        {progress > 0 && lecture.duration > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">
              <span>Прогресс</span>
              <span>{Math.round((progress / lecture.duration) * 100)}%</span>
            </div>
            <div role="progressbar" aria-label={`Прогресс прослушивания: ${lecture.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((progress / lecture.duration) * 100))} className="h-2 overflow-hidden rounded-full bg-[#E6EBF2] dark:bg-[#202020]">
              <div className="h-full rounded-full bg-[#B8874A] dark:bg-[#E0821E]" style={{ width: `${Math.min(100, (progress / lecture.duration) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted dark:text-darkmuted">{lecture.date}</span>
          <button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#111820] px-4 py-2 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">
            Открыть <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function MiniPlayer({ lecture, isPlaying, currentTime, duration, rate, audioStatus, isOnline, onRetry, setRate, volume, setVolume, onTogglePlay, onPrev, onNext, onSeek, sleepMinutes, setSleepMinutes }: {
  lecture: Lecture | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  audioStatus: 'idle' | 'loading' | 'ready' | 'error';
  isOnline: boolean;
  onRetry: () => void;
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
      <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-3 z-50 xl:bottom-3 xl:right-5">
        <button onClick={() => setCollapsed(false)} aria-label="Показать аудиоплеер" title="Показать аудиоплеер" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-black/5 bg-white/95 px-4 py-3 text-sm font-medium text-text shadow-[0_12px_40px_rgba(17,24,32,0.2)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#101010]/95 dark:text-darktext">
          <ChevronUp size={17} aria-hidden="true" />
          Плеер
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 px-3 pb-3 sm:px-5 xl:bottom-0"
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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
              <div className="flex items-center gap-2 truncate text-xs text-muted dark:text-darkmuted"><span>{lecture.author}</span><span aria-live="polite">{audioStatus === 'loading' ? 'Загрузка аудио…' : audioStatus === 'error' ? 'Ошибка загрузки' : isPlaying ? 'Воспроизводится' : 'Пауза'}</span></div>
            </div>
            <button onClick={() => setCollapsed(true)} aria-label="Свернуть аудиоплеер" title="Свернуть аудиоплеер" className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/5 bg-[#F7F9FC] text-text transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#161616] dark:text-darktext">
              <ChevronDown size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2 xl:max-w-[640px]">
            {audioStatus === 'error' && (
              <div className="flex items-center justify-between gap-3 text-xs text-[#9B3D32] dark:text-[#F3A89F]" role="status" aria-live="polite">
                <span>{isOnline ? 'Не удалось загрузить запись. Попробуйте ещё раз.' : 'Нет подключения к интернету. Проверьте соединение и повторите попытку.'}</span>
                <button type="button" onClick={onRetry} className="shrink-0 rounded-full border border-current px-3 py-1.5 font-medium underline-offset-2 hover:underline">Повторить</button>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
            <input type="range" aria-label={`Позиция воспроизведения: ${lecture.title}`} min={0} max={duration || 1} value={currentTime} onChange={(e) => onSeek(Number(e.target.value))} className="w-full accent-[#B8874A] dark:accent-[#E0821E]" />
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
            <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-end">
              <button type="button" onClick={() => onSeek(offsetPlaybackTime(currentTime, duration, -10))} aria-label="Перемотать назад на 10 секунд" title="Назад на 10 секунд" className="inline-flex min-h-11 min-w-16 items-center justify-center rounded-full border border-black/5 bg-[#F7F9FC] px-3 text-xs font-semibold text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext">−10с</button>
              <button onClick={onPrev} aria-label="Предыдущая лекция" className="icon-button min-h-11 min-w-11"><SkipBack size={16} /></button>
              <button onClick={onTogglePlay} aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'} aria-pressed={isPlaying} className="icon-button min-h-11 min-w-11 bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]">{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
              <button onClick={onNext} aria-label="Следующая лекция" className="icon-button min-h-11 min-w-11"><SkipForward size={16} /></button>
              <button type="button" onClick={() => onSeek(offsetPlaybackTime(currentTime, duration, 10))} aria-label="Перемотать вперёд на 10 секунд" title="Вперёд на 10 секунд" className="inline-flex min-h-11 min-w-16 items-center justify-center rounded-full border border-black/5 bg-[#F7F9FC] px-3 text-xs font-semibold text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext">+10с</button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-end">
              <label className="flex min-h-11 items-center gap-1 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-xs dark:border-white/10 dark:bg-[#161616]" title="Громкость">
                <Volume2 size={13} aria-hidden="true" />
                <input aria-label="Громкость" type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-16 accent-[#B8874A] dark:accent-[#E0821E]" />
              </label>

              <select aria-label="Скорость воспроизведения" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="min-h-11 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-xs dark:border-white/10 dark:bg-[#161616]">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <option key={value} value={value}>{value}x</option>
                ))}
              </select>

              <select aria-label="Таймер сна" value={sleepMinutes} onChange={(e) => setSleepMinutes(Number(e.target.value))} className="min-h-11 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-xs dark:border-white/10 dark:bg-[#161616]">
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
    </div>
  );
}

function ResourcePage({ resource, onOpenCatalog, onOpenCourses, onOpenBooks, onOpenKnowledge }: { resource: ResourceType; onOpenCatalog: () => void; onOpenCourses: () => void; onOpenBooks: () => void; onOpenKnowledge: () => void }) {
  const content: Record<ResourceType, { eyebrow: string; title: string; description: string; note: string }> = {
    books: { eyebrow: 'Библиотека книг', title: 'Книги появятся после проверки прав на распространение.', description: 'Этот раздел подготовлен для PDF-книг, авторов, обложек и истории чтения.', note: 'Пока здесь нет опубликованных книг. Мы не добавляем файлы без подтверждённого разрешения.' },
    texts: { eyebrow: 'Тексты уроков', title: 'Материалы источников доступны на страницах уроков.', description: 'Откройте учебный цикл и выберите урок: опубликованный для него текст показывается рядом с аудио вместе с атрибуцией и ссылкой на первоисточник.', note: 'Отдельный общий указатель текстов пока не создан. Если в первоисточнике текст отсутствует, страница сообщает об этом и не дополняет его самостоятельно.' },
    dictionary: { eyebrow: 'Терминологический словарь', title: 'Отдельный проверенный словарь ещё не опубликован.', description: 'Некоторые термины уже связаны с существующими конспектами и источниками в Карте знаний.', note: 'Карта показывает только имеющиеся записи и связи; самостоятельные словарные статьи появятся после проверки и атрибуции.' },
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
        <div><div className="text-sm font-medium text-text dark:text-darktext">{resource === 'texts' ? 'Как открыть текст урока' : resource === 'dictionary' ? 'Где искать связанные термины' : 'Раздел ещё не опубликован'}</div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">{item.note}</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {resource === 'texts' ? <><button type="button" onClick={onOpenCourses} className="rounded-full bg-[#111820] px-5 py-3 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Открыть учебные циклы</button><button type="button" onClick={onOpenBooks} className="rounded-full border border-black/10 px-5 py-3 text-sm text-text dark:border-white/10 dark:text-darktext">Книги</button></> : resource === 'dictionary' ? <><button type="button" onClick={onOpenKnowledge} className="rounded-full bg-[#111820] px-5 py-3 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Открыть карту знаний</button><button type="button" onClick={onOpenCatalog} className="rounded-full border border-black/10 px-5 py-3 text-sm text-text dark:border-white/10 dark:text-darktext">К лекциям</button></> : <button type="button" onClick={onOpenCatalog} className="rounded-full bg-[#111820] px-5 py-3 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Слушать лекции</button>}
        </div>
      </section>
    </main>
  );
}

function AuthDialog({ email, setEmail, busy, message, onSubmit, onClose }: { email: string; setEmail: (value: string) => void; busy: boolean; message: string; onSubmit: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111820]/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
      <div className="w-full max-w-md rounded-[28px] border border-black/5 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#101010]">
        <div className="flex items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Постоянный доступ</div><h2 id="auth-title" className="mt-2 font-display text-3xl text-text dark:text-darktext">Сохранить библиотеку</h2></div><button type="button" onClick={onClose} aria-label="Закрыть диалог" className="text-2xl text-muted dark:text-darkmuted">×</button></div>
        <p id="auth-description" className="mt-4 text-sm leading-6 text-muted dark:text-darkmuted">Укажите email — мы отправим безопасную ссылку входа. Избранное и история сохранятся в постоянном аккаунте.</p>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="mt-5 space-y-3"><label className="block text-sm font-medium text-text dark:text-darktext">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F9FC] px-4 py-3 outline-none dark:border-white/10 dark:bg-[#161616] dark:text-darktext" /></label><button type="submit" disabled={busy} className="w-full rounded-full bg-[#111820] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">{busy ? 'Отправляем…' : 'Отправить ссылку входа'}</button></form>
        {message && <p role="status" aria-live="polite" className="mt-4 rounded-2xl bg-[#F7F9FC] p-3 text-sm leading-6 text-muted dark:bg-[#161616] dark:text-darkmuted">{message}</p>}
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
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Архив</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{cycles.reduce((total, cycle) => total + cycle.totalLessons, 0)}</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">опубликованных аудиозаписей</p></div>
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

export default App;
