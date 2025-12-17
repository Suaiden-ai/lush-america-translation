# Scripts SQL

Esta pasta contém scripts SQL para migrações e operações no banco de dados.

## Estrutura

Os scripts SQL aqui são scripts auxiliares, correções e testes que não fazem parte das migrations oficiais do Supabase.

### Migrations Oficiais

As migrations oficiais do Supabase estão localizadas em:
- `supabase/migrations/` - Migrations versionadas e gerenciadas pelo Supabase CLI

### Scripts Nesta Pasta

Os scripts nesta pasta incluem:

- **Correções**: Scripts para corrigir problemas específicos
- **Testes**: Scripts de teste e validação
- **Debug**: Scripts para debug e análise
- **Operações Manuais**: Scripts para executar manualmente quando necessário

## Uso

⚠️ **Atenção**: Execute estes scripts com cuidado e sempre faça backup antes de executar em produção.

Para aplicar uma migration oficial, use o Supabase CLI:
```bash
supabase db push
```

Para scripts desta pasta, execute manualmente no Supabase Dashboard ou via CLI conforme necessário.
