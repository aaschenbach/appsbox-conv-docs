export {};

// ODT (OpenDocument Text) <-> HTML intermediário, com o JSZip já vendorizado
// (public/vendor/jszip.js). Preserva títulos, negrito/itálico/sublinhado/
// tachado, listas, tabelas e links; descarta imagens, notas, cabeçalho/rodapé
// e estilos além dos padrões. Espelha a abordagem de src/docx.ts.

import { wrapHtml, escapeHtml } from './text-formats.js';
import { collectRuns, type RunFlags, type RunPart } from './docx.js';

declare const JSZip: {
  new (): JSZipInstance;
  loadAsync(data: ArrayBuffer | Uint8Array): Promise<JSZipInstance>;
};
interface JSZipFile { async(type: 'string'): Promise<string> }
interface JSZipInstance {
  file(path: string): JSZipFile | null;
  file(path: string, content: string, options?: { compression?: 'STORE' | 'DEFLATE' }): void;
  generateAsync(options: { type: 'uint8array' }): Promise<Uint8Array>;
}

const ODT_MIMETYPE = 'application/vnd.oasis.opendocument.text';

const MANIFEST_XML = '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
  `<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIMETYPE}"/>` +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>' +
  '</manifest:manifest>';

const STYLES_XML = '<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">' +
  '<office:styles>' +
  '<style:style style:name="Standard" style:family="paragraph"/>' +
  [1, 2, 3, 4, 5, 6].map((n) => `<style:style style:name="Heading_20_${n}" style:display-name="Heading ${n}" style:family="paragraph" style:parent-style-name="Standard" style:default-outline-level="${n}"><style:text-properties fo:font-weight="bold" fo:font-size="${20 - (n - 1) * 2}pt"/></style:style>`).join('') +
  '<style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>' +
  '<style:style style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>' +
  '<style:style style:name="Underline" style:family="text"><style:text-properties style:text-underline-style="solid" style:text-underline-width="auto"/></style:style>' +
  '<style:style style:name="Strike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>' +
  '<style:style style:name="Mono" style:family="text"><style:text-properties style:font-name="Courier New"/></style:style>' +
  '</office:styles></office:document-styles>';

function metaXml(): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2"><office:meta><meta:generator>AppsBox Conversor de Documentos</meta:generator><dc:date>${now}</dc:date></office:meta></office:document-meta>`;
}

// ---------------------------------------------------------------------------
// Escrita: HTML -> ODT
// ---------------------------------------------------------------------------
function spanFor(flags: RunFlags, text: string): string {
  let inner = escapeHtml(text).replace(/\t/g, '<text:tab/>');
  if (flags.code) inner = `<text:span text:style-name="Mono">${inner}</text:span>`;
  if (flags.bold) inner = `<text:span text:style-name="Bold">${inner}</text:span>`;
  if (flags.italic) inner = `<text:span text:style-name="Italic">${inner}</text:span>`;
  if (flags.underline) inner = `<text:span text:style-name="Underline">${inner}</text:span>`;
  if (flags.strike) inner = `<text:span text:style-name="Strike">${inner}</text:span>`;
  return inner;
}
function partsToOdt(parts: RunPart[]): string {
  return parts.map((part) => {
    if (part.kind === 'break') return '<text:line-break/>';
    if (part.kind === 'text') return spanFor(part.flags, part.text);
    return `<text:a xlink:href="${escapeHtml(part.href)}">${partsToOdt(part.parts)}</text:a>`;
  }).join('');
}
function odtParagraph(parts: RunPart[], styleName = 'Standard'): string {
  return `<text:p text:style-name="${styleName}">${partsToOdt(parts)}</text:p>`;
}

function blockToOdt(node: Node, out: string[]): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const heading = tag.match(/^h([1-6])$/);
  if (heading) { out.push(`<text:h text:style-name="Heading_20_${heading[1]}" text:outline-level="${heading[1]}">${partsToOdt(collectRuns(el, {}))}</text:h>`); return; }
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main') {
    const parts = collectRuns(el, {});
    if (parts.length) out.push(odtParagraph(parts));
    return;
  }
  if (tag === 'pre') {
    (el.textContent ?? '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => out.push(odtParagraph(line ? [{ kind: 'text', text: line, flags: { code: true } }] : [])));
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li');
    out.push(`<text:list>${items.map((li) => `<text:list-item>${odtParagraph(collectRuns(li, {}))}</text:list-item>`).join('')}</text:list>`);
    return;
  }
  if (tag === 'blockquote') { const parts = collectRuns(el, {}); if (parts.length) out.push(odtParagraph(parts)); return; }
  if (tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr'));
    if (!rows.length) return;
    const cols = Math.max(1, ...rows.map((r) => r.children.length));
    const cells = rows.map((row) => {
      const isHeader = Array.from(row.children).some((c) => c.tagName.toLowerCase() === 'th');
      return `<table:table-row>${Array.from(row.children).map((cell) => `<table:table-cell office:value-type="string">${odtParagraph(collectRuns(cell, isHeader ? { bold: true } : {}))}</table:table-cell>`).join('')}</table:table-row>`;
    }).join('');
    out.push(`<table:table table:name="Tabela"><table:table-column table:number-columns-repeated="${cols}"/>${cells}</table:table>`);
    return;
  }
  Array.from(el.children).forEach((child) => blockToOdt(child, out));
}

function contentXml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];
  Array.from(doc.body.children).forEach((child) => blockToOdt(child, out));
  if (!out.length) {
    const parts = collectRuns(doc.body, {});
    if (parts.length) out.push(odtParagraph(parts));
  }
  return '<?xml version="1.0" encoding="UTF-8"?><office:document-content ' +
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
    'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
    'xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.2">' +
    `<office:body><office:text>${out.join('')}</office:text></office:body></office:document-content>`;
}

export async function htmlToOdtBytes(html: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', ODT_MIMETYPE, { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', MANIFEST_XML);
  zip.file('content.xml', contentXml(html));
  zip.file('styles.xml', STYLES_XML);
  zip.file('meta.xml', metaXml());
  return zip.generateAsync({ type: 'uint8array' });
}

// ---------------------------------------------------------------------------
// Leitura: ODT -> HTML
// ---------------------------------------------------------------------------
type OdtFlags = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };
function parseAutoStyles(doc: Document): Map<string, OdtFlags> {
  const map = new Map<string, OdtFlags>();
  const collect = (styleEl: Element): void => {
    const name = styleEl.getAttribute('style:name');
    if (!name) return;
    const tp = styleEl.getElementsByTagName('style:text-properties')[0];
    if (!tp) { map.set(name, {}); return; }
    map.set(name, {
      bold: /bold|[6-9]00/.test(tp.getAttribute('fo:font-weight') ?? ''),
      italic: /italic|oblique/.test(tp.getAttribute('fo:font-style') ?? ''),
      underline: (tp.getAttribute('style:text-underline-style') ?? 'none') !== 'none',
      strike: (tp.getAttribute('style:text-line-through-style') ?? 'none') !== 'none',
    });
  };
  Array.from(doc.getElementsByTagName('style:style')).forEach(collect);
  return map;
}
function wrapFlags(flags: OdtFlags, inner: string): string {
  if (!inner) return '';
  let s = inner;
  if (flags.bold) s = `<strong>${s}</strong>`;
  if (flags.italic) s = `<em>${s}</em>`;
  if (flags.underline) s = `<u>${s}</u>`;
  if (flags.strike) s = `<del>${s}</del>`;
  return s;
}
function odtInline(node: Node, styles: Map<string, OdtFlags>, flags: OdtFlags): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === 'text:line-break') return '<br>';
  if (tag === 'text:tab') return '\t';
  if (tag === 'text:s') return ' '.repeat(Number(el.getAttribute('text:c') ?? '1'));
  const next = { ...flags, ...(styles.get(el.getAttribute('text:style-name') ?? '') ?? {}) };
  const inner = Array.from(el.childNodes).map((child) => odtInline(child, styles, next)).join('');
  if (tag === 'text:a') {
    const href = el.getAttribute('xlink:href') ?? '';
    return /^(?:https?:|mailto:)/i.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
  }
  if (tag === 'text:span') return wrapFlags(next, inner);
  return inner;
}

export async function odtToHtml(source: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(source);
  const entry = zip.file('content.xml');
  if (!entry) throw new Error('invalid_odt');
  const doc = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
  const stylesEntry = zip.file('styles.xml');
  const styles = parseAutoStyles(doc);
  if (stylesEntry) parseAutoStyles(new DOMParser().parseFromString(await stylesEntry.async('string'), 'application/xml')).forEach((v, k) => { if (!styles.has(k)) styles.set(k, v); });

  const body = doc.getElementsByTagName('office:text')[0];
  const blocks: string[] = [];
  const visit = (el: Element): void => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'text:h') {
      const level = Math.min(6, Math.max(1, Number(el.getAttribute('text:outline-level') ?? '1')));
      const inner = Array.from(el.childNodes).map((c) => odtInline(c, styles, {})).join('').trim();
      if (inner) blocks.push(`<h${level}>${inner}</h${level}>`);
      return;
    }
    if (tag === 'text:p') {
      const inner = Array.from(el.childNodes).map((c) => odtInline(c, styles, {})).join('').trim();
      if (inner) blocks.push(`<p>${inner}</p>`);
      return;
    }
    if (tag === 'text:list') {
      const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'text:list-item');
      const li = items.map((item) => {
        const inner = Array.from(item.getElementsByTagName('text:p')).map((p) => Array.from(p.childNodes).map((c) => odtInline(c, styles, {})).join('')).join(' ').trim();
        return `<li>${inner}</li>`;
      }).join('');
      if (li) blocks.push(`<ul>${li}</ul>`);
      return;
    }
    if (tag === 'table:table') {
      const rows = Array.from(el.getElementsByTagName('table:table-row'));
      const rowsHtml = rows.map((row) => {
        const cells = Array.from(row.getElementsByTagName('table:table-cell')).map((cell) => {
          const inner = Array.from(cell.getElementsByTagName('text:p')).map((p) => Array.from(p.childNodes).map((c) => odtInline(c, styles, {})).join('')).join(' ').trim();
          return `<td>${inner}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      if (rowsHtml) blocks.push(`<table>${rowsHtml}</table>`);
      return;
    }
    Array.from(el.children).forEach(visit);
  };
  if (body) Array.from(body.children).forEach(visit);
  return wrapHtml(blocks.join(''));
}
