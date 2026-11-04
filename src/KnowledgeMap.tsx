import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpenText, FileText, Headphones, Link2, Mic, Search, Star, Tag } from 'lucide-react';
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
type TaxonomyFilter = { id: string; topicId: string; relation: 'категория каталога' | 'тег каталога'; title: string };
type SearchHistoryItem = { query: string; kindFilter: 'all' | NodeKind; taxonomyFilterId: string };
type VoiceRecognitionResult = { readonly length: number; readonly isFinal: boolean; readonly [index: number]: { readonly transcript: string } };
type VoiceRecognitionEvent = { readonly resultIndex: number; readonly results: ArrayLike<VoiceRecognitionResult> };
type VoiceRecognitionErrorEvent = { readonly error: string };
type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type VoiceRecognitionConstructor = new () => VoiceRecognition;
type AudioContextConstructor = new () => AudioContext;

function getVoiceRecognitionConstructor() {
  const speechWindow = window as Window & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

function getAudioContextConstructor() {
  const audioWindow = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext || audioWindow.webkitAudioContext;
}

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

const searchHistoryStorageKey = 'affn-knowledge-map-search-history:v1';
const searchHistoryLimit = 8;
const favoriteNodeStorageKey = 'affn-knowledge-map-favorites:v1';

function readSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(searchHistoryStorageKey);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): SearchHistoryItem[] => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Partial<SearchHistoryItem>;
      const isKnownKind = item.kindFilter === 'all'
        || (typeof item.kindFilter === 'string' && Object.prototype.hasOwnProperty.call(kindLabels, item.kindFilter));
      if (typeof item.query !== 'string' || !isKnownKind || typeof item.taxonomyFilterId !== 'string') return [];
      return [{ query: item.query.slice(0, 200), kindFilter: item.kindFilter as SearchHistoryItem['kindFilter'], taxonomyFilterId: item.taxonomyFilterId }];
    }).slice(0, searchHistoryLimit);
  } catch {
    return [];
  }
}

function readFavoriteNodeIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(favoriteNodeStorageKey);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((id): id is string => typeof id === 'string')));
  } catch {
    return [];
  }
}

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
  const [taxonomyFilterId, setTaxonomyFilterId] = useState('');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(readSearchHistory);
  const [favoriteNodeIds, setFavoriteNodeIds] = useState<string[]>(readFavoriteNodeIds);
  const [activeTab, setActiveTab] = useState<'map' | 'favorites'>('map');
  const [selectedId, setSelectedId] = useState('book:tri-osnovy-book');
  const [showAllConnections, setShowAllConnections] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const voiceRecognitionRef = useRef<VoiceRecognition | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceMeterFrameRef = useRef<number | null>(null);
  const voiceRequestIdRef = useRef(0);
  const searchHistoryTimerRef = useRef<number | null>(null);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selected = nodeById.get(selectedId) || graph.nodes[0];
  const favoriteIdSet = useMemo(() => new Set(favoriteNodeIds), [favoriteNodeIds]);
  const favoriteNodes = favoriteNodeIds.flatMap((id) => {
    const node = nodeById.get(id);
    return node ? [node] : [];
  });
  const selectedIsFavorite = Boolean(selected && favoriteIdSet.has(selected.id));
  const voiceActive = voiceStarting || voiceListening;
  const taxonomyFilters = useMemo<TaxonomyFilter[]>(() => {
    const filters = graph.edges.flatMap((edge) => {
      if (edge.label !== 'категория каталога' && edge.label !== 'тег каталога') return [];
      const relation = edge.label as TaxonomyFilter['relation'];
      const topic = nodeById.get(edge.to);
      return topic ? [{ id: JSON.stringify([relation, edge.to]), topicId: edge.to, relation, title: topic.title }] : [];
    });
    return Array.from(new Map(filters.map((filter) => [filter.id, filter])).values())
      .sort((a, b) => a.relation.localeCompare(b.relation, 'ru') || a.title.localeCompare(b.title, 'ru'));
  }, [graph.edges, nodeById]);

  useEffect(() => {
    try {
      if (searchHistory.length) window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(searchHistory));
      else window.localStorage.removeItem(searchHistoryStorageKey);
    } catch {
      // Search history remains usable in memory if browser storage is unavailable.
    }
  }, [searchHistory]);

  useEffect(() => {
    setFavoriteNodeIds((current) => {
      const valid = current.filter((id) => nodeById.has(id));
      return valid.length === current.length ? current : valid;
    });
  }, [nodeById]);

  useEffect(() => {
    try {
      if (favoriteNodeIds.length) window.localStorage.setItem(favoriteNodeStorageKey, JSON.stringify(favoriteNodeIds));
      else window.localStorage.removeItem(favoriteNodeStorageKey);
    } catch {
      // Favorites remain available in memory if browser storage is unavailable.
    }
  }, [favoriteNodeIds]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery && kindFilter === 'all' && !taxonomyFilterId) return;
    const timeout = window.setTimeout(() => {
      searchHistoryTimerRef.current = null;
      const item: SearchHistoryItem = { query: normalizedQuery.slice(0, 200), kindFilter, taxonomyFilterId };
      const itemKey = JSON.stringify([item.query, item.kindFilter, item.taxonomyFilterId]);
      setSearchHistory((current) => {
        if (current[0] && JSON.stringify([current[0].query, current[0].kindFilter, current[0].taxonomyFilterId]) === itemKey) return current;
        return [item, ...current.filter((entry) => JSON.stringify([entry.query, entry.kindFilter, entry.taxonomyFilterId]) !== itemKey)].slice(0, searchHistoryLimit);
      });
    }, 600);
    searchHistoryTimerRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (searchHistoryTimerRef.current === timeout) searchHistoryTimerRef.current = null;
    };
  }, [query, kindFilter, taxonomyFilterId]);

  useEffect(() => {
    setVoiceSupported(Boolean(getVoiceRecognitionConstructor() && typeof navigator.mediaDevices?.getUserMedia === 'function' && getAudioContextConstructor()));
    return () => {
      voiceRequestIdRef.current += 1;
      voiceRecognitionRef.current?.abort();
      if (voiceMeterFrameRef.current !== null) cancelAnimationFrame(voiceMeterFrameRef.current);
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceAudioContextRef.current && voiceAudioContextRef.current.state !== 'closed') {
        void voiceAudioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  const releaseVoiceMeter = () => {
    if (voiceMeterFrameRef.current !== null) cancelAnimationFrame(voiceMeterFrameRef.current);
    voiceMeterFrameRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    const context = voiceAudioContextRef.current;
    voiceAudioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    setVoiceLevel(0);
  };

  const toggleVoiceSearch = async () => {
    if (voiceStarting) {
      voiceRequestIdRef.current += 1;
      setVoiceStarting(false);
      setVoiceListening(false);
      voiceRecognitionRef.current?.abort();
      releaseVoiceMeter();
      setVoiceMessage('Запуск голосового поиска отменён.');
      return;
    }
    if (voiceListening) {
      voiceRequestIdRef.current += 1;
      voiceRecognitionRef.current?.stop();
      voiceRecognitionRef.current = null;
      setVoiceListening(false);
      releaseVoiceMeter();
      setVoiceMessage('Голосовой поиск остановлен.');
      return;
    }
    const Recognition = getVoiceRecognitionConstructor();
    if (!Recognition) {
      setVoiceMessage('Голосовой ввод не поддерживается этим браузером.');
      return;
    }

    const requestId = ++voiceRequestIdRef.current;
    setVoiceStarting(true);
    setVoiceMessage('Запрашиваем доступ к микрофону…');
    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('microphone-unavailable');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requestId !== voiceRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      voiceStreamRef.current = stream;
      const AudioContextClass = getAudioContextConstructor();
      if (!AudioContextClass) throw new Error('audio-meter-unavailable');
      const context = new AudioContextClass();
      voiceAudioContextRef.current = context;
      if (context.state === 'suspended') await context.resume();
      if (requestId !== voiceRequestIdRef.current) {
        releaseVoiceMeter();
        return;
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const source = context.createMediaStreamSource(stream);
      const silentOutput = context.createGain();
      silentOutput.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silentOutput);
      silentOutput.connect(context.destination);
      const samples = new Float32Array(analyser.fftSize);
      let smoothedLevel = 0;
      let lastUiUpdate = 0;
      const measureInput = (time: number) => {
        if (requestId !== voiceRequestIdRef.current) return;
        analyser.getFloatTimeDomainData(samples);
        const meanSquare = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
        const rms = Math.sqrt(meanSquare);
        const targetLevel = Math.min(1, rms * 8);
        smoothedLevel += (targetLevel - smoothedLevel) * (targetLevel > smoothedLevel ? 0.55 : 0.18);
        if (time - lastUiUpdate >= 60) {
          setVoiceLevel(smoothedLevel);
          lastUiUpdate = time;
        }
        voiceMeterFrameRef.current = requestAnimationFrame(measureInput);
      };
      voiceMeterFrameRef.current = requestAnimationFrame(measureInput);
    } catch (error) {
      if (requestId !== voiceRequestIdRef.current) return;
      releaseVoiceMeter();
      setVoiceStarting(false);
      const errorName = error instanceof Error && ['audio-meter-unavailable', 'microphone-unavailable'].includes(error.message)
        ? error.message
        : error instanceof Error ? error.name : '';
      const messages: Record<string, string> = {
        NotAllowedError: 'Для измерения уровня разрешите доступ к микрофону в браузере.',
        NotFoundError: 'Микрофон не найден. Подключите микрофон и попробуйте снова.',
        NotReadableError: 'Не удалось открыть микрофон. Проверьте, не занят ли он другим приложением.',
        SecurityError: 'Доступ к микрофону недоступен в этом контексте. Откройте сайт по защищённому HTTPS-соединению.',
        'audio-meter-unavailable': 'Этот браузер не поддерживает локальный измеритель уровня звука.',
        'microphone-unavailable': 'Браузер не предоставляет доступ к микрофону; голосовой поиск недоступен.'
      };
      setVoiceMessage(messages[errorName] || 'Не удалось получить уровень сигнала микрофона. Проверьте разрешения и попробуйте снова.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      if (requestId !== voiceRequestIdRef.current) return;
      setVoiceStarting(false);
      setVoiceListening(true);
      setVoiceMessage('Говорите — результаты поиска обновятся по распознанным словам, уровень микрофона показан рядом.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index][0]?.transcript || '').join(' ').trim();
      if (transcript) setQuery(transcript);
    };
    recognition.onerror = (event) => {
      if (requestId !== voiceRequestIdRef.current) return;
      setVoiceStarting(false);
      setVoiceListening(false);
      releaseVoiceMeter();
      const messages: Record<string, string> = {
        'not-allowed': 'Разрешите доступ к микрофону в настройках браузера и попробуйте снова.',
        'service-not-allowed': 'Браузер не разрешил службу распознавания речи.',
        'no-speech': 'Речь не обнаружена. Нажмите на микрофон и попробуйте ещё раз.',
        network: 'Служба распознавания речи недоступна. Проверьте соединение и попробуйте снова.'
      };
      setVoiceMessage(messages[event.error] || 'Не удалось распознать речь. Попробуйте ещё раз или введите запрос вручную.');
    };
    recognition.onend = () => {
      if (requestId !== voiceRequestIdRef.current) return;
      setVoiceStarting(false);
      setVoiceListening(false);
      voiceRecognitionRef.current = null;
      releaseVoiceMeter();
    };
    voiceRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      voiceRequestIdRef.current += 1;
      voiceRecognitionRef.current = null;
      setVoiceStarting(false);
      setVoiceListening(false);
      releaseVoiceMeter();
      setVoiceMessage('Не удалось запустить микрофон. Попробуйте ещё раз или введите запрос вручную.');
    }
  };

  const searchResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const selectedTaxonomy = taxonomyFilters.find((filter) => filter.id === taxonomyFilterId);
    if (!needle && !selectedTaxonomy) return [];
    const taxonomyNodeIds = new Set<string>();
    if (selectedTaxonomy) {
      taxonomyNodeIds.add(selectedTaxonomy.topicId);
      const lectureIds = graph.edges
        .filter((edge) => edge.to === selectedTaxonomy.topicId && edge.label === selectedTaxonomy.relation)
        .map((edge) => edge.from);
      lectureIds.forEach((lectureId) => {
        taxonomyNodeIds.add(lectureId);
        graph.edges.filter((edge) => edge.from === lectureId).forEach((edge) => {
          taxonomyNodeIds.add(edge.to);
          if (nodeById.get(edge.to)?.kind === 'note') {
            graph.edges.filter((childEdge) => childEdge.from === edge.to).forEach((childEdge) => taxonomyNodeIds.add(childEdge.to));
          }
        });
      });
    }
    return graph.nodes
      .filter((node) => (kindFilter === 'all' || node.kind === kindFilter)
        && (!selectedTaxonomy || taxonomyNodeIds.has(node.id))
        && (!needle || `${node.title} ${node.description} ${node.status}`.toLocaleLowerCase().includes(needle)))
      .slice(0, 12);
  }, [graph.edges, graph.nodes, kindFilter, nodeById, query, taxonomyFilterId, taxonomyFilters]);

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
  const toggleFavorite = (id: string) => {
    setFavoriteNodeIds((current) => current.includes(id)
      ? current.filter((favoriteId) => favoriteId !== id)
      : [id, ...current]);
  };
  const restoreSearchHistory = (item: SearchHistoryItem) => {
    setQuery(item.query);
    setKindFilter(item.kindFilter);
    setTaxonomyFilterId(taxonomyFilters.some((filter) => filter.id === item.taxonomyFilterId) ? item.taxonomyFilterId : '');
  };
  const clearSearchHistory = () => {
    if (searchHistoryTimerRef.current !== null) window.clearTimeout(searchHistoryTimerRef.current);
    searchHistoryTimerRef.current = null;
    setSearchHistory([]);
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

      <div role="group" aria-label="Раздел карты знаний" className="inline-flex flex-wrap gap-1 rounded-full border border-black/5 bg-white/70 p-1 dark:border-white/10 dark:bg-[#101010]/80">
        <button type="button" onClick={() => setActiveTab('map')} aria-pressed={activeTab === 'map'} className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'map' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'text-muted hover:text-text dark:text-darkmuted dark:hover:text-darktext'}`}>Карта</button>
        <button type="button" onClick={() => setActiveTab('favorites')} aria-pressed={activeTab === 'favorites'} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'favorites' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'text-muted hover:text-text dark:text-darkmuted dark:hover:text-darktext'}`}>
          <Star size={14} aria-hidden="true" /> Избранное <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">{favoriteNodes.length}</span>
        </button>
      </div>

      {activeTab === 'map' ? (
        <>
      <section className="panel p-5 sm:p-6" aria-labelledby="knowledge-search-heading">
        <h2 id="knowledge-search-heading" className="font-display text-2xl text-text dark:text-darktext">Найти узел карты</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_13rem_16rem]">
          <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 dark:border-white/10 dark:bg-[#161616] md:col-span-2 lg:col-span-1">
            <Search size={17} className="shrink-0 text-muted dark:text-darkmuted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Искать по названиям и метаданным…"
              aria-label="Поиск узлов карты знаний"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted dark:text-darktext dark:placeholder:text-darkmuted"
            />
            <button
              type="button"
              onClick={toggleVoiceSearch}
              disabled={!voiceSupported && !voiceMessage}
              aria-label={voiceActive ? 'Остановить голосовой поиск' : 'Начать голосовой поиск'}
              aria-pressed={voiceActive}
              title={voiceActive ? 'Остановить голосовой поиск' : voiceSupported ? 'Искать голосом' : 'Голосовой поиск недоступен в этом браузере'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8874A] disabled:cursor-not-allowed disabled:opacity-40 ${voiceActive ? 'bg-[#B8874A]/15 text-[#805322] dark:bg-[#E0821E]/15 dark:text-[#F3B76B]' : 'text-muted hover:bg-black/5 hover:text-text dark:text-darkmuted dark:hover:bg-white/10 dark:hover:text-darktext'}`}
            >
              {voiceListening ? (
                <span className="flex items-center gap-1" aria-hidden="true">
                  <Mic size={16} />
                  <span className="flex h-4 items-end gap-0.5">
                    {[0.55, 1, 0.72].map((gain, index) => (
                      <span key={index} className="block w-0.5 rounded-full bg-current transition-[height] duration-75" style={{ height: `${Math.max(2, Math.round(voiceLevel * 15 * gain))}px` }} />
                    ))}
                  </span>
                </span>
              ) : <Mic size={17} aria-hidden="true" />}
            </button>
          </div>
          <label className="rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 py-2 dark:border-white/10 dark:bg-[#161616]">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Тип узла</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'all' | NodeKind)} className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext" aria-label="Фильтр типа узла">
              <option value="all">Все типы</option>
              {(Object.keys(kindLabels) as NodeKind[]).map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
            </select>
          </label>
          <label className="rounded-2xl border border-black/5 bg-[#F7F9FC] px-4 py-2 dark:border-white/10 dark:bg-[#161616]">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted dark:text-darkmuted">Категория или тег</span>
            <select value={taxonomyFilterId} onChange={(event) => setTaxonomyFilterId(event.target.value)} className="w-full bg-transparent text-sm text-text outline-none dark:text-darktext" aria-label="Фильтр категории или тега">
              <option value="">Все категории и теги</option>
              <optgroup label="Категории">
                {taxonomyFilters.filter((filter) => filter.relation === 'категория каталога').map((filter) => <option key={filter.id} value={filter.id}>{filter.title}</option>)}
              </optgroup>
              <optgroup label="Теги">
                {taxonomyFilters.filter((filter) => filter.relation === 'тег каталога').map((filter) => <option key={filter.id} value={filter.id}>{filter.title}</option>)}
              </optgroup>
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted dark:text-darkmuted" aria-live="polite">
          {voiceMessage || (!voiceSupported ? 'Голосовой поиск с измерением уровня не поддерживается этим браузером; можно искать текстом.' : 'RMS-уровень микрофона анализируется локально. Распознавание речи обрабатывает браузер и его поставщик.')}
        </p>
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10" role="region" aria-label="История поисков">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-text dark:text-darktext">Недавние поиски</h3>
            {searchHistory.length > 0 && <button type="button" onClick={clearSearchHistory} className="text-xs text-muted underline-offset-2 hover:underline dark:text-darkmuted">Очистить историю</button>}
          </div>
          {searchHistory.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((item) => {
                const taxonomy = taxonomyFilters.find((filter) => filter.id === item.taxonomyFilterId);
                const filterSummary = [
                  item.kindFilter === 'all' ? 'Все типы' : kindLabels[item.kindFilter],
                  taxonomy ? `${taxonomy.relation === 'категория каталога' ? 'Категория' : 'Тег'}: ${taxonomy.title}` : item.taxonomyFilterId ? 'Старая категория или тег' : 'Все категории и теги'
                ].join(' · ');
                return (
                  <button key={JSON.stringify([item.query, item.kindFilter, item.taxonomyFilterId])} type="button" onClick={() => restoreSearchHistory(item)} title={`${item.query || 'Поиск без текста'} — ${filterSummary}`} className="max-w-full rounded-xl border border-black/5 bg-[#F7F9FC] px-3 py-2 text-left transition hover:border-[#B8874A]/50 dark:border-white/10 dark:bg-[#161616] dark:hover:border-[#E0821E]/50">
                    <span className="block max-w-64 truncate text-xs font-medium text-text dark:text-darktext">{item.query || 'Только фильтры'}</span>
                    <span className="block max-w-64 truncate text-[10px] text-muted dark:text-darkmuted">{filterSummary}</span>
                  </button>
                );
              })}
            </div>
          ) : <p className="text-xs text-muted dark:text-darkmuted">Запросы и выбранные фильтры появятся здесь после поиска.</p>}
          <p className="mt-2 text-[10px] text-muted dark:text-darkmuted">История хранится только в localStorage этого браузера. Её можно очистить в любой момент.</p>
        </div>
        {(query.trim() || taxonomyFilterId) && (
          <div className="mt-4" role="region" aria-label="Результаты поиска по карте">
            <p className="mb-2 text-sm text-muted dark:text-darkmuted" aria-live="polite">{searchResults.length ? `Показано результатов: ${searchResults.length}${searchResults.length === 12 ? ' (первые 12)' : ''}` : 'Совпадений по заданным условиям нет.'}</p>
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
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Выбранный узел</div>
              <button type="button" onClick={() => toggleFavorite(selected.id)} aria-pressed={selectedIsFavorite} aria-label={selectedIsFavorite ? `Убрать из избранного: ${selected.title}` : `Добавить в избранное: ${selected.title}`} title={selectedIsFavorite ? 'Убрать из избранного' : 'Добавить в избранное'} className={`icon-button shrink-0 ${selectedIsFavorite ? 'text-[#B8874A] dark:text-[#E0821E]' : ''}`}>
                <Star size={17} className={selectedIsFavorite ? 'fill-current' : ''} aria-hidden="true" />
              </button>
            </div>
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
        </>
      ) : (
        <section className="panel p-5 sm:p-6" aria-labelledby="knowledge-favorites-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Личная подборка</div>
              <h2 id="knowledge-favorites-heading" className="mt-1 font-display text-3xl text-text dark:text-darktext">Избранные узлы</h2>
              <p className="mt-2 text-sm text-muted dark:text-darkmuted">Список сохраняется только в localStorage этого браузера.</p>
            </div>
            <span className="rounded-full border border-black/5 px-3 py-2 text-xs text-muted dark:border-white/10 dark:text-darkmuted">{formatRussianCount(favoriteNodes.length, 'узел', 'узла', 'узлов')}</span>
          </div>
          {favoriteNodes.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {favoriteNodes.map((node) => (
                <article key={node.id} className="flex min-w-0 items-center gap-2 rounded-2xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-[#141414]">
                  <button type="button" onClick={() => { focusNode(node.id); setActiveTab('map'); }} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kindColors[node.kind]}`}>{iconForKind(node.kind)}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-text dark:text-darktext">{node.title}</span><span className="block truncate text-xs text-muted dark:text-darkmuted">{kindLabels[node.kind]} · {node.status}</span></span>
                  </button>
                  <button type="button" onClick={() => toggleFavorite(node.id)} aria-label={`Убрать из избранного: ${node.title}`} title="Убрать из избранного" className="icon-button h-9 w-9 shrink-0">
                    <Star size={16} className="fill-current text-[#B8874A] dark:text-[#E0821E]" aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-black/15 p-6 text-center dark:border-white/15">
              <Star size={22} className="mx-auto text-muted dark:text-darkmuted" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted dark:text-darkmuted">Пока нет сохранённых узлов. Откройте карту, выберите узел и нажмите на звёздочку.</p>
              <button type="button" onClick={() => setActiveTab('map')} className="mt-4 min-h-10 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-text dark:border-white/15 dark:text-darktext">Открыть карту</button>
            </div>
          )}
        </section>
      )}

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted dark:text-darkmuted"><Link2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />На текущем этапе в исходных данных нет глав книги и отдельного набора подтверждённых религиозных связей. Карта не создаёт их автоматически.</p>
    </main>
  );
}
