'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Scissors, Download, Loader2, AlertTriangle } from 'lucide-react';

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);

  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, buffer.length * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bufferArr], { type: 'audio/wav' });
}

export default function AudioEditor({ url, name }) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);

  const audioElRef = useRef(null);
  const canvasRef = useRef(null);
  const audioBufferRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        audioBufferRef.current = decoded;
        setDuration(decoded.duration);
        setTrimEnd(decoded.duration);
        drawWaveform(decoded);
        setStatus('ready');
        ctx.close();
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Could not decode this audio file.'); setStatus('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  function drawWaveform(buffer) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = buffer.getChannelData(0);
    const width = canvas.width;
    const height = canvas.height;
    const step = Math.ceil(data.length / width);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#00c8ff';
    for (let x = 0; x < width; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = ((1 + min) / 2) * height;
      const y2 = ((1 + max) / 2) * height;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
  }

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) { el.pause(); } else {
      if (el.currentTime < trimStart || el.currentTime >= trimEnd) el.currentTime = trimStart;
      el.play();
    }
  };

  const onTimeUpdate = () => {
    const el = audioElRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (el.currentTime >= trimEnd) { el.pause(); el.currentTime = trimStart; }
  };

  const exportTrimmed = async () => {
    const buffer = audioBufferRef.current;
    if (!buffer) return;
    setExporting(true);
    try {
      const sampleRate = buffer.sampleRate;
      const startSample = Math.floor(trimStart * sampleRate);
      const endSample = Math.floor(trimEnd * sampleRate);
      const frameCount = Math.max(1, endSample - startSample);

      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtx(buffer.numberOfChannels, frameCount, sampleRate);
      const source = offlineCtx.createBufferSource();

      // Build a trimmed copy of the buffer (can't slice an AudioBuffer directly)
      const trimmed = offlineCtx.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        trimmed.copyToChannel(buffer.getChannelData(ch).slice(startSample, endSample), ch);
      }
      source.buffer = trimmed;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = volume;
      source.connect(gainNode).connect(offlineCtx.destination);
      source.start(0);

      const rendered = await offlineCtx.startRendering();
      const blob = audioBufferToWav(rendered);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      const base = (name || 'audio').replace(/\.[^.]+$/, '');
      a.download = `${base}-edited.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  if (status === 'loading') {
    return <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm"><Loader2 size={16} className="animate-spin" /> Decoding audio…</div>;
  }
  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-8">
        <AlertTriangle size={22} className="text-red-400" />
        <div className="text-sm text-slate-300">Couldn&apos;t edit this audio file</div>
        <div className="text-xs text-slate-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4 items-center justify-center">
      <audio ref={audioElRef} src={url} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="hidden" />

      <canvas ref={canvasRef} width={700} height={100} className="w-full max-w-2xl rounded bg-slate-900 border border-slate-800" />

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
        <input type="range" min="0" max={duration} step="0.01" value={trimStart}
          onChange={(e) => setTrimStart(Math.min(+e.target.value, trimEnd - 0.1))}
          className="w-full accent-amber-400" />
        <input type="range" min="0" max={duration} step="0.01" value={trimEnd}
          onChange={(e) => setTrimEnd(Math.max(+e.target.value, trimStart + 0.1))}
          className="w-full accent-amber-400" />
      </div>

      <div className="w-full max-w-2xl flex items-center gap-2">
        <span className="text-xs text-slate-400 w-14">Volume</span>
        <input type="range" min="0" max="2" step="0.05" value={volume} onChange={(e) => setVolume(+e.target.value)} className="flex-1 accent-amber-400" />
        <span className="text-xs text-slate-500 font-mono w-10">{Math.round(volume * 100)}%</span>
      </div>

      <button onClick={exportTrimmed} disabled={exporting} className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:opacity-50">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Save trimmed copy (.wav)
      </button>
    </div>
  );
}
