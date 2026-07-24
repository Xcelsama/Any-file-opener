'use client';

import CodeMirror from '@uiw/react-codemirror';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { go } from '@codemirror/legacy-modes/mode/go';

const editorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#0b0e14',
    foreground: '#c9d1d9',
    caret: '#f5b642',
    selection: '#264f6a',
    selectionMatch: '#1d3a4d',
    lineHighlight: '#11151c',
    gutterBackground: '#0b0e14',
    gutterForeground: '#4b5563',
    gutterBorder: '#1e2530',
  },
  styles: [
    { tag: t.comment, color: '#6b7280', fontStyle: 'italic' },
    { tag: [t.string, t.special(t.string)], color: '#7ee787' },
    { tag: t.number, color: '#d19a66' },
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: '#ff7b93' },
    { tag: t.function(t.variableName), color: '#e3b341' },
    { tag: t.propertyName, color: '#79c0ff' },
    { tag: t.typeName, color: '#3ecbc0' },
    { tag: t.bool, color: '#ff7b93' },
    { tag: t.tagName, color: '#ff7b93' },
    { tag: t.attributeName, color: '#79c0ff' },
    { tag: t.operator, color: '#c9d1d9' },
  ],
});

function extensionFor(lang) {
  switch (lang) {
    case 'javascript': return [javascript({ jsx: true })];
    case 'typescript': return [javascript({ jsx: true, typescript: true })];
    case 'python': return [python()];
    case 'html': return [html()];
    case 'css': return [css()];
    case 'json': return [json()];
    case 'markdown': return [markdown()];
    case 'sql': return [sql()];
    case 'cpp': case 'c': return [cpp()];
    case 'java': return [java()];
    case 'php': return [php()];
    case 'rust': return [rust()];
    case 'yaml': return [yaml()];
    case 'xml': return [xml()];
    case 'bash': return [StreamLanguage.define(shell)];
    case 'ruby': return [StreamLanguage.define(ruby)];
    case 'go': return [StreamLanguage.define(go)];
    default: return [];
  }
}

export default function CodeEditor({ value, lang, readOnly, onChange, wrap }) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={editorTheme}
      extensions={extensionFor(lang)}
      editable={!readOnly}
      readOnly={readOnly}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly }}
      style={{ height: '100%', fontSize: 13, whiteSpace: wrap ? 'pre-wrap' : 'pre' }}
    />
  );
}
