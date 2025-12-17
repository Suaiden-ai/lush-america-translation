# Webhook Payload Standardization Fix

## 🚨 **Problema Identificado**

### **Inconsistência entre Desktop e Mobile:**
- **Desktop**: ✅ Funciona perfeitamente com campos padronizados
- **Mobile**: ❌ Falha com campos antigos incompatíveis

### **Payload Desktop (Funcionando):**
```json
{
  "filename": "Teste de funcionamento do app.pdf",
  "url": "...",
  "mimetype": "application/pdf",
  "size": 0,
  "user_id": "5b04973a-9e2c-40f6-98ec-1b0f0d19eee3",
  "pages": 1,                    // ✅ Campo correto
  "document_type": "Certificado", // ✅ Campo correto
  "total_cost": "15",            // ✅ Campo correto
  "source_language": "Portuguese", // ✅ Campo correto
  "target_language": "English",   // ✅ Campo correto
  "is_bank_statement": false
}
```

### **Payload Mobile (Com Erro):**
```json
{
  "filename": "Independent_Contractor_Agreement_Paulo_Victor.pdf",
  "url": "...",
  "mimetype": "application/pdf",
  "size": 0,
  "user_id": "5b04973a-9e2c-40f6-98ec-1b0f0d19eee3",
  "paginas": 3,                  // ❌ Campo antigo
  "tipo_trad": "Certificado",    // ❌ Campo antigo
  "valor": "45",                 // ❌ Campo antigo
  "idioma_raiz": "Portuguese",   // ❌ Campo antigo
  "is_bank_statement": false
}
```

## 🔍 **Causa Raiz**

### **1. Campos Antigos vs Novos:**
- **Antigos**: `paginas`, `tipo_trad`, `valor`, `idioma_raiz`
- **Novos**: `pages`, `document_type`, `total_cost`, `source_language`, `target_language`

### **2. Incompatibilidade com n8n:**
- **n8n espera**: Campos novos padronizados
- **Mobile envia**: Campos antigos não reconhecidos
- **Resultado**: `Problem in node 'BINARY PDF' - Bad request - please check your parameters`

## ✅ **Correções Implementadas**

### **1. PaymentSuccess.tsx - Payload Padronizado:**
```typescript
const webhookPayload = {
  filename: filename,
  url: finalUrl,
  mimetype: 'application/pdf',
  size: storedFile?.file?.size || 0,
  user_id: userId,
  pages: parseInt(sessionData.metadata.pages),           // ✅ Sempre 'pages'
  document_type: sessionData.metadata.isCertified === 'true' ? 'Certificado' : 'Notorizado', // ✅ Sempre 'document_type'
  total_cost: sessionData.metadata.totalPrice,          // ✅ Sempre 'total_cost'
  source_language: 'Portuguese',                        // ✅ Sempre 'source_language'
  target_language: 'English',                           // ✅ Sempre 'target_language'
  is_bank_statement: sessionData.metadata.isBankStatement === 'true',
  document_id: finalDocumentId,
  // Campos padronizados para compatibilidade com n8n
  isPdf: true,
  fileExtension: 'pdf',
  tableName: 'profiles',
  schema: 'public'
};
```

### **2. Edge Function - Normalização Universal:**
```typescript
// Frontend payload
payload = { 
  filename: filename, 
  url: finalUrl, 
  mimetype, 
  size, 
  user_id: user_id || null, 
  // Sempre usar campos padronizados
  pages: pages || paginas || 1,                                    // ✅ Normaliza 'paginas' → 'pages'
  document_type: document_type || tipo_trad || 'Certificado',      // ✅ Normaliza 'tipo_trad' → 'document_type'
  total_cost: total_cost || valor || '0',                          // ✅ Normaliza 'valor' → 'total_cost'
  source_language: source_language || idioma_raiz || 'Portuguese', // ✅ Normaliza 'idioma_raiz' → 'source_language'
  target_language: target_language || 'English',                   // ✅ Sempre 'English'
  is_bank_statement: is_bank_statement || false,
  client_name: client_name || null,
  isPdf: mimetype === 'application/pdf',
  fileExtension: filename.split('.').pop()?.toLowerCase(),
  tableName: 'profiles',
  schema: 'public'
};

// Storage trigger payload
payload = {
  filename: path,
  url: publicUrl,
  mimetype: record.mimetype || record.metadata?.mimetype || "application/octet-stream",
  size: record.size || record.metadata?.size || null,
  user_id: record.user_id || record.metadata?.user_id || null,
  // Sempre usar campos padronizados
  pages: record.pages || pages || paginas || 1,                                    // ✅ Normaliza 'paginas' → 'pages'
  document_type: record.document_type || document_type || record.tipo_trad || tipo_trad || 'Certificado', // ✅ Normaliza 'tipo_trad' → 'document_type'
  total_cost: record.total_cost || total_cost || record.valor || valor || '0',      // ✅ Normaliza 'valor' → 'total_cost'
  source_language: record.source_language || source_language || record.idioma_raiz || idioma_raiz || 'Portuguese', // ✅ Normaliza 'idioma_raiz' → 'source_language'
  target_language: record.target_language || target_language || 'English',         // ✅ Sempre 'English'
  is_bank_statement: record.is_bank_statement || is_bank_statement || false,
  client_name: record.client_name || client_name || null,
  isPdf: (record.mimetype || record.metadata?.mimetype || "application/octet-stream") === 'application/pdf',
  fileExtension: path.split('.').pop()?.toLowerCase(),
  tableName: 'profiles',
  schema: 'public'
};
```

## 🔄 **Fluxo Corrigido**

### **Antes (Inconsistente):**
```
Desktop → PaymentSuccess → Webhook → n8n ✅ Sucesso
Mobile → PaymentSuccess → Webhook → n8n ❌ Falha (campos antigos)
```

### **Depois (Padronizado):**
```
Desktop → PaymentSuccess → Webhook → n8n ✅ Sucesso
Mobile → PaymentSuccess → Webhook → n8n ✅ Sucesso (campos normalizados)
```

## 📋 **Mapeamento de Campos**

### **Campos Antigos → Novos:**
- ✅ **`paginas`** → **`pages`**
- ✅ **`tipo_trad`** → **`document_type`**
- ✅ **`valor`** → **`total_cost`**
- ✅ **`idioma_raiz`** → **`source_language`**

### **Campos Sempre Presentes:**
- ✅ **`pages`**: Número de páginas (padrão: 1)
- ✅ **`document_type`**: Tipo de tradução (padrão: 'Certificado')
- ✅ **`total_cost`**: Custo total (padrão: '0')
- ✅ **`source_language`**: Idioma origem (padrão: 'Portuguese')
- ✅ **`target_language`**: Idioma destino (padrão: 'English')

## 🧪 **Como Testar**

### **1. Upload Desktop:**
- Selecionar arquivo
- Fazer pagamento
- ✅ Verificar se webhook é enviado com campos corretos
- ✅ Verificar se n8n processa sem erros

### **2. Upload Mobile:**
- Selecionar arquivo no mobile
- Fazer pagamento
- ✅ Verificar se webhook é enviado com campos normalizados
- ✅ Verificar se n8n processa sem erros

## 🎯 **Resultado Esperado**

- ✅ **Payload consistente** entre desktop e mobile
- ✅ **Campos sempre padronizados** para n8n
- ✅ **n8n funcionando** sem erros de parâmetros
- ✅ **Compatibilidade total** entre todas as fontes
- ✅ **Sem erros** de `Bad request - please check your parameters`

## 📝 **Notas Importantes**

### **1. Normalização Universal:**
- ✅ **Frontend**: Sempre envia campos padronizados
- ✅ **Edge Function**: Normaliza campos antigos para novos
- ✅ **Storage Trigger**: Também normaliza campos antigos

### **2. Valores Padrão:**
- ✅ **`pages`**: 1 se não especificado
- ✅ **`document_type`**: 'Certificado' se não especificado
- ✅ **`total_cost`**: '0' se não especificado
- ✅ **`source_language`**: 'Portuguese' se não especificado
- ✅ **`target_language`**: 'English' sempre

### **3. Compatibilidade:**
- ✅ **Desktop**: Funciona como antes
- ✅ **Mobile**: Agora funciona igual ao desktop
- ✅ **n8n**: Recebe sempre campos consistentes
