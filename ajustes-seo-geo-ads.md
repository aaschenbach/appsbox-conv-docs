# Ajustes de SEO, GEO e AdSense — Conversor de Documentos

## Objetivo e ordem

Seguir a ordem global: (1) rastreamento, (2) conteúdo, (3) links com o portal,
(4) validação/Search Console e (5) consentimento/AdSense somente após aprovação
de `appsbox.com.br`. O produto processa arquivos exclusivamente no navegador;
todo texto de SEO deve preservar essa promessa e não anunciar formatos fora da
matriz TXT, Markdown e HTML.

## Ajustes deste repositório

1. Criar em `public/` os arquivos `robots.txt`, `sitemap.xml` e `ads.txt`.
   O robots deve permitir o site e apontar para o sitemap; o ads deve conter só
   a linha autorizada do publisher. Alterar `scripts/deploy.sh` para copiar os
   três arquivos para cada release, pois hoje ele copia uma lista fechada.
2. Em `public/index.html`, adicionar canonical absoluto, Open Graph, Twitter
   Card e JSON-LD `WebApplication`, descrevendo conversão local de TXT,
   Markdown e HTML. Não declarar PDF, Office, OCR, EPUB, upload ou conversão
   remota.
3. Criar páginas estáticas, publicadas pelo mesmo deploy, para ajuda e GEO:
   conversão Markdown→HTML, TXT→Markdown, HTML→texto e privacidade da
   conversão local. Cada uma deve ter title, description, canonical, texto
   visível, exemplos verdadeiros e links de volta à ferramenta.
4. Incluir somente home e páginas de ajuda públicas no sitemap; definir
   `lastmod` quando o conteúdo mudar. Não indexar endpoints de contador,
   artefatos de build ou URLs de resultados de arquivo.
5. Corrigir o rodapé: `/termos` não existe hoje no portal AppsBox. Criar rota
   correspondente no portal antes de apontar para ela, ou apontar para uma
   página legal válida já existente.
6. Após aprovação, implementar CMP/banner e política atualizada antes de GTM ou
   AdSense. A escolha deve controlar quaisquer tecnologias não essenciais; a
   ferramenta deve continuar funcional se analytics/publicidade falharem.

## Checagens em outros repositórios

- `appsbox`: confirmar página de produto, card, link de privacidade e destino
  de Termos antes de mudar o rodapé daqui.
- `appsbox-puzzle`: consultar apenas o publisher ID e princípios de consentimento;
  não reutilizar scripts/containers sem análise e configuração própria.
- `appsbox-conv-imagens`: manter consistência de linguagem, mas páginas, sitemap
  e ads.txt precisam ser independentes por host.

## Critérios de aceite

- `https://docs.appsbox.com.br/{robots.txt,sitemap.xml,ads.txt}` deixam de
  retornar `404`; ads é `text/plain`.
- Todas as promessas de formato e privacidade correspondem ao PRD e ao código.
- `npm run check`, `npm run build`, compilação do backend e as validações
  documentadas em `AGENTS.md` passam.
