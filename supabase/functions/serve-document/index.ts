import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Extrair o caminho do arquivo da URL
    // Formato esperado: /serve-document/{bucket}/{filePath}
    // ou query param: ?bucket=documents&path=userId/filename.pdf
    const pathParts = pathname.split('/').filter(p => p);
    
    let bucket: string | null = null;
    let filePath: string | null = null;

    // Tentar extrair de query params primeiro
    const bucketParam = url.searchParams.get('bucket');
    const pathParam = url.searchParams.get('path');

    if (bucketParam && pathParam) {
      bucket = bucketParam;
      filePath = pathParam;
    } else if (pathParts.length >= 2) {
      // Formato: /serve-document/{bucket}/{filePath}
      // Remover 'serve-document' do início
      const withoutFunction = pathParts.slice(1);
      bucket = withoutFunction[0];
      filePath = withoutFunction.slice(1).join('/');
    } else {
      // Tentar extrair de URL completa do Supabase Storage
      const fullUrl = url.searchParams.get('url');
      if (fullUrl) {
        try {
          const storageUrl = new URL(fullUrl);
          const storagePath = storageUrl.pathname.split('/').filter(p => p);
          
          // Procurar por 'public' ou 'sign' ou 'object' seguido do bucket
          const publicIndex = storagePath.findIndex(p => p === 'public');
          const signIndex = storagePath.findIndex(p => p === 'sign');
          const objectIndex = storagePath.findIndex(p => p === 'object');
          
          let bucketIndex = -1;
          if (publicIndex >= 0) {
            bucketIndex = publicIndex + 1;
          } else if (signIndex >= 0) {
            bucketIndex = signIndex + 1;
          } else if (objectIndex >= 0) {
            bucketIndex = objectIndex + 1;
          }
          
          if (bucketIndex >= 0 && bucketIndex < storagePath.length) {
            bucket = storagePath[bucketIndex];
            filePath = storagePath.slice(bucketIndex + 1).join('/');
          }
        } catch (e) {
          console.error('Error parsing storage URL:', e);
        }
      }
    }

    if (!bucket || !filePath) {
      return new Response(
        generateErrorPage('URL inválida', 'A URL do arquivo não está no formato correto. Por favor, verifique o link e tente novamente.'),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        generateErrorPage('Erro de configuração', 'Serviço temporariamente indisponível. Tente novamente mais tarde.'),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o arquivo existe
    const { data: fileList, error: listError } = await supabase.storage
      .from(bucket)
      .list(filePath.split('/').slice(0, -1).join('/') || '', {
        limit: 1000,
        search: filePath.split('/').pop() || '',
      });

    // Verificar se arquivo existe
    const fileName = filePath.split('/').pop() || '';
    const fileExists = fileList?.some(file => file.name === fileName) || false;

    if (!fileExists || listError) {
      // Arquivo não encontrado - retornar página de erro customizada
      return new Response(
        generateErrorPage(
          'Arquivo não encontrado',
          'O arquivo solicitado não foi encontrado no sistema. Isso pode acontecer por alguns motivos:',
          [
            'O arquivo pode ter sido removido ou movido',
            'O link pode ter expirado',
            'Você pode não ter permissão para acessar este arquivo',
            'O arquivo pode estar sendo processado ainda'
          ]
        ),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // Arquivo existe - tentar baixar e servir
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(
        generateErrorPage(
          'Erro ao acessar arquivo',
          'Não foi possível acessar o arquivo. Isso pode acontecer por:',
          [
            'O arquivo pode estar corrompido',
            'Você pode não ter permissão para acessar este arquivo',
            'Problemas temporários no servidor de armazenamento'
          ]
        ),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // Determinar content-type baseado na extensão
    const contentType = getContentType(fileName);
    
    // Servir o arquivo
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error) {
    console.error('Error serving document:', error);
    return new Response(
      generateErrorPage(
        'Erro inesperado',
        'Ocorreu um erro inesperado ao processar sua solicitação. Por favor, tente novamente mais tarde.'
      ),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
});

function generateErrorPage(title: string, description: string, reasons?: string[]): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Lush America Translations</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: #fee2e2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .reasons {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
    }
    .reasons h2 {
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .reasons ul {
      list-style: none;
      padding: 0;
    }
    .reasons li {
      color: #6b7280;
      font-size: 14px;
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
    }
    .reasons li:before {
      content: "•";
      color: #ef4444;
      font-weight: bold;
      position: absolute;
      left: 0;
    }
    .actions {
      margin-top: 32px;
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    .btn-primary:hover {
      background: #2563eb;
    }
    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .btn-secondary:hover {
      background: #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>${title}</h1>
    <p>${description}</p>
    ${reasons && reasons.length > 0 ? `
    <div class="reasons">
      <h2>Possíveis motivos:</h2>
      <ul>
        ${reasons.map(reason => `<li>${reason}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    <div class="actions">
      <button class="btn btn-primary" onclick="window.history.back()">Voltar</button>
    </div>
  </div>
</body>
</html>`;
}

function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const types: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'txt': 'text/plain',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[ext || ''] || 'application/octet-stream';
}

