# anyfile.viewer

Open, preview and edit almost any file type, entirely in the browser.

- Code and text files (JavaScript, TypeScript, Python, Java, C/C++, PHP, Ruby, Go, Rust, SQL, Bash, YAML, HTML, CSS, XML, plain text) open in a real editor with syntax highlighting and can be edited in place.
- JSON gets the same editor plus a one-click formatter.
- Markdown renders as formatted text, with a raw/edit mode underneath.
- Images, PDF, Word (.docx), Excel/CSV and audio/video get a native preview.
- Anything else falls back to a hex dump, so no file is ever a dead end.

## Running locally

```
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

This is a stock Next.js app with no server routes, so it deploys with zero configuration.

1. Push this folder to a GitHub repository.
2. Go to vercel.com, "Add New Project", import the repository.
3. Leave the defaults (Framework: Next.js) and click Deploy.

Or, from this folder with the Vercel CLI installed:

```
npx vercel
```

## Do you need a database?

No, not for this. Every file you open is read straight off your device with the browser's File API and never leaves it — there's no upload, no server processing, and nothing to persist. That's why there are no API routes here.

You'd only need a database (or storage like Vercel Blob) if you wanted to add something that requires remembering state between visits or sharing between people, for example:

- Saving a file so it's still there next time you open the site
- Sharing a link that lets someone else view a file you opened
- Multiple people editing the same file at once
- Keeping a history of edits

If you want any of those later, a small setup would look like: Vercel Blob (or S3) to store the file bytes, and a lightweight database like Vercel Postgres or Supabase to store metadata (filename, owner, timestamps). Nothing like that is needed to run the app as it is now.

## Project structure

```
app/
  layout.js       root layout, loads global styles
  page.js          renders the viewer
  globals.css      tailwind + markdown/document styling
components/
  FileViewer.jsx   upload, sidebar, preview switching, edit/save logic
  CodeEditor.jsx   CodeMirror wrapper with language and theme setup
lib/
  fileTypes.js     extension to file-kind mapping, hex dump, formatting helpers
  markdown.js      small markdown to HTML renderer (no external dependency)
```
