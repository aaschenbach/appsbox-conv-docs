# Instruções do projeto

## Codificação

- Todos os arquivos são UTF-8 sem BOM.
- Preserve acentos e pontuação em português; corrija texto corrompido antes de
  concluir.
- Não edite arquivos com `cat`, redirecionamento ou scripts de escrita; use
  `apply_patch` para alterações manuais.

## Estrutura e escopo

- `src/`: TypeScript do frontend. `formats.ts` é a **matriz única de formatos**
  (entradas, saídas, pares válidos, `accept` por formato), importada por
  `main.ts` e — já compilada em `dist/formats.js` — por
  `scripts/generate-seo-pages.mjs`. Demais: `main.ts` (orquestração/UI),
  `docx.ts`, `pdf.ts`, `rtf.ts`, `odt.ts`, `csv.ts`, `epub.ts`, `text-formats.ts`;
- `public/`: shell, PWA, estilos, logo, bibliotecas vendorizadas
  (`public/vendor/`) e páginas de SEO (`public/converter/`);
- `backend/`: somente o contador agregado;
- `scripts/`: ciclo de vida, deploy e geração de páginas de SEO;
- `deploy/`: modelos systemd e Apache;
- `PRD_AppsBox_Conversor_de_Documentos.md`: fonte de verdade do produto;
- `README.md`: desenvolvimento e operação;
- `tests/`: fixtures e testes.

Não adicionar conversão remota, upload, conta, histórico ou telemetria por
arquivo. Documentos nunca podem chegar ao backend — inclusive DOCX e PDF, que
são lidos/gravados inteiramente no navegador com JSZip
(`public/vendor/jszip.js`, MIT), pdf.js (`public/vendor/pdfjs/`, Apache-2.0,
carregado sob demanda só quando um PDF é convertido) e
`DOMParser`/`XMLSerializer` nativos. Nenhuma biblioteca de terceiros é
carregada de CDN; tudo é vendorizado localmente.

## Formatos atualmente suportados

**Entrada:** TXT, Markdown (`.md`, `.markdown`), HTML (`.html`, `.htm`), DOCX
(`.docx`), PDF (`.pdf`), RTF (`.rtf`), ODT (`.odt`) e CSV/TSV (`.csv`, `.tsv`).
**Saída:** os mesmos mais EPUB. EPUB é só saída. Não há conversão de imagem
(imagem/PDF é um produto separado, futuro).

A interface é **par-primeiro**: o usuário escolhe origem → destino (`#source` /
`#output`) antes de subir arquivos; só arquivos do formato de origem são aceitos
(`accept` dinâmico), e trocar a origem descarta a fila com um aviso
(`#confirm-dialog`). O par também pode vir da URL (`?de=`/`?para=`, aliases
`?from=`/`?to=`) e, nas landing pages, de `#converter-widget[data-locked|data-from|data-to]`.

A conversão passa por um HTML intermediário comum. Cada leitor produz esse HTML;
cada gravador o consome. `src/text-formats.ts` cobre TXT/Markdown/HTML (extraído
de `main.ts` para ser testável) — `htmlToMarkdown` reconstrói listas aninhadas,
imagens, linguagem de code fence e blocos de definição.

- **RTF** (`src/rtf.ts`): leitor/gravador próprio, sem dependências. Preserva
  parágrafos, negrito/itálico/sublinhado/tachado, código (fonte mono), títulos
  (parágrafo em negrito com `\fsN` grande), listas, tabelas simples e links
  (campo `HYPERLINK`); ignora tabelas de fonte/cor/estilo, imagens e metadados.
  Acentos são gravados como `\uN?` (cp1252 na leitura).
- **ODT** (`src/odt.ts`, usa o JSZip vendorizado): leitor/gravador ODF mínimo
  (`mimetype` STORE primeiro, `content.xml`, `styles.xml`, `meta.xml`,
  `META-INF/manifest.xml`). Mesma fidelidade do DOCX; resolve estilos
  automáticos para negrito/itálico/sublinhado/tachado na leitura.
- **CSV/TSV** (`src/csv.ts`): parser RFC 4180 (aspas, delimitador e quebra
  embutidos). Leitura → `<table>` (1ª linha vira `<th>`); escrita serializa a
  primeira tabela do documento, ou uma coluna por bloco quando não há tabela.
  Delimitador detectado (`,` `;` tab).
- **EPUB** (`src/epub.ts`, usa o JSZip vendorizado): só saída. EPUB 3 de
  documento único (`mimetype` STORE primeiro, `container.xml`, `content.opf`,
  `nav.xhtml` com sumário pelos H1/H2, `text.xhtml`, `style.css`). Sem imagens
  nem divisão em capítulos.
- **DOCX** (`src/docx.ts`): gerador/leitor OOXML escrito à mão. Preserva
  títulos, negrito/itálico/sublinhado/tachado, listas, tabelas, links e
  acentuação; não preserva imagens, fontes, estilos customizados,
  cabeçalho/rodapé, comentários, controle de alterações ou numeração
  aninhada.
- **PDF** (`src/pdf.ts`): a escrita é um gerador PDF próprio, **sem incorporar
  fontes** — usa as famílias padrão nº 14 (Helvetica, Times ou Courier) e as
  larguras de glifo AFM da Adobe (`public/vendor/afm/*.afm`, compiladas em
  `src/afm-widths.ts` por `scripts/build-afm.mjs`; rode `npm run build-afm` se
  as AFM mudarem) para fazer quebra de linha e justificação **proporcionais**,
  não por contagem de caractere. Não é uma réplica visual do documento de
  origem, mas tem layout tipográfico de verdade: hierarquia de títulos
  (H1–H6), negrito/itálico, listas com recuo pendente, número de página no
  rodapé e links clicáveis (`/Link` + ação URI). Código fica sempre em
  Courier. O layout aceita `PdfOptions` (família, tamanho, entrelinha, página
  A4/Carta, margens, número de página, justificar), com defaults bons.
  Codificação WinAnsi (sem Unicode fora de cp1252). Tabelas são grade real
  (bordas, coluna proporcional ao conteúdo, cabeçalho sombreado, quebra por
  célula), não texto com `|`; o cabeçalho não se repete numa quebra de
  página. A leitura usa pdf.js para extrair texto corrido do PDF de origem;
  não reconstrói títulos, tabelas, listas ou links do PDF original.

A interface tem um painel **"Opções de saída"** embutido (`<details id="options-panel">`
logo abaixo da linha de botões, markup em `scripts/converter-widget.mjs`, estado em
`main.ts`/`localStorage`): abre automaticamente quando o destino tem opções (só PDF
e DOCX) e fica escondido para os formatos de texto. Os valores são lidos a cada
`change` e persistidos; não há botão de confirmar. Os defaults já são os recomendados.

O markup do card do conversor é **fonte única** em
`scripts/converter-widget.mjs` (`converterCardHtml({ locked, from, to })`),
injetado por `generate-seo-pages.mjs` na home (entre `<!-- converter:start -->`
e `<!-- converter:end -->` em `public/index.html`, modo `unlocked`) e em cada
`public/converter/<par>/index.html` (modo `locked`: par fixo, sem `#source`).
Cada landing page embute esse conversor real logo abaixo do H1, além da copy,
do FAQ visível e do JSON-LD (`BreadcrumbList` + `HowTo` + `FAQPage` +
`WebApplication`).

Não anunciar XLS/XLSX, PPT/PPTX, ODS/ODP, EPUB como entrada, OCR, DOC binário
nem conversão de imagem (JPG/PNG/…): imagem/PDF é um produto separado, ainda não
lançado.

A matriz de formatos vive só em `src/formats.ts` (`INPUT_KINDS`,
`OUTPUT_KINDS`, `allowedPair`, `FORMATS` com `accept`). Ao adicionar/remover um
formato ou par, mexa **só** nesse arquivo; `main.ts` e o gerador de SEO seguem.
`npm run generate-seo` roda `npm run build` antes (o gerador importa
`dist/formats.js`).

## Processo para novos formatos ou pares de conversão

Sempre que um novo formato ou par de conversão for adicionado (ou um
existente for alterado), seguir esta sequência antes de considerar o
trabalho pronto:

1. **Implementar 100% no navegador.** Sem upload, sem backend, sem CDN —
   vendorizar qualquer biblioteca nova em `public/vendor/<nome>/` com
   licença permissiva (MIT/Apache-2.0/BSD) e documentar a licença.
2. **Testar em duas camadas.** (a) teste automatizado em `tests/*.test.mjs`
   (`node --test`, com `jsdom` quando precisar de `DOMParser` fora do
   navegador) cobrindo o novo caminho; (b) verificação cruzada manual com
   uma biblioteca independente (ex.: `python-docx`, `pypdf`) e/ou um teste
   end-to-end real em navegador (Playwright) contra a UI publicada
   localmente. Não considerar a fidelidade validada só porque o próprio
   código conseguiu ler o que ele mesmo escreveu.
3. **Documentar limites de fidelidade** explicitamente — o que é preservado
   e o que é descartado — no PRD, neste arquivo e no README.
4. **Gerar as páginas de SEO**: rodar `npm run generate-seo`
   (`scripts/generate-seo-pages.mjs`), que regenera `public/converter/*` (uma
   landing page por par, com o conversor embutido travado no par, FAQ visível e
   JSON-LD `BreadcrumbList`/`HowTo`/`FAQPage`/`WebApplication`, com o padrão
   curto tipo `md2docx` no título/H1), o hub `public/converter/`,
   `public/sitemap.xml` e os blocos `<!-- converter -->`/`<!-- seo-links -->`/
   `<!-- seo-jsonld -->` dentro de `public/index.html` — tudo a partir de
   `src/formats.ts` e do markup único em `scripts/converter-widget.mjs`. Nunca
   anunciar, nessas páginas ou no `JSON-LD`, um par que a aplicação não suporte
   de fato. Depois de mexer no widget ou na matriz, rode também `npm test` (os
   testes `formats`/`main`/`seo` validam a paridade).
5. **Rodar a validação obrigatória completa** (seção abaixo) e revisar o
   `git status`/`git diff` antes de commitar.
6. **Deploy e push** seguindo a seção "Publicação" abaixo, com validação
   pós-deploy real (curl e teste funcional na URL pública).

## Validação obrigatória

```bash
npm ci
npm run check
npm run build
npm test
python3 -m py_compile backend/counter.py
python3 -m json.tool public/manifest.webmanifest >/dev/null
node --check public/service-worker.js
git diff --check
```

Ao modificar Markdown, confirmar leitura UTF-8, ausência de BOM e blocos de
código balanceados. Ao modificar TypeScript, `npm run check` é a validação AST.

## Artefatos proibidos no Git

Não versionar `node_modules/`, `dist/`, `.run/`, `__pycache__/`, bancos SQLite,
logs, caches, segredos ou releases de produção. O `.gitignore` já cobre esses
nomes.

## Publicação

O deploy oficial usa o checkout git em
`/mnt/dados/projetos/appsbox-conv-documentos` (remoto `origin` apontando para o
checkout de edição em `/home/aaschen/repo/appsbox-conv-docs`, que por sua vez
publica em `origin/main` no GitHub), publica em
`/var/www/appsbox-conv-documentos/releases/`, alterna `current` atomicamente e
mantém o contador em `127.0.0.1:9700`. Nunca abrir essa porta na internet.
Antes de rodar `scripts/deploy.sh`, garantir que esse checkout está atualizado
(`git fetch origin main && git reset --hard origin/main && git status --short`)
com o commit publicado — não publicar a partir de `/home/aaschen/repo`
diretamente.

Antes de alterar Apache, systemd, dados ou backup, ler o skill
`vps-onboard-app` e comparar os arquivos do repositório com o estado real.
Validar `apache2ctl configtest`, serviço, health check e rollback. Não executar
Certbot: o curinga de `appsbox.com.br` já cobre o subdomínio.

## Git

Trabalhar na branch `main`. Antes do push:

```bash
git status --short
git diff --check
git log -1 --oneline
```

Não descartar alterações de terceiros nem usar `git reset --hard` sem pedido
explícito.
