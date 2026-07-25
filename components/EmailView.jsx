'use client';

export default function EmailView({ headers, body }) {
  const rows = [
    ['From', headers.from],
    ['To', headers.to],
    ['Cc', headers.cc],
    ['Subject', headers.subject],
    ['Date', headers.date],
  ].filter(([, value]) => value);

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="bg-white text-slate-900 rounded-lg shadow-2xl mx-auto max-w-3xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3 text-sm py-1">
              <span className="text-slate-400 w-16 flex-shrink-0">{label}</span>
              <span className="text-slate-800 break-words">{value}</span>
            </div>
          ))}
        </div>
        <pre className="p-6 whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">{body}</pre>
      </div>
    </div>
  );
}
