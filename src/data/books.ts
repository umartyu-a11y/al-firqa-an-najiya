export interface BookResource {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  sourceUrl: string;
  pdfUrl: string;
  cycleId: string;
}

export const bookData: BookResource[] = [
  {
    id: 'tri-osnovy-book',
    title: 'Разъяснение текста книги «Три основы»',
    subtitle: 'Салясату-ль-усуль · PDF',
    author: 'Перевод и примечания: Абу Яхья Крымский',
    description: 'Учебное пособие по одной из основополагающих книг по исламскому вероубеждению. На официальной странице доступны описание курса и книга в PDF.',
    sourceUrl: 'https://abuyahya.net/books/tri-osnovy-2/',
    pdfUrl: 'https://drive.google.com/uc?export=download&id=1U6EuzQwOK6EbcJVzBKiPVCWWj1rh4zLn',
    cycleId: 'tri-osnovy'
  }
];
