# Configuração do Stripe para Lush America Translations

Este guia explica como configurar o Stripe para processar pagamentos dinâmicos no projeto.

## 1. Configuração do Stripe

### 1.1 Criar conta no Stripe
1. Acesse [stripe.com](https://stripe.com) e crie uma conta
2. Complete a verificação da conta (KYC)
3. Obtenha suas chaves de API

### 1.2 Obter chaves de API
No Dashboard do Stripe, vá para **Developers > API keys** e copie:
- **Publishable key** (chave pública)
- **Secret key** (chave secreta)

## 2. Configuração das Edge Functions

### 2.1 Variáveis de Ambiente
Configure as seguintes variáveis de ambiente no Supabase:

```bash
# Chaves do Stripe
STRIPE_SECRET_KEY=sk_test_... # ou sk_live_... para produção
STRIPE_WEBHOOK_SECRET=whsec_... # será gerado na próxima etapa

# Supabase (já configurado)
SUPABASE_URL=https://ywpogqwhwscbdhnoqsmv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.2 Configurar no Supabase Dashboard
1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para **Settings > API**
3. Em **Environment Variables**, adicione as variáveis acima

## 3. Configuração do Webhook

### 3.1 Criar Webhook no Stripe
1. No Dashboard do Stripe, vá para **Developers > Webhooks**
2. Clique em **Add endpoint**
3. Configure:
   - **Endpoint URL**: `https://ywpogqwhwscbdhnoqsmv.functions.supabase.co/stripe-webhook`
   - **Events to send**: Selecione:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

### 3.2 Obter Webhook Secret
Após criar o webhook, copie o **Signing secret** e adicione como `STRIPE_WEBHOOK_SECRET` nas variáveis de ambiente.

## 4. Deploy das Edge Functions

### 4.1 Deploy via Supabase CLI
```bash
# Instalar Supabase CLI se ainda não tiver
npm install -g supabase

# Fazer login
supabase login

# Linkar ao projeto
supabase link --project-ref ywpogqwhwscbdhnoqsmv

# Deploy das functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### 4.2 Verificar Deploy
As functions estarão disponíveis em:
- `https://ywpogqwhwscbdhnoqsmv.functions.supabase.co/create-checkout-session`
- `https://ywpogqwhwscbdhnoqsmv.functions.supabase.co/stripe-webhook`

## 5. Teste da Integração

### 5.1 Cartões de Teste
Use estes cartões para testar:
- **Sucesso**: `4242 4242 4242 4242`
- **Falha**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### 5.2 Fluxo de Teste
1. Faça upload de um documento
2. Selecione os serviços desejados
3. Clique em "Pagar"
4. Complete o checkout no Stripe
5. Verifique se o documento foi atualizado no banco

## 6. Estrutura de Preços

O sistema calcula preços dinamicamente:

```javascript
// Preço base
const basePrice = 20; // $20 por página

// Serviços adicionais
if (isCertified) basePrice += 10; // +$10 por página
if (isNotarized) basePrice += 15; // +$15 por página  
if (isBankStatement) basePrice += 5; // +$5 por página

// Total
const totalPrice = basePrice * pages;
```

## 7. Monitoramento

### 7.1 Logs das Edge Functions
Monitore os logs em:
- Supabase Dashboard > Functions > Logs
- Stripe Dashboard > Developers > Logs

### 7.2 Webhook Events
Verifique os eventos do webhook em:
- Stripe Dashboard > Developers > Webhooks > [seu webhook] > Events

## 8. Produção

### 8.1 Checklist para Produção
- [ ] Mudar para chaves `live` do Stripe
- [ ] Configurar domínio personalizado
- [ ] Testar webhook em produção
- [ ] Configurar notificações de erro
- [ ] Implementar retry logic para webhooks

### 8.2 Segurança
- Nunca exponha `STRIPE_SECRET_KEY` no frontend
- Sempre verifique assinaturas de webhook
- Use HTTPS em produção
- Implemente rate limiting

## 9. Troubleshooting

### 9.1 Erros Comuns

**"STRIPE_SECRET_KEY não configurada"**
- Verifique se a variável está configurada no Supabase
- Reinicie as Edge Functions após configurar

**"Webhook signature verification failed"**
- Verifique se `STRIPE_WEBHOOK_SECRET` está correto
- Confirme se o webhook está configurado corretamente

**"Failed to update document"**
- Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada
- Confirme se as tabelas existem no banco

### 9.2 Debug
Adicione logs nas Edge Functions para debug:
```javascript
console.log('DEBUG: Dados recebidos:', data);
```

## 10. Suporte

Para dúvidas sobre:
- **Stripe**: [stripe.com/docs](https://stripe.com/docs)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Projeto**: Entre em contato com a equipe de desenvolvimento 