
# ==============================================================
#  Lush America - Reenvio de Documentos para N8N
#  Uso:
#    .\resend-to-n8n.ps1                    -> Dry-run
#    .\resend-to-n8n.ps1 -Execute           -> Executa
#    .\resend-to-n8n.ps1 -Execute -DelaySeconds 45
# ==============================================================

param(
    [switch]$Execute,
    [int]$DelaySeconds = 35
)

$SB_URL      = "https://yslbjhnqfkjdoxuixfyh.supabase.co"
$ANON_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbGJqaG5xZmtqZG94dWl4ZnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjMwNzksImV4cCI6MjA3MTE5OTA3OX0.sAbOqC1qqG99B8v3QcbIxa2WaS9jfhlm3jYpjDysGK8"
$WEBHOOK_URL = "$SB_URL/functions/v1/send-translation-webhook"

# ──────────────────────────────────────────
# 6 DOCUMENTOS COM ARQUIVO CONFIRMADO NO STORAGE
# ──────────────────────────────────────────
$documents = @(

    # Rafael Augusto (3 docs)
    @{
        label             = "Rafael - RG/CPF (FSJ4AI)"
        filename          = "rafael_augusto_morais_de_sousa_FSJ4AI.pdf"
        original_filename = "RAFAEL AUGUSTO MORAIS DE SOUSA.pdf"
        url               = "$SB_URL/storage/v1/object/public/documents/6e95cbd8-62f8-4e21-9cd0-e0720bd2089b/rafael_augusto_morais_de_sousa_FSJ4AI.pdf"
        user_id           = "6e95cbd8-62f8-4e21-9cd0-e0720bd2089b"
        document_id       = "e82cbcca-c3d2-418f-a94f-69add40e46d5"
        pages             = 2
        total_cost        = 41.94
        is_bank_statement = $false
        source_currency   = $null
        target_currency   = $null
    },
    @{
        label             = "Rafael - Extrato Itau Investimento (C1INKN)"
        filename          = "extrato-investimento-itau-06-04-2026_1_C1INKN.pdf"
        original_filename = "extrato-investimento-itau-06-04-2026 (1).pdf"
        url               = "$SB_URL/storage/v1/object/public/documents/6e95cbd8-62f8-4e21-9cd0-e0720bd2089b/extrato-investimento-itau-06-04-2026_1_C1INKN.pdf"
        user_id           = "6e95cbd8-62f8-4e21-9cd0-e0720bd2089b"
        document_id       = "7ac4e80d-f203-4f2a-8b3a-e3cdf38a3dea"
        pages             = 1
        total_cost        = 26.33
        is_bank_statement = $true
        source_currency   = "BRL"
        target_currency   = "USD"
    },
    @{
        label             = "Rafael - Statement Bank (6A8Q6D)"
        filename          = "statement6391108964409593634360652380707b0d5a1_1_6A8Q6D.pdf"
        original_filename = "Statement6391108964409593634360652380707b0d5a1 (1).pdf"
        url               = "$SB_URL/storage/v1/object/public/documents/6e95cbd8-62f8-4e21-9cd0-e0720bd2089b/statement6391108964409593634360652380707b0d5a1_1_6A8Q6D.pdf"
        user_id           = "6e95cbd8-62f8-4e21-9cd0-e0720bd2089b"
        document_id       = "f0a523bc-1809-462c-a766-0769b6827fbc"
        pages             = 3
        total_cost        = 78.36
        is_bank_statement = $true
        source_currency   = "BRL"
        target_currency   = "USD"
    },

    # Alexandre Azambuja (1 doc)
    @{
        label             = "Alexandre - Extrato Santander (7D18VN)"
        filename          = "alexandre_extrato_santander_7D18VN.pdf"
        original_filename = "Alexandre_Extrato_Santander.pdf"
        url               = "$SB_URL/storage/v1/object/public/documents/d80d6df7-b0bd-4578-905b-64d2946cc0c2/alexandre_extrato_santander_7D18VN.pdf"
        user_id           = "d80d6df7-b0bd-4578-905b-64d2946cc0c2"
        document_id       = "80666a24-2bcf-4aa4-89c8-8642644107e8"
        pages             = 2
        total_cost        = 52.34
        is_bank_statement = $true
        source_currency   = "BRL"
        target_currency   = "USD"
    },

    # Lucca Milhomem (2 docs)
    @{
        label             = "Lucca - Extrato Itau 11-02 (LGMA41)"
        filename          = "extrato_itau_11-02_LGMA41.pdf"
        original_filename = "Extrato Itau 11-02.pdf"
        url               = "$SB_URL/storage/v1/object/public/documents/65654dbb-8a5a-4dfa-baeb-5458546f5e40/extrato_itau_11-02_LGMA41.pdf"
        user_id           = "65654dbb-8a5a-4dfa-baeb-5458546f5e40"
        document_id       = "ff394e9b-dbd2-4732-a33d-1b16bc75efeb"
        pages             = 3
        total_cost        = 78.36
        is_bank_statement = $true
        source_currency   = "BRL"
        target_currency   = "USD"
    },
    @{
        # ATENCAO: arquivo no storage tem sufixo _IJMWDI, diferente do filename no DB (_EFS0XC)
        # Usamos a URL com o nome real do arquivo para o N8N conseguir baixar
        label             = "Lucca - Documento Audi (EFS0XC -> real: IJMWDI)"
        filename          = "documento_audi_novo_EFS0XC.pdf"
        original_filename = "DOCUMENTO AUDI NOVO.pdf"
        url               = "$SB_URL/storage/v1/object/public/documents/65654dbb-8a5a-4dfa-baeb-5458546f5e40/documento_audi_novo_IJMWDI.pdf"
        user_id           = "65654dbb-8a5a-4dfa-baeb-5458546f5e40"
        document_id       = "c67092fd-e4f0-4b56-993f-894e913ce21e"
        pages             = 1
        total_cost        = 20.00
        is_bank_statement = $false
        source_currency   = $null
        target_currency   = $null
    }
)

# ──────────────────────────────────────────
# FUNCOES
# ──────────────────────────────────────────
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 65) -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("=" * 65) -ForegroundColor Cyan
}

function Send-Document {
    param($doc)

    $payload = @{
        filename          = $doc.filename
        original_filename = $doc.original_filename
        url               = $doc.url
        user_id           = $doc.user_id
        document_id       = $doc.document_id
        pages             = $doc.pages
        total_cost        = $doc.total_cost
        is_bank_statement = $doc.is_bank_statement
        source_language   = "Portuguese"
        target_language   = "English"
        idioma_raiz       = "Portuguese"
        idioma_destino    = "English"
        source_currency   = $doc.source_currency
        target_currency   = $doc.target_currency
        mimetype          = "application/pdf"
        tipo_trad         = "Certified"
    } | ConvertTo-Json -Depth 5

    $headers = @{
        "apikey"        = $ANON_KEY
        "Authorization" = "Bearer $ANON_KEY"
        "Content-Type"  = "application/json"
    }

    try {
        $resp = Invoke-RestMethod -Uri $WEBHOOK_URL -Method POST `
                                  -Headers $headers -Body $payload `
                                  -ErrorAction Stop
        Write-Host "  [OK] Status: $($resp.status) - $($resp.message)" -ForegroundColor Green
        return $true
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "  [FAIL] HTTP $code - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ──────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────
Write-Header "LUSH AMERICA - Reenvio para N8N"
Write-Host ""

$modeLabel = if ($Execute) { "EXECUCAO REAL" } else { "DRY-RUN (use -Execute para enviar)" }
Write-Host "  Modo    : $modeLabel" -ForegroundColor $(if ($Execute) { "Yellow" } else { "Gray" })
Write-Host "  Docs    : $($documents.Count) documentos"
Write-Host "  Delay   : ${DelaySeconds}s entre cada envio"
Write-Host "  Webhook : $WEBHOOK_URL"
Write-Host ""

$total   = $documents.Count
$success = 0
$failed  = 0

for ($i = 0; $i -lt $total; $i++) {
    $doc = $documents[$i]
    $num = $i + 1

    Write-Host ""
    Write-Host "-- [$num/$total] $($doc.label)" -ForegroundColor White
    Write-Host "   filename    : $($doc.filename)"
    Write-Host "   document_id : $($doc.document_id)"
    Write-Host "   pages/cost  : $($doc.pages) pag | `$$($doc.total_cost)"
    Write-Host "   bank_stmt   : $($doc.is_bank_statement)"

    $shortUrl = if ($doc.url.Length -gt 90) { $doc.url.Substring(0, 90) + "..." } else { $doc.url }
    Write-Host "   url         : $shortUrl"

    if (-not $Execute) {
        Write-Host "   [DRY-RUN] Pulando." -ForegroundColor DarkGray
        continue
    }

    Write-Host "   Enviando para N8N..." -ForegroundColor Yellow
    $ok = Send-Document -doc $doc

    if ($ok) { $success++ } else { $failed++ }

    # Delay entre envios (nao esperar apos o ultimo)
    if ($i -lt ($total - 1)) {
        Write-Host ""
        Write-Host "  Aguardando ${DelaySeconds}s antes do proximo..." -ForegroundColor DarkCyan

        for ($s = $DelaySeconds; $s -gt 0; $s--) {
            Write-Host -NoNewline "`r  Proximo em ${s}s...   "
            Start-Sleep -Seconds 1
        }
        Write-Host "`r  Continuando...           "
    }
}

# RESUMO
Write-Header "RESUMO FINAL"
Write-Host ""
if ($Execute) {
    Write-Host "  Enviados com sucesso : $success / $total" -ForegroundColor Green
    if ($failed -gt 0) {
        Write-Host "  Falhas               : $failed / $total" -ForegroundColor Red
    } else {
        Write-Host "  Falhas               : 0" -ForegroundColor Gray
    }
} else {
    Write-Host "  Dry-run OK. $total documentos prontos para envio."
    Write-Host ""
    Write-Host "  Para enviar:"
    Write-Host "    .\scripts\resend-to-n8n.ps1 -Execute" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Para delay maior (ex: 60s):"
    Write-Host "    .\scripts\resend-to-n8n.ps1 -Execute -DelaySeconds 60" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ATENCAO - Excluidos (sem arquivo no storage):" -ForegroundColor DarkRed
Write-Host "    extrato_itau_032026_3Q6UF8.pdf (Christiano)" -ForegroundColor DarkRed
Write-Host "    extrato_itau_032026_KKZWNJ.pdf (Christiano)" -ForegroundColor DarkRed
Write-Host "    -> Christiano precisa fazer re-upload desses 2 arquivos." -ForegroundColor DarkRed
Write-Host ""
