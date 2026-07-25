// Safety limits to avoid freezing/crashing the tab (or the WebView, on the
// Android build) when someone opens a file that's much larger than expected.
// Everything here is read fully into memory (arrayBuffer/text) before it can
// be rendered, so an unbounded file size is a real risk on low-end devices.

// Text-ish kinds we fully decode as a string: code, json, markdown, csv, email.
export const MAX_TEXT_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

// Binary-ish kinds we fully buffer before parsing: fonts, archives, docx, spreadsheets.
export const MAX_BINARY_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const TEXT_LIMITED_KINDS = ['email', 'json', 'markdown', 'code', 'csv'];
export const BINARY_LIMITED_KINDS = ['font', 'archive', 'docx', 'sheet'];
