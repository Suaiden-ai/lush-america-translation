# Documentação de Design e Organização: Dashboard do Afiliado

## Visão Geral

Este documento descreve detalhadamente a estrutura visual, organização e design do dashboard do afiliado, com foco especial na página de Payment Request (Solicitação de Pagamento). A documentação aborda a hierarquia visual, organização de componentes, exibição de datas, cards informativos e fluxo de interação do usuário.

---

## 1. Estrutura Geral do Dashboard

### 1.1 Hierarquia de Páginas

O dashboard do afiliado é organizado em páginas principais:

1. **AffiliateOverview** - Visão geral com estatísticas e progresso
2. **AffiliateEarnings** - Gerenciamento de comissões e solicitações de saque

### 1.2 Layout Base

O layout utiliza um sistema de espaçamento vertical consistente:
- Container principal: `space-y-6` ou `space-y-8` (24px ou 32px entre seções)
- Cards: `rounded-lg` com `shadow-sm` e `border border-gray-200`
- Padding padrão: `p-4`, `p-6` ou `p-8` dependendo do contexto

---

## 2. Página AffiliateOverview (Visão Geral)

### 2.1 Estrutura da Página

A página é dividida em três seções principais, organizadas verticalmente:

```
┌─────────────────────────────────────────┐
│  Stats Cards (Grid 4 colunas)          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │Card│ │Card│ │Card│ │Card│           │
│  └────┘ └────┘ └────┘ └────┘           │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Level Progress Section                 │
│  (Barra de progresso circular)          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  How It Works Section                   │
│  (Informações educativas)               │
└─────────────────────────────────────────┘
```

### 2.2 Stats Cards (Cards de Estatísticas)

**Layout:**
- Grid responsivo: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Gap entre cards: `gap-4` (16px)
- Cada card: `bg-white rounded-lg p-6 shadow-sm border border-gray-200`

**Estrutura Interna de Cada Card:**

```
┌─────────────────────────────┐
│  [Ícone]  Título            │
│            Valor Principal  │
│            Descrição        │
└─────────────────────────────┘
```

**Componentes de Cada Card:**

1. **Container Flex**: `flex items-center justify-between`
   - Lado esquerdo: Informações textuais
   - Lado direito: Ícone em container circular

2. **Área de Informações** (`flex-1 min-w-0`):
   - Título: `text-sm font-medium text-gray-600 mb-1`
   - Valor: `text-2xl font-bold text-gray-900`
   - Descrição: `text-xs text-gray-500 mt-1`

3. **Container de Ícone**:
   - Tamanho: `w-12 h-12` (48px)
   - Background: Varia por card (ex: `bg-green-100`, `bg-orange-100`)
   - Ícone: `w-6 h-6` (24px)

**Cards Disponíveis:**

1. **Available Balance** (Saldo Disponível)
   - Ícone: `DollarSign`
   - Valor: `stats.available_balance.toFixed(2)`
   - Descrição: "Available for withdrawal"

2. **Pending Balance** (Saldo Pendente)
   - Ícone: `Clock`
   - Valor: `stats.pending_balance.toFixed(2)`
   - Descrição: Calculada dinamicamente com contagem regressiva
     - Formato: "Available in X days, Yh Zm" ou "Available in Yh Zm" ou "Available in Zm"
     - Atualização: Baseada em `stats.next_withdrawal_date`

3. **Total Earned** (Total Ganho)
   - Ícone: `TrendingUp`
   - Valor: `stats.total_earned.toFixed(2)`
   - Descrição: "Complete history"

4. **Referred Clients** (Clientes Referenciados)
   - Ícone: `Users`
   - Valor: `stats.total_clients.toString()`
   - Descrição: "Total clients count"

5. **Total Pages** (Total de Páginas)
   - Ícone: `FileText`
   - Valor: `stats.total_pages.toString()`
   - Descrição: "By your clients"

### 2.3 Level Progress Section

**Estrutura:**

```
┌─────────────────────────────────────────┐
│  Título: "Level Progress"                │
│  ┌─────────────────────────────────┐     │
│  │  Badge de Nível                 │     │
│  └─────────────────────────────────┘     │
│  ┌─────────────────────────────────┐     │
│  │  Barra de Progresso Circular    │     │
│  │  (ArcProgressBar)                │     │
│  └─────────────────────────────────┘     │
│  Informações de Progresso                 │
└─────────────────────────────────────────┘
```

**Componentes:**

1. **Container Principal**: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`

2. **Cabeçalho**: Centralizado
   - Título com ícone: `flex items-center justify-center gap-2`
   - Ícone: `TrendingUp w-5 h-5`
   - Texto: `text-lg font-semibold text-gray-900`

3. **Badge de Nível** (`CommissionBadge`):
   - Exibe nível atual (1 ou 2)
   - Taxa de comissão correspondente
   - Texto formatado: "Level X - $Y.XX per page"

4. **Barra de Progresso Circular** (`ArcProgressBar`):
   - Centralizada: `flex justify-center`
   - Mostra progresso em direção ao próximo nível
   - Target: 200 páginas para nível 2

5. **Informações de Progresso**:
   - Se nível 1: Mostra páginas restantes para nível 2
   - Se nível 2: Mostra mensagem de conquista

### 2.4 How It Works Section

**Estrutura:**

```
┌─────────────────────────────────────────┐
│  [Ícone] Título: "How It Works"         │
│  ┌─────────────────┬─────────────────┐  │
│  │ Como Ganhar     │ Regras de Saque │  │
│  │ Comissões       │                 │  │
│  │ • Item 1        │ • Item 1        │  │
│  │ • Item 2        │ • Item 2        │  │
│  │ • Item 3        │ • Item 3        │  │
│  │ • Item 4        │                  │  │
│  └─────────────────┴─────────────────┘  │
└─────────────────────────────────────────┘
```

**Layout:**
- Background: `bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50`
- Border: `border border-tfe-blue-200`
- Padding: `p-6`
- Grid interno: `grid grid-cols-1 md:grid-cols-2 gap-6`

**Conteúdo:**
- Lista de itens com bullets (`•`)
- Texto: `text-sm text-gray-700 space-y-1`

---

## 3. Página AffiliateEarnings (Comissões e Saques)

### 3.1 Estrutura Geral da Página

```
┌─────────────────────────────────────────┐
│  Header (Título e Descrição)             │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Stats Cards (Grid 4 colunas)           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │Card│ │Card│ │Card│ │Card│           │
│  └────┘ └────┘ └────┘ └────┘           │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  WithdrawalTimer Component               │
│  (Status de disponibilidade)             │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Tab Navigation                          │
│  [Commissions] [Withdrawals]             │
│  ┌─────────────────────────────────┐     │
│  │  Conteúdo da Tab Ativa          │     │
│  └─────────────────────────────────┘     │
└─────────────────────────────────────────┘
```

### 3.2 Header Section

**Layout:**
- Container: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`
- Responsivo: Em mobile, elementos empilham verticalmente

**Elementos:**

1. **Título e Descrição**:
   - Título: `text-xl font-semibold text-gray-900`
   - Descrição: `text-gray-600`

### 3.3 Stats Cards na Página Earnings

**Diferenças em relação ao Overview:**

Os cards aqui são mais compactos e focados em informações de saque:

**Layout:**
- Grid: `grid grid-cols-1 md:grid-cols-4 gap-4`
- Padding: `p-4` (menor que no Overview)
- Estrutura interna: `flex items-center gap-3`

**Cards Específicos:**

1. **Available for Withdrawal**:
   - Ícone: `CreditCard` em container `bg-purple-100`
   - Valor: `text-xl font-bold` (menor que no Overview)
   - Subtítulo: "Ready to withdraw" (`text-xs text-gray-500`)

2. **Pending Balance**:
   - Ícone: `Clock` em container `bg-orange-100`
   - Valor: `text-xl font-bold`
   - Subtítulo: Contagem regressiva formatada
     - Lógica: Calcula diferença entre `next_withdrawal_date` e agora
     - Formato dinâmico baseado no tempo restante:
       - Se > 0 dias: "Available in X days, Yh Zm"
       - Se 0 dias mas > 0 horas: "Available in Yh Zm"
       - Se 0 horas mas > 0 minutos: "Available in Zm"
       - Se <= 0: "Available now"

3. **Confirmed Commissions**:
   - Ícone: `CheckCircle` em container `bg-green-100`
   - Valor: Soma de todas as comissões confirmadas

4. **Reversed Commissions**:
   - Ícone: `XCircle` em container `bg-red-100`
   - Valor: Soma de todas as comissões revertidas

### 3.4 WithdrawalTimer Component

**Posicionamento:**
- Localizado entre os stats cards e a navegação de tabs
- Espaçamento: `space-y-6` do container pai

**Estrutura Visual:**

```
┌─────────────────────────────────────────┐
│  [Ícone] Status Text                    │
│           Time Left / Message           │
│           [Indicador] Ready (se ativo)  │
└─────────────────────────────────────────┘
```

**Estados Visuais:**

1. **Sem Primeira Venda** (`firstPageTranslatedAt === null`):
   - Background: `bg-gray-50 border border-gray-200`
   - Ícone: `AlertCircle` (cinza)
   - Mensagem: "No translated pages yet"
   - Subtítulo: "Start earning to unlock withdrawals"

2. **Disponível para Saque** (`isAvailable === true`):
   - Background: `bg-green-50 border-green-200`
   - Ícone: `CheckCircle` (verde)
   - Texto principal: "Withdrawal Available"
   - Subtítulo: "Withdrawal available now"
   - Indicador: Ponto verde pulsante + texto "Ready"

3. **Aguardando Período** (`isAvailable === false`):
   - Background: `bg-yellow-50 border-yellow-200`
   - Ícone: `Clock` (amarelo)
   - Texto principal: "Withdrawal Not Available"
   - Subtítulo: Contagem regressiva formatada
     - Formato: "Available in X days, Y hours, Z minutes"
     - Atualização: A cada minuto (`setInterval(60000)`)

**Lógica de Cálculo:**

```typescript
// Calcula diferença entre primeira venda e agora
const diffInMs = now.getTime() - firstPageDate.getTime();
const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

// Se >= 30 dias, disponível
if (diffInDays >= 30) {
  setIsAvailable(true);
} else {
  // Calcula tempo restante
  const remainingDays = 30 - diffInDays - 1;
  // ... formata mensagem
}
```

### 3.5 Tab Navigation

**Estrutura:**

```
┌─────────────────────────────────────────┐
│  ┌──────────────┬──────────────┐        │
│  │ Commissions  │ Withdrawals  │        │
│  └──────────────┴──────────────┘        │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │  Conteúdo da Tab Ativa          │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Container Principal:**
- Background: `bg-white rounded-lg shadow-sm border border-gray-200`
- Tab bar: `border-b border-gray-200`
- Conteúdo: `p-6`

**Navegação de Tabs:**

- Container: `-mb-px flex space-x-8 px-6`
- Cada botão: `py-4 px-1 border-b-2 font-medium text-sm`
- Estado ativo:
  - Border: `border-tfe-blue-500`
  - Texto: `text-tfe-blue-600`
- Estado inativo:
  - Border: `border-transparent`
  - Texto: `text-gray-500`
  - Hover: `hover:text-gray-700 hover:border-gray-300`

**Tabs Disponíveis:**

1. **Commissions** (`activeTab === 'commissions'`)
2. **Withdrawals** (`activeTab === 'withdrawals'`)

---

## 4. Tab: Commissions (Comissões)

### 4.1 Estrutura do Conteúdo

```
┌─────────────────────────────────────────┐
│  Filtros e Ordenação                    │
│  [Busca] [Status] [Ordenar] [↑↓]       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Tabela de Comissões                    │
│  ┌──────┬──────┬──────┬──────┬──────┐  │
│  │Client│Pages │Rate  │Amount│Status│  │
│  ├──────┼──────┼──────┼──────┼──────┤  │
│  │ ...  │ ...  │ ...  │ ...  │ ...  │  │
│  └──────┴──────┴──────┴──────┴──────┘  │
└─────────────────────────────────────────┘
```

### 4.2 Filtros e Ordenação

**Layout:**
- Container: `flex flex-col sm:flex-row gap-4`
- Em mobile: Elementos empilham verticalmente
- Em desktop: Elementos em linha horizontal

**Componentes:**

1. **Campo de Busca**:
   - Container: `flex-1 relative`
   - Ícone: `Search` posicionado absolutamente à esquerda (`absolute left-3`)
   - Input: `w-full pl-10 pr-4 py-2`
   - Placeholder: "Search by client..."
   - Border: `border border-gray-300 rounded-lg`
   - Focus: `focus:ring-2 focus:ring-tfe-blue-500`

2. **Filtro de Status**:
   - Select dropdown
   - Opções: "All Status", "Confirmed", "Reversed"
   - Estilo: `px-3 py-2 border border-gray-300 rounded-lg`

3. **Ordenação**:
   - Select para campo: "Date", "Amount", "Client"
   - Botão de direção: `↑` (asc) ou `↓` (desc)
   - Estilo: `px-3 py-2 border border-gray-300 rounded-lg`

### 4.3 Tabela de Comissões

**Estrutura:**

```
┌─────────────────────────────────────────────────────────────┐
│  Header Row (bg-gray-50)                                    │
│  Client | Pages | Rate | Amount | Status | Date            │
├─────────────────────────────────────────────────────────────┤
│  Data Rows (hover:bg-gray-50)                               │
│  [Avatar] Name | [Icon] # | $X.XX | Badge | [Icon] Date   │
└─────────────────────────────────────────────────────────────┘
```

**Colunas:**

1. **Client**:
   - Layout: `flex items-center`
   - Avatar: `w-8 h-8 bg-gray-200 rounded-full` com ícone `User`
   - Nome: `text-sm font-medium text-gray-900 ml-3`

2. **Pages**:
   - Layout: `flex items-center gap-1`
   - Ícone: `FileText w-4 h-4 text-gray-400`
   - Número: `text-sm text-gray-900`

3. **Rate**:
   - Valor: `font-medium` com `$X.XX`
   - Subtítulo: `/page` em `text-xs text-gray-500`
   - Nível: `text-xs text-gray-500` com "Level X"

4. **Amount**:
   - Valor: `font-medium` com cor condicional:
     - Confirmed: `text-green-600`
     - Reversed: `text-red-600`
     - Outros: `text-gray-600`

5. **Status**:
   - Badge: `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border`
   - Cores por status:
     - Confirmed: `bg-green-100 text-green-800 border-green-200`
     - Reversed: `bg-red-100 text-red-800 border-red-200`
     - Outros: `bg-yellow-100 text-yellow-800 border-yellow-200`
   - Ícone: `CheckCircle`, `XCircle` ou `AlertCircle`
   - Motivo de reversão (se houver): `text-xs text-red-600 mt-1`

6. **Date**:
   - Layout: `flex items-center gap-1`
   - Ícone: `Calendar w-4 h-4 text-gray-400`
   - Data formatada: `formatDate(commission.created_at)`
   - Data de reversão (se houver): `text-xs text-red-600 mt-1`

**Estados Vazios:**

1. **Sem resultados com filtros aplicados**:
   - Ícone: `Search w-8 h-8 text-gray-400`
   - Mensagem: "No commissions found with the applied filters"

2. **Sem comissões**:
   - Ícone: `DollarSign w-8 h-8 text-gray-400` em círculo
   - Título: "No commissions found"
   - Descrição: Mensagem explicativa

---

## 5. Tab: Withdrawals (Solicitações de Saque)

### 5.1 Estrutura do Conteúdo

```
┌─────────────────────────────────────────┐
│  Header com Botão de Nova Solicitação   │
│  [Título]              [+ Request]      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Tabela de Solicitações                 │
│  ┌──────┬──────┬──────┬──────┬──────┐  │
│  │Amount│Method│Details│Status│Date │  │
│  ├──────┼──────┼──────┼──────┼──────┤  │
│  │ ...  │ ...  │ ...  │ ...  │ ...  │  │
│  └──────┴──────┴──────┴──────┴──────┘  │
└─────────────────────────────────────────┘
```

### 5.2 Header Section

**Layout:**
- Container: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`
- Lado esquerdo: Título e descrição
- Lado direito: Botão de ação

**Botão "Request New Withdrawal":**

- Layout: `flex items-center gap-2 px-4 py-2 rounded-lg`
- Estado ativo (saldo > 0):
  - Background: `bg-tfe-blue-600`
  - Texto: `text-white`
  - Hover: `hover:bg-tfe-blue-700`
- Estado desabilitado (saldo <= 0):
  - Background: `bg-gray-300`
  - Texto: `text-gray-500`
  - Cursor: `cursor-not-allowed`
- Ícone: `Plus w-4 h-4`

### 5.3 Tabela de Solicitações

**Estrutura:**

```
┌─────────────────────────────────────────────────────────────┐
│  Header Row (bg-gray-50)                                    │
│  Amount | Method | Details | Status | Date | Actions       │
├─────────────────────────────────────────────────────────────┤
│  Data Rows (hover:bg-gray-50)                               │
│  $X.XX | [Icon] Method | Truncated | Badge | [Icon] Date | │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Colunas:**

1. **Amount**:
   - Formato: `$X.XX` com `font-medium`

2. **Payment Method**:
   - Layout: `flex items-center gap-2`
   - Ícone: `CreditCard w-4 h-4 text-gray-400`
   - Texto: Capitalizado (ex: "Bank Transfer")

3. **Payment Details**:
   - Container: `max-w-xs truncate`
   - Formato baseado no método:
     - Zelle: Email ou telefone
     - Bank Transfer: "Bank Name - Account Number"
     - Stripe: Email
     - Other: Detalhes customizados

4. **Status**:
   - Badge com ícone e cor:
     - Approved/Completed: Verde
     - Rejected: Vermelho
     - Pending: Amarelo

5. **Request Date**:
   - Layout: `flex items-center gap-1`
   - Ícone: `Calendar w-4 h-4 text-gray-400`
   - Data formatada: `formatDate(request.requested_at)`

6. **Actions**:
   - Botão: "View Details"
   - Estilo: `text-tfe-blue-600 hover:text-tfe-blue-900`
   - Ícone: `Eye w-4 h-4`

**Estado Vazio:**

- Container: `bg-gray-50 rounded-lg p-8 text-center`
- Ícone: `Clock w-8 h-8 text-gray-400` em círculo
- Título: "No withdrawal requests yet"
- Descrição: Mensagem explicativa

---

## 6. Modal: Nova Solicitação de Saque

### 6.1 Estrutura do Modal

**Overlay:**
- Position: `fixed inset-0`
- Background: `bg-black bg-opacity-50`
- Z-index: `z-[9999]`
- Scroll: `overflow-y-auto`

**Container do Modal:**
- Position: `relative top-20 mx-auto`
- Width: Responsivo
  - Mobile: `w-11/12` (91.67%)
  - Tablet: `md:w-1/2` (50%)
  - Desktop: `lg:w-1/3` (33.33%)
- Background: `bg-white`
- Border: `border`
- Shadow: `shadow-lg`
- Border radius: `rounded-md`
- Padding: `p-5`

### 6.2 Header do Modal

**Layout:**
- Container: `flex items-center justify-between mb-4`
- Título: `text-lg font-semibold text-gray-900`
- Botão fechar: `text-gray-400 hover:text-gray-600`
- Ícone: `XCircle w-6 h-6`

### 6.3 Estados do Modal

#### 6.3.1 Estado de Sucesso

Após envio bem-sucedido:

```
┌─────────────────────────────────────────┐
│  [Ícone CheckCircle]                    │
│  Título: "Request Sent!"                │
│  Mensagem de confirmação                │
└─────────────────────────────────────────┘
```

- Ícone: `CheckCircle w-8 h-8 text-green-600` em círculo verde
- Auto-fechamento: Após 2 segundos

#### 6.3.2 Estado de Formulário

**Estrutura:**

```
┌─────────────────────────────────────────┐
│  Balance Cards (Grid 2 colunas)         │
│  ┌──────────────┬──────────────┐        │
│  │ Available    │ Pending      │        │
│  │ $X.XX        │ $X.XX        │        │
│  │              │ Time info    │        │
│  └──────────────┴──────────────┘        │
│  Amount Input                            │
│  Payment Method Select                   │
│  Payment Details (dinâmico)              │
│  Error Messages (se houver)              │
│  [Cancel] [Request Withdrawal]           │
└─────────────────────────────────────────┘
```

### 6.4 Balance Cards no Modal

**Layout:**
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-4`

**Card 1: Available Balance**
- Background: `bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50`
- Border: `border border-tfe-blue-200`
- Padding: `p-4`
- Layout interno: `flex items-center justify-between`
- Ícone: `DollarSign` em círculo `w-12 h-12`
- Valor: `text-2xl font-bold`

**Card 2: Pending Balance**
- Background: `bg-gradient-to-r from-orange-50 to-yellow-50`
- Border: `border border-orange-200`
- Estrutura similar ao Card 1
- Informação adicional: Contagem regressiva formatada
  - Formato: Mesma lógica dos stats cards
  - Tamanho: `text-xs text-gray-600`

### 6.5 Campos do Formulário

**Espaçamento:** `space-y-6` entre campos

**1. Amount (Valor):**
- Label: `block text-sm font-medium text-gray-700 mb-2`
- Input container: `relative`
- Ícone prefix: `DollarSign` posicionado à esquerda
- Input: `w-full pl-10 pr-3 py-2`
- Type: `number` com `step="0.01"` e `min="0.01"`
- Max: `stats.available_balance`
- **Validação de Valor:**
  - **Mínimo:** $0.01 (o afiliado pode solicitar qualquer valor acima deste mínimo)
  - **Máximo:** Saldo disponível (não pode exceder o saldo)
  - **Importante:** O afiliado pode solicitar qualquer valor entre o mínimo e o máximo. **Não é obrigatório solicitar todo o saldo disponível.** Ele pode fazer saques parciais múltiplos.
- Validação visual:
  - Erro: `border-red-500 bg-red-50`
  - Normal: `border-gray-300`
- Mensagem de erro: `text-sm text-red-600`
- Hint: `text-xs text-gray-500` com máximo permitido

**2. Payment Method (Método de Pagamento):**
- Select dropdown
- Opções: Zelle, Bank Transfer, Stripe, Other
- Estilo padrão de select

**3. Payment Details (Detalhes - Dinâmico):**

Baseado no método selecionado:

**Zelle:**
- Input único
- Aceita email ou telefone
- Detecção automática: Se contém "@", é email; senão, telefone
- Placeholder: "example@email.com or +1234567890"

**Bank Transfer:**
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Campos:
  - Bank Name (obrigatório)
  - Account Number (obrigatório)
  - Agency (opcional)
  - Account Holder (obrigatório)

**Stripe:**
- Input de email único
- Placeholder: "example@email.com"

**Other:**
- Textarea
- Rows: `3`
- Placeholder: "Describe how you would like to receive the payment..."

### 6.6 Botões de Ação

**Layout:** `flex justify-end gap-3`

**Botão Cancel:**
- Estilo: `px-4 py-2 border border-gray-300 rounded-lg`
- Hover: `hover:bg-gray-50`

**Botão Submit:**
- Estilo: `px-6 py-2 bg-tfe-blue-600 text-white rounded-lg`
- Hover: `hover:bg-tfe-blue-700`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`
- Estados:
  - Normal: "Request Withdrawal"
  - Submitting: "Sending..."

---

## 7. Modal: Detalhes da Solicitação

### 7.1 Estrutura do Modal

**Overlay:** Similar ao modal de nova solicitação

**Container:**
- Width: `max-w-2xl w-full`
- Position: `flex min-h-full items-center justify-center p-4`
- Background: `bg-white rounded-lg shadow-xl`

### 7.2 Seções do Modal

**Header:**
- Border bottom: `border-b border-gray-200`
- Padding: `p-6`
- Layout: `flex items-center justify-between`

**Content:**
- Padding: `p-6`
- Espaçamento: `space-y-6`

**Footer:**
- Border top: `border-t border-gray-200`
- Padding: `p-6`
- Alinhamento: `flex justify-end`

### 7.3 Informações Exibidas

**1. Basic Info (Grid 2 colunas):**
- Request ID (monospace)
- Amount (font-semibold)
- Payment Method (capitalized)
- Status (badge com ícone)

**2. Payment Details:**
- Container: `bg-gray-50 rounded-lg p-4`
- Layout: `space-y-2` com `flex justify-between` para cada campo
- Campos dinâmicos baseados no método

**3. Dates (Grid 2 colunas):**
- Requested At
- Processed At (se disponível)

**4. Admin Notes (se houver):**
- Container: `bg-yellow-50 border border-yellow-200 rounded-lg p-4`
- Texto: `text-sm text-gray-900`

---

## 8. Formatação de Datas

### 8.1 Função de Formatação

A função `formatDate` é utilizada consistentemente em toda a aplicação para exibir datas.

**Localização:** `src/utils/dateUtils.ts`

**Implementação:**
```typescript
export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
}
```

**Formato de Saída:** MM/DD/YYYY (exemplo: "01/15/2024")

**Uso:**
```typescript
formatDate(commission.created_at)
formatDate(request.requested_at)
formatDate(selectedWithdrawal.processed_at)
```

**Funções Adicionais Disponíveis:**

1. **formatDateTime**: Formata data com hora (MM/DD/YYYY HH:MM)
2. **formatTimeAgo**: Formata como tempo relativo ("2 days ago")

### 8.2 Onde Datas São Exibidas

1. **Tabela de Comissões:**
   - Coluna "Date": Data de criação da comissão
   - Linha adicional (se revertida): Data de reversão

2. **Tabela de Solicitações:**
   - Coluna "Request Date": Data da solicitação

3. **Modal de Detalhes:**
   - Seção "Dates": Data de solicitação e processamento

4. **Stats Cards:**
   - Não exibem datas diretamente, mas calculam diferenças temporais

### 8.3 Exibição de Tempo Relativo

**Contagem Regressiva:**
- Formato: "Available in X days, Yh Zm"
- Cálculo baseado em `next_withdrawal_date`
- Atualização: Dinâmica (não em tempo real, mas recalculada a cada render)

**Lógica de Formatação:**

```typescript
const diffInMs = withdrawalDate.getTime() - now.getTime();
const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

// Formatação condicional:
if (diffInDays > 0) {
  return `${diffInDays} days, ${diffInHours}h ${diffInMinutes}m`;
} else if (diffInHours > 0) {
  return `${diffInHours}h ${diffInMinutes}m`;
} else {
  return `${diffInMinutes}m`;
}
```

---

## 9. Estados de Loading e Erro

### 9.1 Loading State

**AffiliateOverview:**
- Grid de cards com skeleton: `animate-pulse`
- Cards: `bg-gray-200 rounded` com altura variável

**AffiliateEarnings:**
- Similar ao Overview
- Grid de 4 cards com skeleton

### 9.2 Error State

**Container:**
- Background: `bg-red-50 border border-red-200`
- Padding: `p-4`
- Texto: `text-red-600`

### 9.3 Empty States

**Sem dados:**
- Container centralizado: `text-center py-12`
- Ícone em círculo: `w-16 h-16 bg-gray-100 rounded-full`
- Título: `text-lg font-medium text-gray-900 mb-2`
- Descrição: `text-gray-600`

**Sem resultados de busca:**
- Container: `text-center py-8`
- Ícone: `Search w-8 h-8 text-gray-400`
- Mensagem: `text-gray-500`

---

## 10. Responsividade

### 10.1 Breakpoints Utilizados

- **Mobile First**: Design baseado em mobile
- **sm**: 640px (tablets pequenos)
- **md**: 768px (tablets)
- **lg**: 1024px (desktops)

### 10.2 Adaptações Responsivas

**Stats Cards:**
- Mobile: `grid-cols-1` (1 coluna)
- Tablet: `md:grid-cols-2` (2 colunas)
- Desktop: `lg:grid-cols-4` (4 colunas)

**Filtros:**
- Mobile: `flex-col` (empilhados)
- Desktop: `sm:flex-row` (em linha)

**Modal:**
- Mobile: `w-11/12` (91.67% da largura)
- Tablet: `md:w-1/2` (50%)
- Desktop: `lg:w-1/3` (33.33%)

**Header Sections:**
- Mobile: `flex-col` (empilhados)
- Desktop: `sm:flex-row` (em linha)

---

## 11. Hierarquia Visual e Espaçamento

### 11.1 Sistema de Espaçamento

**Vertical (space-y):**
- `space-y-6`: 24px entre elementos principais
- `space-y-8`: 32px entre seções grandes
- `space-y-4`: 16px entre elementos relacionados
- `space-y-2`: 8px entre itens de lista

**Horizontal (gap):**
- `gap-4`: 16px padrão
- `gap-3`: 12px para elementos próximos
- `gap-2`: 8px para elementos muito próximos
- `gap-1`: 4px para ícones e texto

**Padding:**
- `p-8`: 32px (containers grandes, empty states)
- `p-6`: 24px (cards principais, modais)
- `p-4`: 16px (cards compactos, inputs)
- `p-3`: 12px (elementos pequenos)

### 11.2 Hierarquia Tipográfica

**Títulos:**
- `text-xl font-semibold`: Títulos de página
- `text-lg font-semibold`: Títulos de seção
- `text-lg font-medium`: Subtítulos importantes

**Valores:**
- `text-2xl font-bold`: Valores principais (stats cards)
- `text-xl font-bold`: Valores secundários
- `font-medium`: Valores em tabelas

**Texto Corpo:**
- `text-sm`: Texto padrão
- `text-xs`: Texto secundário, hints, descrições

### 11.3 Bordas e Sombras

**Bordas:**
- `border border-gray-200`: Borda padrão
- `border-b border-gray-200`: Separador horizontal
- `border-t border-gray-200`: Separador superior

**Sombras:**
- `shadow-sm`: Sombra sutil (cards)
- `shadow-lg`: Sombra média (modais)
- `shadow-xl`: Sombra forte (modais de detalhes)

**Border Radius:**
- `rounded-lg`: 8px (cards, inputs)
- `rounded-md`: 6px (modais)
- `rounded-full`: 50% (avatares, badges circulares)

---

## 12. Ícones e Indicadores Visuais

### 12.1 Ícones Utilizados

**Lucide React Icons:**
- `DollarSign`: Dinheiro, saldo
- `CreditCard`: Métodos de pagamento
- `Clock`: Tempo, pendências
- `CheckCircle`: Confirmação, sucesso
- `XCircle`: Erro, reversão, fechar
- `AlertCircle`: Avisos
- `Search`: Busca
- `Calendar`: Datas
- `User`: Clientes
- `FileText`: Páginas, documentos
- `Eye`: Visualizar detalhes
- `Plus`: Adicionar, criar novo
- `TrendingUp`: Progresso, crescimento
- `Users`: Clientes, pessoas
- `Star`: Conquistas

### 12.2 Tamanhos de Ícones

- `w-8 h-8`: Ícones grandes (empty states)
- `w-6 h-6`: Ícones médios (cards, modais)
- `w-5 h-5`: Ícones padrão (títulos, seções)
- `w-4 h-4`: Ícones pequenos (tabelas, badges)

### 12.3 Indicadores de Status

**Badges:**
- Formato: `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border`
- Cores por status (conforme seção 4.3 e 5.3)

**Indicador Pulsante:**
- Apenas no WithdrawalTimer quando disponível
- `w-2 h-2 bg-green-500 rounded-full animate-pulse`

---

## 13. Fluxo de Interação do Usuário

### 13.1 Navegação entre Tabs

1. Usuário clica em tab "Commissions" ou "Withdrawals"
2. Estado `activeTab` é atualizado
3. Conteúdo da tab ativa é renderizado
4. Visual da tab ativa muda (borda azul, texto azul)

### 13.2 Criação de Nova Solicitação

1. Usuário clica em "Request New Withdrawal"
2. Modal é aberto (`showWithdrawalModal = true`)
3. Usuário preenche formulário:
   - Seleciona valor (validação em tempo real)
   - Seleciona método de pagamento
   - Preenche detalhes (campos dinâmicos)
4. Usuário clica em "Request Withdrawal"
5. Validação do formulário
6. Se válido: Envio para backend
7. Estado de sucesso é exibido
8. Modal fecha automaticamente após 2 segundos
9. Lista de solicitações é atualizada

### 13.3 Visualização de Detalhes

1. Usuário clica em "View Details" em uma solicitação
2. Modal de detalhes é aberto (`showDetailsModal = true`)
3. Informações completas são exibidas
4. Usuário clica em "Close" ou no X
5. Modal é fechado

### 13.4 Filtros e Busca

1. Usuário digita no campo de busca
2. Lista é filtrada em tempo real (`filteredCommissions`)
3. Usuário seleciona filtro de status
4. Lista é filtrada novamente
5. Usuário seleciona ordenação
6. Lista é ordenada
7. Usuário clica no botão de direção (↑↓)
8. Ordem é invertida

---

## 14. Considerações de Acessibilidade

### 14.1 Navegação por Teclado

- Todos os botões são focáveis
- Tabs são navegáveis com setas
- Modais podem ser fechados com ESC (se implementado)

### 14.2 Feedback Visual

- Estados hover em todos os elementos interativos
- Estados disabled claramente visíveis
- Mensagens de erro próximas aos campos
- Indicadores de loading durante operações

### 14.3 Contraste e Legibilidade

- Texto principal: `text-gray-900` (alto contraste)
- Texto secundário: `text-gray-600` (contraste médio)
- Texto terciário: `text-gray-500` (contraste baixo, apenas hints)

---

## 15. Conclusão

O dashboard do afiliado foi projetado com foco em:

1. **Clareza**: Informações importantes são destacadas visualmente
2. **Organização**: Hierarquia clara com seções bem definidas
3. **Responsividade**: Adaptação fluida a diferentes tamanhos de tela
4. **Feedback**: Estados visuais claros para todas as ações
5. **Consistência**: Padrões visuais aplicados uniformemente
6. **Usabilidade**: Fluxos de interação intuitivos e diretos

A estrutura modular permite fácil manutenção e extensão, enquanto o sistema de design consistente garante uma experiência coesa em toda a aplicação.
