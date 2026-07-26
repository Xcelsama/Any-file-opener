function matches(bytes, offset, sig) {
  if (offset + sig.length > bytes.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function asciiAt(bytes, offset, str) {
  const sig = Array.from(str, (c) => c.charCodeAt(0));
  return matches(bytes, offset, sig);
}

const SIGNATURES = [
  { label: 'PNG image', kind: 'image', ext: 'png', test: (b) => matches(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { label: 'JPEG image', kind: 'image', ext: 'jpg', test: (b) => matches(b, 0, [0xff, 0xd8, 0xff]) },
  { label: 'GIF image', kind: 'image', ext: 'gif', test: (b) => asciiAt(b, 0, 'GIF8') },
  { label: 'BMP image', kind: 'image', ext: 'bmp', test: (b) => asciiAt(b, 0, 'BM') },
  { label: 'ICO icon', kind: 'image', ext: 'ico', test: (b) => matches(b, 0, [0x00, 0x00, 0x01, 0x00]) },
  { label: 'WebP image', kind: 'image', ext: 'webp', test: (b) => asciiAt(b, 0, 'RIFF') && asciiAt(b, 8, 'WEBP') },
  { label: 'WAV audio', kind: 'audio', ext: 'wav', test: (b) => asciiAt(b, 0, 'RIFF') && asciiAt(b, 8, 'WAVE') },
  { label: 'PSD document', kind: 'nopreview', category: 'design', ext: 'psd', test: (b) => asciiAt(b, 0, '8BPS') },
  { label: 'PDF document', kind: 'pdf', ext: 'pdf', test: (b) => asciiAt(b, 0, '%PDF') },
  { label: 'RTF document', kind: 'code', category: 'docs', lang: 'text', ext: 'rtf', test: (b) => asciiAt(b, 0, '{\\rtf') },
  { label: 'MP3 audio', kind: 'audio', ext: 'mp3', test: (b) => asciiAt(b, 0, 'ID3') || matches(b, 0, [0xff, 0xfb]) || matches(b, 0, [0xff, 0xf3]) || matches(b, 0, [0xff, 0xf2]) },
  { label: 'FLAC audio', kind: 'audio', ext: 'flac', test: (b) => asciiAt(b, 0, 'fLaC') },
  { label: 'OGG media', kind: 'audio', ext: 'ogg', test: (b) => asciiAt(b, 0, 'OggS') },
  { label: 'MP4/MOV media', kind: 'video', ext: 'mp4', test: (b) => asciiAt(b, 4, 'ftyp') },
  { label: 'Matroska/WebM video', kind: 'video', ext: 'webm', test: (b) => matches(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) },
  { label: 'FLV video', kind: 'video', ext: 'flv', test: (b) => asciiAt(b, 0, 'FLV') },
  { label: 'SQLite database', kind: 'nopreview', category: 'database', ext: 'sqlite', test: (b) => asciiAt(b, 0, 'SQLite format 3') },
  { label: 'TrueType font', kind: 'font', ext: 'ttf', test: (b) => matches(b, 0, [0x00, 0x01, 0x00, 0x00]) || asciiAt(b, 0, 'true') },
  { label: 'OpenType font', kind: 'font', ext: 'otf', test: (b) => asciiAt(b, 0, 'OTTO') },
  { label: 'TrueType collection', kind: 'font', ext: 'ttf', test: (b) => asciiAt(b, 0, 'ttcf') },
  { label: 'WOFF font', kind: 'font', ext: 'woff', test: (b) => asciiAt(b, 0, 'wOFF') },
  { label: 'WOFF2 font', kind: 'font', ext: 'woff2', test: (b) => asciiAt(b, 0, 'wOF2') },
  { label: 'Java class file', kind: 'nopreview', category: 'other', ext: 'class', test: (b) => matches(b, 0, [0xca, 0xfe, 0xba, 0xbe]) },
  { label: 'Windows executable', kind: 'nopreview', category: 'package', ext: 'exe', test: (b) => asciiAt(b, 0, 'MZ') },
  { label: 'Linux executable (ELF)', kind: 'nopreview', category: 'package', ext: 'bin', test: (b) => matches(b, 0, [0x7f, 0x45, 0x4c, 0x46]) },
  { label: '7-Zip archive', kind: 'nopreview', category: 'archive', ext: '7z', test: (b) => matches(b, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) },
  { label: 'RAR archive', kind: 'nopreview', category: 'archive', ext: 'rar', test: (b) => asciiAt(b, 0, 'Rar!') },
  { label: 'Gzip archive', kind: 'nopreview', category: 'archive', ext: 'gz', test: (b) => matches(b, 0, [0x1f, 0x8b]) },
  { label: 'Bzip2 archive', kind: 'nopreview', category: 'archive', ext: 'bz2', test: (b) => asciiAt(b, 0, 'BZh') },
  { label: 'ZIP-based archive', kind: 'archive', ext: 'zip', test: (b) => asciiAt(b, 0, 'PK') },
];

export function identifyBytes(bytes) {
  for (const sig of SIGNATURES) {
    if (sig.test(bytes)) {
      const { test, ...info } = sig;
      return info;
    }
  }
  return null;
}

export async function sniffFile(file) {
  const headSize = Math.min(file.size, 64);
  if (headSize === 0) return null;
  const buffer = await file.slice(0, headSize).arrayBuffer();
  return identifyBytes(new Uint8Array(buffer));
}

export const ZIP_MARKERS = [
  { path: 'word/document.xml', kind: 'docx', category: 'docs', ext: 'docx', label: 'Word document' },
  { path: 'xl/workbook.xml', kind: 'sheet', category: 'spreadsheet', ext: 'xlsx', label: 'Excel workbook' },
  { path: 'ppt/presentation.xml', kind: 'nopreview', category: 'presentation', ext: 'pptx', label: 'PowerPoint presentation' },
  { path: 'META-INF/MANIFEST.MF', kind: 'archive', category: 'archive', ext: 'jar', label: 'Java archive' },
];
