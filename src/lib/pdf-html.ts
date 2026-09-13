// src/lib/pdf-html.ts — Self-contained HTML document for FR-CHAT-18 PDF export.
//
// The offscreen WKWebView has no access to the app's CSS variables, so styles
// are hardcoded light-theme values. Input is already sanitized HTML from
// renderMarkdown (NFR-SEC-10).
//
// The webview is A4-wide; height grows to the document then slices are
// snapped to block boundaries (headings, paragraphs) before createPDF.

export function buildPdfHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
  }
  body {
    font-family: -apple-system, system-ui, sans-serif;
    padding: 48pt 54pt;
    color: #1a1a1a;
    line-height: 1.55;
    font-size: 11pt;
  }
  h1 { font-size: 18pt; border-bottom: 1px solid #ddd; padding-bottom: 8pt; }
  h2 { font-size: 14pt; margin-top: 18pt; }
  h3 { font-size: 12pt; }
  code { background: #f0f0f0; padding: 1pt 4pt; border-radius: 3pt; font-size: 10pt; }
  pre { background: #f5f5f5; padding: 10pt; border-radius: 4pt; overflow-x: auto; font-size: 10pt; }
  blockquote { border-left: 3pt solid #ccc; margin-left: 0; padding-left: 12pt; color: #555; }
  a { color: #0066cc; }
  ul, ol { padding-left: 22pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 4pt 8pt; text-align: left; }
  th { background: #f5f5f5; }
  img { max-width: 100%; }
  h1, h2, h3, pre, blockquote, table { break-inside: avoid; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
