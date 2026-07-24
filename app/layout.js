import './globals.css';

export const metadata = {
  title: 'anyfile.viewer',
  description: 'Open, preview and edit almost any file type in the browser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
