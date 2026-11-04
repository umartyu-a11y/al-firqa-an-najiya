import { Bookmark, Clock3, Heart, Headphones } from 'lucide-react';
import type { LearningDashboardSnapshot } from './lib/learningDashboard';

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const statusTone = (mode: LearningDashboardSnapshot['storage']['mode']) => {
  if (mode === 'cloud-ready') return 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300';
  if (mode === 'offline' || mode === 'local-fallback') return 'border-amber-600/20 bg-amber-600/10 text-amber-900 dark:text-amber-300';
  return 'border-black/10 bg-[#F7F9FC] text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted';
};

export function LearningDashboard({
  snapshot,
  onOpenLecture,
  onOpenCatalog,
  onShowFavorites,
  onShowBookmarks
}: {
  snapshot: LearningDashboardSnapshot;
  onOpenLecture: (lectureId: string) => void;
  onOpenCatalog: () => void;
  onShowFavorites: () => void;
  onShowBookmarks: () => void;
}) {
  const { overview, recentActivity, savedResources, storage } = snapshot;
  const metrics = [
    { label: 'Уроки с сохранённой позицией', value: `${overview.trackedLessons} / ${overview.availableLessons}`, icon: <Headphones size={16} /> },
    { label: 'Циклы с сохранённой позицией', value: `${overview.cyclesWithProgress} / ${overview.availableCycles}`, icon: <Clock3 size={16} /> },
    { label: 'Избранные лекции', value: String(overview.favoriteCount), icon: <Heart size={16} /> },
    { label: 'Закладки и заметки', value: String(overview.bookmarkCount), icon: <Bookmark size={16} /> }
  ];

  return (
    <section aria-labelledby="learning-dashboard-title" className="panel space-y-6 p-5 sm:p-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Личная панель</div>
          <h2 id="learning-dashboard-title" className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Обзор обучения</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">Сводка построена только по сохранённым позициям, истории, избранному и закладкам. Прослушанное не считается завершённым без отдельного действия.</p>
        </div>
        <span role="status" className={`inline-flex w-fit max-w-sm rounded-full border px-3 py-2 text-xs leading-5 ${statusTone(storage.mode)}`}>{storage.label}</span>
      </header>

      <div className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-4 text-sm leading-6 text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">
        <p>{storage.description}</p>
        <p className="mt-1 text-xs">Локальный режим включён всегда; облачный статус относится только к тем данным, которые поддерживает адаптер синхронизации.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-[#101010]/60">
            <div className="flex items-center gap-2 text-xs leading-5 text-muted dark:text-darkmuted">{metric.icon}<span>{metric.label}</span></div>
            <div className="mt-3 font-display text-2xl text-text dark:text-darktext">{metric.value}</div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="dashboard-recent-title" className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 id="dashboard-recent-title" className="text-sm font-semibold text-text dark:text-darktext">Недавно открывали</h3>
            <span className="text-xs text-muted dark:text-darkmuted">по локальной истории</span>
          </div>
          {recentActivity.length ? (
            <ul className="mt-3 space-y-2">
              {recentActivity.map((item) => (
                <li key={item.lectureId}>
                  <button type="button" onClick={() => onOpenLecture(item.lectureId)} aria-label={`Открыть лекцию ${item.title}`} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/70 p-3 text-left transition hover:border-[#B8874A]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8874A] dark:border-white/10 dark:bg-[#101010]/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text dark:text-darktext">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted dark:text-darkmuted">{item.author} · {item.cycle}</span>
                    </span>
                    <span className="shrink-0 text-right text-[11px] text-muted dark:text-darkmuted">{item.savedPosition ? `Позиция ${formatTime(item.savedPosition.currentTime)} / ${formatTime(item.savedPosition.duration)}` : 'Позиция не сохранена'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-black/10 p-4 dark:border-white/10">
              <p className="text-sm leading-6 text-muted dark:text-darkmuted">История пока пуста. Откройте урок — он появится здесь.</p>
              <button type="button" onClick={onOpenCatalog} className="mt-3 rounded-full bg-[#111820] px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8874A] dark:bg-[#F5F5F5] dark:text-[#111820]">Найти лекцию</button>
            </div>
          )}
        </section>

        <section aria-labelledby="dashboard-saved-title" className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 id="dashboard-saved-title" className="text-sm font-semibold text-text dark:text-darktext">Сохранённые материалы</h3>
            <span className="text-xs text-muted dark:text-darkmuted">избранное и закладки</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-[#101010]/60">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-text dark:text-darktext">Избранное</span><span className="text-xs text-muted dark:text-darkmuted">{overview.favoriteCount}</span></div>
              {savedResources.favorites.length ? <ul className="mt-2 space-y-1.5">{savedResources.favorites.slice(0, 3).map((item) => <li key={item.lectureId}><button type="button" onClick={() => onOpenLecture(item.lectureId)} className="block w-full truncate rounded-lg py-1 text-left text-xs text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8874A] dark:text-darkmuted dark:hover:text-darktext">{item.title}</button></li>)}</ul> : <p className="mt-2 text-xs leading-5 text-muted dark:text-darkmuted">Пока нет избранных лекций.</p>}
              {overview.favoriteCount > 3 && <button type="button" onClick={onShowFavorites} className="mt-2 text-xs font-medium text-[#8C5B22] underline underline-offset-4 dark:text-[#F3B76B]">Все избранные</button>}
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-[#101010]/60">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-text dark:text-darktext">Закладки и заметки</span><span className="text-xs text-muted dark:text-darkmuted">{overview.bookmarkCount}</span></div>
              {savedResources.bookmarks.length ? <ul className="mt-2 space-y-1.5">{savedResources.bookmarks.slice(0, 2).map((item) => <li key={item.id} className="rounded-lg py-1"><span className="block truncate text-xs text-text dark:text-darktext">{item.title} · {formatTime(item.time)}</span><span className="mt-0.5 block truncate text-[11px] text-muted dark:text-darkmuted">{item.notePreview || (item.hasHandwriting ? 'Рукописная заметка' : item.tags.length ? item.tags.map((tag) => `#${tag}`).join(' ') : 'Закладка без текста')}</span></li>)}</ul> : <p className="mt-2 text-xs leading-5 text-muted dark:text-darkmuted">Пока нет сохранённых фрагментов.</p>}
              {overview.bookmarkCount > 0 && <button type="button" onClick={onShowBookmarks} className="mt-2 text-xs font-medium text-[#8C5B22] underline underline-offset-4 dark:text-[#F3B76B]">Открыть заметки</button>}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
