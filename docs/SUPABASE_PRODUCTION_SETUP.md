# 🔧 Configuração do Supabase para Produção

## Problema Identificado

O Supabase está enviando links de reset de senha para `localhost` porque as configurações estão apontando para o ambiente de desenvolvimento.

## Solução

### 1. Configurar URLs no Supabase Dashboard

1. **Acesse o Supabase Dashboard**:
   - Vá para [supabase.com/dashboard](https://supabase.com/dashboard)
   - Selecione seu projeto

2. **Configurar Authentication Settings**:
   - Vá para **Authentication** > **Settings**
   - Em **Site URL**, configure sua URL de produção:
     ```
     https://your-domain.com
     ```
   - Em **Redirect URLs**, adicione:
     ```
     https://your-domain.com/reset-password
     https://your-domain.com/auth/callback
     ```

3. **Configurar Email Templates**:
   - Vá para **Authentication** > **Email Templates**
   - Configure os templates de email para usar a URL correta

### 2. Atualizar Configurações Locais

#### Arquivo `supabase/config.toml`

```toml
[auth]
enabled = true
# Atualizar para sua URL de produção
site_url = "https://your-domain.com"
# Adicionar URLs de redirecionamento permitidas
additional_redirect_urls = [
  "https://your-domain.com",
  "https://your-domain.com/reset-password",
  "https://your-domain.com/auth/callback"
]
```

#### Variáveis de Ambiente

Crie um arquivo `.env.production`:

```bash
# Supabase
VITE_SUPABASE_URL=https://ywpogqwhwscbdhnoqsmv.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# URLs de produção
VITE_SITE_URL=https://your-domain.com
```

### 3. Configurar SMTP para Produção

#### Opção 1: SendGrid

1. **Criar conta no SendGrid**:
   - Acesse [sendgrid.com](https://sendgrid.com)
   - Crie uma conta e obtenha uma API key

2. **Configurar no Supabase**:
   ```toml
   [auth.email.smtp]
   enabled = true
   host = "smtp.sendgrid.net"
   port = 587
   user = "apikey"
   pass = "env(SENDGRID_API_KEY)"
   admin_email = "admin@your-domain.com"
   sender_name = "Your App Name"
   ```

#### Opção 2: Resend

1. **Criar conta no Resend**:
   - Acesse [resend.com](https://resend.com)
   - Crie uma conta e obtenha uma API key

2. **Configurar no Supabase**:
   ```toml
   [auth.email.smtp]
   enabled = true
   host = "smtp.resend.com"
   port = 587
   user = "resend"
   pass = "env(RESEND_API_KEY)"
   admin_email = "admin@your-domain.com"
   sender_name = "Your App Name"
   ```

### 4. Atualizar Templates de Email

#### Template de Reset de Senha

Atualize o arquivo `email-templates/reset-password.html`:

```html
<!-- Substituir a URL da logo -->
<img src="https://your-domain.com/logo.png" alt="Your App" class="logo">

<!-- Substituir links do footer -->
<a href="https://your-domain.com">Website</a>
<a href="mailto:support@your-domain.com">Support</a>
<a href="https://your-domain.com/privacy">Privacy Policy</a>
```

### 5. Verificar Configurações

#### Teste de Reset de Senha

1. **Teste local**:
   ```bash
   npm run dev
   # Acesse http://localhost:3000/forgot-password
   # Teste o reset de senha
   ```

2. **Teste em produção**:
   - Deploy para produção
   - Teste o reset de senha com um email real
   - Verifique se o link redireciona corretamente

### 6. Monitoramento

#### Logs do Supabase

1. **Verificar logs**:
   - Vá para **Logs** > **Auth**
   - Monitore tentativas de reset de senha
   - Verifique se há erros

2. **Métricas**:
   - Vá para **Analytics** > **Auth**
   - Monitore taxa de sucesso do reset de senha

## Comandos Úteis

### Deploy das Configurações

```bash
# Fazer deploy das configurações
supabase db push

# Verificar status
supabase status
```

### Verificar Configurações

```bash
# Verificar configurações atuais
supabase config show

# Listar projetos
supabase projects list
```

## Troubleshooting

### Problema: Links ainda apontam para localhost

**Solução**:
1. Verifique se as configurações foram salvas no Supabase Dashboard
2. Aguarde alguns minutos para as mudanças propagarem
3. Teste novamente

### Problema: Emails não são enviados

**Solução**:
1. Verifique se o SMTP está configurado corretamente
2. Teste com um email válido
3. Verifique os logs do Supabase

### Problema: Redirecionamento não funciona

**Solução**:
1. Verifique se as URLs estão na lista de redirecionamentos permitidos
2. Teste com diferentes navegadores
3. Verifique se há bloqueadores de popup

## Próximos Passos

1. ✅ Configurar URLs no Supabase Dashboard
2. ✅ Atualizar templates de email
3. ✅ Configurar SMTP
4. ✅ Testar em ambiente de produção
5. ✅ Monitorar logs e métricas

---

**💡 Dica**: Sempre teste as configurações em um ambiente de staging antes de aplicar em produção! 