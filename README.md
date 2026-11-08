# Linha do Tempo Aberta

Editor visual em português para criar, revisar, filtrar e compartilhar uma linha do tempo de **datas civis** — sem conta, sem servidor e sem enviar arquivos a lugar nenhum.

Parte do laboratório open source da **LOFRANO TECNOLOGIA**. MIT.

## Para quem

Professores, grupos comunitários e equipes pequenas que organizam acontecimentos e períodos para contar uma história ou retrospectiva.

## Uso

Sem dependências de execução. Sirva a pasta por HTTP estático e abra no navegador:

```sh
python3 -m http.server 8080
```

Depois de aberto, o app **não chama serviços externos**.

## Capacidades

- Até **200 eventos** e **12 categorias**
- Dias gregorianos de **0001-01-01 a 9999-12-31** (sem horário/fuso)
- **Pontos** (só início) e **períodos inclusivos** (início + fim)
- Busca textual, filtro por categoria, histórico local de **20 edições** (desfazer)
- Exportação **JSON / CSV / SVG** (SVG passivo, sem scripts)
- Importação JSON **explícita com prévia e confirmação** (um documento por vez)
- **Salvar neste navegador** é opcional (localStorage) e não substitui backup
- Operação por teclado, rótulos explícitos, **tabela textual equivalente** ao desenho, leiaute móvel

## Limites honestos

Sem horários/fusos, conversão de calendário histórico, inferência de fatos, upload, contas ou colaboração em nuvem. Não é PWA: o primeiro carregamento depende do servidor que hospeda os arquivos.

## Demonstração

O botão "Carregar exemplo fictício" usa a história **inteiramente inventada** de uma exposição comunitária. Nenhuma pessoa, cliente ou fato real.

## Testes

```sh
npm test
```

Testes em `tests/` usam Node 22+ com `jsdom` e `fake-indexeddb` (dependências de desenvolvimento). Sem rede na execução:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

## Estrutura

- `index.html` — estrutura do editor (com contrato de direção `seed1f359dd3`)
- `src/engine.js` — regras puras: datas civis, validação estrita, ordenação canônica, CSV/SVG
- `src/app.js` — interface (importa `engine.js`)
- `src/storage.js` — cópia opcional neste navegador (IndexedDB)
- `src/example.js` — dados fictícios de demonstração
- `src/main.js` — ponto de entrada
- `API.md` — contrato da engine · `METODO.md` — método · `PRODUCT.md` — especificação do produto
- `scripts/build.mjs` — build estático para `dist/` (publicado via GitHub Pages pelo CI)

## Licença

MIT — veja `LICENSE`.
