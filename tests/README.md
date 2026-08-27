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
- `image.test.mjs` — `jpegSize` (marcador SOF) e a montagem do PDF de imagens
  (`/DCTDecode` para JPEG, `/FlateDecode` + `/SMask` para RGBA, N páginas).

Esses testes automatizados **não substituem** a verificação cruzada manual
exigida pelo processo em `AGENTS.md` ("Processo para novos formatos ou pares
de conversão") antes de um deploy: abrir o arquivo gerado com uma biblioteca
independente (`python-docx`, `pypdf`) e/ou testar a UI real com Playwright.
Um round trip que só usa o próprio código para ler o que ele mesmo escreveu
pode mascarar um formato inválido para outros leitores.
