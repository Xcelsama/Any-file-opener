'use client';

export default function NoPreviewCard({ note, ext }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-8">
      <div className="text-xs font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 mb-1">.{ext}</div>
      <div className="text-sm text-slate-300">No preview available for this file type</div>
      <div className="text-xs text-slate-500 max-w-xs">{note}</div>
      <div className="text-xs text-slate-600 mt-1">Use the download button above to save it.</div>
    </div>
  );
}
