# Instruções do projeto

## Codificação

- Todos os arquivos são UTF-8 sem BOM.
- Preserve acentos e pontuação em português; corrija texto corrompido antes de
  concluir.
- Não edite arquivos com `cat`, redirecionamento ou scripts de escrita; use
  `apply_patch` para alterações manuais.

## Estrutura e escopo

- `src/`: TypeScript do frontend;
- `public/`: shell, PWA, estilos e logo;
- `backend/`: somente o contador agregado;
- `scripts/`: ciclo de vida e deploy;
- `deploy/`: modelos systemd e Apache;
- `PRD_AppsBox_Conversor_de_Documentos.md`: fonte de verdade do produto;
- `README.md`: desenvolvimento e operação;
- `tests/`: fixtures e testes, quando existirem.

Não adicionar conversão remota, upload, conta, histórico ou telemetria por
arquivo. Documentos nunca podem chegar ao backend — inclusive DOCX, que é
lido/gravado inteiramente no navegador com JSZip (`public/vendor/jszip.js`,
MIT, vendorizado localmente, sem CDN) e `DOMParser`/`XMLSerializer`.

## Formatos atualmente suportados

TXT, Markdown (`.md`, `.markdown`), HTML (`.html`, `.htm`) e DOCX (`.docx`)
como entrada; HTML, TXT, Markdown e DOCX como saída. A conversão DOCX é um
gerador/leitor OOXML mínimo escrito à mão (`src/docx.ts`): preserva títulos,
negrito/itálico/sublinhado/tachado, listas, tabelas, links e acentuação, mas
não preserva imagens, fontes, estilos customizados, cabeçalho/rodapé,
comentários, controle de alterações ou numeração aninhada. Não anunciar
outros formatos Office (XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, RTF), PDF, OCR ou
EPUB.

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

O deploy oficial usa `/mnt/dados/projetos/appsbox-conv-documentos`, publica em
`/var/www/appsbox-conv-documentos/releases/`, alterna `current` atomicamente e
mantém o contador em `127.0.0.1:9700`. Nunca abrir essa porta na internet.

Antes de alterar Apache, systemd, dados ou backup, ler o skill
`oci-onboard-app` e comparar os arquivos do repositório com o estado real.
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
