import { docxToHtml, htmlToDocxBytes, DEFAULT_DOCX_OPTIONS, type DocxOptions } from './docx.js';
import { htmlToPdfBytes, pdfToText, pdfToStructured, DEFAULT_PDF_OPTIONS, type PdfOptions } from './pdf.js';
import { convertText, type TextKind } from './text-formats.js';
import { decodeImageFile, imagesToPdfBytes, DEFAULT_IMAGE_OPTIONS, type PdfImageOptions } from './image.js';
import { csvToHtml, htmlToCsv } from './csv.js';
import { rtfToHtml, htmlToRtf } from './rtf.js';
import { odtToHtml, htmlToOdtBytes } from './odt.js';
import { htmlToEpubBytes } from './epub.js';
export {};
type InputKind = TextKind | 'docx' | 'pdf' | 'image' | 'rtf' | 'odt' | 'csv';
type OutputKind = TextKind | 'docx' | 'pdf' | 'rtf' | 'odt' | 'csv' | 'epub';
type Job = { file: File; kind: InputKind; output: OutputKind; state: string };
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const RTF_MIME = 'application/rtf';
const ODT_MIME = 'application/vnd.oasis.opendocument.text';
const EPUB_MIME = 'application/epub+zip';

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
const pwaInstallPrompt = document.querySelector<HTMLElement>('#pwa-install-prompt')!;
const pwaInstallButton = document.querySelector<HTMLButtonElement>('#pwa-install')!;
const pwaDismissButton = document.querySelector<HTMLButtonElement>('#pwa-dismiss')!;
let jobs: Job[] = [];
let busy = false;

// ---------------------------------------------------------------------------
// Opções de saída (painel "Opções de saída"). Persistido em localStorage;
// só PDF e DOCX têm o que configurar — os demais formatos são texto puro.
// ---------------------------------------------------------------------------
type OutputOptions = { pdf: PdfOptions; docx: DocxOptions; image: PdfImageOptions };
const OPTIONS_KEY = 'appsbox-conv-documentos-options';
function defaultOptions(): OutputOptions {
  return { pdf: { ...DEFAULT_PDF_OPTIONS }, docx: { ...DEFAULT_DOCX_OPTIONS }, image: { ...DEFAULT_IMAGE_OPTIONS } };
}
function loadOptions(): OutputOptions {
  const base = defaultOptions();
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<OutputOptions>;
      if (saved.pdf) Object.assign(base.pdf, saved.pdf);
      if (saved.docx) Object.assign(base.docx, saved.docx);
      if (saved.image) Object.assign(base.image, saved.image);
    }
  } catch { /* storage indisponível ou JSON inválido: usa defaults */ }
  return base;
}
function saveOptions(value: OutputOptions): void {
  try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(value)); } catch { /* ignora */ }
}
let outputOptions = loadOptions();

const optionsDialog = document.querySelector<HTMLDialogElement>('#options-dialog')!;
const optionsForm = document.querySelector<HTMLFormElement>('#options-form')!;
const openOptions = document.querySelector<HTMLButtonElement>('#open-options')!;
const optionsReset = document.querySelector<HTMLButtonElement>('#options-reset')!;
const optionsNone = document.querySelector<HTMLElement>('#options-none')!;
const ctl = <T extends HTMLElement>(id: string): T => optionsForm.querySelector<T>(`#${id}`)!;

function syncOptionsForm(): void {
  const p = outputOptions.pdf;
  (ctl<HTMLSelectElement>('pdf-fontFamily')).value = p.fontFamily;
  (ctl<HTMLSelectElement>('pdf-baseSize')).value = String(p.baseSize);
  (ctl<HTMLSelectElement>('pdf-lineSpacing')).value = String(p.lineSpacing);
  (ctl<HTMLSelectElement>('pdf-pageSize')).value = p.pageSize;
  (ctl<HTMLSelectElement>('pdf-margins')).value = p.margins;
  (ctl<HTMLInputElement>('pdf-pageNumbers')).checked = p.pageNumbers;
  (ctl<HTMLInputElement>('pdf-justify')).checked = p.justify;
  const d = outputOptions.docx;
  (ctl<HTMLSelectElement>('docx-fontFamily')).value = d.fontFamily;
  (ctl<HTMLSelectElement>('docx-baseSize')).value = String(d.baseSize);
  (ctl<HTMLSelectElement>('docx-pageSize')).value = d.pageSize;
  (ctl<HTMLSelectElement>('docx-margins')).value = d.margins;
  const im = outputOptions.image;
  (ctl<HTMLSelectElement>('image-pageSize')).value = im.pageSize;
  (ctl<HTMLSelectElement>('image-orientation')).value = im.orientation;
  (ctl<HTMLSelectElement>('image-margin')).value = String(im.margin);
  (ctl<HTMLSelectElement>('image-fit')).value = im.fit;
}
function readOptionsForm(): OutputOptions {
  return {
    pdf: {
      fontFamily: (ctl<HTMLSelectElement>('pdf-fontFamily')).value as PdfOptions['fontFamily'],
      baseSize: Number((ctl<HTMLSelectElement>('pdf-baseSize')).value),
      lineSpacing: Number((ctl<HTMLSelectElement>('pdf-lineSpacing')).value),
      pageSize: (ctl<HTMLSelectElement>('pdf-pageSize')).value as PdfOptions['pageSize'],
      margins: (ctl<HTMLSelectElement>('pdf-margins')).value as PdfOptions['margins'],
      pageNumbers: (ctl<HTMLInputElement>('pdf-pageNumbers')).checked,
      justify: (ctl<HTMLInputElement>('pdf-justify')).checked,
    },
    docx: {
      fontFamily: (ctl<HTMLSelectElement>('docx-fontFamily')).value as DocxOptions['fontFamily'],
      baseSize: Number((ctl<HTMLSelectElement>('docx-baseSize')).value),
      pageSize: (ctl<HTMLSelectElement>('docx-pageSize')).value as DocxOptions['pageSize'],
      margins: (ctl<HTMLSelectElement>('docx-margins')).value as DocxOptions['margins'],
    },
    image: {
      pageSize: (ctl<HTMLSelectElement>('image-pageSize')).value as PdfImageOptions['pageSize'],
      orientation: (ctl<HTMLSelectElement>('image-orientation')).value as PdfImageOptions['orientation'],
      margin: Number((ctl<HTMLSelectElement>('image-margin')).value),
      fit: (ctl<HTMLSelectElement>('image-fit')).value as PdfImageOptions['fit'],
    },
  };
}
function hasImageJobs(): boolean { return jobs.some((job) => job.kind === 'image'); }
function showRelevantOptionsGroup(): void {
  const kind = output.value;
  const imageRelevant = kind === 'pdf' && hasImageJobs();
  let any = false;
  optionsForm.querySelectorAll<HTMLElement>('.options-group').forEach((group) => {
    const on = group.dataset.for === kind || (group.dataset.for === 'image' && imageRelevant);
    group.hidden = !on;
    any = any || on;
  });
  optionsNone.hidden = any;
}
function refreshOptionsButton(): void {
  openOptions.hidden = !(output.value === 'pdf' || output.value === 'docx' || hasImageJobs());
}
function openOptionsDialog(): void {
  syncOptionsForm();
  showRelevantOptionsGroup();
  try { optionsDialog.showModal(); } catch { optionsDialog.setAttribute('open', ''); }
}
openOptions.addEventListener('click', openOptionsDialog);
optionsForm.addEventListener('submit', () => { outputOptions = readOptionsForm(); saveOptions(outputOptions); });
optionsReset.addEventListener('click', () => {
  outputOptions = defaultOptions();
  saveOptions(outputOptions);
  syncOptionsForm();
});
output.addEventListener('change', () => { refreshOptionsButton(); renderQueue(); });

function kind(file: File): InputKind | null {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'txt') return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'docx') return 'docx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'rtf') return 'rtf';
  if (ext === 'odt') return 'odt';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'gif') return 'image';
  return null;
}
function outputExtension(value: OutputKind): string { return value; }
function setStatus(value: string, active = false): void { statusEl.textContent = value; statusEl.classList.toggle('busy', active); }
function escape(value: string): string { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function formatBytes(value: number): string { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
function moveJob(from: number, to: number): void {
  if (to < 0 || to >= jobs.length) return;
  const [moved] = jobs.splice(from, 1);
  jobs.splice(to, 0, moved);
  renderQueue();
}
function renderQueue(): void {
  queue.replaceChildren();
  const combining = jobs.length > 1 && output.value === 'pdf' && jobs.every((job) => job.kind === 'image');
  document.querySelector('#file-summary')!.textContent = jobs.length
    ? combining ? `${jobs.length} imagens — serão combinadas em um PDF (arraste a ordem com ▲▼)` : `${jobs.length} documento(s) selecionado(s)`
    : 'Nenhum arquivo selecionado';
  jobs.forEach((job, index) => {
    const item = document.createElement('article');
    item.className = 'file-item';
    const reorder = combining
      ? `<button type="button" class="reorder" data-dir="-1" ${busy || index === 0 ? 'disabled' : ''} aria-label="Mover para cima">▲</button><button type="button" class="reorder" data-dir="1" ${busy || index === jobs.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo">▼</button>`
      : '';
    item.innerHTML = `<div><strong>${escape(job.file.name)}</strong><small>${job.kind.toUpperCase()} · ${formatBytes(job.file.size)}</small></div><div class="file-item-actions">${reorder}<button type="button" ${busy ? 'disabled' : ''}>Remover</button></div>`;
    item.querySelectorAll<HTMLButtonElement>('button.reorder').forEach((btn) => {
      btn.addEventListener('click', () => moveJob(index, index + Number(btn.dataset.dir)));
    });
    item.querySelector<HTMLButtonElement>('button:not(.reorder)')!.addEventListener('click', () => { jobs.splice(index, 1); renderQueue(); });
    queue.append(item);
  });
  refreshOptionsButton();
}
function addFiles(files: FileList | File[]): void {
  const added = Array.from(files).map((file) => ({ file, kind: kind(file), output: output.value as OutputKind, state: 'Pronto' })).filter((job): job is Job => job.kind !== null);
  jobs.push(...added);
  renderQueue();
  setStatus(added.length ? 'Pronto para converter.' : 'Selecione TXT, Markdown, HTML, DOCX, PDF ou imagens (JPG/PNG).');
}
input.addEventListener('change', () => { addFiles(input.files ?? []); input.value = ''; });
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('over'); addFiles(event.dataTransfer?.files ?? []); });
reset.addEventListener('click', () => { jobs = []; results.replaceChildren(); renderQueue(); setStatus('Pronto para converter.'); });
theme.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; renderTheme(next); localStorage.setItem('appsbox-conv-documentos-theme', next); });
function bumpCount(): void {
  fetch('/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(async (response) => { if (response.ok) count.textContent = ((await response.json() as { total: number }).total).toLocaleString('pt-BR'); })
    .catch(() => undefined);
}
function addResult(name: string, blob: Blob): void {
  const link = document.createElement('a');
  link.className = 'result-item';
  link.download = name;
  link.href = URL.createObjectURL(blob);
  link.innerHTML = `<span>${escape(name)}</span><small>${formatBytes(blob.size)} · baixar</small>`;
  results.append(link);
  bumpCount();
}
function addError(message: string): void {
  const error = document.createElement('p');
  error.className = 'error';
  error.textContent = message;
  results.append(error);
}
const baseName = (job: Job): string => job.file.name.replace(/\.[^.]+$/, '');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !jobs.length) { setStatus(jobs.length ? 'A conversão já está em andamento.' : 'Selecione ao menos um documento.'); return; }
  busy = true; renderQueue(); results.replaceChildren();
  const outputKind = output.value as OutputKind;
  const done = (): void => { busy = false; renderQueue(); setStatus('Conversão concluída. Seus arquivos permaneceram neste dispositivo.'); };

  // Modo "combinar": fila só de imagens + saída PDF => um único PDF.
  if (outputKind === 'pdf' && jobs.length > 1 && jobs.every((job) => job.kind === 'image')) {
    try {
      const sources = [];
      for (let i = 0; i < jobs.length; i += 1) {
        setStatus(`Lendo ${jobs[i].file.name} — ${i + 1} de ${jobs.length}`, true);
        sources.push(await decodeImageFile(jobs[i].file));
      }
      setStatus('Montando o PDF…', true);
      addResult('imagens.pdf', new Blob([await imagesToPdfBytes(sources, outputOptions.image)] as BlobPart[], { type: PDF_MIME }));
    } catch { addError('Não foi possível combinar as imagens em um PDF.'); }
    done();
    return;
  }

  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    try {
      setStatus(`Lendo ${job.file.name} — ${index + 1} de ${jobs.length}`, true);
      if (job.kind === 'image') {
        if (outputKind !== 'pdf') { addError(`${job.file.name}: imagens só convertem para PDF.`); continue; }
        addResult(`${baseName(job)}.pdf`, new Blob([await imagesToPdfBytes([await decodeImageFile(job.file)], outputOptions.image)] as BlobPart[], { type: PDF_MIME }));
        continue;
      }
      // --- Lê a entrada para um texto/HTML intermediário ---
      const pdfStructured = job.kind === 'pdf' && outputKind !== 'txt';
      let text: string;
      let effectiveKind: TextKind;
      if (job.kind === 'docx') { text = await docxToHtml(await job.file.arrayBuffer()); effectiveKind = 'html'; }
      else if (job.kind === 'odt') { text = await odtToHtml(await job.file.arrayBuffer()); effectiveKind = 'html'; }
      else if (job.kind === 'rtf') { text = rtfToHtml(await job.file.text()); effectiveKind = 'html'; }
      else if (job.kind === 'csv') { text = csvToHtml(await job.file.text()); effectiveKind = 'html'; }
      else if (job.kind === 'pdf') { text = pdfStructured ? await pdfToStructured(await job.file.arrayBuffer()) : await pdfToText(await job.file.arrayBuffer()); effectiveKind = pdfStructured ? 'html' : 'txt'; }
      else { text = await job.file.text(); effectiveKind = job.kind; }

      // --- Escreve a saída ---
      const intermediateHtml = (): string => convertText(text, effectiveKind, 'html');
      let blob: Blob;
      if (outputKind === 'docx') blob = new Blob([await htmlToDocxBytes(intermediateHtml(), outputOptions.docx)] as BlobPart[], { type: DOCX_MIME });
      else if (outputKind === 'pdf') blob = new Blob([await htmlToPdfBytes(intermediateHtml(), outputOptions.pdf)] as BlobPart[], { type: PDF_MIME });
      else if (outputKind === 'odt') blob = new Blob([await htmlToOdtBytes(intermediateHtml())] as BlobPart[], { type: ODT_MIME });
      else if (outputKind === 'epub') blob = new Blob([await htmlToEpubBytes(intermediateHtml(), baseName(job))] as BlobPart[], { type: EPUB_MIME });
      else if (outputKind === 'rtf') blob = new Blob([htmlToRtf(intermediateHtml())], { type: RTF_MIME });
      else if (outputKind === 'csv') blob = new Blob([htmlToCsv(intermediateHtml())], { type: 'text/csv;charset=utf-8' });
      else blob = new Blob([convertText(text, effectiveKind, outputKind)], { type: outputKind === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' });
      addResult(`${baseName(job)}.${outputExtension(outputKind)}`, blob);
    } catch { addError(`Não foi possível converter ${job.file.name}.`); }
  }
  done();
});
function renderTheme(themeName: 'light' | 'dark'): void { document.documentElement.dataset.theme = themeName; theme.textContent = themeName === 'dark' ? '☀' : '☾'; theme.setAttribute('aria-label', themeName === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'); }
const initialTheme = localStorage.getItem('appsbox-conv-documentos-theme') === 'dark' ? 'dark' : 'light'; renderTheme(initialTheme);

const requestedOutput = new URLSearchParams(location.search).get('to');
if (requestedOutput && Array.from(output.options).some((option) => option.value === requestedOutput)) output.value = requestedOutput;
refreshOptionsButton();

fetch('/api/count').then(async (response) => { if (response.ok) count.textContent = ((await response.json() as { total: number }).total).toLocaleString('pt-BR'); }).catch(() => undefined);

type InstallChoice = { outcome: 'accepted' | 'dismissed' };
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };
const PWA_VISITS_KEY = 'appsbox-conv-documentos-pwa-visits';
const PWA_DISMISSED_KEY = 'appsbox-conv-documentos-pwa-dismissed';
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
function dismissInstallPrompt(): void { sessionStorage.setItem(PWA_DISMISSED_KEY, '1'); pwaInstallPrompt.hidden = true; }
async function installPwa(): Promise<void> { if (!deferredInstallPrompt) return; await deferredInstallPrompt.prompt(); const choice = await deferredInstallPrompt.userChoice; if (choice.outcome === 'dismissed') dismissInstallPrompt(); else pwaInstallPrompt.hidden = true; deferredInstallPrompt = null; }
pwaDismissButton.addEventListener('click', dismissInstallPrompt);
pwaInstallButton.addEventListener('click', () => void installPwa());
const pwaVisits = Number(sessionStorage.getItem(PWA_VISITS_KEY) ?? '0') + 1;
sessionStorage.setItem(PWA_VISITS_KEY, String(pwaVisits));
const pwaInstallEligible = pwaVisits >= 2 && !sessionStorage.getItem(PWA_DISMISSED_KEY);
window.addEventListener('beforeinstallprompt', (event: Event) => { const installEvent = event as BeforeInstallPromptEvent; installEvent.preventDefault(); deferredInstallPrompt = installEvent; pwaInstallPrompt.hidden = !pwaInstallEligible; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?release=__RELEASE__').catch(() => undefined);
