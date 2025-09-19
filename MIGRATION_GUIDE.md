# Guia de Migração para Kiro - Lush America Translations

## 🎯 Instruções para Kiro

**Kiro, este documento contém todas as informações necessárias para atualizar o projeto desatualizado com base no projeto atual (Lush America Translations).**

### 📋 Resumo do que precisa ser feito:
1. **Atualizar dependências** do package.json
2. **Aplicar migrações** do banco de dados
3. **Atualizar componentes** React com novas funcionalidades
4. **Configurar novas integrações** (Stripe, Zelle, i18n)
5. **Implementar novos hooks** e contextos
6. **Atualizar sistema de autenticação** com novos roles

---

## 🎯 Visão Geral do Projeto Atualizado

Este é um sistema completo de tradução de documentos com as seguintes características principais:

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Internacionalização**: i18next (Português, Espanhol, Inglês)
- **Pagamentos**: Stripe + Zelle
- **Autenticação**: Supabase Auth com roles (user, admin, authenticator, finance)

## 🏗️ Arquitetura do Sistema

### Estrutura de Pastas
```
src/
├── components/          # Componentes reutilizáveis
├── contexts/           # Contextos React (Auth, I18n, Toast)
├── hooks/              # Hooks customizados
├── lib/                # Configurações e utilitários
├── locales/            # Arquivos de tradução
├── pages/              # Páginas da aplicação
├── types/              # Definições TypeScript
└── utils/              # Funções utilitárias
```

### Principais Funcionalidades

1. **Sistema de Usuários Multi-role**
   - Usuários comuns (upload de documentos)
   - Administradores (gerenciamento completo)
   - Autenticadores (verificação de documentos)
   - Finance (relatórios e pagamentos)

2. **Gestão de Documentos**
   - Upload de arquivos (PDF, DOC, DOCX, etc.)
   - Organização em pastas
   - Status de tradução (pending, processing, completed)
   - Códigos de verificação únicos

3. **Sistema de Pagamentos**
   - Integração Stripe para pagamentos instantâneos
   - Sistema Zelle para transferências bancárias
   - Verificação manual de pagamentos

4. **Internacionalização**
   - Suporte a 3 idiomas (PT, ES, EN)
   - Detecção automática de idioma
   - Persistência de preferências

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### 1. `profiles`
```sql
- id (uuid, PK, FK para auth.users)
- name (text)
- email (text, unique)
- phone (text, optional)
- role (enum: user, admin, authenticator, finance)
- created_at, updated_at (timestamps)
```

#### 2. `documents`
```sql
- id (uuid, PK)
- user_id (uuid, FK para profiles)
- folder_id (uuid, FK para folders, optional)
- filename (text)
- file_id, file_url (text, optional)
- pages (integer)
- status (enum: pending, processing, completed)
- total_cost (decimal)
- verification_code (text, unique)
- payment_method (text)
- created_at, updated_at (timestamps)
```

#### 3. `documents_to_be_verified`
```sql
- id (uuid, PK)
- user_id (uuid, FK para profiles)
- filename (text)
- status (text)
- source_language, target_language (text)
- translation_status (text)
- authenticated_by (uuid, FK para profiles)
- authentication_date (timestamp)
- translated_file_url (text)
- created_at, updated_at (timestamps)
```

#### 4. `translated_documents`
```sql
- id (uuid, PK)
- original_document_id (uuid, FK para documents_to_be_verified)
- user_id (uuid, FK para profiles)
- filename (text)
- translated_file_url (text)
- source_language, target_language (text)
- status (text)
- verification_code (text, unique)
- is_authenticated (boolean)
- created_at, updated_at (timestamps)
```

#### 5. `payments`
```sql
- id (uuid, PK)
- document_id (uuid, FK para documents_to_be_verified)
- user_id (uuid, FK para profiles)
- stripe_session_id (text, optional)
- amount (decimal)
- currency (text, default 'USD')
- status (text: pending, completed, failed)
- payment_method (text: stripe, zelle)
- zelle_confirmation_code (text, optional)
- payment_date (timestamp)
- created_at, updated_at (timestamps)
```

#### 6. `folders`
```sql
- id (uuid, PK)
- user_id (uuid, FK para profiles)
- name (text)
- parent_id (uuid, FK para folders, optional)
- color (text)
- created_at, updated_at (timestamps)
```

#### 7. `notifications`
```sql
- id (uuid, PK)
- user_id (uuid, FK para profiles)
- title (text)
- message (text)
- type (text)
- is_read (boolean)
- related_document_id (uuid, optional)
- created_at, updated_at (timestamps)
```

## 🔧 Configuração do Projeto

### 1. Dependências Principais

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.51.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.6.3",
    "i18next": "^25.4.2",
    "react-i18next": "^15.7.2",
    "lucide-react": "^0.344.0",
    "react-hot-toast": "^2.5.2",
    "tailwindcss": "^3.4.1",
    "date-fns": "^2.30.0",
    "jspdf": "^3.0.2",
    "recharts": "^3.1.2"
  }
}
```

### 2. Variáveis de Ambiente

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Configuração do Supabase

#### Storage Bucket
- Nome: `documents`
- Configuração: Público
- Limite: 50MB
- Tipos permitidos: PDF, JPEG, PNG, GIF, TXT, DOC, DOCX

#### Row Level Security (RLS)
- Políticas configuradas para todas as tabelas
- Usuários podem gerenciar apenas seus próprios dados
- Admins têm acesso completo
- Autenticadores têm acesso específico

## 🎨 Sistema de Design

### Cores Personalizadas (Tailwind)
```javascript
colors: {
  'tfe-red': {
    50: '#fef2f2',
    // ... gradiente até 950: '#B01E23'
  },
  'tfe-blue': {
    50: '#eff6ff',
    // ... gradiente até 950: '#2A407C'
  }
}
```

### Componentes Principais

1. **Header** - Navegação principal com seletor de idioma
2. **Sidebar** - Navegação lateral responsiva
3. **AdminLayout** - Layout para páginas administrativas
4. **DocumentManager** - Gerenciamento de documentos
5. **PaymentModals** - Modais de pagamento (Stripe/Zelle)

## 🌐 Sistema de Internacionalização

### Estrutura de Traduções
```json
{
  "common": { "loading": "Carregando...", "save": "Salvar" },
  "navigation": { "home": "Início", "dashboard": "Painel" },
  "auth": { "login": "Entrar", "register": "Cadastrar" },
  "dashboard": { "welcome": "Bem-vindo" },
  "documents": { "upload": "Enviar", "download": "Baixar" }
}
```

### Uso nos Componentes
```tsx
import { useI18n } from '../contexts/I18nContext';

function MyComponent() {
  const { t, currentLanguage, changeLanguage } = useI18n();
  
  return (
    <div>
      <h1>{t('dashboard.welcome')}</h1>
      <button onClick={() => changeLanguage('es')}>
        Mudar para Espanhol
      </button>
    </div>
  );
}
```

## 🔐 Sistema de Autenticação

### Roles e Permissões

1. **user** - Usuário comum
   - Upload de documentos
   - Visualizar próprios documentos
   - Gerenciar pastas pessoais

2. **admin** - Administrador
   - Acesso completo ao sistema
   - Gerenciamento de usuários
   - Relatórios e estatísticas

3. **authenticator** - Autenticador
   - Verificar documentos
   - Aprovar traduções
   - Upload de documentos traduzidos

4. **finance** - Financeiro
   - Relatórios de pagamentos
   - Estatísticas financeiras
   - Gerenciamento de transações

### Hook de Autenticação
```tsx
const { user, loading, signIn, signOut, signUp } = useAuth();
```

## 💳 Sistema de Pagamentos

### Fluxo Stripe
1. Usuário seleciona documento
2. Sistema calcula custo (páginas × $20)
3. Cria sessão Stripe
4. Processa pagamento
5. Atualiza status do documento

### Fluxo Zelle
1. Usuário seleciona Zelle
2. Recebe instruções de pagamento
3. Realiza transferência
4. Insere código de confirmação
5. Admin verifica pagamento
6. Documento é processado

## 📱 Responsividade

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Componentes Responsivos
- Menu mobile com overlay
- Sidebar colapsável
- Tabelas com scroll horizontal
- Modais adaptáveis

## 🚀 INSTRUÇÕES PASSO A PASSO PARA KIRO

### ⚠️ IMPORTANTE: Faça backup do projeto atual antes de começar!

### 1. 📦 Atualizar Dependências

**Substitua o package.json atual por este:**

```json
{
  "name": "vite-react-typescript-starter",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@phosphor-icons/react": "^2.1.10",
    "@supabase/supabase-js": "^2.51.0",
    "@types/recharts": "^1.8.29",
    "date-fns": "^2.30.0",
    "i18next": "^25.4.2",
    "i18next-browser-languagedetector": "^8.2.0",
    "jspdf": "^3.0.2",
    "jspdf-autotable": "^5.0.2",
    "lucide-react": "^0.344.0",
    "pdfjs-dist": "^5.3.93",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hot-toast": "^2.5.2",
    "react-i18next": "^15.7.2",
    "react-pdf": "^10.0.1",
    "react-router-dom": "^7.6.3",
    "recharts": "^3.1.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/jspdf": "^1.3.3",
    "@types/pdfjs-dist": "^2.10.377",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/react-router-dom": "^5.3.3",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "postcss": "^8.4.35",
    "supabase": "^2.31.4",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.4.2"
  }
}
```

**Depois execute:**
```bash
npm install
```

### 2. 🗄️ Atualizar Banco de Dados

**Execute estas migrações SQL na ordem:**

1. **Primeiro, execute todas as migrações da pasta `supabase/migrations/`**
2. **Verifique se estas tabelas existem:**
   - `profiles`
   - `documents`
   - `documents_to_be_verified`
   - `translated_documents`
   - `payments`
   - `folders`
   - `notifications`
   - `stripe_sessions`
   - `reports`

3. **Verifique se estes enums existem:**
   ```sql
   CREATE TYPE user_role AS ENUM ('user', 'admin', 'authenticator', 'finance');
   CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed');
   ```

### 3. 🔧 Atualizar Configurações

**Atualize o `tailwind.config.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
      extend: {
        colors: {
          'tfe-red': {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            300: '#fca5a5',
            400: '#f87171',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
            800: '#991b1b',
            900: '#7f1d1d',
            950: '#B01E23',
          },
          'tfe-blue': {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
            950: '#2A407C',
          },
        },
      },
    },
    plugins: [],
  };
```

### 4. 📁 Estrutura de Arquivos para Copiar

**Copie estes arquivos/pastas do projeto atualizado:**

#### Contextos (src/contexts/):
- `I18nContext.tsx`
- `ToastContext.tsx`
- `OverviewContext.tsx`

#### Hooks (src/hooks/):
- `useAuth.tsx`
- `useDocuments.ts`
- `useFolders.ts`
- `useFinance.tsx`
- `useNotifications.ts`
- `useTranslation.ts`

#### Lib (src/lib/):
- `database.types.ts`
- `supabase.ts`
- `postgresql.ts`
- `postgresql-edge.ts`
- `i18n.ts`

#### Locales (src/locales/):
- `pt.json`
- `es.json`
- `en.json`

#### Utils (src/utils/):
- Todos os arquivos da pasta utils

### 5. 🎨 Componentes Principais para Atualizar

**Componentes que precisam ser atualizados/criados:**

1. **Header.tsx** - Adicionar seletor de idioma
2. **Sidebar.tsx** - Atualizar navegação com novos roles
3. **AdminLayout.tsx** - Layout para páginas administrativas
4. **PaymentMethodModal.tsx** - Modal de seleção de pagamento
5. **ZellePaymentModal.tsx** - Modal para pagamentos Zelle
6. **NotificationBell.tsx** - Sistema de notificações
7. **LanguageSelector.tsx** - Seletor de idioma

### 6. 📄 Páginas para Atualizar

**Páginas que precisam ser atualizadas/criadas:**

1. **App.tsx** - Atualizar roteamento e contextos
2. **CustomerDashboard/** - Dashboard do usuário
3. **AdminDashboard/** - Dashboard administrativo
4. **FinanceDashboard/** - Dashboard financeiro
5. **DocumentManager/** - Gerenciamento de documentos
6. **ZelleCheckout.tsx** - Página de checkout Zelle
7. **PaymentSuccess.tsx** - Página de sucesso
8. **PaymentCancelled.tsx** - Página de cancelamento

### 7. 🔐 Sistema de Autenticação

**Atualize o sistema de auth para incluir novos roles:**
- `user` - Usuário comum
- `admin` - Administrador
- `authenticator` - Autenticador
- `finance` - Financeiro

### 8. 💳 Sistema de Pagamentos

**Implemente:**
1. **Stripe** - Para pagamentos instantâneos
2. **Zelle** - Para transferências bancárias
3. **Verificação manual** de pagamentos Zelle

### 9. 🌐 Internacionalização

**Configure o i18next:**
1. Copie arquivos de tradução
2. Configure o contexto I18n
3. Adicione seletor de idioma no header

### 10. 🧪 Testes

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview
npm run preview
```

## 🔧 Customizações Comuns

### 1. Alterar Preços
```typescript
// Em src/hooks/useDocuments.ts
total_cost: (documentData.pages ?? 1) * 20, // Alterar multiplicador
```

### 2. Adicionar Novos Tipos de Arquivo
```typescript
// Em src/utils/fileUtils.ts
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Adicionar novos tipos
];
```

### 3. Modificar Informações de Contato Zelle
```typescript
// Em src/components/PaymentMethodModal.tsx
const ZELLE_INFO = {
  email: 'seu-email@empresa.com',
  phone: '(555) 123-4567',
  businessName: 'Sua Empresa'
};
```

### 4. Adicionar Novos Roles
```sql
-- Atualizar enum
ALTER TYPE user_role ADD VALUE 'novo_role';

-- Adicionar políticas RLS
CREATE POLICY "Novo role policy" ON tabela
  FOR SELECT TO authenticated
  USING (role = 'novo_role');
```

## 📊 Monitoramento e Analytics

### Métricas Implementadas
- Estatísticas de documentos por status
- Relatórios de pagamentos
- Análise de usuários por tipo
- Tempo médio de processamento

### Funções SQL Disponíveis
- `get_payment_stats(start_date, end_date)`
- `get_translation_stats(start_date, end_date)`
- `get_enhanced_translation_stats(start_date, end_date)`
- `generate_payment_report(report_type, start_date, end_date)`

## 🛠️ Manutenção

### Backup
- Migrações em `supabase/migrations/`
- Backup automático do Supabase
- Versionamento de código

### Logs
- Console logs para debug
- Logs do Supabase para backend
- Error boundaries no React

### Atualizações
- Dependências via `npm update`
- Migrações via `supabase db push`
- Deploy via Netlify/Vercel

## 🆘 Suporte e Troubleshooting

### Problemas Comuns

1. **Erro de RLS**: Verificar políticas no Supabase
2. **Upload falha**: Verificar configuração do storage
3. **Tradução não aparece**: Verificar arquivos de locale
4. **Pagamento não processa**: Verificar chaves do Stripe

### Recursos de Debug
- Console do navegador
- Logs do Supabase
- Network tab para requisições
- React DevTools

## 🎯 Próximos Passos

### Melhorias Sugeridas
1. **Notificações em tempo real** com WebSockets
2. **API REST** para integrações externas
3. **Sistema de templates** para documentos
4. **Integração com IA** para tradução automática
5. **App mobile** com React Native

### Escalabilidade
1. **CDN** para arquivos estáticos
2. **Cache Redis** para consultas frequentes
3. **Load balancer** para múltiplas instâncias
4. **Database sharding** para grandes volumes

## 📋 CHECKLIST ESPECÍFICO PARA KIRO

### ⚠️ ANTES DE COMEÇAR
- [ ] **FAZER BACKUP** do projeto atual
- [ ] Verificar se tem acesso ao Supabase
- [ ] Verificar se tem as chaves do Stripe (se aplicável)
- [ ] Confirmar que o projeto desatualizado está funcionando

### ✅ FASE 1: PREPARAÇÃO
- [ ] Fazer backup do projeto atual
- [ ] Atualizar `package.json` com novas dependências
- [ ] Executar `npm install`
- [ ] Verificar se não há erros de dependências

### ✅ FASE 2: BANCO DE DADOS
- [ ] Aplicar todas as migrações SQL da pasta `supabase/migrations/`
- [ ] Verificar se todas as tabelas foram criadas
- [ ] Verificar se os enums foram criados
- [ ] Testar conexão com o banco
- [ ] Criar usuário admin de teste

### ✅ FASE 3: ESTRUTURA BÁSICA
- [ ] Copiar arquivos de `src/contexts/`
- [ ] Copiar arquivos de `src/hooks/`
- [ ] Copiar arquivos de `src/lib/`
- [ ] Copiar arquivos de `src/locales/`
- [ ] Copiar arquivos de `src/utils/`
- [ ] Atualizar `tailwind.config.js`

### ✅ FASE 4: COMPONENTES PRINCIPAIS
- [ ] Atualizar `App.tsx` com novos contextos
- [ ] Atualizar `Header.tsx` com seletor de idioma
- [ ] Atualizar `Sidebar.tsx` com novos roles
- [ ] Criar `AdminLayout.tsx`
- [ ] Criar modais de pagamento
- [ ] Criar sistema de notificações

### ✅ FASE 5: PÁGINAS E DASHBOARDS
- [ ] Atualizar páginas de autenticação
- [ ] Criar/atualizar `CustomerDashboard/`
- [ ] Criar/atualizar `AdminDashboard/`
- [ ] Criar/atualizar `FinanceDashboard/`
- [ ] Criar/atualizar `DocumentManager/`
- [ ] Criar páginas de pagamento

### ✅ FASE 6: INTEGRAÇÕES
- [ ] Configurar Stripe (se aplicável)
- [ ] Configurar sistema Zelle
- [ ] Configurar sistema de notificações
- [ ] Configurar storage do Supabase
- [ ] Testar upload de arquivos

### ✅ FASE 7: INTERNACIONALIZAÇÃO
- [ ] Copiar arquivos de tradução
- [ ] Configurar contexto I18n
- [ ] Adicionar seletor de idioma
- [ ] Testar mudança de idiomas

### ✅ FASE 8: TESTES E VALIDAÇÃO
- [ ] Testar login/logout
- [ ] Testar upload de documentos
- [ ] Testar sistema de pagamentos
- [ ] Testar responsividade
- [ ] Testar todos os roles de usuário
- [ ] Verificar se não há erros no console

### ✅ FASE 9: DEPLOY
- [ ] Fazer build de produção
- [ ] Testar build localmente
- [ ] Deploy para produção
- [ ] Testar em produção

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### ❌ Erro: "Module not found"
**Solução:** Verificar se todas as dependências foram instaladas com `npm install`

### ❌ Erro: "Supabase connection failed"
**Solução:** Verificar variáveis de ambiente no `.env`

### ❌ Erro: "Table doesn't exist"
**Solução:** Verificar se as migrações foram aplicadas corretamente

### ❌ Erro: "RLS policy violation"
**Solução:** Verificar se as políticas RLS estão configuradas

### ❌ Erro: "Translation not found"
**Solução:** Verificar se os arquivos de tradução foram copiados

## 💡 DICAS IMPORTANTES PARA KIRO

1. **Sempre teste após cada fase** - Não pule para a próxima fase sem testar
2. **Mantenha o backup** - Se algo der errado, você pode voltar
3. **Verifique o console** - Erros aparecem no console do navegador
4. **Teste com diferentes usuários** - Crie usuários com diferentes roles
5. **Verifique responsividade** - Teste em mobile, tablet e desktop
6. **Documente mudanças** - Anote o que foi alterado para referência futura

## 📞 SUPORTE

Se encontrar problemas:
1. Verifique o console do navegador
2. Verifique os logs do Supabase
3. Compare com o projeto original
4. Verifique se todos os arquivos foram copiados

---

## 🎯 RESUMO EXECUTIVO PARA KIRO

### O que você está fazendo:
Atualizando um projeto desatualizado para ficar igual ao projeto atual (Lush America Translations) que tem:
- Sistema de usuários com 4 roles diferentes
- Sistema de pagamentos (Stripe + Zelle)
- Internacionalização (3 idiomas)
- Dashboards administrativos
- Sistema de notificações
- Gerenciamento de documentos

### Tempo estimado:
- **Experiente**: 2-3 dias
- **Intermediário**: 1-2 semanas
- **Iniciante**: 2-3 semanas

### Prioridade das tarefas:
1. **CRÍTICO**: Backup e dependências
2. **ALTO**: Banco de dados e autenticação
3. **MÉDIO**: Componentes e páginas
4. **BAIXO**: Customizações e melhorias

### Arquivos mais importantes para copiar:
1. `src/contexts/` - Contextos React
2. `src/hooks/` - Hooks customizados
3. `src/lib/` - Configurações e tipos
4. `src/locales/` - Traduções
5. `supabase/migrations/` - Migrações do banco

### ⚠️ LEMBRE-SE:
- **SEMPRE** faça backup antes de começar
- **TESTE** após cada fase
- **NÃO PULE** etapas
- **DOCUMENTE** as mudanças

---

Esta documentação fornece uma base sólida para adaptar o projeto Lush America Translations para outro projeto similar. O sistema é modular e bem estruturado, facilitando customizações e manutenção a longo prazo.
