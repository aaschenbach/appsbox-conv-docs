# PRD — AppsBox Conversor de Documentos

**Status:** MVP implantado e documentado
**URL:** `https://docs.appsbox.com.br`
**Repositório:** `appsbox-conv-docs`
**Produto relacionado:** AppsBox Conversor de Imagens

## 1. Estado real

Este documento descreve o que existe no código publicado. Não deve ser usado
para anunciar formatos que não estejam nesta versão.

O MVP é uma PWA estática que lê arquivos no navegador e gera o resultado no
próprio dispositivo. O backend não recebe documentos: mantém somente um
contador agregado de conversões concluídas.

O logotipo oficial é `public/assets/appsboxconvdocslogo.png`, publicado no shell
da aplicação.

## 2. Escopo funcional implantado

### Entradas aceitas

- `.txt` — texto simples;
- `.md` e `.markdown` — Markdown básico;
- `.html` e `.htm` — HTML;
- `.docx` — documento OOXML do Word;
- `.pdf` — documento PDF;
- `.rtf` — Rich Text Format;
- `.odt` — documento OpenDocument Text (LibreOffice);
- `.csv` e `.tsv` — valores separados por delimitador (tratados como tabela);
- `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` — imagens, **apenas para saída PDF**.

Arquivos de outras extensões são rejeitados pela interface e não são enviados.

Toda conversão passa por um **HTML intermediário** comum: cada leitor produz
esse HTML e cada gravador o consome. As conversões entre TXT/Markdown/HTML estão
em `src/text-formats.ts` (`htmlToMarkdown` reconstrói listas aninhadas, imagens,
linguagem de bloco de código e listas de definição).

### Saídas aceitas

- **HTML:** Markdown recebe conversão local (títulos, parágrafos, ênfases,
  listas, tabelas, links); TXT é encapsulado em `<pre>`; HTML é preservado;
  DOCX/ODT/RTF/CSV são lidos para o HTML intermediário; PDF é lido com
  reconstrução de títulos e listas (via pdf.js);
- **TXT:** qualquer entrada é reduzida ao texto do HTML intermediário
  (`DOMParser`);
- **Markdown:** o HTML intermediário de qualquer entrada é convertido
  semanticamente por `htmlToMarkdown`;
- **DOCX:** o HTML intermediário é serializado como pacote OOXML mínimo
  (`word/document.xml`, `styles.xml`, `numbering.xml`, `docProps/*`) gerado
  com JSZip; aceita opções de fonte, tamanho de corpo, página e margem;
- **RTF:** o HTML intermediário vira RTF próprio (parágrafos, ênfases, código,
  títulos, listas, tabelas simples, links); acentos como `\uN?`;
- **ODT:** pacote ODF mínimo gerado com JSZip (`mimetype` STORE primeiro,
  `content.xml`, `styles.xml`, `meta.xml`, `META-INF/manifest.xml`);
- **CSV:** serializa a primeira tabela do documento (ou uma coluna por bloco
  quando não há tabela); delimitador e aspas configuráveis;
- **EPUB:** EPUB 3 de documento único gerado com JSZip (`mimetype` STORE
  primeiro, `container.xml`, `content.opf`, `nav.xhtml` com sumário pelos
  H1/H2, `text.xhtml`, `style.css`); **só saída**;
- **PDF:** TXT, Markdown, HTML e DOCX são normalizados para o mesmo HTML
  intermediário e então desenhados como um PDF próprio com fontes
  proporcionais padrão (Helvetica/Times/Courier), hierarquia de títulos,
  número de página e links clicáveis, paginação A4 ou Carta.

A conversão para/de DOCX é feita por um leitor/gravador OOXML escrito à mão
em `src/docx.ts`, sem Pandoc, LibreOffice ou serviço remoto. Ela preserva
títulos (H1–H6), negrito, itálico, sublinhado, tachado, listas (com marcador
ou numeradas), tabelas, hyperlinks e acentuação. Não preserva imagens,
fontes, estilos customizados além dos títulos/lista padrão, cabeçalho/rodapé,
notas de rodapé, comentários, controle de alterações, numeração multinível ou
objetos incorporados — esses elementos são descartados silenciosamente na
leitura e nunca gerados na escrita.

A conversão para/de PDF é feita em `src/pdf.ts`. A **escrita** é um gerador
PDF próprio (objetos PDF montados à mão: catálogo, páginas, fontes padrão,
fluxo de conteúdo, anotações, tabela xref). **Não incorpora fontes**: usa as
famílias padrão nº 14 (Helvetica, Times ou Courier, sempre presentes em
qualquer leitor PDF) e as tabelas de largura de glifo AFM da Adobe
(`public/vendor/afm/`, compiladas em `src/afm-widths.ts` por
`scripts/build-afm.mjs`) para fazer quebra de linha e justificação
proporcionais de verdade — não uma quebra por contagem de caractere. Preserva
hierarquia de títulos (H1–H6 com escala e espaçamento), negrito, itálico,
listas com recuo pendente, número de página no rodapé e **links clicáveis**
(anotações `/Link` com ação URI). Código (`code`/`<pre>`) fica sempre em
Courier. O layout é configurável via `PdfOptions` (família, tamanho de corpo,
entrelinha, tamanho de página A4/Carta, margens, número de página,
justificação), com defaults tipográficos bons; ainda **não** é uma réplica
visual do documento de origem. Tabelas são desenhadas como uma grade real
(bordas, largura de coluna proporcional ao conteúdo mais longo de cada coluna,
cabeçalho com fundo sombreado, quebra de linha por célula e nova página entre
linhas quando necessário), mas o cabeçalho não se repete quando a tabela
atravessa uma quebra de página; sublinhado/tachado são desenhados como um
traço; não há imagens no PDF gerado; a codificação é WinAnsi (sem Unicode além
de cp1252). A **leitura** usa pdf.js (Mozilla, Apache-2.0, vendorizado em
`public/vendor/pdfjs/`, carregado sob demanda) para extrair o texto de origem
via `getTextContent`. `pdfToStructured` agrupa os trechos em linhas pelo `y`,
detecta títulos pelo tamanho de fonte relativo ao corpo e listas pelo marcador,
e emite o HTML intermediário (PDF → MD/DOCX/HTML/…); tabelas e formatação inline
do PDF original não são recuperadas. PDF → TXT continua usando só o texto
corrido (`pdfToText`).

**RTF, ODT, CSV, EPUB e Imagens → PDF** seguem o mesmo desenho de leitor/gravador
próprio, 100% local (`src/rtf.ts`, `src/odt.ts`, `src/csv.ts`, `src/epub.ts`,
`src/image.ts`). ODT e EPUB usam o JSZip já vendorizado, com `mimetype` como
primeira entrada não comprimida. RTF preserva ênfases, código, títulos, listas,
tabelas simples e links (acentos como `\uN?`); CSV é tratado como tabela (parser
RFC 4180, delimitador detectado); EPUB é só saída, um livro de documento único
com sumário pelos títulos; Imagens → PDF incorpora JPEG sem recompressão
(`/DCTDecode`) e PNG via canvas (`/FlateDecode` + `/SMask`), uma imagem por
página, com modo "combinar" para uma fila só de imagens.

A conversão é sequencial por arquivo. Cada resultado tem download individual —
exceto o modo "combinar imagens", que gera um único PDF. Não há ZIP de
resultados, histórico, edição ou processamento em paralelo.

### Interface

- seleção múltipla por seletor de arquivos e arrastar/soltar;
- remoção individual, limpeza da fila e, no modo "combinar imagens", reordenação
  por `▲▼`;
- seleção do formato de saída e painel **"Opções de saída"** (PDF, DOCX,
  Imagens → PDF), com defaults recomendados, persistido em `localStorage`;
- estado de leitura, conversão, sucesso e falha por sessão;
- tema claro/escuro persistido em `localStorage`;
- instalação PWA quando o navegador oferecer o prompt;
- links para o portal AppsBox, privacidade, termos e contato;
- identidade visual baseada no Conversor de Imagens e no logotipo fornecido.

## 3. Limites explícitos

Não estão implementados nem podem ser anunciados nesta versão:

- DOC binário (`.doc` legado), ODS/ODP, EPUB como **entrada**;
- XLS/XLSX e apresentações (PPT/PPTX);
- OCR (extração de texto de imagem escaneada dentro de um PDF);
- macros, JavaScript de documentos, objetos ativos, PDFs criptografados ou
  assinados digitalmente;
- engine WebAssembly, Pandoc, LibreOffice ou conversão remota;
- em DOCX: imagens, fontes, estilos customizados, cabeçalho/rodapé, notas de
  rodapé, comentários, controle de alterações, numeração multinível e objetos
  incorporados — a leitura os descarta e a escrita nunca os gera;
- em PDF: imagens no PDF gerado, fontes incorporadas/customizadas, réplica
  visual do documento de origem, texto Unicode fora de cp1252, cabeçalho de
  tabela repetido entre páginas, formulários e assinaturas — a escrita gera um
  layout tipográfico próprio (fontes proporcionais padrão, hierarquia de
  títulos, número de página, links clicáveis, tabelas em grade real sem
  repetir o cabeçalho numa quebra de página) e a leitura extrai apenas texto
  corrido;
- em RTF/ODT: fontes, cores, estilos customizados, imagens, cabeçalho/rodapé,
  notas e metadados — descartados na leitura, nunca gerados na escrita;
- em CSV: qualquer coisa que não seja tabela (na escrita) e tipagem de célula;
- em EPUB: imagens, divisão em capítulos, fontes embutidas — e EPUB não é aceito
  como entrada;
- em Imagens → PDF: PNG com transparência depende do canvas do navegador; JPEG
  CMYK/grayscale é tratado como RGB; sem OCR;
- conta, login, histórico, armazenamento de arquivos ou telemetria por arquivo.

Toda a matriz (TXT, Markdown, HTML, DOCX, PDF, RTF, ODT, CSV, EPUB e Imagens →
PDF) roda no navegador usando exclusivamente JSZip 3.10.1 (MIT,
`public/vendor/jszip.js`), pdf.js (Mozilla, Apache-2.0, `public/vendor/pdfjs/`,
sob demanda), as métricas AFM Core 14 da Adobe (`public/vendor/afm/`, só
larguras de glifo, licença de redistribuição permissiva em
`public/vendor/afm/LICENSE`) e as APIs nativas
`DOMParser`/`XMLSerializer`/`CompressionStream`/`createImageBitmap`/
`OffscreenCanvas`; sem CDN e sem nenhuma outra biblioteca de terceiros. Um novo
formato ou par de conversão exige spike técnico, fixtures licenciados, revisão
de licença e atualização deste PRD antes de alterar a interface — ver AGENTS.md,
seção "Processo para novos formatos ou pares de conversão".

## 4. Privacidade e segurança

O arquivo é lido com `File.text()` (TXT/Markdown/HTML) ou `File.arrayBuffer()`
(DOCX/PDF) e processado com `DOMParser`/JSZip/pdf.js no navegador; o DOCX ou
PDF gerado na saída é montado localmente (JSZip ou o gerador PDF próprio) e
baixado via `Blob`/`URL.createObjectURL`, sem passar pelo backend em nenhum
momento. pdf.js só é buscado (via `import()` dinâmico, do próprio domínio,
nunca de CDN) quando o usuário efetivamente converte um PDF. HTML de entrada
nunca é inserido como interface da aplicação durante a análise; o resultado
HTML é apenas um arquivo para download. O backend recebe somente:

```http
GET  /api/count
POST /api/count
Content-Type: application/json

{}
```

O `POST` aceita exclusivamente `{}` e incrementa uma linha SQLite. Não são
enviados nem persistidos conteúdo, nome, extensão, tamanho, hash, IP funcional,
identificador ou tempo de conversão. Falha no contador não impede o download.

O Apache envia CSP restritiva, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, HSTS, política de referência e Permissions-Policy.
Não há CDN, origem externa, upload ou rota de conversão no servidor.

## 5. Arquitetura do repositório

```text
src/main.ts                         interface, fila e orquestração da conversão
src/text-formats.ts                 TXT/Markdown/HTML (extraído para teste)
src/docx.ts                         leitor/gravador OOXML (DOCX) via JSZip
src/pdf.ts                          gerador PDF próprio + leitor via pdf.js
src/rtf.ts                          leitor/gravador RTF próprio
src/odt.ts                          leitor/gravador ODF (ODT) via JSZip
src/csv.ts                          parser/gravador CSV/TSV (RFC 4180)
src/epub.ts                         gravador EPUB 3 via JSZip (só saída)
src/image.ts                        imagens -> PDF (combinar), JPEG/PNG
src/afm-widths.ts                   larguras de glifo AFM (gerado, não editar)
scripts/build-afm.mjs               compila public/vendor/afm/*.afm -> afm-widths.ts
public/vendor/afm/                  métricas AFM Core 14 da Adobe (licença permissiva)
public/index.html                   shell PWA + blocos seo-links/seo-jsonld
public/style.css                    estilos responsivos e temas
public/manifest.webmanifest         manifesto instalável
public/service-worker.js            cache do shell
public/assets/appsboxconvdocslogo.png
public/vendor/jszip.js              JSZip 3.10.1 (MIT), vendorizado
public/vendor/pdfjs/                pdf.js 4.10.38 (Apache-2.0), vendorizado
public/converter/<par>/index.html   páginas de SEO por par de conversão
public/converter/index.html         hub de todas as conversões
public/sitemap.xml                  gerado por scripts/generate-seo-pages.mjs
backend/counter.py                  contador HTTP + SQLite WAL
scripts/start.sh                    inicialização do contador
scripts/stop.sh                     parada segura do contador
scripts/deploy.sh                   build e publicação atômica
scripts/generate-seo-pages.mjs      gera páginas de conversão, hub, sitemap
                                     e os blocos seo-links/seo-jsonld
deploy/*.service                    modelo systemd
deploy/*.conf                       modelo Apache
tests/docx.test.mjs                 round trip DOCX↔HTML (node --test + jsdom)
tests/pdf.test.mjs                  validação estrutural do PDF gerado
```

`dist/`, `node_modules/`, `.run/`, `__pycache__/` e bancos SQLite são artefatos
locais e não pertencem ao Git.

## 6. Desenvolvimento e validação

Requisitos: Node.js, npm e Python 3.

```bash
npm ci
npm run check
npm run build
npm test
python3 -m py_compile backend/counter.py
python3 -m json.tool public/manifest.webmanifest >/dev/null
node --check public/service-worker.js
```

`npm test` roda `tests/docx.test.mjs` e `tests/pdf.test.mjs` sob `node --test`,
usando `jsdom` (só em tempo de teste, nunca embarcado no navegador) para
fornecer `DOMParser` fora do browser. O DOCX é validado por round trip
completo (HTML↔DOCX), incluindo documentos com estilo
`ListBullet`/`ListNumber` (o padrão gerado pelo próprio Word e por
bibliotecas como `python-docx`, sem `numPr` explícito). O PDF é validado
estruturalmente (cabeçalho `%PDF`, `%%EOF`, fontes, paginação); a leitura
(pdf.js) e a fidelidade fina do texto extraído/gerado são verificadas
manualmente com `pypdf`/`python-docx` como leitores independentes e com
Playwright contra a UI real antes de cada deploy — ver AGENTS.md, "Processo
para novos formatos ou pares de conversão".

Depois de qualquer mudança na matriz de formatos, rodar
`npm run generate-seo` e commitar o resultado (`public/converter/*`,
`public/sitemap.xml` e os blocos `seo-links`/`seo-jsonld` em
`public/index.html`).

O TypeScript é compilado para `dist/main.js`. Antes de qualquer commit, manter
UTF-8 sem BOM e preservar todas as acentuações em português.

## 7. Operação implantada

### Frontend

- projeto operacional: `/mnt/dados/projetos/appsbox-conv-documentos`;
- releases: `/var/www/appsbox-conv-documentos/releases/<timestamp>`;
- ponteiro ativo: `/var/www/appsbox-conv-documentos/current`;
- deploy: `scripts/deploy.sh`;
- rollback: repontar `current` para uma release anterior e recarregar Apache.

### Contador

- unidade: `appsbox-conv-documentos.service`;
- bind: `127.0.0.1:9700`;
- dados: `/mnt/dados/appsbox-conv-documentos/contador.sqlite`;
- log: `/mnt/dados/projetos/appsbox-conv-documentos/.run/counter.log`;
- health: `GET /health`.

Comandos:

```bash
sudo systemctl status appsbox-conv-documentos.service --no-pager
sudo systemctl restart appsbox-conv-documentos.service
curl http://127.0.0.1:9700/health
```

### Apache e HTTPS

O arquivo ativo é `/etc/apache2/sites-available/docs.appsbox.com.br.conf`.
HTTP redireciona para HTTPS. O certificado é
`/etc/letsencrypt/live/appsbox.com.br/{fullchain.pem,privkey.pem}`, que cobre
`*.appsbox.com.br`; não emitir certificado separado.

O Apache serve o frontend e encaminha somente `/api/` e `/health` para o
contador local. A porta 9700 não é pública.

## 8. Cache e offline

O service worker pré-armazena o shell essencial: HTML, CSS, `main.js`,
`docx.js`, `pdf.js`, `vendor/jszip.js`, manifesto e logo. Os arquivos de
`public/vendor/pdfjs/` (leitor de PDF, ~4 MB com `cmaps`/`standard_fonts`)
não entram no pré-cache — são buscados sob demanda na primeira conversão de
PDF e então ficam em cache oportunisticamente pelo mesmo service worker, para
não pesar o carregamento inicial de quem nunca converte PDF. O Apache não
mantém cache persistente para `index.html`, manifesto e service worker; CSS
e JavaScript recebem cache de um dia. Os arquivos do usuário e resultados não
entram no Cache Storage e URLs temporárias devem ser liberadas pela aplicação
quando a fila for limpa.

Offline significa que a interface e a conversão deste MVP podem continuar após
o shell ter sido carregado — incluindo DOCX e PDF, uma vez que `jszip.js` e
`pdfjs` (depois do primeiro uso) já estejam em cache. Não significa que
engines Office completas ou OCR estejam disponíveis.

## 9. Backup e recuperação

O backup unificado inclui, pela allowlist da família `appsbox-conv-documentos`:

- código do projeto;
- release publicada;
- VirtualHost;
- cópia consistente do SQLite do contador;
- documentação operacional.

Segredos, `node_modules`, logs e caches não são copiados. Para restaurar o
contador, parar a unidade, restaurar uma cópia consistente, executar
`PRAGMA integrity_check` e iniciar novamente. Não há documentos para restaurar.

## 10. DNS e estado público

O VirtualHost e o certificado estão instalados. Em 18/08/2026, a resolução DNS
pública propagou e a URL foi validada através do proxy Cloudflare, com resposta
HTTPS 200, health check e contador funcionais. Validar novamente após qualquer
alteração de DNS ou Apache:

```bash
curl -I http://docs.appsbox.com.br/
curl -I https://docs.appsbox.com.br/
curl https://docs.appsbox.com.br/health
```

## 11. Próximas versões

Os spikes de DOCX e PDF foram concluídos e entregues (24/08/2026): DOCX via
leitor/gravador OOXML próprio (`tests/docx.test.mjs`, validado contra
`python-docx`); PDF via gerador próprio + leitor pdf.js (`tests/pdf.test.mjs`,
validado contra `pypdf` e contra um PDF gerado por outra ferramenta
independente). A matriz de formatos permanece congelada em TXT, Markdown,
HTML, DOCX e PDF. Qualquer novo formato (ODT, RTF, planilhas, apresentações,
OCR etc.) exige um spike isolado equivalente, sem alterar a promessa pública
até aprovação, seguindo o processo fixado em AGENTS.md ("Processo para novos
formatos ou pares de conversão"): implementação 100% local, testes em duas
camadas (automatizado + verificação cruzada independente), documentação de
limites de fidelidade, geração das páginas de SEO (`npm run generate-seo`) e
atualização deste PRD antes de mudar a interface.

## 12. Documentos relacionados

- [AGENTS.md](AGENTS.md) — regras de contribuição e validação;
- [docs operacionais OCI](/home/ubuntu/dados/oci/docs/appsbox-conv-documentos.md);
- [PRD](PRD_AppsBox_Conversor_de_Documentos.md).
