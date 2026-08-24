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
- `.docx` — documento OOXML do Word.

Arquivos de outras extensões são rejeitados pela interface e não são enviados.

### Saídas aceitas

- **HTML:** TXT é encapsulado em `<pre>`, Markdown recebe conversão local de
  títulos, parágrafos, negrito e itálico; HTML existente é preservado como
  texto de saída; DOCX é lido e convertido para HTML equivalente;
- **TXT:** HTML é convertido para texto usando `DOMParser`; TXT e Markdown são
  mantidos como texto; DOCX segue o mesmo caminho do HTML lido;
- **Markdown:** Markdown, TXT e HTML são tratados como texto. HTML e DOCX não
  são reconstruídos semanticamente para Markdown nesta versão (apenas
  encapsulados como HTML/texto de origem);
- **DOCX:** TXT, Markdown e HTML são normalizados para um HTML intermediário
  e então serializados como pacote OOXML mínimo (`word/document.xml`,
  `styles.xml`, `numbering.xml`, `docProps/*`) gerado com JSZip.

A conversão para/de DOCX é feita por um leitor/gravador OOXML escrito à mão
em `src/docx.ts`, sem Pandoc, LibreOffice ou serviço remoto. Ela preserva
títulos (H1–H6), negrito, itálico, sublinhado, tachado, listas (com marcador
ou numeradas), tabelas, hyperlinks e acentuação. Não preserva imagens,
fontes, estilos customizados além dos títulos/lista padrão, cabeçalho/rodapé,
notas de rodapé, comentários, controle de alterações, numeração multinível ou
objetos incorporados — esses elementos são descartados silenciosamente na
leitura e nunca gerados na escrita.

A conversão é sequencial por arquivo. Cada resultado tem download individual;
não há ZIP, histórico, edição, pré-visualização avançada ou processamento em
paralelo.

### Interface

- seleção múltipla por seletor de arquivos e arrastar/soltar;
- remoção individual e limpeza da fila;
- seleção do formato de saída;
- estado de leitura, conversão, sucesso e falha por sessão;
- tema claro/escuro persistido em `localStorage`;
- instalação PWA quando o navegador oferecer o prompt;
- links para o portal AppsBox, privacidade, termos e contato;
- identidade visual baseada no Conversor de Imagens e no logotipo fornecido.

## 3. Limites explícitos

Não estão implementados nem podem ser anunciados nesta versão:

- DOC binário (`.doc` legado), ODT/ODS/ODP, RTF, EPUB;
- XLS/XLSX/CSV e apresentações (PPT/PPTX);
- PDF, OCR e PDF → Office;
- macros, JavaScript de documentos, objetos ativos ou arquivos protegidos;
- engine WebAssembly, Pandoc, LibreOffice ou conversão remota;
- em DOCX: imagens, fontes, estilos customizados, cabeçalho/rodapé, notas de
  rodapé, comentários, controle de alterações, numeração multinível e objetos
  incorporados — a leitura os descarta e a escrita nunca os gera;
- conta, login, histórico, armazenamento de arquivos ou telemetria por arquivo.

O suporte a DOCX (spike concluído nesta versão) usa exclusivamente
JSZip 3.10.1 (MIT, vendorizado em `public/vendor/jszip.js`, sem CDN) e as
APIs nativas `DOMParser`/`XMLSerializer` do navegador; não há dependência de
outra biblioteca de terceiros para nenhum formato. Uma expansão além de DOCX
(novo formato de entrada/saída) exige spike técnico, fixtures licenciados,
revisão de licença e atualização deste PRD antes de alterar a interface.

## 4. Privacidade e segurança

O arquivo é lido com `File.text()` (TXT/Markdown/HTML) ou `File.arrayBuffer()`
(DOCX) e processado com `DOMParser`/JSZip no navegador; o DOCX gerado na saída
é montado com JSZip e baixado via `Blob`/`URL.createObjectURL`, sem passar
pelo backend em nenhum momento. HTML de entrada nunca é inserido como
interface da aplicação durante a análise; o resultado HTML é apenas um
arquivo para download. O backend recebe somente:

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
src/main.ts                         interface e conversão local
src/docx.ts                         leitor/gravador OOXML (DOCX) via JSZip
public/index.html                   shell PWA
public/style.css                    estilos responsivos e temas
public/manifest.webmanifest         manifesto instalável
public/service-worker.js            cache do shell
public/assets/appsboxconvdocslogo.png
public/vendor/jszip.js              JSZip 3.10.1 (MIT), vendorizado
backend/counter.py                  contador HTTP + SQLite WAL
scripts/start.sh                    inicialização do contador
scripts/stop.sh                     parada segura do contador
scripts/deploy.sh                   build e publicação atômica
deploy/*.service                    modelo systemd
deploy/*.conf                       modelo Apache
tests/docx.test.mjs                 round trip DOCX↔HTML (node --test + jsdom)
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

`npm test` roda `tests/docx.test.mjs` sob `node --test`, usando `jsdom` (só em
tempo de teste, nunca embarcado no navegador) para fornecer `DOMParser` fora
do browser e validar o round trip DOCX↔HTML, incluindo documentos com estilo
`ListBullet`/`ListNumber` (o padrão gerado pelo próprio Word e por
bibliotecas como `python-docx`, sem `numPr` explícito).

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

O service worker armazena o shell, CSS, JavaScript, manifesto e logo. O Apache
não mantém cache persistente para `index.html`, manifesto e service worker; CSS
e JavaScript recebem cache de um dia. Os arquivos do usuário e resultados não
entram no Cache Storage e URLs temporárias devem ser liberadas pela aplicação
quando a fila for limpa.

Offline significa que a interface e a conversão deste MVP podem continuar após
o shell ter sido carregado. Não significa que engines Office ou OCR estejam
disponíveis.

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

O spike de DOCX foi concluído e entregue nesta versão (24/08/2026): leitor e
gravador OOXML próprios, sem Pandoc/LibreOffice/serviço remoto, cobertos por
`tests/docx.test.mjs` e validados contra `python-docx` como leitor
independente. A matriz de formatos permanece congelada além de TXT, Markdown,
HTML e DOCX. Qualquer novo formato (ODT, RTF, PDF, planilhas, apresentações
etc.) exige um spike isolado equivalente, sem alterar a promessa pública até
aprovação: fixtures com acentos, conteúdo malformado e casos de perda de
fidelidade, testes de privacidade e offline, e atualização deste PRD antes de
mudar a interface.

## 12. Documentos relacionados

- [AGENTS.md](AGENTS.md) — regras de contribuição e validação;
- [docs operacionais OCI](/home/ubuntu/dados/oci/docs/appsbox-conv-documentos.md);
- [PRD](PRD_AppsBox_Conversor_de_Documentos.md).
