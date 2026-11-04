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
    description: 'Учебное пособие по одной из основополагающих книг по исламскому вероубеждению. PDF доступен в библиотеке; описание и атрибуция — на официальной странице источника.',
    sourceUrl: 'https://abuyahya.net/books/tri-osnovy-2/',
    pdfUrl: `${import.meta.env.BASE_URL}books/tri-osnovy.pdf`,
    cycleId: 'tri-osnovy'
  }
];
