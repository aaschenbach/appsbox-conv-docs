# AppsBox Conversor de Documentos

PWA de conversão local de TXT, Markdown, HTML e DOCX para HTML, TXT, Markdown
ou DOCX. Os documentos nunca são enviados ao backend; o único serviço é o
contador global agregado. O produto é publicado em
<https://docs.appsbox.com.br>.

## Desenvolvimento

```bash
npm ci
npm run check
npm run build
npm test
python3 -m py_compile backend/counter.py
python3 -m json.tool public/manifest.webmanifest >/dev/null
node --check public/service-worker.js
```

O frontend é HTML, CSS e TypeScript estrito, compilado para `dist/`. A
conversão ocorre no navegador com `File.text()`/`File.arrayBuffer()` e
`DOMParser`; DOCX é lido e gravado com JSZip (`public/vendor/jszip.js`, MIT,
vendorizado localmente, sem CDN). Não há engine remota nem upload. O backend
local roda em `127.0.0.1:9700`.

## Estrutura

```text
src/       TypeScript do frontend, conversão local e leitor/gravador DOCX
public/    shell, PWA, estilos, logo e JSZip vendorizado
backend/   contador Python + SQLite
scripts/   start, stop e deploy
deploy/    modelos systemd e Apache
tests/     fixtures, testes e round trip DOCX↔HTML
```

`dist/`, `node_modules/`, `.run/`, `__pycache__/`, SQLite e releases são
artefatos operacionais e não são versionados.

## Operação

- frontend: `/var/www/appsbox-conv-documentos/current`;
- releases: `/var/www/appsbox-conv-documentos/releases/`;
- contador: `appsbox-conv-documentos.service`;
- banco: `/mnt/dados/appsbox-conv-documentos/contador.sqlite`;
- health check: `curl http://127.0.0.1:9700/health`;
- domínio: `https://docs.appsbox.com.br`;
- porta interna: `127.0.0.1:9700`.
- DNS e HTTPS públicos validados em 18/08/2026.

Comandos:

```bash
sudo systemctl status appsbox-conv-documentos.service --no-pager
sudo systemctl restart appsbox-conv-documentos.service
sudo apache2ctl configtest
```

O modelo de serviço e VirtualHost está em `deploy/`. O deploy compila, publica
uma release imutável, alterna `current` atomicamente e valida a URL pública.
Consulte o [PRD](PRD_AppsBox_Conversor_de_Documentos.md) para o escopo exato;
não anuncie PDF, OCR, outros formatos Office (XLS/XLSX, PPT/PPTX) ou EPUB
nesta versão — apenas TXT, Markdown, HTML e DOCX.

## Privacidade

O backend aceita apenas `GET /health`, `GET /api/count` e `POST /api/count` com
corpo exatamente `{}`. Não recebe documentos, nomes, extensões, tamanhos,
hashes, IP funcional ou identificadores. A falha do contador não impede o
download.

## Documentação

- [AGENTS.md](AGENTS.md): regras de contribuição, segurança e publicação;
- [PRD](PRD_AppsBox_Conversor_de_Documentos.md): fonte de verdade funcional;
- [documentação OCI](/home/ubuntu/dados/oci/docs/appsbox-conv-documentos.md):
  estado operacional, Apache, serviço, backup e pendências externas.
