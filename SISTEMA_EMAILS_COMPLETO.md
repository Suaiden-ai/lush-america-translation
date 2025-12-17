# 📧 Sistema de Emails - Lush America Translations

## 📋 Visão Geral

O sistema de emails do Lush America Translations funciona em **duas camadas principais**:

1. **Emails de Autenticação (Supabase)**: Emails automáticos do Supabase para confirmação de cadastro e reset de senha
2. **Emails de Notificação (via n8n)**: Emails transacionais enviados através de webhooks para o n8n, que utiliza SMTP do Google

---

## 🔐 1. Emails de Autenticação (Supabase)

### Como Funciona

O Supabase gerencia automaticamente os emails de autenticação quando:
- Um usuário se cadastra (confirmação de email)
- Um usuário solicita reset de senha

### Configuração

#### 1.1. Templates de Email

Os templates estão localizados em `email-templates/`:

- **`confirm-signup.html`**: Template para confirmação de cadastro
- **`reset-password.html`**: Template para reset de senha

#### 1.2. Configuração no Supabase Dashboard

1. Acesse: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Vá para: **Authentication** > **Email Templates**
3. Configure os templates:
   - **Confirm signup**: Cole o conteúdo de `confirm-signup.html`
   - **Reset password**: Cole o conteúdo de `reset-password.html`

#### 1.3. Variáveis Disponíveis nos Templates

Os templates usam variáveis do Supabase:
- `{{ .ConfirmationURL }}`: URL de confirmação/reset gerada automaticamente
- Outras variáveis padrão do Supabase

#### 1.4. Configuração SMTP (Opcional - Não Configurado)

O arquivo `supabase/config.toml` mostra a configuração SMTP comentada:

```toml
# Use a production-ready SMTP server
# [auth.email.smtp]
# enabled = true
# host = "smtp.sendgrid.net"
# port = 587
# user = "apikey"
# pass = "env(SENDGRID_API_KEY)"
# admin_email = "admin@email.com"
# sender_name = "Admin"
```

**Nota**: Atualmente, o Supabase usa seu próprio serviço de email. Para usar SMTP customizado (Google, SendGrid, etc.), descomente e configure essas linhas.

---

## 📨 2. Emails de Notificação (via n8n + SMTP Google)

### Como Funciona

O sistema envia notificações através de **webhooks para o n8n**, que então processa e envia os emails usando **SMTP do Google**.

### Fluxo Completo

```
Aplicação → Webhook → n8n → SMTP Google → Email Enviado
```

### 2.1. Código que Envia Notificações

#### Arquivo: `src/utils/webhookNotifications.ts`

Este arquivo contém todas as funções para enviar notificações:

```typescript
const WEBHOOK_URL = 'https://nwh.thefutureofenglish.com/webhook/notthelush1';
```

**Funções disponíveis:**

1. **`notifyDocumentUpload(userId, filename, documentId?)`**
   - Notifica quando um documento é enviado
   - Tipo: `'Document Upload Notification'`

2. **`notifyPayment(userId, paymentInfo)`**
   - Notifica sobre pagamentos
   - Tipo: `'Payment Notification'`

3. **`notifyTranslationStarted(userId, filename, documentId?)`**
   - Notifica início de tradução
   - Tipo: `'Translation In Progress Notification'`

4. **`notifyTranslationCompleted(userId, filename, documentId?)`**
   - Notifica conclusão de tradução
   - Tipo: `'Translation Completed Notification'`

5. **`notifyAuthenticatorsPendingDocuments(userId, documentInfo)`**
   - Notifica autenticadores sobre documentos pendentes
   - Tipo: `'Authenticator Pending Documents Notification'`

#### Estrutura do Payload

```typescript
interface NotificationPayload {
  user_name: string;
  user_email: string;
  notification_type: string;
  timestamp: string;
  document_info?: {
    filename?: string;
    document_id?: string;
    status?: string;
    client_name?: string;
    client_email?: string;
  };
  payment_info?: {
    amount?: number;
    currency?: string;
    payment_id?: string;
  };
}
```

### 2.2. Onde as Notificações São Enviadas

#### A) Edge Function: `supabase/functions/stripe-webhook/index.ts`

Envia notificações quando:
- Pagamento Stripe é aprovado (linhas 500-544)
- Documento precisa de autenticação (linhas 546-599)

**Código relevante:**

```typescript
// Notificar admins sobre pagamento
const notificationPayload = {
  user_name: user.name || 'Unknown User',
  user_email: admin.email,
  notification_type: 'Payment Stripe',
  timestamp: new Date().toISOString(),
  filename: filename || 'Unknown Document',
  document_id: documentId,
  status: 'pagamento aprovado automaticamente'
};

const webhookResponse = await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(notificationPayload)
});
```

#### B) Frontend: `src/pages/ZelleCheckout.tsx`

Envia notificações quando:
- Pagamento Zelle é processado (linhas 343-360)

### 2.3. Configuração do n8n (Sistema Externo)

O n8n está configurado em: `https://nwh.thefutureofenglish.com`

**Webhook endpoint**: `/webhook/notthelush1`

#### Configuração SMTP no n8n

O n8n precisa estar configurado com:

1. **SMTP Host**: `smtp.gmail.com`
2. **Porta**: `587` (TLS) ou `465` (SSL)
3. **Usuário**: Email do Google (ex: `seu-email@gmail.com`)
4. **Senha**: Senha de app do Google (não a senha normal)

#### Como Obter Senha de App do Google

1. Acesse: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Selecione o app: "Mail"
3. Selecione o dispositivo: "Outro (nome personalizado)"
4. Digite: "n8n" ou "Lush America"
5. Clique em "Gerar"
6. Copie a senha de 16 caracteres
7. Use essa senha no n8n (não a senha normal do Gmail)

### 2.4. Workflow do n8n (Hipótese)

O n8n provavelmente tem um workflow assim:

1. **Recebe webhook** em `/webhook/notthelush1`
2. **Processa payload** (extrai dados)
3. **Seleciona template de email** baseado em `notification_type`
4. **Envia email via SMTP Google** usando:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Auth: Email + Senha de App
   - From: Email configurado no n8n
   - To: `user_email` do payload
   - Subject: Baseado no tipo de notificação
   - Body: Template HTML formatado

---

## 🔧 3. Implementação Completa para Outro Projeto

### 3.1. Configurar SMTP do Google no n8n

#### Passo 1: Criar Senha de App do Google

1. Acesse: [myaccount.google.com/security](https://myaccount.google.com/security)
2. Ative a verificação em duas etapas (obrigatório)
3. Vá para: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Gere uma senha de app para "Mail"
5. Copie a senha de 16 caracteres

#### Passo 2: Configurar n8n

1. Acesse seu n8n
2. Crie um novo workflow
3. Adicione node **"Webhook"**
   - Método: POST
   - Path: `/webhook/notthelush1` (ou o que preferir)
4. Adicione node **"Function"** (opcional, para processar dados)
5. Adicione node **"Send Email"** ou **"SMTP"**
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Secure**: `TLS` (ou `SSL` para porta 465)
   - **User**: Seu email Gmail (ex: `seu-email@gmail.com`)
   - **Password**: Senha de app gerada (16 caracteres)
   - **From Email**: Seu email Gmail
   - **From Name**: Nome da sua aplicação
   - **To Email**: `{{ $json.user_email }}` (do payload)
   - **Subject**: Baseado no tipo de notificação
   - **HTML**: Template HTML do email

#### Passo 3: Criar Templates de Email

Crie templates HTML para cada tipo de notificação:

- Upload de documento
- Pagamento aprovado
- Tradução iniciada
- Tradução concluída
- Documento pendente (para autenticadores)

### 3.2. Implementar no Código

#### Criar arquivo: `src/utils/emailNotifications.ts`

```typescript
const WEBHOOK_URL = 'https://seu-n8n.com/webhook/seu-endpoint';

interface NotificationPayload {
  user_name: string;
  user_email: string;
  notification_type: string;
  timestamp: string;
  [key: string]: any;
}

export async function sendEmailNotification(payload: NotificationPayload): Promise<void> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    console.log('✅ Email notification sent successfully');
  } catch (error) {
    console.error('❌ Error sending email notification:', error);
    // Não fazer throw para não quebrar o fluxo principal
  }
}

// Exemplo de uso
export async function notifyUser(userEmail: string, userName: string, type: string, data: any) {
  await sendEmailNotification({
    user_name: userName,
    user_email: userEmail,
    notification_type: type,
    ...data
  });
}
```

#### Usar no código

```typescript
import { notifyUser } from '@/utils/emailNotifications';

// Quando um documento é enviado
await notifyUser(
  user.email,
  user.name,
  'Document Upload Notification',
  {
    filename: 'documento.pdf',
    document_id: '123',
    status: 'pending'
  }
);
```

### 3.3. Configuração Alternativa: SMTP Direto (Sem n8n)

Se preferir enviar emails diretamente sem n8n:

#### Usando Nodemailer (Node.js/Deno)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true para 465, false para outras portas
  auth: {
    user: 'seu-email@gmail.com',
    pass: 'senha-de-app-google' // Senha de app, não senha normal
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  const info = await transporter.sendMail({
    from: '"Lush America" <seu-email@gmail.com>',
    to: to,
    subject: subject,
    html: html
  });

  console.log('Email sent:', info.messageId);
}
```

#### Variáveis de Ambiente

```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM_EMAIL=seu-email@gmail.com
SMTP_FROM_NAME=Lush America
```

---

## 📊 4. Resumo do Sistema Atual

### Emails de Autenticação
- **Gerenciado por**: Supabase
- **Templates**: `email-templates/confirm-signup.html` e `reset-password.html`
- **Configuração**: Supabase Dashboard > Authentication > Email Templates
- **SMTP**: Usa serviço padrão do Supabase (não configurado customizado)

### Emails de Notificação
- **Gerenciado por**: n8n (sistema externo)
- **Webhook**: `https://nwh.thefutureofenglish.com/webhook/notthelush1`
- **SMTP**: Google (configurado no n8n)
- **Código**: `src/utils/webhookNotifications.ts`
- **Tipos de notificação**:
  1. Document Upload
  2. Payment
  3. Translation Started
  4. Translation Completed
  5. Authenticator Pending Documents

---

## 🎯 5. Checklist para Replicar em Outro Projeto

### Para Emails de Autenticação (Supabase)
- [ ] Criar templates HTML (`confirm-signup.html`, `reset-password.html`)
- [ ] Configurar templates no Supabase Dashboard
- [ ] (Opcional) Configurar SMTP customizado no `supabase/config.toml`

### Para Emails de Notificação (n8n + Google SMTP)
- [ ] Criar conta n8n ou usar n8n existente
- [ ] Configurar workflow no n8n com webhook
- [ ] Obter senha de app do Google
- [ ] Configurar node SMTP no n8n com credenciais do Google
- [ ] Criar templates HTML para cada tipo de notificação
- [ ] Implementar `emailNotifications.ts` no código
- [ ] Adicionar chamadas de notificação nos pontos necessários
- [ ] Testar envio de emails

---

## 🔒 6. Segurança

### Boas Práticas

1. **Nunca commitar credenciais**: Use variáveis de ambiente
2. **Usar senha de app**: Nunca use senha normal do Gmail
3. **Rate limiting**: Implementar limite de emails por hora
4. **Validação**: Validar emails antes de enviar
5. **Logs**: Registrar tentativas de envio (sem dados sensíveis)

### Variáveis de Ambiente Seguras

```bash
# .env (nunca commitar)
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/seu-endpoint
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app-16-caracteres
```

---

## 📝 7. Exemplo Completo de Uso

```typescript
// src/utils/emailNotifications.ts
import { supabase } from '@/lib/supabase';

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 
  'https://nwh.thefutureofenglish.com/webhook/notthelush1';

export async function notifyDocumentUpload(userId: string, filename: string) {
  // Buscar dados do usuário
  const { data: user } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', userId)
    .single();

  if (!user?.email) return;

  // Enviar notificação
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_name: user.name || 'Usuário',
      user_email: user.email,
      notification_type: 'Document Upload Notification',
      timestamp: new Date().toISOString(),
      filename: filename,
      status: 'pending'
    })
  });
}
```

---

## 🐛 8. Troubleshooting

### Emails não estão sendo enviados

1. **Verificar webhook do n8n**:
   - Testar endpoint manualmente
   - Verificar logs do n8n

2. **Verificar SMTP do Google**:
   - Confirmar que senha de app está correta
   - Verificar se verificação em duas etapas está ativa
   - Testar conexão SMTP manualmente

3. **Verificar logs**:
   - Console do navegador (frontend)
   - Logs do n8n
   - Logs do Supabase (para emails de auth)

### Emails indo para spam

1. Configurar SPF/DKIM no domínio
2. Usar email corporativo em vez de Gmail pessoal
3. Evitar palavras que parecem spam no assunto
4. Incluir link de descadastro

---

## 📚 Referências

- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [n8n Documentation](https://docs.n8n.io/)
- [Nodemailer Documentation](https://nodemailer.com/about/)

---

**Última atualização**: Janeiro 2025
















