export interface CycleArchiveInfo {
  url: string;
  trackCount: number;
  sizeLabel: string;
}

export const cycleArchives: Partial<Record<string, CycleArchiveInfo>> = {
  'tri-osnovy': {
    url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519664059682550/rrzBHJlNAbUBjftF.zip',
    trackCount: 18,
    sizeLabel: '390 МБ'
  },
  'necessary-questions-for-everyone': {
    url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519664059682550/rsykxIitcQEGVzIz.zip',
    trackCount: 111,
    sizeLabel: '3,61 ГБ'
  }
};
