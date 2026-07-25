import JSZip from 'jszip';

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
