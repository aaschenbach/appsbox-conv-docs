export {};

// HTML intermediário -> EPUB 3 (só saída), com o JSZip já vendorizado.
// Um único documento de conteúdo; sumário (nav) gerado pelos títulos H1/H2.
// Sem imagens, fontes embutidas ou divisão em capítulos.

import { escapeHtml } from './text-formats.js';

declare const JSZip: {
  new (): JSZipInstance;
};
interface JSZipInstance {
  file(path: string, content: string, options?: { compression?: 'STORE' | 'DEFLATE' }): void;
  generateAsync(options: { type: 'uint8array' }): Promise<Uint8Array>;
}

const CONTAINER_XML = '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';

const STYLE_CSS = 'body{font-family:serif;line-height:1.5;margin:5%}h1,h2,h3{font-family:sans-serif;line-height:1.2}pre{white-space:pre-wrap;font-family:monospace}table{border-collapse:collapse}td,th{border:1px solid #888;padding:.3em .5em}img{max-width:100%}';

// Deixa o corpo do HTML intermediário válido em XHTML e injeta âncoras nos
// títulos para o sumário.
function toXhtmlBody(html: string): { body: string; toc: { id: string; level: number; text: string }[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const toc: { id: string; level: number; text: string }[] = [];
  let counter = 0;
  Array.from(doc.querySelectorAll('h1, h2')).forEach((h) => {
    counter += 1;
    const id = `sec-${counter}`;
    h.setAttribute('id', id);
    toc.push({ id, level: Number(h.tagName[1]), text: (h.textContent ?? '').trim() });
  });
  let body = doc.body.innerHTML;
  // Fecha elementos vazios para XHTML.
  body = body
    .replace(/<(br|hr|img|meta|link)((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>/gi, '<$1$2/>')
    .replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, '&amp;');
  return { body, toc };
}

function uuid(): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i += 1) s += h[Math.floor(Math.random() * 16)];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export async function htmlToEpubBytes(html: string, titleHint?: string): Promise<Uint8Array> {
  const { body, toc } = toXhtmlBody(html);
  const title = (titleHint || toc[0]?.text || 'Documento').trim();
  const id = `urn:uuid:${uuid()}`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const textXhtml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`;

  const navItems = toc.length
    ? toc.map((t) => `<li><a href="text.xhtml#${t.id}">${escapeHtml(t.text)}</a></li>`).join('')
    : `<li><a href="text.xhtml">${escapeHtml(title)}</a></li>`;
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR"><head><meta charset="utf-8"/><title>Sumário</title></head><body><nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${navItems}</ol></nav></body></html>`;

  const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">${id}</dc:identifier><dc:title>${escapeHtml(title)}</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">${now}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="content" href="text.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="content"/></spine></package>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', CONTAINER_XML);
  zip.file('OEBPS/content.opf', opf);
  zip.file('OEBPS/nav.xhtml', navXhtml);
  zip.file('OEBPS/text.xhtml', textXhtml);
  zip.file('OEBPS/style.css', STYLE_CSS);
  return zip.generateAsync({ type: 'uint8array' });
}
