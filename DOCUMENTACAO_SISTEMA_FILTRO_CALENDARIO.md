# Documentação Técnica: Sistema de Filtro por Calendário

## 1. Visão Geral

O sistema de filtro por calendário permite aos usuários selecionar períodos de datas para filtrar dados em diferentes partes da aplicação. O sistema oferece duas modalidades principais:

- **Períodos pré-definidos (Presets)**: Seleção rápida de períodos comuns (hoje, últimos 7 dias, últimos 30 dias, etc.)
- **Período personalizado (Custom)**: Seleção manual de data de início e data de fim através de campos de entrada de data nativos do HTML5

O componente principal é o `GoogleStyleDatePicker`, que implementa uma interface modal com dropdown, oferecendo uma experiência de usuário similar ao Google Analytics.

---

## 2. Arquitetura e Estrutura de Dados

### 2.1. Interface DateRange

A estrutura de dados central do sistema é a interface `DateRange`, definida em `src/components/DateRangeFilter.tsx`:

```typescript
export interface DateRange {
  startDate: Date | null;  // Data de início do período (pode ser null para "All time")
  endDate: Date | null;    // Data de fim do período (pode ser null para "All time")
  preset?: string;          // Identificador do preset selecionado ('all', 'today', '7d', '30d', 'custom', etc.)
}
```

**Características importantes:**
- `startDate` e `endDate` são objetos JavaScript `Date` ou `null`
- Quando ambos são `null`, representa "All time" (sem filtro de data)
- O campo `preset` é opcional e armazena qual preset foi selecionado para facilitar a formatação da exibição

### 2.2. Componentes Principais

O sistema é composto por múltiplos componentes, cada um com propósitos específicos:

| Componente | Localização | Propósito |
|------------|-------------|-----------|
| `GoogleStyleDatePicker` | `src/components/GoogleStyleDatePicker.tsx` | Componente principal com modal dropdown estilo Google |
| `DateRangeFilter` | `src/components/DateRangeFilter.tsx` | Componente alternativo com select de presets e inputs inline |
| `CustomDateRangePicker` | `src/components/CustomDateRangePicker.tsx` | Variação do componente principal com layout diferente |
| `SimpleDateRangePicker` | `src/components/SimpleDateRangePicker.tsx` | Versão simplificada do picker |

---

## 3. Implementação do GoogleStyleDatePicker

### 3.1. Estrutura do Componente

O `GoogleStyleDatePicker` é um componente React funcional que utiliza hooks para gerenciamento de estado:

```typescript
interface GoogleStyleDatePickerProps {
  dateRange: DateRange;                                    // Estado atual do filtro
  onDateRangeChange: (dateRange: DateRange) => void;      // Callback para atualizar o filtro
  className?: string;                                      // Classes CSS opcionais
}
```

### 3.2. Estados Internos

O componente mantém os seguintes estados locais:

```typescript
const [isOpen, setIsOpen] = useState(false);              // Controla abertura/fechamento do modal
const [tempStartDate, setTempStartDate] = useState<string>('');  // Data de início temporária (formato YYYY-MM-DD)
const [tempEndDate, setTempEndDate] = useState<string>('');      // Data de fim temporária (formato YYYY-MM-DD)
const [openUpward, setOpenUpward] = useState(false);     // Controla se o dropdown abre para cima
const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);  // Referência ao botão para cálculo de posição
```

**Por que estados temporários?**
- Os estados `tempStartDate` e `tempEndDate` são strings no formato `YYYY-MM-DD` (formato aceito por inputs `type="date"`)
- Permitem que o usuário edite as datas sem aplicar imediatamente
- Só são aplicados quando o usuário clica em "Apply"
- Isso permite cancelar a edição sem afetar o estado global

### 3.3. Sincronização de Estado

O componente sincroniza os estados temporários com o `dateRange` recebido via props através de um `useEffect`:

```typescript
useEffect(() => {
  if (dateRange.startDate) {
    setTempStartDate(dateRange.startDate.toISOString().split('T')[0]);
  } else {
    setTempStartDate('');
  }
  
  if (dateRange.endDate) {
    setTempEndDate(dateRange.endDate.toISOString().split('T')[0]);
  } else {
    setTempEndDate('');
  }
}, [dateRange]);
```

**Conversão de formato:**
- `Date.toISOString()` retorna uma string no formato `YYYY-MM-DDTHH:mm:ss.sssZ`
- `.split('T')[0]` extrai apenas a parte da data (`YYYY-MM-DD`)
- Este formato é compatível com inputs HTML5 `type="date"`

### 3.4. Posicionamento Inteligente do Dropdown

O componente implementa lógica para detectar se há espaço suficiente abaixo do botão e, caso contrário, abre o dropdown para cima:

```typescript
const checkPosition = () => {
  if (!buttonRef) return;
  
  const rect = buttonRef.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const dropdownHeight = 400; // Altura aproximada do dropdown
  
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  
  setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight);
};
```

**Eventos monitorados:**
- `resize`: Recalcula posição quando a janela é redimensionada
- `scroll`: Recalcula posição quando a página é rolada
- Ambos são removidos no cleanup do `useEffect` para evitar memory leaks

---

## 4. Lógica de Presets

### 4.1. Presets Disponíveis

O componente oferece os seguintes presets pré-definidos:

```typescript
const presets = [
  { value: 'all', label: 'All time', icon: '📅' },
  { value: 'today', label: 'Today', icon: '📆' },
  { value: 'yesterday', label: 'Yesterday', icon: '📅' },
  { value: '7d', label: 'Last 7 days', icon: '📊' },
  { value: '30d', label: 'Last 30 days', icon: '📈' },
  { value: '90d', label: 'Last 90 days', icon: '📉' },
  { value: 'year', label: 'This year', icon: '🗓️' }
];
```

### 4.2. Cálculo de Datas dos Presets

A função `handlePresetClick` calcula as datas baseadas no preset selecionado:

```typescript
const handlePresetClick = (preset: string) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let newStartDate: Date | null = null;
  let newEndDate: Date | null = now;

  switch (preset) {
    case 'today':
      newStartDate = new Date(startOfToday);
      newEndDate = new Date(startOfToday);
      break;
    case 'yesterday':
      newStartDate = new Date(startOfToday);
      newStartDate.setDate(startOfToday.getDate() - 1);
      newEndDate = new Date(startOfToday);
      newEndDate.setDate(startOfToday.getDate() - 1);
      break;
    case '7d':
      newStartDate = new Date(startOfToday);
      newStartDate.setDate(startOfToday.getDate() - 7);
      break;
    case '30d':
      newStartDate = new Date(startOfToday);
      newStartDate.setDate(startOfToday.getDate() - 30);
      break;
    case '90d':
      newStartDate = new Date(startOfToday);
      newStartDate.setDate(startOfToday.getDate() - 90);
      break;
    case 'year':
      newStartDate = new Date(now.getFullYear(), 0, 1); // 1º de janeiro
      break;
    case 'all':
    default:
      newStartDate = null;
      newEndDate = null;
      preset = 'all';
  }

  onDateRangeChange({
    startDate: newStartDate,
    endDate: newEndDate,
    preset
  });
  setIsOpen(false);
};
```

**Pontos importantes:**
- `startOfToday` é criado sem horas/minutos/segundos para garantir início do dia
- Para períodos relativos (7d, 30d, 90d), a data de início é calculada subtraindo dias da data atual
- Para "This year", a data de início é fixada em 1º de janeiro do ano atual
- Para "All time", ambas as datas são `null`

---

## 5. Período Personalizado (Custom)

### 5.1. Entrada de Datas

O componente utiliza inputs HTML5 nativos `type="date"` para entrada de datas:

```typescript
<input
  type="date"
  value={tempStartDate}
  onChange={(e) => setTempStartDate(e.target.value)}
  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
  max={tempEndDate || new Date().toISOString().split('T')[0]}
/>
```

**Validações nativas:**
- `max={tempEndDate || ...}`: Impede selecionar data de início posterior à data de fim
- `min={tempStartDate}`: Impede selecionar data de fim anterior à data de início
- `max={new Date().toISOString().split('T')[0]}`: Impede selecionar datas futuras

### 5.2. Aplicação do Período Personalizado

Quando o usuário clica em "Apply", a função `handleCustomDateApply` é executada:

```typescript
const handleCustomDateApply = () => {
  // Criar datas no timezone local para evitar problemas de conversão UTC
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (tempStartDate) {
    const [year, month, day] = tempStartDate.split('-').map(Number);
    startDate = new Date(year, month - 1, day, 0, 0, 0, 0); // Criar no timezone local
  }

  if (tempEndDate) {
    const [year, month, day] = tempEndDate.split('-').map(Number);
    endDate = new Date(year, month - 1, day, 23, 59, 59, 999); // Fim do dia no timezone local
  }

  // Validar datas
  if (startDate && endDate && startDate > endDate) {
    alert('Start date must be before end date');
    return;
  }

  onDateRangeChange({
    startDate,
    endDate,
    preset: 'custom'
  });
  setIsOpen(false);
};
```

**Tratamento de Timezone:**
- **Data de início**: Criada com `0, 0, 0, 0` (meia-noite) para garantir início do dia no timezone local
- **Data de fim**: Criada com `23, 59, 59, 999` (último milissegundo do dia) para garantir fim do dia no timezone local
- Isso evita problemas de conversão UTC que poderiam fazer uma data "pular" para o dia anterior ou seguinte

**Validação:**
- Verifica se a data de início não é posterior à data de fim
- Exibe um alerta caso a validação falhe
- Não aplica o filtro se a validação falhar

### 5.3. Limpeza de Filtros

A função `handleClearDates` reseta o filtro para "All time":

```typescript
const handleClearDates = () => {
  setTempStartDate('');
  setTempEndDate('');
  onDateRangeChange({
    startDate: null,
    endDate: null,
    preset: 'all'
  });
  setIsOpen(false);
};
```

---

## 6. Formatação e Exibição

### 6.1. Formatação do Texto do Botão

A função `formatDateRange` formata o texto exibido no botão baseado no estado atual:

```typescript
const formatDateRange = () => {
  if (dateRange.preset === 'custom') {
    if (dateRange.startDate && dateRange.endDate) {
      const formatDate = (date: Date) => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
      };
      return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
    } else if (dateRange.startDate) {
      return `From ${formatDate(dateRange.startDate)}`;
    } else if (dateRange.endDate) {
      return `Until ${formatDate(dateRange.endDate)}`;
    }
  }
  
  const presetLabels: { [key: string]: string } = {
    'all': 'All time',
    'today': 'Today',
    'yesterday': 'Yesterday',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    'year': 'This year'
  };
  
  return presetLabels[dateRange.preset || 'all'] || 'Select period';
};
```

**Formato de data:**
- Para períodos personalizados, usa formato `MM/DD/YYYY`
- Para presets, exibe o label correspondente
- Formatação manual evita problemas de timezone ao usar métodos como `toLocaleDateString()`

---

## 7. Aplicação do Filtro em Consultas

### 7.1. Uso em Hooks Customizados

O filtro de data é tipicamente aplicado em hooks customizados que fazem consultas ao banco de dados. Exemplo do `usePaymentsData`:

```typescript
export function usePaymentsData({ dateFilter, filterStatus, filterRole }: UsePaymentsDataParams) {
  const loadPayments = useCallback(async () => {
    // Aplicar filtros de data se fornecidos
    let startDateParam = null;
    let endDateParam = null;
    
    if (dateFilter?.startDate) {
      // Para data de início, usar início do dia (00:00:00)
      const startDate = new Date(dateFilter.startDate);
      startDate.setHours(0, 0, 0, 0);
      startDateParam = startDate.toISOString();
    }
    
    if (dateFilter?.endDate) {
      // Para data de fim, usar fim do dia (23:59:59)
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59, 999);
      endDateParam = endDate.toISOString();
    }
    
    // Aplicar filtros na query do Supabase
    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (startDateParam) {
      query = query.gte('created_at', startDateParam);
    }
    if (endDateParam) {
      query = query.lte('created_at', endDateParam);
    }
    
    const { data, error } = await query;
    // ...
  }, [dateFilter, filterStatus, filterRole]);
}
```

**Conversão para ISO String:**
- `startDate.setHours(0, 0, 0, 0)`: Garante início do dia
- `endDate.setHours(23, 59, 59, 999)`: Garante fim do dia
- `toISOString()`: Converte para formato ISO 8601 aceito pelo Supabase/PostgreSQL

### 7.2. Operadores do Supabase

- `gte('created_at', startDateParam)`: "Greater than or equal" - registros com `created_at >= startDate`
- `lte('created_at', endDateParam)`: "Less than or equal" - registros com `created_at <= endDate`

---

## 8. Integração em Componentes

### 8.1. Exemplo de Uso Básico

```typescript
import { useState } from 'react';
import { GoogleStyleDatePicker } from '../components/GoogleStyleDatePicker';
import { DateRange } from '../components/DateRangeFilter';

function MyComponent() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    preset: 'all'
  });

  return (
    <GoogleStyleDatePicker
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      className="w-full"
    />
  );
}
```

### 8.2. Exemplo com Filtragem de Dados

```typescript
import { useState, useMemo } from 'react';
import { GoogleStyleDatePicker } from '../components/GoogleStyleDatePicker';
import { DateRange } from '../components/DateRangeFilter';

function DataTable() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    preset: 'all'
  });
  
  const [allData, setAllData] = useState<MyData[]>([]);

  // Filtrar dados localmente
  const filteredData = useMemo(() => {
    if (!dateRange.startDate && !dateRange.endDate) {
      return allData; // Sem filtro
    }

    return allData.filter(item => {
      const itemDate = new Date(item.created_at);
      
      if (dateRange.startDate && itemDate < dateRange.startDate) {
        return false;
      }
      
      if (dateRange.endDate) {
        const endOfDay = new Date(dateRange.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (itemDate > endOfDay) {
          return false;
        }
      }
      
      return true;
    });
  }, [allData, dateRange]);

  return (
    <>
      <GoogleStyleDatePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
      <table>
        {/* Renderizar filteredData */}
      </table>
    </>
  );
}
```

---

## 9. Considerações de Timezone

### 9.1. Problema Comum

JavaScript `Date` trabalha com timezone local do navegador, enquanto bancos de dados geralmente armazenam em UTC. Isso pode causar problemas:

- Uma data selecionada como "01/01/2024" pode ser interpretada como "2024-01-01T00:00:00-03:00" (Brasil)
- Ao converter para UTC, pode virar "2023-12-31T21:00:00Z"
- Isso faria a query buscar dados do dia anterior

### 9.2. Solução Implementada

O sistema resolve isso criando datas explicitamente no timezone local:

```typescript
// ❌ ERRADO - pode ter problemas de timezone
const startDate = new Date(tempStartDate); // Interpreta como UTC se for string ISO

// ✅ CORRETO - cria no timezone local
const [year, month, day] = tempStartDate.split('-').map(Number);
const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
```

**Por que funciona:**
- `new Date(year, month, day, hours, minutes, seconds, ms)` sempre cria a data no timezone local
- Não há conversão automática para UTC
- A conversão para ISO só acontece quando necessário (ao enviar para o banco)

---

## 10. Validações e Tratamento de Erros

### 10.1. Validações Implementadas

1. **Data de início não pode ser posterior à data de fim**
   ```typescript
   if (startDate && endDate && startDate > endDate) {
     alert('Start date must be before end date');
     return;
   }
   ```

2. **Validação nativa do HTML5**
   - Inputs `type="date"` validam formato automaticamente
   - Atributos `min` e `max` impedem seleções inválidas

3. **Limite de data futura**
   - `max={new Date().toISOString().split('T')[0]}` impede selecionar datas futuras

### 10.2. Tratamento de Estados Vazios

- Quando `startDate` e `endDate` são `null`, representa "All time" (sem filtro)
- Queries não aplicam filtros de data quando ambos são `null`
- Componentes exibem "All time" quando não há filtro ativo

---

## 11. Estrutura de Arquivos

```
src/
├── components/
│   ├── GoogleStyleDatePicker.tsx      # Componente principal (modal dropdown)
│   ├── DateRangeFilter.tsx            # Componente alternativo (inline)
│   ├── CustomDateRangePicker.tsx      # Variação do componente principal
│   ├── SimpleDateRangePicker.tsx      # Versão simplificada
│   └── TestDatePicker.tsx             # Componente de teste
├── pages/
│   ├── FinanceDashboard/
│   │   ├── components/
│   │   │   └── PaymentsFilters.tsx    # Uso do GoogleStyleDatePicker
│   │   └── hooks/
│   │       └── usePaymentsData.ts     # Aplicação do filtro em queries
│   └── AdminDashboard/
│       └── DocumentsTable.tsx         # Uso do GoogleStyleDatePicker
```

---

## 12. Fluxo Completo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário interage com GoogleStyleDatePicker                │
│    - Seleciona preset OU                                    │
│    - Digita datas personalizadas                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Componente atualiza estado interno                       │
│    - tempStartDate, tempEndDate (strings)                   │
│    - Ou aplica preset diretamente                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Usuário clica em "Apply"                                 │
│    - handleCustomDateApply() ou handlePresetClick()         │
│    - Valida datas                                           │
│    - Converte strings para objetos Date                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Callback onDateRangeChange é chamado                     │
│    - Atualiza estado do componente pai                      │
│    - DateRange { startDate, endDate, preset }               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Componente pai reage à mudança                           │
│    - Hook customizado (ex: usePaymentsData)                 │
│    - Converte Date para ISO string                          │
│    - Ajusta horas (00:00:00 para início, 23:59:59 para fim) │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Query ao banco de dados                                   │
│    - Supabase query com .gte() e .lte()                     │
│    - Filtra registros por created_at                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Dados filtrados são retornados                           │
│    - Componente atualiza tabela/lista                       │
│    - Usuário vê apenas dados do período selecionado          │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Melhores Práticas

### 13.1. Gerenciamento de Estado

- **Estado controlado**: O componente é totalmente controlado via props (`dateRange` e `onDateRangeChange`)
- **Estado temporário**: Usa estados locais apenas para edição antes de aplicar
- **Sincronização**: `useEffect` garante que estados temporários estejam sincronizados com props

### 13.2. Performance

- **useCallback**: Hooks que fazem queries devem usar `useCallback` para evitar re-renders desnecessários
- **useMemo**: Filtragem local de dados deve usar `useMemo` para evitar recálculos
- **Cleanup**: Event listeners são removidos no cleanup do `useEffect`

### 13.3. Acessibilidade

- **ARIA labels**: Botões têm `aria-label` para leitores de tela
- **Navegação por teclado**: Inputs HTML5 nativos suportam navegação por teclado
- **Foco**: Estados de foco são gerenciados via classes Tailwind (`focus:ring-2`)

---

## 14. Extensibilidade

### 14.1. Adicionar Novos Presets

Para adicionar um novo preset, edite o array `presets` e adicione um case no `handlePresetClick`:

```typescript
// Adicionar ao array presets
{ value: '14d', label: 'Last 14 days', icon: '📊' }

// Adicionar case no switch
case '14d':
  newStartDate = new Date(startOfToday);
  newStartDate.setDate(startOfToday.getDate() - 14);
  break;
```

### 14.2. Customizar Formato de Data

Para alterar o formato de exibição, modifique a função `formatDate` dentro de `formatDateRange`:

```typescript
const formatDate = (date: Date) => {
  // Formato brasileiro: DD/MM/YYYY
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
```

---

## 15. Troubleshooting

### 15.1. Problema: Datas aparecem um dia antes/depois

**Causa**: Problema de timezone na conversão de strings para Date.

**Solução**: Sempre criar datas usando o construtor `new Date(year, month, day, ...)` em vez de `new Date(string)`.

### 15.2. Problema: Filtro não está funcionando

**Verificações**:
1. Confirmar que `onDateRangeChange` está sendo chamado
2. Verificar se as datas estão sendo convertidas corretamente para ISO string
3. Confirmar que a query está usando `.gte()` e `.lte()` corretamente
4. Verificar se o campo no banco (`created_at`) está no formato correto

### 15.3. Problema: Modal não fecha ao clicar fora

**Causa**: Overlay pode estar com z-index incorreto ou evento não está sendo capturado.

**Solução**: Verificar se o overlay tem `z-index` menor que o modal e se o `onClick` está configurado corretamente.

---

## 16. Conclusão

O sistema de filtro por calendário é uma solução robusta e flexível que oferece:

- ✅ Interface intuitiva com presets e período personalizado
- ✅ Tratamento correto de timezone
- ✅ Validações adequadas
- ✅ Performance otimizada
- ✅ Código reutilizável e extensível

A arquitetura baseada em componentes React e hooks permite fácil integração em diferentes partes da aplicação, mantendo consistência na experiência do usuário e na lógica de filtragem.
