# Guia de Configuração do Supabase - Lush America Translations

## Projeto Configurado ✅

### Informações do Projeto
- **ID do Projeto**: `yslbjhnqfkjdoxuixfyh`
- **URL**: `https://yslbjhnqfkjdoxuixfyh.supabase.co`
- **Região**: `us-east-2`

### Credenciais
- **URL**: `https://yslbjhnqfkjdoxuixfyh.supabase.co`
- **Chave Anônima**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbGJqaG5xZmtqZG94dWl4ZnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjMwNzksImV4cCI6MjA3MTE5OTA3OX0.sAbOqC1qqG99B8v3QcbIxa2WaS9jfhlm3jYpjDysGK8`

## Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
VITE_SUPABASE_URL=https://yslbjhnqfkjdoxuixfyh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbGJqaG5xZmtqZG94dWl4ZnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjMwNzksImV4cCI6MjA3MTE5OTA3OX0.sAbOqC1qqG99B8v3QcbIxa2WaS9jfhlm3jYpjDysGK8
```

## Estrutura do Banco de Dados

### Tabelas Configuradas ✅

1. **profiles** - Perfis de usuários
   - `id` (UUID, FK para auth.users)
   - `name` (texto)
   - `email` (texto, único)
   - `phone` (texto, opcional)
   - `role` (enum: user, admin, authenticator)
   - Timestamps: `created_at`, `updated_at`

2. **folders** - Organização de documentos
   - `id` (UUID, PK)
   - `user_id` (UUID, FK para profiles)
   - `name` (texto)
   - `parent_id` (UUID, FK para folders, opcional)
   - `color` (texto, default azul)
   - Timestamps: `created_at`, `updated_at`

3. **documents** - Documentos originais
   - `id` (UUID, PK)
   - `user_id` (UUID, FK para profiles)
   - `folder_id` (UUID, FK para folders, opcional)
   - `filename` (texto)
   - `file_id` (texto, opcional)
   - `file_url` (texto, opcional)
   - `pages` (inteiro, default 1)
   - `status` (enum: pending, processing, completed)
   - `total_cost` (numérico)
   - `verification_code` (texto, único, auto-gerado)
   - `is_authenticated` (boolean, default true)
   - `is_bank_statement` (boolean, default false)
   - `idioma_raiz` (texto, opcional)
   - `tipo_trad` (texto, opcional)
   - `valor` (numérico, opcional)
   - Timestamps: `upload_date`, `created_at`, `updated_at`

4. **documents_to_be_verified** - Documentos para verificação
   - `id` (UUID, PK)
   - `user_id` (UUID, FK para profiles)
   - `folder_id` (UUID, FK para folders, opcional)
   - `filename` (texto)
   - `file_id` (texto, opcional)
   - `pages` (inteiro, default 1)
   - `status` (texto, default 'pending')
   - `total_cost` (numérico, default 0.00)
   - `is_bank_statement` (boolean, default false)
   - `is_authenticated` (boolean, default false)
   - `source_language` (texto, default 'portuguese')
   - `target_language` (texto, default 'english')
   - `translation_status` (texto, default 'pending')
   - `translated_file_url` (texto, opcional)
   - `verification_code` (texto, único, auto-gerado)
   - Campos de autenticação: `authenticated_by`, `authenticated_by_name`, `authenticated_by_email`, `authentication_date`
   - Campos de rejeição: `rejected_by`, `rejected_at`, `rejection_reason`, `rejection_comment`
   - Timestamps: `upload_date`, `created_at`, `updated_at`

5. **translated_documents** - Documentos traduzidos
   - `id` (UUID, PK)
   - `original_document_id` (UUID, FK para documents_to_be_verified)
   - `user_id` (UUID, FK para profiles)
   - `folder_id` (UUID, FK para folders, opcional)
   - `filename` (texto)
   - `translated_file_url` (texto)
   - `source_language` (texto)
   - `target_language` (texto)
   - `pages` (inteiro, default 1)
   - `status` (texto, default 'completed')
   - `total_cost` (numérico, default 0.00)
   - `verification_code` (texto, único, auto-gerado)
   - `is_authenticated` (boolean, default true)
   - `is_deleted` (boolean, default false)
   - Campos de autenticação: `authenticated_by`, `authenticated_by_name`, `authenticated_by_email`, `authentication_date`
   - Timestamps: `upload_date`, `created_at`, `updated_at`

6. **notifications** - Notificações do sistema
   - `id` (UUID, PK)
   - `user_id` (UUID, FK para profiles)
   - `title` (texto)
   - `message` (texto)
   - `type` (texto, default 'general')
   - `is_read` (boolean, default false)
   - `related_document_id` (UUID, opcional)
   - Timestamps: `created_at`, `updated_at`

7. **stripe_sessions** - Sessões de pagamento
    - `id` (UUID, PK)
    - `session_id` (texto, único)
    - `document_id` (UUID)
    - `metadata` (JSONB, opcional)
    - Timestamps: `created_at`, `updated_at`

8. **payments** - Pagamentos processados
    - `id` (UUID, PK)
    - `document_id` (UUID, FK para documents_to_be_verified)
    - `user_id` (UUID, FK para profiles)
    - `stripe_session_id` (texto, opcional)
    - `amount` (numérico)
    - `currency` (texto, default 'USD')
    - `status` (texto: pending, completed, failed, refunded)
    - `payment_method` (texto, opcional)
    - `payment_date` (timestamp, opcional)
    - Timestamps: `created_at`, `updated_at`

9. **reports** - Relatórios gerados
    - `id` (UUID, PK)
    - `report_type` (texto: monthly, quarterly, annual, custom)
    - `title` (texto)
    - `description` (texto, opcional)
    - `file_url` (texto, opcional)
    - `generated_by` (UUID, FK para profiles, opcional)
    - `parameters` (JSONB, opcional)
    - Timestamps: `created_at`, `updated_at`

### Tipos Personalizados (Enums)

- **user_role**: 'user', 'admin', 'authenticator', 'lush-admin'
- **document_status**: 'pending', 'processing', 'completed'

### Storage
- **Bucket**: `documents`
- **Configuração**: Público, limite de 50MB
- **Tipos permitidos**: PDF, JPEG, PNG, GIF, TXT, DOC, DOCX

## Row Level Security (RLS)

### Políticas Configuradas ✅

#### Profiles
- Usuários podem ler/atualizar/inserir seu próprio perfil
- Admins podem ler todos os perfis

#### Folders
- Usuários podem gerenciar suas próprias pastas

#### Documents
- Usuários podem gerenciar seus próprios documentos
- Admins podem ler/atualizar todos os documentos
- Acesso público para verificação com código

#### Documents to be Verified
- Usuários podem gerenciar seus próprios documentos
- Admins podem ler/atualizar todos
- Autenticadores podem ler/atualizar todos

#### Translated Documents
- Usuários podem gerenciar seus próprios documentos traduzidos
- Admins podem ler/atualizar todos
- Autenticadores podem ler/atualizar documentos atribuídos

#### Notifications
- Usuários podem gerenciar suas próprias notificações
- Admins podem ver todas e inserir para qualquer usuário

#### Stripe Sessions
- Apenas admins podem acessar

#### Storage
- Leitura pública para o bucket documents
- Usuários autenticados podem fazer upload
- Usuários podem gerenciar arquivos em suas pastas
- Admins podem gerenciar todos os arquivos

## Funções Disponíveis

### Utilitárias
- `generate_verification_code()` - Gera códigos de verificação únicos
- `is_admin(user_id?)` - Verifica se o usuário é admin
- `is_lush_admin(user_id?)` - Verifica se o usuário é lush-admin
- `debug_auth_info()` - Informações de debug da autenticação

### Lush Admin
- `get_payment_stats(start_date?, end_date?)` - Estatísticas de pagamentos
- `get_translation_stats(start_date?, end_date?)` - Estatísticas de traduções
- `generate_payment_report(report_type, start_date?, end_date?)` - Relatório de pagamentos

### Storage
- `generate_permanent_public_url(file_path)` - Gera URLs públicas permanentes
- `check_file_accessibility(file_path)` - Verifica se arquivo está acessível

### Triggers Automáticos
- **Criação de perfil**: Perfil é criado automaticamente quando um usuário se registra
- **Códigos de verificação**: Gerados automaticamente para documentos
- **Timestamps**: `updated_at` atualizado automaticamente

## Próximos Passos

1. **Configurar variáveis de ambiente** no `.env`
2. **Testar conexão** com o banco de dados
3. **Configurar autenticação** na aplicação
4. **Implementar upload de arquivos** para o storage
5. **Criar usuário admin** inicial (se necessário)

## Comandos Úteis

### Verificar conexão
```bash
npm run dev
```

### Criar usuário admin (via SQL)
```sql
-- Primeiro criar usuário no auth.users (via dashboard do Supabase)
-- Depois atualizar o role:
UPDATE profiles SET role = 'admin' WHERE email = 'seu-email@domain.com';
```

## Troubleshooting

### Problemas Comuns
1. **Erro de RLS**: Verificar se as políticas estão corretas
2. **Upload de arquivo falha**: Verificar configurações do storage bucket
3. **Perfil não criado**: Verificar se o trigger `handle_new_user` está ativo

### Logs
Acesse os logs do Supabase no dashboard para debug:
`https://supabase.com/dashboard/project/yslbjhnqfkjdoxuixfyh/logs`

## Backup e Restauração
As migrações estão salvas em `supabase/migrations/` e podem ser reaplicadas em outro ambiente se necessário.
