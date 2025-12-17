# 📘 Guia Completo de Implementação: Sistema de UTM Tracking

## 🎯 Visão Geral

Este guia fornece todos os detalhes necessários para replicar o sistema de UTM tracking da Lush America em outro projeto. O sistema captura, armazena e persiste parâmetros UTM para atribuição de marketing.

---

## 📋 Índice

1. [Arquitetura do Sistema](#arquitetura-do-sistema)
2. [Estrutura de Arquivos](#estrutura-de-arquivos)
3. [Implementação Passo a Passo](#implementação-passo-a-passo)
4. [Código Completo com Explicações](#código-completo-com-explicações)
5. [Banco de Dados](#banco-de-dados)
6. [Integrações](#integrações)
7. [Casos de Uso e Edge Cases](#casos-de-uso-e-edge-cases)
8. [Testes](#testes)
9. [Checklist de Implementação](#checklist-de-implementação)

---

## 🏗️ Arquitetura do Sistema

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                   1. CAPTURA (Frontend)                         │
│  URL: ?utm_source=google&utm_medium=cpc&utm_campaign=summer     │
│  ↓                                                               │
│  App.tsx detecta mudança na URL                                 │
│  ↓                                                               │
│  captureUtmFromUrl() extrai parâmetros                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             2. ARMAZENAMENTO TEMPORÁRIO (LocalStorage)          │
│  Chave: 'lush-america:utm-attribution'                          │
│  Valor: JSON com todos os dados UTM + metadata                   │
│  TTL: 60 dias                                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             3. PERSISTÊNCIA (Banco de Dados)                     │
│  Trigger: Quando usuário se registra                            │
│  Tabela: utm_attributions                                        │
│  Ação: Inserir registro + limpar localStorage                   │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Principais

1. **Tipos TypeScript** (`types/utm.ts`)
   - Define interfaces e tipos
   - Lista de parâmetros UTM válidos

2. **Utilitário de Tracking** (`utils/utmTracker.ts`)
   - Funções de captura, leitura, persistência e limpeza
   - Lógica de TTL e sobrescrita

3. **Integração no App** (`App.tsx`)
   - Captura automática em cada navegação

4. **Integração no Registro** (`pages/Register.tsx`)
   - Leitura dos UTMs antes do registro
   - Limpeza após sucesso

5. **Persistência no Banco** (`hooks/useAuth.tsx`)
   - Função para salvar no banco de dados

---

## 📁 Estrutura de Arquivos

```
projeto/
├── src/
│   ├── types/
│   │   └── utm.ts                    # Tipos e interfaces
│   ├── utils/
│   │   └── utmTracker.ts             # Lógica de tracking
│   ├── hooks/
│   │   └── useAuth.tsx               # Hook de autenticação (com persistência)
│   ├── pages/
│   │   └── Register.tsx              # Página de registro
│   └── App.tsx                       # Componente principal
├── supabase/
│   └── migrations/
│       └── create_utm_attributions_table.sql
└── GUIA_COMPLETO_UTM_TRACKING.md     # Este arquivo
```

---

## 🚀 Implementação Passo a Passo

### PASSO 1: Criar Tipos TypeScript

**Arquivo:** `src/types/utm.ts`

```typescript
// Lista de parâmetros UTM padrão (Google Analytics)
export const UTM_PARAM_KEYS = [
  'utm_source',    // Origem do tráfego (ex: google, facebook, newsletter)
  'utm_medium',    // Meio de marketing (ex: cpc, email, social, organic)
  'utm_campaign', // Nome da campanha (ex: summer_sale, black_friday)
  'utm_term',      // Termo de busca pago (ex: translation services)
  'utm_content'    // Conteúdo específico (ex: logolink, textlink)
] as const;

// Tipo derivado da lista acima (type-safe)
export type UtmParamKey = (typeof UTM_PARAM_KEYS)[number];
// Resultado: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content'

// Interface base com dados de atribuição
export interface UtmAttributionData {
  utm_source?: string;      // Origem
  utm_medium?: string;      // Meio
  utm_campaign?: string;   // Campanha
  utm_term?: string;        // Termo (opcional)
  utm_content?: string;     // Conteúdo (opcional)
  landing_page?: string;    // Primeira página visitada com UTM
  last_touch_page?: string; // Última página visitada
  referrer?: string;        // URL de referência (document.referrer)
}

// Interface estendida com timestamp de captura
export interface StoredUtmAttribution extends UtmAttributionData {
  capturedAt: string; // ISO 8601 timestamp (ex: "2025-01-15T10:30:00.000Z")
}
```

**Explicação:**
- `as const` torna a lista imutável e permite inferência de tipos
- `UtmParamKey` garante type-safety ao acessar parâmetros
- `UtmAttributionData` contém apenas dados de atribuição
- `StoredUtmAttribution` adiciona `capturedAt` para controle de TTL

---

### PASSO 2: Criar Utilitário de Tracking

**Arquivo:** `src/utils/utmTracker.ts`

#### 2.1 Constantes e Helpers

```typescript
import { StoredUtmAttribution, UTM_PARAM_KEYS, UtmParamKey } from '../types/utm';

// Chave única no localStorage (use um prefixo único do seu projeto)
const STORAGE_KEY = 'lush-america:utm-attribution';

// TTL (Time To Live) em milissegundos: 60 dias
const TTL_MS = 1000 * 60 * 60 * 24 * 60;
// Breakdown:
// 1000 = 1 segundo (em ms)
// * 60 = 1 minuto
// * 60 = 1 hora
// * 24 = 1 dia
// * 60 = 60 dias

// Verifica se está rodando no browser (SSR safety)
const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Obtém o caminho atual completo (pathname + query string)
const getCurrentPath = () => {
  if (!isBrowser()) return '';
  return `${window.location.pathname}${window.location.search}`;
  // Exemplo: "/register?ref=ABC123" ou "/dashboard"
};
```

#### 2.2 Função de Decisão de Sobrescrita

```typescript
/**
 * Decide se deve sobrescrever dados UTM existentes
 * 
 * Regras:
 * - Se não existe → sobrescrever (true)
 * - Se existe mas expirou (>60 dias) → sobrescrever (true)
 * - Se existe e ainda é válido → manter (false)
 * 
 * @param existing - Dados UTM existentes no localStorage
 * @returns true se deve sobrescrever, false se deve manter
 */
const shouldOverrideExisting = (existing: StoredUtmAttribution | null): boolean => {
  // Se não existe, criar novo
  if (!existing) return true;
  
  // Converte capturedAt para timestamp (milissegundos desde 1970)
  const capturedAt = new Date(existing.capturedAt).getTime();
  
  // Se a data é inválida (NaN) ou expirou, sobrescrever
  return Number.isNaN(capturedAt) || Date.now() - capturedAt > TTL_MS;
};
```

**Exemplo de uso:**
```typescript
// Caso 1: Não existe
shouldOverrideExisting(null) // true → criar novo

// Caso 2: Existe e é recente (10 dias atrás)
const recent = { capturedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() };
shouldOverrideExisting(recent) // false → manter

// Caso 3: Existe mas expirou (70 dias atrás)
const expired = { capturedAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString() };
shouldOverrideExisting(expired) // true → sobrescrever
```

#### 2.3 Função de Sanitização

```typescript
/**
 * Remove espaços em branco e normaliza valores
 * 
 * @param value - Valor a ser sanitizado
 * @returns string sem espaços ou undefined se vazio/null
 */
const sanitizeValue = (value: string | undefined | null): string | undefined => {
  // Se não existe, retorna undefined
  if (!value) return undefined;
  
  // Remove espaços no início e fim
  const trimmed = value.trim();
  
  // Se ficou vazio após trim, retorna undefined
  return trimmed || undefined;
};
```

**Exemplos:**
```typescript
sanitizeValue('  google  ') // 'google'
sanitizeValue('') // undefined
sanitizeValue(null) // undefined
sanitizeValue(undefined) // undefined
sanitizeValue('   ') // undefined (apenas espaços)
```

#### 2.4 Função de Normalização

```typescript
/**
 * Normaliza todos os campos do payload UTM
 * Remove espaços, converte null/empty para undefined
 * 
 * @param payload - Payload UTM a ser normalizado
 * @returns Payload normalizado
 */
const normalizePayload = (payload: StoredUtmAttribution): StoredUtmAttribution => ({
  ...payload, // Mantém todos os campos originais
  // Sanitiza cada campo UTM
  utm_source: sanitizeValue(payload.utm_source),
  utm_medium: sanitizeValue(payload.utm_medium),
  utm_campaign: sanitizeValue(payload.utm_campaign),
  utm_term: sanitizeValue(payload.utm_term),
  utm_content: sanitizeValue(payload.utm_content),
  // Sanitiza campos de navegação
  landing_page: sanitizeValue(payload.landing_page),
  last_touch_page: sanitizeValue(payload.last_touch_page),
  referrer: sanitizeValue(payload.referrer),
  // capturedAt não precisa sanitizar (já é ISO string)
});
```

#### 2.5 Função de Construção de Record UTM

```typescript
/**
 * Extrai parâmetros UTM da URL
 * 
 * @param params - URLSearchParams da URL atual
 * @returns Objeto com UTMs encontrados e flag indicando se há valores
 */
const buildUtmRecord = (params: URLSearchParams): {
  utmRecord: Partial<Record<UtmParamKey, string>>;
  hasValue: boolean;
} => {
  const utmRecord: Partial<Record<UtmParamKey, string>> = {};
  let hasValue = false;

  // Itera sobre cada parâmetro UTM válido
  UTM_PARAM_KEYS.forEach((key) => {
    const value = params.get(key); // Obtém valor da URL
    
    if (value) {
      utmRecord[key] = value; // Armazena no objeto
      hasValue = true; // Marca que encontrou pelo menos um UTM
    }
  });

  return { utmRecord, hasValue };
};
```

**Exemplo:**
```typescript
// URL: ?utm_source=google&utm_medium=cpc&utm_campaign=summer
const params = new URLSearchParams(window.location.search);
const { utmRecord, hasValue } = buildUtmRecord(params);

// Resultado:
// utmRecord = {
//   utm_source: 'google',
//   utm_medium: 'cpc',
//   utm_campaign: 'summer'
// }
// hasValue = true
```

#### 2.6 Função de Leitura do LocalStorage

```typescript
/**
 * Lê dados UTM armazenados no localStorage
 * Valida TTL e remove se expirado
 * 
 * @returns Dados UTM ou null se não existir/expirado
 */
export const getStoredUtmParams = (): StoredUtmAttribution | null => {
  // Verifica se está no browser
  if (!isBrowser()) return null;
  
  try {
    // Tenta ler do localStorage
    const stored = window.localStorage.getItem(STORAGE_KEY);
    
    // Se não existe, retorna null
    if (!stored) return null;
    
    // Parse do JSON
    const parsed = JSON.parse(stored) as StoredUtmAttribution;
    
    // Valida se tem capturedAt (obrigatório)
    if (!parsed?.capturedAt) return null;
    
    // Converte para timestamp
    const capturedAt = new Date(parsed.capturedAt).getTime();
    
    // Se inválido ou expirado, remove e retorna null
    if (Number.isNaN(capturedAt) || Date.now() - capturedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    // Retorna dados normalizados
    return normalizePayload(parsed);
    
  } catch (error) {
    // Se houver erro (JSON inválido, etc), loga e retorna null
    console.warn('[utmTracker] Falha ao ler UTM armazenado', error);
    return null;
  }
};
```

**Casos de erro tratados:**
- JSON inválido no localStorage
- Dados corrompidos
- Falta de `capturedAt`
- Data inválida

#### 2.7 Função de Persistência no LocalStorage

```typescript
/**
 * Salva dados UTM no localStorage
 * 
 * @param payload - Dados UTM a serem salvos
 */
export const persistUtmParams = (payload: StoredUtmAttribution): void => {
  // Verifica se está no browser
  if (!isBrowser()) return;
  
  try {
    // Normaliza antes de salvar
    const normalized = normalizePayload(payload);
    
    // Converte para JSON e salva
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    
  } catch (error) {
    // Erro comum: localStorage cheio (quota exceeded)
    console.warn('[utmTracker] Não foi possível persistir UTM', error);
  }
};
```

**Limite do localStorage:**
- Geralmente 5-10MB por domínio
- Se exceder, lança `QuotaExceededError`
- Tratado silenciosamente (não quebra a aplicação)

#### 2.8 Função de Limpeza

```typescript
/**
 * Remove dados UTM do localStorage
 * Usado após persistir no banco de dados
 */
export const clearUtmParams = (): void => {
  if (!isBrowser()) return;
  
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[utmTracker] Não foi possível limpar UTM', error);
  }
};
```

#### 2.9 Função Principal de Captura

```typescript
/**
 * FUNÇÃO PRINCIPAL: Captura UTMs da URL e gerencia armazenamento
 * 
 * Lógica:
 * 1. Se há UTMs na URL → captura e decide se sobrescreve
 * 2. Se não há UTMs → atualiza apenas last_touch_page se existir dados
 * 3. Sempre persiste no localStorage
 * 
 * @returns Dados UTM capturados ou null
 */
export const captureUtmFromUrl = (): StoredUtmAttribution | null => {
  if (!isBrowser()) return null;

  // 1. Extrai parâmetros da URL
  const params = new URLSearchParams(window.location.search);
  const { utmRecord, hasValue } = buildUtmRecord(params);
  
  // 2. Lê dados existentes (se houver)
  const existing = getStoredUtmParams();
  
  // 3. Obtém caminho atual
  const currentPath = getCurrentPath();

  // CASO A: Não há UTMs na URL atual
  if (!hasValue) {
    // Se existe dados anteriores, apenas atualiza last_touch_page
    if (existing) {
      const refreshed = {
        ...existing,
        last_touch_page: currentPath || existing.last_touch_page,
      };
      persistUtmParams(refreshed);
      return refreshed;
    }
    // Se não existe, retorna null
    return null;
  }

  // CASO B: Há UTMs na URL atual
  // Decide se deve sobrescrever dados existentes
  const override = shouldOverrideExisting(existing);
  
  // Base para merge: se sobrescrever ou não existe, usa objeto vazio
  // Senão, usa dados existentes
  const base = override || !existing ? {} : existing;
  
  // Timestamp: novo se sobrescrever, senão mantém o original
  const capturedAt = override || !existing 
    ? new Date().toISOString() 
    : existing!.capturedAt;
  
  // Referrer: novo se sobrescrever, senão mantém o original
  const referrer = override 
    ? document?.referrer || undefined 
    : existing?.referrer || document?.referrer || undefined;
  
  // Landing page: novo se sobrescrever, senão mantém o original
  const landingPage = override 
    ? currentPath 
    : existing?.landing_page || currentPath;

  // 4. Constrói payload final (merge de novos UTMs com base)
  const payload: StoredUtmAttribution = {
    // Merge: novos UTMs têm prioridade, senão usa base
    utm_source: utmRecord.utm_source ?? base.utm_source,
    utm_medium: utmRecord.utm_medium ?? base.utm_medium,
    utm_campaign: utmRecord.utm_campaign ?? base.utm_campaign,
    utm_term: utmRecord.utm_term ?? base.utm_term,
    utm_content: utmRecord.utm_content ?? base.utm_content,
    // Campos de navegação
    landing_page: landingPage,
    last_touch_page: currentPath, // Sempre atualiza para página atual
    referrer,
    capturedAt,
  };

  // 5. Persiste no localStorage
  persistUtmParams(payload);
  
  // 6. Retorna dados capturados
  return payload;
};
```

**Exemplos de comportamento:**

```typescript
// Exemplo 1: Primeira visita com UTM
// URL: /?utm_source=google&utm_medium=cpc
// existing: null
// Resultado: Cria novo registro com UTMs

// Exemplo 2: Visita subsequente sem UTM
// URL: /dashboard
// existing: { utm_source: 'google', ... }
// Resultado: Mantém UTMs, atualiza last_touch_page para '/dashboard'

// Exemplo 3: Nova visita com UTM (dentro de 60 dias)
// URL: /?utm_source=facebook&utm_medium=social
// existing: { utm_source: 'google', capturedAt: '2025-01-01' } (10 dias atrás)
// Resultado: Mantém UTMs originais (google), não sobrescreve

// Exemplo 4: Nova visita com UTM (após 60 dias)
// URL: /?utm_source=facebook&utm_medium=social
// existing: { utm_source: 'google', capturedAt: '2024-01-01' } (70 dias atrás)
// Resultado: Sobrescreve com novos UTMs (facebook)
```

---

### PASSO 3: Integração no App Principal

**Arquivo:** `src/App.tsx`

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureUtmFromUrl } from './utils/utmTracker';

function App() {
  const location = useLocation();

  // Captura UTMs sempre que a URL muda
  useEffect(() => {
    captureUtmFromUrl();
  }, [location.pathname, location.search]);
  // Dependências:
  // - location.pathname: muda quando navega para outra página
  // - location.search: muda quando query params mudam (incluindo UTMs)

  // ... resto do componente
}
```

**Por que usar `useEffect`?**
- Executa após renderização
- Captura UTMs mesmo em navegação client-side (SPA)
- Re-executa quando dependências mudam

**Alternativa (se não usar React Router):**
```typescript
useEffect(() => {
  captureUtmFromUrl();
  
  // Se usar navegação manual, adicione listener
  const handlePopState = () => captureUtmFromUrl();
  window.addEventListener('popstate', handlePopState);
  
  return () => window.removeEventListener('popstate', handlePopState);
}, []);
```

---

### PASSO 4: Integração na Página de Registro

**Arquivo:** `src/pages/Register.tsx`

```typescript
import { getStoredUtmParams, clearUtmParams } from '../utils/utmTracker';
import { useAuth } from '../hooks/useAuth';

export function Register() {
  const { signUp } = useAuth();
  // ... outros estados

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ... validações do formulário

    setIsLoading(true);

    try {
      // 1. Lê UTMs do localStorage ANTES do registro
      const utmParams = getStoredUtmParams();
      
      // 2. Chama signUp passando UTMs como opção
      const result = await signUp(
        formData.email,
        formData.password,
        formData.name,
        formData.phone,
        {
          referralCode: formData.referralCode || undefined,
          utm: utmParams ?? undefined, // Passa null como undefined
        }
      );
      
      // 3. Se registro foi bem-sucedido, limpa localStorage
      if (utmParams) {
        clearUtmParams();
      }
      
      // ... resto do tratamento de sucesso
      
    } catch (err) {
      // ... tratamento de erro
    } finally {
      setIsLoading(false);
    }
  };

  // ... resto do componente
}
```

**Pontos importantes:**
- Lê UTMs **antes** de chamar `signUp`
- Passa `null` como `undefined` (evita problemas com tipos)
- Limpa localStorage **apenas após sucesso**
- Se falhar, UTMs permanecem para nova tentativa

---

### PASSO 5: Persistência no Banco de Dados

**Arquivo:** `src/hooks/useAuth.tsx`

```typescript
import { StoredUtmAttribution } from '../types/utm';
import { supabase } from '../lib/supabase';

interface SignUpOptions {
  referralCode?: string;
  role?: UserRole;
  utm?: StoredUtmAttribution | null; // Adiciona UTM nas opções
}

const AuthProvider = ({ children }) => {
  // ... outros estados

  /**
   * Persiste atribuição UTM no banco de dados
   * 
   * @param userId - ID do usuário (UUID)
   * @param email - Email do usuário
   * @param utm - Dados UTM a serem salvos
   */
  const persistUtmAttribution = async (
    userId: string, 
    email: string, 
    utm?: StoredUtmAttribution | null
  ): Promise<void> => {
    // Se não há UTM, não faz nada
    if (!utm) return;
    
    try {
      const { error } = await supabase
        .from('utm_attributions')
        .insert({
          user_id: userId,
          email,
          // Converte undefined para null (PostgreSQL não aceita undefined)
          utm_source: utm.utm_source ?? null,
          utm_medium: utm.utm_medium ?? null,
          utm_campaign: utm.utm_campaign ?? null,
          utm_term: utm.utm_term ?? null,
          utm_content: utm.utm_content ?? null,
          landing_page: utm.landing_page ?? null,
          last_touch_page: utm.last_touch_page ?? null,
          referrer: utm.referrer ?? null,
          // Usa capturedAt do UTM ou timestamp atual
          captured_at: utm.capturedAt ?? new Date().toISOString(),
        });
        
      if (error) {
        console.warn('[Auth] Não foi possível salvar atribuição UTM', error);
        // Não lança erro - falha silenciosa para não quebrar registro
      }
    } catch (err) {
      console.warn('[Auth] Erro inesperado ao salvar atribuição UTM', err);
      // Não lança erro - falha silenciosa
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    phone: string, 
    options?: SignUpOptions
  ) => {
    const referralCode = options?.referralCode;
    const role = options?.role ?? 'user';
    const utm = options?.utm ?? null; // Extrai UTM das opções
    
    try {
      // 1. Cria usuário no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role, phone } }
      });
      
      if (error) throw error;
      
      // 2. Se usuário foi criado, persiste UTM
      if (data.user) {
        // Cria perfil na tabela profiles
        await fetchOrCreateProfile(data.user.id, email, name, role, phone, referralCode);
        
        // Persiste UTM no banco
        await persistUtmAttribution(data.user.id, email, utm);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  // ... resto do hook
};
```

**Por que falha silenciosa?**
- Não queremos que falha ao salvar UTM impeça o registro
- UTM é importante mas não crítico
- Logs permitem investigação posterior

---

## 🗄️ Banco de Dados

### SQL de Criação da Tabela

**Arquivo:** `supabase/migrations/create_utm_attributions_table.sql`

```sql
-- Cria tabela dedicada para armazenar atribuições de marketing
create table if not exists public.utm_attributions (
  -- Chave primária
  id uuid primary key default uuid_generate_v4(),
  
  -- Relacionamento com usuário (pode ser NULL se usuário for deletado)
  user_id uuid references auth.users(id) on delete set null,
  
  -- Email do usuário (redundante mas útil para queries sem JOIN)
  email text,
  
  -- Parâmetros UTM padrão
  utm_source text,      -- Origem (ex: google, facebook, newsletter)
  utm_medium text,      -- Meio (ex: cpc, email, social, organic)
  utm_campaign text,    -- Campanha (ex: summer_sale, black_friday)
  utm_term text,        -- Termo de busca (opcional)
  utm_content text,     -- Conteúdo específico (opcional)
  
  -- Dados de navegação
  landing_page text,        -- Primeira página visitada com UTM
  last_touch_page text,    -- Última página visitada
  referrer text,           -- URL de referência (document.referrer)
  
  -- Timestamps
  captured_at timestamptz default timezone('utc', now()), -- Quando UTMs foram capturados
  created_at timestamptz default timezone('utc', now())  -- Quando registro foi criado
);

-- Índices para otimizar consultas
create index if not exists utm_attributions_user_id_idx 
  on public.utm_attributions (user_id);

create index if not exists utm_attributions_email_idx 
  on public.utm_attributions (lower(email)); -- Case-insensitive

-- Índices adicionais recomendados (opcional, para análises)
create index if not exists utm_attributions_source_medium_idx 
  on public.utm_attributions (utm_source, utm_medium);

create index if not exists utm_attributions_campaign_idx 
  on public.utm_attributions (utm_campaign);

create index if not exists utm_attributions_captured_at_idx 
  on public.utm_attributions (captured_at);
```

### Estrutura da Tabela

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `uuid_generate_v4()` | Chave primária |
| `user_id` | `uuid` | YES | - | FK para `auth.users` |
| `email` | `text` | YES | - | Email (redundante) |
| `utm_source` | `text` | YES | - | Origem do tráfego |
| `utm_medium` | `text` | YES | - | Meio de marketing |
| `utm_campaign` | `text` | YES | - | Nome da campanha |
| `utm_term` | `text` | YES | - | Termo de busca |
| `utm_content` | `text` | YES | - | Conteúdo específico |
| `landing_page` | `text` | YES | - | Primeira página |
| `last_touch_page` | `text` | YES | - | Última página |
| `referrer` | `text` | YES | - | URL de referência |
| `captured_at` | `timestamptz` | YES | `now()` | Quando foi capturado |
| `created_at` | `timestamptz` | YES | `now()` | Quando foi criado |

### Queries Úteis

```sql
-- 1. Buscar atribuição de um usuário
SELECT * FROM utm_attributions 
WHERE user_id = 'uuid-do-usuario';

-- 2. Top 10 origens de tráfego
SELECT 
  utm_source,
  COUNT(*) as total_registros
FROM utm_attributions
WHERE utm_source IS NOT NULL
GROUP BY utm_source
ORDER BY total_registros DESC
LIMIT 10;

-- 3. Taxa de conversão por campanha
SELECT 
  utm_campaign,
  COUNT(*) as total_registros,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM utm_attributions
WHERE utm_campaign IS NOT NULL
GROUP BY utm_campaign
ORDER BY total_registros DESC;

-- 4. Registros dos últimos 30 dias
SELECT * FROM utm_attributions
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- 5. Jornada completa de um usuário
SELECT 
  landing_page,
  last_touch_page,
  referrer,
  captured_at
FROM utm_attributions
WHERE user_id = 'uuid-do-usuario';
```

---

## 🔗 Integrações

### Integração com Supabase

Se usar Supabase, a função de persistência já está pronta. Se usar outro backend:

**Exemplo com API REST:**
```typescript
const persistUtmAttribution = async (
  userId: string, 
  email: string, 
  utm?: StoredUtmAttribution | null
) => {
  if (!utm) return;
  
  try {
    const response = await fetch('/api/utm-attributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        email,
        ...utm,
        captured_at: utm.capturedAt,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save UTM attribution');
    }
  } catch (err) {
    console.warn('[Auth] Erro ao salvar atribuição UTM', err);
  }
};
```

### Integração com Google Analytics

Para enviar UTMs também para GA:

```typescript
// Em captureUtmFromUrl, após persistir
if (typeof gtag !== 'undefined') {
  gtag('event', 'utm_captured', {
    utm_source: payload.utm_source,
    utm_medium: payload.utm_medium,
    utm_campaign: payload.utm_campaign,
  });
}
```

---

## 🧪 Casos de Uso e Edge Cases

### Caso 1: Primeira Visita com UTM

**Cenário:**
```
Usuário acessa: https://site.com/?utm_source=google&utm_medium=cpc
```

**Comportamento:**
1. `captureUtmFromUrl()` detecta UTMs
2. `getStoredUtmParams()` retorna `null` (não existe)
3. Cria novo registro com:
   - `utm_source: 'google'`
   - `utm_medium: 'cpc'`
   - `landing_page: '/?utm_source=google&utm_medium=cpc'`
   - `last_touch_page: '/?utm_source=google&utm_medium=cpc'`
   - `capturedAt: '2025-01-15T10:30:00.000Z'`
4. Salva no localStorage

---

### Caso 2: Navegação Sem UTM

**Cenário:**
```
Usuário já visitou com UTM, agora navega para /dashboard (sem UTM)
```

**Comportamento:**
1. `captureUtmFromUrl()` não encontra UTMs na URL
2. `getStoredUtmParams()` retorna dados existentes
3. Atualiza apenas `last_touch_page: '/dashboard'`
4. Mantém todos os UTMs originais
5. Atualiza localStorage

---

### Caso 3: Nova Visita com UTM (Dentro de 60 dias)

**Cenário:**
```
Usuário visitou há 10 dias com utm_source=google
Agora visita com utm_source=facebook
```

**Comportamento:**
1. `captureUtmFromUrl()` detecta novos UTMs
2. `shouldOverrideExisting()` retorna `false` (não expirou)
3. **Mantém UTMs originais** (google)
4. Atualiza apenas `last_touch_page`
5. **Não sobrescreve** (preserva primeira atribuição)

---

### Caso 4: Nova Visita com UTM (Após 60 dias)

**Cenário:**
```
Usuário visitou há 70 dias com utm_source=google
Agora visita com utm_source=facebook
```

**Comportamento:**
1. `captureUtmFromUrl()` detecta novos UTMs
2. `shouldOverrideExisting()` retorna `true` (expirado)
3. **Sobrescreve com novos UTMs** (facebook)
4. Cria novo `capturedAt`
5. Atualiza `landing_page` e `last_touch_page`

---

### Caso 5: Múltiplos UTMs Parciais

**Cenário:**
```
Primeira visita: ?utm_source=google&utm_medium=cpc
Segunda visita: ?utm_campaign=summer (sem source/medium)
```

**Comportamento:**
1. Primeira visita: salva `source` e `medium`
2. Segunda visita: detecta apenas `campaign`
3. Faz merge: mantém `source` e `medium`, adiciona `campaign`
4. Resultado final: `{ source: 'google', medium: 'cpc', campaign: 'summer' }`

---

### Caso 6: Registro Sem UTM

**Cenário:**
```
Usuário navega sem UTM e se registra
```

**Comportamento:**
1. `getStoredUtmParams()` retorna `null`
2. `signUp()` recebe `utm: undefined`
3. `persistUtmAttribution()` não faz nada (early return)
4. Registro continua normalmente
5. Tabela `utm_attributions` não recebe registro

---

### Caso 7: Registro Falha

**Cenário:**
```
Usuário tenta registrar mas falha (email já existe, etc)
```

**Comportamento:**
1. `signUp()` lança erro
2. `clearUtmParams()` **não é chamado**
3. UTMs permanecem no localStorage
4. Usuário pode tentar novamente com UTMs preservados

---

### Caso 8: LocalStorage Cheio

**Cenário:**
```
LocalStorage está no limite (5-10MB)
```

**Comportamento:**
1. `persistUtmParams()` tenta salvar
2. Lança `QuotaExceededError`
3. Erro é capturado e logado
4. Aplicação continua funcionando
5. UTMs não são salvos (perda silenciosa)

**Solução:**
```typescript
// Adicionar tratamento específico
try {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Tenta limpar outros dados ou usar sessionStorage
    console.error('[utmTracker] LocalStorage cheio, não foi possível salvar UTM');
  }
  throw error;
}
```

---

### Caso 9: SSR (Server-Side Rendering)

**Cenário:**
```
Aplicação roda no servidor (Next.js, etc)
```

**Comportamento:**
1. `isBrowser()` retorna `false` no servidor
2. Todas as funções retornam `null` ou não fazem nada
3. Não quebra a aplicação
4. Funciona normalmente no cliente

---

### Caso 10: Navegação Entre Domínios

**Cenário:**
```
Usuário vem de outro site (referrer)
```

**Comportamento:**
1. `document.referrer` contém URL completa do site anterior
2. Salvo em `referrer` field
3. Útil para análise de tráfego direto

---

## ✅ Testes

### Testes Unitários (Jest)

**Arquivo:** `src/utils/utmTracker.test.ts`

```typescript
import { 
  captureUtmFromUrl, 
  getStoredUtmParams, 
  persistUtmParams, 
  clearUtmParams 
} from './utmTracker';

describe('utmTracker', () => {
  beforeEach(() => {
    // Limpa localStorage antes de cada teste
    localStorage.clear();
    // Mock window.location
    delete (window as any).location;
  });

  describe('captureUtmFromUrl', () => {
    it('deve capturar UTMs da URL', () => {
      // Mock URL com UTMs
      window.location = {
        search: '?utm_source=google&utm_medium=cpc&utm_campaign=summer',
        pathname: '/',
      } as any;

      const result = captureUtmFromUrl();

      expect(result).toBeTruthy();
      expect(result?.utm_source).toBe('google');
      expect(result?.utm_medium).toBe('cpc');
      expect(result?.utm_campaign).toBe('summer');
    });

    it('deve atualizar last_touch_page mesmo sem UTMs', () => {
      // Primeiro, salva UTMs
      persistUtmParams({
        utm_source: 'google',
        capturedAt: new Date().toISOString(),
      });

      // Depois, navega sem UTM
      window.location = {
        search: '',
        pathname: '/dashboard',
      } as any;

      const result = captureUtmFromUrl();

      expect(result?.utm_source).toBe('google');
      expect(result?.last_touch_page).toBe('/dashboard');
    });

    it('deve sobrescrever UTMs expirados (>60 dias)', () => {
      // Salva UTM antigo
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 70); // 70 dias atrás
      
      persistUtmParams({
        utm_source: 'google',
        capturedAt: oldDate.toISOString(),
      });

      // Nova visita com UTM
      window.location = {
        search: '?utm_source=facebook',
        pathname: '/',
      } as any;

      const result = captureUtmFromUrl();

      expect(result?.utm_source).toBe('facebook'); // Sobrescreveu
    });

    it('não deve sobrescrever UTMs válidos (<60 dias)', () => {
      // Salva UTM recente
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 dias atrás
      
      persistUtmParams({
        utm_source: 'google',
        capturedAt: recentDate.toISOString(),
      });

      // Nova visita com UTM diferente
      window.location = {
        search: '?utm_source=facebook',
        pathname: '/',
      } as any;

      const result = captureUtmFromUrl();

      expect(result?.utm_source).toBe('google'); // Manteve original
    });
  });

  describe('getStoredUtmParams', () => {
    it('deve retornar null se não existe', () => {
      const result = getStoredUtmParams();
      expect(result).toBeNull();
    });

    it('deve retornar dados válidos', () => {
      const utm = {
        utm_source: 'google',
        capturedAt: new Date().toISOString(),
      };
      persistUtmParams(utm);

      const result = getStoredUtmParams();
      expect(result?.utm_source).toBe('google');
    });

    it('deve retornar null se expirado', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 70);
      
      persistUtmParams({
        utm_source: 'google',
        capturedAt: oldDate.toISOString(),
      });

      const result = getStoredUtmParams();
      expect(result).toBeNull();
      // Deve ter removido do localStorage
      expect(localStorage.getItem('lush-america:utm-attribution')).toBeNull();
    });
  });

  describe('persistUtmParams', () => {
    it('deve salvar no localStorage', () => {
      const utm = {
        utm_source: 'google',
        capturedAt: new Date().toISOString(),
      };

      persistUtmParams(utm);

      const stored = localStorage.getItem('lush-america:utm-attribution');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.utm_source).toBe('google');
    });

    it('deve normalizar valores', () => {
      const utm = {
        utm_source: '  google  ', // Com espaços
        capturedAt: new Date().toISOString(),
      };

      persistUtmParams(utm);

      const stored = localStorage.getItem('lush-america:utm-attribution');
      const parsed = JSON.parse(stored!);
      expect(parsed.utm_source).toBe('google'); // Sem espaços
    });
  });

  describe('clearUtmParams', () => {
    it('deve remover do localStorage', () => {
      persistUtmParams({
        utm_source: 'google',
        capturedAt: new Date().toISOString(),
      });

      clearUtmParams();

      const stored = localStorage.getItem('lush-america:utm-attribution');
      expect(stored).toBeNull();
    });
  });
});
```

### Testes de Integração

```typescript
// Teste completo do fluxo
describe('Fluxo Completo UTM', () => {
  it('deve capturar, armazenar e persistir UTMs', async () => {
    // 1. Usuário acessa com UTM
    window.location = {
      search: '?utm_source=google&utm_medium=cpc',
      pathname: '/',
    } as any;
    
    captureUtmFromUrl();
    
    // 2. Verifica que foi salvo
    const stored = getStoredUtmParams();
    expect(stored?.utm_source).toBe('google');
    
    // 3. Simula registro
    const utmParams = getStoredUtmParams();
    // ... chama signUp com utmParams
    
    // 4. Verifica que foi limpo
    clearUtmParams();
    const afterClear = getStoredUtmParams();
    expect(afterClear).toBeNull();
  });
});
```

---

## 📝 Checklist de Implementação

### Fase 1: Setup Básico
- [ ] Criar arquivo `src/types/utm.ts` com tipos
- [ ] Criar arquivo `src/utils/utmTracker.ts` com funções
- [ ] Testar funções individualmente no console

### Fase 2: Integração Frontend
- [ ] Integrar `captureUtmFromUrl()` no `App.tsx`
- [ ] Integrar leitura de UTMs na página de registro
- [ ] Integrar limpeza após registro bem-sucedido
- [ ] Testar fluxo completo no navegador

### Fase 3: Banco de Dados
- [ ] Criar migration SQL para tabela `utm_attributions`
- [ ] Executar migration no banco
- [ ] Verificar índices criados
- [ ] Testar inserção manual

### Fase 4: Persistência
- [ ] Criar função `persistUtmAttribution` no hook de auth
- [ ] Integrar chamada após `signUp` bem-sucedido
- [ ] Testar inserção no banco
- [ ] Verificar dados salvos

### Fase 5: Testes
- [ ] Escrever testes unitários
- [ ] Escrever testes de integração
- [ ] Testar edge cases
- [ ] Testar em diferentes navegadores

### Fase 6: Validação
- [ ] Testar com URLs reais de campanhas
- [ ] Verificar dados no banco
- [ ] Validar queries de análise
- [ ] Documentar para equipe

---

## 🎓 Exemplos Práticos

### Exemplo 1: URL de Campanha Google Ads

```
https://seusite.com/?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=translation&utm_content=ad1
```

**Resultado no banco:**
```json
{
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer_sale",
  "utm_term": "translation",
  "utm_content": "ad1",
  "landing_page": "/?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=translation&utm_content=ad1"
}
```

### Exemplo 2: URL de Email Marketing

```
https://seusite.com/?utm_source=newsletter&utm_medium=email&utm_campaign=monthly_update
```

**Resultado no banco:**
```json
{
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "monthly_update",
  "utm_term": null,
  "utm_content": null
}
```

### Exemplo 3: URL de Redes Sociais

```
https://seusite.com/?utm_source=facebook&utm_medium=social&utm_campaign=post_jan_2025
```

**Resultado no banco:**
```json
{
  "utm_source": "facebook",
  "utm_medium": "social",
  "utm_campaign": "post_jan_2025",
  "referrer": "https://www.facebook.com/..."
}
```

---

## 🔍 Debugging

### Como Debugar

1. **Verificar localStorage:**
```javascript
// No console do navegador
localStorage.getItem('lush-america:utm-attribution')
```

2. **Verificar captura:**
```javascript
// No console
import { captureUtmFromUrl } from './utils/utmTracker';
captureUtmFromUrl(); // Retorna dados capturados
```

3. **Verificar dados salvos:**
```sql
-- No banco de dados
SELECT * FROM utm_attributions 
ORDER BY created_at DESC 
LIMIT 10;
```

4. **Logs no código:**
```typescript
// Adicionar logs temporários
console.log('[UTM Debug]', {
  url: window.location.href,
  params: new URLSearchParams(window.location.search).toString(),
  stored: getStoredUtmParams(),
});
```

---

## 📊 Análises e Relatórios

### Query: Taxa de Conversão por Origem

```sql
SELECT 
  utm_source,
  COUNT(*) as total_registros,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
FROM utm_attributions
WHERE utm_source IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY utm_source
ORDER BY total_registros DESC;
```

### Query: ROI por Campanha

```sql
SELECT 
  utm_campaign,
  COUNT(*) as registros,
  COUNT(DISTINCT ua.user_id) as usuarios,
  COALESCE(SUM(p.amount), 0) as receita_total
FROM utm_attributions ua
LEFT JOIN payments p ON p.user_id = ua.user_id
WHERE utm_campaign IS NOT NULL
  AND ua.created_at >= NOW() - INTERVAL '90 days'
GROUP BY utm_campaign
ORDER BY receita_total DESC;
```

---

## 🚨 Troubleshooting

### Problema: UTMs não são capturados

**Soluções:**
1. Verificar se `captureUtmFromUrl()` está sendo chamado
2. Verificar se URL tem parâmetros UTM corretos
3. Verificar console por erros
4. Testar manualmente no console

### Problema: UTMs não são salvos no banco

**Soluções:**
1. Verificar se `persistUtmAttribution` está sendo chamado
2. Verificar logs de erro no console
3. Verificar permissões da tabela (RLS)
4. Testar inserção manual no banco

### Problema: UTMs são sobrescritos incorretamente

**Soluções:**
1. Verificar lógica de `shouldOverrideExisting`
2. Verificar `capturedAt` nos dados
3. Verificar cálculo de TTL (60 dias)
4. Adicionar logs para debug

---

## 📚 Referências

- [Google Analytics UTM Parameters](https://support.google.com/analytics/answer/1033867)
- [UTM Parameter Best Practices](https://www.optimizely.com/optimization-glossary/utm-parameters/)
- [LocalStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

## ✅ Conclusão

Este guia fornece todos os detalhes necessários para replicar o sistema de UTM tracking. O sistema é robusto, trata edge cases e mantém dados consistentes entre frontend e backend.

**Principais pontos a lembrar:**
1. TTL de 60 dias preserva primeira atribuição
2. Falha silenciosa não quebra o fluxo de registro
3. Normalização garante dados limpos
4. Índices otimizam consultas de análise

**Próximos passos sugeridos:**
- Adicionar RLS policies para segurança
- Criar dashboard de análises
- Implementar limpeza periódica de dados antigos
- Adicionar métricas de conversão (UTM → Registro → Pagamento)

---

**Versão:** 1.0  
**Última atualização:** 2025-01-15  
**Autor:** Sistema Lush America Translations

