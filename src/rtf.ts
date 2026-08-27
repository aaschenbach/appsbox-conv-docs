export {};

// RTF <-> HTML intermediário. Sem dependências. Cobre parágrafos, negrito,
// itálico, sublinhado, tachado, código (fonte mono), títulos (parágrafo em
// negrito com \fsN grande), listas simples e links; ignora tabelas de fonte,
// cor, estilo, imagens e metadados. Não é um leitor RTF completo.

import { wrapHtml, escapeHtml } from './text-formats.js';

// ---------------------------------------------------------------------------
// Leitura: RTF -> HTML
// ---------------------------------------------------------------------------
const CP1252_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†',
  0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};
function fromCp1252(byte: number): string {
  return byte < 0x80 ? String.fromCharCode(byte) : CP1252_HIGH[byte] ?? String.fromCharCode(byte);
}

type Style = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; code: boolean; fontSize: number };
const baseStyle = (): Style => ({ bold: false, italic: false, underline: false, strike: false, code: false, fontSize: 24 });

export function rtfToHtml(rtf: string): string {
  const blocks: string[] = [];
  let paraRuns: { text: string; style: Style }[] = [];
  let paraBold = true;
  let paraMaxSize = 0;
  const stack: Style[] = [baseStyle()];
  let style = stack[0];
  let skipDepth = 0; // dentro de um destino ignorado
  let ucSkip = 1;

  const flushRun = (buf: string): void => {
    if (buf) {
      paraRuns.push({ text: buf, style: { ...style } });
      if (!style.bold) paraBold = false;
      paraMaxSize = Math.max(paraMaxSize, style.fontSize);
    }
  };
  const flushPara = (): void => {
    const text = paraRuns.map((r) => {
      let s = escapeHtml(r.text);
      if (!s) return '';
      if (r.style.code) s = `<code>${s}</code>`;
      if (r.style.bold) s = `<strong>${s}</strong>`;
      if (r.style.italic) s = `<em>${s}</em>`;
      if (r.style.underline) s = `<u>${s}</u>`;
      if (r.style.strike) s = `<del>${s}</del>`;
      return s;
    }).join('');
    const plain = paraRuns.map((r) => r.text).join('').trim();
    if (plain) {
      if (paraBold && paraMaxSize >= 28) {
        const level = paraMaxSize >= 48 ? 1 : paraMaxSize >= 36 ? 2 : 3;
        blocks.push(`<h${level}>${text}</h${level}>`);
      } else {
        blocks.push(`<p>${text}</p>`);
      }
    }
    paraRuns = [];
    paraBold = true;
    paraMaxSize = 0;
  };

  let buf = '';
  let i = 0;
  const n = rtf.length;
  while (i < n) {
    const ch = rtf[i];
    if (ch === '{') {
      flushRun(buf); buf = '';
      stack.push({ ...style });
      style = stack[stack.length - 1];
      if (skipDepth > 0) skipDepth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      flushRun(buf); buf = '';
      stack.pop();
      style = stack[stack.length - 1] ?? baseStyle();
      if (skipDepth > 0) skipDepth -= 1;
      i += 1;
      continue;
    }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (next === '\\' || next === '{' || next === '}') { if (!skipDepth) buf += next; i += 2; continue; }
      if (next === '~') { if (!skipDepth) buf += ' '; i += 2; continue; }
      if (next === '*') { skipDepth = skipDepth || 1; i += 2; continue; }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (!skipDepth) buf += fromCp1252(parseInt(hex, 16) || 0x3f);
        i += 4;
        continue;
      }
      const m = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (!m) { i += 2; continue; }
      const word = m[1];
      const param = m[2] ? parseInt(m[2], 10) : undefined;
      i += 1 + m[0].length;
      if (word === 'u' && param !== undefined) {
        if (!skipDepth) buf += String.fromCodePoint(param < 0 ? param + 0x10000 : param);
        i += ucSkip; // pula o fallback ANSI
        continue;
      }
      if (word === 'uc') { ucSkip = param ?? 1; continue; }
      if (['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'footnote'].includes(word)) {
        skipDepth = skipDepth || 1;
        continue;
      }
      if (skipDepth) continue;
      flushRun(buf); buf = '';
      if (word === 'par' || word === 'pard') { if (word === 'par') flushPara(); if (word === 'pard') { style = { ...baseStyle(), fontSize: style.fontSize }; } continue; }
      if (word === 'line') { buf += '\n'; continue; }
      if (word === 'tab') { buf += '\t'; continue; }
      if (word === 'b') style.bold = param !== 0;
      else if (word === 'i') style.italic = param !== 0;
      else if (word === 'ul') style.underline = param !== 0;
      else if (word === 'ulnone') style.underline = false;
      else if (word === 'strike') style.strike = param !== 0;
      else if (word === 'f') style.code = param === 1; // \f1 = fonte mono por convenção do nosso gravador
      else if (word === 'fs' && param !== undefined) style.fontSize = param;
      continue;
    }
    if (ch === '\r' || ch === '\n') { i += 1; continue; }
    if (!skipDepth) buf += ch;
    i += 1;
  }
  flushRun(buf);
  flushPara();
  return wrapHtml(blocks.join(''));
}

// ---------------------------------------------------------------------------
// Escrita: HTML -> RTF
// ---------------------------------------------------------------------------
function rtfEscape(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\t') out += '\\tab ';
    else if (ch === '\n') out += '\\line ';
    else if (cp < 0x80) out += ch;
    else out += `\\u${cp > 0x7fff ? cp - 0x10000 : cp}?`;
  }
  return out;
}

type RtfFlags = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean };
function inlineRtf(node: Node, flags: RtfFlags): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = rtfEscape(node.textContent ?? '');
    if (!raw) return '';
    let s = raw;
    if (flags.code) s = `{\\f1 ${s}}`;
    if (flags.bold) s = `{\\b ${s}}`;
    if (flags.italic) s = `{\\i ${s}}`;
    if (flags.underline) s = `{\\ul ${s}}`;
    if (flags.strike) s = `{\\strike ${s}}`;
    return s;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const next = { ...flags };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 'del' || tag === 's' || tag === 'strike') next.strike = true;
  if (tag === 'code') next.code = true;
  if (tag === 'br') return '\\line ';
  const inner = Array.from(el.childNodes).map((child) => inlineRtf(child, next)).join('');
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    if (/^(?:https?:|mailto:)/i.test(href)) return `{\\field{\\*\\fldinst HYPERLINK "${rtfEscape(href)}"}{\\fldrslt ${inner}}}`;
  }
  return inner;
}

const HEADING_FS = [40, 32, 28, 26, 24, 24];

export function htmlToRtf(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];
  const para = (content: string, prefix = ''): void => { out.push(`\\pard${prefix} ${content}\\par`); };
  const visit = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const heading = tag.match(/^h([1-6])$/);
    if (heading) { para(`{\\b\\fs${HEADING_FS[Number(heading[1]) - 1]} ${inlineRtf(el, {})}}`, '\\sb180\\sa90'); return; }
    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main') {
      const content = inlineRtf(el, {});
      if (content.trim()) para(content);
      return;
    }
    if (tag === 'pre') {
      (el.textContent ?? '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => para(`{\\f1 ${rtfEscape(line)}}`));
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li').forEach((li, index) => {
        const marker = ordered ? `${index + 1}.` : '\\bullet';
        para(`${marker}\\tab ${inlineRtf(li as HTMLElement, {})}`, '\\fi-360\\li360');
      });
      return;
    }
    if (tag === 'blockquote') { para(inlineRtf(el, {}), '\\li720'); return; }
    if (tag === 'hr') { out.push('\\pard\\brdrb\\brdrs\\brdrw10\\par'); return; }
    if (tag === 'table') {
      Array.from(el.querySelectorAll('tr')).forEach((tr) => {
        const cells = Array.from(tr.children);
        const widths = cells.map((_, i) => Math.round((9000 / cells.length) * (i + 1)));
        out.push(`\\trowd\\trgaph100${widths.map((w) => `\\cellx${w}`).join('')}`);
        cells.forEach((cell) => out.push(`\\pard\\intbl ${inlineRtf(cell as HTMLElement, { bold: cell.tagName.toLowerCase() === 'th' })}\\cell`));
        out.push('\\row');
      });
      return;
    }
    Array.from(el.childNodes).forEach(visit);
  };
  Array.from(doc.body.childNodes).forEach(visit);
  const header = '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Helvetica;}{\\f1 Courier New;}}\\fs24\n';
  return `${header}${out.join('\n')}\n}`;
}
