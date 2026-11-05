import { bookData } from './data/books';
import { cycles, orderedCycleLectures } from './data/catalog';

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export function BooksPage({ onOpenCycle }: { onOpenCycle: (id: string) => void }) {
  return (
    <main className="space-y-8">
      <section className="panel p-7 sm:p-10">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Библиотека книг</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-none tracking-[-0.04em] text-text dark:text-darktext">Книги и аудиокурсы</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted dark:text-darkmuted">В библиотеке доступна разрешённая копия PDF «Три основы» и связанные текстовые материалы. Ссылки на официальные источники сохранены, а аудиоуроки собраны в последовательные учебные циклы.</p>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Книги</div>
          <h2 className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Доступные издания</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {bookData.map((book) => {
            const cycle = cycles.find((item) => item.id === book.cycleId);
            return (
              <article key={book.id} className="panel flex flex-col p-6">
                <div className="text-xs uppercase tracking-[0.12em] text-[#8C5B22] dark:text-[#F3B76B]">{book.subtitle}</div>
                <h3 className="mt-3 font-display text-2xl leading-tight text-text dark:text-darktext">{book.title}</h3>
                <div className="mt-2 text-sm text-muted dark:text-darkmuted">{book.author}</div>
                <p className="mt-4 flex-1 text-sm leading-6 text-muted dark:text-darkmuted">{book.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#111820] px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 dark:bg-[#F5F5F5] dark:text-[#111820]">Открыть PDF</a>
                  <a href={book.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-black/10 px-4 py-2.5 text-sm text-text transition hover:-translate-y-0.5 dark:border-white/10 dark:text-darktext">Страница источника</a>
                  {cycle && <button onClick={() => onOpenCycle(cycle.id)} className="rounded-full border border-[#B8874A]/30 bg-[#B8874A]/10 px-4 py-2.5 text-sm text-[#8C5B22] transition hover:-translate-y-0.5 dark:border-[#E0821E]/30 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">Слушать {cycle.totalLessons} уроков</button>}
                </div>
              </article>
            );
          })}
        </div>
        <p className="text-xs leading-5 text-muted dark:text-darkmuted">PDF «Три основы» и тексты курсов размещены с разрешения правообладателя; исходные страницы указаны рядом с материалами. Аудио воспроизводится онлайн и не включается в офлайн-кэш.</p>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Аудиосборники</div>
          <h2 className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Слушать по порядку</h2>
        </div>
        <CycleCollectionGrid onOpenCycle={onOpenCycle} />
      </section>
    </main>
  );
}

export function CoursesPage({ onOpenCycle }: { onOpenCycle: (id: string) => void }) {
  return (
    <main className="space-y-6">
      <section className="panel p-7 sm:p-10">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Учебные циклы</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-none tracking-[-0.04em] text-text dark:text-darktext">Аудиокурсы</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted dark:text-darkmuted">Полные серии лекций с порядком уроков, прослушиванием и сохранением прогресса.</p>
      </section>
      <CycleCollectionGrid onOpenCycle={onOpenCycle} />
    </main>
  );
}

function CycleCollectionGrid({ onOpenCycle }: { onOpenCycle: (id: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cycles.map((cycle) => {
        const lessons = orderedCycleLectures(cycle.id);
        return (
          <button key={cycle.id} onClick={() => onOpenCycle(cycle.id)} className="panel overflow-hidden p-0 text-left transition hover:-translate-y-0.5">
            <div className={`h-28 bg-gradient-to-br ${cycle.coverTone}`} />
            <div className="p-5">
              <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">{cycle.author}</div>
              <h3 className="mt-3 font-display text-2xl leading-tight text-text dark:text-darktext">{cycle.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted dark:text-darkmuted">{cycle.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span className="text-text dark:text-darktext">{lessons.length} уроков</span>
                <span className="text-muted dark:text-darkmuted">{lessons.every((lecture) => lecture.duration > 0) ? formatDuration(lessons.reduce((sum, lecture) => sum + lecture.duration, 0)) : 'Длительность уточняется'}</span>
              </div>
              <div className="mt-4 text-sm font-medium text-[#8C5B22] dark:text-[#F3B76B]">Открыть цикл →</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
