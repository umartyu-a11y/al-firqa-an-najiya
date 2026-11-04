import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lecture } from './types';

interface CourseTextSource {
  sourceUrl: string;
  attribution: string;
  pdfUrl?: string;
}

const sources: Record<string, CourseTextSource> = {
  'kniga-edinobozhiya': {
    sourceUrl: 'https://abuyahya.net/lekcii/kniga-edinobozhiya/',
    attribution: 'Текстовый материал перенесён с официальной страницы курса «Книга единобожия» на сайте Абу Яхьи Крымского.'
  },
  'tri-osnovy': {
    sourceUrl: 'https://abuyahya.net/lekcii/akida/tri-osnovy/',
    attribution: 'Страница источника указывает, что пособие подготовлено на основе лекций шейха Хайсама ас-Сархана. PDF издан Абу Яхьей Арсеном аль-Къирми.',
    pdfUrl: `${import.meta.env.BASE_URL}books/tri-osnovy.pdf`
  }
};

async function loadSourcePage(cycleId: string): Promise<string | null> {
  if (cycleId === 'kniga-edinobozhiya') {
    return (await import('./data/course-source-texts/kniga-edinobozhiya.md?raw')).default;
  }
  if (cycleId === 'tri-osnovy') {
    return (await import('./data/course-source-texts/tri-osnovy.md?raw')).default;
  }
  return null;
}

function parseLessonTexts(source: string): { introduction: string; lessons: Record<number, string> } {
  const headingPattern = /^##\s+Лекция\s+№\s*(\d+)\s*$/gm;
  const headings = Array.from(source.matchAll(headingPattern));
  const lessons: Record<number, string> = {};
  const firstHeading = headings[0];
  const introduction = firstHeading?.index === undefined ? '' : source.slice(0, firstHeading.index).trim();

  headings.forEach((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const number = Number(heading[1]);
    const content = source.slice(start, end).trim();
    lessons[number] = number === 1 && introduction ? `${introduction}\n\n${content}` : content;
  });

  return { introduction, lessons };
}

type TextBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'unordered-list'; items: string[] }
  | { kind: 'ordered-list'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' };

function parseMarkdownBlocks(markdown: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listKind: 'unordered-list' | 'ordered-list' | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (listKind && listItems.length) blocks.push({ kind: listKind, items: listItems });
    listItems = [];
    listKind = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ kind: 'quote', text: quote.join(' ') });
    quote = [];
  };
  const flushText = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of markdown.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushText();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushText();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }
    if (/^(---+|\*\s*\*\s*\*)$/.test(line)) {
      flushText();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const unordered = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = rawLine.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextKind = unordered ? 'unordered-list' : 'ordered-list';
      if (listKind !== nextKind) flushList();
      listKind = nextKind;
      listItems.push((unordered || ordered)![1]);
      continue;
    }

    const quoteLine = line.match(/^>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushText();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  return text.split(tokenPattern).filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="underline decoration-[#B8874A]/50 underline-offset-4">{link[1]}</a>;
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={index}>{part.slice(1, -1)}</em>;
    return <span key={index}>{part}</span>;
  });
}

function renderText(markdown: string): ReactNode[] {
  return parseMarkdownBlocks(markdown).map((block, index) => {
    if (block.kind === 'heading') {
      const className = 'font-display text-xl tracking-[-0.02em] text-text dark:text-darktext';
      if (block.level <= 2) return <h3 key={index} className={className}>{renderInline(block.text)}</h3>;
      return <h4 key={index} className="text-sm font-semibold text-text dark:text-darktext">{renderInline(block.text)}</h4>;
    }
    if (block.kind === 'unordered-list') {
      return <ul key={index} className="list-disc space-y-2 pl-6 text-sm leading-7 text-text dark:text-darktext">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
    }
    if (block.kind === 'ordered-list') {
      return <ol key={index} className="list-decimal space-y-2 pl-6 text-sm leading-7 text-text dark:text-darktext">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
    }
    if (block.kind === 'quote') {
      return <blockquote key={index} className="border-l-2 border-[#B8874A]/40 pl-4 text-sm leading-7 text-muted dark:border-[#E0821E]/40 dark:text-darkmuted">{renderInline(block.text)}</blockquote>;
    }
    if (block.kind === 'rule') return <hr key={index} className="border-black/10 dark:border-white/10" />;
    return <p key={index} className="text-sm leading-7 text-text dark:text-darktext">{renderInline(block.text)}</p>;
  });
}

export function CourseSourceText({ lecture }: { lecture: Lecture }) {
  const source = sources[lecture.cycleId];
  const [sourcePage, setSourcePage] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSourcePage(null);
    setLoadFailed(false);
    void loadSourcePage(lecture.cycleId).then((content) => {
      if (active) setSourcePage(content);
    }).catch(() => {
      if (active) setLoadFailed(true);
    });
    return () => { active = false; };
  }, [lecture.cycleId]);

  const lessonText = useMemo(() => {
    if (!sourcePage) return '';
    const lessonNumber = Number(lecture.lessonNumber);
    if (!Number.isInteger(lessonNumber) || lessonNumber < 1) return '';
    return parseLessonTexts(sourcePage).lessons[lessonNumber] || '';
  }, [lecture.lessonNumber, sourcePage]);
  const missingTextMessage = lecture.cycleId === 'kniga-edinobozhiya' && Number(lecture.lessonNumber) === 21
    ? 'На официальной странице у лекции №21 указан заголовок, но текстовый блок отсутствует. Мы не дополняли его самостоятельно.'
    : 'Для этого номера текст на странице не найден; полный материал доступен в первоисточнике.';

  if (!source) return null;

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="source-text-heading">
      <header className="border-b border-black/5 pb-4 dark:border-white/10">
        <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Материалы первоисточника</div>
        <h2 id="source-text-heading" className="mt-2 font-display text-3xl tracking-[-0.04em] text-text dark:text-darktext">Текст урока №{lecture.lessonNumber}</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-muted dark:text-darkmuted">{source.attribution} Формулировки и порядок текста сохранены; это публикация источника, а не отдельная редакционная проверка проекта.</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center underline decoration-[#B8874A]/50 underline-offset-4">Открыть исходную страницу</a>
          {source.pdfUrl && <a href={source.pdfUrl} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center underline decoration-[#B8874A]/50 underline-offset-4">Открыть полный PDF книги «Три основы»</a>}
        </div>
      </header>

      {sourcePage === null && !loadFailed && <p className="mt-4 text-sm text-muted dark:text-darkmuted">Загрузка текста…</p>}
      {loadFailed && <p className="mt-4 text-sm text-muted dark:text-darkmuted">Не удалось загрузить локальный текстовый файл. Откройте его на официальной странице источника.</p>}
      {lessonText && (
        <details open className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8874A] dark:text-darktext">Текст, опубликованный для этого урока</summary>
          <article className="mt-3 space-y-4 border-t border-black/5 pt-4 dark:border-white/10">{renderText(lessonText)}</article>
        </details>
      )}
      {sourcePage !== null && !lessonText && <p className="mt-4 text-sm text-muted dark:text-darkmuted">{missingTextMessage} <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-[#B8874A]/50 underline-offset-4">Открыть первоисточник</a>.</p>}
    </section>
  );
}
