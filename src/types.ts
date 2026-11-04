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
  fallbackAudioUrl?: string;
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
  sourceUrl?: string;
}

export interface HandwritingStroke {
  path: string;
  color: string;
  width: number;
  opacity?: number;
}

export interface BookmarkItem {
  id: string;
  lectureId: string;
  time: number;
  createdAt: string;
  note?: string;
  tags?: string[];
  handwriting?: HandwritingStroke[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface LectureProgressEntry {
  currentTime: number;
  duration: number;
  updatedAt: string;
}

export interface LocalLibraryBackup {
  format: 'al-firqa-an-najiya-local-library';
  version: 1;
  exportedAt: string;
  favorites: string[];
  history: string[];
  progress: Record<string, LectureProgressEntry>;
  bookmarks: BookmarkItem[];
  quizzes: Record<string, QuizQuestion[]>;
  preferences: {
    theme: 'light' | 'dark';
    volume: number;
    rate: number;
    currentLectureId: string | null;
  };
}
