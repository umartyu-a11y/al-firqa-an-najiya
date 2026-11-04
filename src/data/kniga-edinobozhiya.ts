import type { Cycle, Lecture } from '../types';

const cycleId = 'kniga-edinobozhiya';
const sourcePage = 'https://abuyahya.net/lekcii/kniga-edinobozhiya/';
const releaseBase = 'https://github.com/umartyu-a11y/al-firqa-an-najiya/releases/download/kitab-edinobozhiya-audio-v1';
const lessonDurations = [1698, 2243, 2581, 2189, 2276, 2653, 1743, 3106, 2530, 2388, 2701, 2610, 3096, 2629, 2433, 2701, 3008, 1988, 3218, 3313, 3583, 2350, 2732, 2120, 3317, 2247, 3332, 2792, 2944, 1676, 3361, 3450, 2270, 1842, 1898, 1963, 3053, 2189, 1873, 2541, 3253, 2575, 2362, 3591, 3449, 3402, 3500, 2173, 2676, 1672, 2246, 2361, 3252, 2197, 2357, 1965, 2741, 1696, 2010, 2217, 2311, 2778, 2226, 2503, 2601, 1921, 1939, 2190, 1931, 3033, 2982, 3151, 2869, 3161, 2864, 2141, 2468, 3094, 1710, 2814, 2025, 2969, 3573, 3039, 2767, 2831, 2874, 2428, 3148, 2229, 3262, 2128, 3130, 3131, 2940, 3478, 3551, 2821, 2481, 1838, 3192, 2621, 2358, 1672, 2531, 2478, 1622, 3388, 2729, 2770, 3287, 1968, 2701, 2786, 2673, 2009, 2645, 2322, 2919, 3564, 2295, 1900, 3576, 3400, 2246, 1847, 1745, 1883, 2303, 1634, 2679, 2647, 2406, 2438, 2771, 3076, 2397, 3203, 2555, 3166, 1641, 2395, 1665, 3591, 2153, 1716, 2500, 1141, 1870, 2412, 2554, 2774, 3202, 1932, 2117, 3280, 3147, 2541, 2276, 2991, 2858, 2895, 2417, 3542, 3034, 3245, 1914, 2957, 2485, 2326, 2748, 2443];

export const knigaEdinobozhiyaLectures: Lecture[] = lessonDurations.map((duration, index) => {
    const number = index + 1;
    const padded = String(number).padStart(3, '0');
    const sourceFileName = `${padded}._Kniga_Edinobozhiya.mp3`;
    return {
      id: `kniga-edinobozhiya-${padded}`,
    title: `Лекция №${number} — Книга единобожия`,
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Таухид',
    cycle: 'Книга единобожия',
    cycleId,
    lessonNumber: number,
    duration,
    description: `Лекция №${number} из 172. Аудиозапись цикла «Книга единобожия».`,
    audioUrl: `${releaseBase}/${sourceFileName}`,
    date: '2020-07-04',
    tags: ['таухид', 'китаб ат-таухид', 'книга единобожия'],
    sourceUrl: sourcePage,
    sourceFileName
  };
});

export const knigaEdinobozhiyaCycle: Cycle = {
  id: cycleId,
  title: 'Книга единобожия',
  author: 'Абу Яхья Крымский',
  authorId: 'abu-yahya-krymskiy',
  description: 'Полный цикл из 172 аудиолекций по книге «Китабу ат-Таухид». Исходные материалы и текст лекций — на abuyahya.net.',
  totalLessons: knigaEdinobozhiyaLectures.length,
  totalDuration: knigaEdinobozhiyaLectures.reduce((sum, lecture) => sum + lecture.duration, 0),
  coverTone: 'from-amber-100 via-orange-50 to-white',
  sourceUrl: sourcePage
};
