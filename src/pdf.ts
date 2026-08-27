export {};

import { collectRuns, type RunFlags, type RunPart } from './docx.js';
import { AFM_WIDTHS, type AfmFontKey } from './afm-widths.js';

// Gravação: gerador PDF próprio, sem embutir fontes — usa as fontes padrão nº 14
// (Helvetica, Times ou Courier, sempre presentes em qualquer leitor PDF) e as
// tabelas de largura de glifo AFM da Adobe (src/afm-widths.ts, geradas por
// scripts/build-afm.mjs) para fazer quebra de linha e justificação
// proporcionais. Não é uma réplica visual do documento de origem, mas é um
// layout tipográfico de verdade: fonte proporcional, hierarquia de títulos,
// número de página e links clicáveis. Código (`code`/`<pre>`) fica sempre em
// Courier, independente da família do corpo. Codificação WinAnsi (sem Unicode
// além de cp1252).
// Leitura: usa pdf.js (Apache-2.0, vendorizado em public/vendor/pdfjs/,
// carregado sob demanda) só para extrair texto corrido — títulos, listas,
// tabelas e links do PDF de origem não são reconstruídos.

// ---------------------------------------------------------------------------
// Opções de saída (ver painel "Opções de saída" na interface). Todos os campos
// têm default; chamadas sem `options` produzem o layout recomendado.
// ---------------------------------------------------------------------------
export type PdfFontFamily = 'sans' | 'serif' | 'mono';
export type PdfPageSize = 'a4' | 'letter';
export type PdfMargins = 'narrow' | 'normal' | 'wide';
export interface PdfOptions {
  fontFamily: PdfFontFamily;
  baseSize: number; // pt do corpo (8–16)
  lineSpacing: number; // multiplicador de entrelinha do corpo (1–2)
  pageSize: PdfPageSize;
  margins: PdfMargins;
  pageNumbers: boolean;
  justify: boolean;
}
export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  fontFamily: 'sans',
  baseSize: 11,
  lineSpacing: 1.45,
  pageSize: 'a4',
  margins: 'normal',
  pageNumbers: true,
  justify: false,
};
function resolveOptions(partial?: Partial<PdfOptions>): PdfOptions {
  const o = { ...DEFAULT_PDF_OPTIONS, ...(partial ?? {}) };
  o.baseSize = Math.min(16, Math.max(8, o.baseSize || DEFAULT_PDF_OPTIONS.baseSize));
  o.lineSpacing = Math.min(2, Math.max(1, o.lineSpacing || DEFAULT_PDF_OPTIONS.lineSpacing));
  return o;
}

const PAGE_DIMS: Record<PdfPageSize, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};
const MARGIN_PT: Record<PdfMargins, number> = { narrow: 36, normal: 56.7, wide: 85 };

const CELL_PAD = 4;
const HEADING_COLOR = '0.063 0.165 0.259'; // #102a43, cor de marca (H1/H2)

// ---------------------------------------------------------------------------
// Seleção de fonte e medição
// ---------------------------------------------------------------------------
type Variant = 'r' | 'b' | 'i' | 'bi';
const FAMILY_AFM: Record<PdfFontFamily, Record<Variant, AfmFontKey>> = {
  sans: { r: 'helv', b: 'helv-b', i: 'helv-i', bi: 'helv-bi' },
  serif: { r: 'times', b: 'times-b', i: 'times-i', bi: 'times-bi' },
  mono: { r: 'cour', b: 'cour-b', i: 'cour-i', bi: 'cour-bi' },
};
const AFM_BASEFONT: Record<AfmFontKey, string> = {
  helv: 'Helvetica', 'helv-b': 'Helvetica-Bold', 'helv-i': 'Helvetica-Oblique', 'helv-bi': 'Helvetica-BoldOblique',
  times: 'Times-Roman', 'times-b': 'Times-Bold', 'times-i': 'Times-Italic', 'times-bi': 'Times-BoldItalic',
  cour: 'Courier', 'cour-b': 'Courier-Bold', 'cour-i': 'Courier-Oblique', 'cour-bi': 'Courier-BoldOblique',
};
const BODY_RES: Record<Variant, string> = { r: 'FR', b: 'FB', i: 'FI', bi: 'FBI' };
const MONO_RES: Record<Variant, string> = { r: 'CR', b: 'CB', i: 'CI', bi: 'CBI' };

function variantFor(flags: RunFlags): Variant {
  if (flags.bold && flags.italic) return 'bi';
  if (flags.bold) return 'b';
  if (flags.italic) return 'i';
  return 'r';
}
function pickFont(flags: RunFlags, family: PdfFontFamily): { res: string; afm: AfmFontKey } {
  const v = variantFor(flags);
  if (flags.code) return { res: MONO_RES[v], afm: FAMILY_AFM.mono[v] };
  return { res: BODY_RES[v], afm: FAMILY_AFM[family][v] };
}

const WINANSI_REMAP: Record<number, number> = { 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2013: 150, 0x2014: 151, 0x2022: 149, 0x2026: 133 };
function winAnsiCode(cp: number): number {
  return cp <= 0xff ? cp : WINANSI_REMAP[cp] ?? 63;
}
function charWidth(cp: number, afm: AfmFontKey, size: number): number {
  const widths = AFM_WIDTHS[afm];
  const w = widths[winAnsiCode(cp)] || widths[63] || 500;
  return (w / 1000) * size;
}
function measure(text: string, afm: AfmFontKey, size: number): number {
  let sum = 0;
  for (const ch of text) sum += charWidth(ch.codePointAt(0) ?? 63, afm, size);
  return sum;
}

// ---------------------------------------------------------------------------
// Blocos (mesma árvore de antes)
// ---------------------------------------------------------------------------
type Char = { ch: string; flags: RunFlags; href?: string };
type Block =
  | { kind: 'heading'; level: number; parts: RunPart[] }
  | { kind: 'paragraph'; parts: RunPart[] }
  | { kind: 'listitem'; prefix: string; parts: RunPart[] }
  | { kind: 'table'; rows: { header: boolean; cells: RunPart[][] }[] }
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
      blocks.push({ kind: 'listitem', prefix: ordered ? `${index + 1}. ` : '• ', parts: collectRuns(item, {}) });
    });
    return;
  }
  if (tag === 'blockquote') {
    const parts = collectRuns(element, {});
    if (parts.length) blocks.push({ kind: 'listitem', prefix: '— ', parts });
    return;
  }
  if (tag === 'hr') { blocks.push({ kind: 'rule' }); return; }
  if (tag === 'table') {
    const rows = Array.from(element.querySelectorAll('tr')).map((row) => ({
      header: Array.from(row.children).some((cell) => cell.tagName.toLowerCase() === 'th'),
      cells: Array.from(row.children).map((cell) => collectRuns(cell, cell.tagName.toLowerCase() === 'th' ? { bold: true } : {})),
    }));
    if (rows.length) blocks.push({ kind: 'table', rows });
    return;
  }
  Array.from(element.children).forEach((child) => visitBlocks(child, blocks));
}

function flattenChars(parts: RunPart[], href?: string): Char[] {
  const chars: Char[] = [];
  parts.forEach((part) => {
    if (part.kind === 'text') for (const ch of part.text) chars.push({ ch, flags: part.flags, href });
    else if (part.kind === 'break') chars.push({ ch: '\n', flags: {} });
    else if (part.kind === 'hyperlink') chars.push(...flattenChars(part.parts, part.href || href));
  });
  return chars;
}

// Quebra por largura medida. Continua quebrando em espaço; token único mais
// largo que a linha é cortado à força, caractere a caractere.
function wrapChars(chars: Char[], maxWidth: number, family: PdfFontFamily, size: number): Char[][] {
  const lines: Char[][] = [];
  let line: Char[] = [];
  const w = (c: Char): number => charWidth(c.ch.codePointAt(0) ?? 63, pickFont(c.flags, family).afm, size);
  const lineWidth = (): number => line.reduce((s, c) => s + w(c), 0);
  const lastSpaceIndex = (): number => { for (let i = line.length - 1; i >= 0; i -= 1) if (line[i].ch === ' ') return i; return -1; };
  for (const c of chars) {
    if (c.ch === '\n') { lines.push(line); line = []; continue; }
    line.push(c);
    if (lineWidth() > maxWidth && line.length > 1) {
      const at = lastSpaceIndex();
      if (at > 0 && at < line.length - 1) {
        lines.push(line.slice(0, at));
        line = line.slice(at + 1);
      } else {
        const last = line.pop() as Char;
        lines.push(line);
        line = [last];
      }
    }
  }
  lines.push(line);
  return lines;
}

function sameRun(a: LineRun, b: Char): boolean {
  return !!a.flags.bold === !!b.flags.bold && !!a.flags.italic === !!b.flags.italic
    && !!a.flags.code === !!b.flags.code && !!a.flags.underline === !!b.flags.underline
    && !!a.flags.strike === !!b.flags.strike && (a.href ?? '') === (b.href ?? '');
}
type LineRun = { text: string; flags: RunFlags; href?: string };
function lineRuns(line: Char[]): LineRun[] {
  const runs: LineRun[] = [];
  line.forEach((c) => {
    const last = runs[runs.length - 1];
    if (last && sameRun(last, c)) last.text += c.ch;
    else runs.push({ text: c.ch, flags: { ...c.flags }, href: c.href });
  });
  return runs;
}

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

type TextItem = {
  kind: 'text';
  size: number;
  runs: LineRun[];
  x: number; // deslocamento a partir da margem esquerda
  wordSpacing: number; // Tw para justificação (0 = sem)
  color?: string; // "r g b" para títulos coloridos
  marker?: string; // marcador de lista desenhado em x=0
};
type RenderItem =
  | TextItem
  | { kind: 'rule' }
  | { kind: 'gap'; height: number }
  | { kind: 'table-row'; header: boolean; colWidths: number[]; cellLineLists: LineRun[][][]; rowHeight: number };
type LinkRect = { x0: number; y0: number; x1: number; y1: number; href: string };

export async function htmlToPdfBytes(html: string, options?: Partial<PdfOptions>): Promise<Uint8Array> {
  const opts = resolveOptions(options);
  const family = opts.fontFamily;
  const bodyAfm = FAMILY_AFM[family].r;
  const PAGE_W = PAGE_DIMS[opts.pageSize].w;
  const PAGE_H = PAGE_DIMS[opts.pageSize].h;
  const MARGIN = MARGIN_PT[opts.margins];
  const USABLE_W = PAGE_W - MARGIN * 2;
  const BASE = opts.baseSize;
  const TABLE_FONT_SIZE = Math.max(7, BASE - 2);

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  Array.from(parsed.body.children).forEach((child) => visitBlocks(child, blocks));
  if (!blocks.length) {
    const parts = collectRuns(parsed.body, {});
    if (parts.length) blocks.push({ kind: 'paragraph', parts });
  }

  const pages: RenderItem[][] = [[]];
  let cursorY = PAGE_H - MARGIN;
  const bodyLineHeight = (size: number): number => size * opts.lineSpacing;
  const headingLineHeight = (size: number): number => size * 1.2;
  const ensureSpace = (height: number): void => {
    if (cursorY - height < MARGIN) { pages.push([]); cursorY = PAGE_H - MARGIN; }
  };
  const emitGap = (height: number): void => {
    ensureSpace(height);
    cursorY -= height;
  };
  const push = (item: RenderItem): void => { pages[pages.length - 1].push(item); };

  const headingSize = (level: number): number => BASE * [2.0, 1.55, 1.27, 1.09, 1.09, 1.09][level - 1];
  const headingSpaceBefore = (level: number): number => [14, 12, 10, 8, 8, 8][level - 1];

  // Emite um bloco de texto com quebra proporcional. `indent` desloca todas as
  // linhas (recuo pendente de lista). `marker`, se dado, é desenhado em x=0 na
  // primeira linha. `justify` só se aplica a linhas que não são a última.
  const emitTextBlock = (
    parts: RunPart[],
    size: number,
    lh: (s: number) => number,
    o: { indent?: number; marker?: string; color?: string; justify?: boolean } = {},
  ): void => {
    const indent = o.indent ?? 0;
    const chars = flattenChars(parts);
    const maxWidth = USABLE_W - indent;
    const lines = wrapChars(chars, maxWidth, family, size);
    lines.forEach((lineChars, index) => {
      ensureSpace(lh(size));
      const runs = lineRuns(lineChars);
      let wordSpacing = 0;
      if (o.justify && index < lines.length - 1) {
        const lineWidth = runs.reduce((s, r) => s + measure(r.text, pickFont(r.flags, family).afm, size), 0);
        const spaces = lineChars.filter((c) => c.ch === ' ').length;
        const slack = maxWidth - lineWidth;
        if (spaces > 0 && slack > 0 && slack / spaces < size * 0.6) wordSpacing = slack / spaces;
      }
      push({
        kind: 'text',
        size,
        runs,
        x: indent,
        wordSpacing,
        color: o.color,
        marker: index === 0 ? o.marker : undefined,
      });
      cursorY -= lh(size);
    });
  };

  const emitTable = (rows: { header: boolean; cells: RunPart[][] }[]): void => {
    const columns = Math.max(1, ...rows.map((row) => row.cells.length));
    const lens = new Array(columns).fill(3);
    rows.forEach((row) => row.cells.forEach((cell, i) => {
      const text = flattenChars(cell).map((c) => c.ch).join('');
      lens[i] = Math.max(lens[i], Math.min(text.length, 40));
    }));
    const total = lens.reduce((a, b) => a + b, 0);
    const minWidth = 50;
    let colWidths = lens.map((l) => Math.max(minWidth, (USABLE_W * l) / total));
    const sumW = colWidths.reduce((a, b) => a + b, 0);
    if (sumW > USABLE_W) colWidths = colWidths.map((w) => (w * USABLE_W) / sumW);

    rows.forEach((row) => {
      const cellLineLists = colWidths.map((width, i) => {
        const chars = flattenChars(row.cells[i] ?? []);
        return wrapChars(chars, width - CELL_PAD * 2, family, TABLE_FONT_SIZE).map((line) => lineRuns(line));
      });
      const lineCount = Math.max(1, ...cellLineLists.map((lines) => lines.length));
      const rowHeight = lineCount * bodyLineHeight(TABLE_FONT_SIZE) + CELL_PAD * 2;
      ensureSpace(rowHeight);
      push({ kind: 'table-row', header: row.header, colWidths, cellLineLists, rowHeight });
      cursorY -= rowHeight;
    });
  };

  blocks.forEach((block) => {
    if (block.kind === 'heading') {
      const size = headingSize(block.level);
      emitGap(headingSpaceBefore(block.level));
      const boldParts = block.parts.map((part) => (part.kind === 'text' ? { ...part, flags: { ...part.flags, bold: true } } : part));
      emitTextBlock(boldParts, size, headingLineHeight, { color: block.level <= 2 ? HEADING_COLOR : undefined });
      cursorY -= 5;
    } else if (block.kind === 'paragraph') {
      emitTextBlock(block.parts, BASE, bodyLineHeight, { justify: opts.justify });
      cursorY -= 7;
    } else if (block.kind === 'listitem') {
      const indent = measure(block.prefix, bodyAfm, BASE);
      emitTextBlock(block.parts, BASE, bodyLineHeight, { indent, marker: block.prefix });
      cursorY -= 3;
    } else if (block.kind === 'table') {
      emitTable(block.rows);
      emitGap(10);
    } else if (block.kind === 'rule') {
      ensureSpace(bodyLineHeight(BASE));
      push({ kind: 'rule' });
      cursorY -= 8;
    }
  });

  // Registra só as fontes efetivamente usadas (FR sempre, para marcador e
  // número de página).
  const usedFonts = new Map<string, AfmFontKey>([[BODY_RES.r, FAMILY_AFM[family].r]]);
  const noteRuns = (runs: LineRun[]): void => {
    runs.forEach((run) => { const f = pickFont(run.flags, family); usedFonts.set(f.res, f.afm); });
  };
  pages.forEach((items) => items.forEach((item) => {
    if (item.kind === 'text') noteRuns(item.runs);
    else if (item.kind === 'table-row') item.cellLineLists.forEach((cell) => cell.forEach(noteRuns));
  }));

  const writer = new PdfWriter();
  const fontIds: Record<string, number> = {};
  usedFonts.forEach((afm, res) => {
    fontIds[res] = writer.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /${AFM_BASEFONT[afm]} /Encoding /WinAnsiEncoding >>`);
  });
  const resources = writer.addObject(
    `<< /Font << ${Object.entries(fontIds).map(([res, id]) => `/${res} ${id} 0 R`).join(' ')} >> >>`,
  );
  const pagesId = writer.addObject('');
  const catalog = writer.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const pageCount = pages.length;
  const pageIds: number[] = [];
  pages.forEach((itemsOnPage, pageIndex) => {
    let y = PAGE_H - MARGIN;
    let content = '';
    const links: LinkRect[] = [];
    itemsOnPage.forEach((item) => {
      if (item.kind === 'gap') { y -= item.height; return; }
      if (item.kind === 'rule') {
        content += `q 0.6 0.6 0.6 rg ${MARGIN} ${(y - 4).toFixed(2)} ${USABLE_W.toFixed(2)} 0.75 re f Q `;
        y -= bodyLineHeight(BASE);
        return;
      }
      if (item.kind === 'table-row') {
        const top = y;
        const bottom = y - item.rowHeight;
        const tableWidth = item.colWidths.reduce((a, b) => a + b, 0);
        if (item.header) content += `q 0.87 0.91 0.95 rg ${MARGIN} ${bottom.toFixed(2)} ${tableWidth.toFixed(2)} ${item.rowHeight.toFixed(2)} re f Q `;
        let x = MARGIN;
        item.colWidths.forEach((width, i) => {
          content += `q 0.6 0.6 0.6 RG 0.5 w ${x.toFixed(2)} ${bottom.toFixed(2)} ${width.toFixed(2)} ${item.rowHeight.toFixed(2)} re S Q `;
          let ty = top - CELL_PAD - TABLE_FONT_SIZE * 0.85;
          (item.cellLineLists[i] ?? []).forEach((runsArr) => {
            content += `BT ${(x + CELL_PAD).toFixed(2)} ${ty.toFixed(2)} Td `;
            runsArr.forEach((run) => {
              content += `/${pickFont(run.flags, family).res} ${TABLE_FONT_SIZE} Tf (${pdfEscape(toWinAnsiByteString(run.text))}) Tj `;
            });
            content += 'ET ';
            ty -= bodyLineHeight(TABLE_FONT_SIZE);
          });
          x += width;
        });
        y -= item.rowHeight;
        return;
      }
      // texto
      if (item.marker) {
        content += `BT ${MARGIN.toFixed(2)} ${y.toFixed(2)} Td /${pickFont({}, family).res} ${item.size} Tf (${pdfEscape(toWinAnsiByteString(item.marker))}) Tj ET `;
      }
      const startX = MARGIN + item.x;
      content += `q ${item.color ? `${item.color} rg ` : ''}BT ${startX.toFixed(2)} ${y.toFixed(2)} Td ${item.wordSpacing.toFixed(3)} Tw `;
      let x = startX;
      item.runs.forEach((run) => {
        const { res, afm } = pickFont(run.flags, family);
        content += `/${res} ${item.size} Tf (${pdfEscape(toWinAnsiByteString(run.text))}) Tj `;
        const spaces = (run.text.match(/ /g) ?? []).length;
        const width = measure(run.text, afm, item.size) + spaces * item.wordSpacing;
        if (run.flags.underline || run.href) content += `q 0 0 0 rg ${x.toFixed(2)} ${(y - 1.5).toFixed(2)} ${width.toFixed(2)} 0.5 re f Q `;
        if (run.flags.strike) content += `q 0 0 0 rg ${x.toFixed(2)} ${(y + item.size * 0.3).toFixed(2)} ${width.toFixed(2)} 0.5 re f Q `;
        if (run.href) links.push({ x0: x, y0: y - item.size * 0.25, x1: x + width, y1: y + item.size * 0.9, href: run.href });
        x += width;
      });
      content += 'ET Q ';
      y -= bodyLineHeight(item.size);
    });

    if (opts.pageNumbers) {
      const label = `${pageIndex + 1} / ${pageCount}`;
      const size = Math.max(8, BASE - 2);
      const tx = (PAGE_W - measure(label, bodyAfm, size)) / 2;
      content += `q 0.45 0.45 0.45 rg BT ${tx.toFixed(2)} ${(MARGIN * 0.5).toFixed(2)} Td /${BODY_RES.r} ${size} Tf (${pdfEscape(toWinAnsiByteString(label))}) Tj ET Q `;
    }

    const contentId = writer.addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const annotIds = links.map((l) =>
      writer.addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${l.x0.toFixed(2)} ${l.y0.toFixed(2)} ${l.x1.toFixed(2)} ${l.y1.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${pdfEscape(toWinAnsiByteString(l.href))}) >> >>`,
      ),
    );
    const annots = annotIds.length ? ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(' ')}]` : '';
    const pageId = writer.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${resources} 0 R /Contents ${contentId} 0 R${annots} >>`,
    );
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

// ---------------------------------------------------------------------------
// Leitura estruturada: reconstrói títulos, listas e parágrafos de um PDF a
// partir do tamanho e da posição de cada trecho de texto (pdf.js
// `getTextContent`). Não reconstrói tabelas nem formatação inline. O HTML
// resultante alimenta os mesmos caminhos PDF -> {MD, DOCX, HTML}.
// ---------------------------------------------------------------------------
export type PdfLine = { text: string; size: number; x: number; bold: boolean };

function htmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Puro e testável: recebe as linhas já agrupadas por página e devolve o HTML
// intermediário (títulos por tamanho relativo, listas por marcador, o resto
// como parágrafos, unindo linhas seguidas).
export function linesToStructuredHtml(pages: PdfLine[][]): string {
  const all = pages.flat().filter((l) => l.text.trim().length > 0);
  if (!all.length) return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body></body></html>';

  // Tamanho de corpo = tamanho mais frequente ponderado por nº de caracteres.
  const weight = new Map<number, number>();
  all.forEach((l) => {
    const key = Math.round(l.size * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + l.text.length);
  });
  let bodySize = 12;
  let best = -1;
  weight.forEach((w, size) => { if (w > best) { best = w; bodySize = size; } });

  const headingLevel = (size: number): number | null => {
    const r = size / bodySize;
    if (r >= 1.8) return 1;
    if (r >= 1.45) return 2;
    if (r >= 1.22) return 3;
    if (r >= 1.1) return 4;
    return null;
  };
  const listMatch = (text: string): { ordered: boolean; body: string } | null => {
    const m = text.match(/^\s*(?:([•·▪‣◦*\-–])|(\d+)[.)])\s+(.*)$/);
    if (!m) return null;
    return { ordered: !!m[2], body: m[3] };
  };

  const out: string[] = [];
  let paraBuf: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = (): void => {
    if (paraBuf.length) out.push(`<p>${htmlEscape(paraBuf.join(' ').replace(/\s+/g, ' ').trim())}</p>`);
    paraBuf = [];
  };
  const flushList = (): void => {
    if (list && list.items.length) {
      const tag = list.ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${list.items.map((i) => `<li>${htmlEscape(i)}</li>`).join('')}</${tag}>`);
    }
    list = null;
  };

  pages.forEach((pageLines) => {
    pageLines.filter((l) => l.text.trim()).forEach((line) => {
      const text = line.text.replace(/\s+/g, ' ').trim();
      const level = headingLevel(line.size);
      if (level) { flushPara(); flushList(); out.push(`<h${level}>${htmlEscape(text)}</h${level}>`); return; }
      const li = listMatch(text);
      if (li) {
        flushPara();
        if (!list || list.ordered !== li.ordered) { flushList(); list = { ordered: li.ordered, items: [] }; }
        list.items.push(li.body.trim());
        return;
      }
      flushList();
      // Continua o parágrafo se a linha anterior não terminou em pontuação
      // forte; senão, começa outro.
      const prev = paraBuf[paraBuf.length - 1];
      if (prev && /[.!?:;)"'”]\s*$/.test(prev) && text && /^[A-ZÀ-Þ0-9"“(]/.test(text)) flushPara();
      paraBuf.push(text);
    });
  });
  flushPara();
  flushList();

  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body>${out.join('')}</body></html>`;
}

export async function pdfToStructured(source: ArrayBuffer | Uint8Array): Promise<string> {
  const pdfjsLib = await importModule('/vendor/pdfjs/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const loadingTask = pdfjsLib.getDocument({ data, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/' });
  const doc = await loadingTask.promise;
  const pages: PdfLine[][] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    type Frag = { str: string; x: number; y: number; size: number; bold: boolean };
    const frags: Frag[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const t = item.transform as number[];
      const size = Math.hypot(t[2], t[3]) || item.height || 10;
      const fontName = String((item as { fontName?: string }).fontName ?? '');
      frags.push({ str: item.str, x: t[4], y: t[5], size, bold: /bold|black|semibold|heavy/i.test(fontName) });
    }
    // Agrupa por linha (mesmo y, com tolerância), depois ordena por x.
    frags.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PdfLine[] = [];
    let bucket: Frag[] = [];
    const pushBucket = (): void => {
      if (!bucket.length) return;
      bucket.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = -Infinity;
      bucket.forEach((f) => {
        if (text && f.x - prevEnd > f.size * 0.25 && !text.endsWith(' ')) text += ' ';
        text += f.str;
        prevEnd = f.x + f.size * 0.5 * f.str.length;
      });
      const size = bucket.map((f) => f.size).sort((a, b) => a - b)[Math.floor(bucket.length / 2)];
      const bold = bucket.filter((f) => f.bold).length > bucket.length / 2;
      lines.push({ text: text.replace(/\s+/g, ' ').trim(), size, x: bucket[0].x, bold });
      bucket = [];
    };
    frags.forEach((f) => {
      const ref = bucket[0];
      if (ref && Math.abs(ref.y - f.y) <= Math.max(2, ref.size * 0.35)) bucket.push(f);
      else { pushBucket(); bucket = [f]; }
    });
    pushBucket();
    pages.push(lines);
    page.cleanup();
  }
  await doc.destroy();
  return linesToStructuredHtml(pages);
}
