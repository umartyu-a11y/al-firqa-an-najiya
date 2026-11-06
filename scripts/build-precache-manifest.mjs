import { readdir, stat, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const outputRoot = resolve('dist');
const manifestPath = resolve(outputRoot, 'precache-manifest.json');
const maxFileBytes = 10 * 1024 * 1024;
const excludedMediaExtensions = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.mp4', '.webm', '.mov']);
const excludedNames = new Set(['sw.js', 'precache-manifest.json']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

const files = await walk(outputRoot);
const assets = [];
let totalBytes = 0;
let skippedLargeFiles = 0;

for (const filePath of files) {
  const fileName = filePath.split(sep).at(-1);
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (excludedNames.has(fileName) || excludedMediaExtensions.has(extension) || extension === '.map') continue;

  const fileSize = (await stat(filePath)).size;
  if (fileSize > maxFileBytes) {
    skippedLargeFiles += 1;
    continue;
  }

  const relativePath = relative(outputRoot, filePath).split(sep).join('/');
  assets.push(`./${relativePath}`);
  totalBytes += fileSize;
}

assets.sort();
await writeFile(manifestPath, `${JSON.stringify({ assets, totalBytes }, null, 2)}\n`, 'utf8');
console.log(`Офлайн-кэш: ${assets.length} локальных файлов, ${(totalBytes / 1024 / 1024).toFixed(2)} МБ; аудио и видео исключены.${skippedLargeFiles ? ` Крупных файлов пропущено: ${skippedLargeFiles}.` : ''}`);
