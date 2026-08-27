// E2E da orquestração (src/main.ts -> dist/main.js) em jsdom: seletor De -> Para,
// filtro de destino, rejeição de arquivo de tipo errado, aviso ao trocar a
// origem e modo "travado" das landing pages. Não faz conversão real de arquivo
// (coberta pelos testes por formato).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { converterCardHtml } from '../scripts/converter-widget.mjs';

const { outputsFor, INPUT_KINDS } = await import('../dist/formats.js');

const jszipSource = readFileSync(new URL('../public/vendor/jszip.js', import.meta.url), 'utf8');
const jszipModule = { exports: {} };
new Function('module', 'exports', jszipSource)(jszipModule, jszipModule.exports);

let bust = 0;
async function loadApp(cardOpts, url) {
  const page = `<!doctype html><html><body>` +
    `<header><button id="theme-toggle" type="button" aria-label="x">☾</button></header>` +
    converterCardHtml(cardOpts) +
    `<span id="conversion-count">—</span>` +
    `</body></html>`;
  const dom = new JSDOM(page, { url, pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.DOMParser = window.DOMParser;
  globalThis.Node = window.Node;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.location = window.location;
  globalThis.history = window.history;
  globalThis.JSZip = jszipModule.exports;
  window.URL.createObjectURL = () => 'blob:x';
  globalThis.URL = window.URL;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ total: 0 }) });
  await import(`../dist/main.js?bust=${bust++}`);
  return dom;
}

function dropFiles(dom, names) {
  const { window } = dom;
  const dropzone = window.document.querySelector('#dropzone');
  const files = names.map(([name, type]) => new window.File(['conteúdo'], name, { type }));
  const ev = new window.Event('drop', { bubbles: true });
  ev.dataTransfer = { files };
  dropzone.dispatchEvent(ev);
}

test('unlocked: #source com as 8 entradas e #output filtrado pela origem', async () => {
  const dom = await loadApp({ locked: false, from: 'txt', to: 'md' }, 'https://x.test/');
  const doc = dom.window.document;
  const source = doc.querySelector('#source');
  assert.ok(source, '#source existe no modo unlocked');
  assert.equal(source.options.length, INPUT_KINDS.length);
  assert.equal(source.value, INPUT_KINDS[0]);
  const outs = [...doc.querySelector('#output').options].map((o) => o.value);
  assert.deepEqual(outs, outputsFor(INPUT_KINDS[0]));
});

test('unlocked: ?de=pdf&para=docx pré-seleciona o par', async () => {
  const dom = await loadApp({ locked: false, from: 'txt', to: 'md' }, 'https://x.test/?de=pdf&para=docx');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#source').value, 'pdf');
  assert.equal(doc.querySelector('#output').value, 'docx');
  assert.match(doc.querySelector('#files').getAttribute('accept'), /application\/pdf/);
});

test('rejeita arquivo de tipo diferente da origem; aceita o tipo certo', async () => {
  const dom = await loadApp({ locked: false, from: 'txt', to: 'md' }, 'https://x.test/');
  const doc = dom.window.document;
  dropFiles(dom, [['foto.png', 'image/png']]);
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 0);
  assert.equal(doc.querySelectorAll('#results .error').length, 1);
  dropFiles(dom, [['nota.txt', 'text/plain']]);
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 1);
});

test('trocar a origem com arquivos na fila abre o aviso; cancelar reverte', async () => {
  const dom = await loadApp({ locked: false, from: 'txt', to: 'md' }, 'https://x.test/');
  const doc = dom.window.document;
  dropFiles(dom, [['nota.txt', 'text/plain']]);
  const source = doc.querySelector('#source');
  const confirmDialog = doc.querySelector('#confirm-dialog');
  source.value = 'csv';
  source.dispatchEvent(new dom.window.Event('change'));
  // cancelar
  confirmDialog.returnValue = 'cancel';
  confirmDialog.dispatchEvent(new dom.window.Event('close'));
  assert.equal(source.value, 'txt', 'origem revertida');
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 1, 'arquivos preservados');
});

test('trocar a origem e confirmar limpa a fila e aplica a nova origem', async () => {
  const dom = await loadApp({ locked: false, from: 'txt', to: 'md' }, 'https://x.test/');
  const doc = dom.window.document;
  dropFiles(dom, [['nota.txt', 'text/plain']]);
  const source = doc.querySelector('#source');
  const confirmDialog = doc.querySelector('#confirm-dialog');
  source.value = 'csv';
  source.dispatchEvent(new dom.window.Event('change'));
  confirmDialog.returnValue = 'confirm';
  confirmDialog.dispatchEvent(new dom.window.Event('close'));
  assert.equal(source.value, 'csv');
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 0, 'fila limpa');
  const outs = [...doc.querySelector('#output').options].map((o) => o.value);
  assert.deepEqual(outs, outputsFor('csv'));
});

test('locked txt→md: converte de verdade e gera link de download', async () => {
  const dom = await loadApp({ locked: true, from: 'txt', to: 'md' }, 'https://x.test/converter/txt-para-md/');
  const doc = dom.window.document;
  dropFiles(dom, [['nota.txt', 'text/plain']]);
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 1);
  doc.querySelector('#converter-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 50));
  const links = doc.querySelectorAll('#results a.result-item');
  assert.equal(links.length, 1, 'um resultado');
  assert.match(links[0].getAttribute('download'), /\.md$/);
  assert.equal(doc.querySelectorAll('#results .error').length, 0);
});

test('locked: sem #source, #output fixo no destino, accept da origem', async () => {
  const dom = await loadApp({ locked: true, from: 'pdf', to: 'docx' }, 'https://x.test/converter/pdf-para-docx/');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#source'), null, 'sem seletor de origem');
  assert.equal(doc.querySelector('#output').value, 'docx');
  assert.match(doc.querySelector('#files').getAttribute('accept'), /application\/pdf/);
  assert.match(doc.querySelector('#dropzone-hint').textContent, /\.pdf/);
  dropFiles(dom, [['x.txt', 'text/plain']]);
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 0, 'txt rejeitado quando origem é pdf');
  dropFiles(dom, [['x.pdf', 'application/pdf']]);
  assert.equal(doc.querySelectorAll('#queue .file-item').length, 1);
});
