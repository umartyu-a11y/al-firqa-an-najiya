export type Category =
  | 'Акыда'
  | 'Таухид'
  | 'Фикх'
  | 'Хадисы'
  | 'Коран и тафсир'
  | 'Нравственность'
  | 'Основы знания'
  | 'Разное';

export interface Lecture {
  id: string;
  title: string;
  author: string;
  authorId: string;
  category: Category;
  cycle: string;
  cycleId: string;
  lessonNumber: number | string;
  duration: number;
  description: string;
  audioUrl: string;
  date: string;
  tags: string[];
  sourceUrl?: string;
  sourceFileName?: string;
}

export interface Cycle {
  id: string;
  title: string;
  author: string;
  authorId: string;
  description: string;
  totalLessons: number;
  totalDuration: number;
  coverTone: string;
}
