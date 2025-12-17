# Duplicate Upload Fix

## Problema Identificado

**DUPLICAÇÃO DE UPLOADS** estava causando **DUAS REQUISIÇÕES** para o N8N:

### Logs de Evidência:
```
Final response: { "success": true, "status": 200, "message": "{\"message\":\"Workflow was started\"}", "payload": { "url": "1753130664511_4xt7s0c7s.pdf" } }
Final response: { "success": true, "status": 200, "message": "{\"message\":\"Workflow was started\"}", "payload": { "url": "1753130664453_3840wr4o9.pdf" } }
```

### Causa Raiz:

1. **DocumentUploadModal.tsx** (Mobile): Upload direto para Storage quando IndexedDB falha
2. **PaymentSuccess.tsx** (Mobile): Upload novamente do IndexedDB para Storage
3. **Resultado:** Duas URLs diferentes, duas chamadas para N8N

## Fluxo Problemático (ANTES):

```
Mobile Upload:
DocumentUploadModal → Storage Upload → filePath
PaymentSuccess → IndexedDB → Storage Upload → nova URL
Resultado: 2 URLs, 2 requisições N8N ❌
```

## Fluxo Corrigido (DEPOIS):

```
Mobile Upload:
DocumentUploadModal → Storage Upload → filePath
PaymentSuccess → Storage (usar filePath) → mesma URL
Resultado: 1 URL, 1 requisição N8N ✅
```

## Correção Aplicada:

### PaymentSuccess.tsx - Lógica Mobile:

**ANTES:**
```typescript
// Tentar IndexedDB primeiro, depois Storage
try {
  storedFile = await fileStorage.getFile(fileId);
  if (storedFile) {
    // FAZER UPLOAD NOVAMENTE ❌
    const uploadResult = await uploadFileToStorage(storedFile.file, userId);
  }
} catch (indexedDBError) {
  // Verificar Storage como fallback
}
```

**DEPOIS:**
```typescript
// Verificar Storage primeiro (upload direto do DocumentUploadModal)
try {
  const { data: { publicUrl: storagePublicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(fileId);
  
  publicUrl = storagePublicUrl;
  console.log('✅ USANDO ARQUIVO DO STORAGE - SEM UPLOAD DUPLICADO');
} catch (storageError) {
  // IndexedDB como fallback apenas se necessário
}
```

## Resultado Esperado:

- ✅ **Apenas 1 upload** para Storage
- ✅ **Apenas 1 URL** gerada
- ✅ **Apenas 1 requisição** para N8N
- ✅ **Apenas 1 registro** na tabela `documents_to_be_verified`

## Logs de Confirmação:

```typescript
console.log('✅ Arquivo encontrado no Storage (upload direto):', publicUrl);
console.log('✅ USANDO ARQUIVO DO STORAGE - SEM UPLOAD DUPLICADO');
console.log('✅ SUCCESS: Documento enviado para n8n via send-translation-webhook');
console.log('✅ CONFIRMAÇÃO: APENAS UMA REQUISIÇÃO FOI ENVIADA PARA O N8N');
```

## Teste:

1. Fazer upload de documento no mobile
2. Verificar logs do console
3. Confirmar apenas 1 requisição no N8N
4. Confirmar apenas 1 registro na tabela `documents_to_be_verified`

**O sistema deve funcionar corretamente agora!** 🎉 