// Verifica a saída COMMITADA do gerador de SEO (rode `npm run generate-seo`
// depois de mexer na matriz ou no widget). Não executa o gerador — apenas
// valida os arquivos em public/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');

const converterEntries = readdirSync(new URL('converter/', root), { withFileTypes: true });
const pairDirs = converterEntries.filter((e) => e.isDirectory()).map((e) => e.name);

test('64 pares gerados, hub presente, sem imagens', () => {
  assert.equal(pairDirs.length, 64);
  assert.equal(converterEntries.some((e) => e.isFile() && e.name === 'index.html'), true);
  for (const name of pairDirs) {
    assert.doesNotMatch(name, /jpg|jpeg|png|webp|gif/, `slug sem imagem: ${name}`);
    assert.match(name, /^[a-z]+-para-[a-z]+$/);
  }
});

test('cada landing page embute o conversor travado + JSON-LD rico', () => {
  for (const name of pairDirs) {
    const html = read(`converter/${name}/index.html`);
    assert.ok(html.includes('id="converter-widget"'), `${name}: widget`);
    assert.ok(html.includes('data-locked="1"'), `${name}: travado`);
    assert.ok(html.includes('type="module" src="/main.js'), `${name}: carrega main.js`);
    assert.ok(html.includes('/vendor/jszip.js'), `${name}: carrega jszip`);
    assert.ok(html.includes('id="theme-toggle"'), `${name}: header com tema`);
    assert.ok(html.includes('"@type":"BreadcrumbList"'), `${name}: breadcrumb`);
    assert.ok(html.includes('"@type":"HowTo"'), `${name}: howto`);
    assert.ok(html.includes('"@type":"FAQPage"'), `${name}: faq`);
    assert.ok(html.includes('rel="canonical"'), `${name}: canonical`);
    assert.ok(!html.includes('data-for="image"'), `${name}: sem opções de imagem`);
  }
});

test('sitemap tem 2 + 64 = 66 URLs, nenhuma de imagem', () => {
  const xml = read('sitemap.xml');
  const locs = xml.match(/<loc>/g) ?? [];
  assert.equal(locs.length, 66);
  assert.doesNotMatch(xml, /jpg-para-pdf|png-para-pdf/);
});

test('index.html: card unlocked injetado, sem opções de imagem, links sem jpg/png', () => {
  const html = read('index.html');
  const m = html.match(/<!-- converter:start -->([\s\S]*?)<!-- converter:end -->/);
  assert.ok(m, 'marcadores converter presentes');
  assert.ok(m[1].includes('id="converter-widget"'));
  assert.ok(m[1].includes('data-locked="0"'));
  assert.ok(m[1].includes('id="source"'));
  assert.ok(!html.includes('data-for="image"'));
  const links = html.match(/<!-- seo-links:start -->([\s\S]*?)<!-- seo-links:end -->/);
  assert.ok(links, 'bloco seo-links presente');
  assert.doesNotMatch(links[1], /jpg-para-pdf|png-para-pdf/);
  assert.doesNotMatch(html, /"JPG para PDF|"PNG para PDF/); // featureList do JSON-LD
});
