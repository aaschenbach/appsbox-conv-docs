export {};

// Conversões entre os formatos de texto (TXT, Markdown, HTML) feitas só com
// APIs nativas do navegador (`DOMParser`). Extraído de main.ts para poder ser
// testado fora da interface. Usa `document`/`DOMParser` apenas em tempo de
// chamada, nunca no import.

export type TextKind = 'txt' | 'md' | 'html';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function inlineMarkdown(value: string): string {
  const tokens: string[] = [];
  const token = (html: string): string => { const index = tokens.push(html) - 1; return `\u0000${index}\u0000`; };
  let result = escapeHtml(value);
  result = result.replace(/`([^`\n]+)`/g, (_, code: string) => token(`<code>${code}</code>`));
  result = result.replace(/!?\[([^\]]+)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g, (match: string, label: string, url: string, title?: string) => {
    const safeUrl = /^(?:https?:|mailto:)/i.test(url) ? url : '#';
    if (match.startsWith('!')) return token(`<img src="${safeUrl}" alt="${label}">`);
    const titleAttribute = title ? ` title="${title}"` : '';
    return token(`<a href="${safeUrl}"${titleAttribute}>${label}</a>`);
  });
  result = result.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, strongA: string, strongB: string) => `<strong>${strongA ?? strongB}</strong>`);
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
  result = result.replace(/\*([^*\n]+)\*|_([^_\n]+)_/g, (_, emphasisA: string, emphasisB: string) => `<em>${emphasisA ?? emphasisB}</em>`);
  return result.replace(/\u0000(\d+)\u0000/g, (_, index: string) => tokens[Number(index)]);
}

export function isTableSeparator(line: string): boolean {
  const cells = line.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split('|');
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

export function tableRow(line: string): string[] {
  return line.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split('|').map((cell) => cell.trim());
}

export function markdownToHtml(value: string): string {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s*```\s*([^ ]*)\s*$/);
    if (fence) {
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
      const code: string[] = []; index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { code.push(lines[index]); index += 1; }
      if (index < lines.length) index += 1;
      output.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`); continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) { const level = heading[1].length; output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); index += 1; continue; }
    if (/^\s{0,3}(?:\*\s*){3,}$/.test(line) || /^\s{0,3}(?:-\s*){3,}$/.test(line) || /^\s{0,3}(?:_\s*){3,}$/.test(line)) { output.push('<hr>'); index += 1; continue; }

    if (index + 1 < lines.length && line.includes('|') && isTableSeparator(lines[index + 1])) {
      const header = tableRow(line); const rows: string[][] = []; index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) { rows.push(tableRow(lines[index])); index += 1; }
      output.push(`<table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue;
    }

    const list = line.match(/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/);
    if (list) {
      const ordered = /^\d/.test(list[1]); const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(`<li>${inlineMarkdown(item[2])}</li>`); index += 1;
      }
      output.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) { quote.push(lines[index].replace(/^\s*>\s?/, '')); index += 1; }
      output.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`); continue;
    }

    const paragraph: string[] = [line.trim()]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*(?:#{1,6}\s|```|[-+*]\s+|\d+[.)]\s+|>)/.test(lines[index]) && !(lines[index].includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1]))) { paragraph.push(lines[index].trim()); index += 1; }
    output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }
  return output.join('');
}

export function markdownText(value: string): string {
  return value.replace(/([\\`*_[\]{}])/g, '\\$1').replace(/</g, '\\<').replace(/>/g, '\\>');
}

export function htmlInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return markdownText(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;
  const content = Array.from(element.childNodes).map(htmlInline).join('');
  const tag = element.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') return `**${content}**`;
  if (tag === 'em' || tag === 'i') return `*${content}*`;
  if (tag === 'del' || tag === 's' || tag === 'strike') return `~~${content}~~`;
  if (tag === 'code' && element.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${(element.textContent ?? '').replace(/`/g, '\\`')}\``;
  if (tag === 'br') return '  \n';
  if (tag === 'img') {
    const alt = element.getAttribute('alt') ?? '';
    const src = element.getAttribute('src') ?? '';
    return src ? `![${markdownText(alt)}](${src})` : '';
  }
  if (tag === 'a') {
    const href = element.getAttribute('href') ?? '';
    const safeHref = /^(?:https?:|mailto:)/i.test(href) ? href : '#';
    return `[${content || markdownText(href)}](${safeHref})`;
  }
  return content;
}

export function htmlToMarkdown(value: string): string {
  const document = new DOMParser().parseFromString(value, 'text/html');
  const blocks: string[] = [];
  const addBlock = (content: string): void => { const normalized = content.replace(/[ \t]+\n/g, '\n').trim(); if (normalized) blocks.push(normalized); };
  const isListTag = (el: Element): boolean => el.tagName.toLowerCase() === 'ul' || el.tagName.toLowerCase() === 'ol';
  const listBlock = (element: HTMLElement, ordered: boolean, depth: number): string => {
    const pad = '  '.repeat(depth);
    const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li');
    return items.map((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const inline = Array.from(item.childNodes)
        .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && isListTag(n as Element)))
        .map(htmlInline).join('').replace(/\s+/g, ' ').trim();
      let line = `${pad}${marker} ${inline}`;
      Array.from(item.children).filter(isListTag).forEach((nested) => {
        line += `\n${listBlock(nested as HTMLElement, nested.tagName.toLowerCase() === 'ol', depth + 1)}`;
      });
      return line;
    }).join('\n');
  };
  const list = (element: HTMLElement, ordered: boolean): void => { addBlock(listBlock(element, ordered, 0)); };
  const definitionList = (element: HTMLElement): void => {
    const parts: string[] = [];
    Array.from(element.children).forEach((child) => {
      const t = child.tagName.toLowerCase();
      if (t === 'dt') parts.push(`**${htmlInline(child).trim()}**`);
      else if (t === 'dd') parts.push(`: ${htmlInline(child).trim()}`);
    });
    addBlock(parts.join('\n'));
  };
  const table = (element: HTMLElement): void => {
    const rows = Array.from(element.querySelectorAll('tr')).map((row) => Array.from(row.children).map((cell) => htmlInline(cell)));
    if (!rows.length) return;
    const width = Math.max(...rows.map((row) => row.length));
    const normalizeRow = (row: string[]): string[] => Array.from({ length: width }, (_, index) => row[index] ?? '');
    const header = normalizeRow(rows[0]);
    addBlock(`| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |${rows.slice(1).map((row) => `\n| ${normalizeRow(row).join(' | ')} |`).join('')}`);
  };
  const visit = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) { addBlock(`${'#'.repeat(Number(tag[1]))} ${htmlInline(element)}`); return; }
    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main') { addBlock(htmlInline(element)); return; }
    if (tag === 'pre') {
      const codeEl = element.querySelector('code');
      const lang = (codeEl?.getAttribute('class')?.match(/language-([\w-]+)/) ?? [])[1] ?? '';
      addBlock('```' + lang + '\n' + (element.textContent ?? '').replace(/\n+$/, '') + '\n```');
      return;
    }
    if (tag === 'ul' || tag === 'ol') { list(element, tag === 'ol'); return; }
    if (tag === 'dl') { definitionList(element); return; }
    if (tag === 'blockquote') { addBlock((element.textContent ?? '').trim().split(/\r?\n/).map((line) => `> ${markdownText(line.trim())}`).join('\n')); return; }
    if (tag === 'hr') { addBlock('---'); return; }
    if (tag === 'table') { table(element); return; }
    Array.from(element.children).forEach(visit);
  };
  Array.from(document.body.children).forEach(visit);
  if (!blocks.length) addBlock(htmlInline(document.body));
  return `${blocks.join('\n\n')}\n`;
}

const HTML_SHELL_HEAD = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body>';
export function wrapHtml(bodyHtml: string): string { return `${HTML_SHELL_HEAD}${bodyHtml}</body></html>`; }

export function convertText(text: string, from: TextKind, to: TextKind): string {
  if (to === 'txt') return from === 'html' ? new DOMParser().parseFromString(text, 'text/html').body.textContent ?? '' : text;
  if (to === 'html') return from === 'md' ? wrapHtml(markdownToHtml(text)) : from === 'html' ? text : wrapHtml(`<pre>${escapeHtml(text)}</pre>`);
  if (from === 'md') return text;
  if (from === 'html') return htmlToMarkdown(text);
  return text;
}
