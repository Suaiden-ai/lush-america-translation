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

    // Obter variáveis de ambiente
    const supabaseUrl = Deno.env.get('PROJECT_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables not configured');
    }

    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter dados da requisição
    const {
      documentId,
      fileUrl,
      userId,
      filename,
      pages,
      totalCost,
      documentType,
      isBankStatement,
      sourceLanguage,
      targetLanguage,
      clientName,
      sourceCurrency,
      targetCurrency,
      markUploadFailed,
      clearUploadFailed
    } = await req.json();

    // Validar parâmetros obrigatórios
    if (!documentId) {
      throw new Error('Missing required parameter: documentId');
    }

    // userId é obrigatório, mas se não fornecido, buscar do documento
    let finalUserId = userId;
    if (!finalUserId) {
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('user_id')
        .eq('id', documentId)
        .single();

      if (docError || !doc) {
        throw new Error('Missing required parameter: userId (and could not fetch from document)');
      }
      finalUserId = doc.user_id;
    }

    // fileUrl é obrigatório apenas se não for para marcar upload como falhado
    if (!markUploadFailed && !fileUrl) {
      throw new Error('Missing required parameter: fileUrl (unless markUploadFailed is true)');
    }

    console.log('DEBUG: Atualizando documento:', {
      documentId,
      fileUrl,
      userId,
      filename,
      pages,
      totalCost,
      documentType,
      isBankStatement,
      sourceLanguage,
      targetLanguage,
      clientName,
      markUploadFailed,
      clearUploadFailed
    });

    // Preparar dados para atualização
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Se marcar upload como falhado
    if (markUploadFailed) {
      // Buscar documento atual para obter retry_count
      const { data: currentDoc } = await supabase
        .from('documents')
        .select('upload_retry_count')
        .eq('id', documentId)
        .single();

      updateData.upload_failed_at = new Date().toISOString();
      // Manter o retry_count atual ou 0 se não existir
      if (currentDoc?.upload_retry_count !== undefined) {
        updateData.upload_retry_count = currentDoc.upload_retry_count;
      }
    }

    // Se limpar upload falhado (upload bem-sucedido)
    if (clearUploadFailed) {
      // Buscar documento atual para incrementar retry_count
      const { data: currentDoc } = await supabase
        .from('documents')
        .select('upload_retry_count')
        .eq('id', documentId)
        .single();

      updateData.upload_failed_at = null;
      updateData.upload_retry_count = (currentDoc?.upload_retry_count || 0) + 1;
    }

    // Se fileUrl fornecido, atualizar arquivo
    if (fileUrl) {
      updateData.file_url = fileUrl;
      updateData.status = 'pending';
    }

    // Adicionar campos opcionais se fornecidos
    if (filename) updateData.filename = filename;
    if (pages) updateData.pages = parseInt(pages);
    if (totalCost) updateData.total_cost = parseFloat(totalCost);
    if (documentType) updateData.tipo_trad = documentType;
    if (isBankStatement !== undefined) updateData.is_bank_statement = isBankStatement;
    if (sourceLanguage) updateData.idioma_raiz = sourceLanguage;
    if (targetLanguage) updateData.idioma_destino = targetLanguage;
    if (clientName) updateData.client_name = clientName;
    if (sourceCurrency) updateData.source_currency = sourceCurrency;
    if (targetCurrency) updateData.target_currency = targetCurrency;

    // ✅ SEMPRE definir status como pending se fileUrl fornecido
    if (fileUrl) {
      updateData.status = 'pending';
    }

    // Atualizar documento na tabela documents
    const { data: updateResult, error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('user_id', finalUserId)
      .select()
      .single();

    if (updateError) {
      console.error('ERROR: Erro ao atualizar documento:', updateError);
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log('DEBUG: Documento atualizado com sucesso:', updateResult);

    // Atualizar documento na tabela documents_to_be_verified se existir
    try {
      const { data: verificationUpdate, error: verificationError } = await supabase
        .from('documents_to_be_verified')
        .update({
          translated_file_url: fileUrl,
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('file_id', updateResult.file_id || documentId)
        .select()
        .single();

      if (verificationError) {
        console.error('ERROR: Erro ao atualizar documento para verificação:', verificationError);
        // Não falhar se isso der erro, apenas log
      } else {
        console.log('DEBUG: Documento para verificação atualizado:', verificationUpdate);
      }
    } catch (verificationError) {
      console.log('WARNING: Não foi possível atualizar documents_to_be_verified:', verificationError);
      // Não falhar se isso der erro
    }

    return new Response(
      JSON.stringify({
        success: true,
        document: updateResult
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
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}); 