import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpenText, FileText, Headphones, Link2, Search, Tag } from 'lucide-react';
import { bookData } from './data/books';
import { cycles, lectureData } from './data/catalog';
import { lectureNotesById } from './data/lectureNotes';

type NodeKind = 'book' | 'cycle' | 'lecture' | 'topic' | 'note' | 'term' | 'evidence' | 'material';
type GraphNode = {
  id: string;
  title: string;
  kind: NodeKind;
  description: string;
  status: string;
  sourceUrl?: string;
  sourceLabel?: string;
  targetPath?: string;
};
type GraphEdge = { from: string; to: string; label: string };
type GraphConnection = { edge: GraphEdge; node: GraphNode; direction: 'in' | 'out' };

function formatRussianCount(count: number, one: string, few: string, many: string) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = last === 1 && lastTwo !== 11 ? one : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
  return `${count} ${word}`;
}

const kindLabels: Record<NodeKind, string> = {
  book: 'Книга',
  cycle: 'Аудиокурс',
  lecture: 'Урок',
  topic: 'Метаданные темы',
  note: 'Конспект',
  term: 'Термин из конспекта',
  evidence: 'Источник, указанный в конспекте',
  material: 'Связанный материал'
};

const kindColors: Record<NodeKind, string> = {
  book: 'bg-[#111820] text-white dark:bg-white dark:text-[#111820]',
  cycle: 'bg-[#B8874A]/15 text-[#805322] dark:bg-[#E0821E]/15 dark:text-[#F3B76B]',
  lecture: 'bg-[#E8EDF3] text-[#26384B] dark:bg-[#202A36] dark:text-[#DCE7F1]',
  topic: 'bg-[#EEF2E7] text-[#43533B] dark:bg-[#242A21] dark:text-[#D2E0C5]',
  note: 'bg-[#F5EBD8] text-[#795522] dark:bg-[#332817] dark:text-[#E9C98E]',
  term: 'bg-[#EEE9F5] text-[#594777] dark:bg-[#292335] dark:text-[#D8C9F2]',
  evidence: 'bg-[#F1E7E7] text-[#704747] dark:bg-[#302222] dark:text-[#E4C4C4]',
  material: 'bg-[#E6F0EF] text-[#315854] dark:bg-[#1E302E] dark:text-[#C2DFDB]'
};

function buildGraph() {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const lectureById = new Map(lectureData.map((lecture) => [lecture.id, lecture]));

  bookData.forEach((book) => {
    const id = `book:${book.id}`;
    nodes.push({
      id,
      title: book.title,
      kind: 'book',
      description: `${book.subtitle} · ${book.author}`,
      status: 'Каталожная запись',
      sourceUrl: book.sourceUrl,
      sourceLabel: 'Страница источника книги',
      targetPath: '/books'
    });
    const cycle = cycles.find((item) => item.id === book.cycleId);
    if (cycle) edges.push({ from: id, to: `cycle:${cycle.id}`, label: 'связан с аудиокурсом по cycleId' });
  });

  cycles.forEach((cycle) => {
    const id = `cycle:${cycle.id}`;
    const firstLecture = lectureData.find((lecture) => lecture.cycleId === cycle.id);
    nodes.push({
      id,
      title: cycle.title,
      kind: 'cycle',
      description: `${cycle.author} · ${cycle.totalLessons} уроков`,
      status: 'Метаданные аудиокурса',
      sourceUrl: firstLecture?.sourceUrl,
      sourceLabel: 'Источник, указанный у урока курса',
      targetPath: `/cycle/${cycle.id}`
    });
    lectureData.filter((lecture) => lecture.cycleId === cycle.id).forEach((lecture) => {
      edges.push({ from: id, to: `lecture:${lecture.id}`, label: 'содержит урок по cycleId' });
    });
  });

  const topicNodes = new Map<string, GraphNode>();
  lectureData.forEach((lecture) => {
    const id = `lecture:${lecture.id}`;
    nodes.push({
      id,
      title: lecture.title,
      kind: 'lecture',
      description: `${lecture.cycle} · урок ${lecture.lessonNumber} · ${lecture.author}`,
      status: 'Метаданные каталога уроков',
      sourceUrl: lecture.sourceUrl,
      sourceLabel: lecture.sourceUrl ? 'Источник записи' : undefined,
      targetPath: `/lecture/${encodeURIComponent(lecture.id)}`
    });

    const topicPairs = [
      { value: lecture.category, relation: 'категория каталога' },
      ...lecture.tags.map((value) => ({ value, relation: 'тег каталога' }))
    ];
    topicPairs.forEach(({ value, relation }) => {
      const normalized = value.trim();
      if (!normalized) return;
      const topicId = `topic:${normalized.toLocaleLowerCase()}`;
      if (!topicNodes.has(topicId)) {
        topicNodes.set(topicId, {
          id: topicId,
          title: normalized,
          kind: 'topic',
          description: 'Значение взято из метаданных каталога; это не самостоятельная редакторская или богословская статья.',
          status: 'Метаданные каталога'
        });
      }
      edges.push({ from: id, to: topicId, label: relation });
    });
  });
  nodes.push(...topicNodes.values());

  Object.values(lectureNotesById).forEach((note) => {
    const noteId = `note:${note.lectureId}`;
    const noteStatus = note.editorialStatus === 'reviewed'
      ? 'Редакционно проверен'
      : 'Черновик — ожидает редакторской проверки';
    const lecture = lectureById.get(note.lectureId);
    nodes.push({
      id: noteId,
      title: note.title,
      kind: 'note',
      description: note.summary,
      status: noteStatus,
      sourceUrl: note.courseSourceUrl,
      sourceLabel: 'Страница курса, указанная в конспекте',
      targetPath: lecture ? `/lecture/${encodeURIComponent(note.lectureId)}` : undefined
    });
    if (lecture) edges.push({ from: `lecture:${lecture.id}`, to: noteId, label: 'имеет запись конспекта по lectureId' });

    note.terms.forEach((term) => {
      const id = `term:${note.lectureId}:${encodeURIComponent(term.term)}`;
      nodes.push({
        id,
        title: term.term,
        kind: 'term',
        description: `${term.transliteration} — ${term.explanation}`,
        status: noteStatus
      });
      edges.push({ from: noteId, to: id, label: 'упоминает термин в конспекте' });
    });

    note.evidence.forEach((evidence) => {
      const id = `evidence:${note.lectureId}:${evidence.id}`;
      nodes.push({
        id,
        title: `${evidence.reference} · ${evidence.title}`,
        kind: 'evidence',
        description: `${evidence.kind === 'quran' ? 'Коран' : 'Хадис'} · цитируется в конспекте; наличие ссылки само по себе не означает независимую редакторскую проверку.`,
        status: noteStatus,
        sourceUrl: evidence.url,
        sourceLabel: 'Открыть указанный источник'
      });
      edges.push({ from: noteId, to: id, label: 'ссылка указана в конспекте' });
    });

    note.relatedMaterials.forEach((material, index) => {
      const id = `material:${note.lectureId}:${index}`;
      nodes.push({
        id,
        title: material.label,
        kind: 'material',
        description: material.description,
        status: noteStatus,
        sourceUrl: material.url,
        sourceLabel: 'Открыть связанный материал'
      });
      edges.push({ from: noteId, to: id, label: 'связанный материал из конспекта' });
    });
  });

  return { nodes, edges };
}

const iconForKind = (kind: NodeKind) => {
  if (kind === 'book') return <BookOpenText size={17} aria-hidden="true" />;
  if (kind === 'cycle') return <Headphones size={17} aria-hidden="true" />;
  if (kind === 'lecture') return <Headphones size={17} aria-hidden="true" />;
  if (kind === 'topic' || kind === 'term') return <Tag size={17} aria-hidden="true" />;
  if (kind === 'note') return <FileText size={17} aria-hidden="true" />;
  return <Link2 size={17} aria-hidden="true" />;
};

export function KnowledgeMap({ onNavigate }: { onNavigate: (path: string) => void }) {
  const graph = useMemo(buildGraph, []);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | NodeKind>('all');
  const [selectedId, setSelectedId] = useState('book:tri-osnovy-book');
  const [showAllConnections, setShowAllConnections] = useState(false);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selected = nodeById.get(selectedId) || graph.nodes[0];

  const searchResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return graph.nodes
      .filter((node) => (kindFilter === 'all' || node.kind === kindFilter)
        && `${node.title} ${node.description} ${node.status}`.toLocaleLowerCase().includes(needle))
      .slice(0, 12);
  }, [graph.nodes, kindFilter, query]);

  const connections = useMemo<GraphConnection[]>(() => {
    if (!selected) return [];
    return graph.edges.flatMap<GraphConnection>((edge) => {
      if (edge.from === selected.id) {
        const node = nodeById.get(edge.to);
        return node ? [{ edge, node, direction: 'out' }] : [];
      }
      if (edge.to === selected.id) {
        const node = nodeById.get(edge.from);
        return node ? [{ edge, node, direction: 'in' }] : [];
      }
      return [];
    });
  }, [graph.edges, nodeById, selected]);

  const visibleConnections = showAllConnections ? connections : connections.slice(0, 12);
  const focusNode = (id: string) => {
    setSelectedId(id);
    setShowAllConnections(false);
  };

  return (
    <main className="space-y-6">
      <section className="panel p-7 sm:p-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#B8874A]/15 bg-[#B8874A]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8C5B22] dark:border-[#E0821E]/20 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">
          <Link2 size={14} aria-hidden="true" /> Карта знаний · связи из каталога
        </div>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.04em] text-text dark:text-darktext sm:text-5xl">Карта знаний</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted dark:text-darkmuted">
          Карта показывает только связи, явно записанные в текущих данных: книга, аудиокурс, уроки, метаданные, конспект и указанные в нём источники. Главы и неподтверждённые связи не добавляются.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted dark:text-darkmuted" aria-label="Размер карты">
          <span className="rounded-full border border-black/5 px-3 py-2 dark:border-white/10">{formatRussianCount(bookData.length, 'книга', 'книги', 'книг')}</span>
          <span className="rounded-full border border-black/5 px-3 py-2 dark:border-white/10">{formatRussianCount(cycles.length, 'аудиокурс', 'аудиокурса', 'аудиокурсов')}</span>
          <span className="rounded-full border border-black/5 px-3 py-2 dark:border-white/10">{formatRussianCount(lectureData.length, 'урок', 'урока', 'уроков')}</span>
          <span className="rounded-full border border-black/5 px-3 py-2 dark:border-white/10">{formatRussianCount(Object.keys(lectureNotesById).length, 'конспект', 'конспекта', 'конспектов')}</span>
        </div>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="knowledge-search-heading">
        <h2 id="knowledge-search-heading" className="font-display text-2xl text-text dark:text-darktext">Найти узел карты</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 dark:border-white/10 dark:bg-[#161616]">
            <Search size={17} className="shrink-0 text-muted dark:text-darkmuted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Искать по названиям и метаданным…"
              aria-label="Поиск узлов карты знаний"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted dark:text-darktext dark:placeholder:text-darkmuted"
            />
          </label>
          <label className="rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 py-2 dark:border-white/10 dark:bg-[#161616]">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Тип узла</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'all' | NodeKind)} className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext" aria-label="Фильтр типа узла">
              <option value="all">Все типы</option>
              {(Object.keys(kindLabels) as NodeKind[]).map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
            </select>
          </label>
        </div>
        {query.trim() && (
          <div className="mt-4" role="region" aria-label="Результаты поиска по карте">
            <p className="mb-2 text-sm text-muted dark:text-darkmuted" aria-live="polite">{searchResults.length ? `Показано результатов: ${searchResults.length}${searchResults.length === 12 ? ' (первые 12)' : ''}` : 'Совпадений в доступных названиях и метаданных нет.'}</p>
            {searchResults.length > 0 && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((node) => (
                <button key={node.id} type="button" onClick={() => focusNode(node.id)} className={`flex min-h-14 items-center gap-3 rounded-2xl border border-black/5 p-3 text-left transition hover:border-[#B8874A]/50 dark:border-white/10 dark:hover:border-[#E0821E]/50 ${selectedId === node.id ? 'ring-2 ring-[#B8874A]/50 dark:ring-[#E0821E]/50' : ''}`} aria-current={selectedId === node.id ? 'true' : undefined}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kindColors[node.kind]}`}>{iconForKind(node.kind)}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-text dark:text-darktext">{node.title}</span><span className="block text-xs text-muted dark:text-darkmuted">{kindLabels[node.kind]} · {node.status}</span></span>
                </button>
              ))}
            </div>}
          </div>
        )}
      </section>

      {selected && (
        <section className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]" aria-labelledby="knowledge-network-heading">
          <article className="panel p-5 sm:p-6">
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Выбранный узел</div>
            <div className="mt-4 flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${kindColors[selected.kind]}`}>{iconForKind(selected.kind)}</span>
              <div className="min-w-0">
                <div className="text-xs text-muted dark:text-darkmuted">{kindLabels[selected.kind]}</div>
                <h2 className="mt-1 break-words font-display text-2xl leading-tight text-text dark:text-darktext">{selected.title}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted dark:text-darkmuted">{selected.description}</p>
            <div className="mt-4 rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 text-sm dark:border-white/10 dark:bg-[#161616]">
              <span className="block text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Редакционный статус / происхождение</span>
              <span className="mt-1 block text-text dark:text-darktext">{selected.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {selected.targetPath && <button type="button" onClick={() => onNavigate(selected.targetPath!)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#111820] px-4 py-2.5 text-sm font-medium text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Открыть материал <ArrowUpRight size={15} aria-hidden="true" /></button>}
              {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium text-text dark:border-white/15 dark:text-darktext">{selected.sourceLabel || 'Открыть источник'} <ArrowUpRight size={15} aria-hidden="true" /></a>}
            </div>
          </article>

          <div className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Связанные узлы</div>
                <h2 id="knowledge-network-heading" className="mt-1 font-display text-2xl text-text dark:text-darktext">Связи по источникам и метаданным</h2>
              </div>
              <span className="rounded-full border border-black/5 px-3 py-2 text-xs text-muted dark:border-white/10 dark:text-darkmuted" aria-live="polite">{formatRussianCount(connections.length, 'связь', 'связи', 'связей')}</span>
            </div>
            {connections.length ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {visibleConnections.map(({ edge, node, direction }) => (
                    <div key={`${edge.from}:${edge.to}`} className="rounded-2xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-[#141414]">
                      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted dark:text-darkmuted">
                        {direction === 'in' ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
                        {edge.label}
                      </div>
                      <button type="button" onClick={() => focusNode(node.id)} className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:outline-none">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kindColors[node.kind]}`}>{iconForKind(node.kind)}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-text underline-offset-4 hover:underline dark:text-darktext">{node.title}</span><span className="block truncate text-xs text-muted dark:text-darkmuted">{kindLabels[node.kind]} · {node.status}</span></span>
                      </button>
                    </div>
                  ))}
                </div>
                {connections.length > 12 && <button type="button" onClick={() => setShowAllConnections((value) => !value)} className="mt-4 min-h-11 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-text dark:border-white/15 dark:text-darktext">{showAllConnections ? 'Свернуть связи' : `Показать ещё ${connections.length - 12}`}</button>}
              </>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed border-black/15 p-4 text-sm leading-6 text-muted dark:border-white/15 dark:text-darkmuted">В доступных данных пока нет связей для этого узла. Новые связи появятся только после добавления источника или явной записи в каталоге.</p>
            )}
            {selected.kind === 'note' && selected.status.includes('Черновик') && <p className="mt-4 rounded-2xl border border-[#B8874A]/20 bg-[#B8874A]/10 p-3 text-xs leading-5 text-[#805322] dark:border-[#E0821E]/20 dark:bg-[#E0821E]/10 dark:text-[#F3B76B]">Материал черновой: ссылки и сведения показаны как записи конспекта и не обозначают независимую редакторскую проверку.</p>}
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted dark:text-darkmuted"><Link2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />На текущем этапе в исходных данных нет глав книги и отдельного набора подтверждённых религиозных связей. Карта не создаёт их автоматически.</p>
    </main>
  );
}
