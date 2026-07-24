export const CODE_EXT_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', vue: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python',
  java: 'java',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  yml: 'yaml', yaml: 'yaml',
  xml: 'xml',
  html: 'html', htm: 'html',
  css: 'css', scss: 'css', less: 'css',
  txt: 'text', log: 'text', ini: 'text', conf: 'text', cfg: 'text', env: 'text', toml: 'text', gitignore: 'text',
};

export const LANG_COLORS = {
  javascript: '#f1e05a', typescript: '#3178c6', python: '#3572A5', java: '#b07219', c: '#7d7d7d',
  cpp: '#f34b7d', php: '#8892d4', ruby: '#e05d68', go: '#00ADD8', rust: '#dea584', sql: '#e3a63a',
  bash: '#8fd14f', yaml: '#e05d68', html: '#e34c26', css: '#a774d1', xml: '#5b9bd5', text: '#8b949e',
};

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'ogv', 'm4v'];

export function getExt(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

export function classifyExt(ext) {
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (['xlsx', 'xls'].includes(ext)) return 'sheet';
  if (['csv', 'tsv'].includes(ext)) return 'csv';
  if (ext === 'json') return 'json';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (CODE_EXT_LANG[ext]) return 'code';
  return 'unknown';
}

export function formatSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function buildHexDump(buf) {
  const bytes = new Uint8Array(buf);
  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(chunk).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    rows.push({ offset: i.toString(16).padStart(6, '0'), hex, ascii });
  }
  return rows;
}

export function looksLikeText(arrayBuffer) {
  const sampleLen = Math.min(arrayBuffer.byteLength, 2000);
  if (sampleLen === 0) return true;
  const bytes = new Uint8Array(arrayBuffer, 0, sampleLen);
  let control = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 9 || b === 10 || b === 13) continue;
    if (b < 32 || b === 127) control++;
  }
  return control / sampleLen < 0.05;
}

export const genId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
