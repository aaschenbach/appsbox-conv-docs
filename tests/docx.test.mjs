// Fixture: sintético, gerado neste teste. Cobre acentuação em português,
// negrito/itálico, listas, tabela e link — round trip DOCX <-> HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

// public/vendor/jszip.js é um build UMD; avaliado aqui em um escopo CommonJS
// isolado para não colidir com o `type: module` deste pacote.
const jszipSource = readFileSync(new URL('../public/vendor/jszip.js', import.meta.url), 'utf8');
const jszipModule = { exports: {} };
new Function('module', 'exports', jszipSource)(jszipModule, jszipModule.exports);
globalThis.JSZip = jszipModule.exports;

const { htmlToDocxBytes, docxToHtml } = await import('../dist/docx.js');

test('round trip preserves headings, formatting, lists, tables, links and acentuação', async () => {
  const html = '<!doctype html><html><body>' +
    '<h1>Título com acentuação: ção, ã, é</h1>' +
    '<p>Texto <strong>negrito</strong> e <em>itálico</em> com <a href="https://appsbox.com.br">link</a>.</p>' +
    '<ul><li>Item um</li><li>Item dois</li></ul>' +
    '<ol><li>Primeiro</li><li>Segundo</li></ol>' +
    '<table><tr><th>Coluna</th></tr><tr><td>Valor</td></tr></table>' +
    '</body></html>';

  const bytes = await htmlToDocxBytes(html);
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.byteLength > 0);

  const roundTripped = await docxToHtml(bytes);
  assert.match(roundTripped, /<h1>Título com acentuação: ção, ã, é<\/h1>/);
  assert.match(roundTripped, /<strong>negrito<\/strong>/);
  assert.match(roundTripped, /<em>itálico<\/em>/);
  assert.match(roundTripped, /<a href="https:\/\/appsbox\.com\.br">link<\/a>/);
  assert.match(roundTripped, /<ul><li>Item um<\/li><li>Item dois<\/li><\/ul>/);
  assert.match(roundTripped, /<ol><li>Primeiro<\/li><li>Segundo<\/li><\/ol>/);
  assert.match(roundTripped, /<table>.*Coluna.*Valor.*<\/table>/s);
});

test('reads lists that use ListBullet/ListNumber styles without numPr (common in Word/python-docx output)', async () => {
  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' +
    '<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>Item A</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>Item B</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>Primeiro</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>Segundo</w:t></w:r></w:p>' +
    '</w:body></w:document>';
  const zip = new JSZip();
  zip.file('word/document.xml', documentXml);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const html = await docxToHtml(bytes);
  assert.match(html, /<ul><li>Item A<\/li><li>Item B<\/li><\/ul>/);
  assert.match(html, /<ol><li>Primeiro<\/li><li>Segundo<\/li><\/ol>/);
});

test('rejects a file that is not a valid docx package', async () => {
  const notDocx = new TextEncoder().encode('não é um zip');
  await assert.rejects(() => docxToHtml(notDocx));
});
