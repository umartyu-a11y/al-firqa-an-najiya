import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { sanitizeHandwritingStrokes, HANDWRITING_MAX_STROKES } from './lib/handwriting';
import type { HandwritingStroke } from './types';

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 240;
const CSS_PX_PER_MM = 96 / 25.4;
const MAX_POINTS_PER_STROKE = 120;
const MAX_PATH_LENGTH = 1800;
const MAX_TOTAL_PATH_LENGTH = 12000;

type Tool = 'pencil' | 'pen';
type Point = { x: number; y: number };
type ActiveStroke = { pointerId: number; color: string; width: number; opacity: number; points: Point[]; path: string };

const getPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (matrix) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return {
      x: Math.max(0, Math.min(VIEW_WIDTH, local.x)),
      y: Math.max(0, Math.min(VIEW_HEIGHT, local.y))
    };
  }

  const rect = svg.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(VIEW_WIDTH, ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH)),
    y: Math.max(0, Math.min(VIEW_HEIGHT, ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT))
  };
};

const pathFromPoints = (points: Point[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

function StrokePaths({ strokes }: { strokes: HandwritingStroke[] }) {
  return <>{strokes.map((stroke, index) => <path key={index} d={stroke.path} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeOpacity={stroke.opacity ?? 1} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</>;
}

export function HandwritingPreview({ strokes }: { strokes?: HandwritingStroke[] }) {
  const safeStrokes = sanitizeHandwritingStrokes(strokes);
  if (!safeStrokes.length) return null;
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Рукописная заметка" className="mt-3 block h-24 w-full rounded-xl border border-black/5 bg-[#fffefb] dark:border-white/10">
      <StrokePaths strokes={safeStrokes} />
    </svg>
  );
}

export function HandwritingPad({ strokes = [], onChange, label }: { strokes?: HandwritingStroke[]; onChange: (strokes: HandwritingStroke[]) => void; label: string }) {
  const [tool, setTool] = useState<Tool>('pencil');
  const [thicknessMm, setThicknessMm] = useState(1.5);
  const [draft, setDraft] = useState<HandwritingStroke | null>(null);
  const activeStroke = useRef<ActiveStroke | null>(null);
  const safeStrokes = sanitizeHandwritingStrokes(strokes);
  const totalPathLength = safeStrokes.reduce((sum, stroke) => sum + stroke.path.length, 0);
  const canDraw = safeStrokes.length < HANDWRITING_MAX_STROKES && totalPathLength < MAX_TOTAL_PATH_LENGTH;

  const startStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!canDraw || activeStroke.current || event.button !== 0) return;
    event.preventDefault();
    const point = getPoint(event);
    const stroke: ActiveStroke = {
      pointerId: event.pointerId,
      color: tool === 'pencil' ? '#263238' : '#9b6d32',
      width: thicknessMm * CSS_PX_PER_MM,
      opacity: tool === 'pencil' ? 0.82 : 1,
      points: [point],
      path: pathFromPoints([point])
    };
    activeStroke.current = stroke;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Continue with pointer events on the drawing surface when capture is unavailable.
    }
    setDraft({ path: stroke.path, color: stroke.color, width: stroke.width, opacity: stroke.opacity });
  };

  const continueStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = activeStroke.current;
    if (!active || active.pointerId !== event.pointerId || active.points.length >= MAX_POINTS_PER_STROKE) return;
    event.preventDefault();
    const point = getPoint(event);
    const last = active.points[active.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 1.4) return;
    const nextPoints = [...active.points, point];
    const path = pathFromPoints(nextPoints);
    if (path.length > MAX_PATH_LENGTH || totalPathLength + path.length > MAX_TOTAL_PATH_LENGTH) return;
    active.points = nextPoints;
    active.path = path;
    setDraft({ path, color: active.color, width: active.width, opacity: active.opacity });
  };

  const finishStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = activeStroke.current;
    if (!active || active.pointerId !== event.pointerId) return;
    activeStroke.current = null;
    setDraft(null);
    if (active.path && active.path.length <= MAX_PATH_LENGTH) {
      onChange(sanitizeHandwritingStrokes([...safeStrokes, { path: active.path, color: active.color, width: active.width, opacity: active.opacity }]));
    }
  };

  const clear = () => {
    if (!safeStrokes.length) return;
    if (window.confirm('Очистить весь рисунок к этой закладке?')) onChange([]);
  };

  return (
    <div className="mt-3 rounded-2xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs font-medium text-muted dark:text-darkmuted">Рисунок к закладке</span>
        <button type="button" aria-pressed={tool === 'pencil'} onClick={() => setTool('pencil')} className={`rounded-full px-3 py-2 text-xs ${tool === 'pencil' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/10 text-text dark:border-white/10 dark:text-darktext'}`}>Карандаш</button>
        <button type="button" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} className={`rounded-full px-3 py-2 text-xs ${tool === 'pen' ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/10 text-text dark:border-white/10 dark:text-darktext'}`}>Перо</button>
        <label className="flex min-w-40 items-center gap-2 text-xs text-muted dark:text-darkmuted">
          <span>Толщина</span>
          <input type="range" min="1" max="10" step="0.5" value={thicknessMm} onChange={(event) => setThicknessMm(Number(event.target.value))} aria-label="Толщина линии, миллиметры" className="w-full accent-[#B8874A] dark:accent-[#E0821E]" />
          <output className="w-10 text-right tabular-nums">{thicknessMm} мм</output>
        </label>
        <button type="button" disabled={!safeStrokes.length} onClick={() => onChange(safeStrokes.slice(0, -1))} className="rounded-full border border-black/10 px-3 py-2 text-xs text-muted disabled:opacity-40 dark:border-white/10 dark:text-darkmuted">Отменить</button>
        <button type="button" disabled={!safeStrokes.length} onClick={clear} className="rounded-full border border-black/10 px-3 py-2 text-xs text-muted disabled:opacity-40 dark:border-white/10 dark:text-darkmuted">Очистить</button>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="application"
        aria-label={`${label}. Рисуйте пальцем или стилусом`}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onContextMenu={(event) => event.preventDefault()}
        style={{ touchAction: 'none' }}
        className={`block h-36 w-full rounded-xl border border-black/10 bg-[#fffefb] dark:border-white/10 ${canDraw ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
      >
        <StrokePaths strokes={safeStrokes} />
        {draft && <StrokePaths strokes={[draft]} />}
      </svg>
      <p className="mt-2 text-[11px] leading-5 text-muted dark:text-darkmuted">Рисуйте в поле пальцем или стилусом. Штрихи сохраняются вместе с закладкой на этом устройстве.</p>
    </div>
  );
}
