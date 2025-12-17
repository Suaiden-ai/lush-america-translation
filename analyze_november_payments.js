// Script para analisar os pagamentos de novembro e comparar valores
// Comparação entre total_cost, payment_amount e payment_amount_total

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas');
  console.log('Por favor, exporte-as no terminal:');
  console.log('export VITE_SUPABASE_URL="sua_url"');
  console.log('export VITE_SUPABASE_ANON_KEY="sua_key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function analyzeNovemberPayments() {
  console.log('🔍 Analisando pagamentos de novembro de 2025...\n');

  try {
    // Buscar todos os documentos de novembro 2025
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        filename,
        total_cost,
        payment_amount,
        payment_amount_total,
        payment_status,
        status,
        created_at,
        user_id,
        profiles!inner(name, email, role)
      `)
      .gte('created_at', '2025-11-01T00:00:00')
      .lt('created_at', '2025-12-01T00:00:00')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar documentos:', error);
      return;
    }

    console.log(`📊 Total de documentos em novembro: ${documents.length}\n`);

    // Filtrar: excluir documentos do Luiz como USUÁRIO
    const documentsExcludingLuiz = documents.filter(doc => {
      const userEmail = (doc.profiles?.email || '').toLowerCase();
      const userName = (doc.profiles?.name || '').toLowerCase();
      const isLuizUser = 
        userEmail.includes('luizeduardomcsantos') ||
        userEmail.includes('luizeduardogouveia7') ||
        userName.includes('luiz eduardo');
      return !isLuizUser;
    });

    console.log(`📊 Documentos após excluir Luiz: ${documentsExcludingLuiz.length}\n`);

    // Agrupar por status de pagamento
    const byPaymentStatus = {};
    documentsExcludingLuiz.forEach(doc => {
      const status = doc.payment_status || 'null';
      if (!byPaymentStatus[status]) {
        byPaymentStatus[status] = [];
      }
      byPaymentStatus[status].push(doc);
    });

    console.log('📊 Distribuição por payment_status:');
    Object.keys(byPaymentStatus).forEach(status => {
      console.log(`  - ${status}: ${byPaymentStatus[status].length} documentos`);
    });
    console.log('');

    // Focar apenas nos COMPLETED (pagos)
    const completedDocs = byPaymentStatus['completed'] || [];
    console.log(`✅ Documentos com payment_status = "completed": ${completedDocs.length}\n`);

    // Excluir REFUNDED dos completed
    const completedNonRefunded = completedDocs.filter(doc => doc.payment_status !== 'refunded');
    console.log(`✅ Documentos "completed" (sem refunded): ${completedNonRefunded.length}\n`);

    // Calcular totais usando diferentes campos
    let totalUsingTotalCost = 0;
    let totalUsingPaymentAmount = 0;
    let totalUsingPaymentAmountTotal = 0;

    console.log('📋 LISTA COMPLETA dos 30 documentos "completed" (sem refunded):\n');
    
    completedNonRefunded.forEach((doc, index) => {
      const totalCost = doc.total_cost || 0;
      const paymentAmount = doc.payment_amount || 0;
      const paymentAmountTotal = doc.payment_amount_total || 0;

      totalUsingTotalCost += totalCost;
      totalUsingPaymentAmount += paymentAmount;
      totalUsingPaymentAmountTotal += paymentAmountTotal;

      const userName = doc.profiles?.name || 'N/A';
      
      console.log(`${index + 1}. ${doc.filename}`);
      console.log(`   Usuário: ${userName}`);
      console.log(`   total_cost: $${totalCost.toFixed(2)} (valor BRUTO - o que o cliente pagou)`);
      console.log(`   payment_amount: $${paymentAmount.toFixed(2)} (valor LÍQUIDO - sem taxa Stripe)`);
      console.log(`   payment_amount_total: $${paymentAmountTotal.toFixed(2)}`);
      
      if (totalCost !== paymentAmount) {
        const stripeFee = totalCost - paymentAmount;
        console.log(`   Taxa Stripe: $${stripeFee.toFixed(2)}`);
      }
      
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 TOTAIS CALCULADOS:\n');
    console.log(`Usando total_cost (BRUTO - o que cliente pagou): $${totalUsingTotalCost.toFixed(2)}`);
    console.log(`Usando payment_amount (LÍQUIDO - sem taxa): $${totalUsingPaymentAmount.toFixed(2)}`);
    console.log(`Usando payment_amount_total: $${totalUsingPaymentAmountTotal.toFixed(2)}`);
    console.log('');
    
    const stripeFeeTotal = totalUsingTotalCost - totalUsingPaymentAmount;
    console.log(`Taxa total do Stripe: $${stripeFeeTotal.toFixed(2)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verificar qual campo está sendo usado no site
    console.log('🔍 ANÁLISE DA DISCREPÂNCIA:\n');
    console.log('Site mostra: $1,505.00');
    console.log('Export mostra: $1,493.45 (usando total_cost)');
    console.log(`Diferença: $${(1505 - 1493.45).toFixed(2)}\n`);

    // Verificar se há documentos refunded
    const refundedDocs = completedDocs.filter(doc => doc.payment_status === 'refunded');
    if (refundedDocs.length > 0) {
      console.log(`🚫 Documentos REFUNDED encontrados: ${refundedDocs.length}`);
      refundedDocs.forEach(doc => {
        console.log(`   - ${doc.filename}: $${(doc.total_cost || 0).toFixed(2)}`);
      });
      console.log('');
    }

    // Verificar se algum documento tem payment_amount_total diferente
    const docsWithDifferentFields = completedNonRefunded.filter(doc => {
      const totalCost = doc.total_cost || 0;
      const paymentAmountTotal = doc.payment_amount_total || 0;
      return Math.abs(totalCost - paymentAmountTotal) > 0.01;
    });

    if (docsWithDifferentFields.length > 0) {
      console.log(`⚠️ Documentos com payment_amount_total ≠ total_cost: ${docsWithDifferentFields.length}`);
      docsWithDifferentFields.forEach(doc => {
        console.log(`   - ${doc.filename}:`);
        console.log(`     total_cost: $${(doc.total_cost || 0).toFixed(2)}`);
        console.log(`     payment_amount_total: $${(doc.payment_amount_total || 0).toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro durante análise:', error);
  }
}

analyzeNovemberPayments();
