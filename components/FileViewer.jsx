'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import mammoth from 'mammoth';
import {
  Upload, X, Copy, Download, Search, WrapText, FileCode2, FileImage,
  FileJson2, FileSpreadsheet, FileText, FileType2, Music, Video, Binary,
  Check, AlertTriangle, Loader2, FilePlus2, Eye, Code2, Pencil, Save, Wand2,
  Type, Archive, Mail, File, Menu,
} from 'lucide-react';
import {
  CATEGORIES, classify, formatSize, buildHexDump, looksLikeText, genId, noPreviewNote,
} from '../lib/fileTypes';
import { renderMarkdown } from '../lib/markdown';
import { readArchive } from '../lib/archive';
import { parseEml } from '../lib/eml';
import CodeEditor from './CodeEditor';
import FontPreview from './FontPreview';
import ArchiveBrowser from './ArchiveBrowser';
import EmailView from './EmailView';
import NoPreviewCard from './NoPreviewCard';

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
  const [showRaw, setShowRaw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const inputRef = useRef(null);
  const filesRef = useRef(files);
  const dragCounter = useRef(0);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => { filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)); }, []);
  useEffect(() => { setEditing(false); setShowRaw(false); setMediaFailed(false); }, [activeId]);

  const updateFile = useCallback((id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const processFile = useCallback(async (file, id, info) => {
    const { kind, ext } = info;
    try {
      if (['image', 'pdf', 'audio', 'video', 'nopreview'].includes(kind)) {
        updateFile(id, { status: 'ready' });
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
        const result = await mammoth.convertToHtml({ arrayBuffer });
        updateFile(id, { html: result.value, status: 'ready' });
        return;
      }

      if (kind === 'sheet') {
        const arrayBuffer = await file.arrayBuffer();
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
        category: info.category, lang: info.lang, status: 'loading', url: URL.createObjectURL(file), modified: false,
      };
    });
    setFiles((prev) => [...prev, ...records]);
    setActiveId((prev) => prev ?? records[0].id);
    records.forEach((rec, idx) => processFile(arr[idx], rec.id, rec));
  }, [processFile]);

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
    setActiveId(id);
    setSidebarOpen(false);
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
    const isTextKind = ['code', 'json', 'markdown', 'csv'].includes(file.kind);
    const href = isTextKind ? URL.createObjectURL(new Blob([file.text ?? ''], { type: 'text/plain' })) : file.url;
    const a = document.createElement('a');
    a.href = href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (isTextKind) URL.revokeObjectURL(href);
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
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300 transition-colors"
        >
          <Upload size={14} /> Open file
        </button>
      </div>

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
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 ${activeId === f.id ? 'bg-slate-800 border-amber-400' : 'border-transparent hover:bg-slate-800/50'}`}
                      >
                        {iconFor(f)}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate text-slate-200">
                            {f.name}{f.modified && <span className="text-amber-400"> *</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">{formatSize(f.size)}</div>
                        </div>
                        {f.status === 'loading' && <Loader2 size={12} className="animate-spin text-slate-500" />}
                        {f.status === 'error' && <AlertTriangle size={12} className="text-red-400" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                          className="opacity-50 hover:opacity-100 text-slate-400 hover:text-red-400"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
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
                  Over 300 file types across code, documents, spreadsheets, images, audio, video, archives, fonts and more.
                  Code and text edit in place, common documents get a native preview, and anything unrecognized still
                  opens as a hex dump.
                </div>
              </div>
              <div className="flex flex-col gap-2 max-w-lg w-full">
                {[
                  ['code', ['.js', '.py', '.java', '.go', '.rs', '.sql', '.sh']],
                  ['markup', ['.html', '.css', '.json', '.yaml', '.xml']],
                  ['docs', ['.md', '.pdf', '.docx', '.txt']],
                  ['spreadsheet', ['.xlsx', '.csv', '.ods']],
                  ['image', ['.png', '.jpg', '.svg', '.webp']],
                  ['audio', ['.mp3', '.wav', '.flac']],
                  ['video', ['.mp4', '.mov', '.webm']],
                  ['archive', ['.zip', '.jar']],
                  ['font', ['.ttf', '.woff2']],
                ].map(([cat, exts]) => (
                  <div key={cat} className="flex items-center gap-2 flex-wrap justify-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wide w-24 text-right flex-shrink-0" style={{ color: CATEGORIES[cat].color }}>
                      {CATEGORIES[cat].label}
                    </span>
                    {exts.map((ext) => (
                      <span key={ext} className="text-[10px] font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-500">{ext}</span>
                    ))}
                  </div>
                ))}
              </div>
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

                {active.kind === 'json' && (
                  <button onClick={() => formatJson(active)} title="Format JSON" className="p-1.5 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0">
                    <Wand2 size={14} />
                  </button>
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

                {active.status === 'ready' && active.kind === 'image' && !mediaFailed && (
                  <div className="h-full flex items-center justify-center p-6 checker">
                    <img
                      src={active.url}
                      alt={active.name}
                      className="max-w-full max-h-full object-contain rounded shadow-2xl"
                      onError={() => setMediaFailed(true)}
                    />
                  </div>
                )}
                {active.status === 'ready' && active.kind === 'image' && mediaFailed && (
                  <NoPreviewCard note="This browser could not decode this image format." ext={active.ext} />
                )}

                {active.status === 'ready' && active.kind === 'pdf' && (
                  <iframe src={active.url} title={active.name} className="w-full h-full bg-white border-0" />
                )}

                {active.status === 'ready' && active.kind === 'audio' && !mediaFailed && (
                  <div className="h-full flex items-center justify-center p-6">
                    <audio controls src={active.url} className="w-full max-w-md" onError={() => setMediaFailed(true)} />
                  </div>
                )}
                {active.status === 'ready' && active.kind === 'audio' && mediaFailed && (
                  <NoPreviewCard note="This browser could not play this audio format." ext={active.ext} />
                )}

                {active.status === 'ready' && active.kind === 'video' && !mediaFailed && (
                  <div className="h-full flex items-center justify-center p-6">
                    <video controls src={active.url} className="max-w-full max-h-full rounded shadow-2xl" onError={() => setMediaFailed(true)} />
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
                    onChange={(val) => updateFile(active.id, { text: val, modified: val !== active.text ? true : active.modified })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'json' && (
                  <CodeEditor
                    value={active.text}
                    lang="json"
                    readOnly={!editing}
                    wrap={wrap}
                    onChange={(val) => updateFile(active.id, { text: val, modified: true })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'markdown' && !showRaw && (
                  <div className="p-3 sm:p-6">
                    <div className="bg-white text-slate-900 rounded-lg shadow-2xl mx-auto max-w-3xl p-6 sm:p-10 md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(active.text) }} />
                  </div>
                )}

                {active.status === 'ready' && active.kind === 'markdown' && showRaw && (
                  <CodeEditor
                    value={active.text}
                    lang="markdown"
                    readOnly={!editing}
                    wrap={wrap}
                    onChange={(val) => updateFile(active.id, { text: val, modified: true })}
                  />
                )}

                {active.status === 'ready' && active.kind === 'code' && (
                  <CodeEditor
                    value={active.text}
                    lang={active.lang}
                    readOnly={!editing}
                    wrap={wrap}
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
    </div>
  );
}
