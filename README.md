# AnyFile Viewer

Open, preview and edit almost any file type — entirely on your device, no upload, no backend.

317 extensions are recognized out of the box (plus filename-based matches like `Dockerfile`), grouped into
sections: code, markup & config, data, documents, spreadsheets, presentations, ebooks, images, design files,
audio, video, archives, installers & packages, fonts, 3D & CAD, databases, certificates & keys, and email.

Ships as a web app, an installable desktop PWA, and a native Android app (via Capacitor) that can register as a
file handler for "Open with" on Android.

## What actually renders

- **Code & text** (JS/TS, Python, Java, C/C++/C#, Go, Rust, Ruby, PHP, Swift, Kotlin, SQL, shell, and 40+ more) —
  real syntax highlighting and in-place editing via CodeMirror.
- **JSON** — same editor, plus a one-click formatter.
- **Markdown** — rendered view (sanitized before render), with a raw/edit mode underneath.
- **Images** (png, jpg, gif, webp, svg, avif, heic, tiff...) — native preview, with a graceful fallback if the
  browser can't decode a given format.
- **PDF** — inline viewer.
- **Word (.docx)** — converted to a readable page, sanitized before render.
- **Excel/CSV/ODS** — spreadsheet table view, CSV also has a raw/edit mode.
- **Audio & video** — native players, with fallback messaging for formats the browser can't decode.
- **Fonts** (ttf, otf, woff, woff2) — live specimen preview using the actual font.
- **Archives** (zip, jar, war, epub...) — contents listing without extracting anything.
- **Email (.eml)** — parsed header + body view.
- Anything else recognized but not renderable (PowerPoint, PSD, 3D models, databases, RAR/7z, installers...) gets
  a clear "no preview, here's what it is" card with a working download button.
- Anything not recognized at all is sniffed: if it looks like text it opens as an editor, otherwise it opens as a
  hex dump. Nothing is ever a dead end.

## Safety limits

Every preview reads the file fully into memory before rendering, so file size is capped to avoid freezing the
tab (or the Android WebView) on an unexpectedly huge file:

- Text-based kinds (code, JSON, markdown, CSV, email): **15 MB**
- Binary-based kinds (fonts, archives, Word, spreadsheets): **100 MB**

Files over the limit show a clear message and a download button instead of attempting to render. See
`lib/constants.js` to adjust these.

Rendered HTML from `.docx` and Markdown files is passed through **DOMPurify** before being injected into the
page — both are untrusted, user-supplied content, and this is the difference between "preview" and "arbitrary
script execution."

## Mobile

The sidebar collapses into a slide-in drawer under the hamburger icon below the `sm` breakpoint, the toolbar
scrolls horizontally instead of overflowing, and touch targets stay icon-sized but tappable. Tested at common
phone widths (360–430px).

## Project structure

```
app/
  layout.js                root layout, loads global styles
  page.js                  renders the viewer
  globals.css               tailwind + markdown/document styling
components/
  FileViewer.jsx            upload, categorized sidebar, preview switching, edit/save logic
  CodeEditor.jsx            CodeMirror wrapper: language map and theme
  FontPreview.jsx           live font specimen via the FontFace API
  ArchiveBrowser.jsx        zip-family contents listing
  EmailView.jsx             .eml header + body view
  NoPreviewCard.jsx         fallback card for recognized, non-renderable formats
  AboutModal.jsx            about/credits dialog
  RegisterServiceWorker.jsx registers public/sw.js on mount
hooks/
  usePwaFileHandling.js     wires up both "open with this app" paths — the web
                            File Handling API (launchQueue) and the native
                            Capacitor bridge — so FileViewer.jsx doesn't need
                            to know which platform it's running on
lib/
  fileTypes.js              the extension/category/kind table (317 extensions)
  constants.js              file-size safety limits
  markdown.js               small markdown-to-HTML renderer, no dependency
  archive.js                JSZip wrapper + best-effort EPUB title detection
  eml.js                    RFC822 header/body parser
android/                    native Capacitor Android project (see below)
```

Heavy parsing libraries (`xlsx`, `papaparse`, `mammoth`) are dynamically imported only when a matching file type
is actually opened, rather than bundled into the initial page load.

## Running locally

```
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

Stock Next.js app, no server routes, zero configuration needed.

1. Push this folder to a GitHub repository (keep the folder structure intact — `app/`, `components/`, `hooks/`,
   and `lib/` all need to sit at the repo root, as siblings of `package.json`).
2. On vercel.com, "Add New Project", import the repository, click Deploy.

Or from this folder with the Vercel CLI:

```
npx vercel
```

## Do you need a database?

No. Every file is read straight off your device with the browser's File API and never leaves it — nothing is
uploaded, so there's nothing to persist server-side. You'd only need one if you wanted saved history, shareable
links, or multi-person editing later; a small setup for that would be Vercel Blob (or S3) for the file bytes plus
a lightweight database like Vercel Postgres or Supabase for metadata.

## The Android app

This ships as a real native Android app via **Capacitor** — a thin native shell that loads the live deployed site
and adds one thing the web can't do on Android: registering as a file handler so the app shows up in "Open with"
from a file manager.

The `android/` folder in this repo is already fully set up:

- `capacitor.config.ts` — points the shell at your deployed URL
- `android/app/src/main/AndroidManifest.xml` — has the `VIEW` intent-filter for common MIME types
- `android/app/src/main/java/.../FileHandlerPlugin.java` — native plugin that reads the incoming file's bytes
  from its `content://` URI
- `android/app/src/main/java/.../MainActivity.java` — registers the plugin and forwards new launch intents
- `hooks/usePwaFileHandling.js` — the JS side of the bridge, feeding the received file straight into the same
  `handleFiles()` the drag-and-drop UI uses

### Building the APK

1. Confirm `capacitor.config.ts`'s `server.url` points at your real deployed URL, not a placeholder.
2. `npm install` (needs Node.js) then, from the project root: `npx cap sync android`
3. Open Android Studio → **Open** → select the `android` folder specifically (not the repo root)
4. Let Gradle sync finish (first time downloads the SDK/dependencies — can take a while)
5. **Build → Generate App Bundles or APKs → Generate APKs**
6. Find the output at `android/app/build/outputs/apk/debug/AnyFileViewer-debug.apk`

### Changing the app icon

Right-click `app` in Android Studio's Project view → **New → Image Asset** → point the Foreground Layer at
`public/icon-512.png` (or your own logo) → Finish. This regenerates every density folder under
`android/app/src/main/res/mipmap-*`.

### What needs a rebuild vs. what doesn't

Since the app loads your live website, most changes need nothing beyond a normal `git push` — Vercel redeploys
and the app picks it up on next open. You only need to reopen Android Studio and rebuild for changes to:
native permissions, the intent-filter (new file types at the OS level), the app icon/name, or adding a new
native Capacitor plugin.

## Offline support

`public/sw.js` uses a hybrid strategy: the HTML shell and Next.js's own JS/CSS chunks are fetched network-first
(so a new deploy is picked up immediately instead of serving stale cached script references), while icons and
the manifest are cache-first with a background refresh. If there's no network and nothing cached yet,
`public/offline.html` is shown instead of a blank error page.
