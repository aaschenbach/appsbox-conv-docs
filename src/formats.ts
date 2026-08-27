export {};

// Fonte de verdade única da matriz de formatos, compartilhada entre a aplicação
// (`src/main.ts`) e o gerador de páginas de SEO (`scripts/generate-seo-pages.mjs`,
// que importa `../dist/formats.js` após o build). Nenhum formato aqui que a
// aplicação não converta de fato. Imagens (JPG/PNG) NÃO entram: tratamento de
// imagem/PDF é um produto separado.

export type InputKind = 'txt' | 'md' | 'html' | 'docx' | 'pdf' | 'rtf' | 'odt' | 'csv';
export type OutputKind = 'txt' | 'md' | 'html' | 'docx' | 'pdf' | 'rtf' | 'odt' | 'csv' | 'epub';

export interface FormatMeta {
  /** Rótulo curto para UI e títulos ("DOCX", "Markdown"). */
  label: string;
  /** Descrição longa para a copy das páginas ("documento do Word (.docx)"). */
  long: string;
  /** Extensão canônica do arquivo (".docx"). */
  ext: string;
  /** Valor do atributo `accept` do `<input type="file">` para esta entrada. */
  accept: string;
}

export const FORMATS: Record<InputKind | OutputKind, FormatMeta> = {
  txt: { label: 'TXT', long: 'texto simples (TXT)', ext: '.txt', accept: '.txt,text/plain' },
  md: { label: 'Markdown', long: 'Markdown (.md)', ext: '.md', accept: '.md,.markdown,text/markdown' },
  html: { label: 'HTML', long: 'HTML (.html)', ext: '.html', accept: '.html,.htm,text/html' },
  docx: { label: 'DOCX', long: 'documento do Word (.docx)', ext: '.docx', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pdf: { label: 'PDF', long: 'PDF (.pdf)', ext: '.pdf', accept: '.pdf,application/pdf' },
  rtf: { label: 'RTF', long: 'texto formatado (RTF)', ext: '.rtf', accept: '.rtf,application/rtf,text/rtf' },
  odt: { label: 'ODT', long: 'documento ODT do LibreOffice', ext: '.odt', accept: '.odt,application/vnd.oasis.opendocument.text' },
  csv: { label: 'CSV', long: 'planilha CSV/TSV', ext: '.csv', accept: '.csv,.tsv,text/csv,text/tab-separated-values' },
  epub: { label: 'EPUB', long: 'livro digital EPUB', ext: '.epub', accept: '.epub,application/epub+zip' },
};

// EPUB é só saída; todos os demais são entrada e saída.
export const INPUT_KINDS: InputKind[] = ['txt', 'md', 'html', 'docx', 'pdf', 'rtf', 'odt', 'csv'];
export const OUTPUT_KINDS: OutputKind[] = ['txt', 'md', 'html', 'docx', 'pdf', 'rtf', 'odt', 'csv', 'epub'];

export function isInputKind(value: string): value is InputKind {
  return (INPUT_KINDS as string[]).includes(value);
}
export function isOutputKind(value: string): value is OutputKind {
  return (OUTPUT_KINDS as string[]).includes(value);
}

/** Um par é válido quando a origem é entrada, o destino é saída e são diferentes. */
export function allowedPair(from: string, to: string): boolean {
  return from !== to && isInputKind(from) && isOutputKind(to);
}

/** Destinos válidos para uma origem, na ordem de `OUTPUT_KINDS`. */
export function outputsFor(from: string): OutputKind[] {
  return OUTPUT_KINDS.filter((to) => allowedPair(from, to));
}

export const slug = (from: string, to: string): string => `${from}-para-${to}`;
export const pattern = (from: string, to: string): string => `${from}2${to}`;

const EXT_TO_KIND: Record<string, InputKind> = {
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  html: 'html',
  htm: 'html',
  docx: 'docx',
  pdf: 'pdf',
  rtf: 'rtf',
  odt: 'odt',
  csv: 'csv',
  tsv: 'csv',
};

/** Detecta o tipo de entrada pela extensão do nome do arquivo. */
export function kindFromName(name: string): InputKind | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return EXT_TO_KIND[ext] ?? null;
}
