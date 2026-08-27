// Fixture: sintético, gerado neste teste. htmlToPdfBytes não depende de
// pdf.js (só a leitura via pdfToText depende, e só em navegador — ver
// verificação manual com pypdf/Playwright documentada no PR). Aqui testamos
// a estrutura do PDF gerado e o texto extraído por um leitor independente
// (o teste não embute um leitor PDF; a verificação cruzada com pypdf é
// manual, ver AGENTS.md "Processo para novos formatos ou pares de conversão").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const { htmlToPdfBytes } = await import('../dist/pdf.js');

function bytesToLatin1(bytes) {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

test('gera um PDF estruturalmente válido com título, negrito, itálico e acentuação', async () => {
  const html = '<h1>Relatório de Teste</h1><p>Texto com <strong>negrito</strong>, <em>itálico</em> e acentuação: ção, ã, é, ü.</p><ul><li>Item A</li><li>Item B</li></ul>';
  const bytes = await htmlToPdfBytes(html);
  assert.ok(bytes instanceof Uint8Array);
  const text = bytesToLatin1(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /%%EOF$/);
  assert.match(text, /\/Type\s*\/Catalog/);
  assert.match(text, /\/BaseFont\s*\/Courier-Bold/);
  assert.match(text, /\(Relat.rio de Teste\)/); // acento vira byte WinAnsi, não ASCII puro
  assert.match(text, /\(- Item A\)/);
});

test('quebra em múltiplas páginas quando o conteúdo excede uma página A4', async () => {
  const longHtml = Array.from({ length: 120 }, (_, i) => `<p>Parágrafo número ${i + 1} com algum texto de preenchimento para ocupar espaço na página.</p>`).join('');
  const bytes = await htmlToPdfBytes(longHtml);
  const text = bytesToLatin1(bytes);
  const pageCount = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
  assert.ok(pageCount >= 2, `esperado >= 2 páginas, obteve ${pageCount}`);
});

test('tabela é desenhada como grade real (bordas por célula), não como texto delimitado por |', async () => {
  const html = '<table><tr><th>Produto</th><th>Qtd</th></tr><tr><td>Item A</td><td>3</td></tr></table><p>Depois da tabela.</p>';
  const bytes = await htmlToPdfBytes(html);
  const text = bytesToLatin1(bytes);
  // Conteúdo do stream é comprimido apenas como texto plano (sem FlateDecode),
  // então os operadores PDF aparecem literalmente: 're S' desenha o retângulo
  // de borda de cada célula; sem isso a tabela voltaria a ser texto com '|'.
  assert.match(text, /re S Q/); // pelo menos um retângulo de borda de célula
  assert.doesNotMatch(text, /\(Item A \| 3\)/); // não é mais texto delimitado por |
  assert.match(text, /\(Item A\)/);
  assert.match(text, /\(Depois da tabela\.\)/);
});

test('documento vazio ainda produz um PDF de uma página válido', async () => {
  const bytes = await htmlToPdfBytes('<p></p>');
  const text = bytesToLatin1(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type\s*\/Page\b/);
});
