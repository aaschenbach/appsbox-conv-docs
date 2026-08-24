export {};

import { collectRuns, type RunFlags, type RunPart } from './docx.js';

// Gravação: gerador PDF próprio, sem embutir fontes — usa as 4 variantes de
// Courier (fonte padrão nº14, monoespaçada, sempre disponível em qualquer
// leitor PDF) para poder calcular quebra de linha por contagem de caracteres
// em vez de uma tabela de largura por glifo. Isso troca um layout
// proporcional "bonito" por um layout monoespaçado correto e previsível.
// Leitura: usa pdf.js (Apache-2.0, vendorizado em public/vendor/pdfjs/,
// carregado sob demanda) só para extrair texto corrido — títulos, listas,
// tabelas e links do PDF de origem não são reconstruídos.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56.7;
const USABLE_W = PAGE_W - MARGIN * 2;
const CHAR_ADVANCE = 0.6; // Courier: 600/1000 em, igual para regular/negrito/itálico

type Char = { ch: string; flags: RunFlags };
type Block =
  | { kind: 'heading'; level: number; parts: RunPart[] }
  | { kind: 'paragraph'; parts: RunPart[] }
  | { kind: 'listitem'; prefix: string; parts: RunPart[] }
  | { kind: 'table-row'; cells: RunPart[][] }
  | { kind: 'rule' };

function visitBlocks(node: Node, blocks: Block[]): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const heading = tag.match(/^h([1-6])$/);
  if (heading) { blocks.push({ kind: 'heading', level: Number(heading[1]), parts: collectRuns(element, {}) }); return; }
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main') {
    const parts = collectRuns(element, {});
    if (parts.length) blocks.push({ kind: 'paragraph', parts });
    return;
  }
  if (tag === 'pre') {
    (element.textContent ?? '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
      blocks.push({ kind: 'paragraph', parts: line ? [{ kind: 'text', text: line, flags: { code: true } }] : [] });
    });
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol';
    Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li').forEach((item, index) => {
      blocks.push({ kind: 'listitem', prefix: ordered ? `${index + 1}. ` : '- ', parts: collectRuns(item, {}) });
    });
    return;
  }
  if (tag === 'blockquote') {
    const parts = collectRuns(element, {});
    if (parts.length) blocks.push({ kind: 'listitem', prefix: '> ', parts });
    return;
  }
  if (tag === 'hr') { blocks.push({ kind: 'rule' }); return; }
  if (tag === 'table') {
    Array.from(element.querySelectorAll('tr')).forEach((row) => {
      const cells = Array.from(row.children).map((cell) => collectRuns(cell, cell.tagName.toLowerCase() === 'th' ? { bold: true } : {}));
      blocks.push({ kind: 'table-row', cells });
    });
    return;
  }
  Array.from(element.children).forEach((child) => visitBlocks(child, blocks));
}

function flattenChars(parts: RunPart[]): Char[] {
  const chars: Char[] = [];
  parts.forEach((part) => {
    if (part.kind === 'text') for (const ch of part.text) chars.push({ ch, flags: part.flags });
    else if (part.kind === 'break') chars.push({ ch: '\n', flags: {} });
    else if (part.kind === 'hyperlink') chars.push(...flattenChars(part.parts));
  });
  return chars;
}

function wrapChars(chars: Char[], maxChars: number): Char[][] {
  const lines: Char[][] = [];
  let line: Char[] = [];
  let lastSpace = -1;
  chars.forEach((c) => {
    if (c.ch === '\n') { lines.push(line); line = []; lastSpace = -1; return; }
    line.push(c);
    if (c.ch === ' ') lastSpace = line.length - 1;
    if (line.length > maxChars) {
      if (lastSpace > 0) { lines.push(line.slice(0, lastSpace)); line = line.slice(lastSpace + 1); }
      else { lines.push(line.slice(0, maxChars)); line = line.slice(maxChars); }
      lastSpace = -1;
    }
  });
  lines.push(line);
  return lines;
}

function sameFlags(a: RunFlags, b: RunFlags): boolean {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic;
}
function lineRuns(line: Char[]): { text: string; flags: RunFlags }[] {
  const runs: { text: string; flags: RunFlags }[] = [];
  line.forEach((c) => {
    const last = runs[runs.length - 1];
    if (last && sameFlags(last.flags, c.flags)) last.text += c.ch;
    else runs.push({ text: c.ch, flags: { ...c.flags } });
  });
  return runs;
}
function fontNameFor(flags: RunFlags): 'FR' | 'FB' | 'FI' | 'FBI' {
  if (flags.bold && flags.italic) return 'FBI';
  if (flags.bold) return 'FB';
  if (flags.italic) return 'FI';
  return 'FR';
}

const WINANSI_REMAP: Record<number, number> = { 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2013: 150, 0x2014: 151, 0x2022: 149, 0x2026: 133 };
function toWinAnsiByteString(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    out += String.fromCharCode(cp <= 0xff ? cp : WINANSI_REMAP[cp] ?? 63);
  }
  return out;
}
function pdfEscape(byteString: string): string {
  return byteString.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class PdfWriter {
  private objects: (string | null)[] = [null];
  addObject(body: string): number {
    this.objects.push(body);
    return this.objects.length - 1;
  }
  setObject(id: number, body: string): void {
    this.objects[id] = body;
  }
  build(rootId: number): Uint8Array {
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [0];
    for (let id = 1; id < this.objects.length; id += 1) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${this.objects[id]}\nendobj\n`;
    }
    const xrefOffset = out.length;
    out += `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < this.objects.length; id += 1) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${this.objects.length} /Root ${rootId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}

export async function htmlToPdfBytes(html: string): Promise<Uint8Array> {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  Array.from(parsed.body.children).forEach((child) => visitBlocks(child, blocks));
  if (!blocks.length) {
    const parts = collectRuns(parsed.body, {});
    if (parts.length) blocks.push({ kind: 'paragraph', parts });
  }

  type RenderLine = { size: number; runs: { text: string; flags: RunFlags }[] };
  const pages: RenderLine[][] = [[]];
  let cursorY = PAGE_H - MARGIN;
  const lineHeight = (size: number): number => size * 1.25;
  const ensureSpace = (size: number): void => {
    if (cursorY - lineHeight(size) < MARGIN) { pages.push([]); cursorY = PAGE_H - MARGIN; }
  };
  const emitLine = (size: number, runs: { text: string; flags: RunFlags }[]): void => {
    ensureSpace(size);
    pages[pages.length - 1].push({ size, runs });
    cursorY -= lineHeight(size);
  };
  const emitWrapped = (parts: RunPart[], size: number, prefix = ''): void => {
    const chars = flattenChars(parts);
    if (prefix) chars.unshift(...Array.from(prefix, (ch) => ({ ch, flags: {} as RunFlags })));
    const maxChars = Math.max(8, Math.floor(USABLE_W / (size * CHAR_ADVANCE)));
    wrapChars(chars, maxChars).forEach((line) => emitLine(size, lineRuns(line)));
  };

  blocks.forEach((block) => {
    if (block.kind === 'heading') {
      const size = Math.max(12, 18 - (block.level - 1) * 1.4);
      const boldParts = block.parts.map((part) => (part.kind === 'text' ? { ...part, flags: { ...part.flags, bold: true } } : part));
      emitWrapped(boldParts, size);
      cursorY -= 4;
    } else if (block.kind === 'paragraph') {
      emitWrapped(block.parts, 11);
      cursorY -= 4;
    } else if (block.kind === 'listitem') {
      emitWrapped(block.parts, 11, block.prefix);
      cursorY -= 2;
    } else if (block.kind === 'table-row') {
      const parts: RunPart[] = [];
      block.cells.forEach((cell, index) => {
        if (index) parts.push({ kind: 'text', text: ' | ', flags: {} });
        parts.push(...cell);
      });
      emitWrapped(parts, 10);
    } else if (block.kind === 'rule') {
      ensureSpace(11);
      pages[pages.length - 1].push({ size: 0, runs: [] });
      cursorY -= 8;
    }
  });

  const writer = new PdfWriter();
  const fontRegular = writer.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const fontBold = writer.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');
  const fontItalic = writer.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Oblique /Encoding /WinAnsiEncoding >>');
  const fontBoldItalic = writer.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-BoldOblique /Encoding /WinAnsiEncoding >>');
  const resources = writer.addObject(`<< /Font << /FR ${fontRegular} 0 R /FB ${fontBold} 0 R /FI ${fontItalic} 0 R /FBI ${fontBoldItalic} 0 R >> >>`);
  const pagesId = writer.addObject('');
  const catalog = writer.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const pageIds: number[] = [];
  pages.forEach((linesOnPage) => {
    let y = PAGE_H - MARGIN;
    let content = '';
    linesOnPage.forEach((line) => {
      if (line.size === 0) {
        content += `q 0.6 0.6 0.6 rg ${MARGIN} ${(y - 4).toFixed(2)} ${USABLE_W.toFixed(2)} 0.75 re f Q `;
        y -= lineHeight(11);
        return;
      }
      content += `BT ${MARGIN} ${y.toFixed(2)} Td `;
      let x = MARGIN;
      line.runs.forEach((run) => {
        content += `/${fontNameFor(run.flags)} ${line.size} Tf (${pdfEscape(toWinAnsiByteString(run.text))}) Tj `;
        const width = run.text.length * line.size * CHAR_ADVANCE;
        if (run.flags.underline) content += `q 0 0 0 rg ${x.toFixed(2)} ${(y - 1.5).toFixed(2)} ${width.toFixed(2)} 0.5 re f Q `;
        if (run.flags.strike) content += `q 0 0 0 rg ${x.toFixed(2)} ${(y + line.size * 0.3).toFixed(2)} ${width.toFixed(2)} 0.5 re f Q `;
        x += width;
      });
      content += 'ET ';
      y -= lineHeight(line.size);
    });
    const contentId = writer.addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = writer.addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${resources} 0 R /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  writer.setObject(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);

  return writer.build(catalog);
}

// `new Function` evita que o TypeScript tente resolver o caminho estático
// como um módulo do projeto — é um asset público, carregado só quando o
// usuário efetivamente converte um PDF.
const importModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

export async function pdfToText(source: ArrayBuffer | Uint8Array): Promise<string> {
  const pdfjsLib = await importModule('/vendor/pdfjs/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const loadingTask = pdfjsLib.getDocument({ data, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/' });
  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : item.str.endsWith(' ') || item.str === '' ? '' : ' ';
    }
    pageTexts.push(text.replace(/[ \t]+\n/g, '\n').trim());
    page.cleanup();
  }
  await doc.destroy();
  return pageTexts.filter((text) => text.length > 0).join('\n\n');
}
