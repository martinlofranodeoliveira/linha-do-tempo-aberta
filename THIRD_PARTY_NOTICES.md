# Atribuições e dependências

O código e os exemplos desta edição são distribuídos sob MIT. Os acontecimentos de demonstração são fictícios. A fonte de título abaixo é distribuída sob sua própria licença. Não há imagens, serviços ou bibliotecas de execução de terceiros.

## Fonte auto-hospedada

Atkinson Hyperlegible Next, estilo normal variável, pesos 200–800. Copyright 2020–2024 The Atkinson Hyperlegible Next Project Authors. Licença SIL Open Font License 1.1, reproduzida integralmente em [assets/fonts/OFL-Atkinson-Hyperlegible-Next.txt](assets/fonts/OFL-Atkinson-Hyperlegible-Next.txt).

- Origem oficial: [google/fonts, commit 95f4904fc8bcf26d3420fe315560c96417c6dec7](https://github.com/google/fonts/tree/95f4904fc8bcf26d3420fe315560c96417c6dec7/ofl/atkinsonhyperlegiblenext). O metadata dessa revisão identifica o projeto original [googlefonts/atkinson-hyperlegible-next](https://github.com/googlefonts/atkinson-hyperlegible-next/tree/7925f50f649b3813257faf2f4c0b381011f434f1).
- Arquivo original: `AtkinsonHyperlegibleNext[wght].ttf`. Bytes originais preservados em `assets/fonts/atkinson-hyperlegible-next-variable.ttf`; apenas o nome do arquivo local foi simplificado.
- SHA-256 da fonte: `5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745`.
- SHA-256 da licença original: `aca6a428580965d2297d1b718042dd427c2a9443ece3b0d02d758e161e0c4030`.

A fonte é servida pela mesma origem e usada somente no título do documento. Campos, controles e dados do diagrama mantêm suas fontes de interface. Não há requisições a serviços de fontes.

## Infraestrutura de verificação

`scripts/check-offline.py` é adaptado de [Receitas em Escala](https://github.com/martinlofranodeoliveira/receitas-em-escala), commit `0f6e59c9095c521e17a209cf806f02b3662d43ad`, MIT, copyright 2026 Martin Lofrano — LOFRANO TECNOLOGIA. Mantém staging verificado por hashes, fontes/dependências/oráculos somente leitura, isolamento sem rede/home/credenciais e verificação de privilégios. A adaptação troca o build React/Vite por cópia estática exclusiva, sem diminuir esses requisitos.

## Dependências apenas de desenvolvimento

- jsdom 26.1.0 — MIT, projeto jsdom. Simula DOM nos testes; não entra em `dist`.
- fake-indexeddb 6.2.4 — Apache-2.0, projeto fake-indexeddb. Testa transações locais; não entra em `dist`.
- Prettier 3.6.2 — MIT, projeto Prettier. Formatação das fontes; não entra em `dist`.

As licenças originais e dependências transitivas acompanham os pacotes instalados por `npm ci`, conforme `package-lock.json`. A distribuição estática contém os arquivos autorais explicitamente listados no build, este aviso, a licença MIT, a fonte auto-hospedada e sua licença OFL. Nenhum pacote Node é enviado ao navegador.
