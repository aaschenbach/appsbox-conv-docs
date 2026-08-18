export {};
type InputKind = 'txt' | 'md' | 'html';
type OutputKind = 'txt' | 'md' | 'html';
type Job = { file: File; kind: InputKind; output: OutputKind; state: string };

const input = document.querySelector<HTMLInputElement>('#files')!;
const dropzone = document.querySelector<HTMLElement>('#dropzone')!;
const queue = document.querySelector<HTMLElement>('#queue')!;
const output = document.querySelector<HTMLSelectElement>('#output')!;
const form = document.querySelector<HTMLFormElement>('#converter-form')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const count = document.querySelector<HTMLElement>('#conversion-count')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const theme = document.querySelector<HTMLButtonElement>('#theme-toggle')!;
let jobs: Job[] = [];
let busy = false;

function kind(file: File): InputKind | null {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'txt' ? 'txt' : ext === 'md' || ext === 'markdown' ? 'md' : ext === 'html' || ext === 'htm' ? 'html' : null;
}
function outputExtension(value: OutputKind): string { return value; }
function setStatus(value: string, active = false): void { statusEl.textContent = value; statusEl.classList.toggle('busy', active); }
function escape(value: string): string { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function formatBytes(value: number): string { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
function inlineMarkdown(value: string): string {
  const tokens: string[] = [];
  const token = (html: string): string => { const index = tokens.push(html) - 1; return `\u0000${index}\u0000`; };
  let result = escape(value);
  result = result.replace(/`([^`\n]+)`/g, (_, code: string) => token(`<code>${code}</code>`));
  result = result.replace(/!?\[([^\]]+)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g, (match: string, label: string, url: string, title?: string) => {
    if (match.startsWith('!')) return match;
    const safeUrl = /^(?:https?:|mailto:)/i.test(url) ? url : '#';
    const titleAttribute = title ? ` title="${title}"` : '';
    return token(`<a href="${safeUrl}"${titleAttribute}>${label}</a>`);
  });
  result = result.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, strongA: string, strongB: string) => `<strong>${strongA ?? strongB}</strong>`);
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
  result = result.replace(/\*([^*\n]+)\*|_([^_\n]+)_/g, (_, emphasisA: string, emphasisB: string) => `<em>${emphasisA ?? emphasisB}</em>`);
  return result.replace(/\u0000(\d+)\u0000/g, (_, index: string) => tokens[Number(index)]);
}

function isTableSeparator(line: string): boolean {
  const cells = line.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split('|');
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableRow(line: string): string[] {
  return line.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split('|').map((cell) => cell.trim());
}

function markdownToHtml(value: string): string {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s*```\s*([^ ]*)\s*$/);
    if (fence) {
      const language = fence[1] ? ` class="language-${escape(fence[1])}"` : '';
      const code: string[] = []; index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { code.push(lines[index]); index += 1; }
      if (index < lines.length) index += 1;
      output.push(`<pre><code${language}>${escape(code.join('\n'))}</code></pre>`); continue;
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
function markdownText(value: string): string { return value.replace(/([\\`*_[\]{}])/g, '\\$1').replace(/</g, '\\<').replace(/>/g, '\\>'); }
function htmlInline(node: Node): string {
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
  if (tag === 'a') {
    const href = element.getAttribute('href') ?? '';
    const safeHref = /^(?:https?:|mailto:)/i.test(href) ? href : '#';
    return `[${content || markdownText(href)}](${safeHref})`;
  }
  return content;
}
function htmlToMarkdown(value: string): string {
  const document = new DOMParser().parseFromString(value, 'text/html');
  const blocks: string[] = [];
  const addBlock = (content: string): void => { const normalized = content.replace(/[ \t]+\n/g, '\n').trim(); if (normalized) blocks.push(normalized); };
  const list = (element: HTMLElement, ordered: boolean): void => {
    const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li');
    addBlock(items.map((item, index) => `${ordered ? `${index + 1}.` : '-'} ${htmlInline(item)}`).join('\n'));
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
    if (tag === 'pre') { addBlock(`\\` + '``' + `\n${element.textContent ?? ''}\n` + '```'); return; }
    if (tag === 'ul' || tag === 'ol') { list(element, tag === 'ol'); return; }
    if (tag === 'blockquote') { addBlock((element.textContent ?? '').trim().split(/\r?\n/).map((line) => `> ${markdownText(line.trim())}`).join('\n')); return; }
    if (tag === 'hr') { addBlock('---'); return; }
    if (tag === 'table') { table(element); return; }
    Array.from(element.children).forEach(visit);
  };
  Array.from(document.body.children).forEach(visit);
  if (!blocks.length) addBlock(htmlInline(document.body));
  return `${blocks.join('\n\n')}\n`;
}
function convertText(text: string, from: InputKind, to: OutputKind): string {
  if (to === 'txt') return from === 'html' ? new DOMParser().parseFromString(text, 'text/html').body.textContent ?? '' : text;
  if (to === 'html') return from === 'md' ? `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body>${markdownToHtml(text)}</body></html>` : from === 'html' ? text : `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body><pre>${escape(text)}</pre></body></html>`;
  if (from === 'md') return text;
  if (from === 'html') return htmlToMarkdown(text);
  return text;
}
function renderQueue(): void {
  queue.replaceChildren();
  document.querySelector('#file-summary')!.textContent = jobs.length ? `${jobs.length} documento(s) selecionado(s)` : 'Nenhum arquivo selecionado';
  jobs.forEach((job, index) => { const item = document.createElement('article'); item.className = 'file-item'; item.innerHTML = `<div><strong>${escape(job.file.name)}</strong><small>${job.kind.toUpperCase()} · ${formatBytes(job.file.size)}</small></div><button type="button" ${busy ? 'disabled' : ''}>Remover</button>`; item.querySelector('button')!.addEventListener('click', () => { jobs.splice(index, 1); renderQueue(); }); queue.append(item); });
}
function addFiles(files: FileList | File[]): void { const added = Array.from(files).map((file) => ({ file, kind: kind(file), output: output.value as OutputKind, state: 'Pronto' })).filter((job): job is Job => job.kind !== null); jobs.push(...added); renderQueue(); setStatus(added.length ? 'Pronto para converter.' : 'Selecione TXT, Markdown ou HTML.'); }
input.addEventListener('change', () => { addFiles(input.files ?? []); input.value = ''; });
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('over'); addFiles(event.dataTransfer?.files ?? []); });
reset.addEventListener('click', () => { jobs = []; results.replaceChildren(); renderQueue(); setStatus('Pronto para converter.'); });
theme.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; renderTheme(next); localStorage.setItem('appsbox-conv-documentos-theme', next); });
form.addEventListener('submit', async (event) => { event.preventDefault(); if (busy || !jobs.length) { setStatus(jobs.length ? 'A conversão já está em andamento.' : 'Selecione ao menos um documento.'); return; } busy = true; renderQueue(); results.replaceChildren(); for (let index = 0; index < jobs.length; index += 1) { const job = jobs[index]; try { setStatus(`Lendo ${job.file.name} — ${index + 1} de ${jobs.length}`, true); const text = await job.file.text(); const converted = convertText(text, job.kind, output.value as OutputKind); const blob = new Blob([converted], { type: output.value === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.className = 'result-item'; link.download = `${job.file.name.replace(/\.[^.]+$/, '')}.${outputExtension(output.value as OutputKind)}`; link.href = URL.createObjectURL(blob); link.innerHTML = `<span>${escape(link.download)}</span><small>${formatBytes(blob.size)} · baixar</small>`; results.append(link); fetch('/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(async (response) => { if (response.ok) count.textContent = String((await response.json() as { total: number }).total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }).catch(() => undefined); } catch { const error = document.createElement('p'); error.className = 'error'; error.textContent = `Não foi possível converter ${job.file.name}.`; results.append(error); } } busy = false; renderQueue(); setStatus('Conversão concluída. Seus documentos permaneceram neste dispositivo.'); });
function renderTheme(themeName: 'light' | 'dark'): void { document.documentElement.dataset.theme = themeName; theme.textContent = themeName === 'dark' ? '☀' : '☾'; theme.setAttribute('aria-label', themeName === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'); }
const initialTheme = localStorage.getItem('appsbox-conv-documentos-theme') === 'dark' ? 'dark' : 'light'; renderTheme(initialTheme);
fetch('/api/count').then(async (response) => { if (response.ok) count.textContent = String((await response.json() as { total: number }).total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }).catch(() => undefined);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?release=__RELEASE__').catch(() => undefined);
