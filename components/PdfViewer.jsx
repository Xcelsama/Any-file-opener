'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Trash2, Type, Download, Loader2, AlertTriangle,
} from 'lucide-react';

// Rendered with pdf.js (canvas-based) rather than a native <iframe> PDF viewer.
// Desktop Chrome has a built-in PDF renderer (PDFium) so an <iframe src="blob:...">
// works there, but Android's WebView has no built-in PDF viewer at all — it just
// shows a blank frame. Drawing to a <canvas> works identically everywhere: web,
// installed desktop PWA, and the Android app's WebView.
const PDFJS_VERSION = '3.11.174';
const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export default function PdfViewer({ url, name }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [textDraft, setTextDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef(null);
  const pdfjsRef = useRef(null); // pdfjs-dist module
  const pdfDocRef = useRef(null); // pdfjs document (for rendering)
  const pdfLibRef = useRef(null); // pdf-lib module
  const workingBytesRef = useRef(null); // current edited bytes (Uint8Array)
  const rotationsRef = useRef({}); // { [pageIndex]: extraDegrees }

  const loadFromBytes = useCallback(async (bytes) => {
    const pdfjsLib = pdfjsRef.current;
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
    const doc = await loadingTask.promise;
    pdfDocRef.current = doc;
    setNumPages(doc.numPages);
    setPageNum((p) => Math.min(p, doc.numPages) || 1);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        pdfjsRef.current = pdfjsLib;

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        workingBytesRef.current = bytes;
        rotationsRef.current = {};

        await loadFromBytes(bytes);
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not open this PDF.');
          setStatus('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url, loadFromBytes]);

  // Render current page whenever it, the scale, or a rotation changes
  useEffect(() => {
    if (status !== 'ready' || !pdfDocRef.current) return;
    let cancelled = false;

    (async () => {
      const page = await pdfDocRef.current.getPage(pageNum);
      if (cancelled) return;
      const extraRotation = rotationsRef.current[pageNum - 1] || 0;
      const viewport = page.getViewport({ scale, rotation: extraRotation });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    })();

    return () => { cancelled = true; };
  }, [status, pageNum, scale]);

  const goPrev = () => setPageNum((p) => Math.max(1, p - 1));
  const goNext = () => setPageNum((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(3, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.4, s - 0.2));

  const rotatePage = () => {
    const idx = pageNum - 1;
    rotationsRef.current[idx] = ((rotationsRef.current[idx] || 0) + 90) % 360;
    setDirty(true);
    // force a re-render of the current page
    setScale((s) => s);
  };

  const deletePage = async () => {
    if (numPages <= 1) return;
    const pdfLib = pdfLibRef.current || (pdfLibRef.current = await import('pdf-lib'));
    const doc = await pdfLib.PDFDocument.load(workingBytesRef.current);
    doc.removePage(pageNum - 1);
    const newBytes = await doc.save();
    workingBytesRef.current = newBytes;
    // Rotation map indices shift after a delete — simplest correct fix is to
    // drop tracked rotations past this point rather than risk misaligning them.
    rotationsRef.current = {};
    setDirty(true);
    await loadFromBytes(newBytes);
  };

  const startPlacingText = () => {
    setEditing(true);
    setPlacing(true);
  };

  const handleCanvasClick = (e) => {
    if (!placing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPendingPoint({ x, y, canvasWidth: rect.width, canvasHeight: rect.height });
  };

  const commitText = async () => {
    if (!pendingPoint || !textDraft.trim()) {
      setPendingPoint(null);
      setTextDraft('');
      setPlacing(false);
      return;
    }
    const pdfLib = pdfLibRef.current || (pdfLibRef.current = await import('pdf-lib'));
    const doc = await pdfLib.PDFDocument.load(workingBytesRef.current);
    const page = doc.getPage(pageNum - 1);
    const { width, height } = page.getSize();
    const font = await doc.embedFont(pdfLib.StandardFonts.Helvetica);

    // Convert the click position (in on-screen canvas pixels) into PDF point
    // space, accounting for the page's actual size vs. the rendered canvas size.
    const pdfX = (pendingPoint.x / pendingPoint.canvasWidth) * width;
    const pdfY = height - (pendingPoint.y / pendingPoint.canvasHeight) * height;

    page.drawText(textDraft, {
      x: pdfX,
      y: pdfY,
      size: 14,
      font,
      color: pdfLib.rgb(0.85, 0.1, 0.1),
    });

    const newBytes = await doc.save();
    workingBytesRef.current = newBytes;
    setDirty(true);
    setPendingPoint(null);
    setTextDraft('');
    setPlacing(false);
    await loadFromBytes(newBytes);
  };

  const cancelText = () => {
    setPendingPoint(null);
    setTextDraft('');
    setPlacing(false);
  };

  const downloadEdited = () => {
    const bytes = workingBytesRef.current;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name?.replace(/\.pdf$/i, '') + '-edited.pdf' || 'edited.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  if (status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin" /> Rendering PDF…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-8">
        <AlertTriangle size={22} className="text-red-400" />
        <div className="text-sm text-slate-300">Couldn&apos;t open this PDF</div>
        <div className="text-xs text-slate-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-800 bg-slate-900/40 flex-shrink-0">
        <button onClick={goPrev} disabled={pageNum <= 1} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs text-slate-400 font-mono min-w-[4.5rem] text-center">{pageNum} / {numPages}</span>
        <button onClick={goNext} disabled={pageNum >= numPages} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30">
          <ChevronRight size={15} />
        </button>
        <span className="w-px h-4 bg-slate-800 mx-1" />
        <button onClick={zoomOut} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Zoom out"><ZoomOut size={15} /></button>
        <span className="text-xs text-slate-500 font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Zoom in"><ZoomIn size={15} /></button>
        <span className="w-px h-4 bg-slate-800 mx-1" />
        <button onClick={rotatePage} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Rotate this page"><RotateCw size={15} /></button>
        <button onClick={deletePage} disabled={numPages <= 1} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30" title="Delete this page"><Trash2 size={15} /></button>
        <button
          onClick={startPlacingText}
          className={`p-1.5 rounded hover:bg-slate-800 flex items-center gap-1 text-[10px] ${placing ? 'text-amber-400 bg-slate-800' : 'text-slate-400'}`}
          title="Add text — click on the page to place it"
        >
          <Type size={15} /> {placing ? 'Click page…' : 'Add text'}
        </button>
        <div className="flex-1" />
        {dirty && (
          <button onClick={downloadEdited} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300">
            <Download size={13} /> Save edited copy
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center p-4 checker relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`shadow-2xl bg-white ${placing ? 'cursor-crosshair' : ''}`}
        />

        {pendingPoint && (
          <div
            className="absolute bg-slate-900 border border-amber-400 rounded-md p-2 shadow-2xl flex items-center gap-1.5 z-10"
            style={{ left: Math.min(pendingPoint.x + 16, 260), top: pendingPoint.y + 16 }}
          >
            <input
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') cancelText(); }}
              placeholder="Type text…"
              className="bg-slate-800 text-xs text-slate-100 rounded px-2 py-1 outline-none w-36"
            />
            <button onClick={commitText} className="text-[10px] px-2 py-1 rounded bg-amber-400 text-slate-900 font-medium">Add</button>
            <button onClick={cancelText} className="text-[10px] px-1.5 py-1 rounded text-slate-400">✕</button>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 text-[10px] text-slate-600 border-t border-slate-800 flex-shrink-0">
        Page-level editing only (rotate, delete, add text) — this can&apos;t reflow or edit the PDF&apos;s original
        text, since PDFs don&apos;t store text the way a Word document does.
      </div>
    </div>
  );
}
