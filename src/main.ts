import { docxToHtml, htmlToDocxBytes, DEFAULT_DOCX_OPTIONS, type DocxOptions } from './docx.js';
import { htmlToPdfBytes, pdfToText, pdfToStructured, DEFAULT_PDF_OPTIONS, type PdfOptions } from './pdf.js';
import { convertText, type TextKind } from './text-formats.js';
import { csvToHtml, htmlToCsv } from './csv.js';
import { rtfToHtml, htmlToRtf } from './rtf.js';
import { odtToHtml, htmlToOdtBytes } from './odt.js';
import { htmlToEpubBytes } from './epub.js';
import {
  FORMATS,
  INPUT_KINDS,
  outputsFor,
  isInputKind,
  isOutputKind,
  kindFromName,
  type InputKind,
  type OutputKind,
} from './formats.js';
export {};

type Job = { file: File; kind: InputKind; state: string };
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const RTF_MIME = 'application/rtf';
const ODT_MIME = 'application/vnd.oasis.opendocument.text';
const EPUB_MIME = 'application/epub+zip';

const OUTPUT_LABELS: Record<OutputKind, string> = {
  html: 'HTML — preservar leitura no navegador',
  txt: 'TXT — texto simples',
  md: 'Markdown — estrutura leve',
  docx: 'DOCX — documento do Word',
  pdf: 'PDF — documento portátil',
  rtf: 'RTF — texto formatado',
  odt: 'ODT — documento do LibreOffice',
  csv: 'CSV — planilha (tabelas)',
  epub: 'EPUB — livro digital',
};

const widget = document.querySelector<HTMLElement>('#converter-widget');
const input = document.querySelector<HTMLInputElement>('#files')!;
const dropzone = document.querySelector<HTMLElement>('#dropzone')!;
const dropzoneHint = document.querySelector<HTMLElement>('#dropzone-hint');
const queue = document.querySelector<HTMLElement>('#queue')!;
const source = document.querySelector<HTMLSelectElement>('#source');
const output = document.querySelector<HTMLSelectElement>('#output')!;
const form = document.querySelector<HTMLFormElement>('#converter-form')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const confirmDialog = document.querySelector<HTMLDialogElement>('#confirm-dialog');
const count = document.querySelector<HTMLElement>('#conversion-count');
const theme = document.querySelector<HTMLButtonElement>('#theme-toggle');
const pwaInstallPrompt = document.querySelector<HTMLElement>('#pwa-install-prompt');
const pwaInstallButton = document.querySelector<HTMLButtonElement>('#pwa-install');
const pwaDismissButton = document.querySelector<HTMLButtonElement>('#pwa-dismiss');

let jobs: Job[] = [];
let busy = false;

// Modo "travado": a página já fixa o par (origem+destino) — usado nas landing
// pages /converter/<par>/. Sem seletor de origem, sem sincronização de URL.
const locked = widget?.dataset.locked === '1';
const params = new URLSearchParams(location.search);
const paramFrom = params.get('de') ?? params.get('from') ?? '';
const paramTo = params.get('para') ?? params.get('to') ?? '';

function initialSource(): InputKind {
  const fromData = widget?.dataset.from ?? '';
  if (isInputKind(fromData)) return fromData;
  if (isInputKind(paramFrom)) return paramFrom;
  return INPUT_KINDS[0];
}
let currentSource: InputKind = initialSource();
let previousSource: InputKind = currentSource;
let pendingSource: InputKind | null = null;

// ---------------------------------------------------------------------------
// Opções de saída (painel "Opções de saída"). Persistido em localStorage;
// só PDF e DOCX têm o que configurar — os demais formatos são texto puro.
// ---------------------------------------------------------------------------
type OutputOptions = { pdf: PdfOptions; docx: DocxOptions };
const OPTIONS_KEY = 'appsbox-conv-documentos-options';
function defaultOptions(): OutputOptions {
  return { pdf: { ...DEFAULT_PDF_OPTIONS }, docx: { ...DEFAULT_DOCX_OPTIONS } };
}
function loadOptions(): OutputOptions {
  const base = defaultOptions();
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<OutputOptions>;
      if (saved.pdf) Object.assign(base.pdf, saved.pdf);
      if (saved.docx) Object.assign(base.docx, saved.docx);
    }
  } catch { /* storage indisponível ou JSON inválido: usa defaults */ }
  return base;
}
function saveOptions(value: OutputOptions): void {
  try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(value)); } catch { /* ignora */ }
}
let outputOptions = loadOptions();

const optionsPanel = document.querySelector<HTMLDetailsElement>('#options-panel')!;
const optionsForm = document.querySelector<HTMLElement>('#options-form')!;
const optionsReset = document.querySelector<HTMLButtonElement>('#options-reset')!;
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
  };
}
function showRelevantOptionsGroup(): void {
  const kind = output.value;
  optionsForm.querySelectorAll<HTMLElement>('.options-group').forEach((group) => {
    group.hidden = group.dataset.for !== kind;
  });
}
// Sanfona embutida: visível e aberta só quando o destino tem opções (PDF/DOCX);
// escondida (fechada) para os formatos de texto puro.
function refreshOptionsPanel(): void {
  const has = output.value === 'pdf' || output.value === 'docx';
  optionsPanel.hidden = !has;
  if (has) {
    optionsPanel.open = true;
    showRelevantOptionsGroup();
    syncOptionsForm();
  }
}
optionsForm.addEventListener('change', () => { outputOptions = readOptionsForm(); saveOptions(outputOptions); });
optionsReset.addEventListener('click', () => {
  outputOptions = defaultOptions();
  saveOptions(outputOptions);
  syncOptionsForm();
});

// ---------------------------------------------------------------------------
// Par de conversão (origem -> destino)
// ---------------------------------------------------------------------------
function rebuildOutputOptions(): void {
  if (locked) return;
  const keep = output.value;
  const valid = outputsFor(currentSource);
  output.replaceChildren(...valid.map((kind) => {
    const opt = document.createElement('option');
    opt.value = kind;
    opt.textContent = OUTPUT_LABELS[kind];
    return opt;
  }));
  output.value = valid.includes(keep as OutputKind) ? keep : (valid[0] ?? 'txt');
}
function syncUrl(): void {
  if (locked) return;
  try {
    history.replaceState(null, '', `${location.pathname}?de=${currentSource}&para=${output.value}`);
  } catch { /* ambientes sem History API: ignora */ }
}
function applySource(next: InputKind, clearFiles: boolean): void {
  currentSource = next;
  if (source) source.value = next;
  input.setAttribute('accept', FORMATS[next].accept);
  if (dropzoneHint) dropzoneHint.textContent = `Arquivos ${FORMATS[next].ext} · vários de uma vez`;
  rebuildOutputOptions();
  if (clearFiles) { jobs = []; results.replaceChildren(); }
  renderQueue();
  refreshOptionsPanel();
  syncUrl();
}
if (source) {
  source.replaceChildren(...INPUT_KINDS.map((kind) => {
    const opt = document.createElement('option');
    opt.value = kind;
    opt.textContent = FORMATS[kind].label;
    return opt;
  }));
  source.value = currentSource;
  source.addEventListener('change', () => {
    const next = source.value;
    if (!isInputKind(next) || next === currentSource) return;
    if (jobs.length && confirmDialog) {
      pendingSource = next;
      try { confirmDialog.showModal(); } catch { confirmDialog.setAttribute('open', ''); }
    } else {
      applySource(next, false);
      previousSource = next;
    }
  });
}
confirmDialog?.addEventListener('close', () => {
  if (confirmDialog.returnValue === 'confirm' && pendingSource) {
    applySource(pendingSource, true);
    previousSource = pendingSource;
  } else if (source) {
    source.value = previousSource;
  }
  pendingSource = null;
});
output.addEventListener('change', () => { refreshOptionsPanel(); renderQueue(); syncUrl(); });

function setStatus(value: string, active = false): void { statusEl.textContent = value; statusEl.classList.toggle('busy', active); }
function escape(value: string): string { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function formatBytes(value: number): string { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }

function renderQueue(): void {
  queue.replaceChildren();
  const summary = document.querySelector('#file-summary');
  if (summary) {
    summary.textContent = jobs.length
      ? `${jobs.length} arquivo(s) — ${FORMATS[currentSource].label} → ${output.value.toUpperCase()}`
      : 'Nenhum arquivo selecionado';
  }
  jobs.forEach((job, index) => {
    const item = document.createElement('article');
    item.className = 'file-item';
    item.innerHTML = `<div><strong>${escape(job.file.name)}</strong><small>${job.kind.toUpperCase()} · ${formatBytes(job.file.size)}</small></div><div class="file-item-actions"><button type="button" ${busy ? 'disabled' : ''}>Remover</button></div>`;
    item.querySelector<HTMLButtonElement>('button')!.addEventListener('click', () => { jobs.splice(index, 1); renderQueue(); });
    queue.append(item);
  });
  refreshOptionsPanel();
}
function addFiles(files: FileList | File[]): void {
  let accepted = 0;
  for (const file of Array.from(files)) {
    const detected = kindFromName(file.name);
    if (detected !== currentSource) {
      addError(`${file.name}: selecione um arquivo ${FORMATS[currentSource].ext}.`);
      continue;
    }
    jobs.push({ file, kind: detected, state: 'Pronto' });
    accepted += 1;
  }
  renderQueue();
  if (accepted) setStatus('Pronto para converter.');
}
input.addEventListener('change', () => { addFiles(input.files ?? []); input.value = ''; });
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('over'); addFiles(event.dataTransfer?.files ?? []); });
reset.addEventListener('click', () => { jobs = []; results.replaceChildren(); renderQueue(); setStatus('Pronto para converter.'); });
theme?.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; renderTheme(next); localStorage.setItem('appsbox-conv-documentos-theme', next); });

function bumpCount(): void {
  fetch('/api/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(async (response) => { if (response.ok && count) count.textContent = ((await response.json() as { total: number }).total).toLocaleString('pt-BR'); })
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

  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    try {
      setStatus(`Lendo ${job.file.name} — ${index + 1} de ${jobs.length}`, true);
      // --- Lê a entrada para um texto/HTML intermediário ---
      const pdfStructured = job.kind === 'pdf' && outputKind !== 'txt';
      let text: string;
      let effectiveKind: TextKind;
      if (job.kind === 'docx') { text = await docxToHtml(await job.file.arrayBuffer()); effectiveKind = 'html'; }
      else if (job.kind === 'odt') { text = await odtToHtml(await job.file.arrayBuffer()); effectiveKind = 'html'; }
      else if (job.kind === 'rtf') { text = rtfToHtml(await job.file.text()); effectiveKind = 'html'; }
      else if (job.kind === 'csv') { text = csvToHtml(await job.file.text()); effectiveKind = 'html'; }
      else if (job.kind === 'pdf') { text = pdfStructured ? await pdfToStructured(await job.file.arrayBuffer()) : await pdfToText(await job.file.arrayBuffer()); effectiveKind = pdfStructured ? 'html' : 'txt'; }
      else { text = await job.file.text(); effectiveKind = job.kind as TextKind; }

      // --- Escreve a saída ---
      const intermediateHtml = (): string => convertText(text, effectiveKind, 'html');
      let blob: Blob;
      if (outputKind === 'docx') blob = new Blob([await htmlToDocxBytes(intermediateHtml(), outputOptions.docx)] as BlobPart[], { type: DOCX_MIME });
      else if (outputKind === 'pdf') blob = new Blob([await htmlToPdfBytes(intermediateHtml(), outputOptions.pdf)] as BlobPart[], { type: PDF_MIME });
      else if (outputKind === 'odt') blob = new Blob([await htmlToOdtBytes(intermediateHtml())] as BlobPart[], { type: ODT_MIME });
      else if (outputKind === 'epub') blob = new Blob([await htmlToEpubBytes(intermediateHtml(), baseName(job))] as BlobPart[], { type: EPUB_MIME });
      else if (outputKind === 'rtf') blob = new Blob([htmlToRtf(intermediateHtml())], { type: RTF_MIME });
      else if (outputKind === 'csv') blob = new Blob([htmlToCsv(intermediateHtml())], { type: 'text/csv;charset=utf-8' });
      else blob = new Blob([convertText(text, effectiveKind, outputKind as TextKind)], { type: outputKind === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' });
      addResult(`${baseName(job)}.${outputKind}`, blob);
    } catch { addError(`Não foi possível converter ${job.file.name}.`); }
  }
  done();
});

function renderTheme(themeName: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = themeName;
  if (theme) {
    theme.textContent = themeName === 'dark' ? '☀' : '☾';
    theme.setAttribute('aria-label', themeName === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
  }
}
const initialTheme = localStorage.getItem('appsbox-conv-documentos-theme') === 'dark' ? 'dark' : 'light';
renderTheme(initialTheme);

// --- Inicialização do par de conversão ---
if (locked) {
  const to = widget?.dataset.to ?? '';
  if (isOutputKind(to)) output.value = to;
  input.setAttribute('accept', FORMATS[currentSource].accept);
  if (dropzoneHint) dropzoneHint.textContent = `Arquivos ${FORMATS[currentSource].ext} · vários de uma vez`;
} else {
  applySource(currentSource, false);
  if (isOutputKind(paramTo) && outputsFor(currentSource).includes(paramTo)) {
    output.value = paramTo;
    syncUrl();
  }
}
refreshOptionsPanel();
renderQueue();

if (count) {
  fetch('/api/count').then(async (response) => { if (response.ok) count!.textContent = ((await response.json() as { total: number }).total).toLocaleString('pt-BR'); }).catch(() => undefined);
}

type InstallChoice = { outcome: 'accepted' | 'dismissed' };
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };
const PWA_VISITS_KEY = 'appsbox-conv-documentos-pwa-visits';
const PWA_DISMISSED_KEY = 'appsbox-conv-documentos-pwa-dismissed';
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
function dismissInstallPrompt(): void { sessionStorage.setItem(PWA_DISMISSED_KEY, '1'); if (pwaInstallPrompt) pwaInstallPrompt.hidden = true; }
async function installPwa(): Promise<void> {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === 'dismissed') dismissInstallPrompt();
  else if (pwaInstallPrompt) pwaInstallPrompt.hidden = true;
  deferredInstallPrompt = null;
}
if (pwaInstallPrompt && pwaInstallButton && pwaDismissButton) {
  pwaDismissButton.addEventListener('click', dismissInstallPrompt);
  pwaInstallButton.addEventListener('click', () => void installPwa());
  const pwaVisits = Number(sessionStorage.getItem(PWA_VISITS_KEY) ?? '0') + 1;
  sessionStorage.setItem(PWA_VISITS_KEY, String(pwaVisits));
  const pwaInstallEligible = pwaVisits >= 2 && !sessionStorage.getItem(PWA_DISMISSED_KEY);
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    const installEvent = event as BeforeInstallPromptEvent;
    installEvent.preventDefault();
    deferredInstallPrompt = installEvent;
    pwaInstallPrompt.hidden = !pwaInstallEligible;
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?release=__RELEASE__').catch(() => undefined);
