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
function markdownToHtml(value: string): string {
  return value.split(/\n{2,}/).map((part) => {
    const line = part.trim();
    if (line.startsWith('# ')) return `<h1>${escape(line.slice(2))}</h1>`;
    if (line.startsWith('## ')) return `<h2>${escape(line.slice(3))}</h2>`;
    if (line.startsWith('### ')) return `<h3>${escape(line.slice(4))}</h3>`;
    return `<p>${escape(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}</p>`;
  }).join('');
}
function convertText(text: string, from: InputKind, to: OutputKind): string {
  if (to === 'txt') return from === 'html' ? new DOMParser().parseFromString(text, 'text/html').body.textContent ?? '' : text;
  if (to === 'html') return from === 'md' ? `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body>${markdownToHtml(text)}</body></html>` : from === 'html' ? text : `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body><pre>${escape(text)}</pre></body></html>`;
  if (from === 'md') return text;
  if (from === 'html') return new DOMParser().parseFromString(text, 'text/html').body.innerText || '';
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
theme.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; localStorage.setItem('appsbox-conv-documentos-theme', next); theme.textContent = next === 'dark' ? '☀️ Claro' : '🌙 Escuro'; });
form.addEventListener('submit', async (event) => { event.preventDefault(); if (busy || !jobs.length) { setStatus(jobs.length ? 'A conversão já está em andamento.' : 'Selecione ao menos um documento.'); return; } busy = true; renderQueue(); results.replaceChildren(); for (let index = 0; index < jobs.length; index += 1) { const job = jobs[index]; try { setStatus(`Lendo ${job.file.name} — ${index + 1} de ${jobs.length}`, true); const text = await job.file.text(); const converted = convertText(text, job.kind, output.value as OutputKind); const blob = new Blob([converted], { type: output.value === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.className = 'result-item'; link.download = `${job.file.name.replace(/\.[^.]+$/, '')}.${outputExtension(output.value as OutputKind)}`; link.href = URL.createObjectURL(blob); link.innerHTML = `<span>${escape(link.download)}</span><small>${formatBytes(blob.size)} · baixar</small>`; results.append(link); fetch('/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(async (response) => { if (response.ok) count.textContent = String((await response.json() as { total: number }).total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }).catch(() => undefined); } catch { const error = document.createElement('p'); error.className = 'error'; error.textContent = `Não foi possível converter ${job.file.name}.`; results.append(error); } } busy = false; renderQueue(); setStatus('Conversão concluída. Seus documentos permaneceram neste dispositivo.'); });
const initialTheme = localStorage.getItem('appsbox-conv-documentos-theme') === 'dark' ? 'dark' : 'light'; document.documentElement.dataset.theme = initialTheme; theme.textContent = initialTheme === 'dark' ? '☀️ Claro' : '🌙 Escuro';
fetch('/api/count').then(async (response) => { if (response.ok) count.textContent = String((await response.json() as { total: number }).total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }).catch(() => undefined);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
