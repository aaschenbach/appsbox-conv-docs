export {};

declare const JSZip: {
  new (): JSZipInstance;
  loadAsync(data: ArrayBuffer | Uint8Array): Promise<JSZipInstance>;
};
interface JSZipFile { async(type: 'string'): Promise<string> }
interface JSZipInstance {
  file(path: string): JSZipFile | null;
  file(path: string, content: string): void;
  generateAsync(options: { type: 'uint8array' }): Promise<Uint8Array>;
}

export type RunFlags = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean };
export type RunPart =
  | { kind: 'text'; text: string; flags: RunFlags }
  | { kind: 'break' }
  | { kind: 'hyperlink'; href: string; parts: RunPart[] };

// ---------------------------------------------------------------------------
// Opções de saída DOCX (ver painel "Opções de saída"). Todos os campos têm
// default; chamadas sem `options` produzem o layout atual (Calibri 11, A4).
// ---------------------------------------------------------------------------
export type DocxFontFamily = 'Calibri' | 'Arial' | 'Georgia' | 'Times New Roman';
export type DocxPageSize = 'a4' | 'letter';
export type DocxMargins = 'narrow' | 'normal' | 'wide';
export interface DocxOptions {
  fontFamily: DocxFontFamily;
  baseSize: number; // pt do corpo (9–14)
  pageSize: DocxPageSize;
  margins: DocxMargins;
}
export const DEFAULT_DOCX_OPTIONS: DocxOptions = {
  fontFamily: 'Calibri',
  baseSize: 11,
  pageSize: 'a4',
  margins: 'normal',
};
function resolveDocxOptions(partial?: Partial<DocxOptions>): DocxOptions {
  const o = { ...DEFAULT_DOCX_OPTIONS, ...(partial ?? {}) };
  o.baseSize = Math.min(14, Math.max(9, o.baseSize || DEFAULT_DOCX_OPTIONS.baseSize));
  return o;
}
const DOCX_PAGE_TWIPS: Record<DocxPageSize, { w: number; h: number }> = {
  a4: { w: 11906, h: 16838 },
  letter: { w: 12240, h: 15840 },
};
const DOCX_MARGIN_TWIPS: Record<DocxMargins, number> = { narrow: 720, normal: 1417, wide: 1800 };

const CONTENT_TYPES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';

const PACKAGE_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';

function stylesXml(opts: DocxOptions): string {
  const base = Math.round(opts.baseSize * 2); // meio-pontos
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${xmlEscape(opts.fontFamily)}" w:hAnsi="${xmlEscape(opts.fontFamily)}"/><w:sz w:val="${base}"/></w:rPr></w:rPrDefault></w:docDefaults>` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    [1, 2, 3, 4, 5, 6].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${Math.max(base, base + 18 - (level - 1) * 4)}"/></w:rPr></w:style>`).join('') +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>' +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
    '</w:styles>';
}

const NUMBERING_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '</w:numbering>';

const APP_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AppsBox Conversor de Documentos</Application></Properties>';

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function coreXml(): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>AppsBox Conversor de Documentos</dc:creator><cp:lastModifiedBy>AppsBox Conversor de Documentos</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

class RelBuilder {
  private rels: { id: string; target: string }[] = [];
  private next = 3;
  addHyperlink(target: string): string {
    const id = `rId${this.next}`;
    this.next += 1;
    this.rels.push({ id, target });
    return id;
  }
  toXml(): string {
    const items = this.rels.map((rel) => `<Relationship Id="${rel.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(rel.target)}" TargetMode="External"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${items}</Relationships>`;
  }
}

export function collectRuns(node: Node, flags: RunFlags): RunPart[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    return text ? [{ kind: 'text', text, flags }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === 'br') return [{ kind: 'break' }];
  const nextFlags: RunFlags = { ...flags };
  if (tag === 'strong' || tag === 'b') nextFlags.bold = true;
  if (tag === 'em' || tag === 'i') nextFlags.italic = true;
  if (tag === 'u') nextFlags.underline = true;
  if (tag === 'del' || tag === 's' || tag === 'strike') nextFlags.strike = true;
  if (tag === 'code') nextFlags.code = true;
  const children = Array.from(element.childNodes).flatMap((child) => collectRuns(child, nextFlags));
  if (tag === 'a') {
    const href = element.getAttribute('href') ?? '';
    if (/^(?:https?:|mailto:)/i.test(href)) return [{ kind: 'hyperlink', href, parts: children }];
  }
  return children;
}

function runPropsXml(flags: RunFlags, hyperlink = false): string {
  const parts: string[] = [];
  if (hyperlink) parts.push('<w:rStyle w:val="Hyperlink"/>');
  if (flags.code) parts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  if (flags.bold) parts.push('<w:b/>');
  if (flags.italic) parts.push('<w:i/>');
  if (flags.underline) parts.push('<w:u w:val="single"/>');
  if (flags.strike) parts.push('<w:strike/>');
  return parts.length ? `<w:rPr>${parts.join('')}</w:rPr>` : '';
}
function textRunXml(text: string, flags: RunFlags, hyperlink = false): string {
  const rPr = runPropsXml(flags, hyperlink);
  const segments = text.split('\t');
  const body = segments.map((segment, index) => (index ? '<w:tab/>' : '') + (segment ? `<w:t xml:space="preserve">${xmlEscape(segment)}</w:t>` : '')).join('');
  return `<w:r>${rPr}${body}</w:r>`;
}
function partsXml(parts: RunPart[], rels: RelBuilder): string {
  return parts.map((part) => {
    if (part.kind === 'break') return '<w:r><w:br/></w:r>';
    if (part.kind === 'text') return textRunXml(part.text, part.flags);
    const id = rels.addHyperlink(part.href);
    const inner = part.parts.map((piece) => (piece.kind === 'text' ? textRunXml(piece.text, piece.flags, true) : piece.kind === 'break' ? '<w:r><w:br/></w:r>' : '')).join('');
    return `<w:hyperlink r:id="${id}">${inner}</w:hyperlink>`;
  }).join('');
}
function paragraphXml(parts: RunPart[], rels: RelBuilder, pPr = ''): string {
  return `<w:p>${pPr}${partsXml(parts, rels)}</w:p>`;
}

function visitBlock(node: Node, blocks: string[], rels: RelBuilder): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const heading = tag.match(/^h([1-6])$/);
  if (heading) { blocks.push(paragraphXml(collectRuns(element, {}), rels, `<w:pPr><w:pStyle w:val="Heading${heading[1]}"/></w:pPr>`)); return; }
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main') {
    const parts = collectRuns(element, {});
    if (parts.length) blocks.push(paragraphXml(parts, rels));
    return;
  }
  if (tag === 'pre') {
    const lines = (element.textContent ?? '').replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((line) => blocks.push(paragraphXml(line ? [{ kind: 'text', text: line, flags: { code: true } }] : [], rels)));
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol';
    Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li').forEach((item) => {
      blocks.push(paragraphXml(collectRuns(item, {}), rels, `<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${ordered ? 2 : 1}"/></w:numPr></w:pPr>`));
    });
    return;
  }
  if (tag === 'blockquote') {
    const parts = collectRuns(element, {});
    if (parts.length) blocks.push(paragraphXml(parts, rels, '<w:pPr><w:ind w:left="720"/></w:pPr>'));
    return;
  }
  if (tag === 'hr') { blocks.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>'); return; }
  if (tag === 'table') {
    const rows = Array.from(element.querySelectorAll('tr'));
    if (rows.length) {
      const rowsXml = rows.map((row) => {
        const cells = Array.from(row.children).map((cell) => {
          const isHeader = cell.tagName.toLowerCase() === 'th';
          const parts = collectRuns(cell, isHeader ? { bold: true } : {});
          const cellParagraph = parts.length ? paragraphXml(parts, rels) : '<w:p/>';
          return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${cellParagraph}</w:tc>`;
        }).join('');
        return `<w:tr>${cells}</w:tr>`;
      }).join('');
      blocks.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>${rowsXml}</w:tbl>`);
    }
    return;
  }
  Array.from(element.children).forEach((child) => visitBlock(child, blocks, rels));
}

function htmlToDocumentXml(html: string, opts: DocxOptions): { documentXml: string; relsXml: string } {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const rels = new RelBuilder();
  const blocks: string[] = [];
  Array.from(parsed.body.children).forEach((child) => visitBlock(child, blocks, rels));
  if (!blocks.length) {
    const parts = collectRuns(parsed.body, {});
    if (parts.length) blocks.push(paragraphXml(parts, rels));
  }
  const page = DOCX_PAGE_TWIPS[opts.pageSize];
  const m = DOCX_MARGIN_TWIPS[opts.margins];
  const sectPr = `<w:sectPr><w:pgSz w:w="${page.w}" w:h="${page.h}"/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${blocks.join('')}${sectPr}</w:body></w:document>`;
  return { documentXml, relsXml: rels.toXml() };
}

export async function htmlToDocxBytes(html: string, options?: Partial<DocxOptions>): Promise<Uint8Array> {
  const opts = resolveDocxOptions(options);
  const { documentXml, relsXml } = htmlToDocumentXml(html, opts);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', PACKAGE_RELS_XML);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', relsXml);
  zip.file('word/styles.xml', stylesXml(opts));
  zip.file('word/numbering.xml', NUMBERING_XML);
  zip.file('docProps/core.xml', coreXml());
  zip.file('docProps/app.xml', APP_XML);
  return zip.generateAsync({ type: 'uint8array' });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
function parseRelMap(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml) return map;
  const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
  Array.from(doc.getElementsByTagName('Relationship')).forEach((rel) => {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) map.set(id, target);
  });
  return map;
}
function parseNumFmtMap(numberingXml: string): Map<string, 'bullet' | 'ordered'> {
  const map = new Map<string, 'bullet' | 'ordered'>();
  if (!numberingXml) return map;
  const doc = new DOMParser().parseFromString(numberingXml, 'application/xml');
  const abstractFmt = new Map<string, 'bullet' | 'ordered'>();
  Array.from(doc.getElementsByTagName('w:abstractNum')).forEach((abstractNum) => {
    const id = abstractNum.getAttribute('w:abstractNumId');
    const levels = Array.from(abstractNum.getElementsByTagName('w:lvl'));
    const level = levels.find((lvl) => lvl.getAttribute('w:ilvl') === '0') ?? levels[0];
    const numFmt = level?.getElementsByTagName('w:numFmt')[0]?.getAttribute('w:val') ?? 'bullet';
    if (id) abstractFmt.set(id, /decimal|roman|letter/i.test(numFmt) ? 'ordered' : 'bullet');
  });
  Array.from(doc.getElementsByTagName('w:num')).forEach((num) => {
    const numId = num.getAttribute('w:numId');
    const abstractId = num.getElementsByTagName('w:abstractNumId')[0]?.getAttribute('w:val');
    const format = abstractId ? abstractFmt.get(abstractId) : undefined;
    if (numId && format) map.set(numId, format);
  });
  return map;
}
function flagOn(rPr: Element | null, tag: string): boolean {
  if (!rPr) return false;
  const el = rPr.getElementsByTagName(tag)[0];
  if (!el) return false;
  const val = el.getAttribute('w:val');
  return val !== '0' && val !== 'false' && val !== 'none';
}
function runHtml(runEl: Element): string {
  const rPr = runEl.getElementsByTagName('w:rPr')[0] ?? null;
  const bold = flagOn(rPr, 'w:b');
  const italic = flagOn(rPr, 'w:i');
  const underline = flagOn(rPr, 'w:u');
  const strike = flagOn(rPr, 'w:strike');
  let text = '';
  Array.from(runEl.childNodes).forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'w:t') text += escapeHtml(el.textContent ?? '');
    else if (tag === 'w:br') text += '<br>';
    else if (tag === 'w:tab') text += '\t';
  });
  if (!text) return '';
  if (bold) text = `<strong>${text}</strong>`;
  if (italic) text = `<em>${text}</em>`;
  if (underline) text = `<u>${text}</u>`;
  if (strike) text = `<del>${text}</del>`;
  return text;
}
function paragraphInlineHtml(pEl: Element, relMap: Map<string, string>): string {
  let html = '';
  Array.from(pEl.childNodes).forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'w:r') html += runHtml(el);
    else if (tag === 'w:hyperlink') {
      const rId = el.getAttribute('r:id');
      const href = rId ? relMap.get(rId) : undefined;
      const inner = Array.from(el.getElementsByTagName('w:r')).map(runHtml).join('');
      html += href && /^(?:https?:|mailto:)/i.test(href) ? `<a href="${escapeAttr(href)}">${inner}</a>` : inner;
    }
  });
  return html;
}
function paragraphStyle(pEl: Element): string | null {
  const pPr = pEl.getElementsByTagName('w:pPr')[0];
  return pPr?.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? null;
}
function paragraphListType(pEl: Element, numFmtMap: Map<string, 'bullet' | 'ordered'>, style: string | null): 'bullet' | 'ordered' | null {
  const pPr = pEl.getElementsByTagName('w:pPr')[0];
  const numId = pPr?.getElementsByTagName('w:numPr')[0]?.getElementsByTagName('w:numId')[0]?.getAttribute('w:val');
  if (numId) return numFmtMap.get(numId) ?? 'bullet';
  if (style && /^ListNumber/i.test(style)) return 'ordered';
  if (style && /^ListBullet/i.test(style)) return 'bullet';
  return null;
}

export async function docxToHtml(source: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(source);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) throw new Error('invalid_docx');
  const documentXml = await documentEntry.async('string');
  const relsEntry = zip.file('word/_rels/document.xml.rels');
  const relsXml = relsEntry ? await relsEntry.async('string') : '';
  const numberingEntry = zip.file('word/numbering.xml');
  const numberingXml = numberingEntry ? await numberingEntry.async('string') : '';
  const relMap = parseRelMap(relsXml);
  const numFmtMap = parseNumFmtMap(numberingXml);
  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  const body = doc.getElementsByTagName('w:body')[0] as Element | undefined;
  const blocks: string[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  const flushList = (): void => {
    if (listBuffer) {
      const buffered = listBuffer;
      if (buffered.items.length) {
        const tag = buffered.ordered ? 'ol' : 'ul';
        blocks.push(`<${tag}>${buffered.items.map((item) => `<li>${item}</li>`).join('')}</${tag}>`);
      }
    }
    listBuffer = null;
  };
  Array.from(body ? body.children : []).forEach((child) => {
    const tag = child.tagName.toLowerCase();
    if (tag === 'w:tbl') {
      flushList();
      const rows = Array.from(child.getElementsByTagName('w:tr'));
      const rowsHtml = rows.map((row) => {
        const cells = Array.from(row.getElementsByTagName('w:tc')).map((cell) => {
          const inner = Array.from(cell.getElementsByTagName('w:p')).map((p) => paragraphInlineHtml(p, relMap)).join('<br>');
          return `<td>${inner}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      if (rowsHtml) blocks.push(`<table>${rowsHtml}</table>`);
      return;
    }
    if (tag !== 'w:p') return;
    const style = paragraphStyle(child);
    const listType = paragraphListType(child, numFmtMap, style);
    const inline = paragraphInlineHtml(child, relMap);
    if (listType) {
      const ordered = listType === 'ordered';
      if (!listBuffer || listBuffer.ordered !== ordered) { flushList(); listBuffer = { ordered, items: [] }; }
      if (inline) listBuffer.items.push(inline);
      return;
    }
    flushList();
    const heading = style?.match(/^Heading([1-6])$/);
    if (heading) { if (inline) blocks.push(`<h${heading[1]}>${inline}</h${heading[1]}>`); return; }
    if (style === 'Title') { if (inline) blocks.push(`<h1>${inline}</h1>`); return; }
    if (inline) blocks.push(`<p>${inline}</p>`);
  });
  flushList();
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body>${blocks.join('')}</body></html>`;
}
