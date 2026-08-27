// ODT <-> HTML intermediário, com o JSZip vendorizado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const jszipSource = readFileSync(new URL('../public/vendor/jszip.js', import.meta.url), 'utf8');
const jszipModule = { exports: {} };
new Function('module', 'exports', jszipSource)(jszipModule, jszipModule.exports);
globalThis.JSZip = jszipModule.exports;

const { htmlToOdtBytes, odtToHtml } = await import('../dist/odt.js');

test('pacote ODT tem mimetype STORE como primeira entrada', async () => {
  const bytes = await htmlToOdtBytes('<h1>Oi</h1><p>corpo</p>');
  // Assinatura ZIP + nome "mimetype" logo no início, sem compressão (o valor
  // aparece literal logo após o nome).
  const head = String.fromCharCode(...bytes.slice(0, 80));
  assert.match(head, /^PK/);
  assert.ok(head.includes('mimetype'));
  assert.ok(head.includes('application/vnd.oasis.opendocument.text'));
});

test('round trip HTML -> ODT -> HTML preserva títulos, ênfases, lista e tabela', async () => {
  const html = '<h2>Seção</h2><p>Texto <strong>negrito</strong>, <em>itálico</em> e <a href="https://appsbox.com.br">link</a>.</p>' +
    '<ul><li>Item A</li><li>Item B</li></ul>' +
    '<table><tr><th>Col</th></tr><tr><td>Val</td></tr></table>';
  const back = await odtToHtml(await htmlToOdtBytes(html));
  assert.match(back, /<h2>Seção<\/h2>/);
  assert.match(back, /<strong>negrito<\/strong>/);
  assert.match(back, /<em>itálico<\/em>/);
  assert.match(back, /<a href="https:\/\/appsbox\.com\.br">link<\/a>/);
  assert.match(back, /<ul><li>Item A<\/li><li>Item B<\/li><\/ul>/);
  assert.match(back, /<table><tr><td>(?:<strong>)?Col(?:<\/strong>)?<\/td><\/tr><tr><td>Val<\/td><\/tr><\/table>/);
});

test('odtToHtml rejeita um arquivo que não é um pacote ODT', async () => {
  await assert.rejects(() => odtToHtml(new TextEncoder().encode('não é zip')));
});
