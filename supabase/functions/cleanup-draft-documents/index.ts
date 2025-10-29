import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar método HTTP
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Obter parâmetros do body
    const { userId, executionId } = await req.json().catch(() => ({}));
    
    // Validar userId que é sempre obrigatório
    if (!userId) {
      throw new Error('userId is required');
    }

    console.log(`🧹 CLEANUP: Recebido pedido para deletar documentos em draft do usuário: ${userId}`);
    console.log(`🔍 DEBUG: Request details:`, {
      method: req.method,
      url: req.url,
      userId: userId,
      executionId: executionId,
      timestamp: new Date().toISOString()
    });
    
    // Obter variáveis de ambiente
    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables not configured');
    }

    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Primeiro, vamos verificar quantos documentos em draft existem para este usuário
    const { data: draftDocs, error: countError } = await supabase
      .from('documents')
      .select('id, filename, created_at, status')
      .eq('status', 'draft')
      .eq('user_id', userId);

    if (countError) {
      console.error('❌ ERROR: Erro ao contar documentos draft:', countError);
    } else {
      console.log(`📊 INFO: Encontrados ${draftDocs?.length || 0} documentos em draft para usuário ${userId}:`, draftDocs);
    }

    // Deletar todos os documentos em draft do usuário
    const { data: deletedDocs, error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('status', 'draft')
      .eq('user_id', userId)
      .select(); // Adicionar select para ver o que foi deletado

    if (deleteError) {
      console.error('❌ ERROR: Falha ao deletar documentos draft:', deleteError);
      throw new Error('Failed to delete draft documents: ' + deleteError.message);
    }

    const deletedCount = deletedDocs?.length || 0;
    console.log(`✅ SUCCESS: ${deletedCount} documentos em draft deletados para usuário ${userId}`);
    console.log('🗑️ DEBUG: Documentos deletados:', deletedDocs);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully deleted ${deletedCount} draft documents for user ${userId}`,
        deletedCount: deletedCount,
        deletedDocuments: deletedDocs,
        userId: userId,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('ERROR:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
