// RTF <-> HTML intermediário.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const { rtfToHtml, htmlToRtf } = await import('../dist/rtf.js');

test('htmlToRtf escapa chaves/barras e codifica acentos como \\uN', () => {
  const rtf = htmlToRtf('<p>Ação {x} \\ barra — fim</p>');
  assert.match(rtf, /^\{\\rtf1/);
  assert.ok(rtf.includes('\\{x\\}'), 'chaves escapadas');
  assert.match(rtf, /\\u231\?/); // ç
  assert.match(rtf, /\\u8212\?/); // travessão (—)
  assert.match(rtf, /\\par/);
});

test('htmlToRtf marca negrito, itálico e títulos', () => {
  const rtf = htmlToRtf('<h1>Título</h1><p>Com <strong>negrito</strong> e <em>itálico</em>.</p>');
  assert.match(rtf, /\\b\\fs40 /);
  assert.ok(rtf.includes('{\\b '), 'run em negrito');
  assert.ok(rtf.includes('{\\i '), 'run em itálico');
});

test('rtfToHtml lê parágrafos, negrito e itálico', () => {
  const html = rtfToHtml('{\\rtf1\\ansi\\fs24 Primeiro par\\u225?grafo.\\par {\\b Negrito} e {\\i it\\u225?lico}.\\par }');
  assert.match(html, /<p>Primeiro parágrafo\.<\/p>/);
  assert.match(html, /<strong>Negrito<\/strong>/);
  assert.match(html, /<em>itálico<\/em>/);
});

test('rtfToHtml ignora tabelas de fonte/cor e destinos com \\*', () => {
  const html = rtfToHtml('{\\rtf1{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator X;}\\fs24 Conte\\u250?do.\\par }');
  assert.match(html, /<p>Conteúdo\.<\/p>/);
  assert.doesNotMatch(html, /Arial|generator/);
});

test('round trip HTML -> RTF -> HTML preserva o texto e o negrito', () => {
  const back = rtfToHtml(htmlToRtf('<p>Texto <strong>forte</strong> aqui.</p>'));
  assert.match(back, /Texto/);
  assert.match(back, /<strong>forte<\/strong>/);
  assert.match(back, /aqui\./);
});
