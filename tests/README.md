# Fixtures e testes

Esta pasta é reservada para fixtures sintéticos, públicos ou licenciados. Não
adicione documentos pessoais, arquivos de clientes ou dados secretos. Cada
fixture deve documentar o formato, a finalidade e a limitação que cobre.

Todos os testes rodam com `node --test` (`npm test`) e usam `jsdom` (apenas em
tempo de teste, nunca embarcado no navegador) para expor `DOMParser` fora do
browser; os de ODT/EPUB carregam o JSZip vendorizado num escopo CommonJS
isolado.

- `docx.test.mjs` — round trip HTML→DOCX→HTML, listas por estilo
  (`ListBullet`/`ListNumber` sem `numPr`) e as opções de fonte/página/margem.
- `pdf.test.mjs` — estrutura do PDF gerado (cabeçalho, `%%EOF`, fontes
  Helvetica/Times, quebra proporcional, `/Annots`, número de página, opções) e
  o helper puro `linesToStructuredHtml` (PDF → estrutura). Não depende de pdf.js.
- `text-formats.test.mjs` — TXT/Markdown/HTML: listas aninhadas, imagens,
  linguagem no code fence, listas de definição, round trips.
- `rtf.test.mjs`, `odt.test.mjs` — leitor/gravador próprio; round trips e, no
  ODT, `mimetype` STORE como primeira entrada.
- `csv.test.mjs` — parser RFC 4180, detecção de delimitador, tabela ↔ CSV.
- `epub.test.mjs` — pacote EPUB 3 (mimetype STORE primeiro, container/opf/nav,
  XHTML válido).
- `formats.test.mjs` — matriz `src/formats.ts`: `allowedPair`, `outputsFor`,
  `kindFromName`, ausência de imagens, 64 pares.
- `main.test.mjs` — E2E em jsdom da orquestração: seletor De → Para, filtro de
  destino, rejeição de arquivo de tipo errado, aviso ao trocar a origem
  (`#confirm-dialog`) e modo `locked` das landing pages. Não faz conversão real.
- `seo.test.mjs` — valida a saída COMMITADA de `npm run generate-seo`: 64 pares
  sem slug de imagem, cada landing page com `#converter-widget` travado +
  JSON-LD (`BreadcrumbList`/`HowTo`/`FAQPage`), `sitemap.xml` com 66 URLs e o
  card unlocked injetado em `public/index.html`.

Esses testes automatizados **não substituem** a verificação cruzada manual
exigida pelo processo em `AGENTS.md` ("Processo para novos formatos ou pares
de conversão") antes de um deploy: abrir o arquivo gerado com uma biblioteca
independente (`python-docx`, `pypdf`) e/ou testar a UI real com Playwright.
Um round trip que só usa o próprio código para ler o que ele mesmo escreveu
pode mascarar um formato inválido para outros leitores.
