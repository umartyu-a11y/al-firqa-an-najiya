import type { Cycle, Lecture } from '../types';

const cycleId = 'tri-osnovy';
const sourcePage = 'https://abuyahya.net/lekcii/akida/tri-osnovy/';
const audioBase = 'https://files.abuyahya.net/Tri_osnovy';

const lessonDetails = [
  { duration: 2135, title: 'Три основы' },
  { duration: 3037, title: 'Три основы' },
  { duration: 3566, title: 'Три основы' },
  { duration: 2578, title: 'Три основы' },
  { duration: 1843, title: 'Три основы' },
  { duration: 2542, title: 'Три основы' },
  { duration: 2849, title: 'Три основы' },
  { duration: 2117, title: 'Три основы' },
  { duration: 2532, title: 'Три основы' },
  { duration: 2658, title: 'Три основы' },
  { duration: 2987, title: 'Три основы' },
  { duration: 3089, title: 'Три основы' },
  { duration: 3446, title: 'Три основы' },
  { duration: 2809, title: 'Три основы' },
  { duration: 2117, title: 'Три основы' },
  { duration: 3318, title: 'Три основы' },
  { duration: 1986, title: 'Три основы' },
  { duration: 3065, title: 'Три основы' }
];

export const triOsnovyLectures: Lecture[] = lessonDetails.map((lesson, index) => {
  const number = index + 1;
  const padded = String(number).padStart(2, '0');
  const sourceFileName = `${padded}._Tri_osnovy.mp3`;
  return {
    id: `tri-osnovy-${padded}`,
    title: `${number}. ${lesson.title}`,
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Акыда',
    cycle: 'Три основы',
    cycleId,
    lessonNumber: number,
    duration: lesson.duration,
    description: `Лекция ${number} из 18. Оригинальная запись с сайта abuyahya.net.`,
    audioUrl: `${audioBase}/${sourceFileName}`,
    date: '2014-12-10',
    tags: ['акыда', 'таухид', 'три основы'],
    sourceUrl: sourcePage,
    sourceFileName
  };
});

export const triOsnovyCycle: Cycle = {
  id: cycleId,
  title: 'Три основы',
  author: 'Абу Яхья Крымский',
  authorId: 'abu-yahya-krymskiy',
  description: '18 аудиолекций по книге «Три основы». Слушайте уроки по порядку; источник записей и материалов — официальный сайт abuyahya.net.',
  totalLessons: triOsnovyLectures.length,
  totalDuration: triOsnovyLectures.reduce((sum, lecture) => sum + lecture.duration, 0),
  coverTone: 'from-amber-100 via-orange-50 to-white'
};
