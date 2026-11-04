import type { HandwritingStroke } from '../types';

export const HANDWRITING_MAX_STROKES = 24;
const MAX_PATH_LENGTH = 1800;
const MAX_TOTAL_PATH_LENGTH = 12000;
const MAX_VIEW_WIDTH = 800;
const MAX_VIEW_HEIGHT = 240;
const SAFE_COLORS = new Set(['#263238', '#9b6d32']);
const SAFE_PATH = /^M -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?(?: L -?\d+(?:\.\d+)? -?\d+(?:\.\d+)?)*$/;

export const sanitizeHandwritingStrokes = (value: unknown): HandwritingStroke[] => {
  if (!Array.isArray(value)) return [];
  const result: HandwritingStroke[] = [];
  let totalLength = 0;

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const stroke = entry as Record<string, unknown>;
    if (typeof stroke.path !== 'string' || stroke.path.length > MAX_PATH_LENGTH || !SAFE_PATH.test(stroke.path)) continue;
    if (typeof stroke.color !== 'string' || !SAFE_COLORS.has(stroke.color.toLowerCase())) continue;
    const width = Number(stroke.width);
    const opacity = stroke.opacity === undefined ? 1 : Number(stroke.opacity);
    if (!Number.isFinite(width) || width < 1 || width > 38 || !Number.isFinite(opacity) || opacity < 0.1 || opacity > 1) continue;

    const coordinates = stroke.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    let coordinatesAreValid = coordinates.length >= 2 && coordinates.length % 2 === 0;
    for (let index = 0; coordinatesAreValid && index < coordinates.length; index += 2) {
      coordinatesAreValid = coordinates[index] >= 0 && coordinates[index] <= MAX_VIEW_WIDTH
        && coordinates[index + 1] >= 0 && coordinates[index + 1] <= MAX_VIEW_HEIGHT;
    }
    if (!coordinatesAreValid || totalLength + stroke.path.length > MAX_TOTAL_PATH_LENGTH) continue;

    totalLength += stroke.path.length;
    result.push({ path: stroke.path, color: stroke.color.toLowerCase(), width, opacity });
    if (result.length >= HANDWRITING_MAX_STROKES) break;
  }

  return result;
};
