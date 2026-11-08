# Contribuir

Obrigado por melhorar uma ferramenta em português que pode ser usada sem conta ou serviço externo. Abra uma issue com passos reproduzíveis e um arquivo **fictício** pequeno. Não envie dados pessoais, arquivos de clientes ou credenciais.

## Estrutura

- `src/engine.js`: calendário e validação/filtros/layout/exportações, sem efeitos.
- `src/app.js`: DOM e fluxo de edição. Conteúdo importado vai para APIs textuais, nunca HTML bruto.
- `src/storage.js`: IndexedDB, cópias canônicas e compare-and-swap por revisão em transação.
- `src/example.js`: demonstração fictícia.
- `tests`: testes públicos. Preserve testes existentes e acrescente regressões para mudanças de comportamento.
- `scripts/build.mjs`: distribuição explícita em diretório novo, sem limpeza recursiva.

## Executar

Node 22 ou 24, Python 3, Linux com `bubblewrap` e `setpriv` para a qualificação isolada.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
python3 -B scripts/check-offline.py --node /usr/bin/node --deps "$PWD/node_modules"
```

Use o caminho absoluto real do seu executávelNode se diferente. O helper não instala pacotes, não usa credenciais e não recorre a testes fora do sandbox se a política de namespaces impedir a execução. Fonte/dependências são copiadas e comparadas por hashes, montadas somente leitura, sem rede/home real e com CapEff=0/NoNewPrivs=1. Somente diretórios temporários de saída ficam graváveis. Ele valida testes não vazios/sem skips, build estático e licenças, depois publica o build próprio em `dist`. Não exige nem executa sudo no computador local.

A CI instala ferramentas em runnerLinux efêmero hospedado antes do isolamento. A preparação de runner usa sudo somente nesse runner; não reproduza esse passo no seu computador nem desative políticas globais para rodar testes.

A aceitação independente de desenvolvimento não é distribuída, nem seus controles entram nos exemplos ou prompts. Um colaborador pode fornecer a própria pasta explícita com `--acceptance`; isso é código de teste confiável que roda no mesmo sandbox, não uma entrada de usuário do produto.

Antes de propor uma interface, confira teclado, rótulos, contraste e celular; não transforme fatos ausentes em exemplos reais. SVG precisa continuar passivo e dadosJSON devem poder ser reimportados integralmente. TestesDOM não substituem uma conferência real no navegador.
