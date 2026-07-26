import JSZip from 'jszip';
import { ZIP_MARKERS } from './magicBytes';

export async function refineZipKind(arrayBuffer) {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const names = new Set(Object.keys(zip.files));
    for (const marker of ZIP_MARKERS) {
      if (names.has(marker.path)) {
        const { path, ...info } = marker;
        return info;
      }
    }
    const mimetypeEntry = zip.files['mimetype'];
    if (mimetypeEntry) {
      const content = await mimetypeEntry.async('text');
      if (content.trim() === 'application/epub+zip') {
        return { kind: 'archive', category: 'ebook', ext: 'epub', label: 'EPUB ebook' };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function readArchive(arrayBuffer, ext) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const entries = Object.values(zip.files)
    .map((entry) => {
      const trimmed = entry.name.replace(/\/$/, '');
      const parts = trimmed.split('/');
      return {
        path: entry.name,
        name: parts[parts.length - 1] || entry.name,
        depth: parts.length - 1,
        dir: entry.dir,
        size: entry._data ? entry._data.uncompressedSize : 0,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  let title = null;
  if (ext === 'epub') {
    try {
      const opfEntry = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.opf'));
      if (opfEntry) {
        const text = await opfEntry.async('text');
        const match = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (match) title = match[1].trim();
      }
    } catch {
      title = null;
    }
  }

  return { entries, title };
}
