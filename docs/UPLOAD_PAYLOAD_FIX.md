# Upload Payload Fix - Payload Incompleto

## 🚨 **Problema Identificado**

### **Erro no Upload da Página Normal:**
- ❌ `ERROR: Número de páginas inválido`
- ❌ Payload incompleto sendo enviado para a Edge Function
- ❌ Diferença entre `DocumentUploadModal` (funcionando) e `UploadDocument` (falhando)

### **Logs de Erro:**
```
DEBUG: Payload enviado para checkout: {documentId: 'd28fe224-2852-4a58-ba33-e41d5383407f'}
POST https://ywpogqwhwscbdhnoqsmv.supabase.co/functions/v1/create-checkout-session 400 (Bad Request)
Erro detalhado da Edge Function: {error: 'Número de páginas inválido'}
```

## 🔍 **Causa Raiz**

### **1. Payload Incompleto:**
- **`DocumentUploadModal`**: ✅ Envia payload completo com todos os campos
- **`UploadDocument`**: ❌ Enviava apenas `{documentId: '...'}`

### **2. Campos Faltando:**
- ❌ `pages` - Número de páginas
- ❌ `isCertified` - Se é certificado
- ❌ `isNotarized` - Se é notarizado
- ❌ `isBankStatement` - Se é extrato bancário
- ❌ `fileId` - ID do arquivo no IndexedDB
- ❌ `userId` - ID do usuário
- ❌ `userEmail` - Email do usuário
- ❌ `filename` - Nome do arquivo

## ✅ **Correções Implementadas**

### **1. Payload Completo Criado:**
```typescript
// Criar payload completo igual ao DocumentUploadModal
const payload = {
  pages,
  isCertified: tipoTrad === 'Certificado',
  isNotarized: tipoTrad === 'Notorizado',
  isBankStatement: isExtrato,
  fileId: fileId || '', // Usar o ID do arquivo no IndexedDB
  userId: user?.id,
  userEmail: user?.email, // Adicionar email do usuário
  filename: selectedFile?.name,
  documentId: customPayload.documentId // Adicionar o documentId
};
```

### **2. Logs de Debug Adicionados:**
```typescript
console.log('DEBUG: Payload completo criado:', payload);
console.log('DEBUG: pages:', pages);
console.log('DEBUG: tipoTrad:', tipoTrad);
console.log('DEBUG: isExtrato:', isExtrato);
console.log('DEBUG: fileId:', fileId);
console.log('DEBUG: userId:', user?.id);
console.log('DEBUG: userEmail:', user?.email);
console.log('DEBUG: filename:', selectedFile?.name);
console.log('DEBUG: documentId:', customPayload.documentId);
```

## 🔄 **Fluxo Corrigido**

### **Antes (Incorreto):**
```
UploadDocument → handleUpload → handleDirectPayment → Payload: {documentId: '...'}
     ↓
Edge Function → ❌ Falha: Número de páginas inválido
```

### **Depois (Correto):**
```
UploadDocument → handleUpload → handleDirectPayment → Payload: {pages, isCertified, isNotarized, isBankStatement, fileId, userId, userEmail, filename, documentId}
     ↓
Edge Function → ✅ Sucesso: Todos os campos necessários presentes
```

## 📋 **Campos do Payload**

### **Campos Obrigatórios:**
- ✅ **`pages`**: Número de páginas do documento
- ✅ **`isCertified`**: Se é tradução certificada
- ✅ **`isNotarized`**: Se é tradução notarizada
- ✅ **`isBankStatement`**: Se é extrato bancário
- ✅ **`fileId`**: ID do arquivo no IndexedDB
- ✅ **`userId`**: ID do usuário autenticado
- ✅ **`userEmail`**: Email do usuário
- ✅ **`filename`**: Nome do arquivo
- ✅ **`documentId`**: ID do documento criado no banco

## 🧪 **Como Testar**

### **1. Upload Desktop:**
- Selecionar arquivo
- Escolher tipo de tradução
- Fazer pagamento
- ✅ Verificar logs de debug no console
- ✅ Verificar se payload completo é enviado
- ✅ Verificar se Edge Function retorna sucesso

### **2. Upload Mobile:**
- Selecionar arquivo no mobile
- Escolher tipo de tradução
- Fazer pagamento
- ✅ Verificar logs de debug no console
- ✅ Verificar se payload completo é enviado
- ✅ Verificar se Edge Function retorna sucesso

## 🎯 **Resultado Esperado**

- ✅ **Payload completo** sendo enviado para a Edge Function
- ✅ **Todos os campos obrigatórios** presentes
- ✅ **Edge Function funcionando** sem erros de validação
- ✅ **Stripe Checkout** sendo criado com sucesso
- ✅ **Consistência** entre `DocumentUploadModal` e `UploadDocument`

## 📝 **Notas Importantes**

### **1. Validação da Edge Function:**
- ✅ **`pages`**: Deve ser um número válido > 0
- ✅ **`isCertified`**: Deve ser boolean
- ✅ **`isNotarized`**: Deve ser boolean
- ✅ **`isBankStatement`**: Deve ser boolean
- ✅ **`userId`**: Deve ser string válida
- ✅ **`userEmail`**: Deve ser email válido
- ✅ **`filename`**: Deve ser string não vazia
- ✅ **`documentId`**: Deve ser UUID válido

### **2. Compatibilidade:**
- ✅ **Desktop**: IndexedDB + payload completo
- ✅ **Mobile**: IndexedDB ou upload direto + payload completo
- ✅ **Ambos**: Mesmo formato de payload

### **3. Debug:**
- ✅ **Logs detalhados** para facilitar troubleshooting
- ✅ **Validação de campos** antes do envio
- ✅ **Comparação** com `DocumentUploadModal` funcionando
