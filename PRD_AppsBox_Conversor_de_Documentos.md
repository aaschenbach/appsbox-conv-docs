# PRD — AppsBox Conversor de Documentos

> **Status:** especificação de produto para implementação  
> **Produto de referência:** AppsBox Conversor de Imagens  
> **URL proposta:** `https://docs.appsbox.com.br`  
> **Nome:** AppsBox Conversor de Documentos

---

## 1. Visão do produto

O **AppsBox Conversor de Documentos** é uma PWA pública para conversão de documentos diretamente no navegador.

A proposta central é a mesma do AppsBox Conversor de Imagens:

- simples de entender;
- rápido para tarefas pontuais;
- sem conta ou login;
- sem armazenamento dos arquivos;
- processamento local sempre que tecnicamente possível;
- transparência sobre privacidade, limitações e andamento;
- instalação como PWA;
- funcionamento offline depois que os componentes necessários tiverem sido carregados e armazenados localmente.

O produto deve priorizar uma experiência em que o usuário consiga selecionar um arquivo, entender imediatamente quais conversões são possíveis, configurar apenas o que fizer sentido para aquela conversão e baixar o resultado sem precisar conhecer detalhes técnicos dos formatos.

A interface deve deixar explícito, desde o primeiro contato, que os documentos permanecem no dispositivo durante a conversão.

---

## 2. Problema

Conversores de documentos na web frequentemente exigem upload do arquivo para um servidor externo, criando problemas de:

- privacidade;
- confidencialidade;
- tempo de upload;
- limites de tamanho;
- dependência da conexão;
- armazenamento temporário pouco transparente;
- necessidade de conta ou pagamento;
- interfaces carregadas de anúncios e etapas desnecessárias.

O AppsBox Conversor de Documentos deve resolver conversões comuns com a menor quantidade possível de atrito e, sempre que a tecnologia permitir, sem que o arquivo saia do dispositivo.

---

## 3. Objetivos

### 3.1 Objetivos principais

1. Converter documentos de forma local no navegador.
2. Não enviar o conteúdo dos arquivos ao backend.
3. Oferecer formatos de saída relevantes conforme o tipo do arquivo selecionado.
4. Explicar em linguagem simples o que cada parâmetro altera.
5. Mostrar continuamente o andamento para que o usuário nunca interprete uma operação longa como travamento.
6. Manter identidade visual e comportamento coerentes com o AppsBox Conversor de Imagens.
7. Permitir instalação como PWA.
8. Permitir uso offline após o carregamento dos componentes necessários.
9. Manter apenas um contador global agregado de conversões concluídas.
10. Tratar diferenças de fidelidade entre formatos de maneira explícita, sem prometer equivalência visual quando ela não puder ser garantida.

### 3.2 Não objetivos

O produto não pretende ser:

- editor de documentos;
- suíte Office online;
- armazenamento em nuvem;
- gerenciador de documentos;
- serviço de colaboração;
- sistema de assinatura digital;
- ferramenta de edição de PDF;
- plataforma de OCR avançado no MVP;
- serviço de recuperação de arquivos corrompidos;
- conversor de macros ou código embutido;
- substituto do Microsoft Word, Excel, PowerPoint ou LibreOffice.

---

## 4. Princípios do produto

### 4.1 Privacidade por arquitetura

O arquivo deve permanecer no dispositivo do usuário.

O frontend pode carregar código, bibliotecas e módulos WebAssembly, mas o conteúdo do documento não deve ser transmitido para o servidor AppsBox nem para terceiros.

### 4.2 Explicar antes de executar

O usuário deve conseguir entender:

- qual será o formato de saída;
- se a conversão busca preservar aparência ou estrutura;
- o que poderá ser perdido;
- o efeito de cada opção;
- quando uma opção é irrelevante para determinada conversão.

### 4.3 Progresso sempre visível

Operações potencialmente demoradas devem apresentar estado claro.

Exemplos:

- Preparando conversor...
- Carregando componente de documentos...
- Analisando arquivo...
- Convertendo...
- Gerando PDF...
- Finalizando...
- Conversão concluída.

Quando possível, apresentar progresso percentual. Quando a engine não disponibilizar percentual real, usar etapas determinísticas e não uma porcentagem fictícia.

### 4.4 Simplicidade antes de quantidade de opções

A tela principal deve mostrar apenas as opções necessárias.

Parâmetros menos comuns devem ficar em uma área de **Opções avançadas**.

### 4.5 Sem promessas incorretas de fidelidade

Conversão entre formatos estruturalmente diferentes pode alterar:

- quebra de páginas;
- fontes;
- espaçamentos;
- tabelas;
- cabeçalhos;
- imagens;
- elementos posicionados;
- animações;
- gráficos;
- notas;
- campos;
- referências;
- recursos específicos do aplicativo de origem.

Quando houver risco relevante, a interface deve informar isso antes da conversão.

---

## 5. Público e casos de uso

### 5.1 Público

Usuários que precisam realizar conversões pontuais sem instalar uma suíte completa ou enviar documentos confidenciais para serviços externos.

### 5.2 Casos de uso principais

- transformar um DOCX em PDF;
- transformar um ODT em DOCX;
- transformar um documento em texto simples;
- transformar Markdown em DOCX, HTML, EPUB ou PDF;
- transformar HTML em documento;
- transformar EPUB em formatos de texto/documento;
- converter planilhas entre XLSX, ODS e CSV;
- gerar PDF de uma planilha;
- converter apresentações entre PPTX e ODP;
- gerar PDF de uma apresentação;
- extrair texto de um PDF que já possua camada de texto;
- converter vários arquivos independentes em uma única sessão.

---

## 6. Escopo de formatos

A disponibilidade real de cada combinação deve ser validada pela engine escolhida e por testes de compatibilidade antes de ser anunciada como suportada.

A interface nunca deve oferecer uma combinação que a versão implantada não consiga executar.

### 6.1 Documentos de texto — prioridade alta

| Entrada | Saídas previstas | Prioridade |
|---|---|---|
| DOCX | PDF, ODT, HTML, Markdown, TXT | MVP |
| ODT | DOCX, PDF, HTML, Markdown, TXT | MVP |
| RTF | DOCX, ODT, PDF, HTML, TXT | MVP |
| TXT | DOCX, ODT, PDF, HTML, Markdown | MVP |
| Markdown / MD | DOCX, ODT, PDF, HTML, EPUB, TXT | MVP |
| HTML / HTM | DOCX, ODT, PDF, Markdown, TXT | MVP |
| EPUB | DOCX, ODT, HTML, Markdown, TXT | MVP |

### 6.2 Planilhas — prioridade alta, condicionada à engine local

| Entrada | Saídas previstas | Prioridade |
|---|---|---|
| XLSX | ODS, CSV, PDF | MVP condicionado |
| XLS | XLSX, ODS, CSV, PDF | MVP condicionado |
| ODS | XLSX, CSV, PDF | MVP condicionado |
| CSV | XLSX, ODS | MVP condicionado |

**MVP condicionado** significa que a funcionalidade entra no lançamento somente se a engine local escolhida atingir os critérios de compatibilidade, tamanho, desempenho e estabilidade definidos neste PRD.

Caso contrário, deve ser deslocada para a etapa seguinte, sem fallback para upload remoto.

### 6.3 Apresentações — prioridade média, condicionada à engine local

| Entrada | Saídas previstas | Prioridade |
|---|---|---|
| PPTX | ODP, PDF | MVP condicionado |
| PPT | PPTX, ODP, PDF | MVP condicionado |
| ODP | PPTX, PDF | MVP condicionado |

### 6.4 PDF

| Entrada | Saída | Prioridade |
|---|---|---|
| PDF com camada de texto | TXT | MVP |
| PDF com camada de texto | Markdown | MVP |
| PDF com camada de texto | HTML | Pós-MVP ou MVP se qualidade aprovada |
| PDF digitalizado | TXT / Markdown | Pós-MVP com OCR |
| PDF | DOCX editável | Pós-MVP |
| PDF | XLSX | Fora do MVP |
| PDF | PPTX | Fora do MVP |

PDF → DOCX não deve ser apresentado como simples inversão de DOCX → PDF. O PDF normalmente descreve a página final e não necessariamente preserva a estrutura lógica original do documento.

### 6.5 Formatos explicitamente fora do MVP

- DOCM;
- XLSM;
- PPTM;
- macros VBA;
- arquivos protegidos por senha cuja engine não consiga abrir localmente;
- arquivos DRM;
- formatos proprietários antigos não suportados pela engine;
- imagens digitalizadas com OCR no primeiro lançamento;
- PDF → Office com reconstrução avançada;
- conversão de documentos por servidor.

---

## 7. Estratégia de engines

A implementação deve ser modular. Uma única engine não precisa resolver todas as conversões.

### 7.1 Engine de documentos estruturados

Uma engine WebAssembly baseada em Pandoc é a candidata preferencial para conversões semânticas entre formatos como:

- Markdown;
- HTML;
- DOCX;
- ODT;
- EPUB;
- RTF;
- TXT;
- PDF quando houver pipeline local compatível.

Ela deve executar dentro do navegador e preferencialmente dentro de Web Worker.

### 7.2 Engine Office

Conversões que exigem maior fidelidade para:

- DOC/DOCX;
- XLS/XLSX;
- PPT/PPTX;
- ODT/ODS/ODP;
- PDF de documentos Office

podem exigir uma engine Office compilada para WebAssembly.

Essa engine deve passar por um **spike técnico obrigatório** antes de entrar no MVP.

Critérios mínimos:

- execução completamente local;
- nenhuma transmissão do conteúdo do documento;
- licença compatível com distribuição;
- funcionamento nos navegadores suportados;
- consumo de memória aceitável;
- carregamento progressivo;
- cache offline;
- estabilidade suficiente em desktop;
- comportamento conhecido em mobile;
- tamanho de download aceitável para uso sob demanda.

### 7.3 PDF

Usar biblioteca local de parsing/renderização de PDF para:

- detectar páginas;
- extrair texto quando existente;
- obter metadados básicos;
- permitir seleção de páginas;
- suportar visualização ou prévia quando necessário.

### 7.4 OCR

OCR local por WebAssembly poderá ser acrescentado posteriormente.

O OCR não deve ser necessário para extrair texto de PDFs que já possuam camada de texto.

---

## 8. Modos de conversão

Quando fizer sentido para a combinação selecionada, o produto deve distinguir dois conceitos.

### 8.1 Preservar aparência

Objetivo: manter o resultado visual o mais próximo possível do arquivo original.

Exemplos:

- DOCX → PDF;
- XLSX → PDF;
- PPTX → PDF.

Texto auxiliar:

> Prioriza a aparência do documento. Pequenas diferenças podem ocorrer por fontes, recursos não suportados ou diferenças entre formatos.

### 8.2 Preservar estrutura editável

Objetivo: manter títulos, parágrafos, listas, tabelas, links, imagens e demais estruturas que possam ser representadas no formato de destino.

Exemplos:

- DOCX → ODT;
- DOCX → Markdown;
- ODT → DOCX;
- HTML → DOCX.

Texto auxiliar:

> Prioriza conteúdo e estrutura editável. O layout pode mudar quando o formato de destino não possui os mesmos recursos do original.

A opção só deve aparecer quando houver uma escolha real entre comportamentos.

---

## 9. Seleção de arquivos

### 9.1 Entrada

O usuário poderá:

- clicar em **Adicionar documentos**;
- selecionar um ou vários arquivos;
- arrastar arquivos para a área de seleção, quando suportado;
- adicionar novos arquivos à seleção existente.

### 9.2 Informações exibidas por arquivo

Cada item deve mostrar, quando disponível:

- nome;
- extensão/formato;
- tamanho;
- número de páginas, planilhas ou slides após análise;
- estado;
- formato de saída;
- botão para remover;
- link de download após a conversão.

### 9.3 Múltiplos arquivos

A fila deve aceitar vários arquivos.

Por padrão:

- os arquivos são processados sequencialmente;
- cada arquivo gera seu próprio download;
- não há ZIP no MVP;
- uma falha em um arquivo não deve interromper os demais.

Se os arquivos selecionados forem de tipos incompatíveis com uma única saída, a interface deve permitir configuração individual ou limitar as saídas comuns.

---

## 10. Escolha do formato de saída

O formato de saída deve ser escolhido a partir do arquivo ou dos arquivos selecionados.

A interface não deve exibir formatos impossíveis.

Exemplo:

```text
Documento DOCX
Saída
[ PDF ▼ ]

PDF — bom para compartilhar e imprimir. O conteúdo deixa de ser facilmente editável.
```

Ao alterar a saída, a explicação deve mudar imediatamente.

---

## 11. Parâmetros comuns

### 11.1 Formato

Sempre que houver mais de uma saída possível.

A interface deve explicar a consequência principal do formato.

### 11.2 Intervalo de páginas / planilhas / slides

Quando aplicável:

- tudo;
- intervalo;
- seleção específica.

Exemplo:

`1-3, 5, 8-10`

A entrada deve ser validada antes de iniciar.

### 11.3 Nome do arquivo de saída

Por padrão:

`nome-original.extensão-destino`

Não é necessário permitir edição do nome no MVP, desde que colisões de downloads sejam tratadas pelo navegador.

### 11.4 Opções avançadas

Devem ficar recolhidas por padrão.

A existência dessa área não deve impedir a conversão com configurações recomendadas.

---

## 12. Parâmetros por tipo de conversão

### 12.1 Saída PDF

Quando suportado pela engine:

| Parâmetro | Valores | Explicação ao usuário |
|---|---|---|
| Tamanho da página | Automático, A4, Carta | Define o tamanho físico das páginas geradas. |
| Orientação | Automática, Retrato, Paisagem | Altera a orientação da página quando a conversão permitir. |
| Margens | Originais/automáticas, estreitas, normais, largas | Pode alterar a distribuição do conteúdo e as quebras de página. |
| Intervalo | Todas ou páginas selecionadas | Gera somente as páginas escolhidas. |

Para conversões cujo layout já esteja definido pelo documento de origem, parâmetros que causem reflow devem ser omitidos ou acompanhados de aviso.

### 12.2 DOCX / ODT

Quando a engine permitir:

| Parâmetro | Valores | Explicação |
|---|---|---|
| Alterações controladas | Aceitar, rejeitar, preservar | Define como revisões do documento serão tratadas. |
| Comentários | Preservar ou remover | Controla se comentários compatíveis serão mantidos. |
| Imagens | Incorporar quando possível | Mantém as imagens dentro do documento de saída. |

Opções indisponíveis para uma combinação específica não devem ser exibidas.

### 12.3 Markdown

| Parâmetro | Valores | Explicação |
|---|---|---|
| Imagens | Referenciar / extrair quando aplicável | Define como imagens do documento serão representadas. |
| Quebras de linha | Automático / preservar | Pode tornar o Markdown mais fiel ao texto original ou mais limpo para edição. |
| Tabelas | Formato compatível com a engine | Estruturas complexas podem ser simplificadas. |

Opções técnicas como dialetos específicos de Markdown podem ser acrescentadas depois, mas não devem poluir o fluxo principal.

### 12.4 HTML

| Parâmetro | Valores | Explicação |
|---|---|---|
| Documento completo | Sim / não, se aplicável | Inclui estrutura HTML completa em vez de apenas o conteúdo. |
| Recursos | Incorporar quando possível / referenciar | Controla imagens e recursos externos no resultado. |

Scripts presentes no HTML de entrada nunca devem ser executados como parte da conversão.

### 12.5 EPUB

| Parâmetro | Valores | Explicação |
|---|---|---|
| Sumário | Automático quando possível | Cria navegação a partir dos títulos detectados. |
| Metadados | Preservar quando compatível | Mantém título, autor e demais metadados suportados. |

### 12.6 CSV

Na importação ou exportação de CSV:

| Parâmetro | Valores iniciais | Explicação |
|---|---|---|
| Separador | Detectar, vírgula, ponto e vírgula, tabulação | Define como as colunas são separadas. |
| Codificação | UTF-8 por padrão | Determina como caracteres e acentos são interpretados. |
| Cabeçalho | Detectar / primeira linha | Define se a primeira linha contém nomes das colunas. |
| Planilha | seleção quando XLSX/ODS tiver várias abas | CSV representa uma planilha por arquivo. |

Ao converter uma pasta de trabalho com múltiplas planilhas para CSV, o usuário deve escolher uma planilha. O MVP não deve gerar vários CSVs silenciosamente.

### 12.7 Planilha → PDF

Quando suportado:

| Parâmetro | Valores | Explicação |
|---|---|---|
| Planilhas | Todas / selecionadas | Escolhe quais abas serão exportadas. |
| Orientação | Automática, retrato, paisagem | Pode melhorar o aproveitamento da página. |
| Ajuste | Original, caber na largura, caber em uma página | Pode reduzir o conteúdo para evitar cortes. |

### 12.8 Apresentação → PDF

Quando suportado:

- todos os slides ou intervalo;
- um slide por página;
- preservar proporção original.

Notas do apresentador, comentários e animações não devem ser incluídos sem uma opção explícita e suporte validado.

---

## 13. Análise prévia do arquivo

Após a seleção, o produto deve executar uma análise local antes de liberar a conversão.

Objetivos:

- identificar formato real;
- validar extensão;
- verificar se o arquivo pode ser lido;
- descobrir páginas, planilhas ou slides quando possível;
- detectar proteção por senha;
- verificar recursos incompatíveis detectáveis;
- determinar saídas disponíveis;
- identificar necessidade de carregar uma engine adicional.

Estados possíveis:

- Pronto;
- Analisando;
- Engine necessária;
- Arquivo protegido;
- Formato não suportado;
- Arquivo inválido;
- Arquivo muito complexo para este dispositivo;
- Falha na leitura.

---

## 14. Fluxo principal

```text
Usuário acessa
    ↓
Interface principal
    ↓
Adicionar documentos
    ↓
Análise local
    ↓
Exibir arquivos + formatos possíveis
    ↓
Selecionar saída
    ↓
Exibir somente opções relevantes
    ↓
Converter documentos
    ↓
Preparar/carregar engine, se necessário
    ↓
Processar fila localmente
    ↓
Resultado por arquivo
    ↓
Download
```

---

## 15. Estados e feedback

A área de status deve existir em posição equivalente à usada no AppsBox Conversor de Imagens.

### 15.1 Estado inicial

> Pronto para converter.

### 15.2 Carregando engine

> Preparando o conversor de documentos...

Se houver download significativo:

> Carregando componente necessário para esta conversão. Depois do primeiro carregamento, ele poderá ficar disponível offline neste dispositivo.

Mostrar progresso real de download quando disponível.

### 15.3 Analisando

> Analisando `arquivo.docx`...

### 15.4 Convertendo

> Convertendo `arquivo.docx` — etapa 2 de 4

ou percentual real, quando fornecido.

### 15.5 Finalizando

> Finalizando arquivo...

### 15.6 Sucesso

> Conversão concluída.

O item convertido deve receber ação de download evidente.

### 15.7 Falha parcial

> Não foi possível converter `arquivo.docx`. Os demais arquivos continuarão sendo processados.

### 15.8 Falha de memória

> Este documento exige mais memória do que o navegador conseguiu disponibilizar. Feche outras abas ou tente em um computador com mais memória.

Não sugerir upload para o servidor como fallback.

---

## 16. Interface e identidade visual

O produto deve seguir a linguagem visual do AppsBox Conversor de Imagens.

### 16.1 Cabeçalho

Manter:

- marca AppsBox;
- nome do produto;
- controle de tema claro/escuro.

### 16.2 Hero

Estrutura:

```text
CONVERSÃO LOCAL

Conversor de documentos

Privado e direto no seu dispositivo.

● Seus documentos não são enviados
● Offline após carregar os componentes necessários
```

Evitar excesso de texto.

### 16.3 Área principal

Card principal:

**Documentos**

Estado vazio:

> Nenhum arquivo selecionado

Ação:

**+ Adicionar documentos**

Texto auxiliar deve listar somente formatos efetivamente suportados na versão implantada.

### 16.4 Área de configuração

Manter a lógica visual do produto de imagens:

- rótulo claro;
- controle;
- explicação logo abaixo ou ao lado;
- estado atual quando relevante;
- opções dependentes mostradas progressivamente.

### 16.5 Ações

Botão primário:

**Converter documentos**

Botão secundário:

**Limpar seleção**

Enquanto houver conversão:

- impedir início duplicado;
- permitir que a interface continue responsiva;
- avaliar suporte a cancelar a fila;
- nunca bloquear o thread principal por longos períodos.

### 16.6 Contador

Usar a mesma posição e linguagem conceitual do Conversor de Imagens.

Exemplo:

**Conversões realizadas**  
`12.345`

> Contagem total. Nenhum arquivo ou identificador é coletado.

Pode ser usada uma frase adicional de destaque:

> Já ajudamos a converter 12.345 documentos.

A implementação deve escolher uma única apresentação principal para evitar repetição visual.

### 16.7 Instalação PWA

Manter convite semelhante:

> Quer converter documentos mais rápido? Instale o AppsBox Conversor de Documentos neste dispositivo.

Ações:

- Instalar;
- Agora não.

### 16.8 Rodapé

Links:

- Início do AppsBox;
- Privacidade;
- Termos;
- Contato.

---

## 17. Tema

Suportar:

- claro;
- escuro.

A escolha deve ser persistida em `localStorage`, seguindo o Conversor de Imagens.

Quando não houver preferência gravada, usar a preferência do sistema se a implementação atual do ecossistema adotar esse comportamento.

---

## 18. PWA e offline

### 18.1 Instalação

Usar:

- manifesto;
- service worker;
- ícones próprios;
- `beforeinstallprompt` quando disponibilizado pelo navegador.

O comportamento do convite deve permanecer coerente com o Conversor de Imagens.

### 18.2 Cache

O cache da PWA deve incluir:

- shell da interface;
- CSS;
- JavaScript compilado;
- manifesto;
- logo e ícones;
- módulos essenciais.

Engines WebAssembly grandes devem ser carregadas sob demanda e armazenadas em cache após uso bem-sucedido.

### 18.3 Definição correta de offline

Não anunciar genericamente que **todas as conversões** estarão disponíveis offline imediatamente após a primeira visita se engines adicionais ainda não tiverem sido baixadas.

A interface deve distinguir:

- interface disponível offline;
- engine daquela conversão já disponível offline;
- engine ainda precisa ser carregada.

Exemplo:

> Este tipo de conversão ficará disponível offline depois que o componente terminar de carregar neste dispositivo.

---

## 19. Contador global

O contador deve seguir o modelo do AppsBox Conversor de Imagens.

### 19.1 Incremento

Após cada arquivo convertido com sucesso:

```http
POST /api/count
Content-Type: application/json

{}
```

O servidor incrementa e retorna apenas o total global.

### 19.2 Consulta

```http
GET /api/count
```

Retorna o total agregado.

### 19.3 Dados que não devem integrar o contador

Não enviar ou persistir como dado da aplicação:

- arquivo;
- conteúdo;
- nome;
- extensão;
- formato de origem;
- formato de destino;
- quantidade de páginas;
- tamanho;
- hashes;
- endereço IP como dado funcional;
- identificador de dispositivo;
- identificador de usuário;
- tempo de conversão.

### 19.4 Falha do contador

A conversão nunca depende do contador.

Se o serviço estiver indisponível:

- download continua disponível;
- nenhum erro de conversão deve ser exibido;
- contador apenas deixa de atualizar.

---

## 20. Privacidade

### 20.1 Requisito principal

Documentos selecionados pelo usuário não devem ser enviados ao backend.

### 20.2 Rede

Depois que os assets e engines necessários forem carregados, a conversão deve conseguir ocorrer sem chamadas de rede relacionadas ao conteúdo do documento.

### 20.3 Recursos externos

Documentos podem referenciar:

- imagens remotas;
- fontes;
- folhas de estilo;
- links;
- recursos incorporados.

Por padrão, a conversão não deve buscar silenciosamente recursos remotos contidos no documento.

Se algum recurso externo for necessário e houver intenção de suportá-lo futuramente, isso deve exigir comportamento explícito e revisão de privacidade.

### 20.4 Persistência local

O produto não deve manter histórico de documentos.

Objetos temporários, `Blob`, `ArrayBuffer` e arquivos virtuais usados pela engine devem ser liberados após:

- conclusão;
- remoção;
- nova sessão;
- cancelamento;
- falha.

Caches da PWA podem conter apenas código e assets do aplicativo, não documentos do usuário.

---

## 21. Segurança

### 21.1 Conteúdo ativo

Não executar:

- macros;
- JavaScript contido em documentos;
- scripts de HTML de entrada;
- objetos ativos;
- código incorporado.

### 21.2 Isolamento

Executar engines pesadas em Web Workers sempre que possível.

Evitar processamento pesado no thread principal.

### 21.3 CSP

Adotar Content Security Policy compatível com a execução das engines necessárias sem abrir permissões desnecessárias.

### 21.4 Arquivos malformados

Falhas de parser devem:

- ficar isoladas ao arquivo;
- não derrubar a fila completa;
- produzir mensagem compreensível;
- liberar memória após erro.

### 21.5 Atualizações

Bibliotecas de parsing e engines devem ser tratadas como dependências de segurança e atualizadas de maneira controlada.

---

## 22. Desempenho

### 22.1 Interface

A interface deve permanecer responsiva durante:

- análise;
- parsing;
- renderização;
- conversão;
- geração do arquivo.

### 22.2 Carregamento de engines

Não carregar uma engine Office grande no primeiro acesso se o usuário não precisar dela.

Preferir:

```text
Shell leve
   ↓
Usuário escolhe uma conversão
   ↓
Carregamento sob demanda da engine
   ↓
Cache local
   ↓
Conversões seguintes reutilizam o componente
```

### 22.3 Memória

O processamento deve ser sequencial por padrão para evitar consumo excessivo.

Depois de cada arquivo:

- revogar object URLs não mais necessários;
- liberar buffers;
- limpar sistema de arquivos virtual da engine;
- encerrar/reutilizar worker conforme estratégia validada.

### 22.4 Arquivos grandes

Não prometer um tamanho máximo universal enquanto o limite depender da engine, navegador e dispositivo.

A aplicação deve:

- detectar falhas de memória;
- alertar antes da conversão quando houver evidência de risco;
- informar que arquivos grandes podem exigir mais memória;
- evitar rejeição arbitrária baseada apenas em tamanho se a engine puder processar o arquivo.

---

## 23. Compatibilidade

### 23.1 Navegadores prioritários

Testar versões atuais de:

- Chrome/Chromium;
- Edge;
- Firefox;
- Safari.

### 23.2 Desktop

Desktop é a plataforma prioritária para conversões Office pesadas.

### 23.3 Mobile

A interface deve ser responsiva e permitir conversões leves em mobile.

Conversões que demandem muita memória podem ter limitações específicas. A aplicação deve detectar e comunicar falhas sem prometer compatibilidade universal.

---

## 24. Acessibilidade

Requisitos mínimos:

- navegação por teclado;
- foco visível;
- labels associados aos controles;
- contraste adequado em claro e escuro;
- status de conversão exposto por região `aria-live`;
- botões com nomes descritivos;
- não depender somente de cor para representar estados;
- mensagens de erro associadas ao arquivo correspondente.

---

## 25. Arquitetura proposta

```text
Arquivo local
    ↓
File API
    ↓
Análise de tipo / pré-validação
    ↓
Gerenciador de conversão
    ↓
Web Worker
    ↓
┌─────────────────────────────────┐
│ Engine adequada                 │
│                                 │
│ Pandoc/WASM                     │
│ Engine Office/WASM              │
│ PDF parser/renderizador         │
│ OCR/WASM (futuro)               │
└─────────────────────────────────┘
    ↓
Blob / ArrayBuffer local
    ↓
Object URL
    ↓
Download no dispositivo

POST /api/count {}
    ↓
Apache
    ↓
Python stdlib + SQLite
```

---

## 26. Stack proposta

Para manter consistência operacional com o Conversor de Imagens:

### Frontend

- HTML;
- CSS;
- TypeScript estrito;
- compilação com `tsc`;
- Web Workers;
- WebAssembly para engines de conversão;
- sem framework de UI, salvo necessidade técnica justificada.

### PWA

- `manifest.webmanifest`;
- service worker;
- Cache Storage;
- carregamento e cache sob demanda das engines.

### Backend

Exclusivamente contador:

- Python 3;
- biblioteca padrão;
- `ThreadingHTTPServer`;
- SQLite;
- WAL.

### Infraestrutura

- Apache;
- HTTPS;
- `/api/` e `/health` em proxy para serviço local;
- frontend em releases imutáveis;
- symlink `current`.

---

## 27. Estrutura sugerida do repositório

```text
src/
  main.ts
  conversion-manager.ts
  workers/
  engines/
  formats/
  ui/

public/
  index.html
  styles.css
  manifest.webmanifest
  service-worker.js
  assets/

backend/
  counter.py

scripts/
  deploy.sh

deploy/
  apache/
  systemd/

README.md
PRD.md
AGENTS.md
```

A organização final pode ser simplificada, mas deve separar claramente interface, workers e adapters das engines.

---

## 28. Abstração de conversão

Cada engine deve ser encapsulada por um adapter.

Conceito:

```text
ConversionEngine
  supports(input, output)
  prepare()
  inspect(file)
  convert(file, options, progress)
  dispose()
```

A interface não deve depender diretamente de APIs específicas do Pandoc, LibreOffice ou outra engine.

Isso permite:

- trocar engine;
- incluir novo formato;
- fazer fallback entre engines locais;
- testar combinações isoladamente;
- evitar acoplamento da UI ao runtime WebAssembly.

**Fallback entre engines locais é permitido. Fallback para upload remoto não é permitido.**

---

## 29. Matriz de capacidades

A aplicação deve manter uma matriz declarativa com:

- formatos de entrada;
- formatos de saída;
- engine;
- parâmetros disponíveis;
- nível de fidelidade esperado;
- necessidade de engine sob demanda;
- suporte mobile;
- status experimental.

Exemplo conceitual:

```text
DOCX → PDF
engine: office
fidelity: visual
options: page-range
local: true

DOCX → Markdown
engine: pandoc
fidelity: semantic
options: track-changes, images
local: true
```

A UI deve ser gerada a partir dessa matriz sempre que possível para impedir divergência entre documentação, controles e suporte real.

---

## 30. Fidelidade e avisos

### 30.1 Níveis

Cada conversão pode receber internamente um nível:

- **Alta:** formatos próximos e engine validada;
- **Estrutural:** conteúdo e estrutura priorizados;
- **Limitada:** perda relevante esperada;
- **Experimental:** ainda em validação.

O produto não precisa exibir o termo técnico inteiro em todas as situações, mas deve mostrar aviso quando houver risco material.

### 30.2 Exemplo DOCX → Markdown

> O texto, títulos, listas e tabelas serão preservados quando possível. Recursos de paginação e layout do Word não existem da mesma forma em Markdown.

### 30.3 Exemplo PPTX → PDF

> O PDF preserva os slides como páginas estáticas. Animações e transições não fazem parte do resultado.

### 30.4 Exemplo PDF → Markdown

> A ordem do texto é reconstruída a partir da página. Documentos com múltiplas colunas, tabelas ou layout complexo podem exigir ajustes.

---

## 31. Mensagens de erro

Mensagens devem explicar:

1. o que aconteceu;
2. qual arquivo foi afetado;
3. o que o usuário pode fazer.

Exemplos:

### Formato não suportado

> Este formato ainda não é suportado pelo AppsBox Conversor de Documentos.

### Arquivo protegido

> Este arquivo é protegido por senha e não pode ser convertido nesta versão.

### Falha de leitura

> Não foi possível interpretar este documento. Ele pode estar corrompido ou usar recursos ainda não suportados.

### Engine indisponível offline

> O componente necessário para esta conversão ainda não foi baixado. Conecte-se à internet uma vez para prepará-lo neste dispositivo.

### Sem memória

> O navegador ficou sem memória durante esta conversão. Tente fechar outras abas ou usar um computador com mais memória.

---

## 32. Cancelamento

Se a engine permitir interrupção segura, disponibilizar **Cancelar conversão**.

Comportamento:

- interromper arquivo atual;
- cancelar itens ainda não iniciados;
- preservar downloads já concluídos;
- liberar recursos;
- voltar a um estado utilizável.

Se determinada engine não permitir cancelamento interno, o worker poderá ser encerrado, desde que isso não comprometa a próxima conversão.

---

## 33. Downloads

### 33.1 Individual

Cada conversão concluída deve gerar um botão/link individual.

### 33.2 ZIP

Não implementar ZIP no MVP.

Pode entrar posteriormente para:

- múltiplos resultados;
- Markdown + imagens extraídas;
- HTML + recursos;
- múltiplos CSVs.

### 33.3 Vida útil

O arquivo convertido deve permanecer disponível enquanto a página estiver aberta ou até o usuário limpar a seleção.

Ao limpar:

- revogar URLs;
- liberar blobs;
- remover resultados temporários.

---

## 34. Limpar seleção

**Limpar seleção** deve:

- remover arquivos;
- remover resultados;
- revogar downloads;
- liberar memória;
- restaurar opções padrão;
- voltar o status para `Pronto para converter.`

Se houver conversão ativa, a ação deve primeiro cancelar o processamento de maneira segura.

---

## 35. Padrões padrão

Objetivo: permitir conversão sem configuração manual.

Defaults:

- saída mais comum para o tipo selecionado;
- opções recomendadas;
- todas as páginas/abas/slides;
- detecção automática de CSV;
- preservação de conteúdo;
- nenhum recurso remoto;
- nenhuma execução de conteúdo ativo.

Para DOCX, ODT e documentos de escritório, **PDF não deve necessariamente ser escolhido automaticamente** se isso impedir edição. O default deve ser definido pela intenção predominante da combinação e validado em testes de uso.

---

## 36. Telemetria e dados

O produto não terá telemetria por arquivo.

Permitido:

- contador global agregado;
- health check técnico;
- logs operacionais do servidor sem conteúdo de documentos.

Não criar eventos como:

- `docx_to_pdf`;
- tamanho do arquivo;
- extensão;
- tempo individual;
- erro associado a formato específico;
- navegador ligado a uma conversão.

Se métricas de produto mais detalhadas forem desejadas no futuro, elas exigem nova decisão de privacidade e revisão deste PRD.

---

## 37. Backend do contador

Sugestão de serviço:

`appsbox-conv-documentos.service`

Persistência operacional sugerida:

`/mnt/dados/appsbox-conv-documentos/contador.sqlite`

Endpoints:

```text
GET  /health
GET  /api/count
POST /api/count
```

O banco não deve guardar qualquer informação do documento.

---

## 38. Publicação

Manter o padrão operacional do Conversor de Imagens.

Frontend:

```text
/var/www/appsbox-conv-documentos/releases/<timestamp>
```

Symlink:

```text
/var/www/appsbox-conv-documentos/current
```

O `current` é o document root.

Requisitos:

- releases imutáveis;
- troca atômica do symlink;
- rollback apontando `current` para release anterior;
- checkout e `.git` nunca publicados;
- banco fora do diretório publicado;
- health check após publicação.

---

## 39. Cache HTTP

Seguir a mesma lógica do produto de imagens:

Sem cache persistente agressivo:

- `index.html`;
- manifesto;
- service worker.

Assets versionados:

- CSS;
- JavaScript;
- WebAssembly;
- assets de engine.

Engines grandes devem possuir estratégia de versionamento para invalidar corretamente o cache quando atualizadas.

---

## 40. Service worker e engines

O service worker deve conseguir distinguir:

1. shell do aplicativo;
2. assets pequenos essenciais;
3. engines carregadas sob demanda;
4. versões antigas das engines.

Ao atualizar:

- não manter indefinidamente runtimes obsoletos;
- evitar apagar uma engine em uso;
- limpar caches antigos de forma segura;
- permitir recuperação caso uma atualização falhe.

---

## 41. Requisitos de UX para carregamentos grandes

Se a engine necessária tiver tamanho perceptível:

Antes:

> Esta conversão precisa preparar um componente adicional no seu navegador.

Durante:

> Carregando componente de conversão — 38%

Depois:

> Componente pronto. As próximas conversões deste tipo poderão funcionar offline neste dispositivo.

Não usar spinner infinito como único feedback para downloads longos.

---

## 42. Critérios de aceite — núcleo

O MVP só pode ser considerado pronto quando:

- [ ] nenhum arquivo de usuário é enviado ao backend;
- [ ] todas as conversões anunciadas funcionam inteiramente no cliente;
- [ ] a rede pode ser inspecionada e não contém payload do documento;
- [ ] a UI permanece responsiva durante conversão;
- [ ] existe status visível em todas as fases demoradas;
- [ ] formatos oferecidos correspondem à matriz real de suporte;
- [ ] cada opção possui explicação de impacto;
- [ ] falha de um arquivo não interrompe os demais;
- [ ] downloads são gerados localmente;
- [ ] contador recebe apenas `{}`;
- [ ] falha do contador não afeta a conversão;
- [ ] tema claro/escuro funciona;
- [ ] PWA pode ser instalada onde o navegador permitir;
- [ ] shell funciona offline após primeiro carregamento;
- [ ] engines já preparadas funcionam offline;
- [ ] interface diferencia engine ainda não disponível offline;
- [ ] não há execução de macros ou scripts de documentos;
- [ ] memória é liberada ao remover/limpar arquivos;
- [ ] rodapé AppsBox está presente;
- [ ] mensagens não prometem fidelidade absoluta.

---

## 43. Critérios de aceite — formatos

Para cada combinação publicada deve existir uma suíte mínima de arquivos de teste:

- documento simples;
- documento com acentos;
- documento com imagens;
- documento com tabelas;
- documento longo;
- arquivo malformado;
- arquivo vazio ou quase vazio;
- recurso não suportado relevante ao formato.

Quando aplicável:

- cabeçalho/rodapé;
- notas de rodapé;
- listas;
- hyperlinks;
- múltiplas planilhas;
- fórmulas;
- gráficos;
- slides com imagens;
- fontes não instaladas;
- PDF com múltiplas colunas.

Uma combinação só deve ser marcada como suportada quando os casos essenciais tiverem resultado considerado aceitável.

---

## 44. Testes de privacidade

Antes da publicação:

1. abrir DevTools;
2. selecionar documento com nome identificável;
3. converter;
4. inspecionar todas as requisições;
5. confirmar ausência de:
   - conteúdo;
   - nome;
   - extensão;
   - tamanho;
   - hash;
   - metadados;
6. confirmar que `POST /api/count` contém somente `{}`.

Repetir para cada engine.

---

## 45. Testes offline

Cenários obrigatórios:

### Cenário A — shell

1. acessar online;
2. recarregar;
3. ficar offline;
4. reabrir;
5. interface deve carregar.

### Cenário B — engine já usada

1. acessar online;
2. executar uma conversão que carregue engine sob demanda;
3. fechar;
4. ficar offline;
5. reabrir;
6. executar a mesma classe de conversão.

### Cenário C — engine nunca carregada

1. possuir somente shell em cache;
2. ficar offline;
3. escolher conversão que exija engine não instalada;
4. mostrar explicação correta;
5. não aparentar travamento.

---

## 46. Testes de desempenho

Medir em equipamentos representativos:

- desktop intermediário;
- notebook de entrada;
- smartphone intermediário.

Registrar para desenvolvimento, sem enviar como telemetria de produção:

- tempo de preparação da engine;
- pico aproximado de memória;
- tempo de conversão;
- comportamento do thread principal;
- tamanho dos bundles;
- tamanho das engines;
- reutilização de cache.

Esses dados servem para decisão técnica, não para rastreamento dos usuários.

---

## 47. Spike técnico obrigatório antes de congelar o MVP

Antes de confirmar a matriz final de lançamento, construir prova de conceito para:

1. DOCX → PDF;
2. DOCX → Markdown;
3. ODT → DOCX;
4. Markdown → DOCX;
5. XLSX → PDF;
6. XLSX → CSV;
7. PPTX → PDF;
8. PDF com texto → TXT.

Para cada prova:

- confirmar execução local;
- medir download da engine;
- medir memória;
- validar desktop;
- validar mobile;
- testar offline após cache;
- avaliar fidelidade;
- revisar licença;
- verificar capacidade de cancelamento;
- verificar isolamento em worker.

O resultado do spike pode remover formatos do MVP. Ele não pode justificar envio do documento para servidor sem revisão explícita do produto.

---

## 48. MVP final — regra de corte

O MVP deve ser dividido em duas camadas de compromisso.

### 48.1 Núcleo obrigatório

Deve lançar:

- interface AppsBox;
- seleção múltipla;
- fila sequencial;
- DOCX, ODT, RTF, TXT, Markdown, HTML e EPUB nas combinações validadas;
- PDF com camada de texto → TXT/Markdown;
- saída PDF nas combinações que passarem nos testes;
- PWA;
- cache offline;
- tema;
- contador global;
- explicações;
- progresso;
- downloads individuais;
- privacidade local.

### 48.2 Office ampliado

Entram no mesmo lançamento **somente se o spike for aprovado**:

- XLS/XLSX;
- ODS;
- CSV;
- PPT/PPTX;
- ODP;
- conversão Office de alta fidelidade.

Se não passarem, a interface não deve mostrá-los como “em breve” dentro do fluxo de conversão. Eles ficam documentados no roadmap.

---

## 49. Roadmap pós-MVP

Prioridade sugerida:

### Etapa 1

- estabilização;
- melhoria da fidelidade;
- mais combinações entre formatos já suportados;
- cancelar conversão;
- melhores prévias e informações de arquivo.

### Etapa 2

- Office ampliado caso não tenha entrado;
- ZIP para saídas múltiplas;
- processamento em lote com configuração por grupo;
- mais opções de CSV.

### Etapa 3

- OCR local;
- PDF digitalizado → TXT/Markdown;
- escolha de idioma do OCR;
- progresso por página.

### Etapa 4

- PDF → DOCX experimental;
- extração estruturada de tabelas;
- divisão/combinação de documentos quando coerente com o produto.

PDF → Office avançado deve ser avaliado como funcionalidade própria, não apenas mais uma extensão na matriz.

---

## 50. Conteúdo e microcopy

### 50.1 Promessa principal

**Privado e direto no seu dispositivo.**

### 50.2 Privacidade

> Seus documentos não são enviados para nossos servidores. A conversão acontece no seu navegador.

### 50.3 Offline

Quando engine disponível:

> Disponível offline neste dispositivo.

Quando ainda não:

> Esta conversão precisa carregar um componente uma vez antes de funcionar offline.

### 50.4 Contador

> Contagem total. Nenhum arquivo ou identificador é coletado.

### 50.5 Fidelidade

> Alguns recursos podem mudar ao converter entre formatos diferentes. Mostraremos os principais riscos antes da conversão.

---

## 51. SEO e metadados públicos

Título sugerido:

`Conversor de Documentos · AppsBox`

Descrição:

`Converta documentos diretamente no navegador. Seus arquivos permanecem no seu dispositivo.`

A página deve evitar alegar suporte a formatos que não estejam habilitados na matriz implantada.

---

## 52. Saúde operacional

`GET /health` deve confirmar disponibilidade do serviço do contador.

A saúde do contador não representa a saúde das engines de conversão, pois estas executam no cliente.

O frontend deve continuar funcional mesmo se `/health` ou `/api/count` estiverem indisponíveis.

---

## 53. Backup

Somente o SQLite do contador exige backup operacional.

Não existe backup de documentos porque documentos não são armazenados.

A cópia do SQLite deve ser consistente.

---

## 54. Rollback

Frontend:

- repontar `current` para release anterior.

Backend:

- manter mudanças compatíveis com banco sempre que possível;
- evitar migração destrutiva.

Engines:

- versões devem acompanhar a release do frontend ou possuir manifesto versionado;
- rollback deve restaurar também a matriz de capacidades correspondente.

---

## 55. Documentação do repositório

### `PRD.md`

Fonte de verdade do comportamento do produto.

### `README.md`

Deve documentar:

- arquitetura;
- desenvolvimento;
- instalação de dependências;
- build;
- testes;
- estrutura;
- engines;
- publicação;
- serviço do contador.

### `AGENTS.md`

Deve documentar:

- UTF-8 sem BOM;
- validações obrigatórias;
- organização;
- regras que não podem ser anunciadas incorretamente;
- comandos usuais;
- proibição de versionar bundles, banco, logs e artefatos operacionais;
- regra explícita de que documentos nunca podem ser enviados ao backend.

---

## 56. Regras que não podem ser anunciadas incorretamente

A documentação, interface e marketing nunca devem afirmar algo diferente da implantação real.

Especialmente:

1. somente formatos efetivamente testados podem ser anunciados;
2. não dizer “100% offline” para uma engine que ainda precisa ser baixada;
3. não dizer que o layout será idêntico se a engine não garantir isso;
4. não dizer que PDF → DOCX recupera o documento original;
5. não dizer que arquivos são “criptografados no servidor”, porque eles não devem chegar ao servidor;
6. não sugerir armazenamento temporário remoto;
7. não anunciar OCR antes de existir;
8. não anunciar suporte a macros;
9. não anunciar conversões Office condicionadas antes da validação técnica;
10. o único backend funcional do produto deve ser o contador agregado enquanto este PRD estiver vigente.

---

## 57. Decisões consolidadas

| Tema | Decisão |
|---|---|
| Processamento | Local no navegador |
| Upload de documentos | Não |
| Conta/login | Não |
| Histórico | Não |
| Backend de conversão | Não |
| Backend existente | Somente contador global |
| PWA | Sim |
| Offline | Sim, após cache do shell e da engine necessária |
| Processamento | Web Worker sempre que viável |
| WASM | Sim, por engines modulares |
| Múltiplos arquivos | Sim |
| Paralelismo | Não por padrão |
| ZIP | Não no MVP |
| Tema claro/escuro | Sim |
| Contador | Global agregado |
| Telemetria individual | Não |
| PDF → DOCX | Pós-MVP |
| OCR | Pós-MVP |
| Office ampliado | Condicionado ao spike técnico |
| Fidelidade | Informada por combinação, nunca presumida |

---

## 58. Resultado esperado

O AppsBox Conversor de Documentos deve parecer parte do mesmo ecossistema do AppsBox Conversor de Imagens, mas tratar corretamente a maior complexidade dos documentos.

A experiência ideal é:

1. o usuário abre a página;
2. entende que a conversão é local;
3. adiciona os documentos;
4. vê imediatamente o que pode fazer com eles;
5. escolhe uma saída;
6. entende as consequências das opções;
7. acompanha cada etapa;
8. recebe o resultado;
9. baixa o arquivo;
10. nenhum conteúdo do documento sai do dispositivo.

O produto deve preferir **menos conversões confiáveis, claras e privadas** a uma lista extensa de formatos com comportamento inconsistente ou dependência oculta de processamento remoto.
