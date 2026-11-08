---
name: Linha do Tempo Aberta
description: Mesa clara de trabalho para organizar datas civis, períodos e categorias.
colors:
  blue: "#173da8"
  blue-hover: "#0c2c82"
  canvas: "#f0f4f9"
  surface: "#fff"
  text: "#172033"
  muted: "#475569"
  text-secondary: "#334155"
  border: "#8391a8"
  line: "#d3dce9"
  grid: "#e2e8f0"
  focus: "#9b3307"
  danger: "#9f1239"
  control-hover: "#edf2fc"
  field-disabled: "#f4f6fa"
  row-hover: "#f7faff"
  row-selected: "#eaf0ff"
  diagram-selected: "#eff6ff"
  notice-bg: "#e5edff"
  notice-text: "#19346b"
  notice-border: "#9dafd0"
  category-blue: "#2563eb"
  category-green: "#0f766e"
  category-ochre: "#b45309"
  category-violet: "#7e22ce"
  category-rose: "#be123c"
typography:
  display:
    fontFamily: '"Atkinson Hyperlegible Next", system-ui, sans-serif'
    fontSize: "clamp(1.65rem, 2.7vw, 2rem)"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  headline:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.12rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1.5
  button:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  diagram-title:
    fontFamily: "sans-serif"
    fontSize: "16px"
  diagram-axis:
    fontFamily: "sans-serif"
    fontSize: "15px"
  diagram-meta:
    fontFamily: "sans-serif"
    fontSize: "13px"
rounded:
  field: "6px"
  control: "7px"
  panel: "10px"
  dialog: "14px"
spacing:
  compact: "7px"
  small: "8px"
  field-gap: "10px"
  related: "12px"
  group: "16px"
  panel: "23px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "9px 10px"
  field-disabled:
    backgroundColor: "{colors.field-disabled}"
    textColor: "{colors.text-secondary}"
  event-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "13px 15px"
  event-row-selected:
    backgroundColor: "{colors.row-selected}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "23px"
---

# Design System: Linha do Tempo Aberta

## Overview

**Creative North Star: "Mesa clara de trabalho comunitário"**

A interface funciona como uma mesa para conferir uma história: o desenho apresenta posição e duração, a lista permite localizar cada acontecimento e o editor reúne seus detalhes. A identidade vem das linhas precisas, das superfícies claras e das cores funcionais das categorias. O espaço de trabalho tem precedência sobre a apresentação institucional.

Este registro descreve a implementação atual em [index.html](index.html), [src/styles.css](src/styles.css) e [src/app.js](src/app.js), incluindo o contrato de direção presente na entrada. A linguagem da direção foi assumida para esta edição; não representa preferência visual global confirmada do usuário. O público descrito em [PRODUCT.md](PRODUCT.md) permanece hipótese de produto.

**Key Characteristics:**

- Superfícies claras, bordas explícitas e densidade de ferramenta de trabalho.
- Título do documento com voz própria; controles e dados com fontes de interface.
- Cores de categoria acompanhadas de nomes e de formas que distinguem dia e período.
- Seleção compartilhada entre lista textual, desenho e painel de detalhes.
- Arquivos e filtros recolhidos sob rótulos explícitos; tarefa principal visível.

## Colors

A paleta combina azuis de ação com neutros frios e seis cores discretas de classificação. Os valores normativos estão no frontmatter; os nomes abaixo descrevem seus usos.

As rampas tonais do artefato local `.impeccable/design.json` são prévias sintetizadas para o painel de documentação; não são uma escala usada pela aplicação nem novos tokens de interface.

### Primary

- **Azul de ação** (`blue`): adicionar e salvar evento, links, marca, seleção de texto, cursor dos campos e borda da linha selecionada. O estado de passagem do botão principal usa `blue-hover`.
- **Azul de interação** (`control-hover`, `row-hover`, `row-selected`, `diagram-selected`): fundos de passagem e seleção. A lista usa fundo e borda; o desenho usa uma faixa clara sobre toda a linha selecionada.

### Secondary

- **Cores de categoria** (`category-blue`, `category-green`, `category-ochre`, `category-violet`, `category-rose` e `muted` para cinza): a mesma cor acompanha a categoria na legenda, na lista e no ponto ou barra do diagrama. São opções de classificação, sem significado histórico ou prioridade embutidos.

### Neutral

- **Mesa clara** (`canvas`) e **papel branco** (`surface`): fundo do aplicativo e superfícies de edição, lista, desenho e diálogo.
- **Tinta principal** (`text`), **tinta de apoio** (`muted`) e **tinta secundária** (`text-secondary`): títulos e conteúdo; explicações, datas e estado; nomes de categoria e eixos.
- **Contorno de controle** (`border`), **divisória** (`line`) e **grade** (`grid`): separar campos e painéis; separar grupos; sustentar a leitura temporal sem competir com os acontecimentos.
- **Campo indisponível** (`field-disabled`): dados em consulta aparecem com fundo tonal e texto legível, sem reduzir a opacidade do campo.
- **Foco cobre** (`focus`): contorno visível de teclado, independente da cor da categoria.
- **Alerta rosa escuro** (`danger`): exclusão e mensagens de erro. Erros também recebem texto explicativo.
- **Aviso azul claro** (`notice-bg`, `notice-text`, `notice-border`): faixa textual de resultado e orientação; não funciona como selo de sucesso permanente.

**The Categoria Completa Rule.** Toda cor de categoria deve vir acompanhada de seu nome na legenda e na lista. A cor sozinha não identifica o acontecimento.

## Typography

**Display Font:** Atkinson Hyperlegible Next, com `system-ui, sans-serif` como alternativa.

**Body Font:** a pilha de interface do sistema registrada em `body`.

**Diagram Font:** `sans-serif`, declarada dentro do SVG; os números de tamanho são unidades do desenho e acompanham sua escala visual.

**Character:** a Atkinson diferencia o nome da história sem transformar a ferramenta em uma peça editorial. Corpo, navegação, campos e datas mantêm uma leitura familiar e compacta. A fonte variável normal é auto-hospedada, com pesos disponíveis de 200 a 800; as atribuições e a licença estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e [OFL](assets/fonts/OFL-Atkinson-Hyperlegible-Next.txt).

### Hierarchy

- **Display**: nome do documento. Usa o token `display`; em telas de até 540px, o tamanho se estabiliza em (1.75rem). É o único uso atual da Atkinson.
- **Headline**: nome do aplicativo no cabeçalho. Reduz para (1rem) em telas de até 540px.
- **Title**: títulos de área e editor. No móvel estreito, o título da seção do desenho passa a (1rem).
- **Body**: base de leitura. A descrição do documento e os campos usam (0.9375rem); parágrafos comuns têm limite de (72ch), e a ajuda aberta usa (78ch).
- **Label**: rótulos explícitos acima dos campos. Legenda, orientações do desenho e notas de formulário usam (0.75rem); estado e datas textuais usam números tabulares quando definidos na interface.
- **Button**: ações em caixa normal, sem transformar rótulos em chamadas promocionais.
- **Diagram title / axis / meta**: respectivamente título de evento, datas do eixo e data/duração da linha. Títulos visíveis no desenho podem ser abreviados após 34 caracteres; o SVG mantém uma descrição completa em `title`, e a lista textual mantém o conteúdo completo.

**The Título Com Voz Própria Rule.** Reservar Atkinson ao título do documento; preservar fontes de interface para campos, controles e dados do desenho.

## Layout

O contêiner principal é centralizado, com largura máxima de (1680px), respiro horizontal fluido de `clamp(20px, 4vw, 64px)` e início a (24px) do cabeçalho. O cabeçalho branco é compacto, com altura mínima de (64px). O nome e o estado do documento ficam à esquerda; salvar e recarregar ficam à direita. A barra seguinte põe Adicionar evento antes do histórico e do menu de arquivos.

A área de trabalho usa uma coluna flexível para desenho e lista e uma coluna de editor de (328px), separadas por (28px). Acima de 1500px o editor tem (360px); até 1180px, (300px), com intervalo de (20px) e preenchimento de (18px). O editor fica aderente ao topo com distância de (20px) enquanto há duas colunas.

Até 860px, desenho, lista e editor formam uma única coluna, nessa ordem, e o editor deixa de ser aderente. Até 540px, as ações de documento dividem uma linha com quebra, os comandos de arquivo passam para uma linha própria e cada acontecimento vira uma pilha de título, datas e categoria. Os filtros transitam de quatro colunas para duas, depois três com busca integral, e finalmente duas com categoria integral. O cabeçalho aceita quebra; o link de documentação ocupa sua própria linha no móvel estreito.

O ritmo usa intervalos curtos entre controles relacionados e separações maiores entre áreas. Os tokens de espaçamento registram valores recorrentes, não uma escala universal que obrigue todo alinhamento a seus múltiplos. O quadro temporal mantém largura interna mínima de (1000px); ampliações de 150%, 200% e 300% usam mínimos de (1500px), (2000px) e (3000px). A rolagem fica contida no quadro, com altura máxima de (640px), reduzida para (500px) até 860px e (440px) até 540px.

**The Desenho Contido Rule.** Preservar o eixo e oferecer rolagem horizontal dentro do quadro; não comprimir datas e acontecimentos até perder legibilidade. Manter a pista de rolagem imediatamente acima do quadro, inclusive no móvel.

## Elevation & Depth

A mesa é plana: editor, lista e desenho usam fundo, borda e posição para estabelecer hierarquia. Não há sombra nesses painéis. O diálogo de confirmação é a exceção: sobreposição escura e sombra difusa o separam do documento.

### Shadow Vocabulary

- **Diálogo** (`0 14px 44px #17203340`): somente a confirmação modal, sobre camada `#17203399`.

Movimento também é restrito a estado: passagem de linha em (140ms ease-out) e entrada do diálogo em (160ms ease-out), com deslocamento inicial de (8px) e opacidade inicial de (0.85). Essas duas animações só existem quando `prefers-reduced-motion: no-preference` corresponde ao dispositivo.

**The Profundidade de Confirmação Rule.** Reservar a sombra para o diálogo; usar contorno e preenchimento tonal para hierarquizar as superfícies de trabalho.

## Shapes

Campos têm cantos suavemente arredondados (`field`), botões e linhas usam `control`, quadros e editor usam `panel`, e o diálogo usa `dialog`. As bordas dos controles e painéis têm (1px). As marcas de categoria são quadrados de (9px) com cantos de (2px), sempre junto a texto.

No diagrama, um círculo de raio (8 unidades) representa um dia; uma barra de altura (14 unidades) e cantos de (3 unidades) representa período inclusivo. A faixa de seleção tem cantos de (8 unidades). Essas formas têm significado de dado e não são ornamentos intercambiáveis.

## Components

### Buttons

Controles textuais compactos, com ação explícita em português.

- **Shape:** canto `control`, borda de (1px), preenchimento (9px 13px), altura mínima de (40px) na regra geral.
- **Primary:** azul de ação com texto branco; usado em Adicionar evento, Salvar evento e confirmação.
- **Secondary:** branco, texto principal e contorno. Na passagem, recebe `control-hover` e borda azul.
- **Danger:** mantém a forma secundária e muda o texto para `danger`; o texto da ação informa a exclusão.
- **Focus:** contorno cobre de (3px), afastado (4px). **Disabled:** opacidade (0.55) e cursor de indisponibilidade. Não há tratamento visual próprio de pressão definido.
- **Compactos:** ações de categoria têm altura mínima de (32px); comandos de arquivo no móvel têm (38px). Não elevar a regra geral a uma alegação de tamanho universal de alvo.

### Inputs / Fields

Campos de fundo branco, contorno explícito e rótulo associado, com canto `field`, preenchimento (9px 10px) e texto de (0.9375rem). A largura disponível é integral. O par de datas usa duas colunas; áreas de notas permitem redimensionamento vertical.

O foco usa o mesmo contorno cobre dos botões. No modo de consulta do evento, os campos ficam desabilitados e recebem fundo tonal, texto secundário e opacidade integral. Erros aparecem como texto `danger`, com `role="alert"`; o código atual não estabelece uma borda de erro específica. Não criar uma variante visual normativa que a implementação ainda não possui.

### Navigation

O cabeçalho identifica aplicativo, autoria e documentação sem competir com a história. O menu Arquivos é um `details` com `summary` descritivo e navegação rotulada; Buscar e filtrar e Nome, descrição e categorias seguem o mesmo padrão de abertura sob demanda. O indicador de abertura é nativo do navegador. Não há abas nem estado de página ativa nesta superfície.

### Category markers

Legenda e nomes de categoria combinam pequeno quadrado colorido e nome em texto. A legenda quebra linha com espaço entre itens; os nomes continuam disponíveis na lista mesmo quando o desenho exige rolagem. Este padrão é identificação, não um chip clicável ou filtro selecionável.

### Cards / Containers

O editor usa superfície branca, borda `border`, canto `panel` e preenchimento `panel`. A lista usa linhas brancas de borda `line`, sem sombra. Avisos usam faixa tonal com contorno e texto próprio; o painel de ajuda usa uma divisória simples. Não converter todos os agrupamentos em cartões.

### Event rows

Cada acontecimento é um botão de largura integral. Em telas largas, título, datas e categoria ocupam três colunas. A passagem usa `row-hover`; a seleção usa `row-selected` com borda azul e `aria-pressed`. Selecionar a linha realça a faixa equivalente no diagrama e apresenta os detalhes no editor. O foco é levado ao título do editor; a própria linha mantém título e datas completos.

### Timeline

O SVG é uma representação visual de consulta, com título e descrição acessível; a seleção e a edição partem da lista. Grades claras e rótulos de data sustentam os pontos e períodos. Acima dele, a pista informa: “Deslize para os lados para ver todas as datas. No teclado, foque o desenho e use as setas.” O contêiner pode receber foco e está associado a essa pista por `aria-describedby`.

A legenda explica círculo e barra; a nota abaixo declara datas gregorianas sem horários ou fusos. Não substituir a lista por interação exclusiva no SVG. A ampliação muda a largura de apresentação; preservar datas e duração é parte do contrato do desenho.

### Confirmation dialog

O diálogo tem largura máxima de (540px), altura máxima de (85vh), rolagem interna e preenchimento de (28px), reduzido para (23px) no móvel estreito. Título e mensagem são associados ao diálogo. A abertura leva o foco ao diálogo, Escape cancela, Tab fica entre os dois botões e o fechamento restaura o foco anterior. As ações têm nomes concretos de confirmação e cancelamento.

### Accessibility and observed limits

O código fornece link para saltar ao editor, rótulos de campos, regiões de estado com anúncio educado, erros com alerta, lista equivalente, foco visível e redução de movimento. Esses mecanismos orientam extensões, mas não constituem certificação de acessibilidade, contraste ou compatibilidade de leitores de tela.

As recapturas de [desktop](docs/editor-desktop.jpg) e [móvel](docs/editor-mobile.jpg) mostram a demonstração fictícia e um período selecionado. O fechamento visual desta edição foi restrito a quatro achados: correspondência da raiz entregue com o app, precedência da tarefa e do eixo, distinção tipográfica do título e pista de rolagem. Não estabelece aprovação universal de estados, larguras ou dispositivos. Este documento registra o código e essas evidências; não adiciona uma nova rodada de testes.

## Do's and Don'ts

### Do:

- **Do** manter título de documento em Atkinson e corpo, controles e dados nas fontes de interface registradas.
- **Do** acompanhar a cor de categoria com nome e preservar círculo para dia e barra para período inclusivo.
- **Do** manter lista, seleção do desenho e detalhes do editor referindo-se ao mesmo acontecimento.
- **Do** usar rótulos explícitos em português, foco visível e mensagens textuais para estados e erros.
- **Do** preservar a pista acima do desenho e conter a rolagem no próprio quadro.
- **Do** manter os avisos e a licença da fonte ao redistribuir seus arquivos.

### Don't:

- **Don't** usar apenas cor para identificar categoria ou seleção.
- **Don't** comprimir o quadro temporal para esconder a necessidade de rolagem.
- **Don't** espalhar a fonte de título pelos campos e pelos dados do diagrama.
- **Don't** aplicar sombra aos painéis comuns ou transformar toda seção em cartão.
- **Don't** apresentar estas recapturas ou o fechamento dos quatro achados como certificação universal de acessibilidade.
- **Don't** transformar a hipótese de público e as escolhas autônomas desta edição em preferências confirmadas do usuário.
