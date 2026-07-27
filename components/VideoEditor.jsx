'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Download, Loader2, AlertTriangle } from 'lucide-react';

export default function VideoEditor({ url, name }) {
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { setDuration(v.duration); setTrimEnd(v.duration); };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [url]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.pause();
    else { if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart; v.play(); }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimStart; }
  };

  const exportTrimmed = async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    setError('');
    setExporting(true);
    setProgress(0);

    try {
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');

      const canvasStream = canvas.captureStream(30);
      let combinedStream = canvasStream;
      // Pull the audio track out of the source video and merge it in, so the
      // exported clip keeps sound rather than being silent.
      if (typeof v.captureStream === 'function') {
        const sourceStream = v.captureStream();
        const audioTracks = sourceStream.getAudioTracks();
        if (audioTracks.length) {
          combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      const done = new Promise((resolve) => { recorder.onstop = resolve; });

      v.pause();
      v.currentTime = trimStart;
      await new Promise((r) => { v.onseeked = r; });

      recorder.start();

      let rafId;
      const draw = () => {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        setProgress(Math.min(1, (v.currentTime - trimStart) / (trimEnd - trimStart)));
        if (v.currentTime < trimEnd && !v.paused) {
          rafId = requestAnimationFrame(draw);
        } else {
          recorder.stop();
          v.pause();
        }
      };
      v.play();
      draw();

      await done;
      cancelAnimationFrame(rafId);

      const blob = new Blob(chunks, { type: 'video/webm' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      const base = (name || 'video').replace(/\.[^.]+$/, '');
      a.download = `${base}-trimmed.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err?.message || 'Export failed — this device/browser may not support in-browser video re-encoding.');
    } finally {
      setExporting(false);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col p-6 gap-4 items-center justify-center overflow-auto">
      <video
        ref={videoRef}
        src={url}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="max-w-full max-h-[45vh] rounded shadow-2xl bg-black"
        playsInline
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-2xl flex items-center gap-2">
        <button onClick={togglePlay} className="p-2 rounded-full bg-amber-400 text-slate-900">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="text-xs text-slate-500 font-mono w-10">{fmt(currentTime)}</span>
        <span className="text-xs text-slate-600">/ {fmt(duration)}</span>
      </div>

      <div className="w-full max-w-2xl space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Scissors size={13} /> Trim: {fmt(trimStart)} — {fmt(trimEnd)}
        </div>
        <input type="range" min="0" max={duration} step="0.1" value={trimStart}
          onChange={(e) => setTrimStart(Math.min(+e.target.value, trimEnd - 0.2))}
          className="w-full accent-amber-400" />
        <input type="range" min="0" max={duration} step="0.1" value={trimEnd}
          onChange={(e) => setTrimEnd(Math.max(+e.target.value, trimStart + 0.2))}
          className="w-full accent-amber-400" />
      </div>

      {error && (
        <div className="w-full max-w-2xl flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button onClick={exportTrimmed} disabled={exporting} className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:opacity-50">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {exporting ? `Rendering… ${Math.round(progress * 100)}%` : 'Save trimmed copy (.webm)'}
      </button>
      <div className="text-[10px] text-slate-600 text-center max-w-2xl">
        Re-records the selected range in real time (plays through it once while capturing), so export takes about
        as long as the trimmed clip itself. Output is .webm — universally playable in browsers, though not every
        desktop media player supports it without a codec pack.
      </div>
    </div>
  );
}
