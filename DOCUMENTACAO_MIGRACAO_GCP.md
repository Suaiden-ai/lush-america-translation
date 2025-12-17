# 📋 Documentação Completa - Lush America Translations
## Preparação para Migração GCP

**Data:** Janeiro 2025  
**Projeto:** Lush America Translations  
**Objetivo:** Documentação completa da infraestrutura atual para discussão de migração para Google Cloud Platform (GCP)

---

## 📊 1. Visão Geral do Projeto

### 1.1 Descrição
Sistema completo de tradução de documentos com gestão de usuários, pagamentos, autenticação e processamento de arquivos. Aplicação web full-stack com frontend React e backend Supabase.

### 1.2 Domínio de Produção
- **URL Principal:** `lushamerica.com` (assumido baseado nas configurações)
- **Ambiente de Desenvolvimento:** Localhost e domínios de teste

### 1.3 Arquitetura Atual
```
Frontend (React) → Supabase (Backend-as-a-Service)
                ↓
         PostgreSQL Database
         Authentication
         Storage (S3-compatible)
         Edge Functions (Deno)
```

---

## 🛠️ 2. Stack Tecnológica

### 2.1 Frontend

#### Framework e Build
- **React 18.3.1** - Biblioteca UI
- **TypeScript 5.5.3** - Tipagem estática
- **Vite 5.4.2** - Build tool e dev server
- **React Router DOM 7.6.3** - Roteamento

#### UI e Estilização
- **Tailwind CSS 3.4.1** - Framework CSS utilitário
- **Radix UI** - Componentes acessíveis
  - `@radix-ui/react-progress`
  - `@radix-ui/react-slot`
  - `@radix-ui/react-tabs`
- **Lucide React 0.344.0** - Ícones
- **Phosphor Icons 2.1.10** - Ícones adicionais

#### Funcionalidades Especiais
- **React PDF 10.0.1** - Visualização de PDFs
- **PDF.js 5.3.93** - Renderização de PDFs
- **jsPDF 3.0.2** - Geração de PDFs
- **jsPDF AutoTable 5.0.2** - Tabelas em PDFs
- **Recharts 3.1.2** - Gráficos e visualizações
- **React Hot Toast 2.5.2** - Notificações toast
- **DnD Kit** - Drag and drop
  - `@dnd-kit/core 6.3.1`
  - `@dnd-kit/sortable 10.0.0`
  - `@dnd-kit/utilities 3.2.2`

#### Internacionalização
- **i18next 25.4.2** - Framework de i18n
- **react-i18next 15.7.2** - Integração React
- **i18next-browser-languagedetector 8.2.0** - Detecção de idioma
- **Idiomas Suportados:** Português (PT), Espanhol (ES), Inglês (EN)

#### Utilitários
- **date-fns 2.30.0** - Manipulação de datas
- **clsx 2.1.1** - Concatenação de classes CSS
- **class-variance-authority 0.7.1** - Variantes de componentes

### 2.2 Backend e Infraestrutura

#### Supabase (Backend-as-a-Service)
- **Supabase JS Client 2.51.0** - Cliente JavaScript
- **Supabase CLI 2.31.4** - Ferramentas de linha de comando
- **Serviços Utilizados:**
  - **PostgreSQL 17** - Banco de dados relacional
  - **Supabase Auth** - Autenticação e autorização
  - **Supabase Storage** - Armazenamento de arquivos (S3-compatible)
  - **Supabase Edge Functions** - Funções serverless (Deno runtime)
  - **Supabase Realtime** - WebSockets para atualizações em tempo real

#### Runtime das Edge Functions
- **Deno** - Runtime JavaScript/TypeScript
- **Edge Runtime** - Ambiente serverless

### 2.3 Ferramentas de Desenvolvimento

#### Linting e Formatação
- **ESLint 9.9.1** - Linter JavaScript/TypeScript
- **TypeScript ESLint 8.3.0** - Regras TypeScript
- **ESLint Plugin React Hooks 5.1.0** - Regras React Hooks
- **ESLint Plugin React Refresh 0.4.11** - Hot reload

#### Build e Processamento
- **PostCSS 8.4.35** - Processamento CSS
- **Autoprefixer 10.4.18** - Prefixos CSS automáticos

---

## 🗄️ 3. Banco de Dados (PostgreSQL)

### 3.1 Versão
- **PostgreSQL 17** (major version configurada)

### 3.2 Tabelas Principais

#### 3.2.1 Autenticação e Usuários
- **`auth.users`** (tabela nativa do Supabase)
  - Gerenciamento de autenticação
  - JWT tokens
  - Refresh tokens

- **`profiles`**
  - `id` (uuid, FK para auth.users)
  - `name` (text)
  - `email` (text, unique)
  - `phone` (text, optional)
  - `role` (enum: user, admin, authenticator, finance, affiliate)
  - `referred_by` (uuid, FK para profiles) - Sistema de afiliados
  - `created_at`, `updated_at` (timestamps)

#### 3.2.2 Documentos
- **`documents`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles)
  - `folder_id` (uuid, FK para folders, nullable)
  - `filename` (text)
  - `file_id`, `file_url` (text, optional)
  - `pages` (integer)
  - `status` (enum: pending, processing, completed, draft)
  - `total_cost` (decimal)
  - `verification_code` (text, unique)
  - `payment_method` (text: stripe, zelle)
  - `receipt_url` (text, optional)
  - `uploaded_by` (uuid, FK para profiles)
  - `is_internal_use` (boolean) - Documentos internos
  - `upload_failed` (boolean)
  - `created_at`, `updated_at` (timestamps)

- **`documents_to_be_verified`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles)
  - `filename` (text)
  - `file_url` (text)
  - `status` (text)
  - `source_language`, `target_language` (text)
  - `translation_status` (text)
  - `translated_file_url` (text)
  - `authenticated_by` (uuid, FK para profiles)
  - `authentication_date` (timestamp)
  - `created_at`, `updated_at` (timestamps)

- **`translated_documents`**
  - `id` (uuid, PK)
  - `original_document_id` (uuid, FK para documents_to_be_verified)
  - `user_id` (uuid, FK para profiles)
  - `filename` (text)
  - `translated_file_url` (text)
  - `source_language`, `target_language` (text)
  - `status` (text)
  - `verification_code` (text, unique)
  - `is_authenticated` (boolean)
  - `is_deleted` (boolean)
  - `created_at`, `updated_at` (timestamps)

#### 3.2.3 Organização
- **`folders`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles)
  - `name` (text)
  - `parent_id` (uuid, FK para folders, nullable) - Estrutura hierárquica
  - `color` (text)
  - `created_at`, `updated_at` (timestamps)

#### 3.2.4 Pagamentos
- **`payments`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles)
  - `document_id` (uuid, FK para documents, nullable)
  - `amount` (decimal)
  - `currency` (text, default: 'usd')
  - `status` (text: pending, completed, failed, cancelled)
  - `payment_method` (text: stripe, zelle)
  - `stripe_payment_intent_id` (text, optional)
  - `stripe_session_id` (text, optional)
  - `fee_amount` (decimal) - Taxa do Stripe
  - `net_amount` (decimal) - Valor líquido após taxas
  - `created_at`, `updated_at` (timestamps)

- **`stripe_sessions`**
  - `id` (uuid, PK)
  - `session_id` (text, unique) - Stripe Checkout Session ID
  - `user_id` (uuid, FK para profiles)
  - `document_id` (uuid, FK para documents, nullable)
  - `amount` (decimal)
  - `status` (text)
  - `expires_at` (timestamp)
  - `cancelled_at` (timestamp, nullable)
  - `created_at`, `updated_at` (timestamps)

- **`zelle_payment_history`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles)
  - `document_id` (uuid, FK para documents, nullable)
  - `amount` (decimal)
  - `confirmation_code` (text)
  - `status` (text: pending, verified, rejected)
  - `receipt_url` (text, optional)
  - `verified_by` (uuid, FK para profiles, nullable)
  - `verified_at` (timestamp, nullable)
  - `created_at`, `updated_at` (timestamps)

#### 3.2.5 Sistema de Afiliados
- **`affiliates`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles, unique)
  - `referral_code` (text, unique)
  - `commission_rate` (decimal, default: 0.10) - 10%
  - `total_earnings` (decimal)
  - `available_balance` (decimal)
  - `total_withdrawn` (decimal)
  - `total_clients` (integer)
  - `created_at`, `updated_at` (timestamps)

- **`affiliate_commissions`**
  - `id` (uuid, PK)
  - `affiliate_id` (uuid, FK para affiliates)
  - `client_id` (uuid, FK para profiles)
  - `payment_id` (uuid, FK para payments)
  - `amount` (decimal)
  - `commission_rate` (decimal)
  - `status` (text: pending, matured, paid)
  - `matured_at` (timestamp, nullable)
  - `created_at`, `updated_at` (timestamps)

- **`affiliate_withdrawals`**
  - `id` (uuid, PK)
  - `affiliate_id` (uuid, FK para affiliates)
  - `amount` (decimal)
  - `status` (text: pending, processing, completed, rejected)
  - `requested_at` (timestamp)
  - `processed_at` (timestamp, nullable)
  - `rejection_reason` (text, nullable)
  - `created_at`, `updated_at` (timestamps)

#### 3.2.6 Notificações e Logs
- **`notifications`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles)
  - `type` (text)
  - `title` (text)
  - `message` (text)
  - `read` (boolean)
  - `created_at`, `updated_at` (timestamps)

- **`action_logs`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles, nullable)
  - `action_type` (text)
  - `entity_type` (text)
  - `entity_id` (uuid, nullable)
  - `details` (jsonb)
  - `ip_address` (text, nullable)
  - `user_agent` (text, nullable)
  - `created_at` (timestamp)

#### 3.2.7 Tracking e Analytics
- **`utm_attributions`**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK para profiles, nullable)
  - `utm_source` (text)
  - `utm_medium` (text)
  - `utm_campaign` (text)
  - `utm_term` (text, nullable)
  - `utm_content` (text, nullable)
  - `referrer` (text, nullable)
  - `landing_page` (text)
  - `created_at` (timestamp)

### 3.3 Segurança (RLS - Row Level Security)
- **RLS Habilitado** em todas as tabelas
- **Políticas por Role:**
  - `user` - Acesso apenas aos próprios dados
  - `admin` - Acesso completo
  - `authenticator` - Acesso a documentos para verificação
  - `finance` - Acesso a relatórios e pagamentos
  - `affiliate` - Acesso a dados de afiliados

### 3.4 Funções e Triggers
- **Funções de Estatísticas:**
  - `get_translation_stats()` - Estatísticas gerais
  - `get_date_filtered_stats()` - Estatísticas por período
  - `get_authenticator_stats()` - Estatísticas de autenticadores

- **Funções de Afiliados:**
  - `calculate_affiliate_balance()` - Cálculo de saldo
  - `mature_commissions()` - Maturação de comissões
  - `get_affiliate_clients()` - Lista de clientes

- **Triggers:**
  - Auto-criação de profile ao signup
  - Auto-atualização de timestamps
  - Geração automática de códigos de verificação
  - Cálculo automático de comissões

### 3.5 Extensões PostgreSQL
- `uuid-ossp` - Geração de UUIDs
- Extensões padrão do Supabase

---

## 📦 4. Armazenamento de Arquivos (Storage)

### 4.1 Buckets Configurados

#### 4.1.1 `documents`
- **Propósito:** Armazenamento de documentos originais enviados pelos usuários
- **Visibilidade:** Privado (com URLs assinadas)
- **Limite de Tamanho:** 50MB por arquivo (configurado no Supabase)
- **Tipos Aceitos:** PDF, DOC, DOCX, e outros formatos de documento

#### 4.1.2 `arquivosfinaislush`
- **Propósito:** Armazenamento de documentos traduzidos finais
- **Visibilidade:** Privado (com URLs assinadas)
- **Expiração:** URLs assinadas com validade de 30 dias
- **Acesso:** Apenas usuários autenticados com permissão

#### 4.1.3 `payment-receipts`
- **Propósito:** Armazenamento de comprovantes de pagamento (Zelle)
- **Visibilidade:** Privado
- **Acesso:** Administradores e usuários proprietários

### 4.2 Funcionalidades de Storage
- **Upload de Arquivos:** Via Supabase Storage API
- **Download de Arquivos:** URLs públicas ou assinadas
- **Gerenciamento de URLs:**
  - URLs públicas permanentes (buckets públicos)
  - URLs assinadas temporárias (30 dias)
- **Detecção de Arquivos Faltantes:** Sistema automático para identificar uploads falhos

### 4.3 Triggers de Storage
- **Expiração Automática:** Limpeza de documentos rascunho (draft) após período determinado
- **Validação de Upload:** Verificação de integridade de arquivos

---

## 🔐 5. Autenticação e Autorização

### 5.1 Sistema de Autenticação (Supabase Auth)

#### 5.1.1 Métodos de Autenticação
- **Email/Password** - Autenticação tradicional
- **Magic Links** - Links de login sem senha (configurável)
- **OTP (One-Time Password)** - Códigos de 6 dígitos
- **Refresh Token Rotation** - Habilitado para segurança

#### 5.1.2 Configurações de Segurança
- **JWT Expiry:** 3600 segundos (1 hora)
- **Refresh Token Rotation:** Habilitado
- **Refresh Token Reuse Interval:** 10 segundos
- **Minimum Password Length:** 6 caracteres
- **Email Confirmation:** Configurável (atualmente desabilitado em dev)

#### 5.1.3 Rate Limiting
- **Email Sent:** 2 por hora
- **SMS Sent:** 30 por hora
- **Token Refresh:** 150 em 5 minutos
- **Sign In/Sign Ups:** 30 em 5 minutos por IP
- **Token Verifications:** 30 em 5 minutos por IP

### 5.2 Sistema de Roles (Autorização)

#### 5.2.1 Roles Disponíveis
1. **`user`** (Padrão)
   - Upload de documentos
   - Visualização de próprios documentos
   - Acesso ao dashboard do cliente

2. **`admin`**
   - Acesso completo ao sistema
   - Gerenciamento de usuários
   - Gerenciamento de documentos
   - Acesso a todas as estatísticas

3. **`authenticator`**
   - Verificação de documentos
   - Autenticação de traduções
   - Acesso a documentos pendentes de verificação

4. **`finance`**
   - Visualização de relatórios financeiros
   - Acesso a dados de pagamentos
   - Estatísticas financeiras
   - Gerenciamento de pagamentos Zelle

5. **`affiliate`**
   - Visualização de comissões
   - Gerenciamento de clientes referenciados
   - Solicitação de saques
   - Estatísticas de afiliados

### 5.3 Políticas de Acesso (RLS)
- **Row Level Security (RLS)** implementado em todas as tabelas
- **Políticas baseadas em roles** e propriedade de dados
- **Políticas dinâmicas** para diferentes níveis de acesso

---

## 💳 6. Sistema de Pagamentos

### 6.1 Stripe Integration

#### 6.1.1 Configuração Dinâmica
- **Sistema de Detecção de Ambiente:**
  - **Desenvolvimento:** Usa chaves `sk_test_*` e `pk_test_*`
  - **Produção:** Usa chaves `sk_live_*` e `pk_live_*`
  - **Detecção Automática:** Baseada em headers HTTP (referer, origin, host)

#### 6.1.2 Variáveis de Ambiente
- **Test/Dev:**
  - `STRIPE_SECRET_KEY_TEST`
  - `STRIPE_WEBHOOK_SECRET_TEST`
  - `STRIPE_PUBLISHABLE_KEY_TEST`

- **Produção:**
  - `STRIPE_SECRET_KEY_PROD`
  - `STRIPE_WEBHOOK_SECRET_PROD`
  - `STRIPE_PUBLISHABLE_KEY_PROD`

#### 6.1.3 Funcionalidades
- **Checkout Sessions:** Criação de sessões de pagamento
- **Payment Intents:** Processamento de pagamentos
- **Webhooks:** Processamento de eventos do Stripe
- **Cálculo de Taxas:** Sistema automático de cálculo de taxas do Stripe
- **Cancelamento:** Sistema de cancelamento de pagamentos pendentes

#### 6.1.4 Eventos Webhook Processados
- `checkout.session.completed` - Sessão de checkout completada
- `payment_intent.succeeded` - Pagamento bem-sucedido
- `payment_intent.payment_failed` - Pagamento falhou

### 6.2 Zelle Integration

#### 6.2.1 Funcionalidades
- **Criação de Pagamentos:** Sistema de criação de pagamentos Zelle
- **Verificação Manual:** Administradores verificam comprovantes
- **Histórico de Pagamentos:** Tabela dedicada para histórico
- **Upload de Comprovantes:** Sistema de upload e validação

#### 6.2.2 Fluxo de Pagamento Zelle
1. Usuário seleciona pagamento via Zelle
2. Sistema gera informações de pagamento
3. Usuário faz transferência bancária
4. Usuário faz upload do comprovante
5. Administrador verifica e aprova
6. Documento é liberado para tradução

### 6.3 Cálculo de Custos
- **Por Página:** Sistema de cálculo baseado em número de páginas
- **Taxas do Stripe:** Cálculo automático de taxas (2.9% + $0.30)
- **Valor Líquido:** Cálculo do valor após dedução de taxas

---

## 🔧 7. Edge Functions (Serverless Functions)

### 7.1 Funções Implementadas

#### 7.1.1 Pagamentos
- **`create-checkout-session`**
  - Cria sessões de checkout do Stripe
  - Configuração dinâmica de ambiente
  - Cálculo de taxas

- **`stripe-webhook`**
  - Processa webhooks do Stripe
  - Valida assinaturas
  - Atualiza status de pagamentos
  - Envia notificações

- **`cancel-stripe-payment`**
  - Cancela pagamentos pendentes
  - Limpa sessões expiradas

- **`get-session-info`**
  - Retorna informações de sessão de checkout

- **`create-zelle-payment`**
  - Cria registros de pagamento Zelle
  - Gera informações de pagamento

- **`zelle-history`**
  - Retorna histórico de pagamentos Zelle

#### 7.1.2 Documentos
- **`send-translation-webhook`**
  - Envia webhooks para sistema de tradução externo
  - Integração com n8n

- **`update-document`**
  - Atualiza informações de documentos
  - Validações de status

- **`cleanup-document`**
  - Limpeza de documentos
  - Remoção de arquivos

- **`delete-draft-document`**
  - Exclusão de documentos rascunho

- **`cleanup-draft-documents`**
  - Limpeza em lote de rascunhos

- **`cleanup-expired-drafts`**
  - Limpeza automática de rascunhos expirados

- **`list-drafts-for-cleanup`**
  - Lista documentos rascunho para limpeza

- **`approved-cleanup`**
  - Limpeza aprovada por administradores

- **`serve-document`**
  - Servir documentos com autenticação

#### 7.1.3 Validação e Webhooks
- **`update-bank-statement-validation`**
  - Validação de extratos bancários

- **`webhook-notifications`**
  - Processamento de notificações via webhook

- **`test-upload`**
  - Teste de upload de arquivos

### 7.2 Módulos Compartilhados

#### 7.2.1 `shared/environment-detector.ts`
- Detecção automática de ambiente (dev/prod)
- Análise de headers HTTP
- Suporte a webhooks do Stripe

#### 7.2.2 `shared/stripe-env-mapper.ts`
- Mapeamento de variáveis de ambiente do Stripe
- Seleção automática de chaves baseada em ambiente

#### 7.2.3 `shared/stripe-config.ts`
- Configuração centralizada do Stripe
- Inicialização do cliente Stripe

#### 7.2.4 `shared/stripe-fee-calculator.ts`
- Cálculo de taxas do Stripe
- Cálculo de valores líquidos

### 7.3 Runtime e Tecnologias
- **Runtime:** Deno
- **API Version:** Stripe 2024-12-18.acacia
- **CORS:** Configurado para permitir requisições cross-origin

---

## 📧 8. Sistema de Emails e Notificações

### 8.1 Emails de Autenticação (Supabase)

#### 8.1.1 Templates
- **Confirm Signup:** Confirmação de cadastro
- **Reset Password:** Reset de senha
- **Localização:** `email-templates/`

#### 8.1.2 Configuração SMTP
- **Atual:** Serviço de email do Supabase (padrão)
- **Opcional:** SMTP customizado (SendGrid, Resend, Google)
- **Configuração:** Disponível em `supabase/config.toml` (comentada)

### 8.2 Emails de Notificação (n8n + Google SMTP)

#### 8.2.1 Fluxo
```
Aplicação → Webhook → n8n → SMTP Google → Email Enviado
```

#### 8.2.2 Endpoint Webhook
- **URL:** `https://nwh.thefutureofenglish.com/webhook/notthelush1`
- **Método:** POST
- **Formato:** JSON

#### 8.2.3 Tipos de Notificação
1. **Document Upload Notification**
   - Quando documento é enviado
   - Inclui informações do arquivo

2. **Payment Notification**
   - Notificações sobre pagamentos
   - Status de pagamento

3. **Translation In Progress Notification**
   - Início de tradução
   - Status de processamento

4. **Translation Completed Notification**
   - Conclusão de tradução
   - Link para download

5. **Authenticator Pending Documents Notification**
   - Documentos pendentes de verificação
   - Notificação para autenticadores

6. **Payment Stripe**
   - Pagamentos Stripe aprovados
   - Notificação para administradores

#### 8.2.4 Estrutura do Payload
```typescript
interface NotificationPayload {
  user_name: string;
  user_email: string;
  notification_type: string;
  timestamp: string;
  document_info?: {
    filename?: string;
    document_id?: string;
    status?: string;
    client_name?: string;
    client_email?: string;
  };
  payment_info?: {
    amount?: number;
    currency?: string;
    payment_id?: string;
  };
}
```

#### 8.2.5 Configuração n8n
- **Host:** `nwh.thefutureofenglish.com`
- **SMTP:** Google (smtp.gmail.com)
- **Porta:** 587 (TLS) ou 465 (SSL)
- **Autenticação:** Senha de app do Google

### 8.3 Notificações In-App
- **Tabela:** `notifications`
- **Sistema:** Notificações em tempo real via Supabase Realtime
- **Tipos:** Variados baseados em ações do sistema

---

## 🤖 9. Integrações Externas

### 9.1 n8n (Automação de Workflows)

#### 9.1.1 Endpoints Utilizados
1. **Webhook de Notificações**
   - URL: `https://nwh.thefutureofenglish.com/webhook/notthelush1`
   - Uso: Envio de emails transacionais

2. **Webhook de Chatbot**
   - URL: `https://nwh.thefutureofenglish.com/webhook/botsitelush`
   - Uso: Sistema de chatbot

#### 9.1.2 Funcionalidades
- Processamento de webhooks
- Envio de emails via SMTP Google
- Automação de workflows
- Integração com chatbot

### 9.2 Stripe (Pagamentos)

#### 9.2.1 Integração
- **API Version:** 2024-12-18.acacia
- **SDK:** Stripe.js via ESM
- **Webhooks:** Processamento de eventos em tempo real

#### 9.2.2 Funcionalidades
- Checkout Sessions
- Payment Intents
- Webhook Events
- Fee Calculation

### 9.3 Sistema de Tradução Externa

#### 9.3.1 Webhook de Tradução
- **Endpoint:** Configurado via Edge Function `send-translation-webhook`
- **Integração:** Sistema externo de tradução (provavelmente via n8n)

---

## 🌐 10. Deploy e Hosting

### 10.1 Frontend

#### 10.1.1 Build
- **Comando:** `npm run build`
- **Output:** Diretório `dist/`
- **Tool:** Vite

#### 10.1.2 Hosting
- **Plataforma:** Netlify (baseado em `netlify.toml`)
- **Configuração:**
  ```toml
  [build]
    publish = "dist"
    command = "npm run build"
  
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

#### 10.1.3 Variáveis de Ambiente
- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave anônima do Supabase

### 10.2 Backend (Supabase)

#### 10.2.1 Projeto Supabase
- **Plataforma:** Supabase Cloud
- **Gerenciamento:** Via Supabase CLI e Dashboard

#### 10.2.2 Migrations
- **Localização:** `supabase/migrations/`
- **Total:** 54 arquivos de migração
- **Gerenciamento:** Via Supabase CLI

#### 10.2.3 Edge Functions
- **Deploy:** Via Supabase CLI
- **Runtime:** Deno
- **URLs:** `https://[project-ref].functions.supabase.co/[function-name]`

---

## 📊 11. Monitoramento e Logs

### 11.1 Logs do Sistema
- **Action Logs:** Tabela `action_logs` para rastreamento de ações
- **Campos:**
  - `user_id` - Usuário que executou a ação
  - `action_type` - Tipo de ação
  - `entity_type` - Tipo de entidade afetada
  - `entity_id` - ID da entidade
  - `details` - Detalhes em JSON
  - `ip_address` - IP do usuário
  - `user_agent` - User agent do navegador

### 11.2 Logs do Supabase
- **Auth Logs:** Logs de autenticação
- **API Logs:** Logs de requisições API
- **Edge Functions Logs:** Logs das funções serverless
- **Storage Logs:** Logs de operações de storage

### 11.3 Debug e Diagnóstico
- **Console Logs:** Logs no console do navegador
- **Error Tracking:** Sistema de rastreamento de erros
- **User Diagnostics:** Ferramentas de diagnóstico de usuário

---

## 🔄 12. Fluxos Principais do Sistema

### 12.1 Fluxo de Upload e Tradução

1. **Upload de Documento**
   - Usuário faz upload via interface
   - Arquivo é salvo no bucket `documents`
   - Registro criado na tabela `documents`
   - Status: `pending`

2. **Pagamento**
   - Usuário seleciona método de pagamento (Stripe ou Zelle)
   - Se Stripe: Criação de checkout session
   - Se Zelle: Criação de registro de pagamento
   - Aguarda confirmação

3. **Processamento**
   - Após pagamento confirmado, documento move para `documents_to_be_verified`
   - Webhook enviado para sistema de tradução
   - Status: `processing`

4. **Tradução**
   - Sistema externo processa tradução
   - Arquivo traduzido salvo em `arquivosfinaislush`
   - Registro criado em `translated_documents`

5. **Autenticação**
   - Autenticador verifica documento
   - Status atualizado
   - Notificação enviada ao usuário

6. **Download**
   - Usuário acessa documento traduzido
   - URL assinada gerada (30 dias)
   - Download disponível

### 12.2 Fluxo de Pagamento Stripe

1. **Criação de Sessão**
   - Frontend chama `create-checkout-session`
   - Edge Function cria sessão no Stripe
   - Retorna URL de checkout

2. **Checkout**
   - Usuário completa pagamento no Stripe
   - Stripe redireciona para página de sucesso

3. **Webhook**
   - Stripe envia webhook `checkout.session.completed`
   - Edge Function `stripe-webhook` processa
   - Atualiza status de pagamento
   - Libera documento para tradução
   - Envia notificações

### 12.3 Fluxo de Pagamento Zelle

1. **Criação de Pagamento**
   - Usuário seleciona Zelle
   - Sistema gera informações de pagamento
   - Registro criado em `zelle_payment_history`

2. **Transferência**
   - Usuário faz transferência bancária
   - Usuário faz upload do comprovante

3. **Verificação**
   - Administrador verifica comprovante
   - Status atualizado para `verified`
   - Pagamento confirmado
   - Documento liberado para tradução

### 12.4 Fluxo de Afiliados

1. **Cadastro de Afiliado**
   - Usuário com role `affiliate` criado
   - Registro em `affiliates` com código único

2. **Referência**
   - Novo usuário se cadastra com código de referência
   - Campo `referred_by` preenchido
   - Relacionamento criado

3. **Comissão**
   - Quando cliente referenciado faz pagamento
   - Comissão calculada e registrada
   - Status: `pending`

4. **Maturação**
   - Após período determinado, comissão matura
   - Status: `matured`
   - Saldo disponível atualizado

5. **Saque**
   - Afiliado solicita saque
   - Administrador aprova/rejeita
   - Saldo atualizado

---

## 📈 13. Estatísticas e Relatórios

### 13.1 Funções de Estatísticas

#### 13.1.1 `get_translation_stats()`
- Estatísticas gerais de traduções
- Total de documentos
- Por status
- Por período

#### 13.1.2 `get_date_filtered_stats()`
- Estatísticas filtradas por data
- Períodos customizáveis
- Filtros por status

#### 13.1.3 `get_authenticator_stats()`
- Estatísticas de autenticadores
- Documentos verificados
- Performance por autenticador

### 13.2 Dashboards

#### 13.2.1 Admin Dashboard
- Visão geral do sistema
- Estatísticas de documentos
- Gerenciamento de usuários
- Relatórios financeiros

#### 13.2.2 Finance Dashboard
- Relatórios financeiros
- Estatísticas de pagamentos
- Análise de receitas
- Gestão de pagamentos Zelle

#### 13.2.3 Customer Dashboard
- Documentos do usuário
- Status de traduções
- Histórico de pagamentos
- Upload de documentos

#### 13.2.4 Affiliate Dashboard
- Comissões e ganhos
- Clientes referenciados
- Estatísticas de performance
- Solicitação de saques

---

## 🎨 14. Interface e UX

### 14.1 Componentes Principais

#### 14.1.1 Layout
- **Header:** Navegação principal
- **Sidebar:** Menu lateral (dashboard)
- **Footer:** Rodapé com informações

#### 14.1.2 Documentos
- **DocumentUploadModal:** Modal de upload
- **DocumentDetailsModal:** Detalhes de documento
- **ImageViewerModal:** Visualizador de imagens
- **DocumentUploadRetry:** Sistema de retry de upload

#### 14.1.3 Pagamentos
- **PaymentCalculator:** Calculadora de custos
- **PaymentMethodModal:** Seleção de método
- **ZellePaymentModal:** Modal de pagamento Zelle
- **ZellePaymentVerification:** Verificação de pagamento

#### 14.1.4 Afiliados
- **AffiliatesTable:** Tabela de afiliados
- **WithdrawalsTable:** Tabela de saques
- **AffiliateDetailModal:** Detalhes de afiliado

#### 14.1.5 Utilitários
- **Chatbot:** Sistema de chat
- **LanguageSelector:** Seletor de idioma
- **NotificationBell:** Notificações
- **LoadingSpinner:** Indicadores de carregamento

### 14.2 Internacionalização
- **3 Idiomas:** Português, Espanhol, Inglês
- **Detecção Automática:** Baseada no navegador
- **Persistência:** Preferência salva
- **Arquivos:** `src/locales/`

---

## 🔒 15. Segurança

### 15.1 Autenticação
- **JWT Tokens:** Tokens seguros
- **Refresh Tokens:** Rotação automática
- **Password Hashing:** Gerenciado pelo Supabase
- **Rate Limiting:** Proteção contra brute force

### 15.2 Autorização
- **RLS (Row Level Security):** Políticas granulares
- **Role-Based Access:** Controle por roles
- **Policy Enforcement:** Aplicação automática

### 15.3 Validação
- **Input Validation:** Validação de entradas
- **File Validation:** Validação de arquivos
- **Payment Validation:** Validação de pagamentos

### 15.4 Webhooks
- **Signature Verification:** Verificação de assinaturas
- **Stripe Webhooks:** Validação de eventos
- **n8n Webhooks:** Autenticação via URL

---

## 📦 16. Dependências e Versões

### 16.1 Dependências Principais (Produção)
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@supabase/supabase-js": "^2.51.0",
  "react-router-dom": "^7.6.3",
  "i18next": "^25.4.2",
  "react-i18next": "^15.7.2",
  "tailwindcss": "^3.4.1",
  "typescript": "^5.5.3"
}
```

### 16.2 Dependências de Desenvolvimento
```json
{
  "vite": "^5.4.2",
  "@vitejs/plugin-react": "^4.3.1",
  "eslint": "^9.9.1",
  "typescript-eslint": "^8.3.0",
  "supabase": "^2.31.4"
}
```

---

## 🌍 17. Ambientes

### 17.1 Desenvolvimento
- **URL:** `localhost:5173` (Vite dev server)
- **Supabase:** Projeto de desenvolvimento
- **Stripe:** Modo teste (`sk_test_*`)
- **Configuração:** `supabase/config.toml`

### 17.2 Produção
- **URL:** `lushamerica.com` (assumido)
- **Supabase:** Projeto de produção
- **Stripe:** Modo live (`sk_live_*`)
- **Netlify:** Hosting do frontend
- **n8n:** `nwh.thefutureofenglish.com`

---

## 📝 18. Considerações para Migração GCP

### 18.1 Serviços a Migrar

#### 18.1.1 Banco de Dados
- **Atual:** PostgreSQL 17 no Supabase
- **GCP:** Cloud SQL (PostgreSQL)
- **Considerações:**
  - Migração de dados
  - Migração de schemas
  - Migração de funções e triggers
  - Configuração de RLS (ou equivalente)

#### 18.1.2 Armazenamento
- **Atual:** Supabase Storage (S3-compatible)
- **GCP:** Cloud Storage
- **Considerações:**
  - Migração de arquivos
  - Configuração de buckets
  - URLs públicas vs assinadas
  - Políticas de acesso

#### 18.1.3 Autenticação
- **Atual:** Supabase Auth
- **GCP:** Firebase Auth ou Identity Platform
- **Considerações:**
  - Migração de usuários
  - Migração de tokens
  - Configuração de providers
  - Custom claims para roles

#### 18.1.4 Edge Functions
- **Atual:** Supabase Edge Functions (Deno)
- **GCP:** Cloud Functions (Node.js/Python) ou Cloud Run
- **Considerações:**
  - Reescrever funções
  - Migração de lógica
  - Configuração de triggers
  - Variáveis de ambiente

#### 18.1.5 Frontend Hosting
- **Atual:** Netlify
- **GCP:** Cloud Storage + Cloud CDN ou Firebase Hosting
- **Considerações:**
  - Migração de build
  - Configuração de CDN
  - Domínio e SSL

### 18.2 Integrações a Manter

#### 18.2.1 Stripe
- **Status:** Manter integração
- **Ação:** Ajustar webhooks para novos endpoints

#### 18.2.2 n8n
- **Status:** Manter integração
- **Ação:** Ajustar URLs de webhooks se necessário

#### 18.2.3 Sistema de Tradução
- **Status:** Manter integração
- **Ação:** Ajustar endpoints de webhook

### 18.3 Custos Estimados

#### 18.3.1 Cloud SQL
- **Instância:** Baseada em uso
- **Storage:** Baseado em tamanho do banco
- **Backups:** Automáticos

#### 18.3.2 Cloud Storage
- **Armazenamento:** Baseado em GB armazenados
- **Operações:** Baseado em requisições
- **Transferência:** Baseado em dados transferidos

#### 18.3.3 Cloud Functions/Cloud Run
- **Execuções:** Baseado em invocações
- **Tempo de execução:** Baseado em duração
- **Memória:** Baseado em alocação

#### 18.3.4 Firebase Auth/Identity Platform
- **Usuários:** Baseado em usuários ativos
- **Autenticações:** Baseado em operações

### 18.4 Plano de Migração Sugerido

#### Fase 1: Preparação
1. Análise detalhada de dependências
2. Mapeamento completo de dados
3. Criação de ambiente de teste no GCP
4. Testes de migração em ambiente isolado

#### Fase 2: Migração de Dados
1. Migração do banco de dados
2. Migração de arquivos de storage
3. Migração de usuários e autenticação
4. Validação de integridade

#### Fase 3: Migração de Aplicação
1. Deploy de Edge Functions
2. Atualização de configurações
3. Deploy do frontend
4. Configuração de domínio e SSL

#### Fase 4: Testes e Validação
1. Testes end-to-end
2. Validação de integrações
3. Testes de performance
4. Testes de segurança

#### Fase 5: Go-Live
1. Migração final de dados
2. Cutover de tráfego
3. Monitoramento intensivo
4. Rollback plan preparado

### 18.5 Riscos e Mitigações

#### 18.5.1 Downtime
- **Risco:** Possível downtime durante migração
- **Mitigação:** Migração gradual, manutenção de ambiente antigo

#### 18.5.2 Perda de Dados
- **Risco:** Perda de dados durante migração
- **Mitigação:** Backups completos, validação de integridade

#### 18.5.3 Problemas de Integração
- **Risco:** Quebra de integrações externas
- **Mitigação:** Testes extensivos, comunicação com parceiros

#### 18.5.4 Performance
- **Risco:** Degradação de performance
- **Mitigação:** Otimizações, CDN, caching

---

## 📞 19. Contatos e Recursos

### 19.1 Documentação
- **Supabase Docs:** https://supabase.com/docs
- **Stripe Docs:** https://stripe.com/docs
- **GCP Docs:** https://cloud.google.com/docs

### 19.2 Suporte
- **Supabase Support:** Via dashboard
- **Stripe Support:** Via dashboard
- **GCP Support:** Via console

---

## 📋 20. Checklist de Migração

### 20.1 Pré-Migração
- [ ] Inventário completo de recursos
- [ ] Backup de todos os dados
- [ ] Documentação de configurações
- [ ] Mapeamento de dependências
- [ ] Estimativa de custos
- [ ] Plano de rollback

### 20.2 Durante Migração
- [ ] Migração de banco de dados
- [ ] Migração de storage
- [ ] Migração de usuários
- [ ] Deploy de funções
- [ ] Deploy de frontend
- [ ] Configuração de DNS
- [ ] Configuração de SSL

### 20.3 Pós-Migração
- [ ] Validação de funcionalidades
- [ ] Testes de integração
- [ ] Monitoramento de performance
- [ ] Validação de segurança
- [ ] Documentação atualizada
- [ ] Treinamento da equipe

---

**Documento gerado em:** Janeiro 2025  
**Versão:** 1.0  
**Última atualização:** Janeiro 2025

---

## 📎 Anexos

### A. Estrutura de Arquivos do Projeto
```
lush-america-translation/
├── src/                    # Código fonte frontend
├── supabase/              # Configuração backend
│   ├── migrations/        # Migrações do banco
│   └── functions/         # Edge Functions
├── public/                # Arquivos estáticos
├── email-templates/      # Templates de email
├── assets/               # Recursos
└── dist/                 # Build de produção
```

### B. Variáveis de Ambiente Necessárias
```bash
# Frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Backend (Supabase)
STRIPE_SECRET_KEY_TEST=
STRIPE_SECRET_KEY_PROD=
STRIPE_WEBHOOK_SECRET_TEST=
STRIPE_WEBHOOK_SECRET_PROD=
STRIPE_PUBLISHABLE_KEY_TEST=
STRIPE_PUBLISHABLE_KEY_PROD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### C. Endpoints Importantes
- **Supabase API:** `https://[project-ref].supabase.co`
- **Edge Functions:** `https://[project-ref].functions.supabase.co`
- **n8n Webhooks:** `https://nwh.thefutureofenglish.com`
- **Stripe API:** `https://api.stripe.com`

---

**Fim do Documento**












