import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  BookOpenText,
  Bookmark,
  ChevronRight,
  Clock3,
  Headphones,
  Heart,
  Moon,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  SunMedium,
  Volume2
} from 'lucide-react';
import { lectureData, cycles } from './data/lectures';
import type { Category, Lecture } from './types';

type SortType = 'newest' | 'title' | 'author' | 'duration';
type Theme = 'light' | 'dark';
type BookmarkItem = { id: string; lectureId: string; time: number; createdAt: string };

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

const saveProgress = (id: string, currentTime: number) => {
  try {
    const raw = localStorage.getItem(storageKeys.progress);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = { currentTime, updatedAt: new Date().toISOString() };
    localStorage.setItem(storageKeys.progress, JSON.stringify(map));
  } catch {
    // ignore localStorage issues
  }
};

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(storageKeys.theme);
    if (saved === 'dark') return 'dark';
    if (saved === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [route, setRoute] = useState<'home' | 'catalog' | 'library' | 'cycle' | 'author' | 'lecture' | 'category' | 'about'>(() => parseHash());
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    if (!currentLectureId) return;
    const lecture = getLectureById(currentLectureId);
    if (!lecture || !audioRef.current) return;

    const audio = audioRef.current;
    const savedCurrent = getAudioProgress(currentLectureId);
    audio.src = lecture.audioUrl;
    audio.load();

    if (savedCurrent > 0) {
      audio.currentTime = savedCurrent;
    }

    if (playerState.isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentLectureId, playerState.isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    audio.playbackRate = playerState.rate;
    if (playerState.isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playerState.rate, playerState.isPlaying]);

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
    if (currentLectureId) saveProgress(currentLectureId, value);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (repeatSegment.active && repeatSegment.start !== null && repeatSegment.end !== null && audio.currentTime >= repeatSegment.end) {
      audio.currentTime = repeatSegment.start;
    }
    if (currentLectureId) saveProgress(currentLectureId, audio.currentTime);
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
    if (saved > 0 && saved < audio.duration) {
      audio.currentTime = saved;
    }
    setPlayerState((prev) => ({
      ...prev,
      duration: audio.duration || prev.duration,
      currentTime: saved > 0 && saved < audio.duration ? saved : prev.currentTime
    }));
  };

  const addBookmark = () => {
    if (!currentLectureId || playerState.currentTime <= 0) return;
    const time = Math.floor(playerState.currentTime);
    const id = `${currentLectureId}-${time}`;
    setBookmarks((prev) => [{ id, lectureId: currentLectureId, time, createdAt: new Date().toISOString() }, ...prev.filter((item) => item.id !== id)].slice(0, 100));
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
    if (repeatLesson && audioRef.current) {
      audioRef.current.currentTime = 0;
      setPlayerState((prev) => ({ ...prev, currentTime: 0, isPlaying: true }));
      return;
    }
    if (repeatSegment.active) {
      clearRepeat();
    }
    const currentIndex = lectureData.findIndex((lecture) => lecture.id === currentLectureId);
    const next = lectureData[currentIndex + 1] || lectureData[0];
    setCurrentLectureId(next.id);
    setPlayerState((prev) => ({ ...prev, isPlaying: true, currentTime: 0 }));
    pushHistory(next.id);
  };

  const prevLecture = () => {
    if (!currentLectureId) return;
    const index = lectureData.findIndex((lecture) => lecture.id === currentLectureId);
    const prev = lectureData[index - 1] || lectureData[lectureData.length - 1];
    setCurrentLectureId(prev.id);
    setPlayerState((prevState) => ({ ...prevState, isPlaying: true, currentTime: 0 }));
    pushHistory(prev.id);
  };

  const nextLecture = () => {
    if (!currentLectureId) return;
    const index = lectureData.findIndex((lecture) => lecture.id === currentLectureId);
    const next = lectureData[index + 1] || lectureData[0];
    setCurrentLectureId(next.id);
    setPlayerState((prevState) => ({ ...prevState, isPlaying: true, currentTime: 0 }));
    pushHistory(next.id);
  };

  const handleOpenLecture = (lectureId: string) => {
    setCurrentLectureId(lectureId);
    setPlayerState((prev) => ({ ...prev, isPlaying: true, currentTime: getAudioProgress(lectureId) }));
    pushHistory(lectureId);
    navigate(`/lecture/${lectureId}`);
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
        />
      );
    }

    if (route === 'cycle') {
      const cycleId = window.location.hash.replace(/^#\/cycle\//, '');
      const cycleLectures = lectureData.filter((lecture) => lecture.cycleId === cycleId);
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
        <header className="sticky top-3 z-40 mb-8">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(17,24,32,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101010]/85">
            <button className="flex items-center gap-3" onClick={() => navigate('/')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111820] text-sm font-bold text-[#F2F6FA] dark:bg-[#F5F5F5] dark:text-[#111820]">
                A
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
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/catalog')}>
                Категории
              </button>
              <button className="text-sm text-text/80 transition hover:text-text dark:text-darktext/80 dark:hover:text-darktext" onClick={() => navigate('/author/abu-yahya-krymskiy')}>
                Авторы
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
            { label: 'Автор', icon: <Headphones size={16} />, path: '/author/abu-yahya-krymskiy' }
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

      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPause={() => setPlayerState((prev) => ({ ...prev, isPlaying: false }))}
        onPlay={() => setPlayerState((prev) => ({ ...prev, isPlaying: true }))}
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
  getProgress
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

function LecturePage({ lecture, favorites, onToggleFavorite, onOpenLecture, currentLectureId, setCurrentLectureId, playerState, setPlayerState, audioRef, prevLecture, nextLecture, onSeek, onTogglePlay, handleTimeUpdate, handleLoadedMetadata, handleEnded, getProgress, bookmarks, onAddBookmark, onRemoveBookmark, repeatSegment, onSetRepeatPoint, onClearRepeat, repeatLesson, onToggleRepeatLesson }: {
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
  repeatSegment: { start: number | null; end: number | null; active: boolean };
  onSetRepeatPoint: () => void;
  onClearRepeat: () => void;
  repeatLesson: boolean;
  onToggleRepeatLesson: () => void;
}) {
  const cycleLectures = lectureData.filter((item) => item.cycleId === lecture.cycleId);
  const progress = getProgress(lecture.id);

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
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Закладки этой лекции</div>
            <div className="flex flex-wrap gap-2">
              {bookmarks.map((item) => (
                <div key={item.id} className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white pl-3 text-sm dark:border-white/10 dark:bg-[#101010]">
                  <button onClick={() => onSeek(item.time)} className="py-2 text-text dark:text-darktext">{formatDuration(item.time)}</button>
                  <button onClick={() => onRemoveBookmark(item.id)} aria-label={`Удалить закладку ${formatDuration(item.time)}`} className="px-2 py-2 text-muted dark:text-darkmuted">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
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

function LibraryPage({ continueLectures, favoriteLectures, recentLectures, onOpenLecture, onToggleFavorite, favorites, getProgress }: {
  continueLectures: Lecture[];
  favoriteLectures: Lecture[];
  recentLectures: Lecture[];
  onOpenLecture: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  getProgress: (id: string) => number;
}) {
  return (
    <main className="space-y-6">
      <section className="panel p-6">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Личный раздел</div>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">Моя библиотека</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><div className="text-sm text-muted dark:text-darkmuted">Продолжить прослушивание</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{continueLectures.length}</div></div>
        <div className="panel p-5"><div className="text-sm text-muted dark:text-darkmuted">Избранные лекции</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{favoriteLectures.length}</div></div>
        <div className="panel p-5"><div className="text-sm text-muted dark:text-darkmuted">Последние открытые</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{recentLectures.length}</div></div>
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

function LectureCard({ lecture, onOpen, isFavorite, onToggleFavorite, progress }: {
  lecture: Lecture;
  onOpen: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  progress: number;
}) {
  return (
    <article className="panel group p-0">
      <div onClick={onOpen} className="cursor-pointer p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">{lecture.category}</div>
            <h3 className="mt-2 font-display text-2xl leading-tight text-text dark:text-darktext">{lecture.title}</h3>
          </div>

          <button className="rounded-full border border-black/5 bg-white p-2 text-sm dark:border-white/10 dark:bg-[#101010]" onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} aria-label="Toggle favorite">
            <Heart size={15} fill={isFavorite ? '#B8874A' : 'none'} className={isFavorite ? 'text-[#B8874A]' : 'text-muted dark:text-darkmuted'} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted dark:text-darkmuted">
          <span>{lecture.author}</span>
          <span>{lecture.cycle}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted dark:text-darkmuted">
          <div className="flex items-center gap-1"><BookOpenText size={13} /> Урок {lecture.lessonNumber}</div>
          <div className="flex items-center justify-end gap-1"><Clock3 size={13} /> {formatDuration(lecture.duration)}</div>
        </div>

        <p className="mt-4 text-sm text-muted dark:text-darkmuted">{lecture.description}</p>

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
  if (!lecture) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-5">
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

function AboutPage() {
  return (
    <main className="space-y-6">
      <section className="panel p-7 sm:p-10">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">О проекте</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-none tracking-[-0.04em] text-text dark:text-darktext">Цифровая библиотека, построенная вокруг достоверности.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted dark:text-darkmuted">AL-FIRQA AN-NAJIYA собирает проверяемые аудиоматериалы в спокойную образовательную среду. Мы не публикуем неподтверждённые конспекты, цитаты или статистику активности.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Архив</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{lectureData.length}</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">опубликованных аудиозаписей</p></div>
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Циклы</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">{cycles.length}</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">учебный цикл в текущем каталоге</p></div>
        <div className="panel p-5"><div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Фокус</div><div className="mt-3 font-display text-3xl text-text dark:text-darktext">Да</div><p className="mt-2 text-sm text-muted dark:text-darkmuted">без фиктивных материалов</p></div>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Что появится дальше</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {['Структурированные конспекты после получения расшифровок', 'Тексты, книги и словарь только с подтверждёнными источниками', 'Синхронизация заметок и прогресса после подключения Supabase', 'Редакторская проверка AI-черновиков до публикации'].map((item) => (
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
