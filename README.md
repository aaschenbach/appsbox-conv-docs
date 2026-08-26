# AppsBox Conversor de Documentos

PWA de conversão local de TXT, Markdown, HTML, DOCX e PDF para HTML, TXT,
Markdown, DOCX ou PDF. Os documentos nunca são enviados ao backend; o único
serviço é o contador global agregado. O produto é publicado em
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
`DOMParser`; DOCX é lido e gravado com JSZip (`public/vendor/jszip.js`, MIT);
PDF é gerado por um escritor próprio e lido com pdf.js (Mozilla, Apache-2.0,
`public/vendor/pdfjs/`, carregado sob demanda). Tudo vendorizado localmente,
sem CDN. Não há engine remota nem upload. O backend local roda em
`127.0.0.1:9700`.

## Estrutura

```text
src/       TypeScript do frontend, conversão local, DOCX e PDF
public/    shell, PWA, estilos, logo, bibliotecas vendorizadas e páginas de SEO
backend/   contador Python + SQLite
scripts/   start, stop, deploy e geração das páginas de SEO
deploy/    modelos systemd e Apache
tests/     fixtures, testes automatizados e notas de verificação manual
```

Sempre que um formato ou par de conversão novo for adicionado, seguir o
processo fixado em [AGENTS.md](AGENTS.md) ("Processo para novos formatos ou
pares de conversão"): implementar 100% no navegador, testar em duas camadas,
documentar limites de fidelidade, rodar `npm run generate-seo` e só então
fazer deploy/push.

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
não anuncie OCR, outros formatos Office (XLS/XLSX, PPT/PPTX, ODT/ODS/ODP,
RTF) ou EPUB nesta versão — apenas TXT, Markdown, HTML, DOCX e PDF.

## Privacidade

O backend aceita apenas `GET /health`, `GET /api/count` e `POST /api/count` com
corpo exatamente `{}`. Não recebe documentos, nomes, extensões, tamanhos,
hashes, IP funcional ou identificadores. A falha do contador não impede o
download.

## Produtos relacionados

O [AppsBox Conversor de Imagens](https://images.appsbox.com.br) segue a mesma
arquitetura para JPEG, PNG e WebP. Os dois produtos fazem crosslink recíproco
na home e nas páginas de SEO.

## Documentação

- [AGENTS.md](AGENTS.md): regras de contribuição, segurança e publicação;
- [PRD](PRD_AppsBox_Conversor_de_Documentos.md): fonte de verdade funcional;
- documentação operacional da VPS: `/home/aaschen/repo/vps-docs`.
