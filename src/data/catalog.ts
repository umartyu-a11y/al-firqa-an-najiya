import { lectureData as originalLectureData, cycles as originalCycles } from './lectures';
import { triOsnovyCycle, triOsnovyLectures } from './tri-osnovy';
import { knigaEdinobozhiyaCycle, knigaEdinobozhiyaLectures } from './kniga-edinobozhiya';
import type { Lecture } from '../types';

export const lectureData: Lecture[] = [...originalLectureData, ...triOsnovyLectures, ...knigaEdinobozhiyaLectures];
export const cycles = [...originalCycles, triOsnovyCycle, knigaEdinobozhiyaCycle];

export const compareLessonNumbers = (left: number | string, right: number | string) => {
  const leftParts = String(left).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
};

export const orderedCycleLectures = (cycleId: string) =>
  lectureData.filter((lecture) => lecture.cycleId === cycleId).sort((a, b) => compareLessonNumbers(a.lessonNumber, b.lessonNumber));
