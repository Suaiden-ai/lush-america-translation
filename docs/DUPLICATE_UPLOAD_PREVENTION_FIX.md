# Duplicate Upload Prevention Fix

## 🚨 **Problema Identificado**

Após remover a validação de duplicatas no banco de dados, começou a acontecer **duplicação real de documentos** no sistema, sugerindo que há **múltiplas chamadas** para o webhook `send-translation-webhook`.

### **Logs de Evidência:**
```
[User Upload] → Documento A criado
[Automatic Trigger?] → Documento A criado novamente
Resultado: 2 documentos idênticos no banco
```

## 🔍 **Análise do Problema**

### **Possíveis Causas:**

1. **Storage Trigger Automático:** Supabase pode ter um Storage Hook configurado que chama automaticamente `send-translation-webhook` quando um arquivo é enviado para o storage

2. **Múltiplas Chamadas do Frontend:** Código frontend fazendo múltiplas chamadas

3. **Cache Anti-Duplicação Deficiente:** O cache da Edge Function estava usando `Date.now()` no `requestId`, fazendo com que requests idênticos fossem considerados diferentes

## ✅ **Correção Implementada**

### **1. Melhoria do Cache Anti-Duplicação na Edge Function:**

**ANTES (PROBLEMÁTICO):**
```typescript
// ❌ RequestId incluía timestamp, fazendo requests iguais parecerem diferentes
const requestId = `${parsedBody.user_id || 'unknown'}_${parsedBody.filename || 'unknown'}_${Date.now()}`;

// ❌ Cache de apenas 30 segundos era muito curto
if (lastProcessed && (now - lastProcessed) < 30000) {
```

**DEPOIS (CORRIGIDO):**
```typescript
// ✅ RequestId baseado apenas em user_id e filename (sem timestamp)
const requestId = `${parsedBody.user_id || 'unknown'}_${parsedBody.filename || 'unknown'}`;

// ✅ Cache de 2 minutos para prevenir duplicatas adequadamente
if (lastProcessed && (now - lastProcessed) < 120000) { // 2 minutos
```

### **2. Benefícios da Correção:**

- ✅ **Detecção correta** de requests duplicados do mesmo usuário com mesmo arquivo
- ✅ **Cache mais efetivo** com 2 minutos de duração
- ✅ **Prevenção automática** de processamento duplicado
- ✅ **Logs claros** sobre requests que foram ignorados por serem duplicados

## 🔧 **Como Funciona Agora**

### **Fluxo de Prevenção:**

```
1. User faz upload → send-translation-webhook
2. RequestId gerado: "user123_document.pdf"
3. Request processado e salvo no cache
4. Se outra chamada chegar com mesmo user + filename dentro de 2 minutos:
   → Cache detecta duplicata
   → Request ignorado
   → Retorna sucesso sem processar
5. Após 2 minutos, cache expira e permite novo upload
```

### **Logs Esperados:**
```
Request ID: user123_document.pdf
Request already processed recently, skipping duplicate processing
```

## 🚀 **Verificação Adicional Necessária**

Para identificar completamente a fonte das duplicatas, é recomendado:

### **1. Verificar Storage Hooks no Supabase Dashboard:**
```
1. Acessar Supabase Dashboard
2. Ir para Storage > Settings/Hooks
3. Verificar se há hooks configurados
4. Se houver hook chamando send-translation-webhook, remover ou ajustar
```

### **2. Executar SQL de Verificação:**
Execute o arquivo `check_storage_triggers.sql` no Supabase para verificar se há triggers automáticos configurados.

## 📊 **Resultado Esperado**

### **Antes da Correção:**
- ❌ Múltiplas chamadas processadas
- ❌ Documentos duplicados criados
- ❌ Cache ineficaz por usar timestamp

### **Depois da Correção:**
- ✅ **Apenas primeira chamada processada** para cada user+filename
- ✅ **Calls subsequentes ignoradas** dentro de 2 minutos
- ✅ **Cache efetivo** baseado em conteúdo real
- ✅ **Logs claros** sobre duplicatas detectadas

## 🔍 **Monitoramento**

Para verificar se a correção está funcionando:

1. **Logs da Edge Function:** Procurar por mensagens "Request already processed recently"
2. **Banco de dados:** Verificar se novos uploads não criam documentos duplicados
3. **Comportamento do usuário:** Upload deve funcionar normalmente, mas duplicatas devem ser prevenidas

## 📝 **Arquivos Modificados**

- `supabase/functions/send-translation-webhook/index.ts` - Melhorado cache anti-duplicação
- `check_storage_triggers.sql` - SQL para verificar triggers automáticos

## 🎯 **Próximos Passos**

1. **Monitorar** os logs para confirmar que duplicatas estão sendo prevenidas
2. **Verificar** no Supabase Dashboard se há Storage Hooks configurados
3. **Testar** uploads para garantir que não há mais duplicação
4. **Documentar** qualquer Storage Hook encontrado e removê-lo se necessário

---

**A correção deve prevenir a maioria das duplicações através do cache melhorado, mas a verificação de Storage Hooks é crucial para resolver completamente o problema.** 🎯
