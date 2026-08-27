#!/usr/bin/env node
// Gera public/converter/<slug>/index.html, o hub public/converter/index.html,
// public/sitemap.xml e os blocos marcados (seo-links / seo-jsonld / converter)
// dentro de public/index.html — tudo a partir da MESMA matriz de formatos usada
// pela aplicação (src/formats.ts, compilado em dist/formats.js). Rodar depois de
// qualquer mudança na matriz ou no markup do conversor:
//
//   npm run generate-seo        (roda `npm run build` antes)
//
// Cada landing page /converter/<par>/ é a ferramenta de verdade: embute o
// conversor travado no par, além do conteúdo textual e do JSON-LD. Ver AGENTS.md,
// "Processo para novos formatos ou pares de conversão".
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FORMATS, INPUT_KINDS, OUTPUT_KINDS, allowedPair, outputsFor, slug, pattern } from '../dist/formats.js';
import { converterCardHtml } from './converter-widget.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'converter');
const BASE_URL = 'https://docs.appsbox.com.br';
const SIBLING = {
  url: 'https://images.appsbox.com.br/',
  name: 'AppsBox Conversor de Imagens',
  blurb: 'faz JPEG, PNG e WebP com redimensionamento — também 100% no navegador',
};
const CROSS_PROMO = `<section class="cross-promo"><p><strong>Precisa converter imagens?</strong> O <strong>${SIBLING.name}</strong> ${SIBLING.blurb}.</p><a class="cross-cta" href="${SIBLING.url}">Abrir Conversor de Imagens</a></section>`;
const FORMAT_LIST = 'TXT, Markdown, HTML, DOCX, PDF, RTF, ODT, CSV e EPUB';

function ogHead({ title, description, url, ogType }) {
  return `  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="AppsBox">
  <meta property="og:title" content="${escapeHtml(title)} · AppsBox">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE_URL}/assets/appsboxconvdocslogo.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)} · AppsBox">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${BASE_URL}/assets/appsboxconvdocslogo.png">`;
}

const PAIRS = INPUT_KINDS.flatMap((from) => OUTPUT_KINDS.filter((to) => allowedPair(from, to)).map((to) => [from, to]));

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Limite de fidelidade específico do par, em texto puro (sem tags). Alimenta a
// copy visível e o FAQPage/JSON-LD.
function fidelityText(from, to) {
  if (to === 'epub') return 'O EPUB gerado é um livro de documento único (EPUB 3), com sumário montado a partir dos títulos; não embute imagens nem divide em capítulos.';
  if (from === 'pdf') return 'O PDF de origem é lido via pdf.js: títulos e listas são reconstruídos pelo tamanho e pela posição do texto; tabelas e formatação inline do arquivo original não são recuperadas. Para PDF para TXT, só o texto corrido.';
  if (to === 'pdf') return 'O PDF gerado usa fontes proporcionais padrão (Helvetica/Times/Courier, sem incorporar fontes), com hierarquia de títulos, número de página e links clicáveis — não é uma réplica visual do documento de origem, mas é um layout tipográfico de verdade.';
  if (from === 'csv' || to === 'csv') return 'CSV é tratado como tabela: na leitura, a primeira linha vira cabeçalho; na escrita, só as tabelas do documento são exportadas (delimitador e aspas configuráveis).';
  if (from === 'rtf' || to === 'rtf') return 'RTF preserva texto, negrito/itálico/sublinhado/tachado, listas, tabelas simples e links; descarta fontes, cores, imagens e metadados.';
  if (from === 'odt' || to === 'odt' || from === 'docx' || to === 'docx') return 'Preserva títulos, negrito/itálico/sublinhado/tachado, listas, tabelas, links e acentuação; não preserva imagens, fontes ou estilos customizados.';
  return 'Preserva a estrutura do texto — títulos, listas, ênfases, tabelas e links — passando por um HTML intermediário comum.';
}
const fidelityNote = (from, to) => `<p class="muted">${escapeHtml(fidelityText(from, to))}</p>`;

function faqData(from, to) {
  const a = FORMATS[from].label;
  const b = FORMATS[to].label;
  return [
    {
      q: `A conversão de ${a} para ${b} envia meu arquivo para algum servidor?`,
      answer: `Não. A conversão de ${a} para ${b} acontece inteiramente no seu navegador: o arquivo é lido e o resultado é montado no seu dispositivo. Só um contador agregado de conversões concluídas é registrado — nunca o arquivo, o nome ou o conteúdo.`,
    },
    {
      q: 'Preciso instalar algo, criar conta ou pagar?',
      answer: 'Não. É uma página web gratuita, sem cadastro. Depois do primeiro carregamento ela funciona offline e pode ser instalada como aplicativo (PWA), se você quiser.',
    },
    {
      q: 'Existe limite de tamanho ou de quantidade de arquivos?',
      answer: `Não há limite imposto pelo serviço; o limite prático é a memória do seu dispositivo. Vários arquivos ${FORMATS[from].ext} podem ser convertidos de uma vez.`,
    },
    {
      q: `O que é preservado ao converter ${a} para ${b}?`,
      answer: fidelityText(from, to),
    },
  ];
}

function howToSteps(from, to) {
  const a = FORMATS[from].label;
  const b = FORMATS[to].label;
  return [
    `Abra esta página — o par ${a} → ${b} já vem selecionado — e adicione um arquivo ${FORMATS[from].ext}.`,
    'Clique em Converter.',
    `Baixe o arquivo ${FORMATS[to].ext} gerado. Nenhum upload acontece.`,
  ];
}

function jsonLd(from, to, url, title, description) {
  const a = FORMATS[from].label;
  const b = FORMATS[to].label;
  const graph = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Conversões', item: `${BASE_URL}/converter/` },
        { '@type': 'ListItem', position: 3, name: `${a} para ${b}`, item: url },
      ],
    },
    {
      '@type': 'HowTo',
      name: `Como converter ${a} para ${b}`,
      description,
      step: howToSteps(from, to).map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqData(from, to).map(({ q, answer }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
    {
      '@type': 'WebApplication',
      name: `Conversor de ${a} para ${b} · AppsBox`,
      url,
      applicationCategory: 'Utility',
      operatingSystem: 'Any (navegador web)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
    },
  ];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

function pagesData() {
  return PAIRS.map(([from, to]) => {
    const a = FORMATS[from];
    const b = FORMATS[to];
    const title = `Converter ${a.label} para ${b.label} online (${pattern(from, to)})`;
    const description = `Converta ${a.label} para ${b.label} (${pattern(from, to)}) direto no navegador, sem upload e sem cadastro. Gratuito, privado e funciona offline após o primeiro carregamento.`;
    const url = `${BASE_URL}/converter/${slug(from, to)}/`;
    const relatedLinks = PAIRS
      .filter(([f, t]) => (f === from || t === to) && (f !== from || t !== to))
      .map(([f, t]) => `<a href="/converter/${slug(f, t)}/">${FORMATS[f].label} → ${FORMATS[t].label} <small>(${pattern(f, t)})</small></a>`)
      .join('');
    const faq = faqData(from, to);
    const faqHtml = faq
      .map(({ q, answer }) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(answer)}</p></details>`)
      .join('');
    const stepsHtml = howToSteps(from, to).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
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
  <link rel="stylesheet" href="/style.css?release=__RELEASE__">
${ogHead({ title, description, url, ogType: 'article' })}
  ${jsonLd(from, to, url, title, description)}
  <script>document.documentElement.setAttribute('data-theme',localStorage.getItem('appsbox-conv-documentos-theme')||'light')</script>
  <title>${escapeHtml(title)} · AppsBox</title>
</head>
<body>
  <header class="site-header">
    <div class="header-inner"><a class="brand" href="https://appsbox.com.br/"><img src="/assets/appsboxconvdocslogo.png" alt="" aria-hidden="true"><span>AppsBox</span></a><span class="product-name">Conversor de documentos</span><button id="theme-toggle" class="theme-toggle" type="button" aria-label="Ativar tema escuro">☾</button></div>
  </header>
  <main>
    <nav class="breadcrumb" aria-label="Trilha"><a href="/">Início</a> › <a href="/converter/">Conversões</a> › <span>${a.label} para ${b.label}</span></nav>
    <section class="hero"><div><p class="eyebrow">CONVERSÃO LOCAL</p><h1>Converter ${a.label} para ${b.label}</h1><p>Também conhecido como <strong>${pattern(from, to)}</strong> — direto no seu navegador, sem upload.</p></div></section>
    ${converterCardHtml({ locked: true, from, to })}
    <section class="card">
      <p>Este conversor transforma ${a.long} em ${b.long} sem enviar o arquivo a nenhum servidor: a leitura e a montagem do resultado acontecem inteiramente no seu dispositivo, com download imediato.</p>
      <p><strong>Como converter ${a.label} para ${b.label}:</strong></p>
      <ol>${stepsHtml}</ol>
      ${fidelityNote(from, to)}
      <p class="muted">Nenhum arquivo, nome ou conteúdo é enviado ao servidor — apenas um contador agregado de conversões concluídas.</p>
    </section>
    <section class="card faq">
      <h2>Perguntas frequentes</h2>
      ${faqHtml}
    </section>
    <section class="card">
      <h2>Outras conversões</h2>
      <div class="convert-links">${relatedLinks}</div>
      <p><a href="/converter/">Ver todas as conversões</a> · <a href="/">Voltar ao conversor</a></p>
    </section>
    ${CROSS_PROMO}
  </main>
  <footer><a href="https://appsbox.com.br/sobre">Sobre</a><a href="https://appsbox.com.br/fale-conosco">Fale conosco</a><a href="https://appsbox.com.br/termos">Termos de Uso</a><a href="https://appsbox.com.br/privacidade">Privacidade</a><a href="https://appsbox.com.br/cookies">Cookies</a><a href="https://appsbox.com.br/regras-de-conteudo">Regras de Conteúdo</a></footer>
  <script src="/vendor/jszip.js"></script>
  <script type="module" src="/main.js?release=__RELEASE__"></script>
</body>
</html>
`;
    return { from, to, slug: slug(from, to), pattern: pattern(from, to), html, url };
  });
}

function hubHtml(pages) {
  const links = pages.map((page) => `<a href="/converter/${page.slug}/">${FORMATS[page.from].label} → ${FORMATS[page.to].label} <small>(${page.pattern})</small></a>`).join('');
  const description = `Todas as conversões de documentos disponíveis: ${FORMAT_LIST}, em qualquer direção, direto no navegador e sem upload.`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#102a43">
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${BASE_URL}/converter/">
  <link rel="icon" type="image/png" href="/assets/appsboxconvdocslogo.png">
  <link rel="apple-touch-icon" href="/assets/appsboxconvdocslogo.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/style.css?release=__RELEASE__">
${ogHead({ title: `Todas as conversões de documentos (${FORMAT_LIST})`, description, url: `${BASE_URL}/converter/`, ogType: 'website' })}
  <script>document.documentElement.setAttribute('data-theme',localStorage.getItem('appsbox-conv-documentos-theme')||'light')</script>
  <title>Todas as conversões de documentos · AppsBox</title>
</head>
<body>
  <header class="site-header">
    <div class="header-inner"><a class="brand" href="https://appsbox.com.br/"><img src="/assets/appsboxconvdocslogo.png" alt="" aria-hidden="true"><span>AppsBox</span></a><span class="product-name">Conversor de documentos</span><button id="theme-toggle" class="theme-toggle" type="button" aria-label="Ativar tema escuro">☾</button></div>
  </header>
  <main>
    <section class="hero"><div><p class="eyebrow">CONVERSÃO LOCAL</p><h1>Todas as conversões</h1><p>${FORMAT_LIST}, em qualquer direção.</p></div></section>
    <section class="card">
      <p>Escolha a conversão desejada. Cada página é o próprio conversor, já travado no par, rodando no seu navegador sem upload.</p>
      <div class="convert-links">${links}</div>
      <p><a href="/">Abrir o conversor com seletor De → Para</a></p>
    </section>
    ${CROSS_PROMO}
  </main>
  <footer><a href="https://appsbox.com.br/sobre">Sobre</a><a href="https://appsbox.com.br/fale-conosco">Fale conosco</a><a href="https://appsbox.com.br/termos">Termos de Uso</a><a href="https://appsbox.com.br/privacidade">Privacidade</a><a href="https://appsbox.com.br/cookies">Cookies</a><a href="https://appsbox.com.br/regras-de-conteudo">Regras de Conteúdo</a></footer>
</body>
</html>
`;
}

function patchIndexHtml(pages) {
  const indexPath = path.join(ROOT, 'public', 'index.html');
  let index = readFileSync(indexPath, 'utf8');

  const firstFrom = INPUT_KINDS[0];
  const firstTo = outputsFor(firstFrom)[0];
  const card = converterCardHtml({ locked: false, from: firstFrom, to: firstTo });
  index = index.replace(/<!-- converter:start -->[\s\S]*?<!-- converter:end -->/, `<!-- converter:start -->${card}<!-- converter:end -->`);

  const links = pages.map((page) => `<a href="/converter/${page.slug}/">${FORMATS[page.from].label} → ${FORMATS[page.to].label} <small>(${page.pattern})</small></a>`).join('');
  index = index.replace(/<!-- seo-links:start -->[\s\S]*?<!-- seo-links:end -->/, `<!-- seo-links:start -->${links}<!-- seo-links:end -->`);

  const jsonLdObj = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Conversor de Documentos AppsBox',
    url: `${BASE_URL}/`,
    applicationCategory: 'Utility',
    operatingSystem: 'Any (navegador web)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
    featureList: pages.map((page) => `${FORMATS[page.from].label} para ${FORMATS[page.to].label} (${page.pattern})`),
  };
  const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLdObj)}</script>`;
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
  { loc: `${BASE_URL}/converter/`, lastmod: today },
  ...pages.map((page) => ({ loc: page.url, lastmod: today })),
];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
  .map((entry) => `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n  </url>`)
  .join('\n')}\n</urlset>\n`;
writeFileSync(path.join(ROOT, 'public', 'sitemap.xml'), sitemapXml, 'utf8');

console.log(`Geradas ${pages.length} páginas de conversão + hub + sitemap.xml + blocos seo-links/seo-jsonld/converter em public/index.html`);
