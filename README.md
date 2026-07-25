# anyfile.viewer

Open, preview and edit almost any file type, entirely in the browser.

317 extensions are recognized out of the box (plus filename-based matches like `Dockerfile`), grouped into sections:
code, markup & config, data, documents, spreadsheets, presentations, ebooks, images, design files, audio, video,
archives, installers & packages, fonts, 3D & CAD, databases, certificates & keys, and email.

## What actually renders

- **Code & text** (JS/TS, Python, Java, C/C++/C#, Go, Rust, Ruby, PHP, Swift, Kotlin, SQL, shell, and 40+ more) —
  real syntax highlighting and in-place editing via CodeMirror.
- **JSON** — same editor, plus a one-click formatter.
- **Markdown** — rendered view, with a raw/edit mode underneath.
- **Images** (png, jpg, gif, webp, svg, avif, heic, tiff...) — native preview, with a graceful fallback if the
  browser can't decode a given format.
- **PDF** — inline viewer.
- **Word (.docx)** — converted to a readable page.
- **Excel/CSV/ODS** — spreadsheet table view, CSV also has a raw/edit mode.
- **Audio & video** — native players, with fallback messaging for formats the browser can't decode.
- **Fonts** (ttf, otf, woff, woff2) — live specimen preview using the actual font.
- **Archives** (zip, jar, war, epub...) — contents listing without extracting anything.
- **Email (.eml)** — parsed header + body view.
- Anything else recognized but not renderable (PowerPoint, PSD, 3D models, databases, RAR/7z, installers...) gets
  a clear "no preview, here's what it is" card with a working download button.
- Anything not recognized at all is sniffed: if it looks like text it opens as an editor, otherwise it opens as a
  hex dump. Nothing is ever a dead end.

## Mobile

The sidebar collapses into a slide-in drawer under the hamburger icon below the `sm` breakpoint, the toolbar
scrolls horizontally instead of overflowing, and touch targets stay icon-sized but tappable. Tested at common
phone widths (360–430px).

## Running locally

```
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

Stock Next.js app, no server routes, zero configuration needed.

1. Push this folder to a GitHub repository (keep the folder structure intact — `app/`, `components/`, and `lib/`
   all need to sit at the repo root, as siblings of `package.json`).
2. On vercel.com, "Add New Project", import the repository, click Deploy.

Or from this folder with the Vercel CLI:

```
npx vercel
```

## Do you need a database?

No. Every file is read straight off your device with the browser's File API and never leaves it nothing is
uploaded, so there's nothing to persist server-side. You'd only need one if you wanted saved history, shareable
links, or multi-person editing later; a small setup for that would be Vercel Blob (or S3) for the file bytes plus
a lightweight database like Vercel Postgres or Supabase for metadata.

## Project structure

```
app/
  layout.js            root layout, loads global styles
  page.js               renders the viewer
  globals.css           tailwind + markdown/document styling
components/
  FileViewer.jsx         upload, categorized sidebar, preview switching, edit/save logic
  CodeEditor.jsx          CodeMirror wrapper: language map and theme
  FontPreview.jsx         live font specimen via the FontFace API
  ArchiveBrowser.jsx      zip-family contents listing
  EmailView.jsx           .eml header + body view
  NoPreviewCard.jsx       fallback card for recognized, non-renderable formats
lib/
  fileTypes.js            the extension/category/kind table (317 extensions)
  markdown.js              small markdown to HTML renderer, no dependency
  archive.js               JSZip wrapper + best-effort EPUB title detection
  eml.js                   RFC822 header/body parser
```
