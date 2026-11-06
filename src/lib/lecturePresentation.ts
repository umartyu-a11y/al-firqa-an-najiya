import type { Lecture, QuizQuestion } from '../types';

let lectureOutlineLookup: Record<string, { outline: string[] }> = {};

export const setLectureOutlineLookup = (outlines: Record<string, { outline: string[] }>) => {
  lectureOutlineLookup = outlines;
};

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

export const getLectureTopicTitle = (lecture: Lecture, outline?: { outline: string[] }) => outline?.outline[0] || lectureOutlineLookup[lecture.id]?.outline[0] || lecture.title;
