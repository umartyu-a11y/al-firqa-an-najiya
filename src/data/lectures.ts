import { Lecture, Cycle } from '../types';

export const lectureData: Lecture[] = [
  {
    id: 'l1',
    title: 'Три основы',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Акыда',
    cycle: 'Три основы',
    cycleId: 'cycle-tri-osnovy',
    lessonNumber: 1,
    duration: 1680,
    description: 'Введение в основы исламского вероучения и критерии истинной привязанности к религии.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    date: '2024-11-15',
    tags: ['акыда', 'основы', 'вероучение']
  },
  {
    id: 'l2',
    title: 'Три основы',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Акыда',
    cycle: 'Три основы',
    cycleId: 'cycle-tri-osnovy',
    lessonNumber: 2,
    duration: 1740,
    description: 'Разбор первого основания: знание и обязательство по вере.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    date: '2024-11-17',
    tags: ['акыда', 'основы', 'знание']
  },
  {
    id: 'l3',
    title: 'Четыре правила',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Таухид',
    cycle: 'Четыре правила',
    cycleId: 'cycle-chetyre-pravila',
    lessonNumber: 1,
    duration: 1735,
    description: 'Понимание основных правил в вопросах таухида и познания религии.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    date: '2024-10-01',
    tags: ['таухид', 'правила', 'базис']
  },
  {
    id: 'l4',
    title: 'Шесть основ',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Коран и тафсир',
    cycle: 'Шесть основ',
    cycleId: 'cycle-shest-osnov',
    lessonNumber: 1,
    duration: 1820,
    description: 'Обсуждение принципов, на которых строится основательное понимание Корана и Сунны.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    date: '2024-09-12',
    tags: ['коран', 'сунна', 'основы']
  },
  {
    id: 'l5',
    title: 'Этика и требования знания',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Нравственность',
    cycle: 'Этика и требования знания',
    cycleId: 'cycle-etika-trebovaniya-znaniya',
    lessonNumber: 1,
    duration: 1560,
    description: 'О том, как знание формирует нравственность, ответственность и характер мусульманина.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    date: '2024-08-27',
    tags: ['этика', 'нравственность', 'знание']
  },
  {
    id: 'l6',
    title: 'Фикх: основы и практика',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Фикх',
    cycle: 'Основы фикха',
    cycleId: 'cycle-osnovy-fikha',
    lessonNumber: 1,
    duration: 1900,
    description: 'Понимание фикха как практического знания в жизни мусульманина.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    date: '2024-07-04',
    tags: ['фикх', 'практика', 'ислам']
  },
  {
    id: 'l7',
    title: 'Семь правил в хадисоведении',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Хадисы',
    cycle: 'Хадисоведение',
    cycleId: 'cycle-hadisovedenie',
    lessonNumber: 1,
    duration: 1670,
    description: 'Критерии понимания хадисов, проверки и ответственности в передаче знаний.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    date: '2024-06-18',
    tags: ['хадисы', 'передача', 'доказательство']
  },
  {
    id: 'l8',
    title: 'Основы исламского знания',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    category: 'Разное',
    cycle: 'Основы исламского знания',
    cycleId: 'cycle-osnovy-islam-skoy-znanij',
    lessonNumber: 1,
    duration: 2100,
    description: 'Введение в системное, сбалансированное изучение исламских дисциплин.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    date: '2024-05-22',
    tags: ['исламское знание', 'основы', 'введение']
  }
];

export const cycles: Cycle[] = [
  {
    id: 'cycle-tri-osnovy',
    title: 'Три основы',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    description: 'Базовый цикл, раскрывающий фундаментальные принципы религиозного знания.',
    totalLessons: 2,
    totalDuration: 3420,
    coverTone: 'from-amber-200 via-stone-100 to-white'
  },
  {
    id: 'cycle-chetyre-pravila',
    title: 'Четыре правила',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    description: 'Практическая система правил для правильного понимания и применения религиозных знаний.',
    totalLessons: 1,
    totalDuration: 1735,
    coverTone: 'from-stone-200 via-zinc-100 to-white'
  },
  {
    id: 'cycle-shest-osnov',
    title: 'Шесть основ',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    description: 'Цикл, посвящённый ключевым столпам понимания религии и её оснований.',
    totalLessons: 1,
    totalDuration: 1820,
    coverTone: 'from-orange-200 via-amber-100 to-white'
  },
  {
    id: 'cycle-etika-trebovaniya-znaniya',
    title: 'Этика и требования знания',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    description: 'О духовной и нравственной стороне обучения, ответственности и благородства сердца.',
    totalLessons: 1,
    totalDuration: 1560,
    coverTone: 'from-zinc-200 via-slate-100 to-white'
  },
  {
    id: 'cycle-osnovy-fikha',
    title: 'Основы фикха',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    description: 'Цикл о практическом аспекте ислама и правильном понимании правил шариата.',
    totalLessons: 1,
    totalDuration: 1900,
    coverTone: 'from-amber-100 via-yellow-50 to-white'
  },
  {
    id: 'cycle-hadisovedenie',
    title: 'Хадисоведение',
    author: 'Абу Яхья Крымский',
    authorId: 'abu-yahya-krymskiy',
    description: 'Понимание хадисов, их проверки и аккуратного обращения с ними.',
    totalLessons: 1,
    totalDuration: 1670,
    coverTone: 'from-stone-100 via-amber-50 to-white'
  }
];
