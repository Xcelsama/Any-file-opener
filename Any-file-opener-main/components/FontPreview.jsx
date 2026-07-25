'use client';

import { useEffect, useState } from 'react';

const SAMPLE_LINES = [
  'The quick brown fox jumps over the lazy dog',
  'ABCDEFGHIJKLM abcdefghijklm 0123456789',
];

export default function FontPreview({ buffer, name, id }) {
  const [status, setStatus] = useState('loading');
  const [familyName] = useState(() => `user-font-${id}`);

  useEffect(() => {
    let face;
    let cancelled = false;

    async function load() {
      try {
        face = new FontFace(familyName, buffer);
        await face.load();
        if (cancelled) return;
        document.fonts.add(face);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
      if (face) document.fonts.delete(face);
    };
  }, [buffer, familyName]);

  if (status === 'loading') {
    return <div className="h-full flex items-center justify-center text-sm text-slate-500">Loading font…</div>;
  }

  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-8">
        <div className="text-sm text-slate-300">This font could not be loaded in the browser</div>
        <div className="text-xs text-slate-500">Download it to try it in a design app or your OS font viewer.</div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="bg-white text-slate-900 rounded-lg shadow-2xl mx-auto max-w-3xl p-8">
        <div className="text-xs text-slate-500 mb-6">{name}</div>
        {[64, 40, 24, 16].map((size) => (
          <div
            key={size}
            style={{ fontFamily: familyName, fontSize: size }}
            className="mb-4 truncate"
          >
            {SAMPLE_LINES[0]}
          </div>
        ))}
        <div style={{ fontFamily: familyName }} className="text-lg mt-6 border-t border-slate-200 pt-4">
          {SAMPLE_LINES[1]}
        </div>
      </div>
    </div>
  );
}
