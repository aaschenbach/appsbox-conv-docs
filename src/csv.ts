export {};

// CSV/TSV <-> tabela HTML. Parser RFC 4180 (aspas, delimitador e quebra de
// linha embutidos, "" para aspas literal). Sem dependências.

import { wrapHtml, escapeHtml } from './text-formats.js';

export type CsvDelimiter = ',' | ';' | '\t';

export function detectDelimiter(sample: string): CsvDelimiter {
  const firstLine = sample.replace(/\r\n?/g, '\n').split('\n')[0] ?? '';
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuote = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === ',' || ch === ';' || ch === '\t')) counts[ch] += 1;
  }
  return (Object.keys(counts) as CsvDelimiter[]).sort((a, b) => counts[b] - counts[a])[0];
}

export function parseCsv(text: string, delimiter?: CsvDelimiter): string[][] {
  const delim = delimiter ?? detectDelimiter(text);
  const source = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuote) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i += 1; } else inQuote = false;
      } else field += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
}

export function csvToHtml(text: string, options?: { header?: boolean; delimiter?: CsvDelimiter }): string {
  const rows = parseCsv(text, options?.delimiter);
  if (!rows.length) return wrapHtml('');
  const header = options?.header ?? true;
  const body = rows.map((cells, index) => {
    const tag = header && index === 0 ? 'th' : 'td';
    return `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`;
  }).join('');
  return wrapHtml(`<table>${body}</table>`);
}

export interface CsvWriteOptions { delimiter?: CsvDelimiter; quoteAll?: boolean }

function encodeCell(value: string, delim: string, quoteAll: boolean): string {
  const escaped = value.replace(/"/g, '""');
  return quoteAll || value.includes(delim) || /["\n\r]/.test(value) ? `"${escaped}"` : escaped;
}

export function htmlToCsv(html: string, options?: CsvWriteOptions): string {
  const delim = options?.delimiter ?? ',';
  const quoteAll = options?.quoteAll ?? false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (table) {
    const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.children).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()));
    const width = Math.max(0, ...rows.map((r) => r.length));
    return rows.map((r) => Array.from({ length: width }, (_, i) => encodeCell(r[i] ?? '', delim, quoteAll)).join(delim)).join('\r\n') + '\r\n';
  }
  // Sem tabela: cada bloco vira uma linha de uma coluna.
  const blocks = Array.from(doc.body.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, pre, blockquote'));
  const lines = (blocks.length ? blocks.map((el) => el.textContent ?? '') : (doc.body.textContent ?? '').split(/\r?\n/))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.map((l) => encodeCell(l, delim, quoteAll)).join('\r\n') + '\r\n';
}
