'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import {
  Upload, X, Copy, Download, Search, WrapText, FileCode2, FileImage,
  FileJson2, FileSpreadsheet, FileText, FileType2, Music, Video, Binary,
  Check, AlertTriangle, Loader2, FilePlus2, Eye, Code2, Pencil, Save, Wand2,
  Type, Archive, Mail, File, Menu, Info, ImageDown,
} from 'lucide-react';
import AboutModal from './AboutModal';
import {
  CATEGORIES, classify, formatSize, buildHexDump, looksLikeText, genId, noPreviewNote,
} from '../lib/fileTypes';
import { MAX_TEXT_FILE_SIZE, MAX_BINARY_FILE_SIZE, TEXT_LIMITED_KINDS, BINARY_LIMITED_KINDS } from '../lib/constants';
import { renderMarkdown } from '../lib/markdown';
import { readArchive, refineZipKind } from '../lib/archive';
import { sniffFile } from '../lib/magicBytes';
import { parseEml } from '../lib/eml';
import usePwaFileHandling from '../hooks/usePwaFileHandling';
import CodeEditor from './CodeEditor';
import PdfViewer from './PdfViewer';
import ImageEditor from './ImageEditor';
import AudioEditor from './AudioEditor';
import VideoEditor from './VideoEditor';
import CompareView from './CompareView';
import CommandPalette from './CommandPalette';
import FontPreview from './FontPreview';
import ArchiveBrowser from './ArchiveBrowser';
import EmailView from './EmailView';
import NoPreviewCard from './NoPreviewCard';
import { addRecentFile, getRecentFiles, removeRecentFile, clearRecentFiles, recentEntryToFile } from '../lib/recentFiles';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function metaLine(file) {
  const parts = [formatSize(file.size)];
  if (file.detectedNote) parts.push(`detected as ${file.detectedNote.label}`);
  if (file.meta?.width) parts.push(`${file.meta.width} × ${file.meta.height}`);
  if (file.meta?.duration) parts.push(formatDuration(file.meta.duration));
  if (file.kind === 'archive' && file.entries) parts.push(`${file.entries.length} entries`);
  if (file.lastModified) parts.push(formatDate(file.lastModified));
  return parts.filter(Boolean).join(' · ');
}

const EDITABLE_KINDS = ['code', 'json'];

const KIND_ICONS = {
  image: FileImage,
  pdf: FileType2,
  docx: FileText,
  sheet: FileSpreadsheet,
  csv: FileSpreadsheet,
  json: FileJson2,
  markdown: FileText,
  audio: Music,
  video: Video,
  font: Type,
  archive: Archive,
  email: Mail,
  binary: Binary,
  nopreview: File,
};

function iconFor(file, size = 15) {
  const Icon = KIND_ICONS[file.kind] || FileCode2;
  const color = CATEGORIES[file.category]?.color || '#9ca3af';
  return <Icon size={size} style={{ color }} />;
}

const CATEGORY_ORDER = Object.keys(CATEGORIES);

export default function FileViewer() {
  const [files, setFiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [wrap, setWrap] = useState(false);
  const [fontFamily, setFontFamily] = useState('mono');
  const [fontSize, setFontSize] = useState(13);
  const [showRaw, setShowRaw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [compareIds, setCompareIds] = useState(null); // [idA, idB] while comparing
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const inputRef = useRef(null);
  const filesRef = useRef(files);
  const dragCounter = useRef(0);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => { filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)); }, []);
  useEffect(() => { setEditing(false); setShowRaw(false); setMediaFailed(false); setConvertOpen(false); }, [activeId]);

  const refreshRecent = useCallback(() => { getRecentFiles().then(setRecentFiles); }, []);
  useEffect(() => { refreshRecent(); }, [refreshRecent]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateFile = useCallback((id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const processFile = useCallback(async (file, id, info) => {
    try {
      const detected = await sniffFile(file);
      let kind = info.kind;
      let category = info.category;
      let ext = info.ext;
      let lang = info.lang;
      let detectedNote = null;

      if (detected) {
        const consistentZip = detected.kind === 'archive' && ['docx', 'sheet', 'archive'].includes(kind);
        if (detected.kind !== kind && !consistentZip) {
          detectedNote = { label: detected.label, namedAs: `.${ext}` };
          kind = detected.kind;
          category = detected.category || category;
          ext = detected.ext;
          lang = detected.lang;
        }
      }

      if (detected?.ext === 'zip' && kind === 'archive') {
        try {
          const buffer = await file.arrayBuffer();
          const refined = await refineZipKind(buffer);
          if (refined && refined.kind !== kind) {
            detectedNote = { label: refined.label, namedAs: `.${info.ext}` };
            ({ kind, category, ext } = refined);
          }
        } catch {
          // not a valid zip after all — keep whatever we already resolved above
        }
      }

      if (kind !== info.kind || category !== info.category || ext !== info.ext) {
        updateFile(id, { kind, category, ext, lang, detectedNote });
      }

      if (['image', 'pdf', 'audio', 'video', 'nopreview'].includes(kind)) {
        updateFile(id, { status: 'ready' });
        return;
      }

      // Guard against freezing the tab/WebView on unexpectedly huge files —
      // everything below this point reads the whole file into memory first.
      if (TEXT_LIMITED_KINDS.includes(kind) && file.size > MAX_TEXT_FILE_SIZE) {
        updateFile(id, {
          status: 'error',
          error: `This file is ${formatSize(file.size)}, larger than the ${formatSize(MAX_TEXT_FILE_SIZE)} preview limit for this file type. Download it to view in a dedicated app instead.`,
        });
        return;
      }
      if (BINARY_LIMITED_KINDS.includes(kind) && file.size > MAX_BINARY_FILE_SIZE) {
        updateFile(id, {
          status: 'error',
          error: `This file is ${formatSize(file.size)}, larger than the ${formatSize(MAX_BINARY_FILE_SIZE)} preview limit for this file type. Download it to view in a dedicated app instead.`,
        });
        return;
      }

      if (kind === 'font') {
        const buffer = await file.arrayBuffer();
        updateFile(id, { buffer, status: 'ready' });
        return;
      }

      if (kind === 'archive') {
        const buffer = await file.arrayBuffer();
        const { entries, title } = await readArchive(buffer, ext);
        updateFile(id, { entries, archiveTitle: title, status: 'ready' });
        return;
      }

      if (kind === 'email') {
        const raw = await file.text();
        const { headers, body } = parseEml(raw);
        updateFile(id, { emailHeaders: headers, emailBody: body, status: 'ready' });
        return;
      }

      if (kind === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const { default: mammoth } = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        // Sanitize once here (not on every render) — docx content is
        // untrusted input, and this HTML gets rendered via dangerouslySetInnerHTML.
        updateFile(id, { html: DOMPurify.sanitize(result.value), status: 'ready' });
        return;
      }

      if (kind === 'sheet') {
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheets = {};
        workbook.SheetNames.forEach((name) => {
          sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false });
        });
        updateFile(id, { sheets, sheetNames: workbook.SheetNames, activeSheet: workbook.SheetNames[0], status: 'ready' });
        return;
      }

      if (kind === 'csv') {
        const text = await file.text();
        const { default: Papa } = await import('papaparse');
        const parsed = Papa.parse(text.trim(), { skipEmptyLines: true });
        updateFile(id, {
          text,
          sheets: { [file.name]: parsed.data },
          sheetNames: [file.name],
          activeSheet: file.name,
          status: 'ready',
        });
        return;
      }

      if (kind === 'json') {
        const text = await file.text();
        try {
          const pretty = JSON.stringify(JSON.parse(text), null, 2);
          updateFile(id, { text: pretty, status: 'ready' });
        } catch {
          updateFile(id, { text, status: 'ready', warning: 'Invalid JSON, showing raw text' });
        }
        return;
      }

      if (kind === 'markdown') {
        const text = await file.text();
        updateFile(id, { text, status: 'ready' });
        return;
      }

      if (kind === 'code') {
        const text = await file.text();
        updateFile(id, { text, status: 'ready' });
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      if (looksLikeText(arrayBuffer)) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        updateFile(id, { kind: 'code', lang: 'text', text, status: 'ready' });
      } else {
        updateFile(id, { kind: 'binary', hex: buildHexDump(arrayBuffer.slice(0, 512)), status: 'ready' });
      }
    } catch (err) {
      updateFile(id, { status: 'error', error: err?.message || 'Failed to read this file' });
    }
  }, [updateFile]);

  const handleFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    const records = arr.map((file) => {
      const info = classify(file.name);
      return {
        id: genId(), name: file.name, size: file.size, ext: info.ext, kind: info.kind,
        category: info.category, lang: info.lang, lastModified: file.lastModified,
        status: 'loading', url: URL.createObjectURL(file), modified: false,
      };
    });
    setFiles((prev) => [...prev, ...records]);
    setActiveId((prev) => prev ?? records[0].id);
    records.forEach((rec, idx) => processFile(arr[idx], rec.id, rec));
    arr.forEach((file) => addRecentFile(file).then(refreshRecent));
  }, [processFile, refreshRecent]);

  usePwaFileHandling(handleFiles);

  const removeFile = (id) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      const rest = prev.filter((f) => f.id !== id);
      if (activeId === id) setActiveId(rest.length ? rest[0].id : null);
      return rest;
    });
  };

  const selectFile = (id) => {
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      return;
    }
    setActiveId(id);
    setSidebarOpen(false);
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };

  const reopenRecent = async (entry) => {
    const file = recentEntryToFile(entry);
    handleFiles([file]);
  };

  const downloadSelectedAsZip = async () => {
    setBatchBusy(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const selected = files.filter((f) => selectedIds.has(f.id));
      await Promise.all(selected.map(async (f) => {
        const res = await fetch(f.url);
        const blob = await res.blob();
        zip.file(f.name, blob);
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      const href = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'files.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setBatchBusy(false);
    }
  };

  const batchConvertImages = async (format) => {
    setBatchBusy(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const selected = files.filter((f) => selectedIds.has(f.id) && f.kind === 'image');
      await Promise.all(selected.map((f) => new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const base = f.name.replace(/\.[^.]+$/, '');
              zip.file(`${base}.${format}`, blob);
            }
            resolve();
          }, format === 'jpeg' ? 'image/jpeg' : `image/${format}`, 0.92);
        };
        img.onerror = resolve;
        img.src = f.url;
      })));
      const content = await zip.generateAsync({ type: 'blob' });
      const href = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = href;
      a.download = `converted-${format}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setBatchBusy(false);
    }
  };

  const startCompare = () => {
    const ids = Array.from(selectedIds).slice(0, 2);
    if (ids.length === 2) setCompareIds(ids);
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {
      // clipboard access denied, nothing more to do
    }
  };

  const downloadFile = (file) => {
    const useEditedText = file.modified && file.text !== undefined;
    const href = useEditedText ? URL.createObjectURL(new Blob([file.text], { type: 'text/plain' })) : file.url;
    const a = document.createElement('a');
    a.href = href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (useEditedText) URL.revokeObjectURL(href);
  };

  const convertImage = (file, format) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const href = URL.createObjectURL(blob);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const a = document.createElement('a');
        a.href = href;
        a.download = `${baseName}.${format === 'jpeg' ? 'jpg' : format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }, `image/${format}`, 0.92);
    };
    img.src = file.url;
    setConvertOpen(false);
  };

  const formatJson = (file) => {
    try {
      const pretty = JSON.stringify(JSON.parse(file.text), null, 2);
      updateFile(file.id, { text: pretty, warning: undefined });
    } catch {
      updateFile(file.id, { warning: 'Cannot format, current content is not valid JSON' });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  const onDragEnter = (e) => { e.preventDefault(); dragCounter.current += 1; setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); dragCounter.current -= 1; if (dragCounter.current <= 0) setDragging(false); };

  const active = files.find((f) => f.id === activeId) || null;
  const visibleFiles = files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  const grouped = {};
  visibleFiles.forEach((f) => { (grouped[f.category] ||= []).push(f); });
  const activeCategories = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  const commandActions = [
    { id: 'toggle-select', label: 'Select multiple files', run: toggleSelectMode },
    { id: 'toggle-sidebar', label: 'Toggle sidebar', run: () => setSidebarOpen((v) => !v) },
    { id: 'open-file', label: 'Open a file…', run: () => inputRef.current?.click() },
    ...(active ? [
      { id: 'download-active', label: `Download ${active.name}`, run: () => downloadFile(active) },
      { id: 'close-active', label: `Close ${active.name}`, run: () => removeFile(active.id) },
    ] : []),
  ];

  return (
    <div
      className="h-screen w-full flex flex-col bg-slate-950 text-slate-200 select-none"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        {files.length > 0 && (
          <button onClick={() => setSidebarOpen((v) => !v)} className="sm:hidden p-1 -ml-1 text-slate-400">
            <Menu size={18} />
          </button>
        )}
        <div className="hidden sm:flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-amber-400/70" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        </div>
        <span className="font-mono text-sm text-slate-400 sm:ml-1">anyfile.viewer</span>
        <span className="hidden md:inline text-xs text-slate-600">open, preview and edit almost anything</span>
        <div className="flex-1" />
        {files.length > 0 && (
          <button
            onClick={toggleSelectMode}
            className={`hidden sm:flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md ${selectMode ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            title="Select multiple files for batch actions"
          >
            {selectMode ? `${selectedIds.size} selected` : 'Select'}
          </button>
        )}
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden sm:flex items-center gap-1.5 text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-md text-[11px]"
          title="Command palette"
        >
          <Search size={13} /> <kbd className="border border-slate-700 rounded px-1">Ctrl K</kbd>
        </button>
        <button
          onClick={() => setAboutOpen(true)}
          className="p-1.5 text-slate-500 hover:text-slate-300"
          title="About"
        >
          <Info size={16} />
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300 transition-colors"
        >
          <Upload size={14} /> Open file
        </button>
      </div>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <div className="flex-1 flex min-h-0 relative">
        {files.length > 0 && (
          <>
            {sidebarOpen && (
              <div className="fixed inset-0 bg-black/60 z-20 sm:hidden" onClick={() => setSidebarOpen(false)} />
            )}
            <div
              className={`fixed sm:static inset-y-0 left-0 z-30 w-72 sm:w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 sm:bg-slate-900/60 flex flex-col min-h-0 transform transition-transform sm:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`}
            >
              <div className="p-2 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-800/70">
                  <Search size={13} className="text-slate-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter files"
                    className="bg-transparent text-xs outline-none flex-1 text-slate-200 placeholder-slate-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto py-1">
                {activeCategories.map((cat) => (
                  <div key={cat} className="mb-1">
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: CATEGORIES[cat].color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORIES[cat].color }} />
                      {CATEGORIES[cat].label}
                      <span className="text-slate-600 font-normal normal-case">({grouped[cat].length})</span>
                    </div>
                    {grouped[cat].map((f) => (
                      <div
                        key={f.id}
                        onClick={() => selectFile(f.id)}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 ${activeId === f.id && !selectMode ? 'bg-slate-800 border-amber-400' : selectedIds.has(f.id) ? 'bg-slate-800/70 border-amber-400/50' : 'border-transparent hover:bg-slate-800/50'}`}
                      >
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(f.id)}
                            onChange={() => selectFile(f.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-amber-400 flex-shrink-0"
                          />
                        )}
                        {iconFor(f)}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate text-slate-200">
                            {f.name}{f.modified && <span className="text-amber-400"> *</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">{formatSize(f.size)}</div>
                        </div>
                        {f.status === 'loading' && <Loader2 size={12} className="animate-spin text-slate-500" />}
                        {f.status === 'error' && <AlertTriangle size={12} className="text-red-400" />}
                        {!selectMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                            className="opacity-50 hover:opacity-100 text-slate-400 hover:text-red-400"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {selectMode && selectedIds.size > 0 && (
                <div className="border-t border-slate-800 p-2 flex flex-wrap gap-1.5 flex-shrink-0 bg-slate-900/60">
                  <button
                    onClick={downloadSelectedAsZip}
                    disabled={batchBusy}
                    className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Archive size={12} /> Download {selectedIds.size} as .zip
                  </button>
                  {files.some((f) => selectedIds.has(f.id) && f.kind === 'image') && (
                    <>
                      <button onClick={() => batchConvertImages('png')} disabled={batchBusy} className="text-[11px] px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">→ PNG (.zip)</button>
                      <button onClick={() => batchConvertImages('jpeg')} disabled={batchBusy} className="text-[11px] px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">→ JPG (.zip)</button>
                      <button onClick={() => batchConvertImages('webp')} disabled={batchBusy} className="text-[11px] px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">→ WebP (.zip)</button>
                    </>
                  )}
                  {selectedIds.size === 2 && (
                    <button onClick={startCompare} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded bg-amber-400 text-slate-900 font-medium">
                      Compare these two
                    </button>
                  )}
                  {batchBusy && <Loader2 size={13} className="animate-spin text-slate-500" />}
                </div>
              )}

              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 justify-center text-xs text-slate-400 hover:text-amber-300 py-2.5 border-t border-slate-800 flex-shrink-0"
              >
                <FilePlus2 size={13} /> Add more
              </button>
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0 relative">
          {dragging && (
            <div className="absolute inset-0 z-20 bg-slate-950/90 border-4 border-dashed border-amber-400 flex items-center justify-center">
              <div className="text-amber-300 font-medium">Drop to open</div>
            </div>
          )}

          {!active && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 sm:p-8 text-center overflow-auto">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                <Upload size={26} className="text-amber-400" />
              </div>
              <div>
                <div className="text-slate-200 font-medium mb-1">Drop any file here, or click Open file</div>
                <div className="text-xs text-slate-500 max-w-md">
                  Code and text edit in place, common documents and media get a native preview, and anything else
                  still opens as a hex dump so you can see what's inside.
                </div>
              </div>

              {recentFiles.length > 0 && (
                <div className="w-full max-w-sm text-left mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent</span>
                    <button onClick={() => clearRecentFiles().then(refreshRecent)} className="text-[10px] text-slate-600 hover:text-slate-400">Clear</button>
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800">
                    {recentFiles.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-900 cursor-pointer" onClick={() => reopenRecent(entry)}>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate text-slate-300">{entry.name}</div>
                          <div className="text-[10px] text-slate-600">{formatSize(entry.size)}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeRecentFile(entry.id).then(refreshRecent); }}
                          className="opacity-50 hover:opacity-100 text-slate-500 hover:text-red-400 flex-shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1.5">Stored only on this device — never uploaded.</div>
                </div>
              )}
            </div>
          )}

          {active && (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex-shrink-0 overflow-x-auto">
                {iconFor(active)}
                <span className="text-sm text-slate-200 truncate max-w-[35vw] sm:max-w-xs">{active.name}</span>
                <span className="hidden sm:inline text-[10px] text-slate-500 flex-shrink-0">{formatSize(active.size)}</span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: `${CATEGORIES[active.category]?.color || '#666'}22`, color: CATEGORIES[active.category]?.color || '#ccc' }}
                >
                  .{active.ext}
                </span>
                {active.warning && <span className="hidden sm:inline text-[10px] text-amber-400 flex-shrink-0">{active.warning}</span>}
                <div className="flex-1" />

                {EDITABLE_KINDS.includes(active.kind) && (
                  <button
                    onClick={() => setWrap((w) => !w)}
                    title="Toggle wrap"
                    className={`p-1.5 rounded hover:bg-slate-800 flex-shrink-0 ${wrap ? 'text-amber-400' : 'text-slate-400'}`}
                  >
                    <WrapText size={14} />
                  </button>
                )}

                {(EDITABLE_KINDS.includes(active.kind) || ((active.kind === 'markdown' || active.kind === 'csv') && showRaw)) && (
                  <>
                    <button
                      onClick={() => setFontFamily((f) => (f === 'mono' ? 'sans' : f === 'sans' ? 'serif' : 'mono'))}
                      title={`Font: ${fontFamily} (click to cycle Mono / Sans / Serif)`}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0 text-[10px] font-semibold uppercase w-6 text-center"
                    >
                      {fontFamily === 'mono' ? 'M' : fontFamily === 'sans' ? 'S' : 'Se'}
                    </button>
                    <button onClick={() => setFontSize((s) => Math.max(10, s - 1))} title="Smaller text" className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0 text-xs font-medium">A-</button>
                    <span className="text-[10px] text-slate-500 w-5 text-center flex-shrink-0 font-mono">{fontSize}</span>
                    <button onClick={() => setFontSize((s) => Math.min(28, s + 1))} title="Larger text" className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0 text-xs font-medium">A+</button>
                  </>
                )}

                {active.kind === 'json' && (
                  <button onClick={() => formatJson(active)} title="Format JSON" className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0">
                    <Wand2 size={14} />
                  </button>
                )}

                {active.kind === 'image' && !mediaFailed && (
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setConvertOpen((v) => !v)} title="Convert to another format" className="p-1.5 rounded hover:bg-slate-800 text-slate-400">
                      <ImageDown size={14} />
                    </button>
                    {convertOpen && (
                      <div className="absolute right-0 top-full mt-1 z-10 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
                        {['png', 'jpeg', 'webp'].map((format) => (
                          <button
                            key={format}
                            onClick={() => convertImage(active, format)}
                            className="block w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 whitespace-nowrap"
                          >
                            Save as .{format === 'jpeg' ? 'jpg' : format}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(active.kind === 'markdown' || active.kind === 'csv') && (
                  <button
                    onClick={() => setShowRaw((r) => !r)}
                    title="Toggle raw / preview"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex items-center gap-1 text-[10px] flex-shrink-0"
                  >
                    {showRaw ? <Eye size={13} /> : <Code2 size={13} />} {showRaw ? 'Preview' : 'Raw'}
                  </button>
                )}

                {['image', 'audio', 'video'].includes(active.kind) && !mediaFailed && (
                  <button
                    onClick={() => setEditing((v) => !v)}
                    title={editing ? 'Back to preview' : 'Edit'}
                    className={`p-1.5 rounded hover:bg-slate-800 flex-shrink-0 ${editing ? 'text-amber-400' : 'text-slate-400'}`}
                  >
                    <Pencil size={14} />
                  </button>
                )}

                {(EDITABLE_KINDS.includes(active.kind) || ((active.kind === 'markdown' || active.kind === 'csv') && showRaw)) && (
                  <button
                    onClick={() => setEditing((v) => !v)}
                    title={editing ? 'Stop editing' : 'Edit'}
                    className={`p-1.5 rounded hover:bg-slate-800 flex-shrink-0 ${editing ? 'text-amber-400' : 'text-slate-400'}`}
                  >
                    <Pencil size={14} />
                  </button>
                )}

                {active.text !== undefined && (
                  <button onClick={() => copyToClipboard(active.text, active.id)} title="Copy" className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0">
                    {copiedId === active.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                )}

                <button onClick={() => downloadFile(active)} title="Download" className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0">
                  {active.modified ? <Save size={14} /> : <Download size={14} />}
                </button>
              </div>

              {active.status === 'ready' && metaLine(active) && (
                <div className="px-2.5 sm:px-4 py-1 text-[10px] text-slate-500 border-b border-slate-800/60 bg-slate-900/20 flex-shrink-0">
                  {active.detectedNote && (
                    <span className="text-amber-400">
                      Named {active.detectedNote.namedAs}, but content looks like a {active.detectedNote.label}.{' '}
                    </span>
                  )}
                  {metaLine(active)}
                </div>
              )}

              <div className="flex-1 overflow-auto min-h-0">
                {active.status === 'loading' && (
                  <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm">
                    <Loader2 size={16} className="animate-spin" /> Reading file
                  </div>
                )}

                {active.status === 'error' && (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-8">
                    <AlertTriangle size={22} className="text-red-400" />
                    <div className="text-sm text-slate-300">Couldn&apos;t open this file</div>
                    <div className="text-xs text-slate-500">{active.error}</div>
                  </div>
                )}

                {active.status === 'ready' && active.kind === 'nopreview' && (
                  <NoPreviewCard note={noPreviewNote(active.category)} ext={active.ext} />
                )}

                {active.status === 'ready' && active.kind === 'image' && !mediaFailed && editing && (
                  <ImageEditor url={active.url} name={active.name} />
                )}
                {active.status === 'ready' && active.kind === 'image' && !mediaFailed && !editing && (
                  <div className="h-full flex items-center justify-center p-6 checker">
                    <img
                      src={active.url}
                      alt={active.name}
                      className="max-w-full max-h-full object-contain rounded shadow-2xl"
                      onError={() => setMediaFailed(true)}
                      onLoad={(e) => updateFile(active.id, { meta: { width: e.target.naturalWidth, height: e.target.naturalHeight } })}
                    />
                  </div>
                )}
                {active.status === 'ready' && active.kind === 'image' && mediaFailed && (
                  <NoPreviewCard note="This browser could not decode this image format." ext={active.ext} />
                )}

                {active.status === 'ready' && active.kind === 'pdf' && (
                  <PdfViewer url={active.url} name={active.name} />
                )}

                {active.status === 'ready' && active.kind === 'audio' && !mediaFailed && editing && (
                  <AudioEditor url={active.url} name={active.name} />
                )}
                {active.status === 'ready' && active.kind === 'audio' && !mediaFailed && !editing && (
                  <div className="h-full flex items-center justify-center p-6">
                    <audio
                      controls
                      src={active.url}
                      className="w-full max-w-md"
                      onError={() => setMediaFailed(true)}
                      onLoadedMetadata={(e) => updateFile(active.id, { meta: { duration: e.target.duration } })}
                    />
                  </div>
                )}
                {active.status === 'ready' && active.kind === 'audio' && mediaFailed && (
                  <NoPreviewCard note="This browser could not play this audio format." ext={active.ext} />
                )}

                {active.status === 'ready' && active.kind === 'video' && !mediaFailed && editing && (
                  <VideoEditor url={active.url} name={active.name} />
                )}
                {active.status === 'ready' && active.kind === 'video' && !mediaFailed && !editing && (
                  <div className="h-full flex items-center justify-center p-6">
                    <video
                      controls
                      src={active.url}
                      className="max-w-full max-h-full rounded shadow-2xl"
                      onError={() => setMediaFailed(true)}
                      onLoadedMetadata={(e) => updateFile(active.id, { meta: { duration: e.target.duration, width: e.target.videoWidth, height: e.target.videoHeight } })}
                    />
                  </div>
                )}
                {active.status === 'ready' && active.kind === 'video' && mediaFailed && (
                  <NoPreviewCard note="This browser could not play this video format or codec." ext={active.ext} />
                )}

                {active.status === 'ready' && active.kind === 'font' && (
                  <FontPreview buffer={active.buffer} name={active.name} id={active.id} />
                )}

                {active.status === 'ready' && active.kind === 'archive' && (
                  <ArchiveBrowser entries={active.entries} title={active.archiveTitle} />
                )}

                {active.status === 'ready' && active.kind === 'email' && (
                  <EmailView headers={active.emailHeaders} body={active.emailBody} />
                )}

                {active.status === 'ready' && active.kind === 'docx' && (
                  <div className="p-3 sm:p-6">
                    <div className="bg-white text-slate-900 rounded-lg shadow-2xl mx-auto max-w-3xl p-6 sm:p-10 mammoth-body" dangerouslySetInnerHTML={{ __html: active.html }} />
                  </div>
                )}

                {active.status === 'ready' && (active.kind === 'sheet' || (active.kind === 'csv' && !showRaw)) && (
                  <div className="p-3 sm:p-4">
                    {active.sheetNames?.length > 1 && (
                      <div className="flex gap-1 mb-2 overflow-x-auto">
                        {active.sheetNames.map((name) => (
                          <button
                            key={name}
                            onClick={() => updateFile(active.id, { activeSheet: name })}
                            className={`px-3 py-1 rounded text-xs font-medium flex-shrink-0 ${name === active.activeSheet ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="bg-white text-slate-900 rounded-lg shadow-2xl overflow-auto max-h-full">
                      {(() => {
                        const rows = active.sheets?.[active.activeSheet] || [];
                        return (
                          <table className="min-w-full text-xs border-collapse">
                            <thead className="bg-slate-100 sticky top-0">
                              <tr>{(rows[0] || []).map((cell, ci) => (<th key={ci} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">{String(cell ?? '')}</th>))}</tr>
                            </thead>
                            <tbody>
                              {rows.slice(1, 1000).map((row, ri) => (
                                <tr key={ri} className={ri % 2 ? 'bg-slate-50' : 'bg-white'}>
                                  {row.map((cell, ci) => (<td key={ci} className="border border-slate-100 px-3 py-1.5 whitespace-nowrap">{String(cell ?? '')}</td>))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                    {(active.sheets?.[active.activeSheet]?.length || 0) > 1000 && (
                      <div className="text-[11px] text-slate-500 pt-1">Showing first 1000 rows</div>
                    )}
                  </div>
                )}

                {active.status === 'ready' && active.kind === 'csv' && showRaw && (
                  <CodeEditor
                    value={active.text}
                    lang="text"
                    readOnly={!editing}
                    wrap={wrap}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    onChange={(val) => updateFile(active.id, { text: val, modified: val !== active.text ? true : active.modified })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'json' && (
                  <CodeEditor
                    value={active.text}
                    lang="json"
                    readOnly={!editing}
                    wrap={wrap}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    onChange={(val) => updateFile(active.id, { text: val, modified: true })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'markdown' && !showRaw && (
                  <div className="p-3 sm:p-6">
                    <div className="bg-white text-slate-900 rounded-lg shadow-2xl mx-auto max-w-3xl p-6 sm:p-10 md-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(active.text)) }} />
                  </div>
                )}

                {active.status === 'ready' && active.kind === 'markdown' && showRaw && (
                  <CodeEditor
                    value={active.text}
                    lang="markdown"
                    readOnly={!editing}
                    wrap={wrap}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    onChange={(val) => updateFile(active.id, { text: val, modified: true })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'code' && (
                  <CodeEditor
                    value={active.text}
                    lang={active.lang}
                    readOnly={!editing}
                    wrap={wrap}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    onChange={(val) => updateFile(active.id, { text: val, modified: true })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'binary' && (
                  <div className="p-4">
                    <div className="text-xs text-slate-500 mb-2">No native preview for this format, showing the first 512 bytes as a hex dump.</div>
                    <div className="font-mono text-[11px] bg-slate-900 rounded-lg p-4 overflow-auto border border-slate-800">
                      {active.hex.map((row, i) => (
                        <div key={i} className="flex gap-4 whitespace-pre">
                          <span className="text-slate-600">{row.offset}</span>
                          <span className="text-cyan-300">{row.hex.padEnd(47, ' ')}</span>
                          <span className="text-slate-400">{row.ascii}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        files={files}
        onSelectFile={(id) => { setActiveId(id); setSelectMode(false); }}
        actions={commandActions}
      />

      {compareIds && (() => {
        const fileA = files.find((f) => f.id === compareIds[0]);
        const fileB = files.find((f) => f.id === compareIds[1]);
        if (!fileA || !fileB) return null;
        return <CompareView fileA={fileA} fileB={fileB} onClose={() => setCompareIds(null)} />;
      })()}
    </div>
  );
}
