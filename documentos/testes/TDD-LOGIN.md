# TDD da tela de login

**Data:** 09/09/2026

## Objetivo

Aplicar TDD na tela de login, validando seus principais comportamentos e desenvolvendo a opção de mostrar e ocultar a senha.

## Ciclo TDD

- **RED:** o teste foi criado primeiro e falhou porque o botão `Mostrar senha` ainda não existia. Resultado: 5 testes aprovados e 1 reprovado.
- **GREEN:** foi implementado o botão para mostrar e ocultar a senha, preservando o valor digitado. Resultado: 6 testes aprovados.
- **REFACTOR:** os testes de redirecionamento foram parametrizados para cliente, profissional e administrador. Resultado final: 8 testes aprovados.

## Funcionalidades testadas

- Exibição dos campos e links da página.
- Validação de campos obrigatórios e e-mail inválido.
- Envio das credenciais para autenticação.
- Redirecionamento conforme o perfil do usuário.
- Exibição de erros retornados pela API.
- Alternância entre mostrar e ocultar a senha.

## Tecnologias utilizadas

JavaScript, React 19, React Router, Vite, Vitest, React Testing Library, `user-event`, JSDOM e ESLint.

## Inteligência artificial utilizada

Foi utilizado o **OpenAI Codex, com modelo GPT-5**, como apoio na análise da tela, criação dos testes, implementação, refatoração e documentação. O resultado foi confirmado pela execução dos testes, pelo ESLint e pelo build de produção.

## Execução

```powershell
cd frontend
npm test
```

**Resultado final:** 8 de 8 testes aprovados.
