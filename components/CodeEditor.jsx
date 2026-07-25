'use client';

import CodeMirror from '@uiw/react-codemirror';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { less } from '@codemirror/lang-less';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { vue } from '@codemirror/lang-vue';
import { liquid } from '@codemirror/lang-liquid';
import { wast } from '@codemirror/lang-wast';

import { csharp, kotlin, scala, objectiveC, dart as clikeDart } from '@codemirror/legacy-modes/mode/clike';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { go } from '@codemirror/legacy-modes/mode/go';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { vb } from '@codemirror/legacy-modes/mode/vb';
import { vbScript } from '@codemirror/legacy-modes/mode/vbscript';
import { pascal } from '@codemirror/legacy-modes/mode/pascal';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { r } from '@codemirror/legacy-modes/mode/r';
import { oCaml, fSharp, sml } from '@codemirror/legacy-modes/mode/mllike';
import { commonLisp } from '@codemirror/legacy-modes/mode/commonlisp';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { crystal } from '@codemirror/legacy-modes/mode/crystal';
import { cobol } from '@codemirror/legacy-modes/mode/cobol';
import { coffeeScript } from '@codemirror/legacy-modes/mode/coffeescript';
import { liveScript } from '@codemirror/legacy-modes/mode/livescript';
import { sass } from '@codemirror/legacy-modes/mode/sass';
import { stylus } from '@codemirror/legacy-modes/mode/stylus';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { vhdl } from '@codemirror/legacy-modes/mode/vhdl';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { tcl } from '@codemirror/legacy-modes/mode/tcl';
import { scheme } from '@codemirror/legacy-modes/mode/scheme';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { fortran } from '@codemirror/legacy-modes/mode/fortran';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { gas } from '@codemirror/legacy-modes/mode/gas';
import { stex } from '@codemirror/legacy-modes/mode/stex';

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

const stream = (mode) => StreamLanguage.define(mode);

const LANGUAGE_EXTENSIONS = {
  javascript: () => [javascript({ jsx: true })],
  typescript: () => [javascript({ jsx: true, typescript: true })],
  python: () => [python()],
  html: () => [html()],
  css: () => [css()],
  less: () => [less()],
  json: () => [json()],
  markdown: () => [markdown()],
  sql: () => [sql()],
  cpp: () => [cpp()],
  c: () => [cpp()],
  java: () => [java()],
  php: () => [php()],
  rust: () => [rust()],
  yaml: () => [yaml()],
  xml: () => [xml()],
  vue: () => [vue()],
  liquid: () => [liquid()],
  wast: () => [wast()],

  csharp: () => [stream(csharp)],
  kotlin: () => [stream(kotlin)],
  scala: () => [stream(scala)],
  objectivec: () => [stream(objectiveC)],
  dart: () => [stream(clikeDart)],
  swift: () => [stream(swift)],
  go: () => [stream(go)],
  shell: () => [stream(shell)],
  ruby: () => [stream(ruby)],
  toml: () => [stream(toml)],
  properties: () => [stream(properties)],
  dockerfile: () => [stream(dockerFile)],
  powershell: () => [stream(powerShell)],
  vb: () => [stream(vb)],
  vbscript: () => [stream(vbScript)],
  pascal: () => [stream(pascal)],
  perl: () => [stream(perl)],
  lua: () => [stream(lua)],
  groovy: () => [stream(groovy)],
  haskell: () => [stream(haskell)],
  r: () => [stream(r)],
  ocaml: () => [stream(oCaml)],
  fsharp: () => [stream(fSharp)],
  sml: () => [stream(sml)],
  commonlisp: () => [stream(commonLisp)],
  clojure: () => [stream(clojure)],
  erlang: () => [stream(erlang)],
  crystal: () => [stream(crystal)],
  cobol: () => [stream(cobol)],
  coffeescript: () => [stream(coffeeScript)],
  livescript: () => [stream(liveScript)],
  sass: () => [stream(sass)],
  stylus: () => [stream(stylus)],
  verilog: () => [stream(verilog)],
  vhdl: () => [stream(vhdl)],
  protobuf: () => [stream(protobuf)],
  diff: () => [stream(diff)],
  tcl: () => [stream(tcl)],
  scheme: () => [stream(scheme)],
  julia: () => [stream(julia)],
  fortran: () => [stream(fortran)],
  cmake: () => [stream(cmake)],
  gas: () => [stream(gas)],
  stex: () => [stream(stex)],
};

function extensionFor(lang) {
  const build = LANGUAGE_EXTENSIONS[lang];
  return build ? build() : [];
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
