// CSV/TSV <-> tabela. Parser RFC 4180 e serialização.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const { parseCsv, detectDelimiter, csvToHtml, htmlToCsv } = await import('../dist/csv.js');

test('parseCsv respeita aspas, vírgula e quebra de linha embutidas', () => {
  const rows = parseCsv('a,b,c\n1,"x, y","linha\nquebrada"\n3,"aspas ""dentro""",z');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['1', 'x, y', 'linha\nquebrada'],
    ['3', 'aspas "dentro"', 'z'],
  ]);
});

test('detectDelimiter distingue vírgula, ponto e vírgula e tab', () => {
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a\tb\tc'), '\t');
  assert.equal(detectDelimiter('a,b,c'), ',');
});

test('csvToHtml gera tabela com cabeçalho e htmlToCsv volta ao original', () => {
  const html = csvToHtml('Nome,Idade\nAna,30\nBeto,25');
  assert.match(html, /<table><tr><th>Nome<\/th><th>Idade<\/th><\/tr><tr><td>Ana<\/td><td>30<\/td><\/tr>/);
  const csv = htmlToCsv(html);
  assert.equal(csv, 'Nome,Idade\r\nAna,30\r\nBeto,25\r\n');
});

test('htmlToCsv sem tabela usa uma coluna por linha', () => {
  const csv = htmlToCsv('<p>primeira</p><p>segunda, com vírgula</p>');
  assert.equal(csv, 'primeira\r\n"segunda, com vírgula"\r\n');
});
