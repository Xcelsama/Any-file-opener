export function parseEml(raw) {
  const splitIndex = raw.search(/\r?\n\r?\n/);
  const headerBlock = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const body = splitIndex === -1 ? '' : raw.slice(splitIndex).replace(/^\r?\n\r?\n/, '');

  const lines = headerBlock.split(/\r?\n/);
  const joined = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && joined.length) {
      joined[joined.length - 1] += ' ' + line.trim();
    } else {
      joined.push(line);
    }
  }

  const headers = {};
  for (const line of joined) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!(key in headers)) headers[key] = value;
  }

  const isMultipart = /multipart\//i.test(headers['content-type'] || '');
  return {
    headers: {
      from: headers.from || '',
      to: headers.to || '',
      cc: headers.cc || '',
      subject: headers.subject || '(no subject)',
      date: headers.date || '',
    },
    body: isMultipart ? `This is a multipart message, showing raw source:\n\n${body}` : body,
  };
}
