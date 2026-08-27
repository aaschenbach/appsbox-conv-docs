# Fixtures e testes

Esta pasta é reservada para fixtures sintéticos, públicos ou licenciados. Não
adicione documentos pessoais, arquivos de clientes ou dados secretos. Cada
fixture deve documentar o formato, a finalidade e a limitação que cobre.

`docx.test.mjs` e `pdf.test.mjs` rodam com `node --test` (`npm test`) e usam
`jsdom` (apenas em tempo de teste, nunca embarcado no navegador) para expor
`DOMParser` fora do browser.

- `docx.test.mjs` gera fixtures DOCX sinteticamente dentro do próprio teste —
  via `htmlToDocxBytes` e via XML OOXML montado manualmente com JSZip — para
  cobrir o round trip HTML→DOCX→HTML e o caso de listas por estilo
  (`ListBullet`/`ListNumber`, sem `numPr`), que é como o Word e bibliotecas
  como `python-docx` costumam gravar listas.
- `pdf.test.mjs` valida a estrutura do PDF gerado por `htmlToPdfBytes`
  (cabeçalho, `%%EOF`, fontes, paginação em múltiplas páginas) sem depender
  de pdf.js, que só roda em navegador.

Esses testes automatizados **não substituem** a verificação cruzada manual
exigida pelo processo em `AGENTS.md` ("Processo para novos formatos ou pares
de conversão") antes de um deploy: abrir o arquivo gerado com uma biblioteca
independente (`python-docx`, `pypdf`) e/ou testar a UI real com Playwright.
Um round trip que só usa o próprio código para ler o que ele mesmo escreveu
pode mascarar um formato inválido para outros leitores.
