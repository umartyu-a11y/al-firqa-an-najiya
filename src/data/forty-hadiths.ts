import type { Cycle, Lecture } from '../types';

const cycleId = 'forty-hadiths-nawawi';
const sourcePage = 'https://abuyahya.net/lekcii/40-hadisov/';
const audioBase = 'https://files.abuyahya.net/40_Hadisov';

// The source page exposes the streams and lesson order, but not reliable duration
// metadata in the page HTML. Zero means unknown; the player reads real duration
// from the audio element after playback starts.
export const fortyHadithLectures: Lecture[] = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const padded = String(number).padStart(3, '0');
  const sourceFileName = `${padded}._40_Hadisov.mp3`;
  return {
    id: `${cycleId}-${padded}`,
    title: `Лекция №${number} — Разъяснение 40 хадисов`,
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Хадисы',
    cycle: 'Разъяснение 40 хадисов имама ан-Навауи',
    cycleId,
    lessonNumber: number,
    duration: 0,
    description: `Аудиочасть ${number} цикла. Тематический план и текстовые материалы опубликованы на странице источника; здесь сохранена ссылка на оригинал без копирования полной стенограммы.`,
    audioUrl: `${audioBase}/${sourceFileName}?_=${number}`,
    date: '2023-08-28',
    tags: ['хадисы', '40 хадисов', 'имам ан-Навауи'],
    sourceUrl: sourcePage,
    sourceFileName
  };
});

export const fortyHadithCycle: Cycle = {
  id: cycleId,
  title: 'Разъяснение 40 хадисов имама ан-Навауи',
  author: 'Абу Яхья Крымский',
  authorId: 'abu-yahya-krymskiy',
  description: 'Цикл из 100 аудиочастей с разъяснением «40 хадисов» имама ан-Навауи. Аудио и исходные текстовые материалы открываются на официальном сайте; длительность определяется плеером при воспроизведении.',
  totalLessons: fortyHadithLectures.length,
  totalDuration: 0,
  coverTone: 'from-emerald-100 via-stone-100 to-white',
  sourceUrl: sourcePage
};
