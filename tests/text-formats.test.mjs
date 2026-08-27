// Conversões entre TXT/Markdown/HTML. Cobre o endurecimento de htmlToMarkdown
// (listas aninhadas, imagens, linguagem no code fence, blocos de definição).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const { htmlToMarkdown, markdownToHtml, convertText } = await import('../dist/text-formats.js');

test('htmlToMarkdown reconstrói listas aninhadas com indentação', () => {
  const md = htmlToMarkdown('<ul><li>Um<ul><li>Um.a</li><li>Um.b</li></ul></li><li>Dois</li></ul>');
  assert.match(md, /^- Um\n {2}- Um\.a\n {2}- Um\.b\n- Dois$/m);
});

test('htmlToMarkdown emite imagem e linguagem no code fence', () => {
  const md = htmlToMarkdown('<p>Veja <img src="/g.png" alt="gráfico"></p><pre><code class="language-python">print(1)</code></pre>');
  assert.match(md, /!\[gráfico\]\(\/g\.png\)/);
  assert.match(md, /```python\nprint\(1\)\n```/);
});

test('htmlToMarkdown trata blocos de definição', () => {
  const md = htmlToMarkdown('<dl><dt>Termo</dt><dd>Definição</dd></dl>');
  assert.match(md, /\*\*Termo\*\*\n: Definição/);
});

test('code fence antigo malformado não reaparece (bug do \\`` corrigido)', () => {
  const md = htmlToMarkdown('<pre><code>x = 1</code></pre>');
  assert.doesNotMatch(md, /\\``/);
  assert.match(md, /^```\nx = 1\n```$/m);
});

test('round trip Markdown -> HTML -> Markdown preserva imagem', () => {
  const html = markdownToHtml('Texto com ![alt](http://x/y.png) no meio.');
  assert.match(html, /<img src="http:\/\/x\/y\.png" alt="alt">/);
  const back = htmlToMarkdown(html);
  assert.match(back, /!\[alt\]\(http:\/\/x\/y\.png\)/);
});

test('convertText html->txt continua removendo marcação', () => {
  assert.equal(convertText('<p>Olá <strong>mundo</strong></p>', 'html', 'txt').trim(), 'Olá mundo');
});
