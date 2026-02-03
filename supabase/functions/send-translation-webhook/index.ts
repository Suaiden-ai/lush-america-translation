import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Cache para evitar processamento duplicado
const processedRequests = new Map<string, number>();

Deno.serve(async (req: Request) => {
  console.log(`[${new Date().toISOString()}] Edge Function: send-translation-webhook called`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    console.log(`Method ${req.method} not allowed`);
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Supabase URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
    console.log("Service Role Key:", supabaseServiceKey ? "✓ Set" : "✗ Missing");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const requestBody = await req.text();
    console.log("=== WEBHOOK CALL START ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Raw request body:", requestBody);

    const parsedBody = JSON.parse(requestBody);
    console.log("Parsed request body:", parsedBody);
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));

    // Log adicional para identificar a fonte da chamada
    const referer = req.headers.get('referer') || 'unknown';
    const origin = req.headers.get('origin') || 'unknown';
    console.log("=== REQUEST SOURCE INFO ===");
    console.log("Referer:", referer);
    console.log("Origin:", origin);
    console.log("User-Agent:", req.headers.get('user-agent') || 'unknown');

    // Gerar um ID único para esta requisição baseado no conteúdo (SEM timestamp para detectar duplicatas reais)
    const requestId = `${parsedBody.user_id || 'unknown'}_${parsedBody.filename || 'unknown'}`;
    console.log("Request ID:", requestId);

    // VERIFICAÇÃO ROBUSTA DE DUPLICATAS USANDO BANCO DE DADOS
    // Cache em memória pode falhar se houver múltiplas instâncias da Edge Function
    if (parsedBody.user_id && parsedBody.filename) {
      console.log("🔍 VERIFICAÇÃO ANTI-DUPLICATA: Checando banco de dados...");

      const cutoffTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutos atrás

      const { data: recentDocs, error: recentError } = await supabase
        .from('documents_to_be_verified')
        .select('id, filename, created_at')
        .eq('user_id', parsedBody.user_id)
        .eq('filename', parsedBody.filename)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentError) {
        console.log("⚠️ Erro ao verificar duplicatas:", recentError);
      } else if (recentDocs && recentDocs.length > 0) {
        console.log("🚨 DUPLICATA DETECTADA! Documento já processado recentemente:");
        console.log("Documento existente:", recentDocs[0]);
        console.log("⏱️ Criado em:", recentDocs[0].created_at);
        console.log("✅ IGNORANDO upload duplicado para prevenir múltiplos documentos");

        return new Response(
          JSON.stringify({
            success: true,
            status: 200,
            message: "Document already processed recently - duplicate prevented",
            existing_document: recentDocs[0],
            timestamp: new Date().toISOString()
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } else {
        console.log("✅ Nenhuma duplicata encontrada, prosseguindo com o upload");
      }
    }

    // Cache em memória como backup (pode não funcionar com múltiplas instâncias)
    const now = Date.now();
    const lastProcessed = processedRequests.get(requestId);
    if (lastProcessed && (now - lastProcessed) < 120000) {
      console.log("🔄 Cache em memória detectou duplicata");
      return new Response(
        JSON.stringify({
          success: true,
          status: 200,
          message: "Request already processed (memory cache)",
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Marcar esta requisição como processada
    processedRequests.set(requestId, now);

    // Limpar cache antigo (mais de 5 minutos)
    for (const [key, timestamp] of processedRequests.entries()) {
      if (now - timestamp > 300000) { // 5 minutos
        processedRequests.delete(key);
      }
    }

    // Recebe o evento do Supabase Storage ou do frontend
    const {
      filename,
      url,
      mimetype,
      size,
      record,
      user_id,
      pages,
      paginas,
      document_type,
      tipo_trad,
      total_cost,
      valor,
      source_language,
      target_language,
      idioma_raiz,
      idioma_destino,
      is_bank_statement,
      client_name,
      source_currency,
      target_currency,
      document_id,
      original_document_id,
      original_filename
    } = parsedBody;

    // Debug logs para idiomas e moedas
    console.log("=== LANGUAGE & CURRENCY DEBUG ===");
    console.log("source_language:", source_language);
    console.log("target_language:", target_language);
    console.log("idioma_raiz:", idioma_raiz);
    console.log("idioma_destino:", idioma_destino);
    console.log("source_currency:", source_currency);
    console.log("target_currency:", target_currency);
    console.log("is_bank_statement:", is_bank_statement);

    // Buscar original_filename da tabela documents se não estiver no payload
    let finalOriginalFilename = original_filename;
    if (!finalOriginalFilename && document_id) {
      console.log("🔍 Buscando original_filename na tabela documents para document_id:", document_id);
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('original_filename, filename')
        .eq('id', document_id)
        .single();

      if (docError) {
        console.error("❌ Erro ao buscar documento:", docError);
      } else {
        finalOriginalFilename = docData.original_filename || docData.filename;
        console.log("✅ original_filename encontrado:", finalOriginalFilename);
      }
    }

    let payload;

    if (record) {
      // Called from Storage trigger
      console.log("Processing storage trigger payload");
      const bucket = record.bucket_id || record.bucket || record.bucketId || 'documents';
      const path = record.name || record.path || record.file_name;

      // IMPORTANTE: Como os buckets são privados, usar Proxy URL autenticado para o n8n
      const n8nSecret = Deno.env.get("N8N_STORAGE_SECRET") || "";
      const publicUrl = `${supabaseUrl}/functions/v1/n8n-storage-access?bucket=${bucket}&path=${encodeURIComponent(path)}&token=${n8nSecret}`;

      console.log("Final Proxy URL for n8n:", publicUrl);

      payload = {
        filename: path,
        url: publicUrl,
        mimetype: record.mimetype || record.metadata?.mimetype || "application/octet-stream",
        size: record.size || record.metadata?.size || null,
        user_id: record.user_id || record.metadata?.user_id || null,
        // Sempre usar campos padronizados
        pages: record.pages || pages || paginas || 1,
        document_type: 'Certificado', // Sempre usar 'Certificado' em português
        total_cost: record.total_cost || total_cost || record.valor || valor || '0',
        source_language: record.source_language || source_language || record.idioma_raiz || idioma_raiz,
        target_language: record.target_language || target_language || record.idioma_destino || idioma_destino,
        is_bank_statement: record.is_bank_statement || is_bank_statement || false,
        client_name: record.client_name || client_name || null,
        // Campos de moeda para bank statements
        source_currency: record.source_currency || source_currency || null,
        target_currency: record.target_currency || target_currency || null,
        // Campos para identificação do documento original
        original_document_id: record.original_document_id || original_document_id || document_id || null,
        original_filename: finalOriginalFilename,
        // Adicionar informações sobre o tipo de arquivo
        isPdf: (record.mimetype || record.metadata?.mimetype || "application/octet-stream") === 'application/pdf',
        fileExtension: path.split('.').pop()?.toLowerCase(),
        // Informar ao n8n que deve usar a tabela 'profiles' em vez de 'users'
        tableName: 'profiles',
        schema: 'public'
      };
    } else {
      // Called from frontend
      console.log("Processing frontend payload");
      console.log("URL received:", url);
      console.log("User ID:", user_id);
      console.log("Filename:", filename);

      // Verificar se a URL já é válida
      // Converter a URL para Proxy URL se for do Supabase
      let finalUrl = url;
      if (url && url.includes('supabase.co')) {
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/').filter(p => p);

          // Detectar bucket e path
          const publicIndex = pathParts.findIndex(p => p === 'public');
          const objectIndex = pathParts.findIndex(p => p === 'object');

          let bucket = 'documents';
          let filePath = '';

          if (publicIndex >= 0) {
            bucket = pathParts[publicIndex + 1];
            filePath = pathParts.slice(publicIndex + 2).join('/');
          } else if (objectIndex >= 0) {
            bucket = pathParts[objectIndex + 2];
            filePath = pathParts.slice(objectIndex + 3).join('/');
          }

          if (filePath) {
            const n8nSecret = Deno.env.get("N8N_STORAGE_SECRET") || "";
            finalUrl = `${supabaseUrl}/functions/v1/n8n-storage-access?bucket=${bucket}&path=${encodeURIComponent(filePath)}&token=${n8nSecret}`;
            console.log("Converted frontend URL to Proxy URL for n8n:", finalUrl);
          }
        } catch (urlError) {
          console.error("Error parsing frontend URL for proxy conversion:", urlError);
        }
      }

      payload = {
        filename: filename,
        url: finalUrl,
        mimetype,
        size,
        user_id: user_id || null,
        // Sempre usar campos padronizados
        pages: pages || paginas || 1,
        document_type: 'Certificado', // Sempre usar 'Certificado' em português
        total_cost: total_cost || valor || '0',
        source_language: source_language || idioma_raiz,
        target_language: target_language || idioma_destino,
        is_bank_statement: is_bank_statement || false,
        client_name: client_name || null,
        // Campos de moeda para bank statements
        source_currency: source_currency || null,
        target_currency: target_currency || null,
        // Campos para identificação do documento original
        original_document_id: original_document_id || document_id || null,
        original_filename: finalOriginalFilename,
        // Adicionar informações sobre o tipo de arquivo
        isPdf: mimetype === 'application/pdf',
        fileExtension: filename.split('.').pop()?.toLowerCase(),
        // Informar ao n8n que deve usar a tabela 'profiles' em vez de 'users'
        tableName: 'profiles',
        schema: 'public'
      };

      console.log("Final payload for frontend:", JSON.stringify(payload, null, 2));
    }

    console.log("Final payload for n8n webhook:", JSON.stringify(payload, null, 2));

    // Verificar se o arquivo é um PDF antes de enviar para o n8n
    const isPdf = payload.isPdf || payload.mimetype === 'application/pdf' || payload.filename.toLowerCase().endsWith('.pdf');
    console.log("Is PDF file:", isPdf);
    console.log("File mimetype:", payload.mimetype);
    console.log("File extension:", payload.fileExtension);
    console.log("Table name for n8n:", payload.tableName);

    // Send POST to n8n webhook
    const webhookUrl = "https://nwh.thefutureofenglish.com/webhook/thelushamericatranslations";
    console.log("Sending webhook to:", webhookUrl);
    console.log("Payload being sent to n8n:", JSON.stringify(payload, null, 2));

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Supabase-Edge-Function/1.0"
      },
      body: JSON.stringify(payload),
    });
    const responseText = await webhookResponse.text();
    console.log("n8n webhook response status:", webhookResponse.status);
    console.log("n8n webhook response headers:", Object.fromEntries(webhookResponse.headers.entries()));
    console.log("n8n webhook response body:", responseText);

    // If webhook call was successful and we have user_id, update document status
    if (webhookResponse.ok && user_id && filename) {
      try {
        console.log("Updating document status to processing...");
        console.log("Looking for document with user_id:", user_id, "and filename:", filename);

        const { data: updateData, error: updateError } = await supabase
          .from('documents')
          .update({ status: 'processing' })
          .eq('user_id', user_id)
          .eq('filename', filename)
          .select();

        if (updateError) {
          console.error("Error updating document status:", updateError);
        } else {
          console.log("Document status updated successfully:", updateData);
        }
      } catch (updateError) {
        console.error("Exception updating document status:", updateError);
      }
    }

    // 📋 FLUXO CORRETO: Apenas enviar para n8n
    // O retorno do webhook do n8n é que vai salvar na tabela documents_to_be_verified
    if (webhookResponse.ok) {
      console.log("✅ Webhook enviado para n8n com sucesso");
      console.log("📋 O retorno do n8n será responsável por salvar em documents_to_be_verified");
      console.log("🚫 Edge Function NÃO deve inserir diretamente em documents_to_be_verified");
    }

    const responseData = {
      success: webhookResponse.ok,
      status: webhookResponse.status,
      message: responseText,
      payload: payload,
      timestamp: new Date().toISOString()
    };

    console.log("Final response:", JSON.stringify(responseData, null, 2));

    return new Response(
      JSON.stringify(responseData),
      {
        status: webhookResponse.ok ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error("Error in send-translation-webhook:", error);
    console.error("Error stack:", error.stack);

    const errorResponse = {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});