// Imagens -> PDF. Testa as partes puras: leitura do tamanho do JPEG pelo
// marcador SOF e a montagem do PDF (DCTDecode para JPEG, FlateDecode + SMask
// para RGBA). A decodificação de PNG via canvas é só no navegador (verificação
// manual com Playwright/pypdf, ver AGENTS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { jpegSize, imagesToPdfBytes } = await import('../dist/image.js');

function bytesToLatin1(bytes) {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

// JPEG sintético: SOI + SOF0 (altura 32, largura 48) + EOI.
const fakeJpeg = new Uint8Array([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x30, 0x03,
  0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
]);

test('jpegSize lê a dimensão do marcador SOF', () => {
  assert.deepEqual(jpegSize(fakeJpeg), { width: 48, height: 32 });
});

test('JPEG entra como XObject /DCTDecode com os bytes originais', async () => {
  const bytes = await imagesToPdfBytes([{ kind: 'jpeg', bytes: fakeJpeg, width: 48, height: 32 }]);
  const text = bytesToLatin1(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /%%EOF$/);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/Width 48 \/Height 32/);
  assert.ok(text.includes(bytesToLatin1(fakeJpeg)), 'os bytes do JPEG aparecem intactos no stream');
  assert.match(text, /q .*cm \/Im0 Do Q/);
});

test('RGBA gera imagem /FlateDecode com /SMask separado', async () => {
  const rgb = new Uint8Array(2 * 2 * 3);
  const alpha = new Uint8Array([255, 128, 0, 200]);
  const bytes = await imagesToPdfBytes([{ kind: 'rgba', rgb, alpha, width: 2, height: 2 }]);
  const text = bytesToLatin1(bytes);
  assert.match(text, /\/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/FlateDecode/);
  assert.match(text, /\/SMask \d+ 0 R/);
  assert.match(text, /\/ColorSpace \/DeviceGray \/BitsPerComponent 8 \/Filter \/FlateDecode/);
});

test('N imagens => N páginas', async () => {
  const src = { kind: 'rgb', rgb: new Uint8Array(3), width: 1, height: 1 };
  const bytes = await imagesToPdfBytes([src, src, src]);
  const text = bytesToLatin1(bytes);
  assert.equal((text.match(/\/Type \/Page\b/g) ?? []).length, 3);
  assert.match(text, /\/Count 3/);
});

test('pageSize "fit" usa a dimensão da imagem como MediaBox', async () => {
  const bytes = await imagesToPdfBytes(
    [{ kind: 'jpeg', bytes: fakeJpeg, width: 48, height: 32 }],
    { pageSize: 'fit', margin: 10 },
  );
  const text = bytesToLatin1(bytes);
  assert.match(text, /\/MediaBox \[0 0 68\.00 52\.00\]/); // 48+20 x 32+20
});
