import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { Category, Lecture } from './types';

export type SortType = 'newest' | 'title' | 'author' | 'duration';

export function CatalogPage({
  lectures,
  search,
  setSearch,
  sort,
  setSort,
  categoryFilter,
  setCategoryFilter,
  authorFilter,
  setAuthorFilter,
  cycleFilter,
  setCycleFilter,
  uniqueAuthors,
  uniqueCycles,
  categories,
  renderLectureCard
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
  cycleFilter: string;
  setCycleFilter: (value: string) => void;
  uniqueAuthors: string[];
  uniqueCycles: string[];
  categories: Category[];
  renderLectureCard: (lecture: Lecture) => ReactNode;
}) {
  const hasActiveFilters = Boolean(search.trim()) || categoryFilter !== 'Все' || authorFilter !== 'Все' || cycleFilter !== 'Все' || sort !== 'newest';
  const resetFilters = () => { setSearch(''); setCategoryFilter('Все'); setAuthorFilter('Все'); setCycleFilter('Все'); setSort('newest'); };

  return (
    <main className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Каталог</div>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-[-0.04em] text-text dark:text-darktext sm:text-4xl">Лекции</h1>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-muted focus-within:ring-2 focus-within:ring-[#B8874A]/60 sm:max-w-xl dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted">
            <Search size={16} />
            <input
              value={search}
              aria-label="Поиск по лекциям"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти лекцию, шейха или тему…"
              className="min-w-0 w-full bg-transparent outline-none placeholder:text-muted dark:placeholder:text-darkmuted"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
            <label htmlFor="catalog-category" className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Категория</label>
            <select
              id="catalog-category"
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
            <label htmlFor="catalog-author" className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Автор</label>
            <select
              id="catalog-author"
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
            <label htmlFor="catalog-cycle" className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Учебный цикл</label>
            <select
              id="catalog-cycle"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext"
            >
              {uniqueCycles.map((cycle) => <option key={cycle} value={cycle}>{cycle === 'Все' ? 'Все циклы' : cycle}</option>)}
            </select>
          </div>

          <div className="rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
            <label htmlFor="catalog-sort" className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Сортировка</label>
            <select
              id="catalog-sort"
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
        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={resetFilters} className="min-h-11 rounded-full border border-black/10 px-4 py-2 text-sm text-muted transition hover:bg-black/5 dark:border-white/10 dark:text-darkmuted dark:hover:bg-white/10">
              Сбросить поиск и фильтры
            </button>
          </div>
        )}
      </section>

      <div role="status" aria-live="polite" className="flex flex-col gap-1 text-sm text-muted dark:text-darkmuted sm:flex-row sm:items-center sm:justify-between">
        <span>Найдено лекций: <strong className="font-medium text-text dark:text-darktext">{lectures.length}</strong></span>
        <span>Поиск по метаданным и описаниям; аудиотранскрипты пока не индексированы.</span>
      </div>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lectures.length ? (
          lectures.map((lecture) => renderLectureCard(lecture))
        ) : (
          <div className="panel col-span-full p-8 text-center">
            <div className="font-display text-2xl">Ничего не найдено</div>
            <p className="mt-2 text-sm text-muted dark:text-darkmuted">Попробуйте изменить поисковый запрос или фильтры.</p>
            {hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-5 min-h-11 rounded-full bg-[#111820] px-5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 dark:bg-[#F5F5F5] dark:text-[#111820]">Сбросить фильтры</button>}
          </div>
        )}
      </section>
    </main>
  );
}
