// Matriz de formatos compartilhada (src/formats.ts -> dist/formats.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  FORMATS,
  INPUT_KINDS,
  OUTPUT_KINDS,
  allowedPair,
  outputsFor,
  isInputKind,
  isOutputKind,
  kindFromName,
  slug,
  pattern,
} = await import('../dist/formats.js');

test('não há imagens na matriz', () => {
  for (const bad of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'image']) {
    assert.equal(INPUT_KINDS.includes(bad), false, `${bad} não deve ser entrada`);
    assert.equal(OUTPUT_KINDS.includes(bad), false, `${bad} não deve ser saída`);
    assert.equal(bad in FORMATS, false, `${bad} não deve estar em FORMATS`);
  }
});

test('EPUB é só saída', () => {
  assert.equal(isInputKind('epub'), false);
  assert.equal(isOutputKind('epub'), true);
  assert.equal(INPUT_KINDS.includes('epub'), false);
});

test('allowedPair rejeita origem == destino e pares fora da matriz', () => {
  assert.equal(allowedPair('md', 'md'), false);
  assert.equal(allowedPair('md', 'pdf'), true);
  assert.equal(allowedPair('epub', 'pdf'), false); // epub não é entrada
  assert.equal(allowedPair('pdf', 'jpg'), false);
});

test('outputsFor não inclui a própria origem e inclui epub', () => {
  const outs = outputsFor('pdf');
  assert.equal(outs.includes('pdf'), false);
  assert.equal(outs.includes('epub'), true);
  assert.equal(outs.length, OUTPUT_KINDS.length - 1);
});

test('total de pares = 8 entradas x 8 saídas válidas = 64', () => {
  const total = INPUT_KINDS.reduce((n, from) => n + outputsFor(from).length, 0);
  assert.equal(total, 64);
});

test('kindFromName detecta pela extensão', () => {
  assert.equal(kindFromName('a.md'), 'md');
  assert.equal(kindFromName('a.markdown'), 'md');
  assert.equal(kindFromName('X.DOCX'), 'docx');
  assert.equal(kindFromName('t.tsv'), 'csv');
  assert.equal(kindFromName('foto.png'), null);
  assert.equal(kindFromName('semext'), null);
});

test('slug e pattern', () => {
  assert.equal(slug('png', 'pdf'), 'png-para-pdf');
  assert.equal(pattern('docx', 'pdf'), 'docx2pdf');
});

test('todo formato tem label, long, ext e accept', () => {
  for (const key of Object.keys(FORMATS)) {
    const f = FORMATS[key];
    for (const prop of ['label', 'long', 'ext', 'accept']) {
      assert.ok(typeof f[prop] === 'string' && f[prop].length > 0, `${key}.${prop}`);
    }
  }
});
