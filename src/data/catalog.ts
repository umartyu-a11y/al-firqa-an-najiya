import { lectureData as originalLectureData, cycles as originalCycles } from './lectures';
import { triOsnovyCycle, triOsnovyLectures } from './tri-osnovy';
import { knigaEdinobozhiyaCycle, knigaEdinobozhiyaLectures } from './kniga-edinobozhiya';
import { chetyrePravilaNovyeCycle, chetyrePravilaNovyeLectures } from './chetyre-pravila-novye';
import { fortyHadithCycle, fortyHadithLectures } from './forty-hadiths';
import { alfiyaIbnMalikaCycle, alfiyaIbnMalikaLectures } from './alfiya-ibn-malika';
import { sharhAsSunnaCycle, sharhAsSunnaLectures } from './sharh-as-sunna';
import { abuyahyaAdditionalCycles, abuyahyaAdditionalLectures } from './abuyahya-additions';
import { abuyahyaNextCycles } from './abuyahya-next-cycles';
import type { Lecture } from '../types';

export const lectureData: Lecture[] = [...originalLectureData, ...triOsnovyLectures, ...knigaEdinobozhiyaLectures, ...chetyrePravilaNovyeLectures, ...fortyHadithLectures, ...alfiyaIbnMalikaLectures, ...sharhAsSunnaLectures, ...abuyahyaAdditionalLectures];
export const cycles = [...originalCycles, triOsnovyCycle, knigaEdinobozhiyaCycle, chetyrePravilaNovyeCycle, fortyHadithCycle, alfiyaIbnMalikaCycle, sharhAsSunnaCycle, ...abuyahyaAdditionalCycles, ...abuyahyaNextCycles];

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
