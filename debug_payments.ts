
import { createClient } from '@supabase/supabase-js';

// Retrieve env vars
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('Missing VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Fetching recent documents with payments...');

    // Fetch documents with total_cost
    const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('id, filename, total_cost, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (docError) {
        console.error('Error fetching docs:', docError);
        return;
    }

    // Fetch payments
    const docIds = docs.map(d => d.id);
    const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('document_id, amount')
        .in('document_id', docIds);

    if (payError) {
        console.error('Error fetching payments:', payError);
        return;
    }

    console.log('Comparison:');
    docs.forEach(doc => {
        const payment = payments.find(p => p.document_id === doc.id);
        const docCost = doc.total_cost;
        const payAmount = payment ? payment.amount : 'N/A';

        console.log(`Doc: ${doc.filename}`);
        console.log(`  Total Cost (Gross?): ${docCost}`);
        console.log(`  Payment Amount (Net?): ${payAmount}`);
        console.log(`  Diff: ${payment ? (docCost - parseFloat(payAmount)) : 'N/A'}`);
        console.log('---');
    });
}

checkData();
