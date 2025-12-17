# Dashboard Lush Admin - Separação por Tipo de Usuário

## 🎯 **Objetivo**

Separar as estatísticas do dashboard Lush Admin para distinguir entre:
- **Uploads de Usuários Regulares** (clientes finais)
- **Uploads de Autenticadores** (funcionários/parceiros)

## 🚀 **Implementação**

### **1. Nova Migração SQL**

Execute a migração `20250815000000_enhanced_translation_stats.sql` que cria:

- `get_enhanced_translation_stats()` - Estatísticas separadas por tipo de usuário
- `get_user_type_breakdown()` - Breakdown detalhado por categoria

### **2. Componente StatsCards Atualizado**

O componente agora mostra:

#### **Cards Principais:**
- **Total Payments** - Pagamentos totais
- **Total Revenue** - Receita total de todas as fontes
- **User Uploads** - Uploads de usuários regulares + receita
- **Authenticator Uploads** - Uploads de autenticadores + receita

#### **Breakdown por Tipo de Usuário:**
- **Regular Users**: Documentos, status e receita de clientes finais
- **Authenticators**: Documentos, status e receita de autenticadores

#### **Status Breakdown:**
- **Completed**: Total de documentos completados
- **Processing**: Total em processamento
- **Pending**: Total pendentes

## 📊 **Como Funciona**

### **Função RPC Principal:**
```sql
get_enhanced_translation_stats()
```

**Retorna:**
- Estatísticas gerais (total_documents, total_revenue)
- Estatísticas de usuários regulares (user_uploads_*)
- Estatísticas de autenticadores (authenticator_uploads_*)
- Breakdown por status (total_completed, total_pending, total_processing)

### **Função RPC de Breakdown:**
```sql
get_user_type_breakdown()
```

**Retorna:**
- Lista com 2 entradas: "Regular Users" e "Authenticators"
- Para cada tipo: documentos, status, receita e média por documento

## 🔧 **Aplicação da Migração**

### **Via Supabase CLI:**
```bash
supabase db push
```

### **Via Dashboard Supabase:**
1. Acesse o projeto no dashboard
2. Vá para SQL Editor
3. Cole o conteúdo da migração
4. Execute

## 📈 **Benefícios da Separação**

### **Para Administradores:**
- ✅ Visibilidade clara de cada canal de receita
- ✅ Análise de performance por tipo de usuário
- ✅ Identificação de tendências separadas
- ✅ Melhor tomada de decisão estratégica

### **Para Análise de Negócio:**
- 📊 Comparação de conversão entre canais
- 📊 Análise de receita por segmento
- 📊 Identificação de oportunidades de crescimento
- 📊 Relatórios mais precisos

## 🎨 **Interface Visual**

### **Cards Coloridos:**
- **💙 Total Payments**: Azul (pagamentos)
- **💚 Total Revenue**: Verde (receita)
- **💜 User Uploads**: Roxo (usuários regulares)
- **🧡 Authenticator Uploads**: Laranja (autenticadores)

### **Breakdown Visual:**
- **Grid responsivo** com 2 colunas
- **Badges coloridos** para contagem de documentos
- **Métricas detalhadas** por status
- **Receita e médias** destacadas

## 🔄 **Compatibilidade**

### **Fallback Graceful:**
- Se as novas funções RPC não existirem, o dashboard continua funcionando
- Usa as estatísticas antigas como fallback
- Não quebra a funcionalidade existente

### **Migração Gradual:**
- Aplicar migração primeiro
- Dashboard se adapta automaticamente
- Sem necessidade de deploy simultâneo

## 📋 **Próximos Passos**

### **Imediato:**
1. ✅ Aplicar migração SQL
2. ✅ Deploy do código atualizado
3. ✅ Testar funcionalidade

### **Futuro:**
- 📅 Filtros por período (hoje, semana, mês, ano)
- 📅 Gráficos de tendência por tipo de usuário
- 📅 Exportação de relatórios separados
- 📅 Alertas por canal de receita

## 🐛 **Troubleshooting**

### **Erro: "Function does not exist"**
- Verificar se a migração foi aplicada
- Confirmar permissões de execução
- Verificar logs do Supabase

### **Dados não aparecem**
- Verificar se existem documentos na tabela `documents_to_be_verified`
- Confirmar se os usuários têm roles corretos em `profiles`
- Verificar políticas RLS

### **Performance lenta**
- Verificar índices na tabela `documents_to_be_verified`
- Confirmar se as funções RPC estão otimizadas
- Monitorar logs de performance

## 📞 **Suporte**

Para dúvidas ou problemas:
1. Verificar logs do console do navegador
2. Verificar logs do Supabase
3. Confirmar estrutura das tabelas
4. Validar permissões de usuário
