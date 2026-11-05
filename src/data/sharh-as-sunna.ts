import type { Cycle, Lecture } from '../types';

const sourcePage = "https://abuyahya.net/lekcii/akida/sharh-as-sunna/";
const sourceRoot = "https://files.abuyahya.net/Sharh_as-Sunna/";
const fileNames = ["01._Sharh_as-Sunna.mp3", "02._Sharh_as-Sunna.mp3", "03._Sharh_as-Sunna.mp3", "04._Sharh_as-Sunna.mp3", "05._Sharh_as-Sunna.mp3", "06._Sharh_as-Sunna.mp3", "07._Sharh_as-Sunna.mp3", "08._Sharh_as-Sunna.mp3", "09._Sharh_as-Sunna.mp3", "10._Sharh_as-Sunna.mp3", "11._Sharh_as-Sunna.mp3", "12._Sharh_as-Sunna.mp3", "13._Sharh_as-Sunna.mp3", "14._Sharh_as-Sunna.mp3", "15._Sharh_as-Sunna.mp3", "16._Sharh_as-Sunna.mp3", "17._Sharh_as-Sunna.mp3", "18._Sharh_as-Sunna.mp3", "19._Sharh_as-Sunna.mp3", "20._Sharh_as-Sunna.mp3", "21._Sharh_as-Sunna.mp3", "22._Sharh_as-Sunna.mp3", "23._Sharh_as-Sunna.mp3", "24._Sharh_as-Sunna.mp3", "25._Sharh_as-Sunna.mp3", "26._Sharh_as-Sunna.mp3", "27._Sharh_as-Sunna.mp3", "28._Sharh_as-Sunna.mp3", "29._Sharh_as-Sunna.mp3", "30._Sharh_as-Sunna.mp3", "31._Sharh_as-Sunna.mp3", "32._Sharh_as-Sunna.mp3", "33._Sharh_as-Sunna.mp3"];
const durations = [4183, 5096, 6508, 6698, 6441, 6083, 5755, 4105, 4902, 4330, 4468, 4935, 5488, 5124, 5174, 5360, 4662, 4841, 5790, 4622, 4768, 5058, 5527, 4764, 5940, 4788, 5116, 5633, 5834, 6931, 6481, 7815, 6583];
const cdnRoot = "https://files.manuscdn.com/user_upload_by_module/session_file/310519664063594580/";
const cdnKeys = ["PNhTFYJpvSxkNaXZ.mp3", "MZWYxdHKHQaRhByW.mp3", "MsHQJIDNdNJozVgo.mp3", "BLhCCuJpAjIsglQT.mp3", "mPftXNXEpzdEqtpV.mp3", "yCVBaWWbBLUSAjbQ.mp3", "aQNHrVOuaGMmdQaX.mp3", "WhkJFlpMSppjAwQW.mp3", "PfbitUoEvtidmXZf.mp3", "grEsweTiRyOmqEDX.mp3", "oqsqBrnEVsbLGtDP.mp3", "uAlPztKJhjvFHNuz.mp3", "IjSYArUghHtvCJaa.mp3", "XXyAdwJAOipNJIvl.mp3", "PzzfqACBqGFtoQdv.mp3", "tlrnJPDbsLBRvFIK.mp3", "hWQkSfccMcpDyffu.mp3", "mwLZmOkNNBgAleEs.mp3", "uXkvlRAYOqyTcsHW.mp3", "eHepdTLQGYZFiQdJ.mp3", "SUQIVTMDFePFykzt.mp3", "DfYxfIkizGMjPDDl.mp3", "jDsrrPosHIITCkbZ.mp3", "PShplwBtwDUxiAKI.mp3", "KuEMrPpzRmOqASLm.mp3", "SFzeGNlvtbzuLyen.mp3", "AfOBlGExeDxpDfrO.mp3", "CwbfWtsXcOUEGWLR.mp3", "RavRkmfCAewYnfyc.mp3", "oYxWnNNDfKUijYpi.mp3", "yNOOVzWoHHRUobrp.mp3", "HNdKiCDTPabqOJYN.mp3", "RFzVWLlkUmGMHfLx.mp3"];
const tags = ['акыда', 'шарх ас-сунна', 'аль-барбахари'];

export const sharhAsSunnaLectures: Lecture[] = fileNames.map((fileName, index) => {
  const number = index + 1;
  const id = `sharh-as-sunna-${String(number).padStart(2, '0')}`;
  return {
    id, title: `${number}. Шарх ас-Сунна`, author: 'Абу Яхья Крымский', authorId: 'abu-yahya-krymskiy',
    category: 'Акыда', cycle: 'Шарх ас-Сунна', cycleId: 'sharh-as-sunna', lessonNumber: number,
    duration: durations[index], description: `Лекция ${number} из 33 по книге «Шарх ас-Сунна». Текст и аудио; источник: abuyahya.net.`,
    audioUrl: `${cdnRoot}${cdnKeys[index]}`, fallbackAudioUrl: `${sourceRoot}${fileName}`,
    date: '2020-09-18', tags, sourceUrl: sourcePage, sourceFileName: fileName
  };
});

export const sharhAsSunnaCycle: Cycle = {
  id: 'sharh-as-sunna', title: 'Шарх ас-Сунна', author: 'Абу Яхья Крымский', authorId: 'abu-yahya-krymskiy',
  description: '33 лекции по книге «Шарх ас-Сунна» имама аль-Барбахари. На странице каждого урока доступны аудио и текст. Источник материалов — сайт abuyahya.net.',
  totalLessons: sharhAsSunnaLectures.length, totalDuration: sharhAsSunnaLectures.reduce((sum, lecture) => sum + lecture.duration, 0),
  coverTone: 'from-amber-100 via-orange-50 to-white', sourceUrl: sourcePage
};
