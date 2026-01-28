# Documentação Técnica: Serviços de Exportação

## Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura e Organização](#arquitetura-e-organização)
3. [Serviço 1: Export de Documentos (Admin Dashboard)](#serviço-1-export-de-documentos-admin-dashboard)
4. [Serviço 2: Export de Pagamentos (Finance Dashboard)](#serviço-2-export-de-pagamentos-finance-dashboard)
5. [Comparação e Diferenças](#comparação-e-diferenças)
6. [Detalhes Técnicos de Implementação](#detalhes-técnicos-de-implementação)
7. [Fluxo de Dados Completo](#fluxo-de-dados-completo)
8. [Replicação do Serviço](#replicação-do-serviço)

---

## Visão Geral

O sistema possui **dois serviços de exportação** principais que geram arquivos Excel (.xlsx) com dados filtrados:

1. **Export de Documentos** - Localizado na página Admin Dashboard (`DocumentsTable.tsx`)
2. **Export de Pagamentos** - Serviço separado no Finance Dashboard (`paymentsExcelExport.ts`)

Ambos utilizam a biblioteca **ExcelJS** para geração de arquivos Excel e **file-saver** para download.

---

## Arquitetura e Organização

### Estrutura de Arquivos

```
src/
├── pages/
│   ├── AdminDashboard/
│   │   └── DocumentsTable.tsx          # Export inline (função dentro do componente)
│   └── FinanceDashboard/
│       ├── PaymentsTable.tsx            # Componente que chama o serviço
│       └── services/
│           └── paymentsExcelExport.ts  # Serviço separado e reutilizável
└── lib/
    └── supabase.ts                      # Cliente Supabase para queries
```

### Dependências Principais

```json
{
  "exceljs": "^4.x.x",           // Geração de arquivos Excel
  "file-saver": "^2.x.x"         // Download de arquivos no navegador
}
```

---

## Serviço 1: Export de Documentos (Admin Dashboard)

### Localização
- **Arquivo**: `src/pages/AdminDashboard/DocumentsTable.tsx`
- **Função**: `downloadDocumentsReport` (linhas 414-819)
- **Tipo**: Função inline dentro do componente React

### Características

#### 1. **Estrutura da Função**
```typescript
const downloadDocumentsReport = useCallback(async () => {
  // 1. Validação e logs
  // 2. Filtragem de documentos
  // 3. Criação do workbook Excel
  // 4. Adição de dados
  // 5. Formatação
  // 6. Download
}, [filteredDocuments, internalDateRange, t]);
```

#### 2. **Filtros Aplicados na Exportação**

A função aplica **3 filtros críticos** antes de exportar:

```typescript
const documentsToExport = filteredDocuments.filter(doc => {
  // FILTRO 1: Excluir documentos REFUNDED (reembolsados)
  const paymentStatus = (doc.payment_status || '').toLowerCase();
  if (paymentStatus === 'refunded') {
    return false;
  }
  
  // FILTRO 2: Apenas documentos com pagamento COMPLETED
  if (paymentStatus !== 'completed') {
    return false;
  }

  // FILTRO 3: Excluir documentos onde Luiz é o USUÁRIO (não autenticador)
  const userEmail = (doc.user_email || '').toLowerCase();
  const userName = (doc.user_name || '').toLowerCase();
  
  const isLuizUser = 
    userEmail.includes('luizeduardomcsantos') ||
    userEmail.includes('luizeduardogouveia7') ||
    userName.includes('luiz eduardo');
  
  return !isLuizUser;
});
```

#### 3. **Estrutura do Excel Gerado**

**Colunas Exportadas** (13 colunas):
1. Document Name
2. User Name
3. User Email
4. Translation Status
5. Pages
6. Amount (valor bruto pago pelo cliente)
7. Tax (taxa Stripe)
8. Net Value (valor líquido recebido)
9. Payment Method
10. Payment Status
11. Authenticator Name
12. Authentication Date
13. Payment Date

**Cálculo de Valores Financeiros**:
```typescript
const amount = doc.total_cost || 0;        // Valor bruto
const netValue = doc.payment_amount || 0; // Valor líquido
const tax = amount - netValue;              // Taxa Stripe
```

#### 4. **Formatação do Excel**

**Cabeçalho**:
- Cor de fundo: Azul (`#4472C4`)
- Texto: Branco, negrito, tamanho 11
- Altura: 25px
- Alinhamento: Centralizado, wrap text

**Linha de Informação de Período** (se houver filtro de data):
- Linha 1: Informação do período (mesclada em 13 colunas)
- Linha 2: Linha em branco
- Linha 3: Cabeçalhos

**Formatação de Colunas Numéricas**:
```typescript
amountColumn.numFmt = '$#,##0.00';      // Formato monetário
taxColumn.numFmt = '$#,##0.00';
netValueColumn.numFmt = '$#,##0.00';
pagesColumn.numFmt = '0';               // Número inteiro
```

**Formatação Condicional de Status**:
- `completed`: Verde claro (`#C6EFCE`)
- `pending` / `pending_verification`: Amarelo claro (`#FFEB9C`)
- `failed`: Vermelho claro (`#FFC7CE`)

**Recursos Avançados**:
- ✅ Linha de cabeçalho congelada
- ✅ Filtros automáticos (autoFilter)
- ✅ Ajuste automático de largura de colunas
- ✅ Bordas sutis em todas as células
- ✅ Alinhamento específico por tipo de coluna

#### 5. **Nome do Arquivo**

```typescript
// Formato baseado no período
if (startDateStr && endDateStr) {
  fileName = `documents-report-${startDateStr}_to_${endDateStr}.xlsx`;
} else if (startDateStr) {
  fileName = `documents-report-from-${startDateStr}.xlsx`;
} else if (endDateStr) {
  fileName = `documents-report-until-${endDateStr}.xlsx`;
} else {
  fileName = `documents-report-${new Date().toISOString().split('T')[0]}.xlsx`;
}
```

#### 6. **Fluxo de Execução**

```
1. Usuário clica em "Export Excel"
   ↓
2. Validação: filteredDocuments.length > 0
   ↓
3. Aplicação de filtros (refunded, completed, Luiz)
   ↓
4. Validação: documentsToExport.length > 0
   ↓
5. Criação do workbook (ExcelJS.Workbook)
   ↓
6. Adição de linha de período (se houver filtro de data)
   ↓
7. Definição de colunas e cabeçalhos
   ↓
8. Loop: Adicionar cada documento como linha
   ↓
9. Formatação de colunas numéricas
   ↓
10. Formatação condicional de status
   ↓
11. Ajuste automático de larguras
   ↓
12. Congelamento de cabeçalho e filtros
   ↓
13. Geração de buffer (workbook.xlsx.writeBuffer())
   ↓
14. Criação de Blob e download (saveAs)
```

---

## Serviço 2: Export de Pagamentos (Finance Dashboard)

### Localização
- **Arquivo**: `src/pages/FinanceDashboard/services/paymentsExcelExport.ts`
- **Função Principal**: `exportPaymentsReport` (linha 604)
- **Tipo**: Serviço separado e modular

### Características

#### 1. **Arquitetura Modular**

O serviço é dividido em **funções especializadas**:

```typescript
// Funções principais
exportPaymentsReport()           // Função principal de exportação
fetchExportData()                // Busca dados do Supabase
generateFileName()                // Gera nome do arquivo

// Funções auxiliares
filterPaymentsForExport()        // Filtra pagamentos
createWorkbook()                 // Cria estrutura do Excel
addDataToWorksheet()             // Adiciona dados
formatWorksheet()                 // Formata o Excel
calculateFinancialValues()       // Calcula valores financeiros
getAuthenticationData()          // Busca dados de autenticação
```

#### 2. **Filtros Aplicados**

```typescript
function filterPaymentsForExport(payments: MappedPayment[]): MappedPayment[] {
  return payments.filter(payment => {
    const paymentStatus = (payment.status || '').toLowerCase();
    
    // Excluir refunded e failed
    if (paymentStatus === 'refunded' || paymentStatus === 'failed') {
      return false;
    }

    // Excluir Luiz como usuário
    const userEmail = (payment.user_email || '').toLowerCase();
    const userName = (payment.user_name || '').toLowerCase();
    
    const isLuizUser = 
      userEmail.includes('luizeduardomcsantos') ||
      userEmail.includes('luizeduardogouveia7') ||
      userName.includes('luiz eduardo');
    
    return !isLuizUser;
  });
}
```

#### 3. **Busca de Dados (fetchExportData)**

Esta função realiza **múltiplas queries** no Supabase para enriquecer os dados:

**Passo 1: Coletar IDs de documentos**
```typescript
const allDocumentIds = new Set<string>();
payments.forEach(payment => {
  if (payment.document_id) {
    allDocumentIds.add(payment.document_id);
  }
});
```

**Passo 2: Buscar documents_to_be_verified**
```typescript
const { data: allVerifiedDocs } = await supabase
  .from('documents_to_be_verified')
  .select('id, original_document_id')
  .in('id', Array.from(allDocumentIds));
```

**Passo 3: Buscar documents**
```typescript
const { data: documentsData } = await supabase
  .from('documents')
  .select('id, total_cost, pages, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated')
  .in('id', documentIds);
```

**Passo 4: Buscar translated_documents (autenticação)**
```typescript
const { data: translatedDocsData } = await supabase
  .from('translated_documents')
  .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
  .in('original_document_id', dtbvIds);
```

**Passo 5: Buscar payments (payment_amount)**
```typescript
const { data: paymentsData } = await supabase
  .from('payments')
  .select('document_id, amount')
  .in('document_id', documentIds);
```

**Retorno**: Objeto `ExportData` com Maps para lookup rápido:
```typescript
interface ExportData {
  documentsMap: Map<string, any>;           // document_id -> dados do documento
  paymentsMap: Map<string, number>;         // document_id -> payment_amount
  authenticationMap: Map<string, any>;     // document_id -> dados de autenticação
  verifiedDocsDataForLookup: any[];         // Array para lookup adicional
}
```

#### 4. **Cálculo de Valores Financeiros**

```typescript
function calculateFinancialValues(
  payment: MappedPayment,
  docData: any,
  paymentsMap: Map<string, number>
): { amount: number; tax: number; netValue: number; pages: number } {
  let totalCost = docData?.total_cost || 0;
  let netValue = paymentsMap.get(payment.document_id) || 0;
  
  // Se não encontrar, buscar pelo original_document_id
  if (netValue === 0 && docData?.original_document_id) {
    netValue = paymentsMap.get(docData.original_document_id) || 0;
  }
  
  // Fallbacks
  if (netValue === 0) {
    netValue = payment.amount || 0;
  }
  if (totalCost === 0) {
    totalCost = netValue || payment.amount || 0;
  }
  
  const amount = totalCost;                    // Valor bruto
  const netValueFinal = netValue;             // Valor líquido
  const tax = amount - netValueFinal;          // Taxa Stripe
  const pages = docData?.pages || 0;
  
  return { amount, tax, netValue: netValueFinal, pages };
}
```

#### 5. **Busca de Dados de Autenticação**

Função complexa que busca dados de autenticação em múltiplas fontes:

```typescript
function getAuthenticationData(
  payment: MappedPayment,
  docData: any,
  authenticationMap: Map<string, any>,
  verifiedDocsDataForLookup: any[]
): any {
  // Tentativa 1: Buscar direto pelo document_id
  let authData = authenticationMap.get(payment.document_id);
  
  // Tentativa 2: Buscar pelo original_document_id
  if (!authData && docData?.original_document_id) {
    authData = authenticationMap.get(docData.original_document_id);
  }
  
  // Tentativa 3: Buscar via verifiedDocsDataForLookup
  if (!authData && verifiedDocsDataForLookup.length > 0) {
    const dtbvDoc = verifiedDocsDataForLookup.find(d => d.id === payment.document_id);
    if (dtbvDoc?.original_document_id) {
      authData = authenticationMap.get(dtbvDoc.original_document_id);
    }
  }
  
  // Tentativa 4: Usar dados do docData
  if (!authData && docData && (docData.authenticated_by_name || ...)) {
    authData = { ... };
  }
  
  // Tentativa 5: Usar dados do payment
  if (!authData && (payment.authenticated_by_name || ...)) {
    authData = { ... };
  }
  
  return authData;
}
```

#### 6. **Estrutura do Excel Gerado**

**Colunas** (13 colunas - idênticas ao Admin):
1. Document Name
2. User Name
3. User Email
4. Translation Status
5. Pages
6. Amount
7. Tax
8. Net Value
9. Payment Method
10. Payment Status
11. Authenticator Name
12. Authentication Date
13. Payment Date

**Larguras Iniciais das Colunas** (maiores que Admin):
```typescript
{ header: 'Document Name', width: 50 },      // Admin: 30
{ header: 'User Name', width: 25 },          // Admin: 20
{ header: 'User Email', width: 35 },         // Admin: 25
{ header: 'Translation Status', width: 20 }, // Admin: 18
// ... etc
```

#### 7. **Formatação do Excel**

Similar ao Admin, mas com algumas diferenças:

**Ajuste Automático de Larguras**:
```typescript
// Multiplicador: 1.3x (Admin usa 1.2x)
const calculatedWidth = Math.min(Math.max(maxLength * 1.3, minWidth), maxWidth);
```

**Larguras Máximas Específicas**:
```typescript
if (columnKey === 'documentName') {
  minWidth = 40;
  maxWidth = 100;  // Admin: 80
}
```

#### 8. **Nome do Arquivo**

```typescript
export function generateFileName(dateFilter: DateRange | null): string {
  // Mesma lógica do Admin, mas como função exportável
  return `${fileName}.xlsx`;
}
```

#### 9. **Fluxo de Execução**

```
1. Chamada: exportPaymentsReport(filteredPayments, dateFilter)
   ↓
2. Validação: filteredPayments.length > 0
   ↓
3. Filtragem: filterPaymentsForExport()
   ↓
4. Validação: paymentsToExport.length > 0
   ↓
5. Busca de dados: fetchExportData() [MÚLTIPLAS QUERIES]
   ├── Buscar documents_to_be_verified
   ├── Buscar documents
   ├── Buscar translated_documents
   └── Buscar payments
   ↓
6. Criação do workbook: createWorkbook()
   ↓
7. Adição de dados: addDataToWorksheet()
   │   ├── Para cada payment:
   │   ├── Buscar docData do Map
   │   ├── Calcular valores financeiros
   │   ├── Buscar dados de autenticação
   │   └── Adicionar linha
   ↓
8. Formatação: formatWorksheet()
   ↓
9. Geração de buffer e download
```

---

## Comparação e Diferenças

| Aspecto | Admin Dashboard | Finance Dashboard |
|--------|----------------|-------------------|
| **Localização** | Inline no componente | Serviço separado |
| **Reutilização** | Não reutilizável | Reutilizável |
| **Busca de Dados** | Dados já carregados no componente | Busca dados via Supabase |
| **Filtros** | 3 filtros (refunded, completed, Luiz) | 3 filtros (refunded, failed, Luiz) |
| **Largura Colunas** | Menores (30, 20, 25...) | Maiores (50, 25, 35...) |
| **Multiplicador Largura** | 1.2x | 1.3x |
| **Max Width Document Name** | 80 | 100 |
| **Complexidade** | Média | Alta (múltiplas queries) |
| **Performance** | Rápida (dados em memória) | Mais lenta (queries async) |

---

## Detalhes Técnicos de Implementação

### 1. **Biblioteca ExcelJS**

**Criação de Workbook**:
```typescript
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Documents'); // ou 'Payments'
```

**Definição de Colunas**:
```typescript
worksheet.columns = [
  { header: 'Column Name', key: 'columnKey', width: 30 }
];
```

**Adição de Linhas**:
```typescript
worksheet.addRow({
  columnKey: 'value',
  // ...
});
```

**Formatação de Células**:
```typescript
cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' }
};
cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
cell.border = {
  top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  // ...
};
```

**Formato Numérico**:
```typescript
column.numFmt = '$#,##0.00';  // Monetário
column.numFmt = '0';           // Inteiro
```

**Recursos Avançados**:
```typescript
// Congelar linha
worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];

// Filtros automáticos
worksheet.autoFilter = {
  from: { row: headerRowNumber, column: 1 },
  to: { row: headerRowNumber, column: 13 }
};

// Mesclar células
worksheet.mergeCells(1, 1, 1, 13);
```

**Geração de Buffer e Download**:
```typescript
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
saveAs(blob, fileName);
```

### 2. **Biblioteca file-saver**

```typescript
import { saveAs } from 'file-saver';

// Download direto
saveAs(blob, 'filename.xlsx');
```

### 3. **Formatação de Datas**

```typescript
// Para nome de arquivo
function formatDateForFileName(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Para exibição no Excel
function formatDateSafely(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

### 4. **Validação de Números**

```typescript
function safeNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  return defaultValue;
}
```

---

## Fluxo de Dados Completo

### Admin Dashboard Export

```
┌─────────────────────────────────────────────────────────┐
│  DocumentsTable Component                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │  filteredDocuments (useMemo)                      │ │
│  │  - Aplicação de filtros de busca, status, role    │ │
│  │  - Dados já carregados via loadExtendedDocuments() │ │
│  └───────────────────────────────────────────────────┘ │
│                          ↓                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │  downloadDocumentsReport()                        │ │
│  │  1. Validação: filteredDocuments.length > 0     │ │
│  │  2. Filtragem adicional:                          │ │
│  │     - Excluir refunded                            │ │
│  │     - Apenas completed                            │ │
│  │     - Excluir Luiz como usuário                   │ │
│  │  3. Criação do Excel (ExcelJS)                    │ │
│  │  4. Adição de dados                               │ │
│  │  5. Formatação                                    │ │
│  │  6. Download (file-saver)                         │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Finance Dashboard Export

```
┌─────────────────────────────────────────────────────────┐
│  PaymentsTable Component                                 │
│  ┌───────────────────────────────────────────────────┐ │
│  │  filteredPayments (usePaymentsFilters)          │ │
│  │  - Filtros aplicados client-side                 │ │
│  └───────────────────────────────────────────────────┘ │
│                          ↓                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │  exportPaymentsReport()                           │ │
│  │  1. Validação: filteredPayments.length > 0        │ │
│  │  2. filterPaymentsForExport()                     │ │
│  │     - Excluir refunded e failed                   │ │
│  │     - Excluir Luiz como usuário                   │ │
│  │  3. fetchExportData() [ASYNC]                     │ │
│  │     ├── Query: documents_to_be_verified           │ │
│  │     ├── Query: documents                          │ │
│  │     ├── Query: translated_documents               │ │
│  │     └── Query: payments                           │ │
│  │  4. createWorkbook()                              │ │
│  │  5. addDataToWorksheet()                           │ │
│  │     - Para cada payment:                          │ │
│  │       ├── calculateFinancialValues()              │ │
│  │       └── getAuthenticationData()                  │ │
│  │  6. formatWorksheet()                              │ │
│  │  7. Download (file-saver)                         │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Replicação do Serviço

### Passo a Passo para Criar um Novo Serviço de Export

#### 1. **Criar Arquivo de Serviço**

```typescript
// src/pages/[SeuDashboard]/services/[nome]ExcelExport.ts

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../../../lib/supabase';
import { DateRange } from '../../../components/DateRangeFilter';

// 1. Definir interface de dados
interface SeuTipoDeDados {
  // ... campos
}

// 2. Função de filtro
function filterDataForExport(data: SeuTipoDeDados[]): SeuTipoDeDados[] {
  return data.filter(item => {
    // Aplicar filtros necessários
    // - Excluir refunded/failed
    // - Excluir usuários específicos
    // - Apenas status completed
    return true;
  });
}

// 3. Função de busca de dados (se necessário)
export async function fetchExportData(data: SeuTipoDeDados[]): Promise<any> {
  // Realizar queries no Supabase se necessário
  // Retornar Maps para lookup rápido
}

// 4. Função de geração de nome de arquivo
export function generateFileName(dateFilter: DateRange | null): string {
  // Mesma lógica dos outros serviços
}

// 5. Função de criação do workbook
function createWorkbook(dateFilter: DateRange | null) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('SheetName');
  
  // Adicionar linha de período se houver filtro de data
  // Definir colunas
  // Estilizar cabeçalhos
  
  return { workbook, worksheet, headerRowNumber, dataStartRow };
}

// 6. Função de adição de dados
function addDataToWorksheet(worksheet: ExcelJS.Worksheet, data: SeuTipoDeDados[], dataStartRow: number) {
  data.forEach(item => {
    worksheet.addRow({
      // Mapear campos
    });
  });
}

// 7. Função de formatação
function formatWorksheet(worksheet: ExcelJS.Worksheet, headerRowNumber: number, dataStartRow: number) {
  // Formatar colunas numéricas
  // Aplicar formatação condicional
  // Ajustar larguras
  // Congelar cabeçalho
  // Adicionar filtros automáticos
}

// 8. Função principal
export async function exportSeuRelatorio(
  filteredData: SeuTipoDeDados[],
  dateFilter: DateRange | null
): Promise<void> {
  // Validações
  // Filtragem
  // Busca de dados (se necessário)
  // Criação do workbook
  // Adição de dados
  // Formatação
  // Download
}
```

#### 2. **Integrar no Componente**

```typescript
// No componente
import { exportSeuRelatorio } from './services/seuExcelExport';

const handleExport = async () => {
  await exportSeuRelatorio(filteredData, dateFilter);
};

// No JSX
<button onClick={handleExport}>
  <Download className="w-4 h-4 mr-2" />
  Export Excel
</button>
```

#### 3. **Checklist de Implementação**

- [ ] Criar arquivo de serviço em `services/`
- [ ] Definir interfaces TypeScript
- [ ] Implementar função de filtro
- [ ] Implementar busca de dados (se necessário)
- [ ] Implementar geração de nome de arquivo
- [ ] Implementar criação do workbook
- [ ] Implementar adição de dados
- [ ] Implementar formatação completa
- [ ] Adicionar validações
- [ ] Adicionar tratamento de erros
- [ ] Adicionar logs para debug
- [ ] Testar com diferentes filtros
- [ ] Testar com diferentes períodos de data
- [ ] Verificar formatação do Excel gerado

---

## Conclusão

Ambos os serviços de exportação seguem padrões similares, mas com diferenças importantes:

- **Admin Dashboard**: Mais simples, dados já em memória, implementação inline
- **Finance Dashboard**: Mais complexo, busca dados do Supabase, serviço modular e reutilizável

Para replicar, recomenda-se seguir o padrão do **Finance Dashboard** por ser mais escalável e manutenível, especialmente se houver necessidade de buscar dados adicionais do banco de dados.

---

## Referências

- **ExcelJS Documentation**: https://github.com/exceljs/exceljs
- **file-saver Documentation**: https://github.com/eligrey/FileSaver.js
- **Supabase Client**: `src/lib/supabase.ts`
- **Código Fonte**:
  - Admin: `src/pages/AdminDashboard/DocumentsTable.tsx` (linhas 414-819)
  - Finance: `src/pages/FinanceDashboard/services/paymentsExcelExport.ts`

