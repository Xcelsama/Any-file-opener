'use client';

import { FileIcon, Folder } from 'lucide-react';
import { formatSize } from '../lib/fileTypes';

export default function ArchiveBrowser({ entries, title }) {
  return (
    <div className="p-4">
      {title && (
        <div className="bg-white text-slate-900 rounded-lg shadow-2xl p-4 mb-3 max-w-2xl">
          <div className="text-xs text-slate-500">Detected title</div>
          <div className="font-medium">{title}</div>
        </div>
      )}
      <div className="text-xs text-slate-500 mb-2">{entries.length} entries</div>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800 last:border-b-0 text-xs"
            style={{ paddingLeft: 12 + entry.depth * 16 }}
          >
            {entry.dir ? <Folder size={13} className="text-amber-400 flex-shrink-0" /> : <FileIcon size={13} className="text-slate-500 flex-shrink-0" />}
            <span className="truncate text-slate-300">{entry.name}</span>
            <div className="flex-1" />
            {!entry.dir && <span className="text-slate-600 flex-shrink-0">{formatSize(entry.size)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
