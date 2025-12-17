# Storage Trigger Setup

## Problema Identificado

O sistema estava assumindo que havia um Storage Trigger automático configurado, mas na verdade **não existe nenhum trigger** para chamar o `send-translation-webhook` quando um arquivo é enviado para o Storage.

## Situação Atual

- ✅ **Upload consolidado** (sem duplicação)
- ✅ **Chamada manual** restaurada na PaymentSuccess.tsx
- ❌ **Storage Trigger** não configurado

## Opções para Resolver

### Opção 1: Manter Chamada Manual (ATUAL)
**Vantagens:**
- Simples e funcional
- Controle total sobre quando enviar
- Fácil de debugar

**Desvantagens:**
- Requer chamada manual
- Pode ser esquecida

### Opção 2: Configurar Storage Trigger (RECOMENDADO)

#### Como Configurar Storage Trigger:

1. **Criar migração para Storage Trigger:**

```sql
-- Criar função para o trigger
CREATE OR REPLACE FUNCTION handle_storage_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar Edge Function send-translation-webhook
  PERFORM net.http_post(
    url := 'https://ywpogqwhwscbdhnoqsmv.supabase.co/functions/v1/send-translation-webhook',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}',
    body := json_build_object(
      'filename', NEW.name,
      'url', NEW.url,
      'mimetype', NEW.metadata->>'mimetype',
      'size', NEW.metadata->>'size',
      'user_id', NEW.metadata->>'user_id',
      'bucket', NEW.bucket_id
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
CREATE TRIGGER storage_upload_trigger
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'documents')
  EXECUTE FUNCTION handle_storage_upload();
```

2. **Instalar extensão http (se necessário):**
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

3. **Remover chamada manual** da PaymentSuccess.tsx

#### Vantagens do Storage Trigger:
- ✅ Automático
- ✅ Sempre executado
- ✅ Não pode ser esquecido
- ✅ Mais robusto

#### Desvantagens:
- ❌ Mais complexo de configurar
- ❌ Mais difícil de debugar
- ❌ Pode executar em momentos indesejados

## Recomendação

**Para agora:** Manter a chamada manual (já implementada)

**Para o futuro:** Considerar implementar Storage Trigger se quiser automatizar completamente o processo.

## Teste Atual

Com a correção implementada:
1. ✅ Upload de arquivo
2. ✅ Chamada manual para send-translation-webhook
3. ✅ Envio para N8N
4. ✅ Inserção na tabela documents_to_be_verified

**O sistema deve funcionar corretamente agora!** 