# Atribuições e dependências

O código e os exemplos desta edição são distribuídos sob MIT. Os acontecimentos de demonstração são fictícios. Não há fontes, imagens, serviços ou bibliotecas de execução de terceiros.

## Infraestrutura de verificação

`scripts/check-offline.py` é adaptado de [Receitas em Escala](https://github.com/martinlofranodeoliveira/receitas-em-escala), commit `0f6e59c9095c521e17a209cf806f02b3662d43ad`, MIT, copyright 2026 Martin Lofrano — LOFRANO TECNOLOGIA. Mantém staging verificado por hashes, fontes/dependências/oráculos somente leitura, isolamento sem rede/home/credenciais e verificação de privilégios. A adaptação troca o build React/Vite por cópia estática exclusiva, sem diminuir esses requisitos.

## Dependências apenas de desenvolvimento

- jsdom 26.1.0 — MIT, projeto jsdom. Simula DOM nos testes; não entra em `dist`.
- fake-indexeddb 6.2.4 — Apache-2.0, projeto fake-indexeddb. Testa transações locais; não entra em `dist`.
- Prettier 3.6.2 — MIT, projeto Prettier. Formatação das fontes; não entra em `dist`.

As licenças originais e dependências transitivas acompanham os pacotes instalados por `npm ci`, conforme `package-lock.json`. A distribuição estática contém somente os arquivos autorais explicitamente listados no build, este aviso e a licença MIT. Nenhum pacote Node é enviado ao navegador.
