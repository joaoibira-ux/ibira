# Sistema IBIRÁ — Regras para o Claude

## Versão obrigatória a cada alteração

A cada modificação em qualquer arquivo deste sistema:

1. **Atualizar a versão** em dois lugares:
   - `index.html`: `<span id="versao-app" class="splash-versao">vX.XX</span>`
   - `app.js`: `const VERSAO_IBIRA = "X.XX";`
   - `sw.js`: `const VERSION = "ibira-vXX";` (incrementar sempre)
2. **Commitar e fazer push** das alterações
3. **Informar ao usuário** a nova versão no final da resposta: `Versão atual: vX.XX`

A versão atual está em `index.html` e `app.js`.

## Regras gerais

- Sempre commit + push após qualquer mudança, sem perguntar
- Firebase project: `sistema-ibira`
- GitHub repo: `joaoibira-ux/ibira` (GitHub Pages: `joaoibira-ux.github.io/ibira`)
- Cores: azul `#1a3a8f`, vermelho `#c62828`, fundo branco `#ffffff`
- Fundo mobile (iPhone/Android): `fundo1ia.jpeg` via `@media (hover: none) and (pointer: coarse)`
