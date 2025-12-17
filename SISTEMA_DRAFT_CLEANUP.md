# Documentação: Sistema de Verificação e Exclusão de Documentos Draft

## 📋 Visão Geral

O sistema de **Draft Cleanup** permite que administradores verifiquem e removam documentos que foram enviados pelos clientes mas não tiveram o pagamento concluído. Esses documentos ficam com status `draft` e podem ser identificados e removidos de forma segura através do dashboard do admin.

### 🎯 Objetivo

- Identificar documentos que foram enviados mas não pagos
- Verificar a segurança de remover cada documento
- Permitir que administradores removam documentos seguros para cleanup
- Proteger documentos que têm pagamentos ou sessões ativas

---

## 🔍 O que são Documentos Draft?

Documentos **draft** são documentos que:
- Foram enviados pelos clientes através do sistema de upload
- **Não tiveram o pagamento concluído**
- Ficam com status `draft` no banco de dados
- Podem ter sessões Stripe criadas mas não completadas
- Não geram receita para a empresa

### Exemplos de Cenários:

1. **Cliente faz upload mas não completa o pagamento**
   - Documento criado com `status = 'draft'`
   - Sessão Stripe criada mas não completada
   - Após 30 minutos, pode ser considerado para cleanup

2. **Sessão Stripe expira**
   - Cliente inicia pagamento mas não completa
   - Sessão Stripe expira (após 24 horas)
   - Documento pode ser removido com segurança

3. **Pagamento falha**
   - Cliente tenta pagar mas o pagamento falha
   - Sessão Stripe marcada como `failed`
   - Documento pode ser removido

---

## 🖥️ Interface no Admin Dashboard

### Localização

**Aba "Draft Cleanup"** no Admin Dashboard:
- **Rota**: `/admin#draft-cleanup`
- **Componente**: `src/pages/AdminDashboard/DraftCleanupApproval.tsx`
- **Acesso**: Apenas usuários com role `admin` ou `lush-admin`

### Estrutura da Interface

A interface é dividida em duas seções:

#### 1. **Documents Safe for Removal** (Documentos Seguros para Remoção)
- Lista de documentos que podem ser removidos com segurança
- Mostra informações: filename, data de criação, motivo da remoção
- Permite seleção individual ou seleção de todos
- Botão para remover documentos selecionados

#### 2. **Protected Documents** (Documentos Protegidos)
- Lista de documentos que **NÃO devem ser removidos**
- Documentos com pagamentos confirmados
- Sessões Stripe ativas ou recentes
- Mostra o motivo da proteção

### Funcionalidades

1. **Botão "Check Documents"**
   - Busca todos os documentos draft no sistema
   - Verifica cada documento individualmente
   - Categoriza em "seguros para remover" e "protegidos"
   - Sincroniza status das sessões Stripe

2. **Seleção de Documentos**
   - Checkbox individual para cada documento
   - Checkbox "Select All" para selecionar todos
   - Contador de documentos selecionados

3. **Botão "Remove Selected"**
   - Remove apenas documentos selecionados
   - Ação irreversível (com confirmação visual)
   - Remove documento, arquivo do storage e sessões Stripe

---

## 🔄 Fluxo de Verificação

### 1. Buscar Documentos Draft

**Edge Function**: `list-drafts-for-cleanup`

```189:193:supabase/functions/list-drafts-for-cleanup/index.ts
    const { data: draftsToReview, error: queryError } = await supabase
      .from('documents')
      .select('id, filename, file_url, user_id, created_at')
      .eq('status', 'draft')
      .lt('created_at', thirtyMinutesAgo); // Criado há mais de 30 minutos (sem limite superior de idade)
```

**Critérios:**
- Status = `'draft'`
- Criado há mais de 30 minutos (evita remover documentos muito recentes)

### 2. Sincronizar Sessões Stripe

Antes de categorizar os documentos, o sistema sincroniza as sessões Stripe:

```15:147:supabase/functions/list-drafts-for-cleanup/index.ts
async function syncStripeSessions(supabase: any, stripe: Stripe, stripeConfig: any): Promise<{ checked: number, updated: number }> {
  console.log(`🔄 [LIST-CLEANUP] Sincronizando sessões Stripe pending...`);
  
  try {
    // Buscar sessões pending que foram atualizadas há mais de 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: pendingSessions, error: queryError } = await supabase
      .from('stripe_sessions')
      .select('id, session_id, payment_status, updated_at')
      .eq('payment_status', 'pending')
      .lt('updated_at', thirtyMinutesAgo);

    if (queryError) {
      console.error('❌ [LIST-CLEANUP] Erro ao buscar sessões pending:', queryError);
      return { checked: 0, updated: 0 };
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      console.log('✅ [LIST-CLEANUP] Nenhuma sessão pending para sincronizar');
      return { checked: 0, updated: 0 };
    }

    console.log(`🔍 [LIST-CLEANUP] Verificando ${pendingSessions.length} sessões pending no Stripe...`);

    let checkedCount = 0;
    let updatedCount = 0;

    // Verificar cada sessão no Stripe (com limite para não sobrecarregar)
    const sessionsToCheck = pendingSessions.slice(0, 50); // Limite de 50 por execução
    
    for (const session of sessionsToCheck) {
      try {
        checkedCount++;

        // Verificar se a sessão é de produção (cs_live_) mas estamos em ambiente de teste
        // Neste caso, não podemos verificar com as chaves de teste, então pulamos
        const isLiveSession = session.session_id.startsWith('cs_live_');
        const isTestEnvironment = stripeConfig.environment.environment === 'test';
        
        if (isLiveSession && isTestEnvironment) {
          // Sessão de produção não pode ser verificada em ambiente de teste
          // Não fazer nada - deixar para verificar em produção
          console.log(`⚠️ [LIST-CLEANUP] Sessão ${session.session_id} (live) ignorada - ambiente test não pode verificar sessões de produção`);
          continue;
        }

        // Consultar a sessão no Stripe
        const stripeSession = await stripe.checkout.sessions.retrieve(session.session_id);

        // Verificar se o status mudou
        let newStatus = session.payment_status;
        let shouldUpdate = false;

        if (stripeSession.status === 'expired') {
          newStatus = 'expired';
          shouldUpdate = true;
          console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} expirada no Stripe`);
        } else if (stripeSession.status === 'complete' && stripeSession.payment_status === 'paid') {
          newStatus = 'completed';
          shouldUpdate = true;
          console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} completada no Stripe`);
        } else if (stripeSession.status === 'open') {
          // Verificar se expirou por tempo (Stripe expira após 24h)
          const expiresAt = stripeSession.expires_at ? new Date(stripeSession.expires_at * 1000) : null;
          if (expiresAt && expiresAt < new Date()) {
            newStatus = 'expired';
            shouldUpdate = true;
            console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} expirada por tempo`);
          }
        }

        // Atualizar o banco se necessário
        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('stripe_sessions')
            .update({
              payment_status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`❌ [LIST-CLEANUP] Erro ao atualizar sessão ${session.session_id}:`, updateError);
          } else {
            updatedCount++;
          }
        }

        // Pequeno delay para não sobrecarregar a API do Stripe
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (sessionError: any) {
        // Se o erro for "No such checkout.session", verificar se é realmente um erro ou incompatibilidade de ambiente
        if (sessionError.message && sessionError.message.includes('No such checkout.session')) {
          const isLiveSession = session.session_id.startsWith('cs_live_');
          const isTestEnvironment = stripeConfig.environment.environment === 'test';
          
          // Se for sessão de produção em ambiente de teste, apenas pular (não podemos verificar)
          if (isLiveSession && isTestEnvironment) {
            console.log(`⚠️ [LIST-CLEANUP] Sessão ${session.session_id} (live) não pode ser verificada em ambiente test - ignorando`);
            continue;
          }
          
          // Se for sessão de teste e não existe, marcar como expirada (sessão realmente não existe)
          console.log(`⚠️ [LIST-CLEANUP] Sessão ${session.session_id} não encontrada no Stripe, marcando como expirada`);
          
          const { error: updateError } = await supabase
            .from('stripe_sessions')
            .update({
              payment_status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (!updateError) {
            updatedCount++;
            console.log(`✅ [LIST-CLEANUP] Sessão ${session.session_id} marcada como expirada`);
          }
        } else {
          console.error(`❌ [LIST-CLEANUP] Erro ao verificar sessão ${session.session_id}:`, sessionError.message);
        }
      }
    }

    console.log(`✅ [LIST-CLEANUP] Sincronização concluída: ${checkedCount} verificadas, ${updatedCount} atualizadas`);
    return { checked: checkedCount, updated: updatedCount };

  } catch (error: any) {
    console.error('❌ [LIST-CLEANUP] Erro na sincronização de sessões Stripe:', error.message);
    return { checked: 0, updated: 0 };
  }
}
```

**O que faz:**
- Busca sessões Stripe com status `pending` atualizadas há mais de 30 minutos
- Verifica o status real no Stripe
- Atualiza sessões expiradas ou completadas
- Limite de 50 sessões por execução para não sobrecarregar a API

### 3. Categorizar Documentos

Para cada documento draft, o sistema verifica:

```219:341:supabase/functions/list-drafts-for-cleanup/index.ts
    for (const doc of draftsToReview) {
      try {
        // Buscar sessões Stripe para este documento
        const { data: sessions, error: sessionError } = await supabase
          .from('stripe_sessions')
          .select('session_id, payment_status, updated_at')
          .eq('document_id', doc.id);

        if (sessionError) {
          console.error(`⚠️ [LIST-CLEANUP] Erro ao buscar sessões para ${doc.id}:`, sessionError);
          documentsToKeep.push({
            ...doc,
            reason: 'Erro ao verificar sessões Stripe',
            sessions: []
          });
          continue;
        }

        // Verificar se tem pagamento confirmado
        const { data: payments } = await supabase
          .from('payments')
          .select('id')
          .eq('document_id', doc.id);

        // LÓGICA DE SEGURANÇA - só incluir se realmente seguro para apagar
        if (payments && payments.length > 0) {
          documentsToKeep.push({
            ...doc,
            reason: 'Tem pagamento confirmado',
            sessions: sessions || [],
            payments: payments
          });
          continue;
        }

        if (!sessions || sessions.length === 0) {
          // Sem sessão Stripe = seguro para apagar
          documentsToCleanup.push({
            ...doc,
            reason: 'Sem sessão Stripe',
            sessions: [],
            payments: []
          });
          continue;
        }

        // Se tem sessão, verificar se expirou
        const session = sessions[0];
        const sessionUpdatedAt = new Date(session.updated_at).getTime();
        // Cutoff de inatividade para considerar sessão como expirada: 24 horas
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

        // Sessões marcadas como expired ou failed são seguras para apagar
        if (session.payment_status === 'expired' || session.payment_status === 'failed') {
          documentsToCleanup.push({
            ...doc,
            reason: `Sessão Stripe ${session.payment_status}`,
            sessions: sessions,
            payments: []
          });
          continue;
        }

        // Sessão completed = sempre protegido
        if (session.payment_status === 'completed') {
          documentsToKeep.push({
            ...doc,
            reason: 'Sessão Stripe completed',
            sessions: sessions,
            payments: []
          });
          continue;
        }

        // Sessões pending: verificar se são antigas ou recentes
        if (session.payment_status === 'pending') {
          // Se foi atualizada há mais de 24 horas, considerar expirada
          if (sessionUpdatedAt < twentyFourHoursAgo) {
            documentsToCleanup.push({
              ...doc,
              reason: 'Sessão Stripe pending antiga (mais de 24 horas)',
              sessions: sessions,
              payments: []
            });
          } else {
            // Sessão pending recente = proteger
            documentsToKeep.push({
              ...doc,
              reason: 'Sessão Stripe pending',
              sessions: sessions,
              payments: []
            });
          }
          continue;
        }

        // Outros casos: considerar antigo se mais de 24 horas
        if (sessionUpdatedAt < twentyFourHoursAgo) {
          documentsToCleanup.push({
            ...doc,
            reason: 'Sessão Stripe antiga (mais de 24 horas)',
            sessions: sessions,
            payments: []
          });
        } else {
          documentsToKeep.push({
            ...doc,
            reason: 'Sessão Stripe recente (menos de 24 horas)',
            sessions: sessions,
            payments: []
          });
        }

      } catch (docError) {
        console.error(`❌ [LIST-CLEANUP] Erro ao processar documento ${doc.id}:`, docError);
        documentsToKeep.push({
          ...doc,
          reason: 'Erro no processamento',
          sessions: [],
          payments: []
        });
      }
    }
```

**Lógica de Categorização:**

#### ✅ **Seguro para Remover** (`documentsToCleanup`):
1. **Sem sessão Stripe** - Cliente nunca iniciou pagamento
2. **Sessão expirada** (`expired`) - Sessão Stripe expirou
3. **Sessão falhou** (`failed`) - Pagamento falhou
4. **Sessão pending antiga** - Mais de 24 horas sem atualização

#### 🛡️ **Protegido** (`documentsToKeep`):
1. **Tem pagamento confirmado** - Existe registro na tabela `payments`
2. **Sessão completed** - Pagamento foi concluído
3. **Sessão pending recente** - Menos de 24 horas (pode estar em processo)
4. **Erro na verificação** - Em caso de erro, proteger o documento

---

## 🗑️ Processo de Exclusão

### Edge Function: `approved-cleanup`

Quando o admin seleciona documentos e clica em "Remove Selected", a função `approved-cleanup` é chamada:

```47:119:supabase/functions/approved-cleanup/index.ts
    for (const documentId of documentIds) {
      try {
        console.log(`🗑️ [APPROVED-CLEANUP] Processando documento ${documentId}`);

        // 1. Buscar informações do documento antes de apagar
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('id, filename, file_url, user_id')
          .eq('id', documentId)
          .eq('status', 'draft')
          .single();

        if (docError || !doc) {
          console.error(`⚠️ [APPROVED-CLEANUP] Documento ${documentId} não encontrado ou não é draft:`, docError);
          errors.push({ documentId, error: 'Documento não encontrado ou não é draft' });
          continue;
        }

        // 2. Apagar arquivo do storage
        if (doc.file_url) {
          try {
            const filePath = doc.file_url.split('/storage/v1/object/public/')[1];
            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([filePath]);

            if (storageError) {
              console.error(`⚠️ [APPROVED-CLEANUP] Erro ao remover arquivo do storage para ${documentId}:`, storageError);
            } else {
              console.log(`🗑️ [APPROVED-CLEANUP] Arquivo removido do storage para doc ${documentId}`);
              storageDeletedCount++;
            }
          } catch (storageException) {
            console.error(`❌ [APPROVED-CLEANUP] Exceção ao remover arquivo do storage para ${documentId}:`, storageException);
          }
        }

        // 3. Apagar sessões Stripe relacionadas
        try {
          const { error: sessionDeleteError } = await supabase
            .from('stripe_sessions')
            .delete()
            .eq('document_id', documentId);

          if (sessionDeleteError) {
            console.error(`⚠️ [APPROVED-CLEANUP] Erro ao remover sessões Stripe para ${documentId}:`, sessionDeleteError);
          } else {
            console.log(`🗑️ [APPROVED-CLEANUP] Sessões Stripe removidas para doc ${documentId}`);
            sessionsDeletedCount++;
          }
        } catch (sessionException) {
          console.error(`❌ [APPROVED-CLEANUP] Exceção ao remover sessões Stripe para ${documentId}:`, sessionException);
        }

        // 4. Apagar documento do banco
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('id', documentId);

        if (deleteError) {
          console.error(`❌ [APPROVED-CLEANUP] Erro ao remover documento ${documentId}:`, deleteError);
          errors.push({ documentId, error: deleteError.message });
        } else {
          console.log(`✅ [APPROVED-CLEANUP] Documento ${documentId} (${doc.filename}) removido com sucesso`);
          deletedCount++;
        }

      } catch (docException) {
        console.error(`❌ [APPROVED-CLEANUP] Exceção ao processar documento ${documentId}:`, docException);
        errors.push({ documentId, error: docException.message });
      }
    }
```

**Processo de Exclusão (por documento):**

1. **Validação**
   - Verifica se o documento existe
   - Verifica se o status é `draft` (segurança extra)

2. **Remover Arquivo do Storage**
   - Extrai o caminho do arquivo da URL
   - Remove do bucket `documents` no Supabase Storage

3. **Remover Sessões Stripe**
   - Deleta todas as sessões Stripe relacionadas ao documento
   - Limpa registros da tabela `stripe_sessions`

4. **Remover Documento do Banco**
   - Deleta o registro da tabela `documents`
   - Último passo para garantir integridade

**Segurança:**
- Apenas documentos com `status = 'draft'` podem ser removidos
- Se o documento não for encontrado ou não for draft, é ignorado (não causa erro fatal)
- Erros em cada etapa são registrados mas não interrompem o processo

---

## 📊 Exibição no Dashboard

### Filtro de Status Draft

Na tabela principal de documentos (`DocumentsTable`), os drafts são **ocultos por padrão**:

```254:259:src/pages/AdminDashboard/DocumentsTable.tsx
      // Filtro de status: por padrão (all), esconder drafts
      const effectiveStatus = (doc.translation_status || doc.status || '').toLowerCase();
      const matchesStatus = (
        (statusFilter === 'all' && effectiveStatus !== 'draft') ||
        (statusFilter !== 'all' && effectiveStatus === statusFilter)
      );
```

**Comportamento:**
- Filtro "All Status": **Esconde** documentos draft
- Filtro "Draft": **Mostra apenas** documentos draft
- Permite visualizar drafts quando necessário

### Exclusão de Drafts nas Estatísticas

Os drafts são **excluídos automaticamente** das estatísticas:

```194:202:src/pages/AdminDashboard/StatsCards.tsx
  // Filtrar documentos: excluir drafts e pagamentos cancelados/reembolsados
  const validDocuments = documents.filter(doc => {
    if ((doc.status || '') === 'draft') return false; // excluir drafts
    const paymentStatus = paymentStatuses.get(doc.id);
    // Se não há payment_status, incluir o documento (pode ser de autenticador)
    if (!paymentStatus) return true;
    // Excluir documentos com pagamentos cancelados ou reembolsados
    return paymentStatus !== 'cancelled' && paymentStatus !== 'refunded';
  });
```

**Impacto:**
- Total Revenue não inclui drafts
- Contagem de documentos não inclui drafts
- Métricas gerais não são afetadas por drafts

---

## 🔐 Segurança e Validações

### Validações na Listagem

1. **Idade Mínima**: Documentos criados há menos de 30 minutos não são listados
2. **Verificação de Pagamentos**: Documentos com pagamentos confirmados são sempre protegidos
3. **Status de Sessão**: Sessões recentes ou completadas protegem o documento
4. **Erro = Proteção**: Em caso de erro na verificação, o documento é protegido

### Validações na Exclusão

1. **Status Draft**: Apenas documentos com `status = 'draft'` podem ser removidos
2. **Verificação Dupla**: A função de exclusão verifica novamente o status antes de remover
3. **Transação Segura**: Cada documento é processado individualmente
4. **Logs Detalhados**: Todas as ações são registradas para auditoria

---

## 📈 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│  Cliente faz upload mas não completa pagamento              │
│  → Documento criado com status='draft'                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Admin acessa aba "Draft Cleanup"                           │
│  → Clica em "Check Documents"                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge Function: list-drafts-for-cleanup                     │
│  1. Busca documentos draft (criados há >30min)                │
│  2. Sincroniza sessões Stripe                                │
│  3. Verifica pagamentos                                      │
│  4. Categoriza em "seguros" e "protegidos"                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Interface mostra duas listas:                              │
│  • Documents Safe for Removal                                │
│  • Protected Documents                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Admin seleciona documentos e clica "Remove Selected"        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge Function: approved-cleanup                            │
│  1. Valida status='draft'                                    │
│  2. Remove arquivo do storage                                │
│  3. Remove sessões Stripe                                    │
│  4. Remove documento do banco                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Documentos removidos com sucesso                            │
│  → Lista atualizada automaticamente                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Resumo

### Características Principais

✅ **Identificação Automática**: Sistema identifica documentos draft sem pagamento  
✅ **Verificação Segura**: Valida cada documento antes de permitir remoção  
✅ **Proteção Inteligente**: Protege documentos com pagamentos ou sessões ativas  
✅ **Interface Intuitiva**: Dashboard separado para gerenciar drafts  
✅ **Exclusão Completa**: Remove documento, arquivo e sessões relacionadas  
✅ **Logs Detalhados**: Todas as ações são registradas para auditoria  

### Quando Usar

- **Limpeza Regular**: Remover documentos antigos sem pagamento
- **Manutenção**: Limpar espaço de storage e banco de dados
- **Auditoria**: Verificar documentos que não geraram receita

### Quando NÃO Usar

- ❌ Documentos com pagamentos confirmados (são automaticamente protegidos)
- ❌ Documentos com sessões Stripe recentes (menos de 24 horas)
- ❌ Documentos que não são draft (sistema valida automaticamente)

---

## 📝 Notas Técnicas

### Edge Functions

1. **`list-drafts-for-cleanup`**
   - Localização: `supabase/functions/list-drafts-for-cleanup/index.ts`
   - Método: POST
   - Retorna: Lista de documentos categorizados

2. **`approved-cleanup`**
   - Localização: `supabase/functions/approved-cleanup/index.ts`
   - Método: POST
   - Parâmetros: `{ documentIds: string[] }`
   - Retorna: Contagem de documentos removidos

### Componentes Frontend

1. **`DraftCleanupApproval`**
   - Localização: `src/pages/AdminDashboard/DraftCleanupApproval.tsx`
   - Função: Interface de gerenciamento de drafts

2. **`AdminDashboard`**
   - Localização: `src/pages/AdminDashboard/index.tsx`
   - Aba: `draft-cleanup` (acessível via `/admin#draft-cleanup`)

### Tabelas do Banco de Dados

- **`documents`**: Armazena documentos (status='draft' para drafts)
- **`stripe_sessions`**: Armazena sessões de pagamento Stripe
- **`payments`**: Armazena pagamentos confirmados









