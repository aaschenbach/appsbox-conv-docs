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

const { htmlToPdfBytes, linesToStructuredHtml } = await import('../dist/pdf.js');

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
  // Default: família sans → Helvetica proporcional (não mais Courier).
  assert.match(text, /\/BaseFont\s*\/Helvetica-Bold/);
  assert.doesNotMatch(text, /\/BaseFont\s*\/Courier(?!-)/); // Courier só entra para `code`
  assert.match(text, /\(Relat.rio de Teste\)/); // acento vira byte WinAnsi, não ASCII puro
  assert.match(text, /\(Item A\)/); // marcador de lista é desenhado à parte, texto fica limpo
});

test('quebra em múltiplas páginas quando o conteúdo excede uma página A4', async () => {
  const longHtml = Array.from({ length: 120 }, (_, i) => `<p>Parágrafo número ${i + 1} com algum texto de preenchimento para ocupar espaço na página.</p>`).join('');
  const bytes = await htmlToPdfBytes(longHtml);
  const text = bytesToLatin1(bytes);
  const pageCount = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
  assert.ok(pageCount >= 2, `esperado >= 2 páginas, obteve ${pageCount}`);
  // Número de página ligado por padrão: "n / N" aparece no rodapé.
  assert.match(text, /\(1 \/ \d+\) Tj/);
});

test('quebra de linha é proporcional: linha longa não estoura a largura útil', async () => {
  // "iii..." é estreito em fonte proporcional; "WWW..." é largo. Com quebra por
  // contagem de caractere ambos quebrariam no mesmo ponto; com medição real, a
  // linha de W tem muito menos caracteres por linha do que a de i.
  const narrow = await htmlToPdfBytes(`<p>${'i'.repeat(400)}</p>`);
  const wide = await htmlToPdfBytes(`<p>${'W'.repeat(400)}</p>`);
  const countTj = (bytes) => (bytesToLatin1(bytes).match(/\) Tj/g) ?? []).length;
  assert.ok(countTj(wide) > countTj(narrow), 'texto largo deve gerar mais linhas que texto estreito');
});

test('links viram anotações /Link clicáveis com ação URI', async () => {
  const bytes = await htmlToPdfBytes('<p>Veja o <a href="https://appsbox.com.br/x">portal</a>.</p>');
  const text = bytesToLatin1(bytes);
  assert.match(text, /\/Subtype\s*\/Link/);
  assert.match(text, /\/S\s*\/URI\s*\/URI\s*\(https:\/\/appsbox\.com\.br\/x\)/);
  assert.match(text, /\/Annots\s*\[/);
});

test('opções alteram fonte, tamanho de página e rodapé', async () => {
  const bytes = await htmlToPdfBytes('<h1>T</h1><p>corpo</p>', {
    fontFamily: 'serif',
    pageSize: 'letter',
    pageNumbers: false,
  });
  const text = bytesToLatin1(bytes);
  assert.match(text, /\/BaseFont\s*\/Times-Roman/);
  assert.match(text, /\/MediaBox \[0 0 612 792\]/); // Carta, não A4
  assert.doesNotMatch(text, /\(1 \/ 1\) Tj/); // sem rodapé de número de página
});

test('tabela é desenhada como grade real (bordas por célula), não como texto delimitado por |', async () => {
  const html = '<table><tr><th>Produto</th><th>Qtd</th></tr><tr><td>Item A</td><td>3</td></tr></table><p>Depois da tabela.</p>';
  const bytes = await htmlToPdfBytes(html);
  const text = bytesToLatin1(bytes);
  // Conteúdo do stream é gravado como texto plano (sem FlateDecode), então os
  // operadores PDF aparecem literalmente: 're S' desenha o retângulo de borda
  // de cada célula; sem isso a tabela voltaria a ser texto com '|'.
  assert.match(text, /re S Q/); // pelo menos um retângulo de borda de célula
  assert.doesNotMatch(text, /\(Item A \| 3\)/); // não é mais texto delimitado por |
  assert.match(text, /\(Item A\)/);
  assert.match(text, /\(Depois da tabela\.\)/);
});

test('linesToStructuredHtml reconstrói títulos, listas e parágrafos por tamanho de fonte', () => {
  const page = [
    { text: 'Título Principal', size: 24, x: 56, bold: true },
    { text: 'Primeiro parágrafo do corpo, com bastante texto para pesar', size: 12, x: 56, bold: false },
    { text: 'que continua aqui na linha seguinte do mesmo parágrafo.', size: 12, x: 56, bold: false },
    { text: 'Subseção', size: 19, x: 56, bold: true },
    { text: '• primeiro item', size: 12, x: 56, bold: false },
    { text: '• segundo item', size: 12, x: 56, bold: false },
    { text: '1. passo um', size: 12, x: 56, bold: false },
    { text: '2. passo dois', size: 12, x: 56, bold: false },
  ];
  const html = linesToStructuredHtml([page]);
  assert.match(html, /<h1>Título Principal<\/h1>/);
  assert.match(html, /<h2>Subseção<\/h2>/);
  assert.match(html, /<p>Primeiro parágrafo do corpo.*linha seguinte do mesmo parágrafo\.<\/p>/);
  assert.match(html, /<ul><li>primeiro item<\/li><li>segundo item<\/li><\/ul>/);
  assert.match(html, /<ol><li>passo um<\/li><li>passo dois<\/li><\/ol>/);
});

test('linesToStructuredHtml devolve corpo vazio sem linhas', () => {
  assert.match(linesToStructuredHtml([[]]), /<body><\/body>/);
});

test('documento vazio ainda produz um PDF de uma página válido', async () => {
  const bytes = await htmlToPdfBytes('<p></p>');
  const text = bytesToLatin1(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type\s*\/Page\b/);
});
