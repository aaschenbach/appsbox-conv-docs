// HTML -> EPUB 3 (só saída), com o JSZip vendorizado.
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

const { htmlToEpubBytes } = await import('../dist/epub.js');

async function openEpub(bytes) {
  return jszipModule.exports.loadAsync(bytes);
}

test('EPUB tem mimetype STORE primeiro, container, opf, nav e conteúdo', async () => {
  const bytes = await htmlToEpubBytes('<h1>Meu Livro</h1><h2>Capítulo 1</h2><p>Era uma vez.</p>', 'Meu Livro');
  const head = String.fromCharCode(...bytes.slice(0, 80));
  assert.match(head, /^PK/);
  assert.ok(head.includes('mimetype'));
  assert.ok(head.includes('application/epub+zip'));

  const zip = await openEpub(bytes);
  const container = await zip.file('META-INF/container.xml').async('string');
  assert.match(container, /full-path="OEBPS\/content\.opf"/);

  const opf = await zip.file('OEBPS/content.opf').async('string');
  assert.match(opf, /<dc:title>Meu Livro<\/dc:title>/);
  assert.match(opf, /<dc:language>pt-BR<\/dc:language>/);
  assert.match(opf, /properties="nav"/);

  const nav = await zip.file('OEBPS/nav.xhtml').async('string');
  assert.match(nav, /Capítulo 1/);
  assert.match(nav, /href="text\.xhtml#sec-/);

  const textXhtml = await zip.file('OEBPS/text.xhtml').async('string');
  assert.match(textXhtml, /<h1[^>]*id="sec-1"[^>]*>Meu Livro<\/h1>|<h1 id="sec-1">Meu Livro<\/h1>/);
  assert.match(textXhtml, /Era uma vez\./);
});

test('elementos vazios são fechados para XHTML', async () => {
  const zip = await openEpub(await htmlToEpubBytes('<p>linha um<br>linha dois</p><hr>'));
  const textXhtml = await zip.file('OEBPS/text.xhtml').async('string');
  assert.match(textXhtml, /<br\/>/);
  assert.match(textXhtml, /<hr\/>/);
  assert.doesNotMatch(textXhtml, /<br>/);
});
