'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, FlipHorizontal, FlipVertical, Crop, Pencil, Download, Undo2, SlidersHorizontal } from 'lucide-react';

export default function ImageEditor({ url, name }) {
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [tool, setTool] = useState('none'); // none | crop | draw
  const [cropRect, setCropRect] = useState(null); // {x,y,w,h} in displayed px
  const [dragStart, setDragStart] = useState(null);
  const [paths, setPaths] = useState([]); // array of arrays of {x,y}
  const [currentPath, setCurrentPath] = useState(null);
  const [format, setFormat] = useState('png');

  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const imgElRef = useRef(null); // actual loaded HTMLImageElement, kept for export

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgElRef.current = img; };
    img.src = url;
  }, [url]);

  // Keep the overlay draw canvas sized to match the displayed image exactly
  const syncCanvasSize = useCallback(() => {
    const imgEl = imgRef.current;
    const canvas = drawCanvasRef.current;
    if (!imgEl || !canvas) return;
    canvas.width = imgEl.clientWidth;
    canvas.height = imgEl.clientHeight;
    redrawPaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  function redrawPaths() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    [...paths, currentPath].filter(Boolean).forEach((path) => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      path.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  }
  useEffect(redrawPaths, [paths, currentPath]);

  const filterCss = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  const transformCss = `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

  const pointerPos = (e) => {
    const rect = drawCanvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    const pos = pointerPos(e);
    if (tool === 'crop') {
      setDragStart(pos);
      setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
    } else if (tool === 'draw') {
      setCurrentPath([pos]);
    }
  };
  const onPointerMove = (e) => {
    if (tool === 'crop' && dragStart) {
      const pos = pointerPos(e);
      setCropRect({
        x: Math.min(dragStart.x, pos.x),
        y: Math.min(dragStart.y, pos.y),
        w: Math.abs(pos.x - dragStart.x),
        h: Math.abs(pos.y - dragStart.y),
      });
    } else if (tool === 'draw' && currentPath) {
      setCurrentPath((p) => [...p, pointerPos(e)]);
    }
  };
  const onPointerUp = () => {
    if (tool === 'draw' && currentPath) {
      setPaths((p) => [...p, currentPath]);
      setCurrentPath(null);
    }
    setDragStart(null);
  };

  const resetAll = () => {
    setRotation(0); setFlipH(false); setFlipV(false);
    setBrightness(100); setContrast(100); setSaturation(100);
    setCropRect(null); setPaths([]); setTool('none');
  };

  const exportImage = () => {
    const imgEl = imgElRef.current;
    const displayEl = imgRef.current;
    if (!imgEl || !displayEl) return;

    const rot = ((rotation % 360) + 360) % 360;
    const swapDims = rot === 90 || rot === 270;
    const naturalW = imgEl.naturalWidth;
    const naturalH = imgEl.naturalHeight;
    const outW = swapDims ? naturalH : naturalW;
    const outH = swapDims ? naturalW : naturalH;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.filter = filterCss;
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(imgEl, -naturalW / 2, -naturalH / 2, naturalW, naturalH);
    ctx.restore();

    // Bake freehand drawing on top, scaled from displayed size to natural size
    if (paths.length) {
      const scaleX = outW / displayEl.clientWidth;
      const scaleY = outH / displayEl.clientHeight;
      ctx.filter = 'none';
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 3 * Math.max(scaleX, scaleY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      paths.forEach((path) => {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x * scaleX, path[0].y * scaleY);
        path.slice(1).forEach((p) => ctx.lineTo(p.x * scaleX, p.y * scaleY));
        ctx.stroke();
      });
    }

    let finalCanvas = canvas;
    if (cropRect && cropRect.w > 4 && cropRect.h > 4) {
      const scaleX = outW / displayEl.clientWidth;
      const scaleY = outH / displayEl.clientHeight;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropRect.w * scaleX;
      cropCanvas.height = cropRect.h * scaleY;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(
        canvas,
        cropRect.x * scaleX, cropRect.y * scaleY, cropRect.w * scaleX, cropRect.h * scaleY,
        0, 0, cropCanvas.width, cropCanvas.height
      );
      finalCanvas = cropCanvas;
    }

    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    finalCanvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      const base = (name || 'image').replace(/\.[^.]+$/, '');
      a.download = `${base}-edited.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    }, mime, 0.92);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-800 bg-slate-900/40 flex-shrink-0">
        <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Rotate 90°"><RotateCw size={15} /></button>
        <button onClick={() => setFlipH((v) => !v)} className={`p-1.5 rounded hover:bg-slate-800 ${flipH ? 'text-amber-400' : 'text-slate-400'}`} title="Flip horizontal"><FlipHorizontal size={15} /></button>
        <button onClick={() => setFlipV((v) => !v)} className={`p-1.5 rounded hover:bg-slate-800 ${flipV ? 'text-amber-400' : 'text-slate-400'}`} title="Flip vertical"><FlipVertical size={15} /></button>
        <span className="w-px h-4 bg-slate-800 mx-1" />
        <button onClick={() => setTool((t) => (t === 'crop' ? 'none' : 'crop'))} className={`p-1.5 rounded hover:bg-slate-800 ${tool === 'crop' ? 'text-amber-400 bg-slate-800' : 'text-slate-400'}`} title="Crop"><Crop size={15} /></button>
        <button onClick={() => setTool((t) => (t === 'draw' ? 'none' : 'draw'))} className={`p-1.5 rounded hover:bg-slate-800 ${tool === 'draw' ? 'text-amber-400 bg-slate-800' : 'text-slate-400'}`} title="Draw"><Pencil size={15} /></button>
        <span className="w-px h-4 bg-slate-800 mx-1" />
        <SlidersHorizontal size={13} className="text-slate-500" />
        <input type="range" min="40" max="160" value={brightness} onChange={(e) => setBrightness(+e.target.value)} className="w-16 accent-amber-400" title="Brightness" />
        <input type="range" min="40" max="160" value={contrast} onChange={(e) => setContrast(+e.target.value)} className="w-16 accent-amber-400" title="Contrast" />
        <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(+e.target.value)} className="w-16 accent-amber-400" title="Saturation" />
        <button onClick={resetAll} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Reset all"><Undo2 size={14} /></button>
        <div className="flex-1" />
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="bg-slate-800 text-slate-200 text-[11px] rounded px-1.5 py-1 outline-none">
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
        <button onClick={exportImage} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300">
          <Download size={13} /> Save edited copy
        </button>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-6 checker">
        <div ref={wrapRef} className="relative inline-block">
          <img
            ref={imgRef}
            src={url}
            alt={name}
            onLoad={syncCanvasSize}
            style={{ transform: transformCss, filter: filterCss, maxHeight: '65vh', maxWidth: '80vw', display: 'block' }}
            className="rounded shadow-2xl select-none"
            draggable={false}
          />
          <canvas
            ref={drawCanvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute inset-0"
            style={{ cursor: tool === 'none' ? 'default' : 'crosshair', touchAction: 'none' }}
          />
          {cropRect && tool === 'crop' && (
            <div
              className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none"
              style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
