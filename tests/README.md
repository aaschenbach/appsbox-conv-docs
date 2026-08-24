# Fixtures e testes

Esta pasta é reservada para fixtures sintéticos, públicos ou licenciados. Não
adicione documentos pessoais, arquivos de clientes ou dados secretos. Cada
fixture deve documentar o formato, a finalidade e a limitação que cobre.

`docx.test.mjs` roda com `node --test` (`npm test`) e usa `jsdom` (apenas em
tempo de teste, nunca embarcado no navegador) para expor `DOMParser` fora do
browser. Ele gera fixtures DOCX sinteticamente dentro do próprio teste — via
`htmlToDocxBytes` e via XML OOXML montado manualmente com JSZip — para cobrir
o round trip HTML→DOCX→HTML e o caso de listas por estilo (`ListBullet`/
`ListNumber`, sem `numPr`), que é como o Word e bibliotecas como `python-docx`
costumam gravar listas.
