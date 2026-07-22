# Teste de isolamento multiempresa

`npm run test:rls` cria duas empresas e dois usuários temporários no Supabase configurado, tenta atravessar as políticas RLS e remove todos os dados de teste ao final.

O teste cobre leitura cruzada nas 20 tabelas com `empresa_id`, leitura de `empresas`, troca de tenant no perfil, vazamento por função auxiliar, injeção de papéis e operações `INSERT`, `UPDATE` e `DELETE` em dados de outra empresa.

Para executar toda a validação antes de produção:

```bash
npm run check:production
```

## Variáveis obrigatórias

- `SUPABASE_URL` ou `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

A chave `SUPABASE_SERVICE_ROLE_KEY` serve somente para criar e limpar os tenants temporários. Ela nunca deve usar o prefixo `VITE_`, entrar no bundle ou ser armazenada no repositório.

O teste altera temporariamente o banco configurado. Em CI, use preferencialmente um projeto Supabase separado de staging. Os registros recebem nomes e e-mails `rls-audit-*`, e falhas de limpeza fazem o comando falhar.
