import { lectureNotesById, type LectureNote, type LectureNoteEvidence } from './data/lectureNotes';

function EvidenceEntry({ item }: { item: LectureNoteEvidence }) {
  return (
    <details id={item.id} className="border-t border-black/5 py-4 first:border-t-0 dark:border-white/10">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-[#B8874A] dark:text-darktext">
        <span className="font-medium">{item.reference} <span className="font-normal text-muted dark:text-darkmuted">· {item.title}</span></span>
        <span className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">{item.kind === 'quran' ? 'Коран' : 'Хадис'} · раскрыть</span>
      </summary>
      <div className="mt-4 space-y-4 text-sm leading-7 text-text dark:text-darktext">
        {item.arabicOriginal && (
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Арабский оригинал</div>
            <p lang="ar" dir="rtl" className="font-serif text-right text-xl leading-[2.2] text-text dark:text-darktext">{item.arabicOriginal}</p>
          </div>
        )}
        {item.russianTranslation && (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Русский перевод</div>
            <p>{item.russianTranslation}</p>
            {item.translationAttribution && <p className="mt-1 text-xs leading-5 text-muted dark:text-darkmuted">{item.translationAttribution}</p>}
            {item.translationStatus && <p className="mt-1 text-xs leading-5 text-muted dark:text-darkmuted">{item.translationStatus}</p>}
          </div>
        )}
        {item.grading && <p className="border-l-2 border-[#B8874A]/50 pl-3 text-xs leading-6 text-muted dark:border-[#E0821E]/50 dark:text-darkmuted">Оценка / атрибуция: {item.grading}</p>}
        {item.editorialNote && <p className="border-l-2 border-[#B8874A]/50 pl-3 text-xs leading-6 text-muted dark:border-[#E0821E]/50 dark:text-darkmuted">Редакционное примечание: {item.editorialNote}</p>}
        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline decoration-[#B8874A]/50 underline-offset-4 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8874A]">Открыть первоисточник</a>
      </div>
    </details>
  );
}

function NoteContent({ note, onSeek }: { note: LectureNote; onSeek: (seconds: number) => void }) {
  return (
    <>
      <div className="mt-5 border-t border-black/5 pt-5 dark:border-white/10">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Краткое содержание</div>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-text dark:text-darktext">{note.summary}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Основные положения</h3>
          <ol className="mt-3 space-y-3">
            {note.keyPoints.map((point, index) => (
              <li key={point} className="flex gap-3 text-sm leading-6 text-text dark:text-darktext">
                <span className="shrink-0 font-display text-lg text-muted dark:text-darkmuted">{String(index + 1).padStart(2, '0')}</span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Термины</h3>
          <dl className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {note.terms.map((term) => (
              <div key={term.term} className="py-3 first:pt-0">
                <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium text-text dark:text-darktext">
                  <span lang="ar" dir="rtl" className="font-serif text-lg">{term.arabic}</span>
                  <span>{term.transliteration}</span>
                </dt>
                <dd className="mt-1 text-xs leading-6 text-muted dark:text-darkmuted">{term.explanation}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-7">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Подробный конспект</h3>
        <div className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {note.sections.map((section) => (
            <div key={section.heading} className="flex items-start gap-2 border-t border-black/5 py-3 first:border-t-0 dark:border-white/10">
              <details className="min-w-0 flex-1">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#B8874A]">
                  <span className="font-medium text-text dark:text-darktext">{section.heading}</span>
                  <span className="text-xs text-muted dark:text-darkmuted">{section.timestamp}</span>
                </summary>
                <div className="mt-3 max-w-4xl space-y-3 pl-0 text-sm leading-7 text-text dark:text-darktext sm:pl-2">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {!!section.points?.length && <ul className="list-disc space-y-2 pl-5 text-muted dark:text-darkmuted">{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
                  <div className="border-t border-black/5 pt-3 text-xs leading-6 text-muted dark:border-white/10 dark:text-darkmuted">
                    <span className="mr-2">Основа:</span>
                    <a href={note.audioSourceUrl} target="_blank" rel="noreferrer" className="mr-2 underline decoration-[#B8874A]/50 underline-offset-4">аудиозапись, {section.timestamp}</a>
                    {section.evidenceIds.map((id, index) => {
                      const source = note.evidence.find((item) => item.id === id);
                      if (!source) return null;
                      return <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="mr-2 min-h-11 underline decoration-[#B8874A]/50 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8874A]">{index === 0 ? 'Доводы: ' : ''}{source.reference}</button>;
                    })}
                  </div>
                </div>
              </details>
              <button type="button" onClick={() => onSeek(section.startSeconds)} aria-label={`Перейти к ${section.timestamp}: ${section.heading}`} className="min-h-11 shrink-0 rounded-full px-3 text-xs text-muted underline decoration-[#B8874A]/50 underline-offset-4 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8874A] dark:text-darkmuted dark:hover:text-darktext">Слушать</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-7">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Доказательства и источники</h3>
        <p className="mt-2 text-xs leading-6 text-muted dark:text-darkmuted">Арабский текст и перевод аятов приведены рядом. Для хадисов указаны точные сборники и статус перевода; неофициальные рабочие переводы помечены отдельно.</p>
        <div className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {note.evidence.map((item) => <EvidenceEntry key={item.id} item={item} />)}
        </div>
      </div>

      <div className="mt-7 grid gap-6 border-t border-black/5 pt-5 dark:border-white/10 lg:grid-cols-2">
        <div>
          <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Итоги</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-text dark:text-darktext">{note.conclusions.map((item) => <li key={item} className="border-l border-[#B8874A]/40 pl-3">{item}</li>)}</ul>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Редакторские замечания</h3>
          <ul className="mt-3 space-y-2 text-xs leading-6 text-muted dark:text-darkmuted">{note.editorialNotes.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>

      <div className="mt-7 border-t border-black/5 pt-5 dark:border-white/10">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Связанные материалы</h3>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {note.relatedMaterials.map((material) => (
            <a key={material.url} href={material.url} target="_blank" rel="noreferrer" className="group block min-h-11 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-[#B8874A] dark:text-darktext">
              <span className="underline decoration-[#B8874A]/50 underline-offset-4 group-hover:decoration-current">{material.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted dark:text-darkmuted">{material.description}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

export function LectureNotes({ lectureId, onSeek }: { lectureId: string; onSeek: (seconds: number) => void }) {
  const note = lectureNotesById[lectureId];

  if (!note) {
    return (
      <section className="panel p-5" aria-labelledby="lecture-notes-heading">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Учебные материалы</div>
        <h2 id="lecture-notes-heading" className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Конспект лекции</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted dark:text-darkmuted">Проверенный конспект для этой лекции ещё не опубликован. Здесь не показываются автоматически сгенерированные религиозные цитаты или неподтверждённые заметки.</p>
      </section>
    );
  }

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="lecture-notes-heading">
      <header className="flex flex-col gap-3 border-b border-black/5 pb-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Конспект · версия {note.version}</div>
          <h2 id="lecture-notes-heading" className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">{note.title}</h2>
          <p className="mt-2 text-sm text-muted dark:text-darkmuted">{note.author}</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-[#B8874A]/30 px-3 py-1.5 text-xs text-muted dark:border-[#E0821E]/30 dark:text-darkmuted">
          {note.editorialStatus === 'reviewed' ? 'Проверено редактором' : 'Черновик · ожидает проверки'}
        </span>
      </header>

      <div className="mt-4 grid gap-x-8 gap-y-2 text-xs leading-6 text-muted dark:text-darkmuted sm:grid-cols-2">
        <p><span className="text-text dark:text-darktext">Источник:</span> <a href={note.courseSourceUrl} target="_blank" rel="noreferrer" className="underline decoration-[#B8874A]/50 underline-offset-4">официальная страница цикла</a> и исходная запись.</p>
        <p><span className="text-text dark:text-darktext">Подготовлено:</span> {note.preparedAt}. <span className="text-text dark:text-darktext">Редакция:</span> {note.revisionDate}.</p>
        <p><span className="text-text dark:text-darktext">Редактор:</span> {note.reviewer || 'не назначен'}{note.reviewedAt ? ` · проверено ${note.reviewedAt}` : ' · проверка не проведена'}.</p>
        <p>{note.sourceMethod}</p>
      </div>
      <NoteContent note={note} onSeek={onSeek} />
    </section>
  );
}
