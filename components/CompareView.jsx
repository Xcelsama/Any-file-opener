'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, AlertTriangle } from 'lucide-react';
import { diffLines, diffStats, MAX_DIFF_LINES } from '../lib/diff';

const TEXT_KINDS = ['code', 'json', 'markdown', 'csv'];

export default function CompareView({ fileA, fileB, onClose }) {
  const bothText = TEXT_KINDS.includes(fileA.kind) && TEXT_KINDS.includes(fileB.kind);
  const bothImage = fileA.kind === 'image' && fileB.kind === 'image';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <span className="text-sm text-slate-200 font-medium">Compare</span>
        <span className="text-xs text-slate-500 truncate">{fileA.name} ↔ {fileB.name}</span>
        <div className="flex-1" />
        <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400">
          <X size={16} />
        </button>
      </div>

      {bothText && <TextCompare fileA={fileA} fileB={fileB} />}
      {bothImage && <ImageCompare fileA={fileA} fileB={fileB} />}
      {!bothText && !bothImage && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
          <AlertTriangle size={22} className="text-amber-400" />
          <div className="text-sm text-slate-300">Can&apos;t compare these two file types yet</div>
          <div className="text-xs text-slate-500 max-w-sm">
            Compare mode currently supports text/code files against each other, or two images against each other.
            Spreadsheet and PDF comparison aren&apos;t built yet.
          </div>
        </div>
      )}
    </div>
  );
}

function TextCompare({ fileA, fileB }) {
  const [rows, setRows] = useState(null);
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    const a = fileA.text || '';
    const b = fileB.text || '';
    if (a.split('\n').length > MAX_DIFF_LINES || b.split('\n').length > MAX_DIFF_LINES) {
      setTooLarge(true);
      return;
    }
    setRows(diffLines(a, b));
  }, [fileA, fileB]);

  if (tooLarge) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-8 text-center">
        One of these files has more than {MAX_DIFF_LINES.toLocaleString()} lines — too large to diff safely in the browser.
      </div>
    );
  }
  if (!rows) return <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Comparing…</div>;

  const { added, removed } = diffStats(rows);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-4 px-4 py-1.5 text-[11px] border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
        <span className="flex items-center gap-1 text-emerald-400"><Plus size={12} /> {added} added</span>
        <span className="flex items-center gap-1 text-red-400"><Minus size={12} /> {removed} removed</span>
      </div>
      <div className="flex-1 overflow-auto font-mono text-xs">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`px-4 py-0.5 whitespace-pre-wrap break-all ${
              row.type === 'add' ? 'bg-emerald-500/10 text-emerald-300' :
              row.type === 'remove' ? 'bg-red-500/10 text-red-300' :
              'text-slate-400'
            }`}
          >
            <span className="inline-block w-4 select-none opacity-60">{row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' '}</span>
            {row.line || ' '}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageCompare({ fileA, fileB }) {
  const [mode, setMode] = useState('sideBySide'); // sideBySide | overlay | slider
  const [sliderPos, setSliderPos] = useState(50);
  const canvasRef = useRef(null);
  const [diffPct, setDiffPct] = useState(null);

  useEffect(() => {
    if (mode !== 'overlay') return;
    let cancelled = false;
    (async () => {
      const [imgA, imgB] = await Promise.all([loadImg(fileA.url), loadImg(fileB.url)]);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const w = Math.max(imgA.width, imgB.width);
      const h = Math.max(imgA.height, imgB.height);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      const tmpA = document.createElement('canvas'); tmpA.width = w; tmpA.height = h;
      const tmpB = document.createElement('canvas'); tmpB.width = w; tmpB.height = h;
      tmpA.getContext('2d').drawImage(imgA, 0, 0);
      tmpB.getContext('2d').drawImage(imgB, 0, 0);
      const dataA = tmpA.getContext('2d').getImageData(0, 0, w, h);
      const dataB = tmpB.getContext('2d').getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);

      let diffPixels = 0;
      for (let p = 0; p < dataA.data.length; p += 4) {
        const dr = Math.abs(dataA.data[p] - dataB.data[p]);
        const dg = Math.abs(dataA.data[p + 1] - dataB.data[p + 1]);
        const db = Math.abs(dataA.data[p + 2] - dataB.data[p + 2]);
        const changed = dr + dg + db > 30;
        if (changed) diffPixels++;
        out.data[p] = changed ? 255 : dataA.data[p] * 0.3;
        out.data[p + 1] = changed ? 0 : dataA.data[p + 1] * 0.3;
        out.data[p + 2] = changed ? 0 : dataA.data[p + 2] * 0.3;
        out.data[p + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      setDiffPct(((diffPixels / (w * h)) * 100).toFixed(1));
    })();
    return () => { cancelled = true; };
  }, [mode, fileA, fileB]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
        {['sideBySide', 'slider', 'overlay'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs px-2.5 py-1 rounded ${mode === m ? 'bg-amber-400 text-slate-900 font-medium' : 'bg-slate-800 text-slate-400'}`}
          >
            {m === 'sideBySide' ? 'Side by side' : m === 'slider' ? 'Slider' : 'Difference overlay'}
          </button>
        ))}
        {mode === 'overlay' && diffPct !== null && (
          <span className="text-xs text-amber-400 ml-2">{diffPct}% of pixels differ</span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {mode === 'sideBySide' && (
          <div className="h-full grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-500 truncate w-full text-center">{fileA.name}</span>
              <img src={fileA.url} alt={fileA.name} className="max-w-full max-h-full object-contain rounded shadow-xl" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-500 truncate w-full text-center">{fileB.name}</span>
              <img src={fileB.url} alt={fileB.name} className="max-w-full max-h-full object-contain rounded shadow-xl" />
            </div>
          </div>
        )}

        {mode === 'slider' && (
          <div className="h-full flex flex-col items-center gap-3">
            <div className="relative max-w-full max-h-[75%] overflow-hidden rounded shadow-xl" style={{ aspectRatio: 'auto' }}>
              <img src={fileA.url} alt={fileA.name} className="block max-h-[70vh]" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
                <img src={fileB.url} alt={fileB.name} className="block max-h-[70vh] w-auto" style={{ width: `${10000 / sliderPos}%`, maxWidth: 'none' }} />
              </div>
              <div className="absolute top-0 bottom-0 bg-amber-400 w-0.5" style={{ left: `${sliderPos}%` }} />
            </div>
            <input type="range" min="0" max="100" value={sliderPos} onChange={(e) => setSliderPos(+e.target.value)} className="w-64 accent-amber-400" />
            <div className="text-[11px] text-slate-500">← {fileB.name} shown left of the line, {fileA.name} right →</div>
          </div>
        )}

        {mode === 'overlay' && (
          <div className="h-full flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-full max-h-full rounded shadow-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
