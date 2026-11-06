import { useEffect, useRef, useState } from 'react';
import { Bookmark, Download, Printer } from 'lucide-react';
import { CourseSourceText } from './CourseSourceText';
import { HandwritingPad } from './HandwritingPad';
import { LectureNotes } from './LectureNotes';
import { lectureOutlines, type LectureOutlineEntry } from './data/lecture-outlines';
import { abuyahyaAdditionalOutlines } from './data/abuyahya-extra-outlines';
import { formatDuration, getLectureTopicTitle, readQuizQuestions } from './lib/lecturePresentation';
import type { BookmarkItem, HandwritingStroke, Lecture, QuizQuestion } from './types';

function AudioTranscriptSection({ sourceUrl }: { sourceUrl?: string }) {
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const loadTranscript = async () => {
    if (status === 'loading' || status === 'loaded') return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setStatus('loading');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}transcripts/problema-zla.txt`, { signal: controller.signal });
      if (!response.ok) throw new Error('Transcript request failed');
      const text = await response.text();
      if (!text.trim()) throw new Error('Transcript is empty');
      if (!controller.signal.aborted) {
        setTranscript(text);
        setStatus('loaded');
      }
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    }
  };

  return (
    <section className="mt-4 max-w-2xl rounded-2xl border border-black/5 bg-[#F7F9FC] p-5 dark:border-white/10 dark:bg-[#171717]" aria-labelledby="audio-transcript-title">
      <details onToggle={(event) => { if (event.currentTarget.open && status === 'idle') void loadTranscript(); }}>
        <summary id="audio-transcript-title" className="cursor-pointer font-display text-xl text-text dark:text-darktext">Полная расшифровка аудиозаписи</summary>
        {status === 'loading' && <p className="mt-4 text-sm text-muted dark:text-darkmuted">Загружаем расшифровку…</p>}
        {status === 'error' && (
          <div className="mt-4 text-sm text-muted dark:text-darkmuted">
            <p>Не удалось загрузить текст расшифровки.</p>
            <button type="button" onClick={() => void loadTranscript()} className="mt-2 underline underline-offset-4">Повторить загрузку</button>
          </div>
        )}
        {status === 'loaded' && <div className="mt-4 max-h-[36rem] overflow-y-auto whitespace-pre-line pr-2 text-sm leading-7 text-text dark:text-darktext">{transcript}</div>}
      </details>
      <p className="mt-3 text-xs leading-5 text-muted dark:text-darkmuted">Автоматическая расшифровка аудио; возможны ошибки распознавания имён и религиозных терминов.</p>
      {sourceUrl && <a className="mt-3 inline-block text-xs underline underline-offset-4" href={sourceUrl} target="_blank" rel="noreferrer">Источник аудиозаписи: abuyahya.net</a>}
    </section>
  );
}

const resizeNoteField = (element: HTMLTextAreaElement | null) => {
  if (!element) return;
  element.style.height = 'auto';
  const maxHeight = Math.floor(window.innerHeight * 0.5);
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

export function LecturePage({ lecture, cycleLectures, favorites, onToggleFavorite, onOpenLecture, playerState, onSeek, onTogglePlay, bookmarks, onAddBookmark, onRemoveBookmark, onUpdateBookmarkNote, onUpdateBookmarkDrawing, onUpdateBookmarkTags, onExportText, onExportPdf, repeatSegment, onSetRepeatPoint, onClearRepeat, repeatLesson, onToggleRepeatLesson }: {
  lecture: Lecture;
  cycleLectures: Lecture[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenLecture: (id: string) => void;
  playerState: { isPlaying: boolean; currentTime: number };
  onSeek: (value: number) => void;
  onTogglePlay: () => void;
  bookmarks: BookmarkItem[];
  onAddBookmark: () => void;
  onRemoveBookmark: (id: string) => void;
  onUpdateBookmarkNote: (id: string, note: string) => void;
  onUpdateBookmarkDrawing: (id: string, handwriting: HandwritingStroke[]) => void;
  onUpdateBookmarkTags: (id: string, value: string) => void;
  onExportText: (items: BookmarkItem[]) => void;
  onExportPdf: (items: BookmarkItem[]) => void;
  repeatSegment: { start: number | null; end: number | null; active: boolean };
  onSetRepeatPoint: () => void;
  onClearRepeat: () => void;
  repeatLesson: boolean;
  onToggleRepeatLesson: () => void;
}) {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => readQuizQuestions(lecture.id));
  const [quizMode, setQuizMode] = useState<'take' | 'create'>('take');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftOptions, setDraftOptions] = useState(['', '', '', '']);
  const [draftCorrect, setDraftCorrect] = useState(0);
  const [sourceText, setSourceText] = useState('');
  const [additionalOutline, setAdditionalOutline] = useState<{ lectureId: string; entry: LectureOutlineEntry } | null>(null);

  useEffect(() => {
    setQuizQuestions(readQuizQuestions(lecture.id));
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizMode('take');
  }, [lecture.id]);

  useEffect(() => {
    setSourceText('');
    let textPromise: Promise<string> | null = null;
    if (lecture.cycleId === 'sharh-as-sunna') {
      textPromise = import('./data/sharh-as-sunna-texts').then(({ sharhAsSunnaTexts }) => sharhAsSunnaTexts[Number(lecture.lessonNumber)] || '');
    } else if (lecture.cycleId === 'metodologiya-myshleniya-o-realnosti' && Number(lecture.lessonNumber) === 1) {
      textPromise = import('./data/abuyahya-next-texts').then(({ abuyahyaNextTexts }) => abuyahyaNextTexts[lecture.id] || '');
    }
    if (!textPromise) return;
    let isCurrent = true;
    textPromise.then((text) => {
      if (isCurrent) setSourceText(text);
    }).catch(() => {
      if (isCurrent) setSourceText('');
    });
    return () => { isCurrent = false; };
  }, [lecture.cycleId, lecture.id, lecture.lessonNumber]);

  useEffect(() => {
    const additionalCyclePrefixes = [
      'zhizneopisanie-proroka-muhammada-',
      'hadis-vysshij-sonm-',
      'hadis-abu-bakra-',
      'metodologiya-myshleniya-o-realnosti-'
    ];
    if (!additionalCyclePrefixes.some((prefix) => lecture.id.startsWith(prefix))) {
      setAdditionalOutline(null);
      return;
    }
    let isCurrent = true;
    import('./data/abuyahya-next-outlines').then(({ abuyahyaNextOutlines }) => {
      if (isCurrent) {
        const entry = abuyahyaNextOutlines[lecture.id];
        setAdditionalOutline(entry ? { lectureId: lecture.id, entry } : null);
      }
    }).catch(() => {
      if (isCurrent) setAdditionalOutline(null);
    });
    return () => { isCurrent = false; };
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
      <section className="panel p-4 sm:p-6">
        <div className="max-w-4xl">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">{lecture.category}</div>
            <h1 className="mt-3 break-words font-display text-3xl leading-tight tracking-[-0.04em] text-text dark:text-darktext sm:text-4xl">{getLectureTopicTitle(lecture, lectureOutlines[lecture.id])}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted sm:text-base sm:leading-7">{lecture.description}</p>

            {(() => {
              const entry = lectureOutlines[lecture.id] ?? abuyahyaAdditionalOutlines[lecture.id] ?? (additionalOutline?.lectureId === lecture.id ? additionalOutline.entry : undefined);
              if (!entry) return null;
              const statusLabel = entry.status === 'text'
                ? 'Оглавление по тексту источника'
                : entry.status === 'plan'
                  ? 'План по материалу источника'
                  : entry.status === 'ambiguous'
                    ? 'Сопоставление требует проверки'
                    : 'Оглавление не подтверждено источником';
              return (
                <section className="mt-6 max-w-2xl rounded-2xl border border-black/5 bg-[#F7F9FC] p-5 dark:border-white/10 dark:bg-[#171717]" aria-labelledby="lecture-outline-title">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="lecture-outline-title" className="font-display text-xl text-text dark:text-darktext">Оглавление</h2>
                    <span className="text-xs text-muted dark:text-darkmuted">{statusLabel}</span>
                  </div>
                  {entry.outline.length > 0 ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-text dark:text-darktext">
                      {entry.outline.map((item, index) => <li key={`${lecture.id}-outline-${index}`}>{item}</li>)}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted dark:text-darkmuted">В доступном материале нет подтверждённого оглавления для этой аудиозаписи.</p>
                  )}
                  {entry.note && <p className="mt-3 text-xs leading-5 text-muted dark:text-darkmuted">Примечание: {entry.note}</p>}
                  {entry.sourceUrl && <a className="mt-3 inline-block text-xs underline underline-offset-4" href={entry.sourceUrl} target="_blank" rel="noreferrer">Проверить текст источника</a>}
                </section>
              );
            })()}

            {sourceText && (
              <section className="mt-4 max-w-2xl rounded-2xl border border-black/5 bg-[#F7F9FC] p-5 dark:border-white/10 dark:bg-[#171717]" aria-labelledby="lecture-transcript-title">
                <details>
                  <summary id="lecture-transcript-title" className="cursor-pointer font-display text-xl text-text dark:text-darktext">Читать текст лекции</summary>
                  <div className="mt-4 max-h-[36rem] overflow-y-auto whitespace-pre-line pr-2 text-sm leading-7 text-text dark:text-darktext">{sourceText}</div>
                </details>
                <a className="mt-3 inline-block text-xs underline underline-offset-4" href={lecture.sourceUrl} target="_blank" rel="noreferrer">Оригинал и источник текста: abuyahya.net</a>
                </section>
              )}

            {lecture.id === 'problema-zla-01' && <AudioTranscriptSection sourceUrl={lecture.sourceUrl} />}

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted dark:text-darkmuted">
              <span>{lecture.author}</span>
              <span>•</span>
              <span>{lecture.cycle}</span>
              <span>•</span>
              <span>{lecture.duration > 0 ? formatDuration(lecture.duration) : 'Длительность не указана'}</span>
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

        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Закладки и повторы</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={onAddBookmark} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext"><Bookmark size={15} /> Закладка на {formatDuration(playerState.currentTime)}</button>
          <button onClick={onSetRepeatPoint} className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm ${repeatSegment.start !== null && repeatSegment.end === null ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'border border-black/5 bg-[#F7F9FC] text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext'}`}>A: {repeatSegment.start === null ? '—' : formatDuration(repeatSegment.start)}</button>
          <button onClick={onSetRepeatPoint} disabled={repeatSegment.start === null} className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${repeatSegment.active ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'border border-black/5 bg-[#F7F9FC] text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext'}`}>B: {repeatSegment.end === null ? '—' : formatDuration(repeatSegment.end)}</button>
          {(repeatSegment.start !== null || repeatSegment.end !== null) && <button onClick={onClearRepeat} className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm text-muted underline underline-offset-4 dark:text-darkmuted">Сбросить A–B</button>}
          <button onClick={onToggleRepeatLesson} className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm ${repeatLesson ? 'bg-[#B8874A] text-white dark:bg-[#E0821E]' : 'border border-black/5 bg-[#F7F9FC] text-text dark:border-white/10 dark:bg-[#161616] dark:text-darktext'}`}>Повтор урока</button>
        </div>

        {bookmarks.length > 0 && (
          <div className="mt-4 rounded-2xl border border-black/5 bg-[#F7F9FC] p-4 dark:border-white/10 dark:bg-[#161616]">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Закладки этой лекции</div>
              <div className="flex items-center gap-2">
                <button onClick={() => onExportText(bookmarks)} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-black/5 px-3 py-2 text-xs text-muted dark:border-white/10 dark:text-darkmuted"><Download size={13} /> TXT</button>
                <button onClick={() => onExportPdf(bookmarks)} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-black/5 px-3 py-2 text-xs text-muted dark:border-white/10 dark:text-darkmuted"><Printer size={13} /> PDF</button>
              </div>
            </div>
            <div className="space-y-3">
              {bookmarks.map((item) => (
                <div key={item.id} className="rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#101010]">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => onSeek(item.time)} className="font-medium text-text underline decoration-[#B8874A]/50 underline-offset-4 dark:text-darktext">{formatDuration(item.time)}</button>
                    <button onClick={() => onRemoveBookmark(item.id)} aria-label={`Удалить закладку ${formatDuration(item.time)}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/5 px-3 text-sm text-muted dark:border-white/10 dark:text-darkmuted">Удалить</button>
                  </div>
                  <textarea ref={resizeNoteField} value={item.note || ''} onInput={(event) => resizeNoteField(event.currentTarget)} onChange={(event) => onUpdateBookmarkNote(item.id, event.target.value)} maxLength={500} rows={2} placeholder="Добавить заметку к этому фрагменту…" aria-label={`Заметка к закладке ${formatDuration(item.time)}`} className="mt-2 w-full resize-y rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-sm text-text outline-none placeholder:text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darktext dark:placeholder:text-darkmuted" />
                  <HandwritingPad label={`Рисунок к закладке ${formatDuration(item.time)}`} strokes={item.handwriting} onChange={(drawing) => onUpdateBookmarkDrawing(item.id, drawing)} />
                  <input value={(item.tags || []).join(', ')} onChange={(event) => onUpdateBookmarkTags(item.id, event.target.value)} placeholder="Теги через запятую: акыда, повторить" aria-label={`Теги к закладке ${formatDuration(item.time)}`} className="mt-2 w-full rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-xs text-text outline-none placeholder:text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darktext dark:placeholder:text-darkmuted" />
                  {!!item.tags?.length && <div className="mt-2 flex flex-wrap gap-1.5">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-[#B8874A]/10 px-2 py-1 text-[11px] text-[#8A612E] dark:bg-[#E0821E]/10 dark:text-[#E5A35B]">#{tag}</span>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <LectureNotes lectureId={lecture.id} onSeek={onSeek} />
      <CourseSourceText lecture={lecture} />

      <section className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Самопроверка</div><h2 className="mt-2 font-display text-2xl leading-tight tracking-[-0.04em] text-text dark:text-darktext sm:text-3xl">Тест по лекции</h2><p className="mt-2 text-sm leading-6 text-muted dark:text-darkmuted">Создайте вопросы по материалу лекции и пройдите их позже без подключения к сети.</p></div>
          <div className="flex shrink-0 gap-2"><button onClick={() => { setQuizMode('take'); setQuizSubmitted(false); }} className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs ${quizMode === 'take' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/5 text-muted dark:border-white/10 dark:text-darkmuted'}`}>Пройти</button><button onClick={() => setQuizMode('create')} className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs ${quizMode === 'create' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/5 text-muted dark:border-white/10 dark:text-darkmuted'}`}>Создать</button></div>
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
              <button key={cycleLecture.id} onClick={() => onOpenLecture(cycleLecture.id)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left ${cycleLecture.id === lecture.id ? 'border-[#B8874A]/30 bg-[#B8874A]/5 dark:border-[#E0821E]/30 dark:bg-[#E0821E]/5' : 'border-black/5 bg-[#F7F9FC] dark:border-white/10 dark:bg-[#161616]'}`}>
                <div>
                  <div className="text-xs uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Урок {cycleLecture.lessonNumber}</div>
                  <div className="mt-1 text-sm font-medium text-text dark:text-darktext">{cycleLecture.title}</div>
                </div>
                <div className="text-sm text-muted dark:text-darkmuted">{cycleLecture.duration > 0 ? formatDuration(cycleLecture.duration) : '—'}</div>
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
