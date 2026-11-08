# API da engine

Licença MIT. Módulo ESM puro em `src/engine.js`, sem dependências de execução. Funciona em Node 22/24 e navegadores modernos. Todas as funções são síncronas e não alteram entradas. Não usam rede, armazenamento, relógio, fuso ou locale.

```js
import { parseDocument, layoutTimeline, exportCSV } from './src/engine.js';
const documento = parseDocument(textoJSON);
const layout = layoutTimeline(documento, { query: 'educação' });
const csv = exportCSV(documento);
```

| Export | Resultado |
| --- | --- |
| `TimelineError` | Erro com `name`, `code` e mensagem fixa sem conteúdo fornecido pelo usuário. |
| `dateToOrdinal(date)` | Inteiro civil entre 1 e 3652059. Aceita somente `YYYY-MM-DD` ASCII, anos 0001–9999. |
| `ordinalToDate(integer)` | Data civil exata correspondente. |
| `validateDocument(value)` | Nova cópia completa, validada e ordenada canonicamente. |
| `parseDocument(text)` | JSON estrito validado; rejeita BOM, duplicatas inclusive após escapes e números não finitos. |
| `serializeDocument(value)` | JSON canônico, indentação de dois espaços e LF final. |
| `filterEvents(value, options = {})` | Cópias dos eventos filtrados, em ordem canônica. |
| `layoutTimeline(value, options = {})` | Geometria vetorial descrita abaixo. |
| `renderSVG(value, options = {})` | String XML SVG independente e passiva. |
| `exportCSV(value, options = {})` | String CSV com CRLF, cabeçalho fixo e proteção contra fórmulas. |

O construtor `new TimelineError(code)` aceita os códigos documentados; código desconhecido resulta em `INPUT_INVALID`. Não recebe mensagens arbitrárias.

O documento possui exatamente `{version:1,title,description,categories,events}`. Categorias possuem `{id,label,color}`; eventos possuem `{id,title,start,end,categoryId,notes}`. Todos os campos são obrigatórios. `categoryId` é `null` ou um ID existente. IDs seguem `[a-z][a-z0-9_-]{0,39}` e são únicos em cada coleção. Cores aceitas: `#2563eb`, `#0f766e`, `#b45309`, `#7e22ce`, `#be123c`, `#475569`.

Objetos devem ter prototype normal ou nulo, somente propriedades próprias enumeráveis de dados, sem símbolos. Arrays devem ser normais e densos, sem propriedades adicionais. Accessors, subclasses de Array e propriedades ocultas são rejeitados. A API não constitui sandbox para código JavaScript arbitrário ou Proxy.

O título do documento tem até 120 pontos de código; descrição e notas, 2000; label de categoria, 40; título de evento, 100. Títulos e labels devem ter conteúdo após `trim`, mas o texto original é preservado. Strings precisam ser Unicode bem formado. C0, DEL, C1 e U+FFFE/U+FFFF são proibidos; descrição/notas permitem TAB e LF. Títulos, labels e query também proíbem U+2028/U+2029. Não há normalização do conteúdo armazenado.

São permitidas até 12 categorias e 200 eventos. O guard de recursos precede o schema: profundidade máxima 8, raiz em 1, até 4000 nós, contando containers e valores, sem contar chaves. JSON recebido e backup canônico têm teto de 1 MiB UTF-8. A validação rejeita documentos cujo backup ultrapasse esse teto, garantindo reimportação dos modelos aceitos.

As categorias são ordenadas por ID ASCII; eventos por `(start,end,id)`. O período é inclusivo e exige `end >= start`. Eventos podem se sobrepor. Um evento pontual tem datas iguais e duração de um dia.

Opções aceitam somente `query`, `categoryIds`, `from`, `to`, `selectedId`. Campos presentes com `undefined` são inválidos. O próprio argumento omitido ou `undefined` usa `{}`. Query é uma string de até 120 pontos de código, sem controles; procura substring no título, notas e label da categoria, separados por LF, usando NFD, remoção de marcas e minúsculas. O título do documento não participa da busca. `categoryIds` é um array normal de IDs existentes, únicos, com até 12 itens; omitido ou vazio significa todas. `from`/`to` são datas ou `null`, com interseção inclusiva e limites abertos; `from > to` é inválido. `selectedId` é um ID de evento existente ou `null` e apenas controla o realce.

O layout retorna exatamente `{width,height,range,rows,ticks}`. `width` vale 1200; `height` vale `260 + 68 * rows.length`. Sem eventos, `range` é `null` e ticks/rows são vazios. Caso contrário, `range` contém `{start,end,startOrdinal,endOrdinal}` dos eventos filtrados. Cada row contém `{event,days,x1,x2,y,color}`; cada tick, `{date,ordinal,x}`. O eixo ocupa x=300–1150, com interpolação linear exata sem arredondamento. Um único dia fica em x=725. As linhas têm `y=160+índice*68`. São escolhidos até cinco ticks únicos em `min+floor(span*i/4)`, i=0–4.

O SVG conserva título completo do documento e de todos os eventos filtrados em `title`/`desc`. A representação visual abrevia o título do documento para até 36 pontos de código, o de cada evento para 16 e o label para 22, incluindo reticências. As datas e durações permanecem visíveis; o JSON conserva todos os dados. Nenhum texto importado vira markup, atributo executável, CSS, recurso externo ou ID XML. Os únicos IDs são constantes internas. Seleção não altera a geometria ou o recorte. Saída limitada a 2 MiB UTF-8.

O CSV usa o cabeçalho exato `id,titulo,inicio,fim,dias,categoria,notas`, ordem filtrada e RFC4180 para aspas, vírgulas e quebras de linha. Categoria ausente produz célula vazia. Células textuais começando com `=`, `+`, `-`, `@`, TAB ou CR recebem apóstrofo inicial para reduzir interpretação como fórmula por planilhas. Esse compromisso altera essas células exportadas: use JSON para preservação exata. Saída limitada a 2 MiB UTF-8, incluindo CRLF final.

| Código | Situação |
| --- | --- |
| `INPUT_INVALID` | Raiz, tipos, versão, chaves, estrutura ou Unicode malformado. |
| `VALUE_INVALID` | Campo vazio, ID, cor, controle ou caractere XML proibido. |
| `DATE_INVALID` | Data/ordinal inválido ou período invertido. Datas de evento não string dão `INPUT_INVALID`. |
| `REFERENCE_INVALID` | ID duplicado ou categoria inexistente. |
| `LIMIT_EXCEEDED` | Comprimento, contagem, profundidade, nós ou bytes excedidos. |
| `OPTION_INVALID` | Qualquer opção inválida, inclusive estrutura, limite ou data. |
| `JSON_INVALID` | Sintaxe JSON, BOM, chave repetida ou número não finito. |

Fora o guard anterior ao schema, entradas que infringem vários critérios não têm precedência garantida. As mensagens não ecoam os valores recusados.
