import type { Cycle, Lecture } from '../types';

const cycleId = 'chetyre-pravila-novye';
const sourcePage = 'https://abuyahya.net/lekcii/chetyre-pravila-novyj/';
const audioBase = 'https://files.abuyahya.net/Chetyre%20pravila%20(novye)';

const lessonDetails = [
  {
    duration: 4094,
    description: 'Тематический план: место изучения книги после «Трёх основ»; басмала в начале трудов учёных; понятие аулия и виды табаррука; упование и благодарность Аллаху; проявления благодарности и терпения; поведение во время испытаний и причины счастья.'
  },
  {
    duration: 3623,
    description: 'Тематический план: ханифия и важность таухида; связь поклонения с таухидом; ширк и его проявления; заступничество и его условия; вопросы о просьбе сделать дуа.'
  },
  {
    duration: 3647,
    description: 'Тематический план: цель изучения четырёх правил; признание многобожниками таухида ар-рубубия; обращение к посредникам ради приближения к Аллаху; сравнение проявлений ширка и важное разъяснение лектора.'
  }
];

export const chetyrePravilaNovyeLectures: Lecture[] = lessonDetails.map((lesson, index) => {
  const number = index + 1;
  const sourceFileName = `${number}. Chetyre pravila.mp3`;
  return {
    id: `${cycleId}-${number}`,
    title: `Лекция №${number} — Четыре правила`,
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Акыда',
    cycle: 'Четыре правила (новый)',
    cycleId,
    lessonNumber: number,
    duration: lesson.duration,
    description: `${lesson.description} Краткое тематическое описание составлено по плану на странице источника; полной стенограммы там нет.`,
    audioUrl: `${audioBase}/${encodeURIComponent(sourceFileName)}`,
    date: '2025-07-04',
    tags: ['акыда', 'таухид', 'четыре правила'],
    sourceUrl: sourcePage,
    sourceFileName
  };
});

export const chetyrePravilaNovyeCycle: Cycle = {
  id: cycleId,
  title: 'Четыре правила (новый)',
  author: 'Абу Яхья Крымский',
  authorId: 'abu-yahya-krymskiy',
  description: 'Три аудиолекции по книге «Четыре правила». Аудио воспроизводится с сайта-источника; тематические описания составлены по опубликованному плану лекций.',
  totalLessons: chetyrePravilaNovyeLectures.length,
  totalDuration: chetyrePravilaNovyeLectures.reduce((sum, lecture) => sum + lecture.duration, 0),
  coverTone: 'from-slate-200 via-stone-100 to-white',
  sourceUrl: sourcePage
};
