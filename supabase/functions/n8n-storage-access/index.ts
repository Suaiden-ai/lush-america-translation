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

    try {
        const url = new URL(req.url);
        const bucket = url.searchParams.get("bucket");
        const path = url.searchParams.get("path");
        const token = url.searchParams.get("token");

        // 1. Validar parâmetros
        if (!bucket || !path || !token) {
            return new Response("Missing parameters", { status: 400, headers: corsHeaders });
        }

        // 2. Validar Token de Segurança (Secret do N8N)
        const n8nSecret = Deno.env.get("N8N_STORAGE_SECRET");
        if (!n8nSecret || token !== n8nSecret) {
            console.error("Invalid n8n storage token provided");
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }

        // 3. Criar cliente Supabase com Service Role (Privilégios administrativos)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 4. Baixar o arquivo do Storage
        const { data, error } = await supabase.storage.from(bucket).download(path);

        if (error || !data) {
            console.error("Error downloading from storage:", error);
            return new Response("File not found or access error", { status: 404, headers: corsHeaders });
        }

        // 5. Determinar Content-Type
        const extension = path.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        const contentType = contentTypes[extension || ''] || 'application/octet-stream';

        // 6. Retornar o arquivo como stream
        return new Response(data, {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${path.split('/').pop()}"`,
                "Cache-Control": "public, max-age=3600"
            }
        });

    } catch (error) {
        console.error("Error in n8n-storage-access:", error);
        return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
    }
});
