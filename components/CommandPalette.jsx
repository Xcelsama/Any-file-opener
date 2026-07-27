'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';

export default function CommandPalette({ open, onClose, files, onSelectFile, actions }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const fileItems = files
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .map((f) => ({ type: 'file', id: f.id, label: f.name, sublabel: 'Open file' }));
    const actionItems = actions
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((a) => ({ type: 'action', id: a.id, label: a.label, sublabel: 'Action', run: a.run }));
    return [...fileItems, ...actionItems].slice(0, 20);
  }, [query, files, actions]);

  useEffect(() => setActiveIndex(0), [query]);

  const runItem = (item) => {
    if (!item) return;
    if (item.type === 'file') onSelectFile(item.id);
    else item.run?.();
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(items.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); runItem(items[activeIndex]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
          <Search size={15} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a file, or run an action…"
            className="bg-transparent outline-none flex-1 text-sm text-slate-200 placeholder-slate-500"
          />
          <kbd className="text-[10px] text-slate-600 border border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-auto py-1">
          {items.length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-600">No matches</div>}
          {items.map((item, i) => (
            <div
              key={`${item.type}-${item.id}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => runItem(item)}
              className={`px-3 py-2 flex items-center justify-between cursor-pointer text-sm ${i === activeIndex ? 'bg-slate-800 text-slate-100' : 'text-slate-300'}`}
            >
              <span className="truncate">{item.label}</span>
              <span className="text-[10px] text-slate-600 flex-shrink-0 ml-2">{item.sublabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
