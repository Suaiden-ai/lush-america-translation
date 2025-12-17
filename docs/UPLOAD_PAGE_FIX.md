# Upload Page Fix - DocumentId Missing

## 🚨 **Problema Identificado**

### **Erro no Upload da Página Normal:**
- ❌ `ERROR: documentId não encontrado nos metadados da sessão`
- ❌ Documento não é inserido no banco antes do pagamento
- ❌ Diferença de comportamento entre `DocumentUploadModal` e `UploadDocument`

### **Logs de Erro:**
```
DEBUG: Desktop detectado, recuperando arquivo do IndexedDB: file_1754950122270_mypedknxu
DEBUG: Upload bem-sucedido: Object
ERROR: documentId não encontrado nos metadados da sessão
```

## 🔍 **Causa Raiz**

### **1. Diferença de Implementação:**
- **`DocumentUploadModal`**: ✅ Cria documento no banco ANTES do pagamento
- **`UploadDocument`**: ❌ NÃO criava documento no banco antes do pagamento

### **2. Fluxo Incorreto:**
```
UploadDocument → handleUpload → handleDirectPayment → Stripe Checkout
     ↓
❌ Sem documentId nos metadados
     ↓
PaymentSuccess → ❌ Falha ao processar
```

## ✅ **Correções Implementadas**

### **1. Criação do Documento Movida para `handleUpload`:**
```typescript
const handleUpload = async () => {
  // CRIAR DOCUMENTO NO BANCO ANTES DO PAGAMENTO
  const { data: newDocument, error: createError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      filename: selectedFile.name,
      pages: pages,
      status: 'pending',
      total_cost: calcularValor(pages, tipoTrad, isExtrato),
      verification_code: 'TFE' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      is_authenticated: true,
      upload_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
```

### **2. DocumentId Passado para `handleDirectPayment`:**
```typescript
// Desktop
await handleDirectPayment(fileId, { documentId: newDocument.id });

// Mobile - IndexedDB
await handleDirectPayment(fileId, { documentId: newDocument.id });

// Mobile - Upload direto
await handleDirectPayment('', { ...payload, documentId: newDocument.id });
```

### **3. Validação no `handleDirectPayment`:**
```typescript
// Verificar se o documentId foi fornecido
if (!customPayload?.documentId) {
  throw new Error('Document ID não fornecido');
}
```

## 🔄 **Fluxo Corrigido**

### **Antes (Incorreto):**
```
UploadDocument → handleUpload → handleDirectPayment → Stripe (sem documentId)
     ↓
PaymentSuccess → ❌ Falha: documentId não encontrado
```

### **Depois (Correto):**
```
UploadDocument → handleUpload → Criar documento no banco → handleDirectPayment → Stripe (com documentId)
     ↓
PaymentSuccess → ✅ Sucesso: documentId encontrado nos metadados
```

## 📋 **Arquivos Modificados**

### **`src/pages/CustomerDashboard/UploadDocument.tsx`:**
- ✅ **`handleUpload`**: Cria documento no banco antes do pagamento
- ✅ **`handleDirectPayment`**: Valida documentId e usa payload customizado
- ✅ **Mobile e Desktop**: Ambos passam documentId corretamente

## 🧪 **Como Testar**

### **1. Upload Desktop:**
- Selecionar arquivo
- Escolher tipo de tradução
- Fazer pagamento
- ✅ Verificar se documento é criado no banco
- ✅ Verificar se PaymentSuccess funciona

### **2. Upload Mobile:**
- Selecionar arquivo no mobile
- Escolher tipo de tradução
- Fazer pagamento
- ✅ Verificar se documento é criado no banco
- ✅ Verificar se PaymentSuccess funciona

## 🎯 **Resultado Esperado**

- ✅ **Documento criado no banco** antes do pagamento
- ✅ **DocumentId presente** nos metadados da sessão Stripe
- ✅ **PaymentSuccess funcionando** para uploads da página normal
- ✅ **Consistência** entre `DocumentUploadModal` e `UploadDocument`
- ✅ **Sem erros** de `documentId não encontrado`

## 📝 **Notas Importantes**

### **1. Ordem das Operações:**
- **Primeiro**: Criar documento no banco
- **Segundo**: Fazer pagamento com Stripe
- **Terceiro**: Processar sucesso em PaymentSuccess

### **2. Compatibilidade:**
- ✅ **Desktop**: IndexedDB + documentId
- ✅ **Mobile**: IndexedDB ou upload direto + documentId
- ✅ **Ambos**: Documento criado no banco antes do pagamento

### **3. Validações:**
- ✅ **Arquivo selecionado**: Verificado antes do processamento
- ✅ **DocumentId**: Verificado antes do pagamento
- ✅ **Usuário autenticado**: Verificado antes do processamento
