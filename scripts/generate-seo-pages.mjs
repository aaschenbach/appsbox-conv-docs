#!/usr/bin/env node
// Gera public/converter/<slug>/index.html, o hub public/converter/index.html,
// public/sitemap.xml e os blocos marcados (seo-links / seo-jsonld) dentro de
// public/index.html — tudo a partir da MESMA matriz de formatos usada pela
// aplicação (ver src/main.ts: InputKind/OutputKind). Não inclui nenhum
// formato que a aplicação não converta de fato — ver PRD, seção "Limites
// explícitos". Rodar depois de qualquer mudança na matriz de formatos:
//
//   node scripts/generate-seo-pages.mjs
//
// Isso é o padrão deste repositório: toda vez que um novo formato/par de
// conversão é adicionado à aplicação, este script deve ser executado (e seu
// resultado commitado) antes do deploy. Ver AGENTS.md, seção "Processo para
// novos formatos ou pares de conversão".
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'converter');
const BASE_URL = 'https://docs.appsbox.com.br';

// Fonte de verdade dos formatos: mantenha em sincronia com InputKind/OutputKind
// em src/main.ts. `textOnlyInput`/`textOnlyOutput` documentam limites reais de
// fidelidade (não são apenas texto de marketing) e alimentam o texto de cada
// página.
const FORMATS = {
  txt: { label: 'TXT', long: 'texto simples (TXT)', ext: '.txt' },
  md: { label: 'Markdown', long: 'Markdown (.md)', ext: '.md' },
  html: { label: 'HTML', long: 'HTML (.html)', ext: '.html' },
  docx: { label: 'DOCX', long: 'documento do Word (.docx)', ext: '.docx' },
  pdf: { label: 'PDF', long: 'PDF (.pdf)', ext: '.pdf' },
};

const PAIRS = Object.keys(FORMATS).flatMap((from) => Object.keys(FORMATS).filter((to) => to !== from).map((to) => [from, to]));

const slug = (from, to) => `${from}-para-${to}`;
const pattern = (from, to) => `${from}2${to}`;

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fidelityNote(from, to) {
  if (from === 'pdf') return '<p class="muted">O PDF de origem é lido como texto corrido (via pdf.js): títulos, tabelas, listas e links do arquivo original não são reconstruídos, só o conteúdo textual.</p>';
  if (to === 'pdf') return '<p class="muted">O PDF gerado usa layout monoespaçado (fonte Courier, sem incorporar fontes) para paginação confiável — não é uma réplica visual do documento de origem.</p>';
  if (from === 'docx' || to === 'docx') return '<p class="muted">Preserva títulos, negrito/itálico/sublinhado/tachado, listas, tabelas, links e acentuação; não preserva imagens, fontes ou estilos customizados.</p>';
  return '';
}

function pagesData() {
  return PAIRS.map(([from, to]) => {
    const a = FORMATS[from];
    const b = FORMATS[to];
    const title = `Converter ${a.label} para ${b.label} online (${pattern(from, to)})`;
    const description = `Converta ${a.label} para ${b.label} (${pattern(from, to)}) direto no navegador, sem upload e sem cadastro. Gratuito, privado e funciona offline após o primeiro carregamento.`;
    const url = `${BASE_URL}/converter/${slug(from, to)}/`;
    const relatedLinks = PAIRS
      .filter(([f, t]) => f !== from || t !== to)
      .map(([f, t]) => `<a href="/converter/${slug(f, t)}/">${FORMATS[f].label} → ${FORMATS[t].label} <small>(${pattern(f, t)})</small></a>`)
      .join('');
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#102a43">
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/png" href="/assets/appsboxconvdocslogo.png">
  <link rel="apple-touch-icon" href="/assets/appsboxconvdocslogo.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/style.css">
  <script>document.documentElement.setAttribute('data-theme',localStorage.getItem('appsbox-conv-documentos-theme')||'light')</script>
  <title>${escapeHtml(title)} · AppsBox</title>
</head>
<body>
  <header class="site-header">
    <div class="header-inner"><a class="brand" href="https://appsbox.com.br/"><img src="/assets/appsboxconvdocslogo.png" alt="" aria-hidden="true"><span>AppsBox</span></a><span class="product-name">Conversor de documentos</span></div>
  </header>
  <main>
    <section class="hero"><div><p class="eyebrow">CONVERSÃO LOCAL</p><h1>Converter ${a.label} para ${b.label}</h1><p>Também conhecido como <strong>${pattern(from, to)}</strong> — direto no seu navegador.</p></div></section>
    <section class="card">
      <p>Este conversor transforma ${a.long} em ${b.long} sem enviar o arquivo a nenhum servidor: a leitura e a montagem do resultado acontecem inteiramente no seu dispositivo, com download imediato.</p>
      <p><strong>Como converter ${a.label} para ${b.label}:</strong></p>
      <ol>
        <li>Abra o <a href="/?to=${to}#converter-title">conversor de documentos</a> e adicione um arquivo ${a.ext};</li>
        <li>Escolha <strong>${b.label}</strong> como formato de saída (já vem selecionado pelo link acima);</li>
        <li>Clique em <strong>Converter documentos</strong> e baixe o arquivo ${b.ext} gerado.</li>
      </ol>
      ${fidelityNote(from, to)}
      <p class="muted">Nenhum arquivo, nome ou conteúdo é enviado ao servidor — apenas um contador agregado de conversões concluídas.</p>
      <p><a href="/?to=${to}#converter-title">Converter ${a.label} para ${b.label} agora →</a></p>
    </section>
    <section class="card">
      <h2>Outras conversões</h2>
      <div class="convert-links">${relatedLinks}</div>
      <p><a href="/converter/">Ver todas as conversões</a> · <a href="/">Voltar ao conversor</a></p>
    </section>
  </main>
  <footer><a href="https://appsbox.com.br/sobre">Sobre</a><a href="https://appsbox.com.br/fale-conosco">Fale conosco</a><a href="https://appsbox.com.br/termos">Termos de Uso</a><a href="https://appsbox.com.br/privacidade">Privacidade</a><a href="https://appsbox.com.br/cookies">Cookies</a><a href="https://appsbox.com.br/regras-de-conteudo">Regras de Conteúdo</a></footer>
</body>
</html>
`;
    return { from, to, slug: slug(from, to), pattern: pattern(from, to), html, url };
  });
}

function hubHtml(pages) {
  const links = pages.map((page) => `<a href="/converter/${page.slug}/">${FORMATS[page.from].label} → ${FORMATS[page.to].label} <small>(${page.pattern})</small></a>`).join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#102a43">
  <meta name="description" content="Todas as conversões de documentos disponíveis: TXT, Markdown, HTML, DOCX e PDF, em qualquer direção, direto no navegador.">
  <link rel="canonical" href="${BASE_URL}/converter/">
  <link rel="icon" type="image/png" href="/assets/appsboxconvdocslogo.png">
  <link rel="apple-touch-icon" href="/assets/appsboxconvdocslogo.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/style.css">
  <script>document.documentElement.setAttribute('data-theme',localStorage.getItem('appsbox-conv-documentos-theme')||'light')</script>
  <title>Todas as conversões: TXT, Markdown, HTML, DOCX e PDF · AppsBox</title>
</head>
<body>
  <header class="site-header">
    <div class="header-inner"><a class="brand" href="https://appsbox.com.br/"><img src="/assets/appsboxconvdocslogo.png" alt="" aria-hidden="true"><span>AppsBox</span></a><span class="product-name">Conversor de documentos</span></div>
  </header>
  <main>
    <section class="hero"><div><p class="eyebrow">CONVERSÃO LOCAL</p><h1>Todas as conversões</h1><p>TXT, Markdown, HTML, DOCX e PDF, em qualquer direção.</p></div></section>
    <section class="card">
      <p>Escolha a conversão desejada. Todas rodam no seu navegador, sem upload.</p>
      <div class="convert-links">${links}</div>
      <p><a href="/">Voltar ao conversor</a></p>
    </section>
  </main>
  <footer><a href="https://appsbox.com.br/sobre">Sobre</a><a href="https://appsbox.com.br/fale-conosco">Fale conosco</a><a href="https://appsbox.com.br/termos">Termos de Uso</a><a href="https://appsbox.com.br/privacidade">Privacidade</a><a href="https://appsbox.com.br/cookies">Cookies</a><a href="https://appsbox.com.br/regras-de-conteudo">Regras de Conteúdo</a></footer>
</body>
</html>
`;
}

function patchIndexHtml(pages) {
  const indexPath = path.join(ROOT, 'public', 'index.html');
  let index = readFileSync(indexPath, 'utf8');

  const links = pages.map((page) => `<a href="/converter/${page.slug}/">${FORMATS[page.from].label} → ${FORMATS[page.to].label} <small>(${page.pattern})</small></a>`).join('');
  index = index.replace(/<!-- seo-links:start -->[\s\S]*?<!-- seo-links:end -->/, `<!-- seo-links:start -->${links}<!-- seo-links:end -->`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Conversor de Documentos AppsBox',
    url: `${BASE_URL}/`,
    applicationCategory: 'Utility',
    operatingSystem: 'Any (navegador web)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
    featureList: pages.map((page) => `${FORMATS[page.from].label} para ${FORMATS[page.to].label} (${page.pattern})`),
  };
  const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  index = index.replace(/<!-- seo-jsonld:start -->[\s\S]*?<!-- seo-jsonld:end -->/, `<!-- seo-jsonld:start -->${jsonLdScript}<!-- seo-jsonld:end -->`);

  writeFileSync(indexPath, index, 'utf8');
}

if (existsSync(OUT_DIR)) {
  for (const entry of readdirSync(OUT_DIR)) rmSync(path.join(OUT_DIR, entry), { recursive: true, force: true });
} else {
  mkdirSync(OUT_DIR, { recursive: true });
}

const pages = pagesData();
for (const page of pages) {
  const dir = path.join(OUT_DIR, page.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), page.html, 'utf8');
}
writeFileSync(path.join(OUT_DIR, 'index.html'), hubHtml(pages), 'utf8');
patchIndexHtml(pages);

const today = new Date().toISOString().slice(0, 10);
const sitemapUrls = [
  { loc: `${BASE_URL}/`, lastmod: today },
  { loc: `${BASE_URL}/cookies/`, lastmod: today },
  { loc: `${BASE_URL}/converter/`, lastmod: today },
  ...pages.map((page) => ({ loc: page.url, lastmod: today })),
];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
  .map((entry) => `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n  </url>`)
  .join('\n')}\n</urlset>\n`;
writeFileSync(path.join(ROOT, 'public', 'sitemap.xml'), sitemapXml, 'utf8');

console.log(`Geradas ${pages.length} páginas de conversão + hub + sitemap.xml + blocos seo-links/seo-jsonld em public/index.html`);
