'use client';

import { X, Github, Coffee } from 'lucide-react';

export default function AboutModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-medium text-slate-200">About</span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center text-center gap-1">
          <img src="/icon-192.png" alt="" className="w-14 h-14 rounded-2xl mb-2" />
          <div className="text-slate-100 font-semibold">AnyFile Viewer</div>
          <div className="text-xs text-slate-500">Open, preview and edit almost any file, entirely on your device.</div>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          <a
            href="https://github.com/Xcelsama"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-amber-300 px-3 py-2 rounded-lg bg-slate-800/60"
          >
            <Github size={16} /> Built by Xcelsama
          </a>

          <button
            disabled
            className="flex items-center gap-2 text-sm text-slate-500 px-3 py-2 rounded-lg bg-slate-800/30 cursor-not-allowed"
          >
            <Coffee size={16} /> Support this project — coming soon
          </button>
        </div>
      </div>
    </div>
  );
}