import { lectureOutlines } from '../data/lecture-outlines';
import type { Lecture, QuizQuestion } from '../types';

export const readQuizQuestions = (lectureId: string): QuizQuestion[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(`affn-quiz-${lectureId}`) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const getLectureTopicTitle = (lecture: Lecture) => lectureOutlines[lecture.id]?.outline[0] || lecture.title;
