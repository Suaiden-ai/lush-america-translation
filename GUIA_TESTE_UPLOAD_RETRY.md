# Guia de Teste - Sistema de Reenvio de Upload

## 📋 Pré-requisitos

### 1. Aplicar Migrações SQL

Antes de testar, você precisa aplicar as migrações SQL no banco de dados:

**Opção A: Via Supabase Dashboard**
1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute as migrações na ordem:

```sql
-- Migração 1: Adicionar campos de rastreamento
-- Copie e cole o conteúdo de: supabase/migrations/20250131000001_add_upload_failed_field.sql

-- Migração 2: Criar função de detecção
-- Copie e cole o conteúdo de: supabase/migrations/20250131000002_add_missing_file_detection.sql
```

**Opção B: Via Supabase CLI**
```bash
supabase db push
```

---

## 🧪 Métodos de Teste

### Método 1: Simulação via Painel Admin (Recomendado)

Este é o método mais seguro e realista:

1. **Acesse o Admin Dashboard**
   - Faça login como admin
   - Vá para `/admin`
   - Clique na aba **"Test Tools"**

2. **Simular Falha de Upload**
   - Você verá uma lista de documentos recentes
   - Encontre um documento que tenha `file_url` (mostra "Presente")
   - Clique em **"Simular Falha"** ao lado do documento
   - Confirme a ação

3. **Verificar Resultado**
   - O documento deve ter `file_url` removido
   - O campo `upload_failed_at` deve ser preenchido
   - O documento deve aparecer na lista de documentos problemáticos

4. **Testar Reenvio**
   - Vá para o dashboard do cliente (`/dashboard/documents`)
   - Você deve ver um **banner de alerta** no topo
   - Clique em **"Ver Documentos"**
   - Ou acesse diretamente: `/dashboard/retry-upload?documentId={ID_DO_DOCUMENTO}`
   - Faça upload do arquivo PDF
   - Verifique se o upload foi bem-sucedido

---

### Método 2: Simulação via URL (Desenvolvimento)

Apenas funciona em ambiente de desenvolvimento:

1. **Ativar Simulação**
   - Acesse a página de upload normalmente
   - Adicione `?simulate_upload_error=true` na URL do PaymentSuccess
   - Ou adicione na URL antes de fazer o pagamento

2. **Fluxo de Teste**
   - Faça upload de um documento
   - Complete o pagamento
   - Quando chegar na página `PaymentSuccess`, o erro será simulado
   - Você será redirecionado para `/dashboard/retry-upload`

3. **Testar Reenvio**
   - Na página de reenvio, faça upload do arquivo
   - Verifique se funciona corretamente

**Exemplo de URL:**
```
http://localhost:5173/payment-success?session_id=xxx&simulate_upload_error=true
```

---

### Método 3: Simulação via localStorage (Desenvolvimento)

Para testes persistentes durante desenvolvimento:

1. **Ativar no Console do Navegador**
   ```javascript
   localStorage.setItem('simulate_upload_error', 'true');
   ```

2. **Fazer Upload Normal**
   - Faça upload e pagamento normalmente
   - O erro será simulado automaticamente

3. **Desativar**
   ```javascript
   localStorage.removeItem('simulate_upload_error');
   ```

---

## 🔍 Verificações e Testes

### Teste 1: Verificar Detecção de Documentos Problemáticos

1. **Via SQL (Supabase Dashboard)**
   ```sql
   -- Ver documentos com pagamento mas sem arquivo
   SELECT * FROM get_documents_with_missing_files();
   
   -- Ver documentos de um usuário específico
   SELECT * FROM get_documents_with_missing_files('USER_ID_AQUI');
   ```

2. **Via Interface**
   - Acesse `/dashboard/documents` como cliente
   - Se houver documentos problemáticos, você verá o banner de alerta

---

### Teste 2: Testar Reenvio Completo

1. **Criar Caso de Teste**
   - Use o painel admin para simular falha em um documento
   - Ou use um documento real que já tenha o problema

2. **Acessar Página de Reenvio**
   - URL: `/dashboard/retry-upload?documentId={ID}`
   - Ou clique no banner de alerta

3. **Fazer Upload**
   - Arraste e solte um arquivo PDF
   - Ou clique em "Selecionar arquivo"
   - Clique em "Reenviar Documento"
   - Aguarde o progresso

4. **Verificar Resultado**
   - O documento deve ter `file_url` preenchido
   - O campo `upload_failed_at` deve ser NULL
   - O campo `upload_retry_count` deve ser incrementado
   - O status deve mudar para `pending`
   - O documento deve ser enviado para o n8n

---

### Teste 3: Verificar Alertas no Dashboard

1. **Como Cliente**
   - Acesse `/dashboard/documents`
   - Se houver documentos problemáticos, você deve ver:
     - Banner amarelo no topo
     - Contador de documentos afetados
     - Botão "Ver Documentos"

2. **Verificar Lista de Documentos**
   - Os documentos problemáticos devem ter indicador visual
   - Deve ser possível clicar para reenviar

---

### Teste 4: Testar Validações

1. **Arquivo Inválido**
   - Tente fazer upload de um arquivo que não seja PDF
   - Deve mostrar erro: "Apenas arquivos PDF são permitidos"

2. **Arquivo Muito Grande**
   - Tente fazer upload de arquivo > 10MB
   - Deve mostrar erro de tamanho máximo

3. **Documento Sem Pagamento**
   - Tente reenviar documento que não tem pagamento confirmado
   - Deve mostrar erro apropriado

---

## 📊 Verificações no Banco de Dados

### Verificar Campos Novos

```sql
-- Ver se os campos foram criados
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
AND column_name IN ('upload_failed_at', 'upload_retry_count');
```

### Verificar Função SQL

```sql
-- Testar a função de detecção
SELECT * FROM get_documents_with_missing_files();

-- Ver apenas documentos de um usuário
SELECT * FROM get_documents_with_missing_files('USER_ID_AQUI');
```

### Verificar Documento Após Reenvio

```sql
-- Verificar se upload_failed_at foi limpo
SELECT 
  id,
  filename,
  file_url,
  upload_failed_at,
  upload_retry_count,
  status
FROM documents
WHERE id = 'DOCUMENT_ID_AQUI';
```

---

## 🐛 Troubleshooting

### Problema: Banner de alerta não aparece

**Soluções:**
1. Verificar se há documentos com pagamento mas sem arquivo:
   ```sql
   SELECT * FROM get_documents_with_missing_files();
   ```
2. Verificar se o hook está funcionando (abrir console do navegador)
3. Verificar se o componente está renderizado (inspecionar elemento)

---

### Problema: Reenvio não funciona

**Soluções:**
1. Verificar console do navegador para erros
2. Verificar se o documento tem pagamento confirmado:
   ```sql
   SELECT p.* FROM payments p
   WHERE p.document_id = 'DOCUMENT_ID'
   AND p.status = 'completed';
   ```
3. Verificar logs da Edge Function no Supabase Dashboard

---

### Problema: Simulação não funciona

**Soluções:**
1. Verificar se está em ambiente de desenvolvimento (`import.meta.env.DEV`)
2. Verificar se a flag está correta na URL ou localStorage
3. Verificar console do navegador para logs de debug

---

## ✅ Checklist de Testes

- [ ] Migrações SQL aplicadas
- [ ] Função `get_documents_with_missing_files()` funciona
- [ ] Campos `upload_failed_at` e `upload_retry_count` existem
- [ ] Painel admin "Test Tools" aparece
- [ ] Simulação de erro funciona no painel admin
- [ ] Banner de alerta aparece no dashboard do cliente
- [ ] Página de reenvio funciona (`/dashboard/retry-upload`)
- [ ] Upload de reenvio funciona corretamente
- [ ] Validações de arquivo funcionam (tipo, tamanho)
- [ ] Documento é atualizado após reenvio bem-sucedido
- [ ] Webhook é chamado após reenvio
- [ ] Logs aparecem corretamente

---

## 🎯 Cenários de Teste Recomendados

### Cenário 1: Fluxo Completo
1. Admin simula falha em documento pago
2. Cliente vê alerta no dashboard
3. Cliente faz reenvio
4. Verificar que documento foi atualizado
5. Verificar que foi enviado para n8n

### Cenário 2: Múltiplos Documentos
1. Simular falha em 2-3 documentos
2. Verificar que contador mostra número correto
3. Testar reenvio de cada um

### Cenário 3: Validações
1. Tentar enviar arquivo não-PDF
2. Tentar enviar arquivo muito grande
3. Verificar mensagens de erro apropriadas

---

## 📝 Notas Importantes

1. **Apenas em Desenvolvimento**: Simulação via URL/localStorage só funciona em `localhost`
2. **Produção**: Use apenas o painel admin para simular erros
3. **Dados Reais**: Cuidado ao simular erros em documentos de produção
4. **Backup**: Considere fazer backup antes de testar em produção

---

## 🚀 Próximos Passos Após Testes

Se tudo funcionar:
1. Monitorar casos reais no banco
2. Verificar se alertas aparecem para clientes reais
3. Acompanhar logs de reenvio
4. Coletar feedback dos usuários

