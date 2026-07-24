function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(line) {
  let s = escapeHtml(line);
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

export function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inCode = false;
  let codeBuf = [];
  let inList = false;
  let listType = null;

  const closeList = () => {
    if (inList) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
      listType = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeBuf = [];
        closeList();
      } else {
        html += `<pre class="md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level} class="md-h${level}">${inline(heading[2])}</h${level}>`;
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      html += `<blockquote class="md-quote">${inline(line.replace(/^>\s?/, ''))}</blockquote>`;
      continue;
    }
    const unordered = line.match(/^[-*+]\s+(.*)/);
    if (unordered) {
      if (!inList || listType !== 'ul') {
        closeList();
        html += '<ul class="md-ul">';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${inline(unordered[1])}</li>`;
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.*)/);
    if (ordered) {
      if (!inList || listType !== 'ol') {
        closeList();
        html += '<ol class="md-ol">';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${inline(ordered[1])}</li>`;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList();
      html += '<hr class="md-hr"/>';
      continue;
    }
    closeList();
    html += `<p class="md-p">${inline(line)}</p>`;
  }
  closeList();
  if (inCode) html += `<pre class="md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
  return html;
}
